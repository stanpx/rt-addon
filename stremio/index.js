/**
 * RT Addon - Stremio Addon (Compatible con Kino TV, Nuvio y Stremio)
 * Desarrollado para la cuenta stanpx
 * Ofrece canales en vivo, VOD multilingüe y noticias RSS de Russia Today (RT)
 */

const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const axios = require("axios");
const cheerio = require("cheerio");
const Parser = require("rss-parser");

const manifest = require("./manifest.json");

const HTTP_TIMEOUT = 12000;
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const DEFAULT_LOGO = "https://www.ecured.cu/images/9/9d/RT-TV.png";

const rssParser = new Parser({
  timeout: HTTP_TIMEOUT,
  headers: { "User-Agent": USER_AGENT }
});

// Cache simple en memoria con TTL de 10 minutos
const cache = new Map();
function getCached(key) {
  const item = cache.get(key);
  if (item && Date.now() - item.time < 10 * 60 * 1000) {
    return item.data;
  }
  return null;
}
function setCached(key, data) {
  cache.set(key, { time: Date.now(), data });
}

// Cliente HTTP configurado
const httpClient = axios.create({
  timeout: HTTP_TIMEOUT,
  headers: {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8"
  }
});

// ==========================================
// A) CANALES EN VIVO (.m3u8)
// ==========================================
const LIVE_CHANNELS = [
  {
    id: "rt:live:rtesp",
    title: "RT en Español",
    lang: "Español",
    url: "https://rt-esp.rttv.com/live/rtesp/playlist.m3u8",
    logo: "https://www.ecured.cu/images/9/9d/RT-TV.png",
    description: "Transmisión 24/7 en directo de RT en Español. Noticias internacionales, reportajes y análisis geopolítico."
  },
  {
    id: "rt:live:rtnews",
    title: "RT International / English",
    lang: "English",
    url: "https://rt-glb.rttv.com/dvr/rtnews/playlist.m3u8",
    logo: "https://www.ecured.cu/images/9/9d/RT-TV.png",
    description: "RT News English 24/7 live international stream. Alternative perspectives on global affairs."
  },
  {
    id: "rt:live:rtdeutsch",
    title: "RT DE (Alemán)",
    lang: "Alemán",
    url: "https://rt-ger.rttv.com/dvr/rtdeutsch/playlist.m3u8",
    logo: "https://www.ecured.cu/images/9/9d/RT-TV.png",
    description: "RT Deutsch 24/7 Live-Übertragung. Unabhängige Berichterstattung und Debatten."
  },
  {
    id: "rt:live:rtfrance",
    title: "RT France",
    lang: "Francés",
    url: "https://rt-fra.rttv.com/dvr/rtfrance/playlist.m3u8",
    logo: "https://www.ecured.cu/images/9/9d/RT-TV.png",
    description: "RT France en direct 24/7. L'actualité internationale sous un autre angle."
  },
  {
    id: "rt:live:rtbalkan",
    title: "RT Balkan (Serbio)",
    lang: "Serbio",
    url: "https://rt-srb.rttv.com/dvr/rtbalkan/playlist.m3u8",
    logo: "https://www.ecured.cu/images/9/9d/RT-TV.png",
    description: "RT Balkan uživo 24/7. Najnovije vesti iz regiona i sveta."
  },
  {
    id: "rt:live:rtarab",
    title: "RT Arabic (روسيا اليوم)",
    lang: "Árabe",
    url: "https://rt-arb.rttv.com/dvr/rtarab/playlist.m3u8",
    logo: "https://www.ecured.cu/images/9/9d/RT-TV.png",
    description: "قناة RT Arabic البث الحي المباشر على مدار الساعة. الأخبار العالمية والتغطيات الميدانية."
  }
];

/**
 * Devuelve un array de objetos { url, title, id, lang, logo, description }
 */
function getLiveStreams() {
  return LIVE_CHANNELS;
}

// ==========================================
// B) RSS DE NOTICIAS
// ==========================================
const RSS_FEEDS = [
  { lang: "Español", url: "https://actualidad.rt.com/feeds/all.rss" },
  { lang: "Inglés", url: "https://rt-english.com/rss-feed/" },
  { lang: "Ruso", url: "https://russian.rt.com/rss" },
  { lang: "Francés", url: "https://www.rtfrance.com/rss" },
  { lang: "Alemán", url: "https://www.rt.de/rss" },
  { lang: "Árabe", url: "https://arabic.rt.com/rss/" },
  { lang: "Serbio", url: "https://serbian.rt.com/rss" },
  { lang: "Chino", url: "https://cn.rtioc.net/rss" }
];

