import { bypass, http, HttpResponse } from 'msw';
import type { JsonBodyType } from 'msw';
import type {
  ClothingCard,
  ClothingDetail,
  ClothingEdit,
  ClothingPage,
  ClothingProgress,
  ClothingStatusList,
  ClothingUploadResult,
  ErrorResponse,
} from '@/generated/models';
import {
  ClothingEditUpdate,
  ClothingUpdate,
  listClothingClothingGetParamsLimitDefault,
  listClothingClothingGetParamsLimitMax,
} from '@/generated/models';
import sampleCutoutUrl from '@/mocks/assets/clothing/cutout.webp';
import sampleDisplayUrl from '@/mocks/assets/clothing/display.webp';
import sampleMaskUrl from '@/mocks/assets/clothing/mask.png';
import sampleOriginUrl from '@/mocks/assets/clothing/origin.webp';

const MOCK_CLOTHING_ID = {
  NO_EDIT: 1,
  EDITED: 2,
  NOT_EDITABLE: 409,
  DISPLAY_INVALID: 422,
  DISPLAY_SERVER_ERROR: 500,
} as const;

/*
 * 옷장 목록용 옷 id. 목록은 id 내림차순이라, 처리 중인 옷이 실제처럼 맨 앞에 오도록
 * 편집기용 옷(MOCK_CLOTHING_ID)보다 큰 구간을 쓴다.
 */
const MOCK_LIST_ID = {
  FIRST: 600,
  LAST: 635,
  PROCESSING: 635,
  QUEUED: 634,
  FAILED: 633,
  UNTAGGED: 632,
  NEW_FROM: 630,
} as const;

const CUTOUT_SIZE = { width: 1536, height: 2048 } as const;

const MEMBER_MEDIA_PATH = '/media/clothing/1';

const SAMPLE_MEDIA = {
  origin: `${MEMBER_MEDIA_PATH}/sample.webp`,
  cutout: `${MEMBER_MEDIA_PATH}/sample_cutout.webp`,
  mask: `${MEMBER_MEDIA_PATH}/sample_mask.png`,
  display: `${MEMBER_MEDIA_PATH}/sample_display.webp`,
} as const;

const SAMPLE_MEDIA_ASSETS = new Map<string, string>([
  [SAMPLE_MEDIA.origin, sampleOriginUrl],
  [SAMPLE_MEDIA.cutout, sampleCutoutUrl],
  [SAMPLE_MEDIA.mask, sampleMaskUrl],
  [SAMPLE_MEDIA.display, sampleDisplayUrl],
]);

const SAMPLE_EDIT: ClothingEdit = {
  rotation_angle: 8,
  perspective_param: {
    corners: [
      [0.02, 0.01],
      [0.98, 0.02],
      [0.99, 0.99],
      [0.01, 0.98],
    ],
  },
  brush_mask_url: SAMPLE_MEDIA.mask,
  display_image_url: SAMPLE_MEDIA.display,
};

const CLOTHING_ID_PATTERN = /^\d+$/;

