/* ============================================================
   상국수향지섭지율포털 V10 · 구글 포토 가족 앨범 (extra8.js)
   ① 홈 '📸 오늘의 가족 사진' 대표사진 카드(DOC.pod) + 💾 저장 + 🔗 Google 포토 원본
   ② 홈 '🎬 우리 가족 영상' — 자동재생(muted·loop·playsinline), 탭하면 소리·전체화면
   ③ 사진 확대 모달에 '🔗 Google 포토 원본' · '📷 공유 앨범에서 보기' 버튼
   ④ 사진첩·홈에 '📷 Google 포토 공유 앨범에 사진 보태기' 버튼
   ⑤ 사진첩에서 오늘의 대표사진 배지
   - 저장소는 기존 가족 DB 만 쓴다(DOC.photos · DOC.videos · DOC.pod · DOC.album). 본체는 window.FAM 다리만.
   ============================================================ */
(function (global) {
  'use strict';

  var F = null, ON = false, wired = false;
  var vcache = {};          /* vid -> objectURL */
  var curPid = null;        /* 지금 열린 사진/영상 id */
  var modalTimer = null;

  function $(id) { return document.getElementById(id); }
  function d() { return F && F.doc(); }
  function me() { return F && F.me(); }
  function esc(s) { return F ? F.esc(s) : String(s == null ? '' : s); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function toast(m) { if (F) F.toast(m); }
  function nm(id) { var m = F && F.memOf ? F.memOf(id) : null; return (m && m.name) || '가족'; }
  function em(id) { var m = F && F.memOf ? F.memOf(id) : null; return (m && m.emoji) || '🧑'; }
  function stamp(ts) {
    if (!ts) return '';
    var x = new Date(ts);
    return (x.getMonth() + 1) + '월 ' + x.getDate() + '일 ' + pad(x.getHours()) + ':' + pad(x.getMinutes());
  }
  function todayYmd() {
    var x = new Date();
    return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate());
  }
  function albumUrl() {
    var D = d();
    var a = D && D.album;
    return (a && a.url) || '';
  }
  function gpLink(id, kind) {
    var D = d();
    if (kind === 'video') {
      var v = D && D.videos && D.videos[id];
      return (v && v.gpl) || '';
    }
    var p = D && D.photos && D.photos[id];
    return (p && p.gpl) || '';
  }

  /* ---------------- 저장(Blob) ---------------- */
  function saveBlob(blob, name) {
    try {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = name; a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        try { document.body.removeChild(a); } catch (e) {}
        URL.revokeObjectURL(url);
      }, 1500);
      return true;
    } catch (e) {
      toast('저장하지 못했어요. 길게 눌러 저장해 보세요');
      return false;
    }
  }
  function fileName(pid, ext) {
    var x = new Date();
    return '우리가족_' + x.getFullYear() + pad(x.getMonth() + 1) + pad(x.getDate()) + '_' +
      pad(x.getHours()) + pad(x.getMinutes()) + '_' + String(pid || '').slice(-4) + '.' + (ext || 'jpg');
  }
  function downloadMedia(pid, kind) {
    if (!pid) return;
    toast('⬇️ 준비하고 있어요…');
    F.mediaUrl(pid).then(function (src) {
      if (!src) throw new Error('empty');
      var m = String(src).match(/^data:([^;,]+)[;,]/);
      var mime = m ? m[1] : (kind === 'video' ? 'video/mp4' : 'image/jpeg');
      var bin = atob(String(src).split(',')[1]);
      var u8 = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      saveBlob(new Blob([u8], { type: mime }), fileName(pid, kind === 'video' ? 'mp4' : 'jpg'));
    }).catch(function () { toast('불러오지 못했어요 · 잠시 뒤 다시 눌러 주세요'); });
  }

  /* ---------------- ① 오늘의 가족 사진 ---------------- */
  function podRec() {
    var D = d();
    if (!D || !D.pod) return null;
    var p = D.pod;
    if (!p.pid) return null;
    var rec = (p.kind === 'video')
      ? (D.videos && D.videos[p.pid])
      : (D.photos && D.photos[p.pid]);
    if (!rec) return null;
    var img = rec.thumb || rec.poster || '';
    if (!img) return null;
    return { pid: p.pid, date: p.date || '', kind: p.kind || 'photo', img: img, cap: rec.cap || '', at: rec.at || 0, gpl: rec.gpl || '' };
  }
  function renderPod() {
    var host = $('p8pod');
    if (!host) return;
    var r = podRec();
    if (!r) { if (host.__sig !== 'none') { host.__sig = 'none'; host.innerHTML = ''; } return; }
    var isToday = (r.date === todayYmd());
    var cap = r.cap ? esc(r.cap) : '오늘의 우리 가족';
    var who = r.at ? esc(stamp(r.at)) : '';
    var html = '<div class="card p8-hero">' +
      '<div class="card-head"><h2>📸 오늘의 가족 사진</h2><span class="sub">' + esc(r.date || '') + '</span></div>' +
      '<div class="p8-hero-box" data-p8open="' + esc(r.pid) + '" data-p8kind="' + esc(r.kind) + '" role="button" tabindex="0">' +
        '<img src="' + esc(r.img) + '" alt="오늘의 가족 사진" loading="lazy">' +
        (r.kind === 'video' ? '<span class="p8-play">▶</span>' : '') +
        (isToday ? '<span class="p8-badge">오늘의 대표사진</span>' : '') +
      '</div>' +
      '<div class="p8-hero-cap"><b>' + cap + '</b><small>' + (who ? who + ' · ' : '') + 'Google 포토 가족 앨범</small></div>' +
      '<div class="p8-btns">' +
        '<button type="button" class="p8-b" data-p8dl="' + esc(r.pid) + '" data-p8kind="' + esc(r.kind) + '">💾 ' + (r.kind === 'video' ? '영상' : '사진') + ' 저장</button>' +
        (r.gpl ? '<a class="p8-b p8-gp" href="' + esc(r.gpl) + '" target="_blank" rel="noopener">🔗 Google 포토 원본</a>' : '') +
        (albumUrl() ? '<a class="p8-b p8-al" href="' + esc(albumUrl()) + '" target="_blank" rel="noopener">📷 공유 앨범에 사진 보태기</a>' : '') +
      '</div>' +
    '</div>';
    if (host.__sig !== html) { host.__sig = html; host.innerHTML = html; }
  }

  /* ---------------- ② 우리 가족 영상 ---------------- */
  function videoList() {
    var D = d();
    if (!D || !D.videos) return [];
    var out = [];
    Object.keys(D.videos).forEach(function (k) {
      var v = D.videos[k];
      if (!v || v.d) return;
      out.push({ id: k, at: v.at || 0, cap: v.cap || '', poster: v.poster || '', dur: v.dur || 0,
                 gpl: v.gpl || '', by: v.by || '' });
    });
    out.sort(function (a, b) { return b.at - a.at; });
    return out;
  }
  function renderVideos() {
    var host = $('p8vid');
    if (!host) return;
    var list = videoList();
    if (!list.length) { if (host.__sig !== 'none') { host.__sig = 'none'; host.innerHTML = ''; } return; }
    var n = Math.min(list.length, 4);
    var html = '<div class="p8-head"><b>🎬 우리 가족 영상</b><span>' + list.length + '개 · 자동 재생</span></div>' +
      '<div class="p8-vrow">' + list.slice(0, n).map(function (v) {
        return '<div class="p8-vcard" data-p8open="' + esc(v.id) + '" data-p8kind="video" role="button" tabindex="0">' +
          '<video class="p8-vid" data-p8vid="' + esc(v.id) + '" muted loop playsinline autoplay preload="none"' +
            (v.poster ? ' poster="' + esc(v.poster) + '"' : '') + '></video>' +
          '<span class="p8-play">▶</span>' +
          (v.dur ? '<span class="p8-dur">' + Math.round(v.dur) + '초</span>' : '') +
          '<button type="button" class="p8-dl-s" data-p8dl="' + esc(v.id) + '" data-p8kind="video" aria-label="영상 저장">⬇️</button>' +
          '<div class="p8-vcap"><b>' + esc(v.cap || '우리 가족 영상') + '</b><small>' + (v.at ? stamp(v.at) : '가족 앨범') + '</small></div>' +
        '</div>';
      }).join('') + '</div>';
    if (host.__sig !== html) { host.__sig = html; host.innerHTML = html; }
    loadVisibleVideos();
  }
  /* 화면에 보이는 영상만 암호를 풀어 붙인다(데이터 절약) */
  function loadVisibleVideos() {
    var els = document.querySelectorAll('video[data-p8vid]');
    for (var i = 0; i < els.length; i++) {
      var v = els[i];
      if (v.__done) continue;
      var id = v.getAttribute('data-p8vid');
      if (!id) continue;
      v.__done = 1;
      (function (vv, pid) {
        F.mediaUrl(pid).then(function (src) {
          if (!src) return;
          vv.src = src;
          var p = vv.play && vv.play();
          if (p && p.catch) p.catch(function () {});
        }).catch(function () {});
      })(v, id);
    }
  }

  /* ---------------- ③ 확대 모달 보강 ---------------- */
  function modalFoot() {
    var box = $('photoModal');
    if (!box) return null;
    var foot = box.querySelector('.m-foot');
    if (!foot) return null;
    var bar = foot.querySelector('.p8-mbtns');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'p8-mbtns';
      foot.appendChild(bar);
    }
    return bar;
  }
  function paintModalButtons(pid) {
    var bar = modalFoot();
    if (!bar) return;
    var bar2 = bar;
    if (!pid) { bar2.innerHTML = ''; return; }
    var D = d() || {};
    var isVid = !!(D.videos && D.videos[pid]);
    var gpl = gpLink(pid, isVid ? 'video' : 'photo');
    var al = albumUrl();
    var html = '';
    if (gpl) html += '<a class="p8-mb" href="' + esc(gpl) + '" target="_blank" rel="noopener">🔗 Google 포토 원본</a>';
    if (al) html += '<a class="p8-mb" href="' + esc(al) + '" target="_blank" rel="noopener">📷 공유 앨범에서 보기</a>';
    html += '<button type="button" class="p8-mb" data-p8dl="' + esc(pid) + '" data-p8kind="' + (isVid ? 'video' : 'photo') + '">💾 원본 저장</button>';
    if (bar2.__sig !== html) { bar2.__sig = html; bar2.innerHTML = html; }
  }
  function watchModal() {
    var box = $('photoModal');
    if (!box) return;
    var obs = new MutationObserver(function () {
      var open = !box.classList.contains('hidden');
      if (!open) { if (modalTimer) { clearTimeout(modalTimer); modalTimer = null; } curPid = null; return; }
      if (!curPid) {
        /* openPhoto 는 사진 id 를 밖으로 알려 주지 않는다 → 사진첩 그리드의 cells[data-photo] 중
           최근에 눌린 것을 알 수 없으므로, openPhoto 를 감싸 기록한다(wrapOpenPhoto). */
      }
      paintModalButtons(curPid);
    });
    obs.observe(box, { attributes: true, attributeFilter: ['class'] });
  }
  function wrapOpenPhoto() {
    if (!F || !F.openPhoto || F.openPhoto.__p8) return;
    var orig = F.openPhoto;
    var wrap = function (pid) {
      curPid = pid;
      try { paintModalButtons(pid); } catch (e) {}
      var r = orig.apply(F, arguments);
      setTimeout(function () { try { paintModalButtons(pid); } catch (e) {} }, 60);
      return r;
    };
    wrap.__p8 = 1;
    F.openPhoto = wrap;
  }

  /* ---------------- ④ 공유 앨범 버튼 ---------------- */
  function albumBar() {
    var al = albumUrl();
    if (!al) return '';
    return '<button type="button" class="p8-album" data-p8album="' + esc(al) + '">' +
      '<span class="e">📷</span><span><b>Google 포토 공유 앨범에 사진 보태기</b>' +
      '<small>가족이 찍은 사진을 한 앨범에 모아요</small></span><span class="go">열기 ›</span></button>';
  }
  function renderAlbumBars() {
    ['p8albHome', 'p8albPhotos'].forEach(function (id) {
      var host = $(id);
      if (!host) return;
      var html = albumBar();
      if (host.__sig !== html) { host.__sig = html; host.innerHTML = html; }
    });
  }

  /* ---------------- ⑤ 대표사진 배지 ---------------- */
  function decorateGrid() {
    var grid = $('photoGrid');
    if (!grid) return;
    var D = d();
    var pid = D && D.pod && D.pod.pid;
    var cells = grid.querySelectorAll('[data-photo]');
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      var mine = c.getAttribute('data-photo') === pid;
      var has = c.querySelector('.p8-grid-badge');
      if (mine && !has) {
        var b = document.createElement('span');
        b.className = 'p8-grid-badge';
        b.textContent = '📸 오늘';
        c.appendChild(b);
      } else if (!mine && has) {
        has.parentNode.removeChild(has);
      }
    }
  }

  /* ---------------- 스타일 ---------------- */
  function style() {
    if ($('p8style')) return;
    var s = document.createElement('style');
    s.id = 'p8style';
    s.textContent = [
      '.p8-hero{background:linear-gradient(180deg,#FFF8F1,#FFFFFF);border:1.5px solid #F3E7D8}',
      '.p8-hero-box{position:relative;border-radius:16px;overflow:hidden;background:#F1F4F5;aspect-ratio:4/3;cursor:pointer}',
      '.p8-hero-box img{width:100%;height:100%;object-fit:cover;display:block}',
      '.p8-hero-cap{padding:9px 2px 2px}',
      '.p8-hero-cap b{display:block;font-size:13px;font-weight:900;color:#1B2B24;letter-spacing:-.2px}',
      '.p8-hero-cap small{display:block;font-size:10.5px;color:#9AA4AF;font-weight:700;margin-top:3px}',
      '.p8-btns{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}',
      '.p8-b{flex:1 1 auto;min-width:0;text-align:center;padding:9px 10px;border-radius:12px;font-size:11px;font-weight:900;background:#F3F8F6;color:#0A7D56;border:1px solid #DCEFE6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-decoration:none}',
      '.p8-b.p8-gp{background:#EEF4FF;color:#2F6FD0;border-color:#DCE6FA}',
      '.p8-b.p8-al{background:#FFF4E8;color:#B4690E;border-color:#F6E2CB}',
      '.p8-play{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:46px;height:46px;border-radius:50%;background:rgba(12,18,22,.55);color:#fff;font-size:17px;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px);pointer-events:none}',
      '.p8-badge{position:absolute;left:9px;top:9px;background:rgba(12,18,22,.62);color:#fff;font-size:10px;font-weight:900;padding:5px 9px;border-radius:20px}',
      '.p8-head{display:flex;align-items:center;gap:6px;margin:2px 3px 7px;font-size:11.5px;font-weight:900;color:#3C4450}',
      '.p8-head span{margin-left:auto;font-size:10px;font-weight:800;color:#9AA4AF}',
      '.p8-vrow{display:flex;gap:8px;overflow-x:auto;padding:0 2px 4px;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch}',
      '.p8-vrow::-webkit-scrollbar{display:none}',
      '.p8-vcard{position:relative;flex:0 0 62%;max-width:280px;border-radius:16px;overflow:hidden;background:#0E1418;border:1.5px solid #E7EEF5;box-shadow:0 6px 16px rgba(20,24,29,.10);scroll-snap-align:start;cursor:pointer}',
      '.p8-vid{width:100%;aspect-ratio:16/9;object-fit:cover;display:block;background:#0E1418}',
      '.p8-dur{position:absolute;right:8px;top:8px;background:rgba(12,18,22,.62);color:#fff;font-size:10px;font-weight:900;padding:3px 7px;border-radius:20px}',
      '.p8-dl-s{position:absolute;right:6px;bottom:42px;background:rgba(12,18,22,.62);color:#fff;font-size:10px;font-weight:900;padding:5px 9px;border-radius:20px}',
      '.p8-vcap{padding:7px 10px 9px;background:#fff}',
      '.p8-vcap b{display:block;font-size:11.5px;font-weight:900;color:#1B2B24;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.p8-vcap small{display:block;font-size:9.5px;color:#9AA4AF;font-weight:700;margin-top:2px}',
      '.p8-album{width:100%;display:flex;align-items:center;gap:10px;text-align:left;background:linear-gradient(180deg,#FFF9F1,#FFFFFF);border:1.5px solid #F3E3CE;border-radius:16px;padding:12px 13px;margin:0 0 12px}',
      '.p8-album .e{font-size:20px;flex:none}',
      '.p8-album b{display:block;font-size:12px;font-weight:900;color:#3A2B12;letter-spacing:-.2px}',
      '.p8-album small{display:block;font-size:10px;color:#A08A6B;font-weight:700;margin-top:2px}',
      '.p8-album .go{margin-left:auto;font-size:10.5px;font-weight:900;color:#B4690E;flex:none}',
      '.p8-mbtns{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}',
      '.p8-mb{flex:1 1 auto;text-align:center;padding:8px 10px;border-radius:11px;font-size:11px;font-weight:900;background:rgba(255,255,255,.16);color:#fff;border:1px solid rgba(255,255,255,.22);text-decoration:none;white-space:nowrap}',
      '.p8-grid-badge{position:absolute;left:4px;bottom:4px;background:rgba(12,18,22,.6);color:#fff;font-size:9px;font-weight:900;padding:3px 7px;border-radius:20px;z-index:2}',
      '.p8-modal{position:fixed;inset:0;z-index:9999;background:rgba(6,10,12,.94);display:flex;flex-direction:column}',
      '.p8-modal .top{display:flex;align-items:center;gap:8px;padding:12px 14px;color:#fff;font-size:12.5px;font-weight:800}',
      '.p8-modal .top .sp{flex:1}',
      '.p8-modal .top button{background:rgba(255,255,255,.16);color:#fff;font-size:11.5px;font-weight:900;padding:7px 11px;border-radius:11px}',
      '.p8-modal .body{flex:1;display:flex;align-items:center;justify-content:center;padding:0 8px 8px}',
      '.p8-modal video{max-width:100%;max-height:100%;border-radius:12px;background:#000}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ---------------- 영상 크게 보기(소리·전체화면) ---------------- */
  function openVideo(id) {
    var D = d();
    var v = D && D.videos && D.videos[id];
    if (!v) return;
    var box = document.createElement('div');
    box.className = 'p8-modal';
    box.innerHTML = '<div class="top"><span>🎬 ' + esc(v.cap || '우리 가족 영상') + '</span><span class="sp"></span>' +
      '<button type="button" data-p8fs="1">⛶ 전체화면</button>' +
      '<button type="button" data-p8dl="' + esc(id) + '" data-p8kind="video">💾 저장</button>' +
      '<button type="button" data-p8close="1">닫기</button></div>' +
      '<div class="body"><video controls autoplay playsinline' + (v.poster ? ' poster="' + esc(v.poster) + '"' : '') + '></video></div>';
    document.body.appendChild(box);
    var vid = box.querySelector('video');
    F.mediaUrl(id).then(function (src) { if (src) { vid.src = src; var p = vid.play(); if (p && p.catch) p.catch(function () {}); } })
      .catch(function () { toast('영상을 불러오지 못했어요'); });
    box.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest('[data-p8close]')) { try { vid.pause(); } catch (x) {} box.parentNode.removeChild(box); return; }
      if (t.closest('[data-p8fs]')) {
        if (vid.requestFullscreen) vid.requestFullscreen().catch(function () {});
        else if (vid.webkitEnterFullscreen) vid.webkitEnterFullscreen();
        return;
      }
      var dl = t.closest('[data-p8dl]');
      if (dl) { e.stopPropagation(); downloadMedia(dl.getAttribute('data-p8dl'), 'video'); }
    });
  }

  /* ---------------- 이벤트 ---------------- */
  function wire() {
    if (wired) return;
    wired = true;
    document.addEventListener('click', function (e) {
      var t = e.target;
      var dl = t.closest && t.closest('[data-p8dl]');
      if (dl) { e.preventDefault(); e.stopPropagation(); downloadMedia(dl.getAttribute('data-p8dl'), dl.getAttribute('data-p8kind') || 'photo'); return; }
      var al = t.closest && t.closest('[data-p8album]');
      if (al) { e.preventDefault(); e.stopPropagation(); window.open(al.getAttribute('data-p8album'), '_blank', 'noopener'); return; }
      var op = t.closest && t.closest('[data-p8open]');
      if (op) {
        var pid = op.getAttribute('data-p8open');
        var kind = op.getAttribute('data-p8kind') || 'photo';
        e.preventDefault();
        if (kind === 'video') openVideo(pid);
        else { curPid = pid; if (F) F.openPhoto(pid); }
      }
    }, true);
  }

  /* ---------------- render / mount ---------------- */
  function render() {
    if (!F || !d() || !me()) return;
    style(); wire(); wrapOpenPhoto();
    try { renderPod(); } catch (e) { console.warn('P8 pod', e); }
    try { renderVideos(); } catch (e) { console.warn('P8 video', e); }
    try { renderAlbumBars(); } catch (e) { console.warn('P8 album', e); }
    try { decorateGrid(); } catch (e) { console.warn('P8 grid', e); }
  }
  function mount(FAM) {
    if (ON) return;
    F = FAM; ON = true;
    try { style(); wire(); wrapOpenPhoto(); watchModal(); render(); } catch (e) { console.warn('EXTRA8 mount', e); }
  }
  global.EXTRA8 = { mount: mount, render: render, pod: podRec, videos: videoList };

  var prevRender = global.__FAM_RENDER;
  var prevView = global.__FAM_VIEW;
  global.__FAM_RENDER = function () {
    if (prevRender) { try { prevRender(); } catch (e) {} }
    try {
      if (!ON && global.FAM && global.FAM.doc && global.FAM.doc() && global.FAM.me && global.FAM.me()) mount(global.FAM);
      else render();
    } catch (e) { console.warn('EXTRA8 render', e); }
  };
  global.__FAM_VIEW = function (v) {
    if (prevView) { try { prevView(v); } catch (e) {} }
    try { render(); } catch (e) {}
  };
  if (global.FAM4 && typeof global.FAM4.mount === 'function') {
    var om = global.FAM4.mount;
    global.FAM4.mount = function (FAM) {
      om.call(global.FAM4, FAM);
      try { mount(FAM); } catch (e) { console.warn('EXTRA8 mount', e); }
    };
  } else if (global.FAM) {
    /* 이미 열려 있는 상태(재배포 후) */
    try { mount(global.FAM); } catch (e) {}
  }
})(window);
