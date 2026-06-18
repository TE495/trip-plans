// ══════════════════════════════════════════
// Service Worker - 旅遊行程 PWA
// 策略：
//   - 導覽 / HTML：network-first（優先抓新版，離線時用快取）
//   - 靜態資源（icon、manifest）：cache-first（快、省流量）
//   - Firebase / 跨網域請求：直接走網路，不快取（資料要即時）
// 改版時把 CACHE_VERSION 加 1，舊快取會自動清掉。
// ══════════════════════════════════════════
const CACHE_VERSION = 'trip-v1';
const APP_SHELL = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

// 安裝：預先快取 App Shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
            .then(() => self.skipWaiting())
    );
});

// 啟用：清除舊版快取
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

// 攔截請求
self.addEventListener('fetch', (event) => {
    const req = event.request;

    // 只處理 GET
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // 跨網域（Firebase、gstatic、Google Maps 等）：直接走網路，不快取
    if (url.origin !== self.location.origin) return;

    // 導覽 / HTML：network-first
    const isHTML = req.mode === 'navigate' ||
                   (req.headers.get('accept') || '').includes('text/html');
    if (isHTML) {
        event.respondWith(
            fetch(req)
                .then((res) => {
                    const copy = res.clone();
                    caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
                    return res;
                })
                .catch(() => caches.match(req).then((c) => c || caches.match('./index.html')))
        );
        return;
    }

    // 其他同網域靜態資源：cache-first
    event.respondWith(
        caches.match(req).then((cached) => {
            if (cached) return cached;
            return fetch(req).then((res) => {
                const copy = res.clone();
                caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
                return res;
            }).catch(() => cached);
        })
    );
});