const ROTATION_ANGLE_PATTERN = /^-?\d{1,3}(\.\d{1,2})?$/;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const ERRORS = {
  NOT_FOUND: {
    status: 404,
    body: { code: 'CLOTHING_NOT_FOUND', message: '옷을 찾을 수 없습니다.' },
  },
  NOT_EDITABLE: {
    status: 409,
    body: {
      code: 'CLOTHING_NOT_EDITABLE',
      message: '처리가 끝난 옷만 수정할 수 있습니다.',
    },
  },
  VALIDATION: {
    status: 422,
    body: { code: 'VALIDATION_ERROR', message: '입력값이 올바르지 않습니다.' },
  },
  MASK_INVALID: {
    status: 422,
    body: {
      code: 'CLOTHING_MASK_INVALID',
      message: '브러시 마스크는 PNG 이미지로 올려 주세요.',
    },
  },
  MASK_UNREADABLE: {
    status: 422,
    body: {
      code: 'CLOTHING_MASK_INVALID',
      message: '브러시 마스크를 읽을 수 없습니다. 다시 그려서 올려 주세요.',
    },
  },
  MASK_SIZE_MISMATCH: {
    status: 422,
    body: {
      code: 'CLOTHING_MASK_SIZE_MISMATCH',
      message: '브러시 마스크는 옷 이미지와 크기가 같아야 합니다.',
    },
  },
  DISPLAY_INVALID: {
    status: 422,
    body: {
      code: 'CLOTHING_DISPLAY_IMAGE_INVALID',
      message: '사진을 읽을 수 없습니다. 다른 사진으로 다시 올려 주세요.',
    },
  },
  FILES_REQUIRED: {
    status: 422,
    body: {
      code: 'CLOTHING_FILES_REQUIRED',
      message: '올릴 사진을 골라 주세요.',
    },
  },
  TOO_MANY_FILES: {
    status: 422,
    body: {
      code: 'CLOTHING_TOO_MANY_FILES',
      message: '사진은 한 번에 20장까지 올릴 수 있습니다.',
    },
  },
  ACCESSORY_TYPE_NOT_ALLOWED: {
    status: 422,
    body: {
      code: 'CLOTHING_ACCESSORY_TYPE_NOT_ALLOWED',
      message: '악세서리 종류는 분류가 악세서리일 때만 정할 수 있습니다.',
    },
  },
  NOT_RETRYABLE: {
    status: 409,
    body: {
      code: 'CLOTHING_NOT_RETRYABLE',
      message: '처리에 실패한 옷만 다시 처리할 수 있습니다.',
    },
  },
  INTERNAL: {
    status: 500,
    body: { code: 'INTERNAL_ERROR', message: '처리 중 오류가 발생했습니다.' },
  },
} satisfies Record<string, { status: number; body: ErrorResponse }>;

type MockError = (typeof ERRORS)[keyof typeof ERRORS];

interface ClothingParams {
  clothingId: string;
}

type ClothingResponseBody = ClothingDetail | ErrorResponse;

const strictClothingEditUpdate = ClothingEditUpdate.strict();

const strictClothingUpdate = ClothingUpdate.strict();

const createClothing = (
  clothingId: number,
  edit: ClothingEdit | null,
): ClothingDetail => ({
  clothing_id: clothingId,
  processing_status_cd: 'completed',
  is_queued: false,
  image_url: edit?.display_image_url ?? SAMPLE_MEDIA.cutout,
  failure_reason: null,
  is_new: false,
  category_cd: 'top',
  item_name: '스트라이프 반팔 티셔츠',
  created_at: '2026-10-25T10:00:00+09:00',
  origin_image_url: SAMPLE_MEDIA.origin,
  cutout_image_url: SAMPLE_MEDIA.cutout,
  accessory_type_cd: null,
  color_cd: 'blue',
  color_text: '파랑',
  thickness_cd: 'thin',
  is_waterproof: false,
  style_cds: ['casual'],
  season_cds: ['summer'],
  edit,
});

const LIST_ITEM_NAMES = [
  ['베이지 터틀넥', 'top'],
  ['차콜 와이드 팬츠', 'bottom'],
  ['네이비 볼캡', 'accessories'],
  ['화이트 스니커즈', 'shoes'],
  ['오트밀 가디건', 'outer'],
  ['흰 양말', 'socks'],
] as const;

