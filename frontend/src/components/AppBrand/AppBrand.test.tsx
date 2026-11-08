import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import AppBrand from './AppBrand';

describe('앱 이름 표기', () => {
  test('제목은 띄어쓰기 없이 옷장요정으로 보여야 한다.', () => {
    render(<AppBrand />);

    expect(
      screen.getByRole('heading', { level: 1, name: '옷장요정' }),
    ).toBeInTheDocument();
  });
});

describe('로고 접근성', () => {
  test('로고 이미지는 장식이라 보조 기술에 노출되지 않아야 한다.', () => {
    render(<AppBrand />);

    const logo = screen.getByRole('presentation', { hidden: true });
    expect(logo).toHaveAttribute('alt', '');
    expect(logo).toHaveAttribute('aria-hidden', 'true');
  });
});
