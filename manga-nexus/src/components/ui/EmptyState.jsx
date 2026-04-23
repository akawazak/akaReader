import React, { memo } from 'react';

export const EmptyState = memo(({ icon: Icon, title, sub, action, compact }) => (
  <div className="anim-fadeIn" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: compact ? '40px 24px' : '80px 24px', gap: compact ? 12 : 20 }}>
    <div style={{ width: compact ? 56 : 88, height: compact ? 56 : 88, borderRadius: compact ? 16 : 24, background: 'linear-gradient(135deg,var(--card),var(--card2))', border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
      {Icon && <Icon size={compact ? 24 : 36} style={{ opacity: 0.6 }} />}
    </div>
    <div>
      <p style={{ fontFamily: "'Segoe UI Variable Display','Segoe UI Variable','Segoe UI',system-ui,-apple-system,sans-serif", fontWeight: 700, fontSize: compact ? 15 : 20, color: 'var(--text)', marginBottom: compact ? 4 : 8 }}>{title}</p>
      {sub && <p style={{ color: 'var(--muted)', fontSize: compact ? 12 : 14, maxWidth: 360, lineHeight: 1.7 }}>{sub}</p>}
    </div>
    {action && <div style={{ marginTop: compact ? 8 : 12 }}>{action}</div>}
  </div>
));
