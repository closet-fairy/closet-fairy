import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { isUnauthorizedError } from '@/apis/authSession';
import Button from '@/components/common/Button';
import Chip from '@/components/common/Chip';
import ChipGroup from '@/components/common/ChipGroup';
import FormField from '@/components/common/FormField';
import Icon from '@/components/common/Icon';
import ListItem from '@/components/common/ListItem';
import Notice from '@/components/common/Notice';
import Picker from '@/components/common/Picker';
import TopBar from '@/components/common/TopBar';
import {
  createEndTimeSlots,
  createStartTimeSlots,
  getCurrentTimeSlot,
  getDefaultEndTime,
  getMillisecondsUntilNextTimeSlot,
  isNextDayReturn,
  isPastTimeSlot,
  validateGoingOutTime,
} from '@/domains/recommendation/goingOutTime';
import type { RecommendationTpo } from '@/domains/recommendation/toRecommendationSessionCreate';
import { toRecommendationSessionCreate } from '@/domains/recommendation/toRecommendationSessionCreate';
import { TPO_PRESETS } from '@/domains/recommendation/tpoPresets';
import { useCreateRecommendationSessionRecommendationSessionsPost } from '@/generated/endpoints/recommendation/recommendation';
import CustomTpoSheet from './components/CustomTpoSheet';
import * as S from './RecommendationPage.styled';

const TEMPORARY_LOCATION = {
  sidoNm: '서울특별시',
  sigunguNm: '성동구',
  label: '서울 성동구',
};

const useTimeSlotNow = () => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setTimeout(() => {
      setNow(new Date());
    }, getMillisecondsUntilNextTimeSlot(now));

    return () => {
      clearTimeout(timer);
    };
  }, [now]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setNow(new Date());
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return now;
};

const RecommendationPage = () => {
  const now = useTimeSlotNow();
  const [tpo, setTpo] = useState<RecommendationTpo>({ cd: 'daily' });
  const [customTpoText, setCustomTpoText] = useState<string | null>(null);
  const [isCustomTpoSheetOpen, setIsCustomTpoSheetOpen] = useState(false);
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [selectedEnd, setSelectedEnd] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const {
    mutate: createRecommendationSession,
    isPending,
    error,
    reset,
  } = useCreateRecommendationSessionRecommendationSessionsPost();

  const start = selectedStart ?? getCurrentTimeSlot(now);
  const end = selectedEnd ?? getDefaultEndTime(start);
  const startSlots = isPastTimeSlot(start, now)
    ? [start, ...createStartTimeSlots(now)]
    : createStartTimeSlots(now);
  const endSlots =
    end === start
      ? [end, ...createEndTimeSlots(start)]
      : createEndTimeSlots(start);
  const startOptions = startSlots.map((slot) => ({ value: slot, label: slot }));
  const endOptions = endSlots.map((slot) => ({
    value: slot,
    label: isNextDayReturn(start, slot) ? `다음 날 ${slot}` : slot,
  }));
  const requestErrorMessage =
    error && !isUnauthorizedError(error) ? error.message : null;
  const errorMessage = validationMessage ?? requestErrorMessage;

  const clearErrors = () => {
    setValidationMessage(null);

    if (error) {
      reset();
    }
  };

  const handleTpoChange = (value: string) => {
    if (value === 'custom') {
      if (customTpoText !== null) {
        setTpo({ cd: 'custom', text: customTpoText });
        clearErrors();
      }

      return;
    }

    const preset = TPO_PRESETS.find((tpoPreset) => tpoPreset.value === value);

    if (preset) {
      setTpo({ cd: preset.value });
      clearErrors();
    }
  };

  const handleCustomTpoSubmit = (text: string) => {
    setCustomTpoText(text);
    setTpo({ cd: 'custom', text });
    setIsCustomTpoSheetOpen(false);
    clearErrors();
  };

  const isCustomTpoEditable = customTpoText === null || tpo.cd === 'custom';

  const handleStartChange = (value: string) => {
    setSelectedStart(value);
    clearErrors();
  };

  const handleEndChange = (value: string) => {
    setSelectedEnd(value);
    clearErrors();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const message = validateGoingOutTime({ start, end, now: new Date() });
    setValidationMessage(message);

    if (message) {
      return;
    }

    createRecommendationSession(
      {
        data: toRecommendationSessionCreate({
          sidoNm: TEMPORARY_LOCATION.sidoNm,
          sigunguNm: TEMPORARY_LOCATION.sigunguNm,
          tpo,
          startTime: start,
          endTime: end,
        }),
      },
      {
        onSuccess: (createdSession) => {
          console.info('추천 세션을 만들었습니다.', createdSession);
        },
      },
    );
  };

  return (
    <S.Container>
      <TopBar title="코디 추천" />
      <S.Form onSubmit={handleSubmit}>
        <S.Fields>
          <FormField label="위치">
            <ListItem
              variant="card"
              icon="location_on"
              title={TEMPORARY_LOCATION.label}
            />
          </FormField>
          <FormField label="상황" hint="하나만 선택">
            <ChipGroup value={tpo.cd} onChange={handleTpoChange}>
              {TPO_PRESETS.map((preset) => (
                <Chip key={preset.value} value={preset.value}>
                  {preset.label}
                </Chip>
              ))}
              <Chip
                value="custom"
                variant="dashed"
                trailingIcon="edit"
                onClick={
                  isCustomTpoEditable
                    ? () => setIsCustomTpoSheetOpen(true)
                    : undefined
                }
              >
                {customTpoText ?? '직접 입력'}
              </Chip>
            </ChipGroup>
          </FormField>
          <FormField label="외출 시간" hint="30분 단위">
            <S.TimeRow>
              <S.TimePicker>
                <Picker
                  label="나가는 시간"
                  options={startOptions}
                  value={start}
                  onChange={handleStartChange}
                />
              </S.TimePicker>
              <Icon name="arrow_forward" size="sm" />
              <S.TimePicker>
                <Picker
                  label="돌아오는 시간"
                  options={endOptions}
                  value={end}
                  onChange={handleEndChange}
                />
              </S.TimePicker>
            </S.TimeRow>
          </FormField>
        </S.Fields>
        <S.Footer>
          {errorMessage && (
            <div role="alert">
              <Notice variant="subtle" icon="info" title={errorMessage} />
            </div>
          )}
          <Button
            type="submit"
            size="lg"
            icon="star_shine"
            isFullWidth
            isDisabled={isPending}
          >
            코디 추천 받기
          </Button>
        </S.Footer>
      </S.Form>
      <CustomTpoSheet
        isOpen={isCustomTpoSheetOpen}
        onOpenChange={setIsCustomTpoSheetOpen}
        initialText={customTpoText ?? ''}
        onSubmit={handleCustomTpoSubmit}
      />
    </S.Container>
  );
};

export default RecommendationPage;
