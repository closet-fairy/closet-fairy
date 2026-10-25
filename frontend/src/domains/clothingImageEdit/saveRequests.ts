export type MaskStatus = 'initial' | 'edited' | 'default';

export type SaveRequest = 'resetEdit' | 'saveEdit' | 'saveMask' | 'saveDisplay';

interface PlanSaveRequestsParams {
  isDefaultTransform: boolean;
  maskStatus: MaskStatus;
  hasSavedMask: boolean;
}

export const isDefaultMask = (maskStatus: MaskStatus, hasSavedMask: boolean) =>
  maskStatus === 'default' || (maskStatus === 'initial' && !hasSavedMask);

/*
 * 회전·원근 저장은 마스크를 건드리지 않고, 마스크를 지우는 요청은 초기화뿐이다.
 * 그래서 저장된 마스크를 기본으로 되돌리면서 다른 값을 남기려면 먼저 초기화한다.
 * 회전·원근이나 마스크를 저장하면 표시 이미지가 비워지므로 표시 이미지는 늘 마지막에 올린다.
 */
export const planSaveRequests = (
  params: PlanSaveRequestsParams,
): SaveRequest[] => {
  const { isDefaultTransform, maskStatus, hasSavedMask } = params;

  if (isDefaultTransform && isDefaultMask(maskStatus, hasSavedMask)) {
    return ['resetEdit'];
  }

  if (maskStatus === 'edited') {
    return ['saveEdit', 'saveMask', 'saveDisplay'];
  }

  if (maskStatus === 'default' && hasSavedMask) {
    return ['resetEdit', 'saveEdit', 'saveDisplay'];
  }

  return ['saveEdit', 'saveDisplay'];
};
