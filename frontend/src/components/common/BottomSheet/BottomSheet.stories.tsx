import type { Meta, StoryObj } from '@storybook/react-vite';
import { useRef, useState } from 'react';
import { fn } from 'storybook/test';
import useStoryOpenState from '../../../../.storybook/useStoryOpenState';
import StoryStack from '../../../../.storybook/StoryStack';
import Button from '@/components/common/Button';
import Dialog from '@/components/common/Dialog';
import ListItem from '@/components/common/ListItem';
import TextField from '@/components/common/TextField';
import BottomSheet from './BottomSheet';

const LONG_PARAGRAPHS = Array.from(
  { length: 16 },
  (_, index) =>
    `${index + 1}번째 문단입니다. 본문이 시트 높이를 넘으면 본문 영역만 스크롤되고, 제목과 하단 영역은 제자리에 남습니다.`,
);

const meta = {
  component: BottomSheet,
  argTypes: {
    isOpen: {
      description:
        '시트가 열려 있는지 정합니다. 제어형이라 닫힘 요청은 `onOpenChange`로 받아 다시 넘겨야 합니다.',
      control: 'boolean',
    },
    onOpenChange: {
      description:
        '딤 터치, Esc, 끌어내리기로 시트를 닫으려 할 때 `false`를 받아 호출합니다. `isDismissable`이 `false`면 호출되지 않습니다.',
    },
    title: {
      description:
        '시트 위쪽 제목입니다. 시트의 접근성 이름으로도 쓰이므로 반드시 넘깁니다.',
      control: 'text',
    },
    description: {
      description:
        '제목 아래 보조 설명입니다. 넘기면 스크린리더가 시트 설명으로 함께 읽습니다.',
      control: 'text',
    },
    children: {
      description:
        '시트 본문입니다. 본문이 길면 이 영역만 스크롤됩니다. 입력창을 넣으면 가상 키보드가 올라올 때 시트가 키보드 위로 올라갑니다. 시트 위에 다이얼로그를 띄울 때는 다이얼로그를 이 안에 넣으면 Esc가 위에 뜬 다이얼로그만 닫습니다.',
      control: false,
    },
    footer: {
      description:
        '본문 아래 고정되는 하단 영역입니다. 주로 확인 버튼을 넣으며, 여러 개를 넣으면 세로로 쌓입니다.',
      control: false,
    },
    isDismissable: {
      description:
        '딤 터치, Esc, 끌어내리기로 닫을 수 있는지 정합니다. `false`면 셋 다 막고 손잡이를 숨기므로, 닫는 버튼을 `footer`에 직접 넣어야 합니다.',
      control: 'boolean',
      table: { defaultValue: { summary: 'true' } },
    },
    initialFocus: {
      description:
        '열릴 때 포커스를 줄 요소의 ref입니다. 넘기지 않으면 터치로 열었을 때는 가상 키보드가 뜨지 않도록 시트 자체에, 키보드나 마우스로 열었을 때는 첫 번째 포커스 가능한 요소에 포커스를 줍니다. 넘기면 여는 방식과 관계없이 이 요소에 포커스를 주므로, 입력창을 넘기면 터치로 열어도 가상 키보드가 올라옵니다.',
      control: false,
    },
    finalFocus: {
      description:
        '닫힌 뒤 포커스를 돌려줄 요소의 ref입니다. 넘기지 않으면 열기 직전에 포커스가 있던 요소로 돌아갑니다. Safari는 버튼을 눌러도 버튼에 포커스를 주지 않아 돌아갈 곳을 잃으므로, 시트를 연 버튼을 넘기기를 권합니다.',
      control: false,
    },
  },
  args: {
    isOpen: true,
    onOpenChange: fn(),
    title: '위치 설정',
    description: '이 위치의 날씨로 코디를 추천합니다.',
    children: (
      <StoryStack direction="column" gap={10}>
        <ListItem
          variant="card"
          icon="my_location"
          title="현재 위치 사용"
          description="위치 권한을 한 번 확인합니다"
          hasChevron
          onClick={fn()}
        />
        <ListItem
          variant="card"
          icon="edit_location_alt"
          title="주소 직접 입력"
          description="시·구 단위까지"
          hasChevron
          onClick={fn()}
        />
      </StoryStack>
    ),
  },
  parameters: {
    docs: { story: { inline: false, height: '480px' } },
  },
  render: function Render(args) {
    const { isOpen, handleOpenChange } = useStoryOpenState(args);
    const openerRef = useRef<HTMLButtonElement | null>(null);

    return (
      <>
        <Button
          ref={openerRef}
          variant="outline"
          size="md"
          onClick={() => handleOpenChange(true)}
        >
          시트 열기
        </Button>
        <BottomSheet
          {...args}
          isOpen={isOpen}
          onOpenChange={handleOpenChange}
          finalFocus={openerRef}
        />
      </>
    );
  },
} satisfies Meta<typeof BottomSheet>;

