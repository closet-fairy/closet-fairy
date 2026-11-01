-- migrate.sh가 문자셋을 지정하지 않아 latin1로 실행되므로, 한글 이름이 깨지지 않게 지정한다
SET NAMES utf8mb4;

ALTER TABLE essential_item
  COMMENT='에센셜 의류 마스터 35개';

INSERT INTO essential_item
  (item_name, category_cd, accessory_type_cd, style_cd, color_cd,
   thickness_cd, is_waterproof, formality_level, gender_cd, image_url, is_active)
SELECT n.item_name, n.category_cd, NULL, n.style_cd, n.color_cd,
       n.thickness_cd, FALSE, n.formality_level, 'unisex', NULL, TRUE
FROM (
            SELECT '네이비 반팔 피케 폴로' AS item_name, 'top' AS category_cd, 'preppy' AS style_cd,
                   'navy' AS color_cd, 'thin' AS thickness_cd, 3 AS formality_level
  UNION ALL SELECT '베이지 린넨 반팔 셔츠',    'top',    'casual',  'beige', 'thin', 3
  UNION ALL SELECT '라이트그레이 린넨 슬랙스', 'bottom', 'minimal', 'gray',  'thin', 3
  UNION ALL SELECT '카키 치노 반바지',         'bottom', 'casual',  'khaki', 'thin', 2
  UNION ALL SELECT '브라운 페니 로퍼',         'shoes',  'classic', 'brown', NULL,   3
) n
-- 새로 설치하면 003 시드가 넣으므로 에센셜이 이미 있는 DB에서만 넣는다
WHERE EXISTS (SELECT 1 FROM essential_item)
  AND NOT EXISTS (
    SELECT 1 FROM essential_item e
    WHERE e.item_name = n.item_name
  );

INSERT INTO essential_item_season (essential_item_id, season_cd)
SELECT e.essential_item_id, s.season_cd
FROM essential_item e
JOIN (
            SELECT '블랙 슬랙스' AS item_name, 'summer' AS season_cd
  UNION ALL SELECT '블랙 슬랙스',              'winter'
  UNION ALL SELECT '인디고 데님 팬츠',         'winter'
  UNION ALL SELECT '블랙 로퍼',                'summer'
  UNION ALL SELECT '블랙 로퍼',                'winter'
  UNION ALL SELECT '화이트 베이직 셔츠',       'winter'
  UNION ALL SELECT '네이비 반팔 피케 폴로',    'summer'
  UNION ALL SELECT '베이지 린넨 반팔 셔츠',    'summer'
  UNION ALL SELECT '라이트그레이 린넨 슬랙스', 'summer'
  UNION ALL SELECT '카키 치노 반바지',         'summer'
  UNION ALL SELECT '브라운 페니 로퍼',         'spring'
  UNION ALL SELECT '브라운 페니 로퍼',         'summer'
  UNION ALL SELECT '브라운 페니 로퍼',         'fall'
) s ON s.item_name = e.item_name
WHERE NOT EXISTS (
  SELECT 1 FROM essential_item_season es
  WHERE es.essential_item_id = e.essential_item_id
    AND es.season_cd = s.season_cd
);
