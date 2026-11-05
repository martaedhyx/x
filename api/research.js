const ALLOWED_ORIGINS = [
  "https://martaedhyx.github.io",
  "https://xbot-marta-edi.vercel.app",
  "https://xbot-gamma-hazel.vercel.app"
];
const MAX_QUERY = 500;
const MAX_URL = 2048;
const TIMEOUT_MS = 12000;
const MAX_SOURCES = 15;

export const config = { maxDuration: 30 };

function clean(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function safeUrl(value) {
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" && u.protocol !== "http:") return "";
    if (u.username || u.password) return "";
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1" ||
        host.endsWith(".local") || host === "0.0.0.0" ||
        /^10\./.test(host) || /^192\.168\./.test(host) ||
        /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host)) return "";
    return u.toString();
  } catch {
    return "";
  }
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { Accept: "application/json", ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("Provider HTTP " + response.status);
  if (data && data.success === false) throw new Error(data.error || "Provider melaporkan kegagalan.");
  return data;
}

const AGGREGATOR_HOSTS = new Set([
  "thekush.codes", "originbrief.app", "news.pynoai.com",
  "crystal-method.com", "aiweekly.my"
]);

function isAggregatorUrl(value) {
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
    return AGGREGATOR_HOSTS.has(host) ||
      /(^|\.)(originbrief|thekush|crystal-method)\./i.test(host);
  } catch {
    return true;
  }
}

function isDirectArticle(item) {
  const url = safeUrl(item && item.url);
  if (!url || isAggregatorUrl(url)) return false;
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase().replace(/\/+$/, "") || "/";
    if (path === "/") return false;
    const blocked = /(^|\/)(tag|tags|topic|topics|category|categories|search|cari|author|authors|archive|archives|hub|today|daily|digest|roundup|briefing|feed|feeds|page|pages)(\/|$)/i;
    if (blocked.test(path)) return false;
    const parts = path.split("/").filter(Boolean);
    const last = parts[parts.length - 1] || "";
    if (/^(19|20)\d{2}([-/](0?[1-9]|1[0-2]))?([-/](0?[1-9]|[12]\d|3[01]))?$/.test(last)) return false;
    const tail = parts.slice(-3);
    if (tail.length >= 2 && /^(19|20)\d{2}$/.test(tail[0]) &&
        /^(0?[1-9]|1[0-2])$/.test(tail[1]) &&
        (tail.length === 2 || /^(0?[1-9]|[12]\d|3[01])$/.test(tail[2]))) return false;
    if (parts.length === 1 && /^(berita|news|ai|technology|teknologi|artikel|latest|terbaru|home|index)$/i.test(last)) return false;
    const title = clean(item.title || item.name, 300);
    const content = clean(item.content || item.description || item.snippet || item.text ||
      (Array.isArray(item.highlights) ? item.highlights.join(" ") : "") ||
      (Array.isArray(item.extra_snippets) ? item.extra_snippets.join(" ") : ""), 1800);
    if (title.length < 6 || content.replace(/\s+/g, " ").trim().length < 35) return false;
    if (/^(home|homepage|beranda|latest news|ai news|berita terbaru|search results?)$/i.test(title)) return false;
    return true;
  } catch {
    return false;
  }
}

