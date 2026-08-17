export const DOWNLOAD_QUEUE_STORAGE_KEY = 'downloadQueueV1';
export const DOWNLOAD_MAX_ATTEMPTS = 3;
export const DOWNLOAD_STORAGE_RESERVE_BYTES = 96 * 1024 * 1024;

const VALID_STATUSES = new Set(['pending', 'downloading', 'done', 'error', 'cancelled']);

export function normalizeDownloadQueue(value) {
  if (!Array.isArray(value)) return [];

  const seen = new Set();
  const normalized = [];
  for (const raw of value.slice(-250)) {
    if (!raw || typeof raw !== 'object') continue;
    const id = String(raw.id || '').slice(0, 300);
    const mangaId = String(raw.mangaId ?? '').slice(0, 300);
    const chapterId = String(raw.chapterId ?? '').slice(0, 300);
    const sourceId = String(raw.sourceId ?? '').slice(0, 300);
    if (!id || !mangaId || !chapterId || !sourceId || seen.has(id)) continue;
    seen.add(id);

    const previousStatus = VALID_STATUSES.has(raw.status) ? raw.status : 'error';
    const interrupted = previousStatus === 'downloading';
    normalized.push({
      id,
      mangaId,
      mangaTitle: String(raw.mangaTitle || 'Untitled manga').slice(0, 500),
      chapterId,
      chapterNum: String(raw.chapterNum ?? '?').slice(0, 100),
      sourceId,
      downloadKey: String(raw.downloadKey || '').slice(0, 700),
      status: interrupted ? 'pending' : previousStatus,
      progress: interrupted ? 0 : Math.max(0, Math.min(100, Number(raw.progress) || 0)),
      pagesLoaded: interrupted ? 0 : Math.max(0, Number(raw.pagesLoaded) || 0),
      pagesTotal: interrupted ? 0 : Math.max(0, Number(raw.pagesTotal) || 0),
      attempts: interrupted ? 0 : Math.max(0, Math.min(DOWNLOAD_MAX_ATTEMPTS, Number(raw.attempts) || 0)),
      error: interrupted ? 'Recovered after akaReader closed' : (raw.error ? String(raw.error).slice(0, 500) : null),
      recovered: interrupted || !!raw.recovered,
      retryAt: interrupted ? 0 : Math.max(0, Number(raw.retryAt) || 0),
      createdAt: Number(raw.createdAt) || Date.now(),
      updatedAt: Number(raw.updatedAt) || Date.now(),
    });
  }
  return normalized;
}

export function queueForPersistence(queue) {
  return normalizeDownloadQueue(queue).filter(item => item.status !== 'cancelled');
}

export function storageCapacityResult(estimate, reserveBytes = DOWNLOAD_STORAGE_RESERVE_BYTES) {
  const quota = Number(estimate?.quota);
  const usage = Number(estimate?.usage);
  if (!Number.isFinite(quota) || !Number.isFinite(usage) || quota <= 0) {
    return { ok: true, known: false, freeBytes: null, reserveBytes };
  }
  const freeBytes = Math.max(0, quota - usage);
  return { ok: freeBytes >= reserveBytes, known: true, freeBytes, reserveBytes };
}

export function formatByteSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return 'unknown';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${unit}`;
}
