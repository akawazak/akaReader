import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Library, BellRing, Compass, History as HistoryIcon, MoreHorizontal, Search, SlidersHorizontal, X,
  ChevronLeft, ChevronRight, Play, Heart, Download, Check, Globe, RefreshCw, Trash2, BookOpen,
  Puzzle, Settings, Info, Eye, EyeOff, ArrowDownUp, Bookmark, HardDrive, AlertTriangle, ImageOff,
} from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { proxyImg, timeAgo, calculateStreak } from '../utils/helpers';
import { calculateMangaProgressPercent, resolveContinueTarget } from '../utils/readerProgress.mjs';
import { countReadChapterIds } from '../utils/chapterTracking.mjs';
import { summarizeDownloadedChapters } from '../utils/downloadStorage.mjs';
import { describeSourceError, isSourceVerificationError } from '../utils/sourceErrors.mjs';
import MobileSettings from './MobileSettings';
import './mobile.css';

/*
 * Phone shell for the Android app. All state and behavior (browsing, details, reading,
 * downloads, Cloudflare recovery) stays in App.jsx and DataProvider; this file only lays
 * it out for a phone: cover-grid library, floating tab bar, full-bleed manga page.
 */

const LONG_PRESS_MS = 450;
const EXT_PAGE = 60;

