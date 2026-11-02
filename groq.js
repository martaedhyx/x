(function(){
  var GEM = 'generativelanguage.googleapis.com';
  var $ = function(id){ return document.getElementById(id); };
  function ld(k, d){ try { var v = localStorage.getItem(k); return v === null ? d : v; } catch(e){ return d; } }
  function sv(k, v){ try { localStorage.setItem(k, v); } catch(e){} }
  /* patch.js dimuat lebih dahulu; simpan wrapper-nya agar konteks waktu dan pencarian Gemini tetap berjalan. */
  var patchedFetch = window.fetch.bind(window);
  var WEB = /\\b(terbaru|terkini|hari ini|berita|harga|kurs|cuaca|skor|jadwal|cari di web|search|latest|news|today)\\b/i;
  var qkey = function(){ return ld('groq_key', ''); };
  var qmodel = function(){ return ld('groq_model', 'openai/gpt-oss-120b'); };
  var mode = function(){ return ld('groq_mode', 'auto'); };

  function textOnly(b){
    if (b.generationConfig && b.generationConfig.responseModalities) return false;
    if (b.tools && b.tools.length) return false;
    return (b.contents || []).every(function(m){
      return (m.parts || []).every(function(p){ return !p.inlineData; });
    });
  }
  function toGroq(b){
    var sys = b.system_instruction && b.system_instruction.parts
      ? b.system_instruction.parts.map(function(p){ return p.text || ''; }).join('') : '';
    /* Tambahkan waktu perangkat agar Groq juga memahami pertanyaan tanggal dan jam. */
    try {
      var now = new Date();
      var zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      var stamp = new Intl.DateTimeFormat('id-ID', {
        weekday:'long', day:'numeric', month:'long', year:'numeric',
        hour:'2-digit', minute:'2-digit', second:'2-digit',
        hourCycle:'h23', timeZone:zone, timeZoneName:'long'
      }).format(now);
      sys += '\\n\\nWAKTU LOKAL PERANGKAT PENGGUNA: ' + stamp + '. Zona waktu: ' + zone +
        '. Gunakan untuk pertanyaan jam, tanggal, hari, besok, dan kemarin. Ini waktu perangkat, bukan verifikasi jam atomik.';
    } catch(e){}
    var msgs = [];
    if (sys) msgs.push({ role:'system', content:sys });
    (b.contents || []).forEach(function(m){
      var content = (m.parts || []).map(function(p){ return p.text || ''; }).join('');
      if (content) msgs.push({ role:m.role === 'user' ? 'user' : 'assistant', content:content });
    });
    return { model:qmodel(), messages:msgs };
  }
  function fake(t){
    return new Response(JSON.stringify({ candidates:[{ content:{ parts:[{ text:t }] } }] }),
      { status:200, headers:{ 'Content-Type':'application/json' } });
  }
  async function groq(b, signal){
    var r = await window.fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer ' + qkey() },
      body:JSON.stringify(toGroq(b)),
      signal:signal
    });
    var j = await r.json().catch(function(){ return {}; });
    if (!r.ok) throw new Error((j.error && j.error.message) || ('HTTP ' + r.status));
    var answer = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    if (!answer) throw new Error('Groq tidak mengirim jawaban.');
    return answer;
  }
  function note(name){
    setTimeout(function(){ var l = $('modelLabel'); if (l) l.textContent = 'via ' + name; }, 150);
  }
  async function hasGeminiAnswer(r){
    if (!r || !r.ok) return false;
    try {
      var d = await r.clone().json();
      var p = d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts;
      return !!(p && p.some(function(x){ return !x.thought && !!x.text; }));
    } catch(e){ return false; }
  }
  async function hasGeminiSources(r){
    if (!r || !r.ok) return false;
    try {
      var d = await r.clone().json();
      var c = d.candidates && d.candidates[0];
      var chunks = c && c.groundingMetadata && c.groundingMetadata.groundingChunks || [];
      if (chunks.some(function(x){ var w=x.web || x.maps; return !!(w && /^https?:\/\//i.test(w.uri || '')); })) return true;
      var parts = c && c.content && c.content.parts || [];
      return parts.some(function(x){ return !x.thought && /\[[^\]]+\]\(https?:\/\/[^)]+\)/i.test(x.text || ''); });
    } catch(e){ return false; }
  }

  var RESEARCH_API = 'https://xbot-gamma-hazel.vercel.app/api/research';

  function isWebRequest(b){
    return !!(b.tools && b.tools.some(function(t){ return !!t.google_search; }));
  }
  function latestUserQuery(b){
    var a = b.contents || [];
    for (var i=a.length-1;i>=0;i--){
      if (a[i].role === 'user'){
        var q = (a[i].parts || []).map(function(p){ return p.text || ''; }).join(' ').trim();
        if (q) return q;
      }
    }
    return '';
  }
  async function groqWebFallback(b, signal){
    var query = latestUserQuery(b);
    if (!query) throw new Error('Pertanyaan pencarian web tidak ditemukan.');
    var response = await window.fetch(RESEARCH_API, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({ action:'search', query:query }),
      signal:signal
    });
    var data = await response.json().catch(function(){ return {}; });
    if (!response.ok) throw new Error(data.error || ('Mesin pencarian web gagal (HTTP ' + response.status + ').'));
    var sources = (data.sources || []).filter(function(x){ return x && x.url && x.content; }).slice(0,8);
    if (!sources.length) throw new Error('Mesin pencarian web tidak mengembalikan sumber yang dapat dibaca.');
    var context = sources.map(function(x,i){
      return '[' + (i+1) + '] ' + (x.title || 'Sumber') + '\nURL: ' + x.url + '\nIsi: ' + String(x.content).slice(0,1800);
    }).join('\n\n');
    var fallbackBody = JSON.parse(JSON.stringify(b));
    delete fallbackBody.tools;
    delete fallbackBody.toolConfig;
    if (!fallbackBody.system_instruction) fallbackBody.system_instruction = { parts:[{ text:'' }] };
    if (!fallbackBody.system_instruction.parts || !fallbackBody.system_instruction.parts.length) fallbackBody.system_instruction.parts = [{ text:'' }];
    fallbackBody.system_instruction.parts[0].text +=
      '\n\nMODE CADANGAN PENELUSURAN WEB EDHY: Gemini gagal menjawab permintaan web. Gunakan hanya hasil penelusuran berikut sebagai dasar fakta. Jawab dalam bahasa pengguna, jelaskan bila sumber tidak cukup, dan sertakan tautan Markdown ke sumber yang relevan. Jangan mengaku memakai Google Search/Gemini.\n\nHASIL PENELUSURAN WEB:\n' + context;
    return await groq(fallbackBody, signal);
  }

  window.fetch = async function(u, o){
    if (String(u).indexOf(GEM) < 0 || !o || !o.body) return patchedFetch(u, o);
    var b;
    try { b = JSON.parse(o.body); } catch(e){ return patchedFetch(u, o); }
    var canQ = !!qkey() && mode() !== 'gemini' && textOnly(b);
    var canWebQ = !!qkey() && mode() !== 'gemini' && isWebRequest(b);
    var preferGroq = mode() === 'groq' && canQ;
    var tried = false;

    /* Mode Groq: chat teks biasa boleh memakai Groq lebih dahulu. */
    if (preferGroq){
      try { var first = await groq(b, o.signal); note('Groq'); return fake(first); }
      catch(e){ if (o.signal && o.signal.aborted) throw e; tried = true; }
    }

    var r, err;
    try {
      r = await patchedFetch(u, o);
      if (await hasGeminiAnswer(r)){
        /* Jawaban Gemini tanpa sumber bukan hasil web yang terverifikasi.
           Jika cadangan tersedia, cari sumber lewat Vercel lalu susun ulang dengan Groq. */
        if (canWebQ && !(o.signal && o.signal.aborted) && !(await hasGeminiSources(r))){
          try {
            var groundedAnswer = await groqWebFallback(b, o.signal);
            note('Groq + Web');
            return fake(groundedAnswer);
          } catch(fallbackError){
            if (o.signal && o.signal.aborted) throw fallbackError;
            note('Gemini');
            return r;
          }
        }
        note('Gemini');
        return r;
      }
    } catch(e){ if (o.signal && o.signal.aborted) throw e; err = e; }

    /* Cadangan WEB: cari sumber lewat backend pencarian, lalu minta Groq menyusun jawaban bersumber. */
    if (canWebQ && !(o.signal && o.signal.aborted)){
      try {
        var webAnswer = await groqWebFallback(b, o.signal);
        note('Groq + Web');
        return fake(webAnswer);
      } catch(e){
        if (o.signal && o.signal.aborted) throw e;
        err = e;
      }
    }

    /* Cadangan Groq untuk chat teks tanpa gambar atau tools khusus Gemini. */
    if (canQ && !tried && !(o.signal && o.signal.aborted)){
      try { var backup = await groq(b, o.signal); note('Groq'); return fake(backup); }
      catch(e){ if (o.signal && o.signal.aborted) throw e; err = e; }
    }
    if (r) return r;
    throw err || new Error('Gemini dan layanan cadangan tidak dapat dihubungi.');
  };

  var dlg = $('dlg'), row = dlg && dlg.querySelector('.row');
  if (!dlg || !row) return;
  var st = document.createElement('style');
  st.textContent = 'dialog select{width:100%;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:9px 11px;font:inherit}';
  document.head.appendChild(st);
  var box = document.createElement('div');
  box.innerHTML =
    '<label for="gqk">API key Groq<span>Dibuat di console.groq.com. Disimpan hanya di browser ini.</span></label>' +
    '<input id="gqk" type="password" autocomplete="off" placeholder="gsk_...">' +
    '<label for="gqm">Model Groq gratis<span>Pilih model gratis Groq untuk chat teks. Batas pemakaian mengikuti kuota akun Groq.</span></label>' +
    '<select id="gqm"><option value="openai/gpt-oss-120b">GPT-OSS 120B — paling kuat</option><option value="openai/gpt-oss-20b">GPT-OSS 20B — lebih ringan &amp; cepat</option><option value="qwen/qwen3.8-27b">Qwen 3.8 27B — penalaran &amp; umum</option></select>' +
    '<label for="gmode">Mode<span>Otomatis: Gemini utama, Groq sebagai cadangan untuk chat teks.</span></label>' +
    '<select id="gmode"><option value="auto">Otomatis</option><option value="gemini">Hanya Gemini</option><option value="groq">Utamakan Groq</option></select>';
  dlg.insertBefore(box, row);
  function fill(){
    $('gqk').value = qkey();
    var savedModel = qmodel();
    $('gqm').value = ['openai/gpt-oss-120b','openai/gpt-oss-20b','qwen/qwen3.8-27b'].indexOf(savedModel) >= 0 ? savedModel : 'openai/gpt-oss-120b';
    $('gmode').value = mode();
  }
  new MutationObserver(function(){ if (dlg.open) fill(); })
    .observe(dlg, { attributes:true, attributeFilter:['open'] });
  $('saveBtn').addEventListener('click', function(){
    sv('groq_key', $('gqk').value.trim());
    sv('groq_model', $('gqm').value.trim() || 'llama-3.3-70b-versatile');
    sv('groq_mode', $('gmode').value);
  });
})();