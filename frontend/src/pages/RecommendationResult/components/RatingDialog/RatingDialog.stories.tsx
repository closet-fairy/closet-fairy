import type { Meta, StoryObj } from '@storybook/react-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import RatingDialog from './RatingDialog';

const meta = {
  component: RatingDialog,
  parameters: { docs: { story: { inline: false, height: '400px' } } },
  argTypes: {
    isOpen: { description: '모달이 열려 있는지입니다.' },
    rating: {
      description: '고른 별점입니다. 0이면 아직 고르지 않은 상태입니다.',
    },
    isSubmitting: { description: '별점을 보내는 중인지입니다.' },
    onRatingChange: { description: '별을 고르면 호출됩니다.' },
    onSubmit: { description: '[채택하기]를 누르면 호출됩니다.' },
    onClose: { description: '[다시 볼게요]를 누르면 호출됩니다.' },
    finalFocus: { description: '닫힌 뒤 포커스를 돌려줄 요소입니다.' },
  },
  args: {
    isOpen: true,
    rating: 0,
    isSubmitting: false,
    onRatingChange: fn(),
    onSubmit: fn(),
    onClose: fn(),
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs();

    return (
      <RatingDialog
        {...args}
        onRatingChange={(rating) => updateArgs({ rating })}
      />
    );
  },
} satisfies Meta<typeof RatingDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Rated: Story = {
  args: { rating: 4 },
};

export const Submitting: Story = {
  args: { rating: 4, isSubmitting: true },
};
