// app.jsx - Final version with all requested features
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
  SlidersHorizontal, Coffee, AlertCircle, RotateCcw, ChevronRightCircle
} from 'lucide-react';

// ==================== CONFIG & CONSTANTS ====================

// Catches JS render errors and shows a recovery UI instead of white-screening
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  componentDidCatch(e, info) { console.error('[ErrorBoundary]', e, info); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0a0a0f', color:'#f87171', gap:16, padding:32 }}>
        <span style={{ fontSize:32 }}>💥</span>
        <h2 style={{ color:'#f1f5f9', margin:0 }}>Something crashed</h2>
        <p style={{ color:'#64748b', textAlign:'center', maxWidth:400 }}>{this.state.error.message}</p>
        <button
          onClick={() => this.setState({ error: null })}
          style={{ padding:'10px 24px', background:'#f97316', border:'none', borderRadius:10, color:'#fff', fontWeight:700, cursor:'pointer', fontSize:14 }}
        >Try again</button>
      </div>
    );
  }
}

const CONFIG = {
  API: 'http://localhost:3001/api',
  SUWAYOMI: 'http://localhost:4567',
  DEBOUNCE_DELAY: 300,
  UPDATE_INTERVAL: 3600000,
};

// Route Suwayomi images through our backend proxy so Electron doesn't
// block them as mixed-content (file:// → http://localhost:4567)
const proxyImg = (url) => {
  if (!url) return null;
  if (url.startsWith('http://localhost:4567') || url.startsWith('/')) {
    const absolute = url.startsWith('/') ? `${CONFIG.SUWAYOMI}${url}` : url;
    return `${CONFIG.API}/img?url=${encodeURIComponent(absolute)}`;
  }
  return url; // already an external CDN URL — serve directly
};

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

const CATEGORIES = [
  { id: 'reading', name: 'Reading', color: '#f97316', icon: BookOpen },
  { id: 'completed', name: 'Completed', color: '#22c55e', icon: Check },
  { id: 'planning', name: 'Plan to Read', color: '#3b82f6', icon: Calendar },
  { id: 'dropped', name: 'Dropped', color: '#ef4444', icon: X },
  { id: 'favorites', name: 'Favorites', color: '#f59e0b', icon: Star },
];

const THEMES = {
  dark: { bg: '#0a0a0f', card: '#16161f', accent: '#f97316' },
  darker: { bg: '#050505', card: '#0f0f15', accent: '#f97316' },
  sepia: { bg: '#1a1714', card: '#242019', accent: '#d4a574' },
  midnight: { bg: '#0f172a', card: '#1e293b', accent: '#60a5fa' }
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
  { value: 'hiatus', label: 'Hiatus' },
  { value: 'cancelled', label: 'Cancelled' },
];

const SORT_OPTIONS = [
  { value: 'latest', label: 'Latest' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'alphabetical', label: 'A–Z' },
  { value: 'new', label: 'Newly Added' },
  { value: 'rating', label: 'Top Rated' },
];

const CONTENT_TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'manga', label: 'Manga' },
  { value: 'manhwa', label: 'Manhwa' },
  { value: 'manhua', label: 'Manhua' },
  { value: 'novel', label: 'Novel' },
];

// ==================== UTILITY FUNCTIONS ====================

const storage = {
  get: (key, defaultValue) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch { return defaultValue; }
  },
  set: (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
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
    const diff = (new Date(dates[i-1]) - new Date(dates[i])) / 86400000;
    if (diff === 1) streak++;
    else break;
  }
  return streak;
};

// ==================== GLOBAL STYLES ====================

