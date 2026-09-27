INSERT INTO essential_item
  (item_name, category_cd, accessory_type_cd, style_cd, color_cd,
   thickness_cd, is_waterproof, formality_level, gender_cd, image_url, is_active)
VALUES
  -- 아우터 7
  ('베이지 가디건',            'outer',       NULL,    'casual',  'beige',    'thin',   FALSE, 2, 'unisex', NULL, TRUE),
  ('블랙 트렌치코트',          'outer',       NULL,    'minimal', 'black',    'medium', FALSE, 3, 'unisex', NULL, TRUE),
  ('네이비 블레이저',          'outer',       NULL,    'classic', 'navy',     'medium', FALSE, 4, 'unisex', NULL, TRUE),
  ('차콜 울코트',              'outer',       NULL,    'classic', 'gray',     'thick',  FALSE, 4, 'unisex', NULL, TRUE),
  ('네이비 패딩 점퍼',         'outer',       NULL,    'casual',  'navy',     'thick',  FALSE, 1, 'unisex', NULL, TRUE),
  ('네이비 바람막이',          'outer',       NULL,    'sporty',  'navy',     'thin',   TRUE,  1, 'unisex', NULL, TRUE),
  ('카키 후드집업',            'outer',       NULL,    'casual',  'khaki',    'medium', FALSE, 1, 'unisex', NULL, TRUE),

  -- 상의 6
  ('화이트 베이직 셔츠',       'top',         NULL,    'formal',  'white',    'thin',   FALSE, 5, 'unisex', NULL, TRUE),
  ('라이트블루 옥스포드 셔츠', 'top',         NULL,    'preppy',  'sky_blue', 'thin',   FALSE, 3, 'unisex', NULL, TRUE),
  ('화이트 반팔 티셔츠',       'top',         NULL,    'casual',  'white',    'thin',   FALSE, 1, 'unisex', NULL, TRUE),
  ('그레이 라운드 니트',       'top',         NULL,    'casual',  'gray',     'medium', FALSE, 2, 'unisex', NULL, TRUE),
  ('네이비 맨투맨',            'top',         NULL,    'casual',  'navy',     'medium', FALSE, 1, 'unisex', NULL, TRUE),
  ('블랙 기능성 티셔츠',       'top',         NULL,    'sporty',  'black',    'thin',   FALSE, 1, 'unisex', NULL, TRUE),

  -- 하의 6
  ('블랙 슬랙스',              'bottom',      NULL,    'formal',  'black',    'medium', FALSE, 5, 'unisex', NULL, TRUE),
  ('차콜 울 슬랙스',           'bottom',      NULL,    'classic', 'gray',     'thick',  FALSE, 4, 'unisex', NULL, TRUE),
  ('베이지 치노 팬츠',         'bottom',      NULL,    'preppy',  'beige',    'medium', FALSE, 3, 'unisex', NULL, TRUE),
  ('인디고 데님 팬츠',         'bottom',      NULL,    'casual',  'blue',     'medium', FALSE, 1, 'unisex', NULL, TRUE),
  ('그레이 반바지',            'bottom',      NULL,    'casual',  'gray',     'thin',   FALSE, 1, 'unisex', NULL, TRUE),
  ('블랙 트레이닝 팬츠',       'bottom',      NULL,    'sporty',  'black',    'medium', FALSE, 1, 'unisex', NULL, TRUE),

  -- 신발 5
  ('화이트 스니커즈',          'shoes',       NULL,    'casual',  'white',    NULL,     FALSE, 1, 'unisex', NULL, TRUE),
  ('블랙 로퍼',                'shoes',       NULL,    'formal',  'black',    NULL,     FALSE, 5, 'unisex', NULL, TRUE),
  ('블랙 첼시부츠',            'shoes',       NULL,    'minimal', 'black',    NULL,     FALSE, 3, 'unisex', NULL, TRUE),
  ('블랙 러닝화',              'shoes',       NULL,    'sporty',  'black',    NULL,     FALSE, 1, 'unisex', NULL, TRUE),
  ('방수 앵클부츠',            'shoes',       NULL,    'casual',  'black',    NULL,     TRUE,  2, 'unisex', NULL, TRUE),

  -- 양말 4
  ('화이트 발목 양말',         'socks',       NULL,    'casual',  'white',    'thin',   FALSE, 1, 'unisex', NULL, TRUE),
  ('블랙 정장 양말',           'socks',       NULL,    'formal',  'black',    'thin',   FALSE, 5, 'unisex', NULL, TRUE),
  ('그레이 스포츠 양말',       'socks',       NULL,    'sporty',  'gray',     'medium', FALSE, 1, 'unisex', NULL, TRUE),
  ('차콜 울 양말',             'socks',       NULL,    'casual',  'gray',     'thick',  FALSE, 2, 'unisex', NULL, TRUE),

  -- 악세서리 2
  ('블랙 가죽 벨트',           'accessories', 'belt',  'formal',  'black',    NULL,     FALSE, 5, 'unisex', NULL, TRUE),
  ('차콜 머플러',              'accessories', 'scarf', 'casual',  'gray',     NULL,     FALSE, 2, 'unisex', NULL, TRUE);

