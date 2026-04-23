import React, { memo } from 'react';

export const Btn = memo(({ children, variant = 'default', size = 'md', onClick, disabled, className = '', style = {}, icon: Icon, type = 'button', title }) => {
  const base = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'system-ui,-apple-system,Segoe UI,sans-serif', fontWeight: 600, borderRadius: 12, whiteSpace: 'nowrap', opacity: disabled ? 0.4 : 1, position: 'relative', overflow: 'hidden', transition: 'all var(--t-fast) var(--ease-out)' };
  const sizes = { sm: { padding: '7px 14px', fontSize: 12, height: 32 }, md: { padding: '10px 20px', fontSize: 13, height: 40 }, lg: { padding: '14px 28px', fontSize: 14, height: 48 }, icon: { padding: 10, borderRadius: 12, width: 40, height: 40 } };
  const variants = {
    default: { background: 'linear-gradient(135deg,var(--accent) 0%,var(--accent2) 100%)', color: '#fff', boxShadow: '0 4px 16px rgba(249,115,22,0.3)' },
    outline: { background: 'transparent', color: 'var(--text-dim)', border: '1.5px solid var(--border)' },
    ghost: { background: 'transparent', color: 'var(--text-dim)' },
    secondary: { background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)' },
    danger: { background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1.5px solid rgba(239,68,68,0.2)' },
    success: { background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1.5px solid rgba(34,197,94,0.2)' },
  };
  return (
    <button type={type} title={title} style={{ ...base, ...(sizes[size] || sizes.md), ...(variants[variant] || variants.default), ...style }} disabled={disabled} onClick={onClick} className={className}
      onMouseEnter={e => { if (!disabled && variant === 'default') { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(249,115,22,0.4)'; } else if (!disabled) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; } }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = variant === 'default' ? '0 4px 16px rgba(249,115,22,0.3)' : ''; e.currentTarget.style.background = variants[variant]?.background || 'transparent'; }}
    >
      {Icon && <Icon size={size === 'sm' ? 14 : size === 'icon' ? 18 : 16} />}
      {children}
    </button>
  );
});
