// app.jsx - Upgraded UI, Quick Settings, Draggable Sliders & Auto-scroll
import React, {
  useState, useEffect, useCallback, useRef, useMemo,
  createContext, useContext, memo
} from 'react';
import {
  BookOpen, Library, History, Puzzle, Search, X,
  ChevronLeft, ChevronRight, Bell, Globe, Download, Trash2, RefreshCw,
  Heart, Check, AlertTriangle, ArrowRight, Clock, Loader2, Play,
  SkipForward, SkipBack, Sun, Moon, Maximize, LayoutGrid, List,
  Columns, Filter, Tag, TrendingUp, Calendar, Eye, EyeOff, Zap,
  MoreVertical, Share2, ExternalLink, Archive, Star, Flame, Activity,
  ChevronUp, ChevronDown, ZoomIn, ZoomOut, Settings, Sliders, BellRing,
  SlidersHorizontal, Coffee, AlertCircle, RotateCcw, ChevronRightCircle,
  Pen, Sparkles, Bookmark, Award, StickyNote, Pencil, Pause, Settings2, Plus,
  AlignJustify
} from 'lucide-react';

import { Reader as NewReader } from './components/reader/Reader';
import { HomeView as HomeTab } from './views/HomeView';
import { DataContext, useData } from './contexts/DataContext';
import { ExtensionsTab } from './components/extensions/ExtensionsTab';

// ==================== CONFIG & CONSTANTS ====================

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  componentDidCatch(e, info) { console.error('[ErrorBoundary]', e, info); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0f', color: '#f87171', gap: 16, padding: 32 }}>
        <span style={{ fontSize: 32 }}>💥</span>
        <h2 style={{ color: '#f1f5f9', margin: 0 }}>Something crashed</h2>
        <p style={{ color: '#64748b', textAlign: 'center', maxWidth: 400 }}>{this.state.error.message}</p>
        <button
          onClick={() => this.setState({ error: null })}
          style={{ padding: '10px 24px', background: '#f97316', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
        >Try again</button>
      </div>
    );
  }
}

const DEFAULT_API_BASE =
  typeof window !== 'undefined' && window.location.protocol === 'file:'
    ? 'http://localhost:3001/api'
    : '/api';

const CONFIG = {
  API: import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE,
  SUWAYOMI: import.meta.env.VITE_SUWAYOMI_BASE_URL || 'http://localhost:4567',
  DEBOUNCE_DELAY: 300,
  UPDATE_INTERVAL: 3600000,
};

const proxyImg = (url) => {
  if (!url) return null;
  const isLoopback = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?\//i.test(url);
  if (url.startsWith(CONFIG.SUWAYOMI) || url.startsWith('/') || isLoopback) {
    const absolute = url.startsWith('/') ? `${CONFIG.SUWAYOMI}${url}` : url;
    return `${CONFIG.API}/img?url=${encodeURIComponent(absolute)}`;
  }
  return url;
};

const directSuwayomiAsset = (url) => {
  if (!url) return null;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  return url.startsWith('/') ? `${CONFIG.SUWAYOMI}${url}` : url;
};

const getDownloadKey = (mangaKey, chapterId) => `${mangaKey}___${chapterId}`;
const DOWNLOAD_PAGE_CONCURRENCY = 4;
const UPDATE_SCAN_CONCURRENCY = 4;

async function mapWithConcurrency(items, limit, task) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(limit, items.length);

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await task(items[currentIndex], currentIndex);
    }
  }));

  return results;
}

async function fetchPageBlobs(urls, signal, onProgress) {
  let completed = 0;
  const results = await mapWithConcurrency(urls, DOWNLOAD_PAGE_CONCURRENCY, async (url, index) => {
    if (signal.aborted) throw new Error('Download cancelled');
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`Page failed: ${response.status}`);
    const blob = await response.blob();
    completed++;
    onProgress(completed, urls.length);
    return { url, blob, index };
  });

  return results.sort((a, b) => a.index - b.index).map(({ url, blob }) => ({ url, blob }));
}

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

const DEFAULT_CATEGORIES = [
  { id: 'reading', name: 'Reading', color: '#f97316' },
  { id: 'completed', name: 'Completed', color: '#22c55e' },
  { id: 'planning', name: 'Plan to Read', color: '#3b82f6' },
  { id: 'dropped', name: 'Dropped', color: '#ef4444' },
  { id: 'favorites', name: 'Favorites', color: '#f59e0b' },
];

const CATEGORY_ICON_MAP = {
  reading: BookOpen,
  completed: Check,
  planning: Calendar,
  dropped: X,
  favorites: Star,
};

const THEMES = {
  dark: { bg: '#080a0e', card: '#16161f', accent: '#f97316', label: 'Dark', text: 'rgba(255,255,255,0.9)' },
  abyss: { bg: '#030303', card: '#0d0d0d', accent: '#f97316', label: 'Abyss', text: 'rgba(255,255,255,0.85)' },
  sepia: { bg: '#1c1714', card: '#2a241e', accent: '#d4956a', label: 'Sepia', text: 'rgba(240,220,195,0.92)' },
  warm: { bg: '#13100e', card: '#1e1916', accent: '#fb923c', label: 'Warm', text: 'rgba(255,235,210,0.9)' },
  midnight: { bg: '#080e1a', card: '#0f1929', accent: '#60a5fa', label: 'Night', text: 'rgba(200,220,255,0.9)' },
  forest: { bg: '#0a110c', card: '#131a14', accent: '#4ade80', label: 'Forest', text: 'rgba(210,240,215,0.9)' },
  rose: { bg: '#140a0e', card: '#1f1115', accent: '#fb7185', label: 'Rose', text: 'rgba(255,210,220,0.9)' },
  slate: { bg: '#0c0e12', card: '#141720', accent: '#94a3b8', label: 'Slate', text: 'rgba(220,225,240,0.9)' },
  paper: { bg: '#f4f0e8', card: '#ede9df', accent: '#92400e', label: 'Paper', text: 'rgba(40,30,20,0.9)' },
  white: { bg: '#ffffff', card: '#f5f5f7', accent: '#f97316', label: 'White', text: 'rgba(10,10,10,0.9)' },
};

const SORT_OPTIONS = [
  { value: 'latest', label: 'Latest' },
  { value: 'popular', label: 'Most Popular' },
];

// ==================== UTILITY FUNCTIONS ====================

const timeAgo = (ts) => { if (!ts) return ''; const d = Date.now() - ts, m = Math.floor(d / 60000), h = Math.floor(d / 3600000), dy = Math.floor(d / 86400000); if (m < 1) return 'just now'; if (m < 60) return `${m}m ago`; if (h < 24) return `${h}h ago`; if (dy < 7) return `${dy}d ago`; return `${Math.floor(dy / 7)}w ago`; };

const storage = {
  get: (key, defaultValue) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch { return defaultValue; }
  },
  set: (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { }
  },
};

const debounce = (fn, delay) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
};

const calculateStreak = (history) => {
  if (!history?.length) return 0;
  const dates = [...new Set(history.map(h => new Date(h.lastRead).toDateString()))]
    .sort((a, b) => new Date(b) - new Date(a));
  if (!dates.length) return 0;
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (dates[0] !== today && dates[0] !== yesterday) return 0;
  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const diff = (new Date(dates[i - 1]) - new Date(dates[i])) / 86400000;
    if (diff === 1) streak++;
    else break;
  }
  return streak;
};

const isSourceVerificationError = (message = '') => {
  const text = String(message).toLowerCase();
  return text.includes('cloudflare') || text.includes('captcha') || text.includes('challenge') || text.includes('verification');
};

// ==================== GLOBAL STYLES ====================

