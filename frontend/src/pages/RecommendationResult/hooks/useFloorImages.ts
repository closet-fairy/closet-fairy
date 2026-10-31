import { useEffect, useState } from 'react';

type ImageResult = 'loaded' | 'failed';

const SLOW_MS = 400;
const TIMEOUT_MS = 8000;

/*
 * 바닥은 사진 결과가 모두 정해진 뒤 한 번만 배치한다. 제한 시간까지 결과가 없는 사진은 실패로 보고,
 * 늦게 도착해도 배치가 흔들리지 않도록 결과를 더 받지 않는다.
 */
const useFloorImages = (imageUrls: readonly string[]) => {
  const [results, setResults] = useState<Record<string, ImageResult>>({});
  const [isSlow, setIsSlow] = useState(false);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const isSettled = isTimedOut || imageUrls.every((url) => url in results);

  useEffect(() => {
    if (isSettled) return;

    const slowTimer = setTimeout(() => {
      setIsSlow(true);
    }, SLOW_MS);
    const timeoutTimer = setTimeout(() => {
      setIsTimedOut(true);
    }, TIMEOUT_MS);

    return () => {
      clearTimeout(slowTimer);
      clearTimeout(timeoutTimer);
    };
  }, [isSettled]);

  const markResult = (url: string, result: ImageResult) => {
    if (isTimedOut) return;

    setResults((current) => ({ ...current, [url]: result }));
  };

  return {
    isSettled,
    isSlow,
    isLoaded: (url: string) => results[url] === 'loaded',
    markResult,
  };
};

export default useFloorImages;
