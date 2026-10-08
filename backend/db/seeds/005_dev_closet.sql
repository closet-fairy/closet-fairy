SET @dev_member_id = (
  SELECT member_id FROM member
  WHERE provider_cd = 'google'
    AND provider_user_id_hash = UNHEX(SHA2('dev-google-0001', 256))
);

DELETE FROM clothing
WHERE member_id = @dev_member_id AND origin_image_url LIKE 'dev-seed/%';


INSERT INTO clothing
  (member_id, processing_status_cd, reviewed_at, origin_image_url,
   category_cd, accessory_type_cd, item_name, color_cd, thickness_cd, is_waterproof)
VALUES
  (@dev_member_id, 'completed', UTC_TIMESTAMP(), 'dev-seed/01.png', 'outer', NULL, '베이지 트렌치코트', 'beige', 'medium', FALSE),
  (@dev_member_id, 'completed', UTC_TIMESTAMP(), 'dev-seed/02.png', 'outer', NULL, '네이비 블레이저', 'navy', 'medium', FALSE),
  (@dev_member_id, 'completed', UTC_TIMESTAMP(), 'dev-seed/03.png', 'outer', NULL, '블랙 롱패딩', 'black', 'thick', FALSE),
  (@dev_member_id, 'completed', UTC_TIMESTAMP(), 'dev-seed/04.png', 'outer', NULL, '그레이 울코트', 'gray', 'thick', FALSE),
  (@dev_member_id, 'completed', UTC_TIMESTAMP(), 'dev-seed/05.png', 'outer', NULL, '카키 바람막이', 'khaki', 'thin', TRUE),
  (@dev_member_id, 'completed', UTC_TIMESTAMP(), 'dev-seed/06.png', 'outer', NULL, '데님 재킷', 'blue', 'medium', FALSE),
  (@dev_member_id, 'completed', UTC_TIMESTAMP(), 'dev-seed/07.png', 'outer', NULL, '베이지 린넨 재킷', 'beige', 'thin', FALSE),
  (@dev_member_id, 'completed', UTC_TIMESTAMP(), 'dev-seed/08.png', 'top', NULL, '화이트 옥스포드 셔츠', 'white', 'thin', FALSE),
  (@dev_member_id, 'completed', UTC_TIMESTAMP(), 'dev-seed/09.png', 'top', NULL, '스카이블루 린넨 셔츠', 'sky_blue', 'thin', FALSE),
  (@dev_member_id, 'completed', UTC_TIMESTAMP(), 'dev-seed/10.png', 'top', NULL, '블랙 반팔 티셔츠', 'black', 'thin', FALSE),
  (@dev_member_id, 'completed', UTC_TIMESTAMP(), 'dev-seed/11.png', 'top', NULL, '그레이 크루넥 니트', 'gray', 'medium', FALSE),
  (@dev_member_id, 'completed', UTC_TIMESTAMP(), 'dev-seed/12.png', 'top', NULL, '크림 꽈배기 니트', 'beige', 'thick', FALSE),
  (@dev_member_id, 'completed', UTC_TIMESTAMP(), 'dev-seed/13.png', 'top', NULL, '네이비 후드티', 'navy', 'medium', FALSE),
  (@dev_member_id, 'completed', UTC_TIMESTAMP(), 'dev-seed/14.png', 'top', NULL, '핑크 셔츠', 'pink', 'thin', FALSE),
  (@dev_member_id, 'completed', UTC_TIMESTAMP(), 'dev-seed/15.png', 'top', NULL, '스트라이프 긴팔 티셔츠', 'white', 'medium', FALSE),
  (@dev_member_id, 'completed', UTC_TIMESTAMP(), 'dev-seed/16.png', 'bottom', NULL, '블랙 슬랙스', 'black', 'medium', FALSE),
  (@dev_member_id, 'completed', UTC_TIMESTAMP(), 'dev-seed/17.png', 'bottom', NULL, '베이지 린넨 슬랙스', 'beige', 'thin', FALSE),
  (@dev_member_id, 'completed', UTC_TIMESTAMP(), 'dev-seed/18.png', 'bottom', NULL, '연청 데님 팬츠', 'blue', 'medium', FALSE),
  (@dev_member_id, 'completed', UTC_TIMESTAMP(), 'dev-seed/19.png', 'bottom', NULL, '차콜 기모 조거팬츠', 'gray', 'thick', FALSE),
  (@dev_member_id, 'completed', UTC_TIMESTAMP(), 'dev-seed/20.png', 'bottom', NULL, '카키 카고 팬츠', 'khaki', 'medium', FALSE),
  (@dev_member_id, 'completed', UTC_TIMESTAMP(), 'dev-seed/21.png', 'bottom', NULL, '네이비 반바지', 'navy', 'thin', FALSE),
  (@dev_member_id, 'completed', UTC_TIMESTAMP(), 'dev-seed/22.png', 'shoes', NULL, '블랙 더비슈즈', 'black', NULL, FALSE),
  (@dev_member_id, 'completed', UTC_TIMESTAMP(), 'dev-seed/23.png', 'shoes', NULL, '화이트 스니커즈', 'white', NULL, FALSE),
  (@dev_member_id, 'completed', UTC_TIMESTAMP(), 'dev-seed/24.png', 'shoes', NULL, '브라운 로퍼', 'brown', NULL, FALSE),
  (@dev_member_id, 'completed', UTC_TIMESTAMP(), 'dev-seed/25.png', 'shoes', NULL, '블랙 레인부츠', 'black', NULL, TRUE),
  (@dev_member_id, 'completed', UTC_TIMESTAMP(), 'dev-seed/26.png', 'shoes', NULL, '브라운 워커 부츠', 'brown', NULL, FALSE),
  (@dev_member_id, 'completed', UTC_TIMESTAMP(), 'dev-seed/27.png', 'socks', NULL, '블랙 크루삭스', 'black', 'thin', FALSE),
  (@dev_member_id, 'completed', UTC_TIMESTAMP(), 'dev-seed/28.png', 'accessories', 'bag', '블랙 토트백', 'black', NULL, FALSE),
  (@dev_member_id, 'completed', UTC_TIMESTAMP(), 'dev-seed/29.png', 'accessories', 'watch', '실버 손목시계', 'gray', NULL, FALSE),
  (@dev_member_id, 'completed', UTC_TIMESTAMP(), 'dev-seed/30.png', 'accessories', 'scarf', '그레이 머플러', 'gray', 'medium', FALSE);


