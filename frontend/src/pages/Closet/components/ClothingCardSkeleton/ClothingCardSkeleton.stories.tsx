import styled from '@emotion/styled';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { spacing } from '@/styles/tokens';
import { FIRST_LOAD_SKELETON_COUNT, GRID_COLUMN_COUNT } from '../../constants';
import ClothingCardSkeleton from './ClothingCardSkeleton';

const CARD_WIDTH = 112;

const meta = {
  component: ClothingCardSkeleton,
  argTypes: {
    column: {
      description:
        '3열 격자에서 이 칸의 열 번호입니다. 열과 행을 더한 값 × 90ms만큼 늦게 빛이 지나가서, 빛이 격자를 한 번에 훑는 것처럼 보입니다.',
      control: { type: 'number', min: 0, max: GRID_COLUMN_COUNT - 1 },
    },
    row: {
      description:
        '첫 스켈레톤 줄을 0으로 센 행 번호입니다. 줄이 아래로 갈수록 빛이 늦게 지나갑니다.',
      control: { type: 'number', min: 0 },
    },
  },
  args: { column: 0, row: 0 },
} satisfies Meta<typeof ClothingCardSkeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: CARD_WIDTH }}>
        <Story />
      </div>
    ),
  ],
};

export const Grid: Story = {
  decorators: [
    (Story) => (
      <GridList>
        <Story />
      </GridList>
    ),
  ],
  render: () => (
    <>
      {Array.from({ length: FIRST_LOAD_SKELETON_COUNT }, (_, index) => (
        <li key={index}>
          <ClothingCardSkeleton
            column={index % GRID_COLUMN_COUNT}
            row={Math.floor(index / GRID_COLUMN_COUNT)}
          />
        </li>
      ))}
    </>
  ),
};

const GridList = styled.ul`
  display: grid;
  grid-template-columns: repeat(${GRID_COLUMN_COUNT}, ${CARD_WIDTH}px);
  gap: ${spacing[14]} ${spacing[8]};
`;
