/**
 * akaReader API Server
 * Features: LRU cache, rate limiting, compression, streaming downloads
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');

// Optional middleware - gracefully skip if not installed
let rateLimit, helmet, compression;
try { rateLimit = require('express-rate-limit'); } catch { rateLimit = null; }
try { helmet = require('helmet'); } catch { helmet = null; }
try { compression = require('compression'); } catch { compression = null; }
let archiver;
try { archiver = require('archiver'); } catch { archiver = null; }

// ── LRU Cache ──────────────────────────────────────────────────────────────
class LRUCache {
  constructor(maxSize = 100, defaultTTL = 300000) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
    this.cache = new Map();
    this.timers = new Map();
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.exp) { this.delete(key); return null; }
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.data;
  }

  set(key, data, ttlMs = this.defaultTTL) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      this.delete(this.cache.keys().next().value);
    }
    this.cache.set(key, { data, exp: Date.now() + ttlMs });
    if (this.timers.has(key)) clearTimeout(this.timers.get(key));
    this.timers.set(key, setTimeout(() => this.delete(key), ttlMs));
  }

  delete(key) {
    this.cache.delete(key);
    if (this.timers.has(key)) { clearTimeout(this.timers.get(key)); this.timers.delete(key); }
  }

  clear() {
    this.timers.forEach(t => clearTimeout(t));
    this.timers.clear();
    this.cache.clear();
  }
}

// ── App Setup ──────────────────────────────────────────────────────────────
const app = express();

if (helmet) app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));
if (compression) app.use(compression());

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PATCH'], allowedHeaders: ['Content-Type'] }));
app.use(express.json({ limit: '10mb' }));

if (rateLimit) {
  app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false }));
}

// ── Config ─────────────────────────────────────────────────────────────────
const SUWAYOMI = process.env.SUWAYOMI_URL || 'http://localhost:4567';
const GQL = `${SUWAYOMI}/api/graphql`;
const http = axios.create({ timeout: 120000 });

// ── Caches ─────────────────────────────────────────────────────────────────
const caches = {
  sources:    new LRUCache(50,  30000),   // 30s
  extensions: new LRUCache(100, 60000),   // 1min
  search:     new LRUCache(200, 300000),  // 5min
  manga:      new LRUCache(100, 600000),  // 10min
  pages:      new LRUCache(50,  3600000), // 1hr
};

// ── Logging ────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${Date.now()-start}ms`);
  });
  next();
});

// ── Helpers ────────────────────────────────────────────────────────────────
const gql = async (query, variables = {}, retries = 2) => {
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await http.post(GQL, { query, variables }, { headers: { 'Content-Type': 'application/json' } });
      if (r.data.errors) throw new Error(r.data.errors.map(e => e.message).join(', '));
      return r.data.data;
    } catch (e) {
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
};

const fixUrl = url => (!url ? null : url.startsWith('http') ? url : `${SUWAYOMI}${url}`);

const fmtNum = n => {
  if (n == null) return null;
  const f = parseFloat(n);
  return isNaN(f) ? null : String(f % 1 === 0 ? f : parseFloat(f.toFixed(1)));
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Health ─────────────────────────────────────────────────────────────────
app.get('/api/health', async (_, res) => {
  try {
    await gql('query { aboutServer { version } }');
    res.json({ ok: true, timestamp: Date.now() });
  } catch (e) {
    res.status(503).json({ ok: false, error: e.message });
  }
});

// ── Extensions ─────────────────────────────────────────────────────────────
app.get('/api/extensions', async (_, res) => {
  try {
    const cached = caches.extensions.get('all');
    if (cached) return res.json(cached);
    const data = await gql(`
      query { extensions { nodes { pkgName name lang isInstalled isNsfw hasUpdate iconUrl versionName versionCode } } }
    `);
    const result = data.extensions?.nodes || [];
    caches.extensions.set('all', result);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const extAction = async (action, pkg) => {
  const url = `${SUWAYOMI}/api/v1/extension/${action}/${encodeURIComponent(pkg)}`;
  console.log(`[ext:${action}] ${pkg}`);
  const r = await http.get(url, { timeout: 120000 });
  if (r.status >= 400) throw new Error(`Suwayomi HTTP ${r.status}`);
  return r.data;
};

app.post('/api/extensions/install/:pkgName', async (req, res) => {
  try {
    const pkg = decodeURIComponent(req.params.pkgName);
    if (!pkg || pkg.length > 200) throw new Error('Invalid package name');
    await extAction('install', pkg);
    caches.sources.clear();
    caches.extensions.clear();
    res.json({ ok: true, message: 'Installation started' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/extensions/uninstall/:pkgName', async (req, res) => {
  try {
    const pkg = decodeURIComponent(req.params.pkgName);
    if (!pkg || pkg.length > 200) throw new Error('Invalid package name');
    await extAction('uninstall', pkg);
    caches.sources.clear();
    caches.extensions.clear();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/extensions/update/:pkgName', async (req, res) => {
  try {
    const pkg = decodeURIComponent(req.params.pkgName);
    if (!pkg || pkg.length > 200) throw new Error('Invalid package name');
    await extAction('update', pkg);
    caches.extensions.clear();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Sources ────────────────────────────────────────────────────────────────
app.get('/api/sources', async (_, res) => {
  try {
    const cached = caches.sources.get('all');
    if (cached) return res.json(cached);
    const data = await gql(`query { sources { nodes { id name lang iconUrl displayName isNsfw } } }`);
    const result = data.sources?.nodes || [];
    caches.sources.set('all', result);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Search / Popular ───────────────────────────────────────────────────────
app.get('/api/source/:sourceId/search', async (req, res) => {
  const { sourceId } = req.params;
  const q = req.query.q || '';
  const page = Math.max(1, parseInt(req.query.page) || 1);
  
  // NEW: Extract filter parameters
  const filters = {
    status: req.query.status || 'all',
    sort: req.query.sort || 'latest',
    contentType: req.query.contentType || 'all',
    tags: req.query.tags || ''
  };
  
  // NEW: Include filters in cache key
  const cacheKey = `search-${sourceId}-${q}-${page}-${filters.status}-${filters.sort}-${filters.contentType}-${filters.tags}`;

  try {
    const cached = caches.search.get(cacheKey);
    if (cached) return res.json(cached);

    const data = await gql(
      `mutation($src:LongString!, $type:FetchSourceMangaType!, $q:String, $page:Int!) {
        fetchSourceManga(input:{source:$src, type:$type, query:$q, page:$page}) {
          mangas { id title thumbnailUrl }
          hasNextPage
        }
      }`,
      { src: sourceId, type: q ? 'SEARCH' : 'POPULAR', q, page }
    );

    let { mangas = [], hasNextPage = false } = data.fetchSourceManga;
    
    // NEW: Apply post-fetch filtering if needed
    if (filters.status !== 'all' || filters.tags) {
      const detailedMangas = await Promise.all(
        mangas.map(async (m) => {
          try {
            const d = await gql(`query($id:Int!){ manga(id:$id){ id status genre } }`, { id: m.id });
            return { ...m, ...d.manga };
          } catch { return m; }
        })
      );
      
      mangas = detailedMangas.filter(m => {
        if (filters.status !== 'all' && m.status) {
          const status = m.status.toLowerCase();
          if (!status.includes(filters.status)) return false;
        }
        if (filters.tags && m.genre) {
          const genres = Array.isArray(m.genre) ? m.genre : m.genre.split(',').map(g => g.trim());
          const searchTags = filters.tags.toLowerCase().split(',').map(t => t.trim());
          const hasTag = searchTags.some(tag => 
            genres.some(g => g.toLowerCase().includes(tag))
          );
          if (!hasTag) return false;
        }
        return true;
      });
    }
    
    // NEW: Apply sorting
    if (filters.sort === 'alphabetical') {
      mangas.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }

    const result = {
      results: mangas.map(m => ({ id: String(m.id), title: m.title, cover: fixUrl(m.thumbnailUrl) })),
      hasNextPage,
      appliedFilters: filters
    };
    
    caches.search.set(cacheKey, result);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Manga Detail ───────────────────────────────────────────────────────────
app.get('/api/source/:sourceId/manga/:mangaId', async (req, res) => {
  const mangaId = parseInt(req.params.mangaId);
  if (isNaN(mangaId)) return res.status(400).json({ error: 'Invalid manga ID' });

  const cacheKey = `manga-${mangaId}`;

  try {
    const cached = caches.manga.get(cacheKey);
    if (cached) return res.json(cached);

    // Fetch manga info
    let manga;
    try {
      const d = await gql(
        `query($id:Int!){ manga(id:$id){ id title thumbnailUrl author description status genre } }`,
        { id: mangaId }
      );
      manga = d.manga;
    } catch {
      const d = await gql(
        `mutation($id:Int!){ fetchManga(input:{id:$id}){ manga{ id title thumbnailUrl author description status genre } } }`,
        { id: mangaId }
      );
      manga = d.fetchManga.manga;
    }

    // Fetch chapters
    let chapters = [];
    try {
      const d = await gql(
        `query($id:Int!){ manga(id:$id){ chapters{ nodes{ id name chapterNumber uploadDate scanlator isRead } } } }`,
        { id: mangaId }
      );
      chapters = d.manga?.chapters?.nodes || [];
    } catch {}

    if (chapters.length === 0) {
      try {
        const d = await gql(
          `mutation($id:Int!){ fetchChapters(input:{mangaId:$id}){ chapters{ id name chapterNumber uploadDate scanlator isRead } } }`,
          { id: mangaId }
        );
        chapters = d.fetchChapters?.chapters || [];
      } catch (e) {
        console.error('[fetchChapters]', e.message);
      }
    }

    const mapped = chapters
      .map(ch => ({
        id:     String(ch.id),
        number: fmtNum(ch.chapterNumber) ?? ch.name?.match(/[\d.]+/)?.[0] ?? '?',
        title:  ch.name || '',
        date:   (() => {
          if (!ch.uploadDate) return '';
          // Suwayomi returns ms epoch as a number or numeric string
          const ts = Number(ch.uploadDate);
          const d  = isNaN(ts) ? new Date(ch.uploadDate) : new Date(ts);
          return isNaN(d.getTime()) ? '' : d.toLocaleDateString();
        })(),
        group:  ch.scanlator || '',
        read:   ch.isRead || false,
      }))
      .sort((a, b) => parseFloat(b.number) - parseFloat(a.number));

    const result = {
      id:            String(manga.id),
      title:         manga.title,
      cover:         fixUrl(manga.thumbnailUrl),
      author:        manga.author || '',
      description:   manga.description || '',
      status:        manga.status?.toLowerCase() || '',
      tags:          Array.isArray(manga.genre) ? manga.genre : (manga.genre ? String(manga.genre).split(', ').filter(Boolean) : []),
      totalChapters: mapped.length,
      chapters:      mapped,
    };

    caches.manga.set(cacheKey, result);
    res.json(result);
  } catch (e) {
    console.error('[manga]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Chapter Pages ──────────────────────────────────────────────────────────
app.get('/api/source/:sourceId/chapter/:chapterId', async (req, res) => {
  const chapterId = parseInt(req.params.chapterId);
  if (isNaN(chapterId)) return res.status(400).json({ error: 'Invalid chapter ID' });

  const cacheKey = `pages-${chapterId}`;

  try {
    const cached = caches.pages.get(cacheKey);
    if (cached) return res.json(cached);

    const data = await gql(
      `mutation($id:Int!){ fetchChapterPages(input:{chapterId:$id}){ pages } }`,
      { id: chapterId }
    );
    const result = (data.fetchChapterPages?.pages || []).map(p => fixUrl(p));
    caches.pages.set(cacheKey, result);
    res.json(result);
  } catch (e) {
    console.error('[pages]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Download Chapter as CBZ ────────────────────────────────────────────────
const DOWNLOAD_CONCURRENCY = 4;

async function fetchBuffer(url, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const r = await http.get(url, { responseType: 'arraybuffer', timeout: 60000 });
      return { ok: true, buf: Buffer.from(r.data), ct: r.headers['content-type'] || '' };
    } catch (e) {
      if (attempt === retries) return { ok: false, err: e.message };
      await sleep(800 * (attempt + 1));
    }
  }
}

async function fetchAllBuffers(urls) {
  const results = new Array(urls.length).fill(null);
  let idx = 0;
  const worker = async () => {
    while (true) {
      const i = idx++;
      if (i >= urls.length) break;
      results[i] = await fetchBuffer(urls[i]);
      process.stdout.write(`\r[download] page ${i + 1}/${urls.length} `);
    }
  };
  await Promise.all(Array.from({ length: DOWNLOAD_CONCURRENCY }, worker));
  console.log('');
  return results;
}

function guessExt(url, ct) {
  if (ct.includes('png'))  return 'png';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('gif'))  return 'gif';
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
  const ext = url.split('?')[0].split('.').pop().toLowerCase();
  return ['jpg','jpeg','png','webp','gif'].includes(ext) ? (ext === 'jpeg' ? 'jpg' : ext) : 'jpg';
}

app.get('/api/source/:sourceId/chapter/:chapterId/download', async (req, res) => {
  if (!archiver) return res.status(501).json({ error: 'archiver not installed — run: npm install archiver' });

  const chapterId = parseInt(req.params.chapterId);
  if (isNaN(chapterId)) return res.status(400).json({ error: 'Invalid chapter ID' });

  const { title = `chapter-${chapterId}` } = req.query;
  const safeName = String(title).replace(/[/\\?%*:|"<>]/g, '-');

  try {
    // Try cache first
    let pages = caches.pages.get(`pages-${chapterId}`);
    if (!pages) {
      const data = await gql(
        `mutation($id:Int!){ fetchChapterPages(input:{chapterId:$id}){ pages } }`,
        { id: chapterId }
      );
      pages = (data.fetchChapterPages?.pages || []).map(p => fixUrl(p));
    }

    if (!pages.length) return res.status(404).json({ error: 'No pages found' });

    const buffers = await fetchAllBuffers(pages);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.cbz"`);
    res.setHeader('X-Pages-Total', pages.length);
    res.setHeader('X-Pages-Failed', buffers.filter(b => !b?.ok).length);

    const archive = archiver('zip', { zlib: { level: 0 } });
    archive.on('error', e => console.error('[archiver]', e));
    archive.pipe(res);
    buffers.forEach((r, i) => {
      if (!r?.ok) return;
      archive.append(r.buf, { name: `${String(i + 1).padStart(4, '0')}.${guessExt(pages[i], r.ct)}` });
    });
    await archive.finalize();
  } catch (e) {
    console.error('[download]', e.message);
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

// ── Mark Chapter Read ──────────────────────────────────────────────────────
app.patch('/api/chapter/:chapterId/read', async (req, res) => {
  const chapterId = parseInt(req.params.chapterId);
  if (isNaN(chapterId)) return res.status(400).json({ error: 'Invalid chapter ID' });
  const { isRead } = req.body;
  try {
    await gql(
      `mutation($id:Int!, $read:Boolean!){ updateChapter(input:{id:$id, isRead:$read}){ chapter{ isRead } } }`,
      { id: chapterId, read: !!isRead }
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 404 Handler ────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ── Start ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✓ akaReader proxy → http://localhost:${PORT}`);
  console.log(`  Suwayomi        → ${SUWAYOMI}`);
  if (!archiver)    console.warn('⚠  archiver not found   — run: npm install archiver');
  if (!rateLimit)   console.warn('⚠  express-rate-limit not found — run: npm install express-rate-limit');
  if (!helmet)      console.warn('⚠  helmet not found     — run: npm install helmet');
  if (!compression) console.warn('⚠  compression not found — run: npm install compression');
});