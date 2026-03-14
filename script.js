/* What2Cook - Orange vD */
(function(){
'use strict';

// ===== Supabase =====
let supabaseClient=null;
const ONLINE={enabled:true,ready:false,lastError:null};
function initSupabase(){try{const u=window.SUPABASE_URL,k=window.SUPABASE_ANON_KEY;if(!u||!k||!window.supabase)return null;return window.supabase.createClient(u,k);}catch(e){return null;}}
function toRow(r){const n=new Date().toISOString();return{id:String(r.id),title:r.title||'',category:r.category||'other',time:Number(r.time||0),difficulty:r.difficulty||'ง่าย',img:r.img||'',ingredients:Array.isArray(r.ingredients)?r.ingredients:[],steps:Array.isArray(r.steps)?r.steps:[],created_at:r.createdAt?new Date(r.createdAt).toISOString():n,updated_at:n};}
function fromRow(row){return{id:String(row.id),title:row.title||'',category:row.category||'other',time:Number(row.time||0),difficulty:row.difficulty||'ง่าย',img:row.img||'',ingredients:Array.isArray(row.ingredients)?row.ingredients:[],steps:Array.isArray(row.steps)?row.steps:[],createdAt:row.created_at?new Date(row.created_at).getTime():Date.now()};}
async function onlineFetchRecipes(){if(!ONLINE.enabled||!supabaseClient)return null;const{data,error}=await supabaseClient.from('recipes').select('*').order('created_at',{ascending:false});if(error)throw error;return(data||[]).map(fromRow);}
let syncTimer=null;
function scheduleOnlineUpsert(all){if(!ONLINE.enabled||!supabaseClient)return;if(syncTimer)clearTimeout(syncTimer);syncTimer=setTimeout(async()=>{try{const{error}=await supabaseClient.from('recipes').upsert((all||[]).map(toRow),{onConflict:'id'});if(error)throw error;ONLINE.lastError=null;}catch(e){ONLINE.lastError=e;console.warn('Supabase sync:',e);}},600);}
async function onlineDeleteRecipe(id){if(!ONLINE.enabled||!supabaseClient)return;try{const{error}=await supabaseClient.from('recipes').delete().eq('id',String(id));if(error)throw error;}catch(e){ONLINE.lastError=e;}}
function showTopError(msg){try{const b=document.createElement('div');b.style.cssText='max-width:1100px;margin:12px auto;padding:12px 14px;border-radius:12px;border:1px solid #f1b5b5;background:#fff0f0;color:#7a1f1f;font-weight:600;font-family:inherit;';b.textContent=msg;document.body.prepend(b);}catch(_){}}
async function initOnlineAndHydrate(){supabaseClient=initSupabase();if(!supabaseClient){ONLINE.enabled=false;ONLINE.ready=true;return;}ONLINE.enabled=true;try{const remote=await onlineFetchRecipes();if(Array.isArray(remote)){if(remote.length===0){const seed=loadJson(STORAGE.recipes,[]);if(Array.isArray(seed)&&seed.length)scheduleOnlineUpsert(seed);}else saveJson(STORAGE.recipes,remote);}ONLINE.ready=true;}catch(e){ONLINE.lastError=e;ONLINE.ready=true;showTopError('⚠️ โหมดออนไลน์เชื่อมต่อไม่สำเร็จ กำลังใช้ข้อมูลในเครื่อง');console.warn('Online init:',e);}}
async function waitOnlineReady(){if(!ONLINE.enabled)return;while(!ONLINE.ready)await new Promise(r=>setTimeout(r,50));}

// ===== Storage =====
const STORAGE={recipes:'w2c_recipes_vb',pantry:'w2c_pantry_vb',favorites:'w2c_favorites_vc',ratings:'w2c_ratings_vc',theme:'w2c_theme'};
const CATEGORIES=[
  {key:'tom',label:'ต้ม',desc:'ซุป/ต้มจืด/ต้มยำ',emoji:'🍲'},
  {key:'fried',label:'ทอด',desc:'ของทอด/ไข่เจียว',emoji:'🍳'},
  {key:'stirfry',label:'ผัด',desc:'ผัดต่างๆ',emoji:'🥘'},
  {key:'grill',label:'ปิ้งย่าง',desc:'ย่าง/อบ',emoji:'🔥'},
  {key:'dessert',label:'ของหวาน',desc:'ขนม/หวาน',emoji:'🍮'},
  {key:'other',label:'อื่นๆ',desc:'เมนูอื่นๆ',emoji:'🍽️'}
];
const COMMON_INGREDIENTS=['ไข่','ไก่','หมูสับ','หมูสามชั้น','กุ้ง','ปลา','ข้าว','พริก','กระเทียม','หอมแดง','หอมใหญ่','ใบกะเพรา','น้ำปลา','น้ำตาล','ซอสหอยนางรม','ซีอิ๊วขาว','พริกไทย','มะนาว','ตะไคร้','ข่า','ใบมะกรูด'];

function $(s,r=document){return r.querySelector(s);}
function $all(s,r=document){return Array.from(r.querySelectorAll(s));}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function uid(){return 'r_'+Math.random().toString(16).slice(2)+Date.now().toString(16);}
function loadJson(k,fb){try{const r=localStorage.getItem(k);return r?JSON.parse(r):fb;}catch(e){return fb;}}
function saveJson(k,v){localStorage.setItem(k,JSON.stringify(v));}
function getRecipes(){const a=loadJson(STORAGE.recipes,[]);return Array.isArray(a)?a:[];}
function setRecipes(a){saveJson(STORAGE.recipes,a);scheduleOnlineUpsert(a);}
function getPantry(){const a=loadJson(STORAGE.pantry,[]);return Array.isArray(a)?a:[];}
function setPantry(a){saveJson(STORAGE.pantry,a);}
function getFavorites(){const a=loadJson(STORAGE.favorites,[]);return Array.isArray(a)?a:[];}
function setFavorites(a){saveJson(STORAGE.favorites,a);}
function getRatings(){return loadJson(STORAGE.ratings,{})||{};}
function setRating(id,v){const r=getRatings();r[id]=v;saveJson(STORAGE.ratings,r);}
function getAvgRating(id){return getRatings()[id]||0;}
function normalize(s){return String(s||'').trim().toLowerCase();}
function catLabel(k){return(CATEGORIES.find(c=>c.key===k)||{}).label||(k||'');}
function catEmoji(k){return(CATEGORIES.find(c=>c.key===k)||{}).emoji||'🍽️';}
function fmtTime(m){const n=Number(m);return n>0?`${n} นาที`:'';}

// ===== Dark mode =====
function applyTheme(t){document.documentElement.setAttribute('data-theme',t);saveJson(STORAGE.theme,t);}
function getTheme(){return loadJson(STORAGE.theme,'light');}
function toggleTheme(){applyTheme(getTheme()==='dark'?'light':'dark');const b=$('.dark-toggle');if(b)b.textContent=getTheme()==='dark'?'☀️':'🌙';}

// ===== Fuzzy search =====
function fuzzy(q,t){const a=normalize(q),b=normalize(t);return b.includes(a)||a.includes(b);}
function filterRecipes(recipes,sel,mode,nameQ,catFilter){
  let r=recipes;
  if(catFilter)r=r.filter(x=>x.category===catFilter);
  if(nameQ&&normalize(nameQ))r=r.filter(x=>normalize(x.title).includes(normalize(nameQ)));
  const s=sel.map(normalize).filter(Boolean);
  if(s.length){r=r.filter(x=>{const n=(x.ingredients||[]).map(i=>normalize(i.name));return mode==='all'?s.every(q=>n.some(t=>t.includes(q)||q.includes(t))):s.some(q=>n.some(t=>t.includes(q)||q.includes(t)));});}
  return r;
}
function sortRecipes(recipes,by){
  const r=recipes.slice();
  if(by==='time')return r.sort((a,b)=>Number(a.time||0)-Number(b.time||0));
  if(by==='rating')return r.sort((a,b)=>getAvgRating(b.id)-getAvgRating(a.id));
  if(by==='name')return r.sort((a,b)=>(a.title||'').localeCompare(b.title||'','th'));
  return r.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
}

// ===== Seed =====
function ensureSeedData(){
  const ex=loadJson(STORAGE.recipes,null);
  if(Array.isArray(ex)&&ex.length)return;
  const seed=[
    {id:'seed_kraprao',title:'ข้าวกะเพราไก่',category:'stirfry',time:15,difficulty:'ง่าย',img:'kraprao.jpg',ingredients:[{name:'ไก่',amount:'200กรัม'},{name:'ใบกะเพรา',amount:'1กำมือ'},{name:'กระเทียม',amount:'3กลีบ'},{name:'พริก',amount:'ตามชอบ'},{name:'น้ำปลา',amount:'1ช้อนโต๊ะ'},{name:'ซอสหอยนางรม',amount:'1ช้อนโต๊ะ'},{name:'น้ำตาล',amount:'1ช้อนชา'}],steps:['โขลกพริกกับกระเทียมพอหยาบ','ผัดพริกกระเทียมให้หอม ใส่ไก่ผัดจนสุก','ปรุงรสด้วยน้ำปลา ซอสหอยนางรม และน้ำตาล','ใส่ใบกะเพราผัดเร็วๆ แล้วปิดไฟ'],createdAt:Date.now()-1000*60*60*48},
    {id:'seed_omelet',title:'ไข่เจียว',category:'fried',time:10,difficulty:'ง่าย',img:'omelet.jpg',ingredients:[{name:'ไข่',amount:'2ฟอง'},{name:'น้ำปลา',amount:'1ช้อนชา'},{name:'พริกไทย',amount:'เล็กน้อย'}],steps:['ตอกไข่ ใส่น้ำปลา พริกไทย ตีให้เข้ากัน','ตั้งน้ำมันให้ร้อน เทไข่ลงทอดให้ฟู','กลับด้านสุกแล้วตักเสิร์ฟ'],createdAt:Date.now()-1000*60*60*24},
    {id:'seed_tomjeud',title:'ต้มจืดเต้าหู้หมูสับ',category:'tom',time:20,difficulty:'ปานกลาง',img:'tomjeud.jpg',ingredients:[{name:'หมูสับ',amount:'200กรัม'},{name:'เต้าหู้ไข่',amount:'1หลอด'},{name:'ผักกาดขาว',amount:'1ถ้วย'},{name:'น้ำปลา',amount:'1ช้อนโต๊ะ'},{name:'พริกไทย',amount:'เล็กน้อย'}],steps:['ปั้นหมูสับเป็นก้อนเล็กๆ','ต้มน้ำซุปให้เดือด ใส่หมูสับ ต้มจนลอย','ใส่ผักกาดขาวและเต้าหู้ ปรุงรส','ต้มต่ออีกเล็กน้อยแล้วปิดไฟ'],createdAt:Date.now()-1000*60*60*12},
    {id:'seed_tomyum',title:'ต้มยำกุ้ง',category:'tom',time:25,difficulty:'ปานกลาง',img:'tomyum.jpg',ingredients:[{name:'กุ้ง',amount:'8ตัว'},{name:'ตะไคร้',amount:'1ต้น'},{name:'ข่า',amount:'3แว่น'},{name:'ใบมะกรูด',amount:'3ใบ'},{name:'น้ำปลา',amount:'1ช้อนโต๊ะ'},{name:'มะนาว',amount:'1ลูก'}],steps:['ต้มเครื่องต้มยำให้หอม','ใส่กุ้ง ต้มจนสุก','ปรุงรสด้วยน้ำปลา ปิดไฟแล้วค่อยใส่มะนาว'],createdAt:Date.now()-1000*60*60*4}
  ];
  saveJson(STORAGE.recipes,seed);saveJson(STORAGE.pantry,[]);
}

// ===== Topbar =====
function buildTopbar(active){
  return `<div class="topbar"><div class="container topbar-inner">
    <a class="brand" href="index.html"><img src="logo.png" alt="logo"><span>ทำอะไรกินดี</span></a>
    <button class="menu-toggle" aria-label="เมนู">☰</button>
    <nav class="nav">
      <a href="index.html" class="${active==='home'?'active':''}">หน้าแรก</a>
      <a href="category.html" class="${active==='cats'?'active':''}">หมวดหมู่</a>
      <a href="add-recipe.html" class="${active==='add'?'active':''}">เพิ่มสูตร</a>
      <a href="add-ingredient.html" class="${active==='ing'?'active':''}">วัตถุดิบ</a>
      <a href="about.html" class="${active==='about'?'active':''}">เกี่ยวกับ</a>
    </nav>
    <button class="dark-toggle" onclick="window._toggleTheme()" title="สลับธีม">${getTheme()==='dark'?'☀️':'🌙'}</button>
  </div></div>`;
}
window._toggleTheme=toggleTheme;

// ===== Bottom nav =====
function buildBottomNav(active){
  const items=[{href:'index.html',icon:'🏠',label:'หน้าแรก',key:'home'},{href:'category.html',icon:'🍽️',label:'หมวดหมู่',key:'cats'},{href:'add-recipe.html',icon:'➕',label:'เพิ่มเมนู',key:'add'},{href:'favorites.html',icon:'❤️',label:'โปรด',key:'favs'},{href:'about.html',icon:'ℹ️',label:'เกี่ยวกับ',key:'about'}];
  return `<nav class="bottom-nav"><div class="bottom-nav-inner">${items.map(it=>`<a href="${it.href}" class="bnav-item ${active===it.key?'active':''}"><span class="bnav-icon">${it.icon}</span><span>${it.label}</span></a>`).join('')}</div></nav>`;
}

// ===== Recipe card =====
function recipeCard(r){
  const img=r.img||'logo.png';
  const isFav=getFavorites().includes(r.id);
  const rating=getAvgRating(r.id);
  const stars=rating>0?'⭐'.repeat(Math.round(rating)):'';
  return `<article class="card recipe-card">
    <a href="recipe.html?id=${encodeURIComponent(r.id)}">
      <div class="recipe-cover"><img src="${esc(img)}" alt="${esc(r.title)}" loading="lazy"></div>
    </a>
    <button class="fav-btn ${isFav?'active':''}" data-id="${esc(r.id)}">${isFav?'❤️':'🤍'}</button>
    <div class="recipe-body">
      <div class="recipe-title">${esc(r.title||'')}</div>
      <div class="recipe-meta">
        <span class="badge">${esc(catLabel(r.category))}</span>
        ${r.time?`<span>⏱ ${esc(fmtTime(r.time))}</span>`:''}
        ${stars?`<span>${stars}</span>`:''}
      </div>
      <div class="recipe-actions">
        <a class="btn btn-primary btn-sm" href="recipe.html?id=${encodeURIComponent(r.id)}">ดูเมนู</a>
        <a class="btn btn-ghost btn-sm" href="add-recipe.html?edit=${encodeURIComponent(r.id)}">✏️</a>
      </div>
    </div>
  </article>`;
}

function bindFavButtons(){
  $all('.fav-btn').forEach(btn=>{
    btn.addEventListener('click',(e)=>{
      e.preventDefault();e.stopPropagation();
      const id=btn.getAttribute('data-id')||'';if(!id)return;
      let f=getFavorites();
      if(f.includes(id)){f=f.filter(x=>x!==id);btn.textContent='🤍';btn.classList.remove('active');}
      else{f.push(id);btn.textContent='❤️';btn.classList.add('active');}
      setFavorites(f);
    });
  });
}

function bindMobileMenu(){
  const btn=$('.menu-toggle'),nav=$('.nav');
  if(!btn||!nav||btn.dataset.bound==='1')return;
  btn.dataset.bound='1';
  btn.addEventListener('click',()=>nav.classList.toggle('open'));
  nav.addEventListener('click',(e)=>{if(e.target?.tagName==='A')nav.classList.remove('open');});
}

// ===== Push notifications =====
async function requestNotification(){
  if(!('Notification' in window))return alert('เบราว์เซอร์ไม่รองรับการแจ้งเตือนครับ');
  const p=await Notification.requestPermission();
  if(p==='granted'){new Notification('ทำอะไรกินดี 🍳',{body:'เปิดการแจ้งเตือนสำเร็จ! จะแจ้งเตือนเมื่อมีเมนูใหม่',icon:'logo.png'});}
}

// ===== Render home =====
function renderHome(){
  const recipes=getRecipes();
  const pantry=getPantry();
  const known=uniqueIng(recipes);

  document.body.innerHTML=`
    ${buildTopbar('home')}
    <div class="container">
      <div class="hero">
        <div class="panel">
          <div class="h1">🍳 ค้นหาเมนูอาหาร</div>
          <p class="sub">พิมพ์ชื่อเมนู หรือเลือกวัตถุดิบที่มี</p>

          <div class="search-row" style="margin-bottom:8px">
            <div class="input"><span>🔎</span><input id="nameInput" type="text" placeholder="ค้นหาชื่อเมนู เช่น กะเพรา ต้มยำ..."></div>
            <button class="btn btn-primary" id="searchNameBtn">ค้นหา</button>
          </div>

          <div class="hr"></div>
          <p class="sub" style="margin-bottom:8px">ค้นหาจากวัตถุดิบที่มี</p>

          <div class="search-row-3">
            <div class="input"><span>🥕</span><input id="ingInput" type="text" placeholder="พิมพ์วัตถุดิบ เช่น ไข่ กล้วย ไก่..."></div>
            <button class="btn" id="addIngBtn">เพิ่ม</button>
            <button class="btn btn-primary" id="searchIngBtn">ค้นหาเมนู</button>
          </div>

          <div class="row mini" style="margin-top:8px">
            <span>โหมด:</span>
            <label class="chip" style="cursor:pointer;font-size:12px;padding:5px 10px"><input type="radio" name="mode" value="any" checked style="margin-right:6px">มีบางอย่างก็ได้</label>
            <label class="chip" style="cursor:pointer;font-size:12px;padding:5px 10px"><input type="radio" name="mode" value="all" style="margin-right:6px">ต้องมีครบ</label>
            <button class="btn btn-ghost btn-sm" id="clearBtn">ล้าง</button>
          </div>

          <div class="chips" id="selChips"></div>

          <div class="section">
            <h2>วัตถุดิบที่ใช้บ่อย</h2>
            <div class="cloud-wrap" id="cloudWrap"><div class="ingredients-cloud" id="cloud"></div></div>
            <div class="center" style="margin-top:8px"><button class="btn btn-ghost btn-sm" id="toggleCloud">แสดงเพิ่ม</button></div>
          </div>
        </div>

        <div class="section">
          <h2>หมวดหมู่อาหาร</h2>
          <div class="grid-cats">
            ${CATEGORIES.map(c=>{const cnt=recipes.filter(r=>r.category===c.key).length;return`<div class="card cat"><a href="category.html?cat=${encodeURIComponent(c.key)}" style="display:block"><span class="cat-emoji">${c.emoji}</span><b>${esc(c.label)}</b><span>${esc(c.desc)}</span><span class="cat-count">${cnt} เมนู</span></a><button class="cat-add-btn" data-cat="${esc(c.key)}" title="เพิ่มเมนูในหมวดนี้">+</button></div>`;}).join('')}
          </div>
        </div>

        <div class="section">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px">
            <h2 style="margin:0">เมนูแนะนำ</h2>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <div class="tab-row">
                <button class="tab-btn active" data-tab="all">ทั้งหมด</button>
                <button class="tab-btn" data-tab="favs">❤️ โปรด</button>
              </div>
              <select class="sort-select" id="sortSel">
                <option value="new">ใหม่สุด</option>
                <option value="rating">คะแนนสูง</option>
                <option value="time">เวลาน้อย</option>
                <option value="name">ชื่อ ก-ฮ</option>
              </select>
            </div>
          </div>
          <div class="recipes" id="recipeList">
            ${sortRecipes(recipes,'new').slice(0,12).map(recipeCard).join('')}
          </div>
        </div>
      </div>
    </div>
    ${buildBottomNav('home')}
  `;

  bindMobileMenu();bindFavButtons();

  // Cat add buttons
  $all('.cat-add-btn').forEach(b=>b.addEventListener('click',(e)=>{e.preventDefault();e.stopPropagation();location.href=`add-recipe.html?cat=${b.getAttribute('data-cat')||''}`;}));

  // Tabs
  let currentTab='all';
  $all('.tab-btn').forEach(b=>b.addEventListener('click',()=>{
    $all('.tab-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');
    currentTab=b.getAttribute('data-tab');renderList();
  }));

  // Sort
  $('#sortSel')?.addEventListener('change',()=>renderList());

  function renderList(filtered){
    const list=$('#recipeList');if(!list)return;
    const by=$('#sortSel')?.value||'new';
    let r=filtered;
    if(!r){
      if(currentTab==='favs'){const f=getFavorites();r=recipes.filter(x=>f.includes(x.id));}
      else r=recipes.slice(0,30);
    }
    r=sortRecipes(r,by);
    if(!r.length){list.innerHTML=`<div class="empty-state"><div class="empty-icon">${currentTab==='favs'?'❤️':'🍽️'}</div><p>${currentTab==='favs'?'ยังไม่มีเมนูโปรด กดหัวใจ ❤️ บนการ์ดเพื่อบันทึก':'ไม่พบเมนูที่ตรงกัน'}</p></div>`;return;}
    list.innerHTML=r.slice(0,30).map(recipeCard).join('');bindFavButtons();
  }

  // Ingredient logic
  let selected=pantry.slice();

  function renderSel(){
    const w=$('#selChips');if(!w)return;
    if(!selected.length){w.innerHTML='';return;}
    w.innerHTML=selected.map(n=>`<span class="chip" data-n="${esc(n)}">${esc(n)} <span class="chip-x">×</span></span>`).join('');
    $all('.chip',w).forEach(c=>c.addEventListener('click',()=>{selected=selected.filter(x=>normalize(x)!==normalize(c.getAttribute('data-n')||''));setPantry(selected);renderSel();}));
  }

  function addIng(){
    const i=$('#ingInput'),v=String(i?.value||'').trim();if(!v)return;
    if(!selected.some(x=>normalize(x)===normalize(v))){selected.push(v);setPantry(selected);}
    if(i)i.value='';renderSel();
  }

  function renderCloud(){
    const c=$('#cloud');if(!c)return;
    const ss=new Set(selected.map(normalize));
    const ord=[];const seen=new Set();
    for(const x of selected)if(!seen.has(normalize(x))){ord.push(x);seen.add(normalize(x));}
    for(const x of known)if(!seen.has(normalize(x))){ord.push(x);seen.add(normalize(x));}
    c.innerHTML=ord.map(n=>`<button class="chip ${ss.has(normalize(n))?'active':''}" data-ing="${esc(n)}" type="button" style="${ss.has(normalize(n))?'border-color:var(--accent);color:var(--accent);':''}">${esc(n)}</button>`).join('');
    $all('button.chip',c).forEach(b=>b.addEventListener('click',()=>{const n=b.getAttribute('data-ing')||'';if(!n)return;if(!selected.some(x=>normalize(x)===normalize(n))){selected.push(n);setPantry(selected);renderSel();renderCloud();}}));
  }

  function doSearch(nameQ){
    const mode=$('input[name="mode"]:checked')?.value||'any';
    const q=nameQ!==undefined?nameQ:($('#nameInput')?.value||'');
    const filtered=filterRecipes(recipes,selected,mode,q,'');
    renderList(filtered);
  }

  $('#addIngBtn')?.addEventListener('click',addIng);
  $('#ingInput')?.addEventListener('keydown',(e)=>{if(e.key==='Enter'){e.preventDefault();addIng();}});
  $('#ingInput')?.addEventListener('input',()=>{/* real-time not needed here */});
  $('#searchIngBtn')?.addEventListener('click',()=>doSearch(''));
  $('#searchNameBtn')?.addEventListener('click',()=>doSearch($('#nameInput')?.value||''));
  $('#nameInput')?.addEventListener('input',()=>{const q=$('#nameInput')?.value||'';if(q.length>=2||q.length===0)doSearch(q);});
  $('#nameInput')?.addEventListener('keydown',(e)=>{if(e.key==='Enter'){e.preventDefault();doSearch($('#nameInput')?.value||'');}});
  $('#clearBtn')?.addEventListener('click',()=>{
    selected=[];setPantry([]);
    const ni=$('#nameInput');if(ni)ni.value='';
    const ii=$('#ingInput');if(ii)ii.value='';
    renderSel();renderCloud();renderList();
  });
  $('#toggleCloud')?.addEventListener('click',()=>{
    const w=$('#cloudWrap');if(!w)return;
    w.classList.toggle('expanded');
    $('#toggleCloud').textContent=w.classList.contains('expanded')?'ซ่อน':'แสดงเพิ่ม';
  });
  renderSel();renderCloud();
}

function uniqueIng(recipes){
  const s=new Set(COMMON_INGREDIENTS.map(x=>x.trim()));
  for(const r of recipes)for(const it of(r.ingredients||[]))if(it?.name)s.add(String(it.name).trim());
  return Array.from(s).filter(Boolean);
}

function parseQuery(){const q=new URLSearchParams(location.search);const o={};for(const[k,v]of q.entries())o[k]=v;return o;}

// ===== Render favorites =====
function renderFavorites(){
  const recipes=getRecipes();
  const favIds=getFavorites();
  const favRecipes=recipes.filter(r=>favIds.includes(r.id));

  document.body.innerHTML=`
    ${buildTopbar('favs')}
    <div class="container"><div class="hero">
      <div class="panel">
        <div class="h1">❤️ เมนูโปรด</div>
        <p class="sub">เมนูที่คุณกดหัวใจไว้ทั้งหมด</p>
        ${favRecipes.length?`
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
          <select class="sort-select" id="favSortSel">
            <option value="new">ล่าสุด</option>
            <option value="rating">คะแนนสูง</option>
            <option value="time">เวลาน้อย</option>
            <option value="name">ชื่อ ก-ฮ</option>
          </select>
        </div>`:''}
      </div>
      <div class="section">
        <div class="recipes" id="favList">
          ${favRecipes.length
            ? sortRecipes(favRecipes,'new').map(recipeCard).join('')
            : `<div class="empty-state"><div class="empty-icon">❤️</div><p>ยังไม่มีเมนูโปรด<br>กดหัวใจ 🤍 บนการ์ดเมนูเพื่อบันทึก</p></div>`
          }
        </div>
      </div>
    </div></div>
    ${buildBottomNav('favs')}
  `;

  bindMobileMenu();bindFavButtons();

  $('#favSortSel')?.addEventListener('change',()=>{
    const by=$('#favSortSel')?.value||'new';
    const f=getFavorites();
    const r=sortRecipes(recipes.filter(x=>f.includes(x.id)),by);
    const list=$('#favList');
    if(list){list.innerHTML=r.map(recipeCard).join('');bindFavButtons();}
  });
}

// ===== Render category (with ingredient search) =====
function renderCategory(){
  const recipes=getRecipes();
  const q=parseQuery();
  const cat=q.cat||'';
  const catInfo=cat?CATEGORIES.find(c=>c.key===cat):null;
  const title=catInfo?`${catInfo.emoji} หมวด${catInfo.label}`:'🍽️ เมนูทั้งหมด';

  document.body.innerHTML=`
    ${buildTopbar('cats')}
    <div class="container">
      <div class="hero">
        <div class="panel">
          <div class="h1">${title}</div>
          ${cat?`
          <div class="search-row" style="margin:10px auto 6px">
            <div class="input"><span>🔎</span><input id="catSearch" type="text" placeholder="ค้นหาชื่อเมนูในหมวด${catInfo?catInfo.label:'นี้'}..."></div>
            <button class="btn btn-primary btn-sm" id="catSearchBtn">ค้นหา</button>
          </div>
          <div class="search-row" style="margin:0 auto 8px">
            <div class="input"><span>🥕</span><input id="catIngSearch" type="text" placeholder="ค้นหาจากวัตถุดิบ เช่น ไข่ ไก่..."></div>
            <button class="btn btn-ghost btn-sm" id="catIngAddBtn">เพิ่ม</button>
          </div>
          <div class="chips" id="catIngChips"></div>
          <div class="row mini" style="margin-top:8px">
            <span>โหมด:</span>
            <label class="chip" style="cursor:pointer;font-size:12px;padding:5px 10px"><input type="radio" name="catmode" value="any" checked style="margin-right:6px">มีบางอย่างก็ได้</label>
            <label class="chip" style="cursor:pointer;font-size:12px;padding:5px 10px"><input type="radio" name="catmode" value="all" style="margin-right:6px">ต้องมีครบ</label>
            <button class="btn btn-ghost btn-sm" id="catClearBtn">ล้าง</button>
          </div>
          `:''}
          <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:10px">
            <a class="btn btn-primary btn-sm" href="add-recipe.html${cat?`?cat=${encodeURIComponent(cat)}`:''}">+ เพิ่มเมนู${catInfo?`ใน${catInfo.label}`:''}</a>
            ${cat?`<a class="btn btn-ghost btn-sm" href="category.html">← ดูทุกหมวด</a>`:''}
          </div>
        </div>

        ${!cat?`
        <div class="section">
          <h2>เลือกหมวดหมู่</h2>
          <div class="grid-cats">
            ${CATEGORIES.map(c=>{const cnt=recipes.filter(r=>r.category===c.key).length;return`<div class="card cat"><a href="category.html?cat=${encodeURIComponent(c.key)}" style="display:block"><span class="cat-emoji">${c.emoji}</span><b>${esc(c.label)}</b><span>${esc(c.desc)}</span><span class="cat-count">${cnt} เมนู</span></a><button class="cat-add-btn" data-cat="${esc(c.key)}">+</button></div>`;}).join('')}
          </div>
        </div>`:''}

        <div class="section">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px">
            <h2 style="margin:0">เมนูทั้งหมด</h2>
            <select class="sort-select" id="catSortSel">
              <option value="new">ใหม่สุด</option>
              <option value="rating">คะแนนสูง</option>
              <option value="time">เวลาน้อย</option>
              <option value="name">ชื่อ ก-ฮ</option>
            </select>
          </div>
          <div class="recipes" id="catList">
            ${sortRecipes(recipes.filter(r=>!cat||r.category===cat),'new').map(recipeCard).join('')||`<div class="empty-state"><div class="empty-icon">${catInfo?catInfo.emoji:'🍽️'}</div><p>ยังไม่มีเมนูในหมวดนี้</p></div>`}
          </div>
        </div>
      </div>
    </div>
    ${buildBottomNav('cats')}
  `;

  bindMobileMenu();bindFavButtons();

  $all('.cat-add-btn').forEach(b=>b.addEventListener('click',(e)=>{e.preventDefault();e.stopPropagation();location.href=`add-recipe.html?cat=${b.getAttribute('data-cat')||''}`;}));

  // Ingredient chips for category search
  let catIngSel=[];
  function renderCatIngChips(){
    const w=$('#catIngChips');if(!w)return;
    if(!catIngSel.length){w.innerHTML='';return;}
    w.innerHTML=catIngSel.map(n=>`<span class="chip" data-n="${esc(n)}">${esc(n)} <span class="chip-x">×</span></span>`).join('');
    $all('.chip',w).forEach(c=>c.addEventListener('click',()=>{catIngSel=catIngSel.filter(x=>normalize(x)!==normalize(c.getAttribute('data-n')||''));renderCatIngChips();renderCatList();}));
  }

  function addCatIng(){
    const i=$('#catIngSearch'),v=String(i?.value||'').trim();if(!v)return;
    if(!catIngSel.some(x=>normalize(x)===normalize(v))){catIngSel.push(v);}
    if(i)i.value='';renderCatIngChips();renderCatList();
  }

  function renderCatList(){
    const list=$('#catList');if(!list)return;
    const by=$('#catSortSel')?.value||'new';
    const nameQ=$('#catSearch')?.value||'';
    const mode=$('input[name="catmode"]:checked')?.value||'any';
    let r=filterRecipes(recipes,catIngSel,mode,nameQ,cat);
    r=sortRecipes(r,by);
    if(!r.length){list.innerHTML=`<div class="empty-state"><div class="empty-icon">🔍</div><p>ไม่พบเมนูที่ตรงกัน</p></div>`;return;}
    list.innerHTML=r.map(recipeCard).join('');bindFavButtons();
  }

  $('#catSortSel')?.addEventListener('change',()=>renderCatList());
  $('#catSearchBtn')?.addEventListener('click',()=>renderCatList());
  $('#catSearch')?.addEventListener('input',()=>renderCatList());
  $('#catSearch')?.addEventListener('keydown',(e)=>{if(e.key==='Enter'){e.preventDefault();renderCatList();}});
  $('#catIngAddBtn')?.addEventListener('click',addCatIng);
  $('#catIngSearch')?.addEventListener('keydown',(e)=>{if(e.key==='Enter'){e.preventDefault();addCatIng();}});
  $('#catClearBtn')?.addEventListener('click',()=>{catIngSel=[];const cs=$('#catSearch');if(cs)cs.value='';renderCatIngChips();renderCatList();});
  $all('input[name="catmode"]').forEach(r=>r.addEventListener('change',()=>renderCatList()));
}

// ===== Render about =====
function renderAbout(){
  const notifGranted='Notification' in window && Notification.permission==='granted';
  document.body.innerHTML=`
    ${buildTopbar('about')}
    <div class="container"><div class="hero">

      <div class="panel" style="margin-bottom:14px">
        <div class="h1">🍳 ทำอะไรกินดี</div>
        <p class="sub">แอพรวมสูตรอาหารไทย ค้นหาเมนูจากวัตถุดิบที่มีในบ้าน</p>
      </div>

      <div class="card" style="margin-bottom:14px">
        <div style="font-size:17px;font-weight:900;margin-bottom:12px">📖 วิธีใช้งาน</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${[
            ['🔎','ค้นหาชื่อเมนู','พิมพ์ชื่อเมนูในช่องค้นหา เช่น "กะเพรา" "ต้มยำ" ผลขึ้นทันที'],
            ['🥕','ค้นหาจากวัตถุดิบ','พิมพ์วัตถุดิบที่มี เช่น "ไข่" "ไก่" พิมพ์ "กล้วย" ก็เจอ "กล้วยน้ำว้า" ได้'],
            ['🍽️','ค้นหาในหมวดหมู่','เข้าหมวดทอด/ต้ม/ผัด แล้วค้นชื่อเมนูหรือวัตถุดิบเฉพาะหมวดได้เลย'],
            ['❤️','บันทึกเมนูโปรด','กดหัวใจบนการ์ดเมนู ดูทั้งหมดได้ที่แท็บ "โปรด" ด้านล่าง'],
            ['⭐','ให้คะแนนเมนู','กดดาว 1-5 ในหน้ารายละเอียด เรียงตามคะแนนได้'],
            ['⏱️','จับเวลาขั้นตอน','กด "จับเวลา" ข้างแต่ละขั้นตอนในหน้าวิธีทำ'],
            ['🧮','ปรับจำนวนคน','กด +/− ในหน้าวัตถุดิบ ปริมาณปรับตามอัตโนมัติ'],
            ['📸','เพิ่มสูตรอาหาร','กด "เพิ่มเมนู" ใส่ชื่อ วัตถุดิบ วิธีทำ และอัปโหลดรูปจากมือถือได้เลย'],
          ].map(([icon,title,desc])=>`
            <div style="display:flex;gap:10px;align-items:flex-start">
              <span style="font-size:22px;min-width:32px">${icon}</span>
              <div><b style="font-size:14px">${title}</b><br><span style="font-size:13px;color:var(--muted)">${desc}</span></div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="card" style="margin-bottom:14px">
        <div style="font-size:17px;font-weight:900;margin-bottom:12px">⚙️ การทำงานของแอพ</div>
        <div style="display:flex;flex-direction:column;gap:8px;font-size:14px">
          ${[
            ['Cloud (Supabase)','สูตรอาหารที่เพิ่มจะแชร์ให้ทุกคนเห็นร่วมกัน'],
            ['เมนูโปรดและคะแนน','เก็บบนเครื่องของคุณ ไม่หายแม้ปิดแอพ'],
            ['ใช้งาน Offline ได้','หลังโหลดครั้งแรก ใช้ได้แม้ไม่มีเน็ต (PWA)'],
            ['ติดตั้งเป็นแอพได้','กด "Add to Home Screen" บนมือถือเพื่อใช้เหมือนแอพจริง'],
            ['Dark Mode','กดปุ่ม 🌙 มุมขวาบนเพื่อสลับธีม'],
          ].map(([t,d])=>`
            <div style="display:flex;gap:8px;align-items:flex-start">
              <span style="width:8px;height:8px;border-radius:50%;background:var(--accent);flex-shrink:0;margin-top:5px;display:inline-block"></span>
              <span><b>${t}</b> — ${d}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="card" style="margin-bottom:14px">
        <div style="font-size:17px;font-weight:900;margin-bottom:4px">📬 ติดต่อเรา</div>
        <p style="font-size:13px;color:var(--muted);margin-bottom:14px">มีข้อเสนอแนะ พบบั๊ก หรืออยากแนะนำฟีเจอร์ใหม่? ส่งข้อความมาได้เลยครับ 😊</p>

        <div class="field" style="margin-bottom:10px">
          <label>ชื่อของคุณ</label>
          <input id="contactName" type="text" placeholder="เช่น คุณสมชาย">
        </div>
        <div class="field" style="margin-bottom:10px">
          <label>หัวข้อ</label>
          <select id="contactTopic">
            <option value="แนะนำฟีเจอร์">💡 แนะนำฟีเจอร์</option>
            <option value="แจ้งบั๊ก">🐛 แจ้งบั๊ก</option>
            <option value="ข้อเสนอแนะ">💬 ข้อเสนอแนะทั่วไป</option>
            <option value="สอบถาม">❓ สอบถาม</option>
          </select>
        </div>
        <div class="field" style="margin-bottom:14px">
          <label>ข้อความ</label>
          <textarea id="contactMsg" placeholder="พิมพ์ข้อความของคุณที่นี่..." style="min-height:100px"></textarea>
        </div>

        <div id="contactResult" style="display:none;background:var(--accent-light);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:12px;font-size:13px;font-weight:700;color:var(--accent-dark)"></div>

        <button class="btn btn-primary" id="contactSendBtn" style="width:100%;justify-content:center;padding:14px">
          💬 ส่งข้อความผ่าน Line
        </button>
      </div>

      <div class="card">
        <div style="font-size:17px;font-weight:900;margin-bottom:8px">🔔 การแจ้งเตือน</div>
        <p style="font-size:13px;color:var(--muted);margin-bottom:12px">เปิดรับการแจ้งเตือนเพื่อรับข่าวสารและเมนูใหม่</p>
        <button class="btn ${notifGranted?'btn-ghost':'btn-primary'}" id="notifBtn" style="width:100%;justify-content:center">
          ${notifGranted?'✅ เปิดการแจ้งเตือนแล้ว':'🔔 เปิดการแจ้งเตือน'}
        </button>
      </div>

    </div></div>
    ${buildBottomNav('about')}
  `;

  bindMobileMenu();

  // Contact form → copy message → open Line
  $('#contactSendBtn')?.addEventListener('click',()=>{
    const name=String($('#contactName')?.value||'').trim()||'ไม่ระบุชื่อ';
    const topic=$('#contactTopic')?.value||'ข้อเสนอแนะ';
    const msg=String($('#contactMsg')?.value||'').trim();
    if(!msg){alert('กรุณาพิมพ์ข้อความก่อนนะครับ');return;}

    const fullMsg=`[ทำอะไรกินดี]\nชื่อ: ${name}\nหัวข้อ: ${topic}\nข้อความ: ${msg}`;

    // Copy to clipboard
    navigator.clipboard?.writeText(fullMsg).then(()=>{
      showResult();
    }).catch(()=>{
      // Fallback copy
      const ta=document.createElement('textarea');ta.value=fullMsg;
      document.body.appendChild(ta);ta.select();document.execCommand('copy');
      document.body.removeChild(ta);showResult();
    });

    function showResult(){
      const r=$('#contactResult');
      if(r){r.style.display='block';r.innerHTML='✅ คัดลอกข้อความแล้ว! Line จะเปิดขึ้น กด <b>วาง (Paste)</b> แล้วกดส่งได้เลยครับ';}
      setTimeout(()=>{ window.open('https://line.me/ti/p/uVO4q3ue0W','_blank'); },600);
    }
  });

  $('#notifBtn')?.addEventListener('click',async()=>{
    await requestNotification();
    const b=$('#notifBtn');
    if(b&&Notification.permission==='granted'){b.textContent='✅ เปิดการแจ้งเตือนแล้ว';b.classList.remove('btn-primary');b.classList.add('btn-ghost');}
  });
}

// ===== Render add ingredient =====
function renderAddIngredient(){
  const pantry=getPantry();
  document.body.innerHTML=`
    ${buildTopbar('ing')}
    <div class="container"><div class="hero">
      <div class="panel">
        <div class="h1">🥕 เพิ่มวัตถุดิบที่มี</div>
        <p class="sub">วัตถุดิบที่เพิ่มจะใช้ค้นหาเมนูในหน้าแรก</p>
        <div class="search-row-3" style="max-width:720px">
          <div class="input"><span>➕</span><input id="pantryInput" type="text" placeholder="พิมพ์วัตถุดิบ เช่น ไข่ ไก่ หมูสับ..."></div>
          <button class="btn btn-primary" id="pantryAddBtn">เพิ่ม</button>
          <a class="btn" href="index.html">กลับ</a>
        </div>
        <div class="chips" id="pantryChips"></div>
      </div>
    </div></div>
    ${buildBottomNav('ing')}
  `;
  bindMobileMenu();
  let sel=pantry.slice();
  function render(){
    const w=$('#pantryChips');
    w.innerHTML=sel.map(n=>`<span class="chip" data-n="${esc(n)}">${esc(n)} <span class="chip-x">×</span></span>`).join('');
    $all('.chip',w).forEach(c=>c.addEventListener('click',()=>{sel=sel.filter(x=>normalize(x)!==normalize(c.getAttribute('data-n')||''));setPantry(sel);render();}));
  }
  function add(){const i=$('#pantryInput'),v=String(i?.value||'').trim();if(!v)return;if(!sel.some(x=>normalize(x)===normalize(v))){sel.push(v);setPantry(sel);}if(i)i.value='';render();}
  $('#pantryAddBtn')?.addEventListener('click',add);
  $('#pantryInput')?.addEventListener('keydown',(e)=>{if(e.key==='Enter'){e.preventDefault();add();}});
  render();
}

// ===== Render add recipe (with image upload) =====
function renderAddRecipe(){
  const recipes=getRecipes();
  const q=parseQuery();
  const editId=q.edit||'';
  const defaultCat=q.cat||'tom';
  const editing=editId?recipes.find(r=>r.id===editId):null;
  const model=editing||{id:'',title:'',category:defaultCat,time:15,difficulty:'ง่าย',img:'',ingredients:[{name:'',amount:''}],steps:['']};

  document.body.innerHTML=`
    ${buildTopbar('add')}
    <div class="container"><div class="hero">
      <div class="panel">
        <div class="h1">${editing?'✏️ แก้ไขสูตรอาหาร':'➕ เพิ่มสูตรอาหาร'}</div>
      </div>
      <form class="panel form" id="recipeForm">
        <div class="form-grid">
          <div class="field"><label>ชื่อเมนู</label><input id="title" required value="${esc(model.title||'')}" placeholder="เช่น ต้มยำกุ้ง"></div>
          <div class="field"><label>หมวดหมู่</label><select id="category">${CATEGORIES.map(c=>`<option value="${c.key}" ${model.category===c.key?'selected':''}>${c.emoji} ${esc(c.label)}</option>`).join('')}</select></div>
          <div class="field"><label>เวลาทำ (นาที)</label><input id="time" type="number" min="1" value="${esc(String(model.time||15))}"></div>
          <div class="field"><label>ความยาก</label><select id="difficulty">${['ง่าย','ปานกลาง','ยาก'].map(x=>`<option value="${x}" ${model.difficulty===x?'selected':''}>${x}</option>`).join('')}</select></div>
          <div class="field" style="grid-column:1/-1">
            <label>รูปภาพ</label>
            <div class="img-upload-area" id="uploadArea">
              <div id="uploadPrompt">📸 กดเพื่อเลือกรูป หรือลาก/วางรูปที่นี่</div>
              ${model.img?`<img class="img-preview" id="imgPreview" src="${esc(model.img)}" alt="preview">`:'<img class="img-preview" id="imgPreview" style="display:none" alt="preview">'}
              <input type="file" id="imgFile" accept="image/*" style="display:none">
            </div>
            <input id="imgUrl" placeholder="หรือวาง URL รูปภาพ เช่น https://..." value="${esc(model.img&&!model.img.startsWith('data:')?model.img:'')}" style="margin-top:8px;width:100%;padding:10px 14px;border-radius:12px;border:1.5px solid var(--border);background:var(--surface);font-size:14px;outline:none;color:var(--text);font-family:var(--font)">
            <input type="hidden" id="imgFinal" value="${esc(model.img||'')}">
          </div>
        </div>
        <div class="hr"></div>
        <div class="field">
          <label>วัตถุดิบ + ปริมาณ</label>
          <div id="ingList"></div>
          <button type="button" class="btn btn-ghost btn-sm" id="addIngRow" style="margin-top:4px">+ เพิ่มวัตถุดิบ</button>
        </div>
        <div class="hr"></div>
        <div class="field">
          <label>วิธีทำ (1 บรรทัดต่อ 1 ขั้นตอน)</label>
          <textarea id="steps" placeholder="1) ...\n2) ...">${esc((model.steps||[]).join('\n'))}</textarea>
        </div>
        <div class="form-actions">
          <a class="btn" href="index.html">ยกเลิก</a>
          ${editing?`<button type="button" class="btn btn-ghost" id="deleteBtn" style="color:#c0392b">🗑️ ลบเมนู</button>`:''}
          <button class="btn btn-primary" type="submit">${editing?'💾 บันทึกแก้ไข':'✅ บันทึกเมนู'}</button>
        </div>
      </form>
    </div></div>
    ${buildBottomNav('add')}
  `;

  bindMobileMenu();

  // Image upload
  const uploadArea=$('#uploadArea'),imgFile=$('#imgFile'),imgPreview=$('#imgPreview'),imgFinal=$('#imgFinal'),imgUrl=$('#imgUrl');
  uploadArea?.addEventListener('click',()=>imgFile?.click());
  imgFile?.addEventListener('change',()=>{
    const f=imgFile.files[0];if(!f)return;
    const reader=new FileReader();
    reader.onload=(e)=>{const d=e.target.result;imgFinal.value=d;imgPreview.src=d;imgPreview.style.display='block';imgUrl.value='';};
    reader.readAsDataURL(f);
  });
  imgUrl?.addEventListener('input',()=>{const u=imgUrl.value.trim();if(u){imgFinal.value=u;imgPreview.src=u;imgPreview.style.display='block';}});
  uploadArea?.addEventListener('dragover',(e)=>{e.preventDefault();uploadArea.style.borderColor='var(--accent)';});
  uploadArea?.addEventListener('dragleave',()=>{uploadArea.style.borderColor='';});
  uploadArea?.addEventListener('drop',(e)=>{
    e.preventDefault();uploadArea.style.borderColor='';
    const f=e.dataTransfer?.files?.[0];if(!f||!f.type.startsWith('image/'))return;
    const reader=new FileReader();
    reader.onload=(ev)=>{const d=ev.target.result;imgFinal.value=d;imgPreview.src=d;imgPreview.style.display='block';};
    reader.readAsDataURL(f);
  });

  // Ingredients
  const ingList=$('#ingList');
  let ingRows=(model.ingredients?.length)?model.ingredients.map(x=>({name:x.name||'',amount:x.amount||''})):[{name:'',amount:''}];
  function renderIng(){
    ingList.innerHTML=ingRows.map((row,i)=>`<div class="ing-row" data-i="${i}"><input class="ing-name" placeholder="วัตถุดิบ เช่น ไข่" value="${esc(row.name)}" style="border-radius:12px;border:1.5px solid var(--border);padding:10px 12px;font-size:14px;outline:none;font-family:var(--font);background:var(--surface);color:var(--text)"><input class="ing-amt" placeholder="ปริมาณ เช่น 2 ฟอง" value="${esc(row.amount)}" style="border-radius:12px;border:1.5px solid var(--border);padding:10px 12px;font-size:14px;outline:none;font-family:var(--font);background:var(--surface);color:var(--text)"><button class="btn btn-ghost btn-sm ing-del" type="button">ลบ</button></div>`).join('');
    $all('.ing-row',ingList).forEach(el=>{const i=Number(el.getAttribute('data-i'));$('.ing-name',el).addEventListener('input',(e)=>ingRows[i].name=e.target.value);$('.ing-amt',el).addEventListener('input',(e)=>ingRows[i].amount=e.target.value);$('.ing-del',el).addEventListener('click',()=>{ingRows.splice(i,1);if(!ingRows.length)ingRows=[{name:'',amount:''}];renderIng();});});
  }
  $('#addIngRow')?.addEventListener('click',()=>{ingRows.push({name:'',amount:''});renderIng();});

  if(editing){$('#deleteBtn')?.addEventListener('click',(e)=>{e.preventDefault();if(!confirm('ต้องการลบเมนูนี้ใช่ไหม?'))return;setRecipes(recipes.filter(r=>r.id!==editing.id));onlineDeleteRecipe(editing.id);location.href='index.html';});}

  $('#recipeForm')?.addEventListener('submit',async(e)=>{
    e.preventDefault();
    const title=$('#title').value.trim();if(!title){alert('กรุณาใส่ชื่อเมนู');return;}
    const rec={id:editing?editing.id:uid(),title,category:$('#category').value,time:Number($('#time').value||0),difficulty:$('#difficulty').value,img:$('#imgFinal').value.trim(),ingredients:ingRows.map(x=>({name:String(x.name||'').trim(),amount:String(x.amount||'').trim()})).filter(x=>x.name),steps:String($('#steps').value||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean),createdAt:editing?(editing.createdAt||Date.now()):Date.now()};
    const next=recipes.slice(),idx=next.findIndex(r=>r.id===rec.id);
    if(idx>=0)next[idx]=rec;else next.push(rec);
    setRecipes(next);
    if(ONLINE.enabled&&supabaseClient){try{const{error}=await supabaseClient.from('recipes').upsert([toRow(rec)],{onConflict:'id'});if(error)throw error;}catch(err){console.warn('upsert:',err);}}
    location.href=`recipe.html?id=${encodeURIComponent(rec.id)}`;
  });
  renderIng();
}

// ===== Render recipe detail (timer + serving calc + share) =====
function renderRecipeDetail(){
  const recipes=getRecipes();
  const q=parseQuery();
  const id=q.id||'';
  const rec=recipes.find(r=>r.id===id);

  if(!rec){
    document.body.innerHTML=`${buildTopbar('')}<div class="container"><div class="hero"><div class="panel"><div class="h1">ไม่พบเมนูนี้</div><p class="sub">อาจถูกลบหรือยังไม่ได้สร้าง</p><a class="btn btn-primary" href="index.html">กลับหน้าแรก</a></div></div></div>${buildBottomNav('')}`;
    bindMobileMenu();return;
  }

  const img=rec.img||'logo.png';
  const isFav=getFavorites().includes(rec.id);
  const myRating=getAvgRating(rec.id);
  let baseServing=2;

  function starsHtml(cur){return[1,2,3,4,5].map(i=>`<button class="star-btn" data-val="${i}">${i<=cur?'⭐':'☆'}</button>`).join('');}

  function ingHtml(serving){
    const ratio=serving/baseServing;
    return(rec.ingredients||[]).map(it=>{
      const amtStr=it.amount||'';
      const numMatch=amtStr.match(/[\d.]+/);
      let displayAmt=amtStr;
      if(numMatch&&serving!==baseServing){
        const orig=parseFloat(numMatch[0]);
        const newVal=orig*ratio;
        const rounded=Number.isInteger(newVal)?newVal:Math.round(newVal*10)/10;
        displayAmt=amtStr.replace(numMatch[0],String(rounded));
      }
      return`<li>${esc(it.name)}${displayAmt?` — <span style="color:var(--muted)">${esc(displayAmt)}</span>`:''}</li>`;
    }).join('')||'<li>—</li>';
  }

  document.body.innerHTML=`
    ${buildTopbar('')}
    <div class="container"><div class="detail">
      <div class="detail-top">
        <div class="detail-cover"><img src="${esc(img)}" alt="${esc(rec.title)}"></div>
        <div class="detail-side"><div class="card">
          <div class="recipe-title" style="font-size:20px;margin-bottom:8px">${esc(rec.title)}</div>
          <div class="recipe-meta" style="margin-bottom:10px">
            <span class="badge">${esc(catLabel(rec.category))}</span>
            ${rec.time?`<span>⏱ ${esc(fmtTime(rec.time))}</span>`:''}
            ${rec.difficulty?`<span>📊 ${esc(rec.difficulty)}</span>`:''}
          </div>
          <div class="hr"></div>
          <div style="margin-bottom:8px">
            <div style="font-size:13px;color:var(--muted);font-weight:700;margin-bottom:6px">ให้คะแนน</div>
            <div class="stars" id="starRow">${starsHtml(myRating)}</div>
          </div>
          <div class="hr"></div>
          <div class="share-bar">
            <button class="btn ${isFav?'btn-primary':'btn-ghost'} btn-sm" id="favBtn">${isFav?'❤️ อยู่ในโปรด':'🤍 เพิ่มในโปรด'}</button>
            <button class="btn btn-ghost btn-sm" id="shareBtn">📤 แชร์</button>
          </div>
          <div class="hr"></div>
          <div class="row">
            <a class="btn btn-ghost btn-sm" href="add-recipe.html?edit=${encodeURIComponent(rec.id)}">✏️ แก้ไข</a>
            <a class="btn btn-sm" href="category.html?cat=${encodeURIComponent(rec.category)}">ดูหมวดนี้</a>
          </div>
        </div></div>
      </div>

      <div class="section"><div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px">
          <h2 style="text-align:left;margin:0;font-size:17px">🥕 วัตถุดิบ</h2>
          <div class="serving-row">
            <button class="serving-btn" id="servDn">−</button>
            <span class="serving-num" id="servNum">2</span>
            <span style="font-size:13px;color:var(--muted);font-weight:700">คน</span>
            <button class="serving-btn" id="servUp">+</button>
          </div>
        </div>
        <ul class="list" id="ingListDetail">${ingHtml(2)}</ul>
      </div></div>

      <div class="section"><div class="card">
        <h2 style="text-align:left;margin:0 0 8px;font-size:17px">👨‍🍳 วิธีทำ</h2>
        <div id="stepsList">
          ${(rec.steps||[]).map((s,i)=>`
            <div class="step-item">
              <div class="step-num">${i+1}</div>
              <div class="step-text">${esc(s)}</div>
              <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
                <button class="timer-btn" data-idx="${i}" data-running="0">⏱ จับเวลา</button>
                <span class="timer-display" id="timerDisp_${i}"></span>
              </div>
            </div>
          `).join('')||'<p>—</p>'}
        </div>
      </div></div>
    </div></div>
    ${buildBottomNav('')}
  `;

  bindMobileMenu();

  // Serving calc
  let curServing=2;
  $('#servUp')?.addEventListener('click',()=>{if(curServing<20){curServing++;$('#servNum').textContent=curServing;$('#ingListDetail').innerHTML=ingHtml(curServing);}});
  $('#servDn')?.addEventListener('click',()=>{if(curServing>1){curServing--;$('#servNum').textContent=curServing;$('#ingListDetail').innerHTML=ingHtml(curServing);}});

  // Star rating
  let curRating=myRating;
  function bindStars(){
    $all('.star-btn').forEach(b=>b.addEventListener('click',()=>{curRating=Number(b.getAttribute('data-val'));setRating(rec.id,curRating);$('#starRow').innerHTML=starsHtml(curRating);bindStars();}));
  }
  bindStars();

  // Fav toggle
  $('#favBtn')?.addEventListener('click',()=>{
    let f=getFavorites();const b=$('#favBtn');
    if(f.includes(rec.id)){f=f.filter(x=>x!==rec.id);setFavorites(f);b.textContent='🤍 เพิ่มในโปรด';b.classList.remove('btn-primary');b.classList.add('btn-ghost');}
    else{f.push(rec.id);setFavorites(f);b.textContent='❤️ อยู่ในโปรด';b.classList.remove('btn-ghost');b.classList.add('btn-primary');}
  });

  // Share
  $('#shareBtn')?.addEventListener('click',async()=>{
    const url=location.href,text=`🍳 ${rec.title} — ดูสูตรอาหารได้เลย!`;
    if(navigator.share){try{await navigator.share({title:rec.title,text,url});}catch(e){if(e.name!=='AbortError')copyFallback(url);}}
    else copyFallback(url);
  });
  function copyFallback(url){navigator.clipboard?.writeText(url).then(()=>alert('คัดลอกลิงก์แล้ว! 📋')).catch(()=>{const t=document.createElement('textarea');t.value=url;document.body.appendChild(t);t.select();document.execCommand('copy');document.body.removeChild(t);alert('คัดลอกลิงก์แล้ว! 📋');});}

  // Timers
  const timers={};
  $all('.timer-btn').forEach(btn=>{
    const idx=btn.getAttribute('data-idx');
    btn.addEventListener('click',()=>{
      if(timers[idx]){clearInterval(timers[idx].interval);delete timers[idx];btn.textContent='⏱ จับเวลา';btn.classList.remove('running');$(`#timerDisp_${idx}`).textContent='';}
      else{let sec=0;$(`#timerDisp_${idx}`).textContent='0:00';btn.textContent='⏹ หยุด';btn.classList.add('running');
        timers[idx]={interval:setInterval(()=>{sec++;const m=Math.floor(sec/60),s=sec%60;$(`#timerDisp_${idx}`).textContent=`${m}:${String(s).padStart(2,'0')}`;},1000)};
      }
    });
  });
}

// ===== Route =====
async function route(){
  ensureSeedData();
  applyTheme(getTheme());
  const path=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  if(path==='index.html'||path===''){renderHome();return;}
  if(path==='favorites.html'){renderFavorites();return;}
  if(path==='category.html'){renderCategory();return;}
  if(path==='about.html'){renderAbout();return;}
  if(path==='add-ingredient.html'){renderAddIngredient();return;}
  if(path==='add-recipe.html'){renderAddRecipe();return;}
  if(path==='recipe.html'){await waitOnlineReady();renderRecipeDetail();return;}
  renderHome();
}

document.addEventListener('DOMContentLoaded',async()=>{
  await initOnlineAndHydrate();
  try{await route();}
  catch(err){
    console.error(err);
    document.body.innerHTML=`<div style="padding:24px;font-family:system-ui"><h2>เกิดข้อผิดพลาด</h2><pre style="white-space:pre-wrap;background:#fff;padding:12px;border-radius:12px">${String(err?.stack||err)}</pre><p>ลองรีเฟรชหน้า</p></div>`;
  }
});
})();
