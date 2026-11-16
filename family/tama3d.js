/* ============================================================
   우리가족포털 V14 · 🥚 3D 다마고치 · 내 방 (tama3d.js)
   - Three.js 기반 실제 3D 입체 다마고치(종류 4종 · 이름 직접 설정)
   - 걷기·뛰기·밥먹기·자기·기뻐하기·쓰다듬기 3D 움직임
   - 키우는 방식(밥·애교·놀이·수면 비율)에 따른 성장·성격
   - 3D 입체 방(벽지·바닥·가구·조명) 꾸미기 → 본인 방 저장
   - 다마고치가 그 3D 방 안에서 직접 돌아다니고 가구와 상호작용
     (침대→잠, 밥그릇→밥, 책상→공부, 러그→기뻐하기)
   - V14: 옛 '🛏️ 마이룸'(game4.js)과 '🥚 3D 다마고치'를 한 화면으로 통합
     · 가족 방 구경(가족 칩으로 바로 이동) + 방명록 한마디
     · 포인트 상점에서 산 가구(소파·TV·피아노·어항 등)를 3D 방에 배치
     · 옛 마이룸 데이터(DOC.game.m[].room)는 그대로 보존하고 첫 실행 때
       DOC.v9.room 으로 한 번만 복사해 온다(원본은 지우지 않음)
   - 저장: DOC.v9.tama / DOC.v9.room / DOC.v9.guest (가족 DB · 드라이브 백업 포함)
   ============================================================ */
