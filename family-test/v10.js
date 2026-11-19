/* ============================================================================
   우리가족포털 V12 — 하단 탭 1개 = 기능 1개 (정보구조 정리)
   ----------------------------------------------------------------------------
   · 하단 탭 5개: 홈 · 소통 · 일정 · 기록 · 우리집
   · 탭 안에서는 헤더의 서브 칩으로 '한 번에 한 기능'만 보여 준다.
       소통   : 채팅 · 편지 · 일기 · 공지 · 응원 · 의견
       일정   : 달력 · 근무·등교 · 디데이·목표 · 용돈 · 상벌점 · 약속
       기록   : 날짜별 기록 · 사진첩 · 위치 · 백업
       우리집 : 가족 · 마음·선물 · 소식 · 추천 · 생활도구
   · 카드는 옮기기만 하고(id 보존) 각 모듈의 렌더 함수는 그대로 살려 둔다.
   · 화면(섹션) 표시는 본체의 switchView 가 맡고, 여기서는 탭·칩·패널만 맞춘다.
   ========================================================================== */
(function (global) {
  'use strict';

  var DOC_ = document;
  var F = null;
  var booted = false;
  var activeTab = 'home';
  var activeItem = 'today';
  var pending = null;       /* 탭에서 직접 고른 항목 — switchView 의 자동 동기화가 덮어쓰지 않게 */
  var softNav = false;

  function $(id) { return DOC_.getElementById(id); }
  function q(s, r) { return (r || DOC_).querySelector(s); }
  function qa(s, r) { return Array.prototype.slice.call((r || DOC_).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function memLabel() {
    try {
      var m = F.me();
      return m ? ((m.name || '가족') + (m.role && m.role !== '가족' ? ' ' + m.role : '')) : '우리 가족';
    } catch (e) { return '우리 가족'; }
  }
  function keepCssLast() {
    var link = q('link[href*="v10.css"]');
    if (link && link.parentNode === DOC_.head && DOC_.head.lastElementChild !== link) {
      DOC_.head.appendChild(link);
    }
  }

  /* ---------------------------------------------------------------- 1. 탭 정의 */
  var TABS = [
    {
      id: 'home', label: '홈', items: [
        { id: 'today', label: '오늘', view: 'home' }
      ]
    },
    {
      id: 'share', label: '소통', items: [
        { id: 'chat', label: '💬 채팅', view: 'chat' },
        { id: 'letters', label: '✉️ 편지', view: 'life', panel: 'letters' },
        { id: 'diary', label: '📔 일기', view: 'life', panel: 'diary' },
        { id: 'notices', label: '📢 공지', view: 'life', panel: 'notices' },
        { id: 'cheer', label: '💬 응원', view: 'life', panel: 'cheer' },
        { id: 'fb', label: '💡 의견', view: 'life', panel: 'feedback' }
      ]
    },
    {
      id: 'sched', label: '일정', items: [
        { id: 'cal', label: '📅 달력', view: 'sched', pane: 'cal' },
        { id: 'shift', label: '🗓️ 근무·등교', view: 'sched', pane: 'shift' },
        { id: 'dday', label: '🎂 디데이·목표', view: 'sched', pane: 'dday' },
        { id: 'money', label: '💰 용돈', view: 'sched', pane: 'money' },
        { id: 'sb', label: '🏅 상벌점', view: 'sched', pane: 'sb' },
        { id: 'plan', label: '📌 약속', view: 'sched', pane: 'plan' }
      ]
    },
    {
      id: 'record', label: '기록', items: [
        { id: 'day', label: '🗂️ 날짜별 기록', view: 'record', pane: 'day' },
        { id: 'album', label: '📷 사진첩', view: 'photos' },
        { id: 'place', label: '📍 위치', view: 'map' },
        { id: 'backup', label: '⬇️ 백업', view: 'record', pane: 'backup' }
      ]
    },
    {
      id: 'house', label: '우리집', items: [
        { id: 'family', label: '👨‍👩‍👧‍👦 가족', view: 'house', pane: 'family' },
        { id: 'mind', label: '💗 마음·선물', view: 'house', pane: 'mind' },
        { id: 'news', label: '📰 소식', view: 'house', pane: 'news' },
        { id: 'reco', label: '🍽️ 추천', view: 'life', panel: 'reco' },
        { id: 'tools', label: '🧰 생활도구', view: 'house', pane: 'tools' }
      ]
    }
  ];

  function tabOf(id) { return TABS.filter(function (t) { return t.id === id; })[0] || null; }
  function itemOf(tabId, itemId) {
    var t = tabOf(tabId);
    if (!t) return null;
    return t.items.filter(function (i) { return i.id === itemId; })[0] || t.items[0];
  }

  /* ---------------------------------------------------------------- 2. 카드 → 패널 배치도 */
  var PANE_OF = {
    /* 일정 */
    famCalBanner: 'pane-sched-cal',
    v9ShiftCard: 'pane-sched-shift', v9SchoolCard: 'pane-sched-shift',
    v9DdayCard: 'pane-sched-dday', v9GoalsCard: 'pane-sched-dday',
    v9Money: 'pane-sched-money',
    v9SbCard: 'pane-sched-sb',
    v10PlanCard: 'pane-sched-plan', v10PlanForm: 'pane-sched-plan',
    /* 기록 */
    v9Arch: 'pane-record-backup',
    /* 우리집 */
    houseHero: 'pane-house-family', v4Visit: 'pane-house-family', v9SleepCard: 'pane-house-family',
    v4Geo: 'pane-house-family',
    v9Wish: 'pane-house-mind', v4Worry: 'pane-house-mind',
    v9NewsCard: 'pane-house-news', v9WkCard: 'pane-house-news', v4Tube: 'pane-house-news',
    v4Food: 'pane-house-tools', v9LogCard: 'pane-house-tools', v4Notif: 'pane-house-tools',
    v4Mem: 'pane-house-tools',
    /* 소통 > 응원 */
    cheerCardTop: 'pane-share-cheer', v9QuoteCard: 'pane-share-cheer'
  };

  var PANE_ORDER = {
    'view-sched': ['pane-sched-cal', 'pane-sched-shift', 'pane-sched-dday', 'pane-sched-money', 'pane-sched-sb', 'pane-sched-plan'],
    'view-record': ['pane-record-day', 'pane-record-backup'],
    'view-house': ['pane-house-family', 'pane-house-mind', 'pane-house-news', 'pane-house-tools']
  };

  function ensurePane(id) {
    var el = $(id);
    if (el) return el;
    var secId = id.indexOf('pane-sched-') === 0 ? 'view-sched'
      : (id.indexOf('pane-record-') === 0 ? 'view-record' : 'view-house');
    var host = $(secId);
    if (!host) return null;
    el = DOC_.createElement('div');
    el.id = id;
    el.className = 'pane';
    /* 순서에 맞는 자리에 넣는다 */
    var order = PANE_ORDER[secId] || [];
    var before = null;
    var idx = order.indexOf(id);
    for (var i = idx + 1; i < order.length && !before; i++) before = $(order[i]);
    if (before && before.parentNode === host) host.insertBefore(el, before);
    else host.appendChild(el);
    return el;
  }

  /* view-life 안의 패널(편지·일기·공지·의견·응원·추천) */
  function ensureLifePanel(name) {
    var id = 'life-' + name;
    if ($(id)) return $(id);
    var host = $('view-life');
    if (!host) return null;
    if (name === 'cheer') {
      var d = DOC_.createElement('div');
      d.id = id;
      d.className = 'hidden';
      host.appendChild(d);
      return d;
    }
    return null;
  }

  /* ---------------------------------------------------------------- 3. 탭·칩 표시 */
  function paintSub(tabId) {
    var host = $('v10Sub');
    if (!host) return;
    var tab = tabOf(tabId);
    var items = (tab && tab.items) || [];
    if (items.length <= 1) { host.innerHTML = ''; host.classList.add('is-empty'); return; }
    host.classList.remove('is-empty');
    var html = items.map(function (it) {
      return '<button type="button" data-v10item="' + it.id + '" aria-label="' + esc(it.label) + '">' + esc(it.label) + '</button>';
    }).join('');
    if (host.__sig !== html) { host.__sig = html; host.innerHTML = html; }
  }
  function mark(tabId, itemId) {
    activeTab = tabId;
    activeItem = itemId || (itemOf(tabId) || {}).id || '';
    qa('#tabbar button[data-v10tab]').forEach(function (b) {
      var on = b.getAttribute('data-v10tab') === tabId;
      b.classList.toggle('on', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    paintSub(tabId);
    qa('#v10Sub [data-v10item]').forEach(function (b) {
      var on = b.getAttribute('data-v10item') === activeItem;
      b.classList.toggle('on', on);
      if (on && b.scrollIntoView) { try { b.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) { } }
    });
  }

  function paneId(tabId, pane) { return (String(pane).indexOf('pane-') === 0) ? pane : ('pane-' + tabId + '-' + pane); }
  function showPane(id) {
    if (!id) return;
    var el = $(id);
    if (!el) return;
    var sec = el.parentNode;
    if (!sec) return;
    Array.prototype.forEach.call(sec.children, function (ch) {
      if (ch.classList && ch.classList.contains('pane')) ch.classList.toggle('on', ch === el);
    });
  }

  /* ---------------------------------------------------------------- 4. 이동 */
  function go(tabId, itemId, opts) {
    var tab = tabOf(tabId);
    if (!tab) return;
    var item = itemOf(tabId, itemId);
    if (!item) return;
    mark(tabId, item.id);
    if (item.pane) showPane(paneId(tabId, item.pane));
    pending = item.id;
    softNav = !!(opts && opts.soft);
    try {
      if (item.panel) {
        if (F.openLife) F.openLife(item.panel);
        else F.view('life');
      } else if (item.view) {
        F.view(item.view);
      }
    } finally {
      softNav = false;
      pending = null;
    }
    /* 화면이 바뀐 뒤 그 패널의 렌더를 한 번 더(늦게 만들어지는 카드 대비) */
    setTimeout(function () { try { arrange(); if (item.pane) showPane(paneId(tabId, item.pane)); } catch (e) { } }, 60);
    if (!(opts && opts.keepScroll) && item.view !== 'chat') {
      try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch (e) { }
    }
  }

  /* 외부(F.view 등)에서 화면이 바뀌면 탭 표시를 따라간다 */
  function sync(v) {
    try {
      if (v === 'home') { mark('home', 'today'); return; }
      if (v === 'chat') { mark('share', pending || 'chat'); return; }
      if (v === 'photos') { mark('record', pending || 'album'); return; }
      if (v === 'map') { mark('record', pending || 'place'); return; }
      if (v === 'life') {
        var on = q('#lifeNav button.on');
        var t = on ? on.getAttribute('data-life') : 'letters';
        var mapL = { letters: 'letters', notices: 'notices', diary: 'diary', feedback: 'fb', cheer: 'cheer', reco: 'reco', money: 'money' };
        if (t === 'money') { mark('sched', 'money'); return; }
        if (t === 'reco') { mark('house', 'reco'); return; }
        mark('share', pending || mapL[t] || 'letters');
        return;
      }
      if (v === 'sched') { mark('sched', pending || activeItem || 'cal'); return; }
      if (v === 'record') { mark('record', pending || activeItem || 'day'); return; }
      if (v === 'all' || v === 'house') { mark('house', pending || activeItem || 'family'); return; }
    } catch (e) { }
  }

  /* ---------------------------------------------------------------- 5. 홈 히어로 */
  function mono(n) { return n < 10 ? '0' + n : '' + n; }
  var WD = ['일', '월', '화', '수', '목', '금', '토'];

  function buildHero() {
    var home = $('view-home');
    if (!home || $('v10Hero')) return;
    var now = new Date();
    var d = DOC_.createElement('div');
    d.className = 'v10-hero';
    d.id = 'v10Hero';
    d.innerHTML =
      '<div class="v10-hero-top">' +
      '<div>' +
      '<div class="v10-hero-ov">our family today</div>' +
      '<div class="v10-hero-greet">안녕하세요, <em id="v10Who">' + esc(memLabel()) + '</em>님</div>' +
      '</div>' +
      '<div class="v10-hero-date"><b>' + (now.getMonth() + 1) + '월 ' + now.getDate() + '일</b>' +
      WD[now.getDay()] + '요일 · ' + mono(now.getHours()) + ':' + mono(now.getMinutes()) + '</div>' +
      '</div>' +
      '<div id="v10WxSlot"></div>' +
      '<div class="sync-holder" id="v10SyncSlot"></div>';
    home.insertBefore(d, home.firstChild);

    var wx = q('.wx-banner');
    if (wx && $('v10WxSlot')) $('v10WxSlot').appendChild(wx);
    var syncbar = $('syncBar');
    if (syncbar && $('v10SyncSlot')) $('v10SyncSlot').appendChild(syncbar);

    setInterval(function () {
      var el = q('#v10Hero .v10-hero-date');
      if (!el) return;
      var n = new Date();
      el.innerHTML = '<b>' + (n.getMonth() + 1) + '월 ' + n.getDate() + '일</b>' +
        WD[n.getDay()] + '요일 · ' + mono(n.getHours()) + ':' + mono(n.getMinutes());
      var w = $('v10Who');
      if (w) w.textContent = memLabel();
    }, 30000);
  }

  function orderHome() {
    var home = $('view-home');
    if (!home) return;
    ['v10Hero', 'v9MoodCard', 'v9PodCard', 'briefCard', 'v10LocCard', 'v10EtaCard'].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      if (el.parentNode !== home) home.appendChild(el);
      else if (home.lastElementChild !== el) home.appendChild(el);
    });
  }

  /* ---------------------------------------------------------------- 6. 카드 옮기기 */
  function dedupe(id, keep) {
    var all = DOC_.querySelectorAll('[id="' + id + '"]');
    for (var i = 0; i < all.length; i++) {
      if (all[i] !== keep && all[i].parentNode) all[i].parentNode.removeChild(all[i]);
    }
  }
  function place(id, paneId) {
    var pane = $(paneId);
    if (!pane) return;
    var el = $(id);
    if (!el) return;
    dedupe(id, el);
    if (el.parentNode !== pane) pane.appendChild(el);
  }

  function buildPanes() {
    Object.keys(PANE_ORDER).forEach(function (sec) {
      if (!$(sec)) return;
      PANE_ORDER[sec].forEach(function (p) { ensurePane(p); });
    });
    /* 날짜별 기록 카드 */
    var day = ensurePane('pane-record-day');
    if (day && !$('hstCard') && global.FAMHIST) {
      var tmp = DOC_.createElement('div');
      tmp.innerHTML = global.FAMHIST.sec();
      if (tmp.firstChild) day.appendChild(tmp.firstChild);
    }
    /* 소통 > 응원 패널 */
    var ch = ensureLifePanel('cheer');
    if (ch) place('cheerCardTop', 'life-cheer'), place('v9QuoteCard', 'life-cheer');
    Object.keys(PANE_OF).forEach(function (id) {
      if (id === 'cheerCardTop' || id === 'v9QuoteCard') return;
      place(id, PANE_OF[id]);
    });
  }

  /* ---------------------------------------------------------------- 7. 중복 진입점 정리 */
  function park() {
    var box = $('v10Parked');
    if (!box) {
      box = DOC_.createElement('div');
      box.id = 'v10Parked';
      box.hidden = true;
      box.style.display = 'none';
      DOC_.body.appendChild(box);
    }
    ['ntBanner', 'chatTopBtn', 'pgTopBtn', 'fbTopBtn', 'p7strip1', 'p7strip2', 'p7strip3',
      'p8pod', 'v10MyEtaCard'].forEach(function (id) {
      var el = $(id);
      if (el && el.parentNode !== box) box.appendChild(el);
    });
    qa('#view-home > .chat-inline').forEach(function (el) { if (el.parentNode) el.parentNode.removeChild(el); });
  }
  function movePhotos() {
    var target = $('view-photos');
    if (!target) return;
    ['p7strip1', 'p7strip2', 'p7strip3', 'p8pod'].forEach(function (id) {
      var el = $(id);
      if (el) el.classList.add('v10-gone');
    });
    ['p8vid', 'p8albHome'].forEach(function (id) {
      var el = $(id);
      if (el && el.parentNode !== target) target.appendChild(el);
    });
  }
  function buildFeedback() {
    var target = $('life-feedback');
    var card = $('fbCard');
    if (target && card && card.parentNode !== target) target.appendChild(card);
  }

  /* 약속 폼 카드(지도 화면에 있던 것) → 일정 > 약속 */
  function movePlanForm() {
    var mapSec = $('view-map');
    if (!mapSec) return;
    qa(':scope > .card', mapSec).forEach(function (c) {
      var h = c.querySelector('h2');
      if (h && /약속 장소/.test(h.textContent)) {
        c.id = c.id || 'v10PlanForm';
        place('v10PlanForm', 'pane-sched-plan');
      }
    });
  }

  /* ---------------------------------------------------------------- 8. 헤더 아이콘 */
  function wireHeader() {
    if ($('v10Deco')) { placeRobot(); return; }
    var me = $('btnMe');
    if (!me || !me.parentNode) return;
    var b = DOC_.createElement('button');
    b.type = 'button';
    b.id = 'v10Deco';
    b.className = 'icon-btn';
    b.setAttribute('aria-label', '홈 꾸미기');
    b.title = '홈 꾸미기';
    b.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M4 7.5h10M18 7.5h2M4 16.5h4M12 16.5h8"/><circle cx="16" cy="7.5" r="2.1"/><circle cx="10" cy="16.5" r="2.1"/></svg>';
    me.parentNode.insertBefore(b, me);
    b.addEventListener('click', function () {
      var d = $('v9Decorate');
      if (d) d.click();
      else if (F && F.openSheet) F.openSheet('<h3>홈 꾸미기</h3><div class="sdesc">홈 카드 순서를 정리하는 기능을 불러오지 못했어요. 잠시 뒤 다시 눌러 주세요.</div>');
    });
    placeRobot();
  }
  function placeRobot() {
    var bot = $('f9robot');
    var deco = $('v10Deco');
    if (!bot || !deco || !deco.parentNode) return;
    bot.classList.add('v10-hbtn');
    bot.title = '미쁠 — 우리 가족 AI 비서';
    if (bot.parentNode !== deco.parentNode) deco.parentNode.insertBefore(bot, deco);
  }

  /* 내 귀가 알리기 → 시트 */
  function wireEtaSheet() {
    if ($('v10EtaHeadBtn')) return;
    var card = q('#v10EtaCard');
    if (!card) return;
    var head = q('.card-head', card);
    if (!head) return;
    var b = DOC_.createElement('button');
    b.type = 'button';
    b.id = 'v10EtaHeadBtn';
    b.className = 'chip-btn';
    b.textContent = '🚗 내 귀가 알리기';
    head.appendChild(b);
    b.addEventListener('click', function () {
      var quick = $('quickBtns');
      var detail = $('btnEtaDetail');
      F.openSheet(
        '<h3>🚗 내 귀가 알리기</h3>' +
        '<div class="sdesc">가족이 기다리지 않도록 지금 상태를 한 번에 알려 주세요.</div>' +
        '<div id="v10EtaSheetBody"></div>');
      var body = $('v10EtaSheetBody');
      if (quick) body.appendChild(quick);
      if (detail) body.appendChild(detail);
      DOC_.addEventListener('click', function closeOnce(e) {
        if (e.target.closest('#v10EtaSheetBody')) {
          setTimeout(function () { try { F.closeSheet(); } catch (x) { } }, 420);
          DOC_.removeEventListener('click', closeOnce, true);
        }
      }, true);
    });
  }

  /* ---------------------------------------------------------------- 9. 실행 */
  function arrange() {
    if (!F || !F.doc()) return;
    keepCssLast();
    buildHero();
    wireHeader();
    orderHome();
    park();
    movePhotos();
    buildPanes();
    movePlanForm();
    buildFeedback();
    ['ntBanner', 'chatTopBtn', 'fbTopBtn', 'pgTopBtn'].forEach(function (id) {
      var el = $(id);
      if (el) el.setAttribute('aria-hidden', 'true');
    });
    wireEtaSheet();
    /* 지금 탭의 패널이 사라졌으면 다시 그린다 */
    var item = itemOf(activeTab, activeItem);
    if (item && item.pane) showPane(paneId(activeTab, item.pane));
  }

  function setup() {
    if (!window.FAM || !window.FAM.doc || !window.FAM.doc() || !window.FAM.me()) return false;
    F = window.FAM;
    if (!booted) {
      booted = true;
      var tb = $('tabbar');
      if (tb) {
        tb.addEventListener('click', function (e) {
          var b = e.target.closest('[data-v10tab]');
          if (b) go(b.getAttribute('data-v10tab'), null);
        });
      }
      var sub = $('v10Sub');
      if (sub) {
        sub.addEventListener('click', function (e) {
          var b = e.target.closest('[data-v10item]');
          if (b) go(activeTab, b.getAttribute('data-v10item'));
        });
      }
      var me = $('btnMe');
      if (me) me.setAttribute('aria-label', '설정');
      mark('home', 'today');
      setInterval(keepCssLast, 1500);
    }
    arrange();
    return true;
  }

  var tries = 0;
  setInterval(function () {
    tries++;
    try { setup(); } catch (e) { if (window.console && tries < 6) console.warn('v12 nav', e); }
  }, 700);
  keepCssLast();
  if (DOC_.readyState === 'loading') DOC_.addEventListener('DOMContentLoaded', keepCssLast);
  else keepCssLast();

  global.FAMNAV = {
    go: go,
    sync: sync,
    arrange: arrange,
    mark: mark,
    tab: function () { return activeTab; },
    item: function () { return activeItem; },
    itemOf: itemOf,
    tabs: TABS
  };
  /* 예전 이름 호환 */
  global.V10 = global.FAMNAV;
})(window);