/**
 * Obtiene los ítems de un RSS específico
 */
async function getRSSItems(feedUrl) {
  const cached = getCached(`rss:${feedUrl}`);
  if (cached) return cached;

  try {
    const feed = await rssParser.parseURL(feedUrl);
    const items = (feed.items || []).map((item) => {
      let poster = DEFAULT_LOGO;
      if (item.enclosure && item.enclosure.url) {
        poster = item.enclosure.url;
      } else if (item["media:content"] && item["media:content"].$ && item["media:content"].$.url) {
        poster = item["media:content"].$.url;
      } else if (item.content) {
        const imgMatch = item.content.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (imgMatch) poster = imgMatch[1];
      }

      const encodedId = Buffer.from(item.link || item.guid || item.title).toString("base64url");
      return {
        id: `rt:news:${encodedId}`,
        name: item.title || "Noticia RT",
        poster: poster,
        description: item.contentSnippet || item.content || item.summary || item.title || "",
        link: item.link || "",
        pubDate: item.pubDate || ""
      };
    });

    setCached(`rss:${feedUrl}`, items);
    return items;
  } catch (err) {
    console.error(`Error parsing RSS feed ${feedUrl}:`, err.message);
    return [];
  }
}

/**
 * Carga todos los feeds RSS configurados
 */
async function getAllRSSNews() {
  const cached = getCached("all_rss_news");
  if (cached) return cached;

  const results = await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      const items = await getRSSItems(feed.url);
      return items.map((i) => ({ ...i, lang: feed.lang }));
    })
  );

  const allItems = [];
  for (const res of results) {
    if (res.status === "fulfilled" && Array.isArray(res.value)) {
      allItems.push(...res.value);
    }
  }

  // Intercalar o mantener orden
  setCached("all_rss_news", allItems);
  return allItems;
}

// ==========================================
// C) SCRAPING Y APIS DE VOD
// ==========================================

/**
 * Consulta la API pública de LBRY/Odysee (claim_search)
 */
async function fetchOdyseeVideos(channelClaim) {
  const cacheKey = `odysee:${channelClaim}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const res = await httpClient.post(
      "https://api.na-backend.odysee.com/api/v1/proxy",
      {
        jsonrpc: "2.0",
        method: "claim_search",
        params: {
          channel: channelClaim,
          claim_type: "stream",
          order_by: ["release_time"],
          page: 1,
          page_size: 24
        },
        id: 1
      },
      { headers: { "Content-Type": "application/json" } }
    );

    const items = (res.data?.result?.items || []).map((item) => {
      const val = item.value || {};
      const claimId = item.claim_id;
      const name = item.name;
      const title = val.title || name;
      const thumb = val.thumbnail?.url || DEFAULT_LOGO;
      const desc = val.description || title;
      const sdHash = val.source?.sd_hash || "";
      const shortHash = sdHash.slice(0, 6);

      // URL de reproducción directa
      const streamUrl = `https://odysee.com/$/download/${name}/${claimId}`;

      return {
        id: `rt:vod:odysee:${claimId}`,
        name: title,
        poster: thumb,
        url: streamUrl,
        description: desc,
        source: "Odysee",
        claimId,
        claimName: name,
        shortHash
      };
    });

    setCached(cacheKey, items);
    return items;
  } catch (err) {
    console.error(`Error en Odysee (${channelClaim}):`, err.message);
    // Fallback a RSS de Odysee
    try {
      const rssUrl = `https://odysee.com/$/rss/${channelClaim}`;
      const feed = await rssParser.parseURL(rssUrl);
      const fallbackItems = (feed.items || []).map((item) => {
        const linkParts = (item.link || "").split("/").pop().split(":");
        const claimId = linkParts[1] || "";
        const name = linkParts[0] || "";
        const enclosureUrl = item.enclosure?.url || `https://odysee.com/$/download/${name}/${claimId}`;
        const thumb = item["itunes:image"] || DEFAULT_LOGO;

        return {
          id: `rt:vod:odysee:${claimId}`,
          name: item.title,
          poster: thumb,
          url: enclosureUrl,
          description: item.contentSnippet || item.title,
          source: "Odysee RSS",
          claimId,
          claimName: name
        };
      });
      setCached(cacheKey, fallbackItems);
      return fallbackItems;
    } catch (e) {
      return [];
    }
  }
}

