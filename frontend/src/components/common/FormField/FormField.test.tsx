import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import Chip from '@/components/common/Chip';
import ChipGroup from '@/components/common/ChipGroup';
import FormField from './FormField';

describe('라벨 연결', () => {
  test('htmlFor를 넘기면 라벨이 그 id의 입력 요소 이름이 되어야 한다.', () => {
    render(
      <FormField label="상황" htmlFor="situation">
        <input id="situation" />
      </FormField>,
    );

    expect(screen.getByRole('textbox', { name: '상황' })).toBeInTheDocument();
  });

  test('안쪽 칩 묶음은 라벨을 이름으로, 안내를 설명으로 가진 하나의 묶음이어야 한다.', () => {
    render(
      <FormField label="상황" hint="하나만 선택">
        <ChipGroup value="데일리" onChange={vi.fn()}>
          <Chip value="데일리">데일리</Chip>
        </ChipGroup>
      </FormField>,
    );

    const groups = screen.getAllByRole('group');

    expect(groups).toHaveLength(1);
    expect(groups.at(0)).toHaveAccessibleName('상황');
    expect(groups.at(0)).toHaveAccessibleDescription('하나만 선택');
  });

  test('칩 묶음에 aria-label을 넘기면 라벨 대신 그 이름을 써야 한다.', () => {
    render(
      <FormField label="상황">
        <ChipGroup aria-label="오늘의 상황" value="데일리" onChange={vi.fn()}>
          <Chip value="데일리">데일리</Chip>
        </ChipGroup>
      </FormField>,
    );

    expect(
      screen.getByRole('group', { name: '오늘의 상황' }),
    ).toBeInTheDocument();
  });
});
