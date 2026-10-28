import styled from '@emotion/styled';

// 사진 고르기 창과 카메라는 시트의 [갤러리에서 선택]·[사진 촬영]으로만 열므로 입력은 화면에 그리지 않는다.
export const HiddenInput = styled.input`
  display: none;
`;
