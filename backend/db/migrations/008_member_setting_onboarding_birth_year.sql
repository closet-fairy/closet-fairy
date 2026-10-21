ALTER TABLE member_setting
  DROP CHECK ck_member_setting_onboarded,
  ADD CONSTRAINT ck_member_setting_onboarded
    CHECK (onboarded_at IS NULL OR birth_year IS NOT NULL);
