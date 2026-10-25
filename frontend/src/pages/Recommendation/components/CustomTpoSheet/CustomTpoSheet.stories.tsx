import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import useStoryOpenState from '../../../../../.storybook/useStoryOpenState';
import Button from '@/components/common/Button';
import CustomTpoSheet from './CustomTpoSheet';

const meta = {
  component: CustomTpoSheet,
  argTypes: {
    isOpen: {
      description:
        '시트가 열려 있는지 정합니다. 제어형이라 닫힘 요청은 `onOpenChange`로 받아 다시 넘겨야 합니다.',
      control: 'boolean',
    },
    onOpenChange: {
      description:
        '딤 터치, 끌어내리기, Esc로 닫으려 할 때 `false`를 받아 호출합니다. 설정하지 않고 닫으면 고치던 문구는 버립니다.',
    },
    initialText: {
      description:
        '시트가 열릴 때 입력란에 채워 둘 문구입니다. 이미 설정한 문구를 고칠 때 넘깁니다.',
      control: 'text',
    },
    onSubmit: {
      description:
        '[이 상황으로 설정]이나 Enter를 누르면 앞뒤 공백을 지운 문구를 넘겨 호출합니다. 문구가 비었거나 글자 수를 넘으면 호출하지 않습니다.',
    },
  },
  args: {
    isOpen: true,
    onOpenChange: fn(),
    initialText: '',
    onSubmit: fn(),
  },
  parameters: {
    layout: 'fullscreen',
    docs: { story: { inline: false, height: '480px' } },
  },
  render: function Render(args) {
    const { isOpen, setIsOpen, handleOpenChange } = useStoryOpenState(args);

    return (
      <>
        <Button
          variant="outline"
          size="md"
          onClick={() => handleOpenChange(true)}
        >
          상황 직접 입력 열기
        </Button>
        <CustomTpoSheet
          {...args}
          isOpen={isOpen}
          onOpenChange={handleOpenChange}
          onSubmit={(text) => {
            args.onSubmit(text);
            setIsOpen(false);
          }}
        />
      </>
    );
  },
} satisfies Meta<typeof CustomTpoSheet>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Editing: Story = {
  args: {
    initialText: '학교 발표',
  },
};

export const OverLimit: Story = {
  args: {
    initialText: '아주 긴 상황 설명 '.repeat(12),
  },
};