const GlobalStyles = memo(({ appTheme, accentColor }) => {
  useEffect(() => {
    const root = document.documentElement;
    if (appTheme === 'light') {
      root.setAttribute('data-theme', 'light');
    } else {
      root.removeAttribute('data-theme');
    }
  }, [appTheme]);
  useEffect(() => {
    if (!accentColor || accentColor === '#f97316') { ['--accent', '--accent2', '--accent-glow'].forEach(v => document.documentElement.style.removeProperty(v)); return; }
    const h = accentColor.replace('#', ''), r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16), d = v => Math.max(0, Math.round(v * .82));
    document.documentElement.style.setProperty('--accent', accentColor);
    document.documentElement.style.setProperty('--accent2', `rgb(${d(r)},${d(g)},${d(b)})`);
    document.documentElement.style.setProperty('--accent-glow', `rgba(${r},${g},${b},0.3)`);
  }, [accentColor]);

  useEffect(() => {
    return;
    const style = document.createElement('style');
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');

      :root {
        --font-display: 'Outfit', 'Segoe UI Variable Display', system-ui, sans-serif;
        --font-body:    'Outfit', 'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif;
        --bg:           #07080d;
        --bg2:          #0c0e15;
        --bg3:          #111420;
        --card:         #111520;
        --card2:        #181c2a;
        --card-hover:   #1e2235;
        --elevated:     #1a1e2e;
        --border:       rgba(255,255,255,0.06);
        --border-mid:   rgba(255,255,255,0.1);
        --border-hover: rgba(249,115,22,0.55);
        --text:         #eceef5;
        --text-dim:     #9199b1;
        --muted:        #555e7a;
        --muted-fg:     #7880a0;
        --accent:       #f97316;
        --accent2:      #ea580c;
        --accent-pale:  rgba(249,115,22,0.1);
        --accent-mid:   rgba(249,115,22,0.4);
        --accent-glow:  rgba(249,115,22,0.28);
        --green:  #34d399; --green-bg:  rgba(52,211,153,0.12);
        --red:    #f87171; --red-bg:    rgba(248,113,113,0.12);
        --blue:   #60a5fa; --blue-bg:   rgba(96,165,250,0.12);
        --yellow: #fbbf24; --yellow-bg: rgba(251,191,36,0.12);
        --r-xs: 6px; --r-sm: 9px; --r-md: 13px; --r-lg: 18px; --r-xl: 24px; --r-2xl: 32px;
        --shadow-sm:   0 2px 8px rgba(0,0,0,0.4);
        --shadow-md:   0 6px 24px rgba(0,0,0,0.5);
        --shadow-lg:   0 16px 48px rgba(0,0,0,0.65);
        --shadow-glow: 0 8px 32px rgba(249,115,22,0.22);
        --ease-spring: cubic-bezier(0.16,1,0.3,1);
        --ease-out:    cubic-bezier(0,0,0.2,1);
        --t-fast:  140ms; --t-base: 260ms; --t-slow: 440ms;
      }

      [data-theme="light"] {
        --bg:#f0f2f8; --bg2:#e6e9f2; --bg3:#dde1ef;
        --card:#ffffff; --card2:#f4f5fb; --card-hover:#eceef8; --elevated:#f8f9fd;
        --border:rgba(0,0,0,0.07); --border-mid:rgba(0,0,0,0.12); --border-hover:rgba(249,115,22,0.5);
        --text:#0f1628; --text-dim:#3a4060; --muted:#9098b5; --muted-fg:#7880a0;
        --accent:#f97316; --accent2:#ea580c; --accent-pale:rgba(249,115,22,0.09);
        --shadow-sm:0 2px 8px rgba(0,0,0,0.07); --shadow-md:0 6px 24px rgba(0,0,0,0.1);
      }

      *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
      html { scroll-behavior:smooth; }
      body, #root {
        min-height:100vh; background:var(--bg); color:var(--text);
        font-family:var(--font-body); font-size:14px; line-height:1.5;
        -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale;
      }

      ::-webkit-scrollbar          { width:5px; height:5px; }
      ::-webkit-scrollbar-track    { background:transparent; }
      ::-webkit-scrollbar-thumb    { background:rgba(249,115,22,0.35); border-radius:99px; }
      ::-webkit-scrollbar-thumb:hover { background:rgba(249,115,22,0.6); }

      @keyframes fadeIn      { from{opacity:0}              to{opacity:1} }
      @keyframes fadeInUp    { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:none} }
      @keyframes fadeInDown  { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:none} }
      @keyframes slideInLeft { from{opacity:0;transform:translateX(-16px)} to{opacity:1;transform:none} }
      @keyframes scaleIn     { from{opacity:0;transform:scale(.94)} to{opacity:1;transform:none} }
      @keyframes spin        { to{transform:rotate(360deg)} }
      @keyframes pulse       { 0%,100%{opacity:1} 50%{opacity:.45} }
      @keyframes glow        { 0%,100%{box-shadow:0 0 8px rgba(249,115,22,0.3)} 50%{box-shadow:0 0 18px rgba(249,115,22,0.65)} }
      @keyframes shimmer     { 0%{background-position:-400% 0} 100%{background-position:400% 0} }
      @keyframes toastIn     { from{transform:translateX(110%);opacity:0} to{transform:none;opacity:1} }
      @keyframes dlIn        { from{opacity:0;transform:translateX(-12px) scale(.98)} to{opacity:1;transform:none} }
      @keyframes dlOut       { from{opacity:1;max-height:80px} to{opacity:0;max-height:0;margin:0;padding:0} }
      @keyframes bounceIn    { 0%{opacity:0;transform:scale(.5) translateY(20px)} 70%{transform:scale(1.05)} 100%{opacity:1;transform:none} }
      @keyframes progressPulse { 0%,100%{box-shadow:0 0 6px rgba(249,115,22,.4)} 50%{box-shadow:0 0 14px rgba(249,115,22,.8)} }
      ${Array.from({ length: 18 }, (_, i) => `.delay-${i}{animation-delay:${i * 45}ms}`).join(';')}

      .anim-fadeIn      { animation:fadeIn      var(--t-fast)  var(--ease-out) both }
      .anim-fadeInUp    { animation:fadeInUp    var(--t-base)  var(--ease-spring) both }
      .anim-slideLeft   { animation:slideInLeft var(--t-base)  var(--ease-spring) both }
      .anim-slideDown   { animation:fadeInDown  var(--t-fast)  var(--ease-spring) both }
      .anim-scaleIn     { animation:scaleIn     var(--t-base)  var(--ease-spring) both }
      .anim-spin        { animation:spin  .8s   linear         infinite }
      .anim-pulse       { animation:pulse 2s    ease           infinite }
      .anim-shimmer     {
        background:linear-gradient(90deg,rgba(255,255,255,0.02) 0%,rgba(255,255,255,0.07) 50%,rgba(255,255,255,0.02) 100%);
        background-size:400% 100%;
        animation:shimmer 2s linear infinite;
      }
      [data-theme="light"] .anim-shimmer {
        background:linear-gradient(90deg,rgba(0,0,0,0.04) 0%,rgba(0,0,0,0.08) 50%,rgba(0,0,0,0.04) 100%);
        background-size:400% 100%;
      }
      .dl-item  { animation:dlIn  .26s var(--ease-spring) both }
      .dl-out   { animation:dlOut .22s var(--ease-out)    both }
      .dl-bar-active { animation:progressPulse 1.6s ease-in-out infinite }
      .fab-back { animation:bounceIn .3s var(--ease-spring) both }
      .page-transition { animation:fadeInUp .28s var(--ease-spring) both }

      .glass       { background:rgba(17,18,28,0.82); backdrop-filter:blur(18px) saturate(1.6); border:1px solid var(--border); }
      .glass-strong{ background:rgba(9,10,17,0.97);  backdrop-filter:blur(28px) saturate(1.8); border-bottom:1px solid var(--border); }
      [data-theme="light"] .glass       { background:rgba(255,255,255,0.82); }
      [data-theme="light"] .glass-strong{ background:rgba(255,255,255,0.98); border-color:rgba(0,0,0,0.07); }

      .text-gradient {
        background:linear-gradient(135deg, var(--accent) 0%, #fb923c 45%, #fbbf24 100%);
        -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
      }
      .gradient-primary { background:linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%); }

      ::selection { background:rgba(249,115,22,0.22); color:inherit; }
      *:focus-visible { outline:2px solid var(--accent); outline-offset:2px; border-radius:4px; }
      .hover-lift { transition:transform var(--t-base) var(--ease-spring), box-shadow var(--t-base); }
      .hover-lift:hover { transform:translateY(-3px); box-shadow:var(--shadow-glow); }

      .nav-bar {
        position:absolute; left:0; top:50%; transform:translateY(-50%);
        width:3px; height:20px; background:var(--accent); border-radius:0 3px 3px 0;
        box-shadow:0 0 12px var(--accent), 0 0 24px rgba(249,115,22,0.2);
      }

      .toast-enter { animation:toastIn .38s var(--ease-spring) both }

      /* Improved Range Slider Styling for Settings & Reader */
      input[type="range"] {
        -webkit-appearance: none;
        appearance: none;
        background: transparent;
        cursor: pointer;
        width: 100%;
        margin: 10px 0;
      }
      input[type="range"]:focus {
        outline: none;
      }
      input[type="range"]::-webkit-slider-runnable-track {
        background: rgba(255,255,255,0.1);
        height: 10px;
        border-radius: 99px;
        border: 1px solid rgba(0,0,0,0.2);
      }
      input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        margin-top: -7px;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: var(--accent);
        border: 2px solid var(--bg);
        box-shadow: 0 0 12px var(--accent-glow), 0 2px 4px rgba(0,0,0,0.5);
        transition: transform 0.1s ease, box-shadow 0.1s ease;
      }
      input[type="range"]::-webkit-slider-thumb:hover {
        transform: scale(1.15);
        box-shadow: 0 0 16px var(--accent-glow), 0 4px 8px rgba(0,0,0,0.5);
      }
      input[type="range"]:active::-webkit-slider-thumb {
        transform: scale(1.05);
      }
      
      select option { background:#111520; color:var(--text); }
      [data-theme="light"] select option { background:#ffffff; color:#0f1628; }

      .ch-row { transition:background .14s; }
      .ch-row:hover { background:var(--card2) !important; }
      .ch-row:active { background:var(--elevated) !important; }

      .manga-card { transition:transform .22s var(--ease-spring), box-shadow .22s; }
      .manga-card:hover { transform:translateY(-5px) scale(1.03); box-shadow:0 18px 44px rgba(0,0,0,0.5), 0 0 0 1px rgba(249,115,22,0.15); }
      .manga-card:active { transform:translateY(-2px) scale(1.01); }

      @media (prefers-reduced-motion:reduce) { *, *::before, *::after { animation-duration:.01ms !important; transition-duration:.01ms !important; } }
    `;
    document.head.appendChild(style);

    document.title = 'akaReader';
    const fav = document.createElement('link');
    fav.rel = 'icon';
    fav.href = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%23f97316'/><path d='M8 8h10l6 6v10H8z' fill='white' opacity='.9'/><path d='M18 8v6h6' fill='none' stroke='white' stroke-width='1.5'/></svg>";
    document.head.appendChild(fav);
    return () => { document.head.removeChild(style); document.head.removeChild(fav); };
  }, []);
  return null;
});

const MangaDetailSkeleton = memo(() => (
  <div style={{ maxWidth: 840, margin: '0 auto', padding: '32px 20px 100px' }}>
    <div style={{ display: 'flex', gap: 28, marginBottom: 32, flexWrap: 'wrap' }}>
      <div className="anim-shimmer" style={{ width: 160, height: 240, borderRadius: 20, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 240, paddingTop: 4, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="anim-shimmer" style={{ height: 34, borderRadius: 10, width: '75%' }} />
        <div className="anim-shimmer" style={{ height: 18, borderRadius: 8, width: '40%' }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="anim-shimmer" style={{ height: 24, width: 80, borderRadius: 20 }} />
          <div className="anim-shimmer" style={{ height: 24, width: 100, borderRadius: 20 }} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[70, 55, 85, 65, 75].map((w, i) => <div key={i} className="anim-shimmer" style={{ height: 22, width: w, borderRadius: 20 }} />)}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <div className="anim-shimmer" style={{ height: 48, width: 160, borderRadius: 12 }} />
          <div className="anim-shimmer" style={{ height: 48, width: 140, borderRadius: 12 }} />
        </div>
      </div>
    </div>
    <div className="anim-shimmer" style={{ height: 100, borderRadius: 16, marginBottom: 24 }} />
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="anim-shimmer" style={{ height: 60, borderRadius: 12 }} />)}
    </div>
  </div>
));

// ==================== CONTEXT ====================

const ToastContext = createContext(null);
const ToastProvider = memo(({ children }) => {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);
  const timeoutIdsRef = useRef(new Set());
  const show = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++idRef.current;
    setToasts(p => [...p, { id, message, type }]);
    const timeoutId = setTimeout(() => {
      timeoutIdsRef.current.delete(timeoutId);
      setToasts(p => p.filter(t => t.id !== id));
    }, duration);
    timeoutIdsRef.current.add(timeoutId);
  }, []);
  useEffect(() => () => {
    timeoutIdsRef.current.forEach(clearTimeout);
    timeoutIdsRef.current.clear();
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div style={{ position: 'fixed', top: 90, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360, pointerEvents: 'none' }}>
        {toasts.map(t => (
          <div key={t.id} className="toast-enter" style={{
            padding: '14px 18px', borderRadius: 14, border: '1px solid var(--border)',
            background: 'rgba(22,22,31,0.98)', backdropFilter: 'blur(20px)',
            display: 'flex', alignItems: 'center', gap: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)', pointerEvents: 'auto'
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.type === 'success' ? '#4ade80' : t.type === 'error' ? '#f87171' : t.type === 'warning' ? '#facc15' : '#60a5fa', boxShadow: `0 0 10px ${t.type === 'success' ? '#4ade80' : t.type === 'error' ? '#f87171' : t.type === 'warning' ? '#facc15' : '#60a5fa'}` }} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
});
const useToast = () => useContext(ToastContext);

const getMangaKey = (id, sourceId) => {
  if (!id) return null;
  const sId = String(id);
  if (sId.includes('__')) return sId; // Already composite
  if (!sourceId) return sId; // Cannot make composite without sourceId
  return `${sourceId}__${id}`;
};

const DataProvider = memo(({ children }) => {
  const [backendOnline, setBackendOnlineRaw] = useState(null);
  const backendOnlineRef = useRef(null);
  const offlineTimer = useRef(null);
  const setBackendOnline = useCallback((val) => {
    if (val === false) {
      if (backendOnlineRef.current === true) {
        offlineTimer.current = offlineTimer.current || setTimeout(() => {
          backendOnlineRef.current = false;
          setBackendOnlineRaw(false);
          offlineTimer.current = null;
        }, 6000);
      } else {
        clearTimeout(offlineTimer.current);
        offlineTimer.current = null;
        backendOnlineRef.current = false;
        setBackendOnlineRaw(false);
      }
    } else {
      clearTimeout(offlineTimer.current);
      offlineTimer.current = null;
      backendOnlineRef.current = val;
      setBackendOnlineRaw(val);
    }
  }, []);

  const [sources, setSources] = useState({});
  const [extensions, setExtensions] = useState([]);
  const [library, setLibrary] = useState(() => storage.get('library', []));
  const [history, setHistory] = useState(() => storage.get('history', []));
  const [progress, setProgress] = useState(() => storage.get('progress', {}));
  const [mangaCategories, setMangaCategories] = useState(() => storage.get('mangaCategories', {}));
  const [categories, setCategories] = useState(() => storage.get('categories', DEFAULT_CATEGORIES));
  useEffect(() => storage.set('categories', categories), [categories]);
  const [readChapters, setReadChapters] = useState(() => storage.get('readChapters', {}));
  const [installing, setInstalling] = useState(new Set());
  const [readingTime, setReadingTime] = useState(() => storage.get('readingTime', {}));
  const [settings, setSettingsState] = useState(() => storage.get('appSettings', {
    readerMode: 'scroll', brightness: 100, fitMode: 'height', theme: 'dark',
    sidebarCollapsed: false, libraryView: 'grid', tagSearchMode: 'source', appTheme: 'dark'
  }));
  const [updates, setUpdates] = useState([]);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [suwayomiReady, setSuwayomiReady] = useState(false);
  const [downloadedKeys, setDownloadedKeys] = useState(new Set());

  const refreshDownloads = useCallback(async () => {
    try {
      const keys = await listDownloadedKeys();
      setDownloadedKeys(new Set(keys));
      window.dispatchEvent(new CustomEvent('downloads-updated'));
    } catch (e) { console.error('Failed to refresh downloads:', e); }
  }, []);

  useEffect(() => {
    refreshDownloads();
  }, [refreshDownloads]);

  const [downloadQueue, setDownloadQueue] = useState([]);
  const [overlayHidden, setOverlayHidden] = useState(false);
  const dlProcessingRef = useRef(false);
  const dlAbortRef = useRef(null);

  // Migration Effect: Convert old numeric ID keys to composite sourceId__id keys
  useEffect(() => {
    const migrationDone = storage.get('keyMigrationV2', false);
    if (migrationDone) return;

    const idToSource = new Map();
    library.forEach(m => idToSource.set(String(m.id), String(m.sourceId)));
    history.forEach(m => idToSource.set(String(m.id), String(m.sourceId)));

    const migrateObj = (obj) => {
      const next = { ...obj };
      let changed = false;
      Object.keys(obj).forEach(key => {
        if (!key.includes('__') && idToSource.has(key)) {
          const newKey = `${idToSource.get(key)}__${key}`;
          next[newKey] = obj[key];
          delete next[key];
          changed = true;
        }
      });
      return changed ? next : null;
    };

    const newProgress = migrateObj(progress);
    if (newProgress) setProgress(newProgress);

    const newRead = migrateObj(readChapters);
    if (newRead) setReadChapters(newRead);

    const newCats = migrateObj(mangaCategories);
    if (newCats) setMangaCategories(newCats);

    const newTime = migrateObj(readingTime);
    if (newTime) setReadingTime(newTime);

    storage.set('keyMigrationV2', true);
  }, [library, history]);

  const toastRef = useRef(null);
  toastRef.current = useToast();
  const sourcesRef = useRef({});
  const extRef = useRef([]);
  const sourcesRequestRef = useRef(null);
  const extensionsRequestRef = useRef(null);

  useEffect(() => storage.set('library', library), [library]);
  useEffect(() => storage.set('history', history), [history]);
  useEffect(() => storage.set('progress', progress), [progress]);
  useEffect(() => storage.set('mangaCategories', mangaCategories), [mangaCategories]);
  useEffect(() => storage.set('readChapters', readChapters), [readChapters]);
  useEffect(() => storage.set('readingTime', readingTime), [readingTime]);
  useEffect(() => storage.set('appSettings', settings), [settings]);

  const fetchJSON = useCallback(async (url, opts = {}, retries = 2) => {
    let lastErr;
    for (let i = 0; i <= retries; i++) {
      try {
        const r = await fetch(`${CONFIG.API}${url}`, { ...opts, headers: { 'Content-Type': 'application/json', ...opts.headers } });
        if (!r.ok) throw new Error(await r.text());
        return await r.json();
      } catch (e) {
        lastErr = e;
        if (opts.signal?.aborted) throw e;
        if (i < retries) await new Promise(r => setTimeout(r, 500 * (i + 1)));
      }
    }
    throw lastErr;
  }, []);

  const checkHealth = useCallback(async () => {
    try {
      const d = await fetchJSON('/health');
      setBackendOnline(d.ok);
      if (d.ok && d.suwayomi !== undefined) setSuwayomiReady(d.suwayomi);
    }
    catch {
      setBackendOnline(false);
      setSuwayomiReady(false);
    }
  }, [fetchJSON]);

  const fetchSources = useCallback(async (force = false) => {
    if (sourcesRequestRef.current && !force) return sourcesRequestRef.current;
    const run = async () => {
      try {
        const data = await fetchJSON(`/sources${force ? '?force=1' : ''}`);
        if (!Array.isArray(data)) return {};
        const map = {};
        data.forEach(s => {
          map[String(s.id)] = {
            id: String(s.id),
            name: s.displayName || s.name,
            displayName: s.displayName || s.name,
            baseName: s.name || s.displayName || 'Source',
            lang: s.lang,
            // Source icons render faster when loaded directly instead of being proxied through the backend.
            icon: directSuwayomiAsset(s.icon || s.iconUrl),
          };
        });
        if (JSON.stringify(map) !== JSON.stringify(sourcesRef.current)) { sourcesRef.current = map; setSources(map); }
        return map;
      } catch {
        return {};
      }
    };
    const sharedRequest = run();
    sourcesRequestRef.current = sharedRequest;
    sharedRequest.finally(() => {
      if (sourcesRequestRef.current === sharedRequest) sourcesRequestRef.current = null;
    });
    return sharedRequest;
  }, [fetchJSON]);

  const fetchExtensions = useCallback(async (force = false) => {
    if (extensionsRequestRef.current && !force) return extensionsRequestRef.current;
    const run = async () => {
      try {
        const data = await fetchJSON(`/extensions${force ? '?force=1' : ''}`);
        if (!Array.isArray(data)) return [];
        const normalized = data.map(e => ({
          ...e,
          pkgName: e.pkgName || e.id,
          isInstalled: e.isInstalled ?? e.installed ?? false,
          isNsfw: e.isNsfw ?? e.nsfw ?? false,
          versionName: e.versionName || e.version || '1.0.0',
          versionCode: e.versionCode || 1,
          hasUpdate: e.hasUpdate ?? false,
          // Extension icons don't need the extra proxy hop for normal <img> rendering.
          iconUrl: directSuwayomiAsset(e.iconUrl),
        }));
        if (JSON.stringify(normalized) !== JSON.stringify(extRef.current)) { extRef.current = normalized; setExtensions(normalized); }
        return normalized;
      } catch {
        return [];
      }
    };
    const sharedRequest = run();
    extensionsRequestRef.current = sharedRequest;
    sharedRequest.finally(() => {
      if (extensionsRequestRef.current === sharedRequest) extensionsRequestRef.current = null;
    });
    return sharedRequest;
  }, [fetchJSON]);

  const installExt = useCallback(async (pkgName) => {
    setInstalling(s => new Set([...s, pkgName]));
    try {
      await fetchJSON(`/extensions/install/${encodeURIComponent(pkgName)}`, { method: 'POST' });
      const exts = await fetchExtensions(true);
      await fetchSources(true);
      const found = exts.find(e => e.pkgName === pkgName || e.id === pkgName);
      toastRef.current?.(`${found?.name || pkgName} installed`, 'success');
    } catch (e) { toastRef.current?.(`Install failed: ${e.message}`, 'error'); }
    finally { setInstalling(s => { const n = new Set(s); n.delete(pkgName); return n; }); }
  }, [fetchJSON, fetchExtensions, fetchSources]);

  const uninstallExt = useCallback(async (pkgName) => {
    setInstalling(s => new Set([...s, pkgName]));
    try {
      const result = await fetchJSON(`/extensions/uninstall/${encodeURIComponent(pkgName)}`, { method: 'POST' });
      await fetchExtensions(true);
      await fetchSources(true);
      const removedCount = Array.isArray(result?.removedFiles) ? result.removedFiles.length : 0;
      toastRef.current?.(removedCount ? `Extension removed (${removedCount} leftover file${removedCount === 1 ? '' : 's'} cleaned)` : 'Extension removed', 'warning');
    }
    catch (e) { toastRef.current?.(`Uninstall failed: ${e.message}`, 'error'); }
    finally { setInstalling(s => { const n = new Set(s); n.delete(pkgName); return n; }); }
  }, [fetchJSON, fetchExtensions, fetchSources]);

  const updateExt = useCallback(async (pkgName) => {
    setInstalling(s => new Set([...s, pkgName]));
    try { await fetchJSON(`/extensions/update/${encodeURIComponent(pkgName)}`, { method: 'POST' }); await fetchExtensions(true); await fetchSources(true); toastRef.current?.('Extension updated', 'success'); }
    catch (e) { toastRef.current?.(`Update failed: ${e.message}`, 'error'); }
    finally { setInstalling(s => { const n = new Set(s); n.delete(pkgName); return n; }); }
  }, [fetchJSON, fetchExtensions, fetchSources]);

  const toggleLibrary = useCallback((manga, sourceId) => {
    setLibrary(prev => {
      const exists = prev.find(m => String(m.id) === String(manga.id) && String(m.sourceId) === String(sourceId));
      if (exists) {
        toastRef.current?.('Removed from library', 'warning');
        return prev.filter(m => !(String(m.id) === String(manga.id) && String(m.sourceId) === String(sourceId)));
      }
      toastRef.current?.('Added to library', 'success');
      return [{ id: manga.id, title: manga.title, cover: manga.cover, sourceId, addedAt: Date.now() }, ...prev];
    });
  }, []);


  const addCategory = useCallback((name, color) => {
    const id = name.toLowerCase().replace(/\s+/g, '_');
    if (categories.find(c => c.id === id)) return toastRef.current?.('Category already exists', 'error');
    setCategories(prev => [...prev, { id, name, color: color || '#f97316' }]);
    toastRef.current?.('Category created', 'success');
  }, [categories]);

  const removeCategory = useCallback((id) => {
    if (DEFAULT_CATEGORIES.some(c => c.id === id)) return toastRef.current?.('Cannot delete default categories', 'error');
    setCategories(prev => prev.filter(c => c.id !== id));
    toastRef.current?.('Category removed', 'warning');
  }, []);

  const addToHistory = useCallback((manga, sourceId, details) => {
    setHistory(prev => {
      const filtered = prev.filter(m => !(String(m.id) === String(manga.id) && String(m.sourceId) === String(sourceId)));
      return [{ id: manga.id, title: details?.title || manga.title, cover: details?.cover || manga.cover, sourceId, author: details?.author, lastRead: Date.now() }, ...filtered].slice(0, 100);
    });
  }, []);

  const removeFromHistory = useCallback((mangaId, sourceId) => {
    setHistory(prev => prev.filter(m => !(String(m.id) === String(mangaId) && String(m.sourceId) === String(sourceId))));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const removeMangaCompletely = useCallback((mangaId, sourceId) => {
    const key = String(mangaId);
    const srcId = String(sourceId);
    const mKey = getMangaKey(mangaId, sourceId);
    setLibrary(prev => prev.filter(m => !(String(m.id) === key && String(m.sourceId) === srcId)));
    setHistory(prev => prev.filter(m => !(String(m.id) === key && String(m.sourceId) === srcId)));
    setProgress(prev => {
      const next = { ...prev };
      delete next[mKey];
      return next;
    });
    setMangaCategories(prev => {
      const next = { ...prev };
      delete next[mKey];
      return next;
    });
    setReadChapters(prev => {
      const next = { ...prev };
      delete next[mKey];
      return next;
    });
    setReadingTime(prev => {
      const next = { ...prev };
      delete next[mKey];
      return next;
    });
    deleteAllChapterBlobsForManga(mKey).then(refreshDownloads);
  }, [getMangaKey, refreshDownloads]);

  const updateProgress = useCallback((mangaId, chapterId, chapterNum, page, sourceId) => {
    if (!mangaId) return;
    const key = getMangaKey(mangaId, sourceId);
    const now = Date.now();
    setProgress(prev => {
      const current = prev[key];
      if (
        current?.chapterId === chapterId &&
        current?.chapterNum === chapterNum &&
        current?.page === page &&
        now - (current?.lastRead || 0) < 2000
      ) {
        return prev;
      }
      return { ...prev, [key]: { chapterId, chapterNum, page, lastRead: now } };
    });
    setHistory(prev => prev.map(m => getMangaKey(m.id, m.sourceId) === key ? { ...m, lastRead: now } : m));
    setLibrary(prev => prev.map(m => getMangaKey(m.id, m.sourceId) === key ? { ...m, lastRead: now } : m));
  }, []);

  const markChapterRead = useCallback((mangaId, chapterId, isRead = true, sourceId) => {
    if (!mangaId || !chapterId) return;
    setReadChapters(prev => {
      const key = getMangaKey(mangaId, sourceId);
      const current = new Set(prev[key] || []);
      if (isRead) current.add(String(chapterId));
      else current.delete(String(chapterId));
      return { ...prev, [key]: [...current] };
    });

    if (isRead && settings?.autoDeleteRead) {
      deleteChapterBlobs(getMangaKey(mangaId, sourceId), chapterId).then(refreshDownloads);
    }
  }, [settings?.autoDeleteRead, getMangaKey, refreshDownloads]);

  const addReadingTime = useCallback((mangaId, seconds, sourceId) => {
    if (!mangaId || seconds <= 0) return;
    const key = getMangaKey(mangaId, sourceId);
    setReadingTime(prev => ({ ...prev, [key]: (prev[key] || 0) + seconds }));
  }, []);

  const updateSetting = useCallback((key, value) => {
    setSettingsState(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleMigrate = useCallback(async (oldManga, newItem, newSource) => {
    try {
      const newMangaDetail = await fetchJSON(`/source/${newSource.id}/manga/${newItem.id}`);
      if (!newMangaDetail || newMangaDetail.error) throw new Error('Failed to fetch new manga details');

      const oldKey = getMangaKey(oldManga.id, oldManga.sourceId);
      const newKey = getMangaKey(newItem.id, newSource.id);

      // 1. Progress
      const oldProg = progress[oldKey];
      if (oldProg) {
        const newCh = newMangaDetail.chapters.find(c => String(c.number) === String(oldProg.chapterNum));
        if (newCh) setProgress(prev => ({ ...prev, [newKey]: { chapterId: newCh.id, chapterNum: newCh.number, page: oldProg.page, lastRead: Date.now() } }));
      }

      // 2. Library
      const libEntry = library.find(m => String(m.id) === String(oldManga.id) && String(m.sourceId) === String(oldManga.sourceId));
      if (libEntry) {
        const cat = mangaCategories[oldKey];
        setLibrary(prev => {
          const filtered = prev.filter(m => !(String(m.id) === String(oldManga.id) && String(m.sourceId) === String(oldManga.sourceId)));
          return [{ id: newItem.id, title: newItem.title, cover: newItem.cover, sourceId: newSource.id, addedAt: libEntry.addedAt }, ...filtered];
        });
        if (cat) setMangaCategories(prev => ({ ...prev, [newKey]: cat }));
      }

      // 3. History
      setHistory(prev => {
        const filtered = prev.filter(m => !(String(m.id) === String(oldManga.id) && String(m.sourceId) === String(oldManga.sourceId)));
        return [{ id: newItem.id, title: newMangaDetail.title, cover: newMangaDetail.cover, sourceId: newSource.id, author: newMangaDetail.author, lastRead: Date.now() }, ...filtered];
      });

      // 4. Cleanup
      setMangaCategories(prev => { const n = { ...prev }; delete n[oldKey]; return n; });
      setProgress(prev => { const n = { ...prev }; delete n[oldKey]; return n; });
      setReadChapters(prev => { const n = { ...prev }; delete n[oldKey]; return n; });

      return true;
    } catch (e) {
      return false;
    }
  }, [fetchJSON, progress, library, mangaCategories, getMangaKey]);

  const updateToastedRef = useRef(false);
  const cancelDownload = useCallback((id) => {
    setDownloadQueue(prev => prev.map(d => {
      if (d.id !== id) return d;
      if (d.status === 'downloading') dlAbortRef.current?.abort();
      return (d.status === 'pending' || d.status === 'downloading') ? { ...d, status: 'cancelled' } : d;
    }));
  }, []);

  const cancelActiveDownloads = useCallback(() => {
    dlAbortRef.current?.abort();
    setDownloadQueue(prev => prev.map(d =>
      (d.status === 'pending' || d.status === 'downloading') ? { ...d, status: 'cancelled' } : d
    ));
  }, []);

  const queueChaptersForDownload = useCallback((chapters, mangaId, mangaTitle, sourceId) => {
    const sorted = [...chapters].sort((a, b) => parseFloat(a.number) - parseFloat(b.number));
    const mangaKey = getMangaKey(mangaId, sourceId);
    const newItems = sorted.map(ch => ({
      id: `${mangaId}__${ch.id}__${Date.now()}_${Math.random()}`,
      mangaId, mangaTitle, chapterId: ch.id, chapterNum: ch.number, sourceId,
      downloadKey: getDownloadKey(mangaKey, ch.id),
      status: 'pending', progress: 0, pagesLoaded: 0, pagesTotal: 0, error: null
    }));
    setDownloadQueue(prev => {
      const existing = new Set(prev
        .filter(d => d.status !== 'error' && d.status !== 'cancelled')
        .map(d => d.downloadKey || getDownloadKey(getMangaKey(d.mangaId, d.sourceId), d.chapterId)));
      const toAdd = newItems.filter(item => !existing.has(item.downloadKey));
      if (!toAdd.length) { toastRef.current?.('All selected chapters already queued or downloaded', 'warning'); return prev; }
      toastRef.current?.(`Queued ${toAdd.length} chapters for download`, 'info');
      return [...prev, ...toAdd];
    });
  }, [getMangaKey]);
  useEffect(() => {
    if (dlProcessingRef.current) return;
    const pending = downloadQueue.find(d => d.status === 'pending');
    if (!pending) return;
    dlProcessingRef.current = true;
    dlAbortRef.current?.abort();
    const ac = new AbortController();
    dlAbortRef.current = ac;

    setDownloadQueue(prev => prev.map(d => d.id === pending.id ? { ...d, status: 'downloading', progress: 0, pagesLoaded: 0, pagesTotal: 0 } : d));

    (async () => {
      try {
        const imgs = await fetchJSON(`/source/${pending.sourceId}/chapter/${pending.chapterId}`, { signal: ac.signal });
        const urls = Array.isArray(imgs) ? imgs : [];
        if (!urls.length) throw new Error('No pages found');
        setDownloadQueue(prev => prev.map(d => d.id === pending.id ? { ...d, pagesTotal: urls.length } : d));
        const blobs = await fetchPageBlobs(urls, ac.signal, (done) => {
          const pct = Math.round(done / urls.length * 100);
          setDownloadQueue(prev => prev.map(d => d.id === pending.id ? { ...d, progress: pct, pagesLoaded: done } : d));
        });
        await saveChapterBlobs(getMangaKey(pending.mangaId, pending.sourceId), pending.chapterId, blobs);
        await refreshDownloads();
        setDownloadQueue(prev => prev.map(d => d.id === pending.id ? { ...d, status: 'done', progress: 100 } : d));
        toastRef.current?.(`Ch. ${pending.chapterNum} of "${pending.mangaTitle}" saved`, 'success');
      } catch (e) {
        if (ac.signal.aborted) {
          setDownloadQueue(prev => prev.map(d => d.id === pending.id && d.status !== 'done' ? { ...d, status: 'cancelled' } : d));
        } else {
          setDownloadQueue(prev => prev.map(d => d.id === pending.id ? { ...d, status: 'error', error: e.message } : d));
        }
      } finally {
        if (dlAbortRef.current === ac) {
          dlAbortRef.current = null;
        }
        dlProcessingRef.current = false;
      }
    })();
  }, [downloadQueue, fetchJSON, getMangaKey, refreshDownloads]);
  useEffect(() => () => dlAbortRef.current?.abort(), []);

  const checkForUpdates = useCallback(async () => {
    if (library.length === 0) return;
    setCheckingUpdates(true);
    try {
      const scanResults = await mapWithConcurrency(library, UPDATE_SCAN_CONCURRENCY, async (manga) => {
        try {
          const source = sources[manga.sourceId];
          if (!source) return null;
          const data = await fetchJSON(`/source/${source.id}/manga/${manga.id}`);
          if (data.error) return null;
          const currentTotal = data.totalChapters;
          const mKey = getMangaKey(manga.id, manga.sourceId);
          const savedProgress = progress[mKey];
          const lastReadChapter = savedProgress ? parseInt(savedProgress.chapterNum) : 0;
          if (currentTotal > lastReadChapter) {
            return { ...manga, newChapters: currentTotal - lastReadChapter };
          }
        } catch (e) {
          // Ignore individual source failures so one broken extension does not block the update scan.
        }
        return null;
      });
      setUpdates(scanResults.filter(Boolean));
    } finally {
      setCheckingUpdates(false);
    }
  }, [library, sources, fetchJSON, progress, getMangaKey]);

  useEffect(() => {
    if (library.length > 0 && backendOnline) {
      checkForUpdates();
      const interval = setInterval(checkForUpdates, CONFIG.UPDATE_INTERVAL);
      return () => clearInterval(interval);
    }
  }, [library, backendOnline, checkForUpdates]);

  useEffect(() => {
    checkHealth();
    const fastPoll = setInterval(() => {
      if (backendOnlineRef.current === null) checkHealth();
      else clearInterval(fastPoll);
    }, 1000);
    const slowPoll = setInterval(checkHealth, 30000);
    return () => { clearInterval(fastPoll); clearInterval(slowPoll); };
  }, [checkHealth]);

  useEffect(() => {
    if (!suwayomiReady) return;
    fetchSources();
    fetchExtensions();
  }, [suwayomiReady, fetchSources, fetchExtensions]);

  // Removed destructive cleanup effect that deleted manga when sources were temporarily offline

  const setCategory = useCallback((mangaId, categoryId, sourceId) => {
    const key = getMangaKey(mangaId, sourceId);
    setMangaCategories(prev => ({ ...prev, [key]: categoryId }));
    toastRef.current?.(`Moved to ${categories.find(c => c.id === categoryId)?.name || 'category'}`, 'success');
  }, [categories]);

  const value = useMemo(() => ({
    backendOnline, sources, extensions, library, history, progress,
    mangaCategories, installing, readingTime, settings, updates, checkingUpdates,
    readChapters, suwayomiReady, setSuwayomiReady,
    downloadQueue, setDownloadQueue, overlayHidden, setOverlayHidden,
    fetchJSON, checkHealth, fetchSources, fetchExtensions,
    installExt, uninstallExt, updateExt,
    toggleLibrary, setCategory, addToHistory, removeFromHistory, clearHistory, removeMangaCompletely,
    updateProgress, markChapterRead, addReadingTime, updateSetting, checkForUpdates, handleMigrate,
    queueChaptersForDownload, cancelDownload, cancelActiveDownloads,
    addCategory, removeCategory, categories,
    getMangaKey, downloadedKeys, refreshDownloads,
    inLibrary: (id, sourceId) => library.some(m => String(m.id) === String(id) && (sourceId ? String(m.sourceId) === String(sourceId) : true))
  }), [backendOnline, sources, extensions, library, history, progress, mangaCategories, installing, readingTime, settings, updates, checkingUpdates, readChapters, suwayomiReady, setSuwayomiReady, downloadQueue, overlayHidden, fetchJSON, checkHealth, fetchSources, fetchExtensions, installExt, uninstallExt, updateExt, toggleLibrary, setCategory, addToHistory, removeFromHistory, removeMangaCompletely, updateProgress, markChapterRead, addReadingTime, updateSetting, checkForUpdates, handleMigrate, queueChaptersForDownload, cancelDownload, cancelActiveDownloads, addCategory, removeCategory, categories, downloadedKeys, refreshDownloads]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
});
// ==================== UI PRIMITIVES ====================

const SPIN_SIZES = { sm: 14, md: 24, lg: 40, xl: 48 };
const Spin = memo(({ size = 24, color = 'var(--accent)', style }) => {
  const resolvedSize = typeof size === 'number' ? size : (SPIN_SIZES[size] || SPIN_SIZES.md);
  return <Loader2 size={resolvedSize} className="anim-spin" style={{ width: resolvedSize, height: resolvedSize, flexShrink: 0, color, ...style }} />;
});

const Btn = memo(({ children, variant = 'default', size = 'md', onClick, disabled, className = '', style = {}, icon: Icon, type = 'button', title }) => {
  const base = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'system-ui,-apple-system,Segoe UI,sans-serif', fontWeight: 600, borderRadius: 12, whiteSpace: 'nowrap', opacity: disabled ? 0.4 : 1, position: 'relative', overflow: 'hidden', transition: 'all var(--t-fast) var(--ease-out)' };
  const sizes = { sm: { padding: '7px 14px', fontSize: 12, height: 32 }, md: { padding: '10px 20px', fontSize: 13, height: 40 }, lg: { padding: '14px 28px', fontSize: 14, height: 48 }, icon: { padding: 10, borderRadius: 12, width: 40, height: 40 } };
  const variants = {
    default: { background: 'linear-gradient(135deg,var(--accent) 0%,var(--accent2) 100%)', color: '#fff', boxShadow: '0 4px 16px rgba(249,115,22,0.3)' },
    outline: { background: 'transparent', color: 'var(--text-dim)', border: '1.5px solid var(--border)' },
    ghost: { background: 'transparent', color: 'var(--text-dim)' },
    secondary: { background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)' },
    danger: { background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1.5px solid rgba(239,68,68,0.2)' },
    success: { background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1.5px solid rgba(34,197,94,0.2)' },
  };
  return (
    <button type={type} title={title} style={{ ...base, ...(sizes[size] || sizes.md), ...(variants[variant] || variants.default), ...style }} disabled={disabled} onClick={onClick} className={className}
      onMouseEnter={e => { if (!disabled && variant === 'default') { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(249,115,22,0.4)'; } else if (!disabled) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; } }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = variant === 'default' ? '0 4px 16px rgba(249,115,22,0.3)' : ''; e.currentTarget.style.background = variants[variant]?.background || 'transparent'; }}
    >
      {Icon && <Icon size={size === 'sm' ? 14 : size === 'icon' ? 18 : 16} />}
      {children}
    </button>
  );
});

const Badge = memo(({ children, variant = 'default', size = 'md', onClick, style }) => {
  const styles = {
    default: { background: 'rgba(249,115,22,0.15)', color: 'var(--accent)', border: '1px solid rgba(249,115,22,0.25)' },
    success: { background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' },
    destructive: { background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' },
    outline: { background: 'transparent', color: 'var(--muted-fg)', border: '1px solid var(--border)' },
    update: { background: 'rgba(234,179,8,0.12)', color: '#facc15', border: '1px solid rgba(234,179,8,0.2)' },
    installing: { background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' },
    nsfw: { background: 'rgba(236,72,153,0.15)', color: '#f472b6', border: '1px solid rgba(236,72,153,0.25)' },
  };
  const sizes = { sm: { padding: '1px 6px', fontSize: 9, borderRadius: 4 }, md: { padding: '3px 10px', fontSize: 10, borderRadius: 6 }, lg: { padding: '4px 12px', fontSize: 11, borderRadius: 8 } };
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', ...(styles[variant] || styles.default), ...(sizes[size] || sizes.md), ...style }} onClick={onClick}>{children}</span>;
});

const EmptyState = memo(({ icon: Icon, title, sub, action, compact }) => (
  <div className="anim-fadeIn" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: compact ? '40px 24px' : '80px 24px', gap: compact ? 12 : 20 }}>
    <div style={{ width: compact ? 56 : 88, height: compact ? 56 : 88, borderRadius: compact ? 16 : 24, background: 'linear-gradient(135deg,var(--card),var(--card2))', border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
      <Icon size={compact ? 24 : 36} style={{ opacity: 0.6 }} />
    </div>
    <div>
      <p style={{ fontFamily: "'Segoe UI Variable Display','Segoe UI Variable','Segoe UI',system-ui,-apple-system,sans-serif", fontWeight: 700, fontSize: compact ? 15 : 20, color: 'var(--text)', marginBottom: compact ? 4 : 8 }}>{title}</p>
      {sub && <p style={{ color: 'var(--muted)', fontSize: compact ? 12 : 14, maxWidth: 360, lineHeight: 1.7 }}>{sub}</p>}
    </div>
    {action && <div style={{ marginTop: compact ? 8 : 12 }}>{action}</div>}
  </div>
));

const ContextMenu = memo(({ x, y, items, onClose }) => {
  useEffect(() => {
    const h = () => onClose();
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [onClose]);
  return (
    <div className="anim-fadeIn" style={{ position: 'fixed', left: x, top: y, background: 'rgba(22,22,31,0.98)', backdropFilter: 'blur(20px)', border: '1px solid var(--border)', borderRadius: 12, padding: 6, minWidth: 180, zIndex: 10000, boxShadow: '0 16px 48px rgba(0,0,0,0.4)' }}>
      {items.map((item, i) => (
        <button key={i} onClick={() => { item.action(); onClose(); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, border: 'none', background: 'transparent', color: item.danger ? '#f87171' : 'var(--text)', fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.background = item.danger ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.06)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          {item.icon && <item.icon size={16} style={{ color: item.danger ? '#f87171' : 'var(--muted)' }} />}
          {item.label}
        </button>
      ))}
    </div>
  );
});

// ==================== MANGA CARD ====================

const MangaCard = memo(({ manga, onClick, index = 0, badge, progress: manualProgress, category: manualCategory, onContextMenu, eager = false }) => {
  const [loaded, setLoaded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [inView, setInView] = useState(eager);
  const cardRef = useRef(null);

  const { categories, progress, mangaCategories, getMangaKey, downloadedKeys } = useData();
  const mKey = getMangaKey(manga.id, manga.sourceId);

  const prog = manualProgress !== undefined ? manualProgress : (manga.totalChapters && progress[mKey] ? (parseInt(progress[mKey].chapterNum) / manga.totalChapters) * 100 : 0);
  const category = manualCategory !== undefined ? manualCategory : mangaCategories[mKey];
  const categoryColor = useMemo(() => categories.find(c => c.id === category)?.color, [category, categories]);

  useEffect(() => {
    if (eager) return;
    const observer = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); observer.disconnect(); } }, { rootMargin: '100px' });
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [eager]);

  const handleContextMenu = useCallback((e) => { e.preventDefault(); onContextMenu?.(e, manga); }, [manga, onContextMenu]);

  const hasOfflineCopy = useMemo(() => {
    return Array.from(downloadedKeys).some(k => k.startsWith(`${mKey}___`));
  }, [downloadedKeys, mKey]);

  return (
    <div
      ref={cardRef}
      className={`card-hover anim-fadeInUp delay-${Math.min(index, 14)}`}
      style={{ cursor: 'pointer', position: 'relative', userSelect: 'none' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onClick(manga)}
      onContextMenu={handleContextMenu}
    >
      {categoryColor && (
        <div style={{ position: 'absolute', top: 8, left: 8, width: 4, height: 32, background: categoryColor, borderRadius: 2, zIndex: 3, boxShadow: `0 0 10px ${categoryColor}80` }} />
      )}
      {badge && (
        <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 3, background: 'rgba(249,115,22,0.95)', color: '#fff', padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, backdropFilter: 'blur(8px)', boxShadow: '0 4px 12px rgba(249,115,22,0.3)' }}>
          {badge}
        </div>
      )}
      {hasOfflineCopy && !badge && (
        <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 3, background: 'rgba(34,197,94,0.9)', color: '#fff', padding: '4px 8px', borderRadius: 8, fontSize: 9, fontWeight: 800, backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', gap: 4, border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#fff' }} /> OFFLINE
        </div>
      )}
      <div style={{
        aspectRatio: '2/3', borderRadius: 16, overflow: 'hidden', marginBottom: 10,
        border: `1.5px solid ${hovered ? 'var(--border-hover)' : 'var(--border)'}`,
        background: 'var(--card)', position: 'relative', transition: 'all var(--t-slow) var(--ease-spring)',
        boxShadow: hovered ? '0 20px 40px -12px rgba(249,115,22,0.2)' : '0 4px 12px rgba(0,0,0,0.2)'
      }}>
        {!loaded && !imageError && inView && <div className="anim-shimmer" style={{ position: 'absolute', inset: 0, zIndex: 1 }} />}
        {inView && manga.cover && !imageError ? (
          <img src={proxyImg(manga.cover)} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: hovered ? 'scale(1.07)' : 'scale(1)', transition: 'transform 0.6s cubic-bezier(0.16,1,0.3,1)', opacity: loaded ? 1 : 0 }} alt={manga.title} loading="lazy" onLoad={() => setLoaded(true)} onError={() => setImageError(true)} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,var(--card),var(--card2))', gap: 10 }}>
            <BookOpen size={32} style={{ color: 'var(--muted)', opacity: 0.4 }} />
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>No cover</span>
          </div>
        )}

        {prog > 0 && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'rgba(0,0,0,0.5)', zIndex: 4 }}>
            <div style={{ width: `${Math.min(prog, 100)}%`, height: '100%', background: 'linear-gradient(90deg,var(--accent),#fb923c)', boxShadow: '0 0 8px rgba(249,115,22,0.6)', transition: 'width 0.5s' }} />
          </div>
        )}
      </div>
      <p style={{ fontSize: 13, fontWeight: 600, color: hovered ? 'var(--text)' : 'var(--text-dim)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', transition: 'color 0.2s', minHeight: 36 }}>
        {manga.title}
      </p>
      {manga.author && (
        <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {manga.author}
        </p>
      )}
    </div>
  );
});

const MangaListCard = memo(({ manga, onClick, category, progress: prog, onContextMenu }) => {
  const [imageError, setImageError] = useState(false);
  const { categories } = useData();
  const categoryColor = useMemo(() => categories.find(c => c.id === category)?.color, [category, categories]);
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

const ExtCard = memo(({ ext, onInstall, onUninstall, installing, onUpdate }) => {
  const isInstalling = installing.has(ext.pkgName);
  const isInstalled = ext.isInstalled;
  const hasUpdate = ext.hasUpdate;
  const toast = useToast();

  return (
    <div className="hover-lift" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', borderRadius: 16, background: 'var(--card)', border: `1.5px solid ${isInstalled ? 'rgba(34,197,94,0.2)' : 'var(--border)'}`, transition: 'all 0.3s', position: 'relative', overflow: 'hidden' }}>
      {isInstalled && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,rgba(34,197,94,0.03),transparent)', pointerEvents: 'none' }} />}
      <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--card2)', border: '1.5px solid var(--border)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
        {(ext.icon || ext.iconUrl) ? <img src={ext.icon || ext.iconUrl} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }} onError={e => e.target.style.display = 'none'} alt="" loading="lazy" /> : <Globe size={22} style={{ color: 'var(--muted)' }} />}
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
          <span style={{ color: 'var(--border)' }}>•</span>
          <span style={{ fontSize: 12, color: 'var(--muted-fg)' }}>v{ext.versionName || ext.versionCode}</span>
          {isInstalled && <><span style={{ color: 'var(--border)' }}>•</span><span style={{ fontSize: 12, color: '#4ade80', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}><Check size={12} />Active</span></>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {hasUpdate && isInstalled && !isInstalling && <Btn variant="success" size="sm" onClick={() => { onUpdate?.(ext.pkgName); toast?.(`Updating ${ext.name}...`, 'info'); }}><RefreshCw size={13} /> Update</Btn>}
        <Btn variant={isInstalled ? 'outline' : 'default'} size="sm" disabled={isInstalling} onClick={() => {
          if (isInstalling) return;
          if (isInstalled) { onUninstall(ext.pkgName); toast?.(`Removing ${ext.name}...`, 'warning'); }
          else { onInstall(ext.pkgName); toast?.(`Installing ${ext.name}...`, 'info'); }
        }}>
          {isInstalling ? <><Spin size={14} /><span style={{ marginLeft: 6 }}>...</span></> : isInstalled ? <><Trash2 size={14} /> Remove</> : <><Download size={14} /> Install</>}
        </Btn>
      </div>
    </div>
  );
});

const RepoAddRow = memo(({ onAdd }) => {
  const [val, setVal] = useState('');
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <div style={{ position: 'relative', flex: 1 }}>
        <Globe size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
        <input
          placeholder="https://raw.githubusercontent.com/.../index.min.json"
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && val.trim()) { onAdd(val.trim()); setVal(''); } }}
          style={{ width: '100%', background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '11px 14px 11px 36px', color: 'var(--text)', fontSize: 12, outline: 'none', fontFamily: 'monospace', transition: 'border-color 0.2s' }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
      </div>
      <Btn variant="default" size="sm" onClick={() => { if (val.trim()) { onAdd(val.trim()); setVal(''); } }}>Add</Btn>
    </div>
  );
});

// ==================== SETTINGS PAGE ====================

const SettingsPage = memo(() => {
  const {
    settings, updateSetting, backendOnline, checkHealth, library, history,
    progress, readingTime, sources, extensions, fetchSources, fetchExtensions,
    suwayomiReady, categories, addCategory, removeCategory, getMangaKey
  } = useData();
  const toast = useToast();
  const [confirmClear, setConfirmClear] = useState(null);
  const [serviceStatus, setServiceStatus] = useState(null);
  const [serviceWorking, setServiceWorking] = useState(false);
  const [runtimeInfo, setRuntimeInfo] = useState({ javaPath: '', jarPath: '', configPath: '' });
  const [appUpdateState, setAppUpdateState] = useState({ checking: false, message: '', version: null, downloaded: false, downloading: false, pct: null });

  useEffect(() => {
    let unsub = null;
    if (window.electronAPI?.onServicesStatus) {
      unsub = window.electronAPI.onServicesStatus((status) => {
        if (status.startsWith('update-available:')) {
          const ver = status.split(':')[1];
          setAppUpdateState(prev => ({
            ...prev,
            message: `Update v${ver} is available`,
            version: ver,
            downloading: false,
            downloaded: false,
            pct: null
          }));
        } else if (status.startsWith('update-downloading:')) {
          const pct = status.split(':')[1];
          setAppUpdateState(prev => ({
            ...prev,
            message: `Downloading update… ${pct}%`,
            downloading: true,
            pct: pct
          }));
        } else if (status === 'update-downloaded') {
          setAppUpdateState(prev => ({
            ...prev,
            message: `Update is ready — click Restart to apply`,
            downloaded: true,
            downloading: false,
            pct: null
          }));
        } else if (status === 'update-not-available') {
          setAppUpdateState(prev => ({
            ...prev,
            message: 'No update found',
            version: null,
            downloading: false,
            downloaded: false,
            pct: null
          }));
        } else if (status.startsWith('update-error:')) {
          const err = status.split(':')[1] || 'unknown error';
          setAppUpdateState(prev => ({
            ...prev,
            message: `Update error: ${err}`,
            downloading: false,
            downloaded: false,
            pct: null
          }));
        }
      });
    }
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  const installedExtCount = useMemo(() => {
    const seen = new Set();
    extensions.forEach(ext => {
      if (!ext?.isInstalled) return;
      seen.add(ext.pkgName || `${ext.name}:${ext.lang}`);
    });
    return seen.size;
  }, [extensions]);

  useEffect(() => {
    window.electronAPI?.getCloseToTray?.().then(val => {
      if (val !== undefined) updateSetting('closeToTray', val);
    }).catch(() => { });
    window.electronAPI?.getStartWithWindows?.().then(val => {
      if (val !== undefined) updateSetting('startWithWindows', val);
    }).catch(() => { });
    if (window.electronAPI?.checkService) {
      window.electronAPI.checkService().then(running => setServiceStatus(running ? 'running' : 'stopped')).catch(() => setServiceStatus('stopped'));
    }
  }, []);

  useEffect(() => {
    Promise.all([
      Promise.resolve(window.electronAPI?.getJavaPath?.()).catch(() => ''),
      Promise.resolve(window.electronAPI?.getJarPath?.()).catch(() => ''),
      Promise.resolve(window.electronAPI?.getSuwayomiConfigPath?.()).catch(() => ''),
    ]).then(([javaPath, jarPath, configPath]) => {
      setRuntimeInfo({
        javaPath: javaPath || '',
        jarPath: jarPath || '',
        configPath: configPath || '',
      });
    }).catch(() => { });
  }, []);

  const totalReadingMins = Object.values(readingTime).reduce((a, b) => a + b, 0);
  const totalChapters = Object.values(progress).reduce((a, p) => a + (parseInt(p.chapterNum) || 0), 0);

  const Section = ({ title, children }) => (
    <div style={{ marginBottom: 32 }}>
      <h3 style={{ fontFamily: "'Segoe UI Variable Display','Segoe UI Variable','Segoe UI',system-ui,-apple-system,sans-serif", fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        {title}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {children}
      </div>
    </div>
  );

  const Row = ({ label, sub, children }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)', gap: 16 }}>
      <div>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{label}</p>
        {sub && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{sub}</p>}
      </div>
      <div style={{ flexShrink: 0 }}>
        {children}
      </div>
    </div>
  );

  const Toggle = ({ value, onChange }) => (
    <button onClick={() => onChange(!value)} style={{ width: 48, height: 26, borderRadius: 13, background: value ? 'var(--accent)' : 'rgba(255,255,255,0.12)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.3s' }}>
      <div style={{ position: 'absolute', top: 3, left: value ? 22 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.3s', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }} />
    </button>
  );

  const checkAppUpdate = async () => {
    if (!window.electronAPI?.checkForAppUpdate) {
      toast('App updater is not available in this build', 'warning');
      return;
    }
    setAppUpdateState({ checking: true, message: 'Checking...', version: null, downloaded: false, downloading: false, pct: null });
    const result = await window.electronAPI.checkForAppUpdate();
    if (result?.ok) {
      const msg = result.downloaded
        ? `Update ${result.version || 'latest'} is ready to install`
        : result.downloading
          ? `Update ${result.version || 'latest'} is downloading`
          : result.checking
            ? 'Update check already running'
            : result.version
              ? `Update ${result.version} found`
              : 'No update found';
      setAppUpdateState({
        checking: false,
        message: msg,
        version: result.version || null,
        downloaded: !!result.downloaded,
        downloading: !!result.downloading,
        pct: result.downloading ? (result.pct || null) : null
      });
      toast(msg, result.version || result.downloaded || result.downloading ? 'success' : 'info');
    } else {
      const msg = result?.error || 'Unable to check for updates';
      setAppUpdateState({ checking: false, message: msg, version: null, downloaded: false, downloading: false, pct: null });
      toast(msg, 'warning');
    }
  };

  return (
    <div className="page-transition" style={{ maxWidth: 720, margin: '0 auto', padding: '0 0 60px' }}>

      <Section title="📊 Reading Statistics">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 12 }}>
          {[
            { label: 'Library', value: library.length, icon: '📚' },
            { label: 'History', value: history.length, icon: '🕐' },
            { label: 'Chapters Read', value: totalChapters, icon: '📖' },
            { label: 'Reading Time', value: `${Math.floor(totalReadingMins / 3600)}h ${Math.floor((totalReadingMins % 3600) / 60)}m`, icon: '⏱' },
            { label: 'Sources', value: Object.keys(sources).length, icon: '🌐' },
            { label: 'Extensions', value: installedExtCount, icon: '🧩' },
          ].map(s => (
            <div key={s.label} style={{ padding: '18px 16px', background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
              <p style={{ fontFamily: "'Segoe UI Variable Display','Segoe UI Variable','Segoe UI',system-ui,-apple-system,sans-serif", fontWeight: 800, fontSize: 22, color: 'var(--text)' }}>{s.value}</p>
              <p style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="📖 Reader Defaults">
        <Row label="Default Mode" sub="Mode used when opening a chapter">
          <select value={settings?.readerMode || 'scroll'} onChange={e => updateSetting('readerMode', e.target.value)} style={{ background: 'var(--card2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', outline: 'none' }}>
            <option value="scroll">Scroll</option>
            <option value="paged">Paged</option>
            <option value="webtoon">Webtoon</option>
          </select>
        </Row>
        <Row label="Default Fit Mode" sub="How images are sized in paged mode">
          <select value={settings?.fitMode || 'height'} onChange={e => updateSetting('fitMode', e.target.value)} style={{ background: 'var(--card2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', outline: 'none' }}>
            <option value="height">Fit Height</option>
            <option value="width">Fit Width</option>
            <option value="original">Original Size</option>
          </select>
        </Row>
        <Row label="Default Brightness" sub={`Currently: ${settings?.brightness || 100}%`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="range" min="40" max="150" value={settings?.brightness || 100}
              onPointerDown={e => e.stopPropagation()}
              onTouchStart={e => e.stopPropagation()}
              onChange={e => updateSetting('brightness', Number(e.target.value))} style={{ width: 120, height: '4px', accentColor: 'var(--accent)' }} />
            <span style={{ fontSize: 12, color: 'var(--muted)', minWidth: 36 }}>{settings?.brightness || 100}%</span>
          </div>
        </Row>
        <Row label="Reader Theme" sub="Background color while reading">
          <div style={{ display: 'flex', gap: 8 }}>
            {Object.entries(THEMES).map(([key, t]) => (
              <button key={key} onClick={() => updateSetting('readerTheme', key)} title={key} style={{ width: 32, height: 32, borderRadius: 8, background: t.bg, border: `2px solid ${(settings?.readerTheme || 'dark') === key ? t.accent : 'rgba(255,255,255,0.15)'}`, cursor: 'pointer' }} />
            ))}
          </div>
        </Row>
      </Section>

      <Section title="🖼 Display">
        <Row label="App Theme" sub="Switch between light and dark interface">
          <div style={{ display: 'flex', gap: 6 }}>
            {[['dark', '🌙 Dark'], ['light', '☀️ Light']].map(([v, l]) => (
              <button key={v} onClick={() => updateSetting('appTheme', v)} style={{ padding: '8px 16px', borderRadius: 10, border: `1.5px solid ${(settings?.appTheme || 'dark') === v ? 'var(--accent)' : 'var(--border)'}`, background: (settings?.appTheme || 'dark') === v ? 'rgba(249,115,22,0.12)' : 'transparent', color: (settings?.appTheme || 'dark') === v ? 'var(--accent)' : 'var(--muted)', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}>{l}</button>
            ))}
          </div>
        </Row>
        <Row label="Library View" sub="Default layout for your library">
          <div style={{ display: 'flex', gap: 6 }}>
            {[['grid', 'Grid'], ['list', 'List'], ['compact', 'Compact']].map(([v, l]) => (
              <button key={v} onClick={() => updateSetting('libraryView', v)} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: (settings?.libraryView || 'grid') === v ? 'var(--accent)' : 'rgba(255,255,255,0.08)', color: (settings?.libraryView || 'grid') === v ? '#fff' : 'var(--muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{l}</button>
            ))}
          </div>
        </Row>
        <Row label="Accent Color" sub="Changes highlight color throughout the app">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="color" value={settings?.accentColor || '#f97316'} onChange={e => updateSetting('accentColor', e.target.value)} style={{ width: 36, height: 36, borderRadius: 8, border: '1.5px solid var(--border)', background: 'none', cursor: 'pointer', padding: 2 }} />
            <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'monospace' }}>{settings?.accentColor || '#f97316'}</span>
            {settings?.accentColor && settings.accentColor !== '#f97316' && <Btn variant="ghost" size="sm" onClick={() => updateSetting('accentColor', '#f97316')}>Reset</Btn>}
          </div>
        </Row>
        <Row label="Sidebar Collapsed" sub="Start with sidebar minimized">
          <Toggle value={settings?.sidebarCollapsed || false} onChange={v => updateSetting('sidebarCollapsed', v)} />
        </Row>
      </Section>

      <Section title="🔌 Connection">
        <Row label="Backend Status" sub={`API: ${CONFIG.API}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: backendOnline === true ? '#22c55e' : backendOnline === false ? '#ef4444' : '#f59e0b', boxShadow: `0 0 10px ${backendOnline === true ? '#22c55e' : backendOnline === false ? '#ef4444' : '#f59e0b'}` }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: backendOnline === true ? '#4ade80' : backendOnline === false ? '#f87171' : '#facc15' }}>{backendOnline === true ? 'Online' : backendOnline === false ? 'Offline' : 'Checking...'}</span>
            </div>
            <Btn variant="outline" size="sm" onClick={() => { checkHealth(); fetchSources(); fetchExtensions(); toast('Refreshing...', 'info'); }}><RefreshCw size={14} /> Refresh</Btn>
          </div>
        </Row>
        {window.electronAPI?.checkForAppUpdate && (
          <Row label="App Updates" sub={appUpdateState.message || 'Checks GitHub releases and installs from inside akaReader'}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Btn variant="outline" size="sm" onClick={checkAppUpdate} disabled={appUpdateState.checking || appUpdateState.downloading}>
                <RefreshCw size={14} /> {appUpdateState.checking ? 'Checking' : 'Check'}
              </Btn>
              {appUpdateState.downloaded ? (
                <Btn variant="success" size="sm" onClick={() => window.electronAPI?.installAppUpdate?.()}>
                  Restart now
                </Btn>
              ) : appUpdateState.downloading ? (
                <Btn variant="outline" size="sm" disabled style={{ opacity: 0.6 }}>
                  Downloading {appUpdateState.pct ? `${appUpdateState.pct}%` : '…'}
                </Btn>
              ) : appUpdateState.version ? (
                <Btn variant="default" size="sm" onClick={() => {
                  window.electronAPI?.downloadAppUpdate?.();
                  setAppUpdateState(prev => ({ ...prev, downloading: true, message: 'Starting download…' }));
                }}>
                  <Download size={14} /> Download
                </Btn>
              ) : null}
            </div>
          </Row>
        )}
        <Row label="Suwayomi Runtime" sub="The embedded server akaReader manages in the background">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: suwayomiReady ? '#22c55e' : backendOnline === true ? '#f59e0b' : '#ef4444', boxShadow: `0 0 10px ${suwayomiReady ? '#22c55e' : backendOnline === true ? '#f59e0b' : '#ef4444'}` }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: suwayomiReady ? '#4ade80' : backendOnline === true ? '#facc15' : '#f87171' }}>
              {suwayomiReady ? 'Ready' : backendOnline === true ? 'Starting in background' : 'Unavailable'}
            </span>
          </div>
        </Row>
        <Row label="Java Runtime" sub={runtimeInfo.javaPath || 'Resolving Java runtime...'}>
          <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {runtimeInfo.javaPath ? (runtimeInfo.javaPath.toLowerCase().includes('\\appdata\\roaming\\akareader\\jre\\') ? 'Managed JRE' : 'System Java') : 'Pending'}
          </span>
        </Row>
        <Row label="Embedded Server" sub={runtimeInfo.jarPath || 'Resolving embedded server path...'}>
          <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Bundled Suwayomi JAR
          </span>
        </Row>
        <Row label="Suwayomi Config" sub={runtimeInfo.configPath || 'Config path will appear after startup'}>
          <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Browser auto-open disabled
          </span>
        </Row>
      </Section>

      <Section title="📂 Library Categories">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {categories.map(cat => (
            <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: cat.color }} />
              <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{cat.name}</span>
              {!DEFAULT_CATEGORIES.some(d => d.id === cat.id) && (
                <button onClick={() => removeCategory(cat.id)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: 4 }}><Trash2 size={14} /></button>
              )}
            </div>
          ))}
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <input id="new-cat-name" placeholder="New Category Name" style={{ flex: 1, background: 'var(--card2)', border: '1.5px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 13, outline: 'none' }} />
            <input id="new-cat-color" type="color" defaultValue="#f97316" style={{ width: 36, height: 36, border: 'none', background: 'none', cursor: 'pointer' }} />
            <Btn size="sm" onClick={() => {
              const name = document.getElementById('new-cat-name').value;
              const color = document.getElementById('new-cat-color').value;
              if (name) { addCategory(name, color); document.getElementById('new-cat-name').value = ''; }
            }} icon={Plus}>Add</Btn>
          </div>
        </div>
      </Section>

      <Section title="⚠️ Data Management">
        <Row label="Auto-Delete Read Chapters" sub="Automatically remove offline downloaded chapters when you finish reading them">
          <Toggle value={settings?.autoDeleteRead || false} onChange={v => updateSetting('autoDeleteRead', v)} />
        </Row>
        <Row label="Clear Reading History" sub={`${history.length} entries`}>
          <Btn variant="danger" size="sm" onClick={() => setConfirmClear('history')}><Trash2 size={14} /> Clear</Btn>
        </Row>
        <Row label="Clear Progress" sub={`${Object.keys(progress).length} tracked manga`}>
          <Btn variant="danger" size="sm" onClick={() => setConfirmClear('progress')}><Trash2 size={14} /> Clear</Btn>
        </Row>
        <Row label="Clear Reading Time" sub="Reset all tracked reading time">
          <Btn variant="danger" size="sm" onClick={() => setConfirmClear('readingTime')}><Trash2 size={14} /> Clear</Btn>
        </Row>
      </Section>

      <Section title="🖥️ App Behavior">
        <Row label="Close to Tray" sub="Closing the window keeps the app running in the system tray instead of quitting">
          <Toggle
            value={settings?.closeToTray !== false}
            onChange={v => {
              updateSetting('closeToTray', v);
              window.electronAPI?.setCloseToTray?.(v);
            }}
          />
        </Row>
        {window.electronAPI?.setStartWithWindows && (
          <Row label="Start with Windows" sub="Launch akaReader automatically when you log in">
            <Toggle
              value={!!settings?.startWithWindows}
              onChange={v => {
                updateSetting('startWithWindows', v);
                window.electronAPI.setStartWithWindows(v);
                toast(`Start with Windows ${v ? 'enabled' : 'disabled'}`, 'success');
              }}
            />
          </Row>
        )}
        {window.electronAPI?.openDataDir && (
          <Row label="Data Directory" sub="Open the folder where akaReader stores your settings and data">
            <Btn variant="outline" size="sm" onClick={() => window.electronAPI.openDataDir()}>
              <ExternalLink size={14} /> Open Folder
            </Btn>
          </Row>
        )}
      </Section>

      {window.electronAPI?.platform === 'win32' && (window.electronAPI?.installService || window.electronAPI?.checkService) && (
        <Section title="⚙️ Windows Service">
          <div style={{ padding: '12px 16px', background: 'rgba(59,130,246,0.06)', borderRadius: 12, border: '1px solid rgba(59,130,246,0.15)', fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 4 }}>
            Run the Suwayomi backend as a Windows service so it starts automatically and runs without a visible window.
          </div>
          <Row label="Service Status" sub="Current state of the Suwayomi Windows service">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: serviceStatus === 'running' ? '#22c55e' : serviceStatus === 'stopped' ? '#f87171' : '#f59e0b', boxShadow: `0 0 8px ${serviceStatus === 'running' ? '#22c55e' : serviceStatus === 'stopped' ? '#f87171' : '#f59e0b'}` }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: serviceStatus === 'running' ? '#4ade80' : serviceStatus === 'stopped' ? '#f87171' : '#facc15' }}>
                  {serviceStatus === 'running' ? 'Running' : serviceStatus === 'stopped' ? 'Not installed' : serviceWorking ? 'Working…' : 'Checking…'}
                </span>
              </div>
              <Btn variant="outline" size="sm" disabled={serviceWorking} onClick={async () => {
                setServiceWorking(true);
                try { const r = await window.electronAPI.checkService(); setServiceStatus(r ? 'running' : 'stopped'); }
                catch { setServiceStatus('stopped'); }
                finally { setServiceWorking(false); }
              }}><RefreshCw size={13} /> Check</Btn>
            </div>
          </Row>
          <Row label={serviceStatus === 'running' ? 'Uninstall Service' : 'Install Service'} sub={serviceStatus === 'running' ? 'Remove the Windows service (Suwayomi will only run while akaReader is open)' : 'Install as a Windows service for automatic background startup'}>
            {serviceStatus === 'running' ? (
              <Btn variant="danger" size="sm" disabled={serviceWorking} onClick={async () => {
                setServiceWorking(true);
                try { await window.electronAPI.uninstallService(); setServiceStatus('stopped'); toast('Service uninstalled', 'warning'); }
                catch (e) { toast(`Failed: ${e.message}`, 'error'); }
                finally { setServiceWorking(false); }
              }}>
                {serviceWorking ? <><Spin size={13} /> Working…</> : <><Trash2 size={13} /> Uninstall</>}
              </Btn>
            ) : (
              <Btn size="sm" disabled={serviceWorking} onClick={async () => {
                setServiceWorking(true);
                try { await window.electronAPI.installService(); setServiceStatus('running'); toast('Service installed and started', 'success'); }
                catch (e) { toast(`Failed: ${e.message}`, 'error'); }
                finally { setServiceWorking(false); }
              }}>
                {serviceWorking ? <><Spin size={13} /> Working…</> : 'Install Service'}
              </Btn>
            )}
          </Row>
        </Section>
      )}

      <Section title="📦 Extension Repositories">
        <div style={{ padding: '12px 16px', background: 'rgba(249,115,22,0.06)', borderRadius: 12, border: '1px solid rgba(249,115,22,0.15)', fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 4 }}>
          Add custom extension repo URLs. Paste the raw <code style={{ background: 'var(--card2)', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>index.min.json</code> URL from GitHub or any compatible source.
        </div>
        {(settings?.repos || []).map((repo, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <Globe size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 12, color: 'var(--text-dim)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{repo}</span>
            <Btn variant="danger" size="sm" onClick={() => {
              const updated = (settings?.repos || []).filter((_, ri) => ri !== i);
              updateSetting('repos', updated);
              toast('Repository removed', 'warning');
            }}><X size={12} /></Btn>
          </div>
        ))}
        {(settings?.repos || []).length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13, background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)' }}>
            No custom repositories added
          </div>
        )}
        <RepoAddRow onAdd={(url) => {
          const existing = settings?.repos || [];
          if (existing.includes(url)) { toast('Already added', 'warning'); return; }
          updateSetting('repos', [...existing, url]);
          toast('Repository added — restart extensions to apply', 'success');
        }} />
      </Section>

      <Section title="💾 Backup & Restore">
        <Row label="Export data" sub="Download your data as JSON">
          <Btn variant="outline" size="sm" icon={Download} onClick={() => { const d = { version: 2, library: storage.get('library', []), history: storage.get('history', []), progress: storage.get('progress', {}), mangaCategories: storage.get('mangaCategories', {}), readChapters: storage.get('readChapters', {}) }; const b = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = `akareader-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(u); toast('Exported!', 'success'); }}>Export</Btn>
        </Row>
        <Row label="Import data" sub="Restore from exported file">
          <Btn variant="outline" size="sm" icon={Archive} onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.json'; i.onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { const t = await f.text(); const d = JSON.parse(t); if (d.library) storage.set('library', d.library); if (d.history) storage.set('history', d.history); if (d.progress) storage.set('progress', d.progress); toast('Restored! Reloading…', 'success'); setTimeout(() => window.location.reload(), 1200); } catch (err) { toast('Import failed: ' + err.message, 'error'); } }; document.body.appendChild(i); i.click(); document.body.removeChild(i); }}>Import</Btn>
        </Row>
      </Section>
      <Section title="☕ Support Development">
        <div style={{ padding: '20px', background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>Enjoying akaReader?</p>
            <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>If this app saves you time or brings you joy,<br />a coffee would be greatly appreciated!</p>
          </div>
          <a href="https://ko-fi.com/akawazak" target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 12, background: 'linear-gradient(135deg,#ff5e5b,#ff8c42)', color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none', boxShadow: '0 4px 16px rgba(255,94,91,0.3)', flexShrink: 0 }}>
            <Coffee size={16} /> Buy me a coffee
          </a>
        </div>
      </Section>

      {confirmClear && (
        <div className="anim-fadeIn" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 32, maxWidth: 380, width: '90%', textAlign: 'center' }}>
            <AlertTriangle size={40} style={{ color: '#facc15', marginBottom: 16 }} />
            <h3 style={{ fontFamily: "'Segoe UI Variable Display','Segoe UI Variable','Segoe UI',system-ui,-apple-system,sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Are you sure?</h3>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>This will permanently delete your {confirmClear}. This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <Btn variant="outline" onClick={() => setConfirmClear(null)}>Cancel</Btn>
              <Btn variant="danger" onClick={() => {
                if (confirmClear === 'history') { storage.set('history', []); window.location.reload(); }
                else if (confirmClear === 'progress') { storage.set('progress', {}); window.location.reload(); }
                else if (confirmClear === 'readingTime') { storage.set('readingTime', {}); window.location.reload(); }
                setConfirmClear(null);
                toast('Cleared successfully', 'success');
              }}>
                <Trash2 size={14} /> Confirm Delete
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

// ==================== GLOBAL SEARCH ====================

const GlobalSearch = memo(({ sources, onSelectManga, onClose, fetchJSON }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({});
  const [searched, setSearched] = useState(false);
  const [searchHistory, setSearchHistory] = useState(() => storage.get('searchHistory', []));
  const toast = useToast();
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const saveToHistory = useCallback((q) => {
    if (!q.trim()) return;
    setSearchHistory(prev => {
      const updated = [q, ...prev.filter(s => s !== q)].slice(0, 20);
      storage.set('searchHistory', updated);
      return updated;
    });
  }, []);

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) return;
    setSearched(true);
    saveToHistory(q);
    const srcList = Object.values(sources);
    if (srcList.length === 0) { toast('No sources installed', 'warning'); return; }

    const init = {};
    srcList.forEach(s => { init[s.id] = { loading: true, results: [], error: null, sourceName: s.name }; });
    setResults(init);

    srcList.forEach(async (src) => {
      try {
        const data = await fetchJSON(`/source/${src.id}/search?q=${encodeURIComponent(q)}&page=1`);
        setResults(prev => ({ ...prev, [src.id]: { loading: false, results: data.results || [], error: null, sourceName: src.name } }));
      } catch (e) {
        setResults(prev => ({ ...prev, [src.id]: { loading: false, results: [], error: e.message, sourceName: src.name } }));
      }
    });
  }, [sources, fetchJSON, toast]);

  const dSearch = useMemo(() => debounce(doSearch, 500), [doSearch]);

  const totalResults = Object.values(results).reduce((a, r) => a + r.results.length, 0);
  const anyLoading = Object.values(results).some(r => r.loading);
  const hasSearched = searched && query.trim();

  return (
    <div className="anim-fadeIn" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', zIndex: 500, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 60 }}>
      <div style={{ width: 'min(700px,95vw)', position: 'relative', marginBottom: 24 }}>
        <Search size={20} style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
        <input
          ref={inputRef}
          placeholder="Search across all installed sources..."
          value={query}
          onChange={e => { setQuery(e.target.value); dSearch(e.target.value); }}
          onKeyDown={e => { if (e.key === 'Enter') doSearch(query); if (e.key === 'Escape') onClose(); }}
          style={{ width: '100%', background: 'rgba(22,22,31,0.98)', border: '2px solid var(--accent)', borderRadius: 16, padding: '16px 50px 16px 52px', color: 'var(--text)', fontSize: 16, outline: 'none', fontFamily: 'system-ui,-apple-system,Segoe UI,sans-serif', boxShadow: '0 8px 40px rgba(249,115,22,0.2)' }}
        />
        <Btn variant="ghost" size="icon" onClick={onClose} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
          <X size={18} />
        </Btn>
      </div>

      <div style={{ width: 'min(700px,95vw)', flex: 1, overflowY: 'auto', paddingBottom: 40 }}>
        {!hasSearched && (
          <div style={{ textAlign: 'center', color: 'var(--muted)', marginTop: 40 }}>
            <Search size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
            <p style={{ fontSize: 16, fontWeight: 500 }}>Search across {Object.keys(sources).length} sources simultaneously</p>
            <p style={{ fontSize: 13, marginTop: 8 }}>Type to start searching</p>
            {searchHistory.length > 0 && (
              <div style={{ marginTop: 28, textAlign: 'left' }}>
                <p style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Recent searches</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {searchHistory.map((h, i) => (
                    <button key={i} onClick={() => { setQuery(h); doSearch(h); }} style={{ padding: '6px 14px', borderRadius: 20, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--text)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)'; }}
                    >
                      <Clock size={12} />{h}
                    </button>
                  ))}
                  <button onClick={() => { setSearchHistory([]); storage.set('searchHistory', []); }} style={{ padding: '6px 10px', borderRadius: 20, background: 'transparent', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: 12, cursor: 'pointer' }}>Clear</button>
                </div>
              </div>
            )}
          </div>
        )}

        {hasSearched && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                {anyLoading ? `Searching ${Object.keys(results).length} sources...` : `${totalResults} results across ${Object.keys(results).length} sources`}
              </p>
              {anyLoading && <Spin size={18} />}
            </div>

            {Object.entries(results).map(([srcId, r]) => {
              if (r.results.length === 0 && !r.loading) return null;
              return (
                <div key={srcId} style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{r.sourceName || srcId}</p>
                    {r.loading && <Spin size={14} />}
                    {!r.loading && <Badge variant="outline" size="sm">{r.results.length}</Badge>}
                    {r.error && <Badge variant="destructive" size="sm">Error</Badge>}
                  </div>
                  {r.results.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 14 }}>
                      {r.results.slice(0, 8).map((m, i) => (
                        <MangaCard key={getMangaKey(m.id, srcId)} manga={{ ...m, sourceId: srcId }} onClick={manga => { onSelectManga(manga, srcId); onClose(); }} index={i} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {!anyLoading && totalResults === 0 && (
              <EmptyState icon={Search} title="No results found" sub={`"${query}" didn't match anything across your installed sources`} compact />
            )}
          </>
        )}
      </div>
    </div>
  );
});