INSERT INTO clothing_style (clothing_id, style_cd)
SELECT c.clothing_id, t.style_cd
FROM clothing c
JOIN (
            SELECT 'dev-seed/01.png' AS origin_image_url, 'classic' AS style_cd
  UNION ALL SELECT 'dev-seed/01.png', 'minimal'
  UNION ALL SELECT 'dev-seed/02.png', 'classic'
  UNION ALL SELECT 'dev-seed/02.png', 'formal'
  UNION ALL SELECT 'dev-seed/03.png', 'casual'
  UNION ALL SELECT 'dev-seed/03.png', 'sporty'
  UNION ALL SELECT 'dev-seed/04.png', 'minimal'
  UNION ALL SELECT 'dev-seed/04.png', 'classic'
  UNION ALL SELECT 'dev-seed/05.png', 'sporty'
  UNION ALL SELECT 'dev-seed/05.png', 'casual'
  UNION ALL SELECT 'dev-seed/06.png', 'casual'
  UNION ALL SELECT 'dev-seed/06.png', 'vintage'
  UNION ALL SELECT 'dev-seed/07.png', 'classic'
  UNION ALL SELECT 'dev-seed/07.png', 'minimal'
  UNION ALL SELECT 'dev-seed/08.png', 'classic'
  UNION ALL SELECT 'dev-seed/08.png', 'minimal'
  UNION ALL SELECT 'dev-seed/09.png', 'casual'
  UNION ALL SELECT 'dev-seed/09.png', 'minimal'
  UNION ALL SELECT 'dev-seed/10.png', 'minimal'
  UNION ALL SELECT 'dev-seed/10.png', 'casual'
  UNION ALL SELECT 'dev-seed/11.png', 'minimal'
  UNION ALL SELECT 'dev-seed/11.png', 'casual'
  UNION ALL SELECT 'dev-seed/12.png', 'romantic'
  UNION ALL SELECT 'dev-seed/12.png', 'casual'
  UNION ALL SELECT 'dev-seed/13.png', 'street'
  UNION ALL SELECT 'dev-seed/13.png', 'casual'
  UNION ALL SELECT 'dev-seed/14.png', 'romantic'
  UNION ALL SELECT 'dev-seed/14.png', 'feminine'
  UNION ALL SELECT 'dev-seed/15.png', 'casual'
  UNION ALL SELECT 'dev-seed/15.png', 'preppy'
  UNION ALL SELECT 'dev-seed/16.png', 'minimal'
  UNION ALL SELECT 'dev-seed/16.png', 'formal'
  UNION ALL SELECT 'dev-seed/17.png', 'minimal'
  UNION ALL SELECT 'dev-seed/17.png', 'formal'
  UNION ALL SELECT 'dev-seed/18.png', 'casual'
  UNION ALL SELECT 'dev-seed/18.png', 'vintage'
  UNION ALL SELECT 'dev-seed/19.png', 'sporty'
  UNION ALL SELECT 'dev-seed/19.png', 'casual'
  UNION ALL SELECT 'dev-seed/20.png', 'street'
  UNION ALL SELECT 'dev-seed/21.png', 'casual'
  UNION ALL SELECT 'dev-seed/22.png', 'formal'
  UNION ALL SELECT 'dev-seed/22.png', 'classic'
  UNION ALL SELECT 'dev-seed/23.png', 'casual'
  UNION ALL SELECT 'dev-seed/23.png', 'minimal'
  UNION ALL SELECT 'dev-seed/24.png', 'classic'
  UNION ALL SELECT 'dev-seed/24.png', 'preppy'
  UNION ALL SELECT 'dev-seed/25.png', 'casual'
  UNION ALL SELECT 'dev-seed/26.png', 'street'
  UNION ALL SELECT 'dev-seed/26.png', 'vintage'
  UNION ALL SELECT 'dev-seed/27.png', 'minimal'
  UNION ALL SELECT 'dev-seed/28.png', 'minimal'
  UNION ALL SELECT 'dev-seed/29.png', 'classic'
  UNION ALL SELECT 'dev-seed/29.png', 'minimal'
  UNION ALL SELECT 'dev-seed/30.png', 'casual'
) t ON t.origin_image_url = c.origin_image_url
WHERE c.member_id = @dev_member_id;


