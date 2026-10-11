ALTER TABLE clothing_job
  DROP INDEX idx_clothing_job_queue,
  ADD INDEX idx_clothing_job_queue (stage_cd, started_at, created_at);
