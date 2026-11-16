/* ============================================================
   우리가족포털 V9 · 🏎️ 3D 미니카 조립 & 트랙 주행 (minicar3d.js)
   - 섀시(차체)·모터(토크/스피드)·기어비·타이어·배터리·롤러/스포일러를
     직접 골라 조립·세팅하고
   - 3D 입체 트랙(커브·오르막·점프대·랩타임)에서 실제 주행하는 게임
   - 최고 랩타임은 DOC.v9.minicar (가족 DB · 드라이브 백업 포함)에 저장
   ============================================================ */
(function (global) {
  'use strict';

  var F = null, ON = false;
  var THREE_URL = '../three.min.js';
  var paneOn = false, threeLoading = false;
  var renderer = null, scene = null, camera = null, raf = 0, last = 0;
  var trackG = null, carG = null, carBuiltCfg = null;
  var curve = null, trackLen = 0, SEG = 260, HW = 1.05;
  var run = { on: false, u: 0, s: 0, lane: 0, vy: 0, air: false, lap: 1, lapT: 0, best: 0, boosts: 0, boostT: 0, shake: 0 };
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
    return r;
  }
  function fmtMs(ms) {
    if (!ms) return '–';
    var m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), x = Math.floor((ms % 1000) / 10);
    return m + ':' + (s < 10 ? '0' : '') + s + '.' + (x < 10 ? '0' : '') + x;
  }

  /* ---------------- 부품 카탈로그 ---------------- */
  function defaultCfg() {
    return { body: 'sports', color: '#E5484D', motor: 'std', gear: 'bal', tire: 'std', batt: 'std', aero: 'none' };
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

  function stats(c) {
    var m = MOTORS[c.motor] || MOTORS.std, g = GEARS[c.gear] || GEARS.bal;
    var t = TIRES[c.tire] || TIRES.std, b = BODIES[c.body] || BODIES.sports, a = AERO[c.aero] || AERO.none;
    return {
      top: m.top * g.topX * b.low,
      acc: m.acc * g.accX,
      grip: t.grip,
      st: a.st,
      boosts: (BATTS[c.batt] || BATTS.s).nBoost
    };
  }

  /* ---------------- 트랙 ---------------- */
  var TRACK_PTS = [
    [-10, 0, -5], [-2, 0, -6.8], [6, 0, -6], [10.5, 0, -3],
    [10, 0, 0.5], [11, 1.1, 3.4], [7, 2.3, 5.6], [2.5, 2.55, 6.4],
    [-2, 1.5, 5.9], [-6, 0.2, 4.6], [-10.5, 0, 2.2], [-11.5, 0, -1.6], [-11, 0, -4.2]
  ];
  var RAMP_U0 = 0.40, RAMP_U1 = 0.455; /* hill top → 점프대 */

  function buildTrack() {
    if (!scene || trackG) return;
    curve = new THREE.CatmullRomCurve3(TRACK_PTS.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); }), true, 'catmullrom', 0.5);
    trackLen = curve.getLength();
    /* 노면 리본 */
    var pos = [], idx = [], u, i;
    for (i = 0; i <= SEG; i++) {
      u = i / SEG;
      var p = curve.getPointAt(u), t = curve.getTangentAt(u);
      var nx = -t.z, nz = t.x;
      var nl = Math.sqrt(nx * nx + nz * nz) || 1; nx /= nl; nz /= nl;
      pos.push(p.x + nx * HW, p.y + 0.02, p.z + nz * HW);
      pos.push(p.x - nx * HW, p.y + 0.02, p.z - nz * HW);
      if (i < SEG) {
        var a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    var road = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0x3E4650 }));
    trackG = new THREE.Group();
    trackG.add(road);
    /* 커브 표시(가드레일) */
    var railPos = [], railIdx = [], ri = 0;
    for (i = 0; i <= SEG; i++) {
      u = i / SEG;
      var p2 = curve.getPointAt(u), t2 = curve.getTangentAt(u);
      var nx2 = -t2.z, nz2 = t2.x;
      var nl2 = Math.sqrt(nx2 * nx2 + nz2 * nz2) || 1; nx2 /= nl2; nz2 /= nl2;
      railPos.push(p2.x + nx2 * (HW + 0.18), p2.y + 0.1, p2.z + nz2 * (HW + 0.18));
      railPos.push(p2.x - nx2 * (HW + 0.18), p2.y + 0.1, p2.z - nz2 * (HW + 0.18));
      if (i < SEG) {
        var b = i * 2;
        railIdx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    }
    var g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', new THREE.Float32BufferAttribute(railPos, 3));
    g2.setIndex(railIdx);
    var rail = new THREE.Mesh(g2, new THREE.MeshLambertMaterial({ color: 0xE5484D, side: THREE.DoubleSide }));
    trackG.add(rail);
    /* 출발선(체커) */
    var p0 = curve.getPointAt(0), t0 = curve.getTangentAt(0);
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
    /* 잔디 바닥 + 장식 */
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
    var wg = new THREE.CylinderGeometry(0.11, 0.11, 0.07, 12);
    var wm = new THREE.MeshLambertMaterial({ color: 0x22262B });
    var wheels = [];
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(function (p) {
      var w = new THREE.Mesh(wg, wm);
      w.rotation.z = Math.PI / 2;
      w.position.set(p[0] * (B.w / 2 + 0.02), 0.11, p[1] * 0.28);
      g.add(w); wheels.push(w);
    });
    g.userData.wheels = wheels;
    return g;
  }

  /* ---------------- 3D 초기화 ---------------- */
  function loadThree(cb) {
    if (global.THREE) { cb(); return; }
    if (threeLoading) return;
    threeLoading = true;
    var s = document.createElement('script');
    s.src = THREE_URL;
    s.async = true;
    s.onload = function () { threeLoading = false; cb(); };
    s.onerror = function () { threeLoading = false; cb(new Error('three.load')); };
    document.head.appendChild(s);
  }
  function init3D() {
    var cv = $('mcCanvas');
    if (!cv || !global.THREE) return false;
    if (renderer) return true;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
      renderer.setClearColor(0xCDE8FF);
      scene = new THREE.Scene();
      scene.add(new THREE.AmbientLight(0xFFFFFF, 0.8));
      var dir = new THREE.DirectionalLight(0xFFF3DC, 0.6);
      dir.position.set(8, 14, 6);
      scene.add(dir);
      camera = new THREE.PerspectiveCamera(55, 2, 0.1, 200);
      buildTrack();
      resize3D();
      return true;
    } catch (e) { console.warn('minicar3d init', e); return false; }
  }
  function resize3D() {
    if (!renderer) return;
    var box = $('mcCanvasWrap');
    if (!box) return;
    var w = box.clientWidth || 320, h = box.clientHeight || 240;
    renderer.setSize(w, h, false);
    if (camera) { camera.aspect = w / h; camera.updateProjectionMatrix(); }
  }
  function ensureCar() {
    if (!cfg) return;
    if (carG && carBuiltCfg === JSON.stringify(cfg)) return;
    if (carG) scene.remove(carG);
    carG = buildCar(cfg);
    carBuiltCfg = JSON.stringify(cfg);
    scene.add(carG);
  }

  /* ---------------- 주행 물리 ---------------- */
  function curveY(u) { return curve.getPointAt(((u % 1) + 1) % 1).y; }
  function slopeAt(u) {
    var e = 0.004;
    return (curveY(u + e) - curveY(u - e)) / (2 * e * trackLen);
  }
  function step(dt) {
    if (!run.on || !curve) return;
    var st = stats(cfg);
    var top = st.top * (run.boostT > 0 ? 1.45 : 1);
    var acc = st.acc * (run.boostT > 0 ? 1.8 : 1);
    /* 가속/저항 */
    run.s += acc * dt;
    if (run.s > top) run.s -= (run.s - top) * Math.min(1, dt * 3);
    run.s = Math.max(0, run.s);
    run.boostT = Math.max(0, run.boostT - dt);
    /* 커브 원심으로 레인 밀림 */
    var u = run.u, tan = curve.getTangentAt(((u % 1) + 1) % 1);
    var curv = curveCurvature(u);
    var drift = curv * run.s * run.s * 0.05 * (1.25 - st.grip) * (1 - st.st * 0.45);
    run.lane += drift * dt * (drift > 0 ? 1 : -1) * 4;
    run.lane = clamp(run.lane, -1.6, 1.6);
    var offRoad = Math.abs(run.lane) > HW / 0.55;
    if (offRoad) run.s *= 1 - Math.min(0.9, dt * 2.2);
    run.shake = offRoad ? 1 : Math.max(0, run.shake - dt * 3);
    /* 점프대 */
    if (!run.air) {
      var sl = slopeAt(u);
      run.u += (run.s / trackLen) * dt * (1 / Math.max(0.45, Math.cos(sl * 1.2)));
      if (u >= RAMP_U0 && u < RAMP_U1 && slopeAt(u) < -0.12 && run.s > 2.4) {
        run.air = true;
        run.vy = run.s * 0.42;
      }
      var ny = curveY(run.u);
      run.y = ny;
    } else {
      run.u += (run.s * 0.94 / trackLen) * dt;
      run.vy -= 9.8 * dt * 0.55;
      run.y += run.vy * dt;
      var gy = curveY(run.u);
      if (run.y <= gy) { run.y = gy; run.air = false; run.vy = 0; toast('🛬 착지!'); }
    }
    /* 랩 */
    if (run.u >= 1) {
      run.u -= 1;
      var lapMs = Math.round(run.lapT * 1000);
      run.lastLap = lapMs;
      if (!run.best || lapMs < run.best) {
        run.best = lapMs;
        var rec = recOf(true);
        if (rec && (!rec.best || lapMs < rec.best)) {
          rec.best = lapMs; rec.cfg = JSON.parse(JSON.stringify(cfg)); rec.at = now();
          save();
          toast('🏁 신기록! 최고 랩 ' + fmtMs(lapMs));
        }
      }
      run.lap++;
      run.lapT = 0;
      run.boosts = st.boosts; /* 랩마다 부스트 충전 */
    }
    run.lapT += dt;
  }
  function curveCurvature(u) {
    var e = 0.02;
    var a = curve.getTangentAt((((u - e) % 1) + 1) % 1), b = curve.getTangentAt(((u + e) % 1 + 1) % 1);
    var d = Math.abs(Math.atan2(a.x * b.z - a.z * b.x, a.x * b.x + a.z * b.z));
    return d / (2 * e * trackLen);
  }
  function placeCar() {
    if (!carG || !curve) return;
    var u = ((run.u % 1) + 1) % 1;
    var p = curve.getPointAt(u), t = curve.getTangentAt(u);
    var nx = -t.z, nz = t.x;
    var nl = Math.sqrt(nx * nx + nz * nz) || 1; nx /= nl; nz /= nl;
    var y = run.air ? run.y : p.y;
    carG.position.set(p.x + nx * run.lane * 0.55, y + 0.02 + run.shake * Math.sin(now() * 0.06) * 0.03, p.z + nz * run.lane * 0.55);
    carG.rotation.y = Math.atan2(t.x, t.z) + run.lane * 0.35 + run.shake * Math.sin(now() * 0.05) * 0.05;
    if (run.air) carG.rotation.x = clamp(-run.vy * 0.15, -0.5, 0.5);
    else carG.rotation.x = 0;
    var spin = run.s * 4;
    carG.userData.wheels.forEach(function (w) { w.rotation.x += spin * 0.016; });
  }

  function loopFrame(ts) {
    raf = requestAnimationFrame(loopFrame);
    if (!renderer || !scene) return;
    var dt = Math.min(0.05, (ts - (last || ts)) / 1000);
    last = ts;
    step(dt);
    placeCar();
    /* 추격 카메라 */
    if (carG) {
      var back = new THREE.Vector3(0, 0, -1).applyQuaternion(carG.quaternion).multiplyScalar(5.2);
      camera.position.lerp(new THREE.Vector3(carG.position.x + back.x, carG.position.y + 2.6, carG.position.z + back.z), 1 - Math.exp(-6 * dt));
      camera.lookAt(carG.position.x, carG.position.y + 0.4, carG.position.z);
    }
    renderer.render(scene, camera);
    raceHud();
  }
  function raceHud() {
    var el = $('mcHud');
    if (!el) return;
    var st = stats(cfg || defaultCfg());
    el.innerHTML =
      '<span>⏱ ' + fmtMs(Math.round(run.lapT * 1000)) + '</span>' +
      '<span>🏆 최고 ' + fmtMs(run.best) + '</span>' +
      '<span>' + Math.round(run.s * 30) + ' km/h</span>' +
      '<span>' + run.lap + '바퀴</span>' +
      '<span>⚡ ' + run.boosts + '</span>';
  }

  /* ---------------- UI ---------------- */
  function chips(key, cat, cur) {
    return '<div class="mc-optrow"><span class="mc-lb">' + key + '</span>' + cat.map(function (o) {
      return '<button type="button" class="mc-chip' + (cur === o[0] ? ' on' : '') + '" data-mc="' + o[0] + '">' + o[1] + '</button>';
    }).join('') + '</div>';
  }
  function renderGarage() {
    var box = $('mcGarage');
    if (!box) return;
    var rec = recOf(true);
    cfg = cfg || rec.cfg;
    var st = stats(cfg);
    box.innerHTML =
      '<div class="mc-sec">🔧 나만의 미니카 조립</div>' +
      chips('차체', [['sports', '스포츠'], ['off', '오프로드'], ['classic', '클래식']], cfg.body) +
      '<div class="mc-optrow"><span class="mc-lb">색상</span>' + COLORS.map(function (c) {
        return '<button type="button" class="mc-color' + (cfg.color === c ? ' on' : '') + '" data-mccolor="' + c + '" style="background:' + c + '"></button>';
      }).join('') + '</div>' +
      chips('모터', [['eco', '에코(연비)'], ['std', '표준'], ['turbo', '터보(고성능)']], cfg.motor) +
      chips('기어비', [['acc', '가속형'], ['bal', '균형'], ['top', '최고속형']], cfg.gear) +
      chips('타이어', [['std', '일반'], ['grip', '그립'], ['off', '오프로드']], cfg.tire) +
      chips('배터리', [['s', '소형'], ['m', '대용량'], ['l', '레이싱']], cfg.batt) +
      chips('공력 파츠', [['none', '없음'], ['roller', '롤러'], ['spoiler', '스포일러']], cfg.aero) +
      '<div class="mc-stats">⚡ 최고속 ' + (st.top * 30).toFixed(0) + 'km/h · 가속 ' + st.acc.toFixed(1) + ' · 그립 ' + (st.grip * 100).toFixed(0) + '% · 안정성 ' + (st.st * 100).toFixed(0) + '% · 부스트 ' + st.boosts + '회</div>' +
      '<button type="button" class="btn" id="mcGo" style="margin-top:8px">🏁 이 차로 주행 시작</button>';
  }
  function renderRacePane() {
    var box = $('mcRace');
    if (!box) return;
    var rec = recOf(true);
    box.innerHTML =
      '<div class="mc-canvas-wrap" id="mcCanvasWrap">' +
      '<canvas id="mcCanvas"></canvas>' +
      '<div class="mc-hud" id="mcHud"></div>' +
      '</div>' +
      '<div class="mc-ctrl">' +
      '<button type="button" class="mc-btn go" id="mcRun">▶ 출발/정지</button>' +
      '<button type="button" class="mc-btn" id="mcBoost">⚡ 부스트</button>' +
      '<button type="button" class="mc-btn" id="mcL">◀ 차선</button>' +
      '<button type="button" class="mc-btn" id="mcR">차선 ▶</button>' +
      '<button type="button" class="mc-btn back" id="mcBack">🔧 조립으로</button>' +
      '</div>' +
      '<div class="hint">오르막 위 점프대는 <b>속도가 붙었을 때</b> 활공 점프가 나와요. 커브에서는 차선 이동(◀ ▶)으로 안쪽을 타세요. 최고 랩타임은 가족 DB에 저장돼요(현재 최고: ' + fmtMs(rec.best) + ').</div>';
    wireRace();
  }
  function wireRace() {
    $('mcRun').onclick = function () {
      run.on = !run.on;
      if (run.on && run.boosts === 0 && run.lap === 1 && run.lapT === 0) run.boosts = stats(cfg).boosts;
      this.textContent = run.on ? '⏸ 정지' : '▶ 출발';
    };
    $('mcBoost').onclick = function () {
      if (!run.on) { toast('먼저 출발해 주세요'); return; }
      if (run.boosts <= 0) { toast('부스트가 없어요 — 다음 랩에 충전돼요'); return; }
      run.boosts--; run.boostT = 1.6;
    };
    $('mcL').onclick = function () { run.lane = clamp(run.lane - 0.28, -1.4, 1.4); };
    $('mcR').onclick = function () { run.lane = clamp(run.lane + 0.28, -1.4, 1.4); };
    $('mcBack').onclick = function () {
      $('mcRace').classList.add('hidden');
      $('mcGarage').classList.remove('hidden');
      stop();
    };
  }
  function stop() {
    run.on = false;
    run.u = 0; run.s = 0; run.lane = 0; run.air = false; run.vy = 0;
    run.lap = 1; run.lapT = 0; run.boostT = 0;
    if (cfg) run.boosts = stats(cfg).boosts;
    var b = $('mcRun');
    if (b) b.textContent = '▶ 출발';
  }

  /* ---------------- 패널 ---------------- */
  function paneHtml() {
    return '<div class="card" id="mcCard" style="padding:12px 12px 14px">' +
      '<div class="card-head" style="margin-bottom:9px"><h2>🏎️ 3D 미니카 조립 & 트랙 주행</h2><span class="sub">부품 골라 조립 → 커브·오르막·점프대 주행</span></div>' +
      '<div id="mcGarage"></div>' +
      '<div id="mcRace" class="hidden"></div>' +
      '</div>';
  }
  function injectPane() {
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
      var c = e.target.closest('[data-mc]');
      if (c) {
        var k = c.getAttribute('data-mc');
        var map = { sports: 'body', off: 'body', classic: 'body', eco: 'motor', std: 'motor', turbo: 'motor', acc: 'gear', bal: 'gear', top: 'gear', s: 'batt', m: 'batt', l: 'batt' };
        var key = map[k];
        if (key === 'body') cfg.body = k;
        else if (key === 'motor') cfg.motor = k;
        else if (key === 'gear') cfg.gear = k;
        else if (key === 'batt') cfg.batt = k;
        else { var tk = { std: 1, grip: 1, off: 1 }[k]; if (tk) cfg.tire = k; else cfg.aero = k; }
        renderGarage();
        return;
      }
      var col = e.target.closest('[data-mccolor]');
      if (col) { cfg.color = col.getAttribute('data-mccolor'); renderGarage(); return; }
      var go = e.target.closest('#mcGo');
      if (go) {
        var rec = recOf(true);
        rec.cfg = JSON.parse(JSON.stringify(cfg));
        rec.at = now();
        save();
        $('mcGarage').classList.add('hidden');
        renderRacePane();
        $('mcRace').classList.remove('hidden');
        start3D();
        return;
      }
    });
  }
  function start3D() {
    loadThree(function () {
      if (!init3D()) return;
      ensureCar();
      stop();
      resize3D();
      if (!raf) { last = 0; raf = requestAnimationFrame(loopFrame); }
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
    cfg = cfg || (recOf(true) || {}).cfg;
    renderGarage();
  }
  function hideMine() {
    if (!paneOn) return;
    paneOn = false;
    var mine = $('pgPane-minicar');
    if (mine) mine.classList.add('hidden');
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
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
  global.addEventListener('resize', function () { if (paneOn) resize3D(); });

  global.MINICAR3D = {
    show: showMine, hide: hideMine,
    onView: function (v) { if (v !== 'play') hideMine(); }
  };
})(window);