const useLongPress = (onLongPress, onClick) => {
  const timer = useRef(null);
  const fired = useRef(false);
  const start = useRef(null);
  const clear = () => { clearTimeout(timer.current); timer.current = null; };
  return {
    onPointerDown: (e) => {
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      clear();
      timer.current = setTimeout(() => { fired.current = true; navigator.vibrate?.(12); onLongPress?.(); }, LONG_PRESS_MS);
    },
    onPointerMove: (e) => {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onContextMenu: (e) => e.preventDefault(),
    onClick: (e) => { if (fired.current) { e.preventDefault(); return; } onClick?.(e); },
  };
};

const formatBytes = (bytes) => {
  if (!bytes) return '0 MB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

const dayLabel = (ts) => {
  if (!ts) return 'Earlier';
  const d = new Date(ts); d.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((today - d) / 86400000);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return 'This week';
  return 'Earlier';
};

const groupByDay = (items, getTs) => {
  const groups = [];
  items.forEach(item => {
    const label = dayLabel(getTs(item));
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  });
  return groups;
};

// ── Small building blocks ──────────────────────────────────────────────────

const CoverImg = memo(({ src, className, alt = '' }) => {
  const [failed, setFailed] = useState(false);
  const url = src ? proxyImg(src) : null;
  if (!url || failed) return <div className={`noimg ${className || ''}`}><ImageOff size={20} /></div>;
  return <img className={className} src={url} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} draggable={false} />;
});

const CoverTile = memo(({ manga, badge, percent, onOpen, onLongPress }) => {
  const press = useLongPress(onLongPress, onOpen);
  return (
    <button className="m-cover m-press" {...press}>
      <CoverImg src={manga.cover} />
      {badge ? <span className="m-badge">{badge}</span> : null}
      <div className="shade" />
      <p>{manga.title}</p>
      {percent != null && <div className="bar"><i style={{ width: `${percent}%` }} /></div>}
    </button>
  );
});

const Sheet = memo(({ title, items, onClose }) => (
  <>
    <div className="m-scrim" onClick={onClose} />
    <div className="m-sheet" role="dialog">
      <div className="grab" />
      {title && <h4 className="m-ellipsis">{title}</h4>}
      {items.filter(Boolean).map((item, i) => (
        <button key={i} className={`item ${item.on ? 'on' : ''}`} onClick={() => { onClose(); item.action(); }}>
          {item.icon && <item.icon size={20} />}<span>{item.label}</span>
        </button>
      ))}
    </div>
  </>
));

const Empty = ({ icon: Icon, title, text, children }) => (
  <div className="m-empty">
    <div className="ico"><Icon size={28} /></div>
    <h3>{title}</h3>
    {text && <p>{text}</p>}
    {children}
  </div>
);

const SkeletonGrid = ({ count = 9 }) => (
  <div className="m-grid">
    {Array.from({ length: count }, (_, i) => <div key={i} className="m-skel" style={{ aspectRatio: '2 / 3' }} />)}
  </div>
);

const SourceFailure = ({ error, onRetry, onVerify, verifying }) => {
  const failure = describeSourceError(error, 'source');
  const verification = failure.kind === 'verification' || isSourceVerificationError(error);
  return (
    <Empty icon={AlertTriangle} title={verification ? 'Source needs a quick check' : 'Could not load'} text={failure.message}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {verification && onVerify && (
          <button className="m-btn" disabled={verifying} onClick={onVerify}><Globe size={17} />{verifying ? 'Verifying…' : 'Verify manually'}</button>
        )}
        {onRetry && <button className={`m-btn ${verification ? 'quiet' : ''}`} onClick={onRetry}><RefreshCw size={17} />Retry</button>}
      </div>
    </Empty>
  );
};

// ── Floating tab bar ──────────────────────────────────────────────────────

const NAV = [
  { id: 'library', label: 'Library', Icon: Library },
  { id: 'updates', label: 'Updates', Icon: BellRing },
  { id: 'browse', label: 'Browse', Icon: Compass },
  { id: 'history', label: 'History', Icon: HistoryIcon },
  { id: 'more', label: 'More', Icon: MoreHorizontal },
];

const BottomNav = memo(({ tab, onSelect, badges }) => (
  <nav className="m-nav">
    {NAV.map(({ id, label, Icon }) => (
      <button key={id} className={tab === id ? 'on' : ''} onClick={() => onSelect(id)} aria-label={label}>
        <Icon size={21} />
        {tab === id && <span>{label}</span>}
        {badges[id] ? <span className="dot">{badges[id] > 99 ? '99+' : badges[id]}</span> : null}
      </button>
    ))}
  </nav>
));

// ── Library ───────────────────────────────────────────────────────────────

const LIBRARY_SORTS = [
  { id: 'recent', label: 'Last read' },
  { id: 'added', label: 'Date added' },
  { id: 'alpha', label: 'Title' },
  { id: 'unread', label: 'Most new chapters' },
];

const LibraryScreen = memo(({ app, onSheet }) => {
  const { library, categories, mangaCategories, progress, history, updates, getMangaKey, toggleLibrary, setCategory } = useData();
  const [category, setCategoryFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [sort, setSort] = useState('recent');

  const newByKey = useMemo(() => new Map(updates.map(u => [getMangaKey(u.id, u.sourceId), u.newChapters || 0])), [updates, getMangaKey]);
  const historyByKey = useMemo(() => new Map(history.map(h => [getMangaKey(h.id, h.sourceId), h])), [history, getMangaKey]);

  const counts = useMemo(() => {
    const map = {};
    library.forEach(m => {
      const cat = mangaCategories[getMangaKey(m.id, m.sourceId)];
      if (cat) map[cat] = (map[cat] || 0) + 1;
    });
    return map;
  }, [library, mangaCategories, getMangaKey]);

  const items = useMemo(() => {
    let list = category === 'all' ? library : library.filter(m => mangaCategories[getMangaKey(m.id, m.sourceId)] === category);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(m => m.title?.toLowerCase().includes(q));
    }
    const lastRead = m => progress[getMangaKey(m.id, m.sourceId)]?.lastRead || historyByKey.get(getMangaKey(m.id, m.sourceId))?.lastRead || 0;
    const sorted = [...list];
    if (sort === 'recent') sorted.sort((a, b) => lastRead(b) - lastRead(a) || (b.addedAt || 0) - (a.addedAt || 0));
    if (sort === 'added') sorted.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    if (sort === 'alpha') sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    if (sort === 'unread') sorted.sort((a, b) => (newByKey.get(getMangaKey(b.id, b.sourceId)) || 0) - (newByKey.get(getMangaKey(a.id, a.sourceId)) || 0));
    return sorted;
  }, [library, category, mangaCategories, getMangaKey, query, sort, progress, historyByKey, newByKey]);

  const openActions = useCallback((m) => {
    const key = getMangaKey(m.id, m.sourceId);
    onSheet({
      title: m.title,
      items: [
        { label: 'Open', icon: BookOpen, action: () => app.openManga(m, m.sourceId) },
        { label: 'Continue reading', icon: Play, action: () => app.handleContinueReading(m) },
        ...categories.map(cat => ({
          label: cat.name, icon: Bookmark, on: mangaCategories[key] === cat.id,
          action: () => setCategory(m.id, cat.id, m.sourceId),
        })),
        { label: 'Remove from library', icon: Trash2, action: () => toggleLibrary(m, m.sourceId) },
      ],
    });
  }, [app, categories, mangaCategories, getMangaKey, onSheet, setCategory, toggleLibrary]);

  return (
    <div className="m-page">
      <header className="m-bar">
        {searching ? (
          <div className="m-search">
            <Search size={17} />
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search library" />
            <button className="m-icon-btn" style={{ width: 30, height: 30 }} onClick={() => { setQuery(''); setSearching(false); }}><X size={17} /></button>
          </div>
        ) : (
          <>
            <h1>Library</h1>
            <button className="m-icon-btn" onClick={() => setSearching(true)} aria-label="Search library"><Search size={21} /></button>
            <button className="m-icon-btn" aria-label="Sort" onClick={() => onSheet({
              title: 'Sort library',
              items: LIBRARY_SORTS.map(s => ({ label: s.label, icon: ArrowDownUp, on: sort === s.id, action: () => setSort(s.id) })),
            })}><SlidersHorizontal size={21} /></button>
          </>
        )}
      </header>

      {library.length > 0 && (
        <div className="m-chips">
          <button className={`m-chip ${category === 'all' ? 'on' : ''}`} onClick={() => setCategoryFilter('all')}>All<b>{library.length}</b></button>
          {categories.filter(c => counts[c.id]).map(c => (
            <button key={c.id} className={`m-chip ${category === c.id ? 'on' : ''}`} onClick={() => setCategoryFilter(c.id)}>{c.name}<b>{counts[c.id]}</b></button>
          ))}
        </div>
      )}

      {library.length === 0 ? (
        <Empty icon={Library} title="Your library is empty" text="Find something to read in Browse, then tap the heart to keep it here.">
          <button className="m-btn" onClick={() => app.goBrowse(app.hasSources ? 'sources' : 'extensions')}>
            <Compass size={18} />{app.hasSources ? 'Browse sources' : 'Get extensions'}
          </button>
        </Empty>
      ) : items.length === 0 ? (
        <Empty icon={Search} title="Nothing here" text={query ? `No titles match “${query}”.` : 'No titles in this category yet.'} />
      ) : (
        <div className="m-grid">
          {items.map(m => {
            const key = getMangaKey(m.id, m.sourceId);
            const hist = historyByKey.get(key);
            const percent = calculateMangaProgressPercent({ totalChapters: m.totalChapters || hist?.totalChapters }, progress[key]);
            return (
              <CoverTile
                key={key}
                manga={m}
                badge={newByKey.get(key) || null}
                percent={percent}
                onOpen={() => app.openManga(m, m.sourceId)}
                onLongPress={() => openActions(m)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
});

// ── Updates ───────────────────────────────────────────────────────────────

const UpdatesScreen = memo(({ app }) => {
  const { updates, checkingUpdates, checkForUpdates, updateCheckSummary, library } = useData();
  const releases = useMemo(() => updates.flatMap(manga => {
    const details = manga.newChapterDetails?.length ? manga.newChapterDetails : (manga.newChapterIds || []).map(id => ({ id }));
    return details.map(chapter => ({ manga, chapter, ts: new Date(chapter.publishedAt || manga.latestReleaseAt || 0).getTime() || 0 }));
  }).sort((a, b) => b.ts - a.ts), [updates]);
  const groups = useMemo(() => groupByDay(releases, r => r.ts), [releases]);
  const checked = updateCheckSummary?.checkedAt ? `Checked ${timeAgo(updateCheckSummary.checkedAt)}` : '';

  return (
    <div className="m-page">
      <header className="m-bar">
        <h1>Updates</h1>
        <button className="m-icon-btn" disabled={checkingUpdates || !library.length} onClick={() => checkForUpdates({ notify: true })} aria-label="Check for new chapters">
          {checkingUpdates ? <div className="m-spin" /> : <RefreshCw size={21} />}
        </button>
      </header>
      {checked && <p className="m-dim m-sm" style={{ padding: '0 18px 4px', margin: 0 }}>{checked}</p>}
      {releases.length === 0 ? (
        <Empty icon={BellRing} title="No new chapters" text={library.length ? 'New chapters from titles in your library show up here.' : 'Add titles to your library to get notified about new chapters.'}>
          {library.length > 0 && <button className="m-btn quiet" disabled={checkingUpdates} onClick={() => checkForUpdates({ notify: true })}><RefreshCw size={17} />Check now</button>}
        </Empty>
      ) : groups.map(group => (
        <div key={group.label}>
          <div className="m-daylabel">{group.label}</div>
          {group.items.map(({ manga, chapter }) => (
            <button key={`${manga.sourceId}:${manga.id}:${chapter.id}`} className="m-row" onClick={() => app.openManga(manga, manga.sourceId)}>
              <CoverImg className="thumb" src={manga.cover} />
              <div className="meta">
                <b className="m-ellipsis">{manga.title}</b>
                <small className="m-mut m-ellipsis">{chapter.number ? `Ch. ${chapter.number}` : 'New chapter'}{chapter.title && chapter.title !== `Chapter ${chapter.number}` ? ` · ${chapter.title}` : ''}</small>
              </div>
              {chapter.publishedAt && <span className="m-dim m-sm">{timeAgo(new Date(chapter.publishedAt).getTime())}</span>}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
});

// ── History (with the Continue card) ──────────────────────────────────────

const HistoryScreen = memo(({ app, onSheet }) => {
  const { history, progress, getMangaKey, removeFromHistory } = useData();
  const withProgress = useMemo(() => history.map(m => ({ m, p: progress[getMangaKey(m.id, m.sourceId)] })), [history, progress, getMangaKey]);
  const hero = withProgress.find(x => x.p?.chapterId);
  const rest = withProgress.filter(x => x !== hero);
  const groups = useMemo(() => groupByDay(rest, x => x.p?.lastRead || x.m.lastRead), [rest]);

  const line = ({ m, p }) => p?.chapterId
    ? `Ch. ${p.chapterNum ?? '?'}${p.page ? ` · page ${p.page + 1}` : ''}`
    : (m.totalChapters ? `${m.totalChapters} chapters` : 'Not started');

  return (
    <div className="m-page">
      <header className="m-bar"><h1>History</h1></header>
      {history.length === 0 ? (
        <Empty icon={HistoryIcon} title="Nothing read yet" text="Titles you open show up here, so you can jump back in." />
      ) : (
        <>
          {hero && (() => {
            const percent = calculateMangaProgressPercent(hero.m, hero.p);
            return (
              <div className="m-hero">
                <div className="bg" style={{ backgroundImage: `url("${proxyImg(hero.m.cover)}")` }} />
                <CoverImg src={hero.m.cover} />
                <div className="info">
                  <span className="kicker">CONTINUE</span>
                  <h3>{hero.m.title}</h3>
                  <span className="m-mut m-sm">{line(hero)}</span>
                  {percent != null && <div className="bar"><i style={{ width: `${percent}%` }} /></div>}
                  <button className="m-btn m-press" onClick={() => app.handleContinueReading(hero.m)}><Play size={15} fill="currentColor" />Resume</button>
                </div>
              </div>
            );
          })()}
          {groups.map(group => (
            <div key={group.label}>
              <div className="m-daylabel">{group.label}</div>
              {group.items.map(item => (
                <HistoryRow key={`${item.m.sourceId}:${item.m.id}`} item={item} line={line(item)} app={app}
                  onLongPress={() => onSheet({
                    title: item.m.title,
                    items: [
                      { label: 'Continue reading', icon: Play, action: () => app.handleContinueReading(item.m) },
                      { label: 'Open details', icon: BookOpen, action: () => app.openManga(item.m, item.m.sourceId) },
                      { label: 'Remove from history', icon: Trash2, action: () => removeFromHistory(item.m.id, item.m.sourceId) },
                    ],
                  })} />
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
});

const HistoryRow = memo(({ item, line, app, onLongPress }) => {
  const press = useLongPress(onLongPress, () => app.handleContinueReading(item.m));
  const ts = item.p?.lastRead || item.m.lastRead;
  return (
    <button className="m-row" {...press}>
      <CoverImg className="thumb" src={item.m.cover} />
      <div className="meta">
        <b className="m-ellipsis">{item.m.title}</b>
        <small className="m-mut m-ellipsis">{line}{ts ? ` · ${timeAgo(ts)}` : ''}</small>
      </div>
      <Play size={18} className="m-acc" />
    </button>
  );
});

// ── Browse: sources & extensions ──────────────────────────────────────────

const BrowseScreen = memo(({ app, segment, setSegment }) => (
  <div className="m-page">
    <header className="m-bar"><h1>Browse</h1></header>
    <div className="m-seg" style={{ marginTop: 0 }}>
      <button className={segment === 'sources' ? 'on' : ''} onClick={() => setSegment('sources')}>Sources<b>{app.installedSources.length || ''}</b></button>
      <button className={segment === 'extensions' ? 'on' : ''} onClick={() => setSegment('extensions')}>Extensions{app.extensionUpdates ? <b>{app.extensionUpdates}</b> : null}</button>
    </div>
    {segment === 'sources' ? <SourcesList app={app} onGetExtensions={() => setSegment('extensions')} /> : <ExtensionsList app={app} />}
  </div>
));

const SourcesList = memo(({ app, onGetExtensions }) => {
  const [filter, setFilter] = useState('');
  const list = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? app.installedSources.filter(s => s.name?.toLowerCase().includes(q)) : app.installedSources;
  }, [app.installedSources, filter]);

  if (!app.installedSources.length) {
    return (
      <Empty icon={Puzzle} title="No sources yet" text="Sources come from extensions. Install one to start browsing manga.">
        <button className="m-btn" onClick={onGetExtensions}><Puzzle size={18} />Get extensions</button>
      </Empty>
    );
  }
  return (
    <>
      {app.installedSources.length > 6 && (
        <div style={{ padding: '4px 16px 8px' }}>
          <div className="m-search"><Search size={17} /><input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter sources" /></div>
        </div>
      )}
      {list.map(src => (
        <button key={src.id} className="m-row m-press" onClick={() => app.enterSource(src)}>
          {src.iconUrl || src.icon ? <CoverImg className="thumb" src={src.iconUrl || src.icon} /> : <div className="thumb" />}
          <div className="meta">
            <b className="m-ellipsis">{src.name}</b>
            <small className="m-dim">{src.variantCount > 3 ? `${src.variantCount} languages` : src.variantCount > 1 ? src.variantLangs.join(', ').toUpperCase() : (LANG_NAMES[src.lang] || (src.lang || '').toUpperCase())}</small>
          </div>
          <ChevronRight size={18} className="m-dim" />
        </button>
      ))}
    </>
  );
});

const LANG_NAMES = { en: 'English', all: 'Multi', ja: 'Japanese', ko: 'Korean', zh: 'Chinese', es: 'Spanish', fr: 'French', pt: 'Portuguese', 'pt-br': 'Portuguese (BR)', id: 'Indonesian', vi: 'Vietnamese', ru: 'Russian', de: 'German', it: 'Italian', tr: 'Turkish', ar: 'Arabic', th: 'Thai', pl: 'Polish' };

const ExtensionsList = memo(({ app }) => {
  const { installing, installExt, uninstallExt, updateExt } = useData();
  const [query, setQuery] = useState('');
  const [lang, setLang] = useState('en');
  const [showNsfw, setShowNsfw] = useState(false);
  const [limit, setLimit] = useState(EXT_PAGE);
  const sentinel = useRef(null);

  const langs = useMemo(() => {
    const counts = new Map();
    app.extensions.forEach(e => counts.set(e.lang, (counts.get(e.lang) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  }, [app.extensions]);

  const { updatesList, installed, available } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = e => (!q || e.name?.toLowerCase().includes(q) || e.pkgName?.toLowerCase().includes(q)) && (showNsfw || !e.isNsfw);
    const byName = (a, b) => (a.name || '').localeCompare(b.name || '');
    const inst = app.extensions.filter(e => e.isInstalled && match(e)).sort(byName);
    return {
      updatesList: inst.filter(e => e.hasUpdate),
      installed: inst.filter(e => !e.hasUpdate),
      available: app.extensions.filter(e => !e.isInstalled && match(e) && (lang === 'any' || e.lang === lang)).sort(byName),
    };
  }, [app.extensions, query, lang, showNsfw]);

  useEffect(() => { setLimit(EXT_PAGE); }, [query, lang, showNsfw]);
  useEffect(() => {
    const node = sentinel.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) setLimit(l => l + EXT_PAGE);
    }, { rootMargin: '600px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [available.length]);

  const row = (ext) => {
    const busy = installing?.has?.(ext.pkgName);
    return (
      <div key={ext.pkgName} className="m-ext">
        {ext.iconUrl ? <img src={ext.iconUrl} alt="" loading="lazy" onError={e => { e.currentTarget.style.visibility = 'hidden'; }} /> : <div className="ph" />}
        <div className="meta">
          <b className="m-ellipsis">{ext.name}{ext.isNsfw && <span className="m-nsfw">18+</span>}</b>
          <small>{LANG_NAMES[ext.lang] || (ext.lang || '').toUpperCase()} · v{ext.versionName}</small>
        </div>
        {busy ? <div className="m-spin" /> : ext.hasUpdate ? (
          <button className="m-btn small" onClick={() => updateExt(ext.pkgName)}>Update</button>
        ) : ext.isInstalled ? (
          <button className="m-btn small quiet" onClick={() => uninstallExt(ext.pkgName)}>Remove</button>
        ) : (
          <button className="m-btn small ghost" onClick={() => installExt(ext.pkgName)}>Install</button>
        )}
      </div>
    );
  };

  return (
    <>
      <div style={{ padding: '4px 16px 6px' }}>
        <div className="m-search"><Search size={17} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search extensions" /></div>
      </div>
      <div className="m-chips" style={{ paddingTop: 6 }}>
        {langs.slice(0, 8).map(id => (
          <button key={id} className={`m-chip ${lang === id ? 'on' : ''}`} onClick={() => setLang(id)}>{LANG_NAMES[id] || id.toUpperCase()}</button>
        ))}
        <button className={`m-chip ${lang === 'any' ? 'on' : ''}`} onClick={() => setLang('any')}>Any language</button>
        <button className={`m-chip ${showNsfw ? 'on' : ''}`} onClick={() => setShowNsfw(v => !v)}>18+</button>
      </div>
      {app.extensions.length === 0 && <div className="m-loadmore"><div className="m-spin" /></div>}
      {updatesList.length > 0 && <><div className="m-daylabel">Updates available</div>{updatesList.map(row)}</>}
      {installed.length > 0 && <><div className="m-daylabel">Installed</div>{installed.map(row)}</>}
      {available.length > 0 && <><div className="m-daylabel">Available</div>{available.slice(0, limit).map(row)}</>}
      {available.length > limit && <div ref={sentinel} className="m-loadmore"><div className="m-spin" /></div>}
    </>
  );
});

// ── Source browsing ──────────────────────────────────────────────────────

const SourceScreen = memo(({ app, onSheet }) => {
  const { inLibrary, toggleLibrary } = useData();
  const src = app.activeSource;
  const sort = app.browseFilters?.sort || 'latest';
  const failed = app.browseError && !app.browseLoading;

  return (
    <div className="m-page no-nav">
      <header className="m-bar sub">
        <button className="m-icon-btn" onClick={app.goBack} aria-label="Back"><ChevronLeft size={24} /></button>
        <div className="m-search">
          <Search size={17} />
          <input value={app.inputVal} placeholder={`Search ${src?.name || 'source'}`}
            onChange={e => { app.setInputVal(e.target.value); app.debouncedSearch(e.target.value); }} />
          {app.inputVal && <button className="m-icon-btn" style={{ width: 30, height: 30 }} onClick={() => { app.setInputVal(''); app.debouncedSearch(''); }}><X size={17} /></button>}
        </div>
      </header>
      {!app.inputVal && (
        <div className="m-chips">
          <button className={`m-chip ${sort !== 'popular' ? 'on' : ''}`} onClick={() => app.handleFilterChange('sort', 'latest')}>Latest</button>
          <button className={`m-chip ${sort === 'popular' ? 'on' : ''}`} onClick={() => app.handleFilterChange('sort', 'popular')}>Popular</button>
          <span className="m-dim m-sm m-ellipsis" style={{ alignSelf: 'center', marginLeft: 4 }}>{src?.name}</span>
        </div>
      )}
      {app.browseLoading && !app.results.length ? <SkeletonGrid /> : failed && !app.results.length ? (
        <SourceFailure
          error={app.browseError}
          verifying={app.sourceVerifying || app.sourceRepairing}
          onRetry={app.retryBrowse}
          onVerify={() => app.verifySourceThenRetry(app.retryBrowse)}
        />
      ) : app.results.length === 0 ? (
        <Empty icon={Search} title="No results" text={app.inputVal ? `Nothing found for “${app.inputVal}”.` : 'This source returned nothing.'} />
      ) : (
        <>
          <div className="m-grid">
            {app.results.map(m => (
              <ResultTile key={m.id} manga={m} sourceId={src?.id} saved={inLibrary(m.id, src?.id)}
                onOpen={() => app.openManga(m, src?.id)}
                onLongPress={() => onSheet({
                  title: m.title,
                  items: [
                    { label: 'Open', icon: BookOpen, action: () => app.openManga(m, src?.id) },
                    { label: inLibrary(m.id, src?.id) ? 'Remove from library' : 'Add to library', icon: Heart, action: () => toggleLibrary(m, src?.id) },
                  ],
                })} />
            ))}
          </div>
          {(app.loadingMore || app.hasNextPage) && <div className="m-loadmore"><div className="m-spin" /></div>}
        </>
      )}
    </div>
  );
});

const ResultTile = memo(({ manga, saved, onOpen, onLongPress }) => {
  const press = useLongPress(onLongPress, onOpen);
  return (
    <button className="m-cover m-press" {...press}>
      <CoverImg src={manga.cover} />
      {saved && <span className="m-badge soft right"><Heart size={11} fill="currentColor" style={{ color: 'var(--accent)', verticalAlign: -1 }} /></span>}
      <div className="shade" />
      <p>{manga.title}</p>
    </button>
  );
});

// ── Manga page (full bleed) ───────────────────────────────────────────────

const STATUS_LABELS = { ongoing: 'Ongoing', completed: 'Completed', publishing_finished: 'Finished', on_hiatus: 'On hiatus', cancelled: 'Cancelled', licensed: 'Licensed' };

const MangaScreen = memo(({ app, onSheet }) => {
  const {
    progress, readChapters, getMangaKey, inLibrary, toggleLibrary, markChapterRead,
    queueChaptersForDownload, downloadedKeys, downloadQueue, sources, fetchJSON,
  } = useData();
  const [section, setSection] = useState('chapters');
  const [descOpen, setDescOpen] = useState(false);
  const [newestFirst, setNewestFirst] = useState(true);
  const detail = app.mangaDetail;
  const base = app.selectedManga || {};
  const sourceId = app.activeSource?.id || base.sourceId;
  const mangaId = detail?.id || base.id;
  const key = getMangaKey(mangaId, sourceId);
  const prog = progress[key];
  const readSet = useMemo(() => new Set((readChapters[key] || []).map(String)), [readChapters, key]);
  const saved = inLibrary(mangaId, sourceId);
  const cover = detail?.cover || base.cover;
  const title = detail?.title || base.title;
  const chapters = detail?.chapters || [];

  const ordered = useMemo(() => {
    const desc = chapters.length > 1 && (parseFloat(chapters[0]?.number) || 0) >= (parseFloat(chapters.at(-1)?.number) || 0);
    return desc === newestFirst ? chapters : [...chapters].reverse();
  }, [chapters, newestFirst]);

  const queued = useMemo(() => new Set(downloadQueue.filter(d => d.status === 'pending' || d.status === 'downloading').map(d => String(d.downloadKey))), [downloadQueue]);
  const isRead = useCallback(ch => ch.read || readSet.has(String(ch.id)), [readSet]);

  const startTarget = useMemo(() => {
    if (!chapters.length) return null;
    if (prog?.chapterId) {
      const { chapter, page } = resolveContinueTarget(chapters, prog);
      if (chapter) return { chapter, page, label: `Resume · Ch. ${chapter.number}` };
    }
    const desc = (parseFloat(chapters[0]?.number) || 0) >= (parseFloat(chapters.at(-1)?.number) || 0);
    const oldestFirst = desc ? [...chapters].reverse() : chapters;
    const firstUnread = oldestFirst.find(ch => !isRead(ch));
    const chapter = firstUnread || oldestFirst[0];
    return { chapter, page: 0, label: firstUnread && firstUnread !== oldestFirst[0] ? `Continue · Ch. ${chapter.number}` : `Start reading · Ch. ${chapter.number}` };
  }, [chapters, prog, isRead]);

  const read = (ch, page) => app.openChapter(ch, sourceId, mangaId, page);
  const toggleSaved = () => toggleLibrary({ id: mangaId, title, cover, chapters: detail?.chapters }, sourceId);
  const setRead = (list, value) => {
    list.forEach(ch => {
      markChapterRead(mangaId, ch.id, value, sourceId);
      fetchJSON(`/chapter/${ch.id}/read`, { method: 'PATCH', body: JSON.stringify({ isRead: value }) }).catch(() => {});
    });
  };

  const chapterActions = (ch) => {
    const idx = chapters.findIndex(c => c.id === ch.id);
    const desc = (parseFloat(chapters[0]?.number) || 0) >= (parseFloat(chapters.at(-1)?.number) || 0);
    const older = desc ? chapters.slice(idx + 1) : chapters.slice(0, idx);
    onSheet({
      title: ch.title || `Chapter ${ch.number}`,
      items: [
        { label: isRead(ch) ? 'Mark as unread' : 'Mark as read', icon: isRead(ch) ? EyeOff : Eye, action: () => setRead([ch], !isRead(ch)) },
        older.length > 0 && { label: 'Mark previous as read', icon: Check, action: () => setRead(older, true) },
        { label: 'Download', icon: Download, action: () => app.handleDownload(ch) },
      ],
    });
  };

  const downloadActions = () => {
    const unread = chapters.filter(ch => !isRead(ch));
    onSheet({
      title: 'Download',
      items: [
        unread.length > 0 && { label: `Unread chapters (${unread.length})`, icon: Download, action: () => queueChaptersForDownload(unread, mangaId, title, sourceId) },
        { label: `All chapters (${chapters.length})`, icon: Download, action: () => queueChaptersForDownload(chapters, mangaId, title, sourceId) },
      ],
    });
  };

  const sourceName = sources[sourceId]?.displayName || sources[sourceId]?.name || app.activeSource?.name || '';
  const tags = detail?.tags || [];

  return (
    <div className="m-page no-nav">
      <div className="m-bleed" style={{ backgroundImage: cover ? `url("${proxyImg(cover)}")` : undefined }}>
        <div className="fade" />
        <div className="top">
          <button className="m-round" onClick={app.goBack} aria-label="Back"><ChevronLeft size={22} /></button>
          {chapters.length > 0 && <button className="m-round" onClick={downloadActions} aria-label="Download chapters"><Download size={19} /></button>}
        </div>
        <div className="meta">
          {detail?.status && <span className="m-tag">{STATUS_LABELS[detail.status] || detail.status}</span>}
          <h2>{title}</h2>
          {detail?.author && <p className="m-mut" style={{ margin: 0, fontSize: 14 }}>{detail.author}</p>}
        </div>
      </div>

      {app.mangaLoading && !detail ? (
        <div style={{ padding: 16, display: 'grid', gap: 10 }}>
          <div className="m-skel" style={{ height: 48 }} />
          <div className="m-skel" style={{ height: 64 }} />
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="m-skel" style={{ height: 46 }} />)}
        </div>
      ) : app.mangaError && !detail ? (
        <SourceFailure
          error={app.mangaError}
          verifying={app.sourceVerifying || app.sourceRepairing}
          onRetry={() => app.openManga(base, sourceId)}
          onVerify={() => app.verifySourceThenRetry(() => app.openManga(base, sourceId))}
        />
      ) : (
        <>
          <div className="m-cta">
            <button className="m-btn m-press" disabled={!startTarget} onClick={() => startTarget && read(startTarget.chapter, startTarget.page)}>
              <Play size={17} fill="currentColor" />{startTarget ? startTarget.label : 'No chapters'}
            </button>
            <button className={`m-round ${saved ? 'on' : ''}`} style={saved ? undefined : { background: 'rgba(255,255,255,0.07)' }} onClick={toggleSaved} aria-label={saved ? 'Remove from library' : 'Add to library'}>
              <Heart size={20} fill={saved ? 'currentColor' : 'none'} />
            </button>
          </div>
          {detail?.description && (
            <p className={`m-desc ${descOpen ? '' : 'clamp'}`} onClick={() => setDescOpen(v => !v)}>{detail.description}</p>
          )}
          <div className="m-seg">
            <button className={section === 'chapters' ? 'on' : ''} onClick={() => setSection('chapters')}>Chapters<b>{chapters.length}</b></button>
            <button className={section === 'info' ? 'on' : ''} onClick={() => setSection('info')}>Info</button>
          </div>

          {section === 'chapters' ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px 2px 16px' }}>
                <span className="m-dim m-sm">{chapters.filter(isRead).length} read</span>
                <button className="m-icon-btn" style={{ width: 'auto', padding: '0 8px', gap: 6, fontSize: 12.5, borderRadius: 10 }} onClick={() => setNewestFirst(v => !v)}>
                  {newestFirst ? 'Newest first' : 'Oldest first'}<ArrowDownUp size={15} />
                </button>
              </div>
              {ordered.map(ch => (
                <ChapterRow key={ch.id} ch={ch} read={isRead(ch)}
                  here={prog?.chapterId && String(prog.chapterId) === String(ch.id) ? prog.page : null}
                  downloaded={downloadedKeys?.has?.(`${key}___${ch.id}`)}
                  queued={queued.has(`${key}___${ch.id}`)}
                  onOpen={() => read(ch, prog?.chapterId && String(prog.chapterId) === String(ch.id) ? prog.page : 0)}
                  onDownload={() => app.handleDownload(ch)}
                  onLongPress={() => chapterActions(ch)} />
              ))}
            </>
          ) : (
            <>
              {tags.length > 0 && (
                <div className="m-tags" style={{ paddingTop: 8 }}>
                  {tags.map(tag => <button key={tag} onClick={() => app.handleTagClick(tag, sourceId)}>{tag}</button>)}
                </div>
              )}
              <div className="m-info">
                {sourceName && <div><span>Source</span><span>{sourceName}</span></div>}
                {detail?.author && <div><span>Author</span><span style={{ textAlign: 'right' }}>{detail.author}</span></div>}
                {detail?.status && <div><span>Status</span><span>{STATUS_LABELS[detail.status] || detail.status}</span></div>}
                <div><span>Chapters</span><span>{chapters.length}</span></div>
              </div>
              <div style={{ display: 'flex', gap: 10, padding: '10px 16px' }}>
                <button className="m-btn quiet" style={{ flex: 1 }} disabled={app.mangaRefreshing} onClick={app.refreshMangaDetails}>
                  {app.mangaRefreshing ? <div className="m-spin" /> : <RefreshCw size={17} />}Refresh chapters
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
});

const ChapterRow = memo(({ ch, read, here, downloaded, queued, onOpen, onDownload, onLongPress }) => {
  const press = useLongPress(onLongPress, onOpen);
  const name = ch.title || `Chapter ${ch.number}`;
  return (
    <div className={`m-ch ${read ? 'read' : ''}`}>
      <button className="t" style={{ border: 'none', background: 'none', color: 'inherit', font: 'inherit', textAlign: 'left', padding: 0, minWidth: 0 }} {...press}>
        <b className="m-ellipsis">{name}</b>
        <small className="m-ellipsis" style={{ display: 'block' }}>{[ch.date, ch.group].filter(Boolean).join(' · ') || ' '}</small>
      </button>
      {here != null && <span className="here">p. {here + 1}</span>}
      <button className={`dl ${downloaded ? 'done' : ''}`} onClick={downloaded || queued ? undefined : onDownload} aria-label={downloaded ? 'Downloaded' : 'Download chapter'}>
        {queued ? <div className="m-spin" style={{ width: 18, height: 18 }} /> : downloaded ? <Check size={19} /> : <Download size={19} />}
      </button>
    </div>
  );
});

// ── More, downloads, settings ─────────────────────────────────────────────

const MoreScreen = memo(({ app, open }) => {
  const { library, history, readChapters, downloadQueue } = useData();
  const active = downloadQueue.filter(d => d.status === 'pending' || d.status === 'downloading').length;
  const streak = calculateStreak(history);
  return (
    <div className="m-page">
      <div className="m-brand">
        <div className="logo"><BookOpen size={22} color="#fff" /></div>
        <b className="text-gradient">akaReader</b>
      </div>
      <div className="m-stats">
        <div><b>{library.length}</b><small>In library</small></div>
        <div><b>{countReadChapterIds(readChapters)}</b><small>Chapters read</small></div>
        <div><b>{streak}</b><small>Day streak</small></div>
      </div>
      <div className="m-menu">
        <button onClick={() => open('downloads')}><HardDrive size={20} />Downloads<span className="end">{active ? `${active} active` : ''}<ChevronRight size={17} /></span></button>
        <button onClick={() => app.goBrowse('extensions')}><Puzzle size={20} />Extensions<span className="end">{app.extensionUpdates ? `${app.extensionUpdates} updates` : ''}<ChevronRight size={17} /></span></button>
        <button onClick={() => open('settings')}><Settings size={20} />Settings<span className="end"><ChevronRight size={17} /></span></button>
      </div>
      <div className="m-menu">
        <button style={{ cursor: 'default' }}><Info size={20} />Version<span className="end">{import.meta.env.PACKAGE_VERSION || ''}</span></button>
      </div>
    </div>
  );
});

const DownloadsScreen = memo(({ app, onBack, onSheet }) => {
  const { downloadQueue, cancelDownload, library, readChapters, downloadedChapters, getMangaKey } = useData();
  const active = downloadQueue.filter(d => d.status === 'pending' || d.status === 'downloading' || d.status === 'error');
  const summary = useMemo(() => summarizeDownloadedChapters({
    records: downloadedChapters || [],
    library: library.map(m => ({ ...m, mangaKey: getMangaKey(m.id, m.sourceId) })),
    readChapters,
  }), [downloadedChapters, library, readChapters, getMangaKey]);

  return (
    <div className="m-page no-nav">
      <header className="m-bar sub">
        <button className="m-icon-btn" onClick={onBack} aria-label="Back"><ChevronLeft size={24} /></button>
        <h1>Downloads</h1>
      </header>
      {summary.chapterCount > 0 && (
        <div className="m-stats">
          <div><b>{summary.mangaCount}</b><small>Titles</small></div>
          <div><b>{summary.chapterCount}</b><small>Chapters</small></div>
          <div><b>{formatBytes(summary.sizeBytes)}</b><small>On device</small></div>
        </div>
      )}
      {active.length > 0 && (
        <>
          <div className="m-daylabel">In progress</div>
          {active.map(d => (
            <div key={d.id} className="m-row">
              <div className="meta">
                <b className="m-ellipsis">{d.mangaTitle}</b>
                <small className="m-mut">Ch. {d.chapterNum} · {d.status === 'downloading' ? `${d.pagesLoaded || 0}/${d.pagesTotal || '?'} pages` : d.status === 'error' ? 'Failed' : 'Queued'}</small>
                <div className="bar"><i style={{ width: `${d.status === 'downloading' ? d.progress || 0 : 0}%` }} /></div>
              </div>
              <button className="m-icon-btn" onClick={() => cancelDownload(d.id)} aria-label="Cancel"><X size={19} /></button>
            </div>
          ))}
        </>
      )}
      {summary.groups.length > 0 ? (
        <>
          <div className="m-daylabel">On this device</div>
          {summary.groups.map(group => (
            <button key={group.mangaKey} className="m-row" onClick={() => onSheet({
              title: group.mangaTitle,
              items: [
                group.readCount > 0 && { label: `Delete read chapters (${group.readCount})`, icon: Trash2, action: () => app.handleDeleteStoredChapters(group.records.filter(r => r.isRead).map(r => r.key)) },
                { label: `Delete all ${group.records.length} chapters`, icon: Trash2, action: () => app.handleDeleteStoredChapters(group.records.map(r => r.key)) },
              ],
            })}>
              <CoverImg className="thumb" src={group.cover} />
              <div className="meta">
                <b className="m-ellipsis">{group.mangaTitle}</b>
                <small className="m-mut">{group.records.length} chapter{group.records.length === 1 ? '' : 's'} · {formatBytes(group.sizeBytes)}</small>
                <div className="bar"><i style={{ width: `${group.records.length ? (group.readCount / group.records.length) * 100 : 0}%` }} /></div>
              </div>
              <span className="m-dim m-sm">{group.readCount}/{group.records.length} read</span>
            </button>
          ))}
        </>
      ) : active.length === 0 && (
        <Empty icon={Download} title="No downloads" text="Download chapters from a manga page to read them offline." />
      )}
    </div>
  );
});

// ── Shell ────────────────────────────────────────────────────────────────

const TAB_IDS = new Set(NAV.map(n => n.id));

const MobileApp = ({ app }) => {
  const { updates, downloadQueue } = useData();
  const [sheet, setSheet] = useState(null);
  const [subPage, setSubPage] = useState(null);
  const [browseSegment, setBrowseSegment] = useState('sources');
  const { tab, view, switchTab } = app;
  const mTab = TAB_IDS.has(tab) ? tab : 'library';

  useEffect(() => {
    if (!TAB_IDS.has(tab)) switchTab(tab === 'downloads' ? 'more' : tab === 'extensions' ? 'browse' : 'library');
  }, [tab, switchTab]);

  // Desktop returns from a title to its source page; on the phone a title opened from
  // Library/History/Updates goes back to that tab instead.
  const backToTabs = view === 'manga' && mTab !== 'browse';
  const shell = useMemo(() => ({
    ...app,
    goBack: backToTabs ? () => app.setView('tabs') : app.goBack,
    goBrowse: (segment) => { setBrowseSegment(segment); setSubPage(null); switchTab('browse'); },
  }), [app, backToTabs, switchTab]);

  // Android back arrives as an Escape keydown. App.jsx handles reader/manga/source;
  // this handles sheets, sub-pages and returning to Library before the app exits.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      const handled = () => { e.preventDefault(); e.stopImmediatePropagation(); };
      if (sheet) { setSheet(null); handled(); return; }
      if (backToTabs) { app.setView('tabs'); handled(); return; }
      if (view !== 'tabs') return;
      if (subPage) { setSubPage(null); handled(); return; }
      if (mTab !== 'library') { switchTab('library'); handled(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [sheet, view, subPage, mTab, switchTab, backToTabs, app]);

  const badges = {
    updates: updates.reduce((n, u) => n + (u.newChapters || 0), 0),
    more: downloadQueue.filter(d => d.status === 'pending' || d.status === 'downloading').length,
    browse: app.extensionUpdates,
  };
  const onSheet = setSheet;
  const showTabs = view === 'tabs';
  const keepSource = app.activeSource && (view === 'source' || view === 'manga') && mTab === 'browse';

  return (
    <div className="m-app">
      <div style={{ display: showTabs ? 'block' : 'none' }}>
        {subPage === 'downloads' ? <DownloadsScreen app={shell} onBack={() => setSubPage(null)} onSheet={onSheet} />
          : subPage === 'settings' ? (
            <div className="m-page no-nav">
              <header className="m-bar sub">
                <button className="m-icon-btn" onClick={() => setSubPage(null)} aria-label="Back"><ChevronLeft size={24} /></button>
                <h1>Settings</h1>
              </header>
              <MobileSettings onSheet={onSheet} />
            </div>
          )
          : mTab === 'library' ? <LibraryScreen app={shell} onSheet={onSheet} />
          : mTab === 'updates' ? <UpdatesScreen app={shell} />
          : mTab === 'browse' ? <BrowseScreen app={shell} segment={browseSegment} setSegment={setBrowseSegment} />
          : mTab === 'history' ? <HistoryScreen app={shell} onSheet={onSheet} />
          : <MoreScreen app={shell} open={setSubPage} />}
      </div>
      {keepSource && <div style={{ display: view === 'source' ? 'block' : 'none' }}><SourceScreen app={shell} onSheet={onSheet} /></div>}
      {view === 'manga' && <MangaScreen app={shell} onSheet={onSheet} />}
      {showTabs && !subPage && <BottomNav tab={mTab} badges={badges} onSelect={(id) => { setSubPage(null); switchTab(id); }} />}
      {sheet && <Sheet {...sheet} onClose={() => setSheet(null)} />}
    </div>
  );
};

export default MobileApp;
