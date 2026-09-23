INSERT INTO member (provider_cd, provider_user_id_enc, provider_user_id_hash, nickname, created_at)
VALUES (
  'google',
  _binary 'DEV-PLACEHOLDER-NOT-ENCRYPTED',
  UNHEX(SHA2('dev-google-0001', 256)),
  '개발테스터',
  UTC_TIMESTAMP()
);

SET @dev_member_id = LAST_INSERT_ID();


INSERT INTO member_setting
  (member_id, temperature_sensitivity_cd, birth_year, gender_cd, onboarded_at)
VALUES (
  @dev_member_id,
  'heat_sensitive',
  1999,
  'unspecified',
  UTC_TIMESTAMP()
);


INSERT INTO member_setting_style (member_id, style_cd) VALUES
  (@dev_member_id, 'minimal'),
  (@dev_member_id, 'casual');


INSERT INTO preference_score (member_id, attribute_type_cd, attribute_value)
SELECT @dev_member_id, 'style', style_cd FROM style
UNION ALL
SELECT @dev_member_id, 'color', color_cd FROM color;


UPDATE preference_score ps
JOIN member_setting_style mss
  ON mss.member_id = ps.member_id
 AND mss.style_cd  = ps.attribute_value
SET ps.score            = 5.00,
    ps.initial_bonus_at = UTC_TIMESTAMP()
WHERE ps.member_id         = @dev_member_id
  AND ps.attribute_type_cd = 'style';