/* ============================================================
   우리가족포털 V9 · 생활 업그레이드 (life9.js)
   ① 위시리스트 V9 — 작성 버그 수정(시트 저장 경로 재구성) + 개인 5개 제한
      + 사진 첨부 + 네이버·다나와·쿠팡·구글쇼핑 최저가 검색 + 미쁠 최저가
   ② 용돈기입장 V9 — 매일 간단 입력(받은/쓴 돈·목적) + 잔액 자동 계산
      + 일자별 내역 영구 저장(23:59 구글드라이브 백업에 그대로 포함)
   ③ 과거 데이터 날짜별 조회(아카이브) + 수동 JSON 백업 다운로드
   ④ FAM9AI — 미쁠(가족 AI 비서) Gemini 엔진(모델·게이트웨이 폴백, 키는 이 기기에만 저장)
   ============================================================ */
(function (global) {
  'use strict';

  var F = null, ON = false;

  function $(id) { return document.getElementById(id); }
  function d() { return F && F.doc(); }
  function me() { return F && F.me(); }
  function esc(s) { return F ? F.esc(s) : String(s == null ? '' : s); }
  function save() { if (F) F.save(); }
  function toast(m) { if (F) F.toast(m); }
  function now() { return Date.now(); }
  function mid() { return me() ? me().id : ''; }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function ymd(ts) { var x = new Date(ts); return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); }
  function todayYmd() { return ymd(now()); }
  function won(n) { return Number(n || 0).toLocaleString('ko-KR') + '원'; }
  function count(o) { return Object.keys(o || {}).length; }
  function listOf(node) {
    var out = [];
    Object.keys(node || {}).forEach(function (k) {
      var it = node[k];
      if (it && typeof it === 'object' && !it.del) { it._id = k; out.push(it); }
    });
    return out;
  }
  function drop(node, id) { var it = node && node[id]; if (!it) return; it.del = 1; it.at = now(); }
  function memName(id) { var m = F && F.memOf(id); return m && m.name ? m.name : '가족'; }
  function memEmoji(id) { var m = F && F.memOf(id); return (m && m.emoji) || '🧑'; }

  function V9() {
    var D = d();
    if (!D) return null;
    if (!D.v9 || typeof D.v9 !== 'object') D.v9 = {};
    var v = D.v9;
    ['tama', 'room', 'minicar', 'moneyD', 'ddays', 'school', 'goals', 'sleep', 'layout', 'editLog', 'pod', 'archive', 'wish', 'commute', 'schoolMode', 'sb', 'mood', 'moodHist'].forEach(function (k) {
      if (!v[k] || typeof v[k] !== 'object') v[k] = {};
    });
    return v;
  }

  /* ============================================================
     ④ FAM9AI · 공용 Gemini 엔진
     ============================================================ */
  /* ------------------------------------------------------------
     공용 미쁠 Gemini 엔진
     상국포털(work/portal_plain_v2.html)의 검증된 window._sgGem 로직을 그대로 옮겼다:
       · 모델 순차 폴백 → ListModels 자동 탐색 → Vertex 게이트웨이 폴백
       · thinkingConfig { thinkingLevel:'LOW' } · 파라미터 거부 시 slim 재시도 · 429/503 1회 재시도
       · 오류를 삼키지 않고 사람이 읽을 수 있는 한국어 원인으로 돌려준다
     ------------------------------------------------------------ */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var LS_AI = 'sgftest9_gemini_v17';
  var LS_BEST = 'sgftest9_gemini_best_v17';
  var GEM_HOST = 'https://generativelanguage.googleapis.com/v1beta';
  var GEM_VERTEX = 'https://aiplatform.googleapis.com/v1/publishers/google/models/';
  var MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.1-pro-preview', 'gemini-3-flash-preview', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'];
  var LEGACY_MODELS = { 'gemini-2.5-pro': 1, 'gemini-2.5-flash': 1, 'gemini-2.0-flash': 1, 'gemini-1.5-flash': 1, 'gemini-1.5-pro': 1, 'gemini-2.0-flash-lite': 1 };

  /* 키는 한 곳에만 두지 않는다. 가족포털과 상국포털은 같은 주소(simsangguk-jpg.github.io)를
     쓰기 때문에 한 번 등록한 키를 서로 빌려 쓸 수 있다. */
  var KEY_SLOTS = [
    ['sgftest9_gemini_v17', '이 기기에 저장한 미쁠 키'],
    ['sgftest4_gemini_v17', '가족포털 음식분석 키'],
    ['sg_gemini_key_v1', '상국포털에 등록한 키']
  ];
  function keyClean(raw) {
    var v = String(raw == null ? '' : raw).trim();
    if (!v) return '';
    if (v.charAt(0) === '"' || v.charAt(0) === '{') {
      try {
        var j = JSON.parse(v);
        if (typeof j === 'string') v = j.trim();
        else if (j && typeof j.key === 'string') v = j.key.trim();
        else if (j && typeof j.value === 'string') v = j.value.trim();
      } catch (e) {}
    }
    return v.length >= 10 ? v : '';
  }
  function findKey() {
    for (var i = 0; i < KEY_SLOTS.length; i++) {
      var v = keyClean(lsGet(KEY_SLOTS[i][0]));
      if (v) return { key: v, slot: KEY_SLOTS[i][0], label: KEY_SLOTS[i][1] };
    }
    return null;
  }
  function maskKey(k) { return k ? String(k).slice(0, 4) + '…' + String(k).slice(-4) : ''; }

  var AI = (function () {
    var S = { lastModel: '', best: keyClean(lsGet(LS_BEST)), dead: {}, slim: {} };

    function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    function note(o, m) { if (o && typeof o.onNote === 'function') { try { o.onNote(m); } catch (e) {} } }
    function txt(e) { return String((e && e.message) || ''); }
    function fail(msg, code, extra) {
      var e = new Error(msg);
      if (code != null) e.code = code;
      if (extra) { for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) e[k] = extra[k]; }
      return e;
    }

    function keyFatal(e) {
      var m = txt(e);
      if (/API_KEY_SERVICE_BLOCKED|SERVICE_BLOCKED|SERVICE_DISABLED|PERMISSION_DENIED/i.test(m)) return false;
      return /API_KEY_INVALID|API key not valid|API key expired|API_KEY_EXPIRED|UNAUTHENTICATED|invalid authentication|API key is invalid/i.test(m);
    }
    function modelGone(e) {
      var c = e && e.code, m = txt(e);
      return c === 404 || (c === 400 && /not found|not supported|does not exist|unsupported model|invalid model/i.test(m));
    }
    function paramReject(e) {
      var c = e && e.code, m = txt(e);
      if (c !== 400 || keyFatal(e) || modelGone(e)) return false;
      return /generation_?config|temperature|top_?p|top_?k|thinking|candidate_?count|unknown name|invalid json|cannot find field/i.test(m);
    }
    function busy(e) {
      var c = e && e.code, m = txt(e);
      return c === 0 || c === 429 || c === 500 || c === 502 || c === 503 || /RESOURCE_EXHAUSTED|overloaded|temporarily|UNAVAILABLE|DEADLINE|rate limit|응답 시간 초과/i.test(m);
    }

    function pick(j) {
      var c = j && j.candidates && j.candidates[0];
      var ps = (c && c.content && c.content.parts) || [];
      var out = '', i;
      for (i = 0; i < ps.length; i++) if (ps[i] && typeof ps[i].text === 'string') out += ps[i].text;
      out = out.trim();
      if (out) return out;
      var why = '';
      if (j && j.promptFeedback && j.promptFeedback.blockReason) why = '차단: ' + j.promptFeedback.blockReason;
      else if (c && c.finishReason) why = c.finishReason;
      throw fail('빈 응답' + (why ? ' (' + why + ')' : ' (안전 필터 가능)'));
    }

    var REQ_MS = 20000;   /* 한 요청이 이보다 오래 걸리면 끊고 다음 모델로 넘어간다 */
    var BUDGET_MS = 45000; /* 한 번의 질문에 쓰는 전체 시간 — 이 시간이 지나면 반드시 답을 준다 */
    function request(o, model, slim, vertex) {
      var base = vertex ? GEM_VERTEX : (GEM_HOST + '/models/');
      var url = base + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(o.key);
      var parts = [{ text: o.prompt }];
      (o.images || []).forEach(function (du) {
        if (!du) return;
        var m = String(du).match(/^data:([^;]+);base64,(.*)$/);
        if (m) parts.push({ inline_data: { mime_type: m[1], data: m[2] } });
      });
      var body = { contents: [{ role: 'user', parts: parts }] };
      if (o.system) body.systemInstruction = { parts: [{ text: o.system }] };
      if (!slim) {
        body.generationConfig = {
          temperature: o.temperature != null ? o.temperature : 0.4,
          maxOutputTokens: o.maxTokens || 2048,
          topP: 0.9,
          thinkingConfig: { thinkingLevel: 'LOW' }
        };
      }
      var init = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store'
      };
      var ctrl = null, timer = null;
      if (typeof AbortController === 'function') {
        ctrl = new AbortController();
        init.signal = ctrl.signal;
        timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, o.timeoutMs || REQ_MS);
      }
      function done() { if (timer) { clearTimeout(timer); timer = null; } }
      return fetch(url, init).then(function (res) {
        return res.text().then(function (raw) {
          done();
          var j = {};
          try { j = raw ? JSON.parse(raw) : {}; } catch (e) {}
          if (!res.ok) {
            var msg = (j && j.error && j.error.message) ? j.error.message : String(raw || ('HTTP ' + res.status));
            throw fail(String(msg).slice(0, 300), res.status, { apiStatus: (j && j.error && j.error.status) || '' });
          }
          return pick(j);
        }, function (e) { done(); throw e; });
      }, function (netErr) {
        done();
        if (netErr && netErr.name === 'AbortError') throw fail('응답 시간 초과(' + Math.round(REQ_MS / 1000) + '초)', 0);
        throw fail('네트워크 오류: ' + ((netErr && netErr.message) || '요청 실패'), 0);
      });
    }

    /* 한 모델: 파라미터 거부 → generationConfig 없이 재시도, 혼잡(429/5xx) → 1.5초 뒤 1회 재시도 */
    function attempt(o, model, vertex) {
      function go(n) {
        return request(o, model, !!S.slim[model], vertex).catch(function (e) {
          if (paramReject(e) && !S.slim[model]) { S.slim[model] = 1; return go(n); }
          if (busy(e) && n < 1) { return sleep(1500).then(function () { return go(n + 1); }); }
          throw e;
        });
      }
      return go(0);
    }

    function rank(id) {
      var m = /gemini-(\d+)(?:[.\-](\d+))?/.exec(id);
      var s = m ? ((+m[1]) * 100 + (m[2] ? (+m[2]) * 10 : 0)) : 0;
      if (/thinking|deep-research/.test(id)) return -100;
      if (/flash-lite/.test(id)) s += 6;
      else if (/flash/.test(id)) s += 9;
      else if (/pro/.test(id)) s += 7;
      if (/preview|exp|experimental/.test(id)) s -= 3;
      return s;
    }

    function listModels(key) {
      return fetch(GEM_HOST + '/models?pageSize=200&key=' + encodeURIComponent(key), { cache: 'no-store' })
        .then(function (res) { return res.text(); })
        .then(function (raw) {
          var j = {};
          try { j = raw ? JSON.parse(raw) : {}; } catch (e) {}
          var arr = (j && j.models) || [], out = [], i, m, id, meth;
          for (i = 0; i < arr.length; i++) {
            m = arr[i] || {};
            id = String(m.name || '').replace(/^models\//, '');
            if (!/^gemini/.test(id)) continue;
            meth = (m.supportedGenerationMethods || m.supportedActions || []).join(',');
            if (meth.indexOf('generateContent') === -1) continue;
            if (/(^|-)tts|image|live|transcribe|embed|video|veo|omni|banana|audio-dialog/.test(id)) continue;
            if (rank(id) < 0) continue;
            out.push(id);
          }
          out.sort(function (a, b) { return rank(b) - rank(a); });
          return out;
        });
    }

    function generate(o) {
      o = o || {};
      if (!o.key) return Promise.reject(fail('Gemini API 키가 등록되어 있지 않아요.'));
      var deadline = Date.now() + (o.budgetMs || BUDGET_MS);
      var tried = {};

      function chain() {
        var out = [], seen = {};
        function add(m) { if (m && !seen[m]) { seen[m] = 1; out.push(m); } }
        add(S.best);
        add(o.first);
        for (var i = 0; i < MODELS.length; i++) add(MODELS[i]);
        return out;
      }

      function runList(list, vertex) {
        var i = 0, lastErr = null;
        return new Promise(function (resolve, reject) {
          function next() {
            var m = null, c;
            if (Date.now() > deadline) return reject(lastErr || fail('응답이 너무 늦어 시간 안에 답을 못 받았어요.'));
            while (i < list.length) {
              c = list[i++];
              if (!tried[c] && !(S.dead[c] && !vertex)) { m = c; break; }
            }
            if (!m) return reject(lastErr || fail('모든 모델 호출에 실패했어요.'));
            tried[m] = 1;
            attempt(o, m, !!vertex).then(function (t) {
              S.lastModel = m; S.best = m; delete S.dead[m];
              try { localStorage.setItem(LS_BEST, m); } catch (e) {}
              resolve(t);
            }).catch(function (e) {
              if (keyFatal(e)) {
                var k = fail(e.message, e.code, { fatal: true, keyError: true });
                return reject(k);
              }
              if (modelGone(e)) S.dead[m] = 1;
              lastErr = e;
              next();
            });
          }
          next();
        });
      }

      return runList(chain(), false).then(null, function (e) {
        if (e && e.fatal) throw e;
        if (Date.now() > deadline) throw e;
        note(o, '🔎 기본 후보가 모두 막혀 쓸 수 있는 모델을 자동 조회해요…');
        return listModels(o.key).then(function (found) {
          var extra = [], i;
          for (i = 0; i < found.length && extra.length < 8; i++) if (!tried[found[i]]) extra.push(found[i]);
          if (!extra.length) throw (e || fail('사용 가능한 모델을 찾지 못했어요.'));
          note(o, '🔎 자동 선택: ' + extra[0]);
          return runList(extra, false);
        }, function () {
          throw (e || fail('모델 목록을 조회하지 못했어요.'));
        });
      }).then(null, function (e) {
        if (e && e.fatal) return Promise.reject(e);
        if (Date.now() > deadline) return Promise.reject(e || fail('응답이 너무 늦어 시간 안에 답을 못 받았어요.'));
        note(o, '🔎 마지막으로 다른 게이트웨이 경로를 시도해요…');
        return runList(['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-pro-preview', 'gemini-3-flash-preview'], true);
      });
    }

    /* 원인을 사람 말로: 이 문장이 채팅창과 연결 테스트에 그대로 보인다 */
    function friendly(e) {
      var m = txt(e);
      if (!e) return '알 수 없는 이유로 답을 못 받았어요.';
      if (e.noKey) return '아직 Gemini 키가 없어요. 🔑 키 설정에서 키를 넣어 주세요.';
      if (/응답 시간 초과|응답이 너무 늦어/.test(m)) return 'Gemini 응답이 너무 늦어 그만 기다렸어요. 잠시 뒤 다시 물어봐 주세요.';
      if (e.code === 0) return '인터넷 연결 때문에 못 받았어요. 연결을 확인하고 다시 물어봐 주세요.';
      if (/API key not valid|API_KEY_INVALID|API key expired|API_KEY_EXPIRED|invalid authentication|UNAUTHENTICATED/i.test(m)) return 'Gemini 키가 올바르지 않거나 만료됐어요. 🔑 키 설정에서 새 키로 바꿔 주세요.';
      if (/API_KEY_SERVICE_BLOCKED|SERVICE_BLOCKED/i.test(m)) return '이 키에서는 Gemini API 사용이 막혀 있어요. Google AI Studio에서 새 키를 만들어 주세요.';
      if (/SERVICE_DISABLED|has not been used in project|is disabled|PERMISSION_DENIED/i.test(m)) return '이 키의 프로젝트에서 Gemini API가 꺼져 있어요. Google AI Studio에서 다시 만들어 주세요.';
      if (e.code === 429 || /RESOURCE_EXHAUSTED|quota|rate limit/i.test(m)) return '오늘 쓸 수 있는 무료 사용량을 다 썼어요. 내일 다시 하거나 다른 키를 넣어 주세요.';
      if (e.code === 503 || e.code === 500 || e.code === 502 || /overloaded|UNAVAILABLE/i.test(m)) return 'Gemini가 잠시 붐비고 있어요. 30초쯤 뒤에 다시 물어봐 주세요.';
      if (/빈 응답|blockReason|SAFETY/i.test(m)) return '안전 필터에 걸려 답을 못 만들었어요. 말을 조금 바꿔 물어봐 주세요.';
      if (/Failed to fetch|NetworkError|Load failed|네트워크/i.test(m)) return '네트워크가 막혀 있어요(비행기모드·와이파이 차단 등). 연결을 확인해 주세요.';
      if (/모든 모델|모델 목록|모든 모델 호출/.test(m)) return '지금 쓸 수 있는 Gemini 모델이 없어요. 키를 새로 만들어 주세요.';
      return '답을 못 받았어요' + (m ? ' (' + m.slice(0, 120) + ')' : '') + '.';
    }

    return { generate: generate, list: listModels, state: S, friendly: friendly, request: request };
  })();

  function ask(prompt, opts) {
    opts = opts || {};
    var found = opts.key ? { key: keyClean(opts.key), label: '직접 넣은 키' } : findKey();
    if (!found || !found.key) {
      var nk = new Error('아직 Gemini 키가 없어요. 🔑 키 설정에서 키를 넣어 주세요.');
      nk.noKey = true; nk.friendly = nk.message;
      return Promise.reject(nk);
    }
    var imgs = (opts.images && opts.images.length) ? opts.images : (opts.imageDataUrl ? [opts.imageDataUrl] : []);
    return AI.generate({
      key: found.key,
      prompt: prompt,
      system: opts.system,
      images: imgs,
      temperature: opts.temperature,
      maxTokens: opts.maxTokens,
      first: opts.model && !LEGACY_MODELS[opts.model] ? opts.model : '',
      onNote: opts.onNote
    }).then(null, function (e) {
      var err = new Error(AI.friendly(e));
      err.friendly = err.message;
      err.raw = (e && e.message) || '';
      err.code = e && e.code;
      err.noKey = !!(e && e.noKey);
      throw err;
    });
  }

  /* 연결 테스트: 지금 넣은 키로 실제 모델을 한 번 부른다 */
  function testKey(k) {
    var key = keyClean(k) || (findKey() || {}).key;
    if (!key) {
      var e0 = new Error('Gemini 키를 먼저 넣어 주세요.');
      e0.friendly = e0.message; e0.noKey = true;
      return Promise.reject(e0);
    }
    var t0 = Date.now();
    return AI.generate({
      key: key,
      prompt: '연결 확인이야. "미쁠 연결 성공"이라고만 답해줘.',
      system: '너는 연결 시험용 도우미야. 인사나 설명 없이 "미쁠 연결 성공"만 답해.',
      temperature: 0,
      maxTokens: 64,
      timeoutMs: 12000,
      budgetMs: 26000
    }).then(function (t) {
      return { ok: true, model: AI.state.lastModel, ms: Date.now() - t0, text: String(t) };
    }, function (e) {
      var err = new Error(AI.friendly(e));
      err.friendly = err.message;
      err.code = e && e.code;
      err.noKey = !!(e && e.noKey);
      throw err;
    });
  }

  function keySheet(title, intro, cb) {
    var found = findKey();
    F.openSheet('<h3>💚 ' + esc(title || '미쁠 AI 키 설정') + '</h3>' +
      '<div class="sdesc">' + esc(intro || '키는 이 기기에만 저장되고 가족에게 공유되지 않아요.') + '</div>' +
      '<div class="form-row"><label>Gemini API 키</label><input class="field" id="f9aiKey" placeholder="AIza… 또는 AQ…" autocapitalize="none" autocomplete="off" spellcheck="false" value="' + esc(found ? found.key : '') + '"></div>' +
      '<div class="hint" id="f9aiState" style="min-height:17px">' + (found
        ? '✅ ' + esc(found.label) + '를 쓰고 있어요 (' + esc(maskKey(found.key)) + ')'
        : '아직 등록된 키가 없어요. 아래에서 무료 키를 만들 수 있어요.') + '</div>' +
      '<div style="display:flex;gap:7px;margin-top:8px;flex-wrap:wrap">' +
      '<button type="button" class="btn ghost" data-sheet-close style="flex:0 0 auto">취소</button>' +
      '<button type="button" class="btn ghost" id="f9aiTest" style="flex:1">🔌 연결 테스트</button>' +
      '<button type="button" class="btn" id="f9aiSave" style="flex:1">저장</button></div>' +
      (found && found.slot === LS_AI ? '<button type="button" class="btn ghost" id="f9aiDel" style="margin-top:7px;padding:8px;font-size:12px;color:#B42318">저장된 키 지우기</button>' : '') +
      '<a class="hint" style="display:block;margin-top:8px" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">🔑 무료 키 발급받기 (Google AI Studio)</a>');

    var st = $('f9aiState');
    function say(msg, color) { if (st) { st.innerHTML = msg; st.style.color = color || ''; } }

    $('f9aiTest').onclick = function () {
      var k = ($('f9aiKey').value || '').trim();
      if (!k) { say('키를 먼저 넣어 주세요.', '#B42318'); return; }
      var b = $('f9aiTest');
      b.disabled = true; b.textContent = '🔌 확인 중…';
      say('실제로 모델에 한 번 물어보는 중이에요…', '#79838F');
      testKey(k).then(function (r) {
        lsSet(LS_AI, k);
        say('✅ 연결 성공 · ' + esc(r.model || '') + ' · ' + (r.ms / 1000).toFixed(1) + '초 · "' + esc(String(r.text).slice(0, 20)) + '"', '#0A7D56');
        toast('미쁠 연결 성공! 💚');
        b.disabled = false; b.textContent = '🔌 연결 테스트';
      }, function (e) {
        say('❌ ' + esc(e.friendly || e.message || '연결에 실패했어요.'), '#B42318');
        b.disabled = false; b.textContent = '🔌 연결 테스트';
      });
    };
    $('f9aiSave').onclick = function () {
      var k = ($('f9aiKey').value || '').trim();
      if (!k) { say('키를 넣어 주세요.', '#B42318'); return; }
      lsSet(LS_AI, k);
      F.closeSheet();
      toast('미쁠 키를 저장했어요 💚');
      if (cb) cb();
    };
    if ($('f9aiDel')) $('f9aiDel').onclick = function () {
      lsSet(LS_AI, '');
      F.closeSheet();
      toast('저장된 키를 지웠어요');
    };
  }

  global.FAM9AI = {
    ask: ask,
    key: function () { return (findKey() || {}).key || ''; },
    keyInfo: findKey,
    keyLabel: function () { var f = findKey(); return f ? f.label : ''; },
    mask: maskKey,
    setKey: function (k) { lsSet(LS_AI, String(k || '').trim()); },
    clearKey: function () { lsSet(LS_AI, ''); },
    test: testKey,
    friendly: function (e) { return AI.friendly(e); },
    state: AI.state,
    keySheet: keySheet
  };

  /* ============================================================
     ① 위시리스트 V9
     ============================================================ */
  function shopLinks(name) {
    var q = encodeURIComponent(name || '');
    return {
      danawa: 'https://search.danawa.com/dsearch.php?query=' + q,
      naver: 'https://search.shopping.naver.com/search/all?query=' + q,
      coupang: 'https://www.coupang.com/np/search?q=' + q,
      google: 'https://www.google.com/search?tbm=shop&q=' + q
    };
  }
  function wishMineN(v) {
    return listOf(v.wish).filter(function (e) { return e.by === mid(); }).length;
  }
  function migrateWish(v) {
    var D = d();
    var old = D && D.v4 && D.v4.wish;
    if (!old) return;
    var moved = false;
    Object.keys(old).forEach(function (k) {
      var it = old[k];
      if (!it || it.del || !it.name || it.__m9) return;
      var exists = Object.keys(v.wish).some(function (x) { return v.wish[x] && v.wish[x].name === it.name && v.wish[x].by === it.by; });
      if (!exists) {
        v.wish['m9' + k] = { name: it.name, price: it.price || '', memo: it.memo || '', photo: it.photo || null, by: it.by, at: it.at || now(), got: it.got || 0, dibs: it.dibs || {} };
      }
      it.__m9 = 1;
      moved = true;
    });
    if (moved) save();
  }
  function secWish() {
    return '<div class="card" id="v9Wish" style="border:1.5px solid #DCEFE5;background:linear-gradient(180deg,#F6FCF9,#FFFFFF)">' +
      '<div class="card-head"><h2>🎁 갖고 싶은 물건 목록</h2><span class="sub" id="v9WishN">0개</span></div>' +
      '<div class="fb-desc">한 사람당 <b>최대 5개</b>까지 올릴 수 있어요. 사진을 붙이고, 최저가를 바로 검색하거나 <b>미쁠 최저가 조회</b>(미쁠 키 등록 시)도 돼요.</div>' +
      '<div id="v9WishList" style="margin-top:9px"></div>' +
      '<button type="button" class="btn soft" id="v9WishAdd" style="margin-top:4px">＋ 위시리스트에 올리기</button></div>';
  }
  function renderWish() {
    var v = V9();
    if (!v) return;
    migrateWish(v);
    /* 옛날 카드는 숨기고 V9 카드로 대체 */
    var oldCard = $('v4Wish');
    if (oldCard && !oldCard.classList.contains('hidden')) oldCard.classList.add('hidden');
    var box = $('v9WishList'), nEl = $('v9WishN');
    if (!box) return;
    var es = listOf(v.wish).sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    if (nEl) nEl.textContent = es.length + '개 · 내 것 ' + wishMineN(v) + '/5';
    var sig = JSON.stringify(es.map(function (e) { return [e._id, e.name, e.price, e.got, count(e.dibs), e.ai && e.ai.price, e.photo && e.photo.thumb ? 1 : 0]; }));
    if (box.__sig === sig) return;
    if (box.contains(document.activeElement)) return;
    box.__sig = sig;
    if (!es.length) { box.innerHTML = '<div class="v4-empty">아직 위시리스트가 비어 있어요 — 첫 물건을 올려 보세요!</div>'; return; }
    box.innerHTML = es.map(function (e) {
      var l = shopLinks(e.name);
      var dibs = e.dibs || {}, mineDib = !!dibs[mid()], dibsN = count(dibs);
      return '<div class="v4-wish">' +
        '<div class="v4-row" style="border-bottom:none;padding:0"><span class="e">' +
        (e.photo && e.photo.thumb ? '<img src="' + e.photo.thumb + '" alt="" style="width:44px;height:44px;border-radius:11px;object-fit:cover">' : '🎁') + '</span>' +
        '<span class="tx"><b>' + esc(e.name) + '</b>' +
        '<small>' + (e.price ? esc(e.price) + ' · ' : '') + (e.ai && e.ai.price ? '<span style="color:#0A7D56;font-weight:800">💚 미쁠 ' + esc(e.ai.price) + '</span>' + (e.ai.shop ? ' (' + esc(e.ai.shop) + ')' : '') + ' · ' : '') +
        memEmoji(e.by) + ' ' + esc(memName(e.by)) + (e.memo ? ' · ' + esc(e.memo) : '') + '</small></span>' +
        (e.got ? '<span class="v4-tag">선물 완료 🎉</span>' : '') + '</div>' +
        '<div class="v4-links">' +
        '<a class="dn" href="' + l.danawa + '" target="_blank" rel="noopener">다나와</a>' +
        '<a class="nv" href="' + l.naver + '" target="_blank" rel="noopener">네이버쇼핑</a>' +
        '<a class="cp" href="' + l.coupang + '" target="_blank" rel="noopener">쿠팡</a>' +
        '<a class="v4-tag gray" style="text-decoration:none" href="' + l.google + '" target="_blank" rel="noopener">구글쇼핑</a>' +
        '<button type="button" class="v4-tag" data-v9ai="' + e._id + '" style="border:none">💚 미쁠 최저가</button>' +
        '<button type="button" class="v4-tag ' + (mineDib ? '' : 'gray') + '" data-v9dib="' + e._id + '" style="border:none">' + (mineDib ? '❤️ 찜함' : '🤍 찜하기') + (dibsN ? ' ' + dibsN : '') + '</button>' +
        '<button type="button" class="v4-tag ' + (e.got ? '' : 'gray') + '" data-v9got="' + e._id + '" style="border:none">사주기</button>' +
        (e.by === mid() ? '<button type="button" class="v4-tag gray" data-v9del="' + e._id + '" style="border:none">삭제</button>' : '') +
        '</div></div>';
    }).join('');
  }
  function wishSheet() {
    var v = V9();
    if (wishMineN(v) >= 5) { toast('위시리스트는 한 사람당 최대 5개까지예요 — 먼저 하나를 지워 보세요'); return; }
    F.openSheet('<h3>🎁 위시리스트에 올리기</h3><div class="sdesc">갖고 싶은 것을 올리면 가족이 보고 쿠팡·선물을 고를 수 있어요.</div>' +
      '<div class="form-row"><label>갖고 싶은 것</label><input class="field" id="v9WsName" maxlength="40" placeholder="예: 무선 이어폰"></div>' +
      '<div class="form-row"><label>가격대 (선택)</label><input class="field" id="v9WsPrice" maxlength="20" placeholder="예: 5~7만원"></div>' +
      '<div class="form-row"><label>메모 (선택)</label><input class="field" id="v9WsMemo" maxlength="50" placeholder="예: 흰색이면 좋아요"></div>' +
      '<div class="form-row"><label>사진 (선택)</label><button type="button" class="btn ghost" id="v9WsPhoto">📷 사진 고르기</button><div id="v9WsPrev" style="margin-top:7px"></div></div>' +
      '<div style="display:flex;gap:8px;margin-top:6px"><button type="button" class="btn ghost" data-sheet-close>취소</button><button type="button" class="btn" id="v9WsSave">올리기</button></div>');
    var photo = null;
    $('v9WsPhoto').onclick = function () {
      F.pickImages(function (files) {
        F.saveMedia(files[0]).then(function (m) {
          photo = m;
          $('v9WsPrev').innerHTML = '<img src="' + m.thumb + '" style="width:100%;border-radius:12px">';
        }).catch(function () { toast('사진을 올리지 못했어요'); });
      }, true);
    };
    /* 시트 안에서 Enter로 저장되도록 + 저장 버튼 한 번만 연결(이중 바인딩 방지) */
    $('v9WsSave').onclick = function () {
      var name = ($('v9WsName').value || '').trim();
      if (!name) { toast('무엇을 갖고 싶은지 적어 주세요'); return; }
      var v2 = V9();
      var id = 'w' + now().toString(36) + Math.random().toString(36).slice(2, 4);
      v2.wish[id] = { name: name, price: ($('v9WsPrice').value || '').trim(), memo: ($('v9WsMemo').value || '').trim(), photo: photo, by: mid(), at: now(), got: 0, dibs: {} };
      save();
      box_sig_reset();
      renderWish();
      F.closeSheet();
      toast('위시리스트에 올렸어요 🎁');
    };
  }
  function box_sig_reset() { var b = $('v9WishList'); if (b) b.__sig = null; }
  function aiPrice(id) {
    var v = V9(), e = v.wish[id];
    if (!e) return;
    if (!global.FAM9AI.key()) { global.FAM9AI.keySheet('미쁠 최저가 조회', '미쁠이 물건 이름을 보고 최저가를 추정해 알려 줘요.', function () { aiPrice(id); }); return; }
    toast('💚 미쁠이 최저가를 찾아 보는 중…');
    global.FAM9AI.ask(
      '아래는 가족 위시리스트에 올라온 물건이야. 한국 온라인 시장(네이버쇼핑·다나와·쿠팡 기준)에서의 대략적인 최저가를 추정해서 "숫자원(예: 89,000원)" 형식과 어느 쇼핑몰이 가장 싼지 한 줄로만 알려줘.\n물건: ' + e.name + (e.price ? '\n원하는 가격대: ' + e.price : '')
    ).then(function (txt) {
      var m = String(txt).replace(/\n/g, ' ').match(/[\d,\s]+원/);
      var v2 = V9();
      var e2 = v2 && v2.wish[id];
      if (!e2) return;
      e2.ai = { price: m ? m[0].replace(/\s/g, '') : txt.slice(0, 40), shop: (String(txt).match(/(쿠팡|네이버|다나와|구글|Coupang)/i) || [''])[0], at: now() };
      save(); box_sig_reset(); renderWish();
    }).catch(function (err) {
      toast('미쁠 조회 실패 — ' + ((err && (err.friendly || err.message)) || '잠시 후 다시 시도해 주세요'));
    });
  }
  function wireWish() {
    document.addEventListener('click', function (e) {
      var v = V9();
      if (!v) return;
      var add = e.target.closest('#v9WishAdd');
      if (add) { wishSheet(); return; }
      var d1 = e.target.closest('[data-v9dib]');
      if (d1) {
        var r1 = v.wish[d1.getAttribute('data-v9dib')];
        if (!r1) return;
        if (!r1.dibs) r1.dibs = {};
        if (r1.dibs[mid()]) delete r1.dibs[mid()]; else r1.dibs[mid()] = now();
        r1.at = now(); save(); box_sig_reset(); renderWish(); return;
      }
      var d2 = e.target.closest('[data-v9got]');
      if (d2) {
        var r2 = v.wish[d2.getAttribute('data-v9got')];
        if (!r2) return;
        r2.got = r2.got ? 0 : 1; r2.at = now();
        save(); box_sig_reset(); renderWish();
        toast(r2.got ? '선물 완료로 표시했어요 🎉' : '다시 위시로 돌렸어요');
        return;
      }
      var d3 = e.target.closest('[data-v9del]');
      if (d3) { drop(v.wish, d3.getAttribute('data-v9del')); save(); box_sig_reset(); renderWish(); return; }
      var d4 = e.target.closest('[data-v9ai]');
      if (d4) { aiPrice(d4.getAttribute('data-v9ai')); return; }
    });
  }

  /* ============================================================
     ② 용돈기입장 V9 (매일 간단 입력)
     DOC.v9.moneyD[memberId][ymd] = { items:[{k, amt, t, at}] }
     ============================================================ */
  function myMoney(v) { var m = v.moneyD[mid()] || (v.moneyD[mid()] = {}); return m; }
  function daySum(day) {
    var got = 0, spent = 0;
    (day.items || []).forEach(function (it) {
      if (it.k === 'got') got += it.amt; else spent += it.amt;
    });
    return { got: got, spent: spent };
  }
  function totalBalance(v) {
    var days = myMoney(v), bal = 0;
    Object.keys(days).forEach(function (ds) {
      var s = daySum(days[ds]);
      bal += s.got - s.spent;
    });
    return bal;
  }
  function secMoney() {
    return '<div class="card" id="v9Money" style="border:1.5px solid #FFE3C2;background:linear-gradient(180deg,#FFF9F2,#FFFFFF)">' +
      '<div class="card-head"><h2>💰 오늘의 용돈기입장</h2><span class="sub" id="v9MnBal">–</span></div>' +
      '<div class="fb-desc">매일 받은 용돈·쓴 용돈과 목적을 한 줄로 남기면 <b>남은 잔액이 자동 계산</b>되고, 날짜별로 영구 저장돼요(구글드라이브 백업 포함).</div>' +
      '<div style="display:flex;gap:6px;margin-top:8px">' +
      '<select class="field" id="v9MnK" style="flex:0 0 96px;margin-bottom:0"><option value="got">💵 받음</option><option value="spent">🛍️ 사용</option></select>' +
      '<input class="field" id="v9MnAmt" type="number" inputmode="numeric" placeholder="금액" style="flex:0 0 92px;margin-bottom:0">' +
      '<input class="field" id="v9MnT" maxlength="24" placeholder="목적 (예: 간식, 저금)" style="margin-bottom:0;flex:1">' +
      '</div>' +
      '<button type="button" class="btn" id="v9MnAdd" style="margin-top:8px">＋ 오늘 기록 남기기</button>' +
      '<div id="v9MnList" style="margin-top:9px"></div></div>';
  }
  function renderMoney() {
    var v = V9();
    if (!v) return;
    var balEl = $('v9MnBal'), list = $('v9MnList');
    if (!list) return;
    var bal = totalBalance(v);
    if (balEl) balEl.textContent = '남은 잔액 ' + won(bal);
    var days = myMoney(v);
    var ds = Object.keys(days).sort().reverse().slice(0, 14);
    var sig = JSON.stringify([bal, ds.map(function (k) { return [k, days[k].items && days[k].items.length]; })]);
    if (list.__sig === sig) return;
    if (list.contains(document.activeElement)) return;
    list.__sig = sig;
    if (!ds.length) { list.innerHTML = '<div class="v4-empty">오늘 받은/쓴 용돈을 한 줄로 남겨 보세요!</div>'; return; }
    var run2 = bal;
    /* 잔액은 과거→현재 누적이라 역순 표시하며 흐름을 함께 보여준다 */
    list.innerHTML = ds.map(function (k) {
      var day = days[k], s = daySum(day);
      return '<div class="v4-wish"><div class="v4-row" style="border-bottom:1px dashed #EDF1F4;padding-bottom:5px"><span class="e">📅</span>' +
        '<span class="tx"><b>' + k.slice(5).replace('-', '/') + '</b><small>받음 ' + won(s.got) + ' · 사용 ' + won(s.spent) + '</small></span>' +
        '<span class="rt" style="font-weight:800;color:#0A7D56">' + won(s.got - s.spent) + '</span></div>' +
        (day.items || []).map(function (it, i) {
          return '<div class="v4-row" style="padding:3px 2px"><span class="e">' + (it.k === 'got' ? '💵' : '🛍️') + '</span>' +
            '<span class="tx"><b>' + won(it.amt) + '</b><small>' + esc(it.t || (it.k === 'got' ? '용돈 받음' : '사용')) + ' · ' + F.hhmm(it.at || 0) + '</small></span>' +
            '<button type="button" class="v4-tag gray" data-v9mndel="' + esc(k) + ':' + i + '" style="border:none">✕</button></div>';
        }).join('') + '</div>';
    }).join('');
  }
  function wireMoney() {
    document.addEventListener('click', function (e) {
      var add = e.target.closest('#v9MnAdd');
      if (add) {
        var v = V9();
        var k = $('v9MnK').value, amt = Math.round(Number($('v9MnAmt').value || 0)), t = ($('v9MnT').value || '').trim();
        if (!amt) { toast('금액을 적어 주세요'); return; }
        var days = myMoney(v), yk = todayYmd();
        if (!days[yk]) days[yk] = { items: [] };
        if (!days[yk].items) days[yk].items = [];
        days[yk].items.push({ k: k, amt: amt, t: t, at: now() });
        days[yk].at = now();
        save();
        $('v9MnAmt').value = ''; $('v9MnT').value = '';
        list_sig_reset();
        renderMoney();
        toast(k === 'got' ? '💵 ' + won(amt) + ' 받았어요!' : '🛍️ ' + won(amt) + ' 기록했어요');
        return;
      }
      var del = e.target.closest('[data-v9mndel]');
      if (del) {
        var v2 = V9(), parts = del.getAttribute('data-v9mndel').split(':');
        var days2 = myMoney(v2), day = days2[parts[0]];
        if (day && day.items && day.items[Number(parts[1])]) {
          day.items.splice(Number(parts[1]), 1);
          save(); list_sig_reset(); renderMoney();
        }
      }
    });
  }
  function list_sig_reset() { var l = $('v9MnList'); if (l) l.__sig = null; }

  /* ============================================================
     ③ 과거 데이터 날짜별 조회(아카이브) + JSON 백업
     ============================================================ */
  function snapshotDay(v, yk) {
    var D = d();
    var prev = v.archive[yk] || {};
    var money = {}, tama = {}, mood = {};
    Object.keys(v.mood || {}).forEach(function (mk) {
      var r = v.mood[mk];
      if (r && r.e) mood[mk] = { e: r.e, note: r.note || '' };
    });
    Object.keys(v.moneyD || {}).forEach(function (mk) {
      var day = (v.moneyD[mk] || {})[yk];
      var got = 0, spent = 0;
      if (day) (day.items || []).forEach(function (it) { if (it.k === 'got') got += it.amt; else spent += it.amt; });
      money[mk] = { got: got, spent: spent };
    });
    Object.keys(v.tama || {}).forEach(function (tk) {
      var t = v.tama[tk];
      if (t) tama[tk] = { name: t.name, lv: t.lv, full: t.full, happy: t.happy, energy: t.energy };
    });
    var rec = {
      at: now(), by: mid() || 'system',
      status: JSON.parse(JSON.stringify(D.status || {})),
      money: money, tama: tama, mood: mood,
      counts: {
        photos: count(D.photos), letters: count(D.letters), diary: count(D.diary),
        wish: count(v.wish), minicar: count(v.minicar)
      }
    };
    /* 기록이 이미 있으면 status 등은 그대로 두고 시간만 갱신하지 않는다(첫 기록 우선) */
    if (prev.at) rec.status = prev.status || rec.status;
    v.archive[yk] = rec;
  }
  function secArchive() {
    return '<div class="card" id="v9Arch" style="border:1.5px solid #E2DFF5;background:linear-gradient(180deg,#F8F7FF,#FFFFFF)">' +
      '<div class="card-head"><h2>🗂️ 그날 그날 기록 보기</h2><span class="sub">날짜별 아카이브</span></div>' +
      '<div class="fb-desc">앱을 켤 때마다 그날의 상태(귀가 현황·용돈·자료 수)가 자동 저장돼요. 사진·일기·편지·상벌점까지 날짜로 모아 보려면 <b>기록 › 날짜별 기록</b>을 여세요. 전체 데이터는 JSON으로 백업할 수 있어요.</div>' +
      '<button type="button" class="btn soft" id="v9ArchGoHist" style="margin-top:8px;padding:10px;font-size:12.5px">🗂️ 날짜별 기록 열기</button>' +
      '<div style="display:flex;gap:7px;margin-top:8px">' +
      '<input class="field" id="v9ArchDate" type="date" style="margin-bottom:0;flex:1">' +
      '<button type="button" class="btn ghost" id="v9ArchGo" style="width:auto;padding:0 14px">조회</button></div>' +
      '<div id="v9ArchBody" style="margin-top:9px"></div>' +
      '<button type="button" class="btn soft" id="v9Backup" style="margin-top:9px">⬇️ 전체 데이터 JSON 백업 받기</button>' +
      '</div>';
  }
  function renderArchive() {
    var v = V9();
    if (!v) return;
    var inp = $('v9ArchDate');
    if (inp && !inp.value) inp.value = todayYmd();
  }
  function showArchive(yk) {
    var v = V9(), box = $('v9ArchBody');
    if (!box) return;
    var a = v.archive[yk];
    /* 지난 날짜에 스냅숏이 없으면 지금 상태를 '그날 기록'으로 지어내지 않는다.
       (예전에는 조회할 때마다 오늘 상태를 그날 기록처럼 저장해 과거가 뒤섞였다) */
    if (!a) {
      box.innerHTML = '<div class="v4-wish"><b>📅 ' + esc(yk) + '</b>' +
        '<div class="v4-empty" style="margin-top:6px">이 날은 저장된 상태 스냅숏이 없어요.<br>' +
        '그날의 사진·일기·편지·상벌점·용돈·일정은 <b>기록 › 날짜별 기록</b>에서 볼 수 있어요.</div>' +
        '<button type="button" class="btn soft" id="v9ArchOpenHist" style="margin-top:8px">🗂️ 날짜별 기록에서 보기</button></div>';
      return;
    }
    var html = '<div class="v4-wish"><b>📅 ' + esc(yk) + ' 기록</b>';
    var ms = F.members();
    html += '<div class="v4-row" style="margin-top:6px"><span class="e">🚗</span><span class="tx"><b>귀가 현황</b><small>' + ms.map(function (m) {
      var s = (a.status || {})[m.id];
      return m.name + ' ' + (s ? (s.s === 'home' ? '🏠 도착' : (s.s === 'depart' ? '🚗 출발' : (s.eta ? '⏰ ' + s.eta : '📱 공유'))) : '–');
    }).join(' · ') + '</small></span></div>';
    html += '<div class="v4-row"><span class="e">💰</span><span class="tx"><b>용돈</b><small>' + ms.map(function (m) {
      var mo = (a.money || {})[m.id] || {};
      return m.name + ' +' + won(mo.got || 0) + '/-' + won(mo.spent || 0);
    }).join(' · ') + '</small></span></div>';
    html += '<div class="v4-row"><span class="e">🥚</span><span class="tx"><b>다마고치</b><small>' + Object.keys(a.tama || {}).map(function (tk) {
      var t = a.tama[tk];
      return esc(t.name) + ' Lv.' + t.lv + ' (행복 ' + t.happy + ')';
    }).join(' · ') + '</small></span></div>';
    var c = a.counts || {};
    html += '<div class="v4-row"><span class="e">📦</span><span class="tx"><b>자료 수</b><small>사진 ' + (c.photos || 0) + ' · 편지 ' + (c.letters || 0) + ' · 일기 ' + (c.diary || 0) + ' · 위시 ' + (c.wish || 0) + '</small></span></div>';
    html += '</div>';
    box.innerHTML = html;
  }
  function wireArchive() {
    document.addEventListener('click', function (e) {
      var go = e.target.closest('#v9ArchGo');
      if (go) {
        var yk = ($('v9ArchDate').value || todayYmd());
        showArchive(yk);
        return;
      }
      var gh = e.target.closest('#v9ArchGoHist');
      if (gh) {
        if (window.FAMHIST) window.FAMHIST.go(todayYmd());
        if (window.FAMNAV) window.FAMNAV.go('record', 'day');
        return;
      }
      var oh = e.target.closest('#v9ArchOpenHist');
      if (oh) {
        var yk2 = ($('v9ArchDate') && $('v9ArchDate').value) || todayYmd();
        if (window.FAMHIST) window.FAMHIST.go(yk2);
        if (window.FAMNAV) window.FAMNAV.go('record', 'day');
        return;
      }
      var bk = e.target.closest('#v9Backup');
      if (bk) {
        var D = d();
        if (!D) return;
        var body = JSON.stringify({ kind: 'family-portal-backup', exportedAt: new Date().toISOString(), doc: D }, null, 1);
        var blob = new Blob([body], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = '우리가족포털_백업_' + todayYmd().replace(/-/g, '') + '.json';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { try { URL.revokeObjectURL(a.href); a.remove(); } catch (err) {} }, 1200);
        toast('백업 파일을 내려받았어요');
      }
    });
  }

  /* ---------------- mount & render ---------------- */
  function ensureSections() {
    var all = $('view-all');
    if (!all) return;
    var anchor = $('v4Tube') || all.children[1] || null;
    /* V11: 위시리스트는 💗 좋아하는 것과 한 카드로 통합됐다(extra4.js).
       그 카드가 없는 예전 화면에서만 따로 그려 준다. */
    if (!$('v9Wish')) {
      var div = document.createElement('div');
      div.innerHTML = secWish();
      all.insertBefore(div.firstChild, anchor);
    }
    if (!$('v9Arch')) {
      var divA = document.createElement('div');
      divA.innerHTML = secArchive();
      all.insertBefore(divA.firstChild, anchor);
    }
    var lifeMoney = $('life-money');
    if (lifeMoney && !$('v9Money')) {
      var div2 = document.createElement('div');
      div2.innerHTML = secMoney();
      lifeMoney.appendChild(div2.firstChild);
    }
  }
  function render() {
    if (!ON || !F || !F.doc() || !F.me()) return;
    ensureSections();
    renderWish();
    renderMoney();
    renderArchive();
  }
  function mount(FAM) {
    if (ON) return;
    F = FAM; ON = true;
    wireWish(); wireMoney(); wireArchive();
    render();
  }
  setInterval(function () {
    if (!ON && global.FAM && global.FAM.doc && global.FAM.doc() && global.FAM.me && global.FAM.me()) mount(global.FAM);
  }, 1400);

  /* 렌더 체인 + 스냅샷 저장 */
  var prevRender = global.__FAM_RENDER;
  global.__FAM_RENDER = function () {
    if (prevRender) { try { prevRender(); } catch (e) {} }
    try { render(); } catch (e) { console.warn('LIFE9 render', e); }
    try {
      var v = V9();
      if (v) {
        var yk = todayYmd();
        if (!v.archive[yk]) { snapshotDay(v, yk); save(); }
      }
    } catch (e) {}
  };
  var prevView = global.__FAM_VIEW;
  global.__FAM_VIEW = function (v) {
    if (prevView) { try { prevView(v); } catch (e) {} }
    if (v === 'all' || v === 'life') { try { render(); } catch (e) {} }
  };
})(window);
