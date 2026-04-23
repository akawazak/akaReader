import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import { Search, Puzzle, RefreshCw } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { Btn } from '../ui/Btn';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { Spin } from '../ui/Spin';

const ExtCard = memo(({ ext, onInstall, onUninstall, onUpdate, installing }) => {
  const isInstalling = installing.has(ext.pkgName);
  return (
    <div className="glass" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.06)', transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ width: 52, height: 52, background: 'rgba(255,255,255,0.03)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid rgba(255,255,255,0.05)' }}>
        {ext.iconUrl ? <img src={ext.iconUrl} style={{ width: 32, height: 32, objectFit: 'contain' }} alt="" loading="lazy" /> : <Puzzle size={24} style={{ color: 'var(--muted)' }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <p style={{ fontWeight: 800, fontSize: 15, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ext.name}</p>
          <Badge variant="outline" size="sm">{ext.lang}</Badge>
          {ext.isNsfw && <Badge variant="nsfw" size="sm">NSFW</Badge>}
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>v{ext.versionName} • {ext.pkgName.split('.').pop()}</p>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {ext.isInstalled ? (
          <>
            {ext.hasUpdate && <Btn variant="default" size="sm" onClick={() => onUpdate(ext.pkgName)} disabled={isInstalling}>{isInstalling ? <Spin size={14} /> : 'Update'}</Btn>}
            <Btn variant="danger" size="sm" onClick={() => onUninstall(ext.pkgName)} disabled={isInstalling}>Uninstall</Btn>
          </>
        ) : (
          <Btn variant="secondary" size="sm" onClick={() => onInstall(ext.pkgName)} disabled={isInstalling}>{isInstalling ? <><Spin size={14} /> Installing</> : 'Install'}</Btn>
        )}
      </div>
    </div>
  );
});

export const ExtensionsTab = memo(() => {
  const { extensions, fetchExtensions, fetchSources, installExt, uninstallExt, updateExt, installing } = useData();
  const [extSearch, setExtSearch] = useState('');
  const [extLang, setExtLang] = useState('all');
  const [extTab, setExtTab] = useState('all');
  const [extSort, setExtSort] = useState('name');
  const [showNsfw, setShowNsfw] = useState(false);
  const [extDisplayCount, setExtDisplayCount] = useState(30);

  const filteredExts = useMemo(() => {
    return extensions
      .filter(e => {
        const matchesSearch = e.name.toLowerCase().includes(extSearch.toLowerCase()) || e.pkgName.toLowerCase().includes(extSearch.toLowerCase());
        const matchesLang = extLang === 'all' || e.lang === extLang;
        const matchesTab = extTab === 'all' || (extTab === 'installed' && e.isInstalled);
        const matchesNsfw = showNsfw || !e.isNsfw;
        return matchesSearch && matchesLang && matchesTab && matchesNsfw;
      })
      .sort((a, b) => {
        if (extSort === 'installed') return (b.isInstalled ? 1 : 0) - (a.isInstalled ? 1 : 0);
        if (extSort === 'version') return b.versionCode - a.versionCode;
        return a.name.localeCompare(b.name);
      });
  }, [extensions, extSearch, extLang, extTab, extSort, showNsfw]);

  const extSentinelRef = useRef(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setExtDisplayCount(c => c + 30); }, { rootMargin: '200px' });
    if (extSentinelRef.current) obs.observe(extSentinelRef.current);
    return () => obs.disconnect();
  }, []);

  const LANGUAGES = [
    { value: 'all', label: 'All Languages' },
    { value: 'en', label: 'English' },
    { value: 'zh', label: 'Chinese' },
    { value: 'ko', label: 'Korean' },
    { value: 'ja', label: 'Japanese' },
    { value: 'fr', label: 'French' },
    { value: 'es', label: 'Spanish' },
    { value: 'pt-br', label: 'Portuguese' },
    { value: 'id', label: 'Indonesian' },
    { value: 'vi', label: 'Vietnamese' },
    { value: 'tr', label: 'Turkish' },
    { value: 'ru', label: 'Russian' },
  ];

  return (
    <div className="page-transition">
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
          <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
          <input 
            placeholder="Search extensions..." 
            value={extSearch} 
            onChange={e => setExtSearch(e.target.value)} 
            style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 14px 12px 42px', color: '#fff', fontSize: 14, outline: 'none' }} 
          />
        </div>
        <select value={extLang} onChange={e => setExtLang(e.target.value)} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '0 16px', color: '#fff', fontSize: 13, outline: 'none', cursor: 'pointer', height: 45 }}>
          {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '0 16px', height: 45 }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>NSFW</span>
          <button onClick={() => setShowNsfw(prev => !prev)} style={{ width: 38, height: 20, borderRadius: 10, background: showNsfw ? 'var(--accent)' : 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
            <div style={{ position: 'absolute', top: 2, left: showNsfw ? 20 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
          </button>
        </div>
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', padding: 2, height: 45 }}>
          {[['all', 'All'], ['installed', 'Installed']].map(([v, l]) => (
            <button key={v} onClick={() => setExtTab(v)} style={{ padding: '0 18px', border: 'none', background: extTab === v ? 'var(--accent)' : 'transparent', color: extTab === v ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s', borderRadius: 12 }}>{l}</button>
          ))}
        </div>
        <Btn variant="outline" onClick={() => { fetchExtensions(); fetchSources(); }} style={{ height: 45 }}><RefreshCw size={15} /> Refresh</Btn>
      </div>

      {filteredExts.length === 0 ? (
        <EmptyState icon={Puzzle} title="No extensions found" sub="Try adjusting your filters" />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {filteredExts.slice(0, extDisplayCount).map((ext, i) => (
              <ExtCard key={ext.pkgName} ext={ext} onInstall={installExt} onUninstall={uninstallExt} onUpdate={updateExt} installing={installing} />
            ))}
          </div>
          {extDisplayCount < filteredExts.length && <div ref={extSentinelRef} style={{ height: 20, margin: '20px 0' }} />}
        </>
      )}
    </div>
  );
});
