import { useEffect, useRef } from 'react';

interface UseHistoryShortcutsParams {
  isEnabled: boolean;
  onUndo: () => void;
  onRedo: () => void;
  // 칠하는 중처럼 키를 누른 순간에만 알 수 있는 상태로 막을 때 쓴다.
  isBlocked?: () => boolean;
}

type HistoryShortcut = 'undo' | 'redo';

// 슬라이더처럼 글자를 쓰지 않는 입력 요소에서는 단축키가 동작해야 한다.
const EDITABLE_SELECTOR = [
  'input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="button"])',
  'textarea',
  'select',
  '[contenteditable=""]',
  '[contenteditable="true"]',
].join(', ');

// 한글 입력 상태에서는 key가 'ㅋ'처럼 들어오므로, 영문 글자가 아니면 물리 키 위치로 판단한다.
const getLetter = (event: KeyboardEvent) => {
  if (/^[a-z]$/i.test(event.key)) {
    return event.key.toLowerCase();
  }

  const match = /^Key([A-Z])$/.exec(event.code);

  return match ? match[1].toLowerCase() : null;
};

const getHistoryShortcut = (event: KeyboardEvent): HistoryShortcut | null => {
  if (event.altKey) {
    return null;
  }

  const letter = getLetter(event);
  const hasModifier = event.ctrlKey || event.metaKey;

  if (letter === 'z' && hasModifier) {
    return event.shiftKey ? 'redo' : 'undo';
  }

  if (letter === 'y' && event.ctrlKey && !event.metaKey && !event.shiftKey) {
    return 'redo';
  }

  return null;
};

const isEditableTarget = (target: EventTarget | null) =>
  target instanceof Element && target.closest(EDITABLE_SELECTOR) !== null;

const useHistoryShortcuts = (params: UseHistoryShortcutsParams) => {
  const { isEnabled, onUndo, onRedo, isBlocked } = params;
  const handlersRef = useRef({ onUndo, onRedo, isBlocked });

  useEffect(() => {
    handlersRef.current = { onUndo, onRedo, isBlocked };
  }, [onUndo, onRedo, isBlocked]);

  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      const shortcut = getHistoryShortcut(event);

      if (shortcut === null) {
        return;
      }

      event.preventDefault();

      if (handlersRef.current.isBlocked?.()) {
        return;
      }

      if (shortcut === 'undo') {
        handlersRef.current.onUndo();
      } else {
        handlersRef.current.onRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isEnabled]);
};

export default useHistoryShortcuts;
