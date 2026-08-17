export const AUTO_BROWSE_DELAY_MS = 350;
export const AUTO_BROWSE_MAX_RETRIES = 2;

export function mangaResultKey(manga, fallbackSourceId = '') {
  if (!manga || manga.id === undefined || manga.id === null) return '';
  const sourceId = manga.sourceId || fallbackSourceId;
  return `${String(sourceId || '')}::${String(manga.id)}`;
}

export function mergeBrowseResults(existing, incoming, fallbackSourceId = '') {
  const merged = [];
  const seen = new Set();
  let addedCount = 0;

  const appendUnique = (items, countAsNew) => {
    for (const manga of Array.isArray(items) ? items : []) {
      const key = mangaResultKey(manga, fallbackSourceId);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const normalized = manga.sourceId || !fallbackSourceId
        ? manga
        : { ...manga, sourceId: String(fallbackSourceId) };
      merged.push(normalized);
      if (countAsNew) addedCount += 1;
    }
  };

  appendUnique(existing, false);
  appendUnique(incoming, true);
  return { results: merged, addedCount };
}

export function isRetryableBrowseError(error) {
  const status = Number(error?.status || 0);
  return !status || status === 408 || status === 425 || status === 429 || status >= 500;
}

export function autoBrowseRetryDelay(retryCount) {
  if (!retryCount) return AUTO_BROWSE_DELAY_MS;
  return Math.min(4000, 1000 * (2 ** (retryCount - 1)));
}
