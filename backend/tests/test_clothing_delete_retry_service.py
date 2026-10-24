"""옷 삭제·재시도 서비스와 요청 빈도 제한 테스트. 리포지토리는 가짜로 바꿔 끼운다."""

from decimal import Decimal
from types import SimpleNamespace

import pytest

from app.repositories import clothing as clothing_repo
from app.repositories.clothing import ClothingEditRow, ClothingForEdit
from app.schemas.clothing import ClothingProgress, ClothingStatusList
from app.services import clothing_delete, clothing_retry
from app.services.clothing_query import ClothingNotFoundError
from app.services.clothing_rate_limit import RequestRateLimiter, TooManyClothingRequestsError
from app.services.clothing_retry import ClothingNotRetryableError
from app.services.storage import LocalImageStorage

MEMBER_ID = 7
ORIGIN = "clothing/7/a.webp"
CUTOUT = "clothing/7/a_cutout.webp"
MASK = "clothing/7/m_mask.png"


class _Transaction:
    def __init__(self, db):
        self._db = db

    async def __aenter__(self):
        return None

    async def __aexit__(self, exc_type, *exc):
        if exc_type is None:
            self._db.commits += 1
        return False


class _FakeDb:
    def __init__(self):
        self.commits = 0

    def begin(self):
        return _Transaction(self)


def _clothing(**overrides) -> ClothingForEdit:
    fields = dict(
        clothing_id=5,
        processing_status_cd="completed",
        origin_image_url=ORIGIN,
        cutout_image_url=CUTOUT,
        category_cd="top",
        accessory_type_cd=None,
        color_cd=None,
    )
    return ClothingForEdit(**{**fields, **overrides})


@pytest.fixture
def repo(monkeypatch):
    r = SimpleNamespace(
        clothing=_clothing(),
        edit=ClothingEditRow(Decimal(0), None, MASK, None),
        rated_keys=set(),
        locks=[],
        deleted=[],
        retried=[],
        delete_error=None,
    )

    async def get_clothing_for_edit(db, member_id, clothing_id, *, lock=False):
        r.locks.append((member_id, clothing_id, lock))
        return r.clothing

    async def lock_clothing_jobs(db, member_id, clothing_id):
        r.locks.append(("jobs", member_id, clothing_id))

    async def get_clothing_edit(db, clothing_id):
        return r.edit

    async def get_rated_snapshot_keys(db, clothing_id):
        return r.rated_keys

    async def delete_clothing(db, clothing_id):
        if r.delete_error:
            raise r.delete_error
        r.deleted.append(clothing_id)

    async def reset_for_retry(db, clothing_id):
        r.retried.append(clothing_id)

    for name, fn in {
        "get_clothing_for_edit": get_clothing_for_edit,
        "lock_clothing_jobs": lock_clothing_jobs,
        "get_clothing_edit": get_clothing_edit,
        "get_rated_snapshot_keys": get_rated_snapshot_keys,
        "delete_clothing": delete_clothing,
        "reset_for_retry": reset_for_retry,
    }.items():
        monkeypatch.setattr(clothing_repo, name, fn)
    return r


@pytest.fixture
def storage(tmp_path):
    for key in (ORIGIN, CUTOUT, MASK):
        path = tmp_path / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"image")
    return LocalImageStorage(tmp_path, "/media")


def _exists(tmp_path, key):
    return (tmp_path / key).exists()


async def test_delete_removes_row_and_all_images(repo, storage, tmp_path):
    db = _FakeDb()

    await clothing_delete.delete_clothing(db, storage, MEMBER_ID, 5)

    assert repo.deleted == [5] and db.commits == 1
    assert repo.locks == [("jobs", MEMBER_ID, 5), (MEMBER_ID, 5, True)]
    assert not any(_exists(tmp_path, key) for key in (ORIGIN, CUTOUT, MASK))


async def test_delete_keeps_images_used_by_rated_outfits(repo, storage, tmp_path):
    repo.rated_keys = {CUTOUT}

    await clothing_delete.delete_clothing(_FakeDb(), storage, MEMBER_ID, 5)

    assert _exists(tmp_path, CUTOUT)
    assert not _exists(tmp_path, ORIGIN) and not _exists(tmp_path, MASK)


@pytest.mark.parametrize("status", ["processing", "failed"])
async def test_unfinished_clothing_can_be_deleted(repo, storage, tmp_path, status):
    repo.clothing = _clothing(processing_status_cd=status, cutout_image_url=None)
    repo.edit = None

    await clothing_delete.delete_clothing(_FakeDb(), storage, MEMBER_ID, 5)

    assert repo.deleted == [5]
    assert not _exists(tmp_path, ORIGIN)
    assert _exists(tmp_path, CUTOUT) and _exists(tmp_path, MASK)


async def test_delete_missing_clothing_is_not_found(repo, storage):
    repo.clothing = None

    with pytest.raises(ClothingNotFoundError):
        await clothing_delete.delete_clothing(_FakeDb(), storage, MEMBER_ID, 5)

    assert repo.deleted == []


async def test_images_stay_when_db_delete_fails(repo, storage, tmp_path):
    repo.delete_error = ConnectionError("db gone")
    db = _FakeDb()

    with pytest.raises(ConnectionError):
        await clothing_delete.delete_clothing(db, storage, MEMBER_ID, 5)

    assert db.commits == 0
    assert all(_exists(tmp_path, key) for key in (ORIGIN, CUTOUT, MASK))


