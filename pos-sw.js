/* Patty POS offline worker. Only touches the POS page, its icons and the fonts.
   Supabase / sync / the shop and Owner app are never intercepted.
   Bump CACHE only if you change this file. The POS page itself updates on its own
   (it is fetched from the network first, the saved copy is used only when offline). */
const CACHE = 'patty-pos-v1';
const CORE = ['./PattyPOS.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('patty-pos-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function networkFirst(req, ms) {
  return new Promise(resolve => {
    let done = false;
    const fallback = () => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./PattyPOS.html'));
    const t = setTimeout(() => { if (!done) fallback().then(r => { if (r && !done) { done = true; resolve(r); } }); }, ms);
    fetch(req).then(res => {
      if (done) return;
      done = true; clearTimeout(t);
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      resolve(res);
    }).catch(() => { if (done) return; clearTimeout(t); fallback().then(r => { done = true; resolve(r || Response.error()); }); });
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin === location.origin) {
    if (/PattyPOS\.html$/.test(u.pathname)) { e.respondWith(networkFirst(req, 4000)); return; }
    if (CORE.some(p => u.pathname.endsWith(p.slice(1)))) {
      e.respondWith(caches.match(req, { ignoreSearch: true }).then(r => r || fetch(req)));
    }
    return;
  }
  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(CACHE).then(c => c.match(req).then(hit => {
      const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
  }
});
