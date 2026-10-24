package com.akareader.mobile.data

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import eu.kanade.tachiyomi.source.model.SChapter
import eu.kanade.tachiyomi.source.model.SManga

/**
 * Gives every (source, url) title and (title, url) chapter a stable integer ID, the same
 * role Suwayomi's database plays on desktop. The renderer only ever sees these IDs; the
 * source + URL pair is what sync uses to match titles across devices.
 */
class LocalDb(context: Context) : SQLiteOpenHelper(context, "akareader.db", null, 1) {

    data class MangaRow(
        val id: Long,
        val sourceId: Long,
        val url: String,
        val title: String,
        val thumbnailUrl: String?,
        val author: String?,
        val artist: String?,
        val description: String?,
        val genre: String?,
        val status: Int,
        val initialized: Boolean,
    ) {
        fun toSManga(): SManga = SManga.create().also {
            it.url = url
            it.title = title
            it.thumbnail_url = thumbnailUrl
            it.author = author
            it.artist = artist
            it.description = description
            it.genre = genre
            it.status = status
            it.initialized = initialized
        }
    }

    data class ChapterRow(
        val id: Long,
        val mangaId: Long,
        val url: String,
        val name: String,
        val number: Float,
        val dateUpload: Long,
        val scanlator: String?,
        val read: Boolean,
    ) {
        fun toSChapter(): SChapter = SChapter.create().also {
            it.url = url
            it.name = name
            it.chapter_number = number
            it.date_upload = dateUpload
            it.scanlator = scanlator
        }
    }

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """CREATE TABLE manga(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_id INTEGER NOT NULL,
                url TEXT NOT NULL,
                title TEXT NOT NULL,
                thumbnail_url TEXT,
                author TEXT, artist TEXT, description TEXT, genre TEXT,
                status INTEGER NOT NULL DEFAULT 0,
                initialized INTEGER NOT NULL DEFAULT 0,
                UNIQUE(source_id, url))""",
        )
        db.execSQL(
            """CREATE TABLE chapter(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                manga_id INTEGER NOT NULL REFERENCES manga(id) ON DELETE CASCADE,
                url TEXT NOT NULL,
                name TEXT NOT NULL,
                number REAL NOT NULL DEFAULT -1,
                date_upload INTEGER NOT NULL DEFAULT 0,
                scanlator TEXT,
                source_order INTEGER NOT NULL DEFAULT 0,
                read INTEGER NOT NULL DEFAULT 0,
                UNIQUE(manga_id, url))""",
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit

    /** Inserts a browse result or refreshes its title/cover; returns its stable ID. */
    @Synchronized
    fun upsertBrowseManga(sourceId: Long, manga: SManga): Long {
        val db = writableDatabase
        val existing = findMangaId(db, sourceId, manga.url)
        val values = ContentValues().apply {
            put("title", manga.title)
            if (!manga.thumbnail_url.isNullOrBlank()) put("thumbnail_url", manga.thumbnail_url)
        }
        if (existing != null) {
            db.update("manga", values, "id = ?", arrayOf(existing.toString()))
            return existing
        }
        values.put("source_id", sourceId)
        values.put("url", manga.url)
        return db.insertOrThrow("manga", null, values)
    }

    @Synchronized
    fun updateMangaDetails(id: Long, manga: SManga) {
        val values = ContentValues().apply {
            put("title", manga.title)
            if (!manga.thumbnail_url.isNullOrBlank()) put("thumbnail_url", manga.thumbnail_url)
            put("author", manga.author)
            put("artist", manga.artist)
            put("description", manga.description)
            put("genre", manga.genre)
            put("status", manga.status)
            put("initialized", 1)
        }
        writableDatabase.update("manga", values, "id = ?", arrayOf(id.toString()))
    }

    fun getManga(id: Long): MangaRow? = readableDatabase.rawQuery(
        "SELECT id, source_id, url, title, thumbnail_url, author, artist, description, genre, status, initialized FROM manga WHERE id = ?",
        arrayOf(id.toString()),
    ).use { c ->
        if (!c.moveToFirst()) return null
        MangaRow(
            id = c.getLong(0),
            sourceId = c.getLong(1),
            url = c.getString(2),
            title = c.getString(3),
            thumbnailUrl = c.getString(4),
            author = c.getString(5),
            artist = c.getString(6),
            description = c.getString(7),
            genre = c.getString(8),
            status = c.getInt(9),
            initialized = c.getInt(10) == 1,
        )
    }

    /** Replaces the chapter list with what the source returned, keeping IDs for known URLs. */
    @Synchronized
    fun syncChapters(mangaId: Long, chapters: List<SChapter>): List<ChapterRow> {
        val db = writableDatabase
        db.beginTransaction()
        try {
            val seen = HashSet<String>()
            chapters.forEachIndexed { index, ch ->
                if (!seen.add(ch.url)) return@forEachIndexed
                val values = ContentValues().apply {
                    put("name", ch.name)
                    put("number", ch.chapter_number)
                    put("date_upload", ch.date_upload)
                    put("scanlator", ch.scanlator)
                    put("source_order", index)
                }
                val updated = db.update("chapter", values, "manga_id = ? AND url = ?", arrayOf(mangaId.toString(), ch.url))
                if (updated == 0) {
                    values.put("manga_id", mangaId)
                    values.put("url", ch.url)
                    db.insertOrThrow("chapter", null, values)
                }
            }
            val placeholders = seen.joinToString(",") { "?" }
            if (seen.isNotEmpty()) {
                db.delete("chapter", "manga_id = ? AND url NOT IN ($placeholders)", arrayOf(mangaId.toString(), *seen.toTypedArray()))
            }
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
        return getChapters(mangaId)
    }

    fun getChapters(mangaId: Long): List<ChapterRow> = readableDatabase.rawQuery(
        "SELECT id, manga_id, url, name, number, date_upload, scanlator, read FROM chapter WHERE manga_id = ? ORDER BY source_order",
        arrayOf(mangaId.toString()),
    ).use { c ->
        buildList {
            while (c.moveToNext()) {
                add(ChapterRow(c.getLong(0), c.getLong(1), c.getString(2), c.getString(3), c.getFloat(4), c.getLong(5), c.getString(6), c.getInt(7) == 1))
            }
        }
    }

    fun getChapter(id: Long): ChapterRow? = readableDatabase.rawQuery(
        "SELECT id, manga_id, url, name, number, date_upload, scanlator, read FROM chapter WHERE id = ?",
        arrayOf(id.toString()),
    ).use { c ->
        if (!c.moveToFirst()) return null
        ChapterRow(c.getLong(0), c.getLong(1), c.getString(2), c.getString(3), c.getFloat(4), c.getLong(5), c.getString(6), c.getInt(7) == 1)
    }

    fun setChapterRead(id: Long, read: Boolean) {
        writableDatabase.update("chapter", ContentValues().apply { put("read", if (read) 1 else 0) }, "id = ?", arrayOf(id.toString()))
    }

    private fun findMangaId(db: SQLiteDatabase, sourceId: Long, url: String): Long? =
        db.rawQuery("SELECT id FROM manga WHERE source_id = ? AND url = ?", arrayOf(sourceId.toString(), url)).use { c ->
            if (c.moveToFirst()) c.getLong(0) else null
        }
}
