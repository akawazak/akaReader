const DOWNLOAD_KEY_SEPARATOR = '___';

export const parseDownloadKey = value => {
  const key = String(value || '');
  const separatorIndex = key.lastIndexOf(DOWNLOAD_KEY_SEPARATOR);
  if (separatorIndex <= 0 || separatorIndex >= key.length - DOWNLOAD_KEY_SEPARATOR.length) {
    return { key, mangaKey: '', chapterId: '' };
  }
  return {
    key,
    mangaKey: key.slice(0, separatorIndex),
    chapterId: key.slice(separatorIndex + DOWNLOAD_KEY_SEPARATOR.length),
  };
};

export const downloadedMangaKeys = keys => new Set(
  Array.from(keys || [], key => parseDownloadKey(key).mangaKey).filter(Boolean)
);

export const summarizeDownloadedChapters = ({ records = [], library = [], readChapters = {} } = {}) => {
  const libraryByKey = new Map(library.map(manga => [String(manga.mangaKey || ''), manga]));
  const groupsByKey = new Map();
  let sizeBytes = 0;
  let pageCount = 0;
  let readCount = 0;

  records.forEach(record => {
    const parsed = parseDownloadKey(record?.key);
    const mangaKey = String(record?.mangaKey || parsed.mangaKey || '');
    const chapterId = String(record?.chapterId ?? parsed.chapterId ?? '');
    if (!mangaKey || !chapterId) return;

    const bytes = Math.max(0, Number(record?.sizeBytes) || 0);
    const pages = Math.max(0, Number(record?.pageCount) || 0);
    const isRead = (readChapters[mangaKey] || []).some(id => String(id) === chapterId);
    const libraryManga = libraryByKey.get(mangaKey);
    const normalized = {
      ...record,
      key: String(record.key),
      mangaKey,
      chapterId,
      chapterNum: record?.chapterNum ?? '',
      mangaTitle: record?.mangaTitle || libraryManga?.title || 'Unknown manga',
      sizeBytes: bytes,
      pageCount: pages,
      isRead,
    };

    sizeBytes += bytes;
    pageCount += pages;
    if (isRead) readCount += 1;

    const group = groupsByKey.get(mangaKey) || {
      mangaKey,
      mangaTitle: normalized.mangaTitle,
      cover: libraryManga?.cover || '',
      sizeBytes: 0,
      pageCount: 0,
      readCount: 0,
      latestSavedAt: 0,
      records: [],
    };
    group.sizeBytes += bytes;
    group.pageCount += pages;
    group.readCount += isRead ? 1 : 0;
    group.latestSavedAt = Math.max(group.latestSavedAt, Number(record?.savedAt) || 0);
    group.records.push(normalized);
    groupsByKey.set(mangaKey, group);
  });

  const groups = [...groupsByKey.values()]
    .map(group => ({
      ...group,
      records: group.records.sort((a, b) => {
        const aNumber = Number.parseFloat(a.chapterNum);
        const bNumber = Number.parseFloat(b.chapterNum);
        if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) return bNumber - aNumber;
        return (Number(b.savedAt) || 0) - (Number(a.savedAt) || 0);
      }),
    }))
    .sort((a, b) => b.sizeBytes - a.sizeBytes || a.mangaTitle.localeCompare(b.mangaTitle));

  return {
    chapterCount: groups.reduce((total, group) => total + group.records.length, 0),
    mangaCount: groups.length,
    pageCount,
    sizeBytes,
    readCount,
    groups,
    readKeys: groups.flatMap(group => group.records.filter(record => record.isRead).map(record => record.key)),
  };
};
