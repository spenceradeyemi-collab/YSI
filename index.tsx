import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}
const mountNode: HTMLElement = rootElement;

// Hard-set app height for mobile browser chrome
function setAppHeight() {
  const h = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty('--app-height', `${h}px`);
  document.documentElement.style.height = `${h}px`;
  document.body.style.height = `${h}px`;
  mountNode.style.height = `${h}px`;
  mountNode.style.minHeight = `${h}px`;
}
setAppHeight();
window.addEventListener('resize', setAppHeight);
window.visualViewport?.addEventListener('resize', setAppHeight);

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('YSI render error', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100dvh',
            background: '#000',
            color: '#fcf6ba',
            padding: 24,
            fontFamily: 'system-ui, sans-serif',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 12,
          }}
        >
          <h1 style={{ fontSize: 16, margin: 0 }}>Portal failed to load</h1>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              fontSize: 11,
              opacity: 0.8,
              background: '#111',
              padding: 12,
              borderRadius: 4,
            }}
          >
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.clear();
                sessionStorage.clear();
              } catch {
                /* ignore */
              }
              window.location.reload();
            }}
            style={{
              padding: '12px 16px',
              background: 'linear-gradient(to right, #bf953f, #fcf6ba, #aa771c)',
              border: 'none',
              color: '#030712',
              fontWeight: 800,
              textTransform: 'uppercase',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            Clear session & reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = ReactDOM.createRoot(mountNode);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// Register SW only in production builds (never in Vite dev — breaks HMR WebSocket)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.log('SW registration failed:', err);
    });
  });
} else if ('serviceWorker' in navigator) {
  // Dev: actively unregister stale SWs that cache broken shells
  navigator.serviceWorker.getRegistrations?.().then((regs) => {
    regs.forEach((r) => r.unregister());
  });
  caches?.keys?.().then((keys) => keys.forEach((k) => caches.delete(k)));
}
