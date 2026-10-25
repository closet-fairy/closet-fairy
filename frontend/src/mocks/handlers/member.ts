import { http, HttpResponse } from 'msw';
import type { JsonBodyType } from 'msw';
import { z } from 'zod';
import {
  getKstYear,
  getLatestAllowedBirthYear,
} from '@/domains/member/birthYear';
import { NICKNAME_MAX_LENGTH } from '@/domains/member/nickname';
import type {
  ErrorResponse,
  MemberMe,
  MemberSettings,
  WithdrawalStarted,
} from '@/generated/models';
import { MemberSettingsUpdate, MemberUpdate } from '@/generated/models';

const MOCK_MEMBER_STATUS_KEY = 'closet-fairy:mock-member-status';

const strictMemberUpdate = MemberUpdate.strict();
const strictMemberSettingsUpdate = MemberSettingsUpdate.strict();

const mockMemberStatusSchema = z.enum([
  'signedOut',
  'needsOnboarding',
  'onboarded',
]);

type MockMemberStatus = z.infer<typeof mockMemberStatusSchema>;

const DEFAULT_STATUS: MockMemberStatus = 'onboarded';

const ONBOARDED_SETTINGS: MemberSettings = {
  birth_year: 2001,
  temperature_sensitivity_cd: 'cold_sensitive',
  gender_cd: 'female',
  style_cds: ['minimal', 'casual', 'classic'],
  is_onboarded: true,
};

const EMPTY_SETTINGS: MemberSettings = {
  birth_year: null,
  temperature_sensitivity_cd: null,
  gender_cd: 'unisex',
  style_cds: [],
  is_onboarded: false,
};

const DEFAULT_PROFILE = {
  nickname: '김하늘',
  provider_cd: 'google',
  created_at: '2026-08-12T10:00:00+09:00',
} satisfies Omit<MemberMe, 'is_onboarded'>;

const AUTH_REQUIRED_ERROR: ErrorResponse = {
  code: 'AUTH_REQUIRED',
  message: '로그인이 필요합니다.',
};

const getStorage = () =>
  typeof sessionStorage === 'undefined' ? null : sessionStorage;

let memoryStatus: MockMemberStatus = DEFAULT_STATUS;
let profile = { ...DEFAULT_PROFILE };
let settings: MemberSettings = { ...ONBOARDED_SETTINGS };

const getStatus = (): MockMemberStatus => {
  const result = mockMemberStatusSchema.safeParse(
    getStorage()?.getItem(MOCK_MEMBER_STATUS_KEY),
  );

  return result.success ? result.data : memoryStatus;
};

const setStatus = (status: MockMemberStatus) => {
  memoryStatus = status;
  getStorage()?.setItem(MOCK_MEMBER_STATUS_KEY, status);

  if (status === 'needsOnboarding') {
    settings = { ...EMPTY_SETTINGS };
  }

  if (status === 'onboarded' && !settings.is_onboarded) {
    settings = { ...ONBOARDED_SETTINGS };
  }
};

export const setMockMemberStatus = (status: MockMemberStatus) => {
  profile = { ...DEFAULT_PROFILE };
  settings = { ...EMPTY_SETTINGS };
  setStatus(status);
};

export const resetMemberMocks = () => {
  memoryStatus = DEFAULT_STATUS;
  profile = { ...DEFAULT_PROFILE };
  settings = { ...ONBOARDED_SETTINGS };
  getStorage()?.removeItem(MOCK_MEMBER_STATUS_KEY);
};

const authRequired = <T extends JsonBodyType>() =>
  HttpResponse.json<T | ErrorResponse>(AUTH_REQUIRED_ERROR, { status: 401 });

const validationError = <T extends JsonBodyType>(message: string) =>
  HttpResponse.json<T | ErrorResponse>(
    { code: 'VALIDATION_ERROR', message },
    { status: 422 },
  );

const toMemberMe = (): MemberMe => ({
  ...profile,
  is_onboarded: getStatus() === 'onboarded',
});

const toMemberSettings = (): MemberSettings =>
  getStatus() === 'onboarded'
    ? settings
    : { ...EMPTY_SETTINGS, is_onboarded: false };

export const memberHandlers = [
  http.get('/api/members/me', () =>
    getStatus() === 'signedOut'
      ? authRequired<MemberMe>()
      : HttpResponse.json<MemberMe | ErrorResponse>(toMemberMe()),
  ),

  http.patch('/api/members/me', async ({ request }) => {
    if (getStatus() === 'signedOut') {
      return authRequired<MemberMe>();
    }

    const result = strictMemberUpdate.safeParse(await request.json());

    if (!result.success) {
      return validationError<MemberMe>('입력값이 올바르지 않습니다.');
    }

    const nickname = result.data.nickname.trim();

    if (nickname === '' || [...nickname].length > NICKNAME_MAX_LENGTH) {
      return validationError<MemberMe>('닉네임은 1~30자로 입력해 주세요.');
    }

    profile = { ...profile, nickname };

    return HttpResponse.json<MemberMe | ErrorResponse>(toMemberMe());
  }),

  http.get('/api/members/me/settings', () =>
    getStatus() === 'signedOut'
      ? authRequired<MemberSettings>()
      : HttpResponse.json<MemberSettings | ErrorResponse>(toMemberSettings()),
  ),

  http.put('/api/members/me/settings', async ({ request }) => {
    if (getStatus() === 'signedOut') {
      return authRequired<MemberSettings>();
    }

    const result = strictMemberSettingsUpdate.safeParse(await request.json());

    if (!result.success) {
      return validationError<MemberSettings>('입력값이 올바르지 않습니다.');
    }

    const update = result.data;

    if (update.birth_year > getLatestAllowedBirthYear(getKstYear(new Date()))) {
      return validationError<MemberSettings>(
        '만 14세 이상만 이용할 수 있습니다.',
      );
    }

    settings = {
      birth_year: update.birth_year,
      temperature_sensitivity_cd: update.temperature_sensitivity_cd ?? null,
      gender_cd: update.gender_cd ?? 'unisex',
      style_cds: [...new Set(update.style_cds ?? [])],
      is_onboarded: true,
    };
    setStatus('onboarded');

    return HttpResponse.json<MemberSettings | ErrorResponse>(settings);
  }),

  http.post('/api/auth/logout', () => {
    setStatus('signedOut');

    return new HttpResponse(null, { status: 204 });
  }),

  /*
   * BE는 본인 확인용 소셜 인증 주소를 돌려주고, 그 콜백에서 탈퇴를 마친 뒤 /login?withdrawn=1로 보낸다.
   * 목업에서는 소셜 인증을 거칠 수 없어 마지막 도착지를 바로 돌려주고 세션도 여기서 끊는다.
   */
  http.post('/api/auth/withdraw', () => {
    if (getStatus() === 'signedOut') {
      return authRequired<WithdrawalStarted>();
    }

    setStatus('signedOut');

    return HttpResponse.json<WithdrawalStarted | ErrorResponse>({
      authorize_url: '/login?withdrawn=1',
    });
  }),
];
