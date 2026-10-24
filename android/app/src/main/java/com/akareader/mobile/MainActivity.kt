package com.akareader.mobile

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.view.ViewGroup
import android.util.Log
import android.net.Uri
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebResourceRequest
import android.content.Intent
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject

class MainActivity : Activity() {

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val server = (application as AkaApp).server
        val origin = server.origin

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        webView = WebView(this).apply {
            setBackgroundColor(Color.parseColor("#050508"))
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(message: ConsoleMessage): Boolean {
                    Log.println(
                        if (message.messageLevel() == ConsoleMessage.MessageLevel.ERROR) Log.ERROR else Log.INFO,
                        "akaReader.web",
                        "${message.message()} (${message.sourceId()}:${message.lineNumber()})",
                    )
                    return true
                }
            }
            webViewClient = object : WebViewClient() {
                // Keep the app on its own origin; open anything else in the browser.
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    val url = request.url.toString()
                    if (url.startsWith(origin)) return false
                    runCatching { startActivity(Intent(Intent.ACTION_VIEW, request.url)) }
                    return true
                }
            }
        }

        // window.akaReaderAndroid carries the loopback API token (CONFIG.API_TOKEN) plus the
        // native calls the renderer makes through window.electronAPI on desktop.
        webView.addJavascriptInterface(NativeBridge(), "AkaNative")
        val config = JSONObject().put("apiToken", server.token).put("platform", "android")
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(webView, BRIDGE_SCRIPT.replace("__CONFIG__", config.toString()), setOf(origin))
        }

        ViewCompat.setOnApplyWindowInsetsListener(webView) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }
        window.decorView.setBackgroundColor(Color.parseColor("#050508"))
        setContentView(webView, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))

        if (savedInstanceState != null) webView.restoreState(savedInstanceState) else webView.loadUrl("$origin/")
    }

    /** Called from the page as AkaNative.*; results return through window.__akaNativeResolve. */
    private inner class NativeBridge {
        @JavascriptInterface
        fun verifySource(callId: String, url: String) = runOnUiThread {
            val scheme = Uri.parse(url).scheme
            if (scheme != "https" && scheme != "http") {
                resolve(callId, JSONObject().put("ok", false).put("error", "Invalid source URL"))
                return@runOnUiThread
            }
            pendingVerification = callId
            @Suppress("DEPRECATION")
            startActivityForResult(Intent(this@MainActivity, VerifyActivity::class.java).putExtra(VerifyActivity.EXTRA_URL, url), REQUEST_VERIFY)
        }

        @JavascriptInterface
        fun openExternal(url: String) = runOnUiThread {
            val uri = Uri.parse(url)
            if (uri.scheme == "https" || uri.scheme == "http") runCatching { startActivity(Intent(Intent.ACTION_VIEW, uri)) }
        }

        /** Account sign-in: opens the Supabase authorize URL in the browser; the code returns via onNewIntent. */
        @JavascriptInterface
        fun startOAuth(callId: String, url: String) = runOnUiThread {
            if (!url.startsWith(OAUTH_ALLOWED_PREFIX)) {
                resolve(callId, JSONObject().put("ok", false).put("error", "Invalid sign-in address."))
                return@runOnUiThread
            }
            pendingOAuth?.let { resolve(it, JSONObject().put("ok", false).put("cancelled", true)) }
            pendingOAuth = callId
            runCatching { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
                .onFailure { pendingOAuth = null; resolve(callId, JSONObject().put("ok", false).put("error", "Could not open the browser.")) }
        }

        /** Backup export: the system "save as" picker, then the renderer's JSON is written there. */
        @JavascriptInterface
        fun saveBackup(callId: String, text: String) = runOnUiThread {
            if (text.length > BACKUP_MAX_BYTES) {
                resolve(callId, JSONObject().put("ok", false).put("error", "This backup is too large to save."))
                return@runOnUiThread
            }
            pendingBackup = callId
            pendingBackupText = text
            val name = "akareader-backup-${java.time.LocalDate.now()}.json"
            @Suppress("DEPRECATION")
            startActivityForResult(
                Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                    .setType("application/json").putExtra(Intent.EXTRA_TITLE, name),
                REQUEST_SAVE_BACKUP,
            )
        }

        /** Backup restore: the system file picker; the file's text goes back for the renderer to validate. */
        @JavascriptInterface
        fun openBackup(callId: String, @Suppress("UNUSED_PARAMETER") unused: String) = runOnUiThread {
            pendingBackup = callId
            @Suppress("DEPRECATION")
            startActivityForResult(
                Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*")
                    .putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("application/json", "text/plain", "application/octet-stream")),
                REQUEST_OPEN_BACKUP,
            )
        }
    }

    private var pendingVerification: String? = null
    private var pendingBackup: String? = null
    private var pendingOAuth: String? = null

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        val uri = intent.data ?: return
        if (uri.scheme != "akareader" || uri.host != "auth-callback") return
        val callId = pendingOAuth ?: return
        pendingOAuth = null
        val code = uri.getQueryParameter("code")
        val error = uri.getQueryParameter("error_description") ?: uri.getQueryParameter("error")
        resolve(callId, if (code != null) JSONObject().put("ok", true).put("code", code) else JSONObject().put("ok", false).put("error", error ?: "Sign-in was cancelled."))
    }
    private var pendingBackupText: String? = null

    @Deprecated("Activity results")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        @Suppress("DEPRECATION")
        super.onActivityResult(requestCode, resultCode, data)
        val cancelled = JSONObject().put("ok", false).put("cancelled", true)
        when (requestCode) {
            REQUEST_VERIFY -> {
                val callId = pendingVerification ?: return
                pendingVerification = null
                resolve(callId, if (resultCode == RESULT_OK) JSONObject().put("ok", true) else cancelled)
            }
            REQUEST_SAVE_BACKUP, REQUEST_OPEN_BACKUP -> {
                val callId = pendingBackup ?: return
                val text = pendingBackupText
                pendingBackup = null
                pendingBackupText = null
                val uri = data?.data
                if (resultCode != RESULT_OK || uri == null) { resolve(callId, cancelled); return }
                Thread {
                    val result = runCatching {
                        if (requestCode == REQUEST_SAVE_BACKUP) {
                            contentResolver.openOutputStream(uri, "wt")!!.use { it.write(text!!.toByteArray()) }
                            JSONObject().put("ok", true)
                        } else {
                            val bytes = contentResolver.openInputStream(uri)!!.use { readCapped(it, BACKUP_MAX_BYTES + 1) }
                            if (bytes.size > BACKUP_MAX_BYTES) JSONObject().put("ok", false).put("error", "This backup is too large to import safely.")
                            else JSONObject().put("ok", true).put("text", String(bytes))
                        }
                    }.getOrElse { JSONObject().put("ok", false).put("error", "The backup file could not be ${if (requestCode == REQUEST_SAVE_BACKUP) "saved" else "opened"}.") }
                    runOnUiThread { resolve(callId, result) }
                }.start()
            }
        }
    }

    /** InputStream.readNBytes needs API 33; minSdk is 26. */
    private fun readCapped(input: java.io.InputStream, limit: Int): ByteArray {
        val out = java.io.ByteArrayOutputStream()
        val buffer = ByteArray(64 * 1024)
        while (out.size() < limit) {
            val n = input.read(buffer, 0, minOf(buffer.size, limit - out.size()))
            if (n < 0) break
            out.write(buffer, 0, n)
        }
        return out.toByteArray()
    }

    private fun resolve(callId: String, result: JSONObject) {
        webView.evaluateJavascript("window.__akaNativeResolve && window.__akaNativeResolve(${JSONObject.quote(callId)}, $result)", null)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    @Deprecated("Activity back handling")
    override fun onBackPressed() {
        // Give the renderer a chance to close an overlay or leave the reader first.
        webView.evaluateJavascript(
            "(function(){var e=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});" +
                "return document.dispatchEvent(e) ? 'unhandled' : 'handled';})()",
        ) { result ->
            if (result?.contains("handled") == true && !result.contains("unhandled")) return@evaluateJavascript
            if (webView.canGoBack()) webView.goBack() else {
                @Suppress("DEPRECATION")
                super.onBackPressed()
            }
        }
    }

    private companion object {
        const val REQUEST_VERIFY = 1001
        const val REQUEST_SAVE_BACKUP = 1002
        const val REQUEST_OPEN_BACKUP = 1003
        const val BACKUP_MAX_BYTES = 10 * 1024 * 1024
        const val OAUTH_ALLOWED_PREFIX = "https://bmavfeblgaeyjnstcwad.supabase.co/auth/v1/authorize?"

        val BRIDGE_SCRIPT = """
            (function () {
              var config = __CONFIG__;
              var pending = {}, seq = 0;
              window.__akaNativeResolve = function (id, result) {
                var done = pending[id];
                if (done) { delete pending[id]; done(result); }
              };
              function call(method, arg) {
                return new Promise(function (resolve) {
                  var id = String(++seq);
                  pending[id] = resolve;
                  AkaNative[method](id, String(arg));
                });
              }
              config.verifySourceUrl = function (url) { return call("verifySource", url); };
              config.openExternal = function (url) { AkaNative.openExternal(String(url)); return Promise.resolve(true); };
              config.startOAuth = function (url) { return call("startOAuth", url); };
              config.exportAppBackup = function (payload) { return call("saveBackup", JSON.stringify(payload)); };
              config.importAppBackup = function () {
                return call("openBackup", "").then(function (result) {
                  if (!result || !result.ok) return result;
                  try { return { ok: true, payload: JSON.parse(result.text) }; }
                  catch (e) { return { ok: false, error: "This file is not an akaReader backup." }; }
                });
              };
              window.akaReaderAndroid = Object.freeze(config);
            })();
        """.trimIndent()
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
