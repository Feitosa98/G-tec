const CACHE_NAME = 'feitosa-solucoes-v2';
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
    if (event.request.url.includes('/api/')) return;

    event.respondWith(
        fetch(event.request)
            .then((res) => {
                const clone = res.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                return res;
            })
            .catch(() => caches.match(event.request))
    );
});
