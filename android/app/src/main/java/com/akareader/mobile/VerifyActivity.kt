package com.akareader.mobile

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.webkit.CookieManager
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import eu.kanade.tachiyomi.network.NetworkHelper

/**
 * Manual source verification, the Android twin of the desktop app's embedded
 * verification view: the user solves the browser check here, the clearance cookie
 * lands in the shared CookieManager (which the extensions' OkHttp client reads),
 * and the screen closes itself once the check has passed.
 */
class VerifyActivity : Activity() {

    private val handler = Handler(Looper.getMainLooper())
    private lateinit var webView: WebView
    private lateinit var url: String
    private var finished = false

    private val pollClearance = object : Runnable {
        override fun run() {
            if (finished) return
            val cookies = CookieManager.getInstance().getCookie(url).orEmpty()
            val title = webView.title.orEmpty()
            if ("cf_clearance=" in cookies && !looksLikeChallenge(title)) {
                complete(ok = true)
                return
            }
            handler.postDelayed(this, 700)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        url = intent.getStringExtra(EXTRA_URL) ?: return complete(ok = false)
        val host = Uri.parse(url).host ?: url

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            // The clearance cookie is tied to the user agent the extensions send.
            settings.userAgentString = NetworkHelper.DEFAULT_USER_AGENT
            webViewClient = WebViewClient()
        }
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(BG)
            addView(toolbar(host), LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(56)))
            addView(webView, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))
        }
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }
        setContentView(root)

        webView.loadUrl(url)
        handler.postDelayed(pollClearance, 1500)
    }

    private fun toolbar(host: String): View = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        setPadding(dp(12), 0, dp(12), 0)
        setBackgroundColor(SURFACE)

        addView(button("Cancel", filled = false) { complete(ok = false) })
        addView(
            TextView(context).apply {
                text = "Verify $host"
                setTextColor(Color.WHITE)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
                typeface = Typeface.DEFAULT_BOLD
                maxLines = 1
                gravity = Gravity.CENTER
                ellipsize = android.text.TextUtils.TruncateAt.END
            },
            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f),
        )
        // Fallback for checks that pass without setting a recognizable cookie.
        addView(button("Done", filled = true) { complete(ok = true) })
    }

    private fun button(label: String, filled: Boolean, onClick: () -> Unit) = TextView(this).apply {
        text = label
        setTextColor(if (filled) Color.WHITE else MUTED)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
        typeface = Typeface.DEFAULT_BOLD
        setPadding(dp(14), dp(8), dp(14), dp(8))
        background = GradientDrawable().apply {
            cornerRadius = dp(10).toFloat()
            if (filled) setColor(ACCENT) else setStroke(dp(1), BORDER)
        }
        setOnClickListener { onClick() }
    }

    private fun complete(ok: Boolean) {
        if (finished) return
        finished = true
        CookieManager.getInstance().flush()
        setResult(if (ok) RESULT_OK else RESULT_CANCELED)
        finish()
    }

    @Deprecated("Activity back handling")
    override fun onBackPressed() = complete(ok = false)

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        if (::webView.isInitialized) webView.destroy()
        super.onDestroy()
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    private fun looksLikeChallenge(title: String) =
        CHALLENGE_TITLES.any { title.contains(it, ignoreCase = true) }

    companion object {
        const val EXTRA_URL = "url"
        private val CHALLENGE_TITLES = listOf("just a moment", "attention required", "checking your browser", "verify you are human")
        private val BG = Color.parseColor("#050508")
        private val SURFACE = Color.parseColor("#12121a")
        private val BORDER = Color.parseColor("#2a2a38")
        private val MUTED = Color.parseColor("#a0a8c0")
        private val ACCENT = Color.parseColor("#ff5e00")
    }
}
