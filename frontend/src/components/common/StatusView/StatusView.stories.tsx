import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import Button from '@/components/common/Button';
import Icon from '@/components/common/Icon';
import ListItem from '@/components/common/ListItem';
import StatusView from './StatusView';

const loadingVisual = (
  <svg width={190} height={190} viewBox="0 0 190 190" aria-hidden>
    <circle
      cx={95}
      cy={95}
      r={94}
      fill="none"
      stroke="currentColor"
      strokeDasharray="4 4"
    />
  </svg>
);

const doneVisual = <Icon name="check_circle-fill" size="xl" />;

const summaryExample = (
  <ListItem
    variant="card"
    icon="checkroom"
    title="베이지 코치 재킷 외 3벌"
    description="8월 23일 · 데일리 · 24° 흐림"
  />
);

const actionsExample = (
  <>
    <Button isFullWidth onClick={fn()}>
      추천 내역에서 보기
    </Button>
    <Button variant="text" size="md" isFullWidth onClick={fn()}>
      닫기
    </Button>
  </>
);

const meta = {
  component: StatusView,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    visual: {
      description:
        '제목 위나 아래에 놓는 비주얼 자리입니다. 로딩 애니메이션, 완료 아이콘 등을 넘깁니다. 비주얼의 대체 텍스트는 사용처가 정합니다.',
      control: false,
    },
    visualPlacement: {
      description:
        '비주얼을 제목 위(`top`)에 둘지 아래(`bottom`)에 둘지 정합니다. 진행 중 화면처럼 문구를 먼저 읽히고 싶으면 `bottom`을 씁니다.',
      control: 'inline-radio',
      options: ['top', 'bottom'],
      table: { defaultValue: { summary: 'top' } },
    },
    title: {
      description:
        '화면의 제목입니다. `h1`으로 그립니다. 부제와 함께 `role="status"` 영역에 들어 있어, 화면이 떠 있는 동안 문구가 바뀌면(진행 중 → 완료 등) 스크린리더가 바뀐 문구를 읽어 줍니다.',
      control: 'text',
    },
    description: {
      description:
        '제목 아래에 붙는 부제입니다. 제목과 같은 `role="status"` 영역에 들어 있습니다.',
      control: 'text',
    },
    children: {
      description:
        '제목 아래에 가로를 가득 채워 놓는 본문 자리입니다. 요약 카드 등을 넘깁니다.',
      control: false,
    },
    actions: {
      description:
        '화면 아래쪽에 붙는 액션 자리입니다. 넘긴 요소를 세로로 쌓고 가로를 가득 채웁니다.',
      control: false,
    },
    isBusy: {
      description:
        '본문(`children`)이 아직 갱신 중이면 켭니다. 본문 영역에만 `aria-busy`를 붙여, 다 채워질 때까지 보조 기술이 그 영역의 변경을 바로 알리지 않게 합니다. 제목과 부제에는 붙이지 않으며, 본문이 없으면 아무 효과가 없습니다. 진행 상태는 제목과 부제의 `role="status"`로 알립니다.',
      control: 'boolean',
      table: { defaultValue: { summary: 'false' } },
    },
  },
  args: {
    title: '코디를 만들고 있어요',
    description: '잠시만 기다려 주세요...',
  },
} satisfies Meta<typeof StatusView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = {
  args: {
    visual: loadingVisual,
    visualPlacement: 'bottom',
  },
};

export const BusyContent: Story = {
  args: {
    visual: doneVisual,
    title: '오늘의 코디로 정했어요',
    description: '요약을 불러오는 중입니다.',
    children: summaryExample,
    isBusy: true,
  },
};

export const Done: Story = {
  args: {
    visual: doneVisual,
    title: '오늘의 코디로 정했어요',
    description: '추천 내역에 저장했습니다.',
    children: summaryExample,
    actions: actionsExample,
  },
};

export const VisualTop: Story = {
  args: {
    visual: doneVisual,
    visualPlacement: 'top',
  },
};

export const VisualBottom: Story = {
  args: {
    visual: loadingVisual,
    visualPlacement: 'bottom',
  },
};

export const WithoutDescription: Story = {
  args: {
    visual: doneVisual,
    title: '오늘의 코디로 정했어요',
    description: undefined,
  },
};

export const LongText: Story = {
  args: {
    visual: doneVisual,
    title:
      '오늘의 코디로 정했어요. 추천 내역에서 언제든 다시 꺼내 볼 수 있어요',
    description:
      '추천 내역에 저장했습니다. 오늘 입어 본 뒤 별점을 남기면 다음 추천에 반영해 더 마음에 드는 코디를 만들어 드립니다.',
    children: summaryExample,
    actions: actionsExample,
  },
};