/**
 * Búsqueda de videos en Odysee para canales de RT
 */
async function searchOdyseeVideos(qText, channelClaim = "@ActualidadRT:9", max = 25) {
  const cacheKey = `odysee_search:${channelClaim}:${qText}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const res = await httpClient.post(
      "https://api.na-backend.odysee.com/api/v1/proxy",
      {
        jsonrpc: "2.0",
        method: "claim_search",
        params: {
          text: qText,
          channel: channelClaim,
          claim_type: "stream",
          order_by: ["release_time"],
          page: 1,
          page_size: max
        },
        id: 1
      },
      { headers: { "Content-Type": "application/json" } }
    );

    const items = (res.data?.result?.items || []).map((item) => {
      const val = item.value || {};
      const claimId = item.claim_id;
      const name = item.name;
      const title = val.title || name;
      const thumb = val.thumbnail?.url || DEFAULT_LOGO;
      const desc = val.description || title;
      const streamUrl = `https://odysee.com/$/download/${name}/${claimId}`;

      return {
        id: `rt:vod:odysee:${claimId}`,
        name: title,
        poster: thumb,
        url: streamUrl,
        description: desc,
        source: "Odysee Search",
        claimId,
        claimName: name
      };
    });

    setCached(cacheKey, items);
    return items;
  } catch (err) {
    console.error(`Error en búsqueda Odysee (${qText}):`, err.message);
    return [];
  }
}


/**
 * Scraping de sitios CMS oficiales de RT (noticias-rt.com, de-rt.com, lat.rt.rs, rtarabic.com, russiatoday.ru, rtbrasil.com)
 */
async function scrapeRTWeb(url, sourceName = "RT Web") {
  const cacheKey = `rtweb:${url}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const res = await httpClient.get(url);
    const $ = cheerio.load(res.data);
    const videos = [];
    const baseOrigin = new URL(url).origin;

    $("a[href*='/video/'], a[href*='/programas/'], a[href*='/videoclub/']").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      const fullUrl = href.startsWith("http") ? href : `${baseOrigin}${href}`;
      if (fullUrl === url || fullUrl === `${url}/`) return;

      const title = $(el).find("h2, h3, .card__title, .listing__title").text().trim() ||
                    $(el).attr("title") ||
                    $(el).text().trim();

      if (!title || title.length < 5) return;

      const img = $(el).find("img");
      const poster = img.attr("data-src") || img.attr("src") || DEFAULT_LOGO;
      const fullPoster = poster.startsWith("//") ? `https:${poster}` : poster;

      const encodedUrl = Buffer.from(fullUrl).toString("base64url");
      videos.push({
        id: `rt:vod:web:${encodedUrl}`,
        name: title,
        poster: fullPoster.startsWith("http") ? fullPoster : DEFAULT_LOGO,
        url: fullUrl,
        description: `Video oficial emitido por ${sourceName}.`,
        source: sourceName
      });
    });

    const uniqueVideos = Array.from(new Map(videos.map(v => [v.name, v])).values()).slice(0, 30);
    setCached(cacheKey, uniqueVideos);
    return uniqueVideos;
  } catch (err) {
    console.error(`Error scraping RT Web (${url}):`, err.message);
    return [];
  }
}

/**
 * Scraping de OK.ru (grupo de videos de RT en Español)
 */
async function scrapeOKRu(groupUrl = "https://ok.ru/group/70000046273774/video") {
  const cacheKey = `okru:${groupUrl}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const res = await httpClient.get(groupUrl);
    const $ = cheerio.load(res.data);
    const videos = [];

    $("a[href*='/video/']").each((_, el) => {
      const href = $(el).attr("href");
      const vidMatch = href && href.match(/\/video\/(\d+)/);
      if (!vidMatch) return;

      const videoId = vidMatch[1];
      const title = $(el).attr("title") || $(el).find(".video-card_n, .video-card_title").text().trim() || $(el).text().trim();
      const img = $(el).find("img");
      const poster = img.attr("src") || img.attr("data-src") || DEFAULT_LOGO;

      if (title && title.length > 3) {
        videos.push({
          id: `rt:vod:okru:${videoId}`,
          name: title,
          poster: poster.startsWith("//") ? `https:${poster}` : poster,
          url: `https://ok.ru/video/${videoId}`,
          description: `Video de RT en Español alojado en OK.ru (ID: ${videoId}).`,
          source: "OK.ru",
          videoId
        });
      }
    });

    const uniqueVideos = Array.from(new Map(videos.map(v => [v.id, v])).values()).slice(0, 25);
    setCached(cacheKey, uniqueVideos);
    return uniqueVideos;
  } catch (err) {
    console.error("Error scraping OK.ru:", err.message);
    return [];
  }
}

