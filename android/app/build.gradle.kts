plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.serialization")
}

android {
    namespace = "com.akareader.mobile"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.akareader.mobile"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
    }

    buildTypes {
        release {
            // Extensions resolve host classes (okhttp, injekt, rx, jsoup, ...) by name at runtime.
            isMinifyEnabled = false
        }
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    // The renderer is the same Vite build the desktop app ships (manga-nexus/dist).
    sourceSets["main"].assets.srcDir("../../manga-nexus/dist")

    packaging {
        resources.excludes += setOf("META-INF/*.kotlin_module", "META-INF/versions/**")
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.19.1")
    implementation("androidx.webkit:webkit:1.17.1")
    implementation("androidx.preference:preference-ktx:1.2.1")

    // Host APIs that Tachiyomi/Keiyoushi extensions are compiled against.
    implementation("com.squareup.okhttp3:okhttp:5.5.0")
    implementation("com.squareup.okhttp3:okhttp-brotli:5.5.0")
    implementation("com.squareup.okhttp3:okhttp-zstd:5.5.0")
    implementation("com.squareup.okhttp3:logging-interceptor:5.5.0")
    implementation("com.squareup.okhttp3:okhttp-dnsoverhttps:5.5.0")
    implementation("io.reactivex:rxjava:1.3.8")
    implementation("org.jsoup:jsoup:1.23.2")
    implementation("uy.kohesive.injekt:injekt-core:1.16.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.11.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json-okio:1.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-protobuf:1.12.0")
    implementation("com.github.zhanghai.quickjs-java:quickjs-android:547f5b1597")

    // Loopback server that answers the renderer's /api/* routes.
    implementation("org.nanohttpd:nanohttpd:2.3.1")
    implementation("com.squareup.logcat:logcat:0.4")
}
