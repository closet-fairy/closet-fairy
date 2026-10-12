import useEmblaCarousel from 'embla-carousel-react';
import type { UseEmblaCarouselType } from 'embla-carousel-react';
import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useEffectEvent,
  useState,
  useSyncExternalStore,
} from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import IconButton from '@/components/common/IconButton';
import type { IconButtonVariant } from '@/components/common/IconButton/IconButton';
import * as S from './Carousel.styled';

type EmblaApi = NonNullable<UseEmblaCarouselType[1]>;

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const isReducedMotion = () => window.matchMedia(REDUCED_MOTION_QUERY).matches;

const getSlideKey = (slide: ReactNode, slideIndex: number) =>
  isValidElement(slide) && slide.key !== null ? slide.key : slideIndex;

interface CarouselProps {
  children: ReactNode;
  'aria-label': string;
  index?: number;
  onIndexChange?: (index: number) => void;
  isLooped?: boolean;
  hasArrows?: boolean;
  arrowVariant?: IconButtonVariant;
}

const Carousel = (props: CarouselProps) => {
  const {
    children,
    'aria-label': ariaLabel,
    index,
    onIndexChange,
    isLooped = true,
    hasArrows = true,
    arrowVariant = 'circle',
  } = props;
  const slides = Children.toArray(children);
  const slideCount = slides.length;
  const [initialIndex] = useState(index ?? 0);
  const [viewportRef, emblaApi] = useEmblaCarousel({
    loop: isLooped,
    startIndex: initialIndex,
  });

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!emblaApi) return () => {};

      emblaApi.on('select', onChange).on('reInit', onChange);

      return () => {
        emblaApi.off('select', onChange).off('reInit', onChange);
      };
    },
    [emblaApi],
  );

  const selectedIndex = useSyncExternalStore(
    subscribe,
    () => emblaApi?.selectedScrollSnap() ?? initialIndex,
  );
  const canScrollPrev = useSyncExternalStore(
    subscribe,
    () => emblaApi?.canScrollPrev() ?? slideCount > 1,
  );
  const canScrollNext = useSyncExternalStore(
    subscribe,
    () => emblaApi?.canScrollNext() ?? slideCount > 1,
  );

  const notifyIndexChange = useEffectEvent((api: EmblaApi) => {
    onIndexChange?.(api.selectedScrollSnap());
  });

  useEffect(() => {
    if (!emblaApi) return;

    const handleSelect = () => {
      notifyIndexChange(emblaApi);
    };

    emblaApi.on('select', handleSelect);

    return () => {
      emblaApi.off('select', handleSelect);
    };
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi || index === undefined) return;
    if (index === emblaApi.selectedScrollSnap()) return;

    emblaApi.scrollTo(index, isReducedMotion());
  }, [emblaApi, index]);

  const scrollPrev = () => {
    emblaApi?.scrollPrev(isReducedMotion());
  };

  const scrollNext = () => {
    emblaApi?.scrollNext(isReducedMotion());
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!emblaApi || event.defaultPrevented) return;
    if (
      event.target instanceof Node &&
      emblaApi.rootNode().contains(event.target)
    ) {
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      scrollPrev();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      scrollNext();
    }
  };

  const isArrowsVisible = hasArrows && slideCount > 1;

  return (
    <S.Root
      aria-roledescription="캐러셀"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
    >
      <S.Viewport ref={viewportRef}>
        <S.Container aria-live="polite">
          {slides.map((slide, slideIndex) => (
            <S.Slide
              key={getSlideKey(slide, slideIndex)}
              role="group"
              aria-roledescription="슬라이드"
              aria-label={`${slideIndex + 1} / ${slideCount}`}
              inert={slideIndex !== selectedIndex}
            >
              {slide}
            </S.Slide>
          ))}
        </S.Container>
      </S.Viewport>
      {isArrowsVisible && (
        <>
          <S.ArrowSlot $side="prev">
            <IconButton
              icon="chevron_left"
              aria-label="이전 슬라이드"
              variant={arrowVariant}
              isDisabled={!canScrollPrev}
              onClick={scrollPrev}
            />
          </S.ArrowSlot>
          <S.ArrowSlot $side="next">
            <IconButton
              icon="chevron_right"
              aria-label="다음 슬라이드"
              variant={arrowVariant}
              isDisabled={!canScrollNext}
              onClick={scrollNext}
            />
          </S.ArrowSlot>
        </>
      )}
    </S.Root>
  );
};

export default Carousel;
