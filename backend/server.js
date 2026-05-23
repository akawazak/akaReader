/**
 * akaReader API Server
 * Features: LRU cache, rate limiting, compression, streaming downloads
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

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

// Rate limiting removed - not needed for local proxy

// ── Config ─────────────────────────────────────────────────────────────────
const SUWAYOMI = process.env.SUWAYOMI_URL || 'http://localhost:4567';
const GQL = `${SUWAYOMI}/api/graphql`;
const http = axios.create({ timeout: 120000 });

// ── Caches ─────────────────────────────────────────────────────────────────
const caches = {
  sources:    new LRUCache(50,  30000),   // 30s
  extensions: new LRUCache(100, 600000),  // 10min
  search:     new LRUCache(200, 300000),  // 5min
  manga:      new LRUCache(100, 600000),  // 10min
  pages:      new LRUCache(50,  1800000), // 30min
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
      await new Promise(r => setTimeout(r, 300 * (i + 1)));
    }
  }
};

const fixUrl = url => (!url ? null : url.startsWith('http') ? url : `${SUWAYOMI}${url}`);
const getMangaCacheKey = (sourceId, mangaId) => `manga-${sourceId}-${mangaId}`;
const getChapterPagesCacheKey = (sourceId, chapterId) => `pages-${sourceId}-${chapterId}`;

const isAllowedImageUrl = value => {
  try {
    const candidate = new URL(value);
    const suwayomi = new URL(SUWAYOMI);
    if (!['http:', 'https:'].includes(candidate.protocol)) return false;
    const allowedHosts = new Set([suwayomi.hostname, '127.0.0.1', 'localhost', '::1', '[::1]']);
    return allowedHosts.has(candidate.hostname);
  } catch {
    return false;
  }
};

const fmtDate = value => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
};

function fmtNum(n) {
  return (n === undefined || n === null) ? null : Number.isInteger(n) ? String(n) : String(n).replace(/\.0$/, '');
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

const clearMangaCaches = () => {
  caches.sources.clear();
  caches.search.clear();
  caches.manga.clear();
  caches.pages.clear();
};

const getExtensionDir = () => {
  if (process.env.SUWAYOMI_EXT_DIR) return process.env.SUWAYOMI_EXT_DIR;
  if (process.env.APPDATA) return path.join(process.env.APPDATA, 'akareader', 'suwayomi-data', 'extensions');
  return null;
};

const extensionTokens = pkg => {
  const normalized = String(pkg || '').toLowerCase();
  const shortName = normalized
    .replace(/^eu\.kanade\.tachiyomi\.extension\./, '')
    .replace(/^tachiyomi\./, '');
  const parts = shortName.split('.').filter(Boolean);
  return [
    shortName,
    parts.length >= 2 ? `${parts[parts.length - 2]}.${parts[parts.length - 1]}` : '',
    parts.at(-1) || '',
  ].filter(Boolean);
};

const removeExtensionFiles = async pkg => {
  const dir = getExtensionDir();
  if (!dir) return [];
  let entries = [];
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const tokens = extensionTokens(pkg);
  const removed = [];
  await Promise.all(entries
    .filter(entry => entry.isFile())
    .filter(entry => /\.(apk|jar)$/i.test(entry.name))
    .filter(entry => {
      const name = entry.name.toLowerCase();
      return tokens.some(token => token.length >= 3 && name.includes(token));
    })
    .map(async entry => {
      const file = path.join(dir, entry.name);
      try {
        await fs.promises.unlink(file);
        removed.push(entry.name);
      } catch (e) {
        console.warn('[extensions] Could not remove file:', file, e.message);
      }
    }));
  return removed;
};

const syncExtensions = async () => {
  await gql('mutation { fetchExtensions(input: {}) { clientMutationId } }', {}, 0);
};

const queryExtensions = async () => {
  const data = await gql(`
    query {
      extensions {
        nodes {
          pkgName apkName name lang isInstalled isNsfw hasUpdate iconUrl versionName versionCode
        }
      }
    }
  `);
  return data.extensions?.nodes || [];
};

const mapRestExtension = (ext) => ({
  pkgName: ext.pkgName,
  apkName: ext.apkName,
  name: ext.name,
  lang: ext.lang,
  isInstalled: !!ext.installed,
  isNsfw: !!ext.isNsfw,
  hasUpdate: !!ext.hasUpdate,
  iconUrl: ext.iconUrl,
  versionName: ext.versionName,
  versionCode: ext.versionCode,
});

// ── Health ─────────────────────────────────────────────────────────────────
app.get('/api/ping', (_, res) => {
  res.json({ ok: true, timestamp: Date.now() });
});

app.get('/api/health', async (_, res) => {
  let suwayomi = false;
  try {
    await Promise.race([
      gql('query { aboutServer { version } }'),
      new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 2000))
    ]);
    suwayomi = true;
  } catch { /* still starting */ }
  res.json({ ok: true, suwayomi, timestamp: Date.now() });
});

