const CACHE = 'fg-salgados-v3';
const CORE = [
    './',
    './index.html',
    './sucesso.html',
    './offline.html',
    './style.css',
    './script.js',
    './menuData.js',
    './manifest.json',
    './images/icon-192.png',
    './images/icon-512.png',
    './images/fg_coxinha.webp',
    './images/fg_croissant.webp',
    './images/fg_torta_frango.webp',
    './images/fg_bauru.webp',
    './images/fg_esfirra.webp',
    './images/fg_bolo_salgado.webp',
    './images/fg_kibe.webp',
    './images/fg_enroladinho.webp',
    './images/fg_pao_batata.webp',
    './images/fg_bolinho_costela.webp',
    './images/fg_croissant_queijo.webp',
    './images/fg_esfirra_carne.webp',
    './images/fg_esfirra_queijo.webp',
    './images/fg_esfirra_calabresa.webp',
    './images/fg_pizza_calabresa.webp',
    './images/fg_pizza_mussarela.webp',
    './images/fg_pizza_portuguesa.webp',
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
