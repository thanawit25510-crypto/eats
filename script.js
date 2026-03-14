/* What2Cook - Orange vC (localStorage + Supabase) */
(function(){
  'use strict';

  // ===== Supabase =====
  let supabaseClient = null;
  const ONLINE = { enabled: true, ready: false, lastError: null };

  function initSupabase(){
    try{
      const url = window.SUPABASE_URL, key = window.SUPABASE_ANON_KEY;
      if(!url||!key||!window.supabase) return null;
      return window.supabase.createClient(url, key);
    }catch(e){ return null; }
  }

  function toRow(r){
    const now = new Date().toISOString();
    return {
      id: String(r.id), title: r.title||'', category: r.category||'other',
      time: Number(r.time||0), difficulty: r.difficulty||'ง่าย', img: r.img||'',
      ingredients: Array.isArray(r.ingredients)?r.ingredients:[],
      steps: Array.isArray(r.steps)?r.steps:[],
      created_at: r.createdAt?new Date(r.createdAt).toISOString():now, updated_at: now
    };
  }
  function fromRow(row){
    return {
      id: String(row.id), title: row.title||'', category: row.category||'other',
      time: Number(row.time||0), difficulty: row.difficulty||'ง่าย', img: row.img||'',
      ingredients: Array.isArray(row.ingredients)?row.ingredients:[],
      steps: Array.isArray(row.steps)?row.steps:[],
      createdAt: row.created_at?new Date(row.created_at).getTime():Date.now()
    };
  }

  async function onlineFetchRecipes(){
    if(!ONLINE.enabled||!supabaseClient) return null;
    const {data,error} = await supabaseClient.from('recipes').select('*').order('created_at',{ascending:false});
    if(error) throw error;
    return (data||[]).map(fromRow);
  }

  let syncTimer = null;
  function scheduleOnlineUpsert(all){
    if(!ONLINE.enabled||!supabaseClient) return;
    if(syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(async()=>{
      try{
        const {error} = await supabaseClient.from('recipes').upsert((all||[]).map(toRow),{onConflict:'id'});
        if(error) throw error;
        ONLINE.lastError = null;
      }catch(e){ ONLINE.lastError=e; console.warn('Supabase sync fail:',e); }
    }, 600);
  }

  async function onlineDeleteRecipe(id){
    if(!ONLINE.enabled||!supabaseClient) return;
    try{
      const {error} = await supabaseClient.from('recipes').delete().eq('id',String(id));
      if(error) throw error;
    }catch(e){ ONLINE.lastError=e; console.warn('Supabase delete fail:',e); }
  }

  function showTopError(msg){
    try{
      const box = document.createElement('div');
      box.style.cssText='max-width:1100px;margin:12px auto;padding:12px 14px;border-radius:12px;border:1px solid #f1b5b5;background:#fff0f0;color:#7a1f1f;font-weight:600;font-family:inherit;';
      box.textContent = msg; document.body.prepend(box);
    }catch(_){}
  }

  async function initOnlineAndHydrate(){
    supabaseClient = initSupabase();
    if(!supabaseClient){ ONLINE.enabled=false; ONLINE.ready=true; return; }
    ONLINE.enabled = true;
    try{
      const remote = await onlineFetchRecipes();
      if(Array.isArray(remote)){
        if(remote.length===0){
          const seed = loadJson(STORAGE.recipes,[]);
          if(Array.isArray(seed)&&seed.length) scheduleOnlineUpsert(seed);
        }else{ saveJson(STORAGE.recipes,remote); }
      }
      ONLINE.ready = true;
    }catch(e){
      ONLINE.lastError=e; ONLINE.ready=true;
      showTopError('⚠️ โหมดออนไลน์เชื่อมต่อไม่สำเร็จ กำลังใช้ข้อมูลในเครื่องชั่วคราว');
      console.warn('Online init failed:',e);
    }
  }

  async function waitOnlineReady(){
    if(!ONLINE.enabled) return;
    while(!ONLINE.ready) await new Promise(r=>setTimeout(r,50));
  }

  // ===== Storage =====
  const STORAGE = {
    recipes: 'w2c_recipes_vb',
    pantry: 'w2c_pantry_vb',
    favorites: 'w2c_favorites_vc',
    ratings: 'w2c_ratings_vc'
  };

  const CATEGORIES = [
    {key:'tom', label:'ต้ม', desc:'ซุป / ต้มจืด / ต้มยำ', emoji:'🍲'},
    {key:'fried', label:'ทอด', desc:'ของทอด / ไข่เจียว', emoji:'🍳'},
    {key:'stirfry', label:'ผัด', desc:'ผัดต่าง ๆ', emoji:'🥘'},
    {key:'grill', label:'ปิ้งย่าง', desc:'ย่าง / อบ', emoji:'🔥'},
    {key:'dessert', label:'ของหวาน', desc:'ขนม / หวาน', emoji:'🍮'},
    {key:'other', label:'อื่น ๆ', desc:'เมนูอื่น ๆ', emoji:'🍽️'}
  ];

  const COMMON_INGREDIENTS = [
    'ไข่','ไก่','หมูสับ','หมูสามชั้น','กุ้ง','ปลา','ข้าว','พริก','กระเทียม','หอมแดง','หอมใหญ่',
    'ใบกะเพรา','น้ำปลา','น้ำตาล','ซอสหอยนางรม','ซีอิ๊วขาว','พริกไทย','มะนาว','ตะไคร้','ข่า','ใบมะกรูด'
  ];

  function $(s,r=document){ return r.querySelector(s); }
  function $all(s,r=document){ return Array.from(r.querySelectorAll(s)); }
  function escapeHtml(s){ return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function uid(){ return 'r_'+Math.random().toString(16).slice(2)+Date.now().toString(16); }

  function loadJson(key,fallback){
    try{ const r=localStorage.getItem(key); return r?JSON.parse(r):fallback; }
    catch(e){ return fallback; }
  }
  function saveJson(key,val){ localStorage.setItem(key,JSON.stringify(val)); }

  function getRecipes(){ const a=loadJson(STORAGE.recipes,[]); return Array.isArray(a)?a:[]; }
  function setRecipes(a){ saveJson(STORAGE.recipes,a); scheduleOnlineUpsert(a); }
  function getPantry(){ const a=loadJson(STORAGE.pantry,[]); return Array.isArray(a)?a:[]; }
  function setPantry(a){ saveJson(STORAGE.pantry,a); }
  function getFavorites(){ const a=loadJson(STORAGE.favorites,[]); return Array.isArray(a)?a:[]; }
  function setFavorites(a){ saveJson(STORAGE.favorites,a); }
  function getRatings(){ return loadJson(STORAGE.ratings,{})||{}; }
  function setRating(id,val){ const r=getRatings(); r[id]=val; saveJson(STORAGE.ratings,r); }
  function getAvgRating(id){ const r=getRatings()[id]; return r||0; }

  function normalize(s){ return String(s||'').trim().toLowerCase(); }

  // ===== Fuzzy match: "กล้วย" matches "กล้วยน้ำว้า" =====
  function fuzzyMatch(query, text){
    const q = normalize(query), t = normalize(text);
    return t.includes(q) || q.includes(t);
  }

  function uniqueIngredientsFromRecipes(recipes){
    const set = new Set(COMMON_INGREDIENTS.map(x=>x.trim()));
    for(const r of recipes)
      for(const it of (r.ingredients||[]))
        if(it&&it.name) set.add(String(it.name).trim());
    return Array.from(set).filter(Boolean);
  }

  function ensureSeedData(){
    const existing = loadJson(STORAGE.recipes, null);
    if(Array.isArray(existing)&&existing.length) return;
    const seed = [
      {
        id:'seed_kraprao', title:'ข้าวกะเพราไก่', category:'stirfry', time:15, difficulty:'ง่าย', img:'kraprao.jpg',
        ingredients:[{name:'ไก่',amount:'200 กรัม'},{name:'ใบกะเพรา',amount:'1 กำมือ'},{name:'กระเทียม',amount:'3 กลีบ'},{name:'พริก',amount:'ตามชอบ'},{name:'น้ำปลา',amount:'1 ช้อนโต๊ะ'},{name:'ซอสหอยนางรม',amount:'1 ช้อนโต๊ะ'},{name:'น้ำตาล',amount:'1 ช้อนชา'}],
        steps:['โขลกพริกกับกระเทียมพอหยาบ','ผัดพริกกระเทียมให้หอม ใส่ไก่ผัดจนสุก','ปรุงรสด้วยน้ำปลา ซอสหอยนางรม และน้ำตาล','ใส่ใบกะเพราผัดเร็ว ๆ แล้วปิดไฟ'],
        createdAt: Date.now()-1000*60*60*48
      },
      {
        id:'seed_omelet', title:'ไข่เจียว', category:'fried', time:10, difficulty:'ง่าย', img:'omelet.jpg',
        ingredients:[{name:'ไข่',amount:'2 ฟอง'},{name:'น้ำปลา',amount:'1 ช้อนชา'},{name:'พริกไทย',amount:'เล็กน้อย'}],
        steps:['ตอกไข่ ใส่น้ำปลา พริกไทย ตีให้เข้ากัน','ตั้งน้ำมันให้ร้อน เทไข่ลงทอดให้ฟู','กลับด้านสุกแล้วตักเสิร์ฟ'],
        createdAt: Date.now()-1000*60*60*24
      },
      {
        id:'seed_tomjeud', title:'ต้มจืดเต้าหู้หมูสับ', category:'tom', time:20, difficulty:'ปานกลาง', img:'tomjeud.jpg',
        ingredients:[{name:'หมูสับ',amount:'200 กรัม'},{name:'เต้าหู้ไข่',amount:'1 หลอด'},{name:'ผักกาดขาว',amount:'1 ถ้วย'},{name:'น้ำปลา',amount:'1 ช้อนโต๊ะ'},{name:'พริกไทย',amount:'เล็กน้อย'}],
        steps:['ปั้นหมูสับเป็นก้อนเล็ก ๆ','ต้มน้ำซุปให้เดือด ใส่หมูสับ ต้มจนลอย','ใส่ผักกาดขาวและเต้าหู้ ปรุงรส','ต้มต่ออีกเล็กน้อยแล้วปิดไฟ'],
        createdAt: Date.now()-1000*60*60*12
      },
      {
        id:'seed_tomyum', title:'ต้มยำกุ้ง', category:'tom', time:25, difficulty:'ปานกลาง', img:'tomyum.jpg',
        ingredients:[{name:'กุ้ง',amount:'8 ตัว'},{name:'ตะไคร้',amount:'1 ต้น'},{name:'ข่า',amount:'3 แว่น'},{name:'ใบมะกรูด',amount:'3 ใบ'},{name:'น้ำปลา',amount:'1 ช้อนโต๊ะ'},{name:'มะนาว',amount:'1 ลูก'}],
        steps:['ต้มเครื่องต้มยำให้หอม','ใส่กุ้ง ต้มจนสุก','ปรุงรสด้วยน้ำปลา ปิดไฟแล้วค่อยใส่มะนาว'],
        createdAt: Date.now()-1000*60*60*4
      }
    ];
    saveJson(STORAGE.recipes,seed);
    saveJson(STORAGE.pantry,[]);
  }

  function fmtTime(min){ const n=Number(min); return n>0?`${n} นาที`:''; }
  function categoryLabel(key){ return (CATEGORIES.find(c=>c.key===key)||{}).label||(key||''); }
  function categoryEmoji(key){ return (CATEGORIES.find(c=>c.key===key)||{}).emoji||'🍽️'; }

  // ===== Build topbar =====
  function buildTopbar(active){
    return `
      <div class="topbar">
        <div class="container topbar-inner">
          <a class="brand" href="index.html">
            <img src="logo.png" alt="logo">
            <span>ทำอะไรกินดี</span>
          </a>
          <button class="menu-toggle" aria-label="เมนู">☰</button>
          <nav class="nav">
            <a href="index.html" class="${active==='home'?'active':''}">หน้าแรก</a>
            <a href="category.html" class="${active==='cats'?'active':''}">เมนูยอดนิยม</a>
            <a href="add-recipe.html" class="${active==='add'?'active':''}">เพิ่มสูตรอาหาร</a>
            <a href="add-ingredient.html" class="${active==='ing'?'active':''}">เพิ่มวัตถุดิบ</a>
            <a href="about.html" class="${active==='about'?'active':''}">เกี่ยวกับเรา</a>
          </nav>
        </div>
      </div>
    `;
  }

  // ===== Bottom nav =====
  function buildBottomNav(active){
    const items = [
      {href:'index.html', icon:'🏠', label:'หน้าแรก', key:'home'},
      {href:'category.html', icon:'🍽️', label:'หมวดหมู่', key:'cats'},
      {href:'add-recipe.html', icon:'➕', label:'เพิ่มเมนู', key:'add'},
      {href:'add-ingredient.html', icon:'🥕', label:'วัตถุดิบ', key:'ing'},
      {href:'about.html', icon:'ℹ️', label:'เกี่ยวกับ', key:'about'},
    ];
    return `
      <nav class="bottom-nav">
        <div class="bottom-nav-inner">
          ${items.map(it=>`
            <a href="${it.href}" class="bnav-item ${active===it.key?'active':''}">
              <span class="bnav-icon">${it.icon}</span>
              <span>${it.label}</span>
            </a>
          `).join('')}
        </div>
      </nav>
    `;
  }

  // ===== Recipe card =====
  function recipeCard(r){
    const img = r.img||'logo.png';
    const favs = getFavorites();
    const isFav = favs.includes(r.id);
    const rating = getAvgRating(r.id);
    const stars = rating>0 ? '⭐'.repeat(Math.round(rating)) : '';
    return `
      <article class="card recipe-card">
        <a href="recipe.html?id=${encodeURIComponent(r.id)}">
          <div class="recipe-cover"><img src="${escapeHtml(img)}" alt="${escapeHtml(r.title)}" loading="lazy"></div>
        </a>
        <button class="fav-btn ${isFav?'active':''}" data-id="${escapeHtml(r.id)}" title="${isFav?'ลบออกจากโปรด':'เพิ่มในโปรด'}">${isFav?'❤️':'🤍'}</button>
        <div class="recipe-body">
          <div class="recipe-title">${escapeHtml(r.title||'')}</div>
          <div class="recipe-meta">
            <span class="badge">${escapeHtml(categoryLabel(r.category))}</span>
            ${r.time?`<span>⏱ ${escapeHtml(fmtTime(r.time))}</span>`:''}
            ${stars?`<span>${stars}</span>`:''}
          </div>
          <div class="recipe-actions">
            <a class="btn btn-primary btn-sm" href="recipe.html?id=${encodeURIComponent(r.id)}">ดูเมนู</a>
            <a class="btn btn-ghost btn-sm" href="add-recipe.html?edit=${encodeURIComponent(r.id)}">แก้ไข</a>
          </div>
        </div>
      </article>
    `;
  }

  function bindFavButtons(){
    $all('.fav-btn').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        e.preventDefault(); e.stopPropagation();
        const id = btn.getAttribute('data-id')||'';
        if(!id) return;
        let favs = getFavorites();
        if(favs.includes(id)){
          favs = favs.filter(x=>x!==id);
          btn.textContent = '🤍'; btn.classList.remove('active');
          btn.title = 'เพิ่มในโปรด';
        }else{
          favs.push(id);
          btn.textContent = '❤️'; btn.classList.add('active');
          btn.title = 'ลบออกจากโปรด';
        }
        setFavorites(favs);
      });
    });
  }

  // ===== Filter recipes with fuzzy ingredient match + name search =====
  function filterRecipes(recipes, selectedIngredients, mode, nameQuery){
    let result = recipes;

    // Filter by name (fuzzy)
    if(nameQuery && normalize(nameQuery)){
      const q = normalize(nameQuery);
      result = result.filter(r=> normalize(r.title).includes(q));
    }

    // Filter by ingredients (fuzzy)
    const sel = selectedIngredients.map(normalize).filter(Boolean);
    if(sel.length){
      result = result.filter(r=>{
        const ingNames = (r.ingredients||[]).map(x=>normalize(x.name));
        if(mode==='all'){
          return sel.every(s=> ingNames.some(n=> n.includes(s)||s.includes(n)));
        }
        return sel.some(s=> ingNames.some(n=> n.includes(s)||s.includes(n)));
      });
    }

    return result;
  }

  // ===== Mobile hamburger =====
  function bindMobileMenu(){
    const btn = document.querySelector('.menu-toggle');
    const nav = document.querySelector('.nav');
    if(!btn||!nav||btn.dataset.bound==='1') return;
    btn.dataset.bound='1';
    btn.addEventListener('click', ()=> nav.classList.toggle('open'));
    nav.addEventListener('click', (e)=>{ if(e.target?.tagName==='A') nav.classList.remove('open'); });
  }

  // ===== Render home =====
  function renderHome(){
    const recipes = getRecipes();
    const pantry = getPantry();
    const knownIngredients = uniqueIngredientsFromRecipes(recipes);

    document.body.innerHTML = `
      ${buildTopbar('home')}
      <div class="container">
        <div class="hero">
          <div class="panel">
            <div class="h1">🍳 ค้นหาเมนูอาหาร</div>
            <p class="sub">พิมพ์ชื่อเมนู หรือเลือกวัตถุดิบที่มี แล้วกดค้นหา</p>

            <div class="search-name-row">
              <div class="input">
                <span>🔎</span>
                <input id="nameInput" type="text" placeholder="ค้นหาชื่อเมนู เช่น กะเพรา ต้มยำ...">
              </div>
              <button class="btn btn-primary" id="searchNameBtn">ค้นหา</button>
            </div>

            <div class="hr"></div>

            <p class="sub" style="margin-bottom:8px">หรือค้นหาจากวัตถุดิบที่มี</p>
            <div class="search-row">
              <div class="input">
                <span>🥕</span>
                <input id="ingredientInput" type="text" placeholder="พิมพ์วัตถุดิบ เช่น ไข่ ไก่ กล้วย...">
              </div>
              <button class="btn" id="addIngBtn">เพิ่ม</button>
              <button class="btn btn-primary" id="searchBtn">ค้นหาเมนู</button>
            </div>

            <div class="row mini" style="margin-top:8px">
              <span>โหมด:</span>
              <label class="chip" style="cursor:pointer; font-size:12px; padding:5px 10px">
                <input type="radio" name="mode" value="any" checked style="margin-right:6px">มีบางอย่างก็ได้
              </label>
              <label class="chip" style="cursor:pointer; font-size:12px; padding:5px 10px">
                <input type="radio" name="mode" value="all" style="margin-right:6px">ต้องมีครบทุกอย่าง
              </label>
              <button class="btn btn-ghost btn-sm" id="clearBtn">ล้าง</button>
            </div>

            <div class="chips" id="selectedChips"></div>

            <div class="section">
              <h2>วัตถุดิบที่ใช้บ่อย</h2>
              <div class="cloud-wrap" id="cloudWrap">
                <div class="ingredients-cloud" id="ingredientCloud"></div>
              </div>
              <div class="center" style="margin-top:8px">
                <button class="btn btn-ghost btn-sm" id="toggleCloud">แสดงเพิ่ม</button>
              </div>
            </div>
          </div>

          <div class="section">
            <h2>หมวดหมู่อาหาร</h2>
            <div class="grid-cats">
              ${CATEGORIES.map(c=>`
                <div class="card cat" style="position:relative">
                  <a href="category.html?cat=${encodeURIComponent(c.key)}" style="display:block">
                    <span class="cat-emoji">${c.emoji}</span>
                    <b>${escapeHtml(c.label)}</b>
                    <span>${escapeHtml(c.desc)}</span>
                  </a>
                  <button class="cat-add-btn" data-cat="${escapeHtml(c.key)}" title="เพิ่มเมนูในหมวดนี้">+</button>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="section">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px">
              <h2 style="margin:0">เมนูแนะนำ</h2>
              <div class="tab-row" style="margin:0">
                <button class="tab-btn active" data-tab="all">ทั้งหมด</button>
                <button class="tab-btn" data-tab="favs">❤️ โปรด</button>
              </div>
            </div>
            <div class="recipes" id="recipeList">
              ${recipes.slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,12).map(recipeCard).join('')}
            </div>
          </div>
        </div>
      </div>
      ${buildBottomNav('home')}
    `;

    bindMobileMenu();
    bindFavButtons();

    // Category add buttons
    $all('.cat-add-btn').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        e.preventDefault(); e.stopPropagation();
        const cat = btn.getAttribute('data-cat')||'';
        location.href = `add-recipe.html?cat=${encodeURIComponent(cat)}`;
      });
    });

    // Tabs
    $all('.tab-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        $all('.tab-btn').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.getAttribute('data-tab');
        const list = $('#recipeList');
        if(!list) return;
        if(tab==='favs'){
          const favIds = getFavorites();
          const favRecipes = recipes.filter(r=>favIds.includes(r.id));
          if(!favRecipes.length){
            list.innerHTML = `<div class="empty-state"><div class="empty-icon">❤️</div><p>ยังไม่มีเมนูโปรด กดหัวใจ ❤️ บนการ์ดเมนูเพื่อบันทึก</p></div>`;
          }else{
            list.innerHTML = favRecipes.map(recipeCard).join('');
            bindFavButtons();
          }
        }else{
          list.innerHTML = recipes.slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,12).map(recipeCard).join('');
          bindFavButtons();
        }
      });
    });

    // Ingredient logic
    let selected = pantry.slice();

    function renderSelected(){
      const wrap = $('#selectedChips');
      if(!wrap) return;
      if(!selected.length){ wrap.innerHTML=''; return; }
      wrap.innerHTML = selected.map(n=>`
        <span class="chip" data-name="${escapeHtml(n)}">${escapeHtml(n)} <span class="chip-x">×</span></span>
      `).join('');
      $all('.chip',wrap).forEach(ch=>{
        ch.addEventListener('click', ()=>{
          const nm=ch.getAttribute('data-name')||'';
          selected=selected.filter(x=>normalize(x)!==normalize(nm));
          setPantry(selected); renderSelected();
        });
      });
    }

    function addIngredientFromInput(){
      const input = $('#ingredientInput');
      const val = String(input?.value||'').trim();
      if(!val) return;
      if(!selected.some(x=>normalize(x)===normalize(val))){ selected.push(val); setPantry(selected); }
      if(input) input.value='';
      renderSelected();
    }

    function renderCloud(){
      const cloud = $('#ingredientCloud');
      if(!cloud) return;
      const selSet = new Set(selected.map(normalize));
      const ordered = [];
      const set = new Set();
      for(const x of selected){ if(!set.has(normalize(x))){ ordered.push(x); set.add(normalize(x)); } }
      for(const x of knownIngredients){ if(!set.has(normalize(x))){ ordered.push(x); set.add(normalize(x)); } }
      cloud.innerHTML = ordered.map(n=>`
        <button class="chip ${selSet.has(normalize(n))?'active':''}" data-ing="${escapeHtml(n)}" type="button" style="${selSet.has(normalize(n))?'border-color:var(--accent);color:var(--accent);':''}">${escapeHtml(n)}</button>
      `).join('');
      $all('button.chip',cloud).forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const nm=btn.getAttribute('data-ing')||'';
          if(!nm) return;
          if(!selected.some(x=>normalize(x)===normalize(nm))){ selected.push(nm); setPantry(selected); renderSelected(); renderCloud(); }
        });
      });
    }

    function doSearch(nameQ){
      const mode = $('input[name="mode"]:checked')?.value||'any';
      const q = nameQ !== undefined ? nameQ : ($('#nameInput')?.value||'');
      const filtered = filterRecipes(recipes, selected, mode, q);
      const list = $('#recipeList');
      if(!list) return;
      if(!filtered.length){
        list.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>ไม่พบเมนูที่ตรงกัน ลองคำค้นอื่นหรือลดจำนวนวัตถุดิบ</p></div>`;
        return;
      }
      list.innerHTML = filtered.slice(0,30).map(recipeCard).join('');
      bindFavButtons();
    }

    $('#addIngBtn')?.addEventListener('click', addIngredientFromInput);
    $('#ingredientInput')?.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); addIngredientFromInput(); } });
    $('#searchBtn')?.addEventListener('click', ()=> doSearch());
    $('#searchNameBtn')?.addEventListener('click', ()=> doSearch($('#nameInput')?.value||''));
    $('#nameInput')?.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); doSearch($('#nameInput')?.value||''); } });
    $('#clearBtn')?.addEventListener('click', ()=>{
      selected=[]; setPantry([]);
      const ni = $('#nameInput'); if(ni) ni.value='';
      const ii = $('#ingredientInput'); if(ii) ii.value='';
      renderSelected(); renderCloud();
      const list = $('#recipeList');
      if(list){ list.innerHTML=recipes.slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,12).map(recipeCard).join(''); bindFavButtons(); }
    });
    $('#toggleCloud')?.addEventListener('click', ()=>{
      const wrap=$('#cloudWrap');
      if(!wrap) return;
      wrap.classList.toggle('expanded');
      $('#toggleCloud').textContent = wrap.classList.contains('expanded')?'ซ่อน':'แสดงเพิ่ม';
    });

    renderSelected(); renderCloud();
  }

  function parseQuery(){ const q=new URLSearchParams(location.search); const o={}; for(const [k,v] of q.entries()) o[k]=v; return o; }

  // ===== Render category =====
  function renderCategory(){
    const recipes = getRecipes();
    const q = parseQuery();
    const cat = q.cat||'';
    const catInfo = cat ? CATEGORIES.find(c=>c.key===cat) : null;
    const title = catInfo ? `${catInfo.emoji} หมวด${catInfo.label}` : '🍽️ เมนูทั้งหมด';

    document.body.innerHTML = `
      ${buildTopbar('cats')}
      <div class="container">
        <div class="hero">
          <div class="panel">
            <div class="h1">${title}</div>
            <div style="display:flex; gap:8px; justify-content:center; flex-wrap:wrap; margin-top:10px">
              <a class="btn btn-primary btn-sm" href="add-recipe.html${cat?`?cat=${encodeURIComponent(cat)}`:''}">+ เพิ่มเมนู${catInfo?`ใน${catInfo.label}`:'ใหม่'}</a>
              <a class="btn btn-ghost btn-sm" href="category.html">ดูทุกหมวด</a>
            </div>
          </div>

          ${!cat ? `
          <div class="section">
            <h2>เลือกหมวดหมู่</h2>
            <div class="grid-cats">
              ${CATEGORIES.map(c=>`
                <div class="card cat" style="position:relative">
                  <a href="category.html?cat=${encodeURIComponent(c.key)}" style="display:block">
                    <span class="cat-emoji">${c.emoji}</span>
                    <b>${escapeHtml(c.label)}</b>
                    <span>${escapeHtml(c.desc)}</span>
                  </a>
                  <button class="cat-add-btn" data-cat="${escapeHtml(c.key)}" title="เพิ่มเมนูในหมวดนี้">+</button>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}

          <div class="section">
            ${cat ? '' : '<h2>เมนูทั้งหมด</h2>'}
            <div class="recipes">
              ${recipes
                .filter(r=>!cat||r.category===cat)
                .sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))
                .map(recipeCard).join('')||
                `<div class="empty-state"><div class="empty-icon">${catInfo?catInfo.emoji:'🍽️'}</div><p>ยังไม่มีเมนูในหมวดนี้ กด "+ เพิ่มเมนู" เพื่อเริ่มต้น</p></div>`
              }
            </div>
          </div>
        </div>
      </div>
      ${buildBottomNav('cats')}
    `;

    bindMobileMenu();
    bindFavButtons();

    $all('.cat-add-btn').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        e.preventDefault(); e.stopPropagation();
        location.href = `add-recipe.html?cat=${encodeURIComponent(btn.getAttribute('data-cat')||'')}`;
      });
    });
  }

  // ===== Render about =====
  function renderAbout(){
    document.body.innerHTML = `
      ${buildTopbar('about')}
      <div class="container">
        <div class="hero">
          <div class="panel">
            <div class="h1">ℹ️ เกี่ยวกับแอพ</div>
            <p class="sub">แอพรวมสูตรอาหาร ค้นหาเมนูจากวัตถุดิบที่มี</p>
            <div class="card" style="margin-top:12px">
              <b style="font-size:16px">วิธีใช้งาน</b>
              <ul class="list" style="margin-top:10px">
                <li>ค้นหาชื่อเมนูได้ตรงๆ เช่น "กะเพรา" "ต้มยำ"</li>
                <li>พิมพ์วัตถุดิบที่มี แล้วกดค้นหาเมนู ระบบจะหาเมนูที่ตรงให้</li>
                <li>กดหัวใจ ❤️ บนการ์ดเมนูเพื่อบันทึกเมนูโปรด</li>
                <li>กดดาวในหน้ารายละเอียดเพื่อให้คะแนนเมนู</li>
                <li>กดปุ่มแชร์เพื่อส่งลิงก์สูตรอาหารให้เพื่อน</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      ${buildBottomNav('about')}
    `;
    bindMobileMenu();
  }

  // ===== Render add ingredient =====
  function renderAddIngredient(){
    const pantry = getPantry();
    document.body.innerHTML = `
      ${buildTopbar('ing')}
      <div class="container">
        <div class="hero">
          <div class="panel">
            <div class="h1">🥕 เพิ่มวัตถุดิบที่มี</div>
            <p class="sub">วัตถุดิบที่เพิ่มจะใช้ค้นหาเมนูในหน้าแรก</p>
            <div class="search-row" style="max-width:720px">
              <div class="input">
                <span>➕</span>
                <input id="pantryInput" type="text" placeholder="พิมพ์วัตถุดิบ เช่น ไข่ ไก่ หมูสับ...">
              </div>
              <button class="btn btn-primary" id="pantryAddBtn">เพิ่ม</button>
              <a class="btn" href="index.html">กลับ</a>
            </div>
            <div class="chips" id="pantryChips"></div>
          </div>
        </div>
      </div>
      ${buildBottomNav('ing')}
    `;
    bindMobileMenu();
    let selected = pantry.slice();
    function render(){
      const wrap = $('#pantryChips');
      wrap.innerHTML = selected.map(n=>`<span class="chip" data-name="${escapeHtml(n)}">${escapeHtml(n)} <span class="chip-x">×</span></span>`).join('');
      $all('.chip',wrap).forEach(ch=>{
        ch.addEventListener('click', ()=>{
          selected=selected.filter(x=>normalize(x)!==normalize(ch.getAttribute('data-name')||''));
          setPantry(selected); render();
        });
      });
    }
    function add(){
      const input=$('#pantryInput'), val=String(input?.value||'').trim();
      if(!val) return;
      if(!selected.some(x=>normalize(x)===normalize(val))){ selected.push(val); setPantry(selected); }
      if(input) input.value='';
      render();
    }
    $('#pantryAddBtn')?.addEventListener('click', add);
    $('#pantryInput')?.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); add(); } });
    render();
  }

  // ===== Render add recipe =====
  function renderAddRecipe(){
    const recipes = getRecipes();
    const q = parseQuery();
    const editId = q.edit||'';
    const defaultCat = q.cat||'tom';
    const editing = editId ? recipes.find(r=>r.id===editId) : null;
    const model = editing||{id:'',title:'',category:defaultCat,time:15,difficulty:'ง่าย',img:'',ingredients:[{name:'',amount:''}],steps:['']};

    document.body.innerHTML = `
      ${buildTopbar('add')}
      <div class="container">
        <div class="hero">
          <div class="panel">
            <div class="h1">${editing?'✏️ แก้ไขสูตรอาหาร':'➕ เพิ่มสูตรอาหาร'}</div>
            <p class="sub">ใส่รูปเป็น URL เช่น https://... หรือชื่อไฟล์ เช่น tomyum.jpg</p>
          </div>
          <form class="panel form" id="recipeForm">
            <div class="form-grid">
              <div class="field">
                <label>ชื่อเมนู</label>
                <input id="title" required value="${escapeHtml(model.title||'')}" placeholder="เช่น ต้มยำกุ้ง">
              </div>
              <div class="field">
                <label>หมวดหมู่</label>
                <select id="category">
                  ${CATEGORIES.map(c=>`<option value="${c.key}" ${model.category===c.key?'selected':''}>${c.emoji} ${escapeHtml(c.label)}</option>`).join('')}
                </select>
              </div>
              <div class="field">
                <label>เวลาในการทำ (นาที)</label>
                <input id="time" type="number" min="1" value="${escapeHtml(String(model.time||15))}">
              </div>
              <div class="field">
                <label>ความยาก</label>
                <select id="difficulty">
                  ${['ง่าย','ปานกลาง','ยาก'].map(x=>`<option value="${x}" ${model.difficulty===x?'selected':''}>${x}</option>`).join('')}
                </select>
              </div>
              <div class="field" style="grid-column:1/-1">
                <label>รูปภาพ (URL หรือชื่อไฟล์)</label>
                <input id="img" value="${escapeHtml(model.img||'')}" placeholder="เช่น https://... หรือ tomyum.jpg">
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
              <textarea id="steps" placeholder="1) ...\n2) ...">${escapeHtml((model.steps||[]).join('\n'))}</textarea>
            </div>
            <div class="form-actions">
              <a class="btn" href="index.html">ยกเลิก</a>
              ${editing?`<button type="button" class="btn btn-ghost" id="deleteBtn" style="color:#c0392b">🗑️ ลบเมนู</button>`:''}
              <button class="btn btn-primary" type="submit">${editing?'💾 บันทึกการแก้ไข':'✅ บันทึกเมนู'}</button>
            </div>
          </form>
        </div>
      </div>
      ${buildBottomNav('add')}
    `;

    bindMobileMenu();
    const ingList = $('#ingList');
    let ingRows = (model.ingredients&&model.ingredients.length) ? model.ingredients.map(x=>({name:x.name||'',amount:x.amount||''})) : [{name:'',amount:''}];

    function renderIngRows(){
      ingList.innerHTML = ingRows.map((row,i)=>`
        <div class="ing-row" data-i="${i}">
          <input class="ing-name" placeholder="วัตถุดิบ เช่น ไข่" value="${escapeHtml(row.name)}" style="border-radius:12px;border:1.5px solid var(--border);padding:10px 12px;font-size:14px;outline:none;font-family:var(--font)">
          <input class="ing-amt" placeholder="ปริมาณ เช่น 2 ฟอง" value="${escapeHtml(row.amount)}" style="border-radius:12px;border:1.5px solid var(--border);padding:10px 12px;font-size:14px;outline:none;font-family:var(--font)">
          <button class="btn btn-ghost btn-sm ing-del" type="button">ลบ</button>
        </div>
      `).join('');
      $all('.ing-row',ingList).forEach(el=>{
        const i=Number(el.getAttribute('data-i'));
        $('.ing-name',el).addEventListener('input',(e)=>{ ingRows[i].name=e.target.value; });
        $('.ing-amt',el).addEventListener('input',(e)=>{ ingRows[i].amount=e.target.value; });
        $('.ing-del',el).addEventListener('click',()=>{ ingRows.splice(i,1); if(!ingRows.length) ingRows=[{name:'',amount:''}]; renderIngRows(); });
      });
    }

    $('#addIngRow')?.addEventListener('click',()=>{ ingRows.push({name:'',amount:''}); renderIngRows(); });

    if(editing){
      $('#deleteBtn')?.addEventListener('click',(e)=>{
        e.preventDefault();
        if(!confirm('ต้องการลบเมนูนี้ใช่ไหม?')) return;
        setRecipes(recipes.filter(r=>r.id!==editing.id));
        onlineDeleteRecipe(editing.id);
        location.href='index.html';
      });
    }

    $('#recipeForm')?.addEventListener('submit',async(e)=>{
      e.preventDefault();
      const title=$('#title').value.trim();
      if(!title){ alert('กรุณาใส่ชื่อเมนู'); return; }
      const rec={
        id: editing?editing.id:uid(), title,
        category: $('#category').value,
        time: Number($('#time').value||0),
        difficulty: $('#difficulty').value,
        img: $('#img').value.trim(),
        ingredients: ingRows.map(x=>({name:String(x.name||'').trim(),amount:String(x.amount||'').trim()})).filter(x=>x.name),
        steps: String($('#steps').value||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean),
        createdAt: editing?(editing.createdAt||Date.now()):Date.now()
      };
      const next=recipes.slice(), idx=next.findIndex(r=>r.id===rec.id);
      if(idx>=0) next[idx]=rec; else next.push(rec);
      setRecipes(next);
      if(ONLINE.enabled&&supabaseClient){
        try{ const {error}=await supabaseClient.from('recipes').upsert([toRow(rec)],{onConflict:'id'}); if(error) throw error; }
        catch(err){ console.warn('Upsert fail:',err); }
      }
      location.href=`recipe.html?id=${encodeURIComponent(rec.id)}`;
    });

    renderIngRows();
  }

  // ===== Render recipe detail =====
  function renderRecipeDetail(){
    const recipes = getRecipes();
    const q = parseQuery();
    const id = q.id||'';
    const rec = recipes.find(r=>r.id===id);

    if(!rec){
      document.body.innerHTML=`
        ${buildTopbar('')}
        <div class="container"><div class="hero"><div class="panel">
          <div class="h1">ไม่พบเมนูนี้</div>
          <p class="sub">อาจถูกลบหรือยังไม่ได้สร้าง</p>
          <a class="btn btn-primary" href="index.html">กลับหน้าแรก</a>
        </div></div></div>
        ${buildBottomNav('')}
      `;
      bindMobileMenu(); return;
    }

    const img = rec.img||'logo.png';
    const favs = getFavorites();
    const isFav = favs.includes(rec.id);
    const myRating = getAvgRating(rec.id);

    function starsHtml(current){
      return [1,2,3,4,5].map(i=>`
        <button class="star-btn" data-val="${i}" title="${i} ดาว">${i<=current?'⭐':'☆'}</button>
      `).join('');
    }

    document.body.innerHTML = `
      ${buildTopbar('')}
      <div class="container">
        <div class="detail">
          <div class="detail-top">
            <div class="detail-cover"><img src="${escapeHtml(img)}" alt="${escapeHtml(rec.title)}"></div>
            <div class="detail-side">
              <div class="card">
                <div class="recipe-title" style="font-size:20px; margin-bottom:8px">${escapeHtml(rec.title)}</div>
                <div class="recipe-meta" style="margin-bottom:10px">
                  <span class="badge">${escapeHtml(categoryLabel(rec.category))}</span>
                  ${rec.time?`<span>⏱ ${escapeHtml(fmtTime(rec.time))}</span>`:''}
                  ${rec.difficulty?`<span>📊 ${escapeHtml(rec.difficulty)}</span>`:''}
                </div>

                <div class="hr"></div>
                <div style="margin-bottom:8px">
                  <div style="font-size:13px; color:var(--muted); font-weight:700; margin-bottom:6px">ให้คะแนนเมนูนี้</div>
                  <div class="stars" id="starRow">${starsHtml(myRating)}</div>
                </div>

                <div class="hr"></div>
                <div class="share-bar">
                  <button class="btn btn-primary btn-sm" id="favToggleBtn">${isFav?'❤️ อยู่ในโปรดแล้ว':'🤍 เพิ่มในโปรด'}</button>
                  <button class="btn btn-ghost btn-sm" id="shareBtn">📤 แชร์สูตรนี้</button>
                </div>

                <div class="hr"></div>
                <div class="row">
                  <a class="btn btn-ghost btn-sm" href="add-recipe.html?edit=${encodeURIComponent(rec.id)}">✏️ แก้ไข</a>
                  <a class="btn btn-sm" href="category.html?cat=${encodeURIComponent(rec.category)}">ดูหมวดนี้</a>
                </div>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="card">
              <h2 style="text-align:left; margin:0 0 8px; font-size:17px">🥕 วัตถุดิบ</h2>
              <ul class="list">
                ${(rec.ingredients||[]).map(it=>`<li>${escapeHtml(it.name)}${it.amount?` — <span style="color:var(--muted)">${escapeHtml(it.amount)}</span>`:''}</li>`).join('')||'<li>—</li>'}
              </ul>
            </div>
          </div>

          <div class="section">
            <div class="card">
              <h2 style="text-align:left; margin:0 0 8px; font-size:17px">👨‍🍳 วิธีทำ</h2>
              <ol class="list">
                ${(rec.steps||[]).map(s=>`<li>${escapeHtml(s)}</li>`).join('')||'<li>—</li>'}
              </ol>
            </div>
          </div>
        </div>
      </div>
      ${buildBottomNav('')}
    `;

    bindMobileMenu();

    // Star rating
    let currentRating = myRating;
    $all('.star-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        currentRating = Number(btn.getAttribute('data-val'));
        setRating(rec.id, currentRating);
        $('#starRow').innerHTML = starsHtml(currentRating);
        bindStars();
      });
    });

    function bindStars(){
      $all('.star-btn').forEach(btn=>{
        btn.addEventListener('click', ()=>{
          currentRating = Number(btn.getAttribute('data-val'));
          setRating(rec.id, currentRating);
          $('#starRow').innerHTML = starsHtml(currentRating);
          bindStars();
        });
      });
    }

    // Favorite toggle
    $('#favToggleBtn')?.addEventListener('click', ()=>{
      let f=getFavorites();
      const btn=$('#favToggleBtn');
      if(f.includes(rec.id)){
        f=f.filter(x=>x!==rec.id); setFavorites(f);
        btn.textContent='🤍 เพิ่มในโปรด'; btn.classList.remove('btn-primary'); btn.classList.add('btn-ghost');
      }else{
        f.push(rec.id); setFavorites(f);
        btn.textContent='❤️ อยู่ในโปรดแล้ว'; btn.classList.remove('btn-ghost'); btn.classList.add('btn-primary');
      }
    });

    // Share
    $('#shareBtn')?.addEventListener('click', async ()=>{
      const url = location.href;
      const text = `🍳 ${rec.title} — ดูสูตรอาหารได้ที่นี่เลย!`;
      if(navigator.share){
        try{ await navigator.share({title: rec.title, text, url}); }
        catch(e){ if(e.name!=='AbortError') fallbackCopy(url); }
      }else{ fallbackCopy(url); }
    });

    function fallbackCopy(url){
      navigator.clipboard?.writeText(url).then(()=> alert('คัดลอกลิงก์แล้ว! 📋')).catch(()=>{
        const ta=document.createElement('textarea'); ta.value=url;
        document.body.appendChild(ta); ta.select(); document.execCommand('copy');
        document.body.removeChild(ta); alert('คัดลอกลิงก์แล้ว! 📋');
      });
    }
  }

  // ===== Route =====
  async function route(){
    ensureSeedData();
    const path=(location.pathname.split('/').pop()||'index.html').toLowerCase();
    if(path==='index.html'||path==='') { renderHome(); return; }
    if(path==='category.html') { renderCategory(); return; }
    if(path==='about.html') { renderAbout(); return; }
    if(path==='add-ingredient.html') { renderAddIngredient(); return; }
    if(path==='add-recipe.html') { renderAddRecipe(); return; }
    if(path==='recipe.html') { await waitOnlineReady(); renderRecipeDetail(); return; }
    renderHome();
  }

  document.addEventListener('DOMContentLoaded', async ()=>{
    await initOnlineAndHydrate();
    try{ await route(); }
    catch(err){
      console.error(err);
      document.body.innerHTML=`
        <div style="padding:24px; font-family:system-ui">
          <h2>เกิดข้อผิดพลาด</h2>
          <pre style="white-space:pre-wrap; background:#fff; padding:12px; border-radius:12px">${escapeHtml(String(err?.stack||err))}</pre>
          <p>ลองรีเฟรชหน้า</p>
        </div>
      `;
    }
  });
})();
