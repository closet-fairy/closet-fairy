-- ============================================================
-- 마스터
-- ============================================================

CREATE TABLE style (
  style_id        BIGINT       NOT NULL AUTO_INCREMENT COMMENT '스타일 식별자',
  style_cd        VARCHAR(20)  NOT NULL COMMENT '스타일 코드. 참조는 이 값으로 한다',
  style_nm        VARCHAR(30)  NOT NULL COMMENT '표시명',
  description     VARCHAR(100) NOT NULL COMMENT '한 줄 설명 (USR-004, FR-PREF-08)',
  display_seq     INT          NOT NULL COMMENT '정렬 순번',
  CONSTRAINT pk_style PRIMARY KEY (style_id),
  CONSTRAINT uk_style_style_cd UNIQUE (style_cd),
  CONSTRAINT ck_style_style_cd CHECK (style_cd IN
    ('minimal','casual','street','classic','formal','sporty','romantic',
     'vintage','bohemian','preppy','chic','unique','feminine'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='스타일 마스터 13종';

CREATE TABLE color (
  color_id        BIGINT       NOT NULL AUTO_INCREMENT COMMENT '색상 식별자',
  color_cd        VARCHAR(20)  NOT NULL COMMENT '색상 코드. 참조는 이 값으로 한다',
  color_nm        VARCHAR(30)  NOT NULL COMMENT '표시명',
  hex_code        CHAR(7)      NOT NULL COMMENT '칩 렌더링용 #RRGGBB',
  display_seq     INT          NOT NULL COMMENT '정렬 순번',
  CONSTRAINT pk_color PRIMARY KEY (color_id),
  CONSTRAINT uk_color_color_cd UNIQUE (color_cd),
  CONSTRAINT ck_color_color_cd CHECK (color_cd IN
    ('black','white','gray','beige','brown','navy','blue',
     'sky_blue','green','khaki','yellow','orange','red','pink'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='색상 마스터 14종 (E-1)';

CREATE TABLE essential_item (
  essential_item_id  BIGINT       NOT NULL AUTO_INCREMENT COMMENT '에센셜 의류 식별자',
  item_name          VARCHAR(100) NOT NULL COMMENT '아이템명. clothing.item_name 과 동일 표기·길이',
  category_cd        VARCHAR(20)  NOT NULL COMMENT '분류. clothing과 값 집합 공유',
  accessory_type_cd  VARCHAR(20)  NULL     COMMENT '악세서리 세부 종류',
  style_cd           VARCHAR(20)  NOT NULL COMMENT '스타일. 의류와 달리 단일',
  color_cd           VARCHAR(20)  NOT NULL COMMENT '색상 코드',
  thickness_cd       VARCHAR(10)  NULL     COMMENT '두께. 신발·악세서리는 NULL',
  is_waterproof      BOOLEAN      NOT NULL DEFAULT FALSE COMMENT '방수 여부',
  formality_level    SMALLINT     NOT NULL COMMENT '격식 수준 1~5. 에센셜 전용 (D-12)',
  gender_cd          VARCHAR(10)  NOT NULL DEFAULT 'unisex' COMMENT '성별 (D-9)',
  image_url          TEXT         NULL     COMMENT '이미지 경로',
  is_active          BOOLEAN      NOT NULL DEFAULT TRUE COMMENT '노출 여부. 계절 전환 토글',
  created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 시각 (UTC)',
  updated_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                  ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 시각 (UTC)',
  CONSTRAINT pk_essential_item PRIMARY KEY (essential_item_id),
  CONSTRAINT ck_essential_item_style_cd CHECK (style_cd IN
    ('minimal','casual','street','classic','formal','sporty','romantic',
     'vintage','bohemian','preppy','chic','unique','feminine')),
  CONSTRAINT ck_essential_item_color_cd CHECK (color_cd IN
    ('black','white','gray','beige','brown','navy','blue',
     'sky_blue','green','khaki','yellow','orange','red','pink')),
  CONSTRAINT ck_essential_item_category CHECK (
    category_cd IN ('outer','top','bottom','shoes','socks','accessories')),
  CONSTRAINT ck_essential_item_accessory CHECK (
    category_cd = 'accessories' OR accessory_type_cd IS NULL),
  CONSTRAINT ck_essential_item_accessory_type_cd CHECK (
    accessory_type_cd IN ('hat','bag','belt','watch','scarf','eyewear','jewelry','etc')),
  CONSTRAINT ck_essential_item_thickness CHECK (
    thickness_cd IS NULL OR thickness_cd IN ('thin','medium','thick')),
  CONSTRAINT ck_essential_item_formality CHECK (formality_level BETWEEN 1 AND 5),
  CONSTRAINT ck_essential_item_gender CHECK (gender_cd IN ('male','female','unisex'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='에센셜 의류 마스터 30개';

CREATE INDEX idx_essential_item_category_cd_is_active ON essential_item (category_cd, is_active, formality_level);

CREATE TABLE essential_item_season (
  essential_item_id  BIGINT      NOT NULL COMMENT '에센셜 의류 식별자',
  season_cd          VARCHAR(10) NOT NULL COMMENT '계절',
  CONSTRAINT pk_essential_item_season PRIMARY KEY (essential_item_id, season_cd),
  CONSTRAINT fk_essential_item_season_essential_item FOREIGN KEY (essential_item_id)
    REFERENCES essential_item (essential_item_id) ON DELETE CASCADE,
  CONSTRAINT ck_essential_item_season_cd CHECK (
    season_cd IN ('spring','summer','fall','winter'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='에센셜 의류 계절 다중 선택 자식 (컨벤션 9장)';

-- ============================================================
-- 선호 점수
-- ============================================================

CREATE TABLE preference_score (
  preference_score_id  BIGINT       NOT NULL AUTO_INCREMENT COMMENT '선호 점수 식별자',
  member_id            BIGINT       NOT NULL COMMENT '회원 식별자',
  attribute_type_cd    VARCHAR(20)  NOT NULL COMMENT '속성 유형 style/color',
  attribute_value      VARCHAR(30)  NOT NULL COMMENT '속성 값. style_cd 또는 color_cd',
  score_sum            DECIMAL(8,4) NOT NULL DEFAULT 0.0000 COMMENT 'EMA 누적 델타 합 (S)',
  exposure_count       DECIMAL(8,4) NOT NULL DEFAULT 0.0000 COMMENT 'EMA 누적 노출 횟수 (N)',
  initial_bonus_at     DATETIME     NULL     COMMENT '선호 스타일 초기 보너스 부여 시각 (FR-PREF-09)',
  created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 시각 (UTC)',
  updated_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                    ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 시각 (UTC)',
  CONSTRAINT pk_preference_score PRIMARY KEY (preference_score_id),
  CONSTRAINT uk_preference_score_member_attr UNIQUE (member_id, attribute_type_cd, attribute_value),
  CONSTRAINT fk_preference_score_member FOREIGN KEY (member_id)
    REFERENCES member (member_id) ON DELETE CASCADE,
  CONSTRAINT ck_preference_score_type CHECK (attribute_type_cd IN ('style','color')),
  CONSTRAINT ck_preference_score_exposure CHECK (exposure_count >= 0.0000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='회원별 속성 선호도. S/N 보관, 선호도는 조회 시 계산. 가입 시 27행 (E-3)';

CREATE INDEX idx_preference_score_member_id_type_cd ON preference_score (member_id, attribute_type_cd);


-- ============================================================
-- 추천 세션 · 날씨
-- ============================================================

CREATE TABLE recommendation_session (
  recommendation_session_id BIGINT       NOT NULL AUTO_INCREMENT COMMENT '추천 세션 식별자',
  member_id                 BIGINT       NOT NULL COMMENT '회원 식별자',
  sido_nm                   VARCHAR(20)  NOT NULL COMMENT '시/도. 좌표 저장 금지 (컨벤션 8-1)',
  sigungu_nm                VARCHAR(30)  NOT NULL COMMENT '시/군/구',
  location_input_type_cd    VARCHAR(20)  NOT NULL COMMENT '지역 결정 방식 current/manual',
  tpo_cd                    VARCHAR(20)  NOT NULL DEFAULT 'daily' COMMENT 'TPO 코드. 프리셋 + custom',
  tpo_text                  TEXT         NULL     COMMENT 'TPO 자유 입력. 유해 입력 필터 통과분만',
  tpo_input_type_cd         VARCHAR(20)  NOT NULL COMMENT '검증 분기 조건 preset/custom (FR-REC-03-1)',
  going_out_start_at        DATETIME     NOT NULL COMMENT '외출 시작. 30분 단위',
  going_out_end_at          DATETIME     NOT NULL COMMENT '외출 종료. 자정 통과 시 익일',
  season_cd                 VARCHAR(10)  NOT NULL COMMENT '요청 시점 계절 판정 결과 (FR-REC-02-1)',
  is_clothing_shortage      BOOLEAN      NOT NULL DEFAULT FALSE COMMENT '의류 부족 여부 (FR-REC-10)',
  session_status_cd         VARCHAR(20)  NOT NULL DEFAULT 'active' COMMENT '세션 상태',
  settled_at                DATETIME     NULL     COMMENT '점수 정산 완료 시각. 중복 정산 방지',
  created_at                DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '세션 시작',
  ended_at                  DATETIME     NULL     COMMENT '세션 종료',
  CONSTRAINT pk_recommendation_session PRIMARY KEY (recommendation_session_id),
  CONSTRAINT fk_recommendation_session_member FOREIGN KEY (member_id)
    REFERENCES member (member_id) ON DELETE CASCADE,
  CONSTRAINT ck_recommendation_session_location_input_type_cd CHECK (location_input_type_cd IN ('current','manual')),
  CONSTRAINT ck_recommendation_session_tpo_cd CHECK (
    tpo_cd IN ('daily','work','formal','exercise','rainy','midwinter','custom')),
  CONSTRAINT ck_recommendation_session_tpo_input_type_cd CHECK (tpo_input_type_cd IN ('preset','custom')),
  CONSTRAINT ck_recommendation_session_tpo_text CHECK (
    (tpo_input_type_cd = 'custom' AND tpo_text IS NOT NULL)
    OR (tpo_input_type_cd = 'preset' AND tpo_text IS NULL)),
  CONSTRAINT ck_recommendation_session_season_cd CHECK (season_cd IN ('spring','summer','fall','winter')),
  CONSTRAINT ck_recommendation_session_session_status_cd CHECK (
    session_status_cd IN ('active','completed','canceled','abandoned')),
  CONSTRAINT ck_recommendation_session_settled_at CHECK (
    settled_at IS NULL OR session_status_cd = 'completed')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='추천 세션. 요청부터 별점·취소·이탈까지';

CREATE INDEX idx_recommendation_session_member_id_created_at ON recommendation_session (member_id, created_at DESC);
CREATE INDEX idx_recommendation_session_status_cd_created_at ON recommendation_session (session_status_cd, created_at);

CREATE TABLE weather_snapshot (
  recommendation_session_id BIGINT       NOT NULL COMMENT '세션 식별자. 세션 1:1',
  temperature               DECIMAL(4,1) NOT NULL COMMENT '기온',
  feels_like_temperature    DECIMAL(4,1) NOT NULL COMMENT '체감 기온. 아우터 판정 기준',
  precipitation             DECIMAL(5,1) NOT NULL DEFAULT 0.0 COMMENT '강수량 mm',
  wind_speed                DECIMAL(4,1) NOT NULL DEFAULT 0.0 COMMENT '풍속',
  weather_condition_cd      VARCHAR(20)  NOT NULL COMMENT '날씨 상태',
  hourly_forecast           JSON         NULL     COMMENT '시간대별 기온·강수·풍속 시계열',
  is_fallback               BOOLEAN      NOT NULL DEFAULT FALSE COMMENT 'API 장애로 대체값 사용 (RER-003)',
  created_at                DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '수집 시각 (UTC)',
  CONSTRAINT pk_weather_snapshot PRIMARY KEY (recommendation_session_id),
  CONSTRAINT fk_weather_snapshot_session FOREIGN KEY (recommendation_session_id)
    REFERENCES recommendation_session (recommendation_session_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='추천 시점 날씨. 세션당 1회 수집 — 재추천 시 재수집하지 않음';

CREATE TABLE daily_weather (
  region_cd        VARCHAR(20)  NOT NULL COMMENT '관측 지점. 개인 위치가 아님',
  weather_dt       DATE         NOT NULL COMMENT '관측 일자',
  avg_temperature  DECIMAL(4,1) NOT NULL COMMENT '일평균 기온. 계절 판정용',
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '적재 시각 (UTC)',
  CONSTRAINT pk_daily_weather PRIMARY KEY (region_cd, weather_dt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='기상 일자료. 과거 일괄 적재 + 일 1회 증분 (FR-REC-02-1)';

-- ============================================================
-- 덱 · 코디
-- ============================================================

CREATE TABLE recommendation_deck (
  recommendation_deck_id    BIGINT      NOT NULL AUTO_INCREMENT COMMENT '덱 식별자',
  recommendation_session_id BIGINT      NOT NULL COMMENT '세션 식별자',
  deck_seq                  INT         NOT NULL COMMENT '덱 순번. 세션 내 1부터',
  deck_trigger_cd           VARCHAR(20) NOT NULL COMMENT '생성 계기 initial/regeneration',
  created_at                DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '덱 생성 시각 (UTC)',
  CONSTRAINT pk_recommendation_deck PRIMARY KEY (recommendation_deck_id),
  CONSTRAINT uk_recommendation_deck_recommendation_session_id_deck_seq UNIQUE (recommendation_session_id, deck_seq),
  CONSTRAINT fk_recommendation_deck_recommendation_session FOREIGN KEY (recommendation_session_id)
    REFERENCES recommendation_session (recommendation_session_id) ON DELETE CASCADE,
  CONSTRAINT ck_recommendation_deck_deck_trigger_cd CHECK (deck_trigger_cd IN ('initial','regeneration')),
  CONSTRAINT ck_recommendation_deck_deck_seq CHECK (deck_seq >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='덱. 한 번의 생성으로 나온 코디 묶음 — 덱당 4행이 보장되지 않음';

CREATE TABLE outfit (
  outfit_id              BIGINT      NOT NULL AUTO_INCREMENT COMMENT '코디 식별자',
  recommendation_deck_id BIGINT      NOT NULL COMMENT '덱 식별자',
  outfit_seq             INT         NOT NULL COMMENT '덱 내 순번 1~4',
  outfit_type_cd         VARCHAR(20) NOT NULL COMMENT '코디 유형 preferred/exploratory',
  reason                 TEXT        NULL     COMMENT '추천 사유. LLM 생성 (D-13)',
  created_at             DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '코디 생성 시각 (UTC)',
  CONSTRAINT pk_outfit PRIMARY KEY (outfit_id),
  CONSTRAINT uk_outfit_recommendation_deck_id_outfit_seq UNIQUE (recommendation_deck_id, outfit_seq),
  CONSTRAINT fk_outfit_recommendation_deck FOREIGN KEY (recommendation_deck_id)
    REFERENCES recommendation_deck (recommendation_deck_id) ON DELETE CASCADE,
  CONSTRAINT ck_outfit_type CHECK (outfit_type_cd IN ('preferred','exploratory')),
  CONSTRAINT ck_outfit_seq CHECK (outfit_seq BETWEEN 1 AND 4)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='코디 세트. 선호 3벌 + 탐색 1벌 (FR-REC-08)';

CREATE TABLE outfit_item (
  outfit_item_id      BIGINT       NOT NULL AUTO_INCREMENT COMMENT '코디 아이템 식별자',
  outfit_id           BIGINT       NOT NULL COMMENT '코디 식별자',
  slot_cd             VARCHAR(20)  NOT NULL COMMENT '착용 슬롯. category_cd와 값 집합 공유',
  item_source_cd      VARCHAR(20)  NOT NULL COMMENT '아이템 출처 owned/essential',
  clothing_id         BIGINT       NULL     COMMENT '보유 의류. 옷 삭제 시 NULL (E-8)',
  essential_item_id   BIGINT       NULL     COMMENT '에센셜 의류',
  item_name_snapshot    VARCHAR(100) NOT NULL COMMENT '추천 당시 이름 스냅샷 (E-8)',
  image_url_snapshot  TEXT         NULL     COMMENT '추천 당시 이미지 경로 스냅샷 (E-8)',
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 시각 (UTC)',
  CONSTRAINT pk_outfit_item PRIMARY KEY (outfit_item_id),
  CONSTRAINT fk_outfit_item_outfit FOREIGN KEY (outfit_id)
    REFERENCES outfit (outfit_id) ON DELETE CASCADE,
  CONSTRAINT fk_outfit_item_clothing FOREIGN KEY (clothing_id)
    REFERENCES clothing (clothing_id) ON DELETE SET NULL,
  CONSTRAINT fk_outfit_item_essential_item FOREIGN KEY (essential_item_id)
    REFERENCES essential_item (essential_item_id) ON DELETE RESTRICT,
  CONSTRAINT ck_outfit_item_slot CHECK (
    slot_cd IN ('outer','top','bottom','shoes','socks','accessories')),
  CONSTRAINT ck_outfit_item_item_source_cd CHECK (
    item_source_cd IN ('owned','essential')),
  CONSTRAINT ck_outfit_item_source CHECK (
    (item_source_cd = 'owned'     AND essential_item_id IS NULL)
    OR
    (item_source_cd = 'essential' AND essential_item_id IS NOT NULL))
  -- clothing_id는 CHECK에서 참조할 수 없다. ON DELETE SET NULL 이 걸린 컬럼을
  -- CHECK가 참조하면 MySQL이 ERROR 3823으로 거부한다.
  -- "essential이면 clothing_id IS NULL" 조건은 앱이 보장한다 (6장)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='코디 구성 아이템. 옷 삭제 후에도 스냅샷으로 재현 (FR-HIST-08)';

CREATE INDEX idx_outfit_item_outfit ON outfit_item (outfit_id);

-- ============================================================
-- 피드백 · 재추천 요청
-- ============================================================

CREATE TABLE outfit_feedback (
  outfit_feedback_id        BIGINT       NOT NULL AUTO_INCREMENT COMMENT '피드백 식별자',
  outfit_id                 BIGINT       NOT NULL COMMENT '코디 식별자',
  recommendation_session_id BIGINT       NOT NULL COMMENT '세션 식별자. 세션당 1회 제약용 비정규화',
  feedback_type_cd          VARCHAR(30)  NOT NULL COMMENT 'rated/auto_rejected/regeneration_requested',
  rating                    SMALLINT     NULL     COMMENT '별점 1~5. rated일 때만',
  applied_delta             DECIMAL(4,2) NOT NULL COMMENT '반영 시점 상수 스냅샷. 소수 둘째 자리 (컨벤션 7장)',
  rated_session_id          BIGINT       AS (CASE WHEN feedback_type_cd = 'rated'
                                             THEN recommendation_session_id END) VIRTUAL
                                         COMMENT '세션당 별점 1건 강제용 생성 컬럼',
  created_at                DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '정산 시각 (UTC)',
  CONSTRAINT pk_outfit_feedback PRIMARY KEY (outfit_feedback_id),
  CONSTRAINT uk_outfit_feedback_rated_session_id UNIQUE (rated_session_id),
  CONSTRAINT uk_outfit_feedback_outfit_id UNIQUE (outfit_id),
  CONSTRAINT fk_outfit_feedback_outfit FOREIGN KEY (outfit_id)
    REFERENCES outfit (outfit_id) ON DELETE CASCADE,
  CONSTRAINT fk_outfit_feedback_recommendation_session FOREIGN KEY (recommendation_session_id)
    REFERENCES recommendation_session (recommendation_session_id) ON DELETE CASCADE,
  CONSTRAINT ck_outfit_feedback_feedback_type_cd CHECK (
    feedback_type_cd IN ('rated','auto_rejected','regeneration_requested')),
  CONSTRAINT ck_outfit_feedback_rating CHECK (
    (feedback_type_cd = 'rated' AND rating BETWEEN 1 AND 5)
    OR (feedback_type_cd <> 'rated' AND rating IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='코디 피드백. 세션 종료 시 일괄 생성. 불변 (FR-REC-22-1)';

CREATE INDEX idx_outfit_feedback_session_id_feedback_type_cd ON outfit_feedback (recommendation_session_id, feedback_type_cd);

CREATE TABLE regeneration_request (
  regeneration_request_id   BIGINT      NOT NULL AUTO_INCREMENT COMMENT '재추천 요청 식별자',
  recommendation_session_id BIGINT      NOT NULL COMMENT '세션 식별자',
  request_seq               INT         NOT NULL COMMENT '세션 내 요청 순번. 1부터',
  target_scope_cd           VARCHAR(20) NOT NULL COMMENT '대상 범위 single/all',
  target_outfit_id          BIGINT      NULL     COMMENT '대상 코디. single일 때만',
  target_slot_cd            VARCHAR(20) NULL     COMMENT '대상 슬롯. 파츠 단위 요청일 때만',
  result_deck_id            BIGINT      NULL     COMMENT '생성된 새 덱',
  request_text              TEXT        NOT NULL COMMENT '요청 원문. 유해 입력 필터 통과분',
  created_at                DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '요청 시각 (UTC)',
  CONSTRAINT pk_regeneration_request PRIMARY KEY (regeneration_request_id),
  CONSTRAINT uk_regeneration_request_session_id_request_seq UNIQUE (recommendation_session_id, request_seq),
  CONSTRAINT fk_regeneration_request_recommendation_session FOREIGN KEY (recommendation_session_id)
    REFERENCES recommendation_session (recommendation_session_id) ON DELETE CASCADE,
  CONSTRAINT fk_regeneration_request_outfit FOREIGN KEY (target_outfit_id)
    REFERENCES outfit (outfit_id) ON DELETE CASCADE,
  CONSTRAINT fk_regeneration_request_recommendation_deck FOREIGN KEY (result_deck_id)
    REFERENCES recommendation_deck (recommendation_deck_id) ON DELETE SET NULL,
  CONSTRAINT ck_regeneration_request_target_scope_cd CHECK (target_scope_cd IN ('single','all')),
  CONSTRAINT ck_regeneration_request_target_slot_cd CHECK (
    target_slot_cd IS NULL OR
    target_slot_cd IN ('outer','top','bottom','shoes','socks','accessories')),
  CONSTRAINT ck_regeneration_request_target_outfit_id CHECK (
    (target_scope_cd = 'single' AND target_outfit_id IS NOT NULL)
    OR (target_scope_cd = 'all' AND target_outfit_id IS NULL AND target_slot_cd IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='재추천 요청 이력. 세션 스코프 데이터를 이 누적으로 표현 (E-6)';

-- ============================================================
-- 추천 내역 뷰
-- ============================================================

CREATE VIEW v_recommendation_history AS
SELECT
  s.member_id,
  s.recommendation_session_id,
  o.outfit_id,
  s.created_at            AS recommended_at,
  s.tpo_cd,
  s.tpo_text,
  s.season_cd,
  w.temperature,
  w.feels_like_temperature,
  w.weather_condition_cd,
  f.rating,
  o.reason
FROM outfit_feedback f
JOIN outfit                 o ON o.outfit_id = f.outfit_id
JOIN recommendation_deck    d ON d.recommendation_deck_id = o.recommendation_deck_id
JOIN recommendation_session s ON s.recommendation_session_id = d.recommendation_session_id
LEFT JOIN weather_snapshot  w ON w.recommendation_session_id = s.recommendation_session_id
WHERE f.feedback_type_cd = 'rated';
