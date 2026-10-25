import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useRouter, useRouterState } from '@tanstack/react-router';
import { useEffect, useId, useRef, useState } from 'react';
import { isValidationError } from '@/apis/apiError';
import { isUnauthorizedError } from '@/apis/authSession';
import BodyTypeFields from '@/components/BodyTypeFields';
import Button from '@/components/common/Button';
import FormField from '@/components/common/FormField';
import Icon from '@/components/common/Icon';
import IconButton from '@/components/common/IconButton';
import Tag from '@/components/common/Tag';
import TextField from '@/components/common/TextField';
import TopBar from '@/components/common/TopBar';
import { SAVE_ERROR_MESSAGE } from '@/constants/saveErrorMessage';
import type {
  GenderCd,
  StyleCd,
  TemperatureSensitivityCd,
} from '@/domains/member/memberSettingOptions';
import {
  getStyleLabel,
  sortStyleCds,
} from '@/domains/member/memberSettingOptions';
import {
  NICKNAME_MAX_LENGTH,
  validateNickname,
} from '@/domains/member/nickname';
import {
  getGetMeMembersMeGetQueryKey,
  getGetMySettingsMembersMeSettingsGetQueryKey,
  useSaveMySettingsMembersMeSettingsPut,
  useUpdateMeMembersMePatch,
} from '@/generated/endpoints/member/member';
import type { MemberMe, MemberSettingsOutput } from '@/generated/models';
import useGoBack from '@/hooks/useGoBack';
import StyleSelectView from '../StyleSelectView';
import * as S from './ProfileEditForm.styled';

const NICKNAME_REJECTED_MESSAGE =
  '사용할 수 없는 닉네임이에요. 다시 입력해 주세요.';
const NICKNAME_SAVE_ERROR_MESSAGE =
  '체질·성별·스타일은 저장했지만 닉네임은 저장하지 못했어요. 다시 시도해 주세요.';

interface ProfileEditFormProps {
  me: MemberMe;
  settings: MemberSettingsOutput;
}

const ProfileEditForm = (props: ProfileEditFormProps) => {
  const { me, settings } = props;
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const nicknameInputId = useId();
  const view = useRouterState({
    select: (state) => state.location.state.profileEditView,
  });

  const [nickname, setNickname] = useState(me.nickname);
  const [nicknameError, setNicknameError] = useState<string>();
  const [temperatureSensitivity, setTemperatureSensitivity] =
    useState<TemperatureSensitivityCd | null>(
      settings.temperature_sensitivity_cd,
    );
  const [gender, setGender] = useState<GenderCd | null>(settings.gender_cd);
  const [styles, setStyles] = useState<StyleCd[]>(
    sortStyleCds(settings.style_cds),
  );
  const [saveError, setSaveError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const saveSettings = useSaveMySettingsMembersMeSettingsPut();
  const updateMe = useUpdateMeMembersMePatch();
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const goBack = useGoBack();

  const handleNicknameChange = (value: string) => {
    setNickname(value);
    setNicknameError(undefined);
  };

  const handleStylesDone = (value: StyleCd[]) => {
    setStyles(sortStyleCds(value));
    router.history.back();
  };

  const handleSave = async () => {
    const nextNicknameError = validateNickname(nickname);

    if (nextNicknameError !== null) {
      setNicknameError(nextNicknameError);
      return;
    }

    if (settings.birth_year === null) {
      setSaveError(SAVE_ERROR_MESSAGE);
      return;
    }

    setSaveError(undefined);
    setIsSaving(true);
    let failedRequest: 'settings' | 'nickname' = 'settings';

    try {
      const savedSettings = await saveSettings.mutateAsync({
        data: {
          birth_year: settings.birth_year,
          temperature_sensitivity_cd: temperatureSensitivity,
          gender_cd: gender,
          style_cds: styles,
        },
      });
      queryClient.setQueryData(
        getGetMySettingsMembersMeSettingsGetQueryKey(),
        savedSettings,
      );

      const trimmedNickname = nickname.trim();

      if (trimmedNickname !== me.nickname) {
        failedRequest = 'nickname';
        const savedMe = await updateMe.mutateAsync({
          data: { nickname: trimmedNickname },
        });
        queryClient.setQueryData<MemberMe>(
          getGetMeMembersMeGetQueryKey(),
          savedMe,
        );
      }

      if (isMountedRef.current) {
        goBack();
      }
    } catch (error) {
      if (isUnauthorizedError(error)) {
        return;
      }

      if (failedRequest === 'nickname') {
        if (isValidationError(error)) {
          setNicknameError(
            error.message === '' ? NICKNAME_REJECTED_MESSAGE : error.message,
          );
          return;
        }

        setSaveError(NICKNAME_SAVE_ERROR_MESSAGE);
        return;
      }

      setSaveError(SAVE_ERROR_MESSAGE);
    } finally {
      setIsSaving(false);
    }
  };

  if (view === 'styles') {
    return (
      <StyleSelectView
        initialValue={styles}
        onBack={() => router.history.back()}
        onDone={handleStylesDone}
      />
    );
  }

  return (
    <S.Container>
      <TopBar
        title="프로필 수정"
        leading={
          <IconButton
            icon="arrow_back"
            aria-label="뒤로 가기"
            isDisabled={isSaving}
            onClick={goBack}
          />
        }
      />
      <S.Body>
        <FormField label="닉네임" htmlFor={nicknameInputId}>
          <TextField
            id={nicknameInputId}
            value={nickname}
            onChange={handleNicknameChange}
            placeholder="닉네임을 입력해 주세요"
            maxLength={NICKNAME_MAX_LENGTH}
            errorMessage={nicknameError}
            isDisabled={isSaving}
          />
        </FormField>
        <BodyTypeFields
          temperatureSensitivity={temperatureSensitivity}
          gender={gender}
          onTemperatureSensitivityChange={setTemperatureSensitivity}
          onGenderChange={setGender}
          isGenderDeselectable={false}
          isDisabled={isSaving}
        />
        <FormField label="선호 스타일" hint={`${styles.length}개 선택`}>
          <S.StyleButton
            type="button"
            aria-label={
              styles.length === 0
                ? '선호 스타일 고르기, 선택 안 함'
                : `선호 스타일 고르기, ${styles.length}개 선택: ${styles.map(getStyleLabel).join(', ')}`
            }
            disabled={isSaving}
            onClick={() =>
              void navigate({
                to: '/my-info/edit',
                state: { profileEditView: 'styles' },
              })
            }
          >
            <S.StyleTags>
              {styles.length === 0 ? (
                <S.StylePlaceholder>스타일을 골라 주세요</S.StylePlaceholder>
              ) : (
                styles.map((styleCd) => (
                  <Tag key={styleCd} size="sm">
                    {getStyleLabel(styleCd)}
                  </Tag>
                ))
              )}
            </S.StyleTags>
            <S.Chevron>
              <Icon name="chevron_right" size="md" />
            </S.Chevron>
          </S.StyleButton>
        </FormField>
      </S.Body>
      <S.Footer>
        {saveError && (
          <S.ErrorMessage role="alert">
            <Icon name="error" size="sm" />
            {saveError}
          </S.ErrorMessage>
        )}
        <Button
          isFullWidth
          isLoading={isSaving}
          onClick={() => void handleSave()}
        >
          저장
        </Button>
      </S.Footer>
    </S.Container>
  );
};

export default ProfileEditForm;
