/* EdhyX Universal File Reader
 * Isolated attachment parser. It does not alter chat, AI routing, or visual UI.
 * Parsing happens in the browser; document contents are not sent to a converter service.
 */
(function () {
  'use strict';

  var MAX_FILE_BYTES = 15 * 1024 * 1024;
  var MAX_TEXT_CHARS = 180000;
  var MAX_ZIP_FILES = 30;
  var MAX_ZIP_TOTAL_BYTES = 20 * 1024 * 1024;
  var MAX_ZIP_ENTRY_BYTES = 8 * 1024 * 1024;
  var scriptLoads = Object.create(null);
  var officeParserPromise = null;
  var zipPromise = null;
  var docPromise = null;
  var pptPromise = null;

  function extension(name) {
    var p = String(name || '').split('.');
    return (p.length > 1 ? p.pop() : '').toLowerCase();
  }
  function loadScript(url, test) {
    if (test && test()) return Promise.resolve();
    if (scriptLoads[url]) return scriptLoads[url];
    scriptLoads[url] = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.onload = function () {
        if (!test || test()) resolve();
        else reject(new Error('Pustaka pembaca file tidak tersedia setelah dimuat.'));
      };
      s.onerror = function () { reject(new Error('Pustaka pembaca file gagal dimuat. Periksa koneksi internet.')); };
      document.head.appendChild(s);
    });
    return scriptLoads[url];
  }
  function loadOfficeParser() {
    if (!officeParserPromise) {
      officeParserPromise = loadScript(
        'https://cdn.jsdelivr.net/npm/officeparser@8.2.0/dist/officeparser.browser.iife.js',
        function () { return !!(window.officeParser && window.officeParser.parseOffice); }
      );
    }
    return officeParserPromise;
  }
  function loadZip() {
    if (!zipPromise) {
      zipPromise = loadScript(
        'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
        function () { return !!window.JSZip; }
      );
    }
    return zipPromise;
  }
  function loadDoc() {
    if (!docPromise) {
      docPromise = import('https://esm.sh/@mdgate/doc@0.6.25');
    }
    return docPromise;
  }
  function loadPpt() {
    if (!pptPromise) {
      pptPromise = import('https://esm.sh/@mdgate/ppt@0.6.25');
    }
    return pptPromise;
  }
  function capText(value) {
    var s = String(value == null ? '' : value);
    return s.length > MAX_TEXT_CHARS ? s.slice(0, MAX_TEXT_CHARS) + '\n[Isi file dipotong karena terlalu panjang.]' : s;
  }
  function decode(bytes) {
    try { return new TextDecoder('utf-8').decode(bytes); }
    catch (e) { return ''; }
  }
  async function parseOffice(bytes) {
    await loadOfficeParser();
    var ast = await window.officeParser.parseOffice(bytes);
    var result = await ast.to('text');
    return capText(result && result.value !== undefined ? result.value : result);
  }
  async function parseBuffer(name, bytes, depth) {
    var ext = extension(name);
    if (ext === 'doc') {
      var docReader = await loadDoc();
      if (!docReader || typeof docReader.toMarkdown !== 'function') {
        throw new Error('Pustaka pembaca DOC lama tidak tersedia.');
      }
      var docText = await docReader.toMarkdown(bytes);
      if (!docText || !String(docText).trim()) {
        throw new Error('DOC tidak berisi teks yang dapat dibaca atau file dilindungi kata sandi.');
      }
      return capText(docText);
    }
    if (ext === 'ppt') {
      var ppt = await loadPpt();
      if (!ppt || typeof ppt.toMarkdown !== 'function') throw new Error('Pembaca PowerPoint lama tidak tersedia.');
      return capText(await ppt.toMarkdown(bytes));
    }
    if (ext === 'pptx' || ext === 'odp' || ext === 'rtf' || ext === 'pdf') {
      return await parseOffice(bytes);
    }
    if (/^(xlsx|xls|ods)$/.test(ext) && window.XLSX) {
      var wb = window.XLSX.read(bytes, { type: 'array' });
      return capText(wb.SheetNames.map(function (n) {
        return '## Sheet: ' + n + '\n' + window.XLSX.utils.sheet_to_csv(wb.Sheets[n]);
      }).join('\n\n'));
    }
    if (ext === 'docx' && window.mammoth) {
      var docx = await window.mammoth.extractRawText({ arrayBuffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
      return capText(docx.value);
    }
    if (/^(txt|rtf|csv|tsv|md|html|htm|css|js|json|py|php|xml|yml|yaml|sql|log)$/.test(ext)) {
      return capText(decode(bytes));
    }
    if (/^(jpg|jpeg|png|webp)$/.test(ext)) {
      return '[Gambar di dalam arsip: ' + name + ' — gambar tercantum dalam ZIP, tetapi belum dikirim sebagai gambar terpisah ke model.]';
    }
    if (ext === 'zip' && depth < 1) return await parseZip(bytes, depth + 1);
    return null;
  }
  async function parseZip(bytes, depth) {
    await loadZip();
    var zip = await window.JSZip.loadAsync(bytes);
    var entries = [];
    Object.keys(zip.files).forEach(function (path) {
      var entry = zip.files[path];
      if (entry.dir || path.charAt(0) === '/' || path.split('/').indexOf('..') >= 0) return;
      entries.push(entry);
    });
    if (entries.length > MAX_ZIP_FILES) {
      entries = entries.slice(0, MAX_ZIP_FILES);
    }
    var total = 0, sections = [];
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      var size = entry._data && Number(entry._data.uncompressedSize);
      if (!Number.isFinite(size) || size < 0 || size > MAX_ZIP_ENTRY_BYTES || total + size > MAX_ZIP_TOTAL_BYTES) {
        sections.push('## ' + entry.name + '\n[Diabaikan: ukuran hasil ekstraksi tidak diketahui atau melewati batas keamanan.]');
        continue;
      }
      var ext = extension(entry.name);
      if (!/^(doc|docx|rtf|ppt|pptx|odp|xls|xlsx|ods|csv|tsv|txt|md|html|htm|css|js|json|py|php|xml|yml|yaml|sql|log|pdf|jpg|jpeg|png|webp|zip)$/.test(ext)) continue;
      var data = await entry.async('uint8array');
      total += data.byteLength;
      if (total > MAX_ZIP_TOTAL_BYTES) {
        sections.push('[Ekstraksi dihentikan: batas total isi ZIP tercapai.]');
        break;
      }
      try {
        var extracted = await parseBuffer(entry.name, data, depth);
        if (extracted) sections.push('## File: ' + entry.name + '\n' + extracted);
      } catch (e) {
        sections.push('## File: ' + entry.name + '\n[Gagal dibaca: ' + (e && e.message ? e.message : 'format tidak valid') + ']');
      }
    }
    if (!sections.length) throw new Error('ZIP tidak berisi file yang didukung atau tidak ada teks yang dapat dibaca.');
    var note = entries.length >= MAX_ZIP_FILES ? '\n\n[Catatan: hanya maksimal ' + MAX_ZIP_FILES + ' file pertama yang diperiksa.]' : '';
    return capText(sections.join('\n\n') + note);
  }

  async function read(file) {
    var ext = extension(file && file.name);
    var supported = /^(doc|rtf|ppt|pptx|odp|zip)$/.test(ext);
    if (!supported) return null;
    if (!file || file.size > MAX_FILE_BYTES) throw new Error('Ukuran file melebihi batas lampiran 15 MB.');
    var buffer = await file.arrayBuffer();
    var bytes = new Uint8Array(buffer);
    var text = ext === 'zip' ? await parseZip(bytes, 0) : await parseBuffer(file.name, bytes, 0);
    if (!text || !String(text).trim()) throw new Error('Tidak ada teks yang dapat dibaca dari file ini.');
    return { handled: true, text: capText(text) };
  }

  window.EdhyFileReader = { read: read };
})();