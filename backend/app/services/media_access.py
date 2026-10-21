"""옷 이미지 접근 권한. 회원이 올린 이미지는 clothing/{member_id}/ 아래에 저장된다."""

from app.core.config import get_settings

DEV_SEED_PREFIXES = ("dev-seed/", "dev-seed-sparse/")
# 에센셜 아이템은 회원 소유가 아니라 전원 공용이다
SHARED_PREFIXES = ("essential/",)


def can_view(member_id: int, key: str) -> bool:
    if key.startswith((f"clothing/{member_id}/", *SHARED_PREFIXES)):
        return True
    return get_settings().DEV_AUTH and key.startswith(DEV_SEED_PREFIXES)
