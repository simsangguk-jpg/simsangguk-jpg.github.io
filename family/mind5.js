/* ============================================================
   우리가족포털 V5 · 마음 돌봄 (mind5.js · 2026-11-15)
   ① 오늘의 스트레스 지수 체크        ② 마음 날씨 & 감정 온도
   ③ 소통·사랑의 언어 성향 테스트     ④ 자존감 & 에너지 회복 체크
   + 우리 가족 마음 현황판 / 💖 힘내요 · 격려 한마디 / 가족 마음 관리 루틴
   - 본체(index.html)는 그대로 두고 window.FAM 다리만 쓴다.
   - 기존 데이터 노드는 그대로 두고 DOC.v5.mind 새 노드만 만든다.
   - 저장 구조: DOC.v5.mind = { res:{ 가족id:{ 검사키:{...} } }, love:{}, cmt:{} }
   ============================================================ */
(function (global) {
  'use strict';

  var F = null, ON = false, wired = false;
  var quiz = null;        /* 진행 중인 검사 {key, ans:[], priv:0|1} */
  var lastKey = '';       /* 방금 끝낸 검사(리포트 우선 표시) */

  /* ---------------- 작은 도구 ---------------- */
  function $(id) { return document.getElementById(id); }
  function d() { return F && F.doc(); }
  function me() { return F && F.me(); }
  function esc(s) { return F.esc(s); }
  function save() { F.save(); }
  function toast(m) { F.toast(m); }
  function now() { return Date.now(); }
  function mid() { return me() ? me().id : ''; }
  function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }
  function clamp(n) { return Math.max(0, Math.min(100, Math.round(n || 0))); }

  /* ============================================================
     검사 정의
     ============================================================ */
  var S_AREAS = {
    body: { n: '몸', e: '🫀', tip: '따뜻한 물로 10분 반신욕, 어깨 돌리기 3분, 잠들기 30분 전 휴대폰 내려놓기' },
    mind: { n: '마음', e: '💭', tip: '머릿속 생각 3가지를 종이에 적어 비우기, 좋아하는 노래 두 곡 들으며 5분 멍때리기' },
    rel: { n: '일·관계', e: '🤝', tip: '오늘 꼭 할 일 3개만 골라 나머지는 내일로, 가족에게 “하나만 도와줄래?”라고 한 번 부탁하기' }
  };

  var LVLS = {
    calm: { e: '😌', n: '여유', c: '#0A7D56' },
    ok: { e: '🙂', n: '보통', c: '#3C4450' },
    warn: { e: '⚠️', n: '주의', c: '#D98324' },
    high: { e: '🔥', n: '높음', c: '#D9534F' }
  };
  function lvlOf(p) {
    if (p < 25) return 'calm';
    if (p < 50) return 'ok';
    if (p < 70) return 'warn';
    return 'high';
  }

  var S_TIPS = {
    calm: ['지금 리듬이 좋아요. 주 2회 30분 걷기로 이 리듬을 지켜 봐요.'],
    ok: ['하루 한 번 5분 심호흡(4초 들이쉬고 6초 내쉬기)으로 중간중간 리셋해요.', '잠들기 전 오늘 잘한 일 하나를 떠올려 보세요.'],
    warn: ['오늘은 “꼭 해야 할 일”을 2개로 줄여 보세요. 나머지는 미뤄도 괜찮아요.', '저녁엔 가족과 10분 산책을 권해요. 걷는 동안엔 휴대폰은 주머니에.', '자기 전 휴대폰 30분 먼저 내려놓고 방을 어둡게 해 보세요.'],
    high: ['오늘은 스스로에게 “지금 충분히 버티고 있어”라고 말해 주세요. 이건 게으름이 아니라 소진 신호예요.', '가족에게 “요즘 좀 지쳐 있어”라고 먼저 말해 보세요. 말하는 것만으로 절반은 풀려요.', '잠 7시간을 최우선으로 두고, 이번 주 안에 좋아하는 일 하나를 꼭 넣어 두세요.']
  };

  var S_ENC = {
    calm: '{name} 님, 지금 마음 근육이 건강해요. 이 좋은 리듬을 가족에게도 알려 주세요.',
    ok: '{name} 님, 적당히 긴장된 상태는 나쁘지 않아요. 오늘 한 번 크게 숨 쉬고 넘어가요.',
    warn: '{name} 님, 지금 꽤 애쓰고 있어요. 스스로를 다그치지 말아 주세요. 오늘은 하나만 해도 충분해요.',
    high: '{name} 님, 많이 버텼어요. 이건 약함이 아니라 소진 신호예요. 오늘은 쉬는 걸 먼저 해 주세요.'
  };

  var WX = {
    sun: { e: '☀️', n: '맑음', d: '마음에 햇살이 잘 들어오는 날이에요. 이 기운을 가족에게도 나눠 주세요.', t: ['이 좋은 흐름을 한 줄 기록해 두면 힘든 날 꺼내 볼 수 있어요.', '오늘 기분이 좋은 이유를 가족에게 한마디 들려주세요.'], enc: '{name} 님의 오늘 마음 날씨는 맑음이에요. 이 햇살 그대로 하루를 마무리해요.' },
    cloud: { e: '⛅', n: '구름', d: '구름 사이로 햇살이 비치는 날이에요. 조금 피곤하지만 괜찮은 상태예요.', t: ['10분만 밖을 걸어도 구름이 걷히는 느낌이 들어요.', '오늘은 큰일 하나만 해내도 충분해요.'], enc: '{name} 님, 구름 낀 날도 괜찮아요. 10분 걷고 따뜻한 물 한 잔이면 충분해요.' },
    shower: { e: '🌦️', n: '소나기', d: '잠깐씩 마음이 젖는 날이에요. 소나기는 오래가지 않아요.', t: ['기분이 가라앉으면 “지금 잠깐 비가 오는 중”이라고 이름 붙여 보세요.', '따뜻한 차 한 잔과 5분 심호흡이 도움이 돼요.', '가족에게 “오늘 좀 가라앉아 있어”라고 미리 말해 두면 서로 편해요.'], enc: '{name} 님, 오늘은 소나기예요. 비가 그치면 더 맑아질 거예요. 지금은 우산만 챙겨요.' },
    storm: { e: '⛈️', n: '천둥·번개', d: '마음의 날씨가 거친 날이에요. 오늘은 스스로를 몰아붙이지 않아도 괜찮아요.', t: ['오늘 할 일은 하나만. 나머지는 내일의 나에게 맡겨요.', '잠을 최우선으로 두고, 자기 전 휴대폰은 30분 먼저 내려놓아요.', '2주 넘게 이 날씨가 이어진다면 정신건강 상담(1577-0199)도 도움이 돼요.'], enc: '{name} 님, 오늘 천둥이 쳐도 괜찮아요. 아무것도 못 한 날도 견딘 날이에요.' },
    bow: { e: '🌈', n: '무지개', d: '여러 감정이 한꺼번에 지나가는 날이에요. 기쁨과 피로가 같이 있어요.', t: ['지금 느끼는 감정을 두 개만 골라 이름 붙여 보세요. 정리가 돼요.', '에너지가 넘칠 때와 지칠 때를 가족에게 미리 알려 두면 서로 편해요.'], enc: '{name} 님, 감정이 여러 겹인 날이에요. 그만큼 마음이 살아 있다는 뜻이에요.' }
  };

  var LANG = {
    empathy: { e: '💗', n: '다정 공감형', d: '마음을 먼저 알아주는 말에 힘을 얻는 사람이에요.', talk: '해결책보다 “많이 힘들었겠다”는 말을 먼저 건네 주세요.', me: '내가 힘들 땐 “그냥 들어 줘”라고 먼저 말해 보세요.' },
    solve: { e: '🛠️', n: '든든 해결형', d: '같이 방법을 찾아 주는 사람에게 마음이 열려요.', talk: '“내가 이건 도와줄 수 있어”처럼 구체적인 행동을 알려 주세요.', me: '내가 힘들 땐 “무엇을 도와주면 되는지” 함께 정리해 보세요.' },
    together: { e: '🤝', n: '함께 활동형', d: '말보다 함께하는 시간에서 마음이 채워져요.', talk: '말 대신 같이 걸어 주고, 같이 해 주는 시간을 만들어 주세요.', me: '힘들 때는 설명보다 함께 산책할 사람을 먼저 찾아보세요.' },
    praise: { e: '🌟', n: '칭찬 응원형', d: '잘한 점을 알아봐 주는 한마디에 힘이 나요.', talk: '잘한 점을 콕 집어 말해 주세요. “오늘 ○○한 거 멋졌어.”', me: '나에게도 하루 한 번 “오늘 잘했어”라고 말해 주세요.' }
  };

  function egoStage(v) { return v >= 70 ? 'tree' : (v >= 45 ? 'leaf' : 'sprout'); }
  var EGO_STAGE = {
    tree: { e: '🌳', n: '든든한 나무', d: '지금 자기 자신을 꽤 믿고 있어요. 그 단단함이 가족에게도 힘이 돼요.' },
    leaf: { e: '🌿', n: '자라는 중', d: '조금씩 힘이 붙는 중이에요. 아직은 흔들려도 괜찮아요.' },
    sprout: { e: '🌱', n: '새싹', d: '지금은 회복이 먼저 필요한 때예요. 새싹도 하루에 다 자라지 않아요.' }
  };
  var EGO_MSG = {
    self: ['{name} 님, 남과 견주지 않아도 이미 충분한 사람이에요. 오늘 하루도 잘 견뎠어요.', '{name} 님은 잘못한 일보다 잘한 일이 더 많은 사람이에요. 스스로를 조금만 더 봐 주세요.'],
    resil: ['{name} 님, 지난번에도 힘든 일을 지나왔어요. 이번에도 지나갈 거예요. 한 걸음씩이면 충분해요.', '{name} 님에게는 다시 일어설 힘이 있어요. 오늘은 그 힘을 10분만 써 보세요.'],
    both: ['{name} 님, 지금 이대로도 가족에게 소중한 사람이에요. 오늘은 스스로를 칭찬해 주세요.', '{name} 님은 생각보다 단단한 사람이에요. 스스로를 믿어 주세요.']
  };

  var TESTS = {
    stress: {
      e: '🌡️', n: '오늘의 스트레스 지수', short: '스트레스 지수',
      d: '요즘 몸과 마음이 얼마나 지쳐 있는지 9문항으로 확인해요.',
      scale: ['전혀 없어요', '가끔 그래요', '자주 그래요', '거의 늘 그래요'],
      qs: [
        { q: '자다가 자주 깨거나, 아침에 일어나도 개운하지 않아요', a: 'body' },
        { q: '어깨·목이 뻐근하고 몸이 무거워요', a: 'body' },
        { q: '두통이나 소화 불편이 예전보다 잦아요', a: 'body' },
        { q: '사소한 일에도 짜증이 확 올라와요', a: 'mind' },
        { q: '머릿속이 복잡해서 집중이 잘 안 돼요', a: 'mind' },
        { q: '아무것도 하기 싫고 무기력할 때가 있어요', a: 'mind' },
        { q: '해야 할 일이 밀려서 마음이 조마조마해요', a: 'rel' },
        { q: '가족·친구와 마음 놓고 이야기할 시간이 부족해요', a: 'rel' },
        { q: '사람 만나는 게 부담스럽고 혼자 있고 싶어요', a: 'rel' }
      ],
      ana: function (ans) {
        var score = 0, ar = { body: 0, mind: 0, rel: 0 };
        TESTS.stress.qs.forEach(function (q, i) { var v = ans[i] || 0; score += v; ar[q.a] += v; });
        var max = TESTS.stress.qs.length * 3;
        return { score: score, max: max, pct: pct(score, max), lvl: lvlOf(pct(score, max)), area: ar };
      }
    },
    mood: {
      e: '🌤️', n: '마음 날씨 & 감정 온도', short: '마음 날씨',
      d: '오늘 마음의 날씨와 감정 온도를 8문항으로 재어 봐요.',
      scale: ['전혀 아니에요', '조금 그래요', '꽤 그래요', '정말 그래요'],
      qs: [
        { q: '요즘 하루가 끝나면 몸이 축 늘어져요', a: 'f' }, { q: '자도 자도 피곤해요', a: 'f' }, { q: '하기 싫은 일을 억지로 버티는 느낌이에요', a: 'f' },
        { q: '지금 마음에 작은 설렘이나 기대가 있어요', a: 'v' }, { q: '하루에 한 번은 웃을 일이 있어요', a: 'v' }, { q: '하고 싶은 일이 머리에 떠올라요', a: 'v' },
        { q: '마음이 차분하고 숨이 편안해요', a: 'c' }, { q: '오늘 하루를 대체로 잘 견뎠다고 느껴요', a: 'c' }
      ],
      ana: function (ans) {
        var f = 0, v = 0, c = 0;
        TESTS.mood.qs.forEach(function (q, i) {
          var x = ans[i] || 0;
          if (q.a === 'f') f += x; else if (q.a === 'v') v += x; else c += x;
        });
        var fP = pct(f, 9), vP = pct(v, 9), cP = pct(c, 6);
        var health = clamp((100 - fP) * 0.45 + vP * 0.35 + cP * 0.20);
        var w;
        if (vP >= 65 && fP >= 65) w = 'bow';
        else if (health >= 72) w = 'sun';
        else if (health >= 52) w = 'cloud';
        else if (health >= 32) w = 'shower';
        else w = 'storm';
        return { f: fP, v: vP, c: cP, health: health, temp: 9 + Math.round(health / 100 * 26), w: w };
      }
    },
    lang: {
      e: '💬', n: '소통·사랑의 언어 성향', short: '소통 성향',
      d: '나는 어떤 방식으로 사랑받을 때 마음이 편한지 8문항으로 알아봐요.',
      scale: ['전혀 아니에요', '조금 그래요', '꽤 그래요', '정말 그래요'],
      qs: [
        { q: '힘들다고 하면 “많이 힘들었겠다”는 말을 먼저 듣고 싶어요', a: 'empathy' },
        { q: '내 기분을 물어봐 주고 함께 마음을 나눠 줄 때 편안해요', a: 'empathy' },
        { q: '문제가 생겼을 때 같이 방법을 찾아 주면 고마워요', a: 'solve' },
        { q: '구체적으로 어떻게 하면 되는지 알려 줄 때 믿음이 가요', a: 'solve' },
        { q: '말보다 함께 밥 먹고 산책하는 시간이 좋아요', a: 'together' },
        { q: '같이 무언가를 만들거나 해낼 때 마음이 가까워져요', a: 'together' },
        { q: '잘했다는 한마디에 힘이 나요', a: 'praise' },
        { q: '응원의 말 한마디에 하루가 달라져요', a: 'praise' }
      ],
      ana: function (ans) {
        var keys = ['empathy', 'solve', 'together', 'praise'];
        var sums = { empathy: 0, solve: 0, together: 0, praise: 0 };
        TESTS.lang.qs.forEach(function (q, i) { sums[q.a] += (ans[i] || 0); });
        var top = keys[0];
        keys.forEach(function (k) { if (sums[k] > sums[top]) top = k; });
        return { type: top, sums: sums, max: 6 };
      }
    },
    ego: {
      e: '🌱', n: '자존감 & 에너지 회복', short: '자존감·회복',
      d: '지금 나를 대하는 마음과 다시 일어서는 힘을 8문항으로 살펴봐요.',
      scale: ['거의 그래요', '가끔 그래요', '자주 그래요', '늘 그래요'],
      qs: [
        { q: '나는 내가 괜찮은 사람이라고 느껴요', a: 's' },
        { q: '실수해도 나를 오래 미워하지 않아요', a: 's' },
        { q: '내 장점을 한 가지는 자신 있게 말할 수 있어요', a: 's' },
        { q: '남과 비교해도 나는 나로 충분하다고 느껴요', a: 's' },
        { q: '힘들어도 다시 일어설 방법을 알고 있어요', a: 'r' },
        { q: '기분이 가라앉으면 나를 달래는 방법이 있어요', a: 'r' },
        { q: '어려울 때 도움을 청할 사람이 떠오릅니다', a: 'r' },
        { q: '지난번 힘든 일도 결국 지나갔어요', a: 'r' }
      ],
      ana: function (ans) {
        var s = 0, r = 0;
        TESTS.ego.qs.forEach(function (q, i) { if (q.a === 's') s += (ans[i] || 0); else r += (ans[i] || 0); });
        var sP = pct(s, 12), rP = pct(r, 12);
        return { self: sP, resil: rP, avg: Math.round((sP + rP) / 2) };
      }
    }
  };
  var ORDER = ['stress', 'mood', 'lang', 'ego'];

  /* ============================================================
     저장 구조 (DOC.v5.mind)
     ============================================================ */
  function V5() {
    var D = d();
    var empty = { res: {}, love: {}, cmt: {} };
    if (!D) return empty;
    if (!D.v5) D.v5 = {};
    if (!D.v5.mind || typeof D.v5.mind !== 'object') D.v5.mind = {};
    var m = D.v5.mind;
    ['res', 'love', 'cmt'].forEach(function (k) { if (!m[k] || typeof m[k] !== 'object') m[k] = {}; });
    return m;
  }
  function resOf(gid) { return V5().res[gid] || {}; }
  function lastAt(gid) {
    var r = resOf(gid), at = 0;
    Object.keys(r).forEach(function (k) { if (r[k] && typeof r[k].at === 'number' && r[k].at > at) at = r[k].at; });
    return at;
  }
  /* 하트: { giverId: { v:1|0, at } } — 지우지 않고 v=0 으로 남겨 기기 간 병합에서 되살아나지 않게 */
  function loveOf(gid) {
    var o = V5().love[gid] || {}, out = {};
    Object.keys(o).forEach(function (k) {
      var x = o[k];
      if (typeof x === 'number') { if (x) out[k] = { v: 1, at: x }; }
      else if (x && x.v) out[k] = x;
    });
    return out;
  }
  function cmtList(gid) {
    var o = V5().cmt[gid] || {}, out = [];
    Object.keys(o).forEach(function (k) {
      var c = o[k];
      if (c && !c.del && c.t) { c._id = k; out.push(c); }
    });
    return out.sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
  }
  function nameOf(gid) { var m = F.memOf(gid); return m && m.name ? m.name : '가족'; }
  function myName() { var m = me(); return m ? m.name : '나'; }

  /* ============================================================
     값 표시
     ============================================================ */
  function valueOf(k, r) {
    if (k === 'stress') { var L = LVLS[r.lvl] || LVLS.ok; return L.e + ' ' + L.n + ' · ' + r.score + '점'; }
    if (k === 'mood') { var W = WX[r.w] || WX.cloud; return W.e + ' ' + W.n + ' · ' + r.temp + '℃'; }
    if (k === 'lang') { var G = LANG[r.type] || LANG.empathy; return G.e + ' ' + G.n; }
    var S = EGO_STAGE[egoStage(r.avg || 0)];
    return S.e + ' ' + (r.avg || 0) + '%';
  }
  function shortOf(k, r) {
    if (k === 'stress') { var L = LVLS[r.lvl] || LVLS.ok; return L.e + ' ' + L.n; }
    if (k === 'mood') { var W = WX[r.w] || WX.cloud; return W.e + ' ' + W.n; }
    if (k === 'lang') { var G = LANG[r.type] || LANG.empathy; return G.e; }
    return (r.avg || 0) + '%';
  }

  /* ============================================================
     분석 블록 (내 리포트 / 가족 상세 / 시트 공용)
     ============================================================ */
  function barRow(label, p, color) {
    var x = clamp(p);
    return '<div class="m5-bar"><span class="lb">' + label + '</span><span class="bg"><i style="width:' + x + '%;background:' + color + '"></i></span><span class="n">' + x + '</span></div>';
  }
  function encOf(k, r, gid) {
    var nm = nameOf(gid);
    if (k === 'stress') return (S_ENC[r.lvl] || S_ENC.ok).replace('{name}', nm);
    if (k === 'mood') return (WX[r.w] || WX.cloud).enc.replace('{name}', nm);
    if (k === 'lang') {
      var G = LANG[r.type] || LANG.empathy;
      return nm + ' 님의 마음 언어는 ' + G.n + '이에요. 가족에게 이걸 알려 주면 서로 덜 서운해요.';
    }
    var ax = Math.abs((r.self || 0) - (r.resil || 0)) < 6 ? 'both' : ((r.self < r.resil) ? 'self' : 'resil');
    var pool = EGO_MSG[ax];
    return pool[new Date().getDate() % pool.length].replace('{name}', nm);
  }
  function blockFor(k, r, gid) {
    var T = TESTS[k], head = '', bars = '', lines = [], trend = '';
    if (k === 'stress') {
      var L = LVLS[r.lvl] || LVLS.ok;
      head = '<div class="m5-big"><span class="e">' + L.e + '</span><div><b>' + L.n + '</b><small>' + r.score + ' / ' + r.max + '점</small></div></div>';
      var am = { body: 9, mind: 9, rel: 9 };
      bars = ['body', 'mind', 'rel'].map(function (a) {
        return barRow(S_AREAS[a].e + ' ' + S_AREAS[a].n, (r.area && r.area[a] || 0) / am[a] * 100, '#FF7A66');
      }).join('');
      var topA = ['body', 'mind', 'rel'].sort(function (a, b) { return ((r.area && r.area[b]) || 0) - ((r.area && r.area[a]) || 0); })[0];
      lines.push('가장 큰 원인은 <b>' + S_AREAS[topA].n + '</b> 쪽이에요. ' + S_AREAS[topA].tip);
      lines = lines.concat(S_TIPS[r.lvl] || S_TIPS.ok);
      if (r.pv && typeof r.pv.pct === 'number') {
        var df = r.pv.pct - r.pct;
        if (df >= 8) trend = '지난번보다 스트레스가 ' + df + '%p 낮아졌어요. 잘 관리하고 있어요 👏';
        else if (df <= -8) trend = '지난번보다 ' + (-df) + '%p 올라갔어요. 오늘은 나를 먼저 챙겨 주세요.';
        else trend = '지난번과 비슷한 수준이에요. 꾸준히 이어가고 있어요.';
      }
    } else if (k === 'mood') {
      var W = WX[r.w] || WX.cloud;
      head = '<div class="m5-big"><span class="e">' + W.e + '</span><div><b>' + W.n + '</b><small>감정 온도 ' + r.temp + '℃</small></div></div>';
      bars = barRow('피로', r.f, '#FF7A66') + barRow('활력', r.v, '#0E9F6E') + barRow('안정', r.c, '#4C8DFF');
      lines.push('<b>' + W.n + '</b> — ' + W.d);
      lines = lines.concat(W.t);
      if (r.pv && typeof r.pv.health === 'number') {
        var dh = r.health - r.pv.health;
        if (dh >= 6) trend = '지난번보다 마음 날씨가 ' + dh + '점 좋아졌어요 ☀️';
        else if (dh <= -6) trend = '지난번보다 마음이 ' + (-dh) + '점 가라앉았어요. 오늘 조금 더 다정하게 대해 주세요.';
      }
    } else if (k === 'lang') {
      var G = LANG[r.type] || LANG.empathy;
      var sums = r.sums || { empathy: 0, solve: 0, together: 0, praise: 0 };
      head = '<div class="m5-big"><span class="e">' + G.e + '</span><div><b>' + G.n + '</b><small>사랑의 언어 1순위</small></div></div>';
      bars = ['empathy', 'solve', 'together', 'praise'].map(function (x) {
        return barRow(LANG[x].e + ' ' + LANG[x].n, (sums[x] || 0) / 6 * 100, x === r.type ? '#F0659B' : '#C9D3DA');
      }).join('');
      lines.push(G.d);
      lines.push('<b>이렇게 말해 주세요</b> — ' + (gid === mid() ? G.me : G.talk));
      if (gid !== mid()) lines.push('가족에게 이 방식을 알려 주면 서로 덜 서운해요.');
      if (gid === mid()) {
        var fam = F.members().filter(function (m) {
          var lr = resOf(m.id).lang;
          return m.id !== gid && lr && !lr.priv && lr.type;
        });
        if (fam.length) {
          lines.push('<b>가족별 대화 팁</b>');
          fam.forEach(function (m) {
            var G2 = LANG[resOf(m.id).lang.type] || LANG.empathy;
            lines.push(esc(m.name) + ' 님은 ' + G2.e + ' ' + G2.n + ' — ' + G2.talk);
          });
        }
      }
    } else {
      var S = EGO_STAGE[egoStage(r.avg || 0)];
      head = '<div class="m5-big"><span class="e">' + S.e + '</span><div><b>' + S.n + '</b><small>자존감 ' + r.self + ' · 회복 ' + r.resil + '</small></div></div>';
      bars = barRow('자존감', r.self, '#8B7CF6') + barRow('회복 에너지', r.resil, '#0E9F6E');
      lines.push(S.d);
      var ax = (r.self || 0) < (r.resil || 0) ? 'self' : 'resil';
      lines.push(ax === 'self' ? '자존감을 채우는 작은 성공을 하루 하나씩 만들어 보세요. (예: 10분 정리, 물 2L 마시기)' : '회복 에너지를 키우려면 잘 자고, 잘 먹고, 웃는 시간을 늘리는 게 먼저예요.');
    }
    return '<div class="m5-blk">' +
      '<div class="m5-bh">' + T.e + ' ' + esc(T.n) + '<span class="m5-bt">' + esc(F.ago(r.at)) + (r.priv ? ' · 🌙 비공개' : '') + '</span></div>' +
      head + '<div class="m5-bars">' + bars + '</div>' +
      (trend ? '<div class="m5-trend">' + esc(trend) + '</div>' : '') +
      lines.map(function (l) { return '<div class="m5-line">· ' + l + '</div>'; }).join('') +
      '<div class="m5-enc">💛 ' + esc(encOf(k, r, gid)) + '</div></div>';
  }
  function detailHtmlFor(gid) {
    var isMe = gid === mid();
    var r = resOf(gid);
    var has = ORDER.filter(function (k) { return !!r[k]; });
    if (!has.length) {
      return '<div class="m5-empty">' + (isMe ? '아직 검사 기록이 없어요. 위에서 검사 하나를 골라 1분만 투자해 보세요.' : nameOf(gid) + ' 님은 아직 검사를 하지 않았어요. 먼저 편하게 권해 주세요.') + '</div>';
    }
    return ORDER.map(function (k) {
      var rec = r[k];
      if (!rec) return '';
      if (rec.priv && !isMe) return '<div class="m5-blk"><div class="m5-bh">' + TESTS[k].e + ' ' + esc(TESTS[k].n) + '</div><div class="m5-empty">🌙 나만 보기로 한 검사예요</div></div>';
      return blockFor(k, rec, gid);
    }).join('');
  }

  /* ============================================================
     현황판
     ============================================================ */
  function cmtLine(c) {
    return '<div class="m5-cm1"><b>' + esc(nameOf(c.by)) + '</b> ' + esc(c.t) + ' <span class="t">' + esc(F.ago(c.at)) + '</span></div>';
  }
  function vSlot(gid, k, label, rec) {
    var isMe = gid === mid();
    if (!rec) return '<div class="m5-v"><div class="k">' + label + '</div><div class="b off">아직 –</div></div>';
    if (rec.priv && !isMe) return '<div class="m5-v priv"><div class="k">' + label + '</div><div class="b">🌙 비공개</div></div>';
    return '<div class="m5-v"><div class="k">' + label + '</div><div class="b">' + valueOf(k, rec) + '</div></div>';
  }
  function memberCard(m) {
    var isMe = m.id === mid();
    var r = resOf(m.id);
    var love = loveOf(m.id);
    var loveN = Object.keys(love).length;
    var mine = !!love[mid()];
    var at = lastAt(m.id);
    var cs = cmtList(m.id);
    return '<div class="m5-mem' + (isMe ? ' me' : '') + '">' +
      '<div class="m5-mh"><span class="m5-av">' + (m.emoji || '🧑') + '</span>' +
      '<span class="m5-nb"><span class="m5-nm">' + esc(m.name) + (isMe ? '<i>나</i>' : '') + '</span>' +
      '<span class="m5-rl">' + esc(m.role || '가족') + '</span></span>' +
      '<span class="m5-when">' + (at ? esc(F.ago(at)) : '검사 전') + '</span></div>' +
      '<div class="m5-vg">' + vSlot(m.id, 'stress', '🌡️ 스트레스', r.stress) + vSlot(m.id, 'mood', '🌤️ 마음 날씨', r.mood) +
      vSlot(m.id, 'lang', '💬 소통 성향', r.lang) + vSlot(m.id, 'ego', '🌱 자존감', r.ego) + '</div>' +
      '<div class="m5-acts">' +
      '<button type="button" class="m5-love' + (mine ? ' on' : '') + '" data-mind-love="' + m.id + '">' + (mine ? '💖' : '🤍') + ' 힘내요 <b>' + loveN + '</b></button>' +
      '<button type="button" class="m5-btn" data-mind-cmt="' + m.id + '">💬 격려</button>' +
      (at ? '<button type="button" class="m5-btn" data-mind-view="' + m.id + '">자세히 ›</button>' : '') +
      '</div>' +
      (cs.length ? '<div class="m5-cmlist">' + cs.slice(-2).map(cmtLine).join('') +
        (cs.length > 2 ? '<button type="button" class="m5-more" data-mind-view="' + m.id + '">+' + (cs.length - 2) + '개 더</button>' : '') + '</div>' : '') +
      '</div>';
  }
  function boardHtml() {
    var ms = F.members();
    var any = ms.some(function (m) { return lastAt(m.id); });
    var head = '<div class="m5-boardtop"><b>🧠 우리 가족 마음 현황판</b><span>' + ms.length + '명 · ' +
      (any ? '최근 검사 ' + esc(F.ago(Math.max.apply(null, ms.map(function (m) { return lastAt(m.id); })))) : '아직 검사 전') + '</span></div>';
    return head + '<div class="m5-grid">' + ms.map(memberCard).join('') + '</div>' +
      (any ? '' : '<div class="m5-empty">아직 아무도 검사를 하지 않았어요. 한 사람이 먼저 하면 가족 현황판이 채워져요.</div>');
  }
  function startButtons() {
    var mine = resOf(mid());
    return ORDER.map(function (k) {
      var T = TESTS[k], r = mine[k];
      var st = r ? (r.priv ? '🌙 비공개 · ' + esc(F.ago(r.at)) : '최근 ' + shortOf(k, r)) : T.qs.length + '문항 · 1분';
      return '<button type="button" class="m5-t" data-mind-start="' + k + '"><span class="e">' + T.e + '</span><span class="n">' + esc(T.n) + '</span><span class="s">' + st + '</span></button>';
    }).join('');
  }
  function miniHtml() {
    var ms = F.members();
    return ms.map(function (m) {
      var r = resOf(m.id), isMe = m.id === mid();
      function v(rec, fn) {
        if (!rec) return '<span class="mv off">–</span>';
        if (rec.priv && !isMe) return '<span class="mv off">🌙</span>';
        return '<span class="mv">' + fn(rec) + '</span>';
      }
      return '<div class="m5-mrow' + (isMe ? ' me' : '') + '"><span class="e">' + (m.emoji || '🧑') + '</span>' +
        '<span class="nm">' + esc(m.name) + '</span>' +
        v(r.stress, function (x) { return (LVLS[x.lvl] || LVLS.ok).e + ' ' + x.score; }) +
        v(r.mood, function (x) { return (WX[x.w] || WX.cloud).e + ' ' + x.temp + '℃'; }) +
        v(r.lang, function (x) { return (LANG[x.type] || LANG.empathy).e; }) +
        '<span class="lv">💖' + Object.keys(loveOf(m.id)).length + '</span></div>';
    }).join('');
  }

  /* ============================================================
     검사 진행
     ============================================================ */
  function quizHtml() {
    if (!quiz) return '';
    var T = TESTS[quiz.key];
    var n = T.qs.length;
    var done = quiz.ans.filter(function (v) { return v >= 0; }).length;
    return '<div class="m5-card m5-quiz"><div class="m5-qh"><span>' + T.e + ' ' + esc(T.n) + '</span><span class="m5-prog" id="m5Prog">' + done + '/' + n + '</span></div>' +
      '<div class="m5-qd">' + esc(T.d) + ' 지금 느낌에 가까운 것을 골라 주세요.</div>' +
      T.qs.map(function (q, i) {
        return '<div class="m5-q"><div class="qt"><span class="qn">' + (i + 1) + '</span><span>' + esc(q.q) + '</span></div>' +
          '<div class="m5-opts">' + T.scale.map(function (s, v) {
            return '<button type="button" class="m5-opt' + (quiz.ans[i] === v ? ' on' : '') + '" data-mind-q="' + i + '" data-mind-a="' + v + '">' + esc(s) + '</button>';
          }).join('') + '</div></div>';
      }).join('') +
      '<div class="m5-qf"><label class="m5-priv"><input type="checkbox" id="m5Priv"' + (quiz.priv ? ' checked' : '') + '> 🌙 나만 보기 <small>(가족 화면에는 비공개로 보여요)</small></label>' +
      '<div class="m5-qb"><button type="button" class="btn ghost" data-mind-cancel>그만두기</button><button type="button" class="btn" data-mind-submit>결과 보기</button></div></div></div>';
  }
  function start(key) {
    var T = TESTS[key];
    if (!T) return;
    quiz = { key: key, ans: T.qs.map(function () { return -1; }), priv: 0 };
    lastKey = '';
    if (F.curView() !== 'all') F.view('all');
    repaint(['v5Quiz']);
    render();
    setTimeout(function () {
      var q = $('v5Quiz');
      if (q) q.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 160);
  }
  function cancelQuiz() {
    quiz = null;
    blurAll();
    repaint(['v5Quiz']);
    render();
  }
  function pick(i, v) {
    if (!quiz) return;
    quiz.ans[i] = v;
    var wrap = $('v5Quiz');
    if (!wrap) return;
    var qs = wrap.querySelectorAll('.m5-q');
    if (qs[i]) {
      var btns = qs[i].querySelectorAll('.m5-opt');
      for (var k = 0; k < btns.length; k++) btns[k].classList.toggle('on', k === v);
    }
    var prog = $('m5Prog');
    if (prog) prog.textContent = quiz.ans.filter(function (x) { return x >= 0; }).length + '/' + TESTS[quiz.key].qs.length;
    var left = quiz.ans.filter(function (x) { return x < 0; }).length;
    if (!left) {
      var f = wrap.querySelector('.m5-qf');
      if (f) setTimeout(function () { f.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 120);
    }
  }
  function submit() {
    if (!quiz) return;
    var key = quiz.key, T = TESTS[key], gid = mid();
    var miss = -1;
    for (var i = 0; i < quiz.ans.length; i++) { if (quiz.ans[i] < 0) { miss = i; break; } }
    if (miss >= 0) {
      toast((miss + 1) + '번 문항이 아직 비어 있어요');
      var els = document.querySelectorAll('#v5Quiz .m5-q');
      if (els[miss]) els[miss].scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    var M = V5();
    if (!M.res[gid]) M.res[gid] = {};
    var old = M.res[gid][key];
    var r = T.ana(quiz.ans);
    var priv = quiz.priv ? 1 : 0;
    r.at = now(); r.priv = priv; r.by = gid;
    if (old && old.at) r.pv = { at: old.at, pct: old.pct, health: old.health, avg: old.avg, temp: old.temp };
    M.res[gid][key] = r;
    save();
    quiz = null; lastKey = key;
    blurAll();
    repaint(['v5Quiz', 'v5Board', 'v5Tests', 'v5Mine', 'v5Routine', 'v5LifeMini', 'v5LifeTests']);
    render();
    toast(priv ? '검사 결과를 나만 보기로 저장했어요' : '검사 결과를 가족과 나눴어요 · 격려를 기다려 보세요');
    var mine = $('v5Mine');
    if (mine) setTimeout(function () { mine.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 150);
  }

  /* ============================================================
     내 리포트 · 루틴 · 격려
     ============================================================ */
  function mineHtml() {
    var gid = mid();
    if (!gid) return '';
    var has = Object.keys(resOf(gid)).length;
    return '<div class="m5-card"><div class="m5-card-h"><h3>🪞 내 마음 리포트</h3><span>' + (has ? '자동 저장됨' : '') + '</span></div>' +
      detailHtmlFor(gid) +
      (has ? '<div class="m5-note">3일쯤 뒤에 다시 해보면 변화가 잘 보여요. 결과는 자동으로 저장되고, 가족은 현황판에서 볼 수 있어요.</div>' : '') +
      '</div>';
  }
  var ROUTINES = [
    { e: '🚶', n: '가족 10분 산책', d: '저녁 식사 후 10분만 같이 걸어요. 걷는 동안 휴대폰은 주머니에.' },
    { e: '🫁', n: '4-6 심호흡 3분', d: '4초 들이쉬고 6초 내쉬기 10번. 다 같이 하면 아이들도 금방 따라 해요.' },
    { e: '💬', n: '오늘의 마음 질문', d: '한 사람씩 돌아가며 한 문장으로 대답해요. 정답 없이 듣기만 해요.' },
    { e: '🧘', n: '어깨·목 스트레칭 3분', d: '한 사람이 구호를 외치고 다 같이 20초씩 늘여요.' },
    { e: '🍵', n: '따뜻한 차 한 잔 타임', d: '불 끄고 15분, 각자 오늘 있었던 일 한 가지씩.' }
  ];
  var TOPICS = [
    '오늘 하루 3가지 — 좋았던 일 / 힘들었던 일 / 내일 기대하는 일',
    '요즘 나를 웃게 하는 것 한 가지',
    '지금 가장 고마운 사람과 그 이유',
    '이번 주에 꼭 해보고 싶은 작은 일',
    '어릴 때 가장 행복했던 기억 하나',
    '요즘 나를 힘들게 하는 것과, 도와줬으면 하는 일'
  ];
  function routineHtml() {
    var ms = F.members(), notes = [];
    ms.forEach(function (m) {
      var r = resOf(m.id), s = r.stress, w = r.mood;
      var hide = function (x) { return !x || (x.priv && m.id !== mid()); };
      if (!hide(s) && (s.lvl === 'warn' || s.lvl === 'high')) notes.push(esc(m.name) + ' 님 스트레스 ' + (LVLS[s.lvl] || LVLS.ok).n);
      if (!hide(w) && (w.w === 'shower' || w.w === 'storm')) notes.push(esc(m.name) + ' 님 마음 날씨 ' + (WX[w.w] || WX.cloud).n);
    });
    var day = new Date().getDate();
    var a = ROUTINES[day % ROUTINES.length], b = ROUTINES[(day + 2) % ROUTINES.length], c = ROUTINES[(day + 4) % ROUTINES.length];
    function row(x) { return '<div class="m5-rt"><span class="e">' + x.e + '</span><span class="tx"><b>' + x.n + '</b><small>' + x.d + '</small></span></div>'; }
    return '<div class="m5-card"><div class="m5-card-h"><h3>🌿 오늘 가족과 함께 하는 마음 관리</h3><span>스트레스 해소</span></div>' +
      (notes.length ? '<div class="m5-trend">지금 챙겨 줄 사람 — ' + notes.join(' · ') + '</div>' : '') +
      row(a) + row(b) +
      '<div class="m5-rt"><span class="e">🗣️</span><span class="tx"><b>오늘의 대화 주제</b><small>' + esc(TOPICS[day % TOPICS.length]) + '</small></span></div>' +
      '<div class="m5-rt"><span class="e">🕯️</span><span class="tx"><b>' + c.n + '</b><small>' + c.d + '</small></span></div>' +
      '<div class="hint">이 검사는 의학적 진단이 아니라 가족 소통과 정서 돌봄을 위한 셀프 체크예요. 2주 이상 마음이 무겁다면 전문 상담(정신건강 상담전화 1577-0199)을 권해요.</div>' +
      '</div>';
  }
  function cmtChips(gid) {
    var r = resOf(gid), isMe = gid === mid(), out = [];
    var s = (!isMe && r.stress && r.stress.priv) ? null : r.stress;
    var w = (!isMe && r.mood && r.mood.priv) ? null : r.mood;
    var e = (!isMe && r.ego && r.ego.priv) ? null : r.ego;
    if (s && s.lvl === 'high') out.push('요즘 많이 지쳐 보여. 오늘은 일찍 쉬자 🌙');
    else if (s && s.lvl === 'warn') out.push('잠깐 숨 고르고, 같이 산책할까? 🚶');
    if (w && w.w === 'storm') out.push('마음이 무거운 날엔 말 안 해도 괜찮아 🤍');
    else if (w && w.w === 'shower') out.push('소나기 지나가면 맑아질 거야 ☀️');
    if (e && typeof e.avg === 'number' && e.avg < 45) out.push('너는 충분히 잘하고 있어. 그거면 됐어 💗');
    out.push('오늘 하루도 정말 수고했어요 💛');
    out.push('네 편이야, 언제든 이야기해 🤍');
    return out.slice(0, 3);
  }
  function cmtSheet(gid) {
    var m = F.memOf(gid);
    var list = cmtList(gid);
    var chips = cmtChips(gid);
    F.openSheet('<h3>💌 ' + esc(m.name) + ' 님에게 격려 한마디</h3>' +
      '<div class="sdesc">마음 검사 결과를 함께 보는 가족 공간이에요. 짧아도 좋아요.</div>' +
      '<div class="m5-chips">' + chips.map(function (c) { return '<button type="button" class="m5-chip" data-m5chip="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</div>' +
      '<textarea class="field" id="m5CmtIn" rows="3" maxlength="140" placeholder="예: 요즘 많이 지쳐 보였어. 오늘 저녁 같이 걸을까?"></textarea>' +
      '<div style="display:flex;gap:8px"><button type="button" class="btn ghost" data-sheet-close style="flex:1">닫기</button><button type="button" class="btn" id="m5CmtSave" style="flex:1.4">남기기</button></div>' +
      (list.length ? '<div class="m5-cmlist" style="margin-top:12px">' + list.slice().reverse().map(cmtLine).join('') + '</div>' : ''));
    var btn = $('m5CmtSave');
    if (btn) btn.onclick = function () {
      var ta = $('m5CmtIn');
      var t = (ta && ta.value || '').trim();
      if (!t) { toast('격려의 한마디를 적어 주세요'); return; }
      var M = V5();
      var id = 'c' + now().toString(36) + Math.random().toString(36).slice(2, 4);
      if (!M.cmt[gid]) M.cmt[gid] = {};
      M.cmt[gid][id] = { t: t.slice(0, 140), by: mid(), at: now() };
      save();
      F.closeSheet();
      blurAll();
      repaint(['v5Board', 'v5LifeMini']);
      render();
      toast(nameOf(gid) + ' 님에게 격려를 남겼어요');
    };
  }
  function detailSheet(gid) {
    var m = F.memOf(gid), isMe = gid === mid();
    F.openSheet('<h3>' + (m.emoji || '🧑') + ' ' + esc(m.name) + ' 님의 마음 리포트</h3>' +
      '<div class="sdesc">' + (isMe ? '내가 해 본 검사 결과예요.' : '가족이 공유한 결과예요. 따뜻한 말 한마디를 남겨 주세요.') + '</div>' +
      '<div class="m5-sheetbody">' + detailHtmlFor(gid) + '</div>' +
      '<div class="hint">이 검사는 의학적 진단이 아니라 가족 소통과 정서 돌봄을 위한 셀프 체크예요.</div>' +
      '<div style="display:flex;gap:8px;margin-top:9px"><button type="button" class="btn ghost" data-sheet-close style="flex:1">닫기</button>' +
      (isMe ? '' : '<button type="button" class="btn" id="m5SheetCmt" style="flex:1.2">💖 격려 남기기</button>') + '</div>');
    var b = $('m5SheetCmt');
    if (b) b.onclick = function () { cmtSheet(gid); };
  }
  function love(gid) {
    var M = V5(), id = mid();
    if (!M.love[gid]) M.love[gid] = {};
    var cur = loveOf(gid)[id];
    M.love[gid][id] = { v: cur ? 0 : 1, at: now() };
    save();
    blurAll();
    repaint(['v5Board', 'v5LifeMini']);
    render();
    if (!cur && gid !== id) toast(nameOf(gid) + ' 님에게 힘내요 하트를 보냈어요 💖');
  }

  /* ============================================================
     화면 틀
     ============================================================ */
  function style() {
    if ($('m5style')) return;
    var s = document.createElement('style');
    s.id = 'm5style';
    s.textContent = [
      '.m5-boardtop{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;margin:2px 2px 7px}',
      '.m5-boardtop b{font-size:13px;font-weight:800;letter-spacing:-.2px}',
      '.m5-boardtop span{font-size:11px;color:#9AA4AF}',
      '.m5-grid{display:grid;grid-template-columns:1fr;gap:8px}',
      '@media(min-width:560px){.m5-grid{grid-template-columns:1fr 1fr}}',
      '.m5-mem{border:1px solid #E9EEF2;border-radius:15px;padding:10px;background:#FBFDFC}',
      '.m5-mem.me{border-color:#BFE9D6;background:linear-gradient(180deg,#F2FBF7,#FBFDFC)}',
      '.m5-mh{display:flex;align-items:center;gap:7px}',
      '.m5-av{width:30px;height:30px;border-radius:10px;background:#EEF5FF;display:flex;align-items:center;justify-content:center;font-size:16px;flex:none}',
      '.m5-nb{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.2}',
      '.m5-nm{font-size:12.5px;font-weight:800;letter-spacing:-.2px}',
      '.m5-nm i{font-style:normal;font-size:9.5px;font-weight:800;color:#0A7D56;background:#E7F8F1;border-radius:6px;padding:1px 4px;margin-left:4px;vertical-align:1px}',
      '.m5-rl{font-size:10px;color:#9AA4AF;font-weight:700}',
      '.m5-when{font-size:10px;color:#9AA4AF;white-space:nowrap;flex:none}',
      '.m5-vg{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:8px}',
      '.m5-v{background:#fff;border:1px solid #EDF1F4;border-radius:11px;padding:5px 7px;min-width:0}',
      '.m5-v .k{font-size:9.5px;color:#9AA4AF;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.m5-v .b{font-size:11.5px;font-weight:800;letter-spacing:-.2px;margin-top:1px;word-break:keep-all;line-height:1.28}',
      '.m5-v .b.off{color:#C0C8CE;font-weight:700}',
      '.m5-v.priv .b{color:#9AA4AF;font-weight:700}',
      '.m5-acts{display:flex;gap:5px;margin-top:8px;flex-wrap:wrap}',
      '.m5-love{border:1px solid #FFD9E4;background:#FFF7FA;color:#C2255C;border-radius:10px;padding:5px 9px;font-size:11px;font-weight:800;display:flex;align-items:center;gap:3px}',
      '.m5-love b{font-weight:900}',
      '.m5-love.on{background:#FFE9F1;border-color:#FFB8CE}',
      '.m5-btn{border:1px solid #E3E9ED;background:#fff;color:#5C6673;border-radius:10px;padding:5px 9px;font-size:11px;font-weight:800}',
      '.m5-btn:active,.m5-love:active{transform:scale(.97)}',
      '.m5-cmlist{margin-top:7px;border-top:1px dashed #E7ECEF;padding-top:6px}',
      '.m5-cm1{font-size:11px;line-height:1.45;color:#3C4450;margin-bottom:3px;word-break:keep-all}',
      '.m5-cm1 b{font-weight:800;color:#0A7D56;margin-right:2px}',
      '.m5-cm1 .t{color:#B4BCC3;font-size:9.5px;margin-left:2px}',
      '.m5-more{border:none;background:none;color:#8B95A1;font-size:10.5px;font-weight:800;padding:2px 0}',
      '.m5-empty{font-size:11.5px;color:#9AA4AF;text-align:center;padding:12px 4px;line-height:1.5}',
      '.m5-tests{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:7px}',
      '.m5-t{display:flex;flex-direction:column;align-items:flex-start;gap:1px;padding:9px 10px;border-radius:13px;background:#FBFDFC;border:1px solid #E9EEF2;text-align:left}',
      '.m5-t .e{font-size:18px;line-height:1}',
      '.m5-t .n{font-size:11.5px;font-weight:800;color:#3C4450;letter-spacing:-.3px;line-height:1.25;word-break:keep-all}',
      '.m5-t .s{font-size:10px;color:#9AA4AF;font-weight:700}',
      '.m5-t:active{transform:scale(.98)}',
      '.m5-card{background:#fff;border:1px solid #EDF1F4;border-radius:16px;padding:12px;margin-top:12px}',
      '.m5-card-h{display:flex;align-items:baseline;justify-content:space-between;gap:6px;margin-bottom:6px}',
      '.m5-card-h h3{margin:0;font-size:13px;font-weight:800;letter-spacing:-.2px}',
      '.m5-card-h span{font-size:10.5px;color:#9AA4AF;font-weight:700}',
      '.m5-quiz{border-color:#BFE9D6;background:linear-gradient(180deg,#F7FCFA,#fff)}',
      '.m5-qh{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:13px;font-weight:800;letter-spacing:-.2px}',
      '.m5-prog{font-size:11px;font-weight:800;color:#0A7D56;background:#E7F8F1;border-radius:20px;padding:2px 9px}',
      '.m5-qd{font-size:11px;color:#79838F;line-height:1.5;margin:4px 0 2px}',
      '.m5-q{background:#fff;border:1px solid #EDF1F4;border-radius:13px;padding:9px 10px;margin-top:8px}',
      '.m5-q .qt{display:flex;gap:6px;font-size:12px;font-weight:800;letter-spacing:-.2px;line-height:1.4;word-break:keep-all}',
      '.m5-q .qn{color:#0E9F6E;font-weight:900;flex:none}',
      '.m5-opts{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:7px}',
      '.m5-opt{border:1px solid #E3E9ED;border-radius:10px;padding:7px 4px;font-size:10.5px;font-weight:800;color:#5C6673;background:#fff;line-height:1.2;word-break:keep-all}',
      '.m5-opt.on{background:#E7F8F1;border-color:#0E9F6E;color:#0A7D56}',
      '.m5-qf{margin-top:10px;border-top:1px dashed #E7ECEF;padding-top:9px}',
      '.m5-priv{display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:800;color:#5C6673}',
      '.m5-priv input{width:16px;height:16px;accent-color:#0E9F6E}',
      '.m5-priv small{font-weight:700;color:#9AA4AF}',
      '.m5-qb{display:flex;gap:7px;margin-top:9px}',
      '.m5-qb .btn{flex:1;padding:11px;font-size:13px;border-radius:12px}',
      '.m5-blk{border-top:1px dashed #EDF1F4;padding-top:9px;margin-top:9px}',
      '.m5-blk:first-child{border-top:none;padding-top:0;margin-top:0}',
      '.m5-bh{display:flex;align-items:baseline;gap:6px;font-size:11.5px;font-weight:800;color:#5C6673}',
      '.m5-bt{margin-left:auto;font-size:10px;color:#9AA4AF;font-weight:700}',
      '.m5-big{display:flex;align-items:center;gap:9px;margin:6px 0 2px}',
      '.m5-big .e{font-size:26px;line-height:1}',
      '.m5-big b{font-size:15px;font-weight:900;letter-spacing:-.4px;display:block}',
      '.m5-big small{font-size:10.5px;color:#79838F;font-weight:700}',
      '.m5-bars{margin-top:6px}',
      '.m5-bar{display:flex;align-items:center;gap:6px;font-size:10.5px;font-weight:800;color:#3C4450;margin-top:4px}',
      '.m5-bar .lb{width:70px;flex:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.m5-bar .bg{flex:1;height:8px;border-radius:20px;background:#F1F4F5;overflow:hidden}',
      '.m5-bar .bg i{display:block;height:100%;border-radius:20px}',
      '.m5-bar .n{width:26px;text-align:right;color:#79838F}',
      '.m5-line{font-size:11.5px;line-height:1.5;color:#3C4450;margin-top:4px;word-break:keep-all}',
      '.m5-line b{font-weight:800}',
      '.m5-trend{font-size:11px;font-weight:800;color:#0A7D56;background:#EFFAF4;border-radius:10px;padding:6px 8px;margin-top:7px;line-height:1.45}',
      '.m5-enc{font-size:11.5px;font-weight:800;color:#8A5A00;background:#FFF8E6;border-radius:11px;padding:7px 9px;margin-top:7px;line-height:1.5;word-break:keep-all}',
      '.m5-note{font-size:10.5px;color:#9AA4AF;line-height:1.5;margin-top:8px}',
      '.m5-rt{display:flex;gap:8px;align-items:flex-start;padding:7px 0;border-bottom:1px dashed #EDF1F4}',
      '.m5-rt:last-of-type{border-bottom:none}',
      '.m5-rt .e{font-size:17px;line-height:1.2;flex:none}',
      '.m5-rt .tx{flex:1;min-width:0}',
      '.m5-rt .tx b{font-size:12px;font-weight:800;display:block;letter-spacing:-.2px}',
      '.m5-rt .tx small{font-size:11px;color:#79838F;line-height:1.45;display:block;word-break:keep-all}',
      '.m5-chips{display:flex;gap:5px;flex-wrap:wrap;margin:2px 0 9px}',
      '.m5-chip{font-size:10.5px;font-weight:800;color:#0A7D56;background:#E7F8F1;border-radius:20px;padding:5px 9px;border:1px solid #CFEFE0}',
      '.m5-sheetbody{max-height:46vh;overflow-y:auto;padding-right:2px}',
      '.m5-mini{display:flex;flex-direction:column;gap:4px}',
      '.m5-mrow{display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:800;color:#3C4450;background:#FBFDFC;border:1px solid #EDF1F4;border-radius:11px;padding:6px 8px}',
      '.m5-mrow.me{border-color:#BFE9D6;background:#F3FBF7}',
      '.m5-mrow .e{font-size:14px;flex:none}',
      '.m5-mrow .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.m5-mrow .mv{font-size:11px;font-weight:800;color:#3C4450;white-space:nowrap}',
      '.m5-mrow .mv.off{color:#C0C8CE}',
      '.m5-mrow .lv{font-size:10.5px;color:#C2255C;font-weight:800;white-space:nowrap}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function paint(el, sig, build) {
    if (!el) return;
    if (el.__sig === sig) return;
    if (el.contains(document.activeElement)) return;
    el.__sig = sig;
    el.innerHTML = build();
  }
  function repaint(ids) {
    ids.forEach(function (id) { var el = $(id); if (el) el.__sig = ''; });
  }
  function blurAll() {
    try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) {}
  }

  function buildCard() {
    var sec = $('view-all');
    if (!sec || $('v5Mind')) return;
    var card = document.createElement('div');
    card.className = 'card';
    card.id = 'v5Mind';
    card.innerHTML = [
      '<div class="card-head"><h2>🧠 우리 가족 마음 돌봄</h2><span class="sub">심리검사 · 격려</span></div>',
      '<div class="v4-mini" style="margin:-4px 0 9px">네 가지 셀프 체크로 서로의 마음 상태를 알아보고, 결과 카드에 <b>💖 힘내요</b>와 격려 한마디를 남겨 보세요.</div>',
      '<div id="v5Board"></div>',
      '<div style="font-size:12.5px;font-weight:800;margin:14px 2px 0">🧪 검사 골라 하기</div>',
      '<div class="m5-tests" id="v5Tests"></div>',
      '<div id="v5Quiz" class="hidden"></div>',
      '<div id="v5Mine"></div>',
      '<div id="v5Routine"></div>'
    ].join('');
    sec.appendChild(card);
  }
  function buildLife() {
    var nav = $('lifeNav');
    if (nav && !nav.querySelector('button[data-life="mind"]')) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-life', 'mind');
      b.textContent = '🧠 마음 돌봄';
      nav.appendChild(b);
    }
    var sec = $('view-life');
    if (sec && !$('life-mind')) {
      var p = document.createElement('div');
      p.id = 'life-mind';
      p.className = 'hidden';
      p.innerHTML = '<div class="card"><div class="card-head"><h2>🧠 우리 가족 마음 돌봄</h2><span class="sub">심리검사 · 격려</span></div>' +
        '<div class="v4-mini" style="margin:-4px 0 8px">가족 마음 현황을 한눈에 보고, 검사를 바로 시작할 수 있어요.</div>' +
        '<div id="v5LifeMini"></div>' +
        '<div style="font-size:12.5px;font-weight:800;margin:13px 2px 0">🧪 바로 시작</div>' +
        '<div class="m5-tests" id="v5LifeTests"></div>' +
        '<button type="button" class="btn soft" data-mind-open style="margin-top:11px">🧠 마음 돌봄 화면 전체 보기</button>' +
        '<div class="hint">이 검사는 의학적 진단이 아니라 가족 소통과 정서 돌봄을 위한 셀프 체크예요.</div></div>';
      sec.appendChild(p);
    }
  }

  /* 생활 탭 안에서 내 pane 만 보이게 */
  function syncLifeState() {
    var btn = document.querySelector('#lifeNav button[data-life="mind"]');
    var on = !!(btn && btn.classList.contains('on'));
    var pane = $('life-mind');
    if (pane) pane.classList.toggle('hidden', !on);
  }
  function syncLifeTab(target) {
    var want = target && target.getAttribute('data-life') === 'mind';
    var pane = $('life-mind');
    if (pane) pane.classList.toggle('hidden', !want);
    var btn = document.querySelector('#lifeNav button[data-life="mind"]');
    if (btn) btn.classList.toggle('on', want);
    if (want) { repaint(['v5LifeMini']); render(); }
  }
  function openFull() {
    F.view('all');
    setTimeout(function () {
      var el = $('v5Mind');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  }

  /* ============================================================
     렌더
     ============================================================ */
  function render() {
    if (!F || !F.doc() || !F.me()) return;
    ensure();
    var M = V5();
    var sig = JSON.stringify([M.res, M.love, M.cmt, F.members().map(function (m) { return [m.id, m.name, m.role, m.emoji]; })]);
    paint($('v5Board'), sig, boardHtml);
    paint($('v5Tests'), sig, startButtons);
    paint($('v5LifeMini'), sig, miniHtml);
    paint($('v5LifeTests'), sig, startButtons);
    paint($('v5Mine'), sig + '|' + lastKey, mineHtml);
    paint($('v5Routine'), sig, routineHtml);
    paint($('v5Quiz'), quiz ? 'quiz:' + quiz.key : 'idle', quizHtml);
    var q = $('v5Quiz');
    if (q) q.classList.toggle('hidden', !quiz);
  }
  function onView(v) {
    if (!ON) return;
    if (v === 'all') { repaint(['v5Board', 'v5Tests', 'v5Mine', 'v5Routine']); render(); }
    if (v === 'life') { repaint(['v5LifeMini', 'v5LifeTests']); render(); syncLifeState(); }
  }

  /* ============================================================
     연결
     ============================================================ */
  function wire() {
    document.addEventListener('click', function (e) {
      var t;
      if ((t = e.target.closest('#lifeNav button[data-life], #lifeQuick button[data-life]'))) { syncLifeTab(t); }
      if ((t = e.target.closest('[data-mind-start]'))) { start(t.getAttribute('data-mind-start')); return; }
      if ((t = e.target.closest('[data-mind-q]'))) { pick(parseInt(t.getAttribute('data-mind-q'), 10), parseInt(t.getAttribute('data-mind-a'), 10)); return; }
      if (e.target.closest('[data-mind-submit]')) { submit(); return; }
      if (e.target.closest('[data-mind-cancel]')) { cancelQuiz(); return; }
      if ((t = e.target.closest('[data-mind-love]'))) { love(t.getAttribute('data-mind-love')); return; }
      if ((t = e.target.closest('[data-mind-cmt]'))) { cmtSheet(t.getAttribute('data-mind-cmt')); return; }
      if ((t = e.target.closest('[data-mind-view]'))) { detailSheet(t.getAttribute('data-mind-view')); return; }
      if ((t = e.target.closest('[data-mind-open]'))) { openFull(); return; }
      if ((t = e.target.closest('[data-m5chip]'))) {
        var ta = $('m5CmtIn');
        if (ta) { ta.value = t.getAttribute('data-m5chip'); try { ta.focus(); } catch (err) {} }
        return;
      }
    });
    document.addEventListener('change', function (e) {
      if (e.target && e.target.id === 'm5Priv' && quiz) quiz.priv = e.target.checked ? 1 : 0;
    });
  }

  function ensure() {
    style();
    buildCard();
    buildLife();
    if (!wired) { wired = true; wire(); }
  }

  function mount(FAM) {
    if (ON) return;
    F = FAM;
    ON = true;
    ensure();
    render();
  }

  global.MIND5 = { mount: mount, render: render, onView: onView, start: start, open: openFull };

  /* 본체가 부르는 갈고리에 함께 붙는다 (extra4·game4 뒤에 이어서) */
  var prevRender = global.__FAM_RENDER;
  var prevView = global.__FAM_VIEW;
  global.__FAM_RENDER = function () {
    if (prevRender) { try { prevRender(); } catch (e) {} }
    if (!F && global.FAM && global.FAM.doc && global.FAM.doc()) { try { F = global.FAM; ON = true; } catch (e) {} }
    try { if (F && F.doc() && F.me()) { ensure(); global.MIND5.render(); } } catch (e) { console.warn('MIND5 render', e); }
  };
  global.__FAM_VIEW = function (v) {
    if (prevView) { try { prevView(v); } catch (e) {} }
    try { if (global.MIND5) global.MIND5.onView(v); } catch (e) { console.warn('MIND5 view', e); }
  };
  /* extra4 의 mount 가 끝난 직후에 우리도 붙는다 (목차·생활 틀이 먼저 만들어져야 해서) */
  if (global.FAM4 && typeof global.FAM4.mount === 'function') {
    var om = global.FAM4.mount;
    global.FAM4.mount = function (FAM) {
      om.call(global.FAM4, FAM);
      try { mount(FAM); } catch (e) { console.warn('MIND5 mount', e); }
      try { ensure(); render(); } catch (e) { console.warn('MIND5 ensure', e); }
    };
  }
  /* game4 가 목차·생활 틀을 다시 그리는 경우까지 막아 둔다 */
  if (global.GAME4 && typeof global.GAME4.mount === 'function') {
    var og = global.GAME4.mount;
    global.GAME4.mount = function (FAM) {
      og.call(global.GAME4, FAM);
      try { ensure(); render(); } catch (e) { console.warn('MIND5 ensure', e); }
    };
  }
})(window);