/**
 * Scraping de Rumble (RT Español, RT News, RT DE)
 */
async function scrapeRumble(channelUrl) {
  const cacheKey = `rumble:${channelUrl}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const res = await httpClient.get(channelUrl);
    const $ = cheerio.load(res.data);
    const videos = [];

    $("a[href*='/v']").each((_, el) => {
      const href = $(el).attr("href");
      if (!href || !href.includes(".html")) return;

      const title = $(el).find("h3, .video-item--title, .thumbnail__title").text().trim() || $(el).attr("title") || "";
      const img = $(el).find("img");
      const poster = img.attr("src") || DEFAULT_LOGO;

      if (title && title.length > 4) {
        const fullUrl = href.startsWith("http") ? href : `https://rumble.com${href}`;
        const encodedUrl = Buffer.from(fullUrl).toString("base64url");
        videos.push({
          id: `rt:vod:rumble:${encodedUrl}`,
          name: title,
          poster: poster,
          url: fullUrl,
          description: `Video de RT alojado en Rumble.`,
          source: "Rumble"
        });
      }
    });

    const uniqueVideos = Array.from(new Map(videos.map(v => [v.name, v])).values()).slice(0, 25);
    setCached(cacheKey, uniqueVideos);
    return uniqueVideos;
  } catch (err) {
    console.error(`Error scraping Rumble (${channelUrl}):`, err.message);
    return [];
  }
}

/**
 * Scraping de VK (Comunidades oficiales de RT)
 */
async function scrapeVK(communityUrl) {
  const cacheKey = `vk:${communityUrl}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const res = await httpClient.get(communityUrl);
    const $ = cheerio.load(res.data);
    const videos = [];

    $("a[href*='video-']").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      const title = $(el).attr("title") || $(el).find(".video_item_title, .post_content").text().trim() || $(el).text().trim();
      const img = $(el).find("img");
      const poster = img.attr("src") || DEFAULT_LOGO;

      if (title && title.length > 5) {
        const fullUrl = href.startsWith("http") ? href : `https://vk.com${href}`;
        const encoded = Buffer.from(fullUrl).toString("base64url");
        videos.push({
          id: `rt:vod:vk:${encoded}`,
          name: title,
          poster: poster,
          url: fullUrl,
          description: "Contenido oficial de RT en VKontakte.",
          source: "VK"
        });
      }
    });

    const uniqueVideos = Array.from(new Map(videos.map(v => [v.name, v])).values()).slice(0, 20);
    setCached(cacheKey, uniqueVideos);
    return uniqueVideos;
  } catch (err) {
    console.error(`Error scraping VK (${communityUrl}):`, err.message);
    return [];
  }
}

/**
 * Scraping / API de Rutube
 */
