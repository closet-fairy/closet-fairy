import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import AccordionItem from '@/components/common/AccordionItem';
import Accordion from './Accordion';

const renderAccordion = (onValueChange = vi.fn()) =>
  render(
    <Accordion onValueChange={onValueChange}>
      <AccordionItem
        value="category"
        label="분류"
        summary="상의"
        placeholder="분류를 선택해 주세요"
      >
        <button type="button">아우터</button>
      </AccordionItem>
      <AccordionItem
        value="thickness"
        label="두께"
        placeholder="두께를 선택해 주세요"
      >
        <button type="button">얇음</button>
      </AccordionItem>
    </Accordion>,
  );

describe('행 펼치기', () => {
  test('행을 누르면 그 행이 펼쳐지고 값이 전달되어야 한다.', async () => {
    const user = userEvent.setup();
    const handleValueChange = vi.fn();
    renderAccordion(handleValueChange);

    const categoryTrigger = screen.getByRole('button', { name: /분류/ });
    await user.click(categoryTrigger);

    expect(categoryTrigger).toHaveAttribute('aria-expanded', 'true');
    expect(handleValueChange).toHaveBeenLastCalledWith('category');
  });

  test('다른 행을 누르면 열려 있던 행은 접혀야 한다.', async () => {
    const user = userEvent.setup();
    renderAccordion();

    const categoryTrigger = screen.getByRole('button', { name: /분류/ });
    const thicknessTrigger = screen.getByRole('button', { name: /두께/ });
    await user.click(categoryTrigger);
    await user.click(thicknessTrigger);

    expect(thicknessTrigger).toHaveAttribute('aria-expanded', 'true');
    expect(categoryTrigger).toHaveAttribute('aria-expanded', 'false');
  });

  test('value로 펼칠 행을 정하고, null을 넘기면 모두 접혀야 한다.', () => {
    const renderWithValue = (value: string | null) => (
      <Accordion value={value}>
        <AccordionItem value="category" label="분류" placeholder="분류">
          <button type="button">아우터</button>
        </AccordionItem>
        <AccordionItem value="thickness" label="두께" placeholder="두께">
          <button type="button">얇음</button>
        </AccordionItem>
      </Accordion>
    );
    const { rerender } = render(renderWithValue('thickness'));

    expect(screen.getByRole('button', { name: /두께/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    rerender(renderWithValue(null));

    expect(screen.getByRole('button', { name: /두께/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByRole('button', { name: /분류/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  test('펼친 행을 다시 누르면 접히고 null이 전달되어야 한다.', async () => {
    const user = userEvent.setup();
    const handleValueChange = vi.fn();
    renderAccordion(handleValueChange);

    const categoryTrigger = screen.getByRole('button', { name: /분류/ });
    await user.click(categoryTrigger);
    await user.click(categoryTrigger);

    expect(categoryTrigger).toHaveAttribute('aria-expanded', 'false');
    expect(handleValueChange).toHaveBeenLastCalledWith(null);
  });
});
