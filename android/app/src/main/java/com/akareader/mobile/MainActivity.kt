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
    }

    private var pendingVerification: String? = null

    @Deprecated("Activity results")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        @Suppress("DEPRECATION")
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQUEST_VERIFY) return
        val callId = pendingVerification ?: return
        pendingVerification = null
        val result = if (resultCode == RESULT_OK) JSONObject().put("ok", true) else JSONObject().put("ok", false).put("cancelled", true)
        resolve(callId, result)
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
              window.akaReaderAndroid = Object.freeze(config);
            })();
        """.trimIndent()
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
