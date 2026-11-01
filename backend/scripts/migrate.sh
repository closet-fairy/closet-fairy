#!/bin/bash
set -e

docker exec -i closet-fairy-db mysql -uroot -pdev --default-character-set=utf8mb4 -e \
  "CREATE DATABASE IF NOT EXISTS fashion DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;"

echo "1/13 사용자 관리..."
docker exec -i closet-fairy-db mysql -uroot -pdev fashion --default-character-set=utf8mb4 < db/migrations/001_user.sql

echo "2/13 의류 관리..."
docker exec -i closet-fairy-db mysql -uroot -pdev fashion --default-character-set=utf8mb4 < db/migrations/002_clothing.sql

echo "3/13 추천 영역..."
docker exec -i closet-fairy-db mysql -uroot -pdev fashion --default-character-set=utf8mb4 < db/migrations/003_recommendation.sql

echo "4/13 추천 생성 상태..."
docker exec -i closet-fairy-db mysql -uroot -pdev fashion --default-character-set=utf8mb4 < db/migrations/004_recommendation_generation_status.sql

echo "5/13 옷장 목록 인덱스..."
docker exec -i closet-fairy-db mysql -uroot -pdev fashion --default-character-set=utf8mb4 < db/migrations/005_clothing_list_index.sql

echo "6/13 처리 작업 큐 인덱스..."
docker exec -i closet-fairy-db mysql -uroot -pdev fashion --default-character-set=utf8mb4 < db/migrations/006_clothing_job_queue_stage_index.sql

echo "7/13 재추천 요청 의도·상태..."
docker exec -i closet-fairy-db mysql -uroot -pdev fashion --default-character-set=utf8mb4 < db/migrations/007_regeneration_request_intent_status.sql

echo "8/13 온보딩 완료 조건을 출생연도로..."
docker exec -i closet-fairy-db mysql -uroot -pdev fashion --default-character-set=utf8mb4 < db/migrations/008_member_setting_onboarding_birth_year.sql

echo "9/13 TPO 데이트 코드 추가..."
docker exec -i closet-fairy-db mysql -uroot -pdev fashion --default-character-set=utf8mb4 < db/migrations/009_recommendation_session_tpo_date.sql

echo "10/13 편집 표시 이미지..."
docker exec -i closet-fairy-db mysql -uroot -pdev fashion --default-character-set=utf8mb4 < db/migrations/010_clothing_edit_display_image.sql

echo "11/13 색상 보라·버건디 추가..."
docker exec -i closet-fairy-db mysql -uroot -pdev fashion --default-character-set=utf8mb4 < db/migrations/011_color_purple_burgundy.sql

echo "12/13 에센셜 계절 확장·여름 데이트 옷 추가..."
docker exec -i closet-fairy-db mysql -uroot -pdev fashion --default-character-set=utf8mb4 < db/migrations/012_essential_season_date_items.sql

echo "13/13 에센셜 울코트 봄·가을 추가..."
docker exec -i closet-fairy-db mysql -uroot -pdev fashion --default-character-set=utf8mb4 < db/migrations/013_essential_wool_coat_seasons.sql

echo "완료"