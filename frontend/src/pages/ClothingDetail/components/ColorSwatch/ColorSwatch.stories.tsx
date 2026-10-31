import type { Meta, StoryObj } from '@storybook/react-vite';
import StoryStack from '../../../../../.storybook/StoryStack';
import { CLOTHING_COLORS } from '@/constants/clothingAttribute';
import ColorSwatch from './ColorSwatch';

const meta = {
  component: ColorSwatch,
  argTypes: {
    color: {
      description:
        '옷 색 코드입니다. 16색마다 정한 대표색으로 칠하고, 흰색도 보이도록 옅은 테두리를 두릅니다.',
      control: 'select',
      options: CLOTHING_COLORS,
    },
  },
  args: {
    color: 'beige',
  },
} satisfies Meta<typeof ColorSwatch>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const White: Story = {
  args: { color: 'white' },
};

export const AllColors: Story = {
  render: () => (
    <StoryStack gap={8}>
      {CLOTHING_COLORS.map((color) => (
        <ColorSwatch key={color} color={color} />
      ))}
    </StoryStack>
  ),
};
