import React, { memo } from 'react';
import { Globe, Check, RefreshCw, Trash2, Download } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { Badge } from '../ui/Badge';
import { Btn } from '../ui/Btn';
import { Spin } from '../ui/Spin';

export const ExtCard = memo(({ ext, onInstall, onUninstall, installing, onUpdate }) => {
  const isInstalling = installing.has(ext.pkgName);
  const isInstalled = ext.isInstalled;
  const hasUpdate = ext.hasUpdate;
  const toast = useToast();

  return (
    <div className="hover-lift" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', borderRadius: 16, background: 'var(--card)', border: `1.5px solid ${isInstalled ? 'rgba(34,197,94,0.2)' : 'var(--border)'}`, transition: 'all 0.3s', position: 'relative', overflow: 'hidden' }}>
      {isInstalled && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,rgba(34,197,94,0.03),transparent)', pointerEvents: 'none' }} />}
      <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--card2)', border: '1.5px solid var(--border)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
        {(ext.icon || ext.iconUrl) ? <img src={ext.icon || ext.iconUrl} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }} onError={e => e.target.style.display = 'none'} alt="" loading="lazy" /> : <Globe size={22} style={{ color: 'var(--muted)' }} />}
        {isInstalled && <div style={{ position: 'absolute', bottom: -1, right: -1, width: 16, height: 16, background: '#22c55e', borderRadius: '50%', border: '2px solid var(--card)', boxShadow: '0 0 8px #22c55e' }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: isInstalled ? 'var(--text)' : 'var(--text-dim)' }}>{ext.name}</span>
          {ext.isNsfw && <Badge variant="nsfw" size="sm">18+</Badge>}
          {hasUpdate && !isInstalling && <Badge variant="update" size="sm">Update</Badge>}
          {isInstalling && <Badge variant="installing" size="sm">Working...</Badge>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}><Globe size={11} />{ext.lang}</span>
          <span style={{ color: 'var(--border)' }}>•</span>
          <span style={{ fontSize: 12, color: 'var(--muted-fg)' }}>v{ext.versionName || ext.versionCode}</span>
          {isInstalled && <><span style={{ color: 'var(--border)' }}>•</span><span style={{ fontSize: 12, color: '#4ade80', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}><Check size={12} />Active</span></>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {hasUpdate && isInstalled && !isInstalling && <Btn variant="success" size="sm" onClick={() => { onUpdate?.(ext.pkgName); toast?.(`Updating ${ext.name}...`, 'info'); }}><RefreshCw size={13} /> Update</Btn>}
        <Btn variant={isInstalled ? 'outline' : 'default'} size="sm" disabled={isInstalling} onClick={() => {
          if (isInstalling) return;
          if (isInstalled) { onUninstall(ext.pkgName); toast?.(`Removing ${ext.name}...`, 'warning'); }
          else { onInstall(ext.pkgName); toast?.(`Installing ${ext.name}...`, 'info'); }
        }}>
          {isInstalling ? <><Spin size={14} /><span style={{ marginLeft: 6 }}>...</span></> : isInstalled ? <><Trash2 size={14} /> Remove</> : <><Download size={14} /> Install</>}
        </Btn>
      </div>
    </div>
  );
});
