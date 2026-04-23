import React, { memo, useEffect } from 'react';

export const ContextMenu = memo(({ x, y, items, onClose }) => {
  useEffect(() => {
    const h = () => onClose();
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [onClose]);

  return (
    <div className="anim-fadeIn" style={{ position: 'fixed', left: x, top: y, background: 'rgba(22,22,31,0.98)', backdropFilter: 'blur(20px)', border: '1px solid var(--border)', borderRadius: 12, padding: 6, minWidth: 180, zIndex: 10000, boxShadow: '0 16px 48px rgba(0,0,0,0.4)' }}>
      {items.map((item, i) => (
        <button key={i} onClick={() => { item.action(); onClose(); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, border: 'none', background: 'transparent', color: item.danger ? '#f87171' : 'var(--text)', fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.background = item.danger ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.06)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          {item.icon && <item.icon size={16} style={{ color: item.danger ? '#f87171' : 'var(--muted)' }} />}
          {item.label}
        </button>
      ))}
    </div>
  );
});
