import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { OutfitItemResult } from '@/generated/models';
import OutfitFloor from './OutfitFloor';

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
