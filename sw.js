/* ── Bodega Orioles · Service Worker v5 ─────────────────────────────
   Auto-actualización silenciosa: cuando se sube una nueva versión
   a GitHub, la app se actualiza sola. El usuario no hace nada.     */

const CACHE     = "orioles-v5";
const CACHE_CDN = "orioles-cdn-v1";

const CDN = [
  "https://unpkg.com/react@18/umd/react.production.min.js",
  "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js",
  "https://unpkg.com/@babel/standalone/babel.min.js",
];
const STATIC = [
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", e => {
  e.waitUntil(
    Promise.all([
      caches.open(CACHE).then(c => c.addAll(STATIC)),
      caches.open(CACHE_CDN).then(c =>
        Promise.all(CDN.map(url =>
          caches.match(url).then(hit => hit ? null : c.add(url))
        ))
      ),
    ])
  );
  self.skipWaiting(); // activa inmediatamente
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE && k !== CACHE_CDN).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // CDN → cache first (no cambian nunca)
  if (url.hostname.includes("unpkg.com") || url.hostname.includes("fonts")) {
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
        caches.open(CACHE_CDN).then(c => c.put(e.request, res.clone()));
        return res;
      }))
    );
    return;
  }

  // HTML → network first (siempre la versión más nueva de GitHub)
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(e.request)) // offline: sirve la caché
    );
    return;
  }

  // Resto → network first con fallback
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.status === 200)
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// Recibe mensaje del app para activar inmediatamente
self.addEventListener("message", e => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});