// 목록에서 보이는 카드 상태를 모두 갖추도록 처리 중·대기 중·실패·신규·이름 없음 옷을 섞는다.
const createListClothing = (clothingId: number): ClothingDetail => {
  const [itemName, category] =
    LIST_ITEM_NAMES[clothingId % LIST_ITEM_NAMES.length];
  const clothing: ClothingDetail = {
    ...createClothing(clothingId, null),
    item_name: itemName,
    category_cd: category,
    created_at: `2026-10-${String(1 + (clothingId % 28)).padStart(2, '0')}T10:00:00+09:00`,
  };

  if (clothingId === MOCK_LIST_ID.PROCESSING) {
    return {
      ...clothing,
      processing_status_cd: 'processing',
      image_url: SAMPLE_MEDIA.origin,
      category_cd: null,
      item_name: null,
    };
  }

  if (clothingId === MOCK_LIST_ID.QUEUED) {
    return {
      ...clothing,
      processing_status_cd: 'processing',
      is_queued: true,
      image_url: SAMPLE_MEDIA.origin,
      category_cd: null,
      item_name: null,
    };
  }

  if (clothingId === MOCK_LIST_ID.FAILED) {
    return {
      ...clothing,
      processing_status_cd: 'failed',
      image_url: SAMPLE_MEDIA.origin,
      failure_reason: '배경 제거에 실패했습니다.',
      category_cd: null,
      item_name: null,
    };
  }

  if (clothingId === MOCK_LIST_ID.UNTAGGED) {
    return { ...clothing, is_new: true, category_cd: null, item_name: null };
  }

  return { ...clothing, is_new: clothingId >= MOCK_LIST_ID.NEW_FROM };
};

const INITIAL_CLOTHINGS = [
  createClothing(MOCK_CLOTHING_ID.NO_EDIT, null),
  createClothing(MOCK_CLOTHING_ID.EDITED, SAMPLE_EDIT),
  createClothing(MOCK_CLOTHING_ID.NOT_EDITABLE, null),
  createClothing(MOCK_CLOTHING_ID.DISPLAY_INVALID, null),
  createClothing(MOCK_CLOTHING_ID.DISPLAY_SERVER_ERROR, null),
  ...Array.from(
    { length: MOCK_LIST_ID.LAST - MOCK_LIST_ID.FIRST + 1 },
    (_, index) => createListClothing(MOCK_LIST_ID.FIRST + index),
  ),
];

const toClothingCard = (clothing: ClothingDetail): ClothingCard => ({
  clothing_id: clothing.clothing_id,
  processing_status_cd: clothing.processing_status_cd,
  is_queued: clothing.is_queued,
  image_url: clothing.image_url,
  failure_reason: clothing.failure_reason,
  is_new: clothing.is_new,
  category_cd: clothing.category_cd,
  item_name: clothing.item_name,
  created_at: clothing.created_at,
});

const toClothingProgress = (clothing: ClothingDetail): ClothingProgress => ({
  clothing_id: clothing.clothing_id,
  processing_status_cd: clothing.processing_status_cd,
  is_queued: clothing.is_queued,
  image_url: clothing.image_url,
  failure_reason: clothing.failure_reason,
});

/*
 * 처리 중인 옷은 상태를 물을 때마다 한 단계씩 나아간다. 대기 중이던 옷은 처리를 시작하고,
 * 그다음엔 이름·분류가 채워진 완료 상태가 된다. 1초 폴링 기준으로 몇 초 뒤에 끝난다.
 * 옷장 테스트는 처음 두 번의 조회 동안 대기 중인 옷이 그대로 남는다고 보고 카드를 찾는다.
 */
const POLLS_TO_START = 3;
const POLLS_TO_COMPLETE = 5;

const pollCounts = new Map<number, number>();

const advanceProcessing = (clothing: ClothingDetail) => {
  const pollCount = (pollCounts.get(clothing.clothing_id) ?? 0) + 1;
  pollCounts.set(clothing.clothing_id, pollCount);

  if (pollCount >= POLLS_TO_COMPLETE) {
    const [itemName, category] =
      LIST_ITEM_NAMES[clothing.clothing_id % LIST_ITEM_NAMES.length];
    const completed: ClothingDetail = {
      ...clothing,
      processing_status_cd: 'completed',
      is_queued: false,
      image_url: clothing.cutout_image_url ?? clothing.origin_image_url,
      is_new: true,
      item_name: itemName,
      category_cd: category,
    };
    clothings.set(clothing.clothing_id, completed);
    pollCounts.delete(clothing.clothing_id);

    return completed;
  }

  if (pollCount >= POLLS_TO_START && clothing.is_queued) {
    const started: ClothingDetail = { ...clothing, is_queued: false };
    clothings.set(clothing.clothing_id, started);

    return started;
  }

  return clothing;
};

