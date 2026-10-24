package eu.kanade.tachiyomi.network

import android.content.Context
import app.cash.quickjs.QuickJs
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** Util for evaluating JavaScript in sources. Adapted from Mihon (Apache-2.0). */
@Suppress("UNUSED", "UNCHECKED_CAST", "UnusedPrivateProperty")
class JavaScriptEngine(context: Context) {
    suspend fun <T> evaluate(script: String): T = withContext(Dispatchers.Default) {
        QuickJs.create().use { it.evaluate(script) as T }
    }
}
