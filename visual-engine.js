/* Edhy Visual & Document Engine v1 */
(function () {
  'use strict';
  if (window.__edhyVisualEngineLoaded) return;
  window.__edhyVisualEngineLoaded = true;
  var css = [
    '.edhy-table-wrap{width:100%;overflow-x:auto;margin:12px 0 16px;border:1px solid #343434;border-radius:12px;background:#0b0b0b}',
    '.edhy-table{border-collapse:collapse;width:100%;min-width:420px;font:14px/1.5 system-ui,sans-serif!important}',
    '.edhy-table th,.edhy-table td{padding:9px 11px;border-bottom:1px solid #303030;text-align:left;vertical-align:top;white-space:normal}',
    '.edhy-table th{background:#202020;color:#fff;font-weight:700}.edhy-table tr:last-child td{border-bottom:0}',
    '.edhy-tools{display:flex;flex-wrap:wrap;gap:7px;padding:8px 10px;border-top:1px solid #303030}',
    '.edhy-tool{display:inline-flex;align-items:center;gap:6px;border:1px solid #444;border-radius:8px;padding:6px 9px;font:600 12px system-ui,sans-serif!important;color:#fff;background:#171717;cursor:pointer}',
    '.edhy-file-card{display:flex;align-items:center;gap:12px;margin:12px 0;padding:13px;border:1px solid #343434;border-radius:13px;background:#101010}',
    '.edhy-file-icon{width:42px;height:42px;flex:0 0 42px;display:grid;place-items:center;border-radius:9px;color:#fff;font-weight:800;font-size:17px!important}',
    '.edhy-file-info{min-width:0;flex:1}.edhy-file-info strong{display:block;font-size:14px!important}.edhy-file-info small{display:block;color:#aaa;font-size:12px!important;margin-top:3px}',
    '.edhy-file-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}',
    '.edhy-chart{width:100%;max-width:720px;min-height:260px;margin:12px 0;padding:12px;border:1px solid #343434;border-radius:12px;background:#101010}',
    '.edhy-chart canvas{width:100%!important;max-height:360px}',
    '@media(max-width:520px){.edhy-file-card{align-items:flex-start}.edhy-file-icon{width:36px;height:36px;flex-basis:36px}.edhy-tool{font-size:11px!important;padding:6px 7px}}'
  ].join('');
  var style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
  function safeName(s) { return String(s || 'edhy-document').replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 70) || 'edhy-document'; }
  function parseJSON(s) { try { return JSON.parse(String(s || '')); } catch (e) { return null; } }
  function cellText(v) { return v == null ? '' : String(v); }
  function makeButton(label, color, fn) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'edhy-tool'; b.textContent = label;
    b.style.borderColor = color; b.addEventListener('click', fn); return b;
  }
  function downloadBlob(blob, name) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }
  function tableNode(headers, rows) {
    var wrap = document.createElement('div'); wrap.className = 'edhy-table-wrap';
    var table = document.createElement('table'); table.className = 'edhy-table';
    if (headers && headers.length) {
      var thead = document.createElement('thead'), trh = document.createElement('tr');
      headers.forEach(function (v) { var th = document.createElement('th'); th.textContent = cellText(v); trh.appendChild(th); });
      thead.appendChild(trh); table.appendChild(thead);
    }
    var tbody = document.createElement('tbody');
    (rows || []).forEach(function (row) {
      var tr = document.createElement('tr');
      (row || []).forEach(function (v) { var td = document.createElement('td'); td.textContent = cellText(v); tr.appendChild(td); });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody); wrap.appendChild(table); return wrap;
  }
  function tableToXlsx(headers, rows, title) {
    if (!window.XLSX) { alert('Fitur Excel belum termuat. Muat ulang halaman dan coba lagi.'); return; }
    var aoa = [];
    if (headers && headers.length) aoa.push(headers);
    (rows || []).forEach(function (r) { aoa.push(r); });
    var ws = XLSX.utils.aoa_to_sheet(aoa), wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data'); XLSX.writeFile(wb, safeName(title) + '.xlsx');
  }
  function renderMarkdownTables(root) {
    var paras = Array.prototype.slice.call(root.querySelectorAll('p')), i = 0;
    while (i < paras.length) {
      var tx = (paras[i].textContent || '').trim();
      if (!/^\|.*\|$/.test(tx)) { i++; continue; }
      var group = [], j = i;
      while (j < paras.length && /^\|.*\|$/.test((paras[j].textContent || '').trim())) { group.push(paras[j]); j++; }
      if (group.length >= 2) {
        function splitRow(el) { return (el.textContent || '').trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (x) { return x.trim(); }); }
        var raw = group.map(splitRow);
        var isSep = function (r) { return r.length && r.every(function (c) { return /^:?-{3,}:?$/.test(c.replace(/\s/g, '')); }); };
        if (raw.length > 1 && isSep(raw[1])) {
          var headers = raw[0], rows = raw.slice(2).filter(function (r) { return !isSep(r); });
          var node = tableNode(headers, rows), tools = document.createElement('div'); tools.className = 'edhy-tools';
          tools.appendChild(makeButton('Unduh Excel', '#217346', function () { tableToXlsx(headers, rows, 'tabel-edhy'); }));
          node.appendChild(tools); group[0].parentNode.insertBefore(node, group[0]);
          group.forEach(function (x) { if (x.parentNode) x.parentNode.removeChild(x); });
        }
      }
      i = Math.max(i + 1, j);
    }
  }
  function makeCard(kind, title, description, actions) {
    var colors = { word: '#185ABD', excel: '#217346', pdf: '#E5252A' }, labels = { word: 'W', excel: 'X', pdf: 'PDF' };
    var card = document.createElement('div'); card.className = 'edhy-file-card';
    var icon = document.createElement('div'); icon.className = 'edhy-file-icon'; icon.style.background = colors[kind] || '#555'; icon.textContent = labels[kind] || 'ED';
    var info = document.createElement('div'); info.className = 'edhy-file-info';
    var strong = document.createElement('strong'); strong.textContent = title || 'Dokumen Edhy';
    var small = document.createElement('small'); small.textContent = description || 'File dibuat dari jawaban Edhy';
    var actionBox = document.createElement('div'); actionBox.className = 'edhy-file-actions';
    actions.forEach(function (a) { actionBox.appendChild(makeButton(a.label, colors[a.kind] || '#555', a.run)); });
    info.appendChild(strong); info.appendChild(small); info.appendChild(actionBox);
    card.appendChild(icon); card.appendChild(info); return card;
  }
  function docParagraphs(data) {
    var D = window.docx;
    if (!D || !D.Document || !D.Packer) throw new Error('Pustaka Word belum termuat.');
    var children = [];
    children.push(new D.Paragraph({ text: String(data.title || 'Dokumen Edhy'), heading: D.HeadingLevel ? D.HeadingLevel.TITLE : 'Title', spacing: { after: 260 } }));
    (data.blocks || []).forEach(function (b) {
      if (b.type === 'table') {
        var all = []; if (b.headers && b.headers.length) all.push(b.headers);
        (b.rows || []).forEach(function (r) { all.push(r); });
        var trs = all.map(function (r, ri) {
          return new D.TableRow({ children: (r || []).map(function (v) {
            return new D.TableCell({ children: [new D.Paragraph({ children: [new D.TextRun({ text: cellText(v), bold: ri === 0 })] })] });
          }) });
        });
        if (trs.length) children.push(new D.Table({ rows: trs }));
        children.push(new D.Paragraph({ text: '' }));
      } else {
        var text = String(b.text || '');
        if (b.type === 'heading') children.push(new D.Paragraph({ text: text, heading: D.HeadingLevel ? D.HeadingLevel.HEADING_1 : 'Heading1', spacing: { before: 180, after: 100 } }));
        else if (b.type === 'bullet') children.push(new D.Paragraph({ text: text, bullet: { indent: 360 } }));
        else children.push(new D.Paragraph({ text: text, spacing: { after: 100 } }));
      }
    });
    return children;
  }
  function exportWord(data) {
    try {
      var D = window.docx, doc = new D.Document({ sections: [{ children: docParagraphs(data) }] });
      D.Packer.toBlob(doc).then(function (blob) { downloadBlob(blob, safeName(data.title) + '.docx'); })
        .catch(function () { alert('Dokumen Word gagal dibuat. Coba lagi.'); });
    } catch (e) { alert(e.message || 'Pustaka Word belum siap.'); }
  }
  function exportPDF(data) {
    try {
      var J = window.jspdf && window.jspdf.jsPDF;
      if (!J) throw new Error('Pustaka PDF belum termuat.');
      var pdf = new J({ unit: 'mm', format: 'a4' }), y = 18, margin = 15, maxW = 180;
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(17);
      var titleLines = pdf.splitTextToSize(String(data.title || 'Dokumen Edhy'), maxW);
      pdf.text(titleLines, margin, y); y += titleLines.length * 8 + 5;
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10);
      function put(text) {
        var lines = pdf.splitTextToSize(String(text || ''), maxW);
        lines.forEach(function (line) { if (y > 280) { pdf.addPage(); y = 18; } pdf.text(line, margin, y); y += 5; }); y += 2;
      }
      (data.blocks || []).forEach(function (b) {
        if (b.type === 'table') { put((b.headers || []).join(' | ')); (b.rows || []).forEach(function (r) { put((r || []).join(' | ')); }); }
        else put(b.text || '');
      });
      pdf.save(safeName(data.title) + '.pdf');
    } catch (e) { alert(e.message || 'Dokumen PDF gagal dibuat.'); }
  }
  function renderStructured(root) {
    Array.prototype.slice.call(root.querySelectorAll('pre')).forEach(function (pre) {
      if (pre.dataset.edhyDone) return;
      var lang = pre.querySelector('.code-lang'), code = pre.querySelector('code');
      var type = lang ? (lang.textContent || '').trim().toLowerCase() : '';
      if (!code) return;
      if (type === 'mermaid' || type === 'edhydiagram') {
        pre.dataset.edhyDone = '1';
        var diagram = document.createElement('div');
        diagram.style.cssText = 'width:100%;overflow-x:auto;margin:12px 0;padding:12px;border:1px solid #343434;border-radius:12px;background:#101010';
        var graph = document.createElement('div');
        graph.className = 'mermaid';
        graph.textContent = code.textContent;
        diagram.appendChild(graph);
        pre.parentNode.replaceChild(diagram, pre);
        if (window.mermaid) {
          try {
            window.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'dark' });
            window.mermaid.run({ nodes: [graph] }).catch(function () { graph.textContent = 'Diagram tidak dapat dirender. Periksa sintaks diagram.'; });
          } catch (e) { graph.textContent = 'Diagram tidak dapat dirender.'; }
        } else graph.textContent = 'Pustaka diagram belum termuat. Periksa koneksi internet.';
      } else if (type === 'edhychart') {
        var data = parseJSON(code.textContent);
        if (!data || !Array.isArray(data.labels) || !Array.isArray(data.datasets)) return;
        pre.dataset.edhyDone = '1';
        var box = document.createElement('div'); box.className = 'edhy-chart';
        var title = document.createElement('strong'); title.textContent = data.title || 'Grafik Edhy'; box.appendChild(title);
        var canvas = document.createElement('canvas'); canvas.setAttribute('aria-label', title.textContent); box.appendChild(canvas);
        pre.parentNode.replaceChild(box, pre);
        if (window.Chart) {
          var ct = ['bar', 'line', 'pie', 'doughnut'].indexOf(data.type) >= 0 ? data.type : 'bar';
          new Chart(canvas.getContext('2d'), { type: ct, data: { labels: data.labels, datasets: data.datasets.map(function (ds) { return { label: ds.label || 'Data', data: ds.data || [], borderWidth: 2, tension: .25 }; }) },
            options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { labels: { color: '#eee' } } },
              scales: (ct === 'pie' || ct === 'doughnut') ? {} : { x: { ticks: { color: '#ddd' }, grid: { color: '#333' } }, y: { beginAtZero: true, ticks: { color: '#ddd' }, grid: { color: '#333' } } } } });
        } else box.appendChild(document.createTextNode('Grafik tidak dapat dimuat. Periksa koneksi internet.'));
      } else if (type === 'edhydocument') {
        var docData = parseJSON(code.textContent);
        if (!docData || !Array.isArray(docData.blocks)) return;
        pre.dataset.edhyDone = '1';
        var card = makeCard('word', docData.title || 'Dokumen Word', 'Dokumen dapat diunduh sebagai Word atau PDF.', [
          { label: 'Word (.docx)', kind: 'word', run: function () { exportWord(docData); } },
          { label: 'PDF', kind: 'pdf', run: function () { exportPDF(docData); } }
        ]);
        pre.parentNode.replaceChild(card, pre);
      } else if (type === 'edhyexcel') {
        var excelData = parseJSON(code.textContent);
        if (!excelData || !Array.isArray(excelData.sheets) || !excelData.sheets.length) return;
        pre.dataset.edhyDone = '1';
        var sheet = excelData.sheets[0];
        var cardX = makeCard('excel', excelData.title || 'Buku kerja Excel', 'Pratinjau lembar: ' + (sheet.name || 'Data'), [
          { label: 'Unduh Excel (.xlsx)', kind: 'excel', run: function () {
            if (!window.XLSX) { alert('Pustaka Excel belum termuat.'); return; }
            var wb = XLSX.utils.book_new();
            excelData.sheets.forEach(function (s, i) {
              var rows = []; if (s.headers) rows.push(s.headers);
              (s.rows || []).forEach(function (r) { rows.push(r); });
              var ws = XLSX.utils.aoa_to_sheet(rows);
              XLSX.utils.book_append_sheet(wb, ws, String(s.name || ('Sheet' + (i + 1))).slice(0, 31));
            });
            XLSX.writeFile(wb, safeName(excelData.title || 'edhy-data') + '.xlsx');
          } }
        ]);
        cardX.appendChild(tableNode(sheet.headers || [], sheet.rows || []));
        pre.parentNode.replaceChild(cardX, pre);
      }
    });
  }
  function process(root) { renderMarkdownTables(root); renderStructured(root); }
  var target = document.getElementById('wrap');
  if (!target) return;
  var observer = new MutationObserver(function () {
    window.clearTimeout(window.__edhyVisualScanTimer);
    window.__edhyVisualScanTimer = window.setTimeout(function () {
      document.querySelectorAll('#wrap .msg.bot').forEach(process);
    }, 80);
  });
  observer.observe(target, { childList: true, subtree: true });
  document.querySelectorAll('#wrap .msg.bot').forEach(process);
})();