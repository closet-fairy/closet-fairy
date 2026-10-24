ALTER TABLE recommendation_session
  DROP CHECK ck_recommendation_session_tpo_cd,
  ADD CONSTRAINT ck_recommendation_session_tpo_cd CHECK (
    tpo_cd IN ('daily','work','formal','exercise','rainy','midwinter','date','custom'));
