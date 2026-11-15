/* ============================================================
   상국수향지섭지율포털 V7 · 우리가족 대형 달력 + 가족 경험치 (cal7.js)
   ① 홈 상단 대형 달력 배너(월간 달력·날짜별 일정 점)
   ② 가족 누구나 작성·편집(제목·날짜·시간·메모·담당·상태)
   ③ 작성·수정 근거(누가·몇 시에 무엇을) 이력
   ④ 제목·메모를 보고 중요도 자동 판단(높음/보통/낮음)
   ⑤ 4가지 상태(예정·완료·연기·취소) + 완료 시 가족 전체 경험치
   ⑥ 경험치 단계별 보상·외식/여행 조언
   - 저장은 기존 가족 DB(DOC.v4.cal · DOC.v4.todos)에 그대로 얹는다.
     V4 시절 기록(done 0/1)도 새 화면에서 그대로 읽힌다.
   - 본체(index.html)의 window.FAM 다리만 쓴다.
   ============================================================ */
(function (global) {
  'use strict';

  var F = null, ON = false;
  var LS_MONTH = 'sgftest7_month_v9', LS_SEL = 'sgftest7_sel_v9', LS_MS = 'sgftest7_ms_v9';
  var viewMonth = '', selDay = '', celebrate = null, pendingDel = '';
  var histOpen = {}, formSeq = 0;

  /* ---------------- 중요도·상태 정의 ---------------- */
  var IMP = {
    high: { k: 'high', e: '🔴', n: '높음', xp: 30, c: '#E5484D', bg: '#FFECEC' },
    mid: { k: 'mid', e: '🟡', n: '보통', xp: 20, c: '#C98A00', bg: '#FFF6DC' },
    low: { k: 'low', e: '🟢', n: '낮음', xp: 10, c: '#0A7D56', bg: '#E7F8F1' }
  };
  var ST = {
    plan: { k: 'plan', e: '⏳', n: '예정' },
    done: { k: 'done', e: '✅', n: '완료' },
    post: { k: 'post', e: '⏭️', n: '연기' },
    cancel: { k: 'cancel', e: '❌', n: '취소' }
  };
  var ST_ORDER = ['plan', 'done', 'post', 'cancel'];
  var MS = [
    { xp: 50, e: '🍗', t: '치킨·디저트 한 판',
      m: '가족이 함께 작은 일들을 해낸 것만으로도 충분히 잘하고 있어요. 오늘 저녁은 치킨이나 아이들이 좋아하는 디저트로 작게 축하해 보세요.' },
    { xp: 100, e: '🍽️', t: '다 같이 외식',
      m: '이번 주 모두 고생 많으셨어요. 오늘은 다 같이 맛있는 외식 어떠세요? 메뉴는 지섭이·지율이가 한 명씩 골라도 좋아요.' },
    { xp: 200, e: '🚗', t: '근교 나들이·여행',
      m: '우리 가족 손발이 척척 맞아요. 이번 주말은 가까운 곳으로 나들이나 1박 여행을 떠나 보세요. 파주 근교라면 헤이리·프로방스·감악산 쪽도 좋아요.' },
    { xp: 300, e: '🎉', t: '특별한 가족 파티·여행',
      m: '정말 대단해요. 가족이 함께 해낸 일이 이만큼 쌓였어요. 꼭 가 보고 싶던 여행을 계획하거나, 집에서 특별한 가족 파티를 열어 보세요.' }
  ];

  /* ---------------- 작은 도구 ---------------- */
  function $(id) { return document.getElementById(id); }
  function d() { return F && F.doc(); }
  function me() { return F && F.me(); }
  function esc(s) { return F ? F.esc(s) : String(s == null ? '' : s); }
  function now() { return Date.now(); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function today() { return F ? F.todayYmd() : ''; }
  function mid() { return me() ? me().id : ''; }
  function meName() { return me() ? me().name : '가족'; }
  function save() { if (F) F.save(); }
  function toast(m) { if (F) F.toast(m); }
  function nameOf(id) { var m = id && F ? F.memOf(id) : null; return m && m.name ? m.name : ''; }
  function emojiOf(id) { var m = id && F ? F.memOf(id) : null; return (m && m.emoji) || '🧑'; }
  function who(id) { var n = nameOf(id); return n ? emojiOf(id) + ' ' + n : '가족'; }
  function stamp(ts) {
    if (!ts) return '';
    var x = new Date(ts);
    return (x.getMonth() + 1) + '/' + x.getDate() + ' ' + pad(x.getHours()) + ':' + pad(x.getMinutes());
  }
  function md(ds) { return ds ? Number(ds.slice(5, 7)) + '/' + Number(ds.slice(8, 10)) : ''; }
  function weekday(ds) { var x = new Date(Number(ds.slice(0, 4)), Number(ds.slice(5, 7)) - 1, Number(ds.slice(8, 10))); return '일월화수목금토'.charAt(x.getDay()); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  /* '1430' · '14:30' · '9:5' 같은 입력을 '14:30' 으로. 못 읽으면 '' */
  function normTime(v) {
    var s = String(v || '').trim().replace(/[^0-9:]/g, '');
    if (!s) return '';
    var m = s.match(/^(\d{1,2}):?(\d{2})$/);
    if (!m) return '';
    var h = Number(m[1]), mi = Number(m[2]);
    if (h > 23 || mi > 59) return '';
    return pad(h) + ':' + pad(mi);
  }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  /* ---------------- 중요도 자동 판단 ---------------- */
  var KW_HIGH = ['시험', '병원', '예약', '생일', '여행', '행사', '부대', '마감', '면접', '발표', '수술', '입원',
    '제출', '결혼', '장례', '제사', '이사', '계약', '검진', '접종', '훈련', '당직', '출장', '상담', '학부모',
    '오디션', '대회', '캠프', '졸업', '입학', '전입', '신청', '보고서', '근무', '파견', '교육', '발간', '수행',
    '퇴원', '응급', '약속장소', '기일', '추모', '성적', '선생님', '상장', '공연', '연주', '합격', '지원서'];
  var KW_MID = ['장보기', '장 보기', '마트', '청소', '운동', '숙제', '준비물', '빨래', '설거지', '분리수거',
    '요리', '반찬', '은행', '공과금', '납부', '학원', '미용실', '이발', '산책', '독서', '택배', '모임',
    '정리', '심부름', '세탁', '주유', '간식', '쇼핑', '전화', '연락', '예방', '약', '검사', '이불', '화분',
    '강아지', '산책', '식사', '점심', '저녁', '아침'];

  function findKw(text, list) {
    for (var i = 0; i < list.length; i++) {
      if (text.indexOf(list[i]) !== -1) return list[i];
    }
    return '';
  }
  /* 제목·메모·날짜를 보고 {level, why} 를 돌려준다 */
  function judge(title, memo, date) {
    var text = String(title || '') + ' ' + String(memo || '');
    var h = findKw(text, KW_HIGH);
    if (h) return { level: 'high', why: '‘' + h + '’ → 높음' };
    var m = findKw(text, KW_MID);
    if (m) return { level: 'mid', why: '‘' + m + '’ → 보통' };
    var t = today();
    if (date && (date === t || date === nextDay(t))) return { level: 'mid', why: '날짜 임박(오늘·내일) → 보통' };
    return { level: 'low', why: '급한 일 아님 → 낮음' };
  }
  function nextDay(ds) {
    if (!ds) return '';
    var x = new Date(Number(ds.slice(0, 4)), Number(ds.slice(5, 7)) - 1, Number(ds.slice(8, 10)));
    x.setDate(x.getDate() + 1);
    return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate());
  }

  /* ---------------- 데이터 읽기(기존 노드 그대로 사용) ---------------- */
  function store() {
    var D = d();
    if (!D) return null;
    if (!D.v4 || typeof D.v4 !== 'object') D.v4 = {};
    if (!D.v4.cal || typeof D.v4.cal !== 'object') D.v4.cal = {};
    if (!D.v4.todos || typeof D.v4.todos !== 'object') D.v4.todos = {};
    return D.v4;
  }
  function rawRec(kind, id) {
    var v = store();
    return v && v[kind] ? v[kind][id] : null;
  }
  /* 화면용 정규화 — DB는 건드리지 않는다(읽기만) */
  function prep(r, id, kind) {
    var st = r.st;
    if (!st) st = r.done ? 'done' : 'plan';
    else if ((r.at || 0) > (r.stAt || 0)) st = r.done ? 'done' : 'plan';  /* V4 화면에서 체크한 경우 */
    if (!ST[st]) st = 'plan';

    var imp = r.imp, auto = r.impAuto;
    var j = null;
    if (!IMP[imp]) { j = judge(r.t, r.memo, r.d || ''); imp = j.level; auto = 1; }
    if (auto === undefined) auto = 1;
    var why = r.impWhy || (j ? j.why : (auto ? '' : '직접 정함'));

    var hist = Array.isArray(r.history) ? r.history.slice() : [];
    if (!hist.length) {
      hist = [{ by: r.by || '', name: nameOf(r.by) || '가족', action: '작성', detail: '가족 달력에 처음 등록', at: r.createdAt || r.at || 0 }];
    }
    var createdAt = r.createdAt || r.at || 0;
    return {
      kind: kind, id: id, t: r.t || '', d: r.d || '', time: r.time || '', memo: r.memo || '',
      owner: r.owner || '', st: st, imp: imp, why: why, auto: auto ? 1 : 0,
      by: r.by || '', at: r.at || 0, createdBy: r.createdBy || r.by || '', createdAt: createdAt,
      doneBy: r.doneBy || '', doneAt: r.doneAt || 0, history: hist
    };
  }
  function allItems() {
    var v = store();
    if (!v) return [];
    var out = [];
    ['cal', 'todos'].forEach(function (kind) {
      var node = v[kind];
      Object.keys(node || {}).forEach(function (id) {
        var r = node[id];
        if (!r || typeof r !== 'object' || r.del) return;
        out.push(prep(r, id, kind));
      });
    });
    return out;
  }
  function rank(x) { return x.imp === 'high' ? 0 : (x.imp === 'mid' ? 1 : 2); }
  function sortItems(list) {
    return list.slice().sort(function (a, b) {
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      var da = a.st === 'done' ? 1 : 0, db = b.st === 'done' ? 1 : 0;
      if (da !== db) return da - db;
      var ta = a.time || '99:99', tb = b.time || '99:99';
      if (ta !== tb) return ta < tb ? -1 : 1;
      return (b.at || 0) - (a.at || 0);
    });
  }

  /* ---------------- 경험치 ---------------- */
  function xpInfo() {
    var items = allItems();
    var total = 0, doneN = 0, openN = 0;

    var by = {}, imps = { high: 0, mid: 0, low: 0 };
    items.forEach(function (x) {
      if (x.st === 'done') {
        var p = IMP[x.imp].xp;
        total += p; doneN++; imps[x.imp]++;
        var w = x.doneBy || x.owner || x.createdBy || x.by;
        if (w) by[w] = (by[w] || 0) + p;
      } else if (x.st === 'plan' || x.st === 'post') {
        openN++;
      }
    });
    var lv = 1 + Math.floor(total / 100);
    var base = lv * 100, prev = (lv - 1) * 100;
    var pct = Math.max(0, Math.min(100, Math.round((total - prev))));
    return { total: total, doneN: doneN, openN: openN, by: by, imps: imps,
      lv: lv, pct: pct, toNextLv: Math.max(0, base - total) };
  }
  function achievedMs(xp) {
    var out = [];
    MS.forEach(function (m) { if (m.xp <= xp) out.push(m); });
    return out;
  }
  function nextMs(xp) {
    for (var i = 0; i < MS.length; i++) { if (MS[i].xp > xp) return MS[i]; }
    return null;
  }
  /* 새로 넘은 단계가 있으면 축하 카드를 띄운다 */
  function syncMilestones(xp, notify) {
    var have = achievedMs(xp).map(function (m) { return m.xp; });
    var raw = lsGet(LS_MS), seen = null;
    try { seen = raw ? JSON.parse(raw) : null; } catch (e) { seen = null; }
    if (!Array.isArray(seen)) { lsSet(LS_MS, JSON.stringify(have)); return; }
    var fresh = have.filter(function (v) { return seen.indexOf(v) < 0; });
    if (!fresh.length) return;
    lsSet(LS_MS, JSON.stringify(seen.concat(fresh)));
    if (!notify) return;
    var top = Math.max.apply(null, fresh);
    MS.forEach(function (m) { if (m.xp === top) celebrate = m; });
  }

  /* ---------------- 스타일 ---------------- */
  function style() {
    if ($('c7style')) return;
    var s = document.createElement('style');
    s.id = 'c7style';
    s.textContent = [
      '.c7{background:linear-gradient(180deg,#F3FBF7 0%,#FFFFFF 46%);border:1.5px solid #CDEFE0;border-radius:20px;padding:13px 12px 14px;margin-bottom:12px;box-shadow:0 10px 26px rgba(14,159,110,.10)}',
      '.c7-hd{display:flex;align-items:center;gap:6px;margin:0 2px 10px}',
      '.c7-hd h2{font-size:15px;font-weight:900;letter-spacing:-.4px;margin:0;flex:1;color:#16342A}',
      '.c7-hd .lb{font-size:10px;font-weight:900;color:#0A7D56;background:#E7F8F1;padding:4px 8px;border-radius:20px;white-space:nowrap}',

      /* 경험치 */
      '.c7-xp{background:linear-gradient(135deg,#0E9F6E 0%,#12B886 55%,#3AC98F 100%);border-radius:16px;padding:12px 13px;color:#fff;box-shadow:0 7px 18px rgba(14,159,110,.22)}',
      '.c7-xp .cap{font-size:11px;font-weight:800;opacity:.95;display:flex;align-items:center;gap:5px}',
      '.c7-xp .cap .lv{margin-left:auto;background:rgba(255,255,255,.24);padding:3px 9px;border-radius:20px;font-size:10.5px;font-weight:900}',
      '.c7-xp .num{display:flex;align-items:flex-end;gap:5px;margin-top:4px}',
      '.c7-xp .num b{font-size:27px;font-weight:900;letter-spacing:-1.2px;line-height:1}',
      '.c7-xp .num span{font-size:11.5px;font-weight:800;opacity:.92;padding-bottom:3px}',
      '.c7-bar{height:10px;border-radius:20px;background:rgba(255,255,255,.28);overflow:hidden;margin-top:9px}',
      '.c7-bar i{display:block;height:100%;border-radius:20px;background:linear-gradient(90deg,#FFF3C4,#FFD166);transition:width .45s ease}',
      '.c7-goal{display:flex;gap:6px;justify-content:space-between;font-size:10.5px;font-weight:800;margin-top:6px;opacity:.96}',
      '.c7-ms{display:flex;gap:4px;margin-top:9px}',
      '.c7-ms .m{flex:1;background:rgba(255,255,255,.17);border-radius:10px;padding:5px 1px;text-align:center;font-size:9px;font-weight:800;line-height:1.3;opacity:.8}',
      '.c7-ms .m b{display:block;font-size:12px;line-height:1.2}',
      '.c7-ms .m.on{background:#FFF6D8;color:#8A6300;opacity:1}',
      '.c7-contrib{margin-top:9px;font-size:10.5px;font-weight:800;display:flex;flex-wrap:wrap;gap:4px 9px;opacity:.96}',
      '.c7-contrib .x{background:rgba(255,255,255,.16);padding:2px 7px;border-radius:20px}',

      /* 조언 카드 */
      '.c7-adv{margin-top:10px;border:1.5px solid #FFE3AE;background:linear-gradient(180deg,#FFFCF1,#FFF8E4);border-radius:14px;padding:11px 12px}',
      '.c7-adv .h{font-size:12.5px;font-weight:900;color:#8A5A00;letter-spacing:-.3px;line-height:1.35}',
      '.c7-adv .m{font-size:11.5px;color:#6E5B33;line-height:1.55;margin-top:5px;word-break:keep-all}',
      '.c7-adv .n{font-size:10.5px;font-weight:900;color:#0A7D56;margin-top:7px;background:#E7F8F1;display:inline-block;padding:4px 9px;border-radius:20px}',
      '.c7-adv.zero{border-color:#CDEFE0;background:linear-gradient(180deg,#F6FDFA,#EEF9F4)}',
      '.c7-adv.zero .h{color:#0A7D56}.c7-adv.zero .m{color:#4A5A52}',
      '.c7-cel{margin-top:10px;border:2px solid #FFD166;background:linear-gradient(135deg,#FFF7DF,#FFF1E5);border-radius:16px;padding:13px;position:relative}',
      '.c7-cel .big{font-size:26px;line-height:1}',
      '.c7-cel .h{font-size:13.5px;font-weight:900;color:#8A5A00;margin-top:6px}',
      '.c7-cel .m{font-size:11.5px;color:#6E5B33;line-height:1.55;margin-top:5px}',
      '.c7-cel .x{position:absolute;top:8px;right:9px;font-size:11px;font-weight:800;color:#8A5A00;background:rgba(255,255,255,.7);border-radius:20px;padding:4px 9px}',

      /* 달력 */
      '.c7-cal{margin-top:12px;background:#fff;border:1.5px solid #E7EEEB;border-radius:16px;padding:10px 10px 11px}',
      '.c7-mh{display:flex;align-items:center;gap:6px;margin-bottom:8px}',
      '.c7-mh b{font-size:14px;font-weight:900;letter-spacing:-.3px;flex:1;text-align:center;color:#16342A}',
      '.c7-mh button{width:30px;height:30px;border-radius:10px;background:#F1F4F5;font-size:15px;font-weight:900;color:#5C6673;display:flex;align-items:center;justify-content:center}',
      '.c7-mh .today-b{width:auto;padding:0 11px;font-size:11px;font-weight:900;color:#0A7D56;background:#E7F8F1}',
      '.c7-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}',
      '.c7-grid .wd{text-align:center;font-size:10px;font-weight:900;color:#9AA4AF;padding:2px 0 4px}',
      '.c7-grid .wd.sun{color:#D9534F}.c7-grid .wd.sat{color:#2F6FD0}',
      '.c7-grid .cd{position:relative;aspect-ratio:1/1;border-radius:11px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:12.5px;font-weight:800;background:#FAFBFB;border:1.5px solid transparent;color:#3C4450;padding:2px 0}',
      '.c7-grid .cd.emp{background:transparent;border-color:transparent}',
      '.c7-grid .cd.sun{color:#D9534F}.c7-grid .cd.sat{color:#2F6FD0}',
      '.c7-grid .cd.today{border-color:#12B886;background:#F0FBF6;color:#0A7D56;font-weight:900}',
      '.c7-grid .cd.on{background:#0E9F6E;border-color:#0E9F6E;color:#fff;font-weight:900}',
      '.c7-grid .cd.on .dots i{box-shadow:0 0 0 1.5px rgba(255,255,255,.9)}',
      '.c7-grid .cd .dots{display:flex;gap:2px;height:5px;align-items:center}',
      '.c7-grid .cd .dots i{width:5px;height:5px;border-radius:50%;background:#E5484D}',
      '.c7-grid .cd .dots i.mid{background:#E8890C}.c7-grid .cd .dots i.low{background:#0E9F6E}',
      '.c7-grid .cd .dots i.dn{opacity:.28}',
      '.c7-grid .cd .more{position:absolute;right:3px;bottom:2px;font-size:8px;font-weight:900;color:#79838F}',
      '.c7-legend{display:flex;gap:8px;justify-content:center;font-size:9.5px;font-weight:800;color:#79838F;margin-top:7px}',

      /* 날짜별 목록 */
      '.c7-dayh{display:flex;align-items:center;gap:6px;margin:12px 2px 7px}',
      '.c7-dayh b{font-size:12.5px;font-weight:900;color:#16342A;flex:1;letter-spacing:-.3px}',
      '.c7-dayh .n{font-size:10.5px;font-weight:800;color:#79838F}',
      '.c7-add{font-size:11px;font-weight:900;color:#fff;background:#0E9F6E;border-radius:20px;padding:7px 11px;white-space:nowrap}',
      '.c7-add.soft{background:#E7F8F1;color:#0A7D56}',
      '.c7-list{display:flex;flex-direction:column;gap:7px}',

      /* 일정 카드 */
      '.c7-it{border:1.5px solid #E7EEEB;border-radius:14px;padding:9px 10px;background:#fff}',
      '.c7-it.done{background:#F7FBF9;border-color:#D8EFE4}',
      '.c7-it.cancel{background:#FAFAFB;border-color:#EDF1F4;opacity:.82}',
      '.c7-it.post{background:#FFFDF6;border-color:#F6E7C2}',
      '.c7-r1{display:flex;align-items:flex-start;gap:5px;flex-wrap:wrap}',
      '.c7-imp{font-size:9.5px;font-weight:900;padding:2px 7px;border-radius:20px;white-space:nowrap;line-height:1.5}',
      '.c7-imp.high{background:#FFECEC;color:#C2282D}.c7-imp.mid{background:#FFF6DC;color:#9A6A00}.c7-imp.low{background:#E7F8F1;color:#0A7D56}',
      '.c7-t{font-size:12.8px;font-weight:900;letter-spacing:-.3px;color:#1B2B24;flex:1;min-width:0;word-break:keep-all;line-height:1.35;margin-top:1px}',
      '.c7-it.done .c7-t{color:#8894A0;text-decoration:line-through}',
      '.c7-tm{font-size:10.5px;font-weight:900;color:#2F6FD0;background:#EEF5FF;padding:2px 7px;border-radius:20px;white-space:nowrap}',
      '.c7-memo{font-size:11.5px;color:#5C6673;line-height:1.5;margin-top:5px;word-break:keep-all}',
      '.c7-r2{font-size:10.5px;font-weight:700;color:#79838F;margin-top:5px;display:flex;flex-wrap:wrap;gap:3px 7px;align-items:center}',
      '.c7-why{color:#0A7D56;background:#F1F9F5;padding:2px 7px;border-radius:20px;font-weight:800}',
      '.c7-owner{background:#F1F4F5;padding:2px 7px;border-radius:20px;font-weight:800;color:#3C4450}',
      '.c7-sts{display:flex;gap:4px;margin-top:8px}',
      '.c7-sts button{flex:1;font-size:10.5px;font-weight:900;padding:7px 0;border-radius:9px;background:#F1F4F5;color:#79838F;letter-spacing:-.3px}',
      '.c7-sts button.on{color:#fff}',
      '.c7-sts button.on.plan{background:#4C8DFF}.c7-sts button.on.done{background:#0E9F6E}',
      '.c7-sts button.on.post{background:#E8890C}.c7-sts button.on.cancel{background:#8A94A0}',
      '.c7-hist{font-size:10px;color:#8A94A0;margin-top:7px;line-height:1.55;word-break:keep-all}',
      '.c7-hist button{font-size:10px;font-weight:900;color:#0A7D56;background:#E7F8F1;border-radius:20px;padding:3px 8px;margin-left:4px}',
      '.c7-hl{margin-top:6px;border-top:1px dashed #E7EEEB;padding-top:6px;display:flex;flex-direction:column;gap:3px}',
      '.c7-hl div{font-size:10px;color:#6B7681;line-height:1.5;word-break:keep-all}',
      '.c7-hl .a{font-weight:900;color:#0A7D56}',
      '.c7-acts{display:flex;gap:5px;margin-top:8px}',
      '.c7-acts button{font-size:10.5px;font-weight:800;padding:6px 10px;border-radius:9px;background:#F4F7F6;color:#5C6673}',
      '.c7-acts button.edit{color:#0A7D56;background:#EAF7F1}',
      '.c7-acts button.del{color:#C2282D;background:#FFF0F0;margin-left:auto}',
      '.c7-empty{text-align:center;font-size:11.5px;color:#9AA4AF;padding:12px 6px;line-height:1.6;background:#FAFBFB;border-radius:12px}',
      '.c7-todo-h{display:flex;align-items:center;gap:6px;margin:13px 2px 7px}',
      '.c7-todo-h b{font-size:12px;font-weight:900;color:#16342A;flex:1}',
      '.c7-foot{font-size:10.5px;color:#9AA4AF;line-height:1.6;margin:10px 3px 0;text-align:center}',
      '@media(min-width:560px){.c7{padding:16px 15px 17px}.c7-grid .cd{font-size:13.5px}.c7-xp .num b{font-size:31px}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ---------------- 렌더 ---------------- */
  function itemsOn(day) {
    return sortItems(allItems().filter(function (x) { return x.d === day; }));
  }
  function undated() {
    return sortItems(allItems().filter(function (x) { return !x.d; }));
  }

  function itemHtml(x) {
    var im = IMP[x.imp];
    var stName = ST[x.st].n;
    var cls = 'c7-it' + (x.st === 'done' ? ' done' : '') + (x.st === 'cancel' ? ' cancel' : '') + (x.st === 'post' ? ' post' : '');
    var hist = x.history || [];
    var last = null;
    for (var i = hist.length - 1; i >= 0; i--) { if (hist[i] && hist[i].action !== '작성') { last = hist[i]; break; } }
    var open = !!histOpen[x.kind + '|' + x.id];

    var h = '<div class="' + cls + '" data-c7it="' + x.kind + '|' + x.id + '">';
    h += '<div class="c7-r1"><span class="c7-imp ' + x.imp + '">' + im.e + ' ' + im.n + '</span>' +
      '<span class="c7-t">' + esc(x.t) + '</span>' +
      (x.time && x.d ? '<span class="c7-tm">' + esc(x.time) + '</span>' : '') + '</div>';
    if (x.memo) h += '<div class="c7-memo">' + esc(x.memo) + '</div>';
    h += '<div class="c7-r2">' +
      (x.owner ? '<span class="c7-owner">' + emojiOf(x.owner) + ' ' + esc(nameOf(x.owner) || '가족') + ' 담당</span>' :
        '<span class="c7-owner">담당 미정</span>') +
      '<span class="c7-why">' + (x.auto ? '🤖 자동: ' : '✍️ 직접: ') + esc(x.why || im.n) + '</span>' +
      '<span>· ' + esc(stName) + ' · 가족 XP +' + im.xp + '</span>' +
      '</div>';

    h += '<div class="c7-sts">';
    ST_ORDER.forEach(function (k) {
      h += '<button type="button" class="' + (x.st === k ? 'on ' + k : '') + '" data-c7st="' + k + '" aria-label="' + ST[k].n + ' 상태로 바꾸기">' + ST[k].e + ' ' + ST[k].n + '</button>';
    });
    h += '</div>';

    h += '<div class="c7-hist">📝 작성: ' + esc(nameOf(x.createdBy) || '가족') + ' ' + stamp(x.createdAt) +
      ' · 최근 수정: ' + (last ? esc(last.name || nameOf(last.by) || '가족') + ' ' + stamp(last.at) : '없음') +
      (hist.length > 1 ? '<button type="button" data-c7hist="1">이력 ' + hist.length + '건 보기</button>' : '') +
      '</div>';
    if (open) {
      h += '<div class="c7-hl">';
      hist.forEach(function (e) {
        h += '<div><span class="a">' + esc(e.action || '수정') + '</span> · ' + esc(e.name || nameOf(e.by) || '가족') +
          ' · ' + stamp(e.at) + (e.detail ? ' — ' + esc(e.detail) : '') + '</div>';
      });
      h += '</div>';
    }
    h += '<div class="c7-acts"><button type="button" class="edit" data-c7edit="1">✏️ 편집</button>' +
      (last ? '<button type="button" data-c7hist="1">🕘 이력</button>' : '') +
      '<button type="button" class="del" data-c7del="1">🗑 삭제</button></div>';
    h += '</div>';
    return h;
  }

  function calHtml(items) {
    var p = viewMonth.split('-'), y = Number(p[0]), m = Number(p[1]);
    var counts = {};
    items.forEach(function (x) {
      if (!x.d || x.d.slice(0, 7) !== viewMonth) return;
      var c = counts[x.d] || (counts[x.d] = { high: 0, mid: 0, low: 0, n: 0 });
      c[x.imp]++; c.n++;
    });
    var first = new Date(y, m - 1, 1), start = first.getDay(), last = new Date(y, m, 0).getDate();
    var t = today();
    var wd = ['일', '월', '화', '수', '목', '금', '토'], h = '';
    for (var i = 0; i < 7; i++) {
      h += '<div class="wd' + (i === 0 ? ' sun' : (i === 6 ? ' sat' : '')) + '">' + wd[i] + '</div>';
    }
    for (var s = 0; s < start; s++) h += '<div class="cd emp"></div>';
    for (var day = 1; day <= last; day++) {
      var ds = y + '-' + pad(m) + '-' + pad(day);
      var c = counts[ds] || { high: 0, mid: 0, low: 0, n: 0 };
      var cls = 'cd' + (ds === t ? ' today' : '') + (ds === selDay ? ' on' : '') + (first.getDay() === 0 && day % 7 === 1 ? ' sun' : '');
      /* 요일별 색(일요일 빨강, 토요일 파랑) */
      var wdi = (start + day - 1) % 7;
      cls += (wdi === 0 ? ' sun' : (wdi === 6 ? ' sat' : ''));
      var dots = '';
      var parts = [];
      ['high', 'mid', 'low'].forEach(function (k) {
        for (var q = 0; q < Math.min(3, c[k]); q++) parts.push('<i class="' + (k === 'high' ? '' : k) + '"></i>');
      });
      if (c.n > 3) {
        /* 점이 3개를 넘으면 중요도 순으로 3개만 */
        parts = parts.slice(0, 3);
      }
      if (parts.length) dots = '<span class="dots">' + parts.join('') + '</span>';
      h += '<div class="' + cls + '" data-c7day="' + ds + '" role="button" tabindex="0" aria-label="' + m + '월 ' + day + '일 ' + wd[wdi] + '요일' + (c.n ? ' · 일정 ' + c.n + '건' : '') + '">' + day + dots +
        (c.n > 3 ? '<span class="more">' + c.n + '</span>' : '') + '</div>';
    }
    var monthN = items.filter(function (x) { return x.d && x.d.slice(0, 7) === viewMonth; }).length;
    var head = '<div class="c7-mh"><button type="button" data-c7m="-1" aria-label="이전 달">‹</button>' +
      '<b>' + y + '년 ' + m + '월 <span style="font-size:10.5px;font-weight:800;color:#9AA4AF">' + monthN + '개</span></b>' +
      '<button type="button" data-c7m="1" aria-label="다음 달">›</button>' +
      '<button type="button" class="today-b" data-c7today="1">오늘</button></div>';
    return '<div class="c7-cal">' + head + '<div class="c7-grid">' + h + '</div>' +
      '<div class="c7-legend"><span>🔴 높음</span><span>🟡 보통</span><span>🟢 낮음</span><span>· 점은 그날 일정</span></div></div>';
  }

  function xpHtml(x) {
    var ach = achievedMs(x.total), nx = nextMs(x.total);
    var h = '<div class="c7-xp"><div class="cap">🏆 우리가족 함께 경험치 <span class="lv">Lv.' + x.lv + '</span></div>' +
      '<div class="num"><b>' + x.total + '</b><span>XP</span><span style="margin-left:auto;opacity:.9">완료 ' + x.doneN + '건' +
      (x.openN ? ' · 남은 ' + x.openN + '건' : '') + '</span></div>' +
      '<div class="c7-bar"><i style="width:' + x.pct + '%"></i></div>' +
      '<div class="c7-goal"><span>Lv.' + x.lv + ' → Lv.' + (x.lv + 1) + '까지 ' + x.toNextLv + ' XP</span>' +
      '<span>' + (nx ? nx.e + ' ' + nx.xp + ' XP · ' + nx.t : '모든 보상 달성 🎊') + '</span></div>';
    h += '<div class="c7-ms">';
    MS.forEach(function (m) {
      var on = ach.some(function (a) { return a.xp === m.xp; });
      h += '<div class="m' + (on ? ' on' : '') + '"><b>' + m.e + '</b>' + m.xp + '</div>';
    });
    h += '</div>';
    var ks = Object.keys(x.by).sort(function (a, b) { return x.by[b] - x.by[a]; });
    if (ks.length) {
      h += '<div class="c7-contrib">';
      ks.forEach(function (k) {
        h += '<span class="x">' + emojiOf(k) + ' ' + esc(nameOf(k) || '가족') + ' ' + x.by[k] + '</span>';
      });
      h += '</div>';
    }
    return h + '</div>';
  }

  function advHtml(x) {
    var ach = achievedMs(x.total);
    if (!ach.length) {
      var first = MS[0];
      return '<div class="c7-adv zero"><div class="h">🌱 우리 가족 경험치를 모아 볼까요?</div>' +
        '<div class="m">일정이나 할일을 <b>✅ 완료</b>로 바꿀 때마다 가족 전체 경험치가 쌓여요. ' +
        first.xp + '점이면 ' + first.e + ' ' + first.t + ', 100점이면 다 같이 외식을 추천해 드릴게요.</div>' +
        '<span class="n">목표까지 ' + (first.xp - x.total) + ' XP</span></div>';
    }
    var top = ach[ach.length - 1], nx = nextMs(x.total);
    var h = '<div class="c7-adv"><div class="h">' + top.e + ' 가족 경험치 ' + top.xp + '점 돌파! ' + esc(top.t) + ' 추천</div>' +
      '<div class="m">' + esc(top.m) + '</div>';
    h += '<span class="n">' + (nx ? '다음 보상까지 ' + (nx.xp - x.total) + ' XP · ' + nx.e + ' ' + nx.t : '모든 보상 달성 · 최고예요 🎊') + '</span></div>';
    return h;
  }

  function celHtml() {
    if (!celebrate) return '';
    var m = celebrate;
    return '<div class="c7-cel"><button type="button" class="x" data-c7celx="1">확인</button>' +
      '<div class="big">' + m.e + '</div><div class="h">🎊 가족 경험치 ' + m.xp + '점 돌파! ' + esc(m.t) + '</div>' +
      '<div class="m">' + esc(m.m) + '</div></div>';
  }

  function render() {
    var box = $('famCalBanner');
    if (!box || !F || !d() || !me()) return;
    style();
    var items = allItems();
    var x = xpInfo();
    syncMilestones(x.total, false);

    var p = viewMonth.split('-'), y = Number(p[0]), m = Number(p[1]);
    if (!selDay) selDay = today();
    var day = selDay;
    var list = itemsOn(day);
    var undone = undated();

    var dayLabel = Number(day.slice(5, 7)) + '월 ' + Number(day.slice(8, 10)) + '일 (' + weekday(day) + ')';
    if (day === today()) dayLabel += ' · 오늘';

    var sig = JSON.stringify([viewMonth, selDay, items, x.total, x.doneN, x.openN, Object.keys(histOpen),
      celebrate ? celebrate.xp : 0, y + '-' + m]);
    box.__sig = sig;

    var html = '<div class="c7-hd"><h2>📅 우리가족 달력</h2><span class="lb">가족 누구나 작성 · 편집</span></div>' +
      xpHtml(x) + celHtml() + (celebrate ? '' : advHtml(x)) + calHtml(items) +
      '<div class="c7-dayh"><b>' + dayLabel + '</b><span class="n">' + list.length + '건</span>' +
      '<button type="button" class="c7-add" data-c7add="1">＋ 일정 추가</button></div>';

    html += '<div class="c7-list">';
    if (!list.length) {
      html += '<div class="c7-empty">이날은 아직 일정이 없어요.<br>＋ 일정 추가로 가족 일정을 적어 보세요.</div>';
    } else {
      list.forEach(function (it) { html += itemHtml(it); });
    }
    html += '</div>';

    html += '<div class="c7-todo-h"><b>📌 날짜 없는 할일</b><span class="n" style="font-size:10.5px;color:#79838F">' + undone.length + '건</span>' +
      '<button type="button" class="c7-add soft" data-c7addtodo="1">＋ 할일</button></div>';
    html += '<div class="c7-list">';
    if (!undone.length) {
      html += '<div class="c7-empty">날짜 없이 두는 할일도 괜찮아요. 끝나면 ✅ 완료를 눌러 주세요.</div>';
    } else {
      undone.forEach(function (it) { html += itemHtml(it); });
    }
    html += '</div>';

    html += '<div class="c7-foot">일정을 완료하면 가족 전체 경험치가 쌓여요 · 누가 언제 작성·수정했는지 모두 기록됩니다</div>';

    if (box.innerHTML !== html) box.innerHTML = html;
  }

  /* 예전(V4) 기록에는 작성자·작성시각 필드가 없다.
     손대는 순간 확정해 두어야 상태를 바꿀 때마다 '작성 시각'이 지금으로 흔들리지 않는다. */
  function ensureMeta(r) {
    if (!r.createdAt) r.createdAt = r.at || now();
    if (!r.createdBy) r.createdBy = r.by || '';
    if (!r.st) { r.st = r.done ? 'done' : 'plan'; r.stAt = r.at || now(); }
    if (!IMP[r.imp]) {
      var j = judge(r.t, r.memo, r.d || '');
      r.imp = j.level; r.impAuto = 1; r.impWhy = j.why;
    }
    if (!Array.isArray(r.history) || !r.history.length) {
      r.history = [{ by: r.createdBy, name: nameOf(r.createdBy) || '가족', action: '작성',
        detail: '가족 달력에 처음 등록', at: r.createdAt }];
    }
  }

  /* ---------------- 이력 쓰기 ---------------- */
  function pushHist(r, action, detail, at) {
    if (!Array.isArray(r.history)) r.history = [];
    r.history.push({ by: mid(), name: meName(), action: action, detail: detail || '', at: at || now() });
    if (r.history.length > 60) r.history = r.history.slice(r.history.length - 60);
  }
  function detailCreate(t, imp, why, day, time) {
    return '‘' + t + '’ · 중요도 ' + IMP[imp].e + IMP[imp].n + '(' + (why || '') + ')' +
      (day ? ' · ' + md(day) + (time ? ' ' + time : '') : ' · 날짜 없음');
  }

  /* ---------------- 상태 변경 ---------------- */
  function setStatus(kind, id, st) {
    var r = rawRec(kind, id);
    if (!r) return;
    ensureMeta(r);
    var cur = prep(r, id, kind).st;
    if (cur === st) return;
    var n = now();
    var im = prep(r, id, kind).imp;

    r.st = st;
    r.done = st === 'done' ? 1 : 0;
    if (st === 'done') { r.doneBy = mid(); r.doneAt = n; }
    else { r.doneBy = ''; r.doneAt = 0; }
    r.at = n; r.stAt = n;
    pushHist(r, '상태변경', ST[cur].n + '→' + ST[st].n, n);
    save();

    var xp = xpInfo();
    syncMilestones(xp.total, true);
    render();
    if (st === 'done') {
      toast('✅ 완료! 가족 경험치 +' + IMP[im].xp + ' XP (총 ' + xp.total + ' XP)');
    } else if (cur === 'done') {
      toast('↩️ 완료를 해제했어요 · 가족 경험치 -' + IMP[im].xp + ' XP (총 ' + xp.total + ' XP)');
    } else {
      toast('상태를 ' + ST[st].n + '(으)로 바꿨어요');
    }
    if (celebrate) toast('🎊 가족 경험치 ' + celebrate.xp + '점 돌파! ' + celebrate.t + ' 어때요?');
  }

  /* ---------------- 삭제 ---------------- */
  function removeItem(kind, id) {
    var r = rawRec(kind, id);
    if (!r) return;
    ensureMeta(r);
    var n = now();
    r.del = 1; r.at = n; r.deletedBy = mid();
    pushHist(r, '삭제', '가족 달력에서 지움', n);
    save();
    render();
    toast('일정을 지웠어요');
  }

  /* ---------------- 추가·편집 시트 ---------------- */
  function ownerOptions(sel) {
    var h = '<option value="">담당 없음</option>';
    (F.members() || []).forEach(function (m) {
      h += '<option value="' + esc(m.id) + '"' + (m.id === sel ? ' selected' : '') + '>' +
        esc(m.emoji || '') + ' ' + esc(m.name) + ' (' + esc(m.role) + ')</option>';
    });
    return h;
  }
  function impOptions(sel) {
    var h = '<option value="auto"' + (sel === 'auto' ? ' selected' : '') + '>🤖 자동 판단</option>';
    ['high', 'mid', 'low'].forEach(function (k) {
      h += '<option value="' + k + '"' + (sel === k ? ' selected' : '') + '>' + IMP[k].e + ' ' + IMP[k].n + ' (+' + IMP[k].xp + ' XP)</option>';
    });
    return h;
  }
  function val(id) { var e = $(id); return e ? e.value : ''; }

  function openAdd(day) {
    var seq = ++formSeq;
    var date = day || selDay || today();
    F.openSheet(
      '<h3>📅 새 일정·할일 추가</h3>' +
      '<div class="sdesc">가족 누구나 쓸 수 있어요. 제목을 적으면 중요도를 자동으로 판단해 드려요. 날짜를 비우면 ‘날짜 없는 할일’이 됩니다.</div>' +
      '<div class="form-row"><label>제목</label><input class="field" id="c7fT" maxlength="60" placeholder="예: 지섭이 병원 예약 / 장보기"></div>' +
      '<div style="display:flex;gap:8px">' +
      '<div class="form-row" style="flex:1.2"><label>날짜</label><input class="field" type="date" id="c7fD" value="' + esc(date) + '"></div>' +
      '<div class="form-row" style="flex:1"><label>시간(선택)</label><input class="field" id="c7fTm" inputmode="numeric" maxlength="5" placeholder="예: 14:30"></div>' +
      '</div>' +
      '<div class="form-row"><label>메모(선택)</label><textarea class="field" id="c7fM" rows="2" maxlength="200" placeholder="준비물·장소·자세한 내용"></textarea></div>' +
      '<div style="display:flex;gap:8px">' +
      '<div class="form-row" style="flex:1"><label>담당</label><select class="field" id="c7fO">' + ownerOptions(mid()) + '</select></div>' +
      '<div class="form-row" style="flex:1"><label>중요도</label><select class="field" id="c7fI">' + impOptions('auto') + '</select></div>' +
      '</div>' +
      '<div id="c7fHint" style="font-size:11px;font-weight:800;color:#0A7D56;background:#E7F8F1;border-radius:10px;padding:7px 10px;margin:-2px 0 10px;line-height:1.5">제목을 적으면 자동 판단 결과가 여기에 보여요.</div>' +
      '<div style="display:flex;gap:8px"><button type="button" class="btn ghost" id="c7fX" style="flex:1">취소</button>' +
      '<button type="button" class="btn" id="c7fS" style="flex:1.6">추가하기</button></div>'
    );
    var t = $('c7fT');
    function hint() {
      var j = judge(val('c7fT'), val('c7fM'), val('c7fD'));
      var pick = val('c7fI');
      var lv = pick === 'auto' ? j.level : pick;
      var why = pick === 'auto' ? j.why : '직접 고름';
      var el = $('c7fHint');
      if (el) el.innerHTML = '중요도 ' + IMP[lv].e + ' <b>' + IMP[lv].n + '</b> · ' + esc(why) + ' · 완료하면 가족 XP +' + IMP[lv].xp;
      return { lv: lv, why: why };
    }
    if (t) { t.addEventListener('input', hint); setTimeout(function () { t.focus(); }, 60); }
    ['c7fM', 'c7fD', 'c7fI'].forEach(function (id) {
      var e = $(id);
      if (e) e.addEventListener('input', hint), e.addEventListener('change', hint);
    });
    if ($('c7fX')) $('c7fX').onclick = function () { F.closeSheet(); };
    if ($('c7fS')) $('c7fS').onclick = function () {
      var title = (val('c7fT') || '').trim();
      if (!title) { toast('제목을 적어 주세요'); if ($('c7fT')) $('c7fT').focus(); return; }
      var tm = normTime(val('c7fTm'));
      if ((val('c7fTm') || '').trim() && !tm) { toast('시간은 14:30 처럼 적어 주세요'); if ($('c7fTm')) $('c7fTm').focus(); return; }
      var did = addItem({
        t: title, d: val('c7fD') || '', time: tm, memo: (val('c7fM') || '').trim(),
        owner: val('c7fO') || '', imp: val('c7fI') === 'auto' ? '' : val('c7fI')
      });
      F.closeSheet();
      if (did) {
        if (did.d) { selDay = did.d; var mm = did.d.slice(0, 7); if (mm !== viewMonth) { viewMonth = mm; lsSet(LS_MONTH, viewMonth); } }
        lsSet(LS_SEL, selDay);
        render();
        toast(did.d ? md(did.d) + ' 일정을 추가했어요 · ' + IMP[did.imp].e + IMP[did.imp].n : '날짜 없는 할일로 추가했어요');
      }
    };
  }

  function addItem(o) {
    var v = store();
    if (!v) return null;
    var kind = o.d ? 'cal' : 'todos';
    var node = v[kind];
    var id = (kind === 'cal' ? 'c7' : 't7') + now().toString(36) + Math.random().toString(36).slice(2, 4);
    var n = now();
    var j = judge(o.t, o.memo, o.d);
    var imp = o.imp || j.level;
    var why = o.imp ? '직접 정함(중요도 선택)' : j.why;
    node[id] = {
      t: o.t, d: o.d || '', time: o.time || '', memo: o.memo || '', owner: o.owner || '',
      by: mid(), at: n, done: 0, st: 'plan', stAt: n,
      imp: imp, impAuto: o.imp ? 0 : 1, impWhy: why,
      createdBy: mid(), createdAt: n,
      history: [{ by: mid(), name: meName(), action: '작성', detail: detailCreate(o.t, imp, why, o.d, o.time), at: n }]
    };
    save();
    return { kind: kind, id: id, imp: imp, d: o.d || '' };
  }

  function openEdit(kind, id) {
    var r = rawRec(kind, id);
    if (!r) return;
    var x = prep(r, id, kind);
    F.openSheet(
      '<h3>✏️ 일정 편집</h3>' +
      '<div class="sdesc">바꾼 내용과 바꾼 사람·시각이 이력에 그대로 남아요.</div>' +
      '<div class="form-row"><label>제목</label><input class="field" id="c7eT" maxlength="60" value="' + esc(x.t) + '"></div>' +
      '<div style="display:flex;gap:8px">' +
      '<div class="form-row" style="flex:1.2"><label>날짜</label><input class="field" type="date" id="c7eD" value="' + esc(x.d) + '"></div>' +
      '<div class="form-row" style="flex:1"><label>시간(선택)</label><input class="field" id="c7eTm" inputmode="numeric" maxlength="5" placeholder="예: 14:30" value="' + esc(x.time) + '"></div>' +
      '</div>' +
      '<div class="form-row"><label>메모(선택)</label><textarea class="field" id="c7eM" rows="2" maxlength="200">' + esc(x.memo) + '</textarea></div>' +
      '<div style="display:flex;gap:8px">' +
      '<div class="form-row" style="flex:1"><label>담당</label><select class="field" id="c7eO">' + ownerOptions(x.owner) + '</select></div>' +
      '<div class="form-row" style="flex:1"><label>중요도</label><select class="field" id="c7eI">' + impOptions(x.auto ? 'auto' : x.imp) + '</select></div>' +
      '</div>' +
      '<div id="c7eHint" style="font-size:11px;font-weight:800;color:#0A7D56;background:#E7F8F1;border-radius:10px;padding:7px 10px;margin:-2px 0 10px;line-height:1.5"></div>' +
      '<div style="display:flex;gap:8px"><button type="button" class="btn ghost" id="c7eX" style="flex:1">취소</button>' +
      '<button type="button" class="btn" id="c7eS" style="flex:1.6">저장</button></div>'
    );
    function hint() {
      var j = judge(val('c7eT'), val('c7eM'), val('c7eD'));
      var pick = val('c7eI');
      var lv = pick === 'auto' ? j.level : pick;
      var el = $('c7eHint');
      if (el) el.innerHTML = '저장하면 중요도 ' + IMP[lv].e + ' <b>' + IMP[lv].n + '</b> · ' + esc(pick === 'auto' ? j.why : '직접 고름');
      return { lv: lv, why: pick === 'auto' ? j.why : '직접 정함(중요도 선택)' };
    }
    var et = $('c7eT');
    if (et) { et.addEventListener('input', hint); setTimeout(function () { et.focus(); }, 60); }
    ['c7eM', 'c7eD', 'c7eI'].forEach(function (idd) {
      var e = $(idd);
      if (e) { e.addEventListener('input', hint); e.addEventListener('change', hint); }
    });
    hint();
    if ($('c7eX')) $('c7eX').onclick = function () { F.closeSheet(); };
    if ($('c7eS')) $('c7eS').onclick = function () {
      var title = (val('c7eT') || '').trim();
      if (!title) { toast('제목을 적어 주세요'); return; }
      var ntmRaw = (val('c7eTm') || '').trim();
      var nd = val('c7eD') || '', ntm = normTime(ntmRaw);
      if (ntmRaw && !ntm) { toast('시간은 14:30 처럼 적어 주세요'); if ($('c7eTm')) $('c7eTm').focus(); return; }
      var nmemo = (val('c7eM') || '').trim(), nown = val('c7eO') || '', pick = val('c7eI');
      var h = hint();
      var changes = [];
      if (x.t !== title) changes.push('제목 ‘' + x.t + '’ → ‘' + title + '’');
      if ((x.d || '') !== nd) changes.push('날짜 ' + (x.d ? md(x.d) : '없음') + ' → ' + (nd ? md(nd) : '없음'));
      if ((x.time || '') !== ntm) changes.push('시간 ' + (x.time || '없음') + ' → ' + (ntm || '없음'));
      if ((x.memo || '') !== nmemo) changes.push('메모 ' + (x.memo ? '수정' : '추가'));
      if ((x.owner || '') !== nown) changes.push('담당 ' + (nameOf(x.owner) || '없음') + ' → ' + (nameOf(nown) || '없음'));
      if (h.lv !== x.imp || (pick === 'auto') !== !!x.auto) changes.push('중요도 ' + IMP[x.imp].e + IMP[x.imp].n + ' → ' + IMP[h.lv].e + IMP[h.lv].n);
      if (!changes.length) { F.closeSheet(); toast('바뀐 내용이 없어요'); return; }

      /* 시트를 연 뒤 다른 기기와 동기화되면 DOC 객체가 새것으로 바뀐다 → 저장 직전에 다시 찾는다 */
      var rr = rawRec(kind, id);
      if (!rr) { toast('일정을 찾을 수 없어요 · 새로고침해 주세요'); return; }
      ensureMeta(rr);
      var n = now();
      rr.t = title; rr.d = nd; rr.time = ntm; rr.memo = nmemo; rr.owner = nown;
      rr.imp = h.lv; rr.impAuto = pick === 'auto' ? 1 : 0; rr.impWhy = h.why;
      rr.at = n;
      pushHist(rr, '수정', changes.join(' · '), n);
      save();
      F.closeSheet();
      if (nd) { selDay = nd; var mm2 = nd.slice(0, 7); if (mm2 !== viewMonth) { viewMonth = mm2; lsSet(LS_MONTH, mm2); } lsSet(LS_SEL, selDay); }
      render();
      toast('수정했어요 · 이력에 남겼습니다');
    };
  }

  function confirmDelete(kind, id) {
    var r = rawRec(kind, id);
    if (!r) return;
    var x = prep(r, id, kind);
    F.openSheet(
      '<h3>🗑 일정을 지울까요?</h3>' +
      '<div class="sdesc">‘' + esc(x.t) + '’ · ' + (x.d ? md(x.d) + ' (' + weekday(x.d) + ')' : '날짜 없는 할일') +
      '<br>다른 가족 화면에서도 사라져요. 완료했던 일정이면 가족 경험치도 함께 줄어요.</div>' +
      '<div style="display:flex;gap:8px"><button type="button" class="btn ghost" id="c7dX" style="flex:1">취소</button>' +
      '<button type="button" class="btn coral" id="c7dS" style="flex:1">지우기</button></div>'
    );
    if ($('c7dX')) $('c7dX').onclick = function () { F.closeSheet(); };
    if ($('c7dS')) $('c7dS').onclick = function () { F.closeSheet(); removeItem(kind, id); };
  }

  /* ---------------- 이벤트 ---------------- */
  function wire() {
    var box = $('famCalBanner');
    if (!box || box.__c7wired) return;
    box.__c7wired = 1;
    box.addEventListener('click', function (e) {
      var el;
      if ((el = e.target.closest('[data-c7it]'))) {
        var parts = el.getAttribute('data-c7it').split('|');
        var kind = parts[0], id = parts[1];
        if (e.target.closest('[data-c7st]')) { setStatus(kind, id, e.target.closest('[data-c7st]').getAttribute('data-c7st')); return; }
        if (e.target.closest('[data-c7edit]')) { openEdit(kind, id); return; }
        if (e.target.closest('[data-c7del]')) { confirmDelete(kind, id); return; }
        if (e.target.closest('[data-c7hist]')) { histOpen[kind + '|' + id] = !histOpen[kind + '|' + id]; render(); return; }
        return;
      }
      if ((el = e.target.closest('[data-c7day]'))) {
        selDay = el.getAttribute('data-c7day'); lsSet(LS_SEL, selDay); render(); return;
      }
      if ((el = e.target.closest('[data-c7m]'))) {
        var n = Number(el.getAttribute('data-c7m'));
        var p = viewMonth.split('-');
        var d0 = new Date(Number(p[0]), Number(p[1]) - 1 + n, 1);
        viewMonth = d0.getFullYear() + '-' + pad(d0.getMonth() + 1);
        lsSet(LS_MONTH, viewMonth);
        render(); return;
      }
      if (e.target.closest('[data-c7today]')) {
        selDay = today(); viewMonth = selDay.slice(0, 7);
        lsSet(LS_SEL, selDay); lsSet(LS_MONTH, viewMonth); render(); return;
      }
      if (e.target.closest('[data-c7add]')) { openAdd(selDay || today()); return; }
      if (e.target.closest('[data-c7addtodo]')) { openAdd(''); return; }
      if (e.target.closest('[data-c7celx]')) { celebrate = null; render(); return; }
    });
    box.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var el = e.target.closest('[data-c7day]');
      if (!el) return;
      e.preventDefault();
      selDay = el.getAttribute('data-c7day'); lsSet(LS_SEL, selDay); render();
    });
  }

  /* ---------------- mount ---------------- */
  function mount(FAM) {
    if (ON) return;
    F = FAM; ON = true;
    try {
      viewMonth = lsGet(LS_MONTH) || today().slice(0, 7);
      selDay = lsGet(LS_SEL) || today();
      if (!/^\d{4}-\d{2}$/.test(viewMonth)) viewMonth = today().slice(0, 7);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(selDay)) selDay = today();
    } catch (e) { viewMonth = today().slice(0, 7); selDay = today(); }
    wire();
    render();
  }

  global.CAL7 = {
    mount: mount,
    render: render,
    gotoHome: function () {
      if (F) F.view('home');
      setTimeout(function () {
        var b = $('famCalBanner');
        if (b && b.scrollIntoView) b.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    },
    add: function (o) { return addItem(o); },
    setStatus: setStatus,
    judge: judge,
    xp: xpInfo,
    items: allItems,
    openAdd: openAdd
  };

  /* 본체가 부르는 갈고리에 이어 붙는다 */
  var prevRender = global.__FAM_RENDER;
  var prevView = global.__FAM_VIEW;
  global.__FAM_RENDER = function () {
    if (prevRender) { try { prevRender(); } catch (e) {} }
    try {
      if (!ON && global.FAM && global.FAM.doc && global.FAM.doc() && global.FAM.me && global.FAM.me()) mount(global.FAM);
      else render();
    } catch (e) { console.warn('CAL7 render', e); }
  };
  global.__FAM_VIEW = function (v) {
    if (prevView) { try { prevView(v); } catch (e) {} }
    if (v === 'home') { try { render(); } catch (e) {} }
  };
  if (global.FAM4 && typeof global.FAM4.mount === 'function') {
    var om = global.FAM4.mount;
    global.FAM4.mount = function (FAM) {
      om.call(global.FAM4, FAM);
      try { mount(FAM); } catch (e) { console.warn('CAL7 mount', e); }
    };
  }
  /* 본체가 FAM4.mount 를 직접 부르기 전에 붙어 있어야 하므로, 준비되면 스스로 붙인다 */
  if (global.FAM && global.FAM.doc && global.FAM.doc() && global.FAM.me && global.FAM.me()) {
    try { mount(global.FAM); } catch (e) {}
  }
})(window);
