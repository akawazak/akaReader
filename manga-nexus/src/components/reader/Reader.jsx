import React, { memo, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Activity, SkipBack, SkipForward, Sun, Pause, Play, Settings2, X, ZoomIn, AlignJustify, BookOpen, Columns, ChevronDown, RefreshCw } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { Spin } from '../ui/Spin';
import { proxyImg } from '../../utils/helpers';
import { THEMES } from '../../constants';
import { Btn } from '../ui/Btn';

const DEFAULT_ACCENT_COLOR = 'rgb(249, 115, 22)';
const normalizePages = (value) => Array.isArray(value) ? value.filter(Boolean) : [];

const Droplet = ({ size }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"></path></svg>;
const Contrast = ({ size }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 18a6 6 0 0 0 0-12v12z"></path></svg>;

// ─── Color Utility ────────────────────────────────────────────────────────────
const getAdaptiveColor = (url) => {
  return new Promise((resolve) => {
    if (!url) return resolve(DEFAULT_ACCENT_COLOR);
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1; canvas.height = 1;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas unavailable');
        ctx.drawImage(img, 0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        // Ensure vibrancy: if the color is too dark, boost it
        const hsp = Math.sqrt(0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b));
        if (hsp < 40) {
          // Too dark, return a lightened version or the theme default
          resolve(`rgb(${Math.min(255, r + 60)}, ${Math.min(255, g + 60)}, ${Math.min(255, b + 60)})`);
        } else {
          resolve(`rgb(${r}, ${g}, ${b})`);
        }
      } catch {
        resolve(DEFAULT_ACCENT_COLOR);
      }
    };
    img.onerror = () => resolve(DEFAULT_ACCENT_COLOR);
    img.src = proxyImg(url);
  });
};

// ─── Reading Receipt ───────────────────────────────────────────────────────────
const ReadingReceipt = memo(({ chapter, pagesRead, timeSeconds, mangaTitle, hasNext, onNext, onBack }) => (
  <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(30px) saturate(1.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div className="anim-scaleIn" style={{ width: '90%', maxWidth: 400, background: 'var(--card)', padding: '40px 32px', borderRadius: 32, textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
      <div style={{ width: 64, height: 64, background: 'rgba(34,197,94,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#4ade80' }}>
        <Activity size={32} />
      </div>
      <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, color: 'var(--text)' }}>Chapter {chapter?.number} Finished</h2>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>{mangaTitle}</p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 32 }}>
        <div style={{ background: 'var(--card2)', padding: '12px 20px', borderRadius: 16, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{pagesRead}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Pages</div>
        </div>
        <div style={{ background: 'var(--card2)', padding: '12px 20px', borderRadius: 16, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
            {Math.floor(timeSeconds / 60)}<span style={{ fontSize: 14, color: 'var(--muted)' }}>m</span> {timeSeconds % 60}<span style={{ fontSize: 14, color: 'var(--muted)' }}>s</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Time</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, flexDirection: 'column' }}>
        {hasNext && <Btn size="lg" variant="default" onClick={onNext} icon={ChevronRight}>Next Chapter</Btn>}
        <Btn size="lg" variant={hasNext ? 'secondary' : 'default'} onClick={onBack}>Back to Library</Btn>
      </div>
    </div>
  </div>
));

// ─── Shared sub-components ────────────────────────────────────────────────────

/** A labelled slider row */
const SliderRow = ({ icon: Icon, label, kbd, min, max, step = 1, val, onChange, fmt }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {Icon && <Icon size={14} style={{ color: 'rgba(255,255,255,0.45)' }} />}
        <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', letterSpacing: '.01em' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {kbd && <kbd style={{ fontSize: 10, padding: '2px 6px', borderRadius: 5, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>{kbd}</kbd>}
        <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.75)', fontFamily: 'monospace', minWidth: 42, textAlign: 'right' }}>{fmt(val)}</span>
      </div>
    </div>
    <input
      type="range" min={min} max={max} step={step} value={val}
      onClick={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
      onInput={e => onChange(+e.target.value)}
      onChange={e => onChange(+e.target.value)}
      style={{ width: '100%', cursor: 'ew-resize', accentColor: 'var(--r-accent,#f97316)', height: 3, margin: 0 }}
    />
  </div>
);

/** A pill-style segmented control */
const SegControl = ({ val, onChange, opts }) => (
  <div style={{ display: 'flex', gap: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 3 }}>
    {opts.map(([v, label, icon]) => (
      <button key={v} onClick={() => onChange(v)} style={{
        flex: 1, padding: '8px 4px', borderRadius: 8, border: 'none', cursor: 'pointer',
        background: val === v ? 'rgba(255,255,255,0.13)' : 'transparent',
        color: val === v ? '#fff' : 'rgba(255,255,255,0.35)',
        fontSize: 11, fontWeight: 700, transition: 'all .15s',
        boxShadow: val === v ? '0 1px 4px rgba(0,0,0,.4)' : '',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, lineHeight: 1,
      }}>
        {icon && <span style={{ fontSize: 16 }}>{icon}</span>}
        {label}
      </button>
    ))}
  </div>
);

/** A clickable mode card */
const ModeCard = ({ active, accent, onClick, icon, label, sub }) => (
  <button onClick={onClick} style={{
    flex: 1, padding: '14px 10px', borderRadius: 14,
    border: `1.5px solid ${active ? accent : 'rgba(255,255,255,0.07)'}`,
    background: active ? `${accent}18` : 'rgba(255,255,255,0.025)',
    color: active ? '#fff' : 'rgba(255,255,255,0.45)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    cursor: 'pointer', transition: 'all .18s', minWidth: 0,
  }}>
    <span style={{ fontSize: 22 }}>{icon}</span>
    <div>
      <div style={{ fontSize: 12, fontWeight: 700 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{sub}</div>}
    </div>
  </button>
);

/** A toggle switch */
const Toggle = ({ val, onChange, label, sub, kbd }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: val ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.5)' }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{sub}</div>}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {kbd && <kbd style={{ fontSize: 10, padding: '2px 6px', borderRadius: 5, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>{kbd}</kbd>}
      <button onClick={() => onChange(!val)} style={{
        width: 40, height: 22, borderRadius: 99, border: 'none', cursor: 'pointer',
        background: val ? 'var(--r-accent,#f97316)' : 'rgba(255,255,255,0.12)',
        position: 'relative', transition: 'background .2s', flexShrink: 0,
      }}>
        <span style={{
          position: 'absolute', top: 3, left: val ? 21 : 3,
          width: 16, height: 16, borderRadius: '50%', background: '#fff',
          transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,.3)',
        }} />
      </button>
    </div>
  </div>
);

