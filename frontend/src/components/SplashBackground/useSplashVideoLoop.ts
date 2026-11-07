import { useEffect, useRef } from 'react';

const BLOCKING_ERROR_NAMES = ['NotAllowedError', 'NotSupportedError'];

const isBlockingPlayError = (error: unknown) =>
  error instanceof DOMException && BLOCKING_ERROR_NAMES.includes(error.name);

const useSplashVideoLoop = (sources: readonly string[], isEnabled: boolean) => {
  const firstRef = useRef<HTMLVideoElement>(null);
  const secondRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const first = firstRef.current;
    const second = secondRef.current;

    if (
      !isEnabled ||
      first === null ||
      second === null ||
      sources.length === 0
    ) {
      return;
    }

    const videos = [first, second];
    const controller = new AbortController();
    const { signal } = controller;
    let activeSlot = 0;
    let activeClip = 0;
    let isNextPrepared = false;

    const getClipAfter = (clip: number) => (clip + 1) % sources.length;

    const prepare = (slot: number, clip: number) => {
      videos[slot].src = sources[clip];
      videos[slot].load();
    };

    const release = () => {
      controller.abort();

      for (const video of videos) {
        video.pause();
        video.removeAttribute('src');
        video.load();
        delete video.dataset.state;
      }
    };

    const play = (slot: number) => {
      videos[slot].play().catch((error: unknown) => {
        if (!signal.aborted && isBlockingPlayError(error)) {
          release();
        }
      });
    };

    const prepareOtherAfterPaint = (slot: number) => {
      const prepareOther = () => {
        if (signal.aborted || slot !== activeSlot) return;

        prepare(1 - slot, getClipAfter(activeClip));
      };
      const front = videos[slot];

      if (typeof front.requestVideoFrameCallback === 'function') {
        front.requestVideoFrameCallback(prepareOther);
      } else {
        prepareOther();
      }
    };

    const handlePlaying = (slot: number) => {
      if (slot !== activeSlot) return;

      const otherSlot = 1 - slot;

      videos[slot].dataset.state = 'front';

      if (videos[otherSlot].dataset.state === 'front') {
        videos[otherSlot].dataset.state = 'back';
      }

      if (!isNextPrepared) {
        isNextPrepared = true;
        prepareOtherAfterPaint(slot);
      }
    };

    const handleEnded = (slot: number) => {
      if (slot !== activeSlot) return;

      activeSlot = 1 - slot;
      activeClip = getClipAfter(activeClip);
      isNextPrepared = false;
      play(activeSlot);
    };

    const handleError = (slot: number) => {
      if (slot === activeSlot) {
        release();
      }
    };

    const handleVisibilityChange = () => {
      const video = videos[activeSlot];

      if (document.visibilityState === 'visible' && video.paused) {
        video.play().catch(() => {});
      }
    };

    videos.forEach((video, slot) => {
      video.muted = true;
      video.defaultMuted = true;
      video.addEventListener('playing', () => handlePlaying(slot), { signal });
      video.addEventListener('ended', () => handleEnded(slot), { signal });
      video.addEventListener('error', () => handleError(slot), { signal });
    });
    document.addEventListener('visibilitychange', handleVisibilityChange, {
      signal,
    });

    prepare(0, 0);
    play(0);

    return release;
  }, [sources, isEnabled]);

  return { firstRef, secondRef };
};

export default useSplashVideoLoop;
