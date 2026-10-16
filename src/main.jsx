if (typeof history !== 'undefined' && 'scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}
if (typeof window !== 'undefined') {
  window.scrollTo(0, 0);
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

async function waitForFonts() {
  if (typeof document === 'undefined' || !document.fonts) return;

  const fontPromise = Promise.all([
    document.fonts.load('800 1em Syne'),
    document.fonts.ready
  ]);

  const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 2000));

  try {
    await Promise.race([fontPromise, timeoutPromise]);
  } catch (err) {
    console.warn('Font loading fallback triggered:', err);
  }
}

waitForFonts().finally(() => {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  }
});
