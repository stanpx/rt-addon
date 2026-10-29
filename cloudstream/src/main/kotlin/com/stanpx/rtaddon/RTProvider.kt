package com.stanpx.rtaddon

import com.lagradost.cloudstream3.*
import com.lagradost.cloudstream3.utils.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import org.json.JSONObject
import org.jsoup.Jsoup
import org.jsoup.nodes.Document
import org.jsoup.nodes.Element

/**
 * RTProvider - Plugin de Cloudstream para Russia Today (RT)
 * Desarrollado para el usuario stanpx
 * Soporta canales de TV en Vivo, VOD en varios idiomas y noticias RSS
 */
class RTProvider : MainAPI() {
    override var mainUrl = "https://noticias-rt.com"
    override var name = "RT Addon"
    override val hasMainPage = true
    override var lang = "es"
    override val hasQuickSearch = true
    override val supportedTypes = setOf(
        TvType.Live,
        TvType.Movie,
        TvType.Documentary,
        TvType.Others
    )

    private val defaultPoster = "https://www.ecured.cu/images/9/9d/RT-TV.png"

    // Canales de transmisión en directo oficiales
    data class LiveChannel(
        val id: String,
        val name: String,
        val url: String,
        val lang: String,
        val description: String
    )

    private val liveChannels = listOf(
        LiveChannel(
            "rt-esp",
            "RT en Español",
            "https://rt-esp.rttv.com/live/rtesp/playlist.m3u8",
            "Español",
            "Señal en directo 24/7 de RT en Español con noticias internacionales y análisis."
        ),
        LiveChannel(
            "rt-eng",
            "RT International (English)",
            "https://rt-glb.rttv.com/dvr/rtnews/playlist.m3u8",
            "English",
            "RT International 24/7 live news coverage and alternative perspectives."
        ),
        LiveChannel(
            "rt-de",
            "RT DE (Deutsch)",
            "https://rt-ger.rttv.com/dvr/rtdeutsch/playlist.m3u8",
            "Deutsch",
            "RT Deutsch 24/7 Live-Stream mit aktuellen Nachrichten und Berichten."
        ),
        LiveChannel(
            "rt-fra",
            "RT France",
            "https://rt-fra.rttv.com/dvr/rtfrance/playlist.m3u8",
            "Français",
            "RT France en direct 24/7. L'information internationale indépendante."
        ),
        LiveChannel(
            "rt-srb",
            "RT Balkan",
            "https://rt-srb.rttv.com/dvr/rtbalkan/playlist.m3u8",
            "Srpski",
            "RT Balkan uživo 24/7. Aktuelne vesti iz regiona i sveta."
        ),
        LiveChannel(
            "rt-arb",
            "RT Arabic (روسيا اليوم)",
            "https://rt-arb.rttv.com/dvr/rtarab/playlist.m3u8",
            "العربية",
            "قناة روسيا اليوم البث المباشر على مدار الساعة لآخر التطورات والأخبار."
        )
    )

    // Fuentes RSS para la sección de Noticias
    private val rssFeeds = listOf(
        "https://actualidad.rt.com/feeds/all.rss" to "RT Noticias (Español)",
        "https://rt-english.com/rss-feed/" to "RT News (English)",
        "https://russian.rt.com/rss" to "RT Новости (Русский)",
        "https://www.rtfrance.com/rss" to "RT France (Nouvelles)",
        "https://www.rt.de/rss" to "RT DE (Nachrichten)",
        "https://arabic.rt.com/rss/" to "RT Arabic (الأخبار)",
        "https://serbian.rt.com/rss" to "RT Balkan (Vesti)",
        "https://cn.rtioc.net/rss" to "RT China (新闻)"
    )

