import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, test, vi } from 'vitest';
import WheelPicker from './WheelPicker';

const OPTIONS = [
  { value: '21:00', label: '21:00' },
  { value: '21:30', label: '21:30' },
  { value: '22:00', label: '22:00' },
];

const TestWheelPicker = (props: { onChange: (value: string) => void }) => {
  const { onChange } = props;
  const [value, setValue] = useState('21:00');

  return (
    <WheelPicker
      columns={[
        {
          'aria-label': '시각',
          options: OPTIONS,
          value,
          onChange: (nextValue) => {
            onChange(nextValue);
            setValue(nextValue);
          },
        },
      ]}
    />
  );
};

describe('고른 값 알리기', () => {
  test('칸은 이름이 붙은 목록이고, 고른 항목을 선택된 항목으로 알려야 한다.', () => {
    render(<TestWheelPicker onChange={vi.fn()} />);

    const listbox = screen.getByRole('listbox', { name: '시각' });
    const selected = screen.getByRole('option', { name: '21:00' });

    expect(selected).toHaveAttribute('aria-selected', 'true');
    expect(listbox).toHaveAttribute('aria-activedescendant', selected.id);
  });

  test('항목을 누르면 그 값으로 변경을 알려야 한다.', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TestWheelPicker onChange={onChange} />);

    await user.click(screen.getByRole('option', { name: '22:00' }));

    expect(onChange).toHaveBeenCalledWith('22:00');
    expect(screen.getByRole('option', { name: '22:00' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('이미 고른 항목을 누르면 변경을 알리지 않아야 한다.', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TestWheelPicker onChange={onChange} />);

    await user.click(screen.getByRole('option', { name: '21:00' }));

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('키보드 이동', () => {
  test('위아래 화살표 키로 이웃 항목을, Home과 End로 처음과 끝 항목을 골라야 한다.', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TestWheelPicker onChange={onChange} />);

    screen.getByRole('listbox', { name: '시각' }).focus();
    await user.keyboard('{ArrowDown}');

    expect(onChange).toHaveBeenLastCalledWith('21:30');

    await user.keyboard('{End}');

    expect(onChange).toHaveBeenLastCalledWith('22:00');

    await user.keyboard('{ArrowUp}');

    expect(onChange).toHaveBeenLastCalledWith('21:30');

    await user.keyboard('{Home}');

    expect(onChange).toHaveBeenLastCalledWith('21:00');
  });

  test('끝 항목에서 아래 화살표 키를 눌러도 변경을 알리지 않아야 한다.', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TestWheelPicker onChange={onChange} />);

    screen.getByRole('listbox', { name: '시각' }).focus();
    await user.keyboard('{End}');
    onChange.mockClear();
    await user.keyboard('{ArrowDown}');

    expect(onChange).not.toHaveBeenCalled();
  });
});

const mockScrollTop = (element: HTMLElement) => {
  let scrollTop = 0;

  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    get: () => scrollTop,
    set: (nextScrollTop: number) => {
      scrollTop = nextScrollTop;
    },
  });
};

const scrollListTo = (element: HTMLElement, scrollTop: number) => {
  element.scrollTop = scrollTop;
  fireEvent.scroll(element);
};

describe('스크롤과 값 맞추기', () => {
  test('굴려서 가운데에 온 항목을 바로 알려야 한다.', () => {
    const onChange = vi.fn();
    render(<TestWheelPicker onChange={onChange} />);
    const listbox = screen.getByRole('listbox', { name: '시각' });
    mockScrollTop(listbox);

    scrollListTo(listbox, 80);

    expect(onChange).toHaveBeenLastCalledWith('22:00');
  });

  test('항목을 눌러 옮기는 동안 지나가는 항목은 알리지 않고, 도착한 뒤 굴리면 다시 알려야 한다.', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TestWheelPicker onChange={onChange} />);
    const listbox = screen.getByRole('listbox', { name: '시각' });
    mockScrollTop(listbox);
    listbox.scrollTo = vi.fn();

    await user.click(screen.getByRole('option', { name: '22:00' }));
    scrollListTo(listbox, 40);

    expect(onChange.mock.calls).toEqual([['22:00']]);

    scrollListTo(listbox, 80);
    scrollListTo(listbox, 40);

    expect(onChange).toHaveBeenLastCalledWith('21:30');
  });

  test('밖에서 값이 바뀌면 그 항목이 가운데에 오도록 스크롤 위치를 옮겨야 한다.', () => {
    const columns = (value: string) => [
      { 'aria-label': '시각', options: OPTIONS, value, onChange: vi.fn() },
    ];
    const { rerender } = render(<WheelPicker columns={columns('21:00')} />);
    const listbox = screen.getByRole('listbox', { name: '시각' });
    mockScrollTop(listbox);

    rerender(<WheelPicker columns={columns('22:00')} />);

    expect(listbox.scrollTop).toBe(80);
  });
});
