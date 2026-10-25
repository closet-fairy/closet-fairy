from fastapi import APIRouter, Query

from app.schemas.error import ErrorResponse
from app.schemas.region import RegionName, SidoRegions
from app.services.weather import regions as region_service

router = APIRouter(prefix="/regions", tags=["region"])


@router.get("", response_model=list[SidoRegions])
def list_regions() -> list[SidoRegions]:
    """위치 직접 선택용 시/도·시/군/구 목록. 행정구역 코드 순이다."""
    return [
        SidoRegions(sido_nm=sido_nm, sigungu_nms=sigungu_nms)
        for sido_nm, sigungu_nms in region_service.sigungu_by_sido().items()
    ]


@router.get(
    "/nearest",
    response_model=RegionName,
    responses={404: {"model": ErrorResponse, "description": "50km 안에 지역이 없음"}},
)
def find_nearest_region(
    lat: float = Query(ge=-90, le=90, examples=[37.5665]),
    lon: float = Query(ge=-180, le=180, examples=[126.978]),
) -> RegionName:
    """현재 위치 좌표에서 가장 가까운 시/군/구 (FR-REC-02). 좌표는 저장하지 않는다."""
    region = region_service.find_nearest_region(lat, lon)
    return RegionName(sido_nm=region.sido_nm, sigungu_nm=region.sigungu_nm)
