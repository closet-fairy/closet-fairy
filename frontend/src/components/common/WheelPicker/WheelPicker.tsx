import type { KeyboardEvent } from 'react';
import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import { ROW_HEIGHT } from './WheelPicker.constants';
import * as S from './WheelPicker.styled';

export interface WheelPickerOption {
  value: string;
  label: string;
}

export interface WheelPickerColumn {
  'aria-label': string;
  options: WheelPickerOption[];
  value: string;
  onChange: (value: string) => void;
}

interface WheelPickerProps {
  columns: WheelPickerColumn[];
}

const TARGET_RELEASE_DELAY = 1000;
const NATIVE_SCROLL_KEYS = new Set(['PageUp', 'PageDown', ' ']);

const getCenteredIndex = (list: HTMLElement, optionCount: number) =>
  Math.min(
    Math.max(Math.round(list.scrollTop / ROW_HEIGHT), 0),
    optionCount - 1,
  );

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const getKeyTargetIndex = (key: string, index: number, count: number) => {
  switch (key) {
    case 'ArrowDown':
      return Math.min(index + 1, count - 1);
    case 'ArrowUp':
      return Math.max(index - 1, 0);
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
};

const WheelPicker = (props: WheelPickerProps) => {
  const { columns } = props;
  const baseId = useId();
  const listRefs = useRef<(HTMLUListElement | null)[]>([]);
  // 눌러서 옮기는 칸의 목표 위치다. 부드럽게 스크롤하는 동안 지나가는 칸으로 값을 바꾸지 않으려고 둔다.
  const targetIndexes = useRef<(number | null)[]>([]);
  const releaseTimers = useRef<(number | undefined)[]>([]);
  const latestColumns = useRef(columns);

  const getOptionId = (columnIndex: number, optionIndex: number) =>
    `${baseId}-${columnIndex}-${optionIndex}`;

  const releaseTarget = (columnIndex: number) => {
    targetIndexes.current[columnIndex] = null;
    window.clearTimeout(releaseTimers.current[columnIndex]);
  };

  const reportCenteredOption = (columnIndex: number) => {
    const list = listRefs.current[columnIndex];
    const column = latestColumns.current[columnIndex];

    if (!list || !column) {
      return;
    }

    const option =
      column.options[getCenteredIndex(list, column.options.length)];

    if (option && option.value !== column.value) {
      column.onChange(option.value);
    }
  };

  useLayoutEffect(() => {
    latestColumns.current = columns;

    columns.forEach((column, columnIndex) => {
      const list = listRefs.current[columnIndex];
      const valueIndex = column.options.findIndex(
        (option) => option.value === column.value,
      );

      if (!list || valueIndex < 0) {
        return;
      }

      const targetIndex = targetIndexes.current[columnIndex];

      if (targetIndex === valueIndex) {
        return;
      }

      if (targetIndex !== null && targetIndex !== undefined) {
        releaseTarget(columnIndex);
      }

      if (getCenteredIndex(list, column.options.length) !== valueIndex) {
        list.scrollTop = valueIndex * ROW_HEIGHT;
      }
    });
  });

  useEffect(() => {
    const timers = releaseTimers.current;

    return () => {
      timers.forEach((timer) => {
        window.clearTimeout(timer);
      });
    };
  }, []);

  const moveTo = (columnIndex: number, optionIndex: number) => {
    const list = listRefs.current[columnIndex];
    const column = columns[columnIndex];
    const option = column?.options[optionIndex];

    if (!list || !column || !option) {
      return;
    }

    const top = optionIndex * ROW_HEIGHT;

    // 이미 그 칸에 있으면 스크롤 이벤트가 오지 않아 목표가 풀리지 않으므로 부드럽게 옮기지 않는다.
    const canScrollSmoothly =
      Math.abs(list.scrollTop - top) >= 1 &&
      typeof list.scrollTo === 'function' &&
      !prefersReducedMotion();

    releaseTarget(columnIndex);

    if (canScrollSmoothly) {
      targetIndexes.current[columnIndex] = optionIndex;
      releaseTimers.current[columnIndex] = window.setTimeout(() => {
        targetIndexes.current[columnIndex] = null;
        reportCenteredOption(columnIndex);
      }, TARGET_RELEASE_DELAY);
      list.scrollTo({ top, behavior: 'smooth' });
    } else {
      list.scrollTop = top;
    }

    if (option.value !== column.value) {
      column.onChange(option.value);
    }
  };

  const handleScroll = (columnIndex: number) => {
    const list = listRefs.current[columnIndex];
    const targetIndex = targetIndexes.current[columnIndex];

    if (list && targetIndex !== null && targetIndex !== undefined) {
      if (Math.abs(list.scrollTop - targetIndex * ROW_HEIGHT) < 1) {
        releaseTarget(columnIndex);
      }

      return;
    }

    reportCenteredOption(columnIndex);
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLUListElement>,
    columnIndex: number,
  ) => {
    const column = columns[columnIndex];

    if (!column) {
      return;
    }

    const valueIndex = column.options.findIndex(
      (option) => option.value === column.value,
    );
    const nextIndex = getKeyTargetIndex(
      event.key,
      Math.max(valueIndex, 0),
      column.options.length,
    );

    if (nextIndex === null) {
      if (NATIVE_SCROLL_KEYS.has(event.key)) {
        releaseTarget(columnIndex);
      }

      return;
    }

    event.preventDefault();
    moveTo(columnIndex, nextIndex);
  };

  return (
    <S.Container data-base-ui-swipe-ignore="">
      <S.Band aria-hidden />
      {columns.map((column, columnIndex) => {
        const valueIndex = column.options.findIndex(
          (option) => option.value === column.value,
        );

        return (
          <S.List
            key={column['aria-label']}
            ref={(element) => {
              listRefs.current[columnIndex] = element;
            }}
            role="listbox"
            tabIndex={0}
            aria-label={column['aria-label']}
            aria-activedescendant={
              valueIndex < 0 ? undefined : getOptionId(columnIndex, valueIndex)
            }
            onScroll={() => handleScroll(columnIndex)}
            onKeyDown={(event) => handleKeyDown(event, columnIndex)}
            onPointerDown={() => releaseTarget(columnIndex)}
            onTouchStart={() => releaseTarget(columnIndex)}
            onWheel={() => releaseTarget(columnIndex)}
          >
            {column.options.map((option, optionIndex) => (
              <S.Option
                key={option.value}
                id={getOptionId(columnIndex, optionIndex)}
                role="option"
                aria-selected={optionIndex === valueIndex}
                $isSelected={optionIndex === valueIndex}
                $distance={Math.abs(optionIndex - valueIndex)}
                onClick={() => moveTo(columnIndex, optionIndex)}
              >
                {option.label}
              </S.Option>
            ))}
          </S.List>
        );
      })}
    </S.Container>
  );
};

export default WheelPicker;
