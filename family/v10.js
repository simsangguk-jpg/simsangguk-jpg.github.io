/* ============================================================================
   우리가족포털 V10 — 정보구조(IA) 개편 + 프리미엄 UI 레이어
   ----------------------------------------------------------------------------
   · 화면(뷰)과 데이터·동기화는 V1~V9 그대로 두고, '어디에 무엇이 보이는가'만 다시 짠다.
   · 7개 탭 → 5개 영역(홈 · 소통 · 놀이 · 일정 · 우리집) + 영역별 하위 탭
   · 중복 진입점(플로팅 ＋, 24칸 목차, 홈의 채팅·공지·놀이·의견 배너)은 감춘다.
   · 카드는 DOM 만 옮긴다(id 보존) → 각 모듈의 렌더 함수가 그대로 살아 있다.
   ========================================================================== */
(function () {
  'use strict';

  var DOC_ = document;
  var F = null;
  var booted = false;
  var activeTab = 'home';
  var activeItem = '';

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

  /* ---------------------------------------------------------------- 1. CSS 를 항상 마지막에 */
  function keepCssLast() {
    var link = q('link[href*="v10.css"]');
    if (link && link.parentNode === DOC_.head && DOC_.head.lastElementChild !== link) {
      DOC_.head.appendChild(link);
    }
  }

  /* ---------------------------------------------------------------- 2. 정보구조 */
  var NAV = [
    { id: 'home', label: '홈', items: [] },
    {
      id: 'share', label: '소통', items: [
        { id: 'chat', label: '채팅', run: function () { F.view('chat'); } },
        { id: 'photos', label: '사진', run: function () { F.view('photos'); } },
        { id: 'letters', label: '편지', run: function () { life('letters'); } },
        { id: 'notices', label: '공지', run: function () { life('notices'); } },
        { id: 'diary', label: '일기', run: function () { life('diary'); } },
        { id: 'fb', label: '의견', run: function () { life('feedback'); } }
      ]
    },
    {
      id: 'play', label: '놀이', items: [
        { id: '3d', label: '3D 놀이터', run: function () { play('3d'); } },
        { id: 'tama3d', label: '다마고치', run: function () { play('tama3d'); } },
        { id: 'minicar', label: '미니카', run: function () { play('minicar'); } },
        { id: 'quiz', label: '퀴즈', run: function () { play('quiz'); } },
        { id: 'card', label: '카드', run: function () { play('card'); } },
        { id: 'shop', label: '상점', run: function () { play('shop'); } },
        { id: 'yut', label: '윷놀이', run: function () { play('yut'); } }
      ]
    },
    {
      id: 'sched', label: '일정', items: [
        { id: 'shift', label: '근무·등교', run: function () { goSched(); scrollTo('schedShiftBox'); } },
        { id: 'dday', label: '디데이·목표', run: function () { goSched(); scrollTo('schedDdayBox'); } },
        { id: 'money', label: '용돈', run: function () { goSched(); scrollTo('schedMoneyBox'); } },
        { id: 'plan', label: '약속', run: function () { goSched(); scrollTo('schedPlanBox'); } }
      ]
    },
    {
      id: 'house', label: '우리집', items: [
        { id: 'family', label: '가족', run: function () { goHouse(); scrollTo('houseFamily'); } },
        { id: 'loc', label: '위치', run: function () { F.view('map'); } },
        { id: 'reco', label: '추천', run: function () { life('reco'); } },
        { id: 'mind', label: '마음·선물', run: function () { goHouse(); scrollTo('houseMind'); } },
        { id: 'news', label: '소식', run: function () { goHouse(); scrollTo('houseNews'); } },
        { id: 'more', label: '생활도구', run: function () { goHouse(); scrollTo('houseTools'); } }
      ]
    }
  ];

  function life(t) {
    var b = q('#lifeNav [data-life="' + t + '"]');
    if (b) b.click();
    else F.view('life');
    mark('share', ({ letters: 'letters', notices: 'notices', diary: 'diary', feedback: 'fb', reco: 'reco' })[t] || 'letters');
  }
  function play(id) {
    F.view('play');
    var b = q('#pgNav [data-pane="' + id + '"]');
    if (b) { setTimeout(function () { b.click(); }, 60); }
    mark('play', id);
  }
  function goSched() { if (F.curView() !== 'sched') F.view('sched'); }
  function goHouse() { if (F.curView() !== 'all') F.view('all'); }

  function scrollTo(id) {
    if (softNav) return;              /* 탭을 직접 누른 경우엔 페이지 상단부터 보여 준다 */
    var el = $(id);
    if (!el) return;
    setTimeout(function () {
      var y = el.getBoundingClientRect().top + window.pageYOffset - 118;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    }, 80);
  }

  /* ---------------------------------------------------------------- 3. 탭 · 하위탭 그리기 */
  function paintSub(tabId) {
    var host = $('v10Sub');
    if (!host) return;
    var tab = NAV.filter(function (t) { return t.id === tabId; })[0];
    if (!tab || !tab.items.length) { host.innerHTML = ''; host.classList.add('is-empty'); return; }
    host.classList.remove('is-empty');
    host.innerHTML = tab.items.map(function (it) {
      return '<button type="button" data-v10item="' + it.id + '">' + esc(it.label) + '</button>';
    }).join('');
  }
  function mark(tabId, itemId) {
    activeTab = tabId; activeItem = itemId || '';
    qa('#tabbar button[data-v10tab]').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-v10tab') === tabId);
    });
    paintSub(tabId);
    qa('#v10Sub [data-v10item]').forEach(function (b) {
      var on = b.getAttribute('data-v10item') === itemId;
      b.classList.toggle('on', on);
      if (on && b.scrollIntoView) {
        try { b.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) {}
      }
    });
    var sub = $('v10Sub');
    if (sub && !itemId) sub.scrollLeft = 0;
  }
  var softNav = false;
  function switchTab(tabId, itemId) {
    var tab = NAV.filter(function (t) { return t.id === tabId; })[0];
    if (!tab) return;
    if (tabId === 'home') { F.view('home'); mark('home', 'home'); return; }
    var item = tab.items.filter(function (i) { return i.id === (itemId || (tab.items[0] && tab.items[0].id)); })[0];
    if (!item) item = tab.items[0];
    mark(tabId, item.id);
    softNav = !itemId;
    try { item.run(); } finally { softNav = false; }
    if (!itemId) { try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch (e) {} }
  }

  /* 외부에서 뷰가 바뀌면 탭 표시를 따라가게 */
  function syncFromView(v) {
    if (v === 'chat' || v === 'photos') { mark('share', v); return; }
    if (v === 'life') {
      var on = q('#lifeNav button.on');
      var t = on ? on.getAttribute('data-life') : 'letters';
      var map = { letters: 'letters', notices: 'notices', diary: 'diary', feedback: 'fb', reco: 'reco' };
      mark('share', map[t] || 'letters');
      return;
    }
    if (v === 'play') { mark('play', activeTab === 'play' ? activeItem : '3d'); return; }
    if (v === 'sched') { mark('sched', activeItem && activeTab === 'sched' ? activeItem : 'shift'); return; }
    if (v === 'all' || v === 'map') {
      if (activeTab === 'house') return;   /* 이미 우리집 안에서 고른 항목 유지 */
      mark('house', v === 'map' ? 'loc' : 'family');
      return;
    }
    if (v === 'home') { mark('home', 'home'); return; }
  }

  /* ---------------------------------------------------------------- 4. 홈 히어로 + 카드 재배치 */
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
    if (wx) $('v10WxSlot').appendChild(wx);
    var sync = $('syncBar');
    if (sync) $('v10SyncSlot').appendChild(sync);

    /* 시계 갱신 */
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

  function ensureBox(host, id, cls) {
    if (!host) return null;
    var el = $(id);
    if (el) return el;
    el = DOC_.createElement('div');
    el.id = id;
    el.className = cls || '';
    host.appendChild(el);
    return el;
  }
  function moveTo(id, host, before) {
    var el = $(id);
    if (!el || !host) return;
    if (before && $(before)) { if (el.previousElementSibling !== $(before)) host.insertBefore(el, $(before)); return; }
    if (el.parentNode !== host) host.appendChild(el);
  }
  function sectionLabel(host, id, text, anchor) {
    if (!host) return;
    if ($(id)) return;
    var h = DOC_.createElement('div');
    h.className = 'v10-sec';
    h.id = id;
    h.textContent = text;
    var a = anchor ? $(anchor) : null;
    if (a && a.parentNode === host) host.insertBefore(h, a);
    else host.appendChild(h);
  }

  var schedBuilt = false, houseBuilt = false;

  function buildSched() {
    var host = $('view-sched');
    if (!host) return;
    if (!schedBuilt) {
      host.innerHTML =
        '<div class="card" id="v10SchedHead">' +
          '<div class="card-head"><h2>🗓️ 우리 가족 일정</h2><span class="sub">근무·등교 · 디데이 · 용돈 · 약속</span></div>' +
          '<div class="hint" style="margin-top:0">가족 달력과 경험치는 <b>홈</b>에서 이어서 볼 수 있어요. 여기서는 날짜별 근무표와 디데이, 용돈, 약속을 한 곳에 모았습니다.</div>' +
        '</div>' +
        '<div id="schedShiftBox"></div><div id="schedDdayBox"></div>' +
        '<div id="schedMoneyBox"></div><div id="schedPlanBox"></div>';
      schedBuilt = true;
    }
    moveTo('v9ShiftCard', $('schedShiftBox'));
    moveTo('v9DdayCard', $('schedDdayBox'));
    moveTo('v9GoalsCard', $('schedDdayBox'));
    moveTo('v9SchoolCard', $('schedDdayBox'));

    /* 용돈 패널의 카드만 옮긴다(패널 자체는 생활 뷰에 남겨 paintLife 가 건드리지 않게) */
    var moneyPanel = $('life-money');
    var moneyBox = $('schedMoneyBox');
    if (moneyPanel && moneyBox && !moneyBox.__filled) {
      var kids = Array.prototype.slice.call(moneyPanel.children);
      kids.forEach(function (k) { moneyBox.appendChild(k); });
      moneyBox.__filled = 1;
    }

    /* 약속: 홈 카드(목록) + 지도 화면의 약속 폼 */
    var planBox = $('schedPlanBox');
    moveTo('v10PlanCard', planBox);
    var mapSec = $('view-map');
    if (mapSec) {
      qa(':scope > .card', mapSec).forEach(function (c) {
        var h = c.querySelector('h2');
        if (h && /약속/.test(h.textContent) && planBox && c.parentNode !== planBox) planBox.appendChild(c);
      });
    }
  }

  function buildHouse() {
    var host = $('view-all');
    if (!host) return;
    if (!houseBuilt) {
      var hero = DOC_.createElement('div');
      hero.className = 'card v10-hero-card';
      hero.id = 'houseHero';
      hero.innerHTML =
        '<div class="card-head"><h2>🏡 우리집</h2><span class="sub" id="houseHeroSub">가족 · 위치 · 추천 · 마음 · 소식</span></div>' +
        '<div class="v10-famrow" id="houseFamRow"></div>' +
        '<div class="hint" style="margin-top:12px">가족 모두의 기록과 설정, 지난 이야기를 모아 두었어요. 위 탭에서 바로 찾아갈 수 있어요.</div>';
      host.insertBefore(hero, host.firstChild);
      houseBuilt = true;
    }
    paintFamRow();

    /* 목차 카드(24칸)는 하단 탭·하위 탭과 중복 → 감춘다 */
    qa(':scope > .card', host).forEach(function (c) {
      if (c.querySelector('.v4-cat')) c.classList.add('v10-gone');
    });

    sectionLabel(host, 'houseFamily', '가족', null);
    ['houseFamily', 'v4Visit', 'v9SleepCard', 'v9SbCard', 'v9LogCard', 'v4Geo', 'v4Notif', 'v4Mem',
     'houseNews', 'v9NewsCard', 'v9WkCard', 'v4Tube', 'v9QuoteCard',
     'houseMind', 'v5Mind', 'v9Wish', 'v4Worry',
     'houseTools', 'v4Food', 'v9Arch'].forEach(function (id) {
      if (id === 'houseNews') sectionLabel(host, 'houseNews', '소식', null);
      if (id === 'houseMind') sectionLabel(host, 'houseMind', '마음 · 선물', null);
      if (id === 'houseTools') sectionLabel(host, 'houseTools', '생활 도구', null);
      var el = $(id);
      if (el && host.lastElementChild !== el) host.appendChild(el);
    });
  }

  /* 홈은 '들어오고 싶은 첫 장면' 순서로 고정한다.
     가족이 홈 꾸미기로 직접 순서를 정해 뒀다면 그 결정을 존중한다. */
  function orderHome() {
    var home = $('view-home');
    if (!home || !F || !F.doc()) return;
    var lay = null;
    try { lay = F.doc().v9 && F.doc().v9.layout; } catch (e) { lay = null; }
    if (lay && lay.order && lay.order.length) return;
    ['v10Hero', 'v9PodCard', 'famCalBanner', 'v9MoodCard', 'cheerCardTop', 'briefCard', 'v10LocCard', 'v10EtaCard']
      .forEach(function (id) {
        var el = $(id);
        if (!el) return;
        if (home.lastElementChild !== el) home.appendChild(el);
      });
  }

  /* 헤더에 '홈 꾸미기' 아이콘 + 미쁠 AI 아이콘 */
  function wireHeader() {
    if ($('v10Deco')) return;
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

  /* 떠 있던 미쁠 AI 버튼은 헤더 안으로 모셔 화면을 가리지 않게 한다(나중에 생겨도 다시 옮긴다) */
  function placeRobot() {
    var bot = $('f9robot');
    var deco = $('v10Deco');
    if (!bot || !deco || !deco.parentNode) return;
    bot.classList.add('v10-hbtn');
    bot.title = '미쁠 — 우리 가족 AI 비서';
    if (bot.parentNode !== deco.parentNode) deco.parentNode.insertBefore(bot, deco);
  }

  function paintFamRow() {
    var box = $('houseFamRow');
    if (!box || !F || !F.doc()) return;
    var ms = F.members();
    var html = ms.map(function (m) {
      return '<div class="m"><span class="av">' + esc(m.emoji || '🧑') + '</span>' +
        '<span class="nm">' + esc(m.name || '가족') + '</span>' +
        '<span class="rl">' + esc(m.role || '가족') + '</span></div>';
    }).join('');
    if (box.__sig !== html) { box.__sig = html; box.innerHTML = html; }
  }

  /* 화면에서 사라진 중복 진입점은 '주차' 컨테이너로 — 기능(id·이벤트)은 그대로 살아 있고 DOM 만 깔끔해진다 */
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

  /* ---------------------------------------------------------------- 5. 내 귀가 알리기 → 시트 */
  function wireEtaSheet() {
    var eta = q('#v10EtaHeadBtn');
    if (eta) return;
    var card = q('#v10EtaCard');
    if (!card) return;
    var head = q('.card-head', card);
    if (!head) return;
    var b = DOC_.createElement('button');
    b.type = 'button';
    b.id = 'v10EtaHeadBtn';
    b.className = 'chip-btn';
    b.textContent = '내 귀가 알리기';
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
      b.addEventListener('click', function () { });
      DOC_.addEventListener('click', function closeOnce(e) {
        if (e.target.closest('#v10EtaSheetBody')) {
          setTimeout(function () { try { F.closeSheet(); } catch (x) {} }, 420);
          DOC_.removeEventListener('click', closeOnce, true);
        }
      }, true);
    });
  }

  /* ---------------------------------------------------------------- 6. 실행 */
  function setup() {
    if (!window.FAM || !window.FAM.doc || !window.FAM.doc() || !window.FAM.me()) return false;
    F = window.FAM;
    if (!booted) {
      booted = true;
      /* 뷰 훅: 외부 전환도 탭 표시에 반영 */
      var prevView = window.__FAM_VIEW;
      window.__FAM_VIEW = function (v) {
        if (prevView) { try { prevView(v); } catch (e) {} }
        try { syncFromView(v); } catch (e) {}
      };
      /* 렌더 훅: 카드가 새로 만들어지면 다시 정리 */
      var prevRender = window.__FAM_RENDER;
      window.__FAM_RENDER = function () {
        if (prevRender) { try { prevRender(); } catch (e) {} }
        try { keepCssLast(); arrange(); } catch (e) {}
      };
      var tb = $('tabbar');
      if (tb) {
        tb.addEventListener('click', function (e) {
          var b = e.target.closest('[data-v10tab]');
          if (b) switchTab(b.getAttribute('data-v10tab'));
        });
      }
      var sub = $('v10Sub');
      if (sub) {
        sub.addEventListener('click', function (e) {
          var b = e.target.closest('[data-v10item]');
          if (!b) return;
          var tab = NAV.filter(function (t) { return t.id === activeTab; })[0];
          var item = tab && tab.items.filter(function (i) { return i.id === b.getAttribute('data-v10item'); })[0];
          if (item) { mark(activeTab, item.id); item.run(); }
        });
      }
      var me = $('btnMe');
      if (me) me.setAttribute('aria-label', '설정');
      mark('home', 'home');
      setInterval(keepCssLast, 1500);
    }
    arrange();
    return true;
  }

  function arrange() {
    if (!F || !F.doc()) return;
    keepCssLast();
    buildHero();
    wireHeader();
    placeRobot();
    orderHome();
    park();
    movePhotos();
    buildSched();
    buildHouse();
    buildFeedback();
    /* 홈에서 중복으로 보이던 바로가기 정리 */
    ['ntBanner', 'chatTopBtn', 'fbTopBtn', 'pgTopBtn'].forEach(function (id) {
      var el = $(id);
      if (el) el.setAttribute('aria-hidden', 'true');
    });
    var etaCard = $('v10EtaCard');
    if (etaCard) wireEtaSheet();
    paintFamRow();
  }

  /* 로그인 뒤 카드가 다 만들어질 때까지 조용히 기다린다(카드가 늦게 생겨도 계속 맞춰 준다) */
  var tries = 0;
  setInterval(function () {
    tries++;
    try { setup(); } catch (e) { if (window.console && tries < 6) console.warn('v10', e); }
  }, 700);
  keepCssLast();
  if (DOC_.readyState === 'loading') DOC_.addEventListener('DOMContentLoaded', keepCssLast);
  else keepCssLast();

  window.V10 = {
    tab: function (t, i) { switchTab(t, i); },
    arrange: arrange,
    tabOf: function () { return activeTab; }
  };
})();
