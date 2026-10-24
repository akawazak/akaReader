package com.akareader.mobile.engine

import android.content.Context
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import dalvik.system.DelegateLastClassLoader
import dalvik.system.PathClassLoader
import eu.kanade.tachiyomi.network.GET
import eu.kanade.tachiyomi.network.NetworkHelper
import eu.kanade.tachiyomi.network.awaitSuccess
import eu.kanade.tachiyomi.source.CatalogueSource
import eu.kanade.tachiyomi.source.Source
import eu.kanade.tachiyomi.source.SourceFactory
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap

/**
 * Downloads Keiyoushi extension APKs into private storage and loads their sources,
 * following Mihon's ExtensionLoader rules (Apache-2.0): the `tachiyomi.extension`
 * feature, lib 1.4/1.6, store signing-key trust, and a delegate-last class loader
 * whose parent provides the host APIs.
 */
class ExtensionManager(private val context: Context, private val network: NetworkHelper) {

    data class Installed(
        val pkgName: String,
        val name: String,
        val versionName: String,
        val versionCode: Long,
        val isNsfw: Boolean,
        val sources: List<CatalogueSource>,
    )

    private val dir = File(context.filesDir, "exts").apply { mkdirs() }
    private val installed = ConcurrentHashMap<String, Installed>()
    private val storeLock = Mutex()
    private var store: ExtensionStore.Loaded? = null
    private var storeFetchedAt = 0L

    val sources: List<CatalogueSource> get() = installed.values.flatMap { it.sources }

    fun installedExtensions(): Collection<Installed> = installed.values

    fun extensionForSource(sourceId: Long): Installed? = installed.values.firstOrNull { ext -> ext.sources.any { it.id == sourceId } }

    fun source(sourceId: Long): CatalogueSource? = sources.firstOrNull { it.id == sourceId }

    suspend fun storeIndex(force: Boolean = false): ExtensionStore.Loaded = storeLock.withLock {
        val cached = store
        if (!force && cached != null && System.currentTimeMillis() - storeFetchedAt < STORE_TTL_MS) return cached
        ExtensionStore.fetch(network).also {
            store = it
            storeFetchedAt = System.currentTimeMillis()
        }
    }

    fun loadInstalled() {
        dir.listFiles { f -> f.extension == "apk" }?.forEach { apk ->
            runCatching { load(apk, trustedKey = null) }
                .onFailure { Log.w(TAG, "Could not load ${apk.name}", it) }
        }
    }

    suspend fun install(pkgName: String) {
        val index = storeIndex()
        val entry = index.extensions.firstOrNull { it.packageName == pkgName }
            ?: error("$pkgName is not in the extension store")
        val tmp = File(dir, "$pkgName.apk.tmp")
        network.client.newCall(GET(entry.resources.apkUrl)).awaitSuccess().use { response ->
            tmp.outputStream().use { out -> response.body.byteStream().copyTo(out) }
        }
        val target = File(dir, "$pkgName.apk")
        try {
            // Validate before replacing a working install.
            val info = readPackage(tmp) ?: error("Downloaded file is not a valid extension")
            check(info.packageName == pkgName) { "Package name mismatch: ${info.packageName}" }
            check(index.signingKey in signatures(info)) { "Extension is not signed by the store's key" }
            unload(pkgName)
            if (target.exists()) {
                target.setWritable(true)
                target.delete()
            }
            check(tmp.renameTo(target)) { "Could not move the downloaded extension into place" }
            load(target, trustedKey = index.signingKey)
        } finally {
            tmp.delete()
        }
    }

    fun uninstall(pkgName: String) {
        unload(pkgName)
        File(dir, "$pkgName.apk").apply { setWritable(true); delete() }
        File(dir, "$pkgName.key").delete()
    }

    private fun unload(pkgName: String) {
        installed.remove(pkgName)
    }

