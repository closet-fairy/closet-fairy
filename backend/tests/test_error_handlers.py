import pytest
from fastapi import FastAPI
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
