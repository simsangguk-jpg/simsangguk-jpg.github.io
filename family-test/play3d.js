/* ============================================================
   상국수향지섭지율포털 · V3 🧸 가족 놀이터 (Three.js r128)
   - 속초 바닷가 가족사진을 참고해 만든 3D 입체 가족 캐릭터 4명
     (상국: 안경·남색 패딩 / 수향: 긴 머리·따뜻한 니트
      지섭: 검정 코트 / 지율: 아이보리 패딩·조끼)
   - 평소: 걷기·달리기·점프·빙글·서로 인사·웃기
   - 마우스/손가락으로 집어 던지면: 중력·포물선·바운스·구르기
     → 툴툴 털고 일어나기, 착지가 아프면 울상(눈물)
   - 탭/버튼: 활짝 웃기·울상·재주넘기·손 흔들기·춤
   - 가족 DB(fam-8e05f6a61cde1ff3-*)는 전혀 건드리지 않는다.
     이 화면은 가족 데이터를 읽지도 쓰지도 않는다(순수 놀이 장면).
   ============================================================ */
(function (global) {
'use strict';

var THREE_URL = '../three.min.js';

var P = {
  phase: 'idle',          /* idle | loading | ready | error */
  stage: null, canvas: null, ov: null,
  renderer: null, scene: null, camera: null,
  chars: [], pickables: [], dust: [],
  particles: [], ptext: {},
  W: 0, H: 0, dpr: 1,
  t: 0, last: 0, raf: 0, running: false, active: false,
  frames: 0, fpsTime: 0, fps: 0, tri: 0,
  ptr: { x: 0, y: 0, nx: 0, ny: 0 },
  drag: null, hover: null,
  full: false,
  greetT: 6
};

/* ---------------- 작은 도우미 ---------------- */
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function rnd(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
function lerp(a, b, t) { return a + (b - a) * t; }
function damp(a, b, lambda, dt) { return lerp(a, b, 1 - Math.exp(-lambda * dt)); }
function angLerp(a, b, lambda, dt) {
  var d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * (1 - Math.exp(-lambda * dt));
}
function mat(color, opts) {
  var o = { color: color };
  if (opts) for (var k in opts) o[k] = opts[k];
  return new THREE.MeshLambertMaterial(o);
}
var GEO = {};
function geo(key, make) {
  if (!GEO[key]) GEO[key] = make();
  return GEO[key];
}

/* ---------------- 표정(얼굴) 텍스처 ---------------- */
/* 모든 가족이 같은 얼굴 화풍을 쓴다(머리·피부색만 다름) */
var FACE = {};
function faceTex(expr) {
  if (FACE[expr]) return FACE[expr];
  var S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  var g = c.getContext('2d');
  var ink = '#2B2118';
  g.clearRect(0, 0, S, S);
  g.lineCap = 'round';
  g.lineJoin = 'round';

  function eyeOpen(cx, cy, rx, ry, squint) {
    g.fillStyle = ink;
    g.beginPath();
    g.ellipse(cx, cy, rx, ry * (squint || 1), 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.92)';
    g.beginPath();
    g.ellipse(cx - rx * 0.28, cy - ry * 0.34, rx * 0.34, ry * 0.30, 0, 0, Math.PI * 2);
    g.fill();
  }
  function arcEye(cx, cy, w, h, up) {
    g.strokeStyle = ink;
    g.lineWidth = 13;
    g.beginPath();
    g.moveTo(cx - w, cy + (up ? h : -h));
    g.quadraticCurveTo(cx, cy + (up ? -h : h), cx + w, cy + (up ? h : -h));
    g.stroke();
  }
  function brows(cy, tilt) {
    g.strokeStyle = ink; g.lineWidth = 10;
    [0.235, 0.765].forEach(function (u, i) {
      var dir = i === 0 ? 1 : -1;
      g.beginPath();
      g.moveTo(u * S - 34 * dir, cy + tilt * dir);
      g.lineTo(u * S + 34 * dir, cy - tilt * dir);
      g.stroke();
    });
  }
  function mouthSmile(cy, w, depth, lw) {
    g.strokeStyle = ink; g.lineWidth = lw || 11;
    g.beginPath();
    g.moveTo(0.5 * S - w, cy);
    g.quadraticCurveTo(0.5 * S, cy + depth, 0.5 * S + w, cy);
    g.stroke();
  }
  function mouthOpen(cy, w, h, tongue) {
    g.fillStyle = ink;
    g.beginPath(); g.ellipse(0.5 * S, cy, w, h, 0, 0, Math.PI * 2); g.fill();
    if (tongue) {
      g.fillStyle = '#FF7E8A';
      g.beginPath(); g.ellipse(0.5 * S, cy + h * 0.42, w * 0.62, h * 0.42, 0, 0, Math.PI * 2); g.fill();
    }
  }
  function blush(a, cy) {
    g.fillStyle = 'rgba(255,138,128,' + (a || 0.34) + ')';
    cy = cy || 0.66 * S;
    [0.085, 0.915].forEach(function (u) {
      g.beginPath(); g.ellipse(u * S, cy, 28, 16, 0, 0, Math.PI * 2); g.fill();
    });
  }
  function nose() {
    g.strokeStyle = 'rgba(90,60,40,.55)'; g.lineWidth = 7;
    g.beginPath(); g.arc(0.5 * S, 0.625 * S, 9, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  }

  var EY = 0.45 * S, MY = 0.735 * S;

  if (expr === 'normal') {
    eyeOpen(0.235 * S, EY, 23, 29);
    eyeOpen(0.765 * S, EY, 23, 29);
    nose(); mouthSmile(MY, 30, 22, 11); blush(0.34, 0.60 * S);
  } else if (expr === 'smile') {
    eyeOpen(0.235 * S, EY, 23, 26, 0.85);
    eyeOpen(0.765 * S, EY, 23, 26, 0.85);
    nose(); mouthSmile(MY, 36, 28, 12); blush(0.42, 0.60 * S);
  } else if (expr === 'laugh') {
    arcEye(0.235 * S, EY + 6, 27, 18, true);
    arcEye(0.765 * S, EY + 6, 27, 18, true);
    nose(); mouthOpen(MY + 4, 33, 26, true); blush(0.50, 0.60 * S);
  } else if (expr === 'sad') {
    brows(EY - 50, -10);
    eyeOpen(0.235 * S, EY + 4, 19, 22); eyeOpen(0.765 * S, EY + 4, 19, 22);
    nose();
    g.strokeStyle = ink; g.lineWidth = 11;
    g.beginPath(); g.moveTo(0.5 * S - 26, MY + 14); g.quadraticCurveTo(0.5 * S, MY - 14, 0.5 * S + 26, MY + 14); g.stroke();
    blush(0.24, 0.60 * S);
  } else if (expr === 'cry') {
    brows(EY - 52, 11);
    g.strokeStyle = ink; g.lineWidth = 13;
    [0.235, 0.765].forEach(function (u) {
      g.beginPath(); g.moveTo(u * S - 22, EY - 16); g.lineTo(u * S + 20, EY + 18); g.stroke();
      g.beginPath(); g.moveTo(u * S + 22, EY - 16); g.lineTo(u * S - 20, EY + 18); g.stroke();
    });
    mouthOpen(MY + 6, 28, 22, true);
    blush(0.46, 0.60 * S);
  } else if (expr === 'dizzy') {
    g.strokeStyle = ink; g.lineWidth = 10;
    [0.235, 0.765].forEach(function (u) {
      g.beginPath();
      for (var a = 0; a < 13; a++) {
        var r = 3 + a * 1.7, ang = a * 0.9;
        var px = u * S + Math.cos(ang) * r, py = EY + Math.sin(ang) * r;
        a ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.stroke();
    });
    nose();
    g.strokeStyle = ink; g.lineWidth = 11;
    g.beginPath();
    g.moveTo(0.5 * S - 32, MY);
    g.bezierCurveTo(0.5 * S - 15, MY - 15, 0.5 * S - 2, MY + 15, 0.5 * S + 13, MY);
    g.bezierCurveTo(0.5 * S + 21, MY - 8, 0.5 * S + 27, MY + 6, 0.5 * S + 32, MY - 2);
    g.stroke();
  } else if (expr === 'surprise') {
    [0.235, 0.765].forEach(function (u) {
      g.fillStyle = '#fff';
      g.beginPath(); g.ellipse(u * S, EY, 29, 31, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = ink; g.beginPath(); g.ellipse(u * S, EY + 2, 15, 18, 0, 0, Math.PI * 2); g.fill();
    });
    nose(); mouthOpen(MY + 2, 16, 20, false);
  } else if (expr === 'blink') {
    arcEye(0.235 * S, EY + 2, 25, 9, false);
    arcEye(0.765 * S, EY + 2, 25, 9, false);
    nose(); mouthSmile(MY, 28, 18, 10); blush(0.34, 0.60 * S);
  } else {
    eyeOpen(0.235 * S, EY, 23, 29); eyeOpen(0.765 * S, EY, 23, 29);
    nose(); mouthSmile(MY, 30, 22, 11); blush(0.34, 0.60 * S);
  }

  var t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  t.needsUpdate = true;
  FACE[expr] = t;
  return t;
}

/* ---------------- 스프라이트 텍스처(하트·별·눈물·먼지·구름) ---------------- */
var SPR = {};
function spriteTex(kind) {
  if (SPR[kind]) return SPR[kind];
  var S = 96, c = document.createElement('canvas');
  c.width = c.height = S;
  var g = c.getContext('2d');
  if (kind === 'heart') {
    g.fillStyle = '#FF6B8A';
    g.beginPath();
    g.moveTo(S / 2, S * 0.82);
    g.bezierCurveTo(S * 0.10, S * 0.55, S * 0.16, S * 0.16, S / 2, S * 0.36);
    g.bezierCurveTo(S * 0.84, S * 0.16, S * 0.90, S * 0.55, S / 2, S * 0.82);
    g.fill();
  } else if (kind === 'star') {
    g.fillStyle = '#FFC24B';
    g.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? S * 0.20 : S * 0.46;
      var px = S / 2 + Math.cos(a) * r, py = S / 2 + Math.sin(a) * r;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath(); g.fill();
  } else if (kind === 'tear') {
    var gr = g.createLinearGradient(0, 0, 0, S);
    gr.addColorStop(0, '#9BD9FF'); gr.addColorStop(1, '#3F9BFF');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(S / 2, S * 0.10);
    g.bezierCurveTo(S * 0.88, S * 0.55, S * 0.78, S * 0.92, S / 2, S * 0.92);
    g.bezierCurveTo(S * 0.22, S * 0.92, S * 0.12, S * 0.55, S / 2, S * 0.10);
    g.fill();
  } else if (kind === 'puff') {
    var rg = g.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, S / 2);
    rg.addColorStop(0, 'rgba(255,255,255,.95)');
    rg.addColorStop(0.55, 'rgba(255,255,255,.55)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, S, S);
  } else if (kind === 'cloud') {
    g.fillStyle = 'rgba(255,255,255,.92)';
    [[0.34, 0.60, 0.22], [0.52, 0.52, 0.28], [0.70, 0.62, 0.20], [0.46, 0.44, 0.16]].forEach(function (b) {
      g.beginPath(); g.arc(b[0] * S, b[1] * S, b[2] * S, 0, Math.PI * 2); g.fill();
    });
  } else if (kind === 'shadow') {
    var rgs = g.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, S / 2);
    rgs.addColorStop(0, 'rgba(60,50,35,.55)');
    rgs.addColorStop(0.6, 'rgba(60,50,35,.28)');
    rgs.addColorStop(1, 'rgba(60,50,35,0)');
    g.fillStyle = rgs; g.fillRect(0, 0, S, S);
  } else if (kind === 'ball') {
    var cols = ['#FF7A66', '#FFFFFF', '#4C8DFF', '#FFC24B', '#FFFFFF', '#0E9F6E'];
    var w = S / cols.length;
    for (var k = 0; k < cols.length; k++) { g.fillStyle = cols[k]; g.fillRect(k * w, 0, w + 1, S); }
  } else if (kind === 'sign') {
    g.fillStyle = '#F4E4C6'; g.fillRect(0, 0, S, S);
    g.fillStyle = '#8A6242';
    g.font = 'bold 34px -apple-system,"Malgun Gothic",sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('속초', S / 2, S / 2 - 12);
    g.font = 'bold 19px -apple-system,"Malgun Gothic",sans-serif';
    g.fillText('우리 가족', S / 2, S / 2 + 22);
  }
  var t = new THREE.CanvasTexture(c);
  SPR[kind] = t;
  return t;
}

/* ---------------- 세상 만들기 ---------------- */
function buildWorld(scene) {
  var root = new THREE.Group();
  scene.add(root);

  /* 바다 */
  var sea = new THREE.Mesh(
    geo('sea', function () { return new THREE.PlaneGeometry(180, 180); }),
    mat(0x52C3E1)
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -0.52;
  root.add(sea);
  var sea2 = new THREE.Mesh(
    geo('sea2', function () { return new THREE.PlaneGeometry(180, 180); }),
    mat(0x86D8EC, { transparent: true, opacity: 0.38 })
  );
  sea2.rotation.x = -Math.PI / 2;
  sea2.position.y = -0.5;
  root.add(sea2);

  /* 모래섬 */
  var island = new THREE.Mesh(
    geo('island', function () { return new THREE.CylinderGeometry(4.28, 4.62, 1.0, 56, 1); }),
    [mat(0xE0C38F), mat(0xF2DDAF), mat(0xDDBF8D)]
  );
  island.position.y = -0.5;
  root.add(island);

  var sandTop = new THREE.Mesh(
    geo('sandTop', function () { return new THREE.CircleGeometry(4.26, 56); }),
    mat(0xF2DEB0)
  );
  sandTop.rotation.x = -Math.PI / 2;
  sandTop.position.y = 0.006;
  root.add(sandTop);

  var inner = new THREE.Mesh(
    geo('inner', function () { return new THREE.CircleGeometry(3.2, 48); }),
    mat(0xF9E8C2, { transparent: true, opacity: 0.92 })
  );
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.01;
  root.add(inner);

  /* 파도(흰 테두리) */
  var foam = new THREE.Mesh(
    geo('foam', function () { return new THREE.TorusGeometry(4.42, 0.07, 8, 64); }),
    mat(0xFFFFFF, { transparent: true, opacity: 0.9 })
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.y = -0.42;
  root.add(foam);
  P.foam = foam;

  var foam2 = new THREE.Mesh(
    geo('foam2', function () { return new THREE.TorusGeometry(5.4, 0.05, 8, 64); }),
    mat(0xFFFFFF, { transparent: true, opacity: 0.55 })
  );
  foam2.rotation.x = -Math.PI / 2;
  foam2.position.y = -0.5;
  root.add(foam2);
  P.foam2 = foam2;

  var foam3 = new THREE.Mesh(
    geo('foam3', function () { return new THREE.TorusGeometry(7.2, 0.045, 8, 72); }),
    mat(0xFFFFFF, { transparent: true, opacity: 0.32 })
  );
  foam3.rotation.x = -Math.PI / 2;
  foam3.position.y = -0.51;
  root.add(foam3);
  P.foam3 = foam3;

  /* 바위 */
  var rockM = mat(0x9AA3A8);
  var rockM2 = mat(0x87919A);
  var ROCK_SPOTS = [[-3.72, 1.95, 0.38], [-3.95, 0.65, 0.26], [3.55, 2.2, 0.32], [3.8, -2.25, 0.26], [-2.5, -3.35, 0.3]];
  ROCK_SPOTS.forEach(function (r, i) {
    var m = new THREE.Mesh(geo('rock', function () { return new THREE.IcosahedronGeometry(1, 0); }), i % 2 ? rockM2 : rockM);
    m.position.set(r[0], 0.05, r[1]);
    m.scale.set(r[2], r[2] * 0.72, r[2] * 0.9);
    m.rotation.set(rnd(0, 1), rnd(0, 3), rnd(0, 1));
    root.add(m);
  });

  /* 파라솔 */
  var uGrp = new THREE.Group();
  var pole = new THREE.Mesh(geo('pole', function () { return new THREE.CylinderGeometry(0.03, 0.03, 1.45, 8); }), mat(0xEFE7DA));
  pole.position.y = 0.72;
  uGrp.add(pole);
  var cap = new THREE.Mesh(geo('ucap', function () { return new THREE.ConeGeometry(0.78, 0.42, 14, 1, true); }), mat(0xFF8C79, { side: THREE.DoubleSide }));
  cap.position.y = 1.45;
  uGrp.add(cap);
  var capTop = new THREE.Mesh(geo('ucapTop', function () { return new THREE.SphereGeometry(0.07, 10, 8); }), mat(0xFFFFFF));
  capTop.position.y = 1.66;
  uGrp.add(capTop);
  uGrp.position.set(-2.95, 0, -1.45);
  uGrp.rotation.z = 0.12;
  root.add(uGrp);

  /* 속초 표지판 */
  var signGrp = new THREE.Group();
  var sp1 = new THREE.Mesh(geo('sp1', function () { return new THREE.CylinderGeometry(0.045, 0.045, 0.9, 8); }), mat(0x8A6242));
  sp1.position.y = 0.45;
  signGrp.add(sp1);
  var board = new THREE.Mesh(
    geo('board', function () { return new THREE.BoxGeometry(0.78, 0.54, 0.07); }),
    new THREE.MeshLambertMaterial({ map: spriteTex('sign'), color: 0xffffff })
  );
  board.position.y = 1.0;
  signGrp.add(board);
  signGrp.position.set(2.85, 0, -1.75);
  signGrp.rotation.y = -0.35;
  root.add(signGrp);

  /* 비치볼 */
  var ball = new THREE.Mesh(
    geo('ball', function () { return new THREE.SphereGeometry(0.26, 20, 14); }),
    new THREE.MeshLambertMaterial({ map: spriteTex('ball'), color: 0xffffff })
  );
  ball.position.set(1.95, 0.26, 1.55);
  root.add(ball);
  P.ball = ball;
  P.ballBase = 0.26;

  /* 갈매기 2마리 */
  var gulls = [];
  for (var gi = 0; gi < 2; gi++) {
    var gll = new THREE.Group();
    var body = new THREE.Mesh(geo('gbody', function () { return new THREE.SphereGeometry(0.11, 10, 8); }), mat(0xFFFFFF));
    body.scale.set(1, 0.85, 1.6);
    gll.add(body);
    var wingGeo = geo('gwing', function () { return new THREE.BoxGeometry(0.52, 0.03, 0.16); });
    var wL = new THREE.Mesh(wingGeo, mat(0xEFF3F6));
    wL.position.set(-0.3, 0.02, 0);
    gll.add(wL);
    var wR = new THREE.Mesh(wingGeo, mat(0xEFF3F6));
    wR.position.set(0.3, 0.02, 0);
    gll.add(wR);
    gll.userData = { wL: wL, wR: wR, ph: gi * 1.7, r: 8.5 + gi * 1.6, sp: 0.22 - gi * 0.05 };
    root.add(gll);
    gulls.push(gll);
  }
  P.gulls = gulls;

  /* 구름 */
  P.clouds = [];
  [[-7.5, 4.6, -13, 6.5], [6.2, 5.4, -15, 7.5], [0.5, 5.9, -18, 5.5]].forEach(function (c) {
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTex('cloud'), transparent: true, opacity: 0.75, depthWrite: false }));
    sp.position.set(c[0], c[1], c[2]);
    sp.scale.set(c[3], c[3] * 0.55, 1);
    root.add(sp);
    P.clouds.push(sp);
  });

  P.world = root;
}

/* ---------------- 캐릭터 ---------------- */
var CAST = [
  {
    key: 'sangguk', name: '상국', role: '아빠', scale: 1.06, girth: 1.08,
    skin: 0xF0C6A0, hair: 0x241C18, hairStyle: 'short',
    top: 0x24314E, topAlt: 0x1A2439, inner: 0x8D939C, bottom: 0x2E3440, shoe: 0x14161A,
    style: 'puffer', glasses: true, x: -1.65, z: 0.35
  },
  {
    key: 'suhyang', name: '수향', role: '엄마', scale: 0.98, girth: 0.96,
    skin: 0xF6D2B6, hair: 0x2C211B, hairStyle: 'long',
    top: 0xE7BFA4, topAlt: 0xD8AB8E, inner: 0xF8E9DA, bottom: 0x6B5C52, shoe: 0x3A3532,
    style: 'knit', x: -0.5, z: -0.25
  },
  {
    key: 'jiseop', name: '지섭', role: '아들', scale: 1.01, girth: 0.98,
    skin: 0xF3CBA8, hair: 0x201A18, hairStyle: 'neat',
    top: 0x1A1C21, topAlt: 0x101216, inner: 0xB9BEC6, bottom: 0x202227, shoe: 0x131417,
    style: 'coat', x: 0.6, z: 0.25
  },
  {
    key: 'jiyul', name: '지율', role: '딸', scale: 0.84, girth: 1.04,
    skin: 0xF8D7BD, hair: 0x4B3627, hairStyle: 'bowl',
    top: 0xF5F2EC, topAlt: 0x1C1F25, inner: 0xFFFFFF, bottom: 0xE6E6E3, shoe: 0xF8F8F6,
    style: 'vest', x: 1.7, z: -0.25
  }
];

function capsule(r, len, color, seg) {
  var grp = new THREE.Group();
  var m = new THREE.MeshLambertMaterial({ color: color });
  var cy = new THREE.Mesh(geo('cap' + r + '_' + len, function () { return new THREE.CylinderGeometry(r, r, len, seg || 12); }), m);
  grp.add(cy);
  var sg = geo('caps' + r, function () { return new THREE.SphereGeometry(r, seg || 12, 8); });
  var s1 = new THREE.Mesh(sg, m); s1.position.y = len / 2; grp.add(s1);
  var s2 = new THREE.Mesh(sg, m); s2.position.y = -len / 2; grp.add(s2);
  return grp;
}

function buildCharacter(cfg) {
  var root = new THREE.Group();
  var rig = new THREE.Group();
  root.add(rig);

  var S = cfg.scale, G = cfg.girth;
  var HIP = 0.56, TORSO_H = 0.60, SH_Y = 1.0, SH_X = 0.235 * G;
  var HEAD_Y = 1.43, HR = 0.315;
  var parts = {};

  /* --- 그림자(월드에 따로 붙여 높이에 따라 줄어듦) --- */
  var shadowSpr = new THREE.Sprite(new THREE.SpriteMaterial({
    map: spriteTex('shadow'), transparent: true, opacity: 0.55, depthWrite: false
  }));
  shadowSpr.scale.set(1.15 * S, 0.68 * S, 1);
  shadowSpr.position.set(cfg.x, 0.015, cfg.z);
  parts.shadow = shadowSpr;

  /* --- 다리 --- */
  function makeLeg(side) {
    var g = new THREE.Group();
    g.position.set(side * 0.105 * G, HIP, 0);
    var leg = capsule(0.094, 0.34, cfg.bottom, 10);
    leg.position.y = -0.2625;
    g.add(leg);
    var shoe = new THREE.Mesh(geo('shoe', function () { return new THREE.BoxGeometry(0.165, 0.1, 0.245); }), mat(cfg.shoe));
    shoe.position.set(0, -0.505, 0.035);
    g.add(shoe);
    var sole = new THREE.Mesh(geo('sole', function () { return new THREE.BoxGeometry(0.16, 0.03, 0.24); }), mat(0xFFFFFF, { transparent: true, opacity: 0.5 }));
    sole.position.set(0, -0.545, 0.035);
    g.add(sole);
    rig.add(g);
    return g;
  }
  parts.legL = makeLeg(-1);
  parts.legR = makeLeg(1);

  /* --- 몸통 --- */
  var torso = new THREE.Group();
  torso.position.y = HIP;
  rig.add(torso);
  parts.torso = torso;

  var bodyMesh = new THREE.Mesh(
    geo('body' + G.toFixed(2), function () { return new THREE.SphereGeometry(0.30, 22, 16); }),
    mat(cfg.top)
  );
  bodyMesh.scale.set(0.93 * G, 1.02, 0.72 * G);
  bodyMesh.position.y = TORSO_H * 0.44;
  torso.add(bodyMesh);
  parts.body = bodyMesh;

  /* 옷 디테일 */
  var TOR_CY = TORSO_H * 0.44, TOR_RY = 0.306;
  function bodyR(yLocal, g) {
    var k = (yLocal - TOR_CY) / TOR_RY;
    return 0.30 * 0.93 * g * Math.sqrt(Math.max(0.05, 1 - k * k));
  }
  if (cfg.style === 'puffer') {
    [0.18, 0.28, 0.38].forEach(function (y) {
      var rr = bodyR(y, G) - 0.004;
      var ring = new THREE.Mesh(
        geo('pf' + y + rr.toFixed(3), function () { return new THREE.TorusGeometry(rr, 0.009, 6, 26); }),
        mat(cfg.topAlt)
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      ring.scale.z = 0.78;
      torso.add(ring);
    });
    var zip = new THREE.Mesh(geo('zip', function () { return new THREE.BoxGeometry(0.022, 0.42, 0.02); }), mat(cfg.topAlt));
    zip.position.set(0, 0.26, bodyR(0.26, G) * 0.79 + 0.008);
    torso.add(zip);
    var collar = new THREE.Mesh(geo('col', function () { return new THREE.TorusGeometry(0.118, 0.027, 8, 18); }), mat(cfg.inner));
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.55;
    collar.scale.z = 0.86;
    torso.add(collar);
  } else if (cfg.style === 'knit') {
    var scarf = new THREE.Mesh(
      geo('scarf', function () { return new THREE.TorusGeometry(0.152, 0.04, 8, 22); }),
      mat(0xF6E1CE)
    );
    scarf.rotation.x = Math.PI / 2.1;
    scarf.position.y = 0.56;
    scarf.scale.z = 0.88;
    torso.add(scarf);
    var tail = new THREE.Mesh(geo('tail', function () { return new THREE.BoxGeometry(0.1, 0.2, 0.05); }), mat(0xF6E1CE));
    tail.position.set(0.08, 0.42, bodyR(0.42, G) * 0.8 + 0.01);
    tail.rotation.z = 0.16;
    torso.add(tail);
    [0.2, 0.31, 0.42].forEach(function (y) {
      var rr = bodyR(y, G) - 0.004;
      var rib = new THREE.Mesh(
        geo('kn' + y + rr.toFixed(3), function () { return new THREE.TorusGeometry(rr, 0.007, 6, 24); }),
        mat(cfg.topAlt)
      );
      rib.rotation.x = Math.PI / 2;
      rib.position.y = y;
      rib.scale.z = 0.78;
      torso.add(rib);
    });
  } else if (cfg.style === 'coat') {
    var hoodie = new THREE.Mesh(
      geo('hd', function () { return new THREE.CylinderGeometry(0.283 * G, 0.283 * G, 0.2, 20, 1, true, -0.62, 1.24); }),
      mat(cfg.inner, { side: THREE.DoubleSide })
    );
    hoodie.position.y = 0.40;
    hoodie.scale.z = 0.8;
    torso.add(hoodie);
    var hood = new THREE.Mesh(geo('hood', function () { return new THREE.SphereGeometry(0.17, 14, 10); }), mat(cfg.inner));
    hood.scale.set(1, 0.62, 0.8);
    hood.position.set(0, 0.56, -0.13);
    torso.add(hood);
    var skirt = new THREE.Mesh(
      geo('coatSkirt', function () { return new THREE.CylinderGeometry(0.25 * G, 0.285 * G, 0.26, 20, 1, true); }),
      mat(cfg.top, { side: THREE.DoubleSide })
    );
    skirt.position.y = -0.02;
    skirt.scale.z = 0.82;
    torso.add(skirt);
    var draw = new THREE.Mesh(geo('draw', function () { return new THREE.BoxGeometry(0.012, 0.09, 0.012); }), mat(0xE9EDF2));
    draw.position.set(-0.045, 0.30, bodyR(0.30, G) * 0.78 + 0.008);
    torso.add(draw);
    var draw2 = draw.clone(); draw2.position.x = 0.045; torso.add(draw2);
  } else if (cfg.style === 'vest') {
    var vest = new THREE.Mesh(
      geo('vest', function () { return new THREE.CylinderGeometry(0.285 * G, 0.295 * G, 0.44, 24, 1, true, 0.46, Math.PI * 2 - 0.92); }),
      mat(cfg.topAlt, { side: THREE.DoubleSide })
    );
    vest.position.y = 0.27;
    vest.scale.z = 0.8;
    torso.add(vest);
    var strap = new THREE.Mesh(geo('strap', function () { return new THREE.BoxGeometry(0.036, 0.5, 0.02); }), mat(cfg.topAlt));
    strap.position.set(0.02, 0.30, bodyR(0.30, G) * 0.78);
    strap.rotation.z = 0.62;
    torso.add(strap);
    var pouch = new THREE.Mesh(geo('pouch', function () { return new THREE.BoxGeometry(0.13, 0.1, 0.07); }), mat(0xF3EDE2));
    pouch.position.set(0.15, 0.08, 0.12);
    pouch.rotation.y = 0.3;
    torso.add(pouch);
    var hood2 = new THREE.Mesh(geo('hood2', function () { return new THREE.SphereGeometry(0.16, 12, 10); }), mat(cfg.top));
    hood2.scale.set(1, 0.6, 0.8);
    hood2.position.set(0, 0.53, -0.12);
    torso.add(hood2);
  }

  /* --- 팔 --- */
  function makeArm(side) {
    var g = new THREE.Group();
    g.position.set(side * SH_X, SH_Y, 0);
    var arm = capsule(0.072, 0.33, cfg.top, 10);
    arm.position.y = -0.24;
    g.add(arm);
    var hand = new THREE.Mesh(geo('hand', function () { return new THREE.SphereGeometry(0.076, 10, 8); }), mat(cfg.skin));
    hand.position.y = -0.44;
    g.add(hand);
    g.rotation.z = side * 0.13;
    rig.add(g);
    return g;
  }
  parts.armL = makeArm(-1);
  parts.armR = makeArm(1);

  /* --- 목 --- */
  var neck = new THREE.Mesh(geo('neck', function () { return new THREE.CylinderGeometry(0.085, 0.095, 0.14, 10); }), mat(cfg.skin));
  neck.position.y = 1.16;
  rig.add(neck);

  /* --- 머리 --- */
  var head = new THREE.Group();
  head.position.y = HEAD_Y;
  rig.add(head);
  parts.head = head;

  var skull = new THREE.Mesh(geo('skull' + HR, function () { return new THREE.SphereGeometry(HR, 24, 18); }), mat(cfg.skin));
  skull.scale.set(1, 1.02, 0.98);
  head.add(skull);

  var earGeo = geo('ear', function () { return new THREE.SphereGeometry(0.066, 10, 8); });
  var earL = new THREE.Mesh(earGeo, mat(cfg.skin));
  earL.position.set(-HR * 0.97, -0.02, 0.01);
  head.add(earL);
  var earR = new THREE.Mesh(earGeo, mat(cfg.skin));
  earR.position.set(HR * 0.97, -0.02, 0.01);
  head.add(earR);

  /* 얼굴(구면 캡에 표정 텍스처) */
  var faceGeo = geo('facecap', function () {
    return new THREE.SphereGeometry(HR * 1.012, 26, 20, Math.PI / 2 - 0.95, 1.9, 1.05, 1.40);
  });
  var faceMat = new THREE.MeshBasicMaterial({ map: faceTex('normal'), transparent: true, depthWrite: false });
  var face = new THREE.Mesh(faceGeo, faceMat);
  head.add(face);
  parts.face = face;
  parts.faceMat = faceMat;

  /* 머리카락 */
  var hairM = mat(cfg.hair);
  var capGeo = geo('haircap', function () { return new THREE.SphereGeometry(HR * 1.05, 22, 14, 0, Math.PI * 2, 0, 1.12); });
  var cap = new THREE.Mesh(capGeo, hairM);
  cap.scale.set(1.015, 1.0, 1.015);
  head.add(cap);
  var fringeGeo = geo('fringe', function () { return new THREE.SphereGeometry(HR * 1.058, 20, 14, Math.PI / 2 - 1.30, 2.6, 0.5, 0.98); });
  var fringe = new THREE.Mesh(fringeGeo, hairM);
  head.add(fringe);

  if (cfg.hairStyle === 'long') {
    var back = new THREE.Mesh(geo('lback', function () { return new THREE.SphereGeometry(HR * 1.02, 18, 14); }), hairM);
    back.scale.set(1.0, 1.12, 0.72);
    back.position.set(0, -0.04, -0.11);
    head.add(back);
    [-1, 1].forEach(function (sd) {
      var lock = capsule(0.085, 0.40, cfg.hair, 10);
      lock.position.set(sd * HR * 0.98, -0.26, 0.0);
      lock.scale.set(0.9, 1, 0.9);
      head.add(lock);
    });
  } else if (cfg.hairStyle === 'bowl') {
    var fringe2 = new THREE.Mesh(geo('fringe2', function () { return new THREE.SphereGeometry(HR * 1.062, 20, 14, Math.PI / 2 - 1.4, 2.8, 0.62, 1.02); }), hairM);
    head.add(fringe2);
    var tuft = new THREE.Mesh(geo('tuft', function () { return new THREE.SphereGeometry(0.075, 10, 8); }), hairM);
    tuft.position.set(0.02, HR * 1.0, 0.03);
    tuft.scale.set(1.1, 0.7, 1.1);
    head.add(tuft);
  } else if (cfg.hairStyle === 'neat') {
    var side = new THREE.Mesh(geo('neatside', function () { return new THREE.SphereGeometry(HR * 1.045, 14, 10, 0, Math.PI * 2, 0.5, 0.8); }), hairM);
    side.position.set(0.04, 0.01, 0);
    side.scale.set(1, 0.9, 1);
    head.add(side);
  } else {
    var tuft2 = new THREE.Mesh(geo('tuft', function () { return new THREE.SphereGeometry(0.075, 10, 8); }), hairM);
    tuft2.position.set(-0.05, HR * 0.98, 0.02);
    tuft2.scale.set(1.0, 0.6, 1.0);
    head.add(tuft2);
  }

  /* 안경(상국) */
  if (cfg.glasses) {
    var gGrp = new THREE.Group();
    var lensGeo = geo('lens', function () { return new THREE.TorusGeometry(0.086, 0.014, 8, 22); });
    var lensM = mat(0x1B1F26);
    var FR = HR * 1.012;
    var lx = 0.125;
    var lz = Math.sqrt(FR * FR - lx * lx) + 0.004;
    [-1, 1].forEach(function (sd) {
      var lens = new THREE.Mesh(lensGeo, lensM);
      lens.position.set(sd * lx, 0.0, lz);
      gGrp.add(lens);
      var temple = new THREE.Mesh(geo('temple', function () { return new THREE.BoxGeometry(0.014, 0.014, 0.22); }), lensM);
      temple.position.set(sd * (lx + 0.075), 0.004, FR * 0.52);
      temple.rotation.y = sd * 0.2;
      gGrp.add(temple);
    });
    var bridge = new THREE.Mesh(geo('bridge', function () { return new THREE.BoxGeometry(0.078, 0.014, 0.014); }), lensM);
    bridge.position.set(0, 0.006, FR + 0.004);
    gGrp.add(bridge);
    head.add(gGrp);
  }

  root.scale.setScalar(S);

  return {
    shadowSpr: shadowSpr,
    key: cfg.key, name: cfg.name, role: cfg.role, cfg: cfg,
    root: root, rig: rig, parts: parts, S: S,
    x: cfg.x, z: cfg.z, y: 0,
    vx: 0, vz: 0, vy: 0,
    tx: cfg.x, tz: cfg.z,
    faceAng: 0, spinY: 0,
    state: 'idle', t: 0, dur: 0,
    phase: rnd(0, 6), amp: 1,
    face: 'normal', faceHold: 0, blinkT: rnd(1.5, 4), blink: 0,
    idleFor: rnd(1.0, 3.2),
    spin: 0, roll: 0, impact: 0,
    heldT: 0, bubbleT: 0, said: 0,
    tx2: 0
  };
}

/* ---------------- 대사 ---------------- */
var SAY = {
  common: {
    pet: ['히히 좋아!', '간지러워~', '또 해줘!', '고마워!', '최고야!'],
    hello: ['안녕!', '왔어?', '같이 놀자!', '반가워~'],
    wave: ['안녕~', '여기 있어요!', '손 흔들기!'],
    cheer: ['가족 최고!', '화이팅!', '사랑해!'],
    fly: ['으아아~!', '날아간다!', '나 잡아봐~'],
    land: ['아이쿠!', '쿵!', '툭!'],
    cry: ['엉엉…', '아야…', '흐엥'],
    up: ['다시 일어났다!', '괜찮아~', '한 번 더!'],
    flip: ['봐라!', '한 바퀴!'],
    spin: ['빙글빙글~', '돌아라~'],
    dance: ['신난다!', '흔들흔들~'],
    jump: ['점프!', '얍!']
  },
  sangguk: { pet: ['하하, 좋아!', '아빠가 웃는다'], hello: ['어, 왔니?', '얘들아 안녕'], wave: ['아빠 왔다~'], fly: ['아빠가 난다!'], cry: ['허리야…'], cheer: ['우리 가족 최고!'], up: ['아빠는 튼튼해'] },
  suhyang: { pet: ['어머, 고마워~', '히히'], hello: ['얘들아 왔구나', '밥 먹자~'], wave: ['여기 있어요~'], fly: ['살랑살랑~'], cry: ['아이쿠야…'], cheer: ['우리 가족 사랑해!'], up: ['괜찮아요~'] },
  jiseop: { pet: ['ㅋㅋ 좋아', '또 해줘'], hello: ['어 왔어?', '뭐 해'], wave: ['안녕'], fly: ['날아간다!!'], cry: ['아 진짜…'], cheer: ['최고!'], up: ['ㅋㅋ 괜찮아'] },
  jiyul: { pet: ['히히! 또! 또!', '간지러워~'], hello: ['언니~ 아빠~', '같이 놀자!'], wave: ['안녕안녕!'], fly: ['으아아~ 신난다!'], cry: ['엉엉 으앙'], cheer: ['최고야!!'], up: ['나는 씩씩해!'] }
};
function say(c, kind) {
  var pool = (SAY[c.key] && SAY[c.key][kind]) || SAY.common[kind] || ['!'];
  var text = pick(pool);
  c.bubble.textContent = text;
  c.bubble.classList.add('on');
  c.bubbleT = 1.7;
}

/* ---------------- 상태 ---------------- */
function setFace(c, expr, hold) {
  if (c.face === expr && !hold) return;
  c.face = expr;
  c.parts.faceMat.map = faceTex(expr);
  c.parts.faceMat.needsUpdate = true;
  c.faceHold = hold || 0;
}
function setState(c, s, dur) {
  c.state = s;
  c.t = 0;
  c.dur = dur || 0;
  c.spin = 0;
  if (s !== 'spin') c.spinY = 0;
}
function faceTo(c, ang, dt, lam) {
  c.faceAng = angLerp(c.faceAng, ang, lam || 8, dt);
}

function pickBehavior(c) {
  var r = Math.random();
  var others = P.chars.filter(function (o) { return o !== c; });
  var near = others.filter(function (o) { return Math.hypot(o.x - c.x, o.z - c.z) < 2.4; });
  if (r < 0.34) {
    /* 걷기 */
    var a = rnd(0, Math.PI * 2), rad = rnd(0.6, 2.4);
    c.tx = clamp(c.x + Math.cos(a) * rad, -2.5, 2.5);
    c.tz = clamp(c.z + Math.sin(a) * rad, -2.2, 2.2);
    setState(c, 'walk');
    setFace(c, 'normal');
  } else if (r < 0.46) {
    var a2 = rnd(0, Math.PI * 2), rad2 = rnd(1.4, 2.6);
    c.tx = clamp(c.x + Math.cos(a2) * rad2, -2.6, 2.6);
    c.tz = clamp(c.z + Math.sin(a2) * rad2, -2.3, 2.3);
    setState(c, 'run');
    setFace(c, 'smile');
  } else if (r < 0.56 && near.length) {
    /* 가까운 가족에게 인사 */
    var o = pick(near);
    c.tx = o.x; c.tz = o.z;
    setState(c, 'wave', 1.7);
    setFace(c, 'laugh', 1.9);
    say(c, 'hello');
    faceTo(c, Math.atan2(o.x - c.x, o.z - c.z), 1, 10);
    if (Math.random() < 0.7 && o.state !== 'cry' && o.state !== 'held') {
      setTimeout(function () {
        if (o.state === 'held' || o.state === 'fly' || o.state === 'roll' || o.state === 'cry') return;
        setState(o, 'wave', 1.5);
        setFace(o, 'laugh', 1.7);
        faceTo(o, Math.atan2(c.x - o.x, c.z - o.z), 1, 10);
        say(o, 'hello');
      }, 380);
    }
  } else if (r < 0.66) {
    setState(c, 'hop', 0.62);
    setFace(c, 'laugh', 0.9);
    say(c, 'jump');
  } else if (r < 0.74) {
    setState(c, 'spin', 1.25);
    setFace(c, 'laugh', 1.4);
    say(c, 'spin');
  } else if (r < 0.82) {
    setState(c, 'cheer', 1.7);
    setFace(c, 'laugh', 1.9);
    say(c, 'cheer');
    spawn(c, 'heart', 3);
  } else if (r < 0.88) {
    setState(c, 'dance', 2.2);
    setFace(c, 'laugh', 2.4);
    say(c, 'dance');
  } else {
    setState(c, 'idle');
    c.idleFor = rnd(1.4, 3.6);
    setFace(c, 'normal');
    faceTo(c, rnd(-0.4, 0.4), 1, 2.4);
  }
}

/* 서로 너무 붙지 않게 살짝 떼어 놓기 */
function separate() {
  var n = P.chars.length;
  for (var i = 0; i < n; i++) {
    var a = P.chars[i];
    if (a.state === 'held' || a.state === 'fly' || a.state === 'roll') continue;
    for (var j = i + 1; j < n; j++) {
      var b = P.chars[j];
      if (b.state === 'held' || b.state === 'fly' || b.state === 'roll') continue;
      var dx = b.x - a.x, dz = b.z - a.z;
      var d = Math.hypot(dx, dz);
      if (d > 0.001 && d < 0.78) {
        var push = (0.78 - d) * 0.5;
        var ux = dx / d, uz = dz / d;
        a.x -= ux * push; a.z -= uz * push;
        b.x += ux * push; b.z += uz * push;
      }
    }
  }
}

/* ---------------- 입자 ---------------- */
function makeSprite(kind) {
  var sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: spriteTex(kind), transparent: true, opacity: 1, depthWrite: false
  }));
  sp.visible = false;
  P.scene.add(sp);
  return sp;
}
function spawn(c, kind, n, opt) {
  n = n || 3;
  opt = opt || {};
  for (var i = 0; i < n; i++) {
    var p = null;
    for (var j = 0; j < P.particles.length; j++) if (!P.particles[j].live) { p = P.particles[j]; break; }
    if (!p) {
      if (P.particles.length > 70) break;
      p = { spr: makeSprite(kind), kind: kind, live: false };
      P.particles.push(p);
    }
    p.live = true;
    p.kind = kind;
    p.spr.material.map = spriteTex(kind);
    p.spr.visible = true;
    p.spr.material.opacity = 1;
    var sc = opt.scale || (kind === 'puff' ? 0.42 : 0.2);
    p.spr.scale.set(sc, sc, 1);
    p.x = c.x + rnd(-0.18, 0.18) + (opt.dx || 0);
    p.y = (c.y || 0) + (opt.y || (1.55 * c.S)) + rnd(-0.1, 0.2);
    p.z = c.z + rnd(-0.12, 0.12);
    p.vx = rnd(-0.7, 0.7) + (opt.vx || 0);
    p.vy = rnd(1.0, 2.1) + (opt.vy || 0);
    p.vz = rnd(-0.5, 0.5);
    p.life = p.maxLife = opt.life || rnd(0.7, 1.25);
    p.grav = kind === 'puff' ? -1.2 : 1.6;
    p.spr.position.set(p.x, p.y, p.z);
  }
}
function updateParticles(dt) {
  for (var i = 0; i < P.particles.length; i++) {
    var p = P.particles[i];
    if (!p.live) continue;
    p.life -= dt;
    if (p.life <= 0) { p.live = false; p.spr.visible = false; continue; }
    p.vy -= p.grav * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    p.spr.position.set(p.x, p.y, p.z);
    var k = p.life / p.maxLife;
    p.spr.material.opacity = k < 0.4 ? k / 0.4 : 1;
    if (p.kind === 'puff') {
      var s = (1.2 - k) * 0.6 + 0.2;
      p.spr.scale.set(s, s, 1);
    }
  }
}

/* ---------------- 자세 ---------------- */
function basePose(c) {
  var p = c.parts;
  c.rig.rotation.set(0, 0, 0);
  c.rig.position.y = 0;
  p.head.rotation.set(0, 0, 0);
  p.armL.rotation.set(0, 0, -0.13);
  p.armR.rotation.set(0, 0, 0.13);
  p.legL.rotation.set(0, 0, 0);
  p.legR.rotation.set(0, 0, 0);
  p.body.scale.y = 1.02;
}

function poseChar(c, dt) {
  var p = c.parts, t = c.t, S = c.S;
  basePose(c);
  var st = c.state;

  if (st === 'walk' || st === 'run') {
    var ph = c.phase;
    var sp = st === 'run' ? 1.3 : 1.0;
    p.legL.rotation.x = Math.sin(ph) * 0.62 * sp;
    p.legR.rotation.x = -Math.sin(ph) * 0.62 * sp;
    p.armL.rotation.x = -Math.sin(ph) * 0.52 * sp;
    p.armR.rotation.x = Math.sin(ph) * 0.52 * sp;
    c.rig.position.y = Math.abs(Math.sin(ph)) * (st === 'run' ? 0.075 : 0.045);
    if (st === 'run') c.rig.rotation.x = 0.13;
    p.head.rotation.x = st === 'run' ? -0.06 : 0;
    p.head.rotation.y = Math.sin(ph * 0.5) * 0.12;
  } else if (st === 'idle') {
    var b = Math.sin(P.t * 2.1 + c.phase);
    p.body.scale.y = 1.02 + b * 0.018;
    p.armL.rotation.z = -0.13 - Math.abs(b) * 0.03;
    p.armR.rotation.z = 0.13 + Math.abs(b) * 0.03;
    if (!P.freeze) {
      p.head.rotation.y = Math.sin(P.t * 0.55 + c.phase) * 0.22;
      p.head.rotation.x = Math.sin(P.t * 0.8 + c.phase) * 0.05;
    }
    p.legL.rotation.z = 0.02;
    p.legR.rotation.z = -0.02;
  } else if (st === 'wave') {
    p.armR.rotation.z = 2.45 + Math.sin(t * 12) * 0.28;
    p.armR.rotation.x = -0.2;
    p.armL.rotation.z = -0.2;
    c.rig.position.y = Math.abs(Math.sin(t * 6)) * 0.03;
    p.head.rotation.z = Math.sin(t * 6) * 0.06;
  } else if (st === 'cheer') {
    p.armL.rotation.z = -2.45 - Math.sin(t * 9) * 0.16;
    p.armR.rotation.z = 2.45 + Math.sin(t * 9 + 1) * 0.16;
    p.armL.rotation.x = -0.24; p.armR.rotation.x = -0.24;
    c.rig.position.y = Math.abs(Math.sin(t * 7.5)) * 0.12;
    p.head.rotation.x = -0.10;
    p.legL.rotation.x = Math.sin(t * 7.5) * 0.12;
    p.legR.rotation.x = -Math.sin(t * 7.5) * 0.12;
    if (Math.random() < dt * 4) spawn(c, pick(['heart', 'star']), 1);
  } else if (st === 'cry') {
    p.armL.rotation.set(-1.85 + Math.sin(t * 13) * 0.1, 0, 0.55);
    p.armR.rotation.set(-1.85 + Math.sin(t * 13 + 1) * 0.1, 0, -0.55);
    p.head.rotation.z = Math.sin(t * 15) * 0.13;
    p.head.rotation.x = 0.16;
    c.rig.position.y = Math.abs(Math.sin(t * 11)) * 0.03;
    p.legL.rotation.x = 0.08; p.legR.rotation.x = 0.08;
    if (Math.random() < dt * 7) {
      spawn(c, 'tear', 1, { y: 1.35 * S, dx: (Math.random() < 0.5 ? -0.09 : 0.09), vy: 0.2, life: 0.8 });
    }
  } else if (st === 'spin') {
    c.spinY = (c.spinY || 0) + 9.5 * dt;
    p.armL.rotation.z = -1.5; p.armR.rotation.z = 1.5;
    c.rig.position.y = Math.abs(Math.sin(t * 8)) * 0.05;
  } else if (st === 'hop') {
    var k = clamp(t / 0.62, 0, 1);
    c.rig.position.y = Math.sin(Math.PI * k) * 0.55;
    p.legL.rotation.x = -0.5 * Math.sin(Math.PI * k);
    p.legR.rotation.x = -0.5 * Math.sin(Math.PI * k);
    p.armL.rotation.z = -1.5; p.armR.rotation.z = 1.5;
    p.head.rotation.x = -0.08;
  } else if (st === 'dance') {
    var d = Math.sin(t * 7);
    p.armL.rotation.z = -1.9 - d * 0.6;
    p.armR.rotation.z = 1.9 - d * 0.6;
    p.armL.rotation.x = -0.3 + d * 0.2;
    p.armR.rotation.x = -0.3 - d * 0.2;
    c.rig.position.y = Math.abs(Math.sin(t * 7)) * 0.09;
    c.rig.rotation.z = Math.sin(t * 3.5) * 0.09;
    p.head.rotation.z = Math.sin(t * 3.5) * 0.1;
    p.legL.rotation.x = Math.sin(t * 7) * 0.18;
    p.legR.rotation.x = -Math.sin(t * 7) * 0.18;
    if (Math.random() < dt * 3) spawn(c, pick(['star', 'heart']), 1);
  } else if (st === 'flip') {
    var f = clamp(t / 0.9, 0, 1);
    c.rig.rotation.x = -Math.PI * 2 * f;
    c.rig.position.y = Math.sin(Math.PI * f) * 0.9;
    p.legL.rotation.x = -1.0; p.legR.rotation.x = -0.8;
    p.armL.rotation.z = -1.4; p.armR.rotation.z = 1.4;
    p.armL.rotation.x = -0.6; p.armR.rotation.x = -0.6;
    c.spinY = 0;
  } else if (st === 'held') {
    var w = Math.sin(t * 11);
    c.rig.rotation.z = w * 0.16;
    c.rig.rotation.x = -0.12 + Math.sin(t * 8) * 0.1;
    c.rig.position.y = Math.sin(t * 6) * 0.04;
    p.armL.rotation.z = -1.9 + Math.sin(t * 13) * 0.45;
    p.armR.rotation.z = 1.9 - Math.sin(t * 13 + 1) * 0.45;
    p.armL.rotation.x = Math.sin(t * 9) * 0.3;
    p.armR.rotation.x = -Math.sin(t * 9) * 0.3;
    p.legL.rotation.x = Math.sin(t * 10) * 0.7;
    p.legR.rotation.x = -Math.sin(t * 10 + 1) * 0.7;
    p.head.rotation.z = Math.sin(t * 9) * 0.12;
  } else if (st === 'fly' || st === 'roll') {
    var spd = Math.hypot(c.vx, c.vz);
    c.rig.rotation.x = -c.roll;
    p.armL.rotation.z = -1.25 + Math.sin(t * 12) * 0.35;
    p.armR.rotation.z = 1.25 - Math.sin(t * 12 + 1) * 0.35;
    p.legL.rotation.x = -0.35 + Math.sin(t * 9) * 0.4;
    p.legR.rotation.x = -0.35 - Math.sin(t * 9) * 0.4;
    c.rig.position.y = 0;
  } else if (st === 'getup') {
    var gk = clamp(t / 0.5, 0, 1);
    c.rig.rotation.x = lerp(c.rollAt, 0, gk);
    p.legL.rotation.x = lerp(-0.6, 0, gk);
    p.legR.rotation.x = lerp(-0.5, 0, gk);
    p.armL.rotation.z = lerp(-1.2, -0.15, gk);
    p.armR.rotation.z = lerp(1.2, 0.15, gk);
    c.rig.position.y = Math.sin(Math.PI * gk) * 0.06;
    c.roll = lerp(c.rollAt, 0, gk);
  }

  c.root.rotation.y = c.faceAng + (c.spinY || 0);
}

/* ---------------- 비행/구르기 물리 ---------------- */
var GRAV = 17, WALL_R = 4.6, GROUND_R = 2.85;

function updateFlight(c, dt) {
  var rr, nx, nz, dot;
  if (c.state === 'fly') {
    c.vy -= GRAV * dt;
    c.x += c.vx * dt;
    c.z += c.vz * dt;
    c.y += c.vy * dt;
    c.roll += (c.spinV || 0) * dt;
    var spd = Math.hypot(c.vx, c.vz);
    if (spd > 0.4) faceTo(c, Math.atan2(c.vx, c.vz), dt, 6);
  } else {
    var hs = Math.hypot(c.vx, c.vz);
    c.roll += hs * dt * 3.4;
    c.x += c.vx * dt;
    c.z += c.vz * dt;
    var fr = Math.exp(-3.3 * dt);
    c.vx *= fr; c.vz *= fr;
  }

  /* 바다 경계 */
  rr = Math.hypot(c.x, c.z);
  if (rr > WALL_R) {
    nx = c.x / rr; nz = c.z / rr;
    c.x = nx * WALL_R; c.z = nz * WALL_R;
    dot = c.vx * nx + c.vz * nz;
    c.vx = (c.vx - 2 * dot * nx) * 0.55;
    c.vz = (c.vz - 2 * dot * nz) * 0.55;
    spawn(c, 'puff', 2, { y: 0.35 });
  }

  if (c.state === 'fly' && c.y <= 0) {
    c.y = 0;
    var impact = Math.abs(c.vy);
    if (impact > 3.0) {
      c.vy = -c.vy * 0.44;
      c.vx *= 0.74; c.vz *= 0.74;
      spawn(c, 'puff', 4, { y: 0.3 });
      say(c, 'land');
      c.impact = Math.max(c.impact, impact);
    } else {
      c.vy = 0;
      c.rollAt = c.roll % (Math.PI * 2);
      setState(c, 'roll');
      spawn(c, 'puff', 3, { y: 0.25 });
    }
  }

  if (c.state === 'roll') {
    var hs2 = Math.hypot(c.vx, c.vz);
    if (hs2 < 0.55) {
      c.rollAt = c.roll % (Math.PI * 2);
      setState(c, 'getup', 0.5);
      if (c.impact > 5.0) {
        setFace(c, 'cry', 1.8);
        say(c, 'cry');
        spawn(c, 'tear', 2, { y: 1.35 * c.S });
      } else {
        setFace(c, 'dizzy', 1.1);
        if (Math.random() < 0.7) say(c, 'up');
      }
      c.impact = 0;
    }
  }
}

/* ---------------- 그림자 ---------------- */
function updateShadow(c) {
  var sh = c.parts.shadow;
  if (!sh) return;
  var hgt = Math.max(0, c.y + c.rig.position.y);
  var k = clamp(1 - hgt / 3.2, 0.22, 1);
  sh.scale.set(1.15 * c.S * k, 0.68 * c.S * k, 1);
  sh.material.opacity = 0.52 * k;
  sh.position.set(c.x, 0.015, c.z);
}

/* ---------------- 캐릭터 업데이트 ---------------- */
function updateChar(c, dt) {
  c.t += dt;

  /* 말풍선 */
  if (c.bubbleT > 0) {
    c.bubbleT -= dt;
    if (c.bubbleT <= 0) c.bubble.classList.remove('on');
  }
  /* 표정 복귀 */
  if (c.faceHold > 0) {
    c.faceHold -= dt;
    if (c.faceHold <= 0) setFace(c, 'normal');
  }
  /* 깜빡임 */
  if (c.blink > 0) {
    c.blink -= dt;
    if (c.blink <= 0 && c.face === 'blink') setFace(c, 'normal');
  } else if (c.face === 'normal') {
    c.blinkT -= dt;
    if (c.blinkT <= 0) { setFace(c, 'blink'); c.blink = 0.11; c.blinkT = rnd(2.2, 5.0); }
  }

  var st = c.state;

  if (st === 'held') {
    c.root.position.set(c.x, c.y, c.z);
    poseChar(c, dt);
    updateShadow(c);
    return;
  }
  if (st === 'fly' || st === 'roll') {
    updateFlight(c, dt);
    c.root.position.set(c.x, c.y, c.z);
    poseChar(c, dt);
    updateShadow(c);
    return;
  }
  if (st === 'getup') {
    if (c.t >= c.dur) {
      setState(c, 'idle');
      c.idleFor = rnd(1.2, 2.8);
    }
    c.root.position.set(c.x, c.y, c.z);
    poseChar(c, dt);
    updateShadow(c);
    return;
  }

  /* 지상 이동 */
  if (st === 'walk' || st === 'run') {
    var sp = st === 'run' ? 2.35 : 1.05;
    var dx = c.tx - c.x, dz = c.tz - c.z;
    var d = Math.hypot(dx, dz);
    if (d < 0.14) {
      setState(c, 'idle');
      c.idleFor = rnd(0.8, 2.4);
      if (Math.random() < 0.35) { setFace(c, 'smile', 1.0); }
    } else {
      var nx = dx / d, nz = dz / d;
      c.x += nx * sp * dt;
      c.z += nz * sp * dt;
      faceTo(c, Math.atan2(nx, nz), dt, 7);
      c.phase += dt * (st === 'run' ? 11.5 : 6.6);
    }
  } else if (st === 'idle') {
    if (!P.freeze && c.t > c.idleFor) pickBehavior(c);
    if (st !== 'idle') { poseChar(c, dt); return; }
  } else if (c.dur && c.t >= c.dur) {
    setState(c, 'idle');
    c.idleFor = rnd(0.8, 2.6);
  }

  /* 타이머가 끝난 제스처 중 표정 정리 */
  c.root.position.set(c.x, c.y, c.z);
  poseChar(c, dt);

  /* 섬 밖으로 나가지 않게 */
  var rr = Math.hypot(c.x, c.z);
  if (rr > GROUND_R) {
    c.x = c.x / rr * GROUND_R;
    c.z = c.z / rr * GROUND_R;
  }
  updateShadow(c);
}

/* ---------------- 포인터 ---------------- */
var raycaster = null, plane = null, v3 = null, v3b = null;

function ndcFromEvent(e) {
  var r = P.canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * 2 - 1,
    y: -(((e.clientY - r.top) / r.height) * 2 - 1),
    cx: e.clientX - r.left,
    cy: e.clientY - r.top,
    rw: r.width, rh: r.height
  };
}

function hitChar(e) {
  var n = ndcFromEvent(e);
  raycaster.setFromCamera(new THREE.Vector2(n.x, n.y), P.camera);
  var hits = raycaster.intersectObjects(P.pickables, false);
  if (!hits.length) return null;
  return hits[0].object.userData.char;
}

function onDown(e) {
  if (P.phase !== 'ready') return;
  var c = hitChar(e);
  P.ptr.x = e.clientX; P.ptr.y = e.clientY;
  if (!c) return;
  /* 카메라 정면 평면에 집기 */
  var n = ndcFromEvent(e);
  plane.setFromNormalAndCoplanarPoint(
    P.camera.getWorldDirection(new THREE.Vector3()).negate(),
    new THREE.Vector3(c.x, c.y + 0.9 * c.S, c.z)
  );
  raycaster.setFromCamera(new THREE.Vector2(n.x, n.y), P.camera);
  var hitPoint = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, hitPoint);

  P.drag = {
    c: c, id: e.pointerId, sx: e.clientX, sy: e.clientY,
    t0: performance.now(), moved: 0,
    last: new THREE.Vector3(c.x, c.y, c.z),
    v: new THREE.Vector3(0, 0, 0),
    offset: new THREE.Vector3(c.x - hitPoint.x, c.y - hitPoint.y, c.z - hitPoint.z)
  };
  setState(c, 'held');
  c.vx = c.vz = c.vy = 0;
  setFace(c, 'surprise', 3.5);
  if (Math.random() < 0.6) say(c, 'fly');
  c.bubbleT = 0.9;
  P.canvas.setPointerCapture && e.pointerId !== undefined && P.canvas.setPointerCapture(e.pointerId);
  P.canvas.style.cursor = 'grabbing';
  e.preventDefault();
}

