/* What2Cook - Stable vB (localStorage) */
(function(){
  'use strict';

  // ===== Online mode (Supabase) =====
  // ถ้าตั้งค่า window.SUPABASE_URL และ window.SUPABASE_ANON_KEY ในไฟล์ supabase-config.js
  // เว็บจะอ่าน/เพิ่ม/แก้/ลบ "recipes" แบบออนไลน์ (ทุกคนเห็นร่วมกัน)
  let supabaseClient = null;
const ONLINE = {
  enabled: true,
  ready: false,
  lastError: null,
};


  function initSupabase(){
    try{
      const url = window.SUPABASE_URL;
      const key = window.SUPABASE_ANON_KEY;
      if(!url || !key || !window.supabase) return null;
      return window.supabase.createClient(url, key);
    }catch(e){
      return null;
    }
  }

  function toRow(r){
    const nowIso = new Date().toISOString();
    const createdIso = r.createdAt ? new Date(r.createdAt).toISOString() : nowIso;
    return {
      id: String(r.id),
      title: r.title || '',
      category: r.category || 'other',
      time: Number(r.time || 0),
      difficulty: r.difficulty || 'ง่าย',
      img: r.img || '',
      ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
      steps: Array.isArray(r.steps) ? r.steps : [],
      created_at: createdIso,
      updated_at: nowIso
    };
  }

  function fromRow(row){
    return {
      id: String(row.id),
      title: row.title || '',
      category: row.category || 'other',
      time: Number(row.time || 0),
      difficulty: row.difficulty || 'ง่าย',
      img: row.img || '',
      ingredients: Array.isArray(row.ingredients) ? row.ingredients : [],
      steps: Array.isArray(row.steps) ? row.steps : [],
      createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
    };
  }

  async function onlineFetchRecipes(){
    if(!ONLINE.enabled || !supabaseClient) return null;
    const { data, error } = await supabaseClient
      .from('recipes')
      .select('*')
      .order('created_at', { ascending:false });
    if(error) throw error;
    return (data || []).map(fromRow);
  }

  let syncTimer = null;
  function scheduleOnlineUpsert(allRecipes){
    if(!ONLINE.enabled || !supabaseClient) return;
    if(syncTimer) clearTimeout(syncTimer);
    // debounce 600ms เพื่อความลื่น
    syncTimer = setTimeout(async ()=>{
      try{
        const rows = (allRecipes||[]).map(toRow);
        const { error } = await supabaseClient
          .from('recipes')
          .upsert(rows, { onConflict:'id' });
        if(error) throw error;
        ONLINE.lastError = null;
      }catch(e){
        ONLINE.lastError = e;
        console.warn('Supabase sync failed (fallback still works):', e);
      }
    }, 600);
  }

  async function onlineDeleteRecipe(id){
    if(!ONLINE.enabled || !supabaseClient) return;
    try{
      const { error } = await supabaseClient.from('recipes').delete().eq('id', String(id));
      if(error) throw error;
    }catch(e){
      ONLINE.lastError = e;
      console.warn('Supabase delete failed (fallback still works):', e);
    }
  }

  function showTopError(msg){
    // แสดง error บนหน้าเว็บแทนจอขาว
    try{
      const box = document.createElement('div');
      box.style.cssText = "max-width:1100px;margin:12px auto;padding:12px 14px;border-radius:12px;border:1px solid #f1b5b5;background:#fff0f0;color:#7a1f1f;font-weight:600;font-family:inherit;";
      box.textContent = msg;
      document.body.prepend(box);
    }catch(_){}
  }

  async function initOnlineAndHydrate(){
    supabaseClient = initSupabase();
    if(!supabaseClient) {
      ONLINE.enabled = false;
      ONLINE.ready = true;
      return;
    }
    ONLINE.enabled = true;

    try{
      // ดึงข้อมูลออนไลน์มาแทน localStorage (เพื่อให้ทุกคนเห็นเหมือนกัน)
      const remote = await onlineFetchRecipes();
      if(Array.isArray(remote)){
        // ถ้า DB ว่าง -> seed จากของเดิมครั้งแรก
        if(remote.length === 0){
          const seed = loadJson(STORAGE.recipes, []);
          if(Array.isArray(seed) && seed.length){
            scheduleOnlineUpsert(seed);
          }
        }else{
          saveJson(STORAGE.recipes, remote);
        }
      }
      ONLINE.ready = true;
    }catch(e){
      ONLINE.lastError = e;
      ONLINE.ready = true;
      // ไม่ให้จอขาว: fallback localStorage
      showTopError("⚠️ โหมดออนไลน์เชื่อมต่อไม่สำเร็จ กำลังใช้ข้อมูลในเครื่องชั่วคราว (localStorage) — ตรวจสอบ Supabase URL/Key หรือ Policies");
      console.warn('Online init failed:', e);
    }
  }

  async function waitOnlineReady(){
    if(!ONLINE.enabled) return;
    while(!ONLINE.ready){
      await new Promise(r=>setTimeout(r,50));
    }
  }


  const STORAGE = {
    recipes: 'w2c_recipes_vb',
    pantry: 'w2c_pantry_vb'
  };

  const CATEGORIES = [
    { key:'tom', label:'ต้ม', desc:'ซุป / ต้มจืด / ต้มยำ' },
    { key:'fried', label:'ทอด', desc:'ของทอด / ไข่เจียว' },
    { key:'stirfry', label:'ผัด', desc:'ผัดต่าง ๆ' },
    { key:'grill', label:'ปิ้งย่าง', desc:'ย่าง / อบ' },
    { key:'dessert', label:'ของหวาน', desc:'ขนม / หวาน' },
    { key:'other', label:'อื่น ๆ', desc:'เมนูอื่น ๆ' }
  ];

  const COMMON_INGREDIENTS = [
    'ไข่','ไก่','หมูสับ','หมูสามชั้น','กุ้ง','ปลา','ข้าว','พริก','กระเทียม','หอมแดง','หอมใหญ่',
    'ใบกะเพรา','น้ำปลา','น้ำตาล','ซอสหอยนางรม','ซีอิ๊วขาว','พริกไทย','มะนาว','ตะไคร้','ข่า','ใบมะกรูด'
  ];

  function $(sel, root=document){ return root.querySelector(sel); }
  function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }
  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

  function uid(){
    return 'r_' + Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  function loadJson(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      if(!raw) return fallback;
      return JSON.parse(raw);
    }catch(err){
      console.warn('loadJson fail', key, err);
      return fallback;
    }
  }
  function saveJson(key, value){
    localStorage.setItem(key, JSON.stringify(value));
  }

  function ensureSeedData(){
    const existing = loadJson(STORAGE.recipes, null);
    if(Array.isArray(existing) && existing.length) return;

    const seed = [
      {
        id: 'seed_kraprao',
        title: 'ข้าวกะเพราไก่',
        category: 'stirfry',
        time: 15,
        difficulty: 'ง่าย',
        img: 'kraprao.jpg',
        ingredients: [
          { name:'ไก่', amount:'200 กรัม' },
          { name:'ใบกะเพรา', amount:'1 กำมือ' },
          { name:'กระเทียม', amount:'3 กลีบ' },
          { name:'พริก', amount:'ตามชอบ' },
          { name:'น้ำปลา', amount:'1 ช้อนโต๊ะ' },
          { name:'ซอสหอยนางรม', amount:'1 ช้อนโต๊ะ' },
          { name:'น้ำตาล', amount:'1 ช้อนชา' }
        ],
        steps: [
          'โขลกพริกกับกระเทียมพอหยาบ',
          'ผัดพริกกระเทียมให้หอม ใส่ไก่ผัดจนสุก',
          'ปรุงรสด้วยน้ำปลา ซอสหอยนางรม และน้ำตาล',
          'ใส่ใบกะเพราผัดเร็ว ๆ แล้วปิดไฟ'
        ],
        createdAt: Date.now() - 1000*60*60*48
      },
      {
        id: 'seed_omelet',
        title: 'ไข่เจียว',
        category: 'fried',
        time: 10,
        difficulty: 'ง่าย',
        img: 'omelet.jpg',
        ingredients: [
          { name:'ไข่', amount:'2 ฟอง' },
          { name:'น้ำปลา', amount:'1 ช้อนชา' },
          { name:'พริกไทย', amount:'เล็กน้อย' }
        ],
        steps: [
          'ตอกไข่ ใส่น้ำปลา พริกไทย ตีให้เข้ากัน',
          'ตั้งน้ำมันให้ร้อน เทไข่ลงทอดให้ฟู',
          'กลับด้านสุกแล้วตักเสิร์ฟ'
        ],
        createdAt: Date.now() - 1000*60*60*24
      },
      {
        id: 'seed_tomjeud',
        title: 'ต้มจืดเต้าหู้หมูสับ',
        category: 'tom',
        time: 20,
        difficulty: 'ปานกลาง',
        img: 'tomjeud.jpg',
        ingredients: [
          { name:'หมูสับ', amount:'200 กรัม' },
          { name:'เต้าหู้ไข่', amount:'1 หลอด' },
          { name:'ผักกาดขาว', amount:'1 ถ้วย' },
          { name:'น้ำปลา', amount:'1 ช้อนโต๊ะ' },
          { name:'พริกไทย', amount:'เล็กน้อย' }
        ],
        steps: [
          'ปั้นหมูสับเป็นก้อนเล็ก ๆ',
          'ต้มน้ำซุปให้เดือด ใส่หมูสับ ต้มจนลอย',
          'ใส่ผักกาดขาวและเต้าหู้ ปรุงรส',
          'ต้มต่ออีกเล็กน้อยแล้วปิดไฟ'
        ],
        createdAt: Date.now() - 1000*60*60*12
      },
      {
        id: 'seed_tomyum',
        title: 'ต้มยำกุ้ง',
        category: 'tom',
        time: 25,
        difficulty: 'ปานกลาง',
        img: 'tomyum.jpg',
        ingredients: [
          { name:'กุ้ง', amount:'8 ตัว' },
          { name:'ตะไคร้', amount:'1 ต้น' },
          { name:'ข่า', amount:'3 แว่น' },
          { name:'ใบมะกรูด', amount:'3 ใบ' },
          { name:'น้ำปลา', amount:'1 ช้อนโต๊ะ' },
          { name:'มะนาว', amount:'1 ลูก' }
        ],
        steps: [
          'ต้มเครื่องต้มยำให้หอม',
          'ใส่กุ้ง ต้มจนสุก',
          'ปรุงรสด้วยน้ำปลา ปิดไฟแล้วค่อยใส่มะนาว'
        ],
        createdAt: Date.now() - 1000*60*60*4
      }
    ];

    saveJson(STORAGE.recipes, seed);
    saveJson(STORAGE.pantry, []);
  }

  function getRecipes(){
    const arr = loadJson(STORAGE.recipes, []);
    return Array.isArray(arr) ? arr : [];
  }
  function setRecipes(arr){
    saveJson(STORAGE.recipes, arr);
    scheduleOnlineUpsert(arr);
  }

  function getPantry(){
    const arr = loadJson(STORAGE.pantry, []);
    return Array.isArray(arr) ? arr : [];
  }
  function setPantry(arr){
    saveJson(STORAGE.pantry, arr);
  }

  function normalize(s){
    return String(s||'').trim().toLowerCase();
  }

  function uniqueIngredientsFromRecipes(recipes){
    const set = new Set(COMMON_INGREDIENTS.map(x=>x.trim()));
    for(const r of recipes){
      for(const it of (r.ingredients||[])){
        if(it && it.name) set.add(String(it.name).trim());
      }
    }
    return Array.from(set).filter(Boolean);
  }

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

  function fmtTime(min){
    const n = Number(min);
    if(!Number.isFinite(n) || n<=0) return '';
    return `${n} นาที`;
  }

  function categoryLabel(key){
    const found = CATEGORIES.find(c=>c.key===key);
    return found ? found.label : (key||'');
  }

  function recipeCard(r){
    const img = r.img ? r.img : 'logo.png';
    return `
      <article class="card recipe-card">
        <a href="recipe.html?id=${encodeURIComponent(r.id)}">
          <div class="recipe-cover"><img src="${escapeHtml(img)}" alt="${escapeHtml(r.title)}"></div>
        </a>
        <div class="recipe-body">
          <div class="recipe-title">${escapeHtml(r.title||'')}</div>
          <div class="recipe-meta">
            <span class="badge">${escapeHtml(categoryLabel(r.category))}</span>
            ${r.time ? `<span>⏱ ${escapeHtml(fmtTime(r.time))}</span>`:''}
            ${r.difficulty ? `<span>⭐ ${escapeHtml(r.difficulty)}</span>`:''}
          </div>
          <div class="recipe-actions">
            <a class="btn btn-primary" href="recipe.html?id=${encodeURIComponent(r.id)}">ดูเมนู</a>
            <a class="btn btn-ghost" href="add-recipe.html?edit=${encodeURIComponent(r.id)}">แก้ไข</a>
          </div>
        </div>
      </article>
    `;
  }

  function filterRecipes(recipes, selectedIngredients, mode){
    const sel = selectedIngredients.map(normalize).filter(Boolean);
    if(!sel.length) return recipes;

    return recipes.filter(r=>{
      const ingNames = (r.ingredients||[]).map(x=>normalize(x.name));
      if(mode==='all'){
        return sel.every(s=>ingNames.includes(s));
      }
      // any
      return sel.some(s=>ingNames.includes(s));
    });
  }
// ===== Mobile hamburger menu (ใช้ทุกหน้า) =====
function bindMobileMenu(){
  const btn = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.nav');
  if(!btn || !nav) return;

  // กัน bind ซ้ำ
  if(btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';

  btn.addEventListener('click', ()=>{
    nav.classList.toggle('open');
  });

  // กดเมนูแล้วปิด (เฉพาะมือถือ)
  nav.addEventListener('click', (e)=>{
    if(e.target && e.target.tagName === 'A'){
      nav.classList.remove('open');
    }
  });
}

  function renderHome(){
    const recipes = getRecipes();
    const pantry = getPantry();
    const knownIngredients = uniqueIngredientsFromRecipes(recipes);

    document.body.innerHTML = `
      ${buildTopbar('home')}
      <div class="container">
        <div class="hero">
          <div class="panel">
            <div class="h1">ค้นหาเมนูอาหารจากวัตถุดิบที่คุณมี</div>
            <p class="sub">พิมพ์วัตถุดิบทีละอย่าง แล้วกด “เพิ่ม” เพื่อเลือกหลายอย่าง จากนั้นกด “ค้นหาเมนู”</p>

            <div class="search-row">
              <div class="input" title="พิมพ์วัตถุดิบแล้วกด Enter หรือกดปุ่มเพิ่ม">
                <span>🔎</span>
                <input id="ingredientInput" type="text" placeholder="พิมพ์วัตถุดิบ เช่น ไข่ ไก่ หมูสับ กระเทียม...">
              </div>
              <button class="btn" id="addIngBtn">เพิ่ม</button>
              <button class="btn btn-primary" id="searchBtn">ค้นหาเมนู</button>
            </div>

            <div class="row center mini">
              <span>โหมดการค้นหา:</span>
              <label class="chip" style="cursor:pointer">
                <input type="radio" name="mode" value="any" checked style="margin-right:8px">มีบางอย่างก็ได้
              </label>
              <label class="chip" style="cursor:pointer">
                <input type="radio" name="mode" value="all" style="margin-right:8px">ต้องมีครบทุกอย่าง
              </label>
              <button class="btn btn-ghost" id="clearBtn">ล้าง</button>
            </div>

            <div class="chips" id="selectedChips"></div>

            <div class="section">
              <h2>วัตถุดิบที่ใช้บ่อย</h2>
              <div class="cloud-wrap" id="cloudWrap">
                <div class="ingredients-cloud" id="ingredientCloud"></div>
              </div>
              <div class="center" style="margin-top:10px">
                <button class="btn btn-ghost" id="toggleCloud">แสดงเพิ่ม</button>
              </div>
              <div class="center mini" style="margin-top:6px">เคล็ดลับ: เลือกหลายวัตถุดิบเพื่อกรองแบบ “ต้องมีครบทุกอย่าง”</div>
            </div>
          </div>

          <div class="section">
            <h2>หมวดหมู่อาหาร</h2>
            <div class="grid-cats">
              ${CATEGORIES.map(c=>`
                <a class="card cat" href="category.html?cat=${encodeURIComponent(c.key)}">
                  <b>${escapeHtml(c.label)}</b>
                  <span>${escapeHtml(c.desc)}</span>
                </a>
              `).join('')}
            </div>
          </div>

          <div class="section">
            <h2>เมนูที่แนะนำสำหรับคุณ</h2>
            <div class="recipes" id="recipeList">
              ${recipes.slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,9).map(recipeCard).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
bindMobileMenu();

    // state
    let selected = pantry.slice();

    function renderSelected(){
      const wrap = $('#selectedChips');
      if(!wrap) return;
      wrap.innerHTML = selected.map(name=>`
        <span class="chip" data-name="${escapeHtml(name)}">
          ${escapeHtml(name)}
          <span class="chip-x" title="ลบ">×</span>
        </span>
      `).join('');
      $all('.chip', wrap).forEach(ch=>{
        ch.addEventListener('click', ()=>{
          const nm = ch.getAttribute('data-name');
          selected = selected.filter(x=>normalize(x)!==normalize(nm));
          setPantry(selected);
          renderSelected();
        });
      });
    }

    function addIngredientFromInput(){
      const input = $('#ingredientInput');
      if(!input) return;
      const val = String(input.value||'').trim();
      if(!val) return;
      if(selected.some(x=>normalize(x)===normalize(val))){
        input.value='';
        return;
      }
      selected.push(val);
      setPantry(selected);
      input.value='';
      renderSelected();
    }

    function renderCloud(){
      const cloud = $('#ingredientCloud');
      if(!cloud) return;

      // Order: common first, then others
      const ordered = [];
      const set = new Set();
      for(const x of COMMON_INGREDIENTS){
        if(knownIngredients.includes(x) && !set.has(normalize(x))){
          ordered.push(x); set.add(normalize(x));
        }
      }
      for(const x of knownIngredients){
        if(!set.has(normalize(x))){
          ordered.push(x); set.add(normalize(x));
        }
      }

      cloud.innerHTML = ordered.map(n=>`
        <button class="chip" data-ing="${escapeHtml(n)}" type="button">${escapeHtml(n)}</button>
      `).join('');

      $all('button.chip', cloud).forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const nm = btn.getAttribute('data-ing') || '';
          if(!nm) return;
          if(!selected.some(x=>normalize(x)===normalize(nm))){
            selected.push(nm);
            setPantry(selected);
            renderSelected();
          }
        });
      });
    }

    function doSearch(){
      const mode = $('input[name="mode"]:checked')?.value || 'any';
      const filtered = filterRecipes(recipes, selected, mode);
      const list = $('#recipeList');
      if(!list) return;
      if(!filtered.length){
        list.innerHTML = `<div class="card" style="grid-column:1/-1; text-align:center; padding:22px">
          ไม่พบเมนูที่ตรงกับวัตถุดิบที่เลือก ลองลดจำนวนวัตถุดิบ หรือสลับโหมดการค้นหา
        </div>`;
        return;
      }
      list.innerHTML = filtered.slice(0,30).map(recipeCard).join('');
    }

    // events
    $('#addIngBtn')?.addEventListener('click', addIngredientFromInput);
    $('#ingredientInput')?.addEventListener('keydown', (e)=>{
      if(e.key==='Enter'){
        e.preventDefault();
        addIngredientFromInput();
      }
    });
    $('#searchBtn')?.addEventListener('click', doSearch);
    $('#clearBtn')?.addEventListener('click', ()=>{
      selected = [];
      setPantry([]);
      renderSelected();
      doSearch();
    });

    $('#toggleCloud')?.addEventListener('click', ()=>{
      const wrap = $('#cloudWrap');
      if(!wrap) return;
      wrap.classList.toggle('expanded');
      $('#toggleCloud').textContent = wrap.classList.contains('expanded') ? 'ซ่อน' : 'แสดงเพิ่ม';
    });

    renderSelected();
    renderCloud();
  }

  function parseQuery(){
    const q = new URLSearchParams(location.search);
    const obj = {};
    for(const [k,v] of q.entries()) obj[k]=v;
    return obj;
  }

  function renderCategory(){
    const recipes = getRecipes();
    const q = parseQuery();
    const cat = q.cat || '';
    const title = cat ? `หมวด: ${escapeHtml(categoryLabel(cat))}` : 'เมนูทั้งหมด';

    document.body.innerHTML = `
      ${buildTopbar('cats')}
      <div class="container">
        <div class="hero">
          <div class="panel">
            <div class="h1">${title}</div>
            <p class="sub">เลือกดูเมนูในหมวดนี้ หรือใช้การค้นหาจากหน้าแรกเพื่อกรองด้วยวัตถุดิบ</p>
          </div>
          <div class="section">
            <div class="recipes">
              ${recipes
                .filter(r=>!cat || r.category===cat)
                .sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))
                .map(recipeCard).join('') || `<div class="card" style="grid-column:1/-1; text-align:center; padding:22px">ยังไม่มีเมนูในหมวดนี้</div>`
              }
            </div>
          </div>
        </div>
      </div>
    `;
bindMobileMenu();
  }

  function renderAbout(){
    document.body.innerHTML = `
      ${buildTopbar('about')}
      <div class="container">
        <div class="hero">
          <div class="panel">
            <div class="h1">เกี่ยวกับเรา</div>
            <p class="sub">เว็บตัวอย่างสำหรับค้นหาเมนูอาหารจากวัตถุดิบที่คุณมี — รองรับเพิ่ม/แก้ไขสูตรอาหาร</p>
            <div class="card">
              <b>แนวทางการใช้งาน</b>
              <ul class="list">
                <li>หน้าแรก: พิมพ์วัตถุดิบทีละอย่าง แล้วกดเพิ่ม เพื่อเลือกหลายอย่าง</li>
                <li>กดค้นหาเมนู เพื่อกรองสูตรที่ตรงกับวัตถุดิบ</li>
                <li>เพิ่มสูตรอาหาร: ใส่ชื่อ รูป (URL หรือชื่อไฟล์) เวลา วัตถุดิบ+ปริมาณ และวิธีทำ</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;
bindMobileMenu();
  }

  function renderAddIngredient(){
    const pantry = getPantry();
    document.body.innerHTML = `
      ${buildTopbar('ing')}
      <div class="container">
        <div class="hero">
          <div class="panel">
            <div class="h1">เพิ่มวัตถุดิบที่คุณมี</div>
            <p class="sub">วัตถุดิบที่คุณเพิ่มจะไปอยู่ใน “วัตถุดิบที่เลือก” ที่หน้าแรก</p>
            <div class="search-row" style="max-width:720px">
              <div class="input">
                <span>➕</span>
                <input id="pantryInput" type="text" placeholder="พิมพ์วัตถุดิบ เช่น ไข่, ไก่, หมูสับ...">
              </div>
              <button class="btn btn-primary" id="pantryAddBtn">เพิ่ม</button>
              <a class="btn" href="index.html">กลับหน้าแรก</a>
            </div>

            <div class="chips" id="pantryChips"></div>
          </div>
        </div>
      </div>
    `;

bindMobileMenu();
    let selected = pantry.slice();

    function render(){
      const wrap = $('#pantryChips');
      wrap.innerHTML = selected.map(n=>`
        <span class="chip" data-name="${escapeHtml(n)}">${escapeHtml(n)} <span class="chip-x">×</span></span>
      `).join('');
      $all('.chip', wrap).forEach(ch=>{
        ch.addEventListener('click', ()=>{
          const nm = ch.getAttribute('data-name')||'';
          selected = selected.filter(x=>normalize(x)!==normalize(nm));
          setPantry(selected);
          render();
        });
      });
    }

    function add(){
      const input = $('#pantryInput');
      const val = String(input.value||'').trim();
      if(!val) return;
      if(!selected.some(x=>normalize(x)===normalize(val))){
        selected.push(val);
        setPantry(selected);
      }
      input.value='';
      render();
    }

    $('#pantryAddBtn')?.addEventListener('click', add);
    $('#pantryInput')?.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); add(); } });

    render();
  }

  function renderAddRecipe(){
    const recipes = getRecipes();
    const q = parseQuery();
    const editId = q.edit || '';
    const editing = editId ? recipes.find(r=>r.id===editId) : null;

    const model = editing ? editing : {
      id: '',
      title: '',
      category: 'tom',
      time: 15,
      difficulty: 'ง่าย',
      img: '',
      ingredients: [{name:'', amount:''}],
      steps: ['']
    };

    document.body.innerHTML = `
      ${buildTopbar('add')}
      <div class="container">
        <div class="hero">
          <div class="panel">
            <div class="h1">${editing ? 'แก้ไขสูตรอาหาร' : 'เพิ่มสูตรอาหาร'}</div>
            <p class="sub">D2: ใส่เป็น URL รูปได้ (ง่ายสุด) หรือใส่ชื่อไฟล์ในโฟลเดอร์เดียวกัน เช่น tomyum.jpg</p>
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
                  ${CATEGORIES.map(c=>`<option value="${c.key}" ${model.category===c.key?'selected':''}>${escapeHtml(c.label)}</option>`).join('')}
                </select>
              </div>
              <div class="field">
                <label>เวลาในการทำ (นาที)</label>
                <input id="time" type="number" min="1" value="${escapeHtml(model.time||15)}">
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
              <button type="button" class="btn" id="addIngRow">+ เพิ่มวัตถุดิบ</button>
            </div>

            <div class="hr"></div>

            <div class="field">
              <label>วิธีทำ (พิมพ์ 1 บรรทัดต่อ 1 ขั้นตอน)</label>
              <textarea id="steps" placeholder="1) ...\n2) ...">${escapeHtml((model.steps||[]).join('\n'))}</textarea>
            </div>

            <div class="form-actions">
              <a class="btn" href="index.html">ยกเลิก</a>
              ${editing ? `<a class="btn btn-ghost" id="deleteBtn" href="#">ลบเมนูนี้</a>`:''}
              <button class="btn btn-primary" type="submit">${editing ? 'บันทึกการแก้ไข' : 'บันทึกเมนู'}</button>
            </div>
          </form>
        </div>
      </div>
    `;

bindMobileMenu();
    const ingList = $('#ingList');

    let ingRows = (model.ingredients && model.ingredients.length) ? model.ingredients.map(x=>({name:x.name||'', amount:x.amount||''})) : [{name:'', amount:''}];

    function renderIngRows(){
      ingList.innerHTML = ingRows.map((row,i)=>`
        <div class="ing-row" data-i="${i}">
          <input class="ing-name" placeholder="วัตถุดิบ เช่น ไข่" value="${escapeHtml(row.name)}">
          <input class="ing-amt" placeholder="ปริมาณ เช่น 2 ฟอง / 200 กรัม" value="${escapeHtml(row.amount)}">
          <button class="btn btn-ghost ing-del" type="button" title="ลบ">ลบ</button>
        </div>
      `).join('');

      $all('.ing-row', ingList).forEach(el=>{
        const i = Number(el.getAttribute('data-i'));
        $('.ing-name', el).addEventListener('input', (e)=>{ ingRows[i].name = e.target.value; });
        $('.ing-amt', el).addEventListener('input', (e)=>{ ingRows[i].amount = e.target.value; });
        $('.ing-del', el).addEventListener('click', ()=>{
          ingRows.splice(i,1);
          if(!ingRows.length) ingRows=[{name:'', amount:''}];
          renderIngRows();
        });
      });
    }

    $('#addIngRow')?.addEventListener('click', ()=>{
      ingRows.push({name:'', amount:''});
      renderIngRows();
    });

    if(editing){
      $('#deleteBtn')?.addEventListener('click', (e)=>{
        e.preventDefault();
        if(!confirm('ต้องการลบเมนูนี้ใช่ไหม?')) return;
        const next = recipes.filter(r=>r.id!==editing.id);
        setRecipes(next);
        onlineDeleteRecipe(editing.id);
        location.href='index.html';
      });
    }

    $('#recipeForm')?.addEventListener('submit', async (e)=>{
      e.preventDefault();

      const title = $('#title').value.trim();
      if(!title){
        alert('กรุณาใส่ชื่อเมนู');
        return;
      }

      const rec = {
        id: editing ? editing.id : uid(),
        title,
        category: $('#category').value,
        time: Number($('#time').value || 0),
        difficulty: $('#difficulty').value,
        img: $('#img').value.trim(),
        ingredients: ingRows
          .map(x=>({ name:String(x.name||'').trim(), amount:String(x.amount||'').trim() }))
          .filter(x=>x.name),
        steps: String($('#steps').value||'')
          .split(/\r?\n/)
          .map(s=>s.trim())
          .filter(Boolean),
        createdAt: editing ? (editing.createdAt||Date.now()) : Date.now()
      };

      // Save
      const next = recipes.slice();
      const idx = next.findIndex(r=>r.id===rec.id);
      if(idx>=0) next[idx]=rec; else next.push(rec);
      setRecipes(next);

      // ✅ ensure online DB has this recipe before redirect (avoid missing detail page)
      if(ONLINE.enabled && supabaseClient){
        try{
          const { error } = await supabaseClient
            .from('recipes')
            .upsert([toRow(rec)], { onConflict:'id' });
          if(error) throw error;
          ONLINE.lastError = null;
        }catch(err){
          ONLINE.lastError = err;
          console.warn('Immediate Supabase upsert failed:', err);
        }
      }

      // Add ingredients to pantry suggestions (optional)
      const pantry = getPantry();
      for(const it of rec.ingredients){
        if(it.name && !pantry.some(x=>normalize(x)===normalize(it.name))){
          // do not auto add to pantry, but could keep as is
        }
      }

      location.href = `recipe.html?id=${encodeURIComponent(rec.id)}`;
    });

    renderIngRows();
  }

  function renderRecipeDetail(){
    const recipes = getRecipes();
    const q = parseQuery();
    const id = q.id || '';
    const rec = recipes.find(r=>r.id===id);

    if(!rec){
      document.body.innerHTML = `
        ${buildTopbar('')}
        <div class="container">
          <div class="hero">
            <div class="panel">
              <div class="h1">ไม่พบเมนูนี้</div>
              <p class="sub">อาจถูกลบหรือยังไม่ได้สร้าง</p>
              <a class="btn btn-primary" href="index.html">กลับหน้าแรก</a>
            </div>
          </div>
        </div>
      `;
bindMobileMenu();
      return;
    }

    const img = rec.img ? rec.img : 'logo.png';

    document.body.innerHTML = `
      ${buildTopbar('')}
      <div class="container">
        <div class="detail">
          <div class="detail-top">
            <div class="detail-cover"><img src="${escapeHtml(img)}" alt="${escapeHtml(rec.title)}"></div>
            <div class="detail-side">
              <div class="card">
                <div class="recipe-title" style="font-size:22px">${escapeHtml(rec.title)}</div>
                <div class="recipe-meta" style="margin-top:8px">
                  <span class="badge">${escapeHtml(categoryLabel(rec.category))}</span>
                  ${rec.time ? `<span>⏱ ${escapeHtml(fmtTime(rec.time))}</span>`:''}
                  ${rec.difficulty ? `<span>⭐ ${escapeHtml(rec.difficulty)}</span>`:''}
                </div>
                <div class="hr"></div>
                <div class="row">
                  <a class="btn btn-primary" href="add-recipe.html?edit=${encodeURIComponent(rec.id)}">แก้ไขเมนู</a>
                  <a class="btn" href="category.html?cat=${encodeURIComponent(rec.category)}">ดูหมวดนี้</a>
                </div>
                <div class="hr"></div>
                <div class="mini"><b>หมายเหตุ:</b> รองรับใส่ “ปริมาณวัตถุดิบ” ต่อรายการ</div>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="card">
              <h2 style="text-align:left; margin:0 0 8px">วัตถุดิบ</h2>
              <ul class="list">
                ${(rec.ingredients||[]).map(it=>`<li>${escapeHtml(it.name)}${it.amount?` — <span style="color:var(--muted)">${escapeHtml(it.amount)}</span>`:''}</li>`).join('') || '<li>—</li>'}
              </ul>
            </div>
          </div>

          <div class="section">
            <div class="card">
              <h2 style="text-align:left; margin:0 0 8px">วิธีทำ</h2>
              <ol class="list">
                ${(rec.steps||[]).map(s=>`<li>${escapeHtml(s)}</li>`).join('') || '<li>—</li>'}
              </ol>
            </div>
          </div>
        </div>
      </div>
    `;
bindMobileMenu();
  }

  async function route(){
    ensureSeedData();
    const path = (location.pathname.split('/').pop()||'index.html').toLowerCase();

    if(path==='index.html' || path===''){
      renderHome();
      return;
    }
    if(path==='category.html'){ renderCategory(); return; }
    if(path==='about.html'){ renderAbout(); return; }
    if(path==='add-ingredient.html'){ renderAddIngredient(); return; }
    if(path==='add-recipe.html'){ renderAddRecipe(); return; }
    if(path==='recipe.html'){ await waitOnlineReady(); renderRecipeDetail(); return; }

    // fallback
    renderHome();
  }

  document.addEventListener('DOMContentLoaded', async ()=>{
    await initOnlineAndHydrate();
    try{
      await route();
    }catch(err){
      console.error(err);
      document.body.innerHTML = `
        <div style="padding:24px; font-family: system-ui">
          <h2>เกิดข้อผิดพลาด</h2>
          <pre style="white-space:pre-wrap; background:#fff; padding:12px; border-radius:12px">${escapeHtml(String(err && err.stack ? err.stack : err))}</pre>
          <p>ลองรีเฟรชหน้า หรือเปิด Console เพื่อดูรายละเอียด</p>
        </div>
      `;
bindMobileMenu();
    }
  });
})();
