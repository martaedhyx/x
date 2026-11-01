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

        if (m && body.system_instruction && body.system_instruction.parts && body.system_instruction.parts[0]){

          var r = await origFetch(API, {

            method: 'POST',

            headers: { 'Content-Type': 'application/json' },

            body: JSON.stringify({ action: 'read', url: m[0] }),

            signal: init.signal

          });

          var d = await r.json().catch(function(){ return {}; });

          var pg = d.sources && d.sources[0];

          if (r.ok && pg && pg.content){

            body.system_instruction.parts[0].text +=

              '\n\nISI HALAMAN YANG DIMINTA (sumber: ' + pg.url + '):\n' +

              pg.title + '\n' + pg.content +

              '\n\nRingkas hanya berdasarkan isi halaman di atas. Jangan menambah fakta dari luar.';

            delete body.tools;

            delete body.toolConfig;

            init = Object.assign({}, init, { body: JSON.stringify(body) });

          }

        }

      }

    } catch(e){

      if (e && e.name === 'AbortError') throw e;

    }

    return origFetch.call(this, input, init);

  };

})();