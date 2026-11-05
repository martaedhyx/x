(function(){
  'use strict';
  if (window.EdhySymbolLibrary) return;

  var groups = [
    {name:'Favorit', icon:'★', items:[]},
    {name:'Wajah & emosi', icon:'☺', items:[
      ['😀','senyum'],['😃','senyum lebar'],['😄','tertawa'],['😁','nyengir'],['😆','tertawa terbahak'],['😅','keringat'],['😂','tertawa menangis'],['🤣','berguling tertawa'],['😊','senang'],['😇','halo'],['🙂','senyum'],['🙃','terbalik'],['😉','kedip'],['😍','mata hati'],['🥰','penuh cinta'],['😘','cium'],['😎','kacamata'],['🤔','berpikir'],['🫡','hormat'],['🤗','peluk'],['🤫','diam'],['🤭','menutup mulut'],['🫢','terkejut'],['😐','datar'],['😑','tanpa ekspresi'],['🙄','memutar mata'],['😏','menyeringai'],['😢','menangis'],['😭','menangis deras'],['😤','kesal'],['😡','marah'],['🤯','meledak pikiran'],['🥳','pesta'],['🤩','kagum'],['😴','tidur'],['🤒','sakit'],['🤕','terluka'],['🫠','meleleh'],['🫶','tangan hati'],['🙏','terima kasih'],['👏','tepuk tangan'],['🙌','angkat tangan'],['🤝','jabat tangan'],['💪','kuat']
    ]},
    {name:'Simbol umum', icon:'✳', items:[
      ['✅','centang benar'],['☑️','kotak centang'],['✔️','centang'],['❌','silang'],['✖️','kali'],['➕','tambah'],['➖','kurang'],['➗','bagi'],['❓','tanya'],['❔','tanya putih'],['❗','seru'],['❕','seru putih'],['‼️','seru ganda'],['⁉️','tanya seru'],['⚠️','peringatan'],['🚫','dilarang'],['⛔','stop'],['⭕','lingkaran merah'],['🔴','merah'],['🟠','jingga'],['🟡','kuning'],['🟢','hijau'],['🔵','biru'],['🟣','ungu'],['⚫','hitam'],['⚪','putih'],['🟤','cokelat'],['🔘','tombol radio'],['🔺','segitiga atas'],['🔻','segitiga bawah'],['💠','berlian'],['🔆','terang'],['🔅','redup'],['♻️','daur ulang'],['🔰','pemula'],['〽️','tanda bagian'],['✳️','asterisk'],['✴️','bintang'],['❇️','kilau'],['©️','hak cipta'],['®️','terdaftar'],['™️','merek dagang'],['ℹ️','informasi'],['🆗','oke'],['🆕','baru'],['🆓','gratis'],['🆙','naik'],['🆒','keren'],['🆘','darurat'],['🅿️','parkir'],['🈂️','layanan'],['♿','aksesibilitas']
    ]},
    {name:'Panah & navigasi', icon:'➜', items:[
      ['←','kiri'],['↑','atas'],['→','kanan'],['↓','bawah'],['↔','kiri kanan'],['↕','atas bawah'],['↖','serong kiri atas'],['↗','serong kanan atas'],['↘','serong kanan bawah'],['↙','serong kiri bawah'],['↩','kembali'],['↪','belok kanan'],['↻','putar searah'],['↺','putar berlawanan'],['⇄','tukar arah'],['⇆','panah ganda'],['⇧','shift atas'],['⇩','turun'],['⇨','kanan tebal'],['⇦','kiri tebal'],['⇑','atas ganda'],['⇓','bawah ganda'],['⤴','belok atas'],['⤵','belok bawah'],['⟲','putar kiri'],['⟳','putar kanan'],['➔','panah panjang'],['➜','panah'],['➤','panah tebal'],['▶️','putar'],['⏩','maju cepat'],['⏪','mundur cepat'],['⏫','naik cepat'],['⏬','turun cepat'],['🔼','naik'],['🔽','turun'],['⏏️','keluarkan'],['🔀','acak'],['🔁','ulang'],['🔂','ulang satu']
    ]},
    {name:'Matematika', icon:'∑', items:[
      ['+','tambah'],['−','minus'],['×','kali'],['÷','bagi'],['=','sama dengan'],['≠','tidak sama'],['≈','kira kira'],['≡','identik'],['<','kurang dari'],['>','lebih dari'],['≤','kurang sama'],['≥','lebih sama'],['±','plus minus'],['∓','minus plus'],['∞','tak hingga'],['√','akar'],['∛','akar kubik'],['∜','akar pangkat empat'],['∑','sigma jumlah'],['∏','produk'],['∫','integral'],['∬','integral ganda'],['∮','integral kontur'],['∂','turunan parsial'],['∇','nabla'],['∆','delta'],['∴','oleh karena itu'],['∵','karena'],['∝','sebanding'],['∠','sudut'],['⊥','tegak lurus'],['∥','sejajar'],['∈','anggota'],['∉','bukan anggota'],['⊂','himpunan bagian'],['⊆','bagian sama'],['∪','gabungan'],['∩','irisan'],['∅','himpunan kosong'],['∀','untuk semua'],['∃','ada'],['ℕ','bilangan asli'],['ℤ','bilangan bulat'],['ℚ','rasional'],['ℝ','real'],['ℂ','kompleks'],['π','pi'],['τ','tau'],['°','derajat'],['′','menit'],['″','detik'],['‰','per mil'],['％','persen penuh'],['¹','pangkat satu'],['²','kuadrat'],['³','kubik'],['⁴','pangkat empat'],['₁','indeks satu'],['₂','indeks dua'],['₃','indeks tiga'],['ₙ','indeks n']
    ]},
    {name:'Mata uang', icon:'Rp', items:[
      ['Rp','rupiah'],['$','dolar'],['¢','sen'],['€','euro'],['£','pound'],['¥','yen yuan'],['元','yuan'],['₹','rupee India'],['₩','won'],['₽','rubel'],['₺','lira'],['฿','baht'],['₫','dong'],['₴','hryvnia'],['₦','naira'],['₱','peso'],['₲','guarani'],['₡','colon'],['₭','kip'],['₮','tugrik'],['₸','tenge'],['₼','manat'],['₾','lari'],['₿','bitcoin'],['Ξ','ethereum']
    ]},
    {name:'Geometri & bentuk', icon:'◆', items:[
      ['■','kotak hitam'],['□','kotak kosong'],['▣','kotak isi'],['▢','kotak garis'],['▪','kotak kecil'],['▫','kotak kecil kosong'],['▬','balok'],['▭','persegi panjang'],['▲','segitiga atas'],['△','segitiga kosong'],['▼','segitiga bawah'],['▽','segitiga bawah kosong'],['◀','segitiga kiri'],['◁','segitiga kiri kosong'],['▶','segitiga kanan'],['▷','segitiga kanan kosong'],['◆','wajik'],['◇','wajik kosong'],['◈','wajik tengah'],['●','lingkaran penuh'],['○','lingkaran kosong'],['◉','lingkaran titik'],['◎','lingkaran ganda'],['◌','lingkaran putus'],['◐','setengah lingkaran'],['◑','setengah lingkaran kanan'],['◒','setengah bawah'],['◓','setengah atas'],['◯','lingkaran besar'],['⬟','segi lima'],['⬢','segi enam'],['⬡','segi enam kosong'],['✦','bintang empat'],['✧','bintang kosong'],['★','bintang penuh'],['☆','bintang kosong'],['✪','bintang lingkaran'],['✶','bintang enam'],['✷','bintang delapan']
    ]},
    {name:'Hukum & dokumen', icon:'§', items:[
      ['§','bagian hukum'],['¶','paragraf'],['※','catatan'],['⁂','asterisme'],['†','dagger'],['‡','double dagger'],['•','bullet'],['◦','bullet kosong'],['‣','bullet segitiga'],['⁃','bullet strip'],['—','garis panjang'],['–','garis pendek'],['…','elipsis'],['‰','per mil'],['№','nomor'],['℅','atas nama'],['℗','hak rekam'],['℠','merek layanan'],['℡','telepon'],['☏','telepon'],['⚖️','timbangan hukum'],['📝','catatan'],['📄','dokumen'],['📃','halaman'],['📑','tab dokumen'],['📌','pin'],['📎','klip'],['🖇️','klip ganda'],['🔏','gembok tinta'],['🔒','terkunci'],['🔓','terbuka'],['🔐','kunci'],['🗂️','folder kartu'],['🗃️','kotak arsip'],['🗄️','lemari arsip']
    ]},
    {name:'Kartu, catur & permainan', icon:'♠', items:[
      ['♠','sekop'],['♡','hati kosong'],['♥','hati'],['♢','wajik kartu'],['♦','wajik kartu penuh'],['♧','keriting kosong'],['♣','keriting'],['🃏','joker'],['🎴','kartu bunga'],['♔','raja putih'],['♕','ratu putih'],['♖','benteng putih'],['♗','gajah putih'],['♘','kuda putih'],['♙','pion putih'],['♚','raja hitam'],['♛','ratu hitam'],['♜','benteng hitam'],['♝','gajah hitam'],['♞','kuda hitam'],['♟','pion hitam'],['🎲','dadu'],['🧩','puzzle'],['🎯','target'],['🏆','piala'],['🥇','medali emas'],['🥈','medali perak'],['🥉','medali perunggu']
    ]},
    {name:'Musik', icon:'♫', items:[
      ['♩','not seperempat'],['♪','not musik'],['♫','dua not'],['♬','not ganda'],['♭','mol'],['♮','natural'],['♯','kres'],['𝄞','kunci G'],['𝄢','kunci F'],['𝄪','kres ganda'],['𝄫','mol ganda'],['🎵','not musik emoji'],['🎶','not musik banyak'],['🎼','partitur'],['🎹','piano'],['🎸','gitar'],['🥁','drum'],['🎺','terompet'],['🎻','biola'],['🪇','marakas']
    ]},
    {name:'Cuaca & alam', icon:'☀', items:[
      ['☀️','matahari'],['☼','matahari simbol'],['☁️','awan'],['⛅','cerah berawan'],['🌤️','matahari awan'],['🌦️','hujan matahari'],['🌧️','hujan'],['⛈️','badai petir'],['🌩️','petir'],['🌨️','salju'],['❄️','keping salju'],['☃️','manusia salju'],['🌪️','tornado'],['🌈','pelangi'],['🌊','ombak'],['🔥','api'],['💧','tetes air'],['💦','percikan'],['🌱','tunas'],['🌳','pohon'],['🌲','cemara'],['🍀','semanggi'],['🌸','bunga'],['🌻','bunga matahari'],['🌍','bumi'],['🌎','bumi amerika'],['🌏','bumi asia'],['🌙','bulan sabit'],['🌕','bulan purnama'],['⭐','bintang'],['🌟','bintang bersinar'],['☄️','komet'],['🪐','planet'],['🌋','gunung api'],['⛰️','gunung'],['🏔️','gunung salju']
    ]},
    {name:'Transportasi & tempat', icon:'🚦', items:[
      ['🚗','mobil'],['🚕','taksi'],['🚌','bus'],['🚎','trolleybus'],['🏎️','mobil balap'],['🚓','polisi'],['🚑','ambulans'],['🚒','pemadam'],['🚚','truk'],['🚲','sepeda'],['🛵','skuter'],['🏍️','motor'],['🚆','kereta'],['🚄','kereta cepat'],['🚇','metro'],['✈️','pesawat'],['🛫','pesawat berangkat'],['🛬','pesawat mendarat'],['🚀','roket'],['🛸','piring terbang'],['🚁','helikopter'],['⛵','perahu'],['🚢','kapal'],['⚓','jangkar'],['🚦','lampu lalu lintas'],['🚥','lampu horizontal'],['🛑','rambu stop'],['🚸','penyeberangan'],['🛣️','jalan raya'],['🗺️','peta'],['🧭','kompas'],['🏠','rumah'],['🏢','gedung'],['🏥','rumah sakit'],['🏫','sekolah'],['🏛️','gedung umum'],['🗼','menara'],['🗽','patung liberty']
    ]},
    {name:'Profesi & manusia', icon:'🧑', items:[
      ['👨‍⚕️','dokter pria'],['👩‍⚕️','dokter wanita'],['🧑‍⚕️','dokter'],['👨‍🏫','guru pria'],['👩‍🏫','guru wanita'],['🧑‍🏫','guru'],['👨‍💻','teknolog pria'],['👩‍💻','teknolog wanita'],['🧑‍💻','teknolog'],['👨‍🚀','astronaut pria'],['👩‍🚀','astronaut wanita'],['🧑‍🚀','astronaut'],['👨‍✈️','pilot pria'],['👩‍✈️','pilot wanita'],['🧑‍✈️','pilot'],['👮','polisi'],['🕵️','detektif'],['💂','penjaga'],['👷','pekerja konstruksi'],['🧑‍🍳','koki'],['🧑‍🎨','seniman'],['🧑‍🔬','ilmuwan'],['🧑‍🚒','pemadam'],['🧑‍⚖️','hakim'],['🧑‍🌾','petani'],['🧑‍🔧','mekanik'],['🧑‍🏭','pekerja pabrik'],['🧑‍🎤','penyanyi'],['🫅','orang bermahkota'],['👑','mahkota'],['🧑‍🧒‍🧒','keluarga']
    ]},
    {name:'Teknologi & sains', icon:'⚙', items:[
      ['⚙️','roda gigi'],['⚛️','atom'],['🧬','dna'],['🧪','tabung'],['🧫','cawan petri'],['🔬','mikroskop'],['🔭','teleskop'],['🛰️','satelit'],['💻','komputer'],['🖥️','monitor'],['⌨️','keyboard'],['🖱️','mouse'],['🖨️','printer'],['📱','ponsel'],['☎️','telepon'],['📡','antena'],['🔋','baterai'],['🪫','baterai lemah'],['💡','lampu'],['🔌','colokan'],['🧯','pemadam api'],['🛠️','alat'],['🔧','kunci inggris'],['🔨','palu'],['🪛','obeng'],['🔩','baut'],['⚡','listrik'],['💾','disket'],['💿','cd'],['📀','dvd'],['🧮','sempoa']
    ]},
    {name:'Aksesibilitas & tanda', icon:'♿', items:[
      ['♿','kursi roda'],['🚹','toilet pria'],['🚺','toilet wanita'],['🚻','toilet'],['🚼','ruang bayi'],['🚾','toilet wc'],['🛂','kontrol paspor'],['🛃','bea cukai'],['🛄','ambil bagasi'],['🛅','penitipan bagasi'],['🚮','buang sampah'],['🚰','air minum'],['🚭','dilarang merokok'],['🚯','jangan buang sampah'],['🚱','air tidak layak'],['🚳','dilarang sepeda'],['🚷','dilarang pejalan'],['🔞','khusus dewasa'],['📵','dilarang ponsel'],['🔕','senyap'],['🔔','lonceng'],['🆘','sos'],['🆔','identitas'],['🅰️','golongan A'],['🅱️','golongan B'],['🆎','golongan AB'],['🅾️','golongan O'],['🈂️','layanan'],['🈯','ditetapkan'],['🈚','gratis'],['🈲','dilarang'],['🈳','kosong'],['🈴','lulus'],['🈵','penuh'],['🈶','berbayar'],['🈸','aplikasi'],['🈹','diskon'],['🈺','buka'],['🈷️','bulanan'],['🈁','di sini']
    ]},
    {name:'Hati & dekorasi', icon:'♥', items:[
      ['❤️','hati merah'],['🧡','hati jingga'],['💛','hati kuning'],['💚','hati hijau'],['💙','hati biru'],['💜','hati ungu'],['🖤','hati hitam'],['🤍','hati putih'],['🤎','hati cokelat'],['💔','hati patah'],['❣️','tanda hati'],['💕','dua hati'],['💞','hati berputar'],['💓','hati berdenyut'],['💗','hati tumbuh'],['💖','hati berkilau'],['💘','hati panah'],['💝','hati pita'],['💟','hiasan hati'],['✨','kilau'],['💫','pusing'],['💥','ledakan'],['💯','seratus'],['🎉','konfeti'],['🎊','pesta'],['🎀','pita'],['🔮','bola kristal'],['🪄','tongkat sihir']
    ]}
  ];

  var active = 'Favorit';
  var query = '';
  var recent = [];
  try { recent = JSON.parse(localStorage.getItem('edhy_symbol_recent') || '[]'); if (!Array.isArray(recent)) recent = []; } catch(e) { recent = []; }

  function el(tag, attrs, txt){
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function(k){ n.setAttribute(k, attrs[k]); });
    if (txt !== undefined) n.textContent = txt;
    return n;
  }
  function addStyles(){
    if (document.getElementById('edhy-symbol-style')) return;
    var css = [
      '#edhySymbolDlg{width:min(620px,94vw);max-width:620px;max-height:84dvh;padding:16px;background:#0d0d0d;color:#fff;border:1px solid #444;border-radius:16px;box-sizing:border-box}',
      '#edhySymbolDlg::backdrop{background:rgba(0,0,0,.72)}',
      '#edhySymbolDlg .es-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}',
      '#edhySymbolDlg h2{margin:0;font-size:19px!important;font-weight:700}',
      '#edhySymbolDlg .es-close{border:1px solid #444;border-radius:9px;padding:5px 10px;color:#fff}',
      '#edhySymbolDlg .es-search{width:100%;padding:11px 12px;border:1px solid #444;border-radius:10px;background:#050505;color:#fff;font:16px/1.4 system-ui;box-sizing:border-box;margin-bottom:10px}',
      '#edhySymbolDlg .es-tabs{display:flex;gap:6px;overflow-x:auto;padding:2px 0 10px;scrollbar-width:thin}',
      '#edhySymbolDlg .es-tab{flex:0 0 auto;border:1px solid #3a3a3a;border-radius:9px;padding:7px 9px;color:#ddd;background:#151515;font-size:12px!important}',
      '#edhySymbolDlg .es-tab[aria-selected=true]{background:#fff;color:#000;border-color:#fff}',
      '#edhySymbolDlg .es-caption{color:#aaa;font-size:12px!important;margin:2px 0 8px}',
      '#edhySymbolDlg .es-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;max-height:42dvh;overflow-y:auto;padding:2px}',
      '#edhySymbolDlg .es-item{min-width:0;min-height:48px;border:1px solid #303030;border-radius:9px;background:#151515;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:4px 2px}',
      '#edhySymbolDlg .es-item:active,#edhySymbolDlg .es-item:hover{background:#292929;border-color:#888}',
      '#edhySymbolDlg .es-glyph{font-size:23px!important;line-height:1.2}',
      '#edhySymbolDlg .es-label{font-size:9px!important;line-height:1.1;color:#aaa;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '#edhySymbolDlg .es-empty{color:#aaa;text-align:center;padding:24px 8px;font-size:13px!important}',
      '#edhySymbolDlg .es-foot{color:#999;font-size:11px!important;margin-top:10px}',
      '@media(max-width:420px){#edhySymbolDlg{padding:12px}#edhySymbolDlg .es-grid{grid-template-columns:repeat(6,minmax(0,1fr));gap:5px}#edhySymbolDlg .es-item{min-height:45px}}'
    ].join('');
    var style = el('style',{id:'edhy-symbol-style'}); style.textContent = css; document.head.appendChild(style);
  }
  function getGroup(name){ return groups.filter(function(g){return g.name===name;})[0]; }
  function showItems(){
    var grid = document.getElementById('edhySymbolGrid');
    var caption = document.getElementById('edhySymbolCaption');
    grid.textContent = '';
    var term = query.trim().toLowerCase();
    var items = [];
    if (term){
      groups.forEach(function(g){ g.items.forEach(function(it){ if ((it[0]+' '+it[1]+' '+g.name).toLowerCase().indexOf(term)!==-1) items.push(it); }); });
      caption.textContent = 'Hasil pencarian: '+items.length;
    } else {
      var g = getGroup(active);
      items = active === 'Favorit' ? recent.map(function(s){ return [s,'baru digunakan']; }) : (g ? g.items : []);
      caption.textContent = active + ' · ' + items.length + ' simbol';
    }
    if (!items.length){ grid.appendChild(el('div',{class:'es-empty'},'Tidak ada simbol ditemukan.')); return; }
    items.forEach(function(it){
      var b = el('button',{type:'button',class:'es-item',title:it[1]+' · '+it[0], 'aria-label':it[1]+' '+it[0]});
      b.appendChild(el('span',{class:'es-glyph'},it[0]));
      b.appendChild(el('span',{class:'es-label'},it[1]));
      b.addEventListener('click',function(){ insertSymbol(it[0]); });
      grid.appendChild(b);
    });
  }
  function renderTabs(){
    var tabs = document.getElementById('edhySymbolTabs'); tabs.textContent = '';
    groups.forEach(function(g){
      var b = el('button',{type:'button',class:'es-tab','aria-selected':String(active===g.name)},g.icon+' '+g.name);
      b.addEventListener('click',function(){ active=g.name; query=''; document.getElementById('edhySymbolSearch').value=''; renderTabs(); showItems(); });
      tabs.appendChild(b);
    });
  }
  function insertSymbol(symbol){
    var input = document.getElementById('text');
    if (!input){ return; }
    var start = typeof input.selectionStart === 'number' ? input.selectionStart : input.value.length;
    var end = typeof input.selectionEnd === 'number' ? input.selectionEnd : start;
    input.value = input.value.slice(0,start)+symbol+input.value.slice(end);
    var pos = start + symbol.length;
    input.focus();
    try { input.setSelectionRange(pos,pos); } catch(e){}
    input.dispatchEvent(new Event('input',{bubbles:true}));
    recent = [symbol].concat(recent.filter(function(s){return s!==symbol;})).slice(0,60);
    try { localStorage.setItem('edhy_symbol_recent',JSON.stringify(recent)); } catch(e){}
    document.getElementById('edhySymbolDlg').close();
  }
  function openLibrary(){
    var dlg = document.getElementById('edhySymbolDlg');
    if (!dlg) return;
    query=''; active='Favorit';
    document.getElementById('edhySymbolSearch').value='';
    renderTabs(); showItems();
    dlg.showModal();
    document.getElementById('edhySymbolSearch').focus();
  }
  function init(){
    var menu=document.getElementById('menu');
    if (!menu || !document.getElementById('text')) return;
    addStyles();
    var trigger=el('button',{type:'button',id:'mSymbols'},'▦  Simbol');
    menu.appendChild(trigger);
    var dlg=el('dialog',{id:'edhySymbolDlg','aria-labelledby':'edhySymbolTitle'});
    var head=el('div',{class:'es-head'});
    head.appendChild(el('h2',{id:'edhySymbolTitle'},'Simbol EdhyX'));
    var close=el('button',{type:'button',class:'es-close'},'Tutup'); close.addEventListener('click',function(){dlg.close();}); head.appendChild(close);
    dlg.appendChild(head);
    var search=el('input',{type:'search',id:'edhySymbolSearch',class:'es-search',placeholder:'Cari simbol, emoji, atau nama…','aria-label':'Cari simbol'});
    search.addEventListener('input',function(){query=search.value;showItems();});
    dlg.appendChild(search);
    dlg.appendChild(el('div',{id:'edhySymbolTabs',class:'es-tabs','role':'tablist'}));
    dlg.appendChild(el('div',{id:'edhySymbolCaption',class:'es-caption'}));
    dlg.appendChild(el('div',{id:'edhySymbolGrid',class:'es-grid'}));
    dlg.appendChild(el('div',{class:'es-foot'},'Ketuk simbol untuk memasukkannya ke kolom pesan. Simbol terakhir yang dipakai tersimpan di Favorit.'));
    document.body.appendChild(dlg);
    trigger.addEventListener('click',function(){menu.classList.remove('on');openLibrary();});
    dlg.addEventListener('click',function(e){if(e.target===dlg)dlg.close();});
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&dlg.open)dlg.close();});
    window.EdhySymbolLibrary={open:openLibrary,insert:insertSymbol,groups:groups};
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();