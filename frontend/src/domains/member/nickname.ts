export const NICKNAME_MAX_LENGTH = 30;

export const validateNickname = (nickname: string) => {
  const trimmed = nickname.trim();

  if (trimmed === '') {
    return '닉네임은 비워 둘 수 없습니다.';
  }

  if ([...trimmed].length > NICKNAME_MAX_LENGTH) {
    return `닉네임은 ${NICKNAME_MAX_LENGTH}자까지 입력할 수 있습니다.`;
  }

  return null;
};
