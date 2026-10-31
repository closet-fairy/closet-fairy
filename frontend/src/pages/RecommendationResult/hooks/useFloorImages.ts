import { useEffect, useState } from 'react';
import { getClothingArea } from '@/domains/recommendation/clothingArea';
import type { ClothingArea } from '@/domains/recommendation/clothingArea';
import { readImagePixels } from '@/utils/readImagePixels';

type ImageResult = ClothingArea | 'failed';

const SLOW_MS = 400;
const TIMEOUT_MS = 8000;
const PIXEL_READ_SIZE = 128;

const clothingAreas = new Map<string, ClothingArea>();

// 픽셀을 읽을 수 없거나 옷을 찾지 못한 사진은 여백을 자르지 않고 사진 전체를 옷으로 본다.
const measureClothingArea = (url: string, image: HTMLImageElement) => {
  const measuredArea = clothingAreas.get(url);

  if (measuredArea) return measuredArea;

  const { naturalWidth, naturalHeight } = image;
  const sourceRatio =
    naturalWidth > 0 && naturalHeight > 0 ? naturalWidth / naturalHeight : 1;
  const pixels = readImagePixels(image, PIXEL_READ_SIZE);
  const area = (pixels && getClothingArea(pixels, sourceRatio)) ?? {
    left: 0,
    top: 0,
    width: 1,
    height: 1,
    ratio: sourceRatio,
  };

  clothingAreas.set(url, area);

  return area;
};

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

  const markLoaded = (url: string, image: HTMLImageElement) => {
    if (isTimedOut) return;

    const area = measureClothingArea(url, image);

    setResults((current) => ({ ...current, [url]: area }));
  };

  const markFailed = (url: string) => {
    if (isTimedOut) return;

    setResults((current) => ({ ...current, [url]: 'failed' }));
  };

  const getLoadedArea = (url: string) => {
    const result = results[url];

    return result === undefined || result === 'failed' ? null : result;
  };

  return { isSettled, isSlow, getLoadedArea, markLoaded, markFailed };
};

export default useFloorImages;
