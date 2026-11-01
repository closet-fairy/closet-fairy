import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { OutfitItemResult } from '@/generated/models';
import OutfitFloor from './OutfitFloor';
import { Stage } from './OutfitFloor.styled';

const SLOW_MS = 400;
const TIMEOUT_MS = 8000;

const createItem = (
  slotCd: OutfitItemResult['slot_cd'],
  itemName: string,
  overrides: Partial<OutfitItemResult> = {},
): OutfitItemResult => ({
  slot_cd: slotCd,
  accessory_type_cd: null,
  item_source_cd: 'owned',
  item_name: itemName,
  image_url: `/media/${itemName}.webp`,
  style_cds: [],
  ...overrides,
});

const ITEMS = [createItem('top', '상의'), createItem('bottom', '하의')];
const SEED = { order: 1, id: 4101 };

const MANY_ITEMS = [
  createItem('top', '상의'),
  createItem('outer', '겉옷'),
  createItem('bottom', '하의'),
  createItem('shoes', '신발'),
  createItem('socks', '양말'),
  createItem('accessories', '모자', { accessory_type_cd: 'hat' }),
  createItem('accessories', '가방', { accessory_type_cd: 'bag' }),
  createItem('accessories', '벨트', { accessory_type_cd: 'belt' }),
  createItem('accessories', '시계', { accessory_type_cd: 'watch' }),
  createItem('accessories', '반지', { accessory_type_cd: 'jewelry' }),
];

const loadAll = (failedNames: readonly string[] = []) => {
  screen.getAllByRole('img', { hidden: true }).forEach((image) => {
    if (failedNames.includes(image.getAttribute('alt') ?? '')) {
      fireEvent.error(image);
    } else {
      fireEvent.load(image);
    }
  });
};

