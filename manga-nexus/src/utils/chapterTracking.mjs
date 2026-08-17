const normalizeChapterId = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

export const countReadChapterIds = (readChapters) => {
  if (!readChapters || typeof readChapters !== 'object') return 0;

  return Object.values(readChapters).reduce((total, chapterIds) => {
    if (!Array.isArray(chapterIds)) return total;
    const uniqueIds = new Set(chapterIds.map(normalizeChapterId).filter(Boolean));
    return total + uniqueIds.size;
  }, 0);
};

export const getUnreadChapterIds = (chapters, readChapterIds) => {
  if (!Array.isArray(chapters)) return [];

  const readIds = new Set(
    (Array.isArray(readChapterIds) ? readChapterIds : [])
      .map(normalizeChapterId)
      .filter(Boolean),
  );
  const seenIds = new Set();
  const unreadIds = [];

  chapters.forEach((chapter) => {
    const chapterId = normalizeChapterId(chapter?.id);
    if (!chapterId || seenIds.has(chapterId)) return;
    seenIds.add(chapterId);

    if (!chapter?.read && !readIds.has(chapterId)) unreadIds.push(chapterId);
  });

  return unreadIds;
};
