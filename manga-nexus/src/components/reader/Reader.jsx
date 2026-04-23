import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Activity, SkipBack, SkipForward, Sun, Pause, Play, Settings2, X } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { Spin } from '../ui/Spin';
import { proxyImg } from '../../utils/helpers';
import { THEMES } from '../../constants';
import { Btn } from '../ui/Btn';

const Droplet = ({size}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"></path></svg>;
const Contrast = ({size}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 18a6 6 0 0 0 0-12v12z"></path></svg>;

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
                    {Math.floor(timeSeconds/60)}<span style={{fontSize:14,color:'var(--muted)'}}>m</span> {timeSeconds%60}<span style={{fontSize:14,color:'var(--muted)'}}>s</span>
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

export const Reader = memo(({ pages, currentChapter, mangaTitle, onBack, onNextChapter, onPrevChapter, hasNext, hasPrev, onPageChange, initialPage = 0, mangaId }) => {
  const data = useData();
  const { updateProgress, addReadingTime, settings, updateSetting } = data || {};

  const [mode, setMode] = useState(settings?.readerMode || 'scroll');
  const [page, setPage] = useState(Math.min(initialPage, Math.max(0, pages.length - 1)));
  const [theme, setTheme] = useState(settings?.readerTheme || 'dark');
  const [fitMode, setFitMode] = useState(settings?.fitMode || 'original');
  const [direction, setDirection] = useState(settings?.readerDirection || 'rtl');
  const [doublePage, setDoublePage] = useState(settings?.readerDouble || false);
  const [brightness, setBrightness] = useState(settings?.brightness || 100);
  const [contrast, setContrast] = useState(settings?.readerContrast || 100);
  const [saturation, setSaturation] = useState(settings?.readerSaturation || 100);
  const [zoom, setZoom] = useState(settings?.readerZoom || 1);
  const [pageGap, setPageGap] = useState(settings?.readerGap || 0);
  
  const [autoScroll, setAutoScroll] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(settings?.scrollSpeed || 1);

  const [uiVisible, setUiVisible] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [quickSettingsOpen, setQuickSettingsOpen] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [touchStart, setTouchStart] = useState(null);

  const containerRef = useRef(null);
  const uiTimer = useRef(null);
  const sessionStart = useRef(Date.now());
  const T = THEMES[theme] || THEMES.dark;

  useEffect(() => { updateSetting?.('readerMode', mode); }, [mode]);
  useEffect(() => { updateSetting?.('readerTheme', theme); }, [theme]);
  useEffect(() => { updateSetting?.('fitMode', fitMode); }, [fitMode]);
  useEffect(() => { updateSetting?.('readerDirection', direction); }, [direction]);
  useEffect(() => { updateSetting?.('readerDouble', doublePage); }, [doublePage]);
  useEffect(() => { updateSetting?.('brightness', brightness); }, [brightness]);
  useEffect(() => { updateSetting?.('readerContrast', contrast); }, [contrast]);
  useEffect(() => { updateSetting?.('readerSaturation', saturation); }, [saturation]);
  useEffect(() => { updateSetting?.('readerGap', pageGap); }, [pageGap]);
  useEffect(() => { updateSetting?.('scrollSpeed', scrollSpeed); }, [scrollSpeed]);
  useEffect(() => { updateSetting?.('readerZoom', zoom); }, [zoom]);

  useEffect(() => {
    sessionStart.current = Date.now();
    return () => {
      const sec = Math.round((Date.now() - sessionStart.current) / 1000);
      if (mangaId && addReadingTime && sec > 5) addReadingTime(mangaId, sec);
    };
  }, [mangaId, currentChapter?.id]);

  useEffect(() => {
    if (!autoScroll || mode === 'paged') return;
    let req;
    const loop = () => {
      if (containerRef.current) containerRef.current.scrollTop += scrollSpeed;
      req = requestAnimationFrame(loop);
    };
    req = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(req);
  }, [autoScroll, scrollSpeed, mode]);

  useEffect(() => {
    if (!containerRef.current || mode === 'paged') return;
    const key = `aka:sc:${mangaId}:${currentChapter?.id}`;
    const saved = +localStorage.getItem(key) || 0;
    if (saved > 20) setTimeout(() => { if (containerRef.current) containerRef.current.scrollTop = saved; }, 150);
  }, [currentChapter?.id, mode]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mode === 'paged') return;
    const key = `aka:sc:${mangaId}:${currentChapter?.id}`;
    const fn = () => localStorage.setItem(key, String(el.scrollTop));
    el.addEventListener('scroll', fn, { passive: true });
    return () => el.removeEventListener('scroll', fn);
  }, [mode, mangaId, currentChapter?.id]);

  const nudgeUI = useCallback(() => {
    setUiVisible(true);
    clearTimeout(uiTimer.current);
    uiTimer.current = setTimeout(() => { 
        if (!panelOpen && !quickSettingsOpen) setUiVisible(false); 
    }, 3500);
  }, [panelOpen, quickSettingsOpen]);

  useEffect(() => {
    nudgeUI();
    return () => clearTimeout(uiTimer.current);
  }, [mode, nudgeUI]);

  const go = useCallback((delta) => {
    const np = Math.max(0, Math.min(pages.length - 1, page + delta));
    if (np === page) return;
    setPage(np);
    onPageChange?.(np);
    updateProgress?.(mangaId, currentChapter?.id, currentChapter?.number, np);
    nudgeUI();
  }, [page, pages.length, onPageChange, updateProgress, mangaId, currentChapter, nudgeUI]);

  useEffect(() => {
    if (mode === 'paged') return;
    const obs = new IntersectionObserver(entries => {
      let best = null, br = 0;
      entries.forEach(e => { if (e.intersectionRatio > br) { br = e.intersectionRatio; best = e; } });
      if (best) {
        const idx = +best.target.dataset.page;
        if (!isNaN(idx)) { setPage(idx); onPageChange?.(idx); updateProgress?.(mangaId, currentChapter?.id, currentChapter?.number, idx); }
      }
    }, { threshold: 0.5, rootMargin: '-10% 0px' });
    document.querySelectorAll('[data-page]').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [mode, pages.length, mangaId, currentChapter, onPageChange, updateProgress]);

  useEffect(() => {
    const h = e => {
      if (e.target.tagName === 'INPUT') return;
      const k = e.key;
      if (k === 'Escape') { e.preventDefault(); if (panelOpen) setPanelOpen(false); else if (quickSettingsOpen) setQuickSettingsOpen(false); else if (showReceipt) setShowReceipt(false); else onBack(); return; }
      if (k === 'ArrowRight' || k === 'd') { if (mode === 'paged') direction === 'rtl' ? go(-1) : go(1); }
      else if (k === 'ArrowLeft' || k === 'a') { if (mode === 'paged') direction === 'rtl' ? go(1) : go(-1); }
      else if (k === 'ArrowDown') { if (mode === 'paged') go(1); }
      else if (k === 'ArrowUp') { if (mode === 'paged') go(-1); }
      else if (k === 'PageDown') { e.preventDefault(); go(1); }
      else if (k === 'PageUp') { e.preventDefault(); go(-1); }
      else if (k === 'End') { e.preventDefault(); setPage(pages.length - 1); onPageChange?.(pages.length - 1); }
      else if (k === 'Home') { e.preventDefault(); setPage(0); onPageChange?.(0); }
      else if (k === 'n' || (k === 'ArrowRight' && e.ctrlKey)) { if (hasNext) { e.preventDefault(); onNextChapter(); } }
      else if (k === 'p' || (k === 'ArrowLeft' && e.ctrlKey)) { if (hasPrev) { e.preventDefault(); onPrevChapter(); } }
      else if ((k === '+' || k === '=') && !e.ctrlKey) setZoom(z => Math.min(3, +(z + .25).toFixed(2)));
      else if (k === '-' && !e.ctrlKey) setZoom(z => Math.max(.5, +(z - .25).toFixed(2)));
      else if (k === '0') setZoom(1);
      else if (k === 'm') setMode(m => ({ scroll: 'paged', paged: 'webtoon', webtoon: 'scroll' }[m] || 'scroll'));
      else if (k === 'r') setDirection(d => d === 'rtl' ? 'ltr' : 'rtl');
      else if (k === ' ') { e.preventDefault(); if (mode !== 'paged') setAutoScroll(prev => !prev); }
      nudgeUI();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [mode, go, onBack, onNextChapter, onPrevChapter, hasNext, hasPrev, page, pages.length, onPageChange, panelOpen, showReceipt, direction, nudgeUI, quickSettingsOpen]);

  const handleTap = useCallback(e => {
    if (panelOpen) { setPanelOpen(false); return; }
    if (quickSettingsOpen) { setQuickSettingsOpen(false); return; }
    if (zoom > 1.05) { nudgeUI(); return; }
    
    const x = e.clientX / window.innerWidth;
    const y = e.clientY / window.innerHeight;
    
    // Middle chunk opens UI
    if (x > 0.3 && x < 0.7 && y > 0.3 && y < 0.7) {
        setUiVisible(u => !u);
        return;
    }

    if (mode === 'paged') {
        if (direction === 'rtl') {
            if (x < .4) go(-1);
            else if (x > .6) go(1);
        } else {
            if (x < .4) go(1);
            else if (x > .6) go(-1);
        }
    } else {
        setUiVisible(u => !u);
    }
  }, [mode, go, zoom, nudgeUI, panelOpen, quickSettingsOpen, direction]);

  const pct = pages.length > 1 ? (page / (pages.length - 1)) * 100 : 0;
  const minsLeft = Math.max(1, Math.ceil((pages.length - page - 1) * 0.3));
  const imgFilter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;

  const getScrollStyle = (wt, fm, zm) => {
    const b = { display: 'block', userSelect: 'none', filter: imgFilter };
    if (wt) return { ...b, width: `${zm * 100}%`, maxWidth: `${860 * zm}px`, margin: '0 auto' };
    if (fm === 'width') return { ...b, width: `${zm * 100}vw`, height: 'auto' };
    if (fm === 'original') return { ...b, transform: zm !== 1 ? `scale(${zm})` : 'none', transformOrigin: 'top center', width: 'auto', height: 'auto' };
    return { ...b, height: `${zm * 88}vh`, width: 'auto', maxWidth: '100%' };
  };

  const Seg = ({ val, onChange, opts }) => (
    <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 3 }}>
      {opts.map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)} style={{
          flex: 1, padding: '8px 6px', borderRadius: 8, border: 'none', cursor: 'pointer',
          background: val === v ? 'rgba(255,255,255,0.16)' : 'transparent',
          color: val === v ? '#fff' : 'rgba(255,255,255,0.38)',
          fontSize: 12, fontWeight: 700, transition: 'all .13s',
          boxShadow: val === v ? '0 1px 6px rgba(0,0,0,.5)' : '',
        }}>{l}</button>
      ))}
    </div>
  );

  const Sl = ({ icon: Icon, min, max, step = 1, val, onChange, fmt, compact = false }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 8 : 14 }}>
      {Icon && <Icon size={compact ? 14 : 16} style={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0 }} />}
      <input type="range" min={min} max={max} step={step} value={val}
        onClick={e => e.stopPropagation()}
        onPointerDown={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
        onInput={e => onChange(+e.target.value)}
        onChange={e => onChange(+e.target.value)}
        style={{ flex: 1, cursor: 'ew-resize', accentColor: T.accent, height: compact ? 2 : 4 }} />
      <span style={{
        fontFamily: 'monospace', fontSize: compact ? 11 : 13, fontWeight: 'bold', color: 'rgba(255,255,255,0.6)',
        minWidth: 36, textAlign: 'right'
      }}>{fmt(val)}</span>
    </div>
  );

  const PanelSection = ({ title, children }) => (
    <div style={{ marginBottom: 24 }}>
      <p style={{
        fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.4)', marginBottom: 12, fontWeight: 800
      }}>{title}</p>
      {children}
    </div>
  );

  if (pages.length === 0) return (
    <div style={{
      position: 'fixed', inset: 0, background: T.bg,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16
    }}>
      <Spin size={40} />
    </div>
  );

  const isWebtoon = mode === 'webtoon';

  return (
    <div style={{ position: 'fixed', inset: 0, background: T.bg, overflow: 'hidden' }}
      onMouseMove={mode === 'paged' ? nudgeUI : undefined}>

      {showReceipt && (
        <ReadingReceipt
          chapter={currentChapter}
          pagesRead={pages.length}
          timeSeconds={Math.round((Date.now() - sessionStart.current) / 1000)}
          mangaTitle={mangaTitle}
          hasNext={hasNext}
          onNext={() => { setShowReceipt(false); onNextChapter(); }}
          onBack={() => { setShowReceipt(false); onBack(); }}
        />
      )}

      {/* Progress Bar Top */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 2, zIndex: 300, pointerEvents: 'none' }}>
        <div style={{
          height: '100%', width: `${pct}%`, transition: 'width .2s ease',
          background: `linear-gradient(90deg,${T.accent},${T.accent}88)`,
          boxShadow: `0 0 8px ${T.accent}60`
        }} />
      </div>

      {/* Top App Bar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
        padding: '14px 16px 14px',
        background: 'linear-gradient(to bottom,rgba(0,0,0,.86) 0%,rgba(0,0,0,.3) 75%,transparent 100%)',
        display: 'flex', alignItems: 'center', gap: 12,
        opacity: uiVisible ? 1 : 0,
        transform: uiVisible ? 'none' : 'translateY(-16px)',
        transition: 'opacity .25s ease, transform .25s ease',
        pointerEvents: uiVisible ? 'all' : 'none',
      }}>
        <button onClick={onBack} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 14px 7px 10px', borderRadius: 99,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', transition: 'all .15s', flexShrink: 0,
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.7)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.5)'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; }}>
          <ChevronLeft size={15} />Back
        </button>

        <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
          <p style={{
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
            color: 'rgba(255,255,255,0.9)', overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: 'nowrap', lineHeight: 1.2
          }}>
            {mangaTitle}
          </p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
            Ch.{currentChapter?.number}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button onClick={() => setShowReceipt(true)} title="Reading Stats"
            style={{ width: 34, height: 34, borderRadius: 99, border: 'none', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(16px)', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all .15s' }}>
            <Activity size={13} />
          </button>
          <button onClick={onPrevChapter} disabled={!hasPrev} title="Previous Chapter"
            style={{ width: 34, height: 34, borderRadius: 99, border: 'none', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(16px)', color: hasPrev ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: hasPrev ? 'pointer' : 'default', transition: 'all .15s' }}>
            <SkipBack size={13} />
          </button>
          <button onClick={onNextChapter} disabled={!hasNext} title="Next Chapter"
            style={{ width: 34, height: 34, borderRadius: 99, border: 'none', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(16px)', color: hasNext ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: hasNext ? 'pointer' : 'default', transition: 'all .15s' }}>
            <SkipForward size={13} />
          </button>
        </div>
      </div>

      {/* FLOATING PAGE INDICATOR & MINIMAL QUICK SETTINGS (Visible when UI hidden) */}
      <div style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 150,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 16px', borderRadius: 99,
          background: 'rgba(10,12,18,0.75)', backdropFilter: 'blur(16px) saturate(1.8)',
          border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          opacity: uiVisible ? 0 : 1, transform: uiVisible ? 'translateY(16px) scale(0.95)' : 'none',
          transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)', pointerEvents: uiVisible ? 'none' : 'auto'
      }}>
          <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>
            {page + 1} <span style={{ color: 'rgba(255,255,255,0.3)' }}>/ {pages.length}</span>
          </span>
          <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.1)' }} />
          <button onClick={() => setQuickSettingsOpen(p => !p)} style={{ background: 'transparent', border: 'none', color: quickSettingsOpen ? 'var(--accent)' : 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', transition: 'color 0.2s' }}>
            <Settings2 size={16} />
          </button>
      </div>

      {/* QUICK SETTINGS POPUP */}
      {quickSettingsOpen && !uiVisible && (
          <div className="anim-fadeInUp" onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()} style={{
              position: 'fixed', bottom: 64, right: 20, zIndex: 151,
              background: 'rgba(12,14,22,0.95)', backdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20,
              padding: 20, width: 280, boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
              display: 'flex', flexDirection: 'column', gap: 16
          }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1 }}>Quick Adjust</span>
                  <button onClick={() => setPanelOpen(true)} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>All Settings</button>
              </div>
              <Sl icon={Sun} min={40} max={150} val={brightness} onChange={setBrightness} fmt={v => `${v}%`} compact />
              <Sl icon={() => <span style={{fontSize:12,fontWeight:'bold',color:'rgba(255,255,255,0.5)'}}>🔍</span>} min={0.5} max={3} step={0.1} val={zoom} onChange={setZoom} fmt={v => `${v}x`} compact />
               {mode !== 'paged' && (
                 <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                     <button onClick={() => setAutoScroll(s => !s)} style={{ background: autoScroll ? 'var(--accent)' : 'rgba(255,255,255,0.1)', color: autoScroll ? '#fff' : 'rgba(255,255,255,0.7)', border: 'none', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                         {autoScroll ? <Pause size={12}/> : <Play size={12}/>} Auto-scroll
                     </button>
                     <div style={{ flex: 1 }}>
                         <Sl min={0.5} max={5} step={0.5} val={scrollSpeed} onChange={setScrollSpeed} fmt={v => `${v}x`} compact />
                     </div>
                 </div>
              )}
              {mode === 'paged' && (
                 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.04)', padding: '6px 12px', borderRadius: 8 }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Image Fit</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                        {[{id:'height', label:'H'}, {id:'width', label:'W'}, {id:'original', label:'1:1'}].map(f => (
                           <button key={f.id} onClick={() => setFitMode(f.id)} style={{ padding: '4px 10px', borderRadius: 6, background: fitMode === f.id ? 'var(--accent)' : 'transparent', border: 'none', color: fitMode === f.id ? '#fff' : 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{f.label}</button>
                        ))}
                    </div>
                 </div>
              )}
          </div>
      )}

      {/* Main Bottom Bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
        padding: '12px 16px 16px',
        background: 'linear-gradient(to top,rgba(0,0,0,.88) 0%,rgba(0,0,0,.4) 70%,transparent 100%)',
        opacity: uiVisible ? 1 : 0,
        transform: uiVisible ? 'none' : 'translateY(16px)',
        transition: 'opacity .25s ease, transform .25s ease',
        pointerEvents: uiVisible ? 'all' : 'none',
      }}>
        {mode === 'paged' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, maxWidth: 800, margin: '0 auto 12px' }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 'bold', minWidth: 26, fontFamily: 'monospace' }}>{page + 1}</span>
            <input type="range" min={0} max={pages.length - 1} value={page}
              onClick={e => e.stopPropagation()}
              onPointerDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}
              onInput={e => { const p = +e.target.value; setPage(p); onPageChange?.(p); updateProgress?.(mangaId, currentChapter?.id, currentChapter?.number, p); }}
              onChange={e => { const p = +e.target.value; setPage(p); onPageChange?.(p); updateProgress?.(mangaId, currentChapter?.id, currentChapter?.number, p); }}
              style={{ flex: 1, accentColor: T.accent, cursor: 'ew-resize' }} />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 'bold', minWidth: 26, textAlign: 'right', fontFamily: 'monospace' }}>{pages.length}</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: 800, margin: '0 auto' }}>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={() => setPanelOpen(p => !p)}
              title="Full Settings"
              style={{
                width: 38, height: 38, borderRadius: 12,
                background: panelOpen ? T.accent : 'rgba(255,255,255,0.08)',
                backdropFilter: 'blur(20px)',
                border: `1px solid ${panelOpen ? T.accent : 'rgba(255,255,255,0.1)'}`,
                color: panelOpen ? '#000' : 'rgba(255,255,255,0.8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all .15s'
              }}>
              <Settings2 size={18} />
            </button>
          </div>
        </div>
      </div>

      {panelOpen && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 300,
          background: 'rgba(12,14,20,0.95)', backdropFilter: 'blur(40px)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '32px 32px 0 0',
          boxShadow: '0 -24px 80px rgba(0,0,0,.6)',
          animation: 'fadeInUp .25s cubic-bezier(0.16,1,0.3,1) both',
        }}>
          <div style={{ padding: '16px 20px 0', display: 'flex', justifyContent: 'center', position: 'relative' }}>
            <div style={{ width: 40, height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.15)', margin: '0 auto' }} />
            <button onClick={() => setPanelOpen(false)} style={{ position: 'absolute', right: 20, top: 16, width: 32, height: 32, borderRadius: 16, border: 'none', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
          </div>

          <div style={{
            padding: '24px 28px 40px', display: 'flex', flexDirection: 'column',
            gap: 32, maxWidth: 640, margin: '0 auto', maxHeight: '75vh', overflowY: 'auto'
          }}>
              <PanelSection title="Reading Mode">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  {[{id: 'scroll', label: 'Scroll', icon: '↕️'}, {id: 'paged', label: 'Paged', icon: '📖'}, {id: 'webtoon', label: 'Strip', icon: '📜'}].map(m => (
                    <button key={m.id} onClick={() => setMode(m.id)} style={{
                      padding: '16px 10px', borderRadius: 20, border: `1.5px solid ${mode === m.id ? T.accent : 'rgba(255,255,255,0.04)'}`,
                      background: mode === m.id ? `${T.accent}15` : 'rgba(255,255,255,0.02)', color: mode === m.id ? '#fff' : 'rgba(255,255,255,0.5)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', transition: 'all 0.2s', boxShadow: mode === m.id ? `0 8px 24px ${T.accent}30` : 'none'
                    }}>
                      <span style={{ fontSize: 24, padding: 4 }}>{m.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{m.label}</span>
                    </button>
                  ))}
                </div>
              </PanelSection>

              {mode === 'paged' && (
                <PanelSection title="Reading Direction">
                  <Seg val={direction} onChange={setDirection} opts={[['rtl', '← RTL (Japanese)'], ['ltr', 'LTR → (Manhwa)']]} />
                </PanelSection>
              )}

              {mode !== 'webtoon' && (
                <PanelSection title="Image Fit">
                  <Seg val={fitMode} onChange={setFitMode} opts={[['height', 'Fit Height'], ['width', 'Fit Width'], ['original', '1:1 Scale']]} />
                </PanelSection>
              )}

              <PanelSection title="Image Adjustments">
                {pages[page] && (
                  <div style={{ position: 'relative', height: 120, borderRadius: 16, overflow: 'hidden', marginBottom: 20, border: '1px solid rgba(255,255,255,0.08)' }}>
                      <img src={proxyImg(pages[page])} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: imgFilter }} alt="preview" />
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <Sl icon={Sun} min={40} max={160} val={brightness} onChange={setBrightness} fmt={v => `${v}%`} />
                  <Sl icon={Contrast} min={60} max={160} val={contrast} onChange={setContrast} fmt={v => `${v}%`} />
                  <Sl icon={() => <span style={{fontSize:16,fontWeight:'bold',color:'rgba(255,255,255,0.5)'}}>🔍</span>} min={0.5} max={3} step={0.1} val={zoom} onChange={setZoom} fmt={v => `${v}x`} />
                </div>
              </PanelSection>

              <PanelSection title="Background Themes">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
                  {Object.entries(THEMES).map(([key, t]) => (
                    <button key={key} onClick={() => setTheme(key)}
                      style={{ padding: '14px 6px', borderRadius: 16, cursor: 'pointer', background: t.bg, border: `1.5px solid ${theme === key ? t.accent : 'rgba(255,255,255,0.04)'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, transform: theme === key ? 'scale(1.05)' : 'scale(1)', boxShadow: theme === key ? `0 8px 24px ${t.accent}40` : '' }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: t.accent }} />
                    </button>
                  ))}
                </div>
              </PanelSection>
          </div>
        </div>
      )}

      {mode === 'paged' ? (
        <div onClick={handleTap} onTouchStart={e => setTouchStart(e.touches[0].clientX)} onTouchEnd={e => { if (touchStart != null && zoom <= 1.05) { const d = touchStart - e.changedTouches[0].clientX; if (Math.abs(d) > 48) direction === 'rtl' ? go(d > 0 ? 1 : -1) : go(d > 0 ? -1 : 1); } setTouchStart(null); }}
          style={{ height: '100vh', width: '100vw', overflow: zoom > 1.05 ? 'auto' : 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: zoom > 1.05 ? 'grab' : 'default' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: direction === 'rtl' ? 'row-reverse' : 'row', gap: doublePage ? 2 : 0, minWidth: zoom > 1.05 ? `${zoom * 100}vw` : '100vw', minHeight: zoom > 1.05 ? `${zoom * 100}vh` : '100vh', padding: uiVisible ? '52px 0 72px' : '4px 0' }}>
            {doublePage && pages[direction === 'rtl' ? page + 1 : page - 1] && (
              <img src={proxyImg(pages[direction === 'rtl' ? page + 1 : page - 1])} draggable={false} alt="" style={{ display: 'block', userSelect: 'none', flexShrink: 0, filter: imgFilter, opacity: .88, maxWidth: '50vw', maxHeight: uiVisible ? 'calc(100vh - 124px)' : '100vh', height: fitMode === 'height' ? (uiVisible ? 'calc(100vh - 124px)' : '100vh') : 'auto', width: 'auto', objectFit: 'contain', animation: 'fadeIn .14s ease both' }} />
            )}
            <img src={proxyImg(pages[page])} draggable={false} alt={`Page ${page + 1}`} style={{ display: 'block', userSelect: 'none', flexShrink: 0, filter: imgFilter, animation: 'fadeIn .14s ease both', ...(zoom <= 1 ? { maxWidth: doublePage ? '50vw' : '100vw', maxHeight: uiVisible ? 'calc(100vh - 124px)' : '100vh', width: fitMode === 'width' ? (doublePage ? '50vw' : '100vw') : 'auto', height: fitMode === 'height' ? (uiVisible ? 'calc(100vh - 124px)' : '100vh') : 'auto', objectFit: 'contain', } : { maxWidth: 'none', maxHeight: 'none', width: fitMode === 'width' ? `${zoom * (doublePage ? 50 : 100)}vw` : 'auto', height: fitMode === 'height' ? `${zoom * 100}vh` : 'auto', transform: fitMode === 'original' ? `scale(${zoom})` : 'none', transformOrigin: 'center center', }) }} />
          </div>
        </div>
      ) : (
        <div ref={containerRef} onClick={handleTap} onTouchStart={e => setTouchStart(e.touches[0].clientX)} onTouchEnd={e => { if (touchStart != null) { const d = touchStart - e.changedTouches[0].clientX; if (Math.abs(d) > 60) go(d > 0 ? 1 : -1); } setTouchStart(null); }}
          style={{ height: '100vh', overflowY: 'auto', overflowX: isWebtoon ? 'hidden' : 'auto', paddingTop: uiVisible ? 52 : 0, scrollbarWidth: 'none', msOverflowStyle: 'none', transition: 'padding .2s ease' }}>
          {pages.map((url, i) => (
            <div key={i} data-page={i} style={{ display: 'flex', justifyContent: 'center', width: '100%', marginBottom: isWebtoon ? pageGap : Math.max(4, pageGap) }}>
              <img src={proxyImg(url)} alt={`Page ${i + 1}`} draggable={false} style={{ ...getScrollStyle(isWebtoon, fitMode, zoom) }} loading={i < 3 ? 'eager' : 'lazy'} />
            </div>
          ))}
          {hasNext && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px 80px', gap: 16 }}>
              <button onClick={onNextChapter} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 32px', borderRadius: 99, background: `linear-gradient(135deg,${T.accent},${T.accent}cc)`, color: '#fff', fontWeight: 800, fontSize: 15, border: 'none', cursor: 'pointer', boxShadow: `0 12px 32px ${T.accent}50`, transition: 'all .2s' }}>
                Next Chapter <ChevronRight size={18} />
              </button>
            </div>
          )}
          <div style={{ height: 120 }} />
        </div>
      )}

      {panelOpen && <div onClick={() => setPanelOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 295, cursor: 'pointer' }} />}
      {quickSettingsOpen && !uiVisible && <div onClick={() => setQuickSettingsOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 150, cursor: 'pointer' }} />}
    </div>
  );
});
