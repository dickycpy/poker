import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// We need to wrap App with ErrorBoundary here if we want to catch top-level errors
// But since we defined ErrorBoundary inside App.tsx, let's just make sure App exports a wrapped version or handles it.
// Actually, it's better to have a separate ErrorBoundary file, but for now I'll just wrap the content inside App.tsx.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
