import React, { createContext, useContext, useState, useRef, useCallback, memo } from 'react';

export const ToastContext = createContext(null);

export const ToastProvider = memo(({ children }) => {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);
  const show = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++idRef.current;
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), duration);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div style={{ position: 'fixed', top: 90, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360, pointerEvents: 'none' }}>
        {toasts.map(t => (
          <div key={t.id} className="toast-enter" style={{
            padding: '14px 18px', borderRadius: 14, border: '1px solid var(--border)',
            background: 'rgba(22,22,31,0.98)', backdropFilter: 'blur(20px)',
            display: 'flex', alignItems: 'center', gap: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)', pointerEvents: 'auto'
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.type === 'success' ? '#4ade80' : t.type === 'error' ? '#f87171' : t.type === 'warning' ? '#facc15' : '#60a5fa', boxShadow: `0 0 10px ${t.type === 'success' ? '#4ade80' : t.type === 'error' ? '#f87171' : t.type === 'warning' ? '#facc15' : '#60a5fa'}` }} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
});

export const useToast = () => useContext(ToastContext);
