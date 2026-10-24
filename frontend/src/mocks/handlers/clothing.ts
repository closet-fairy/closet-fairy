import { bypass, http, HttpResponse } from 'msw';
import type {
  ClothingDetail,
  ClothingEdit,
  ErrorResponse,
} from '@/generated/models';
import { ClothingEditUpdate } from '@/generated/models';
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

const INITIAL_CLOTHINGS = [
  createClothing(MOCK_CLOTHING_ID.NO_EDIT, null),
  createClothing(MOCK_CLOTHING_ID.EDITED, SAMPLE_EDIT),
  createClothing(MOCK_CLOTHING_ID.NOT_EDITABLE, null),
  createClothing(MOCK_CLOTHING_ID.DISPLAY_INVALID, null),
  createClothing(MOCK_CLOTHING_ID.DISPLAY_SERVER_ERROR, null),
];

const clothings = new Map<number, ClothingDetail>();

const uploadedMedia = new Map<string, Blob>();

export const resetClothingMocks = () => {
  clothings.clear();
  uploadedMedia.clear();

  for (const clothing of INITIAL_CLOTHINGS) {
    clothings.set(clothing.clothing_id, clothing);
  }
};

resetClothingMocks();

const errorResponse = (error: MockError) =>
  HttpResponse.json<ClothingResponseBody>(error.body, {
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
