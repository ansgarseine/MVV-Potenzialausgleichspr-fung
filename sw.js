// Service Worker – EVU Potenzialausgleich-Check
// Eigener Cache-Namensraum: räumt nur eigene Caches auf, andere Apps auf
// ansgarseine.github.io bleiben unberührt.
const PREFIX = 'evu-check-';
const CACHE = PREFIX + 'v3';
const ASSETS = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png", "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"];
const SCOPE_PATH = new URL('./', self.location).pathname;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      // einzeln laden: eine fehlende Datei bricht die Installation nicht mehr ab
      Promise.allSettled(ASSETS.map(a => cache.add(a)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  // Same-Origin nur im eigenen Ordner behandeln, nie fremde Apps
  if (sameOrigin && !url.pathname.startsWith(SCOPE_PATH)) return;
  if (!sameOrigin && !url.hostname.endsWith('cdnjs.cloudflare.com')) return;

  // Seiten: erst Netz (Updates sichtbar), offline aus dem Cache
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() =>
        caches.match(req, { ignoreSearch: true })
          .then(m => m || caches.match('./index.html') || caches.match('./'))
      )
    );
    return;
  }

  // Dateien: Cache zuerst, im Hintergrund aktualisieren
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(cached => {
      const net = fetch(req).then(res => {
        if (res && (res.status === 200 || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
