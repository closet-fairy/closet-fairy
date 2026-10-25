import { useEffect, useState } from 'react';
import type { Size } from '@/domains/clothingImageEdit/types';

const EMPTY_SIZE: Size = { width: 0, height: 0 };

const useElementSize = <T extends HTMLElement>() => {
  const [element, setElement] = useState<T | null>(null);
  const [size, setSize] = useState<Size>(EMPTY_SIZE);

  useEffect(() => {
    if (element === null) {
      return;
    }

    // ResizeObserver는 관찰을 시작할 때도 한 번 알려 주므로 처음 크기를 따로 재지 않는다.
    const observer = new ResizeObserver(([entry]) => {
      if (entry === undefined) {
        return;
      }

      const { width, height } = entry.contentRect;
      setSize((previous) =>
        previous.width === width && previous.height === height
          ? previous
          : { width, height },
      );
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [element]);

  return { ref: setElement, size };
};

export default useElementSize;
