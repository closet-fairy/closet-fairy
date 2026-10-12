import type { Meta, StoryObj } from '@storybook/react-vite';
import { useRef, useState } from 'react';
import { fn } from 'storybook/test';
import useStoryOpenState from '../../../../.storybook/useStoryOpenState';
import StoryStack from '../../../../.storybook/StoryStack';
import Button from '@/components/common/Button';
import StarRating from '@/components/common/StarRating';
import Dialog from './Dialog';

const LONG_PARAGRAPHS = Array.from(
  { length: 16 },
  (_, index) =>
    `${index + 1}번째 문단입니다. 본문이 화면 높이를 넘으면 본문 영역만 스크롤되고, 제목과 하단 영역은 제자리에 남습니다.`,
);

const meta = {
  component: Dialog,
  argTypes: {
    isOpen: {
      description:
        '다이얼로그가 열려 있는지 정합니다. 제어형이라 닫힘 요청은 `onOpenChange`로 받아 다시 넘겨야 합니다.',
      control: 'boolean',
    },
    onOpenChange: {
      description:
        '딤 터치나 Esc로 다이얼로그를 닫으려 할 때 `false`를 받아 호출합니다. `isDismissable`이 `false`면 호출되지 않습니다.',
    },
    title: {
      description:
        '가운데 정렬되는 제목입니다. 다이얼로그의 접근성 이름으로도 쓰이므로 반드시 넘깁니다.',
      control: 'text',
    },
    description: {
      description:
        '제목 아래 보조 설명입니다. 넘기면 스크린리더가 다이얼로그 설명으로 함께 읽습니다.',
      control: 'text',
    },
    children: {
      description:
        '제목과 하단 영역 사이의 본문입니다. 본문이 길면 이 영역만 스크롤됩니다.',
      control: false,
    },
    footer: {
      description:
        '아래쪽 동작 영역입니다. 주로 버튼을 넣으며, 여러 개를 넣으면 세로로 쌓입니다.',
      control: false,
    },
    isDismissable: {
      description:
        '딤 터치와 Esc로 닫을 수 있는지 정합니다. `false`면 둘 다 막으므로, 닫는 버튼을 `footer`에 직접 넣어야 합니다.',
      control: 'boolean',
      table: { defaultValue: { summary: 'true' } },
    },
    initialFocus: {
      description:
        '열릴 때 포커스를 줄 요소의 ref입니다. 넘기지 않으면 터치로 열었을 때는 가상 키보드가 뜨지 않도록 다이얼로그 자체에, 키보드나 마우스로 열었을 때는 첫 번째 포커스 가능한 요소에 포커스를 줍니다. 넘기면 여는 방식과 관계없이 이 요소에 포커스를 주므로, 입력창을 넘기면 터치로 열어도 가상 키보드가 올라옵니다.',
      control: false,
    },
    finalFocus: {
      description:
        '닫힌 뒤 포커스를 돌려줄 요소의 ref입니다. 넘기지 않으면 열기 직전에 포커스가 있던 요소로 돌아갑니다. Safari는 버튼을 눌러도 버튼에 포커스를 주지 않아 돌아갈 곳을 잃으므로, 다이얼로그를 연 버튼을 넘기기를 권합니다.',
      control: false,
    },
  },
  args: {
    isOpen: true,
    onOpenChange: fn(),
    title: '이 코디, 얼마나 마음에 드세요',
    description: '별점을 매기면 다음 추천이 더 정확해집니다.',
  },
  parameters: {
    docs: { story: { inline: false, height: '480px' } },
  },
  render: function Render(args) {
    const { isOpen, setIsOpen, handleOpenChange } = useStoryOpenState(args);
    const [rating, setRating] = useState(0);
    const openerRef = useRef<HTMLButtonElement | null>(null);

    return (
      <>
        <Button
          ref={openerRef}
          variant="outline"
          size="md"
          onClick={() => handleOpenChange(true)}
        >
          다이얼로그 열기
        </Button>
        <Dialog
          {...args}
          isOpen={isOpen}
          onOpenChange={handleOpenChange}
          finalFocus={openerRef}
          footer={
            <>
              <Button
                isFullWidth
                isDisabled={rating === 0}
                onClick={() => setIsOpen(false)}
              >
                채택하기
              </Button>
              <Button
                variant="text"
                size="md"
                isFullWidth
                onClick={() => setIsOpen(false)}
              >
                다시 볼게요
              </Button>
            </>
          }
        >
          <StarRating value={rating} onChange={setRating} />
        </Dialog>
      </>
    );
  },
} satisfies Meta<typeof Dialog>;

export default meta;

type Story = StoryObj<typeof meta>;

const createRenderWithoutRating = (
  confirmLabel: string,
  cancelLabel: string,
): Story['render'] =>
  function Render(args) {
    const { isOpen, setIsOpen, handleOpenChange } = useStoryOpenState(args);

    return (
      <>
        <Button
          variant="outline"
          size="md"
          onClick={() => handleOpenChange(true)}
        >
          다이얼로그 열기
        </Button>
        <Dialog
          {...args}
          isOpen={isOpen}
          onOpenChange={handleOpenChange}
          footer={
            <>
              <Button isFullWidth onClick={() => setIsOpen(false)}>
                {confirmLabel}
              </Button>
              <Button
                variant="text"
                size="md"
                isFullWidth
                onClick={() => setIsOpen(false)}
              >
                {cancelLabel}
              </Button>
            </>
          }
        />
      </>
    );
  };

export const Default: Story = {};

export const Closed: Story = {
  args: {
    isOpen: false,
  },
};

export const TitleOnly: Story = {
  args: {
    title: '추천을 그만 볼까요',
    description: undefined,
  },
  render: createRenderWithoutRating('그만 볼게요', '계속 볼게요'),
};

export const NotDismissable: Story = {
  args: {
    isDismissable: false,
    description: '딤을 누르거나 Esc를 눌러도 닫히지 않습니다.',
  },
};

export const LongContent: Story = {
  args: {
    title: '긴 본문',
    description: '본문만 스크롤되는지 확인합니다.',
    children: (
      <StoryStack direction="column" gap={12}>
        {LONG_PARAGRAPHS.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </StoryStack>
    ),
  },
  render: createRenderWithoutRating('확인', '닫기'),
};
