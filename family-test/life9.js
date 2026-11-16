/* ============================================================
   우리가족포털 V9 · 생활 업그레이드 (life9.js)
   ① 위시리스트 V9 — 작성 버그 수정(시트 저장 경로 재구성) + 개인 5개 제한
      + 사진 첨부 + 네이버·다나와·쿠팡·구글쇼핑 최저가 검색 + Gemini AI 최저가
   ② 용돈기입장 V9 — 매일 간단 입력(받은/쓴 돈·목적) + 잔액 자동 계산
      + 일자별 내역 영구 저장(23:59 구글드라이브 백업에 그대로 포함)
   ③ 과거 데이터 날짜별 조회(아카이브) + 수동 JSON 백업 다운로드
   ④ FAM9AI — 가족포털 공용 Gemini 엔진(모델 폴백, 키는 이 기기에만 저장)
   ============================================================ */
(function (global) {
  'use strict';

  var F = null, ON = false;
  var LS_AI = 'sgf9_gemini_v1';
  var MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.1-pro-preview'];

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
  function listOf(node) {
    var out = [];
    Object.keys(node || {}).forEach(function (k) {
      var it = node[k];
      if (it && typeof it === 'object' && !it.del) { it._id = k; out.push(it); }
    });
    return out;
  }
  function drop(node, id) { var it = node && node[id]; if (!it) return; it.del = 1; it.at = now(); }
  function memName(id) { var m = F && F.memOf(id); return m && m.name ? m.name : '가족'; }
  function memEmoji(id) { var m = F && F.memOf(id); return (m && m.emoji) || '🧑'; }

  function V9() {
    var D = d();
    if (!D) return null;
    if (!D.v9 || typeof D.v9 !== 'object') D.v9 = {};
    var v = D.v9;
    ['tama', 'room', 'minicar', 'moneyD', 'ddays', 'school', 'goals', 'sleep', 'layout', 'editLog', 'pod', 'archive', 'wish', 'commute', 'schoolMode', 'sb', 'mood', 'moodHist'].forEach(function (k) {
      if (!v[k] || typeof v[k] !== 'object') v[k] = {};
    });
    return v;
  }

  /* ============================================================
     ④ FAM9AI · 공용 Gemini 엔진
     ============================================================ */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function callModel(model, body) {
    var key = lsGet(LS_AI) || '';
    if (!key) return Promise.reject(new Error('no-key'));
    return fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) {
        var err = new Error('HTTP ' + r.status + ' ' + t.slice(0, 140));
        err.status = r.status;
        throw err;
      });
      return r.json();
    }).then(function (j) {
      var parts = (j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
      var text = parts.map(function (p) { return p.text || ''; }).join('').trim();
      if (!text) throw new Error('empty');
      return text;
    });
  }
  function ask(prompt, opts) {
    opts = opts || {};
    var parts = [{ text: prompt }];
    var imgs = (opts.images && opts.images.length) ? opts.images : (opts.imageDataUrl ? [opts.imageDataUrl] : []);
    imgs.forEach(function (du) {
      var m = String(du).match(/^data:([^;]+);base64,(.*)$/);
      if (m) parts.push({ inline_data: { mime_type: m[1], data: m[2] } });
    });
    var body = {
      contents: [{ role: 'user', parts: parts }],
      generationConfig: { temperature: opts.temperature != null ? opts.temperature : 0.4 }
    };
    var i = 0;
    function tryNext() {
      if (i >= MODELS.length) return Promise.reject(new Error('all-models-failed'));
      var model = MODELS[i++];
      return callModel(model, body).catch(function (e) {
        if (e.status === 404 || e.status === 400 || e.status === 429) return tryNext();
        throw e;
      });
    }
    return tryNext();
  }
  global.FAM9AI = {
    ask: ask,
    key: function () { return lsGet(LS_AI) || ''; },
    setKey: function (k) { lsSet(LS_AI, String(k || '').trim()); },
    clearKey: function () { lsSet(LS_AI, ''); },
    keySheet: function (title, intro, cb) {
      F.openSheet('<h3>🤖 ' + esc(title || 'Gemini API 키 등록') + '</h3>' +
        '<div class="sdesc">' + esc(intro || '키는 이 기기에만 저장되고 가족에게 공유되지 않아요.') + '</div>' +
        '<div class="form-row"><label>Gemini API 키</label><input class="field" id="f9aiKey" placeholder="AIza… 또는 AQ…" autocapitalize="none"></div>' +
        '<div style="display:flex;gap:8px;margin-top:6px"><button type="button" class="btn ghost" data-sheet-close>취소</button><button type="button" class="btn" id="f9aiSave">저장</button></div>' +
        '<a class="hint" style="display:block;margin-top:8px" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">🔑 무료 키 발급받기 (Google AI Studio)</a>');
      $('f9aiSave').onclick = function () {
        var k = ($('f9aiKey').value || '').trim();
        if (!k) { toast('키를 넣어 주세요'); return; }
        global.FAM9AI.setKey(k);
        F.closeSheet();
        toast('Gemini 키를 저장했어요');
        if (cb) cb();
      };
    }
  };

  /* ============================================================
     ① 위시리스트 V9
     ============================================================ */
  function shopLinks(name) {
    var q = encodeURIComponent(name || '');
    return {
      danawa: 'https://search.danawa.com/dsearch.php?query=' + q,
      naver: 'https://search.shopping.naver.com/search/all?query=' + q,
      coupang: 'https://www.coupang.com/np/search?q=' + q,
      google: 'https://www.google.com/search?tbm=shop&q=' + q
    };
  }
  function wishMineN(v) {
    return listOf(v.wish).filter(function (e) { return e.by === mid(); }).length;
  }
  function migrateWish(v) {
    var D = d();
    var old = D && D.v4 && D.v4.wish;
    if (!old) return;
    var moved = false;
    Object.keys(old).forEach(function (k) {
      var it = old[k];
      if (!it || it.del || !it.name || it.__m9) return;
      var exists = Object.keys(v.wish).some(function (x) { return v.wish[x] && v.wish[x].name === it.name && v.wish[x].by === it.by; });
      if (!exists) {
        v.wish['m9' + k] = { name: it.name, price: it.price || '', memo: it.memo || '', photo: it.photo || null, by: it.by, at: it.at || now(), got: it.got || 0, dibs: it.dibs || {} };
      }
      it.__m9 = 1;
      moved = true;
    });
    if (moved) save();
  }
  function secWish() {
    return '<div class="card" id="v9Wish" style="border:1.5px solid #DCEFE5;background:linear-gradient(180deg,#F6FCF9,#FFFFFF)">' +
      '<div class="card-head"><h2>🎁 갖고 싶은 물건 목록</h2><span class="sub" id="v9WishN">0개</span></div>' +
      '<div class="fb-desc">한 사람당 <b>최대 5개</b>까지 올릴 수 있어요. 사진을 붙이고, 최저가를 바로 검색하거나 <b>AI 최저가 조회</b>(Gemini 키 등록 시)도 돼요.</div>' +
      '<div id="v9WishList" style="margin-top:9px"></div>' +
      '<button type="button" class="btn soft" id="v9WishAdd" style="margin-top:4px">＋ 위시리스트에 올리기</button></div>';
  }
  function renderWish() {
    var v = V9();
    if (!v) return;
    migrateWish(v);
    /* 옛날 카드는 숨기고 V9 카드로 대체 */
    var oldCard = $('v4Wish');
    if (oldCard && !oldCard.classList.contains('hidden')) oldCard.classList.add('hidden');
    var box = $('v9WishList'), nEl = $('v9WishN');
    if (!box) return;
    var es = listOf(v.wish).sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    if (nEl) nEl.textContent = es.length + '개 · 내 것 ' + wishMineN(v) + '/5';
    var sig = JSON.stringify(es.map(function (e) { return [e._id, e.name, e.price, e.got, count(e.dibs), e.ai && e.ai.price, e.photo && e.photo.thumb ? 1 : 0]; }));
    if (box.__sig === sig) return;
    if (box.contains(document.activeElement)) return;
    box.__sig = sig;
    if (!es.length) { box.innerHTML = '<div class="v4-empty">아직 위시리스트가 비어 있어요 — 첫 물건을 올려 보세요!</div>'; return; }
    box.innerHTML = es.map(function (e) {
      var l = shopLinks(e.name);
      var dibs = e.dibs || {}, mineDib = !!dibs[mid()], dibsN = count(dibs);
      return '<div class="v4-wish">' +
        '<div class="v4-row" style="border-bottom:none;padding:0"><span class="e">' +
        (e.photo && e.photo.thumb ? '<img src="' + e.photo.thumb + '" alt="" style="width:44px;height:44px;border-radius:11px;object-fit:cover">' : '🎁') + '</span>' +
        '<span class="tx"><b>' + esc(e.name) + '</b>' +
        '<small>' + (e.price ? esc(e.price) + ' · ' : '') + (e.ai && e.ai.price ? '<span style="color:#0A7D56;font-weight:800">🤖 ' + esc(e.ai.price) + '</span>' + (e.ai.shop ? ' (' + esc(e.ai.shop) + ')' : '') + ' · ' : '') +
        memEmoji(e.by) + ' ' + esc(memName(e.by)) + (e.memo ? ' · ' + esc(e.memo) : '') + '</small></span>' +
        (e.got ? '<span class="v4-tag">선물 완료 🎉</span>' : '') + '</div>' +
        '<div class="v4-links">' +
        '<a class="dn" href="' + l.danawa + '" target="_blank" rel="noopener">다나와</a>' +
        '<a class="nv" href="' + l.naver + '" target="_blank" rel="noopener">네이버쇼핑</a>' +
        '<a class="cp" href="' + l.coupang + '" target="_blank" rel="noopener">쿠팡</a>' +
        '<a class="v4-tag gray" style="text-decoration:none" href="' + l.google + '" target="_blank" rel="noopener">구글쇼핑</a>' +
        '<button type="button" class="v4-tag" data-v9ai="' + e._id + '" style="border:none">🤖 AI 최저가</button>' +
        '<button type="button" class="v4-tag ' + (mineDib ? '' : 'gray') + '" data-v9dib="' + e._id + '" style="border:none">' + (mineDib ? '❤️ 찜함' : '🤍 찜하기') + (dibsN ? ' ' + dibsN : '') + '</button>' +
        '<button type="button" class="v4-tag ' + (e.got ? '' : 'gray') + '" data-v9got="' + e._id + '" style="border:none">사주기</button>' +
        (e.by === mid() ? '<button type="button" class="v4-tag gray" data-v9del="' + e._id + '" style="border:none">삭제</button>' : '') +
        '</div></div>';
    }).join('');
  }
  function wishSheet() {
    var v = V9();
    if (wishMineN(v) >= 5) { toast('위시리스트는 한 사람당 최대 5개까지예요 — 먼저 하나를 지워 보세요'); return; }
    F.openSheet('<h3>🎁 위시리스트에 올리기</h3><div class="sdesc">갖고 싶은 것을 올리면 가족이 보고 쿠팡·선물을 고를 수 있어요.</div>' +
      '<div class="form-row"><label>갖고 싶은 것</label><input class="field" id="v9WsName" maxlength="40" placeholder="예: 무선 이어폰"></div>' +
      '<div class="form-row"><label>가격대 (선택)</label><input class="field" id="v9WsPrice" maxlength="20" placeholder="예: 5~7만원"></div>' +
      '<div class="form-row"><label>메모 (선택)</label><input class="field" id="v9WsMemo" maxlength="50" placeholder="예: 흰색이면 좋아요"></div>' +
      '<div class="form-row"><label>사진 (선택)</label><button type="button" class="btn ghost" id="v9WsPhoto">📷 사진 고르기</button><div id="v9WsPrev" style="margin-top:7px"></div></div>' +
      '<div style="display:flex;gap:8px;margin-top:6px"><button type="button" class="btn ghost" data-sheet-close>취소</button><button type="button" class="btn" id="v9WsSave">올리기</button></div>');
    var photo = null;
    $('v9WsPhoto').onclick = function () {
      F.pickImages(function (files) {
        F.saveMedia(files[0]).then(function (m) {
          photo = m;
          $('v9WsPrev').innerHTML = '<img src="' + m.thumb + '" style="width:100%;border-radius:12px">';
        }).catch(function () { toast('사진을 올리지 못했어요'); });
      }, true);
    };
    /* 시트 안에서 Enter로 저장되도록 + 저장 버튼 한 번만 연결(이중 바인딩 방지) */
    $('v9WsSave').onclick = function () {
      var name = ($('v9WsName').value || '').trim();
      if (!name) { toast('무엇을 갖고 싶은지 적어 주세요'); return; }
      var v2 = V9();
      var id = 'w' + now().toString(36) + Math.random().toString(36).slice(2, 4);
      v2.wish[id] = { name: name, price: ($('v9WsPrice').value || '').trim(), memo: ($('v9WsMemo').value || '').trim(), photo: photo, by: mid(), at: now(), got: 0, dibs: {} };
      save();
      box_sig_reset();
      renderWish();
      F.closeSheet();
      toast('위시리스트에 올렸어요 🎁');
    };
  }
  function box_sig_reset() { var b = $('v9WishList'); if (b) b.__sig = null; }
  function aiPrice(id) {
    var v = V9(), e = v.wish[id];
    if (!e) return;
    if (!global.FAM9AI.key()) { global.FAM9AI.keySheet('AI 최저가 조회', 'AI가 물건 이름을 보고 최저가를 추정해 알려 줘요.', function () { aiPrice(id); }); return; }
    toast('🤖 AI가 최저가를 찾아 보는 중…');
    global.FAM9AI.ask(
      '아래는 가족 위시리스트에 올라온 물건이야. 한국 온라인 시장(네이버쇼핑·다나와·쿠팡 기준)에서의 대략적인 최저가를 추정해서 "숫자원(예: 89,000원)" 형식과 어느 쇼핑몰이 가장 싼지 한 줄로만 알려줘.\n물건: ' + e.name + (e.price ? '\n원하는 가격대: ' + e.price : '')
    ).then(function (txt) {
      var m = String(txt).replace(/\n/g, ' ').match(/[\d,\s]+원/);
      var v2 = V9();
      var e2 = v2 && v2.wish[id];
      if (!e2) return;
      e2.ai = { price: m ? m[0].replace(/\s/g, '') : txt.slice(0, 40), shop: (String(txt).match(/(쿠팡|네이버|다나와|구글|Coupang)/i) || [''])[0], at: now() };
      save(); box_sig_reset(); renderWish();
    }).catch(function (err) {
      toast('AI 조회 실패: ' + (err && err.message === 'no-key' ? '키 먼저 등록' : '잠시 후 다시'));
    });
  }
  function wireWish() {
    document.addEventListener('click', function (e) {
      var v = V9();
      if (!v) return;
      var add = e.target.closest('#v9WishAdd');
      if (add) { wishSheet(); return; }
      var d1 = e.target.closest('[data-v9dib]');
      if (d1) {
        var r1 = v.wish[d1.getAttribute('data-v9dib')];
        if (!r1) return;
        if (!r1.dibs) r1.dibs = {};
        if (r1.dibs[mid()]) delete r1.dibs[mid()]; else r1.dibs[mid()] = now();
        r1.at = now(); save(); box_sig_reset(); renderWish(); return;
      }
      var d2 = e.target.closest('[data-v9got]');
      if (d2) {
        var r2 = v.wish[d2.getAttribute('data-v9got')];
        if (!r2) return;
        r2.got = r2.got ? 0 : 1; r2.at = now();
        save(); box_sig_reset(); renderWish();
        toast(r2.got ? '선물 완료로 표시했어요 🎉' : '다시 위시로 돌렸어요');
        return;
      }
      var d3 = e.target.closest('[data-v9del]');
      if (d3) { drop(v.wish, d3.getAttribute('data-v9del')); save(); box_sig_reset(); renderWish(); return; }
      var d4 = e.target.closest('[data-v9ai]');
      if (d4) { aiPrice(d4.getAttribute('data-v9ai')); return; }
    });
  }

  /* ============================================================
     ② 용돈기입장 V9 (매일 간단 입력)
     DOC.v9.moneyD[memberId][ymd] = { items:[{k, amt, t, at}] }
     ============================================================ */
  function myMoney(v) { var m = v.moneyD[mid()] || (v.moneyD[mid()] = {}); return m; }
  function daySum(day) {
    var got = 0, spent = 0;
    (day.items || []).forEach(function (it) {
      if (it.k === 'got') got += it.amt; else spent += it.amt;
    });
    return { got: got, spent: spent };
  }
  function totalBalance(v) {
    var days = myMoney(v), bal = 0;
    Object.keys(days).forEach(function (ds) {
      var s = daySum(days[ds]);
      bal += s.got - s.spent;
    });
    return bal;
  }
  function secMoney() {
    return '<div class="card" id="v9Money" style="border:1.5px solid #FFE3C2;background:linear-gradient(180deg,#FFF9F2,#FFFFFF)">' +
      '<div class="card-head"><h2>💰 오늘의 용돈기입장</h2><span class="sub" id="v9MnBal">–</span></div>' +
      '<div class="fb-desc">매일 받은 용돈·쓴 용돈과 목적을 한 줄로 남기면 <b>남은 잔액이 자동 계산</b>되고, 날짜별로 영구 저장돼요(구글드라이브 백업 포함).</div>' +
      '<div style="display:flex;gap:6px;margin-top:8px">' +
      '<select class="field" id="v9MnK" style="flex:0 0 96px;margin-bottom:0"><option value="got">💵 받음</option><option value="spent">🛍️ 사용</option></select>' +
      '<input class="field" id="v9MnAmt" type="number" inputmode="numeric" placeholder="금액" style="flex:0 0 92px;margin-bottom:0">' +
      '<input class="field" id="v9MnT" maxlength="24" placeholder="목적 (예: 간식, 저금)" style="margin-bottom:0;flex:1">' +
      '</div>' +
      '<button type="button" class="btn" id="v9MnAdd" style="margin-top:8px">＋ 오늘 기록 남기기</button>' +
      '<div id="v9MnList" style="margin-top:9px"></div></div>';
  }
  function renderMoney() {
    var v = V9();
    if (!v) return;
    var balEl = $('v9MnBal'), list = $('v9MnList');
    if (!list) return;
    var bal = totalBalance(v);
    if (balEl) balEl.textContent = '남은 잔액 ' + won(bal);
    var days = myMoney(v);
    var ds = Object.keys(days).sort().reverse().slice(0, 14);
    var sig = JSON.stringify([bal, ds.map(function (k) { return [k, days[k].items && days[k].items.length]; })]);
    if (list.__sig === sig) return;
    if (list.contains(document.activeElement)) return;
    list.__sig = sig;
    if (!ds.length) { list.innerHTML = '<div class="v4-empty">오늘 받은/쓴 용돈을 한 줄로 남겨 보세요!</div>'; return; }
    var run2 = bal;
    /* 잔액은 과거→현재 누적이라 역순 표시하며 흐름을 함께 보여준다 */
    list.innerHTML = ds.map(function (k) {
      var day = days[k], s = daySum(day);
      return '<div class="v4-wish"><div class="v4-row" style="border-bottom:1px dashed #EDF1F4;padding-bottom:5px"><span class="e">📅</span>' +
        '<span class="tx"><b>' + k.slice(5).replace('-', '/') + '</b><small>받음 ' + won(s.got) + ' · 사용 ' + won(s.spent) + '</small></span>' +
        '<span class="rt" style="font-weight:800;color:#0A7D56">' + won(s.got - s.spent) + '</span></div>' +
        (day.items || []).map(function (it, i) {
          return '<div class="v4-row" style="padding:3px 2px"><span class="e">' + (it.k === 'got' ? '💵' : '🛍️') + '</span>' +
            '<span class="tx"><b>' + won(it.amt) + '</b><small>' + esc(it.t || (it.k === 'got' ? '용돈 받음' : '사용')) + ' · ' + F.hhmm(it.at || 0) + '</small></span>' +
            '<button type="button" class="v4-tag gray" data-v9mndel="' + esc(k) + ':' + i + '" style="border:none">✕</button></div>';
        }).join('') + '</div>';
    }).join('');
  }
  function wireMoney() {
    document.addEventListener('click', function (e) {
      var add = e.target.closest('#v9MnAdd');
      if (add) {
        var v = V9();
        var k = $('v9MnK').value, amt = Math.round(Number($('v9MnAmt').value || 0)), t = ($('v9MnT').value || '').trim();
        if (!amt) { toast('금액을 적어 주세요'); return; }
        var days = myMoney(v), yk = todayYmd();
        if (!days[yk]) days[yk] = { items: [] };
        if (!days[yk].items) days[yk].items = [];
        days[yk].items.push({ k: k, amt: amt, t: t, at: now() });
        days[yk].at = now();
        save();
        $('v9MnAmt').value = ''; $('v9MnT').value = '';
        list_sig_reset();
        renderMoney();
        toast(k === 'got' ? '💵 ' + won(amt) + ' 받았어요!' : '🛍️ ' + won(amt) + ' 기록했어요');
        return;
      }
      var del = e.target.closest('[data-v9mndel]');
      if (del) {
        var v2 = V9(), parts = del.getAttribute('data-v9mndel').split(':');
        var days2 = myMoney(v2), day = days2[parts[0]];
        if (day && day.items && day.items[Number(parts[1])]) {
          day.items.splice(Number(parts[1]), 1);
          save(); list_sig_reset(); renderMoney();
        }
      }
    });
  }
  function list_sig_reset() { var l = $('v9MnList'); if (l) l.__sig = null; }

  /* ============================================================
     ③ 과거 데이터 날짜별 조회(아카이브) + JSON 백업
     ============================================================ */
  function snapshotDay(v, yk) {
    var D = d();
    var prev = v.archive[yk] || {};
    var money = {}, tama = {}, mood = {};
    Object.keys(v.mood || {}).forEach(function (mk) {
      var r = v.mood[mk];
      if (r && r.e) mood[mk] = { e: r.e, note: r.note || '' };
    });
    Object.keys(v.moneyD || {}).forEach(function (mk) {
      var day = (v.moneyD[mk] || {})[yk];
      var got = 0, spent = 0;
      if (day) (day.items || []).forEach(function (it) { if (it.k === 'got') got += it.amt; else spent += it.amt; });
      money[mk] = { got: got, spent: spent };
    });
    Object.keys(v.tama || {}).forEach(function (tk) {
      var t = v.tama[tk];
      if (t) tama[tk] = { name: t.name, lv: t.lv, full: t.full, happy: t.happy, energy: t.energy };
    });
    var rec = {
      at: now(), by: mid() || 'system',
      status: JSON.parse(JSON.stringify(D.status || {})),
      money: money, tama: tama, mood: mood,
      counts: {
        photos: count(D.photos), letters: count(D.letters), diary: count(D.diary),
        wish: count(v.wish), minicar: count(v.minicar)
      }
    };
    /* 기록이 이미 있으면 status 등은 그대로 두고 시간만 갱신하지 않는다(첫 기록 우선) */
    if (prev.at) rec.status = prev.status || rec.status;
    v.archive[yk] = rec;
  }
  function secArchive() {
    return '<div class="card" id="v9Arch" style="border:1.5px solid #E2DFF5;background:linear-gradient(180deg,#F8F7FF,#FFFFFF)">' +
      '<div class="card-head"><h2>🗂️ 그날 그날 기록 보기</h2><span class="sub">날짜별 아카이브</span></div>' +
      '<div class="fb-desc">앱을 켤 때마다 그날의 상태(귀가 현황·용돈·다마고치·자료 수)가 자동 저장돼요. 날짜를 골라 그날의 기록을 꺼내 보고, 전체 데이터를 JSON으로 백업할 수도 있어요.</div>' +
      '<div style="display:flex;gap:7px;margin-top:8px">' +
      '<input class="field" id="v9ArchDate" type="date" style="margin-bottom:0;flex:1">' +
      '<button type="button" class="btn ghost" id="v9ArchGo" style="width:auto;padding:0 14px">조회</button></div>' +
      '<div id="v9ArchBody" style="margin-top:9px"></div>' +
      '<button type="button" class="btn soft" id="v9Backup" style="margin-top:9px">⬇️ 전체 데이터 JSON 백업 받기</button>' +
      '</div>';
  }
  function renderArchive() {
    var v = V9();
    if (!v) return;
    var inp = $('v9ArchDate');
    if (inp && !inp.value) inp.value = todayYmd();
  }
  function showArchive(yk) {
    var v = V9(), box = $('v9ArchBody');
    if (!box) return;
    var a = v.archive[yk];
    if (!a) {
      snapshotDay(v, yk);
      save();
      a = v.archive[yk];
    }
    var html = '<div class="v4-wish"><b>📅 ' + esc(yk) + ' 기록</b>';
    var ms = F.members();
    html += '<div class="v4-row" style="margin-top:6px"><span class="e">🚗</span><span class="tx"><b>귀가 현황</b><small>' + ms.map(function (m) {
      var s = (a.status || {})[m.id];
      return m.name + ' ' + (s ? (s.s === 'home' ? '🏠 도착' : (s.s === 'depart' ? '🚗 출발' : (s.eta ? '⏰ ' + s.eta : '📱 공유'))) : '–');
    }).join(' · ') + '</small></span></div>';
    html += '<div class="v4-row"><span class="e">💰</span><span class="tx"><b>용돈</b><small>' + ms.map(function (m) {
      var mo = (a.money || {})[m.id] || {};
      return m.name + ' +' + won(mo.got || 0) + '/-' + won(mo.spent || 0);
    }).join(' · ') + '</small></span></div>';
    html += '<div class="v4-row"><span class="e">🥚</span><span class="tx"><b>다마고치</b><small>' + Object.keys(a.tama || {}).map(function (tk) {
      var t = a.tama[tk];
      return esc(t.name) + ' Lv.' + t.lv + ' (행복 ' + t.happy + ')';
    }).join(' · ') + '</small></span></div>';
    var c = a.counts || {};
    html += '<div class="v4-row"><span class="e">📦</span><span class="tx"><b>자료 수</b><small>사진 ' + (c.photos || 0) + ' · 편지 ' + (c.letters || 0) + ' · 일기 ' + (c.diary || 0) + ' · 위시 ' + (c.wish || 0) + '</small></span></div>';
    html += '</div>';
    box.innerHTML = html;
  }
  function wireArchive() {
    document.addEventListener('click', function (e) {
      var go = e.target.closest('#v9ArchGo');
      if (go) {
        var yk = ($('v9ArchDate').value || todayYmd());
        showArchive(yk);
        return;
      }
      var bk = e.target.closest('#v9Backup');
      if (bk) {
        var D = d();
        if (!D) return;
        var body = JSON.stringify({ kind: 'family-portal-backup', exportedAt: new Date().toISOString(), doc: D }, null, 1);
        var blob = new Blob([body], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = '우리가족포털_백업_' + todayYmd().replace(/-/g, '') + '.json';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { try { URL.revokeObjectURL(a.href); a.remove(); } catch (err) {} }, 1200);
        toast('백업 파일을 내려받았어요');
      }
    });
  }

  /* ---------------- mount & render ---------------- */
  function ensureSections() {
    var all = $('view-all');
    if (all && !$('v9Wish')) {
      var div = document.createElement('div');
      div.innerHTML = secWish() + secArchive();
      all.insertBefore(div, all.querySelector('#v4Tube') || all.children[1] || null);
    }
    var lifeMoney = $('life-money');
    if (lifeMoney && !$('v9Money')) {
      var div2 = document.createElement('div');
      div2.innerHTML = secMoney();
      lifeMoney.appendChild(div2.firstChild);
    }
  }
  function render() {
    if (!ON || !F || !F.doc() || !F.me()) return;
    ensureSections();
    renderWish();
    renderMoney();
    renderArchive();
  }
  function mount(FAM) {
    if (ON) return;
    F = FAM; ON = true;
    wireWish(); wireMoney(); wireArchive();
    render();
  }
  setInterval(function () {
    if (!ON && global.FAM && global.FAM.doc && global.FAM.doc() && global.FAM.me && global.FAM.me()) mount(global.FAM);
  }, 1400);

  /* 렌더 체인 + 스냅샷 저장 */
  var prevRender = global.__FAM_RENDER;
  global.__FAM_RENDER = function () {
    if (prevRender) { try { prevRender(); } catch (e) {} }
    try { render(); } catch (e) { console.warn('LIFE9 render', e); }
    try {
      var v = V9();
      if (v) {
        var yk = todayYmd();
        if (!v.archive[yk]) { snapshotDay(v, yk); save(); }
      }
    } catch (e) {}
  };
  var prevView = global.__FAM_VIEW;
  global.__FAM_VIEW = function (v) {
    if (prevView) { try { prevView(v); } catch (e) {} }
    if (v === 'all' || v === 'life') { try { render(); } catch (e) {} }
  };
})(window);
