const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;

function sanitizeArchiveName(value, fallback = 'chapter') {
  const cleaned = String(value || '')
    .replace(INVALID_FILENAME_CHARS, '-')
    .replace(/[. ]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
  return cleaned || fallback;
}

function normalizeChapterExport(value = {}) {
  const sourceId = String(value.sourceId || '').trim();
  const chapterId = Number.parseInt(value.chapterId, 10);
  if (!sourceId) throw new Error('The chapter source is missing.');
  if (!Number.isSafeInteger(chapterId) || chapterId <= 0) throw new Error('The chapter ID is invalid.');
  const chapterLabel = value.chapterNum === '' || value.chapterNum == null ? chapterId : value.chapterNum;
  const mangaTitle = sanitizeArchiveName(value.mangaTitle, 'Manga');
  const chapterTitle = sanitizeArchiveName(value.chapterTitle, '');
  const baseName = sanitizeArchiveName(
    `${mangaTitle} - Ch ${chapterLabel}${chapterTitle ? ` - ${chapterTitle}` : ''}`,
    `chapter-${chapterId}`
  );
  return { sourceId, chapterId, mangaTitle, chapterLabel: String(chapterLabel), chapterTitle, baseName };
}

module.exports = { normalizeChapterExport, sanitizeArchiveName };
