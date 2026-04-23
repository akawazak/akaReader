import React, { createContext, useContext, useState, useRef, useCallback, useEffect, useMemo, memo } from 'react';
import { useToast } from './ToastContext';
import { storage, proxyImg } from '../utils/helpers';
import { CONFIG, CATEGORIES } from '../constants';

export const DataContext = createContext(null);

export const DataProvider = memo(({ children }) => {
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

  const toast = useToast();
  const toastRef = useRef(null);
  toastRef.current = toast;
  
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
      if (d.ok && d.suwayomi !== undefined) setSuwayomiReady(d.suwayomi);
    }
  catch {
    if (backendOnlineRef.current !== null) setBackendOnline(false);
  }
}, [fetchJSON, setBackendOnline]);

  const fetchSources = useCallback(async () => {
    try {
      const data = await fetchJSON('/sources');
      if (!Array.isArray(data)) return;
      const map = {};
      data.forEach(s => { map[String(s.id)] = { id: String(s.id), name: s.displayName || s.name, lang: s.lang, icon: proxyImg(s.icon || s.iconUrl || null) }; });
      if (JSON.stringify(map) !== JSON.stringify(sourcesRef.current)) { sourcesRef.current = map; setSources(map); }
    } catch { }
  }, [fetchJSON]);

  const fetchExtensions = useCallback(async () => {
    try {
      const data = await fetchJSON('/extensions');
      if (!Array.isArray(data)) return [];
      const normalized = data.map(e => ({
        ...e,
        pkgName: e.pkgName || e.id,
        isInstalled: e.isInstalled ?? e.installed ?? false,
        isNsfw: e.isNsfw ?? e.nsfw ?? false,
        versionName: e.versionName || e.version || '1.0.0',
        versionCode: e.versionCode || 1,
        hasUpdate: e.hasUpdate ?? false,
        iconUrl: proxyImg(e.iconUrl || null),
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

  const knownTotalsRef = useRef({});
  const updateToastedRef = useRef(false);
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
  }, [library, sources, fetchJSON, progress]);

  useEffect(() => {
    if (library.length > 0 && backendOnline) {
      checkForUpdates();
      const interval = setInterval(checkForUpdates, CONFIG.UPDATE_INTERVAL);
      return () => clearInterval(interval);
    }
  }, [library, backendOnline, checkForUpdates]);

  useEffect(() => {
    fetchSources(); fetchExtensions();
    checkHealth();
    const fastPoll = setInterval(() => {
      if (backendOnlineRef.current === null) checkHealth();
      else clearInterval(fastPoll);
    }, 1000);
    const slowPoll = setInterval(checkHealth, 30000);
    return () => { clearInterval(fastPoll); clearInterval(slowPoll); };
  }, [checkHealth, fetchSources, fetchExtensions]);

  const value = useMemo(() => ({
    backendOnline, sources, extensions, library, history, progress,
    mangaCategories, installing, readingTime, settings, updates, checkingUpdates,
    readChapters, suwayomiReady, setSuwayomiReady,
    fetchJSON, checkHealth, fetchSources, fetchExtensions,
    installExt, uninstallExt, updateExt,
    toggleLibrary, setCategory, addToHistory, removeFromHistory,
    updateProgress, markChapterRead, addReadingTime, updateSetting, checkForUpdates,
    inLibrary: (id) => library.some(m => m.id === id)
  }), [backendOnline, sources, extensions, library, history, progress, mangaCategories, installing, readingTime, settings, updates, checkingUpdates, readChapters, suwayomiReady, setSuwayomiReady, fetchJSON, checkHealth, fetchSources, fetchExtensions, installExt, uninstallExt, updateExt, toggleLibrary, setCategory, addToHistory, removeFromHistory, updateProgress, markChapterRead, addReadingTime, updateSetting, checkForUpdates]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
});

export const useData = () => useContext(DataContext);