INSERT INTO clothing_season (clothing_id, season_cd)
SELECT c.clothing_id, t.season_cd
FROM clothing c
JOIN (
            SELECT 'dev-seed/01.png' AS origin_image_url, 'spring' AS season_cd
  UNION ALL SELECT 'dev-seed/01.png', 'fall'
  UNION ALL SELECT 'dev-seed/02.png', 'spring'
  UNION ALL SELECT 'dev-seed/02.png', 'fall'
  UNION ALL SELECT 'dev-seed/02.png', 'winter'
  UNION ALL SELECT 'dev-seed/03.png', 'winter'
  UNION ALL SELECT 'dev-seed/04.png', 'winter'
  UNION ALL SELECT 'dev-seed/05.png', 'spring'
  UNION ALL SELECT 'dev-seed/05.png', 'fall'
  UNION ALL SELECT 'dev-seed/06.png', 'spring'
  UNION ALL SELECT 'dev-seed/06.png', 'fall'
  UNION ALL SELECT 'dev-seed/07.png', 'spring'
  UNION ALL SELECT 'dev-seed/07.png', 'summer'
  UNION ALL SELECT 'dev-seed/08.png', 'spring'
  UNION ALL SELECT 'dev-seed/08.png', 'summer'
  UNION ALL SELECT 'dev-seed/08.png', 'fall'
  UNION ALL SELECT 'dev-seed/09.png', 'summer'
  UNION ALL SELECT 'dev-seed/10.png', 'summer'
  UNION ALL SELECT 'dev-seed/11.png', 'fall'
  UNION ALL SELECT 'dev-seed/11.png', 'winter'
  UNION ALL SELECT 'dev-seed/12.png', 'winter'
  UNION ALL SELECT 'dev-seed/13.png', 'spring'
  UNION ALL SELECT 'dev-seed/13.png', 'fall'
  UNION ALL SELECT 'dev-seed/13.png', 'winter'
  UNION ALL SELECT 'dev-seed/14.png', 'spring'
  UNION ALL SELECT 'dev-seed/14.png', 'summer'
  UNION ALL SELECT 'dev-seed/15.png', 'spring'
  UNION ALL SELECT 'dev-seed/15.png', 'fall'
  UNION ALL SELECT 'dev-seed/16.png', 'spring'
  UNION ALL SELECT 'dev-seed/16.png', 'fall'
  UNION ALL SELECT 'dev-seed/16.png', 'winter'
  UNION ALL SELECT 'dev-seed/17.png', 'summer'
  UNION ALL SELECT 'dev-seed/18.png', 'spring'
  UNION ALL SELECT 'dev-seed/18.png', 'fall'
  UNION ALL SELECT 'dev-seed/19.png', 'winter'
  UNION ALL SELECT 'dev-seed/20.png', 'spring'
  UNION ALL SELECT 'dev-seed/20.png', 'fall'
  UNION ALL SELECT 'dev-seed/21.png', 'summer'
  UNION ALL SELECT 'dev-seed/22.png', 'spring'
  UNION ALL SELECT 'dev-seed/22.png', 'summer'
  UNION ALL SELECT 'dev-seed/22.png', 'fall'
  UNION ALL SELECT 'dev-seed/23.png', 'spring'
  UNION ALL SELECT 'dev-seed/23.png', 'summer'
  UNION ALL SELECT 'dev-seed/23.png', 'fall'
  UNION ALL SELECT 'dev-seed/24.png', 'spring'
  UNION ALL SELECT 'dev-seed/24.png', 'summer'
  UNION ALL SELECT 'dev-seed/24.png', 'fall'
  UNION ALL SELECT 'dev-seed/25.png', 'spring'
  UNION ALL SELECT 'dev-seed/25.png', 'summer'
  UNION ALL SELECT 'dev-seed/25.png', 'fall'
  UNION ALL SELECT 'dev-seed/26.png', 'fall'
  UNION ALL SELECT 'dev-seed/26.png', 'winter'
  UNION ALL SELECT 'dev-seed/27.png', 'spring'
  UNION ALL SELECT 'dev-seed/27.png', 'summer'
  UNION ALL SELECT 'dev-seed/27.png', 'fall'
  UNION ALL SELECT 'dev-seed/27.png', 'winter'
  UNION ALL SELECT 'dev-seed/28.png', 'spring'
  UNION ALL SELECT 'dev-seed/28.png', 'summer'
  UNION ALL SELECT 'dev-seed/28.png', 'fall'
  UNION ALL SELECT 'dev-seed/28.png', 'winter'
  UNION ALL SELECT 'dev-seed/29.png', 'spring'
  UNION ALL SELECT 'dev-seed/29.png', 'summer'
  UNION ALL SELECT 'dev-seed/29.png', 'fall'
  UNION ALL SELECT 'dev-seed/29.png', 'winter'
  UNION ALL SELECT 'dev-seed/30.png', 'winter'
) t ON t.origin_image_url = c.origin_image_url
WHERE c.member_id = @dev_member_id;
