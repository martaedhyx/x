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
    var c = new AbortController(), t = setTimeout(function () { c.abort(); }, 7000);
    opt = Object.assign({ signal: c.signal }, opt || {});
    return orig(url, opt).then(function (r) { clearTimeout(t); if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  function tavily(q) {
    var key = ls('tavily_key'); if (!key) return Promise.resolve('');
    return jget('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({ query: q, max_results: 5, search_depth: 'basic' })
    }).then(function (d) {
      return (d.results || []).map(function (r) {
        return '- ' + r.title + ' (' + r.url + '): ' + String(r.content || '').slice(0, 450);
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
    var web = /\b(sekarang|terbaru|terkini|hari ini|kemarin|minggu ini|bulan ini|tahun ini|update|berita|harga|tarif|kurs|jadwal|skor|rilis|versi|bandingkan|telusuri|cari)\b/.test(s) || /https?:\/\//.test(s);
    var fact = /\b(siapa|apa itu|apa yang|sejarah|jelaskan|pengertian|definisi|kapan|di mana|dimana|berapa|ibu kota|biografi)\b/.test(s);
    var sci = /\b(jurnal|penelitian|riset|studi|paper|ilmiah|skripsi|referensi)\b/.test(s);
    var wx = /\b(cuaca|suhu|prakiraan|hujan)\b/.test(s), eq = /\b(gempa)\b/.test(s);
    var clean = q.replace(/\b(tolong|dong|sih|ya|apa itu|siapa|jelaskan|apa kabar)\b/gi, '').replace(/[?!]/g, '').trim() || q;
    if (web || fact) jobs.push(safe(tavily(q), 'Web & berita (Tavily)'));
    if (fact || sci) { jobs.push(safe(wiki(clean, 'id'), 'Wikipedia ID')); jobs.push(safe(wiki(clean, 'en'), 'Wikipedia EN')); }
    if (sci) jobs.push(safe(openalex(clean), 'Jurnal (OpenAlex)'));
    if (wx) {
      var m = q.match(/(?:cuaca|suhu|prakiraan|hujan)\s+(?:di\s+|kota\s+)?([a-zA-Z ]{3,30}?)(?:\s+(?:hari|besok|lusa|sekarang|saat|minggu|nanti)|[?.!,]|$)/i);
      if (m) jobs.push(safe(weather(m[1].trim()), 'Cuaca'));
    }
    if (eq) jobs.push(safe(quake(), 'Gempa (BMKG)'));
    if (!jobs.length) return '';
    var out = (await Promise.all(jobs)).filter(Boolean).join('\n\n');
    return out.slice(0, 7000);
  }

  async function enrich(body) {
    try {
      var cs = body.contents || [], last = cs[cs.length - 1];
      if (!last || last.role !== 'user') return false;
      var tp = last.parts.filter(function (p) { return p.text && p.text.indexOf('[Isi file:') !== 0; }).pop();
      if (!tp) return false;
      var ctx = await gather(tp.text);
      if (!ctx) return false;
      var note = '\n\nDATA PENCARIAN (diambil dari beberapa sumber). Gunakan sebagai rujukan utama, cantumkan tautan sumber yang dipakai dalam format [judul](url), bandingkan sumber bila berbeda, dan jangan mengarang di luar data ini. Jika data tidak relevan, abaikan.\n' + ctx;
      if (!body.system_instruction) body.system_instruction = { parts: [{ text: '' }] };
      body.system_instruction.parts[0].text += note;
      delete body.tools; delete body.toolConfig;
      return true;
    } catch (e) { return false; }
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
          '\n\nEDHY VISUAL & DOCUMENT ENGINE: Pilih format visual sesuai permintaan pengguna. Jika diminta tabel biasa, tulis tabel Markdown standar dengan baris header dan pemisah |---| agar dirender sebagai tabel sungguhan. Jika diminta grafik, keluarkan satu blok kode berbahasa edhychart yang isinya JSON valid dengan bentuk {"type":"bar|line|pie|doughnut","title":"Judul","labels":["Label 1","Label 2"],"datasets":[{"label":"Nama seri","data":[10,20]}]}. Gunakan hanya data yang tersedia; jangan mengarang angka. Jika diminta membuat file Word atau PDF, keluarkan satu blok edhydocument berisi JSON valid: {"title":"Judul dokumen","blocks":[{"type":"heading","text":"Judul bagian"},{"type":"paragraph","text":"Isi paragraf"},{"type":"bullet","text":"Poin"},{"type":"table","headers":["Kolom 1","Kolom 2"],"rows":[["A","B"]]}]}. Jika diminta file Excel, keluarkan satu blok edhyexcel berisi JSON valid: {"title":"Nama buku kerja","sheets":[{"name":"Data","headers":["Kolom 1","Kolom 2"],"rows":[["A","B"]]}]}. Jangan bungkus JSON dengan teks tambahan di dalam blok tersebut. Di luar blok, berikan pengantar singkat. Pastikan JSON valid, string memakai tanda kutip ganda, dan tidak ada koma tambahan. Untuk permintaan Word/PDF/Excel, hasil harus berupa struktur lengkap yang siap diunduh, bukan sekadar petunjuk.';

      } catch (e) {}
      if (await enrich(body)) opts = withBody(opts, body);
      else opts = withBody(opts, body);
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
    return res;
  };
})();