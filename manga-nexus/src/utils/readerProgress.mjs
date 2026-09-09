const normalizeChapterId = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const normalizePage = (value) => {
  const page = Number.parseInt(value, 10);
  return Number.isFinite(page) && page > 0 ? page : 0;
};

export const resolveContinueTarget = (chapters, progress) => {
  const list = Array.isArray(chapters) ? chapters : [];
  const savedId = normalizeChapterId(progress?.chapterId);

  if (savedId) {
    const savedChapter = list.find(chapter => normalizeChapterId(chapter?.id) === savedId);
    if (savedChapter) return { chapter: savedChapter, page: normalizePage(progress?.page) };

    if (list.length === 0) {
      return {
        chapter: { id: progress.chapterId, number: progress.chapterNum },
        page: normalizePage(progress?.page),
      };
    }
  }

  return { chapter: list.at(-1) || null, page: 0 };
};

export const calculateMangaProgressPercent = (manga, progress) => {
  const totalChapters = Number(manga?.totalChapters);
  const chapterNumber = Number(progress?.chapterNum);
  if (!Number.isFinite(totalChapters) || totalChapters <= 0 || !Number.isFinite(chapterNumber)) return null;
  return Math.min(100, Math.max(0, (chapterNumber / totalChapters) * 100));
};
