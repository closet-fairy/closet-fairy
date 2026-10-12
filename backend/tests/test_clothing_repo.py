from decimal import Decimal

import pytest

from app.repositories import clothing as clothing_repo


class _Row:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


class _Result:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class _FakeDb:
    def __init__(self, results):
        self._results = results
        self._calls = 0

    async def execute(self, stmt, params):
        result = self._results[self._calls]
        self._calls += 1
        return result


async def test_get_completed_clothing_merges_tags_by_clothing_id():
    clothing_rows = [
        _Row(
            clothing_id=1,
            category_cd="top",
            accessory_type_cd=None,
            item_name="니트",
            color_cd="beige",
            thickness_cd="medium",
            is_waterproof=0,
            origin_image_url="http://a/1.png",
            cutout_image_url=None,
        ),
        _Row(
            clothing_id=2,
            category_cd="bottom",
            accessory_type_cd=None,
            item_name="슬랙스",
            color_cd="black",
            thickness_cd="thin",
            is_waterproof=None,
            origin_image_url="http://a/2.png",
            cutout_image_url="http://a/2_cutout.png",
        ),
    ]
    style_rows = [
        _Row(clothing_id=1, style_cd="casual"),
        _Row(clothing_id=1, style_cd="minimal"),
        _Row(clothing_id=2, style_cd="street"),
    ]
    season_rows = [
        _Row(clothing_id=1, season_cd="fall"),
        _Row(clothing_id=1, season_cd="spring"),
        _Row(clothing_id=2, season_cd="summer"),
    ]

    db = _FakeDb([_Result(clothing_rows), _Result(style_rows), _Result(season_rows)])

    candidates = await clothing_repo.get_completed_clothing(db, member_id=1)

    by_id = {c.clothing_id: c for c in candidates}
    assert by_id[1].styles == ["casual", "minimal"]
    assert by_id[1].seasons == ["fall", "spring"]
    assert by_id[1].is_waterproof is False
    assert by_id[2].styles == ["street"]
    assert by_id[2].seasons == ["summer"]
    assert by_id[2].is_waterproof is None


def test_completed_clothing_without_category_is_not_a_candidate():
    sql = " ".join(str(clothing_repo.CLOTHING_SQL).split())

    assert "AND category_cd IS NOT NULL" in sql


class _RecordingDb:
    def __init__(self, rows):
        self._rows = rows
        self.params = None

    async def execute(self, stmt, params):
        self.params = params
        return _Result(self._rows)


async def test_count_completed_by_category_fills_missing_with_zero():
    db = _RecordingDb([])

    counts = await clothing_repo.count_completed_by_category(
        db, member_id=7, category_cds=("top", "bottom", "shoes")
    )

    assert counts == {"top": 0, "bottom": 0, "shoes": 0}
    assert db.params == {"member_id": 7, "category_cds": ["top", "bottom", "shoes"]}


async def test_count_completed_by_category_merges_rows():
    db = _RecordingDb([_Row(category_cd="top", cnt=3), _Row(category_cd="shoes", cnt=1)])

    counts = await clothing_repo.count_completed_by_category(
        db, member_id=7, category_cds=("top", "bottom", "shoes")
    )

    assert counts == {"top": 3, "bottom": 0, "shoes": 1}


async def test_get_clothing_snapshots_filters_by_member_and_ids():
    row = _Row(
        clothing_id=11,
        item_name=None,
        color_nm="화이트",
        origin_image_url="http://a/11.png",
        cutout_image_url=None,
    )
    db = _RecordingDb([row])

    snapshots = await clothing_repo.get_clothing_snapshots(db, member_id=7, clothing_ids=[11, 12])

    assert db.params == {"member_id": 7, "clothing_ids": [11, 12]}
    assert list(snapshots) == [11]
    assert snapshots[11].item_name is None
    assert snapshots[11].color_nm == "화이트"


async def test_get_clothing_snapshots_skips_query_for_empty_ids():
    db = _RecordingDb([])

    assert await clothing_repo.get_clothing_snapshots(db, member_id=7, clothing_ids=[]) == {}
    assert db.params is None


class _InsertResult:
    def __init__(self, lastrowid):
        self.lastrowid = lastrowid


class _InsertDb:
    def __init__(self):
        self.executed = []
        self.committed = False

    async def execute(self, stmt, params):
        self.executed.append((str(stmt), params))
        return _InsertResult(55)

    async def commit(self):
        self.committed = True


