/* ============================================================
   TOOL — JSON整形・検証 (Pretty / Minify / Validate)
   Mirrors js/tools/counter.js. See CONTRACT.md.
   ============================================================ */
(function () {
  'use strict';

  var CSS = [
    '.json-pane{padding:16px;gap:14px;display:flex;flex-direction:column;max-width:980px;margin:0 auto;width:100%}',
    '.json-pane textarea{min-height:24vh;flex:0 0 auto}',
    '.json-controls{display:flex;flex-wrap:wrap;gap:10px;align-items:center}',
    '.json-controls .spacer{flex:1 1 auto}',
    '.json-seg{display:inline-flex;gap:4px;background:var(--surface-2);padding:4px;border-radius:var(--r-pill);box-shadow:var(--shadow-sm)}',
    '.json-seg button{min-height:44px;min-width:48px;border:0;background:transparent;border-radius:999px;font-weight:800;font-size:13px;color:var(--muted);cursor:pointer;padding:0 12px;transition:transform .12s var(--spring),background .15s,color .15s}',
    '.json-seg button:active{transform:scale(.92)}',
    '.json-seg button.on{background:var(--surface);color:var(--text);box-shadow:var(--shadow-sm)}',
    '.json-toggle{display:inline-flex;align-items:center;gap:8px;min-height:44px;font-weight:800;font-size:13px;color:var(--text);cursor:pointer;user-select:none;-webkit-user-select:none}',
    '.json-toggle input{position:absolute;opacity:0;width:0;height:0}',
    '.json-toggle .knob{position:relative;width:46px;height:26px;border-radius:999px;background:var(--surface-2);box-shadow:inset 0 0 0 2px var(--line);transition:background .18s var(--spring)}',
    '.json-toggle .knob::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:var(--shadow-sm);transition:transform .2s var(--spring)}',
    '.json-toggle input:checked + .knob{background:var(--green)}',
    '.json-toggle input:checked + .knob::after{transform:translateX(20px)}',
    '.json-status{border-radius:14px;padding:11px 14px;font-weight:800;font-size:14px;line-height:1.4;box-shadow:var(--shadow-sm);border-left:6px solid var(--line);background:var(--surface);color:var(--muted);word-break:break-word}',
    '.json-status.ok{border-left-color:var(--green);background:rgba(40,200,120,.12);color:#0f7a45}',
    '.json-status.err{border-left-color:var(--red);background:rgba(255,77,87,.12);color:#c02633}',
    '.json-status .loc{display:inline-block;margin-left:6px;font-weight:700;opacity:.85;font-size:12px}',
    '.json-stats{display:flex;flex-wrap:wrap;gap:10px}',
    '.json-stat{background:var(--surface);border-radius:14px;padding:8px 14px;box-shadow:var(--shadow-sm);border-left:5px solid var(--accent,var(--blue));font-size:13px;font-weight:700}',
    '.json-stat b{font-size:20px;font-weight:800;margin-right:6px}',
    '.json-stat span{color:var(--muted)}',
    '.json-out{margin:0;flex:1 1 auto;min-height:18vh;max-height:46vh;overflow:auto;background:#0f1424;color:#dde3f0;border-radius:var(--r-card);padding:14px 16px;font-size:13px;line-height:1.55;white-space:pre;-webkit-overflow-scrolling:touch;box-shadow:var(--shadow-sm)}',
    '.json-out.empty{display:flex;align-items:center;justify-content:center;color:#8a93ad;font-style:italic;white-space:normal;text-align:center}',
    '.json-out .json-k{color:#7ec7ff}',  /* key */
    '.json-out .json-s{color:#9be6a0}',  /* string */
    '.json-out .json-n{color:#ffd479}',  /* number */
    '.json-out .json-b{color:#ff9ed2}',  /* boolean */
    '.json-out .json-u{color:#b39dff}'   /* null */
  ].join('');

  /* escape for safe HTML insertion — run BEFORE building any highlight markup */
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* Recursively rebuild objects with sorted keys (arrays keep their order). */
  function sortKeys(value) {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value && typeof value === 'object') {
      var out = {};
      Object.keys(value).sort().forEach(function (k) { out[k] = sortKeys(value[k]); });
      return out;
    }
    return value;
  }

  /* Syntax highlight: escape the full string first, then wrap tokens with spans.
     The escaping does not touch double-quotes, so the string regex still sees real ". */
  function highlight(jsonText) {
    var safe = esc(jsonText);
    // Order matters: match (key-with-colon) | string | boolean | null | number
    return safe.replace(
      /("(?:\\.|[^"\\])*"\s*:)|("(?:\\.|[^"\\])*")|\b(true|false)\b|\b(null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
      function (m, key, str, bool, nul, num) {
        if (key != null) {
          // split the colon (and any whitespace) back out so it stays uncolored
          var idx = m.lastIndexOf('"');
          var keyPart = m.slice(0, idx + 1);
          var rest = m.slice(idx + 1);
          return '<span class="json-k">' + keyPart + '</span>' + rest;
        }
        if (str != null) return '<span class="json-s">' + str + '</span>';
        if (bool != null) return '<span class="json-b">' + bool + '</span>';
        if (nul != null) return '<span class="json-u">' + nul + '</span>';
        if (num != null) return '<span class="json-n">' + num + '</span>';
        return m;
      }
    );
  }

  /* Derive line/column from a character offset into the source string. */
  function lineColFromPos(src, pos) {
    if (typeof pos !== 'number' || pos < 0 || pos > src.length) return null;
    var line = 1, col = 1;
    for (var i = 0; i < pos; i++) {
      if (src.charCodeAt(i) === 10) { line++; col = 1; } else { col++; }
    }
    return { line: line, col: col };
  }

  /* Portable: pull the integer offset out of the engine message, ignore the wording. */
  function posFromError(err) {
    if (err && typeof err.message === 'string') {
      var m = err.message.match(/position\s+(\d+)/i);
      if (m) return parseInt(m[1], 10);
    }
    return null;
  }

  function maxDepth(value) {
    if (Array.isArray(value)) {
      var dA = 1, i;
      for (i = 0; i < value.length; i++) dA = Math.max(dA, 1 + maxDepth(value[i]));
      return value.length ? dA : 1;
    }
    if (value && typeof value === 'object') {
      var keys = Object.keys(value), dO = 1, j;
      for (j = 0; j < keys.length; j++) dO = Math.max(dO, 1 + maxDepth(value[keys[j]]));
      return keys.length ? dO : 1;
    }
    return 0;
  }

  function topLevelCount(value) {
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === 'object') return Object.keys(value).length;
    return 0;
  }

  var SAMPLE = JSON.stringify({
    name: 'ULTRA ARCADE',
    version: 1.0,
    fun: true,
    nothing: null,
    tags: ['game', 'tool', 'studio'],
    author: { handle: '@ultra', emoji: '🎮', note: 'angle < bracket & amp > test' },
    levels: [{ id: 1, hard: false }, { id: 2, hard: true }]
  });

  function mount(root, ctx) {
    ctx.injectCSS('tool-json', CSS);
    var saved = ctx.storage('json-text');

    var indent = '  ';        // current indent unit (2 spaces default)
    var sortOn = false;       // sort-keys toggle
    var debounceTimer = null; // tracked so unmount can clear it
    var focusTimer = null;    // tracked so unmount can clear it
    var lastValid = null;     // last validity state for transition sounds

    var ta = ctx.el('textarea', {
      class: 'field mono',
      placeholder: 'ここに JSON を貼り付けると、入力中に検証するのだ。「整形」で整えるのだ。',
      spellcheck: 'false'
    });
    ta.value = saved.get('');

    var status = ctx.el('div', { class: 'json-status' }, 'JSON を入力してほしいのだ。');
    var stats = ctx.el('div', { class: 'json-stats' });
    var out = ctx.el('pre', { class: 'json-out empty', html: '整形結果はここに出るのだ。' });

    /* ---- indent segmented control ---- */
    var indentDefs = [
      { label: '2スペース', val: '  ' },
      { label: '4スペース', val: '    ' },
      { label: 'タブ', val: '\t' }
    ];
    var segBtns = [];
    var seg = ctx.el('div', { class: 'json-seg' });
    indentDefs.forEach(function (d, i) {
      var b = ctx.el('button', {
        type: 'button',
        class: i === 0 ? 'on' : '',
        onClick: function () {
          indent = d.val;
          segBtns.forEach(function (x) { x.classList.remove('on'); });
          b.classList.add('on');
          ctx.sound.play('tab');
          render(true); // reformat current output with new indent if valid
        }
      }, d.label);
      segBtns.push(b);
      seg.appendChild(b);
    });

    /* ---- sort-keys toggle ---- */
    var sortInput = ctx.el('input', { type: 'checkbox' });
    sortInput.addEventListener('change', function () {
      sortOn = sortInput.checked;
      ctx.sound.play('toggle');
      render(true);
    });
    var sortToggle = ctx.el('label', { class: 'json-toggle' },
      sortInput, ctx.el('span', { class: 'knob' }), 'キーをソート');

    /* ---- action buttons (≥44px tap targets via .btn) ---- */
    function btn(label, cls, fn) {
      return ctx.el('button', { type: 'button', class: 'btn ' + cls + ' squish', onClick: fn }, label);
    }

    var btnPretty = btn('整形', 'btn-primary', function () { format(false); });
    var btnMinify = btn('圧縮', 'btn-accent', function () { format(true); });
    var btnCopy = btn('コピー', 'btn-green', function () {
      var text = out.dataset.raw || '';
      if (!text) { ctx.toast('コピーする結果がないのだ'); ctx.sound.play('error'); return; }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          ctx.toast('コピーしたのだ'); ctx.sound.play('coin');
        }, function () { ctx.toast('コピーに失敗したのだ'); ctx.sound.play('error'); });
      } else {
        ctx.toast('コピーに失敗したのだ'); ctx.sound.play('error');
      }
    });
    var btnClear = btn('クリア', 'btn-ghost', function () {
      ta.value = '';
      out.dataset.raw = '';
      setOutput('', '整形結果はここに出るのだ。');
      saved.set('');
      validate(false);
      ctx.sound.play('back');
      ta.focus();
    });
    var btnSample = btn('サンプル', 'btn-ghost', function () {
      ta.value = SAMPLE;
      saved.set(ta.value);
      ctx.sound.play('pop');
      format(false);
    });

    var controls = ctx.el('div', { class: 'json-controls' },
      btnPretty, btnMinify, btnCopy, btnClear, btnSample,
      ctx.el('div', { class: 'spacer' }),
      seg, sortToggle
    );

    root.appendChild(ctx.el('div', { class: 'json-pane' },
      ta, controls, status, stats, out
    ));

    /* ---- output helpers ---- */
    function setOutput(raw, htmlOrPlaceholder) {
      out.dataset.raw = raw || '';
      if (raw) {
        out.classList.remove('empty');
        out.innerHTML = highlight(raw);
      } else {
        out.classList.add('empty');
        out.innerHTML = esc(htmlOrPlaceholder || '整形結果はここに出るのだ。');
      }
    }

    /* Parse current input. Returns { ok, value } or { ok:false, error }. */
    function parseInput() {
      var text = ta.value;
      if (text.trim() === '') return { ok: null }; // neutral / empty
      try {
        return { ok: true, value: JSON.parse(text) };
      } catch (e) {
        return { ok: false, error: e };
      }
    }

    /* Live validation + stats. playSound only on a valid<->invalid transition. */
    function validate(allowSound) {
      var res = parseInput();
      stats.innerHTML = '';

      if (res.ok === null) {
        status.className = 'json-status';
        status.textContent = 'JSON を入力してほしいのだ。';
        lastValid = null;
        return res;
      }

      if (res.ok) {
        status.className = 'json-status ok';
        status.innerHTML = '';
        status.appendChild(document.createTextNode('✅ 有効な JSON なのだ'));
        // stats
        var depth = maxDepth(res.value);
        var tlc = topLevelCount(res.value);
        var typeLabel = Array.isArray(res.value) ? '配列'
          : (res.value && typeof res.value === 'object') ? 'オブジェクト'
            : '値';
        stats.append(
          stat(tlc, Array.isArray(res.value) ? '要素数' : 'トップレベルのキー', 'var(--blue)'),
          stat(depth, 'ネストの深さ', 'var(--purple)'),
          stat(typeLabel, '型', 'var(--teal)')
        );
        if (allowSound && lastValid === false) ctx.sound.play('success');
        lastValid = true;
      } else {
        status.className = 'json-status err';
        status.innerHTML = '';
        var msg = (res.error && res.error.message) ? res.error.message : 'パースに失敗したのだ';
        var pos = posFromError(res.error);
        var lc = pos != null ? lineColFromPos(ta.value, pos) : null;
        // When we derive our own line/col, strip the engine's trailing position
        // clause (V8: "... at position N (line L column C)") to avoid showing it twice.
        if (lc) msg = msg.replace(/\s*(?:in JSON\s*)?at position\s+\d+.*$/i, '');
        // Some engines embed a raw snippet of the user's input
        // (e.g. V8: «..., "{bad}" is not valid JSON»). Drop that tail so the
        // banner stays concise and never echoes a confusing input fragment.
        msg = msg.replace(/,?\s*"[\s\S]*?"\s+is not valid JSON\s*$/i, '');
        status.appendChild(document.createTextNode('❌ エラー: ' + msg));
        if (lc) {
          var loc = ctx.el('span', { class: 'loc' }, '（' + lc.line + '行目 ' + lc.col + '列目）');
          status.appendChild(loc);
        }
        if (allowSound && lastValid === true) ctx.sound.play('error');
        lastValid = false;
      }
      return res;
    }

    function stat(value, label, color) {
      return ctx.el('div', { class: 'json-stat', style: { '--accent': color } },
        ctx.el('b', null, String(value)), ctx.el('span', null, label));
    }

    /* Pretty-print or minify the current input into the output area. */
    function format(minify) {
      var res = validate(true);
      if (res.ok !== true) {
        if (res.ok === null) { ctx.toast('入力が空っぽなのだ'); }
        else { ctx.toast('JSON が無効なのだ'); }
        return;
      }
      var value = sortOn ? sortKeys(res.value) : res.value;
      var text = minify ? JSON.stringify(value) : JSON.stringify(value, null, indent);
      setOutput(text, null);
      ctx.sound.play(minify ? 'whoosh' : 'success');
    }

    /* Re-render output to reflect indent/sort change, only if we already have valid output. */
    function render(reformat) {
      if (!reformat) return;
      var hadOutput = !!(out.dataset.raw);
      if (!hadOutput) return;
      var res = parseInput();
      if (res.ok !== true) return;
      // Detect whether current output was minified (no newlines) to preserve mode.
      var wasMinified = out.dataset.raw.indexOf('\n') === -1;
      var value = sortOn ? sortKeys(res.value) : res.value;
      var text = wasMinified ? JSON.stringify(value) : JSON.stringify(value, null, indent);
      setOutput(text, null);
    }

    /* Debounced live validation on input. */
    function onInput() {
      saved.set(ta.value);
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        debounceTimer = null;
        validate(true);
      }, 220);
    }
    ta.addEventListener('input', onInput);

    // initial state
    validate(false);
    // Auto-focus after the open transition — but not on touch devices, where it
    // would pop the on-screen keyboard and can trigger zoom on mount.
    if (!ctx.isTouch) {
      focusTimer = setTimeout(function () { focusTimer = null; ta.focus(); }, 350);
    }

    mount._cleanup = function () {
      if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
      if (focusTimer) { clearTimeout(focusTimer); focusTimer = null; }
      ta.removeEventListener('input', onInput);
    };
  }

  Arcade.register({
    id: 'json',
    category: 'tool',
    title: 'JSON整形・検証',
    subtitle: 'Pretty / Minify / Validate',
    icon: '📋',
    color: '#36a9ff',
    order: 10,
    mount: mount,
    unmount: function () { if (mount._cleanup) mount._cleanup(); }
  });
})();
