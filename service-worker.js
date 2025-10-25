/* service-worker.js — Santuario de Nimroel (GitHub Pages)
   Ruta base: /Cronicas-de-Nimroel/  */

const CACHE_NAME = "nimroel-cache-v1";
const BASE = "/Cronicas-de-Nimroel";

const CORE_ASSETS = [
  `${BASE}/`,
  `${BASE}/index.html`,
  `${BASE}/style.css`,
  `${BASE}/script.js`,
  `${BASE}/manifest.webmanifest`,
  `${BASE}/offline.html`,
  // Iconos PWA
  `${BASE}/medios/icons/icon-192.png`,
  `${BASE}/medios/icons/icon-512.png`,
  `${BASE}/medios/icons/maskable-512.png`,
  // (Opcional) fuentes/audio mínimos
  // `${BASE}/medios/font/runas.woff2`,
  `${BASE}/medios/audio/primer_canto.mp3`,
  `${BASE}/medios/audio/segundo_canto.mp3`
];

// Instala y precachea
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

// Activa y limpia caches antiguos
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE_NAME) && caches.delete(k)));
    await self.clients.claim();
  })());
});

// Estrategias de fetch:
//  - Páginas HTML y / : network-first con fallback a cache/offline
//  - Estáticos (css/js/png/mp3/svg/woff2): cache-first con fallback a red
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  const isDoc = sameOrigin && (url.pathname === `${BASE}/` || url.pathname.endsWith(".html"));

  if (isDoc) {
    // Network-first para documentos
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(req)) || (await cache.match(`${BASE}/offline.html`));
      }
    })());
  } else {
    // Cache-first para estáticos
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const fresh = await fetch(req);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        // Si pide un doc y falla, intenta offline
        if (req.destination === "document") {
          return await cache.match(`${BASE}/offline.html`);
        }
        return new Response("", { status: 504 });
      }
    })());
  }
});
