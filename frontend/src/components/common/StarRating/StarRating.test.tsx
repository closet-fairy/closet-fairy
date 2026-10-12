import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import StarRating from './StarRating';

describe('별점 입력', () => {
  test('별을 누르면 그 별의 개수로 onChange를 호출해야 한다.', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<StarRating value={0} onChange={handleChange} />);

    await user.click(screen.getByRole('radio', { name: '별 3개' }));

    expect(handleChange).toHaveBeenCalledWith(3);
  });

  test('이미 고른 별을 다시 눌러도 해제되지 않아야 한다.', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<StarRating value={3} onChange={handleChange} />);

    await user.click(screen.getByRole('radio', { name: '별 3개' }));

    expect(handleChange).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: '별 3개' })).toBeChecked();
  });

  test('별 다섯 개가 라벨 이름의 묶음 안에 있어야 한다.', () => {
    render(
      <StarRating value={0} onChange={vi.fn()} aria-label="코디 만족도" />,
    );

    const group = screen.getByRole('group', { name: '코디 만족도' });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(5);
  });

  test('비활성 상태에서는 모든 별을 누를 수 없고 눌러도 onChange를 호출하지 않아야 한다.', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<StarRating value={2} onChange={handleChange} isDisabled />);

    await user.click(screen.getByRole('radio', { name: '별 4개' }));

    screen.getAllByRole('radio').forEach((radio) => {
      expect(radio).toBeDisabled();
    });
    expect(handleChange).not.toHaveBeenCalled();
  });
});

describe('읽기 전용 표시', () => {
  test('누를 수 있는 별 없이 별점을 하나의 이미지 이름으로 읽혀야 한다.', () => {
    render(<StarRating value={4} isReadOnly />);

    expect(
      screen.getByRole('img', { name: '별점 5점 중 4점' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  test('aria-label을 넘기면 그 이름 뒤에 별점을 붙여 읽혀야 한다.', () => {
    render(<StarRating value={4} isReadOnly aria-label="코디 만족도" />);

    expect(
      screen.getByRole('img', { name: '코디 만족도 5점 중 4점' }),
    ).toBeInTheDocument();
  });

  test('작은 크기도 누를 수 있는 별 없이 별점을 하나의 이미지 이름으로 읽혀야 한다.', () => {
    render(<StarRating value={4} size="sm" isReadOnly />);

    expect(
      screen.getByRole('img', { name: '별점 5점 중 4점' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });
});