const advance = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('사진 결과를 기다리는 동안', () => {
  test('결과가 정해지기 전에는 옷을 보여 주지 않아야 한다.', () => {
    render(<OutfitFloor items={ITEMS} seed={SEED} />);

    fireEvent.load(screen.getByAltText('상의'));

    expect(screen.getByAltText('상의')).not.toBeVisible();
  });

  test('결과가 모두 정해지면 한 번에 보여 줘야 한다.', () => {
    render(<OutfitFloor items={ITEMS} seed={SEED} />);

    fireEvent.load(screen.getByAltText('상의'));
    fireEvent.load(screen.getByAltText('하의'));

    expect(screen.getByAltText('상의')).toBeVisible();
    expect(screen.getByAltText('하의')).toBeVisible();
  });

  test('400ms 전에는 로딩 아이콘이 없어야 한다.', () => {
    render(<OutfitFloor items={ITEMS} seed={SEED} />);

    advance(SLOW_MS - 1);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  test('400ms가 지나도 끝나지 않으면 로딩 아이콘을 보여 줘야 한다.', () => {
    render(<OutfitFloor items={ITEMS} seed={SEED} />);

    advance(SLOW_MS);

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  test('그 전에 끝나면 로딩 아이콘이 나타나지 않아야 한다.', () => {
    render(<OutfitFloor items={ITEMS} seed={SEED} />);

    fireEvent.load(screen.getByAltText('상의'));
    fireEvent.load(screen.getByAltText('하의'));
    advance(SLOW_MS);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  test('결과가 정해지면 로딩 아이콘을 치워야 한다.', () => {
    render(<OutfitFloor items={ITEMS} seed={SEED} />);

    advance(SLOW_MS);
    fireEvent.load(screen.getByAltText('상의'));
    fireEvent.load(screen.getByAltText('하의'));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('사진 실패', () => {
  test('일부만 실패하면 남은 옷을 놓아야 한다.', () => {
    render(<OutfitFloor items={ITEMS} seed={SEED} />);

    fireEvent.error(screen.getByAltText('상의'));
    fireEvent.load(screen.getByAltText('하의'));

    expect(screen.queryByAltText('상의')).not.toBeInTheDocument();
    expect(screen.getByAltText('하의')).toBeVisible();
  });

  test('같은 자리의 사진이 실패하면 다음 옷을 놓아야 한다.', () => {
    render(
      <OutfitFloor
        seed={SEED}
        items={[createItem('top', '상의'), createItem('top', '다른 상의')]}
      />,
    );

    fireEvent.error(screen.getByAltText('상의'));
    fireEvent.load(screen.getByAltText('다른 상의'));

    expect(screen.getByAltText('다른 상의')).toBeVisible();
  });

  test('전부 실패하면 사진을 불러오지 못했다고 안내해야 한다.', () => {
    render(<OutfitFloor items={ITEMS} seed={SEED} />);

    fireEvent.error(screen.getByAltText('상의'));
    fireEvent.error(screen.getByAltText('하의'));

    expect(screen.getByText('사진을 불러오지 못했어요')).toBeInTheDocument();
    expect(
      screen.getByText('정보 확인에서 아이템을 볼 수 있어요.'),
    ).toBeInTheDocument();
  });

  test('이미지 없는 옷과 실패가 섞여도 사진 실패로 안내해야 한다.', () => {
    render(
      <OutfitFloor
        seed={SEED}
        items={[
          createItem('top', '상의'),
          createItem('bottom', '기본 하의', {
            item_source_cd: 'essential',
            image_url: null,
          }),
        ]}
      />,
    );

    fireEvent.error(screen.getByAltText('상의'));

    expect(screen.getByText('사진을 불러오지 못했어요')).toBeInTheDocument();
  });

  test('전부 이미지가 없으면 미리보기 안내를 보여 줘야 한다.', () => {
    render(
      <OutfitFloor
        seed={SEED}
        items={[createItem('top', '상의', { image_url: null })]}
      />,
    );

    expect(
      screen.getByText('이 코디는 미리보기를 지원하지 않아요'),
    ).toBeInTheDocument();
  });
});

describe('시간 제한', () => {
  test('8초까지 결과가 없는 사진은 빼고 놓아야 한다.', () => {
    render(<OutfitFloor items={ITEMS} seed={SEED} />);

    fireEvent.load(screen.getByAltText('하의'));
    advance(TIMEOUT_MS);

    expect(screen.queryByAltText('상의')).not.toBeInTheDocument();
    expect(screen.getByAltText('하의')).toBeVisible();
  });

  test('8초까지 아무 결과가 없으면 사진을 불러오지 못했다고 안내해야 한다.', () => {
    render(<OutfitFloor items={ITEMS} seed={SEED} />);

    advance(TIMEOUT_MS);

    expect(screen.getByText('사진을 불러오지 못했어요')).toBeInTheDocument();
  });
});

describe('넘친 옷', () => {
  test('8개를 넘으면 넘친 수를 보여 줘야 한다.', () => {
    render(
      <OutfitFloor items={MANY_ITEMS} seed={SEED} onOverflowClick={vi.fn()} />,
    );

    loadAll();

    expect(screen.getByRole('button', { name: /2개 보기/ })).toHaveTextContent(
      '+2',
    );
  });

  test('넘친 수를 누르면 알려야 한다.', () => {
    const onOverflowClick = vi.fn();

    render(
      <OutfitFloor
        items={MANY_ITEMS}
        seed={SEED}
        onOverflowClick={onOverflowClick}
      />,
    );

    loadAll();
    fireEvent.click(screen.getByRole('button', { name: /2개 보기/ }));

    expect(onOverflowClick).toHaveBeenCalledOnce();
  });

  test('사진을 불러오지 못한 옷은 넘친 수에 넣지 않아야 한다.', () => {
    render(
      <OutfitFloor items={MANY_ITEMS} seed={SEED} onOverflowClick={vi.fn()} />,
    );

    loadAll(['시계', '반지']);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('8개 이하면 넘친 수가 없어야 한다.', () => {
    render(<OutfitFloor items={ITEMS} seed={SEED} onOverflowClick={vi.fn()} />);

    loadAll();

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('비활성이면 넘친 수를 눌러도 알리지 않아야 한다.', () => {
    const onOverflowClick = vi.fn();

    render(
      <OutfitFloor
        items={MANY_ITEMS}
        seed={SEED}
        isOverflowDisabled
        onOverflowClick={onOverflowClick}
      />,
    );

    loadAll();
    fireEvent.click(screen.getByRole('button', { name: /2개 보기/ }));

    expect(onOverflowClick).not.toHaveBeenCalled();
  });
});

describe('바닥 위에 바로 그리는 모습', () => {
  test('사진을 모두 불러오지 못해도 없는 정보 확인을 안내하지 않아야 한다.', () => {
    render(<OutfitFloor items={ITEMS} seed={SEED} variant="floor" />);

    loadAll(['상의', '하의']);

    expect(screen.getByText('사진을 불러오지 못했어요')).toBeInTheDocument();
    expect(
      screen.queryByText('정보 확인에서 아이템을 볼 수 있어요.'),
    ).not.toBeInTheDocument();
  });
});

const getStagePlacement = (variant: 'card' | 'floor') => {
  render(<Stage data-testid="stage" $variant={variant} $hasTagStrip />);

  const { top, transform } = getComputedStyle(screen.getByTestId('stage'));

  return {
    top,
    transform: transform.replace(/\s/g, ''),
  };
};

describe('배치 영역의 자리', () => {
  test('바닥 위에서는 남는 공간의 가운데에 둬야 한다.', () => {
    const { top, transform } = getStagePlacement('floor');

    expect(top).toBe('50%');
    expect(transform).toBe('translate(-50%,-50%)');
  });

  test('카드 안에서는 위쪽에 붙여야 한다.', () => {
    const { top, transform } = getStagePlacement('card');

    expect(top).toBe('0px');
    expect(transform).toBe('translate(-50%,0%)');
  });
});

describe('등장 애니메이션', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('사진 결과가 정해지기 전에는 재생을 시작하지 않아야 한다.', () => {
    const onPlay = vi.fn();

    render(
      <OutfitFloor
        items={ITEMS}
        seed={SEED}
        entrance={{ isActive: true, onPlay }}
      />,
    );
    fireEvent.load(screen.getByAltText('상의'));

    expect(onPlay).not.toHaveBeenCalled();
  });

  test('사진 결과가 모두 정해지면 재생을 시작해야 한다.', () => {
    const onPlay = vi.fn();

    render(
      <OutfitFloor
        items={ITEMS}
        seed={SEED}
        entrance={{ isActive: true, onPlay }}
      />,
    );
    loadAll();

    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(screen.getByAltText('상의')).toBeVisible();
  });

  test('보고 있는 자리가 아니면 옷을 숨긴 채 기다려야 한다.', () => {
    const onPlay = vi.fn();

    render(
      <OutfitFloor
        items={ITEMS}
        seed={SEED}
        entrance={{ isActive: false, onPlay }}
      />,
    );
    loadAll();

    expect(onPlay).not.toHaveBeenCalled();
    expect(screen.getByAltText('상의')).not.toBeVisible();
    expect(screen.getByAltText('하의')).not.toBeVisible();
  });

  test('보게 되면 그때 재생을 시작해야 한다.', () => {
    const onPlay = vi.fn();
    const { rerender } = render(
      <OutfitFloor
        items={ITEMS}
        seed={SEED}
        entrance={{ isActive: false, onPlay }}
      />,
    );

    loadAll();
    rerender(
      <OutfitFloor
        items={ITEMS}
        seed={SEED}
        entrance={{ isActive: true, onPlay }}
      />,
    );

    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  test('재생을 시작한 뒤에는 등장 설정이 없어져도 다시 숨기지 않아야 한다.', () => {
    const { rerender } = render(
      <OutfitFloor items={ITEMS} seed={SEED} entrance={{ isActive: true }} />,
    );

    loadAll();
    rerender(<OutfitFloor items={ITEMS} seed={SEED} />);

    expect(screen.getByAltText('상의')).toBeVisible();
  });

  test('숨긴 채 기다리다 등장 설정이 없어지면 바로 보여 줘야 한다.', () => {
    const { rerender } = render(
      <OutfitFloor items={ITEMS} seed={SEED} entrance={{ isActive: false }} />,
    );

    loadAll();
    rerender(<OutfitFloor items={ITEMS} seed={SEED} />);

    expect(screen.getByAltText('상의')).toBeVisible();
  });

  test('등장 설정이 없으면 바로 보여 줘야 한다.', () => {
    render(<OutfitFloor items={ITEMS} seed={SEED} />);
    loadAll();

    expect(screen.getByAltText('상의')).toBeVisible();
  });

  test('움직임 줄이기 설정이면 재생하지 않고 바로 보여 줘야 한다.', () => {
    const onPlay = vi.fn();

    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    render(
      <OutfitFloor
        items={ITEMS}
        seed={SEED}
        entrance={{ isActive: true, onPlay }}
      />,
    );
    loadAll();

    expect(onPlay).not.toHaveBeenCalled();
    expect(screen.getByAltText('상의')).toBeVisible();
  });
});
