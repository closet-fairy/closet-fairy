-- 회원 행은 유지해 다시 실행해도 id가 바뀌지 않게 한다 (DEV_MEMBER_ID로 지정하므로)
INSERT INTO member (provider_cd, provider_user_id_enc, provider_user_id_hash, nickname, created_at)
SELECT
  'google',
  _binary 'DEV-PLACEHOLDER-NOT-ENCRYPTED',
  UNHEX(SHA2('dev-google-0002', 256)),
  '부족테스터',
  UTC_TIMESTAMP()
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM member
  WHERE provider_cd = 'google'
    AND provider_user_id_hash = UNHEX(SHA2('dev-google-0002', 256))
);

SET @sparse_member_id = (
  SELECT member_id FROM member
  WHERE provider_cd = 'google'
    AND provider_user_id_hash = UNHEX(SHA2('dev-google-0002', 256))
);


DELETE FROM recommendation_session WHERE member_id = @sparse_member_id;
DELETE FROM clothing WHERE member_id = @sparse_member_id;
DELETE FROM preference_score WHERE member_id = @sparse_member_id;
DELETE FROM member_setting WHERE member_id = @sparse_member_id;


INSERT INTO member_setting
  (member_id, temperature_sensitivity_cd, birth_year, gender_cd, onboarded_at)
VALUES (
  @sparse_member_id,
  'normal',
  2000,
  'unisex',
  UTC_TIMESTAMP()
);

SET @sparse_setting_id = LAST_INSERT_ID();


INSERT INTO member_setting_style (member_setting_id, style_cd) VALUES
  (@sparse_setting_id, 'minimal'),
  (@sparse_setting_id, 'casual');


INSERT INTO preference_score (member_id, attribute_type_cd, attribute_value)
SELECT @sparse_member_id, 'style', style_cd FROM style
UNION ALL
SELECT @sparse_member_id, 'color', color_cd FROM color;


UPDATE preference_score ps
JOIN member_setting_style mss
  ON mss.member_setting_id = @sparse_setting_id
 AND mss.style_cd = ps.attribute_value
SET ps.score_sum          = 5.00,
    ps.initial_bonus_at   = UTC_TIMESTAMP()
WHERE ps.member_id         = @sparse_member_id
  AND ps.attribute_type_cd = 'style';


INSERT INTO clothing
  (member_id, processing_status_cd, reviewed_at, origin_image_url,
   category_cd, accessory_type_cd, item_name, color_cd, thickness_cd, is_waterproof)
VALUES
  (@sparse_member_id, 'completed', UTC_TIMESTAMP(), 'dev-seed-sparse/01.png', 'top', NULL, '화이트 반팔 티셔츠', 'white', 'thin', FALSE),
  (@sparse_member_id, 'completed', UTC_TIMESTAMP(), 'dev-seed-sparse/02.png', 'top', NULL, '그레이 맨투맨', 'gray', 'medium', FALSE),
  (@sparse_member_id, 'completed', UTC_TIMESTAMP(), 'dev-seed-sparse/03.png', 'top', NULL, '네이비 니트', 'navy', 'medium', FALSE),
  (@sparse_member_id, 'completed', UTC_TIMESTAMP(), 'dev-seed-sparse/04.png', 'bottom', NULL, '블랙 슬랙스', 'black', 'medium', FALSE),
  (@sparse_member_id, 'completed', UTC_TIMESTAMP(), 'dev-seed-sparse/05.png', 'shoes', NULL, '화이트 스니커즈', 'white', NULL, FALSE);


INSERT INTO clothing_style (clothing_id, style_cd)
SELECT c.clothing_id, t.style_cd
FROM clothing c
JOIN (
            SELECT 'dev-seed-sparse/01.png' AS origin_image_url, 'casual' AS style_cd
  UNION ALL SELECT 'dev-seed-sparse/01.png', 'minimal'
  UNION ALL SELECT 'dev-seed-sparse/02.png', 'casual'
  UNION ALL SELECT 'dev-seed-sparse/03.png', 'minimal'
  UNION ALL SELECT 'dev-seed-sparse/03.png', 'casual'
  UNION ALL SELECT 'dev-seed-sparse/04.png', 'minimal'
  UNION ALL SELECT 'dev-seed-sparse/04.png', 'formal'
  UNION ALL SELECT 'dev-seed-sparse/05.png', 'casual'
  UNION ALL SELECT 'dev-seed-sparse/05.png', 'minimal'
) t ON t.origin_image_url = c.origin_image_url
WHERE c.member_id = @sparse_member_id;


INSERT INTO clothing_season (clothing_id, season_cd)
SELECT c.clothing_id, t.season_cd
FROM clothing c
JOIN (
            SELECT 'dev-seed-sparse/01.png' AS origin_image_url, 'spring' AS season_cd
  UNION ALL SELECT 'dev-seed-sparse/01.png', 'summer'
  UNION ALL SELECT 'dev-seed-sparse/01.png', 'fall'
  UNION ALL SELECT 'dev-seed-sparse/02.png', 'spring'
  UNION ALL SELECT 'dev-seed-sparse/02.png', 'fall'
  UNION ALL SELECT 'dev-seed-sparse/02.png', 'winter'
  UNION ALL SELECT 'dev-seed-sparse/03.png', 'fall'
  UNION ALL SELECT 'dev-seed-sparse/03.png', 'winter'
  UNION ALL SELECT 'dev-seed-sparse/04.png', 'spring'
  UNION ALL SELECT 'dev-seed-sparse/04.png', 'summer'
  UNION ALL SELECT 'dev-seed-sparse/04.png', 'fall'
  UNION ALL SELECT 'dev-seed-sparse/04.png', 'winter'
  UNION ALL SELECT 'dev-seed-sparse/05.png', 'spring'
  UNION ALL SELECT 'dev-seed-sparse/05.png', 'summer'
  UNION ALL SELECT 'dev-seed-sparse/05.png', 'fall'
  UNION ALL SELECT 'dev-seed-sparse/05.png', 'winter'
) t ON t.origin_image_url = c.origin_image_url
WHERE c.member_id = @sparse_member_id;
