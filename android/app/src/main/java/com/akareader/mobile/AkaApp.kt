package com.akareader.mobile

import android.app.Application
import com.akareader.mobile.data.LocalDb
import com.akareader.mobile.engine.ExtensionManager
import com.akareader.mobile.server.ApiServer
import eu.kanade.tachiyomi.network.JavaScriptEngine
import eu.kanade.tachiyomi.network.NetworkHelper
import kotlinx.serialization.json.Json
import uy.kohesive.injekt.Injekt
import uy.kohesive.injekt.api.addSingleton
import uy.kohesive.injekt.api.addSingletonFactory
import uy.kohesive.injekt.api.get

class AkaApp : Application() {

    lateinit var server: ApiServer
        private set

    override fun onCreate() {
        super.onCreate()
        val app = this
        // Extensions look these up by type through Injekt, exactly as they do in Mihon.
        Injekt.addSingleton<Application>(app)
        Injekt.addSingletonFactory { NetworkHelper(app) }
        Injekt.addSingletonFactory {
            Json {
                ignoreUnknownKeys = true
                explicitNulls = false
            }
        }
        Injekt.addSingletonFactory { JavaScriptEngine(app) }

        val db = LocalDb(app)
        val extensions = ExtensionManager(app, Injekt.get<NetworkHelper>())
        server = ApiServer(app, db, extensions).also { it.launch() }
        extensions.loadInstalled()
    }
}