// ── Image Proxy ────────────────────────────────────────────────────────────
app.get('/api/img', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).end();
  if (!isAllowedImageUrl(url)) {
    return res.status(403).end();
  }

  // Try fetching image with retries
  for (let i = 0; i < 2; i++) {
    try {
      const r = await http.get(url, { responseType: 'arraybuffer', timeout: 30000 });
      res.set('Cache-Control', 'public, max-age=86400');
      // Preserve the upstream image type instead of forcing a jpeg default.
      const contentType = r.headers['content-type'] || 'application/octet-stream';
      res.set('Content-Type', contentType);
      return res.send(Buffer.from(r.data));
    } catch (e) {
      if (i === 1) {
        console.error('[img-proxy] Final failure:', url, e.message);
        return res.status(502).end();
      }
      await sleep(1000); // Wait before retry
    }
  }
});

// ── Extensions ─────────────────────────────────────────────────────────────
app.get('/api/extensions', async (_, res) => {
  try {
    const force = ['1', 'true'].includes(String(_.query.force || '').toLowerCase());
    const cached = !force && caches.extensions.get('all');
    if (cached) return res.json(cached);
    if (force) {
      await syncExtensions().catch(() => {});
    }
    let result = await queryExtensions();
    if (!result.length) {
      await syncExtensions();
      result = await queryExtensions();
    }
    if (!result.length) {
      const fallback = await http.get(`${SUWAYOMI}/api/v1/extension/list`, { timeout: 120000 });
      result = Array.isArray(fallback.data) ? fallback.data.map(mapRestExtension) : [];
    }
    caches.extensions.set('all', result);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const extAction = async (action, pkg) => {
  const patchField = ({ install: 'install', uninstall: 'uninstall', update: 'update' })[action];
  if (!patchField) throw new Error(`Unsupported action: ${action}`);
  const mutate = () => gql(`
    mutation UpdateExtension($id: String!) {
      updateExtension(input: { id: $id, patch: { ${patchField}: true } }) {
        extension { pkgName isInstalled hasUpdate }
      }
    }
  `, { id: pkg }, 0);
  let data = await mutate();
  if (!data.updateExtension?.extension && action === 'install') {
    await syncExtensions();
    data = await mutate();
  }
  if (!data.updateExtension?.extension) throw new Error(`Suwayomi could not ${action} ${pkg}`);
  return data.updateExtension.extension;
};

app.post('/api/extensions/install/:pkgName', async (req, res) => {
  try {
    const pkg = decodeURIComponent(req.params.pkgName);
    await extAction('install', pkg);
    caches.extensions.clear();
    clearMangaCaches();
    await sleep(500);
    syncExtensions().catch(() => {});
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/extensions/uninstall/:pkgName', async (req, res) => {
  try {
    const pkg = decodeURIComponent(req.params.pkgName);
    await extAction('uninstall', pkg);
    const removedFiles = await removeExtensionFiles(pkg);
    caches.extensions.clear();
    clearMangaCaches();
    await sleep(500);
    syncExtensions().catch(() => {});
    res.json({ ok: true, removedFiles });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/extensions/update/:pkgName', async (req, res) => {
  try {
    const pkg = decodeURIComponent(req.params.pkgName);
    await extAction('update', pkg);
    caches.extensions.clear();
    clearMangaCaches();
    await sleep(500);
    syncExtensions().catch(() => {});
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Sources ────────────────────────────────────────────────────────────────
app.get('/api/sources', async (req, res) => {
  try {
    const force = ['1', 'true'].includes(String(req.query.force || '').toLowerCase());
    const cached = !force && caches.sources.get('all');
    if (cached) return res.json(cached);
    const data = await gql(`query { sources { nodes { id name lang iconUrl displayName isNsfw } } }`);
    const result = data.sources?.nodes || [];
    caches.sources.set('all', result);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Search / Popular ───────────────────────────────────────────────────────
app.get('/api/source/:sourceId/search', async (req, res) => {
  const { sourceId } = req.params;
  const q = req.query.q || '';
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const sort = String(req.query.sort || 'latest').toLowerCase();
  const status = String(req.query.status || 'all').toLowerCase();
  const contentType = String(req.query.contentType || 'all').toLowerCase();
  const tags = String(req.query.tags || '').trim().toLowerCase();
  const cacheKey = `search-${sourceId}-${q}-${page}-${sort}-${status}-${contentType}-${tags}`;
  try {
    const cached = caches.search.get(cacheKey);
    if (cached) return res.json(cached);
    const queryDoc = `mutation($src:LongString!, $type:FetchSourceMangaType!, $q:String, $page:Int!) {
      fetchSourceManga(input:{source:$src, type:$type, query:$q, page:$page}) {
        mangas { id title thumbnailUrl }
        hasNextPage
      }
    }`;
    const requestedType = q ? 'SEARCH' : (sort === 'popular' ? 'POPULAR' : 'LATEST');
    let data;
    try {
      data = await gql(queryDoc, { src: sourceId, type: requestedType, q, page });
    } catch (error) {
      if (q || requestedType === 'POPULAR') throw error;
      data = await gql(queryDoc, { src: sourceId, type: 'POPULAR', q, page });
    }
    if (!data?.fetchSourceManga) throw new Error('Source failed to return results');
    const { mangas = [], hasNextPage = false } = data.fetchSourceManga;
    const result = {
      results: mangas.map(m => ({ id: String(m.id), title: m.title, cover: fixUrl(m.thumbnailUrl) })),
      hasNextPage,
      requestedFilters: { sort, status, contentType, tags },
    };
    caches.search.set(cacheKey, result);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Manga Detail ───────────────────────────────────────────────────────────
app.get('/api/source/:sourceId/manga/:mangaId', async (req, res) => {
  const sourceId = String(req.params.sourceId);
  const mangaId = parseInt(req.params.mangaId);
  if (isNaN(mangaId)) return res.status(400).json({ error: 'Invalid ID' });
  const cacheKey = getMangaCacheKey(sourceId, mangaId);
  try {
    const cached = caches.manga.get(cacheKey);
    if (cached) return res.json(cached);
    let manga;
    try {
      const d = await gql(`mutation($id:Int!){ fetchManga(input:{id:$id}){ manga{ id title url thumbnailUrl author description status genre } } }`, { id: mangaId });
      manga = d.fetchManga?.manga;
    } catch {}
    if (!manga) {
      const d = await gql(`query($id:Int!){ manga(id:$id){ id title url thumbnailUrl author description status genre } }`, { id: mangaId });
      manga = d.manga;
    }
    let chapters = [];
    try {
      const d = await gql(`query($id:Int!){ manga(id:$id){ chapters{ nodes{ id name chapterNumber uploadDate scanlator isRead } } } }`, { id: mangaId });
      chapters = d.manga?.chapters?.nodes || [];
    } catch {}
    if (chapters.length === 0) {
      try {
        const d = await gql(`mutation($id:Int!){ fetchChapters(input:{mangaId:$id}){ chapters{ id name chapterNumber uploadDate scanlator isRead } } }`, { id: mangaId });
        chapters = d.fetchChapters?.chapters || [];
      } catch {}
    }
    const mapped = chapters.map(ch => ({
      id: String(ch.id),
      number: fmtNum(ch.chapterNumber) ?? ch.name?.match(/[\d.]+/)?.[0] ?? '?',
      title: ch.name || '',
      date: fmtDate(ch.uploadDate),
      group: ch.scanlator || '',
      read: ch.isRead || false,
    })).sort((a, b) => parseFloat(b.number) - parseFloat(a.number));

    const result = {
      id: String(manga.id), title: manga.title, cover: fixUrl(manga.thumbnailUrl),
      url: manga.url || '',
      author: manga.author || '', description: manga.description || '', status: manga.status?.toLowerCase() || '',
      tags: Array.isArray(manga.genre) ? manga.genre : (manga.genre ? String(manga.genre).split(', ').filter(Boolean) : []),
      totalChapters: mapped.length, chapters: mapped,
    };
    caches.manga.set(cacheKey, result);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Chapter Pages ──────────────────────────────────────────────────────────
app.get('/api/source/:sourceId/chapter/:chapterId', async (req, res) => {
  const sourceId = String(req.params.sourceId);
  const chapterId = parseInt(req.params.chapterId);
  if (isNaN(chapterId)) return res.status(400).json({ error: 'Invalid chapter ID' });
  const cacheKey = getChapterPagesCacheKey(sourceId, chapterId);
  try {
    const cached = caches.pages.get(cacheKey);
    if (cached) return res.json(cached);
    const data = await gql(`mutation($id:Int!){ fetchChapterPages(input:{chapterId:$id}){ pages } }`, { id: chapterId });
    const result = (data.fetchChapterPages?.pages || []).map(p => fixUrl(p));
    caches.pages.set(cacheKey, result);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Download ───────────────────────────────────────────────────────────────
const DOWNLOAD_CONCURRENCY = 4;
async function fetchBuffer(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await http.get(url, { responseType: 'arraybuffer', timeout: 60000 });
      if (r.status !== 200) throw new Error(`Bad status ${r.status}`);
      return { ok: true, buf: Buffer.from(r.data), ct: r.headers['content-type'] || '' };
    } catch (e) { if (i === retries) return { ok: false, err: e.message }; await sleep(800 * (i + 1)); }
  }
}
async function fetchAllBuffers(urls) {
  const results = new Array(urls.length).fill(null);
  let idx = 0;
  const worker = async () => {
    while (true) {
      const i = idx++; if (i >= urls.length) break;
      results[i] = await fetchBuffer(urls[i]);
    }
  };
    // Limit concurrency to avoid memory blow‑up
    const concurrency = Math.min(DOWNLOAD_CONCURRENCY, 2);
    await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}
function guessExt(url, ct) {
  if (ct.includes('png')) return 'png'; if (ct.includes('webp')) return 'webp';
  if (ct.includes('gif')) return 'gif'; if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
  const ext = url.split('?')[0].split('.').pop().toLowerCase();
  return ['jpg','jpeg','png','webp','gif'].includes(ext) ? (ext === 'jpeg' ? 'jpg' : ext) : 'jpg';
}

app.get('/api/source/:sourceId/chapter/:chapterId/download', async (req, res) => {
  if (!archiver) {
    return res.status(501).json({ error: 'archiver not installed' });
  }
  const sourceId = String(req.params.sourceId);
  const chapterId = parseInt(req.params.chapterId);
  if (isNaN(chapterId)) return res.status(400).json({ error: 'Invalid chapter ID' });
  const { title = `chapter-${chapterId}` } = req.query;
  const safeName = String(title).replace(/[/\\?%*:|"<>]/g, '-');
  try {
    let pages = caches.pages.get(getChapterPagesCacheKey(sourceId, chapterId));
    if (!pages) {
      const data = await gql(`mutation($id:Int!){ fetchChapterPages(input:{chapterId:$id}){ pages } }`, { id: chapterId });
      pages = (data.fetchChapterPages?.pages || []).map(p => fixUrl(p));
    }
    if (!pages.length) return res.status(404).json({ error: 'No pages found' });
    const buffers = await fetchAllBuffers(pages);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.cbz"`);
    const archive = archiver('zip', { zlib: { level: 0 } });
    archive.pipe(res);
    buffers.forEach((r, i) => {
      if (r?.ok) archive.append(r.buf, { name: `${String(i + 1).padStart(4, '0')}.${guessExt(pages[i], r.ct)}` });
    });
    await archive.finalize();
  } catch (e) { if (!res.headersSent) res.status(500).json({ error: e.message }); }
});

app.patch('/api/chapter/:chapterId/read', async (req, res) => {
  const chapterId = parseInt(req.params.chapterId);
  const { isRead } = req.body;
  try {
    await gql(`mutation($id:Int!, $read:Boolean!){ updateChapter(input:{id:$id, isRead:$read}){ chapter{ isRead } } }`, { id: chapterId, read: !!isRead });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.use((req, res) => res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✓ akaReader proxy → http://localhost:${PORT}`);
  console.log(`  Suwayomi        → ${SUWAYOMI}`);
  prewarmExtensions();
});

async function prewarmExtensions() {
  try {
    console.log('[prewarm] Fetching extensions in background...');
    const data = await gql('{ extensions { nodes { pkgName name lang iconUrl versionName isInstalled hasUpdate } } }');
    const nodes = data.extensions?.nodes || [];
    if (nodes.length > 0) {
      caches.extensions.set('all', nodes);
      console.log(`[prewarm] Cached ${nodes.length} extensions`);
    }
  } catch (e) { console.error('[prewarm] failed:', e.message); }
}
