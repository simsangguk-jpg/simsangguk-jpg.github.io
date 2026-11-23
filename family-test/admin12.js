/* ============================================================================
   우리가족포털 V18 · 👑 가족 회원 관리 (아빠 전용)
   ----------------------------------------------------------------------------
   · 아빠(role '아빠' 또는 관리자 아이디)로 로그인했을 때만 '우리집' 탭에
     '👑 회원관리' 칩과 패널이 보인다. 다른 가족에게는 패널 자체가 만들어지지 않는다.
   · 회원 목록(이름·역할·아이디·이모지·생년월일·상태) 확인
   · 이름·역할·이모지·생년월일 수정
   · 비밀번호 재설정(같은 PBKDF2-SHA256 · 12만 회 규격으로 새 salt/hash 생성)
   · 퇴장(로그인 차단 + 15초 동기화에서 자동 로그아웃) / 복구 / 완전 삭제
   · 아빠 본인 계정은 퇴장·삭제·역할 변경이 막힌다.
   ----------------------------------------------------------------------------
   비밀번호 평문은 저장하지 않는다. 가족 DB 는 가족 전원이 같은 마스터 키로
   열 수 있어서, 평문을 넣으면 가족 모두가 서로의 비밀번호를 볼 수 있게 된다.
   그래서 '보기' 대신 '새로 지정해 주기'만 제공한다.
   ========================================================================== */
