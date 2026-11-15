/* ============================================================
   상국수향지섭지율포털 V7+ · 가족 응원왕 순위 + 홈 미니 포토 카드 (extra7.js)
   ① 💬 가족 응원 한마디(홈 최상단) — 누가·몇 시에 남겼는지, 누적 횟수 순위표
   ② 홈 섹션 사이 미니 포토 카드(가로 슬라이드) + 사진마다 ⬇️ 저장(Blob)
   ③ 사진 탭 썸네일에도 ⬇️ 저장 버튼
   - 저장은 기존 가족 DB(DOC.cheer · DOC.v7.chr · DOC.photos)만 쓴다. 본체는 window.FAM 다리만.
   ============================================================ */
(function (global) {
  'use strict';

  var F = null, ON = false, wired = false;

  function $(id) { return document.getElementById(id); }
  function d() { return F && F.doc(); }
  function me() { return F && F.me(); }
  function esc(s) { return F ? F.esc(s) : String(s == null ? '' : s); }
  function now() { return Date.now(); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function toast(m) { if (F) F.toast(m); }
  function save() { if (F) F.save(); }
  function memOf(id) { return F && F.memOf ? F.memOf(id) : null; }
  function nm(id) { var m = memOf(id); return m && m.name ? m.name : '가족'; }
  function em(id) { var m = memOf(id); return (m && m.emoji) || '🧑'; }
  /* 11/15 20:35 */
  function stamp(ts) {
    if (!ts) return '';
    var x = new Date(ts);
    return (x.getMonth() + 1) + '/' + x.getDate() + ' ' + pad(x.getHours()) + ':' + pad(x.getMinutes());
  }
  function safeId(s) { return String(s || '').replace(/[^a-zA-Z0-9_-]/g, ''); }

  /* ---------------- 저장 도우미(Blob 다운로드) ---------------- */
  function dataUrlToBlob(du) {
    var parts = String(du).split(',');
    var mime = (parts[0].match(/:(.*?);/) || [null, 'image/jpeg'])[1];
    var bin = atob(parts[1]);
    var u8 = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new Blob([u8], { type: mime });
  }
  function saveBlob(blob, name) {
    try {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        try { document.body.removeChild(a); } catch (e) {}
        URL.revokeObjectURL(url);
      }, 1500);
      return true;
    } catch (e) {
      toast('저장하지 못했어요. 사진을 길게 눌러 저장해 보세요');
      return false;
    }
  }
  function fileName(suffix, ext) {
    var d0 = new Date();
    return '우리가족_' + d0.getFullYear() + pad(d0.getMonth() + 1) + pad(d0.getDate()) + '_' +
      pad(d0.getHours()) + pad(d0.getMinutes()) + (suffix || '') + '.' + (ext || 'jpg');
  }
  function extOf(src) {
    var m = String(src || '').match(/\.(png|jpe?g|webp|gif)(?:[?#]|$)/i);
    return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg';
  }
  /* 저장된(암호화) 가족사진 한 장을 폰에 저장 */
  function downloadPhoto(pid) {
    if (!pid) return;
    toast('⬇️ 사진을 준비하고 있어요…');
    F.mediaUrl(pid).then(function (du) {
      if (!du) { toast('사진을 불러오지 못했어요'); return; }
      saveBlob(dataUrlToBlob(du), fileName('_' + safeId(pid).slice(-4)));
    }).catch(function () { toast('사진을 불러오지 못했어요 · 잠시 뒤 다시 눌러 주세요'); });
  }
  /* 같은 사이트의 기본 사진(icon-512.png 등) 저장 */
  function downloadUrl(src, name) {
    fetch(src, { cache: 'force-cache' }).then(function (r) { return r.blob(); }).then(function (b) {
      saveBlob(b, name || fileName('', extOf(src)));
    }).catch(function () { toast('사진을 저장하지 못했어요'); });
  }

  /* ---------------- ① 응원왕 순위 ---------------- */
  /* DOC.v7.chr[id] = {by, text, at} · 예전 기록은 DOC.cheer[id] 한 건 */
  function cheerLog() {
    var D = d();
    if (!D) return [];
    if (!D.v7 || typeof D.v7 !== 'object') D.v7 = {};
    if (!D.v7.chr || typeof D.v7.chr !== 'object') D.v7.chr = {};
    var log = D.v7.chr, out = [];
    Object.keys(log).forEach(function (k) {
      var c = log[k];
      if (!c || typeof c !== 'object' || c.del || !c.text) return;
      out.push({ k: k, by: c.by || '', text: c.text, at: c.at || 0 });
    });
    /* 예전 응원(DOC.cheer)이 아직 기록에 없으면 1건으로 세어 준다 */
    var cheer = (D.cheer || {});
    Object.keys(cheer).forEach(function (k) {
      var c = cheer[k];
      if (!c || c.d || !c.text) return;
      var found = out.some(function (x) { return x.by === k && x.text === c.text; });
      if (!found) out.push({ k: 'old_' + k, by: k, text: c.text, at: c.at || 0, legacy: 1 });
    });
    out.sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    return out;
  }
  function cheerRank() {
    var log = cheerLog();
    var cnt = {}, last = {};
    log.forEach(function (x) {
      var id = x.by || '';
      if (!id) return;
      cnt[id] = (cnt[id] || 0) + 1;
      if (!last[id] || x.at > last[id]) last[id] = x.at;
    });
    var list = (F.members() || []).map(function (m) {
      return { id: m.id, name: m.name, emoji: m.emoji, role: m.role, n: cnt[m.id] || 0, at: last[m.id] || 0 };
    });
    list.sort(function (a, b) {
      if (b.n !== a.n) return b.n - a.n;
      return (b.at || 0) - (a.at || 0);
    });
    return list;
  }
  function renderRank() {
    var box = $('cheerRank');
    if (!box) return;
    var list = cheerRank();
    var total = list.reduce(function (s, x) { return s + x.n; }, 0);
    var medal = ['🥇', '🥈', '🥉', '4️⃣'];
    var html = '<div class="p7-rk-head">🏆 응원왕 순위 <span>모두 ' + total + '마디</span></div><div class="p7-rk">';
    if (!total) {
      html += '<div class="p7-rk-empty">아직 응원 한마디가 없어요. 첫 마디를 남기면 순위가 시작돼요!</div>';
    } else {
      list.forEach(function (x, i) {
        html += '<div class="p7-rk-row' + (me() && x.id === me().id ? ' me' : '') + '">' +
          '<span class="m">' + medal[i] + '</span>' +
          '<span class="nm">' + (x.emoji || '🧑') + ' ' + esc(x.name) + '</span>' +
          '<span class="ct">' + x.n + '회</span>' +
          '<span class="at">' + (x.at ? stamp(x.at) : '–') + '</span></div>';
      });
    }
    html += '</div>';
    var host = $('cheerCount');
    if (host) host.textContent = total + '마디';
    if (box.__sig !== html) { box.__sig = html; box.innerHTML = html; }
  }

  /* ---------------- ② 홈 미니 포토 카드 ---------------- */
  function photoList() {
    var D = d();
    if (!D || !D.photos) return [];
    var out = [];
    Object.keys(D.photos).forEach(function (k) {
      var p = D.photos[k];
      if (!p || p.d || !p.thumb) return;
      out.push({ id: k, thumb: p.thumb, cap: p.cap || '', by: p.by || '', at: p.at || 0 });
    });
    out.sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    return out;
  }
  var FALLBACK = [
    { src: './icon-512.png', cap: '속초 바다에서, 우리 가족', sub: '가족사진' },
    { src: './apple-touch-icon.png', cap: '우리 가족의 하루', sub: '가족사진' }
  ];

  function cardHtml(p, i) {
    var cap = p.cap ? esc(p.cap) : (p.by ? esc(nm(p.by)) + ' 님이 올린 사진' : '우리 가족 사진');
    var sub = p.at ? stamp(p.at) : '';
    return '<div class="p7-card">' +
      '<div class="p7-ph"><img src="' + esc(p.thumb) + '" alt="가족 사진" loading="lazy" data-p7open="' + esc(p.id) + '">' +
      '<button type="button" class="p7-dl" data-p7dl="' + esc(p.id) + '" aria-label="사진 저장">⬇️ 저장</button></div>' +
      '<div class="p7-cap"><b>' + cap + '</b><small>' + (sub ? sub + ' · ' : '') + '가족 앨범</small></div></div>';
  }
  function fbCardHtml(f, i) {
    return '<div class="p7-card">' +
      '<div class="p7-ph"><img src="' + esc(f.src) + '" alt="가족 사진" loading="lazy" data-p7open="">' +
      '<button type="button" class="p7-dl" data-p7fbsrc="' + esc(f.src) + '" aria-label="사진 저장">⬇️ 저장</button></div>' +
      '<div class="p7-cap"><b>' + esc(f.cap) + '</b><small>' + esc(f.sub) + ' · 앨범에 사진을 올리면 여기에 채워져요</small></div></div>';
  }
  function uploadCard() {
    return '<button type="button" class="p7-up" data-p7up="1"><span class="e">📷</span><span>사진 올리기</span></button>';
  }
  function renderStrip(elId, shift, title) {
    var el = $(elId);
    if (!el) return;
    var list = photoList();
    var html;
    if (!list.length) {
      var fb = FALLBACK[shift % FALLBACK.length];
      html = '<div class="p7-head"><b>' + esc(title) + '</b><span>가족 앨범</span></div>' +
        '<div class="p7-row">' + fbCardHtml(fb, 0) + uploadCard() + '</div>';
    } else {
      var n = Math.min(list.length, 8);
      var items = [];
      for (var i = 0; i < n; i++) items.push(list[(i + shift) % list.length]);
      html = '<div class="p7-head"><b>' + esc(title) + '</b><span>' + list.length + '장 중 ' + n + '장</span></div>' +
        '<div class="p7-row">' + items.map(cardHtml).join('') + uploadCard() + '</div>';
    }
    if (el.__sig !== html) { el.__sig = html; el.innerHTML = html; }
  }

  function renderPhotos() {
    renderStrip('p7strip1', 0, '📷 가족 미니 앨범');
    renderStrip('p7strip2', 1, '📸 오늘의 가족 사진');
    renderStrip('p7strip3', 2, '💛 함께한 순간들');
  }

  /* ---------------- 스타일 ---------------- */
  function style() {
    if ($('p7style')) return;
    var s = document.createElement('style');
    s.id = 'p7style';
    s.textContent = [
      /* 응원왕 */
      '.p7-rk-head{display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:900;color:#5C6673;margin:2px 2px 7px}',
      '.p7-rk-head span{margin-left:auto;font-size:10.5px;font-weight:800;color:#9AA4AF}',
      '.p7-rk{display:flex;flex-direction:column;gap:5px;margin-bottom:11px}',
      '.p7-rk-row{display:flex;align-items:center;gap:7px;background:#FBFDFC;border:1px solid #EDF2F0;border-radius:11px;padding:7px 9px;font-size:11.5px;font-weight:800;color:#3C4450}',
      '.p7-rk-row.me{background:#F0FBF6;border-color:#CDEFE0}',
      '.p7-rk-row .m{font-size:14px;width:18px;text-align:center;flex:none}',
      '.p7-rk-row .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.p7-rk-row .ct{font-size:11px;font-weight:900;color:#0A7D56;background:#E7F8F1;border-radius:20px;padding:3px 8px;flex:none}',
      '.p7-rk-row .at{font-size:9.5px;font-weight:700;color:#9AA4AF;flex:none}',
      '.p7-rk-empty{font-size:11.5px;color:#9AA4AF;text-align:center;padding:9px;background:#FAFBFB;border-radius:11px}',

      /* 포토 카드 */
      '.p7{margin-bottom:12px}',
      '.p7-head{display:flex;align-items:center;gap:6px;margin:0 3px 7px;font-size:11.5px;font-weight:900;color:#3C4450}',
      '.p7-head span{margin-left:auto;font-size:10px;font-weight:800;color:#9AA4AF}',
      '.p7-row{display:flex;gap:8px;overflow-x:auto;padding:0 2px 4px;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch}',
      '.p7-row::-webkit-scrollbar{display:none}',
      '.p7-card{flex:0 0 42%;max-width:190px;border-radius:16px;overflow:hidden;background:#fff;border:1.5px solid #EDF2F0;box-shadow:0 6px 16px rgba(20,24,29,.06);scroll-snap-align:start}',
      '.p7-ph{position:relative;aspect-ratio:4/3;background:#F1F4F5}',
      '.p7-ph img{width:100%;height:100%;object-fit:cover;display:block}',
      '.p7-dl{position:absolute;right:6px;bottom:6px;background:rgba(12,18,22,.62);color:#fff;font-size:10px;font-weight:900;padding:5px 9px;border-radius:20px;backdrop-filter:blur(4px)}',
      '.p7-cap{padding:7px 9px 9px}',
      '.p7-cap b{display:block;font-size:11.5px;font-weight:900;color:#1B2B24;letter-spacing:-.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.p7-cap small{display:block;font-size:9.5px;color:#9AA4AF;font-weight:700;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.p7-up{flex:0 0 34%;max-width:150px;border-radius:16px;border:1.6px dashed #CFDCD6;background:#F7FBFA;color:#0A7D56;font-size:11.5px;font-weight:900;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;min-height:120px}',
      '.p7-up .e{font-size:20px}',

      /* 사진 탭 썸네일 저장 버튼 */
      '.p7-cell-dl{position:absolute;right:4px;top:4px;background:rgba(12,18,22,.6);color:#fff;font-size:9.5px;font-weight:900;padding:3px 7px;border-radius:20px;z-index:2}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ---------------- 이벤트 ---------------- */
  function wire() {
    if (wired) return;
    wired = true;
    document.addEventListener('click', function (e) {
      var dl = e.target.closest && e.target.closest('[data-p7dl]');
      if (dl) {
        e.preventDefault(); e.stopPropagation();
        downloadPhoto(dl.getAttribute('data-p7dl'));
        return;
      }
      var fb = e.target.closest && e.target.closest('[data-p7fbsrc]');
      if (fb) {
        e.preventDefault(); e.stopPropagation();
        downloadUrl(fb.getAttribute('data-p7fbsrc'), fileName());
        return;
      }
      var up = e.target.closest && e.target.closest('[data-p7up]');
      if (up) {
        e.preventDefault(); e.stopPropagation();
        if (F) F.view('photos');
        return;
      }
      var op = e.target.closest && e.target.closest('[data-p7open]');
      if (op) {
        var pid = op.getAttribute('data-p7open');
        if (pid) { e.preventDefault(); F.openPhoto(pid); }
      }
    }, true);
    /* 응원 보내기: 누적 기록도 함께 남긴다 */
    var btn = $('btnCheer');
    if (btn) btn.addEventListener('click', function () { afterCheer(); });
  }
  /* index.html 이 응원을 저장한 뒤(같은 클릭) 불린다.
     입력칸은 본체가 먼저 비우므로 값을 읽지 않고 DOC.cheer 에 저장된 내용을 그대로 기록한다. */
  function afterCheer() {
    setTimeout(function () {
      var D = d();
      if (!D || !me()) return;
      var c = D.cheer && D.cheer[me().id];
      if (!c || !c.text || c.d) return;            /* 저장되지 않았으면 아무 것도 안 함 */
      if (!D.v7 || typeof D.v7 !== 'object') D.v7 = {};
      if (!D.v7.chr || typeof D.v7.chr !== 'object') D.v7.chr = {};
      var at = c.at || now(), mine = me().id, dup = false;
      Object.keys(D.v7.chr).forEach(function (k) {
        var e = D.v7.chr[k];
        if (e && e.by === mine && (e.at || 0) === at) dup = true;
      });
      if (dup) { renderRank(); return; }
      var key = 'c' + now().toString(36) + Math.random().toString(36).slice(2, 4);
      D.v7.chr[key] = { by: mine, text: c.text, at: at };
      save();
      renderRank();
    }, 80);
  }

  /* ---------------- mount ---------------- */
  /* 사진 탭 썸네일마다 ⬇️ 저장 버튼을 붙인다(사진을 새로 올려도 바로) */
  function decorateGrid() {
    var grid = $('photoGrid');
    if (!grid) return;
    var cells = grid.querySelectorAll('[data-photo]');
    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      if (cell.querySelector('[data-p7dl]')) continue;
      var id = cell.getAttribute('data-photo');
      if (!id) continue;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'p7-cell-dl';
      b.setAttribute('data-p7dl', id);
      b.setAttribute('aria-label', '사진 저장');
      b.textContent = '⬇️';
      cell.appendChild(b);
    }
  }
  var gridWatch = null;
  function watchGrid() {
    var grid = $('photoGrid');
    if (!grid || gridWatch || !global.MutationObserver) return;
    gridWatch = new MutationObserver(function () { try { decorateGrid(); } catch (e) {} });
    gridWatch.observe(grid, { childList: true });
  }

  function render() {
    if (!F || !d() || !me()) return;
    style();
    wire();
    renderRank();
    renderPhotos();
    try { decorateGrid(); watchGrid(); } catch (e) {}
  }
  function mount(FAM) {
    if (ON) return;
    F = FAM; ON = true;
    try { style(); wire(); render(); } catch (e) { console.warn('EXTRA7 mount', e); }
  }
  global.EXTRA7 = { mount: mount, render: render, rank: cheerRank, log: cheerLog, photos: photoList };

  var prevRender = global.__FAM_RENDER;
  var prevView = global.__FAM_VIEW;
  global.__FAM_RENDER = function () {
    if (prevRender) { try { prevRender(); } catch (e) {} }
    try {
      if (!ON && global.FAM && global.FAM.doc && global.FAM.doc() && global.FAM.me && global.FAM.me()) mount(global.FAM);
      else render();
    } catch (e) { console.warn('EXTRA7 render', e); }
  };
  global.__FAM_VIEW = function (v) {
    if (prevView) { try { prevView(v); } catch (e) {} }
    if (v === 'home' || v === 'photos') { try { render(); } catch (e) {} }
  };
  if (global.FAM4 && typeof global.FAM4.mount === 'function') {
    var om = global.FAM4.mount;
    global.FAM4.mount = function (FAM) {
      om.call(global.FAM4, FAM);
      try { mount(FAM); } catch (e) { console.warn('EXTRA7 mount', e); }
    };
  }
})(window);
