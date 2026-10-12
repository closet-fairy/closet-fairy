import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import Carousel from './Carousel';

const SLIDE_WIDTH = 300;

const SLIDE_LABEL_PATTERN = /^(\d+) \/ \d+$/;

const getSlideOffset = (element: HTMLElement) => {
  const match = SLIDE_LABEL_PATTERN.exec(
    element.getAttribute('aria-label') ?? '',
  );

  return match ? (Number(match[1]) - 1) * SLIDE_WIDTH : 0;
};

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(
    SLIDE_WIDTH,
  );
  vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(
    function (this: HTMLElement) {
      return getSlideOffset(this);
    },
  );
});

afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const renderCarousel = (onIndexChange?: (index: number) => void) =>
  render(
    <Carousel
      aria-label="추천 코디"
      isLooped={false}
      onIndexChange={onIndexChange}
    >
      <p>첫 번째 코디</p>
      <p>두 번째 코디</p>
      <p>세 번째 코디</p>
    </Carousel>,
  );

describe('접근성 구조', () => {
  test('캐러셀은 이름이 있는 영역으로, 슬라이드는 순서를 이름으로 하는 그룹으로 그려져야 한다.', () => {
    renderCarousel();

    expect(
      screen.getByRole('region', { name: '추천 코디' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '1 / 3' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '3 / 3' })).toBeInTheDocument();
  });

  test('슬라이드가 한 장뿐이면 화살표를 그리지 않아야 한다.', () => {
    render(
      <Carousel aria-label="추천 코디">
        <p>첫 번째 코디</p>
      </Carousel>,
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('화살표로 넘기기', () => {
  test('다음 화살표를 누르면 다음 순서로 onIndexChange를 호출해야 한다.', async () => {
    const user = userEvent.setup();
    const handleIndexChange = vi.fn();
    renderCarousel(handleIndexChange);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: '이전 슬라이드' }),
      ).toBeDisabled();
    });
    await user.click(screen.getByRole('button', { name: '다음 슬라이드' }));

    expect(handleIndexChange).toHaveBeenLastCalledWith(1);
  });

  test('순환을 끄면 첫 슬라이드에서 이전 화살표가 비활성되어야 한다.', async () => {
    renderCarousel();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: '이전 슬라이드' }),
      ).toBeDisabled();
    });
    expect(screen.getByRole('button', { name: '다음 슬라이드' })).toBeEnabled();
  });
});

describe('제어형 index', () => {
  test('index가 바뀌면 그 슬라이드로 이동하고 onIndexChange를 호출해야 한다.', async () => {
    const handleIndexChange = vi.fn();
    const slides = [<p key="1">첫 번째 코디</p>, <p key="2">두 번째 코디</p>];
    const { rerender } = render(
      <Carousel
        aria-label="추천 코디"
        index={0}
        isLooped={false}
        onIndexChange={handleIndexChange}
      >
        {slides}
      </Carousel>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: '이전 슬라이드' }),
      ).toBeDisabled();
    });
    rerender(
      <Carousel
        aria-label="추천 코디"
        index={1}
        isLooped={false}
        onIndexChange={handleIndexChange}
      >
        {slides}
      </Carousel>,
    );

    expect(handleIndexChange).toHaveBeenLastCalledWith(1);
  });
});