const UPLOAD_FILE_LIMIT = 20;

// 파일 이름에 이 말이 들어간 사진은 서버가 읽지 못해 제외한 것으로 흉내 낸다.
const UNREADABLE_FILE_MARK = 'unreadable';

const UNREADABLE_MESSAGE =
  '사진을 읽을 수 없습니다. 다른 사진으로 다시 올려 주세요.';

const parsePositiveInt = (value: string | null) =>
  value !== null && CLOTHING_ID_PATTERN.test(value) && Number(value) > 0
    ? Number(value)
    : null;

const clothings = new Map<number, ClothingDetail>();

const uploadedMedia = new Map<string, Blob>();

export const resetClothingMocks = () => {
  clothings.clear();
  uploadedMedia.clear();
  pollCounts.clear();

  for (const clothing of INITIAL_CLOTHINGS) {
    clothings.set(clothing.clothing_id, clothing);
  }
};

resetClothingMocks();

const errorResponse = <SuccessBody extends JsonBodyType = ClothingDetail>(
  error: MockError,
) =>
  HttpResponse.json<SuccessBody | ErrorResponse>(error.body, {
    status: error.status,
  });

const saveClothingEdit = (
  clothing: ClothingDetail,
  edit: ClothingEdit | null,
) => {
  const previousUrls = [
    clothing.edit?.brush_mask_url,
    clothing.edit?.display_image_url,
  ];
  const nextUrls = [edit?.brush_mask_url, edit?.display_image_url];

  for (const url of previousUrls) {
    if (url != null && !nextUrls.includes(url)) {
      uploadedMedia.delete(url);
    }
  }

  const nextClothing: ClothingDetail = {
    ...clothing,
    image_url:
      edit?.display_image_url ??
      clothing.cutout_image_url ??
      clothing.origin_image_url,
    edit,
  };
  clothings.set(clothing.clothing_id, nextClothing);

  return HttpResponse.json<ClothingResponseBody>(nextClothing);
};

const getEditableClothing = (clothingIdParam: string) => {
  const clothing = clothings.get(Number(clothingIdParam));

  if (clothing === undefined) {
    return { clothing: undefined, error: ERRORS.NOT_FOUND };
  }

  if (clothing.clothing_id === MOCK_CLOTHING_ID.NOT_EDITABLE) {
    return { clothing: undefined, error: ERRORS.NOT_EDITABLE };
  }

  return { clothing, error: undefined };
};

const parseRotationAngle = (value: number | string) => {
  const angle = Number(value);

  return ROTATION_ANGLE_PATTERN.test(String(value)) &&
    angle >= -180 &&
    angle <= 180
    ? angle
    : null;
};

const readUploadedFile = async (request: Request) => {
  const file = (await request.formData()).get('file');

  return file instanceof File ? file : null;
};

const isPng = async (file: Blob) => {
  const header = new Uint8Array(
    await file.slice(0, PNG_SIGNATURE.length).arrayBuffer(),
  );

  return PNG_SIGNATURE.every((byte, index) => header[index] === byte);
};

const decodeImage = async (file: Blob) => {
  try {
    return await createImageBitmap(file);
  } catch {
    return null;
  }
};

const toGrayscaleMask = async (image: ImageBitmap) => {
  const canvas = new OffscreenCanvas(image.width, image.height);
  const context = canvas.getContext('2d');

  if (context === null) {
    throw new Error('마스크를 변환할 캔버스를 만들지 못했습니다.');
  }

  context.drawImage(image, 0, 0);
  const imageData = context.getImageData(0, 0, image.width, image.height);
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    const luminance = Math.round(
      data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114,
    );
    data[index] = luminance;
    data[index + 1] = luminance;
    data[index + 2] = luminance;
    data[index + 3] = 255;
  }

  context.putImageData(imageData, 0, 0);

  return canvas.convertToBlob({ type: 'image/png' });
};

