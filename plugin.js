/**
 * RT Addon - Plugin Nativo para Kino TV
 * Autor: stanpx
 * Contenido multilingüe de Russia Today (RT): Señales en vivo, noticias RSS y reportajes VOD.
 */

const DEFAULT_POSTER = "https://www.ecured.cu/images/9/9d/RT-TV.png";

// Función para generar IDs válidos según contrato de Kino (^[a-z0-9][a-z0-9-]{1,39}$)
function cleanId(prefix, str) {
  let h = 0;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  const suffix = Math.abs(h).toString(36);
  const p = prefix.toLowerCase().replace(/[^a-z0-9-]/g, "");
  return `${p}-${suffix}`.slice(0, 39);
}

const LIVE_SIGNALS = [
  {
    id: "rt-esp",
    title: "RT en Español",
    number: 1,
    lang: "Español",
    categoryId: "espanol",
    logo: DEFAULT_POSTER,
    ref: "live:rt-esp",
    url: "https://rt-esp.rttv.com/live/rtesp/playlist.m3u8",
    description: "Señal en directo 24/7 de RT en Español. Cobertura continua de noticias internacionales."
  },
  {
    id: "rt-eng",
    title: "RT International (English)",
    number: 2,
    lang: "English",
    categoryId: "english",
    logo: DEFAULT_POSTER,
    ref: "live:rt-eng",
    url: "https://rt-glb.rttv.com/dvr/rtnews/playlist.m3u8",
    description: "RT News 24/7 live international news and alternative geopolitical perspectives."
  },
  {
    id: "rt-de",
    title: "RT DE (Alemán)",
    number: 3,
    lang: "Alemán",
    categoryId: "deutsch",
    logo: DEFAULT_POSTER,
    ref: "live:rt-de",
    url: "https://rt-ger.rttv.com/dvr/rtdeutsch/playlist.m3u8",
    description: "RT Deutsch 24/7 Live-Übertragung. Unabhängige Berichterstattung und Analysen."
  },
  {
    id: "rt-fra",
    title: "RT France",
    number: 4,
    lang: "Francés",
    categoryId: "france",
    logo: DEFAULT_POSTER,
    ref: "live:rt-fra",
    url: "https://rt-fra.rttv.com/dvr/rtfrance/playlist.m3u8",
    description: "RT France en direct 24/7. L'information internationale indépendante."
  },
  {
    id: "rt-srb",
    title: "RT Balkan (Serbio)",
    number: 5,
    lang: "Serbio",
    categoryId: "balkan",
    logo: DEFAULT_POSTER,
    ref: "live:rt-srb",
    url: "https://rt-srb.rttv.com/dvr/rtbalkan/playlist.m3u8",
    description: "RT Balkan uživo 24/7. Najnovije vesti iz regiona i sveta."
  },
  {
    id: "rt-arb",
    title: "RT Arabic (روسيا اليوم)",
    number: 6,
    lang: "Árabe",
    categoryId: "arabic",
    logo: DEFAULT_POSTER,
    ref: "live:rt-arb",
    url: "https://rt-arb.rttv.com/dvr/rtarab/playlist.m3u8",
    description: "قناة RT Arabic البث الحي المباشر على مدار الساعة لآخر الأخبار والتغطيات."
  }
];

// Categorías para la pestaña En Vivo de Kino TV
export async function liveCategories() {
  await null;
  return [
    { id: "todos", title: "Todos los Canales", genre: "noticias" },
    { id: "espanol", title: "Español (RT en Español)", genre: "noticias" },
    { id: "english", title: "English (RT International)", genre: "noticias" },
    { id: "deutsch", title: "Deutsch (RT DE)", genre: "noticias" },
    { id: "france", title: "Français (RT France)", genre: "noticias" },
    { id: "balkan", title: "Balkan (RT Balkan)", genre: "noticias" },
    { id: "arabic", title: "العربية (RT Arabic)", genre: "noticias" }
  ];
}

// Canales para la guía de TV de Kino TV
export async function liveChannels(params = {}) {
  await null;
  const categoryId = (params && typeof params.categoryId === "string") ? params.categoryId.trim() : "";

  let list = LIVE_SIGNALS;
  if (categoryId && categoryId !== "todos") {
    list = list.filter(c => c.categoryId === categoryId);
  }

  return list.map(c => ({
    id: `ch-${c.id}`,
    title: c.title,
    number: c.number,
    categoryId: c.categoryId,
    logo: c.logo,
    ref: c.ref,
    stream: {
      url: c.url,
      mime: "application/x-mpegURL",
      headers: { "User-Agent": "Mozilla/5.0" }
    }
  }));
}