(function (global) {
  'use strict';

  var F = null;
  var ROLES = ['아빠', '엄마', '첫째아들', '둘째아들', '아들', '딸', '가족'];
  var ORDER = { '아빠': 0, '엄마': 1, '첫째아들': 2, '둘째아들': 3, '아들': 2, '딸': 3, '가족': 4 };
  var cssDone = false;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function ensureF() {
    if (F && F.doc && F.doc()) return F;
    F = (global.FAM && global.FAM.doc && global.FAM.doc()) ? global.FAM : F;
    return F;
  }
  function me() { try { return ensureF() ? F.me() : null; } catch (e) { return null; } }
  function doc() { try { return ensureF() ? F.doc() : null; } catch (e) { return null; } }

  /* 아빠 판정 — 회원 기록의 adm 표시 또는 역할 '아빠' 또는 관리자 아이디 */
  function isAdmin() {
    var D = doc(), m0 = me();
    if (!D || !m0) return false;
    var m = D.members && D.members[m0.id];
    if (m && m.adm) return true;
    if (m0.id === 'simsangguk') return true;
    return (m0.role || '') === '아빠';
  }
  /* 관리자 표시를 내 기록에 남긴다(다른 기기에서도 같은 권한으로 보이게) */
  function pinAdmin() {
    var D = doc(), m0 = me();
    if (!D || !m0 || !D.members || !D.members[m0.id]) return;
    var rec = D.members[m0.id];
    if (rec.adm) return;
    rec.adm = 1;
    rec.at = Date.now();
    try { F.save(); } catch (e) { }
  }

  /* ---------------- 암호(PBKDF2-SHA256 · 12만 회) ---------------- */
  function b64(u8) {
    var out = '', chunk = 0x8000;
    for (var i = 0; i < u8.length; i += chunk) out += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
    return btoa(out);
  }
  function unb64(s) {
    var bin = atob(s), u8 = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }
  function newSalt() {
    var u = new Uint8Array(16);
    crypto.getRandomValues(u);
    return b64(u);
  }
  function hashPw(pw, saltB64, iter) {
    return crypto.subtle.importKey('raw', new TextEncoder().encode(pw), { name: 'PBKDF2' }, false, ['deriveBits'])
      .then(function (mat) {
        return crypto.subtle.deriveBits(
          { name: 'PBKDF2', salt: unb64(saltB64), iterations: iter || 120000, hash: 'SHA-256' }, mat, 256);
      })
      .then(function (bits) { return b64(new Uint8Array(bits)); });
  }
  function makePw() {
    var abc = 'abcdefghjkmnpqrstuvwxyz23456789', out = '';
    var r = new Uint8Array(8);
    crypto.getRandomValues(r);
    for (var i = 0; i < r.length; i++) out += abc.charAt(r[i] % abc.length);
    return out;
  }

  /* ---------------- 공통 ---------------- */
  function label(m) {
    var role = (m && m.role) || '가족';
    var e = (m && m.emoji) || (F ? F.roleEmoji(role) : '🧑');
    return e + ' ' + ((m && m.name) || '가족');
  }
  function birthText(b) {
    if (!b) return '생일 미등록';
    var p = String(b).split('-');
    if (p.length === 3) return p[0] + '.' + Number(p[1]) + '.' + Number(p[2]);
    return String(b);
  }
  function listMembers() {
    var D = doc();
    if (!D || !D.members) return [];
    return Object.keys(D.members)
      .filter(function (k) { var m = D.members[k]; return m && !m.gone; })
      .map(function (k) { return { id: k, m: D.members[k] }; })
      .sort(function (a, b) {
        var da = !!a.m.d, db = !!b.m.d;
        if (da !== db) return da ? 1 : -1;                 /* 정상 회원 먼저 */
        var oa = ORDER[a.m.role] === undefined ? 5 : ORDER[a.m.role];
        var ob = ORDER[b.m.role] === undefined ? 5 : ORDER[b.m.role];
        if (oa !== ob) return oa - ob;
        return String(a.m.name || '').localeCompare(String(b.m.name || ''), 'ko');
      });
  }
  function touch(rec) { rec.at = Date.now(); try { F.save(); } catch (e) { } }
  function saveNow() { try { return F.push(); } catch (e) { return Promise.resolve(false); } }

  /* ---------------- 스타일(한 번만) ---------------- */
  function injectCss() {
    if (cssDone || $('famAdmCss')) return;
    cssDone = true;
    var st = document.createElement('style');
    st.id = 'famAdmCss';
    st.textContent = [
      '#famAdminCard .adm-sep{height:1px;background:#E9EEF1;margin:16px 0 14px}',
      '#famAdminCard .adm-sub{font-size:12px;font-weight:800;color:#3C4450;margin:0 0 8px}',
      '.famadm-row{display:flex;align-items:center;gap:11px;width:100%;text-align:left;padding:11px 10px;border-radius:14px;background:#F7FAF9;border:1px solid #EAF1EF;margin-bottom:8px}',
      '.famadm-row:active{background:#EEF7F3}',
      '.famadm-row .av{font-size:20px;width:34px;height:34px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;border:1px solid #E4EDEA;flex:0 0 auto}',
      '.famadm-row .info{display:flex;flex-direction:column;min-width:0;flex:1}',
      '.famadm-row .info b{font-size:13.5px;font-weight:800;color:#14181D;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.famadm-row .info i{font-size:10.5px;font-style:normal;color:#79838F;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.famadm-row .info em{font-size:10px;font-style:normal;color:#9AA4AF;font-weight:600}',
      '.famadm-bd{font-size:9.5px;font-weight:800;padding:3px 7px;border-radius:20px;flex:0 0 auto}',
      '.famadm-bd.ok{background:#E7F8F1;color:#0A7D56}',
      '.famadm-bd.off{background:#FDECEA;color:#C0392B}',
      '.famadm-pwrow{display:flex;gap:8px;align-items:center}',
      '.famadm-pwrow .field{margin-bottom:0;flex:1;min-width:0}',
      '.famadm-pwrow .chip-btn{flex:0 0 auto;white-space:nowrap}',
      '.famadm-ok{background:#E7F8F1;border:1px solid #BFE9D8;border-radius:12px;padding:10px 12px;font-size:12px;color:#0A7D56;font-weight:700;margin-top:8px;word-break:break-all}',
      '.famadm-warn{background:#FFF6E8;border:1px solid #F6E0B8;border-radius:12px;padding:10px 12px;font-size:11.5px;color:#8A5A12;font-weight:650;line-height:1.5}',
      '.btn.danger{background:#D9534F;color:#fff}'
    ].join('\n');
    document.head.appendChild(st);
  }

  /* ---------------- 목록 카드 ---------------- */
  function render() {
    if (!doc() || !me()) return;
    var pane = $('pane-house-admin');
    if (!pane) return;
    if (!isAdmin()) {
      var card0 = $('famAdminCard');
      if (card0 && card0.parentNode) card0.parentNode.removeChild(card0);
      return;
    }
    pinAdmin();
    injectCss();
    var card = $('famAdminCard');
    if (!card || card.parentNode !== pane) {
      if (!card) {
        card = document.createElement('div');
        card.id = 'famAdminCard';
        card.className = 'card';
      }
      pane.appendChild(card);
      card.innerHTML =
        '<div class="card-head"><h2>👑 가족 회원 관리</h2><span class="sub">아빠 전용</span>' +
        '<button type="button" class="chip-btn" id="famAdmSync" style="margin-left:auto">🔄 동기화</button></div>' +
        '<div class="hint" style="margin-bottom:10px">기존 비밀번호는 암호화되어 볼 수 없어요. 대신 새 비밀번호를 바로 지정해 줄 수 있어요.</div>' +
        '<div id="famAdmList"></div>' +
        '<div class="hint" style="margin-top:10px">퇴장시키면 그 기기는 15초 안에 자동으로 로그아웃돼요. 실수로 눌러도 다시 복구할 수 있고, 아빠 본인 계정은 퇴장·삭제되지 않아요.</div>';
      $('famAdmSync').addEventListener('click', function () {
        try { F.pull(true); } catch (e) { }
        render();
        try { F.toast('가족과 맞췄어요'); } catch (e) { }
      });
    }
    var box = $('famAdmList');
    if (!box) return;
    var mine = me().id;
    var html = listMembers().map(function (o) {
      var m = o.m, off = !!m.d;
      return '<button type="button" class="famadm-row" data-adm="' + esc(o.id) + '">' +
        '<span class="av">' + esc(m.emoji || (F ? F.roleEmoji(m.role) : '🧑')) + '</span>' +
        '<span class="info"><b>' + esc(m.name || '가족') + (o.id === mine ? ' <span style="color:#0A7D56">·나</span>' : '') + '</b>' +
        '<i>' + esc(m.role || '가족') + ' · ' + esc(o.id) + '</i>' +
        '<em>' + esc(birthText(m.birth)) + '</em></span>' +
        '<span class="famadm-bd ' + (off ? 'off">퇴장됨' : 'ok">정상') + '</span>' +
        '<span style="color:#B6C0CA;font-size:16px">›</span></button>';
    }).join('');
    if (box.__sig !== html) {
      box.__sig = html;
      box.innerHTML = html;
      Array.prototype.forEach.call(box.querySelectorAll('[data-adm]'), function (b) {
        b.addEventListener('click', function () { openMember(b.getAttribute('data-adm')); });
      });
    }
  }

  /* ---------------- 회원 상세 시트 ---------------- */
  function roleOpts(cur) {
    return ROLES.map(function (r) {
      return '<option value="' + esc(r) + '"' + (r === cur ? ' selected' : '') + '>' + esc(r) + '</option>';
    }).join('');
  }
  function openMember(id) {
    var D = doc();
    if (!D || !D.members[id]) { try { F.toast('회원 정보를 찾지 못했어요'); } catch (e) { } return; }
    var m = D.members[id];
    var mine = me().id === id;
    var role = m.role || '가족';
    var emoji = m.emoji || (F ? F.roleEmoji(role) : '🧑');
    var off = !!m.d;
    var html = '<h3>' + esc(emoji) + ' ' + esc(m.name || '가족') + '</h3>' +
      '<div class="sdesc">' + esc(role) + ' · 아이디 <b>' + esc(id) + '</b>' + (mine ? ' · 내 계정' : '') +
      (off ? ' · <b style="color:#C0392B">퇴장됨</b>' : '') + '</div>' +
      '<div class="form-row"><label>이름·호칭</label><input class="field" id="admName" maxlength="12" value="' + esc(m.name || '') + '"></div>' +
      '<div class="form-row"><label>역할</label><select class="field" id="admRole"' + (mine ? ' disabled' : '') + '>' + roleOpts(role) + '</select></div>' +
      '<div class="form-row"><label>이모지</label><input class="field" id="admEmoji" maxlength="4" value="' + esc(emoji) + '"></div>' +
      '<div class="form-row"><label>생년월일</label><input class="field" type="date" id="admBirth" value="' + esc(m.birth || '') + '"></div>' +
      '<div style="display:flex;gap:8px;margin-top:2px">' +
      '<button type="button" class="btn ghost" data-sheet-close style="flex:1">닫기</button>' +
      '<button type="button" class="btn" id="admSave" style="flex:1.4">저장</button></div>' +
      '<div class="adm-sep"></div>' +
      '<div class="adm-sub">🔑 비밀번호</div>' +
      '<div class="hint" style="margin-bottom:8px">기존 비밀번호는 암호화되어 볼 수 없어요. 새 비밀번호를 지금 지정해 바로 바꿔 줄 수 있어요.</div>' +
      '<div class="form-row"><label>새 비밀번호 (4자 이상)</label>' +
      '<div class="famadm-pwrow"><input class="field" id="admPw" placeholder="새 비밀번호" autocapitalize="none" autocomplete="new-password" maxlength="40">' +
      '<button type="button" class="chip-btn" id="admGen">🎲 자동</button></div></div>' +
      '<button type="button" class="btn" id="admPwSave">비밀번호 바꾸기</button>' +
      '<div id="admPwOut"></div>' +
      '<div class="adm-sep"></div>' +
      (mine
        ? '<div class="famadm-warn">내 계정은 퇴장·삭제하거나 역할을 바꿀 수 없어요. 다른 아빠 계정으로 관리해 주세요.</div>'
        : (off
          ? '<button type="button" class="btn" id="admRestore">♻️ 다시 들여보내기</button>' +
            '<button type="button" class="btn ghost" id="admDelete" style="color:#D9534F">🗑️ 계정 완전 삭제</button>'
          : '<button type="button" class="btn ghost" id="admKick" style="color:#D9534F">🚪 퇴장시키기</button>' +
            '<button type="button" class="btn ghost" id="admDelete" style="color:#D9534F">🗑️ 계정 완전 삭제</button>'));
    try { F.openSheet(html); } catch (e) { return; }

    $('admSave').addEventListener('click', function () {
      var name = ($('admName').value || '').trim();
      if (!name) { F.toast('이름을 적어 주세요'); return; }
      var D2 = doc(), rec = D2.members[id];
      if (!rec) return;
      var dup = Object.keys(D2.members).filter(function (k) {
        return k !== id && !D2.members[k].gone && !D2.members[k].d && D2.members[k].name === name;
      });
      if (dup.length) { F.toast('같은 호칭이 이미 있어요'); return; }
      var newRole = mine ? (rec.role || '가족') : ($('admRole').value || rec.role);
      var emojiNow = ($('admEmoji').value || '').trim();
      rec.name = name;
      rec.role = newRole;
      rec.emoji = emojiNow || F.roleEmoji(newRole);
      var b = ($('admBirth').value || '').trim();
      if (b) rec.birth = b; else delete rec.birth;
      touch(rec);
      saveNow();
      try { F.closeSheet(); } catch (e) { }
      render();
      F.toast(name + ' 님 정보를 저장했어요');
    });

    $('admGen').addEventListener('click', function () {
      $('admPw').value = makePw();
      $('admPw').type = 'text';
    });

    $('admPwSave').addEventListener('click', function () {
      var pw = ($('admPw').value || '');
      if (pw.length < 4) { F.toast('4자 이상으로 정해 주세요'); return; }
      var btn = $('admPwSave');
      btn.disabled = true; btn.textContent = '바꾸는 중…';
      var salt = newSalt();
      hashPw(pw, salt, 120000).then(function (h) {
        var D2 = doc(), rec = D2 && D2.members[id];
        if (!rec) throw new Error('gone');
        rec.salt = salt;
        rec.hash = h;
        rec.iter = 120000;
        rec.pwAt = Date.now();
        rec.pwBy = me().id;
        touch(rec);
        return saveNow();
      }).then(function () {
        var out = $('admPwOut');
        if (out) {
          out.innerHTML = '<div class="famadm-ok">✅ 새 비밀번호: <b>' + esc(pw) + '</b><br>' +
            '이 창을 닫으면 다시 볼 수 없어요. ' + esc(m.name || '가족') + ' 님께 바로 알려 주세요.</div>';
        }
        $('admPw').value = '';
        btn.disabled = false; btn.textContent = '비밀번호 바꾸기';
        F.toast('새 비밀번호로 바꿨어요');
      }).catch(function () {
        btn.disabled = false; btn.textContent = '비밀번호 바꾸기';
        F.toast('바꾸지 못했어요. 다시 시도해 주세요');
      });
    });

    if ($('admKick')) $('admKick').addEventListener('click', function () {
      confirmBox('🚪 퇴장시키기',
        label(m) + ' 님을 퇴장시키면 지금 쓰는 기기에서도 15초 안에 로그아웃돼요. 다시 들여보낼 수는 있어요.',
        '퇴장시키기', function () { setKick(id, true); });
    });
    if ($('admRestore')) $('admRestore').addEventListener('click', function () {
      setKick(id, false);
    });
    if ($('admDelete')) $('admDelete').addEventListener('click', function () {
      confirmBox('🗑️ 계정 완전 삭제',
        label(m) + ' 님의 계정을 가족 목록에서 완전히 지워요. 되돌릴 수 없고, 같은 아이디로 다시 가입해야 해요.',
        '완전 삭제', function () { removeMember(id); });
    });
  }

  /* ---------------- 동작 ---------------- */
  function confirmBox(title, desc, okText, onOk) {
    try {
      F.openSheet('<h3>' + esc(title) + '</h3>' +
        '<div class="famadm-warn" style="margin-bottom:12px">' + esc(desc) + '</div>' +
        '<div style="display:flex;gap:8px">' +
        '<button type="button" class="btn ghost" data-sheet-close style="flex:1">취소</button>' +
        '<button type="button" class="btn danger" id="admOk" style="flex:1.4">' + esc(okText) + '</button></div>');
    } catch (e) { return; }
    $('admOk').addEventListener('click', function () {
      try { F.closeSheet(); } catch (e) { }
      onOk();
    });
  }

  function setKick(id, on) {
    var D = doc(), rec = D && D.members[id], m0 = me();
    if (!rec || !m0) return;
    if (id === m0.id) { F.toast('내 계정은 퇴장시킬 수 없어요'); return; }
    if (on) {
      rec.d = 1;
      rec.kicked = 1;
      rec.kickAt = Date.now();
      rec.kickBy = m0.id;
    } else {
      rec.d = 0;
      rec.kicked = 0;
      rec.backAt = Date.now();
      rec.backBy = m0.id;
    }
    touch(rec);
    saveNow();
    render();
    F.toast(on ? (rec.name + ' 님을 퇴장시켰어요') : (rec.name + ' 님을 다시 들여보냈어요'));
  }

  function removeMember(id) {
    var D = doc(), rec = D && D.members[id], m0 = me();
    if (!rec || !m0) return;
    if (id === m0.id) { F.toast('내 계정은 삭제할 수 없어요'); return; }
    /* 다른 기기의 옛 사본이 되살리지 못하도록 기록 자체는 남기고 '삭제됨' 표시만 한다 */
    rec.d = 1;
    rec.kicked = 1;
    rec.gone = 1;
    rec.goneAt = Date.now();
    rec.goneBy = m0.id;
    rec.salt = '';
    rec.hash = '';
    touch(rec);
    saveNow();
    render();
    F.toast((rec.name || '회원') + ' 님 계정을 삭제했어요');
  }

  /* ---------------- 실행 ---------------- */
  var prevRender = global.__FAM_RENDER;
  global.__FAM_RENDER = function () {
    if (typeof prevRender === 'function') { try { prevRender(); } catch (e) { } }
    try { render(); } catch (e) { }
  };

  var tries = 0;
  setInterval(function () {
    tries++;
    try {
      ensureF();
      if (!doc() || !me()) return;
      render();
      if (tries > 40) { /* 첫 몇 초는 패널이 늦게 만들어질 수 있어 여러 번 확인한다 */ }
    } catch (e) { if (global.console && tries < 6) console.warn('famadmin', e); }
  }, 1200);

  global.FAMADMIN = {
    isAdmin: isAdmin,
    render: render,
    openMember: openMember,
    list: listMembers
  };
})(window);
