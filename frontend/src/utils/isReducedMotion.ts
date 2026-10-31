const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const isReducedMotion = () => window.matchMedia(REDUCED_MOTION_QUERY).matches;

export default isReducedMotion;
