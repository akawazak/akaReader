import React, { memo } from 'react';

export const Badge = memo(({ children, variant = 'default', size = 'md', onClick, style }) => {
  const styles = {
    default: { background: 'rgba(249,115,22,0.15)', color: 'var(--accent)', border: '1px solid rgba(249,115,22,0.25)' },
    success: { background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' },
    destructive: { background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' },
    outline: { background: 'transparent', color: 'var(--muted-fg)', border: '1px solid var(--border)' },
    update: { background: 'rgba(234,179,8,0.12)', color: '#facc15', border: '1px solid rgba(234,179,8,0.2)' },
    installing: { background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' },
    nsfw: { background: 'rgba(236,72,153,0.15)', color: '#f472b6', border: '1px solid rgba(236,72,153,0.25)' },
  };
  const sizes = { sm: { padding: '1px 6px', fontSize: 9, borderRadius: 4 }, md: { padding: '3px 10px', fontSize: 10, borderRadius: 6 }, lg: { padding: '4px 12px', fontSize: 11, borderRadius: 8 } };
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', ...(styles[variant] || styles.default), ...(sizes[size] || sizes.md), ...style }} onClick={onClick}>{children}</span>;
});
