package com.akareader.mobile.server

import android.content.Context
import android.net.Uri
import android.util.Log
import com.akareader.mobile.data.LocalDb
import com.akareader.mobile.engine.ExtensionManager
import eu.kanade.tachiyomi.network.GET
import eu.kanade.tachiyomi.network.HttpException
import eu.kanade.tachiyomi.network.awaitSuccess
import eu.kanade.tachiyomi.source.CatalogueSource
import eu.kanade.tachiyomi.source.model.Page
import eu.kanade.tachiyomi.source.model.SManga
import eu.kanade.tachiyomi.source.online.HttpSource
import fi.iki.elonen.NanoHTTPD
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import java.io.FileNotFoundException
import java.security.SecureRandom
import java.text.DateFormat
import java.time.Instant
import java.util.Date
import java.util.Locale

/**
 * Answers the same `/api/...` routes as `backend/server.js` so the shared React renderer
 * runs unchanged, but backed by on-device extensions instead of Suwayomi. It also serves
 * the renderer's built assets, so the page and the API share one loopback origin.
 */
class ApiServer(
    private val context: Context,
    private val db: LocalDb,
    private val extensions: ExtensionManager,
) : NanoHTTPD(HOST, PORT) {

    val origin = "http://$HOST:$PORT"
    val token: String = ByteArray(24).also { SecureRandom().nextBytes(it) }.joinToString("") { "%02x".format(it) }

    fun launch() = start(SOCKET_READ_TIMEOUT, true)

    override fun serve(session: IHTTPSession): Response {
        val path = session.uri
        if (!path.startsWith("/api/")) return serveAsset(path)
        if (!authorized(session)) return json(Response.Status.UNAUTHORIZED, JSONObject().put("error", "Unauthorized"))
        return try {
            route(session, path.removePrefix("/api"))
        } catch (e: Throwable) {
            Log.w(TAG, "${session.method} $path failed", e)
            sourceError(e)
        }
    }

    private fun authorized(session: IHTTPSession): Boolean {
        val header = session.headers["x-akareader-token"]
        val query = session.parameters["api_token"]?.firstOrNull()
        return header == token || query == token
    }

    private fun route(session: IHTTPSession, path: String): Response {
        val method = session.method
        val parts = path.trim('/').split('/').map { Uri.decode(it) }
        val q = { key: String -> session.parameters[key]?.firstOrNull() }
        val force = q("force") in setOf("1", "true")

        return when {
            parts == listOf("ping") -> json(JSONObject().put("ok", true).put("timestamp", System.currentTimeMillis()))
            // `suwayomi` is the renderer's "sources are ready" flag; on device they always are.
            parts == listOf("health") -> json(JSONObject().put("ok", true).put("suwayomi", true).put("timestamp", System.currentTimeMillis()))
            parts == listOf("img") -> image(q("url"))
            parts == listOf("extensions") -> listExtensions(force)
            parts.size == 3 && parts[0] == "extensions" && method == Method.POST -> {
                when (parts[1]) {
                    "install", "update" -> runBlocking { extensions.install(parts[2]) }
                    "uninstall" -> extensions.uninstall(parts[2])
                    else -> return notFound(method, path)
                }
                json(JSONObject().put("ok", true))
            }
            parts == listOf("sources") -> listSources()
            parts.size == 3 && parts[0] == "source" && parts[2] == "search" ->
                search(parts[1].toLong(), q("q").orEmpty(), q("page")?.toIntOrNull()?.coerceAtLeast(1) ?: 1, q("sort") ?: "latest", q)
            parts.size == 4 && parts[0] == "source" && parts[2] == "manga" -> mangaDetail(parts[1].toLong(), parts[3].toLong())
            parts.size == 4 && parts[0] == "source" && parts[2] == "chapter" -> chapterPages(parts[1].toLong(), parts[3].toLong())
            parts.size == 3 && parts[0] == "chapter" && parts[2] == "read" -> {
                val body = HashMap<String, String>().also { session.parseBody(it) }["postData"].orEmpty()
                db.setChapterRead(parts[1].toLong(), runCatching { JSONObject(body).optBoolean("isRead") }.getOrDefault(false))
                json(JSONObject().put("ok", true))
            }
            else -> notFound(method, path)
        }
    }

    // ── Extensions & sources ───────────────────────────────────────────────

    private fun listExtensions(force: Boolean): Response {
        val index = runBlocking { extensions.storeIndex(force) }
        val local = extensions.installedExtensions().associateBy { it.pkgName }
        val out = JSONArray()
        index.extensions.forEach { ext ->
            val have = local[ext.packageName]
            out.put(
                JSONObject()
                    .put("pkgName", ext.packageName)
                    .put("apkName", ext.resources.apkUrl.substringAfterLast('/'))
                    .put("name", ext.name.removePrefix("Tachiyomi: "))
                    .put("lang", ext.lang)
                    .put("isInstalled", have != null)
                    .put("isNsfw", ext.isNsfw)
                    .put("hasUpdate", have != null && have.versionCode < ext.versionCode)
                    .put("iconUrl", ext.resources.iconUrl)
                    .put("versionName", have?.versionName ?: ext.versionName)
                    .put("versionCode", have?.versionCode ?: ext.versionCode),
            )
        }
        return json(out)
    }

    private fun listSources(): Response {
        val icons = runCatching { runBlocking { extensions.storeIndex() } }.getOrNull()
            ?.extensions?.associate { it.packageName to it.resources.iconUrl }.orEmpty()
        val out = JSONArray()
        extensions.installedExtensions().forEach { ext ->
            ext.sources.forEach { source ->
                out.put(
                    JSONObject()
                        // Source IDs are 64-bit; strings keep JavaScript from rounding them.
                        .put("id", source.id.toString())
                        .put("name", source.name)
                        .put("lang", source.lang)
                        .put("iconUrl", icons[ext.pkgName] ?: JSONObject.NULL)
                        .put("displayName", source.toString())
                        .put("homeUrl", (source as? HttpSource)?.baseUrl ?: "")
                        .put("isNsfw", ext.isNsfw),
                )
            }
        }
        return json(out)
    }

    private fun requireSource(sourceId: Long): CatalogueSource =
        extensions.source(sourceId) ?: throw FileNotFoundException("Source $sourceId is not installed")

    // ── Browse, details, pages ─────────────────────────────────────────────

    private fun search(sourceId: Long, query: String, page: Int, sort: String, q: (String) -> String?): Response {
        val source = requireSource(sourceId)
        val result = runBlocking {
            when {
                query.isNotEmpty() -> source.getSearchManga(page, query, source.getFilterList())
                sort == "popular" || !source.supportsLatest -> source.getPopularManga(page)
                else -> runCatching { source.getLatestUpdates(page) }.getOrElse { source.getPopularManga(page) }
            }
        }
        val results = JSONArray()
        result.mangas.forEach { manga ->
            val id = db.upsertBrowseManga(sourceId, manga)
            results.put(
                JSONObject()
                    .put("id", id.toString())
                    .put("title", manga.title)
                    .put("cover", coverUrl(sourceId, manga.thumbnail_url))
                    .put("url", manga.url),
            )
        }
        val filters = JSONObject().put("sort", sort).put("status", q("status") ?: "all")
            .put("contentType", q("contentType") ?: "all").put("tags", q("tags").orEmpty())
        return json(JSONObject().put("results", results).put("hasNextPage", result.hasNextPage).put("requestedFilters", filters))
    }

    private fun mangaDetail(sourceId: Long, mangaId: Long): Response {
        val source = requireSource(sourceId)
        val row = db.getManga(mangaId) ?: throw FileNotFoundException("Unknown manga $mangaId")
        val existing = db.getChapters(mangaId).map { it.toSChapter() }
        val update = runBlocking { source.getMangaUpdate(row.toSManga(), existing, fetchDetails = true, fetchChapters = true) }
        update.manga.url = row.url
        if (update.manga.title.isBlank()) update.manga.title = row.title
        db.updateMangaDetails(mangaId, update.manga)
        val chapters = db.syncChapters(mangaId, update.chapters)
        val manga = update.manga

        val mapped = chapters.map { ch ->
            val number = ch.number.takeIf { it >= 0 } ?: NUMBER_IN_NAME.find(ch.name)?.value?.toFloatOrNull()
            JSONObject()
                .put("id", ch.id.toString())
                .put("number", number?.let(::formatNumber) ?: "?")
                .put("title", ch.name)
                .put("date", if (ch.dateUpload > 0) DateFormat.getDateInstance(DateFormat.SHORT, Locale.US).format(Date(ch.dateUpload)) else "")
                .put("publishedAt", if (ch.dateUpload > 0) Instant.ofEpochMilli(ch.dateUpload).toString() else "")
                .put("group", ch.scanlator.orEmpty())
                .put("read", ch.read) to (number ?: Float.NEGATIVE_INFINITY)
        }.sortedByDescending { it.second }.map { it.first }

        val tags = JSONArray()
        manga.genre?.split(',')?.map { it.trim() }?.filter { it.isNotEmpty() }?.forEach { tags.put(it) }
        return json(
            JSONObject()
                .put("id", mangaId.toString())
                .put("title", manga.title)
                .put("cover", coverUrl(sourceId, manga.thumbnail_url ?: row.thumbnailUrl))
                .put("url", row.url)
                .put("author", manga.author ?: manga.artist ?: "")
                .put("description", manga.description.orEmpty())
                .put("status", STATUS_NAMES[manga.status] ?: "unknown")
                .put("tags", tags)
                .put("totalChapters", mapped.size)
                .put("chapters", JSONArray(mapped))
                .put("chapterListRefreshedAt", System.currentTimeMillis()),
        )
    }

    private fun chapterPages(sourceId: Long, chapterId: Long): Response {
        val source = requireSource(sourceId)
        val chapter = db.getChapter(chapterId) ?: throw FileNotFoundException("Unknown chapter $chapterId")
        val pages = runBlocking { source.getPageList(chapter.toSChapter()) }
        val out = JSONArray()
        pages.forEachIndexed { i, page ->
            out.put(imageRef(sourceId, page.imageUrl, page.url, i, kind = "page"))
        }
        return json(out)
    }

    // ── Images ─────────────────────────────────────────────────────────────

    /**
     * Images are addressed as relative `/src-img/...` refs. The renderer's proxyImg()
     * turns relative URLs into `/api/img?url=...`, and relative refs survive in saved
     * library state regardless of which port or host served them.
     */
    private fun imageRef(sourceId: Long, imageUrl: String?, pageUrl: String, index: Int, kind: String): String =
        Uri.Builder().path("/src-img/$sourceId")
            .appendQueryParameter("u", imageUrl.orEmpty())
            .appendQueryParameter("p", pageUrl)
            .appendQueryParameter("i", index.toString())
            .appendQueryParameter("kind", kind)
            .build().toString()

    private fun coverUrl(sourceId: Long, thumbnail: String?): Any =
        if (thumbnail.isNullOrBlank()) JSONObject.NULL else imageRef(sourceId, thumbnail, "", 0, kind = "cover")

    private fun image(url: String?): Response {
        val ref = Uri.parse(url ?: return status(Response.Status.BAD_REQUEST))
        val segments = ref.pathSegments
        if (segments.size != 2 || segments[0] != "src-img") return status(Response.Status.FORBIDDEN)
        val source = extensions.source(segments[1].toLongOrNull() ?: return status(Response.Status.BAD_REQUEST)) as? HttpSource
            ?: return status(Response.Status.NOT_FOUND)
        val page = Page(
            index = ref.getQueryParameter("i")?.toIntOrNull() ?: 0,
            url = ref.getQueryParameter("p").orEmpty(),
            imageUrl = ref.getQueryParameter("u")?.takeIf { it.isNotEmpty() },
        )
        val isCover = ref.getQueryParameter("kind") == "cover"
        return runBlocking {
            if (page.imageUrl == null) page.imageUrl = source.getImageUrl(page)
            // Like Mihon, covers are a plain GET with the source's headers; imageRequest() is for pages only.
            val upstream = if (isCover) {
                source.client.newCall(GET(page.imageUrl!!, source.headers)).awaitSuccess()
            } else {
                source.getImage(page)
            }
            upstream.use { upstream ->
                val type = upstream.body.contentType()?.toString() ?: "application/octet-stream"
                val bytes = upstream.body.bytes()
                newFixedLengthResponse(Response.Status.OK, type, bytes.inputStream(), bytes.size.toLong()).apply {
                    addHeader("Cache-Control", "public, max-age=86400")
                }
            }
        }
    }

    // ── Static renderer ────────────────────────────────────────────────────

    private fun serveAsset(rawPath: String): Response {
        val path = rawPath.trimStart('/').ifEmpty { "index.html" }
        if (path.contains("..")) return status(Response.Status.FORBIDDEN)
        val name = runCatching { context.assets.open(path).close(); path }.getOrElse { "index.html" }
        val bytes = context.assets.open(name).use { it.readBytes() }
        return newFixedLengthResponse(Response.Status.OK, mimeFor(name), bytes.inputStream(), bytes.size.toLong()).apply {
            addHeader("Cache-Control", if (name == "index.html") "no-cache" else "public, max-age=31536000, immutable")
        }
    }

    private fun mimeFor(name: String) = when (name.substringAfterLast('.').lowercase()) {
        "html" -> "text/html; charset=utf-8"
        "js", "mjs" -> "text/javascript; charset=utf-8"
        "css" -> "text/css; charset=utf-8"
        "json" -> "application/json"
        "svg" -> "image/svg+xml"
        "png" -> "image/png"
        "jpg", "jpeg" -> "image/jpeg"
        "webp" -> "image/webp"
        "ico" -> "image/x-icon"
        "woff2" -> "font/woff2"
        "woff" -> "font/woff"
        else -> "application/octet-stream"
    }

    // ── Responses ──────────────────────────────────────────────────────────

    private fun json(body: Any, status: Response.Status = Response.Status.OK): Response =
        newFixedLengthResponse(status, "application/json; charset=utf-8", body.toString()).apply {
            addHeader("Cache-Control", "no-store")
        }

    private fun json(status: Response.Status, body: Any) = json(body, status)

    private fun status(status: Response.Status) = newFixedLengthResponse(status, "text/plain", "")

    private fun notFound(method: Method, path: String) =
        json(Response.Status.NOT_FOUND, JSONObject().put("error", "Route not found: $method /api$path"))

    /** Same compact shape as backend/source-errors.js; never forwards stack traces. */
    private fun sourceError(e: Throwable): Response {
        val root = generateSequence(e) { it.cause }.last()
        val code = (root as? HttpException)?.code
        val message = root.message.orEmpty().lineSequence().firstOrNull { it.isNotBlank() }?.take(240).orEmpty()
        // Mihon's CloudflareInterceptor already tried the automatic bypass by the time this surfaces.
        val chain = generateSequence(e) { it.cause }.joinToString(" ") { it.message.orEmpty() }
        val verification = VERIFICATION_HINTS.any { chain.contains(it, ignoreCase = true) } ||
            (code in setOf(403, 503) && chain.contains("cloudflare", ignoreCase = true))
        val body = if (verification) {
            JSONObject().put("code", "source-verification-required").put("error", "Source verification required.")
                .put("detail", "This source blocked the request with a browser check.")
        } else {
            JSONObject().put("code", "source-request-failed").put("error", "The source could not load right now.")
                .put("detail", message.ifEmpty { root.javaClass.simpleName })
        }
        return json(if (verification) Response.Status.FORBIDDEN else Response.Status.lookup(502) ?: Response.Status.INTERNAL_ERROR, body)
    }

    private fun formatNumber(n: Float): String =
        if (n == n.toInt().toFloat()) n.toInt().toString() else n.toString().removeSuffix("0")

    private companion object {
        const val TAG = "akaReader.api"
        const val HOST = "127.0.0.1"
        const val PORT = 42601
        val VERIFICATION_HINTS = listOf("bypass cloudflare", "captcha", "cf-chl", "just a moment")
        val NUMBER_IN_NAME = Regex("""\d+(?:\.\d+)?""")
        val STATUS_NAMES = mapOf(
            SManga.UNKNOWN to "unknown",
            SManga.ONGOING to "ongoing",
            SManga.COMPLETED to "completed",
            SManga.LICENSED to "licensed",
            SManga.PUBLISHING_FINISHED to "publishing_finished",
            SManga.CANCELLED to "cancelled",
            SManga.ON_HIATUS to "on_hiatus",
        )
    }
}
