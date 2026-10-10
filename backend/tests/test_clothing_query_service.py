"""옷장 조회 서비스 테스트. 리포지토리는 가짜로 바꿔 끼운다."""

from datetime import datetime
from decimal import Decimal

import pytest

from app.repositories.clothing import ClothingCardRow, ClothingDetailRow, ClothingEditRow
from app.services import clothing_query as query
from app.services.clothing_query import ClothingNotFoundError, TooManyStatusIdsError

MEMBER_ID = 7
CREATED_AT = datetime(2026, 10, 10, 18, 0)  # UTC


class _Storage:
    def url(self, key: str) -> str:
        return f"/media/{key}"


def _card(clothing_id: int, **overrides) -> ClothingCardRow:
    fields = dict(
        clothing_id=clothing_id,
        processing_status_cd="completed",
        reviewed_at=None,
        origin_image_url=f"clothing/7/{clothing_id}.webp",
        cutout_image_url=None,
        category_cd="top",
        item_name="셔츠",
        created_at=CREATED_AT,
        job_id=clothing_id * 10,
        job_started_at=CREATED_AT,
        job_failure_reason=None,
    )
    return ClothingCardRow(**{**fields, **overrides})


def _detail(clothing_id: int = 5, **overrides) -> ClothingDetailRow:
    card = vars(_card(clothing_id))
    fields = dict(
        accessory_type_cd=None,
        color_cd="white",
        color_text="화이트",
        thickness_cd="thin",
        is_waterproof=False,
    )
    return ClothingDetailRow(**{**card, **fields, **overrides})


@pytest.fixture
def repo(monkeypatch):
    state = {
        "page": [],
        "cards": [],
        "detail": None,
        "tags": ([], []),
        "edit": None,
        "calls": [],
    }

    async def get_clothing_page(db, member_id, cursor, limit):
        state["calls"].append(("page", member_id, cursor, limit))
        return state["page"]

    async def get_clothing_cards(db, member_id, clothing_ids):
        state["calls"].append(("cards", member_id, list(clothing_ids)))
        return state["cards"]

    async def get_clothing_detail(db, member_id, clothing_id):
        state["calls"].append(("detail", member_id, clothing_id))
        return state["detail"]

    async def get_clothing_tags(db, clothing_id):
        return state["tags"]

    async def get_clothing_edit(db, clothing_id):
        return state["edit"]

    for name, fn in [
        ("get_clothing_page", get_clothing_page),
        ("get_clothing_cards", get_clothing_cards),
        ("get_clothing_detail", get_clothing_detail),
        ("get_clothing_tags", get_clothing_tags),
        ("get_clothing_edit", get_clothing_edit),
    ]:
        monkeypatch.setattr(query.clothing_repo, name, fn)
    return state


# ---------- 목록 ----------


async def test_page_asks_one_more_row_to_know_next_cursor(repo):
    repo["page"] = [_card(9), _card(8), _card(7)]

    page = await query.get_clothing_page(None, _Storage(), MEMBER_ID, None, 2)

    assert repo["calls"] == [("page", MEMBER_ID, None, 3)]
    assert [c.clothing_id for c in page.items] == [9, 8]
    assert page.next_cursor == 8


async def test_last_page_has_no_next_cursor(repo):
    repo["page"] = [_card(2), _card(1)]

    page = await query.get_clothing_page(None, _Storage(), MEMBER_ID, 3, 2)

    assert [c.clothing_id for c in page.items] == [2, 1]
    assert page.next_cursor is None


async def test_empty_closet_returns_empty_page(repo):
    page = await query.get_clothing_page(None, _Storage(), MEMBER_ID, None, 20)

    assert page.items == []
    assert page.next_cursor is None


async def test_card_fields(repo):
    repo["page"] = [
        _card(3, cutout_image_url="clothing/7/3_cutout.png", reviewed_at=CREATED_AT),
        _card(2),
    ]

    page = await query.get_clothing_page(None, _Storage(), MEMBER_ID, None, 20)

    cutout, plain = page.items
    assert cutout.image_url == "/media/clothing/7/3_cutout.png"
    assert plain.image_url == "/media/clothing/7/2.webp"
    assert (cutout.is_new, plain.is_new) == (False, True)
    assert plain.created_at.isoformat() == "2026-10-11T03:00:00+09:00"


