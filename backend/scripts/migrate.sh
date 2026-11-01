#!/bin/bash
set -e

docker exec -i closet-fairy-db mysql -uroot -pdev -e \
  "CREATE DATABASE IF NOT EXISTS fashion DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;"

echo "1/12 사용자 관리..."
docker exec -i closet-fairy-db mysql -uroot -pdev fashion < db/migrations/001_user.sql

echo "2/12 의류 관리..."
docker exec -i closet-fairy-db mysql -uroot -pdev fashion < db/migrations/002_clothing.sql

echo "3/12 추천 영역..."
docker exec -i closet-fairy-db mysql -uroot -pdev fashion < db/migrations/003_recommendation.sql

echo "4/12 추천 생성 상태..."
docker exec -i closet-fairy-db mysql -uroot -pdev fashion < db/migrations/004_recommendation_generation_status.sql

echo "5/12 옷장 목록 인덱스..."
docker exec -i closet-fairy-db mysql -uroot -pdev fashion < db/migrations/005_clothing_list_index.sql

echo "6/12 처리 작업 큐 인덱스..."
docker exec -i closet-fairy-db mysql -uroot -pdev fashion < db/migrations/006_clothing_job_queue_stage_index.sql

echo "7/12 재추천 요청 의도·상태..."
docker exec -i closet-fairy-db mysql -uroot -pdev fashion < db/migrations/007_regeneration_request_intent_status.sql

echo "8/12 온보딩 완료 조건을 출생연도로..."
docker exec -i closet-fairy-db mysql -uroot -pdev fashion < db/migrations/008_member_setting_onboarding_birth_year.sql

echo "9/12 TPO 데이트 코드 추가..."
docker exec -i closet-fairy-db mysql -uroot -pdev fashion < db/migrations/009_recommendation_session_tpo_date.sql

echo "10/12 편집 표시 이미지..."
docker exec -i closet-fairy-db mysql -uroot -pdev fashion < db/migrations/010_clothing_edit_display_image.sql

echo "11/12 색상 보라·버건디 추가..."
docker exec -i closet-fairy-db mysql -uroot -pdev fashion < db/migrations/011_color_purple_burgundy.sql

echo "12/12 에센셜 계절 확장·여름 데이트 옷 추가..."
docker exec -i closet-fairy-db mysql -uroot -pdev fashion < db/migrations/012_essential_season_date_items.sql

echo "완료"