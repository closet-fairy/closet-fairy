import { css } from '@emotion/react';
import styled from '@emotion/styled';
import { bg, border, fg, opacity, spacing, typography } from '@/styles/tokens';

// 사진이 남는 높이를 다 쓰되, 그 아래 사유 문구는 첫 화면 안에 남도록 세로로 나눈다.
export const Body = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

export const Preview = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
  background-color: ${bg.neutral.light};
`;

export const Image = styled.img`
  position: absolute;
  inset: ${spacing[20]};
  width: calc(100% - ${spacing[40]});
  height: calc(100% - ${spacing[40]});
  object-fit: contain;
`;

export const Placeholder = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${spacing[8]};
  color: ${fg.neutral.pale};
`;

export const FileName = styled.span`
  ${typography.label1}
  color: ${fg.neutral.light};
`;

export const RejectMessage = styled.p`
  ${typography.label1}
  flex: none;
  padding-top: ${spacing[12]};
  color: ${fg.error.default};
`;

export const Answers = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[10]};
`;

export const Question = styled.p<{ $isDimmed?: boolean }>`
  ${typography.body3Strong}
  color: ${fg.neutral.strong};

  ${({ $isDimmed }) =>
    $isDimmed &&
    css`
      opacity: ${opacity.disabled};
    `}
`;

export const Choices = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${spacing[8]};
`;

export const AnswerResult = styled.p`
  ${typography.label1}
  min-height: 1lh;
  color: ${fg.neutral.light};
`;

export const Divider = styled.hr`
  margin: ${spacing[4]} 0;
  border: none;
  border-top: 1px solid ${border.neutral.soft};
`;