function onMove(e) {
  if (P.phase !== 'ready') return;
  var n = ndcFromEvent(e);
  P.ptr.nx = n.x; P.ptr.ny = n.y;

  if (!P.drag) {
    if (e.pointerType === 'mouse') {
      var h = hitChar(e);
      P.canvas.style.cursor = h ? 'grab' : 'default';
    }
    return;
  }
  var d = P.drag;
  d.moved = Math.max(d.moved, Math.hypot(e.clientX - d.sx, e.clientY - d.sy));
  raycaster.setFromCamera(new THREE.Vector2(n.x, n.y), P.camera);
  var hit = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, hit)) return;
  var c = d.c;
  var tx = hit.x + d.offset.x, ty = hit.y + d.offset.y, tz = hit.z + d.offset.z;
  var now = performance.now();
  var dtm = Math.max(0.008, (now - (d.lastT || now - 16)) / 1000);
  d.lastT = now;

  c.x = clamp(tx, -WALL_R, WALL_R);
  c.y = clamp(ty, 0.05, 4.2);
  c.z = clamp(tz, -WALL_R, WALL_R);
  var nx2 = c.x - d.last.x, ny2 = c.y - d.last.y, nz2 = c.z - d.last.z;
  d.v.x = lerp(d.v.x, nx2 / dtm, 0.45);
  d.v.y = lerp(d.v.y, ny2 / dtm, 0.45);
  d.v.z = lerp(d.v.z, nz2 / dtm, 0.45);
  d.last.set(c.x, c.y, c.z);
}

