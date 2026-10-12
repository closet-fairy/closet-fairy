import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import ListItem from './ListItem';

describe('행 누르기', () => {
  test('onClick을 넘기면 행 전체가 제목을 이름으로 하는 버튼이 되어야 한다.', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(
      <ListItem
        title="현재 위치 사용"
        description="위치 권한을 한 번 확인합니다"
        onClick={handleClick}
      />,
    );

    await user.click(screen.getByRole('button', { name: /현재 위치 사용/ }));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test('비활성 상태에서는 눌러도 onClick을 호출하지 않아야 한다.', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(
      <ListItem title="서울특별시 성동구" isDisabled onClick={handleClick} />,
    );

    await user.click(screen.getByRole('button', { name: '서울특별시 성동구' }));

    expect(handleClick).not.toHaveBeenCalled();
  });

  test('onClick이 없으면 버튼으로 그리지 않아야 한다.', () => {
    render(<ListItem title="서울특별시 성동구" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('서울특별시 성동구')).toBeInTheDocument();
  });
});
