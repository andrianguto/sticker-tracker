/* Sticker Tracker — Service Worker */
const CACHE = "sticker-tracker-v1";

// Local files to pre-cache on install
const LOCAL_ASSETS = [
  "./",
  "./index.html",
  "./data.js",
  "./styles.css",
  "./components.jsx",
  "./views.jsx",
  "./app.jsx",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(LOCAL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Cache-first for local assets; network-first with cache fallback for CDN
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  const isLocal = url.origin === self.location.origin;

  if (isLocal) {
    // Cache first for local files
    e.respondWith(
      caches.match(e.request).then(
        (cached) => cached || fetch(e.request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        })
      )
    );
  } else {
    // Network first, fall back to cache for CDN resources (React, Fonts, etc.)
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  }
});