function onUp(e) {
  if (P.phase !== 'ready' || !P.drag) return;
  var d = P.drag, c = d.c;
  P.drag = null;
  P.canvas.style.cursor = 'default';
  try { P.canvas.releasePointerCapture && e.pointerId !== undefined && P.canvas.releasePointerCapture(e.pointerId); } catch (err) {}

  var held = performance.now() - d.t0;
  if (d.moved < 9 && held < 500) {
    /* 콕 찌르기 = 쓰다듬기 */
    c.y = 0; c.vx = c.vz = c.vy = 0;
    setState(c, 'cheer', 1.5);
    setFace(c, 'laugh', 1.9);
    say(c, 'pet');
    spawn(c, 'heart', 4);
    poseChar(c, 0.016);
    return;
  }

  var sp = d.v.length();
  var maxSp = 15;
  if (sp > maxSp) d.v.multiplyScalar(maxSp / sp);
  c.vx = d.v.x; c.vy = Math.max(d.v.y, -1.2); c.vz = d.v.z;
  if (c.vy > 9) c.vy = 9;
  c.spinV = clamp(sp * 0.9, 0, 12) * (Math.random() < 0.5 ? 1 : -1);
  c.y = Math.max(c.y, 0.02);
  c.impact = 0;
  setState(c, 'fly');
  setFace(c, 'surprise', 4);
  spawn(c, 'puff', 3, { y: c.y + 0.2 * c.S });
  if (sp > 3) say(c, 'fly');
  c.roll = 0;
}

