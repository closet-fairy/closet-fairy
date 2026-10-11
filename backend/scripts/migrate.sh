#!/bin/bash
set -e

docker exec -i closet-fairy-db mysql -uroot -pdev -e \
  "CREATE DATABASE IF NOT EXISTS fashion DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;"

echo "1/5 사용자 관리..."
docker exec -i closet-fairy-db mysql -uroot -pdev fashion < db/migrations/001_user.sql

echo "2/5 의류 관리..."
docker exec -i closet-fairy-db mysql -uroot -pdev fashion < db/migrations/002_clothing.sql

echo "3/5 추천 영역..."
docker exec -i closet-fairy-db mysql -uroot -pdev fashion < db/migrations/003_recommendation.sql

echo "4/5 추천 생성 상태..."
docker exec -i closet-fairy-db mysql -uroot -pdev fashion < db/migrations/004_recommendation_generation_status.sql

echo "5/5 옷장 목록 인덱스..."
docker exec -i closet-fairy-db mysql -uroot -pdev fashion < db/migrations/005_clothing_list_index.sql

echo "완료"