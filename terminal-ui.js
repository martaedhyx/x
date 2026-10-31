(function(){
  'use strict';
  var API = '';
  var accessKey = '';
  var token = '';
  var $ = function(s, root){ return (root || document).querySelector(s); };
  var style = document.createElement('style');
  style.textContent = `
    .edhy-term{width:100%;max-width:820px;margin:8px auto;background:#090d12;border:1px solid #303a46;border-radius:14px;overflow:hidden;color:#e7edf5;font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;box-shadow:0 12px 36px #0008}
    .edhy-term-head{display:flex;align-items:center;gap:8px;padding:10px 12px;background:#141b24;border-bottom:1px solid #303a46}
    .edhy-dots{display:flex;gap:5px}.edhy-dots i{width:9px;height:9px;border-radius:50%;background:#ff5f57}.edhy-dots i:nth-child(2){background:#febc2e}.edhy-dots i:nth-child(3){background:#28c840}
    .edhy-term-title{flex:1;color:#dbe5f0;font-size:12px}.edhy-term-close{border:1px solid #394654;border-radius:7px;padding:4px 8px;color:#dbe5f0}
    .edhy-term-body{padding:12px}.edhy-term-config{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
    .edhy-term input{min-width:0;width:100%;border:1px solid #344252;border-radius:8px;background:#0c121a;color:#f4f7fb;padding:10px;font:13px ui-monospace,monospace}
    .edhy-term button{cursor:pointer}.edhy-term .edhy-action{border:1px solid #405164;border-radius:8px;background:#182433;color:#f4f7fb;padding:9px 12px;font:12px ui-monospace,monospace}
    .edhy-term .edhy-start{background:#d9f99d;color:#15210b;border-color:#d9f99d;font-weight:700}
    .edhy-term-output{min-height:190px;max-height:42vh;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;background:#030609;border:1px solid #25303b;border-radius:9px;padding:12px;color:#d9e4ef}
    .edhy-term-line{display:flex;gap:7px;margin:10px 0 0}.edhy-term-line input{flex:1}
    .edhy-term-hint{color:#9aa9b9;font:11px/1.5 system-ui,sans-serif;margin:8px 0}
    .edhy-term-error{color:#ff9292}.edhy-term-ok{color:#9bf4b0}
    @media(max-width:560px){.edhy-term-config{grid-template-columns:1fr}.edhy-term-body{padding:9px}.edhy-term-output{min-height:160px;max-height:38vh}.edhy-term-line{gap:5px}.edhy-term .edhy-action{padding:9px 8px}}
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
      <div class="edhy-term-head"><span class="edhy-dots"><i></i><i></i><i></i></span><strong class="edhy-term-title">EDHY TERMINAL · LINUX SANDBOX</strong><button class="edhy-term-close" type="button">Tutup</button></div>
      <div class="edhy-term-body">
        <div class="edhy-term-config">
          <input class="edhy-api" type="url" placeholder="URL backend Vercel (https://...vercel.app)" autocomplete="url">
          <input class="edhy-key" type="password" placeholder="Kode Akses Terminal" autocomplete="off">
        </div>
        <div class="edhy-term-toolbar"><button class="edhy-action edhy-start" type="button">Mulai Terminal</button> <button class="edhy-action edhy-stop" type="button" disabled>Akhiri Sesi</button></div>
        <p class="edhy-term-hint">Perintah berjalan di Linux cloud terisolasi, bukan di HP atau komputer mas. Sesi sementara; jangan masukkan password atau API key pribadi ke terminal.</p>
        <div class="edhy-term-output" role="log" aria-live="polite">Edhy Terminal belum terhubung. Masukkan alamat backend dan kode akses.</div>
        <form class="edhy-term-line"><input class="edhy-command" type="text" placeholder="Ketik perintah, contoh: pwd" autocomplete="off" disabled><button class="edhy-action edhy-run" type="submit" disabled>Jalankan</button></form>
      </div>`;
    wrap.appendChild(card);
    var output = $('.edhy-term-output',card), cmd = $('.edhy-command',card), run = $('.edhy-run',card), start = $('.edhy-start',card), stop = $('.edhy-stop',card);
    $('.edhy-api',card).value = API;
    $('.edhy-api',card).addEventListener('change',function(){API=this.value.trim().replace(/\\/$/,'');});
    $('.edhy-key',card).addEventListener('change',function(){accessKey=this.value.trim();});
    $('.edhy-term-close',card).addEventListener('click',function(){card.remove();});
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