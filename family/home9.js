/* ============================================================
   우리가족포털 V9 · 홈 대개편 (home9.js)
   ① 📖 오늘의 명언 & 가족끼리 주고받으면 좋은 말 (날짜 시드 · DB 오버라이드 · 원클릭 전송)
   ② 📷 1일 1장 대표사진 (선택·업로드 · AI 베스트컷 추천 · 확대 모달 · Blob 저장)
   ③ 🗓️ 통합 근무표·등교표 배너 (상국 4주 교대 · 수향 출근일 · 지섭·지율 등교일)
   ④ 🎂 가족 디데이 (지섭 2013-10-10 · 지율 2015-08-26 · D+ / 생일 카운트다운 · 추가 가능)
   ⑤ 📰 학생·공부·학원·게임 뉴스 배너 5종 (RSS + 스냅숏 폴백)
   ⑥ 🎡 이번 주말 추천 + 주변 장소 검색 (네이버·카카오맵 연결)
   ⑦ 🎯 개인별 목표 배너 (이번 주 · 이번 달 · 장래희망 + 응원)
   ⑧ 😴 수면시간·피로도·에너지 (원터치 취침/기상 + 자동 추정 → 다마고치 컨디션 연동)
   ⑨ 🎒 등교·귀가 안심 기록 (원터치 + 위치 자동 판정)
   ⑩ 🪄 홈 공동 꾸미기 + 수정 이력 영구 기록
   ⑪ 💚 미쁠 AI 도우미 (초록 ㅅ 캐릭터 · Gemini · 우측 하단 플로팅)
   ============================================================ */
