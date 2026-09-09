export const SMART_LIBRARY_FILTERS = Object.freeze([
  { id: 'all', label: 'All' },
  { id: 'continue', label: 'Continue' },
  { id: 'unread', label: 'Unread' },
  { id: 'updated', label: 'Updated' },
  { id: 'downloaded', label: 'Offline' },
  { id: 'completed', label: 'Completed' },
]);

export const matchesSmartLibraryFilter = ({
  filter,
  manga,
  mangaKey,
  progressedKeys,
  updatedKeys,
  downloadedKeys,
  readChapters,
  mangaCategories,
}) => {
  if (!filter || filter === 'all') return true;
  if (filter === 'continue') return progressedKeys.has(mangaKey);
  if (filter === 'updated') return updatedKeys.has(mangaKey);
  if (filter === 'downloaded') return downloadedKeys.has(mangaKey);
  if (filter === 'completed') return mangaCategories[mangaKey] === 'completed';
  if (filter === 'unread') {
    if (updatedKeys.has(mangaKey)) return true;
    const total = Number(manga?.totalChapters);
    return Number.isFinite(total) && total > 0 && new Set(readChapters[mangaKey] || []).size < total;
  }
  return true;
};

export const smartLibraryCounts = ({ library = [], getMangaKey, ...state }) => {
  const counts = Object.fromEntries(SMART_LIBRARY_FILTERS.map(filter => [filter.id, 0]));
  library.forEach(manga => {
    const mangaKey = getMangaKey(manga.id, manga.sourceId);
    SMART_LIBRARY_FILTERS.forEach(filter => {
      if (matchesSmartLibraryFilter({ ...state, filter: filter.id, manga, mangaKey })) counts[filter.id] += 1;
    });
  });
  return counts;
};
