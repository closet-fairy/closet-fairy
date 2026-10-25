import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useRouter, useRouterState } from '@tanstack/react-router';
import type { ComponentProps } from 'react';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { isValidationError } from '@/apis/apiError';
import { isUnauthorizedError } from '@/apis/authSession';
import BodyTypeFields from '@/components/BodyTypeFields';
import LogoutDialog from '@/components/LogoutDialog';
import StylePreferenceList from '@/components/StylePreferenceList';
import { SAVE_ERROR_MESSAGE } from '@/constants/saveErrorMessage';
import type {
  GenderCd,
  StyleCd,
  TemperatureSensitivityCd,
} from '@/domains/member/memberSettingOptions';
import { sortStyleCds } from '@/domains/member/memberSettingOptions';
import {
  getGetMeMembersMeGetQueryKey,
  getGetMySettingsMembersMeSettingsGetQueryKey,
  useSaveMySettingsMembersMeSettingsPut,
} from '@/generated/endpoints/member/member';
import type { MemberMe } from '@/generated/models';
import BirthYearField from './components/BirthYearField';
import OnboardingStepLayout from './components/OnboardingStepLayout';

const TOTAL_STEPS = 3;
const BIRTH_YEAR_ERROR_MESSAGE = '만 14세 이상만 이용할 수 있습니다.';
const OPTIONAL_NOTE = '지금 넘겨도 내 정보에서 정할 수 있어요.';

const stepSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

type OnboardingStep = z.infer<typeof stepSchema>;

const OnboardingPage = () => {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const rawStep = useRouterState({
    select: (state) => state.location.state.onboardingStep,
  });
  const parsedStep = stepSchema.safeParse(rawStep);
  const step: OnboardingStep = parsedStep.success ? parsedStep.data : 1;

  const [birthYear, setBirthYear] = useState<number | null>(null);
  const [birthYearError, setBirthYearError] = useState<string>();
  const [temperatureSensitivity, setTemperatureSensitivity] =
    useState<TemperatureSensitivityCd | null>(null);
  const [gender, setGender] = useState<GenderCd | null>(null);
  const [styles, setStyles] = useState<StyleCd[]>([]);
  const [saveError, setSaveError] = useState<string>();
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const saveSettings = useSaveMySettingsMembersMeSettingsPut();

  const isSavingRef = useRef(false);
  const visibleStepRef = useRef<OnboardingStep>(1);

  const isMissingEarlierStep = step > 1 && birthYear === null;
  const visibleStep: OnboardingStep = isMissingEarlierStep ? 1 : step;
  const isSaving = saveSettings.isPending;

  const [renderedStep, setRenderedStep] = useState(visibleStep);

  if (renderedStep !== visibleStep) {
    setRenderedStep(visibleStep);
    setSaveError(undefined);
  }

  useEffect(() => {
    visibleStepRef.current = visibleStep;
  }, [visibleStep]);

  useEffect(() => {
    if (isMissingEarlierStep) {
      void navigate({
        to: '/onboarding',
        replace: true,
        state: { onboardingStep: 1 },
      });
    }
  }, [isMissingEarlierStep, navigate]);

  const goToStep = (nextStep: number) => {
    void navigate({ to: '/onboarding', state: { onboardingStep: nextStep } });
  };

  const handleBack = () => {
    router.history.back();
  };

  const handleBirthYearChange = (value: number) => {
    setBirthYear(value);
    setBirthYearError(undefined);
  };

  const handleSave = () => {
    if (birthYear === null || isSavingRef.current) {
      return;
    }

    isSavingRef.current = true;
    setSaveError(undefined);
    saveSettings.mutate(
      {
        data: {
          birth_year: birthYear,
          temperature_sensitivity_cd: temperatureSensitivity,
          gender_cd: gender,
          style_cds: sortStyleCds(styles),
        },
      },
      {
        onSuccess: (settings) => {
          queryClient.setQueryData(
            getGetMySettingsMembersMeSettingsGetQueryKey(),
            settings,
          );
          queryClient.setQueryData<MemberMe>(
            getGetMeMembersMeGetQueryKey(),
            (me) => me && { ...me, is_onboarded: true },
          );
          void navigate({ to: '/closet', replace: true });
        },
        onError: (error) => {
          if (isUnauthorizedError(error)) {
            return;
          }

          if (isValidationError(error)) {
            setBirthYearError(
              error.message === '' ? BIRTH_YEAR_ERROR_MESSAGE : error.message,
            );

            if (visibleStepRef.current > 1) {
              router.history.go(1 - visibleStepRef.current);
            }

            return;
          }

          setSaveError(SAVE_ERROR_MESSAGE);
        },
        onSettled: () => {
          isSavingRef.current = false;
        },
      },
    );
  };

  const stepContent = {
    1: {
      title: '출생연도를 알려 주세요',
      description: '나이에 맞는 코디를 추천하는 데 써요.',
      canContinue: birthYear !== null,
      onContinue: () => goToStep(2),
      children: (
        <BirthYearField
          value={birthYear}
          onChange={handleBirthYearChange}
          errorMessage={birthYearError}
        />
      ),
    },
    2: {
      title: '체질과 성별을 알려 주세요',
      description: '날씨에 맞춰 옷 두께를 고를 때 써요.',
      note: OPTIONAL_NOTE,
      isOptional: true,
      canContinue: true,
      onContinue: () => goToStep(3),
      onBack: handleBack,
      children: (
        <BodyTypeFields
          temperatureSensitivity={temperatureSensitivity}
          gender={gender}
          onTemperatureSensitivityChange={setTemperatureSensitivity}
          onGenderChange={setGender}
        />
      ),
    },
    3: {
      title: '좋아하는 스타일을 골라 주세요',
      description: '고른 스타일이 첫 추천부터 반영돼요.',
      note: '여러 개 골라도, 나중에 골라도 괜찮아요.',
      isOptional: true,
      hasDivider: true,
      errorMessage: saveError,
      canContinue: true,
      onContinue: handleSave,
      onBack: handleBack,
      children: (
        <StylePreferenceList
          aria-label="선호 스타일"
          value={styles}
          onChange={setStyles}
          isDisabled={isSaving}
        />
      ),
    },
  } satisfies Record<
    OnboardingStep,
    Omit<
      ComponentProps<typeof OnboardingStepLayout>,
      'step' | 'totalSteps' | 'isSaving' | 'onLogout'
    >
  >;

  return (
    <>
      <OnboardingStepLayout
        {...stepContent[visibleStep]}
        step={visibleStep}
        totalSteps={TOTAL_STEPS}
        isSaving={isSaving}
        onLogout={() => setIsLogoutDialogOpen(true)}
      />
      <LogoutDialog
        isOpen={isLogoutDialogOpen}
        onOpenChange={setIsLogoutDialogOpen}
      />
    </>
  );
};

export default OnboardingPage;