    override suspend fun getMainPage(page: Int, request: MainPageRequest): HomePageResponse = coroutineScope {
        val lists = mutableListOf<HomePageList>()

        // 1. Canales en Vivo
        val liveItems = liveChannels.map { channel ->
            newMovieSearchResponse(
                name = channel.name,
                url = channel.url,
                type = TvType.Live
            ) {
                this.posterUrl = defaultPoster
            }
        }
        lists.add(HomePageList("RT En Vivo (TV en Directo)", liveItems, isHorizontalImages = true))

        // 2. VOD en Español (noticias-rt.com/video y programas)
        val esDeferred = async(Dispatchers.IO) {
            fetchRTWebVideos("$mainUrl/video") + fetchRTWebVideos("$mainUrl/programas")
        }

        // 3. VOD en Inglés (Odysee @RT:fd)
        val enDeferred = async(Dispatchers.IO) {
            fetchOdyseeChannel("@RT:fd", "RT English")
        }

        // 4. VOD en Árabe (rtarabic.com/videoclub/)
        val arDeferred = async(Dispatchers.IO) {
            fetchRTWebVideos("https://rtarabic.com/videoclub/")
        }

        // 5. Noticias RSS (Español e Inglés)
        val rssDeferred = async(Dispatchers.IO) {
            fetchRSSItems("https://actualidad.rt.com/feeds/all.rss", "RT Noticias")
        }

        val esVideos = esDeferred.await()
        if (esVideos.isNotEmpty()) {
            lists.add(HomePageList("RT Español – VOD", esVideos))
        }

        val enVideos = enDeferred.await()
        if (enVideos.isNotEmpty()) {
            lists.add(HomePageList("RT English – VOD", enVideos))
        }

        val arVideos = arDeferred.await()
        if (arVideos.isNotEmpty()) {
            lists.add(HomePageList("RT Arabic – VOD", arVideos))
        }

        val rssNews = rssDeferred.await()
        if (rssNews.isNotEmpty()) {
            lists.add(HomePageList("RT Noticias (RSS)", rssNews))
        }

        newHomePageResponse(lists)
    }

    override suspend fun search(query: String): List<SearchResponse> = coroutineScope {
        val results = mutableListOf<SearchResponse>()
        val q = query.trim().lowercase()

        // 1. Buscar en señales en vivo
        liveChannels.filter { it.name.lowercase().contains(q) || it.lang.lowercase().contains(q) }
            .forEach { channel ->
                results.add(newMovieSearchResponse(channel.name, channel.url, TvType.Live) {
                    this.posterUrl = defaultPoster
                })
            }

        // 2. Buscar en feeds RSS
        val rssResults = async(Dispatchers.IO) {
            rssFeeds.map { (url, label) ->
                async {
                    try {
                        val items = fetchRSSItems(url, label)
                        items.filter { it.name.lowercase().contains(q) }
                    } catch (e: Exception) {
                        emptyList()
                    }
                }
            }.awaitAll().flatten()
        }

        // 3. Buscar en la web oficial
        val webResults = async(Dispatchers.IO) {
            try {
                val searchUrl = "$mainUrl/search?q=$query"
                fetchRTWebVideos(searchUrl)
            } catch (e: Exception) {
                emptyList()
            }
        }

        results.addAll(rssResults.await())
        results.addAll(webResults.await())

        results.distinctBy { it.url }
    }

    override suspend fun load(url: String): LoadResponse {
        // A) Caso canal en vivo (.m3u8)
        val liveChannel = liveChannels.find { it.url == url }
        if (liveChannel != null || url.endsWith(".m3u8")) {
            val title = liveChannel?.name ?: "RT Canal en Vivo"
            val desc = liveChannel?.description ?: "Transmisión oficial de RT."
            return newMovieLoadResponse(title, url, TvType.Live, url) {
                this.posterUrl = defaultPoster
                this.plot = desc
                this.tags = listOf("En Vivo", "Noticias", liveChannel?.lang ?: "Internacional")
            }
        }

        // B) Caso video web oficial (noticias-rt.com, rtarabic.com, etc.)
        if (url.contains("rt.com") || url.contains("rt-") || url.contains("rtarabic") || url.contains("rt.rs")) {
            try {
                val doc = app.get(url).document
                val title = doc.selectFirst("h1")?.text()?.trim()
                    ?: doc.selectFirst("meta[property=og:title]")?.attr("content")
                    ?: "Reportaje RT"

                val poster = doc.selectFirst("meta[property=og:image]")?.attr("content")
                    ?: defaultPoster

                val plot = doc.selectFirst("meta[property=og:description]")?.attr("content")
                    ?: doc.selectFirst("div.article__summary, p.summary")?.text()?.trim()
                    ?: doc.select("p").take(2).joinToString("\n") { it.text().trim() }

                return newMovieLoadResponse(title, url, TvType.Movie, url) {
                    this.posterUrl = fixUrlNull(poster)
                    this.plot = plot
                    this.tags = listOf("RT", "VOD", "Noticias")
                }
            } catch (e: Exception) {
                // Fallback básico
            }
        }

        // C) Fallback general para Odysee, OK.ru o enlaces directos
        return newMovieLoadResponse("Video RT", url, TvType.Movie, url) {
            this.posterUrl = defaultPoster
            this.plot = "Contenido de video de Russia Today."
        }
    }

