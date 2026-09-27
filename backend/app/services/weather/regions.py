"""행정구역 설정 파일(config/regions.json) 로드.

지금 파일에는 시/도 대표 지점 17개만 있다. 시/군/구 행이 추가되면
시/군/구 일치를 먼저 찾고, 없으면 시/도 대표값을 쓴다.
"""
import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from app.core.errors import NotFoundError

# app/services/weather/regions.py → parents[3] = backend 폴더
REGIONS_PATH = Path(__file__).resolve().parents[3] / "config" / "regions.json"


class RegionNotFoundError(NotFoundError):
    code = "REGION_NOT_FOUND"
    message = "지원하지 않는 지역입니다."


@dataclass(frozen=True)
class Region:
    sido_nm: str
    sigungu_nm: str | None
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
