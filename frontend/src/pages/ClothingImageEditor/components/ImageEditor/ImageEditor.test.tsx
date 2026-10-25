import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterContextProvider,
} from '@tanstack/react-router';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { UNSUPPORTED_MESSAGE } from '@/pages/ClothingImageEditor/renderer/createEditorRenderer';
import ImageEditor from './ImageEditor';
import type {
  ImageEditorSaveResult,
  ImageEditorSaveStatus,
} from './ImageEditor';

/*
 * jsdom에는 2D 캔버스가 없어 마스크 사본을 만들 수 없으므로, 크기만 같은 빈 캔버스로 대신한다.
 * WebGL도 없어서 미리보기는 렌더러 생성에 실패하고 안내 문구로 바뀌지만, 나머지 화면은 그대로 뜬다.
 */
vi.mock('@/pages/ClothingImageEditor/renderer/loadEditorSources', () => ({
  cloneCanvas: (source: HTMLCanvasElement) => {
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;

    return canvas;
  },
}));

const createCanvas = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 40;
  canvas.height = 60;

  return canvas;
};

const createSources = () => ({
  size: { width: 40, height: 60 },
  base: createCanvas(),
  initialMask: createCanvas(),
  defaultMask: createCanvas(),
  hasSavedMask: false,
  isRestoreAvailable: true,
});

interface RenderEditorOptions {
  rotationAngle?: number;
  isSaving?: boolean;
  saveErrorMessage?: string | null;
  saveStatus?: ImageEditorSaveStatus;
}

// 편집기는 나가는 이동을 막으려고 라우터 context가 필요하므로, 편집기 주소에 있는 메모리 라우터로 감싼다.
const renderEditor = (options: RenderEditorOptions = {}) => {
  const {
    rotationAngle = 0,
    isSaving = false,
    saveErrorMessage = null,
    saveStatus = 'failed',
  } = options;
  const handleSave = vi.fn<
    (result: ImageEditorSaveResult) => Promise<ImageEditorSaveStatus>
  >(() => Promise.resolve(saveStatus));
  const handleClose = vi.fn();
  const history = createMemoryHistory({
    initialEntries: ['/closet/1/edit'],
  });
  const rootRoute = createRootRoute();
  const routeTree = rootRoute.addChildren([
    createRoute({ getParentRoute: () => rootRoute, path: '/closet' }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/closet/$clothingId/edit',
    }),
  ]);
  const router = createRouter({ routeTree, history });

  render(
    <RouterContextProvider router={router}>
      <ImageEditor
        sources={createSources()}
        initialEdit={{ rotationAngle, corners: null }}
        isSaving={isSaving}
        saveErrorMessage={saveErrorMessage}
        onSave={handleSave}
        onClose={handleClose}
      />
    </RouterContextProvider>,
  );

  return { handleSave, handleClose, history };
};

const goToRotationStep = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: /회전/ }));
};

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

