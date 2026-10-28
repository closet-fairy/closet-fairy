import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import Accordion from '@/components/common/Accordion';
import AccordionItem from './AccordionItem';

describe('값 요약', () => {
  test('값이 있으면 행에 값을 보여야 한다.', () => {
    render(
      <Accordion>
        <AccordionItem
          value="category"
          label="분류"
          summary="상의"
          placeholder="분류를 선택해 주세요"
        >
          내용
        </AccordionItem>
      </Accordion>,
    );

    expect(screen.getByRole('button', { name: '분류 상의' })).toBeVisible();
    expect(screen.queryByText('분류를 선택해 주세요')).not.toBeInTheDocument();
  });

  test('값이 비어 있으면 안내 문구를 보여야 한다.', () => {
    render(
      <Accordion>
        <AccordionItem
          value="category"
          label="분류"
          summary=""
          placeholder="분류를 선택해 주세요"
        >
          내용
        </AccordionItem>
      </Accordion>,
    );

    expect(
      screen.getByRole('button', { name: '분류 분류를 선택해 주세요' }),
    ).toBeVisible();
  });
});

describe('에러 문구', () => {
  test('에러 문구를 넘기면 바로 읽히고 행 버튼의 설명으로 이어져야 한다.', () => {
    render(
      <Accordion>
        <AccordionItem
          value="color"
          label="색상"
          summary="베이지"
          placeholder="색상을 선택해 주세요"
          errorMessage="서버에 연결할 수 없습니다."
        >
          내용
        </AccordionItem>
      </Accordion>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      '서버에 연결할 수 없습니다.',
    );
    expect(
      screen.getByRole('button', { name: '색상 베이지' }),
    ).toHaveAccessibleDescription('서버에 연결할 수 없습니다.');
  });
});