const PageImage = memo(({ url, alt, style, loading = 'eager' }) => {
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    setFailed(false);
    setRetry(0);
  }, [url]);

  const src = useMemo(() => {
    if (!url) return '';
    const base = proxyImg(url);
    if (!retry) return base;
    return `${base}${base.includes('?') ? '&' : '?'}retry=${retry}`;
  }, [url, retry]);

  if (!url || failed) {
    return (
      <div
        role="img"
        aria-label={alt || 'Unreadable page'}
        onClick={e => e.stopPropagation()}
        style={{
          ...style,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          minWidth: 220,
          minHeight: 280,
          padding: 24,
          background: 'rgba(255,255,255,0.055)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12,
          color: 'rgba(255,255,255,0.7)',
          textAlign: 'center'
        }}
      >
        <BookOpen size={28} style={{ color: 'rgba(255,255,255,0.45)' }} />
        <span style={{ fontSize: 13, fontWeight: 700 }}>Page failed to load</span>
        {url && (
          <button
            onClick={() => { setFailed(false); setRetry(v => v + 1); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.07)', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 800 }}
          >
            <RefreshCw size={13} /> Retry Page
          </button>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      loading={loading}
      decoding="async"
      onError={() => setFailed(true)}
      style={style}
    />
  );
});

// ─── Ref helper: always access latest value without re-subscribing ───────────
const Section = ({ title, children, last }) => (
  <div style={{ marginBottom: last ? 0 : 32, borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.05)', paddingBottom: last ? 0 : 28 }}>
    <h4 style={{ fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
      {title}
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.03)' }} />
    </h4>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {children}
    </div>
  </div>
);

// ─── Ref helper: always access latest value without re-subscribing ───────────
function useLatest(value) {
  const ref = useRef(value);
  useEffect(() => { ref.current = value; }, [value]);
  return ref;
}

// ─── Double Page Spread Alignment Helper ─────────────────────────────────────────
const getSpreadStart = (p, isDouble, isOffset) => {
  if (!isDouble) return p;
  if (isOffset) {
    if (p === 0) return 0;
    return p - ((p % 2) === 0 ? 1 : 0);
  } else {
    return p - ((p % 2) !== 0 ? 1 : 0);
  }
};

// ─── Main Reader ───────────────────────────────────────────────────────────────
export const Reader = memo(({
  pages: initialPages, currentChapter: initialChapter, mangaTitle,
  onBack, onNextChapter, onPrevChapter, fetchNextChapter,
  hasNext, hasPrev, onPageChange, initialPage = 0, mangaId, mangaSourceId,
  mangaCover, isLoading
}) => {
  const [adaptiveColor, setAdaptiveColor] = useState(DEFAULT_ACCENT_COLOR);
  const safeInitialPages = useMemo(() => normalizePages(initialPages), [initialPages]);

  useEffect(() => {
    getAdaptiveColor(mangaCover).then(setAdaptiveColor);
  }, [mangaCover]);
  const data = useData();
  const { updateProgress, addReadingTime, settings, updateSetting, markChapterRead } = data || {};
  const [loadedChapters, setLoadedChapters] = useState(() => (
    initialChapter ? [{ chapter: initialChapter, pages: safeInitialPages }] : []
  ));
  const [isFetchingNext, setIsFetchingNext] = useState(false);
  const [localHasNext, setLocalHasNext] = useState(hasNext);
  const [nextChapterError, setNextChapterError] = useState('');
  const [mode, setMode] = useState(settings?.readerMode || 'scroll');
  const [page, setPage] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [direction, setDirection] = useState('rtl');
  const [fitMode, setFitMode] = useState(settings?.fitMode || 'height');
  const [brightness, setBrightness] = useState(settings?.brightness || 100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [pageGap, setPageGap] = useState(0);
  const [theme, setTheme] = useState(settings?.readerTheme || 'dark');
  const [doublePage, setDoublePage] = useState(false);
  const [doublePageOffset, setDoublePageOffset] = useState(false);
  const [autoScroll, setAutoScroll] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [touchStart, setTouchStart] = useState(null);

  const containerRef = useRef(null);
  const sessionStart = useRef(Date.now());
  const uiTimerRef = useRef(null);
  const startPageRef = useRef(initialPage);
  const markedReadRef = useRef(new Set());
  const pendingPersistRef = useRef(null);
  const persistTimerRef = useRef(null);
  const initialPositionKeyRef = useRef(null);
  const suppressNextTapRef = useRef(false);
  const suppressTapTimerRef = useRef(null);
  const fetchSentinelRef = useRef(null);

  const modeRef = useLatest(mode);
  const pageRef = useLatest(page);
  const zoomRef = useLatest(zoom);
  const directionRef = useLatest(direction);
  const panelOpenRef = useLatest(panelOpen);
  const showReceiptRef = useLatest(showReceipt);
  
  const loadingCooldownRef = useRef(false);
  const loadingNextRef = useRef(false);

  const allPages = useMemo(() => {
    const res = [];
    loadedChapters.forEach((item, chIdx) => {
      if (!item.pages || !Array.isArray(item.pages)) return;
      item.pages.forEach((p, pIdx) => {
        res.push({
          url: p,
          chapter: item.chapter,
          localIndex: pIdx,
          total: item.pages.length,
          globalIndex: res.length,
          chapterIndex: chIdx
        });
      });
    });
    return res;
  }, [loadedChapters]);

  const pages = useMemo(() => allPages.map(p => p.url), [allPages]);

  const allPagesRef = useLatest(allPages);
  const pagesLenRef = useLatest(allPages.length);
  const hasNextRef = useLatest(localHasNext);
  const loadedChaptersRef = useLatest(loadedChapters);

  const chapterRange = useMemo(() => {
    const current = allPages[page];
    if (!current) return { start: 0, end: 0, total: 0 };
    const chId = current.chapter.id;
    let start = -1, end = -1;
    allPages.forEach((p, i) => {
      if (p.chapter.id === chId) {
        if (start === -1) start = i;
        end = i;
      }
    });
    return { start, end, total: current.total };
  }, [allPages, page]);

  const T = THEMES[theme] || THEMES.dark;
  const accent = adaptiveColor;

  const nudgeUI = useCallback(() => {
    setUiVisible(true);
    clearTimeout(uiTimerRef.current);
    if (!panelOpenRef.current && !showReceiptRef.current) {
      uiTimerRef.current = setTimeout(() => setUiVisible(false), 3500);
    }
  }, [panelOpenRef, showReceiptRef]);

  const persistPage = useCallback((pInfo) => {
    if (!pInfo || !updateProgress) return;
    const { chapter, localIndex } = pInfo;
    
    // Debounce progress updates to avoid hammering the backend
    clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      updateProgress(mangaId, chapter.id, chapter.number, localIndex, mangaSourceId);
    }, 1500);

    if (localIndex >= chapter.total - 1 && !markedReadRef.current.has(chapter.id)) {
      markChapterRead?.(mangaId, chapter.id, true, mangaSourceId);
      markedReadRef.current.add(chapter.id);
    }
  }, [mangaId, mangaSourceId, updateProgress, markChapterRead]);

  const jumpToPage = useCallback((idx, smooth = true) => {
    const len = allPagesRef.current.length;
    if (idx < 0 || idx >= len) return;
    
    let targetPage = idx;
    if (modeRef.current === 'paged') {
      targetPage = getSpreadStart(idx, doublePage, doublePageOffset);
    }
    
    setPage(targetPage);
    if (modeRef.current !== 'paged' && containerRef.current) {
      const target = containerRef.current.querySelector(`[data-page="${targetPage}"]`);
      if (target) {
        containerRef.current.scrollTo({
          top: target.offsetTop - 54,
          behavior: smooth ? 'smooth' : 'auto'
        });
      }
    }
  }, [allPagesRef, modeRef, doublePage, doublePageOffset]);

  const go = useCallback((delta) => {
    let step = delta;
    if (modeRef.current === 'paged' && doublePage) {
      if (doublePageOffset) {
        if (pageRef.current === 0 && delta > 0) {
          step = 1;
        } else if (pageRef.current === 1 && delta < 0) {
          step = -1;
        } else {
          step = delta * 2;
        }
      } else {
        step = delta * 2;
      }
    }
    
    const next = pageRef.current + step;
    if (next >= 0 && next < pagesLenRef.current) {
      jumpToPage(next);
      persistPage(allPagesRef.current[next]);
    } else if (next >= pagesLenRef.current && delta > 0 && hasNextRef.current) {
      loadNextChapter();
    }
  }, [pageRef, pagesLenRef, jumpToPage, persistPage, allPagesRef, hasNextRef, loadNextChapter, doublePage, doublePageOffset, modeRef]);

  const loadNextChapter = useCallback(async () => {
    if (document.hidden) return null;
    if (loadingNextRef.current || loadingCooldownRef.current || !fetchNextChapter || !hasNextRef.current) return null;
    
    // Safety: Don't load next if current pages haven't even loaded yet
    if (allPagesRef.current.length === 0) return null;

    const lastEntry = loadedChaptersRef.current[loadedChaptersRef.current.length - 1];
    const lastChapterId = lastEntry?.chapter?.id;
    if (!lastChapterId) {
      setLocalHasNext(false);
      return null;
    }

    loadingNextRef.current = true;
    loadingCooldownRef.current = true;
    setNextChapterError('');
    setIsFetchingNext(true);

    try {
      const res = await fetchNextChapter(lastChapterId);
      // If the fetch returned an error but we have next, don't kill hasNext forever
      if (res?.error) {
        setNextChapterError(res.error);
        return null;
      }

      const nextPages = normalizePages(res?.pages);
      if (res?.chapter && nextPages.length > 0) {
        setLoadedChapters(prev => {
          if (prev.some(item => item.chapter?.id === res.chapter.id)) return prev;
          return [...prev, { chapter: res.chapter, pages: nextPages }];
        });
        return res;
      }

      // Truly no next chapter found
      setLocalHasNext(false);
      return null;
    } catch (e) {
      setNextChapterError(e?.message || 'Failed to load the next chapter.');
      return null;
    } finally {
      loadingNextRef.current = false;
      setIsFetchingNext(false);
      setTimeout(() => { loadingCooldownRef.current = false; }, 1000);
    }
  }, [fetchNextChapter, hasNextRef, loadedChaptersRef, pagesLenRef, allPagesRef]);

  useEffect(() => {
    // Only reset if it's a truly new session (different chapter ID or empty)
    const isAlreadyLoaded = loadedChaptersRef.current.some(item => item.chapter?.id === initialChapter?.id);
    if (initialChapter && !isAlreadyLoaded) {
      setLoadedChapters([{ chapter: initialChapter, pages: safeInitialPages }]);
      setNextChapterError('');
      setPage(initialPage || 0);
      startPageRef.current = Math.max(0, initialPage || 0);
      markedReadRef.current = new Set();
      pendingPersistRef.current = null;
      clearTimeout(persistTimerRef.current);
      initialPositionKeyRef.current = null;
    } else if (initialChapter && safeInitialPages.length > 0 && loadedChaptersRef.current[0]?.pages.length === 0) {
      // Just update the pages for the first chapter if they were empty
      setLoadedChapters(prev => {
        const next = [...prev];
        if (next[0]) next[0] = { ...next[0], pages: safeInitialPages };
        return next;
      });
    }
  }, [initialChapter?.id, safeInitialPages, initialPage]);

  useEffect(() => {
    setLocalHasNext(hasNext);
  }, [hasNext]);

  // Align active page spread start when spread settings change
  useEffect(() => {
    if (mode === 'paged') {
      const aligned = getSpreadStart(page, doublePage, doublePageOffset);
      if (aligned !== page) {
        setPage(aligned);
      }
    }
  }, [doublePage, doublePageOffset, mode]);

  // ─ Scroll-mode page tracking ─
  useEffect(() => {
    if (mode === 'paged') return;
    const root = containerRef.current;
    if (!root) return;
    const obs = new IntersectionObserver(entries => {
      let best = null, br = 0;
      entries.forEach(e => { if (e.intersectionRatio > br) { br = e.intersectionRatio; best = e; } });
      if (best) {
        const idx = +best.target.dataset.page;
        if (!isNaN(idx)) {
          setPage(idx);
          const pInfo = allPagesRef.current[idx];
          persistPage(pInfo);
        }
      }
    }, { root, threshold: [0, 0.25, 0.5, 0.75, 1], rootMargin: '-54px 0px -5% 0px' });
    root.querySelectorAll('[data-page]').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [mode, persistPage, allPagesRef, allPages.length]);

  // ─ Auto-load next chapter observer ─
  useEffect(() => {
    if (mode === 'paged') return;
    const el = fetchSentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) loadNextChapter();
    }, { root: containerRef.current, rootMargin: '400px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [mode, loadNextChapter]);

  // ─ Zoom recentering ─
  useEffect(() => {
    if (modeRef.current !== 'paged' && containerRef.current) {
      const target = containerRef.current.querySelector(`[data-page="${pageRef.current}"]`);
      if (target) {
        containerRef.current.scrollTo({
          top: target.offsetTop - 54,
          behavior: 'auto'
        });
      }
    }
  }, [zoom, mode, modeRef, pageRef]);

  // ─ Keyboard shortcuts (registered ONCE — uses refs for live values) ─
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT') return;
      const k = e.key;

      if (k === 'Escape') {
        e.preventDefault();
        if (panelOpenRef.current) { setPanelOpen(false); return; }
        if (showReceiptRef.current) { setShowReceipt(false); return; }
        onBack?.();
        return;
      }

      const currentMode = modeRef.current;
      const currentDir = directionRef.current;
      const currentZoom = zoomRef.current;
      const len = pagesLenRef.current;

      if (k === 'ArrowRight' || k === 'd') {
        if (currentMode === 'paged') currentDir === 'rtl' ? go(-1) : go(1);
      } else if (k === 'ArrowLeft' || k === 'a') {
        if (currentMode === 'paged') currentDir === 'rtl' ? go(1) : go(-1);
      } else if (k === 'ArrowDown') {
        if (currentMode === 'paged') go(1);
      } else if (k === 'ArrowUp') {
        if (currentMode === 'paged') go(-1);
      } else if (k === 'PageDown') {
        e.preventDefault(); go(1);
      } else if (k === 'PageUp') {
        e.preventDefault(); go(-1);
      } else if (k === 'End') {
        e.preventDefault();
        const idx = Math.max(0, len - 1);
        jumpToPage(idx);
        const pInfo = allPagesRef.current[idx];
        persistPage(pInfo);
      } else if (k === 'Home') {
        e.preventDefault();
        jumpToPage(0);
        const pInfo = allPagesRef.current[0];
        persistPage(pInfo);
      } else if (k === 'n' || (k === 'ArrowRight' && e.ctrlKey)) {
        if (hasNextRef.current) { e.preventDefault(); onNextChapter?.(); }
      } else if (k === 'p' || (k === 'ArrowLeft' && e.ctrlKey)) {
        if (hasPrevRef.current) { e.preventDefault(); onPrevChapter?.(); }
      } else if ((k === '+' || k === '=') && !e.ctrlKey) {
        setZoom(z => Math.min(3, +(z + 0.25).toFixed(2)));
      } else if (k === '-' && !e.ctrlKey) {
        setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)));
      } else if (k === '0') {
        setZoom(1);
      } else if (k === 'm') {
        setMode(m => ({ scroll: 'paged', paged: 'webtoon', webtoon: 'scroll' }[m] || 'scroll'));
      } else if (k === 'r') {
        setDirection(d => d === 'rtl' ? 'ltr' : 'rtl');
      } else if (k === ' ') {
        e.preventDefault();
        if (currentMode !== 'paged') setAutoScroll(s => !s);
        else go(1);
      } else if (k === 's') {
        e.preventDefault(); setPanelOpen(p => !p);
      }

      nudgeUI();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [go, jumpToPage, allPagesRef, onBack, onNextChapter, onPrevChapter, persistPage, nudgeUI]);

  // ─ Trackpad / mouse wheel paging for desktop (paged mode only) ─
  useEffect(() => {
    if (mode !== 'paged') return;
    let acc = 0;
    let timeout;
    const handleWheel = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      acc += e.deltaY;
      clearTimeout(timeout);
      timeout = setTimeout(() => { acc = 0; }, 120);
      if (Math.abs(acc) > 50) {
        go(acc > 0 ? 1 : -1);
        acc = 0;
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [mode, go]);

  // ─ Pause auto-scroll when window loses focus ─
  useEffect(() => {
    const handleVis = () => { if (document.hidden) setAutoScroll(false); };
    document.addEventListener('visibilitychange', handleVis);
    return () => document.removeEventListener('visibilitychange', handleVis);
  }, []);

  // ─ Tap handling ─
  useEffect(() => () => clearTimeout(suppressTapTimerRef.current), []);

  const suppressNextTap = useCallback(() => {
    suppressNextTapRef.current = true;
    clearTimeout(suppressTapTimerRef.current);
    suppressTapTimerRef.current = setTimeout(() => {
      suppressNextTapRef.current = false;
    }, 450);
  }, []);

  const handleTap = useCallback(e => {
    if (suppressNextTapRef.current) {
      suppressNextTapRef.current = false;
      return;
    }
    if (panelOpenRef.current) { setPanelOpen(false); return; }
    if (zoomRef.current > 1.05) { nudgeUI(); return; }
    const x = e.clientX / window.innerWidth;
    const y = e.clientY / window.innerHeight;
    if (x > 0.3 && x < 0.7 && y > 0.3 && y < 0.7) { setUiVisible(u => !u); return; }
    if (modeRef.current === 'paged') {
      if (directionRef.current === 'rtl') { if (x < .4) go(-1); else if (x > .6) go(1); }
      else { if (x < .4) go(1); else if (x > .6) go(-1); }
    } else { setUiVisible(u => !u); }
  }, [go, nudgeUI, panelOpenRef, zoomRef, modeRef, directionRef]);

  const pct = pages.length > 1 ? (page / (pages.length - 1)) * 100 : 0;
  const imgFilter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
  const isWebtoon = mode === 'webtoon';

  const getScrollStyle = (wt, fm, zm) => {
    const b = { display: 'block', userSelect: 'none', filter: imgFilter };
    if (wt) return { ...b, width: `${zm * 100}%`, maxWidth: `${860 * zm}px`, margin: '0 auto' };
    if (fm === 'width') return { ...b, width: `${zm * 100}vw`, height: 'auto' };
    if (fm === 'original') return { ...b, zoom: zm !== 1 ? zm : undefined, transform: 'none', width: 'auto', height: 'auto' };
    return { ...b, height: `${zm * 88}vh`, width: 'auto', maxWidth: '100%' };
  };

  if (pages.length === 0) {
    if (isLoading) {
      return (
        <div style={{ position: 'fixed', inset: 0, background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
          <div style={{ position: 'relative', width: 64, height: 64 }}>
            <Spin size="lg" color={accent} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
              <BookOpen size={20} color={accent} />
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: accent, letterSpacing: 2, display: 'block', marginBottom: 4 }}>LOADING</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.3)' }}>Fetching chapter pages...</span>
          </div>
        </div>
      );
    }
    return (
      <div style={{ position: 'fixed', inset: 0, background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center', color: T.text }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent }}>
          <BookOpen size={28} />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>No pages found</h2>
        <p style={{ color: 'rgba(255,255,255,0.48)', fontSize: 13, maxWidth: 360, lineHeight: 1.6, margin: 0 }}>
          This chapter did not return any readable pages. Try another chapter or reload it from the manga details page.
        </p>
        <Btn onClick={onBack} icon={ChevronLeft}>Back to Manga</Btn>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: T.bg, color: T.text,
        fontFamily: 'var(--font-body)', overflow: 'hidden',
        '--r-accent': accent,
        '--r-aura': adaptiveColor,
      }}
      onMouseMove={nudgeUI}
    >
      {/* ── Adaptive Aura Background ── */}
      <div style={{
        position: 'absolute', top: '-10%', left: '-10%', width: '120%', height: '120%',
        background: `radial-gradient(circle at 50% 50%, ${adaptiveColor}18 0%, transparent 65%)`,
        filter: 'blur(100px)', pointerEvents: 'none', zIndex: 0,
        animation: 'aura-float 20s ease-in-out infinite alternate',
        opacity: theme === 'dark' || theme === 'abyss' ? 0.6 : 0.2
      }} />
      <style>{`
        @keyframes aura-float {
          0% { transform: translate(0,0) scale(1); }
          50% { transform: translate(2%, 3%) scale(1.1); }
          100% { transform: translate(-2%, -1%) scale(0.95); }
        }
      `}</style>
      {/* ── Progress Aura ── */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 120, background: `radial-gradient(ellipse at top, ${adaptiveColor}12 0%, transparent 70%)`, pointerEvents: 'none', zIndex: 1, opacity: uiVisible ? 1 : 0, transition: 'opacity 0.4s' }} />

      {/* Reading Receipt */}
      {showReceipt && (
        <ReadingReceipt
          chapter={allPages[page]?.chapter}
          pagesRead={pages.length}
          timeSeconds={Math.round((Date.now() - sessionStart.current) / 1000)}
          mangaTitle={mangaTitle}
          hasNext={localHasNext}
          onNext={() => { setShowReceipt(false); onNextChapter(); }}
          onBack={() => { setShowReceipt(false); onBack(); }}
        />
      )}

      {/* ── Top Bar ── */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 300,
        background: 'rgba(7,8,15,0.85)', backdropFilter: 'blur(20px) saturate(1.8)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        height: 54, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 12,
        transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s',
        transform: uiVisible ? 'translateY(0)' : 'translateY(-100%)',
        opacity: uiVisible ? 1 : 0,
        boxShadow: '0 4px 30px rgba(0,0,0,0.3)'
      }}>
        <button onClick={onBack} title="Back to manga" aria-label="Back to manga" style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.07)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
          <ChevronLeft size={18} />
        </button>

        <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
          <p style={{ fontWeight: 800, fontSize: 13, color: 'rgba(255,255,255,0.95)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: -0.2, margin: 0 }}>{mangaTitle}</p>
          <p style={{ fontSize: 11, color: adaptiveColor, fontWeight: 700, marginTop: 1, opacity: 0.9, margin: 0 }}>
            Chapter {allPages[page]?.chapter.number} <span style={{ color: 'rgba(255,255,255,0.15)', margin: '0 4px' }}>|</span> Page {(allPages[page]?.localIndex || 0) + 1} of {allPages[page]?.total || 0}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowReceipt(true)} title="Reading stats" aria-label="Reading stats" style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={16} />
          </button>
        </div>
      </div>

      {/* ── Bottom Floating Controls ── */}
      <div style={{
        position: 'fixed', bottom: 24, left: '50%', transform: `translateX(-50%) ${uiVisible ? 'translateY(0)' : 'translateY(40px)'}`,
        width: 'min(840px, calc(100vw - 24px))', zIndex: 300,
        background: 'rgba(15,16,25,0.85)', backdropFilter: 'blur(32px) saturate(2)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, padding: '12px 14px',
        transition: 'all 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
        opacity: uiVisible ? 1 : 0,
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column', gap: 12
      }}>
        {/* Scrubber (Focused on current chapter) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <button
            onClick={() => { if (chapterRange.start === 0 && hasPrev) onPrevChapter?.(); else jumpToPage(chapterRange.start - 1); }}
            disabled={chapterRange.start === 0 && !hasPrev}
            style={{ width: 34, height: 34, borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.05)', color: (chapterRange.start > 0 || hasPrev) ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.15)', cursor: (chapterRange.start > 0 || hasPrev) ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Previous chapter"
            aria-label="Previous chapter"
          >
            <SkipBack size={14} />
          </button>

          <span style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', minWidth: 28, textAlign: 'center' }}>
            {(allPages[page]?.localIndex || 0) + 1}
          </span>

          <div style={{ flex: 1, position: 'relative', height: 24, display: 'flex', alignItems: 'center' }}>
            {/* Floating indicator */}
            <div style={{
              position: 'absolute',
              left: `${((page - chapterRange.start) / (chapterRange.end - chapterRange.start || 1)) * 100}%`,
              bottom: '100%',
              transform: 'translateX(-50%) translateY(-8px)',
              background: adaptiveColor,
              color: '#fff',
              padding: '2px 8px',
              borderRadius: 6,
              fontSize: 10,
              fontWeight: 900,
              pointerEvents: 'none',
              opacity: uiVisible ? 1 : 0,
              transition: 'opacity 0.2s, left 0.1s ease-out',
              boxShadow: `0 4px 12px ${adaptiveColor}40`
            }}>
              {(allPages[page]?.localIndex || 0) + 1}
            </div>
            <input type="range"
              min={chapterRange.start}
              max={chapterRange.end}
              value={page}
              onInput={e => {
                const nextPage = +e.target.value;
                jumpToPage(nextPage, false);
                persistPage(allPagesRef.current[nextPage]);
              }}
              style={{
                width: '100%',
                accentColor: adaptiveColor,
                height: 4,
                cursor: 'pointer',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: 2
              }}
            />
          </div>

          <span style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', minWidth: 28, textAlign: 'center' }}>
            {chapterRange.total}
          </span>

          <button
            onClick={() => {
              if (chapterRange.end >= pages.length - 1 && localHasNext) onNextChapter?.();
              else jumpToPage(chapterRange.end + 1);
            }}
            disabled={!localHasNext && page === pages.length - 1}
            style={{ width: 34, height: 34, borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.05)', color: (localHasNext || page < pages.length - 1) ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.15)', cursor: (localHasNext || page < pages.length - 1) ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Next chapter"
            aria-label="Next chapter"
          >
            <SkipForward size={14} />
          </button>
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <ToolbarBtn active={mode === 'scroll'} accent={accent} onClick={() => setMode('scroll')} icon={<Columns size={15} />} label="Scroll" />
            <ToolbarBtn active={mode === 'paged'} accent={accent} onClick={() => setMode('paged')} icon={<BookOpen size={15} />} label="Paged" />
            <ToolbarBtn active={mode === 'webtoon'} accent={accent} onClick={() => setMode('webtoon')} icon={<AlignJustify size={15} />} label="Strip" />
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setAutoScroll(a => !a)} title={autoScroll ? 'Pause auto-scroll' : 'Start auto-scroll'} aria-label={autoScroll ? 'Pause auto-scroll' : 'Start auto-scroll'} style={{
              width: 40, height: 40, borderRadius: 14, border: 'none',
              background: autoScroll ? `${adaptiveColor}20` : 'rgba(255,255,255,0.06)',
              color: autoScroll ? adaptiveColor : 'rgba(255,255,255,0.6)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
              boxShadow: autoScroll ? `0 0 15px ${adaptiveColor}30` : 'none'
            }}>
              {autoScroll ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
            </button>

            <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

            <button onClick={() => setPanelOpen(true)} title="Reader settings" aria-label="Reader settings" style={{ width: 34, height: 34, borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Settings2 size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Settings Drawer ── */}
      {panelOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)',
          animation: 'fadeIn 0.3s ease'
        }} onClick={() => setPanelOpen(false)}>
          <div style={{
            position: 'absolute', right: 0, top: 0, bottom: 0,
            width: '100%', maxWidth: 360,
            background: 'rgba(15,16,24,0.92)', backdropFilter: 'blur(40px) saturate(2)',
            borderLeft: '1px solid rgba(255,255,255,0.08)',
            padding: '32px 24px', display: 'flex', flexDirection: 'column',
            overflowY: 'auto', animation: 'slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            boxShadow: '-20px 0 60px rgba(0,0,0,0.5)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: -0.5 }}>Reader Settings</h3>
              <button onClick={() => setPanelOpen(false)} title="Close reader settings" aria-label="Close reader settings" style={{ width: 32, height: 32, borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 32, scrollbarWidth: 'none' }}>
              <Section title="Reading Mode">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <ModeCard active={mode === 'scroll'} accent={accent} onClick={() => setMode('scroll')} icon={<Columns size={22} />} label="Scroll" />
                  <ModeCard active={mode === 'paged'} accent={accent} onClick={() => setMode('paged')} icon={<BookOpen size={22} />} label="Paged" />
                  <ModeCard active={mode === 'webtoon'} accent={accent} onClick={() => setMode('webtoon')} icon={<AlignJustify size={22} />} label="Strip" />
                </div>
              </Section>

              {mode === 'paged' && (
                <Section title="Paged Layout">
                  <Toggle val={doublePage} onChange={setDoublePage} label="Double Page Spread" sub="Show two pages side-by-side" />
                  {doublePage && <Toggle val={doublePageOffset} onChange={setDoublePageOffset} label="Offset Spread by 1" sub="Fix misaligned pages" />}
                  <div style={{ marginTop: 12 }}>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Direction</p>
                    <SegControl val={direction} onChange={setDirection} opts={[['rtl', 'Right-to-Left'], ['ltr', 'Left-to-Right']]} />
                  </div>
                </Section>
              )}

              <Section title="Image & Display">
                <SliderRow icon={Sun} label="Brightness" min={40} max={160} val={brightness} onChange={setBrightness} fmt={v => `${v}%`} />
                <SliderRow icon={Contrast} label="Contrast" min={60} max={160} val={contrast} onChange={setContrast} fmt={v => `${v}%`} />
                <SliderRow icon={Droplet} label="Saturation" min={0} max={200} val={saturation} onChange={setSaturation} fmt={v => `${v}%`} />
                <SliderRow icon={ZoomIn} label="Zoom" min={0.5} max={3} step={0.1} val={zoom} onChange={setZoom} fmt={v => `${v}x`} />
                <SliderRow icon={AlignJustify} label="Page Gap" min={0} max={100} val={pageGap} onChange={setPageGap} fmt={v => `${v}px`} />
              </Section>

              <Section title="Reader Theme" last>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                  {Object.entries(THEMES).map(([key, t]) => (
                    <button key={key} onClick={() => setTheme(key)} style={{ aspectRatio: 1, borderRadius: 12, background: t.bg, border: `2px solid ${theme === key ? accent : 'rgba(255,255,255,0.08)'}`, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: t.accent, boxShadow: theme === key ? `0 0 10px ${t.accent}80` : 'none' }} />
                    </button>
                  ))}
                </div>
              </Section>
            </div>
          </div>
        </div>
      )}

      {/* ── Viewport ── */}
      {mode === 'paged' ? (
        <div
          onClick={handleTap}
          onTouchStart={e => setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY })}
          onTouchEnd={e => {
            if (touchStart != null && zoom <= 1.05) {
              const dx = touchStart.x - e.changedTouches[0].clientX;
              const dy = touchStart.y - e.changedTouches[0].clientY;
              if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.25) {
                suppressNextTap();
                direction === 'rtl' ? go(dx > 0 ? 1 : -1) : go(dx > 0 ? -1 : 1);
              }
            }
            setTouchStart(null);
          }}
          style={{ height: '100vh', width: '100vw', overflow: zoom > 1.05 ? 'auto' : 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: zoom > 1.05 ? 'grab' : 'default' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: direction === 'rtl' ? 'row-reverse' : 'row', gap: doublePage ? 2 : 0, minWidth: zoom > 1.05 ? `${zoom * 100}vw` : '100vw', minHeight: zoom > 1.05 ? `${zoom * 100}vh` : '100vh', padding: uiVisible ? '54px 0 100px' : '4px 0' }}>
            <PageImage url={pages[page]} alt={`Page ${page + 1}`}
              style={{ display: 'block', userSelect: 'none', flexShrink: 0, filter: imgFilter, animation: 'fadeIn .14s ease both', ...(zoom <= 1 ? { maxWidth: doublePage ? '50vw' : '100vw', maxHeight: uiVisible ? 'calc(100vh - 154px)' : '100vh', width: fitMode === 'width' ? (doublePage ? '50vw' : '100vw') : 'auto', height: fitMode === 'height' ? (uiVisible ? 'calc(100vh - 154px)' : '100vh') : 'auto', objectFit: 'contain' } : { maxWidth: 'none', maxHeight: 'none', width: fitMode === 'width' ? `${zoom * (doublePage ? 50 : 100)}vw` : 'auto', height: fitMode === 'height' ? `${zoom * 100}vh` : 'auto', zoom: fitMode === 'original' && zoom !== 1 ? zoom : undefined }) }}
            />
            {doublePage && !(doublePageOffset && page === 0) && pages[page + 1] !== undefined && (
              <PageImage url={pages[page + 1]} alt={`Page ${page + 2}`} style={{ display: 'block', userSelect: 'none', flexShrink: 0, filter: imgFilter, opacity: .88, maxWidth: '50vw', maxHeight: uiVisible ? 'calc(100vh - 154px)' : '100vh', height: fitMode === 'height' ? (uiVisible ? 'calc(100vh - 154px)' : '100vh') : 'auto', width: 'auto', objectFit: 'contain', animation: 'fadeIn .14s ease both' }} />
            )}
          </div>
        </div>
      ) : (
        <div
          ref={containerRef}
          onClick={handleTap}
          onTouchStart={e => setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY })}
          onTouchEnd={e => {
            if (touchStart != null) {
              const dx = touchStart.x - e.changedTouches[0].clientX;
              const dy = touchStart.y - e.changedTouches[0].clientY;
              if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.35) suppressNextTap();
            }
            setTouchStart(null);
          }}
          style={{ height: '100vh', overflowY: 'auto', overflowX: isWebtoon ? 'hidden' : 'auto', paddingTop: uiVisible ? 54 : 0, paddingBottom: 16, scrollbarWidth: 'none', msOverflowStyle: 'none', transition: 'padding .2s ease' }}
        >
          {allPages.map((p, i) => (
            <React.Fragment key={`${p.chapter.id}-${i}`}>
              {p.localIndex === 0 && i !== 0 && (
                <div style={{
                  margin: '140px 0 100px',
                  padding: '80px 20px',
                  textAlign: 'center',
                  background: `linear-gradient(to bottom, transparent, ${adaptiveColor}15 50%, transparent)`,
                  borderTop: '1px solid rgba(255,255,255,0.04)',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 16
                }}>
                  <div style={{
                    padding: '4px 12px',
                    borderRadius: 6,
                    background: `${adaptiveColor}25`,
                    color: adaptiveColor,
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    border: `1px solid ${adaptiveColor}40`,
                    boxShadow: `0 0 20px ${adaptiveColor}30`
                  }}>
                    End of Chapter
                  </div>
                  <h3 style={{ fontSize: 32, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: -1, opacity: 0.95 }}>
                    Chapter {p.chapter.number}
                  </h3>
                  <div style={{ width: 40, height: 2, background: adaptiveColor, borderRadius: 1, opacity: 0.5 }} />
                </div>
              )}
              <div data-page={i} style={{ display: 'flex', justifyContent: 'center', width: '100%', marginBottom: pageGap }}>
                <PageImage url={p.url} alt={`Page ${i + 1}`} style={{ ...getScrollStyle(isWebtoon, fitMode, zoom) }} loading={i < page + 5 ? 'eager' : 'lazy'} />
              </div>
            </React.Fragment>
          ))}
          {isFetchingNext && <div style={{ padding: '60px 0', display: 'flex', justifyContent: 'center' }}><Spin size={34} /></div>}
          {/* Sentinel / Next Chapter Loading */}
          {localHasNext && <div ref={fetchSentinelRef} style={{ height: 2, width: '100%' }} />}
          
          {(isFetchingNext || nextChapterError || !localHasNext) && (
            <div style={{ padding: '60px 24px 120px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
              {isFetchingNext && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, opacity: 0.8 }}>
                  <Spin size="lg" color={accent} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 }}>FETCHING NEXT CHAPTER</span>
                </div>
              )}

              {nextChapterError && (
                <div style={{ maxWidth: 400, width: '100%', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', padding: '24px', borderRadius: 24, textAlign: 'center' }}>
                  <div style={{ color: '#ef4444', fontSize: 14, fontWeight: 800, marginBottom: 16 }}>{nextChapterError}</div>
                  <Btn onClick={loadNextChapter} icon={RefreshCw} variant="default" style={{ background: '#ef4444', margin: '0 auto' }}>Retry Chapter</Btn>
                </div>
              )}

              {!localHasNext && pages.length > 0 && (
                <div style={{ opacity: 0.3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <Activity size={32} />
                  <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: 2 }}>END OF MANGA</span>
                </div>
              )}
            </div>
          )}
          <div style={{ height: 100 }} />
        </div>
      )}
    </div>
  );
});

// ─── Small toolbar button ──────────────────────────────────────────────────────
const ToolbarBtn = ({ active, accent, onClick, label, icon, kbd, title }) => (
  <button
    onClick={onClick}
    title={title || `${label}${kbd ? ` (${kbd})` : ''}`}
    style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '7px 12px', borderRadius: 9,
      border: `1px solid ${active ? accent : 'rgba(255,255,255,0.09)'}`,
      background: active ? `${accent}20` : 'rgba(255,255,255,0.06)',
      color: active ? accent : 'rgba(255,255,255,0.65)',
      fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all .15s',
    }}
  >
    <span style={{ display: 'flex', alignItems: 'center', fontSize: typeof icon === 'string' ? 14 : undefined }}>{icon}</span>
    {label}
  </button>
);
