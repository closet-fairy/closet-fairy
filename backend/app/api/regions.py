from fastapi import APIRouter, Response

from app.schemas.error import ErrorResponse
from app.schemas.region import Coordinates, RegionName, SidoRegions
from app.services.weather import regions as region_service

router = APIRouter(prefix="/regions", tags=["region"])

CACHE_CONTROL = "public, max-age=3600"


@router.get("", response_model=list[SidoRegions])
def list_regions(response: Response) -> list[SidoRegions]:
    """위치 직접 선택용 시/도·시/군/구 목록. 시/군/구는 행정구역 코드 순이다."""
    response.headers["Cache-Control"] = CACHE_CONTROL
    return [
        SidoRegions(sido_nm=sido_nm, sigungu_nms=sigungu_nms)
        for sido_nm, sigungu_nms in region_service.sigungu_by_sido().items()
    ]


@router.post(
    "/nearest",
    response_model=RegionName,
    responses={404: {"model": ErrorResponse, "description": "100km 안에 지역이 없음"}},
)
def find_nearest_region(coordinates: Coordinates) -> RegionName:
    """현재 위치 좌표에서 가장 가까운 시/군/구 (FR-REC-02).

    좌표가 접근 로그에 남지 않도록 본문으로 받는다. 좌표는 저장하지 않는다.
    """
    region = region_service.find_nearest_region(coordinates.lat, coordinates.lon)
    return RegionName(sido_nm=region.sido_nm, sigungu_nm=region.sigungu_nm)
