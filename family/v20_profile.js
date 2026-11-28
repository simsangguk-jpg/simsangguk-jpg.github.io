/* ============================================================
   우리가족포털 V20 · 가족 명함 프로필 + 4종 심리검사 + 매일 구글포토 배경화면
   - 초경량 바닐라 JS (외부 라이브러리 0개 · 발열/버벅임 없음)
   ============================================================ */
(function (global) {
  'use strict';

  var F = null;
  var ON = false;
  var bgIdxOffset = 0;

  function $(id) { return document.getElementById(id); }
  function d() { return F && F.doc(); }
  function me() { return F && F.me(); }
  function esc(s) { return F ? F.esc(s) : String(s == null ? '' : s); }
  function save() { if (F) F.save(); }
  function toast(m) { if (F) F.toast(m); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function todayYmd() {
    var x = new Date();
    return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate());
  }

  /* 음력 설날 표 (1950~2030) — 띠 계산 보정 */
  var ZZ = [
    { n: '쥐', e: '🐭' }, { n: '소', e: '🐮' }, { n: '호랑이', e: '🐯' }, { n: '토끼', e: '🐰' },
    { n: '용', e: '🐲' }, { n: '뱀', e: '🐍' }, { n: '말', e: '🐴' }, { n: '양', e: '🐑' },
    { n: '원숭이', e: '🐵' }, { n: '닭', e: '🐔' }, { n: '개', e: '🐶' }, { n: '돼지', e: '🐷' }
  ];
  var SEOL = {
    1950:'02-17',1951:'02-06',1952:'01-27',1953:'02-14',1954:'02-03',1955:'01-24',1956:'02-12',1957:'01-31',
    1958:'02-18',1959:'02-08',1960:'01-28',1961:'02-15',1962:'02-05',1963:'01-25',1964:'02-13',1965:'02-02',
    1966:'01-21',1967:'02-09',1968:'01-30',1969:'02-17',1970:'02-06',1971:'01-27',1972:'02-15',1973:'02-03',
    1974:'01-23',1975:'02-11',1976:'01-31',1977:'02-18',1978:'02-07',1979:'01-28',1980:'02-16',1981:'02-05',
    1982:'01-25',1983:'02-13',1984:'02-02',1985:'02-20',1986:'02-09',1987:'01-29',1988:'02-17',1989:'02-06',
    1990:'01-27',1991:'02-15',1992:'02-04',1993:'01-23',1994:'02-10',1995:'01-31',1996:'02-19',1997:'02-07',
    1998:'01-28',1999:'02-16',2000:'02-05',2001:'01-24',2002:'02-12',2003:'02-01',2004:'01-22',2005:'02-09',
    2006:'01-29',2007:'02-18',2008:'02-07',2009:'01-26',2010:'02-14',2011:'02-03',2012:'01-23',2013:'02-10',
    2014:'01-31',2015:'02-19',2016:'02-08',2017:'01-28',2018:'02-16',2019:'02-05',2020:'01-25',2021:'02-12',
    2022:'02-01',2023:'01-22',2024:'02-10',2025:'01-29',2026:'02-17',2027:'02-06',2028:'01-26',2029:'02-13',2030:'02-03'
  };
  function zzOf(birth) {
    var y = Number(String(birth || '').slice(0, 4));
    if (!(y > 1900)) return null;
    var md = String(birth || '').slice(5, 10);
    if (SEOL[y] && md && md < SEOL[y]) y -= 1;
    return ZZ[(((y - 4) % 12) + 12) % 12];
  }
  var STARS = [
    { n: '염소자리', e: '♑', from: '12-22', to: '01-19' },
    { n: '물병자리', e: '♒', from: '01-20', to: '02-18' },
    { n: '물고기자리', e: '♓', from: '02-19', to: '03-20' },
    { n: '양자리', e: '♈', from: '03-21', to: '04-19' },
    { n: '황소자리', e: '♉', from: '04-20', to: '05-20' },
    { n: '쌍둥이자리', e: '♊', from: '05-21', to: '06-21' },
    { n: '게자리', e: '♋', from: '06-22', to: '07-22' },
    { n: '사자자리', e: '♌', from: '07-23', to: '08-22' },
    { n: '처녀자리', e: '♍', from: '08-23', to: '09-22' },
    { n: '천칭자리', e: '♎', from: '09-23', to: '10-22' },
    { n: '전갈자리', e: '♏', from: '10-23', to: '11-22' },
    { n: '사수자리', e: '♐', from: '11-23', to: '12-21' }
  ];
  function starOf(birth) {
    var md = String(birth || '').slice(5, 10);
    if (!/^\d\d-\d\d$/.test(md)) return null;
    if (md >= '12-22' || md <= '01-19') return STARS[0];
    for (var i = 1; i < STARS.length; i++) {
      if (md >= STARS[i].from && md <= STARS[i].to) return STARS[i];
    }
    return null;
  }
  function ageInfo(birth) {
    if (!/^\d{4}-\d{2}-\d{2}/.test(String(birth || ''))) return null;
    var y = Number(birth.slice(0, 4)), m = Number(birth.slice(5, 7)), day = Number(birth.slice(8, 10));
    var now = new Date();
    var man = now.getFullYear() - y;
    if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < day)) man -= 1;
    var kr = now.getFullYear() - y + 1;
    return { man: man, kr: kr };
  }
  function bdayDday(birth) {
    if (!/^\d{4}-\d{2}-\d{2}/.test(String(birth || ''))) return null;
    var m = Number(birth.slice(5, 7)), day = Number(birth.slice(8, 10));
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var next = new Date(now.getFullYear(), m - 1, day);
    if (next < today) next = new Date(now.getFullYear() + 1, m - 1, day);
    var diff = Math.round((next - today) / 86400000);
    return diff === 0 ? '🎂 오늘 생일!' : ('D-' + diff);
  }

  /* ── 피드 캐시(배경사진 & 띠 운세) ── */
  var feedCache = null;
  function loadFeed(cb) {
    if (feedCache) { cb(feedCache); return; }
    fetch('./family_feed.json?t=' + todayYmd(), { cache: 'default' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { feedCache = j || {}; cb(feedCache); })
      .catch(function () { cb({}); });
  }

  /* ── 매일 구글포토 가족 배경화면 (1일 1장 · 초경량) ── */
  function applyDailyBg() {
    loadFeed(function (feed) {
      var list = (feed && Array.isArray(feed.bgPhotos)) ? feed.bgPhotos : [];
      if (!list.length) return;
      var ymd = todayYmd();
      var seed = 0;
      for (var i = 0; i < ymd.length; i++) seed = (seed * 31 + ymd.charCodeAt(i)) >>> 0;
      var idx = (seed + bgIdxOffset) % list.length;
      var url = list[idx];
      var wrap = $('v20BgWrap');
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'v20BgWrap';
        wrap.innerHTML = '<img id="v20BgImg" alt="" decoding="async"><div id="v20BgVeil"></div>';
        document.body.insertBefore(wrap, document.body.firstChild);
      }
      var img = $('v20BgImg');
      if (img && img.getAttribute('src') !== url) {
        img.src = url;
      }
      var lbl = $('v20BgLabel');
      if (lbl) lbl.textContent = '🖼️ 오늘의 가족 배경 (' + (idx + 1) + '/' + list.length + ')';
    });
  }

  /* ── 데이터 저장소 (DOC.v9.profiles / DOC.v9.psych) ── */
  function ensureStore() {
    var D = d();
    if (!D) return null;
    if (!D.v9 || typeof D.v9 !== 'object') D.v9 = {};
    if (!D.v9.profiles || typeof D.v9.profiles !== 'object') D.v9.profiles = {};
    if (!D.v9.psych || typeof D.v9.psych !== 'object') D.v9.psych = {};
    /* 기본 프로필 객체 초기화 */
    try {
      var ms = (F && F.members) ? F.members() : [];
      ms.forEach(function (m) {
        if (!m || !m.id) return;
        if (!D.v9.profiles[m.id]) D.v9.profiles[m.id] = {};
      });
    } catch (e) {}
    return D.v9;
  }

  /* ── MBTI 16유형 해설 ── */
  var MBTI_INFO = {
    ISTJ:{ t:'청렴결백한 논리주의자', d:'약속과 책임을 끝까지 지키는 든든한 버팀목', tip:'계획이 바뀌면 미리 알려주면 좋아요' },
    ISFJ:{ t:'용감한 수호자', d:'세심하게 가족을 챙기고 기억하는 다정한 돌봄러', tip:'고마움을 말로 표현하면 힘이 나요' },
    INFJ:{ t:'선의의 옹호자', d:'깊은 통찰력으로 마음을 읽는 따뜻한 조언자', tip:'혼자 생각을 정리할 조용한 시간이 필요해요' },
    INTJ:{ t:'용의주도한 전략가', d:'큰 그림을 보고 가장 효율적인 길을 찾는 해결사', tip:'근거와 이유를 함께 말하면 바로 통합니다' },
    ISTP:{ t:'만능 재주꾼', d:'손재주와 순발력이 뛰어난 실전 해결사', tip:'긴 잔소리보다 핵심 한 마디가 효과적이에요' },
    ISFP:{ t:'호기심 많은 예술가', d:'온화하고 감각적이며 순간을 즐기는 평화주의자', tip:'부담 주지 않고 자연스럽게 어울려 주세요' },
    INFP:{ t:'열정적인 중재자', d:'진심이 담긴 말과 상상으로 따뜻함을 나누는 사람', tip:'마음을 공감해 주면 무엇이든 해내요' },
    INTP:{ t:'논리적인 사색가', d:'호기심이 많고 원리를 파고드는 아이디어 뱅크', tip:'왜 그런지 궁금해할 때 같이 탐구해 보세요' },
    ESTP:{ t:'모험을 즐기는 사업가', d:'에너지가 넘치고 몸으로 부딪혀 해결하는 행동파', tip:'직접 체험하고 움직이는 활동이 최고예요' },
    ESFP:{ t:'자유로운 영혼의 연예인', d:'집안 분위기를 환하게 밝히는 타고난 해피 바이러스', tip:'함께 웃고 리액션해 주면 신이 나요' },
    ENFP:{ t:'재기발랄한 활동가', d:'열정과 아이디어로 새로운 즐거움을 만드는 사람', tip:'작은 아이디어도 크게 응원해 주세요' },
    ENTP:{ t:'뜨거운 논쟁을 즐기는 변론가', d:'재치 있는 질문과 새로운 시도를 즐기는 개척자', tip:'토론과 퀴즈 놀이로 대화가 잘 풀려요' },
    ESTJ:{ t:'엄격한 관리자', d:'기준이 분명하고 일과 생활을 깔끔하게 정리하는 리더', tip:'할 일을 딱 정해 두면 속 시원해합니다' },
    ESFJ:{ t:'사교적인 외교관', d:'가족과 주변의 기분을 가장 먼저 살피는 화목 메이커', tip:'함께 모여 밥 먹고 이야기하는 시간이 중요해요' },
    ENFJ:{ t:'정의로운 사회운동가', d:'응원과 칭찬으로 모두를 이끄는 따뜻한 리더', tip:'진심 어린 격려 한 마디에 큰 힘을 얻어요' },
    ENTJ:{ t:'대담한 통솔자', d:'목표를 정하면 추진력 있게 끝까지 밀어붙이는 대장', tip:'결론부터 말하고 함께 목표를 세우면 좋아요' }
  };

  /* ── 4종 심리검사 문항 데이터 ── */
  var TESTS = {
    mbti: {
      title: '🧩 MBTI 성격유형 검사 (12문항)',
      sub: '우리 가족 각자의 성향을 정확히 찾아 명함에 붙여요',
      qs: [
        { ax:'EI', q:'주말에 에너지를 채우는 나만의 방식은?', a:{ l:'가족·친구와 어울리며 밖에서 활기차게!', v:'E' }, b:{ l:'집에서 조용히 쉬거나 내 취미에 집중!', v:'I' } },
        { ax:'EI', q:'새로운 장소나 모임에 갔을 때 나는?', a:{ l:'먼저 다가가 말 걸고 금방 친해지는 편', v:'E' }, b:{ l:'분위기를 먼저 살피고 천천히 어울리는 편', v:'I' } },
        { ax:'EI', q:'고민이 생겼을 때 나는 주로?', a:{ l:'누군가에게 말로 털어놓으면서 정리한다', v:'E' }, b:{ l:'혼자 속으로 곰곰이 생각한 뒤 말한다', v:'I' } },
        { ax:'SN', q:'새로운 물건이나 앱을 쓸 때 나는?', a:{ l:'설명서와 실제 기능부터 차근차근 확인', v:'S' }, b:{ l:'일단 눌러보며 이런저런 응용부터 상상', v:'N' } },
        { ax:'SN', q:'이야기를 들을 때 더 기억에 남는 것은?', a:{ l:'구체적인 날짜, 숫자, 실제로 있었던 사실', v:'S' }, b:{ l:'전체적인 흐름, 숨은 의미와 앞으로의 가능성', v:'N' } },
        { ax:'SN', q:'여행을 앞두고 내 머릿속에 떠오르는 건?', a:{ l:'맛집, 이동 시간, 챙길 준비물 체크리스트', v:'S' }, b:{ l:'거기서 느낄 분위기, 특별한 추억과 아이디어', v:'N' } },
        { ax:'TF', q:'가족이 속상한 일을 털어놓았을 때 첫 반응은?', a:{ l:'"왜 그렇게 됐지? 해결 방법부터 찾아보자!"', v:'T' }, b:{ l:'"헐 진짜 속상했겠다… 괜찮아?" 공감부터!', v:'F' } },
        { ax:'TF', q:'중요한 결정을 내릴 때 더 크게 보는 기준은?', a:{ l:'객관적 효율, 장단점, 현실적인 이득', v:'T' }, b:{ l:'우리 가족의 기분, 마음의 편안함과 관계', v:'F' } },
        { ax:'TF', q:'칭찬을 들었을 때 더 기분 좋은 말은?', a:{ l:'"역시 똑똑하고 일 처리가 완벽하네!"', v:'T' }, b:{ l:'"덕분에 마음이 따뜻해졌어, 고마워!"', v:'F' } },
        { ax:'JP', q:'오늘 해야 할 일이나 숙제가 있을 때 나는?', a:{ l:'미리 시간 계획을 세워 깔끔히 끝내야 편하다', v:'J' }, b:{ l:'상황 보면서 유연하게, 막판 집중력이 좋다', v:'P' } },
        { ax:'JP', q:'방이나 책상이 어질러져 있을 때 내 느낌은?', a:{ l:'눈에 거슬려서 제자리에 정리해야 직성이 풀림', v:'J' }, b:{ l:'어디에 뭐 있는지 나만 알면 크게 신경 안 씀', v:'P' } },
        { ax:'JP', q:'갑작스러운 일정 변경이 생기면 나는?', a:{ l:'원래 계획이 틀어져서 살짝 당황스럽다', v:'J' }, b:{ l:'"오히려 좋아!" 상황에 맞춰 새로 즐긴다', v:'P' } }
      ]
    },
    temper: {
      title: '🔥 나의 에너지 · 기질 테스트 (8문항)',
      sub: '평소 행동 패턴으로 보는 내 본캐 기질',
      qs: [
        { q:'아침에 일어났을 때 가장 먼저 드는 생각은?', opts:[
          { l:'오늘 끝낼 일부터 빠르게 체크!', k:'leader' },
          { l:'가족들 잘 잤나? 기분 좋게 인사!', k:'sun' },
          { l:'조용히 물 한 잔 마시며 멍 때리기', k:'forest' },
          { l:'어제 생각한 재밌는 거 해볼까?', k:'spark' }
        ]},
        { q:'가족이 다 같이 외식 메뉴를 못 정할 때 나는?', opts:[
          { l:'"여기 평점 좋고 가까우니 여기로 가자!"', k:'leader' },
          { l:'"각자 먹고 싶은 거 하나씩 말해보자~"', k:'sun' },
          { l:'"다들 좋아하는 거면 나도 다 좋아"', k:'forest' },
          { l:'"안 가본 신메뉴 파는 곳 한번 가볼래?"', k:'spark' }
        ]},
        { q:'어려운 문제가 딱 막혔을 때 나는?', opts:[
          { l:'정면 돌파! 될 때까지 끝까지 파고든다', k:'leader' },
          { l:'주변에 물어보거나 응원받으며 푼다', k:'sun' },
          { l:'잠깐 쉬고 차분히 원인을 다시 본다', k:'forest' },
          { l:'전혀 다른 새로운 우회 방법을 떠올린다', k:'spark' }
        ]},
        { q:'내가 가장 뿌듯하고 신나는 순간은?', opts:[
          { l:'목표를 내 손으로 멋지게 달성했을 때', k:'leader' },
          { l:'내가 챙겨준 사람이 활짝 웃을 때', k:'sun' },
          { l:'아무 걱정 없이 평화롭고 안정될 때', k:'forest' },
          { l:'남들이 생각 못한 아이디어를 냈을 때', k:'spark' }
        ]},
        { q:'취미나 여가 시간을 보낼 때 끌리는 스타일은?', opts:[
          { l:'기록을 깨거나 실력이 느는 성취감 있는 활동', k:'leader' },
          { l:'여럿이 웃고 떠들며 함께 하는 활동', k:'sun' },
          { l:'산책·독서·음악 감상처럼 편안한 힐링', k:'forest' },
          { l:'새로운 앱·만들기·탐험 같은 신기한 활동', k:'spark' }
        ]},
        { q:'누군가 나에게 실수했을 때 내 마음은?', opts:[
          { l:'다음엔 안 그러도록 확실히 짚고 넘어간다', k:'leader' },
          { l:'"괜찮아, 일부러 그런 거 아니잖아"', k:'sun' },
          { l:'잠깐 속상해도 금방 마음속으로 삭인다', k:'forest' },
          { l:'"왜 저랬지?" 호기심이 먼저 들고 금방 잊는다', k:'spark' }
        ]},
        { q:'물건을 살 때 가장 중요하게 보는 것은?', opts:[
          { l:'성능·가성비·실용성 스펙 비교', k:'leader' },
          { l:'가족이 같이 쓸 수 있고 기분 좋은 디자인', k:'sun' },
          { l:'오래 써도 질리지 않고 튼튼한 기본기', k:'forest' },
          { l:'신기능·독특함·트렌디한 매력', k:'spark' }
        ]},
        { q:'나를 한 가지 자연 요소에 비유한다면?', opts:[
          { l:'타오르는 추진력의 불꽃 🔥', k:'leader' },
          { l:'모두를 비추는 따뜻한 햇살 ☀️', k:'sun' },
          { l:'흔들리지 않는 깊은 숲 🌿', k:'forest' },
          { l:'어디로 튈지 모르는 번쩍임 ⚡', k:'spark' }
        ]}
      ],
      res: {
        leader: { badge:'🔥 불꽃 리더형', d:'목표가 보이면 거침없이 추진하는 우리 집 대장 기질! 결단력과 책임감이 최고입니다.' },
        sun:    { badge:'☀️ 따스한 햇살형', d:'사람의 마음을 먼저 살피고 웃음을 퍼뜨리는 다정한 기질! 함께 있으면 마음이 놓여요.' },
        forest: { badge:'🌿 차분한 숲속형', d:'쉽게 흔들리지 않고 묵묵히 중심을 잡아주는 안정적인 기질! 사려 깊고 믿음직합니다.' },
        spark:  { badge:'⚡ 반짝 아이디어형', d:'호기심과 창의력이 넘쳐 매일을 새롭게 만드는 기질! 엉뚱하지만 멋진 해답을 잘 찾아요.' }
      }
    },
    role: {
      title: '🏡 우리 가족 찰떡 역할 테스트 (6문항)',
      sub: '우리 집 안에서 내가 맡고 있는 진짜 역할은?',
      qs: [
        { q:'집안 분위기가 조용하거나 어색할 때 나는?', opts:[
          { l:'농담이나 재밌는 얘기로 웃음 터뜨리기', k:'mood' },
          { l:'"배고프지? 뭐 먹을래?" 실속 챙기기', k:'fixer' },
          { l:'조용히 옆에 앉아 기분 살펴주기', k:'care' },
          { l:'다음 주말 나들이나 할 일 찾아보기', k:'strat' }
        ]},
        { q:'집에 고장 나거나 해결해야 할 일이 생기면?', opts:[
          { l:'응원 단장처럼 옆에서 기운 북돋아 주기', k:'mood' },
          { l:'직접 팔 걷어붙이고 바로 고치기', k:'fixer' },
          { l:'고치는 사람 물·간식 챙겨주기', k:'care' },
          { l:'원인 검색해서 최적의 방법 알려주기', k:'strat' }
        ]},
        { q:'가족 단체 사진 찍을 때 내 포지션은?', opts:[
          { l:'제일 익살스럽거나 큰 포즈 담당!', k:'mood' },
          { l:'구도·타이머 맞추고 모두 자리 잡게 하기', k:'fixer' },
          { l:'옷매무새·머리 정리해 주기', k:'care' },
          { l:'배경 좋고 예쁜 포토존 먼저 스캔하기', k:'strat' }
        ]},
        { q:'가족 누군가가 시험·행사를 앞두고 있을 때?', opts:[
          { l:'긴장 풀리게 유쾌한 응원 멘트 날리기', k:'mood' },
          { l:'준비물·교통·시간표 빈틈없이 챙기기', k:'fixer' },
          { l:'따뜻하게 안아주거나 마음 다독여 주기', k:'care' },
          { l:'핵심 팁이랑 컨디션 관리 전략 짜주기', k:'strat' }
        ]},
        { q:'가족 톡방이나 포털에서 내가 제일 자주 올리는 건?', opts:[
          { l:'웃긴 짤, 사진, 신나는 소식', k:'mood' },
          { l:'일정, 준비물, 꼭 해야 할 공지', k:'fixer' },
          { l:'"조심히 가", "사랑해" 따뜻한 안부', k:'care' },
          { l:'유용한 정보글, 할인·꿀팁 링크', k:'strat' }
        ]},
        { q:'우리 가족에게 내가 꼭 필요한 이유는?', opts:[
          { l:'내가 없으면 집이 너무 심심할걸요!', k:'mood' },
          { l:'내가 있어야 일이 착착 돌아가니까요!', k:'fixer' },
          { l:'내가 있어서 서로 마음이 따뜻해지니까요!', k:'care' },
          { l:'내가 있어서 늘 더 좋은 길을 찾으니까요!', k:'strat' }
        ]}
      ],
      res: {
        mood:  { badge:'🎉 분위기 메이커', d:'웃음과 활력을 담당하는 우리 집 에너지 충전기!' },
        fixer: { badge:'🛡️ 든든한 해결사', d:'무슨 일이든 믿고 맡길 수 있는 우리 집 기둥!' },
        care:  { badge:'💛 다정한 공감러', d:'마음의 온도를 높여주는 우리 집 힐링 담당!' },
        strat: { badge:'🧭 똑똑한 전략가', d:'정보와 아이디어로 가족을 이끄는 내비게이션!' }
      }
    },
    mind: {
      title: '🌤️ 오늘의 마음 날씨 체크 (5문항)',
      sub: '지금 내 기분과 컨디션을 10초 만에 점검해요',
      qs: [
        { q:'지금 이 순간 내 머릿속과 몸의 가벼운 정도는?', opts:[{ l:'가뿐하고 상쾌해!', s:20 },{ l:'무난하고 괜찮아', s:15 },{ l:'살짝 뻐근·피곤해', s:9 },{ l:'많이 지쳤어…', s:4 }] },
        { q:'오늘 내 마음속 기분 온도는 어떤가요?', opts:[{ l:'설레고 기분 최고!', s:20 },{ l:'잔잔하고 평온해', s:15 },{ l:'조금 심심하거나 답답', s:10 },{ l:'우울하거나 예민해', s:4 }] },
        { q:'지금 무언가에 집중하거나 해낼 의욕은?', opts:[{ l:'의욕 100%! 뭐든 할 수 있어', s:20 },{ l:'할 일은 거뜬히 해!', s:15 },{ l:'조금 미루고 싶은 기분', s:9 },{ l:'아무것도 안 하고 쉬고 싶어', s:4 }] },
        { q:'가족이나 주변 사람들과 대화하고 싶은 정도는?', opts:[{ l:'수다 떨고 장난치고 싶어!', s:20 },{ l:'다정하게 안부 나누고 싶어', s:16 },{ l:'필요한 말만 짧게 하고 싶어', s:10 },{ l:'잠깐 혼자만의 시간이 필요해', s:5 }] },
        { q:'오늘 나 자신에게 점수를 준다면?', opts:[{ l:'오늘 나 정말 멋지다! 최고!', s:20 },{ l:'열심히 잘 해내고 있어', s:16 },{ l:'조금 아쉽지만 괜찮아', s:11 },{ l:'토닥토닥 위로가 필요해', s:6 }] }
      ]
    },
    talk: {
      title: '💬 대화 · 소통 스타일 테스트 (6문항)',
      sub: '내가 가족과 대화할 때 가장 편안한 말투와 방식은?',
      qs: [
        { q:'가족에게 중요한 이야기를 꺼낼 때 나는?', opts:[
          { l:'핵심 결론부터 딱! 명확하게 말한다', k:'direct' },
          { l:'상대 기분 살피면서 부드럽게 말한다', k:'warm' },
          { l:'농담 섞어 웃기면서 자연스럽게 말한다', k:'humor' },
          { l:'머릿속으로 정리한 뒤 차분하게 말한다', k:'calm' }
        ]},
        { q:'가족이 고민을 말할 때 나의 반응은?', opts:[
          { l:'"이건 이렇게 해결하면 돼!" 답을 준다', k:'direct' },
          { l:'"그랬구나, 많이 힘들었겠다" 고개를 끄덕인다', k:'warm' },
          { l:'"에이 그건 별거 아니지~" 분위기 띄워준다', k:'humor' },
          { l:'끝까지 조용히 듣고 핵심을 짚어준다', k:'calm' }
        ]},
        { q:'가족 단체 톡방에서 내 스타일은?', opts:[
          { l:'필요한 일정·공지 딱 보내고 끝!', k:'direct' },
          { l:'하트·응원 이모티콘 자주 보낸다', k:'warm' },
          { l:'웃긴 사진이나 짤·드립을 날린다', k:'humor' },
          { l:'읽고 필요할 때만 깔끔하게 답한다', k:'calm' }
        ]},
        { q:'서운한 일이 생겼을 때 나는?', opts:[
          { l:'바로 말해서 풀어야 속이 후련하다', k:'direct' },
          { l:'상대가 상처받을까 봐 조심스레 말한다', k:'warm' },
          { l:'장난스럽게 툭 던지며 넘기는 편', k:'humor' },
          { l:'시간을 두고 생각을 정리한 뒤 얘기한다', k:'calm' }
        ]},
        { q:'가족에게 가장 듣고 싶은 말은?', opts:[
          { l:'"역시 정확하고 믿음직해!"', k:'direct' },
          { l:'"네가 있어서 마음이 참 따뜻해"', k:'warm' },
          { l:'"너랑 얘기하면 시간 가는 줄 몰라ㅋㅋ"', k:'humor' },
          { l:'"너는 참 사려 깊고 든든해"', k:'calm' }
        ]},
        { q:'대화할 때 내가 가장 중요하게 여기는 건?', opts:[
          { l:'시간 낭비 없이 빠르고 정확한 소통', k:'direct' },
          { l:'서로의 마음을 다치지 않게 하는 배려', k:'warm' },
          { l:'웃음과 유쾌한 에너지', k:'humor' },
          { l:'진중하고 깊이 있는 이해', k:'calm' }
        ]}
      ],
      res: {
        direct: { badge:'💬 직진 해결형', d:'군더더기 없이 핵심을 딱 짚어주는 시원시원한 소통가! 결론부터 말하면 가장 잘 통합니다.' },
        warm:   { badge:'💛 다정 경청형', d:'상대의 마음과 감정을 먼저 어루만져 주는 따뜻한 소통가! 진심 어린 공감이 큰 힘이 됩니다.' },
        humor:  { badge:'😄 유쾌 드립형', d:'어떤 상황에서도 웃음을 만들어 내는 분위기 메이커! 가벼운 농담으로 긴장을 잘 풀어줘요.' },
        calm:   { badge:'🧘 신중 관찰형', d:'먼저 끝까지 듣고 깊이 생각해 꼭 필요한 한마디를 건네는 믿음직한 소통가입니다.' }
      }
    },
    talent: {
      title: '🎯 나만의 강점 · 재능 TOP 테스트 (6문항)',
      sub: '내가 가장 잘하고 빛나는 핵심 강점은 무엇일까?',
      qs: [
        { q:'새로운 도전을 시작할 때 내 가장 큰 무기는?', opts:[
          { l:'망설이지 않는 빠른 실행력', k:'drive' },
          { l:'주변 사람을 내 편으로 만드는 친화력', k:'empathy' },
          { l:'남들이 못 보는 기발한 아이디어', k:'creative' },
          { l:'실수 없이 챙기는 꼼꼼한 분석력', k:'detail' }
        ]},
        { q:'친구들이나 가족이 나에게 자주 부탁하는 건?', opts:[
          { l:'"이거 어떻게 추진하지? 총대 좀 매줘!"', k:'drive' },
          { l:'"내 얘기 좀 들어줄래? 고민 있어"', k:'empathy' },
          { l:'"새로운 거 뭐 재밌는 거 없을까?"', k:'creative' },
          { l:'"이거 계산·비교 좀 정확히 봐줘"', k:'detail' }
        ]},
        { q:'어려운 과제를 만났을 때 내가 빛나는 순간은?', opts:[
          { l:'위기 상황에서 빠르게 결단 내릴 때', k:'drive' },
          { l:'팀이나 가족이 뭉치게 분위기를 모을 때', k:'empathy' },
          { l:'막힌 문제에 색다른 해법을 찾을 때', k:'creative' },
          { l:'숨은 오류나 빠진 부분을 찾아낼 때', k:'detail' }
        ]},
        { q:'내가 배울 때 가장 빨리 느는 분야는?', opts:[
          { l:'목표와 보상이 뚜렷한 실전 기술', k:'drive' },
          { l:'사람과 어울리고 소통하는 활동', k:'empathy' },
          { l:'만들기·그림·기획 같은 창작 활동', k:'creative' },
          { l:'규칙·원리·데이터를 다루는 분야', k:'detail' }
        ]},
        { q:'여행을 갈 때 내가 자연스럽게 맡는 파트는?', opts:[
          { l:'동선 리드하고 현장 진행하기', k:'drive' },
          { l:'다들 불편한 데 없나 컨디션 챙기기', k:'empathy' },
          { l:'예쁜 사진 포인트·이색 코스 찾기', k:'creative' },
          { l:'예산·예약·준비물 리스트 완벽 점검', k:'detail' }
        ]},
        { q:'10년 뒤 내가 가장 듣고 싶은 평가는?', opts:[
          { l:'"못 해내는 게 없는 진짜 능력자"', k:'drive' },
          { l:'"누구나 곁에 두고 싶어 하는 따뜻한 사람"', k:'empathy' },
          { l:'"늘 새롭고 멋진 걸 만들어 내는 사람"', k:'creative' },
          { l:'"믿고 맡기면 빈틈이 없는 전문가"', k:'detail' }
        ]}
      ],
      res: {
        drive:    { badge:'🚀 추진력 대장', d:'목표를 세우면 행동으로 옮겨 결과를 만들어 내는 강력한 실행력의 소유자!' },
        empathy:  { badge:'🤝 공감 천재', d:'사람의 마음을 읽고 하나로 모으는 따뜻한 리더십과 친화력이 최고의 무기!' },
        creative: { badge:'🎨 창의력 뱅크', d:'고정관념을 깨고 새로운 재미와 아이디어를 뿜어내는 타고난 크리에이터!' },
        detail:   { badge:'🔍 꼼꼼 마스터', d:'작은 디테일과 데이터를 놓치지 않고 완성도를 끝까지 끌어올리는 해결사!' }
      }
    }
  };

  /* ── 홈 화면 카드 렌더링 (명함 프로필 + 심리검사 센터) ── */
  function renderProfileBoard() {
    if (!ON || !F || !F.doc() || !F.me()) return;
    var home = $('view-home');
    if (!home) return;
    var v9 = ensureStore();
    if (!v9) return;

    var card = $('v20ProfileCard');
    if (!card) {
      card = document.createElement('div');
      card.id = 'v20ProfileCard';
      card.className = 'card v20-card';
      var anchor = $('v9DdayCard') || $('v9ShiftCard') || home.firstChild;
      if (anchor && anchor.parentNode === home) {
        home.insertBefore(card, anchor.nextSibling);
      } else {
        home.appendChild(card);
      }
    }

    /* 기존 v9FortuneCard가 중복으로 보이면 깔끔하게 보조 참고용으로 접거나 숨김 처리 */
    var oldFz = $('v9FortuneCard');
    if (oldFz) oldFz.style.display = 'none';

    var ms = F.members() || [];
    var curMe = me();
    var isDad = curMe && (curMe.role === '아빠' || curMe.id === 'simsangguk');
    var fortunes = (feedCache && feedCache.fortunes) ? feedCache.fortunes : {};

    var html = '' +
      '<div class="card-head">' +
        '<div><h2>🪪 우리 가족 명함 &amp; 심리검사</h2><div class="sub">한눈에 보는 가족 특징 · 성격 · 운세 · 생일 디데이</div></div>' +
        '<button type="button" class="v20-bg-chip" id="v20BgCtrl" title="눌러서 다른 가족사진 배경 미리보기">🖼️ 배경 바꾸기</button>' +
      '</div>' +
      '<div class="v20-psych-bar">' +
        '<button type="button" class="v20-qbtn q-mbti" data-test="mbti">🧩 MBTI 검사</button>' +
        '<button type="button" class="v20-qbtn q-temper" data-test="temper">🔥 기질 테스트</button>' +
        '<button type="button" class="v20-qbtn q-role" data-test="role">🏡 가족역할</button>' +
        '<button type="button" class="v20-qbtn q-mind" data-test="mind">🌤️ 마음날씨</button>' +
        '<button type="button" class="v20-qbtn q-talk" data-test="talk">💬 소통스타일</button>' +
        '<button type="button" class="v20-qbtn q-talent" data-test="talent">🎯 강점·재능</button>' +
      '</div>' +
      '<div class="v20-grid">';

    ms.forEach(function (m) {
      if (!m || !m.id) return;
      var p = v9.profiles[m.id] || {};
      var ps = v9.psych[m.id] || {};
      var birth = String(m.birth || '').slice(0, 10);
      var zz = zzOf(birth);
      var st = starOf(birth);
      var age = ageInfo(birth);
      var dd = bdayDday(birth);
      var mbtiCode = (p.mbti || (ps.mbti && ps.mbti.code) || '').toUpperCase();
      var mbtiMeta = MBTI_INFO[mbtiCode];
      var fort = (zz && fortunes[zz.n]) ? fortunes[zz.n] : '';
      var isSelf = curMe && curMe.id === m.id;
      var canEdit = isSelf || isDad;

      var avatarHtml = p.photo
        ? '<img class="v20-av-img" src="' + esc(p.photo) + '" alt="' + esc(m.name) + '">'
        : '<div class="v20-av-emo">' + esc(m.emoji || '🧑') + '</div>';

      /* 심리검사 특징 뱃지 */
      var traits = '';
      if (mbtiCode) traits += '<span class="v20-trait t-mbti">🧩 ' + esc(mbtiCode) + (mbtiMeta ? ' · ' + esc(mbtiMeta.t) : '') + '</span>';
      if (ps.temper && ps.temper.badge) traits += '<span class="v20-trait t-temp">' + esc(ps.temper.badge) + '</span>';
      if (ps.role && ps.role.badge) traits += '<span class="v20-trait t-role">' + esc(ps.role.badge) + '</span>';
      if (ps.mind && ps.mind.score != null) traits += '<span class="v20-trait t-mind">' + esc(ps.mind.icon || '🌤️') + ' 마음 ' + esc(ps.mind.score) + '점</span>';
      if (ps.talk && ps.talk.badge) traits += '<span class="v20-trait t-talk">' + esc(ps.talk.badge) + '</span>';
      if (ps.talent && ps.talent.badge) traits += '<span class="v20-trait t-talent">' + esc(ps.talent.badge) + '</span>';
      if (!traits) traits = '<span class="v20-trait t-empty">✨ 위 심리검사 6종으로 내 특징을 채워보세요!</span>';

      var specText = p.blood ? (esc(p.blood) + '형') : '미입력';

      var favs = '';
      if (p.favFood) favs += '<span class="v20-fav">🍽️ ' + esc(p.favFood) + '</span>';
      if (p.favToy) favs += '<span class="v20-fav">🧸 ' + esc(p.favToy) + '</span>';
      if (p.favBook) favs += '<span class="v20-fav">📚 ' + esc(p.favBook) + '</span>';
      if (p.favHobby) favs += '<span class="v20-fav">🎨 ' + esc(p.favHobby) + '</span>';
      if (p.favSport) favs += '<span class="v20-fav">🏃 ' + esc(p.favSport) + '</span>';

      html += '' +
        '<div class="v20-biz' + (isSelf ? ' is-me' : '') + '">' +
          '<div class="v20-biz-top">' +
            avatarHtml +
            '<div class="v20-biz-id">' +
              '<div class="v20-name-row">' +
                '<strong>' + esc(m.name) + '</strong>' +
                '<span class="v20-role">' + esc(m.role || '가족') + '</span>' +
                (dd ? '<span class="v20-dday">' + esc(dd) + '</span>' : '') +
              '</div>' +
              '<div class="v20-subline">' +
                (birth ? esc(birth.replace(/-/g, '.')) : '생일 미등록') +
                (age ? ' · 만 ' + age.man + '세(' + age.kr + '세)' : '') +
              '</div>' +
              '<div class="v20-subline">' +
                (zz ? zz.e + ' ' + zz.n + '띠' : '띠 미정') +
                (st ? ' · ' + st.e + ' ' + st.n : '') +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="v20-traits">' + traits + '</div>' +
          '<div class="v20-facts">' +
            '<div><span>🩸 혈액형</span><b>' + specText + '</b></div>' +
            (fort ? '<div><span>🔮 오늘 내 운세</span><b>' + esc(fort) + '</b></div>' : '') +
            (p.note ? '<div><span>📝 나의 한줄·기록</span><b>' + esc(p.note) + '</b></div>' : '') +
          '</div>' +
          (favs ? '<div class="v20-favs">' + favs + '</div>' : '') +
          '<div class="v20-biz-act">' +
            (canEdit ? '<button type="button" class="v20-btn-edit" data-edit="' + esc(m.id) + '">✏️ 명함 수정</button>' : '') +
            (isSelf ? '<button type="button" class="v20-btn-test" data-test="mbti">🧠 내 심리검사</button>' : '') +
          '</div>' +
        '</div>';
    });

    html += '</div>';
    card.innerHTML = html;

    var bgBtn = $('v20BgCtrl');
    if (bgBtn) {
      bgBtn.onclick = function () {
        bgIdxOffset += 1;
        applyDailyBg();
        toast('다음 가족사진 배경으로 바꿨어요!');
      };
    }

    card.querySelectorAll('[data-test]').forEach(function (b) {
      b.onclick = function () { openPsychModal(b.getAttribute('data-test')); };
    });
    card.querySelectorAll('[data-edit]').forEach(function (b) {
      b.onclick = function () { openEditModal(b.getAttribute('data-edit')); };
    });
  }

  /* ── 모달 유틸 (화면 정중앙 새 창 고정 + 스크롤 잠금) ── */
  function closeModal() {
    var m = $('v20Modal');
    if (m) m.classList.add('hidden');
    document.body.style.overflow = '';
  }
  function openModalBox() {
    var m = ensureModal();
    m.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    return m;
  }
  function ensureModal() {
    var m = $('v20Modal');
    if (m) return m;
    m = document.createElement('div');
    m.id = 'v20Modal';
    m.className = 'v20-modal hidden';
    m.innerHTML = '<div class="v20-modal-box"><div class="v20-modal-hd"><strong id="v20MTitle"></strong><button type="button" id="v20MClose">✕</button></div><div id="v20MBody"></div></div>';
    document.body.appendChild(m);
    $('v20MClose').onclick = closeModal;
    m.onclick = function (e) { if (e.target === m) closeModal(); };
    return m;
  }

  /* ── 명함 수정 모달 (사진 리사이즈 + MBTI + 혈액형 + 한줄 기록) ── */
  function openEditModal(targetId) {
    var v9 = ensureStore();
    var mObj = F.memOf(targetId);
    if (!v9 || !mObj) return;
    var p = v9.profiles[targetId] || (v9.profiles[targetId] = {});
    var modal = ensureModal();
    $('v20MTitle').textContent = '✏️ ' + mObj.name + ' 명함 수정';

    var mbtiOpts = '<option value="">선택 안 함 (심리검사 권장)</option>' +
      Object.keys(MBTI_INFO).map(function (k) {
        return '<option value="' + k + '"' + (p.mbti === k ? ' selected' : '') + '>' + k + ' · ' + MBTI_INFO[k].t + '</option>';
      }).join('');
    var bloodOpts = ['', 'A', 'B', 'O', 'AB'].map(function (b) {
      return '<option value="' + b + '"' + (p.blood === b ? ' selected' : '') + '>' + (b ? b + '형' : '선택 안 함') + '</option>';
    }).join('');

    $('v20MBody').innerHTML = '' +
      '<div class="v20-form">' +
        '<label>📷 프로필 사진 (자동 경량화)</label>' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">' +
          '<input type="file" id="v20PhotoFile" accept="image/*" style="flex:1;font-size:13px">' +
          (p.photo ? '<button type="button" id="v20PhotoDel" class="v20-btn-del">사진 지우기</button>' : '') +
        '</div>' +
        '<div class="v20-row2">' +
          '<div><label>🩸 혈액형</label><select id="v20B" class="field">' + bloodOpts + '</select></div>' +
          '<div><label>🧩 MBTI</label><select id="v20Mb" class="field">' + mbtiOpts + '</select></div>' +
        '</div>' +
        '<label>📝 나의 한줄 소개 · 목표 · 기록</label>' +
        '<input id="v20Note" class="field" maxlength="80" value="' + esc(p.note || '') + '" placeholder="예: 매일 30분 걷기! 가족과 웃는 시간">' +
        '<div class="v20-row2">' +
          '<div><label>🍽️ 좋아하는 음식</label><input id="v20FavFood" class="field" maxlength="40" value="' + esc(p.favFood || '') + '" placeholder="예: 삼겹살, 초밥"></div>' +
          '<div><label>🧸 장난감 · 관심템</label><input id="v20FavToy" class="field" maxlength="40" value="' + esc(p.favToy || '') + '" placeholder="예: 레고, 테크 가젯"></div>' +
        '</div>' +
        '<div class="v20-row2">' +
          '<div><label>📚 좋아하는 책</label><input id="v20FavBook" class="field" maxlength="40" value="' + esc(p.favBook || '') + '" placeholder="예: 추리소설, 과학만화"></div>' +
          '<div><label>🎨 취미 · 활동</label><input id="v20FavHobby" class="field" maxlength="40" value="' + esc(p.favHobby || '') + '" placeholder="예: 사진, 보드게임"></div>' +
        '</div>' +
        '<label>🏃 좋아하는 운동</label>' +
        '<input id="v20FavSport" class="field" maxlength="40" value="' + esc(p.favSport || '') + '" placeholder="예: 러닝, 헬스, 축구">' +
        '<button type="button" id="v20SaveBtn" class="v20-btn-primary">💾 명함 저장하기</button>' +
      '</div>';

    var fileIn = $('v20PhotoFile');
    var newPhotoData = p.photo || '';
    if (fileIn) {
      fileIn.onchange = function (e) {
        var f = e.target.files && e.target.files[0];
        if (!f) return;
        var rd = new FileReader();
        rd.onload = function (ev) {
          var im = new Image();
          im.onload = function () {
            var max = 220, sw = im.width, sh = im.height;
            var sc = Math.min(max / sw, max / sh, 1);
            var c = document.createElement('canvas');
            c.width = Math.round(sw * sc);
            c.height = Math.round(sh * sc);
            c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
            newPhotoData = c.toDataURL('image/jpeg', 0.72);
            toast('사진이 가볍게 준비됐어요! 저장을 눌러주세요');
          };
          im.src = ev.target.result;
        };
        rd.readAsDataURL(f);
      };
    }
    var delBtn = $('v20PhotoDel');
    if (delBtn) {
      delBtn.onclick = function () {
        newPhotoData = '';
        toast('저장 시 사진이 삭제됩니다');
      };
    }

    $('v20SaveBtn').onclick = function () {
      var curV9 = ensureStore();
      if (!curV9) return;
      var curP = curV9.profiles[targetId] || (curV9.profiles[targetId] = {});
      delete curP.height;
      delete curP.weight;
      curP.blood = $('v20B').value;
      curP.mbti = $('v20Mb').value;
      curP.note = ($('v20Note').value || '').trim();
      curP.favFood = ($('v20FavFood').value || '').trim();
      curP.favToy = ($('v20FavToy').value || '').trim();
      curP.favBook = ($('v20FavBook').value || '').trim();
      curP.favHobby = ($('v20FavHobby').value || '').trim();
      curP.favSport = ($('v20FavSport').value || '').trim();
      curP.photo = newPhotoData ? newPhotoData : '';
      curP.at = Date.now();
      save();
      closeModal();
      renderProfileBoard();
      toast(mObj.name + ' 명함이 저장됐어요!');
    };
    openModalBox();
  }

  /* ── 6종 심리검사 모달 (진행 상태 자동 저장 & 중간 이어하기 지원) ── */
  function openPsychModal(kind) {
    var spec = TESTS[kind];
    if (!spec) return;
    var cur = me();
    var progKey = 'sgf_psych_prog_' + (cur ? cur.id : 'guest') + '_' + kind;
    var modal = openModalBox();
    $('v20MTitle').textContent = spec.title;
    var step = 0;
    var answers = [];

    function saveProg() {
      try {
        localStorage.setItem(progKey, JSON.stringify({ step: step, answers: answers, at: Date.now() }));
      } catch (e) {}
    }
    function clearProg() {
      try { localStorage.removeItem(progKey); } catch (e) {}
    }

    function paintQ() {
      var q = spec.qs[step];
      var pct = Math.round(((step) / spec.qs.length) * 100);
      var h = '<div class="v20-prog"><div style="width:' + pct + '%"></div></div>' +
        '<div class="v20-qcnt">' + (step + 1) + ' / ' + spec.qs.length + ' · ' + esc(spec.sub) + ' <span style="color:#0EA5E9">(자동 저장중)</span></div>' +
        '<div class="v20-qtxt">' + esc(q.q) + '</div><div class="v20-opts">';
      if (kind === 'mbti') {
        h += '<button type="button" class="v20-opt" data-v="' + q.a.v + '">' + esc(q.a.l) + '</button>';
        h += '<button type="button" class="v20-opt" data-v="' + q.b.v + '">' + esc(q.b.l) + '</button>';
      } else {
        q.opts.forEach(function (o, i) {
          h += '<button type="button" class="v20-opt" data-i="' + i + '">' + esc(o.l) + '</button>';
        });
      }
      h += '</div>';
      if (step > 0) h += '<button type="button" id="v20PrevQ" class="v20-btn-back">← 이전 문항</button>';
      $('v20MBody').innerHTML = h;

      $('v20MBody').querySelectorAll('.v20-opt').forEach(function (btn) {
        btn.onclick = function () {
          if (kind === 'mbti') {
            answers[step] = { ax: q.ax, v: btn.getAttribute('data-v') };
          } else {
            var idx = Number(btn.getAttribute('data-i'));
            answers[step] = q.opts[idx];
          }
          step += 1;
          if (step < spec.qs.length) {
            saveProg();
            paintQ();
          } else {
            clearProg();
            finishTest();
          }
        };
      });
      var pb = $('v20PrevQ');
      if (pb) pb.onclick = function () { step -= 1; saveProg(); paintQ(); };
    }

    function finishTest() {
      var cur = me();
      if (!cur) return;
      var v9 = ensureStore();
      var p = v9.profiles[cur.id] || (v9.profiles[cur.id] = {});
      var ps = v9.psych[cur.id] || (v9.psych[cur.id] = {});
      var resHtml = '';

      if (kind === 'mbti') {
        var cnt = { E:0,I:0,S:0,N:0,T:0,F:0,J:0,P:0 };
        answers.forEach(function (a) { cnt[a.v] = (cnt[a.v] || 0) + 1; });
        var code = (cnt.E >= cnt.I ? 'E' : 'I') + (cnt.S >= cnt.N ? 'S' : 'N') +
                   (cnt.T >= cnt.F ? 'T' : 'F') + (cnt.J >= cnt.P ? 'J' : 'P');
        var info = MBTI_INFO[code] || { t:'', d:'', tip:'' };
        p.mbti = code;
        p.at = Date.now();
        ps.mbti = { code: code, at: Date.now(), ymd: todayYmd() };
        resHtml = '<div class="v20-res-box">' +
          '<div class="v20-res-big">🧩 ' + code + '</div>' +
          '<div class="v20-res-sub">' + esc(info.t) + '</div>' +
          '<p>' + esc(info.d) + '</p>' +
          '<div class="v20-res-tip">💡 <b>가족 소통 팁:</b> ' + esc(info.tip) + '</div>' +
          '</div>';
      } else if (kind === 'temper' || kind === 'role' || kind === 'talk' || kind === 'talent') {
        var tally = {};
        answers.forEach(function (o) { tally[o.k] = (tally[o.k] || 0) + 1; });
        var best = Object.keys(tally).sort(function (a, b) { return tally[b] - tally[a]; })[0];
        var r = spec.res[best];
        ps[kind] = { key: best, badge: r.badge, at: Date.now(), ymd: todayYmd() };
        resHtml = '<div class="v20-res-box">' +
          '<div class="v20-res-big">' + esc(r.badge) + '</div>' +
          '<p>' + esc(r.d) + '</p>' +
          '</div>';
      } else if (kind === 'mind') {
        var total = 0;
        answers.forEach(function (o) { total += (o.s || 0); });
        var ico = total >= 80 ? '☀️' : (total >= 55 ? '⛅' : '🌧️');
        var msg = total >= 80
          ? '마음 컨디션이 최상이에요! 오늘 가족들에게도 좋은 에너지를 나눠주세요.'
          : (total >= 55 ? '무난하고 안정적인 하루예요. 따뜻한 차 한 잔과 함께 여유를 챙겨보세요.'
                         : '마음이 조금 지쳐 있어요. 오늘 하루는 무리하지 말고 가족에게 응원을 요청해 보세요!');
        ps.mind = { score: total, icon: ico, at: Date.now(), ymd: todayYmd() };
        resHtml = '<div class="v20-res-box">' +
          '<div class="v20-res-big">' + ico + ' ' + total + '점</div>' +
          '<p>' + esc(msg) + '</p>' +
          '</div>';
      }

      save();
      renderProfileBoard();
      $('v20MBody').innerHTML = resHtml +
        '<div style="text-align:center;font-size:12.5px;color:#0E9F6E;font-weight:700;margin:8px 0 12px">✅ 내 명함 프로필에 바로 반영되었어요!</div>' +
        '<button type="button" id="v20DoneBtn" class="v20-btn-primary">명함에서 확인하기</button>';
      $('v20DoneBtn').onclick = closeModal;
    }

    /* 저장된 진행 기록 확인 */
    try {
      var savedRaw = localStorage.getItem(progKey);
      if (savedRaw) {
        var sv = JSON.parse(savedRaw);
        if (sv && sv.step > 0 && sv.step < spec.qs.length && Array.isArray(sv.answers)) {
          $('v20MBody').innerHTML = '' +
            '<div class="v20-res-box" style="margin-bottom:12px">' +
              '<div style="font-size:15px;font-weight:800;color:#0369A1;margin-bottom:4px">📌 진행 중이던 검사가 있어요!</div>' +
              '<p style="margin:0">' + sv.step + ' / ' + spec.qs.length + '문항까지 답변이 저장되어 있습니다.</p>' +
            '</div>' +
            '<div style="display:flex;gap:8px">' +
              '<button type="button" id="v20Restart" class="v20-btn-edit" style="padding:11px">처음부터 다시</button>' +
              '<button type="button" id="v20Resume" class="v20-btn-primary" style="margin-top:0;flex:2">이어서 진행하기 →</button>' +
            '</div>';
          $('v20Resume').onclick = function () { step = sv.step; answers = sv.answers; paintQ(); };
          $('v20Restart').onclick = function () { clearProg(); step = 0; answers = []; paintQ(); };
          return;
        }
      }
    } catch (e) {}

    paintQ();
  }

  function mount(FAM) {
    if (ON) return;
    F = FAM;
    ON = true;
    applyDailyBg();
    renderProfileBoard();
  }

  setInterval(function () {
    if (!ON && global.FAM && global.FAM.doc && global.FAM.doc() && global.FAM.me && global.FAM.me()) {
      mount(global.FAM);
    }
  }, 1200);

  var prevRender = global.__FAM_RENDER;
  global.__FAM_RENDER = function () {
    if (prevRender) { try { prevRender(); } catch (e) {} }
    try { if (ON) renderProfileBoard(); } catch (e) {}
  };
  var prevView = global.__FAM_VIEW;
  global.__FAM_VIEW = function (v) {
    if (prevView) { try { prevView(v); } catch (e) {} }
    if (v === 'home' && ON) { try { renderProfileBoard(); } catch (e) {} }
  };
})(window);