export default meta;

type Story = StoryObj<typeof meta>;

const createRenderWithDialog = (
  dialogPlacement: 'inside' | 'beside',
): Story['render'] =>
  function Render(args) {
    const { isOpen, setIsOpen, handleOpenChange } = useStoryOpenState(args);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const handleDiscard = () => {
      setIsDialogOpen(false);
      setIsOpen(false);
    };

    const dialog = (
      <Dialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title="입력한 내용을 버릴까요"
        footer={
          <>
            <Button isFullWidth onClick={handleDiscard}>
              버리기
            </Button>
            <Button
              variant="text"
              size="md"
              isFullWidth
              onClick={() => setIsDialogOpen(false)}
            >
              계속 쓰기
            </Button>
          </>
        }
      />
    );

    return (
      <>
        <Button
          variant="outline"
          size="md"
          onClick={() => handleOpenChange(true)}
        >
          시트 열기
        </Button>
        <BottomSheet
          {...args}
          isOpen={isOpen}
          onOpenChange={handleOpenChange}
          footer={
            <Button
              variant="text"
              size="md"
              isFullWidth
              onClick={() => setIsDialogOpen(true)}
            >
              닫기
            </Button>
          }
        >
          <p>아래 닫기를 누르면 확인 다이얼로그가 시트 위에 뜹니다.</p>
          {dialogPlacement === 'inside' && dialog}
        </BottomSheet>
        {dialogPlacement === 'beside' && dialog}
      </>
    );
  };

export const Default: Story = {};

export const Closed: Story = {
  args: {
    isOpen: false,
  },
};

export const WithoutDescription: Story = {
  args: {
    description: undefined,
  },
};

export const NotDismissable: Story = {
  args: {
    title: '확인이 필요해요',
    description: '딤을 누르거나 Esc를 눌러도, 끌어내려도 닫히지 않습니다.',
    isDismissable: false,
    children: <p>아래 버튼으로만 닫을 수 있습니다.</p>,
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
          시트 열기
        </Button>
        <BottomSheet
          {...args}
          isOpen={isOpen}
          onOpenChange={handleOpenChange}
          footer={
            <Button
              variant="text"
              size="md"
              isFullWidth
              onClick={() => setIsOpen(false)}
            >
              닫기
            </Button>
          }
        />
      </>
    );
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
  render: function Render(args) {
    const { isOpen, setIsOpen, handleOpenChange } = useStoryOpenState(args);

    return (
      <>
        <Button
          variant="outline"
          size="md"
          onClick={() => handleOpenChange(true)}
        >
          시트 열기
        </Button>
        <BottomSheet
          {...args}
          isOpen={isOpen}
          onOpenChange={handleOpenChange}
          footer={
            <Button isFullWidth onClick={() => setIsOpen(false)}>
              확인
            </Button>
          }
        />
      </>
    );
  },
};

export const SituationInput: Story = {
  args: {
    title: '어떤 상황인가요',
    description: '짧게 적어주시면 그대로 반영합니다.',
  },
  render: function Render(args) {
    const { isOpen, setIsOpen, handleOpenChange } = useStoryOpenState(args);
    const [situation, setSituation] = useState('');

    return (
      <>
        <Button
          variant="outline"
          size="md"
          onClick={() => handleOpenChange(true)}
        >
          시트 열기
        </Button>
        <BottomSheet
          {...args}
          isOpen={isOpen}
          onOpenChange={handleOpenChange}
          footer={
            <Button
              isFullWidth
              isDisabled={situation.trim() === ''}
              onClick={() => setIsOpen(false)}
            >
              이 상황으로 설정
            </Button>
          }
        >
          <TextField
            value={situation}
            onChange={setSituation}
            placeholder="예: 학교 발표"
            maxLength={100}
            aria-label="상황"
          />
        </BottomSheet>
      </>
    );
  },
};

export const DialogInsideSheet: Story = {
  args: {
    title: '어떤 상황인가요',
    description: '다이얼로그를 시트의 children 안에 둔 경우입니다.',
  },
  render: createRenderWithDialog('inside'),
};

export const DialogBesideSheet: Story = {
  args: {
    title: '어떤 상황인가요',
    description: '다이얼로그를 시트 바깥에 형제로 둔 경우입니다.',
  },
  render: createRenderWithDialog('beside'),
};