(function (global) {
  'use strict';

  var F = null, ON = false;
  var THREE_URL = '../three.min.js';
  var paneOn = false, threeReady = false, threeLoading = false;
  var renderer = null, scene = null, camera = null, raf = 0, last = 0;
  var roomG = null, petG = null, roomBuiltKey = '', petBuiltKey = '';
  var state = { mode: 'idle', t: 0, tx: 0, tz: 0, legs: 0, bob: 0 };
  var camYaw = 0;
  var viewId = '';                 /* 방 구경 중인 가족 id (빈 값 = 내 방) */

  /* ---------------- 작은 도구 ---------------- */
  function $(id) { return document.getElementById(id); }
  function d() { return F && F.doc(); }
  function me() { return F && F.me(); }
  function esc(s) { return F ? F.esc(s) : String(s == null ? '' : s); }
  function save() { if (F) F.save(); }
  function toast(m) { if (F) F.toast(m); }
  function now() { return Date.now(); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

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
  function mid() { return me() ? me().id : ''; }
  function owner() { return viewId || mid(); }
  function isMine() { return !viewId || viewId === mid(); }
  function memberOf(id) {
    if (!id || !F || !F.memOf) return null;
    try { return F.memOf(id); } catch (e) { return null; }
  }
  function nameOf(id) {
    if (id === mid()) return (me() && me().name) || '나';
    var m = memberOf(id);
    return (m && m.name) || '가족';
  }
  function emojiOf(id) {
    if (id === mid()) {
      var ms = F.members ? F.members() : [];
      for (var i = 0; i < ms.length; i++) if (ms[i].id === id) return ms[i].emoji || '🙂';
      var m0 = memberOf(id);
      return (m0 && m0.emoji) || '🙂';
    }
    var m = memberOf(id);
    return (m && m.emoji) || '🧑';
  }

  /* ---------------- 다마고치 데이터 ---------------- */
  var SPECIES = {
    dog: { n: '강아지 몽실형', c: 0xC98A5A, c2: 0x8A5A32, ear: 'drop', tail: 'wag' },
    cat: { n: '고양이 나비형', c: 0x9AA4AF, c2: 0x6B7480, ear: 'point', tail: 'long' },
    dragon: { n: '아기 드래곤', c: 0x7CD9A8, c2: 0x3FA97A, ear: 'horn', tail: 'long' },
    hamster: { n: '햄스터 바나나형', c: 0xF0B24C, c2: 0xC98A32, ear: 'round', tail: 'none' }
  };
  function needXP(lv) { return 50 + lv * 30; }

  function tamaRec(id, decay) {
    var v = V9();
    if (!v || !id) return null;
    var t = v.tama[id];
    if (!t) return null;
    if (!t.acts) t.acts = { meal: 0, pet: 0, play: 0, sleep: 0 };
    if (decay) {
      /* 자리 비운 시간만큼 컨디션 감소(12시간 한도) */
      var dt = now() - (t.tick || now());
      if (dt > 15 * 60000) {
        var h = Math.min(12, dt / 3600000);
        t.full = clamp(Math.round(t.full - h * 4), 0, 100);
        t.happy = clamp(Math.round(t.happy - h * 3), 0, 100);
        t.energy = clamp(Math.round(t.energy - h * 2), 0, 100);
        t.tick = now(); t.at = now();
        save();
      }
    }
    t.tick = t.tick || now();
    return t;
  }
  /* 내 펫(키우기) — force 면 새로 만든다 */
  function tamaOf(force) {
    var v = V9(), id = mid();
    if (!v || !id) return null;
    var t = v.tama[id];
    if (!t && force) {
      t = v.tama[id] = { sp: '', name: '', born: now(), full: 70, happy: 70, energy: 70, xp: 0, lv: 1, acts: { meal: 0, pet: 0, play: 0, sleep: 0 }, at: now() };
    }
    return tamaRec(id, true);
  }
  /* 보고 있는 방의 펫 (남의 방은 컨디션을 건드리지 않는다) */
  function tamaView() { return tamaRec(owner(), isMine()); }

  function personality(t) {
    if (!t || t.lv < 2) return '자라는 중';
    var a = t.acts || {}, sum = (a.meal || 0) + (a.pet || 0) + (a.play || 0) + (a.sleep || 0);
    if (!sum) return '자라는 중';
    if ((a.meal || 0) / sum >= 0.45) return '먹보 씨앗';
    if ((a.pet || 0) / sum >= 0.4) return '애교쟁이';
    if ((a.play || 0) / sum >= 0.4) return '장난꾸러기';
    if ((a.sleep || 0) / sum >= 0.4) return '잠꾸러기';
    return '얌전하고 다정함';
  }

  /* ---------------- 방 데이터 ---------------- */
  var DEFAULT_ROOM = { wall: '#EAF7F1', floor: '#E7D3BC', items: { bed: 1, desk: 1, rug: 1, plant: 1, lamp: 1, shelf: 1 }, light: 'warm' };
  var DECO_MAP = { f_bed: 'bed', f_desk: 'desk', f_sofa: 'sofa', f_plant: 'plant', f_lamp: 'lamp', f_tv: 'tv', f_poster: 'poster', f_teddy: 'teddy', f_piano: 'piano', f_fish: 'fish' };
  function cloneItems(o) {
    var r = {};
    if (o) for (var k in o) if (o[k]) r[k] = 1;
    return r;
  }
  /* 옛 마이룸(game4) 방 → 3D 방 모양으로 읽기만 한다 */
  function legacyRoom(id) {
    var D = d();
    if (!D || !D.game || !D.game.m || !D.game.m[id]) return null;
    var r = D.game.m[id].room;
    if (!r) return null;
    var items = {};
    (r.items || []).forEach(function (x) { var k = DECO_MAP[x]; if (k) items[k] = 1; });
    return { wall: r.wall || DEFAULT_ROOM.wall, floor: r.floor || DEFAULT_ROOM.floor, items: items, light: 'warm' };
  }
  function roomFor(id, force) {
    var v = V9();
    if (!v || !id) return null;
    var r = v.room[id];
    if (!r && id === mid()) {
      var lg = legacyRoom(id);
      if (lg) {
        /* 한 번만 복사 — 옛 마이룸 원본(DOC.game)은 그대로 둔다 */
        r = v.room[id] = { wall: lg.wall, floor: lg.floor, items: cloneItems(lg.items), light: 'warm', at: now(), from: 'myroom' };
        save();
      } else if (force) {
        r = v.room[id] = { wall: DEFAULT_ROOM.wall, floor: DEFAULT_ROOM.floor, items: cloneItems(DEFAULT_ROOM.items), light: 'warm', at: now() };
        save();
      }
    }
    if (!r && id !== mid()) return legacyRoom(id);
    if (r && !r.items) r.items = {};
    return r;
  }
  function roomOf(force) { return roomFor(owner(), !!force && isMine()); }
  function roomHas(itemKey) {
    var r = roomOf(false);
    return !!(r && r.items && r.items[itemKey]);
  }
  /* 포인트 상점에서 산 가구인지(내 것만 확인) */
  function shopOwned(shopId) {
    var D = d();
    if (!D || !D.game || !D.game.m || !D.game.m[mid()]) return false;
    var c = D.game.m[mid()];
    return !!(c.items && c.items[shopId]);
  }
  function goldOf() {
    var D = d();
    if (!D || !D.game || !D.game.m || !D.game.m[mid()]) return 0;
    return D.game.m[mid()].gold | 0;
  }

  /* ---------------- 방명록 ---------------- */
  function guestOf(id) {
    var v = V9();
    if (!v) return {};
    if (!v.guest[id] || typeof v.guest[id] !== 'object') v.guest[id] = {};
    return v.guest[id];
  }
  function guestList(id) {
    var g = guestOf(id), out = [];
    Object.keys(g).forEach(function (k) {
      var v = g[k];
      if (v && v.text) out.push({ by: k, text: v.text, at: v.at || 0 });
    });
    out.sort(function (a, b) { return b.at - a.at; });
    return out;
  }
  function guestWrite(text) {
    var id = owner(), t = String(text || '').trim().slice(0, 60);
    if (!t) { toast('한마디를 적어 주세요'); return false; }
    if (isMine()) { toast('내 방에는 내가 한마디를 남길 수 없어요 — 가족 방에 남겨 보세요'); return false; }
    var g = guestOf(id);
    g[mid()] = { text: t, at: now() };
    save();
    toast('📝 ' + nameOf(id) + ' 님 방에 한마디를 남겼어요');
    return true;
  }

  /* ---------------- 3D 로더 ---------------- */
  function loadThree(cb) {
    if (global.THREE) { threeReady = true; cb(); return; }
    if (threeLoading) return;
    threeLoading = true;
    var s = document.createElement('script');
    s.src = THREE_URL;
    s.async = true;
    s.onload = function () { threeLoading = false; threeReady = !!global.THREE; cb(); };
    s.onerror = function () { threeLoading = false; cb(new Error('three.load')); };
    document.head.appendChild(s);
  }

  function mat(color, opts) {
    var o = { color: color };
    if (opts) for (var k in opts) o[k] = opts[k];
    return new THREE.MeshLambertMaterial(o);
  }
  function boxM(w, h, dp, color, x, y, z, opts) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, dp), mat(color, opts));
    m.position.set(x, y, z);
    return m;
  }

  /* ---------------- 방 만들기 ---------------- */
  var FURN = {
    bed: { n: '🛏️ 침대', free: 1 },
    desk: { n: '📚 책상', free: 1 },
    rug: { n: '🟠 러그', free: 1 },
    plant: { n: '🪴 화분', free: 1 },
    lamp: { n: '💡 무드등', free: 1 },
    shelf: { n: '📚 책장', free: 1 },
    toy: { n: '🧸 장난감', free: 1 },
    sofa: { n: '🛋️ 소파', shop: 'f_sofa' },
    tv: { n: '📺 TV', shop: 'f_tv' },
    poster: { n: '🖼️ 포스터', shop: 'f_poster' },
    teddy: { n: '🧸 곰인형', shop: 'f_teddy' },
    piano: { n: '🎹 피아노', shop: 'f_piano' },
    fish: { n: '🐠 어항', shop: 'f_fish' }
  };
  var WALLS = [['#EAF7F1', '민트'], ['#FFEFE5', '피치'], ['#E9F0FF', '하늘'], ['#F5EFFA', '라벤더'], ['#FFF8E1', '크림'], ['#ECEFF1', '회색']];
  var FLOORS = [['#E7D3BC', '원목'], ['#D9E2D4', '연두 카펫'], ['#EDEDED', '차량 타일'], ['#F3E2CE', '코르크'], ['#DCE7F5', '블루']];
  var LIGHTS = [['warm', '🌅 따뜻한'], ['white', '💡 밝은'], ['night', '🌙 무드']];

  function buildRoom() {
    if (!scene) return;
    if (roomG) { scene.remove(roomG); roomG = null; }
    var r = roomOf(false) || DEFAULT_ROOM;
    roomBuiltKey = owner() + '|' + JSON.stringify(r);
    roomG = new THREE.Group();
    var W = 7, Dp = 5, H = 3;
    /* 바닥 */
    var floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.14, Dp), mat(r.floor));
    floor.position.set(0, -0.07, 0);
    roomG.add(floor);
    /* 뒷벽 + 옆벽 */
    var back = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.1), mat(r.wall));
    back.position.set(0, H / 2, -Dp / 2);
    roomG.add(back);
    var side = new THREE.Mesh(new THREE.BoxGeometry(0.1, H, Dp), mat(r.wall));
    side.position.set(-W / 2, H / 2, 0);
    roomG.add(side);
    /* 창문(장식) */
    var win = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 0.04), mat(0xBFE3F5));
    win.position.set(1.6, 1.7, -Dp / 2 + 0.08);
    roomG.add(win);
    var win2 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.05), mat(0xFFFFFF));
    win2.position.set(1.6, 1.7, -Dp / 2 + 0.11);
    roomG.add(win2);

    var it = r.items || {};
    if (it.bed) {
      roomG.add(boxM(1.5, 0.32, 0.9, 0xF3F6F8, -2.5, 0.16, -1.5));
      roomG.add(boxM(0.5, 0.14, 0.6, 0xFFFFFF, -3.0, 0.4, -1.5));
      roomG.add(boxM(0.9, 0.14, 0.86, 0xFF9F8A, -2.35, 0.39, -1.5));
      roomG.userData.bed = new THREE.Vector3(-2.5, 0, -1.5);
    }
    if (it.desk) {
      roomG.add(boxM(1.4, 0.08, 0.7, 0xB98A5A, 2.4, 0.62, -1.9));
      [[1.8, -1.6], [3.0, -1.6], [1.8, -2.2], [3.0, -2.2]].forEach(function (p) {
        roomG.add(boxM(0.07, 0.62, 0.07, 0x8A6242, p[0], 0.31, p[1]));
      });
      roomG.add(boxM(0.5, 0.08, 0.5, 0x5C8F6E, 2.4, 0.3, -1.2));
      roomG.userData.desk = new THREE.Vector3(2.4, 0, -1.3);
    }
    if (it.rug) {
      var rug = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.03, 24), mat(0xFFC24B));
      rug.position.set(0, 0.02, 0.7); roomG.add(rug);
      roomG.userData.rug = new THREE.Vector3(0, 0, 0.7);
      roomG.userData.bowl = new THREE.Vector3(0.9, 0, 0.5);
    }
    if (it.plant) {
      var pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.24, 10), mat(0xC96F4A));
      pot.position.set(3.1, 0.12, 1.7); roomG.add(pot);
      var leaf = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 8), mat(0x3FA96B));
      leaf.position.set(3.1, 0.55, 1.7); roomG.add(leaf);
    }
    if (it.lamp) {
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 8), mat(0x8A8F98));
      pole.position.set(-3.1, 0.55, 1.5); roomG.add(pole);
      var shade = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.3, 12, 1, true), mat(0xFFE1A8, { side: THREE.DoubleSide }));
      shade.position.set(-3.1, 1.2, 1.5); roomG.add(shade);
      var lightCol = r.light === 'white' ? 0xFFF6E0 : (r.light === 'night' ? 0x6E7FB0 : 0xFFD9A0);
      var pl = new THREE.PointLight(lightCol, 0.9, 12);
      pl.position.set(-3.1, 1.25, 1.5);
      roomG.add(pl);
      roomG.userData.pl = pl;
    }
    if (it.shelf) {
      roomG.add(boxM(0.9, 1.5, 0.3, 0x8A6242, 0.3, 0.75, -2.25));
      for (var i = 0; i < 6; i++) {
        roomG.add(boxM(0.1, 0.3, 0.2, [0xE5484D, 0x4C8DFF, 0x0E9F6E, 0xFFC24B, 0x8B7CF6, 0xFF7A66][i], 0.02 + (i % 3) * 0.16, 0.5 + Math.floor(i / 3) * 0.45, -2.2));
      }
      roomG.userData.shelf = new THREE.Vector3(0.3, 0, -1.8);
    }
    if (it.toy) {
      roomG.add(boxM(0.6, 0.4, 0.45, 0x8B7CF6, -3.0, 0.2, 0.3));
      var ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mat(0xFF7A66));
      ball.position.set(-2.85, 0.48, 0.3); roomG.add(ball);
    }
    /* 🛍️ 포인트 상점 가구 — 옛 마이룸에서 사 둔 물건을 3D로 옮겨 놓는다 */
    if (it.sofa) {
      roomG.add(boxM(1.6, 0.32, 0.62, 0x7A8FA6, -1.7, 0.18, 1.9));
      roomG.add(boxM(1.6, 0.4, 0.18, 0x6A7E93, -1.7, 0.52, 2.16));
      [-2.45, -0.95].forEach(function (x) { roomG.add(boxM(0.14, 0.3, 0.5, 0x6A7E93, x, 0.32, 2.0)); });
      roomG.userData.sofa = new THREE.Vector3(-1.7, 0, 1.7);
    }
    if (it.tv) {
      roomG.add(boxM(0.9, 0.5, 0.07, 0x22262B, 0.15, 0.72, -2.28));
      roomG.add(boxM(0.82, 0.44, 0.02, 0x5FC7E8, 0.15, 0.72, -2.23, { emissive: 0x1E6C86 }));
      roomG.add(boxM(0.5, 0.32, 0.3, 0x3C4450, 0.15, 0.16, -2.2));
    }
    if (it.poster) {
      roomG.add(boxM(0.8, 1.0, 0.04, 0xFFFFFF, -1.5, 1.9, -2.42));
      roomG.add(boxM(0.62, 0.8, 0.02, 0xFFC24B, -1.5, 1.9, -2.39));
      roomG.add(boxM(0.34, 0.34, 0.02, 0x0E9F6E, -1.5, 2.0, -2.37));
      roomG.add(boxM(0.5, 0.1, 0.02, 0xE5484D, -1.5, 1.62, -2.37));
    }
    if (it.teddy) {
      var tb2 = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), mat(0xC98A5A));
      tb2.position.set(-1.35, 0.17, -0.95); roomG.add(tb2);
      var th = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), mat(0xD69C6C));
      th.position.set(-1.35, 0.4, -0.95); roomG.add(th);
      [-1.45, -1.25].forEach(function (x) {
        var e = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), mat(0xC98A5A));
        e.position.set(x, 0.5, -0.95); roomG.add(e);
      });
    }
    if (it.piano) {
      roomG.add(boxM(1.1, 0.62, 0.5, 0x2B3138, 2.6, 0.55, 1.6));
      roomG.add(boxM(1.0, 0.06, 0.34, 0xF5F7F8, 2.6, 0.9, 1.45));
      for (var pk = 0; pk < 10; pk++) roomG.add(boxM(0.05, 0.03, 0.2, 0x9AA4AF, 2.2 + pk * 0.087, 0.93, 1.45));
      [-0.4, 0.4].forEach(function (x) { roomG.add(boxM(0.08, 0.5, 0.08, 0x2B3138, 2.6 + x, 0.25, 1.75)); });
      roomG.userData.piano = new THREE.Vector3(2.6, 0, 1.35);
    }
    if (it.fish) {
      roomG.add(boxM(0.66, 0.4, 0.36, 0xBFE3F5, 1.15, 0.55, -2.15, { transparent: true, opacity: 0.55 }));
      roomG.add(boxM(0.7, 0.04, 0.4, 0x8A8F98, 1.15, 0.34, -2.15));
      var fi = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), mat(0xFF8A3D));
      fi.position.set(1.1, 0.58, -2.15); roomG.add(fi);
    }
    /* 밥그릇(러그 없어도 항상) */
    if (!roomG.userData.bowl) roomG.userData.bowl = new THREE.Vector3(1.2, 0, 1.2);
    roomG.add(boxM(0.22, 0.09, 0.22, 0x4C8DFF, roomG.userData.bowl.x, 0.05, roomG.userData.bowl.z));
    scene.add(roomG);
    applyLight(r.light);
  }
  function applyLight(mode) {
    if (!roomG || !roomG.userData.pl || !scene) return;
    scene.children.forEach(function (o) {
      if (o.isAmbientLight || o.isDirectionalLight || o.isHemisphereLight) scene.remove(o);
    });
    var amb, dir;
    if (mode === 'night') {
      amb = new THREE.AmbientLight(0x8A93B8, 0.55);
      dir = new THREE.DirectionalLight(0x6E7FB0, 0.35);
    } else if (mode === 'white') {
      amb = new THREE.AmbientLight(0xFFFFFF, 0.85);
      dir = new THREE.DirectionalLight(0xFFFFFF, 0.55);
    } else {
      amb = new THREE.AmbientLight(0xFFE8CC, 0.75);
      dir = new THREE.DirectionalLight(0xFFD9A0, 0.45);
    }
    dir.position.set(3, 6, 4);
    scene.add(amb); scene.add(dir);
    roomG.userData.pl.intensity = mode === 'night' ? 1.2 : 0.9;
  }

  /* ---------------- 다마고치 만들기 ---------------- */
  function buildPet(spKey) {
    var sp = SPECIES[spKey] || SPECIES.dog;
    var g = new THREE.Group();
    var bodyM = mat(sp.c), darkM = mat(sp.c2);
    var body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 14), bodyM);
    body.scale.set(1, 0.9, 1.15); body.position.y = 0.36; g.add(body);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 14), bodyM);
    head.position.set(0, 0.72, 0.28); g.add(head);
    [-0.1, 0.1].forEach(function (x) {
      var eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), mat(0x22262B));
      eye.position.set(x, 0.76, 0.5); g.add(eye);
    });
    [-0.17, 0.17].forEach(function (x) {
      var ch = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), mat(0xFFB1A3));
      ch.position.set(x, 0.68, 0.48); g.add(ch);
    });
    var earGeo;
    if (sp.ear === 'drop') earGeo = new THREE.BoxGeometry(0.1, 0.22, 0.05);
    else if (sp.ear === 'point') earGeo = new THREE.ConeGeometry(0.09, 0.2, 4);
    else if (sp.ear === 'horn') earGeo = new THREE.ConeGeometry(0.05, 0.16, 6);
    else earGeo = new THREE.SphereGeometry(0.08, 8, 8);
    [-0.15, 0.15].forEach(function (x) {
      var ear = new THREE.Mesh(earGeo, darkM);
      ear.position.set(x, 0.94, 0.24);
      if (sp.ear === 'drop') ear.rotation.z = x < 0 ? 0.4 : -0.4;
      g.add(ear);
    });
    if (sp.ear === 'horn') {
      var h2 = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 6), mat(0xFFF3D6));
      h2.position.set(0, 0.98, 0.18); g.add(h2);
    }
    var legs = [];
    [[-0.18, 0.14], [0.18, 0.14], [-0.18, -0.16], [0.18, -0.16]].forEach(function (p, i) {
      var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.2, 8), darkM);
      leg.position.set(p[0], 0.1, p[1]);
      g.add(leg); legs.push(leg);
    });
    var tail = null;
    if (sp.tail !== 'none') {
      tail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.02, sp.tail === 'long' ? 0.42 : 0.16, 8), darkM);
      tail.position.set(0, sp.tail === 'long' ? 0.55 : 0.4, -0.42);
      tail.rotation.x = sp.tail === 'long' ? 0.9 : -1.2;
      g.add(tail);
    }
    if (spKey === 'dragon') {
      [-0.2, 0.2].forEach(function (x) {
        var wing = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 4), mat(0x3FA97A, { side: THREE.DoubleSide }));
        wing.position.set(x, 0.6, -0.25);
        wing.rotation.z = x < 0 ? 1.2 : -1.2;
        g.add(wing);
      });
    }
    g.userData = { legs: legs, tail: tail, head: head, body: body };
    return g;
  }

  /* ---------------- 씬 초기화 ---------------- */
  function init3D() {
    if (!scene) {
      var cv = $('t9Canvas');
      if (!cv || !global.THREE) return false;
      try {
        renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
        renderer.setClearColor(0xF5F7F8);
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(50, 2, 0.1, 60);
        resize3D();
      } catch (e) { console.warn('tama3d init', e); return false; }
    }
    return true;
  }
  function resize3D() {
    if (!renderer) return;
    var box = $('t9CanvasWrap');
    if (!box) return;
    var w = box.clientWidth || 320, h = box.clientHeight || 240;
    renderer.setSize(w, h, false);
    if (camera) { camera.aspect = w / h; camera.updateProjectionMatrix(); }
  }
  function placePet() {
    var t = tamaView();
    if (!t || !petG) return;
    if (!petG.position.x && !petG.position.z) petG.position.set(0, 0, 0.7);
  }
  function ensureScene() {
    if (!init3D()) return;
    var r = roomOf(false);
    var rKey = owner() + '|' + JSON.stringify(r || DEFAULT_ROOM);
    if (!roomG || roomBuiltKey !== rKey) buildRoom();
    var t = tamaView();
    var pKey = owner() + ':' + (t && t.sp ? t.sp : '');
    if (petG && petBuiltKey !== pKey) {
      try { scene.remove(petG); } catch (e) {}
      petG = null; petBuiltKey = '';
    }
    if (!petG && t && t.sp) {
      petG = buildPet(t.sp); petBuiltKey = pKey;
      scene.add(petG); placePet();
    }
  }

  /* ---------------- 행동 ---------------- */
  function walkTo(target, speed, next) {
    state.tx = target.x; state.tz = target.z;
    state.speed = speed || 0.5;
    state.mode = 'move';
    state.next = next || 'idle';
    state.t = 0;
  }
  function doAct(act) {
    if (!isMine()) { toast('가족 방은 구경만 할 수 있어요 — 내 방에서 돌봐 주세요'); return; }
    var t = tamaOf(true), r = roomOf(false) || {};
    if (!t) return;
    if (!scene) ensureScene();
    if (act === 'meal') {
      t.full = clamp(t.full + 18, 0, 100); t.happy = clamp(t.happy + 3, 0, 100);
      t.xp += 6; t.acts.meal = (t.acts.meal || 0) + 1;
      walkTo(roomG && roomG.userData.bowl ? roomG.userData.bowl : new THREE.Vector3(1.2, 0, 1.2), 0.55, 'eat');
      toast('🍚 밥그릇으로 가요 — 냠냠!');
    } else if (act === 'sleep') {
      if (state.mode === 'sleep') { state.mode = 'idle'; state.t = 0; toast('🥱 일어났어요!'); return; }
      t.energy = clamp(t.energy + 16, 0, 100); t.happy = clamp(t.happy + 2, 0, 100);
      t.xp += 4; t.acts.sleep = (t.acts.sleep || 0) + 1;
      var bed = roomG && roomG.userData.bed ? roomG.userData.bed : new THREE.Vector3(-2.5, 0, -1.5);
      walkTo(bed, 0.4, 'sleep');
      toast('😴 침대로 가요 — 잘 자요');
    } else if (act === 'cheer') {
      t.happy = clamp(t.happy + 10, 0, 100); t.xp += 6; t.acts.play = (t.acts.play || 0) + 1;
      var rug = roomG && roomG.userData.rug ? roomG.userData.rug : null;
      if (rug) walkTo(rug, 0.9, 'cheer'); else { state.mode = 'cheer'; state.t = 0; }
      toast('🎉 신나게 기뻐해요!');
    } else if (act === 'pet') {
      t.happy = clamp(t.happy + 8, 0, 100); t.xp += 4; t.acts.pet = (t.acts.pet || 0) + 1;
      state.mode = 'pet'; state.t = 0;
      toast('🤗 쓰다듬으니 좋아해요');
    } else if (act === 'walk') {
      t.energy = clamp(t.energy + 2, 0, 100); t.xp += 3;
      walkTo(new THREE.Vector3(rnd(-2.6, 2.6), 0, rnd(-1.6, 1.9)), 0.45, 'idle');
      toast('🚶 방구석 산책 중');
    } else if (act === 'run') {
      t.energy = clamp(t.energy - 4, 0, 100); t.happy = clamp(t.happy + 6, 0, 100);
      t.xp += 6; t.acts.play = (t.acts.play || 0) + 1;
      walkTo(new THREE.Vector3(rnd(-2.6, 2.6), 0, rnd(-1.6, 1.9)), 1.25, 'idle');
      toast('🏃 씩씩하게 뛰어요!');
    } else if (act === 'desk') {
      var dk2 = roomG && roomG.userData.desk ? roomG.userData.desk : null;
      if (!dk2) { toast('📚 책상이 없어요 — 방꾸미기에서 놓아요'); return; }
      t.xp += 8; t.energy = clamp(t.energy - 3, 0, 100);
      walkTo(dk2, 0.5, 'study');
      toast('📚 책상에서 공부해요');
    }
    while (t.xp >= needXP(t.lv)) {
      t.xp -= needXP(t.lv); t.lv++;
      toast('🎉 ' + (t.name || '다마') + '가 Lv.' + t.lv + '로 성장했어요!');
    }
    t.at = now();
    save();
    renderTamaUI();
  }

  /* 프레임 루프 */
  function loopFrame(ts) {
    raf = requestAnimationFrame(loopFrame);
    if (!renderer || !scene) return;
    var dt = Math.min(0.05, (ts - (last || ts)) / 1000);
    last = ts;
    var t = tamaView();
    if (petG && t) {
      var ud = petG.userData;
      if (state.mode === 'move') {
        var dx = state.tx - petG.position.x, dz = state.tz - petG.position.z;
        var dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 0.12) {
          petG.position.x = state.tx; petG.position.z = state.tz;
          var m0 = state.next; state.next = 'idle'; state.mode = m0; state.t = 0;
        } else {
          var vx = dx / dist * state.speed * dt, vz = dz / dist * state.speed * dt;
          petG.position.x += vx; petG.position.z += vz;
          petG.rotation.y = Math.atan2(dx, dz);
          state.legs += dt * (state.speed > 0.8 ? 18 : 10);
          petG.position.y = Math.abs(Math.sin(state.legs * 0.5)) * 0.05;
          ud.legs.forEach(function (l, i) { l.rotation.x = Math.sin(state.legs + i * Math.PI) * 0.6; });
        }
      } else {
        state.t += dt;
        if (state.mode === 'idle') {
          state.legs += dt * 2;
          petG.position.y = Math.sin(state.legs * 1.5) * 0.015;
          ud.legs.forEach(function (l) { l.rotation.x = 0; });
          if (state.t > rnd(2.5, 5)) {
            var roll = Math.random();
            if (roll < 0.55) walkTo(new THREE.Vector3(rnd(-2.6, 2.6), 0, rnd(-1.6, 1.9)), 0.4, 'idle');
            else if (roll < 0.7 && roomG && roomG.userData.bed) walkTo(roomG.userData.bed, 0.4, 'idle');
            else if (roll < 0.85 && roomG && roomG.userData.bowl) walkTo(roomG.userData.bowl, 0.4, 'idle');
            else { state.mode = 'cheer'; state.t = 0; }
          }
        } else if (state.mode === 'eat') {
          petG.rotation.y = 0.2;
          ud.head.position.y = 0.72 - Math.abs(Math.sin(state.t * 6)) * 0.12;
          if (state.t > 2.2) { state.mode = 'cheer'; state.t = 0; ud.head.position.y = 0.72; }
        } else if (state.mode === 'sleep') {
          petG.rotation.z = 1.35;
          petG.position.y = 0.18;
          if (state.t > 6) { state.mode = 'idle'; state.t = 0; petG.rotation.z = 0; petG.position.y = 0; }
        } else if (state.mode === 'cheer') {
          petG.position.y = Math.abs(Math.sin(state.t * 5)) * 0.35;
          petG.rotation.y += dt * 6;
          if (state.t > 1.6) { state.mode = 'idle'; state.t = 0; petG.rotation.y = 0; petG.position.y = 0; }
        } else if (state.mode === 'pet') {
          var s2 = 1 + Math.sin(state.t * 8) * 0.05;
          petG.scale.set(s2, s2, s2);
          if (state.t > 1.6) { state.mode = 'idle'; state.t = 0; petG.scale.set(1, 1, 1); }
        } else if (state.mode === 'study') {
          ud.head.rotation.x = Math.sin(state.t * 2) * 0.15;
          if (state.t > 4) { state.mode = 'idle'; state.t = 0; ud.head.rotation.x = 0; }
        }
      }
      petG.position.x = clamp(petG.position.x, -3.1, 3.1);
      petG.position.z = clamp(petG.position.z, -2.1, 2.1);
      if (ud.tail) ud.tail.rotation.y = Math.sin(state.legs * 0.8 + ts * 0.004) * 0.4;
    }
    var cx = Math.sin(camYaw) * 6.4, cz = Math.cos(camYaw) * 6.4;
    camera.position.set(cx, 3.4, cz + 1.2);
    camera.lookAt(0, 0.9, -0.4);
    renderer.render(scene, camera);
  }

  /* ---------------- UI ---------------- */
  function t9style() {
    if ($('t9style')) return;
    var s = document.createElement('style');
    s.id = 't9style';
    s.textContent = [
      '.t9-hero{display:flex;gap:9px;margin:2px 0 9px;padding:10px 12px 11px;border-radius:15px;background:linear-gradient(180deg,#F2FBF7,#FCFEFD);border:1px solid #D9F0E4}',
      '.t9-hero .t9-info{flex:1;min-width:0}',
      '.t9-hero b{font-size:15px;font-weight:900;letter-spacing:-.3px}',
      '.t9-badge{display:inline-block;font-size:10px;font-weight:800;color:#0A7D56;background:#E7F8F1;border-radius:7px;padding:2px 6px;margin-left:4px;vertical-align:2px;letter-spacing:-.2px}',
      '.t9-sub{font-size:11px;color:#79838F;font-weight:700;margin:3px 0 7px;letter-spacing:-.2px}',
      '.t9-stat{display:flex;align-items:center;gap:6px;margin-top:4px}',
      '.t9-stat .lb{font-size:10.5px;font-weight:800;color:#3C4450;width:57px;flex:none;letter-spacing:-.3px}',
      '.t9-stat .bg{flex:1;height:7px;border-radius:99px;background:#E9EEF2;overflow:hidden}',
      '.t9-stat .bg i{display:block;height:100%;border-radius:99px;transition:width .3s}',
      '.t9-stat .v{font-size:10px;font-weight:800;color:#79838F;width:18px;flex:none;text-align:right}',
      /* 가족 방 구경 칩 */
      '.t9-famrow{display:flex;gap:6px;overflow-x:auto;padding:1px 0 4px;-webkit-overflow-scrolling:touch;scrollbar-width:none}',
      '.t9-famrow::-webkit-scrollbar{display:none}',
      '.t9-fam{flex:none;display:flex;align-items:center;gap:5px;padding:7px 10px;border-radius:12px;background:linear-gradient(180deg,#fff,#F8FAFB);border:1.5px solid #EAEEF2;box-shadow:0 2px 0 #E6ECF1;font-size:11px;font-weight:800;color:#3C4450;letter-spacing:-.3px;white-space:nowrap}',
      '.t9-fam .e{font-size:15px}',
      '.t9-fam small{display:block;font-size:9px;font-weight:700;color:#9AA4AF}',
      '.t9-fam.on{border-color:#0E9F6E;background:linear-gradient(180deg,#F3FCF7,#E9F9F1);color:#0A7D56;box-shadow:0 2px 0 #C4E8D8,0 4px 10px rgba(14,159,110,.12)}',
      '.t9-fam.on small{color:#4C9B7B}',
      '.t9-viewbar{display:flex;align-items:center;gap:6px;margin:1px 0 7px;font-size:11px;font-weight:800;color:#5C6673}',
      '.t9-viewbar .tag{font-size:9.5px;font-weight:900;padding:3px 7px;border-radius:20px;background:#EDF1FF;color:#4C5BD4}',
      '.t9-viewbar .sp{flex:1}',
      '.t9-viewbar button{font-size:10.5px;font-weight:800;padding:5px 9px;border-radius:9px;background:#F1F4F5;color:#4A5662;border:0}',
      /* 펫 종류 선택 */
      '.t9-setup{background:#FCFDFD;border:1px solid #E9EEF2;border-radius:16px;padding:11px;margin-bottom:10px}',
      '.t9-setup-h{font-size:12.5px;font-weight:900;letter-spacing:-.3px;margin:0 0 8px}',
      '.t9-sp-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
      '@media(min-width:430px){.t9-sp-grid{grid-template-columns:repeat(4,1fr)}}',
      '.t9-sp{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:66px;padding:8px 4px 7px;border-radius:14px;background:linear-gradient(180deg,#fff,#F8FAFB);border:1.5px solid #EAEEF2;box-shadow:0 2px 0 #E6ECF1;font-size:11px;font-weight:800;color:#3C4450;letter-spacing:-.3px;line-height:1.2;transition:transform .08s,box-shadow .1s,border-color .12s,background .12s}',
      '.t9-sp img{width:30px;height:30px;display:block}',
      '.t9-sp:active{transform:translateY(2px);box-shadow:none;background:#F1F5F7}',
      '.t9-sp.on{border-color:#0E9F6E;background:linear-gradient(180deg,#F3FCF7,#E9F9F1);color:#0A7D56;box-shadow:0 2px 0 #C4E8D8,0 5px 12px rgba(14,159,110,.12)}',
      '.t9-sp.on::after{content:"\\2713";position:absolute;top:-5px;right:-5px;width:18px;height:18px;border-radius:50%;background:#0E9F6E;color:#fff;font-size:10px;font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px rgba(14,159,110,.35)}',
      '.t9-namerow{display:flex;gap:7px;margin-top:8px}',
      '.t9-namerow .field{margin-bottom:0;flex:1;min-width:0;padding:12px 13px}',
      '.t9-namerow .btn{width:auto;flex:none;padding:0 16px;white-space:nowrap;border-radius:13px;font-size:13.5px}',
      /* 3D 무대 */
      '.t9-canvas-wrap{position:relative;width:100%;height:250px;border-radius:16px;overflow:hidden;background:#F5F7F8;border:1px solid #EAEEF2}',
      '@media(min-width:430px){.t9-canvas-wrap{height:300px}}',
      '#t9Canvas{display:block;width:100%;height:100%;touch-action:pan-y}',
      '.t9-cam-hint{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);padding:4px 10px;border-radius:20px;background:rgba(20,24,29,.5);color:#fff;font-size:10.5px;font-weight:800;letter-spacing:-.2px;pointer-events:none;backdrop-filter:blur(2px)}',
      '.t9-empty-pet{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;background:rgba(245,247,248,.86);font-size:12px;font-weight:800;color:#5C6673;text-align:center;padding:14px}',
      '.t9-empty-pet .e{font-size:34px}',
      /* 돌보기·행동 키패드 */
      '.t9-acts{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:10px}',
      '.t9-acts button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;height:54px;border-radius:14px;background:linear-gradient(180deg,#fff,#F6F9FA);border:1.5px solid #EAEEF2;box-shadow:0 3px 0 #E3EAEF,0 5px 10px rgba(20,24,29,.05);font-size:11px;font-weight:800;color:#3C4450;letter-spacing:-.3px;line-height:1.15;transition:transform .07s,box-shadow .09s,background .12s,border-color .12s}',
      '.t9-acts button span{font-size:17px;line-height:1}',
      '.t9-acts button:active{transform:translateY(3px);box-shadow:0 0 0 #E3EAEF,0 1px 3px rgba(20,24,29,.05);background:#F0F5F3}',
      '.t9-acts button.wide{grid-column:1/-1;flex-direction:row;gap:6px;height:46px;background:linear-gradient(180deg,#EAF9F2,#DEF5E9);border-color:#BFE9D6;color:#0A7D56;box-shadow:0 3px 0 #C4E8D8,0 5px 12px rgba(14,159,110,.10);font-size:12px}',
      '.t9-acts button.wide span{font-size:16px}',
      '@media(hover:hover){.t9-acts button:hover{border-color:#CFE6DC;background:#F4FBF8}.t9-acts button.wide:hover{background:#E1F7EC}}',
      /* 방 꾸미기 키 그리드 */
      '.t9-room{margin-top:12px;border-top:1px solid #EAEEF2;padding-top:11px}',
      '.t9-rh{font-size:12.5px;font-weight:900;letter-spacing:-.3px;display:flex;align-items:center;gap:5px;flex-wrap:wrap}',
      '.t9-rh .tag{font-size:9.5px;font-weight:900;padding:2px 7px;border-radius:20px;background:#F1F4F5;color:#79838F}',
      '.t9-rh-sub{display:block;font-size:10.5px;font-weight:700;color:#79838F;margin-top:2px;letter-spacing:-.2px}',
      '.t9-grp{margin-top:9px}',
      '.t9-glb{font-size:10.5px;font-weight:900;color:#79838F;letter-spacing:.3px;margin-bottom:5px}',
      '.t9-keys{display:flex;flex-wrap:wrap;gap:6px}',
      '.t9-key{flex:1 1 auto;min-width:0;display:flex;align-items:center;justify-content:center;gap:5px;height:38px;padding:0 7px;border-radius:12px;background:linear-gradient(180deg,#fff,#F8FAFB);border:1.5px solid #EAEEF2;box-shadow:0 2px 0 #E6ECF1;font-size:11.5px;font-weight:800;color:#3C4450;letter-spacing:-.3px;white-space:nowrap;overflow:hidden;transition:transform .07s,box-shadow .1s,background .12s,border-color .12s}',
      '.t9-key i{width:13px;height:13px;border-radius:4px;flex:none;box-shadow:inset 0 0 0 1px rgba(20,24,29,.12)}',
      '.t9-key:active{transform:translateY(2px);box-shadow:none;background:#F1F5F7}',
      '.t9-key.on{border-color:#0E9F6E;background:linear-gradient(180deg,#F3FCF7,#E9F9F1);color:#0A7D56;box-shadow:0 2px 0 #C4E8D8}',
      '.t9-key.lock{color:#9AA4AF}',
      '.t9-keys.c2 .t9-key{flex-basis:calc((100% - 6px)/2)}',
      '.t9-keys.c3 .t9-key{flex-basis:calc((100% - 12px)/3)}',
      '.t9-keys.c4 .t9-key{flex-basis:calc((100% - 18px)/4)}',
      '.t9-keys.c5 .t9-key{flex-basis:calc((100% - 24px)/5)}',
      '.t9-shoplink{width:100%;margin-top:8px;height:40px;border-radius:12px;background:linear-gradient(180deg,#EAF9F2,#DEF5E9);border:1.5px solid #BFE9D6;color:#0A7D56;font-size:12px;font-weight:900;box-shadow:0 3px 0 #C4E8D8}',
      /* 방명록 */
      '.t9-guest{margin-top:12px;border-top:1px solid #EAEEF2;padding-top:11px}',
      '.t9-glist{display:flex;flex-direction:column;gap:5px;margin-top:6px;max-height:150px;overflow-y:auto}',
      '.t9-g{display:flex;gap:7px;align-items:flex-start;padding:8px 9px;border-radius:11px;background:#FBFDFC;border:1px solid #EDF1F4}',
      '.t9-g .au{font-size:11px;font-weight:900;color:#3C4450;flex:none}',
      '.t9-g .tx{flex:1;font-size:11.5px;color:#4E5A66;line-height:1.45;word-break:keep-all}',
      '.t9-g .tm{font-size:9.5px;color:#9AA4AF;font-weight:700;flex:none}',
      '.t9-gwrite{display:flex;gap:6px;margin-top:7px}',
      '.t9-gwrite .field{margin:0;flex:1;min-width:0;padding:10px 12px;font-size:12px}',
      '.t9-gwrite button{flex:none;padding:0 13px;border-radius:11px;background:#0E9F6E;color:#fff;font-size:12px;font-weight:900;border:0}'
    ].join('');
    document.head.appendChild(s);
  }
  function bar(lb, v, col) {
    return '<div class="t9-stat"><span class="lb">' + lb + '</span><span class="bg"><i style="width:' + v + '%;background:' + col + '"></i></span><span class="v">' + v + '</span></div>';
  }

  /* 지금 보고 있는 방 표시 */
  function viewBarUI() {
    var vb = $('t9ViewBar');
    if (!vb) return;
    vb.innerHTML = isMine()
      ? '<span>🏠 내 방</span><span class="sp"></span><span style="font-size:10px;color:#9AA4AF">가족 이름을 누르면 그 방으로</span>'
      : '<span>🏠 ' + esc(nameOf(owner())) + ' 님의 방</span><span class="tag">구경 중</span><span class="sp"></span><button type="button" data-t9go="' + esc(mid()) + '">내 방으로</button>';
  }

  /* 가족 방 구경 칩 */
  function famUI() {
    var box = $('t9Fam');
    if (!box) return;
    var ms = F.members ? F.members() : [];
    var mineId = mid();
    var rows = [];
    /* 내 방 먼저 */
    ms.sort(function (a, b) { return (a.id === mineId ? -1 : 0) - (b.id === mineId ? -1 : 0); });
    ms.forEach(function (m) {
      var t = tamaRec(m.id, false);
      var sub = t && t.name ? (t.name + ' Lv.' + t.lv) : '펫 없음';
      var nm = m.id === mineId ? (m.name + ' · 내 방') : m.name;
      rows.push('<button type="button" class="t9-fam' + (owner() === m.id ? ' on' : '') + '" data-t9go="' + m.id + '">' +
        '<span class="e">' + (m.emoji || '🧑') + '</span><span>' + esc(nm) + '<small>' + esc(sub) + '</small></span></button>');
    });
    box.innerHTML = rows.join('');
  }

  function renderTamaUI() {
    var t = tamaView(), box = $('t9Hero');
    famUI();
    viewBarUI();
    if (!box) return;
    var ov = $('t9NoPet');
    if (!t || !t.sp) {
      box.innerHTML = '';
      var a0 = $('t9Acts'); if (a0) a0.classList.add('hidden');
      var e0 = $('t9EditBtn'); if (e0) e0.classList.add('hidden');
      if (ov) {
        ov.classList.remove('hidden');
        ov.innerHTML = isMine()
          ? '<span class="e">🥚</span><b>아직 다마고치가 없어요</b><span>아래에서 종류를 고르고 이름을 지어 주세요</span>'
          : '<span class="e">🏠</span><b>' + esc(nameOf(owner())) + ' 님의 방</b><span>아직 다마고치를 만들지 않았어요 — 방 구경만 할 수 있어요</span>';
      }
      setupUI();
      return;
    }
    if (ov) { ov.classList.add('hidden'); ov.innerHTML = ''; }
    var sp = SPECIES[t.sp] || SPECIES.dog;
    box.innerHTML =
      '<div class="t9-hero"><div class="t9-info">' +
      '<b>' + esc(t.name) + '</b> <span class="t9-badge">' + esc(sp.n) + '</span>' +
      (isMine() ? '' : ' <span class="t9-badge" style="background:#EDF1FF;color:#4C5BD4">' + esc(nameOf(owner())) + ' 님의 펫</span>') +
      '<div class="t9-sub">Lv.' + t.lv + ' · XP ' + t.xp + '/' + needXP(t.lv) + ' · 성격: ' + esc(personality(t)) + '</div>' +
      bar('🍚 포만감', t.full, 'linear-gradient(90deg,#FFB020,#FFD97A)') +
      bar('😊 행복', t.happy, 'linear-gradient(90deg,#FF7A66,#FFB1A3)') +
      bar('⚡ 에너지', t.energy, 'linear-gradient(90deg,#4C8DFF,#8FB8FF)') +
      '</div></div>';
    var acts = $('t9Acts');
    if (acts) acts.classList.toggle('hidden', !isMine());
    var ed = $('t9EditBtn');
    if (ed) ed.classList.toggle('hidden', !isMine());
  }

  function setupUI() {
    var box = $('t9Setup');
    if (!box) return;
    var t = tamaOf(false);
    if (!isMine() || (t && t.sp)) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    /* 옛 2D 다마고치 기록이 있으면 이름을 미리 채워 준다 */
    var legacyName = '';
    var D = d();
    if (D && D.game && D.game.m && D.game.m[mid()] && D.game.m[mid()].name) legacyName = D.game.m[mid()].name;
    box.innerHTML =
      '<div class="t9-setup-h">🥚 내 다마고치 만들기</div>' +
      '<div class="t9-sp-grid">' + Object.keys(SPECIES).map(function (k) {
        var sel = window.__t9sp === k;
        return '<button type="button" class="t9-sp' + (sel ? ' on' : '') + '" data-t9sp="' + k + '" aria-pressed="' + (sel ? 'true' : 'false') + '"><img alt="" src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\'%3E%3Ccircle cx=\'20\' cy=\'22\' r=\'13\' fill=\'%23' + SPECIES[k].c.toString(16).padStart(6, '0') + '\'/%3E%3Ccircle cx=\'15\' cy=\'19\' r=\'2\' fill=\'%23222\'/%3E%3Ccircle cx=\'25\' cy=\'19\' r=\'2\' fill=\'%23222\'/%3E%3C/svg%3E"><span>' + esc(SPECIES[k].n) + '</span></button>';
      }).join('') + '</div>' +
      '<div class="t9-namerow">' +
      '<input class="field" id="t9Name" maxlength="10" value="' + esc(legacyName) + '" placeholder="이름 직접 정하기 (예: 몽글이)">' +
      '<button type="button" class="btn" id="t9Start">태어나기</button></div>' +
      '<div class="hint">종류를 고르고 이름을 지어 주세요. 키우는 방식(밥·쓰다듬기·놀이·재우기)에 따라 성장·성격이 달라져요.' +
      (legacyName ? ' 옛 다마고치 <b>' + esc(legacyName) + '</b> 기록을 이어받아요.' : '') + '</div>';
  }

  /* 방 꾸미기 — 내 방은 편집, 남의 방은 구경(읽기) */
  function roomUI() {
    var r = roomFor(owner(), isMine());
    var box = $('t9Room');
    if (!box) return;
    if (!r) { box.innerHTML = '<div class="t9-rh">🏠 ' + esc(nameOf(owner())) + ' 님의 방<span class="t9-rh-sub">아직 꾸민 방이 없어요 — 기본 방으로 보여 드려요</span></div>'; return; }
    var head = '<div class="t9-rh">' + (isMine() ? '🛏️ 내 방 꾸미기' : '🏠 ' + esc(nameOf(owner())) + ' 님의 방 구경') +
      '<span class="tag">' + (isMine() ? '바로 저장' : '읽기 전용') + '</span>' +
      '<span class="t9-rh-sub">' + (isMine() ? '벽지·바닥·가구·조명을 골라 저장해요' : '가족이 꾸민 방이에요. 방명록에 한마디 남겨 보세요') + '</span></div>';
    var locks = isMine() ? '<div class="t9-grp"><div class="t9-glb">🛍️ 상점 가구 <span style="font-weight:700">— 산 가구만 놓을 수 있어요</span></div><div class="t9-keys c3">' +
      Object.keys(FURN).filter(function (k) { return FURN[k].shop; }).map(function (k) {
        var owns = shopOwned(FURN[k].shop);
        var on = !!(r.items && r.items[k]);
        return '<button type="button" class="t9-key' + (on ? ' on' : '') + (owns ? '' : ' lock') + '" data-t9furn="' + k + '">' + (owns ? '' : '🔒 ') + esc(FURN[k].n) + '</button>';
      }).join('') + '</div></div>' +
      '<button type="button" class="t9-shoplink" data-t9shop="1">🛍️ 포인트 상점에서 가구 사기 · 🪙 ' + goldOf() + 'G</button>' : '';
    var basic = '<div class="t9-grp"><div class="t9-glb">🛋️ 기본 가구</div><div class="t9-keys c4">' +
      Object.keys(FURN).filter(function (k) { return FURN[k].free; }).map(function (k) {
        return '<button type="button" class="t9-key' + (r.items && r.items[k] ? ' on' : '') + '" data-t9furn="' + k + '">' + esc(FURN[k].n) + '</button>';
      }).join('') + '</div></div>';
    var colors = isMine() ? (
      '<div class="t9-grp"><div class="t9-glb">🎨 벽지</div><div class="t9-keys c3">' + WALLS.map(function (w) {
        return '<button type="button" class="t9-key' + (r.wall === w[0] ? ' on' : '') + '" data-t9wall="' + w[0] + '"><i style="background:' + w[0] + '"></i>' + esc(w[1]) + '</button>';
      }).join('') + '</div></div>' +
      '<div class="t9-grp"><div class="t9-glb">🪵 바닥</div><div class="t9-keys c3">' + FLOORS.map(function (w) {
        return '<button type="button" class="t9-key' + (r.floor === w[0] ? ' on' : '') + '" data-t9floor="' + w[0] + '"><i style="background:' + w[0] + '"></i>' + esc(w[1]) + '</button>';
      }).join('') + '</div></div>' +
      '<div class="t9-grp"><div class="t9-glb">💡 조명</div><div class="t9-keys c3">' + LIGHTS.map(function (w) {
        return '<button type="button" class="t9-key' + (r.light === w[0] ? ' on' : '') + '" data-t9light="' + w[0] + '">' + esc(w[1]) + '</button>';
      }).join('') + '</div></div>'
    ) : (
      '<div class="t9-grp"><div class="t9-glb">🎨 벽지 · 🪵 바닥 · 💡 조명</div><div class="t9-gsub" style="display:flex;gap:6px;align-items:center;font-size:11px;font-weight:800;color:#5C6673">' +
      '<i style="width:16px;height:16px;border-radius:5px;background:' + (r.wall || '#eee') + '"></i>' +
      '<i style="width:16px;height:16px;border-radius:5px;background:' + (r.floor || '#eee') + '"></i>' +
      ((r.light === 'night') ? '🌙 무드' : (r.light === 'white' ? '💡 밝은' : '🌅 따뜻한')) + '</div></div>'
    );
    var furnView = isMine() ? '' : '<div class="t9-grp"><div class="t9-glb">🛋️ 놓인 가구 ' + Object.keys(r.items || {}).filter(function (k) { return r.items[k] && FURN[k]; }).length + '개</div>' +
      '<div class="t9-keys c3">' + Object.keys(r.items || {}).filter(function (k) { return r.items[k] && FURN[k]; }).map(function (k) {
        return '<span class="t9-key on">' + esc(FURN[k].n) + '</span>';
      }).join('') + '</div></div>';
    box.innerHTML = head + colors + basic + furnView + locks;
  }

  /* 방명록 */
  function guestUI() {
    var box = $('t9Guest');
    if (!box) return;
    var oid = owner();
    var list = guestList(oid);
    var rows = list.length ? list.slice(0, 8).map(function (g) {
      return '<div class="t9-g"><span class="au">' + emojiOf(g.by) + ' ' + esc(nameOf(g.by)) + '</span>' +
        '<span class="tx">' + esc(g.text) + '</span><span class="tm">' + (F.ago ? F.ago(g.at) : '') + '</span></div>';
    }).join('') : '<div class="t9-g"><span class="tx" style="color:#9AA4AF">' + (isMine() ? '아직 남긴 한마디가 없어요. 가족 방에 먼저 남겨 볼까요?' : '아직 한마디가 없어요 — 첫 번째로 남겨 보세요!') + '</span></div>';
    box.innerHTML =
      '<div class="t9-rh">📝 ' + (isMine() ? '내 방 방명록' : esc(nameOf(oid)) + ' 님 방 방명록') +
      '<span class="tag">' + list.length + '개</span></div>' +
      '<div class="t9-glist">' + rows + '</div>' +
      (isMine() ? '' :
        '<div class="t9-gwrite"><input class="field" id="t9GuestInput" maxlength="60" placeholder="' + esc(nameOf(oid)) + ' 님에게 한마디 (60자)">' +
        '<button type="button" data-t9guest="1">남기기</button></div>');
  }

  /* ---------------- 패널 DOM ---------------- */
  function paneHtml() {
    return '<div class="card" id="t9Card" style="padding:12px 12px 14px">' +
      '<div class="card-head" style="margin-bottom:9px"><h2>🥚 3D 다마고치 · 내 방</h2><span class="sub" id="t9Sub">가족 방 구경 · 방 꾸미기 · 3D 펫</span></div>' +
      '<div class="t9-famrow" id="t9Fam"></div>' +
      '<div class="t9-viewbar" id="t9ViewBar"></div>' +
      '<div id="t9Setup" class="t9-setup hidden"></div>' +
      '<div id="t9Hero"></div>' +
      '<div class="t9-canvas-wrap" id="t9CanvasWrap">' +
      '<canvas id="t9Canvas"></canvas>' +
      '<div class="t9-empty-pet hidden" id="t9NoPet"></div>' +
      '<div class="t9-cam-hint">↔ 드래그해 방을 돌려 봐요</div>' +
      '</div>' +
      '<div class="t9-acts hidden" id="t9Acts">' +
      '<button type="button" data-t9act="meal"><span>🍚</span>밥먹기</button>' +
      '<button type="button" data-t9act="pet"><span>🤗</span>쓰다듬기</button>' +
      '<button type="button" data-t9act="cheer"><span>🎉</span>기뻐하기</button>' +
      '<button type="button" data-t9act="sleep"><span>😴</span>재우기</button>' +
      '<button type="button" data-t9act="walk"><span>🚶</span>걷기</button>' +
      '<button type="button" data-t9act="run"><span>🏃</span>뛰기</button>' +
      '<button type="button" data-t9act="desk" class="wide"><span>📚</span>책상에서 공부</button>' +
      '</div>' +
      '<div class="t9-room" id="t9Room"></div>' +
      '<div class="t9-guest" id="t9Guest"></div>' +
      '<button type="button" class="btn soft hidden" id="t9EditBtn" style="margin-top:9px">✏️ 이름·종류 다시 정하기</button>' +
      '</div>';
  }
  function syncPane() {
    ensureScene();
    resize3D();
    renderTamaUI();
    roomUI();
    guestUI();
  }
  function setView(id) {
    viewId = (!id || id === mid()) ? '' : id;
    state.mode = 'idle'; state.t = 0; state.legs = 0;
    if (petG && scene) { try { scene.remove(petG); } catch (e) {} petG = null; petBuiltKey = ''; }
    if (roomG && scene) { try { scene.remove(roomG); } catch (e) {} roomG = null; roomBuiltKey = ''; }
    syncPane();
    if (!isMine()) toast('🏠 ' + nameOf(owner()) + ' 님의 방을 구경해요');
  }

  function injectPane() {
    var view = $('view-play'), nav = $('pgNav');
    if (!view || !nav || $('pgPane-tama3d')) return true;
    var el = document.createElement('div');
    el.id = 'pgPane-tama3d';
    el.className = 'hidden';
    el.innerHTML = paneHtml();
    view.appendChild(el);
    t9style();
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-pane', 'tama3d');
    btn.textContent = '🥚 다마고치 · 내 방';
    var qb = nav.querySelector('[data-pane="quiz"]');
    if (qb) nav.insertBefore(btn, qb); else nav.appendChild(btn);
    el.addEventListener('click', function (e) {
      var sp = e.target.closest('[data-t9sp]');
      if (sp) { window.__t9sp = sp.getAttribute('data-t9sp'); setupUI(); return; }
      var st = e.target.closest('#t9Start');
      if (st) {
        var name = ($('t9Name').value || '').trim();
        var spk = window.__t9sp;
        if (!spk) { toast('종류를 먼저 골라 주세요'); return; }
        if (!name) { toast('이름을 지어 주세요'); return; }
        var t = tamaOf(true);
        t.sp = spk; t.name = name; t.born = now(); t.tick = now();
        save();
        if (petG && scene) { scene.remove(petG); petG = null; petBuiltKey = ''; }
        ensureScene();
        setupUI(); renderTamaUI();
        toast('🥚 ' + name + ' 태어났어요!');
        return;
      }
      var go = e.target.closest('[data-t9go]');
      if (go) {
        var gid = go.getAttribute('data-t9go');
        if (gid === '__list') {
          var fr = $('t9Fam');
          if (fr) { fr.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
          toast('위쪽 가족 이름을 누르면 그 방으로 가요');
          return;
        }
        setView(gid); return;
      }
      var act = e.target.closest('[data-t9act]');
      if (act) { doAct(act.getAttribute('data-t9act')); return; }
      var eb = e.target.closest('#t9EditBtn');
      if (eb) {
        var tt = tamaOf(false);
        if (tt) { tt.sp = ''; save(); if (petG && scene) { scene.remove(petG); petG = null; petBuiltKey = ''; } renderTamaUI(); setupUI(); roomUI(); }
        return;
      }
      if (e.target.closest('[data-t9shop]')) {
        if (global.GAME4 && global.GAME4.pane) global.GAME4.pane('shop');
        return;
      }
      var gw = e.target.closest('[data-t9guest]');
      if (gw) {
        var inp = $('t9GuestInput');
        if (inp && guestWrite(inp.value)) { inp.value = ''; guestUI(); }
        return;
      }
      if (!isMine()) return;   /* 남의 방은 여기서부터 편집 없음 */
      var wl = e.target.closest('[data-t9wall]');
      if (wl) { roomOf(true).wall = wl.getAttribute('data-t9wall'); save(); buildRoom(); roomUI(); return; }
      var fl = e.target.closest('[data-t9floor]');
      if (fl) { roomOf(true).floor = fl.getAttribute('data-t9floor'); save(); buildRoom(); roomUI(); return; }
      var li = e.target.closest('[data-t9light]');
      if (li) { roomOf(true).light = li.getAttribute('data-t9light'); save(); buildRoom(); roomUI(); return; }
      var fu = e.target.closest('[data-t9furn]');
      if (fu) {
        var k = fu.getAttribute('data-t9furn');
        var meta = FURN[k];
        if (meta && meta.shop && !shopOwned(meta.shop)) {
          toast('🔒 포인트 상점에서 ' + meta.n.replace(/^\S+\s/, '') + '을(를) 먼저 사 주세요');
          if (global.GAME4 && global.GAME4.pane) global.GAME4.pane('shop');
          return;
        }
        var r = roomOf(true);
        r.items[k] = r.items[k] ? 0 : 1;
        save(); buildRoom(); roomUI();
        return;
      }
    });
    /* 캔버스 드래그 회전 */
    var cv = $('t9Canvas');
    if (cv) {
      var dragX = null;
      cv.addEventListener('pointerdown', function (e) { dragX = e.clientX; }, { passive: true });
      cv.addEventListener('pointermove', function (e) {
        if (dragX === null) return;
        camYaw -= (e.clientX - dragX) * 0.01;
        dragX = e.clientX;
      }, { passive: true });
      cv.addEventListener('pointerup', function () { dragX = null; }, { passive: true });
      cv.addEventListener('pointerleave', function () { dragX = null; }, { passive: true });
    }
    return true;
  }

  function showMine() {
    if (!$('pgPane-tama3d') && global.FAM) { if (!ON) mount(global.FAM); else injectPane(); }
    paneOn = true;
    var mine = $('pgPane-tama3d');
    if (!mine) return;
    var pg3d = $('pg3dCard');
    if (pg3d) pg3d.classList.add('hidden');
    document.querySelectorAll('#view-play > [id^="pgPane-"]').forEach(function (p) {
      if (p.id !== 'pgPane-tama3d') p.classList.add('hidden');
    });
    mine.classList.remove('hidden');
    document.querySelectorAll('#pgNav [data-pane]').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-pane') === 'tama3d');
    });
    if (global.FamPlay) global.FamPlay.leave();
    /* 탭을 다시 열면 내 방부터 */
    viewId = '';
    state.mode = 'idle'; state.t = 0;
    if (petG && scene) { try { scene.remove(petG); } catch (e) {} petG = null; petBuiltKey = ''; }
    if (roomG && scene) { try { scene.remove(roomG); } catch (e) {} roomG = null; roomBuiltKey = ''; }
    syncPane();
    if (!raf) { last = 0; raf = requestAnimationFrame(loopFrame); }
  }
  function hideMine() {
    if (!paneOn) return;
    paneOn = false;
    var mine = $('pgPane-tama3d');
    if (mine) mine.classList.add('hidden');
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  /* ---------------- mount ---------------- */
  function mount(FAM) {
    if (ON) return;
    F = FAM; ON = true;
    injectPane();
  }
  function poll() {
    if (ON) return;
    if (global.FAM && global.FAM.doc && global.FAM.doc() && global.FAM.me && global.FAM.me()) mount(global.FAM);
  }
  setInterval(poll, 1200);
  poll();

  /* nav 클릭 가로채기(capture) — 내 패널이면 game4 전환을 막고 내가 처리 */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#pgNav [data-pane]');
    if (!b) return;
    var id = b.getAttribute('data-pane');
    if (id === 'tama3d') {
      e.preventDefault(); e.stopPropagation();
      showMine();
    } else {
      hideMine();
    }
  }, true);
  global.addEventListener('resize', function () { if (paneOn) resize3D(); });

  global.TAMA3D = {
    show: showMine, hide: hideMine,
    render: function () { if (ON && paneOn) { renderTamaUI(); } },
    onView: function (v) { if (v !== 'play') hideMine(); },
    setView: setView
  };
})(window);
