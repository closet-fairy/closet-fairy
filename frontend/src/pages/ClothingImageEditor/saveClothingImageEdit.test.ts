import { describe, expect, test, vi } from 'vitest';
import { DEFAULT_CORNERS } from '@/domains/clothingImageEdit/perspective';
import type { SaveRequest } from '@/domains/clothingImageEdit/saveRequests';
import type { Quad } from '@/domains/clothingImageEdit/types';
import type { ClothingDetail } from '@/generated/models';
import type { ImageEditorState } from '@/pages/ClothingImageEditor/imageEditorState';
import {
  createSaveEditBody,
  createSaveSession,
  saveClothingImageEdit,
} from './saveClothingImageEdit';
import type { SaveFiles, SaveJob } from './saveClothingImageEdit';

const CORNERS: Quad = [
  [0.1, 0.05],
  [0.9, 0.1],
  [0.95, 0.9],
  [0.05, 0.95],
];

const createState = (
  overrides: Partial<ImageEditorState> = {},
): ImageEditorState => ({
  step: 'rotation',
  quarterTurns: 0,
  tilt: 0,
  corners: DEFAULT_CORNERS,
  maskStatus: 'initial',
  maskVersion: 0,
  ...overrides,
});

const createResponse = (maskUrl: string | null): ClothingDetail => ({
  clothing_id: 1,
  processing_status_cd: 'completed',
  is_queued: false,
  image_url: '/media/clothing/1/cutout.webp',
  failure_reason: null,
  is_new: false,
  category_cd: 'top',
  item_name: null,
  created_at: '2026-10-25T10:00:00+09:00',
  origin_image_url: '/media/clothing/1/origin.webp',
  cutout_image_url: '/media/clothing/1/cutout.webp',
  accessory_type_cd: null,
  color_cd: null,
  color_text: null,
  thickness_cd: null,
  is_waterproof: null,
  style_cds: [],
  season_cds: [],
  edit: {
    rotation_angle: 0,
    perspective_param: null,
    brush_mask_url: maskUrl,
    display_image_url: null,
  },
});

const FILES: SaveFiles = {
  mask: new File(['mask'], 'mask.png', { type: 'image/png' }),
  display: new File(['display'], 'display.png', { type: 'image/png' }),
};

const createFiles = () =>
  vi.fn<(requests: readonly SaveRequest[]) => Promise<SaveFiles>>(() =>
    Promise.resolve(FILES),
  );

interface SendRequestOptions {
  failAt?: SaveRequest;
  maskUrl?: string | null;
}

const createSendRequest = (options: SendRequestOptions = {}) => {
  const { failAt, maskUrl = null } = options;

  return vi.fn<(request: SaveRequest, job: SaveJob) => Promise<ClothingDetail>>(
    (request) => {
      if (request === failAt) {
        return Promise.reject(new Error(`${request} 실패`));
      }

      return Promise.resolve(
        createResponse(request === 'resetEdit' ? null : maskUrl),
      );
    },
  );
};

const getSentRequests = (sendRequest: ReturnType<typeof createSendRequest>) =>
  sendRequest.mock.calls.map(([request]) => request);

describe('회전·원근 저장 본문', () => {
  test('저장할 각도와 꼭짓점을 본문으로 바꿔야 한다.', () => {
    const body = createSaveEditBody(
      createState({ quarterTurns: 1, tilt: -6, corners: CORNERS }),
    );

    expect(body).toEqual({
      rotation_angle: 84,
      perspective_param: {
        corners: [
          [0.1, 0.05],
          [0.9, 0.1],
          [0.95, 0.9],
          [0.05, 0.95],
        ],
      },
    });
  });

  test('기본값으로 볼 만큼 가까운 꼭짓점은 원근 없음으로 보내야 한다.', () => {
    const body = createSaveEditBody(
      createState({
        corners: [
          [0.0005, 0],
          [1, 0.0005],
          [1, 1],
          [0, 1],
        ],
      }),
    );

    expect(body.perspective_param).toBeNull();
  });
});

