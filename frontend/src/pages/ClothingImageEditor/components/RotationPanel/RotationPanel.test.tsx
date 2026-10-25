import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { splitAngle } from '@/domains/clothingImageEdit/angle';
import RotationPanel from './RotationPanel';

interface StatefulPanelProps {
  initialAngle: number;
  onAngleChange?: (angle: number) => void;
  isDisabled?: boolean;
}

const StatefulPanel = (props: StatefulPanelProps) => {
  const { initialAngle, onAngleChange, isDisabled } = props;
  const [{ quarterTurns, tilt }, setSplit] = useState(() =>
    splitAngle(initialAngle),
  );

  return (
    <RotationPanel
      quarterTurns={quarterTurns}
      tilt={tilt}
      onQuarterTurn={vi.fn()}
      onTiltChange={vi.fn()}
      onAngleChange={(angle) => {
        onAngleChange?.(angle);
        setSplit(splitAngle(angle));
      }}
      isDisabled={isDisabled}
    />
  );
};

const openInput = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: /직접 입력/ }));

  return screen.getByRole('textbox', { name: '회전 각도' });
};

describe('값 표시', () => {
  test('방향과 기울기를 합친 전체 각도를 보여 줘야 한다.', () => {
    render(<StatefulPanel initialAngle={84} />);

    expect(screen.getByRole('button', { name: /직접 입력/ })).toHaveTextContent(
      '84°',
    );
  });

  test('값 표시를 누르면 현재 각도가 든 입력칸이 열리고 초점이 가야 한다.', async () => {
    const user = userEvent.setup();
    render(<StatefulPanel initialAngle={84} />);

    const input = await openInput(user);

    expect(input).toHaveValue('84');
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute('inputmode', 'decimal');
  });
});

describe('각도 입력', () => {
  test('해석할 수 있는 값을 입력하면 바로 미리보기에 반영해야 한다.', async () => {
    const user = userEvent.setup();
    const handleAngleChange = vi.fn();
    render(
      <StatefulPanel initialAngle={84} onAngleChange={handleAngleChange} />,
    );

    const input = await openInput(user);
    await user.clear(input);
    await user.type(input, '12.5');

    expect(handleAngleChange).toHaveBeenLastCalledWith(12.5);
  });

  test('해석할 수 없는 중간 값이면 마지막 유효값을 유지하고 입력한 글자는 그대로 둬야 한다.', async () => {
    const user = userEvent.setup();
    const handleAngleChange = vi.fn();
    render(
      <StatefulPanel initialAngle={84} onAngleChange={handleAngleChange} />,
    );

    const input = await openInput(user);
    await user.clear(input);
    await user.type(input, '-');

    expect(handleAngleChange).not.toHaveBeenCalled();
    expect(input).toHaveValue('-');
  });

  test('엔터를 누르면 정규화한 각도로 확정하고 값 표시로 돌아가야 한다.', async () => {
    const user = userEvent.setup();
    const handleAngleChange = vi.fn();
    render(
      <StatefulPanel initialAngle={84} onAngleChange={handleAngleChange} />,
    );

    const input = await openInput(user);
    await user.clear(input);
    await user.type(input, '200{Enter}');

    expect(handleAngleChange).toHaveBeenLastCalledWith(-160);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /직접 입력/ })).toHaveTextContent(
      '−160°',
    );
  });

  test('입력칸 밖으로 초점이 나가면 확정해야 한다.', async () => {
    const user = userEvent.setup();
    render(<StatefulPanel initialAngle={0} />);

    const input = await openInput(user);
    await user.clear(input);
    await user.type(input, '30');
    await user.tab();

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /직접 입력/ })).toHaveTextContent(
      '30°',
    );
  });

  test('부호 바꾸기를 누르면 맨 앞의 -를 붙였다 떼고 입력 모드를 유지해야 한다.', async () => {
    const user = userEvent.setup();
    const handleAngleChange = vi.fn();
    render(
      <StatefulPanel initialAngle={84} onAngleChange={handleAngleChange} />,
    );

    const input = await openInput(user);
    const signButton = screen.getByRole('button', { name: '부호 바꾸기' });

    await user.click(signButton);

    expect(input).toHaveValue('-84');
    expect(input).toHaveFocus();
    expect(handleAngleChange).toHaveBeenLastCalledWith(-84);

    await user.click(signButton);

    expect(input).toHaveValue('84');
    expect(handleAngleChange).toHaveBeenLastCalledWith(84);
  });
});

describe('비활성', () => {
  test('저장 중에는 90° 버튼, 값 표시, 슬라이더를 모두 조작할 수 없어야 한다.', () => {
    render(<StatefulPanel initialAngle={84} isDisabled />);

    expect(
      screen.getByRole('button', { name: '왼쪽으로 90° 돌리기' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: '오른쪽으로 90° 돌리기' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: /직접 입력/ })).toBeDisabled();
    expect(screen.getByRole('slider', { name: '기울기' })).toBeDisabled();
  });
});

describe('기울기 슬라이더', () => {
  test('키보드로 0° 근처에 맞출 때는 0°에 붙이지 않아야 한다.', async () => {
    const user = userEvent.setup();
    const handleTiltChange = vi.fn();
    render(
      <RotationPanel
        quarterTurns={0}
        tilt={2}
        onQuarterTurn={vi.fn()}
        onTiltChange={handleTiltChange}
        onAngleChange={vi.fn()}
      />,
    );

    screen.getByRole('slider', { name: '기울기' }).focus();
    await user.keyboard('{ArrowLeft}');

    expect(handleTiltChange).toHaveBeenCalledWith(1);
  });
});
