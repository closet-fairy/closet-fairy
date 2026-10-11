"""자동 태깅 워커 테스트. job 큐(리포지토리)와 태거는 가짜로 바꿔 끼운다."""

import asyncio
from types import SimpleNamespace

import pytest

from app.repositories import clothing_job as job_repo
from app.repositories.clothing_job import ClaimedJob, ClothingTags
from app.services.storage import LocalImageStorage
from app.workers.auto_tagging_worker import AutoTaggingWorker

CUTOUT_KEY = "clothing/7/abc_cutout.webp"
TAGS = ClothingTags(category_cd="top", item_name="흰 티셔츠", color_cd="white")


class _FakeDb:
    def __init__(self, queue):
        self._queue = queue

    async def commit(self):
        self._queue.commits += 1

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


class _FakeTagger:
    def __init__(self, result=TAGS, error=None, delay_s=0.0):
        self.inputs = []
        self._result = result
        self._error = error
        self._delay_s = delay_s

    async def tag(self, cutout):
        self.inputs.append(cutout)
        if self._delay_s:
            await asyncio.sleep(self._delay_s)
        if self._error:
            raise self._error
        return self._result


@pytest.fixture
def queue(monkeypatch):
    q = SimpleNamespace(
        jobs=[], canceled=False, commits=0, finished=[], completed=[], complete_error=None
    )

    async def claim_next(db, stage_cd):
        assert stage_cd == "auto_tagging"
        return q.jobs.pop(0) if q.jobs else None

    async def lock_is_canceled(db, clothing_job_id):
        return q.canceled

    async def finish_job(db, clothing_job_id, failure_reason=None):
        q.finished.append((clothing_job_id, failure_reason))

    async def complete_with_tags(db, clothing_id, tags):
        if q.complete_error:
            raise q.complete_error
        q.completed.append((clothing_id, tags))

    for name, fn in {
        "claim_next": claim_next,
        "lock_is_canceled": lock_is_canceled,
        "finish_job": finish_job,
        "complete_with_tags": complete_with_tags,
    }.items():
        monkeypatch.setattr(job_repo, name, fn)
    return q


@pytest.fixture
def storage(tmp_path):
    cutout = tmp_path / CUTOUT_KEY
    cutout.parent.mkdir(parents=True)
    cutout.write_bytes(b"cutout-webp")
    return LocalImageStorage(tmp_path, "/media")


def _worker(queue, storage, tagger, timeout_s=60.0):
    return AutoTaggingWorker(tagger, storage, lambda: _FakeDb(queue), timeout_s=timeout_s)


def _job(cutout_image_url=CUTOUT_KEY):
    return ClaimedJob(31, 21, "clothing/7/abc.webp", cutout_image_url)


async def test_run_once_returns_false_when_queue_is_empty(queue, storage):
    tagger = _FakeTagger()

    assert await _worker(queue, storage, tagger).run_once() is False
    assert tagger.inputs == []


async def test_success_saves_tags_and_completes(queue, storage):
    queue.jobs.append(_job())
    tagger = _FakeTagger()

    assert await _worker(queue, storage, tagger).run_once() is True

    assert tagger.inputs == [b"cutout-webp"]
    assert queue.completed == [(21, TAGS)]
    assert queue.finished == [(31, None)]


@pytest.mark.parametrize(
    "tagger",
    [
        _FakeTagger(error=RuntimeError("api down")),
        _FakeTagger(delay_s=1.0),
    ],
    ids=["error", "timeout"],
)
async def test_tagging_failure_completes_with_empty_tags(queue, storage, tagger):
    queue.jobs.append(_job())

    await _worker(queue, storage, tagger, timeout_s=0.05).run_once()

    assert queue.completed == [(21, ClothingTags())]
    assert queue.finished == [(31, None)]


async def test_missing_cutout_file_completes_with_empty_tags(queue, storage):
    queue.jobs.append(_job("clothing/7/missing_cutout.webp"))
    tagger = _FakeTagger()

    await _worker(queue, storage, tagger).run_once()

    assert tagger.inputs == []
    assert queue.completed == [(21, ClothingTags())]


async def test_job_without_cutout_completes_with_empty_tags(queue, storage):
    queue.jobs.append(_job(None))

    await _worker(queue, storage, _FakeTagger()).run_once()

    assert queue.completed == [(21, ClothingTags())]


async def test_canceled_job_is_finished_without_saving_tags(queue, storage):
    queue.jobs.append(_job())
    queue.canceled = True

    await _worker(queue, storage, _FakeTagger()).run_once()

    assert queue.completed == []
    assert queue.finished == [(31, None)]


async def test_db_error_while_recording_does_not_escape(queue, storage):
    queue.jobs.append(_job())
    queue.complete_error = ConnectionError("db gone")

    assert await _worker(queue, storage, _FakeTagger()).run_once() is True
    assert queue.finished == []