describe('닫기', () => {
  test('바뀐 게 없으면 확인 없이 바로 닫아야 한다.', async () => {
    const user = userEvent.setup();
    const { handleClose } = renderEditor();

    await user.click(screen.getByRole('button', { name: '닫기' }));

    expect(handleClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('바뀐 게 있으면 버릴지 묻고, 계속 편집을 누르면 닫지 않아야 한다.', async () => {
    const user = userEvent.setup();
    const { handleClose } = renderEditor();

    await goToRotationStep(user);
    await user.click(
      screen.getByRole('button', { name: '오른쪽으로 90° 돌리기' }),
    );
    await user.click(screen.getByRole('button', { name: '닫기' }));

    expect(
      screen.getByRole('dialog', { name: '편집한 내용을 버릴까요?' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '계속 편집' }));

    expect(handleClose).not.toHaveBeenCalled();
  });

  test('바뀐 게 있을 때 버리기를 누르면 닫아야 한다.', async () => {
    const user = userEvent.setup();
    const { handleClose } = renderEditor();

    await goToRotationStep(user);
    await user.click(
      screen.getByRole('button', { name: '오른쪽으로 90° 돌리기' }),
    );
    await user.click(screen.getByRole('button', { name: '닫기' }));
    await user.click(screen.getByRole('button', { name: '버리기' }));

    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});

describe('원래대로', () => {
  test('바뀐 게 있으면 확인을 거쳐 각도를 처음 상태로 되돌려야 한다.', async () => {
    const user = userEvent.setup();
    renderEditor({ rotationAngle: 84 });

    await goToRotationStep(user);
    await user.click(
      screen.getByRole('button', { name: '오른쪽으로 90° 돌리기' }),
    );
    await user.click(screen.getByRole('button', { name: '원래대로' }));

    expect(
      screen.getByRole('dialog', { name: '편집 전으로 되돌릴까요?' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '되돌리기' }));

    expect(screen.getByRole('button', { name: /직접 입력/ })).toHaveTextContent(
      '0°',
    );
  });

  test('바뀐 게 없으면 묻지 않고 바로 처음 상태로 되돌려야 한다.', async () => {
    const user = userEvent.setup();
    renderEditor({ rotationAngle: 84 });

    await goToRotationStep(user);
    await user.click(screen.getByRole('button', { name: '원래대로' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /직접 입력/ })).toHaveTextContent(
      '0°',
    );
  });
});

describe('저장', () => {
  test('저장을 누르면 편집 상태와 마스크 캔버스를 넘겨야 한다.', async () => {
    const user = userEvent.setup();
    const { handleSave } = renderEditor({ rotationAngle: 84 });

    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(handleSave).toHaveBeenCalledTimes(1);
    const result = handleSave.mock.lastCall?.[0];
    expect(result?.state).toMatchObject({ quarterTurns: 1, tilt: -6 });
    expect(result?.mask).toBeInstanceOf(HTMLCanvasElement);
    expect(result?.isChanged).toBe(false);
  });

  test('저장에 성공하면 편집기를 닫아야 한다.', async () => {
    const user = userEvent.setup();
    const { handleClose } = renderEditor({ saveStatus: 'saved' });

    await goToRotationStep(user);
    await user.click(
      screen.getByRole('button', { name: '오른쪽으로 90° 돌리기' }),
    );
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  test('저장에 실패하면 편집기에 머물러야 한다.', async () => {
    const user = userEvent.setup();
    const { handleSave, handleClose } = renderEditor({ saveStatus: 'failed' });

    await goToRotationStep(user);
    await user.click(
      screen.getByRole('button', { name: '오른쪽으로 90° 돌리기' }),
    );
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(handleSave.mock.lastCall?.[0].isChanged).toBe(true);
    expect(handleClose).not.toHaveBeenCalled();
  });

  test('저장 중에는 로딩을 보여 주고 닫기, 단계, 원래대로를 막아야 한다.', () => {
    renderEditor({ isSaving: true });

    expect(screen.getByRole('status')).toHaveTextContent('저장 중…');
    expect(
      screen.queryByRole('button', { name: '저장' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '닫기' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '원래대로' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /회전/ })).toBeDisabled();
  });
});

describe('저장 실패 안내', () => {
  test('실패 문구와 다시 시도를 보여 주고, 다시 시도는 저장과 같은 일을 해야 한다.', async () => {
    const user = userEvent.setup();
    const { handleSave } = renderEditor({
      saveErrorMessage: '처리가 끝난 옷만 수정할 수 있습니다.',
    });

    expect(
      screen.getByText('처리가 끝난 옷만 수정할 수 있습니다.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(handleSave).toHaveBeenCalledTimes(1);
  });

  test('저장 중에는 다시 시도를 막아야 한다.', () => {
    renderEditor({
      isSaving: true,
      saveErrorMessage: '이미지를 저장하지 못했어요.',
    });

    expect(screen.getByRole('button', { name: '다시 시도' })).toBeDisabled();
  });
});

describe('편집기에서 나가는 이동', () => {
  test('바뀐 게 없으면 묻지 않고 이동해야 한다.', async () => {
    const { history } = renderEditor();

    await act(async () => {
      history.push('/closet');
      await Promise.resolve();
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(history.location.pathname).toBe('/closet');
  });

  test('바뀐 게 있으면 버릴지 묻고, 계속 편집을 누르면 머물러야 한다.', async () => {
    const user = userEvent.setup();
    const { history } = renderEditor();

    await goToRotationStep(user);
    await user.click(
      screen.getByRole('button', { name: '오른쪽으로 90° 돌리기' }),
    );
    act(() => {
      history.push('/closet');
    });

    expect(
      await screen.findByRole('dialog', { name: '편집한 내용을 버릴까요?' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '계속 편집' }));

    expect(history.location.pathname).toBe('/closet/1/edit');
  });

  test('바뀐 게 있을 때 버리기를 누르면 이동해야 한다.', async () => {
    const user = userEvent.setup();
    const { history, handleClose } = renderEditor();

    await goToRotationStep(user);
    await user.click(
      screen.getByRole('button', { name: '오른쪽으로 90° 돌리기' }),
    );
    act(() => {
      history.push('/closet');
    });
    await user.click(await screen.findByRole('button', { name: '버리기' }));

    expect(history.location.pathname).toBe('/closet');
    expect(handleClose).not.toHaveBeenCalled();
  });
});

describe('미리보기 실패', () => {
  test('렌더러를 만들지 못하면 안내 문구를 보여 줘야 한다.', () => {
    renderEditor();

    expect(screen.getByRole('alert')).toHaveTextContent(UNSUPPORTED_MESSAGE);
  });
});
