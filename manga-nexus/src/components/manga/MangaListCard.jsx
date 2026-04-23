import React, { memo, useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { BookOpen, ChevronRight } from 'lucide-react';
import { proxyImg } from '../../utils/helpers';
import { CATEGORIES } from '../../constants';
import { Badge } from '../ui/Badge';

export const MangaListCard = memo(({ manga, onClick, category, progress: prog, onContextMenu }) => {
  const [imageError, setImageError] = useState(false);
  const categoryColor = useMemo(() => CATEGORIES.find(c => c.id === category)?.color, [category]);
  return (
    <div
      onClick={() => onClick(manga)}
      onContextMenu={e => { e.preventDefault(); onContextMenu?.(e, manga); }}
      style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 14px', borderRadius: 14, background: 'var(--card)', border: '1.5px solid var(--border)', cursor: 'pointer', transition: 'all 0.2s', position: 'relative', overflow: 'hidden' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.background = 'var(--card-hover)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--card)'; }}
    >
      {categoryColor && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: categoryColor, borderRadius: '2px 0 0 2px' }} />}
      <div style={{ width: 56, height: 80, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: 'var(--card2)', border: '1px solid var(--border)' }}>
        {manga.cover && !imageError
          ? <img src={proxyImg(manga.cover)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={manga.title} loading="lazy" onError={() => setImageError(true)} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BookOpen size={20} style={{ color: 'var(--muted)', opacity: 0.4 }} /></div>
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 5 }}>{manga.title}</p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {manga.author && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{manga.author}</span>}
          {manga.status && <Badge variant={manga.status === 'ongoing' ? 'success' : 'outline'} size="sm">{manga.status}</Badge>}
        </div>
        {prog > 0 && (
          <div style={{ marginTop: 8, height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(prog, 100)}%`, height: '100%', background: 'linear-gradient(90deg,var(--accent),#fb923c)' }} />
          </div>
        )}
      </div>
      <ChevronRight size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />
    </div>
  );
});
