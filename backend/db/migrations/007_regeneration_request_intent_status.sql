-- 007 이전 요청은 API 없이 검증 스크립트로만 만들어졌고 파싱 결과가 없어 지운다
DELETE FROM regeneration_request;

ALTER TABLE regeneration_request
  ADD COLUMN parsed_intent JSON NOT NULL
    COMMENT '의도 파싱 결과. 파싱에 성공한 요청만 기록' AFTER request_text,
  ADD COLUMN regeneration_status_cd VARCHAR(20) NOT NULL DEFAULT 'processing'
    COMMENT '재추천 생성 상태 processing/completed/failed' AFTER parsed_intent,
  ADD CONSTRAINT ck_regeneration_request_regeneration_status_cd CHECK (
    regeneration_status_cd IN ('processing','completed','failed'));
