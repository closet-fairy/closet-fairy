import styled from '@emotion/styled';

// 사진 고르기 창과 카메라는 시트와 촬영 미리보기의 버튼으로만 열므로 입력은 화면에 그리지 않는다.
export const HiddenInput = styled.input`
  display: none;
`;
