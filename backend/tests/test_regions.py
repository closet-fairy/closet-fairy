"""행정구역 목록과 가까운 지역 찾기 테스트. 실제 설정 파일(config/regions.json)을 읽는다."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.weather.regions import load_regions

SIDO_COUNT = 17
SIGUNGU_COUNT = 252


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_every_sigungu_belongs_to_a_sido_and_shares_its_asos_station():
    regions = load_regions()
    sido = {r.sido_nm: r for r in regions if r.sigungu_nm is None}
    sigungu = [r for r in regions if r.sigungu_nm is not None]

    assert len(sido) == SIDO_COUNT
    assert len(sigungu) == SIGUNGU_COUNT
    assert len({(r.sido_nm, r.sigungu_nm) for r in sigungu}) == SIGUNGU_COUNT
    for r in sigungu:
        assert r.asos_station_cd == sido[r.sido_nm].asos_station_cd
        assert 33 <= r.lat <= 39 and 124 <= r.lon <= 132


def test_region_list_groups_sigungu_by_sido_in_code_order(client):
    res = client.get("/regions")

    assert res.status_code == 200
    body = res.json()
    assert len(body) == SIDO_COUNT
    assert sum(len(s["sigungu_nms"]) for s in body) == SIGUNGU_COUNT
    assert body[0]["sido_nm"] == "서울특별시"
    assert body[0]["sigungu_nms"][:3] == ["종로구", "중구", "용산구"]
    gyeonggi = next(s for s in body if s["sido_nm"] == "경기도")
    assert gyeonggi["sigungu_nms"][:2] == ["수원시 장안구", "수원시 권선구"]


@pytest.mark.parametrize(
    ("lat", "lon", "sido_nm", "sigungu_nm"),
    [
        (35.1587, 129.1604, "부산광역시", "해운대구"),
        (33.5104, 126.4914, "제주특별자치도", "제주시"),
        (37.4843, 130.9057, "경상북도", "울릉군"),
    ],
    ids=["haeundae", "jeju-airport", "ulleungdo"],
)
def test_nearest_region_for_current_location(client, lat, lon, sido_nm, sigungu_nm):
    res = client.get("/regions/nearest", params={"lat": lat, "lon": lon})

    assert res.status_code == 200
    assert res.json() == {"sido_nm": sido_nm, "sigungu_nm": sigungu_nm}


def test_location_far_from_every_region_is_not_found(client):
    res = client.get("/regions/nearest", params={"lat": 35.68, "lon": 139.76})

    assert res.status_code == 404
    assert res.json()["code"] == "REGION_NOT_FOUND"


@pytest.mark.parametrize("params", [{"lat": 91, "lon": 127}, {"lat": 37, "lon": 181}, {"lat": 37}])
def test_invalid_coordinates_are_422(client, params):
    res = client.get("/regions/nearest", params=params)

    assert res.status_code == 422


def test_region_apis_do_not_need_login(client):
    assert client.get("/regions").status_code == 200
    nearest = client.get("/regions/nearest", params={"lat": 35.1587, "lon": 129.1604})
    assert nearest.status_code == 200
