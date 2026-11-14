/* 상국포털 Service Worker · V20 (2026-11-14)
   - 화면(HTML) 요청은 네트워크 우선 + cache:'no-store' 로 항상 최신 배포본을 받아온다
     (TWA/PWA 앱, 다른 기기에서도 새로 배포한 본문이 바로 뜨도록)
   - 그 밖의 정적 파일은 네트워크 우선, 실패 시 캐시로 대체
*/
const SW_VERSION = 'sangguk-portal-v20-2026-11-14';
const OFFLINE_HTML = new URL('index.html', self.registration.scope).href;

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;

  const isNavigation = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isNavigation) {
    e.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(SW_VERSION).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req)
          .then((r) => r || caches.match(OFFLINE_HTML))
          .then((r) => r || fetch(req, { cache: 'reload' })))
    );
    return;
  }

  e.respondWith(
    fetch(req, { cache: 'no-store' }).catch(() => caches.match(req))
  );
});
