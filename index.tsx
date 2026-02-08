import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Register service worker for PWA functionality
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(error => {
    console.log('Service Worker registration failed:', error);
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
