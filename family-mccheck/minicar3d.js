/* ============================================================
   우리가족포털 V12 · 🏎️ 3D 미니카 조립 & 트랙 주행 (minicar3d.js)
   - 섀시(차체)·모터(토크/스피드)·기어비·타이어·배터리·롤러/스포일러를
     직접 골라 조립·세팅하고 (부품마다 data-mckey/data-mcval 로 정확히 분리)
   - 조립 화면 상단에 내 미니카의 현재 모습을 즉시 미리보기
   - 3D 입체 트랙(커브·오르막·점프대·랩타임)에서 실제 주행하는 게임
   - WebGL/three.js 를 못 쓰는 환경에서도 2D 캔버스 트랙으로 그려서
     화면이 비거나 검게 멈추는 일이 없다
   - 최고 랩타임·조립 설정은 DOC.v9.minicar (가족 DB · 드라이브 백업 포함)에 저장
   ============================================================ */
(function (global) {
  'use strict';

  var F = null, ON = false, paneOn = false;
  var THREE_SRC = ['../three.min.js', 'https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js'];
  var threeSrcIdx = 0, threeLoading = false, threeQueue = [], threeFailed = false;
  var renderer = null, scene = null, camera = null, raf3 = 0, last3 = 0;
  var raf2 = 0, last2 = 0, ctx2d = null, c2d = null, roadCv = null, roadW = 0, roadH = 0;
  var trackG = null, carG = null, carBuiltCfg = null, curve3 = null;
  var curve = null, trackLen = 0, SEG = 260, HW = 0.85;
  var mode = 'none';                /* '3d' | '2d' | 'none' */
  var lastHud = 0, hudTxt = '';
  var run = { on: false, u: 0, s: 0, y: 0, lane: 0, vy: 0, air: false, lap: 1, lapT: 0, lastLap: 0, best: 0, boosts: 0, boostT: 0, shake: 0 };
  var cfg = null;

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
  function cloneCfg(c) {
    var o = defaultCfg();
    if (!c) return o;
    if (BODIES[c.body]) o.body = c.body;
    if (MOTORS[c.motor]) o.motor = c.motor;
    if (GEARS[c.gear]) o.gear = c.gear;
    if (TIRES[c.tire]) o.tire = c.tire;
    if (BATTS[c.batt]) o.batt = c.batt;
    if (AERO[c.aero]) o.aero = c.aero;
    if (typeof c.color === 'string' && /^#[0-9A-Fa-f]{3,8}$/.test(c.color)) o.color = c.color;
    return o;
  }
  function V9() {
    var D = d();
    if (!D) return null;
    if (!D.v9 || typeof D.v9 !== 'object') D.v9 = {};
    var v = D.v9;
    ['tama', 'room', 'minicar', 'moneyD', 'ddays', 'school', 'goals', 'sleep', 'layout', 'editLog', 'pod', 'archive', 'commute', 'schoolMode'].forEach(function (k) {
      if (!v[k] || typeof v[k] !== 'object') v[k] = {};
    });
    return v;
  }
  function recOf(force) {
    var v = V9();
    if (!v || !mid()) return null;
    var r = v.minicar[mid()];
    if (!r && force) r = v.minicar[mid()] = { cfg: defaultCfg(), best: 0, laps: 0, at: now() };
    if (r && !r.cfg) r.cfg = defaultCfg();
    if (r) r.cfg = cloneCfg(r.cfg);
    return r;
  }
  function fmtMs(ms) {
    if (!ms) return '–';
    var m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), x = Math.floor((ms % 1000) / 10);
    return m + ':' + (s < 10 ? '0' : '') + s + '.' + (x < 10 ? '0' : '') + x;
  }

  /* ---------------- 부품 카탈로그 ---------------- */
  function defaultCfg() {
    return { body: 'sports', color: '#E5484D', motor: 'std', gear: 'bal', tire: 'std', batt: 's', aero: 'none' };
  }
  var BODIES = {
    sports: { n: '스포츠형', w: 0.46, h: 0.11, low: 0.85 },
    off: { n: '오프로드형', w: 0.52, h: 0.16, low: 1.0 },
    classic: { n: '클래식형', w: 0.44, h: 0.15, low: 0.92 }
  };
  var MOTORS = {
    eco: { n: '에코 모터', top: 3.0, acc: 1.4 },
    std: { n: '표준 모터', top: 4.0, acc: 2.0 },
    turbo: { n: '터보 모터', top: 5.0, acc: 2.8 }
  };
  var GEARS = {
    acc: { n: '가속형 기어', accX: 1.4, topX: 0.85 },
    bal: { n: '균형 기어', accX: 1.0, topX: 1.0 },
    top: { n: '최고속 기어', accX: 0.7, topX: 1.18 }
  };
  var TIRES = {
    std: { n: '일반 타이어', grip: 0.75 },
    grip: { n: '그립 타이어', grip: 1.0 },
    off: { n: '오프로드 타이어', grip: 0.6 }
  };
  var BATTS = {
    s: { n: '소형 배터리', nBoost: 2 },
    m: { n: '대용량 배터리', nBoost: 3 },
    l: { n: '레이싱 배터리', nBoost: 5 }
  };
  var AERO = {
    none: { n: '없음', st: 0 },
    roller: { n: '롤러', st: 0.5 },
    spoiler: { n: '스포일러', st: 1.0 }
  };
  var COLORS = ['#E5484D', '#4C8DFF', '#0E9F6E', '#FFC24B', '#8B7CF6', '#F5F7F8', '#2B3138'];
  var PARTS = [
    { k: 'body', lb: '차체', opts: [['sports', '스포츠'], ['off', '오프로드'], ['classic', '클래식']] },
    { k: 'motor', lb: '모터', opts: [['eco', '에코'], ['std', '표준'], ['turbo', '터보']] },
    { k: 'gear', lb: '기어비', opts: [['acc', '가속형'], ['bal', '균형'], ['top', '최고속형']] },
    { k: 'tire', lb: '타이어', opts: [['std', '일반'], ['grip', '그립'], ['off', '오프로드']] },
    { k: 'batt', lb: '배터리', opts: [['s', '소형'], ['m', '대용량'], ['l', '레이싱']] },
    { k: 'aero', lb: '공력', opts: [['none', '없음'], ['roller', '롤러'], ['spoiler', '스포일러']] }
  ];
  function partInfo(k, v) {
    var m = { body: BODIES, motor: MOTORS, gear: GEARS, tire: TIRES, batt: BATTS, aero: AERO }[k];
    return (m && m[v]) || null;
  }

  function stats(c) {
    var cc = c || defaultCfg();
    var m = MOTORS[cc.motor] || MOTORS.std, g = GEARS[cc.gear] || GEARS.bal;
    var t = TIRES[cc.tire] || TIRES.std, b = BODIES[cc.body] || BODIES.sports, a = AERO[cc.aero] || AERO.none;
    return {
      top: m.top * g.topX * b.low,
      acc: m.acc * g.accX,
      grip: t.grip,
      st: a.st,
      boosts: (BATTS[cc.batt] || BATTS.s).nBoost
    };
  }

  /* ---------------- 트랙 (3D·2D 공용 곡선) ---------------- */
  var TRACK_PTS = [
    [-10, 0, -5], [-2, 0, -6.8], [6, 0, -6], [10.5, 0, -3],
    [10, 0, 0.5], [11, 1.1, 3.4], [7, 2.3, 5.6], [2.5, 2.55, 6.4],
    [-2, 1.5, 5.9], [-6, 0.2, 4.6], [-10.5, 0, 2.2], [-11.5, 0, -1.6], [-11, 0, -4.2]
  ];
  var RAMP_U0 = 0.40, RAMP_U1 = 0.455; /* hill top → 점프대 */
  var BBOX = (function () {
    var o = { minx: 1e9, maxx: -1e9, minz: 1e9, maxz: -1e9 };
    TRACK_PTS.forEach(function (p) {
      o.minx = Math.min(o.minx, p[0]); o.maxx = Math.max(o.maxx, p[0]);
      o.minz = Math.min(o.minz, p[2]); o.maxz = Math.max(o.maxz, p[2]);
    });
    return o;
  })();

  /* 닫힌 Catmull-Rom 곡선을 직접 샘플링한다(three.js 없이도 동작) */
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

  function buildTrack() {
    if (!scene || trackG) return;
    curve3 = new THREE.CatmullRomCurve3(TRACK_PTS.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); }), true, 'catmullrom', 0.5);
    var base = curve3, u, i;
    /* 노면 리본 */
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
    /* 노면은 위쪽(0,1,0) 법선으로 고정 — 감기 방향이 뒤집혀도 검게 보이지 않는다 */
    var nrm = new Float32Array(pos.length);
    for (var q = 1; q < nrm.length; q += 3) nrm[q] = 1;
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    trackG = new THREE.Group();
    trackG.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0x5A6470 })));
    /* 가드레일 */
    var railPos = [], railIdx = [];
    for (i = 0; i <= SEG; i++) {
      u = i / SEG;
      var p2 = base.getPointAt(u), t2 = base.getTangentAt(u);
      var nx2 = -t2.z, nz2 = t2.x, nl2 = len2(nx2, nz2); nx2 /= nl2; nz2 /= nl2;
      railPos.push(p2.x + nx2 * (HW + 0.18), p2.y + 0.1, p2.z + nz2 * (HW + 0.18));
      railPos.push(p2.x - nx2 * (HW + 0.18), p2.y + 0.1, p2.z - nz2 * (HW + 0.18));
      if (i < SEG) { var b = i * 2; railIdx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    var g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', new THREE.Float32BufferAttribute(railPos, 3));
    g2.setIndex(railIdx);
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
    /* 잔디 바닥 + 나무 */
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

  /* ---------------- 차 만들기 ---------------- */
  function buildCar(c) {
    var B = BODIES[c.body] || BODIES.sports;
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(B.w, B.h, 0.82), new THREE.MeshLambertMaterial({ color: c.color }));
    body.position.y = 0.16; g.add(body);
    var cab = new THREE.Mesh(new THREE.BoxGeometry(B.w * 0.7, 0.1, 0.36), new THREE.MeshLambertMaterial({ color: 0xBFE3F5 }));
    cab.position.set(0, 0.27, -0.03); g.add(cab);
    if (c.aero === 'spoiler') {
      var sp = new THREE.Mesh(new THREE.BoxGeometry(B.w * 0.9, 0.03, 0.14), new THREE.MeshLambertMaterial({ color: 0x2B3138 }));
      sp.position.set(0, 0.34, -0.38); g.add(sp);
      [-0.16, 0.16].forEach(function (x) {
        var st = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.03), new THREE.MeshLambertMaterial({ color: 0x2B3138 }));
        st.position.set(x, 0.28, -0.38); g.add(st);
      });
    }
    if (c.aero === 'roller') {
      var rl = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, B.w * 0.8, 10), new THREE.MeshLambertMaterial({ color: 0xFFC24B }));
      rl.rotation.z = Math.PI / 2; rl.position.set(0, 0.06, 0.44); g.add(rl);
    }
    /* 배터리(뒤쪽 박스) — 부품 선택이 눈에 보이게 */
    var bat = BATTS[c.batt] || BATTS.s;
    var batBox = new THREE.Mesh(new THREE.BoxGeometry(B.w * 0.42, 0.05, 0.16), new THREE.MeshLambertMaterial({ color: bat.nBoost >= 5 ? 0xE5484D : (bat.nBoost >= 3 ? 0x4C8DFF : 0x9AA4AF) }));
    batBox.position.set(0, 0.23, -0.34); g.add(batBox);
    var tire = c.tire || 'std';
    var wg = new THREE.CylinderGeometry(tire === 'off' ? 0.13 : 0.11, tire === 'off' ? 0.13 : 0.11, 0.07, 12);
    var wm = new THREE.MeshLambertMaterial({ color: tire === 'grip' ? 0x111417 : 0x22262B });
    var wheels = [];
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(function (p) {
      var w = new THREE.Mesh(wg, wm);
      w.rotation.z = Math.PI / 2;
      w.position.set(p[0] * (B.w / 2 + 0.02), tire === 'off' ? 0.13 : 0.11, p[1] * 0.28);
      g.add(w); wheels.push(w);
    });
    g.userData.wheels = wheels;
    return g;
  }

  /* ---------------- three.js 로드 (대기 큐 + CDN 폴백) ---------------- */
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
    if (threeLoading) return;         /* 로딩 중이어도 콜백을 버리지 않고 큐에 쌓는다 */
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
    trackG = null; carG = null; carBuiltCfg = null; curve3 = null;
  }
  function init3D() {
    var cv = $('mcCanvas');
    if (!cv || !global.THREE || !global.THREE.WebGLRenderer) return false;
    if (renderer) {
      if (renderer.domElement === cv) { resize3D(); return true; }
      dispose3D();                     /* 새 캔버스로 바뀌었으면 옛 renderer를 버리고 다시 만든다 */
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
      global.__MC3D = { scene: scene, camera: camera, renderer: renderer, THREE: THREE };
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
  function ensureCar() {
    if (!cfg) return;
    var key = JSON.stringify(cfg);
    if (carG && carBuiltCfg === key) return;
    if (carG) { try { scene.remove(carG); } catch (e) {} }
    carG = buildCar(cfg);
    carBuiltCfg = key;
    scene.add(carG);
    placeCar();
  }

  /* ---------------- 2D 폴백 (three.js 없이도 즉시 그린다) ---------------- */
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
    /* 잔디 */
    var gd = x.createLinearGradient(0, 0, 0, h);
    gd.addColorStop(0, '#A7D492');
    gd.addColorStop(1, '#8FC181');
    x.fillStyle = gd;
    x.fillRect(0, 0, w, h);
    /* 나무 */
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
    /* 출발선 체커 */
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
  function draw2D() {
    if (!ctx2d || !cfg) return;
    if (!roadCv || roadW !== c2d.w || roadH !== c2d.h) buildRoad2D();
    var w = c2d.w, h = c2d.h;
    ctx2d.clearRect(0, 0, w, h);
    if (roadCv) ctx2d.drawImage(roadCv, 0, 0, w, h);
    var u = ((run.u % 1) + 1) % 1;
    var p = curve.getPointAt(u), t = curve.getTangentAt(u);
    var nx = -t.z, nz = t.x, nl = len2(nx, nz); nx /= nl; nz /= nl;
    var q = proj2D({ x: p.x + nx * run.lane * 0.5, z: p.z + nz * run.lane * 0.5 }, w, h);
    var ang = Math.atan2(t.z, t.x);
    var L = Math.max(13, 1.15 * q.s), Wd = Math.max(8, 0.62 * q.s);
    ctx2d.save();
    ctx2d.translate(q.x, q.y);
    ctx2d.rotate(ang);
    if (run.air) ctx2d.translate(0, -Math.max(2, q.s * 0.25));
    ctx2d.fillStyle = 'rgba(20,30,40,.18)';
    ctx2d.beginPath();
    ctx2d.ellipse(0, Wd * 0.15, L * 0.55, Wd * 0.42, 0, 0, Math.PI * 2);
    ctx2d.fill();
    /* 타이어 */
    var tire = cfg.tire || 'std';
    ctx2d.fillStyle = tire === 'grip' ? '#111417' : '#22262B';
    var tw = Math.max(3, Wd * 0.3), tl = Math.max(5, L * 0.22);
    [[-L * 0.30, -Wd * 0.52], [L * 0.26, -Wd * 0.52], [-L * 0.30, Wd * 0.52], [L * 0.26, Wd * 0.52]].forEach(function (o) {
      ctx2d.fillRect(o[0] - tl / 2, o[1] - tw / 2, tl, tw);
    });
    /* 차체 */
    ctx2d.fillStyle = cfg.color || '#E5484D';
    rrect(ctx2d, -L / 2, -Wd / 2, L, Wd, Wd * 0.34);
    ctx2d.fill();
    ctx2d.fillStyle = 'rgba(255,255,255,.22)';
    rrect(ctx2d, -L * 0.42, -Wd * 0.42, L * 0.8, Wd * 0.3, Wd * 0.2);
    ctx2d.fill();
    /* 앞유리 */
    ctx2d.fillStyle = 'rgba(28,42,56,.55)';
    rrect(ctx2d, L * 0.02, -Wd * 0.34, L * 0.24, Wd * 0.68, Wd * 0.16);
    ctx2d.fill();
    /* 스포일러 */
    if (cfg.aero === 'spoiler') {
      ctx2d.fillStyle = '#2B3138';
      ctx2d.fillRect(-L / 2 - Math.max(2, L * 0.06), -Wd * 0.62, Math.max(3, L * 0.1), Wd * 1.24);
    }
    if (cfg.aero === 'roller') {
      ctx2d.fillStyle = '#FFC24B';
      ctx2d.beginPath(); ctx2d.arc(L * 0.5, 0, Math.max(2.5, Wd * 0.22), 0, Math.PI * 2); ctx2d.fill();
    }
    ctx2d.restore();
    /* 모드 표시 */
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
    step(dt);
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
  function curveY(u) { return drv().getPointAt(u).y; }
  function slopeAt(u) {
    var e = 0.004;
    return (curveY(u + e) - curveY(u - e)) / (2 * e * trackLen);
  }
  function curveCurvature(u) {
    var e = 0.02, c = drv();
    var a = c.getTangentAt(u - e), b = c.getTangentAt(u + e);
    var cross = a.x * b.z - a.z * b.x, dot = a.x * b.x + a.z * b.z;
    return Math.atan2(cross, dot) / (2 * e * trackLen);   /* 부호 유지: 바깥으로 밀림 */
  }
  function step(dt) {
    if (!run.on || !curve) return;
    var st = stats(cfg);
    var boost = run.boostT > 0;
    var top = st.top * (boost ? 1.45 : 1);
    var acc = st.acc * (boost ? 1.8 : 1);
    run.s += acc * dt;
    if (run.s > top) run.s -= (run.s - top) * Math.min(1, dt * 3);
    run.s = Math.max(0, run.s);
    run.boostT = Math.max(0, run.boostT - dt);

    var u = run.u;
    var curv = curveCurvature(u);
    var drift = curv * run.s * run.s * 0.16 * (1.25 - st.grip) * (1 - st.st * 0.45);
    run.lane = clamp(run.lane + drift * dt, -1.3, 1.3);
    var offRoad = Math.abs(run.lane) > 1.28;
    if (offRoad) run.s *= 1 - Math.min(0.9, dt * 2.2);
    run.shake = offRoad ? 1 : Math.max(0, run.shake - dt * 3);

    if (!run.air) {
      var sl = slopeAt(u);
      run.u += (run.s / trackLen) * dt * (1 / Math.max(0.45, Math.cos(sl * 1.2)));
      if (u >= RAMP_U0 && u < RAMP_U1 && sl < -0.05 && run.s > 2.4) {
        run.air = true;
        run.vy = run.s * 0.42;
      }
      run.y = curveY(run.u);
    } else {
      run.u += (run.s * 0.94 / trackLen) * dt;
      run.vy -= 9.8 * dt * 0.55;
      run.y += run.vy * dt;
      var gy = curveY(run.u);
      if (run.y <= gy) { run.y = gy; run.air = false; run.vy = 0; toast('🛬 착지!'); }
    }

    if (run.u >= 1) {
      run.u -= 1;
      var lapMs = Math.round(run.lapT * 1000);
      run.lastLap = lapMs;
      if (!run.best || lapMs < run.best) {
        run.best = lapMs;
        var rec = recOf(true);
        if (rec && (!rec.best || lapMs < rec.best)) {
          rec.best = lapMs; rec.cfg = cloneCfg(cfg); rec.at = now();
          save();
          toast('🏁 신기록! 최고 랩 ' + fmtMs(lapMs));
        }
      }
      run.lap++;
      run.lapT = 0;
      run.boosts = st.boosts;
    }
    run.lapT += dt;
  }
  function placeCar() {
    if (!carG || !curve) return;
    var u = ((run.u % 1) + 1) % 1;
    var p = drv().getPointAt(u), t = drv().getTangentAt(u);
    var nx = -t.z, nz = t.x, nl = len2(nx, nz); nx /= nl; nz /= nl;
    var y = run.air ? run.y : p.y;
    carG.position.set(p.x + nx * run.lane * 0.5, y + 0.02 + run.shake * Math.sin(now() * 0.06) * 0.03, p.z + nz * run.lane * 0.5);
    carG.rotation.y = Math.atan2(t.x, t.z) + run.lane * 0.35 + run.shake * Math.sin(now() * 0.05) * 0.05;
    carG.rotation.x = run.air ? clamp(-run.vy * 0.15, -0.5, 0.5) : 0;
    var wl = carG.userData.wheels;
    if (wl) { var spin = run.s * 4 * 0.016; for (var i = 0; i < wl.length; i++) wl[i].rotation.x += spin; }
  }
  function loop3D(ts) {
    raf3 = requestAnimationFrame(loop3D);
    if (!renderer || !scene) { stop3D(); return; }
    if (!paneOn) { stop3D(); return; }
    var dt = Math.min(0.05, (ts - (last3 || ts)) / 1000);
    last3 = ts;
    step(dt);
    placeCar();
    if (carG && camera) {
      var back = new THREE.Vector3(0, 0, -1).applyQuaternion(carG.quaternion).multiplyScalar(6.2);
      camera.position.lerp(new THREE.Vector3(carG.position.x + back.x, carG.position.y + 3.6, carG.position.z + back.z), 1 - Math.exp(-6 * dt));
      camera.lookAt(carG.position.x, carG.position.y + 0.5, carG.position.z);
    }
    renderer.render(scene, camera);
    raceHud();
  }
  function stop3D() { if (raf3) { cancelAnimationFrame(raf3); raf3 = 0; } }
  function raceHud() {
    var el = $('mcHud');
    if (!el) return;
    var t = now();
    if (t - lastHud < 90) return;
    lastHud = t;
    var txt = '<span>⏱ ' + fmtMs(Math.round(run.lapT * 1000)) + '</span>' +
      '<span>🏆 ' + fmtMs(run.best) + '</span>' +
      '<span>' + Math.round(run.s * 30) + ' km/h</span>' +
      '<span>' + run.lap + '바퀴</span>' +
      '<span>⚡ ' + run.boosts + '</span>';
    if (txt === hudTxt) return;
    hudTxt = txt;
    el.innerHTML = txt;
  }

  /* ---------------- 미리보기 (조립 화면 상단 · 항상 즉시 그려진다) ---------------- */
  function drawPreview() {
    var cv = $('mcPrev');
    if (!cv || !cfg) return;
    var wrap = cv.parentNode;
    var W = (wrap && wrap.clientWidth) || 300, H = (wrap && wrap.clientHeight) || 150;
    if (W < 60) W = 300;
    if (H < 60) H = 150;
    var dpr = Math.min(2, global.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    var x = cv.getContext('2d');
    if (!x) return;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, W, H);

    var k = Math.min(W / 320, H / 150);
    var fy = H * 0.80;
    var gd = x.createLinearGradient(0, 0, 0, H);
    gd.addColorStop(0, '#EAF5FF');
    gd.addColorStop(0.66, '#F5FAFF');
    gd.addColorStop(1, '#E7EFE9');
    x.fillStyle = gd;
    x.fillRect(0, 0, W, H);

    var B = BODIES[cfg.body] || BODIES.sports;
    var hh = { sports: 0.82, off: 1.08, classic: 1.0 }[cfg.body] || 0.9;
    var L = 168 * k * (cfg.body === 'off' ? 1.04 : (cfg.body === 'classic' ? 0.96 : 1));
    var Ht = 30 * k * hh;
    var off = cfg.tire === 'off';
    var R = (off ? 15 : 13) * k;
    var wheelY = fy - R;
    var bodyBot = wheelY - R * 0.10;
    var bodyTop = bodyBot - Ht;
    var bx = W / 2 - L / 2;
    var col = cfg.color || '#E5484D';

    /* 그림자 */
    x.fillStyle = 'rgba(22,34,46,.14)';
    x.beginPath();
    x.ellipse(W / 2, fy - R * 0.05, L * 0.46, R * 0.5, 0, 0, Math.PI * 2);
    x.fill();

    /* 차체 */
    var bg = x.createLinearGradient(0, bodyTop, 0, bodyBot);
    bg.addColorStop(0, shade(col, 1.28));
    bg.addColorStop(0.55, col);
    bg.addColorStop(1, shade(col, 0.72));
    x.fillStyle = bg;
    rrect(x, bx, bodyTop, L, Ht, Ht * 0.38);
    x.fill();
    x.strokeStyle = 'rgba(20,28,36,.18)';
    x.lineWidth = 1;
    x.stroke();

    /* 캐빈(지붕) */
    var rw = L * 0.46, rh = 17 * k * (cfg.body === 'classic' ? 1.3 : 1);
    var rx = W / 2 - rw / 2 - L * 0.03;
    var ry = bodyTop - rh * 0.92;
    x.fillStyle = shade(col, 1.12);
    x.beginPath();
    x.moveTo(rx, bodyTop + 2);
    x.lineTo(rx + rw * 0.12, ry);
    x.lineTo(rx + rw * 0.88, ry);
    x.lineTo(rx + rw, bodyTop + 2);
    x.closePath();
    x.fill();
    /* 유리창 */
    x.fillStyle = 'rgba(150,205,235,.92)';
    x.beginPath();
    x.moveTo(rx + rw * 0.16, ry + rh * 0.22);
    x.lineTo(rx + rw * 0.84, ry + rh * 0.22);
    x.lineTo(rx + rw * 0.9, bodyTop - 1);
    x.lineTo(rx + rw * 0.1, bodyTop - 1);
    x.closePath();
    x.fill();
    x.strokeStyle = shade(col, 0.7);
    x.lineWidth = Math.max(1, 1.4 * k);
    x.beginPath();
    x.moveTo(rx + rw * 0.5, ry + rh * 0.2);
    x.lineTo(rx + rw * 0.5, bodyTop - 1);
    x.stroke();

    /* 스포일러 */
    if (cfg.aero === 'spoiler') {
      x.fillStyle = '#2B3138';
      x.fillRect(bx + 5 * k, bodyTop - 9 * k, 3.5 * k, 11 * k);
      rrect(x, bx - 6 * k, bodyTop - 13 * k, 24 * k, 5 * k, 2 * k);
      x.fill();
    }
    if (cfg.aero === 'roller') {
      x.fillStyle = '#FFC24B';
      x.beginPath(); x.arc(bx + L - 6 * k, fy - 7 * k, 7 * k, 0, Math.PI * 2); x.fill();
      x.strokeStyle = '#C98F17'; x.lineWidth = 1.2; x.stroke();
    }

    /* 헤드·테일 램프 */
    x.fillStyle = '#FFF1C9';
    rrect(x, bx + L - 9 * k, bodyTop + Ht * 0.28, 6 * k, Ht * 0.3, 2 * k); x.fill();
    x.fillStyle = '#E5484D';
    rrect(x, bx + 3 * k, bodyTop + Ht * 0.3, 5 * k, Ht * 0.26, 2 * k); x.fill();

    /* 타이어 */
    var wheelXs = [bx + L * 0.20, bx + L * 0.80];
    wheelXs.forEach(function (wx) {
      x.fillStyle = off ? '#171B1F' : (cfg.tire === 'grip' ? '#101317' : '#23272C');
      x.beginPath(); x.arc(wx, wheelY, R, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#B9C2CA';
      x.beginPath(); x.arc(wx, wheelY, R * 0.46, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#7C8794';
      x.beginPath(); x.arc(wx, wheelY, R * 0.2, 0, Math.PI * 2); x.fill();
      if (cfg.tire === 'grip') {
        x.strokeStyle = 'rgba(255,255,255,.45)';
        x.lineWidth = Math.max(1, 1.2 * k);
        for (var i = 0; i < 6; i++) {
          var a1 = i / 6 * Math.PI * 2;
          x.beginPath();
          x.moveTo(wx + Math.cos(a1) * R * 0.6, wheelY + Math.sin(a1) * R * 0.6);
          x.lineTo(wx + Math.cos(a1) * R * 0.95, wheelY + Math.sin(a1) * R * 0.95);
          x.stroke();
        }
      } else if (off) {
        x.fillStyle = 'rgba(255,255,255,.35)';
        for (var j = 0; j < 10; j++) {
          var a2 = j / 10 * Math.PI * 2;
          x.beginPath();
          x.arc(wx + Math.cos(a2) * R * 0.78, wheelY + Math.sin(a2) * R * 0.78, Math.max(1, R * 0.14), 0, Math.PI * 2);
          x.fill();
        }
      }
    });

    /* 부품 이름 */
    var bn = (BODIES[cfg.body] || BODIES.sports).n;
    var mn = (MOTORS[cfg.motor] || MOTORS.std).n;
    var gn = (GEARS[cfg.gear] || GEARS.bal).n;
    var tn = (TIRES[cfg.tire] || TIRES.std).n;
    var an = (AERO[cfg.aero] || AERO.none).n;
    x.fillStyle = 'rgba(38,52,64,.62)';
    x.font = '700 ' + Math.max(9, 10 * k) + 'px -apple-system,system-ui,sans-serif';
    x.textAlign = 'left';
    x.fillText(bn + ' · ' + mn + ' · ' + gn, 10, H - 24);
    x.fillStyle = 'rgba(38,52,64,.45)';
    x.fillText(tn + ' · 공력 ' + an, 10, H - 10);
  }
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

  /* ---------------- 스타일 ---------------- */
  function style() {
    if ($('mcstyle')) return;
    var s = document.createElement('style');
    s.id = 'mcstyle';
    s.textContent = [
      '.mc-sec{font-size:13px;font-weight:900;color:#2A323B;margin:2px 0 7px;letter-spacing:-.2px}',
      '.mc-prev{position:relative;width:100%;height:150px;border-radius:14px;overflow:hidden;background:linear-gradient(180deg,#EAF5FF,#F5FAFF);border:1px solid #E4ECF3;margin:0 0 9px}',
      '.mc-prev canvas{display:block;width:100%;height:100%}',
      '.mc-optrow{display:flex;align-items:center;gap:5px;margin:5px 0}',
      '.mc-lb{flex:none;width:44px;font-size:11px;font-weight:800;color:#79838F}',
      '.mc-chip{flex:1 1 0;min-width:0;padding:8px 2px;border-radius:11px;background:#F3F6F8;border:1.5px solid transparent;font-size:11.5px;font-weight:800;color:#5C6673;white-space:nowrap;text-align:center;transition:.14s}',
      '.mc-chip.on{background:#E7F8F1;border-color:#0E9F6E;color:#0B7A54;box-shadow:0 2px 8px rgba(14,159,110,.18)}',
      '.mc-chip:active{transform:scale(.97)}',
      '.mc-color{flex:none;width:26px;height:26px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1.5px rgba(60,72,84,.32),inset 0 0 0 1px rgba(40,50,60,.18);transition:.14s}',
      '.mc-color.on{box-shadow:0 0 0 2.5px #0E9F6E}',
      '.mc-stats{margin-top:9px;padding:9px 10px;border-radius:12px;background:#F7FAFC;border:1px solid #E6EDF2;font-size:11px;font-weight:700;color:#4E5A66;line-height:1.6}',
      '.mc-stats b{color:#0B7A54;font-weight:900}',
      '.mc-canvas-wrap{position:relative;width:100%;height:270px;min-height:270px;border-radius:14px;overflow:hidden;background:linear-gradient(#CDE8FF,#EAF6FF);touch-action:none}',
      '.mc-canvas-wrap canvas{display:block;position:absolute;left:0;top:0;width:100%;height:100%}',
      '.mc-hud{position:absolute;z-index:3;left:8px;right:8px;top:8px;display:flex;gap:5px;flex-wrap:wrap;font-size:10.5px;font-weight:900;color:#20303C;pointer-events:none}',
      '.mc-hud span{background:rgba(255,255,255,.87);padding:3px 8px;border-radius:20px;box-shadow:0 1px 5px rgba(20,30,40,.12)}',
      '.mc-ctrl{display:grid;grid-template-columns:1.4fr 1fr;gap:6px;margin-top:9px}',
      '.mc-btn{padding:11px 6px;border-radius:12px;background:#F1F4F5;font-size:12px;font-weight:800;color:#3C4450;border:0}',
      '.mc-btn:active{transform:scale(.98)}',
      '.mc-btn.go{background:#0E9F6E;color:#fff}',
      '.mc-btn.back{background:#E7EEF3;color:#4A5662}',
      '.mc-mode{margin-top:6px;font-size:10px;font-weight:700;color:#93A0AC;text-align:right}'
    ].join('\n');
    document.head.appendChild(s);
  }
  function setModeLabel(m) {
    var el = $('mcMode');
    if (!el) return;
    el.textContent = m === '3d' ? '🧊 3D 화면' : (m === '2d' ? '🗺️ 간이 2D 화면 (WebGL 미지원 기기)' : '');
  }

  /* ---------------- UI ---------------- */
  function chipRow(p, cur) {
    return '<div class="mc-optrow"><span class="mc-lb">' + p.lb + '</span>' + p.opts.map(function (o) {
      return '<button type="button" class="mc-chip' + (cur === o[0] ? ' on' : '') + '" data-mckey="' + p.k + '" data-mcval="' + o[0] + '">' + o[1] + '</button>';
    }).join('') + '</div>';
  }
  function statsHtml() {
    var st = stats(cfg);
    return '⚡ 최고속 <b>' + (st.top * 30).toFixed(0) + 'km/h</b> · 가속 <b>' + st.acc.toFixed(1) + '</b> · 그립 <b>' +
      Math.round(st.grip * 100) + '%</b> · 안정 <b>' + Math.round(st.st * 100) + '%</b> · 부스트 <b>' + st.boosts + '회</b>';
  }
  function renderGarage() {
    var box = $('mcGarage');
    if (!box) return;
    var rec = recOf(true);
    if (!cfg) cfg = cloneCfg(rec && rec.cfg);
    box.innerHTML =
      '<div class="mc-sec">🔧 나만의 미니카 조립</div>' +
      '<div class="mc-prev"><canvas id="mcPrev"></canvas></div>' +
      PARTS.slice(0, 1).map(function (p) { return chipRow(p, cfg[p.k]); }).join('') +
      '<div class="mc-optrow"><span class="mc-lb">색상</span>' + COLORS.map(function (c) {
        return '<button type="button" class="mc-color' + (cfg.color === c ? ' on' : '') + '" data-mccolor="' + c + '" style="background:' + c + '"></button>';
      }).join('') + '</div>' +
      PARTS.slice(1).map(function (p) { return chipRow(p, cfg[p.k]); }).join('') +
      '<div class="mc-stats" id="mcStats">' + statsHtml() + '</div>' +
      '<button type="button" class="btn" id="mcGo" style="margin-top:10px">🏁 이 차로 주행 시작</button>';
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
    var stEl = $('mcStats');
    if (stEl) stEl.innerHTML = statsHtml();
    drawPreview();
  }
  function setPart(k, v) {
    if (!cfg) cfg = cloneCfg((recOf(true) || {}).cfg);
    if (!cfg || cfg[k] === v) { syncGarage(); return; }
    cfg[k] = v;
    var rec = recOf(true);
    if (rec) { rec.cfg = cloneCfg(cfg); rec.at = now(); save(); }
    syncGarage();
    var info = partInfo(k, v);
    if (info && (k === 'motor' || k === 'tire' || k === 'body')) toast('🔧 ' + info.n + ' 장착!');
  }
  function setColor(v) {
    if (!cfg) cfg = cloneCfg((recOf(true) || {}).cfg);
    if (!cfg) return;
    cfg.color = v;
    var rec = recOf(true);
    if (rec) { rec.cfg = cloneCfg(cfg); rec.at = now(); save(); }
    syncGarage();
  }
  function renderRacePane() {
    var box = $('mcRace');
    if (!box) return;
    var rec = recOf(true);
    /* 새 캔버스를 만들지 않고 기존 캔버스 DOM을 그대로 옮겨 쓴다(renderer 재사용) */
    var keep = $('mcCanvas');
    if (keep && keep.parentNode) keep.parentNode.removeChild(keep);
    var keep2 = $('mcCanvas2D');
    if (keep2 && keep2.parentNode) keep2.parentNode.removeChild(keep2);
    box.innerHTML =
      '<div class="mc-canvas-wrap" id="mcCanvasWrap">' +
      '<canvas id="mcCanvas"></canvas>' +
      '<canvas id="mcCanvas2D"></canvas>' +
      '<div class="mc-hud" id="mcHud"></div>' +
      '</div>' +
      '<div class="mc-ctrl">' +
      '<button type="button" class="mc-btn go" id="mcRun">▶ 출발</button>' +
      '<button type="button" class="mc-btn" id="mcBoost">⚡ 부스트</button>' +
      '<button type="button" class="mc-btn" id="mcL">◀ 차선</button>' +
      '<button type="button" class="mc-btn" id="mcR">차선 ▶</button>' +
      '</div>' +
      '<button type="button" class="mc-btn back" id="mcBack" style="width:100%;margin-top:6px">🔧 조립으로</button>' +
      '<div class="mc-mode" id="mcMode"></div>' +
      '<div class="hint">오르막 위 점프대는 <b>속도가 붙었을 때</b> 활공 점프가 나와요. 커브에서는 차선 이동(◀ ▶)으로 안쪽을 타세요. 최고 랩타임은 가족 DB에 저장돼요(현재 최고: ' + fmtMs(rec && rec.best) + ').</div>';
    var wrapEl = $('mcCanvasWrap');
    if (wrapEl && keep) wrapEl.insertBefore(keep, wrapEl.firstChild);
    if (wrapEl && keep2) wrapEl.insertBefore(keep2, $('mcHud'));
    hudTxt = ''; lastHud = 0;
    wireRace();
  }
  function wireRace() {
    var bRun = $('mcRun'), bBoost = $('mcBoost'), bL = $('mcL'), bR = $('mcR'), bBack = $('mcBack');
    if (bRun) bRun.onclick = function () {
      run.on = !run.on;
      if (run.on && run.boosts <= 0) run.boosts = stats(cfg).boosts;
      this.textContent = run.on ? '⏸ 정지' : '▶ 출발';
      this.classList.toggle('go', !run.on);
    };
    if (bBoost) bBoost.onclick = function () {
      if (!run.on) { toast('먼저 출발해 주세요'); return; }
      if (run.boosts <= 0) { toast('부스트가 없어요 — 다음 랩에 충전돼요'); return; }
      run.boosts--; run.boostT = 1.6;
    };
    if (bL) bL.onclick = function () { run.lane = clamp(run.lane - 0.28, -1.4, 1.4); };
    if (bR) bR.onclick = function () { run.lane = clamp(run.lane + 0.28, -1.4, 1.4); };
    if (bBack) bBack.onclick = function () { backToGarage(); };
  }
  function startRace() {
    stop();
    start2D();                                  /* 먼저 2D로 즉시 그려 화면이 비지 않게 */
    if (!hasWebGL()) { setModeLabel('2d'); return; }
    loadThree(function (err) {
      if (err) { if (mode !== '3d') { showLayer('2d'); setModeLabel('2d'); } return; }
      if (!init3D()) { if (mode !== '3d') { showLayer('2d'); setModeLabel('2d'); } return; }
      stop2D();
      mode = '3d';
      showLayer('3d');
      ensureCar();
      resize3D();
      setModeLabel('3d');
      if (!raf3) { last3 = 0; raf3 = requestAnimationFrame(loop3D); }
    });
  }
  function stop() {
    run.on = false;
    run.u = 0; run.s = 0; run.lane = 0; run.air = false; run.vy = 0;
    run.lap = 1; run.lapT = 0; run.lastLap = 0; run.boostT = 0;
    run.best = 0;
    var rec = recOf(false);
    if (rec && rec.best) run.best = rec.best;
    if (cfg) run.boosts = stats(cfg).boosts;
    var b = $('mcRun');
    if (b) { b.textContent = '▶ 출발'; b.classList.add('go'); }
  }
  function backToGarage() {
    stop3D(); stop2D();
    mode = 'none';
    showLayer('none');
    var race = $('mcRace');
    if (race) race.classList.add('hidden');
    var gar = $('mcGarage');
    if (gar) gar.classList.remove('hidden');
    renderGarage();
  }

  /* ---------------- 패널 ---------------- */
  function paneHtml() {
    return '<div class="card" id="mcCard" style="padding:12px 12px 14px">' +
      '<div class="card-head" style="margin-bottom:9px"><h2>🏎️ 3D 미니카 조립 &amp; 트랙 주행</h2><span class="sub">부품 골라 조립 → 커브·오르막·점프대 주행</span></div>' +
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
    nav.appendChild(btn);
    el.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var c = t.closest('[data-mckey]');
      if (c) { setPart(c.getAttribute('data-mckey'), c.getAttribute('data-mcval')); return; }
      var col = t.closest('[data-mccolor]');
      if (col) { setColor(col.getAttribute('data-mccolor')); return; }
      if (t.closest('#mcGo')) {
        var rec = recOf(true);
        if (rec) { rec.cfg = cloneCfg(cfg); rec.at = now(); save(); }
        var gar = $('mcGarage');
        if (gar) gar.classList.add('hidden');
        renderRacePane();
        var race = $('mcRace');
        if (race) race.classList.remove('hidden');
        startRace();
        return;
      }
    });
  }
  function showMine() {
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
    cfg = cloneCfg((recOf(true) || {}).cfg);
    var race = $('mcRace'), gar = $('mcGarage');
    if (race) race.classList.add('hidden');
    if (gar) gar.classList.remove('hidden');
    renderGarage();
  }
  function hideMine() {
    if (!paneOn) return;
    paneOn = false;
    stop3D(); stop2D();
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
  });

  global.MINICAR3D = {
    show: showMine, hide: hideMine,
    onView: function (v) { if (v !== 'play') hideMine(); },
    _mode: function () { return mode; },
    _cfg: function () { return cfg; }
  };
})(window);
