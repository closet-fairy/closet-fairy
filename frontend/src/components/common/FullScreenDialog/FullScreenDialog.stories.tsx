import type { Meta, StoryObj } from '@storybook/react-vite';
import { useRef, useState } from 'react';
import { fn } from 'storybook/test';
import useStoryOpenState from '../../../../.storybook/useStoryOpenState';
import StoryStack from '../../../../.storybook/StoryStack';
import Button from '@/components/common/Button';
import ListItem from '@/components/common/ListItem';
import TextField from '@/components/common/TextField';
import FullScreenDialog from './FullScreenDialog';

const REGIONS = Array.from(
  { length: 24 },
  (_, index) => `${index + 1}번째 지역`,
);

const meta = {
  component: FullScreenDialog,
  argTypes: {
    isOpen: {
      description:
        '다이얼로그가 열려 있는지 정합니다. 제어형이라 닫힘 요청은 `onOpenChange`로 받아 다시 넘겨야 합니다.',
      control: 'boolean',
    },
    onOpenChange: {
      description:
        '뒤로 가기 버튼이나 Esc로 닫으려 할 때 `false`를 받아 호출합니다.',
    },
    title: {
      description:
        '위쪽 막대에 보이는 제목입니다. 다이얼로그의 접근성 이름으로도 쓰이므로 반드시 넘깁니다.',
      control: 'text',
    },
    header: {
      description:
        '제목 막대 아래에 고정되는 영역입니다. 검색 입력처럼 본문을 스크롤해도 남아 있어야 하는 요소를 넣습니다.',
      control: false,
    },
    children: {
      description: '본문입니다. 화면 높이를 넘으면 이 영역만 스크롤됩니다.',
      control: false,
    },
    footer: {
      description:
        '본문 아래에 고정되는 영역입니다. 본문을 스크롤해도 남아 있어야 하는 확정 버튼을 넣습니다.',
      control: false,
    },
    closeButton: {
      description:
        '위쪽 막대 왼쪽 버튼의 모양입니다. 이전 화면으로 돌아가는 흐름이면 `back`(뒤로 가기), 하던 일을 그만두고 닫는 흐름이면 `close`(닫기)를 씁니다.',
      control: 'inline-radio',
      options: ['back', 'close'],
    },
    initialFocus: {
      description:
        '열릴 때 포커스를 줄 요소의 ref입니다. 넘기지 않으면 터치로 열었을 때는 가상 키보드가 뜨지 않도록 다이얼로그 자체에, 키보드나 마우스로 열었을 때는 첫 번째 포커스 가능한 요소에 포커스를 줍니다. 입력창을 넘기면 터치로 열어도 가상 키보드가 올라옵니다.',
      control: false,
    },
    finalFocus: {
      description:
        '닫힌 뒤 포커스를 돌려줄 요소의 ref입니다. 넘기지 않으면 열기 직전에 포커스가 있던 요소로 돌아갑니다.',
      control: false,
    },
  },
  args: {
    isOpen: true,
    onOpenChange: fn(),
    title: '주소 입력',
    children: null,
  },
  parameters: {
    layout: 'fullscreen',
    docs: { story: { inline: false, height: '640px' } },
  },
  render: function Render(args) {
    const { isOpen, setIsOpen, handleOpenChange } = useStoryOpenState(args);
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement | null>(null);
    const filteredRegions = REGIONS.filter((region) => region.includes(query));

    return (
      <>
        <Button
          variant="outline"
          size="md"
          onClick={() => handleOpenChange(true)}
        >
          전체 화면 열기
        </Button>
        <FullScreenDialog
          {...args}
          isOpen={isOpen}
          onOpenChange={handleOpenChange}
          initialFocus={inputRef}
          header={
            <TextField
              ref={inputRef}
              value={query}
              onChange={setQuery}
              placeholder="지역 이름"
              icon="search"
              hasClearButton
              onClear={() => setQuery('')}
            />
          }
        >
          {filteredRegions.map((region) => (
            <ListItem
              key={region}
              icon="location_on"
              title={region}
              onClick={() => setIsOpen(false)}
            />
          ))}
        </FullScreenDialog>
      </>
    );
  },
} satisfies Meta<typeof FullScreenDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Closed: Story = {
  args: {
    isOpen: false,
  },
};

export const LongTitle: Story = {
  args: {
    title:
      '제목이 화면 너비보다 길면 한 줄로 말줄임 처리되는지 확인하는 아주 긴 제목',
  },
};

export const CloseButton: Story = {
  args: {
    title: '옷 촬영',
    closeButton: 'close',
  },
};

export const WithFooter: Story = {
  args: {
    title: '사진 확인',
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
          전체 화면 열기
        </Button>
        <FullScreenDialog
          {...args}
          isOpen={isOpen}
          onOpenChange={handleOpenChange}
          footer={
            <Button size="lg" isFullWidth onClick={() => setIsOpen(false)}>
              4벌 등록하기
            </Button>
          }
        >
          {REGIONS.map((region) => (
            <ListItem key={region} title={region} />
          ))}
        </FullScreenDialog>
      </>
    );
  },
};

export const WithoutHeader: Story = {
  render: function Render(args) {
    const { isOpen, handleOpenChange } = useStoryOpenState(args);

    return (
      <>
        <Button
          variant="outline"
          size="md"
          onClick={() => handleOpenChange(true)}
        >
          전체 화면 열기
        </Button>
        <FullScreenDialog
          {...args}
          isOpen={isOpen}
          onOpenChange={handleOpenChange}
        >
          <StoryStack direction="column" gap={12}>
            <p>위쪽 막대와 본문만 있는 전체 화면입니다.</p>
          </StoryStack>
        </FullScreenDialog>
      </>
    );
  },
};