describe('저장할 것이 없을 때', () => {
  test('바뀐 게 없으면 요청 없이 저장된 것으로 끝내야 한다.', async () => {
    const sendRequest = createSendRequest();
    const files = createFiles();

    const { outcome } = await saveClothingImageEdit({
      session: createSaveSession(false),
      state: createState(),
      isChanged: false,
      hasInvalidSavedEdit: false,
      createFiles: files,
      sendRequest,
    });

    expect(outcome).toEqual({ status: 'saved', response: null });
    expect(files).not.toHaveBeenCalled();
    expect(sendRequest).not.toHaveBeenCalled();
  });

  test('저장된 원근값을 쓸 수 없었으면 바뀐 게 없어도 저장해야 한다.', async () => {
    const sendRequest = createSendRequest();

    const { outcome } = await saveClothingImageEdit({
      session: createSaveSession(false),
      state: createState(),
      isChanged: false,
      hasInvalidSavedEdit: true,
      createFiles: createFiles(),
      sendRequest,
    });

    expect(outcome.status).toBe('saved');
    expect(getSentRequests(sendRequest)).toEqual(['resetEdit']);
  });
});

describe('요청 순서', () => {
  test('칠한 마스크가 있으면 회전·원근, 마스크, 표시 이미지 순서로 보내야 한다.', async () => {
    const sendRequest = createSendRequest({ maskUrl: '/media/mask.png' });

    const { outcome, session } = await saveClothingImageEdit({
      session: createSaveSession(false),
      state: createState({ maskStatus: 'edited', tilt: 3 }),
      isChanged: true,
      hasInvalidSavedEdit: false,
      createFiles: createFiles(),
      sendRequest,
    });

    expect(getSentRequests(sendRequest)).toEqual([
      'saveEdit',
      'saveMask',
      'saveDisplay',
    ]);
    expect(outcome).toEqual({
      status: 'saved',
      response: createResponse('/media/mask.png'),
    });
    expect(session).toEqual(createSaveSession(true));
  });

  test('요청을 보내기 전에 필요한 파일을 모두 만들어야 한다.', async () => {
    const order: string[] = [];
    const files = vi.fn((requests: readonly SaveRequest[]) => {
      order.push(`files:${requests.join(',')}`);

      return Promise.resolve(FILES);
    });
    const sendRequest = vi.fn((request: SaveRequest) => {
      order.push(request);

      return Promise.resolve(createResponse(null));
    });

    await saveClothingImageEdit({
      session: createSaveSession(false),
      state: createState({ tilt: 3 }),
      isChanged: true,
      hasInvalidSavedEdit: false,
      createFiles: files,
      sendRequest,
    });

    expect(order).toEqual([
      'files:saveEdit,saveDisplay',
      'saveEdit',
      'saveDisplay',
    ]);
  });

  test('파일을 만들지 못하면 요청을 보내지 않고 실패해야 한다.', async () => {
    const sendRequest = createSendRequest();

    const { outcome, session } = await saveClothingImageEdit({
      session: createSaveSession(false),
      state: createState({ tilt: 3 }),
      isChanged: true,
      hasInvalidSavedEdit: false,
      createFiles: () => Promise.reject(new Error('그리기 실패')),
      sendRequest,
    });

    expect(outcome).toEqual({ status: 'fileFailed' });
    expect(session.pendingJob).toBeNull();
    expect(sendRequest).not.toHaveBeenCalled();
  });
});