    @Suppress("DEPRECATION")
    private fun readPackage(apk: File): PackageInfo? {
        val flags = PackageManager.GET_CONFIGURATIONS or PackageManager.GET_META_DATA or
            (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) PackageManager.GET_SIGNING_CERTIFICATES else PackageManager.GET_SIGNATURES)
        return context.packageManager.getPackageArchiveInfo(apk.absolutePath, flags)?.also { info ->
            info.applicationInfo?.let {
                if (it.sourceDir == null) it.sourceDir = apk.absolutePath
                if (it.publicSourceDir == null) it.publicSourceDir = apk.absolutePath
            }
        }
    }

    @Suppress("DEPRECATION")
    private fun signatures(info: PackageInfo): List<String> {
        val sigs = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val signingInfo = info.signingInfo ?: return emptyList()
            if (signingInfo.hasMultipleSigners()) signingInfo.apkContentsSigners else signingInfo.signingCertificateHistory
        } else {
            info.signatures
        } ?: return emptyList()
        val digest = MessageDigest.getInstance("SHA-256")
        return sigs.map { sig -> digest.digest(sig.toByteArray()).joinToString("") { "%02x".format(it) } }
    }

    private fun load(apk: File, trustedKey: String?) {
        val info = readPackage(apk) ?: error("Not a valid APK")
        val pkgName = info.packageName
        val appInfo = info.applicationInfo ?: error("Missing application info")
        val meta = appInfo.metaData ?: error("Missing extension metadata")

        check(info.reqFeatures.orEmpty().any { it.name == EXTENSION_FEATURE }) { "$pkgName is not a Tachiyomi extension" }

        val versionName = info.versionName.orEmpty()
        val libVersion = meta.getFloat(METADATA_EXTENSION_LIB).takeUnless { it == 0f }?.toString()?.toDouble()
            ?: versionName.substringBeforeLast('.').toDoubleOrNull()
        check(libVersion in SUPPORTED_LIB_VERSIONS) { "Unsupported extension lib $libVersion" }

        // Remember which key was trusted at install time, and refuse anything that changed since.
        val keyFile = File(dir, "$pkgName.key")
        val sigs = signatures(info)
        val key = trustedKey ?: keyFile.takeIf { it.exists() }?.readText()?.trim()
        check(key != null && key in sigs) { "$pkgName is not signed by a trusted store key" }
        if (trustedKey != null) keyFile.writeText(trustedKey)

        // Android 14+ refuses to load writable dex files.
        apk.setReadOnly()
        val loader = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            DelegateLastClassLoader(apk.absolutePath, null, context.classLoader)
        } else {
            PathClassLoader(apk.absolutePath, null, context.classLoader)
        }

        val classNames = meta.getString(METADATA_SOURCE_CLASS).orEmpty()
            .split(';').map { it.trim() }.filter { it.isNotEmpty() }
            .map { if (it.startsWith('.')) pkgName + it else it }
        check(classNames.isNotEmpty()) { "$pkgName declares no source class" }

        val sources = classNames.flatMap { className ->
            when (val obj = Class.forName(className, false, loader).getDeclaredConstructor().newInstance()) {
                is Source -> listOf(obj)
                is SourceFactory -> obj.createSources()
                else -> error("Unknown source class type ${obj.javaClass}")
            }
        }.filterIsInstance<CatalogueSource>()

        val label = meta.getString(METADATA_NAME)
            ?: context.packageManager.getApplicationLabel(appInfo).toString().removePrefix("Tachiyomi: ")
        val contentWarning = meta.getInt(METADATA_CONTENT_WARNING, 0)
        installed[pkgName] = Installed(
            pkgName = pkgName,
            name = label,
            versionName = versionName,
            versionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode else info.versionCode.toLong(),
            isNsfw = contentWarning >= 1 || meta.getInt(METADATA_NSFW, 0) == 1,
            sources = sources,
        )
        Log.i(TAG, "Loaded $pkgName $versionName with ${sources.size} source(s)")
    }

    private companion object {
        const val TAG = "akaReader.ext"
        const val EXTENSION_FEATURE = "tachiyomi.extension"
        const val METADATA_SOURCE_CLASS = "tachiyomi.extension.class"
        const val METADATA_NSFW = "tachiyomi.extension.nsfw"
        const val METADATA_NAME = "tachiyomix.name"
        const val METADATA_EXTENSION_LIB = "tachiyomix.extensionLib"
        const val METADATA_CONTENT_WARNING = "tachiyomix.contentWarning"
        val SUPPORTED_LIB_VERSIONS = listOf(1.4, 1.6)
        const val STORE_TTL_MS = 30 * 60 * 1000L
    }
}
