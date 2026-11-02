-- 파일만 따로 적용할 때도 한글 이름이 깨지지 않게 지정한다
SET NAMES utf8mb4;

UPDATE essential_item e
JOIN (
            SELECT '베이지 가디건' AS item_name, 'essential/beige-cardigan.webp' AS image_url
  UNION ALL SELECT '블랙 트렌치코트',          'essential/black-trench-coat.webp'
  UNION ALL SELECT '네이비 블레이저',          'essential/navy-blazer.webp'
  UNION ALL SELECT '차콜 울코트',              'essential/charcoal-wool-coat.webp'
  UNION ALL SELECT '네이비 패딩 점퍼',         'essential/navy-padded-jacket.webp'
  UNION ALL SELECT '네이비 바람막이',          'essential/navy-windbreaker.webp'
  UNION ALL SELECT '카키 후드집업',            'essential/khaki-hood-zipup.webp'
  UNION ALL SELECT '화이트 베이직 셔츠',       'essential/white-basic-shirt.webp'
  UNION ALL SELECT '라이트블루 옥스포드 셔츠', 'essential/lightblue-oxford-shirt.webp'
  UNION ALL SELECT '화이트 반팔 티셔츠',       'essential/white-short-sleeve-tshirt.webp'
  UNION ALL SELECT '그레이 라운드 니트',       'essential/gray-round-knit.webp'
  UNION ALL SELECT '네이비 맨투맨',            'essential/navy-sweatshirt.webp'
  UNION ALL SELECT '블랙 기능성 티셔츠',       'essential/black-active-tshirt.webp'
  UNION ALL SELECT '블랙 슬랙스',              'essential/black-slacks.webp'
  UNION ALL SELECT '차콜 울 슬랙스',           'essential/charcoal-wool-slacks.webp'
  UNION ALL SELECT '베이지 치노 팬츠',         'essential/beige-chino-pants.webp'
  UNION ALL SELECT '인디고 데님 팬츠',         'essential/indigo-denim-pants.webp'
  UNION ALL SELECT '그레이 반바지',            'essential/gray-shorts.webp'
  UNION ALL SELECT '블랙 트레이닝 팬츠',       'essential/black-training-pants.webp'
  UNION ALL SELECT '화이트 스니커즈',          'essential/white-sneakers.webp'
  UNION ALL SELECT '블랙 로퍼',                'essential/black-loafers.webp'
  UNION ALL SELECT '블랙 첼시부츠',            'essential/black-chelsea-boots.webp'
  UNION ALL SELECT '블랙 러닝화',              'essential/black-running-shoes.webp'
  UNION ALL SELECT '방수 앵클부츠',            'essential/waterproof-ankle-boots.webp'
  UNION ALL SELECT '네이비 반팔 피케 폴로',    'essential/navy-pique-polo.webp'
  UNION ALL SELECT '베이지 린넨 반팔 셔츠',    'essential/beige-linen-short-sleeve-shirt.webp'
  UNION ALL SELECT '라이트그레이 린넨 슬랙스', 'essential/lightgray-linen-slacks.webp'
  UNION ALL SELECT '카키 치노 반바지',         'essential/khaki-chino-shorts.webp'
  UNION ALL SELECT '브라운 페니 로퍼',         'essential/brown-penny-loafers.webp'
  UNION ALL SELECT '화이트 발목 양말',         'essential/white-ankle-socks.webp'
  UNION ALL SELECT '블랙 정장 양말',           'essential/black-dress-socks.webp'
  UNION ALL SELECT '그레이 스포츠 양말',       'essential/gray-sports-socks.webp'
  UNION ALL SELECT '차콜 울 양말',             'essential/charcoal-wool-socks.webp'
  UNION ALL SELECT '블랙 가죽 벨트',           'essential/black-leather-belt.webp'
  UNION ALL SELECT '차콜 머플러',              'essential/charcoal-muffler.webp'
) m ON m.item_name = e.item_name
SET e.image_url = m.image_url;
