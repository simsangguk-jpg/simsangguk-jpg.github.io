/* ============================================================
   상국수향지섭지율포털 V4 · 생활·알림 확장 (extra4.js)
   ① 카테고리 목차 + 플로팅 퀵 이동   ② 방문 횟수·최근 접속
   ③ 알림·진동 + 집/학교 도착·출발·완전체   ④ 가족 할일·공유 캘린더
   ⑤ 추억 사진 지도·XP   ⑥ 음식 칼로리 분석(표 + Gemini 선택)
   ⑦ 좋아하는 것 ⑧ 고민·조언 ⑨ 위시리스트(최저가) ⑩ 유튜브·도서·게임 보드
   - 본체(index.html)는 건드리지 않고 window.FAM 다리만 쓴다.
   - 기존 데이터 노드는 그대로 두고 DOC.v4 새 노드만 만든다.
   ============================================================ */
(function (global) {
  'use strict';

  var F = null, ON = false, geoPing = null, lastPing = 0, fullDone = false, geoInit = false;
  var zoneState = {}, zoneMsgAt = {}, baseLine = null;
  var LS_SEEN = 'sgf4_seen_v1';
  var LS_GEO = 'sgf4_geofence_v1';
  var LS_AI = 'sgf4_gemini_v1';
  var LS_ZONE = 'sgf4_zone_v1';
  var LS_BASE = 'sgf4_base_v1';

  /* ---------------- 작은 도구 ---------------- */
  function $(id) { return document.getElementById(id); }
  function d() { return F && F.doc(); }
  function me() { return F && F.me(); }
  function esc(s) { return F.esc(s); }
  function save() { F.save(); }
  function toast(m) { F.toast(m); }
  function now() { return Date.now(); }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function lsObj(k) { try { return JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch (e) { return {}; } }
  function lsSet(k, o) { try { localStorage.setItem(k, JSON.stringify(o)); } catch (e) {} }
  function on(k) { return ls(k) !== '0'; }

  function V4() {
    var D = d();
    if (!D) return { visits: {}, geo: {}, gstate: {}, todos: {}, cal: {}, mem: {}, food: {}, like: {}, worry: {}, adv: {}, wish: {}, board: {}, seen: {} };
    if (!D.v4) D.v4 = {};
    var v = D.v4;
    ['visits', 'geo', 'gstate', 'todos', 'cal', 'mem', 'food', 'like', 'worry', 'adv', 'wish', 'board', 'seen'].forEach(function (k) {
      if (!v[k] || typeof v[k] !== 'object') v[k] = {};
    });
    return v;
  }
  function mid() { return me() ? me().id : ''; }
  /* 받침에 따른 조사(을/를, 이/가) */
  function josa(word, a, b) {
    var w = String(word || '').trim();
    if (!w) return b;
    var c = w.charCodeAt(w.length - 1);
    if (c < 0xAC00 || c > 0xD7A3) return b;
    return ((c - 0xAC00) % 28 !== 0) ? a : b;
  }
  function memName(id) { var m = F.memOf(id); return m && m.name ? m.name : '가족'; }
  function memEmoji(id) { var m = F.memOf(id); return (m && m.emoji) || '🧑'; }

  /* 시그니처가 같으면 다시 그리지 않는다(입력 중 포커스 보호) */
  function paint(el, sig, build) {
    if (!el) return;
    if (el.__sig === sig) return;
    if (el.contains(document.activeElement)) return;
    el.__sig = sig;
    el.innerHTML = build();
  }
  function count(o) { return Object.keys(o || {}).length; }
  function listOf(node) {
    var out = [];
    Object.keys(node || {}).forEach(function (k) {
      var it = node[k];
      if (it && typeof it === 'object' && !it.del) { it._id = k; out.push(it); }
    });
    return out;
  }
  /* 지우기는 흔적(d:1)을 남긴다 — 다른 기기와 합칠 때 되살아나지 않게 */
  function drop(node, id) {
    var it = node && node[id];
    if (!it) return;
    it.del = 1; it.at = now();
  }
  function dv(x) { return x < 10 ? '0' + x : '' + x; }

  /* ---------------- 스타일 ---------------- */
  function style() {
    if ($('v4style')) return;
    var s = document.createElement('style');
    s.id = 'v4style';
    s.textContent = [
      '.v4-cat{margin-bottom:12px}',
      '.v4-cat .ch{display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:800;color:#5C6673;margin:0 2px 6px}',
      '.v4-cat .ch i{width:7px;height:7px;border-radius:50%;display:inline-block}',
      '.v4-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}',
      '@media(min-width:520px){.v4-grid{grid-template-columns:repeat(5,1fr)}}',
      '.v4-tile{display:flex;flex-direction:column;align-items:center;gap:3px;padding:9px 3px;border-radius:13px;background:#FBFDFC;border:1px solid #E9EEF2;font-size:10.5px;font-weight:800;color:#3C4450;line-height:1.15;letter-spacing:-.2px;text-align:center;word-break:keep-all}',
      '.v4-tile .e{font-size:18px;line-height:1}',
      '.v4-tile:active{transform:scale(.97)}',
      '.v4-row{display:flex;align-items:center;gap:8px;padding:9px 2px;border-bottom:1px dashed #EDF1F4;font-size:12.5px}',
      '.v4-row:last-child{border-bottom:none}',
      '.v4-row .e{font-size:16px;width:20px;text-align:center}',
      '.v4-row .tx{flex:1;min-width:0}',
      '.v4-row .tx b{font-weight:800;letter-spacing:-.2px}',
      '.v4-row .tx small{display:block;color:#79838F;font-size:11px;line-height:1.4}',
      '.v4-row .rt{font-size:11px;color:#79838F;white-space:nowrap}',
      '.v4-bar{height:7px;border-radius:20px;background:#EDF1F4;overflow:hidden;margin-top:5px}',
      '.v4-bar i{display:block;height:100%;border-radius:20px;background:linear-gradient(90deg,#0E9F6E,#54C99B)}',
      '.v4-mbar{display:flex;align-items:center;gap:7px;font-size:11.5px;font-weight:700;color:#3C4450}',
      '.v4-mbar .lb{width:64px;flex:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.v4-mbar .bg{flex:1;height:9px;border-radius:20px;background:#F1F4F5;overflow:hidden}',
      '.v4-mbar .bg i{display:block;height:100%;border-radius:20px;background:linear-gradient(90deg,#FF7A66,#FFC24B)}',
      '.v4-mbar .n{width:30px;text-align:right;color:#0A7D56}',
      '.v4-thumbs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:9px}',
      '.v4-thumb{position:relative;border-radius:12px;overflow:hidden;background:#F1F4F5;aspect-ratio:1/1}',
      '.v4-thumb img{width:100%;height:100%;object-fit:cover;display:block}',
      '.v4-thumb .cap{position:absolute;left:0;right:0;bottom:0;padding:12px 6px 4px;font-size:10px;font-weight:800;color:#fff;background:linear-gradient(transparent,rgba(0,0,0,.62));line-height:1.2}',
      '.v4-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-top:8px}',
      '.v4-cal .wd{text-align:center;font-size:10px;font-weight:800;color:#9AA4AF;padding:2px 0}',
      '.v4-cal .cd{aspect-ratio:1/1;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;font-size:11.5px;font-weight:700;background:#FAFBFB;border:1px solid transparent;color:#3C4450}',
      '.v4-cal .cd.emp{background:transparent}',
      '.v4-cal .cd.today{border-color:#0E9F6E;color:#0A7D56}',
      '.v4-cal .cd.on{background:#E7F8F1;color:#0A7D56;font-weight:900}',
      '.v4-cal .cd .dots{display:flex;gap:2px;height:4px}',
      '.v4-cal .cd .dots i{width:4px;height:4px;border-radius:50%;background:#0E9F6E}',
      '.v4-cal .cd .dots i.dn{background:#C9D3DA}',
      '.v4-chk{width:22px;height:22px;flex:none;border-radius:7px;border:1.8px solid #CFD8DE;display:flex;align-items:center;justify-content:center;font-size:13px;color:transparent;background:#fff}',
      '.v4-chk.on{background:#0E9F6E;border-color:#0E9F6E;color:#fff}',
      '.v4-x{width:26px;height:26px;flex:none;border-radius:8px;background:#F1F4F5;color:#9AA4AF;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center}',
      '.v4-tag{font-size:10px;font-weight:800;padding:2px 6px;border-radius:20px;background:#E7F8F1;color:#0A7D56;white-space:nowrap}',
      '.v4-tag.warn{background:#FFF1EE;color:#D9534F}',
      '.v4-tag.gray{background:#F1F4F5;color:#79838F}',
      '.v4-mini{font-size:11px;color:#79838F;line-height:1.5}',
      '.v4-flex{display:flex;gap:7px}',
      '.v4-flex>*{flex:1}',
      '#v4Fab{position:fixed;right:14px;bottom:calc(86px + env(safe-area-inset-bottom,0px));z-index:55;width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#0E9F6E,#38C58F);color:#fff;font-size:23px;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 22px rgba(14,159,110,.38);border:2px solid rgba(255,255,255,.7)}',
      '#v4Fab.on{transform:rotate(45deg)}',
      '#v4Fab:active{transform:scale(.94)}',
      '#v4Fab.on:active{transform:rotate(45deg) scale(.94)}',
      '#v4Menu{position:fixed;right:12px;bottom:calc(146px + env(safe-area-inset-bottom,0px));z-index:55;width:min(330px,calc(100vw - 24px));max-height:62vh;overflow-y:auto;background:#fff;border-radius:18px;box-shadow:0 16px 40px rgba(20,24,29,.22);border:1px solid #E9EEF2;padding:12px;animation:v4up .18s ease}',
      '@keyframes v4up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}',
      '#v4Banner{position:fixed;left:10px;right:10px;top:calc(8px + env(safe-area-inset-top,0px));z-index:120;max-width:480px;margin:0 auto;background:#14302A;color:#fff;border-radius:16px;padding:11px 13px;display:flex;gap:10px;align-items:center;box-shadow:0 12px 30px rgba(10,20,18,.3);transform:translateY(-160%);transition:transform .28s cubic-bezier(.2,.9,.3,1.2)}',
      '#v4Banner.on{transform:none}',
      '#v4Banner .e{font-size:22px;line-height:1}',
      '#v4Banner .tx{flex:1;min-width:0}',
      '#v4Banner .tx b{display:block;font-size:13px;font-weight:800;letter-spacing:-.2px}',
      '#v4Banner .tx small{display:block;font-size:11.5px;opacity:.85;line-height:1.4;margin-top:1px}',
      '#v4Banner .x{color:rgba(255,255,255,.7);font-size:15px;padding:4px}',
      '.v4-wish{border:1px solid #E9EEF2;border-radius:14px;padding:10px;margin-bottom:8px;background:#FBFDFC}',
      '.v4-wish .nm{font-size:13px;font-weight:800;letter-spacing:-.2px}',
      '.v4-links{display:flex;gap:5px;margin-top:7px;flex-wrap:wrap}',
      '.v4-links a{font-size:10.5px;font-weight:800;padding:5px 8px;border-radius:9px;text-decoration:none;color:#2F5E48;background:#E7F8F1}',
      '.v4-links a.nv{color:#2F6FD0;background:#EEF5FF}',
      '.v4-links a.cp{color:#B4471B;background:#FFF0E8}',
      '.v4-links a.dn{color:#5B4BA8;background:#F1EEFF}',
      '.v4-adv{background:#FBFDFC;border:1px solid #EDF1F4;border-radius:11px;padding:8px 9px;margin-top:6px;font-size:12px;line-height:1.45}',
      '.v4-empty{font-size:11.5px;color:#9AA4AF;text-align:center;padding:14px 0}',
      '.v4-tube{display:flex;gap:9px;align-items:center;padding:9px 2px;border-bottom:1px dashed #EDF1F4;text-decoration:none;color:inherit}',
      '.v4-tube:last-child{border-bottom:none}',
      '.v4-tube .th{width:44px;height:44px;border-radius:11px;flex:none;display:flex;align-items:center;justify-content:center;font-size:20px;background:#F1F4F5}',
      '.v4-tube .tx{flex:1;min-width:0}',
      '.v4-tube .tx b{font-size:12.5px;font-weight:800;display:block;letter-spacing:-.2px}',
      '.v4-tube .tx small{font-size:11px;color:#79838F;line-height:1.35;display:block}',
      'body.v4-lock{overflow:hidden}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ============================================================
     ① 카테고리 목차 + 플로팅 퀵 메뉴
     ============================================================ */
  var CATS = [
    {
      t: '소통·알림', c: '#0E9F6E', items: [
        { e: '👋', n: '접속 기록', v: 'all', s: 'v4Visit' },
        { e: '🔔', n: '알림·진동', v: 'all', s: 'v4Notif' },
        { e: '💬', n: '가족 채팅', v: 'chat' },
        { e: '📢', n: '공지·편지', v: 'life' }
      ]
    },
    {
      t: '위치·생활', c: '#4C8DFF', items: [
        { e: '🏠', n: '집·학교', v: 'all', s: 'v4Geo' },
        { e: '✅', n: '가족 할일', v: 'life', life: 'todo' },
        { e: '📅', n: '가족 캘린더', v: 'life', life: 'cal' },
        { e: '📍', n: '가족 위치', v: 'map' }
      ]
    },
    {
      t: '추억·여행·음식', c: '#FF7A66', items: [
        { e: '🗺️', n: '추억 지도', v: 'all', s: 'v4Mem' },
        { e: '🍽️', n: '칼로리', v: 'all', s: 'v4Food' },
        { e: '🍜', n: '맛집·여행', v: 'life', life: 'reco' },
        { e: '📷', n: '가족 사진', v: 'photos' }
      ]
    },
    {
      t: '놀이터·다마고치·마이룸', c: '#8B7CF6', items: [
        { e: '🧸', n: '3D 놀이터', v: 'play', pane: '3d' },
        { e: '🥚', n: '다마고치', v: 'play', pane: 'tama' },
        { e: '🃏', n: '카드 가방', v: 'play', pane: 'card' },
        { e: '🛏️', n: '마이룸', v: 'play', pane: 'room' }
      ]
    },
    {
      t: '마음·선물', c: '#F0659B', items: [
        { e: '🧠', n: '마음 돌봄', v: 'all', s: 'v5Mind' },
        { e: '💗', n: '좋아하는 것', v: 'all', s: 'v4Like' },
        { e: '🤝', n: '고민·조언', v: 'all', s: 'v4Worry' },
        { e: '🎁', n: '위시리스트', v: 'all', s: 'v4Wish' },
        { e: '🛍️', n: '포인트 상점', v: 'play', pane: 'shop' }
      ]
    },
    {
      t: '윷놀이·즐길거리', c: '#F59E0B', items: [
        { e: '🎋', n: '윷놀이', v: 'play', pane: 'yut' },
        { e: '🧮', n: '수학·영어', v: 'play', pane: 'quiz' },
        { e: '📺', n: '유튜브', v: 'all', s: 'v4Tube' },
        { e: '📚', n: '도서·게임', v: 'all', s: 'v4Tube' }
      ]
    }
  ];

  function tileHtml(it) {
    return '<button type="button" class="v4-tile" data-jump="' + esc(JSON.stringify(it)) + '">' +
      '<span class="e">' + it.e + '</span>' + esc(it.n) + '</button>';
  }
  function catsHtml() {
    return CATS.map(function (c) {
      return '<div class="v4-cat"><div class="ch"><i style="background:' + c.c + '"></i>' + esc(c.t) + '</div><div class="v4-grid">' +
        c.items.map(tileHtml).join('') + '</div></div>';
    }).join('');
  }
  function buildIndex() {
    var sec = $('view-all');
    if (!sec || sec.__built) return;
    sec.__built = 1;
    sec.innerHTML = [
      '<div class="card"><div class="card-head"><h2>🗂️ 전체 목차</h2><span class="sub">한 번에 이동</span></div>',
      '<div class="v4-mini" style="margin:-4px 0 10px">우리 가족 기능을 6가지 갈래로 모았어요. 오른쪽 아래 <b>＋</b> 버튼을 누르면 어디서든 바로 뛰어갈 수 있어요.</div>',
      catsHtml(),
      '</div>',
      secVisit(), secGeo(), secNotif(), secMem(), secFood(), secLike(), secWorry(), secWish(), secTube()
    ].join('');
  }

  function buildFab() {
    if ($('v4Fab')) return;
    var fab = document.createElement('button');
    fab.type = 'button'; fab.id = 'v4Fab'; fab.setAttribute('aria-label', '빠른 이동');
    fab.textContent = '＋';
    var menu = document.createElement('div');
    menu.id = 'v4Menu'; menu.className = 'hidden';
    menu.innerHTML = '<div class="v4-mini" style="margin:0 0 8px;font-weight:800;color:#3C4450">빠른 이동 · 카테고리</div>' + catsHtml();
    document.body.appendChild(fab); document.body.appendChild(menu);
    fab.addEventListener('click', function () {
      var open = menu.classList.toggle('hidden') === false;
      fab.classList.toggle('on', open);
    });
    var banner = document.createElement('div');
    banner.id = 'v4Banner';
    banner.innerHTML = '<span class="e">🔔</span><span class="tx"><b></b><small></small></span><span class="x">✕</span>';
    document.body.appendChild(banner);
    banner.addEventListener('click', function (e) {
      if (e.target.classList.contains('x')) { banner.classList.remove('on'); return; }
      banner.classList.remove('on');
      if (banner.__go) banner.__go();
    });
  }

  function jump(it) {
    if (!it) return;
    var menu = $('v4Menu'), fab = $('v4Fab');
    if (menu) menu.classList.add('hidden');
    if (fab) fab.classList.remove('on');
    if (it.v === 'play') {
      F.view('play');
      setTimeout(function () {
        if (global.GAME4 && it.pane) global.GAME4.pane(it.pane);
        if (it.s) scrollTo(it.s);
      }, 120);
      return;
    }
    if (it.v === 'life') {
      F.view('life');
      setTimeout(function () {
        var b = document.querySelector('#lifeNav button[data-life="' + it.life + '"]');
        if (b) b.click();
        if (it.s) scrollTo(it.s);
      }, 120);
      return;
    }
    F.view(it.v);
    if (it.s) setTimeout(function () { scrollTo(it.s); }, 160);
  }
  function scrollTo(id) {
    var el = $(id);
    if (!el) return;
    var y = el.getBoundingClientRect().top + window.pageYOffset - 70;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  }

  /* ============================================================
     ② 방문 횟수 · 최근 접속
     ============================================================ */
  function bumpVisit() {
    var v = V4(), id = mid();
    if (!id) return;
    var done = false;
    try { done = sessionStorage.getItem('sgf4_visit') === id; } catch (e) {}
    var rec = v.visits[id] || { n: 0, at: 0 };
    if (!done) { rec.n = (rec.n || 0) + 1; rec.at = now(); v.visits[id] = rec; save(); try { sessionStorage.setItem('sgf4_visit', id); } catch (e) {} return; }
    if (!rec.at) { rec.at = now(); v.visits[id] = rec; save(); }
  }
  function secVisit() {
    return '<div class="card" id="v4Visit"><div class="card-head"><h2>👋 가족 접속 기록</h2><span class="sub" id="v4VisitSum">–</span></div>' +
      '<div id="v4VisitList"></div>' +
      '<div class="hint">앱에 들어올 때마다 방문 횟수가 1씩 늘고, 마지막 접속 시각이 가족에게 보여요.</div></div>';
  }
  function renderVisit() {
    var v = V4(), box = $('v4VisitList'), sum = $('v4VisitSum');
    if (!box) return;
    var ms = F.members();
    var total = 0;
    ms.forEach(function (m) { total += (v.visits[m.id] && v.visits[m.id].n) || 0; });
    if (sum) sum.textContent = '가족 합계 ' + total + '회';
    var sig = JSON.stringify(v.visits);
    paint(box, sig, function () {
      return ms.map(function (m) {
        var r = v.visits[m.id] || {};
        var when = r.at ? (new Date(r.at).toDateString() === new Date().toDateString() ? '오늘 ' + F.hhmm(r.at) : F.ago(r.at)) : '기록 없음';
        return '<div class="v4-row"><span class="e">' + (m.emoji || '🧑') + '</span><span class="tx"><b>' + esc(m.name) + '</b><small>' + (m.role || '가족') + '</small></span>' +
          '<span class="rt"><b style="color:#0A7D56">' + ((r.n || 0) + '회') + '</b> · ' + esc(when) + '</span></div>';
      }).join('');
    });
  }

  /* ============================================================
     ③ 알림 · 진동 · 집/학교 도착
     ============================================================ */
  function notify(emoji, title, body, go) {
    var b = $('v4Banner');
    if (b) {
      b.querySelector('.e').textContent = emoji || '🔔';
      b.querySelector('.tx b').textContent = title || '';
      b.querySelector('.tx small').textContent = body || '';
      b.__go = go || null;
      b.classList.add('on');
      clearTimeout(b.__h);
      b.__h = setTimeout(function () { b.classList.remove('on'); }, 4600);
    }
    if (on(LS_GEO + '_vib') && navigator.vibrate) { try { navigator.vibrate([150, 80, 150]); } catch (e) {} }
    if (global.Notification && Notification.permission === 'granted') {
      try { new Notification(title || '우리가족포털', { body: body || '', tag: 'sgf4', icon: './icon-192.png' }); } catch (e) {}
    }
  }

  function secNotif() {
    return '<div class="card" id="v4Notif"><div class="card-head"><h2>🔔 알림·진동 설정</h2><span class="sub" id="v4NotifState">–</span></div>' +
      '<div class="sw-row"><div class="bd"><div class="t1">📳 진동 알림</div><div class="t2">새 소식·도착 알림 때 짧게 두 번 울려요</div></div>' +
      '<div class="sw" id="v4VibSw" role="switch" aria-checked="true" tabindex="0"></div></div>' +
      '<div class="v4-flex" style="margin-bottom:8px">' +
      '<button type="button" class="btn soft" id="v4NotifAsk" style="padding:11px;font-size:12.5px">🔔 알림 허용하기</button>' +
      '<button type="button" class="btn ghost" id="v4NotifTest" style="padding:11px;font-size:12.5px">테스트 알림</button></div>' +
      '<div class="hint">새 채팅·편지·공지·도착 소식이 생기면 화면 위에 알림 배너가 뜨고, 허용한 기기에서는 휴대폰 알림과 진동이 함께 울려요. 앱을 완전히 닫아 둔 상태(백그라운드)에서는 휴대폰 정책상 알림이 제한돼요 — 앱을 열어 둔 동안 실시간으로 알려 드려요.</div></div>';
  }
  function renderNotifState() {
    var st = $('v4NotifState'), sw = $('v4VibSw');
    if (st) {
      st.textContent = (global.Notification ? (Notification.permission === 'granted' ? '휴대폰 알림 허용됨' : (Notification.permission === 'denied' ? '알림 차단됨' : '알림 미설정')) : '알림 미지원');
    }
    if (sw) {
      var onv = on(LS_GEO + '_vib');
      sw.classList.toggle('on', onv);
      sw.setAttribute('aria-checked', onv ? 'true' : 'false');
    }
  }
  function wireNotif() {
    var ask = $('v4NotifAsk');
    if (ask) ask.addEventListener('click', function () {
      if (!global.Notification) { toast('이 브라우저는 알림을 지원하지 않아요'); return; }
      Notification.requestPermission().then(function (p) {
        renderNotifState();
        toast(p === 'granted' ? '알림을 허용했어요' : '알림이 허용되지 않았어요 (휴대폰 설정 → 알림)');
      });
    });
    var test = $('v4NotifTest');
    if (test) test.addEventListener('click', function () { notify('🔔', '테스트 알림이에요', '이렇게 새 소식을 알려 드려요!'); });
    var sw = $('v4VibSw');
    if (sw) sw.addEventListener('click', function () {
      var v = on(LS_GEO + '_vib');
      ls(LS_GEO + '_vib', v ? '0' : '1');
      renderNotifState();
      if (!v && navigator.vibrate) { try { navigator.vibrate([150, 80, 150]); } catch (e) {} }
    });
  }

  /* --- 집/학교 위치 --- */
  function secGeo() {
    return '<div class="card" id="v4Geo"><div class="card-head"><h2>🏠 집·학교 도착 알림</h2><span class="sub" id="v4GeoState">–</span></div>' +
      '<div id="v4GeoList"></div>' +
      '<div class="v4-flex" style="margin-top:9px">' +
      '<button type="button" class="btn soft" id="v4SetHome" style="padding:11px;font-size:12.5px">🏠 현재 위치를 집으로</button>' +
      '<button type="button" class="btn ghost" id="v4SetSchool" style="padding:11px;font-size:12.5px">🏫 학교로 저장</button></div>' +
      '<div class="form-row" style="margin-top:9px"><label>도착 인정 반경</label><select class="field" id="v4GeoR"><option value="150">150m (아파트 단지)</option><option value="300" selected>300m (기본)</option><option value="600">600m (넉넉하게)</option></select></div>' +
      '<div id="v4GeoWho" style="margin-top:10px"></div>' +
      '<div class="hint">저장한 위치에 가족이 들어오면 <b>🏠 집 도착</b>·<b>🏫 학교 도착</b>, 나가면 <b>👋 집 출발</b>·<b>👏 귀가 고생</b>을 알려 주고, 네 명이 모두 집에 모이면 <b>🎉 우리가족 완전체!</b>를 띄워요. 앱을 열어 둔 동안에만 판정해요(휴대폰 정책상 앱을 닫으면 멈춤).</div></div>';
  }
  function renderGeo() {
    var v = V4(), box = $('v4GeoList'), st = $('v4GeoState');
    if (!box) return;
    var home = v.geo.home, school = v.geo.school;
    if (st) st.textContent = (home ? '집' : '') + (home && school ? '·' : '') + (school ? '학교' : '') + ((home || school) ? ' 등록됨' : '아직 등록 전');
    var sel = $('v4GeoR');
    if (sel && !sel.__bound) {
      sel.__bound = 1;
      sel.value = String((home && home.r) || (school && school.r) || 300);
      sel.addEventListener('change', function () {
        var r = Number(sel.value) || 300;
        var vv = V4();
        if (vv.geo.home) vv.geo.home.r = r;
        if (vv.geo.school) vv.geo.school.r = r;
        save(); renderGeo(); toast('도착 반경을 ' + r + 'm로 바꿨어요');
      });
    }
    var sig = JSON.stringify([home || 0, school || 0, v.gstate]);
    paint(box, sig, function () {
      function row(icon, label, g) {
        if (!g || typeof g.lat !== 'number') {
          return '<div class="v4-row"><span class="e">' + icon + '</span><span class="tx"><b>' + label + '</b><small>아직 등록 전 — 아래 버튼으로 지금 위치를 저장하세요</small></span><span class="v4-tag gray">미등록</span></div>';
        }
        var inside = [];
        F.members().forEach(function (m) {
          var l = F.live()[m.id];
          if (l && typeof l.lat === 'number' && dist(l.lat, l.lon, g.lat, g.lon) <= (g.r || 300)) inside.push(m.emoji || '🧑');
        });
        return '<div class="v4-row"><span class="e">' + icon + '</span><span class="tx"><b>' + label + '</b><small>' + g.lat.toFixed(4) + ', ' + g.lon.toFixed(4) + ' · 반경 ' + (g.r || 300) + 'm</small></span>' +
          '<span class="rt">' + (inside.length ? inside.join('') : '–') + '</span></div>';
      }
      return row('🏠', '우리 집', home) + row('🏫', '학교', school);
    });
    var who = $('v4GeoWho');
    if (who) {
      var sig2 = JSON.stringify(F.live());
      paint(who, sig2, function () {
        var ms = F.members();
        var lines = ms.map(function (m) {
          var l = F.live()[m.id];
          if (!l || typeof l.lat !== 'number') return '<div class="v4-row"><span class="e">' + (m.emoji || '🧑') + '</span><span class="tx"><b>' + esc(m.name) + '</b><small>위치 정보 없음</small></span><span class="v4-tag gray">–</span></div>';
          var z = zoneOf(l.lat, l.lon);
          var tag = z.z === 'home' ? '<span class="v4-tag">🏠 집</span>' : (z.z === 'school' ? '<span class="v4-tag">🏫 학교</span>' : '<span class="v4-tag gray">🚶 밖</span>');
          var sub2 = z.g ? ('집까지 ' + Math.round(dist(l.lat, l.lon, z.g.lat, z.g.lon)) + 'm · ' + F.ago(l.at || 0)) : ((l.addr || '위치 공유됨') + ' · ' + F.ago(l.at || 0));
          return '<div class="v4-row"><span class="e">' + (m.emoji || '🧑') + '</span><span class="tx"><b>' + esc(m.name) + '</b><small>' + esc(sub2) + '</small></span>' + tag + '</div>';
        });
        return '<div class="v4-mini" style="margin-bottom:4px;font-weight:800;color:#3C4450">지금 위치 판정</div>' + lines.join('');
      });
    }
  }
  function wireGeo() {
    var b1 = $('v4SetHome'), b2 = $('v4SetSchool');
    function grab(which) {
      toast('현재 위치를 확인하는 중…');
      F.locate(function (pos, err) {
        if (!pos) {
          toast(err && err.code === 1 ? '위치 권한을 허용해 주세요 (휴대폰 설정 → 위치)' : '위치를 가져오지 못했어요. 잠시 후 다시 시도해 주세요');
          return;
        }
        var v = V4();
        var cur = v.geo[which] || {};
        v.geo[which] = { lat: pos.coords.latitude, lon: pos.coords.longitude, r: cur.r || 300, at: now(), by: mid() };
        save(); renderGeo();
        toast((which === 'home' ? '우리 집' : '학교') + ' 위치를 저장했어요');
      });
    }
    if (b1) b1.addEventListener('click', function () { grab('home'); });
    if (b2) b2.addEventListener('click', function () { grab('school'); });
  }

  function dist(aLat, aLon, bLat, bLon) {
    var R = 6371000, rad = Math.PI / 180;
    var dLat = (bLat - aLat) * rad, dLon = (bLon - aLon) * rad;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  function zoneOf(lat, lon) {
    var v = V4(), best = null, bestD = 1e12;
    ['home', 'school'].forEach(function (k) {
      var g = v.geo[k];
      if (!g || typeof g.lat !== 'number') return;
      var dd = dist(lat, lon, g.lat, g.lon);
      if (dd <= (g.r || 300) && dd < bestD) { bestD = dd; best = { z: k, g: g }; }
    });
    return best || { z: 'out', g: null };
  }
  var CHEER_OUT = ['오늘도 안전하게 다녀와요!', '조심히 다녀오세요 💪', '좋은 하루 보내고 와요!', '우리 가족이 응원해요 🌿', '길 조심, 물 마시고 다녀와요!'];
  var CHEER_BACK = ['오늘 하루 고생 많았어요!', '귀가 고생했어요, 푹 쉬어요 🛋️', '집에 오는 길 안전했지요? 고마워요!', '어서 와요, 맛있는 거 있어요 🍲'];
  function pick(a) { return a[(Math.random() * a.length) | 0]; }

  function geoCheck() {
    var v = V4();
    if (!v.geo.home && !v.geo.school) return;
    var live = F.live(), ms = F.members();
    var allHome = ms.length >= 2, anyKnown = false;
    var firstCheck = !geoInit;
    geoInit = true;
    ms.forEach(function (m) {
      var l = live[m.id];
      if (!l || typeof l.lat !== 'number') { allHome = false; return; }
      anyKnown = true;
      var z = zoneOf(l.lat, l.lon);
      var prev = zoneState[m.id];
      if (prev && prev !== z.z) announce(m, z.z, prev);
      zoneState[m.id] = z.z;
      if (z.z !== 'home') allHome = false;
    });
    /* 앱을 열었을 때 이미 다 모여 있으면 조용히 넘어가고, 앱을 열어 둔 사이에 모이면 축하한다 */
    if (firstCheck && allHome) { fullDone = true; return; }
    if (allHome && anyKnown && !fullDone) {
      fullDone = true;
      notify('🎉', '우리가족 완전체!', '네 명 모두 집에 모였어요. 오늘 하루 수고 많았어요!', function () { F.view('home'); });
      var g = V4();
      g.gstate.all = { at: now(), v: 1 };
      save();
    }
    if (!allHome) fullDone = false;
  }
  function announce(m, to, from) {
    var k = m.id + ':' + from + '>' + to;
    if (zoneMsgAt[k] && now() - zoneMsgAt[k] < 60000) return;
    zoneMsgAt[k] = now();
    var name = m.name || '가족';
    if (to === 'home') {
      notify('🏠', name + ' 집 도착!', pick(CHEER_BACK), function () { F.view('map'); });
    } else if (to === 'school') {
      notify('🏫', name + ' 학교 도착!', '오늘 수업도 파이팅!', function () { F.view('map'); });
    } else if (from === 'home') {
      notify('👋', name + ' 집 출발!', pick(CHEER_OUT), function () { F.view('map'); });
    } else if (from === 'school') {
      notify('👏', name + ' 학교 끝!', '귀가 고생이 많아요 — 조심히 와요!', function () { F.view('map'); });
    }
  }

  /* --- 새 소식 감지 --- */
  function snapshot() {
    var D = d(), id = mid();
    var chat = 0, lt = 0, nt = 0, todo = 0;
    listOf(D.chat).forEach(function (c) { if (c.by !== id) chat = Math.max(chat, c.at || 0); });
    listOf(D.letters).forEach(function (l) { if (l.to === id || l.to === 'all') lt++; });
    listOf(D.notices).forEach(function (n) { if (!(n.ack && n.ack[id])) nt++; });
    var v = V4();
    listOf(v.todos).forEach(function (t) { if (t.by !== id) todo = Math.max(todo, t.at || 0); });
    return { chat: chat, lt: lt, nt: nt, todo: todo };
  }
  function notifCheck() {
    var s = snapshot();
    if (!baseLine) { baseLine = s; lsSet(LS_SEEN, s); return; }
    var last = lsObj(LS_SEEN);
    if (on(LS_GEO + '_note')) {
      if (s.chat > (last.chat || 0)) notify('💬', '새 가족 채팅', '새 메시지가 도착했어요', function () { F.view('chat'); });
      if (s.lt > (last.lt || 0)) notify('✉️', '새 편지가 도착했어요', '가족이 보낸 편지를 확인해 보세요', function () { F.view('life'); });
      if (s.nt > (last.nt || 0)) notify('📢', '새 가족 공지', '꼭 확인해야 할 소식이 있어요', function () { F.view('life'); });
      if (s.todo > (last.todo || 0)) notify('✅', '새 가족 할일', '가족이 할일을 추가했어요', function () { F.view('life'); });
    }
    lsSet(LS_SEEN, s);
    baseLine = s;
  }

  /* ============================================================
     ④ 가족 할일 · 공유 캘린더 (생활 탭 안)
     ============================================================ */
  function buildLife() {
    var nav = $('lifeNav');
    if (nav && !nav.__v4) {
      nav.__v4 = 1;
      var b1 = document.createElement('button');
      b1.type = 'button'; b1.setAttribute('data-life', 'todo'); b1.textContent = '✅ 할일';
      var b2 = document.createElement('button');
      b2.type = 'button'; b2.setAttribute('data-life', 'cal'); b2.textContent = '📅 가족 캘린더';
      nav.appendChild(b1); nav.appendChild(b2);
    }
    var hub = $('lifeQuick');
    if (hub && !hub.__v4) {
      hub.__v4 = 1;
      var h1 = document.createElement('button');
      h1.type = 'button'; h1.className = 'hub-btn'; h1.setAttribute('data-life', 'todo');
      h1.innerHTML = '<span class="ic">✅</span><span class="t">가족 할일</span><span class="d">모두가 추가·완료 체크하는 목록</span><span class="n hidden" id="hubTodoN">0</span>';
      var h2 = document.createElement('button');
      h2.type = 'button'; h2.className = 'hub-btn'; h2.setAttribute('data-life', 'cal');
      h2.innerHTML = '<span class="ic">📅</span><span class="t">가족 공유 캘린더</span><span class="d">날짜별 일정·완료 체크</span><span class="n hidden" id="hubCalN">0</span>';
      hub.appendChild(h1); hub.appendChild(h2);
    }
    var sec = $('view-life');
    if (sec && !$('life-todo')) {
      var t = document.createElement('div'); t.id = 'life-todo'; t.className = 'hidden';
      t.innerHTML = '<div class="card"><div class="card-head"><h2>✅ 가족 할일 목록</h2><span class="sub" id="v4TodoSum">0개</span></div>' +
        '<div class="fb-desc">누구나 추가하고, 끝나면 <b>실시 완료</b>를 눌러요. 완료한 사람과 시각이 함께 남아요.</div>' +
        '<div style="display:flex;gap:7px;margin:9px 0"><input class="field" id="v4TodoIn" maxlength="60" placeholder="예: 지섭이 수학 숙제 확인" style="margin:0;flex:1"><button class="btn" id="v4TodoAdd" style="width:auto;padding:0 15px;border-radius:13px">추가</button></div>' +
        '<div class="seg" id="v4TodoSeg"><button type="button" data-ts="open" class="on">남은 일</button><button type="button" data-ts="done">완료</button></div>' +
        '<div id="v4TodoList" class="fb-list"></div></div>';
      var c = document.createElement('div'); c.id = 'life-cal'; c.className = 'hidden';
      c.innerHTML = '<div class="card"><div class="card-head"><h2>📅 가족 공유 캘린더</h2><span class="sub" id="v4CalSum">0개</span></div>' +
        '<div class="mn-month"><button type="button" id="v4CalPrev" aria-label="이전 달">‹</button><span class="lb" id="v4CalLabel">–</span><button type="button" id="v4CalNext" aria-label="다음 달">›</button></div>' +
        '<div class="v4-cal" id="v4CalGrid"></div>' +
        '<div id="v4CalDay" style="margin-top:10px"></div>' +
        '<div style="display:flex;gap:7px;margin-top:9px"><input class="field" id="v4CalIn" maxlength="60" placeholder="일정 내용" style="margin:0;flex:1"><input class="field" id="v4CalDate" type="date" style="margin:0;width:132px"><button class="btn" id="v4CalAdd" style="width:auto;padding:0 13px;border-radius:13px">추가</button></div>' +
        '<div class="hint">날짜를 누르면 그날 일정이 아래에 모여요. 즐겨찾는 날엔 점이 찍혀요.</div></div>';
      sec.appendChild(t); sec.appendChild(c);
      wireTodo(); wireCal();
    }
  }

  var todoTab = 'open';
  function wireTodo() {
    var add = $('v4TodoAdd'), inp = $('v4TodoIn');
    function go() {
      var v = V4(), text = (inp.value || '').trim();
      if (!text) { toast('할일을 적어 주세요'); return; }
      var id = 'td' + now().toString(36) + Math.random().toString(36).slice(2, 4);
      v.todos[id] = { t: text, by: mid(), at: now(), done: 0 };
      inp.value = '';
      save(); renderTodo();
      toast('가족 할일에 추가했어요');
    }
    if (add) add.addEventListener('click', go);
    if (inp) inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    var seg = $('v4TodoSeg');
    if (seg) seg.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ts]');
      if (!b) return;
      todoTab = b.getAttribute('data-ts');
      var all = seg.querySelectorAll('button');
      for (var i = 0; i < all.length; i++) all[i].classList.toggle('on', all[i] === b);
      renderTodo();
    });
    var list = $('v4TodoList');
    if (list) list.addEventListener('click', function (e) {
      var it = e.target.closest('[data-todo]');
      if (!it) return;
      var v = V4(), id = it.getAttribute('data-todo'), rec = v.todos[id];
      if (!rec) return;
      if (e.target.closest('[data-tdel]')) { drop(v.todos, id); save(); renderTodo(); toast('할일을 지웠어요'); return; }
      rec.done = rec.done ? 0 : 1;
      rec.doneAt = rec.done ? now() : 0;
      rec.doneBy = rec.done ? mid() : '';
      rec.at = now();
      save(); renderTodo();
    });
  }
  function renderTodo() {
    var v = V4(), box = $('v4TodoList'), sum = $('v4TodoSum');
    if (!box) return;
    var all = listOf(v.todos).sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    var openN = all.filter(function (x) { return !x.done; }).length;
    if (sum) sum.textContent = '남은 ' + openN + ' · 완료 ' + (all.length - openN);
    var shown = all.filter(function (x) { return todoTab === 'done' ? !!x.done : !x.done; });
    var sig = todoTab + JSON.stringify(shown);
    paint(box, sig, function () {
      if (!shown.length) return '<div class="v4-empty">' + (todoTab === 'done' ? '아직 완료한 일이 없어요' : '남은 할일이 없어요! 🎉') + '</div>';
      return shown.map(function (x) {
        return '<div class="v4-row" data-todo="' + x._id + '"><button type="button" class="v4-chk ' + (x.done ? 'on' : '') + '" data-tog="1" aria-label="완료 체크">✓</button>' +
          '<span class="tx"><b style="' + (x.done ? 'text-decoration:line-through;color:#9AA4AF' : '') + '">' + esc(x.t) + '</b><small>' + memEmoji(x.by) + ' ' + esc(memName(x.by)) + ' · ' + F.ago(x.at) + (x.done && x.doneBy ? ' · ' + memName(x.doneBy) + ' 완료' : '') + '</small></span>' +
          (x.done ? '<span class="v4-tag">완료</span>' : '') +
          '<button type="button" class="v4-x" data-tdel="1" aria-label="삭제">✕</button></div>';
      }).join('');
    });
    var hn = $('hubTodoN');
    if (hn) { hn.textContent = openN; hn.classList.toggle('hidden', !openN); }
  }

  var calMonth = (function () { var d0 = new Date(); return d0.getFullYear() + '-' + dv(d0.getMonth() + 1); })();
  var calSel = '';
  function wireCal() {
    var add = $('v4CalAdd'), inp = $('v4CalIn'), dt = $('v4CalDate');
    if (dt && !dt.value) dt.value = F.todayYmd();
    function go() {
      var v = V4(), text = (inp.value || '').trim(), day = dt.value || F.todayYmd();
      if (!text) { toast('일정 내용을 적어 주세요'); return; }
      var id = 'cl' + now().toString(36) + Math.random().toString(36).slice(2, 4);
      v.cal[id] = { d: day, t: text, by: mid(), at: now(), done: 0 };
      inp.value = '';
      calSel = day;
      save(); renderCal();
      toast(day.slice(5).replace('-', '월 ') + '일 일정을 추가했어요');
    }
    if (add) add.addEventListener('click', go);
    if (inp) inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    var prev = $('v4CalPrev'), next = $('v4CalNext');
    function shift(n) {
      var p = calMonth.split('-');
      var d0 = new Date(Number(p[0]), Number(p[1]) - 1 + n, 1);
      calMonth = d0.getFullYear() + '-' + dv(d0.getMonth() + 1);
      renderCal();
    }
    if (prev) prev.addEventListener('click', function () { shift(-1); });
    if (next) next.addEventListener('click', function () { shift(1); });
    var grid = $('v4CalGrid');
    if (grid) grid.addEventListener('click', function (e) {
      var cd = e.target.closest('[data-day]');
      if (!cd) return;
      calSel = cd.getAttribute('data-day');
      var dt2 = $('v4CalDate'); if (dt2) dt2.value = calSel;
      renderCal();
    });
    var day = $('v4CalDay');
    if (day) day.addEventListener('click', function (e) {
      var it = e.target.closest('[data-cal]');
      if (!it) return;
      var v = V4(), id = it.getAttribute('data-cal'), rec = v.cal[id];
      if (!rec) return;
      if (e.target.closest('[data-cdel]')) { drop(v.cal, id); save(); renderCal(); return; }
      rec.done = rec.done ? 0 : 1; rec.doneBy = rec.done ? mid() : ''; rec.doneAt = rec.done ? now() : 0;
      rec.at = now();
      save(); renderCal();
    });
  }
  function renderCal() {
    var v = V4(), grid = $('v4CalGrid'), lab = $('v4CalLabel'), sum = $('v4CalSum');
    if (!grid) return;
    var p = calMonth.split('-'), y = Number(p[0]), m = Number(p[1]);
    if (lab) lab.textContent = y + '년 ' + m + '월';
    var all = listOf(v.cal);
    if (sum) sum.textContent = '이번 달 ' + all.filter(function (x) { return String(x.d).slice(0, 7) === calMonth; }).length + '개';
    var today = F.todayYmd();
    var first = new Date(y, m - 1, 1), start = first.getDay(), last = new Date(y, m, 0).getDate();
    var wd = ['일', '월', '화', '수', '목', '금', '토'];
    var html = wd.map(function (w) { return '<div class="wd">' + w + '</div>'; }).join('');
    for (var i = 0; i < start; i++) html += '<div class="cd emp"></div>';
    for (var day = 1; day <= last; day++) {
      var ds = y + '-' + dv(m) + '-' + dv(day);
      var items = all.filter(function (x) { return x.d === ds; });
      var cls = 'cd' + (ds === today ? ' today' : '') + (ds === calSel ? ' on' : '');
      html += '<div class="' + cls + '" data-day="' + ds + '">' + day +
        (items.length ? '<span class="dots">' + items.slice(0, 3).map(function (x) { return '<i class="' + (x.done ? 'dn' : '') + '"></i>'; }).join('') + '</span>' : '') + '</div>';
    }
    paint(grid, calMonth + today + calSel + JSON.stringify(all.map(function (x) { return [x.d, x.done, x.t]; })), function () { return html; });
    var dayBox = $('v4CalDay');
    if (dayBox) {
      var sel = calSel || today;
      var items2 = all.filter(function (x) { return x.d === sel; }).sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
      paint(dayBox, sel + JSON.stringify(items2), function () {
        var head = '<div class="v4-mini" style="font-weight:800;color:#3C4450;margin-bottom:4px">' + Number(sel.slice(5, 7)) + '월 ' + Number(sel.slice(8, 10)) + '일 일정</div>';
        if (!items2.length) return head + '<div class="v4-empty" style="padding:8px 0">이날은 일정이 없어요</div>';
        return head + items2.map(function (x) {
          return '<div class="v4-row" data-cal="' + x._id + '"><button type="button" class="v4-chk ' + (x.done ? 'on' : '') + '">✓</button>' +
            '<span class="tx"><b style="' + (x.done ? 'text-decoration:line-through;color:#9AA4AF' : '') + '">' + esc(x.t) + '</b><small>' + memEmoji(x.by) + ' ' + esc(memName(x.by)) + ' 추가</small></span>' +
            '<button type="button" class="v4-x" data-cdel="1">✕</button></div>';
        }).join('');
      });
    }
  }

  /* ============================================================
     ⑤ 추억 사진 지도 + XP
     ============================================================ */
  function secMem() {
    return '<div class="card" id="v4Mem"><div class="card-head"><h2>🗺️ 추억 사진 지도</h2><span class="sub" id="v4MemLv">Lv.1</span></div>' +
      '<div id="v4MemTop"></div>' +
      '<div id="v4MemRegion"></div>' +
      '<div class="v4-mini" style="margin-top:9px;font-weight:800;color:#3C4450">추억 기록</div>' +
      '<div id="v4MemList"></div>' +
      '<button type="button" class="btn soft" id="v4MemAdd" style="margin-top:9px">＋ 추억 남기기 (지역·사진)</button>' +
      '<div class="hint">여행 다녀온 곳의 <b>지역 이름</b>과 사진을 올리면 어느 지역에 몇 번 갔는지 자동으로 세어 드려요. 기록이 쌓일수록 우리 가족 추억 경험치(XP)와 레벨이 올라가요.</div></div>';
  }
  function memXP(entries) {
    var regions = {};
    entries.forEach(function (e) { var r = (e.region || '').trim(); if (r) regions[r] = 1; });
    var photos = entries.filter(function (e) { return e.photo && e.photo.thumb; }).length;
    return { xp: entries.length * 30 + Object.keys(regions).length * 25 + photos * 15, regions: Object.keys(regions).length, photos: photos };
  }
  function renderMem() {
    var v = V4(), top = $('v4MemTop'), reg = $('v4MemRegion'), list = $('v4MemList'), lvEl = $('v4MemLv');
    if (!top) return;
    var es = listOf(v.mem).sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    var s = memXP(es);
    var lv = Math.floor(s.xp / 200) + 1, cur = s.xp % 200;
    if (lvEl) lvEl.textContent = 'Lv.' + lv + ' · XP ' + s.xp;
    paint(top, s.xp + '|' + es.length, function () {
      return '<div class="v4-row" style="border-bottom:none;padding-bottom:2px"><span class="e">⭐</span><span class="tx"><b>우리 가족 추억 Lv.' + lv + '</b><small>XP ' + s.xp + ' · 기록 ' + es.length + '개 · 지역 ' + s.regions + '곳 · 사진 ' + s.photos + '장</small></span></div>' +
        '<div class="v4-bar"><i style="width:' + Math.round(cur / 200 * 100) + '%"></i></div>' +
        '<div class="v4-mini" style="margin-top:4px">다음 레벨까지 ' + (200 - cur) + ' XP</div>';
    });
    var counts = {};
    es.forEach(function (e) { var r = (e.region || '').trim(); if (r) counts[r] = (counts[r] || 0) + 1; });
    var arr = Object.keys(counts).map(function (k) { return { r: k, n: counts[k] }; }).sort(function (a, b) { return b.n - a.n; });
    if (reg) {
      paint(reg, JSON.stringify(arr), function () {
        if (!arr.length) return '<div class="v4-empty">아직 추억이 없어요 — 첫 여행을 남겨 보세요</div>';
        var max = arr[0].n;
        return arr.map(function (x) {
          return '<div class="v4-mbar" style="margin-top:6px"><span class="lb">' + esc(x.r) + '</span><span class="bg"><i style="width:' + Math.max(12, Math.round(x.n / max * 100)) + '%"></i></span><span class="n">' + x.n + '회</span></div>';
        }).join('');
      });
    }
    if (list) {
      paint(list, JSON.stringify(es.map(function (e) { return [e._id, e.region, e.place, e.at, !!(e.photo && e.photo.thumb)]; })), function () {
        if (!es.length) return '<div class="v4-empty">지역과 사진을 남기면 여기에 쌓여요</div>';
        return '<div class="v4-thumbs" style="grid-template-columns:repeat(2,1fr)">' + es.slice(0, 12).map(function (e) {
          var img = (e.photo && e.photo.thumb) ? '<img src="' + e.photo.thumb + '" alt="추억 사진" loading="lazy">' : '<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:24px">🧭</div>';
          return '<div class="v4-thumb" style="aspect-ratio:4/3" data-mem="' + e._id + '">' + img +
            '<div class="cap">' + esc(e.region || '지역 미지정') + ' · ' + esc(e.place || '') + '<br>' + memEmoji(e.by) + ' ' + esc(memName(e.by)) + ' · ' + F.ago(e.at) + '</div></div>';
        }).join('') + '</div>';
      });
    }
  }
  function memSheet() {
    F.openSheet('<h3>🗺️ 추억 남기기</h3><div class="sdesc">어디에 다녀왔는지 적어 주세요. 지역 이름을 세어 지도에 쌓아 드려요.</div>' +
      '<div class="form-row"><label>지역 (시·군)</label><input class="field" id="v4MemRegion" maxlength="20" placeholder="예: 속초" list="v4Regions"></div>' +
      '<datalist id="v4Regions"><option value="속초"><option value="파주"><option value="서울"><option value="강릉"><option value="양양"><option value="춘천"><option value="인제"><option value="제주"><option value="부산"><option value="경주"></datalist>' +
      '<div class="form-row"><label>장소 이름</label><input class="field" id="v4MemPlace" maxlength="40" placeholder="예: 영랑호 산책길"></div>' +
      '<div class="form-row"><label>날짜</label><input class="field" id="v4MemDate" type="date" value="' + F.todayYmd() + '"></div>' +
      '<div class="form-row"><label>한 줄 메모</label><input class="field" id="v4MemNote" maxlength="60" placeholder="예: 지율이가 오리 보고 좋아했음"></div>' +
      '<div class="form-row"><label>사진 (선택)</label><button type="button" class="btn ghost" id="v4MemPhoto">📷 사진 고르기</button><div id="v4MemPrev" style="margin-top:7px"></div></div>' +
      '<div style="display:flex;gap:8px;margin-top:6px"><button type="button" class="btn ghost" data-sheet-close>취소</button><button type="button" class="btn" id="v4MemSave">추억 저장</button></div>');
    var photo = null;
    $('v4MemPhoto').onclick = function () {
      F.pickImages(function (files) {
        F.saveMedia(files[0]).then(function (m) {
          photo = m;
          $('v4MemPrev').innerHTML = '<img src="' + m.thumb + '" alt="미리보기" style="width:100%;border-radius:12px">';
        }).catch(function () { toast('사진을 붙이지 못했어요'); });
      }, true);
    };
    $('v4MemSave').onclick = function () {
      var region = ($('v4MemRegion').value || '').trim();
      var place = ($('v4MemPlace').value || '').trim();
      if (!region) { toast('지역 이름을 적어 주세요'); return; }
      var v = V4();
      var id = 'mm' + now().toString(36) + Math.random().toString(36).slice(2, 4);
      v.mem[id] = { region: region, place: place, date: $('v4MemDate').value || F.todayYmd(), note: ($('v4MemNote').value || '').trim(), photo: photo, by: mid(), at: now() };
      save(); renderMem(); F.closeSheet();
      toast('추억을 저장했어요 · XP +30');
    };
  }

  /* ============================================================
     ⑥ 음식 사진 칼로리 분석
     ============================================================ */
  var FOODS = [
    ['밥 한 공기', 310, 60, 6, 1], ['김치찌개', 250, 12, 16, 15], ['된장찌개', 180, 12, 12, 9],
    ['라면', 500, 70, 10, 18], ['짜장면', 700, 110, 20, 18], ['짬뽕', 700, 95, 25, 22],
    ['김밥', 480, 65, 14, 15], ['떡볶이', 400, 75, 8, 8], ['치킨 2조각', 400, 12, 28, 26],
    ['삼겹살 200g', 580, 2, 34, 48], ['불고기', 300, 12, 26, 17], ['비빔밥', 560, 82, 18, 16],
    ['냉면', 550, 90, 13, 14], ['칼국수', 500, 80, 16, 10], ['돈까스', 800, 70, 30, 45],
    ['햄버거', 550, 45, 25, 30], ['피자 1조각', 300, 33, 13, 13], ['감자튀김', 330, 43, 4, 16],
    ['콜라 355ml', 150, 39, 0, 0], ['아메리카노', 5, 1, 0, 0], ['계란후라이', 90, 1, 7, 7],
    ['샐러드', 120, 9, 3, 8], ['사과', 95, 25, 0, 0], ['바나나', 105, 27, 1, 0],
    ['우유 200ml', 125, 10, 6, 7], ['요거트', 130, 17, 5, 4], ['초콜릿', 250, 28, 3, 15],
    ['아이스크림', 250, 30, 4, 13], ['식빵 2장', 300, 55, 9, 4], ['토스트', 350, 40, 9, 17],
    ['순대', 400, 55, 12, 14], ['족발', 600, 10, 50, 40], ['초밥 8개', 480, 78, 18, 6],
    ['우동', 450, 72, 13, 9], ['라볶이', 600, 95, 12, 16], ['갈비탕', 700, 20, 40, 50],
    ['설렁탕', 500, 10, 30, 38], ['부대찌개', 400, 22, 22, 26], ['닭갈비', 500, 30, 35, 26],
    ['파스타', 600, 78, 20, 22], ['샌드위치', 350, 38, 16, 15], ['도넛', 300, 34, 4, 17],
    ['조각 케이크', 400, 45, 5, 22], ['맥주 500ml', 150, 12, 1, 0], ['소주 1병', 400, 0, 0, 0],
    ['과자 한 봉지', 400, 48, 5, 22], ['컵밥', 450, 70, 10, 14], ['핫도그', 350, 33, 12, 19]
  ];
  function foodFind(name) {
    var n = String(name || '').replace(/\s+/g, '');
    if (!n) return null;
    var best = null, bestLen = 0;
    FOODS.forEach(function (f) {
      var k = String(f[0]).replace(/\s+/g, '');
      if (n.indexOf(k) >= 0 || k.indexOf(n) >= 0) { if (k.length > bestLen) { bestLen = k.length; best = f; } }
    });
    return best;
  }
  function secFood() {
    return '<div class="card" id="v4Food"><div class="card-head"><h2>🍽️ 음식 사진 칼로리</h2><span class="sub" id="v4FoodSum">오늘 0kcal</span></div>' +
      '<div class="fb-desc">음식 사진을 올리고 음식을 고르면 칼로리·영양을 간단히 분석해요. 설정에 Gemini 키를 넣으면 사진을 AI가 직접 봐요.</div>' +
      '<div style="display:flex;gap:7px;margin:9px 0 7px"><input class="field" id="v4FoodName" maxlength="30" list="v4FoodList" placeholder="음식 이름 (예: 김치찌개)" style="margin:0;flex:1"><input class="field" id="v4FoodQty" type="number" min="0.5" max="5" step="0.5" value="1" style="margin:0;width:74px"><span style="display:flex;align-items:center;font-size:12px;color:#79838F">인분</span></div>' +
      '<datalist id="v4FoodList">' + FOODS.map(function (f) { return '<option value="' + esc(f[0]) + '">'; }).join('') + '</datalist>' +
      '<div class="v4-flex"><button type="button" class="btn soft" id="v4FoodPhoto" style="padding:11px;font-size:12.5px">📷 음식 사진</button><button type="button" class="btn" id="v4FoodGo" style="padding:11px;font-size:12.5px">🔍 분석하기</button></div>' +
      '<div id="v4FoodPrev" style="margin-top:8px"></div>' +
      '<div id="v4FoodResult" style="margin-top:8px"></div>' +
      '<div id="v4FoodLog" style="margin-top:6px"></div>' +
      '<div id="v4FoodKey" style="margin-top:4px"></div>' +
      '<div class="hint">사진은 가족 저장소에 암호화되어 보관돼요. Gemini 키는 이 기기에만 저장되고 가족에게 공유되지 않아요.</div></div>';
  }
  var foodPhotoBuf = null;
  function renderFood() {
    var v = V4(), sum = $('v4FoodSum'), log = $('v4FoodLog'), keyBox = $('v4FoodKey');
    if (!log) return;
    var es = listOf(v.food).sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    var today = F.todayYmd();
    var todayK = 0;
    es.forEach(function (e) { if (F.ymdOf(e.at) === today) todayK += Number(e.kcal || 0); });
    if (sum) sum.textContent = '오늘 ' + todayK.toLocaleString('ko-KR') + 'kcal';
    paint(log, JSON.stringify(es.slice(0, 30).map(function (e) { return [e._id, e.name, e.kcal, e.at]; })), function () {
      if (!es.length) return '<div class="v4-empty">오늘 먹은 음식을 기록해 보세요</div>';
      return es.slice(0, 12).map(function (e) {
        return '<div class="v4-row"><span class="e">' + (e.photo && e.photo.thumb ? '<img src="' + e.photo.thumb + '" alt="" style="width:26px;height:26px;border-radius:8px;object-fit:cover">' : '🍽️') + '</span>' +
          '<span class="tx"><b>' + esc(e.name) + (e.qty && e.qty !== 1 ? ' × ' + e.qty : '') + '</b><small>' + memEmoji(e.by) + ' ' + esc(memName(e.by)) + ' · ' + F.ago(e.at) + (e.src === 'ai' ? ' · 🤖 AI 분석' : '') + '</small></span>' +
          '<span class="rt"><b>' + Math.round(e.kcal) + '</b>kcal<button type="button" class="v4-x" data-fdel="' + e._id + '" style="display:inline-flex;margin-left:6px;vertical-align:middle">✕</button></span></div>';
      }).join('');
    });
    if (keyBox) {
      paint(keyBox, ls(LS_AI) ? 'has' : 'none', function () {
        if (ls(LS_AI)) return '<div class="v4-mini" style="color:#0A7D56;margin-top:6px">🤖 Gemini 키가 등록되어 사진 자동 분석을 쓸 수 있어요. <button type="button" class="v4-tag gray" id="v4AiOff" style="border:none">키 지우기</button></div>';
        return '<button type="button" class="btn ghost" id="v4AiOn" style="padding:9px;font-size:12px;margin-top:6px">🤖 Gemini API 키 넣고 사진 자동 분석</button>';
      });
    }
  }
  function wireFood() {
    var ph = $('v4FoodPhoto');
    if (ph) ph.addEventListener('click', function () {
      F.pickImages(function (files) {
        F.saveMedia(files[0]).then(function (m) {
          foodPhotoBuf = m;
          $('v4FoodPrev').innerHTML = '<img src="' + m.thumb + '" alt="음식 사진" style="width:100%;border-radius:12px">';
          toast('사진을 붙였어요 — 음식 이름을 적고 분석을 눌러 주세요');
        }).catch(function () { toast('사진을 붙이지 못했어요'); });
      }, true);
    });
    var go = $('v4FoodGo');
    if (go) go.addEventListener('click', function () { analyzeFood(); });
    var log = $('v4FoodLog');
    if (log) log.addEventListener('click', function (e) {
      var b = e.target.closest('[data-fdel]');
      if (!b) return;
      var v = V4(); drop(v.food, b.getAttribute('data-fdel')); save(); renderFood();
    });
    document.addEventListener('click', function (e) {
      if (e.target && e.target.id === 'v4AiOn') {
        F.openSheet('<h3>🤖 Gemini API 키</h3><div class="sdesc">키를 넣으면 음식 사진을 AI가 보고 칼로리를 추정해요. 키는 이 기기에만 저장돼요.</div>' +
          '<div class="form-row"><label>API 키</label><input class="field" id="v4AiKey" placeholder="AIza..." autocomplete="off"></div>' +
          '<div style="display:flex;gap:8px;margin-top:6px"><button type="button" class="btn ghost" data-sheet-close>취소</button><button type="button" class="btn" id="v4AiSave">저장</button></div>' +
          '<div class="hint">Google AI Studio(aistudio.google.com)에서 무료 키를 만들 수 있어요. 키가 없어도 대표 한식·여행 음식 표로 계산돼요.</div>');
        $('v4AiSave').onclick = function () {
          var k = ($('v4AiKey').value || '').trim();
          if (k.length < 10) { toast('키를 확인해 주세요'); return; }
          ls(LS_AI, k); F.closeSheet(); renderFood(); toast('Gemini 키를 저장했어요');
        };
      }
      if (e.target && e.target.id === 'v4AiOff') { ls(LS_AI, ''); renderFood(); toast('키를 지웠어요'); }
      if (e.target && e.target.id === 'v4FoodSave') saveFoodResult();
    });
  }
  var foodDraft = null;
  function analyzeFood() {
    var name = ($('v4FoodName').value || '').trim();
    var qty = Number($('v4FoodQty').value) || 1;
    var key = ls(LS_AI);
    var box = $('v4FoodResult');
    if (!name && !foodPhotoBuf) { toast('음식 이름을 적거나 사진을 올려 주세요'); return; }
    if (key && foodPhotoBuf) {
      box.innerHTML = '<div class="v4-row"><span class="e">🤖</span><span class="tx"><b>사진을 보고 있어요…</b><small>Gemini가 음식과 양을 추정하는 중</small></span></div>';
      F.mediaUrl(foodPhotoBuf.id).then(function (du) {
        return geminiFood(du, name, key);
      }).then(function (r) {
        if (r) { foodDraft = r; showFoodResult(r, qty, 'ai'); }
        else { tableFood(name, qty); }
      }).catch(function () { tableFood(name, qty); });
      return;
    }
    tableFood(name, qty);
  }
  function tableFood(name, qty) {
    var f = foodFind(name);
    var box = $('v4FoodResult');
    if (!f) {
      box.innerHTML = '<div class="v4-row"><span class="e">🤔</span><span class="tx"><b>표에 없는 음식이에요</b><small>대략 1인분 400kcal로 잡았어요. 이름을 조금 바꿔 보세요.</small></span></div>';
      foodDraft = { name: name || '음식', kcal: 400, carb: 50, prot: 15, fat: 15 };
      showFoodResult(foodDraft, qty, 'table');
      return;
    }
    foodDraft = { name: f[0], kcal: f[1], carb: f[2], prot: f[3], fat: f[4] };
    showFoodResult(foodDraft, qty, 'table');
  }
  function showFoodResult(r, qty, src) {
    var box = $('v4FoodResult');
    var kc = Math.round(r.kcal * qty), cb = Math.round((r.carb || 0) * qty), pt = Math.round((r.prot || 0) * qty), ft = Math.round((r.fat || 0) * qty);
    foodDraft = { name: r.name, kcal: kc, carb: cb, prot: pt, fat: ft, qty: qty, src: src };
    box.innerHTML = '<div style="border:1px solid #E9EEF2;border-radius:14px;padding:11px;background:#FBFDFC">' +
      '<div class="v4-row" style="border-bottom:none;padding:0"><span class="e">🍽️</span><span class="tx"><b>' + esc(r.name) + (qty !== 1 ? ' × ' + qty + '인분' : '') + '</b><small>' + (src === 'ai' ? '🤖 사진 AI 분석' : '📋 음식 칼로리 표 기준') + '</small></span><span class="rt"><b style="font-size:15px;color:#0A7D56">' + kc + '</b> kcal</span></div>' +
      '<div class="v4-mini" style="margin-top:5px">탄수화물 ' + cb + 'g · 단백질 ' + pt + 'g · 지방 ' + ft + 'g</div>' +
      '<div class="v4-mini" style="margin-top:3px">' + kcalTip(kc) + '</div>' +
      '<button type="button" class="btn" id="v4FoodSave" style="margin-top:8px;padding:10px;font-size:13px">오늘 기록에 저장</button></div>';
  }
  function kcalTip(k) {
    if (k < 200) return '가벼워요 — 간식으로 딱 좋아요 🌿';
    if (k < 450) return '한 끼로 무난한 양이에요 🙂';
    if (k < 700) return '든든한 한 끼 — 다음 끼니는 조금 가볍게 해도 좋아요';
    return '넉넉한 양이에요 — 오늘은 가볍게 걸어 보는 건 어때요? 🚶';
  }
  function saveFoodResult() {
    if (!foodDraft) return;
    var v = V4();
    var id = 'fd' + now().toString(36) + Math.random().toString(36).slice(2, 4);
    v.food[id] = { name: foodDraft.name, kcal: foodDraft.kcal, carb: foodDraft.carb, prot: foodDraft.prot, fat: foodDraft.fat, qty: foodDraft.qty || 1, src: foodDraft.src || 'table', photo: foodPhotoBuf, by: mid(), at: now() };
    foodPhotoBuf = null;
    var prev = $('v4FoodPrev'); if (prev) prev.innerHTML = '';
    var res = $('v4FoodResult'); if (res) res.innerHTML = '';
    var inp = $('v4FoodName'); if (inp) inp.value = '';
    save(); renderFood(); toast('오늘 먹은 음식으로 기록했어요');
  }
  function geminiFood(dataUrl, hint, key) {
    var b64 = String(dataUrl).split(',')[1] || '';
    var prompt = '음식 사진을 보고 음식 이름과 1인분 기준 영양을 추정해. ' +
      (hint ? '사용자가 적은 음식 이름: ' + hint + '. ' : '') +
      '아래 JSON만 출력해: {"name":"음식이름(한국어)","kcal":숫자,"carb":숫자,"prot":숫자,"fat":숫자}';
    return fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + encodeURIComponent(key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: b64 } }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 200 }
      })
    }).then(function (r) { if (!r.ok) throw new Error('AI ' + r.status); return r.json(); }).then(function (j) {
      var txt = j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts &&
        j.candidates[0].content.parts.map(function (p) { return p.text || ''; }).join('') || '';
      var m = txt.match(/\{[\s\S]*\}/);
      if (!m) return null;
      var o = JSON.parse(m[0]);
      if (!o || !o.kcal) return null;
      return { name: o.name || hint || '음식', kcal: Number(o.kcal) || 0, carb: Number(o.carb) || 0, prot: Number(o.prot) || 0, fat: Number(o.fat) || 0 };
    });
  }

  /* ============================================================
     ⑦ 좋아하는 것
     ============================================================ */
  function secLike() {
    return '<div class="card" id="v4Like"><div class="card-head"><h2>💗 우리가 좋아하는 것</h2><span class="sub">서로 알아 가기</span></div>' +
      '<div id="v4LikeList"></div>' +
      '<div class="hint">각자 좋아하는 음식·취미·관심사를 적어 두면 선물·여행 계획에 도움이 돼요.</div></div>';
  }
  function renderLike() {
    var v = V4(), box = $('v4LikeList');
    if (!box) return;
    var ms = F.members();
    paint(box, JSON.stringify(v.like), function () {
      return ms.map(function (m) {
        var r = v.like[m.id] || {};
        var body = [['🍚', '음식', r.food], ['🎮', '취미', r.hobby], ['✨', '관심사', r.interest], ['🌈', '요즘 바람', r.wish]].filter(function (x) { return x[2]; })
          .map(function (x) { return '<small>' + x[0] + ' ' + x[1] + ' · ' + esc(x[2]) + '</small>'; }).join('');
        return '<div class="v4-row"><span class="e">' + (m.emoji || '🧑') + '</span><span class="tx"><b>' + esc(m.name) + '</b>' + (body || '<small>아직 비어 있어요 — 눌러서 알려 주세요</small>') + '</span>' +
          '<button type="button" class="v4-tag gray" data-like="' + m.id + '" style="border:none">' + (r.food ? '수정' : '적기') + '</button></div>';
      }).join('');
    });
  }
  function likeSheet(id) {
    var v = V4(), r = v.like[id] || {};
    var m = F.memOf(id);
    F.openSheet('<h3>' + (m.emoji || '🧑') + ' ' + esc(m.name) + ' 님이 좋아하는 것</h3>' +
      '<div class="sdesc">가족이 알아 두면 선물하기 좋아요.</div>' +
      '<div class="form-row"><label>좋아하는 음식</label><input class="field" id="v4LkFood" maxlength="40" value="' + esc(r.food || '') + '"></div>' +
      '<div class="form-row"><label>취미</label><input class="field" id="v4LkHobby" maxlength="40" value="' + esc(r.hobby || '') + '"></div>' +
      '<div class="form-row"><label>관심사</label><input class="field" id="v4LkInterest" maxlength="40" value="' + esc(r.interest || '') + '"></div>' +
      '<div class="form-row"><label>요즘 바라는 것</label><input class="field" id="v4LkWish" maxlength="40" value="' + esc(r.wish || '') + '"></div>' +
      '<div style="display:flex;gap:8px;margin-top:6px"><button type="button" class="btn ghost" data-sheet-close>취소</button><button type="button" class="btn" id="v4LkSave">저장</button></div>');
    $('v4LkSave').onclick = function () {
      var vv = V4();
      vv.like[id] = { food: ($('v4LkFood').value || '').trim(), hobby: ($('v4LkHobby').value || '').trim(), interest: ($('v4LkInterest').value || '').trim(), wish: ($('v4LkWish').value || '').trim(), at: now() };
      save(); renderLike(); F.closeSheet(); toast('저장했어요');
    };
  }

  /* ============================================================
     ⑧ 고민 · 조언
     ============================================================ */
  function secWorry() {
    return '<div class="card" id="v4Worry"><div class="card-head"><h2>🤝 고민 나누기</h2><span class="sub" id="v4WorryN">0개</span></div>' +
      '<div class="fb-desc">혼자 고민하지 말고 적어 보세요. 가족이 조언·격려·응원 댓글을 남겨요.</div>' +
      '<div class="fb-write" style="margin-top:8px"><textarea class="field" id="v4WorryIn" rows="2" maxlength="200" placeholder="예: 요즘 공부가 잘 안 돼서 속상해요"></textarea>' +
      '<div class="fb-write-foot"><span class="fb-as" id="v4WorryAs">작성자 · 나</span><button type="button" class="btn fb-send" id="v4WorryAdd" style="background:#8B7CF6">고민 남기기</button></div></div>' +
      '<div id="v4WorryList" class="fb-list" style="margin-top:9px"></div></div>';
  }
  function renderWorry() {
    var v = V4(), box = $('v4WorryList'), n = $('v4WorryN'), as = $('v4WorryAs');
    if (!box) return;
    if (as && me()) as.textContent = '작성자 · ' + memEmoji(mid()) + ' ' + me().name;
    var es = listOf(v.worry).sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    if (n) n.textContent = es.length + '개';
    paint(box, JSON.stringify(es.map(function (e) { return [e._id, e.text, count(v.adv[e._id])]; })), function () {
      if (!es.length) return '<div class="v4-empty">아직 남긴 고민이 없어요</div>';
      return es.slice(0, 20).map(function (e) {
        var advs = listOf(v.adv[e._id] || {}).sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
        var mine = e.by === mid();
        return '<div style="border:1px solid #E9EEF2;border-radius:14px;padding:11px;background:#fff;margin-bottom:8px">' +
          '<div class="v4-row" style="border-bottom:none;padding:0"><span class="e">' + memEmoji(e.by) + '</span><span class="tx"><b>' + esc(memName(e.by)) + '</b><small>' + F.ago(e.at) + '</small></span>' +
          (mine ? '<button type="button" class="v4-x" data-wdel="' + e._id + '">✕</button>' : '') + '</div>' +
          '<div style="font-size:13px;line-height:1.55;margin:6px 0 2px;word-break:keep-all">' + esc(e.text).replace(/\n/g, '<br>') + '</div>' +
          (advs.length ? advs.map(function (a) {
            return '<div class="v4-adv"><b>' + memEmoji(a.by) + ' ' + esc(memName(a.by)) + '</b> <span style="color:#9AA4AF;font-size:10.5px">' + F.ago(a.at) + '</span><br>' + esc(a.text).replace(/\n/g, '<br>') + '</div>';
          }).join('') : '<div class="v4-mini" style="margin-top:5px">아직 조언이 없어요 — 첫 마음을 전해 주세요</div>') +
          '<div style="display:flex;gap:6px;margin-top:7px"><input class="field" data-adv-in="' + e._id + '" maxlength="120" placeholder="격려·조언 한마디" style="margin:0;flex:1;padding:9px 11px;font-size:12.5px"><button type="button" class="btn soft" data-adv-send="' + e._id + '" style="width:auto;padding:0 12px;border-radius:11px;font-size:12px">남기기</button></div>' +
          '</div>';
      }).join('');
    });
  }
  function wireWorry() {
    var add = $('v4WorryAdd'), inp = $('v4WorryIn');
    if (add) add.addEventListener('click', function () {
      var text = (inp.value || '').trim();
      if (!text) { toast('고민 내용을 적어 주세요'); return; }
      var v = V4(), id = 'wr' + now().toString(36) + Math.random().toString(36).slice(2, 4);
      v.worry[id] = { text: text, by: mid(), at: now() };
      inp.value = ''; save(); renderWorry(); toast('고민을 남겼어요 — 가족이 함께 볼 거예요');
    });
    var list = $('v4WorryList');
    if (list) list.addEventListener('click', function (e) {
      var del = e.target.closest('[data-wdel]');
      if (del) { var v = V4(); drop(v.worry, del.getAttribute('data-wdel')); save(); renderWorry(); return; }
      var send = e.target.closest('[data-adv-send]');
      if (send) {
        var wid = send.getAttribute('data-adv-send');
        var inp2 = list.querySelector('[data-adv-in="' + wid + '"]');
        var text = (inp2 && inp2.value || '').trim();
        if (!text) { toast('한마디를 적어 주세요'); return; }
        var v2 = V4();
        if (!v2.adv[wid]) v2.adv[wid] = {};
        var aid = 'ad' + now().toString(36) + Math.random().toString(36).slice(2, 4);
        v2.adv[wid][aid] = { text: text, by: mid(), at: now() };
        if (inp2) inp2.value = '';
        save(); renderWorry();
        var owner = (v2.worry[wid] || {}).by;
        if (owner && owner !== mid()) toast('조언을 남겼어요');
      }
    });
  }

  /* ============================================================
     ⑨ 위시리스트 (최저가 바로 연결)
     ============================================================ */
  function shopLinks(name) {
    var q = encodeURIComponent(name || '');
    return {
      danawa: 'https://search.danawa.com/dsearch.php?query=' + q,
      naver: 'https://search.shopping.naver.com/search/all?query=' + q,
      coupang: 'https://www.coupang.com/np/search?q=' + q
    };
  }
  function secWish() {
    return '<div class="card" id="v4Wish"><div class="card-head"><h2>🎁 갖고 싶은 선물 위시리스트</h2><span class="sub" id="v4WishN">0개</span></div>' +
      '<div class="fb-desc">갖고 싶은 것을 올려 두면 다나와·네이버·쿠팡 <b>최저가 검색</b>으로 바로 넘어가요.</div>' +
      '<div id="v4WishList" style="margin-top:9px"></div>' +
      '<button type="button" class="btn soft" id="v4WishAdd" style="margin-top:4px">＋ 위시리스트에 올리기</button></div>';
  }
  function renderWish() {
    var v = V4(), box = $('v4WishList'), n = $('v4WishN');
    if (!box) return;
    var es = listOf(v.wish).sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    if (n) n.textContent = es.length + '개';
    paint(box, JSON.stringify(es.map(function (e) { return [e._id, e.name, e.price, e.got, count(e.dibs)]; })), function () {
      if (!es.length) return '<div class="v4-empty">아직 위시리스트가 비어 있어요</div>';
      return es.map(function (e) {
        var l = shopLinks(e.name);
        var dibs = e.dibs || {};
        var mineDib = !!dibs[mid()];
        var dibsN = count(dibs);
        return '<div class="v4-wish">' +
          '<div class="v4-row" style="border-bottom:none;padding:0"><span class="e">' + (e.photo && e.photo.thumb ? '<img src="' + e.photo.thumb + '" alt="" style="width:30px;height:30px;border-radius:9px;object-fit:cover">' : '🎁') + '</span>' +
          '<span class="tx"><b>' + esc(e.name) + '</b><small>' + (e.price ? esc(e.price) + ' · ' : '') + memEmoji(e.by) + ' ' + esc(memName(e.by)) + (e.memo ? ' · ' + esc(e.memo) : '') + '</small></span>' +
          (e.got ? '<span class="v4-tag">선물 완료 🎉</span>' : '') + '</div>' +
          '<div class="v4-links"><a class="dn" href="' + l.danawa + '" target="_blank" rel="noopener">다나와 최저가</a>' +
          '<a class="nv" href="' + l.naver + '" target="_blank" rel="noopener">네이버 쇼핑</a>' +
          '<a class="cp" href="' + l.coupang + '" target="_blank" rel="noopener">쿠팡</a>' +
          '<button type="button" class="v4-tag ' + (mineDib ? '' : 'gray') + '" data-wdib="' + e._id + '" style="border:none">' + (mineDib ? '❤️ 찜함' : '🤍 찜하기') + (dibsN ? ' ' + dibsN : '') + '</button>' +
          '<button type="button" class="v4-tag ' + (e.got ? '' : 'gray') + '" data-wgot="' + e._id + '" style="border:none">사주기</button>' +
          (e.by === mid() ? '<button type="button" class="v4-tag gray" data-wdel2="' + e._id + '" style="border:none">삭제</button>' : '') + '</div></div>';
      }).join('');
    });
  }
  function wishSheet() {
    F.openSheet('<h3>🎁 위시리스트</h3><div class="sdesc">갖고 싶은 것을 올려 두면 가족이 보고 선물을 고를 수 있어요.</div>' +
      '<div class="form-row"><label>갖고 싶은 것</label><input class="field" id="v4WsName" maxlength="40" placeholder="예: 무선 이어폰"></div>' +
      '<div class="form-row"><label>가격대 (선택)</label><input class="field" id="v4WsPrice" maxlength="20" placeholder="예: 5~7만원"></div>' +
      '<div class="form-row"><label>메모 (선택)</label><input class="field" id="v4WsMemo" maxlength="50" placeholder="예: 흰색이면 좋아요"></div>' +
      '<div class="form-row"><label>사진 (선택)</label><button type="button" class="btn ghost" id="v4WsPhoto">📷 사진 고르기</button><div id="v4WsPrev" style="margin-top:7px"></div></div>' +
      '<div style="display:flex;gap:8px;margin-top:6px"><button type="button" class="btn ghost" data-sheet-close>취소</button><button type="button" class="btn" id="v4WsSave">올리기</button></div>');
    var photo = null;
    $('v4WsPhoto').onclick = function () {
      F.pickImages(function (files) {
        F.saveMedia(files[0]).then(function (m) { photo = m; $('v4WsPrev').innerHTML = '<img src="' + m.thumb + '" style="width:100%;border-radius:12px">'; });
      }, true);
    };
    $('v4WsSave').onclick = function () {
      var name = ($('v4WsName').value || '').trim();
      if (!name) { toast('무엇을 갖고 싶은지 적어 주세요'); return; }
      var v = V4(), id = 'ws' + now().toString(36) + Math.random().toString(36).slice(2, 4);
      v.wish[id] = { name: name, price: ($('v4WsPrice').value || '').trim(), memo: ($('v4WsMemo').value || '').trim(), photo: photo, by: mid(), at: now(), got: 0, dibs: {} };
      save(); renderWish(); F.closeSheet(); toast('위시리스트에 올렸어요');
    };
  }
  function wireWish() {
    var add = $('v4WishAdd');
    if (add) add.addEventListener('click', wishSheet);
    var box = $('v4WishList');
    if (box) box.addEventListener('click', function (e) {
      var v = V4();
      var d1 = e.target.closest('[data-wdib]');
      if (d1) {
        var id = d1.getAttribute('data-wdib'), rec = v.wish[id];
        if (!rec) return;
        if (!rec.dibs) rec.dibs = {};
        if (rec.dibs[mid()]) delete rec.dibs[mid()]; else rec.dibs[mid()] = now();
        rec.at = now();
        save(); renderWish(); return;
      }
      var d2 = e.target.closest('[data-wgot]');
      if (d2) {
        var r2 = v.wish[d2.getAttribute('data-wgot')];
        if (!r2) return;
        r2.got = r2.got ? 0 : 1; r2.at = now();
        save(); renderWish();
        toast(r2.got ? '선물 완료로 표시했어요 🎉' : '다시 위시로 돌렸어요');
        return;
      }
      var d3 = e.target.closest('[data-wdel2]');
      if (d3) { drop(v.wish, d3.getAttribute('data-wdel2')); save(); renderWish(); }
    });
  }

  /* ============================================================
     ⑩ 유튜브 · 도서 · 게임 소식
     ============================================================ */
  var TUBE = [
    { e: '😆', t: '흔한남매', d: '온 가족이 웃는 인기 채널', u: 'https://www.youtube.com/results?search_query=%ED%9D%94%ED%95%9C%EB%82%A8%EB%A7%A4' },
    { e: '🎮', t: '인기 게임 영상', d: '마인크래프트·로블록스·브롤스타즈', u: 'https://www.youtube.com/results?search_query=%EC%9D%B8%EA%B8%B0+%EA%B2%8C%EC%9E%84+%EC%98%81%EC%83%81' },
    { e: '🧸', t: '미쁠 유튜브', d: '우리 가족 이야기 채널', u: 'https://www.youtube.com/results?search_query=%EB%AF%B8%EB%BF%A0' },
    { e: '🎵', t: '가족 노래방', d: '신나는 동요·가요', u: 'https://www.youtube.com/results?search_query=%EA%B0%80%EC%A1%B1+%EB%85%B8%EB%9E%98%EB%B0%A9' }
  ];
  var BOOKS = [
    { e: '📚', t: '어린이 베스트셀러', d: '예스24 어린이 도서 순위', u: 'https://www.yes24.com/Product/Category/BestSeller?categoryNumber=001001003' },
    { e: '📖', t: '알라딘 베스트', d: '이번 주 많이 읽는 책', u: 'https://www.aladin.co.kr/shop/common/wbest.aspx?BestType=Bestseller&BranchType=1&CID=1' },
    { e: '🕹️', t: '게임 신작 소식', d: '게임메카 뉴스', u: 'https://www.gamemeca.com/news.php' },
    { e: '🎲', t: '닌텐도 소식', d: '아이들이 좋아하는 신작', u: 'https://www.nintendo.co.kr/' }
  ];
  function secTube() {
    return '<div class="card" id="v4Tube"><div class="card-head"><h2>📺 유튜브·도서·게임 소식</h2><span class="sub">로그인 없이 바로</span></div>' +
      '<div class="v4-mini" style="margin:-4px 0 6px">계정 비밀번호를 공유하지 않아도 바로 볼 수 있는 링크만 모았어요.</div>' +
      '<div style="font-size:12px;font-weight:800;color:#3C4450;margin:6px 0 2px">🎬 영상 추천</div>' +
      TUBE.map(tubeHtml).join('') +
      '<div style="font-size:12px;font-weight:800;color:#3C4450;margin:12px 0 2px">📚 도서·게임 소식</div>' +
      BOOKS.map(tubeHtml).join('') +
      '<div id="v4TubeList"></div>' +
      '<button type="button" class="btn ghost" id="v4TubeAdd" style="margin-top:9px;padding:10px;font-size:12.5px">＋ 우리 가족 링크 추가</button></div>';
  }
  function tubeHtml(o) {
    return '<a class="v4-tube" href="' + o.u + '" target="_blank" rel="noopener"><span class="th">' + o.e + '</span><span class="tx"><b>' + esc(o.t) + '</b><small>' + esc(o.d) + '</small></span><span style="color:#9AA4AF;font-size:12px">↗</span></a>';
  }
  function renderTube() {
    var v = V4(), box = $('v4TubeList');
    if (!box) return;
    var es = listOf(v.board).sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    paint(box, JSON.stringify(es.map(function (e) { return [e._id, e.title, e.url]; })), function () {
      if (!es.length) return '';
      return '<div style="font-size:12px;font-weight:800;color:#3C4450;margin:12px 0 2px">👨‍👩‍👧‍👦 우리가 추가한 링크</div>' + es.map(function (e) {
        return '<a class="v4-tube" href="' + esc(e.url) + '" target="_blank" rel="noopener"><span class="th">' + (e.kind === 'book' ? '📚' : (e.kind === 'game' ? '🕹️' : '🎬')) + '</span><span class="tx"><b>' + esc(e.title) + '</b><small>' + esc(e.desc || e.url) + ' · ' + esc(memName(e.by)) + '</small></span><span style="color:#9AA4AF;font-size:12px">↗</span></a>';
      }).join('');
    });
  }
  function wireTube() {
    var add = $('v4TubeAdd');
    if (add) add.addEventListener('click', function () {
      F.openSheet('<h3>＋ 우리 가족 링크</h3><div class="sdesc">아이들과 함께 볼 영상·책·게임 소식 링크를 남겨 주세요.</div>' +
        '<div class="form-row"><label>제목</label><input class="field" id="v4TbTitle" maxlength="40" placeholder="예: 지섭이 추천 게임 영상"></div>' +
        '<div class="form-row"><label>주소(링크)</label><input class="field" id="v4TbUrl" placeholder="https://" inputmode="url"></div>' +
        '<div class="form-row"><label>종류</label><select class="field" id="v4TbKind"><option value="youtube">유튜브 영상</option><option value="book">책</option><option value="game">게임</option></select></div>' +
        '<div style="display:flex;gap:8px;margin-top:6px"><button type="button" class="btn ghost" data-sheet-close>취소</button><button type="button" class="btn" id="v4TbSave">추가</button></div>');
      $('v4TbSave').onclick = function () {
        var title = ($('v4TbTitle').value || '').trim();
        var url = ($('v4TbUrl').value || '').trim();
        if (!title || !url) { toast('제목과 주소를 적어 주세요'); return; }
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
        var v = V4(), id = 'tb' + now().toString(36) + Math.random().toString(36).slice(2, 4);
        v.board[id] = { title: title, url: url, kind: $('v4TbKind').value, by: mid(), at: now() };
        save(); renderTube(); F.closeSheet(); toast('링크를 추가했어요');
      };
    });
  }

  /* ============================================================
     연결 · 렌더
     ============================================================ */
  function wireCommon() {
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-jump]');
      if (t) { try { jump(JSON.parse(t.getAttribute('data-jump'))); } catch (err) {} return; }
    });
    var ma = $('v4MemAdd');
    if (ma) ma.addEventListener('click', memSheet);
  }

  function mount(FAM) {
    if (ON) return;
    F = FAM; ON = true;
    style();
    buildIndex();
    buildFab();
    buildLife();
    wireCommon();
    wireNotif(); wireGeo(); wireFood(); wireWorry(); wireWish(); wireTube();
    if (!ls(LS_GEO + '_note')) ls(LS_GEO + '_note', '1');
    if (!ls(LS_GEO + '_vib')) ls(LS_GEO + '_vib', '1');
    try { if (!localStorage.getItem(LS_SEEN)) localStorage.setItem(LS_SEEN, JSON.stringify(snapshot())); } catch (e) {}
    bumpVisit();
    render();
    /* 앱을 열어 둔 동안 내 위치를 주기적으로 갱신(도착 알림 정확도) */
    if (geoPing) clearInterval(geoPing);
    geoPing = setInterval(function () {
      if (document.hidden || !F || !F.me()) return;
      var g = V4().geo;
      if (!g.home && !g.school) return;
      if (now() - lastPing < 45000) return;
      lastPing = now();
      F.locate(null);
    }, 20000);
  }

  function render() {
    if (!ON || !F || !F.doc() || !F.me()) return;
    style();
    renderVisit(); renderGeo(); renderNotifState();
    renderTodo(); renderCal(); renderMem(); renderFood();
    renderLike(); renderWorry(); renderWish(); renderTube();
    geoCheck();
    notifCheck();
  }

  function onView(v) {
    if (!ON) return;
    if (v === 'all') render();
    if (v === 'life') { renderTodo(); renderCal(); }
  }

  global.FAM4 = {
    mount: mount,
    render: render,
    onView: onView,
    notify: notify,
    jump: jump,
    V4: V4,
    dist: dist
  };

  /* 본체(index.html)에서 부르는 갈고리 */
  global.__FAM_RENDER = function () {
    if (global.FAM4) { try { global.FAM4.render(); } catch (e) { console.warn('FAM4 render', e); } }
    if (global.GAME4) { try { global.GAME4.render(); } catch (e) { console.warn('GAME4 render', e); } }
  };
  global.__FAM_VIEW = function (v) {
    if (global.FAM4) { try { global.FAM4.onView(v); } catch (e) {} }
    if (global.GAME4) { try { global.GAME4.onView(v); } catch (e) {} }
  };
})(window);
