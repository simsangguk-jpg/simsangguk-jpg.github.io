/* ============================================================
   우리가족포털 V17 · 용돈기입장 고도화 + 🌟 저 잘했어요! + 홈 인기순 정렬
   ----------------------------------------------------------------------------
   ① 날짜별 용돈기록 — 날짜를 골라 받은 돈/쓴 돈을 적으면 날짜별 사용액·잔액 자동 계산
   ② 🙋 용돈 주세요 — 용돈일을 깜빡했거나 못 받았을 때 요청 → 부모가 '지급 완료'
      누르면 용돈기입장 수입으로 자동 반영 (월 용돈일 설정 포함)
   ③ 🏦 맡겼어요 — 어른들께 받은 용돈을 부모님께 맡긴 기록 · 보관 중 합계 · 돌려받음
   ④ 🌟 저 잘했어요! — 시험 100점·상장·칭찬을 사진과 함께 올리고 가족이 함께 축하
      (사진은 브라우저 Canvas 로 720px·JPEG 0.7 압축, 미리보기만 DB 에 두고 원본은 암호화 저장)
   ⑤ 홈 인기순 자동 정렬 — 홈 카드의 누적 사용 횟수(DOC.v9.homeHits)를 가족 전체로 합산해
      많이 쓰는 칸이 위로 오게 정렬 (홈 꾸미기 옆 버튼으로 끄고 켤 수 있음)
   · 새 네트워크 요청을 만들지 않는다 — 모두 기존 DOC(15초 동기화) 흐름을 그대로 쓴다.
   · 상국포털로 나가는 링크는 두지 않는다(단방향 분리 유지).
   ============================================================ */
