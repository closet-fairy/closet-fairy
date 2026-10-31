import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { OutfitItemResult, OutfitResult } from '@/generated/models';
import OutfitStack from './OutfitStack';

const CARD_HEIGHT = 500;
const CARD_TOP = 50;
const COMMIT_DISTANCE = CARD_HEIGHT * 0.15;
const START_X = 100;
const START_Y = 200;
const POINTER_ID = 1;

const createItem = (itemName: string): OutfitItemResult => ({
  slot_cd: 'top',
  accessory_type_cd: null,
  item_source_cd: 'owned',
  item_name: itemName,
  image_url: '/media/clothing/1/sample_cutout.webp',
  style_cds: [],
});

const createPreviousOutfit = (outfitId: number) => ({
  outfit_id: outfitId,
  outfit_seq: 1,
  outfit_type_cd: 'preferred' as const,
  reason: null,
  items: [createItem(`${outfitId}번 상의`)],
});

const createOutfit = (previousCount: number): OutfitResult => ({
  ...createPreviousOutfit(100),
  previous_outfits: Array.from({ length: previousCount }, (_, index) =>
    createPreviousOutfit(previousCount - index),
  ),
});

const ControlledStack = (props: {
  previousCount: number;
  initialDepth?: number;
  isRegenerating?: boolean;
}) => {
  const { previousCount, initialDepth = 0, isRegenerating } = props;
  const [depth, setDepth] = useState(initialDepth);

  return (
    <OutfitStack
      outfit={createOutfit(previousCount)}
      depth={depth}
      isRegenerating={isRegenerating}
      onDepthChange={setDepth}
    />
  );
};

const pressCard = (target: Element, x = START_X, y = START_Y) => {
  fireEvent.pointerDown(target, {
    pointerId: POINTER_ID,
    isPrimary: true,
    pointerType: 'touch',
    clientX: x,
    clientY: y,
  });
};

const moveCard = (target: Element, x: number, y: number) => {
  fireEvent.pointerMove(target, {
    pointerId: POINTER_ID,
    clientX: x,
    clientY: y,
  });
};

const releaseCard = (target: Element) => {
  fireEvent.pointerUp(target, { pointerId: POINTER_ID });
  act(() => {
    vi.runOnlyPendingTimers();
  });
};

const dragCard = (target: Element, distance: number) => {
  pressCard(target);
  moveCard(target, START_X, START_Y + distance);
  releaseCard(target);
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  HTMLElement.prototype.setPointerCapture = vi.fn();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, CARD_TOP, 360, CARD_HEIGHT),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('겹침 표시', () => {
  test('재추천이 없으면 배지와 이동 버튼을 보여 주지 않아야 한다.', () => {
    render(<ControlledStack previousCount={0} />);

    expect(screen.queryByText(/이전 코디 \d/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '이전 코디 보기' }),
    ).not.toBeInTheDocument();
  });

  test('최신 카드에는 쌓인 이전 코디의 수를 보여 줘야 한다.', () => {
    render(<ControlledStack previousCount={2} />);

    expect(screen.getByText('이전 코디 2')).toBeVisible();
  });

  test('이전 코디를 볼 때는 몇 번째 추천인지 보여 줘야 한다.', () => {
    render(<ControlledStack previousCount={2} initialDepth={1} />);

    expect(screen.getByText('2번째 추천')).toBeVisible();
    expect(screen.getByText('이전 코디 2')).not.toBeVisible();
  });
});

