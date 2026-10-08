ALTER TABLE recommendation_session
  ADD COLUMN generation_status_cd VARCHAR(20) NOT NULL DEFAULT 'processing'
    COMMENT '추천 결과 생성 상태 processing/completed/failed' AFTER session_status_cd,
  ADD CONSTRAINT ck_recommendation_session_generation_status_cd CHECK (
    generation_status_cd IN ('processing','completed','failed'));

-- 004 이전 세션은 결과를 저장하지 않았으므로 failed로 둬 폴링이 끝나게 한다
UPDATE recommendation_session SET generation_status_cd = 'failed'
 WHERE generation_status_cd = 'processing';
