// 사생활 보호 모드처럼 저장소를 막은 환경에서는 접근만 해도 예외가 나므로, 이때는 기억하지 않는다.
const getSessionStorage = () => {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
};

export const readSessionJson = (key: string): unknown => {
  try {
    const raw = getSessionStorage()?.getItem(key);

    return raw === null || raw === undefined ? null : JSON.parse(raw);
  } catch {
    return null;
  }
};

export const writeSessionJson = (key: string, value: unknown) => {
  try {
    getSessionStorage()?.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
};

export const removeSessionItem = (key: string) => {
  try {
    getSessionStorage()?.removeItem(key);
  } catch {
    return;
  }
};
