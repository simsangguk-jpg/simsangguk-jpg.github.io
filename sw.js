/* 상국포털 Service Worker · V22 (2026-11-26)
   - 화면(HTML) 요청은 네트워크 우선 + cache:'no-store' 로 항상 최신 배포본을 받아온다
     (TWA/PWA 앱, 다른 기기에서도 새로 배포한 본문이 바로 뜨도록)
   - activate 때 이전 버전 캐시(sangguk-portal-v20/v21 …)를 전부 지운다.
     예전에는 옛 캐시가 남아 있다가, 오프라인·전파 약한 곳에서 처음 열 때
     그 안의 밝은(예전 디자인) index.html 을 대신 돌려줘 '흰 배경 예전 화면'이 떴다.
     이제 대체 화면은 현재 버전 캐시에서만 꺼낸다.
   - 그 밖의 정적 파일은 네트워크 우선, 실패 시 캐시로 대체
*/
const SW_VERSION = 'sangguk-portal-v22-2026-11-26';
const OFFLINE_HTML = new URL('index.html', self.registration.scope).href;

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== SW_VERSION).map((k) => caches.delete(k)));
    } catch (err) {}
    try { await self.clients.claim(); } catch (err) {}
  })());
});

/* 페이지에서 옛 캐시 정리를 직접 요청할 때 */
self.addEventListener('message', (e) => {
  if (!e.data || e.data.type !== 'SG_CLEAR_OLD_CACHES') return;
  e.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== SW_VERSION).map((k) => caches.delete(k)));
    } catch (err) {}
  })());
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
    e.respondWith((async () => {
      try {
        const res = await fetch(req, { cache: 'no-store' });
        if (res && res.ok) {
          try {
            const c = await caches.open(SW_VERSION);
            await c.put(req, res.clone());
          } catch (err) {}
        }
        return res;
      } catch (err) {
        /* 오프라인 대체: 현재 버전 캐시에 있는 화면만 쓴다(옛 캐시는 이미 지웠다) */
        try {
          const c = await caches.open(SW_VERSION);
          const hit = await c.match(req) || await c.match(OFFLINE_HTML);
          if (hit) return hit;
        } catch (err2) {}
        return new Response(
          '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">' +
          '<meta name="color-scheme" content="dark"><meta name="viewport" content="width=device-width,initial-scale=1">' +
          '<title>상국포털</title><style>html,body{background:#0A0B0E;color:#F3F4F6;margin:0;' +
          'font-family:-apple-system,BlinkMacSystemFont,"Pretendard","Noto Sans KR",sans-serif}' +
          '.b{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center}' +
          '.c{max-width:340px;border:1px solid rgba(212,175,55,.28);border-radius:20px;padding:26px 22px;' +
          'background:linear-gradient(165deg,#1B1F27,#0A0B0E)}h1{font-size:17px;margin:0 0 8px;color:#E8C96A}' +
          'p{font-size:13px;line-height:1.6;color:#D1D5DB;margin:0 0 16px}' +
          'button{width:100%;padding:13px;border:0;border-radius:12px;font-weight:800;font-size:14px;' +
          'color:#141007;background:linear-gradient(135deg,#F0DA9B,#D4AF37 46%,#B08F2A)}</style></head><body>' +
          '<div class="b"><div class="c"><h1>상국포털</h1>' +
          '<p>지금은 연결이 되지 않습니다.<br>전파가 닿는 곳에서 다시 열어 주세요.</p>' +
          '<button onclick="location.reload()">다시 시도</button></div></div></body></html>',
          { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }
    })());
    return;
  }

  e.respondWith(
    fetch(req, { cache: 'no-store' }).catch(async () => {
      try {
        const c = await caches.open(SW_VERSION);
        const hit = await c.match(req);
        if (hit) return hit;
      } catch (err) {}
      return fetch(req, { cache: 'reload' });
    })
  );
});