// Extracción de Noticias RSS para Kino
async function fetchNewsRSS(feedUrl) {
  try {
    const res = await kino.fetch(feedUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null && items.length < 20) {
      const block = match[1];
      const titleMatch = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
      const linkMatch = block.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/);
      const descMatch = block.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/);
      const encMatch = block.match(/<enclosure[^>]+url=["']([^"']+)["']/);

      if (titleMatch && linkMatch) {
        const title = titleMatch[1].trim();
        const link = linkMatch[1].trim();
        const poster = encMatch ? encMatch[1] : DEFAULT_POSTER;
        const desc = descMatch ? descMatch[1].replace(/<[^>]+>/g, "").trim() : title;

        items.push({
          id: cleanId("news", link),
          ref: `news:${link}`,
          title: title,
          kind: "movie",
          poster: poster,
          description: desc
        });
      }
    }
    return items;
  } catch (err) {
    kino.log("Aviso al consultar RSS:", String(err));
    return [];
  }
}

// Extracción de videos del sitio web de RT (noticias-rt.com)
async function fetchRTWebVideos(url, max = 20) {
  try {
    const res = await kino.fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    });
    if (!res.ok) return [];
    const html = await res.text();
    const videos = [];
    const linkRegex = /<a[^>]+href=["'](\/(?:video|programas)\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/g;
    let match;

    while ((match = linkRegex.exec(html)) !== null && videos.length < max) {
      const path = match[1];
      const inner = match[2];

      const titleMatch = inner.match(/<(?:h2|h3|span)[^>]*>([^<]+)<\//) || inner.match(/title=["']([^"']+)["']/);
      const imgMatch = inner.match(/<img[^>]+(?:src|data-src)=["']([^"']+)["']/);

      const title = titleMatch ? titleMatch[1].trim() : "";
      if (title.length > 5 && !path.endsWith("/video") && !path.endsWith("/programas")) {
        const fullUrl = `https://noticias-rt.com${path}`;
        const poster = imgMatch ? (imgMatch[1].startsWith("//") ? `https:${imgMatch[1]}` : imgMatch[1]) : DEFAULT_POSTER;

        videos.push({
          id: cleanId("web", path),
          ref: `web:${fullUrl}`,
          title: title,
          kind: "movie",
          poster: poster.startsWith("http") ? poster : DEFAULT_POSTER
        });
      }
    }
    return videos;
  } catch (err) {
    kino.log("Aviso al scrapear RT Web:", String(err));
    return [];
  }
}

// Extracción de Odysee vía API LBRY
async function fetchOdyseeVideos(channel, max = 20) {
  try {
    const postData = JSON.stringify({
      jsonrpc: "2.0",
      method: "claim_search",
      params: {
        channel: channel,
        claim_type: "stream",
        order_by: ["release_time"],
        page: 1,
        page_size: max
      },
      id: 1
    });

    const res = await kino.fetch("https://api.na-backend.odysee.com/api/v1/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: postData
    });

    if (!res.ok) return [];
    const json = await res.json();
    const items = json?.result?.items || [];

    return items.map(item => {
      const val = item.value || {};
      const title = val.title || item.name;
      const thumb = val.thumbnail?.url || DEFAULT_POSTER;
      const downloadUrl = `https://odysee.com/$/download/${item.name}/${item.claim_id}`;

      return {
        id: cleanId("odysee", item.claim_id),
        ref: `odysee:${item.claim_id}:${downloadUrl}`,
        title: title,
        kind: "movie",
        poster: thumb
      };
    });
  } catch (err) {
    kino.log("Aviso en Odysee API:", String(err));
    return [];
  }
}

// Pantalla principal de Kino TV (Home)
export async function home() {
  await null;
  const rows = [];

  // 1. Fila de Canales en Vivo
  rows.push({
    id: "rt_live_row",
    title: "RT En Vivo — Canales Internacionales",
    ref: "row:live",
    genre: "noticias",
    items: LIVE_SIGNALS.map(c => ({
      id: c.id,
      ref: c.ref,
      title: `${c.title} (En Vivo)`,
      kind: "movie",
      poster: c.logo
    }))
  });

  // 2. Fila de Noticias de Última Hora (RSS)
  try {
    const news = await fetchNewsRSS("https://actualidad.rt.com/feeds/all.rss");
    if (news.length > 0) {
      rows.push({
        id: "rt_news_row",
        title: "RT Noticias — Última Hora (RSS)",
        ref: "row:news",
        genre: "noticias",
        items: news
      });
    }
  } catch (_) {}

  // 3. Fila de Reportajes y VOD en Español
  try {
    const esVideos = await fetchRTWebVideos("https://noticias-rt.com/video");
    if (esVideos.length > 0) {
      rows.push({
        id: "rt_es_vod_row",
        title: "RT Español — Reportajes y Programas (VOD)",
        ref: "row:es_vod",
        genre: "noticias",
        items: esVideos
      });
    }
  } catch (_) {}

  // 4. Fila de VOD en Inglés (Odysee)
  try {
    const enVideos = await fetchOdyseeVideos("@RT:fd", 15);
    if (enVideos.length > 0) {
      rows.push({
        id: "rt_en_vod_row",
        title: "RT International — Videos & Documentaries",
        ref: "row:en_vod",
        genre: "noticias",
        items: enVideos
      });
    }
  } catch (_) {}

  return rows;
}

