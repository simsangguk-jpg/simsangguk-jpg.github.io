/* ============================================================
   우리가족포털 V14 · 🏎️ 3D 미니카 조립 & 가족 대결 레이스 (minicar3d.js)
   - 실제 판매 차량 브랜드·차종 선택(람보르기니·페라리·포르쉐·아우디·테슬라·맥라렌)
     → 브랜드/차종마다 차체 실루엣(3D 메쉬)과 기본 성능이 다르다.
   - 실제 차량용 물품(타이어·휠/브레이크·공력·파워트레인·데칼/라이트)을
     장착하면 조립 미리보기(2D)와 트랙 위 3D 차량 외형이 즉시 바뀐다.
   - 혼자 타임어택 / 가족 1:1 대결 / 가족 그랑프리(4대 동시 주행)
     결승선에서 순위·격차를 보여 주고, 전적·최고 랩타임을 DOC.v9.minicar 에 저장.
   - 다른 가족의 조립 차량(DOC.v9.minicar)을 읽어 AI 로 함께 달린다.
     아직 조립하지 않은 가족은 '기본 세팅' 차량으로 상대가 된다.
   - WebGL/three.js 를 못 쓰는 환경에서는 2D 캔버스 트랙으로 그린다.
   - 저장: DOC.v9.minicar (가족 DB · 드라이브 백업 포함)
   - V14: 옛 부품 키(body/motor/tire=std… )는 자동으로 새 키로 바꿔 읽는다.
   ============================================================ */
