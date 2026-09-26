import { css } from '@emotion/react';

export const globalStyles = css`
  *,
  *::before,
  *::after {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html {
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;
  }

  body {
    font-family:
      'Wanted Sans Variable',
      -apple-system,
      BlinkMacSystemFont,
      system-ui,
      sans-serif;
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
