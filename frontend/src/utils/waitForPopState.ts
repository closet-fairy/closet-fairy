const URL_RESTORE_TIMEOUT_MS = 1000;

/*
 * 뒤로 가기를 막으면 브라우저가 이미 바꾼 주소를 history.go로 되돌리는데, 이 이동은 비동기다.
 * 되돌리기가 끝나기 전에 다른 화면으로 replace하면 원래 화면 대신 이전 화면 기록이 바뀌어 버린다.
 */
const waitForPopState = () =>
  new Promise<void>((resolve) => {
    const handleDone = () => {
      clearTimeout(timer);
      window.removeEventListener('popstate', handleDone);
      resolve();
    };
    const timer = setTimeout(handleDone, URL_RESTORE_TIMEOUT_MS);

    window.addEventListener('popstate', handleDone);
  });

export default waitForPopState;
