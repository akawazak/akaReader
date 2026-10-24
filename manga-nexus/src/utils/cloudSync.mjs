// Project and public key: the publishable key is safe to ship; `sync_state` rows are
// readable and writable only by their owner (row level security).
export const CLOUD_CONFIG = Object.freeze({
  url: 'https://bmavfeblgaeyjnstcwad.supabase.co',
  anonKey: 'sb_publishable_OTxUeDOVPL3aQx5N5zKneg_zQOATdqz',
});

// Account sync between devices through Supabase (Auth + one row per user in `sync_state`).
//
// Manga and chapter IDs are local to each device (Suwayomi on desktop, SQLite on Android),
// so the synced document never contains them. A title is identified by its source ID plus
// the source's own manga URL (`syncKey`), and a chapter by its number. `syncIndex` maps
// local IDs to those stable keys; it fills in whenever a title's details load.

export const SYNC_DOC_VERSION = 1;
export const SYNC_MAX_TITLES = 5000;

export const makeSyncKey = (sourceId, url) => (sourceId != null && url ? `${sourceId}|${url}` : null);

const chapterNumberKey = (value) => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) && n >= 0 ? String(n) : null;
};

export const splitSyncKey = (syncKey) => {
  const at = String(syncKey).indexOf('|');
  return at > 0 ? { sourceId: syncKey.slice(0, at), url: syncKey.slice(at + 1) } : null;
};

/** Record a loaded title in the index: its stable key and each chapter ID's number. */
export function indexMangaDetail(index, mangaKey, sourceId, detail) {
  const syncKey = makeSyncKey(sourceId, detail?.url);
  if (!mangaKey || !syncKey) return index;
  const chapters = {};
  (Array.isArray(detail.chapters) ? detail.chapters : []).forEach(ch => {
    const num = chapterNumberKey(ch?.number);
    if (ch?.id != null && num) chapters[String(ch.id)] = num;
  });
  const prev = index[mangaKey];
  if (prev?.syncKey === syncKey && JSON.stringify(prev.chapters) === JSON.stringify(chapters)) return index;
  return { ...index, [mangaKey]: { syncKey, id: String(detail.id ?? prev?.id ?? ''), sourceId: String(sourceId), chapters } };
}

const emptyDoc = () => ({ version: SYNC_DOC_VERSION, titles: {}, extensions: {} });

// Extensions are keyed by package name, which is the same on desktop and Android (both use
// the Keiyoushi store). `at` is when a user installed or removed it; 0 means "was already here".
// Installs spread to other devices; a removal only stops the package spreading, it never
// uninstalls it anywhere else.
function buildExtensions(previous, installed, changes) {
  const out = structuredClone(previous?.extensions || {});
  for (const [pkg, change] of Object.entries(changes)) {
    if (!out[pkg] || (change.at || 0) >= (out[pkg].at || 0)) out[pkg] = { name: change.name || out[pkg]?.name || '', installed: !!change.installed, at: change.at || 0 };
  }
  for (const ext of installed) {
    if (!out[ext.pkgName]) out[ext.pkgName] = { name: ext.name || '', installed: true, at: 0 };
    else if (!out[ext.pkgName].name && ext.name) out[ext.pkgName].name = ext.name;
  }
  return out;
}

/** Packages the account has installed that this device's store offers but lacks. */
export function planExtensionInstalls(doc, storeExtensions) {
  const byPkg = new Map(storeExtensions.map(e => [e.pkgName, e]));
  return Object.entries(doc?.extensions || {})
    .filter(([pkg, e]) => e.installed && byPkg.has(pkg) && !byPkg.get(pkg).isInstalled)
    .map(([pkg]) => pkg);
}

/**
 * Build this device's view of the sync document from local state.
 * `previous` is the last merged document, so chapter numbers this device cannot map to
 * an ID yet (title never opened here) are carried forward instead of dropped.
 */