function source(provider, item) {
  const url = clean(item.url || item.link, MAX_URL);
  if (!/^https?:\/\//i.test(url)) return null;
  let publisher = clean(item.publisher || item.source_name || item.site_name || item.domain ||
    (item.profile && (item.profile.long_name || item.profile.name)), 160);
  if (!publisher) {
    try { publisher = new URL(url).hostname.replace(/^www\./i, ""); } catch {}
  }
  const rawDate = item.published_date || item.publishedDate || item.published_at ||
    item.publishedAt || item.datePublished || item.date || item.page_age || "";
  const parsedDate = rawDate ? Date.parse(rawDate) : NaN;
  const publishedAt = Number.isFinite(parsedDate) && parsedDate > 0 && parsedDate <= Date.now() + 86400000
    ? new Date(parsedDate).toISOString() : "";
  const image = safeUrl(item.image || item.thumbnail || item.image_url || item.thumbnail_url || "");
  return {
    provider, title: clean(item.title || item.name, 300), publisher, publishedAt,
    url, image,
    content: clean(item.content || item.description || item.snippet || item.text ||
      (Array.isArray(item.highlights) ? item.highlights.join(" ") : "") ||
      (Array.isArray(item.extra_snippets) ? item.extra_snippets.join(" ") : ""), 1800)
  };
}

async function fetchPageImages(articleUrl) {
  try {
    const response = await fetch(articleUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; EdhyXBot/1.0)", Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) return { image: "", favicon: new URL("/favicon.ico", articleUrl).toString() };
    const html = (await response.text()).slice(0, 600000);
    const readAttr = (tag, name) => {
      const match = tag.match(new RegExp("\\b" + name + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))", "i"));
      return match ? (match[1] || match[2] || match[3] || "") : "";
    };
    const titleTag = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    const titleMeta = (html.match(/<meta\b[^>]*>/gi) || []).find(tag => /^(og:title|twitter:title)$/i.test(readAttr(tag, "property") || readAttr(tag, "name")));
    const pageTitle = clean((titleMeta && readAttr(titleMeta, "content")) || (titleTag && titleTag[1].replace(/<[^>]*>/g, " ").replace(/&amp;/gi, "&").trim()), 300);
    const tags = html.match(/<meta\b[^>]*>/gi) || [];
    let image = "";
    for (const tag of tags) {
      const property = readAttr(tag, "property") || readAttr(tag, "name");
      if (!/^(og:image|og:image:url|twitter:image|twitter:image:src)$/i.test(property)) continue;
      image = readAttr(tag, "content");
      if (image) break;
    }
    if (!image) {
      const imageLink = (html.match(/<link\b[^>]*>/gi) || []).find(tag => /(?:^|\s)image_src(?:\s|$)/i.test(readAttr(tag, "rel")));
      if (imageLink) image = readAttr(imageLink, "href");
    }
    image = image.replace(/&amp;/gi, "&").replace(/&#0*38;/gi, "&").trim();
    image = image && !/^data:/i.test(image) ? safeUrl(new URL(image, response.url || articleUrl).toString()) : "";

    const linkTags = html.match(/<link\b[^>]*>/gi) || [];
    const iconTag = linkTags.find(tag => /(?:^|\s)(?:shortcut\s+)?icon(?:\s|$)/i.test(readAttr(tag, "rel")) && !/apple-touch-icon/i.test(readAttr(tag, "rel"))) ||
      linkTags.find(tag => /apple-touch-icon/i.test(readAttr(tag, "rel")));
    let favicon = iconTag ? readAttr(iconTag, "href") : "";
    favicon = favicon.replace(/&amp;/gi, "&").replace(/&#0*38;/gi, "&").trim();
    if (favicon && !/^data:/i.test(favicon)) favicon = safeUrl(new URL(favicon, response.url || articleUrl).toString());
    if (!favicon) favicon = new URL("/favicon.ico", articleUrl).toString();
    return { image, favicon, title: pageTitle };
  } catch {
    try { return { image: "", favicon: new URL("/favicon.ico", articleUrl).toString() }; }
    catch { return { image: "", favicon: "" }; }
  }
}
async function tavilySearch(query) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return [];
  const data = await request("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
    body: JSON.stringify({ query, search_depth: "basic", max_results: 8, include_answer: false })
  });
  return (data.results || []).map(x => source("Tavily", x)).filter(Boolean);
}


async function exaSearch(query) {
  const key = process.env.EXA_API_KEY;
  if (!key) return [];
  const data = await request("https://api.exa.ai/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key },
    body: JSON.stringify({ query, type: "auto", numResults: 8, contents: { text: { maxCharacters: 1400 } } })
  });
  return (data.results || []).map(x => source("Exa", x)).filter(Boolean);
}

