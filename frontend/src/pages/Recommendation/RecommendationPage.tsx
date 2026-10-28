import { useNavigate } from '@tanstack/react-router';
import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { isUnauthorizedError } from '@/apis/authSession';
import Button from '@/components/common/Button';
import Chip from '@/components/common/Chip';
import ChipGroup from '@/components/common/ChipGroup';
import FormField from '@/components/common/FormField';
import Icon from '@/components/common/Icon';
import Notice from '@/components/common/Notice';
import TopBar from '@/components/common/TopBar';
import {
  PENDING_RECOMMENDATION_STORAGE_KEY,
  RECOMMENDATION_FORM_DRAFT_STORAGE_KEY,
} from '@/constants/recommendationStorageKey';
import {
  CLOTHING_SHORTAGE_DESCRIPTION,
  formatClothingShortageTitle,
} from '@/domains/recommendation/clothingShortage';
import type { GoingOutDateTime } from '@/domains/recommendation/goingOutTime';
import {
  createEndDayOptions,
  createStartDayOptions,
  getCurrentTimeSlot,
  getDayOffset,
  getDefaultEndTime,
  getGoingOutDateCd,
  getKstDate,
  getMillisecondsUntilNextTimeSlot,
  isNextDayReturn,
  shiftKstDate,
  validateGoingOutTime,
} from '@/domains/recommendation/goingOutTime';
import {
  parseRecommendationFormDraft,
  restoreRecommendationForm,
} from '@/domains/recommendation/recommendationRequestRecord';
import type { PendingRecommendation } from '@/domains/recommendation/recommendationRequestRecord';
import type { RecommendationTpo } from '@/domains/recommendation/toRecommendationSessionCreate';
import { toRecommendationSessionCreate } from '@/domains/recommendation/toRecommendationSessionCreate';
import { TPO_PRESETS } from '@/domains/recommendation/tpoPresets';
import {
  useCreateRecommendationSessionRecommendationSessionsPost,
  usePrecheckRecommendationRecommendationsPrecheckGet,
} from '@/generated/endpoints/recommendation/recommendation';
import {
  readSessionJson,
  removeSessionItem,
  writeSessionJson,
} from '@/utils/sessionStorageJson';
import CustomTpoSheet from './components/CustomTpoSheet';
import GoingOutTimeField from './components/GoingOutTimeField';
import LocationField from './components/LocationField';
import LocationSheet from './components/LocationSheet';
import * as S from './RecommendationPage.styled';
import type { RecommendationLocation } from './types';

const LOCATION_REQUIRED_MESSAGE = '위치를 선택해 주세요.';

const GOING_OUT_DATE_OUT_OF_RANGE_MESSAGE =
  '외출 날짜는 오늘이나 내일만 고를 수 있습니다.';

const DAY_NAMES: Readonly<Partial<Record<number, string>>> = {
  [-1]: '어제',
  0: '오늘',
  1: '내일',
  2: '모레',
};

const formatDayName = (dayOffset: number, date: string) => {
  const dayName = DAY_NAMES[dayOffset];

  if (dayName !== undefined) {
    return dayName;
  }

  const [, month, day] = date.split('-').map(Number);

  return `${month}/${day}`;
};

