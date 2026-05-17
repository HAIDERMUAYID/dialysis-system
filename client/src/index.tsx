import React from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import './index.css';
import './styles/theme.css';
import App from './App';

// النظام يعمل بالوضع الفاتح فقط — إزالة أي بقايا من الوضع الداكن
document.documentElement.classList.remove('dark-mode', 'light-mode');
document.documentElement.setAttribute('data-theme', 'light');
try {
  localStorage.removeItem('theme');
} catch {
  /* ignore */
}

const standalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

document.documentElement.classList.add('mobile-app-shell');
if (standalone) document.documentElement.classList.add('is-standalone');

// Configure axios base URL
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
axios.defaults.baseURL = API_URL;
axios.defaults.headers.common['Content-Type'] = 'application/json';

console.log('API Base URL:', API_URL);

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('Service Worker registered:', registration);
      })
      .catch((error) => {
        console.log('Service Worker registration failed:', error);
      });
  });
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

const hideSplash = () => {
  const splash = document.getElementById('app-splash');
  if (!splash) return;
  splash.classList.add('app-splash--hide');
  window.setTimeout(() => splash.remove(), 260);
};

requestAnimationFrame(() => requestAnimationFrame(hideSplash));
window.addEventListener('load', hideSplash, { once: true });
