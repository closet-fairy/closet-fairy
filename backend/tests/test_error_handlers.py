import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import BaseModel, Field, field_validator

from app.core.errors import register_exception_handlers


class Body(BaseModel):
    count: int = Field(ge=1)
    name: str

    @field_validator("name")
    @classmethod
    def check_name(cls, v: str) -> str:
        if v == "bad":
            raise ValueError("이름을 다시 입력해 주세요.")
        return v


@pytest.fixture
def client():
    app = FastAPI()
    register_exception_handlers(app)

    @app.post("/items")
    async def create_item(body: Body) -> dict:
        return {"ok": True}

    @app.get("/items/{item_id}")
    async def get_item(item_id: int) -> dict:
        return {"item_id": item_id}

    @app.get("/raise/{status_code}")
    async def raise_http(status_code: int) -> dict:
        raise HTTPException(status_code=status_code, detail="Not authenticated")

    return TestClient(app)


def test_value_error_message_is_returned_without_prefix(client):
    res = client.post("/items", json={"count": 1, "name": "bad"})
    assert res.status_code == 422
    assert res.json() == {"code": "VALIDATION_ERROR", "message": "이름을 다시 입력해 주세요."}


def test_value_error_wins_over_earlier_builtin_error(client):
    res = client.post("/items", json={"count": 0, "name": "bad"})
    assert res.json()["message"] == "이름을 다시 입력해 주세요."


@pytest.mark.parametrize(
    "body",
    [
        {"name": "ok"},
        {"count": 0, "name": "ok"},
        {"count": "many", "name": "ok"},
    ],
)
def test_builtin_errors_use_generic_message(client, body):
    res = client.post("/items", json=body)
    assert res.status_code == 422
    assert res.json() == {"code": "VALIDATION_ERROR", "message": "입력값이 올바르지 않습니다."}


def test_invalid_path_param_is_validation_error(client):
    res = client.get("/items/abc")
    assert res.status_code == 422
    assert res.json()["code"] == "VALIDATION_ERROR"


def test_unknown_route_is_not_found(client):
    res = client.get("/nothing")
    assert res.status_code == 404
    assert res.json() == {"code": "NOT_FOUND", "message": "요청한 리소스를 찾을 수 없습니다."}


def test_wrong_method_keeps_allow_header(client):
    res = client.delete("/items")
    assert res.status_code == 405
    assert res.json() == {"code": "METHOD_NOT_ALLOWED", "message": "허용되지 않은 요청 방식입니다."}
    assert res.headers["allow"] == "POST"


def test_mapped_http_exception_uses_korean_message(client):
    res = client.get("/raise/401")
    assert res.status_code == 401
    assert res.json() == {"code": "UNAUTHORIZED", "message": "인증이 필요합니다."}


def test_unmapped_http_exception_hides_framework_detail(client):
    res = client.get("/raise/413")
    assert res.status_code == 413
    assert res.json() == {"code": "HTTP_ERROR", "message": "처리 중 오류가 발생했습니다."}


def test_openapi_documents_422_as_error_response():
    from app.main import app

    schema = app.openapi()
    response = schema["paths"]["/recommendation-sessions"]["post"]["responses"]["422"]
    assert response["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/ErrorResponse"
    }
    assert "HTTPValidationError" not in schema["components"]["schemas"]