async def test_insert_uploaded_clothing_creates_clothing_and_bg_removal_job():
    db = _InsertDb()

    clothing_id = await clothing_repo.insert_uploaded_clothing(db, 7, "clothing/7/a.webp")

    assert clothing_id == 55
    (clothing_sql, clothing_params), (job_sql, job_params) = db.executed
    assert "INSERT INTO clothing (" in clothing_sql and "'processing'" in clothing_sql
    assert clothing_params == {"member_id": 7, "origin_image_url": "clothing/7/a.webp"}
    assert "INSERT INTO clothing_job" in job_sql
    assert job_params == {"clothing_id": 55, "stage_cd": "bg_removal"}
    assert not db.committed


class _QueryResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows

    def first(self):
        return self._rows[0] if self._rows else None


class _QueryDb:
    def __init__(self, *results):
        self._results = list(results)
        self.executed = []

    async def execute(self, stmt, params):
        self.executed.append((str(stmt), params))
        return _QueryResult(self._results.pop(0))


def _card_row(clothing_id, **overrides):
    fields = dict(
        clothing_id=clothing_id,
        processing_status_cd="processing",
        reviewed_at=None,
        origin_image_url=f"clothing/7/{clothing_id}.webp",
        cutout_image_url=None,
        category_cd=None,
        item_name=None,
        created_at="2026-10-10 18:00:00",
        job_id=clothing_id * 10,
        job_started_at=None,
        job_failure_reason=None,
    )
    return _Row(**{**fields, **overrides})


async def test_get_clothing_page_filters_member_and_cursor():
    db = _QueryDb([_card_row(9), _card_row(8)])

    rows = await clothing_repo.get_clothing_page(db, 7, 10, 3)

    sql, params = db.executed[0]
    assert params == {"member_id": 7, "cursor": 10, "limit": 3}
    assert "c.clothing_id < :cursor" in sql and "ORDER BY c.clothing_id DESC" in sql
    assert "MAX(lj.clothing_job_id)" in sql
    assert [(r.clothing_id, r.job_id) for r in rows] == [(9, 90), (8, 80)]


async def test_get_clothing_cards_skips_query_for_empty_ids():
    db = _QueryDb()

    assert await clothing_repo.get_clothing_cards(db, 7, []) == []
    assert db.executed == []


async def test_get_clothing_cards_filters_member_and_ids():
    db = _QueryDb([_card_row(3)])

    rows = await clothing_repo.get_clothing_cards(db, 7, [3, 4])

    assert db.executed[0][1] == {"member_id": 7, "clothing_ids": [3, 4]}
    assert [r.clothing_id for r in rows] == [3]


async def test_get_clothing_detail_maps_attributes():
    db = _QueryDb(
        [
            _card_row(
                5,
                accessory_type_cd=None,
                color_cd="white",
                color_text="화이트",
                thickness_cd="thin",
                is_waterproof=0,
            )
        ]
    )

    row = await clothing_repo.get_clothing_detail(db, 7, 5)

    assert db.executed[0][1] == {"member_id": 7, "clothing_id": 5}
    assert (row.clothing_id, row.color_cd, row.color_text) == (5, "white", "화이트")
    assert row.is_waterproof is False


async def test_get_clothing_detail_returns_none_when_missing():
    assert await clothing_repo.get_clothing_detail(_QueryDb([]), 7, 5) is None


async def test_get_clothing_tags_splits_and_orders_seasons():
    db = _QueryDb(
        [
            _Row(tag_type="season", tag_cd="winter"),
            _Row(tag_type="style", tag_cd="minimal"),
            _Row(tag_type="season", tag_cd="spring"),
            _Row(tag_type="style", tag_cd="casual"),
            _Row(tag_type="season", tag_cd="fall"),
        ]
    )

    styles, seasons = await clothing_repo.get_clothing_tags(db, 5)

    assert styles == ["casual", "minimal"]
    assert seasons == ["spring", "fall", "winter"]


async def test_get_clothing_edit_parses_json_text():
    db = _QueryDb([_Row(rotation_angle=90, perspective_param='{"k": [1, 2]}', brush_mask_url=None)])

    edit = await clothing_repo.get_clothing_edit(db, 5)

    assert edit.perspective_param == {"k": [1, 2]}


async def test_get_clothing_edit_returns_none_without_edit():
    assert await clothing_repo.get_clothing_edit(_QueryDb([]), 5) is None