/* ---------------- 렌더 루프 ---------------- */
function resize() {
  if (!P.stage || !P.renderer) return;
  var w = P.stage.clientWidth || 320;
  var h = P.stage.clientHeight || 360;
  P.W = w; P.H = h;
  var dpr = Math.min(global.devicePixelRatio || 1, 2);
  P.dpr = dpr;
  P.renderer.setPixelRatio(dpr);
  P.renderer.setSize(w, h, false);
  var aspect = w / Math.max(1, h);
  var tanV = Math.tan(THREE.MathUtils.degToRad(P.camera.fov / 2));
  var z = P.camOverride || clamp(3.1 / (tanV * aspect), 5.9, 14.5);
  P.baseZ = z;
  P.fitZ = z;
  if (!P.zoomZ) P.zoomZ = z;
  P.camera.aspect = aspect;
  P.camera.position.set(P.camX || 0, 0.95 + z * 0.21, z);
  P.camera.lookAt(P.lookX || 0, 0.98, 0);
  P.camera.updateProjectionMatrix();
}

function project(x, y, z) {
  v3.set(x, y, z).project(P.camera);
  return {
    x: (v3.x * 0.5 + 0.5) * P.W,
    y: (-v3.y * 0.5 + 0.5) * P.H,
    z: v3.z
  };
}

