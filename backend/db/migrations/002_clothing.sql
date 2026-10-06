-- 전제: MySQL 8.0.16+ · InnoDB · utf8mb4 · 커넥션 타임존 '+00:00'

CREATE TABLE clothing (
  clothing_id           BIGINT       NOT NULL AUTO_INCREMENT COMMENT '옷 식별자',
  member_id             BIGINT       NOT NULL COMMENT '소유 회원',
  processing_status_cd  VARCHAR(20)  NOT NULL DEFAULT 'processing' COMMENT '처리 상태 (processing/completed/failed)',
  reviewed_at           DATETIME     NULL COMMENT '검토 시각. NULL = 신규(미검토) (FR-REG-16)',
  origin_image_url      TEXT         NOT NULL COMMENT '원본 이미지 경로 (HEIC는 변환 후 경로, FR-REG-04)',
  cutout_image_url      TEXT         NULL COMMENT '누끼 이미지 경로. 배경 제거 전 NULL',
  category_cd           VARCHAR(20)  NULL COMMENT '분류. 태깅 실패 시 NULL (FR-REG-20)',
  accessory_type_cd     VARCHAR(20)  NULL COMMENT '악세서리 세부 종류. accessories일 때만 (FR-REG-17)',
  item_name             VARCHAR(100) NULL COMMENT '옷 이름 (자유 입력)',
  color_cd              VARCHAR(20)  NULL COMMENT '색상 코드 14종. 점수·판정용 (E-1 제안)',
  color_text            VARCHAR(30)  NULL COMMENT '색상 표시용 원문. 연산 미사용',
  thickness_cd          VARCHAR(10)  NULL COMMENT '두께 (thin/medium/thick)',
  is_waterproof         BOOLEAN      NULL COMMENT '방수 여부. NULL = 미상',
  created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '등록 시각 (UTC)',
  updated_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                     ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 시각 (UTC)',
  CONSTRAINT pk_clothing PRIMARY KEY (clothing_id),
  CONSTRAINT fk_clothing_member FOREIGN KEY (member_id)
    REFERENCES member (member_id) ON DELETE CASCADE,
  CONSTRAINT ck_clothing_processing_status_cd
    CHECK (processing_status_cd IN ('processing','completed','failed')),
  CONSTRAINT ck_clothing_category_cd
    CHECK (category_cd IN ('outer','top','bottom','shoes','socks','accessories')),
  CONSTRAINT ck_clothing_accessory_type
    CHECK (category_cd = 'accessories' OR accessory_type_cd IS NULL),
  CONSTRAINT ck_clothing_accessory_type_cd
    CHECK (accessory_type_cd IN ('hat','bag','belt','watch','scarf','eyewear','jewelry','etc')),
  CONSTRAINT ck_clothing_color_cd
    CHECK (color_cd IN ('black','white','gray','beige','brown','navy','blue',
                        'sky_blue','green','khaki','yellow','orange','red','pink')),
  CONSTRAINT ck_clothing_thickness_cd
    CHECK (thickness_cd IN ('thin','medium','thick'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='의류. 옷 한 벌 = 1행 (UC-REG-01)';

CREATE INDEX idx_clothing_member_id_created_at ON clothing (member_id, created_at DESC);

CREATE TABLE clothing_style (
  clothing_style_id BIGINT      NOT NULL AUTO_INCREMENT COMMENT '의류 스타일 식별자',
  clothing_id       BIGINT      NOT NULL COMMENT '의류',
  style_cd          VARCHAR(20) NOT NULL COMMENT '스타일 코드 (13종)',
  created_at        DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '태깅/선택 시각 (UTC)',
  CONSTRAINT pk_clothing_style PRIMARY KEY (clothing_style_id),
  CONSTRAINT uk_clothing_style_clothing_id_style_cd UNIQUE (clothing_id, style_cd),
  CONSTRAINT fk_clothing_style_clothing FOREIGN KEY (clothing_id)
    REFERENCES clothing (clothing_id) ON DELETE CASCADE,
  CONSTRAINT ck_clothing_style_style_cd CHECK (style_cd IN
    ('minimal','casual','street','classic','formal','sporty','romantic',
     'vintage','bohemian','preppy','chic','unique','feminine'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='의류 스타일 다중 선택 (컨벤션 9장)';

CREATE TABLE clothing_season (
  clothing_season_id BIGINT      NOT NULL AUTO_INCREMENT COMMENT '의류 계절 식별자',
  clothing_id        BIGINT      NOT NULL COMMENT '의류',
  season_cd          VARCHAR(10) NOT NULL COMMENT '계절 코드',
  created_at         DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '태깅/선택 시각 (UTC)',
  CONSTRAINT pk_clothing_season PRIMARY KEY (clothing_season_id),
  CONSTRAINT uk_clothing_season_clothing_id_season_cd UNIQUE (clothing_id, season_cd),
  CONSTRAINT fk_clothing_season_clothing FOREIGN KEY (clothing_id)
    REFERENCES clothing (clothing_id) ON DELETE CASCADE,
  CONSTRAINT ck_clothing_season_season_cd
    CHECK (season_cd IN ('spring','summer','fall','winter'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='의류 계절 다중 선택 — season 다중 확정 반영 (맵핑 B-3 v0.4 개정 정합, 본 설계 §0)';

CREATE TABLE clothing_job (
  clothing_job_id BIGINT       NOT NULL AUTO_INCREMENT COMMENT '작업 식별자 (재시도 시 신규 발급, FR-REG-24)',
  clothing_id     BIGINT       NOT NULL COMMENT '대상 의류',
  stage_cd        VARCHAR(20)  NOT NULL COMMENT '단계 (bg_removal/auto_tagging)',
  is_canceled     BOOLEAN      NOT NULL DEFAULT FALSE COMMENT '취소 여부 — 삭제 시 결과 폐기 판단 (FR-DEL-05)',
  started_at      DATETIME     NULL COMMENT '처리 시작. NULL = 대기열 (FR-REG-10)',
  finished_at     DATETIME     NULL COMMENT '처리 종료',
  failure_reason  VARCHAR(200) NULL COMMENT '실패 사유 (FR-REG-22)',
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '요청 시각 (UTC)',
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                               ON UPDATE CURRENT_TIMESTAMP COMMENT '갱신 시각 (UTC)',
  CONSTRAINT pk_clothing_job PRIMARY KEY (clothing_job_id),
  CONSTRAINT fk_clothing_job_clothing FOREIGN KEY (clothing_id)
    REFERENCES clothing (clothing_id) ON DELETE CASCADE,
  CONSTRAINT ck_clothing_job_stage_cd CHECK (stage_cd IN ('bg_removal','auto_tagging'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='비동기 처리 작업. 서버 재시작 복구의 근거 레코드 (NFR-REG-09)';

CREATE INDEX idx_clothing_job_clothing_id ON clothing_job (clothing_id);
CREATE INDEX idx_clothing_job_queue       ON clothing_job (started_at, created_at);

CREATE TABLE clothing_edit (
  clothing_edit_id  BIGINT       NOT NULL AUTO_INCREMENT COMMENT '편집 파라미터 식별자',
  clothing_id       BIGINT       NOT NULL COMMENT '대상 의류 (1:1)',
  rotation_angle    DECIMAL(5,2) NOT NULL DEFAULT 0 COMMENT '평면 회전 각도 -180~180 (FR-EDIT-04)',
  perspective_param JSON         NULL COMMENT '원근 보정 파라미터. NULL = 미적용',
  brush_mask_url    TEXT         NULL COMMENT '브러시 마스크 경로. NULL = 미보정 (FR-EDIT-03)',
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 시각 (UTC)',
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                 ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 시각 (UTC)',
  CONSTRAINT pk_clothing_edit PRIMARY KEY (clothing_edit_id),
  CONSTRAINT uk_clothing_edit_clothing_id UNIQUE (clothing_id),
  CONSTRAINT fk_clothing_edit_clothing FOREIGN KEY (clothing_id)
    REFERENCES clothing (clothing_id) ON DELETE CASCADE,
  CONSTRAINT ck_clothing_edit_rotation_angle
    CHECK (rotation_angle BETWEEN -180.00 AND 180.00)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='이미지 편집 파라미터. 원본에 굽지 않고 파라미터로 보관 (FR-EDIT-06)';
