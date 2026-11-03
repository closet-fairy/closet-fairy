import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { OutfitItemResult, OutfitResult } from '@/generated/models';
import { OUTFIT_PAGER } from '@/pages/RecommendationResult/hooks/useOutfitPager.constants';
import OutfitStack from './OutfitStack';

const CARD_HEIGHT = 500;
const CARD_TOP = 50;
const DRAGGING_SPACING =
  CARD_HEIGHT * OUTFIT_PAGER.CARD_SCALE + OUTFIT_PAGER.CARD_GAP_PX;
const COMMIT_DISTANCE = Math.ceil(DRAGGING_SPACING * OUTFIT_PAGER.COMMIT_RATIO);
const PAUSE_BEFORE_RELEASE_MS = OUTFIT_PAGER.STALE_RELEASE_MS + 40;
const SETTLE_MS = 2000;
const FRAME_MS = 16;
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
  isActive?: boolean;
  onDepthChange?: (depth: number) => void;
  onPresenceChange?: (presence: number) => void;
}) => {
  const {
    previousCount,
    initialDepth = 0,
    isRegenerating,
    isActive,
    onDepthChange,
    onPresenceChange,
  } = props;
  const [depth, setDepth] = useState(initialDepth);

  return (
    <OutfitStack
      outfit={createOutfit(previousCount)}
      depth={depth}
      isRegenerating={isRegenerating}
      isActive={isActive}
      onDepthChange={(nextDepth) => {
        onDepthChange?.(nextDepth);
        setDepth(nextDepth);
      }}
      onPresenceChange={onPresenceChange}
      onOverflowClick={vi.fn()}
    />
  );
};

const wait = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
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

const liftCard = (target: Element, x: number, y: number) => {
  fireEvent.pointerUp(target, {
    pointerId: POINTER_ID,
    clientX: x,
    clientY: y,
  });
};

const dragCard = (target: Element, distance: number) => {
  pressCard(target);
  moveCard(target, START_X, START_Y + distance);
  wait(PAUSE_BEFORE_RELEASE_MS);
  liftCard(target, START_X, START_Y + distance);
  wait(SETTLE_MS);
};

const flickCard = (target: Element, distance: number) => {
  const steps = 3;

  pressCard(target);

  for (let step = 1; step <= steps; step += 1) {
    wait(FRAME_MS);
    moveCard(target, START_X, START_Y + (distance * step) / steps);
  }

  liftCard(target, START_X, START_Y + distance);
  wait(SETTLE_MS);
};

const getOrderBadge = (order: number, total: number) =>
  screen.getByText(`${order}번째 추천 · ${total}장`);

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'performance',
      'Date',
    ],
  });
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
  test('재추천이 없으면 순서 배지와 이동 버튼을 두지 않아야 한다.', () => {
    render(<ControlledStack previousCount={0} />);

    expect(screen.queryByText(/번째 추천/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '이전 코디 보기' }),
    ).not.toBeInTheDocument();
  });

  test('보고 있는 코디의 순서와 전체 수를 배지에 담아야 한다.', () => {
    render(<ControlledStack previousCount={2} initialDepth={1} />);

    expect(getOrderBadge(2, 3)).toBeInTheDocument();
  });

  test('끄는 동안에는 카드가 드러나고, 자리를 찾으면 다시 사라져야 한다.', () => {
    const onPresenceChange = vi.fn();

    render(
      <ControlledStack previousCount={1} onPresenceChange={onPresenceChange} />,
    );

    const card = getOrderBadge(2, 2);

    pressCard(card);
    moveCard(card, START_X, START_Y + OUTFIT_PAGER.REVEAL_DISTANCE_PX);

    expect(onPresenceChange).toHaveBeenLastCalledWith(1);

    wait(PAUSE_BEFORE_RELEASE_MS);
    liftCard(card, START_X, START_Y + OUTFIT_PAGER.REVEAL_DISTANCE_PX);
    wait(SETTLE_MS);

    expect(onPresenceChange).toHaveBeenLastCalledWith(0);
  });
});

