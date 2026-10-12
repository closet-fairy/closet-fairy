import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import FormField from '@/components/common/FormField';
import TextField from './TextField';

describe('글자 수 카운터', () => {
  test('이모지는 코드 포인트 하나를 한 글자로 세어야 한다.', () => {
    render(
      <TextField
        value="😀😀"
        onChange={vi.fn()}
        maxLength={10}
        aria-label="상황"
      />,
    );

    expect(screen.getByText('2/10')).toBeInTheDocument();
  });

  test('한글은 완성된 글자 하나를 한 글자로 세어야 한다.', () => {
    render(
      <TextField
        value="학교 발표"
        onChange={vi.fn()}
        maxLength={100}
        aria-label="상황"
      />,
    );

    expect(screen.getByText('5/100')).toBeInTheDocument();
  });

  test('카운터가 입력창의 설명으로 연결되어야 한다.', () => {
    render(
      <TextField
        value="학교 발표"
        onChange={vi.fn()}
        maxLength={100}
        aria-label="상황"
      />,
    );

    expect(
      screen.getByRole('textbox', { name: '상황' }),
    ).toHaveAccessibleDescription('5/100');
  });

  test('최대 글자 수를 넘겨도 입력을 막지 않아야 한다.', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <TextField
        value="가나다"
        onChange={handleChange}
        maxLength={3}
        aria-label="상황"
      />,
    );

    await user.type(screen.getByRole('textbox', { name: '상황' }), '라');

    expect(handleChange).toHaveBeenLastCalledWith('가나다라');
  });
});

describe('지우기 버튼', () => {
  test('누르면 빈 문자열로 onChange와 onClear를 호출하고 입력창에 포커스가 남아야 한다.', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const handleClear = vi.fn();
    render(
      <TextField
        value="성동"
        onChange={handleChange}
        onClear={handleClear}
        hasClearButton
        aria-label="주소 검색"
      />,
    );

    await user.click(screen.getByRole('button', { name: '입력 지우기' }));

    expect(handleChange).toHaveBeenCalledWith('');
    expect(handleClear).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('textbox', { name: '주소 검색' })).toHaveFocus();
  });

  test('값이 비어 있으면 보이지 않아야 한다.', () => {
    render(
      <TextField
        value=""
        onChange={vi.fn()}
        hasClearButton
        aria-label="주소 검색"
      />,
    );

    expect(
      screen.queryByRole('button', { name: '입력 지우기' }),
    ).not.toBeInTheDocument();
  });

  test('비활성 상태에서는 보이지 않아야 한다.', () => {
    render(
      <TextField
        value="성동"
        onChange={vi.fn()}
        hasClearButton
        isDisabled
        aria-label="주소 검색"
      />,
    );

    expect(
      screen.queryByRole('button', { name: '입력 지우기' }),
    ).not.toBeInTheDocument();
  });
});

describe('한글 조합 중 지우기', () => {
  test('조합 중에 지우기 버튼을 누르면 조합을 확정하며 들어온 글자는 무시하고 빈 문자열로만 onChange를 호출해야 한다.', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const handleBlur = vi.fn();
    const handleFocus = vi.fn();
    render(
      <TextField
        value="성동가"
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        hasClearButton
        aria-label="주소 검색"
      />,
    );
    const input = screen.getByRole('textbox', { name: '주소 검색' });
    await user.click(input);
    handleFocus.mockClear();
    fireEvent.compositionStart(input);
    let hasCompositionEnded = false;
    input.addEventListener('blur', () => {
      hasCompositionEnded = true;
      fireEvent.change(input, { target: { value: '성동가' } });
      fireEvent.compositionEnd(input);
    });

    await user.click(screen.getByRole('button', { name: '입력 지우기' }));

    expect(hasCompositionEnded).toBe(true);
    expect(handleChange.mock.calls).toEqual([['']]);
    expect(handleBlur).not.toHaveBeenCalled();
    expect(handleFocus).not.toHaveBeenCalled();
    expect(input).toHaveFocus();
  });

  test('조합 중에 지운 뒤 조합 종료 이벤트가 와도 값이 다시 생기지 않아야 한다.', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const { rerender } = render(
      <TextField
        value="성동가"
        onChange={handleChange}
        hasClearButton
        aria-label="주소 검색"
      />,
    );
    const input = screen.getByRole('textbox', { name: '주소 검색' });
    await user.click(input);
    fireEvent.compositionStart(input);

    await user.click(screen.getByRole('button', { name: '입력 지우기' }));
    rerender(
      <TextField
        value=""
        onChange={handleChange}
        hasClearButton
        aria-label="주소 검색"
      />,
    );
    fireEvent.compositionEnd(input);

    expect(handleChange.mock.calls).toEqual([['']]);
    expect(input).toHaveValue('');
  });

  test('조합 중이 아니면 입력창의 포커스를 잃지 않고 지워야 한다.', async () => {
    const user = userEvent.setup();
    const handleBlur = vi.fn();
    render(
      <TextField
        value="성동"
        onChange={vi.fn()}
        onBlur={handleBlur}
        hasClearButton
        aria-label="주소 검색"
      />,
    );
    await user.click(screen.getByRole('textbox', { name: '주소 검색' }));

    await user.click(screen.getByRole('button', { name: '입력 지우기' }));

    expect(handleBlur).not.toHaveBeenCalled();
  });
});

