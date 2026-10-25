import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import OnboardingStepLayout from './OnboardingStepLayout';

const meta = {
  component: OnboardingStepLayout,
  argTypes: {
    step: {
      description: '지금 단계(1부터)입니다. 왼쪽 아래 진행 막대에 반영됩니다.',
      control: { type: 'number', min: 1, max: 3 },
    },
    totalSteps: {
      description: '전체 단계 수입니다.',
      control: 'number',
    },
    title: { description: '크게 보이는 질문 제목입니다.', control: 'text' },
    description: {
      description: '이 정보를 왜 묻는지 알려 주는 첫 줄입니다.',
      control: 'text',
    },
    note: {
      description:
        '설명 둘째 줄입니다. 선택 단계에서 "나중에 정할 수 있다"를 알릴 때 씁니다.',
      control: 'text',
    },
    isOptional: {
      description: '제목 위에 [선택] 태그를 붙입니다.',
      control: 'boolean',
      table: { defaultValue: { summary: 'false' } },
    },
    hasDivider: {
      description:
        '하단 바 위에 구분선을 긋습니다. 본문이 길어 스크롤되는 단계에서 씁니다.',
      control: 'boolean',
      table: { defaultValue: { summary: 'false' } },
    },
    children: { description: '단계의 입력 영역입니다.', control: false },
    errorMessage: {
      description:
        '하단 바 바로 위에 빨간 한 줄로 보여 줄 저장 실패 안내입니다.',
      control: 'text',
    },
    canContinue: {
      description: '[계속]을 누를 수 있는지 정합니다.',
      control: 'boolean',
    },
    isSaving: {
      description:
        '저장 중이면 [계속]에 로딩을 보여 주고, 뒤로·로그아웃 버튼을 막습니다.',
      control: 'boolean',
      table: { defaultValue: { summary: 'false' } },
    },
    onContinue: { description: '[계속]을 누르면 호출됩니다.' },
    onBack: {
      description:
        '넘기면 상단 왼쪽에 ←를 보여 줍니다. 첫 단계에서는 넘기지 않습니다.',
    },
    onLogout: { description: '상단 오른쪽 [로그아웃]을 누르면 호출됩니다.' },
  },
  args: {
    step: 1,
    totalSteps: 3,
    title: '출생연도를 알려 주세요',
    description: '나이에 맞는 코디를 추천하는 데 써요.',
    children: '입력 영역',
    canContinue: false,
    onContinue: fn(),
    onLogout: fn(),
  },
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof OnboardingStepLayout>;

export default meta;

type Story = StoryObj<typeof meta>;

export const RequiredStep: Story = {};

export const OptionalStep: Story = {
  args: {
    step: 2,
    title: '체질과 성별을 알려 주세요',
    description: '날씨에 맞춰 옷 두께를 고를 때 써요.',
    note: '지금 넘겨도 내 정보에서 정할 수 있어요.',
    isOptional: true,
    canContinue: true,
    onBack: fn(),
  },
};

export const Saving: Story = {
  args: {
    step: 3,
    title: '좋아하는 스타일을 골라 주세요',
    description: '고른 스타일이 첫 추천부터 반영돼요.',
    isOptional: true,
    hasDivider: true,
    canContinue: true,
    isSaving: true,
    onBack: fn(),
  },
};

export const SaveFailed: Story = {
  args: {
    ...Saving.args,
    isSaving: false,
    errorMessage: '저장하지 못했어요. 다시 시도해 주세요.',
  },
};