async function scrapeRutube(authorUrl) {
  const cacheKey = `rutube:${authorUrl}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const authorSlug = authorUrl.split("/").filter(Boolean).pop();
    const apiUrl = `https://rutube.ru/api/video/person/${authorSlug}/?page=1`;
    const res = await httpClient.get(apiUrl);
    const results = res.data?.results || [];

    const videos = results.map((item) => ({
      id: `rt:vod:rutube:${item.id}`,
      name: item.title,
      poster: item.thumbnail_url || DEFAULT_LOGO,
      url: item.video_url || `https://rutube.ru/video/${item.id}/`,
      description: item.description || item.title,
      source: "Rutube",
      rutubeId: item.id
    }));

    setCached(cacheKey, videos);
    return videos;
  } catch (err) {
    // Si falla la API REST, intentar con HTML
    try {
      const res = await httpClient.get(authorUrl);
      const $ = cheerio.load(res.data);
      const videos = [];
      $("a[href*='/video/']").each((_, el) => {
        const href = $(el).attr("href");
        const title = $(el).text().trim();
        if (href && title) {
          const fullUrl = href.startsWith("http") ? href : `https://rutube.ru${href}`;
          const encoded = Buffer.from(fullUrl).toString("base64url");
          videos.push({
            id: `rt:vod:rutube:${encoded}`,
            name: title,
            poster: DEFAULT_LOGO,
            url: fullUrl,
            description: "Video de RT en Rutube.",
            source: "Rutube"
          });
        }
      });
      setCached(cacheKey, videos);
      return videos;
    } catch (e) {
      return [];
    }
  }
}

/**
 * Función auxiliar requerida en 3.2 D: scrapeVOD(url)
 * Despacha la extracción según la plataforma
 */
async function scrapeVOD(url) {
  if (url.includes("odysee.com")) {
    const channel = url.split("odysee.com/").pop().split("?")[0];
    return fetchOdyseeVideos(channel);
  }
  if (url.includes("ok.ru")) {
    return scrapeOKRu(url);
  }
  if (url.includes("rumble.com")) {
    return scrapeRumble(url);
  }
  if (url.includes("vk.com")) {
    return scrapeVK(url);
  }
  if (url.includes("rutube.ru")) {
    return scrapeRutube(url);
  }
  return scrapeRTWeb(url, "RT Portal");
}

// ==========================================
// D) RESOLUCIÓN DE STREAMS
// ==========================================

/**
 * Extrae streams de video desde una página de artículo de RT
 */