describe('실패 뒤 다시 시도', () => {
  test('편집 상태가 그대로면 실패한 요청부터 같은 파일로 이어 보내야 한다.', async () => {
    const state = createState({ maskStatus: 'edited', tilt: 3 });
    const files = createFiles();
    const failing = createSendRequest({
      failAt: 'saveMask',
      maskUrl: null,
    });

    const first = await saveClothingImageEdit({
      session: createSaveSession(false),
      state,
      isChanged: true,
      hasInvalidSavedEdit: false,
      createFiles: files,
      sendRequest: failing,
    });

    expect(first.outcome.status).toBe('requestFailed');
    expect(first.session.pendingJob?.nextIndex).toBe(1);

    const retrying = createSendRequest({ maskUrl: '/media/mask.png' });
    const second = await saveClothingImageEdit({
      session: first.session,
      state,
      isChanged: true,
      hasInvalidSavedEdit: false,
      createFiles: files,
      sendRequest: retrying,
    });

    expect(getSentRequests(retrying)).toEqual(['saveMask', 'saveDisplay']);
    expect(retrying.mock.calls[0]?.[1].files).toBe(FILES);
    expect(files).toHaveBeenCalledTimes(1);
    expect(second.outcome.status).toBe('saved');
    expect(second.session.pendingJob).toBeNull();
  });

  test('마스크까지 저장된 뒤 붓질을 모두 실행 취소했으면, 회전을 남긴 채 처음에 저장된 마스크가 없던 옷은 초기화부터 다시 보내야 한다.', async () => {
    const files = createFiles();
    const first = await saveClothingImageEdit({
      session: createSaveSession(false),
      state: createState({ tilt: 3, maskStatus: 'edited', maskVersion: 3 }),
      isChanged: true,
      hasInvalidSavedEdit: false,
      createFiles: files,
      sendRequest: createSendRequest({
        failAt: 'saveDisplay',
        maskUrl: '/media/mask.png',
      }),
    });

    expect(first.session.hasSavedMask).toBe(true);

    const retrying = createSendRequest();
    const second = await saveClothingImageEdit({
      session: first.session,
      state: createState({ tilt: 3, maskStatus: 'initial', maskVersion: 5 }),
      isChanged: false,
      hasInvalidSavedEdit: false,
      createFiles: files,
      sendRequest: retrying,
    });

    expect(getSentRequests(retrying)).toEqual([
      'resetEdit',
      'saveEdit',
      'saveDisplay',
    ]);
    expect(second.outcome.status).toBe('saved');
  });

  test('마스크까지 저장된 뒤 붓질을 모두 실행 취소했으면, 처음에 저장된 마스크가 있던 옷은 지금 마스크를 다시 올려야 한다.', async () => {
    const files = createFiles();
    const first = await saveClothingImageEdit({
      session: createSaveSession(true),
      state: createState({ maskStatus: 'edited', maskVersion: 3 }),
      isChanged: true,
      hasInvalidSavedEdit: false,
      createFiles: files,
      sendRequest: createSendRequest({
        failAt: 'saveDisplay',
        maskUrl: '/media/mask-2.png',
      }),
    });

    const retrying = createSendRequest({ maskUrl: '/media/mask-3.png' });
    await saveClothingImageEdit({
      session: first.session,
      state: createState({ maskStatus: 'initial', maskVersion: 5 }),
      isChanged: false,
      hasInvalidSavedEdit: false,
      createFiles: files,
      sendRequest: retrying,
    });

    expect(getSentRequests(retrying)).toEqual([
      'saveEdit',
      'saveMask',
      'saveDisplay',
    ]);
  });

  test('회전·원근만 저장된 뒤에는 불러온 마스크를 그대로 두어야 한다.', async () => {
    const files = createFiles();
    const first = await saveClothingImageEdit({
      session: createSaveSession(true),
      state: createState({ tilt: 3 }),
      isChanged: true,
      hasInvalidSavedEdit: false,
      createFiles: files,
      sendRequest: createSendRequest({
        failAt: 'saveDisplay',
        maskUrl: '/media/mask.png',
      }),
    });

    const retrying = createSendRequest({ maskUrl: '/media/mask.png' });
    await saveClothingImageEdit({
      session: first.session,
      state: createState({ tilt: 4 }),
      isChanged: true,
      hasInvalidSavedEdit: false,
      createFiles: files,
      sendRequest: retrying,
    });

    expect(getSentRequests(retrying)).toEqual(['saveEdit', 'saveDisplay']);
  });

  test('실패한 뒤 단계만 옮겼으면 실패한 요청부터 이어 보내야 한다.', async () => {
    const state = createState({ tilt: 3 });
    const files = createFiles();
    const first = await saveClothingImageEdit({
      session: createSaveSession(false),
      state,
      isChanged: true,
      hasInvalidSavedEdit: false,
      createFiles: files,
      sendRequest: createSendRequest({ failAt: 'saveDisplay' }),
    });

    const retrying = createSendRequest();
    await saveClothingImageEdit({
      session: first.session,
      state: { ...state, step: 'brush' },
      isChanged: true,
      hasInvalidSavedEdit: false,
      createFiles: files,
      sendRequest: retrying,
    });

    expect(getSentRequests(retrying)).toEqual(['saveDisplay']);
    expect(files).toHaveBeenCalledTimes(1);
  });

  test('실패한 뒤 편집했으면 서버의 지금 마스크 상태로 처음부터 다시 계획해야 한다.', async () => {
    const failing = createSendRequest({ failAt: 'saveEdit' });

    const first = await saveClothingImageEdit({
      session: createSaveSession(true),
      state: createState({ maskStatus: 'default', tilt: 3 }),
      isChanged: true,
      hasInvalidSavedEdit: false,
      createFiles: createFiles(),
      sendRequest: failing,
    });

    expect(getSentRequests(failing)).toEqual(['resetEdit', 'saveEdit']);
    expect(first.session.hasSavedMask).toBe(false);

    const files = createFiles();
    const retrying = createSendRequest();
    await saveClothingImageEdit({
      session: first.session,
      state: createState({ maskStatus: 'default', tilt: 5 }),
      isChanged: true,
      hasInvalidSavedEdit: false,
      createFiles: files,
      sendRequest: retrying,
    });

    expect(files).toHaveBeenCalledTimes(1);
    expect(getSentRequests(retrying)).toEqual(['saveEdit', 'saveDisplay']);
  });

  test('중간까지 저장된 뒤 처음 상태로 되돌렸으면 바뀐 게 없어도 다시 저장해야 한다.', async () => {
    const failing = createSendRequest({ failAt: 'saveDisplay' });

    const first = await saveClothingImageEdit({
      session: createSaveSession(false),
      state: createState({ tilt: 3 }),
      isChanged: true,
      hasInvalidSavedEdit: false,
      createFiles: createFiles(),
      sendRequest: failing,
    });

    expect(first.outcome).toMatchObject({
      status: 'requestFailed',
      lastResponse: createResponse(null),
    });
    expect(first.session.isServerChanged).toBe(true);

    const retrying = createSendRequest();
    const second = await saveClothingImageEdit({
      session: first.session,
      state: createState(),
      isChanged: false,
      hasInvalidSavedEdit: false,
      createFiles: createFiles(),
      sendRequest: retrying,
    });

    expect(getSentRequests(retrying)).toEqual(['resetEdit']);
    expect(second.session.isServerChanged).toBe(false);
  });

  test('첫 요청부터 실패했으면 서버가 바뀌지 않은 것으로 남겨야 한다.', async () => {
    const { outcome, session } = await saveClothingImageEdit({
      session: createSaveSession(false),
      state: createState({ tilt: 3 }),
      isChanged: true,
      hasInvalidSavedEdit: false,
      createFiles: createFiles(),
      sendRequest: createSendRequest({ failAt: 'saveEdit' }),
    });

    expect(outcome).toMatchObject({
      status: 'requestFailed',
      lastResponse: null,
    });
    expect(session.isServerChanged).toBe(false);
    expect(session.pendingJob?.nextIndex).toBe(0);
  });
});
