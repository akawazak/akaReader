import React, { memo, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Activity, SkipBack, SkipForward, Sun, Pause, Play, Settings2, X, ZoomIn, ZoomOut, AlignJustify, BookOpen, Columns, ChevronDown, Monitor } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { Spin } from '../ui/Spin';
import { proxyImg } from '../../utils/helpers';
import { THEMES } from '../../constants';
import { Btn } from '../ui/Btn';

const Droplet = ({ size }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"></path></svg>;
const Contrast = ({ size }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 18a6 6 0 0 0 0-12v12z"></path></svg>;

// ─── Color Utility ────────────────────────────────────────────────────────────
const getAdaptiveColor = (url) => {
  return new Promise((resolve) => {
    if (!url) return resolve('rgb(249, 115, 22)');
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1; canvas.height = 1;
      const ctx = canvas.getContext('2d');
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
    };
    img.onerror = () => resolve('rgb(249, 115, 22)');
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

// ─── Main Reader ───────────────────────────────────────────────────────────────
export const Reader = memo(({
  pages: initialPages, currentChapter: initialChapter, mangaTitle,
  onBack, onNextChapter, onPrevChapter, fetchNextChapter,
  hasNext, hasPrev, onPageChange, initialPage = 0, mangaId,
  mangaCover
}) => {
  const [adaptiveColor, setAdaptiveColor] = useState('rgb(249, 115, 22)');

  useEffect(() => {
    getAdaptiveColor(mangaCover).then(setAdaptiveColor);
  }, [mangaCover]);
  const data = useData();
  const { updateProgress, addReadingTime, settings, updateSetting, markChapterRead } = data || {};

  const [loadedChapters, setLoadedChapters] = useState([]);
  const [isFetchingNext, setIsFetchingNext] = useState(false);
  const [localHasNext, setLocalHasNext] = useState(hasNext);

  useEffect(() => {
    setLoadedChapters([{ chapter: initialChapter, pages: initialPages }]);
    setLocalHasNext(hasNext);
  }, [initialChapter?.id, initialPages, hasNext]);

  const allPages = useMemo(() => {
    let indexOffset = 0;
    return loadedChapters.flatMap(c => {
      const chapterPages = c.pages.map((url, i) => ({
        url,
        chapter: c.chapter,
        localIndex: i,
        total: c.pages.length,
        globalIndex: indexOffset + i
      }));
      indexOffset += c.pages.length;
      return chapterPages;
    });
  }, [loadedChapters]);

  const pages = useMemo(() => allPages.map(p => p.url), [allPages]);

  const [mode, setMode] = useState(settings?.readerMode || 'scroll');
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (initialPage > 0 && initialPage < pages.length && loadedChapters.length === 1) {
      setPage(initialPage);
    }
  }, [initialPage, pages.length, loadedChapters.length]);
  const [theme, setTheme] = useState(settings?.readerTheme || 'dark');
  const [fitMode, setFitMode] = useState(settings?.fitMode || 'original');
  const [direction, setDirection] = useState(settings?.readerDirection || 'rtl');
  const [doublePage, setDoublePage] = useState(settings?.readerDouble || false);
  const [doublePageOffset, setDoublePageOffset] = useState(false);
  const [brightness, setBrightness] = useState(settings?.brightness || 100);
  const [contrast, setContrast] = useState(settings?.readerContrast || 100);
  const [saturation, setSaturation] = useState(settings?.readerSaturation || 100);
  const [zoom, setZoom] = useState(settings?.readerZoom || 1);
  const [pageGap, setPageGap] = useState(settings?.readerGap || 0);

  const [autoScroll, setAutoScroll] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(settings?.scrollSpeed || 1);

  const [uiVisible, setUiVisible] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [touchStart, setTouchStart] = useState(null);

  const containerRef = useRef(null);
  const uiTimer = useRef(null);
  const sessionStart = useRef(Date.now());
  const T = THEMES[theme] || THEMES.dark;
  const accent = T.accent || '#f97316';

  const allPagesRef = useLatest(allPages);
  const modeRef = useLatest(mode);
  const zoomRef = useLatest(zoom);
  const panelOpenRef = useLatest(panelOpen);
  const directionRef = useLatest(direction);
  const doublePageRef = useLatest(doublePage);
  const doublePageOffsetRef = useLatest(doublePageOffset);
  const pageRef = useLatest(page);

  // ─ UI visibility (stable — panelOpen checked via ref) ─
  const nudgeUI = useCallback(() => {
    setUiVisible(true);
    clearTimeout(uiTimer.current);
    uiTimer.current = setTimeout(() => {
      if (!panelOpenRef.current) setUiVisible(false);
    }, 3500);
  }, [panelOpenRef]);

  useEffect(() => { nudgeUI(); return () => clearTimeout(uiTimer.current); }, [mode, nudgeUI]);

  const jumpToPage = useCallback((p, smooth = true) => {
    const np = Math.max(0, Math.min(allPagesRef.current.length - 1, p));
    setPage(np);
    if (modeRef.current !== 'paged' && containerRef.current) {
      const target = containerRef.current.querySelector(`[data-page="${np}"]`);
      if (target) {
        containerRef.current.scrollTo({
          top: target.offsetTop - (settings?.readerMode === 'scroll' ? 52 : 0),
          behavior: smooth ? 'smooth' : 'auto'
        });
      }
    }
    nudgeUI();
  }, [settings?.readerMode, allPagesRef, modeRef, nudgeUI]);

  const chapterRange = useMemo(() => {
    const cur = allPages[page];
    if (!cur) return { start: 0, end: 0, total: 0 };
    let start = -1, end = -1;
    for (let i = 0; i < allPages.length; i++) {
      if (allPages[i].chapter.id === cur.chapter.id) {
        if (start === -1) start = i;
        end = i;
      }
    }
    return { start, end, total: cur.total };
  }, [allPages, page]);

  // ── Stable refs for values that change often ──
  const showReceiptRef = useLatest(showReceipt);
  const autoScrollRef = useLatest(autoScroll);
  const scrollSpeedRef = useLatest(scrollSpeed);
  const pagesLenRef = useLatest(pages.length);
  const hasNextRef = useLatest(localHasNext);
  const hasPrevRef = useLatest(hasPrev);

  // ─ Persist settings (debounced 400ms so dragging sliders doesn't spam storage) ─
  useEffect(() => {
    if (!updateSetting) return;
    const t = setTimeout(() => {
      updateSetting('readerMode', mode);
      updateSetting('readerTheme', theme);
      updateSetting('fitMode', fitMode);
      updateSetting('readerDirection', direction);
      updateSetting('readerDouble', doublePage);
      updateSetting('brightness', brightness);
      updateSetting('readerContrast', contrast);
      updateSetting('readerSaturation', saturation);
      updateSetting('readerGap', pageGap);
      updateSetting('scrollSpeed', scrollSpeed);
      updateSetting('readerZoom', zoom);
    }, 400);
    return () => clearTimeout(t);
  }, [mode, theme, fitMode, direction, doublePage, brightness, contrast, saturation, pageGap, scrollSpeed, zoom, updateSetting]);

  // ─ Session time tracking ─
  useEffect(() => {
    sessionStart.current = Date.now();
    return () => {
      const sec = Math.round((Date.now() - sessionStart.current) / 1000);
      if (mangaId && addReadingTime && sec > 5) addReadingTime(mangaId, sec);
    };
  }, [mangaId, initialChapter?.id, addReadingTime]);

  // ─ Auto-scroll (stable — speed changes via ref, not effect re-run) ─
  useEffect(() => {
    if (!autoScroll || mode === 'paged') return;
    let raf;
    let last = 0;
    const loop = (now) => {
      if (!last) last = now;
      const delta = now - last;
      last = now;
      const px = (scrollSpeedRef.current * delta) / 16.67;
      if (containerRef.current) containerRef.current.scrollTop += px;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [autoScroll, mode, scrollSpeedRef]);

  // ─ Restore scroll position ─
  useEffect(() => {
    if (!containerRef.current || mode === 'paged') return;
    const key = `aka:sc:${mangaId}:${initialChapter?.id}`;
    const saved = +localStorage.getItem(key) || 0;
    if (saved > 20) setTimeout(() => { if (containerRef.current) containerRef.current.scrollTop = saved; }, 150);
  }, [initialChapter?.id, mode, mangaId]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mode === 'paged') return;
    const key = `aka:sc:${mangaId}:${initialChapter?.id}`;
    const fn = () => localStorage.setItem(key, String(el.scrollTop));
    el.addEventListener('scroll', fn, { passive: true });
    return () => el.removeEventListener('scroll', fn);
  }, [mode, mangaId, initialChapter?.id]);

  // ─ Page navigation (functional update — no stale closures) ─
  const go = useCallback((delta) => {
    const isDouble = modeRef.current === 'paged' && doublePageRef.current;
    
    let currentP = pageRef.current;
    if (isDouble) {
      // Ensure currentP is aligned with the expected grid based on offset
      const isOffset = doublePageOffsetRef.current;
      // Normal alignment (cover page alone): page 0, 2, 4
      // Offset alignment: page 1, 3, 5
      const remainder = currentP % 2;
      const expectedRemainder = isOffset ? 1 : 0;
      if (remainder !== expectedRemainder) currentP = Math.max(0, currentP - 1); // Realine
    }

    const step = isDouble ? delta * 2 : delta;
    jumpToPage(currentP + step);
    const np = Math.max(0, Math.min(allPagesRef.current.length - 1, pageRef.current + step));
    const pInfo = allPagesRef.current[np];
    if (pInfo) {
      onPageChange?.(pInfo.localIndex);
      updateProgress?.(mangaId, pInfo.chapter.id, pInfo.chapter.number, pInfo.localIndex);
      if (pInfo.localIndex >= pInfo.total - 1) markChapterRead?.(mangaId, pInfo.chapter.id, true);
    }
  }, [jumpToPage, onPageChange, updateProgress, markChapterRead, mangaId, pageRef, allPagesRef, modeRef, doublePageRef]);

  // ─ Infinite Scroll Auto-Fetch (Observer based) ─
  const fetchSentinelRef = useRef(null);
  useEffect(() => {
    if (mode === 'paged' || isFetchingNext || !fetchNextChapter || !localHasNext || allPages.length === 0) return;
    
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        const lastChap = loadedChapters[loadedChapters.length - 1].chapter;
        setIsFetchingNext(true);
        fetchNextChapter(lastChap.id).then(res => {
          if (res && res.pages.length > 0) setLoadedChapters(prev => [...prev, res]);
          else setLocalHasNext(false);
          setIsFetchingNext(false);
        });
      }
    }, { rootMargin: '800px 0px' }); // Trigger when 800px away from bottom

    if (fetchSentinelRef.current) obs.observe(fetchSentinelRef.current);
    return () => obs.disconnect();
  }, [mode, isFetchingNext, fetchNextChapter, localHasNext, allPages.length, loadedChapters]);

  // ─ Scroll-mode page tracking ─
  useEffect(() => {
    if (mode === 'paged') return;
    const obs = new IntersectionObserver(entries => {
      let best = null, br = 0;
      entries.forEach(e => { if (e.intersectionRatio > br) { br = e.intersectionRatio; best = e; } });
      if (best) {
        const idx = +best.target.dataset.page;
        if (!isNaN(idx)) {
          setPage(idx);
          const pInfo = allPagesRef.current[idx];
          if (pInfo) {
            onPageChange?.(pInfo.localIndex);
            updateProgress?.(mangaId, pInfo.chapter.id, pInfo.chapter.number, pInfo.localIndex);
            if (pInfo.localIndex >= pInfo.total - 1) markChapterRead?.(mangaId, pInfo.chapter.id, true);
          }
        }
      }
    }, { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1], rootMargin: '-10% 0px' });
    document.querySelectorAll('[data-page]').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [mode, mangaId, onPageChange, updateProgress, markChapterRead, allPagesRef, allPages.length]);

  // ─ Zoom recentering ─
  useEffect(() => {
    if (modeRef.current !== 'paged' && containerRef.current) {
      const target = containerRef.current.querySelector(`[data-page="${pageRef.current}"]`);
      if (target) {
        containerRef.current.scrollTo({
          top: target.offsetTop - (settings?.readerMode === 'scroll' ? 52 : 0),
          behavior: 'auto'
        });
      }
    }
  }, [zoom, settings?.readerMode, modeRef, pageRef]);

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
        e.preventDefault(); setPage(len - 1); onPageChange?.(len - 1);
      } else if (k === 'Home') {
        e.preventDefault(); setPage(0); onPageChange?.(0);
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
  }, [go, onBack, onNextChapter, onPrevChapter, onPageChange, nudgeUI]);

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
  const handleTap = useCallback(e => {
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

  if (pages.length === 0) return (
    <div style={{ position: 'fixed', inset: 0, background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <Spin size={40} />
    </div>
  );

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
        <button onClick={onBack} style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.07)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
          <ChevronLeft size={18} />
        </button>

        <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
          <p style={{ fontWeight: 800, fontSize: 13, color: 'rgba(255,255,255,0.95)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: -0.2, margin: 0 }}>{mangaTitle}</p>
          <p style={{ fontSize: 11, color: adaptiveColor, fontWeight: 700, marginTop: 1, opacity: 0.9, margin: 0 }}>
            Chapter {allPages[page]?.chapter.number} <span style={{ color: 'rgba(255,255,255,0.15)', margin: '0 4px' }}>|</span> Page {(allPages[page]?.localIndex || 0) + 1} of {allPages[page]?.total || 0}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowReceipt(true)} style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Reading Stats">
            <Activity size={16} />
          </button>
        </div>
      </div>

      {/* ── Bottom Floating Controls ── */}
      <div style={{
        position: 'fixed', bottom: 24, left: '50%', transform: `translateX(-50%) ${uiVisible ? 'translateY(0)' : 'translateY(40px)'}`,
        width: 'calc(100% - 48px)', maxWidth: 840, zIndex: 300,
        background: 'rgba(15,16,25,0.85)', backdropFilter: 'blur(32px) saturate(2)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: '16px 24px',
        transition: 'all 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
        opacity: uiVisible ? 1 : 0,
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column', gap: 16
      }}>
        {/* Scrubber (Focused on current chapter) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => { jumpToPage(chapterRange.start - 1); }}
            disabled={chapterRange.start === 0}
            style={{ width: 34, height: 34, borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.05)', color: chapterRange.start > 0 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.15)', cursor: chapterRange.start > 0 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Previous Chapter"
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
              onInput={e => jumpToPage(+e.target.value, false)}
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
            onClick={() => { jumpToPage(chapterRange.end + 1); }}
            disabled={!localHasNext && page === pages.length - 1}
            style={{ width: 34, height: 34, borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.05)', color: (localHasNext || page < pages.length - 1) ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.15)', cursor: (localHasNext || page < pages.length - 1) ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Next Chapter"
          >
            <SkipForward size={14} />
          </button>
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <ToolbarBtn active={mode === 'scroll'} accent={accent} onClick={() => setMode('scroll')} icon={<Columns size={15} />} label="Scroll" />
            <ToolbarBtn active={mode === 'paged'} accent={accent} onClick={() => setMode('paged')} icon={<BookOpen size={15} />} label="Paged" />
            <ToolbarBtn active={mode === 'webtoon'} accent={accent} onClick={() => setMode('webtoon')} icon={<AlignJustify size={15} />} label="Strip" />
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setAutoScroll(a => !a)} style={{
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

            <button onClick={() => setPanelOpen(true)} style={{ width: 34, height: 34, borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
              <button onClick={() => setPanelOpen(false)} style={{ width: 32, height: 32, borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 32, scrollbarWidth: 'none' }}>
              <Section title="Reading Mode">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <ModeCard active={mode === 'scroll'} accent={accent} onClick={() => setMode('scroll')} icon="↕️" label="Scroll" />
                  <ModeCard active={mode === 'paged'} accent={accent} onClick={() => setMode('paged')} icon="📖" label="Paged" />
                  <ModeCard active={mode === 'webtoon'} accent={accent} onClick={() => setMode('webtoon')} icon="📜" label="Strip" />
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
          onTouchStart={e => setTouchStart(e.touches[0].clientX)}
          onTouchEnd={e => {
            if (touchStart != null && zoom <= 1.05) {
              const d = touchStart - e.changedTouches[0].clientX;
              if (Math.abs(d) > 48) direction === 'rtl' ? go(d > 0 ? 1 : -1) : go(d > 0 ? -1 : 1);
            }
            setTouchStart(null);
          }}
          style={{ height: '100vh', width: '100vw', overflow: zoom > 1.05 ? 'auto' : 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: zoom > 1.05 ? 'grab' : 'default' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: direction === 'rtl' ? 'row-reverse' : 'row', gap: doublePage ? 2 : 0, minWidth: zoom > 1.05 ? `${zoom * 100}vw` : '100vw', minHeight: zoom > 1.05 ? `${zoom * 100}vh` : '100vh', padding: uiVisible ? '54px 0 100px' : '4px 0' }}>
            {doublePage && pages[direction === 'rtl' ? page + 1 : (page - 1)] !== undefined && (
              <img src={proxyImg(pages[direction === 'rtl' ? page + 1 : (page - 1)])} draggable={false} alt="" style={{ display: 'block', userSelect: 'none', flexShrink: 0, filter: imgFilter, opacity: .88, maxWidth: '50vw', maxHeight: uiVisible ? 'calc(100vh - 154px)' : '100vh', height: fitMode === 'height' ? (uiVisible ? 'calc(100vh - 154px)' : '100vh') : 'auto', width: 'auto', objectFit: 'contain', animation: 'fadeIn .14s ease both' }} />
            )}
            <img src={proxyImg(pages[page])} draggable={false} alt={`Page ${page + 1}`}
              style={{ display: 'block', userSelect: 'none', flexShrink: 0, filter: imgFilter, animation: 'fadeIn .14s ease both', ...(zoom <= 1 ? { maxWidth: doublePage ? '50vw' : '100vw', maxHeight: uiVisible ? 'calc(100vh - 154px)' : '100vh', width: fitMode === 'width' ? (doublePage ? '50vw' : '100vw') : 'auto', height: fitMode === 'height' ? (uiVisible ? 'calc(100vh - 154px)' : '100vh') : 'auto', objectFit: 'contain' } : { maxWidth: 'none', maxHeight: 'none', width: fitMode === 'width' ? `${zoom * (doublePage ? 50 : 100)}vw` : 'auto', height: fitMode === 'height' ? `${zoom * 100}vh` : 'auto', zoom: fitMode === 'original' && zoom !== 1 ? zoom : undefined }) }}
            />
          </div>
        </div>
      ) : (
        <div
          ref={containerRef}
          onClick={handleTap}
          onTouchStart={e => setTouchStart(e.touches[0].clientX)}
          onTouchEnd={e => { if (touchStart != null) { const d = touchStart - e.changedTouches[0].clientX; if (Math.abs(d) > 60) go(d > 0 ? 1 : -1); } setTouchStart(null); }}
          style={{ height: '100vh', overflowY: 'auto', overflowX: isWebtoon ? 'hidden' : 'auto', paddingTop: uiVisible ? 54 : 0, scrollbarWidth: 'none', msOverflowStyle: 'none', transition: 'padding .2s ease' }}
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
                <img src={proxyImg(p.url)} alt={`Page ${i + 1}`} draggable={false} style={{ ...getScrollStyle(isWebtoon, fitMode, zoom) }} loading={i < page + 5 ? 'eager' : 'lazy'} />
              </div>
            </React.Fragment>
          ))}
          {isFetchingNext && <div style={{ padding: '60px 0', display: 'flex', justifyContent: 'center' }}><Spin size={34} /></div>}
          {localHasNext && <div ref={fetchSentinelRef} style={{ height: 1, width: '100%' }} />}
          {localHasNext && !isFetchingNext && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px 120px', gap: 16 }}>
              <button onClick={() => {
                setIsFetchingNext(true);
                const lastChap = loadedChapters[loadedChapters.length - 1].chapter;
                fetchNextChapter(lastChap.id).then(res => {
                  if (res && res.pages.length > 0) setLoadedChapters(prev => [...prev, res]);
                  else setLocalHasNext(false);
                  setIsFetchingNext(false);
                });
              }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 40px', borderRadius: 99, background: `linear-gradient(135deg,${accent},${accent}cc)`, color: '#fff', fontWeight: 800, fontSize: 16, border: 'none', cursor: 'pointer', boxShadow: `0 15px 40px ${accent}40`, transition: 'all 0.3s ease' }}>
                Load Next Chapter <ChevronDown size={20} />
              </button>
            </div>
          )}
          {!localHasNext && (
            <div style={{ padding: '100px 0', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontWeight: 600, letterSpacing: 1 }}>
              END OF CHAPTERS
            </div>
          )}
          <div style={{ height: 160 }} />
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