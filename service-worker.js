/* ทำอะไรกินดี - Service Worker v1 */
const CACHE_NAME = 'w2c-cache-v1';

// ไฟล์ที่ต้องการ cache ไว้ใช้ offline
const PRECACHE_URLS = [
  './',
  './index.html',
  './category.html',
  './recipe.html',
  './add-recipe.html',
  './add-ingredient.html',
  './about.html',
  './style.css',
  './script.js',
  './supabase-config.js',
  './manifest.json',
  './1773407477123_image.png'
];

// ===== Install: precache ไฟล์หลัก =====
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// ===== Activate: ลบ cache เก่า =====
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ===== Fetch: Network-first สำหรับ API, Cache-first สำหรับ assets =====
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // ข้าม Supabase API request (ต้องออนไลน์เสมอ)
  if (url.hostname.includes('supabase.co') || url.hostname.includes('jsdelivr.net')) {
    return; // ปล่อยให้ browser จัดการเอง
  }

  // สำหรับ HTML: Network-first (ได้ข้อมูลใหม่เสมอถ้าออนไลน์)
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // สำหรับ CSS, JS, รูปภาพ: Cache-first (เร็ว, ถ้าไม่มีค่อยดึงจาก network)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
