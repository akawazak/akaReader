import React, { memo, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { BookOpen, ChevronRight } from 'lucide-react';
import { CATEGORIES } from '../../constants';
import { proxyImg } from '../../utils/helpers';
import { Badge } from '../ui/Badge';

export const MangaCard = memo(({ manga, onClick, index = 0, badge, progress, category, onContextMenu, eager = false }) => {
  const [loaded, setLoaded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [inView, setInView] = useState(eager);
  const cardRef = useRef(null);

  const categoryColor = useMemo(() => CATEGORIES.find(c => c.id === category)?.color, [category]);

  useEffect(() => {
    if (eager) return;
    const observer = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); observer.disconnect(); } }, { rootMargin: '100px' });
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [eager]);

  const handleContextMenu = useCallback((e) => { e.preventDefault(); onContextMenu?.(e, manga); }, [manga, onContextMenu]);

  return (
    <div
      ref={cardRef}
      className={`anim-fadeInUp delay-${Math.min(index, 14)}`}
      style={{ cursor: 'pointer', position: 'relative', userSelect: 'none', transition: 'all 0.35s var(--ease-spring)' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onClick(manga)}
      onContextMenu={handleContextMenu}
    >
      {categoryColor && (
        <div style={{ position: 'absolute', top: 12, left: -2, width: 4, height: 28, background: categoryColor, borderRadius: 4, zIndex: 3, boxShadow: `0 0 12px ${categoryColor}` }} />
      )}
      {badge && (
        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 3, background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '5px 12px', borderRadius: 20, fontSize: 10, fontWeight: 800, backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)' }}>
          {badge}
        </div>
      )}
      
      <div style={{
        aspectRatio: '2/3', borderRadius: 20, overflow: 'hidden', marginBottom: 14,
        border: `1px solid ${hovered ? 'var(--accent)' : 'rgba(255,255,255,0.08)'}`,
        background: 'rgba(15,18,25,0.8)', position: 'relative', transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        boxShadow: hovered ? '0 24px 48px rgba(0,0,0,0.5), 0 0 32px var(--accent-glow)' : '0 12px 24px rgba(0,0,0,0.4)',
        transform: hovered ? 'translateY(-6px)' : 'none'
      }}>
        {!loaded && !imageError && inView && <div className="anim-shimmer" style={{ position: 'absolute', inset: 0, zIndex: 1 }} />}
        
        {inView && manga.cover && !imageError ? (
          <img src={proxyImg(manga.cover)} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: hovered ? 'scale(1.1)' : 'scale(1)', transition: 'transform 0.8s cubic-bezier(0.16,1,0.3,1)', opacity: loaded ? 1 : 0 }} alt={manga.title} loading="lazy" onLoad={() => setLoaded(true)} onError={() => setImageError(true)} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,rgba(255,255,255,0.03),transparent)', gap: 10 }}>
            <BookOpen size={36} style={{ color: 'var(--muted)', opacity: 0.4 }} />
          </div>
        )}

        <div style={{ position: 'absolute', inset: 0, background: hovered ? 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 60%)' : 'linear-gradient(to top, rgba(0,0,0,0.3) 0%, transparent 40%)', transition: 'background 0.3s', zIndex: 2, pointerEvents: 'none' }} />

        {progress > 0 && (
          <div style={{ position: 'absolute', bottom: 12, left: 16, right: 16, height: 4, background: 'rgba(255,255,255,0.1)', zIndex: 4, borderRadius: 2, overflow: 'hidden', backdropFilter: 'blur(4px)' }}>
            <div style={{ width: `${Math.min(progress, 100)}%`, height: '100%', background: 'linear-gradient(90deg,var(--accent),#fb923c)', boxShadow: '0 0 12px var(--accent)', transition: 'width 0.5s cubic-bezier(0.16,1,0.3,1)' }} />
          </div>
        )}
      </div>
      
      <p style={{ fontSize: 14, fontWeight: 700, color: hovered ? 'var(--accent)' : 'var(--text)', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', transition: 'color 0.2s', padding: '0 4px' }}>
        {manga.title}
      </p>
      {manga.author && (
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, padding: '0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {manga.author}
        </p>
      )}
    </div>
  );
});

export const MangaListCard = memo(({ manga, onClick, category, progress: prog, onContextMenu }) => {
  const [imageError, setImageError] = useState(false);
  const categoryColor = useMemo(() => CATEGORIES.find(c => c.id === category)?.color, [category]);
  return (
    <div
      onClick={() => onClick(manga)}
      onContextMenu={e => { e.preventDefault(); onContextMenu?.(e, manga); }}
      className="glass"
      style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', borderRadius: 20, cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)', position: 'relative', overflow: 'hidden', transform: 'translateZ(0)' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 16px 32px rgba(0,0,0,0.3)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {categoryColor && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: categoryColor }} />}
      <div style={{ width: 64, height: 90, borderRadius: 12, overflow: 'hidden', flexShrink: 0, background: 'rgba(0,0,0,0.3)' }}>
        {manga.cover && !imageError
          ? <img src={proxyImg(manga.cover)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={manga.title} loading="lazy" onError={() => setImageError(true)} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BookOpen size={24} style={{ color: 'var(--muted)', opacity: 0.4 }} /></div>
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6 }}>{manga.title}</p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {manga.author && <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>{manga.author}</span>}
          {manga.status && <Badge variant={manga.status === 'ongoing' ? 'success' : 'outline'} size="sm">{manga.status}</Badge>}
        </div>
        {prog > 0 && (
          <div style={{ marginTop: 12, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(prog, 100)}%`, height: '100%', background: 'linear-gradient(90deg,var(--accent),#fb923c)' }} />
          </div>
        )}
      </div>
      <ChevronRight size={18} style={{ color: 'var(--muted)', flexShrink: 0 }} />
    </div>
  );
});