export function buildLocalDoc({ library, history = [], progress, readChapters, index, removals = {}, getMangaKey, previous, sourceNames = {}, installedExtensions = [], extensionChanges = {} }) {
  const doc = emptyDoc();
  doc.extensions = buildExtensions(previous, installedExtensions, extensionChanges);
  const prevTitles = previous?.titles || {};
  const libraryByKey = new Map(library.map(m => [getMangaKey(m.id, m.sourceId), m]));
  const historyByKey = new Map(history.map(m => [getMangaKey(m.id, m.sourceId), m]));

  const ensure = (syncKey, base) => {
    if (!doc.titles[syncKey]) {
      const prev = prevTitles[syncKey];
      doc.titles[syncKey] = {
        title: base?.title || prev?.title || '',
        cover: base?.cover || prev?.cover || '',
        sourceName: sourceNames[splitSyncKey(syncKey)?.sourceId] || prev?.sourceName || '',
        inLibrary: prev?.inLibrary || false,
        libraryAt: prev?.libraryAt || 0,
        read: [...(prev?.read || [])],
        progress: prev?.progress || null,
      };
    }
    return doc.titles[syncKey];
  };

  // Titles in the library carry their URL; titles only in the index were opened here.
  const keyFor = (mangaKey, manga) => index[mangaKey]?.syncKey || makeSyncKey(manga?.sourceId, manga?.url);

  for (const [mangaKey, manga] of libraryByKey) {
    const syncKey = keyFor(mangaKey, manga);
    if (!syncKey) continue;
    const entry = ensure(syncKey, manga);
    const addedAt = Number(manga.addedAt) || 0;
    // An older add does not undo a newer removal made on another device.
    if (addedAt >= entry.libraryAt) { entry.inLibrary = true; entry.libraryAt = addedAt; }
  }
  for (const [syncKey, at] of Object.entries(removals)) {
    const entry = doc.titles[syncKey] || (prevTitles[syncKey] ? ensure(syncKey) : null);
    if (entry && at > entry.libraryAt) { entry.inLibrary = false; entry.libraryAt = at; }
  }

  for (const [mangaKey, info] of Object.entries(index)) {
    const local = progress[mangaKey];
    const readIds = readChapters[mangaKey] || [];
    if (!local && !readIds.length && !libraryByKey.has(mangaKey)) continue;
    const entry = ensure(info.syncKey, libraryByKey.get(mangaKey) || historyByKey.get(mangaKey));
    if (!entry.title) {
      const named = historyByKey.get(mangaKey);
      if (named) { entry.title = named.title || ''; entry.cover = entry.cover || named.cover || ''; }
    }
    const read = new Set(entry.read);
    readIds.forEach(id => { const num = info.chapters[String(id)]; if (num) read.add(num); });
    entry.read = [...read];
    if (local?.lastRead && (!entry.progress || local.lastRead > entry.progress.lastRead)) {
      // Progress stores chapterNum '0' when the number is unknown, so the index wins.
      const num = info.chapters[String(local.chapterId)] || (String(local.chapterNum) !== '0' ? chapterNumberKey(local.chapterNum) : null);
      if (num) entry.progress = { chapterNum: num, page: Number(local.page) || 0, lastRead: local.lastRead };
    }
  }
  for (const [key, t] of Object.entries(doc.titles)) {
    if (!t.inLibrary && !t.libraryAt && !t.read.length && !t.progress) delete doc.titles[key];
  }
  return doc;
}

/** Merge two documents: newest library change wins, read chapters are unioned, furthest-recent progress wins. */
export function mergeDocs(a, b) {
  const doc = emptyDoc();
  const keys = new Set([...Object.keys(a?.titles || {}), ...Object.keys(b?.titles || {})]);
  for (const key of keys) {
    const x = a?.titles?.[key];
    const y = b?.titles?.[key];
    if (!x || !y) { doc.titles[key] = structuredClone(x || y); continue; }
    const lib = (y.libraryAt || 0) > (x.libraryAt || 0) ? y : x;
    const prog = (y.progress?.lastRead || 0) > (x.progress?.lastRead || 0) ? y.progress : x.progress;
    doc.titles[key] = {
      title: x.title || y.title || '',
      cover: x.cover || y.cover || '',
      sourceName: x.sourceName || y.sourceName || '',
      inLibrary: !!lib.inLibrary,
      libraryAt: lib.libraryAt || 0,
      read: [...new Set([...(x.read || []), ...(y.read || [])])],
      progress: prog ? { ...prog } : null,
    };
  }
  for (const pkg of new Set([...Object.keys(a?.extensions || {}), ...Object.keys(b?.extensions || {})])) {
    const x = a?.extensions?.[pkg];
    const y = b?.extensions?.[pkg];
    const win = !x || (y && ((y.at || 0) > (x.at || 0) || ((y.at || 0) === (x.at || 0) && y.installed))) ? y : x;
    doc.extensions[pkg] = { ...win, name: win.name || x?.name || y?.name || '' };
  }
  const entries = Object.entries(doc.titles);
  if (entries.length > SYNC_MAX_TITLES) {
    const lastTouched = ([, t]) => Math.max(t.libraryAt || 0, t.progress?.lastRead || 0) + (t.inLibrary ? 1e15 : 0);
    doc.titles = Object.fromEntries(entries.sort((p, q) => lastTouched(q) - lastTouched(p)).slice(0, SYNC_MAX_TITLES));
  }
  return doc;
}

export const docsEqual = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const canonical = (doc) => [
  Object.keys(doc?.titles || {}).sort().map(k => {
    const t = doc.titles[k];
    return [k, t.inLibrary, t.libraryAt, [...(t.read || [])].sort(), t.progress?.chapterNum, t.progress?.page, t.progress?.lastRead];
  }),
  Object.keys(doc?.extensions || {}).sort().map(k => [k, doc.extensions[k].installed, doc.extensions[k].at, doc.extensions[k].name]),
];

/**
 * Work out what the merged document changes on this device. Titles that are known here
 * (in the index) produce direct state changes; titles that are not are returned in
 * `unresolved` so the caller can look them up on their source.
 */
