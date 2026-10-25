export const WITHDRAWAL_CONFIRM_PHRASE = '탈퇴합니다';

export const isWithdrawalConfirmed = (input: string) =>
  input.trim() === WITHDRAWAL_CONFIRM_PHRASE;
