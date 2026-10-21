"""개인 설정과 온보딩 (FR-ONBOARD-05, FR-ONBOARD-09-1, FR-PREF-06, FR-PREF-09, NFR-ONBOARD-01)."""

import logging
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import ValidationError
from app.repositories import member_setting as setting_repo
from app.repositories import preference_score as score_repo
from app.repositories.member_setting import MemberSettingDetail
from app.schemas.member import MemberSettings, MemberSettingsUpdate
from app.services.auth.session import AuthRequiredError

logger = logging.getLogger(__name__)

MIN_AGE = 14
DEFAULT_GENDER_CD = "unisex"


class UnderAgeError(ValidationError):
    message = f"만 {MIN_AGE}세 이상만 이용할 수 있습니다."


async def get_member_settings(db: AsyncSession, member_id: int) -> MemberSettings:
    async with db.begin():
        setting = await _find_setting(db, member_id)
        style_cds = await setting_repo.get_preferred_styles(db, setting.member_setting_id)
    return _to_response(setting, style_cds)


async def save_member_settings(
    db: AsyncSession, member_id: int, update: MemberSettingsUpdate, now: datetime
) -> MemberSettings:
    if now.year - update.birth_year <= MIN_AGE:
        raise UnderAgeError()
    style_cds = list(dict.fromkeys(update.style_cds))

    async with db.begin():
        setting = await _find_setting(db, member_id)
        await setting_repo.update_setting(
            db,
            setting.member_setting_id,
            update.birth_year,
            update.temperature_sensitivity_cd,
            update.gender_cd or DEFAULT_GENDER_CD,
        )
        await setting_repo.replace_styles(db, setting.member_setting_id, style_cds)
        if style_cds and await setting_repo.claim_style_bonus(db, setting.member_setting_id):
            settings = get_settings()
            scores = await score_repo.lock_member_scores(db, member_id)
            missing = set(style_cds) - {
                r.attribute_value for r in scores if r.attribute_type_cd == "style"
            }
            if missing:
                logger.warning(
                    "선호 점수 행이 없는 스타일은 초기 보너스에서 빠짐",
                    extra={"member_id": member_id, "missing_styles": sorted(missing)},
                )
            await score_repo.add_style_bonus(
                db,
                member_id,
                style_cds,
                settings.INITIAL_STYLE_BONUS_SCORE,
                settings.PREFERENCE_SCORE_MAX,
            )
        saved = await _find_setting(db, member_id)
        saved_style_cds = await setting_repo.get_preferred_styles(db, saved.member_setting_id)
    return _to_response(saved, saved_style_cds)


async def _find_setting(db: AsyncSession, member_id: int) -> MemberSettingDetail:
    setting = await setting_repo.find_setting_detail(db, member_id)
    if setting is None:
        raise AuthRequiredError()
    return setting


def _to_response(setting: MemberSettingDetail, style_cds: list[str]) -> MemberSettings:
    return MemberSettings(
        birth_year=setting.birth_year,
        temperature_sensitivity_cd=setting.temperature_sensitivity_cd,
        gender_cd=setting.gender_cd,
        style_cds=style_cds,
        is_onboarded=setting.is_onboarded,
    )
