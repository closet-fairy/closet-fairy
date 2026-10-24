ALTER TABLE clothing_edit
  ADD COLUMN display_image_url TEXT NULL
    COMMENT '편집을 모두 적용한 표시 이미지 경로. NULL = 없음(배경 제거본을 보여줌)'
    AFTER brush_mask_url;