(function (global) {
  'use strict';

  var F = null, ON = false, paneOn = false;
  var THREE_SRC = ['../three.min.js', 'https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js'];
  var threeSrcIdx = 0, threeLoading = false, threeQueue = [], threeFailed = false;
  var renderer = null, scene = null, camera = null, raf3 = 0, last3 = 0;
  var raf2 = 0, last2 = 0, ctx2d = null, c2d = null, roadCv = null, roadW = 0, roadH = 0;
  var trackG = null, curve3 = null;
  var curve = null, trackLen = 0, SEG = 260, HW = 0.85;
  var mode = 'none';                /* '3d' | '2d' | 'none' */
  var lastHud = 0, hudTxt = '';
  var cfg = null;
  var race = null;                  /* 진행 중/직전 경기 */
  var setup = { mode: 'solo', rival: '', laps: 1 };   /* 경기 설정 */
  var carGroups = [];

  /* ---------------- 도구 ---------------- */
  function $(id) { return document.getElementById(id); }
  function d() { return F && F.doc(); }
  function me() { return F && F.me(); }
  function save() { if (F) F.save(); }
  function toast(m) { if (F) F.toast(m); }
  function now() { return Date.now(); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function mid() { return me() ? me().id : ''; }
  function len2(x, z) { var l = Math.sqrt(x * x + z * z); return l || 1; }
  function fmtMs(ms) {
    if (!ms) return '–';
    var m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), x = Math.floor((ms % 1000) / 10);
    return m + ':' + (s < 10 ? '0' : '') + s + '.' + (x < 10 ? '0' : '') + x;
  }
  function nameOf(id) {
    if (id === mid()) return (me() && me().name) || '나';
    try { var m = F.memOf(id); return (m && m.name) || '가족'; } catch (e) { return '가족'; }
  }
  function emojiOf(id) {
    try {
      var ms = F.members ? F.members() : [];
      for (var i = 0; i < ms.length; i++) if (ms[i].id === id) return ms[i].emoji || '🧑';
    } catch (e) {}
    return '🧑';
  }

  function V9() {
    var D = d();
    if (!D) return null;
    if (!D.v9 || typeof D.v9 !== 'object') D.v9 = {};
    var v = D.v9;
    ['tama', 'room', 'guest', 'minicar', 'moneyD', 'ddays', 'school', 'goals', 'sleep', 'layout', 'editLog', 'pod', 'archive', 'commute', 'schoolMode'].forEach(function (k) {
      if (!v[k] || typeof v[k] !== 'object') v[k] = {};
    });
    return v;
  }
  function recOf(id, force) {
    var v = V9();
    var uid = id || mid();
    if (!v || !uid) return null;
    var r = v.minicar[uid];
    if (!r && force) r = v.minicar[uid] = { cfg: defaultCfg(), best: 0, laps: 0, wins: 0, races: 0, at: now() };
    if (r && !r.cfg) r.cfg = defaultCfg();
    if (r) r.cfg = normCfg(r.cfg);
    return r;
  }

  /* ---------------- 실차 카탈로그 ---------------- */
  /* 차체 실루엣 파라미터: z=차 길이(뒤 -0.5 ~ 앞 +0.5), y=높이.
     nose(앞코) hood(보닛) roof(지붕) deck(뒷데크) tail(뒷끝) — 브랜드마다 다르다. */
  var BRANDS = {
    lambo: { n: '람보르기니', em: '🐂', color: '#C6D92B', note: '쐐기형 미드십' },
    ferrari: { n: '페라리', em: '🐎', color: '#E5484D', note: '유선형 슈퍼카' },
    porsche: { n: '포르쉐', em: '🛡️', color: '#F5F7F8', note: '둥근 뒷모습 911' },
    audi: { n: '아우디', em: '🔗', color: '#7C8794', note: '각진 미드십' },
    tesla: { n: '테슬라', em: '⚡', color: '#2B3138', note: '매끈한 전기차' },
    mclaren: { n: '맥라렌', em: '🟠', color: '#FF7A1A', note: '눈물방울형' }
  };
  var MODELS = {
    revuelto: { n: '레부엘토', brand: 'lambo', len: 0.96, wid: 0.47, nose: 0.095, hood: 0.155, roof: 0.310, roofA: 0.03, roofB: -0.17, deck: 0.210, tail: 0.222, wr: 0.082, base: { top: 352, acc: 3.6, grip: 1.00, stab: 0.95 } },
    aventador: { n: '아벤타도르 SVJ', brand: 'lambo', len: 0.95, wid: 0.48, nose: 0.100, hood: 0.162, roof: 0.306, roofA: 0.00, roofB: -0.19, deck: 0.214, tail: 0.226, wr: 0.084, base: { top: 350, acc: 3.4, grip: 0.99, stab: 0.93 } },
    sf90: { n: 'SF90 스트라달레', brand: 'ferrari', len: 0.94, wid: 0.46, nose: 0.110, hood: 0.172, roof: 0.326, roofA: 0.05, roofB: -0.15, deck: 0.222, tail: 0.224, wr: 0.082, base: { top: 340, acc: 3.9, grip: 1.01, stab: 0.98 } },
    gtb296: { n: '296 GTB', brand: 'ferrari', len: 0.90, wid: 0.45, nose: 0.118, hood: 0.178, roof: 0.336, roofA: 0.04, roofB: -0.14, deck: 0.224, tail: 0.218, wr: 0.080, base: { top: 330, acc: 3.7, grip: 1.02, stab: 0.99 } },
    gt3rs: { n: '911 GT3 RS', brand: 'porsche', len: 0.92, wid: 0.47, nose: 0.132, hood: 0.182, roof: 0.348, roofA: -0.01, roofB: -0.23, deck: 0.250, tail: 0.244, wr: 0.083, base: { top: 296, acc: 3.5, grip: 1.08, stab: 1.08 } },
    taycan: { n: '타이칸 터보 S', brand: 'porsche', len: 0.95, wid: 0.47, nose: 0.120, hood: 0.188, roof: 0.352, roofA: 0.02, roofB: -0.21, deck: 0.244, tail: 0.235, wr: 0.082, base: { top: 260, acc: 3.9, grip: 1.03, stab: 1.03 } },
    r8: { n: 'R8 V10 퍼포먼스', brand: 'audi', len: 0.90, wid: 0.46, nose: 0.114, hood: 0.169, roof: 0.318, roofA: 0.03, roofB: -0.14, deck: 0.228, tail: 0.228, wr: 0.081, base: { top: 331, acc: 3.4, grip: 1.01, stab: 0.97 } },
    etrongt: { n: 'RS e-tron GT', brand: 'audi', len: 0.95, wid: 0.47, nose: 0.120, hood: 0.188, roof: 0.350, roofA: 0.03, roofB: -0.19, deck: 0.244, tail: 0.235, wr: 0.082, base: { top: 250, acc: 3.8, grip: 1.02, stab: 1.01 } },
    models: { n: '모델 S 플레이드', brand: 'tesla', len: 0.98, wid: 0.48, nose: 0.134, hood: 0.195, roof: 0.360, roofA: 0.01, roofB: -0.24, deck: 0.250, tail: 0.243, wr: 0.083, base: { top: 322, acc: 4.0, grip: 1.00, stab: 1.00 } },
    model3: { n: '모델 3 퍼포먼스', brand: 'tesla', len: 0.92, wid: 0.46, nose: 0.134, hood: 0.188, roof: 0.355, roofA: 0.00, roofB: -0.20, deck: 0.242, tail: 0.237, wr: 0.081, base: { top: 261, acc: 3.7, grip: 1.01, stab: 1.01 } },
    m720s: { n: '720S', brand: 'mclaren', len: 0.93, wid: 0.46, nose: 0.104, hood: 0.162, roof: 0.312, roofA: 0.05, roofB: -0.14, deck: 0.216, tail: 0.217, wr: 0.082, base: { top: 341, acc: 3.6, grip: 1.02, stab: 0.96 } },
    artura: { n: '아투라', brand: 'mclaren', len: 0.90, wid: 0.45, nose: 0.110, hood: 0.167, roof: 0.317, roofA: 0.05, roofB: -0.13, deck: 0.214, tail: 0.213, wr: 0.080, base: { top: 330, acc: 3.5, grip: 1.02, stab: 0.97 } }
  };
  var MODEL_BY_BRAND = {};
  Object.keys(MODELS).forEach(function (k) {
    var b = MODELS[k].brand;
    if (!MODEL_BY_BRAND[b]) MODEL_BY_BRAND[b] = [];
    MODEL_BY_BRAND[b].push(k);
  });

  var POWERS = {
    stock: { n: '순정 엔진', topX: 1.00, accX: 1.00 },
    v8: { n: '트윈터보 V8', topX: 1.10, accX: 1.08, gripX: 0.98 },
    ev: { n: '듀얼모터 EV', topX: 0.97, accX: 1.22, gripX: 1.02 },
    hybrid: { n: '에코 하이브리드', topX: 1.02, accX: 1.05, gripX: 1.00 }
  };
  var GEARS = {
    acc: { n: '가속형 기어', accX: 1.12, topX: 0.94 },
    bal: { n: '균형 기어', accX: 1.00, topX: 1.00 },
    top: { n: '최고속 기어', accX: 0.90, topX: 1.10 }
  };
  var TIRES = {
    stock: { n: '순정 타이어', gripX: 0.94, r: 0.000, ring: '', tread: 'street' },
    michelin: { n: '미쉐린 파일럿 스포츠 4S', gripX: 1.05, r: 0.005, ring: '#F5F7F8', tread: 'street' },
    pirelli: { n: '피렐리 P ZERO', gripX: 1.10, topX: 1.02, r: 0.006, ring: '#FFC24B', tread: 'race' },
    bridgestone: { n: '브리지스톤 올터레인', gripX: 0.86, r: 0.020, ring: '', tread: 'off' }
  };
  var BRAKES = {
    stock: { n: '순정 휠·브레이크', rim: '#BFC7CE', cal: '#8A9199', r: 0.000, spokes: 5, gripX: 1.00, stabX: 1.00 },
    brembo: { n: '브렘보 6P 레드', rim: '#2B3138', cal: '#E5484D', r: 0.008, spokes: 10, gripX: 1.03, stabX: 1.04 },
    carbon: { n: '카본 세라믹 골드', rim: '#D4AF37', cal: '#FFC24B', r: 0.014, spokes: 7, gripX: 1.05, stabX: 1.06 }
  };
  var AEROS = {
    stock: { n: '순정', topX: 1.00, accX: 1.00, stabX: 1.00, wing: 0, kit: 0 },
    gtwing: { n: '카본 GT 리어 윙', topX: 0.99, accX: 0.99, stabX: 1.10, wing: 1, kit: 0 },
    fullkit: { n: '에어로 풀 바디킷 + 디퓨저', topX: 1.02, accX: 0.97, stabX: 1.14, wing: 1, kit: 1 }
  };
  var DECOS = {
    stock: { n: '순정', stripes: 0, led: 0 },
    stripe: { n: '레이싱 스트라이프 데칼', stripes: 1, led: 0 },
    led: { n: '매트릭스 LED 헤드램프', stripes: 0, led: 1 },
    both: { n: '스트라이프 + 매트릭스 LED', stripes: 1, led: 1 }
  };
  var BATTS = {
    s: { n: '소형 배터리', nBoost: 2 },
    m: { n: '대용량 배터리', nBoost: 3 },
    l: { n: '레이싱 배터리', nBoost: 5 }
  };
  var COLORS = ['#E5484D', '#4C8DFF', '#0E9F6E', '#FFC24B', '#8B7CF6', '#F5F7F8', '#2B3138', '#C6D92B', '#FF7A1A', '#7C8794'];
  var PART_ROWS = [
    { k: 'tire', lb: '타이어', opts: [['stock', '순정'], ['michelin', '미쉐린 4S'], ['pirelli', 'P ZERO'], ['bridgestone', '올터레인']] },
    { k: 'brake', lb: '휠·브레이크', opts: [['stock', '순정'], ['brembo', '브렘보 6P'], ['carbon', '카본 골드']] },
    { k: 'aero', lb: '공력·외장', opts: [['stock', '순정'], ['gtwing', 'GT 윙'], ['fullkit', '풀 바디킷']] },
    { k: 'power', lb: '파워트레인', opts: [['stock', '순정'], ['v8', '트윈터보 V8'], ['ev', '듀얼모터 EV'], ['hybrid', '하이브리드']] },
    { k: 'deco', lb: '데칼·라이트', opts: [['stock', '순정'], ['stripe', '스트라이프'], ['led', 'LED'], ['both', '스트라이프+LED']] },
    { k: 'gear', lb: '기어비', opts: [['acc', '가속형'], ['bal', '균형'], ['top', '최고속형']] },
    { k: 'batt', lb: '부스트', opts: [['s', '2회'], ['m', '3회'], ['l', '5회']] }
  ];

  function defaultCfg() {
    return { brand: 'ferrari', model: 'sf90', color: '#E5484D', power: 'stock', gear: 'bal', tire: 'stock', brake: 'stock', aero: 'stock', deco: 'stock', batt: 's' };
  }
  /* 옛 저장 값(body/motor/tire=std…)을 새 부품 키로 바꾼다 — 자료 손실 없음 */
  function normCfg(c) {
    var o = defaultCfg();
    if (!c) return o;
    var brandMap = { sports: 'ferrari', off: 'audi', classic: 'porsche' };
    if (c.brand && BRANDS[c.brand]) o.brand = c.brand;
    else if (c.body && brandMap[c.body]) o.brand = brandMap[c.body];
    if (c.model && MODELS[c.model] && MODELS[c.model].brand === o.brand) o.model = c.model;
    else o.model = MODEL_BY_BRAND[o.brand][0];
    var powMap = { eco: 'hybrid', std: 'stock', turbo: 'v8' };
    if (c.power && POWERS[c.power]) o.power = c.power;
    else if (c.motor && powMap[c.motor]) o.power = powMap[c.motor];
    if (c.gear && GEARS[c.gear]) o.gear = c.gear;
    var tireMap = { std: 'stock', grip: 'michelin', off: 'bridgestone' };
    if (c.tire && TIRES[c.tire]) o.tire = c.tire;
    else if (c.tire && tireMap[c.tire]) o.tire = tireMap[c.tire];
    var aeroMap = { none: 'stock', spoiler: 'gtwing', roller: 'stock' };
    if (c.aero && AEROS[c.aero]) o.aero = c.aero;
    else if (c.aero && aeroMap[c.aero]) o.aero = aeroMap[c.aero];
    if (c.brake && BRAKES[c.brake]) o.brake = c.brake;
    if (c.deco && DECOS[c.deco]) o.deco = c.deco;
    if (c.batt && BATTS[c.batt]) o.batt = c.batt;
    if (typeof c.color === 'string' && /^#[0-9A-Fa-f]{3,8}$/.test(c.color)) o.color = c.color;
    return o;
  }
  function modelOf(c) { return MODELS[c && c.model] || MODELS.sf90; }
  function brandOf(c) { return BRANDS[(modelOf(c).brand)] || BRANDS.ferrari; }

  function stats(c) {
    var cc = c || defaultCfg();
    var m = modelOf(cc);
    var p = POWERS[cc.power] || POWERS.stock, g = GEARS[cc.gear] || GEARS.bal;
    var t = TIRES[cc.tire] || TIRES.stock, br = BRAKES[cc.brake] || BRAKES.stock;
    var a = AEROS[cc.aero] || AEROS.stock, dc = DECOS[cc.deco] || DECOS.stock, bt = BATTS[cc.batt] || BATTS.s;
    return {
      top: m.base.top * p.topX * g.topX * a.topX * (t.topX || 1),
      acc: m.base.acc * p.accX * g.accX * a.accX,
      grip: clamp(m.base.grip * t.gripX * br.gripX * (p.gripX || 1), 0.72, 1.32),
      stab: clamp(m.base.stab * br.stabX * a.stabX, 0.78, 1.32),
      boosts: bt.nBoost,
      model: m, brand: brandOf(cc), p: p, g: g, t: t, br: br, a: a, d: dc, bt: bt
    };
  }
  function partName(k, v) {
    var m = { tire: TIRES, brake: BRAKES, aero: AEROS, power: POWERS, deco: DECOS, gear: GEARS, batt: BATTS }[k];
    return (m && m[v] && m[v].n) || v;
  }

  /* ---------------- 트랙 (3D·2D 공용 곡선) ---------------- */
  var TRACK_PTS = [
    [-10, 0, -5], [-2, 0, -6.8], [6, 0, -6], [10.5, 0, -3],
    [10, 0, 0.5], [11, 1.1, 3.4], [7, 2.3, 5.6], [2.5, 2.55, 6.4],
    [-2, 1.5, 5.9], [-6, 0.2, 4.6], [-10.5, 0, 2.2], [-11.5, 0, -1.6], [-11, 0, -4.2]
  ];
  var RAMP_U0 = 0.40, RAMP_U1 = 0.455;
  var BBOX = (function () {
    var o = { minx: 1e9, maxx: -1e9, minz: 1e9, maxz: -1e9 };
    TRACK_PTS.forEach(function (p) {
      o.minx = Math.min(o.minx, p[0]); o.maxx = Math.max(o.maxx, p[0]);
      o.minz = Math.min(o.minz, p[2]); o.maxz = Math.max(o.maxz, p[2]);
    });
    return o;
  })();

  function makePath(pts, samples) {
    var P = pts.map(function (p) { return { x: p[0], y: p[1], z: p[2] }; });
    var N = P.length, S = samples || 1200, out = [], i;
    function cr(p0, p1, p2, p3, t) {
      var t2 = t * t, t3 = t2 * t;
      return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
    }
    for (i = 0; i < S; i++) {
      var f = i / S * N, k = Math.floor(f), t = f - k;
      var p0 = P[(k - 1 + N) % N], p1 = P[k % N], p2 = P[(k + 1) % N], p3 = P[(k + 2) % N];
      out.push({ x: cr(p0.x, p1.x, p2.x, p3.x, t), y: cr(p0.y, p1.y, p2.y, p3.y, t), z: cr(p0.z, p1.z, p2.z, p3.z, t) });
    }
    var cum = [0];
    for (i = 1; i <= S; i++) {
      var a = out[i - 1], b = out[i % S];
      cum.push(cum[i - 1] + Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y) + (b.z - a.z) * (b.z - a.z)));
    }
    var total = cum[S] || 1;
    function norm(u) { return ((u % 1) + 1) % 1; }
    function at(u) {
      var target = norm(u) * total, lo = 0, hi = S;
      while (lo < hi - 1) { var m = (lo + hi) >> 1; if (cum[m] <= target) lo = m; else hi = m; }
      var span = (cum[lo + 1] - cum[lo]) || 1, t = (target - cum[lo]) / span;
      var p = out[lo], q = out[(lo + 1) % S];
      return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, z: p.z + (q.z - p.z) * t };
    }
    return {
      getPointAt: at,
      getLength: function () { return total; },
      getTangentAt: function (u) {
        var e = 0.0008, a = at(u - e), b = at(u + e);
        var dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        return { x: dx / l, y: dy / l, z: dz / l };
      }
    };
  }
  curve = makePath(TRACK_PTS, 1200);
  trackLen = curve.getLength();
  function drv() { return (mode === '3d' && curve3) ? curve3 : curve; }
  function cu(u) { return ((u % 1) + 1) % 1; }
  function ptAt(u) { return drv().getPointAt(cu(u)); }
  function tanAt(u) { return drv().getTangentAt(cu(u)); }

  function buildTrack() {
    if (!scene || trackG) return;
    curve3 = new THREE.CatmullRomCurve3(TRACK_PTS.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); }), true, 'catmullrom', 0.5);
    var base = curve3, u, i;
    var pos = [], idx = [];
    for (i = 0; i <= SEG; i++) {
      u = i / SEG;
      var p = base.getPointAt(u), t = base.getTangentAt(u);
      var nx = -t.z, nz = t.x, nl = len2(nx, nz); nx /= nl; nz /= nl;
      pos.push(p.x + nx * HW, p.y + 0.02, p.z + nz * HW);
      pos.push(p.x - nx * HW, p.y + 0.02, p.z - nz * HW);
      if (i < SEG) { var a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    var nrm = new Float32Array(pos.length);
    for (var q = 1; q < nrm.length; q += 3) nrm[q] = 1;
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    trackG = new THREE.Group();
    trackG.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0x5A6470, side: THREE.DoubleSide })));
    /* 가드레일 */
    var railPos = [], railIdx = [], vi = 0, side, k2;
    for (k2 = 0; k2 < 2; k2++) {
      side = k2 === 0 ? 1 : -1;
      for (i = 0; i <= SEG; i++) {
        u = i / SEG;
        var p2 = base.getPointAt(u), t2 = base.getTangentAt(u);
        var nx2 = -t2.z, nz2 = t2.x, nl2 = len2(nx2, nz2); nx2 /= nl2; nz2 /= nl2;
        var rx = p2.x + side * nx2 * (HW + 0.06), rz = p2.z + side * nz2 * (HW + 0.06);
        railPos.push(rx, p2.y + 0.02, rz);
        railPos.push(rx, p2.y + 0.22, rz);
        if (i < SEG) { var b = vi; railIdx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
        vi += 2;
      }
    }
    var g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', new THREE.Float32BufferAttribute(railPos, 3));
    g2.setIndex(railIdx);
    g2.computeVertexNormals();
    trackG.add(new THREE.Mesh(g2, new THREE.MeshLambertMaterial({ color: 0xE5484D, side: THREE.DoubleSide })));
    /* 출발선(체커) */
    var p0 = base.getPointAt(0), t0 = base.getTangentAt(0);
    var chk = document.createElement('canvas'); chk.width = 64; chk.height = 8;
    var cx = chk.getContext('2d');
    for (var yy = 0; yy < 8; yy++) for (var xx = 0; xx < 64; xx++) {
      cx.fillStyle = ((xx >> 3) + (yy >> 2)) % 2 ? '#111' : '#fff';
      cx.fillRect(xx, yy, 1, 1);
    }
    var line = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2, 0.7), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(chk) }));
    line.rotation.x = -Math.PI / 2;
    line.rotation.z = -Math.atan2(t0.z, t0.x);
    line.position.set(p0.x, p0.y + 0.03, p0.z);
    trackG.add(line);
    /* 잔디 + 나무 */
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(70, 50), new THREE.MeshLambertMaterial({ color: 0x9CCB86 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    trackG.add(ground);
    for (var tr = 0; tr < 14; tr++) {
      var ang = tr / 14 * Math.PI * 2;
      var tx = Math.cos(ang) * 26, tz = Math.sin(ang) * 17;
      var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 1.1, 6), new THREE.MeshLambertMaterial({ color: 0x8A6242 }));
      trunk.position.set(tx, 0.55, tz); trackG.add(trunk);
      var crown = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.7, 8), new THREE.MeshLambertMaterial({ color: 0x3FA96B }));
      crown.position.set(tx, 1.9, tz); trackG.add(crown);
    }
    scene.add(trackG);
  }

  /* ---------------- 3D 차 만들기 (브랜드 실루엣 + 실차 파츠) ---------------- */
  function profilePts(m) {
    var L = m.len / 2;
    return [
      [-L, 0.048],
      [-L, m.tail],
      [-L * 0.86, m.deck],
      [m.roofB, m.deck],
      [m.roofB + 0.055, m.roof],
      [m.roofA, m.roof],
      [m.roofA + 0.075, m.hood],
      [L * 0.58, m.hood * 0.93],
      [L * 0.90, m.nose],
      [L, m.nose * 0.86],
      [L, 0.046]
    ];
  }
  function carLabel(text, accent) {
    var cv = document.createElement('canvas'); cv.width = 320; cv.height = 80;
    var x = cv.getContext('2d');
    x.fillStyle = 'rgba(18,24,30,.80)';
    x.beginPath();
    if (x.roundRect) x.roundRect(4, 6, 312, 66, 18); else x.rect(4, 6, 312, 66);
    x.fill();
    x.fillStyle = accent || '#7CDFB0';
    x.fillRect(4, 66, 312, 6);
    x.fillStyle = '#fff';
    x.font = 'bold 34px -apple-system,system-ui,sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(String(text || '').slice(0, 14), 160, 40);
    var tex = new THREE.CanvasTexture(cv);
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sp.scale.set(1.05, 0.26, 1);
    return sp;
  }
  function brandPlate(text, color) {
    var cv = document.createElement('canvas'); cv.width = 128; cv.height = 32;
    var x = cv.getContext('2d');
    x.clearRect(0, 0, 128, 32);
    x.fillStyle = color || '#fff';
    x.font = 'bold 20px -apple-system,system-ui,sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(String(text || '').slice(0, 10), 64, 17);
    var tex = new THREE.CanvasTexture(cv);
    return new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  }

  function buildCar(c) {
    var st = stats(c);
    var m = st.model, br = st.brand;
    var g = new THREE.Group();
    var col = c.color || br.color;
    var W = m.wid, L = m.len;
    var bodyMat = new THREE.MeshLambertMaterial({ color: col, side: THREE.DoubleSide });
    var darkMat = new THREE.MeshLambertMaterial({ color: 0x22262B });
    var trimMat = new THREE.MeshLambertMaterial({ color: 0x2B3138 });

    /* --- 실루엣(옆모습) 압출 --- */
    var pts = profilePts(m);
    var shape = new THREE.Shape();
    shape.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
    shape.closePath();
    var geo = new THREE.ExtrudeGeometry(shape, { depth: W, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, steps: 1 });
    geo.translate(0, 0, -W / 2);
    geo.rotateY(-Math.PI / 2);          /* 길이축을 z로 → 앞이 +z */
    var body = new THREE.Mesh(geo, bodyMat);
    body.position.y = 0.03;
    g.add(body);

    /* --- 사이드 미러 · 락커 패널 · 범퍼 (자동차로 읽히게 하는 디테일) --- */
    [-1, 1].forEach(function (sx) {
      var arm = new THREE.Mesh(new THREE.BoxGeometry(W * 0.07, 0.014, 0.02), trimMat);
      arm.position.set(sx * (W / 2 + 0.015), m.hood + 0.015, m.roofA + 0.05);
      g.add(arm);
      var mir = new THREE.Mesh(new THREE.BoxGeometry(W * 0.085, 0.032, 0.045), bodyMat);
      mir.position.set(sx * (W / 2 + 0.045), m.hood + 0.018, m.roofA + 0.05);
      g.add(mir);
    });
    var rocker = new THREE.Mesh(new THREE.BoxGeometry(W * 0.94, 0.03, m.len * 0.46), trimMat);
    rocker.position.set(0, 0.055, 0.01);
    g.add(rocker);
    var bumper = new THREE.Mesh(new THREE.BoxGeometry(W * 0.92, 0.055, 0.07), trimMat);
    bumper.position.set(0, m.tail - 0.10, -m.len * 0.5 - 0.005);
    g.add(bumper);
    var lip = new THREE.Mesh(new THREE.BoxGeometry(W * 0.96, 0.022, 0.09), trimMat);
    lip.position.set(0, 0.062, m.len * 0.47);
    g.add(lip);

    /* --- 유리창: 지붕 아래를 살짝 넓게 감싸 옆에서도 창이 보이게 --- */
    var glass = new THREE.Mesh(new THREE.BoxGeometry(W * 1.004, 0.085, Math.abs(m.roofB - m.roofA) * 0.86), new THREE.MeshLambertMaterial({ color: 0x9FD4EA, transparent: true, opacity: 0.92 }));
    glass.position.set(0, m.roof - 0.048, ((m.roofA + m.roofB) / 2) * 0.92);
    g.add(glass);

    /* --- 휠 (타이어·림·캘리퍼 색이 그대로 보인다) --- */
    var t = st.t, bk = st.br;
    var wr = m.wr + t.r + bk.r;
    var wheels = [], calipers = [];
    var wx = W / 2 - 0.012;
    var wz = m.len * 0.31;
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(function (p) {
      var wg = new THREE.CylinderGeometry(wr, wr, W * 0.17, 18);
      wg.rotateZ(Math.PI / 2);
      var tireMat = new THREE.MeshLambertMaterial({ color: t.tread === 'off' ? 0x15181B : 0x22262B });
      var wh = new THREE.Mesh(wg, tireMat);
      wh.position.set(p[0] * wx, wr, p[1] * wz);
      g.add(wh); wheels.push(wh);
      /* 타이어 옆면 링(미쉐린=흰색, 피렐리=노랑) */
      if (t.ring) {
        var ring = new THREE.Mesh(new THREE.TorusGeometry(wr * 0.82, wr * 0.055, 6, 20), new THREE.MeshLambertMaterial({ color: t.ring }));
        ring.rotation.y = Math.PI / 2;
        ring.position.set(p[0] * (wx + W * 0.086), wr, p[1] * wz);
        g.add(ring);
      }
      if (t.tread === 'off') {
        for (var b2 = 0; b2 < 10; b2++) {
          var a2 = b2 / 10 * Math.PI * 2;
          var kn = new THREE.Mesh(new THREE.BoxGeometry(W * 0.19, 0.022, 0.03), tireMat);
          kn.position.set(p[0] * wx, wr + Math.sin(a2) * wr * 0.98, p[1] * wz + Math.cos(a2) * wr * 0.98);
          kn.rotation.x = a2;
          g.add(kn);
        }
      }
      /* 림 */
      var rim = new THREE.Mesh(new THREE.CylinderGeometry(wr * 0.55, wr * 0.55, W * 0.19, 14), new THREE.MeshLambertMaterial({ color: bk.rim }));
      rim.rotation.z = Math.PI / 2;
      rim.position.set(p[0] * wx, wr, p[1] * wz);
      g.add(rim);
      for (var sp = 0; sp < bk.spokes; sp++) {
        var a3 = sp / bk.spokes * Math.PI * 2;
        var spoke = new THREE.Mesh(new THREE.BoxGeometry(W * 0.20, wr * 0.9, 0.016), new THREE.MeshLambertMaterial({ color: bk.rim }));
        spoke.position.set(p[0] * wx, wr, p[1] * wz);
        spoke.rotation.x = a3;
        g.add(spoke);
      }
      /* 캘리퍼(색으로 구분) — 휠 바깥쪽에 붙여 옆에서도 보이게 */
      var cal = new THREE.Mesh(new THREE.BoxGeometry(W * 0.05, wr * 0.36, 0.05), new THREE.MeshLambertMaterial({ color: bk.cal }));
      cal.position.set(p[0] * (wx + W * 0.10), wr * 0.95, p[1] * wz + (p[1] > 0 ? -0.055 : 0.055));
      g.add(cal); calipers.push(cal);
    });

    /* --- 브레이크/휠 업그레이드 표시: 브렘보는 캘리퍼가 크게, 카본은 금색 림 --- */
    /* --- 공력 파츠 --- */
    if (st.a.wing) {
      var wingH = m.deck + (c.aero === 'fullkit' ? 0.10 : 0.14);
      var wing = new THREE.Mesh(new THREE.BoxGeometry(W * (c.aero === 'fullkit' ? 0.98 : 0.88), 0.022, 0.13), trimMat);
      wing.position.set(0, wingH, -m.len * 0.44);
      g.add(wing);
      [-1, 1].forEach(function (sx) {
        var strut = new THREE.Mesh(new THREE.BoxGeometry(0.024, wingH - m.deck, 0.03), trimMat);
        strut.position.set(sx * W * 0.32, (wingH + m.deck) / 2, -m.len * 0.44);
        g.add(strut);
      });
      g.userData.wing = wing;
    }
    if (st.a.kit) {
      /* 앞 스플리터 */
      var spl = new THREE.Mesh(new THREE.BoxGeometry(W * 1.02, 0.02, 0.16), trimMat);
      spl.position.set(0, 0.055, m.len * 0.44);
      g.add(spl);
      /* 사이드 스커트 */
      [-1, 1].forEach(function (sx) {
        var sk = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, m.len * 0.5), trimMat);
        sk.position.set(sx * W * 0.5, 0.075, 0);
        g.add(sk);
      });
      /* 리어 디퓨저 핀 */
      for (var f = -2; f <= 2; f++) {
        var fin = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.075, 0.12), trimMat);
        fin.position.set(f * 0.07, 0.085, -m.len * 0.46);
        g.add(fin);
      }
    }
    /* --- 데칼: 레이싱 스트라이프 --- */
    if (st.d.stripes) {
      var stripeMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
      [-0.05, 0.05].forEach(function (sx) {
        var s1 = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.006, m.len * 0.26), stripeMat);
        s1.position.set(sx, m.hood + 0.006, m.len * 0.30);
        g.add(s1);
        var s2 = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.006, Math.abs(m.roofA - m.roofB) * 0.9), stripeMat);
        s2.position.set(sx, m.roof + 0.006, (m.roofA + m.roofB) / 2);
        g.add(s2);
        var s3 = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.006, m.len * 0.16), stripeMat);
        s3.position.set(sx, m.deck + 0.006, -m.len * 0.34);
        g.add(s3);
      });
    }
    /* --- 라이트 --- */
    var led = !!st.d.led;
    var lMat = new THREE.MeshBasicMaterial({ color: led ? 0xEAF8FF : 0xFFF1C9 });
    [-1, 1].forEach(function (sx) {
      var lampY = clamp(m.nose * 0.72, 0.05, 0.16);
      var lamp = new THREE.Mesh(new THREE.BoxGeometry(W * 0.20, 0.028, 0.03), lMat);
      lamp.position.set(sx * W * 0.30, lampY, m.len * 0.5 + 0.006);
      g.add(lamp);
      if (led) {
        var glow = new THREE.Mesh(new THREE.BoxGeometry(W * 0.21, 0.045, 0.008), new THREE.MeshBasicMaterial({ color: 0x9BE8FF, transparent: true, opacity: 0.55 }));
        glow.position.set(sx * W * 0.30, lampY, m.len * 0.5 + 0.02);
        g.add(glow);
      }
    });
    /* 테일램프 */
    [-1, 1].forEach(function (sx) {
      var tl = new THREE.Mesh(new THREE.BoxGeometry(W * 0.24, 0.028, 0.025), new THREE.MeshBasicMaterial({ color: 0xE5484D }));
      tl.position.set(sx * W * 0.28, m.tail - 0.045, -m.len * 0.5 - 0.006);
      g.add(tl);
    });
    /* --- 파워트레인: 배기/언더글로우 --- */
    var flames = [];
    if (c.power === 'ev') {
      var ug = new THREE.Mesh(new THREE.BoxGeometry(W * 0.9, 0.012, m.len * 0.7), new THREE.MeshBasicMaterial({ color: 0x63B8FF, transparent: true, opacity: 0.55 }));
      ug.position.set(0, 0.055, 0);
      g.add(ug);
      g.userData.underGlow = ug;
    } else {
      var pipes = c.power === 'v8' ? 4 : 2;
      for (var pp = 0; pp < pipes; pp++) {
        var px = (pp - (pipes - 1) / 2) * 0.075;
        var pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.05, 8), new THREE.MeshLambertMaterial({ color: 0xB9C2CA }));
        pipe.rotation.x = Math.PI / 2;
        pipe.position.set(px, 0.085, -m.len * 0.5 - 0.02);
        g.add(pipe);
        var fl = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.13, 8), new THREE.MeshBasicMaterial({ color: c.power === 'v8' ? 0xFF8A3D : 0xFFC24B, transparent: true, opacity: 0.9 }));
        fl.rotation.x = -Math.PI / 2;
        fl.position.set(px, 0.085, -m.len * 0.5 - 0.10);
        fl.scale.set(0.001, 0.001, 0.001);
        g.add(fl); flames.push(fl);
      }
    }
    g.userData.flames = flames;
    /* --- 브랜드 엠블럼 텍스트 --- */
    var plate = brandPlate(br.n, '#FFFFFF');
    [-1, 1].forEach(function (sx) {
      var pl = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.055), plate);
      pl.position.set(sx * (W / 2 + 0.004), (m.deck + m.hood) / 2 + 0.02, m.len * 0.06);
      pl.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
      g.add(pl);
    });
    g.userData.wheels = wheels;
    g.userData.cfgKey = JSON.stringify(c);
    return g;
  }

  /* ---------------- three.js 로드 ---------------- */
  function hasWebGL() {
    try {
      if (!global.WebGLRenderingContext) return false;
      var c = document.createElement('canvas');
      return !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
    } catch (e) { return false; }
  }
  function flushThree(err) {
    var q = threeQueue; threeQueue = [];
    q.forEach(function (fn) { try { fn(err); } catch (e) { console.warn('minicar3d cb', e); } });
  }
  function tryNextThree() {
    if (threeSrcIdx >= THREE_SRC.length) {
      threeLoading = false; threeFailed = true;
      flushThree(new Error('three.load'));
      return;
    }
    var src = THREE_SRC[threeSrcIdx++];
    threeLoading = true;
    var s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = function () {
      threeLoading = false;
      if (global.THREE && global.THREE.WebGLRenderer) flushThree(null);
      else tryNextThree();
    };
    s.onerror = function () { threeLoading = false; tryNextThree(); };
    document.head.appendChild(s);
  }
  function loadThree(cb) {
    if (global.THREE && global.THREE.WebGLRenderer) { cb(null); return; }
    threeQueue.push(cb);
    if (threeLoading) return;
    if (threeFailed) { threeFailed = false; threeSrcIdx = 0; }
    tryNextThree();
  }

  /* ---------------- 3D 초기화 ---------------- */
  function dispose3D() {
    try { if (renderer && renderer.dispose) renderer.dispose(); } catch (e) {}
    try {
      if (renderer && renderer.domElement && renderer.domElement.parentNode && renderer.domElement !== $('mcCanvas')) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    } catch (e) {}
    renderer = null; scene = null; camera = null;
    trackG = null; curve3 = null; carGroups = [];
  }
  function init3D() {
    var cv = $('mcCanvas');
    if (!cv || !global.THREE || !global.THREE.WebGLRenderer) return false;
    if (renderer) {
      if (renderer.domElement === cv) { resize3D(); return true; }
      dispose3D();
    }
    try {
      renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
      renderer.setPixelRatio(Math.min(2, global.devicePixelRatio || 1));
      renderer.setClearColor(0xCDE8FF);
      scene = new THREE.Scene();
      scene.add(new THREE.AmbientLight(0xFFFFFF, 0.95));
      var dir = new THREE.DirectionalLight(0xFFF6E4, 0.55);
      dir.position.set(8, 14, 6);
      scene.add(dir);
      camera = new THREE.PerspectiveCamera(55, 2, 0.1, 200);
      camera.position.set(0, 3.8, -7);
      buildTrack();
      resize3D();
      return true;
    } catch (e) {
      console.warn('minicar3d init', e);
      dispose3D();
      return false;
    }
  }
  function resize3D() {
    if (!renderer) return;
    var box = $('mcCanvasWrap');
    if (!box) return;
    var w = box.clientWidth || box.offsetWidth || 320;
    var h = box.clientHeight || box.offsetHeight || 240;
    if (w < 40) w = 320;
    if (h < 40) h = 240;
    renderer.setSize(w, h, false);
    if (camera) { camera.aspect = w / h; camera.updateProjectionMatrix(); }
  }
  function clearCarGroups() {
    carGroups.forEach(function (g) { try { scene.remove(g); } catch (e) {} });
    carGroups = [];
  }
  function ensureGroups() {
    if (!scene || !race) return;
    clearCarGroups();
    race.cars.forEach(function (car) {
      var g = buildCar(car.cfg);
      var label = carLabel(car.name + ' · ' + MODELS[car.cfg.model].n.split(' ')[0], car.isMe ? '#7CDFB0' : '#FFD37A');
      label.position.set(0, 0.44, 0);
      label.scale.set(0.72, 0.18, 1);
      g.add(label);
      car.group = g;
      carGroups.push(g);
      scene.add(g);
      placeGroup(car);
    });
  }
  function placeGroup(car) {
    if (!car || !car.group) return;
    var u = cu(car.u);
    var p = ptAt(u), t = tanAt(u);
    var nx = -t.z, nz = t.x, nl = len2(nx, nz); nx /= nl; nz /= nl;
    var y = car.air ? car.y : p.y;
    car.group.position.set(p.x + nx * car.lane * 0.5, y + 0.02 + car.shake * Math.sin(now() * 0.06) * 0.02, p.z + nz * car.lane * 0.5);
    car.group.rotation.y = Math.atan2(t.x, t.z) + car.lane * 0.30 + car.shake * Math.sin(now() * 0.05) * 0.04;
    car.group.rotation.x = car.air ? clamp(-car.vy * 0.15, -0.5, 0.5) : 0;
    var wl = car.group.userData.wheels;
    if (wl) { var spin = car.s * 4 * 0.016; for (var i = 0; i < wl.length; i++) wl[i].rotation.x += spin; }
    var flames = car.group.userData.flames || [];
    var on = car.boostT > 0;
    flames.forEach(function (f) {
      var sc = on ? (0.8 + Math.random() * 0.6) : 0.001;
      f.scale.set(sc, sc, sc);
    });
  }

  /* ---------------- 2D 폴백 ---------------- */
  function proj2D(p, w, h) {
    var pad = Math.max(14, Math.min(w, h) * 0.10);
    var sx = (w - pad * 2) / Math.max(0.001, BBOX.maxx - BBOX.minx);
    var sz = (h - pad * 2) / Math.max(0.001, BBOX.maxz - BBOX.minz);
    var s = Math.min(sx, sz);
    var cx = (BBOX.minx + BBOX.maxx) / 2, cz = (BBOX.minz + BBOX.maxz) / 2;
    return { x: w / 2 + (p.x - cx) * s, y: h / 2 + (p.z - cz) * s, s: s };
  }
  function showLayer(which) {
    var a = $('mcCanvas'), b = $('mcCanvas2D');
    if (a) a.classList.toggle('hidden', which === '2d');
    if (b) b.classList.toggle('hidden', which !== '2d');
  }
  function bind2D() {
    var cv = $('mcCanvas2D');
    if (!cv) return false;
    var wrap = $('mcCanvasWrap');
    var w = (wrap && wrap.clientWidth) || 320, h = (wrap && wrap.clientHeight) || 240;
    if (w < 40) w = 320;
    if (h < 40) h = 240;
    var dpr = Math.min(2, global.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    ctx2d = cv.getContext('2d');
    if (!ctx2d) return false;
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    c2d = { w: w, h: h, dpr: dpr };
    roadCv = null; roadW = 0; roadH = 0;
    return true;
  }
  function strokePts(x, pts) {
    x.beginPath();
    x.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) x.lineTo(pts[i].x, pts[i].y);
    x.closePath();
    x.stroke();
  }
  function buildRoad2D() {
    var w = c2d.w, h = c2d.h, dpr = c2d.dpr;
    roadCv = document.createElement('canvas');
    roadCv.width = Math.round(w * dpr);
    roadCv.height = Math.round(h * dpr);
    var x = roadCv.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    roadW = w; roadH = h;
    var gd = x.createLinearGradient(0, 0, 0, h);
    gd.addColorStop(0, '#A7D492');
    gd.addColorStop(1, '#8FC181');
    x.fillStyle = gd;
    x.fillRect(0, 0, w, h);
    for (var t = 0; t < 16; t++) {
      var ang = t / 16 * Math.PI * 2;
      var q = proj2D({ x: Math.cos(ang) * 15.5, z: Math.sin(ang) * 10.5 }, w, h);
      x.fillStyle = '#3FA96B';
      x.beginPath(); x.arc(q.x, q.y, Math.max(3, q.s * 0.45), 0, Math.PI * 2); x.fill();
    }
    var pts = [], i;
    for (i = 0; i <= 240; i++) pts.push(proj2D(curve.getPointAt(i / 240), w, h));
    var s = pts[0].s;
    x.lineJoin = 'round'; x.lineCap = 'round';
    x.strokeStyle = 'rgba(20,28,36,.20)';
    x.lineWidth = HW * 2.5 * s; strokePts(x, pts);
    x.strokeStyle = '#3E4650';
    x.lineWidth = HW * 2.1 * s; strokePts(x, pts);
    x.strokeStyle = '#586470';
    x.lineWidth = HW * 1.85 * s; strokePts(x, pts);
    x.setLineDash([Math.max(4, s * 0.35), Math.max(5, s * 0.45)]);
    x.strokeStyle = 'rgba(255,255,255,.5)';
    x.lineWidth = Math.max(1.5, s * 0.07); strokePts(x, pts);
    x.setLineDash([]);
    var p0 = curve.getPointAt(0), t0 = curve.getTangentAt(0);
    var q0 = proj2D(p0, w, h);
    var ang0 = Math.atan2(t0.z, t0.x);
    x.save();
    x.translate(q0.x, q0.y); x.rotate(ang0);
    var seg = Math.max(3, HW * 2 * s / 8);
    for (var r = 0; r < 2; r++) for (var c = 0; c < 8; c++) {
      x.fillStyle = ((r + c) % 2) ? '#111' : '#fff';
      x.fillRect(-seg * 0.5, -HW * s + c * seg, seg, seg);
    }
    x.restore();
  }
  function draw2DCar(car, w, h) {
    var u = cu(car.u);
    var p = curve.getPointAt(u), t = curve.getTangentAt(u);
    var nx = -t.z, nz = t.x, nl = len2(nx, nz); nx /= nl; nz /= nl;
    var q = proj2D({ x: p.x + nx * car.lane * 0.5, z: p.z + nz * car.lane * 0.5 }, w, h);
    var ang = Math.atan2(t.z, t.x);
    var L = Math.max(13, 1.15 * q.s), Wd = Math.max(8, 0.66 * q.s);
    var cfgc = car.cfg, stc = car.st;
    ctx2d.save();
    ctx2d.translate(q.x, q.y);
    ctx2d.rotate(ang);
    if (car.air) ctx2d.translate(0, -Math.max(2, q.s * 0.25));
    ctx2d.fillStyle = 'rgba(20,30,40,.18)';
    ctx2d.beginPath();
    ctx2d.ellipse(0, Wd * 0.15, L * 0.55, Wd * 0.42, 0, 0, Math.PI * 2);
    ctx2d.fill();
    /* 타이어 */
    var tire = stc.t || TIRES.stock;
    ctx2d.fillStyle = tire.tread === 'off' ? '#15181B' : '#22262B';
    var tw = Math.max(3, Wd * 0.3), tl = Math.max(5, L * 0.22);
    [[-L * 0.30, -Wd * 0.52], [L * 0.26, -Wd * 0.52], [-L * 0.30, Wd * 0.52], [L * 0.26, Wd * 0.52]].forEach(function (o) {
      ctx2d.fillRect(o[0] - tl / 2, o[1] - tw / 2, tl, tw);
    });
    /* 차체 */
    ctx2d.fillStyle = cfgc.color || '#E5484D';
    rrect(ctx2d, -L / 2, -Wd / 2, L, Wd, Wd * 0.34);
    ctx2d.fill();
    /* 데칼 줄무늬(위에서 본 결) */
    if (stc.d.stripes) {
      ctx2d.fillStyle = 'rgba(255,255,255,.85)';
      ctx2d.fillRect(-L * 0.46, -Wd * 0.10, L * 0.92, Wd * 0.06);
      ctx2d.fillRect(-L * 0.46, Wd * 0.04, L * 0.92, Wd * 0.06);
    }
    ctx2d.fillStyle = 'rgba(255,255,255,.22)';
    rrect(ctx2d, -L * 0.42, -Wd * 0.42, L * 0.8, Wd * 0.3, Wd * 0.2);
    ctx2d.fill();
    /* 앞유리 */
    ctx2d.fillStyle = 'rgba(28,42,56,.55)';
    rrect(ctx2d, L * 0.02, -Wd * 0.34, L * 0.24, Wd * 0.68, Wd * 0.16);
    ctx2d.fill();
    /* 리어 윙 */
    if (stc.a.wing) {
      ctx2d.fillStyle = '#2B3138';
      ctx2d.fillRect(-L / 2 - Math.max(2, L * 0.06), -Wd * 0.62, Math.max(3, L * 0.1), Wd * 1.24);
    }
    /* 바디킷 스커트 */
    if (stc.a.kit) {
      ctx2d.fillStyle = 'rgba(43,49,56,.9)';
      ctx2d.fillRect(-L * 0.44, -Wd * 0.58, L * 0.88, Wd * 0.1);
      ctx2d.fillRect(-L * 0.44, Wd * 0.48, L * 0.88, Wd * 0.1);
    }
    /* 헤드램프 */
    ctx2d.fillStyle = stc.d.led ? '#D9F6FF' : '#FFF1C9';
    ctx2d.fillRect(L * 0.40, -Wd * 0.34, L * 0.08, Wd * 0.22);
    ctx2d.fillRect(L * 0.40, Wd * 0.12, L * 0.08, Wd * 0.22);
    if (car.isMe) {
      ctx2d.strokeStyle = 'rgba(255,255,255,.9)';
      ctx2d.lineWidth = 1.4;
      rrect(ctx2d, -L / 2, -Wd / 2, L, Wd, Wd * 0.34);
      ctx2d.stroke();
    } else {
      ctx2d.font = 'bold ' + Math.max(8, Wd * 0.42) + 'px -apple-system,system-ui,sans-serif';
      ctx2d.fillStyle = 'rgba(18,24,30,.85)';
      ctx2d.textAlign = 'center';
      ctx2d.fillText(car.name, 0, -Wd * 0.78);
    }
    ctx2d.restore();
  }
  function draw2D() {
    if (!ctx2d || !cfg) return;
    if (!roadCv || roadW !== c2d.w || roadH !== c2d.h) buildRoad2D();
    var w = c2d.w, h = c2d.h;
    ctx2d.clearRect(0, 0, w, h);
    if (roadCv) ctx2d.drawImage(roadCv, 0, 0, w, h);
    if (race && race.cars && race.cars.length) {
      /* 다른 차 먼저, 내 차는 맨 위 */
      race.cars.slice().sort(function (a, b) { return (a.isMe ? 1 : 0) - (b.isMe ? 1 : 0); }).forEach(function (car) {
        draw2DCar(car, w, h);
      });
    } else if (cfg) {
      draw2DCar({ u: 0, lane: 0, cfg: cfg, st: stats(cfg), isMe: true, air: false }, w, h);
    }
    if (mode !== '3d') setModeLabel('2d');
  }
  function rrect(x, a, b, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    x.beginPath();
    x.moveTo(a + r, b);
    x.lineTo(a + w - r, b); x.quadraticCurveTo(a + w, b, a + w, b + r);
    x.lineTo(a + w, b + h - r); x.quadraticCurveTo(a + w, b + h, a + w - r, b + h);
    x.lineTo(a + r, b + h); x.quadraticCurveTo(a, b + h, a, b + h - r);
    x.lineTo(a, b + r); x.quadraticCurveTo(a, b, a + r, b);
    x.closePath();
  }
  function loop2D(ts) {
    raf2 = requestAnimationFrame(loop2D);
    var cv = $('mcCanvas2D');
    if (!cv || !paneOn) { stop2D(); return; }
    if (!ctx2d || cv.getContext('2d') !== ctx2d || !c2d) { if (!bind2D()) return; }
    var dt = Math.min(0.05, (ts - (last2 || ts)) / 1000);
    last2 = ts;
    tick(dt);
    draw2D();
    raceHud();
  }
  function start2D() {
    showLayer('2d');
    if (!bind2D()) return;
    mode = '2d';
    setModeLabel('2d');
    if (!raf2) { last2 = 0; raf2 = requestAnimationFrame(loop2D); }
    draw2D();
    raceHud();
  }
  function stop2D() { if (raf2) { cancelAnimationFrame(raf2); raf2 = 0; } }

  /* ---------------- 주행 물리 ---------------- */
  function curveY(u) { return ptAt(u).y; }
  function slopeAt(u) {
    var e = 0.004;
    return (curveY(u + e) - curveY(u - e)) / (2 * e * trackLen);
  }
  function curveCurvature(u) {
    var e = 0.02;
    var a = tanAt(u - e), b = tanAt(u + e);
    var cross = a.x * b.z - a.z * b.x, dot = a.x * b.x + a.z * b.z;
    return Math.atan2(cross, dot) / (2 * e * trackLen);
  }
  function newCar(id, name, isMe, conf, lane) {
    var st = stats(conf);
    return {
      id: id, name: name, isMe: !!isMe, cfg: conf, st: st,
      u: 0, s: 0, lane: lane || 0, lap: 1, lapT: 0, best: 0,
      boostT: 0, boosts: st.boosts, finished: false, finishT: 0,
      air: false, vy: 0, y: 0, shake: 0, group: null, place: 0, manualT: 0
    };
  }
  function progressOf(c) { return (c.lap - 1) + c.u; }
  function aiSteer(car, dt, curv) {
    /* 커브 안쪽을 노리고, 곧은 구간에서 부스트 */
    var target = clamp(-curv * 26, -1.15, 1.15);
    car.lane += (target - car.lane) * Math.min(1, dt * 1.6);
    if (car.boosts > 0 && car.boostT <= 0 && Math.abs(curv) < 0.05 && Math.random() < dt * 0.55) {
      car.boosts--; car.boostT = 1.2;
    }
  }
  function advance(car, dt, ai) {
    if (!car || car.finished) return;
    var st = car.st;
    var bo = car.boostT > 0;
    var top = st.top / 60 * (bo ? 1.35 : 1);
    var acc = st.acc * (bo ? 1.7 : 1);
    car.s += acc * dt;
    if (car.s > top) car.s -= (car.s - top) * Math.min(1, dt * 3.2);
    car.s = Math.max(0, car.s);
    car.boostT = Math.max(0, car.boostT - dt);

    var u = car.u, curv = curveCurvature(u);
    /* 코너에서 접지력이 낮으면 바깥으로 밀린다 */
    var drift = curv * car.s * car.s * 0.07 * (1.25 - st.grip) * (1 - st.stab * 0.45);
    car.lane = clamp(car.lane + drift * dt, -1.7, 1.7);
    if (ai) aiSteer(car, dt, curv);
    else {
      /* 내 차: 기본은 코스 안쪽을 따라가는 보조 핸들링, 좌우 버튼을 누르면 그동안은 수동 */
      car.manualT = Math.max(0, (car.manualT || 0) - dt);
      if (!car.manualT) {
        var tgt = clamp(-curv * 26, -0.9, 0.9);
        car.lane += (tgt - car.lane) * Math.min(1, dt * 1.25);
      }
    }
    var off = Math.abs(car.lane * 0.5) > HW * 0.85;
    if (off) car.s *= 1 - Math.min(0.9, dt * 2.2);
    car.shake = off ? 1 : Math.max(0, car.shake - dt * 3);

    if (!car.air) {
      var sl = slopeAt(u);
      car.u += (car.s / trackLen) * dt * (1 / Math.max(0.45, Math.cos(sl * 1.2)));
      if (u >= RAMP_U0 && u < RAMP_U1 && sl < -0.05 && car.s > 2.4) {
        car.air = true;
        car.vy = car.s * 0.42;
      }
      car.y = curveY(car.u);
    } else {
      car.u += (car.s * 0.94 / trackLen) * dt;
      car.vy -= 9.8 * dt * 0.55;
      car.y += car.vy * dt;
      var gy = curveY(car.u);
      if (car.y <= gy) { car.y = gy; car.air = false; car.vy = 0; if (car.isMe) toast('🛬 착지!'); }
    }
    car.lapT += dt;
    if (car.u >= 1) {
      car.u -= 1;
      var lapMs = Math.round(car.lapT * 1000);
      car.lapT = 0;
      if (!car.best || lapMs < car.best) car.best = lapMs;
      car.lap++;
      car.boosts = car.st.boosts;
      if (car.isMe) onMyLap(lapMs);
    }
    if (progressOf(car) >= race.laps - 0.000001 && !car.finished) {
      car.finished = true;
      car.finishT = race.t;
      if (car.isMe) finishRace();
    }
  }
  function onMyLap(lapMs) {
    var rec = recOf(mid(), true);
    if (rec && (!rec.best || lapMs < rec.best)) {
      rec.best = lapMs; rec.cfg = normCfg(cfg); rec.at = now();
      rec.laps = (rec.laps || 0) + 1;
      save();
      toast('🏁 신기록! 최고 랩 ' + fmtMs(lapMs));
      var hint = $('mcHint');
      if (hint) hint.innerHTML = hint.innerHTML.replace(/현재 최고: [^)]*\)/, '현재 최고: ' + fmtMs(lapMs) + ')');
    }
  }
  function tick(dt) {
    if (!race || mode === 'none') return;
    if (race.state === 'count') {
      race.count -= dt;
      if (race.count <= 0) { race.count = 0; race.state = 'run'; race.t = 0; }
      return;
    }
    if (race.state !== 'run') return;
    race.t += dt;
    race.cars.forEach(function (car) { advance(car, dt, !car.isMe); });
    if (mode === '3d') race.cars.forEach(placeGroup);
  }

  /* ---------------- 경기 구성 ---------------- */
  var PRESETS = [
    { brand: 'ferrari', model: 'gtb296', color: '#4C8DFF', power: 'v8', gear: 'bal', tire: 'michelin', brake: 'brembo', aero: 'gtwing', deco: 'stripe', batt: 'm' },
    { brand: 'lambo', model: 'aventador', color: '#C6D92B', power: 'v8', gear: 'top', tire: 'pirelli', brake: 'carbon', aero: 'fullkit', deco: 'both', batt: 'l' },
    { brand: 'porsche', model: 'gt3rs', color: '#F5F7F8', power: 'stock', gear: 'acc', tire: 'michelin', brake: 'carbon', aero: 'gtwing', deco: 'led', batt: 'm' },
    { brand: 'tesla', model: 'models', color: '#2B3138', power: 'ev', gear: 'bal', tire: 'michelin', brake: 'brembo', aero: 'stock', deco: 'led', batt: 's' },
    { brand: 'audi', model: 'r8', color: '#7C8794', power: 'v8', gear: 'bal', tire: 'pirelli', brake: 'brembo', aero: 'gtwing', deco: 'stock', batt: 'm' },
    { brand: 'mclaren', model: 'm720s', color: '#FF7A1A', power: 'hybrid', gear: 'top', tire: 'pirelli', brake: 'carbon', aero: 'fullkit', deco: 'stripe', batt: 'm' }
  ];
  function hashOf(s) {
    var h = 0;
    for (var i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) | 0;
    return Math.abs(h);
  }
  function presetFor(id) { return normCfg(PRESETS[hashOf(id) % PRESETS.length]); }
  /* 가족 차량: 직접 조립한 기록이 있으면 그것, 없으면 '기본 세팅' */
  function carOfMember(id) {
    var rec = recOf(id, false);
    var direct = !!(rec && rec.cfg && (rec.laps || rec.best));
    return { cfg: direct ? normCfg(rec.cfg) : presetFor(id), direct: direct, rec: rec };
  }
  function buildRace(modeSel, rivalId, laps) {
    var list = [{ id: mid(), name: (me() && me().name) || '나', isMe: true, cfg: normCfg(cfg) }];
    var others = [];
    try {
      others = (F.members ? F.members() : []).filter(function (m) { return m.id !== mid(); });
    } catch (e) { others = []; }
    if (modeSel === 'duel') {
      var r = others.filter(function (m) { return m.id === rivalId; })[0] || others[0];
      if (r) others = [r];
      else others = [];
    } else if (modeSel === 'solo') {
      others = [];
    }
    others.forEach(function (m) {
      var co = carOfMember(m.id);
      list.push({ id: m.id, name: m.name, isMe: false, cfg: co.cfg, direct: co.direct, rec: co.rec });
    });
    var n = list.length;
    var laneSet = n === 1 ? [0] : (n === 2 ? [-0.55, 0.55] : (n === 3 ? [-1.1, 0, 1.1] : [-1.35, -0.45, 0.45, 1.35]));
    /* 내 차가 가운데(짝수면 안쪽)로 오도록 가까운 차선부터 배정 */
    var sorted = laneSet.slice().sort(function (a, b) { return Math.abs(a) - Math.abs(b); });
    var myLane = sorted.shift();
    var cars = list.map(function (o, i) {
      var lane = i === 0 ? myLane : sorted[i - 1];
      return newCar(o.id, o.name, o.isMe, o.cfg, lane);
    });
    var rival = null;
    if (modeSel === 'duel' && cars[1]) rival = cars[1];
    return {
      mode: modeSel, laps: laps || 1, state: 'ready', count: 3, t: 0,
      cars: cars, me: cars[0], rival: rival, results: null, direct: others.map(function (m) { return m.direct ? 1 : 0; })
    };
  }
  function myRank() {
    if (!race) return 1;
    var p = progressOf(race.me), r = 1;
    race.cars.forEach(function (c) { if (!c.isMe && progressOf(c) > p) r++; });
    return r;
  }
  function projectedTime(car, t0) {
    if (car.finished) return car.finishT;
    var remain = Math.max(0, race.laps - progressOf(car));
    var speed = Math.max(1.2, car.s);
    return t0 + remain * trackLen / speed;
  }
  function finishRace() {
    if (!race || race.state === 'done') return;
    race.state = 'done';
    var t0 = race.me.finished ? race.me.finishT : race.t;
    race.results = race.cars.map(function (c) {
      return { car: c, time: projectedTime(c, t0) };
    }).sort(function (a, b) { return a.time - b.time; });
    race.results.forEach(function (r, i) { r.rank = i + 1; r.gap = r.time - t0; });
    var mine = race.results.filter(function (r) { return r.car.isMe; })[0];
    race.rank = mine ? mine.rank : 1;
    /* 전적 저장 */
    var rec = recOf(mid(), true);
    if (rec) {
      rec.races = (rec.races || 0) + 1;
      if (race.rank === 1) rec.wins = (rec.wins || 0) + 1;
      rec.last = { mode: race.mode, rank: race.rank, at: now(), cars: race.cars.length };
      rec.cfg = normCfg(cfg);
      rec.at = now();
      save();
    }
    renderResult();
    raceHud(true);
  }
  function resultText() {
    if (!race || !race.results) return '';
    var mine = race.results.filter(function (r) { return r.car.isMe; })[0];
    if (!mine) return '';
    var next = race.results[mine.rank];  /* 바로 아래(내가 이긴 상대) */
    var above = race.results[mine.rank - 2]; /* 바로 위(나를 이긴 상대) */
    var short = function (r) {
      var mm = MODELS[r.car.cfg.model];
      return r.car.name + '(' + (mm && BRANDS[mm.brand] ? BRANDS[mm.brand].n : '') + ')';
    };
    if (mine.rank === 1) {
      if (race.mode === 'solo') {
        return '⏱ 완주! ' + fmtMs(Math.round(mine.time * 1000)) + (mine.car.best ? ' · 베스트 랩 ' + fmtMs(mine.car.best) : '');
      }
      return next ? '🏆 1위! ' + short(next) + '보다 ' + Math.abs(next.gap).toFixed(2) + '초 빨랐어요!' : '🏆 1위! 완주했어요!';
    }
    if (above) {
      var md = ['🥇', '🥈', '🥉', '4️⃣'][mine.rank - 1] || '';
      return md + ' ' + mine.rank + '위 · ' + short(above) + '보다 ' + Math.abs(above.gap).toFixed(2) + '초 느렸어요. 부품을 더 맞춰 보세요!';
    }
    return mine.rank + '위';
  }

  /* ---------------- 미리보기 (2D 실차 실루엣) ---------------- */
  function shade(hex, f) {
    var h = String(hex || '#888').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (isNaN(n)) return hex;
    var r = clamp(Math.round(((n >> 16) & 255) * f), 0, 255);
    var g = clamp(Math.round(((n >> 8) & 255) * f), 0, 255);
    var b = clamp(Math.round((n & 255) * f), 0, 255);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }
  function drawPreview() {
    var cv = $('mcPrev');
    if (!cv || !cfg) return;
    var wrap = cv.parentNode;
    var W = (wrap && wrap.clientWidth) || 300, H = (wrap && wrap.clientHeight) || 160;
    if (W < 60) W = 300;
    if (H < 60) H = 160;
    var dpr = Math.min(2, global.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    var x = cv.getContext('2d');
    if (!x) return;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, W, H);

    var st = stats(cfg), m = st.model, br = st.brand;
    var col = cfg.color || br.color;
    var fy = H * 0.80;                 /* 지면 */
    var sc = Math.min(W / (m.len * 1.5), H / 0.62);
    var ox = W / 2;
    function P(px, py) { return [ox + px * sc, fy - py * sc]; }

    var gd = x.createLinearGradient(0, 0, 0, H);
    gd.addColorStop(0, '#EAF5FF');
    gd.addColorStop(0.68, '#F6FBFF');
    gd.addColorStop(1, '#E9F1EA');
    x.fillStyle = gd;
    x.fillRect(0, 0, W, H);

    /* 그림자 */
    x.fillStyle = 'rgba(22,34,46,.15)';
    x.beginPath();
    x.ellipse(ox, fy - 2, m.len * 0.52 * sc, 7 * (sc / 300), 0, 0, Math.PI * 2);
    x.fill();

    /* 차체 실루엣 */
    var pts = profilePts(m);
    x.beginPath();
    var p0 = P(pts[0][0], pts[0][1]);
    x.moveTo(p0[0], p0[1]);
    for (var i = 1; i < pts.length; i++) { var pp = P(pts[i][0], pts[i][1]); x.lineTo(pp[0], pp[1]); }
    x.closePath();
    var bg = x.createLinearGradient(0, fy - m.roof * sc, 0, fy);
    bg.addColorStop(0, shade(col, 1.25));
    bg.addColorStop(0.5, col);
    bg.addColorStop(1, shade(col, 0.70));
    x.fillStyle = bg;
    x.fill();
    x.strokeStyle = 'rgba(20,28,36,.20)';
    x.lineWidth = 1;
    x.stroke();

    /* 유리창 */
    var gx1 = m.roofB + 0.03, gx2 = m.roofA - 0.01;
    var gp = [P(gx1, m.deck + 0.01), P(gx1 + 0.03, m.roof - 0.01), P(gx2, m.roof - 0.01), P(gx2 + 0.03, m.hood + 0.01)];
    x.beginPath();
    x.moveTo(gp[0][0], gp[0][1]);
    for (var j = 1; j < gp.length; j++) x.lineTo(gp[j][0], gp[j][1]);
    x.closePath();
    x.fillStyle = 'rgba(140,205,235,.92)';
    x.fill();
    x.strokeStyle = shade(col, 0.72);
    x.lineWidth = Math.max(1, 0.8 * (sc / 260));
    x.stroke();

    /* 스트라이프 데칼 */
    if (st.d.stripes) {
      x.fillStyle = 'rgba(255,255,255,.92)';
      [[0.016, 0.052], [-0.016, 0.020]].forEach(function (o) {
        var a = P(m.roofA, m.hood + o[0] * 0.6), b2 = P(m.len * 0.50, m.nose + o[0] * 0.5);
        x.beginPath();
        x.moveTo(a[0], a[1] - o[1] * sc * 0.4);
        x.lineTo(b2[0], b2[1] - o[1] * sc * 0.4);
        x.lineTo(b2[0], b2[1] - (o[1] - 0.014) * sc * 0.4);
        x.lineTo(a[0], a[1] - (o[1] - 0.014) * sc * 0.4);
        x.closePath(); x.fill();
      });
      var r1 = P(m.roofB, m.roof + 0.006), r2 = P(m.roofA, m.roof + 0.006);
      x.fillStyle = 'rgba(255,255,255,.92)';
      x.fillRect(r1[0], r1[1] - 0.02 * sc, r2[0] - r1[0], Math.max(2, 0.022 * sc));
    }

    /* 리어 윙 */
    if (st.a.wing) {
      var wx = -m.len * 0.46;
      var wtop = m.deck + (cfg.aero === 'fullkit' ? 0.11 : 0.15);
      var wa = P(wx, wtop), wb = P(wx + 0.13, wtop);
      x.fillStyle = '#2B3138';
      x.fillRect(wa[0], wa[1], Math.max(6, wb[0] - wa[0]), Math.max(3, 0.028 * sc));
      var s1 = P(wx + 0.04, m.deck), s2 = P(wx + 0.04, wtop);
      x.fillRect(s1[0] - 1, s2[1], Math.max(2, 0.014 * sc), s1[1] - s2[1]);
    }
    if (st.a.kit) {
      var kp = P(m.len * 0.47, 0.045);
      x.fillStyle = '#2B3138';
      x.fillRect(kp[0] - 0.05 * sc, kp[1] - Math.max(2, 0.02 * sc), Math.max(5, 0.16 * sc), Math.max(2, 0.02 * sc));
      var dp = P(-m.len * 0.47, 0.05);
      x.fillRect(dp[0], dp[1] - Math.max(2, 0.03 * sc), Math.max(5, 0.1 * sc), Math.max(2, 0.03 * sc));
    }

    /* 헤드·테일 램프 */
    var hl = P(m.len * 0.47, m.nose + 0.035);
    x.fillStyle = st.d.led ? '#D9F6FF' : '#FFF1C9';
    x.beginPath();
    x.ellipse(hl[0], hl[1], Math.max(2.5, 0.045 * sc), Math.max(1.6, 0.016 * sc), 0, 0, Math.PI * 2);
    x.fill();
    if (st.d.led) {
      x.fillStyle = 'rgba(112,214,255,.35)';
      x.beginPath();
      x.ellipse(hl[0] + 0.02 * sc, hl[1], 0.09 * sc, 0.035 * sc, 0, 0, Math.PI * 2);
      x.fill();
    }
    var tl = P(-m.len * 0.49, m.tail - 0.03);
    x.fillStyle = '#E5484D';
    x.fillRect(tl[0], tl[1] - Math.max(1.5, 0.018 * sc), Math.max(2, 0.02 * sc), Math.max(2.5, 0.03 * sc));

    /* 바퀴 */
    var tire = st.t, bk = st.br;
    var R = (m.wr + tire.r + bk.r) * sc;
    /* 휠하우스(아치) — 바퀴가 차체에 파인 듯 */
    [-m.len * 0.31, m.len * 0.31].forEach(function (wx) {
      var c = P(wx, m.wr + tire.r + bk.r);
      x.fillStyle = 'rgba(18,24,30,.90)';
      x.beginPath();
      x.arc(c[0], c[1], R * 1.20, Math.PI, Math.PI * 2);
      x.closePath();
      x.fill();
    });
    [-m.len * 0.31, m.len * 0.31].forEach(function (wx) {
      var c = P(wx, m.wr + tire.r + bk.r);
      x.fillStyle = tire.tread === 'off' ? '#15181B' : '#22262B';
      x.beginPath(); x.arc(c[0], c[1], R, 0, Math.PI * 2); x.fill();
      /* 트레드 */
      if (tire.tread === 'off') {
        x.fillStyle = 'rgba(255,255,255,.32)';
        for (var k2 = 0; k2 < 10; k2++) {
          var a2 = k2 / 10 * Math.PI * 2;
          x.beginPath();
          x.arc(c[0] + Math.cos(a2) * R * 0.8, c[1] + Math.sin(a2) * R * 0.8, Math.max(1, R * 0.12), 0, Math.PI * 2);
          x.fill();
        }
      } else if (tire.tread === 'race') {
        x.strokeStyle = 'rgba(255,255,255,.35)';
        x.lineWidth = Math.max(1, R * 0.1);
        for (var k3 = 0; k3 < 5; k3++) {
          var a3 = k3 / 5 * Math.PI * 2;
          x.beginPath();
          x.moveTo(c[0] + Math.cos(a3) * R * 0.55, c[1] + Math.sin(a3) * R * 0.55);
          x.lineTo(c[0] + Math.cos(a3) * R * 0.95, c[1] + Math.sin(a3) * R * 0.95);
          x.stroke();
        }
      }
      /* 사이드월 링 */
      if (tire.ring) {
        x.strokeStyle = tire.ring;
        x.lineWidth = Math.max(1.2, R * 0.08);
        x.beginPath(); x.arc(c[0], c[1], R * 0.80, 0, Math.PI * 2); x.stroke();
      }
      /* 림 */
      x.fillStyle = bk.rim;
      x.beginPath(); x.arc(c[0], c[1], R * 0.55, 0, Math.PI * 2); x.fill();
      x.strokeStyle = 'rgba(20,28,36,.25)';
      x.lineWidth = 1;
      for (var sp = 0; sp < bk.spokes; sp++) {
        var a4 = sp / bk.spokes * Math.PI * 2;
        x.beginPath();
        x.moveTo(c[0], c[1]);
        x.lineTo(c[0] + Math.cos(a4) * R * 0.52, c[1] + Math.sin(a4) * R * 0.52);
        x.stroke();
      }
      x.fillStyle = 'rgba(30,38,46,.55)';
      x.beginPath(); x.arc(c[0], c[1], R * 0.13, 0, Math.PI * 2); x.fill();
      /* 캘리퍼 색 */
      x.fillStyle = bk.cal;
      x.beginPath();
      x.arc(c[0] - R * 0.3, c[1] + R * 0.12, Math.max(1.6, R * 0.16), 0, Math.PI * 2);
      x.fill();
    });
    /* 휀더(흙받이) 아치 — 바퀴 윗부분을 차체색으로 덮어 자동차처럼 */
    x.strokeStyle = shade(col, 0.92);
    x.lineWidth = Math.max(2, 0.022 * sc);
    [-m.len * 0.31, m.len * 0.31].forEach(function (wx) {
      var c = P(wx, m.wr + tire.r + bk.r);
      x.beginPath();
      x.arc(c[0], c[1], R * 1.10, Math.PI * 1.02, Math.PI * 1.98);
      x.stroke();
    });

    /* 배기 불꽃(파워트레인) */
    if (cfg.power === 'v8') {
      var ep = P(-m.len * 0.5, 0.08);
      x.fillStyle = 'rgba(255,138,61,.85)';
      x.beginPath();
      x.moveTo(ep[0], ep[1]);
      x.lineTo(ep[0] - 0.07 * sc, ep[1] - 0.02 * sc);
      x.lineTo(ep[0] - 0.07 * sc, ep[1] + 0.02 * sc);
      x.closePath(); x.fill();
    } else if (cfg.power === 'ev') {
      x.strokeStyle = 'rgba(99,184,255,.75)';
      x.lineWidth = Math.max(1.2, 0.012 * sc);
      x.beginPath();
      var e1 = P(-m.len * 0.42, 0.05), e2 = P(m.len * 0.42, 0.05);
      x.moveTo(e1[0], e1[1] + 2); x.lineTo(e2[0], e2[1] + 2);
      x.stroke();
    }

    /* 브랜드 · 차종 */
    x.fillStyle = 'rgba(30,42,54,.78)';
    x.font = '900 ' + Math.max(10, Math.round(H * 0.075)) + 'px -apple-system,system-ui,sans-serif';
    x.textAlign = 'left';
    x.fillText(br.n + ' ' + m.n, 10, H - 26);
    x.fillStyle = 'rgba(38,52,64,.55)';
    x.font = '700 ' + Math.max(9, Math.round(H * 0.055)) + 'px -apple-system,system-ui,sans-serif';
    x.fillText(Math.round(st.top) + 'km/h · ' + tire.n + ' · ' + bk.n, 10, H - 11);
  }

  /* ---------------- 스타일 ---------------- */
  function style() {
    if ($('mcstyle')) return;
    var s = document.createElement('style');
    s.id = 'mcstyle';
    s.textContent = [
      '.mc-sec{font-size:13px;font-weight:900;color:#2A323B;margin:2px 0 7px;letter-spacing:-.2px}',
      '.mc-prev{position:relative;width:100%;height:168px;border-radius:14px;overflow:hidden;background:linear-gradient(180deg,#EAF5FF,#F5FAFF);border:1px solid #E4ECF3;margin:0 0 9px}',
      '.mc-prev canvas{display:block;width:100%;height:100%}',
      '.mc-grp{margin-top:9px}',
      '.mc-glb{font-size:10.5px;font-weight:900;color:#79838F;letter-spacing:.3px;margin-bottom:5px}',
      '.mc-grid{display:flex;flex-wrap:wrap;gap:6px}',
      '.mc-brand{flex:1 1 calc((100% - 12px)/3);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:48px;padding:6px 4px;border-radius:12px;background:linear-gradient(180deg,#fff,#F8FAFB);border:1.5px solid #EAEEF2;box-shadow:0 2px 0 #E6ECF1;font-size:10.5px;font-weight:800;color:#3C4450;letter-spacing:-.3px}',
      '.mc-brand .em{font-size:16px;line-height:1}',
      '.mc-brand.on{border-color:#0E9F6E;background:linear-gradient(180deg,#F3FCF7,#E9F9F1);color:#0A7D56;box-shadow:0 2px 0 #C4E8D8}',
      '.mc-brand:active{transform:translateY(2px);box-shadow:none}',
      '.mc-optrow{display:flex;align-items:flex-start;gap:5px;margin:5px 0}',
      '.mc-lb{flex:none;width:58px;font-size:10.5px;font-weight:800;color:#79838F;padding-top:7px;letter-spacing:-.3px}',
      '.mc-chips{flex:1;display:flex;flex-wrap:wrap;gap:5px;min-width:0}',
      '.mc-chip{flex:1 1 calc((100% - 15px)/4);min-width:0;padding:7px 2px;border-radius:10px;background:#F3F6F8;border:1.5px solid transparent;font-size:10.5px;font-weight:800;color:#5C6673;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center;transition:.14s}',
      '.mc-chip.on{background:#E7F8F1;border-color:#0E9F6E;color:#0B7A54;box-shadow:0 2px 8px rgba(14,159,110,.18)}',
      '.mc-chip:active{transform:scale(.97)}',
      '.mc-color{flex:none;width:25px;height:25px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1.5px rgba(60,72,84,.32),inset 0 0 0 1px rgba(40,50,60,.18);transition:.14s}',
      '.mc-color.on{box-shadow:0 0 0 2.5px #0E9F6E}',
      '.mc-fitted{margin-top:8px;padding:8px 10px;border-radius:11px;background:#FBFDFC;border:1px dashed #DCE6EC;font-size:10.5px;font-weight:700;color:#5C6673;line-height:1.65;letter-spacing:-.2px}',
      '.mc-fitted b{color:#0B7A54;font-weight:900}',
      '.mc-stats{margin-top:8px;padding:9px 10px;border-radius:12px;background:#F7FAFC;border:1px solid #E6EDF2;font-size:11px;font-weight:700;color:#4E5A66;line-height:1.7}',
      '.mc-stats b{color:#0B7A54;font-weight:900}',
      '.mc-go{width:100%;margin-top:10px;padding:13px;border-radius:13px;background:#0E9F6E;color:#fff;font-size:14px;font-weight:900;border:0;box-shadow:0 4px 12px rgba(14,159,110,.25)}',
      '.mc-canvas-wrap{position:relative;width:100%;height:270px;min-height:270px;border-radius:14px;overflow:hidden;background:linear-gradient(#CDE8FF,#EAF6FF);touch-action:none}',
      '.mc-canvas-wrap canvas{display:block;position:absolute;left:0;top:0;width:100%;height:100%}',
      '.mc-hud{position:absolute;z-index:3;left:8px;right:8px;top:8px;display:flex;gap:5px;flex-wrap:wrap;font-size:10.5px;font-weight:900;color:#20303C;pointer-events:none}',
      '.mc-hud span{background:rgba(255,255,255,.88);padding:3px 8px;border-radius:20px;box-shadow:0 1px 5px rgba(20,30,40,.12)}',
      '.mc-count{position:absolute;inset:0;z-index:4;display:flex;align-items:center;justify-content:center;font-size:64px;font-weight:900;color:#fff;text-shadow:0 4px 18px rgba(20,30,40,.55);pointer-events:none}',
      '.mc-modebar{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}',
      '.mc-modebar button{flex:1 1 calc((100% - 12px)/3);padding:9px 4px;border-radius:11px;background:#F3F6F8;border:1.5px solid transparent;font-size:11px;font-weight:900;color:#5C6673}',
      '.mc-modebar button.on{background:#E7F8F1;border-color:#0E9F6E;color:#0B7A54}',
      '.mc-setupbox{padding:9px 10px;border-radius:12px;background:#FBFDFC;border:1px solid #E9EEF2;margin-bottom:8px}',
      '.mc-rtag{display:inline-block;font-size:9.5px;font-weight:900;padding:2px 6px;border-radius:20px;background:#E7F8F1;color:#0A7D56;margin-left:4px}',
      '.mc-rtag.gray{background:#F1F4F5;color:#79838F}',
      '.mc-rival{display:flex;flex-direction:column;gap:5px}',
      '.mc-rival button{display:flex;align-items:center;gap:7px;padding:8px 9px;border-radius:10px;background:#fff;border:1px solid #E9EEF2;font-size:11.5px;font-weight:800;color:#3C4450;text-align:left}',
      '.mc-rival button.on{border-color:#0E9F6E;background:#EFFAF5;color:#0A7D56}',
      '.mc-rival .cb{width:24px;height:24px;border-radius:7px;flex:none;display:flex;align-items:center;justify-content:center;font-size:13px;background:#F1F4F5}',
      '.mc-ctrl{display:grid;grid-template-columns:1.4fr 1fr;gap:6px;margin-top:9px}',
      '.mc-btn{padding:11px 6px;border-radius:12px;background:#F1F4F5;font-size:12px;font-weight:800;color:#3C4450;border:0}',
      '.mc-btn:active{transform:scale(.98)}',
      '.mc-btn.go{background:#0E9F6E;color:#fff}',
      '.mc-btn.back{background:#E7EEF3;color:#4A5662}',
      '.mc-mode{margin-top:6px;font-size:10px;font-weight:700;color:#93A0AC;text-align:right}',
      '.mc-result{margin-top:9px;padding:12px;border-radius:14px;background:linear-gradient(180deg,#F3FCF7,#EAF9F1);border:1px solid #CBEBDA}',
      '.mc-result .rt{font-size:15px;font-weight:900;letter-spacing:-.3px;color:#0A7D56;line-height:1.4;word-break:keep-all}',
      '.mc-result .rm{font-size:11px;font-weight:800;color:#5C6673;margin-top:4px}',
      '.mc-result .rl{display:flex;align-items:center;gap:7px;padding:7px 8px;margin-top:5px;border-radius:10px;background:#fff;border:1px solid #E3F0E8;font-size:11.5px;font-weight:800;color:#3C4450}',
      '.mc-result .rl.me{background:#E7F8F1;border-color:#9FDCBC}',
      '.mc-result .rl .no{width:20px;flex:none;text-align:center;font-weight:900;color:#0A7D56}',
      '.mc-result .rl .nm{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.mc-result .rl .tm{font-variant-numeric:tabular-nums;color:#5C6673}',
      '.mc-result .rb{display:flex;gap:6px;margin-top:9px}',
      '.mc-result .rb button{flex:1;padding:10px 4px;border-radius:11px;font-size:12px;font-weight:900;border:0;background:#fff;color:#0A7D56;box-shadow:0 1px 0 #D6EDE1}',
      '.mc-result .rb button.main{background:#0E9F6E;color:#fff}',
      '.mc-rank{margin-top:12px;border-top:1px solid #EAEEF2;padding-top:10px}',
      '.mc-rank .rk{font-size:12px;font-weight:900;color:#3C4450;margin-bottom:6px}',
      '.mc-rank .row{display:flex;align-items:center;gap:7px;padding:7px 8px;border-radius:10px;background:#FBFDFC;border:1px solid #EDF1F4;margin-bottom:4px;font-size:11.5px;font-weight:800;color:#3C4450}',
      '.mc-rank .row.me{background:#EFFAF5;border-color:#BFE9D6}',
      '.mc-rank .row .nm{flex:1;min-width:0}',
      '.mc-rank .row .sp{font-size:10px;color:#79838F;font-weight:700}',
      '.mc-rank .row .bt{font-variant-numeric:tabular-nums;color:#0A7D56;font-weight:900}'
    ].join('\n');
    document.head.appendChild(s);
  }
  function setModeLabel(m) {
    var el = $('mcMode');
    if (!el) return;
    el.textContent = m === '3d' ? '🧊 3D 화면' : (m === '2d' ? '🗺️ 간이 2D 화면 (WebGL 미지원 기기)' : '');
  }

  /* ---------------- 조립 UI ---------------- */
  function chipRow(p, cur) {
    return '<div class="mc-optrow"><span class="mc-lb">' + p.lb + '</span><div class="mc-chips">' + p.opts.map(function (o) {
      return '<button type="button" class="mc-chip' + (cur === o[0] ? ' on' : '') + '" data-mckey="' + p.k + '" data-mcval="' + o[0] + '">' + o[1] + '</button>';
    }).join('') + '</div></div>';
  }
  function statsHtml() {
    var st = stats(cfg);
    return '⚡ 최고속 <b>' + Math.round(st.top) + 'km/h</b> · 가속 <b>' + st.acc.toFixed(1) + '</b> · 그립 <b>' +
      Math.round(st.grip * 100) + '%</b> · 코너 안정 <b>' + Math.round(st.stab * 100) + '%</b> · 부스트 <b>' + st.boosts + '회</b>';
  }
  function fittedHtml() {
    var st = stats(cfg);
    return '🛞 <b>' + st.t.n + '</b> · 🛑 <b>' + st.br.n + '</b> · 🪶 <b>' + st.a.n + '</b><br>' +
      '⚙️ <b>' + st.p.n + '</b> · ' + st.g.n + ' · 🎨 <b>' + st.d.n + '</b> · 🔋 ' + st.bt.n;
  }
  function rankHtml() {
    var rows = [];
    try { rows = F.members ? F.members() : []; } catch (e) { rows = []; }
    var v = V9();
    var items = rows.map(function (m) {
      var rec = v.minicar[m.id];
      var direct = !!(rec && rec.cfg && (rec.laps || rec.best));
      var co = (m.id === mid() && cfg) ? normCfg(cfg) : (direct ? normCfg(rec.cfg) : presetFor(m.id));
      var mm = MODELS[co.model] || MODELS.sf90;
      return {
        id: m.id, name: m.name, emoji: m.emoji || '🧑', mine: m.id === mid(),
        best: (rec && rec.best) || 0, wins: (rec && rec.wins) || 0, races: (rec && rec.races) || 0,
        direct: (m.id === mid() && cfg) ? true : direct, label: (BRANDS[mm.brand] ? BRANDS[mm.brand].n : '') + ' ' + mm.n
      };
    });
    items.sort(function (a, b) {
      if (a.best && b.best) return a.best - b.best;
      if (a.best) return -1;
      if (b.best) return 1;
      return a.name.localeCompare(b.name, 'ko');
    });
    return '<div class="mc-rank"><div class="rk">🏆 가족 조립 차량 랭킹 <span style="font-size:10px;font-weight:700;color:#79838F">(최고 랩타임 순)</span></div>' +
      items.map(function (it, i) {
        return '<div class="row' + (it.mine ? ' me' : '') + '"><span style="width:18px;text-align:center">' + (i + 1) + '</span>' +
          '<span>' + it.emoji + '</span><span class="nm">' + esc(it.name) + (it.mine ? ' (나)' : '') + '<br><span class="sp">' + esc(it.label) + '</span>' +
          '<span class="mc-rtag' + (it.direct ? '' : ' gray') + '">' + (it.direct ? '직접 조립' : '기본 세팅') + '</span></span>' +
          '<span class="bt">' + (it.best ? fmtMs(it.best) : '–') + '</span></div>';
      }).join('') + '</div>';
  }
  function esc(s) { return F ? F.esc(s) : String(s == null ? '' : s); }

  function renderGarage() {
    var box = $('mcGarage');
    if (!box) return;
    var rec = recOf(mid(), true);
    if (!cfg) cfg = normCfg(rec && rec.cfg);
    var st = stats(cfg);
    var brandKeys = Object.keys(BRANDS);
    var models = MODEL_BY_BRAND[st.model.brand] || [];
    box.innerHTML =
      '<div class="mc-sec">🔧 나만의 미니카 조립 <span style="font-size:10px;font-weight:700;color:#79838F">— 실차 브랜드·부품 그대로</span></div>' +
      '<div class="mc-prev"><canvas id="mcPrev"></canvas></div>' +
      '<div class="mc-grp"><div class="mc-glb">🏭 실제 차량 브랜드</div><div class="mc-grid">' + brandKeys.map(function (k) {
        var b = BRANDS[k];
        return '<button type="button" class="mc-brand' + (st.model.brand === k ? ' on' : '') + '" data-mcbrand="' + k + '"><span class="em">' + b.em + '</span>' + esc(b.n) + '</button>';
      }).join('') + '</div></div>' +
      '<div class="mc-grp"><div class="mc-glb">🚘 차종</div><div class="mc-chips">' + models.map(function (mk) {
        return '<button type="button" class="mc-chip' + (cfg.model === mk ? ' on' : '') + '" data-mcmodel="' + mk + '" style="flex-basis:calc((100% - 5px)/2)">' + esc(MODELS[mk].n) + '</button>';
      }).join('') + '</div></div>' +
      '<div class="mc-grp"><div class="mc-glb">🎨 색상</div><div class="mc-grid">' + COLORS.map(function (c) {
        return '<button type="button" class="mc-color' + (cfg.color === c ? ' on' : '') + '" data-mccolor="' + c + '" style="background:' + c + '" aria-label="색상 ' + c + '"></button>';
      }).join('') + '</div></div>' +
      PART_ROWS.map(function (p) { return chipRow(p, cfg[p.k]); }).join('') +
      '<div class="mc-fitted" id="mcFitted">' + fittedHtml() + '</div>' +
      '<div class="mc-stats" id="mcStats">' + statsHtml() + '</div>' +
      '<button type="button" class="mc-go" id="mcGo">🏁 이 차로 주행 · 가족 대결</button>' +
      rankHtml();
    drawPreview();
  }
  function syncGarage() {
    var box = $('mcGarage');
    if (!box) return;
    box.querySelectorAll('[data-mckey]').forEach(function (b) {
      b.classList.toggle('on', cfg && cfg[b.getAttribute('data-mckey')] === b.getAttribute('data-mcval'));
    });
    box.querySelectorAll('[data-mccolor]').forEach(function (b) {
      b.classList.toggle('on', cfg && cfg.color === b.getAttribute('data-mccolor'));
    });
    box.querySelectorAll('[data-mcmodel]').forEach(function (b) {
      b.classList.toggle('on', cfg && cfg.model === b.getAttribute('data-mcmodel'));
    });
    box.querySelectorAll('[data-mcbrand]').forEach(function (b) {
      b.classList.toggle('on', cfg && modelOf(cfg).brand === b.getAttribute('data-mcbrand'));
    });
    var stEl = $('mcStats');
    if (stEl) stEl.innerHTML = statsHtml();
    var fEl = $('mcFitted');
    if (fEl) fEl.innerHTML = fittedHtml();
    drawPreview();
  }
  function setPart(k, v) {
    if (!cfg) cfg = normCfg((recOf(mid(), true) || {}).cfg);
    if (!cfg || cfg[k] === v) { syncGarage(); return; }
    cfg[k] = v;
    var rec = recOf(mid(), true);
    if (rec) { rec.cfg = normCfg(cfg); rec.at = now(); save(); }
    syncGarage();
    var st = stats(cfg);
    if (k === 'tire') toast('🛞 ' + st.t.n + ' 장착!');
    else if (k === 'brake') toast('🛑 ' + st.br.n + ' 장착!');
    else if (k === 'aero') toast(' ' + st.a.n + ' 장착!');
    else if (k === 'power') toast('⚙️ ' + st.p.n + ' 장착!');
    else if (k === 'deco') toast('🎨 ' + st.d.n + ' 적용!');
  }
  function setBrand(bk) {
    if (!BRANDS[bk]) return;
    var first = MODEL_BY_BRAND[bk][0];
    cfg.brand = bk;
    cfg.model = first;
    /* 브랜드 대표 색으로 (사용자가 고른 색이 남아 있어도 브랜드 바꾸면 대표색) */
    cfg.color = BRANDS[bk].color;
    commitCfg();
    renderGarage();
    toast(BRANDS[bk].n + ' ' + MODELS[first].n + ' 선택!');
  }
  function setModel(mk) {
    if (!MODELS[mk]) return;
    cfg.model = mk;
    cfg.brand = MODELS[mk].brand;
    commitCfg();
    renderGarage();
  }
  function commitCfg() {
    var rec = recOf(mid(), true);
    if (rec) { rec.cfg = normCfg(cfg); rec.at = now(); save(); }
  }
  function setColor(v) {
    if (!cfg) cfg = normCfg((recOf(mid(), true) || {}).cfg);
    if (!cfg) return;
    cfg.color = v;
    commitCfg();
    syncGarage();
  }

  /* ---------------- 경기 화면 ---------------- */
  function rivalListHtml() {
    var others = [];
    try { others = (F.members ? F.members() : []).filter(function (m) { return m.id !== mid(); }); } catch (e) {}
    return others.map(function (m) {
      var co = carOfMember(m.id);
      var mm = MODELS[co.cfg.model];
      var best = co.rec && co.rec.best ? fmtMs(co.rec.best) : '';
      return '<button type="button" class="' + (setup.rival === m.id ? 'on' : '') + '" data-mcrival="' + m.id + '">' +
        '<span class="cb">' + (m.emoji || '🧑') + '</span>' +
        '<span class="nm" style="flex:1;min-width:0">' + esc(m.name) + ' · ' + esc(mm ? mm.n : '') +
        '<span class="mc-rtag' + (co.direct ? '' : ' gray') + '">' + (co.direct ? '직접 조립' : '기본 세팅') + '</span>' +
        (best ? '<br><span style="font-size:10px;color:#79838F">최고 랩 ' + best + '</span>' : '') +
        '</span><span style="font-size:16px">' + (setup.rival === m.id ? '✔️' : '⚔️') + '</span></button>';
    }).join('');
  }
  function setupHtml() {
    var st = stats(cfg);
    return '<div class="mc-modebar">' +
      '<button type="button" data-mcmode="solo" class="' + (setup.mode === 'solo' ? 'on' : '') + '">⏱ 타임어택</button>' +
      '<button type="button" data-mcmode="duel" class="' + (setup.mode === 'duel' ? 'on' : '') + '">⚔️ 1:1 대결</button>' +
      '<button type="button" data-mcmode="gp" class="' + (setup.mode === 'gp' ? 'on' : '') + '">🏆 가족 그랑프리</button>' +
      '</div>' +
      '<div class="mc-setupbox">' +
      '<div style="display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:900;color:#3C4450">' +
      '<span>' + esc(st.brand.n) + ' ' + esc(st.model.n) + '</span><span class="mc-rtag">내 차</span>' +
      '<span style="flex:1"></span>' +
      '<button type="button" class="mc-chip' + (setup.laps === 1 ? ' on' : '') + '" data-mclaps="1" style="flex:none;padding:5px 9px">1랩</button>' +
      '<button type="button" class="mc-chip' + (setup.laps === 2 ? ' on' : '') + '" data-mclaps="2" style="flex:none;padding:5px 9px">2랩</button>' +
      '</div>' +
      (setup.mode === 'duel' ? '<div class="mc-rival" style="margin-top:7px">' + rivalListHtml() + '</div>' : '') +
      (setup.mode === 'gp' ? '<div style="margin-top:6px;font-size:10.5px;font-weight:700;color:#79838F">가족 전원(나 포함)이 한 트랙에서 동시에 달려요. 상대는 각자 조립한 차 · 없으면 기본 세팅.</div>' : '') +
      (setup.mode === 'solo' ? '<div style="margin-top:6px;font-size:10.5px;font-weight:700;color:#79838F">혼자 달려 최고 랩타임을 노려요. 기록은 가족 랭킹에 올라가요.</div>' : '') +
      '</div>';
  }
  function renderSetupBar() {
    var bar = $('mcSetupBar');
    if (!bar) return;
    bar.innerHTML = setupHtml();
    var btn = $('mcStart');
    if (btn) btn.textContent = setup.mode === 'solo' ? '🏁 타임어택 시작' : (setup.mode === 'duel' ? '⚔️ 대결 시작' : '🏆 그랑프리 시작');
  }
  function renderRacePane() {
    var box = $('mcRace');
    if (!box) return;
    var rec = recOf(mid(), true);
    var keep = $('mcCanvas');
    if (keep && keep.parentNode) keep.parentNode.removeChild(keep);
    var keep2 = $('mcCanvas2D');
    if (keep2 && keep2.parentNode) keep2.parentNode.removeChild(keep2);
    box.innerHTML =
      '<div id="mcSetupBar"></div>' +
      '<div class="mc-canvas-wrap" id="mcCanvasWrap">' +
      '<canvas id="mcCanvas"></canvas>' +
      '<canvas id="mcCanvas2D"></canvas>' +
      '<div class="mc-hud" id="mcHud"></div>' +
      '<div class="mc-count hidden" id="mcCount"></div>' +
      '</div>' +
      '<div class="mc-ctrl">' +
      '<button type="button" class="mc-btn go" id="mcStart">🏁 출발</button>' +
      '<button type="button" class="mc-btn" id="mcBoost">⚡ 부스트</button>' +
      '<button type="button" class="mc-btn" id="mcL">◀ 인코스</button>' +
      '<button type="button" class="mc-btn" id="mcR">아웃코스 ▶</button>' +
      '</div>' +
      '<button type="button" class="mc-btn back" id="mcBack" style="width:100%;margin-top:6px">🔧 조립으로</button>' +
      '<div class="mc-mode" id="mcMode"></div>' +
      '<div id="mcResultBox"></div>' +
      '<div class="hint" id="mcHint">오르막 위 점프대는 <b>속도가 붙었을 때</b> 활공 점프가 나와요. 커브에서는 인코스로 붙고, 곧은 구간에서 <b>부스트</b>를 쓰면 추월할 수 있어요. 최고 랩타임은 가족 DB에 저장돼요(현재 최고: ' + fmtMs(rec && rec.best) + ').</div>';
    var wrapEl = $('mcCanvasWrap');
    if (wrapEl && keep) wrapEl.insertBefore(keep, wrapEl.firstChild);
    if (wrapEl && keep2) wrapEl.insertBefore(keep2, $('mcHud'));
    hudTxt = ''; lastHud = 0;
    renderSetupBar();
    wireRace();
  }
  function wireRace() {
    var bStart = $('mcStart'), bBoost = $('mcBoost'), bL = $('mcL'), bR = $('mcR'), bBack = $('mcBack');
    if (bStart) bStart.onclick = function () { startRaceFn(); };
    if (bBoost) bBoost.onclick = function () {
      if (!race || race.state !== 'run') { toast('먼저 출발해 주세요'); return; }
      if (race.me.boosts <= 0) { toast('부스트가 없어요 — 다음 랩에 충전돼요'); return; }
      race.me.boosts--; race.me.boostT = 1.6;
    };
    if (bL) bL.onclick = function () { if (race) { race.me.lane = clamp(race.me.lane - 0.32, -1.8, 1.8); race.me.manualT = 2.5; } };
    if (bR) bR.onclick = function () { if (race) { race.me.lane = clamp(race.me.lane + 0.32, -1.8, 1.8); race.me.manualT = 2.5; } };
    if (bBack) bBack.onclick = function () { backToGarage(); };
  }
  function resetRaceState() {
    if (race) { race.state = 'ready'; race.t = 0; race.count = 3; race.results = null; race.rank = 0; }
    var rb = $('mcResultBox');
    if (rb) rb.innerHTML = '';
    var cc = $('mcCount');
    if (cc) { cc.classList.add('hidden'); cc.textContent = ''; }
    var hud = $('mcHud');
    if (hud) hud.innerHTML = '';
    hudTxt = ''; lastHud = 0;
  }
  function startRaceFn() {
    stop3D(); stop2D();
    race = buildRace(setup.mode, setup.rival, setup.laps);
    race.state = 'count'; race.count = 3.2; race.t = 0;
    var rb = $('mcResultBox');
    if (rb) rb.innerHTML = '';
    start2D();
    var cc = $('mcCount');
    if (cc) { cc.classList.remove('hidden'); cc.textContent = '3'; }
    var force2D = /[?&]mc2d=1/.test(String((global.location && global.location.search) || ''));
    if (force2D || !hasWebGL()) { showLayer('2d'); setModeLabel('2d'); return; }
    loadThree(function (err) {
      if (err) { if (mode !== '3d') { showLayer('2d'); setModeLabel('2d'); } return; }
      if (!init3D()) { if (mode !== '3d') { showLayer('2d'); setModeLabel('2d'); } return; }
      stop2D();
      mode = '3d';
      trackG = trackG || null;
      ensureGroups();
      showLayer('3d');
      resize3D();
      setModeLabel('3d');
      if (!raf3) { last3 = 0; raf3 = requestAnimationFrame(loop3D); }
    });
  }
  function renderResult() {
    var box = $('mcResultBox');
    if (!box || !race || !race.results) return;
    var mine = race.results.filter(function (r) { return r.car.isMe; })[0];
    var lapMs = mine && mine.car.best ? mine.car.best : (mine ? Math.round(mine.time * 1000) : 0);
    var medal = ['🏆', '🥈', '🥉', '4️⃣'];
    box.innerHTML =
      '<div class="mc-result">' +
      '<div class="rt">' + resultText() + '</div>' +
      '<div class="rm">' + (mine ? medal[mine.rank - 1] || '' : '') + ' 내 기록 <b>' + fmtMs(lapMs) + '</b> · ' + race.laps + '랩 · ' +
      (setup.mode === 'solo' ? '타임어택' : (setup.mode === 'duel' ? '1:1 대결' : '가족 그랑프리')) + '</div>' +
      race.results.map(function (r) {
        var mm = MODELS[r.car.cfg.model];
        return '<div class="rl' + (r.car.isMe ? ' me' : '') + '"><span class="no">' + r.rank + '</span>' +
          '<span class="nm">' + esc(r.car.name) + ' · ' + esc(mm ? mm.n : '') + '</span>' +
          '<span class="tm">' + fmtMs(Math.round(r.time * 1000)) +
          (r.car.isMe ? '' : (r.gap >= 0 ? ' <span style="color:#C0392B">+' + r.gap.toFixed(2) + 's</span>' : ' <span style="color:#0A7D56">' + r.gap.toFixed(2) + 's</span>')) +
          '</span></div>';
      }).join('') +
      '<div class="rb"><button type="button" class="main" id="mcAgain">🔄 다시 대결</button><button type="button" id="mcToGarage">🔧 조립으로</button></div>' +
      '</div>';
    var again = $('mcAgain'), toG = $('mcToGarage');
    if (again) again.onclick = function () { startRaceFn(); };
    if (toG) toG.onclick = function () { backToGarage(); };
    box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function raceHud(force) {
    var el = $('mcHud');
    if (!el) return;
    var t = now();
    if (!force && t - lastHud < 80) return;
    lastHud = t;
    var cc = $('mcCount');
    if (cc && race) {
      if (race.state === 'count') {
        cc.classList.remove('hidden');
        var n = Math.ceil(race.count - 0.2);
        cc.textContent = n > 0 ? String(Math.min(3, n)) : 'GO!';
      } else if (race.state === 'run') {
        cc.classList.remove('hidden');
        cc.textContent = 'GO!';
        if (race.t > 0.8) cc.classList.add('hidden');
      } else {
        cc.classList.add('hidden');
      }
    }
    if (!race) {
      var st = stats(cfg);
      el.innerHTML = '<span>' + esc(st.model.n) + '</span><span>' + Math.round(st.top) + 'km/h</span>';
      return;
    }
    var meCar = race.me;
    var txt = '<span>' + myRank() + '위/' + race.cars.length + '대</span>' +
      '<span>🏁 ' + Math.min(race.laps, meCar.lap) + '/' + race.laps + '랩</span>' +
      '<span>⏱ ' + fmtMs(Math.round(race.t * 1000)) + '</span>' +
      '<span>' + Math.min(Math.round(meCar.st.top), Math.round(meCar.s * 60)) + ' km/h</span>' +
      '<span>⚡ ' + meCar.boosts + '</span>' +
      (meCar.best ? '<span>🏆 ' + fmtMs(meCar.best) + '</span>' : '');
    if (txt === hudTxt) return;
    hudTxt = txt;
    el.innerHTML = txt;
  }

  function loop3D(ts) {
    raf3 = requestAnimationFrame(loop3D);
    if (!renderer || !scene) { stop3D(); return; }
    if (!paneOn) { stop3D(); return; }
    var dt = Math.min(0.05, (ts - (last3 || ts)) / 1000);
    last3 = ts;
    tick(dt);
    if (race) race.cars.forEach(placeGroup);
    if (camera && race && race.me.group) {
      var cg = race.me.group;
      var back = new THREE.Vector3(0, 0, -1).applyQuaternion(cg.quaternion).multiplyScalar(2.85);
      camera.position.lerp(new THREE.Vector3(cg.position.x + back.x, cg.position.y + 1.15, cg.position.z + back.z), 1 - Math.exp(-6 * dt));
      camera.lookAt(cg.position.x, cg.position.y + 0.15, cg.position.z);
    }
    renderer.render(scene, camera);
    raceHud();
  }
  function stop3D() { if (raf3) { cancelAnimationFrame(raf3); raf3 = 0; } }
  function backToGarage() {
    stop3D(); stop2D();
    mode = 'none';
    race = null;
    if (scene) clearCarGroups();
    showLayer('none');
    var rp = $('mcRace');
    if (rp) rp.classList.add('hidden');
    var gar = $('mcGarage');
    if (gar) gar.classList.remove('hidden');
    renderGarage();
  }

  /* ---------------- 패널 ---------------- */
  function paneHtml() {
    return '<div class="card" id="mcCard" style="padding:12px 12px 14px">' +
      '<div class="card-head" style="margin-bottom:9px"><h2>🏎️ 3D 미니카 · 가족 대결</h2><span class="sub">실차 브랜드·튜닝 → 가족과 경쟁</span></div>' +
      '<div id="mcGarage"></div>' +
      '<div id="mcRace" class="hidden"></div>' +
      '</div>';
  }
  function injectPane() {
    style();
    var view = $('view-play'), nav = $('pgNav');
    if (!view || !nav || $('pgPane-minicar')) return;
    var el = document.createElement('div');
    el.id = 'pgPane-minicar';
    el.className = 'hidden';
    el.innerHTML = paneHtml();
    view.appendChild(el);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-pane', 'minicar');
    btn.textContent = '🏎️ 미니카';
    var qb = nav.querySelector('[data-pane="quiz"]');
    if (qb) nav.insertBefore(btn, qb); else nav.appendChild(btn);
    /* 순서 통일: 3D 놀이터 · 다마고치·내 방 · 미니카 · 퀴즈 … */
    (function () {
      var ORDER = ['3d', 'tama3d', 'minicar', 'quiz', 'card', 'shop', 'yut'];
      var btns = Array.prototype.slice.call(nav.querySelectorAll('[data-pane]'));
      btns.sort(function (a, b) {
        var ia = ORDER.indexOf(a.getAttribute('data-pane')), ib = ORDER.indexOf(b.getAttribute('data-pane'));
        if (ia < 0) ia = 90; if (ib < 0) ib = 90;
        return ia - ib;
      });
      btns.forEach(function (b) { nav.appendChild(b); });
    })();
    el.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var bn = t.closest('[data-mcbrand]');
      if (bn) { setBrand(bn.getAttribute('data-mcbrand')); return; }
      var md = t.closest('[data-mcmodel]');
      if (md) { setModel(md.getAttribute('data-mcmodel')); return; }
      var c = t.closest('[data-mckey]');
      if (c) { setPart(c.getAttribute('data-mckey'), c.getAttribute('data-mcval')); return; }
      var col = t.closest('[data-mccolor]');
      if (col) { setColor(col.getAttribute('data-mccolor')); return; }
      if (t.closest('#mcGo')) {
        var rec = recOf(mid(), true);
        if (rec) { rec.cfg = normCfg(cfg); rec.at = now(); save(); }
        var gar = $('mcGarage');
        if (gar) gar.classList.add('hidden');
        var rp = $('mcRace');
        race = null;
        renderRacePane();
        if (rp) rp.classList.remove('hidden');
        var rb = $('mcRace');
        if (rb) rb.classList.remove('hidden');
        return;
      }
      var mo = t.closest('[data-mcmode]');
      if (mo) {
        setup.mode = mo.getAttribute('data-mcmode');
        if (setup.mode === 'duel' && !setup.rival) {
          var others = [];
          try { others = (F.members ? F.members() : []).filter(function (m) { return m.id !== mid(); }); } catch (er) {}
          if (others[0]) setup.rival = others[0].id;
        }
        resetRaceState();
        renderSetupBar();
        return;
      }
      var rv = t.closest('[data-mcrival]');
      if (rv) { setup.rival = rv.getAttribute('data-mcrival'); renderSetupBar(); return; }
      var lp = t.closest('[data-mclaps]');
      if (lp) { setup.laps = Number(lp.getAttribute('data-mclaps')) || 1; renderSetupBar(); return; }
    });
  }
  function showMine() {
    if (!$('pgPane-minicar') && global.FAM) { if (!ON) mount(global.FAM); else injectPane(); }
    paneOn = true;
    var mine = $('pgPane-minicar');
    if (!mine) return;
    var pg3d = $('pg3dCard');
    if (pg3d) pg3d.classList.add('hidden');
    document.querySelectorAll('#view-play > [id^="pgPane-"]').forEach(function (p) {
      if (p.id !== 'pgPane-minicar') p.classList.add('hidden');
    });
    mine.classList.remove('hidden');
    document.querySelectorAll('#pgNav [data-pane]').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-pane') === 'minicar');
    });
    if (global.FamPlay) global.FamPlay.leave();
    stop3D(); stop2D();
    mode = 'none';
    race = null;
    if (scene) clearCarGroups();
    cfg = normCfg((recOf(mid(), true) || {}).cfg);
    var rp = $('mcRace'), gar = $('mcGarage');
    if (rp) { rp.classList.add('hidden'); }
    if (gar) gar.classList.remove('hidden');
    renderGarage();
  }
  function hideMine() {
    if (!paneOn) return;
    paneOn = false;
    stop3D(); stop2D();
    mode = 'none';
    var mine = $('pgPane-minicar');
    if (mine) mine.classList.add('hidden');
  }

  function mount(FAM) {
    if (ON) return;
    F = FAM; ON = true;
    injectPane();
  }
  setInterval(function () {
    if (!ON && global.FAM && global.FAM.doc && global.FAM.doc() && global.FAM.me && global.FAM.me()) mount(global.FAM);
  }, 1300);

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#pgNav [data-pane]');
    if (!b) return;
    var id = b.getAttribute('data-pane');
    if (id === 'minicar') {
      e.preventDefault(); e.stopPropagation();
      showMine();
    } else {
      hideMine();
    }
  }, true);
  global.addEventListener('resize', function () {
    if (!paneOn) return;
    if (mode === '3d') resize3D();
    else { roadCv = null; if ($('mcCanvas2D') && bind2D()) draw2D(); }
    var pv = $('mcPrev');
    if (pv) drawPreview();
  });

  global.MINICAR3D = {
    show: showMine, hide: hideMine,
    onView: function (v) { if (v !== 'play') hideMine(); },
    _mode: function () { return mode; },
    _cfg: function () { return cfg; },
    _race: function () { return race; },
    _start: function (m, rival, laps) { setup.mode = m || 'solo'; setup.rival = rival || ''; setup.laps = laps || 1; if ($('mcStart')) startRaceFn(); }
  };
})(window);
