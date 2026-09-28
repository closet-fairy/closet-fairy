import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('#root 요소를 찾을 수 없습니다.');
}

createRoot(rootElement).render(
  <StrictMode>
    <h1>옷장요정</h1>
  </StrictMode>,
);
