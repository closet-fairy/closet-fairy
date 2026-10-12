import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import StoryLabeled from '../../../../.storybook/StoryLabeled';
import StoryStack from '../../../../.storybook/StoryStack';
import IconButton from '@/components/common/IconButton';
import TopBar from './TopBar';

const backButton = (
  <IconButton icon="arrow_back" aria-label="뒤로 가기" onClick={fn()} />
);

const closeButton = (
  <IconButton icon="close" aria-label="추천 취소" onClick={fn()} />
);

const counter = <span>1 / 4</span>;

const meta = {
  component: TopBar,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    title: {
      description:
        '화면 제목입니다. `h1`으로 그리며, 한 줄을 넘으면 말줄임표로 자릅니다. `leading`이 있으면 한 단계 작은 글자로 그립니다.',
      control: 'text',
    },
    leading: {
      description:
        '왼쪽 끝에 놓는 자리입니다. 뒤로 가기 버튼이나 `1 / 4` 같은 카운터를 넘깁니다.',
      control: false,
    },
    trailing: {
      description: '오른쪽 끝에 놓는 자리입니다. 닫기 버튼 등을 넘깁니다.',
      control: false,
    },
  },
  args: {
    title: '코디 추천',
  },
} satisfies Meta<typeof TopBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithBack: Story = {
  args: {
    title: '주소 입력',
    leading: backButton,
  },
};

export const ResultCounter: Story = {
  args: {
    title: undefined,
    leading: counter,
    trailing: closeButton,
  },
};

export const WithTrailing: Story = {
  args: {
    trailing: closeButton,
  },
};

export const LongTitle: Story = {
  render: (args) => (
    <StoryStack direction="column" gap={24}>
      <StoryLabeled label="제목만">
        <TopBar
          {...args}
          title="옷장에 등록한 옷을 기준으로 오늘의 날씨에 맞춘 코디 추천"
        />
      </StoryLabeled>
      <StoryLabeled label="앞뒤 슬롯과 함께">
        <TopBar
          {...args}
          title="옷장에 등록한 옷을 기준으로 오늘의 날씨에 맞춘 코디 추천"
          leading={backButton}
          trailing={closeButton}
        />
      </StoryLabeled>
    </StoryStack>
  ),
};

export const Variants: Story = {
  render: (args) => (
    <StoryStack direction="column" gap={24}>
      <StoryLabeled label="제목형">
        <TopBar {...args} title="코디 추천" />
      </StoryLabeled>
      <StoryLabeled label="뒤로가기형">
        <TopBar {...args} title="주소 입력" leading={backButton} />
      </StoryLabeled>
      <StoryLabeled label="결과형">
        <TopBar
          {...args}
          title={undefined}
          leading={counter}
          trailing={closeButton}
        />
      </StoryLabeled>
    </StoryStack>
  ),
};