describe('카드 끌기', () => {
  test('카드 높이의 15% 이상 끌어내리면 한 장 이전으로 넘어가야 한다.', () => {
    render(<ControlledStack previousCount={2} />);

    dragCard(screen.getByText('이전 코디 2'), COMMIT_DISTANCE);

    expect(screen.getByText('2번째 추천')).toBeVisible();
  });

  test('15%에 못 미치면 제자리로 돌아와야 한다.', () => {
    render(<ControlledStack previousCount={2} />);

    dragCard(screen.getByText('이전 코디 2'), COMMIT_DISTANCE - 1);

    expect(screen.getByText('이전 코디 2')).toBeVisible();
    expect(screen.getByText('2번째 추천')).not.toBeVisible();
  });

  test('끌어올리면 한 장씩 최신 쪽으로 돌아와야 한다.', () => {
    render(<ControlledStack previousCount={2} initialDepth={2} />);

    dragCard(screen.getByText('1번째 추천'), -COMMIT_DISTANCE);

    expect(screen.getByText('2번째 추천')).toBeVisible();
    expect(screen.getByText('1번째 추천')).not.toBeVisible();

    dragCard(screen.getByText('2번째 추천'), -COMMIT_DISTANCE);

    expect(screen.getByText('이전 코디 2')).toBeVisible();
  });

  test('첫 번째 추천에서는 더 끌어내려도 움직이지 않아야 한다.', () => {
    render(<ControlledStack previousCount={1} initialDepth={1} />);

    dragCard(screen.getByText('1번째 추천'), COMMIT_DISTANCE);

    expect(screen.getByText('1번째 추천')).toBeVisible();
  });

  test('최신 카드에서는 끌어올려도 움직이지 않아야 한다.', () => {
    render(<ControlledStack previousCount={1} />);

    dragCard(screen.getByText('이전 코디 1'), -COMMIT_DISTANCE);

    expect(screen.getByText('이전 코디 1')).toBeVisible();
    expect(screen.getByText('1번째 추천')).not.toBeVisible();
  });

  test('처음 움직인 방향이 가로면 세로로 끌어도 넘어가지 않아야 한다.', () => {
    render(<ControlledStack previousCount={1} />);

    const card = screen.getByText('이전 코디 1');

    pressCard(card);
    moveCard(card, START_X + 20, START_Y);
    moveCard(card, START_X + 20, START_Y + COMMIT_DISTANCE);
    releaseCard(card);

    expect(screen.getByText('이전 코디 1')).toBeVisible();
    expect(screen.getByText('1번째 추천')).not.toBeVisible();
  });

  test('끌기가 취소되면 제자리로 돌아와야 한다.', () => {
    render(<ControlledStack previousCount={1} />);

    const card = screen.getByText('이전 코디 1');

    pressCard(card);
    moveCard(card, START_X, START_Y + COMMIT_DISTANCE);
    fireEvent.pointerCancel(card, { pointerId: POINTER_ID });
    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(screen.getByText('이전 코디 1')).toBeVisible();
    expect(screen.getByText('1번째 추천')).not.toBeVisible();
  });

  test('재추천 중인 카드는 끌 수 없어야 한다.', () => {
    render(<ControlledStack previousCount={1} isRegenerating />);

    dragCard(screen.getByText('이전 코디 1'), COMMIT_DISTANCE);

    expect(screen.getByRole('status')).toBeVisible();
    expect(screen.getByText('1번째 추천')).not.toBeVisible();
  });

  test('이동과 놓기가 다시 그리기 전에 연달아 와도 넘어가야 한다.', async () => {
    render(<ControlledStack previousCount={1} />);

    const card = screen.getByText('이전 코디 1');

    pressCard(card);
    // fireEvent는 이벤트마다 act로 다시 그리므로, 그려지기 전에 놓는 빠른 플릭을 재현하려면 직접 보낸다.
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', false);
    card.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        pointerId: POINTER_ID,
        clientX: START_X,
        clientY: START_Y + COMMIT_DISTANCE,
      }),
    );
    card.dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true, pointerId: POINTER_ID }),
    );
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(screen.getByText('1번째 추천')).toBeVisible();
    expect(screen.getByText('이전 코디 1')).not.toBeVisible();
  });

  test('돌아오는 사이에 최신으로 돌아왔다면 깊이를 더 줄이지 않아야 한다.', () => {
    const onDepthChange = vi.fn();
    const outfit = createOutfit(1);
    const { rerender } = render(
      <OutfitStack outfit={outfit} depth={1} onDepthChange={onDepthChange} />,
    );
    const card = screen.getByText('1번째 추천');

    pressCard(card);
    moveCard(card, START_X, START_Y - COMMIT_DISTANCE);
    fireEvent.pointerUp(card, { pointerId: POINTER_ID });
    rerender(
      <OutfitStack outfit={outfit} depth={0} onDepthChange={onDepthChange} />,
    );
    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(onDepthChange).not.toHaveBeenCalled();
    expect(screen.getByText('이전 코디 1')).toBeVisible();
  });

  test('끌던 방향의 코디가 사라져도 다음 끌기를 막지 않아야 한다.', () => {
    const onDepthChange = vi.fn();
    const outfit = createOutfit(1);
    const { rerender } = render(
      <OutfitStack outfit={outfit} depth={1} onDepthChange={onDepthChange} />,
    );
    const card = screen.getByText('1번째 추천');

    pressCard(card);
    moveCard(card, START_X, START_Y - COMMIT_DISTANCE);
    rerender(
      <OutfitStack outfit={outfit} depth={0} onDepthChange={onDepthChange} />,
    );
    releaseCard(card);
    dragCard(screen.getByText('이전 코디 1'), COMMIT_DISTANCE);

    expect(onDepthChange).toHaveBeenCalledExactlyOnceWith(1);
  });

  test('카드 밖에서 마우스 버튼을 뗀 뒤에는 카드가 따라오지 않아야 한다.', () => {
    render(<ControlledStack previousCount={1} />);

    const card = screen.getByText('이전 코디 1');

    fireEvent.pointerDown(card, {
      pointerId: POINTER_ID,
      isPrimary: true,
      pointerType: 'mouse',
      button: 0,
      buttons: 1,
      clientX: START_X,
      clientY: START_Y,
    });
    fireEvent.pointerMove(card, {
      pointerId: POINTER_ID,
      pointerType: 'mouse',
      buttons: 0,
      clientX: START_X,
      clientY: START_Y + COMMIT_DISTANCE,
    });

    expect(screen.getByText('1번째 추천')).not.toBeVisible();
  });

  test('모션을 줄이는 설정이면 놓자마자 넘어가야 한다.', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    render(<ControlledStack previousCount={1} />);

    const card = screen.getByText('이전 코디 1');

    pressCard(card);
    moveCard(card, START_X, START_Y + COMMIT_DISTANCE);
    fireEvent.pointerUp(card, { pointerId: POINTER_ID });

    expect(screen.getByText('1번째 추천')).toBeVisible();
  });
});