const formatDayTime = (dayOffset: number, date: string, time: string) =>
  dayOffset === 0 ? time : `${formatDayName(dayOffset, date)} ${time}`;

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
  const navigate = useNavigate();
  const now = useTimeSlotNow();
  const { data: precheck } =
    usePrecheckRecommendationRecommendationsPrecheckGet();
  const shortageTitle = precheck?.is_clothing_shortage
    ? formatClothingShortageTitle(precheck.shortage_categories)
    : null;
  const [restoredForm] = useState(() => {
    const draft = parseRecommendationFormDraft(
      readSessionJson(RECOMMENDATION_FORM_DRAFT_STORAGE_KEY),
    );

    return draft && restoreRecommendationForm(draft, new Date());
  });
  const [location, setLocation] = useState<RecommendationLocation | null>(
    restoredForm?.location ?? null,
  );
  const [isLocationSheetOpen, setIsLocationSheetOpen] = useState(false);
  const locationFieldRef = useRef<HTMLButtonElement | null>(null);
  const [tpo, setTpo] = useState<RecommendationTpo>(
    restoredForm?.tpo ?? { cd: 'daily' },
  );
  const [customTpoText, setCustomTpoText] = useState<string | null>(
    restoredForm?.customTpoText ?? null,
  );
  const [isCustomTpoSheetOpen, setIsCustomTpoSheetOpen] = useState(false);
  const [selectedStart, setSelectedStart] = useState<GoingOutDateTime | null>(
    restoredForm?.start ?? null,
  );
  const [selectedEnd, setSelectedEnd] = useState<string | null>(
    restoredForm?.end ?? null,
  );
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const {
    mutate: createRecommendationSession,
    isPending,
    error,
    reset,
  } = useCreateRecommendationSessionRecommendationSessionsPost();

  useEffect(() => {
    removeSessionItem(RECOMMENDATION_FORM_DRAFT_STORAGE_KEY);
  }, []);

  // 돌아온 사유는 알림 영역이 빈 채로 그려진 다음에 채워야 화면 낭독기가 변화로 알아채고 읽는다.
  useEffect(() => {
    const message = restoredForm?.message;

    if (message === undefined) {
      return;
    }

    const timer = setTimeout(() => {
      setValidationMessage(message);
    });

    return () => {
      clearTimeout(timer);
    };
  }, [restoredForm]);

  const start = selectedStart ?? {
    date: getKstDate(now),
    time: getCurrentTimeSlot(now),
  };
  const startDayOffset = getDayOffset(start.date, now);
  const end = selectedEnd ?? getDefaultEndTime(start.time);
  const endExtraDays = isNextDayReturn(start.time, end) ? 1 : 0;
  const endDateTime = {
    date: shiftKstDate(start.date, endExtraDays),
    time: end,
  };
  const getDayLabel = (date: string) =>
    formatDayName(getDayOffset(date, now), date);
  const requestErrorMessage =
    error && !isUnauthorizedError(error) ? error.message : null;
  const errorMessage = validationMessage ?? requestErrorMessage;

  const clearErrors = () => {
    setValidationMessage(null);

    if (error) {
      reset();
    }
  };

  const handleLocationSelect = (nextLocation: RecommendationLocation) => {
    setLocation(nextLocation);
    clearErrors();
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

  const handleStartConfirm = (nextStart: GoingOutDateTime) => {
    if (nextStart.date !== start.date || nextStart.time !== start.time) {
      setSelectedStart(nextStart);
      clearErrors();
    }
  };

  const handleEndConfirm = (nextEnd: GoingOutDateTime) => {
    if (nextEnd.time !== end) {
      setSelectedEnd(nextEnd.time);
      clearErrors();
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (location === null) {
      setValidationMessage(LOCATION_REQUIRED_MESSAGE);
      return;
    }

    const submittedAt = new Date();
    const message = validateGoingOutTime({ start, end, now: submittedAt });
    const goingOutDateCd = getGoingOutDateCd(start.date, submittedAt);
    setValidationMessage(message);

    if (message) {
      return;
    }

    if (goingOutDateCd === null) {
      setValidationMessage(GOING_OUT_DATE_OUT_OF_RANGE_MESSAGE);
      return;
    }

    const request = toRecommendationSessionCreate({
      sidoNm: location.sidoNm,
      sigunguNm: location.sigunguNm,
      locationInputTypeCd: location.inputTypeCd,
      tpo,
      goingOutDateCd,
      startTime: start.time,
      endTime: end,
    });

    createRecommendationSession(
      { data: request },
      {
        onSuccess: ({ recommendation_session_id: sessionId }) => {
          const pendingRecommendation: PendingRecommendation = {
            sessionId,
            requestedAt: Date.now(),
            request,
            form: {
              location,
              tpo,
              customTpoText,
              start: selectedStart,
              end: selectedEnd,
            },
          };

          writeSessionJson(
            PENDING_RECOMMENDATION_STORAGE_KEY,
            pendingRecommendation,
          );
          void navigate({
            to: '/recommendation/sessions/$sessionId',
            params: { sessionId },
          });
        },
      },
    );
  };

  return (
    <S.Container>
      <TopBar title="코디 추천" />
      <S.ShortageStatus role="status">{shortageTitle ?? ''}</S.ShortageStatus>
      <S.Form onSubmit={handleSubmit}>
        <S.Fields>
          {shortageTitle && (
            <Notice
              icon="checkroom"
              title={shortageTitle}
              description={CLOTHING_SHORTAGE_DESCRIPTION}
              action={
                <Button
                  variant="outline"
                  size="sm"
                  icon="add_a_photo"
                  isFullWidth
                  onClick={() => void navigate({ to: '/closet' })}
                >
                  옷 등록하기
                </Button>
              }
            />
          )}
          <FormField label="위치">
            <LocationField
              ref={locationFieldRef}
              location={location}
              onClick={() => setIsLocationSheetOpen(true)}
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
                <GoingOutTimeField
                  label="나가는 시간"
                  valueText={formatDayTime(
                    startDayOffset,
                    start.date,
                    start.time,
                  )}
                  days={createStartDayOptions(now)}
                  value={start}
                  getDayLabel={getDayLabel}
                  onConfirm={handleStartConfirm}
                />
              </S.TimePicker>
              <Icon name="arrow_forward" size="sm" />
              <S.TimePicker>
                <GoingOutTimeField
                  label="돌아오는 시간"
                  valueText={formatDayTime(
                    startDayOffset + endExtraDays,
                    endDateTime.date,
                    end,
                  )}
                  description={`나가는 시간 ${getDayLabel(start.date)} ${start.time}`}
                  days={createEndDayOptions(start)}
                  value={endDateTime}
                  getDayLabel={getDayLabel}
                  onConfirm={handleEndConfirm}
                />
              </S.TimePicker>
            </S.TimeRow>
          </FormField>
        </S.Fields>
        <S.Footer>
          <S.Alert role="alert">
            {errorMessage && (
              <Notice variant="subtle" icon="info" title={errorMessage} />
            )}
          </S.Alert>
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
      <LocationSheet
        isOpen={isLocationSheetOpen}
        onOpenChange={setIsLocationSheetOpen}
        onSelect={handleLocationSelect}
        finalFocus={locationFieldRef}
      />
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
