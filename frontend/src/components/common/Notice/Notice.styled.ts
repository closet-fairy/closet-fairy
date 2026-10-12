import type { SerializedStyles } from '@emotion/react';
import { css } from '@emotion/react';
import styled from '@emotion/styled';
import { bg, border, fg, radius, spacing, typography } from '@/styles/tokens';
import type { NoticeVariant } from './Notice';

const CONTAINER_STYLE: Record<NoticeVariant, SerializedStyles> = {
  banner: css`
    padding: ${spacing[14]};
    border: 1px solid ${border.neutral.default};
    border-radius: ${radius.md};
    background-color: ${bg.neutral.pale};
  `,
  subtle: css`
    padding: ${spacing[12]} ${spacing[14]};
    border-radius: ${radius.sm};
    background-color: ${bg.neutral.light};
  `,
};

const TITLE_TYPOGRAPHY: Record<NoticeVariant, SerializedStyles> = {
  banner: typography.body3Strong,
  subtle: typography.label1Strong,
};

const DESCRIPTION_TYPOGRAPHY: Record<NoticeVariant, SerializedStyles> = {
  banner: typography.label1,
  subtle: typography.caption1,
};

export const Container = styled.div<{ $variant: NoticeVariant }>`
  width: 100%;
  ${({ $variant }) => CONTAINER_STYLE[$variant]}
`;

export const Main = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${spacing[8]};
`;

/*
 * 아이콘을 제목 첫 줄의 세로 가운데에 맞추려고 제목과 같은 글자 스타일을 주고 높이를 1lh로 잡는다.
 * 제목이 여러 줄이 되어도 아이콘은 첫 줄 옆에 남는다.
 */
export const IconWrapper = styled.span<{ $variant: NoticeVariant }>`
  ${({ $variant }) => TITLE_TYPOGRAPHY[$variant]}
  display: flex;
  flex: none;
  align-items: center;
  height: 1lh;
  color: ${fg.neutral.strong};
`;

export const Text = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${spacing[4]};
  min-width: 0;
`;

export const Title = styled.p<{ $variant: NoticeVariant }>`
  ${({ $variant }) => TITLE_TYPOGRAPHY[$variant]}
  color: ${({ $variant }) =>
    $variant === 'banner' ? fg.neutral.strong : fg.neutral.default};
`;

export const Description = styled.p<{ $variant: NoticeVariant }>`
  ${({ $variant }) => DESCRIPTION_TYPOGRAPHY[$variant]}
  color: ${fg.neutral.soft};
`;

export const Action = styled.div`
  display: flex;
  flex-direction: column;
  margin-top: ${spacing[12]};
`;
