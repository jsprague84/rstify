import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Coinbase-substitute typefaces (self-hosted, no CDN): Inter for UI, JetBrains Mono for numbers.
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