@pytest.mark.parametrize(
    ("status", "job_id", "started_at", "expected"),
    [
        ("processing", 10, None, True),
        ("processing", 10, CREATED_AT, False),
        ("processing", None, None, False),
        ("completed", 10, None, False),
    ],
)
async def test_is_queued_only_while_latest_job_has_not_started(
    repo, status, job_id, started_at, expected
):
    repo["page"] = [_card(1, processing_status_cd=status, job_id=job_id, job_started_at=started_at)]

    page = await query.get_clothing_page(None, _Storage(), MEMBER_ID, None, 20)

    assert page.items[0].is_queued is expected


@pytest.mark.parametrize(
    ("status", "expected"), [("failed", "배경 제거 실패"), ("processing", None)]
)
async def test_failure_reason_only_when_failed(repo, status, expected):
    repo["page"] = [_card(1, processing_status_cd=status, job_failure_reason="배경 제거 실패")]

    page = await query.get_clothing_page(None, _Storage(), MEMBER_ID, None, 20)

    assert page.items[0].failure_reason == expected


# ---------- 상태 ----------


async def test_status_deduplicates_ids_and_returns_progress_only(repo):
    repo["cards"] = [_card(3, processing_status_cd="processing", job_started_at=None)]

    result = await query.get_clothing_status(None, _Storage(), MEMBER_ID, [3, 9, 3])

    assert repo["calls"] == [("cards", MEMBER_ID, [3, 9])]
    assert [item.model_dump() for item in result.items] == [
        {
            "clothing_id": 3,
            "processing_status_cd": "processing",
            "is_queued": True,
            "image_url": "/media/clothing/7/3.webp",
            "failure_reason": None,
        }
    ]


async def test_status_with_too_many_ids_is_rejected(repo):
    with pytest.raises(TooManyStatusIdsError):
        await query.get_clothing_status(
            None, _Storage(), MEMBER_ID, list(range(1, query.MAX_STATUS_IDS + 2))
        )

    assert repo["calls"] == []


async def test_status_accepts_max_ids(repo):
    await query.get_clothing_status(
        None, _Storage(), MEMBER_ID, list(range(1, query.MAX_STATUS_IDS + 1))
    )

    assert len(repo["calls"][0][2]) == query.MAX_STATUS_IDS


# ---------- 상세 ----------


async def test_missing_or_others_clothing_is_not_found(repo):
    with pytest.raises(ClothingNotFoundError):
        await query.get_clothing_detail(None, _Storage(), MEMBER_ID, 5)

    assert repo["calls"] == [("detail", MEMBER_ID, 5)]


async def test_detail_includes_tags_urls_and_attributes(repo):
    repo["detail"] = _detail(5, cutout_image_url="clothing/7/5_cutout.png")
    repo["tags"] = (["casual", "minimal"], ["spring", "fall"])

    detail = await query.get_clothing_detail(None, _Storage(), MEMBER_ID, 5)

    assert detail.origin_image_url == "/media/clothing/7/5.webp"
    assert detail.cutout_image_url == "/media/clothing/7/5_cutout.png"
    assert detail.image_url == "/media/clothing/7/5_cutout.png"
    assert (detail.color_cd, detail.color_text, detail.thickness_cd) == ("white", "화이트", "thin")
    assert detail.is_waterproof is False
    assert detail.style_cds == ["casual", "minimal"]
    assert detail.season_cds == ["spring", "fall"]
    assert detail.edit is None


async def test_detail_without_cutout_has_null_cutout_url(repo):
    repo["detail"] = _detail(5)

    detail = await query.get_clothing_detail(None, _Storage(), MEMBER_ID, 5)

    assert detail.cutout_image_url is None
    assert detail.image_url == detail.origin_image_url


async def test_detail_edit_params(repo):
    repo["detail"] = _detail(5)
    repo["edit"] = ClothingEditRow(
        rotation_angle=Decimal("-90.00"),
        perspective_param={"points": [[0, 0], [1, 0]]},
        brush_mask_url="clothing/7/5_mask.png",
    )

    detail = await query.get_clothing_detail(None, _Storage(), MEMBER_ID, 5)

    assert detail.edit.model_dump() == {
        "rotation_angle": -90.0,
        "perspective_param": {"points": [[0, 0], [1, 0]]},
        "brush_mask_url": "/media/clothing/7/5_mask.png",
    }
