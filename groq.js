(function(){
  var GEM = 'generativelanguage.googleapis.com';
  var $ = function(id){ return document.getElementById(id); };
  function ld(k, d){ try { var v = localStorage.getItem(k); return v === null ? d : v; } catch(e){ return d; } }
  function sv(k, v){ try { localStorage.setItem(k, v); } catch(e){} }
  /* patch.js dimuat lebih dahulu; simpan wrapper-nya agar konteks waktu dan pencarian Gemini tetap berjalan. */
  var patchedFetch = window.fetch.bind(window);
  var WEB = /\\b(terbaru|terkini|hari ini|berita|harga|kurs|cuaca|skor|jadwal|cari di web|search|latest|news|today)\\b/i;
  var qkey = function(){ return ld('groq_key', ''); };
  var qmodel = function(){ return ld('groq_model', 'llama-3.3-70b-versatile'); };
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
  async function groq(b){
    var r = await window.fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer ' + qkey() },
      body:JSON.stringify(toGroq(b))
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

  window.fetch = async function(u, o){
    if (String(u).indexOf(GEM) < 0 || !o || !o.body) return patchedFetch(u, o);
    var b;
    try { b = JSON.parse(o.body); } catch(e){ return patchedFetch(u, o); }
    var canQ = !!qkey() && mode() !== 'gemini' && textOnly(b);
    var preferGroq = mode() === 'groq' && canQ;
    var tried = false;

    /* Mode Groq: coba Groq lebih dahulu. Mode Otomatis: Gemini tetap utama. */
    if (preferGroq){
      try { var first = await groq(b); note('Groq'); return fake(first); }
      catch(e){ tried = true; }
    }

    var r, err;
    try {
      r = await patchedFetch(u, o);
      if (await hasGeminiAnswer(r)){ note('Gemini'); return r; }
    } catch(e){ err = e; }

    /* Cadangan Groq hanya untuk chat teks tanpa gambar atau tools khusus Gemini. */
    if (canQ && !tried){
      try { var backup = await groq(b); note('Groq'); return fake(backup); }
      catch(e){}
    }
    if (r) return r;
    throw err || new Error('Gemini dan Groq tidak dapat dihubungi.');
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
    '<label for="gqm">Model Groq<span>Dipakai untuk chat teks biasa.</span></label>' +
    '<input id="gqm" placeholder="llama-3.3-70b-versatile">' +
    '<label for="gmode">Mode<span>Otomatis: Gemini utama, Groq sebagai cadangan untuk chat teks.</span></label>' +
    '<select id="gmode"><option value="auto">Otomatis</option><option value="gemini">Hanya Gemini</option><option value="groq">Utamakan Groq</option></select>';
  dlg.insertBefore(box, row);
  function fill(){
    $('gqk').value = qkey();
    $('gqm').value = qmodel();
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