async def test_update_clothing_attributes_sets_only_given_columns():
    db = _InsertDb()

    await clothing_repo.update_clothing_attributes(db, 5, {"item_name": "셔츠", "color_cd": None})

    [(sql, params)] = db.executed
    assert " ".join(sql.split()) == (
        "UPDATE clothing SET item_name = :item_name, color_cd = :color_cd "
        "WHERE clothing_id = :clothing_id"
    )
    assert params == {"item_name": "셔츠", "color_cd": None, "clothing_id": 5}


async def test_update_clothing_attributes_skips_empty_and_rejects_unknown_columns():
    db = _InsertDb()

    await clothing_repo.update_clothing_attributes(db, 5, {})
    with pytest.raises(ValueError):
        await clothing_repo.update_clothing_attributes(db, 5, {"member_id": 1})

    assert db.executed == []


async def test_mark_reviewed_keeps_first_review_time():
    db = _InsertDb()

    await clothing_repo.mark_reviewed(db, 5)

    [(sql, params)] = db.executed
    assert "reviewed_at IS NULL" in sql
    assert params == {"clothing_id": 5}


async def test_get_clothing_for_edit_locks_only_when_asked():
    db = _QueryDb([], [])

    assert await clothing_repo.get_clothing_for_edit(db, 7, 5) is None
    await clothing_repo.get_clothing_for_edit(db, 7, 5, lock=True)

    (plain_sql, params), (lock_sql, _) = db.executed
    assert "FOR UPDATE" not in plain_sql and "FOR UPDATE" in lock_sql
    assert params == {"member_id": 7, "clothing_id": 5}


async def test_upsert_edit_transform_stores_perspective_as_json_text():
    db = _InsertDb()

    await clothing_repo.upsert_edit_transform(db, 5, Decimal("12.5"), {"corners": ((0, 0),)})
    await clothing_repo.upsert_edit_transform(db, 5, Decimal(0), None)

    assert [params for _, params in db.executed] == [
        {
            "clothing_id": 5,
            "rotation_angle": Decimal("12.5"),
            "perspective_param": '{"corners": [[0, 0]]}',
        },
        {"clothing_id": 5, "rotation_angle": Decimal(0), "perspective_param": None},
    ]
    assert "brush_mask_url" not in db.executed[0][0]


async def test_upsert_edit_mask_relies_on_default_rotation():
    db = _InsertDb()

    await clothing_repo.upsert_edit_mask(db, 5, "clothing/7/m_mask.png")

    [(sql, params)] = db.executed
    assert "INSERT INTO clothing_edit (clothing_id, brush_mask_url)" in sql
    assert "ON DUPLICATE KEY UPDATE brush_mask_url = new.brush_mask_url" in " ".join(sql.split())
    assert "rotation_angle" not in sql
    assert params == {"clothing_id": 5, "brush_mask_url": "clothing/7/m_mask.png"}


async def test_delete_clothing_edit_removes_row():
    db = _InsertDb()

    await clothing_repo.delete_clothing_edit(db, 5)

    assert db.executed == [
        ("DELETE FROM clothing_edit WHERE clothing_id = :clothing_id", {"clothing_id": 5})
    ]


async def test_rated_snapshot_keys_come_only_from_rated_outfits():
    db = _QueryDb([_Row(image_url_snapshot="clothing/7/a_cutout.webp")])

    keys = await clothing_repo.get_rated_snapshot_keys(db, 5)

    assert keys == {"clothing/7/a_cutout.webp"}
    [(sql, params)] = db.executed
    assert "feedback_type_cd = 'rated'" in sql
    assert params == {"clothing_id": 5}


async def test_reset_for_retry_reopens_clothing_and_queues_bg_removal():
    db = _InsertDb()

    await clothing_repo.reset_for_retry(db, 5)

    (reset_sql, reset_params), (job_sql, job_params) = db.executed
    assert "processing_status_cd = 'processing'" in reset_sql
    assert "cutout_image_url = NULL" in reset_sql
    assert reset_params == {"clothing_id": 5}
    assert "INSERT INTO clothing_job" in job_sql
    assert job_params == {"clothing_id": 5, "stage_cd": "bg_removal"}


async def test_delete_clothing_removes_row():
    db = _InsertDb()

    await clothing_repo.delete_clothing(db, 5)

    assert db.executed == [
        ("DELETE FROM clothing WHERE clothing_id = :clothing_id", {"clothing_id": 5})
    ]