(function (global) {
  'use strict';

  var F = null, ON = false;
  var LS_NEWS = 'sgf9_news_v1', LS_SESS = 'sgf9_sess_v1';

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
  function count(o) { return Object.keys(o || {}).length; }
  function memName(id) { var m = F && F.memOf(id); return m && m.name ? m.name : '가족'; }
  function memEmoji(id) { var m = F && F.memOf(id); return (m && m.emoji) || '🧑'; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function V9() {
    var D = d();
    if (!D) return null;
    if (!D.v9 || typeof D.v9 !== 'object') D.v9 = {};
    var v = D.v9;
    ['tama', 'room', 'minicar', 'moneyD', 'ddays', 'school', 'goals', 'sleep', 'layout', 'editLog', 'pod', 'archive', 'commute', 'schoolMode', 'dailyQuote', 'goalCheer', 'sb', 'mood', 'moodHist'].forEach(function (k) {
      if (!v[k] || typeof v[k] !== 'object') v[k] = {};
    });
    return v;
  }
  function logEdit(action, detail) {
    var v = V9();
    if (!v || !me()) return;
    var id = 'e' + now().toString(36) + Math.random().toString(36).slice(2, 5);
    v.editLog[id] = { by: mid(), at: now(), action: action, detail: detail || '' };
    save();
  }

  /* ============================================================
     ① 오늘의 명언 & 가족 한마디
     ============================================================ */
  var QUOTES = [
    { t: '길을 아는 것과 그 길을 걷는 것은 다르다.', by: '성군', src: '《직지》' },
    { t: '노력은 배신하지 않는다. 다만 때때로 늦게 답한다.', by: '속담', src: '한국' },
    { t: '작은 일에 충실하라. 그것이 큰 일의 씨앗이다.', by: '괴테', src: '독일' },
    { t: '포기하지 않는 한 실패는 없다.', by: '마크 트웨인', src: '미국' },
    { t: '가족은 서로의 안식처다.', by: '레슬리 파 스트레이트', src: '《가족의 미래》' },
    { t: '오늘 걸어온 길 위에 내일의 내가 있다.', by: '이윤복', src: '《시, 그 가까운 안부》' },
    { t: '빨리 가려면 혼자 가고, 멀리 가려면 함께 가라.', by: '아프리카 속담', src: '아프리카' },
    { t: '행복은 가진 것이 아니라 함께 나누는 것이다.', by: '헬렌 켈러', src: '미국' },
    { t: '공부는 마음의 양식이다.', by: '키케로', src: '로마' },
    { t: '끝까지 해내는 사람이 결국 이긴다.', by: '윌리엄 페인', src: '영국' },
    { t: '아이들은 교육받는 존재가 아니라 존중받는 존재다.', by: '한국교육개발원', src: '교육 선언문' },
    { t: '열심히 살면 하늘도 도와준다.', by: '명심보감', src: '중국' },
    { t: '웃는 얼굴은 집 안의 햇살이다.', by: '빅터 보르게', src: '스웨덴' },
    { t: '시간은 공평하다. 쓰는 방법이 다를 뿐이다.', by: 'H. 잭슨 브라운', src: '미국' },
    { t: '지금 흘리는 땀방울은 내일의 꽃이 된다.', by: '이소룡', src: '홍콩' },
    { t: '잘하고 싶은 마음이 가장 좋은 선생님이다.', by: '피카소', src: '스페인' },
    { t: '용기는 무서워도 한 걸음 내딛는 것이다.', by: '넬슨 만델라', src: '남아공' },
    { t: '가장 위대한 영광은 실패에서 다시 일어서는 것이다.', by: '공자', src: '중국' },
    { t: '가족의 말 한마디가 평생의 힘이 된다.', by: '리 처스트', src: '《우리 아이 행복한 말》' },
    { t: '오늘의 나무를 심을 가장 좋은 때는 20년 전이었고, 두 번째는 지금이다.', by: '중국 격언', src: '중국' },
    { t: '읽는 아이와 걷는 아이가 세상을 바꾼다.', by: '에밀 파울리', src: '독일' },
    { t: '작은 성공을 크게 기뻐하는 가족이 큰 성공을 이룬다.', by: '셀레나 콜먼', src: '《긍정의 가족》' },
    { t: '진짜 힘은 다정함에서 나온다.', by: '마하트마 간디', src: '인도' },
    { t: '오늘 하루도 서로 고마웠다고 말하라.', by: '에피쿠로스', src: '그리스' },
    { t: '습관이 인격이 되고 인격이 운명이 된다.', by: '존 드라이든', src: '영국' },
    { t: '가족이 함께 먹는 밥이 세상에서 제일 맛있다.', by: '한국 격언', src: '한국' },
    { t: '꿈을 꾸는 사람이 결국 꿈을 이룬다.', by: '월트 디즈니', src: '미국' },
    { t: '몸은 하나지만 둘 이상이 함께하면 힘은 배가 된다.', by: '전도서', src: '성경' },
    { t: '지혜는 아는 것이 아니라 사는 것이다.', by: '아리스토텔레스', src: '그리스' },
    { t: '아이의 첫 번째 학교는 집이고 첫 번째 선생님은 부모다.', by: '아일리나 콜', src: '미국' },
    { t: '오늘도 수고했다는 말이 세상에서 가장 좋은 보약이다.', by: '한국 격언', src: '한국' }
  ];
  var FAM_SAYS = [
    { from: '아빠·엄마 → 아이', t: '오늘도 멋지게 보냈네? 내일은 더 재미있는 일이 기다릴 거야.' },
    { from: '아빠·엄마 → 아이', t: '너를 그저 그런 게 아니라 정말 자랑스러워.' },
    { from: '아빠·엄마 → 아이', t: '힘든 일 있으면 언제든 말해. 우리는 항상 네 편이야.' },
    { from: '아빠·엄마 → 아이', t: '결보다 과정을 자랑스러워해. 오늘 열심히 한 게 보여.' },
    { from: '아빠·엄마 → 아이', t: '사랑해. 오늘 하루도 안전하고 즐겁게!' },
    { from: '아이 → 아빠·엄마', t: '오늘도 고생하셨어요. 맛있는 거 드시고 푹 쉬세요.' },
    { from: '아이 → 아빠·엄마', t: '걱정 마세요, 저 잘하고 있어요. 사랑해요!' },
    { from: '아이 → 아빠·엄마', t: '오늘 학교에서 좋은 일 있었는데, 집 가서 들려줄게요.' },
    { from: '형제끼리', t: '오늘 게임 한 판 붙자! 지는 사람 간식 사기야.' },
    { from: '형제끼리', t: '오빠 형 하는 거 진짜 잘해. 오늘도 배웠어.' },
    { from: '부부', t: '오늘 하루도 고마워요. 저녁은 제가 챙길게요.' },
    { from: '부부', t: '우리 가족 덕분에 하루하루가 보물이에요.' },
    { from: '가족 모두', t: '오늘 저녁 다 같이 맛있는 거 먹고 산책 어때요?' },
    { from: '가족 모두', t: '주말에 다 같이 다녀오고 싶은 곳 하나씩 말해요!' }
  ];
  function daySeed() {
    var t = todayYmd();
    var n = Number(t.slice(0, 4) + t.slice(5, 7) + t.slice(8, 10));
    return n;
  }
  function pickSeeded(arr, salt) {
    var s = String(daySeed() + (salt || 0));
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return arr[h % arr.length];
  }
  function quoteOfToday(v) {
    var yk = todayYmd();
    var ov = v.dailyQuote[yk];
    if (ov && ov.quote && ov.quote.text) return ov.quote;
    var x = pickSeeded(QUOTES, 1);
    return { text: x.t || '', by: x.by || '', src: x.src || '' };
  }
  function famSayOfToday(v) {
    var yk = todayYmd();
    var ov = v.dailyQuote[yk];
    if (ov && ov.fam && ov.fam.text) return ov.fam;
    var x = pickSeeded(FAM_SAYS, 2);
    return { text: x.t || '', from: x.from || '' };
  }
  function renderQuote() {
    var v = V9(), card = $('v9QuoteCard');
    if (!v || !card) return;
    var q = quoteOfToday(v), fs = famSayOfToday(v);
    var html =
      '<div class="q9">' +
      '<div class="q9-row"><span class="q9-ico">📖</span><div class="q9-body"><b>"' + esc(q.text) + '"</b>' +
      '<small>— ' + esc(q.by || '이름 없음') + (q.src ? ' · ' + esc(q.src) : '') + '</small></div></div>' +
      '<div class="q9-row"><span class="q9-ico">💌</span><div class="q9-body"><b>' + esc(fs.text) + '</b>' +
      '<small>오늘 가족에게 주고받으면 좋은 말 · ' + esc(fs.from || '') + '</small></div></div>' +
      '<div class="q9-acts">' +
      '<button type="button" class="btn soft" id="q9ToCheer" style="padding:9px 12px;font-size:12.5px">💬 응원으로 보내기</button>' +
      '<button type="button" class="btn soft" id="q9ToChat" style="padding:9px 12px;font-size:12.5px">📨 채팅으로 보내기</button>' +
      (global.FAM9AI && global.FAM9AI.key() ? '<button type="button" class="btn ghost" id="q9AiNew" style="padding:9px 12px;font-size:12.5px">💚 미쁠에게 새 추천 받기</button>' : '') +
      '</div></div>';
    if (card.__sig !== html) { card.__sig = html; $('v9QuoteBody').innerHTML = html; }
  }
  function wireQuote() {
    document.addEventListener('click', function (e) {
      var v = V9();
      if (!v) return;
      var c = e.target.closest('#q9ToCheer');
      if (c) {
        var fs = famSayOfToday(v), q = quoteOfToday(v);
        var inp = $('cheerInput');
        if (inp) {
          inp.value = '💌 ' + fs.text;
          var btn = $('btnCheer');
          if (btn) btn.click();
        } else { toast('응원 한마디 화면에서 보내 주세요'); }
        return;
      }
      var ch = e.target.closest('#q9ToChat');
      if (ch) {
        var fs2 = famSayOfToday(v), q2 = quoteOfToday(v);
        var inp2 = $('homeChatInput');
        if (inp2) {
          inp2.value = '📖 "' + q2.text + '" — ' + (q2.by || '') + ' / 💌 ' + fs2.text;
          inp2.focus();
          var send = $('homeChatSend');
          if (send) send.click();
        }
        return;
      }
      var ai = e.target.closest('#q9AiNew');
      if (ai) {
        if (!global.FAM9AI) return;
        toast('💚 미쁠이 오늘의 새 말을 고르는 중…');
        global.FAM9AI.ask(
          '우리 가족(아빠 상국·엄마 수향·중학생 지섭·지율이)에게 오늘 보여줄 문구를 JSON으로 만들어줘. ' +
          '형식: {"quote":{"text":"명언 한 문장","by":"이름","src":"출전"},"fam":{"text":"가족끼리 주고받으면 좋은 따뜻한 한마디","from":"누구에게나"}}. ' +
          '명언은 유명하고 검증된 것, 가족 말은 아이들이 이해하기 쉽고 밝은 톤으로. 다른 설명 없이 JSON만.'
        ).then(function (txt) {
          var m = String(txt).match(/\{[\s\S]*\}/);
          if (!m) throw new Error('bad');
          var j = JSON.parse(m[0]);
          var v3 = V9();
          var yk = todayYmd();
          v3.dailyQuote[yk] = { quote: j.quote, fam: j.fam, by: mid(), at: now() };
          save();
          var card = $('v9QuoteCard');
          if (card) card.__sig = null;
          renderQuote();
          toast('💚 미쁠이 오늘의 문구를 새로 담았어요');
        }).catch(function () { toast('추천을 받지 못했어요 — 잠시 후 다시'); });
      }
    });
  }

  /* ============================================================
     ② 1일 1장 대표사진
     ============================================================ */
  function photoList() {
    var D = d();
    if (!D || !D.photos) return [];
    return Object.keys(D.photos).filter(function (k) { return D.photos[k] && !D.photos[k].d && D.photos[k].thumb; })
      .map(function (k) { var p = D.photos[k]; return { id: k, thumb: p.thumb, cap: p.cap || '', likes: count(p.likes), by: p.by || '', at: p.at || 0 }; })
      .sort(function (a, b) { return b.at - a.at; });
  }
  function renderPod() {
    var v = V9(), body = $('v9PodBody');
    if (!v || !body) return;
    var yk = todayYmd();
    var rec = v.pod[yk];
    var list = photoList();
    /* 폴백: 기록 없으면 좋아요 최다 → 최신 */
    if (!rec) {
      if (list.length) {
        var best = list.slice().sort(function (a, b) { return b.likes - a.likes || b.at - a.at; })[0];
        rec = v.pod[yk] = { pid: best.id, auto: 1, at: now() };
        save();
      }
    }
    var html;
    if (rec && (rec.pid || rec.thumb)) {
      var p = rec.thumb ? { thumb: rec.thumb } : list.filter(function (x) { return x.id === rec.pid; })[0] || null;
      html = '<div class="pod9">' +
        '<div class="pod9-ph" data-v9pod="' + esc(rec.pid || '') + '">' + (p ? '<img src="' + esc(p.thumb || rec.thumb) + '" alt="오늘의 대표사진" loading="lazy">' : '📷') + '</div>' +
        '<div class="pod9-cap"><b>⭐ 오늘의 대표사진</b>' + '<small>' + (rec.ai ? '💚 미쁠이 골랐어요' : (rec.auto ? '좋아요 최다 자동 선정' : memEmoji(rec.by) + ' ' + esc(memName(rec.by)) + ' 님이 선정')) + '</small></div></div>';
    } else {
      html = '<div class="pod9 empty"><div class="pod9-ph">📷</div><div class="pod9-cap"><b>오늘의 대표사진</b><small>사진을 올리고 오늘의 한 장을 골라 보세요</small></div></div>';
    }
    html += '<div style="display:flex;gap:7px;margin-top:9px">' +
      '<button type="button" class="btn soft" id="v9PodPick" style="flex:1;padding:10px;font-size:13px">🖼️ 오늘의 한 장 고르기</button>' +
      '<button type="button" class="btn soft" id="v9PodUp" style="flex:1;padding:10px;font-size:13px">📷 새 사진 올리기</button>' +
      '<button type="button" class="btn ghost" id="v9PodAi" style="flex:1;padding:10px;font-size:13px">💚 미쁠 추천</button></div>';
    if (body.__sig !== rec && body.__sig !== (rec && rec.pid)) { body.__sig = rec && rec.pid; body.innerHTML = html; }
    else if (!body.__sig) { body.__sig = rec && rec.pid; body.innerHTML = html; }
  }
  function podPickSheet() {
    var list = photoList();
    var v = V9();
    F.openSheet('<h3>🖼️ 오늘의 대표사진 고르기</h3><div class="sdesc">최근 가족 사진 중 오늘의 한 장을 골라 홈에 크게 걸어요.</div>' +
      '<div class="pod9-grid">' + (list.length ? list.slice(0, 12).map(function (p) {
        return '<button type="button" class="pod9-cell" data-v9podpick="' + esc(p.id) + '"><img src="' + esc(p.thumb) + '" alt="" loading="lazy"></button>';
      }).join('') : '<div class="v4-empty">아직 사진이 없어요 — 먼저 올려 주세요</div>') + '</div>' +
      '<button type="button" class="btn ghost" data-sheet-close style="margin-top:10px">닫기</button>');
  }
  function wirePod() {
    document.addEventListener('click', function (e) {
      var v = V9();
      if (!v) return;
      var pick = e.target.closest('#v9PodPick');
      if (pick) { podPickSheet(); return; }
      var cell = e.target.closest('[data-v9podpick]');
      if (cell) {
        var yk = todayYmd();
        var v2 = V9();
        v2.pod[yk] = { pid: cell.getAttribute('data-v9podpick'), by: mid(), at: now() };
        save();
        logEdit('1일 1장 대표사진 선정', yk);
        F.closeSheet();
        $('v9PodBody').__sig = null;
        renderPod();
        toast('⭐ 오늘의 대표사진을 바꿨어요');
        return;
      }
      var up = e.target.closest('#v9PodUp');
      if (up) {
        F.pickImages(function (files) {
          F.saveMedia(files[0]).then(function (m) {
            var yk = todayYmd();
            var v2 = V9();
            v2.pod[yk] = { thumb: m.thumb, mediaId: m.id, by: mid(), at: now() };
            save();
            $('v9PodBody').__sig = null;
            renderPod();
            toast('📷 새 사진을 오늘의 한 장으로 올렸어요');
          }).catch(function () { toast('사진 올리기를 실패했어요'); });
        }, true);
        return;
      }
      var ai = e.target.closest('#v9PodAi');
      if (ai) {
        if (!global.FAM9AI || !global.FAM9AI.key()) { global.FAM9AI.keySheet('미쁠 베스트컷 추천', '오늘 올라온 가족 사진 중 가장 좋은 한 장을 미쁠이 골라 줘요.', function () { wirePod(); }); return; }
        var list = photoList();
        if (!list.length) { toast('먼저 사진을 올려 주세요'); return; }
        toast('💚 미쁠이 베스트컷을 고르는 중…');
        var parts = list.slice(0, 6).map(function (p) { return p.thumb; });
        global.FAM9AI.ask(
          '가족 사진이 순서대로 ' + parts.length + '장 들어 있어요. 오늘의 대표 베스트컷을 1장만 골라줘. 기준: 표정·구도·빛. 답은 "1부터 ' + parts.length + '까지 숫자 하나"만.',
          { images: parts }
        ).then(function (txt) {
          var n = clamp(parseInt(String(txt).replace(/[^0-9]/g, ''), 10) || 1, 1, parts.length);
          var chosen = list[n - 1];
          var yk = todayYmd();
          var v2 = V9();
          v2.pod[yk] = { pid: chosen.id, ai: 1, by: mid(), at: now() };
          save();
          $('v9PodBody').__sig = null;
          renderPod();
          toast('💚 미쁠이 ' + n + '번 사진을 골랐어요');
        }).catch(function () { toast('미쁠 추천 실패 — 좋아요 기준으로 자동 선정했어요'); });
        return;
      }
      var open = e.target.closest('[data-v9pod]');
      if (open) {
        var pid = open.getAttribute('data-v9pod');
        if (pid && F.openPhoto) F.openPhoto(pid);   /* 확대 모달 + Blob 저장(기존 모달 재사용) */
        else toast('사진을 열 수 없어요');
        return;
      }
    });
  }

  /* ============================================================
     ③ 통합 근무표·등교표 배너
     ============================================================ */
  var SHIFT_ANCHOR = new Date(2026, 10, 16);
  function shiftBase(dt) {
    var diff = Math.round((dt - SHIFT_ANCHOR) / 86400000);
    var idx = ((diff % 28) + 28) % 28;
    if (idx < 4) return { isWork: true, label: '근무' };
    if (idx < 9) return { isWork: false, label: '휴식' };
    if (idx < 14) return { isWork: true, label: '근무' };
    if (idx < 18) return { isWork: false, label: '휴식' };
    if (idx < 23) return { isWork: true, label: '근무' };
    return { isWork: false, label: '휴식' };
  }
  function shiftOf(dt) {
    var key = ymd(dt.getTime());
    var ov = null;
    try {
      var o = JSON.parse(localStorage.getItem('sg_shift_overrides_v1') || '{}');
      var val = o[key];
      if (val) ov = (typeof val === 'string') ? val : val.type;
    } catch (e) {}
    var base = shiftBase(dt);
    if (ov === 'work') return { isWork: true, label: '근무', ov: 1 };
    if (ov === 'rest') return { isWork: false, label: '휴식', ov: 1 };
    if (ov === 'vacation') return { isWork: false, label: '휴가', ov: 1 };
    return { isWork: base.isWork, label: base.label };
  }
  function renderShift() {
    var v = V9(), box = $('v9ShiftStrip');
    if (!v || !box) return;
    var commute = v.commute.su || { dows: [1, 3] };   /* 수향 출근 요일(0=일) */
    var vacation = v.schoolMode && v.schoolMode.vacation;
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var wd = ['일', '월', '화', '수', '목', '금', '토'];
    var html = '';
    for (var i = 0; i < 14; i++) {
      var dt = new Date(today.getTime() + i * 86400000);
      var sh = shiftOf(dt);
      var dow = dt.getDay();
      var su = commute.dows && commute.dows.indexOf(dow) >= 0;
      var school = !vacation && dow >= 1 && dow <= 5;
      html += '<div class="sh9-cell' + (i === 0 ? ' today' : '') + '">' +
        '<span class="d">' + (dt.getMonth() + 1) + '/' + dt.getDate() + '</span>' +
        '<span class="w">' + wd[dow] + '</span>' +
        '<span class="sg ' + (sh.isWork ? 'work' : (sh.label === '휴가' ? 'vac' : 'rest')) + '">' + sh.label + '</span>' +
        (su ? '<span class="su">출근</span>' : '') +
        (school ? '<span class="sc">등교</span>' : (vacation && dow >= 1 && dow <= 5 ? '<span class="sc off">방학</span>' : '')) +
        '</div>';
    }
    if (box.__sig !== html) { box.__sig = html; box.innerHTML = html; }
    var note = $('v9ShiftNote');
    if (note) {
      var n2 = '빨강=상국 근무 · 주황=수향 출근 · 파랑=지섭·지율 등교' + (vacation ? ' · 방학 중' : '');
      if (note.textContent !== n2) note.textContent = n2;
    }
  }
  function wireShift() {
    document.addEventListener('click', function (e) {
      var v = V9();
      if (!v) return;
      var ed = e.target.closest('#v9ShiftEdit');
      if (ed) {
        var c = v.commute.su || { dows: [1, 3] };
        F.openSheet('<h3>🗓️ 수향 출근일 · 등교일 설정</h3>' +
          '<div class="sdesc">수향 출근 요일과 아이들 등교(방학) 여부를 정해요. 상국 근무표는 상국포털의 4주 규칙·날짜별 변동을 그대로 따라요.</div>' +
          '<div class="form-row"><label>수향 출근 요일</label><div class="dow-grid" id="v9Dow">' +
          ['일', '월', '화', '수', '목', '금', '토'].map(function (w, i) {
            return '<button type="button" class="dow' + (c.dows && c.dows.indexOf(i) >= 0 ? ' on' : '') + '" data-v9dow="' + i + '">' + w + '</button>';
          }).join('') + '</div></div>' +
          '<div class="form-row"><label>아이들 학교</label><button type="button" class="btn ghost" id="v9VacToggle">' + (v.schoolMode.vacation ? '🏫 방학 중 (등교 표시 끔) — 눌러서 등교로' : '🎒 등교 중 — 눌러서 방학으로') + '</button></div>' +
          '<button type="button" class="btn" data-sheet-close style="margin-top:6px">저장하고 닫기</button>');
        var sheet = $('sheet');
        sheet.addEventListener('click', function h(ev) {
          var dw = ev.target.closest('[data-v9dow]');
          if (dw) {
            var i = Number(dw.getAttribute('data-v9dow'));
            c.dows = c.dows || [];
            var ix = c.dows.indexOf(i);
            if (ix >= 0) c.dows.splice(ix, 1); else c.dows.push(i);
            dw.classList.toggle('on');
            return;
          }
          var vt = ev.target.closest('#v9VacToggle');
          if (vt) {
            v.schoolMode.vacation = !v.schoolMode.vacation;
            vt.textContent = v.schoolMode.vacation ? '🏫 방학 중 (등교 표시 끔) — 눌러서 등교로' : '🎒 등교 중 — 눌러서 방학으로';
            return;
          }
        });
        var closeObs = new MutationObserver(function () {
          if ($('sheet').classList.contains('hidden')) {
            v.commute.su = c;
            v.commute.at = now();
            save();
            logEdit('근무표·출근일·등교일 수정', '수향 출근: ' + (c.dows || []).join(',') + ' · 방학: ' + (v.schoolMode.vacation ? '예' : '아니오'));
            box_sig_reset_shift();
            sheet.removeEventListener('click', h);
            closeObs.disconnect();
          }
        });
        closeObs.observe($('sheet'), { attributes: true, attributeFilter: ['class'] });
      }
    });
  }
  function box_sig_reset_shift() { var b = $('v9ShiftStrip'); if (b) b.__sig = null; }

  /* ============================================================
     ④ 가족 디데이
     ============================================================ */
  var BIRTHS = { jiseop: '2013-10-10', jiyul: '2015-08-26' };
  function ddays() {
    var v = V9();
    if (!v) return [];
    var out = [
      { id: 'jiseop', t: '지섭', d: BIRTHS.jiseop },
      { id: 'jiyul', t: '지율', d: BIRTHS.jiyul }
    ];
    Object.keys(v.ddays).forEach(function (k) {
      var it = v.ddays[k];
      if (it && !it.del) out.push({ id: k, t: it.t, d: it.d, custom: 1 });
    });
    return out;
  }
  function dParts(ds) {
    var p = ds.split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }
  function renderDday() {
    var v = V9(), box = $('v9DdayBody');
    if (!v || !box) return;
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var html = ddays().map(function (x) {
      var bd = dParts(x.d);
      var days = Math.round((today - bd) / 86400000);
      var next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
      if (next < today) next = new Date(today.getFullYear() + 1, bd.getMonth(), bd.getDate());
      var toB = Math.round((next - today) / 86400000);
      return '<div class="dd9' + (x.custom ? ' custom' : '') + '"><b>🎂 ' + esc(x.t) + '</b>' +
        '<span>D+' + days.toLocaleString('ko-KR') + '째</span>' +
        '<span class="bb">' + (toB === 0 ? '🎉 오늘 생일!' : '생일 D-' + toB) + '</span>' +
        (x.custom ? '<button type="button" class="dd9-del" data-v9ddel="' + esc(x.id) + '">✕</button>' : '') +
        '</div>';
    }).join('');
    if (box.__sig !== html) { box.__sig = html; box.innerHTML = html; }
  }
  function wireDday() {
    document.addEventListener('click', function (e) {
      var v = V9();
      if (!v) return;
      var add = e.target.closest('#v9DdayAdd');
      if (add) {
        F.openSheet('<h3>🎂 디데이 추가</h3>' +
          '<div class="form-row"><label>이름</label><input class="field" id="v9DdT" maxlength="16" placeholder="예: 입대일, 졸업식"></div>' +
          '<div class="form-row"><label>기준 날짜</label><input class="field" id="v9DdD" type="date"></div>' +
          '<div style="display:flex;gap:8px;margin-top:6px"><button type="button" class="btn ghost" data-sheet-close>취소</button><button type="button" class="btn" id="v9DdSave">추가</button></div>');
        $('v9DdSave').onclick = function () {
          var t = ($('v9DdT').value || '').trim(), dd = $('v9DdD').value;
          if (!t || !dd) { toast('이름·날짜를 적어 주세요'); return; }
          var v2 = V9();
          var id = 'd' + now().toString(36);
          v2.ddays[id] = { t: t, d: dd, by: mid(), at: now() };
          save();
          F.closeSheet();
          $('v9DdayBody').__sig = null;
          renderDday();
          toast('디데이를 추가했어요');
        };
        return;
      }
      var del = e.target.closest('[data-v9ddel]');
      if (del) {
        var id = del.getAttribute('data-v9ddel');
        var v2 = V9();
        if (v2.ddays[id]) { v2.ddays[id].del = 1; v2.ddays[id].at = now(); save(); $('v9DdayBody').__sig = null; renderDday(); }
      }
    });
  }

  /* ============================================================
     ⑤ 학생·공부·학원·게임 뉴스 배너 5종
     ============================================================ */
  var NEWS_SECTIONS = [
    { id: 'study', e: '🎓', n: '공부 계획·학습법', q: '초등 중학생 학습 계획 공부법 뉴스', fb: { t: '우리 아이 학습 계획 세우기', u: 'https://www.moe.go.kr/' } },
    { id: 'trip', e: '🚌', n: '소풍·체험·교육과정', q: '초등학교 체험학습 소풍 교육과정 뉴스', fb: { t: '체험학습·소풍 소식', u: 'https://www.moe.go.kr/' } },
    { id: 'suneung', e: '📝', n: '수능·시험', q: '수능 일정 시험 제도 뉴스', fb: { t: '수능·시험 일정', u: 'https://www.suneung.re.kr/' } },
    { id: 'edu', e: '🧒', n: '아이 학습·교육', q: '초등 교육 학원 제도 뉴스', fb: { t: '교육·학원 뉴스', u: 'https://www.moe.go.kr/' } },
    { id: 'game', e: '🎮', n: '아이·게임', q: '아이들 게임 게임제도 뉴스', fb: { t: '게임 소식', u: 'https://www.game.or.kr/' } }
  ];
  function newsCache() { try { return JSON.parse(localStorage.getItem(LS_NEWS) || '{}'); } catch (e) { return {}; } }
  function newsCacheSet(o) { try { localStorage.setItem(LS_NEWS, JSON.stringify(o)); } catch (e) {} }
  function renderNews() {
    var box = $('v9NewsBody');
    if (!box) return;
    var cache = newsCache();
    var html = NEWS_SECTIONS.map(function (s) {
      var items = (cache[s.id] || []);
      var inner;
      if (items.length) {
        inner = items.slice(0, 2).map(function (it) {
          return '<a class="nw9-item" href="' + esc(it.u) + '" target="_blank" rel="noopener"><span class="t">' + esc(it.t) + '</span><span class="w">' + esc(it.w || '') + '</span></a>';
        }).join('');
      } else {
        inner = '<a class="nw9-item fb" href="' + esc(s.fb.u) + '" target="_blank" rel="noopener"><span class="t">' + esc(s.fb.t) + '</span><span class="w">바로 열기</span></a>';
      }
      return '<div class="nw9"><div class="nw9-h">' + s.e + ' ' + s.n + '</div>' + inner + '</div>';
    }).join('');
    if (box.__sig !== html) { box.__sig = html; box.innerHTML = html; }
  }
  function parseRss(xmlText) {
    var doc = new DOMParser().parseFromString(xmlText, 'text/xml');
    var items = Array.prototype.slice.call(doc.querySelectorAll('item')).slice(0, 2);
    return items.map(function (it) {
      var t = (it.querySelector('title') || {}).textContent || '';
      var l = (it.querySelector('link') || {}).textContent || '';
      var d = (it.querySelector('pubDate') || {}).textContent || '';
      var w = '';
      try { w = new Date(d).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }); } catch (e) {}
      return { t: t.replace(/ - [\가-힣\s]+뉴스.*$/, '').slice(0, 70), u: l, w: w };
    }).filter(function (x) { return x.t && x.u; });
  }
  function fetchNews() {
    var cache = newsCache();
    var at = cache.at || 0;
    if (now() - at < 30 * 60000) return;
    NEWS_SECTIONS.forEach(function (s) {
      var feed = 'https://news.google.com/rss/search?q=' + encodeURIComponent(s.q) + '&hl=ko&gl=KR&ceid=KR:ko';
      fetch('https://r.jina.ai/' + feed, { cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
        .then(function (txt) {
          var items = parseRss(txt);
          if (!items.length) throw new Error('empty');
          cache[s.id] = items;
          cache.at = now();
          newsCacheSet(cache);
          box_sig_reset_news();
          renderNews();
        })
        .catch(function () { /* 폴백 유지 */ });
    });
  }
  function box_sig_reset_news() { var b = $('v9NewsBody'); if (b) b.__sig = null; }

  /* ============================================================
     ⑥ 이번 주말 추천 + 주변 장소 검색
     ============================================================ */
  var WEEKEND = [
    { do: [{ t: '감악산 등산 + 맑은 공기 산책', q: '파주 감악산 등산' }, { t: '헤이리 예술마을 산책·전시', q: '파주 헤이리 마을' }], eat: [{ t: '파주식 당면찌개·버섯전골', q: '파주 당면찌개 맛집' }, { t: '다율동 국수·칼국수', q: '파주 다율동 국수' }] },
    { do: [{ t: '프로방스 마을 사진 산책', q: '파주 프로방스 마을' }, { t: '우리 농산물 장보기·삼겹 바베큐', q: '파주 농산물 직거래 장터' }], eat: [{ t: '집에서 피자·수제버거 데이', q: '홈메이드 피자 레시피' }, { t: '숯불 갈비·한판 구이', q: '파주 숯불 갈비 맛집' }] },
    { do: [{ t: '운정중앙공원 자전거·피크닉', q: '파주 운정중앙공원' }, { t: '영화관 한 편 + 팝콘', q: '파주 영화관 상영작' }], eat: [{ t: '족발·보쌈 주말 특식', q: '파주 족발 맛집' }, { t: '떡볶이·튀김 나들이', q: '파주 분식 맛집' }] },
    { do: [{ t: '라라스포츠 수영·헬스 가족 배찌', q: '파주 체육관 수영장' }, { t: '보드게임 카페 오후', q: '파주 보드게임 카페' }], eat: [{ t: '마라탕·훠궈 도전', q: '파주 마라탕 훠궈' }, { t: '초콜릿 카페 브런치', q: '파주 브런치 카페' }] }
  ];
  function weekIdx() {
    var t = new Date();
    var start = new Date(t.getFullYear(), 0, 1);
    var wk = Math.floor((t - start) / (7 * 86400000));
    return wk;
  }
  function mapLinks(q) {
    var e = encodeURIComponent(q);
    return { n: 'https://map.naver.com/p/search/' + e, k: 'https://map.kakao.com/link/search/' + e };
  }
  function renderWeekend() {
    var box = $('v9WkBody');
    if (!box) return;
    var w = WEEKEND[weekIdx() % WEEKEND.length];
    function item(x) {
      var l = mapLinks(x.q);
      return '<div class="wk9-item"><b>' + esc(x.t) + '</b>' +
        '<span class="lk"><a href="' + l.n + '" target="_blank" rel="noopener">네이버지도</a><a href="' + l.k + '" target="_blank" rel="noopener">카카오맵</a></span></div>';
    }
    var html = '<div class="wk9"><div class="wk9-col"><div class="wk9-h">🚗 이번 주말 할 것</div>' + w.do.map(item).join('') + '</div>' +
      '<div class="wk9-col"><div class="wk9-h">🍽️ 이번 주말 먹을 것</div>' + w.eat.map(item).join('') + '</div></div>' +
      '<div class="wk9-near"><span>🔍 주변 장소 바로 검색:</span>' +
      ['맛집', '카페', '공원', '영화관', '볼링장'].map(function (k) {
        var l = mapLinks('파주 ' + k);
        return '<a href="' + l.n + '" target="_blank" rel="noopener">' + k + '·N</a><a href="' + l.k + '" target="_blank" rel="noopener">' + k + '·K</a>';
      }).join('') + '</div>';
    if (box.__sig !== html) { box.__sig = html; box.innerHTML = html; }
  }

  /* ============================================================
     ⑦ 개인별 목표 배너
     ============================================================ */
  function renderGoals() {
    var v = V9(), box = $('v9GoalsBody');
    if (!v || !box) return;
    var ms = F.members();
    var html = ms.map(function (m) {
      var g = v.goals[m.id] || {};
      var cheers = v.goalCheer[m.id] ? count(v.goalCheer[m.id]) : 0;
      var mine = me() && m.id === me().id;
      return '<div class="gl9">' +
        '<div class="gl9-head">' + (m.emoji || '🧑') + ' <b>' + esc(m.name) + '</b>' + (mine ? ' <span class="gl9-mine">내 목표</span>' : '') + '</div>' +
        '<div class="gl9-row"><span>📅 이번 주</span><b>' + (g.week ? esc(g.week) : '<i class="gl9-empty">아직 없어요</i>') + '</b></div>' +
        '<div class="gl9-row"><span>🗓️ 이번 달</span><b>' + (g.month ? esc(g.month) : '<i class="gl9-empty">아직 없어요</i>') + '</b></div>' +
        '<div class="gl9-row"><span>🌟 장래희망</span><b>' + (g.dream ? esc(g.dream) : '<i class="gl9-empty">아직 없어요</i>') + '</b></div>' +
        '<div class="gl9-acts">' +
        (mine ? '<button type="button" class="btn soft" data-v9goaledit="' + m.id + '" style="padding:8px 14px;font-size:12.5px">✏️ 내 목표 쓰기</button>' : '') +
        (!mine && me() ? '<button type="button" class="btn soft" data-v9goalearn="' + m.id + '" style="padding:8px 14px;font-size:12.5px">👏 응원하기 ' + (cheers ? cheers : '') + '</button>' : '') +
        '</div></div>';
    }).join('');
    if (box.__sig !== html) { box.__sig = html; box.innerHTML = html; }
  }
  function wireGoals() {
    document.addEventListener('click', function (e) {
      var v = V9();
      if (!v) return;
      var ed = e.target.closest('[data-v9goaledit]');
      if (ed) {
        var gv = V9();
        var g = gv.goals[ed.getAttribute('data-v9goaledit')] || {};
        F.openSheet('<h3>🎯 내 목표 쓰기</h3>' +
          '<div class="form-row"><label>이번 주 목표</label><input class="field" id="v9GlW" maxlength="40" value="' + esc(g.week || '') + '" placeholder="예: 수학 20페이지"></div>' +
          '<div class="form-row"><label>이번 달 목표</label><input class="field" id="v9GlM" maxlength="40" value="' + esc(g.month || '') + '" placeholder="예: 책 한 권 끝내기"></div>' +
          '<div class="form-row"><label>장래희망</label><input class="field" id="v9GlD" maxlength="40" value="' + esc(g.dream || '') + '" placeholder="예: 과학자, 축구선수"></div>' +
          '<div style="display:flex;gap:8px;margin-top:6px"><button type="button" class="btn ghost" data-sheet-close>취소</button><button type="button" class="btn" id="v9GlSave">저장</button></div>');
        $('v9GlSave').onclick = function () {
          var id = me().id;
          var v2 = V9();
          v2.goals[id] = { week: ($('v9GlW').value || '').trim(), month: ($('v9GlM').value || '').trim(), dream: ($('v9GlD').value || '').trim(), at: now() };
          save();
          logEdit('목표 배너 수정', memName(id) + '의 목표 갱신');
          F.closeSheet();
          $('v9GoalsBody').__sig = null;
          renderGoals();
          toast('🎯 목표를 저장했어요 — 가족이 응원할 거예요!');
        };
        return;
      }
      var ch = e.target.closest('[data-v9goalearn]');
      if (ch) {
        var id = ch.getAttribute('data-v9goalearn');
        var v2 = V9();
        if (!v2.goalCheer[id]) v2.goalCheer[id] = {};
        v2.goalCheer[id][mid()] = now();
        save();
        $('v9GoalsBody').__sig = null;
        renderGoals();
        toast('👏 ' + memName(id) + '에게 응원을 보냈어요');
      }
    });
  }

  /* ============================================================
     ⑧ 수면시간·피로도·에너지
     ============================================================ */
  function sleepOf(mid2) {
    var v = V9();
    return v ? (v.sleep[mid2] || {}) : {};
  }
  function computeSleep(rec, wakeTs) {
    var hours = rec.bedAt && wakeTs ? (wakeTs - rec.bedAt) / 3600000 : (rec.autoHours || 0);
    hours = clamp(hours, 0, 13);
    if (!hours) return null;
    var over = Math.max(0, hours - 8.5), under = Math.max(0, 7 - hours);
    var fatigue = clamp(Math.round(under * 22 + over * 8), 0, 100);
    var energy = clamp(100 - fatigue - (hours < 5 ? 20 : 0), 5, 100);
    return { hours: Math.round(hours * 10) / 10, fatigue: fatigue, energy: energy };
  }
  function saveSleep(v, patch) {
    var id = mid();
    var rec = v.sleep[id] || (v.sleep[id] = {});
    Object.keys(patch).forEach(function (k) { rec[k] = patch[k]; });
    rec.at = now();
    save();
    /* 다마고치 컨디션 연동: 하루 7시간 이상 자면 내 다마고치 에너지 +8 */
    var t = v.tama[id];
    if (t && patch.hours >= 7) {
      t.energy = clamp(Math.round((t.energy || 50) + 8), 0, 100);
      t.at = now();
      save();
    }
    $('v9SleepBody').__sig = null;
    renderSleep();
  }
  function renderSleep() {
    var v = V9(), box = $('v9SleepBody');
    if (!v || !box) return;
    var yk = todayYmd();
    var ms = F.members();
    var html = ms.map(function (m) {
      var r = v.sleep[m.id] || {};
      var s = computeSleep(r, r.wakeAt);
      var mine = me() && m.id === me().id;
      return '<div class="sl9' + (mine ? ' me' : '') + '">' +
        '<div class="sl9-n">' + (m.emoji || '🧑') + ' <b>' + esc(m.name) + '</b>' + (r.ymd === yk && r.bedAt && !r.wakeAt ? '<span class="sl9-zzz">😴 자는 중</span>' : '') + '</div>' +
        (s ?
          '<div class="sl9-stats">' +
          '<span>🌙 ' + s.hours + '시간</span>' +
          '<span>🥱 피로도 ' + s.fatigue + '%</span>' +
          '<span>⚡ 에너지 ' + s.energy + '%</span></div>' +
          '<div class="sl9-bar"><i style="width:' + s.energy + '%"></i></div>'
          : '<small class="sl9-none">기록 대기 중' + (mine ? ' — 아래 버튼으로 남겨 보세요' : '') + '</small>') +
        (mine ? '<div class="sl9-btns">' +
          '<button type="button" class="btn soft" id="v9Bed" style="padding:7px 12px;font-size:12px">😴 취침</button>' +
          '<button type="button" class="btn soft" id="v9Wake" style="padding:7px 12px;font-size:12px">☀️ 기상</button></div>' : '') +
        '</div>';
    }).join('');
    if (box.__sig !== html) { box.__sig = html; box.innerHTML = html; }
  }
  function wireSleep() {
    document.addEventListener('click', function (e) {
      var v = V9();
      if (!v) return;
      var bed = e.target.closest('#v9Bed');
      if (bed) {
        var v2 = V9();
        saveSleep(v2, { bedAt: now(), wakeAt: 0, ymd: todayYmd() });
        toast('😴 잘 자요 — 내일 아침 기상을 눌러 주세요');
        return;
      }
      var wake = e.target.closest('#v9Wake');
      if (wake) {
        var v3 = V9();
        var rec = v3.sleep[mid()] || {};
        if (!rec.bedAt) { toast('먼저 취침 기록을 눌렀어야 해요 — 그래도 기상으로 기록할게요'); }
        saveSleep(v3, { wakeAt: now(), ymd: todayYmd() });
        toast('☀️ 좋은 아침이에요!');
        return;
      }
    });
    /* 마지막 접속 종료 → 아침 첫 접속 자동 추정 */
    try {
      var sess = JSON.parse(localStorage.getItem(LS_SESS) || 'null');
      var v2 = V9();
      if (v2 && sess && sess.lastSeen) {
        var gap = now() - sess.lastSeen;
        var h0 = new Date(sess.lastSeen).getHours();
        var rec2 = v2.sleep[mid()] || {};
        if (gap > 3.5 * 3600000 && (h0 >= 20 || h0 <= 3) && !(rec2.ymd === todayYmd() && rec2.wakeAt)) {
          v2.sleep[mid()] = rec2;
          rec2.autoHours = Math.min(12, gap / 3600000);
          rec2.ymd = todayYmd();
          rec2.autoWake = now();
          rec2.at = now();
          save();
        }
      }
      localStorage.setItem(LS_SESS, JSON.stringify({ open: now(), lastSeen: now() }));
    } catch (e) {}
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        try { localStorage.setItem(LS_SESS, JSON.stringify({ open: now(), lastSeen: now() })); } catch (e) {}
        var v3 = V9();
        if (v3 && me()) { var r = v3.sleep[mid()] || (v3.sleep[mid()] = {}); r.lastSeen = now(); save(); }
      }
    });
  }

  /* ============================================================
     ⑨ 등교·귀가 안심 기록
     ============================================================ */
  var KIDS = [
    { id: 'jiseop', n: '지섭' }, { id: 'jiyul', n: '지율' }
  ];
  function kidId() {
    /* 내가 아이면 본인, 아니면 기본 지섭 선택 카드 */
    var r = roleOf();
    return r === '첫째아들' ? 'jiseop' : (r === '둘째아들' ? 'jiyul' : '');
  }
  function roleOf() {
    var m = me();
    if (!m) return '';
    if (m.role) return m.role;
    return '';
  }
  function renderSchool() {
    var v = V9(), box = $('v9SchoolBody');
    if (!v || !box) return;
    var yk = todayYmd();
    var html = KIDS.map(function (k) {
      var day = (v.school[yk] || {})[k.id] || {};
      var step = function (t, done) { return '<span class="sc9-step' + (done ? ' on' : '') + '">' + t + '</span>'; };
      return '<div class="sc9"><div class="sc9-head">🎒 ' + k.n + '</div>' +
        '<div class="sc9-flow">' + step('🏠 출발 ' + (day.depart ? '✅ ' + F.hhmm(day.depart) : '–'), day.depart) +
        step('🏫 등교 ' + (day.arrive ? '✅ ' + F.hhmm(day.arrive) : '–'), day.arrive) +
        step('🏡 하교 도착 ' + (day.home ? '✅ ' + F.hhmm(day.home) : '–'), day.home) + '</div>' +
        (kidId() === k.id || isParent() ? '<div class="sc9-btns">' +
          '<button type="button" class="btn soft" data-v9sch="' + k.id + ':depart" style="padding:7px 10px;font-size:11.5px">🚶 출발</button>' +
          '<button type="button" class="btn soft" data-v9sch="' + k.id + ':arrive" style="padding:7px 10px;font-size:11.5px">🏫 도착</button>' +
          '<button type="button" class="btn soft" data-v9sch="' + k.id + ':home" style="padding:7px 10px;font-size:11.5px">🏡 집 도착</button></div>' : '') +
        '</div>';
    }).join('');
    if (box.__sig !== html) { box.__sig = html; box.innerHTML = html; }
    var sum = $('v9SchoolSum');
    if (sum) {
      var done = KIDS.filter(function (k) { var d = (v.school[yk] || {})[k.id] || {}; return d.depart && d.arrive && d.home; }).length;
      sum.textContent = '오늘 ' + done + '/2 안심 완료';
    }
  }
  function wireSchool() {
    document.addEventListener('click', function (e) {
      var v = V9();
      if (!v) return;
      var b = e.target.closest('[data-v9sch]');
      if (!b) return;
      var p = b.getAttribute('data-v9sch').split(':');
      var kid = p[0], step = p[1];
      var yk = todayYmd();
      var v2 = V9();
      if (!v2.school[yk]) v2.school[yk] = {};
      if (!v2.school[yk][kid]) v2.school[yk][kid] = {};
      var rec = v2.school[yk][kid];
      var label = step === 'depart' ? '등교 출발' : (step === 'arrive' ? '학교 도착' : '집 도착');
      var finish = function (loc) {
        rec[step] = now();
        rec[step + '_loc'] = loc || '';
        rec.at = now();
        save();
        logEdit('등하교 안심 기록', kid + ' ' + label + ' ' + F.hhmm(rec[step]));
        $('v9SchoolBody').__sig = null;
        renderSchool();
        toast('🎒 ' + label + ' ' + F.hhmm(rec[step]) + ' 기록 — 엄마·아빠가 보게 저장했어요');
      };
      /* 앱 열람 시 위치 자동 판정: 집(파주) 근처면 태그 */
      if (F.locate) {
        F.locate(function (pos) {
          var tag = '';
          if (pos && pos.coords) {
            var dLat = Math.abs(pos.coords.latitude - 37.9245), dLon = Math.abs(pos.coords.longitude - 126.8319);
            tag = (dLat < 0.01 && dLon < 0.01) ? '집 근처' : '외부';
          }
          finish(tag);
        });
      } else finish('');
    });
  }

  /* ============================================================
     ⑩ 홈 공동 꾸미기 + 수정 이력
     ============================================================ */
  var HOME_CARDS = [
    { id: 'v9MoodCard', n: '🎭 지금 우리 가족 기분' },
    { id: 'v9QuoteCard', n: '📖 오늘의 명언·가족 한마디' },
    { id: 'v9PodCard', n: '⭐ 오늘의 대표사진' },
    { id: 'famCalBanner', n: '📅 우리가족 달력' },
    { id: 'v9ShiftCard', n: '🗓️ 근무표·등교표' },
    { id: 'v9DdayCard', n: '🎂 가족 디데이' },
    { id: 'briefCard', n: '☀️ 날씨·옷차림' },
    { id: 'v9GoalsCard', n: '🎯 가족 목표' },
    { id: 'v9SleepCard', n: '😴 수면·피로도·에너지' },
    { id: 'v9SchoolCard', n: '🎒 등교·귀가 안심' },
    { id: 'v9SbCard', n: '🏅 가족 상벌점' },
    { id: 'v9NewsCard', n: '📰 공부·게임 뉴스' },
    { id: 'v9WkCard', n: '🎡 주말 추천·주변 검색' },
    { id: 'v9LogCard', n: '🕘 홈 꾸미기 이력' }
  ];
  function cardList() {
    /* 실제 홈에 있는 카드들(내가 넣은 것 + 원래 있던 것) */
    var home = $('view-home');
    if (!home) return HOME_CARDS;
    var out = [];
    Array.prototype.forEach.call(home.children, function (ch) {
      var id = ch.id;
      if (!id) return;
      var known = HOME_CARDS.filter(function (c) { return c.id === id; })[0];
      if (known) out.push(known);
      else {
        var h = ch.querySelector && (ch.querySelector('h2') || ch.querySelector('b'));
        var name = h ? h.textContent.trim() : id;
        if (/p7strip/.test(id)) name = '📷 포토 스트립';
        out.push({ id: id, n: name, native: 1 });
      }
    });
    return out;
  }
  function applyLayout() {
    var v = V9(), home = $('view-home');
    if (!v || !home) return;
    var order = v.layout.order || [];
    var hidden = v.layout.hidden || [];
    order.forEach(function (id) {
      var el = document.getElementById(id);
      if (el && home === el.parentElement) home.appendChild(el);
    });
    cardList().forEach(function (c) {
      var el = document.getElementById(c.id);
      if (el) el.classList.toggle('v9-card-hidden', hidden.indexOf(c.id) >= 0 && !c.native_hidden);
    });
  }
  function decorateEdit() {
    var home = $('view-home');
    if (!home) return;
    if (home.querySelector('.v9-editbar')) return;
    var bar = document.createElement('div');
    bar.className = 'v9-editbar';
    bar.innerHTML = '<button type="button" class="btn ghost" id="v9Decorate">🪄 홈 꾸미기</button>';
    home.insertBefore(bar, home.firstChild);
    bar.addEventListener('click', function (e) {
      if (e.target.closest('#v9Decorate')) decorateSheet();
    });
  }
  function decorateSheet() {
    var v = V9();
    var cards = cardList();
    var order = (v.layout.order || []).slice();
    cards.forEach(function (c) { if (order.indexOf(c.id) < 0) order.push(c.id); });
    var hidden = (v.layout.hidden || []).slice();
    var listHtml = function () {
      return order.map(function (id, i) {
        var c = cards.filter(function (x) { return x.id === id; })[0] || { n: id };
        var hid = hidden.indexOf(id) >= 0;
        return '<div class="ly9-row' + (hid ? ' off' : '') + '" data-id="' + esc(id) + '">' +
          '<span class="n">' + esc(c.n) + '</span>' +
          '<span class="ops">' +
          '<button type="button" data-up="' + i + '">▲</button>' +
          '<button type="button" data-dn="' + i + '">▼</button>' +
          '<button type="button" data-hid="' + i + '">' + (hid ? '보이기' : '숨기기') + '</button>' +
          '</span></div>';
      }).join('');
    };
    F.openSheet('<h3>🪄 우리 가족 홈 꾸미기</h3>' +
      '<div class="sdesc">배너·카드 순서와 표시 여부를 가족 누구나 바꿀 수 있어요. 바뀔 때마다 <b>누가·언제·무엇을</b> 바꿨는지 이력에 영구 기록돼요.</div>' +
      '<div id="ly9List">' + listHtml() + '</div>' +
      '<button type="button" class="btn" data-sheet-close style="margin-top:10px">이대로 저장</button>');
    var list = $('ly9List');
    list.addEventListener('click', function (e) {
      var up = e.target.closest('[data-up]');
      var dn = e.target.closest('[data-dn]');
      var hid = e.target.closest('[data-hid]');
      var change = '';
      if (up) {
        var i1 = Number(up.getAttribute('data-up'));
        if (i1 > 0) { var t1 = order[i1 - 1]; order[i1 - 1] = order[i1]; order[i1] = t1; change = '순서 변경'; }
      } else if (dn) {
        var i2 = Number(dn.getAttribute('data-dn'));
        if (i2 < order.length - 1) { var t2 = order[i2 + 1]; order[i2 + 1] = order[i2]; order[i2] = t2; change = '순서 변경'; }
      } else if (hid) {
        var i3 = Number(hid.getAttribute('data-hid'));
        var id3 = order[i3];
        var ix = hidden.indexOf(id3);
        if (ix >= 0) { hidden.splice(ix, 1); change = '표시 켬'; } else { hidden.push(id3); change = '숨김'; }
      }
      if (change) {
        list.innerHTML = listHtml();
        /* 즉시 반영 */
        var v2 = V9();
        v2.layout = { order: order, hidden: hidden, by: mid(), at: now() };
        save();
        applyLayout();
        logEdit('홈 꾸미기 ' + change, order[i3 || i1 || i2] || '');
        $('v9LogBody').__sig = null;
        renderLog();
      }
    });
  }
  function renderLog() {
    var v = V9(), box = $('v9LogBody');
    if (!v || !box) return;
    var es = Object.keys(v.editLog).map(function (k) { return v.editLog[k]; })
      .filter(function (x) { return x && typeof x === 'object'; })
      .sort(function (a, b) { return (b.at || 0) - (a.at || 0); })
      .slice(0, 8);
    var html = es.length ? es.map(function (x) {
      return '<div class="lg9-row"><b>' + memEmoji(x.by) + ' ' + esc(memName(x.by)) + '</b> <span>' + esc(x.action) + '</span>' +
        (x.detail ? '<small>' + esc(x.detail) + '</small>' : '') +
        '<span class="at">' + (new Date(x.at).getMonth() + 1) + '/' + new Date(x.at).getDate() + ' ' + F.hhmm(x.at) + '</span></div>';
    }).join('') : '<div class="v4-empty">아직 꾸미기 이력이 없어요 — 🪄 홈 꾸미기에서 시작해 보세요</div>';
    if (box.__sig !== html) { box.__sig = html; box.innerHTML = html; }
  }

  /* ============================================================
     ⑪ 미쁠 — 우리 가족 AI 비서 (초록 ㅅ 캐릭터 · 우측 하단 플로팅)
     ============================================================ */
  var chatHist = [];
  var MIPP_GREET = '안녕하세요! 저는 미쁠이에요 💚 기분·일정·용돈·근무표까지 포털에 기록된 우리 가족 이야기를 보고 답해 드려요. 무엇이든 물어보세요!';
  var FAM_CTX = '우리 가족: 아빠 상국(육군 준위, 파주 거주, 교대근무), 엄마 수향, 첫째 지섭(중학생, 2013년생), 둘째 지율(2015년생). ' +
    '너는 심상국 가족의 AI 비서 "미쁠"이야. 초록색 ㅅ자 모양의 다정한 마스코트이고, 가족 모두 너를 미쁠이라고 불러. ' +
    '한국어로 다정하고 간결하게(보통 2~4문장) 답하고, 가족이 서로 아끼고 재미있게 지내도록 도와줘. ' +
    '아래에 [지금]·[가족 특징]·[가족별 기록]·[일정] 같은 우리가족포털 실시간 기록이 함께 주어지면 그것을 근거로 답해. ' +
    '포털에 실제로 있는 값(이름·기분·날짜·금액·근무표)은 그대로 인용하고, 기록이 없는 항목은 지어내지 말고 "아직 포털에 기록이 없어요"라고 솔직히 말해. ' +
    '추측해서 답할 때는 "제 짐작으로는"이라고 밝혀. ' +
    '인사나 자기소개 없이 질문에 바로 답하고, 이모지는 2개 이하로 써.';

  /* ============================================================
     ⑪-2 실시간 가족 데이터 문맥 (buildLiveFamContext)
     - 미쁠에게 물을 때마다 '지금 이 순간'의 가족 DB(DOC)를 다시 읽어 요약한다
       (기분·상태·위치·목표·수면·용돈·상벌점·좋아하는 것·위시·펫·일정·근무표·할일·공지·채팅·XP)
     - 목록은 최신 N건만 넣고 나머지는 "외 N건"으로 줄여 토큰을 아낀다
     - 화면에 보이는 값을 그대로 옮겨 적는다(가공·추측 없음)
     ============================================================ */
  var LIVE_LIM = { cal: 15, pastCal: 3, todo: 10, chat: 5, notice: 4, money: 4, wish: 8, cheer: 3, plan: 4, shift: 14 };
  var BIRTH_BY_NAME = { '지섭': '2013-10-10', '지율': '2015-08-26' };
  var GRADE_BY_NAME = { '지섭': '중학생', '지율': '초등학생' };

  function clipTxt(s, n) {
    var t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    return t.length > n ? t.slice(0, n) + '…' : t;
  }
  function liveStamp(ts) {
    if (!ts) return '';
    var x = new Date(ts), t = new Date();
    if (x.toDateString() === t.toDateString()) return '오늘 ' + F.hhmm(ts);
    if (x.toDateString() === new Date(t.getTime() - 86400000).toDateString()) return '어제 ' + F.hhmm(ts);
    return (x.getMonth() + 1) + '/' + x.getDate() + ' ' + F.hhmm(ts);
  }
  function wonNum(n) { return Number(n || 0).toLocaleString('ko-KR') + '원'; }
  function liveList(node) {
    var out = [];
    Object.keys(node || {}).forEach(function (k) {
      var it = node[k];
      if (it && typeof it === 'object' && !it.del) out.push(it);
    });
    return out;
  }
  function dayMs(ds) {
    var p = String(ds || '').slice(0, 10).split('-');
    if (p.length < 3) return NaN;
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])).getTime();
  }
  function wdKo(dt) { return ['일', '월', '화', '수', '목', '금', '토'][dt.getDay()]; }
  function mdKo(dt) { return (dt.getMonth() + 1) + '/' + dt.getDate() + '(' + wdKo(dt) + ')'; }
  function liveStatusKo(st) {
    switch (st && st.s) {
      case 'home': return '🏠 집에 있어요';
      case 'depart': return '🚗 출발했어요';
      case 'soon': return '🚙 곧 도착해요';
      case 'eta': return '⏰ ' + (st.eta || '') + ' 도착 예정';
      case 'late': return '🌙 오늘은 늦어요';
      case 'out': return '👋 외출 중이에요';
      default: return '';
    }
  }
  /* 생일까지 남은 날 — 포털 디데이와 같은 기준(월·일)으로 센다 */
  function birthLeft(ds) {
    var p = String(ds || '').split('-');
    if (p.length < 3) return null;
    var t = new Date(); t.setHours(0, 0, 0, 0);
    var d0 = new Date(t.getFullYear(), Number(p[1]) - 1, Number(p[2]));
    if (d0.getTime() < t.getTime()) d0 = new Date(t.getFullYear() + 1, Number(p[1]) - 1, Number(p[2]));
    return Math.round((d0.getTime() - t.getTime()) / 86400000);
  }
  function liveMoney(v, id) {
    var days = (v.moneyD || {})[id] || {}, bal = 0, got = 0, spent = 0, items = [];
    Object.keys(days).forEach(function (k) {
      ((days[k] && days[k].items) || []).forEach(function (it) {
        var amt = Number(it.amt || 0);
        if (it.k === 'got') { bal += amt; got += amt; } else { bal -= amt; spent += amt; }
        items.push({ d: k, it: it });
      });
    });
    items.sort(function (a, b) { return (b.it.at || 0) - (a.it.at || 0); });
    return { bal: bal, got: got, spent: spent, items: items };
  }
  function liveXp(D) {
    var v4n = (D && D.v4) || {};
    var all = liveList(v4n.cal).map(function (it) { return it; })
      .concat(liveList(v4n.todos).map(function (it) { return it; }));
    var total = 0, doneN = 0, openN = 0;
    all.forEach(function (it) {
      var st = it.st || (it.done ? 'done' : 'plan');
      if (it.st && (it.at || 0) > (it.stAt || 0)) st = it.done ? 'done' : 'plan';
      if (st === 'done') {
        total += (it.imp === 'high' ? 30 : (it.imp === 'low' ? 10 : 20));
        doneN++;
      } else if (st === 'plan' || st === 'post') openN++;
    });
    return { total: total, lv: 1 + Math.floor(total / 100), doneN: doneN, openN: openN };
  }

  function buildLiveFamContext() {
    var D = d(), v = V9();
    if (!D || !v) return '';
    var mine = me();
    var ms = F.members() || [];
    var nd = new Date();
    var today0 = new Date(); today0.setHours(0, 0, 0, 0);
    var L = [];

    /* 1) 지금 */
    L.push('[지금] ' + nd.getFullYear() + '년 ' + (nd.getMonth() + 1) + '월 ' + nd.getDate() + '일(' + wdKo(nd) + ') ' + F.hhmm(nd.getTime()) + ' · ' +
      (mine ? '이 대화를 쓰는 사람: ' + (mine.emoji || '') + ' ' + mine.name + '(' + (mine.role || '가족') + ')' : '로그인 정보 없음'));

    /* 2) 가족 특징(직업·학년·생일·디데이) */
    var suDows = (v.commute && v.commute.su && v.commute.su.dows) || [1, 3];
    var vac = !!(v.schoolMode && v.schoolMode.vacation);
    var feat = ms.map(function (m) {
      var f = [];
      var nm = String(m.name || '');
      if (m.role === '아빠') { f.push('육군 준위(영상정보 분야)'); f.push('파주 집↔연천 부대 출퇴근'); f.push('4주 교대근무'); }
      else if (m.role === '엄마') {
        var dn = (suDows || []).slice().sort().map(function (i) { return ['일', '월', '화', '수', '목', '금', '토'][i]; }).join('·');
        f.push('출근 요일 ' + (dn || '미지정'));
      } else if (GRADE_BY_NAME[nm]) f.push(GRADE_BY_NAME[nm] + (vac ? ' · 지금 방학' : ' · 등교 중'));
      if (BIRTH_BY_NAME[nm]) {
        f.push(BIRTH_BY_NAME[nm].replace(/-/g, '.') + '생');
        var bl = birthLeft(BIRTH_BY_NAME[nm]);
        if (bl != null) f.push('생일 ' + (bl === 0 ? '오늘' : 'D-' + bl));
      }
      if (!f.length) f.push(m.role || '가족');
      return (m.emoji || '🧑') + ' ' + nm + '(' + (m.role || '가족') + '): ' + f.join(' · ');
    }).join(' / ');
    if (feat) L.push('[가족 특징] ' + feat);
    var dds = [];
    Object.keys(v.ddays || {}).forEach(function (k) {
      var it = v.ddays[k];
      if (!it || it.del || !it.d) return;
      var left = birthLeft(it.d);
      if (left != null) dds.push(clipTxt(it.t, 20) + ' D-' + left);
    });
    if (dds.length) L.push('[가족 디데이] ' + dds.slice(0, 6).join(' · '));

    /* 3) 가족별 기록 */
    var sb = v.sb || { cat: {}, rec: {} };
    var sbTot = {};
    Object.keys(sb.rec || {}).forEach(function (k) {
      var r = sb.rec[k];
      if (!r || r.del || r.st !== 'ok') return;
      sbTot[r.to] = (sbTot[r.to] || 0) + (r.pts || 0);
    });
    var wishes = liveList(v.wish);
    var rows = [];
    ms.forEach(function (m) {
      var p = [];
      var mo = (v.mood || {})[m.id];
      if (mo && mo.e) p.push('기분 ' + mo.e + (mo.t ? ' ' + clipTxt(mo.t, 14) : '') + (mo.note ? ' "' + clipTxt(mo.note, 24) + '"' : '') + ' (' + liveStamp(mo.at) + ')');
      else p.push('기분 기록 없음');
      var st = (D.status || {})[m.id];
      var stk = liveStatusKo(st);
      if (stk) p.push('상태 ' + stk + (st.memo ? ' "' + clipTxt(st.memo, 24) + '"' : '') + ' (' + liveStamp(st.at) + ')');
      var lv = (D.live || {})[m.id];
      if (lv && lv.at) {
        p.push('위치 ' + clipTxt(lv.addr || (Number(lv.lat).toFixed(4) + ',' + Number(lv.lon).toFixed(4)), 40) + ' (' + liveStamp(lv.at) + ((Date.now() - lv.at) > 6 * 3600000 ? ' · 오래된 위치' : '') + ')');
      }
      var g = (v.goals || {})[m.id];
      if (g && (g.week || g.month || g.dream)) {
        var gh = ['주 ' + (clipTxt(g.week, 24) || '-'), '월 ' + (clipTxt(g.month, 24) || '-'), '꿈 ' + (clipTxt(g.dream, 16) || '-')];
        p.push('목표 ' + gh.join(' · '));
      }
      var sl = (v.sleep || {})[m.id];
      if (sl) {
        var ss = computeSleep(sl, sl.wakeAt);
        if (ss) p.push('수면 ' + ss.hours + '시간·피로 ' + ss.fatigue + '%·에너지 ' + ss.energy + '%');
        else if (sl.bedAt && !sl.wakeAt) p.push('지금 자는 중');
      }
      var mn = liveMoney(v, m.id);
      if (mn.items.length) {
        var rm = mn.items.slice(0, 2).map(function (x) { return x.d.slice(5).replace('-', '/') + ' ' + (x.it.k === 'got' ? '+' : '-') + wonNum(x.it.amt) + (x.it.t ? '(' + clipTxt(x.it.t, 10) + ')' : ''); }).join(', ');
        p.push('용돈 잔액 ' + wonNum(mn.bal) + ' · 최근 ' + rm);
      } else p.push('용돈 기록 없음');
      if (sbTot[m.id] != null) p.push('상벌점 ' + (sbTot[m.id] > 0 ? '+' : '') + sbTot[m.id] + '점');
      var lk = ((D.v4 && D.v4.like) || {})[m.id];
      if (lk && (lk.food || lk.hobby || lk.interest)) {
        var lks = [];
        if (lk.food) lks.push('음식 ' + clipTxt(lk.food, 16));
        if (lk.hobby) lks.push('취미 ' + clipTxt(lk.hobby, 16));
        if (lk.interest) lks.push('관심 ' + clipTxt(lk.interest, 16));
        p.push('좋아하는 것 ' + lks.join(' · '));
      }
      var myW = wishes.filter(function (w) { return w.by === m.id; });
      if (myW.length) {
        var ws = myW.slice(0, 4).map(function (w) {
          return clipTxt(w.name, 18) + (w.price ? ' ' + clipTxt(w.price, 10) : '') + (w.got ? '(받음)' : '');
        });
        p.push('갖고 싶은 것 ' + ws.join(', ') + (myW.length > 4 ? ' 외 ' + (myW.length - 4) + '개' : ''));
      }
      var tm = (v.tama || {})[m.id];
      if (tm) p.push('펫 ' + clipTxt(tm.name || '이름 없음', 10) + '(Lv.' + (tm.lv || 1) + '·배부름 ' + (tm.full || 0) + '·행복 ' + (tm.happy || 0) + '·에너지 ' + (tm.energy || 0) + ')');
      rows.push('- ' + (m.emoji || '🧑') + ' ' + m.name + ': ' + p.join(' | '));
    });
    if (rows.length) L.push('[가족별 기록]\n' + rows.join('\n'));

    /* 4) 일정(오늘~14일) + 지난 미완료 */
    var cal = liveList((D.v4 && D.v4.cal) || {});
    var t0 = today0.getTime(), tEnd = t0 + 14 * 86400000;
    var byDay = {}, dayOrder = [], past = [];
    cal.forEach(function (it) {
      var msDay = dayMs(it.d);
      if (isNaN(msDay)) return;
      var done = it.st ? it.st === 'done' : !!it.done;
      if (it.st && (it.at || 0) > (it.stAt || 0)) done = !!it.done;
      var one = clipTxt(it.t, 40) + (it.time ? ' ' + it.time : '') + ' (' + (memName(it.by) || '가족') + ')' + (it.st === 'cancel' ? '[취소]' : (done ? '[완료]' : '')) + (it.memo ? ' {' + clipTxt(it.memo, 20) + '}' : '');
      if (msDay >= t0 && msDay < tEnd) {
        var key = ymd(msDay);
        if (!byDay[key]) { byDay[key] = []; dayOrder.push(key); }
        byDay[key].push(one);
      } else if (msDay < t0 && !done && past.length < LIVE_LIM.pastCal) {
        past.push(ymd(msDay).slice(5).replace('-', '/') + ' ' + one);
      }
    });
    dayOrder.sort();
    var calLines = [];
    var showed = 0;
    dayOrder.forEach(function (key) {
      if (showed >= LIVE_LIM.cal) return;
      var dt = new Date(dayMs(key));
      var list = byDay[key];
      var use = list.slice(0, Math.max(1, LIVE_LIM.cal - showed));
      showed += use.length;
      calLines.push(mdKo(dt) + ' ' + use.join(' / ') + (list.length > use.length ? moreStr(list.length - use.length) : ''));
    });
    if (calLines.length) L.push('[일정 · 오늘부터 14일]\n' + calLines.join('\n'));
    else L.push('[일정 · 오늘부터 14일] 달력에 기록된 일정이 없어요');
    if (past.length) L.push('[지난 미완료 일정] ' + past.join(' / '));
    var plans = liveList(D.plans).filter(function (p) { return p.when; }).sort(function (a, b) { return (a.when || 0) - (b.when || 0); }).slice(0, LIVE_LIM.plan);
    if (plans.length) {
      L.push('[가족 약속] ' + plans.map(function (p) {
        return (p.what || '약속') + (p.where ? ' @' + clipTxt(p.where, 24) : '') + ' ' + liveStamp(p.when) + ' (' + memName(p.by) + ')';
      }).join(' / '));
    }

    /* 5) 교대근무·출근·등교(오늘~14일) */
    var shiftBits = [];
    for (var i = 0; i < LIVE_LIM.shift; i++) {
      var dt2 = new Date(t0 + i * 86400000);
      var sh = shiftOf(dt2);
      var bits = ['상국 ' + (sh.label || (sh.isWork ? '근무' : '휴식'))];
      if ((suDows || []).indexOf(dt2.getDay()) >= 0) bits.push('수향 출근');
      var dow = dt2.getDay();
      if (dow >= 1 && dow <= 5) bits.push(vac ? '아이들 방학' : '아이들 등교');
      shiftBits.push(mdKo(dt2) + ' ' + bits.join('·'));
    }
    L.push('[근무·출근·등교] ' + shiftBits.join(' | '));

    /* 6) 미완료 할일 */
    var todos = liveList((D.v4 && D.v4.todos) || {}).filter(function (it) { return !it.done; })
      .sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    if (todos.length) {
      var tl = todos.slice(0, LIVE_LIM.todo).map(function (it) { return clipTxt(it.t, 40) + '(' + memName(it.by) + ')'; });
      L.push('[미완료 할일 ' + todos.length + '건] ' + tl.join(' / ') + (todos.length > tl.length ? ' 외 ' + (todos.length - tl.length) + '건' : ''));
    } else L.push('[미완료 할일] 없음');

    /* 7) 공지·채팅·응원 */
    var notices = liveList(D.notices).filter(function (n) { return String(n.text || '').trim(); })
      .sort(function (a, b) { return ((b.pin ? 1 : 0) - (a.pin ? 1 : 0)) || ((b.at || 0) - (a.at || 0)); });
    if (notices.length) {
      L.push('[가족 공지] ' + notices.slice(0, LIVE_LIM.notice).map(function (n) {
        return (n.pin ? '📌' : '📢') + memName(n.by) + ': ' + clipTxt(n.text, 70) + ' (' + liveStamp(n.at) + ')';
      }).join(' / '));
    }
    var chats = liveList(D.chat).filter(function (c) { return String(c.text || '').trim(); })
      .sort(function (a, b) { return (b.at || 0) - (a.at || 0); }).slice(0, LIVE_LIM.chat).reverse();
    if (chats.length) {
      L.push('[최근 가족 채팅] ' + chats.map(function (c) {
        return memName(c.by) + ': ' + clipTxt(c.text, 60) + ' (' + liveStamp(c.at) + ')';
      }).join(' / '));
    }
    var cheers = liveList(D.cheer).filter(function (c) { return String(c.text || '').trim(); })
      .sort(function (a, b) { return (b.at || 0) - (a.at || 0); }).slice(0, LIVE_LIM.cheer);
    if (cheers.length) {
      L.push('[가족 응원 한마디] ' + cheers.map(function (c) { return memName(c.by) + ': ' + clipTxt(c.text, 50); }).join(' / '));
    }

    /* 8) 가족 XP · 기록량 */
    var xp = liveXp(D);
    L.push('[가족 경험치] 완료 ' + xp.doneN + '건 · 약 ' + xp.total + 'XP · Lv.' + xp.lv + ' · 진행 중 ' + xp.openN + '건' +
      ' | 위시 ' + wishes.length + '개 · 사진 ' + liveList(D.photos).length + '장 · 일기 ' + liveList(D.diary).length + '편');

    /* 9) 답변 지침 */
    L.push('[답변 지침] 위 기록에 있는 값은 이름·날짜·시간·금액·기분 표현 그대로 구체적으로 인용해 답해. ' +
      '기록이 없는 항목은 "아직 포털에 기록이 없어요"라고 말하고 절대 지어내지 마. ' +
      '날짜·요일·남은 날짜는 [지금]과 [근무·출근·등교]를 기준으로 계산해. ' +
      '가족끼리 서로 챙길 수 있게, 필요하면 한 가지 행동을 다정하게 제안해.');

    return L.join('\n');
  }
  function moreStr(n) { return ' 외 ' + n + '건'; }

  /* 미쁠 마스코트 그림: 통통한 초록 ㅅ 몸체 + 동그란 두 눈 + 밝은 미소 */
  function mippeulSVG(size) {
    var s = size || 34;
    return '<svg viewBox="0 0 48 48" width="' + s + '" height="' + s + '" aria-hidden="true" focusable="false">' +
      '<g stroke="#22C55E" stroke-width="11" stroke-linecap="round" fill="none">' +
      '<line x1="24" y1="12.5" x2="12.6" y2="35.5"/>' +
      '<line x1="24" y1="12.5" x2="35.4" y2="35.5"/></g>' +
      '<circle cx="24" cy="12.5" r="7" fill="#22C55E"/>' +
      '<ellipse cx="19" cy="19.6" rx="2.6" ry="3.6" fill="#0F172A"/>' +
      '<ellipse cx="29" cy="19.6" rx="2.6" ry="3.6" fill="#0F172A"/>' +
      '<circle cx="18.2" cy="18.2" r="0.95" fill="#FFFFFF"/>' +
      '<circle cx="28.2" cy="18.2" r="0.95" fill="#FFFFFF"/>' +
      '<path d="M21 25.6 Q24 28.2 27 25.6" stroke="#0F172A" stroke-width="1.6" stroke-linecap="round" fill="none"/>' +
      '</svg>';
  }
  function mippeulAvatar(size) {
    return '<span class="f9-av" style="width:' + (size || 22) + 'px;height:' + (size || 22) + 'px">' + mippeulSVG((size || 22) - 3) + '</span>';
  }

  function robotBtn() {
    if ($('f9robot')) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.id = 'f9robot';
    b.setAttribute('aria-label', '미쁠 AI 도우미');
    b.title = '미쁠 — 우리 가족 AI 비서';
    b.innerHTML = mippeulSVG(38);
    document.body.appendChild(b);
    b.addEventListener('click', robotClick);
  }
  function robotClick() { openChat(); }
  function openChat() {
    if ($('f9chat')) {
      $('f9chat').classList.remove('hidden');
      var old = $('f9chatIn');
      if (old) old.focus();
      return;
    }
    var wrap = document.createElement('div');
    wrap.id = 'f9chat';
    wrap.innerHTML = '<div class="f9chat-head">' +
        '<span class="f9chat-av">' + mippeulSVG(21) + '</span>' +
        '<span class="f9chat-title">미쁠<small>우리 가족 AI 비서</small></span>' +
        '<button type="button" class="f9h" id="f9chatKey" title="키 설정" aria-label="키 설정">🔑</button>' +
        '<button type="button" class="f9h" id="f9chatNew" title="새 대화" aria-label="새 대화">🧹</button>' +
        '<button type="button" class="f9h" id="f9chatX" title="닫기" aria-label="닫기">✕</button>' +
      '</div>' +
      '<div class="f9chat-body" id="f9chatBody"></div>' +
      '<div class="f9chat-foot"><input id="f9chatIn" placeholder="미쁠에게 무엇이든 물어보세요…" autocomplete="off"><button type="button" id="f9chatGo">보내기</button></div>';
    document.body.appendChild(wrap);
    $('f9chatX').addEventListener('click', function () { wrap.classList.add('hidden'); });
    $('f9chatKey').addEventListener('click', function () {
      if (!global.FAM9AI) { toast('미쁠 모듈을 불러오지 못했어요 — 새로고침해 주세요'); return; }
      global.FAM9AI.keySheet('미쁠 AI 키 설정', '미쁠이 대답하려면 Gemini 키가 필요해요. 키는 이 기기에만 저장되고 가족에게 공유되지 않아요.', function () {
        pushMsg('ai', '키를 저장했어요. 이제 무엇이든 물어보세요! 💚');
      });
    });
    $('f9chatNew').addEventListener('click', function () {
      chatHist = [];
      var body = $('f9chatBody');
      if (body) body.innerHTML = '';
      pushMsg('ai', MIPP_GREET);
      toast('새 대화를 시작했어요 🧹');
    });

    var send = function () {
      var inp = $('f9chatIn');
      var q = (inp.value || '').trim();
      if (!q) return;
      if (!global.FAM9AI) { pushError('미쁠 모듈을 불러오지 못했어요. 페이지를 새로고침해 주세요.'); return; }
      inp.value = '';
      pushMsg('me', q);
      var thinking = pushMsg('ai', '생각 중…');
      var hist = chatHist.map(function (h) { return (h.r === 'me' ? '가족: ' : '미쁠: ') + h.t; }).join('\n');
      var live = '';
      try { live = buildLiveFamContext(); } catch (err) { live = ''; }
      global.FAM9AI.ask(
        (live ? live + '\n\n' : '') + (hist ? '대화 기록:\n' + hist + '\n' : '') + '가족: ' + q,
        { system: FAM_CTX }
      )
        .then(function (txt) {
          chatHist.push({ r: 'me', t: q }, { r: 'ai', t: txt });
          if (chatHist.length > 12) chatHist = chatHist.slice(-12);
          if (thinking && thinking.parentNode) thinking.parentNode.removeChild(thinking);
          pushMsg('ai', txt);
        })
        .catch(function (err) {
          if (thinking && thinking.parentNode) thinking.parentNode.removeChild(thinking);
          var msg = (err && (err.friendly || err.message)) || '지금은 답을 못 받았어요.';
          pushError(msg);
        });
    };
    $('f9chatGo').addEventListener('click', send);
    $('f9chatIn').addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });

    pushMsg('ai', MIPP_GREET);
    if (!global.FAM9AI || !global.FAM9AI.key()) {
      pushError('아직 Gemini 키가 없어서 대화를 못 해요. 키를 한 번만 넣어 주시면 바로 시작할 수 있어요.');
    }
  }
  function pushMsg(who, t) {
    var body = $('f9chatBody');
    if (!body) return null;
    var row = document.createElement('div');
    row.className = 'f9-row ' + who;
    if (who === 'ai') row.innerHTML = mippeulAvatar(22);
    var div = document.createElement('div');
    div.className = 'f9-msg ' + who;
    div.textContent = t;
    row.appendChild(div);
    body.appendChild(row);
    body.scrollTop = body.scrollHeight;
    return row;
  }
  /* 오류는 원인을 그대로 보여 주고, 바로 키 설정을 열 수 있게 한다 */
  function pushError(msg) {
    var body = $('f9chatBody');
    if (!body) return null;
    var row = document.createElement('div');
    row.className = 'f9-row ai';
    row.innerHTML = mippeulAvatar(22);
    var div = document.createElement('div');
    div.className = 'f9-msg ai err';
    var p = document.createElement('div');
    p.textContent = msg;
    div.appendChild(p);
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'f9-err-btn';
    b.textContent = '🔑 키 설정 열기';
    b.addEventListener('click', function () {
      if (!global.FAM9AI) { toast('미쁠 모듈을 불러오지 못했어요 — 새로고침해 주세요'); return; }
      global.FAM9AI.keySheet('미쁠 AI 키 설정', '키를 넣으면 미쁠이 다시 대답할 수 있어요. 키는 이 기기에만 저장돼요.', function () {
        pushMsg('ai', '키를 저장했어요. 다시 물어봐 주세요! 💚');
      });
    });
    div.appendChild(b);
    row.appendChild(div);
    body.appendChild(row);
    body.scrollTop = body.scrollHeight;
    return row;
  }

  /* ============================================================
     ⑫ 가족 상벌점 제도 (상호 부여 · 근거 사진 건의 · 용돈 연동 · 통계 · 조언)
     DOC.v9.sb = { cat:{id:{t,pts,kind,del,at}}, rec:{id:{from,to,cat,pts,note,img,st,ymd,at,done:{amt}}}, advice:{text,at,ymd} }
     ============================================================ */
  var SB_DEFAULTS = [
    { t: '공부·숙제 스스로 하기', pts: 10, kind: 'plus' },
    { t: '집안일 돕기', pts: 10, kind: 'plus' },
    { t: '동생/형 챙겨 주기', pts: 10, kind: 'plus' },
    { t: '정리정돈 잘하기', pts: 5, kind: 'plus' },
    { t: '예의 바른 말하기', pts: 5, kind: 'plus' },
    { t: '운동·일찍 자기', pts: 5, kind: 'plus' },
    { t: '약속·귀가 시간 어김', pts: -10, kind: 'minus' },
    { t: '스마트폰 과사용', pts: -10, kind: 'minus' },
    { t: '정리 안 하기', pts: -5, kind: 'minus' },
    { t: '다툼·거친 말', pts: -10, kind: 'minus' },
    { t: '숙제 미루기', pts: -5, kind: 'minus' }
  ];
  function sbOf() {
    var v = V9();
    if (!v) return null;
    if (!v.sb || !v.sb.cat) {
      v.sb = { cat: {}, rec: {}, advice: null };
      SB_DEFAULTS.forEach(function (x, i) {
        v.sb.cat['sb' + i] = { t: x.t, pts: x.pts, kind: x.kind, at: now() };
      });
      save();
    }
    if (!v.sb.rec) v.sb.rec = {};
    return v.sb;
  }
  function isKid() {
    var m = me();
    return m && (m.role === '첫째아들' || m.role === '둘째아들' || m.role === '아들');
  }
  function isParent() {
    var m = me();
    return m && (m.role === '아빠' || m.role === '엄마');
  }
  function sbTotals(sb) {
    var t = {};
    Object.keys(sb.rec).forEach(function (k) {
      var r = sb.rec[k];
      if (!r || r.del || r.st !== 'ok') return;
      t[r.to] = (t[r.to] || 0) + (r.pts || 0);
    });
    return t;
  }
  function sbRows(sb, filter) {
    return Object.keys(sb.rec).map(function (k) { sb.rec[k]._id = k; return sb.rec[k]; })
      .filter(function (r) { return r && !r.del && (!filter || filter(r)); })
      .sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
  }
  function catName(sb, id) { var c = sb.cat[id]; return c ? c.t : (id || ''); }
  function renderSb() {
    var v = V9(), box = $('v9SbBody');
    if (!v || !box) return;
    var sb = sbOf();
    var tot = sbTotals(sb);
    var ms = F.members();
    var pending = sbRows(sb, function (r) { return r.st === 'pending'; });
    var html =
      /* 점수판 */
      '<div class="sb9-scores">' + ms.map(function (m) {
        var t = tot[m.id] || 0;
        var pos = Math.max(0, t), neg = Math.max(0, -t);
        var all = sbRows(sb, function (r) { return r.to === m.id && r.st === 'ok'; });
        var plus = all.filter(function (r) { return r.pts > 0; }).length;
        var minus = all.filter(function (r) { return r.pts < 0; }).length;
        var pct = (plus + minus) ? Math.round(plus / (plus + minus) * 100) : 100;
        return '<div class="sb9-me' + (me() && m.id === me().id ? ' me' : '') + '">' +
          '<b>' + (m.emoji || '🧑') + ' ' + esc(m.name) + '</b>' +
          '<span class="pt' + (t < 0 ? ' neg' : '') + '">' + (t > 0 ? '+' : '') + t + '점</span>' +
          '<span class="ratio">👍' + plus + ' 👎' + minus + '</span>' +
          '<div class="sb9-bar"><i style="width:' + pct + '%"></i></div>' +
          '</div>';
      }).join('') + '</div>' +
      /* 버튼 */
      '<div class="sb9-acts">' +
      (isParent() ? '<button type="button" class="btn soft" id="sb9Give" style="padding:9px 12px;font-size:12.5px">🏅 상점·벌점 주기</button>' : '') +
      '<button type="button" class="btn soft" id="sb9Suggest" style="padding:9px 12px;font-size:12.5px">🙋 잘한 일 건의 올리기</button>' +
      '<button type="button" class="btn ghost" id="sb9Cat" style="padding:9px 12px;font-size:12.5px">⚙️ 항목 편집</button>' +
      '</div>' +
      /* 건의(승인 대기) */
      (pending.length ? '<div class="sb9-pend"><div class="sb9-h">📮 건의 ' + pending.length + '건' + (isParent() ? ' — 사진을 확인하고 승인하세요' : ' — 엄마·아빠 확인 중') + '</div>' +
        pending.slice(0, 6).map(function (r) {
          return '<div class="sb9-pend-row">' +
            (r.img && r.img.thumb ? '<img src="' + r.img.thumb + '" alt="근거 사진" data-sb9img="' + r._id + '">' : '🙋') +
            '<div class="tx"><b>' + esc(memName(r.from)) + ' → ' + esc(memName(r.to)) + '</b>' +
            '<small>' + esc(r.note || catName(sb, r.cat)) + ' (' + (r.pts > 0 ? '+' : '') + r.pts + '점 신청)</small></div>' +
            (isParent() ? '<span class="ops"><button type="button" class="ok" data-sb9ok="' + r._id + '">✅ 승인</button><button type="button" class="no" data-sb9no="' + r._id + '">반려</button></span>' : '<span class="wait">대기 중</span>') +
            '</div>';
        }).join('') + '</div>' : '') +
      /* 최근 내역 */
      '<div class="sb9-h">📜 최근 상벌점 내역</div>' +
      (function () {
        var rows = sbRows(sb, function (r) { return r.st === 'ok'; }).slice(0, 6);
        if (!rows.length) return '<div class="v4-empty">아직 기록이 없어요 — 잘한 일을 서로 알려 주세요!</div>';
        return rows.map(function (r) {
          return '<div class="sb9-row"><span class="ic">' + (r.pts > 0 ? '🏅' : '⚠️') + '</span>' +
            '<span class="tx"><b>' + esc(memName(r.to)) + '</b> · ' + esc(catName(sb, r.cat)) + (r.note ? '<small>' + esc(r.note) + '</small>' : '') + '</span>' +
            '<span class="who">' + esc(memName(r.from)) + '</span>' +
            '<span class="pt">' + (r.pts > 0 ? '+' : '') + r.pts + '</span></div>';
        }).join('');
      })() +
      /* 미쁠 조언 */
      '<div class="sb9-adv"><div class="sb9-h">💡 미쁠의 맞춤 조언</div>' +
      '<div id="sb9AdvTxt">' + esc(sb.advice && sb.advice.text || sbRuleAdvice(sb)) + '</div>' +
      '<button type="button" class="btn ghost" id="sb9AiAdv" style="margin-top:7px;padding:8px 12px;font-size:12px">💚 미쁠에게 맞춤 조언 받기' + (global.FAM9AI && global.FAM9AI.key() ? '' : ' (키 등록 필요)') + '</button></div>';
    if (box.__sig !== html) { box.__sig = html; box.innerHTML = html; }
  }
  function sbRuleAdvice(sb) {
    var rows = sbRows(sb, function (r) { return r.st === 'ok' && r.pts < 0; });
    if (!rows.length) return '아직 벌점 기록이 없어요! 지금처럼 서로 잘한 일을 챙겨 주면 됩니다. 👍';
    var cnt = {};
    rows.forEach(function (r) { cnt[r.cat] = (cnt[r.cat] || 0) + 1; });
    var topId = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; })[0];
    var topN = cnt[topId];
    var TIP = {
      '스마트폰 과사용': '스마트폰 사용 시간을 정해 두고, 끝나고 나서 방금 한 재미있는 일 한 가지를 가족에게 이야기해 보면 어떨까요?',
      '숙제 미루기': '숙제는 "조금만" 정하고 바로 시작하는 5분 규칙이 효과가 있어요. 시작하면 의외로 재미있어지거든요!',
      '정리 안 하기': '자기 전에 3분 타이머를 켜고 딱 3분만 정리해 보세요. 내일 아침이 훨씬 기분 좋아져요.',
      '다툼·거친 말': '화가 날 때는 한 걸음 물러나 물 한 잔 마시고 이야기해 보세요. 서로 아끼는 마음은 그대로예요.',
      '약속·귀가 시간 어김': '휴대폰 알림을 약속 15분 전에 맞춰 두고, 늦을 것 같으면 미리 알려 주는 습관을 만들어 봐요.'
    };
    return '최근 ' + esc(catName(sb, topId)) + '을(를) ' + topN + '번 반복했어요. ' + (TIP[catName(sb, topId)] || '같은 실수가 반복되면 가족과 함께 대책을 정해 보세요. 잘한 일도 꾸준히 챙겨 주면 상점이 쑥쑥 쌓여요!');
  }
  function sbGiveSheet(kind) {
    var sb = sbOf();
    var v = V9();
    var cats = Object.keys(sb.cat).map(function (k) { sb.cat[k]._id = k; return sb.cat[k]; })
      .filter(function (c) { return !c.del && c.kind === kind; })
      .sort(function (a, b) { return b.pts - a.pts; });
    F.openSheet('<h3>' + (kind === 'plus' ? '🏅 상점 주기' : '⚠️ 벌점 주기') + '</h3>' +
      '<div class="form-row"><label>누구에게</label><select class="field" id="sb9To">' +
      F.members().filter(function (m) { return me() && m.id !== me().id; }).map(function (m) {
        return '<option value="' + m.id + '">' + m.emoji + ' ' + esc(m.name) + '</option>';
      }).join('') + '</select></div>' +
      '<div class="form-row"><label>항목</label><select class="field" id="sb9Cat">' +
      cats.map(function (c) { return '<option value="' + c._id + '">' + (c.pts > 0 ? '+' : '') + c.pts + ' · ' + esc(c.t) + '</option>'; }).join('') + '</select></div>' +
      '<div class="form-row"><label>메모 (선택)</label><input class="field" id="sb9Note" maxlength="60" placeholder="예: 오늘 스스로 수학 숙제 다 했어요"></div>' +
      '<div style="display:flex;gap:8px;margin-top:6px"><button type="button" class="btn ghost" data-sheet-close>취소</button><button type="button" class="btn" id="sb9GiveSave">부여하기</button></div>');
    $('sb9GiveSave').onclick = function () {
      var to = $('sb9To').value, cat = $('sb9Cat').value, note = ($('sb9Note').value || '').trim();
      if (!to || !cat) { toast('대상·항목을 골라 주세요'); return; }
      var sb2 = sbOf();
      var c = sb2.cat[cat];
      var id = 'r' + now().toString(36) + Math.random().toString(36).slice(2, 4);
      sb.rec[id] = { from: mid(), to: to, cat: cat, pts: c.pts, note: note, st: 'ok', ymd: todayYmd(), at: now() };
      save();
      logEdit('상벌점 ' + (kind === 'plus' ? '상점' : '벌점') + ' 부여', memName(to) + ' ' + (c.pts > 0 ? '+' : '') + c.pts + '점 · ' + c.t);
      F.closeSheet();
      $('v9SbBody').__sig = null;
      renderSb();
      toast((c.pts > 0 ? '🏅 ' : '⚠️ ') + memName(to) + '님에게 ' + (c.pts > 0 ? '+' : '') + c.pts + '점을 부여했어요');
    };
  }
  function sbSuggestSheet() {
    var sb = sbOf();
    var cats = Object.keys(sb.cat).map(function (k) { sb.cat[k]._id = k; return sb.cat[k]; })
      .filter(function (c) { return !c.del && c.kind === 'plus'; });
    F.openSheet('<h3>🙋 잘한 일 건의 올리기</h3>' +
      '<div class="sdesc">근거 사진과 함께 엄마·아빠에게 올리면, 확인 후 칭찬 승인 + 상점 + (용돈까지) 한 번에 처리돼요!</div>' +
      '<div class="form-row"><label>누구의 잘한 일인가요</label><select class="field" id="sb9SugTo">' +
      F.members().filter(function (m) { return m.role === '첫째아들' || m.role === '둘째아들'; }).map(function (m) {
        return '<option value="' + m.id + '">' + m.emoji + ' ' + esc(m.name) + '</option>';
      }).join('') + '</select></div>' +
      '<div class="form-row"><label>상점 항목</label><select class="field" id="sb9SugCat">' +
      cats.map(function (c) { return '<option value="' + c._id + '">+' + c.pts + ' · ' + esc(c.t) + '</option>'; }).join('') + '</select></div>' +
      '<div class="form-row"><label>어떻게 잘했나요?</label><input class="field" id="sb9SugNote" maxlength="80" placeholder="예: 오늘 방 청소를 스스로 다 했어요!"></div>' +
      '<div class="form-row"><label>근거 사진</label><button type="button" class="btn ghost" id="sb9SugPhoto">📷 사진 찍어 올리기</button><div id="sb9SugPrev" style="margin-top:7px"></div></div>' +
      '<div style="display:flex;gap:8px;margin-top:6px"><button type="button" class="btn ghost" data-sheet-close>취소</button><button type="button" class="btn" id="sb9SugSave">건의 올리기</button></div>');
    var photo = null;
    $('sb9SugPhoto').onclick = function () {
      F.pickImages(function (files) {
        F.saveMedia(files[0]).then(function (m) {
          photo = m;
          $('sb9SugPrev').innerHTML = '<img src="' + m.thumb + '" style="width:100%;border-radius:12px">';
        }).catch(function () { toast('사진을 올리지 못했어요'); });
      }, true);
    };
    $('sb9SugSave').onclick = function () {
      var to = $('sb9SugTo').value, cat = $('sb9SugCat').value, note = ($('sb9SugNote').value || '').trim();
      if (!to || !cat) { toast('대상·항목을 골라 주세요'); return; }
      var sb2 = sbOf();
      var c = sb2.cat[cat];
      var id = 'r' + now().toString(36) + Math.random().toString(36).slice(2, 4);
      sb2.rec[id] = { from: mid(), to: to, cat: cat, pts: c.pts, note: note, img: photo, st: 'pending', ymd: todayYmd(), at: now() };
      save();
      logEdit('잘한 일 건의', memName(to) + ' · ' + c.t + (photo ? ' · 사진 첨부' : ''));
      F.closeSheet();
      $('v9SbBody').__sig = null;
      renderSb();
      toast('📮 건의를 올렸어요 — 근거 사진은 앨범에 계속 남아요');
    };
  }
  function sbApprove(id, withMoney) {
    var sb = sbOf();
    var r = sb.rec[id];
    if (!r || r.st !== 'pending') return;
    if (withMoney) {
      F.openSheet('<h3>💰 승인 + 용돈 즉시 지급</h3>' +
        '<div class="sdesc">' + esc(memName(r.to)) + '의 건의를 승인하고, 용돈기입장에 받은 용돈으로 바로 기록할 금액을 정해요.</div>' +
        '<div class="form-row"><label>지급할 용돈 (원)</label><input class="field" id="sb9MoneyAmt" type="number" inputmode="numeric" value="2000"></div>' +
        '<div style="display:flex;gap:8px;margin-top:6px"><button type="button" class="btn ghost" data-sheet-close>돌아가기</button><button type="button" class="btn" id="sb9MoneyOk">✅ 칭찬 승인 + 지급</button></div>');
      $('sb9MoneyOk').onclick = function () {
        var amt = Math.round(Number($('sb9MoneyAmt').value || 0));
        var v2 = V9();
        var sb2 = sbOf();
        var r2 = sb2.rec[id];
        if (!r2 || r2.st !== 'pending') { F.closeSheet(); toast('이미 처리된 건의예요'); return; }
        r2.st = 'ok';
        r2.done = { amt: amt, by: mid(), at: now() };
        r2.at = now();
        if (amt > 0) {
          var yk = todayYmd();
          if (!v2.moneyD[r2.to]) v2.moneyD[r2.to] = {};
          if (!v2.moneyD[r2.to][yk]) v2.moneyD[r2.to][yk] = { items: [] };
          if (!v2.moneyD[r2.to][yk].items) v2.moneyD[r2.to][yk].items = [];
          v2.moneyD[r2.to][yk].items.push({ k: 'got', amt: amt, t: '🏅 상점 리워드 · ' + catName(sb2, r2.cat), at: now() });
          v2.moneyD[r2.to][yk].at = now();
        }
        save();
        logEdit('건의 승인 + 상점·용돈 지급', memName(r2.to) + ' +' + r2.pts + '점' + (amt ? ' · ' + amt + '원' : ''));
        F.closeSheet();
        $('v9SbBody').__sig = null;
        renderSb();
        toast('🎉 칭찬 승인! +' + r2.pts + '점' + (amt ? ' · ' + amt + '원 지급' : ''));
      };
      return;
    }
    r.st = 'ok';
    r.done = { amt: 0, by: mid(), at: now() };
    r.at = now();
    save();
    logEdit('건의 승인 + 상점 부여', memName(r.to) + ' +' + r.pts + '점');
    $('v9SbBody').__sig = null;
    renderSb();
    toast('🎉 칭찬 승인! +' + r.pts + '점을 부여했어요');
  }
  function sbCatSheet() {
    var sb = sbOf();
    var cats = Object.keys(sb.cat).map(function (k) { sb.cat[k]._id = k; return sb.cat[k]; })
      .filter(function (c) { return !c.del; });
    F.openSheet('<h3>⚙️ 상벌점 항목 편집</h3>' +
      '<div class="sdesc">가족 상황에 맞게 항목을 추가·수정·삭제하세요. 점수는 -50~+50까지 가능해요.</div>' +
      '<div id="sb9CatList">' + cats.map(function (c) {
        return '<div class="sb9-catrow"><input class="field" data-sb9ct="' + c._id + '" value="' + esc(c.t) + '" maxlength="24" style="flex:1;margin-bottom:0">' +
          '<input class="field" data-sb9cp="' + c._id + '" type="number" value="' + c.pts + '" style="width:76px;margin-bottom:0">' +
          '<button type="button" class="v4-tag gray" data-sb9cdel="' + c._id + '" style="border:none">✕</button></div>';
      }).join('') + '</div>' +
      '<button type="button" class="btn soft" id="sb9CatAdd" style="margin-top:8px">＋ 항목 추가</button>' +
      '<button type="button" class="btn" id="sb9CatSave" style="margin-top:8px">저장</button>');
    var n = 0;
    $('sb9CatAdd').onclick = function () {
      var div = document.createElement('div');
      div.className = 'sb9-catrow';
      div.innerHTML = '<input class="field" data-sb9ct="new' + n + '" placeholder="새 항목 이름" maxlength="24" style="flex:1;margin-bottom:0">' +
        '<input class="field" data-sb9cp="new' + (n++) + '" type="number" value="5" style="width:76px;margin-bottom:0">' +
        '<button type="button" class="v4-tag gray" data-sb9cdelnew style="border:none">✕</button>';
      div.querySelector('[data-sb9cdelnew]').onclick = function () { div.remove(); };
      $('sb9CatList').appendChild(div);
    };
    $('sb9CatList').addEventListener('click', function (e) {
      var del = e.target.closest('[data-sb9cdel]');
      if (del) { sb.cat[del.getAttribute('data-sb9cdel')].del = 1; del.closest('.sb9-catrow').remove(); }
    });
    $('sb9CatSave').onclick = function () {
      var sb3 = sbOf();
      document.querySelectorAll('#sb9CatList .sb9-catrow').forEach(function (row) {
        var tIn = row.querySelector('[data-sb9ct]'), pIn = row.querySelector('[data-sb9cp]');
        if (!tIn || !pIn) return;
        var id = tIn.getAttribute('data-sb9ct');
        var t = (tIn.value || '').trim();
        var pts = Math.max(-50, Math.min(50, Math.round(Number(pIn.value || 0))));
        if (!t) return;
        if (!sb3.cat[id] || sb3.cat[id].del) {
          var nid = 'c' + now().toString(36) + Math.random().toString(36).slice(2, 4);
          sb3.cat[nid] = { t: t, pts: pts, kind: pts >= 0 ? 'plus' : 'minus', at: now() };
        } else {
          sb3.cat[id].t = t; sb3.cat[id].pts = pts; sb3.cat[id].kind = pts >= 0 ? 'plus' : 'minus'; sb3.cat[id].at = now();
        }
      });
      save();
      logEdit('상벌점 항목 편집', Object.keys(sb.cat).length + '개 항목');
      F.closeSheet();
      $('v9SbBody').__sig = null;
      renderSb();
      toast('상벌점 항목을 저장했어요');
    };
  }
  function wireSb() {
    document.addEventListener('click', function (e) {
      var v = V9();
      if (!v) return;
      var g = e.target.closest('#sb9Give');
      if (g) {
        sbGiveSheet('plus');
        return;
      }
      var sg = e.target.closest('#sb9Suggest');
      if (sg) { sbSuggestSheet(); return; }
      var ct = e.target.closest('#sb9Cat');
      if (ct) { sbCatSheet(); return; }
      var ok = e.target.closest('[data-sb9ok]');
      if (ok) { sbApprove(ok.getAttribute('data-sb9ok'), true); return; }
      var no = e.target.closest('[data-sb9no]');
      if (no) {
        var r2 = sbOf().rec[no.getAttribute('data-sb9no')];
        if (r2) { r2.st = 'no'; r2.at = now(); save(); $('v9SbBody').__sig = null; renderSb(); toast('반려했어요 — 기록은 남기지 않아요'); }
        return;
      }
      var adv = e.target.closest('#sb9AiAdv');
      if (adv) {
        if (!global.FAM9AI || !global.FAM9AI.key()) { global.FAM9AI.keySheet('미쁠 맞춤 조언', '상벌점 패턴을 보고 미쁠이가 따뜻한 조언을 만들어 줘요.', function () { wireSb(); }); return; }
        var sb2 = sbOf();
        toast('💚 미쁠이 상벌점 패턴을 보는 중…');
        var lines = sbRows(sb2, function (r) { return r.st === 'ok'; }).slice(0, 20).map(function (r) {
          return memName(r.to) + ' · ' + catName(sb2, r.cat) + ' (' + r.pts + '점) — ' + memName(r.from);
        }).join('\n');
        var liveAdv = '';
        try { liveAdv = buildLiveFamContext(); } catch (err) { liveAdv = ''; }
        global.FAM9AI.ask(
          (liveAdv ? liveAdv + '\n\n' : '') +
          '우리 가족 상벌점 기록이야:\n' + (lines || '(아직 기록 없음)') + '\n' +
          '위 기록의 지금 기분·일정·수면까지 살펴서, 반복된 벌점과 잘한 일을 아이들이 상처받지 않게 따뜻한 조언 2~3문장으로 해줘. 이모지 1개 이하. 조언 본문만.'
        ).then(function (txt) {
          var sb3 = sbOf();
          sb3.advice = { text: txt.slice(0, 400), at: now(), ymd: todayYmd() };
          save();
          $('v9SbBody').__sig = null;
          renderSb();
        }).catch(function () { toast('미쁠 조언 실패 — 잠시 후 다시'); });
      }
    });
  }

  /* ============================================================
     ⑬ 지금 우리 가족 기분 (실시간 이모티콘 보드 · 홈 최상단 고정)
     DOC.v9.mood[mid] = {e, note, at, ymd} · DOC.v9.moodHist[id] = {mid,e,note,at,ymd}
     ============================================================ */
  var MOODS = [
    { e: '😊', t: '행복·좋음' }, { e: '🥰', t: '설렘·사랑' }, { e: '😎', t: '뿌듯·신남' }, { e: '😐', t: '보통·무난' },
    { e: '😴', t: '피곤·졸림' }, { e: '😓', t: '힘듦·지침' }, { e: '😢', t: '속상·슬픔' }, { e: '😡', t: '화남·짜증' },
    { e: '🤩', t: '기대·할 일 있음' }, { e: '🥺', t: '아쉽·보고 싶다' }, { e: '🤒', t: '아파요' }, { e: '🕺', t: '득템·대박' }
  ];
  function renderMood() {
    var v = V9(), box = $('v9MoodBody');
    if (!v || !box) return;
    var ms = F.members();
    var html = '<div class="mo9-grid">' + ms.map(function (m) {
      var r = v.mood[m.id] || {};
      var mine = me() && m.id === me().id;
      var when = r.at ? (new Date(r.at).toDateString() === new Date().toDateString() ? '오늘 ' + F.hhmm(r.at) : F.ago(r.at)) : '';
      return '<button type="button" class="mo9-cell' + (mine ? ' mine' : '') + (r.e ? '' : ' empty') + '" data-mo9sel="' + (mine ? '1' : '') + '">' +
        '<span class="e">' + (r.e || '🫥') + '</span>' +
        '<b>' + (m.emoji || '🧑') + ' ' + esc(m.name) + '</b>' +
        (r.note ? '<small class="note">' + esc(r.note) + '</small>' : (mine ? '<small class="note none">눌러서 기분 남기기</small>' : '<small class="note none">기록 전</small>')) +
        (when ? '<small class="at">' + esc(when) + '</small>' : '') +
        '</button>';
    }).join('') + '</div>' +
    '<div class="mo9-foot"><button type="button" class="btn ghost" id="mo9Mind" style="padding:7px 12px;font-size:11.5px">🧠 마음 현황판으로 자세히 보기</button></div>';
    if (box.__sig !== html) { box.__sig = html; box.innerHTML = html; }
  }
  function moodSheet() {
    var v = V9();
    var cur = v.mood[mid()] || {};
    F.openSheet('<h3>🎭 지금 내 기분은?</h3>' +
      '<div class="sdesc">이모티콘과 한마디를 남기면 가족 모두가 홈에서 바로 봐요.</div>' +
      '<div class="mo9-grid pick">' + MOODS.map(function (m) {
        return '<button type="button" class="mo9-cell" data-mo9e="' + m.e + '">' +
          '<span class="e">' + m.e + '</span><small>' + m.t + '</small></button>';
      }).join('') + '</div>' +
      '<div class="form-row"><label>한마디 (선택)</label><input class="field" id="mo9Note" maxlength="30" value="' + esc(cur.note || '') + '" placeholder="예: 오늘 시험 화이팅!"></div>' +
      '<button type="button" class="btn" id="mo9Save" style="margin-top:6px">기분 저장하기</button>');
    var sel = { e: cur.e || '', t: cur.t || '' };
    var paint = function () {
      document.querySelectorAll('[data-mo9e]').forEach(function (b) {
        b.classList.toggle('on', b.getAttribute('data-mo9e') === sel.e);
      });
    };
    paint();
    $('sheet').addEventListener('click', function h(ev) {
      var b = ev.target.closest('[data-mo9e]');
      if (b) { sel = { e: b.getAttribute('data-mo9e'), t: b.textContent || '' }; paint(); }
    });
    $('mo9Save').onclick = function () {
      if (!sel.e) { toast('기분 이모티콘을 골라 주세요'); return; }
      var note = ($('mo9Note').value || '').trim();
      var v2 = V9();
      v2.mood[mid()] = { e: sel.e, t: sel.t, note: note, at: now(), ymd: todayYmd() };
      var hid = 'm' + now().toString(36) + Math.random().toString(36).slice(2, 4);
      v2.moodHist[hid] = { mid: mid(), e: sel.e, t: sel.t, note: note, at: now(), ymd: todayYmd() };
      save();
      logEdit('기분 보드 변경', sel.e + ' ' + sel.t + (note ? ' · ' + note : ''));
      F.closeSheet();
      $('v9MoodBody').__sig = null;
      renderMood();
      toast(sel.e + ' 오늘 기분을 가족에게 알렸어요!');
    };
  }
  function wireMood() {
    document.addEventListener('click', function (e) {
      var v = V9();
      if (!v) return;
      var sel = e.target.closest('[data-mo9sel="1"]');
      if (sel) { moodSheet(); return; }
      var mind = e.target.closest('#mo9Mind');
      if (mind) {
        if (global.FAM4) { try { global.FAM4.jump({ v: 'all', s: 'v5Mind' }); } catch (err) {} }
        else F.view('all');
      }
    });
  }

  /* ============================================================
     카드 마크업
     ============================================================ */
  function ensureHomeCards() {
    var home = $('view-home');
    if (!home) return;
    /* id 없는 원래 카드에도 안정적 자동 id를 부여해 꾸미기(순서·숨김) 대상에 포함 */
    Array.prototype.forEach.call(home.children, function (ch) {
      if (ch.id) return;
      var h = ch.querySelector ? ch.querySelector('h2, b') : null;
      var key = h ? h.textContent.trim() : (ch.className || 'el');
      var hsh = 0;
      for (var i = 0; i < key.length; i++) hsh = (hsh * 31 + key.charCodeAt(i)) >>> 0;
      ch.id = 'v9n' + hsh.toString(36);
    });
    var brief = $('briefCard');
    /* 삽입 앵커를 한 번 고정해 카드 순서가 뒤집히지 않게 한다 */
    var anchor = brief ? brief.nextSibling : null;
    var mk = function (id, cls, html) {
      if ($(id)) return;
      var div = document.createElement('div');
      div.id = id;
      div.className = cls || 'card';
      div.innerHTML = html;
      home.insertBefore(div, anchor);
    };
    /* 명언: 날씨 카드(overcast) 인근 → briefCard 위에 둔다 */
    /* 기분 보드: 홈 가장 위(꾸미기 버튼 바로 아래) 고정 */
    if (!$('v9MoodCard')) {
      var mo = document.createElement('div');
      mo.id = 'v9MoodCard';
      mo.className = 'card';
      mo.style.cssText = 'border:1.5px solid #F6D9E4;background:linear-gradient(180deg,#FFF5F8,#FFFFFF)';
      mo.innerHTML = '<div class="card-head"><h2>🎭 지금 우리 가족 기분</h2><span class="sub">실시간 · 원터치 공유</span></div><div id="v9MoodBody"></div>';
      /* 가장 위쪽 고정: 달력 배너 위(꾸미기 버튼 바로 아래) */
      var top = $('famCalBanner') || home.firstChild;
      home.insertBefore(mo, top);
    }
    if (!$('v9QuoteCard')) {
      var q = document.createElement('div');
      q.id = 'v9QuoteCard';
      q.className = 'card';
      q.style.cssText = 'border:1.5px solid #EDE3C8;background:linear-gradient(180deg,#FFFBF0,#FFFFFF)';
      q.innerHTML = '<div class="card-head"><h2>📖 오늘의 명언 & 가족 한마디</h2><span class="sub" id="v9QuoteDate">–</span></div><div id="v9QuoteBody"></div>';
      home.insertBefore(q, brief || home.firstChild);
    }
    mk('v9PodCard', 'card', '<div class="card-head"><h2>⭐ 오늘의 대표사진</h2><span class="sub" id="v9PodDate">–</span></div><div id="v9PodBody"></div>');
    if (!$('v9ShiftCard')) {
      var sh = document.createElement('div');
      sh.id = 'v9ShiftCard';
      sh.className = 'card';
      sh.style.cssText = 'border:1.5px solid #F5D9C8;background:linear-gradient(180deg,#FFF6F0,#FFFFFF)';
      sh.innerHTML = '<div class="card-head"><h2>🗓️ 통합 근무표 · 등교표</h2><button type="button" class="v4-tag" id="v9ShiftEdit" style="border:none">수향 출근·방학 설정</button></div>' +
        '<div class="sh9-strip" id="v9ShiftStrip"></div>' +
        '<div class="hint" id="v9ShiftNote">–</div>';
      home.insertBefore(sh, brief ? brief.nextSibling : null);
    }
    mk('v9DdayCard', 'card', '<div class="card-head"><h2>🎂 우리 가족 디데이</h2><button type="button" class="v4-tag" id="v9DdayAdd" style="border:none">＋ 디데이 추가</button></div><div id="v9DdayBody"></div>');
    mk('v9GoalsCard', 'card', '<div class="card-head"><h2>🎯 우리 가족 목표 배너</h2><span class="sub">이번 주 · 이번 달 · 장래희망</span></div><div id="v9GoalsBody"></div>');
    mk('v9SleepCard', 'card', '<div class="card-head"><h2>😴 수면·피로도·에너지</h2><span class="sub">원터치 기록 · 자동 추정</span></div><div id="v9SleepBody"></div>');
    mk('v9SchoolCard', 'card', '<div class="card-head"><h2>🎒 등교·귀가 안심 기록</h2><span class="sub" id="v9SchoolSum">–</span></div><div id="v9SchoolBody"></div>');
    mk('v9NewsCard', 'card', '<div class="card-head"><h2>📰 공부·학원·게임 뉴스</h2><span class="sub">실시간 5분야</span></div><div id="v9NewsBody"></div>');
    mk('v9WkCard', 'card', '<div class="card-head"><h2>🎡 이번 주말 뭐할까 · 뭐먹을까</h2><span class="sub">네이버·카카오맵 바로 연결</span></div><div id="v9WkBody"></div>');
    mk('v9SbCard', 'card', '<div class="card-head"><h2>🏅 우리 가족 상벌점</h2><span class="sub" id="v9SbSum">–</span></div><div id="v9SbBody"></div>');
    mk('v9LogCard', 'card', '<div class="card-head"><h2>🕘 홈 꾸미기 기록</h2><span class="sub">누가 · 언제 · 무엇을</span></div><div id="v9LogBody"></div>');
    decorateEdit();
  }
  function stampDates() {
    var x = new Date();
    var lbl = (x.getMonth() + 1) + '월 ' + x.getDate() + '일';
    ['v9QuoteDate', 'v9PodDate'].forEach(function (id) {
      var el = $(id);
      if (el && el.textContent !== lbl) el.textContent = lbl;
    });
  }

  function render() {
    if (!ON || !F || !F.doc() || !F.me()) return;
    ensureHomeCards();
    applyLayout();
    stampDates();
    renderMood();
    renderQuote();
    renderPod();
    renderShift();
    renderDday();
    renderGoals();
    renderSleep();
    renderSchool();
    renderNews();
    renderWeekend();
    renderSb();
    renderLog();
    robotBtn();
    try { fetchNews(); } catch (e) {}
    try {
      var sbx = V9() && sbOf();
      var tots = sbx ? sbTotals(sbx) : {};
      var sumEl = $('v9SbSum');
      if (sumEl && sbx) sumEl.textContent = F.members().map(function (m) { return m.name + ' ' + ((tots[m.id] || 0) > 0 ? '+' : '') + (tots[m.id] || 0); }).join(' · ');
    } catch (e) {}
  }
  function mount(FAM) {
    if (ON) return;
    F = FAM; ON = true;
    wireQuote(); wirePod(); wireShift(); wireDday(); wireGoals(); wireSleep(); wireSchool(); wireSb(); wireMood();
    render();
  }
  setInterval(function () {
    if (!ON && global.FAM && global.FAM.doc && global.FAM.doc() && global.FAM.me && global.FAM.me()) mount(global.FAM);
  }, 1500);

  var prevRender = global.__FAM_RENDER;
  global.__FAM_RENDER = function () {
    if (prevRender) { try { prevRender(); } catch (e) {} }
    try { render(); } catch (e) { console.warn('HOME9 render', e); }
  };
  var prevView = global.__FAM_VIEW;
  global.__FAM_VIEW = function (v) {
    if (prevView) { try { prevView(v); } catch (e) {} }
    if (v === 'home') { try { render(); } catch (e) {} }
  };

  /* 스타일 */
  function style() {
    if ($('h9style')) return;
    var s = document.createElement('style');
    s.id = 'h9style';
    s.textContent = [
      '.v9-card-hidden{display:none !important}',
      '.v9-editbar{display:flex;justify-content:flex-end;margin-bottom:8px}',
      '.v9-editbar .btn{padding:8px 14px;font-size:12.5px;font-weight:800;border-radius:12px;background:#F1F4F5;color:#3C4450}',
      '.q9{display:flex;flex-direction:column;gap:9px}',
      '.q9-row{display:flex;gap:8px;align-items:flex-start}',
      '.q9-ico{font-size:18px;line-height:1.3}',
      '.q9-body b{font-size:13.5px;letter-spacing:-.2px;display:block;line-height:1.45}',
      '.q9-body small{color:#79838F;font-size:11px;display:block;margin-top:2px}',
      '.q9-acts{display:flex;gap:6px;flex-wrap:wrap}',
      '.pod9 .pod9-ph{border-radius:16px;overflow:hidden;aspect-ratio:16/9;background:#F1F4F5;display:flex;align-items:center;justify-content:center;font-size:34px}',
      '.pod9 .pod9-ph img{width:100%;height:100%;object-fit:cover;display:block}',
      '.pod9-cap{display:flex;flex-direction:column;margin-top:7px}',
      '.pod9-cap b{font-size:13px;font-weight:800}',
      '.pod9-cap small{color:#79838F;font-size:11px}',
      '.pod9.empty .pod9-ph{color:#B8C1CA}',
      '.pod9-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;max-height:50vh;overflow:auto}',
      '.pod9-cell{aspect-ratio:1/1;border-radius:12px;overflow:hidden;border:2px solid transparent;padding:0;background:#F1F4F5}',
      '.pod9-cell.on,.pod9-cell:active{border-color:#0E9F6E}',
      '.pod9-cell img{width:100%;height:100%;object-fit:cover;display:block}',
      '.sh9-strip{display:flex;gap:4px;overflow-x:auto;padding:4px 2px 6px}',
      '.sh9-cell{flex:0 0 58px;display:flex;flex-direction:column;align-items:center;gap:2px;padding:7px 2px;border-radius:12px;background:#FAFBFB;border:1.5px solid #EDF1F4;font-size:10.5px;font-weight:800}',
      '.sh9-cell.today{border-color:#12B886;background:#F0FBF6}',
      '.sh9-cell .d{color:#3C4450}',
      '.sh9-cell .w{color:#9AA4AF;font-size:9.5px}',
      '.sh9-cell .sg{padding:2px 8px;border-radius:20px;font-size:10px}',
      '.sh9-cell .sg.work{background:#FFECEC;color:#D9534F}',
      '.sh9-cell .sg.rest{background:#E7F8F1;color:#0A7D56}',
      '.sh9-cell .sg.vac{background:#F3EBFF;color:#7C4DD9}',
      '.sh9-cell .su{background:#FFF1E5;color:#C96A1E;padding:1.5px 7px;border-radius:20px;font-size:9.5px}',
      '.sh9-cell .sc{background:#EAF2FF;color:#2F6FD0;padding:1.5px 7px;border-radius:20px;font-size:9.5px}',
      '.sh9-cell .sc.off{background:#F1F4F5;color:#79838F}',
      '.dow-grid{display:flex;gap:5px}',
      '.dow{flex:1;padding:9px 0;border-radius:11px;background:#F1F4F5;font-weight:800;font-size:12.5px;color:#5C6673;border:1.5px solid transparent}',
      '.dow.on{background:#FFEDE0;color:#C96A1E;border-color:#F5C9A8}',
      '.dd9{display:flex;align-items:center;gap:9px;padding:9px 4px;border-bottom:1px dashed #EDF1F4;font-size:12.5px}',
      '.dd9 b{font-weight:800;min-width:56px}',
      '.dd9 span{font-weight:900;color:#0A7D56}',
      '.dd9 .bb{color:#C96A1E;font-weight:700;margin-left:auto;font-size:11.5px}',
      '.dd9-del{color:#B8C1CA;font-size:13px;padding:2px 5px}',
      '.nw9{border:1.5px solid #EDF1F4;border-radius:14px;padding:9px 10px;margin-bottom:8px;background:#FBFDFC}',
      '.nw9-h{font-size:12px;font-weight:900;color:#3C4450;margin-bottom:5px}',
      '.nw9-item{display:flex;align-items:center;gap:7px;padding:5px 2px;font-size:12px;color:#14181D;text-decoration:none;border-top:1px dashed #EDF1F4}',
      '.nw9-item:first-of-type{border-top:none}',
      '.nw9-item .t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}',
      '.nw9-item .w{font-size:10px;color:#9AA4AF;flex:none}',
      '.wk9{display:flex;gap:9px}',
      '.wk9-col{flex:1;background:#FBFDFC;border:1.5px solid #EDF1F4;border-radius:14px;padding:9px 10px}',
      '.wk9-h{font-size:11.5px;font-weight:900;color:#3C4450;margin-bottom:5px}',
      '.wk9-item{padding:5px 0;border-top:1px dashed #EDF1F4;font-size:12px}',
      '.wk9-item b{display:block;font-weight:800;letter-spacing:-.2px;line-height:1.4}',
      '.wk9-item .lk{display:flex;gap:5px;margin-top:3px}',
      '.wk9-item .lk a{font-size:10px;font-weight:800;text-decoration:none;padding:2.5px 8px;border-radius:20px;background:#FFF7DB;color:#8A6A00}',
      '.wk9-item .lk a:last-child{background:#F0F5FF;color:#2F6FD0}',
      '.wk9-near{display:flex;align-items:center;flex-wrap:wrap;gap:5px;margin-top:9px;font-size:11px;font-weight:800;color:#5C6673}',
      '.wk9-near a{font-size:10.5px;font-weight:800;text-decoration:none;padding:3px 8px;border-radius:20px;background:#F1F4F5;color:#3C4450}',
      '.gl9{border:1.5px solid #EDF1F4;border-radius:14px;padding:10px;margin-bottom:8px;background:#FBFDFC}',
      '.gl9-head{font-size:13px;font-weight:800;margin-bottom:5px}',
      '.gl9-mine{font-size:10px;background:#E7F8F1;color:#0A7D56;border-radius:20px;padding:2px 8px;font-weight:800}',
      '.gl9-row{display:flex;gap:7px;font-size:12px;padding:3px 0;align-items:baseline}',
      '.gl9-row span{color:#79838F;flex:0 0 72px;font-weight:700;font-size:11px}',
      '.gl9-row b{font-weight:800;letter-spacing:-.2px}',
      '.gl9-empty{color:#B8C1CA;font-weight:400;font-style:normal}',
      '.gl9-acts{display:flex;gap:6px;margin-top:6px}',
      '.sl9{border:1.5px solid #EDF1F4;border-radius:14px;padding:9px 11px;margin-bottom:8px;background:#FBFDFC}',
      '.sl9.me{border-color:#BFEBD8;background:#F6FCF9}',
      '.sl9-n{font-size:12.5px;font-weight:800;display:flex;align-items:center;gap:6px}',
      '.sl9-zzz{font-size:10px;background:#F3EBFF;color:#7C4DD9;border-radius:20px;padding:2px 8px}',
      '.sl9-stats{display:flex;gap:9px;font-size:11.5px;font-weight:800;color:#3C4450;margin:5px 0 4px}',
      '.sl9-bar{height:7px;border-radius:20px;background:#EDF1F4;overflow:hidden}',
      '.sl9-bar i{display:block;height:100%;border-radius:20px;background:linear-gradient(90deg,#0E9F6E,#54C99B)}',
      '.sl9-none{color:#9AA4AF;font-size:11px}',
      '.sl9-btns{display:flex;gap:6px;margin-top:7px}',
      '.sc9{border:1.5px solid #EDF1F4;border-radius:14px;padding:9px 11px;margin-bottom:8px;background:#FBFDFC}',
      '.sc9-head{font-size:12.5px;font-weight:800;margin-bottom:5px}',
      '.sc9-flow{display:flex;gap:5px;flex-wrap:wrap}',
      '.sc9-step{font-size:10.5px;font-weight:800;padding:3px 8px;border-radius:20px;background:#F1F4F5;color:#79838F}',
      '.sc9-step.on{background:#E7F8F1;color:#0A7D56}',
      '.sc9-btns{display:flex;gap:5px;margin-top:7px}',
      '.sb9-scores{display:grid;grid-template-columns:repeat(2,1fr);gap:7px;margin-bottom:9px}',
      '.sb9-me{border:1.5px solid #EDF1F4;border-radius:12px;padding:8px 10px;background:#FBFDFC;display:flex;flex-wrap:wrap;align-items:center;gap:5px}',
      '.sb9-me.me{border-color:#BFEBD8;background:#F6FCF9}',
      '.sb9-me b{font-size:12.5px;font-weight:800;width:100%;display:flex;gap:5px}',
      '.sb9-me .pt{font-weight:900;color:#0A7D56;font-size:13px}',
      '.sb9-me .pt.neg{color:#D9534F}',
      '.sb9-me .ratio{font-size:10px;color:#9AA4AF;margin-left:auto}',
      '.sb9-bar{width:100%;height:6px;border-radius:20px;background:#EDF1F4;overflow:hidden}',
      '.sb9-bar i{display:block;height:100%;background:linear-gradient(90deg,#0E9F6E,#54C99B)}',
      '.sb9-acts{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:9px}',
      '.sb9-h{font-size:11.5px;font-weight:900;color:#5C6673;margin:8px 0 5px}',
      '.sb9-pend{background:#FFF9F2;border:1.5px solid #F5D9C8;border-radius:14px;padding:9px 10px;margin-bottom:9px}',
      '.sb9-pend-row{display:flex;align-items:center;gap:8px;padding:5px 0;font-size:12px}',
      '.sb9-pend-row img{width:46px;height:46px;border-radius:10px;object-fit:cover;flex:none}',
      '.sb9-pend-row .tx{flex:1;min-width:0}',
      '.sb9-pend-row .tx b{font-weight:800;display:block}',
      '.sb9-pend-row .tx small{color:#79838F;font-size:11px}',
      '.sb9-pend-row .ops{display:flex;gap:4px;flex:none}',
      '.sb9-pend-row .ops .ok{background:#0E9F6E;color:#fff;font-weight:800;font-size:11px;padding:5px 9px;border-radius:9px}',
      '.sb9-pend-row .ops .no{background:#F1F4F5;color:#5C6673;font-weight:800;font-size:11px;padding:5px 9px;border-radius:9px}',
      '.sb9-pend-row .wait{font-size:10px;background:#F1F4F5;color:#79838F;border-radius:20px;padding:3px 8px;font-weight:800}',
      '.sb9-row{display:flex;align-items:baseline;gap:7px;font-size:12px;padding:5px 2px;border-bottom:1px dashed #EDF1F4}',
      '.sb9-row .tx{flex:1;min-width:0}',
      '.sb9-row .tx b{font-weight:800}',
      '.sb9-row .tx small{display:block;color:#79838F;font-size:11px}',
      '.sb9-row .who{color:#9AA4AF;font-size:10.5px;flex:none}',
      '.sb9-row .pt{font-weight:900;color:#0A7D56;flex:none}',
      '.sb9-adv{background:linear-gradient(180deg,#F7FBFF,#FFFFFF);border:1.5px solid #DCE7FA;border-radius:14px;padding:10px 11px;margin-top:9px}',
      '.sb9-adv #sb9AdvTxt{font-size:12px;line-height:1.6;color:#2F3B47;word-break:keep-all}',
      '.sb9-catrow{display:flex;gap:6px;margin-bottom:6px;align-items:center}',
      '.mo9-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}',
      '.mo9-grid.pick{max-height:44vh;overflow:auto;padding:2px}',
      '.mo9-cell{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 3px;border-radius:13px;background:#FBFDFC;border:1.5px solid #EDF1F4;min-width:0}',
      '.mo9-cell .e{font-size:24px;line-height:1.15}',
      '.mo9-cell b{font-size:11px;font-weight:800;letter-spacing:-.2px;color:#3C4450;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mo9-cell .note{font-size:9.5px;color:#79838F;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mo9-cell .note.none{color:#C3CBD3}',
      '.mo9-cell .at{font-size:9px;color:#B8C1CA}',
      '.mo9-cell.mine{border-color:#F0B9CE;background:#FFF7FA}',
      '.mo9-cell.empty .e{opacity:.45}',
      '.mo9-cell:active{transform:scale(.97)}',
      '.mo9-cell.on{border-color:#E56A9A;background:#FFEFF5}',
      '.mo9-cell.pick .e{font-size:26px}',
      '.mo9-cell.pick small{font-size:9.5px;font-weight:800;color:#5C6673}',
      '.mo9-foot{display:flex;justify-content:flex-end;margin-top:7px}',
      '.mo9-foot .btn{border-radius:11px;background:#F7F4F8;color:#7C4D70}',
      '.ly9-row{display:flex;align-items:center;gap:7px;padding:8px 2px;border-bottom:1px dashed #EDF1F4;font-size:12.5px}',
      '.ly9-row.off .n{color:#B8C1CA;text-decoration:line-through}',
      '.ly9-row .n{flex:1;font-weight:800}',
      '.ly9-row .ops{display:flex;gap:4px}',
      '.ly9-row .ops button{padding:5px 9px;border-radius:9px;background:#F1F4F5;font-size:11px;font-weight:800;color:#3C4450}',
      '.lg9-row{display:flex;align-items:baseline;gap:6px;font-size:12px;padding:5px 2px;border-bottom:1px dashed #EDF1F4;flex-wrap:wrap}',
      '.lg9-row b{font-weight:800}',
      '.lg9-row .at{margin-left:auto;color:#9AA4AF;font-size:10.5px;flex:none}',
      '#f9robot{position:fixed;right:14px;bottom:calc(148px + var(--safe-b,0px));z-index:60;width:56px;height:56px;border-radius:50%;background:linear-gradient(180deg,#F2FDF8,#E4F9EF);border:1.5px solid #A7F3D0;box-shadow:0 10px 24px rgba(6,148,88,.20);display:flex;align-items:center;justify-content:center;animation:f9bob 3.2s ease-in-out infinite}',
'#f9robot svg{display:block;pointer-events:none}',
'#f9robot:active{transform:scale(.93)}',
'@keyframes f9bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}',
'#f9chat{position:fixed;right:12px;bottom:calc(96px + var(--safe-b,0px));z-index:75;width:min(340px,calc(100vw - 24px));background:#fff;border-radius:20px;border:1.5px solid #D7EDE2;box-shadow:0 16px 40px rgba(20,24,29,.18);overflow:hidden;display:flex;flex-direction:column;max-height:70vh}',
'#f9chat.hidden{display:none}',
'.f9chat-head{display:flex;align-items:center;gap:7px;padding:10px 12px;background:linear-gradient(135deg,#0E9F6E,#12B886);color:#fff}',
'.f9chat-av{flex:none;width:26px;height:26px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center}',
'.f9chat-title{display:flex;flex-direction:column;line-height:1.15;font-weight:900;font-size:13.5px}',
'.f9chat-title small{font-weight:700;font-size:9.5px;opacity:.9}',
'.f9chat-head .f9h{width:27px;height:27px;border-radius:9px;background:rgba(255,255,255,.22);color:#fff;font-size:12px;line-height:1;display:flex;align-items:center;justify-content:center;flex:none}',
'.f9chat-head .f9h:active{background:rgba(255,255,255,.4)}',
'#f9chatKey{margin-left:auto}',
'.f9chat-body{flex:1;overflow:auto;padding:11px;display:flex;flex-direction:column;gap:7px;min-height:160px}',
'.f9-row{display:flex;align-items:flex-end;gap:6px;width:100%}',
'.f9-row.me{justify-content:flex-end}',
'.f9-av{flex:none;border-radius:50%;background:#E7F8F1;border:1px solid #C8F0DC;display:flex;align-items:center;justify-content:center;margin-bottom:2px}',
'.f9-msg{max-width:82%;padding:8px 11px;border-radius:14px;font-size:12.5px;line-height:1.5;white-space:pre-wrap;word-break:keep-all}',
'.f9-msg.me{background:#0E9F6E;color:#fff;border-bottom-right-radius:5px}',
'.f9-msg.ai{background:#F1F4F5;color:#14181D;border-bottom-left-radius:5px}',
'.f9-msg.err{background:#FFF4F2;border:1px solid #FFD9D2;color:#7A271A}',
'.f9-err-btn{margin-top:7px;padding:6px 10px;border-radius:9px;background:#0E9F6E;color:#fff;font-size:11.5px;font-weight:800}',
'.f9chat-foot{display:flex;gap:6px;padding:9px;border-top:1px solid #EDF1F4}',
'.f9chat-foot input{flex:1;padding:10px 12px;border:1.5px solid #E3E9ED;border-radius:12px;outline:none}',
'.f9chat-foot button{padding:0 14px;border-radius:12px;background:#0E9F6E;color:#fff;font-weight:800}'
    ].join('');
    document.head.appendChild(s);
  }
  style();

  /* 다른 모듈(용돈·위시·주말 추천 등)도 같은 실시간 문맥을 쓸 수 있게 열어 둔다 */
  global.FAM9LIVE = {
    build: function () { try { return buildLiveFamContext(); } catch (e) { return ''; } },
    brief: function (n) {
      var t = '';
      try { t = buildLiveFamContext(); } catch (e) { t = ''; }
      if (!t) return '';
      var keep = String(n || 1200);
      return t.length > Number(keep) ? t.slice(0, Number(keep)) + '…' : t;
    }
  };
})(window);