(function (global) {
  'use strict';

  var F = null, ON = false;
  var LS_DAY = 'sgf17_daily_view';   /* 날짜별 기록에서 마지막으로 보던 달 */

  function $(id) { return document.getElementById(id); }
  function d() { return F && F.doc(); }
  function me() { return F && F.me(); }
  function esc(s) { return F ? F.esc(s) : String(s == null ? '' : s); }
  function save() { if (F) F.save(); }
  function toast(m) { if (F) F.toast(m); }
  function now() { return Date.now(); }
  function mid() { return me() ? me().id : ''; }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function ymd(ts) { var x = new Date(ts); return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); }
  function todayYmd() { return ymd(now()); }
  function won(n) { return Number(n || 0).toLocaleString('ko-KR') + '원'; }
  function count(o) { return Object.keys(o || {}).length; }
  function memList() { try { return (F && F.members) ? (F.members() || []) : []; } catch (e) { return []; } }
  function memOf(id) { try { return F ? F.memOf(id) : null; } catch (e) { return null; } }
  function memName(id) { var m = memOf(id); return (m && m.name) ? m.name : '가족'; }
  function memEmoji(id) { var m = memOf(id); return (m && m.emoji) || '🧑'; }
  function roleOf(id) { var m = memOf(id) || {}; return String(m.role || ''); }
  function isParent(id) { var r = roleOf(id); return r === '아빠' || r === '엄마' || r === '부모'; }
  function isMine(id) { return id === mid(); }
  function canManage(ownerId) { return isMine(ownerId) || isParent(mid()); }
  function dateKo(s) { return F && F.dateKo ? F.dateKo(s) : String(s || ''); }

  /* ---------------------------------------------------------------- 저장소 */
  function V9() {
    var D = d();
    if (!D) return null;
    if (!D.v9 || typeof D.v9 !== 'object') D.v9 = {};
    var v = D.v9;
    ['homeHits', 'layout', 'moneyD'].forEach(function (k) {
      if (!v[k] || typeof v[k] !== 'object') v[k] = {};
    });
    if (v.layout.autoHits === undefined) v.layout.autoHits = true;
    return v;
  }
  function nodes() {
    var D = d();
    if (!D) return null;
    ['mnReq', 'mnKeep', 'mnCfg', 'praise', 'praiseCm', 'money'].forEach(function (k) {
      if (!D[k] || typeof D[k] !== 'object') D[k] = {};
    });
    return D;
  }
  function reqAll() {
    var D = nodes(); if (!D) return [];
    return Object.keys(D.mnReq).map(function (k) {
      var r = D.mnReq[k];
      if (!r || r.d) return null;
      return {
        _k: k, by: r.by, owner: r.owner || r.by, amt: Number(r.amt || 0), reason: r.reason || '',
        date: r.date || ymd(r.at || now()), status: r.status || 'wait', at: r.at || 0,
        paidAt: r.paidAt || 0, paidBy: r.paidBy || '', mnId: r.mnId || ''
      };
    }).filter(Boolean);
  }
  function keepAll() {
    var D = nodes(); if (!D) return [];
    return Object.keys(D.mnKeep).map(function (k) {
      var r = D.mnKeep[k];
      if (!r || r.d) return null;
      return {
        _k: k, by: r.by, owner: r.owner || r.by, amt: Number(r.amt || 0), from: r.from || '',
        keeper: r.keeper || '', date: r.date || ymd(r.at || now()), memo: r.memo || '',
        status: r.status || 'keep', at: r.at || 0, backAt: r.backAt || 0, backBy: r.backBy || '', mnId: r.mnId || ''
      };
    }).filter(Boolean);
  }
  function praiseAll() {
    var D = nodes(); if (!D) return [];
    return Object.keys(D.praise).map(function (k) {
      var p = D.praise[k];
      if (!p || p.d) return null;
      return {
        _k: k, by: p.by, owner: p.owner || p.by, title: p.title || '', text: p.text || '',
        date: p.date || ymd(p.at || now()), at: p.at || 0, media: p.media || null, likes: p.likes || {}
      };
    }).filter(Boolean).sort(function (a, b) { return b.at - a.at; });
  }
  function commentsOf(postId) {
    var D = nodes(); if (!D) return [];
    return Object.keys(D.praiseCm).map(function (k) {
      var c = D.praiseCm[k];
      if (!c || c.d || c.post !== postId) return null;
      return { _k: k, post: c.post, by: c.by, at: c.at || 0, text: c.text || '' };
    }).filter(Boolean).sort(function (a, b) { return a.at - b.at; });
  }

  /* ---------------------------------------------------------------- 용돈 원장 */
  function moneyEntries() {
    var D = nodes(), v = V9(), out = [];
    if (!D || !v) return out;
    Object.keys(D.money || {}).forEach(function (k) {
      var m = D.money[k];
      if (!m || m.d) return;
      var owner = m.owner || m.by;
      var e = {
        _k: k, owner: owner, by: m.by, amt: Number(m.amount || 0), date: m.date || ymd(m.at || now()),
        memo: m.memo || '', at: m.at || 0, method: m.method || 'cash', src: 'money'
      };
      if (m.kind === 'expense') { e.kind = 'out'; out.push(e); return; }
      if (m.kind === 'income') { e.kind = 'in'; out.push(e); return; }
      if (m.kind === 'allow' && m.status === 'paid') { e.kind = 'in'; e.allow = 1; out.push(e); return; }
      /* allow + unpaid 는 '용돈 주세요' 카드에서 다룬다 */
    });
    /* 옛 '오늘 한 줄 기록'(v9.moneyD)도 같은 원장에 합쳐 보여 준다 */
    Object.keys(v.moneyD || {}).forEach(function (mId) {
      var days = v.moneyD[mId] || {};
      Object.keys(days).forEach(function (dk) {
        var day = days[dk] || {};
        (day.items || []).forEach(function (it, i) {
          if (!it) return;
          out.push({
            _k: 'v9|' + mId + '|' + dk + '|' + i, owner: mId, by: mId, amt: Number(it.amt || 0),
            date: dk, memo: it.t || '', at: it.at || 0, method: 'cash', src: 'v9',
            kind: it.k === 'got' ? 'in' : 'out', allow: it.k === 'got' ? 1 : 0, legacy: 1
          });
        });
      });
    });
    return out;
  }
  function ledgerSum(list, owner) {
    var s = { in: 0, out: 0, bal: 0 };
    list.forEach(function (e) {
      if (owner && owner !== 'all' && e.owner !== owner) return;
      if (e.kind === 'out') s.out += e.amt; else s.in += e.amt;
    });
    s.bal = s.in - s.out;
    return s;
  }

  /* ---------------------------------------------------------------- 날짜별 기록 */
  var dWho = 'all';
  var dMonth = '';
  function monthNow() { var x = new Date(); return x.getFullYear() + '-' + pad(x.getMonth() + 1); }
  function initMonth() {
    if (dMonth) return;
    try { dMonth = localStorage.getItem(LS_DAY) || ''; } catch (e) { dMonth = ''; }
    if (!/^\d{4}-\d{2}$/.test(dMonth)) dMonth = monthNow();
  }
  var dKind = 'in';
  var CATS = {
    in: [{ v: '용돈', t: '💰 용돈' }, { v: '세뱃돈', t: '🧧 세뱃돈' }, { v: '심부름', t: '🏃 심부름' }, { v: '기타', t: '➕ 기타 수입' }],
    out: [{ v: '간식', t: '🍪 간식' }, { v: '문구', t: '✏️ 문구' }, { v: '장난감', t: '🧸 장난감' }, { v: '저축', t: '🐷 저축' }, { v: '기타', t: '➕ 기타 지출' }]
  };
  function catOptions(kind) {
    return (CATS[kind] || CATS.out).map(function (c) { return '<option value="' + esc(c.v) + '">' + esc(c.t) + '</option>'; }).join('');
  }
  function secDaily() {
    return '<div class="card v17-card" id="v17Daily">' +
      '<div class="card-head"><h2>📅 날짜별 용돈기록</h2><span class="sub" id="v17DailyBal">–</span></div>' +
      '<div class="fb-desc">날짜를 골라 <b>받은 돈·쓴 돈</b>을 적으면 그날 사용액과 잔액이 자동으로 계산돼요. 날짜별로 묶여서 한눈에 보여요.</div>' +
      '<div class="v17-form">' +
        '<div class="v17-frow">' +
          '<input class="field" type="date" id="v17Date">' +
          '<div class="seg v17-seg" id="v17Kind">' +
            '<button type="button" data-v17k="in" class="on">💵 받았어요</button>' +
            '<button type="button" data-v17k="out">🛍️ 썼어요</button>' +
          '</div>' +
        '</div>' +
        '<div class="v17-frow">' +
          '<select class="field" id="v17Cat">' + catOptions('in') + '</select>' +
          '<input class="field" type="number" inputmode="numeric" min="0" step="100" id="v17Amt" placeholder="금액">' +
        '</div>' +
        '<div class="v17-frow">' +
          '<input class="field" id="v17Memo" maxlength="30" placeholder="메모 (예: 학원 끝나고 간식)">' +
          '<button type="button" class="btn v17-save" id="v17Save">기록</button>' +
        '</div>' +
        '<div class="v17-frow" id="v17OwnerRow"></div>' +
      '</div>' +
      '<div class="mn-month v17-month"><button type="button" data-v17m="-1" aria-label="이전 달">‹</button><span class="lb" id="v17MonthLabel">–</span><button type="button" data-v17m="1" aria-label="다음 달">›</button></div>' +
      '<div class="mn-who" id="v17Who"></div>' +
      '<div id="v17Days"></div>' +
      '<div class="hint" id="v17Hint">잔액 = 그날까지 받은 돈 − 쓴 돈이에요. 예전 “오늘 한 줄 기록”도 함께 보여 줘요.</div>' +
      '</div>';
  }
  function renderDaily() {
    var box = $('v17Days');
    if (!box) return;
    initMonth();
    var D = nodes(); if (!D) return;
    var all = moneyEntries();
    var owner = dWho;
    var balEl = $('v17DailyBal');
    var s = ledgerSum(all, owner);
    if (balEl) balEl.textContent = '지금 잔액 ' + won(s.bal);

    var lab = $('v17MonthLabel');
    var p = dMonth.split('-');
    if (lab) lab.textContent = p[0] + '년 ' + Number(p[1]) + '월';

    /* 누구 기록인지 — 나 또는 (부모면) 아이 */
    var orow = $('v17OwnerRow');
    var mems = memList();
    if (orow) {
      if (isParent(mid()) && mems.length > 1) {
        var sel = orow.querySelector('select');
        if (!sel) {
          orow.innerHTML = '<label class="v17-lb">누구 기록인가요?</label><select class="field" id="v17Owner">' +
            mems.map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(m.emoji + ' ' + m.name) + '</option>'; }).join('') + '</select>';
          var o = $('v17Owner');
          if (o) { o.value = mid(); }
        }
      } else if (orow.innerHTML) orow.innerHTML = '';
    }

    /* 사람 칩 */
    var who = $('v17Who');
    if (who) {
      var chips = [{ id: 'all', name: '전체', emoji: '👨‍👩‍👧‍👦' }].concat(mems);
      var html = chips.map(function (m) {
        var on = dWho === m.id;
        return '<button type="button" data-v17who="' + esc(m.id) + '"' + (on ? ' class="on"' : '') + '>' +
          esc(m.id === 'all' ? '👨‍👩‍👧‍👦 전체' : (m.emoji + ' ' + m.name)) + '</button>';
      }).join('');
      if (who.__sig !== html) { who.__sig = html; who.innerHTML = html; }
    }

    /* 이번 달 날짜별 묶음 */
    var monthList = all.filter(function (e) { return String(e.date).slice(0, 7) === dMonth && (owner === 'all' || e.owner === owner); });
    var ms = ledgerSum(monthList, 'all');
    var head = '<div class="mn-sum v17-sum">' +
      '<div class="mn-tile in"><div class="l">💵 이번 달 받음</div><div class="v">' + won(ms.in) + '</div></div>' +
      '<div class="mn-tile out"><div class="l">🛍️ 이번 달 씀</div><div class="v">' + won(ms.out) + '</div></div>' +
      '<div class="mn-tile bal"><div class="l">🏦 지금 잔액</div><div class="v">' + won(s.bal) + '</div></div>' +
      '</div>';

    var byDay = {};
    monthList.forEach(function (e) { (byDay[e.date] = byDay[e.date] || []).push(e); });
    var days = Object.keys(byDay).sort().reverse();
    var sig = JSON.stringify([dMonth, dWho, monthList.map(function (e) { return [e._k, e.amt, e.memo, e.kind]; }), s]);
    if (box.__sig === sig) return;
    if (box.contains(document.activeElement)) return;
    box.__sig = sig;

    if (!days.length) {
      box.innerHTML = head + '<div class="fb-empty">' + Number(p[1]) + '월에 남긴 기록이 없어요.<br>위에서 날짜를 고르고 받은 돈·쓴 돈을 적어 보세요.</div>';
      return;
    }
    box.innerHTML = head + days.map(function (dk) {
      var items = byDay[dk].slice().sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
      var ds = ledgerSum(items, 'all');
      var upto = all.filter(function (e) { return String(e.date) <= dk && (owner === 'all' || e.owner === owner); });
      var run = ledgerSum(upto, 'all');
      var rows = items.map(function (e) {
        var inOut = e.kind === 'in';
        return '<div class="v17-item">' +
          '<span class="e">' + (inOut ? '💵' : '🛍️') + '</span>' +
          '<span class="tx"><b>' + esc(e.memo || (inOut ? (e.allow ? '용돈' : '받은 돈') : '사용')) + '</b>' +
          '<small>' + esc(memEmoji(e.owner) + ' ' + memName(e.owner)) + (e.legacy ? ' · 예전 기록' : '') + '</small></span>' +
          '<span class="amt ' + (inOut ? 'in' : 'out') + '">' + (inOut ? '+' : '−') + won(e.amt) + '</span>' +
          (canManage(e.owner) ? '<button type="button" class="v17-del" data-v17del="' + esc(e._k) + '" aria-label="삭제">✕</button>' : '') +
          '</div>';
      }).join('');
      return '<div class="v17-day">' +
        '<div class="v17-dh"><b>' + esc(dateKo(dk)) + '</b>' +
        '<span>' + (ds.in ? '+' + won(ds.in) + ' ' : '') + (ds.out ? '−' + won(ds.out) : '') + '</span>' +
        '<i>잔액 ' + won(run.bal) + '</i></div>' + rows + '</div>';
    }).join('');
  }
  function addMoney() {
    var D = nodes(); if (!D) return;
    var date = ($('v17Date') && $('v17Date').value) || todayYmd();
    var kind = dKind === 'in' ? 'income' : 'expense';
    var cat = $('v17Cat') ? $('v17Cat').value : '기타';
    var amt = Math.round(Number($('v17Amt') && $('v17Amt').value || 0));
    var memo = (($('v17Memo') && $('v17Memo').value) || '').trim();
    var ownerEl = $('v17Owner');
    var owner = (ownerEl && ownerEl.value) || mid();
    if (!isParent(mid())) owner = mid();
    if (!amt || amt <= 0) { toast('금액을 적어 주세요'); return; }
    var text = cat && cat !== '기타' ? (memo ? cat + ' · ' + memo : cat) : (memo || (kind === 'income' ? '받은 돈' : '사용'));
    var id = 'mn' + now().toString(36) + Math.random().toString(36).slice(2, 5);
    D.money[id] = {
      by: mid(), at: now(), owner: owner, kind: kind, amount: amt, method: 'cash',
      memo: text.slice(0, 40), date: date, status: 'paid', v17: 1
    };
    dMonth = date.slice(0, 7);
    try { localStorage.setItem(LS_DAY, dMonth); } catch (e) {}
    save();
    if ($('v17Amt')) $('v17Amt').value = '';
    if ($('v17Memo')) $('v17Memo').value = '';
    var box = $('v17Days'); if (box) box.__sig = '';
    renderDaily(); renderMoneyHome();
    toast((kind === 'income' ? '💵 ' : '🛍️ ') + won(amt) + ' ' + (kind === 'income' ? '받은 돈으로 ' : '쓴 돈으로 ') + '기록했어요');
  }
  function delMoney(key) {
    var D = nodes(); if (!D) return;
    if (String(key).indexOf('v9|') === 0) {
      var parts = String(key).split('|');
      var v = V9(), days = (v.moneyD || {})[parts[1]] || {};
      var day = days[parts[2]];
      if (day && day.items && day.items[Number(parts[3])]) {
        if (!canManage(parts[1])) { toast('내 기록만 지울 수 있어요'); return; }
        day.items.splice(Number(parts[3]), 1);
        day.at = now();
        save();
        var b = $('v17Days'); if (b) b.__sig = '';
        renderDaily(); renderMoneyHome();
        toast('기록을 지웠어요');
      }
      return;
    }
    var m = D.money[key];
    if (!m) return;
    if (!canManage(m.owner || m.by)) { toast('내 기록만 지울 수 있어요'); return; }
    m.d = 1; m.at = now();
    save();
    var box = $('v17Days'); if (box) box.__sig = '';
    renderDaily(); renderMoneyHome();
    toast('기록을 지웠어요');
  }

  /* ---------------------------------------------------------------- 🙋 용돈 주세요 */
  function cfgDay(id) { var D = nodes(); var c = D && D.mnCfg && D.mnCfg[id]; return (c && c.day) ? Number(c.day) : 0; }
  function nextAllowDay(day) {
    var t = new Date(), y = t.getFullYear(), m = t.getMonth();
    var cand = new Date(y, m, Math.min(day, 28));
    if (t.getDate() > Math.min(day, 28)) cand = new Date(y, m + 1, Math.min(day, 28));
    return cand;
  }
  function daysBetween(a, b) { return Math.round((b - a) / 86400000); }
  function secAsk() {
    return '<div class="card v17-card" id="v17Ask">' +
      '<div class="card-head"><h2>🙋 용돈 주세요</h2><span class="sub" id="v17AskSub">–</span></div>' +
      '<div class="fb-desc">용돈일을 깜빡했거나 아직 못 받았을 때 요청해 두세요. 아빠·엄마가 <b>지급 완료</b>를 누르면 용돈기입장 수입에 바로 들어가요.</div>' +
      '<div class="v17-dayline" id="v17DayLine"></div>' +
      '<div id="v17Nudge"></div>' +
      '<button type="button" class="btn v17-big" data-v17="askNew">🙋 용돈 주세요 (요청하기)</button>' +
      '<div id="v17AskList"></div>' +
      '</div>';
  }
  function renderAsk() {
    var box = $('v17AskList');
    if (!box) return;
    var list = reqAll().sort(function (a, b) { return (b.status === 'wait' ? 1 : 0) - (a.status === 'wait' ? 1 : 0) || b.at - a.at; });
    var wait = list.filter(function (r) { return r.status === 'wait'; });
    var paidThis = list.filter(function (r) { return r.status === 'paid' && String(r.date).slice(0, 7) === monthNow(); });
    var sub = $('v17AskSub');
    if (sub) sub.textContent = wait.length ? '대기 ' + wait.length + '건' : (list.length ? '모두 지급 완료' : '요청 없음');

    /* 용돈일 표시 */
    var line = $('v17DayLine');
    if (line) {
      var day = cfgDay(mid());
      var html;
      if (!day) {
        html = '<span class="v17-dl-ico">🗓️</span><span class="v17-dl-tx">내 용돈일을 정해 두면 <b>받을 날</b>을 알려 드려요</span>' +
          '<button type="button" class="v17-mini" data-v17="setDay">용돈일 정하기</button>';
      } else {
        var nx = nextAllowDay(day);
        var dLeft = daysBetween(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()), new Date(nx.getFullYear(), nx.getMonth(), nx.getDate()));
        html = '<span class="v17-dl-ico">🗓️</span><span class="v17-dl-tx">매월 <b>' + day + '일</b> · 다음 용돈일 <b>' + (nx.getMonth() + 1) + '/' + nx.getDate() + '</b> ' +
          (dLeft === 0 ? '(오늘!)' : '(D-' + dLeft + ')') + '</span>' +
          '<button type="button" class="v17-mini" data-v17="setDay">변경</button>';
      }
      if (line.innerHTML !== html) line.innerHTML = html;
    }

    /* 이번 달 아직 못 받았으면 알려 준다 */
    var nudge = $('v17Nudge');
    if (nudge) {
      var day2 = cfgDay(mid());
      var gotThisMonth = moneyEntries().some(function (e) {
        return e.owner === mid() && e.kind === 'in' && e.allow && String(e.date).slice(0, 7) === monthNow();
      });
      var myWait = wait.filter(function (r) { return (r.owner === mid()) && String(r.date).slice(0, 7) === monthNow(); });
      var nh = '';
      if (day2 && !gotThisMonth && new Date().getDate() >= Math.min(day2, 28) && !myWait.length) {
        nh = '<div class="v17-nudge">⏰ 이번 달 용돈일(' + day2 + '일)이 지났는데 아직 못 받았어요. <b>용돈 주세요</b>를 눌러 요청해 보세요.</div>';
      } else if (myWait.length) {
        nh = '<div class="v17-nudge wait">⏳ 내 요청 ' + myWait.length + '건이 기다리고 있어요 · ' + won(myWait[0].amt) + '</div>';
      }
      if (nudge.innerHTML !== nh) nudge.innerHTML = nh;
    }

    var sig = JSON.stringify(list.concat(paidThis.length));
    if (box.__sig === sig) return;
    box.__sig = sig;
    if (!list.length) {
      box.innerHTML = '<div class="fb-empty">아직 용돈 요청이 없어요.<br>필요할 때 위 버튼으로 요청해 보세요.</div>';
      return;
    }
    box.innerHTML = list.slice(0, 12).map(function (r) {
      var waitS = r.status !== 'paid';
      var mine = r.owner === mid();
      var canPay = isParent(mid()) && waitS;
      return '<div class="v17-req' + (waitS ? '' : ' done') + '">' +
        '<div class="v17-req-top">' +
          '<span class="v17-req-who">' + esc(memEmoji(r.owner) + ' ' + memName(r.owner)) + '</span>' +
          '<span class="v17-badge ' + (waitS ? 'wait' : 'ok') + '">' + (waitS ? '⏳ 대기중' : '✅ 지급완료') + '</span>' +
          '<span class="v17-req-amt">' + won(r.amt) + '</span>' +
        '</div>' +
        (r.reason ? '<div class="v17-req-why">' + esc(r.reason) + '</div>' : '') +
        '<div class="v17-req-foot">' + esc(dateKo(r.date)) + (r.paidAt ? ' · ' + esc(F.hhmm(r.paidAt)) + ' 지급' : '') +
          (canPay ? '<button type="button" class="v17-pay" data-v17pay="' + esc(r._k) + '">💵 지급 완료</button>' : '') +
          (mine && waitS ? '<button type="button" class="v17-cancel" data-v17cancel="' + esc(r._k) + '">취소</button>' : '') +
        '</div>' +
        '</div>';
    }).join('');
  }
  function askSheet() {
    var mems = memList();
    var kids = mems.filter(function (m) { return !isParent(m.id); });
    var options = (isParent(mid()) && kids.length ? kids : mems).map(function (m) {
      return '<option value="' + esc(m.id) + '"' + (m.id === mid() ? ' selected' : '') + '>' + esc(m.emoji + ' ' + m.name) + '</option>';
    }).join('');
    F.openSheet('<h3>🙋 용돈 주세요</h3>' +
      '<div class="sdesc">아빠·엄마가 확인하고 <b>지급 완료</b>를 누르면 용돈기입장에 받은 돈으로 자동 기록돼요.</div>' +
      '<div class="form-row"><label>누가 요청하나요?</label><select class="field" id="v17AskWho">' + options + '</select></div>' +
      '<div class="form-row"><label>희망 금액</label><input class="field" type="number" inputmode="numeric" min="0" step="500" id="v17AskAmt" placeholder="예: 10000"></div>' +
      '<div class="form-row"><label>사유 (선택)</label><input class="field" id="v17AskWhy" maxlength="40" placeholder="예: 11월 용돈 아직 못 받았어요"></div>' +
      '<div class="form-row"><label>날짜</label><input class="field" type="date" id="v17AskDate" value="' + todayYmd() + '"></div>' +
      '<div style="display:flex;gap:8px;margin-top:6px"><button type="button" class="btn ghost" data-sheet-close style="flex:1">취소</button>' +
      '<button type="button" class="btn" id="v17AskSave" style="flex:1.4">요청 보내기</button></div>');
    var b = $('v17AskSave');
    if (!b) return;
    b.onclick = function () {
      var D = nodes();
      var owner = $('v17AskWho').value || mid();
      var amt = Math.round(Number($('v17AskAmt').value || 0));
      var why = ($('v17AskWhy').value || '').trim();
      var date = $('v17AskDate').value || todayYmd();
      if (!amt || amt <= 0) { toast('희망 금액을 적어 주세요'); return; }
      var id = 'rq' + now().toString(36) + Math.random().toString(36).slice(2, 5);
      D.mnReq[id] = { by: mid(), at: now(), owner: owner, amt: amt, reason: why.slice(0, 40), date: date, status: 'wait' };
      save();
      F.closeSheet();
      var box = $('v17AskList'); if (box) box.__sig = '';
      renderAsk(); renderMoneyHome();
      toast('🙋 용돈 요청을 올렸어요 · 아빠·엄마가 확인해요');
    };
  }
  function payReq(key) {
    var D = nodes();
    var r = D && D.mnReq && D.mnReq[key];
    if (!r) return;
    if (!isParent(mid())) { toast('아빠·엄마만 지급 완료할 수 있어요'); return; }
    if (r.status === 'paid') return;
    var owner = r.owner || r.by;
    var mnId = 'mn' + now().toString(36) + Math.random().toString(36).slice(2, 5);
    D.money[mnId] = {
      by: mid(), at: now(), owner: owner, kind: 'allow', amount: Number(r.amt || 0), method: 'cash',
      memo: '용돈 요청 ' + (r.reason ? ('· ' + r.reason) : '지급'), date: todayYmd(), status: 'paid',
      v17: 1, reqId: key
    };
    r.status = 'paid'; r.paidAt = now(); r.paidBy = mid(); r.mnId = mnId; r.at = now();
    save();
    ['v17AskList', 'v17Days'].forEach(function (id) { var b = $(id); if (b) b.__sig = ''; });
    renderAsk(); renderDaily(); renderMoneyHome();
    toast('💵 ' + won(r.amt) + ' 지급 완료 · 용돈기입장에 기록했어요');
  }
  function cancelReq(key) {
    var D = nodes();
    var r = D && D.mnReq && D.mnReq[key];
    if (!r) return;
    if (!isMine(r.by) && !isParent(mid())) return;
    r.d = 1; r.at = now();
    save();
    var b = $('v17AskList'); if (b) b.__sig = '';
    renderAsk(); renderMoneyHome();
    toast('요청을 취소했어요');
  }
  function daySheet() {
    F.openSheet('<h3>🗓️ 내 용돈일 정하기</h3>' +
      '<div class="sdesc">매달 용돈 받는 날을 정해 두면, 그날이 지나도록 못 받았을 때 카드가 알려 드려요.</div>' +
      '<div class="form-row"><label>매월 며칠</label><input class="field" type="number" inputmode="numeric" min="1" max="28" id="v17DayNum" value="' + (cfgDay(mid()) || 25) + '"></div>' +
      '<div class="hint">1~28일 사이로 정해 주세요(모든 달에 있는 날).</div>' +
      '<div style="display:flex;gap:8px;margin-top:6px"><button type="button" class="btn ghost" data-sheet-close style="flex:1">취소</button>' +
      '<button type="button" class="btn" id="v17DaySave" style="flex:1.4">저장</button></div>');
    var b = $('v17DaySave');
    if (!b) return;
    b.onclick = function () {
      var D = nodes();
      var n = Math.max(1, Math.min(28, Math.round(Number($('v17DayNum').value || 0))));
      if (!n) { toast('1~28 사이로 정해 주세요'); return; }
      D.mnCfg[mid()] = { day: n, at: now() };
      save();
      F.closeSheet();
      renderAsk(); renderMoneyHome();
      toast('매월 ' + n + '일을 용돈일로 정했어요');
    };
  }

  /* ---------------------------------------------------------------- 🏦 맡겼어요 */
  function secKeep() {
    return '<div class="card v17-card" id="v17Keep">' +
      '<div class="card-head"><h2>🏦 맡겼어요</h2><span class="sub" id="v17KeepSub">–</span></div>' +
      '<div class="fb-desc">명절·생일에 어른들께 받은 용돈을 부모님께 맡길 때 적어 두세요. <b>보관 중인 돈</b>이 한눈에 보여요.</div>' +
      '<div class="v17-keep-sum" id="v17KeepSum"></div>' +
      '<button type="button" class="btn v17-big soft" data-v17="keepNew">🏦 부모님께 맡기기 (기록하기)</button>' +
      '<div id="v17KeepList"></div>' +
      '</div>';
  }
  function keepStat() {
    var list = keepAll();
    var sum = 0, n = 0;
    list.forEach(function (r) { if (r.status !== 'back') { sum += r.amt; n++; } });
    return { sum: sum, n: n, list: list };
  }
  function renderKeep() {
    var st = keepStat();
    var sumEl = $('v17KeepSum');
    if (sumEl) {
      sumEl.innerHTML = '<div class="v17-ksum"><span class="l">🏦 보관 중인 돈</span><b>' + won(st.sum) + '</b><small>' + st.n + '건</small></div>';
    }
    var sub = $('v17KeepSub');
    if (sub) sub.textContent = st.n ? st.n + '건 보관 중' : '보관 중 없음';
    var box = $('v17KeepList');
    if (!box) return;
    var sig = JSON.stringify(st.list.map(function (r) { return [r._k, r.status, r.amt, r.from]; }));
    if (box.__sig === sig) return;
    box.__sig = sig;
    if (!st.list.length) {
      box.innerHTML = '<div class="fb-empty">아직 맡긴 기록이 없어요.<br>세뱃돈·생일 용돈을 맡기면 여기에 쌓여요.</div>';
      return;
    }
    var list = st.list.slice().sort(function (a, b) { return (a.status === 'back' ? 1 : 0) - (b.status === 'back' ? 1 : 0) || b.at - a.at; });
    box.innerHTML = list.slice(0, 14).map(function (r) {
      var keeping = r.status !== 'back';
      var keeperName = r.keeper ? memName(r.keeper) : '부모님';
      return '<div class="v17-keep' + (keeping ? '' : ' done') + '">' +
        '<div class="v17-req-top">' +
          '<span class="v17-req-who">' + esc(memEmoji(r.owner) + ' ' + memName(r.owner)) + '</span>' +
          '<span class="v17-badge ' + (keeping ? 'wait' : 'ok') + '">' + (keeping ? '🏦 보관 중' : '↩️ 돌려받음') + '</span>' +
          '<span class="v17-req-amt">' + won(r.amt) + '</span>' +
        '</div>' +
        '<div class="v17-req-why">' + (r.from ? esc(r.from) + '께 받은 돈 · ' : '') + esc(keeperName) + '께 맡김' + (r.memo ? ' · ' + esc(r.memo) : '') + '</div>' +
        '<div class="v17-req-foot">' + esc(dateKo(r.date)) +
          (keeping && canManage(r.owner) ? '<button type="button" class="v17-pay" data-v17back="' + esc(r._k) + '">↩️ 돌려받음</button>' : '') +
          (r.backAt ? '<span class="v17-ok">' + esc(dateKo(ymd(r.backAt))) + ' 돌려받음</span>' : '') +
        '</div></div>';
    }).join('');
  }
  function keepSheet() {
    var mems = memList();
    var parents = mems.filter(function (m) { return isParent(m.id); });
    var kids = mems.filter(function (m) { return !isParent(m.id); });
    var ownerOpts = (isParent(mid()) && kids.length ? kids : mems).map(function (m) {
      return '<option value="' + esc(m.id) + '"' + (m.id === mid() ? ' selected' : '') + '>' + esc(m.emoji + ' ' + m.name) + '</option>';
    }).join('');
    var keeperOpts = (parents.length ? parents : mems).map(function (m) {
      return '<option value="' + esc(m.id) + '">' + esc(m.emoji + ' ' + m.name) + '</option>';
    }).join('');
    F.openSheet('<h3>🏦 맡겼어요</h3>' +
      '<div class="sdesc">누구에게 받은 용돈을 누구에게 맡겼는지 적어 두면, 나중에 찾을 때도 정확해요.</div>' +
      '<div class="form-row"><label>누구 돈인가요?</label><select class="field" id="v17KeepWho">' + ownerOpts + '</select></div>' +
      '<div class="form-row"><label>얼마를 맡겼나요?</label><input class="field" type="number" inputmode="numeric" min="0" step="1000" id="v17KeepAmt" placeholder="예: 50000"></div>' +
      '<div class="form-row"><label>누구에게 받은 돈인가요?</label><input class="field" id="v17KeepFrom" maxlength="20" placeholder="예: 할아버지, 외할머니, 이모"></div>' +
      '<div class="form-row"><label>누구에게 맡겼나요?</label><select class="field" id="v17KeepKeeper">' + keeperOpts + '</select></div>' +
      '<div class="form-row"><label>날짜</label><input class="field" type="date" id="v17KeepDate" value="' + todayYmd() + '"></div>' +
      '<div class="form-row"><label>메모 (선택)</label><input class="field" id="v17KeepMemo" maxlength="30" placeholder="예: 설날 세뱃돈"></div>' +
      '<div style="display:flex;gap:8px;margin-top:6px"><button type="button" class="btn ghost" data-sheet-close style="flex:1">취소</button>' +
      '<button type="button" class="btn" id="v17KeepSave" style="flex:1.4">맡긴 기록 남기기</button></div>');
    var b = $('v17KeepSave');
    if (!b) return;
    b.onclick = function () {
      var D = nodes();
      var amt = Math.round(Number($('v17KeepAmt').value || 0));
      if (!amt || amt <= 0) { toast('금액을 적어 주세요'); return; }
      var id = 'kp' + now().toString(36) + Math.random().toString(36).slice(2, 5);
      D.mnKeep[id] = {
        by: mid(), at: now(), owner: $('v17KeepWho').value || mid(), amt: amt,
        from: ($('v17KeepFrom').value || '').trim().slice(0, 20),
        keeper: $('v17KeepKeeper').value || '', date: $('v17KeepDate').value || todayYmd(),
        memo: ($('v17KeepMemo').value || '').trim().slice(0, 30), status: 'keep'
      };
      save();
      F.closeSheet();
      var box = $('v17KeepList'); if (box) box.__sig = '';
      renderKeep(); renderMoneyHome();
      toast('🏦 ' + won(amt) + ' 맡긴 기록을 남겼어요');
    };
  }
  function backKeep(key) {
    var D = nodes();
    var r = D && D.mnKeep && D.mnKeep[key];
    if (!r) return;
    if (!canManage(r.owner || r.by)) { toast('본인 또는 부모만 처리할 수 있어요'); return; }
    if (r.status === 'back') return;
    r.status = 'back'; r.backAt = now(); r.backBy = mid(); r.at = now();
    /* 돌려받은 돈은 다시 내 손에 들어온 돈 — 용돈기입장 수입에 한 번만 기록 */
    if (!r.mnId) {
      var mnId = 'mn' + now().toString(36) + Math.random().toString(36).slice(2, 5);
      D.money[mnId] = {
        by: mid(), at: now(), owner: r.owner || r.by, kind: 'income', amount: Number(r.amt || 0),
        method: 'cash', memo: '맡겼던 용돈 돌려받음', date: todayYmd(), status: 'paid', v17: 1, keepId: key
      };
      r.mnId = mnId;
    }
    save();
    var box = $('v17KeepList'); if (box) box.__sig = '';
    var db = $('v17Days'); if (db) db.__sig = '';
    renderKeep(); renderDaily(); renderMoneyHome();
    toast('↩️ 돌려받음으로 바꿨어요 · 용돈기입장에도 넣었어요');
  }

  /* ---------------------------------------------------------------- 🌟 저 잘했어요! */
  var REACTS = [
    { k: 'cheer', e: '🎉', t: '축하해요' },
    { k: 'best', e: '👏', t: '최고예요' },
    { k: 'cute', e: '💚', t: '기특해요' },
    { k: 'love', e: '❤️', t: '사랑해요' }
  ];
  function reactCount(likes, k) {
    var n = 0;
    Object.keys(likes || {}).forEach(function (u) { var r = likes[u]; if (r && r.v && (r.r || 'cheer') === k) n++; });
    return n;
  }
  function myReact(likes) {
    var r = (likes || {})[mid()];
    return r && r.v ? (r.r || 'cheer') : '';
  }
  function praiseBadge(p) {
    var likes = p.likes || {}, tot = 0;
    Object.keys(likes).forEach(function (u) { if (likes[u] && likes[u].v) tot++; });
    var cm = commentsOf(p._k).length;
    return { tot: tot, cm: cm };
  }
  function praiseCardHtml(p, full) {
    var b = praiseBadge(p);
    var mineR = myReact(p.likes);
    var reacts = REACTS.map(function (r) {
      var n = reactCount(p.likes, r.k);
      return '<button type="button" class="v17-r' + (mineR === r.k ? ' on' : '') + '" data-v17react="' + esc(p._k) + ':' + r.k + '">' +
        r.e + ' ' + esc(r.t) + (n ? ' <b>' + n + '</b>' : '') + '</button>';
    }).join('');
    var cms = commentsOf(p._k);
    var cmHtml = cms.map(function (c) {
      return '<div class="v17-cm"><b>' + esc(memEmoji(c.by) + ' ' + memName(c.by)) + '</b>' +
        '<span>' + esc(c.text) + '</span>' +
        '<i>' + esc(F.ago(c.at)) + '</i>' +
        (canManage(c.by) ? '<button type="button" class="v17-del" data-v17cmdel="' + esc(c._k) + '">✕</button>' : '') + '</div>';
    }).join('');
    var img = (p.media && p.media.thumb)
      ? '<div class="v17-photo"><img src="' + esc(p.media.thumb) + '" alt="" data-v17photo="' + esc(p._k) + '"></div>'
      : '';
    return '<div class="v17-post' + (full ? '' : ' mini') + '">' +
      '<div class="v17-post-top">' +
        '<span class="v17-post-who">' + esc(memEmoji(p.owner) + ' ' + memName(p.owner)) + '</span>' +
        '<span class="v17-post-date">' + esc(dateKo(p.date)) + '</span>' +
        (canManage(p.by) ? '<button type="button" class="v17-del" data-v17pdel="' + esc(p._k) + '" aria-label="삭제">✕</button>' : '') +
      '</div>' +
      (p.title ? '<div class="v17-post-title">🌟 ' + esc(p.title) + '</div>' : '') +
      img +
      (p.text ? '<div class="v17-post-text">' + esc(p.text).replace(/\n/g, '<br>') + '</div>' : '') +
      '<div class="v17-reacts">' + reacts + '</div>' +
      (full ? ('<div class="v17-cms">' + (cmHtml || '<div class="v17-cm empty">첫 번째 축하 한마디를 남겨 주세요 💚</div>') + '</div>' +
        '<div class="v17-cmin"><input class="field" id="v17cm' + esc(p._k) + '" maxlength="60" placeholder="축하 한마디">' +
        '<button type="button" class="btn v17-cmbtn" data-v17cm="' + esc(p._k) + '">등록</button></div>')
        : ('<div class="v17-post-foot"><span>🎉 ' + b.tot + '</span><span>💬 ' + b.cm + '</span>' +
          '<button type="button" class="v17-more" data-v17open="' + esc(p._k) + '">축하 남기기 ›</button></div>')) +
      '</div>';
  }
  function secPraiseHome() {
    return '<div class="card v17-card v17-praise-home" id="v17PraiseCard">' +
      '<div class="card-head"><h2>🌟 저 잘했어요!</h2><span class="sub" id="v17PrSub">–</span></div>' +
      '<button type="button" class="v17-banner" data-v17="prNew">' +
        '<span class="v17-bn-ic">🏆</span>' +
        '<span class="v17-bn-tx"><b>시험 100점·상장·칭찬받은 일</b><small>사진과 함께 자랑하면 가족이 다 같이 축하해 줘요</small></span>' +
        '<span class="v17-bn-go">＋ 올리기</span>' +
      '</button>' +
      '<div id="v17PrLatest"></div>' +
      '</div>';
  }
  function secPraisePanel() {
    return '<div class="card v17-card" id="v17PraisePanel">' +
      '<div class="card-head"><h2>🌟 저 잘했어요!</h2><span class="sub" id="v17PrCount">–</span></div>' +
      '<div class="fb-desc">100점·상장·칭찬받은 일을 사진과 함께 올려 보세요. 가족 모두가 <b>축하 버튼</b>과 <b>축하 한마디</b>로 함께 기뻐해 줄 수 있어요.</div>' +
      '<button type="button" class="btn v17-big" data-v17="prNew">📸 사진 올리고 자랑하기</button>' +
      '<div id="v17PrList"></div>' +
      '</div>';
  }
  function renderPraise() {
    var list = praiseAll();
    var sub = $('v17PrSub');
    if (sub) sub.textContent = list.length ? '최근 ' + esc(memName(list[0].owner)) + ' · ' + list.length + '개' : '아직 없음';
    var latest = $('v17PrLatest');
    if (latest) {
      var html = list.length ? praiseCardHtml(list[0], false) + (list.length > 1
        ? '<button type="button" class="btn soft v17-allbtn" data-v17="prAll">가족 축하 모두 보기 (' + list.length + ')</button>' : '')
        : '<div class="fb-empty">아직 자랑 카드가 없어요.<br>오늘 100점 맞았거나 칭찬받은 일이 있으면 사진으로 올려 보세요!</div>';
      if (latest.__sig !== html) { latest.__sig = html; latest.innerHTML = html; }
    }
    var box = $('v17PrList');
    if (box) {
      var cnt = $('v17PrCount');
      if (cnt) cnt.textContent = list.length + '개';
      var h2 = list.length ? list.slice(0, 30).map(function (p) { return praiseCardHtml(p, true); }).join('')
        : '<div class="fb-empty">아직 올린 자랑이 없어요.<br>위 버튼으로 첫 번째 자랑을 올려 보세요!</div>';
      if (box.__sig !== h2) { box.__sig = h2; box.innerHTML = h2; }
    }
  }
  var prFiles = [];   /* 작성 시트에서 고른 사진 */
  function praiseSheet() {
    prFiles = [];
    var mems = memList();
    var kids = mems.filter(function (m) { return !isParent(m.id) && m.id !== mid(); });
    var mine = mems.filter(function (m) { return m.id === mid(); })[0];
    var list = (mine ? [mine] : []).concat(isParent(mid()) ? kids : mems);
    var opts = list.map(function (m) {
      return '<option value="' + esc(m.id) + '"' + (m.id === mid() ? ' selected' : '') + '>' + esc(m.emoji + ' ' + m.name + (m.id === mid() ? ' (나)' : '')) + '</option>';
    }).join('');
    F.openSheet('<h3>🌟 저 잘했어요!</h3>' +
      '<div class="sdesc">100점·상장·칭찬받은 일을 사진과 함께 올려 보세요. 가족이 다 같이 축하해 줄 거예요!</div>' +
      '<div class="form-row"><label>누구의 자랑인가요?</label><select class="field" id="v17PrWho">' + opts + '</select></div>' +
      '<div class="form-row"><label>제목</label><input class="field" id="v17PrTitle" maxlength="30" placeholder="예: 수학 100점! / 상장 받았어요"></div>' +
      '<div class="form-row"><label>내용 (선택)</label><textarea class="field" id="v17PrText" rows="3" maxlength="300" placeholder="어떤 일이 있었는지 적어 주세요"></textarea></div>' +
      '<div class="form-row"><label>사진 (선택 · 자동으로 작게 저장돼요)</label>' +
        '<div class="v17-pick"><button type="button" class="btn soft" data-v17="prCam">📷 사진 찍기</button>' +
        '<button type="button" class="btn soft" data-v17="prGal">🖼️ 갤러리</button></div>' +
        '<div id="v17PrPrev" class="v17-prev"></div>' +
        '<input type="file" id="v17PrFileCam" accept="image/*" capture="environment" class="v17-file">' +
        '<input type="file" id="v17PrFileGal" accept="image/*" class="v17-file">' +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-top:6px"><button type="button" class="btn ghost" data-sheet-close style="flex:1">취소</button>' +
      '<button type="button" class="btn" id="v17PrSave" style="flex:1.4">자랑 올리기</button></div>');
    var cam = $('v17PrFileCam'), gal = $('v17PrFileGal');
    function onPick(e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      if (!/^image\//.test(f.type || '')) { toast('사진 파일만 올릴 수 있어요'); return; }
      prFiles = [f];
      F.compressImage(f, 300, 0.6).then(function (thumb) {
        var prev = $('v17PrPrev');
        if (prev) prev.innerHTML = '<img src="' + esc(thumb) + '" alt=""><button type="button" class="v17-del" data-v17="prClear">✕</button>';
      }).catch(function () { });
    }
    if (cam) cam.onchange = onPick;
    if (gal) gal.onchange = onPick;
    var b = $('v17PrSave');
    if (!b) return;
    b.onclick = async function () {
      var D = nodes();
      var title = ($('v17PrTitle').value || '').trim();
      var text = ($('v17PrText').value || '').trim();
      var owner = $('v17PrWho').value || mid();
      if (!title && !text && !prFiles.length) { toast('제목이나 사진을 넣어 주세요'); return; }
      b.disabled = true; b.textContent = '올리는 중…';
      var media = null;
      try {
        if (prFiles.length) {
          var thumb = await F.compressImage(prFiles[0], 300, 0.6);
          var full = await F.compressImage(prFiles[0], 720, 0.7);   /* 데이터·용량 절약: 가로 720px · JPEG 0.7 */
          var mId = F.putMedia ? await F.putMedia(full) : '';
          media = { id: mId, thumb: thumb };
        }
      } catch (e) {
        console.warn('praise photo', e);
        toast('사진을 줄이지 못했어요 · 사진 없이 올릴게요');
        media = null;
      }
      var id = 'pr' + now().toString(36) + Math.random().toString(36).slice(2, 5);
      D.praise[id] = {
        by: mid(), at: now(), owner: owner, title: title.slice(0, 30), text: text.slice(0, 300),
        date: todayYmd(), media: media, likes: {}
      };
      save();
      prFiles = [];
      F.closeSheet();
      renderPraise();
      toast('🌟 자랑을 올렸어요! 가족이 축하해 줄 거예요');
    };
  }
  function toggleReact(postId, kind) {
    var D = nodes();
    var p = D.praise[postId];
    if (!p) return;
    if (!p.likes) p.likes = {};
    var cur = p.likes[mid()];
    if (cur && cur.v && (cur.r || 'cheer') === kind) p.likes[mid()] = { v: 0, at: now(), r: kind };
    else p.likes[mid()] = { v: 1, at: now(), r: kind };
    p.at = p.at || now();
    save();
    renderPraise();
  }
  function addComment(postId) {
    var D = nodes();
    var inp = $('v17cm' + postId);
    var txt = inp ? String(inp.value || '').trim() : '';
    if (!txt) { toast('축하 한마디를 적어 주세요'); return; }
    var id = 'pc' + now().toString(36) + Math.random().toString(36).slice(2, 5);
    D.praiseCm[id] = { post: postId, by: mid(), at: now(), text: txt.slice(0, 60) };
    save();
    renderPraise();
    toast('💚 축하 한마디를 남겼어요');
  }
  function delPraise(postId) {
    var D = nodes();
    var p = D.praise[postId];
    if (!p) return;
    if (!canManage(p.by)) { toast('작성자나 부모만 지울 수 있어요'); return; }
    p.d = 1; p.at = now();
    save(); renderPraise();
    toast('자랑 카드를 지웠어요');
  }
  function delComment(cid) {
    var D = nodes();
    var c = D.praiseCm[cid];
    if (!c) return;
    if (!canManage(c.by)) return;
    c.d = 1; c.at = now();
    save(); renderPraise();
  }
  function viewPhoto(postId) {
    var D = nodes();
    var p = D.praise && D.praise[postId];
    if (!p || !p.media || !p.media.id) { toast('사진이 없어요'); return; }
    F.openSheet('<h3>🌟 ' + esc(p.title || '저 잘했어요!') + '</h3>' +
      '<div class="sdesc">' + esc(memName(p.owner)) + ' · ' + esc(dateKo(p.date)) + '</div>' +
      '<div class="v17-full"><div class="v17-loading">사진 불러오는 중…</div></div>' +
      '<div style="margin-top:8px"><button type="button" class="btn ghost" data-sheet-close>닫기</button></div>');
    var box = document.querySelector('#sheetInner .v17-full');
    F.mediaUrl(p.media.id).then(function (src) {
      if (box) box.innerHTML = '<img src="' + esc(src) + '" alt="">';
    }).catch(function () {
      if (box) box.innerHTML = '<div class="fb-empty">사진을 불러오지 못했어요. 잠시 후 다시 열어 주세요.</div>';
    });
  }
  function openPraise() {
    F.openLife('praise');
    setTimeout(function () {
      var el = $('life-praise');
      if (el && el.scrollIntoView) { try { el.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) {} }
    }, 220);
  }

  /* ---------------------------------------------------------------- 💰 홈 요약 */
  var mMonth = '';
  function secMoneyHome() {
    return '<div class="card v17-card v17-money-home" id="v17MoneyCard">' +
      '<div class="card-head"><h2>💰 용돈 한눈에</h2><span class="sub" id="v17mhSub">–</span></div>' +
      '<div class="mn-sum v17-sum" id="v17mhTiles"></div>' +
      '<div class="v17-quick">' +
        '<button type="button" data-v17="askNew">🙋 용돈 주세요</button>' +
        '<button type="button" data-v17="keepNew">🏦 맡겼어요</button>' +
        '<button type="button" data-v17="goMoney">📅 기록하기</button>' +
      '</div>' +
      '<div class="hint" id="v17mhNote">–</div>' +
      '</div>';
  }
  function renderMoneyHome() {
    var tiles = $('v17mhTiles');
    if (!tiles) return;
    var all = moneyEntries();
    var mine = mid();
    var s = ledgerSum(all, mine);
    var m = ledgerSum(all.filter(function (e) { return String(e.date).slice(0, 7) === monthNow(); }), mine);
    tiles.innerHTML =
      '<div class="mn-tile in"><div class="l">이번 달 받음</div><div class="v">' + won(m.in) + '</div></div>' +
      '<div class="mn-tile out"><div class="l">이번 달 씀</div><div class="v">' + won(m.out) + '</div></div>' +
      '<div class="mn-tile bal"><div class="l">내 잔액</div><div class="v">' + won(s.bal) + '</div></div>';
    var wait = reqAll().filter(function (r) { return r.status === 'wait'; });
    var kp = keepStat();
    var notes = [];
    if (wait.length) notes.push('🙋 대기 중 요청 ' + wait.length + '건');
    if (kp.n) notes.push('🏦 보관 중 ' + won(kp.sum));
    var note = $('v17mhNote');
    if (note) note.textContent = notes.length ? notes.join(' · ') : '날짜별 기록·용돈 요청·맡긴 돈을 여기서 바로 열 수 있어요.';
    var sub = $('v17mhSub');
    if (sub) sub.textContent = '내 잔액 ' + won(s.bal);
  }

  /* ---------------------------------------------------------------- 홈 정렬 */
  /* 기본 추천 순서 — 매일 가장 자주 보는 칸부터 (인기순이 같은 횟수일 때 이 순서) */
  var DEFAULT_HOME = [
    'briefCard',       /* 오늘 날씨·옷차림 */
    'v9DdayCard',      /* 우리 가족 디데이 */
    'v9FortuneCard',   /* 오늘 우리 가족 띠 운세 */
    'v17PraiseCard',   /* 🌟 저 잘했어요! */
    'v9MoodCard',      /* 지금 우리 가족 기분 */
    'v17MoneyCard',    /* 💰 용돈 한눈에 */
    'v10EtaCard',      /* 도착 알림 */
    'v10LocCard',      /* 가족 위치 */
    'v9PodCard'        /* 오늘의 대표사진 */
  ];
  function hitTotals(v) {
    var t = {};
    Object.keys(v.homeHits || {}).forEach(function (uid) {
      var rec = v.homeHits[uid];
      if (!rec || !rec.n) return;
      Object.keys(rec.n).forEach(function (cid) { t[cid] = (Number(t[cid]) || 0) + Number(rec.n[cid] || 0); });
    });
    return t;
  }
  var lastHitAt = 0, hitTimer = null, hitDirty = false;
  function flushHits() {
    hitTimer = null;
    if (!hitDirty) return;
    hitDirty = false;
    try { save(); } catch (e) { }
  }
  function recordHit(ev) {
    var home = $('view-home');
    if (!home || !ev.target || !ev.target.closest) return;
    var hitEl = ev.target.closest('button,a,input,select,textarea,[role="button"],[data-v17]');
    if (!hitEl) return;
    var card = hitEl.closest('#view-home > div[id]');
    if (!card || card.id === 'v10Hero') return;
    var v = V9();
    if (!v) return;
    var uid = mid();
    if (!uid) return;
    if (!v.homeHits[uid]) v.homeHits[uid] = { at: 0, n: {} };
    var rec = v.homeHits[uid];
    if (!rec.n) rec.n = {};
    rec.n[card.id] = (Number(rec.n[card.id]) || 0) + 1;
    rec.at = now();
    lastHitAt = now();
    hitDirty = true;
    if (hitTimer) clearTimeout(hitTimer);
    hitTimer = setTimeout(flushHits, 8000);
  }
  function orderHome() {
    var home = $('view-home');
    var v = V9();
    if (!home || !v) return;
    if (v.layout.autoHits === false) return;         /* 수동(홈 꾸미기) 순서를 존중 */
    if (now() - (lastHitAt || 0) < 1400) return;     /* 방금 누른 카드가 손가락 밑에서 튀지 않게 */
    var kids = Array.prototype.filter.call(home.children, function (el) {
      if (!el || el.nodeType !== 1 || !el.id) return false;
      if (el.id === 'v10Hero') return false;
      if (el.classList && el.classList.contains('v9-editbar')) return false;
      return true;
    });
    if (kids.length < 2) return;
    var t = hitTotals(v);
    var desired = kids.slice().sort(function (a, b) {
      var ha = Number(t[a.id]) || 0, hb = Number(t[b.id]) || 0;
      if (ha !== hb) return hb - ha;
      var ia = DEFAULT_HOME.indexOf(a.id), ib = DEFAULT_HOME.indexOf(b.id);
      if (ia < 0) ia = 900; if (ib < 0) ib = 900;
      return ia - ib;
    });
    var same = desired.every(function (el, i) { return el === kids[i]; });
    if (same) return;
    var frag = document.createDocumentFragment();
    desired.forEach(function (el) { frag.appendChild(el); });
    home.appendChild(frag);
  }
  /* 홈 꾸미기 시트 맨 위에 '인기순 자동정렬' 스위치를 넣는다.
     (헤더의 🪄 버튼은 숨은 #v9Decorate 를 대신 눌러 주므로, 시트가 열린 뒤에 끼워 넣는다) */
  function patchDecoSheet() {
    var inner = $('sheetInner');
    if (!inner) return;
    var v = V9();
    if (!v) return;
    var on = v.layout.autoHits !== false;
    var row = inner.querySelector('#v17SortRow');
    if (!row) {
      row = document.createElement('div');
      row.id = 'v17SortRow';
      row.className = 'v17-sortrow';
      inner.insertBefore(row, inner.firstChild);
    }
    row.innerHTML = '<div class="v17-sr-tx"><b>🔥 인기순 자동정렬 ' + (on ? '켜짐' : '꺼짐') + '</b>' +
      '<small>' + (on ? '가족이 많이 쓰는 칸이 홈 맨 위로 자동으로 올라와요' : '아래에서 정한 순서 그대로 보여 줘요') + '</small></div>' +
      '<button type="button" class="v17-sw' + (on ? ' on' : '') + '" id="v17SortSw" aria-pressed="' + (on ? 'true' : 'false') + '" aria-label="인기순 자동정렬"><i></i></button>';
    var sw = row.querySelector('#v17SortSw');
    if (sw) sw.onclick = function () {
      var vv = V9();
      if (!vv) return;
      setAutoHits(vv.layout.autoHits === false, function () { patchDecoSheet(); paintSortBtn(); });
    };
  }
  /* 지금 홈에 보이는 카드 순서 — 자동정렬을 끌 때 '이 순서로 고정'의 기준이 된다 */
  function currentOrder() {
    var home = $('view-home');
    if (!home) return [];
    return Array.prototype.filter.call(home.children, function (el) {
      if (!el || el.nodeType !== 1 || !el.id) return false;
      if (el.id === 'v10Hero') return false;
      if (el.classList && el.classList.contains('v9-editbar')) return false;
      return true;
    }).map(function (el) { return el.id; });
  }
  function setAutoHits(on, after) {
    var v = V9();
    if (!v) return;
    v.layout.autoHits = !!on;
    if (!on && !(v.layout.order && v.layout.order.length)) v.layout.order = currentOrder();
    save();
    if (after) after();
    orderHome();
    toast(on ? '🔥 인기순 자동정렬을 켰어요 · 많이 쓰는 칸이 위로 와요'
             : '🪄 지금 순서로 고정했어요 · 홈 꾸미기에서 바꿀 수 있어요');
  }
  function paintSortBtn() {
    var bar = document.querySelector('#view-home .v9-editbar');
    if (!bar) return;
    var v = V9(); if (!v) return;
    var on = v.layout.autoHits !== false;
    var b = bar.querySelector('#v17Sort');
    if (!b) {
      b = document.createElement('button');
      b.type = 'button';
      b.id = 'v17Sort';
      b.className = 'btn ghost';
      b.addEventListener('click', function () {
        var vv = V9(); if (!vv) return;
        setAutoHits(vv.layout.autoHits === false, paintSortBtn);
      });
      bar.appendChild(b);
    }
    b.textContent = on ? '🔥 인기순 자동정렬 켜짐' : '🪄 홈 꾸미기 순서';
    b.title = on ? '누르면 홈 꾸미기에서 정한 순서로 고정합니다' : '누르면 많이 쓰는 칸이 위로 오도록 자동 정렬합니다';
  }

  /* ---------------------------------------------------------------- 화면 붙이기 */
  function ensureHomeCards() {
    var home = $('view-home');
    if (!home) return;
    if (!$('v17PraiseCard')) {
      var a = document.createElement('div');
      a.innerHTML = secPraiseHome();
      var el = a.firstChild;
      var ref = $('v9DdayCard') || $('briefCard');
      if (ref && ref.parentNode === home) home.insertBefore(el, ref.nextSibling);
      else home.appendChild(el);
    }
    if (!$('v17MoneyCard')) {
      var b = document.createElement('div');
      b.innerHTML = secMoneyHome();
      var el2 = b.firstChild;
      var ref2 = $('v9MoodCard') || $('v9DdayCard');
      if (ref2 && ref2.parentNode === home) home.insertBefore(el2, ref2.nextSibling);
      else home.appendChild(el2);
    }
  }
  function ensureMoneyCards() {
    var host = $('life-money');
    if (!host) return;
    if (!$('v17Daily')) { var a = document.createElement('div'); a.innerHTML = secDaily(); host.appendChild(a.firstChild); }
    if (!$('v17Ask')) { var b = document.createElement('div'); b.innerHTML = secAsk(); host.appendChild(b.firstChild); }
    if (!$('v17Keep')) { var c = document.createElement('div'); c.innerHTML = secKeep(); host.appendChild(c.firstChild); }
    /* V17 날짜별 기록이 생겼으니 옛 '오늘 한 줄 기록' 카드는 접어 둔다(기록은 그대로 합쳐 보여 줌) */
    var old = $('v9Money');
    if (old) {
      old.classList.add('v17-legacy-hide');
      if (!$('v17LegacyNote')) {
        var n = document.createElement('div');
        n.id = 'v17LegacyNote';
        n.className = 'hint v17-legacy-note';
        n.innerHTML = '💡 예전 “오늘 한 줄 용돈 기록”은 위 <b>날짜별 용돈기록</b>으로 합쳤어요. 지난 기록도 그대로 보여요.' +
          ' <button type="button" class="v17-mini" data-v17="legacy">예전 카드 보기</button>';
        if (old.parentNode) old.parentNode.insertBefore(n, old);
      }
    }
  }
  function ensurePraisePanel() {
    var host = $('view-life');
    if (!host) return;
    if (!$('life-praise')) {
      var w = document.createElement('div');
      w.id = 'life-praise';
      w.className = 'hidden';
      w.innerHTML = secPraisePanel();
      host.appendChild(w);
    }
  }
  function render() {
    if (!ON || !F || !F.doc() || !F.me()) return;
    ensureHomeCards();
    ensureMoneyCards();
    ensurePraisePanel();
    initMonth();
    var dt = $('v17Date');
    if (dt && !dt.value) dt.value = todayYmd();
    renderDaily();
    renderAsk();
    renderKeep();
    renderPraise();
    renderMoneyHome();
    paintSortBtn();
  }

  /* ---------------------------------------------------------------- 이벤트 */
  function wire() {
    document.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t || !t.closest) return;

      /* 홈 카드 사용 횟수 */
      recordHit(ev);
      if (t.closest('#v10Deco, #v9Decorate')) setTimeout(patchDecoSheet, 40);

      var act = t.closest('[data-v17]');
      if (act) {
        var a = act.getAttribute('data-v17');
        if (a === 'askNew') { askSheet(); return; }
        if (a === 'keepNew') { keepSheet(); return; }
        if (a === 'setDay') { daySheet(); return; }
        if (a === 'prNew') { praiseSheet(); return; }
        if (a === 'prAll') { openPraise(); return; }
        if (a === 'prCam') { var c1 = $('v17PrFileCam'); if (c1) c1.click(); return; }
        if (a === 'prGal') { var c2 = $('v17PrFileGal'); if (c2) c2.click(); return; }
        if (a === 'prClear') { prFiles = []; var pv = $('v17PrPrev'); if (pv) pv.innerHTML = ''; return; }
        if (a === 'legacy') { var lg = $('v9Money'); if (lg) lg.classList.toggle('v17-legacy-hide'); return; }
        if (a === 'goMoney') {
          if (global.FAMNAV && global.FAMNAV.go) global.FAMNAV.go('record', 'money');
          return;
        }
      }
      /* 날짜별 기록 입력 */
      var k = t.closest('[data-v17k]');
      if (k) {
        dKind = k.getAttribute('data-v17k') === 'out' ? 'out' : 'in';
        var seg = $('v17Kind');
        if (seg) Array.prototype.forEach.call(seg.querySelectorAll('button'), function (b) { b.classList.toggle('on', b.getAttribute('data-v17k') === dKind); });
        var cat = $('v17Cat'); if (cat) cat.innerHTML = catOptions(dKind);
        return;
      }
      if (t.closest('#v17Save')) { addMoney(); return; }
      var del = t.closest('[data-v17del]');
      if (del) { delMoney(del.getAttribute('data-v17del')); return; }
      var mo = t.closest('[data-v17m]');
      if (mo) {
        initMonth();
        var p = dMonth.split('-');
        var dt2 = new Date(Number(p[0]), Number(p[1]) - 1 + Number(mo.getAttribute('data-v17m')), 1);
        dMonth = dt2.getFullYear() + '-' + pad(dt2.getMonth() + 1);
        try { localStorage.setItem(LS_DAY, dMonth); } catch (e) {}
        var bx = $('v17Days'); if (bx) bx.__sig = '';
        renderDaily();
        return;
      }
      var wh = t.closest('[data-v17who]');
      if (wh) { dWho = wh.getAttribute('data-v17who'); var b2 = $('v17Days'); if (b2) b2.__sig = ''; renderDaily(); return; }
      var pay = t.closest('[data-v17pay]');
      if (pay) { payReq(pay.getAttribute('data-v17pay')); return; }
      var cn = t.closest('[data-v17cancel]');
      if (cn) { cancelReq(cn.getAttribute('data-v17cancel')); return; }
      var bk = t.closest('[data-v17back]');
      if (bk) { backKeep(bk.getAttribute('data-v17back')); return; }
      var rc = t.closest('[data-v17react]');
      if (rc) {
        var kk = String(rc.getAttribute('data-v17react')).split(':');
        toggleReact(kk[0], kk[1] || 'cheer');
        return;
      }
      var cm = t.closest('[data-v17cm]');
      if (cm) { addComment(cm.getAttribute('data-v17cm')); return; }
      var cd = t.closest('[data-v17cmdel]');
      if (cd) { delComment(cd.getAttribute('data-v17cmdel')); return; }
      var pd = t.closest('[data-v17pdel]');
      if (pd) { delPraise(pd.getAttribute('data-v17pdel')); return; }
      var po = t.closest('[data-v17open]');
      if (po) { openPraise(); return; }
      var ph = t.closest('[data-v17photo]');
      if (ph) { viewPhoto(ph.getAttribute('data-v17photo')); return; }
    });

    /* 축하 한마디 — Enter 로 등록 */
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter') return;
      var el = ev.target;
      if (!el || !el.id || String(el.id).indexOf('v17cm') !== 0) return;
      ev.preventDefault();
      addComment(String(el.id).slice(5));
    });

    /* 저장 못 한 사용 횟수는 화면을 떠날 때 한 번 더 흘려보낸다 */
    global.addEventListener('pagehide', function () { if (hitDirty) flushHits(); });
    document.addEventListener('visibilitychange', function () { if (document.hidden && hitDirty) flushHits(); });
  }

  function mount(FAM) {
    if (ON) return;
    F = FAM; ON = true;
    wire();
    render();
  }
  setInterval(function () {
    if (!ON && global.FAM && global.FAM.doc && global.FAM.doc() && global.FAM.me && global.FAM.me()) {
      try { mount(global.FAM); } catch (e) { console.warn('V17 mount', e); }
    }
  }, 1500);

  var prevRender = global.__FAM_RENDER;
  global.__FAM_RENDER = function () {
    if (prevRender) { try { prevRender(); } catch (e) {} }
    try { render(); } catch (e) { console.warn('V17 render', e); }
  };
  var prevView = global.__FAM_VIEW;
  global.__FAM_VIEW = function (v) {
    if (prevView) { try { prevView(v); } catch (e) {} }
    if (v === 'life') { try { ensurePraisePanel(); renderPraise(); } catch (e) {} }
    if (v === 'record') { try { ensureMoneyCards(); renderDaily(); renderAsk(); renderKeep(); } catch (e) {} }
    if (v === 'home') { try { ensureHomeCards(); renderPraise(); renderMoneyHome(); } catch (e) {} }
  };

  global.FAM12 = {
    orderHome: orderHome,
    render: render,
    openPraise: openPraise,
    askSheet: askSheet,
    keepSheet: keepSheet,
    praiseSheet: praiseSheet,
    moneyEntries: moneyEntries,
    hitTotals: function () { var v = V9(); return v ? hitTotals(v) : {}; }
  };
})(window);
