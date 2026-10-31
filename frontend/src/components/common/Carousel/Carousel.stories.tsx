import type { Meta, StoryObj } from '@storybook/react-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import StoryStack from '../../../../.storybook/StoryStack';
import Notice from '@/components/common/Notice';
import PageIndicator from '@/components/common/PageIndicator';
import Carousel from './Carousel';

const SLIDE_TITLES = [
  '1번 슬라이드',
  '2번 슬라이드',
  '3번 슬라이드',
  '4번 슬라이드',
];

const SLIDES = SLIDE_TITLES.map((title) => (
  <Notice
    key={title}
    icon="layers"
    title={title}
    description="좌우로 밀거나 화살표를 눌러 넘깁니다."
  />
));

const OUTFITS = [
  {
    title: '미니멀 · 캐주얼',
    description:
      '낮 27°까지 오르지만 아침 저녁은 19°라 얇은 겉옷 하나로 온도차를 넘기게 짰습니다.',
  },
  {
    title: '데일리',
    description: '오후 6시 소나기 — 겉옷은 방수되는 걸 골랐어요',
  },
  {
    title: '미니멀',
    description: '미니멀을 선호하셔서 색을 셋으로 줄였습니다.',
  },
  {
    title: '캐주얼',
    description: '베이지 코치 재킷, 화이트 반팔 티, 연청 데님, 화이트 스니커즈',
  },
];

const meta = {
  component: Carousel,
  argTypes: {
    children: {
      description:
        '슬라이드로 보여 줄 요소들입니다. 자식 하나가 슬라이드 한 장이 되며, 한 화면에 한 장씩 보입니다.',
      control: false,
    },
    'aria-label': {
      description:
        '스크린리더가 읽을 캐러셀의 이름입니다. 무엇을 넘겨 보는지 알 수 있게 적습니다. 각 슬라이드는 "1 / 4"처럼 순서로 읽힙니다.',
      control: 'text',
    },
    index: {
      description:
        '현재 슬라이드의 순서(0부터)입니다. 넘기면 제어형으로 동작해 값이 바뀔 때 그 슬라이드로 이동합니다. 비워 두면 캐러셀이 스스로 위치를 관리합니다.',
      control: { type: 'number', min: 0, step: 1 },
    },
    onIndexChange: {
      description:
        '스와이프, 화살표, 키보드로 슬라이드가 바뀌거나 `index`로 이동했을 때 새 순서(0부터)로 호출됩니다. 슬라이드 수가 바뀌어 위치가 당겨질 때도 호출됩니다. 바깥에서 "1 / 4" 표시나 PageIndicator를 맞출 때 씁니다.',
    },
    onSettle: {
      description:
        '슬라이드 전환 애니메이션이 끝나면 호출됩니다. 빠져나가는 슬라이드의 내용을 전환이 끝난 뒤에 바꿀 때 씁니다.',
    },
    isLooped: {
      description:
        '마지막 슬라이드 다음에 첫 슬라이드로 이어지게 합니다. 끄면 양 끝에서 화살표가 비활성됩니다. 슬라이드가 너무 적어 이어 붙일 수 없으면 자동으로 꺼집니다.',
      control: 'boolean',
      table: { defaultValue: { summary: 'true' } },
    },
    hasArrows: {
      description:
        '좌우 화살표 버튼을 보여 줍니다. 슬라이드가 한 장뿐이면 켜 두어도 보이지 않습니다. 화살표에 포커스가 있을 때 키보드 좌우 화살표 키로도 넘길 수 있습니다. 끄면 키보드로 넘길 방법이 없으므로, 바깥에서 `index`로 넘기는 버튼을 둘 때만 끕니다.',
      control: 'boolean',
      table: { defaultValue: { summary: 'true' } },
    },
    arrowVariant: {
      description:
        '화살표 버튼의 모양입니다. circle은 흰 원형 배경 위에 아이콘을 올려 슬라이드 내용 위에서도 구분되게 합니다. plain은 아이콘만 보여 줍니다.',
      control: 'inline-radio',
      options: ['circle', 'plain'],
      table: { defaultValue: { summary: 'circle' } },
    },
    arrowInset: {
      description:
        '화살표를 캐러셀 양쪽 끝에서 안쪽으로 들이는 거리입니다. 슬라이드가 화면 끝까지 닿을 때 화살표만 안쪽에 둘 수 있습니다.',
      control: 'text',
      table: { defaultValue: { summary: '0' } },
    },
  },
  args: {
    children: SLIDES,
    'aria-label': '추천 코디',
    onIndexChange: fn(),
  },
} satisfies Meta<typeof Carousel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SingleSlide: Story = {
  args: {
    children: SLIDES[0],
  },
};

export const WithoutArrows: Story = {
  args: {
    hasArrows: false,
  },
};

export const NotLooped: Story = {
  args: {
    isLooped: false,
  },
};

export const PlainArrows: Story = {
  args: {
    arrowVariant: 'plain',
  },
};

export const Controlled: Story = {
  args: {
    index: 0,
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs();
    const index = args.index ?? 0;

    const handleIndexChange = (nextIndex: number) => {
      args.onIndexChange?.(nextIndex);
      updateArgs({ index: nextIndex });
    };

    return (
      <StoryStack direction="column" gap={12}>
        <p>
          {index + 1} / {SLIDE_TITLES.length}
        </p>
        <Carousel {...args} index={index} onIndexChange={handleIndexChange} />
        <PageIndicator count={SLIDE_TITLES.length} index={index} />
      </StoryStack>
    );
  },
};

export const RecommendedOutfits: Story = {
  args: {
    index: 0,
    children: OUTFITS.map((outfit) => (
      <Notice
        key={outfit.title}
        icon="checkroom"
        title={outfit.title}
        description={outfit.description}
      />
    )),
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs();
    const index = args.index ?? 0;

    const handleIndexChange = (nextIndex: number) => {
      args.onIndexChange?.(nextIndex);
      updateArgs({ index: nextIndex });
    };

    return (
      <StoryStack direction="column" gap={16}>
        <Carousel {...args} index={index} onIndexChange={handleIndexChange} />
        <PageIndicator count={OUTFITS.length} index={index} />
      </StoryStack>
    );
  },
};
