import pytest

from app.repositories import clothing_job as job_repo


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
            _Result(_Row(clothing_job_id=31, clothing_id=21, origin_image_url="clothing/3/a.webp")),
            _Result(),
        ]
    )

    job = await job_repo.claim_next(db, "bg_removal")

    assert job == job_repo.ClaimedJob(31, 21, "clothing/3/a.webp")
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
