(function(){
  'use strict';
  var API = '';
  var accessKey = '';
  var token = '';
  var $ = function(s, root){ return (root || document).querySelector(s); };
  var style = document.createElement('style');
style.textContent = `
    .edhy-term{width:100%;max-width:980px;margin:12px auto;background:#f3f3f3;border:1px solid #8b8b8b;border-radius:3px;overflow:hidden;color:#171717;font:13px/1.5 "Segoe UI",system-ui,sans-serif;box-shadow:0 14px 38px #0009}
    .edhy-term.is-maximized{position:fixed;inset:8px;z-index:99999;width:auto;max-width:none;max-height:none;margin:0;display:flex;flex-direction:column}
    .edhy-term-head{height:38px;min-height:38px;display:flex;align-items:center;gap:9px;padding:0 0 0 12px;background:#0878d1;color:#fff;border-bottom:1px solid #075fa8;user-select:none}
    .edhy-term-appicon{width:19px;height:19px;display:grid;place-items:center;background:#fff;color:#0878d1;font:700 13px/1 ui-monospace,monospace;border-radius:2px}
    .edhy-term-title{flex:1;color:#fff;font-size:13px!important;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .edhy-win-controls{height:100%;display:flex;align-items:stretch}
    .edhy-win-control{width:44px;border:0;background:transparent;color:#fff;font:16px/1 "Segoe UI",sans-serif;cursor:pointer}
    .edhy-win-control:hover{background:#ffffff28}
    .edhy-win-control.edhy-win-close:hover{background:#e81123}
    .edhy-term-body{padding:13px;background:#f3f3f3;min-height:0}
    .edhy-term-config{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:10px}
    .edhy-term input{min-width:0;width:100%;border:1px solid #aaa;border-radius:0;background:#fff;color:#171717;padding:9px 10px;font:13px "Segoe UI",system-ui,sans-serif}
    .edhy-term input:focus{outline:1px solid #0078d4;outline-offset:0;border-color:#0078d4}
    .edhy-term button{cursor:pointer}
    .edhy-term .edhy-action{border:1px solid #adadad;border-radius:2px;background:#e1e1e1;color:#171717;padding:8px 13px;font:13px "Segoe UI",system-ui,sans-serif;box-shadow:inset 0 1px #fff}
    .edhy-term .edhy-action:hover:not(:disabled){background:#e5f1fb;border-color:#0078d4}
    .edhy-term .edhy-action:disabled{opacity:.5;cursor:default}
    .edhy-term .edhy-start{background:#e5f1fb;color:#075b9b;border-color:#0078d4;font-weight:600}
    .edhy-term-toolbar{display:flex;gap:7px;margin-bottom:10px}
    .edhy-term-output{min-height:210px;max-height:44vh;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;background:#090d12;border:1px solid #252b33;border-radius:0;padding:13px;color:#e6edf5;font:13px/1.55 Consolas,"Courier New",monospace}
    .edhy-term-line{display:flex;gap:7px;margin:10px 0 0}.edhy-term-line input{flex:1}
    .edhy-term-hint{color:#505050;font:12px/1.5 "Segoe UI",system-ui,sans-serif;margin:0 0 10px}
    .edhy-term-error{color:#ff9292}.edhy-term-ok{color:#9bf4b0}
    .edhy-term-taskbar{height:36px;display:flex;align-items:center;gap:9px;padding:0 10px;background:#202020;color:#eee;font:12px "Segoe UI",sans-serif}
    .edhy-task-start{height:28px;width:30px;display:grid;place-items:center;color:#fff;font-size:19px!important;background:transparent;border:0}
    .edhy-task-start:hover{background:#ffffff20}
    .edhy-task-app{height:28px;display:flex;align-items:center;gap:7px;padding:0 10px;background:#343434;border-bottom:2px solid #49a6e9;color:#fff}
    .edhy-task-spacer{flex:1}
    .edhy-task-clock{font-variant-numeric:tabular-nums;color:#eee}
    .edhy-term.is-minimized .edhy-term-body,.edhy-term.is-minimized .edhy-term-taskbar{display:none}
    .edhy-term.is-maximized .edhy-term-body{flex:1;display:flex;flex-direction:column;overflow:auto}
    .edhy-term.is-maximized .edhy-term-output{flex:1;max-height:none}
    @media(max-width:560px){
      .edhy-term{border-radius:2px;margin:8px auto}
      .edhy-term-head{height:36px;min-height:36px;padding-left:8px}
      .edhy-win-control{width:38px}
      .edhy-term-body{padding:9px}
      .edhy-term-config{grid-template-columns:1fr}
      .edhy-term-output{min-height:170px;max-height:38vh;padding:10px}
      .edhy-term-line{gap:5px}
      .edhy-term .edhy-action{padding:8px 9px}
      .edhy-term.is-maximized{inset:0;border:0}
      .edhy-term.is-maximized .edhy-term-output{min-height:120px}
    }
  `;

  document.head.appendChild(style);

  function appendOutput(box, text, cls){
    var line = document.createElement('div');
    if(cls) line.className = cls;
    line.textContent = text;
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
  }
  async function request(action, extra){
    if(!API) throw new Error('Isi URL backend Vercel terlebih dahulu.');
    if(!accessKey) throw new Error('Isi Kode Akses Terminal terlebih dahulu.');
    var response = await fetch(API.replace(/\\/$/, '') + '/api/terminal', {
      method:'POST', headers:{'Content-Type':'application/json','X-Terminal-Key':accessKey},
      body:JSON.stringify(Object.assign({action:action,token:token}, extra || {}))
    });
    var data = await response.json().catch(function(){return {};});
    if(!response.ok) throw new Error(data.error || ('HTTP '+response.status));
    if(data.token) token = data.token;
    return data;
  }
  function openTerminal(){
    var wrap = $('#wrap');
    if(!wrap) return;
    var old = $('#edhyTerminal', wrap);
    if(old){ old.scrollIntoView({behavior:'smooth',block:'center'}); return; }
    var card = document.createElement('section');
    card.id = 'edhyTerminal'; card.className = 'edhy-term';
    card.innerHTML = `
      <div class="edhy-term-head">
        <span class="edhy-term-appicon">›_</span>
        <strong class="edhy-term-title">Edhy Terminal — Linux Sandbox</strong>
        <div class="edhy-win-controls">
          <button class="edhy-win-control edhy-win-min" type="button" aria-label="Minimize" title="Minimize">—</button>
          <button class="edhy-win-control edhy-win-max" type="button" aria-label="Maximize" title="Maximize">□</button>
          <button class="edhy-win-control edhy-win-close" type="button" aria-label="Close" title="Close">×</button>
        </div>
      </div>
      <div class="edhy-term-body">
        <div class="edhy-term-config">
          <input class="edhy-api" type="url" placeholder="URL backend Vercel (https://...vercel.app)" autocomplete="url">
          <input class="edhy-key" type="password" placeholder="Kode Akses Terminal" autocomplete="off">
        </div>
        <div class="edhy-term-toolbar"><button class="edhy-action edhy-start" type="button">▶ Mulai Terminal</button><button class="edhy-action edhy-stop" type="button" disabled>■ Akhiri Sesi</button></div>
        <p class="edhy-term-hint">Terminal Linux berjalan di sandbox cloud terisolasi, bukan di HP atau komputer mas. Sesi sementara; jangan masukkan password atau API key pribadi.</p>
        <div class="edhy-term-output" role="log" aria-live="polite">Edhy Terminal belum terhubung. Masukkan alamat backend dan kode akses.</div>
        <form class="edhy-term-line"><input class="edhy-command" type="text" placeholder="Ketik perintah, contoh: pwd" autocomplete="off" disabled><button class="edhy-action edhy-run" type="submit" disabled>Jalankan</button></form>
      </div>
      <div class="edhy-term-taskbar">
        <button class="edhy-task-start" type="button" title="Start">⊞</button>
        <div class="edhy-task-app"><span>›_</span><span>Edhy Terminal</span></div>
        <span class="edhy-task-spacer"></span>
        <span class="edhy-task-clock">EdhyX</span>
      </div>`;
    wrap.appendChild(card);
    var output = $('.edhy-term-output',card), cmd = $('.edhy-command',card), run = $('.edhy-run',card), start = $('.edhy-start',card), stop = $('.edhy-stop',card);
    $('.edhy-api',card).value = API;
    $('.edhy-api',card).addEventListener('change',function(){API=this.value.trim().replace(/\\/$/,'');});
    $('.edhy-key',card).addEventListener('change',function(){accessKey=this.value.trim();});
    $('.edhy-win-close',card).addEventListener('click',function(){card.remove();});
    $('.edhy-win-min',card).addEventListener('click',function(){card.classList.toggle('is-minimized');});
    $('.edhy-win-max',card).addEventListener('click',function(){
      card.classList.toggle('is-maximized');
      $('.edhy-win-max',card).textContent = card.classList.contains('is-maximized') ? '❐' : '□';
      $('.edhy-win-max',card).title = card.classList.contains('is-maximized') ? 'Restore' : 'Maximize';
    });
    start.addEventListener('click',async function(){
      API=$('.edhy-api',card).value.trim().replace(/\\/$/,'');
      accessKey=$('.edhy-key',card).value.trim();
      start.disabled=true; appendOutput(output,'Menyiapkan sandbox...','edhy-term-ok');
      try{
        var d=await request('start'); appendOutput(output,d.output || 'Sandbox siap.','edhy-term-ok');
        cmd.disabled=false;run.disabled=false;stop.disabled=false;cmd.focus();
      }catch(e){appendOutput(output,'ERROR: '+e.message,'edhy-term-error');}
      finally{start.disabled=false;}
    });
    $('.edhy-term-line',card).addEventListener('submit',async function(e){
      e.preventDefault(); var command=cmd.value.trim(); if(!command||!token)return;
      cmd.value=''; run.disabled=true; appendOutput(output,'$ '+command);
      try{
        var d=await request('run',{command:command});
        if(d.stdout) appendOutput(output,d.stdout);
        if(d.stderr) appendOutput(output,d.stderr,'edhy-term-error');
        if(d.exitCode!==0 && d.exitCode!==undefined) appendOutput(output,'[exit code '+d.exitCode+']','edhy-term-error');
        if(!d.stdout&&!d.stderr) appendOutput(output,'[Perintah selesai tanpa output]');
      }catch(e){appendOutput(output,'ERROR: '+e.message,'edhy-term-error');}
      finally{run.disabled=false;cmd.focus();}
    });
    stop.addEventListener('click',async function(){
      stop.disabled=true;run.disabled=true;cmd.disabled=true;
      try{await request('stop');appendOutput(output,'Sesi terminal diakhiri.','edhy-term-ok');}
      catch(e){appendOutput(output,'INFO: '+e.message,'edhy-term-error');}
      token='';run.disabled=true;cmd.disabled=true;start.disabled=false;
    });
    card.scrollIntoView({behavior:'smooth',block:'center'});
  }

  // Tangkap hanya permintaan eksplisit agar pesan terminal tidak dikirim ke model chat.
  document.addEventListener('submit',function(e){
    if(!e.target || e.target.id!=='form') return;
    var input=$('#text');
    var value=(input && input.value || '').trim();
    if(!/^(edhy[, ]*)?(buka|akses|jalankan|masuk ke) terminal[.! ]*$/i.test(value)) return;
    e.preventDefault();e.stopImmediatePropagation();
    input.value='';input.style.height='auto';openTerminal();
  },true);
  window.EdhyTerminal={open:openTerminal};
})();