async function firecrawlRead(url) {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return null;
  const data = await request("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true })
  });
  const d = data.data || data;
  const content = clean(d.markdown || d.content || "", 12000);
  if (!content) throw new Error("Firecrawl tidak mengembalikan isi halaman.");
  return {
    provider: "Firecrawl",
    title: clean((d.metadata || {}).title || url, 300),
    url: clean((d.metadata || {}).sourceURL || url, MAX_URL),
    image: safeUrl((d.metadata || {}).ogImage || (d.metadata || {}).image || ""),
    content
  };
}

export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  const allowed = ALLOWED_ORIGINS.includes(origin);

  if (allowed) res.setHeader("Access-Control-Allow-Origin", origin);

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (origin && !allowed) {
    return res.status(403).json({ error: "Origin tidak diizinkan." });
  }
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Gunakan POST." });

  const body = req.body || {};
  const action = body.action === "read" ? "read" : body.action === "metadata" ? "metadata" : "search";
  const query = clean(body.query, MAX_QUERY);
  const url = safeUrl(clean(body.url, MAX_URL));
  const configured = ["TAVILY_API_KEY", "EXA_API_KEY", "FIRECRAWL_API_KEY"]
    .filter(name => !!process.env[name]);

  if (action === "metadata") {
    const urls = Array.isArray(body.urls) ? body.urls.map(value => safeUrl(clean(value, MAX_URL))).filter(Boolean).slice(0, 8) : [];
    if (!urls.length) return res.status(400).json({ error: "Daftar URL sumber tidak valid." });
    const metadata = await Promise.all(urls.map(async pageUrl => {
      const visual = await fetchPageImages(pageUrl);
      return { url: pageUrl, title: visual.title || "", image: visual.image, favicon: visual.favicon };
    }));
    return res.status(200).json({ action, metadata });
  }

  if (action === "read") {
    if (!url) return res.status(400).json({ error: "URL tidak valid. Gunakan alamat HTTP atau HTTPS publik." });
    if (!process.env.FIRECRAWL_API_KEY) return res.status(503).json({ error: "FIRECRAWL_API_KEY belum dipasang di Vercel." });
    try {
      const result = await firecrawlRead(url);
      return res.status(200).json({ action, sources: result ? [result] : [], configured });
    } catch {
      return res.status(502).json({ error: "Firecrawl gagal membaca halaman. Coba lagi nanti.", configured });
    }
  }

  if (!query) return res.status(400).json({ error: "Query pencarian wajib diisi." });
  if (!configured.some(x => x !== "FIRECRAWL_API_KEY")) {
    return res.status(503).json({ error: "Pasang minimal satu dari TAVILY_API_KEY atau EXA_API_KEY di Vercel.", configured });
  }

  // Urutan pencarian: Tavily, lalu Exa.
  const failures = [];
  let selectedProvider = "";
  let selectedItems = [];
  for (const [name, search] of [["Tavily", tavilySearch], ["Exa", exaSearch]]) {
    try {
      const items = (await search(query) || []).filter(isDirectArticle);
      if (!items.length) throw new Error("tidak ada artikel valid");
      selectedProvider = name;
      selectedItems = items;
      break;
    } catch (error) {
      failures.push(name + ": " + (error && error.message ? error.message : "gagal"));
    }
  }
  if (!selectedItems.length) {
    return res.status(502).json({
      error: "Tavily dan Exa gagal atau tidak menghasilkan artikel valid.",
      configured, failedProviders: failures, googleFallback: true
    });
  }
  const unique = [];
  const seen = new Set();
  for (const item of selectedItems) {
    try {
      const parsed = new URL(item.url);
      parsed.hash = "";
      parsed.search = "";
      const key = parsed.toString().toLowerCase();
      if (!seen.has(key)) { seen.add(key); unique.push(item); }
    } catch {}
  }
  return res.status(200).json({
    action, query, sources: unique.slice(0, MAX_SOURCES),
    selectedProvider, failedProviders: failures, configured,
    retrievalMode: "priority-fallback"
  });
}