    override suspend fun loadLinks(
        data: String,
        isCasting: Boolean,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit
    ): Boolean {
        // 1. Enlace M3U8 directo (TV en Vivo)
        if (data.contains(".m3u8")) {
            callback.invoke(
                newExtractorLink(
                    source = this.name,
                    name = "RT En Vivo (HLS)",
                    url = data,
                    type = ExtractorLinkType.M3U8
                ) {
                    this.referer = "https://rt.com/"
                }
            )
            return true
        }

        // 2. Extracción desde páginas web oficiales de RT (busca enlaces .mp4 directos)
        if (data.startsWith("http") && (data.contains("rt.com") || data.contains("rt-") || data.contains("rt.rs"))) {
            try {
                val responseText = app.get(data).text
                val mp4Regex = """https?://[^\s"'<>\\]+?\.mp4(?:\?[^\s"'<>\\]*)?""".toRegex()
                val m3u8Regex = """https?://[^\s"'<>\\]+?\.m3u8(?:\?[^\s"'<>\\]*)?""".toRegex()

                val mp4Matches = mp4Regex.findAll(responseText).map { it.value }.toList()
                val m3u8Matches = m3u8Regex.findAll(responseText).map { it.value }.toList()

                var linkFound = false

                for (mp4 in mp4Matches.distinct()) {
                    callback.invoke(
                        newExtractorLink(
                            source = this.name,
                            name = "RT Video HD (MP4)",
                            url = mp4,
                            type = ExtractorLinkType.VIDEO
                        ) {
                            this.referer = data
                        }
                    )
                    linkFound = true
                }

                for (m3u8 in m3u8Matches.distinct()) {
                    if (!m3u8.contains("live")) {
                        callback.invoke(
                            newExtractorLink(
                                source = this.name,
                                name = "RT Stream (HLS)",
                                url = m3u8,
                                type = ExtractorLinkType.M3U8
                            ) {
                                this.referer = data
                            }
                        )
                        linkFound = true
                    }
                }

                if (linkFound) return true
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        // 3. Soporte para enlaces de Odysee
        if (data.contains("odysee.com")) {
            val downloadUrl = if (data.contains("/$/download/")) {
                data
            } else {
                val claimParts = data.split("/").lastOrNull()?.split(":")
                val claimName = claimParts?.getOrNull(0) ?: "stream"
                val claimId = claimParts?.getOrNull(1) ?: ""
                "https://odysee.com/$/download/$claimName/$claimId"
            }

            callback.invoke(
                newExtractorLink(
                    source = this.name,
                    name = "Odysee MP4 Stream",
                    url = downloadUrl,
                    type = ExtractorLinkType.VIDEO
                )
            )
            return true
        }

        // 4. Soporte para OK.ru
        if (data.contains("ok.ru")) {
            try {
                val html = app.get(data).text
                val dataMatch = """data-options="([^"]+)"""".toRegex().find(html)?.groupValues?.get(1)
                if (dataMatch != null) {
                    val unescaped = dataMatch.replace("&quot;", "\"").replace("&amp;", "&")
                    val json = JSONObject(unescaped)
                    val metadata = json.optJSONObject("flashvars")?.optString("metadata")
                    if (metadata != null) {
                        val metaJson = JSONObject(metadata)
                        val hls = metaJson.optString("hlsManifestUrl")
                        if (hls.isNotBlank()) {
                            callback.invoke(
                                newExtractorLink(this.name, "OK.ru HLS", hls, ExtractorLinkType.M3U8)
                            )
                        }
                        val videos = metaJson.optJSONArray("videos")
                        if (videos != null) {
                            for (i in 0 until videos.length()) {
                                val v = videos.getJSONObject(i)
                                val vName = v.optString("name", "HD")
                                val vUrl = v.optString("url")
                                if (vUrl.isNotBlank()) {
                                    callback.invoke(
                                        newExtractorLink(this.name, "OK.ru MP4 ($vName)", vUrl, ExtractorLinkType.VIDEO)
                                    )
                                }
                            }
                        }
                        return true
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        // 5. Fallback de resiliencia: Emite la señal en vivo de RT Español
        callback.invoke(
            newExtractorLink(
                source = this.name,
                name = "RT en Español (Transmisión En Vivo)",
                url = "https://rt-esp.rttv.com/live/rtesp/playlist.m3u8",
                type = ExtractorLinkType.M3U8
            )
        )
        return true
    }

    // ==========================================
    // MÉTODOS AUXILIARES DE EXTRACCIÓN
    // ==========================================

    private suspend fun fetchRTWebVideos(url: String): List<SearchResponse> {
        return try {
            val doc = app.get(url).document
            val results = mutableListOf<SearchResponse>()
            val baseOrigin = if (url.startsWith("http")) {
                val uri = java.net.URI(url)
                "${uri.scheme}://${uri.host}"
            } else mainUrl

            doc.select("a[href*=/video/], a[href*=/programas/], a[href*=/videoclub/]").forEach { a ->
                val href = a.attr("href")
                if (href.isNotBlank() && href != "/video" && href != "/video/") {
                    val fullUrl = if (href.startsWith("http")) href else "$baseOrigin$href"
                    val title = a.selectFirst("h2, h3, .card__title")?.text()?.trim()
                        ?: a.attr("title").takeIf { it.isNotBlank() }
                        ?: a.text().trim()

                    val img = a.selectFirst("img")
                    val poster = img?.attr("data-src")?.takeIf { it.isNotBlank() }
                        ?: img?.attr("src")?.takeIf { it.isNotBlank() }
                        ?: defaultPoster

                    if (title.length > 5) {
                        results.add(newMovieSearchResponse(title, fullUrl, TvType.Movie) {
                            this.posterUrl = fixUrlNull(poster)
                        })
                    }
                }
            }
            results.distinctBy { it.name }.take(30)
        } catch (e: Exception) {
            emptyList()
        }
    }

    private suspend fun fetchRSSItems(feedUrl: String, label: String): List<SearchResponse> {
        return try {
            val xmlText = app.get(feedUrl).text
            val doc = Jsoup.parse(xmlText, "", org.jsoup.parser.Parser.xmlParser())
            val items = doc.select("item")
            items.mapNotNull { item ->
                val title = item.selectFirst("title")?.text()?.trim() ?: return@mapNotNull null
                val link = item.selectFirst("link")?.text()?.trim()
                    ?: item.selectFirst("guid")?.text()?.trim()
                    ?: return@mapNotNull null

                val enclosure = item.selectFirst("enclosure[url]")?.attr("url")
                val mediaContent = item.selectFirst("media\\:content[url]")?.attr("url")
                val poster = enclosure ?: mediaContent ?: defaultPoster

                newMovieSearchResponse(title, link, TvType.Movie) {
                    this.posterUrl = fixUrlNull(poster)
                }
            }.take(25)
        } catch (e: Exception) {
            emptyList()
        }
    }

    private suspend fun fetchOdyseeChannel(channel: String, label: String): List<SearchResponse> {
        return try {
            val postBody = JSONObject().apply {
                put("jsonrpc", "2.0")
                put("method", "claim_search")
                put("params", JSONObject().apply {
                    put("channel", channel)
                    put("claim_type", "stream")
                    put("order_by", org.json.JSONArray().apply { put("release_time") })
                    put("page", 1)
                    put("page_size", 20)
                })
                put("id", 1)
            }.toString()

            val res = app.post(
                "https://api.na-backend.odysee.com/api/v1/proxy",
                headers = mapOf("Content-Type" to "application/json"),
                data = postBody
            ).text

            val json = JSONObject(res)
            val items = json.optJSONObject("result")?.optJSONArray("items") ?: return emptyList()
            val list = mutableListOf<SearchResponse>()

            for (i in 0 until items.length()) {
                val item = items.getJSONObject(i)
                val claimId = item.optString("claim_id")
                val name = item.optString("name")
                val value = item.optJSONObject("value") ?: JSONObject()
                val title = value.optString("title", name)
                val thumb = value.optJSONObject("thumbnail")?.optString("url") ?: defaultPoster
                val streamUrl = "https://odysee.com/$/download/$name/$claimId"

                list.add(newMovieSearchResponse(title, streamUrl, TvType.Movie) {
                    this.posterUrl = fixUrlNull(thumb)
                })
            }
            list
        } catch (e: Exception) {
            emptyList()
        }
    }
}
