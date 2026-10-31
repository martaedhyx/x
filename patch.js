/* EdhyX patch v2: model, coba ulang, cadangan, fallback web, tangani jawaban kosong */
(function () {
  var orig = window.fetch.bind(window);
  var API = 'generativelanguage.googleapis.com';
  var BACKUP = 'gemini-3.1-flash-lite';

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function swap(u, m) { return u.replace(/models\/[^:\/?]+/, 'models/' + encodeURIComponent(m)); }
  function withBody(opts, b) { return Object.assign({}, opts, { body: JSON.stringify(b) }); }

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

    var model = BACKUP;
    try { model = localStorage.getItem('gem_model') || BACKUP; } catch (e) {}
    var m = url.match(/models\/([^:\/?]+)/);
    var used = m ? decodeURIComponent(m[1]) : '';
    var isImg = /image/.test(used);
    var body = null;
    try { body = JSON.parse(opts.body); } catch (e) {}

    // 1. Jangan pakai model 2.5 lama
    if (/^gemini-2\.5/.test(used)) { url = swap(url, model); used = model; }

    var res = await orig(url, opts);

    // 2. Coba ulang 2x kalau server sibuk
    for (var i = 0; i < 2 && (res.status === 500 || res.status === 503); i++) {
      await sleep(1500 * (i + 1));
      res = await orig(url, opts);
    }

    // 3. Model cadangan kalau masih sibuk atau tidak ditemukan
    if ((res.status === 503 || res.status === 404) && !isImg && used !== BACKUP) {
      url = swap(url, BACKUP); used = BACKUP;
      res = await orig(url, opts);
    }

    if (isImg || !body) return res;

    // 4. Pencarian web ditolak: jawab tanpa web
    if (!res.ok && [400, 403, 429].indexOf(res.status) >= 0 && body.tools) {
      var b0 = JSON.parse(JSON.stringify(body));
      delete b0.tools; delete b0.toolConfig;
      body = b0;
      res = await orig(url, withBody(opts, body));
    }

    // 5. Jawaban kosong: coba hanya google_search, lalu tanpa tools, lalu model cadangan
    if (!(await hasAnswer(res))) {
      if (body.tools) {
        var b1 = JSON.parse(JSON.stringify(body));
        b1.tools = [{ google_search: {} }];
        delete b1.toolConfig;
        res = await orig(url, withBody(opts, b1));
        if (!(await hasAnswer(res))) {
          var b2 = JSON.parse(JSON.stringify(body));
          delete b2.tools; delete b2.toolConfig;
          res = await orig(url, withBody(opts, b2));
        }
      }
      if (!(await hasAnswer(res)) && used !== BACKUP) {
        var b3 = JSON.parse(JSON.stringify(body));
        delete b3.tools; delete b3.toolConfig;
        res = await orig(swap(url, BACKUP), withBody(opts, b3));
      }
    }
    return res;
  };
})();