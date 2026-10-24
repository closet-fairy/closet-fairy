import type { PointerEvent } from 'react';
import { useContext, useEffect, useRef } from 'react';
import { FormFieldContext } from '@/components/common/FormField/FormField.context';
import * as S from './Slider.styled';

export interface SliderMark {
  value: number;
  label?: string;
}

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  marks?: SliderMark[];
  fillOrigin?: number;
  hasFill?: boolean;
  isDisabled?: boolean;
  onDraggingChange?: (isDragging: boolean) => void;
  getAriaValueText?: (value: number) => string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

const Slider = (props: SliderProps) => {
  const {
    value,
    onChange,
    min,
    max,
    step = 1,
    marks = [],
    fillOrigin = min,
    hasFill = true,
    isDisabled = false,
    onDraggingChange,
    getAriaValueText,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
  } = props;

  const formField = useContext(FormFieldContext);
  const endDragRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      endDragRef.current?.();
    };
  }, []);

  const getPercent = (target: number) => ((target - min) / (max - min)) * 100;
  const labeledMarks = marks.filter((mark) => mark.label !== undefined);
  const tickMarks = marks.filter(
    (mark) => mark.value > min && mark.value < max,
  );
  const fillStart = Math.min(getPercent(fillOrigin), getPercent(value));
  const fillEnd = Math.max(getPercent(fillOrigin), getPercent(value));

  const handleValueChange = (nextValue: number | readonly number[]) => {
    const singleValue =
      typeof nextValue === 'number' ? nextValue : nextValue.at(0);

    if (singleValue === undefined) {
      return;
    }

    onChange(singleValue);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (
      isDisabled ||
      !onDraggingChange ||
      event.button !== 0 ||
      endDragRef.current !== null
    ) {
      return;
    }

    const { pointerId } = event;
    onDraggingChange(true);

    const endDrag = () => {
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
      window.removeEventListener('pointermove', handlePointerMove);
      endDragRef.current = null;
      onDraggingChange(false);
    };

    const handlePointerEnd = (endEvent: globalThis.PointerEvent) => {
      if (endEvent.pointerId === pointerId) {
        endDrag();
      }
    };

    const handlePointerMove = (moveEvent: globalThis.PointerEvent) => {
      if (moveEvent.pointerId === pointerId && moveEvent.buttons === 0) {
        endDrag();
      }
    };

    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
    window.addEventListener('pointermove', handlePointerMove);
    endDragRef.current = endDrag;
  };

  return (
    <S.Root
      value={value}
      onValueChange={handleValueChange}
      min={min}
      max={max}
      step={step}
      disabled={isDisabled}
    >
      <S.Control onPointerDown={handlePointerDown}>
        <S.Track>
          {hasFill && (
            <S.Fill
              style={{
                left: `${fillStart}%`,
                width: `${fillEnd - fillStart}%`,
              }}
            />
          )}
          {tickMarks.map((mark) => (
            <S.Tick
              key={mark.value}
              style={{ left: `${getPercent(mark.value)}%` }}
            />
          ))}
          <S.Thumb
            aria-label={ariaLabel}
            aria-labelledby={
              ariaLabelledBy ??
              (ariaLabel === undefined ? formField?.labelId : undefined)
            }
            aria-describedby={formField?.hintId}
            getAriaValueText={
              getAriaValueText
                ? (_formattedValue, thumbValue) => getAriaValueText(thumbValue)
                : undefined
            }
          />
        </S.Track>
      </S.Control>
      {labeledMarks.length > 0 && (
        <S.MarkLabels aria-hidden>
          {labeledMarks.map((mark) => {
            const percent = getPercent(mark.value);

            return (
              <S.MarkLabel
                key={mark.value}
                style={{
                  left: `${percent}%`,
                  transform: `translateX(-${percent}%)`,
                }}
              >
                {mark.label}
              </S.MarkLabel>
            );
          })}
        </S.MarkLabels>
      )}
    </S.Root>
  );
};

export default Slider;
