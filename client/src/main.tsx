import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Register service worker for production
async function registerServiceWorker() {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/',
      });

      if (registration.installing) {
        console.log('Service worker installing');
      } else if (registration.waiting) {
        console.log('Service worker installed');
      } else if (registration.active) {
        console.log('Service worker active');
      }
    } catch (error) {
      console.error('Service worker registration failed:', error);
    }
  }
}

// Register SW when the app loads
window.addEventListener('load', registerServiceWorker);

createRoot(document.getElementById('root')!).render(<App />);
