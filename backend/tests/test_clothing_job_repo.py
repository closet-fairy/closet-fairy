import pytest

from app.repositories import clothing_job as job_repo
from app.repositories import clothing_tag as tag_repo


class _Row:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


class _Result:
    def __init__(self, row=None, scalar=None, rowcount=0):
        self._row = row
        self._scalar = scalar
        self.rowcount = rowcount

    def first(self):
        return self._row

    def scalar_one_or_none(self):
        return self._scalar


class _FakeDb:
    def __init__(self, results):
        self._results = results
        self.statements = []

    async def execute(self, stmt, params):
        self.statements.append((stmt, params))
        return self._results[len(self.statements) - 1]


async def test_claim_next_marks_started_and_returns_job():
    db = _FakeDb(
        [
            _Result(
                _Row(
                    clothing_job_id=31,
                    clothing_id=21,
                    origin_image_url="clothing/3/a.webp",
                    cutout_image_url="clothing/3/a_cutout.webp",
                )
            ),
            _Result(),
        ]
    )

    job = await job_repo.claim_next(db, "auto_tagging")

    assert job == job_repo.ClaimedJob(31, 21, "clothing/3/a.webp", "clothing/3/a_cutout.webp")
    assert db.statements[0] == (job_repo.SELECT_NEXT_JOB_SQL, {"stage_cd": "auto_tagging"})
    assert db.statements[1] == (job_repo.MARK_STARTED_SQL, {"clothing_job_id": 31})


async def test_claim_next_returns_none_without_marking_when_queue_empty():
    db = _FakeDb([_Result()])

    assert await job_repo.claim_next(db, "bg_removal") is None
    assert len(db.statements) == 1


@pytest.mark.parametrize(("value", "expected"), [(0, False), (1, True), (None, True)])
async def test_lock_is_canceled_treats_deleted_job_as_canceled(value, expected):
    db = _FakeDb([_Result(scalar=value)])

    assert await job_repo.lock_is_canceled(db, 31) is expected


async def test_requeue_interrupted_returns_affected_rows():
    db = _FakeDb([_Result(rowcount=2)])

    assert await job_repo.requeue_interrupted(db, "bg_removal") == 2


async def test_save_cutout_keeps_clothing_processing():
    db = _FakeDb([_Result()])

    await job_repo.save_cutout(db, 21, "clothing/3/a_cutout.webp")

    stmt, params = db.statements[0]
    assert "processing_status_cd" not in str(stmt)
    assert params == {"clothing_id": 21, "cutout_image_url": "clothing/3/a_cutout.webp"}


async def test_enqueue_job_inserts_waiting_job():
    db = _FakeDb([_Result()])

    await job_repo.enqueue_job(db, 21, "auto_tagging")

    assert db.statements == [
        (job_repo.ENQUEUE_JOB_SQL, {"clothing_id": 21, "stage_cd": "auto_tagging"})
    ]


async def test_complete_with_tags_replaces_styles_and_seasons():
    db = _FakeDb([_Result() for _ in range(7)])
    tags = job_repo.ClothingTags(
        category_cd="outer",
        item_name="네이비 울 코트",
        color_cd="navy",
        color_text="네이비",
        style_cds=("classic", "minimal"),
        season_cds=("fall", "winter"),
        thickness_cd="thick",
        is_waterproof=False,
    )

    await job_repo.complete_with_tags(db, 21, tags)

    stmt, params = db.statements[0]
    assert stmt is job_repo.COMPLETE_WITH_TAGS_SQL
    assert params == {
        "clothing_id": 21,
        "category_cd": "outer",
        "accessory_type_cd": None,
        "item_name": "네이비 울 코트",
        "color_cd": "navy",
        "color_text": "네이비",
        "thickness_cd": "thick",
        "is_waterproof": False,
    }
    assert db.statements[1:] == [
        (tag_repo.DELETE_STYLES_SQL, {"clothing_id": 21}),
        (tag_repo.INSERT_STYLE_SQL, {"clothing_id": 21, "style_cd": "classic"}),
        (tag_repo.INSERT_STYLE_SQL, {"clothing_id": 21, "style_cd": "minimal"}),
        (tag_repo.DELETE_SEASONS_SQL, {"clothing_id": 21}),
        (tag_repo.INSERT_SEASON_SQL, {"clothing_id": 21, "season_cd": "fall"}),
        (tag_repo.INSERT_SEASON_SQL, {"clothing_id": 21, "season_cd": "winter"}),
    ]


async def test_complete_with_empty_tags_still_completes():
    db = _FakeDb([_Result() for _ in range(3)])

    await job_repo.complete_with_tags(db, 21, job_repo.ClothingTags())

    assert db.statements[0][0] is job_repo.COMPLETE_WITH_TAGS_SQL
    assert len(db.statements) == 3


@pytest.mark.parametrize(
    ("tags", "expected"),
    [
        (job_repo.ClothingTags(), True),
        (job_repo.ClothingTags(style_cds=[], season_cds=[]), True),
        (job_repo.ClothingTags(is_waterproof=False), False),
        (job_repo.ClothingTags(season_cds=("winter",)), False),
    ],
)
def test_clothing_tags_is_empty(tags, expected):
    assert tags.is_empty is expected
