/* ============================================================
   상국수향지섭지율포털 V4 · 놀이 확장 (game4.js)
   🥚 다마고치·RPG 육성   🃏 일기 포켓몬 카드   🧮 수학·영어 퀴즈
   🛍️ 포인트 상점·악세사리 선물·교환(3D 반영)   🛏️ 마이룸 꾸미기   🎋 가족 윷놀이
   - 본체는 window.FAM 다리만 쓴다. 새 데이터는 DOC.game 에만 만든다.
   ============================================================ */
(function (global) {
  'use strict';

  var F = null, ON = false, paneCur = '3d', quizState = null, roomSel = null;
  var yutPoll = null, lastLookSync = 0;

  function $(id) { return document.getElementById(id); }
  function d() { return F && F.doc(); }
  function me() { return F && F.me(); }
  function esc(s) { return F.esc(s); }
  function save() { F.save(); }
  function toast(m) { F.toast(m); }
  function now() { return Date.now(); }
  function rnd(n) { return (Math.random() * n) | 0; }
  function pick(a) { return a[rnd(a.length)]; }

  /* ---------------- 데이터 ---------------- */
  function G() {
    var D = d();
    if (!D) return { m: {}, card: {}, feed: {}, quiz: {}, gift: {}, yut: {} };
    if (!D.game) D.game = {};
    var g = D.game;
    ['m', 'card', 'feed', 'quiz', 'gift', 'yut'].forEach(function (k) { if (!g[k] || typeof g[k] !== 'object') g[k] = {}; });
    return g;
  }
  function myChar() {
    var g = G(), id = me() ? me().id : '';
    if (!id) return null;
    var c = g.m[id];
    if (!c) {
      c = g.m[id] = {
        name: pickName(), lv: 1, xp: 0, atk: 3, def: 3, wis: 3,
        full: 70, happy: 70, energy: 70, gold: 60,
        born: now(), at: now(), tick: now(), lastDiary: 0, lastCard: 0,
        look: {}, room: { wall: '#EAF7F1', floor: '#E7D3BC', items: ['f_bed', 'f_plant', '', '', '', 'f_lamp'] },
        items: {}, act: {}
      };
    }
    if (!c.items) c.items = {};
    if (!c.look) c.look = {};
    if (!c.room) c.room = { wall: '#EAF7F1', floor: '#E7D3BC', items: ['f_bed', 'f_plant', '', '', '', 'f_lamp'] };
    if (!c.room.items) c.room.items = ['', '', '', '', '', ''];
    return c;
  }
  function charOf(id) {
    var g = G(), c = g.m[id];
    if (!c) return null;
    if (!c.items) c.items = {};
    if (!c.look) c.look = {};
    if (!c.room) c.room = { wall: '#EAF7F1', floor: '#E7D3BC', items: [] };
    if (!c.room.items) c.room.items = [];
    return c;
  }
  var NAMES = ['몽글', '보송', '콩이', '방울', '솜이', '토리', '포포', '루루'];
  function pickName() { return pick(NAMES); }
  function stage(lv) {
    if (lv >= 15) return { n: '성인', e: '🧙', r: '전설' };
    if (lv >= 10) return { n: '청소년', e: '🧑‍🎤', r: '희귀' };
    if (lv >= 6) return { n: '어린이', e: '🧒', r: '고급' };
    if (lv >= 3) return { n: '아기', e: '🐣', r: '보통' };
    return { n: '알', e: '🥚', r: '기본' };
  }
  function needXP(lv) { return 60 + lv * 40; }
  function dec(c, k, n) { c[k] = Math.max(0, Math.min(100, Math.round((c[k] || 0) + n))); }

  /* ---------------- 스타일 ---------------- */
  function style() {
    if ($('g4style')) return;
    var s = document.createElement('style');
    s.id = 'g4style';
    s.textContent = [
      '.pg-nav{display:flex;gap:5px;overflow-x:auto;padding:2px 0 9px;-webkit-overflow-scrolling:touch;scrollbar-width:none}',
      '.pg-nav::-webkit-scrollbar{display:none}',
      '.pg-nav button{flex:none;padding:8px 11px;border-radius:20px;background:#F1F4F5;font-size:11.5px;font-weight:800;color:#79838F;white-space:nowrap}',
      '.pg-nav button.on{background:#0E9F6E;color:#fff;box-shadow:0 4px 12px rgba(14,159,110,.28)}',
      '.g4-hero{display:flex;gap:12px;align-items:center;padding:4px 2px 6px}',
      '.g4-hero .av{width:76px;height:76px;flex:none;border-radius:22px;display:flex;align-items:center;justify-content:center;font-size:42px;background:linear-gradient(160deg,#FFF7E8,#E7F8F1);border:1px solid #E9EEF2;position:relative}',
      '.g4-hero .av .lv{position:absolute;bottom:-6px;right:-6px;background:#0E9F6E;color:#fff;font-size:10px;font-weight:900;padding:2px 7px;border-radius:20px;border:2px solid #fff}',
      '.g4-hero .info{flex:1;min-width:0}',
      '.g4-hero .info b{font-size:15px;font-weight:900;letter-spacing:-.3px}',
      '.g4-hero .info .g{font-size:11.5px;color:#79838F;margin-top:1px}',
      '.g4-stat{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:800;color:#5C6673;margin-top:5px}',
      '.g4-stat .lb{width:46px;flex:none}',
      '.g4-stat .bg{flex:1;height:8px;border-radius:20px;background:#F1F4F5;overflow:hidden}',
      '.g4-stat .bg i{display:block;height:100%;border-radius:20px}',
      '.g4-stat .v{width:28px;text-align:right;color:#3C4450}',
      '.g4-acts{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:11px}',
      '.g4-act{display:flex;flex-direction:column;align-items:center;gap:2px;padding:10px 4px;border-radius:13px;background:#FBFDFC;border:1px solid #E9EEF2;font-size:11px;font-weight:800;color:#3C4450}',
      '.g4-act .e{font-size:19px;line-height:1}',
      '.g4-act small{font-size:9.5px;color:#9AA4AF;font-weight:700}',
      '.g4-act:active{transform:scale(.96)}',
      '.g4-act[disabled]{opacity:.45}',
      '.g4-log{max-height:96px;overflow-y:auto;font-size:11.5px;color:#5C6673;line-height:1.6;margin-top:8px}',
      '.g4-q{background:#FBFDFC;border:1px solid #E9EEF2;border-radius:16px;padding:13px}',
      '.g4-q .quiz{font-size:16px;font-weight:900;letter-spacing:-.2px;line-height:1.45;margin:2px 0 4px;word-break:keep-all}',
      '.g4-opt{display:flex;align-items:center;gap:8px;width:100%;padding:11px 12px;margin-top:6px;border-radius:12px;background:#fff;border:1.5px solid #E9EEF2;font-size:13px;font-weight:700;text-align:left}',
      '.g4-opt .k{width:20px;height:20px;border-radius:7px;background:#F1F4F5;font-size:11px;font-weight:900;display:flex;align-items:center;justify-content:center;color:#79838F;flex:none}',
      '.g4-opt.right{background:#E7F8F1;border-color:#0E9F6E;color:#0A7D56}',
      '.g4-opt.wrong{background:#FFF1EE;border-color:#FF7A66;color:#C0392B}',
      '.g4-chip{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:800;padding:4px 8px;border-radius:20px;background:#F1F4F5;color:#5C6673;margin:0 4px 4px 0}',
      '.g4-shop{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}',
      '.g4-item{border:1px solid #E9EEF2;border-radius:14px;padding:9px 5px;background:#FBFDFC;text-align:center;font-size:10.5px;font-weight:800;color:#3C4450;line-height:1.25}',
      '.g4-item .e{font-size:24px;display:block;line-height:1.1;margin-bottom:2px}',
      '.g4-item .p{color:#0A7D56;font-size:10px;margin-top:2px}',
      '.g4-item.owned{background:#E7F8F1;border-color:#B7E7D2}',
      '.g4-item.on{box-shadow:0 0 0 2px #0E9F6E inset}',
      '.g4-sec{font-size:12px;font-weight:900;color:#3C4450;margin:12px 2px 6px;display:flex;align-items:center;gap:5px}',
      '.g4-sec .n{font-size:10.5px;color:#9AA4AF;font-weight:700}',
      '.g4-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}',
      '.g4-card{border-radius:11px;padding:6px 3px;text-align:center;font-size:9.5px;font-weight:800;line-height:1.2;border:1px solid rgba(0,0,0,.06);position:relative;min-height:62px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px}',
      '.g4-card .e{font-size:20px;line-height:1}',
      '.g4-card .n{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%}',
      '.g4-card .c{position:absolute;top:2px;right:3px;font-size:9px;font-weight:900;background:rgba(255,255,255,.82);border-radius:8px;padding:0 3px;color:#3C4450}',
      '.g4-card.no{background:#F4F6F7;color:#C4CDD4;border-style:dashed}',
      '.g4-room{position:relative;border-radius:16px;overflow:hidden;border:1px solid #E9EEF2;height:240px;display:flex;flex-direction:column}',
      '.g4-room .wall{flex:1.05;position:relative;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,1fr);gap:2px;padding:8px}',
      '.g4-room .floor{flex:.95;position:relative}',
      '.g4-slot{border-radius:10px;border:1.5px dashed rgba(0,0,0,.10);display:flex;align-items:center;justify-content:center;font-size:23px;background:rgba(255,255,255,.32);cursor:pointer}',
      '.g4-slot.has{border-style:solid;background:rgba(255,255,255,.68)}',
      '.g4-room .ch{position:absolute;left:50%;bottom:6%;transform:translateX(-50%);font-size:44px;filter:drop-shadow(0 6px 6px rgba(0,0,0,.16))}',
      '.g4-yut{position:relative;width:100%;padding-top:100%;border-radius:18px;background:linear-gradient(160deg,#FFF9EC,#FFEFD8);border:1px solid #F0E2C8;overflow:hidden}',
      '.g4-yut .bd{position:absolute;inset:10%}',
      '.g4-yut .node{position:absolute;width:9.5%;height:9.5%;margin:-4.75% 0 0 -4.75%;border-radius:50%;background:#F7E4C4;border:1.5px solid #E3C99C;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:#8A7250}',
      '.g4-yut .node.corner{background:#FFD79A;border-color:#E0B267}',
      '.g4-yut .pc{position:absolute;width:12.5%;height:12.5%;margin:-6.25% 0 0 -6.25%;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;color:#fff;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.2);transition:all .28s ease}',
      '.g4-yut .pc .s{position:absolute;bottom:-3px;right:-3px;background:#fff;color:#14181D;border-radius:8px;font-size:8px;padding:0 2px;border:1px solid #E9EEF2}',
      '.g4-sticks{display:flex;gap:9px;justify-content:center;margin:9px 0 4px;min-height:52px}',
      '.g4-stick{width:16px;height:46px;border-radius:8px;background:linear-gradient(#EBD9B8,#D9BF95);border:1px solid #C9AE84;transition:transform .5s ease,background .3s;transform-origin:50% 90%}',
      '.g4-stick.front{transform:rotateX(180deg);background:linear-gradient(#FFF7E6,#F2E3C4)}',
      '.g4-roll{font-size:20px;font-weight:900;letter-spacing:-.4px;text-align:center;margin:2px 0}',
      '.g4-turn{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:800;color:#3C4450;margin:6px 0}',
      '.g4-tdot{width:11px;height:11px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.18)}',
      '.g4-yutbar{display:flex;gap:6px;margin-top:8px}',
      '.g4-yutbar button{flex:1;padding:11px 4px;border-radius:12px;font-size:12px;font-weight:900;background:#F1F4F5;color:#5C6673}',
      '.g4-yutbar button.main{background:#0E9F6E;color:#fff}',
      '.g4-yutbar button[disabled]{opacity:.45}',
      '.g4-mine{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}',
      '.g4-mine button{padding:8px 11px;border-radius:11px;background:#fff;border:1.5px solid #E9EEF2;font-size:12px;font-weight:800;color:#3C4450}',
      '.g4-mine button.sel{background:#E7F8F1;border-color:#0E9F6E;color:#0A7D56}',
      '.g4-mine button.fin{opacity:.5;text-decoration:line-through}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ============================================================
     놀이 탭 안 부메뉴
     ============================================================ */
  var PANES = [
    { id: '3d', e: '🧸', n: '3D 놀이터' },
    { id: 'tama', e: '🥚', n: '다마고치' },
    { id: 'quiz', e: '🧮', n: '퀴즈' },
    { id: 'card', e: '🃏', n: '카드 가방' },
    { id: 'shop', e: '🛍️', n: '상점·악세사리' },
    { id: 'room', e: '🛏️', n: '마이룸' },
    { id: 'yut', e: '🎋', n: '윷놀이' }
  ];

  function buildPanes() {
    var nav = $('pgNav');
    if (!nav || nav.__g4) return;
    nav.__g4 = 1;
    nav.innerHTML = PANES.map(function (p) {
      return '<button type="button" data-pane="' + p.id + '" class="' + (p.id === '3d' ? 'on' : '') + '">' + p.e + ' ' + p.n + '</button>';
    }).join('');
    nav.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pane]');
      if (b) pane(b.getAttribute('data-pane'));
    });
    var view = $('view-play');
    PANES.forEach(function (p) {
      if (p.id === '3d') return;
      var el = document.createElement('div');
      el.id = 'pgPane-' + p.id;
      el.className = 'hidden';
      view.appendChild(el);
    });
    $('pgPane-tama').innerHTML = paneTama();
    $('pgPane-quiz').innerHTML = paneQuiz();
    $('pgPane-card').innerHTML = paneCard();
    $('pgPane-shop').innerHTML = paneShop();
    $('pgPane-room').innerHTML = paneRoom();
    $('pgPane-yut').innerHTML = paneYut();
    wireTama(); wireQuiz(); wireShop(); wireRoom(); wireYut();
  }

  function pane(id) {
    if (!PANES.some(function (p) { return p.id === id; })) return;
    paneCur = id;
    var nav = $('pgNav');
    if (nav) {
      var bs = nav.querySelectorAll('[data-pane]');
      for (var i = 0; i < bs.length; i++) bs[i].classList.toggle('on', bs[i].getAttribute('data-pane') === id);
    }
    PANES.forEach(function (p) {
      var el = p.id === '3d' ? $('pg3dCard') : $('pgPane-' + p.id);
      if (el) el.classList.toggle('hidden', p.id !== id);
    });
    if (id === '3d') {
      if (global.FamPlay) global.FamPlay.enter();
      else if (global.ensurePlay) global.ensurePlay(function () {});
      /* 3D 캐릭터가 만들어진 뒤 악세사리를 입힌다(준비 전 호출 대비 몇 번 더) */
      var tries = 0;
      if (pane.t) clearInterval(pane.t);
      pane.t = setInterval(function () {
        var P = global.FamPlay;
        if (P && typeof P.ready === 'function' && P.ready()) syncLook(true);
        if (++tries > 10) { clearInterval(pane.t); pane.t = null; }
      }, 600);
    } else {
      if (global.FamPlay) global.FamPlay.leave();
    }
    if (id === 'yut') { renderYut(); startYutPoll(); } else stopYutPoll();
    render();
  }

  /* ============================================================
     🥚 다마고치 · RPG
     ============================================================ */
  function paneTama() {
    return '<div class="card"><div class="card-head"><h2>🥚 내 다마고치</h2><span class="sub" id="g4TamaSub">–</span></div>' +
      '<div id="g4Hero"></div>' +
      '<div class="g4-acts" id="g4Acts">' +
      '<button type="button" class="g4-act" data-act="meal"><span class="e">🍚</span>밥 주기<small>포만감 +18</small></button>' +
      '<button type="button" class="g4-act" data-act="snack"><span class="e">🍪</span>간식<small>행복 +8</small></button>' +
      '<button type="button" class="g4-act" data-act="drink"><span class="e">🧃</span>음료<small>에너지 +12</small></button>' +
      '<button type="button" class="g4-act" data-act="sing"><span class="e">🎤</span>노래방<small>30G · 행복 +15</small></button>' +
      '<button type="button" class="g4-act" data-act="game"><span class="e">🎮</span>게임방<small>40G · 행복 +12</small></button>' +
      '<button type="button" class="g4-act" data-act="pet"><span class="e">🤗</span>쓰다듬기<small>행복 +6</small></button>' +
      '</div>' +
      '<div class="g4-log" id="g4Log"></div>' +
      '<div class="hint">밥·간식·노래방으로 돌보면 포만감·행복·에너지가 오르고 XP가 쌓여요. XP가 차면 레벨이 오르고 공격·방어·지혜가 자라요. 가끔 돌발 이벤트가 생겨요.</div></div>' +
      '<div class="card"><div class="card-head"><h2>🏅 가족 캐릭터 현황</h2><span class="sub">함께 키우기</span></div><div id="g4Fam"></div></div>';
  }
  function tick(c) {
    var dt = now() - (c.tick || now());
    if (dt < 10 * 60000) return false;
    var hours = Math.min(12, dt / 3600000);
    c.tick = now();
    c.at = now();
    dec(c, 'full', -Math.round(hours * 5));
    dec(c, 'happy', -Math.round(hours * 4));
    dec(c, 'energy', -Math.round(hours * 3));
    return true;
  }
  function renderTama() {
    var c = myChar();
    if (!c) return;
    var changed = tick(c);
    var st = stage(c.lv), need = needXP(c.lv);
    var box = $('g4Hero'), sub = $('g4TamaSub');
    if (sub) sub.textContent = st.r + ' · ' + (c.lv >= 15 ? '전설 등급' : 'Lv.' + c.lv);
    function bar(lb, v, col) {
      return '<div class="g4-stat"><span class="lb">' + lb + '</span><span class="bg"><i style="width:' + v + '%;background:' + col + '"></i></span><span class="v">' + v + '</span></div>';
    }
    if (box) box.innerHTML = '<div class="g4-hero"><div class="av">' + st.e + '<span class="lv">Lv.' + c.lv + '</span></div>' +
      /* 히어로 */
      '<div class="info"><b>' + esc(c.name) + '</b><div class="g">' + st.n + ' 단계 · XP ' + c.xp + '/' + need + ' · 🪙 ' + (c.gold | 0) + 'G</div>' +
      bar('포만감', c.full, 'linear-gradient(90deg,#FFB020,#FFD97A)') +
      bar('행복', c.happy, 'linear-gradient(90deg,#FF7A66,#FFB1A3)') +
      bar('에너지', c.energy, 'linear-gradient(90deg,#4C8DFF,#8FB8FF)') +
      '<div class="v4-mini" style="margin-top:5px">⚔️ 공격 ' + c.atk + ' · 🛡️ 방어 ' + c.def + ' · 📘 지혜 ' + c.wis + '</div></div></div>';
    var log = $('g4Log');
    if (log && !log.__sig) {
      log.__sig = 1;
      log.innerHTML = '<div>· ' + esc(c.name) + '와(과) 함께 자라는 중이에요.</div>';
    }
    var fam = $('g4Fam');
    if (fam) {
      var g = G();
      var ms = F.members();
      fam.innerHTML = ms.map(function (m) {
        var cc = g.m[m.id];
        if (!cc) return '<div class="v4-row"><span class="e">' + (m.emoji || '🧑') + '</span><span class="tx"><b>' + esc(m.name) + '</b><small>아직 캐릭터를 만들지 않았어요</small></span><span class="v4-tag gray">–</span></div>';
        var s2 = stage(cc.lv);
        return '<div class="v4-row"><span class="e">' + s2.e + '</span><span class="tx"><b>' + esc(cc.name) + '</b><small>' + esc(m.name) + ' · ' + s2.n + ' · 행복 ' + cc.happy + '</small></span><span class="rt">Lv.' + cc.lv + '</span></div>';
      }).join('');
    }
    if (changed) { save(); }
  }
  var EVENTS = [
    { t: '🎁 길에서 반짝이는 동전을 주웠어요! (+25G)', f: function (c) { c.gold += 25; } },
    { t: '🍀 네잎클로버를 발견했어요! (+8 행복)', f: function (c) { dec(c, 'happy', 8); } },
    { t: '🤧 감기에 걸렸어요… 에너지가 줄었어요 (-10)', f: function (c) { dec(c, 'energy', -10); } },
    { t: '🐝 꿀벌이 인사했어요! (+6 행복)', f: function (c) { dec(c, 'happy', 6); } },
    { t: '📚 책을 읽고 지혜가 +1!', f: function (c) { c.wis += 1; } },
    { t: '🌙 푹 자고 나니 에너지가 +12!', f: function (c) { dec(c, 'energy', 12); } }
  ];
  function tamaAct(act) {
    var c = myChar();
    if (!c) return;
    var e = { meal: [0, 5], snack: [0, 7], drink: [0, 6], sing: [30, 14], game: [40, 16], pet: [0, 4] }[act];
    if (!e) return;
    if (c.gold < e[0]) { toast('골드가 모자라요 — 퀴즈로 벌어 보세요!'); return; }
    c.gold -= e[0];
    c.xp += e[1];
    var msg = '';
    if (act === 'meal') { dec(c, 'full', 18); dec(c, 'happy', 3); msg = '🍚 냠냠! 밥을 맛있게 먹었어요'; }
    if (act === 'snack') { dec(c, 'happy', 8); dec(c, 'full', 5); msg = '🍪 간식 최고! 신나 해요'; }
    if (act === 'drink') { dec(c, 'energy', 12); dec(c, 'happy', 2); msg = '🧃 시원~ 에너지가 올랐어요'; }
    if (act === 'sing') { dec(c, 'happy', 15); dec(c, 'energy', -4); msg = '🎤 노래방에서 신나게 불렀어요'; }
    if (act === 'game') { dec(c, 'happy', 12); dec(c, 'energy', -6); msg = '🎮 게임방에서 한 판!'; }
    if (act === 'pet') { dec(c, 'happy', 6); msg = '🤗 쓰다듬으니 좋아해요'; }
    if (Math.random() < 0.18) {
      var ev = pick(EVENTS);
      ev.f(c);
      msg += ' · ' + ev.t;
    }
    var up = false;
    while (c.xp >= needXP(c.lv)) {
      c.xp -= needXP(c.lv);
      c.lv++;
      c.atk += 2; c.def += 2; c.wis += 2; c.gold += 50;
      up = true;
    }
    c.at = now();
    save();
    renderTama();
    var log = $('g4Log');
    if (log) {
      log.__sig = 0;
      log.insertAdjacentHTML('afterbegin', '<div>· ' + esc(F.hhmm(now())) + ' ' + esc(msg) + '</div>');
      var kids = log.querySelectorAll('div');
      for (var i = 8; i < kids.length; i++) kids[i].remove();
    }
    if (up) {
      toast('🎉 레벨 업! Lv.' + c.lv + ' — ' + stage(c.lv).n + ' 단계가 됐어요');
      if (global.FAM4) global.FAM4.notify('🎉', (me().name || '') + '의 ' + c.name + ' 레벨 업!', 'Lv.' + c.lv + ' · ' + stage(c.lv).n + ' 단계가 됐어요');
    } else if (e[0]) toast(msg);
  }
  function wireTama() {
    var box = $('g4Acts');
    if (box) box.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-act]');
      if (b) tamaAct(b.getAttribute('data-act'));
    });
  }

  /* ============================================================
     🧮 수학 · 영어 퀴즈
     ============================================================ */
  function paneQuiz() {
    return '<div class="card"><div class="card-head"><h2>🧮 수학·영어 퀴즈</h2><span class="sub" id="g4QuizSub">–</span></div>' +
      '<div class="seg" id="g4QuizSeg"><button type="button" data-q="math" class="on">🔢 수학</button><button type="button" data-q="eng">🔤 영어</button></div>' +
      '<div class="seg" id="g4LvSeg" style="margin-bottom:11px"><button type="button" data-lv="1" class="on">초급</button><button type="button" data-lv="2">중급</button><button type="button" data-lv="3">고급</button></div>' +
      '<div class="g4-q" id="g4QBox"></div>' +
      '<div class="v4-mini" id="g4QFoot" style="margin-top:8px"></div>' +
      '<div class="hint">정답을 맞히면 XP와 골드를 받아요. 5문제를 연속으로 맞히면 카드도 한 장!</div></div>';
  }
  var qSub = 'math', qLv = 1;
  function newQuestion() {
    quizState = qSub === 'math' ? mathQ(qLv) : engQ(qLv);
    quizState.answered = 0;
    renderQuiz();
  }
  function mathQ(lv) {
    var a, b, q, ans, unit = '';
    if (lv === 1) {
      var t = rnd(3);
      if (t === 0) { a = 10 + rnd(80); b = 10 + rnd(80); q = a + ' + ' + b + ' = ?'; ans = a + b; }
      else if (t === 1) { a = 20 + rnd(70); b = 5 + rnd(a - 6); q = a + ' - ' + b + ' = ?'; ans = a - b; }
      else { a = 2 + rnd(8); b = 2 + rnd(8); q = a + ' × ' + b + ' = ?'; ans = a * b; }
    } else if (lv === 2) {
      var t2 = rnd(4);
      if (t2 === 0) { a = 100 + rnd(800); b = 100 + rnd(800); q = a + ' + ' + b + ' = ?'; ans = a + b; }
      else if (t2 === 1) { a = 10 + rnd(40); b = 2 + rnd(8); q = a + ' × ' + b + ' = ?'; ans = a * b; }
      else if (t2 === 2) { b = 2 + rnd(8); ans = 2 + rnd(9); a = b * ans; q = a + ' ÷ ' + b + ' = ?'; }
      else { a = 200 + rnd(600); ans = 15 + rnd(60); b = 0; q = a + '의 ' + ans + '% 는?'; ans = Math.round(a * ans / 100); }
    } else {
      var t3 = rnd(4);
      if (t3 === 0) { var x = 2 + rnd(9), k = 2 + rnd(7), c0 = 1 + rnd(12); q = k + 'x + ' + c0 + ' = ' + (k * x + c0) + ' 일 때 x는?'; ans = x; }
      else if (t3 === 1) { a = -(5 + rnd(20)); b = 3 + rnd(15); q = '(' + a + ') + ' + b + ' = ?'; ans = a + b; }
      else if (t3 === 2) { a = 2 + rnd(9); b = 2 + rnd(9); var c2 = 2 + rnd(9); q = a + ' × ' + b + ' - ' + c2 + ' = ?'; ans = a * b - c2; }
      else { a = 3 + rnd(9); b = 3 + rnd(9); q = '가로 ' + a + 'cm, 세로 ' + b + 'cm 직사각형의 넓이는? (cm²)'; ans = a * b; unit = ' cm²'; }
    }
    var opts = [ans];
    while (opts.length < 4) {
      var cand = ans + (rnd(2) ? 1 : -1) * (1 + rnd(Math.max(3, Math.round(Math.abs(ans) * 0.2 + 3))));
      if (cand !== ans && opts.indexOf(cand) < 0 && cand >= 0) opts.push(cand);
    }
    opts.sort(function () { return Math.random() - 0.5; });
    return { q: q, ans: ans, opts: opts, unit: unit, kind: 'math' };
  }
  var WORDS1 = [['apple', '사과'], ['banana', '바나나'], ['dog', '개'], ['cat', '고양이'], ['book', '책'], ['water', '물'], ['school', '학교'], ['friend', '친구'], ['happy', '행복한'], ['family', '가족'], ['rain', '비'], ['milk', '우유'], ['tree', '나무'], ['bird', '새'], ['sun', '해']];
  var WORDS2 = [['travel', '여행하다'], ['promise', '약속'], ['delicious', '맛있는'], ['exercise', '운동'], ['weather', '날씨'], ['important', '중요한'], ['remember', '기억하다'], ['together', '함께'], ['holiday', '휴일'], ['healthy', '건강한'], ['borrow', '빌리다'], ['decide', '결정하다'], ['famous', '유명한'], ['prepare', '준비하다'], ['difficult', '어려운']];
  var WORDS3 = [['achieve', '성취하다'], ['encourage', '격려하다'], ['environment', '환경'], ['responsible', '책임감 있는'], ['improve', '향상시키다'], ['experience', '경험'], ['confident', '자신감 있는'], ['generous', '관대한'], ['opportunity', '기회'], ['challenge', '도전'], ['patience', '인내심'], ['excellent', '훌륭한'], ['discover', '발견하다'], ['imagine', '상상하다'], ['respect', '존중하다']];
  function engQ(lv) {
    var pool = lv === 1 ? WORDS1 : (lv === 2 ? WORDS2 : WORDS3);
    var it = pick(pool).slice();
    var others = pool.filter(function (w) { return w[1] !== it[1]; });
    var opts = [it[1]];
    while (opts.length < 4) { var o = pick(others); if (opts.indexOf(o[1]) < 0) opts.push(o[1]); }
    opts.sort(function () { return Math.random() - 0.5; });
    return { q: '“' + it[0] + '” 의 뜻은?', ans: it[1], opts: opts, unit: '', kind: 'eng', word: it[0] };
  }
  function renderQuiz() {
    var box = $('g4QBox'), sub = $('g4QuizSub'), foot = $('g4QFoot');
    if (!box) return;
    var g = G(), q = g.quiz[me().id] || { ok: 0, try: 0, streak: 0 };
    if (sub) sub.textContent = '정답 ' + (q.ok || 0) + ' · 연속 ' + (q.streak || 0);
    if (!quizState) { quizState = qSub === 'math' ? mathQ(qLv) : engQ(qLv); quizState.answered = 0; }
    var st = quizState;
    box.innerHTML = '<div class="v4-mini" style="font-weight:800;color:#0A7D56">' + (st.kind === 'math' ? '🔢 수학' : '🔤 영어') + ' · ' + (qLv === 1 ? '초급' : (qLv === 2 ? '중급' : '고급')) + '</div>' +
      '<div class="quiz">' + esc(st.q) + '</div>' +
      st.opts.map(function (o, i) {
        var cls = 'g4-opt';
        if (st.answered) {
          if (o === st.ans) cls += ' right';
          else if (o === st.pick) cls += ' wrong';
        }
        return '<button type="button" class="' + cls + '" data-opt="' + i + '"><span class="k">' + 'ABCD'[i] + '</span>' + esc(String(o)) + '</button>';
      }).join('') +
      (st.answered ? '<div class="v4-mini" style="margin-top:9px;font-weight:800;color:' + (st.good ? '#0A7D56' : '#C0392B') + '">' + (st.good ? '🎉 정답! XP +' + st.xp + ' · 🪙 +' + st.gold : '😅 아쉬워요 — 정답은 ' + st.ans + st.unit) + '</div>' : '');
    if (foot) foot.textContent = st.answered ? '다음 문제를 눌러 계속하세요' : '정답이라고 생각하는 보기를 눌러 주세요';
    var next = $('g4QNext');
    if (st.answered && !next && foot) {
      foot.innerHTML = '<button type="button" class="btn" id="g4QNext" style="padding:10px;font-size:13px">다음 문제 →</button>';
      $('g4QNext').onclick = function () { newQuestion(); };
    }
  }
  function answer(i) {
    var st = quizState;
    if (!st || st.answered) return;
    var opt = st.opts[i];
    var good = String(opt) === String(st.ans);
    var c = myChar(), g = G();
    var q = g.quiz[me().id] || { ok: 0, try: 0, streak: 0, last: 0 };
    st.answered = 1; st.pick = opt; st.good = good;
    q.try = (q.try || 0) + 1;
    if (good) {
      q.ok = (q.ok || 0) + 1;
      q.streak = (q.streak || 0) + 1;
      q.last = now();
      st.xp = 8 + qLv * 6;
      st.gold = 10 + qLv * 8;
      if (c) { c.xp += st.xp; c.gold += st.gold; c.at = now(); }
      while (c && c.xp >= needXP(c.lv)) { c.xp -= needXP(c.lv); c.lv++; c.atk += 2; c.def += 2; c.wis += 2; c.gold += 50; }
      if (q.streak % 5 === 0) { awardCard('quiz'); toast('🔥 ' + q.streak + '문제 연속 정답! 카드 한 장을 받았어요'); }
      if (global.FAM4 && c) global.FAM4.notify('🧮', (me().name || '') + ' 퀴즈 정답!', st.kind === 'math' ? '수학 문제를 맞혔어요 (+' + st.gold + 'G)' : '영어 문제를 맞혔어요 (+' + st.gold + 'G)');
    } else {
      q.streak = 0;
    }
    g.quiz[me().id] = q;
    save(); renderQuiz(); renderTama();
  }
  function wireQuiz() {
    var seg = $('g4QuizSeg');
    if (seg) seg.addEventListener('click', function (e) {
      var b = e.target.closest('[data-q]');
      if (!b) return;
      qSub = b.getAttribute('data-q');
      Array.prototype.forEach.call(seg.querySelectorAll('button'), function (x) { x.classList.toggle('on', x === b); });
      quizState = null; renderQuiz();
    });
    var lv = $('g4LvSeg');
    if (lv) lv.addEventListener('click', function (e) {
      var b = e.target.closest('[data-lv]');
      if (!b) return;
      qLv = Number(b.getAttribute('data-lv'));
      Array.prototype.forEach.call(lv.querySelectorAll('button'), function (x) { x.classList.toggle('on', x === b); });
      quizState = null; renderQuiz();
    });
    var box = $('g4QBox');
    if (box) box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-opt]');
      if (b) answer(Number(b.getAttribute('data-opt')));
    });
  }

  /* ============================================================
     🃏 일기 포켓몬 카드
     ============================================================ */
  var CARDS = [
    { id: 'pika', n: '피카츄', e: '⚡', t: '전기', r: 'R', c: '#FFF6C9' },
    { id: 'pairi', n: '파이리', e: '🔥', t: '불꽃', r: 'R', c: '#FFE1D6' },
    { id: 'kkobugi', n: '꼬부기', e: '💧', t: '물', r: 'R', c: '#DCEEFF' },
    { id: 'isang', n: '이상해씨', e: '🌱', t: '풀', r: 'R', c: '#E1F6DE' },
    { id: 'nyang', n: '나옹', e: '🐱', t: '노말', r: 'R', c: '#FFF0DC' },
    { id: 'puri', n: '푸린', e: '🎈', t: '노말', r: 'R', c: '#FFE6F0' },
    { id: 'kkul', n: '꼬렛', e: '🐭', t: '노말', r: 'C', c: '#F3EEE8' },
    { id: 'nabi', n: '버터플', e: '🦋', t: '벌레', r: 'C', c: '#EAF3FF' },
    { id: 'bappeul', n: '또가스', e: '💜', t: '독', r: 'C', c: '#F0E6FF' },
    { id: 'digda', n: '디그다', e: '🕳️', t: '땅', r: 'C', c: '#F0E7DA' },
    { id: 'goldeok', n: '고라파덕', e: '🦆', t: '물', r: 'C', c: '#DCEEFF' },
    { id: 'yadon', n: '야돈', e: '🦛', t: '물', r: 'U', c: '#FFE9DD' },
    { id: 'somsom', n: '롱스톤', e: '🪨', t: '바위', r: 'U', c: '#EDE9E1' },
    { id: 'kka', n: '깨비참', e: '🦀', t: '물', r: 'C', c: '#FFE1D9' },
    { id: 'norang', n: '팬텀', e: '👻', t: '고스트', r: 'U', c: '#EEE6FF' },
    { id: 'chikorita', n: '치코리타', e: '🍃', t: '풀', r: 'R', c: '#E4F7E0' },
    { id: 'bujang', n: '부우부', e: '🦉', t: '비행', r: 'C', c: '#F1EADF' },
    { id: 'maril', n: '마릴', e: '🐰', t: '물', r: 'U', c: '#E2F0FF' },
    { id: 'kkoma', n: '꼬마돌', e: '⛰️', t: '바위', r: 'C', c: '#EFEBE4' },
    { id: 'mi', n: '뮤', e: '✨', t: '에스퍼', r: 'L', c: '#FFE9FA' },
    { id: 'mewtwo', n: '뮤츠', e: '🌌', t: '에스퍼', r: 'L', c: '#E9E4FF' },
    { id: 'ryu', n: '망나뇽', e: '🐉', t: '드래곤', r: 'L', c: '#E4E9FF' },
    { id: 'bird', n: '파이어', e: '🕊️', t: '불꽃', r: 'L', c: '#FFE5D2' },
    { id: 'gur', n: '거북왕', e: '🐢', t: '물', r: 'L', c: '#D9F0FF' },
    { id: 'king', n: '리자몽', e: '🐲', t: '불꽃', r: 'L', c: '#FFDFD2' },
    { id: 'snor', n: '잠만보', e: '😴', t: '노말', r: 'U', c: '#E9F1E4' },
    { id: 'lap', n: '라프라스', e: '🐋', t: '물', r: 'U', c: '#DDEEFF' },
    { id: 'eevee', n: '이브이', e: '🦊', t: '노말', r: 'R', c: '#FFEEDC' },
    { id: 'togepi', n: '토게피', e: '🥚', t: '요정', r: 'U', c: '#FFF7E0' },
    { id: 'squir', n: '제르니아스', e: '🦌', t: '요정', r: 'L', c: '#E7F6F8' }
  ];
  var RC = { C: '#79838F', R: '#2F6FD0', U: '#8B5CF6', L: '#D97706' };
  function awardCard(src) {
    var g = G(), id = me() ? me().id : '';
    if (!id) return null;
    var card = pick(CARDS);
    if (!g.card[id]) g.card[id] = {};
    g.card[id][card.id] = (g.card[id][card.id] || 0) + 1;
    var fid = 'cf' + now().toString(36) + Math.random().toString(36).slice(2, 4);
    g.feed[fid] = { mid: id, card: card.id, at: now(), src: src || 'diary' };
    save();
    toast('🃏 ' + card.n + ' 카드를 얻었어요!');
    return card;
  }
  function paneCard() {
    return '<div class="card"><div class="card-head"><h2>🃏 내 카드 가방</h2><span class="sub" id="g4CardSub">0/30</span></div>' +
      '<div class="v4-mini" style="margin:-4px 0 8px">일기를 쓰면 랜덤 카드 1장을 받아요. 퀴즈 5연속 정답에도 카드가 나와요.</div>' +
      '<div class="g4-cards" id="g4CardGrid"></div></div>' +
      '<div class="card"><div class="card-head"><h2>👨‍👩‍👧‍👦 가족 카드 소식</h2><span class="sub">누가 뭘 뽑았나</span></div><div id="g4Feed"></div></div>';
  }
  function renderCard() {
    var g = G(), grid = $('g4CardGrid'), sub = $('g4CardSub'), feed = $('g4Feed');
    if (!grid) return;
    var bag = (me() && g.card[me().id]) || {};
    var kinds = Object.keys(bag).length;
    if (sub) sub.textContent = kinds + '/' + CARDS.length + ' 종';
    grid.innerHTML = CARDS.map(function (c) {
      var has = bag[c.id] || 0;
      return '<div class="g4-card ' + (has ? '' : 'no') + '" style="' + (has ? 'background:' + c.c + ';color:#14181D' : '') + '" title="' + esc(c.n) + '">' +
        (has ? '<span class="c">' + has + '</span>' : '') +
        '<span class="e">' + (has ? c.e : '❔') + '</span><span class="n">' + (has ? esc(c.n) : '???') + '</span>' +
        '<span style="font-size:8px;font-weight:900;color:' + (has ? RC[c.r] : '#C4CDD4') + '">' + (has ? c.r : '') + '</span></div>';
    }).join('');
    if (feed) {
      var es = [];
      Object.keys(g.feed).forEach(function (k) { es.push(g.feed[k]); });
      es.sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
      feed.innerHTML = es.slice(0, 12).map(function (f) {
        var c = CARDS.filter(function (x) { return x.id === f.card; })[0] || { n: '카드', e: '🃏' };
        var m = F.memOf(f.mid);
        return '<div class="v4-row"><span class="e">' + c.e + '</span><span class="tx"><b>' + esc(m.name) + ' · ' + esc(c.n) + '</b><small>' + (f.src === 'quiz' ? '퀴즈 연속 정답' : '일기 작성') + ' · ' + F.ago(f.at) + '</small></span></div>';
      }).join('') || '<div class="v4-empty">아직 카드 소식이 없어요</div>';
    }
  }

  /* ============================================================
     🛍️ 포인트 상점 · 악세사리 선물/교환
     ============================================================ */
  var SHOP = [
    { id: 'hat_cap', k: 'hat', n: '야구모자', e: '🧢', p: 120, look: 'cap' },
    { id: 'hat_beanie', k: 'hat', n: '털모자', e: '🎿', p: 150, look: 'beanie' },
    { id: 'hat_ribbon', k: 'hat', n: '리본', e: '🎀', p: 100, look: 'ribbon' },
    { id: 'hat_crown', k: 'hat', n: '황금 왕관', e: '👑', p: 400, look: 'crown' },
    { id: 'glass_sun', k: 'glass', n: '선글라스', e: '🕶️', p: 180, look: 'sun' },
    { id: 'glass_round', k: 'glass', n: '동그란 안경', e: '👓', p: 120, look: 'round' },
    { id: 'bag_pack', k: 'bag', n: '백팩', e: '🎒', p: 200, look: 'pack' },
    { id: 'bag_tote', k: 'bag', n: '에코백', e: '👜', p: 150, look: 'tote' },
    { id: 'out_mint', k: 'outfit', n: '민트 코트', e: '🧥', p: 250, color: '#37C99B' },
    { id: 'out_pink', k: 'outfit', n: '핑크 패딩', e: '🧥', p: 250, color: '#FF8FAB' },
    { id: 'out_yellow', k: 'outfit', n: '노랑 후드', e: '🧥', p: 250, color: '#FFC24B' },
    { id: 'out_sky', k: 'outfit', n: '하늘 점퍼', e: '🧥', p: 250, color: '#6FA8FF' }
  ];
  var DECOR = [
    { id: 'f_bed', n: '침대', e: '🛏️', p: 150 },
    { id: 'f_desk', n: '책상', e: '🪑', p: 150 },
    { id: 'f_sofa', n: '소파', e: '🛋️', p: 180 },
    { id: 'f_plant', n: '화분', e: '🪴', p: 90 },
    { id: 'f_lamp', n: '스탠드', e: '💡', p: 90 },
    { id: 'f_tv', n: 'TV', e: '📺', p: 200 },
    { id: 'f_poster', n: '포스터', e: '🖼️', p: 70 },
    { id: 'f_teddy', n: '곰인형', e: '🧸', p: 100 },
    { id: 'f_piano', n: '피아노', e: '🎹', p: 220 },
    { id: 'f_fish', n: '어항', e: '🐠', p: 130 }
  ];
  var WALLS = [['#EAF7F1', '민트 벽'], ['#EEF5FF', '하늘 벽'], ['#FFF0F5', '핑크 벽'], ['#F7F1E6', '베이지 벽']];
  var FLOORS = [['#E7D3BC', '원목 바닥'], ['#E3E8EC', '타일 바닥'], ['#F3E1DA', '러그 바닥'], ['#DDE7DC', '잔디 바닥']];
  function itemById(id) {
    var a = SHOP.concat(DECOR);
    for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i];
    return null;
  }
  function paneShop() {
    return '<div class="card"><div class="card-head"><h2>🛍️ 포인트 상점</h2><span class="sub" id="g4ShopGold">0G</span></div>' +
      '<div class="v4-mini" style="margin:-4px 0 8px">퀴즈·일기·돌보기로 모은 골드로 사요. 사면 내 3D 캐릭터에 바로 입혀져요.</div>' +
      '<div class="g4-sec">👒 모자 · 🕶️ 안경 · 🎒 가방 · 🧥 옷</div><div class="g4-shop" id="g4ShopList"></div>' +
      '<div class="g4-sec">🛏️ 마이룸 가구 <span class="n">사면 방에 배치할 수 있어요</span></div><div class="g4-shop" id="g4DecorList"></div>' +
      '<div class="hint">가족에게 선물하기: 아이템을 <b>길게 눌러</b> 선물하거나, 아래 선물함에서 받은 것을 확인하세요.</div></div>' +
      '<div class="card"><div class="card-head"><h2>🎁 선물함</h2><span class="sub" id="g4GiftSub">0개</span></div><div id="g4GiftList"></div></div>';
  }
  function renderShop() {
    var c = myChar(), g = G();
    if (!c) return;
    var gold = $('g4ShopGold');
    if (gold) gold.textContent = (c.gold | 0) + 'G';
    var list = $('g4ShopList'), dec2 = $('g4DecorList');
    if (list) {
      list.innerHTML = SHOP.map(function (it) {
        var own = c.items[it.id] || 0;
        var worn = c.look[it.k] === it.id;
        return '<button type="button" class="g4-item ' + (own ? 'owned' : '') + ' ' + (worn ? 'on' : '') + '" data-buy="' + it.id + '">' +
          '<span class="e">' + it.e + '</span>' + esc(it.n) + '<span class="p">' + (own ? (worn ? '착용 중' : '착용하기') : it.p + 'G') + '</span></button>';
      }).join('');
    }
    if (dec2) {
      dec2.innerHTML = DECOR.map(function (it) {
        var own = c.items[it.id] || 0;
        return '<button type="button" class="g4-item ' + (own ? 'owned' : '') + '" data-buy="' + it.id + '">' +
          '<span class="e">' + it.e + '</span>' + esc(it.n) + '<span class="p">' + (own ? '보유' + (own > 1 ? ' ×' + own : '') : it.p + 'G') + '</span></button>';
      }).join('');
    }
    var gl = $('g4GiftList'), gs = $('g4GiftSub');
    if (gl) {
      var es = [];
      Object.keys(g.gift).forEach(function (k) { var v = g.gift[k]; if (v && !v.d && v.to === me().id) { v._id = k; es.push(v); } });
      es.sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
      if (gs) gs.textContent = es.length + '개';
      gl.innerHTML = es.length ? es.slice(0, 10).map(function (v) {
        var it = itemById(v.item) || { e: '🎁', n: '선물' };
        var m = F.memOf(v.from);
        return '<div class="v4-row"><span class="e">' + it.e + '</span><span class="tx"><b>' + esc(it.n) + '</b><small>' + esc(m.name) + ' 님이 보냈어요 · ' + F.ago(v.at) + '</small></span>' +
          '<button type="button" class="v4-tag" data-claim="' + v._id + '" style="border:none">받기</button></div>';
      }).join('') : '<div class="v4-empty">받은 선물이 없어요</div>';
    }
  }
  function buyItem(id) {
    var c = myChar();
    if (!c) return;
    var it = itemById(id);
    if (!it) return;
    var own = c.items[id] || 0;
    if (own) {
      /* 이미 가진 아이템 → 착용/해제 */
      if (it.k) {
        if (c.look[it.k] === id) { c.look[it.k] = ''; toast(it.n + '을(를) 벗었어요'); }
        else { c.look[it.k] = id; toast(it.n + '을(를) 입었어요 — 3D 놀이터에도 반영!'); }
        syncLook(true);
      } else {
        roomSel = id;
        toast(it.n + '을(를) 방에 배치하려면 마이룸에서 칸을 눌러 주세요');
        pane('room');
      }
      c.at = now();
      save(); renderShop(); renderTama(); return;
    }
    /* 선물 모드 */
    F.openSheet('<h3>' + it.e + ' ' + esc(it.n) + '</h3><div class="sdesc">' + it.p + 'G · 지금 ' + (c.gold | 0) + 'G</div>' +
      '<div style="display:flex;gap:8px;margin-top:8px"><button type="button" class="btn" id="g4BuyMe" style="padding:12px;font-size:13px">내가 살게요</button>' +
      '<button type="button" class="btn soft" id="g4BuyGift" style="padding:12px;font-size:13px">가족에게 선물</button></div>' +
      '<div id="g4GiftPick" style="margin-top:9px"></div>');
    $('g4BuyMe').onclick = function () {
      var cc = myChar();
      if (!cc) return;
      if (cc.gold < it.p) { toast('골드가 모자라요 (' + it.p + 'G 필요)'); return; }
      cc.gold -= it.p; cc.items[id] = (cc.items[id] || 0) + 1;
      if (it.k) cc.look[it.k] = id;
      cc.at = now(); save(); syncLook(true); F.closeSheet(); renderShop(); renderMine(); renderTama();
      toast(it.n + '을(를) 샀어요!' + (it.k ? ' 바로 착용했어요' : ''));
    };
    $('g4BuyGift').onclick = function () {
      var box = $('g4GiftPick');
      var others = F.members().filter(function (m) { return m.id !== me().id; });
      box.innerHTML = '<div class="v4-mini" style="margin-bottom:5px;font-weight:800">누구에게 선물할까요?</div>' +
        others.map(function (m) { return '<button type="button" class="btn ghost" data-gto="' + m.id + '" style="margin-bottom:6px;padding:11px;font-size:13px">' + (m.emoji || '🧑') + ' ' + esc(m.name) + '</button>'; }).join('');
      box.querySelectorAll('[data-gto]').forEach(function (b) {
        b.onclick = function () {
          var to = b.getAttribute('data-gto');
          var cc2 = myChar();
          if (!cc2) return;
          if (cc2.gold < it.p) { toast('골드가 모자라요 (' + it.p + 'G 필요)'); return; }
          cc2.gold -= it.p; cc2.at = now();
          var gid = 'gf' + now().toString(36) + Math.random().toString(36).slice(2, 4);
          G().gift[gid] = { from: me().id, to: to, item: id, at: now() };
          save(); F.closeSheet(); renderShop(); renderTama();
          toast(F.memOf(to).name + ' 님에게 ' + it.n + '을(를) 선물했어요');
          if (global.FAM4) global.FAM4.notify('🎁', me().name + ' 님이 선물을 보냈어요', it.n + ' — 선물함에서 확인하세요');
        };
      });
    };
  }
  function claimGift(id) {
    var g = G(), v = g.gift[id];
    if (!v || v.to !== me().id) return;
    var c = myChar(), it = itemById(v.item);
    if (it) { c.items[v.item] = (c.items[v.item] || 0) + 1; c.at = now(); }
    v.d = 1; v.at = now();
    save(); renderShop(); toast('선물을 받았어요: ' + (it ? it.n : '선물'));
  }
  function wireShop() {
    var s = $('g4ShopList'), d2 = $('g4DecorList'), gl = $('g4GiftList');
    function clickBuy(e) {
      var b = e.target.closest('[data-buy]');
      if (b) buyItem(b.getAttribute('data-buy'));
    }
    if (s) s.addEventListener('click', clickBuy);
    if (d2) d2.addEventListener('click', clickBuy);
    if (gl) gl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-claim]');
      if (b) claimGift(b.getAttribute('data-claim'));
    });
  }

  /* ============================================================
     🛏️ 마이룸 꾸미기
     ============================================================ */
  function paneRoom() {
    return '<div class="card"><div class="card-head"><h2>🛏️ 내 방 꾸미기</h2><span class="sub" id="g4RoomSub">–</span></div>' +
      '<div class="g4-room" id="g4Room"><div class="wall" id="g4RoomWall"></div><div class="floor" id="g4RoomFloor"></div><div class="ch" id="g4RoomCh">🧑</div></div>' +
      '<div class="g4-sec">🎨 벽지</div><div class="g4-shop" id="g4Walls"></div>' +
      '<div class="g4-sec">🟫 바닥</div><div class="g4-shop" id="g4Floors"></div>' +
      '<div class="g4-sec">🪑 가구 배치 <span class="n">아래에서 고르고 방의 칸을 누르세요</span></div>' +
      '<div class="g4-shop" id="g4Furn" style="grid-template-columns:repeat(5,1fr)"></div>' +
      '<div class="hint">가구는 상점에서 사면 여기 보여요. 고른 가구를 방의 칸에 놓고, 놓인 가구를 다시 누르면 치워져요. 벽지·바닥은 골드로 사서 바로 바꿀 수 있어요.</div></div>';
  }
  function renderRoom() {
    var c = myChar();
    if (!c) return;
    var room = $('g4Room'), wall = $('g4RoomWall'), floor = $('g4RoomFloor'), ch = $('g4RoomCh'), sub = $('g4RoomSub');
    if (!room) return;
    room.style.background = c.room.floor || '#E7D3BC';
    if (wall) wall.style.background = c.room.wall || '#EAF7F1';
    if (floor) floor.style.background = 'transparent';
    if (ch) ch.textContent = stage(c.lv).e;
    if (sub) sub.textContent = F.memOf(me().id).name + '의 방 · 가구 ' + (c.room.items || []).filter(Boolean).length + '개';
    if (wall) {
      var html = '';
      for (var i = 0; i < 6; i++) {
        var iid = (c.room.items || [])[i];
        var it = iid ? itemById(iid) : null;
        html += '<div class="g4-slot ' + (it ? 'has' : '') + '" data-slot="' + i + '">' + (it ? it.e : '') + '</div>';
      }
      wall.innerHTML = html;
    }
    var walls = $('g4Walls'), floors = $('g4Floors'), furn = $('g4Furn');
    if (walls) {
      walls.innerHTML = WALLS.map(function (w) {
        return '<button type="button" class="g4-item ' + (c.room.wall === w[0] ? 'on' : '') + '" data-wall="' + w[0] + '" style="background:' + w[0] + '"><span class="e" style="font-size:14px">🎨</span>' + w[1] + '<span class="p">' + (c.room.wall === w[0] ? '사용 중' : '80G') + '</span></button>';
      }).join('');
    }
    if (floors) {
      floors.innerHTML = FLOORS.map(function (w) {
        return '<button type="button" class="g4-item ' + (c.room.floor === w[0] ? 'on' : '') + '" data-floor="' + w[0] + '" style="background:' + w[0] + '"><span class="e" style="font-size:14px">🟫</span>' + w[1] + '<span class="p">' + (c.room.floor === w[0] ? '사용 중' : '80G') + '</span></button>';
      }).join('');
    }
    if (furn) {
      var owned = DECOR.filter(function (it) { return (c.items[it.id] || 0) > 0; });
      furn.innerHTML = owned.length ? owned.map(function (it) {
        return '<button type="button" class="g4-item ' + (roomSel === it.id ? 'on' : '') + '" data-furn="' + it.id + '"><span class="e">' + it.e + '</span>' + esc(it.n) + '</button>';
      }).join('') : '<div class="v4-empty" style="grid-column:1/-1">상점에서 가구를 먼저 사 주세요</div>';
    }
  }
  function wireRoom() {
    var wall = $('g4RoomWall');
    if (wall) wall.addEventListener('click', function (e) {
      var s = e.target.closest('[data-slot]');
      if (!s) return;
      var c = myChar(), i = Number(s.getAttribute('data-slot'));
      if (!c.room.items) c.room.items = [];
      var cur = c.room.items[i];
      if (cur) { c.room.items[i] = ''; c.at = now(); toast('가구를 치웠어요'); }
      else if (roomSel) {
        var it = itemById(roomSel);
        if (!it) return;
        if ((c.items[roomSel] || 0) <= 0) { toast('가지고 있지 않은 가구예요'); return; }
        c.room.items[i] = roomSel;
        c.at = now();
        toast(it.n + '을(를) 놓았어요');
      } else { toast('아래에서 놓을 가구를 먼저 골라 주세요'); return; }
      save(); renderRoom();
    });
    var walls = $('g4Walls');
    if (walls) walls.addEventListener('click', function (e) {
      var b = e.target.closest('[data-wall]');
      if (!b) return;
      var c = myChar(), col = b.getAttribute('data-wall');
      if (c.room.wall === col) { toast('이미 쓰고 있어요'); return; }
      if (c.gold < 80) { toast('골드가 모자라요 (80G)'); return; }
      c.gold -= 80; c.room.wall = col; c.at = now(); save(); renderRoom(); renderShop(); renderTama();
      toast('벽지를 바꿨어요');
    });
    var floors = $('g4Floors');
    if (floors) floors.addEventListener('click', function (e) {
      var b = e.target.closest('[data-floor]');
      if (!b) return;
      var c = myChar(), col = b.getAttribute('data-floor');
      if (c.room.floor === col) { toast('이미 쓰고 있어요'); return; }
      if (c.gold < 80) { toast('골드가 모자라요 (80G)'); return; }
      c.gold -= 80; c.room.floor = col; c.at = now(); save(); renderRoom(); renderShop(); renderTama();
      toast('바닥을 바꿨어요');
    });
    var furn = $('g4Furn');
    if (furn) furn.addEventListener('click', function (e) {
      var b = e.target.closest('[data-furn]');
      if (!b) return;
      roomSel = b.getAttribute('data-furn');
      renderRoom();
      toast('방의 빈 칸을 눌러 놓아 보세요');
    });
  }
  function renderMine() {
    if (!d() || !me()) return;
    var c = myChar();
    if (c) syncLook(false);
  }

  /* ============================================================
     3D 캐릭터에 악세사리 반영
     ============================================================ */
  function key3dFor(m) {
    var n = (m && m.name) || '';
    if (n.indexOf('지율') >= 0) return 'jiyul';
    if (n.indexOf('지섭') >= 0) return 'jiseop';
    if (n.indexOf('수향') >= 0) return 'suhyang';
    if (n.indexOf('상국') >= 0) return 'sangguk';
    switch (m && m.role) {
      case '아빠': return 'sangguk';
      case '엄마': return 'suhyang';
      case '아들': return 'jiseop';
      case '딸': return 'jiyul';
    }
    return 'sangguk';
  }
  function lookMap() {
    var g = G(), out = {};
    F.members().forEach(function (m) {
      var c = g.m[m.id];
      if (!c) return;
      var k3 = key3dFor(m);
      out[k3] = {
        hat: (c.look.hat && (itemById(c.look.hat) || {}).look) || '',
        glass: (c.look.glass && (itemById(c.look.glass) || {}).look) || '',
        bag: (c.look.bag && (itemById(c.look.bag) || {}).look) || '',
        color: (c.look.outfit && (itemById(c.look.outfit) || {}).color) || ''
      };
    });
    return out;
  }
  function syncLook(force) {
    var P = global.FamPlay;
    if (!P) return;
    if (!force && now() - lastLookSync < 3000) return;
    if (typeof P.setLook !== 'function') return;
    lastLookSync = now();
    try { P.setLook(lookMap()); } catch (e) {}
  }

  /* ============================================================
     🎋 가족 윷놀이
     ============================================================ */
  var NODES = {};
  (function () {
    var i;
    for (i = 0; i <= 4; i++) NODES[i] = { x: i * 20, y: 100 };
    for (i = 5; i <= 9; i++) NODES[i] = { x: 100, y: 100 - (i - 5) * 20 };
    for (i = 10; i <= 14; i++) NODES[i] = { x: 100 - (i - 10) * 20, y: 0 };
    for (i = 15; i <= 19; i++) NODES[i] = { x: 0, y: (i - 15) * 20 };
    NODES[23] = { x: 33.3, y: 66.7 };
    NODES[20] = { x: 50, y: 50 };
    NODES[24] = { x: 66.7, y: 33.3 };
    NODES[21] = { x: 66.7, y: 66.7 };
    NODES[22] = { x: 33.3, y: 33.3 };
  })();
  var R0 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 0];
  var R1 = [0, 23, 20, 24, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 0];
  var R2 = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 0];
  var R3 = [5, 21, 20, 22, 15, 16, 17, 18, 19, 0];
  var R4 = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 0];
  var R5 = [10, 24, 20, 23, 0];
  var R6 = [15, 16, 17, 18, 19, 0];
  var R7 = [15, 22, 20, 21, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 0];
  var ROUTES = { '0': R0, '1': R1, '2': R2, '3': R3, '4': R4, '5': R5, '6': R6, '7': R7 };
  var YUT_LABEL = { '-1': '빽도', 1: '도', 2: '개', 3: '걸', 4: '윷', 5: '모' };
  var TEAM_COLORS = ['#E8583E', '#2F6FD0', '#0E9F6E', '#8B5CF6'];

  function newYut(mode, members) {
    var n = Math.min(4, Math.max(2, members.length));
    var order = members.slice(0, n).map(function (m) { return m.id; });
    var teams = {}, teamOf = {};
    order.forEach(function (id, i) {
      var t = mode === 'team' ? (i % 2 === 0 ? 'A' : 'B') : String.fromCharCode(65 + i);
      teamOf[id] = t;
      if (!teams[t]) {
        teams[t] = {
          pieces: [0, 1, 2, 3].map(function () { return { r: '0', i: 0, st: 1, fin: 0 }; }),
          color: TEAM_COLORS[Object.keys(teams).length % 4],
          members: [],
          win: 0
        };
      }
      teams[t].members.push(id);
    });
    return { at: now(), rev: 1, mode: mode, started: 1, order: order, turn: 0, teams: teams, teamOf: teamOf, last: null, msg: '윷을 던져 시작해요!', log: ['게임 시작 · ' + (mode === 'team' ? '2:2 팀전' : '개인전')], winner: '' };
  }
  function myTeam(y) { return y.teamOf[me().id]; }
  function curId(y) { return y.order[y.turn % y.order.length]; }

  function paneYut() {
    return '<div class="card"><div class="card-head"><h2>🎋 가족 윷놀이</h2><span class="sub" id="g4YutSub">–</span></div>' +
      '<div id="g4YutStart"></div>' +
      '<div id="g4YutBody"></div></div>';
  }
  function renderYut() {
    if (!d() || !me()) return;
    var g = G(), y = g.yut, start = $('g4YutStart'), body = $('g4YutBody'), sub = $('g4YutSub');
    if (!start || !body) return;
    if (!y || !y.started) {
      if (sub) sub.textContent = '새 게임';
      start.innerHTML = '<div class="v4-mini" style="margin:-4px 0 9px">각자 스마트폰에서 함께 즐겨요. 윷을 던지고 말을 골라 이동 — 상대 말을 잡으면 한 번 더, 윷·모가 나와도 한 번 더!</div>' +
        '<div class="v4-flex"><button type="button" class="btn" id="g4YutSolo" style="padding:12px;font-size:13px">🙋 개인전 (최대 4인)</button>' +
        '<button type="button" class="btn soft" id="g4YutTeam" style="padding:12px;font-size:13px">🤝 2:2 팀전</button></div>' +
        '<div class="hint">가족이 2명 이상이어야 시작할 수 있어요. 시작하면 가족 모두의 화면에 같은 판이 보여요.</div>';
      body.innerHTML = '';
      var s1 = $('g4YutSolo'), s2 = $('g4YutTeam');
      if (s1) s1.onclick = function () { startYut('solo'); };
      if (s2) s2.onclick = function () { startYut('team'); };
      return;
    }
    if (sub) sub.textContent = (y.mode === 'team' ? '2:2 팀전' : '개인전') + ' · ' + (y.winner ? '끝' : '진행 중');
    start.innerHTML = '';
    /* 판 */
    var mine = myTeam(y);
    var html = '<div class="g4-yut"><div class="bd">';
    Object.keys(NODES).forEach(function (k) {
      var n = Number(k), p = NODES[n];
      var corner = (n === 0 || n === 5 || n === 10 || n === 15);
      html += '<div class="node ' + (corner ? 'corner' : '') + '" style="left:' + p.x + '%;top:' + p.y + '%">' + (n === 0 ? '출' : (n === 20 ? '중' : '')) + '</div>';
    });
    /* 말 그리기 — 같은 칸에 모인 말은 조금씩 비켜 놓는다 */
    var occ = {};
    var allPcs = [];
    Object.keys(y.teams).forEach(function (t) {
      y.teams[t].pieces.forEach(function (pc, idx) {
        if (pc.fin || pc.car || pc.st < 1) return;
        var route = ROUTES[pc.r] || R0;
        var node = route[Math.min(pc.i, route.length - 1)];
        allPcs.push({ t: t, pc: pc, node: node, idx: idx });
      });
    });
    allPcs.sort(function (a, b) { return a.idx - b.idx; });
    allPcs.forEach(function (o) {
      var k = occ[o.node] || 0;
      occ[o.node] = k + 1;
      var p2 = NODES[o.node] || NODES[0];
      var tm = y.teams[o.t];
      var dx = (k % 3) * 3.4, dy = Math.floor(k / 3) * 3.4;
      html += '<div class="pc" style="left:' + (p2.x + dx) + '%;top:' + (p2.y - dy) + '%;background:' + tm.color + '" title="' + esc(F.memOf(tm.members[0]).name) + '">' +
        (o.idx + 1) + (o.pc.st > 1 ? '<span class="s">×' + o.pc.st + '</span>' : '') + '</div>';
    });
    html += '</div></div>';

    /* 상태줄 */
    var turnName = F.memOf(curId(y)).name;
    var tColor = (y.teams[y.teamOf[curId(y)]] || {}).color || '#0E9F6E';
    html += '<div class="g4-turn"><span class="g4-tdot" style="background:' + tColor + '"></span>' +
      (y.winner ? '🏆 ' + y.winner : (curId(y) === me().id ? '내 차례예요!' : turnName + ' 님 차례')) + '</div>';
    html += '<div class="g4-sticks" id="g4Sticks">' + [0, 1, 2, 3].map(function () { return '<div class="g4-stick"></div>'; }).join('') + '</div>';
    html += '<div class="g4-roll" id="g4Roll">' + (y.last ? (YUT_LABEL[y.last.v] + '!') : '윷을 던져 주세요') + '</div>';
    html += '<div class="v4-mini" id="g4YutMsg">' + esc(y.msg || '') + '</div>';

    /* 내 말 선택 */
    if (y.last && y.last.by === me().id && !y.last.done && !y.winner) {
      var tm2 = y.teams[mine];
      html += '<div class="g4-mine" id="g4Mine">' + tm2.pieces.map(function (pc, i) {
        var sel = (y.sel === i) ? ' sel' : '';
        var fin = pc.fin ? ' fin' : '';
        return '<button type="button" class="' + (sel + fin).trim() + '" data-piece="' + i + '">' + (i + 1) + '번 말' + (pc.fin ? ' (완주)' : (pc.st > 1 ? ' ×' + pc.st : '')) + '</button>';
      }).join('') + '</div>';
    }
    html += '<div class="g4-yutbar">' +
      '<button type="button" class="main" id="g4YutRoll"' + (curId(y) !== me().id || y.winner || (y.last && y.last.by === me().id && !y.last.done) ? ' disabled' : '') + '>🎋 윷 던지기</button>' +
      '<button type="button" id="g4YutMove"' + (!(y.last && y.last.by === me().id && !y.last.done) || y.winner ? ' disabled' : '') + '>➡️ 이동</button>' +
      '<button type="button" id="g4YutQuit">나가기</button></div>';

    /* 기록 */
    html += '<div class="g4-log" style="max-height:110px">' + (y.log || []).slice(-12).reverse().map(function (l) { return '<div>· ' + esc(l) + '</div>'; }).join('') + '</div>';
    html += '<div class="hint">말을 골라 <b>이동</b>을 누르면 도·개·걸·윷·모만큼 갑니다. 상대 말을 잡거나 윷·모가 나오면 한 번 더 던져요. 말이 겹치면 업혀서 같이 움직여요.</div>';
    body.innerHTML = html;

    var rb = $('g4YutRoll');
    if (rb) rb.onclick = function () { doRoll(); };
    var mb = $('g4YutMove');
    if (mb) mb.onclick = function () { doMove(); };
    var qb = $('g4YutQuit');
    if (qb) qb.onclick = function () {
      if (!confirm('윷놀이를 끝낼까요? 판이 사라져요.')) return;
      var gy = G(); gy.yut = { at: now(), rev: ((gy.yut || {}).rev || 0) + 1, started: 0, winner: '' }; save(); renderYut(); toast('윷놀이를 정리했어요');
    };
    var mineBox = $('g4Mine');
    if (mineBox) mineBox.addEventListener('click', function (e) {
      var b = e.target.closest('[data-piece]');
      if (!b) return;
      var yy = G().yut;
      if (!yy) return;
      yy.sel = Number(b.getAttribute('data-piece'));
      yy.rev = (yy.rev || 0) + 1;
      yy.at = now();
      save(); renderYut();
    });
  }
  function startYut(mode) {
    var ms = F.members();
    if (ms.length < 2) { toast('가족이 2명 이상 가입해야 같이 놀 수 있어요'); return; }
    var g = G();
    g.yut = newYut(mode, ms);
    g.yut.turn = g.yut.order.indexOf(me().id) >= 0 ? g.yut.order.indexOf(me().id) : 0;
    save(); renderYut();
    if (global.FAM4) global.FAM4.notify('🎋', '가족 윷놀이가 시작됐어요!', (mode === 'team' ? '2:2 팀전' : '개인전') + ' — 지금 들어와서 던져 보세요');
    toast('윷놀이 시작!');
  }
  function rollValue() {
    var r = rnd(17);
    if (r < 4) return 1;
    if (r < 8) return 2;
    if (r < 12) return 3;
    if (r < 15) return 4;
    if (r < 16) return 5;
    return -1;
  }
  function doRoll() {
    var g = G(), y = g.yut;
    if (!y || !y.started || y.winner) return;
    if (curId(y) !== me().id) { toast('내 차례가 아니에요'); return; }
    if (y.last && y.last.by === me().id && !y.last.done) { toast('먼저 말을 옮겨 주세요'); return; }
    var v = rollValue();
    y.last = { by: me().id, v: v, at: now(), done: 0 };
    y.sel = null;
    y.msg = F.memOf(me().id).name + ': ' + YUT_LABEL[v] + '! 말을 골라 이동하세요';
    y.at = now(); y.rev = (y.rev || 0) + 1;
    animSticks(v);
    save(); renderYut();
  }
  function animSticks(v) {
    var box = $('g4Sticks');
    if (!box) return;
    var sticks = box.querySelectorAll('.g4-stick');
    for (var k = 0; k < 3; k++) {
      (function (k) {
        setTimeout(function () {
          for (var i = 0; i < sticks.length; i++) sticks[i].classList.toggle('front', Math.random() < 0.5);
        }, k * 130);
      })(k);
    }
    setTimeout(function () {
      var front = v === -1 ? 1 : v;
      for (var i = 0; i < sticks.length; i++) sticks[i].classList.toggle('front', i < front);
    }, 430);
  }
  function movable(y, team, v) {
    var tm = y.teams[team], out = [];
    tm.pieces.forEach(function (pc, i) {
      if (pc.fin) return;
      if (v === -1) { if (pc.i > 0) out.push(i); return; }
      out.push(i);
    });
    return out;
  }
  function doMove() {
    var g = G(), y = g.yut;
    if (!y || !y.started || y.winner) return;
    if (!y.last || y.last.by !== me().id || y.last.done) { toast('먼저 윷을 던져 주세요'); return; }
    var team = myTeam(y), v = y.last.v;
    var can = movable(y, team, v);
    if (!can.length) {
      y.last.done = 1;
      y.msg = '움직일 말이 없어 차례를 넘겨요';
      y.turn++; y.at = now(); y.rev = (y.rev || 0) + 1;
      save(); renderYut();
      return;
    }
    var pi = (y.sel != null && can.indexOf(y.sel) >= 0) ? y.sel : (can.length === 1 ? can[0] : null);
    if (pi === null) { toast('옮길 말을 골라 주세요'); y.sel = can[0]; save(); renderYut(); return; }
    var pc = y.teams[team].pieces[pi];
    var route = ROUTES[pc.r] || R0;
    /* 빽도 */
    if (v === -1) {
      pc.i = Math.max(0, pc.i - 1);
    } else {
      pc.i = Math.min(route.length - 1, pc.i + v);
    }
    /* 도착 판정 */
    var node = route[pc.i];
    var finished = (pc.i >= route.length - 1) || (node === 0 && pc.i > 0);
    var extra = (v === 4 || v === 5);
    var msg = F.memOf(me().id).name + ': ' + (pi + 1) + '번 말 ' + YUT_LABEL[v] + ' → ';
    if (finished) {
      pc.fin = 1; pc.st = 0;
      msg += '완주! 🎉';
      extra = extra || false;
    } else {
      /* 잡기 & 업기 */
      var cap = 0, stack = 0;
      Object.keys(y.teams).forEach(function (t2) {
        if (t2 === team) return;
        y.teams[t2].pieces.forEach(function (op) {
          if (op.fin || op.car || op.i === 0) return;
          var r2 = ROUTES[op.r] || R0;
          if (r2[op.i] === node) {
            cap += (op.st || 1);
            op.r = '0'; op.i = 0; op.st = 1; op.car = 0;
          }
        });
      });
      var tmOwn = y.teams[team];
      tmOwn.pieces.forEach(function (op, oi) {
        if (oi === pi || op.fin || op.car) return;
        var r3 = ROUTES[op.r] || R0;
        if (r3[op.i] === node && !(op.i === 0 && pc.i === 0)) { stack += (op.st || 1); op.car = 1; op.st = 0; }
      });
      if (stack) { pc.st = (pc.st || 1) + stack; msg += stack + '개 업기! '; }
      if (cap) { extra = true; msg += '상대 말 잡음! 한 번 더 '; }
      msg += '이동 완료';
    }

    /* 승리 */
    var allFin = y.teams[team].pieces.every(function (p4) { return p4.fin; });
    if (allFin) {
      y.winner = (y.mode === 'team' ? '팀 ' + team + ' 승리!' : F.memOf(me().id).name + ' 승리!');
      y.msg = msg;
      y.log.push('🏆 ' + y.winner);
      y.at = now(); y.rev = (y.rev || 0) + 1;
      save(); renderYut();
      if (global.FAM4) global.FAM4.notify('🏆', y.winner, '가족 윷놀이가 끝났어요!');
      return;
    }
    y.last.done = 1;
    y.msg = msg;
    y.log.push(msg);
    if (extra) {
      y.msg += ' — 한 번 더!';
    } else {
      y.turn = (y.turn + 1) % y.order.length;
    }
    y.at = now(); y.rev = (y.rev || 0) + 1;
    save(); renderYut();
  }
  function startYutPoll() {
    if (yutPoll) return;
    yutPoll = setInterval(function () {
      if (document.hidden) return;
      if (paneCur !== 'yut') return;
      F.pull(false);
    }, 2500);
  }
  function stopYutPoll() { if (yutPoll) { clearInterval(yutPoll); yutPoll = null; } }
  function wireYut() { /* 렌더 때마다 개별 연결 */ }

  /* ============================================================
     일기 카드 자동 지급 · 렌더
     ============================================================ */
  function diaryCheck() {
    var c = myChar();
    if (!c) return;
    var D = d(), n = 0, latest = 0;
    Object.keys(D.diary || {}).forEach(function (k) {
      var e = D.diary[k];
      if (e && e.by === me().id) { n++; latest = Math.max(latest, e.at || 0); }
    });
    if (latest > (c.lastDiary || 0)) {
      c.lastDiary = latest;
      c.lastCard = now();
      save();
      awardCard('diary');
    }
  }

  function mount(FAM) {
    if (ON) return;
    F = FAM; ON = true;
    style();
    buildPanes();
    render();
  }
  function render() {
    if (!ON || !F || !F.doc() || !F.me() || !F.hasKey || !F.hasKey()) return;
    if (paneCur === 'tama') renderTama();
    if (paneCur === 'quiz') renderQuiz();
    if (paneCur === 'card') renderCard();
    if (paneCur === 'shop') renderShop();
    if (paneCur === 'room') renderRoom();
    if (paneCur === 'yut') renderYut();
    diaryCheck();
    renderMine();
  }
  function onView(v) {
    if (!ON) return;
    if (v !== 'play') { stopYutPoll(); return; }
    pane(paneCur || '3d');
  }

  global.GAME4 = {
    mount: mount,
    render: render,
    onView: onView,
    pane: function (id) { if ($('pgNav') && $('pgNav').__g4) pane(id); },
    awardCard: awardCard,
    cards: function () { return CARDS; }
  };
})(window);
