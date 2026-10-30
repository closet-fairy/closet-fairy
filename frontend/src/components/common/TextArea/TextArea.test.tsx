import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import TextArea from './TextArea';

describe('글자 수 표시', () => {
  test('이모지도 한 글자로 세어야 한다.', () => {
    render(
      <TextArea
        value="옷🧥"
        onChange={() => {}}
        maxLength={300}
        aria-label="요청"
      />,
    );

    expect(screen.getByText('2 / 300')).toBeInTheDocument();
  });
});

describe('오류 표시', () => {
  test('오류 문구를 입력란의 설명으로 연결해야 한다.', () => {
    render(
      <TextArea
        value=""
        onChange={() => {}}
        errorMessage="다시 입력해 주세요."
        aria-label="요청"
      />,
    );

    const input = screen.getByRole('textbox', { name: '요청' });

    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription('다시 입력해 주세요.');
  });
});
