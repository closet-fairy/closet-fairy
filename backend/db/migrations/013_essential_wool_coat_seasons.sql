-- 파일만 따로 적용할 때도 한글 이름이 깨지지 않게 지정한다
SET NAMES utf8mb4;

INSERT INTO essential_item_season (essential_item_id, season_cd)
SELECT e.essential_item_id, s.season_cd
FROM essential_item e
JOIN (
            SELECT '차콜 울코트' AS item_name, 'spring' AS season_cd
  UNION ALL SELECT '차콜 울코트',              'fall'
) s ON s.item_name = e.item_name
WHERE NOT EXISTS (
  SELECT 1 FROM essential_item_season es
  WHERE es.essential_item_id = e.essential_item_id
    AND es.season_cd = s.season_cd
);
