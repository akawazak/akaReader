import { memo, useEffect, useMemo, useState } from 'react';
import { BookOpen, Check, HardDrive, Trash2 } from 'lucide-react';
import { formatByteSize } from '../../utils/downloadQueue.mjs';
import { summarizeDownloadedChapters } from '../../utils/downloadStorage.mjs';

const actionButtonStyle = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  minHeight: 32, padding: '7px 11px', borderRadius: 9, cursor: 'pointer',
  border: '1px solid var(--border)', background: 'var(--card2)', color: 'var(--text-dim)',
  font: '600 11px system-ui,-apple-system,Segoe UI,sans-serif',
};

const Stat = ({ label, value }) => (
  <div style={{ minWidth: 110, padding: '12px 14px', borderRadius: 12, background: 'var(--card2)', border: '1px solid var(--border)' }}>
    <strong style={{ display: 'block', fontSize: 17, color: 'var(--text)' }}>{value}</strong>
    <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</span>
  </div>
);

export const StorageManager = memo(({ records, library, readChapters, onDeleteKeys, getMangaKey = (id, sourceId) => `${sourceId}__${id}`, resolveCover = value => value }) => {
  const [working, setWorking] = useState('');
  const [quota, setQuota] = useState(null);
  const libraryWithKeys = useMemo(() => library.map(manga => ({
    ...manga,
    mangaKey: getMangaKey(manga.id, manga.sourceId),
  })), [library, getMangaKey]);
  const summary = useMemo(() => summarizeDownloadedChapters({ records, library: libraryWithKeys, readChapters }), [records, libraryWithKeys, readChapters]);

  useEffect(() => {
    let cancelled = false;
    navigator.storage?.estimate?.().then(value => {
      if (!cancelled) setQuota(value);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [records]);

  const remove = async (keys, action, prompt) => {
    if (!keys.length || !window.confirm(prompt)) return;
    setWorking(action);
    try { await onDeleteKeys(keys); }
    finally { setWorking(''); }
  };

  const quotaPercent = quota?.quota > 0 ? Math.min(100, Math.round((quota.usage || 0) / quota.quota * 100)) : 0;

  return (
    <section aria-labelledby="storage-manager-title" style={{ padding: 18, marginBottom: 24, borderRadius: 16, background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, display: 'grid', placeItems: 'center', color: '#60a5fa', background: 'rgba(59,130,246,.12)' }}><HardDrive size={19} /></div>
          <div>
            <h2 id="storage-manager-title" style={{ margin: 0, fontSize: 16 }}>Offline storage</h2>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--muted)' }}>Inspect downloaded chapters and reclaim space safely.</p>
          </div>
        </div>
        {summary.chapterCount > 0 && (
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <button type="button" disabled={!summary.readCount || !!working} onClick={() => remove(summary.readKeys, 'read', `Delete ${summary.readCount} downloaded read chapter${summary.readCount === 1 ? '' : 's'}?`)} style={{ ...actionButtonStyle, opacity: !summary.readCount || working ? .45 : 1 }}>
              <Check size={13} /> {working === 'read' ? 'Deleting…' : `Delete read (${summary.readCount})`}
            </button>
            <button type="button" disabled={!!working} onClick={() => remove(records.map(record => record.key), 'all', `Delete all ${summary.chapterCount} offline chapter${summary.chapterCount === 1 ? '' : 's'}? This cannot be undone.`)} style={{ ...actionButtonStyle, borderColor: 'rgba(239,68,68,.3)', color: '#f87171', opacity: working ? .45 : 1 }}>
              <Trash2 size={13} /> {working === 'all' ? 'Deleting…' : 'Delete all'}
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
        <Stat label="Stored" value={formatByteSize(summary.sizeBytes)} />
        <Stat label="Manga" value={summary.mangaCount} />
        <Stat label="Chapters" value={summary.chapterCount} />
        <Stat label="Pages" value={summary.pageCount} />
      </div>

      {quota?.quota > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 10, color: 'var(--muted)', marginBottom: 6 }}>
            <span>akaReader browser storage</span>
            <span>{formatByteSize(quota.usage || 0)} of {formatByteSize(quota.quota)} · {quotaPercent}%</span>
          </div>
          <div style={{ height: 5, borderRadius: 4, overflow: 'hidden', background: 'var(--card2)' }}>
            <div style={{ width: `${quotaPercent}%`, height: '100%', background: quotaPercent >= 85 ? '#f87171' : 'linear-gradient(90deg,#3b82f6,#60a5fa)', transition: 'width .25s ease' }} />
          </div>
        </div>
      )}

      {summary.groups.length === 0 ? (
        <div style={{ marginTop: 16, padding: '18px 12px', textAlign: 'center', borderRadius: 12, border: '1px dashed var(--border)', color: 'var(--muted)', fontSize: 12 }}>
          Downloaded chapters will appear here with their exact storage usage.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 16 }}>
          {summary.groups.map(group => (
            <article key={group.mangaKey} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px', borderRadius: 12, background: 'var(--card2)', border: '1px solid var(--border)' }}>
              <div style={{ width: 34, height: 44, borderRadius: 7, overflow: 'hidden', flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--bg2)' }}>
                {group.cover ? <img src={resolveCover(group.cover)} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <BookOpen size={15} style={{ color: 'var(--muted)' }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ display: 'block', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.mangaTitle}</strong>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>{group.records.length} chapter{group.records.length === 1 ? '' : 's'} · {group.pageCount} pages · {formatByteSize(group.sizeBytes)}{group.readCount ? ` · ${group.readCount} read` : ''}</span>
              </div>
              <button type="button" disabled={!!working} aria-label={`Delete offline chapters for ${group.mangaTitle}`} title="Delete this manga's offline chapters" onClick={() => remove(group.records.map(record => record.key), group.mangaKey, `Delete ${group.records.length} offline chapter${group.records.length === 1 ? '' : 's'} for “${group.mangaTitle}”?`)} style={{ ...actionButtonStyle, width: 32, padding: 0, color: '#f87171', opacity: working ? .45 : 1 }}>
                <Trash2 size={13} />
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
});
