import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import SplashBackground from './SplashBackground';
import { SPLASH_VIDEO_URLS } from './SplashBackground.constants';

const renderBackground = () => {
  const { unmount } = render(
    <SplashBackground>
      <p>화면</p>
    </SplashBackground>,
  );
  const [first, second] =
    screen.getAllByTestId<HTMLVideoElement>('splash-video');

  return { first, second, unmount };
};

const fire = (video: HTMLVideoElement, type: string) => {
  act(() => {
    video.dispatchEvent(new Event(type));
  });
};

const flushPromises = () =>
  act(async () => {
    await Promise.resolve();
  });

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'connection');
});

describe('영상 배경', () => {
  test('첫 영상만 받아 재생을 시작하고 재생이 시작되기 전에는 영상이 보이지 않아야 한다.', () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play');
    const { first, second } = renderBackground();

    expect(screen.getByText('화면')).toBeInTheDocument();
    expect(first).toHaveAttribute('src', SPLASH_VIDEO_URLS[0]);
    expect(second).not.toHaveAttribute('src');
    expect(play).toHaveBeenCalledTimes(1);
    expect(play.mock.contexts[0]).toBe(first);
    expect(first).not.toBeVisible();
    expect(first.muted).toBe(true);
  });

  test('첫 영상이 재생되기 시작하면 보이고, 그때 다음 영상을 받기 시작해야 한다.', () => {
    const { first, second } = renderBackground();

    fire(first, 'playing');

    expect(first).toBeVisible();
    expect(second).toHaveAttribute('src', SPLASH_VIDEO_URLS[1]);
    expect(second).not.toBeVisible();
  });

  test('영상이 끝나면 다음 영상을 재생하고, 그 영상이 재생되기 시작한 뒤에 앞으로 바뀌어야 한다.', () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play');
    const { first, second } = renderBackground();

    fire(first, 'playing');
    fire(first, 'ended');

    expect(play).toHaveBeenCalledTimes(2);
    expect(play.mock.contexts[1]).toBe(second);
    expect(first.dataset.state).toBe('front');
    expect(second).not.toBeVisible();

    fire(second, 'playing');

    expect(second.dataset.state).toBe('front');
    expect(first.dataset.state).toBe('back');
    expect(first).toHaveAttribute('src', SPLASH_VIDEO_URLS[2]);
  });

  test('영상 4개를 차례로 재생한 뒤 첫 영상으로 돌아와야 한다.', () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play');
    const { first, second } = renderBackground();
    const slots = [first, second];
    const played: (string | null)[] = [];

    for (let index = 0; index < 5; index += 1) {
      const video = slots[index % 2];

      fire(video, 'playing');
      played.push(video.getAttribute('src'));
      fire(video, 'ended');
    }

    expect(played).toEqual([
      SPLASH_VIDEO_URLS[0],
      SPLASH_VIDEO_URLS[1],
      SPLASH_VIDEO_URLS[2],
      SPLASH_VIDEO_URLS[3],
      SPLASH_VIDEO_URLS[0],
    ]);
    expect(play.mock.contexts).toEqual([
      first,
      second,
      first,
      second,
      first,
      second,
    ]);
  });

  test('쉬고 있는 영상이 보내는 끝남 이벤트는 무시해야 한다.', () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play');
    const { first, second } = renderBackground();

    fire(first, 'playing');
    fire(second, 'ended');

    expect(play).toHaveBeenCalledTimes(1);
  });

  test('재생 중에 같은 영상의 재생 이벤트가 다시 와도 다음 영상을 다시 받지 않아야 한다.', () => {
    const load = vi.spyOn(HTMLMediaElement.prototype, 'load');
    const { first } = renderBackground();

    fire(first, 'playing');
    const loadCount = load.mock.calls.length;
    fire(first, 'playing');

    expect(load).toHaveBeenCalledTimes(loadCount);
  });

  test('자동 재생이 막히면 영상이 보이지 않고 받던 영상도 비워야 한다.', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(
      new DOMException('blocked', 'NotAllowedError'),
    );
    const { first } = renderBackground();

    await flushPromises();
    fire(first, 'playing');

    expect(first).not.toBeVisible();
    expect(first).not.toHaveAttribute('src');
  });

  test('재생 요청이 중간에 끊겨도 영상을 포기하지 않고 다시 보일 때 이어서 재생해야 한다.', async () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockRejectedValueOnce(new DOMException('interrupted', 'AbortError'));
    const { first } = renderBackground();

    await flushPromises();

    expect(first).toHaveAttribute('src', SPLASH_VIDEO_URLS[0]);

    vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));

    expect(play).toHaveBeenCalledTimes(2);
    expect(play.mock.contexts[1]).toBe(first);
  });

  test('재생 중인 영상을 불러오지 못하면 영상이 보이지 않아야 한다.', () => {
    const { first } = renderBackground();

    fire(first, 'playing');
    fire(first, 'error');

    expect(first).not.toBeVisible();
    expect(first).not.toHaveAttribute('src');
  });

  test('화면에서 사라지면 두 영상 모두 받기를 멈춰야 한다.', () => {
    const { first, second, unmount } = renderBackground();

    fire(first, 'playing');
    unmount();

    expect(first).not.toHaveAttribute('src');
    expect(second).not.toHaveAttribute('src');
  });
});

describe('움직임 줄이기와 데이터 절약', () => {
  test('움직임 줄이기를 켰으면 영상 대신 첫 프레임 이미지를 보여 주어야 한다.', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play');
    render(<SplashBackground>{null}</SplashBackground>);

    expect(screen.queryByTestId('splash-video')).not.toBeInTheDocument();
    expect(screen.getByTestId('splash-still')).toBeInTheDocument();
    expect(play).not.toHaveBeenCalled();
  });

  test('데이터 절약 모드이면 영상도 이미지도 받지 않아야 한다.', () => {
    Object.defineProperty(navigator, 'connection', {
      value: { saveData: true },
      configurable: true,
    });
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play');
    render(<SplashBackground>{null}</SplashBackground>);

    expect(screen.queryByTestId('splash-video')).not.toBeInTheDocument();
    expect(screen.queryByTestId('splash-still')).not.toBeInTheDocument();
    expect(play).not.toHaveBeenCalled();
  });
});
