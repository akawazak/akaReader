package com.akareader.mobile.engine

import eu.kanade.tachiyomi.network.GET
import eu.kanade.tachiyomi.network.NetworkHelper
import eu.kanade.tachiyomi.network.awaitSuccess
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromByteArray
import kotlinx.serialization.protobuf.ProtoBuf
import kotlinx.serialization.protobuf.ProtoNumber
import java.io.ByteArrayInputStream
import java.util.zip.GZIPInputStream

/**
 * Keiyoushi's `repo/index.pb` store format. Field numbers mirror Mihon's
 * NetworkExtensionStore (Apache-2.0).
 */
@OptIn(ExperimentalSerializationApi::class)
object ExtensionStore {

    const val KEIYOUSHI_INDEX = "https://github.com/keiyoushi/extensions/raw/repo/index.pb"

    @Serializable
    data class Store(
        @ProtoNumber(1) val name: String = "",
        @ProtoNumber(2) val badgeLabel: String = "",
        @ProtoNumber(3) val signingKey: String = "",
        @ProtoNumber(101) val extensionList: ExtensionList? = null,
        @ProtoNumber(102) val extensionListUrl: String? = null,
    )

    @Serializable
    data class ExtensionList(@ProtoNumber(1) val extensions: List<Extension> = emptyList())

    @Serializable
    data class Extension(
        @ProtoNumber(1) val name: String = "",
        @ProtoNumber(2) val packageName: String = "",
        @ProtoNumber(3) val resources: Resources = Resources(),
        @ProtoNumber(4) val extensionLib: String = "",
        @ProtoNumber(5) val versionCode: Long = 0,
        @ProtoNumber(6) val versionName: String = "",
        @ProtoNumber(7) val contentWarning: Int = 0,
        @ProtoNumber(8) val sources: List<Source> = emptyList(),
    ) {
        val lang: String get() = sources.map { it.language }.toSet().singleOrNull() ?: "all"

        /** 2 = mixed, 3 = NSFW in the store enum. */
        val isNsfw: Boolean get() = contentWarning >= 2
    }

    @Serializable
    data class Resources(
        @ProtoNumber(1) val apkUrl: String = "",
        @ProtoNumber(2) val iconUrl: String = "",
    )

    @Serializable
    data class Source(
        @ProtoNumber(1) val id: Long = 0,
        @ProtoNumber(2) val name: String = "",
        @ProtoNumber(3) val language: String = "",
        @ProtoNumber(4) val homeUrl: String = "",
    )

    data class Loaded(val signingKey: String, val extensions: List<Extension>)

    private val protoBuf = ProtoBuf

    suspend fun fetch(network: NetworkHelper, indexUrl: String = KEIYOUSHI_INDEX): Loaded {
        val store = protoBuf.decodeFromByteArray<Store>(download(network, indexUrl))
        val list = store.extensionList
            ?: store.extensionListUrl?.let { protoBuf.decodeFromByteArray<ExtensionList>(download(network, it)) }
            ?: ExtensionList()
        return Loaded(store.signingKey.lowercase(), list.extensions)
    }

    private suspend fun download(network: NetworkHelper, url: String): ByteArray {
        val bytes = network.client.newCall(GET(url)).awaitSuccess().use { it.body.bytes() }
        val gzipped = bytes.size > 2 && bytes[0] == 0x1f.toByte() && bytes[1] == 0x8b.toByte()
        return if (gzipped) GZIPInputStream(ByteArrayInputStream(bytes)).use { it.readBytes() } else bytes
    }
}
