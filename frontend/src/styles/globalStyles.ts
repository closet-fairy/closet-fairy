import { css } from '@emotion/react';
import {
  appFrame,
  bg,
  border,
  colorVariables,
  fg,
  topBarHeight,
} from '@/styles/tokens';

export const globalStyles = css`
  *,
  *::before,
  *::after {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  :root {
    ${colorVariables}
  }

  html {
    scroll-padding-top: calc(${topBarHeight}px + env(safe-area-inset-top, 0px));
    scrollbar-gutter: stable;
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;
  }

  /* 비워 둔 스크롤바 자리는 캔버스 색으로 칠해지므로, 앱 양옆 바탕과 색을 맞춘다. */
  @media (min-width: ${appFrame.maxWidth}) {
    html {
      background-color: ${bg.outside};
    }
  }

  body {
    font-family:
      'Asta Sans Variable',
      -apple-system,
      BlinkMacSystemFont,
      system-ui,
      'Apple SD Gothic Neo',
      'Noto Sans KR',
      'Malgun Gothic',
      sans-serif;
    color: ${fg.neutral.strong};
    background-color: ${bg.white};
    word-break: keep-all;
    overflow-wrap: break-word;
    -webkit-tap-highlight-color: transparent;
  }

  #root {
    min-height: 100dvh;
  }

  img,
  picture,
  svg,
  video {
    display: block;
    max-width: 100%;
  }

  img,
  video {
    height: auto;
  }

  input,
  select,
  textarea,
  button {
    font: inherit;
    color: inherit;
  }

  a {
    color: inherit;
    text-decoration: none;
  }

  button {
    border: 0;
    background: none;
    cursor: pointer;
  }

  button:disabled {
    cursor: not-allowed;
  }

  ul,
  ol {
    list-style: none;
  }

  fieldset {
    border: 0;
    min-width: 0;
  }

  input::-webkit-outer-spin-button,
  input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  input[type='number'] {
    -moz-appearance: textfield;
    appearance: textfield;
  }

  :focus-visible {
    outline: 2px solid ${border.neutral.strong};
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.001s !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001s !important;
    }
  }
`;
