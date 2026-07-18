// Mission Control service worker — offline shell (improvement #6, 2026-07-18).
// Strategy: the PAGE is network-first (updates land instantly) with cache
// fallback (opens offline); icons/manifest are cache-first; data.enc is
// NEVER cached here (the page has its own encrypted-payload cache logic).
const CACHE = "mc-shell-v1";
const SHELL = ["./", "index.html", "manifest.json",
               "icon-180.png", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;          // GitHub API etc: hands off
  if (url.pathname.endsWith("data.enc")) return;       // always live
  if (e.request.mode === "navigate" || url.pathname.endsWith("index.html")) {
    // network-first: fresh page when online, cached shell when not
    e.respondWith(fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request).then(m => m || caches.match("./"))));
    return;
  }
  // icons/manifest: cache-first
  e.respondWith(caches.match(e.request).then(m => m || fetch(e.request)));
});