export const clothingHandlers = [
  http.get('/api/clothing', ({ request }) => {
    const searchParams = new URL(request.url).searchParams;
    const cursor = parsePositiveInt(searchParams.get('cursor'));
    const limit = Math.min(
      parsePositiveInt(searchParams.get('limit')) ??
        listClothingClothingGetParamsLimitDefault,
      listClothingClothingGetParamsLimitMax,
    );
    const rest = [...clothings.values()]
      .sort((a, b) => b.clothing_id - a.clothing_id)
      .filter((clothing) => cursor === null || clothing.clothing_id < cursor);
    const items = rest.slice(0, limit);
    const lastItem = items.at(-1);

    return HttpResponse.json<ClothingPage>({
      items: items.map(toClothingCard),
      next_cursor:
        rest.length > limit && lastItem !== undefined
          ? lastItem.clothing_id
          : null,
    });
  }),

  http.post('/api/clothing', async ({ request }) => {
    const files = (await request.formData())
      .getAll('files')
      .filter((value) => value instanceof File);

    if (files.length === 0) {
      return errorResponse<ClothingUploadResult>(ERRORS.FILES_REQUIRED);
    }

    if (files.length > UPLOAD_FILE_LIMIT) {
      return errorResponse<ClothingUploadResult>(ERRORS.TOO_MANY_FILES);
    }

    const result: ClothingUploadResult = { accepted: [], rejected: [] };
    let nextId = Math.max(...clothings.keys()) + 1;

    for (const file of files) {
      if (file.name.includes(UNREADABLE_FILE_MARK)) {
        result.rejected.push({
          file_name: file.name,
          reason_cd: 'unreadable',
          message: UNREADABLE_MESSAGE,
        });
        continue;
      }

      const originUrl = `${MEMBER_MEDIA_PATH}/${crypto.randomUUID()}.webp`;
      uploadedMedia.set(originUrl, file);
      clothings.set(nextId, {
        ...createClothing(nextId, null),
        processing_status_cd: 'processing',
        is_queued: true,
        image_url: originUrl,
        origin_image_url: originUrl,
        cutout_image_url: null,
        category_cd: null,
        item_name: null,
        color_cd: null,
        color_text: null,
        thickness_cd: null,
        is_waterproof: null,
        style_cds: [],
        season_cds: [],
      });
      result.accepted.push({
        clothing_id: nextId,
        processing_status_cd: 'processing',
        image_url: originUrl,
        file_name: file.name,
      });
      nextId += 1;
    }

    return HttpResponse.json<ClothingUploadResult | ErrorResponse>(result, {
      status: 202,
    });
  }),

  http.get('/api/clothing/status', ({ request }) => {
    const ids = (new URL(request.url).searchParams.get('ids') ?? '')
      .split(',')
      .map(parsePositiveInt);

    if (ids.some((id) => id === null)) {
      return errorResponse<ClothingStatusList>(ERRORS.VALIDATION);
    }

    const items = ids.flatMap((id) => {
      const clothing = id === null ? undefined : clothings.get(id);

      if (clothing === undefined) {
        return [];
      }

      return [
        toClothingProgress(
          clothing.processing_status_cd === 'processing'
            ? advanceProcessing(clothing)
            : clothing,
        ),
      ];
    });

    return HttpResponse.json<ClothingStatusList | ErrorResponse>({ items });
  }),

  http.post<ClothingParams>('/api/clothing/:clothingId/retry', ({ params }) => {
    const clothing = clothings.get(Number(params.clothingId));

    if (clothing === undefined) {
      return errorResponse<ClothingProgress>(ERRORS.NOT_FOUND);
    }

    if (clothing.processing_status_cd !== 'failed') {
      return errorResponse<ClothingProgress>(ERRORS.NOT_RETRYABLE);
    }

    const retried: ClothingDetail = {
      ...clothing,
      processing_status_cd: 'processing',
      is_queued: true,
      image_url: clothing.origin_image_url,
      failure_reason: null,
    };
    clothings.set(clothing.clothing_id, retried);

    return HttpResponse.json<ClothingProgress | ErrorResponse>(
      toClothingProgress(retried),
      { status: 202 },
    );
  }),

  http.patch<ClothingParams>(
    '/api/clothing/:clothingId',
    async ({ params, request }) => {
      const clothing = clothings.get(Number(params.clothingId));

      if (clothing === undefined) {
        return errorResponse(ERRORS.NOT_FOUND);
      }

      if (clothing.processing_status_cd !== 'completed') {
        return errorResponse(ERRORS.NOT_EDITABLE);
      }

      const result = strictClothingUpdate.safeParse(await request.json());

      if (!result.success) {
        return errorResponse(ERRORS.VALIDATION);
      }

      const update = result.data;
      const category =
        update.category_cd === undefined
          ? clothing.category_cd
          : update.category_cd;

      // BE처럼 악세서리가 아닌 옷의 종류는 받지 않고, 분류를 바꾸면 남아 있던 종류를 비운다.
      if (category !== 'accessories' && update.accessory_type_cd != null) {
        return errorResponse(ERRORS.ACCESSORY_TYPE_NOT_ALLOWED);
      }

      const isColorChanged =
        update.color_cd !== undefined && update.color_cd !== clothing.color_cd;
      const itemName =
        update.item_name === undefined
          ? clothing.item_name
          : (update.item_name?.trim() ?? null) || null;
      const nextClothing: ClothingDetail = {
        ...clothing,
        category_cd: category,
        accessory_type_cd:
          category === 'accessories'
            ? update.accessory_type_cd === undefined
              ? clothing.accessory_type_cd
              : update.accessory_type_cd
            : null,
        item_name: itemName,
        color_cd:
          update.color_cd === undefined ? clothing.color_cd : update.color_cd,
        color_text:
          update.color_text === undefined
            ? isColorChanged
              ? null
              : clothing.color_text
            : update.color_text,
        style_cds:
          update.style_cds === undefined
            ? clothing.style_cds
            : (update.style_cds ?? []),
        season_cds:
          update.season_cds === undefined
            ? clothing.season_cds
            : (update.season_cds ?? []),
        thickness_cd:
          update.thickness_cd === undefined
            ? clothing.thickness_cd
            : update.thickness_cd,
        is_waterproof:
          update.is_waterproof === undefined
            ? clothing.is_waterproof
            : update.is_waterproof,
        is_new: false,
      };
      clothings.set(clothing.clothing_id, nextClothing);

      return HttpResponse.json<ClothingResponseBody>(nextClothing);
    },
  ),

  http.post<ClothingParams>(
    '/api/clothing/:clothingId/reviewed',
    ({ params }) => {
      const clothing = clothings.get(Number(params.clothingId));

      if (clothing === undefined) {
        return errorResponse(ERRORS.NOT_FOUND);
      }

      if (clothing.processing_status_cd === 'completed') {
        clothings.set(clothing.clothing_id, { ...clothing, is_new: false });
      }

      return new HttpResponse(null, { status: 204 });
    },
  ),

  http.get<ClothingParams>('/api/clothing/:clothingId', ({ params }) => {
    if (!CLOTHING_ID_PATTERN.test(params.clothingId)) {
      return undefined;
    }

    const clothing = clothings.get(Number(params.clothingId));

    return clothing === undefined
      ? errorResponse(ERRORS.NOT_FOUND)
      : HttpResponse.json<ClothingResponseBody>(clothing);
  }),

  http.put<ClothingParams>(
    '/api/clothing/:clothingId/edit',
    async ({ params, request }) => {
      const { clothing, error } = getEditableClothing(params.clothingId);

      if (error !== undefined) {
        return errorResponse(error);
      }

      const result = strictClothingEditUpdate.safeParse(await request.json());
      const rotationAngle = result.success
        ? parseRotationAngle(result.data.rotation_angle)
        : null;

      if (!result.success || rotationAngle === null) {
        return errorResponse(ERRORS.VALIDATION);
      }

      return saveClothingEdit(clothing, {
        rotation_angle: rotationAngle,
        perspective_param: result.data.perspective_param ?? null,
        brush_mask_url: clothing.edit?.brush_mask_url ?? null,
        display_image_url: null,
      });
    },
  ),

  http.put<ClothingParams>(
    '/api/clothing/:clothingId/edit/mask',
    async ({ params, request }) => {
      const { clothing, error } = getEditableClothing(params.clothingId);

      if (error !== undefined) {
        return errorResponse(error);
      }

      const file = await readUploadedFile(request);

      if (file === null) {
        return errorResponse(ERRORS.VALIDATION);
      }

      if (!(await isPng(file))) {
        return errorResponse(ERRORS.MASK_INVALID);
      }

      const image = await decodeImage(file);

      if (image === null) {
        return errorResponse(ERRORS.MASK_UNREADABLE);
      }

      const isSizeMatched =
        image.width === CUTOUT_SIZE.width &&
        image.height === CUTOUT_SIZE.height;
      const mask = isSizeMatched ? await toGrayscaleMask(image) : null;
      image.close();

      if (mask === null) {
        return errorResponse(ERRORS.MASK_SIZE_MISMATCH);
      }

      const maskUrl = `${MEMBER_MEDIA_PATH}/${crypto.randomUUID()}_mask.png`;
      uploadedMedia.set(maskUrl, mask);

      return saveClothingEdit(clothing, {
        rotation_angle: clothing.edit?.rotation_angle ?? 0,
        perspective_param: clothing.edit?.perspective_param ?? null,
        brush_mask_url: maskUrl,
        display_image_url: null,
      });
    },
  ),

  http.put<ClothingParams>(
    '/api/clothing/:clothingId/edit/display',
    async ({ params, request }) => {
      const { clothing, error } = getEditableClothing(params.clothingId);

      if (error !== undefined) {
        return errorResponse(error);
      }

      if (clothing.clothing_id === MOCK_CLOTHING_ID.DISPLAY_INVALID) {
        return errorResponse(ERRORS.DISPLAY_INVALID);
      }

      if (clothing.clothing_id === MOCK_CLOTHING_ID.DISPLAY_SERVER_ERROR) {
        return errorResponse(ERRORS.INTERNAL);
      }

      const file = await readUploadedFile(request);

      if (file === null) {
        return errorResponse(ERRORS.VALIDATION);
      }

      const displayUrl = `${MEMBER_MEDIA_PATH}/${crypto.randomUUID()}_display.webp`;
      uploadedMedia.set(displayUrl, file);

      return saveClothingEdit(clothing, {
        rotation_angle: clothing.edit?.rotation_angle ?? 0,
        perspective_param: clothing.edit?.perspective_param ?? null,
        brush_mask_url: clothing.edit?.brush_mask_url ?? null,
        display_image_url: displayUrl,
      });
    },
  ),

  http.delete<ClothingParams>(
    '/api/clothing/:clothingId/edit',
    ({ params }) => {
      const { clothing, error } = getEditableClothing(params.clothingId);

      if (error !== undefined) {
        return errorResponse(error);
      }

      return saveClothingEdit(clothing, null);
    },
  ),

  http.get('/media/*', ({ request }) => {
    const { pathname } = new URL(request.url);
    const uploaded = uploadedMedia.get(pathname);

    if (uploaded !== undefined) {
      return new HttpResponse(uploaded, {
        headers: { 'Content-Type': uploaded.type },
      });
    }

    const assetUrl = SAMPLE_MEDIA_ASSETS.get(pathname);

    return assetUrl === undefined ? undefined : fetch(bypass(assetUrl));
  }),
];
