import { useState } from 'react';
import BottomSheet from '@/components/common/BottomSheet';
import Button from '@/components/common/Button';
import PickerTrigger from '@/components/common/PickerTrigger';
import WheelPicker from '@/components/common/WheelPicker';
import type {
  GoingOutDateTime,
  GoingOutDayOption,
} from '@/domains/recommendation/goingOutTime';
import { fitGoingOutDateTime } from '@/domains/recommendation/goingOutTime';

interface GoingOutTimeFieldProps {
  label: string;
  valueText: string;
  description?: string;
  days: GoingOutDayOption[];
  value: GoingOutDateTime;
  getDayLabel: (date: string) => string;
  onConfirm: (value: GoingOutDateTime) => void;
}

interface SheetState {
  days: GoingOutDayOption[];
  draft: GoingOutDateTime;
}

const GoingOutTimeField = (props: GoingOutTimeFieldProps) => {
  const { label, valueText, description, days, value, getDayLabel, onConfirm } =
    props;
  const [isOpen, setIsOpen] = useState(false);
  // 시트를 연 동안 시각이 지나도 고를 수 있는 범위가 바뀌지 않도록, 연 순간의 범위를 붙잡아 둔다.
  const [sheet, setSheet] = useState<SheetState>(() => ({
    days,
    draft: value,
  }));

  const selectedDay = sheet.days.find((day) => day.date === sheet.draft.date);
  const dayOptions = sheet.days.map((day) => ({
    value: day.date,
    label: getDayLabel(day.date),
  }));
  const timeOptions = (selectedDay?.times ?? []).map((time) => ({
    value: time,
    label: time,
  }));

  const handleTriggerClick = () => {
    setSheet({ days, draft: fitGoingOutDateTime(days, value) });
    setIsOpen(true);
  };

  const handleDayChange = (date: string) => {
    setSheet((prev) => ({
      ...prev,
      draft: fitGoingOutDateTime(prev.days, { date, time: prev.draft.time }),
    }));
  };

  const handleTimeChange = (time: string) => {
    setSheet((prev) => ({ ...prev, draft: { ...prev.draft, time } }));
  };

  const handleConfirm = () => {
    onConfirm(sheet.draft);
    setIsOpen(false);
  };

  return (
    <>
      <PickerTrigger
        label={label}
        valueText={valueText}
        isExpanded={isOpen}
        onClick={handleTriggerClick}
      />
      <BottomSheet
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        title={label}
        description={description}
        footer={
          <Button size="lg" isFullWidth onClick={handleConfirm}>
            {`${getDayLabel(sheet.draft.date)} ${sheet.draft.time} 선택`}
          </Button>
        }
      >
        <WheelPicker
          columns={[
            {
              'aria-label': '날짜',
              options: dayOptions,
              value: sheet.draft.date,
              onChange: handleDayChange,
            },
            {
              'aria-label': '시각',
              options: timeOptions,
              value: sheet.draft.time,
              onChange: handleTimeChange,
            },
          ]}
        />
      </BottomSheet>
    </>
  );
};

export default GoingOutTimeField;
