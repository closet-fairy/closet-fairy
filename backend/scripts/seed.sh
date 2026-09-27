#!/usr/bin/env bash
#시드 적재+커버리지 검증. backend/ 에서 실행 : bash scripts/seed.sh

set -euo pipefail

MYSQL_SERVICE="${MYSQL_SERVICE:-mysql}"
MYSQL_DATABASE="${MYSQL_DATABASE:-closet_fairy}"
MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_PASSWORD="${MYSQL_ROOT_PASSWORD:-}"
SEED_DEV_MEMBER="${SEED_DEV_MEMBER:-1}"

if [ -z "$MYSQL_PASSWORD" ]; then
  echo "MYSQL_ROOT_PASSWORD 가 비어 있습니다. .env 를 먼저 채워 주세요." >&2
  exit 1
fi

run_sql() {
  docker compose exec -T "$MYSQL_SERVICE" \
    mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" \
    --default-character-set=utf8mb4 "$@"
}

echo " 시드 적재 "
for file in db/seeds/*.sql; do
  case "$file" in
    *004_dev_member.sql)
      if [ "$SEED_DEV_MEMBER" != "1" ]; then
        echo "  건너뜀 : $file (SEED_DEV_MEMBER=0)"
        continue
      fi
      ;;
  esac
  echo "  적재   : $file"
  run_sql < "$file"
done

echo
echo "=== 1. 행 수 검증 ==="
run_sql --table -e "
SELECT '스타일' AS 항목, COUNT(*) AS 실제, 13 AS 기대,
       IF(COUNT(*) = 13, 'OK', 'FAIL') AS 결과 FROM style
UNION ALL
SELECT '색상',   COUNT(*), 14, IF(COUNT(*) = 14, 'OK', 'FAIL') FROM color
UNION ALL
SELECT '에센셜', COUNT(*), 30, IF(COUNT(*) = 30, 'OK', 'FAIL') FROM essential_item;
"

echo
echo "=== 2. 계절 미지정 에센셜 (0행이어야 정상) ==="
run_sql --table -e "
SELECT e.item_name AS 아이템
FROM essential_item e
LEFT JOIN essential_item_season s ON s.essential_item_id = e.essential_item_id
WHERE s.essential_item_id IS NULL;
"

echo
echo "=== 3. TPO 격식 x 계절 커버리지 ==="
run_sql --table -e "
SELECT b.band_nm AS TPO격식,
       s.season_cd AS 계절,
       COALESCE(SUM(e.category_cd = 'top'),    0) AS 상의,
       COALESCE(SUM(e.category_cd = 'bottom'), 0) AS 하의,
       COALESCE(SUM(e.category_cd = 'shoes'),  0) AS 신발
FROM (           SELECT 'spring' AS season_cd
       UNION ALL SELECT 'summer'
       UNION ALL SELECT 'fall'
       UNION ALL SELECT 'winter') s
CROSS JOIN (           SELECT '캐주얼 1~3' AS band_nm, 1 AS lo, 3 AS hi
             UNION ALL SELECT '격식 4~5',   4,         5) b
LEFT JOIN essential_item_season es ON es.season_cd = s.season_cd
LEFT JOIN essential_item e
       ON e.essential_item_id = es.essential_item_id
      AND e.is_active = TRUE
      AND e.formality_level BETWEEN b.lo AND b.hi
      AND e.category_cd IN ('top','bottom','shoes')
GROUP BY b.band_nm, s.season_cd
ORDER BY b.band_nm, FIELD(s.season_cd, 'spring','summer','fall','winter');
"

echo
echo "=== 4. 마스터에 없는 코드값 참조 (0행이어야 정상) ==="
run_sql --table -e "
SELECT e.item_name AS 아이템, '스타일' AS 종류, e.style_cd AS 값
FROM essential_item e LEFT JOIN style s ON s.style_cd = e.style_cd
WHERE s.style_cd IS NULL
UNION ALL
SELECT e.item_name, '색상', e.color_cd
FROM essential_item e LEFT JOIN color c ON c.color_cd = e.color_cd
WHERE c.color_cd IS NULL;
"

if [ "$SEED_DEV_MEMBER" = "1" ]; then
  echo
  echo "=== 5. 개발 회원 선호 점수 27행 ==="
  run_sql --table -e "
  SELECT COUNT(*) AS 실제, 27 AS 기대, IF(COUNT(*) = 27, 'OK', 'FAIL') AS 결과
  FROM preference_score;
  "
fi

echo
echo "=== 완료 ==="