const GlobalStyles = memo(({ appTheme }) => {
  useEffect(() => {
    // Apply theme to root element
    const root = document.documentElement;
    if (appTheme === 'light') {
      root.setAttribute('data-theme', 'light');
    } else {
      root.removeAttribute('data-theme');
    }
  }, [appTheme]);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      /* Zero external font dependencies — works fully offline.
         Uses 'Segoe UI Variable Display' on Win11, 'Segoe UI' on Win10,
         system-ui everywhere else. Looks sharp on all platforms. */
      :root {
        --bg: #0a0a0f; --bg2: #0f0f18; --bg3: #13131f;
        --card: #16161f; --card2: #1c1c2a; --card-hover: #222230;
        --border: rgba(255,255,255,0.07); --border-hover: rgba(249,115,22,0.5);
        --muted: #64748b; --muted-fg: #94a3b8;
        --text: #e2e8f0; --text-dim: #94a3b8;
        --accent: #f97316; --accent2: #ea580c;
        --accent-glow: rgba(249,115,22,0.3);
        --radius: 14px; --radius-lg: 20px;
        --shadow: 0 4px 16px rgba(0,0,0,0.3);
        --shadow-glow: 0 8px 32px rgba(249,115,22,0.2);
        --transition-fast: 150ms cubic-bezier(0.16,1,0.3,1);
        --transition-base: 300ms cubic-bezier(0.16,1,0.3,1);
        --transition-slow: 500ms cubic-bezier(0.16,1,0.3,1);
      }
      [data-theme="light"] {
        --bg: #f0f2f7; --bg2: #e8eaf2; --bg3: #e0e3ef;
        --card: #ffffff; --card2: #f4f5fb; --card-hover: #ecedf8;
        --border: rgba(0,0,0,0.09); --border-hover: rgba(249,115,22,0.5);
        --muted: #8b95a8; --muted-fg: #6b7589;
        --text: #111827; --text-dim: #374151;
        --accent: #f97316; --accent2: #ea580c;
        --accent-glow: rgba(249,115,22,0.25);
        --shadow: 0 4px 16px rgba(0,0,0,0.1);
        --shadow-glow: 0 8px 32px rgba(249,115,22,0.2);
      }
      [data-theme="light"] body, [data-theme="light"] #root { background: var(--bg); color: var(--text); }
      [data-theme="light"] ::-webkit-scrollbar-track { background: var(--bg2); }
      [data-theme="light"] .glass { background: rgba(255,255,255,0.85); border: 1px solid rgba(0,0,0,0.08); }
      [data-theme="light"] .glass-strong { background: rgba(255,255,255,0.97); border: 1px solid rgba(0,0,0,0.09); }
      [data-theme="light"] select option { background: #ffffff; color: #111827; }
      [data-theme="light"] .anim-shimmer { background: linear-gradient(90deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.08) 50%, rgba(0,0,0,0.04) 100%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      html { scroll-behavior: smooth; }
      body, #root { min-height: 100vh; background: var(--bg); color: var(--text); font-family: 'Segoe UI Variable Display','Segoe UI Variable','Segoe UI',system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif; -webkit-font-smoothing: antialiased; overflow-x: hidden; }
      ::-webkit-scrollbar { width: 6px; height: 6px; }
      ::-webkit-scrollbar-track { background: var(--bg2); }
      ::-webkit-scrollbar-thumb { background: linear-gradient(180deg, var(--accent), var(--accent2)); border-radius: 3px; }
      @keyframes fadeInUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
      @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
      @keyframes slideInLeft { from { opacity:0; transform:translateX(-20px); } to { opacity:1; transform:translateX(0); } }
      @keyframes slideInRight { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
      @keyframes slideInDown { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:translateY(0); } }
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      @keyframes toastSlide { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      @keyframes gradientShift { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
      @keyframes dlItemIn { from { opacity:0; transform:translateX(-14px) scale(0.98); } to { opacity:1; transform:translateX(0) scale(1); } }
      @keyframes dlItemOut { from { opacity:1; transform:scale(1); max-height:80px; } to { opacity:0; transform:scale(0.95); max-height:0; margin-bottom:0; padding-top:0; padding-bottom:0; } }
      @keyframes progressPulse { 0%,100%{ box-shadow:0 0 6px rgba(249,115,22,0.4); } 50%{ box-shadow:0 0 14px rgba(249,115,22,0.75); } }
      @keyframes fabBounceIn { from { opacity:0; transform:scale(0.5) translateY(20px); } to { opacity:1; transform:scale(1) translateY(0); } }
      @keyframes headerSlideDown { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
      .anim-fadeInUp { animation: fadeInUp var(--transition-base) both; }
      .anim-fadeIn { animation: fadeIn var(--transition-fast) both; }
      .anim-slideLeft { animation: slideInLeft var(--transition-base) both; }
      .anim-slideDown { animation: slideInDown var(--transition-fast) both; }
      .anim-spin { animation: spin 0.8s linear infinite; }
      .anim-pulse { animation: pulse 2s ease infinite; }
      .anim-shimmer { background: linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 100%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
      .dl-item { animation: dlItemIn 0.28s cubic-bezier(0.16,1,0.3,1) both; }
      .dl-bar-active { animation: progressPulse 1.6s ease-in-out infinite; }
      .fab-back { animation: fabBounceIn 0.3s cubic-bezier(0.16,1,0.3,1) both; }
      ${Array.from({length:15},(_,i)=>`.delay-${i}{animation-delay:${i*50}ms}`).join(';')}
      .glass { background: rgba(22,22,31,0.8); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.08); }
      .glass-strong { background: rgba(22,22,31,0.97); backdrop-filter: blur(24px); border: 1px solid rgba(255,255,255,0.1); }
      .card-hover { transition: all var(--transition-slow); }
      .card-hover:hover { transform: translateY(-5px) scale(1.015); box-shadow: 0 20px 40px -12px rgba(249,115,22,0.2), 0 0 0 1px var(--border-hover); }
      .hover-lift { transition: transform var(--transition-base), box-shadow var(--transition-base); }
      .hover-lift:hover { transform: translateY(-3px); box-shadow: var(--shadow-glow); }
      .text-gradient { background: linear-gradient(135deg, var(--accent) 0%, #fb923c 50%, #fbbf24 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; background-size: 200% 200%; animation: gradientShift 8s ease infinite; }
      .gradient-primary { background: linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%); }
      .toast-enter { animation: toastSlide 0.4s cubic-bezier(0.16,1,0.3,1) both; }
      ::selection { background: rgba(249,115,22,0.25); color: inherit; }
      *:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
      @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
      input[type="range"] { -webkit-appearance: none; appearance: none; background: transparent; cursor: pointer; }
      input[type="range"]::-webkit-slider-runnable-track { background: var(--card2); height: 4px; border-radius: 2px; }
      input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; margin-top: -6px; background: var(--accent); height: 16px; width: 16px; border-radius: 50%; box-shadow: 0 2px 8px rgba(249,115,22,0.4); }
      select option { background: #16161f; color: #e2e8f0; }
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

// ── Manga detail skeleton loader ───────────────────────────────────────────
const MangaDetailSkeleton = memo(() => (
  <div style={{ maxWidth:840, margin:'0 auto', padding:'32px 20px 100px' }}>
    <div style={{ display:'flex', gap:28, marginBottom:32, flexWrap:'wrap' }}>
      <div className="anim-shimmer" style={{ width:160, height:240, borderRadius:20, flexShrink:0 }}/>
      <div style={{ flex:1, minWidth:240, paddingTop:4, display:'flex', flexDirection:'column', gap:14 }}>
        <div className="anim-shimmer" style={{ height:34, borderRadius:10, width:'75%' }}/>
        <div className="anim-shimmer" style={{ height:18, borderRadius:8, width:'40%' }}/>
        <div style={{ display:'flex', gap:8 }}>
          <div className="anim-shimmer" style={{ height:24, width:80, borderRadius:20 }}/>
          <div className="anim-shimmer" style={{ height:24, width:100, borderRadius:20 }}/>
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {[70,55,85,65,75].map((w,i) => <div key={i} className="anim-shimmer" style={{ height:22, width:w, borderRadius:20 }}/>)}
        </div>
        <div style={{ display:'flex', gap:10, marginTop:8 }}>
          <div className="anim-shimmer" style={{ height:48, width:160, borderRadius:12 }}/>
          <div className="anim-shimmer" style={{ height:48, width:140, borderRadius:12 }}/>
        </div>
      </div>
    </div>
    <div className="anim-shimmer" style={{ height:100, borderRadius:16, marginBottom:24 }}/>
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {[1,2,3,4,5,6].map(i => <div key={i} className="anim-shimmer" style={{ height:60, borderRadius:12 }}/>)}
    </div>
  </div>
));

// ==================== CONTEXT ====================

const ToastContext = createContext(null);
const ToastProvider = memo(({ children }) => {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);
  const show = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++idRef.current;
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), duration);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div style={{ position:'fixed', top:90, right:20, zIndex:9999, display:'flex', flexDirection:'column', gap:10, maxWidth:360, pointerEvents:'none' }}>
        {toasts.map(t => (
          <div key={t.id} className="toast-enter" style={{
            padding:'14px 18px', borderRadius:14, border:'1px solid var(--border)',
            background:'rgba(22,22,31,0.98)', backdropFilter:'blur(20px)',
            display:'flex', alignItems:'center', gap:12,
            boxShadow:'0 8px 32px rgba(0,0,0,0.4)', pointerEvents:'auto'
          }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background: t.type==='success'?'#4ade80':t.type==='error'?'#f87171':t.type==='warning'?'#facc15':'#60a5fa', boxShadow:`0 0 10px ${t.type==='success'?'#4ade80':t.type==='error'?'#f87171':t.type==='warning'?'#facc15':'#60a5fa'}` }}/>
            <span style={{ fontSize:13, fontWeight:500 }}>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
});
const useToast = () => useContext(ToastContext);

const DataContext = createContext(null);
const DataProvider = memo(({ children }) => {
  const [backendOnline, setBackendOnlineRaw] = useState(null);
  // Track current value in a ref so the callback never has a stale closure
  const backendOnlineRef = useRef(null);
  // Debounce going offline so a brief wifi blip doesn't flash the error modal
  const offlineTimer = useRef(null);
  const setBackendOnline = useCallback((val) => {
    if (val === false) {
      // Only debounce true→false (brief connectivity hiccup).
      // null→false (first health check failed) should resolve immediately so
      // the startup screen exits right away instead of hanging for 6 seconds.
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
  const [readChapters, setReadChapters] = useState(() => storage.get('readChapters', {}));
  const [installing, setInstalling] = useState(new Set());
  const [readingTime, setReadingTime] = useState(() => storage.get('readingTime', {}));
  const [settings, setSettingsState] = useState(() => storage.get('appSettings', {
    readerMode: 'scroll', brightness: 100, fitMode: 'height', theme: 'dark',
    sidebarCollapsed: false, libraryView: 'grid', tagSearchMode: 'source', appTheme: 'dark'
  }));
  const [updates, setUpdates] = useState([]);
  const [checkingUpdates, setCheckingUpdates] = useState(false);

  const toastRef = useRef(null);
  toastRef.current = useToast();
  const sourcesRef = useRef({});
  const extRef = useRef([]);

  useEffect(() => storage.set('library', library), [library]);
  useEffect(() => storage.set('history', history), [history]);
  useEffect(() => storage.set('progress', progress), [progress]);
  useEffect(() => storage.set('mangaCategories', mangaCategories), [mangaCategories]);
  useEffect(() => storage.set('readChapters', readChapters), [readChapters]);
  useEffect(() => storage.set('readingTime', readingTime), [readingTime]);
  useEffect(() => storage.set('appSettings', settings), [settings]);

  const fetchJSON = useCallback(async (url, opts = {}) => {
    const r = await fetch(`${CONFIG.API}${url}`, { ...opts, headers: { 'Content-Type': 'application/json', ...opts.headers } });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }, []);

  const checkHealth = useCallback(async () => {
    try {
      const d = await fetchJSON('/health');
      setBackendOnline(d.ok);
      // Sync Suwayomi state from the health response when polling
      if (d.ok && d.suwayomi !== undefined) setSuwayomiReady(d.suwayomi);
    }
    catch { setBackendOnline(false); }
  }, [fetchJSON]);

  const fetchSources = useCallback(async () => {
    try {
      const data = await fetchJSON('/sources');
      if (!Array.isArray(data)) return;
      const map = {};
      data.forEach(s => { map[String(s.id)] = { id: String(s.id), name: s.displayName || s.name, lang: s.lang, icon: proxyImg(s.icon || s.iconUrl || null) }; });
      if (JSON.stringify(map) !== JSON.stringify(sourcesRef.current)) { sourcesRef.current = map; setSources(map); }
    } catch {}
  }, [fetchJSON]);

  const fetchExtensions = useCallback(async () => {
    try {
      const data = await fetchJSON('/extensions');
      if (!Array.isArray(data)) return [];
      // Normalize JS extension format → legacy shape ExtCard expects
      const normalized = data.map(e => ({
        ...e,
        pkgName:     e.pkgName  || e.id,
        isInstalled: e.isInstalled ?? e.installed ?? false,
        isNsfw:      e.isNsfw   ?? e.nsfw ?? false,
        versionName: e.versionName || e.version || '1.0.0',
        versionCode: e.versionCode || 1,
        hasUpdate:   e.hasUpdate ?? false,
        iconUrl:     proxyImg(e.iconUrl || null),  // proxied through backend
      }));
      if (JSON.stringify(normalized) !== JSON.stringify(extRef.current)) { extRef.current = normalized; setExtensions(normalized); }
      return normalized;
    } catch { return []; }
  }, [fetchJSON]);

  const installExt = useCallback(async (pkgName) => {
    setInstalling(s => new Set([...s, pkgName]));
    try {
      await fetchJSON(`/extensions/install/${encodeURIComponent(pkgName)}`, { method: 'POST' });
      const exts = await fetchExtensions();
      await fetchSources();
      const found = exts.find(e => e.pkgName === pkgName || e.id === pkgName);
      toastRef.current?.(`${found?.name || pkgName} installed`, 'success');
    } catch (e) { toastRef.current?.(`Install failed: ${e.message}`, 'error'); }
    finally { setInstalling(s => { const n = new Set(s); n.delete(pkgName); return n; }); }
  }, [fetchJSON, fetchExtensions, fetchSources]);

  const uninstallExt = useCallback(async (pkgName) => {
    setInstalling(s => new Set([...s, pkgName]));
    try { await fetchJSON(`/extensions/uninstall/${encodeURIComponent(pkgName)}`, { method: 'POST' }); await fetchExtensions(); await fetchSources(); toastRef.current?.('Extension removed', 'warning'); }
    catch (e) { toastRef.current?.(`Uninstall failed: ${e.message}`, 'error'); }
    finally { setInstalling(s => { const n = new Set(s); n.delete(pkgName); return n; }); }
  }, [fetchJSON, fetchExtensions, fetchSources]);

  const updateExt = useCallback(async (pkgName) => {
    setInstalling(s => new Set([...s, pkgName]));
    try { await fetchJSON(`/extensions/update/${encodeURIComponent(pkgName)}`, { method: 'POST' }); await fetchExtensions(); await fetchSources(); toastRef.current?.('Extension updated', 'success'); }
    catch (e) { toastRef.current?.(`Update failed: ${e.message}`, 'error'); }
    finally { setInstalling(s => { const n = new Set(s); n.delete(pkgName); return n; }); }
  }, [fetchJSON, fetchExtensions, fetchSources]);

  const toggleLibrary = useCallback((manga, sourceId) => {
    setLibrary(prev => {
      const exists = prev.find(m => m.id === manga.id);
      if (exists) { toastRef.current?.('Removed from library', 'warning'); return prev.filter(m => m.id !== manga.id); }
      toastRef.current?.('Added to library', 'success');
      return [{ id: manga.id, title: manga.title, cover: manga.cover, sourceId, addedAt: Date.now() }, ...prev];
    });
  }, []);

  const setCategory = useCallback((mangaId, categoryId) => {
    setMangaCategories(prev => ({ ...prev, [mangaId]: categoryId }));
    toastRef.current?.(`Moved to ${CATEGORIES.find(c => c.id === categoryId)?.name}`, 'success');
  }, []);

  const addToHistory = useCallback((manga, sourceId, details) => {
    setHistory(prev => {
      const filtered = prev.filter(m => m.id !== manga.id);
      return [{ id: manga.id, title: details?.title || manga.title, cover: details?.cover || manga.cover, sourceId, author: details?.author, lastRead: Date.now() }, ...filtered].slice(0, 100);
    });
  }, []);

  const removeFromHistory = useCallback((mangaId) => {
    setHistory(prev => prev.filter(m => m.id !== mangaId));
    toastRef.current?.('Removed from history', 'warning');
  }, []);

  const updateProgress = useCallback((mangaId, chapterId, chapterNum, page) => {
    if (!mangaId) return;
    setProgress(p => ({ ...p, [mangaId]: { chapterId, chapterNum, page, lastRead: Date.now() } }));
  }, []);

  const markChapterRead = useCallback((mangaId, chapterId, isRead = true) => {
    if (!mangaId || !chapterId) return;
    setReadChapters(prev => {
      const key = String(mangaId);
      const current = new Set(prev[key] || []);
      if (isRead) current.add(String(chapterId));
      else current.delete(String(chapterId));
      return { ...prev, [key]: [...current] };
    });
  }, []);

  const addReadingTime = useCallback((mangaId, seconds) => {
    if (!mangaId || seconds <= 0) return;
    setReadingTime(prev => ({ ...prev, [mangaId]: (prev[mangaId] || 0) + seconds }));
  }, []);

  const updateSetting = useCallback((key, value) => {
    setSettingsState(prev => ({ ...prev, [key]: value }));
  }, []);

  const checkForUpdates = useCallback(async () => {
    if (library.length === 0) return;
    setCheckingUpdates(true);
    const newUpdates = [];
    for (const manga of library) {
      try {
        const source = sources[manga.sourceId];
        if (!source) continue;
        const data = await fetchJSON(`/source/${source.id}/manga/${manga.id}`);
        if (data.error) continue;
        const currentTotal = data.totalChapters;
        const savedProgress = progress[manga.id];
        const lastReadChapter = savedProgress ? parseInt(savedProgress.chapterNum) : 0;
        if (currentTotal > lastReadChapter) {
          newUpdates.push({ ...manga, newChapters: currentTotal - lastReadChapter });
        }
      } catch (e) {
        console.warn(`Update check failed for ${manga.title}`, e);
      }
    }
    setUpdates(newUpdates);
    setCheckingUpdates(false);
    if (newUpdates.length > 0) {
      toastRef.current?.(`${newUpdates.length} manga have updates`, 'info');
    }
  }, [library, sources, fetchJSON, progress]);

  useEffect(() => {
    if (library.length > 0 && backendOnline) {
      checkForUpdates();
      const interval = setInterval(checkForUpdates, CONFIG.UPDATE_INTERVAL);
      return () => clearInterval(interval);
    }
  }, [library, backendOnline, checkForUpdates]);

  useEffect(() => {
    checkHealth(); fetchSources(); fetchExtensions();
    // Health every 30s is plenty — sources/extensions only need refreshing
    // when something changes (install/uninstall already clears caches).
    const t = setInterval(() => { checkHealth(); }, 30000);
    return () => clearInterval(t);
  }, [checkHealth, fetchSources, fetchExtensions]);

  const value = useMemo(() => ({
    backendOnline, sources, extensions, library, history, progress,
    mangaCategories, installing, readingTime, settings, updates, checkingUpdates,
    readChapters,
    fetchJSON, checkHealth, fetchSources, fetchExtensions,
    installExt, uninstallExt, updateExt,
    toggleLibrary, setCategory, addToHistory, removeFromHistory,
    updateProgress, markChapterRead, addReadingTime, updateSetting, checkForUpdates,
    inLibrary: (id) => library.some(m => m.id === id)
  }), [backendOnline, sources, extensions, library, history, progress, mangaCategories, installing, readingTime, settings, updates, checkingUpdates, readChapters, fetchJSON, checkHealth, fetchSources, fetchExtensions, installExt, uninstallExt, updateExt, toggleLibrary, setCategory, addToHistory, removeFromHistory, updateProgress, markChapterRead, addReadingTime, updateSetting, checkForUpdates]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
});
const useData = () => useContext(DataContext);

// ==================== UI PRIMITIVES ====================

const Spin = memo(({ size = 24 }) => (
  <Loader2 size={size} className="anim-spin" style={{ color: 'var(--accent)' }} />
));

const Btn = memo(({ children, variant = 'default', size = 'md', onClick, disabled, className = '', style = {}, icon: Icon, type = 'button' }) => {
  const base = { display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8, border:'none', cursor:disabled?'not-allowed':'pointer', fontFamily:'system-ui,-apple-system,Segoe UI,sans-serif', fontWeight:600, borderRadius:12, whiteSpace:'nowrap', opacity:disabled?0.4:1, position:'relative', overflow:'hidden', transition:'all var(--transition-fast)' };
  const sizes = { sm:{padding:'7px 14px',fontSize:12,height:32}, md:{padding:'10px 20px',fontSize:13,height:40}, lg:{padding:'14px 28px',fontSize:14,height:48}, icon:{padding:10,borderRadius:12,width:40,height:40} };
  const variants = {
    default:{ background:'linear-gradient(135deg,var(--accent) 0%,var(--accent2) 100%)', color:'#fff', boxShadow:'0 4px 16px rgba(249,115,22,0.3)' },
    outline:{ background:'transparent', color:'var(--text-dim)', border:'1.5px solid var(--border)' },
    ghost:{ background:'transparent', color:'var(--text-dim)' },
    secondary:{ background:'var(--card)', color:'var(--text)', border:'1px solid var(--border)' },
    danger:{ background:'rgba(239,68,68,0.12)', color:'#f87171', border:'1.5px solid rgba(239,68,68,0.2)' },
    success:{ background:'rgba(34,197,94,0.12)', color:'#4ade80', border:'1.5px solid rgba(34,197,94,0.2)' },
  };
  return (
    <button type={type} style={{ ...base, ...(sizes[size]||sizes.md), ...(variants[variant]||variants.default), ...style }} disabled={disabled} onClick={onClick} className={className}
      onMouseEnter={e => { if (!disabled && variant==='default') { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(249,115,22,0.4)'; } else if (!disabled) { e.currentTarget.style.background='rgba(255,255,255,0.06)'; } }}
      onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow=variant==='default'?'0 4px 16px rgba(249,115,22,0.3)':''; e.currentTarget.style.background=variants[variant]?.background||'transparent'; }}
    >
      {Icon && <Icon size={size==='sm'?14:size==='icon'?18:16}/>}
      {children}
    </button>
  );
});

const Badge = memo(({ children, variant = 'default', size = 'md', onClick, style }) => {
  const styles = {
    default:{ background:'rgba(249,115,22,0.15)', color:'var(--accent)', border:'1px solid rgba(249,115,22,0.25)' },
    success:{ background:'rgba(34,197,94,0.12)', color:'#4ade80', border:'1px solid rgba(34,197,94,0.2)' },
    destructive:{ background:'rgba(239,68,68,0.12)', color:'#f87171', border:'1px solid rgba(239,68,68,0.2)' },
    outline:{ background:'transparent', color:'var(--muted-fg)', border:'1px solid var(--border)' },
    update:{ background:'rgba(234,179,8,0.12)', color:'#facc15', border:'1px solid rgba(234,179,8,0.2)' },
    installing:{ background:'rgba(99,102,241,0.12)', color:'#818cf8', border:'1px solid rgba(99,102,241,0.2)' },
    nsfw:{ background:'rgba(236,72,153,0.15)', color:'#f472b6', border:'1px solid rgba(236,72,153,0.25)' },
  };
  const sizes = { sm:{padding:'1px 6px',fontSize:9,borderRadius:4}, md:{padding:'3px 10px',fontSize:10,borderRadius:6}, lg:{padding:'4px 12px',fontSize:11,borderRadius:8} };
  return <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontWeight:700, letterSpacing:'0.04em', textTransform:'uppercase', ...(styles[variant]||styles.default), ...(sizes[size]||sizes.md), ...style }} onClick={onClick}>{children}</span>;
});

const EmptyState = memo(({ icon: Icon, title, sub, action, compact }) => (
  <div className="anim-fadeIn" style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', padding:compact?'40px 24px':'80px 24px', gap:compact?12:20 }}>
    <div style={{ width:compact?56:88, height:compact?56:88, borderRadius:compact?16:24, background:'linear-gradient(135deg,var(--card),var(--card2))', border:'1.5px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted)', boxShadow:'0 8px 32px rgba(0,0,0,0.2)' }}>
      <Icon size={compact?24:36} style={{ opacity:0.6 }}/>
    </div>
    <div>
      <p style={{ fontFamily:"'Segoe UI Variable Display','Segoe UI Variable','Segoe UI',system-ui,-apple-system,sans-serif", fontWeight:700, fontSize:compact?15:20, color:'var(--text)', marginBottom:compact?4:8 }}>{title}</p>
      {sub && <p style={{ color:'var(--muted)', fontSize:compact?12:14, maxWidth:360, lineHeight:1.7 }}>{sub}</p>}
    </div>
    {action && <div style={{ marginTop:compact?8:12 }}>{action}</div>}
  </div>
));

const ContextMenu = memo(({ x, y, items, onClose }) => {
  useEffect(() => {
    const h = () => onClose();
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [onClose]);
  return (
    <div className="anim-fadeIn" style={{ position:'fixed', left:x, top:y, background:'rgba(22,22,31,0.98)', backdropFilter:'blur(20px)', border:'1px solid var(--border)', borderRadius:12, padding:6, minWidth:180, zIndex:10000, boxShadow:'0 16px 48px rgba(0,0,0,0.4)' }}>
      {items.map((item, i) => (
        <button key={i} onClick={() => { item.action(); onClose(); }} style={{ width:'100%', display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderRadius:8, border:'none', background:'transparent', color:item.danger?'#f87171':'var(--text)', fontSize:13, fontWeight:500, cursor:'pointer', textAlign:'left', transition:'all 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.background = item.danger?'rgba(239,68,68,0.1)':'rgba(255,255,255,0.06)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          {item.icon && <item.icon size={16} style={{ color:item.danger?'#f87171':'var(--muted)' }}/>}
          {item.label}
        </button>
      ))}
    </div>
  );
});

const StatItem = memo(({ icon: Icon, label, value }) => (
  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
    <div style={{ width:36, height:36, borderRadius:10, background:'rgba(249,115,22,0.1)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <Icon size={18} style={{ color:'var(--accent)' }}/>
    </div>
    <div>
      <p style={{ fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.04em' }}>{label}</p>
      <p style={{ fontSize:16, fontWeight:700, color:'var(--text)' }}>{value}</p>
    </div>
  </div>
));

// ==================== MANGA CARD ====================

const MangaCard = memo(({ manga, onClick, index = 0, badge, progress, category, onContextMenu }) => {
  const [loaded, setLoaded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [inView, setInView] = useState(false);
  const cardRef = useRef(null);

  const categoryColor = useMemo(() => CATEGORIES.find(c => c.id === category)?.color, [category]);

  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); observer.disconnect(); } }, { rootMargin: '50px' });
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  const handleContextMenu = useCallback((e) => { e.preventDefault(); onContextMenu?.(e, manga); }, [manga, onContextMenu]);

  return (
    <div
      ref={cardRef}
      className={`card-hover anim-fadeInUp delay-${Math.min(index,14)}`}
      style={{ cursor:'pointer', position:'relative', userSelect:'none' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onClick(manga)}
      onContextMenu={handleContextMenu}
    >
      {categoryColor && (
        <div style={{ position:'absolute', top:8, left:8, width:4, height:32, background:categoryColor, borderRadius:2, zIndex:3, boxShadow:`0 0 10px ${categoryColor}80` }}/>
      )}
      {badge && (
        <div style={{ position:'absolute', top:8, right:8, zIndex:3, background:'rgba(249,115,22,0.95)', color:'#fff', padding:'4px 10px', borderRadius:20, fontSize:10, fontWeight:700, backdropFilter:'blur(8px)', boxShadow:'0 4px 12px rgba(249,115,22,0.3)' }}>
          {badge}
        </div>
      )}
      <div style={{
        aspectRatio:'2/3', borderRadius:16, overflow:'hidden', marginBottom:10,
        border:`1.5px solid ${hovered?'var(--border-hover)':'var(--border)'}`,
        background:'var(--card)', position:'relative', transition:'all var(--transition-slow)',
        boxShadow: hovered ? '0 20px 40px -12px rgba(249,115,22,0.2)' : '0 4px 12px rgba(0,0,0,0.2)'
      }}>
        {!loaded && !imageError && inView && <div className="anim-shimmer" style={{ position:'absolute', inset:0, zIndex:1 }}/>}
        {inView && manga.cover && !imageError ? (
          <img src={proxyImg(manga.cover)} style={{ width:'100%', height:'100%', objectFit:'cover', transform:hovered?'scale(1.07)':'scale(1)', transition:'transform 0.6s cubic-bezier(0.16,1,0.3,1)', opacity:loaded?1:0 }} alt={manga.title} loading="lazy" onLoad={() => setLoaded(true)} onError={() => setImageError(true)}/>
        ) : (
          <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,var(--card),var(--card2))', gap:10 }}>
            <BookOpen size={32} style={{ color:'var(--muted)', opacity:0.4 }}/>
            <span style={{ fontSize:10, color:'var(--muted)' }}>No cover</span>
          </div>
        )}

        {progress > 0 && (
          <div style={{ position:'absolute', bottom:0, left:0, right:0, height:4, background:'rgba(0,0,0,0.5)', zIndex:4 }}>
            <div style={{ width:`${Math.min(progress,100)}%`, height:'100%', background:'linear-gradient(90deg,var(--accent),#fb923c)', boxShadow:'0 0 8px rgba(249,115,22,0.6)', transition:'width 0.5s' }}/>
          </div>
        )}
      </div>
      <p style={{ fontSize:13, fontWeight:600, color:hovered?'var(--text)':'var(--text-dim)', lineHeight:1.4, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden', transition:'color 0.2s', minHeight:36 }}>
        {manga.title}
      </p>
      {manga.author && (
        <p style={{ fontSize:11, color:'var(--muted)', marginTop:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {manga.author}
        </p>
      )}
    </div>
  );
});

// ── List-view card (horizontal layout) ────────────────────────────────────
const MangaListCard = memo(({ manga, onClick, category, progress: prog, onContextMenu }) => {
  const [imageError, setImageError] = useState(false);
  const categoryColor = useMemo(() => CATEGORIES.find(c => c.id === category)?.color, [category]);
  return (
    <div
      onClick={() => onClick(manga)}
      onContextMenu={e => { e.preventDefault(); onContextMenu?.(e, manga); }}
      style={{ display:'flex', alignItems:'center', gap:16, padding:'10px 14px', borderRadius:14, background:'var(--card)', border:'1.5px solid var(--border)', cursor:'pointer', transition:'all 0.2s', position:'relative', overflow:'hidden' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor='var(--border-hover)'; e.currentTarget.style.background='var(--card-hover)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.background='var(--card)'; }}
    >
      {categoryColor && <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3, background:categoryColor, borderRadius:'2px 0 0 2px' }}/>}
      <div style={{ width:56, height:80, borderRadius:10, overflow:'hidden', flexShrink:0, background:'var(--card2)', border:'1px solid var(--border)' }}>
        {manga.cover && !imageError
          ? <img src={proxyImg(manga.cover)} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt={manga.title} loading="lazy" onError={() => setImageError(true)}/>
          : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}><BookOpen size={20} style={{ color:'var(--muted)', opacity:0.4 }}/></div>
        }
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontWeight:700, fontSize:14, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:5 }}>{manga.title}</p>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          {manga.author && <span style={{ fontSize:12, color:'var(--muted)' }}>{manga.author}</span>}
          {manga.status && <Badge variant={manga.status==='ongoing'?'success':'outline'} size="sm">{manga.status}</Badge>}
        </div>
        {prog > 0 && (
          <div style={{ marginTop:8, height:3, background:'rgba(255,255,255,0.08)', borderRadius:2, overflow:'hidden' }}>
            <div style={{ width:`${Math.min(prog,100)}%`, height:'100%', background:'linear-gradient(90deg,var(--accent),#fb923c)' }}/>
          </div>
        )}
      </div>
      <ChevronRight size={16} style={{ color:'var(--muted)', flexShrink:0 }}/>
    </div>
  );
});

// Extension Card
const ExtCard = memo(({ ext, onInstall, onUninstall, installing, onUpdate }) => {
  const isInstalling = installing.has(ext.pkgName);
  const isInstalled = ext.isInstalled;
  const hasUpdate = ext.hasUpdate;
  const toast = useToast();

  return (
    <div className="hover-lift" style={{ display:'flex', alignItems:'center', gap:16, padding:'16px 20px', borderRadius:16, background:'var(--card)', border:`1.5px solid ${isInstalled?'rgba(34,197,94,0.2)':'var(--border)'}`, transition:'all 0.3s', position:'relative', overflow:'hidden' }}>
      {isInstalled && <div style={{ position:'absolute', inset:0, background:'linear-gradient(90deg,rgba(34,197,94,0.03),transparent)', pointerEvents:'none' }}/>}
      <div style={{ width:52, height:52, borderRadius:14, background:'var(--card2)', border:'1.5px solid var(--border)', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, position:'relative' }}>
        {(ext.icon || ext.iconUrl) ? <img src={ext.icon || ext.iconUrl} style={{ width:'100%', height:'100%', objectFit:'contain', padding:8 }} onError={e=>e.target.style.display='none'} alt="" loading="lazy"/> : <Globe size={22} style={{ color:'var(--muted)' }}/>}
        {isInstalled && <div style={{ position:'absolute', bottom:-1, right:-1, width:16, height:16, background:'#22c55e', borderRadius:'50%', border:'2px solid var(--card)', boxShadow:'0 0 8px #22c55e' }}/>}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:6 }}>
          <span style={{ fontWeight:700, fontSize:15, color:isInstalled?'var(--text)':'var(--text-dim)' }}>{ext.name}</span>
          {ext.isNsfw && <Badge variant="nsfw" size="sm">18+</Badge>}
          {hasUpdate && !isInstalling && <Badge variant="update" size="sm">Update</Badge>}
          {isInstalling && <Badge variant="installing" size="sm">Working...</Badge>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <span style={{ fontSize:12, color:'var(--muted)', fontWeight:500, display:'flex', alignItems:'center', gap:4 }}><Globe size={11}/>{ext.lang}</span>
          <span style={{ color:'var(--border)' }}>•</span>
          <span style={{ fontSize:12, color:'var(--muted-fg)' }}>v{ext.versionName||ext.versionCode}</span>
          {isInstalled && <><span style={{ color:'var(--border)' }}>•</span><span style={{ fontSize:12, color:'#4ade80', fontWeight:500, display:'flex', alignItems:'center', gap:4 }}><Check size={12}/>Active</span></>}
        </div>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        {hasUpdate && isInstalled && !isInstalling && <Btn variant="success" size="sm" onClick={() => { onUpdate?.(ext.pkgName); toast?.(`Updating ${ext.name}...`, 'info'); }}><RefreshCw size={13}/> Update</Btn>}
        <Btn variant={isInstalled?'outline':'default'} size="sm" disabled={isInstalling} onClick={() => {
          if (isInstalling) return;
          if (isInstalled) { onUninstall(ext.pkgName); toast?.(`Removing ${ext.name}...`, 'warning'); }
          else { onInstall(ext.pkgName); toast?.(`Installing ${ext.name}...`, 'info'); }
        }}>
          {isInstalling ? <><Spin size={14}/><span style={{ marginLeft:6 }}>...</span></> : isInstalled ? <><Trash2 size={14}/> Remove</> : <><Download size={14}/> Install</>}
        </Btn>
      </div>
    </div>
  );
});

// ==================== READER (Fixed zoom for all modes) ====================

const Reader = memo(({ pages, currentChapter, mangaTitle, onBack, onNextChapter, onPrevChapter, hasNext, hasPrev, onPageChange, initialPage = 0, mangaId }) => {
  const data = useData();
  const { updateProgress, addReadingTime, settings, updateSetting } = data || {};

  const [mode, setMode] = useState(settings?.readerMode || 'scroll');
  const [currentPage, setCurrentPage] = useState(Math.min(initialPage, Math.max(0, pages.length - 1)));
  const [showControls, setShowControls] = useState(true);
  const [brightness, setBrightness] = useState(settings?.brightness || 100);
  const [fitMode, setFitMode] = useState(settings?.fitMode || 'height');
  const [theme, setTheme] = useState(settings?.readerTheme || 'dark');
  const [zoom, setZoom] = useState(1);
  const [touchStart, setTouchStart] = useState(null);

  const containerRef = useRef(null);
  const controlsTimer = useRef(null);
  const startTime = useRef(Date.now());
  const themeStyles = THEMES[theme] || THEMES.dark;

  useEffect(() => { updateSetting?.('readerMode', mode); }, [mode]);
  useEffect(() => { updateSetting?.('brightness', brightness); }, [brightness]);
  useEffect(() => { updateSetting?.('fitMode', fitMode); }, [fitMode]);
  useEffect(() => { updateSetting?.('readerTheme', theme); }, [theme]);

  useEffect(() => {
    startTime.current = Date.now();
    return () => {
      if (mangaId && addReadingTime) {
        const elapsed = Math.round((Date.now() - startTime.current) / 1000);
        if (elapsed > 0) addReadingTime(mangaId, elapsed);
      }
    };
  }, [mangaId, currentChapter?.id]);

  const scrollToPage = useCallback((idx) => {
    const el = document.getElementById(`reader-page-${idx}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const changePage = useCallback((delta) => {
    const np = Math.max(0, Math.min(pages.length - 1, currentPage + delta));
    setCurrentPage(np);
    onPageChange?.(np);
    updateProgress?.(mangaId, currentChapter?.id, currentChapter?.number, np);
    if (mode !== 'paged') scrollToPage(np);
  }, [currentPage, pages.length, mode, onPageChange, updateProgress, mangaId, currentChapter, scrollToPage]);

  const showControlsTemp = useCallback(() => {
    setShowControls(true);
    clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => {
    const h = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      // Page navigation
      if (e.key === 'ArrowRight' || e.key === 'd') { if (mode === 'paged') changePage(1); }
      else if (e.key === 'ArrowLeft'  || e.key === 'a') { if (mode === 'paged') changePage(-1); }
      else if (e.key === 'ArrowDown'  || e.key === 's') { if (mode === 'paged') changePage(1); }
      else if (e.key === 'ArrowUp'    || e.key === 'w') { if (mode === 'paged') changePage(-1); }
      else if (e.key === 'PageDown')  { e.preventDefault(); changePage(1); }
      else if (e.key === 'PageUp')    { e.preventDefault(); changePage(-1); }
      else if (e.key === 'Home')      { e.preventDefault(); setCurrentPage(0); onPageChange?.(0); }
      else if (e.key === 'End')       { e.preventDefault(); const last = pages.length - 1; setCurrentPage(last); onPageChange?.(last); }
      // Chapter navigation
      else if (e.key === 'n' || (e.key === 'ArrowRight' && e.ctrlKey)) { if (hasNext) { e.preventDefault(); onNextChapter(); } }
      else if (e.key === 'p' || (e.key === 'ArrowLeft'  && e.ctrlKey)) { if (hasPrev) { e.preventDefault(); onPrevChapter(); } }
      // Zoom
      else if ((e.key === '+' || e.key === '=') && !e.ctrlKey) { setZoom(z => Math.min(3, parseFloat((z + 0.25).toFixed(2)))); }
      else if (e.key === '-' && !e.ctrlKey) { setZoom(z => Math.max(0.5, parseFloat((z - 0.25).toFixed(2)))); }
      else if (e.key === '0') { setZoom(1); }
      // Mode toggle: m cycles scroll → paged → webtoon
      else if (e.key === 'm') { setMode(m => ({ scroll:'paged', paged:'webtoon', webtoon:'scroll' }[m] || 'scroll')); }
      // Fullscreen
      else if (e.key === 'f') { if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{}); else document.exitFullscreen().catch(()=>{}); }
      // Back
      else if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); onBack(); }
      // Show controls on any keypress
      showControlsTemp();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [mode, changePage, onBack, onNextChapter, onPrevChapter, hasNext, hasPrev, pages.length, onPageChange, showControlsTemp]);

  useEffect(() => {
    if (mode === 'paged') return;
    const observer = new IntersectionObserver((entries) => {
      let best = null, bestRatio = 0;
      entries.forEach(e => {
        if (e.intersectionRatio > bestRatio) { bestRatio = e.intersectionRatio; best = e; }
      });
      if (best) {
        const idx = parseInt(best.target.dataset.page, 10);
        if (!isNaN(idx)) {
          setCurrentPage(idx);
          onPageChange?.(idx);
          updateProgress?.(mangaId, currentChapter?.id, currentChapter?.number, idx);
        }
      }
    }, { threshold: 0.5, rootMargin: '-10% 0px' });

    const els = document.querySelectorAll('[data-page]');
    els.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [mode, pages.length, mangaId, currentChapter, onPageChange, updateProgress]);

  useEffect(() => () => clearTimeout(controlsTimer.current), []);

  const handleTap = useCallback((e) => {
    if (mode !== 'paged') { showControlsTemp(); return; }
    // Only navigate when not zoomed in (zoomed = user is probably scrolling/panning)
    if (zoom > 1.05) { showControlsTemp(); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const w = rect.width;
    if (x < w * 0.25) changePage(-1);
    else if (x > w * 0.75) changePage(1);
    else showControlsTemp();
  }, [mode, changePage, showControlsTemp, zoom]);

  if (pages.length === 0) {
    return (
      <div style={{ position:'fixed', inset:0, background:themeStyles.bg, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:20 }}>
        <Spin size={48}/>
        <p style={{ color:'var(--muted)', fontSize:13, textTransform:'uppercase', letterSpacing:'0.1em' }}>Loading chapter...</p>
      </div>
    );
  }

  const isWebtoon = mode === 'webtoon';

  // ── Image styles — direct sizing, no transform = no overlap ──
  const getScrollImageStyle = (isWt, fm, zm) => {
    const base = { display: 'block', userSelect: 'none', draggable: 'false' };
    if (isWt) {
      // Webtoon: width scales with zoom, centered strip
      return { ...base, width: `${zm * 100}%`, maxWidth: `${900 * zm}px`, margin: '0 auto' };
    }
    switch (fm) {
      case 'width':
        return { ...base, width: `${zm * 100}vw`, height: 'auto' };
      case 'original':
        return { ...base, width: 'auto', height: 'auto', transform: zm !== 1 ? `scale(${zm})` : 'none', transformOrigin: 'top center' };
      default: // height
        return { ...base, height: `${zm * 90}vh`, width: 'auto', maxWidth: '100%' };
    }
  };

  return (
    <div style={{ position:'fixed', inset:0, background:themeStyles.bg, overflow:'hidden', filter:`brightness(${brightness}%)` }}>

      {/* TOP BAR */}
      <div style={{ position:'fixed', top:0, left:0, right:0, zIndex:100, padding:'12px 20px', background:'rgba(0,0,0,0.9)', backdropFilter:'blur(16px)', borderBottom:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between', transform:showControls?'translateY(0)':'translateY(-100%)', transition:'transform var(--transition-base)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <Btn variant="ghost" size="icon" onClick={onBack}><ChevronLeft size={20}/></Btn>
          <div>
            <p style={{ fontSize:13, fontWeight:600, maxWidth:'35vw', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{mangaTitle}</p>
            <p style={{ fontSize:11, color:'var(--muted)' }}>Ch. {currentChapter?.number}{currentChapter?.title&&` — ${currentChapter.title}`} • Page {currentPage+1}/{pages.length}</p>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <select value={mode} onChange={e => setMode(e.target.value)} style={{ background:'rgba(255,255,255,0.08)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 12px', borderRadius:10, fontSize:12, cursor:'pointer', outline:'none' }}>
            <option value="scroll">Scroll</option>
            <option value="paged">Paged</option>
            <option value="webtoon">Webtoon</option>
          </select>
          <Btn variant="ghost" size="icon" onClick={() => setShowControls(s => !s)}><EyeOff size={16}/></Btn>
        </div>
      </div>

      {/* BOTTOM BAR */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:100, padding:'14px 20px', background:'rgba(0,0,0,0.9)', backdropFilter:'blur(16px)', borderTop:'1px solid rgba(255,255,255,0.08)', transform:showControls?'translateY(0)':'translateY(100%)', transition:'transform var(--transition-base)' }}>
        {mode === 'paged' && (
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
            <span style={{ fontSize:12, color:'var(--muted)', minWidth:24, textAlign:'center' }}>{currentPage+1}</span>
            <input type="range" min={0} max={pages.length-1} value={currentPage} onChange={e => { const p=parseInt(e.target.value); setCurrentPage(p); onPageChange?.(p); updateProgress?.(mangaId, currentChapter?.id, currentChapter?.number, p); }} style={{ flex:1 }}/>
            <span style={{ fontSize:12, color:'var(--muted)', minWidth:24, textAlign:'right' }}>{pages.length}</span>
          </div>
        )}

        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:20, flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Sun size={14} style={{ color:'var(--muted)' }}/>
            <input type="range" min="40" max="150" value={brightness} onChange={e => setBrightness(Number(e.target.value))} style={{ width:90 }}/>
            <span style={{ fontSize:11, color:'var(--muted)', minWidth:32 }}>{brightness}%</span>
          </div>

          {/* Zoom — works for all modes */}
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <ZoomOut size={14} style={{ color:'var(--muted)', cursor:'pointer' }} onClick={() => setZoom(z => Math.max(0.5, parseFloat((z - 0.1).toFixed(2))))}/>
            <input type="range" min="0.5" max="3" step="0.05" value={zoom} onChange={e => setZoom(parseFloat(e.target.value))} style={{ width:90 }}/>
            <span style={{ fontSize:11, color:'var(--muted)', minWidth:36 }}>{Math.round(zoom*100)}%</span>
            <ZoomIn size={14} style={{ color:'var(--muted)', cursor:'pointer' }} onClick={() => setZoom(z => Math.min(3, parseFloat((z + 0.1).toFixed(2))))}/>
          </div>

          {mode !== 'webtoon' && (
            <div style={{ display:'flex', gap:4, background:'rgba(255,255,255,0.05)', padding:4, borderRadius:8 }}>
              {['height','width','original'].map(m => (
                <button key={m} onClick={() => setFitMode(m)} style={{ padding:'5px 10px', borderRadius:5, border:'none', background:fitMode===m?'var(--accent)':'transparent', color:fitMode===m?'#fff':'var(--muted)', fontSize:11, fontWeight:600, cursor:'pointer', textTransform:'uppercase', letterSpacing:'0.04em' }}>
                  {m==='height'?'Fit H':m==='width'?'Fit W':'1:1'}
                </button>
              ))}
            </div>
          )}

          <div style={{ display:'flex', gap:4 }}>
            {Object.entries(THEMES).map(([key, t]) => (
              <button key={key} onClick={() => setTheme(key)} title={key} style={{ width:24, height:24, borderRadius:5, background:t.bg, border:`2px solid ${theme===key?t.accent:'transparent'}`, cursor:'pointer', boxShadow:theme===key?`0 0 8px ${t.accent}40`:'' }}/>
            ))}
          </div>

          <div style={{ display:'flex', gap:8 }}>
            <Btn variant="outline" size="sm" onClick={onPrevChapter} disabled={!hasPrev}><SkipBack size={14}/> Prev</Btn>
            <Btn variant="outline" size="sm" onClick={onNextChapter} disabled={!hasNext}>Next <SkipForward size={14}/></Btn>
          </div>
        </div>
      </div>

      {/* ═══ PAGED MODE — scrollable when zoomed ═══ */}
      {mode === 'paged' ? (
        <div
          onClick={handleTap}
          onTouchStart={e => setTouchStart(e.touches[0].clientX)}
          onTouchEnd={e => {
            if (touchStart != null && zoom <= 1.05) {
              const d = touchStart - e.changedTouches[0].clientX;
              if (Math.abs(d) > 50) changePage(d > 0 ? 1 : -1);
            }
            setTouchStart(null);
          }}
          style={{
            height: '100vh',
            width: '100vw',
            overflow: zoom > 1.05 ? 'auto' : 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: zoom > 1.05 ? 'grab' : 'pointer',
          }}
        >
          {/* Inner wrapper ensures image stays centered AND scrollable when zoomed */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: zoom > 1.05 ? `${zoom * 100}vw` : '100vw',
            minHeight: zoom > 1.05 ? `${zoom * 100}vh` : '100vh',
            padding: showControls ? '56px 0 80px' : '0',
          }}>
            <img
              key={`paged-${currentPage}`}
              src={proxyImg(pages[currentPage])}
              style={{
                display: 'block',
                userSelect: 'none',
                flexShrink: 0,
                // Fit modes at normal zoom
                ...(zoom <= 1 ? {
                  maxWidth: '100vw',
                  maxHeight: showControls ? 'calc(100vh - 136px)' : '100vh',
                  width: fitMode === 'width' ? '100vw' : 'auto',
                  height: fitMode === 'height' ? (showControls ? 'calc(100vh - 136px)' : '100vh') : 'auto',
                  objectFit: 'contain',
                } : {
                  // Zoomed: scale beyond viewport, scrollable
                  maxWidth: 'none',
                  maxHeight: 'none',
                  width: fitMode === 'width' ? `${zoom * 100}vw` : 'auto',
                  height: fitMode === 'height' ? `${zoom * 100}vh` : fitMode === 'original' ? 'auto' : `${zoom * 100}vh`,
                  transform: fitMode === 'original' ? `scale(${zoom})` : 'none',
                  transformOrigin: 'center center',
                })
              }}
              alt={`Page ${currentPage+1}`}
              draggable={false}
            />
          </div>
          {showControls && zoom <= 1.05 && (
            <>
              <div style={{ position:'absolute', left:0, top:'50%', transform:'translateY(-50%)', padding:'20px 12px', background:'rgba(0,0,0,0.3)', borderRadius:'0 8px 8px 0', opacity:hasPrev||currentPage>0?0.6:0.2, pointerEvents:'none' }}><ChevronLeft size={20} style={{ color:'#fff' }}/></div>
              <div style={{ position:'absolute', right:0, top:'50%', transform:'translateY(-50%)', padding:'20px 12px', background:'rgba(0,0,0,0.3)', borderRadius:'8px 0 0 8px', opacity:currentPage<pages.length-1?0.6:0.2, pointerEvents:'none' }}><ChevronRight size={20} style={{ color:'#fff' }}/></div>
            </>
          )}
        </div>
      ) : (
        // ═══ SCROLL / WEBTOON MODE ═══
        <div
          ref={containerRef}
          onClick={handleTap}
          onTouchStart={e => setTouchStart(e.touches[0].clientX)}
          onTouchEnd={e => { if(touchStart!=null){const d=touchStart-e.changedTouches[0].clientX; if(Math.abs(d)>60)changePage(d>0?1:-1);} setTouchStart(null); }}
          style={{
            height: '100vh',
            overflowY: 'auto',
            overflowX: isWebtoon ? 'hidden' : 'auto',
            paddingTop: showControls ? 56 : 0,
            paddingBottom: showControls ? 100 : 0,
            transition: 'padding 0.3s',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {pages.map((url, i) => (
            <div
              key={i}
              id={`reader-page-${i}`}
              data-page={i}
              style={{
                display: 'flex',
                justifyContent: 'center',
                width: '100%',
                // No transform wrapper — images sized directly to avoid overlap
                marginBottom: isWebtoon ? 0 : 8,
              }}
            >
              <img
                src={proxyImg(url)}
                style={getScrollImageStyle(isWebtoon, fitMode, zoom)}
                alt={`Page ${i+1}`}
                loading={i < 3 ? 'eager' : 'lazy'}
                draggable={false}
              />
            </div>
          ))}
          <div style={{ height: 120, flexShrink: 0 }}/>
        </div>
      )}

      {/* Page indicator (hidden controls) */}
      {!showControls && (
        <div style={{ position:'fixed', bottom:20, left:'50%', transform:'translateX(-50%)', background:'rgba(0,0,0,0.75)', padding:'8px 18px', borderRadius:20, fontSize:13, fontWeight:600, color:'#fff', pointerEvents:'none', backdropFilter:'blur(10px)', border:'1px solid rgba(255,255,255,0.1)' }}>
          {currentPage+1} / {pages.length}
        </div>
      )}
    </div>
  );
});

// ── Repo add row ────────────────────────────────────────────────────────────
const RepoAddRow = memo(({ onAdd }) => {
  const [val, setVal] = useState('');
  return (
    <div style={{ display:'flex', gap:10 }}>
      <div style={{ position:'relative', flex:1 }}>
        <Globe size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--muted)', pointerEvents:'none' }}/>
        <input
          placeholder="https://raw.githubusercontent.com/.../index.min.json"
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && val.trim()) { onAdd(val.trim()); setVal(''); } }}
          style={{ width:'100%', background:'var(--card)', border:'1.5px solid var(--border)', borderRadius:12, padding:'11px 14px 11px 36px', color:'var(--text)', fontSize:12, outline:'none', fontFamily:'monospace', transition:'border-color 0.2s' }}
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
  const { settings, updateSetting, backendOnline, checkHealth, library, history, progress, readingTime, sources, extensions, fetchSources, fetchExtensions } = useData();
  const toast = useToast();
  const [confirmClear, setConfirmClear] = useState(null);

  // Sync Electron settings on mount
  const [serviceStatus, setServiceStatus]   = useState(null); // null | 'running' | 'stopped'
  const [serviceWorking, setServiceWorking] = useState(false);

  useEffect(() => {
    window.electronAPI?.getCloseToTray?.().then(val => {
      if (val !== undefined) updateSetting('closeToTray', val);
    }).catch(() => {});
    window.electronAPI?.getStartWithWindows?.().then(val => {
      if (val !== undefined) updateSetting('startWithWindows', val);
    }).catch(() => {});
    if (window.electronAPI?.checkService) {
      window.electronAPI.checkService().then(running => setServiceStatus(running ? 'running' : 'stopped')).catch(() => setServiceStatus('stopped'));
    }
  }, []);

  const totalReadingMins = Object.values(readingTime).reduce((a, b) => a + b, 0);
  const totalChapters = Object.values(progress).reduce((a, p) => a + (parseInt(p.chapterNum) || 0), 0);

  const Section = ({ title, children }) => (
    <div style={{ marginBottom:32 }}>
      <h3 style={{ fontFamily:"'Segoe UI Variable Display','Segoe UI Variable','Segoe UI',system-ui,-apple-system,sans-serif", fontWeight:700, fontSize:16, color:'var(--text)', marginBottom:16, paddingBottom:10, borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8 }}>
        {title}
      </h3>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {children}
      </div>
    </div>
  );

  const Row = ({ label, sub, children }) => (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', background:'var(--card)', borderRadius:12, border:'1px solid var(--border)', gap:16 }}>
      <div>
        <p style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>{label}</p>
        {sub && <p style={{ fontSize:12, color:'var(--muted)', marginTop:3 }}>{sub}</p>}
      </div>
      <div style={{ flexShrink:0 }}>
        {children}
      </div>
    </div>
  );

  const Toggle = ({ value, onChange }) => (
    <button onClick={() => onChange(!value)} style={{ width:48, height:26, borderRadius:13, background:value?'var(--accent)':'rgba(255,255,255,0.12)', border:'none', cursor:'pointer', position:'relative', transition:'background 0.3s' }}>
      <div style={{ position:'absolute', top:3, left:value?22:3, width:20, height:20, borderRadius:'50%', background:'#fff', transition:'left 0.3s', boxShadow:'0 2px 6px rgba(0,0,0,0.3)' }}/>
    </button>
  );

  return (
    <div className="page-transition" style={{ maxWidth:720, margin:'0 auto', padding:'0 0 60px' }}>

      <Section title="📊 Reading Statistics">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:12 }}>
          {[
            { label:'Library', value:library.length, icon:'📚' },
            { label:'History', value:history.length, icon:'🕐' },
            { label:'Chapters Read', value:totalChapters, icon:'📖' },
            { label:'Reading Time', value:`${Math.floor(totalReadingMins/3600)}h ${Math.floor((totalReadingMins%3600)/60)}m`, icon:'⏱' },
            { label:'Sources', value:Object.keys(sources).length, icon:'🌐' },
            { label:'Extensions', value:extensions.filter(e=>e.isInstalled).length, icon:'🧩' },
          ].map(s => (
            <div key={s.label} style={{ padding:'18px 16px', background:'var(--card)', borderRadius:14, border:'1px solid var(--border)', textAlign:'center' }}>
              <div style={{ fontSize:28, marginBottom:8 }}>{s.icon}</div>
              <p style={{ fontFamily:"'Segoe UI Variable Display','Segoe UI Variable','Segoe UI',system-ui,-apple-system,sans-serif", fontWeight:800, fontSize:22, color:'var(--text)' }}>{s.value}</p>
              <p style={{ fontSize:11, color:'var(--muted)', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.04em' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="📖 Reader Defaults">
        <Row label="Default Mode" sub="Mode used when opening a chapter">
          <select value={settings?.readerMode||'scroll'} onChange={e => updateSetting('readerMode', e.target.value)} style={{ background:'var(--card2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 14px', borderRadius:8, fontSize:13, cursor:'pointer', outline:'none' }}>
            <option value="scroll">Scroll</option>
            <option value="paged">Paged</option>
            <option value="webtoon">Webtoon</option>
          </select>
        </Row>
        <Row label="Default Fit Mode" sub="How images are sized in paged mode">
          <select value={settings?.fitMode||'height'} onChange={e => updateSetting('fitMode', e.target.value)} style={{ background:'var(--card2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 14px', borderRadius:8, fontSize:13, cursor:'pointer', outline:'none' }}>
            <option value="height">Fit Height</option>
            <option value="width">Fit Width</option>
            <option value="original">Original Size</option>
          </select>
        </Row>
        <Row label="Default Brightness" sub={`Currently: ${settings?.brightness||100}%`}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <input type="range" min="40" max="150" value={settings?.brightness||100} onChange={e => updateSetting('brightness', Number(e.target.value))} style={{ width:120 }}/>
            <span style={{ fontSize:12, color:'var(--muted)', minWidth:36 }}>{settings?.brightness||100}%</span>
          </div>
        </Row>
        <Row label="Reader Theme" sub="Background color while reading">
          <div style={{ display:'flex', gap:8 }}>
            {Object.entries(THEMES).map(([key, t]) => (
              <button key={key} onClick={() => updateSetting('readerTheme', key)} title={key} style={{ width:32, height:32, borderRadius:8, background:t.bg, border:`2px solid ${(settings?.readerTheme||'dark')===key?t.accent:'rgba(255,255,255,0.15)'}`, cursor:'pointer' }}/>
            ))}
          </div>
        </Row>
      </Section>

      <Section title="🖼 Display">
        <Row label="App Theme" sub="Switch between light and dark interface">
          <div style={{ display:'flex', gap:6 }}>
            {[['dark','🌙 Dark'],['light','☀️ Light']].map(([v,l]) => (
              <button key={v} onClick={() => updateSetting('appTheme', v)} style={{ padding:'8px 16px', borderRadius:10, border:`1.5px solid ${(settings?.appTheme||'dark')===v?'var(--accent)':'var(--border)'}`, background:(settings?.appTheme||'dark')===v?'rgba(249,115,22,0.12)':'transparent', color:(settings?.appTheme||'dark')===v?'var(--accent)':'var(--muted)', fontSize:13, fontWeight:700, cursor:'pointer', transition:'all 0.2s' }}>{l}</button>
            ))}
          </div>
        </Row>
        <Row label="Library View" sub="Default layout for your library">
          <div style={{ display:'flex', gap:6 }}>
            {[['grid','Grid'],['list','List'],['compact','Compact']].map(([v,l]) => (
              <button key={v} onClick={() => updateSetting('libraryView', v)} style={{ padding:'7px 14px', borderRadius:8, border:'none', background:(settings?.libraryView||'grid')===v?'var(--accent)':'rgba(255,255,255,0.08)', color:(settings?.libraryView||'grid')===v?'#fff':'var(--muted)', fontSize:12, fontWeight:600, cursor:'pointer' }}>{l}</button>
            ))}
          </div>
        </Row>
        <Row label="Sidebar Collapsed" sub="Start with sidebar minimized">
          <Toggle value={settings?.sidebarCollapsed||false} onChange={v => updateSetting('sidebarCollapsed', v)}/>
        </Row>
      </Section>

      <Section title="🔌 Connection">
        <Row label="Backend Status" sub={`API: ${CONFIG.API}`}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:backendOnline===true?'#22c55e':backendOnline===false?'#ef4444':'#f59e0b', boxShadow:`0 0 10px ${backendOnline===true?'#22c55e':backendOnline===false?'#ef4444':'#f59e0b'}` }}/>
              <span style={{ fontSize:13, fontWeight:600, color:backendOnline===true?'#4ade80':backendOnline===false?'#f87171':'#facc15' }}>{backendOnline===true?'Online':backendOnline===false?'Offline':'Checking...'}</span>
            </div>
            <Btn variant="outline" size="sm" onClick={() => { checkHealth(); fetchSources(); fetchExtensions(); toast('Refreshing...', 'info'); }}><RefreshCw size={14}/> Refresh</Btn>
          </div>
        </Row>
      </Section>

      <Section title="⚠️ Data Management">
        <Row label="Clear Reading History" sub={`${history.length} entries`}>
          <Btn variant="danger" size="sm" onClick={() => setConfirmClear('history')}><Trash2 size={14}/> Clear</Btn>
        </Row>
        <Row label="Clear Progress" sub={`${Object.keys(progress).length} tracked manga`}>
          <Btn variant="danger" size="sm" onClick={() => setConfirmClear('progress')}><Trash2 size={14}/> Clear</Btn>
        </Row>
        <Row label="Clear Reading Time" sub="Reset all tracked reading time">
          <Btn variant="danger" size="sm" onClick={() => setConfirmClear('readingTime')}><Trash2 size={14}/> Clear</Btn>
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
              <ExternalLink size={14}/> Open Folder
            </Btn>
          </Row>
        )}
      </Section>

      {(window.electronAPI?.installService || window.electronAPI?.checkService) && (
        <Section title="⚙️ Windows Service">
          <div style={{ padding:'12px 16px', background:'rgba(59,130,246,0.06)', borderRadius:12, border:'1px solid rgba(59,130,246,0.15)', fontSize:13, color:'var(--muted)', lineHeight:1.7, marginBottom:4 }}>
            Run the Suwayomi backend as a Windows service so it starts automatically and runs without a visible window.
          </div>
          <Row label="Service Status" sub="Current state of the Suwayomi Windows service">
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:serviceStatus==='running'?'#22c55e':serviceStatus==='stopped'?'#f87171':'#f59e0b', boxShadow:`0 0 8px ${serviceStatus==='running'?'#22c55e':serviceStatus==='stopped'?'#f87171':'#f59e0b'}` }}/>
                <span style={{ fontSize:13, fontWeight:600, color:serviceStatus==='running'?'#4ade80':serviceStatus==='stopped'?'#f87171':'#facc15' }}>
                  {serviceStatus==='running'?'Running':serviceStatus==='stopped'?'Not installed':serviceWorking?'Working…':'Checking…'}
                </span>
              </div>
              <Btn variant="outline" size="sm" disabled={serviceWorking} onClick={async () => {
                setServiceWorking(true);
                try { const r = await window.electronAPI.checkService(); setServiceStatus(r ? 'running' : 'stopped'); }
                catch { setServiceStatus('stopped'); }
                finally { setServiceWorking(false); }
              }}><RefreshCw size={13}/> Check</Btn>
            </div>
          </Row>
          <Row label={serviceStatus==='running' ? 'Uninstall Service' : 'Install Service'} sub={serviceStatus==='running' ? 'Remove the Windows service (Suwayomi will only run while akaReader is open)' : 'Install as a Windows service for automatic background startup'}>
            {serviceStatus==='running' ? (
              <Btn variant="danger" size="sm" disabled={serviceWorking} onClick={async () => {
                setServiceWorking(true);
                try { await window.electronAPI.uninstallService(); setServiceStatus('stopped'); toast('Service uninstalled', 'warning'); }
                catch(e) { toast(`Failed: ${e.message}`, 'error'); }
                finally { setServiceWorking(false); }
              }}>
                {serviceWorking ? <><Spin size={13}/> Working…</> : <><Trash2 size={13}/> Uninstall</>}
              </Btn>
            ) : (
              <Btn size="sm" disabled={serviceWorking} onClick={async () => {
                setServiceWorking(true);
                try { await window.electronAPI.installService(); setServiceStatus('running'); toast('Service installed and started', 'success'); }
                catch(e) { toast(`Failed: ${e.message}`, 'error'); }
                finally { setServiceWorking(false); }
              }}>
                {serviceWorking ? <><Spin size={13}/> Working…</> : 'Install Service'}
              </Btn>
            )}
          </Row>
        </Section>
      )}

      <Section title="📦 Extension Repositories">
        <div style={{ padding:'12px 16px', background:'rgba(249,115,22,0.06)', borderRadius:12, border:'1px solid rgba(249,115,22,0.15)', fontSize:13, color:'var(--muted)', lineHeight:1.7, marginBottom:4 }}>
          Add custom extension repo URLs. Paste the raw <code style={{ background:'var(--card2)', padding:'1px 6px', borderRadius:4, fontSize:11 }}>index.min.json</code> URL from GitHub or any compatible source.
        </div>
        {(settings?.repos || []).map((repo, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', background:'var(--card)', borderRadius:12, border:'1px solid var(--border)' }}>
            <Globe size={14} style={{ color:'var(--accent)', flexShrink:0 }}/>
            <span style={{ flex:1, fontSize:12, color:'var(--text-dim)', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{repo}</span>
            <Btn variant="danger" size="sm" onClick={() => {
              const updated = (settings?.repos || []).filter((_, ri) => ri !== i);
              updateSetting('repos', updated);
              toast('Repository removed', 'warning');
            }}><X size={12}/></Btn>
          </div>
        ))}
        {(settings?.repos || []).length === 0 && (
          <div style={{ padding:'20px', textAlign:'center', color:'var(--muted)', fontSize:13, background:'var(--card)', borderRadius:12, border:'1px solid var(--border)' }}>
            No custom repositories added
          </div>
        )}
        <RepoAddRow onAdd={(url) => {
          const existing = settings?.repos || [];
          if (existing.includes(url)) { toast('Already added', 'warning'); return; }
          updateSetting('repos', [...existing, url]);
          toast('Repository added — restart extensions to apply', 'success');
        }}/>
      </Section>

      <Section title="☕ Support Development">
        <div style={{ padding:'20px', background:'var(--card)', borderRadius:14, border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
          <div>
            <p style={{ fontWeight:700, fontSize:14, color:'var(--text)', marginBottom:4 }}>Enjoying akaReader?</p>
            <p style={{ fontSize:12, color:'var(--muted)', lineHeight:1.6 }}>If this app saves you time or brings you joy,<br/>a coffee would be greatly appreciated!</p>
          </div>
          <a href="https://ko-fi.com" target="_blank" rel="noreferrer" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'10px 22px', borderRadius:12, background:'linear-gradient(135deg,#ff5e5b,#ff8c42)', color:'#fff', fontWeight:700, fontSize:13, textDecoration:'none', boxShadow:'0 4px 16px rgba(255,94,91,0.3)', flexShrink:0 }}>
            <Coffee size={16}/> Buy me a coffee
          </a>
        </div>
      </Section>

      {confirmClear && (
        <div className="anim-fadeIn" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(8px)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:20, padding:32, maxWidth:380, width:'90%', textAlign:'center' }}>
            <AlertTriangle size={40} style={{ color:'#facc15', marginBottom:16 }}/>
            <h3 style={{ fontFamily:"'Segoe UI Variable Display','Segoe UI Variable','Segoe UI',system-ui,-apple-system,sans-serif", fontWeight:700, fontSize:18, marginBottom:8 }}>Are you sure?</h3>
            <p style={{ color:'var(--muted)', fontSize:14, marginBottom:24 }}>This will permanently delete your {confirmClear}. This cannot be undone.</p>
            <div style={{ display:'flex', gap:12, justifyContent:'center' }}>
              <Btn variant="outline" onClick={() => setConfirmClear(null)}>Cancel</Btn>
              <Btn variant="danger" onClick={() => {
                if (confirmClear === 'history') { storage.set('history', []); window.location.reload(); }
                else if (confirmClear === 'progress') { storage.set('progress', {}); window.location.reload(); }
                else if (confirmClear === 'readingTime') { storage.set('readingTime', {}); window.location.reload(); }
                setConfirmClear(null);
                toast('Cleared successfully', 'success');
              }}>
                <Trash2 size={14}/> Confirm Delete
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
    srcList.forEach(s => { init[s.id] = { loading: true, results: [], error: null }; });
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
    <div className="anim-fadeIn" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', backdropFilter:'blur(12px)', zIndex:500, display:'flex', flexDirection:'column', alignItems:'center', paddingTop:60 }}>
      <div style={{ width:'min(700px,95vw)', position:'relative', marginBottom:24 }}>
        <Search size={20} style={{ position:'absolute', left:20, top:'50%', transform:'translateY(-50%)', color:'var(--muted)', pointerEvents:'none' }}/>
        <input
          ref={inputRef}
          placeholder="Search across all installed sources..."
          value={query}
          onChange={e => { setQuery(e.target.value); dSearch(e.target.value); }}
          onKeyDown={e => { if(e.key==='Enter') doSearch(query); if(e.key==='Escape') onClose(); }}
          style={{ width:'100%', background:'rgba(22,22,31,0.98)', border:'2px solid var(--accent)', borderRadius:16, padding:'16px 50px 16px 52px', color:'var(--text)', fontSize:16, outline:'none', fontFamily:'system-ui,-apple-system,Segoe UI,sans-serif', boxShadow:'0 8px 40px rgba(249,115,22,0.2)' }}
        />
        <Btn variant="ghost" size="icon" onClick={onClose} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)' }}>
          <X size={18}/>
        </Btn>
      </div>

      <div style={{ width:'min(700px,95vw)', flex:1, overflowY:'auto', paddingBottom:40 }}>
        {!hasSearched && (
          <div style={{ textAlign:'center', color:'var(--muted)', marginTop:40 }}>
            <Search size={48} style={{ opacity:0.2, marginBottom:16 }}/>
            <p style={{ fontSize:16, fontWeight:500 }}>Search across {Object.keys(sources).length} sources simultaneously</p>
            <p style={{ fontSize:13, marginTop:8 }}>Type to start searching</p>
            {searchHistory.length > 0 && (
              <div style={{ marginTop:28, textAlign:'left' }}>
                <p style={{ fontSize:12, color:'var(--muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>Recent searches</p>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {searchHistory.map((h, i) => (
                    <button key={i} onClick={() => { setQuery(h); doSearch(h); }} style={{ padding:'6px 14px', borderRadius:20, background:'var(--card)', border:'1px solid var(--border)', color:'var(--text-dim)', fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:6, transition:'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.color='var(--text)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--text-dim)'; }}
                    >
                      <Clock size={12}/>{h}
                    </button>
                  ))}
                  <button onClick={() => { setSearchHistory([]); storage.set('searchHistory', []); }} style={{ padding:'6px 10px', borderRadius:20, background:'transparent', border:'1px solid rgba(239,68,68,0.2)', color:'#f87171', fontSize:12, cursor:'pointer' }}>Clear</button>
                </div>
              </div>
            )}
          </div>
        )}

        {hasSearched && (
          <>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <p style={{ fontSize:13, color:'var(--muted)' }}>
                {anyLoading ? `Searching ${Object.keys(results).length} sources...` : `${totalResults} results across ${Object.keys(results).length} sources`}
              </p>
              {anyLoading && <Spin size={18}/>}
            </div>

            {Object.entries(results).map(([srcId, r]) => {
              if (r.results.length === 0 && !r.loading) return null;
              return (
                <div key={srcId} style={{ marginBottom:24 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                    <p style={{ fontSize:13, fontWeight:700, color:'var(--accent)' }}>{r.sourceName || srcId}</p>
                    {r.loading && <Spin size={14}/>}
                    {!r.loading && <Badge variant="outline" size="sm">{r.results.length}</Badge>}
                    {r.error && <Badge variant="destructive" size="sm">Error</Badge>}
                  </div>
                  {r.results.length > 0 && (
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))', gap:14 }}>
                      {r.results.slice(0,8).map((m, i) => (
                        <MangaCard key={m.id} manga={{ ...m, sourceId: srcId }} onClick={manga => { onSelectManga(manga, srcId); onClose(); }} index={i}/>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {!anyLoading && totalResults === 0 && (
              <EmptyState icon={Search} title="No results found" sub={`"${query}" didn't match anything across your installed sources`} compact/>
            )}
          </>
        )}
      </div>
    </div>
  );
});

// ==================== UPDATES TAB ====================

const UpdatesTab = memo(({ onOpenManga }) => {
  const { updates, checkingUpdates, checkForUpdates } = useData();

  return (
    <div className="page-transition">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h2 style={{ fontSize:18, fontWeight:600 }}>Manga with New Chapters</h2>
        <Btn variant="outline" size="sm" onClick={checkForUpdates} disabled={checkingUpdates}>
          <RefreshCw size={14} className={checkingUpdates ? 'anim-spin' : ''} style={{ marginRight:6 }}/>
          {checkingUpdates ? 'Checking...' : 'Check Now'}
        </Btn>
      </div>

      {updates.length === 0 ? (
        <EmptyState icon={BellRing} title="No updates" sub="All your manga are up to date" compact/>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:18 }}>
          {updates.map((manga, i) => (
            <div key={manga.id} style={{ position:'relative' }}>
              <MangaCard manga={manga} onClick={onOpenManga || (() => {})} index={i} badge={`+${manga.newChapters}`}/>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

// ==================== DOWNLOADS TAB ====================

const DownloadsTab = memo(({ queue, onClear, onRemove, onRetry, onCancel, onCancelAll }) => {
  const pending    = queue.filter(d => d.status === 'pending').length;
  const active     = queue.filter(d => d.status === 'downloading').length;
  const done       = queue.filter(d => d.status === 'done').length;
  const errors     = queue.filter(d => d.status === 'error').length;
  const cancelled  = queue.filter(d => d.status === 'cancelled').length;
  const inProgress = pending + active;

  const statusColor = { pending:'#94a3b8', downloading:'var(--accent)', done:'#4ade80', error:'#f87171', cancelled:'#64748b' };
  const statusLabel = { pending:'Queued', downloading:'Downloading…', done:'Complete', error:'Failed', cancelled:'Cancelled' };

  return (
    <div className="page-transition">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <h2 style={{ fontSize:18, fontWeight:600, marginBottom:6 }}>Downloads</h2>
          <div style={{ display:'flex', gap:16 }}>
            {active > 0  && <span style={{ fontSize:12, color:'var(--accent)', fontWeight:600 }}>{active} active</span>}
            {pending > 0 && <span style={{ fontSize:12, color:'var(--muted-fg)' }}>{pending} queued</span>}
            {done > 0    && <span style={{ fontSize:12, color:'#4ade80' }}>{done} done</span>}
            {errors > 0  && <span style={{ fontSize:12, color:'#f87171' }}>{errors} failed</span>}
            {cancelled > 0 && <span style={{ fontSize:12, color:'var(--muted)' }}>{cancelled} cancelled</span>}
          </div>
        </div>
        {queue.length > 0 && (
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {inProgress > 0 && <Btn variant="outline" size="sm" onClick={onCancelAll}><X size={13}/> Cancel All</Btn>}
            {errors > 0 && <Btn variant="outline" size="sm" onClick={() => queue.filter(d=>d.status==='error').forEach(d=>onRetry(d.id))}><RefreshCw size={13}/> Retry Failed</Btn>}
            <Btn variant="danger" size="sm" onClick={onClear}><Trash2 size={13}/> Clear Finished</Btn>
          </div>
        )}
      </div>

      {queue.length === 0 ? (
        <EmptyState icon={Download} title="No downloads" sub="Queue chapters from the manga detail page — right-click a chapter or use the buttons above the chapter list" compact/>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {queue.map((item) => {
            const isCancellable = item.status === 'pending' || item.status === 'downloading';
            const borderCol = item.status === 'error' ? 'rgba(239,68,68,0.25)' : item.status === 'done' ? 'rgba(34,197,94,0.2)' : item.status === 'downloading' ? 'rgba(249,115,22,0.3)' : item.status === 'cancelled' ? 'rgba(100,116,139,0.2)' : 'var(--border)';
            return (
              <div key={item.id} className="dl-item" style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px', borderRadius:14, background:'var(--card)', border:`1.5px solid ${borderCol}`, transition:'border-color 0.3s, opacity 0.3s', opacity: item.status === 'cancelled' ? 0.55 : 1, animationDelay: `${Math.min(queue.indexOf(item),10) * 35}ms` }}>
                <div style={{ width:40, height:40, borderRadius:10, background:'var(--card2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  {item.status === 'downloading' ? <Spin size={18}/> :
                   item.status === 'done'        ? <Check size={18} style={{ color:'#4ade80' }}/> :
                   item.status === 'error'       ? <AlertTriangle size={18} style={{ color:'#f87171' }}/> :
                   item.status === 'cancelled'   ? <X size={18} style={{ color:'var(--muted)' }}/> :
                                                   <Download size={18} style={{ color:'var(--muted)' }}/>}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontWeight:600, fontSize:13, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:4 }}>
                    {item.mangaTitle} — Ch. {item.chapterNum}
                  </p>
                  {item.status === 'downloading' ? (
                    <div>
                        <div style={{ height:4, background:'rgba(255,255,255,0.08)', borderRadius:2, overflow:'hidden', marginBottom:4 }}>
                        <div className="dl-bar-active" style={{ width:`${item.progress}%`, height:'100%', background:'linear-gradient(90deg,var(--accent),#fb923c)', transition:'width 0.4s cubic-bezier(0.16,1,0.3,1)', borderRadius:2 }}/>
                      </div>
                      <span style={{ fontSize:11, color:'var(--accent)', fontWeight:600 }}>{item.progress}% · {item.pagesLoaded}/{item.pagesTotal} pages</span>
                    </div>
                  ) : (
                    <span style={{ fontSize:11, color:statusColor[item.status] || '#94a3b8', fontWeight:600 }}>
                      {item.status === 'error' ? `Error: ${item.error}` : statusLabel[item.status] || item.status}
                    </span>
                  )}
                </div>
                <div style={{ display:'flex', gap:4 }}>
                  {isCancellable && <Btn variant="ghost" size="icon" onClick={() => onCancel(item.id)} title="Cancel" style={{ color:'var(--muted)' }}><X size={14}/></Btn>}
                  {item.status === 'error' && <Btn variant="ghost" size="icon" onClick={() => onRetry(item.id)} title="Retry"><RefreshCw size={14}/></Btn>}
                  {(item.status === 'done' || item.status === 'error' || item.status === 'cancelled') && <Btn variant="ghost" size="icon" onClick={() => onRemove(item.id)} title="Remove from list"><X size={14}/></Btn>}
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
  const [tagInput, setTagInput] = useState(filters.tags);

  // Sync local tagInput when filters reset externally
  useEffect(() => { setTagInput(filters.tags); }, [filters.tags]);

  const inputStyle = {
    background: 'var(--card)', border: '1.5px solid var(--border)',
    borderRadius: 10, padding: '9px 12px', color: 'var(--text)',
    fontSize: 12, outline: 'none', cursor: 'pointer',
    transition: 'border-color 0.2s',
  };

  return (
    <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', padding:'12px 16px', background:'var(--card)', borderRadius:14, border:'1.5px solid var(--border)', marginBottom:18 }}>
      {/* Tag filter */}
      <div style={{ position:'relative', flex:'1 1 180px', minWidth:140 }}>
        <Tag size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--muted)', pointerEvents:'none' }}/>
        <input
          placeholder="Tags (comma separated)..."
          value={tagInput}
          onChange={e => setTagInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onChange('tags', tagInput); }}
          onBlur={() => onChange('tags', tagInput)}
          style={{ ...inputStyle, paddingLeft:30, width:'100%' }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
        />
      </div>

      {/* Status */}
      <select
        value={filters.status}
        onChange={e => onChange('status', e.target.value)}
        style={{ ...inputStyle, minWidth:130 }}
      >
        {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      {/* Content type */}
      <select
        value={filters.contentType}
        onChange={e => onChange('contentType', e.target.value)}
        style={{ ...inputStyle, minWidth:130 }}
      >
        {CONTENT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      {/* Sort */}
      <select
        value={filters.sort}
        onChange={e => onChange('sort', e.target.value)}
        style={{ ...inputStyle, minWidth:140 }}
      >
        {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      {/* Clear */}
      {activeCount > 0 && (
        <Btn variant="ghost" size="sm" onClick={onClear} style={{ color:'var(--accent)', fontSize:12 }}>
          <X size={13}/> Clear ({activeCount})
        </Btn>
      )}
    </div>
  );
});

// ==================== DOWNLOADED CHAPTERS (IndexedDB) ====================

const DB_NAME = 'akareader-downloads';
const DB_VER  = 1;

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
    req.onerror   = e => reject(e.target.error);
  });
}

// Save array of { url, blob } for a chapter
async function saveChapterBlobs(mangaId, chapterId, urlsAndBlobs) {
  // Convert ALL blobs to base64 FIRST — async work must finish before the IDB
  // transaction opens, otherwise it auto-closes mid-await and throws.
  const pages = await Promise.all(urlsAndBlobs.map(({ blob }) =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload  = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.readAsDataURL(blob);
    })
  ));

  // Now open the transaction — no more async work inside it
  const db  = await openDB();
  const key = `${mangaId}__${chapterId}`;
  return new Promise((res, rej) => {
    const tx = db.transaction('chapters', 'readwrite');
    tx.oncomplete = res;
    tx.onerror    = () => rej(tx.error);
    tx.objectStore('chapters').put({ key, pages, savedAt: Date.now() });
  });
}

// Returns array of object-URLs if downloaded, null otherwise
async function loadChapterBlobs(mangaId, chapterId) {
  try {
    const db  = await openDB();
    const tx  = db.transaction('chapters', 'readonly');
    const st  = tx.objectStore('chapters');
    const key = `${mangaId}__${chapterId}`;
    return new Promise((res) => {
      const req = st.get(key);
      req.onsuccess = () => {
        if (!req.result) return res(null);
        // convert base64 back to object URLs
        const urls = req.result.pages.map(dataUrl => {
          const arr  = dataUrl.split(',');
          const mime = arr[0].match(/:(.*?);/)[1];
          const bstr = atob(arr[1]);
          const u8   = new Uint8Array(bstr.length);
          for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
          return URL.createObjectURL(new Blob([u8], { type: mime }));
        });
        res(urls);
      };
      req.onerror = () => res(null);
    });
  } catch { return null; }
}

async function deleteChapterBlobs(mangaId, chapterId) {
  try {
    const db = await openDB();
    const tx = db.transaction('chapters', 'readwrite');
    tx.objectStore('chapters').delete(`${mangaId}__${chapterId}`);
  } catch {}
}

async function listDownloadedKeys() {
  try {
    const db = await openDB();
    const tx = db.transaction('chapters', 'readonly');
    const st = tx.objectStore('chapters');
    return new Promise(res => {
      const req = st.getAllKeys();
      req.onsuccess = () => res(req.result || []);
      req.onerror   = () => res([]);
    });
  } catch { return []; }
}

// Hook — returns a Set of "mangaId__chapterId" keys that are downloaded
function useDownloads() {
  const [keys, setKeys] = useState(new Set());
  const refresh = useCallback(async () => {
    const all = await listDownloadedKeys();
    setKeys(new Set(all));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { downloadedKeys: keys, refreshDownloads: refresh };
}

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

// Builds an SVG path that fills the whole screen but cuts out a rounded rect
function buildSpotlightPath(vw, vh, r) {
  if (!r) return `M0 0 H${vw} V${vh} H0 Z`;
  const PAD = 12;
  const x = r.left - PAD, y = r.top - PAD;
  const w = r.width + PAD * 2, h = r.height + PAD * 2;
  const rad = 14;
  // Full screen rect, then cut out rounded rect (even-odd fill rule makes it a hole)
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
  const [step, setStep]           = useState(0);
  const [rect, setRect]           = useState(null);
  const [animKey, setAnimKey]     = useState(0);  // re-triggers card animation on step change
  const [vw, setVw]               = useState(window.innerWidth);
  const [vh, setVh]               = useState(window.innerHeight);

  const s     = ONBOARDING_STEPS[step];
  const total = ONBOARDING_STEPS.length;
  const PAD   = 12;

  // Update viewport size on resize
  useEffect(() => {
    const onResize = () => { setVw(window.innerWidth); setVh(window.innerHeight); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Measure target on step change
  useEffect(() => {
    const measure = () => setRect(getTargetRect(s.target));
    measure();
    // Retry once after a short delay in case sidebar is still animating
    const t = setTimeout(measure, 120);
    setAnimKey(k => k + 1);
    return () => clearTimeout(t);
  }, [step, s.target]);

  const goNext = () => step < total - 1 ? setStep(p => p + 1) : onFinish();
  const goPrev = () => step > 0 && setStep(p => p - 1);

  // Card position — right of spotlight, or centred if no target
  const cardStyle = useMemo(() => {
    const W = 330;
    if (!rect) return {
      top: '50%', left: '50%',
      transform: 'translate(-50%,-50%)',
    };
    const x = rect.left - PAD, y = rect.top - PAD;
    const w = rect.width + PAD * 2, h = rect.height + PAD * 2;
    const spaceRight = vw - (x + w) - 20;
    const spaceLeft  = x - 20;
    let left, top;
    top = Math.max(16, Math.min(vh - 320, y + h / 2 - 150));
    if (spaceRight >= W + 16) {
      left = x + w + 20;
    } else if (spaceLeft >= W + 16) {
      left = x - W - 20;
    } else {
      // below
      left = Math.max(16, Math.min(vw - W - 16, x + w / 2 - W / 2));
      top  = Math.min(vh - 320, y + h + 16);
    }
    return { top, left };
  }, [rect, vw, vh]);

  // Arrow connector from card edge toward the spotlight
  const arrowEl = useMemo(() => {
    if (!rect) return null;
    const W = 330;
    const PAD2 = 12;
    const sx = rect.left - PAD2, sy = rect.top - PAD2;
    const sw = rect.width + PAD2 * 2, sh = rect.height + PAD2 * 2;
    // spotlight centre
    const cx = sx + sw / 2, cy = sy + sh / 2;

    // card centre (approximate)
    let cardLeft = cardStyle.left ?? 0;
    let cardTop  = cardStyle.top  ?? 0;
    if (cardStyle.transform) return null; // centred welcome, no arrow needed
    const cardCx = cardLeft + W / 2;
    const cardCy = cardTop + 150;

    // draw a line from card edge → spotlight edge with an arrowhead
    const dx = cx - cardCx, dy = cy - cardCy;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len, uy = dy / len;
    // start: card edge, end: just outside spotlight
    const startX = cardCx + ux * (W / 2 + 8);
    const startY = cardCy + uy * 60;
    const endX   = cx - ux * (sw / 2 + 16);
    const endY   = cy - uy * (sh / 2 + 16);
    // midpoint control for curve
    const midX = (startX + endX) / 2 - uy * 30;
    const midY = (startY + endY) / 2 + ux * 30;
    // arrowhead
    const ah = 10;
    const ax1 = endX - ux * ah + uy * (ah / 2);
    const ay1 = endY - uy * ah - ux * (ah / 2);
    const ax2 = endX - ux * ah - uy * (ah / 2);
    const ay2 = endY - uy * ah + ux * (ah / 2);

    return (
      <svg style={{ position:'fixed', inset:0, width:'100%', height:'100%', zIndex:2003, pointerEvents:'none' }}>
        <path
          d={`M${startX},${startY} Q${midX},${midY} ${endX},${endY}`}
          stroke="#f97316" strokeWidth="2" fill="none" strokeDasharray="5 4"
          style={{ animation:'onb-fade 0.4s ease both' }}
        />
        <path
          d={`M${ax1},${ay1} L${endX},${endY} L${ax2},${ay2}`}
          stroke="#f97316" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"
          style={{ animation:'onb-fade 0.4s ease 0.1s both' }}
        />
      </svg>
    );
  }, [rect, cardStyle]);

  const spotlightPath = buildSpotlightPath(vw, vh, rect);

  // Orange border rect over spotlight
  const borderRect = rect ? {
    x: rect.left - PAD - 1,
    y: rect.top  - PAD - 1,
    width:  rect.width  + PAD * 2 + 2,
    height: rect.height + PAD * 2 + 2,
    rx: 15,
  } : null;

  return (
    <>
      <style>{ONB_STYLES}</style>

      {/* SVG overlay — dark everywhere, cut out where target is */}
      <svg
        style={{ position:'fixed', inset:0, width:'100%', height:'100%', zIndex:2000, pointerEvents:'none', transition:'all 0.4s cubic-bezier(0.16,1,0.3,1)' }}
      >
        <defs>
          <filter id="onb-blur">
            <feGaussianBlur stdDeviation="3"/>
          </filter>
        </defs>

        {/* Dark scrim with cutout */}
        <path
          d={spotlightPath}
          fill="rgba(0,0,0,0.82)"
          fillRule="evenodd"
          style={{ transition:'d 0.4s cubic-bezier(0.16,1,0.3,1)' }}
        />

        {/* Glowing orange border around the spotlight hole */}
        {borderRect && (
          <>
            {/* soft glow behind */}
            <rect
              {...borderRect}
              fill="none"
              stroke="rgba(249,115,22,0.25)"
              strokeWidth="12"
              filter="url(#onb-blur)"
              style={{ animation:'onb-glow 2s ease-in-out infinite' }}
            />
            {/* crisp border */}
            <rect
              {...borderRect}
              fill="none"
              stroke="#f97316"
              strokeWidth="2"
              style={{ animation:'onb-glow 2s ease-in-out infinite' }}
            />
            {/* corner accents */}
            {[
              [borderRect.x,                        borderRect.y,                         1, 1],
              [borderRect.x + borderRect.width,     borderRect.y,                        -1, 1],
              [borderRect.x,                        borderRect.y + borderRect.height,     1,-1],
              [borderRect.x + borderRect.width,     borderRect.y + borderRect.height,    -1,-1],
            ].map(([cx2, cy2, sx2, sy2], i) => (
              <g key={i}>
                <line x1={cx2} y1={cy2} x2={cx2 + sx2 * 14} y2={cy2}          stroke="#fb923c" strokeWidth="3" strokeLinecap="round"/>
                <line x1={cx2} y1={cy2} x2={cx2}            y2={cy2 + sy2*14} stroke="#fb923c" strokeWidth="3" strokeLinecap="round"/>
              </g>
            ))}
          </>
        )}
      </svg>

      {/* Dashed arrow from card → spotlight */}
      {arrowEl}

      {/* Tooltip card */}
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
        {/* Step counter + progress bar */}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
          <div style={{ flex:1, display:'flex', gap:4 }}>
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
          <span style={{ fontSize:11, color:'rgba(255,255,255,0.28)', fontWeight:600, flexShrink:0 }}>
            {step + 1} / {total}
          </span>
        </div>

        {/* Icon + title row */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:11 }}>
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

        {/* Body text */}
        <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.8, marginBottom: 20 }}>
          {s.body}
        </p>

        {/* Action buttons */}
        <div style={{ display:'flex', gap:8 }}>
          {step > 0 && (
            <button
              onClick={goPrev}
              style={{ flex:'0 0 auto', padding:'9px 16px', borderRadius:10, background:'rgba(255,255,255,0.05)', border:'1.5px solid rgba(255,255,255,0.1)', color:'#94a3b8', fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:5, transition:'all 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.09)'}
              onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.05)'}
            >
              <ChevronLeft size={14}/> Back
            </button>
          )}
          <button
            onClick={goNext}
            style={{ flex:1, padding:'10px 18px', borderRadius:10, background:'linear-gradient(135deg,#f97316,#ea580c)', border:'none', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:7, boxShadow:'0 4px 18px rgba(249,115,22,0.4)', transition:'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow='0 6px 24px rgba(249,115,22,0.55)'; e.currentTarget.style.transform='translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow='0 4px 18px rgba(249,115,22,0.4)';  e.currentTarget.style.transform=''; }}
          >
            {step < total - 1
              ? <> Next <ChevronRight size={15}/></>
              : <> Let's go! <ArrowRight size={15}/></>
            }
          </button>
        </div>

        <button
          onClick={onFinish}
          style={{ display:'block', margin:'13px auto 0', background:'none', border:'none', color:'rgba(255,255,255,0.22)', fontSize:11, cursor:'pointer', letterSpacing:'0.04em', transition:'color 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.color='rgba(255,255,255,0.48)'}
          onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,0.22)'}
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
    } catch {}
    // Give it a moment then let parent handle health check
    setTimeout(() => setRestarting(false), 8000);
    onRestart();
  };
  return (
    <div className="anim-fadeIn" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', backdropFilter:'blur(12px)', zIndex:1500, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ background:'var(--card)', border:'1.5px solid rgba(239,68,68,0.3)', borderRadius:24, padding:'40px 36px', maxWidth:400, width:'100%', textAlign:'center', boxShadow:'0 32px 80px rgba(0,0,0,0.5)' }}>
        <AlertCircle size={48} style={{ color:'#f87171', marginBottom:16 }}/>
        <h2 style={{ fontFamily:"'Segoe UI Variable Display','Segoe UI Variable','Segoe UI',system-ui,-apple-system,sans-serif", fontWeight:800, fontSize:20, marginBottom:10 }}>Backend Offline</h2>
        <p style={{ color:'var(--muted)', fontSize:14, lineHeight:1.8, marginBottom:28 }}>
          The akaReader backend has stopped responding. This can happen if the server process exited unexpectedly.
        </p>
        <div style={{ display:'flex', gap:12, justifyContent:'center' }}>
          <Btn variant="outline" onClick={onRestart}>Dismiss</Btn>
          {window.electronAPI?.restartServices && (
            <Btn onClick={handleRestart} disabled={restarting}>
              {restarting ? <><Spin size={14}/> Restarting...</> : <><RotateCcw size={15}/> Restart Services</>}
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
});

// ==================== STARTUP SCREEN ====================

const StartupScreen = memo(() => {
  const [phase, setPhase] = useState(0);
  const [statusMsg, setStatusMsg] = useState('Starting services...');
  const [barW, setBarW] = useState(0);
  const [downloadPct, setDownloadPct] = useState(null); // null = not downloading

  // Map Electron status codes to human messages + bar progress
  const STATUS_MAP = {
    'downloading-jre':       { msg: 'Downloading Java runtime (first launch only)...', bar: null },
    'extracting-jre':        { msg: 'Extracting Java runtime...', bar: 15 },
    'downloading-suwayomi':  { msg: 'Downloading Suwayomi server (first launch only)...', bar: null },
    'suwayomi-starting':     { msg: 'Starting Suwayomi server...', bar: 45 },
    'starting-suwayomi':     { msg: 'Starting Suwayomi — this can take 20–30 seconds...', bar: 50 },
    'suwayomi-ready':        { msg: 'Suwayomi ready!', bar: 95 },
    'online':                { msg: 'Ready!', bar: 100 },
    'offline':               { msg: 'Waiting for services...', bar: 40 },
    'crashed':               { msg: 'Service crashed — retrying...', bar: 30 },
    'suwayomi-failed':       { msg: 'Suwayomi failed to start. Check Java is installed.', bar: 30 },
  };

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 300);
    const t2 = setTimeout(() => setPhase(2), 700);
    const t3 = setTimeout(() => { setPhase(3); }, 1100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  // Animate bar slowly while waiting (stops at 90 unless we get real progress)
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

  // Listen for real status from Electron
  useEffect(() => {
    if (!window.electronAPI?.onServicesStatus) return;
    window.electronAPI.onServicesStatus((status) => {
      // Handle download progress like "downloading-suwayomi:75"
      if (status.includes(':') && !status.startsWith('update-available')) {
        const [code, val] = status.split(':');
        const pct = parseInt(val);
        if (!isNaN(pct)) {
          setDownloadPct(pct);
          setBarW(pct * 0.45); // downloads are 0-45% of bar
          const label = code === 'downloading-jre' ? 'Downloading Java runtime' : 'Downloading Suwayomi';
          setStatusMsg(`${label}... ${pct}%`);
          return;
        }
      }
      setDownloadPct(null);
      const mapped = STATUS_MAP[status];
      if (mapped) {
        setStatusMsg(mapped.msg);
        if (mapped.bar !== null) setBarW(mapped.bar);
      }
    });
  }, []);

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

      {/* Ambient orbs */}
      <div style={{
        position:'absolute', width:500, height:500, borderRadius:'50%',
        background:'radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 70%)',
        top:'10%', left:'20%', animation:'ss-orb1 6s ease-in-out infinite',
        pointerEvents:'none',
      }}/>
      <div style={{
        position:'absolute', width:400, height:400, borderRadius:'50%',
        background:'radial-gradient(circle, rgba(234,88,12,0.06) 0%, transparent 70%)',
        bottom:'15%', right:'15%', animation:'ss-orb2 8s ease-in-out infinite',
        pointerEvents:'none',
      }}/>

      {/* Floating particles */}
      {[...Array(8)].map((_, i) => (
        <div key={i} style={{
          position:'absolute',
          width: 3 + (i % 3),
          height: 3 + (i % 3),
          borderRadius:'50%',
          background:`rgba(249,115,22,${0.2 + (i % 4) * 0.1})`,
          left:`${15 + i * 10}%`,
          bottom:`${20 + (i % 3) * 15}%`,
          animation:`ss-particle ${3 + i * 0.4}s ease-out ${i * 0.3}s infinite`,
          pointerEvents:'none',
        }}/>
      ))}

      {/* Main content */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:0, position:'relative' }}>

        {/* Icon */}
        <div style={{
          width:88, height:88, borderRadius:24,
          background:'linear-gradient(145deg,#f97316 0%,#ea580c 60%,#c2410c 100%)',
          display:'flex', alignItems:'center', justifyContent:'center',
          animation: phase >= 0 ? 'ss-drop 0.6s cubic-bezier(0.16,1,0.3,1) both, ss-glow 3s ease-in-out 1s infinite' : 'none',
          position:'relative', marginBottom:28,
          flexShrink:0,
        }}>
          {/* inner gloss */}
          <div style={{
            position:'absolute', top:0, left:0, right:0, height:'50%',
            borderRadius:'24px 24px 0 0',
            background:'linear-gradient(180deg,rgba(255,255,255,0.18) 0%,transparent 100%)',
            pointerEvents:'none',
          }}/>
          <BookOpen size={40} color="#fff" style={{ filter:'drop-shadow(0 2px 8px rgba(0,0,0,0.4))' }}/>
        </div>

        {/* Title + subtitle */}
        <div style={{
          textAlign:'center', marginBottom:40,
          opacity: phase >= 1 ? 1 : 0,
          animation: phase >= 1 ? 'ss-rise 0.5s cubic-bezier(0.16,1,0.3,1) both' : 'none',
        }}>
          <h1 style={{
            fontFamily:"'Segoe UI Variable Display','Segoe UI Variable','Segoe UI',system-ui,-apple-system,sans-serif", fontWeight:900, fontSize:36,
            letterSpacing:'-0.03em', lineHeight:1, marginBottom:8,
            background:'linear-gradient(135deg,#f97316 0%,#fb923c 45%,#fbbf24 100%)',
            WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
            backgroundClip:'text',
          }}>akaReader</h1>
          <p style={{ color:'#475569', fontSize:13, fontWeight:500, letterSpacing:'0.1em', textTransform:'uppercase' }}>
            Manga · Manhwa · Manhua
          </p>
        </div>

        {/* Progress bar */}
        <div style={{
          width:220, opacity: phase >= 2 ? 1 : 0,
          animation: phase >= 2 ? 'ss-rise 0.4s ease both' : 'none',
        }}>
          <div style={{
            height:3, borderRadius:2,
            background:'rgba(255,255,255,0.06)',
            overflow:'hidden', marginBottom:14,
          }}>
            <div style={{
              height:'100%', borderRadius:2,
              width:`${barW}%`,
              background:'linear-gradient(90deg,#f97316,#fb923c,#fbbf24,#f97316)',
              backgroundSize:'200% 100%',
              animation:'ss-bar-shimmer 1.5s linear infinite',
              transition:'width 0.3s ease',
              boxShadow:'0 0 8px rgba(249,115,22,0.6)',
            }}/>
          </div>

          {/* Real status message */}
          <div style={{ height:20, overflow:'hidden', textAlign:'center' }}>
            <p style={{
              color:'#64748b', fontSize:12, fontWeight:500, transition:'all 0.3s',
            }}>
              {statusMsg}
            </p>
          </div>
        </div>

      </div>

      {/* Version watermark */}
      <div style={{
        position:'absolute', bottom:24,
        fontSize:11, color:'#1e293b', fontWeight:500, letterSpacing:'0.05em',
        opacity: phase >= 2 ? 1 : 0,
        transition:'opacity 0.5s ease 1s',
      }}>
        v1.0.0
      </div>
    </div>
  );
});

// ==================== MAIN APP ====================

const App = memo(() => {
  const data = useData();
  const toast = useToast();
  const {
    backendOnline, sources, extensions, library, history, progress,
    mangaCategories, installing, readingTime, settings, updates, checkingUpdates,
    readChapters, markChapterRead,
    fetchJSON, checkHealth, fetchSources, fetchExtensions,
    installExt, uninstallExt, updateExt, toggleLibrary, setCategory,
    addToHistory, removeFromHistory, updateProgress, inLibrary,
    checkForUpdates, addReadingTime, updateSetting
  } = data;

  const { downloadedKeys, refreshDownloads } = useDownloads();

  // Download queue
  const [downloadQueue, setDownloadQueue] = useState([]);
  const dlProcessingRef = useRef(false);

  // Update notification from Electron
  const [updateAvailable, setUpdateAvailable] = useState(null); // version string

  // Navigation
  const [tab, setTab] = useState('browse');
  const [view, setView] = useState('tabs');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => settings?.sidebarCollapsed || false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);

  // Onboarding
  const [showOnboarding, setShowOnboarding] = useState(() => !storage.get('onboardingDone', false));

  // Error recovery
  const [showErrorModal, setShowErrorModal] = useState(false);
  const errorTimerRef = useRef(null);
  // Tracks whether Suwayomi (port 4567) is up — false while it's still starting
  const [suwayomiReady, setSuwayomiReady] = useState(false);

  // Listen for services status from Electron
  useEffect(() => {
    if (window.electronAPI?.onServicesStatus) {
      window.electronAPI.onServicesStatus((status) => {
        if (status === 'crashed' || status === 'offline') {
          setShowErrorModal(true);
        } else if (status === 'online') {
          // Node server (port 3001) is up — exit startup screen immediately.
          // Suwayomi may still be starting; checkHealth now returns ok:true
          // as long as the server itself is responding.
          setShowErrorModal(false);
          checkHealth().then(() => { fetchSources(); fetchExtensions(); });
        } else if (status === 'suwayomi-starting') {
          setSuwayomiReady(false);
        } else if (status === 'suwayomi-ready') {
          setSuwayomiReady(true);
          // Suwayomi is now up — refresh sources & extensions
          fetchSources();
          fetchExtensions();
        } else if (status.startsWith('suwayomi-failed:')) {
          setSuwayomiReady(false);
          // Leave the banner up so the user knows why browse isn't working
        } else if (status.startsWith('update-available:')) {
          setUpdateAvailable(status.split(':')[1]);
        }
      });
    }
  }, [checkHealth, fetchSources, fetchExtensions]);

  // Mouse button shortcuts (back = button 3, forward = button 4)
  // Use refs so the listener doesn't need to be re-registered on every view change
  const viewRef = useRef(view);
  const goBackRef = useRef(null);
  useEffect(() => { viewRef.current = view; }, [view]);
  useEffect(() => {
    const onMouseDown = (e) => {
      if (e.button === 3) { e.preventDefault(); goBackRef.current?.(); }
      if (e.button === 4) { e.preventDefault();
        const v = viewRef.current;
        if (v === 'manga') setView('source');
        else if (v === 'source') setView('tabs');
      }
    };
    window.addEventListener('mousedown', onMouseDown);
    return () => window.removeEventListener('mousedown', onMouseDown);
  }, []);

  // Download cancellation ref — set to true to abort the active download
  const dlCancelRef = useRef(false);

  // Process download queue one at a time — oldest chapter first (ascending)
  useEffect(() => {
    if (dlProcessingRef.current) return;
    const pending = downloadQueue.find(d => d.status === 'pending');
    if (!pending) return;
    dlProcessingRef.current = true;
    dlCancelRef.current = false;

    setDownloadQueue(prev => prev.map(d => d.id === pending.id ? { ...d, status: 'downloading', progress: 0, pagesLoaded: 0, pagesTotal: 0 } : d));

    (async () => {
      try {
        const imgs = await fetchJSON(`/source/${pending.sourceId}/chapter/${pending.chapterId}`);
        const urls = Array.isArray(imgs) ? imgs : [];
        if (!urls.length) throw new Error('No pages found');
        setDownloadQueue(prev => prev.map(d => d.id === pending.id ? { ...d, pagesTotal: urls.length } : d));
        let done = 0;
        const blobs = [];
        for (const url of urls) {
          if (dlCancelRef.current) {
            setDownloadQueue(prev => prev.map(d => d.id === pending.id ? { ...d, status: 'cancelled' } : d));
            return;
          }
          const r = await fetch(url);
          if (!r.ok) throw new Error(`Page failed: ${r.status}`);
          const blob = await r.blob();
          blobs.push({ url, blob });
          done++;
          const pct = Math.round(done / urls.length * 100);
          setDownloadQueue(prev => prev.map(d => d.id === pending.id ? { ...d, progress: pct, pagesLoaded: done } : d));
        }
        await saveChapterBlobs(pending.mangaId, pending.chapterId, blobs);
        await refreshDownloads();
        setDownloadQueue(prev => prev.map(d => d.id === pending.id ? { ...d, status: 'done', progress: 100 } : d));
        toast(`Ch. ${pending.chapterNum} of "${pending.mangaTitle}" saved`, 'success');
      } catch (e) {
        if (!dlCancelRef.current) {
          setDownloadQueue(prev => prev.map(d => d.id === pending.id ? { ...d, status: 'error', error: e.message } : d));
        }
      } finally {
        dlProcessingRef.current = false;
      }
    })();
  }, [downloadQueue, fetchJSON, refreshDownloads, toast]);

  const queueChaptersForDownload = useCallback((chapters, mangaId, mangaTitle, sourceId) => {
    // Sort ascending (oldest/lowest chapter number first) so downloads go in reading order
    const sorted = [...chapters].sort((a, b) => parseFloat(a.number) - parseFloat(b.number));
    const newItems = sorted.map(ch => ({
      id: `${mangaId}__${ch.id}__${Date.now()}_${Math.random()}`,
      mangaId, mangaTitle, chapterId: ch.id, chapterNum: ch.number, sourceId,
      status: 'pending', progress: 0, pagesLoaded: 0, pagesTotal: 0, error: null
    }));
    setDownloadQueue(prev => {
      const existing = new Set(prev.filter(d => d.status !== 'error' && d.status !== 'cancelled').map(d => d.chapterId));
      const toAdd = newItems.filter(item => !existing.has(item.chapterId));
      if (!toAdd.length) { toast('All selected chapters already queued or downloaded', 'warning'); return prev; }
      return [...prev, ...toAdd];
    });
    toast(`Queued chapters for download`, 'info');
    setTab('downloads');
  }, [toast]);

  // Show error modal only after backend has been offline for 15s (not on first load)
  useEffect(() => {
    if (backendOnline === false) {
      errorTimerRef.current = setTimeout(() => setShowErrorModal(true), 15000);
    } else if (backendOnline === true) {
      clearTimeout(errorTimerRef.current);
      setShowErrorModal(false);
    }
    return () => clearTimeout(errorTimerRef.current);
  }, [backendOnline]);

  // Browse
  const [activeSource, setActiveSource] = useState(null);
  const [inputVal, setInputVal] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [browsePage, setBrowsePage] = useState(1);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState('');
  const [showFilterBar, setShowFilterBar] = useState(false);

  // ── NEW: browse filters ──
  const DEFAULT_FILTERS = { tags: '', status: 'all', sort: 'latest', contentType: 'all' };
  const [browseFilters, setBrowseFilters] = useState(DEFAULT_FILTERS);

  const activeFilterCount = useMemo(() => {
    return (browseFilters.tags ? 1 : 0)
      + (browseFilters.status !== 'all' ? 1 : 0)
      + (browseFilters.sort !== 'latest' ? 1 : 0)
      + (browseFilters.contentType !== 'all' ? 1 : 0);
  }, [browseFilters]);

  // Infinite scroll for source browse
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef(null);

  // Manga detail
  const [selectedManga, setSelectedManga] = useState(null);
  const [mangaDetail, setMangaDetail] = useState(null);
  const [mangaLoading, setMangaLoading] = useState(false);
  const [mangaError, setMangaError] = useState('');
  const [chapSearch, setChapSearch] = useState('');
  const [chapterSort, setChapterSort] = useState('desc');

  // Reader
  const [currentChapter, setCurrentChapter] = useState(null);
  const [pages, setPages] = useState([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [readerPage, setReaderPage] = useState(0);
  const chapterAbortRef = useRef(null); // cancel in-flight page fetches when chapter changes

  // Library
  const [activeCategory, setActiveCategory] = useState('all');
  const [libraryView, setLibraryView] = useState(() => settings?.libraryView || 'grid');
  const [librarySearch, setLibrarySearch] = useState('');

  // UI
  const [contextMenu, setContextMenu] = useState(null);
  const [extSearch, setExtSearch] = useState('');
  const [extLang, setExtLang] = useState('all');
  const [extTab, setExtTab] = useState('all');
  const [showNsfw, setShowNsfw] = useState(true);
  const [extSort, setExtSort] = useState('name');
  const [extDisplayCount, setExtDisplayCount] = useState(30);
  const extSentinelRef = useRef(null);
  const prevQ = useRef(null);
  const chapRef = useRef([]);

  useEffect(() => { if (mangaDetail) chapRef.current = mangaDetail.chapters; }, [mangaDetail]);

  const debouncedSearch = useMemo(() => debounce(q => setQuery(q), CONFIG.DEBOUNCE_DELAY), []);

  // Build filter query string
  const buildFilterParams = useCallback((q, page, filters) => {
    const params = new URLSearchParams({ q, page });
    if (filters.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters.sort && filters.sort !== 'latest') params.set('sort', filters.sort);
    if (filters.contentType && filters.contentType !== 'all') params.set('contentType', filters.contentType);
    if (filters.tags) params.set('tags', filters.tags);
    return params.toString();
  }, []);

  // Browse with append option + filters
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

  // Re-search when query changes
  useEffect(() => {
    if (view === 'source' && activeSource && prevQ.current !== query) {
      prevQ.current = query; setBrowsePage(1); doSearch(query, activeSource, 1, false, browseFilters);
    }
  }, [query, view, activeSource, doSearch, browseFilters]);

  // Handle filter changes
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

  // Infinite scroll observer for source browse
  useEffect(() => {
    if (view !== 'source' || !activeSource || loadingMore || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && hasNextPage) {
          setLoadingMore(true);
          const nextPage = browsePage + 1;
          doSearch(query, activeSource, nextPage, true, browseFilters).finally(() => {
            setLoadingMore(false);
            setBrowsePage(nextPage);
          });
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [view, activeSource, hasNextPage, loadingMore, browsePage, query, doSearch, browseFilters]);

  // Manga
  const openManga = useCallback(async (manga, overrideSourceId) => {
    const sourceId = overrideSourceId || manga.sourceId || activeSource?.id;
    const source = sources[sourceId] || Object.values(sources).find(s => s.id === String(sourceId));
    if (!source) { toast('Source not available', 'error'); return; }

    setActiveSource(source); setSelectedManga(manga); setMangaDetail(null);
    setMangaError(''); setChapSearch(''); setView('manga'); setMangaLoading(true);

    try {
      const d = await fetchJSON(`/source/${source.id}/manga/${manga.id}`);
      if (d.error) throw new Error(d.error);
      setMangaDetail(d); addToHistory(manga, source.id, d);
    } catch (e) { setMangaError(e.message); toast('Failed to load manga', 'error'); }
    finally { setMangaLoading(false); }
  }, [activeSource, sources, fetchJSON, addToHistory, toast]);

  const openChapter = useCallback(async (chapter) => {
    // Cancel any previous in-flight fetch
    if (chapterAbortRef.current) chapterAbortRef.current.abort();
    const ac = new AbortController();
    chapterAbortRef.current = ac;

    setCurrentChapter(chapter); setPages([]); setReaderPage(0); setView('reader'); setPagesLoading(true);
    try {
      const mangaId = mangaDetail?.id;
      const localPages = mangaId ? await loadChapterBlobs(mangaId, chapter.id) : null;
      if (ac.signal.aborted) return;
      if (localPages && localPages.length > 0) {
        setPages(localPages);
        toast(`Chapter ${chapter.number} (offline)`, 'success');
      } else {
        const imgs = await fetchJSON(`/source/${activeSource.id}/chapter/${chapter.id}`);
        if (ac.signal.aborted) return;
        setPages(Array.isArray(imgs) ? imgs : []);
        toast(`Chapter ${chapter.number} loaded`, 'success');
      }
      updateProgress(mangaDetail?.id, chapter.id, chapter.number, 0);
      markChapterRead(mangaDetail?.id, chapter.id, true);
    } catch (e) {
      if (!ac.signal.aborted) toast('Failed to load chapter', 'error');
    } finally {
      if (!ac.signal.aborted) setPagesLoading(false);
    }
  }, [activeSource, mangaDetail, fetchJSON, updateProgress, markChapterRead, toast]);

  const chIdx = chapRef.current.findIndex(c => c.id === currentChapter?.id);
  // Chapters are sorted descending (highest number = index 0).
  // "Next" in reading order means higher chapter number = lower array index.
  const hasNextCh = chIdx > 0;
  const hasPrevCh = chIdx >= 0 && chIdx < chapRef.current.length - 1;

  const handleDownload = useCallback(async (chapter) => {
    const mangaId = mangaDetail?.id;
    try {
      toast(`Downloading chapter ${chapter.number}...`, 'info');
      // Fetch page URLs
      const imgs = await fetchJSON(`/source/${activeSource.id}/chapter/${chapter.id}`);
      const urls = Array.isArray(imgs) ? imgs : [];
      if (!urls.length) throw new Error('No pages found');
      // Download each image as a blob
      const blobs = await Promise.all(urls.map(async url => {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`Page fetch failed: ${r.status}`);
        return { url, blob: await r.blob() };
      }));
      // Save to IndexedDB for offline reading
      if (mangaId) {
        await saveChapterBlobs(mangaId, chapter.id, blobs);
        await refreshDownloads();
      }
      // Also offer CBZ download via server (if online)
      try {
        const response = await fetch(`${CONFIG.API}/source/${activeSource.id}/chapter/${chapter.id}/download?title=${encodeURIComponent(mangaDetail?.title || 'chapter')}-${chapter.number}`);
        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = `${mangaDetail?.title || 'chapter'}-ch${chapter.number}.cbz`;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }
      } catch { /* CBZ export failed but local save succeeded */ }
      toast(`Chapter ${chapter.number} saved for offline reading`, 'success');
    } catch (e) {
      toast(`Download error: ${e.message}`, 'error');
    }
  }, [activeSource, mangaDetail, fetchJSON, refreshDownloads, toast]);

  const handleChapterContextMenu = useCallback((e, ch) => {
    e.preventDefault();
    e.stopPropagation();
    if (!mangaDetail) return;
    const isRead = ch.read || !!(readChapters[mangaDetail.id]?.includes(String(ch.id)));
    const allChs = chapRef.current;
    const idx = allChs.findIndex(c => c.id === ch.id);
    const markRange = (from, to, read) => {
      allChs.slice(from, to + 1).forEach(c => markChapterRead(mangaDetail.id, c.id, read));
      toast(`Marked ${to - from + 1} chapter${to - from > 0 ? 's' : ''} as ${read ? 'read' : 'unread'}`, 'success');
    };
    const items = [
      { label: isRead ? 'Mark as Unread' : 'Mark as Read', icon: isRead ? EyeOff : Eye,
        action: () => { markChapterRead(mangaDetail.id, ch.id, !isRead); fetchJSON(`/chapter/${ch.id}/read`, { method: 'PATCH', body: JSON.stringify({ isRead: !isRead }) }).catch(()=>{}); }},
      { label: 'Mark from here (above as read)', icon: Check,
        action: () => markRange(0, idx, true) },
      { label: 'Mark from here (below as unread)', icon: EyeOff,
        action: () => markRange(idx, allChs.length - 1, false) },
      { label: 'Mark all above as unread', icon: EyeOff, danger: false,
        action: () => markRange(0, idx - 1, false) },
      { label: 'Download this chapter', icon: Download,
        action: () => handleDownload(ch) },
      { label: 'Queue this chapter', icon: Archive,
        action: () => queueChaptersForDownload([ch], mangaDetail.id, mangaDetail.title, activeSource?.id) },
      { label: 'Queue from here onwards (unread)', icon: Archive,
        action: () => {
          const rest = allChs.slice(idx).filter(c => !c.read && !(readChapters[mangaDetail.id]?.includes(String(c.id))));
          if (!rest.length) { toast('No unread chapters from here', 'warning'); return; }
          queueChaptersForDownload(rest, mangaDetail.id, mangaDetail.title, activeSource?.id);
        }},
    ];
    setContextMenu({ x: e.clientX, y: e.clientY, items });
  }, [mangaDetail, readChapters, markChapterRead, fetchJSON, handleDownload, queueChaptersForDownload, activeSource, toast]);

  // Tag click — always search in the manga's own source
  const handleTagClick = useCallback((tag, sourceId) => {
    const targetSourceId = sourceId || activeSource?.id;
    const source = sources[targetSourceId] || Object.values(sources).find(s => s.id === String(targetSourceId));
    if (source) {
      // Search tag as a plain query — sources support this natively and it's instant
      // Server-side per-manga genre filtering is too slow for real use
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

  const filteredExts = useMemo(() => {
    let filtered = extensions.filter(e => {
      if (extTab === 'installed' && !e.isInstalled) return false;
      const matchLang = extLang === 'all' || (e.lang || '').toLowerCase() === extLang;
      const matchName = !extSearch || (e.name || '').toLowerCase().includes(extSearch.toLowerCase());
      const matchNsfw = showNsfw ? true : !e.isNsfw;
      return matchLang && matchName && matchNsfw;
    });
    switch (extSort) {
      case 'name': filtered.sort((a, b) => (a.name||'').localeCompare(b.name||'')); break;
      case 'version': filtered.sort((a, b) => (b.versionCode||0) - (a.versionCode||0)); break;
      case 'installed': filtered.sort((a, b) => (b.isInstalled?1:0) - (a.isInstalled?1:0)); break;
      default: filtered.sort((a, b) => (a.name||'').localeCompare(b.name||'')); break;
    }
    return filtered;
  }, [extensions, extTab, extLang, extSearch, showNsfw, extSort]);

  const filteredLibrary = useMemo(() => {
    let list = activeCategory === 'all' ? library : library.filter(m => mangaCategories[m.id] === activeCategory);
    if (librarySearch.trim()) list = list.filter(m => m.title.toLowerCase().includes(librarySearch.toLowerCase()) || m.author?.toLowerCase().includes(librarySearch.toLowerCase()));
    return list;
  }, [library, activeCategory, mangaCategories, librarySearch]);
  const installedSources = useMemo(() => Object.values(sources), [sources]);
  const installedExts = useMemo(() => extensions.filter(e => e.isInstalled), [extensions]);

  const goBack = useCallback(() => {
    if (view === 'reader') setView('manga');
    else if (view === 'manga') setView(activeSource ? 'source' : 'tabs');
    else if (view === 'source') { setView('tabs'); setResults([]); }
  }, [view, activeSource]);

  // Wire up the goBack ref after declaration
  useEffect(() => { goBackRef.current = goBack; }, [goBack]);

  // Escape key goes back
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

  const switchTab = useCallback((id) => { setTab(id); if (id === 'browse') { setView('tabs'); setResults([]); } }, []);

  // Keyboard shortcuts — placed here so switchTab is already declared
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = e.target.tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (inInput) return;
      // Global search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); setShowGlobalSearch(true); }
      // Tab navigation: Ctrl/Cmd + 1-6
      if ((e.ctrlKey || e.metaKey) && e.key === '1') { e.preventDefault(); switchTab('browse'); }
      if ((e.ctrlKey || e.metaKey) && e.key === '2') { e.preventDefault(); switchTab('extensions'); }
      if ((e.ctrlKey || e.metaKey) && e.key === '3') { e.preventDefault(); switchTab('library'); }
      if ((e.ctrlKey || e.metaKey) && e.key === '4') { e.preventDefault(); switchTab('history'); }
      if ((e.ctrlKey || e.metaKey) && e.key === '5') { e.preventDefault(); switchTab('updates'); }
      if ((e.ctrlKey || e.metaKey) && e.key === '6') { e.preventDefault(); switchTab('downloads'); }
      // Alt+Left/Right: previous/next tab
      if (e.altKey && e.key === 'ArrowLeft')  { e.preventDefault(); const ids=['browse','extensions','library','history','updates','downloads','settings']; const i=ids.indexOf(tab); if(i>0) switchTab(ids[i-1]); }
      if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); const ids=['browse','extensions','library','history','updates','downloads','settings']; const i=ids.indexOf(tab); if(i<ids.length-1) switchTab(ids[i+1]); }
      // Refresh
      if (e.key === 'F5') { e.preventDefault(); checkHealth(); fetchSources(); fetchExtensions(); }
      // Collapse/expand sidebar with \
      if (e.key === '\\' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); setSidebarCollapsed(p => !p); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [switchTab, checkHealth, fetchSources, fetchExtensions, tab]);

  const handleMangaContextMenu = useCallback((e, manga) => {
    const items = [
      { label:'Open', icon:ExternalLink, action:()=>openManga(manga) },
      { label:inLibrary(manga.id)?'Remove from Library':'Add to Library', icon:inLibrary(manga.id)?Trash2:Heart, action:()=>toggleLibrary(manga, activeSource?.id) },
      ...CATEGORIES.map(cat => ({ label:`→ ${cat.name}`, icon:cat.icon, action:()=>setCategory(manga.id, cat.id) })),
    ];
    setContextMenu({ x:e.clientX, y:e.clientY, items });
  }, [inLibrary, openManga, toggleLibrary, setCategory, activeSource]);

  const stats = useMemo(() => ({
    totalChapters: Object.values(progress).reduce((a,p)=>a+(parseInt(p.chapterNum)||0),0),
    streak: calculateStreak(history),
  }), [progress, history]);

  useEffect(() => { setExtDisplayCount(30); }, [filteredExts]);

  useEffect(() => {
    if (tab !== 'extensions') return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting && extDisplayCount < filteredExts.length) setExtDisplayCount(p => Math.min(p+30, filteredExts.length)); }, { threshold:0.1 });
    if (extSentinelRef.current) obs.observe(extSentinelRef.current);
    return () => obs.disconnect();
  }, [tab, filteredExts.length, extDisplayCount]);

  const NAV = useMemo(() => [
    { id:'browse', label:'Browse', Icon:BookOpen },
    { id:'extensions', label:'Extensions', Icon:Puzzle, badge:installedExts.filter(e=>e.hasUpdate).length||installedExts.length },
    { id:'library', label:'Library', Icon:Library, badge:library.length },
    { id:'history', label:'History', Icon:History, badge:history.length },
    { id:'updates', label:'Updates', Icon:BellRing, badge:updates.length },
    { id:'downloads', label:'Downloads', Icon:Download, badge:downloadQueue.filter(d=>d.status==='pending'||d.status==='downloading').length||undefined },
    { id:'settings', label:'Settings', Icon:Settings },
  ], [installedExts, library.length, history.length, updates.length, downloadQueue]);

  // ── STARTUP SCREEN (first load, before health check resolves) ──
  if (backendOnline === null) return (
    <StartupScreen />
  );

  // ── READER ──
  if (view === 'reader') {
    if (pagesLoading) return (
      <div style={{ position:'fixed', inset:0, background:'#0a0a0f', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:20 }}>
        <Spin size={48}/>
        <p style={{ color:'var(--muted)', fontSize:13 }}>Loading chapter...</p>
      </div>
    );
    return (
      <Reader
        pages={pages} currentChapter={currentChapter} mangaTitle={mangaDetail?.title}
        onBack={goBack}
        onNextChapter={() => { const n=chapRef.current[chIdx-1]; if(n)openChapter(n); }}
        onPrevChapter={() => { const p=chapRef.current[chIdx+1]; if(p)openChapter(p); }}
        hasNext={hasNextCh} hasPrev={hasPrevCh}
        onPageChange={setReaderPage}
        initialPage={progress[mangaDetail?.id]?.page||0}
        mangaId={mangaDetail?.id}
      />
    );
  }


  // ── MAIN SHELL ──
  return (
    <>
      {showOnboarding && <Onboarding onFinish={() => { setShowOnboarding(false); storage.set('onboardingDone', true); }}/>}
      {showErrorModal && <ServiceErrorModal onRestart={() => { setShowErrorModal(false); checkHealth(); }}/>}
      {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenu.items} onClose={() => setContextMenu(null)}/>}
      {/* Non-blocking banner while Suwayomi is still booting in the background */}
      {backendOnline && !suwayomiReady && !showErrorModal && (
        <div className="anim-slideDown" style={{ position:'fixed', top:38, left:0, right:0, zIndex:800, background:'rgba(15,15,24,0.96)', backdropFilter:'blur(12px)', borderBottom:'1px solid rgba(249,115,22,0.25)', padding:'9px 20px', display:'flex', alignItems:'center', gap:10 }}>
          <div className="anim-spin" style={{ width:13, height:13, border:'2px solid rgba(249,115,22,0.3)', borderTopColor:'var(--accent)', borderRadius:'50%', flexShrink:0 }}/>
          <span style={{ fontSize:12, color:'var(--muted)', fontWeight:500 }}>Suwayomi is starting… browse and extensions will load shortly</span>
        </div>
      )}
      {updateAvailable && (
        <div className="anim-fadeIn" style={{ position:'fixed', top:0, left:0, right:0, zIndex:900, background:'linear-gradient(90deg,rgba(234,179,8,0.95),rgba(251,191,36,0.95))', backdropFilter:'blur(12px)', padding:'10px 20px', display:'flex', alignItems:'center', justifyContent:'center', gap:12 }}>
          <BellRing size={16} style={{ color:'#78350f' }}/>
          <a href={`https://github.com/akawazak/akareader/releases/tag/v${updateAvailable}`} target="_blank" rel="noreferrer" style={{ fontSize:13, fontWeight:700, color:'#78350f', textDecoration:'none', display:'flex', alignItems:'center', gap:8 }}>
            akaReader v{updateAvailable} is ready — <span style={{ textDecoration:'underline', fontWeight:700 }}>view release notes ↗</span>
          </a>
          <button onClick={() => setUpdateAvailable(null)} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'#78350f', display:'flex' }}><X size={16}/></button>
        </div>
      )}

      {showGlobalSearch && (
        <GlobalSearch sources={sources} onSelectManga={(manga, srcId) => openManga(manga, srcId)} onClose={() => setShowGlobalSearch(false)} fetchJSON={fetchJSON}/>
      )}

      {/* Titlebar — draggable with real window controls */}
      <div style={{
        position:'fixed', top:0, left:0, right:0, height:38,
        WebkitAppRegion:'drag', zIndex:300,
        background:'var(--bg)', borderBottom:'1px solid var(--border)',
        display:'flex', alignItems:'center', justifyContent:'flex-end',
      }}>
        {/* Window control buttons — no-drag so clicks work */}
        <div style={{ display:'flex', alignItems:'center', WebkitAppRegion:'no-drag', height:'100%' }}>
          <button
            onClick={() => window.electronAPI?.minimize?.()}
            title="Minimize"
            style={{ width:46, height:'100%', border:'none', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted)', transition:'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.07)'}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}
          >
            <svg width="11" height="1" viewBox="0 0 11 1"><rect width="11" height="1" fill="currentColor"/></svg>
          </button>
          <button
            onClick={() => window.electronAPI?.maximize?.()}
            title="Maximize"
            style={{ width:46, height:'100%', border:'none', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted)', transition:'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.07)'}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}
          >
            <svg width="11" height="11" viewBox="0 0 11 11"><rect x="0.5" y="0.5" width="10" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1"/></svg>
          </button>
          <button
            onClick={() => window.electronAPI?.close?.()}
            title="Close"
            style={{ width:46, height:'100%', border:'none', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted)', transition:'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background='#e81123'; e.currentTarget.style.color='#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--muted)'; }}
          >
            <svg width="11" height="11" viewBox="0 0 11 11"><path d="M1 1l9 9M10 1l-9 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside style={{ position:'fixed', left:0, top:38, bottom:0, width:sidebarCollapsed?76:248, background:'var(--bg2)', borderRight:'1px solid var(--border)', zIndex:50, display:'flex', flexDirection:'column', padding:sidebarCollapsed?'14px 12px 20px':'0', transition:'width var(--transition-base)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:sidebarCollapsed?'0 8px':'18px 22px 16px', marginBottom:sidebarCollapsed?16:0 }}>
          <div className="gradient-primary" style={{ width:42, height:42, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:'0 8px 24px rgba(249,115,22,0.3)', WebkitAppRegion:'no-drag' }}>
            <BookOpen size={20} color="#fff"/>
          </div>
          {!sidebarCollapsed && <span className="text-gradient" style={{ fontFamily:"'Segoe UI Variable Display','Segoe UI Variable','Segoe UI',system-ui,-apple-system,sans-serif", fontWeight:800, fontSize:20, WebkitAppRegion:'no-drag' }}>akaReader</span>}
        </div>

        {!sidebarCollapsed && (
          <div style={{ padding:'0 12px', marginBottom:16 }}>
            <button onClick={() => setShowGlobalSearch(true)}
            data-onboard="global-search-btn"
            style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:12, border:'1.5px solid var(--border)', background:'var(--card)', color:'var(--muted)', cursor:'pointer', fontSize:13, transition:'all 0.2s' }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.color='var(--text)';}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--muted)';}}>
              <Search size={15}/><span>Search all sources...</span>
              <span style={{ marginLeft:'auto', fontSize:11, background:'rgba(255,255,255,0.06)', padding:'2px 6px', borderRadius:4 }}>⌘K</span>
            </button>
          </div>
        )}
        {sidebarCollapsed && (
          <div style={{ padding:'0 8px', marginBottom:8 }}>
            <button onClick={() => setShowGlobalSearch(true)} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', padding:'10px', borderRadius:12, border:'1px solid var(--border)', background:'var(--card)', color:'var(--muted)', cursor:'pointer', transition:'all 0.2s' }}>
              <Search size={18}/>
            </button>
          </div>
        )}

        <nav style={{ flex:1, display:'flex', flexDirection:'column', gap:3, padding:sidebarCollapsed?'0 8px':'0 10px' }}>
          {NAV.map(({ id, label, Icon, badge }, i) => {
            const active = tab === id;
            return (
              <button key={id} onClick={() => switchTab(id)} className={`anim-slideLeft delay-${i}`}
            data-onboard={`nav-${id}`} style={{ display:'flex', alignItems:'center', gap:sidebarCollapsed?0:12, padding:sidebarCollapsed?'11px':'11px 14px', borderRadius:12, border:'none', background:active?'rgba(249,115,22,0.12)':'transparent', color:active?'var(--accent)':'var(--text-dim)', cursor:'pointer', justifyContent:sidebarCollapsed?'center':'flex-start', position:'relative', width:'100%', transition:'all 0.2s' }}
                onMouseEnter={e=>{if(!active)e.currentTarget.style.background='rgba(255,255,255,0.05)';}}
                onMouseLeave={e=>{if(!active)e.currentTarget.style.background='transparent';}}>
                {active && !sidebarCollapsed && <div style={{ position:'absolute', left:0, width:3, height:22, background:'var(--accent)', borderRadius:'0 3px 3px 0' }}/>}
                <div style={{ position:'relative' }}>
                  <Icon size={21} style={{ color:active?'var(--accent)':'var(--muted)', transition:'color 0.2s' }}/>
                  {badge > 0 && sidebarCollapsed && (
                    <span style={{ position:'absolute', top:-4, right:-4, width:15, height:15, background:'var(--accent)', borderRadius:'50%', fontSize:9, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff' }}>{badge>9?'9+':badge}</span>
                  )}
                </div>
                {!sidebarCollapsed && (
                  <>
                    <span style={{ flex:1, fontWeight:600, fontSize:14, textAlign:'left' }}>{label}</span>
                    {badge > 0 && <span style={{ background:active?'var(--accent)':'rgba(255,255,255,0.1)', color:active?'#fff':'var(--text)', borderRadius:20, fontSize:11, padding:'2px 9px', fontWeight:700 }}>{badge}</span>}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        {!sidebarCollapsed && (
          <div style={{ padding:'0 14px', marginBottom:14 }}>
            <div style={{ padding:'14px', background:'var(--card)', borderRadius:12, border:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:10 }}>
              <StatItem icon={BookOpen} label="Chapters" value={stats.totalChapters}/>
              <StatItem icon={Flame} label="Streak" value={`${stats.streak}d`}/>
            </div>
          </div>
        )}

        <div style={{ padding:sidebarCollapsed?'0 8px':'0 14px', borderTop:'1px solid var(--border)', paddingTop:14 }}>
          <Btn variant="ghost" size="icon" onClick={() => setSidebarCollapsed(c=>!c)} style={{ width:'100%' }}>
            {sidebarCollapsed ? <ChevronRight size={18}/> : <ChevronLeft size={18}/>}
          </Btn>
        </div>
      </aside>

      {/* Main */}
      <main style={{ marginLeft:sidebarCollapsed?76:248, marginTop:38, minHeight:'calc(100vh - 38px)', transition:'margin-left var(--transition-base)' }}>
        {/* Sticky page header */}
        <div className="glass-strong" style={{
          position:'sticky', top:0, zIndex:40,
          padding: view==='manga' ? '0 24px' : '14px 32px',
          minHeight: view==='manga' ? 54 : 'auto',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          flexWrap:'wrap', gap:14,
          borderBottom:'1px solid var(--border)',
          marginBottom: view==='manga' ? 0 : 28,
          transition:'all var(--transition-base)',
        }}>
          {view === 'manga' ? (
            /* ── Manga detail header — full width, no sidebar gap ── */
            <div style={{ display:'flex', alignItems:'center', gap:10, width:'100%', minWidth:0 }}>
              <Btn variant="ghost" size="sm" onClick={goBack} icon={ChevronLeft} style={{ flexShrink:0 }}>
                {activeSource?.name || 'Back'}
              </Btn>
              <div style={{ width:1, height:22, background:'var(--border)', flexShrink:0 }}/>
              {/* Source icon */}
              {activeSource?.icon && (
                <img src={activeSource.icon} style={{ width:20, height:20, borderRadius:5, objectFit:'contain', flexShrink:0 }} onError={e=>e.target.style.display='none'} alt=""/>
              )}
              <p style={{ flex:1, fontWeight:700, fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'var(--text)' }}>
                {mangaDetail?.title || selectedManga?.title}
                {mangaDetail?.author && <span style={{ fontWeight:400, color:'var(--muted)', marginLeft:10, fontSize:12 }}>{mangaDetail.author}</span>}
              </p>
              <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                {backendOnline===false && <Badge variant="destructive" size="sm">Offline</Badge>}
                {mangaDetail && (
                  <>
                    <Badge variant={inLibrary(mangaDetail.id)?'default':'outline'} size="sm" style={{ cursor:'pointer' }} onClick={() => toggleLibrary(mangaDetail, activeSource?.id)}>
                      {inLibrary(mangaDetail.id)?'★ Saved':'☆ Save'}
                    </Badge>
                    <Btn variant="ghost" size="icon"
                      onClick={() => toggleLibrary(mangaDetail, activeSource?.id)}
                      style={{ color: inLibrary(mangaDetail.id) ? 'var(--accent)' : 'var(--muted)' }}>
                      <Heart size={18} fill={inLibrary(mangaDetail.id) ? 'var(--accent)' : 'none'}/>
                    </Btn>
                  </>
                )}
              </div>
            </div>
          ) : (
            /* ── Regular tab header ── */
            <>
              <div>
                <h1 style={{ fontFamily:"'Segoe UI Variable Display','Segoe UI Variable','Segoe UI',system-ui,-apple-system,sans-serif", fontWeight:800, fontSize:'clamp(22px,2.5vw,30px)', letterSpacing:'-0.02em', marginBottom:2, display:'flex', alignItems:'center', gap:10 }}>
                  {tab==='browse'&&view==='source'?activeSource?.name:
                   tab==='browse'?'Browse':
                   tab==='extensions'?'Extensions':
                   tab==='library'?'Library':
                   tab==='history'?'History':
                   tab==='updates'?'Updates':
                   tab==='downloads'?'Downloads':'Settings'}
                  {backendOnline===false && <Badge variant="destructive" size="sm">Offline</Badge>}
                </h1>
                <p style={{ color:'var(--muted)', fontSize:12 }}>
                  {tab==='browse'&&view==='source'?`${results.length} results${activeFilterCount>0?` • ${activeFilterCount} filter${activeFilterCount>1?'s':''} active`:''}`:
                   tab==='browse'?`${installedSources.length} sources available`:
                   tab==='extensions'?`${installedExts.length} installed • ${extensions.length} total`:
                   tab==='library'?`${filteredLibrary.length} manga`:
                   tab==='history'?`${history.length} entries`:
                   tab==='updates'?`${updates.length} updates`:
                   tab==='downloads'?`${downloadQueue.filter(d=>d.status==='pending'||d.status==='downloading').length} active`:'Customize your experience'}
                </p>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                {view==='source' && (
                  <>
                    <div style={{ position:'relative', width:'min(320px,100%)' }}>
                      <Search size={15} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--muted)', pointerEvents:'none'}}/>
                      <input placeholder={`Search ${activeSource?.name}...`} value={inputVal} onChange={e=>{setInputVal(e.target.value);debouncedSearch(e.target.value);}} style={{ width:'100%', background:'var(--card)', border:'1.5px solid var(--border)', borderRadius:12, padding:'12px 40px 12px 40px', color:'var(--text)', fontSize:14, outline:'none', fontFamily:'system-ui,-apple-system,Segoe UI,sans-serif', transition:'border-color 0.2s' }} onFocus={e=>e.target.style.borderColor='var(--accent)'} onBlur={e=>e.target.style.borderColor='var(--border)'}/>
                      {inputVal && <Btn variant="ghost" size="icon" onClick={()=>{setInputVal('');setQuery('');}} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)' }}><X size={14}/></Btn>}
                    </div>
                    <Btn
                      variant={showFilterBar||activeFilterCount>0?'default':'outline'}
                      size="sm"
                      onClick={() => setShowFilterBar(p => !p)}
                    >
                      <SlidersHorizontal size={14}/>
                      Filters
                      {activeFilterCount > 0 && (
                        <span style={{ background:'rgba(255,255,255,0.25)', borderRadius:10, padding:'1px 7px', fontSize:11, fontWeight:700 }}>
                          {activeFilterCount}
                        </span>
                      )}
                    </Btn>
                  </>
                )}
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ width:7, height:7, borderRadius:'50%', background:backendOnline===true?'#22c55e':backendOnline===false?'#ef4444':'#f59e0b', boxShadow:`0 0 10px ${backendOnline===true?'#22c55e':backendOnline===false?'#ef4444':'#f59e0b'}`, animation:backendOnline===null?'pulse 1.5s infinite':'none' }}/>
                  <span style={{ fontSize:11, color:'var(--muted)', fontWeight:500 }}>{backendOnline===true?'Connected':backendOnline===false?'Disconnected':'Checking...'}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Page content — padded, scrollable */}
        <div style={{ padding: view==='manga' ? 0 : '0 32px 60px' }}>
        {backendOnline===false && (
          <div className="anim-fadeIn" style={{ marginBottom:24, padding:'14px 18px', borderRadius:12, background:'rgba(234,179,8,0.07)', border:'1.5px solid rgba(234,179,8,0.2)', display:'flex', gap:12, alignItems:'center' }}>
            <AlertTriangle size={18} style={{ color:'#facc15', flexShrink:0 }}/>
            <div style={{ flex:1 }}>
              <p style={{ fontWeight:700, fontSize:14, color:'#facc15', marginBottom:2 }}>Backend offline</p>
              <p style={{ fontSize:12, color:'rgba(253,224,71,0.8)', lineHeight:1.5 }}>Run <code style={{ background:'rgba(0,0,0,0.3)', padding:'1px 6px', borderRadius:4 }}>node backend/server.js</code> then refresh.</p>
            </div>
            <Btn variant="outline" size="sm" onClick={checkHealth} style={{ flexShrink:0 }}><RefreshCw size={13}/> Retry</Btn>
          </div>
        )}

        {/* ── Manga Detail (inline in main shell, sidebar stays visible) ── */}
        {view === 'manga' && (
          <div className="page-transition" style={{ padding:'0 0 60px', position:'relative' }}>
            {/* Subtle blurred cover hero */}
            {mangaDetail?.cover && (
              <div style={{
                position:'absolute', top:0, left:0, right:0, height:280,
                backgroundImage:`url(${proxyImg(mangaDetail.cover)})`,
                backgroundSize:'cover', backgroundPosition:'center top',
                filter:'blur(60px) brightness(0.12) saturate(1.5)',
                transform:'scaleX(1.05)',
                zIndex:0, pointerEvents:'none', overflow:'hidden',
                maskImage:'linear-gradient(to bottom,rgba(0,0,0,0.7) 0%,transparent 100%)',
                WebkitMaskImage:'linear-gradient(to bottom,rgba(0,0,0,0.7) 0%,transparent 100%)',
              }}/>
            )}
            <div style={{ position:'relative', zIndex:1, maxWidth:860, margin:'0 auto', padding:'28px 32px 60px' }}>
              {mangaLoading ? (
                <MangaDetailSkeleton/>
              ) : mangaError ? (
                <EmptyState icon={AlertTriangle} title="Failed to load" sub={mangaError} action={<Btn onClick={() => openManga(selectedManga)}>Retry</Btn>}/>
              ) : mangaDetail ? (
                <>
                  <div style={{ display:'flex', gap:28, marginBottom:32, flexWrap:'wrap' }}>
                    <div style={{ width:160, height:240, borderRadius:20, overflow:'hidden', flexShrink:0, border:'1.5px solid var(--border)', background:'var(--card)', boxShadow:'0 24px 64px rgba(0,0,0,0.5)' }}>
                      {mangaDetail.cover
                        ? <img src={proxyImg(mangaDetail.cover)} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt={mangaDetail.title}/>
                        : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}><BookOpen size={40} style={{ color:'var(--muted)', opacity:0.4 }}/></div>
                      }
                    </div>
                    <div style={{ flex:1, minWidth:240, paddingTop:4 }}>
                      <h1 style={{ fontFamily:"'Segoe UI Variable Display','Segoe UI Variable','Segoe UI',system-ui,-apple-system,sans-serif", fontWeight:800, fontSize:'clamp(22px,3vw,30px)', lineHeight:1.2, marginBottom:8 }}>{mangaDetail.title}</h1>
                      {mangaDetail.author && <p style={{ color:'var(--accent)', fontSize:14, marginBottom:14, fontWeight:500 }}>{mangaDetail.author}</p>}
                      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
                        {mangaDetail.status && <Badge variant={mangaDetail.status==='ongoing'?'success':'outline'}>{mangaDetail.status}</Badge>}
                        <Badge variant="outline">{mangaDetail.totalChapters} chapters</Badge>
                        {inLibrary(mangaDetail.id) && <Badge variant="default" size="sm">In Library</Badge>}
                      </div>
                      {mangaDetail.tags?.length > 0 && (
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:18 }}>
                          {mangaDetail.tags.map(t => (
                            <button key={t} onClick={() => handleTagClick(t, activeSource?.id)}
                              style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:20, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)', color:'#94a3b8', fontSize:11, fontWeight:600, cursor:'pointer', transition:'all 0.15s' }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.color='var(--accent)'; e.currentTarget.style.background='rgba(249,115,22,0.08)'; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.1)'; e.currentTarget.style.color='#94a3b8'; e.currentTarget.style.background='rgba(255,255,255,0.05)'; }}
                            ><Tag size={9}/>{t}</button>
                          ))}
                        </div>
                      )}
                      <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                        {mangaDetail.chapters?.length > 0 && (
                          <Btn onClick={() => {
                            const last = progress[mangaDetail.id];
                            const ch = last ? mangaDetail.chapters.find(c=>c.id===last.chapterId)||mangaDetail.chapters[mangaDetail.chapters.length-1] : mangaDetail.chapters[mangaDetail.chapters.length-1];
                            openChapter(ch);
                          }} size="lg" icon={Play}>{progress[mangaDetail.id]?'Continue':'Start Reading'}</Btn>
                        )}
                        <Btn variant={inLibrary(mangaDetail.id)?'default':'outline'} onClick={() => toggleLibrary(mangaDetail, activeSource?.id)} icon={Heart}>
                          {inLibrary(mangaDetail.id)?'In Library':'Add to Library'}
                        </Btn>
                      </div>
                    </div>
                  </div>

                  {mangaDetail.description && (
                    <div style={{ marginBottom:24, padding:'18px 22px', background:'var(--card)', borderRadius:16, border:'1.5px solid var(--border)', position:'relative', overflow:'hidden' }}>
                      <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,var(--accent),transparent)' }}/>
                      <p style={{ color:'var(--text-dim)', fontSize:14, lineHeight:1.8 }}>{mangaDetail.description}</p>
                    </div>
                  )}

                  {readingTime[mangaDetail.id] > 0 && (
                    <div style={{ marginBottom:20, padding:'12px 16px', background:'var(--card)', borderRadius:12, border:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10 }}>
                      <Clock size={16} style={{ color:'var(--accent)', flexShrink:0 }}/>
                      <span style={{ fontSize:13, color:'var(--text-dim)' }}>
                        Reading time: <strong>{Math.floor(readingTime[mangaDetail.id]/3600)}h {Math.floor((readingTime[mangaDetail.id]%3600)/60)}m</strong>
                      </span>
                    </div>
                  )}

                  {/* Chapters */}
                  <div>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, flexWrap:'wrap', gap:10 }}>
                      <h3 style={{ fontFamily:"'Segoe UI Variable Display','Segoe UI Variable','Segoe UI',system-ui,-apple-system,sans-serif", fontWeight:700, fontSize:18, display:'flex', alignItems:'center', gap:8 }}>
                        Chapters <Badge variant="outline" size="sm">{filteredChapters.length}</Badge>
                      </h3>
                      <div style={{ display:'flex', gap:8 }}>
                        <Btn variant="outline" size="sm" onClick={() => {
                          const unread = mangaDetail.chapters.filter(ch => !ch.read && !(readChapters[mangaDetail.id]?.includes(String(ch.id))));
                          if (!unread.length) { toast('No unread chapters to download', 'warning'); return; }
                          queueChaptersForDownload(unread, mangaDetail.id, mangaDetail.title, activeSource?.id);
                        }} icon={EyeOff} title="Download unread chapters only">Unread</Btn>
                        <Btn variant="outline" size="sm" onClick={() => queueChaptersForDownload(mangaDetail.chapters, mangaDetail.id, mangaDetail.title, activeSource?.id)} icon={Archive}>All</Btn>
                        <Btn variant="ghost" size="sm" onClick={() => setChapterSort(s=>s==='desc'?'asc':'desc')} icon={chapterSort==='desc'?ChevronDown:ChevronUp}>
                          {chapterSort==='desc'?'Newest':'Oldest'}
                        </Btn>
                      </div>
                    </div>

                    {mangaDetail.chapters.length > 15 && (
                      <div style={{ position:'relative', marginBottom:14 }}>
                        <Search size={15} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--muted)', pointerEvents:'none'}}/>
                        <input placeholder="Search chapters..." value={chapSearch} onChange={e=>setChapSearch(e.target.value)}
                          style={{ width:'100%', background:'var(--card)', border:'1.5px solid var(--border)', borderRadius:12, padding:'11px 14px 11px 40px', color:'var(--text)', fontSize:13, outline:'none', fontFamily:'system-ui,-apple-system,Segoe UI,sans-serif' }}
                          onFocus={e=>e.target.style.borderColor='var(--accent)'} onBlur={e=>e.target.style.borderColor='var(--border)'}/>
                      </div>
                    )}

                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {filteredChapters.map((ch, i) => {
                        const isCurrent    = progress[mangaDetail.id]?.chapterId === ch.id;
                        const isRead       = ch.read || !!(readChapters[mangaDetail.id]?.includes(String(ch.id)));
                        const isDownloaded = downloadedKeys.has(`${mangaDetail.id}__${ch.id}`);
                        return (
                          <div key={ch.id}
                            className={`anim-fadeInUp delay-${Math.min(i,14)}`}
                            onClick={() => openChapter(ch)}
                            onContextMenu={(e) => handleChapterContextMenu(e, ch)}
                            style={{
                              display:'flex', alignItems:'center', justifyContent:'space-between',
                              padding:'13px 16px', borderRadius:12, cursor:'pointer',
                              background: isCurrent ? 'rgba(249,115,22,0.1)' : isRead ? 'rgba(34,197,94,0.04)' : 'var(--card)',
                              border: `1.5px solid ${isCurrent ? 'var(--accent)' : isDownloaded ? 'rgba(59,130,246,0.5)' : isRead ? 'rgba(34,197,94,0.2)' : 'var(--border)'}`,
                              transition:'all 0.2s', position:'relative', overflow:'hidden',
                            }}
                            onMouseEnter={e=>{if(!isCurrent){e.currentTarget.style.borderColor=isDownloaded?'rgba(59,130,246,0.85)':'var(--border-hover)';e.currentTarget.style.transform='translateX(3px)';}}}
                            onMouseLeave={e=>{e.currentTarget.style.borderColor=isCurrent?'var(--accent)':isDownloaded?'rgba(59,130,246,0.5)':isRead?'rgba(34,197,94,0.2)':'var(--border)';e.currentTarget.style.transform='';}}>
                            {isCurrent    && <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3, background:'var(--accent)' }}/>}
                            {isDownloaded && !isCurrent && <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3, background:'#3b82f6', boxShadow:'0 0 8px #3b82f680' }}/>}
                            <div style={{ flex:1, minWidth:0, marginLeft:(isCurrent||isDownloaded)?8:0 }}>
                              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                                <p style={{ fontWeight:600, fontSize:14, color:isCurrent?'var(--accent)':isRead?'var(--muted)':'var(--text)', textDecoration:isRead?'line-through':'none', opacity:isRead?0.6:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                  Ch. {ch.number}{ch.title&&ch.title!==`Chapter ${ch.number}`&&` — ${ch.title}`}
                                </p>
                                {isRead && <Check size={13} style={{ color:'#4ade80', flexShrink:0 }}/>}
                                {isDownloaded && <span style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', color:'#60a5fa', background:'rgba(59,130,246,0.12)', border:'1px solid rgba(59,130,246,0.25)', borderRadius:4, padding:'1px 5px', flexShrink:0 }}>offline</span>}
                              </div>
                              <div style={{ display:'flex', gap:14, flexWrap:'wrap' }}>
                                {ch.date && <span style={{ fontSize:11, color:'var(--muted)', display:'flex', alignItems:'center', gap:3 }}><Calendar size={10}/>{ch.date}</span>}
                                {ch.group && <span style={{ fontSize:11, color:'var(--muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:180 }}>{ch.group}</span>}
                              </div>
                            </div>
                            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                              {isDownloaded && (
                                <Btn variant="ghost" size="icon" onClick={e => { e.stopPropagation(); deleteChapterBlobs(mangaDetail.id, ch.id).then(refreshDownloads); toast('Offline copy removed', 'warning'); }} style={{ padding:4, borderRadius:8, color:'#60a5fa' }} title="Remove offline copy">
                                  <Trash2 size={13}/>
                                </Btn>
                              )}
                              <Btn variant="ghost" size="icon" onClick={e => { e.stopPropagation(); handleDownload(ch); }} style={{ padding:4, borderRadius:8, color:isDownloaded?'#60a5fa':undefined }} title={isDownloaded?'Re-download':'Save for offline'}>
                                <Download size={14}/>
                              </Btn>
                              <ChevronRight size={16} style={{ color:isCurrent?'var(--accent)':'var(--muted)' }}/>
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
        {tab === 'browse' && (
          <div className="page-transition">
            {view === 'tabs' ? (
              installedSources.length === 0 ? (
                <EmptyState icon={Globe} title="No sources installed" sub="Install extensions to start browsing" action={<Btn onClick={() => switchTab('extensions')}>Browse Extensions <ArrowRight size={16}/></Btn>}/>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(170px,1fr))', gap:18 }}>
                  {installedSources.map((src, i) => (
                    <button key={src.id} className={`card-hover anim-fadeInUp delay-${Math.min(i,10)}`} onClick={() => enterSource(src)} style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'24px 16px', background:'var(--card)', border:'1.5px solid var(--border)', borderRadius:20, cursor:'pointer', gap:14, textAlign:'center', position:'relative', overflow:'hidden' }}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--border-hover)';}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';}}>
                      <div style={{ width:60, height:60, background:'var(--card2)', borderRadius:18, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', border:'1.5px solid var(--border)' }}>
                        {src.icon ? <img src={src.icon} style={{ width:'100%', height:'100%', objectFit:'contain', padding:10 }} onError={e=>e.target.style.display='none'} alt="" loading="lazy"/> : <Globe size={26} style={{ color:'var(--muted)' }}/>}
                      </div>
                      <div>
                        <p style={{ fontFamily:"'Segoe UI Variable Display','Segoe UI Variable','Segoe UI',system-ui,-apple-system,sans-serif", fontWeight:700, fontSize:15, color:'var(--text)', marginBottom:6 }}>{src.name}</p>
                        {src.lang && <Badge variant="outline" size="sm">{src.lang}</Badge>}
                      </div>
                    </button>
                  ))}
                </div>
              )
            ) : view === 'source' ? (
              <>
                {/* ── FILTER BAR ── */}
                {showFilterBar && (
                  <BrowseFilterBar
                    filters={browseFilters}
                    onChange={handleFilterChange}
                    onClear={handleFilterClear}
                    activeCount={activeFilterCount}
                  />
                )}

                {browseLoading && results.length === 0 ? (
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'100px 24px', gap:20 }}>
                    <Spin size={40}/><p style={{ fontSize:12, color:'var(--muted)' }}>{query ? 'Searching...' : 'Loading...'}</p>
                  </div>
                ) : browseError ? (
                  <EmptyState icon={AlertTriangle} title={browseError} action={<Btn onClick={() => doSearch(query, activeSource, browsePage, false, browseFilters)}>Retry</Btn>}/>
                ) : (
                  <>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:18 }}>
                      {results.map((m, i) => <MangaCard key={m.id} manga={m} onClick={openManga} index={i} onContextMenu={handleMangaContextMenu}/>)}
                    </div>
                    {results.length === 0 && !browseLoading && (
                      <EmptyState icon={Search} title="No results" sub="Try adjusting your filters or search query" compact
                        action={activeFilterCount > 0 && <Btn variant="outline" size="sm" onClick={handleFilterClear}><X size={14}/> Clear Filters</Btn>}
                      />
                    )}
                    {hasNextPage && <div ref={sentinelRef} style={{ height:20, margin:'20px 0' }}/>}
                    {loadingMore && (
                      <div style={{ display:'flex', justifyContent:'center', padding:'20px' }}>
                        <Spin size={24}/>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : null}
          </div>
        )}

        {tab === 'extensions' && (
          <div className="page-transition">
            <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
              <div style={{ position:'relative', flex:1, minWidth:220 }}>
                <Search size={15} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--muted)', pointerEvents:'none' }}/>
                <input placeholder="Search extensions by name..." value={extSearch} onChange={e => setExtSearch(e.target.value)} style={{ width:'100%', background:'var(--card)', border:'1.5px solid var(--border)', borderRadius:12, padding:'11px 14px 11px 40px', color:'var(--text)', fontSize:13, outline:'none' }} onFocus={e => e.target.style.borderColor='var(--accent)'} onBlur={e => e.target.style.borderColor='var(--border)'}/>
              </div>
              <select value={extLang} onChange={e => setExtLang(e.target.value)} style={{ background:'var(--card)', border:'1.5px solid var(--border)', borderRadius:12, padding:'11px 14px', color:'var(--text)', fontSize:13, outline:'none', cursor:'pointer', minWidth:130 }}>
                {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
              <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--card)', border:'1.5px solid var(--border)', borderRadius:12, padding:'0 12px' }}>
                <span style={{ fontSize:13, color:'var(--text-dim)' }}>NSFW</span>
                <button onClick={() => setShowNsfw(prev => !prev)} style={{ width:40, height:22, borderRadius:11, background:showNsfw?'var(--accent)':'rgba(255,255,255,0.15)', border:'none', cursor:'pointer', position:'relative', transition:'background 0.2s' }}>
                  <div style={{ position:'absolute', top:2, left:showNsfw?20:2, width:18, height:18, borderRadius:'50%', background:'#fff', transition:'left 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.3)' }}/>
                </button>
              </div>
              <div style={{ display:'flex', background:'var(--card)', borderRadius:12, border:'1.5px solid var(--border)', overflow:'hidden' }}>
                {[['all','All'],['installed','Installed']].map(([v,l]) => (
                  <button key={v} onClick={() => setExtTab(v)} style={{ padding:'11px 18px', border:'none', background:extTab===v?'var(--accent)':'transparent', color:extTab===v?'#fff':'var(--muted)', fontWeight:600, fontSize:13, cursor:'pointer', transition:'all 0.2s' }}>{l}</button>
                ))}
              </div>
              <select value={extSort} onChange={e => setExtSort(e.target.value)} style={{ background:'var(--card)', border:'1.5px solid var(--border)', borderRadius:12, padding:'11px 14px', color:'var(--text)', fontSize:13, outline:'none', cursor:'pointer', minWidth:140 }}>
                <option value="name">Sort by Name</option>
                <option value="version">Sort by Version</option>
                <option value="installed">Installed First</option>
              </select>
              <Btn variant="outline" onClick={() => { fetchExtensions(); fetchSources(); }}>
                <RefreshCw size={15}/> Refresh
              </Btn>
            </div>

            {filteredExts.length === 0 ? (
              <EmptyState icon={Puzzle} title="No extensions found" sub="Try adjusting your filters"/>
            ) : (
              <>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {filteredExts.slice(0, extDisplayCount).map((ext, i) => (
                    <div key={ext.pkgName} className={`anim-fadeInUp delay-${Math.min(i,10)}`}>
                      <ExtCard ext={ext} onInstall={installExt} onUninstall={uninstallExt} onUpdate={updateExt} installing={installing}/>
                    </div>
                  ))}
                </div>
                {extDisplayCount < filteredExts.length && <div ref={extSentinelRef} style={{ height:20, margin:'20px 0' }}/>}
              </>
            )}
          </div>
        )}

        {tab === 'library' && (
          <div className="page-transition">
            {/* Category pills */}
            <div style={{ display:'flex', gap:8, marginBottom:16, overflowX:'auto', paddingBottom:4 }}>
              <button onClick={() => setActiveCategory('all')} style={{ padding:'9px 18px', borderRadius:20, border:'none', background:activeCategory==='all'?'var(--accent)':'var(--card)', color:activeCategory==='all'?'#fff':'var(--text-dim)', fontWeight:600, fontSize:13, cursor:'pointer', whiteSpace:'nowrap', boxShadow:activeCategory==='all'?'0 4px 16px rgba(249,115,22,0.3)':'none', transition:'all 0.2s' }}>All ({library.length})</button>
              {CATEGORIES.map(cat => {
                const count = library.filter(m => mangaCategories[m.id] === cat.id).length;
                return <button key={cat.id} onClick={() => setActiveCategory(cat.id)} style={{ padding:'9px 18px', borderRadius:20, border:'none', background:activeCategory===cat.id?cat.color:'var(--card)', color:activeCategory===cat.id?'#fff':'var(--text-dim)', fontWeight:600, fontSize:13, cursor:'pointer', whiteSpace:'nowrap', opacity:count===0?0.5:1, boxShadow:activeCategory===cat.id?`0 4px 16px ${cat.color}40`:'none', transition:'all 0.2s' }}>{cat.name} ({count})</button>;
              })}
            </div>

            {/* Search + view toggle row */}
            <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:18 }}>
              <div style={{ position:'relative', flex:1 }}>
                <Search size={15} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--muted)', pointerEvents:'none' }}/>
                <input
                  placeholder="Search library by title or author..."
                  value={librarySearch}
                  onChange={e => setLibrarySearch(e.target.value)}
                  style={{ width:'100%', background:'var(--card)', border:'1.5px solid var(--border)', borderRadius:12, padding:'10px 36px 10px 40px', color:'var(--text)', fontSize:13, outline:'none', transition:'border-color 0.2s' }}
                  onFocus={e => e.target.style.borderColor='var(--accent)'}
                  onBlur={e => e.target.style.borderColor='var(--border)'}
                />
                {librarySearch && (
                  <button onClick={() => setLibrarySearch('')} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--muted)', padding:4, borderRadius:6 }}><X size={14}/></button>
                )}
              </div>
              <div style={{ display:'flex', gap:4 }}>
                {[['grid',<LayoutGrid size={17}/>],['list',<List size={17}/>],['compact',<Columns size={17}/>]].map(([m, icon]) => (
                  <Btn key={m} variant={libraryView===m?'default':'ghost'} size="icon" onClick={() => setLibraryView(m)}>{icon}</Btn>
                ))}
              </div>
            </div>

            {filteredLibrary.length === 0 ? (
              librarySearch
                ? <EmptyState icon={Search} title={`No results for "${librarySearch}"`} sub="Try a different search term" compact action={<Btn variant="outline" size="sm" onClick={() => setLibrarySearch('')}><X size={14}/> Clear</Btn>}/>
                : <EmptyState icon={Library} title={activeCategory==='all'?"Your library is empty":`No manga in ${CATEGORIES.find(c=>c.id===activeCategory)?.name}`} sub={activeCategory==='all'?"Add manga from Browse to start":"Move manga to this category from context menu"} action={activeCategory==='all'&&<Btn onClick={() => switchTab('browse')}>Browse Manga <ArrowRight size={16}/></Btn>}/>
            ) : libraryView === 'list' ? (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {filteredLibrary.map((m, i) => (
                  <MangaListCard key={m.id} manga={m} onClick={openManga} index={i} category={mangaCategories[m.id]} progress={progress[m.id]?Math.round((parseInt(progress[m.id].chapterNum)||(m.totalChapters||100))/Math.max(m.totalChapters||1,1)*100):0} onContextMenu={handleMangaContextMenu}/>
                ))}
              </div>
            ) : libraryView === 'compact' ? (
              /* Compact = dense table-like rows with less whitespace */
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {filteredLibrary.map((m, i) => {
                  const cat = CATEGORIES.find(c => c.id === mangaCategories[m.id]);
                  const prog = progress[m.id];
                  return (
                    <div key={m.id} onClick={() => openManga(m)} onContextMenu={e => handleMangaContextMenu(e, m)}
                      style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 12px', borderRadius:9, background:'var(--card)', border:'1px solid var(--border)', cursor:'pointer', transition:'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor='var(--border-hover)'; e.currentTarget.style.background='var(--card-hover)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.background='var(--card)'; }}
                    >
                      <div style={{ width:32, height:44, borderRadius:6, overflow:'hidden', flexShrink:0, background:'var(--card2)', border:'1px solid var(--border)' }}>
                        {m.cover ? <img src={proxyImg(m.cover)} style={{ width:'100%', height:'100%', objectFit:'cover' }} loading="lazy" alt=""/> : <BookOpen size={14} style={{ color:'var(--muted)', opacity:.4, margin:'auto', display:'block', marginTop:14 }}/>}
                      </div>
                      {cat && <div style={{ width:3, height:32, borderRadius:2, background:cat.color, flexShrink:0 }}/>}
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontWeight:600, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.title}</p>
                        {m.author && <p style={{ fontSize:11, color:'var(--muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.author}</p>}
                      </div>
                      {prog && <span style={{ fontSize:11, color:'var(--muted)', flexShrink:0 }}>Ch.{prog.chapterNum}</span>}
                      <ChevronRight size={14} style={{ color:'var(--muted)', flexShrink:0 }}/>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:18 }}>
                {filteredLibrary.map((m, i) => <MangaCard key={m.id} manga={m} onClick={openManga} index={i} category={mangaCategories[m.id]} progress={progress[m.id]?Math.round((parseInt(progress[m.id].chapterNum)||(m.totalChapters||100))/Math.max(m.totalChapters||1,1)*100):0} onContextMenu={handleMangaContextMenu}/>)}
              </div>
            )}
          </div>
        )}

        {tab === 'history' && (
          <div className="page-transition">
            <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:18 }}>
              {history.length > 0 && <Btn variant="danger" onClick={() => { if (confirm('Clear all history?')) history.forEach(m => removeFromHistory(m.id)); }}><Trash2 size={15}/> Clear All</Btn>}
            </div>
            {history.length === 0 ? <EmptyState icon={Clock} title="No history" sub="Manga you read will appear here"/> : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:18 }}>
                {history.map((m, i) => (
                  <div key={m.id} style={{ position:'relative' }}>
                    <MangaCard manga={m} onClick={openManga} index={i} badge={m.lastRead?new Date(m.lastRead).toLocaleDateString():null}/>
                    <Btn variant="ghost" size="icon" onClick={e => { e.stopPropagation(); removeFromHistory(m.id); }} style={{ position:'absolute', top:36, right:6, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', width:28, height:28, borderRadius:8 }}><X size={12}/></Btn>
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
          onRetry={id => setDownloadQueue(prev => prev.map(d => d.id === id ? {...d, status:'pending', progress:0, pagesLoaded:0, pagesTotal:0, error:null} : d))}
          onCancel={id => {
            setDownloadQueue(prev => prev.map(d => {
              if (d.id !== id) return d;
              if (d.status === 'downloading') { dlCancelRef.current = true; return { ...d, status: 'cancelled' }; }
              if (d.status === 'pending') return { ...d, status: 'cancelled' };
              return d;
            }));
          }}
          onCancelAll={() => {
            dlCancelRef.current = true;
            setDownloadQueue(prev => prev.map(d =>
              (d.status === 'pending' || d.status === 'downloading') ? { ...d, status: 'cancelled' } : d
            ));
          }}
        />}
        {tab === 'settings' && <SettingsPage />}
        </>}
        </div>{/* end page content */}
      </main>
    </>
  );
});

// ==================== ROOT ====================

const RootInner = () => {
  const { settings } = useData();
  return (
    <>
      <GlobalStyles appTheme={settings?.appTheme || 'dark'}/>
      <App/>
    </>
  );
};

const Root = () => (
  <ErrorBoundary>
    <ToastProvider>
      <DataProvider>
        <RootInner/>
      </DataProvider>
    </ToastProvider>
  </ErrorBoundary>
);

export default Root;