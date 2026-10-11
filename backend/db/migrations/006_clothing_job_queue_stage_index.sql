-- 단계가 섞인 인덱스를 훑으면 다른 단계 워커가 잠근 행 때문에 SKIP LOCKED가 대기 작업을 건너뛴다
ALTER TABLE clothing_job
  DROP INDEX idx_clothing_job_queue,
  ADD INDEX idx_clothing_job_queue (stage_cd, started_at, created_at);
