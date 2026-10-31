ALTER TABLE color
  COMMENT='색상 마스터 16종 (E-1)',
  DROP CHECK ck_color_color_cd,
  ADD CONSTRAINT ck_color_color_cd CHECK (color_cd IN
    ('black','white','gray','beige','brown','navy','blue',
     'sky_blue','green','khaki','yellow','orange','red','pink',
     'burgundy','purple'));

ALTER TABLE clothing
  DROP CHECK ck_clothing_color_cd,
  ADD CONSTRAINT ck_clothing_color_cd
    CHECK (color_cd IN ('black','white','gray','beige','brown','navy','blue',
                        'sky_blue','green','khaki','yellow','orange','red','pink',
                        'burgundy','purple'));

ALTER TABLE essential_item
  DROP CHECK ck_essential_item_color_cd,
  ADD CONSTRAINT ck_essential_item_color_cd CHECK (color_cd IN
    ('black','white','gray','beige','brown','navy','blue',
     'sky_blue','green','khaki','yellow','orange','red','pink',
     'burgundy','purple'));

INSERT INTO color (color_cd, color_nm, hex_code, display_seq) VALUES
  ('burgundy', '버건디', '#7A1F2B', 15),
  ('purple',   '퍼플',   '#7B4FA0', 16);

ALTER TABLE preference_score
  COMMENT='회원별 속성 선호도. S/N 보관, 선호도는 조회 시 계산. 가입 시 29행 (E-3)';

INSERT INTO preference_score (member_id, attribute_type_cd, attribute_value)
SELECT m.member_id, 'color', c.color_cd
FROM member m
CROSS JOIN color c
WHERE c.color_cd IN ('burgundy', 'purple')
  AND NOT EXISTS (
    SELECT 1 FROM preference_score p
    WHERE p.member_id = m.member_id
      AND p.attribute_type_cd = 'color'
      AND p.attribute_value = c.color_cd
  );