// ==================== UPDATES TAB ====================

const UpdatesTab = memo(({ onOpenManga }) => {
  const { updates, checkingUpdates, checkForUpdates, getMangaKey } = useData();

  return (
    <div className="page-transition">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Manga with New Chapters</h2>
        <Btn variant="outline" size="sm" onClick={checkForUpdates} disabled={checkingUpdates}>
          <RefreshCw size={14} className={checkingUpdates ? 'anim-spin' : ''} style={{ marginRight: 6 }} />
          {checkingUpdates ? 'Checking...' : 'Check Now'}
        </Btn>
      </div>

      {updates.length === 0 ? (
        <EmptyState icon={BellRing} title="No updates" sub="All your manga are up to date" compact />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 18 }}>
          {updates.map((manga, i) => (
            <div key={getMangaKey(manga.id, manga.sourceId)} style={{ position: 'relative' }}>
              <MangaCard manga={manga} onClick={onOpenManga || (() => { })} index={i} badge={`+${manga.newChapters}`} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

// ==================== DOWNLOADS TAB ====================

const DownloadsTab = memo(({ queue, onClear, onRemove, onRetry, onCancel, onCancelAll }) => {
  const pending = queue.filter(d => d.status === 'pending').length;
  const active = queue.filter(d => d.status === 'downloading').length;
  const done = queue.filter(d => d.status === 'done').length;
  const errors = queue.filter(d => d.status === 'error').length;
  const cancelled = queue.filter(d => d.status === 'cancelled').length;
  const inProgress = pending + active;

  const statusColor = { pending: '#94a3b8', downloading: 'var(--accent)', done: '#4ade80', error: '#f87171', cancelled: '#64748b' };
  const statusLabel = { pending: 'Queued', downloading: 'Downloading…', done: 'Complete', error: 'Failed', cancelled: 'Cancelled' };

  return (
    <div className="page-transition">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Downloads</h2>
          <div style={{ display: 'flex', gap: 16 }}>
            {active > 0 && <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>{active} active</span>}
            {pending > 0 && <span style={{ fontSize: 12, color: 'var(--muted-fg)' }}>{pending} queued</span>}
            {done > 0 && <span style={{ fontSize: 12, color: '#4ade80' }}>{done} done</span>}
            {errors > 0 && <span style={{ fontSize: 12, color: '#f87171' }}>{errors} failed</span>}
            {cancelled > 0 && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{cancelled} cancelled</span>}
          </div>
        </div>
        {queue.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {inProgress > 0 && <Btn variant="outline" size="sm" onClick={onCancelAll}><X size={13} /> Cancel All</Btn>}
            {errors > 0 && <Btn variant="outline" size="sm" onClick={() => queue.filter(d => d.status === 'error').forEach(d => onRetry(d.id))}><RefreshCw size={13} /> Retry Failed</Btn>}
            <Btn variant="danger" size="sm" onClick={onClear}><Trash2 size={13} /> Clear Finished</Btn>
          </div>
        )}
      </div>

      {queue.length === 0 ? (
        <EmptyState icon={Download} title="No downloads" sub="Queue chapters from the manga detail page — right-click a chapter or use the buttons above the chapter list" compact />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {queue.map((item) => {
            const isCancellable = item.status === 'pending' || item.status === 'downloading';
            const borderCol = item.status === 'error' ? 'rgba(239,68,68,0.25)' : item.status === 'done' ? 'rgba(34,197,94,0.2)' : item.status === 'downloading' ? 'rgba(249,115,22,0.3)' : item.status === 'cancelled' ? 'rgba(100,116,139,0.2)' : 'var(--border)';
            return (
              <div key={item.id} className="dl-item" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 14, background: 'var(--card)', border: `1.5px solid ${borderCol}`, transition: 'border-color 0.3s, opacity 0.3s', opacity: item.status === 'cancelled' ? 0.55 : 1, animationDelay: `${Math.min(queue.indexOf(item), 10) * 35}ms` }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--card2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {item.status === 'downloading' ? <Spin size={18} /> :
                    item.status === 'done' ? <Check size={18} style={{ color: '#4ade80' }} /> :
                      item.status === 'error' ? <AlertTriangle size={18} style={{ color: '#f87171' }} /> :
                        item.status === 'cancelled' ? <X size={18} style={{ color: 'var(--muted)' }} /> :
                          <Download size={18} style={{ color: 'var(--muted)' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
                    {item.mangaTitle} — Ch. {item.chapterNum}
                  </p>
                  {item.status === 'downloading' ? (
                    <div>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
                        <div className="dl-bar-active" style={{ width: `${item.progress}%`, height: '100%', background: 'linear-gradient(90deg,var(--accent),#fb923c)', transition: 'width 0.4s cubic-bezier(0.16,1,0.3,1)', borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>{item.progress}% · {item.pagesLoaded}/{item.pagesTotal} pages</span>
                    </div>
                  ) : (
                    <span style={{ fontSize: 11, color: statusColor[item.status] || '#94a3b8', fontWeight: 600 }}>
                      {item.status === 'error' ? `Error: ${item.error}` : statusLabel[item.status] || item.status}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {isCancellable && <Btn variant="ghost" size="icon" onClick={() => onCancel(item.id)} title="Cancel" style={{ color: 'var(--muted)' }}><X size={14} /></Btn>}
                  {item.status === 'error' && <Btn variant="ghost" size="icon" onClick={() => onRetry(item.id)} title="Retry"><RefreshCw size={14} /></Btn>}
                  {(item.status === 'done' || item.status === 'error' || item.status === 'cancelled') && <Btn variant="ghost" size="icon" onClick={() => onRemove(item.id)} title="Remove from list"><X size={14} /></Btn>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

// ==================== BROWSE FILTER BAR ====================

const BrowseFilterBar = memo(({ filters, onChange, onClear, activeCount }) => {
  const inputStyle = {
    background: 'var(--card)', border: '1.5px solid var(--border)',
    borderRadius: 10, padding: '9px 12px', color: 'var(--text)',
    fontSize: 12, outline: 'none', cursor: 'pointer',
    transition: 'border-color 0.2s',
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '12px 16px', background: 'var(--card)', borderRadius: 14, border: '1.5px solid var(--border)', marginBottom: 18 }}>
      <select
        value={filters.sort}
        onChange={e => onChange('sort', e.target.value)}
        style={{ ...inputStyle, minWidth: 140 }}
      >
        {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>
        Supported source browse modes
      </span>

      {activeCount > 0 && (
        <Btn variant="ghost" size="sm" onClick={onClear} style={{ color: 'var(--accent)', fontSize: 12 }}>
          <X size={13} /> Clear ({activeCount})
        </Btn>
      )}
    </div>
  );
});

// ==================== DOWNLOADED CHAPTERS (IndexedDB) ====================

const DB_NAME = 'akareader-downloads';
const DB_VER = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('chapters')) {
        db.createObjectStore('chapters', { keyPath: 'key' });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

async function saveChapterBlobs(mangaId, chapterId, urlsAndBlobs) {
  const pages = urlsAndBlobs.map(({ blob }) => blob);

  const db = await openDB();
  const key = getDownloadKey(mangaId, chapterId);
  return new Promise((res, rej) => {
    const tx = db.transaction('chapters', 'readwrite');
    tx.oncomplete = () => {
      window.dispatchEvent(new Event('downloads-updated'));
      res();
    };
    tx.onerror = () => rej(tx.error);
    tx.objectStore('chapters').put({ key, pages, savedAt: Date.now() });
  });
}

async function loadChapterBlobs(mangaId, chapterId) {
  try {
    const db = await openDB();
    const tx = db.transaction('chapters', 'readonly');
    const st = tx.objectStore('chapters');
    const key = getDownloadKey(mangaId, chapterId);
    return new Promise((res) => {
      const req = st.get(key);
      req.onsuccess = () => {
        if (!req.result) return res(null);
        const urls = (req.result.pages || []).map(page => {
          if (page instanceof Blob) return URL.createObjectURL(page);
          if (typeof page !== 'string') return null;
          const arr = page.split(',');
          const mime = arr[0]?.match(/:(.*?);/)?.[1] || 'image/jpeg';
          const bstr = atob(arr[1] || '');
          const u8 = new Uint8Array(bstr.length);
          for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
          return URL.createObjectURL(new Blob([u8], { type: mime }));
        }).filter(Boolean);
        res(urls);
      };
      req.onerror = () => res(null);
    });
  } catch { return null; }
}

async function deleteChapterBlobs(mangaId, chapterId) {
  try {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction('chapters', 'readwrite');
      tx.oncomplete = () => {
        window.dispatchEvent(new Event('downloads-updated'));
        res();
      };
      tx.onerror = () => rej(tx.error);
      tx.objectStore('chapters').delete(getDownloadKey(mangaId, chapterId));
    });
  } catch { }
}

async function deleteAllChapterBlobsForManga(mangaId) {
  const keys = await listDownloadedKeys();
  const prefix = `${mangaId}___`;
  await Promise.all(
    keys
      .map(String)
      .filter(key => key.startsWith(prefix))
      .map(key => {
        const chapterId = key.slice(prefix.length);
        return deleteChapterBlobs(mangaId, chapterId);
      })
  );
}

async function listDownloadedKeys() {
  try {
    const db = await openDB();
    const tx = db.transaction('chapters', 'readonly');
    const st = tx.objectStore('chapters');
    return new Promise(res => {
      const req = st.getAllKeys();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => res([]);
    });
  } catch { return []; }
}

function useDownloads() {
  const { downloadedKeys, refreshDownloads } = useData();
  return { downloadedKeys, refreshDownloads };
}

const isBlobUrl = value => typeof value === 'string' && value.startsWith('blob:');
const revokeBlobUrls = (values = []) => {
  values.filter(isBlobUrl).forEach(url => {
    try { URL.revokeObjectURL(url); } catch {}
  });
};

const ONBOARDING_STEPS = [
  {
    target: null,
    icon: '📖',
    title: 'Welcome to akaReader',
    body: "Your beautiful offline manga reader. Let's take a quick tour — we'll highlight exactly where everything is.",
  },
  {
    target: 'nav-extensions',
    icon: '🧩',
    title: 'Install Extensions first',
    body: 'Extensions connect you to manga sources. Install a few here to unlock thousands of titles from the web.',
  },
  {
    target: 'nav-browse',
    icon: '🔍',
    title: 'Browse & Search',
    body: 'Pick a source and search for any manga. Use the filter bar to narrow by status, genre tags, or content type.',
  },
  {
    target: 'nav-library',
    icon: '📚',
    title: 'Build your Library',
    body: 'Right-click any manga to save it here. Organise by category, track your progress, and keep a streak going.',
  },
  {
    target: 'global-search-btn',
    icon: '🔎',
    title: 'Global Search',
    body: 'Search across ALL your installed sources at once — perfect for finding which site has a specific title.',
  },
];

function getTargetRect(id) {
  if (!id) return null;
  const el = document.querySelector(`[data-onboard="${id}"]`);
  return el ? el.getBoundingClientRect() : null;
}

function buildSpotlightPath(vw, vh, r) {
  if (!r) return `M0 0 H${vw} V${vh} H0 Z`;
  const PAD = 12;
  const x = r.left - PAD, y = r.top - PAD;
  const w = r.width + PAD * 2, h = r.height + PAD * 2;
  const rad = 14;
  return [
    `M0 0 H${vw} V${vh} H0 Z`,
    `M${x + rad} ${y}`,
    `H${x + w - rad} Q${x + w} ${y} ${x + w} ${y + rad}`,
    `V${y + h - rad} Q${x + w} ${y + h} ${x + w - rad} ${y + h}`,
    `H${x + rad} Q${x} ${y + h} ${x} ${y + h - rad}`,
    `V${y + rad} Q${x} ${y} ${x + rad} ${y} Z`,
  ].join(' ');
}

const ONB_STYLES = `
  @keyframes onb-glow {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.55; }
  }
  @keyframes onb-card-in {
    from { opacity: 0; transform: translateY(10px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes onb-fade {
    from { opacity: 0; } to { opacity: 1; }
  }
`;

const Onboarding = memo(({ onFinish }) => {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);
  const [animKey, setAnimKey] = useState(0);
  const [vw, setVw] = useState(window.innerWidth);
  const [vh, setVh] = useState(window.innerHeight);

  const s = ONBOARDING_STEPS[step];
  const total = ONBOARDING_STEPS.length;
  const PAD = 12;

  useEffect(() => {
    const onResize = () => { setVw(window.innerWidth); setVh(window.innerHeight); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const measure = () => setRect(getTargetRect(s.target));
    measure();
    const t = setTimeout(measure, 120);
    setAnimKey(k => k + 1);
    return () => clearTimeout(t);
  }, [step, s.target]);

  const goNext = () => step < total - 1 ? setStep(p => p + 1) : onFinish();
  const goPrev = () => step > 0 && setStep(p => p - 1);

  const cardStyle = useMemo(() => {
    const W = 330;
    if (!rect) return {
      top: '50%', left: '50%',
      transform: 'translate(-50%,-50%)',
    };
    const x = rect.left - PAD, y = rect.top - PAD;
    const w = rect.width + PAD * 2, h = rect.height + PAD * 2;
    const spaceRight = vw - (x + w) - 20;
    const spaceLeft = x - 20;
    let left, top;
    top = Math.max(16, Math.min(vh - 320, y + h / 2 - 150));
    if (spaceRight >= W + 16) {
      left = x + w + 20;
    } else if (spaceLeft >= W + 16) {
      left = x - W - 20;
    } else {
      left = Math.max(16, Math.min(vw - W - 16, x + w / 2 - W / 2));
      top = Math.min(vh - 320, y + h + 16);
    }
    return { top, left };
  }, [rect, vw, vh]);

  const arrowEl = useMemo(() => {
    if (!rect) return null;
    const W = 330;
    const PAD2 = 12;
    const sx = rect.left - PAD2, sy = rect.top - PAD2;
    const sw = rect.width + PAD2 * 2, sh = rect.height + PAD2 * 2;
    const cx = sx + sw / 2, cy = sy + sh / 2;

    let cardLeft = cardStyle.left ?? 0;
    let cardTop = cardStyle.top ?? 0;
    if (cardStyle.transform) return null;
    const cardCx = cardLeft + W / 2;
    const cardCy = cardTop + 150;

    const dx = cx - cardCx, dy = cy - cardCy;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len, uy = dy / len;
    const startX = cardCx + ux * (W / 2 + 8);
    const startY = cardCy + uy * 60;
    const endX = cx - ux * (sw / 2 + 16);
    const endY = cy - uy * (sh / 2 + 16);
    const midX = (startX + endX) / 2 - uy * 30;
    const midY = (startY + endY) / 2 + ux * 30;
    const ah = 10;
    const ax1 = endX - ux * ah + uy * (ah / 2);
    const ay1 = endY - uy * ah - ux * (ah / 2);
    const ax2 = endX - ux * ah - uy * (ah / 2);
    const ay2 = endY - uy * ah + ux * (ah / 2);

    return (
      <svg style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 2003, pointerEvents: 'none' }}>
        <path
          d={`M${startX},${startY} Q${midX},${midY} ${endX},${endY}`}
          stroke="#f97316" strokeWidth="2" fill="none" strokeDasharray="5 4"
          style={{ animation: 'onb-fade 0.4s ease both' }}
        />
        <path
          d={`M${ax1},${ay1} L${endX},${endY} L${ax2},${ay2}`}
          stroke="#f97316" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"
          style={{ animation: 'onb-fade 0.4s ease 0.1s both' }}
        />
      </svg>
    );
  }, [rect, cardStyle]);

  const spotlightPath = buildSpotlightPath(vw, vh, rect);

  const borderRect = rect ? {
    x: rect.left - PAD - 1,
    y: rect.top - PAD - 1,
    width: rect.width + PAD * 2 + 2,
    height: rect.height + PAD * 2 + 2,
    rx: 15,
  } : null;

  return (
    <>
      <style>{ONB_STYLES}</style>
      <svg
        style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 2000, pointerEvents: 'none', transition: 'all 0.4s cubic-bezier(0.16,1,0.3,1)' }}
      >
        <defs>
          <filter id="onb-blur">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>
        <path
          d={spotlightPath}
          fill="rgba(0,0,0,0.82)"
          fillRule="evenodd"
          style={{ transition: 'd 0.4s cubic-bezier(0.16,1,0.3,1)' }}
        />
        {borderRect && (
          <>
            <rect
              {...borderRect}
              fill="none"
              stroke="rgba(249,115,22,0.25)"
              strokeWidth="12"
              filter="url(#onb-blur)"
              style={{ animation: 'onb-glow 2s ease-in-out infinite' }}
            />
            <rect
              {...borderRect}
              fill="none"
              stroke="#f97316"
              strokeWidth="2"
              style={{ animation: 'onb-glow 2s ease-in-out infinite' }}
            />
            {[
              [borderRect.x, borderRect.y, 1, 1],
              [borderRect.x + borderRect.width, borderRect.y, -1, 1],
              [borderRect.x, borderRect.y + borderRect.height, 1, -1],
              [borderRect.x + borderRect.width, borderRect.y + borderRect.height, -1, -1],
            ].map(([cx2, cy2, sx2, sy2], i) => (
              <g key={i}>
                <line x1={cx2} y1={cy2} x2={cx2 + sx2 * 14} y2={cy2} stroke="#fb923c" strokeWidth="3" strokeLinecap="round" />
                <line x1={cx2} y1={cy2} x2={cx2} y2={cy2 + sy2 * 14} stroke="#fb923c" strokeWidth="3" strokeLinecap="round" />
              </g>
            ))}
          </>
        )}
      </svg>
      {arrowEl}
      <div
        key={animKey}
        style={{
          position: 'fixed',
          ...cardStyle,
          width: 330,
          zIndex: 2004,
          animation: 'onb-card-in 0.3s cubic-bezier(0.16,1,0.3,1) both',
          background: 'rgba(13,13,20,0.98)',
          backdropFilter: 'blur(28px)',
          border: '1.5px solid rgba(249,115,22,0.3)',
          borderRadius: 20,
          padding: '24px 22px 18px',
          boxShadow: '0 28px 72px rgba(0,0,0,0.6), 0 0 0 1px rgba(249,115,22,0.08), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ flex: 1, display: 'flex', gap: 4 }}>
            {ONBOARDING_STEPS.map((_, i) => (
              <div
                key={i}
                onClick={() => setStep(i)}
                style={{
                  flex: i === step ? 2 : 1,
                  height: 4, borderRadius: 2, cursor: 'pointer',
                  background: i === step
                    ? 'linear-gradient(90deg,#f97316,#fb923c)'
                    : i < step
                      ? 'rgba(249,115,22,0.45)'
                      : 'rgba(255,255,255,0.1)',
                  transition: 'flex 0.3s, background 0.3s',
                  boxShadow: i === step ? '0 0 8px rgba(249,115,22,0.5)' : 'none',
                }}
              />
            ))}
          </div>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', fontWeight: 600, flexShrink: 0 }}>
            {step + 1} / {total}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 11 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12, flexShrink: 0,
            background: 'linear-gradient(135deg,rgba(249,115,22,0.18),rgba(249,115,22,0.06))',
            border: '1px solid rgba(249,115,22,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22,
          }}>
            {s.icon}
          </div>
          <h2 style={{
            fontFamily: "'Segoe UI Variable Display','Segoe UI Variable','Segoe UI',system-ui,-apple-system,sans-serif", fontWeight: 800, fontSize: 16,
            color: '#f1f5f9', lineHeight: 1.3, margin: 0,
          }}>
            {s.title}
          </h2>
        </div>
        <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.8, marginBottom: 20 }}>
          {s.body}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          {step > 0 && (
            <button
              onClick={goPrev}
              style={{ flex: '0 0 auto', padding: '9px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.09)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            >
              <ChevronLeft size={14} /> Back
            </button>
          )}
          <button
            onClick={goNext}
            style={{ flex: 1, padding: '10px 18px', borderRadius: 10, background: 'linear-gradient(135deg,#f97316,#ea580c)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: '0 4px 18px rgba(249,115,22,0.4)', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 24px rgba(249,115,22,0.55)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 18px rgba(249,115,22,0.4)'; e.currentTarget.style.transform = ''; }}
          >
            {step < total - 1
              ? <> Next <ChevronRight size={15} /></>
              : <> Let's go! <ArrowRight size={15} /></>
            }
          </button>
        </div>
        <button
          onClick={onFinish}
          style={{ display: 'block', margin: '13px auto 0', background: 'none', border: 'none', color: 'rgba(255,255,255,0.22)', fontSize: 11, cursor: 'pointer', letterSpacing: '0.04em', transition: 'color 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.48)'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.22)'}
        >
          skip tutorial
        </button>
      </div>
    </>
  );
});

// ==================== ERROR RECOVERY MODAL ====================

const ServiceErrorModal = memo(({ onRestart }) => {
  const [restarting, setRestarting] = useState(false);
  const handleRestart = async () => {
    setRestarting(true);
    try {
      if (window.electronAPI?.restartServices) {
        await window.electronAPI.restartServices();
      }
    } catch { }
    setTimeout(() => setRestarting(false), 8000);
    onRestart();
  };
  return (
    <div className="anim-fadeIn" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)', zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'var(--card)', border: '1.5px solid rgba(239,68,68,0.3)', borderRadius: 24, padding: '40px 36px', maxWidth: 400, width: '100%', textAlign: 'center', boxShadow: '0 32px 80px rgba(0,0,0,0.5)' }}>
        <AlertCircle size={48} style={{ color: '#f87171', marginBottom: 16 }} />
        <h2 style={{ fontFamily: "'Segoe UI Variable Display','Segoe UI Variable','Segoe UI',system-ui,-apple-system,sans-serif", fontWeight: 800, fontSize: 20, marginBottom: 10 }}>Backend Offline</h2>
        <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.8, marginBottom: 28 }}>
          The akaReader backend has stopped responding. This can happen if the server process exited unexpectedly.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Btn variant="outline" onClick={onRestart}>Dismiss</Btn>
          {window.electronAPI?.restartServices && (
            <Btn onClick={handleRestart} disabled={restarting}>
              {restarting ? <><Spin size={14} /> Restarting...</> : <><RotateCcw size={15} /> Restart Services</>}
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
});

// ==================== RELEASE NOTES MODAL ====================
const ReleaseNotesModal = memo(({ notes, version, onClose }) => {
  if (!notes) return null;
  // Simple markdown-ish: bold headings, line breaks, code blocks
  const formatted = notes
    .replace(/^### (.+)$/gm, '<h3 style="font-size:15px;font-weight:700;color:var(--text);margin:16px 0 6px">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:17px;font-weight:800;color:var(--text);margin:20px 0 8px">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:19px;font-weight:900;color:var(--text);margin:24px 0 10px">$1</h1>')
    .replace(/`([^`]+)`/g, '<code style="background:rgba(249,115,22,0.12);color:#f97316;padding:1px 5px;border-radius:4px;font-size:12px">$1</code>')
    .replace(/\n\n/g, '</p><p style="margin:8px 0;line-height:1.7">')
    .replace(/\n/g, '<br/>');
  return (
    <div className="anim-fadeIn" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)', zIndex: 1600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 24, padding: '32px 36px', maxWidth: 560, width: '100%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontFamily: "'Segoe UI Variable Display','Segoe UI Variable','Segoe UI',system-ui,-apple-system,sans-serif", fontWeight: 800, fontSize: 18, margin: 0 }}>Release Notes</h2>
            <span style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, display: 'block' }}>v{version}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', padding: 8 }}><X size={20} /></button>
        </div>
        <div style={{ color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.7, fontFamily: "'Segoe UI Variable','Segoe UI',system-ui,-apple-system,sans-serif" }}
          dangerouslySetInnerHTML={{ __html: `<p style="margin:8px 0;line-height:1.7">${formatted}</p>` }} />
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
          <Btn onClick={onClose}>Close</Btn>
        </div>
      </div>
    </div>
  );
});

// ==================== STARTUP SCREEN ====================
const StartupScreen = memo(({ onProceed, onRetry, managedStartup = false, backendOnline = null, suwayomiReady = false }) => {
  const [hasFailed, setHasFailed] = useState(false);
  const [phase, setPhase] = useState(0);
  const [statusMsg, setStatusMsg] = useState('Starting services...');
  const [barW, setBarW] = useState(0);
  const [downloadPct, setDownloadPct] = useState(null);
  const [appVersion, setAppVersion] = useState('');
  useEffect(() => {
    window.electronAPI?.getVersion?.().then(v => setAppVersion(v || '')).catch(() => { });
  }, []);

  const STATUS_MAP = {
    'starting-backend': { msg: 'Starting akaReader proxy...', bar: 12 },
    'backend-ready': { msg: 'Proxy ready. Preparing Suwayomi...', bar: 24 },
    'using-system-java': { msg: 'Using installed Java runtime...', bar: 32 },
    'downloading-jre': { msg: 'Downloading Java runtime (first launch only)...', bar: null },
    'extracting-jre': { msg: 'Extracting Java runtime...', bar: 34 },
    'installing-bundled-jre': { msg: 'Preparing bundled Java runtime...', bar: 32 },
    'using-existing-suwayomi': { msg: 'Using cached Suwayomi server...', bar: 42 },
    'downloading-suwayomi': { msg: 'Downloading Suwayomi server (first launch only)...', bar: null },
    'installing-bundled-suwayomi': { msg: 'Preparing bundled Suwayomi server...', bar: 42 },
    'suwayomi-starting': { msg: 'Starting Suwayomi server...', bar: 50 },
    'configuring-suwayomi': { msg: 'Applying background-server settings...', bar: 56 },
    'starting-suwayomi': { msg: 'Opening Suwayomi — this can take 20–30 seconds...', bar: 68 },
    'suwayomi-ready': { msg: 'Suwayomi ready!', bar: 95 },
    'online': { msg: 'Ready!', bar: 100 },
    'offline': { msg: 'Waiting for services...', bar: 40 },
    'crashed': { msg: 'Service crashed — retrying...', bar: 30 },
    'suwayomi-failed': { msg: 'Suwayomi failed to start. Check Java is installed.', bar: 30 },
  };

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 300);
    const t2 = setTimeout(() => setPhase(2), 700);
    const t3 = setTimeout(() => { setPhase(3); }, 1100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  useEffect(() => {
    if (phase < 2) return;
    let w = 0;
    const tick = setInterval(() => {
      w += Math.random() * 1.2 + 0.2;
      if (w >= 90) { w = 90; clearInterval(tick); }
      setBarW(prev => downloadPct !== null ? downloadPct : Math.max(prev, w));
    }, 120);
    return () => clearInterval(tick);
  }, [phase]);

  useEffect(() => {
    // Fail-safe: if we're still here after 45 seconds, show recovery options.
    const failSafe = setTimeout(() => {
      setHasFailed(true);
      setStatusMsg(managedStartup
        ? 'Startup is taking longer than expected. You can retry Suwayomi or continue offline.'
        : 'Suwayomi is not running in this browser preview. Open akaReader desktop or start Suwayomi on port 4567.'
      );
    }, managedStartup ? 45000 : 8000);

    if (!window.electronAPI?.onServicesStatus) return () => clearTimeout(failSafe);

    const unsub = window.electronAPI.onServicesStatus((status) => {
      if (status.includes(':') && !status.startsWith('update-available')) {
        const [code, val] = status.split(':');
        const pct = parseInt(val);
        if (!isNaN(pct)) {
          setDownloadPct(pct);
          setBarW(pct * 0.45);
          const label = code === 'downloading-jre' ? 'Downloading Java runtime' : 'Downloading Suwayomi';
          setStatusMsg(`${label}... ${pct}%`);
          return;
        }
      }
      if (status.startsWith('suwayomi-failed:')) {
        const detail = status.slice('suwayomi-failed:'.length).trim();
        setDownloadPct(null);
        setStatusMsg(detail ? `Suwayomi failed: ${detail}` : 'Suwayomi failed to start. Check Java is installed.');
        setBarW(30);
        setHasFailed(true);
        return;
      }
      setDownloadPct(null);
      const mapped = STATUS_MAP[status];
      if (mapped) {
        setStatusMsg(mapped.msg);
        if (mapped.bar !== null) setBarW(mapped.bar);
        if (status.includes('failed') || status === 'crashed') {
          setHasFailed(true);
        } else if (status === 'suwayomi-ready' || status === 'online') {
          clearTimeout(failSafe);
          setHasFailed(false);
        }
      }
    });
    return () => {
      clearTimeout(failSafe);
      if (typeof unsub === 'function') unsub();
    };
  }, [phase, managedStartup]);

  useEffect(() => {
    if (managedStartup || suwayomiReady) return;
    if (backendOnline === true) {
      setStatusMsg('Waiting for Suwayomi on port 4567...');
      setBarW(prev => Math.max(prev, 45));
    } else if (backendOnline === false) {
      setStatusMsg('Waiting for the akaReader proxy...');
      setBarW(prev => Math.max(prev, 18));
    }
  }, [backendOnline, managedStartup, suwayomiReady]);

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'radial-gradient(ellipse at 50% 60%, #13101a 0%, #0a0a0f 70%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes ss-drop {
          0%   { opacity:0; transform: translateY(-40px) scale(0.7); }
          60%  { transform: translateY(6px) scale(1.06); }
          80%  { transform: translateY(-3px) scale(0.98); }
          100% { opacity:1; transform: translateY(0) scale(1); }
        }
        @keyframes ss-rise {
          from { opacity:0; transform: translateY(16px); }
          to   { opacity:1; transform: translateY(0); }
        }
        @keyframes ss-glow {
          0%,100% { box-shadow: 0 0 40px rgba(249,115,22,0.35), 0 0 80px rgba(249,115,22,0.1); }
          50%     { box-shadow: 0 0 60px rgba(249,115,22,0.55), 0 0 120px rgba(249,115,22,0.2); }
        }
        @keyframes ss-orb1 {
          0%,100% { transform: translate(0,0) scale(1); }
          50%     { transform: translate(30px,-20px) scale(1.1); }
        }
        @keyframes ss-orb2 {
          0%,100% { transform: translate(0,0) scale(1); }
          50%     { transform: translate(-25px,15px) scale(0.9); }
        }
        @keyframes ss-tip {
          0%   { opacity:0; transform: translateY(6px); }
          15%  { opacity:1; transform: translateY(0); }
          85%  { opacity:1; transform: translateY(0); }
          100% { opacity:0; transform: translateY(-6px); }
        }
        @keyframes ss-bar-shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes ss-particle {
          0%   { opacity:0.7; transform: translateY(0) scale(1); }
          100% { opacity:0; transform: translateY(-60px) scale(0); }
        }
        .ss-tip-key { animation: ss-tip 1.8s ease both; }
      `}</style>
      <div style={{
        position: 'absolute', width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 70%)',
        top: '10%', left: '20%', animation: 'ss-orb1 6s ease-in-out infinite',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(234,88,12,0.06) 0%, transparent 70%)',
        bottom: '15%', right: '15%', animation: 'ss-orb2 8s ease-in-out infinite',
        pointerEvents: 'none',
      }} />

      {[...Array(8)].map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: 3 + (i % 3),
          height: 3 + (i % 3),
          borderRadius: '50%',
          background: `rgba(249,115,22,${0.2 + (i % 4) * 0.1})`,
          left: `${15 + i * 10}%`,
          bottom: `${20 + (i % 3) * 15}%`,
          animation: `ss-particle ${3 + i * 0.4}s ease-out ${i * 0.3}s infinite`,
          pointerEvents: 'none',
        }} />
      ))}

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, position: 'relative' }}>
        <div style={{
          width: 88, height: 88, borderRadius: 24,
          background: 'linear-gradient(145deg,#f97316 0%,#ea580c 60%,#c2410c 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: phase >= 0 ? 'ss-drop 0.6s cubic-bezier(0.16,1,0.3,1) both, ss-glow 3s ease-in-out 1s infinite' : 'none',
          position: 'relative', marginBottom: 28,
          flexShrink: 0,
        }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
            borderRadius: '24px 24px 0 0',
            background: 'linear-gradient(180deg,rgba(255,255,255,0.18) 0%,transparent 100%)',
            pointerEvents: 'none',
          }} />
          <BookOpen size={40} color="#fff" style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.4))' }} />
        </div>

        <div style={{
          textAlign: 'center', marginBottom: 40,
          opacity: phase >= 1 ? 1 : 0,
          animation: phase >= 1 ? 'ss-rise 0.5s cubic-bezier(0.16,1,0.3,1) both' : 'none',
        }}>
          <h1 style={{
            fontFamily: "'Segoe UI Variable Display','Segoe UI Variable','Segoe UI',system-ui,-apple-system,sans-serif", fontWeight: 900, fontSize: 36,
            letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 8,
            background: 'linear-gradient(135deg,#f97316 0%,#fb923c 45%,#fbbf24 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>akaReader</h1>
          <p style={{ color: '#475569', fontSize: 13, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Manga · Manhwa · Manhua
          </p>
        </div>

        <div style={{
          width: 220, opacity: phase >= 2 ? 1 : 0,
          animation: phase >= 2 ? 'ss-rise 0.4s ease both' : 'none',
        }}>
          <div style={{
            height: 3, borderRadius: 2,
            background: 'rgba(255,255,255,0.06)',
            overflow: 'hidden', marginBottom: 14,
          }}>
            <div style={{
              height: '100%', borderRadius: 2,
              width: `${barW}%`,
              background: 'linear-gradient(90deg,#f97316,#fb923c,#fbbf24,#f97316)',
              backgroundSize: '200% 100%',
              animation: 'ss-bar-shimmer 1.5s linear infinite',
              transition: 'width 0.3s ease',
              boxShadow: '0 0 8px rgba(249,115,22,0.6)',
            }} />
          </div>

          <div style={{ height: 20, overflow: 'hidden', textAlign: 'center' }}>
            <p style={{
              color: '#64748b', fontSize: 12, fontWeight: 500, transition: 'all 0.3s',
            }}>
              {statusMsg}
            </p>
          </div>

          {hasFailed && (
            <div className="anim-fadeInUp" style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'center' }}>
              <button
                onClick={onProceed}
                style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', fontSize: 13, cursor: 'pointer', transition: 'all 0.2s' }}
              >
                Proceed Offline
              </button>
              <button
                onClick={onRetry}
                style={{ padding: '8px 16px', borderRadius: 8, background: 'linear-gradient(135deg,#f97316,#ea580c)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(249,115,22,0.3)', transition: 'all 0.2s' }}
              >
                Retry Connection
              </button>
            </div>
          )}
        </div>

      </div>

      <div style={{
        position: 'absolute', bottom: 24,
        fontSize: 11, color: '#1e293b', fontWeight: 500, letterSpacing: '0.05em',
        opacity: phase >= 2 ? 1 : 0,
        transition: 'opacity 0.5s ease 1s',
      }}>
        {appVersion ? `v${appVersion}` : ''}
      </div>
    </div>
  );
});

// ==================== DISCOVER TAB ====================

const MANGA_GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror',
  'Mystery', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Thriller',
  'Supernatural', 'Psychological', 'Historical', 'Mecha', 'Isekai',
  'School', 'Martial Arts', 'Cooking',
];

const CardSlot = ({ children }) => (
  <div style={{ width: 148, minWidth: 148, flexShrink: 0 }}>{children}</div>
);

const _discoverCache = new Map();

const DiscoverRow = memo(({ source, query, label, onSelect, progress, rowIndex = 0 }) => {
  const [metas, setMetas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const scrollRef = useRef(null);
  const { fetchJSON } = useData();

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setErrored(false); setMetas([]);
    const delay = rowIndex * 400;
    const cacheKey = `${source.id}:${query || ''}`;
    const cached = _discoverCache.get(cacheKey);
    if (cached) {
      setMetas(cached); setLoading(false); setErrored(false);
      return () => { cancelled = true; };
    }
    const timer = setTimeout(() => {
      fetchJSON(`/source/${source.id}/search?q=${encodeURIComponent(query || '')}&page=1`)
        .then(d => {
          if (!cancelled) {
            const results = (d.results || []).slice(0, 20);
            if (_discoverCache.size >= 100) {
              const firstKey = _discoverCache.keys().next().value;
              _discoverCache.delete(firstKey);
            }
            _discoverCache.set(cacheKey, results);
            setMetas(results);
            setLoading(false);
          }
        })
        .catch(() => { if (!cancelled) { setErrored(true); setLoading(false); } });
    }, delay);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [source.id, query, rowIndex, fetchJSON]);

  if (errored && !loading) return null;

  const scroll = d => scrollRef.current?.scrollBy({ left: d * 600, behavior: 'smooth' });

  return (
    <div style={{ marginBottom: 38 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        {source.icon && (
          <img src={source.icon} alt=""
            style={{ width: 22, height: 22, borderRadius: 6, objectFit: 'contain', flexShrink: 0 }}
            onError={e => e.target.style.display = 'none'} />
        )}
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', flex: 1 }}>
          {label}
        </h3>
        <div style={{ display: 'flex', gap: 4 }}>
          {[-1, 1].map(d => (
            <button key={d} onClick={() => scroll(d)}
              style={{
                width: 26, height: 26, borderRadius: '50%', background: 'var(--card)',
                border: '1px solid var(--border)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', color: 'var(--muted)',
                transition: 'background .15s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--card2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--card)'}>
              {d < 0 ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
            </button>
          ))}
        </div>
      </div>

      <div ref={scrollRef}
        style={{
          display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8,
          msOverflowStyle: 'none', scrollbarWidth: 'none'
        }}>
        <style>{`.discover-row::-webkit-scrollbar{display:none}`}</style>
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
            <CardSlot key={i}>
              <div className="anim-shimmer"
                style={{ width: 148, height: 222, borderRadius: 14 }} />
            </CardSlot>
          ))
          : metas.length === 0
            ? (
              <div style={{ padding: '20px 0', color: 'var(--muted)', fontSize: 13 }}>
                No results from this source
              </div>
            )
            : metas.map((m, i) => (
              <CardSlot key={getMangaKey(m.id, source.id)}>
                <MangaCard
                  manga={{ ...m, sourceId: source.id }}
                  onClick={onSelect}
                  index={i}
                  progress={progress?.[getMangaKey(m.id, source.id)]
                    ? Math.round((parseInt(progress[getMangaKey(m.id, source.id)].chapterNum) || 0) / 100 * 100)
                    : 0}
                />
              </CardSlot>
            ))
        }
      </div>
    </div>
  );
});

const DiscoverTab = memo(({ sources, history, library, progress, onSelect, onContinue, onSwitchTab }) => {
  const { fetchJSON, getMangaKey } = useData();
  const installedSources = useMemo(() => Object.values(sources), [sources]);

  const [activeGenre, setActiveGenre] = useState(null);
  const [genreResults, setGenreResults] = useState({});
  const [genreLoading, setGenreLoading] = useState(false);
  const [genreSearch, setGenreSearch] = useState('');

  const userGenres = useMemo(() => {
    const freq = {};
    MANGA_GENRES.forEach(g => {
      const lower = g.toLowerCase();
      const hits = [...library, ...history].filter(m =>
        (m.title || '').toLowerCase().includes(lower) ||
        (m.author || '').toLowerCase().includes(lower)
      ).length;
      if (hits > 0) freq[g] = hits;
    });
    const byFreq = Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([g]) => g);
    return byFreq.length >= 3 ? byFreq.slice(0, 8) : MANGA_GENRES.slice(0, 12);
  }, [library, history]);

  const continueItems = useMemo(() => {
    return history
      .filter(m => progress[getMangaKey(m.id, m.sourceId)])
      .slice(0, 12);
  }, [history, progress, getMangaKey]);

  const searchGenre = useCallback(async (genre) => {
    if (!genre || installedSources.length === 0) return;
    setActiveGenre(genre);
    setGenreLoading(true);
    setGenreResults({});
    const results = {};
    await Promise.allSettled(
      installedSources.map(async src => {
        try {
          const d = await fetchJSON(`/source/${src.id}/search?q=${encodeURIComponent(genre)}&page=1`);
          results[src.id] = {
            name: src.name, icon: src.icon,
            metas: (d.results || []).slice(0, 20),
          };
        } catch {
          results[src.id] = { name: src.name, icon: src.icon, metas: [] };
        }
      })
    );
    setGenreResults(results);
    setGenreLoading(false);
  }, [installedSources, fetchJSON]);

  const clearGenre = () => { setActiveGenre(null); setGenreResults({}); };

  const filteredGenres = useMemo(() => {
    if (!genreSearch.trim()) return MANGA_GENRES;
    const q = genreSearch.toLowerCase();
    return MANGA_GENRES.filter(g => g.toLowerCase().includes(q));
  }, [genreSearch]);

  if (installedSources.length === 0) {
    return (
      <EmptyState icon={Globe} title="No sources installed"
        sub="Install extensions first to start discovering manga"
        action={
          <Btn onClick={() => onSwitchTab?.('extensions')}>
            Browse Extensions <ArrowRight size={16} />
          </Btn>
        }
      />
    );
  }

  return (
    <div className="page-transition">

      <div style={{
        marginBottom: 32, padding: '18px 20px', background: 'var(--card)',
        borderRadius: 16, border: '1.5px solid var(--border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', flex: 1 }}>
            Browse by Genre
          </p>
          {activeGenre && (
            <button onClick={clearGenre}
              style={{
                fontSize: 12, color: '#f87171', background: 'transparent',
                border: '1px solid rgba(239,68,68,.25)', borderRadius: 20, padding: '4px 10px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5
              }}>
              <X size={10} /> Clear "{activeGenre}"
            </button>
          )}
        </div>

        <div style={{ position: 'relative', marginBottom: 12 }}>
          <Search size={13} style={{
            position: 'absolute', left: 11, top: '50%',
            transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none'
          }} />
          <input
            placeholder="Filter genres…"
            value={genreSearch}
            onChange={e => setGenreSearch(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px 8px 32px', borderRadius: 9,
              background: 'var(--card2)', border: '1.5px solid var(--border)',
              color: 'var(--text)', fontSize: 12, outline: 'none', transition: 'border .2s'
            }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
        </div>

        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {filteredGenres.map(g => {
            const isUser = userGenres.includes(g);
            const isActive = activeGenre === g;
            return (
              <button key={g} onClick={() => isActive ? clearGenre() : searchGenre(g)}
                style={{
                  padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', transition: 'all .14s', userSelect: 'none',
                  background: isActive ? 'var(--accent)' : isUser ? 'rgba(249,115,22,.1)' : 'var(--card2)',
                  color: isActive ? '#fff' : isUser ? 'var(--accent)' : 'var(--text-dim)',
                  border: isActive ? 'none'
                    : isUser ? '1px solid rgba(249,115,22,.3)'
                      : '1px solid var(--border)'
                }}>
                {g}
              </button>
            );
          })}
          {filteredGenres.length === 0 && (
            <span style={{ fontSize: 12, color: 'var(--muted)', padding: '6px 0' }}>
              No genres match "{genreSearch}"
            </span>
          )}
        </div>
        {userGenres.length > 0 && !genreSearch && (
          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10, opacity: .6 }}>
            Highlighted = genres matching your library
          </p>
        )}
      </div>

      {activeGenre && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 20 }}>
            "{activeGenre}" across {installedSources.length} source{installedSources.length !== 1 ? 's' : ''}
          </h2>
          {genreLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
              {installedSources.map(src => (
                <div key={src.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <div className="anim-shimmer" style={{ width: 22, height: 22, borderRadius: 6 }} />
                    <div className="anim-shimmer" style={{ width: 120, height: 16, borderRadius: 6 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <CardSlot key={i}>
                        <div className="anim-shimmer" style={{ width: 148, height: 222, borderRadius: 14 }} />
                      </CardSlot>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {Object.entries(genreResults)
                .filter(([, v]) => v.metas.length > 0)
                .map(([srcId, row]) => (
                  <div key={srcId} style={{ marginBottom: 36 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      {row.icon && (
                        <img src={row.icon} alt=""
                          style={{ width: 22, height: 22, borderRadius: 6, objectFit: 'contain' }}
                          onError={e => e.target.style.display = 'none'} />
                      )}
                      <h3 style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>{row.name}</h3>
                      <Badge variant="outline" size="sm">{row.metas.length} results</Badge>
                    </div>
                    <div style={{
                      display: 'flex', gap: 12, overflowX: 'auto',
                      paddingBottom: 8, scrollbarWidth: 'none', msOverflowStyle: 'none'
                    }}>
                      {row.metas.map((m, i) => (
                        <CardSlot key={getMangaKey(m.id, srcId)}>
                          <MangaCard manga={{ ...m, sourceId: srcId }} onClick={onSelect} index={i} eager />
                        </CardSlot>
                      ))}
                    </div>
                  </div>
                ))}
              {Object.values(genreResults).every(v => v.metas.length === 0) && (
                <EmptyState icon={Search} title={`No results for "${activeGenre}"`}
                  sub="Try a different genre or check your sources are working" compact />
              )}
            </>
          )}
        </div>
      )}

      {!activeGenre && continueItems.length > 0 && (
        <div style={{ marginBottom: 38 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Clock size={14} style={{ color: 'var(--accent)' }} />
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', flex: 1 }}>
              Continue Reading
            </h3>
          </div>
          <div style={{
            display: 'flex', gap: 12, overflowX: 'auto',
            paddingBottom: 8, scrollbarWidth: 'none', msOverflowStyle: 'none'
          }}>
            {continueItems.map((m, i) => {
              const mKey = getMangaKey(m.id, m.sourceId);
              const p = progress[mKey];
              const pct = p ? Math.min(100, Math.round((parseInt(p.chapterNum) || 0) * 3)) : 0;
              return (
                <CardSlot key={getMangaKey(m.id, m.sourceId)}>
                  <MangaCard
                    manga={{ ...m }}
                    onClick={onContinue || onSelect}
                    index={i}
                    eager
                    progress={pct}
                    badge={p ? `Ch.${p.chapterNum}` : null}
                  />
                </CardSlot>
              );
            })}
          </div>
        </div>
      )}

      {!activeGenre && (
        <MoodDiscovery sources={sources} onSelect={onSelect} />
      )}

      {!activeGenre && installedSources.map((src, idx) => (
        <DiscoverRow
          key={src.id}
          source={src}
          query=""
          label={`Popular on ${src.name}`}
          onSelect={onSelect}
          progress={progress}
          rowIndex={idx}
        />
      ))}
    </div>
  );
});

// ==================== MANGA NOTES ====================

const MangaNotes = memo(({ mangaId, mangaTitle }) => {
  const key = `aka:note:${mangaId}`;
  const [note, setNote] = useState(() => localStorage.getItem(key) || '');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note);
  const save = () => { localStorage.setItem(key, draft); setNote(draft); setEditing(false); };
  const discard = () => { setDraft(note); setEditing(false); };
  if (!mangaId) return null;
  return (
    <div style={{ padding: '14px 18px', background: 'var(--card)', borderRadius: 14, border: '1.5px solid var(--border)', marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: editing || note ? 10 : 0 }}>
        <StickyNote size={14} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', flex: 1 }}>Your Notes</span>
        {!editing && (
          <Btn variant="ghost" size="sm" onClick={() => { setDraft(note); setEditing(true); }} icon={Pencil} style={{ fontSize: 12 }}>
            {note ? 'Edit' : 'Add note'}
          </Btn>
        )}
      </div>
      {editing ? (
        <>
          <textarea value={draft} onChange={e => setDraft(e.target.value)} autoFocus
            placeholder="Notes, reminders, what you thought of it…"
            style={{ width: '100%', minHeight: 90, padding: '10px 12px', borderRadius: 10, background: 'var(--card2)', border: '1.5px solid var(--border)', color: 'var(--text)', fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'inherit', lineHeight: 1.7 }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Btn size="sm" onClick={save} icon={Check}>Save</Btn>
            <Btn variant="ghost" size="sm" onClick={discard}>Discard</Btn>
            {note && <Btn variant="danger" size="sm" onClick={() => { localStorage.removeItem(key); setNote(''); setDraft(''); setEditing(false); }} icon={Trash2}>Delete</Btn>}
          </div>
        </>
      ) : note ? (
        <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{note}</p>
      ) : null}
    </div>
  );
});

// ==================== SOURCE MIGRATION ====================

const SourceMigrationModal = memo(({ manga, sources, onClose, onMigrate }) => {
  const { fetchJSON } = useData();
  const toast = useToast();
  const [results, setResults] = useState({}); // { sourceId: { status, items } }
  const [migrating, setMigrating] = useState(false);

  const installedSources = useMemo(() =>
    Object.values(sources).filter(s => s.id !== String(manga?.sourceId)),
    [sources, manga?.sourceId]
  );

  useEffect(() => {
    if (!manga || installedSources.length === 0) return;
    const query = manga.title;

    installedSources.forEach(async src => {
      setResults(prev => ({ ...prev, [src.id]: { status: 'loading', items: [] } }));
      try {
        const d = await fetchJSON(`/source/${src.id}/search?q=${encodeURIComponent(query)}&page=1`);
        const items = Array.isArray(d) ? d : (d?.results || []);
        setResults(prev => ({ ...prev, [src.id]: { status: 'done', items: items.slice(0, 5) } }));
      } catch {
        setResults(prev => ({ ...prev, [src.id]: { status: 'error', items: [] } }));
      }
    });
  }, [manga, installedSources, fetchJSON]);

  if (!manga) return null;

  return (
    <div className="anim-fadeIn" onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.82)', backdropFilter: 'blur(12px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} className="anim-fadeInUp"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: '28px 28px 24px', maxWidth: 620, width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,.7)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(249,115,22,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RefreshCw size={18} style={{ color: 'var(--accent)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontWeight: 800, fontSize: 17, margin: 0 }}>Migrate Source</h2>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>{manga.title}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', borderRadius: 8, padding: 4 }}><X size={18} /></button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 18, lineHeight: 1.6, borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
          Searching {installedSources.length} other source{installedSources.length !== 1 ? 's' : ''} for a match. Your reading progress will be transferred automatically.
        </p>
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {installedSources.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)', fontSize: 14 }}>
              No other sources installed. Install more extensions first.
            </div>
          )}
          {installedSources.map(src => {
            const r = results[src.id] || { status: 'loading', items: [] };
            return (
              <div key={src.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  {src.icon ? <img src={src.icon} style={{ width: 18, height: 18, borderRadius: 4 }} alt="" /> : <Globe size={15} style={{ color: 'var(--muted)' }} />}
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{src.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>
                    {r.status === 'loading' ? '⏳ Searching...' : r.status === 'error' ? '❌ Failed' : `${r.items.length} results`}
                  </span>
                </div>
                {r.status === 'loading' && (
                  <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: 'var(--card2)', borderRadius: 10 }}>
                    <Spin size={14} /><span style={{ fontSize: 12, color: 'var(--muted)' }}>Searching...</span>
                  </div>
                )}
                {r.items.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {r.items.map(item => (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--card2)', borderRadius: 12, border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.2s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'rgba(249,115,22,0.05)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--card2)'; }}
                        onClick={async () => {
                          setMigrating(true);
                          try {
                            await onMigrate(manga, item, src);
                            toast(`Migrated to ${src.name}!`, 'success');
                            onClose();
                          } catch { toast('Migration failed', 'error'); }
                          setMigrating(false);
                        }}>
                        {item.cover && <img src={item.cover} alt="" style={{ width: 36, height: 50, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</p>
                          {item.status && <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{item.status}</p>}
                        </div>
                        <Btn size="sm" variant="outline" disabled={migrating}>
                          {migrating ? <Spin size={12} /> : 'Migrate →'}
                        </Btn>
                      </div>
                    ))}
                  </div>
                )}
                {r.status === 'done' && r.items.length === 0 && (
                  <p style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 14px', background: 'var(--card2)', borderRadius: 10 }}>No results found on this source.</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

// ==================== CATCH-UP MODE ====================

const CatchUpModal = memo(({ manga, onClose, onJumpTo }) => {
  const chapters = manga?.chapters || [];
  const unread = [...chapters].reverse();
  const total = unread.length;
  const displayChapters = total > 0 ? unread : [...(manga?.chapters || [])].reverse();
  const displayTotal = displayChapters.length;
  if (!displayTotal) return null;

  const arcs = [];
  for (let i = 0; i < displayTotal; i += 10) arcs.push(displayChapters.slice(i, i + 10));

  return (
    <div className="anim-fadeIn" onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.78)',
        backdropFilter: 'blur(10px)', zIndex: 1800, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 24
      }}>
      <div onClick={e => e.stopPropagation()} className="anim-fadeInUp"
        style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-xl)', padding: '28px 28px 24px', maxWidth: 560,
          width: '100%', maxHeight: '80vh', display: 'flex',
          flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,.6)'
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <Zap size={18} style={{ color: 'var(--accent)' }} />
          <h2 style={{ fontWeight: 800, fontSize: 17, flex: 1 }}>Catch-Up: {manga.title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
            <X size={18} />
          </button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 18, lineHeight: 1.6 }}>
          {displayTotal} unread chapter{displayTotal !== 1 ? 's' : ''} — jump straight to any point without spoiling yourself.
        </p>
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {arcs.map((arc, ai) => (
            <div key={ai} style={{
              background: 'var(--card2)', borderRadius: 12,
              border: '1px solid var(--border)', overflow: 'hidden'
            }}>
              <div style={{
                padding: '10px 14px', background: 'rgba(249,115,22,.07)',
                borderBottom: '1px solid var(--border)', display: 'flex',
                alignItems: 'center', justifyContent: 'space-between'
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
                  Ch. {arc[0].number} – {arc[arc.length - 1].number}
                </span>
                <Btn size="sm" variant="outline"
                  onClick={() => { onJumpTo(arc[0]); onClose(); }}>
                  Start here
                </Btn>
              </div>
              <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {arc.map(ch => (
                  <div key={ch.id} style={{
                    display: 'flex', alignItems: 'center',
                    gap: 10, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,.04)'
                  }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 40 }}>
                      Ch.{ch.number}
                    </span>
                    <span title={ch.title}
                      style={{
                        fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap', color: 'var(--text-dim)',
                        filter: 'blur(4px)', transition: 'filter .2s', cursor: 'default'
                      }}
                      onMouseEnter={e => e.currentTarget.style.filter = 'none'}
                      onMouseLeave={e => e.currentTarget.style.filter = 'blur(4px)'}>
                      {ch.title || `Chapter ${ch.number}`}
                    </span>
                    <button onClick={() => { onJumpTo(ch); onClose(); }}
                      style={{
                        fontSize: 10, color: 'var(--accent)', background: 'none',
                        border: 'none', cursor: 'pointer', flexShrink: 0, fontWeight: 700
                      }}>
                      Jump →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Btn style={{ marginTop: 16 }} onClick={() => { onJumpTo(displayChapters[0]); onClose(); }}
          icon={Play}>
          Read from the beginning
        </Btn>
      </div>
    </div>
  );
});

// ==================== DUPLICATE DETECTOR ====================

const findDuplicates = (library) => {
  const normalize = t => (t || '').toLowerCase()
    .replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  const groups = {};
  library.forEach(m => {
    const key = normalize(m.title);
    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  });
  return Object.values(groups).filter(g => g.length > 1);
};

const DuplicateBanner = memo(({ library, onRemove }) => {
  const [dismissed, setDismissed] = useState(() =>
    JSON.parse(localStorage.getItem('aka:dup-dismissed') || '[]')
  );
  const dupes = useMemo(() => findDuplicates(library), [library]);
  const visible = dupes.filter(g =>
    !dismissed.includes(g.map(m => getMangaKey(m.id, m.sourceId)).sort().join(','))
  );
  if (!visible.length) return null;
  const dismiss = (g) => {
    const key = g.map(m => getMangaKey(m.id, m.sourceId)).sort().join(',');
    const next = [...dismissed, key];
    setDismissed(next);
    localStorage.setItem('aka:dup-dismissed', JSON.stringify(next));
  };
  return (
    <div style={{ marginBottom: 20 }}>
      {visible.map(g => {
        const key = g.map(m => m.id).sort().join(',');
        return (
          <div key={key} className="anim-fadeIn"
            style={{
              padding: '12px 16px', borderRadius: 12, marginBottom: 8,
              background: 'rgba(234,179,8,.07)', border: '1px solid rgba(234,179,8,.25)',
              display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap'
            }}>
            <AlertTriangle size={15} style={{ color: '#facc15', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'var(--text)', flex: 1, minWidth: 200 }}>
              <strong>"{g[0].title}"</strong> appears {g.length}× in your library from different sources.
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              {g.map((m, i) => (
                <Btn key={getMangaKey(m.id, m.sourceId)} variant="danger" size="sm"
                  onClick={() => { onRemove(m.id, m.sourceId); dismiss(g.filter(x => getMangaKey(x.id, x.sourceId) !== getMangaKey(m.id, m.sourceId)).concat([m])); }}>
                  Remove #{i + 1}
                </Btn>
              ))}
              <Btn variant="ghost" size="sm" onClick={() => dismiss(g)}>Ignore</Btn>
            </div>
          </div>
        );
      })}
    </div>
  );
});

const MOOD_DATA = [
  { id: 'dark', emoji: '🖤', label: 'Dark & Gritty', vibe: 'psychological thriller violence revenge', color: '#1a1a2e', accent: '#e94560' },
  { id: 'cozy', emoji: '☕', label: 'Cozy & Warm', vibe: 'slice of life cooking school romance daily', color: '#2d1b00', accent: '#f59e0b' },
  { id: 'hype', emoji: '🔥', label: 'Hype & Action', vibe: 'action battle power tournament fight', color: '#1a0a00', accent: '#f97316' },
  { id: 'feels', emoji: '💧', label: 'Emotional', vibe: 'drama tragedy loss family emotional cry', color: '#001a2c', accent: '#60a5fa' },
  { id: 'laugh', emoji: '😂', label: 'Comedy', vibe: 'comedy funny gag parody school', color: '#0a1a00', accent: '#4ade80' },
  { id: 'fantasy', emoji: '✨', label: 'Fantasy & Magic', vibe: 'fantasy magic isekai adventure world', color: '#1a0030', accent: '#a78bfa' },
  { id: 'romance', emoji: '🌸', label: 'Romance', vibe: 'romance love confession shoujo heartbeat', color: '#2d0015', accent: '#f472b6' },
  { id: 'short', emoji: '⚡', label: 'Quick Read', vibe: 'one shot completed short chapters', color: '#001a1a', accent: '#34d399' },
  { id: 'mystery', emoji: '🔍', label: 'Mystery', vibe: 'mystery detective horror suspense secret', color: '#0f0f1a', accent: '#818cf8' },
  { id: 'scifi', emoji: '🚀', label: 'Sci-Fi', vibe: 'science fiction space mecha future robot', color: '#001020', accent: '#38bdf8' },
];

const ReadingReceipt = memo(({ chapter, pagesRead, timeSeconds, mangaTitle, hasNext, onNext, onBack }) => {
  const mins = Math.round(timeSeconds / 60);
  const pps = pagesRead && timeSeconds > 0 ? (pagesRead / timeSeconds * 60).toFixed(1) : '?';
  return (
    <div className="anim-scaleIn" style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(5,6,10,0.97)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 24
    }}>
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.04,
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        pointerEvents: 'none'
      }} />

      <div style={{ maxWidth: 380, width: '100%', textAlign: 'center' }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%', margin: '0 auto 24px',
          background: 'linear-gradient(135deg,var(--accent),var(--accent2))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 40px rgba(249,115,22,0.4), 0 0 80px rgba(249,115,22,0.15)',
          animation: 'float 3s ease-in-out infinite'
        }}>
          <Check size={32} color="#fff" strokeWidth={2.5} />
        </div>

        <p style={{
          fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '.22em',
          color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8
        }}>
          Chapter Complete
        </p>
        <h2 style={{
          fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800,
          lineHeight: 1.2, marginBottom: 4
        }}>
          Ch. {chapter?.number}
        </h2>
        {chapter?.title && chapter.title !== `Chapter ${chapter?.number}` && (
          <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 24 }}>
            {chapter.title}
          </p>
        )}

        <div style={{
          display: 'flex', gap: 1, margin: '24px 0', borderRadius: 'var(--r-md)',
          overflow: 'hidden', border: '1px solid var(--border)'
        }}>
          {[
            { label: 'Pages', value: pagesRead || '?' },
            { label: 'Time', value: mins > 0 ? `${mins}m` : '<1m' },
            { label: 'Pace', value: `${pps}/min` },
          ].map(({ label, value }, i) => (
            <div key={i} style={{
              flex: 1, padding: '16px 12px', background: 'var(--card)',
              borderRight: i < 2 ? '1px solid var(--border)' : ''
            }}>
              <p style={{
                fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800,
                color: 'var(--accent)', lineHeight: 1
              }}>{value}</p>
              <p style={{
                fontSize: 10, color: 'var(--muted)', marginTop: 4,
                textTransform: 'uppercase', letterSpacing: '.1em'
              }}>{label}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {hasNext && (
            <button onClick={onNext}
              style={{
                width: '100%', padding: '14px', borderRadius: 'var(--r-md)',
                background: 'linear-gradient(135deg,var(--accent),var(--accent2))',
                color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 700,
                fontSize: 15, border: 'none', cursor: 'pointer',
                boxShadow: '0 8px 28px rgba(249,115,22,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all var(--t-fast) var(--ease-out)'
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 36px rgba(249,115,22,0.5)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 8px 28px rgba(249,115,22,0.4)'; }}>
              Next Chapter <ChevronRight size={18} />
            </button>
          )}
          <button onClick={onBack}
            style={{
              width: '100%', padding: '12px', borderRadius: 'var(--r-md)',
              background: 'transparent', color: 'var(--text-dim)',
              fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14,
              border: '1px solid var(--border)', cursor: 'pointer',
              transition: 'all var(--t-fast)'
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
            Back to {mangaTitle ? mangaTitle.slice(0, 24) + '…' : 'manga'}
          </button>
        </div>
      </div>
    </div>
  );
});

const MoodDiscovery = memo(({ sources, onSelect }) => {
  const { fetchJSON } = useData();
  const [activeMood, setActiveMood] = useState(null);
  const [results, setResults] = useState({});
  const [searching, setSearching] = useState(false);
  const [hovered, setHovered] = useState(null);

  const installedSources = useMemo(() => Object.values(sources), [sources]);

  const searchMood = useCallback(async (mood) => {
    if (!mood || !installedSources.length) return;
    setActiveMood(mood);
    setSearching(true);
    setResults({});
    const res = {};
    await Promise.allSettled(installedSources.slice(0, 3).map(async src => {
      try {
        const d = await fetchJSON(`/source/${src.id}/search?q=${encodeURIComponent(mood.vibe)}&page=1`);
        res[src.id] = { name: src.name, metas: (d.results || []).slice(0, 8) };
      } catch { res[src.id] = { name: src.name, metas: [] }; }
    }));
    setResults(res);
    setSearching(false);
  }, [installedSources, fetchJSON]);

  const allMetas = useMemo(() =>
    Object.values(results).flatMap(r => r.metas).slice(0, 16),
    [results]
  );

  if (installedSources.length === 0) return null;

  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <Sparkles size={15} style={{ color: 'var(--accent)' }} />
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>
          What's your mood?
        </h2>
        {activeMood && (
          <button onClick={() => { setActiveMood(null); setResults({}); }}
            style={{
              marginLeft: 'auto', fontSize: 11, color: 'var(--muted)',
              background: 'transparent', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4
            }}>
            <X size={11} /> Clear
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 8, marginBottom: 24 }}>
        {MOOD_DATA.map(m => {
          const isActive = activeMood?.id === m.id;
          const isHov = hovered === m.id;
          return (
            <button key={m.id}
              onClick={() => isActive ? (setActiveMood(null), setResults({})) : searchMood(m)}
              onMouseEnter={() => setHovered(m.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                padding: '14px 10px', borderRadius: 'var(--r-md)', cursor: 'pointer',
                border: `1.5px solid ${isActive ? m.accent : isHov ? 'rgba(255,255,255,0.12)' : 'var(--border)'}`,
                background: isActive
                  ? `${m.color}ee`
                  : isHov
                    ? 'var(--card2)'
                    : 'var(--card)',
                transition: 'all var(--t-fast) var(--ease-out)',
                transform: isActive || isHov ? 'translateY(-2px)' : '',
                boxShadow: isActive ? `0 8px 24px ${m.accent}30` : isHov ? 'var(--shadow-md)' : '',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              }}>
              <span style={{ fontSize: 22 }}>{m.emoji}</span>
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: isActive ? m.accent : 'var(--text-dim)',
                lineHeight: 1.2, textAlign: 'center'
              }}>
                {m.label}
              </span>
            </button>
          );
        })}
      </div>

      {activeMood && (
        <div className="anim-fadeUp">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 18 }}>{activeMood.emoji}</span>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>
              {activeMood.label}
            </h3>
            {searching && <Spin size={14} />}
            {!searching && allMetas.length > 0 && (
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{allMetas.length} found</span>
            )}
          </div>
          {searching ? (
            <div style={{ display: 'flex', gap: 12, overflow: 'hidden' }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{
                  width: 148, minWidth: 148, height: 222,
                  borderRadius: 'var(--r-md)', flexShrink: 0
                }}
                  className="shimmer" />
              ))}
            </div>
          ) : allMetas.length > 0 ? (
            <div style={{
              display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8,
              scrollbarWidth: 'none', msOverflowStyle: 'none'
            }}>
              {allMetas.map((m, i) => (
                <div key={m.id} style={{ width: 148, minWidth: 148, flexShrink: 0 }}>
                  <MangaCard manga={m} onClick={onSelect} index={i} eager />
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>
              No results found — try installing more sources
            </p>
          )}
        </div>
      )}
    </div>
  );
});

const ShareCardModal = memo(({ library, history, progress, readChapters, settings, onClose }) => {
  const { getMangaKey } = useData();
  const canvasRef = useRef(null);
  const [rendered, setRendered] = useState(false);
  const [style, setStyle] = useState('reading');

  const totalRead = useMemo(() =>
    Object.values(readChapters).reduce((a, v) => a + (v?.length || 0), 0), [readChapters]);
  const streak = useMemo(() => calculateStreak(history), [history]);
  const accent = settings?.accentColor || '#f97316';

  const draw = useCallback(async () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = 480, H = 280;
    canvas.width = W; canvas.height = H;

    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, W, H);

    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, accent);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, 3);

    const top = library.slice(0, 3);
    const IMG_W = 80, IMG_H = 120;
    const startX = W - (top.length * (IMG_W + 10)) - 20;

    for (let i = 0; i < top.length; i++) {
      const m = top[i];
      if (m.cover) {
        try {
          await new Promise((res, rej) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              const x = startX + i * (IMG_W + 10);
              ctx.save();
              ctx.beginPath();
              ctx.roundRect(x, 80, IMG_W, IMG_H, 8);
              ctx.clip();
              ctx.drawImage(img, x, 80, IMG_W, IMG_H);
              ctx.restore();
              ctx.fillStyle = 'rgba(0,0,0,0.25)';
              ctx.save();
              ctx.beginPath();
              ctx.roundRect(x, 80, IMG_W, IMG_H, 8);
              ctx.clip();
              ctx.fillRect(x, 80, IMG_W, IMG_H);
              ctx.restore();
              res();
            };
            img.onerror = res;
            img.src = proxyImg(m.cover);
          });
        } catch { }
      }
    }

    ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = accent;
    ctx.fillText('akaReader', 24, 40);

    ctx.font = 'bold 22px "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#e2e8f0';
    if (style === 'stats') {
      ctx.fillText('My Reading Stats', 24, 72);
      const items = [
        [`${library.length}`, 'manga in library'],
        [`${totalRead}`, 'chapters read'],
        [`${streak}`, 'day streak 🔥'],
        [`${history.length}`, 'titles explored'],
      ];
      items.forEach(([val, label], i) => {
        const row = 110 + i * 38;
        ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle = accent;
        ctx.fillText(val, 24, row);
        ctx.font = '13px "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText(label, 24 + ctx.measureText(val).width + 8, row);
      });
    } else {
      ctx.fillText(style === 'reading' ? 'Currently Reading' : 'My Library', 24, 72);
      const shown = (style === 'reading' ? history : library).slice(0, 4);
      shown.forEach((m, i) => {
        const row = 108 + i * 38;
        ctx.font = '13px "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText(`${i + 1}.`, 24, row);
        ctx.fillStyle = '#e2e8f0';
        const title = m.title.length > 32 ? m.title.slice(0, 30) + '…' : m.title;
        ctx.fillText(title, 44, row);
        const mKey = getMangaKey(m.id, m.sourceId);
        if (progress[mKey]) {
          ctx.fillStyle = accent;
          ctx.font = '11px "Segoe UI", system-ui, sans-serif';
          ctx.fillText(`Ch.${progress[mKey].chapterNum}`, 44, row + 16);
        }
      });
    }

    ctx.font = '11px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.fillText(`Generated ${new Date().toLocaleDateString()}`, 24, H - 16);

    setRendered(true);
  }, [library, history, progress, readChapters, accent, style, totalRead, streak]);

  useEffect(() => { draw(); }, [draw]);

  const download = () => {
    const url = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url; a.download = 'akareader-share.png';
    a.click();
  };

  const copy = async () => {
    try {
      canvasRef.current.toBlob(async blob => {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      });
    } catch { }
  };

  return (
    <div className="anim-fadeIn" onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)',
        backdropFilter: 'blur(10px)', zIndex: 1800, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 24
      }}>
      <div onClick={e => e.stopPropagation()} className="anim-fadeInUp"
        style={{
          background: 'var(--card)', border: '1.5px solid var(--border)',
          borderRadius: 20, padding: 28, maxWidth: 540, width: '100%',
          boxShadow: '0 32px 80px rgba(0,0,0,.6)'
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <Share2 size={18} style={{ color: 'var(--accent)' }} />
          <h2 style={{ fontWeight: 800, fontSize: 17, flex: 1 }}>Share Card</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[['reading', 'Currently Reading'], ['stats', 'Stats'], ['library', 'My Library']].map(([v, l]) => (
            <button key={v} onClick={() => setStyle(v)}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                border: 'none', cursor: 'pointer',
                background: style === v ? 'var(--accent)' : 'var(--card2)',
                color: style === v ? '#fff' : 'var(--muted)'
              }}>{l}</button>
          ))}
        </div>
        <div style={{
          borderRadius: 12, overflow: 'hidden', marginBottom: 16,
          border: '1px solid var(--border)', background: '#0a0a0f'
        }}>
          <canvas ref={canvasRef} style={{ width: '100%', display: 'block' }} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn onClick={download} icon={Download} style={{ flex: 1 }}>Download PNG</Btn>
          <Btn variant="outline" onClick={copy} icon={Share2}>Copy</Btn>
        </div>
      </div>
    </div>
  );
});

