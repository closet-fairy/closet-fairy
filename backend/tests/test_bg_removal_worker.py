"""배경 제거 워커 테스트. job 큐(리포지토리)와 모델은 가짜로 바꿔 끼운다."""

import threading
from types import SimpleNamespace

import pytest

from app.repositories import clothing_job as job_repo
from app.repositories.clothing_job import ClaimedJob
from app.services.storage import LocalImageStorage
from app.workers import bg_removal_worker
from app.workers.bg_removal_worker import FAILURE_REASON, BgRemovalWorker, cutout_key_for

ORIGIN_KEY = "clothing/7/abc.webp"
CUTOUT_KEY = "clothing/7/abc_cutout.png"


class _FakeDb:
    def __init__(self, queue):
        self._queue = queue

    async def commit(self):
        self._queue.commits += 1

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


class _FakeRemover:
    def __init__(self, error=None):
        self.inputs = []
        self.thread_names = []
        self._error = error

    def remove(self, image):
        self.inputs.append(image)
        self.thread_names.append(threading.current_thread().name)
        if self._error:
            raise self._error
        return b"cutout-png"


@pytest.fixture
def queue(monkeypatch):
    q = SimpleNamespace(
        jobs=[],
        canceled=False,
        requeued=0,
        commits=0,
        finished=[],
        completed=[],
        failed=[],
        complete_error=None,
        fail_error=None,
    )

    async def requeue_interrupted(db, stage_cd):
        return q.requeued

    async def claim_next(db, stage_cd):
        return q.jobs.pop(0) if q.jobs else None

    async def lock_is_canceled(db, clothing_job_id):
        return q.canceled

    async def finish_job(db, clothing_job_id, failure_reason=None):
        q.finished.append((clothing_job_id, failure_reason))

    async def complete_clothing(db, clothing_id, cutout_image_url):
        if q.complete_error:
            raise q.complete_error
        q.completed.append((clothing_id, cutout_image_url))

    async def fail_clothing(db, clothing_id):
        if q.fail_error:
            raise q.fail_error
        q.failed.append(clothing_id)

    for name, fn in {
        "requeue_interrupted": requeue_interrupted,
        "claim_next": claim_next,
        "lock_is_canceled": lock_is_canceled,
        "finish_job": finish_job,
        "complete_clothing": complete_clothing,
        "fail_clothing": fail_clothing,
    }.items():
        monkeypatch.setattr(job_repo, name, fn)
    return q


@pytest.fixture
def storage(tmp_path):
    origin = tmp_path / ORIGIN_KEY
    origin.parent.mkdir(parents=True)
    origin.write_bytes(b"origin-webp")
    return LocalImageStorage(tmp_path, "/media")


def _worker(queue, storage, remover):
    return BgRemovalWorker(remover, storage, lambda: _FakeDb(queue))


def _job():
    return ClaimedJob(clothing_job_id=31, clothing_id=21, origin_image_url=ORIGIN_KEY)


async def test_run_once_returns_false_when_queue_is_empty(queue, storage):
    remover = _FakeRemover()

    assert await _worker(queue, storage, remover).run_once() is False
    assert remover.inputs == []


@pytest.mark.parametrize(
    ("origin", "cutout"),
    [
        ("clothing/7/abc.webp", "clothing/7/abc_cutout.png"),
        ("dev-seed/01.png", "dev-seed/01_cutout.png"),
    ],
)
def test_cutout_key_sits_next_to_origin_key(origin, cutout):
    assert cutout_key_for(origin) == cutout


async def test_success_saves_cutout_next_to_origin_and_completes(queue, storage, tmp_path):
    queue.jobs.append(_job())
    remover = _FakeRemover()

    assert await _worker(queue, storage, remover).run_once() is True

    assert remover.inputs == [b"origin-webp"]
    assert (tmp_path / CUTOUT_KEY).read_bytes() == b"cutout-png"
    assert queue.completed == [(21, CUTOUT_KEY)]
    assert queue.finished == [(31, None)]
    assert queue.failed == []


async def test_inference_runs_off_the_event_loop_thread(queue, storage):
    queue.jobs.append(_job())
    remover = _FakeRemover()

    await _worker(queue, storage, remover).run_once()

    assert remover.thread_names[0].startswith("bg-removal")
    assert remover.thread_names[0] != threading.current_thread().name


async def test_failure_marks_job_and_clothing_failed_with_fixed_reason(queue, storage):
    queue.jobs.append(_job())

    await _worker(queue, storage, _FakeRemover(RuntimeError("onnx exploded"))).run_once()

    assert queue.finished == [(31, FAILURE_REASON)]
    assert queue.failed == [21]
    assert queue.completed == []


async def test_canceled_job_discards_cutout(queue, storage, tmp_path):
    queue.jobs.append(_job())
    queue.canceled = True

    await _worker(queue, storage, _FakeRemover()).run_once()

    assert not (tmp_path / CUTOUT_KEY).exists()
    assert (tmp_path / ORIGIN_KEY).exists()
    assert queue.completed == []
    assert queue.finished == [(31, None)]


async def test_db_error_while_recording_marks_failed_and_removes_cutout(queue, storage, tmp_path):
    queue.jobs.append(_job())
    queue.complete_error = ConnectionError("db gone")

    await _worker(queue, storage, _FakeRemover()).run_once()

    assert queue.finished == [(31, FAILURE_REASON)]
    assert queue.failed == [21]
    assert not (tmp_path / CUTOUT_KEY).exists()


async def test_failure_to_record_failure_does_not_escape(queue, storage):
    queue.jobs.append(_job())
    queue.fail_error = ConnectionError("db gone")

    assert await _worker(queue, storage, _FakeRemover(RuntimeError("boom"))).run_once() is True


async def test_start_requeues_interrupted_jobs_and_stop_cancels_loops(queue, storage, monkeypatch):
    queue.requeued = 2
    logged = []
    monkeypatch.setattr(
        bg_removal_worker.logger, "info", lambda msg, extra: logged.append(extra["count"])
    )
    worker = _worker(queue, storage, _FakeRemover())

    await worker.start()
    tasks = list(worker._tasks)
    await worker.stop()

    assert logged == [2]
    assert queue.commits >= 1
    assert tasks and all(t.cancelled() for t in tasks)
    assert worker._executor._shutdown
