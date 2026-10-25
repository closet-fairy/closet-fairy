import styled from '@emotion/styled';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import {
  normalizeQuarterTurns,
  splitAngle,
} from '@/domains/clothingImageEdit/angle';
import { spacing } from '@/styles/tokens';
import RotationPanel from './RotationPanel';

const Frame = styled.div`
  width: 390px;
  padding: ${spacing[16]} ${spacing[20]} ${spacing[20]};
`;

const meta = {
  component: RotationPanel,
  argTypes: {
    quarterTurns: {
      description:
        '90° 단위 방향입니다(0~3). 1이면 시계 방향으로 90° 돌린 상태입니다.',
      control: { type: 'number', min: 0, max: 3, step: 1 },
    },
    tilt: {
      description: '기울기입니다(-45°~45°). 슬라이더가 이 값을 보여 줍니다.',
      control: { type: 'range', min: -45, max: 45, step: 1 },
    },
    onQuarterTurn: {
      description: '[↺ 90°]는 -1, [↻ 90°]는 +1로 방향을 바꾸라고 알립니다.',
    },
    onTiltChange: {
      description:
        '기울기 슬라이더를 움직였을 때 알립니다. 끄는 중에 0° 근처(±1°)면 0으로 붙여서 알립니다.',
    },
    onAngleChange: {
      description:
        '각도 입력칸에서 해석할 수 있는 전체 각도를 입력할 때마다 알립니다. 확정할 때는 정규화한 각도로 알립니다.',
    },
    onTiltDraggingChange: {
      description:
        '기울기 슬라이더를 잡고 놓을 때 알립니다. 편집기는 잡는 동안 격자를 띄웁니다.',
    },
    isDisabled: {
      description: '저장 중처럼 모든 조작을 막을 때 씁니다.',
      control: 'boolean',
    },
  },
  args: {
    quarterTurns: 1,
    tilt: -6,
    onQuarterTurn: fn(),
    onTiltChange: fn(),
    onAngleChange: fn(),
    onTiltDraggingChange: fn(),
    isDisabled: false,
  },
  render: function Render(args) {
    const [quarterTurns, setQuarterTurns] = useState(args.quarterTurns);
    const [tilt, setTilt] = useState(args.tilt);

    const handleQuarterTurn = (direction: 1 | -1) => {
      args.onQuarterTurn(direction);
      setQuarterTurns((previous) =>
        normalizeQuarterTurns(previous + direction),
      );
    };

    const handleTiltChange = (value: number) => {
      args.onTiltChange(value);
      setTilt(value);
    };

    const handleAngleChange = (angle: number) => {
      args.onAngleChange(angle);
      const split = splitAngle(angle);
      setQuarterTurns(split.quarterTurns);
      setTilt(split.tilt);
    };

    return (
      <Frame>
        <RotationPanel
          {...args}
          quarterTurns={quarterTurns}
          tilt={tilt}
          onQuarterTurn={handleQuarterTurn}
          onTiltChange={handleTiltChange}
          onAngleChange={handleAngleChange}
        />
      </Frame>
    );
  },
} satisfies Meta<typeof RotationPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Editing: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: /직접 입력/ }));
  },
};

export const Disabled: Story = {
  args: {
    isDisabled: true,
  },
};
