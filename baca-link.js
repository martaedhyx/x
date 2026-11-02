(function(){

  var API = 'https://xbot-gamma-hazel.vercel.app/api/research';

  var URL_RE = /https?:\/\/[^\s<>"')]+/i;

  var origFetch = window.fetch;

  window.fetch = async function(input, init){

    try {

      var url = typeof input === 'string' ? input : (input && input.url) || '';

      if (/generativelanguage\.googleapis\.com/.test(url) && init && typeof init.body === 'string'){

        var body = JSON.parse(init.body);

        var msgs = body.contents || [];

        var last = msgs[msgs.length - 1];

        var userTxt = (last && last.role === 'user')

          ? (last.parts || []).map(function(p){ return p.text || ''; }).join(' ')

          : '';

        var m = userTxt.match(URL_RE);

        if (m){

          /* Pastikan system_instruction tersedia; patch.js baru berjalan setelah wrapper ini. */
          if (!body.system_instruction) body.system_instruction = { parts: [{ text: '' }] };
          if (!body.system_instruction.parts || !body.system_instruction.parts.length) {
            body.system_instruction.parts = [{ text: '' }];
          }

          var r = await origFetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'read', url: m[0] }),
            signal: init.signal
          });

          var d = await r.json().catch(function(){ return {}; });
          if (!r.ok) throw new Error(d.error || ('Edhy gagal membaca halaman (HTTP ' + r.status + ').'));

          var pg = d.sources && d.sources[0];
          if (!pg || !pg.content || !String(pg.content).trim()) {
            throw new Error('Firecrawl tidak mengembalikan isi halaman yang dapat dibaca.');
          }

          body.system_instruction.parts[0].text +=
            '\n\nISI HALAMAN YANG DIMINTA (sumber: ' + pg.url + '):\n' +
            pg.title + '\n' + pg.content +
            '\n\nUtamakan isi halaman di atas sebagai sumber utama. Jangan mengarang isi yang tidak tercantum. Jika pertanyaan juga meminta informasi terbaru atau perbandingan, gunakan alat pencarian yang sudah tersedia bila memungkinkan dan bedakan informasi dari halaman dengan informasi tambahan.';

          /* Pertahankan tools Gemini yang sudah diminta aplikasi; pembacaan URL
             tidak boleh mematikan Google Search atau tool lain. */
          init = Object.assign({}, init, { body: JSON.stringify(body) });
        }

      }

    } catch(e){
      /* Jangan lanjutkan ke Gemini seolah-olah URL sudah dibaca bila Firecrawl gagal. */
      if (e) throw e;
    }

    return origFetch.call(this, input, init);

  };

})();