// Búsqueda en Kino TV
export async function search(query) {
  await null;
  const q = String(query || "").trim().toLowerCase();
  const items = [];

  // Buscar en canales en vivo
  LIVE_SIGNALS.forEach(c => {
    if (c.title.toLowerCase().includes(q) || c.lang.toLowerCase().includes(q)) {
      items.push({
        id: c.id,
        ref: c.ref,
        title: `${c.title} (En Vivo)`,
        kind: "movie",
        poster: c.logo
      });
    }
  });

  // Buscar en noticias RSS
  try {
    const news = await fetchNewsRSS("https://actualidad.rt.com/feeds/all.rss");
    news.forEach(n => {
      if (n.title.toLowerCase().includes(q)) {
        items.push(n);
      }
    });
  } catch (_) {}

  return items;
}

// Exploración de filas completas en Kino TV (Browse)
export async function browse(ref) {
  await null;
  if (ref === "row:live") {
    return {
      items: LIVE_SIGNALS.map(c => ({
        id: c.id,
        ref: c.ref,
        title: `${c.title} (En Vivo)`,
        kind: "movie",
        poster: c.logo
      }))
    };
  }
  if (ref === "row:news") {
    const items = await fetchNewsRSS("https://actualidad.rt.com/feeds/all.rss");
    return { items };
  }
  if (ref === "row:es_vod") {
    const items = await fetchRTWebVideos("https://noticias-rt.com/video", 40);
    return { items };
  }
  if (ref === "row:en_vod") {
    const items = await fetchOdyseeVideos("@RT:fd", 30);
    return { items };
  }

  return { items: [] };
}

// Resolución de reproducción en Kino TV (Resolve)
export async function resolve(ref) {
  await null;
  const r = String(ref || "").trim();

  // 1. Canales en vivo
  if (r.startsWith("live:")) {
    const chId = r.slice("live:".length);
    const signal = LIVE_SIGNALS.find(c => c.id === chId || c.ref === r);
    if (signal) {
      return {
        url: signal.url,
        mime: "application/x-mpegURL",
        headers: { "User-Agent": "Mozilla/5.0" }
      };
    }
  }

  // 2. Videos de Odysee
  if (r.startsWith("odysee:")) {
    const parts = r.split(":");
    const downloadUrl = parts[2] || `https://odysee.com/$/download/stream/${parts[1]}`;
    return {
      url: downloadUrl,
      mime: "video/mp4",
      headers: { "User-Agent": "Mozilla/5.0" }
    };
  }

  // 3. Videos de páginas web de RT (noticias-rt.com)
  if (r.startsWith("web:") || r.startsWith("news:")) {
    const targetUrl = r.startsWith("web:") ? r.slice("web:".length) : r.slice("news:".length);
    try {
      const res = await kino.fetch(targetUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
      });
      if (res.ok) {
        const html = await res.text();
        const mp4Match = html.match(/https?:\/\/[^\s"'<>\\]+?\.mp4(?:\?[^\s"'<>\\]*)?/);
        if (mp4Match) {
          return {
            url: mp4Match[0],
            mime: "video/mp4",
            headers: { "Referer": targetUrl }
          };
        }
        const m3u8Match = html.match(/https?:\/\/[^\s"'<>\\]+?\.m3u8(?:\?[^\s"'<>\\]*)?/);
        if (m3u8Match) {
          return {
            url: m3u8Match[0],
            mime: "application/x-mpegURL",
            headers: { "Referer": targetUrl }
          };
        }
      }
    } catch (err) {
      kino.log("Error resolviendo video web:", String(err));
    }

    // Fallback a la señal en vivo de RT en Español
    return {
      url: "https://rt-esp.rttv.com/live/rtesp/playlist.m3u8",
      mime: "application/x-mpegURL",
      headers: { "User-Agent": "Mozilla/5.0" }
    };
  }

  throw kino.error("not_found", "No se pudo resolver la fuente de video solicitada");
}
