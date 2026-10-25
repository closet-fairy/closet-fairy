"""행정구역 설정 파일(config/regions.json) 로드.

시/도 대표 지점 17개와 기상청 단기예보 격자 파일(2024-10-31)의 시/군/구 대표 지점을 담는다.
시/군/구 일치를 먼저 찾고, 없으면 시/도 대표값을 쓴다.
"""

import json
import math
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from app.core.errors import NotFoundError

# app/services/weather/regions.py → parents[3] = backend 폴더
REGIONS_PATH = Path(__file__).resolve().parents[3] / "config" / "regions.json"


class RegionNotFoundError(NotFoundError):
    code = "REGION_NOT_FOUND"
    message = "지원하지 않는 지역입니다."


NEAREST_REGION_MAX_KM = 50
EARTH_RADIUS_KM = 6371.0


@dataclass(frozen=True)
class Region:
    sido_nm: str
    sigungu_nm: str | None
    lat: float
    lon: float
    grid_nx: int
    grid_ny: int
    asos_station_cd: str


@lru_cache
def load_regions() -> tuple[Region, ...]:
    raw = json.loads(REGIONS_PATH.read_text(encoding="utf-8"))
    return tuple(
        Region(
            sido_nm=r["sido_nm"],
            sigungu_nm=r["sigungu_nm"],
            lat=r["lat"],
            lon=r["lon"],
            grid_nx=r["grid_nx"],
            grid_ny=r["grid_ny"],
            asos_station_cd=r["asos_station_cd"],
        )
        for r in raw
    )


def find_region(sido_nm: str, sigungu_nm: str | None = None) -> Region:
    regions = load_regions()
    if sigungu_nm:
        for r in regions:
            if r.sido_nm == sido_nm and r.sigungu_nm == sigungu_nm:
                return r
    for r in regions:
        if r.sido_nm == sido_nm and r.sigungu_nm is None:
            return r
    raise RegionNotFoundError()


def asos_station_codes() -> list[str]:
    """ASOS 배치 대상 지점 코드 (중복 제거, 순서 유지)."""
    return list(dict.fromkeys(r.asos_station_cd for r in load_regions()))


def sigungu_by_sido() -> dict[str, list[str]]:
    grouped: dict[str, list[str]] = {}
    for r in load_regions():
        names = grouped.setdefault(r.sido_nm, [])
        if r.sigungu_nm is not None:
            names.append(r.sigungu_nm)
    return grouped


def find_nearest_region(lat: float, lon: float) -> Region:
    distance, region = min(
        (
            (_distance_km(lat, lon, r.lat, r.lon), r)
            for r in load_regions()
            if r.sigungu_nm is not None
        ),
        key=lambda pair: pair[0],
    )
    if distance > NEAREST_REGION_MAX_KM:
        raise RegionNotFoundError()
    return region


def _distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = phi2 - phi1
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))
