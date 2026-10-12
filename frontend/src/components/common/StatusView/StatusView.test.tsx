import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import StatusView from './StatusView';

describe('진행 상태 알림', () => {
  test('제목과 부제는 status 영역 안에 있어야 한다.', () => {
    render(
      <StatusView
        title="코디를 만들고 있어요"
        description="잠시만 기다려 주세요..."
      />,
    );

    const status = screen.getByRole('status');

    expect(status).toContainElement(
      screen.getByRole('heading', { name: '코디를 만들고 있어요' }),
    );
    expect(status).toHaveTextContent('잠시만 기다려 주세요...');
  });

  test('진행 중이어도 제목을 담은 status 영역에는 aria-busy가 붙지 않아야 한다.', () => {
    render(
      <StatusView title="오늘의 코디로 정했어요" isBusy>
        <p>요약 카드</p>
      </StatusView>,
    );

    expect(screen.getByRole('status')).not.toHaveAttribute('aria-busy');
  });
});
