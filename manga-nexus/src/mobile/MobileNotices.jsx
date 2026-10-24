import React, { memo, useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, Check, Puzzle } from 'lucide-react';
import { useData } from '../contexts/DataContext';

// Phone notifications: short messages drop in from the top like Android heads-up
// notices (the desktop stacks cards on the right), and running work — extension
// installs and chapter downloads — shows as one live pill above the bottom nav.

const TOAST_ICONS = { success: CheckCircle2, error: AlertCircle, warning: AlertTriangle, info: Info };

export const MobileToasts = memo(({ toasts, onDismiss }) => (
  <div className="m-toasts" role="status" aria-live="polite">
    {toasts.slice(-3).map(t => {
      const Icon = TOAST_ICONS[t.type] || Info;
      return (
        <button key={t.id} className={`m-toast ${t.type}`} onClick={() => onDismiss(t.id)}>
          <span className="ico"><Icon size={18} /></span>
          <span className="msg">{t.message}</span>
        </button>
      );
    })}
  </div>
));

const Ring = ({ value }) => {
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <svg className="ring" width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
      <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
      <circle cx="18" cy="18" r={r} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, Math.max(0, value)) / 100)} transform="rotate(-90 18 18)" />
    </svg>
  );
};

export const ActivityPill = memo(({ raised, onOpenDownloads }) => {
  const { downloadQueue, installing, extensions } = useData();
  const active = downloadQueue.filter(d => d.status === 'pending' || d.status === 'downloading');
  const current = active.find(d => d.status === 'downloading') || active[0];
  const installs = [...(installing || [])];
  const [finished, setFinished] = useState(0);
  const prevActive = useRef(active.length);

  // A short "done" state after the last download finishes.
  useEffect(() => {
    if (prevActive.current > 0 && active.length === 0 && downloadQueue.some(d => d.status === 'done' || d.status === 'completed')) {
      setFinished(prevActive.current);
      const timer = setTimeout(() => setFinished(0), 2600);
      prevActive.current = 0;
      return () => clearTimeout(timer);
    }
    prevActive.current = Math.max(prevActive.current, active.length);
    if (active.length) setFinished(0);
    return undefined;
  }, [active.length, downloadQueue]);

  let body = null;
  if (installs.length) {
    const name = extensions.find(e => e.pkgName === installs[0])?.name || 'extension';
    body = (
      <div className="m-pill">
        <span className="lead"><Puzzle size={17} /><i className="m-spin" /></span>
        <span className="txt"><b className="m-ellipsis">Installing {name}</b>{installs.length > 1 && <small>{installs.length - 1} more after this</small>}</span>
      </div>
    );
  } else if (current) {
    const pct = current.status === 'downloading' ? current.progress || 0 : 0;
    body = (
      <button className="m-pill" onClick={onOpenDownloads}>
        <span className="lead"><Ring value={pct} /><em>{Math.round(pct)}</em></span>
        <span className="txt">
          <b className="m-ellipsis">{current.status === 'downloading' ? 'Downloading' : 'Waiting to download'} ch. {current.chapterNum}</b>
          <small className="m-ellipsis">{current.mangaTitle}{active.length > 1 ? ` · ${active.length - 1} more` : ''}</small>
        </span>
      </button>
    );
  } else if (finished) {
    body = (
      <button className="m-pill done" onClick={onOpenDownloads}>
        <span className="lead"><Check size={18} /></span>
        <span className="txt"><b>Downloads finished</b><small>Ready to read offline</small></span>
      </button>
    );
  }
  if (!body) return null;
  return <div className={`m-pill-wrap ${raised ? 'raised' : ''}`}>{body}</div>;
});
