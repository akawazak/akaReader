package eu.kanade.tachiyomi

import com.akareader.mobile.BuildConfig

/** Exposed to extensions (extensions-lib 1.4+). */
@Suppress("UNUSED")
object AppInfo {
    fun getVersionCode(): Int = BuildConfig.VERSION_CODE

    fun getVersionName(): String = BuildConfig.VERSION_NAME
}