INSERT INTO essential_item_season (essential_item_id, season_cd)
SELECT e.essential_item_id, s.season_cd
FROM essential_item e
JOIN (
  -- 아우터
            SELECT '베이지 가디건' AS item_name, 'spring' AS season_cd
  UNION ALL SELECT '베이지 가디건',            'fall'
  UNION ALL SELECT '블랙 트렌치코트',          'spring'
  UNION ALL SELECT '블랙 트렌치코트',          'fall'
  UNION ALL SELECT '네이비 블레이저',          'spring'
  UNION ALL SELECT '네이비 블레이저',          'fall'
  UNION ALL SELECT '차콜 울코트',              'winter'
  UNION ALL SELECT '네이비 패딩 점퍼',         'winter'
  UNION ALL SELECT '네이비 바람막이',          'spring'
  UNION ALL SELECT '네이비 바람막이',          'fall'
  UNION ALL SELECT '카키 후드집업',            'spring'
  UNION ALL SELECT '카키 후드집업',            'fall'

  -- 상의
  UNION ALL SELECT '화이트 베이직 셔츠',       'spring'
  UNION ALL SELECT '화이트 베이직 셔츠',       'summer'
  UNION ALL SELECT '화이트 베이직 셔츠',       'fall'
  UNION ALL SELECT '라이트블루 옥스포드 셔츠', 'spring'
  UNION ALL SELECT '라이트블루 옥스포드 셔츠', 'fall'
  UNION ALL SELECT '화이트 반팔 티셔츠',       'summer'
  UNION ALL SELECT '그레이 라운드 니트',       'fall'
  UNION ALL SELECT '그레이 라운드 니트',       'winter'
  UNION ALL SELECT '네이비 맨투맨',            'spring'
  UNION ALL SELECT '네이비 맨투맨',            'fall'
  UNION ALL SELECT '블랙 기능성 티셔츠',       'summer'

  -- 하의
  UNION ALL SELECT '블랙 슬랙스',              'spring'
  UNION ALL SELECT '블랙 슬랙스',              'fall'
  UNION ALL SELECT '차콜 울 슬랙스',           'winter'
  UNION ALL SELECT '베이지 치노 팬츠',         'spring'
  UNION ALL SELECT '베이지 치노 팬츠',         'fall'
  UNION ALL SELECT '인디고 데님 팬츠',         'spring'
  UNION ALL SELECT '인디고 데님 팬츠',         'fall'
  UNION ALL SELECT '그레이 반바지',            'summer'
  UNION ALL SELECT '블랙 트레이닝 팬츠',       'spring'
  UNION ALL SELECT '블랙 트레이닝 팬츠',       'fall'

  -- 신발
  UNION ALL SELECT '화이트 스니커즈',          'spring'
  UNION ALL SELECT '화이트 스니커즈',          'summer'
  UNION ALL SELECT '화이트 스니커즈',          'fall'
  UNION ALL SELECT '블랙 로퍼',                'spring'
  UNION ALL SELECT '블랙 로퍼',                'fall'
  UNION ALL SELECT '블랙 첼시부츠',            'spring'   -- 작업 지시로 추가
  UNION ALL SELECT '블랙 첼시부츠',            'fall'
  UNION ALL SELECT '블랙 첼시부츠',            'winter'
  UNION ALL SELECT '블랙 러닝화',              'spring'
  UNION ALL SELECT '블랙 러닝화',              'summer'
  UNION ALL SELECT '블랙 러닝화',              'fall'
  UNION ALL SELECT '블랙 러닝화',              'winter'
  UNION ALL SELECT '방수 앵클부츠',            'spring'
  UNION ALL SELECT '방수 앵클부츠',            'summer'
  UNION ALL SELECT '방수 앵클부츠',            'fall'
  UNION ALL SELECT '방수 앵클부츠',            'winter'

  -- 양말
  UNION ALL SELECT '화이트 발목 양말',         'spring'
  UNION ALL SELECT '화이트 발목 양말',         'summer'
  UNION ALL SELECT '화이트 발목 양말',         'fall'
  UNION ALL SELECT '블랙 정장 양말',           'spring'
  UNION ALL SELECT '블랙 정장 양말',           'summer'
  UNION ALL SELECT '블랙 정장 양말',           'fall'
  UNION ALL SELECT '블랙 정장 양말',           'winter'
  UNION ALL SELECT '그레이 스포츠 양말',       'spring'
  UNION ALL SELECT '그레이 스포츠 양말',       'summer'
  UNION ALL SELECT '그레이 스포츠 양말',       'fall'
  UNION ALL SELECT '그레이 스포츠 양말',       'winter'
  UNION ALL SELECT '차콜 울 양말',             'winter'

  -- 악세서리
  UNION ALL SELECT '블랙 가죽 벨트',           'spring'
  UNION ALL SELECT '블랙 가죽 벨트',           'summer'
  UNION ALL SELECT '블랙 가죽 벨트',           'fall'
  UNION ALL SELECT '블랙 가죽 벨트',           'winter'
  UNION ALL SELECT '차콜 머플러',              'winter'
) s ON s.item_name = e.item_name;