describe('숨겨진 겹의 사진', () => {
  test('옆 겹의 사진이 정해져도 보던 카드 위로 나오지 않아야 한다.', () => {
    render(<ControlledStack previousCount={1} initialDepth={1} />);

    const hiddenPhoto = screen.getByAltText('100번 상의');

    fireEvent.load(hiddenPhoto);

    expect(getComputedStyle(hiddenPhoto).visibility).toBe('hidden');
  });
});

describe('이동 버튼', () => {
  test('버튼으로 한 장씩 오갈 수 있어야 한다.', async () => {
    vi.useRealTimers();

    const user = userEvent.setup();

    render(<ControlledStack previousCount={2} />);

    await user.click(screen.getByRole('button', { name: '이전 코디 보기' }));

    expect(screen.getByText('2번째 추천')).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: '최신 쪽으로 돌아가기' }),
    );

    expect(screen.getByText('이전 코디 2')).toBeVisible();
  });

  test('끝에 닿아 버튼이 사라지면 반대쪽 버튼으로 포커스를 옮겨야 한다.', async () => {
    vi.useRealTimers();

    const user = userEvent.setup();

    render(<ControlledStack previousCount={1} />);

    await user.click(screen.getByRole('button', { name: '이전 코디 보기' }));

    expect(
      await screen.findByRole('button', { name: '최신 쪽으로 돌아가기' }),
    ).toHaveFocus();
  });

  test('재추천 중에는 이동 버튼이 없어야 한다.', () => {
    render(<ControlledStack previousCount={1} isRegenerating />);

    expect(
      screen.queryByRole('button', { name: '이전 코디 보기' }),
    ).not.toBeInTheDocument();
  });
});
