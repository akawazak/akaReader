const normalizeChapterId = value => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const uniqueChapterIds = chapters => {
  const seen = new Set();
  const ids = [];
  for (const chapter of Array.isArray(chapters) ? chapters : []) {
    const id = normalizeChapterId(chapter?.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
};

const chapterUpdateSummary = chapter => ({
  id: normalizeChapterId(chapter?.id),
  number: chapter?.number ?? '',
  name: chapter?.name || chapter?.title || '',
  publishedAt: chapter?.publishedAt || '',
  date: chapter?.date || '',
  group: chapter?.group || '',
});

const validStoredChapterSummaries = value => (
  Array.isArray(value)
    ? value.map(chapterUpdateSummary).filter(chapter => chapter.id)
    : []
);

const mergedChapterSummary = (id, current, previous) => ({
  id,
  number: current?.number !== '' && current?.number !== undefined ? current.number : (previous?.number ?? ''),
  name: current?.name || previous?.name || '',
  publishedAt: current?.publishedAt || previous?.publishedAt || '',
  date: current?.date || previous?.date || '',
  group: current?.group || previous?.group || '',
});

export const reconcileChapterUpdateState = ({
  chapters,
  previous,
  readChapterIds,
  checkedAt = Date.now(),
}) => {
  const currentIds = uniqueChapterIds(chapters);
  const currentIdSet = new Set(currentIds);
  const knownIds = new Set((Array.isArray(previous?.knownIds) ? previous.knownIds : []).map(normalizeChapterId).filter(Boolean));
  const initialized = previous?.initialized === true;
  const discoveredIds = initialized ? currentIds.filter(id => !knownIds.has(id)) : [];
  const readIds = new Set((Array.isArray(readChapterIds) ? readChapterIds : []).map(normalizeChapterId).filter(Boolean));
  const currentChaptersById = new Map();
  for (const chapter of Array.isArray(chapters) ? chapters : []) {
    const summary = chapterUpdateSummary(chapter);
    if (summary.id && !currentChaptersById.has(summary.id)) currentChaptersById.set(summary.id, summary);
  }
  const previousChaptersById = new Map(
    validStoredChapterSummaries(previous?.newChapters).map(chapter => [chapter.id, chapter]),
  );

  for (const chapter of Array.isArray(chapters) ? chapters : []) {
    if (chapter?.read) readIds.add(normalizeChapterId(chapter.id));
  }

  const pendingIds = [];
  const seenPending = new Set();
  for (const id of [...(Array.isArray(previous?.newIds) ? previous.newIds : []), ...discoveredIds]) {
    const normalized = normalizeChapterId(id);
    if (!normalized || seenPending.has(normalized) || !currentIdSet.has(normalized) || readIds.has(normalized)) continue;
    seenPending.add(normalized);
    pendingIds.push(normalized);
  }

  return {
    discoveredIds,
    state: {
      initialized: true,
      knownIds: currentIds,
      newIds: pendingIds,
      newChapters: pendingIds
        .map(id => mergedChapterSummary(id, currentChaptersById.get(id), previousChaptersById.get(id)))
        .filter(Boolean),
      checkedAt,
    },
  };
};

export const chapterUpdateBaseline = (chapters, checkedAt = Date.now()) => (
  reconcileChapterUpdateState({ chapters, previous: null, readChapterIds: [], checkedAt }).state
);

export const nextChapterUpdateDelay = ({ intervalMs, lastCheckedAt = 0, now = Date.now() }) => {
  const interval = Number(intervalMs);
  if (!Number.isFinite(interval) || interval <= 0) return null;
  const lastChecked = Number(lastCheckedAt);
  if (!Number.isFinite(lastChecked) || lastChecked <= 0) return 0;
  return Math.max(0, interval - Math.max(0, now - lastChecked));
};

export const formatRelativeChapterDate = (value, now = Date.now()) => {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return '';
  const releaseDay = new Date(timestamp);
  releaseDay.setHours(0, 0, 0, 0);
  const currentDay = new Date(now);
  currentDay.setHours(0, 0, 0, 0);
  const days = Math.max(0, Math.round((currentDay.getTime() - releaseDay.getTime()) / 86400000));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 730) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
};
