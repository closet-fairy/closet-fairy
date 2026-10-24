import { describe, expect, test } from 'vitest';
import { isDefaultMask, planSaveRequests } from './saveRequests';

describe('기본 마스크 판별', () => {
  test('기본 마스크로 되돌렸다면 저장된 마스크가 있어도 기본이어야 한다.', () => {
    expect(isDefaultMask('default', true)).toBe(true);
  });

  test('불러온 그대로라면 저장된 마스크가 없을 때만 기본이어야 한다.', () => {
    expect(isDefaultMask('initial', false)).toBe(true);
    expect(isDefaultMask('initial', true)).toBe(false);
  });

  test('붓질한 마스크는 기본이 아니어야 한다.', () => {
    expect(isDefaultMask('edited', false)).toBe(false);
  });
});

describe('저장 요청 순서', () => {
  test('모든 값이 기본이면 초기화 요청 하나만 보내야 한다.', () => {
    expect(
      planSaveRequests({
        isDefaultTransform: true,
        maskStatus: 'default',
        hasSavedMask: true,
      }),
    ).toEqual(['resetEdit']);
    expect(
      planSaveRequests({
        isDefaultTransform: true,
        maskStatus: 'initial',
        hasSavedMask: false,
      }),
    ).toEqual(['resetEdit']);
  });

  test('회전·원근만 바꿨다면 편집값과 표시 이미지를 저장해야 한다.', () => {
    expect(
      planSaveRequests({
        isDefaultTransform: false,
        maskStatus: 'initial',
        hasSavedMask: true,
      }),
    ).toEqual(['saveEdit', 'saveDisplay']);
  });

  test('붓질했다면 편집값, 마스크, 표시 이미지 순서로 저장해야 한다.', () => {
    expect(
      planSaveRequests({
        isDefaultTransform: true,
        maskStatus: 'edited',
        hasSavedMask: false,
      }),
    ).toEqual(['saveEdit', 'saveMask', 'saveDisplay']);
  });

  test('저장된 마스크를 기본으로 되돌리고 회전·원근을 남겼다면 먼저 초기화해야 한다.', () => {
    expect(
      planSaveRequests({
        isDefaultTransform: false,
        maskStatus: 'default',
        hasSavedMask: true,
      }),
    ).toEqual(['resetEdit', 'saveEdit', 'saveDisplay']);
  });

  test('저장된 마스크가 없는데 기본으로 되돌렸다면 초기화하지 않아야 한다.', () => {
    expect(
      planSaveRequests({
        isDefaultTransform: false,
        maskStatus: 'default',
        hasSavedMask: false,
      }),
    ).toEqual(['saveEdit', 'saveDisplay']);
  });
});