// ==================== MAIN APP ====================




const StatsStrip = memo(({ library, history, progress, readChapters }) => {
  const { getMangaKey } = useData();
  const totalRead = useMemo(() => Object.values(readChapters).reduce((a, v) => a + (v?.length || 0), 0), [readChapters]);
  const streak = useMemo(() => calculateStreak(history), [history]);
  const completing = useMemo(() => {
    const keys = Object.keys(progress);
    if (!keys.length) return 0;
    return keys.filter(k => {
      const p = progress[k];
      const m = library.find(m => getMangaKey(m.id, m.sourceId) === k);
      if (!m || !p) return false;
      return (parseInt(p.chapterNum) || 0) >= (m.totalChapters || 999);
    }).length;
  }, [progress, library]);

  const items = [
    { label: 'In Library', value: library.length, icon: Bookmark, color: 'var(--accent)' },
    { label: 'Chapters Read', value: totalRead, icon: BookOpen, color: '#4ade80' },
    { label: 'Day Streak', value: `${streak}🔥`, icon: Flame, color: '#fb923c' },
    { label: 'Completed', value: completing, icon: Award, color: '#a78bfa' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10, marginBottom: 28 }}>
      {items.map(item => (
        <div key={item.label} style={{ padding: '14px 16px', background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `${item.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <item.icon size={18} style={{ color: item.color }} />
          </div>
          <div>
            <p style={{ fontWeight: 800, fontSize: 20, color: 'var(--text)', lineHeight: 1 }}>{item.value}</p>
            <p style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 3 }}>{item.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
});

// ==================== APP & ROOT COMPONENT ====================

const App = memo(() => {
  const data = useData();
  const toast = useToast();
  const {
    backendOnline, sources, extensions, library, history, progress,
    mangaCategories, installing, readingTime, settings, updates, checkingUpdates,
    readChapters, markChapterRead,
    downloadQueue, setDownloadQueue, overlayHidden, setOverlayHidden,
    fetchJSON, checkHealth, fetchSources, fetchExtensions,
    installExt, uninstallExt, updateExt, toggleLibrary, setCategory,
    addToHistory, removeFromHistory, clearHistory, removeMangaCompletely, updateProgress, inLibrary,
    checkForUpdates, addReadingTime, updateSetting, handleMigrate,
    queueChaptersForDownload, cancelDownload, cancelActiveDownloads,
    suwayomiReady, setSuwayomiReady,
    categories, getMangaKey,
  } = data;

  const { downloadedKeys, refreshDownloads } = useDownloads();

  const dlProcessingRef = useRef(false);

  const [updateAvailable, setUpdateAvailable] = useState(null);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);
  const [updateDownloadPct, setUpdateDownloadPct] = useState(null);
  const [updateDownloading, setUpdateDownloading] = useState(false);
  const [releaseNotes, setReleaseNotes] = useState('');
  const updateVersionRef = useRef(null); // tracks version even when banner is dismissed
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);

  const [tab, setTab] = useState('home');
  const [view, setView] = useState('tabs');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => settings?.sidebarCollapsed || false);
  const [isNarrowViewport, setIsNarrowViewport] = useState(() => window.innerWidth < 760);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);

  const [showOnboarding, setShowOnboarding] = useState(() => !storage.get('onboardingDone', false));

  const [showErrorModal, setShowErrorModal] = useState(false);
  const [forceProceed, setForceProceed] = useState(false);
  const errorTimerRef = useRef(null);
  const sidebarIsCollapsed = sidebarCollapsed || isNarrowViewport;
  const sidebarWidth = sidebarIsCollapsed ? 76 : 248;

  useEffect(() => {
    const onResize = () => setIsNarrowViewport(window.innerWidth < 760);
    window.addEventListener('resize', onResize);
    let unsub = null;
    if (window.electronAPI?.onServicesStatus) {
      unsub = window.electronAPI.onServicesStatus((status) => {
        if (status === 'crashed' || status === 'offline') {
          setShowErrorModal(true);
        } else if (status === 'online') {
          setShowErrorModal(false);
          setForceProceed(true);
          setSuwayomiReady(true);
          checkHealth().then(() => { fetchSources(); fetchExtensions(); });
        } else if (status === 'suwayomi-starting') {
          setSuwayomiReady(false);
        } else if (status === 'suwayomi-ready') {
          setForceProceed(true);
          setSuwayomiReady(true);
          fetchSources();
          fetchExtensions();
        } else if (status.startsWith('suwayomi-failed:')) {
          setSuwayomiReady(false);
        } else if (status.startsWith('update-available:')) {
          const ver = status.split(':')[1];
          setUpdateAvailable(ver);
          updateVersionRef.current = ver;
          setUpdateDownloaded(false);
          setUpdateDownloadPct(null);
          setUpdateDownloading(false);
          setReleaseNotes('');
          // Fetch actual release notes from GitHub API
          fetch(`https://api.github.com/repos/akawazak/akareader/releases/tags/v${ver}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => { if (data?.body) setReleaseNotes(data.body); })
            .catch(() => {});
        } else if (status.startsWith('update-downloading:')) {
          setUpdateDownloadPct(status.split(':')[1]);
          setUpdateDownloading(true);
        } else if (status === 'update-downloaded') {
          setUpdateDownloaded(true);
          setUpdateDownloadPct(null);
          setUpdateDownloading(false);
          // Re-show banner if user dismissed it while download was running
          if (!updateAvailable && updateVersionRef.current) {
            setUpdateAvailable(updateVersionRef.current);
          }
        } else if (status === 'update-not-available') {
          setUpdateDownloadPct(null);
          setUpdateDownloading(false);
        } else if (status.startsWith('update-error:')) {
          setUpdateDownloadPct(null);
          setUpdateDownloaded(false);
          setUpdateDownloading(false);
        }
      });
    }
    return () => {
      window.removeEventListener('resize', onResize);
      if (typeof unsub === 'function') unsub();
    };
  }, [checkHealth, fetchSources, fetchExtensions]);

  const serviceStartRequestedRef = useRef(false);
  useEffect(() => {
    if (serviceStartRequestedRef.current || !window.electronAPI?.ensureServices) return;
    serviceStartRequestedRef.current = true;
    window.electronAPI.ensureServices()
      .then(ok => { if (!ok) checkHealth(); })
      .catch(() => checkHealth());
  }, [checkHealth]);

  useEffect(() => {
    if (suwayomiReady && extensions.length === 0) {
      const hasRetried = sessionStorage.getItem('aka:ext-retry');
      if (!hasRetried) {
        sessionStorage.setItem('aka:ext-retry', 'true');
        setTimeout(() => {
          fetchExtensions();
          fetchSources();
        }, 1000);
      }
    } else if (extensions.length > 0) {
      // Clear retry flag if we have extensions
      sessionStorage.removeItem('aka:ext-retry');
    }
  }, [suwayomiReady, extensions.length, fetchExtensions, fetchSources]);

  const viewRef = useRef(view);
  const goBackRef = useRef(null);
  useEffect(() => { viewRef.current = view; }, [view]);
  useEffect(() => {
    const onMouseDown = (e) => {
      if (e.button === 3) { e.preventDefault(); goBackRef.current?.(); }
      if (e.button === 4) {
        e.preventDefault();
        const v = viewRef.current;
        if (v === 'manga') setView('source');
        else if (v === 'source') setView('tabs');
      }
    };
    window.addEventListener('mousedown', onMouseDown);
    return () => window.removeEventListener('mousedown', onMouseDown);
  }, []);


  useEffect(() => {
    if (backendOnline === false) {
      errorTimerRef.current = setTimeout(() => setShowErrorModal(true), 15000);
    } else if (backendOnline === true) {
      clearTimeout(errorTimerRef.current);
      setShowErrorModal(false);
    }
    return () => clearTimeout(errorTimerRef.current);
  }, [backendOnline]);

  const [activeSource, setActiveSource] = useState(null);
  const [inputVal, setInputVal] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [browsePage, setBrowsePage] = useState(1);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState('');
  const [showFilterBar, setShowFilterBar] = useState(false);

  const DEFAULT_FILTERS = { sort: 'latest' };
  const [browseFilters, setBrowseFilters] = useState(DEFAULT_FILTERS);

  const activeFilterCount = useMemo(() => {
    return browseFilters.sort !== 'latest' ? 1 : 0;
  }, [browseFilters]);

  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef(null);

  const [selectedManga, setSelectedManga] = useState(null);
  const [mangaDetail, setMangaDetail] = useState(null);
  const [mangaLoading, setMangaLoading] = useState(false);
  const [mangaError, setMangaError] = useState('');
  const [chapSearch, setChapSearch] = useState('');
  const [chapterSort, setChapterSort] = useState('desc');

  const [currentChapter, setCurrentChapter] = useState(null);
  const [pages, setPages] = useState([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [chapterError, setChapterError] = useState('');
  const [readerPage, setReaderPage] = useState(0);
  const chapterAbortRef = useRef(null);
  const pagesRef = useRef([]);
  const [sourceVerifying, setSourceVerifying] = useState(false);

  const [activeCategory, setActiveCategory] = useState('all');
  const [libraryView, setLibraryView] = useState(() => settings?.libraryView || 'grid');
  const [librarySearch, setLibrarySearch] = useState('');
  const [historyView, setHistoryView] = useState('grid');
  const [librarySort, setLibrarySort] = useState('recent');
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState(new Set());

  const [contextMenu, setContextMenu] = useState(null);
  const [catchUpManga, setCatchUpManga] = useState(null);
  const [migrateManga, setMigrateManga] = useState(null);
  const [showShareCard, setShowShareCard] = useState(false);
  const prevQ = useRef(null);
  const chapRef = useRef([]);

  useEffect(() => { if (mangaDetail) chapRef.current = mangaDetail.chapters; }, [mangaDetail]);
  useEffect(() => {
    const prevPages = pagesRef.current;
    pagesRef.current = pages;
    revokeBlobUrls(prevPages);
  }, [pages]);
  useEffect(() => () => {
    chapterAbortRef.current?.abort();
    revokeBlobUrls(pagesRef.current);
  }, []);

  const debouncedSearch = useMemo(() => debounce(q => setQuery(q), CONFIG.DEBOUNCE_DELAY), []);

  const verificationUrl = mangaDetail?.url || selectedManga?.url || '';
  const verifySourceThenRetry = useCallback(async (retry) => {
    if (!verificationUrl) {
      toast('No source page is available for verification.', 'warning');
      return;
    }
    if (!window.electronAPI?.verifySourceUrl) {
      window.electronAPI?.openExternal?.(verificationUrl);
      toast('Solve the source challenge, then retry.', 'info');
      return;
    }
    setSourceVerifying(true);
    const result = await window.electronAPI.verifySourceUrl(verificationUrl);
    setSourceVerifying(false);
    if (result?.ok) {
      toast('Verification window closed. Retrying...', 'info');
      retry?.();
    } else {
      toast(result?.error || 'Could not open verification window.', 'error');
    }
  }, [verificationUrl, toast]);

  const buildFilterParams = useCallback((q, page, filters) => {
    const params = new URLSearchParams({ q, page });
    if (filters.sort && filters.sort !== 'latest') params.set('sort', filters.sort);
    return params.toString();
  }, []);

  const doSearch = useCallback(async (q, src, page, append = false, filters = browseFilters) => {
    if (!src) return;
    setBrowseLoading(true);
    setBrowseError('');
    try {
      const qs = buildFilterParams(q, page, filters);
      const d = await fetchJSON(`/source/${src.id}/search?${qs}`);
      if (d.error) throw new Error(d.error);
      if (append) {
        setResults(prev => [...prev, ...(d.results || [])]);
      } else {
        setResults(d.results || []);
      }
      setHasNextPage(d.hasNextPage || false);
    } catch (e) {
      setBrowseError(e.message);
      setHasNextPage(false); // Stop infinite loop if request fails
    } finally {
      setBrowseLoading(false);
    }
  }, [fetchJSON, browseFilters, buildFilterParams]);

  const enterSource = useCallback((src) => {
    setActiveSource(src); setResults([]); setQuery(''); setInputVal('');
    setBrowsePage(1); setBrowseError(''); setView('source');
    setBrowseFilters(DEFAULT_FILTERS);
    doSearch('', src, 1, false, DEFAULT_FILTERS);
  }, [doSearch]);

  useEffect(() => {
    if (view === 'source' && activeSource && prevQ.current !== query) {
      prevQ.current = query; setBrowsePage(1); doSearch(query, activeSource, 1, false, browseFilters);
    }
  }, [query, view, activeSource, doSearch, browseFilters]);

  const handleFilterChange = useCallback((key, value) => {
    const newFilters = { ...browseFilters, [key]: value };
    setBrowseFilters(newFilters);
    setBrowsePage(1);
    doSearch(query, activeSource, 1, false, newFilters);
  }, [browseFilters, query, activeSource, doSearch]);

  const handleFilterClear = useCallback(() => {
    setBrowseFilters(DEFAULT_FILTERS);
    setBrowsePage(1);
    doSearch(query, activeSource, 1, false, DEFAULT_FILTERS);
  }, [query, activeSource, doSearch]);

  useEffect(() => {
    if (view !== 'source' || !activeSource || loadingMore || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && hasNextPage) {
          setLoadingMore(true);
          const nextPage = browsePage + 1;
          doSearch(query, activeSource, nextPage, true, browseFilters).then(() => {
            setBrowsePage(nextPage);
          }).finally(() => {
            setLoadingMore(false);
          });
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [view, activeSource, hasNextPage, loadingMore, browsePage, query, doSearch, browseFilters]);

  const openManga = useCallback(async (manga, overrideSourceId) => {
    if (!manga) return;
    const sourceId = overrideSourceId || manga.sourceId || activeSource?.id;
    const source = sources[sourceId] || Object.values(sources).find(s => s.id === String(sourceId));
    if (!source) {
      toast('Source extension is not installed or offline.', 'error');
      return;
    }

    setActiveSource(source); setSelectedManga(manga); setMangaDetail(null);
    setMangaError(''); setChapSearch(''); setView('manga'); setMangaLoading(true);

    try {
      const d = await fetchJSON(`/source/${source.id}/manga/${manga.id}`);
      if (d.error) throw new Error(d.error);
      setMangaDetail(d); addToHistory(manga, source.id, d);
    } catch (e) {
      let msg = e.message;
      try {
        const parsed = JSON.parse(msg);
        if (parsed.error) msg = parsed.error;
      } catch { }
      if (isSourceVerificationError(msg)) {
        msg = 'This source needs browser verification before akaReader can load it.';
      }
      setMangaError(msg);
      toast('Failed to load manga', 'error');
    }
    finally { setMangaLoading(false); }
  }, [activeSource, sources, fetchJSON, addToHistory, removeMangaCompletely, refreshDownloads, toast]);

  const openChapter = useCallback(async (chapter, overrideSourceId, explicitMangaId, explicitPage) => {
    if (chapterAbortRef.current) chapterAbortRef.current.abort();
    const ac = new AbortController();
    chapterAbortRef.current = ac;

    const srcId = overrideSourceId || activeSource?.id || selectedManga?.sourceId;
    const mId = explicitMangaId || mangaDetail?.id || selectedManga?.id;
    const mKey = getMangaKey(mId, srcId);
    
    const existingProg = progress[mKey];
    const defaultPage = (existingProg && existingProg.chapterId === chapter.id) ? existingProg.page : 0;
    const startPage = explicitPage !== undefined ? explicitPage : defaultPage;

    setCurrentChapter(chapter); setPages([]); setChapterError(''); setReaderPage(startPage); setView('reader'); setPagesLoading(true);

    try {
      const localPages = mKey ? await loadChapterBlobs(mKey, chapter.id) : null;
      if (ac.signal.aborted) return;

      const cachedPages = Array.isArray(localPages) ? localPages.filter(Boolean) : [];
      if (cachedPages.length > 0) {
        setPages(cachedPages);
        toast(`Chapter ${chapter.number} (offline)`, 'success');
      } else {
        if (!srcId) throw new Error('Source not available');
        const imgs = await fetchJSON(`/source/${srcId}/chapter/${chapter.id}`, { signal: ac.signal });
        if (ac.signal.aborted) return;
        const nextPages = Array.isArray(imgs) ? imgs.filter(Boolean) : [];
        if (!nextPages.length) throw new Error('No readable pages were returned for this chapter.');
        setPages(nextPages);
        toast(`Chapter ${chapter.number} loaded`, 'success');
      }
      updateProgress(mId, chapter.id, chapter.number, startPage, srcId);
    } catch (e) {
      if (ac.signal.aborted) return;
      let message = e?.message || 'Failed to load chapter.';
      if (isSourceVerificationError(message)) {
        message = 'This source needs browser verification before akaReader can load the chapter.';
      }
      setChapterError(message);
      toast(`Failed to load chapter: ${message}`, 'error');
    } finally {
      if (!ac.signal.aborted) setPagesLoading(false);
    }
  }, [activeSource, progress, selectedManga, mangaDetail, fetchJSON, updateProgress, toast, getMangaKey]);

  const fetchNextChapter = useCallback(async (afterChapterId, signal) => {
    if (!chapRef.current?.length) return null;
    const idx = chapRef.current.findIndex(c => c.id === afterChapterId);
    if (idx === -1) return null;
    const isDesc = (parseFloat(chapRef.current[0]?.number) || 0) > (parseFloat(chapRef.current.at(-1)?.number) || 0);
    const n = isDesc ? chapRef.current[idx - 1] : chapRef.current[idx + 1];
    if (!n) return null;
    const srcId = activeSource?.id || mangaDetail?.sourceId || selectedManga?.sourceId;
    if (!srcId) return { error: 'Source not available.' };
    try {
      const mId = mangaDetail?.id || selectedManga?.id;
      if (mId) {
        const mKey = getMangaKey(mId, srcId);
        const localPages = await loadChapterBlobs(mKey, n.id);
        const cachedPages = Array.isArray(localPages) ? localPages.filter(Boolean) : [];
        if (cachedPages.length > 0) {
          return { chapter: n, pages: cachedPages };
        }
      }
      const imgs = await fetchJSON(`/source/${srcId}/chapter/${n.id}`, { signal });
      return { chapter: n, pages: Array.isArray(imgs) ? imgs.filter(Boolean) : [] };
    } catch (e) {
      return { error: e?.message || 'Failed to load the next chapter.' };
    }
  }, [activeSource, mangaDetail, selectedManga, fetchJSON, getMangaKey]);

  const { chIdx, isDesc, hasNextCh, hasPrevCh } = useMemo(() => {
    const list = chapRef.current || [];
    const idx = list.findIndex(c => c.id === currentChapter?.id);
    const desc = list.length > 0 && (parseFloat(list[0]?.number) || 0) > (parseFloat(list.at(-1)?.number) || 0);
    return {
      chIdx: idx,
      isDesc: desc,
      hasNextCh: desc ? idx > 0 : (idx >= 0 && idx < list.length - 1),
      hasPrevCh: desc ? (idx >= 0 && idx < list.length - 1) : idx > 0
    };
  }, [currentChapter?.id, mangaDetail?.chapters]);

  const handleReaderPositionChange = useCallback((localPage, pageInfo) => {
    setReaderPage(localPage || 0);
    if (pageInfo?.chapter?.id && pageInfo.chapter.id !== currentChapter?.id) {
      setCurrentChapter(pageInfo.chapter);
    }
  }, [currentChapter?.id]);

  const handleContinueReading = useCallback(async (m) => {
    const p = progress[getMangaKey(m.id, m.sourceId)];
    if (!p?.chapterId) {
      openManga(m);
      return;
    }

    const source = sources[m.sourceId] || Object.values(sources).find(s => s.id === String(m.sourceId));
    let chId = p.chapterId;
    let page = p.page || 0;
    let chapter = { id: chId, number: p.chapterNum };

    if (source) setActiveSource(source);
    setSelectedManga(m);
    setMangaDetail(null);
    setMangaError('');
    setChapSearch('');

    try {
      const res = await fetchJSON(`/source/${m.sourceId}/manga/${m.id}`);
      if (res && res.chapters) {
        setMangaDetail(res);
        addToHistory(m, m.sourceId, res);
        chapRef.current = res.chapters;
        const isFullyRead = readChapters[getMangaKey(m.id, m.sourceId)]?.includes(String(chId));
        if (isFullyRead) {
          const chIdx = res.chapters.findIndex(c => c.id === chId);
          if (chIdx > 0) {
            chId = res.chapters[chIdx - 1].id;
            page = 0;
          }
        }
        chapter = res.chapters.find(c => c.id === chId) || chapter;
      }
    } catch (e) {
      setMangaError(e.message || 'Failed to fetch manga details');
    }

    openChapter(chapter, m.sourceId, m.id, page);
  }, [progress, getMangaKey, sources, openManga, fetchJSON, readChapters, openChapter, addToHistory]);

  const handleDownload = useCallback((chapter) => {
    if (!mangaDetail) return;
    queueChaptersForDownload([chapter], mangaDetail.id, mangaDetail.title, activeSource?.id);
    setOverlayHidden(false); // Show overlay when a new download starts
  }, [mangaDetail, activeSource, queueChaptersForDownload]);

  const handleChapterContextMenu = useCallback((e, ch) => {
    e.preventDefault();
    e.stopPropagation();
    if (!mangaDetail) return;
    const mKey = getMangaKey(mangaDetail.id, activeSource?.id);
    const isRead = ch.read || !!(readChapters[mKey]?.includes(String(ch.id)));
    const allChs = chapRef.current;
    const idx = allChs.findIndex(c => c.id === ch.id);
    const markRange = (from, to, read) => {
      allChs.slice(from, to + 1).forEach(c => markChapterRead(mangaDetail.id, c.id, read, activeSource?.id));
      toast(`Marked ${to - from + 1} chapter${to - from > 0 ? 's' : ''} as ${read ? 'read' : 'unread'}`, 'success');
    };
    const items = [
      {
        label: isRead ? 'Mark as Unread' : 'Mark as Read', icon: isRead ? EyeOff : Eye,
        action: () => { markChapterRead(mangaDetail.id, ch.id, !isRead, activeSource?.id); fetchJSON(`/chapter/${ch.id}/read`, { method: 'PATCH', body: JSON.stringify({ isRead: !isRead }) }).catch(() => { }); }
      },
      {
        label: 'Mark from here (above as read)', icon: Check,
        action: () => markRange(0, idx, true)
      },
      {
        label: 'Mark from here (below as unread)', icon: EyeOff,
        action: () => markRange(idx, allChs.length - 1, false)
      },
      {
        label: 'Mark all above as unread', icon: EyeOff, danger: false,
        action: () => markRange(0, idx - 1, false)
      },
      {
        label: 'Download this chapter', icon: Download,
        action: () => handleDownload(ch)
      },
      {
        label: 'Queue this chapter', icon: Archive,
        action: () => queueChaptersForDownload([ch], mangaDetail.id, mangaDetail.title, activeSource?.id)
      },
      {
        label: 'Queue from here onwards (unread)', icon: Archive,
        action: () => {
          const mKey = getMangaKey(mangaDetail.id, activeSource?.id);
          const rest = allChs.slice(idx).filter(c => !c.read && !(readChapters[mKey]?.includes(String(c.id))));
          if (!rest.length) { toast('No unread chapters from here', 'warning'); return; }
          queueChaptersForDownload(rest, mangaDetail.id, mangaDetail.title, activeSource?.id);
        }
      },
    ];
    setContextMenu({ x: e.clientX, y: e.clientY, items });
  }, [mangaDetail, readChapters, markChapterRead, fetchJSON, handleDownload, queueChaptersForDownload, activeSource, toast]);

  const handleTagClick = useCallback((tag, sourceId) => {
    const targetSourceId = sourceId || activeSource?.id;
    const source = sources[targetSourceId] || Object.values(sources).find(s => s.id === String(targetSourceId));
    if (source) {
      const newFilters = { ...DEFAULT_FILTERS };
      setInputVal(tag);
      setQuery(tag);
      setBrowseFilters(newFilters);
      setTab('browse');
      setView('source');
      setActiveSource(source);
      setShowFilterBar(false);
      doSearch(tag, source, 1, false, newFilters);
      toast(`Searching "${tag}" in ${source.name}`, 'info');
    } else {
      toast('Source not available — open a source first', 'warning');
    }
  }, [activeSource, sources, doSearch, toast]);

  const filteredChapters = useMemo(() => {
    let chs = (mangaDetail?.chapters || []).filter(ch => !chapSearch || ch.number?.includes(chapSearch) || ch.title?.toLowerCase().includes(chapSearch.toLowerCase()));
    if (chapterSort === 'asc') chs = [...chs].reverse();
    return chs;
  }, [mangaDetail, chapSearch, chapterSort]);

  const normalizedExts = useMemo(() => {
    const byPkg = new Map();
    extensions.forEach(ext => {
      const key = ext.pkgName || `${ext.name}:${ext.lang}`;
      const current = byPkg.get(key);
      if (!current) {
        byPkg.set(key, ext);
        return;
      }
      const currentScore = (current.isInstalled ? 1000 : 0) + (current.hasUpdate ? 100 : 0) + (current.versionCode || 0);
      const nextScore = (ext.isInstalled ? 1000 : 0) + (ext.hasUpdate ? 100 : 0) + (ext.versionCode || 0);
      if (nextScore > currentScore) byPkg.set(key, ext);
    });
    return [...byPkg.values()];
  }, [extensions]);

  const filteredLibrary = useMemo(() => {
    let list = activeCategory === 'all' ? library : library.filter(m => mangaCategories[getMangaKey(m.id, m.sourceId)] === activeCategory);
    if (librarySearch.trim()) {
      const q = librarySearch.toLowerCase();
      list = list.filter(m => m.title.toLowerCase().includes(q) || m.author?.toLowerCase().includes(q));
    }
    if (librarySort === 'alpha') list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    if (librarySort === 'recent') list = [...list].sort((a, b) => (b.lastRead || b.addedAt || 0) - (a.lastRead || a.addedAt || 0));
    if (librarySort === 'added') list = [...list].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    if (librarySort === 'unread') list = [...list].sort((a, b) => {
      const aKey = getMangaKey(a.id, a.sourceId);
      const bKey = getMangaKey(b.id, b.sourceId);
      const ar = progress[aKey] ? (a.totalChapters || 0) - (parseInt(progress[aKey]?.chapterNum) || 0) : (a.totalChapters || 0);
      const br = progress[bKey] ? (b.totalChapters || 0) - (parseInt(progress[bKey]?.chapterNum) || 0) : (b.totalChapters || 0);
      return br - ar;
    });
    if (librarySort === 'progress') list = [...list].sort((a, b) => {
      const aKey = getMangaKey(a.id, a.sourceId);
      const bKey = getMangaKey(b.id, b.sourceId);
      const ap = a.totalChapters ? (parseInt(progress[aKey]?.chapterNum) || 0) / a.totalChapters : 0;
      const bp = b.totalChapters ? (parseInt(progress[bKey]?.chapterNum) || 0) / b.totalChapters : 0;
      return bp - ap;
    });
    return list;
  }, [library, activeCategory, mangaCategories, librarySearch, librarySort, progress, getMangaKey]);
  const installedSources = useMemo(() => Object.values(sources), [sources]);
  const groupedInstalledSources = useMemo(() => {
    const groups = new Map();
    installedSources.forEach(source => {
      const key = (source.baseName || source.name || 'source').toLowerCase();
      const group = groups.get(key) || { baseName: source.baseName || source.name, variants: [] };
      group.variants.push(source);
      groups.set(key, group);
    });

    const pickPreferred = (variants) => [...variants].sort((a, b) => {
      const score = (src) => {
        if (src.lang === 'en') return 0;
        if (src.lang === 'all') return 1;
        if (src.lang === 'localsourcelang') return 99;
        return 10;
      };
      return score(a) - score(b) || (a.name || '').localeCompare(b.name || '');
    })[0];

    return [...groups.values()]
      .map(group => {
        const preferred = pickPreferred(group.variants);
        return {
          ...preferred,
          name: group.variants.length > 1 ? group.baseName : preferred.name,
          variantCount: group.variants.length,
          variantLangs: group.variants.map(v => v.lang).filter(Boolean),
        };
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [installedSources]);
  const installedExts = useMemo(() => normalizedExts.filter(e => e.isInstalled), [normalizedExts]);

  const goBack = useCallback(() => {
    if (view === 'reader') setView('manga');
    else if (view === 'manga') setView(activeSource ? 'source' : 'tabs');
    else if (view === 'source') { setView('tabs'); setResults([]); }
  }, [view, activeSource]);

  useEffect(() => { goBackRef.current = goBack; }, [goBack]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        if (showGlobalSearch) { setShowGlobalSearch(false); return; }
        if (view !== 'tabs') { e.preventDefault(); goBack(); }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [view, goBack, showGlobalSearch]);

  const switchTab = useCallback((id) => { setTab(id); if (id === 'browse') { setView('tabs'); setResults([]); } else { setView(v => v === 'reader' ? 'reader' : 'tabs'); } }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = e.target.tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (inInput) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); setShowGlobalSearch(true); }
      if ((e.ctrlKey || e.metaKey) && e.key === '1') { e.preventDefault(); switchTab('browse'); }
      if ((e.ctrlKey || e.metaKey) && e.key === '2') { e.preventDefault(); switchTab('extensions'); }
      if ((e.ctrlKey || e.metaKey) && e.key === '3') { e.preventDefault(); switchTab('library'); }
      if ((e.ctrlKey || e.metaKey) && e.key === '4') { e.preventDefault(); switchTab('history'); }
      if ((e.ctrlKey || e.metaKey) && e.key === '5') { e.preventDefault(); switchTab('updates'); }
      if ((e.ctrlKey || e.metaKey) && e.key === '6') { e.preventDefault(); switchTab('downloads'); }
      if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); const ids = ['browse', 'extensions', 'library', 'history', 'updates', 'downloads', 'settings']; const i = ids.indexOf(tab); if (i > 0) switchTab(ids[i - 1]); }
      if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); const ids = ['browse', 'extensions', 'library', 'history', 'updates', 'downloads', 'settings']; const i = ids.indexOf(tab); if (i < ids.length - 1) switchTab(ids[i + 1]); }
      if (e.key === 'F5') { e.preventDefault(); checkHealth(); fetchSources(); fetchExtensions(); }
      if (e.key === '\\' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); setSidebarCollapsed(p => !p); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [switchTab, checkHealth, fetchSources, fetchExtensions, tab]);

  const handleMangaContextMenu = useCallback((e, manga) => {
    const mangaSourceId = manga.sourceId || activeSource?.id;
    const items = [
      { label: 'Open', icon: ExternalLink, action: () => openManga(manga) },
      { label: inLibrary(manga.id, mangaSourceId) ? 'Remove from Library' : 'Add to Library', icon: inLibrary(manga.id, mangaSourceId) ? Trash2 : Heart, action: () => toggleLibrary(manga, mangaSourceId) },
      ...categories.map(cat => ({ label: `→ ${cat.name}`, icon: CATEGORY_ICON_MAP[cat.id] || Bookmark, action: () => setCategory(manga.id, cat.id, mangaSourceId) })),
      { label: 'Migrate Source', icon: RefreshCw, action: () => setMigrateManga(manga) },
    ];
    setContextMenu({ x: e.clientX, y: e.clientY, items });
  }, [inLibrary, openManga, toggleLibrary, setCategory, activeSource]);

  const stats = useMemo(() => {
    const streak = calculateStreak(history);
    const totalChapters = Object.values(progress).reduce((a, p) => a + (parseInt(p.chapterNum) || 0), 0);
    const totalMinutes = Object.values(readingTime || {}).reduce((a, v) => a + (v || 0), 0) / 60;
    const inLib = library.length;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days14 = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today); d.setDate(d.getDate() - 13 + i);
      return { date: d.toDateString(), ts: d.getTime() };
    });
    const readDaySet = new Set(history.flatMap(m => {
      const lr = m.lastRead; if (!lr) return [];
      const d = new Date(lr); d.setHours(0, 0, 0, 0); return [d.toDateString()];
    }));
    const activityDays = days14.map(d => ({ ...d, read: readDaySet.has(d.date) }));
    return { streak, totalChapters, totalMinutes: Math.round(totalMinutes), inLib, activityDays };
  }, [progress, history, library, readingTime]);

  const NAV = useMemo(() => [
    { id: 'home', label: 'Home', Icon: Flame },
    { id: 'browse', label: 'Browse', Icon: BookOpen },
    { id: 'extensions', label: 'Extensions', Icon: Puzzle, badge: installedExts.filter(e => e.hasUpdate).length || installedExts.length },
    { id: 'library', label: 'Library', Icon: Library, badge: library.length },
    { id: 'history', label: 'History', Icon: History, badge: history.length },
    { id: 'updates', label: 'Updates', Icon: BellRing, badge: updates.length },
    { id: 'downloads', label: 'Downloads', Icon: Download, badge: downloadQueue.filter(d => d.status === 'pending' || d.status === 'downloading').length || undefined },
    { id: 'settings', label: 'Settings', Icon: Settings },
  ], [installedExts, library.length, history.length, updates.length, downloadQueue]);

  const managedStartup = !!window.electronAPI?.ensureServices;
  const canUseShellOffline = !managedStartup && backendOnline !== null;

  if (!forceProceed && !canUseShellOffline && (backendOnline === null || !suwayomiReady) && !showErrorModal) {
    return (
      <StartupScreen
        onProceed={() => setForceProceed(true)}
        onRetry={() => { setForceProceed(false); window.electronAPI?.restartServices?.(); checkHealth(); }}
        managedStartup={managedStartup}
        backendOnline={backendOnline}
        suwayomiReady={suwayomiReady}
      />
    );
  }

  if (view === 'reader') {
    if (pagesLoading) return (
      <div style={{ position: 'fixed', inset: 0, background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20 }}>
        <Spin size={48} />
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Loading chapter...</p>
      </div>
    );
    if (chapterError) return (
      <div style={{ position: 'fixed', inset: 0, background: '#0a0a0f', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24, textAlign: 'center' }}>
        <div style={{ width: 58, height: 58, borderRadius: 16, background: 'rgba(249,115,22,0.12)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <AlertTriangle size={28} />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Chapter did not load</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13, maxWidth: 420, lineHeight: 1.6, margin: 0 }}>{chapterError}</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
          <Btn onClick={goBack} icon={ChevronLeft}>Back to Manga</Btn>
          {currentChapter && (
            <Btn variant="outline" onClick={() => openChapter(currentChapter, activeSource?.id || selectedManga?.sourceId, mangaDetail?.id || selectedManga?.id, readerPage)} icon={RefreshCw}>
              Retry
            </Btn>
          )}
          {isSourceVerificationError(chapterError) && (
            <Btn
              variant="outline"
              disabled={sourceVerifying}
              onClick={() => verifySourceThenRetry(() => currentChapter && openChapter(currentChapter, activeSource?.id || selectedManga?.sourceId, mangaDetail?.id || selectedManga?.id, readerPage))}
              icon={ExternalLink}
            >
              {sourceVerifying ? 'Waiting...' : 'Verify Source'}
            </Btn>
          )}
        </div>
      </div>
    );
    const readerMangaId = mangaDetail?.id || selectedManga?.id;
    const readerSourceId = mangaDetail?.sourceId || selectedManga?.sourceId || activeSource?.id;
    const mKeyForReader = getMangaKey(readerMangaId, readerSourceId);

    return (
      <NewReader
        pages={pages} currentChapter={currentChapter} mangaTitle={mangaDetail?.title}
        onBack={goBack}
        onNextChapter={() => {
          const n = isDesc ? chapRef.current[chIdx - 1] : chapRef.current[chIdx + 1];
          if (n) {
            toast(`Navigating to Ch. ${n.number}...`, 'info');
            openChapter(n, readerSourceId, readerMangaId);
          } else {
            toast('No next chapter found in list', 'warning');
          }
        }}
        onPrevChapter={() => {
          const p = isDesc ? chapRef.current[chIdx + 1] : chapRef.current[chIdx - 1];
          if (p) {
            toast(`Navigating back to Ch. ${p.number}...`, 'info');
            openChapter(p, readerSourceId, readerMangaId);
          } else {
            toast('No previous chapter found in list', 'warning');
          }
        }}
        fetchNextChapter={fetchNextChapter}
        hasNext={hasNextCh} hasPrev={hasPrevCh}
        onPageChange={handleReaderPositionChange}
        initialPage={progress[mKeyForReader]?.page || 0}
        mangaId={readerMangaId}
        mangaSourceId={readerSourceId}
        mangaCover={mangaDetail?.cover || selectedManga?.cover} isLoading={pagesLoading}
      />
    );
  }

  return (
    <>
      {showOnboarding && <Onboarding onFinish={() => { setShowOnboarding(false); storage.set('onboardingDone', true); }} />}
      {catchUpManga && <CatchUpModal manga={catchUpManga} onClose={() => setCatchUpManga(null)} onJumpTo={ch => { setCatchUpManga(null); openChapter(ch, activeSource?.id || mangaDetail?.sourceId, mangaDetail?.id || selectedManga?.id); }} />}
      {showShareCard && <ShareCardModal library={library} history={history} progress={progress} readChapters={readChapters} settings={settings} onClose={() => setShowShareCard(false)} />}
      {showErrorModal && <ServiceErrorModal onRestart={() => { setShowErrorModal(false); checkHealth(); }} />}
      {showReleaseNotes && <ReleaseNotesModal notes={releaseNotes} version={updateAvailable} onClose={() => setShowReleaseNotes(false)} />}
      {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenu.items} onClose={() => setContextMenu(null)} />}
      {backendOnline && !suwayomiReady && !showErrorModal && (forceProceed || canUseShellOffline) && (
        <div className="anim-slideDown" style={{ position: 'fixed', top: 38, left: 0, right: 0, zIndex: 800, background: 'rgba(15,15,24,0.96)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(249,115,22,0.25)', padding: '9px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="anim-spin" style={{ width: 13, height: 13, border: '2px solid rgba(249,115,22,0.3)', borderTopColor: 'var(--accent)', borderRadius: '50%', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>Suwayomi is starting… browse and extensions will load shortly</span>
        </div>
      )}
{updateAvailable && (
        <div className="anim-fadeIn" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 900, background: 'linear-gradient(90deg,rgba(234,179,8,0.95),rgba(251,191,36,0.95))', backdropFilter: 'blur(12px)', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, pointerEvents: 'auto', WebkitAppRegion: 'no-drag' }}>
          <BellRing size={16} style={{ color: '#78350f' }} />
          <span style={{ fontSize: 13, fontWeight: 800, color: '#78350f', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {updateDownloaded ? `akaReader v${updateAvailable} is ready — click Restart to apply` : updateDownloadPct ? `Downloading v${updateAvailable}… ${updateDownloadPct}%` : `akaReader v${updateAvailable} is available`}
          </span>
          {updateDownloaded ? (
            <button onClick={() => window.electronAPI?.installAppUpdate?.()} style={{ background: '#78350f', color: '#fff7ed', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 800, cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s ease', boxShadow: '0 2px 8px rgba(120,53,15,0.2)', WebkitAppRegion: 'no-drag' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#92400e'; e.currentTarget.style.transform = 'scale(1.03)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#78350f'; e.currentTarget.style.transform = ''; }}
            >Restart now</button>
          ) : updateDownloading ? (
            <span style={{ background: 'rgba(120,53,15,0.3)', color: '#78350f', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 800, cursor: 'default', flexShrink: 0, fontSize: 12 }}>Downloading…</span>
          ) : (
            <button onClick={() => window.electronAPI?.downloadAppUpdate?.()} style={{ background: '#78350f', color: '#fff7ed', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 800, cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s ease', boxShadow: '0 2px 8px rgba(120,53,15,0.2)', WebkitAppRegion: 'no-drag' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#92400e'; e.currentTarget.style.transform = 'scale(1.03)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#78350f'; e.currentTarget.style.transform = ''; }}
            >Download</button>
          )}
          {releaseNotes ? (
            <button onClick={() => setShowReleaseNotes(true)} style={{ background: 'none', border: 'none', fontSize: 12, fontWeight: 700, color: '#78350f', textDecoration: 'underline', cursor: 'pointer', flexShrink: 0, WebkitAppRegion: 'no-drag' }}>Release notes</button>
          ) : (
            <a href={`https://github.com/akawazak/akareader/releases/tag/v${updateAvailable}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 700, color: '#78350f', textDecoration: 'underline', WebkitAppRegion: 'no-drag' }}>Release notes</a>
          )}
          <button onClick={() => setUpdateAvailable(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#78350f', display: 'flex', transition: 'transform 0.2s', padding: 4, WebkitAppRegion: 'no-drag' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
            onMouseLeave={e => e.currentTarget.style.transform = ''}
          ><X size={16} /></button>
        </div>
      )}

      {showGlobalSearch && (
        <GlobalSearch sources={sources} onSelectManga={(manga, srcId) => openManga(manga, srcId)} onClose={() => setShowGlobalSearch(false)} fetchJSON={fetchJSON} />
      )}

      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 38,
        WebkitAppRegion: 'drag', zIndex: 300,
        background: 'rgba(7,8,13,0.97)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', WebkitAppRegion: 'no-drag', height: '100%' }}>
          <button
            onClick={() => window.electronAPI?.minimize?.()}
            title="Minimize"
            style={{ width: 46, height: '100%', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <svg width="11" height="1" viewBox="0 0 11 1"><rect width="11" height="1" fill="currentColor" /></svg>
          </button>
          <button
            onClick={() => window.electronAPI?.maximize?.()}
            title="Maximize"
            style={{ width: 46, height: '100%', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <svg width="11" height="11" viewBox="0 0 11 11"><rect x="0.5" y="0.5" width="10" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1" /></svg>
          </button>
          <button
            onClick={() => window.electronAPI?.close?.()}
            title="Close"
            style={{ width: 46, height: '100%', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#e81123'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted)'; }}
          >
            <svg width="11" height="11" viewBox="0 0 11 11"><path d="M1 1l9 9M10 1l-9 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
          </button>
        </div>
      </div>

      <aside style={{ position: 'fixed', left: 0, top: 38, bottom: 0, width: sidebarWidth, background: 'var(--bg2)', borderRight: '1px solid var(--border)', zIndex: 50, display: 'flex', flexDirection: 'column', padding: sidebarIsCollapsed ? '10px 10px 8px' : '0', transition: 'width var(--t-base) var(--ease-spring)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: sidebarIsCollapsed ? '0 6px' : '18px 22px 16px', marginBottom: sidebarIsCollapsed ? 10 : 0 }}>
          <div className="gradient-primary" style={{ width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 8px 24px rgba(249,115,22,0.3)', WebkitAppRegion: 'no-drag' }}>
            <BookOpen size={20} color="#fff" />
          </div>
          {!sidebarIsCollapsed && <span className="text-gradient" style={{ fontFamily: "'Segoe UI Variable Display','Segoe UI Variable','Segoe UI',system-ui,-apple-system,sans-serif", fontWeight: 800, fontSize: 20, WebkitAppRegion: 'no-drag' }}>akaReader</span>}
        </div>

        {!sidebarIsCollapsed && (
          <div style={{ padding: '0 12px', marginBottom: 16 }}>
            <button onClick={() => setShowGlobalSearch(true)}
              data-onboard="global-search-btn"
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--card)', color: 'var(--muted)', cursor: 'pointer', fontSize: 13, transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--text)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)'; }}>
              <Search size={15} /><span>Search all sources...</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4 }}>⌘K</span>
            </button>
          </div>
        )}
        {sidebarIsCollapsed && (
          <div style={{ padding: '0 8px', marginBottom: 8 }}>
            <button onClick={() => setShowGlobalSearch(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--muted)', cursor: 'pointer', transition: 'all 0.2s' }}>
              <Search size={18} />
            </button>
          </div>
        )}

        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: sidebarIsCollapsed ? 2 : 3, padding: sidebarIsCollapsed ? '0 8px' : '0 10px', overflowY: 'auto', overflowX: 'hidden' }}>
          {NAV.map(({ id, label, Icon, badge }, i) => {
            const active = tab === id;
            return (
              <button key={id} onClick={() => switchTab(id)} className={`anim-slideLeft delay-${i}`}
                data-onboard={`nav-${id}`} style={{ display: 'flex', alignItems: 'center', gap: sidebarIsCollapsed ? 0 : 12, padding: sidebarIsCollapsed ? '8px' : '11px 14px', borderRadius: 12, border: 'none', background: active ? 'rgba(249,115,22,0.12)' : 'transparent', color: active ? 'var(--accent)' : 'var(--text-dim)', cursor: 'pointer', justifyContent: sidebarIsCollapsed ? 'center' : 'flex-start', position: 'relative', width: '100%', transition: 'all 0.2s' }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                {active && !sidebarIsCollapsed && <div style={{ position: 'absolute', left: 0, width: 3, height: 22, background: 'var(--accent)', borderRadius: '0 3px 3px 0' }} />}
                <div style={{ position: 'relative' }}>
                  <Icon size={21} style={{ color: active ? 'var(--accent)' : 'var(--muted)', transition: 'color 0.2s' }} />
                  {badge > 0 && sidebarIsCollapsed && (
                    <span style={{ position: 'absolute', top: -4, right: -4, width: 15, height: 15, background: 'var(--accent)', borderRadius: '50%', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>{badge > 9 ? '9+' : badge}</span>
                  )}
                </div>
                {!sidebarIsCollapsed && (
                  <>
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 14, textAlign: 'left' }}>{label}</span>
                    {badge > 0 && <span style={{ background: active ? 'var(--accent)' : 'rgba(255,255,255,0.1)', color: active ? '#fff' : 'var(--text)', borderRadius: 20, fontSize: 11, padding: '2px 9px', fontWeight: 700 }}>{badge}</span>}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        {!sidebarIsCollapsed && (
          <div style={{ padding: '0 14px', marginBottom: 14, marginTop: 'auto', flexShrink: 0 }}>
            <div style={{ padding: '14px 14px 12px', background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Flame size={13} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '.04em' }}>
                    {stats.streak > 0 ? `${stats.streak} day streak` : 'No streak yet'}
                  </span>
                </div>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>{stats.totalChapters} ch read</span>
              </div>
              <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end' }}>
                {stats.activityDays?.map((d, i) => (
                  <div key={i} title={d.date} style={{
                    flex: 1, height: d.read ? 18 : 8,
                    borderRadius: 3, transition: 'height .2s ease',
                    background: d.read ? 'var(--accent)' : 'rgba(255,255,255,0.07)',
                    boxShadow: d.read ? '0 0 6px var(--accent-glow)' : 'none'
                  }} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 9, color: 'var(--muted)' }}>14 days ago</span>
                <span style={{ fontSize: 9, color: 'var(--muted)' }}>today</span>
              </div>
              {stats.inLib > 0 && (
                <div style={{
                  marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)',
                  display: 'flex', justifyContent: 'space-between'
                }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{stats.inLib} in library</span>
                  {stats.totalMinutes > 0 && (
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {stats.totalMinutes >= 60 ? `${Math.floor(stats.totalMinutes / 60)}h read` : `${stats.totalMinutes}m read`}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ padding: sidebarIsCollapsed ? '0 8px 6px' : '0 10px 12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: sidebarIsCollapsed ? 6 : 10 }}>
          <button onClick={() => setSidebarCollapsed(c => !c)}
            title={sidebarIsCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              justifyContent: sidebarIsCollapsed ? 'center' : 'flex-end',
              gap: 6, padding: '7px 8px', borderRadius: 'var(--r-sm)',
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: 'var(--muted)', transition: 'all .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-dim)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted)'; }}>
            {!sidebarIsCollapsed && <span style={{ fontSize: 11 }}>Collapse</span>}
            {sidebarIsCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>
      </aside>

      <main style={{ marginLeft: sidebarWidth, marginTop: 38, minHeight: 'calc(100vh - 38px)', transition: 'margin-left var(--t-base) var(--ease-spring)' }}>
        <div className="glass-strong" style={{
          position: 'sticky', top: 0, zIndex: 40,
          padding: view === 'manga' ? '0 20px' : tab === 'home' ? '8px 20px' : view === 'source' ? '10px 24px' : '16px 28px',
          minHeight: view === 'manga' ? 52 : 'auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 12,
          borderBottom: view === 'manga' ? '1px solid var(--border)' : '1px solid rgba(255,255,255,0.04)',
          marginBottom: (view === 'manga' || tab === 'home') ? 0 : 24,
          transition: 'all var(--t-base) var(--ease-spring)',
        }}>
          {view === 'manga' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minWidth: 0 }}>
              <Btn variant="ghost" size="sm" onClick={goBack} icon={ChevronLeft} style={{ flexShrink: 0 }}>
                {activeSource?.name || 'Back'}
              </Btn>
              <div style={{ width: 1, height: 22, background: 'var(--border)', flexShrink: 0 }} />
              {activeSource?.icon && (
                <img src={activeSource.icon} style={{ width: 20, height: 20, borderRadius: 5, objectFit: 'contain', flexShrink: 0 }} onError={e => e.target.style.display = 'none'} alt="" />
              )}
              <p style={{ flex: 1, fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>
                {mangaDetail?.title || selectedManga?.title}
                {mangaDetail?.author && <span style={{ fontWeight: 400, color: 'var(--muted)', marginLeft: 10, fontSize: 12 }}>{mangaDetail.author}</span>}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {/* QUICK SETTINGS BAR ON MANGA DETAIL */}
                <div style={{ display: 'flex', background: 'var(--card2)', borderRadius: 99, border: '1px solid var(--border)', overflow: 'hidden', marginRight: 8 }}>
                  {[
                    { id: 'scroll', Icon: Columns, title: 'Scroll Mode' },
                    { id: 'paged', Icon: BookOpen, title: 'Paged Mode' },
                    { id: 'webtoon', Icon: AlignJustify, title: 'Strip Mode' }
                  ].map(m => (
                    <button key={m.id} title={m.title} onClick={() => updateSetting('readerMode', m.id)}
                      style={{
                        padding: '6px 10px', background: settings?.readerMode === m.id ? 'var(--accent)' : 'transparent',
                        border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: settings?.readerMode === m.id ? '#fff' : 'var(--muted)'
                      }}>
                      <m.Icon size={15} />
                    </button>
                  ))}
                </div>
                {backendOnline === false && <Badge variant="destructive" size="sm">Offline</Badge>}
                {mangaDetail && (
                  <>
                    <Badge variant={inLibrary(mangaDetail.id, activeSource?.id || mangaDetail.sourceId) ? 'default' : 'outline'} size="sm" style={{ cursor: 'pointer' }} onClick={() => toggleLibrary(mangaDetail, activeSource?.id || mangaDetail.sourceId)}>
                      {inLibrary(mangaDetail.id, activeSource?.id || mangaDetail.sourceId) ? '★ Saved' : '☆ Save'}
                    </Badge>
                    <Btn variant="ghost" size="icon"
                      onClick={() => toggleLibrary(mangaDetail, activeSource?.id || mangaDetail.sourceId)}
                      style={{ color: inLibrary(mangaDetail.id, activeSource?.id || mangaDetail.sourceId) ? 'var(--accent)' : 'var(--muted)' }}>
                      <Heart size={18} fill={inLibrary(mangaDetail.id, activeSource?.id || mangaDetail.sourceId) ? 'var(--accent)' : 'none'} />
                    </Btn>
                  </>
                )}
              </div>
            </div>
          ) : (
            <>
              <div>
                <h1 style={{ fontFamily: "'Segoe UI Variable Display','Segoe UI Variable','Segoe UI',system-ui,-apple-system,sans-serif", fontWeight: 800, fontSize: 'clamp(22px,2.5vw,30px)', letterSpacing: '-0.02em', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 10 }}>
                  {tab === 'browse' && view === 'source' ? activeSource?.name :
                    tab === 'home' ? 'Home' : tab === 'browse' ? 'Browse' :
                      tab === 'extensions' ? 'Extensions' :
                        tab === 'library' ? 'Library' :
                          tab === 'history' ? 'History' :
                            tab === 'recommendations' ? 'Discover' : tab === 'updates' ? 'Updates' :
                              tab === 'downloads' ? 'Downloads' : 'Settings'}
                  {backendOnline === false && <Badge variant="destructive" size="sm">Offline</Badge>}
                </h1>
                <p style={{ color: 'var(--muted)', fontSize: 12 }}>
                  {tab === 'browse' && view === 'source' ? `${results.length} results${activeFilterCount > 0 ? ` • ${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} active` : ''}` :
                    tab === 'home' ? '' : tab === 'browse' ? `${groupedInstalledSources.length} source group${groupedInstalledSources.length === 1 ? '' : 's'} available` :
                      tab === 'extensions' ? `${installedExts.length} installed • ${normalizedExts.length} total` :
                        tab === 'library' ? `${filteredLibrary.length} manga` :
                          tab === 'history' ? `${history.length} entries` :
                            tab === 'updates' ? `${updates.length} updates` :
                              tab === 'downloads' ? `${downloadQueue.filter(d => d.status === 'pending' || d.status === 'downloading').length} active` : 'Customize your experience'}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {view === 'source' && (
                  <>
                    <div style={{ position: 'relative', width: 'min(320px,100%)' }}>
                      <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
                      <input placeholder={`Search ${activeSource?.name}...`} value={inputVal} onChange={e => { setInputVal(e.target.value); debouncedSearch(e.target.value); }} style={{ width: '100%', background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '12px 40px 12px 40px', color: 'var(--text)', fontSize: 14, outline: 'none', fontFamily: 'system-ui,-apple-system,Segoe UI,sans-serif', transition: 'border-color 0.2s' }} onFocus={e => e.target.style.borderColor = 'var(--accent)'} onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                      {inputVal && <Btn variant="ghost" size="icon" onClick={() => { setInputVal(''); setQuery(''); }} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}><X size={14} /></Btn>}
                    </div>
                    <Btn
                      variant={showFilterBar || activeFilterCount > 0 ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setShowFilterBar(p => !p)}
                    >
                      <SlidersHorizontal size={14} />
                      Filters
                      {activeFilterCount > 0 && (
                        <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>
                          {activeFilterCount}
                        </span>
                      )}
                    </Btn>
                  </>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: (backendOnline === true && suwayomiReady) ? '#22c55e' : backendOnline === false ? '#ef4444' : backendOnline === true ? '#f59e0b' : '#f59e0b', boxShadow: `0 0 10px ${(backendOnline === true && suwayomiReady) ? '#22c55e' : backendOnline === false ? '#ef4444' : '#f59e0b'}`, animation: backendOnline === null ? 'pulse 1.5s infinite' : 'none' }} />
                  <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>{(backendOnline === true && suwayomiReady) ? 'Connected' : backendOnline === false ? 'Disconnected' : backendOnline === true ? 'Suwayomi Starting' : 'Checking...'}</span>
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{ padding: (view === 'manga' || tab === 'home') ? 0 : view === 'source' ? '0 24px 60px' : '0 28px 60px' }}>
          {backendOnline === false && (
            <div className="anim-fadeIn" style={{ marginBottom: 24, padding: '14px 18px', borderRadius: 12, background: 'rgba(234,179,8,0.07)', border: '1.5px solid rgba(234,179,8,0.2)', display: 'flex', gap: 12, alignItems: 'center' }}>
              <AlertTriangle size={18} style={{ color: '#facc15', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, fontSize: 14, color: '#facc15', marginBottom: 2 }}>Backend offline</p>
                <p style={{ fontSize: 12, color: 'rgba(253,224,71,0.8)', lineHeight: 1.5 }}>Run <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 6px', borderRadius: 4 }}>node backend/server.js</code> then refresh.</p>
              </div>
              <Btn variant="outline" size="sm" onClick={checkHealth} style={{ flexShrink: 0 }}><RefreshCw size={13} /> Retry</Btn>
            </div>
          )}

          {view === 'manga' && (
            <div className="page-transition" style={{ padding: '0 0 60px', position: 'relative' }}>
              {mangaDetail?.cover && (
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 280,
                  backgroundImage: `url(${proxyImg(mangaDetail.cover)})`,
                  backgroundSize: 'cover', backgroundPosition: 'center top',
                  filter: 'blur(60px) brightness(0.12) saturate(1.5)',
                  transform: 'scaleX(1.05)',
                  zIndex: 0, pointerEvents: 'none', overflow: 'hidden',
                  maskImage: 'linear-gradient(to bottom,rgba(0,0,0,0.7) 0%,transparent 100%)',
                  WebkitMaskImage: 'linear-gradient(to bottom,rgba(0,0,0,0.7) 0%,transparent 100%)',
                }} />
              )}
              <div style={{ position: 'relative', zIndex: 1, maxWidth: 860, margin: '0 auto', padding: '28px 32px 60px' }}>
                {mangaLoading ? (
                  <MangaDetailSkeleton />
                ) : mangaError ? (
                  <EmptyState
                    icon={AlertTriangle}
                    title="Failed to load"
                    sub={mangaError}
                    action={
                      <div style={{ display: 'flex', gap: 10 }}>
                        <Btn onClick={() => openManga(selectedManga)}>Retry</Btn>
                        {isSourceVerificationError(mangaError) && (
                          <Btn
                            variant="outline"
                            disabled={sourceVerifying}
                            onClick={() => verifySourceThenRetry(() => openManga(selectedManga))}
                            icon={ExternalLink}
                          >
                            {sourceVerifying ? 'Waiting...' : 'Verify Source'}
                          </Btn>
                        )}
                      </div>
                    }
                  />
                ) : mangaDetail ? (
                  <>
                    <div style={{ display: 'flex', gap: 28, marginBottom: 32, flexWrap: 'wrap' }}>
                      <div style={{ width: 160, height: 240, borderRadius: 20, overflow: 'hidden', flexShrink: 0, border: '1.5px solid var(--border)', background: 'var(--card)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
                        {mangaDetail.cover
                          ? <img src={proxyImg(mangaDetail.cover)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={mangaDetail.title} />
                          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BookOpen size={40} style={{ color: 'var(--muted)', opacity: 0.4 }} /></div>
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 240, paddingTop: 4 }}>
                        <h1 style={{ fontFamily: "'Segoe UI Variable Display','Segoe UI Variable','Segoe UI',system-ui,-apple-system,sans-serif", fontWeight: 800, fontSize: 'clamp(22px,3vw,30px)', lineHeight: 1.2, marginBottom: 8 }}>{mangaDetail.title}</h1>
                        {mangaDetail.author && <p style={{ color: 'var(--accent)', fontSize: 14, marginBottom: 14, fontWeight: 500 }}>{mangaDetail.author}</p>}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                          {mangaDetail.status && <Badge variant={mangaDetail.status === 'ongoing' ? 'success' : 'outline'}>{mangaDetail.status}</Badge>}
                          <Badge variant="outline">{mangaDetail.totalChapters} chapters</Badge>
                          {inLibrary(mangaDetail.id, activeSource?.id || mangaDetail.sourceId) && <Badge variant="default" size="sm">In Library</Badge>}
                        </div>
                        {mangaDetail.tags?.length > 0 && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
                            {mangaDetail.tags.map(t => (
                              <button key={t} onClick={() => handleTagClick(t, activeSource?.id)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'rgba(249,115,22,0.08)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                              ><Tag size={9} />{t}</button>
                            ))}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          {mangaDetail.chapters?.length > 0 ? (
                            <Btn onClick={() => {
                              const mKey = getMangaKey(mangaDetail.id, activeSource?.id);
                              const last = progress[mKey];
                              let ch = last ? mangaDetail.chapters.find(c => c.id === last.chapterId) || mangaDetail.chapters[mangaDetail.chapters.length - 1] : mangaDetail.chapters[mangaDetail.chapters.length - 1];

                              let startPage = last?.page || 0;
                              const isFullyRead = readChapters[mKey]?.includes(String(ch.id)) || ch.read;

                              if (isFullyRead) {
                                const chIdx = mangaDetail.chapters.findIndex(c => c.id === ch.id);
                                if (chIdx > 0) {
                                  ch = mangaDetail.chapters[chIdx - 1];
                                  startPage = 0;
                                }
                              }
                              openChapter(ch, activeSource?.id || mangaDetail.sourceId, mangaDetail.id, startPage);
                            }} size="lg" icon={Play}>{progress[getMangaKey(mangaDetail.id, activeSource?.id || mangaDetail.sourceId)] ? 'Continue' : 'Start Reading'}</Btn>
                          ) : null}
                        {mangaDetail?.chapters?.length > 10 && (
                          <Btn variant="outline" size="lg" icon={Zap}
                            onClick={() => {
                              const mKey = getMangaKey(mangaDetail.id, activeSource?.id);
                              setCatchUpManga({ ...mangaDetail, chapters: (mangaDetail.chapters || []).filter(ch => !ch.read && !(readChapters[mKey]?.includes(String(ch.id)))) });
                            }}>
                            Catch Up
                          </Btn>
                        )}
                        <Btn variant={inLibrary(mangaDetail.id, activeSource?.id || mangaDetail.sourceId) ? 'default' : 'outline'} onClick={() => toggleLibrary(mangaDetail, activeSource?.id || mangaDetail.sourceId)} icon={Heart}>
                          {inLibrary(mangaDetail.id, activeSource?.id || mangaDetail.sourceId) ? 'In Library' : 'Add to Library'}
                        </Btn>
                        <Btn variant="outline" onClick={() => setMigrateManga(mangaDetail)} icon={RefreshCw} title="Find this on other sources">
                          Migrate
                        </Btn>
                      </div>

                      {inLibrary(mangaDetail.id, activeSource?.id || mangaDetail.sourceId) && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                          {categories.map(cat => (
                            <button key={cat.id} onClick={() => setCategory(mangaDetail.id, cat.id, activeSource?.id)}
                              style={{
                                padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                background: mangaCategories[getMangaKey(mangaDetail.id, activeSource?.id)] === cat.id ? cat.color : 'var(--card)',
                                color: mangaCategories[getMangaKey(mangaDetail.id, activeSource?.id)] === cat.id ? '#fff' : 'var(--text-dim)',
                                border: `1px solid ${mangaCategories[getMangaKey(mangaDetail.id, activeSource?.id)] === cat.id ? 'transparent' : 'var(--border)'}`,
                                transition: 'all 0.2s'
                              }}>
                              {cat.name}
                            </button>
                          ))}
                        </div>
                      )}

                      {mangaDetail.chapters?.length > 0 && (() => {
                        const mKey = getMangaKey(mangaDetail.id, activeSource?.id);
                        const prog = progress[mKey];
                        const chapsDone = prog ? (parseInt(prog.chapterNum) || 0) : 0;
                        const total = mangaDetail.totalChapters || mangaDetail.chapters.length;
                        const chapsLeft = Math.max(0, total - chapsDone);
                        const minsLeft = Math.round(chapsLeft * 20);
                        const totalHrs = Math.round(total * 20 / 60 * 10) / 10;
                        if (!chapsLeft) return null;
                        return (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 99, background: 'var(--card)', border: '1px solid var(--border)', fontSize: 12 }}>
                              <Clock size={12} style={{ color: 'var(--accent)' }} />
                              <span style={{ color: 'var(--text-dim)' }}>{minsLeft >= 60 ? `~${Math.round(minsLeft / 60)}h` : `~${minsLeft}m`} left</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 99, background: 'var(--card)', border: '1px solid var(--border)', fontSize: 12 }}>
                              <BookOpen size={12} style={{ color: 'var(--muted)' }} />
                              <span style={{ color: 'var(--text-dim)' }}>~{totalHrs}h total</span>
                            </div>
                            {chapsDone > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 99, background: 'var(--card)', border: '1px solid var(--border)', fontSize: 12 }}>
                              <Check size={12} style={{ color: 'var(--green)' }} />
                              <span style={{ color: 'var(--text-dim)' }}>{chapsDone} read</span>
                            </div>}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                <MangaNotes mangaId={mangaDetail?.id} mangaTitle={mangaDetail?.title} />
                {mangaDetail.description && (
                  <div style={{ marginBottom: 24, padding: '18px 22px', background: 'var(--card)', borderRadius: 16, border: '1.5px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,var(--accent),transparent)' }} />
                    <p style={{ color: 'var(--text-dim)', fontSize: 14, lineHeight: 1.8 }}>{mangaDetail.description}</p>
                  </div>
                )}

                {readingTime[getMangaKey(mangaDetail.id, activeSource?.id)] > 0 && (
                  <div style={{ marginBottom: 20, padding: '12px 16px', background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Clock size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                      Reading time: <strong>{Math.floor(readingTime[getMangaKey(mangaDetail.id, activeSource?.id)] / 3600)}h {Math.floor((readingTime[getMangaKey(mangaDetail.id, activeSource?.id)] % 3600) / 60)}m</strong>
                    </span>
                  </div>
                )}

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                    <h3 style={{ fontFamily: "'Segoe UI Variable Display','Segoe UI Variable','Segoe UI',system-ui,-apple-system,sans-serif", fontWeight: 700, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                      Chapters <Badge variant="outline" size="sm">{filteredChapters.length}</Badge>
                    </h3>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Btn variant="outline" size="sm" onClick={() => {
                        const mKey = getMangaKey(mangaDetail.id, activeSource?.id);
                        const unread = mangaDetail.chapters.filter(ch => !ch.read && !(readChapters[mKey]?.includes(String(ch.id))));
                        if (!unread.length) { toast('No unread chapters to download', 'warning'); return; }
                        queueChaptersForDownload(unread, mangaDetail.id, mangaDetail.title, activeSource?.id);
                      }} icon={EyeOff} title="Download unread chapters only">Unread</Btn>
                      <Btn variant="outline" size="sm" onClick={() => queueChaptersForDownload(mangaDetail.chapters, mangaDetail.id, mangaDetail.title, activeSource?.id)} icon={Archive}>All</Btn>
                      <Btn variant="ghost" size="sm" onClick={() => setChapterSort(s => s === 'desc' ? 'asc' : 'desc')} icon={chapterSort === 'desc' ? ChevronDown : ChevronUp}>
                        {chapterSort === 'desc' ? 'Newest' : 'Oldest'}
                      </Btn>
                    </div>
                  </div>

                  {mangaDetail.chapters.length > 15 && (
                    <div style={{ position: 'relative', marginBottom: 14 }}>
                      <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
                      <input placeholder="Search chapters..." value={chapSearch} onChange={e => setChapSearch(e.target.value)}
                        style={{ width: '100%', background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '11px 14px 11px 40px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'system-ui,-apple-system,Segoe UI,sans-serif' }}
                        onFocus={e => e.target.style.borderColor = 'var(--accent)'} onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {filteredChapters.map((ch, i) => {
                      const mKey = getMangaKey(mangaDetail.id, activeSource?.id);
                      const isCurrent = progress[mKey]?.chapterId === ch.id;
                      const isRead = ch.read || !!(readChapters[mKey]?.includes(String(ch.id)));
                      const downloadKey = getDownloadKey(mKey, ch.id);
                      const queuedDownload = downloadQueue.find(d =>
                        (d.downloadKey || getDownloadKey(getMangaKey(d.mangaId, d.sourceId), d.chapterId)) === downloadKey &&
                        d.status !== 'done' && d.status !== 'error' && d.status !== 'cancelled'
                      );
                      const isDownloaded = downloadedKeys.has(downloadKey);
                      const hasDownloadState = isDownloaded || queuedDownload;
                      return (
                        <div key={ch.id}
                          className={`anim-fadeInUp delay-${Math.min(i, 14)}`}
                          onClick={() => openChapter(ch, activeSource?.id || mangaDetail.sourceId, mangaDetail.id)}
                          onContextMenu={(e) => handleChapterContextMenu(e, ch)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '13px 16px', borderRadius: 12, cursor: 'pointer',
                            background: isCurrent ? 'rgba(249,115,22,0.1)' : isRead ? 'rgba(34,197,94,0.04)' : 'var(--card)',
                            border: `1.5px solid ${isCurrent ? 'var(--accent)' : hasDownloadState ? 'rgba(59,130,246,0.5)' : isRead ? 'rgba(34,197,94,0.2)' : 'var(--border)'}`,
                            transition: 'all 0.2s', position: 'relative', overflow: 'hidden',
                          }}
                          onMouseEnter={e => { if (!isCurrent) { e.currentTarget.style.borderColor = hasDownloadState ? 'rgba(59,130,246,0.85)' : 'var(--border-hover)'; e.currentTarget.style.transform = 'translateX(3px)'; } }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = isCurrent ? 'var(--accent)' : hasDownloadState ? 'rgba(59,130,246,0.5)' : isRead ? 'rgba(34,197,94,0.2)' : 'var(--border)'; e.currentTarget.style.transform = ''; }}>
                          {isCurrent && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--accent)' }} />}
                          {hasDownloadState && !isCurrent && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: '#3b82f6', boxShadow: '0 0 8px #3b82f680' }} />}
                          <div style={{ flex: 1, minWidth: 0, marginLeft: (isCurrent || hasDownloadState) ? 8 : 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                              <p style={{ fontWeight: 600, fontSize: 14, color: isCurrent ? 'var(--accent)' : isRead ? 'var(--muted)' : 'var(--text)', textDecoration: isRead ? 'line-through' : 'none', opacity: isRead ? 0.6 : 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                Ch. {ch.number}{ch.title && ch.title !== `Chapter ${ch.number}` && ` — ${ch.title}`}
                              </p>
                              {isRead && <Check size={13} style={{ color: '#4ade80', flexShrink: 0 }} />}
                              {isDownloaded && <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#60a5fa', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>offline</span>}
                              {queuedDownload && <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#93c5fd', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>{queuedDownload.status === 'downloading' ? `${queuedDownload.progress}%` : 'queued'}</span>}
                            </div>
                            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                              {ch.date && <span style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 3 }}><Calendar size={10} />{ch.date}</span>}
                              {ch.group && <span style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{ch.group}</span>}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {isDownloaded && (
                              <Btn variant="outline" size="icon" onClick={e => { e.stopPropagation(); deleteChapterBlobs(getMangaKey(mangaDetail.id, activeSource?.id), ch.id).then(refreshDownloads); toast('Offline copy removed', 'warning'); }} style={{ padding: 4, borderRadius: 8, color: '#60a5fa', borderColor: 'rgba(59,130,246,0.3)' }} title="Remove offline copy">
                                <Trash2 size={13} />
                              </Btn>
                            )}
                            <Btn variant="outline" size="icon" onClick={e => { e.stopPropagation(); handleDownload(ch); }} style={{ padding: 4, borderRadius: 8, color: isDownloaded ? '#60a5fa' : 'var(--muted)', borderColor: isDownloaded ? 'rgba(59,130,246,0.3)' : 'var(--border)' }} title={isDownloaded ? 'Re-download' : 'Save for offline'}>
                              <Download size={14} />
                            </Btn>
                            <ChevronRight size={16} style={{ color: isCurrent ? 'var(--accent)' : 'var(--muted)' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
                ) : null}
            </div>
            </div>
          )}

        {view !== 'manga' && <>
          {tab === 'home' && (
            <HomeTab
              history={history} library={library} progress={progress}
              sources={sources} updates={updates}
              getMangaKey={getMangaKey}
              onSelect={openManga}
              onContinue={handleContinueReading}
              onSwitchTab={switchTab}
            />
          )}
          {tab === 'recommendations' && (
            <DiscoverTab sources={sources} history={history} library={library} progress={progress} onSelect={openManga} onContinue={handleContinueReading} onSwitchTab={switchTab} />
          )}
          {tab === 'browse' && (
            <div className="page-transition">
              {view === 'tabs' ? (
                groupedInstalledSources.length === 0 ? (
                  <EmptyState icon={Globe} title="No sources installed" sub="Install extensions to start browsing" action={<Btn onClick={() => switchTab('extensions')}>Browse Extensions <ArrowRight size={16} /></Btn>} />
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: 18 }}>
                    {groupedInstalledSources.map((src, i) => (
                      <button key={src.id} className={`card-hover anim-fadeInUp delay-${Math.min(i, 10)}`} onClick={() => enterSource(src)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px', background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 20, cursor: 'pointer', gap: 14, textAlign: 'center', position: 'relative', overflow: 'hidden' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}>
                        <div style={{ width: 60, height: 60, background: 'var(--card2)', borderRadius: 18, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--border)' }}>
                          {src.icon ? <img src={src.icon} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 10 }} onError={e => e.target.style.display = 'none'} alt="" loading="lazy" /> : <Globe size={26} style={{ color: 'var(--muted)' }} />}
                        </div>
                        <div>
                          <p style={{ fontFamily: "'Segoe UI Variable Display','Segoe UI Variable','Segoe UI',system-ui,-apple-system,sans-serif", fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 6 }}>{src.name}</p>
                          {src.variantCount > 1
                            ? <Badge variant="outline" size="sm">{`${src.variantCount} langs • ${src.lang}`}</Badge>
                            : src.lang && <Badge variant="outline" size="sm">{src.lang}</Badge>}
                        </div>
                      </button>
                    ))}
                  </div>
                )
              ) : view === 'source' ? (
                <>
                  {showFilterBar && (
                    <BrowseFilterBar
                      filters={browseFilters}
                      onChange={handleFilterChange}
                      onClear={handleFilterClear}
                      activeCount={activeFilterCount}
                    />
                  )}

                  {browseLoading && results.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '100px 24px', gap: 20 }}>
                      <Spin size={40} /><p style={{ fontSize: 12, color: 'var(--muted)' }}>{query ? 'Searching...' : 'Loading...'}</p>
                    </div>
                  ) : browseError ? (
                    <EmptyState icon={AlertTriangle} title={browseError} action={<Btn onClick={() => doSearch(query, activeSource, browsePage, false, browseFilters)}>Retry</Btn>} />
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 18 }}>
                        {results.map((m, i) => <MangaCard key={getMangaKey(m.id, m.sourceId)} manga={m} onClick={openManga} index={i} onContextMenu={handleMangaContextMenu} />)}
                      </div>
                      {results.length === 0 && !browseLoading && (
                        <EmptyState icon={Search} title="No results" sub="Try adjusting your filters or search query" compact
                          action={activeFilterCount > 0 && <Btn variant="outline" size="sm" onClick={handleFilterClear}><X size={14} /> Clear Filters</Btn>}
                        />
                      )}
                      {hasNextPage && <div ref={sentinelRef} style={{ height: 20, margin: '20px 0' }} />}
                      {loadingMore && (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                          <Spin size={24} />
                        </div>
                      )}
                    </>
                  )}
                </>
              ) : null}
            </div>
          )}

          {tab === 'extensions' && (
            <ExtensionsTab
              extensions={normalizedExts}
              installing={installing}
              languages={LANGUAGES}
              onInstall={installExt}
              onUninstall={uninstallExt}
              onUpdate={updateExt}
              onRefresh={() => { fetchExtensions(); fetchSources(); }}
            />
          )}

          {tab === 'library' && (
            <div className="anim-fadeIn">
              <DuplicateBanner library={library} onRemove={(id, sid) => { const m = library.find(x => x.id === id && x.sourceId === sid); if (m) toggleLibrary(m, sid); }} />
              <StatsStrip library={library} history={history} progress={progress} readChapters={readChapters} />
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
                <button onClick={() => setActiveCategory('all')} style={{ padding: '9px 18px', borderRadius: 20, border: 'none', background: activeCategory === 'all' ? 'var(--accent)' : 'var(--card)', color: activeCategory === 'all' ? '#fff' : 'var(--text-dim)', fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: activeCategory === 'all' ? '0 4px 16px rgba(249,115,22,0.3)' : 'none', transition: 'all 0.2s' }}>All ({library.length})</button>
                {categories.map(cat => {
                  const count = library.filter(m => mangaCategories[getMangaKey(m.id, m.sourceId)] === cat.id).length;
                  return <button key={cat.id} onClick={() => setActiveCategory(cat.id)} style={{ padding: '9px 18px', borderRadius: 20, border: 'none', background: activeCategory === cat.id ? cat.color : 'var(--card)', color: activeCategory === cat.id ? '#fff' : 'var(--text-dim)', fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', opacity: count === 0 ? 0.5 : 1, boxShadow: activeCategory === cat.id ? `0 4px 16px ${cat.color}40` : 'none', transition: 'all 0.2s' }}>{cat.name} ({count})</button>;
                })}
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
                  <Search size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
                  <input placeholder="Search library..." value={librarySearch}
                    onChange={e => setLibrarySearch(e.target.value)}
                    style={{ width: '100%', background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '9px 36px 9px 38px', color: 'var(--text)', fontSize: 13, outline: 'none', transition: 'border-color 0.2s' }}
                    onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                  {librarySearch && <button onClick={() => setLibrarySearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}><X size={13} /></button>}
                </div>

                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <select value={librarySort} onChange={e => setLibrarySort(e.target.value)}
                    style={{ appearance: 'none', WebkitAppearance: 'none', background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '9px 32px 9px 14px', color: 'var(--text)', fontSize: 12, fontWeight: 600, cursor: 'pointer', outline: 'none', transition: 'border-color .2s' }}
                    onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'}>
                    <option value="recent">Last Read</option>
                    <option value="added">Date Added</option>
                    <option value="alpha">A → Z</option>
                    <option value="unread">Most Unread</option>
                    <option value="progress">Most Progress</option>
                  </select>
                  <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
                </div>

                <Btn variant={bulkMode ? 'default' : 'ghost'} size="sm"
                  onClick={() => { setBulkMode(m => !m); setBulkSelected(new Set()); }}>
                  {bulkMode ? <><Check size={13} /> {bulkSelected.size > 0 ? `${bulkSelected.size} selected` : 'Select'}</> : 'Select'}
                </Btn>

                {bulkMode && bulkSelected.size > 0 && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Btn variant="outline" size="sm" onClick={() => {
                      bulkSelected.forEach(mKey => {
                        const m = library.find(x => getMangaKey(x.id, x.sourceId) === mKey);
                        if (m) toggleLibrary(m, m.sourceId);
                      });
                      setBulkSelected(new Set()); setBulkMode(false);
                      toast(`Removed ${bulkSelected.size} manga`, 'success');
                    }}><Trash2 size={13} /> Remove</Btn>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                  {[['grid', <LayoutGrid size={16} />], ['list', <List size={16} />], ['compact', <Columns size={16} />], ['shelf', <BookOpen size={16} />]].map(([m, icon]) => (
                    <Btn key={m} variant={libraryView === m ? 'default' : 'ghost'} size="icon"
                      title={m === 'shelf' ? 'Bookshelf view' : m === 'compact' ? 'Compact view' : m === 'list' ? 'List view' : 'Grid view'}
                      onClick={() => { setLibraryView(m); updateSetting('libraryView', m); }}>{icon}</Btn>
                  ))}
                </div>
              </div>

              {filteredLibrary.length === 0 ? (
                librarySearch
                  ? <EmptyState icon={Search} title={`No results for "${librarySearch}"`} sub="Try a different search term" compact action={<Btn variant="outline" size="sm" onClick={() => setLibrarySearch('')}><X size={14} /> Clear</Btn>} />
                  : <EmptyState icon={Library} title={activeCategory === 'all' ? "Your library is empty" : `No manga in ${categories.find(c => c.id === activeCategory)?.name}`} sub={activeCategory === 'all' ? "Add manga from Browse to start" : "Move manga to this category from context menu"} action={activeCategory === 'all' && <Btn onClick={() => switchTab('browse')}>Browse Manga <ArrowRight size={16} /></Btn>} />
              ) : libraryView === 'list' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filteredLibrary.map((m, i) => (
                    <div key={getMangaKey(m.id, m.sourceId)} style={{ display: 'flex', alignItems: 'center' }}>
                      {bulkMode && (
                        <div style={{ paddingRight: 12 }}>
                          <input type="checkbox" checked={bulkSelected.has(getMangaKey(m.id, m.sourceId))} onChange={e => {
                            const s = new Set(bulkSelected);
                            const mKey = getMangaKey(m.id, m.sourceId);
                            e.target.checked ? s.add(mKey) : s.delete(mKey);
                            setBulkSelected(s);
                          }} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <MangaListCard manga={m} onClick={bulkMode ? () => { } : openManga} index={i} category={mangaCategories[getMangaKey(m.id, m.sourceId)]} progress={progress[getMangaKey(m.id, m.sourceId)] ? Math.round((parseInt(progress[getMangaKey(m.id, m.sourceId)].chapterNum) || (m.totalChapters || 100)) / Math.max(m.totalChapters || 1, 1) * 100) : 0} onContextMenu={handleMangaContextMenu} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : libraryView === 'shelf' ? (
                <div>
                  {[...Array(Math.ceil(filteredLibrary.length / 10))].map((_, row) => (
                    <div key={row} style={{ marginBottom: 20 }}>
                      <div style={{
                        height: 180, display: 'flex', alignItems: 'flex-end', gap: 2,
                        background: 'linear-gradient(to bottom,rgba(255,255,255,0.02),rgba(255,255,255,0.04))',
                        borderRadius: 12, padding: '8px 12px 0',
                        border: '1px solid var(--border)', position: 'relative', overflow: 'hidden'
                      }}>
                        <div style={{
                          position: 'absolute', bottom: 0, left: 0, right: 0, height: 10,
                          background: 'linear-gradient(to bottom,var(--card2),var(--bg2))',
                          borderTop: '2px solid rgba(255,255,255,0.07)'
                        }} />
                        {filteredLibrary.slice(row * 10, (row + 1) * 10).map((m) => {
                          const prog = progress[getMangaKey(m.id, m.sourceId)];
                          const pct = m.totalChapters && prog ? Math.min(1, (parseInt(prog.chapterNum) || 0) / m.totalChapters) : 0;
                          const hue = ((getMangaKey(m.id, m.sourceId) || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 360;
                          return (
                            <div key={getMangaKey(m.id, m.sourceId)} style={{ display: 'flex', alignItems: 'flex-end' }}>
                              {bulkMode && (
                                <input type="checkbox" checked={bulkSelected.has(getMangaKey(m.id, m.sourceId))} onChange={e => {
                                  const s = new Set(bulkSelected);
                                  const mKey = getMangaKey(m.id, m.sourceId);
                                  e.target.checked ? s.add(mKey) : s.delete(mKey);
                                  setBulkSelected(s);
                                }} style={{ position: 'absolute', top: -20, left: 4, width: 14, height: 14, accentColor: 'var(--accent)' }} />
                              )}
                              <div onClick={() => bulkMode ? null : openManga(m)} title={m.title}
                                style={{
                                  flex: 1, maxWidth: 80, minWidth: 24, height: 160,
                                  borderRadius: '3px 3px 0 0', cursor: 'pointer',
                                  position: 'relative', overflow: 'hidden',
                                  boxShadow: '2px 0 6px rgba(0,0,0,0.5)',
                                  transition: 'transform .2s ease, box-shadow .2s ease'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-12px) scale(1.04)'; e.currentTarget.style.zIndex = 10; e.currentTarget.style.boxShadow = '0 16px 36px rgba(0,0,0,0.7)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.zIndex = ''; e.currentTarget.style.boxShadow = '2px 0 6px rgba(0,0,0,0.5)'; }}>
                                {m.cover
                                  ? <img src={proxyImg(m.cover)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                                  : <div style={{
                                    width: '100%', height: '100%', background: `hsl(${hue},35%,18%)`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                  }}>
                                    <p style={{
                                      fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.45)',
                                      writingMode: 'vertical-rl', overflow: 'hidden', maxHeight: 120, padding: '0 4px', lineHeight: 1.2
                                    }}>
                                      {m.title}
                                    </p>
                                  </div>
                                }
                                {pct > 0 && <div style={{
                                  position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
                                  background: `hsla(${hue},70%,60%,0.9)`, width: `${pct * 100}%`
                                }} />}
                                {bulkMode && bulkSelected.has(getMangaKey(m.id, m.sourceId)) && (
                                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(249,115,22,0.4)', border: '2px solid var(--accent)' }} />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

              ) : libraryView === 'compact' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {filteredLibrary.map((m, i) => {
                    const cat = categories.find(c => c.id === mangaCategories[getMangaKey(m.id, m.sourceId)]);
                    const prog = progress[getMangaKey(m.id, m.sourceId)];
                    return (
                      <div key={getMangaKey(m.id, m.sourceId)} style={{ display: 'flex', alignItems: 'center' }}>
                        {bulkMode && (
                          <div style={{ paddingRight: 10 }}>
                            <input type="checkbox" checked={bulkSelected.has(getMangaKey(m.id, m.sourceId))} onChange={e => {
                              const s = new Set(bulkSelected);
                              const mKey = getMangaKey(m.id, m.sourceId);
                              e.target.checked ? s.add(mKey) : s.delete(mKey);
                              setBulkSelected(s);
                            }} style={{ width: 14, height: 14, accentColor: 'var(--accent)' }} />
                          </div>
                        )}
                        <div onClick={() => bulkMode ? null : openManga(m)} onContextMenu={e => handleMangaContextMenu(e, m)}
                          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderRadius: 9, background: 'var(--card)', border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.background = 'var(--card-hover)'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--card)'; }}
                        >
                          <div style={{ width: 32, height: 44, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: 'var(--card2)', border: '1px solid var(--border)' }}>
                            {m.cover ? <img src={proxyImg(m.cover)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" alt="" /> : <BookOpen size={14} style={{ color: 'var(--muted)', opacity: .4, margin: 'auto', display: 'block', marginTop: 14 }} />}
                          </div>
                          {cat && <div style={{ width: 3, height: 32, borderRadius: 2, background: cat.color, flexShrink: 0 }} />}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</p>
                            {m.author && <p style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.author}</p>}
                          </div>
                          {prog && <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>Ch.{prog.chapterNum}</span>}
                          <ChevronRight size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 18 }}>
                  {filteredLibrary.map((m, i) => (
                    <div key={getMangaKey(m.id, m.sourceId)} style={{ position: 'relative' }}>
                      <MangaCard manga={m} onClick={bulkMode ? () => { } : openManga} index={i} category={mangaCategories[getMangaKey(m.id, m.sourceId)]} progress={progress[getMangaKey(m.id, m.sourceId)] ? Math.round((parseInt(progress[getMangaKey(m.id, m.sourceId)].chapterNum) || (m.totalChapters || 100)) / Math.max(m.totalChapters || 1, 1) * 100) : 0} onContextMenu={handleMangaContextMenu} />
                      {bulkMode && (
                        <div style={{ position: 'absolute', inset: 0, background: bulkSelected.has(getMangaKey(m.id, m.sourceId)) ? 'rgba(249,115,22,0.2)' : 'transparent', border: bulkSelected.has(getMangaKey(m.id, m.sourceId)) ? '2px solid var(--accent)' : 'none', borderRadius: 16, pointerEvents: 'none' }} />
                      )}
                      {bulkMode && (
                        <input type="checkbox" checked={bulkSelected.has(getMangaKey(m.id, m.sourceId))} onChange={e => {
                          const s = new Set(bulkSelected);
                          const mKey = getMangaKey(m.id, m.sourceId);
                          e.target.checked ? s.add(mKey) : s.delete(mKey);
                          setBulkSelected(s);
                        }} style={{ position: 'absolute', top: 8, left: 8, width: 18, height: 18, accentColor: 'var(--accent)' }} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'history' && (
            <div className="page-transition">
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18 }}>
                {history.length > 0 && (
                  <Btn variant="danger" onClick={() => {
                    toast('History cleared', 'warning');
                    clearHistory();
                  }}><Trash2 size={15} /> Clear All</Btn>
                )}
              </div>
              {history.length === 0 ? <EmptyState icon={Clock} title="No history" sub="Manga you read will appear here" /> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 18 }}>
                  {history.map((m, i) => (
                    <div key={getMangaKey(m.id, m.sourceId)} style={{ position: 'relative' }}>
                      <MangaCard manga={m} onClick={openManga} index={i} badge={m.lastRead ? new Date(m.lastRead).toLocaleDateString() : null} />
                      <Btn variant="ghost" size="icon" onClick={e => { e.stopPropagation(); removeFromHistory(m.id, m.sourceId); }} style={{ position: 'absolute', top: 36, right: 6, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', width: 28, height: 28, borderRadius: 8 }}><X size={12} /></Btn>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'updates' && <UpdatesTab onOpenManga={openManga} />}
          {tab === 'downloads' && <DownloadsTab
            queue={downloadQueue}
            onClear={() => setDownloadQueue(prev => prev.filter(d => d.status === 'pending' || d.status === 'downloading'))}
            onRemove={id => setDownloadQueue(prev => prev.filter(d => d.id !== id))}
            onRetry={id => setDownloadQueue(prev => prev.map(d => d.id === id ? { ...d, status: 'pending', progress: 0, pagesLoaded: 0, pagesTotal: 0, error: null } : d))}
            onCancel={cancelDownload}
            onCancelAll={cancelActiveDownloads}
          />}
          {tab === 'settings' && <SettingsPage />}
          {migrateManga && <SourceMigrationModal manga={migrateManga} sources={sources} onClose={() => setMigrateManga(null)} onMigrate={handleMigrate} />}
        </>}
        {/* Live Download Overlay */}
        {downloadQueue.some(d => d.status === 'downloading' || d.status === 'pending') && !overlayHidden && (
          <div style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
            background: 'rgba(15,15,22,0.95)', backdropFilter: 'blur(16px)', border: '1px solid var(--border)',
            borderRadius: 20, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16,
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)', width: 'min(450px, 90vw)', animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
              <svg viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                <circle cx="18" cy="18" r="16" fill="none" stroke="var(--accent)" strokeWidth="3"
                  strokeDasharray={`${(downloadQueue.find(d => d.status === 'downloading')?.progress || 0) * 1.005} 100`}
                  style={{ transition: 'stroke-dasharray 0.3s ease' }} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Download size={16} style={{ color: 'var(--accent)' }} className="anim-pulse" />
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {downloadQueue.find(d => d.status === 'downloading')?.mangaTitle || 'Preparing...'}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                {(() => {
                  const downloading = downloadQueue.filter(d => d.status === 'downloading').length;
                  const pending = downloadQueue.filter(d => d.status === 'pending').length;
                  const current = downloadQueue.find(d => d.status === 'downloading');
                  if (current) return `Downloading Ch. ${current.chapterNum} • ${current.progress}% (${pending + downloading} left)`;
                  return `Waiting for ${pending} chapters...`;
                })()}
              </p>
            </div>

            <button onClick={() => setOverlayHidden(true)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--muted)' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}>
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </main >
    </>
  );
});

// ==================== ROOT ====================

const RootInner = () => {
  const { settings } = useData();
  return (
    <>
      <GlobalStyles appTheme={settings?.appTheme || 'dark'} accentColor={settings?.accentColor || '#f97316'} />
      <App />
    </>
  );
};

const Root = () => (
  <ErrorBoundary>
    <ToastProvider>
      <DataProvider>
        <RootInner />
      </DataProvider>
    </ToastProvider>
  </ErrorBoundary>
);

export default Root;
