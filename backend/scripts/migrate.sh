#!/bin/bash
set -e

docker exec -i closet-fairy-db mysql -uroot -pdev -e \
  "CREATE DATABASE IF NOT EXISTS fashion DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;"

echo "1/8 사용자 관리..."
docker exec -i closet-fairy-db mysql -uroot -pdev fashion < db/migrations/001_user.sql

echo "2/8 의류 관리..."
docker exec -i closet-fairy-db mysql -uroot -pdev fashion < db/migrations/002_clothing.sql

echo "3/8 추천 영역..."
docker exec -i closet-fairy-db mysql -uroot -pdev fashion < db/migrations/003_recommendation.sql

echo "4/8 추천 생성 상태..."
docker exec -i closet-fairy-db mysql -uroot -pdev fashion < db/migrations/004_recommendation_generation_status.sql

echo "5/8 옷장 목록 인덱스..."
docker exec -i closet-fairy-db mysql -uroot -pdev fashion < db/migrations/005_clothing_list_index.sql

echo "6/8 처리 작업 큐 인덱스..."
docker exec -i closet-fairy-db mysql -uroot -pdev fashion < db/migrations/006_clothing_job_queue_stage_index.sql

echo "7/8 재추천 요청 의도·상태..."
docker exec -i closet-fairy-db mysql -uroot -pdev fashion < db/migrations/007_regeneration_request_intent_status.sql

echo "8/8 온보딩 완료 조건을 출생연도로..."
docker exec -i closet-fairy-db mysql -uroot -pdev fashion < db/migrations/008_member_setting_onboarding_birth_year.sql

echo "완료"