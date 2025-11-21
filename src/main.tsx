import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Em desenvolvimento, desabilita o hook do React DevTools para evitar
// mensagens de porta desconectada disparadas pela extensão do navegador.
if (import.meta.env.DEV) {
  try {
    const w = window as any;
    w.__REACT_DEVTOOLS_GLOBAL_HOOK__ = w.__REACT_DEVTOOLS_GLOBAL_HOOK__ || {};
    w.__REACT_DEVTOOLS_GLOBAL_HOOK__.isDisabled = true;
  } catch (e) {
    // falha silenciosa — não bloquear render
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
