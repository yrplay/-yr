import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  let isReloadingForSwUpdate = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (isReloadingForSwUpdate) return;
    isReloadingForSwUpdate = true;
    window.location.reload();
  });

  const registerAndMonitorSw = () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then(registration => {
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });

        const checkForAppUpdate = () => {
          registration.update().catch(() => {});
        };

        checkForAppUpdate();
        window.addEventListener('focus', checkForAppUpdate);
        window.addEventListener('online', checkForAppUpdate);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            checkForAppUpdate();
          }
        });
        setInterval(checkForAppUpdate, 60000);
      })
      .catch(() => {
        // Service worker registration fallback if restricted in preview iframe
      });
  };

  if (document.readyState === 'complete') {
    registerAndMonitorSw();
  } else {
    window.addEventListener('load', registerAndMonitorSw, { once: true });
  }
}

createRoot(document.getElementById('root')!).render(<App />);

