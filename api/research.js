const ORIGIN = "https://martaedhyx.github.io";
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
  return data;
}

function isDirectArticle(item) {
  const url = safeUrl(item && item.url);
  if (!url) return false;
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
      (Array.isArray(item.highlights) ? item.highlights.join(" ") : ""), 1800);
    if (title.length < 9 || content.replace(/\s+/g, " ").trim().length < 60) return false;
    if (/^(home|homepage|beranda|latest news|ai news|berita terbaru|search results?)$/i.test(title)) return false;
    return true;
  } catch {
    return false;
  }
}

function source(provider, item) {
  const url = clean(item.url || item.link, MAX_URL);
  if (!/^https?:\/\//i.test(url)) return null;
  return {
    provider,
    title: clean(item.title || item.name || url, 300),
    url,
    content: clean(item.content || item.description || item.snippet || item.text ||
      (Array.isArray(item.highlights) ? item.highlights.join(" ") : ""), 1800)
  };
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

async function braveSearch(query) {
  const key = process.env.BRAVE_API_KEY;
  if (!key) return [];
  const url = "https://api.search.brave.com/res/v1/web/search?q=" + encodeURIComponent(query) + "&count=8";
  const data = await request(url, { headers: { "X-Subscription-Token": key } });
  return (((data.web || {}).results) || []).map(x => source("Brave", x)).filter(Boolean);
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
  return {
    provider: "Firecrawl",
    title: clean((d.metadata || {}).title || url, 300),
    url: clean((d.metadata || {}).sourceURL || url, MAX_URL),
    content: clean(d.markdown || d.content || "", 12000)
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ORIGIN);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.headers.origin && req.headers.origin !== ORIGIN) {
    return res.status(403).json({ error: "Origin tidak diizinkan." });
  }
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Gunakan POST." });

  const body = req.body || {};
  const action = body.action === "read" ? "read" : "search";
  const query = clean(body.query, MAX_QUERY);
  const url = safeUrl(clean(body.url, MAX_URL));
  const configured = ["BRAVE_API_KEY", "TAVILY_API_KEY", "EXA_API_KEY", "FIRECRAWL_API_KEY"]
    .filter(name => !!process.env[name]);

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
    return res.status(503).json({ error: "Pasang minimal satu dari BRAVE_API_KEY, TAVILY_API_KEY, atau EXA_API_KEY di Vercel.", configured });
  }

  const jobs = await Promise.allSettled([tavilySearch(query), braveSearch(query), exaSearch(query)]);
  const sources = [];
  const errors = [];
  jobs.forEach((job, index) => {
    if (job.status === "fulfilled") sources.push(...job.value);
    else errors.push(["Tavily", "Brave", "Exa"][index]);
  });

  const unique = [];
  const seen = new Set();
  for (const item of sources) {
    if (!isDirectArticle(item)) continue;
    const parsed = new URL(item.url); parsed.hash = ""; parsed.search = "";
    const key = parsed.toString().replace(/\/$/, "").toLowerCase();
    if (!seen.has(key)) { seen.add(key); unique.push(item); }
  }
  if (!unique.length) {
    return res.status(502).json({ error: "Tidak ada hasil pencarian yang berhasil diperoleh.", configured, failedProviders: errors });
  }
  return res.status(200).json({
    action,
    query,
    sources: unique.slice(0, MAX_SOURCES),
    configured,
    failedProviders: errors
  });
}
