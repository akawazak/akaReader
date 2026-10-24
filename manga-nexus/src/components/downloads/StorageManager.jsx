import { memo, useEffect, useMemo, useState } from 'react';
import { BookOpen, Check, HardDrive, Trash2 } from 'lucide-react';
import { formatByteSize } from '../../utils/downloadQueue.mjs';
import { summarizeDownloadedChapters } from '../../utils/downloadStorage.mjs';

const actionButtonStyle = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  minHeight: 34, padding: '7px 12px', borderRadius: 9, cursor: 'pointer',
  border: '1px solid var(--border)', background: 'var(--card2)', color: 'var(--text-dim)',
  font: 'inherit', fontSize: 13, fontWeight: 600,
};

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
    <section aria-labelledby="storage-manager-title" style={{ padding: 20, borderRadius: 16, background: 'var(--card)', border: '1px solid var(--border-mid)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, display: 'grid', placeItems: 'center', color: '#60a5fa', background: 'rgba(59,130,246,.12)' }}><HardDrive size={19} /></div>
          <div>
            <h2 id="storage-manager-title" style={{ margin: 0, fontSize: 18 }}>Offline storage</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>Chapters saved on this computer.</p>
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

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
        <strong style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{formatByteSize(summary.sizeBytes)}</strong>
        <span style={{ fontSize: 14, color: 'var(--muted)' }}>{summary.mangaCount} titles · {summary.chapterCount} chapters · {summary.pageCount.toLocaleString()} pages</span>
      </div>

      {quota?.quota > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5, color: 'var(--muted)', marginBottom: 6 }}>
            <span>Space this app may use</span>
            <span>{formatByteSize(quota.usage || 0)} of {formatByteSize(quota.quota)} · {quotaPercent}%</span>
          </div>
          <div style={{ height: 7, borderRadius: 4, overflow: 'hidden', background: 'var(--card2)' }}>
            <div style={{ width: `${quotaPercent}%`, height: '100%', background: quotaPercent >= 85 ? '#f87171' : 'linear-gradient(90deg,#3b82f6,#60a5fa)', transition: 'width .25s ease' }} />
          </div>
        </div>
      )}

      {summary.groups.length === 0 ? (
        <div style={{ marginTop: 16, padding: '18px 12px', textAlign: 'center', borderRadius: 12, border: '1px dashed var(--border-mid)', color: 'var(--muted)', fontSize: 14 }}>
          Nothing saved yet. Downloaded chapters show up here with their size.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 16 }}>
          {summary.groups.map(group => (
            <article key={group.mangaKey} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px', borderRadius: 12, background: 'var(--card2)', border: '1px solid var(--border)' }}>
              <div style={{ width: 42, height: 58, borderRadius: 7, overflow: 'hidden', flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--bg2)' }}>
                {group.cover ? <img src={resolveCover(group.cover)} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <BookOpen size={15} style={{ color: 'var(--muted)' }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ display: 'block', fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.mangaTitle}</strong>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{group.records.length} chapter{group.records.length === 1 ? '' : 's'} · {group.pageCount} pages · {formatByteSize(group.sizeBytes)}{group.readCount ? ` · ${group.readCount} read` : ''}</span>
              </div>
              <button type="button" disabled={!!working} aria-label={`Delete offline chapters for ${group.mangaTitle}`} title="Delete this manga's offline chapters" onClick={() => remove(group.records.map(record => record.key), group.mangaKey, `Delete ${group.records.length} offline chapter${group.records.length === 1 ? '' : 's'} for “${group.mangaTitle}”?`)} style={{ ...actionButtonStyle, width: 34, padding: 0, color: '#f87171', opacity: working ? .45 : 1 }}>
                <Trash2 size={13} />
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
});