async def test_image_cleanup_failure_does_not_fail_delete(repo, storage, monkeypatch):
    async def broken_delete(key):
        raise OSError("disk")

    monkeypatch.setattr(storage, "delete", broken_delete)

    await clothing_delete.delete_clothing(_FakeDb(), storage, MEMBER_ID, 5)

    assert repo.deleted == [5]


class _Worker:
    def __init__(self):
        self.notified = 0

    def notify(self):
        self.notified += 1


@pytest.fixture
def status_query(monkeypatch):
    calls = []

    async def get_clothing_status(db, storage, member_id, clothing_ids):
        calls.append((member_id, clothing_ids))
        return ClothingStatusList(
            items=[
                ClothingProgress(
                    clothing_id=clothing_ids[0],
                    processing_status_cd="processing",
                    is_queued=True,
                    image_url="/media/clothing/7/a.webp",
                    failure_reason=None,
                )
            ]
        )

    monkeypatch.setattr(clothing_retry, "get_clothing_status", get_clothing_status)
    return calls


async def test_retry_requeues_failed_clothing_and_wakes_worker(repo, status_query):
    repo.clothing = _clothing(processing_status_cd="failed")
    worker = _Worker()
    db = _FakeDb()

    progress = await clothing_retry.retry_clothing(db, None, MEMBER_ID, 5, worker)

    assert repo.retried == [5] and db.commits == 1
    assert repo.locks == [("jobs", MEMBER_ID, 5), (MEMBER_ID, 5, True)]
    assert worker.notified == 1
    assert progress.processing_status_cd == "processing" and progress.is_queued
    assert status_query == [(MEMBER_ID, [5])]


async def test_retry_without_worker_still_requeues(repo, status_query):
    repo.clothing = _clothing(processing_status_cd="failed")

    await clothing_retry.retry_clothing(_FakeDb(), None, MEMBER_ID, 5)

    assert repo.retried == [5]


@pytest.mark.parametrize("status", ["processing", "completed"])
async def test_only_failed_clothing_can_be_retried(repo, status_query, status):
    repo.clothing = _clothing(processing_status_cd=status)
    worker = _Worker()
    db = _FakeDb()

    with pytest.raises(ClothingNotRetryableError):
        await clothing_retry.retry_clothing(db, None, MEMBER_ID, 5, worker)

    assert repo.retried == [] and worker.notified == 0 and db.commits == 0


async def test_retry_missing_clothing_is_not_found(repo, status_query):
    repo.clothing = None

    with pytest.raises(ClothingNotFoundError):
        await clothing_retry.retry_clothing(_FakeDb(), None, MEMBER_ID, 5)


async def test_retry_of_clothing_deleted_right_after_commit_is_not_found(repo, monkeypatch):
    repo.clothing = _clothing(processing_status_cd="failed")

    async def deleted_meanwhile(db, storage, member_id, clothing_ids):
        return ClothingStatusList(items=[])

    monkeypatch.setattr(clothing_retry, "get_clothing_status", deleted_meanwhile)

    with pytest.raises(ClothingNotFoundError):
        await clothing_retry.retry_clothing(_FakeDb(), None, MEMBER_ID, 5)


class _Clock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


def test_rate_limiter_rejects_after_limit_within_window():
    clock = _Clock()
    limiter = RequestRateLimiter(2, window_s=60, clock=clock)

    limiter.check(1)
    limiter.check(1)
    with pytest.raises(TooManyClothingRequestsError):
        limiter.check(1)


def test_rate_limiter_allows_again_after_window():
    clock = _Clock()
    limiter = RequestRateLimiter(2, window_s=60, clock=clock)
    limiter.check(1)
    clock.now += 30
    limiter.check(1)

    clock.now += 30
    limiter.check(1)
    with pytest.raises(TooManyClothingRequestsError):
        limiter.check(1)


def test_rate_limiter_counts_each_member_separately():
    limiter = RequestRateLimiter(1, clock=_Clock())

    limiter.check(1)
    limiter.check(2)
    with pytest.raises(TooManyClothingRequestsError):
        limiter.check(1)


def test_rate_limiter_forgets_members_who_stopped_requesting():
    clock = _Clock()
    limiter = RequestRateLimiter(1, window_s=60, clock=clock)
    limiter.check(1)
    clock.now += 30
    limiter.check(2)

    clock.now += 30
    limiter.check(3)

    assert set(limiter._requests) == {2, 3}
    with pytest.raises(TooManyClothingRequestsError):
        limiter.check(2)


def test_rejected_request_does_not_extend_the_wait():
    clock = _Clock()
    limiter = RequestRateLimiter(1, window_s=60, clock=clock)
    limiter.check(1)
    clock.now += 59
    with pytest.raises(TooManyClothingRequestsError):
        limiter.check(1)

    clock.now += 1
    limiter.check(1)


async def test_delete_removes_display_image_unless_rated_outfit_uses_it(repo, storage, tmp_path):
    display = "clothing/7/a_display.webp"
    (tmp_path / display).write_bytes(b"image")
    repo.edit = ClothingEditRow(Decimal(0), None, MASK, display)

    await clothing_delete.delete_clothing(_FakeDb(), storage, MEMBER_ID, 5)

    assert not _exists(tmp_path, display)


async def test_delete_keeps_display_image_of_rated_outfit(repo, storage, tmp_path):
    display = "clothing/7/a_display.webp"
    (tmp_path / display).write_bytes(b"image")
    repo.edit = ClothingEditRow(Decimal(0), None, MASK, display)
    repo.rated_keys = {display}

    await clothing_delete.delete_clothing(_FakeDb(), storage, MEMBER_ID, 5)

    assert _exists(tmp_path, display)
    assert not _exists(tmp_path, CUTOUT)