describe('입력창 속성 전달', () => {
  test('넘긴 설명 id를 에러 문구, 카운터와 함께 입력창의 설명으로 연결해야 한다.', () => {
    render(
      <>
        <p id="hint">시·구 단위로 찾아요.</p>
        <TextField
          value="학교 발표"
          onChange={vi.fn()}
          maxLength={100}
          errorMessage="다시 확인해 주세요."
          aria-describedby="hint"
          aria-label="상황"
        />
      </>,
    );

    expect(
      screen.getByRole('textbox', { name: '상황' }),
    ).toHaveAccessibleDescription(
      '시·구 단위로 찾아요. 다시 확인해 주세요. 5/100',
    );
  });

  test('읽기 전용이면 값을 고칠 수 없고 지우기 버튼이 보이지 않아야 한다.', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <TextField
        value="성동"
        onChange={handleChange}
        hasClearButton
        isReadOnly
        aria-label="주소 검색"
      />,
    );

    await user.type(screen.getByRole('textbox', { name: '주소 검색' }), '구');

    expect(handleChange).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: '입력 지우기' }),
    ).not.toBeInTheDocument();
  });

  test('필수 입력이면 스크린리더에 필수로 알려야 한다.', () => {
    render(
      <TextField value="" onChange={vi.fn()} isRequired aria-label="상황" />,
    );

    expect(screen.getByRole('textbox', { name: '상황' })).toBeRequired();
  });

  test('검색 형식이면 검색창으로 읽혀야 한다.', () => {
    render(
      <TextField
        value=""
        onChange={vi.fn()}
        type="search"
        aria-label="주소 검색"
      />,
    );

    expect(
      screen.getByRole('searchbox', { name: '주소 검색' }),
    ).toBeInTheDocument();
  });

  test('키를 누르면 onKeyDown을 호출해야 한다.', async () => {
    const user = userEvent.setup();
    const handleKeyDown = vi.fn();
    render(
      <TextField
        value=""
        onChange={vi.fn()}
        onKeyDown={handleKeyDown}
        aria-label="상황"
      />,
    );

    await user.type(screen.getByRole('textbox', { name: '상황' }), '{Enter}');

    expect(handleKeyDown).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'Enter' }),
    );
  });
});

describe('FormField 연결', () => {
  test('FormField 안에 두면 라벨이 이름으로, 안내 문구가 설명으로 연결되어야 한다.', () => {
    render(
      <FormField label="상황" hint="100자까지 쓸 수 있어요.">
        <TextField value="학교 발표" onChange={vi.fn()} maxLength={100} />
      </FormField>,
    );

    expect(
      screen.getByRole('textbox', { name: '상황' }),
    ).toHaveAccessibleDescription('100자까지 쓸 수 있어요. 5/100');
  });

  test('htmlFor로 라벨을 연결해도 이름이 한 번만 읽혀야 한다.', () => {
    render(
      <FormField label="상황" htmlFor="situation">
        <TextField id="situation" value="" onChange={vi.fn()} />
      </FormField>,
    );

    expect(screen.getByRole('textbox')).toHaveAccessibleName('상황');
  });

  test('aria-label을 직접 넘기면 FormField 라벨보다 우선해야 한다.', () => {
    render(
      <FormField label="상황">
        <TextField value="" onChange={vi.fn()} aria-label="오늘의 상황" />
      </FormField>,
    );

    expect(screen.getByRole('textbox')).toHaveAccessibleName('오늘의 상황');
  });
});

describe('에러 표시', () => {
  test('에러 문구가 있으면 입력창이 invalid 상태가 되고 문구가 설명으로 연결되어야 한다.', () => {
    render(
      <TextField
        value="잘못된 값"
        onChange={vi.fn()}
        errorMessage="다시 확인해 주세요."
        aria-label="입력"
      />,
    );

    const input = screen.getByRole('textbox', { name: '입력' });
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription('다시 확인해 주세요.');
  });
});