var lastHud = 0;
function updateHud(dt) {
  for (var i = 0; i < P.chars.length; i++) {
    var c = P.chars[i];
    var top = c.y + (1.78 * c.S) + c.rig.position.y;
    var pt = project(c.x, top, c.z);
    c.tag.style.transform = 'translate(-50%,-100%) translate(' + pt.x.toFixed(1) + 'px,' + pt.y.toFixed(1) + 'px)';
    var pb = project(c.x, top + 0.52, c.z);
    c.bubble.style.transform = 'translate(-50%,-100%) translate(' + pb.x.toFixed(1) + 'px,' + pb.y.toFixed(1) + 'px)';
    var dist = Math.hypot(c.x, c.z);
    var vis = 'visible';
    c.tag.style.visibility = vis;
  }
}

function frame(now) {
  if (!P.running) return;
  P.raf = requestAnimationFrame(frame);
  if (!P.last) P.last = now;
  var dt = Math.min(0.05, (now - P.last) / 1000);
  P.last = now;
  if (dt <= 0) return;
  P.t += dt;

  /* 카메라: 가족들 가운데를 부드럽게 따라가고, 던져진 가족도 화면 안에 담는다 */
  var cxs = 0, nC = P.chars.length;
  for (var ci0 = 0; ci0 < nC; ci0++) cxs += P.chars[ci0].x;
  cxs = nC ? cxs / nC : 0;
  var lx = clamp(cxs, -1.8, 1.8);
  P.lookX = damp(P.lookX || 0, lx, 1.6, dt);
  P.camX = damp(P.camX || 0, lx + P.ptr.nx * 0.25, 1.6, dt);

  var tanV = Math.tan(THREE.MathUtils.degToRad(P.camera.fov / 2));
  var asp = P.W / Math.max(1, P.H);
  var zNeed = P.baseZ || 6.2;
  for (var ci1 = 0; ci1 < nC; ci1++) {
    var cc = P.chars[ci1];
    zNeed = Math.max(zNeed, cc.z + (Math.abs(cc.x - P.camX) + 0.75) / (tanV * asp) + 0.45);
  }
  P.zoomZ = damp(P.zoomZ || zNeed, clamp(zNeed, P.baseZ || 5.9, 18), 2.2, dt);
  P.camera.position.z = P.zoomZ;
  P.camera.position.x = P.camX;
  P.camera.position.y = damp(P.camera.position.y, (0.95 + P.zoomZ * 0.21) - P.ptr.ny * 0.18, 2.0, dt);
  P.camera.lookAt(P.lookX, 0.98, 0);

  /* 배경 소품 */
  if (P.foam) {
    var s = 1 + Math.sin(P.t * 1.4) * 0.012;
    P.foam.scale.set(s, s, 1);
    P.foam.material.opacity = 0.72 + Math.sin(P.t * 1.4 + 1) * 0.12;
  }
  if (P.foam2) {
    var s2 = 1 + Math.sin(P.t * 1.1 + 2) * 0.02;
    P.foam2.scale.set(s2, s2, 1);
  }
  if (P.ball) P.ball.position.y = 0.3 + Math.abs(Math.sin(P.t * 1.6)) * 0.05;
  if (P.gulls) {
    for (var gi = 0; gi < P.gulls.length; gi++) {
      var g = P.gulls[gi], ud = g.userData;
      var a = P.t * ud.sp + ud.ph;
      g.position.set(Math.cos(a) * ud.r, 4.6 + Math.sin(a * 2) * 0.5, -4.5 + Math.sin(a) * 2.4);
      g.rotation.y = -a;
      var flap = Math.sin(P.t * 9 + ud.ph) * 0.55;
      ud.wL.rotation.z = flap;
      ud.wR.rotation.z = -flap;
    }
  }
  if (P.clouds) {
    for (var ci = 0; ci < P.clouds.length; ci++) {
      var cl = P.clouds[ci];
      cl.position.x += dt * (0.12 + ci * 0.05);
      if (cl.position.x > 12) cl.position.x = -12;
    }
  }

  /* 가끔 다 같이 인사 */
  P.greetT -= dt;
  if (P.greetT <= 0 && !P.freeze) {
    P.greetT = rnd(13, 22);
    var free = P.chars.filter(function (c) { return c.state === 'idle' || c.state === 'walk'; });
    if (free.length >= 2) {
      var a1 = pick(free);
      var b1 = pick(free.filter(function (c) { return c !== a1; }));
      if (b1) {
        faceTo(a1, Math.atan2(b1.x - a1.x, b1.z - a1.z), 1, 8);
        faceTo(b1, Math.atan2(a1.x - b1.x, a1.z - b1.z), 1, 8);
        setState(a1, 'wave', 1.7); setFace(a1, 'laugh', 1.9); say(a1, 'hello');
        setTimeout(function () {
          setState(b1, 'wave', 1.6); setFace(b1, 'laugh', 1.8); say(b1, 'hello');
        }, 500);
      }
    }
  }

  for (var i = 0; i < P.chars.length; i++) updateChar(P.chars[i], dt);
  separate();
  for (var i2 = 0; i2 < P.chars.length; i2++) P.chars[i2].root.position.set(P.chars[i2].x, P.chars[i2].y, P.chars[i2].z);
  updateParticles(dt);
  updateHud(dt);

  P.renderer.render(P.scene, P.camera);
  P.frames++;
  P.fpsTime += dt;
  if (P.fpsTime > 1) { P.fps = Math.round(P.frames / P.fpsTime); P.frames = 0; P.fpsTime = 0; }
  P.tri = P.renderer.info.render.triangles;
}

