import { fireEvent, renderHook } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import useHistoryShortcuts from './useHistoryShortcuts';

const setup = (isEnabled = true, isBlocked?: () => boolean) => {
  const onUndo = vi.fn();
  const onRedo = vi.fn();
  const view = renderHook(
    (props: { isEnabled: boolean }) =>
      useHistoryShortcuts({
        isEnabled: props.isEnabled,
        onUndo,
        onRedo,
        isBlocked,
      }),
    { initialProps: { isEnabled } },
  );

  return { onUndo, onRedo, view };
};

describe('실행 취소·다시 실행 단축키', () => {
  test('Ctrl+Z를 누르면 실행 취소해야 한다.', () => {
    const { onUndo, onRedo } = setup();

    fireEvent.keyDown(window, { key: 'z', code: 'KeyZ', ctrlKey: true });

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onRedo).not.toHaveBeenCalled();
  });

  test('Cmd+Z를 누르면 실행 취소해야 한다.', () => {
    const { onUndo } = setup();

    fireEvent.keyDown(window, { key: 'z', code: 'KeyZ', metaKey: true });

    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  test('Ctrl+Shift+Z와 Cmd+Shift+Z를 누르면 다시 실행해야 한다.', () => {
    const { onRedo } = setup();

    fireEvent.keyDown(window, {
      key: 'Z',
      code: 'KeyZ',
      ctrlKey: true,
      shiftKey: true,
    });
    fireEvent.keyDown(window, {
      key: 'Z',
      code: 'KeyZ',
      metaKey: true,
      shiftKey: true,
    });

    expect(onRedo).toHaveBeenCalledTimes(2);
  });

  test('Ctrl+Y를 누르면 다시 실행해야 한다.', () => {
    const { onRedo } = setup();

    fireEvent.keyDown(window, { key: 'y', code: 'KeyY', ctrlKey: true });

    expect(onRedo).toHaveBeenCalledTimes(1);
  });

  test('한글 입력 상태에서도 Z 키 자리를 누르면 실행 취소해야 한다.', () => {
    const { onUndo } = setup();

    fireEvent.keyDown(window, { key: 'ㅋ', code: 'KeyZ', ctrlKey: true });

    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  test('수정 키 없이 Z를 누르거나 Alt를 함께 누르면 무시해야 한다.', () => {
    const { onUndo } = setup();

    fireEvent.keyDown(window, { key: 'z', code: 'KeyZ' });
    fireEvent.keyDown(window, {
      key: 'z',
      code: 'KeyZ',
      ctrlKey: true,
      altKey: true,
    });

    expect(onUndo).not.toHaveBeenCalled();
  });
});

describe('단축키를 무시하는 경우', () => {
  test('입력칸에 포커스가 있으면 글자 되돌리기를 막지 않아야 한다.', () => {
    const { onUndo } = setup();
    const input = document.createElement('input');
    document.body.append(input);

    const isNotPrevented = fireEvent.keyDown(input, {
      key: 'z',
      code: 'KeyZ',
      ctrlKey: true,
    });

    expect(onUndo).not.toHaveBeenCalled();
    expect(isNotPrevented).toBe(true);
    input.remove();
  });

  test('슬라이더에 포커스가 있을 때는 단축키가 동작해야 한다.', () => {
    const { onUndo } = setup();
    const slider = document.createElement('input');
    slider.type = 'range';
    document.body.append(slider);

    fireEvent.keyDown(slider, { key: 'z', code: 'KeyZ', ctrlKey: true });

    expect(onUndo).toHaveBeenCalledTimes(1);
    slider.remove();
  });

  test('켜져 있지 않으면 무시해야 한다.', () => {
    const { onUndo } = setup(false);

    fireEvent.keyDown(window, { key: 'z', code: 'KeyZ', ctrlKey: true });

    expect(onUndo).not.toHaveBeenCalled();
  });

  test('꺼지면 그 뒤로는 무시해야 한다.', () => {
    const { onUndo, view } = setup(true);

    view.rerender({ isEnabled: false });
    fireEvent.keyDown(window, { key: 'z', code: 'KeyZ', ctrlKey: true });

    expect(onUndo).not.toHaveBeenCalled();
  });

  test('칠하는 중처럼 막혀 있으면 실행 취소하지 않고 브라우저 기본 동작만 막아야 한다.', () => {
    const { onUndo } = setup(true, () => true);

    const isNotPrevented = fireEvent.keyDown(window, {
      key: 'z',
      code: 'KeyZ',
      ctrlKey: true,
    });

    expect(onUndo).not.toHaveBeenCalled();
    expect(isNotPrevented).toBe(false);
  });

  test('한글 조합 중에는 무시해야 한다.', () => {
    const { onUndo } = setup();

    fireEvent.keyDown(window, {
      key: 'ㅋ',
      code: 'KeyZ',
      ctrlKey: true,
      isComposing: true,
    });

    expect(onUndo).not.toHaveBeenCalled();
  });
});
