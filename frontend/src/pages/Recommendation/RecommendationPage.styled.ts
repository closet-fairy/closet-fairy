import styled from '@emotion/styled';
import { fg, spacing } from '@/styles/tokens';
import { visuallyHidden } from '@/styles/visuallyHidden';

export const ShortageStatus = styled.p`
  ${visuallyHidden}
`;

export const Container = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
`;

export const Form = styled.form`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${spacing[24]};
  padding: ${spacing[6]} ${spacing[20]} ${spacing[16]};
`;

export const Fields = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[24]};
`;

export const TimeRow = styled.div`
  display: flex;
  gap: ${spacing[10]};
  align-items: center;
  color: ${fg.neutral.pale};
`;

export const TimePicker = styled.div`
  flex: 1;
  min-width: 0;
`;

export const Footer = styled.div`
  display: flex;
  flex-direction: column;
  margin-top: auto;
`;

// 알림 영역은 비어 있어도 늘 두어야 내용이 채워질 때 읽히므로, 간격은 내용이 있을 때만 준다.
export const Alert = styled.div`
  &:not(:empty) {
    margin-bottom: ${spacing[12]};
  }
`;