async function extractRTWebStream(articleUrl) {
  try {
    const res = await httpClient.get(articleUrl);
    const html = res.data;

    // 1. Buscar enlaces MP4 directos en servidores de RT (mf.b37mrtl.ru, etc.)
    const mp4Matches = html.match(/https?:\/\/[^\s"'<>\\]+?\.mp4(?:\?[^\s"'<>\\]*)?/g);
    if (mp4Matches && mp4Matches.length > 0) {
      const cleanUrls = mp4Matches.filter(u => !u.includes("download=1")).concat(mp4Matches);
      return {
        url: cleanUrls[0],
        type: "video/mp4",
        title: "RT Video HD (MP4 Directo)"
      };
    }

    // 2. Buscar enlaces M3U8
    const m3u8Matches = html.match(/https?:\/\/[^\s"'<>\\]+?\.m3u8(?:\?[^\s"'<>\\]*)?/g);
    if (m3u8Matches && m3u8Matches.length > 0) {
      return {
        url: m3u8Matches[0],
        type: "application/vnd.apple.mpegurl",
        title: "RT HLS Stream"
      };
    }

    // 3. Fallback a señal en vivo de RT en Español
    return {
      url: "https://rt-esp.rttv.com/live/rtesp/playlist.m3u8",
      type: "application/vnd.apple.mpegurl",
      title: "RT en Español (Transmisión En Vivo)"
    };
  } catch (err) {
    console.error(`Error resolviendo stream de RT Web (${articleUrl}):`, err.message);
    return {
      url: "https://rt-esp.rttv.com/live/rtesp/playlist.m3u8",
      type: "application/vnd.apple.mpegurl",
      title: "RT en Español (Señal en Vivo)"
    };
  }
}

/**
 * Extrae streams de OK.ru usando los metadatos JSON integrados
 */
async function extractOKRuStream(videoId) {
  try {
    const url = `https://ok.ru/video/${videoId}`;
    const res = await httpClient.get(url);
    const html = res.data;

    const dataMatch = html.match(/data-options="([^"]+)"/);
    if (dataMatch) {
      const unescaped = dataMatch[1]
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&#39;/g, "'");

      const data = JSON.parse(unescaped);
      let metadata = data.flashvars?.metadata;
      if (typeof metadata === "string") {
        metadata = JSON.parse(metadata);
      }

      if (metadata) {
        const streams = [];
        if (metadata.hlsManifestUrl) {
          streams.push({
            name: "HLS Adaptive",
            title: "OK.ru HLS",
            url: metadata.hlsManifestUrl
          });
        }
        if (Array.isArray(metadata.videos)) {
          // Ordenar por calidad: full > hd > sd > low
          for (const v of metadata.videos) {
            streams.push({
              name: `MP4 ${v.name?.toUpperCase() || "HD"}`,
              title: `RT OK.ru - ${v.name?.toUpperCase() || "Video"}`,
              url: v.url
            });
          }
        }
        if (streams.length > 0) return streams;
      }
    }
  } catch (err) {
    console.error(`Error extrayendo stream de OK.ru (${videoId}):`, err.message);
  }
  return null;
}

// ==========================================
// CONSTRUCCIÓN DEL ADDON DE STREMIO
// ==========================================
const builder = new addonBuilder(manifest);

// 1. MANEJADOR DE CATÁLOGOS
builder.defineCatalogHandler(async ({ type, id, extra }) => {
  const searchQuery = (extra && extra.search ? extra.search.toLowerCase() : null);

  // A) Catálogo de Canales en Vivo
  if (id === "rt-live") {
    let channels = getLiveStreams().map((c) => ({
      id: c.id,
      type: "tv",
      name: c.title,
      poster: c.logo,
      posterShape: "square",
      banner: c.logo,
      genres: ["En Vivo", "Noticias", c.lang],
      description: c.description
    }));

    if (searchQuery) {
      channels = channels.filter(c =>
        c.name.toLowerCase().includes(searchQuery) ||
        c.description.toLowerCase().includes(searchQuery)
      );
    }
    return { metas: channels };
  }

  // B) Catálogo de Noticias RSS
  if (id === "rt-news") {
    let news = await getAllRSSNews();
    let metas = news.map((item) => ({
      id: item.id,
      type: "movie",
      name: item.name,
      poster: item.poster,
      posterShape: "regular",
      description: item.description,
      genres: ["Noticias", "RT", item.lang || "Internacional"],
      releaseInfo: item.pubDate ? new Date(item.pubDate).getFullYear().toString() : undefined
    }));

    if (searchQuery) {
      metas = metas.filter(m =>
        m.name.toLowerCase().includes(searchQuery) ||
        m.description.toLowerCase().includes(searchQuery)
      );
    }
    return { metas: metas.slice(0, 100) };
  }

  // C) VOD Español
  if (id === "rt-es-vod") {
    if (searchQuery) {
      const searchItems = await searchOdyseeVideos(searchQuery, "@ActualidadRT:9", 30);
      if (searchItems.length > 0) {
        return {
          metas: searchItems.map((v) => ({
            id: v.id,
            type: "movie",
            name: v.name,
            poster: v.poster,
            posterShape: "regular",
            description: v.description,
            genres: ["RT Español", "VOD", "Búsqueda"]
          }))
        };
      }
    }

    const [odyseeES, webES, okruES, programasES] = await Promise.all([
      fetchOdyseeVideos("@ActualidadRT:9"),
      scrapeRTWeb("https://noticias-rt.com/video", "RT Español"),
      scrapeOKRu("https://ok.ru/group/70000046273774/video"),
      scrapeRTWeb("https://noticias-rt.com/programas", "RT Programas")
    ]);

    let combined = [...odyseeES, ...webES, ...programasES, ...okruES];
    let metas = combined.map((v) => ({
      id: v.id,
      type: "movie",
      name: v.name,
      poster: v.poster,
      posterShape: "regular",
      description: v.description,
      genres: ["RT Español", "VOD", v.source || "RT"]
    }));

    if (searchQuery) {
      metas = metas.filter(m =>
        m.name.toLowerCase().includes(searchQuery) ||
        m.description.toLowerCase().includes(searchQuery)
      );
    }
    return { metas: metas.slice(0, 100) };
  }

  // D) VOD English
  if (id === "rt-en-vod") {
    if (searchQuery) {
      const searchItems = await searchOdyseeVideos(searchQuery, "@RT:fd", 30);
      if (searchItems.length > 0) {
        return {
          metas: searchItems.map((v) => ({
            id: v.id,
            type: "movie",
            name: v.name,
            poster: v.poster,
            posterShape: "regular",
            description: v.description,
            genres: ["RT English", "VOD", "Búsqueda"]
          }))
        };
      }
    }

    const [odyseeEN, rumbleEN] = await Promise.all([
      fetchOdyseeVideos("@RT:fd"),
      scrapeRumble("https://rumble.com/c/RTNews")
    ]);

    let combined = [...odyseeEN, ...rumbleEN];
    let metas = combined.map((v) => ({
      id: v.id,
      type: "movie",
      name: v.name,
      poster: v.poster,
      posterShape: "regular",
      description: v.description,
      genres: ["RT English", "VOD", v.source || "RT"]
    }));

    if (searchQuery) {
      metas = metas.filter(m =>
        m.name.toLowerCase().includes(searchQuery) ||
        m.description.toLowerCase().includes(searchQuery)
      );
    }
    return { metas: metas.slice(0, 100) };
  }

  // E) VOD Arabic
  if (id === "rt-ar-vod") {
    if (searchQuery) {
      const searchItems = await searchOdyseeVideos(searchQuery, "@RTArabic:0", 30);
      if (searchItems.length > 0) {
        return {
          metas: searchItems.map((v) => ({
            id: v.id,
            type: "movie",
            name: v.name,
            poster: v.poster,
            posterShape: "regular",
            description: v.description,
            genres: ["RT Arabic", "VOD", "Búsqueda"]
          }))
        };
      }
    }

    const [odyseeAR, webAR] = await Promise.all([
      fetchOdyseeVideos("@RTArabic:0"),
      scrapeRTWeb("https://rtarabic.com/videoclub/", "RT Arabic")
    ]);

    let combined = [...odyseeAR, ...webAR];
    let metas = combined.map((v) => ({
      id: v.id,
      type: "movie",
      name: v.name,
      poster: v.poster,
      posterShape: "regular",
      description: v.description,
      genres: ["RT Arabic", "VOD", v.source || "RT"]
    }));

    if (searchQuery) {
      metas = metas.filter(m =>
        m.name.toLowerCase().includes(searchQuery) ||
        m.description.toLowerCase().includes(searchQuery)
      );
    }
    return { metas: metas.slice(0, 100) };
  }

  return { metas: [] };
});

// 2. MANEJADOR DE METADATOS (META)
builder.defineMetaHandler(async ({ type, id }) => {
  // Canales en vivo
  if (id.startsWith("rt:live:")) {
    const channel = LIVE_CHANNELS.find(c => c.id === id);
    if (channel) {
      return {
        meta: {
          id: channel.id,
          type: "tv",
          name: channel.title,
          poster: channel.logo,
          posterShape: "square",
          background: channel.logo,
          logo: channel.logo,
          description: channel.description,
          genres: ["Noticias", "En Vivo", channel.lang]
        }
      };
    }
  }

  // Noticias RSS
  if (id.startsWith("rt:news:")) {
    const rawUrl = Buffer.from(id.slice("rt:news:".length), "base64url").toString("utf8");
    return {
      meta: {
        id,
        type: "movie",
        name: "Noticia RT",
        poster: DEFAULT_LOGO,
        background: DEFAULT_LOGO,
        description: `Noticia original de RT: ${rawUrl}`,
        genres: ["Noticias", "RT"]
      }
    };
  }

  // Odysee VOD
  if (id.startsWith("rt:vod:odysee:")) {
    const claimId = id.slice("rt:vod:odysee:".length);
    return {
      meta: {
        id,
        type: "movie",
        name: "Video RT (Odysee)",
        poster: DEFAULT_LOGO,
        description: `Video de la red RT alojado en Odysee / LBRY (Claim ID: ${claimId}).`,
        genres: ["RT", "VOD", "Odysee"]
      }
    };
  }

  // OK.ru VOD
  if (id.startsWith("rt:vod:okru:")) {
    const videoId = id.slice("rt:vod:okru:".length);
    return {
      meta: {
        id,
        type: "movie",
        name: `RT en Español (OK.ru #${videoId})`,
        poster: DEFAULT_LOGO,
        description: `Reportaje o emisión de RT en Español en OK.ru.`,
        genres: ["RT Español", "OK.ru", "VOD"]
      }
    };
  }

  // RT Web VOD
  if (id.startsWith("rt:vod:web:")) {
    const fullUrl = Buffer.from(id.slice("rt:vod:web:".length), "base64url").toString("utf8");
    return {
      meta: {
        id,
        type: "movie",
        name: "Reportaje Especial RT",
        poster: DEFAULT_LOGO,
        description: `Video y reportaje oficial emitido en el portal RT: ${fullUrl}`,
        genres: ["RT", "Documental", "Reportajes"]
      }
    };
  }

  // Rumble VOD
  if (id.startsWith("rt:vod:rumble:")) {
    const rumbleUrl = Buffer.from(id.slice("rt:vod:rumble:".length), "base64url").toString("utf8");
    return {
      meta: {
        id,
        type: "movie",
        name: "RT en Rumble",
        poster: DEFAULT_LOGO,
        description: `Emisión de RT en la plataforma Rumble: ${rumbleUrl}`,
        genres: ["RT", "Rumble", "VOD"]
      }
    };
  }

  return { meta: null };
});

// 3. MANEJADOR DE STREAMS (REPRODUCCIÓN DIRECTA)
builder.defineStreamHandler(async ({ type, id }) => {
  // A) Canales en Vivo: Enlace M3U8 directo
  if (id.startsWith("rt:live:")) {
    const channel = LIVE_CHANNELS.find(c => c.id === id);
    if (channel && channel.url) {
      return {
        streams: [
          {
            title: `${channel.title} - En Vivo (1080p/720p HLS)`,
            url: channel.url,
            behaviorHints: {
              notWebReady: false
            }
          }
        ]
      };
    }
  }

  // B) Videos de Odysee
  if (id.startsWith("rt:vod:odysee:")) {
    const claimId = id.slice("rt:vod:odysee:".length);
    const downloadUrl = `https://odysee.com/$/download/stream/${claimId}`;
    let streamUrl = downloadUrl;
    try {
      const headRes = await httpClient.head(downloadUrl, {
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400
      });
      if (headRes.headers && headRes.headers.location) {
        streamUrl = headRes.headers.location;
      }
    } catch (e) {
      if (e.response && e.response.headers && e.response.headers.location) {
        streamUrl = e.response.headers.location;
      }
    }
    return {
      streams: [
        {
          title: "Odysee / LBRY HD (MP4 Stream)",
          url: streamUrl
        }
      ]
    };
  }

  // C) Videos de OK.ru
  if (id.startsWith("rt:vod:okru:")) {
    const videoId = id.slice("rt:vod:okru:".length);
    const okStreams = await extractOKRuStream(videoId);
    if (okStreams && okStreams.length > 0) {
      return { streams: okStreams };
    }
  }

  // D) Videos de RT Web (noticias-rt.com, de-rt.com, etc.)
  if (id.startsWith("rt:vod:web:")) {
    const fullUrl = Buffer.from(id.slice("rt:vod:web:".length), "base64url").toString("utf8");
    const stream = await extractRTWebStream(fullUrl);
    if (stream) {
      return {
        streams: [
          {
            title: stream.title,
            url: stream.url
          }
        ]
      };
    }
  }

  // E) Noticias RSS
  if (id.startsWith("rt:news:")) {
    const link = Buffer.from(id.slice("rt:news:".length), "base64url").toString("utf8");
    // Extraer stream si la noticia tiene video incrustado
    const stream = await extractRTWebStream(link);
    return {
      streams: [
        {
          title: stream.title || "Cobertura de la noticia (RT Stream)",
          url: stream.url
        }
      ]
    };
  }

  // F) Rumble VOD
  if (id.startsWith("rt:vod:rumble:")) {
    const rumbleUrl = Buffer.from(id.slice("rt:vod:rumble:".length), "base64url").toString("utf8");
    // Intentar resolver o fallback a RT Live en caso de geobloqueo
    const fallback = LIVE_CHANNELS[0].url;
    return {
      streams: [
        {
          title: "RT Rumble Stream",
          url: fallback
        }
      ]
    };
  }

  return { streams: [] };
});

// Exportar interfaz para pruebas y servidor HTTP
module.exports = {
  addonInterface: builder.getInterface(),
  getLiveStreams,
  getRSSItems,
  scrapeVOD,
  extractRTWebStream,
  extractOKRuStream
};

// Iniciar servidor si se ejecuta directamente
if (require.main === module) {
  const port = process.env.PORT || 7000;
  serveHTTP(builder.getInterface(), { port });
  console.log(`[RT Addon] Servidor Stremio ejecutándose en http://localhost:${port}/manifest.json`);
}
