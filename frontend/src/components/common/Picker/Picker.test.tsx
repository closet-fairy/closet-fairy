import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import Picker from './Picker';

const OPTIONS = [
  { value: '09:00', label: '09:00' },
  { value: '09:30', label: '09:30' },
  { value: '10:00', label: '10:00' },
];

const renderPicker = (onChange: (value: string) => void) =>
  render(
    <Picker
      label="나가는 시간"
      options={OPTIONS}
      value="09:00"
      onChange={onChange}
    />,
  );

describe('트리거 이름', () => {
  test('선택된 값이 없으면 이름과 placeholder를 함께 읽어야 한다.', () => {
    render(
      <Picker
        label="나가는 시간"
        options={OPTIONS}
        value={null}
        onChange={vi.fn()}
        placeholder="시간 선택"
      />,
    );

    expect(
      screen.getByRole('button', { name: '나가는 시간 시간 선택' }),
    ).toBeInTheDocument();
  });
});

describe('선택지 고르기', () => {
  test('트리거를 누르면 선택된 항목이 표시된 목록 시트가 열려야 한다.', async () => {
    const user = userEvent.setup();
    renderPicker(vi.fn());

    const trigger = screen.getByRole('button', { name: '나가는 시간 09:00' });
    await user.click(trigger);

    await screen.findByRole('dialog', { name: '나가는 시간' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('option', { name: '09:00' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('다른 항목을 누르면 그 값으로 선택 변경을 알리고 시트가 닫혀야 한다.', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    renderPicker(handleChange);

    await user.click(screen.getByRole('button', { name: /나가는 시간/ }));
    await user.click(await screen.findByRole('option', { name: '09:30' }));

    expect(handleChange).toHaveBeenCalledWith('09:30');
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: '나가는 시간' }),
      ).not.toBeInTheDocument();
    });
  });

  test('이미 선택된 항목을 누르면 선택 변경을 알리지 않고 시트만 닫혀야 한다.', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    renderPicker(handleChange);

    await user.click(screen.getByRole('button', { name: /나가는 시간/ }));
    await user.click(await screen.findByRole('option', { name: '09:00' }));

    expect(handleChange).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: '나가는 시간' }),
      ).not.toBeInTheDocument();
    });
  });

  test('키보드로 아래 항목에 옮겨 Enter를 누르면 그 값으로 선택 변경을 알려야 한다.', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    renderPicker(handleChange);

    await user.click(screen.getByRole('button', { name: /나가는 시간/ }));
    const selectedOption = await screen.findByRole('option', { name: '09:00' });
    selectedOption.focus();
    await user.keyboard('{ArrowDown}{Enter}');

    expect(handleChange).toHaveBeenCalledWith('09:30');
  });

  test('비활성 상태에서는 트리거를 눌러도 시트가 열리지 않아야 한다.', async () => {
    const user = userEvent.setup();
    render(
      <Picker
        label="나가는 시간"
        options={OPTIONS}
        value="09:00"
        onChange={vi.fn()}
        isDisabled
      />,
    );

    await user.click(screen.getByRole('button', { name: /나가는 시간/ }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
