import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { DEFAULT_CORNERS } from '@/domains/clothingImageEdit/perspective';
import type { Rect } from '@/domains/clothingImageEdit/brush';
import { createMaskUploader } from './maskUploader';

const RENDER_OPTIONS = {
  corners: DEFAULT_CORNERS,
  angle: 0,
  faintOpacity: 0.3,
};

// jsdom에는 ImageData가 없어 크기만 든 대역을 둔다.
class FakeImageData {
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
}

const setup = () => {
  const frames: (() => void)[] = [];
  const renderer = {
    setMask: vi.fn(),
    updateMaskRegion: vi.fn(),
    render: vi.fn(() => null),
  };
  const readRegion = vi.fn(
    (_mask: HTMLCanvasElement, rect: Rect) =>
      new ImageData(rect.width, rect.height),
  );
  const uploader = createMaskUploader({
    renderer,
    mask: document.createElement('canvas'),
    getRenderOptions: () => RENDER_OPTIONS,
    readRegion,
    requestFrame: (callback) => frames.push(callback),
    cancelFrame: vi.fn(),
  });
  const runFrames = () => {
    for (const frame of frames.splice(0)) {
      frame();
    }
  };

  return { renderer, readRegion, uploader, frames, runFrames };
};

beforeEach(() => {
  vi.stubGlobal('ImageData', FakeImageData);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('칠한 영역 올리기', () => {
  test('한 프레임 안에 칠한 영역을 합쳐 한 번만 올리고 다시 그려야 한다.', () => {
    const { renderer, readRegion, uploader, frames, runFrames } = setup();

    uploader.markDirty({ x: 10, y: 10, width: 5, height: 5 });
    uploader.markDirty({ x: 20, y: 0, width: 5, height: 5 });

    expect(frames).toHaveLength(1);
    expect(renderer.updateMaskRegion).not.toHaveBeenCalled();

    runFrames();

    expect(readRegion).toHaveBeenCalledWith(expect.anything(), {
      x: 10,
      y: 0,
      width: 15,
      height: 15,
    });
    expect(renderer.updateMaskRegion).toHaveBeenCalledTimes(1);
    expect(renderer.updateMaskRegion).toHaveBeenCalledWith(
      expect.objectContaining({ x: 10, y: 0 }),
    );
    expect(renderer.render).toHaveBeenCalledWith(RENDER_OPTIONS);
  });

  test('전체를 올리라고 하면 영역 대신 마스크 전체를 올려야 한다.', () => {
    const { renderer, uploader, runFrames } = setup();

    uploader.markDirty({ x: 1, y: 1, width: 1, height: 1 });
    uploader.markAllDirty();
    runFrames();

    expect(renderer.setMask).toHaveBeenCalledTimes(1);
    expect(renderer.updateMaskRegion).not.toHaveBeenCalled();
    expect(renderer.render).toHaveBeenCalledTimes(1);
  });

  test('칠한 영역이 없으면 프레임을 잡지 않아야 한다.', () => {
    const { uploader, frames } = setup();

    uploader.markDirty(null);

    expect(frames).toHaveLength(0);
  });

  test('정리한 뒤에는 남은 영역을 올리지 않아야 한다.', () => {
    const { renderer, uploader, runFrames } = setup();

    uploader.markDirty({ x: 1, y: 1, width: 1, height: 1 });
    uploader.dispose();
    runFrames();

    expect(renderer.updateMaskRegion).not.toHaveBeenCalled();
    expect(renderer.render).not.toHaveBeenCalled();
  });
});