function startLoop() {
  if (P.running) return;
  P.running = true;
  P.last = 0;
  P.raf = requestAnimationFrame(frame);
}
function stopLoop() {
  P.running = false;
  if (P.raf) cancelAnimationFrame(P.raf);
  P.raf = 0;
}

/* ---------------- 만들기 ---------------- */
function buildScene() {
  P.scene = new THREE.Scene();
  P.scene.fog = new THREE.Fog(0xD3ECF7, 46, 130);
  P.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 200);
  P.camera.position.set(0, 4.2, 9.4);
  P.camera.lookAt(0, 0.95, 0);

  P.scene.add(new THREE.HemisphereLight(0xDCF2FF, 0xF2DFC0, 0.48));
  var dir = new THREE.DirectionalLight(0xFFFFFF, 0.60);
  dir.position.set(4.5, 8.5, 5.5);
  P.scene.add(dir);
  var fill = new THREE.DirectionalLight(0xCFE9FF, 0.18);
  fill.position.set(-5, 3, -4);
  P.scene.add(fill);
  P.scene.add(new THREE.AmbientLight(0xFFFFFF, 0.14));

  buildWorld(P.scene);

  P.ov.innerHTML = '';
  for (var i = 0; i < CAST.length; i++) {
    var c = buildCharacter(CAST[i]);
    c.root.position.set(c.x, 0, c.z);
    c.root.rotation.y = c.faceAng;
    P.scene.add(c.root);
    P.scene.add(c.shadowSpr);
    c.parts.shadow = c.shadowSpr;

    /* 이름표 */
    var tag = document.createElement('div');
    tag.className = 'pg-tag';
    tag.textContent = c.name;
    P.ov.appendChild(tag);
    c.tag = tag;

    /* 말풍선 */
    var bub = document.createElement('div');
    bub.className = 'pg-bub';
    P.ov.appendChild(bub);
    c.bubble = bub;

    /* 집기용 투명 판 */
    var hit = new THREE.Mesh(
      new THREE.SphereGeometry(0.62, 10, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    hit.position.y = 0.85 * c.S;
    hit.userData.char = c;
    c.root.add(hit);
    P.pickables.push(hit);

    P.chars.push(c);
  }

  raycaster = new THREE.Raycaster();
  plane = new THREE.Plane();
  v3 = new THREE.Vector3();
  v3b = new THREE.Vector3();

  resize();
  P.canvas.addEventListener('pointerdown', onDown, { passive: false });
  P.canvas.addEventListener('pointermove', onMove, { passive: true });
  P.canvas.addEventListener('pointerup', onUp);
  P.canvas.addEventListener('pointercancel', onUp);
  P.canvas.addEventListener('pointerleave', function () { P.ptr.nx = 0; P.ptr.ny = 0; });
  P.canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
}

function fail(msg) {
  P.phase = 'error';
  P.errMsg = msg;
  var box = document.getElementById('pgFallback');
  if (box) {
    box.classList.remove('hidden');
    var t = document.getElementById('pgFallbackMsg');
    if (t && msg) t.textContent = msg;
  }
}

function loadThree(cb) {
  if (global.THREE) return cb();
  var s = document.createElement('script');
  s.src = THREE_URL;
  s.async = true;
  s.onload = function () { cb(); };
  s.onerror = function () { cb(new Error('three.load')); };
  document.head.appendChild(s);
}

function init() {
  if (P.phase === 'ready' || P.phase === 'loading') return;
  P.stage = document.getElementById('pgStage');
  P.ov = document.getElementById('pgOverlay');
  if (!P.stage || !P.ov) return;
  P.phase = 'loading';
  var loading = document.getElementById('pgLoading');
  if (loading) loading.classList.remove('hidden');

  loadThree(function (err) {
    if (loading) loading.classList.add('hidden');
    if (err || !global.THREE) { fail('3D 도구를 불러오지 못했어요.'); return; }
    try {
      P.canvas = document.createElement('canvas');
      P.canvas.className = 'pg-canvas';
      P.stage.insertBefore(P.canvas, P.ov);
      P.renderer = new THREE.WebGLRenderer({
        canvas: P.canvas, antialias: true, alpha: true, powerPreference: 'high-performance'
      });
      P.renderer.setClearAlpha(0);
      if (P.renderer.getContext().isContextLost && P.renderer.getContext().isContextLost()) {
        fail('이 기기에서 3D 화면을 열 수 없어요.');
        return;
      }
      buildScene();
      P.phase = 'ready';
      if (P.active) startLoop();
    } catch (ex) {
      fail('이 브라우저에서는 3D 화면을 켤 수 없어요. (WebGL)');
      if (global.console) console.warn('[가족놀이터]', ex);
    }
  });
}

/* ---------------- 동작 API ---------------- */
function all(list) { return P.chars.filter(function (c) { return list.indexOf(c.state) < 0; }); }

function act(kind) {
  if (P.phase !== 'ready') return;
  var alive = P.chars.filter(function (c) { return c.state !== 'held' && c.state !== 'fly' && c.state !== 'roll'; });
  if (!alive.length) return;
  if (kind === 'laugh') {
    alive.forEach(function (c, i) {
      setTimeout(function () {
        if (c.state === 'held' || c.state === 'fly' || c.state === 'roll') return;
        setState(c, 'cheer', 1.8);
        setFace(c, 'laugh', 2.1);
        spawn(c, pick(['heart', 'star']), 4);
        say(c, 'cheer');
      }, i * 110);
    });
  } else if (kind === 'flip') {
    alive.forEach(function (c, i) {
      setTimeout(function () {
        if (c.state === 'held' || c.state === 'fly' || c.state === 'roll') return;
        setState(c, 'flip', 0.9);
        setFace(c, 'laugh', 1.1);
        say(c, 'flip');
        spawn(c, 'star', 3);
      }, i * 130);
    });
  } else if (kind === 'wave') {
    alive.forEach(function (c, i) {
      setTimeout(function () {
        if (c.state === 'held' || c.state === 'fly' || c.state === 'roll') return;
        setState(c, 'wave', 1.9);
        setFace(c, 'laugh', 2.1);
        say(c, 'wave');
        faceTo(c, 0.15, 1, 8);
      }, i * 90);
    });
  } else if (kind === 'cry') {
    P.chars.forEach(function (c, i) {
      setTimeout(function () {
        if (c.state === 'held' || c.state === 'fly' || c.state === 'roll') return;
        setState(c, 'cry', 2.6);
        setFace(c, 'cry', 3.0);
        say(c, 'cry');
      }, i * 120);
    });
  } else if (kind === 'dance') {
    alive.forEach(function (c, i) {
      setTimeout(function () {
        if (c.state === 'held' || c.state === 'fly' || c.state === 'roll') return;
        setState(c, 'dance', 3.0);
        setFace(c, 'laugh', 3.2);
        say(c, 'dance');
      }, i * 90);
    });
  } else if (kind === 'jump') {
    alive.forEach(function (c, i) {
      setTimeout(function () {
        if (c.state === 'held' || c.state === 'fly' || c.state === 'roll') return;
        setState(c, 'hop', 0.62);
        setFace(c, 'laugh', 0.9);
        say(c, 'jump');
      }, i * 90);
    });
  } else if (kind === 'reset') {
    P.chars.forEach(function (c, i) {
      var cfg = CAST[i];
      c.x = cfg.x; c.z = cfg.z; c.y = 0;
      c.vx = c.vz = c.vy = 0; c.roll = 0; c.impact = 0;
      c.root.position.set(c.x, c.y, c.z);
      c.root.rotation.y = c.faceAng = 0;
      setState(c, 'idle'); c.idleFor = rnd(0.6, 2);
      setFace(c, 'normal');
      c.bubble.classList.remove('on'); c.bubbleT = 0;
    });
  }
}

/* ---------------- 공개 API ---------------- */
var FamPlay = {
  enter: function () {
    P.active = true;
    init();
    if (P.phase === 'ready') {
      resize();
      P.last = 0;
      startLoop();
    }
  },
  leave: function () {
    P.active = false;
    stopLoop();
  },
  act: act,
  pose: function () {
    P.freeze = true;
    act('reset');
    P.chars.forEach(function (c) {
      c.x = c.cfg.x; c.z = c.cfg.z;
      c.faceAng = 0; c.spinY = 0;
      c.root.position.set(c.x, 0, c.z);
      c.root.rotation.y = 0;
      setFace(c, 'normal');
      c.bubble.classList.remove('on'); c.bubbleT = 0;
    });
  },
  freeze: function (on) { P.freeze = !!on; },
  cam: function (z) { P.camOverride = z || null; resize(); },
  testThrow: function (key) {
    if (P.phase !== 'ready') return null;
    var c = null;
    for (var i = 0; i < P.chars.length; i++) if (P.chars[i].key === key) c = P.chars[i];
    if (!c) return null;
    var r = P.canvas.getBoundingClientRect();
    var pt = project(c.x, c.y + 0.9 * c.S, c.z);
    var base = { clientX: r.left + pt.x, clientY: r.top + pt.y, pointerId: 1, pointerType: 'mouse', preventDefault: function () {} };
    onDown(base);
    var held = c.state;
    for (var k = 1; k <= 5; k++) {
      onMove({ clientX: base.clientX + k * 7, clientY: base.clientY - k * 14, pointerId: 1, pointerType: 'mouse' });
    }
    onUp({ clientX: base.clientX + 35, clientY: base.clientY - 70, pointerId: 1, pointerType: 'mouse' });
    return { held: held, after: c.state, vx: +c.vx.toFixed(2), vy: +c.vy.toFixed(2), y: +c.y.toFixed(2) };
  },
  ready: function () { return P.phase === 'ready'; },
  debug: function () {
    return {
      phase: P.phase,
      fps: P.fps,
      chars: P.chars.map(function (c) {
        var pt = P.phase === 'ready' ? project(c.x, c.y + 0.9 * c.S, c.z) : { x: 0, y: 0 };
        return {
          key: c.key, name: c.name, st: c.state, face: c.face,
          x: +c.x.toFixed(2), y: +c.y.toFixed(2), z: +c.z.toFixed(2),
          sx: Math.round(pt.x), sy: Math.round(pt.y), visible: pt.z < 1
        };
      }),
      tri: P.tri, w: P.W, h: P.H, dpr: P.dpr,
      particles: P.particles.filter(function (p) { return p.live; }).length,
      err: P.errMsg || null
    };
  }
};
global.FamPlay = FamPlay;

/* 화면 밖으로 나가면 잠시 멈춤 */
document.addEventListener('visibilitychange', function () {
  if (document.hidden) stopLoop();
  else if (P.active && P.phase === 'ready') { P.last = 0; startLoop(); }
});
global.addEventListener('resize', function () {
  if (P.phase === 'ready' && P.active) resize();
});
global.addEventListener('orientationchange', function () {
  setTimeout(function () { if (P.phase === 'ready' && P.active) resize(); }, 320);
});
})(window);
