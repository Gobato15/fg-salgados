const CACHE = 'fg-salgados-v39';
const CORE = [
    './',
    './index.html',
    './sucesso.html',
    './offline.html',
    './style.css',
    './config.js',
    './menuData.js',
    './manifest.json',
    './images/icon-192.png',
    './images/icon-512.png',
    './images/x_carne.webp',
    './images/x_picanha.webp',
    './images/duplo_cheddar.webp',
    './images/coxinha_premium.webp',
    './images/croissant_presunto_queijo_premium.webp',
    './images/lanche_natural_frango.webp',
    './images/bauru_queijo_presunto.webp',
    './images/x_ags_premium.webp',
    './images/fg_xbacon.webp',
    './images/pix_qr_code.webp'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE)
            .then((cache) => cache.addAll(CORE))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    if (url.origin !== location.origin) return;

    // Bypass cache for admin area
    if (url.pathname.includes('/admin/')) {
        event.respondWith(fetch(req));
        return;
    }

    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req)
                .then((res) => {
                    const copy = res.clone();
                    caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
                    return res;
                })
                .catch(() =>
                    caches.match('./offline.html').then((r) => r || caches.match('./index.html'))
                )
        );
        return;
    }

    event.respondWith(
        fetch(req)
            .then((res) => {
                if (res && res.ok) {
                    const copy = res.clone();
                    caches.open(CACHE).then((cache) => cache.put(req, copy));
                }
                return res;
            })
            .catch(() => caches.match(req))
    );
});