describe('카드 끌기', () => {
  test('넘어가는 거리 이상 끌어내리면 한 장 이전으로 넘어가야 한다.', () => {
    render(<ControlledStack previousCount={2} />);

    dragCard(getOrderBadge(3, 3), COMMIT_DISTANCE);

    expect(getOrderBadge(2, 3)).toBeInTheDocument();
  });

  test('넘어가는 거리에 못 미치면 제자리로 돌아와야 한다.', () => {
    const onDepthChange = vi.fn();

    render(<ControlledStack previousCount={2} onDepthChange={onDepthChange} />);

    dragCard(getOrderBadge(3, 3), COMMIT_DISTANCE - 2);

    expect(getOrderBadge(3, 3)).toBeInTheDocument();
    expect(onDepthChange).not.toHaveBeenCalled();
  });

  test('빠르게 튕기면 짧게 끌어도 넘어가야 한다.', () => {
    render(<ControlledStack previousCount={2} />);

    flickCard(getOrderBadge(3, 3), OUTFIT_PAGER.FLICK_MIN_DISTANCE_PX + 18);

    expect(getOrderBadge(2, 3)).toBeInTheDocument();
  });

  test('끌어올리면 한 장씩 최신 쪽으로 돌아와야 한다.', () => {
    render(<ControlledStack previousCount={2} initialDepth={2} />);

    dragCard(getOrderBadge(1, 3), -COMMIT_DISTANCE);

    expect(getOrderBadge(2, 3)).toBeInTheDocument();

    dragCard(getOrderBadge(2, 3), -COMMIT_DISTANCE);

    expect(getOrderBadge(3, 3)).toBeInTheDocument();
  });

  test('첫 번째 추천에서는 더 끌어내려도 넘어가지 않아야 한다.', () => {
    const onDepthChange = vi.fn();

    render(
      <ControlledStack
        previousCount={1}
        initialDepth={1}
        onDepthChange={onDepthChange}
      />,
    );

    dragCard(getOrderBadge(1, 2), COMMIT_DISTANCE * 2);

    expect(getOrderBadge(1, 2)).toBeInTheDocument();
    expect(onDepthChange).not.toHaveBeenCalled();
  });

  test('최신 코디에서는 끌어올려도 넘어가지 않아야 한다.', () => {
    const onDepthChange = vi.fn();

    render(<ControlledStack previousCount={1} onDepthChange={onDepthChange} />);

    dragCard(getOrderBadge(2, 2), -COMMIT_DISTANCE * 2);

    expect(getOrderBadge(2, 2)).toBeInTheDocument();
    expect(onDepthChange).not.toHaveBeenCalled();
  });

  test('처음 움직인 방향이 가로면 세로로 끌어도 넘어가지 않아야 한다.', () => {
    const onPresenceChange = vi.fn();

    render(
      <ControlledStack previousCount={1} onPresenceChange={onPresenceChange} />,
    );

    const card = getOrderBadge(2, 2);

    pressCard(card);
    moveCard(card, START_X + 20, START_Y);
    moveCard(card, START_X + 20, START_Y + COMMIT_DISTANCE);
    wait(PAUSE_BEFORE_RELEASE_MS);
    liftCard(card, START_X + 20, START_Y + COMMIT_DISTANCE);
    wait(SETTLE_MS);

    expect(getOrderBadge(2, 2)).toBeInTheDocument();
    expect(onPresenceChange).not.toHaveBeenCalledWith(1);
  });

  test('넘어가는 중에 다시 잡아 끌면 잡은 자리에서 이어 끌려야 한다.', () => {
    render(<ControlledStack previousCount={2} />);

    const card = getOrderBadge(3, 3);

    pressCard(card);
    moveCard(card, START_X, START_Y + COMMIT_DISTANCE);
    wait(PAUSE_BEFORE_RELEASE_MS);
    liftCard(card, START_X, START_Y + COMMIT_DISTANCE);
    wait(FRAME_MS * 3);
    dragCard(card, Math.ceil(DRAGGING_SPACING));

    expect(getOrderBadge(1, 3)).toBeInTheDocument();
  });

  test('넘어가는 중에 다시 잡아 조금만 움직이면 가던 자리로 마저 가야 한다.', () => {
    render(<ControlledStack previousCount={2} />);

    const card = getOrderBadge(3, 3);

    pressCard(card);
    moveCard(card, START_X, START_Y + COMMIT_DISTANCE);
    wait(PAUSE_BEFORE_RELEASE_MS);
    liftCard(card, START_X, START_Y + COMMIT_DISTANCE);
    wait(FRAME_MS * 3);
    dragCard(card, -OUTFIT_PAGER.AXIS_LOCK_DISTANCE_PX);

    expect(getOrderBadge(2, 3)).toBeInTheDocument();
  });

  test('넘어가는 중에 다시 잡아 되돌려 끌면 돌아와야 한다.', () => {
    render(<ControlledStack previousCount={2} />);

    const card = getOrderBadge(3, 3);

    pressCard(card);
    moveCard(card, START_X, START_Y + COMMIT_DISTANCE);
    wait(PAUSE_BEFORE_RELEASE_MS);
    liftCard(card, START_X, START_Y + COMMIT_DISTANCE);
    wait(FRAME_MS * 3);
    dragCard(card, -Math.ceil(DRAGGING_SPACING));

    expect(getOrderBadge(3, 3)).toBeInTheDocument();
  });

  test('끌기가 취소되면 제자리로 돌아와야 한다.', () => {
    const onDepthChange = vi.fn();

    render(<ControlledStack previousCount={1} onDepthChange={onDepthChange} />);

    const card = getOrderBadge(2, 2);

    pressCard(card);
    moveCard(card, START_X, START_Y + COMMIT_DISTANCE);
    fireEvent.pointerCancel(card, { pointerId: POINTER_ID });
    wait(SETTLE_MS);

    expect(getOrderBadge(2, 2)).toBeInTheDocument();
    expect(onDepthChange).not.toHaveBeenCalled();
  });

  test('재추천 중인 카드는 끌 수 없어야 한다.', () => {
    const onDepthChange = vi.fn();

    render(
      <ControlledStack
        previousCount={1}
        isRegenerating
        onDepthChange={onDepthChange}
      />,
    );

    dragCard(screen.getByRole('status'), COMMIT_DISTANCE);

    expect(onDepthChange).not.toHaveBeenCalled();
  });

  test('이전 코디가 없으면 끌어도 카드가 드러나지 않아야 한다.', () => {
    const onPresenceChange = vi.fn();

    render(
      <ControlledStack previousCount={0} onPresenceChange={onPresenceChange} />,
    );

    dragCard(screen.getByAltText('100번 상의'), COMMIT_DISTANCE);

    expect(onPresenceChange).not.toHaveBeenCalledWith(1);
  });

  test('이동과 놓기가 다시 그리기 전에 연달아 와도 넘어가야 한다.', async () => {
    render(<ControlledStack previousCount={1} />);

    const card = getOrderBadge(2, 2);

    pressCard(card);
    wait(PAUSE_BEFORE_RELEASE_MS);
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
      new PointerEvent('pointerup', {
        bubbles: true,
        pointerId: POINTER_ID,
        clientX: START_X,
        clientY: START_Y + COMMIT_DISTANCE,
      }),
    );
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    await act(async () => {
      await Promise.resolve();
    });
    wait(SETTLE_MS);

    expect(getOrderBadge(1, 2)).toBeInTheDocument();
  });

  test('끄는 사이에 바깥에서 깊이를 바꾸면 그 깊이에 멈춰야 한다.', () => {
    const onDepthChange = vi.fn();
    const outfit = createOutfit(1);
    const { rerender } = render(
      <OutfitStack
        outfit={outfit}
        depth={1}
        onDepthChange={onDepthChange}
        onOverflowClick={vi.fn()}
      />,
    );
    const card = getOrderBadge(1, 2);

    pressCard(card);
    moveCard(card, START_X, START_Y - COMMIT_DISTANCE);
    rerender(
      <OutfitStack
        outfit={outfit}
        depth={0}
        onDepthChange={onDepthChange}
        onOverflowClick={vi.fn()}
      />,
    );
    wait(PAUSE_BEFORE_RELEASE_MS);
    liftCard(card, START_X, START_Y - COMMIT_DISTANCE);
    wait(SETTLE_MS);

    expect(onDepthChange).not.toHaveBeenCalled();
    expect(getOrderBadge(2, 2)).toBeInTheDocument();
  });

  test('끌던 중에 깊이가 바뀌어도 다음 끌기를 막지 않아야 한다.', () => {
    const onDepthChange = vi.fn();
    const outfit = createOutfit(1);
    const { rerender } = render(
      <OutfitStack
        outfit={outfit}
        depth={1}
        onDepthChange={onDepthChange}
        onOverflowClick={vi.fn()}
      />,
    );
    const card = getOrderBadge(1, 2);

    pressCard(card);
    moveCard(card, START_X, START_Y - COMMIT_DISTANCE);
    rerender(
      <OutfitStack
        outfit={outfit}
        depth={0}
        onDepthChange={onDepthChange}
        onOverflowClick={vi.fn()}
      />,
    );
    liftCard(card, START_X, START_Y - COMMIT_DISTANCE);
    wait(SETTLE_MS);
    dragCard(getOrderBadge(2, 2), COMMIT_DISTANCE);

    expect(onDepthChange).toHaveBeenCalledExactlyOnceWith(1);
  });

  test('카드 밖에서 마우스 버튼을 뗀 뒤에는 카드가 따라오지 않아야 한다.', () => {
    const onPresenceChange = vi.fn();

    render(
      <ControlledStack previousCount={1} onPresenceChange={onPresenceChange} />,
    );

    const card = getOrderBadge(2, 2);

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

    expect(onPresenceChange).not.toHaveBeenCalledWith(1);
  });

  test('모션을 줄이는 설정이면 놓자마자 넘어가고 카드도 바로 사라져야 한다.', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const onPresenceChange = vi.fn();

    render(
      <ControlledStack previousCount={1} onPresenceChange={onPresenceChange} />,
    );

    const card = getOrderBadge(2, 2);

    pressCard(card);
    moveCard(card, START_X, START_Y + COMMIT_DISTANCE);
    wait(PAUSE_BEFORE_RELEASE_MS);
    liftCard(card, START_X, START_Y + COMMIT_DISTANCE);

    expect(getOrderBadge(1, 2)).toBeInTheDocument();
    expect(onPresenceChange).toHaveBeenLastCalledWith(0);
  });
});

