/* ============================================================================
   우리가족포털 V12 · 과거 기록 보기 (hist12.js)
   ----------------------------------------------------------------------------
   날짜 하나를 고르면 그날 가족이 남긴 모든 기록을 한 화면에 모아 보여 줍니다.
     · 사진(그날 올린 사진·대표사진)   · 일기 / 편지 / 공지
     · 상벌점(그날 받은 점수와 건의)   · 용돈기입장(그날 받은·쓴 돈)
     · 가족 달력 일정 · 근무/휴식·수향 출근·아이들 등교
     · 기분 기록 · 등하교 안심 기록 · 귀가 현황(그날 스냅숏) · 수면
   기록이 없는 날은 "기록이 없어요"라고 그대로 알려 줍니다(없는 기록을
   지금 상태로 지어내지 않습니다 — 예전 아카이브의 버그를 여기서 바로잡음).
   ========================================================================== */
(function (global) {
  'use strict';

  var ON = false, F = null;
  var curYmd = '';
  var ANCHOR_FALLBACK = '2026-11-16';       /* 상국 님이 정한 근무표 1일차(11/1 근무·11/6 근무·11/11 휴식과 일치) */
  var CYCLE_FALLBACK = [4, 5, 5, 4, 5, 5];  /* 4일 근무 · 5일 휴식 · 5일 근무 · 4일 휴식 … */

  function $(id) { return document.getElementById(id); }
  function d() { return F && F.doc ? F.doc() : null; }
  function p2(n) { return n < 10 ? '0' + n : '' + n; }
  function ymdOf(ts) { var x = new Date(ts); return x.getFullYear() + '-' + p2(x.getMonth() + 1) + '-' + p2(x.getDate()); }
  function todayYmd() { return ymdOf(Date.now()); }
  function esc(s) { return F && F.esc ? F.esc(s) : String(s == null ? '' : s); }
  function mem(id) { try { return (F && F.memOf ? F.memOf(id) : null) || { name: '가족', emoji: '🧑' }; } catch (e) { return { name: '가족', emoji: '🧑' }; } }
  function nm(id) { return esc(mem(id).name); }
  function em(id) { return mem(id).emoji || '🧑'; }
  function won(n) { return (F && F.won) ? F.won(n) : (Number(n || 0)).toLocaleString('ko-KR') + '원'; }
  function hhmm(ts) { var x = new Date(ts); return p2(x.getHours()) + ':' + p2(x.getMinutes()); }
  function WD() { return ['일', '월', '화', '수', '목', '금', '토']; }

  function v9() {
    var D = d();
    if (!D) return null;
    if (!D.v9 || typeof D.v9 !== 'object') D.v9 = {};
    var v = D.v9;
    ['sb', 'archive', 'moneyD', 'moodHist', 'school', 'commute', 'shiftCfg', 'sleep', 'ddays', 'wish', 'goals'].forEach(function (k) {
      if (!v[k] || typeof v[k] !== 'object') v[k] = {};
    });
    if (!v.sb.cat) v.sb.cat = {};
    if (!v.sb.rec) v.sb.rec = {};
    return v;
  }

  /* ---------------- 근무표 ---------------- */
  function shiftCfg() {
    var v = v9() || {};
    var c = v.shiftCfg || {};
    var cyc = (c.cycle instanceof Array && c.cycle.length) ? c.cycle : CYCLE_FALLBACK;
    return { anchor: c.anchor || ANCHOR_FALLBACK, cycle: cyc, custom: !!c.anchor };
  }
  function shiftOf(yk, vv) {
    var ov = null;
    try {
      var o = JSON.parse(localStorage.getItem('sg_shift_overrides_v1') || '{}');
      var val = o[yk];
      if (val) ov = (typeof val === 'string') ? val : val.type;
    } catch (e) { }
    if (ov === 'work') return { label: '근무', work: true, ov: 1 };
    if (ov === 'rest') return { label: '휴식', work: false, ov: 1 };
    if (ov === 'vacation') return { label: '휴가', work: false, ov: 1 };
    if (vv && vv.shift && vv.shift[yk]) {
      var x = vv.shift[yk];
      var t = (typeof x === 'string') ? x : x.type;
      if (t === 'work') return { label: '근무', work: true, ov: 1 };
      if (t === 'rest') return { label: '휴식', work: false, ov: 1 };
      if (t === 'vacation') return { label: '휴가', work: false, ov: 1 };
    }
    var cfg = shiftCfg();
    var a = new Date(cfg.anchor + 'T00:00:00');
    var t2 = new Date(yk + 'T00:00:00');
    var total = 0, i;
    for (i = 0; i < cfg.cycle.length; i++) total += Number(cfg.cycle[i]) || 0;
    if (!total) return { label: '–', work: false };
    var diff = Math.round((t2 - a) / 86400000);
    var idx = ((diff % total) + total) % total;
    var acc = 0;
    for (i = 0; i < cfg.cycle.length; i++) {
      acc += Number(cfg.cycle[i]) || 0;
      if (idx < acc) return { label: (i % 2 === 0) ? '근무' : '휴식', work: (i % 2 === 0) };
    }
    return { label: '–', work: false };
  }

  /* ---------------- 날짜별 모으기 ---------------- */
  function collect(yk) {
    var D = d() || {}, v = v9() || {};
    var out = {
      photos: [], diary: [], letters: [], notices: [], chat: [], cheer: [],
      sb: [], sbPending: 0, money: [], cal: [], mood: [], school: {}, sleep: [],
      status: null, shift: null, commute: false, vacation: false
    };
    var k;
    Object.keys(D.photos || {}).forEach(function (id) {
      var p = D.photos[id];
      if (!p || p.d || !p.at) return;
      if (ymdOf(p.at) === yk) out.photos.push({ id: id, p: p });
    });
    out.photos.sort(function (a, b) { return a.p.at - b.p.at; });
    if (D.pod && D.pod.date === yk) out.pod = D.pod;

    Object.keys(D.diary || {}).forEach(function (id) {
      var x = D.diary[id];
      if (!x || x.d) return;
      var day = x.date || (x.at ? ymdOf(x.at) : '');
      if (day === yk) out.diary.push(x);
    });
    Object.keys(D.letters || {}).forEach(function (id) {
      var x = D.letters[id];
      if (x && x.at && ymdOf(x.at) === yk) out.letters.push(x);
    });
    Object.keys(D.notices || {}).forEach(function (id) {
      var x = D.notices[id];
      if (x && x.at && ymdOf(x.at) === yk) out.notices.push(x);
    });
    Object.keys(D.chat || {}).forEach(function (id) {
      var x = D.chat[id];
      if (x && x.at && ymdOf(x.at) === yk) out.chat.push(x);
    });
    out.chat.sort(function (a, b) { return a.at - b.at; });
    Object.keys(D.cheer || {}).forEach(function (id) {
      var x = D.cheer[id];
      if (x && !x.d && x.text && x.at && ymdOf(x.at) === yk) out.cheer.push({ by: id, x: x });
    });

    /* 상벌점: 승인된 기록만 점수로, 대기 건의는 따로 */
    var sb = v.sb || {};
    Object.keys(sb.rec || {}).forEach(function (id) {
      var r = sb.rec[id];
      if (!r || r.del) return;
      var day = r.ymd || (r.at ? ymdOf(r.at) : '');
      if (day !== yk) return;
      if (r.st === 'ok') out.sb.push(r);
      else if (r.st === 'pending') out.sbPending++;
    });
    out.sb.sort(function (a, b) { return (a.at || 0) - (b.at || 0); });

    /* 용돈: 새 기입장(v9.moneyD) + 옛 기입장(DOC.money) */
    Object.keys(v.moneyD || {}).forEach(function (mid) {
      var day = (v.moneyD[mid] || {})[yk];
      if (!day || !day.items) return;
      day.items.forEach(function (it) {
        out.money.push({ who: mid, k: it.k, amt: Number(it.amt) || 0, t: it.t || '', at: it.at || 0 });
      });
    });
    Object.keys(D.money || {}).forEach(function (id) {
      var m = D.money[id];
      if (!m || m.d) return;
      var day = m.date || (m.at ? ymdOf(m.at) : '');
      if (day !== yk) return;
      out.money.push({
        who: m.owner || m.by, k: (m.kind === 'allow' || m.kind === 'got') ? 'got' : 'spent',
        amt: Number(m.amount) || 0, t: m.memo || '', at: m.at || 0, legacy: 1
      });
    });

    /* 가족 달력 / 할일 */
    var cal = (D.v4 && D.v4.cal) || {};
    Object.keys(cal).forEach(function (id) {
      var c = cal[id];
      if (c && !c.del && c.d === yk) out.cal.push(c);
    });
    out.cal.sort(function (a, b) { return String(a.time || '').localeCompare(String(b.time || '')); });
    var todo = (D.v4 && D.v4.todos) || {};
    out.todo = Object.keys(todo).filter(function (id) {
      var t = todo[id];
      return t && !t.del && t.at && ymdOf(t.at) === yk;
    }).map(function (id) { return todo[id]; });

    /* 기분 */
    Object.keys(v.moodHist || {}).forEach(function (id) {
      var m = v.moodHist[id];
      if (!m) return;
      var day = m.ymd || (m.at ? ymdOf(m.at) : '');
      if (day === yk) out.mood.push(m);
    });
    if (!out.mood.length) {
      Object.keys(v.mood || {}).forEach(function (mid) {
        var m = v.mood[mid];
        if (m && m.e && (m.ymd || ymdOf(m.at)) === yk) out.mood.push({ mid: mid, e: m.e, t: m.t, note: m.note, at: m.at });
      });
    }

    /* 등하교 */
    out.school = (v.school && v.school[yk]) || {};
    /* 수면 */
    Object.keys(v.sleep || {}).forEach(function (mid) {
      var s = v.sleep[mid];
      if (s && s.ymd === yk) out.sleep.push({ mid: mid, s: s });
    });

    /* 귀가 현황: 그날 스냅숏이 있으면 그것, 오늘이면 지금 상태 */
    var arc = (v.archive || {})[yk];
    if (arc && arc.status) out.status = arc.status;
    else if (yk === todayYmd()) out.status = D.status || null;
    out.archive = arc || null;

    /* 근무·출근·등교 */
    out.shift = shiftOf(yk, v);
    var cm = v.commute.su || { dows: [1, 3] };
    var dow = new Date(yk + 'T00:00:00').getDay();
    out.commute = !!(cm.dows && cm.dows.indexOf(dow) >= 0);
    out.vacation = !!(v.schoolMode && v.schoolMode.vacation);

    out.total = out.photos.length + out.diary.length + out.letters.length + out.notices.length +
      out.sb.length + out.money.length + out.cal.length + out.mood.length +
      Object.keys(out.school).length + out.chat.length;
    return out;
  }

  /* 그날 기록이 있는 날 목록(최근 21일) */
  function recentDays() {
    var out = [];
    for (var i = 0; i < 21; i++) {
      var yk = ymdOf(Date.now() - i * 86400000);
      var c = collect(yk);
      if (c.total || c.status) out.push({ yk: yk, n: c.total });
    }
    return out;
  }

  /* ---------------- 그리기 ---------------- */
  function dayLabel(yk) {
    var x = new Date(yk + 'T00:00:00');
    var t = todayYmd();
    var y = ymdOf(Date.now() - 86400000);
    var pre = yk === t ? '오늘 · ' : (yk === y ? '어제 · ' : '');
    return pre + (x.getMonth() + 1) + '월 ' + x.getDate() + '일 (' + WD()[x.getDay()] + ')';
  }
  function empty(msg) { return '<div class="hst-empty">' + msg + '</div>'; }
  function row(icon, title, body, extra) {
    return '<div class="hst-row' + (extra ? ' ' + extra : '') + '"><span class="ic">' + icon + '</span>' +
      '<span class="tx"><b>' + title + '</b>' + (body ? '<small>' + body + '</small>' : '') + '</span></div>';
  }

  function render() {
    var box = $('hstBody');
    if (!box || !ON) return;
    var yk = curYmd || todayYmd();
    var c = collect(yk);
    var D = d();
    var html = '';

    /* 그날 한눈에 */
    var chips = [];
    if (c.photos.length) chips.push('📷 사진 ' + c.photos.length);
    if (c.diary.length) chips.push('📔 일기 ' + c.diary.length);
    if (c.letters.length) chips.push('✉️ 편지 ' + c.letters.length);
    if (c.cal.length) chips.push('📅 일정 ' + c.cal.length);
    if (c.sb.length) chips.push('🏅 상벌점 ' + c.sb.length);
    if (c.money.length) chips.push('💰 용돈 ' + c.money.length);
    if (c.mood.length) chips.push('🎭 기분 ' + c.mood.length);
    html += '<div class="hst-sum">' + (chips.length ? chips.map(function (x) { return '<span>' + x + '</span>'; }).join('') : '<span class="none">이 날은 남긴 기록이 없어요</span>') + '</div>';

    /* 근무·출근·등교 */
    var sh = c.shift || { label: '–' };
    var workCls = sh.label === '근무' ? 'work' : (sh.label === '휴식' ? 'rest' : (sh.label === '휴가' ? 'vac' : ''));
    html += '<div class="hst-shift">' +
      '<span class="sg ' + workCls + '">' + esc(sh.label) + '</span>' +
      '<span class="lb">상국 근무표' + (sh.ov ? ' (직접 변경)' : '') + '</span>' +
      (c.commute ? '<span class="tag">수향 출근</span>' : '') +
      ((c.vacation ? false : Object.keys(c.school).length) ? '<span class="tag blue">아이들 등교</span>' : '') +
      (c.vacation ? '<span class="tag gray">방학</span>' : '') +
      '</div>';

    /* 일정 */
    if (c.cal.length || c.todo.length) {
      html += '<div class="hst-h">📅 그날의 일정·할일</div><div class="hst-box">';
      c.cal.forEach(function (x) {
        html += row(x.done ? '✅' : '📌', esc((x.time ? x.time + ' ' : '') + (x.t || '일정')),
          nm(x.by) + (x.memo ? ' · ' + esc(x.memo) : '') + (x.done ? ' · 완료' : ''), x.done ? 'done' : '');
      });
      c.todo.forEach(function (x) {
        html += row(x.done ? '✅' : '⬜', esc(x.t || '할일'), nm(x.by) + (x.done ? ' · 실시 완료' : ' · 남음'), x.done ? 'done' : '');
      });
      html += '</div>';
    }

    /* 사진 */
    if (c.photos.length) {
      html += '<div class="hst-h">📷 그날의 사진 ' + c.photos.length + '장</div><div class="hst-photos">';
      c.photos.forEach(function (o) {
        html += '<button type="button" class="hst-ph" data-hstphoto="' + esc(o.id) + '">' +
          (o.p.thumb ? '<img src="' + o.p.thumb + '" alt="' + esc(o.p.cap || '가족 사진') + '" loading="lazy">' : '<span class="no">📷</span>') +
          '<em>' + esc(o.p.cap || hhmm(o.p.at)) + '</em></button>';
      });
      html += '</div>';
    }

    /* 일기 */
    if (c.diary.length) {
      html += '<div class="hst-h">📔 그날의 일기</div>';
      c.diary.forEach(function (x) {
        html += '<div class="hst-note"><div class="who"><span>' + esc(x.mood || '📝') + '</span><b>' + nm(x.by) + '</b><em>' + esc(hhmm(x.at || Date.now())) + '</em></div>' +
          '<div class="txt">' + esc(x.text || '') + '</div></div>';
      });
    }

    /* 편지·공지 */
    if (c.letters.length) {
      html += '<div class="hst-h">✉️ 그날의 편지</div>';
      c.letters.forEach(function (x) {
        html += '<div class="hst-note"><div class="who"><span>✉️</span><b>' + nm(x.by) + ' → ' + (x.to === 'all' ? '가족 전체' : nm(x.to)) + '</b><em>' + esc(hhmm(x.at)) + '</em></div>' +
          '<div class="ttl">' + esc(x.title || '(제목 없음)') + '</div><div class="txt">' + esc(x.body || '') + '</div></div>';
      });
    }
    if (c.notices.length) {
      html += '<div class="hst-h">📢 그날의 공지</div>';
      c.notices.forEach(function (x) {
        html += row('📢', esc(x.text || ''), nm(x.by) + ' · ' + esc(hhmm(x.at)));
      });
    }

    /* 상벌점 */
    if (c.sb.length || c.sbPending) {
      html += '<div class="hst-h">🏅 그날의 상벌점</div><div class="hst-box">';
      c.sb.forEach(function (r) {
        var cn = (v9().sb.cat[r.cat] || {}).t || '상벌점';
        html += row(r.pts > 0 ? '🏅' : '⚠️',
          nm(r.to) + ' <b class="pt ' + (r.pts > 0 ? 'plus' : 'minus') + '">' + (r.pts > 0 ? '+' : '') + r.pts + '</b>',
          esc(cn) + (r.note ? ' · ' + esc(r.note) : '') + ' · ' + nm(r.from));
      });
      if (c.sbPending) html += row('📮', '확인 중인 잘한 일 건의 ' + c.sbPending + '건', '엄마·아빠가 확인하면 점수로 남아요');
      html += '</div>';
    }

    /* 용돈 */
    if (c.money.length) {
      var got = 0, spent = 0;
      c.money.forEach(function (m) { if (m.k === 'got') got += m.amt; else spent += m.amt; });
      html += '<div class="hst-h">💰 그날의 용돈</div><div class="hst-box">' +
        row('💵', '받은 돈 ' + won(got) + ' · 쓴 돈 ' + won(spent), '');
      c.money.forEach(function (m) {
        html += row(m.k === 'got' ? '➕' : '➖', em(m.who) + ' ' + nm(m.who) + ' · ' + esc(m.t || (m.k === 'got' ? '받음' : '씀')),
          won(m.amt) + (m.at ? ' · ' + esc(hhmm(m.at)) : ''));
      });
      html += '</div>';
    }

    /* 기분 */
    if (c.mood.length) {
      html += '<div class="hst-h">🎭 그날의 기분</div><div class="hst-moods">';
      c.mood.forEach(function (m) {
        var who = m.mid || m.by || '';
        html += '<div class="hst-mood"><span class="e">' + esc(m.e || '🙂') + '</span><b>' + nm(who) + '</b>' +
          (m.note ? '<small>' + esc(m.note) + '</small>' : '') + (m.at ? '<em>' + esc(hhmm(m.at)) + '</em>' : '') + '</div>';
      });
      html += '</div>';
    }

    /* 등하교 */
    if (Object.keys(c.school).length) {
      html += '<div class="hst-h">🎒 그날의 등하교</div><div class="hst-box">';
      Object.keys(c.school).forEach(function (kid) {
        var s = c.school[kid] || {};
        var parts = [];
        if (s.depart) parts.push('출발 ' + hhmm(s.depart));
        if (s.arrive) parts.push('등교 ' + hhmm(s.arrive));
        if (s.home) parts.push('귀가 ' + hhmm(s.home));
        html += row('🎒', em(kid) + ' ' + nm(kid), parts.length ? parts.join(' · ') : '기록 없음');
      });
      html += '</div>';
    }

    /* 귀가 현황 */
    if (c.status) {
      html += '<div class="hst-h">🏠 그날의 귀가 현황</div><div class="hst-box">';
      Object.keys(c.status).forEach(function (id) {
        var s = c.status[id] || {};
        var t = s.s === 'home' ? '🏠 집에 있음' : (s.s === 'depart' ? '🚗 출발' : (s.s === 'soon' ? '🚙 곧 도착' : (s.s === 'eta' ? '⏰ ' + (s.eta || '도착 예정') : (s.s === 'late' ? '🌙 늦어요' : (s.memo || '–')))));
        html += row(em(id), nm(id), esc(t) + (s.memo ? ' · ' + esc(s.memo) : ''));
      });
      html += '</div>';
    }

    /* 수면 */
    if (c.sleep.length) {
      html += '<div class="hst-h">😴 그날의 수면</div><div class="hst-box">';
      c.sleep.forEach(function (o) {
        var s = o.s;
        var h = (s.bedAt && s.wakeAt) ? Math.max(0, Math.round((s.wakeAt - s.bedAt) / 3600000 * 10) / 10) : null;
        html += row('😴', em(o.mid) + ' ' + nm(o.mid), h != null ? h + '시간 잠' : '기록');
      });
      html += '</div>';
    }

    /* 채팅 */
    if (c.chat.length) {
      html += '<div class="hst-h">💬 그날의 채팅 ' + c.chat.length + '개</div><div class="hst-box">';
      c.chat.slice(-6).forEach(function (m) {
        html += row(em(m.by), nm(m.by) + ' · ' + esc(hhmm(m.at)), esc(String(m.text || '').slice(0, 80)) + (m.img ? ' 📷' : ''));
      });
      if (c.chat.length > 6) html += '<div class="hst-more">… 외 ' + (c.chat.length - 6) + '개</div>';
      html += '</div>';
    }

    if (!c.total && !c.status && !chips.length) {
      html += empty('🗓️ ' + dayLabel(yk).replace(/^[^·]*· /, '') + '에는 가족이 남긴 기록이 없어요.<br>사진·일기·상벌점·용돈·일정이 생기면 이곳에 그대로 쌓여요.');
    }

    var sig = yk + '|' + html.length + '|' + c.total;
    if (box.__sig !== sig) { box.__sig = sig; box.innerHTML = html; }

    /* 날짜 표시 */
    var lbl = $('hstDateLabel');
    if (lbl) lbl.textContent = dayLabel(yk);
    var inp = $('hstDate');
    if (inp && inp.value !== yk) inp.value = yk;

    /* 최근 기록 있는 날 */
    var strip = $('hstDays');
    if (strip) {
      var days = recentDays();
      var sh2 = days.map(function (o) {
        var x = new Date(o.yk + 'T00:00:00');
        return '<button type="button" class="' + (o.yk === yk ? 'on' : '') + '" data-hstday="' + o.yk + '">' +
          (x.getMonth() + 1) + '/' + x.getDate() + '<i>' + (o.n || '·') + '</i></button>';
      }).join('');
      if (sh2 !== strip.__sig) { strip.__sig = sh2; strip.innerHTML = sh2 || '<span class="none">아직 쌓인 기록이 없어요</span>'; }
    }
  }

  function sec() {
    return '<div class="card hst-card" id="hstCard">' +
      '<div class="card-head"><h2>🗂️ 날짜별 과거 기록</h2><span class="sub" id="hstDateLabel">–</span></div>' +
      '<div class="hst-nav">' +
      '<button type="button" class="arw" data-hstmove="-1" aria-label="전날">‹</button>' +
      '<input class="field" id="hstDate" type="date">' +
      '<button type="button" class="arw" data-hstmove="1" aria-label="다음날">›</button>' +
      '<button type="button" class="today" data-hsttoday="1">오늘</button>' +
      '</div>' +
      '<div class="hst-days" id="hstDays"></div>' +
      '<div id="hstBody"></div>' +
      '</div>';
  }

  function setDate(yk) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(yk || ''))) return;
    curYmd = yk;
    var box = $('hstBody');
    if (box) box.__sig = null;
    render();
  }

  function wire() {
    document.addEventListener('click', function (e) {
      var mv = e.target.closest('[data-hstmove]');
      if (mv) {
        var delta = Number(mv.getAttribute('data-hstmove')) || 0;
        var base = (curYmd || todayYmd()) + 'T00:00:00';
        var t = new Date(base);
        t.setDate(t.getDate() + delta);
        setDate(t.getFullYear() + '-' + p2(t.getMonth() + 1) + '-' + p2(t.getDate()));
        return;
      }
      if (e.target.closest('[data-hsttoday]')) { setDate(todayYmd()); return; }
      var dd = e.target.closest('[data-hstday]');
      if (dd) { setDate(dd.getAttribute('data-hstday')); return; }
      var ph = e.target.closest('[data-hstphoto]');
      if (ph && F && F.openPhoto) { try { F.openPhoto(ph.getAttribute('data-hstphoto')); } catch (err) { } }
    });
    document.addEventListener('change', function (e) {
      if (e.target && e.target.id === 'hstDate') setDate(e.target.value);
    });
  }

  var prevRender = global.__FAM_RENDER;
  global.__FAM_RENDER = function () {
    if (prevRender) { try { prevRender(); } catch (e) { } }
    if (!ON) return;
    try { if (!curYmd) curYmd = todayYmd(); if ($('hstBody')) render(); } catch (e) { console.warn('HIST render', e); }
  };
  var prevView = global.__FAM_VIEW;
  global.__FAM_VIEW = function (v) {
    if (prevView) { try { prevView(v); } catch (e) { } }
    if (v === 'record' && ON) { try { render(); } catch (e) { } }
  };

  function mount(FAM) {
    if (ON) return;
    F = FAM; ON = true;
    if (!curYmd) curYmd = todayYmd();
    wire();
    render();
  }
  setInterval(function () {
    if (!ON && global.FAM && global.FAM.doc && global.FAM.doc() && global.FAM.me && global.FAM.me()) mount(global.FAM);
  }, 1600);

  global.FAMHIST = {
    sec: sec,
    render: render,
    setDate: setDate,
    go: function (yk) { setDate(yk || todayYmd()); },
    shiftOf: shiftOf,
    collect: collect,
    today: todayYmd
  };
})(window);
