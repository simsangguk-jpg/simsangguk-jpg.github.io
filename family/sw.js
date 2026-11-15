/* 상국수향지섭지율포털 Service Worker · v2 (2026-11-15 · 개선사항 의견 게시판)
   - /family/ 범위만 담당한다(상국포털 본체 캐시와 섞이지 않게 별도 캐시 이름 사용)
   - 화면(HTML)은 네트워크 우선: 새로 배포한 내용이 앱에서도 바로 뜨도록
   - 그 밖의 정적 파일은 네트워크 우선, 실패 시 캐시
*/
const SW_VERSION = 'family-portal-v2-2026-11-15';
const OFFLINE_HTML = new URL('index.html', self.registration.scope).href;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k.indexOf('family-portal-') === 0 && k !== SW_VERSION).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf('/family/') !== 0) return;

  const isNavigation = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isNavigation) {
    event.respondWith(
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

  event.respondWith(
    fetch(req, { cache: 'no-store' }).catch(() => caches.match(req))
  );
});
