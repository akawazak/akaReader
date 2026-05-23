import React, { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Download, Globe, Puzzle, RefreshCw, Search, Trash2 } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Btn } from '../ui/Btn';
import { EmptyState } from '../ui/EmptyState';
import { Spin } from '../ui/Spin';

const INITIAL_DISPLAY_COUNT = 40;
const DISPLAY_INCREMENT = 40;

const ExtCard = memo(({ ext, onInstall, onUninstall, installing, onUpdate }) => {
  const isInstalling = installing.has(ext.pkgName);
  const isInstalled = ext.isInstalled;
  const hasUpdate = ext.hasUpdate;
  const icon = ext.icon || ext.iconUrl;

  return (
    <div
      className="hover-lift"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '16px 20px',
        borderRadius: 16,
        background: 'var(--card)',
        border: `1.5px solid ${isInstalled ? 'rgba(34,197,94,0.2)' : 'var(--border)'}`,
        transition: 'all 0.3s',
        position: 'relative',
        overflow: 'hidden',
        contentVisibility: 'auto',
        containIntrinsicSize: '86px',
      }}
    >
      {isInstalled && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,rgba(34,197,94,0.03),transparent)', pointerEvents: 'none' }} />}
      <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--card2)', border: '1.5px solid var(--border)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
        {icon ? <img src={icon} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }} onError={e => { e.currentTarget.style.display = 'none'; }} alt="" loading="lazy" decoding="async" /> : <Globe size={22} style={{ color: 'var(--muted)' }} />}
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
          <span style={{ color: 'var(--border)' }}>-</span>
          <span style={{ fontSize: 12, color: 'var(--muted-fg)' }}>v{ext.versionName || ext.versionCode}</span>
          {isInstalled && <><span style={{ color: 'var(--border)' }}>-</span><span style={{ fontSize: 12, color: '#4ade80', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}><Check size={12} />Active</span></>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        {hasUpdate && isInstalled && !isInstalling && <Btn variant="success" size="sm" onClick={() => onUpdate?.(ext.pkgName)}><RefreshCw size={13} /> Update</Btn>}
        <Btn
          variant={isInstalled ? 'outline' : 'default'}
          size="sm"
          disabled={isInstalling}
          onClick={() => {
            if (isInstalling) return;
            if (isInstalled) onUninstall(ext.pkgName);
            else onInstall(ext.pkgName);
          }}
        >
          {isInstalling ? <><Spin size={14} /><span style={{ marginLeft: 6 }}>...</span></> : isInstalled ? <><Trash2 size={14} /> Remove</> : <><Download size={14} /> Install</>}
        </Btn>
      </div>
    </div>
  );
});

export const ExtensionsTab = memo(({
  extensions,
  installing,
  languages,
  onInstall,
  onUninstall,
  onUpdate,
  onRefresh,
}) => {
  const [search, setSearch] = useState('');
  const [lang, setLang] = useState('en');
  const [tab, setTab] = useState('all');
  const [showNsfw, setShowNsfw] = useState(true);
  const [sort, setSort] = useState('name');
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT);
  const sentinelRef = useRef(null);
  const deferredSearch = useDeferredValue(search);

  const filteredExts = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const filtered = extensions.filter(e => {
      if (tab === 'installed' && !e.isInstalled) return false;
      const matchLang = lang === 'all' || (e.lang || '').toLowerCase() === lang;
      const matchName = !q || (e.name || '').toLowerCase().includes(q);
      const matchNsfw = showNsfw || !e.isNsfw;
      return matchLang && matchName && matchNsfw;
    });

    const sorted = [...filtered];
    switch (sort) {
      case 'version':
        sorted.sort((a, b) => (b.versionCode || 0) - (a.versionCode || 0));
        break;
      case 'installed':
        sorted.sort((a, b) => (b.isInstalled ? 1 : 0) - (a.isInstalled ? 1 : 0) || (a.name || '').localeCompare(b.name || ''));
        break;
      default:
        sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
    }
    return sorted;
  }, [extensions, deferredSearch, lang, showNsfw, sort, tab]);

  useEffect(() => {
    setDisplayCount(INITIAL_DISPLAY_COUNT);
  }, [filteredExts]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || displayCount >= filteredExts.length) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setDisplayCount(prev => Math.min(prev + DISPLAY_INCREMENT, filteredExts.length));
      }
    }, { rootMargin: '600px 0px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [displayCount, filteredExts.length]);

  return (
    <div className="page-transition">
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
          <input placeholder="Search extensions by name..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '11px 14px 11px 40px', color: 'var(--text)', fontSize: 13, outline: 'none' }} onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }} onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }} />
        </div>
        <select value={lang} onChange={e => setLang(e.target.value)} style={{ background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '11px 14px', color: 'var(--text)', fontSize: 13, outline: 'none', cursor: 'pointer', minWidth: 130 }}>
          {languages.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '0 12px' }}>
          <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>NSFW</span>
          <button onClick={() => setShowNsfw(prev => !prev)} style={{ width: 40, height: 22, borderRadius: 11, background: showNsfw ? 'var(--accent)' : 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
            <div style={{ position: 'absolute', top: 2, left: showNsfw ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
          </button>
        </div>
        <div style={{ display: 'flex', background: 'var(--card)', borderRadius: 12, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
          {[['all', 'All'], ['installed', 'Installed']].map(([value, label]) => (
            <button key={value} onClick={() => setTab(value)} style={{ padding: '11px 18px', border: 'none', background: tab === value ? 'var(--accent)' : 'transparent', color: tab === value ? '#fff' : 'var(--muted)', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s' }}>{label}</button>
          ))}
        </div>
        <select value={sort} onChange={e => setSort(e.target.value)} style={{ background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '11px 14px', color: 'var(--text)', fontSize: 13, outline: 'none', cursor: 'pointer', minWidth: 140 }}>
          <option value="name">Sort by Name</option>
          <option value="version">Sort by Version</option>
          <option value="installed">Installed First</option>
        </select>
        <Btn variant="outline" onClick={onRefresh}>
          <RefreshCw size={15} /> Refresh
        </Btn>
      </div>

      {filteredExts.length === 0 ? (
        <EmptyState icon={Puzzle} title="No extensions found" sub="Try adjusting your filters" />
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredExts.slice(0, displayCount).map((ext, index) => (
              <div key={ext.pkgName} className={`anim-fadeInUp delay-${Math.min(index, 10)}`}>
                <ExtCard ext={ext} onInstall={onInstall} onUninstall={onUninstall} onUpdate={onUpdate} installing={installing} />
              </div>
            ))}
          </div>
          {displayCount < filteredExts.length && <div ref={sentinelRef} style={{ height: 20, margin: '20px 0' }} />}
        </>
      )}
    </div>
  );
});