export function planLocalChanges({ doc, library, progress, readChapters, index, getMangaKey }) {
  const bySyncKey = new Map(Object.entries(index).map(([mangaKey, info]) => [info.syncKey, mangaKey]));
  library.forEach(m => {
    const key = makeSyncKey(m.sourceId, m.url);
    if (key && !bySyncKey.has(key)) bySyncKey.set(key, getMangaKey(m.id, m.sourceId));
  });
  const libraryKeys = new Set(library.map(m => getMangaKey(m.id, m.sourceId)));
  const changes = { progress: {}, read: {}, history: [], addToLibrary: [], removeFromLibrary: [], unresolved: [] };

  for (const [syncKey, t] of Object.entries(doc?.titles || {})) {
    const mangaKey = bySyncKey.get(syncKey);
    if (!mangaKey) {
      if (t.inLibrary || t.progress) changes.unresolved.push({ syncKey, ...t });
      continue;
    }
    const info = index[mangaKey];
    if (t.inLibrary && !libraryKeys.has(mangaKey) && info?.id) changes.addToLibrary.push({ mangaKey, syncKey, id: info.id, sourceId: info.sourceId, ...t });
    if (!t.inLibrary && libraryKeys.has(mangaKey)) {
      const local = library.find(m => getMangaKey(m.id, m.sourceId) === mangaKey);
      if ((t.libraryAt || 0) > (Number(local?.addedAt) || 0)) changes.removeFromLibrary.push(mangaKey);
    }
    const local = progress[mangaKey];
    if (t.progress && t.progress.lastRead > (local?.lastRead || 0)) {
      const chapterId = info ? Object.keys(info.chapters).find(id => info.chapters[id] === t.progress.chapterNum) || null : null;
      changes.progress[mangaKey] = { chapterId, chapterNum: t.progress.chapterNum, page: t.progress.page || 0, lastRead: t.progress.lastRead };
      if (info?.id) changes.history.push({ id: info.id, sourceId: info.sourceId, title: t.title, cover: t.cover, lastRead: t.progress.lastRead });
    }
    if (info && t.read?.length) {
      const have = new Set((readChapters[mangaKey] || []).map(String));
      const wanted = new Set(t.read);
      const add = Object.keys(info.chapters).filter(id => wanted.has(info.chapters[id]) && !have.has(id));
      if (add.length) changes.read[mangaKey] = add;
    }
  }
  return changes;
}

/** PKCE verifier and S256 challenge for an OAuth sign-in. */
export async function createPkcePair() {
  const bytes = crypto.getRandomValues(new Uint8Array(48));
  const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const verifier = b64url(bytes);
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  return { verifier, challenge };
}

// ── Supabase REST client (no SDK; Auth + PostgREST over fetch) ─────────────

export function createCloudClient({ url, anonKey, fetchImpl = (...args) => fetch(...args) }) {
  const base = String(url || '').replace(/\/+$/, '');
  // Publishable keys (sb_publishable_…) are not JWTs, so Authorization carries only a user token.
  const headers = (token) => ({ apikey: anonKey, ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' });

  const request = async (path, { token, method = 'GET', body, prefer } = {}) => {
    const res = await fetchImpl(`${base}${path}`, {
      method,
      headers: { ...headers(token), ...(prefer ? { Prefer: prefer } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const message = data?.msg || data?.error_description || data?.message || data?.error || `Request failed (${res.status})`;
      const error = new Error(message);
      error.status = res.status;
      throw error;
    }
    return data;
  };

  const toSession = (data) => {
    if (!data?.access_token) throw new Error('Check your email to confirm the account, then sign in.');
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
      user: { id: data.user?.id, email: data.user?.email },
    };
  };

  return {
    configured: !!(base && anonKey),
    signUp: async (email, password) => toSession(await request('/auth/v1/signup', { method: 'POST', body: { email, password } })),
    signIn: async (email, password) => toSession(await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } })),
    refresh: async (session) => toSession(await request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refreshToken } })),
    oauthUrl: (provider, redirectTo, codeChallenge) => `${base}/auth/v1/authorize?${new URLSearchParams({
      provider, redirect_to: redirectTo, code_challenge: codeChallenge, code_challenge_method: 's256',
    })}`,
    exchangeCode: async (authCode, codeVerifier) => toSession(await request('/auth/v1/token?grant_type=pkce', { method: 'POST', body: { auth_code: authCode, code_verifier: codeVerifier } })),
    signOut: (session) => request('/auth/v1/logout', { method: 'POST', token: session.accessToken }).catch(() => null),
    pull: async (session) => {
      const rows = await request('/rest/v1/sync_state?select=doc,updated_at', { token: session.accessToken });
      return rows?.[0]?.doc || null;
    },
    push: (session, doc) => request('/rest/v1/sync_state?on_conflict=user_id', {
      token: session.accessToken,
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: { user_id: session.user.id, doc, updated_at: new Date().toISOString() },
    }),
  };
}
