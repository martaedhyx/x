/* EdhyX patch v3: perbaikan model + multi-sumber (Tavily, Wikipedia, OpenAlex, cuaca/gempa) */
(function () {
  var orig = window.fetch.bind(window);
  var API = 'generativelanguage.googleapis.com';
  var BACKUP = 'gemini-3.1-flash-lite';
  var $ = function (id) { return document.getElementById(id); };
  function ls(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function swap(u, m) { return u.replace(/models\/[^:\/?]+/, 'models/' + encodeURIComponent(m)); }
  function withBody(o, b) { return Object.assign({}, o, { body: JSON.stringify(b) }); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------- kolom Tavily di Pengaturan ---------- */
  (function () {
    var dlg = $('dlg'), row = dlg && dlg.querySelector('.row');
    if (!dlg || !row) return;
    var lab = document.createElement('label');
    lab.setAttribute('for', 'tavkey');
    lab.innerHTML = 'Tavily API key (opsional)<span>Untuk pencarian web dan berita. Dibuat di tavily.com. Disimpan hanya di browser ini.</span>';
    var inp = document.createElement('input');
    inp.id = 'tavkey'; inp.type = 'password'; inp.autocomplete = 'off'; inp.placeholder = 'tvly-...';
    dlg.insertBefore(lab, row); dlg.insertBefore(inp, row);
    $('settingsBtn').addEventListener('click', function () { inp.value = ls('tavily_key'); });
    $('saveBtn').addEventListener('click', function () {
      try { localStorage.setItem('tavily_key', inp.value.trim()); } catch (e) {}
    });
  })();

  /* ---------- sumber data ---------- */
  function jget(url, opt) {
    var c = new AbortController(), t = setTimeout(function () { c.abort(); }, 16000);
    opt = Object.assign({ signal: c.signal }, opt || {});
    return orig(url, opt).then(async function (r) {
      clearTimeout(t);
      var data = await r.json().catch(function () { return {}; });
      if (!r.ok) throw new Error((data && data.error) || ('HTTP ' + r.status));
      return data;
    }).catch(function (e) { clearTimeout(t); throw e; });
  }
  /* Pencarian web melalui backend Vercel; API key provider tetap di server. */
  var RESEARCH_API = 'https://edhy-robot.vercel.app/api/research';
  function research(q, action, pageUrl) {
    return jget(RESEARCH_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: action || 'search', query: q, url: pageUrl || '' })
    }).then(function (d) {
      var rows = d.sources || [];
      // Berita harus merujuk artikel, bukan halaman tag/topik/kategori atau beranda.
      if ((action || 'search') === 'search') {
        var seenArticleUrls = Object.create(null);
        rows = rows.filter(function (r) {
          try {
            var u = new URL(r.url), path = u.pathname.toLowerCase();
            while (path.length > 1 && path.charAt(path.length - 1) === '/') path = path.slice(0, -1);
            if (!/^https?:$/.test(u.protocol) || !u.hostname) return false;
            if (!path || path === '/' || new RegExp('(^|/)(tag|tags|topic|topics|category|categories|search|cari|author|authors|archive|archives|hub)(/|$)','i').test(path)) return false;
            // Tolak halaman feed/rangkuman harian; bukan artikel primer untuk satu klaim.
            if (new RegExp('(^|/)(today|daily|digest|roundup|briefing)(/|$)','i').test(path)) return false;
            var title = String(r.title || '').trim();
            if (/(?:ai\\s+daily|daily\\s+ai|daily briefing|news roundup|ai news.*(?:today|daily)|(?:today|daily).*ai news)/i.test(title)) return false;
            var parts = path.split('/').filter(Boolean), last = parts[parts.length - 1] || '';
            if (/^(19|20)\d{2}([-/](0?[1-9]|1[0-2]))?([-/](0?[1-9]|[12]\d|3[01]))?$/.test(last)) return false;
            var dateTail = parts.slice(-3);
            if (dateTail.length >= 2 && /^(19|20)\d{2}$/.test(dateTail[0]) &&
                /^(0?[1-9]|1[0-2])$/.test(dateTail[1]) &&
                (dateTail.length === 2 || /^(0?[1-9]|[12]\d|3[01])$/.test(dateTail[2]))) return false;
            if (parts.length === 1 && /^(berita|news|ai|technology|teknologi|artikel|latest|terbaru)$/i.test(last)) return false;
            if (String(r.title || '').trim().length <= 8 || String(r.content || '').trim().length < 60) return false;
            u.hash = ''; u.search = '';
            var canonical = u.href.replace(/\/$/, '').toLowerCase();
            if (seenArticleUrls[canonical]) return false;
            seenArticleUrls[canonical] = true;
            return true;
          } catch (e) { return false; }
        });
      }
      return rows.map(function (r) {
        return '- [' + (r.provider || 'Web') + '] ' + (r.title || 'Artikel') +
          ' (' + r.url + '): ' + String(r.content || '').slice(0, 1800) +
          (r.image ? ' [THUMBNAIL: ' + r.image + ']' : '') +
          (r.favicon ? ' [SITE_ICON: ' + r.favicon + ']' : '');
      }).join('\n');
    });
  }
  function wiki(q, lang) {
    var u = 'https://' + lang + '.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=' + encodeURIComponent(q) +
      '&gsrlimit=2&prop=extracts&exintro=1&explaintext=1&exchars=600&format=json&origin=*';
    return jget(u).then(function (d) {
      var p = d.query && d.query.pages ? Object.keys(d.query.pages).map(function (k) { return d.query.pages[k]; }) : [];
      p.sort(function (a, b) { return a.index - b.index; });
      return p.map(function (x) {
        return '- ' + x.title + ' (https://' + lang + '.wikipedia.org/wiki/' + encodeURIComponent(x.title.replace(/ /g, '_')) + '): ' + String(x.extract || '').replace(/\s+/g, ' ');
      }).join('\n');
    });
  }
  function openalex(q) {
    return jget('https://api.openalex.org/works?search=' + encodeURIComponent(q) + '&per-page=4&select=display_name,publication_year,doi,cited_by_count').then(function (d) {
      return (d.results || []).map(function (w) {
        return '- ' + w.display_name + ' (' + w.publication_year + ', dikutip ' + w.cited_by_count + 'x)' + (w.doi ? ' ' + w.doi : '');
      }).join('\n');
    });
  }
  var WMO = { 0: 'cerah', 1: 'cerah berawan', 2: 'berawan', 3: 'mendung', 45: 'berkabut', 51: 'gerimis', 61: 'hujan ringan', 63: 'hujan sedang', 65: 'hujan lebat', 80: 'hujan lokal', 95: 'badai petir' };
  function weather(city) {
    return jget('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(city) + '&count=1&language=id').then(function (g) {
      var p = g.results && g.results[0]; if (!p) return '';
      return jget('https://api.open-meteo.com/v1/forecast?latitude=' + p.latitude + '&longitude=' + p.longitude +
        '&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=3')
        .then(function (w) {
          var c = w.current, d = w.daily, out = ['Cuaca ' + p.name + ' (Open-Meteo): sekarang ' + c.temperature_2m + '°C, ' + (WMO[c.weather_code] || 'kode ' + c.weather_code) + ', kelembapan ' + c.relative_humidity_2m + '%, angin ' + c.wind_speed_10m + ' km/j.'];
          for (var i = 0; i < d.time.length; i++) out.push('- ' + d.time[i] + ': ' + d.temperature_2m_min[i] + '-' + d.temperature_2m_max[i] + '°C, peluang hujan ' + d.precipitation_probability_max[i] + '%');
          return out.join('\n');
        });
    });
  }
  function quake() {
    return jget('https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json').then(function (d) {
      var g = d.Infogempa && d.Infogempa.gempa; if (!g) return '';
      return 'Gempa terbaru BMKG: ' + g.Tanggal + ' ' + g.Jam + ', M' + g.Magnitude + ', kedalaman ' + g.Kedalaman + ', ' + g.Wilayah + '. Potensi: ' + g.Potensi + '. ' + (g.Dirasakan || '');
    });
  }
  function safe(p, label) { return p.then(function (t) { return t ? '[' + label + ']\n' + t : ''; }).catch(function () { return ''; }); }

  async function gather(q) {
    var s = q.toLowerCase(), jobs = [];
    var pageMatch = q.match(/https?:\/\/[^\s<>"']+/i);
    var pageUrl = pageMatch ? pageMatch[0].replace(/[),.;!?]+$/, '') : '';
    var web = /\b(sekarang|terbaru|terkini|hari ini|kemarin|minggu ini|bulan ini|tahun ini|update|berita|harga|tarif|kurs|jadwal|skor|rilis|versi|bandingkan|telusuri|cari|search|latest|news|today)\b/.test(s) || !!pageUrl;
    var fact = /\b(siapa|apa itu|apa yang|sejarah|jelaskan|pengertian|definisi|kapan|di mana|dimana|berapa|ibu kota|biografi)\b/.test(s);
    var sci = /\b(jurnal|penelitian|riset|studi|paper|ilmiah|skripsi|referensi)\b/.test(s);
    var wx = /\b(cuaca|suhu|prakiraan|hujan)\b/.test(s), eq = /\b(gempa)\b/.test(s);
    var clean = q.replace(/\b(tolong|dong|sih|ya|apa itu|siapa|jelaskan|apa kabar)\b/gi, '').replace(/[?!]/g, '').trim() || q;
    if (pageUrl) {
      jobs.push(safe(research(q, 'read', pageUrl), 'Isi halaman web (Vercel)'));
    } else if (web || fact) {
      jobs.push(research(q, 'search').then(function (t) {
        return t ? '[Artikel web/berita yang lolos pemeriksaan tautan]\n' + t :
          '[Sumber artikel spesifik tidak ditemukan] Hasil pencarian hanya berisi halaman umum/tag/kategori atau tidak memiliki isi artikel yang cukup. Jangan menyajikan klaim berita terkini sebagai fakta dan jangan membuat judul, tanggal, atau tautan sendiri. Katakan bahwa sumber artikel belum berhasil ditemukan.';
      }).catch(function (e) {
        return '[Pencarian web gagal] Backend Vercel: ' + String(e.message || e) + '. Jangan mengarang hasil atau sumber; jika Google Search tersedia, gunakan alat tersebut.';      }));
    }
    if (fact || sci) { jobs.push(safe(wiki(clean, 'id'), 'Wikipedia ID')); jobs.push(safe(wiki(clean, 'en'), 'Wikipedia EN')); }
    if (sci) jobs.push(safe(openalex(clean), 'Jurnal (OpenAlex)'));
    if (wx) {
      var m = q.match(/(?:cuaca|suhu|prakiraan|hujan)\s+(?:di\s+|kota\s+)?([a-zA-Z ]{3,30}?)(?:\s+(?:hari|besok|lusa|sekarang|saat|minggu|nanti)|[?.!,]|$)/i);
      if (m) jobs.push(safe(weather(m[1].trim()), 'Cuaca'));
    }
    if (eq) jobs.push(safe(quake(), 'Gempa (BMKG)'));
    if (!jobs.length) return '';
    var out = (await Promise.all(jobs)).filter(Boolean).join('\n\n');
    return out.slice(0, 9000);
  }
  async function enrich(body) {
    try {
      var cs = body.contents || [], last = cs[cs.length - 1];
      if (!last || last.role !== 'user') return false;
      var tp = last.parts.filter(function (p) { return p.text && p.text.indexOf('[Isi file:') !== 0; }).pop();
      if (!tp) return false;
      var ctx = await gather(tp.text);
      if (!ctx) return false;
      var note = '\n\nATURAN KETAT SUMBER DAN BERITA: Data berikut bukan bukti otomatis bahwa setiap klaim benar. Untuk daftar beberapa berita, setiap berita wajib didukung oleh artikel tersendiri yang isi dan judulnya langsung relevan dengan klaim tersebut. Gunakan URL artikel asli dari media, bukan halaman agregator/rangkuman harian/feed seperti /today, /hub/, /digest/, /roundup/ atau /briefing. Jangan memakai halaman tag, topik, kategori, arsip tanggal, hasil pencarian, atau beranda sebagai bukti. Satu berita = satu URL artikel spesifik; jangan memakai URL yang sama untuk dua berita berbeda. Jangan menulis tautan generik berlabel Baca selengkapnya; label tautan harus berupa judul artikel atau nama media yang benar. Jika artikel langsung yang berbeda tidak cukup, tampilkan lebih sedikit berita dan jelaskan kekurangannya—jangan memaksakan jumlah. Tanggal terbit harus berasal dari artikel, bukan tanggal pencarian atau tanggal arsip. Jangan mengarang nama media, judul, tanggal, kutipan, angka, atau URL. Jika klaim tidak didukung isi artikel, tandai belum terverifikasi atau hilangkan. Setiap sumber yang benar-benar dipakai wajib ditautkan langsung pada klaimnya dengan format Markdown [judul artikel](URL artikel asli). Jangan mengganti URL artikel dengan halaman topik/kategori. Bila hasil pencarian backend kosong atau tidak cukup, gunakan Google Search yang tersedia untuk mencari artikel primer tambahan; bila tetap tidak ditemukan, nyatakan sumber belum ditemukan dan jangan mengarang. Tampilkan nama media normal tanpa awalan kata image/favicon dan tanpa kode ikon.\n' + ctx;
      if (!body.system_instruction) body.system_instruction = { parts: [{ text: '' }] };
      body.system_instruction.parts[0].text += note;
      // Pertahankan Google Search/URL Context sebagai jalur tambahan jika backend tidak menemukan artikel langsung.
      return ctx;
    } catch (e) { return false; }
  }

  async function attachResearchSources(res, ctx) {
    if (!ctx || !res || !res.ok) return res;
    try {
      var found = [], seen = Object.create(null);
      ctx.split('\n').forEach(function (line) {
        var m = line.match(/^- \[([^\]]+)\] (.*?) \((https?:\/\/[^)]+)\):/);
        if (!m) return;
        var title = String(m[2] || '').trim(), url = String(m[3] || '').trim();
        var imageAt = line.indexOf('[THUMBNAIL: ');
        var imageUrl = imageAt >= 0 ? line.slice(imageAt + 12).split(']')[0].trim() : '';
        var iconAt = line.indexOf('[SITE_ICON: ');
        var faviconUrl = iconAt >= 0 ? line.slice(iconAt + 12).split(']')[0].trim() : '';
        try {
          var u = new URL(url); u.hash = ''; u.search = '';
          var key = u.href.replace(/\/$/, '').toLowerCase();
          if (!seen[key] && title && /^https?:$/.test(u.protocol)) {
            seen[key] = true; found.push({ provider:m[1], title:title, url:url, image:imageUrl, favicon:faviconUrl });
          }
        } catch (e) {}
      });
      if (!found.length) return res;
      var data = await res.clone().json();
      var parts = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
      if (!parts || !parts.length) return res;
      var target = parts.find(function (p) { return typeof p.text === 'string' && !p.thought; });
      if (!target) return res;
      var list = found.map(function (x) {
        return (x.favicon ? '![logo situs](' + x.favicon + ') ' : '') +
          '[' + x.title.replace(/\\[/g, '(').replace(/\\]/g, ')') + '](' + x.url + ') — ' + x.provider +
          (x.image ? ' ![thumbnail artikel](' + x.image + ')' : '');
      }).join('\n');
      target.text += '\n\n### Sumber web yang ditemukan dan diperiksa\n' + list;
      var headers = new Headers(res.headers);
      headers.delete('content-length'); headers.delete('content-encoding');
      headers.set('content-type', 'application/json; charset=utf-8');
      return new Response(JSON.stringify(data), { status:res.status, statusText:res.statusText, headers:headers });
    } catch (e) { return res; }
  }

  /* ---------- pembungkus fetch ke Gemini ---------- */
  async function hasAnswer(res) {
    if (!res.ok) return true;
    try {
      var d = await res.clone().json();
      var p = d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts;
      return !!(p && p.some(function (x) { return !x.thought && (x.text || x.inlineData); }));
    } catch (e) { return true; }
  }

  window.fetch = async function (url, opts) {
    if (typeof url !== 'string' || url.indexOf(API) < 0) return orig(url, opts);
    var model = ls('gem_model') || BACKUP;
    var m = url.match(/models\/([^:\/?]+)/);
    var used = m ? decodeURIComponent(m[1]) : '';
    var isImg = /image/.test(used);
    var researchContext = '';
    var body = null;
    try { body = JSON.parse(opts.body); } catch (e) {}

    if (/^gemini-2\.5/.test(used)) { url = swap(url, model); used = model; }
    if (body && !isImg) {
      /* Waktu lokal perangkat: diperbarui setiap kali pengguna mengirim pesan. */
      try {
        var now = new Date();
        var zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        var localStamp = new Intl.DateTimeFormat('id-ID', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
          hourCycle: 'h23', timeZone: zone, timeZoneName: 'long'
        }).format(now);
        if (!body.system_instruction) body.system_instruction = { parts: [{ text: '' }] };
        if (!body.system_instruction.parts || !body.system_instruction.parts.length) body.system_instruction.parts = [{ text: '' }];
        body.system_instruction.parts[0].text +=
          '\n\nKONTEKS WAKTU LOKAL PENGGUNA (otomatis saat pesan dikirim): ' + localStamp +
          '. Zona waktu perangkat: ' + zone +
          '. Gunakan informasi ini untuk menjawab pertanyaan tentang jam, tanggal, hari, besok, kemarin, dan hitung mundur. Ini adalah waktu dari jam perangkat pengguna; jangan mengklaim telah menyinkronkannya dengan jam atomik/internet.';
        body.system_instruction.parts[0].text +=
          '\n\nEDHY VISUAL & DOCUMENT ENGINE: Pilih format visual sesuai permintaan pengguna. Jika diminta tabel biasa, tulis tabel Markdown standar dengan baris header dan pemisah |---| agar dirender sebagai tabel sungguhan. Jika diminta diagram alur atau diagram hubungan, keluarkan satu blok kode berbahasa mermaid berisi sintaks Mermaid yang valid, misalnya flowchart TD dengan node A[Langkah] dan B[Hasil]. Jika diminta grafik, keluarkan satu blok kode berbahasa edhychart yang isinya JSON valid dengan bentuk {"type":"bar|line|pie|doughnut","title":"Judul","labels":["Label 1","Label 2"],"datasets":[{"label":"Nama seri","data":[10,20]}]}. Gunakan hanya data yang tersedia; jangan mengarang angka. Jika diminta membuat file Word atau PDF, keluarkan satu blok edhydocument berisi JSON valid: {"title":"Judul dokumen","blocks":[{"type":"heading","text":"Judul bagian"},{"type":"paragraph","text":"Isi paragraf"},{"type":"bullet","text":"Poin"},{"type":"table","headers":["Kolom 1","Kolom 2"],"rows":[["A","B"]]}]}. Jika diminta file Excel, keluarkan satu blok edhyexcel berisi JSON valid: {"title":"Nama buku kerja","sheets":[{"name":"Data","headers":["Kolom 1","Kolom 2"],"rows":[["A","B"]]}]}. Jangan bungkus JSON dengan teks tambahan di dalam blok tersebut. Di luar blok, berikan pengantar singkat. Pastikan JSON valid, string memakai tanda kutip ganda, dan tidak ada koma tambahan. Untuk permintaan Word/PDF/Excel, hasil harus berupa struktur lengkap yang siap diunduh, bukan sekadar petunjuk.';

      } catch (e) {}
      var enrichedContext = await enrich(body);
      if (enrichedContext) researchContext = enrichedContext;
      opts = withBody(opts, body);
    }

    var res = await orig(url, opts);
    for (var i = 0; i < 2 && (res.status === 500 || res.status === 503); i++) {
      await sleep(1500 * (i + 1)); res = await orig(url, opts);
    }
    if ((res.status === 503 || res.status === 404) && !isImg && used !== BACKUP) {
      url = swap(url, BACKUP); used = BACKUP; res = await orig(url, opts);
    }
    if (isImg || !body) return res;

    if (!res.ok && [400, 403, 429].indexOf(res.status) >= 0 && body.tools) {
      body = clone(body); delete body.tools; delete body.toolConfig;
      res = await orig(url, withBody(opts, body));
    }
    if (!(await hasAnswer(res))) {
      if (body.tools) {
        var b1 = clone(body); b1.tools = [{ google_search: {} }]; delete b1.toolConfig;
        res = await orig(url, withBody(opts, b1));
        if (!(await hasAnswer(res))) { var b2 = clone(body); delete b2.tools; delete b2.toolConfig; res = await orig(url, withBody(opts, b2)); }
      }
      if (!(await hasAnswer(res)) && used !== BACKUP) {
        var b3 = clone(body); delete b3.tools; delete b3.toolConfig;
        res = await orig(swap(url, BACKUP), withBody(opts, b3));
      }
    }
    return attachResearchSources(res, researchContext);
  };
})();