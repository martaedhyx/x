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

  /* ---------- pembungkus fetch ke Gemini ---------- */
  async function hasAnswer(res) {
    if (!res.ok) return true;
    try {
      var d = await res.clone().json();
      var p = d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts;
      return !!(p && p.some(function (x) { return !x.thought && (x.text || x.inlineData); }));
    } catch (e) { return true; }
  }

  /* Format jawaban web secara kontekstual tanpa mengubah tampilan jawaban biasa. */
  (function installWebAnswerStyle(){
    var style=document.createElement('style');
    style.textContent=
      '.msg.bot.web-answer strong{font-weight:800;color:#fff!important}'+
      '.msg.bot.web-answer p:has(>strong:only-child){font-weight:750;line-height:1.35;margin:1em 0 .45em}'+
      '.msg.bot.web-answer p:has(>strong:only-child):nth-of-type(6n+1){color:#5eead4}'+
      '.msg.bot.web-answer p:has(>strong:only-child):nth-of-type(6n+2){color:#fbbf24}'+
      '.msg.bot.web-answer p:has(>strong:only-child):nth-of-type(6n+3){color:#fb7185}'+
      '.msg.bot.web-answer p:has(>strong:only-child):nth-of-type(6n+4){color:#c4b5fd}'+
      '.msg.bot.web-answer p:has(>strong:only-child):nth-of-type(6n+5){color:#86efac}'+
      '.msg.bot.web-answer p:has(>strong:only-child):nth-of-type(6n){color:#7dd3fc}'+
      '.msg.bot.web-answer p:has(>strong:only-child) strong{color:inherit!important}';
    (document.head||document.documentElement).appendChild(style);
    function mark(root){
      if(!root||!root.querySelectorAll)return;
      root.querySelectorAll('.msg.bot').forEach(function(node){
        if(node.querySelector('.src'))node.classList.add('web-answer');
      });
    }
    var observer=new MutationObserver(function(records){
      records.forEach(function(record){
        record.addedNodes.forEach(function(node){
          if(node.nodeType===1){if(node.matches&&node.matches('.msg.bot'))mark(node.parentNode);else mark(node);}
        });
      });
    });
    observer.observe(document.documentElement,{childList:true,subtree:true});
    mark(document);
  })();

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
          '\n\nEDHY VISUAL & DOCUMENT ENGINE: Pilih format visual sesuai permintaan pengguna. Jika diminta tabel biasa, tulis tabel Markdown standar dengan baris header dan pemisah |---| agar dirender sebagai tabel sungguhan. Jika diminta diagram alur atau diagram hubungan, keluarkan satu blok kode berbahasa mermaid berisi sintaks Mermaid yang valid, misalnya flowchart TD dengan node A[Langkah] dan B[Hasil]. Jika diminta grafik, keluarkan satu blok kode berbahasa edhychart yang isinya JSON valid dengan bentuk {"type":"bar|line|pie|doughnut","title":"Judul","labels":["Label 1","Label 2"],"datasets":[{"label":"Nama seri","data":[10,20]}]}. Gunakan hanya data yang tersedia; jangan mengarang angka. Jika diminta membuat file Word atau PDF, keluarkan satu blok edhydocument berisi JSON valid: {"title":"Judul dokumen","blocks":[{"type":"heading","text":"Judul bagian"},{"type":"paragraph","text":"Isi paragraf"},{"type":"bullet","text":"Poin"},{"type":"table","headers":["Kolom 1","Kolom 2"],"rows":[["A","B"]]}]}. Jika diminta file Excel, keluarkan satu blok edhyexcel berisi JSON valid: {"title":"Nama buku kerja","sheets":[{"name":"Data","headers":["Kolom 1","Kolom 2"],"rows":[["A","B"]]}]}. Jangan bungkus JSON dengan teks tambahan di dalam blok tersebut. Di luar blok, berikan pengantar singkat. Pastikan JSON valid, string memakai tanda kutip ganda, dan tidak ada koma tambahan. Untuk permintaan Word/PDF/Excel, hasil harus berupa struktur lengkap yang siap diunduh, bukan sekadar petunjuk.';

      } catch (e) {}
      /* Instruksi format hasil pencarian web eksternal. */
      var webRequested = body.edhyx_web_search === true;
      if(webRequested && body.system_instruction && body.system_instruction.parts && body.system_instruction.parts[0]){
        body.system_instruction.parts[0].text +=
          '\\n\\nFORMAT HASIL PENELUSURAN WEB: Susun jawaban dengan rapi dan mudah dipindai. Cantumkan sumber artikel yang benar-benar diberikan sistem. Jangan mengarang sumber.';
      }
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

    /* Fallback model generik; pertahankan tools lain yang masih dipakai,
       misalnya Google Maps. Tidak ada retry khusus penelusuran web. */
    if (!(await hasAnswer(res)) && used !== BACKUP) {
      var fallbackBody = clone(body);
      res = await orig(swap(url, BACKUP), withBody(opts, fallbackBody));
    }
    return res;
  };
})();