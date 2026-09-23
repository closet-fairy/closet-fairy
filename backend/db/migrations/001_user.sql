-- =====================================================================
-- 사용자 관리 영역 · MySQL 8.0 (최소 8.0.16) · utf8mb4 · InnoDB
-- 기준: DB 컨벤션 v0.4 / 표준 용어 맵핑 v0.4 / 사용자 관리 요구사항 v3
-- 전제: 서버·커넥션 타임존 '+00:00' 고정 (컨벤션 1장 — DATETIME UTC 저장).
--       이 전제가 없으면 DEFAULT CURRENT_TIMESTAMP가 로컬 시각으로 기록된다.
-- =====================================================================

CREATE TABLE member (
  member_id             BIGINT         NOT NULL AUTO_INCREMENT COMMENT '회원 식별자',
  provider_cd           VARCHAR(20)    NOT NULL COMMENT '소셜 제공자 (google/kakao)',
  provider_user_id_enc  VARBINARY(512) NOT NULL COMMENT '제공자 고유 ID (AES-256, 앱 계층 암호화)',
  provider_user_id_hash VARBINARY(32)  NOT NULL COMMENT '제공자 고유 ID의 SHA-256 (검색·유일성용)',
  nickname              VARCHAR(30)    NOT NULL COMMENT '닉네임 (암호화 여부 E-14 미결, 정책 Q10 미결)',
  created_at            DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '가입 시각 = 첫 로그인 (UTC)',
  updated_at            DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                       ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 시각 (UTC)',
  CONSTRAINT pk_member PRIMARY KEY (member_id),
  CONSTRAINT uk_member_provider_cd_provider_user_id_hash
    UNIQUE (provider_cd, provider_user_id_hash),
  CONSTRAINT ck_member_provider_cd CHECK (provider_cd IN ('google','kakao'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='회원 계정. 제공자+고유ID 조합으로 식별 (FR-LOGIN-04)';

CREATE TABLE auth_session (
  auth_session_id    BIGINT        NOT NULL AUTO_INCREMENT COMMENT '인증 세션 식별자',
  member_id          BIGINT        NOT NULL COMMENT '로그인한 회원',
  session_token_hash VARBINARY(32) NOT NULL COMMENT '세션 토큰의 SHA-256 (원문 미저장, E-13 미결 채택)',
  issued_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '발급 시각 (UTC)',
  expires_at         DATETIME      NOT NULL COMMENT '만료 시각 (UTC)',
  revoked_at         DATETIME      NULL COMMENT '무효화 시각. NULL = 유효 (FR-LOGOUT-02)',
  CONSTRAINT pk_auth_session PRIMARY KEY (auth_session_id),
  CONSTRAINT uk_auth_session_session_token_hash UNIQUE (session_token_hash),
  CONSTRAINT fk_auth_session_member FOREIGN KEY (member_id)
    REFERENCES member (member_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='인증 세션. 유효 = revoked_at IS NULL AND expires_at > UTC_TIMESTAMP()';

CREATE INDEX idx_auth_session_member_id  ON auth_session (member_id);
CREATE INDEX idx_auth_session_expires_at ON auth_session (expires_at);

CREATE TABLE member_setting (
  member_setting_id           BIGINT      NOT NULL AUTO_INCREMENT COMMENT '개인 설정 식별자',
  member_id                   BIGINT      NOT NULL COMMENT '회원 (1:1)',
  birth_year                  SMALLINT    NULL COMMENT '출생연도. 14세 미만 차단은 UI+서버 검증 (NFR-ONBOARD-01)',
  temperature_sensitivity_cd  VARCHAR(20) NULL COMMENT '체질 (cold_sensitive/normal/heat_sensitive)',
  gender_cd                   VARCHAR(10) NOT NULL DEFAULT 'unisex'
                                          COMMENT '성별 (male/female/unisex). 미입력 시 unisex (FR-ONBOARD-09-1)',
  initial_style_bonus_at      DATETIME    NULL COMMENT '선호 스타일 초기 +5 부여 시각. NULL = 미부여, 재부여 금지 (FR-AEDIT-07)',
  onboarded_at                DATETIME    NULL COMMENT '온보딩 완료 시각. NULL = 미완료 (FR-ONBOARD-05)',
  created_at                  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 시각 (UTC, 가입과 동시)',
  updated_at                  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
                                          ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 시각 (UTC)',
  CONSTRAINT pk_member_setting PRIMARY KEY (member_setting_id),
  CONSTRAINT uk_member_setting_member_id UNIQUE (member_id),
  CONSTRAINT fk_member_setting_member FOREIGN KEY (member_id)
    REFERENCES member (member_id) ON DELETE CASCADE,
  CONSTRAINT ck_member_setting_gender_cd
    CHECK (gender_cd IN ('male','female','unisex')),
  CONSTRAINT ck_member_setting_temperature_sensitivity_cd
    CHECK (temperature_sensitivity_cd IN ('cold_sensitive','normal','heat_sensitive')),
  CONSTRAINT ck_member_setting_onboarded
    CHECK (onboarded_at IS NULL
           OR (birth_year IS NOT NULL AND temperature_sensitivity_cd IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='개인 설정. 온보딩 수집 항목, 회원 1:1. 미설정 항목은 NULL (FR-PREF-06)';

CREATE TABLE member_setting_style (
  member_setting_style_id BIGINT      NOT NULL AUTO_INCREMENT COMMENT '선호 스타일 선택 식별자',
  member_setting_id       BIGINT      NOT NULL COMMENT '개인 설정',
  style_cd                VARCHAR(20) NOT NULL COMMENT '스타일 코드 (13종)',
  created_at              DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '선택 시각 (UTC)',
  CONSTRAINT pk_member_setting_style PRIMARY KEY (member_setting_style_id),
  CONSTRAINT uk_member_setting_style_member_setting_id_style_cd
    UNIQUE (member_setting_id, style_cd),
  CONSTRAINT fk_member_setting_style_member_setting FOREIGN KEY (member_setting_id)
    REFERENCES member_setting (member_setting_id) ON DELETE CASCADE,
  CONSTRAINT ck_member_setting_style_style_cd CHECK (style_cd IN
    ('minimal','casual','street','classic','formal','sporty','romantic',
     'vintage','bohemian','preppy','chic','unique','feminine'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='선호 스타일 다중 선택 (컨벤션 9장: 다중값은 자식 테이블)';
