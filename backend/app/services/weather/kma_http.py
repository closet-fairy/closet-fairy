"""기상청(공공데이터포털) API 공통 호출부. 단기예보·ASOS가 같이 쓴다."""
import httpx


class KmaApiError(Exception):
    """기상청 API가 정상 응답(resultCode 00)을 주지 않았을 때."""


NO_DATA_CODE = "03"  # 해당 조건의 데이터 없음 → 빈 목록으로 처리


async def request_items(
    url: str,
    params: dict,
    service_key: str,
    timeout: float,
    transport: httpx.AsyncBaseTransport | None = None,
) -> tuple[list[dict], int]:
    """(item 목록, totalCount)를 돌려준다.

    service_key는 공공데이터포털의 '디코딩' 키를 넣는다.
    httpx가 URL 인코딩을 한 번 해 주기 때문에 인코딩 키를 넣으면 이중 인코딩이 된다.
    """
    query = {"serviceKey": service_key, "dataType": "JSON", **params}
    async with httpx.AsyncClient(timeout=timeout, transport=transport) as client:
        resp = await client.get(url, params=query)
    resp.raise_for_status()

    try:
        body = resp.json()
    except ValueError as exc:
        # 키 오류 같은 경우 dataType=JSON이어도 XML로 응답이 온다
        raise KmaApiError(f"JSON이 아닌 응답: {resp.text[:200]}") from exc

    header = body.get("response", {}).get("header", {})
    code = header.get("resultCode")
    if code == NO_DATA_CODE:
        return [], 0
    if code != "00":
        raise KmaApiError(f"resultCode={code} {header.get('resultMsg')}")

    result_body = body["response"]["body"]
    items = result_body.get("items") or {}
    item_list = items.get("item", []) if isinstance(items, dict) else []
    return item_list, int(result_body.get("totalCount", len(item_list)))