describe('숨겨진 겹의 사진', () => {
  test('옆 겹의 사진이 정해져도 보던 카드 위로 나오지 않아야 한다.', () => {
    render(<ControlledStack previousCount={1} initialDepth={1} />);

    const hiddenPhoto = screen.getByAltText('100번 상의');

    fireEvent.load(hiddenPhoto);

    expect(hiddenPhoto).not.toBeVisible();
  });
});

describe('이동 버튼', () => {
  test('버튼으로 한 장씩 오갈 수 있어야 한다.', async () => {
    vi.useRealTimers();

    const user = userEvent.setup();

    render(<ControlledStack previousCount={2} />);

    await user.click(screen.getByRole('button', { name: '이전 코디 보기' }));

    expect(getOrderBadge(2, 3)).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: '최신 쪽으로 돌아가기' }),
    );

    expect(getOrderBadge(3, 3)).toBeInTheDocument();
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

describe('등장 애니메이션', () => {
  const loadImages = () => {
    screen.getAllByRole('img', { hidden: true }).forEach((image) => {
      fireEvent.load(image);
    });
  };

  test('보고 있지 않은 카드의 옷은 숨긴 채 기다려야 한다.', () => {
    render(<ControlledStack previousCount={0} isActive={false} />);
    loadImages();

    expect(screen.getByAltText('100번 상의')).not.toBeVisible();
  });

  test('보게 되면 옷이 나타나야 한다.', () => {
    const { rerender } = render(
      <OutfitStack
        outfit={createOutfit(0)}
        depth={0}
        isActive={false}
        onDepthChange={vi.fn()}
        onOverflowClick={vi.fn()}
      />,
    );

    loadImages();
    rerender(
      <OutfitStack
        outfit={createOutfit(0)}
        depth={0}
        isActive
        onDepthChange={vi.fn()}
        onOverflowClick={vi.fn()}
      />,
    );

    expect(screen.getByAltText('100번 상의')).toBeVisible();
  });

  test('이전 코디의 옷은 숨기지 않고 바로 보여 줘야 한다.', () => {
    render(<ControlledStack previousCount={2} initialDepth={1} />);
    loadImages();

    expect(screen.getByAltText('2번 상의')).toBeVisible();
  });

  test('이전 코디를 보다가 최신으로 돌아와도 다시 숨기지 않아야 한다.', () => {
    const createStack = (depth: number, isActive: boolean) => (
      <OutfitStack
        outfit={createOutfit(2)}
        depth={depth}
        isActive={isActive}
        onDepthChange={vi.fn()}
        onOverflowClick={vi.fn()}
      />
    );
    const { rerender } = render(createStack(0, true));

    loadImages();
    rerender(createStack(2, true));
    rerender(createStack(0, false));
    loadImages();

    expect(screen.getByAltText('100번 상의')).toBeVisible();
  });

  test('보기 전에 재추천으로 이전 코디가 된 옷도 보여 줘야 한다.', () => {
    const createStack = (outfit: OutfitResult, depth: number) => (
      <OutfitStack
        outfit={outfit}
        depth={depth}
        isActive={false}
        onDepthChange={vi.fn()}
        onOverflowClick={vi.fn()}
      />
    );
    const regenerated: OutfitResult = {
      ...createPreviousOutfit(101),
      previous_outfits: [createPreviousOutfit(100)],
    };
    const { rerender } = render(createStack(createOutfit(0), 0));

    rerender(createStack(regenerated, 1));
    loadImages();

    expect(screen.getByAltText('100번 상의')).toBeVisible();
  });
});
