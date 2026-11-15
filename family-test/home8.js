/* ============================================================
   상국수향지섭지율포털 V8 · 홈 최상단(일정·위치) + 아침 브리핑 + 가족별 주변 추천 (home8.js)
   ① ☀️ 오늘의 출근·등교 날씨 & 옷차림  — DOC.morningBrief(매일 06:00 스케줄이 갱신)를 읽어 표시.
      비어 있으면 기본 안내 + 내일 파주 기준 예시를 보여 주고, 06:00 브리핑이 올라오면 자동으로 바뀐다.
   ② 🍽️ 가족 각자의 지금 위치 기준 주변 맛집·카페·가볼만한곳 3곳
      — Nominatim(카테고리 검색) + 위키백과 지오서치로 실시간 조회, 15분·약 1km 캐시.
   ③ 추천 장소를 누르면 세부정보·후기 모달(거리·도로명 주소·영업정보·카카오맵/네이버지도/블로그 후기 연결)
   - 가족 DB는 읽기만 한다(위치·아침 브리핑). 쓰기는 하지 않는다.
   ============================================================ */
(function (global) {
  'use strict';

  var F = null, ON = false, wired = false;

  var NOM = 'https://nominatim.openstreetmap.org/search';
  var WIKI = 'https://ko.wikipedia.org/w/api.php';
  var TTL = 15 * 60 * 1000;          /* 15분 캐시 */
  var CELL = 0.01;                   /* 약 1km 격자 캐시 */
  var NOM_GAP = 1150;                /* Nominatim 예절: 1초에 1회 이하 */
  var BOX_LAT = 0.009, BOX_LON = 0.012;   /* 반경 약 1km 상자 */  var nomChain = Promise.resolve(), nomLast = 0;

  function $(id) { return document.getElementById(id); }
  function d() { return F && F.doc(); }
  function me() { return F && F.me(); }
  function esc(s) { return F ? F.esc(s) : String(s == null ? '' : s); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function toast(m) { if (F) F.toast(m); }

  /* ---------------- 공통 ---------------- */
  function jsonFetch(url, ms) {
    var opt = { cache: 'no-store' };
    var ctrl = null, t = null;
    if (global.AbortController) {
      ctrl = new AbortController();
      opt.signal = ctrl.signal;
      t = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, ms || 8000);
    }
    return fetch(url, opt).then(function (r) {
      if (t) clearTimeout(t);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }, function (e) { if (t) clearTimeout(t); throw e; });
  }
  function meters(aLat, aLon, bLat, bLon) {
    var R = 6371000;
    var dLat = (bLat - aLat) * Math.PI / 180, dLon = (bLon - aLon) * Math.PI / 180;
    var la1 = aLat * Math.PI / 180, la2 = bLat * Math.PI / 180;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return Math.round(2 * R * Math.asin(Math.sqrt(h)));
  }
  function distText(m) {
    if (m === null || m === undefined) return '';
    if (m < 1000) return (Math.round(m / 10) * 10) + 'm';
    return (m / 1000).toFixed(1) + 'km';
  }
  function ymdOf(dt) { return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()); }
  function today() { return ymdOf(new Date()); }
  function mdLabel(s) {
    var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return String(s || '');
    var w = ['일', '월', '화', '수', '목', '금', '토'];
    var dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number(m[2]) + '월 ' + Number(m[3]) + '일 (' + w[dt.getDay()] + ')';
  }
  function stamp(ts) { var x = new Date(ts); return pad(x.getHours()) + ':' + pad(x.getMinutes()); }
  function daysKo(v) {
    return String(v || '')
      .replace(/\bMo\b/g, '월').replace(/\bTu\b/g, '화').replace(/\bWe\b/g, '수')
      .replace(/\bTh\b/g, '목').replace(/\bFr\b/g, '금').replace(/\bSa\b/g, '토').replace(/\bSu\b/g, '일')
      .replace(/\boff\b/gi, '휴무').replace(/,/g, ' · ');
  }

  /* ============================================================
     ① ☀️ 오늘의 출근·등교 날씨 & 옷차림
     ============================================================ */
  var CUISINE_KO = {
    sushi: '초밥', congee: '죽', korean: '한식', japanese: '일식', chinese: '중식', italian: '이탈리아',
    cafe: '카페', coffee_shop: '커피', bakery: '베이커리', chicken: '치킨', pizza: '피자', burger: '버거',
    noodle: '국수', ramen: '라멘', vietnamese: '베트남', asian: '아시아', fast_food: '패스트푸드'
  };
  function cuisineKo(c) {
    if (!c) return '';
    return String(c).split(';').map(function (x) {
      x = x.trim();
      return CUISINE_KO[x] || x;
    }).filter(Boolean).join('·');
  }

  /* 06:00 브리핑이 아직 없을 때 보여 줄 예시(2026-11-16 월 · 파주 기준 실제 예보) */
  var FALLBACK_ITEMS = [
    { key: 'sangguk', name: '상국', role: '아빠', emoji: '👨',
      weather: '흐림 5~17°C · 비 0% · 미세먼지 보통',
      outfit: '아침 5°C — 따뜻한 겉옷(자켓) + 이너 레이어드, 출근길 목도리',
      cheer: '연천 출근길 쌀쌀해요. 따뜻하게 입고 안전운전!' },
    { key: 'suhyang', name: '수향', role: '엄마', emoji: '👩',
      weather: '흐림 5~17°C · 비 0% · 미세먼지 보통',
      outfit: '도톰한 니트 + 겉옷, 해 질 무렵(17°C→12°C) 가디건 하나 더',
      cheer: '오늘 하루도 무리하지 말고 따뜻하게 지내요 💚' },
    { key: 'jiseop', name: '지섭', role: '첫째아들', emoji: '👦',
      weather: '흐림 5~17°C · 비 0% (등교 시간 6~9시 5~9°C)',
      outfit: '교복 위에 패딩 조끼나 도톰한 가디건 — 아침이 가장 추워요',
      cheer: '등교길 춥다, 겉옷 꼭 챙기고 힘차게 시작!' },
    { key: 'jiyul', name: '지율', role: '둘째아들', emoji: '🧒',
      weather: '흐림 5~17°C · 비 0% (등교 시간 6~9시 5~9°C)',
      outfit: '긴팔 + 맨투맨 + 겉옷. 우산은 필요 없어요',
      cheer: '오늘도 씩씩하게! 형이랑 같이 다녀와 😊' }
  ];

  function briefOf() {
    var D = d();
    if (!D) return null;
    var b = D.morningBrief;
    if (!b || typeof b !== 'object') return null;
    var items = (b.items && b.items.length) ? b.items : null;
    if (!items) return null;
    var out = [];
    for (var i = 0; i < items.length; i++) {
      var x = items[i];
      if (!x || typeof x !== 'object') continue;
      if (!x.name && !x.key) continue;
      out.push({
        key: x.key || '', name: x.name || '가족', role: x.role || '',
        emoji: x.emoji || '', weather: x.weather || x.wx || '', outfit: x.outfit || x.wear || '',
        cheer: x.cheer || x.msg || '', prep: x.prep || ''
      });
    }
    if (!out.length) return null;
    return { date: b.date || '', at: b.at || 0, items: out };
  }
  function briefRow(x) {
    var em = x.emoji || (F && F.roleEmoji ? F.roleEmoji(x.role) : '🧑');
    var role = x.role ? String(x.role) : '';
    var tail = '';
    if (/아빠|엄마/.test(role)) tail = ' · 출근';
    else if (/아들|딸/.test(role)) tail = ' · 등교';
    var prep = x.prep ? ('<div class="w8-b-o">🎒 ' + esc(x.prep) + '</div>') : '';
    return '<div class="w8-b-i"><div class="w8-b-av">' + esc(em) + '</div><div class="w8-b-bd">' +
      '<div class="w8-b-n">' + esc(x.name) + (role ? '<em>' + esc(role + tail) + '</em>' : '') + '</div>' +
      (x.weather ? '<div class="w8-b-w">🌤 ' + esc(x.weather) + '</div>' : '') +
      (x.outfit ? '<div class="w8-b-o">🧥 ' + esc(x.outfit) + '</div>' : '') +
      prep +
      (x.cheer ? '<div class="w8-b-c">💬 ' + esc(x.cheer) + '</div>' : '') +
      '</div></div>';
  }
  function renderBrief() {
    var box = $('briefBody');
    if (!box) return;
    style();
    var b = briefOf();
    var at = $('briefAt');
    var html, sig, sub;
    if (!b) {
      sub = '내일 06:00 첫 게시';
      html = '<div class="w8-b-gate">🌙 아직 오늘 아침 브리핑이 올라오기 전이에요.<br>' +
        '매일 <b>06:00</b>에 가족 4명(상국·수향·지섭·지율)의 오늘 날씨·옷차림·응원 한마디가 여기에 자동으로 올라와요.</div>' +
        '<div class="w8-b-h">미리 보기 · 내일 ' + esc(mdLabel('2026-11-16')) + ' 파주 기준</div>' +
        FALLBACK_ITEMS.map(briefRow).join('');
      sig = 'fallback';
    } else {
      var isToday = b.date === today();
      sub = (b.at ? stamp(b.at) + ' 게시' : '오늘') + (isToday ? '' : ' · ' + (b.date || ''));
      html = (isToday ? '' :
        '<div class="w8-b-gate">📅 오늘(' + esc(mdLabel(today())) + ') 브리핑은 아직이에요. 아래는 <b>' +
        esc(mdLabel(b.date)) + '</b> 브리핑이에요. 매일 06:00에 새로 올라옵니다.</div>') +
        '<div class="w8-b-h">' + esc(mdLabel(b.date || today())) + ' · 파주 기준</div>' +
        b.items.map(briefRow).join('');
      sig = 'live|' + (b.date || '') + '|' + (b.at || '') + '|' + JSON.stringify(b.items);
    }
    html += '<div class="w8-b-foot">날씨 출처: Apple Weather · 미세먼지 AirKorea · 매일 06:00 자동 갱신</div>';
    if (at) at.textContent = sub;
    if (box.__sig !== sig) { box.__sig = sig; box.innerHTML = html; }
  }

  /* ============================================================
     ② 🍽️ 가족 위치별 주변 맛집·카페·가볼만한곳
     ============================================================ */
  var cells = {};        /* 격자키 -> {at, list} / 진행 중이면 p */
  var byMember = {};     /* 회원id -> {at, sig, lat, lon, list:[{...,dist}]} */
  var waiting = {};      /* 회원id -> 1 (조회 중) */

  function cellKey(lat, lon) { return (Math.round(lat / CELL) * CELL).toFixed(2) + ',' + (Math.round(lon / CELL) * CELL).toFixed(2); }
  function viewbox(lat, lon, km) {
    var f = km === 2.5 ? 2.5 : 1;
    return [lon - BOX_LON * f, lat + BOX_LAT * f, lon + BOX_LON * f, lat - BOX_LAT * f]
      .map(function (v) { return v.toFixed(5); }).join(',');
  }
  function nomRun(url, ms) {
    var p = nomChain.then(function () {
      var wait = Math.max(0, NOM_GAP - (Date.now() - nomLast));
      if (!wait) return null;
      return new Promise(function (res) { setTimeout(res, wait); });
    }).then(function () {
      nomLast = Date.now();
      return jsonFetch(url, ms);
    });
    nomChain = p.catch(function () {});
    return p;
  }
  function placeOsm(x, cat) {
    var a = x.address || {}, ex = x.extratags || {};
    var name = x.name || '';      /* 이름 없는 OSM 객체(동 이름으로 대신 나오는 공원 등)는 쓰지 않는다 */
    return {
      id: 'o' + (x.osm_type || '') + (x.osm_id || x.place_id || Math.random().toString(36).slice(2, 7)),
      name: name, lat: Number(x.lat), lon: Number(x.lon), cat: cat || 'food',
      addr: roadAddr(a, x.display_name),
      hours: ex.opening_hours || '', cuisine: cuisineKo(ex.cuisine) || cuisineKo(x.type),
      phone: ex.phone || ex['contact:phone'] || '', site: ex.website || ex['contact:website'] || '',
      note: ex.description ? String(ex.description).slice(0, 180) : '',
      brand: ex.branch || ex.brand || '', src: 'osm'
    };
  }
  function roadAddr(a, display) {
    a = a || {};
    var parts = [];
    function add(v) { v = String(v || '').trim(); if (v && parts.indexOf(v) === -1) parts.push(v); }
    add(a.province || a.state || a['ISO3166-2-lvl4']);
    add(a.city || a.county || a.municipality);
    add(a.city_district || a.district || a.borough || a.suburb || a.town || a.village || a.quarter || a.neighbourhood);
    var road = a.road || a.pedestrian || a.footway || a.path;
    if (road) add(road + (a.house_number ? ' ' + a.house_number : ''));
    if (!parts.length && display) return String(display).split(', ').slice(0, 4).join(' ');
    return parts.join(' ');
  }
  function nomList(term, box, cat) {
    var url = NOM + '?format=jsonv2&q=' + encodeURIComponent(term) +
      '&limit=8&bounded=1&viewbox=' + box + '&addressdetails=1&extratags=1&accept-language=ko';
    return nomRun(url, 9000).then(function (j) {
      return (j || []).map(function (x) { return placeOsm(x, cat); })
        .filter(function (x) { return x.name && isFinite(x.lat) && isFinite(x.lon); });
    });
  }
  var WIKI_BAD = /(초등학교|중학교|고등학교|학교|묘역|묘$|사업소|차량기지|정류장|아파트|터널|교량|저수지|빗물펌프장|변전소|사무소|청사|주민센터|파출소|우체국|보건소|복지관|터미널|기지|창고|본부)/;
  function wikiSpot(lat, lon) {
    var url = WIKI + '?action=query&list=geosearch&gscoord=' + lat + '%7C' + lon +
      '&gsradius=3000&gslimit=12&format=json&origin=*';
    return jsonFetch(url, 8000).then(function (j) {
      var g = (j && j.query && j.query.geosearch) || [], hit = null;
      for (var i = 0; i < g.length; i++) {
        if (WIKI_BAD.test(g[i].title)) continue;
        if (/역$/.test(g[i].title)) continue;
        hit = g[i]; break;
      }
      if (!hit) return [];
      var u2 = WIKI + '?action=query&prop=extracts&exintro=1&explaintext=1&exchars=260&titles=' +
        encodeURIComponent(hit.title) + '&format=json&origin=*';
      return jsonFetch(u2, 8000).then(function (k) {
        var pages = (k && k.query && k.query.pages) || {}, ex = '';
        Object.keys(pages).forEach(function (pid) { ex = pages[pid].extract || ''; });
        return [{
          id: 'w' + hit.pageid, name: hit.title, lat: hit.lat, lon: hit.lon, cat: 'spot',
          addr: '', hours: '', cuisine: '', phone: '', site: '', brand: '',
          note: String(ex || '').replace(/\s+/g, ' ').trim().slice(0, 220),
          src: 'wiki', link: 'https://ko.wikipedia.org/wiki/' + encodeURIComponent(hit.title)
        }];
      }).catch(function () { return []; });
    }).catch(function () { return []; });
  }
  function nearest(list, lat, lon) {
    var best = null, bd = 1e9;
    for (var i = 0; i < list.length; i++) {
      var m = meters(lat, lon, list[i].lat, list[i].lon);
      if (m < bd) { bd = m; best = list[i]; }
    }
    return best;
  }
  function sortNear(list, lat, lon) {
    return (list || []).map(function (x) {
      var y = {};
      for (var k in x) y[k] = x[k];
      y.d0 = meters(lat, lon, x.lat, x.lon);
      return y;
    }).sort(function (a, b) { return a.d0 - b.d0; });
  }
  function loadCell(lat, lon) {
    var k = cellKey(lat, lon), c = cells[k];
    if (c && c.list && c.at && (Date.now() - c.at) < TTL) return Promise.resolve(c.list);
    if (c && c.p) return c.p;
    var box1 = viewbox(lat, lon, 1), box2 = viewbox(lat, lon, 2.5);
    /* 1km 안에 없으면 2.5km까지 넓혀 한 번 더 찾아본다(외곽·교하 지역 배려) */
    function fill(term, cat) {
      return nomList(term, box1, cat).catch(function () { return []; }).then(function (list) {
        if (list.length) return list;
        return nomList(term, box2, cat).catch(function () { return []; });
      });
    }
    var p = Promise.all([
      fill('restaurant', 'food'),
      fill('cafe', 'cafe'),
      wikiSpot(lat, lon).catch(function () { return []; })
    ]).then(function (r) {
      var foods = sortNear(r[0], lat, lon), cafes = sortNear(r[1], lat, lon);
      var wiki = r[2] && r[2].length ? r[2][0] : null;
      var wd = wiki ? meters(lat, lon, wiki.lat, wiki.lon) : 1e9;
      if (wiki && wd <= 1500) return pack(foods, cafes, [wiki], lat, lon);
      /* 위키에 마땅한 곳이 없거나 멀면 가까운 공원을 가볼만한 곳으로 쓴다 */
      return nomList('park', box1, 'spot').catch(function () { return []; }).then(function (ps) {
        var parks = sortNear(ps, lat, lon);
        var spot = (wiki && wd <= (parks[0] ? parks[0].d0 : 1e9)) ? wiki : parks[0];
        return pack(foods, cafes, spot ? [spot] : [], lat, lon);
      });
    }).then(function (list) {
      cells[k] = { at: Date.now(), list: list };
      return list;
    }).catch(function () {
      cells[k] = { at: 0, list: [] };
      return [];
    });
    cells[k] = cells[k] || {};
    cells[k].p = p;
    return p;
  }
  var CAT_LABEL = { food: '🍽️ 맛집', cafe: '☕ 카페', spot: '🌳 가볼만한곳' };
  /* 맛집·카페·가볼만한곳을 각각 한 곳씩 담는다. 한 갈래가 비면 다른 갈래의 다음 곳으로 3곳을 채운다. */
  function pack(foodL, cafeL, spotL, lat, lon) {
    var seen = {}, picks = [];
    function take(x) {
      if (!x || !x.name || seen[x.name]) return;
      seen[x.name] = 1;
      x.catLabel = CAT_LABEL[x.cat] || '📍 장소';
      x.d0 = meters(lat, lon, x.lat, x.lon);
      picks.push(x);
    }
    take(foodL[0]); take(cafeL[0]); take(spotL[0]);
    var extra = [foodL[1], cafeL[1], spotL[1], foodL[2], cafeL[2]];
    for (var i = 0; picks.length < 3 && i < extra.length; i++) take(extra[i]);
    picks.sort(function (a, b) { return a.d0 - b.d0; });
    return picks.slice(0, 3);
  }  function ensureMember(m) {
    var live = (F.live && F.live()) || {};
    var l = live[m.id];
    if (!l || typeof l.lat !== 'number' || typeof l.lon !== 'number') return;
    var ck = cellKey(l.lat, l.lon) + '|' + l.lat.toFixed(4) + ',' + l.lon.toFixed(4);
    var have = byMember[m.id];
    if (have && have.key === ck && (Date.now() - have.at) < TTL) return;
    if (waiting[m.id] === ck) return;
    waiting[m.id] = ck;
    loadCell(l.lat, l.lon).then(function (list) {
      if (waiting[m.id] === ck) delete waiting[m.id];
      var withD = list.map(function (x) {
        var y = {};
        for (var k in x) y[k] = x[k];
        y.dist = meters(l.lat, l.lon, x.lat, x.lon);
        return y;
      });
      byMember[m.id] = { key: ck, at: Date.now(), lat: l.lat, lon: l.lon, list: withD,
        sig: ck + '|' + withD.map(function (x) { return x.name + x.dist; }).join(',') };
      decorateAll();
    }, function () { delete waiting[m.id]; decorateAll(); });
  }
  function chipsInner(id) {
    var n = byMember[id];
    if (!n) {
      return '<span class="w8-ld"><i class="w8-sp"></i> 주변 맛집·카페·명소를 찾는 중…</span>';
    }
    if (!n.list.length) {
      return '<span class="w8-ld">주변 추천을 불러오지 못했어요 · <button type="button" data-w8retry="' + esc(id) + '">다시 찾기</button></span>';
    }
    var html = '<span class="w8-hd">🍽️ 주변 추천</span>';
    n.list.forEach(function (x, i) {
      html += '<button type="button" class="w8-chip" data-w8open="' + esc(id) + '|' + i + '">' +
        '<b>' + esc(x.name) + '</b>' +
        '<span>' + esc(x.catLabel) + ' · ' + esc(distText(x.dist)) + '</span></button>';
    });
    return html;
  }
  function decorateAll() {
    ['locSumList', 'liveList'].forEach(function (id) {
      var box = $(id);
      if (!box) return;
      var rows = box.querySelectorAll('[data-mem]');
      var liveAll = (F && F.live && F.live()) || {};
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i], mem = row.getAttribute('data-mem');
        if (!mem) continue;
        /* 위치를 아직 공유하지 않은 가족에게는 추천을 붙이지 않는다 */
        if (!liveAll[mem] || typeof liveAll[mem].lat !== 'number') continue;
        var n = byMember[mem];
        var sig = n ? n.sig : (waiting[mem] ? 'wait' : 'none');
        var next = row.nextElementSibling;
        var isNear = next && next.className && String(next.className).indexOf('w8-nearwrap') !== -1 &&
          next.getAttribute('data-w8for') === mem;
        if (isNear) {
          if (next.getAttribute('data-w8sig') === sig) continue;
          next.setAttribute('data-w8sig', sig);
          next.innerHTML = chipsInner(mem);
        } else {
          var wrap = document.createElement('div');
          wrap.className = 'w8-nearwrap';
          wrap.setAttribute('data-w8for', mem);
          wrap.setAttribute('data-w8sig', sig);
          wrap.innerHTML = chipsInner(mem);
          row.parentNode.insertBefore(wrap, row.nextSibling);
        }
      }
    });
  }
  function openPlace(memId, idx) {
    var n = byMember[memId];
    if (!n || !n.list[idx]) return;
    var x = n.list[idx];
    var live = (F.live && F.live()) || {}, l = live[memId] || {};
    var who = (F.memOf && F.memOf(memId)) || { name: '가족' };
    /* 같은 이름의 다른 지점과 헷갈리지 않게 '이름 + 시·군'으로 찾는다 */
    var city = String(x.addr || '').split(' ')[1] || '';
    var qName = x.name + (city && city.length < 12 ? ' ' + city : '');
    var qEnc = encodeURIComponent(qName);
    var kakao = 'https://map.kakao.com/link/search/' + qEnc;
    var naver = 'https://map.naver.com/p/search/' + qEnc;
    var blog = 'https://search.naver.com/search.naver?ssc=tab.blog.all&query=' + encodeURIComponent(qName + ' 후기');
    var rows = '';
    function row(k, v) {
      if (!v) return;
      rows += '<div class="w8-mr"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>';
    }
    row('분류', esc(x.catLabel.replace(/^[^ ]+ /, '')) + (x.cuisine ? ' · ' + esc(x.cuisine) : ''));
    row('거리', '<b>' + esc(who.name) + ' 님 지금 위치에서 ' + esc(distText(x.dist)) + '</b>');
    row('주소', esc(x.addr || '주소 정보 없음'));
    row('영업', esc(daysKo(x.hours)) || '등록된 영업시간이 없어요');
    if (x.brand) row('지점', esc(x.brand));
    row('전화', x.phone ? '<a href="tel:' + esc(x.phone) + '">' + esc(x.phone) + '</a>' : '');
    row('홈페이지', x.site ? '<a href="' + esc(x.site) + '" target="_blank" rel="noopener">바로 열기</a>' : '');
    row('위치', Number(x.lat).toFixed(4) + ', ' + Number(x.lon).toFixed(4));
    var note = x.note ? '<div class="w8-mnote">' + esc(x.note) + '</div>' : '';
    var wiki = x.link ? '<div class="w8-mnote">📖 <a href="' + esc(x.link) + '" target="_blank" rel="noopener">위키백과에서 ‘' + esc(x.name) + '’ 더 보기</a></div>' : '';
    F.openSheet(
      '<h3>' + esc(x.catLabel) + ' · ' + esc(x.name) + '</h3>' +
      '<div class="sdesc">' + esc(who.name) + ' 님이 지금 있는 곳에서 가장 가까운 ' +
      (x.cat === 'food' ? '맛집' : (x.cat === 'cafe' ? '카페' : '가볼만한 곳')) + '이에요.</div>' +
      '<div class="w8-m">' + rows + '</div>' + note + wiki +
      '<div class="w8-lb">후기·리뷰 바로 보기</div>' +
      '<div class="w8-links">' +
      '<a class="k" href="' + kakao + '" target="_blank" rel="noopener"><b>카카오맵</b><span>후기·리뷰</span></a>' +
      '<a class="n" href="' + naver + '" target="_blank" rel="noopener"><b>네이버지도</b><span>후기·리뷰</span></a>' +
      '<a class="b" href="' + blog + '" target="_blank" rel="noopener"><b>블로그</b><span>리뷰 글</span></a>' +
      '</div>' +
      '<button type="button" class="btn ghost" data-sheet-close style="margin-top:10px">닫기</button>'
    );
  }

  /* ---------------- 스타일 ---------------- */
  function style() {
    if ($('w8style')) return;
    var s = document.createElement('style');
    s.id = 'w8style';
    s.textContent = [
      /* 아침 브리핑 */
      '.w8-b-gate{background:#F6FBF9;border:1px solid #DCEFE5;border-radius:12px;padding:9px 10px;font-size:11px;color:#3C4450;line-height:1.55;margin-bottom:9px}',
      '.w8-b-h{font-size:10.5px;font-weight:900;color:#79838F;margin:2px 2px 4px}',
      '.w8-b-i{display:flex;gap:8px;padding:8px 0;border-bottom:1px dashed #EEF2F5}',
      '.w8-b-i:last-of-type{border-bottom:none}',
      '.w8-b-av{width:30px;height:30px;border-radius:10px;background:#F1F4F5;display:flex;align-items:center;justify-content:center;font-size:15px;flex:none}',
      '.w8-b-bd{flex:1;min-width:0}',
      '.w8-b-n{font-size:12.5px;font-weight:900;letter-spacing:-.2px;display:flex;align-items:center;gap:5px;flex-wrap:wrap}',
      '.w8-b-n em{font-style:normal;font-size:9.5px;font-weight:800;color:#0A7D56;background:#E7F8F1;border-radius:20px;padding:2px 7px}',
      '.w8-b-w{font-size:11.5px;font-weight:800;color:#3C4450;margin-top:2px;line-height:1.4}',
      '.w8-b-o{font-size:11px;color:#5A6672;margin-top:2px;line-height:1.45}',
      '.w8-b-c{font-size:11px;color:#0A7D56;font-weight:700;margin-top:3px;line-height:1.45}',
      '.w8-b-foot{font-size:9px;color:#AEB6BF;margin-top:9px;line-height:1.4}',

      /* 주변 추천 칩 */
      '.w8-nearwrap{display:flex;gap:6px;align-items:stretch;overflow-x:auto;padding:5px 0 7px 36px;margin-top:-2px;-webkit-overflow-scrolling:touch}',
      '.w8-nearwrap::-webkit-scrollbar{display:none}',
      '.w8-hd{flex:none;align-self:center;font-size:9.5px;font-weight:900;color:#0A7D56;background:#E7F8F1;border-radius:20px;padding:5px 8px;white-space:nowrap}',
      '.w8-ld{flex:none;align-self:center;font-size:10px;font-weight:700;color:#9AA4AF;white-space:nowrap;padding:4px 2px;display:flex;align-items:center;gap:5px}',
      '.w8-ld button{font-size:10px;font-weight:900;color:#2F6FD0;background:#EEF5FF;border-radius:20px;padding:3px 8px}',
      '.w8-sp{width:10px;height:10px;border-radius:50%;border:1.6px solid #D7E3DF;border-top-color:#0E9F6E;display:inline-block;animation:w8spin .9s linear infinite}',
      '@keyframes w8spin{to{transform:rotate(360deg)}}',
      '.w8-chip{flex:0 0 auto;max-width:150px;text-align:left;background:#fff;border:1.4px solid #E3EEF0;border-radius:12px;padding:6px 9px;box-shadow:0 2px 7px rgba(20,24,29,.05)}',
      '.w8-chip:active{transform:scale(.97);background:#F2FBF7}',
      '.w8-chip b{display:block;font-size:11px;font-weight:900;color:#1B2B24;letter-spacing:-.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.w8-chip span{display:block;font-size:9.5px;font-weight:700;color:#79838F;margin-top:1px;white-space:nowrap}',

      /* 장소 모달 */
      '.w8-m{background:#F8FBFA;border:1px solid #EAF1EF;border-radius:13px;padding:4px 11px;margin:2px 0 8px}',
      '.w8-mr{display:flex;gap:9px;padding:6px 0;border-bottom:1px dashed #EBF1EF;font-size:11.5px;line-height:1.45}',
      '.w8-mr:last-child{border-bottom:none}',
      '.w8-mr .k{flex:none;width:48px;color:#79838F;font-weight:800}',
      '.w8-mr .v{flex:1;min-width:0;color:#1B2B24;font-weight:700;word-break:keep-all}',
      '.w8-mr .v a{color:#2F6FD0;font-weight:800;text-decoration:none}',
      '.w8-mnote{font-size:11px;color:#5A6672;line-height:1.55;background:#FFFDF3;border:1px solid #F4EBCB;border-radius:11px;padding:8px 10px;margin-bottom:8px}',
      '.w8-mnote a{color:#2F6FD0;font-weight:800;text-decoration:none}',
      '.w8-lb{font-size:10.5px;font-weight:900;color:#79838F;margin:2px 2px 6px}',
      '.w8-links{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}',
      '.w8-links a{display:flex;flex-direction:column;align-items:center;gap:1px;padding:9px 4px;border-radius:12px;text-decoration:none;border:1px solid transparent}',
      '.w8-links a b{font-size:11.5px;font-weight:900;letter-spacing:-.2px}',
      '.w8-links a span{font-size:9.5px;font-weight:700;opacity:.8}',
      '.w8-links a.k{background:#FEE500;color:#3C1E1E}',
      '.w8-links a.n{background:#03C75A;color:#fff}',
      '.w8-links a.b{background:#EAF2FF;color:#2F6FD0}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ---------------- 이벤트 ---------------- */
  function wire() {
    if (wired) return;
    wired = true;
    document.addEventListener('click', function (e) {
      var op = e.target.closest && e.target.closest('[data-w8open]');
      if (op) {
        e.preventDefault(); e.stopPropagation();
        var p = String(op.getAttribute('data-w8open')).split('|');
        openPlace(p[0], Number(p[1]));
        return;
      }
      var rt = e.target.closest && e.target.closest('[data-w8retry]');
      if (rt) {
        e.preventDefault(); e.stopPropagation();
        var id = rt.getAttribute('data-w8retry');
        delete byMember[id]; delete waiting[id];
        var live = (F.live && F.live()) || {};
        if (live[id] && typeof live[id].lat === 'number') {
          var l = live[id];
          delete cells[cellKey(l.lat, l.lon)];
        }
        decorateAll();
        var mm = (F.members && F.members()) || [];
        mm.forEach(function (m) { if (m.id === id) ensureMember(m); });
      }
    }, true);
    /* 가족 위치 목록이 다시 그려지면 추천 칩을 다시 붙인다 */
    ['locSumList', 'liveList'].forEach(function (id) {
      var box = $(id);
      if (!box || !global.MutationObserver) return;
      var mo = new MutationObserver(function () { try { decorateAll(); } catch (err) {} });
      mo.observe(box, { childList: true });
    });
  }

  /* ---------------- mount ---------------- */
  function render() {
    if (!F || !d() || !me()) return;
    style();
    wire();
    renderBrief();
    var list = (F.members && F.members()) || [];
    list.forEach(ensureMember);
    decorateAll();
  }
  function mount(FAM) {
    if (ON) return;
    F = FAM; ON = true;
    try { style(); wire(); render(); } catch (e) { console.warn('HOME8 mount', e); }
  }
  global.HOME8 = {
    mount: mount, render: render,
    brief: briefOf,
    near: function () { return byMember; },
    cells: function () { return cells; }
  };

  var prevRender = global.__FAM_RENDER;
  var prevView = global.__FAM_VIEW;
  global.__FAM_RENDER = function () {
    if (prevRender) { try { prevRender(); } catch (e) {} }
    try {
      if (!ON && global.FAM && global.FAM.doc && global.FAM.doc() && global.FAM.me && global.FAM.me()) mount(global.FAM);
      else render();
    } catch (e) { console.warn('HOME8 render', e); }
  };
  global.__FAM_VIEW = function (v) {
    if (prevView) { try { prevView(v); } catch (e) {} }
    if (v === 'home' || v === 'map') { try { render(); } catch (e) {} }
  };
  var fam3 = global.FAM4 || null;
  if (fam3 && typeof fam3.mount === 'function') {
    var om = fam3.mount;
    fam3.mount = function (FAM) {
      om.call(fam3, FAM);
      try { mount(FAM); } catch (e) { console.warn('HOME8 mount', e); }
    };
  }
})(window);
