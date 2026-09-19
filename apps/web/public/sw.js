const CACHE_NAME = 'feitosa-solucoes-hostinger-v4';
const STATIC_ASSETS = [
    '/',
    '/admin',
    '/admin/login',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Network-first strategy: tenta rede, cai no cache se offline
self.addEventListener('fetch', (event) => {
    // Não intercepta requisições de API
    if (event.request.method !== 'GET' || event.request.url.includes('/api/')) return;

    const url = new URL(event.request.url);
    const isVersionedAsset = url.origin === self.location.origin
        && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/ocr/'));

    if (isVersionedAsset) {
        event.respondWith(
            caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
                if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
                return response;
            }))
        );
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((res) => {
                const clone = res.clone();
                if (res.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                return res;
            })
            .catch(() => caches.match(event.request))
    );
});
