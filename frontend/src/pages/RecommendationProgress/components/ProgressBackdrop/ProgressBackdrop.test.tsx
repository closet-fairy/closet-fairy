import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import ProgressBackdrop from './ProgressBackdrop';

const matchMediaDescriptor = Object.getOwnPropertyDescriptor(
  window,
  'matchMedia',
);

const stubReducedMotion = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
};

const setVisibility = (state: DocumentVisibilityState) => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: state,
  });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
};

const renderBackdrop = () =>
  render(
    <ProgressBackdrop>
      <p>콘텐츠</p>
    </ProgressBackdrop>,
  );

const getVideo = () => screen.queryByTestId('progress-video');
const getStill = () => screen.queryByTestId('progress-still');

afterEach(() => {
  if (matchMediaDescriptor) {
    Object.defineProperty(window, 'matchMedia', matchMediaDescriptor);
  }
  Reflect.deleteProperty(navigator, 'connection');
  Reflect.deleteProperty(document, 'visibilityState');
  vi.restoreAllMocks();
});

describe('배경 영상 재생', () => {
  test('콘텐츠 뒤에 소리 없이 반복 재생하는 영상을 깔아야 한다.', () => {
    renderBackdrop();
    const video = getVideo();

    expect(screen.getByText('콘텐츠')).toBeInTheDocument();
    expect(video).not.toBeNull();
    expect(video).toHaveProperty('loop', true);
    expect(video).toHaveProperty('muted', true);
    expect(video).toHaveProperty('playsInline', true);
    expect(video).toHaveProperty('autoplay', true);
    expect(screen.getByTestId('progress-media')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(getStill()).toBeNull();
  });

  test('화면이 보이지 않으면 영상을 멈추고, 다시 보이면 이어서 재생해야 한다.', () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play');
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause');
    renderBackdrop();
    play.mockClear();

    setVisibility('hidden');

    expect(pause).toHaveBeenCalled();

    setVisibility('visible');

    expect(play).toHaveBeenCalledTimes(1);
  });
});

describe('영상을 쓰지 않는 경우', () => {
  test('움직임 줄이기를 켰으면 영상을 받지 않고 정지 이미지를 보여 줘야 한다.', () => {
    stubReducedMotion(true);
    renderBackdrop();

    expect(getVideo()).toBeNull();
    expect(getStill()).not.toBeNull();
    expect(getStill()).toHaveAttribute('alt', '');
  });

  test('데이터 절약 모드이면 영상을 받지 않고 정지 이미지를 보여 줘야 한다.', () => {
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: { saveData: true },
    });
    renderBackdrop();

    expect(getVideo()).toBeNull();
    expect(getStill()).not.toBeNull();
  });

  test('자동 재생이 막혀 재생에 실패하면 정지 이미지로 바꿔야 한다.', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(
      new DOMException('blocked', 'NotAllowedError'),
    );
    renderBackdrop();

    await waitFor(() => {
      expect(getVideo()).toBeNull();
    });
    expect(getStill()).not.toBeNull();
  });

  test('재생 요청이 중간에 끊겼을 뿐이면 영상을 그대로 둬야 한다.', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(
      new DOMException('interrupted', 'AbortError'),
    );
    renderBackdrop();

    await act(async () => {
      await Promise.resolve();
    });

    expect(getVideo()).not.toBeNull();
    expect(getStill()).toBeNull();
  });

  test('영상을 불러오지 못해도 정지 이미지로 바꿔야 한다.', () => {
    renderBackdrop();

    act(() => {
      getVideo()?.dispatchEvent(new Event('error'));
    });

    expect(getVideo()).toBeNull();
    expect(getStill()).not.toBeNull();
  });

  test('정지 이미지도 불러오지 못하면 아무것도 깔지 않아 흰 바탕만 남아야 한다.', () => {
    stubReducedMotion(true);
    renderBackdrop();

    act(() => {
      getStill()?.dispatchEvent(new Event('error'));
    });

    expect(getStill()).toBeNull();
    expect(getVideo()).toBeNull();
    expect(screen.getByText('콘텐츠')).toBeInTheDocument();
  });
});
