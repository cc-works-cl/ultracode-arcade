/* ============================================================
   TOOL — パスワード / UUID 生成
   Secure password & UUIDv4 generator (crypto, rejection sampling).
   See CONTRACT.md. Mirrors js/tools/counter.js.
   ============================================================ */
(function () {
  'use strict';

  var CSS = [
    '.pw-pane{padding:16px;gap:16px;display:flex;flex-direction:column;max-width:760px;margin:0 auto;width:100%}',
    '.pw-pane .btn{min-height:44px;display:inline-flex;align-items:center;justify-content:center}', // contract: tap targets >=44px
    '.pw-pane select.field{min-height:44px}',
    '.pw-subtabs{display:flex;gap:8px;background:var(--surface-2);padding:6px;border-radius:var(--r-pill);box-shadow:var(--shadow-sm)}',
    '.pw-subtab{flex:1;min-height:44px;border:none;border-radius:var(--r-pill);background:transparent;color:var(--muted);font-weight:800;font-size:15px;cursor:pointer;transition:transform .12s var(--spring),color .15s,background .15s,box-shadow .15s}',
    '.pw-subtab.active{background:var(--surface);color:var(--text);box-shadow:var(--shadow-sm)}',
    '.pw-subtab:active{transform:scale(.95)}',
    '.pw-section{display:none;flex-direction:column;gap:16px}',
    '.pw-section.active{display:flex;animation:pwIn .28s var(--spring)}',
    '@keyframes pwIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}',
    '.pw-card{background:var(--surface);border-radius:var(--r-card);box-shadow:var(--shadow-sm);padding:16px;display:flex;flex-direction:column;gap:14px}',
    '.pw-out{background:var(--surface-2);border-radius:var(--r-btn);padding:16px 18px;font-size:clamp(18px,4.6vw,26px);font-weight:700;line-height:1.5;word-break:break-all;min-height:64px;display:flex;align-items:center;border:2px dashed var(--line);user-select:all}',
    '.pw-out.pw-empty{color:var(--muted);font-weight:600;font-size:15px}',
    '.pw-slider-row{display:flex;flex-direction:column;gap:10px}',
    '.pw-slider-head{display:flex;justify-content:space-between;align-items:baseline;font-weight:800;font-size:14px}',
    '.pw-len{font-size:26px;font-weight:900;color:var(--green);line-height:1}',
    '.pw-range{-webkit-appearance:none;appearance:none;width:100%;height:44px;background:transparent;outline:none;margin:0;cursor:pointer;touch-action:pan-y}',
    '.pw-range::-webkit-slider-runnable-track{height:14px;border-radius:999px;background:var(--surface-2)}',
    '.pw-range::-moz-range-track{height:14px;border-radius:999px;background:var(--surface-2)}',
    '.pw-range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:30px;height:30px;margin-top:-8px;border-radius:50%;background:linear-gradient(135deg,var(--green),var(--teal));box-shadow:var(--shadow-sm);cursor:pointer;border:3px solid #fff}',
    '.pw-range::-moz-range-thumb{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--green),var(--teal));box-shadow:var(--shadow-sm);cursor:pointer;border:3px solid #fff}',
    '.pw-toggles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}',
    '.pw-toggle{display:flex;align-items:center;gap:10px;min-height:44px;padding:8px 12px;background:var(--surface-2);border:2px solid transparent;border-radius:var(--r-btn);font-weight:700;font-size:14px;cursor:pointer;user-select:none;transition:transform .12s var(--spring),border-color .15s,background .15s}',
    '.pw-toggle:active{transform:scale(.96)}',
    '.pw-toggle.on{border-color:var(--green);background:#eafff2}',
    '.pw-toggle.pw-locked{opacity:.6;cursor:not-allowed}',
    '.pw-switch{flex:0 0 auto;width:42px;height:26px;border-radius:999px;background:var(--line);position:relative;transition:background .18s}',
    '.pw-toggle.on .pw-switch{background:var(--green)}',
    '.pw-switch::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:var(--shadow-sm);transition:transform .18s var(--spring)}',
    '.pw-toggle.on .pw-switch::after{transform:translateX(16px)}',
    '.pw-toggle span{flex:1}',
    '.pw-meter{display:flex;flex-direction:column;gap:6px}',
    '.pw-meter-head{display:flex;justify-content:space-between;font-weight:800;font-size:13px}',
    '.pw-meter-label{transition:color .2s}',
    '.pw-track{height:14px;border-radius:999px;background:var(--surface-2);overflow:hidden}',
    '.pw-fill{height:100%;width:0;border-radius:999px;transition:width .3s var(--spring),background .3s}',
    '.pw-bits{color:var(--muted);font-weight:700}',
    '.pw-count{display:flex;gap:8px}',
    '.pw-count button{flex:1;min-height:44px;border:2px solid transparent;border-radius:var(--r-btn);background:var(--surface-2);color:var(--muted);font-weight:800;font-size:15px;cursor:pointer;transition:transform .12s var(--spring),border-color .15s,background .15s,color .15s}',
    '.pw-count button:active{transform:scale(.94)}',
    '.pw-count button.active{border-color:var(--green);background:#eafff2;color:var(--text)}',
    '.pw-list{display:flex;flex-direction:column;gap:8px}',
    '.pw-item{display:flex;align-items:center;gap:10px;background:var(--surface-2);border-radius:var(--r-btn);padding:10px 12px}',
    '.pw-item code{flex:1;word-break:break-all;font-size:clamp(13px,3.4vw,16px);font-weight:600}',
    '.pw-item .pw-copy{flex:0 0 auto;min-width:44px;min-height:44px;border:none;border-radius:12px;background:var(--surface);box-shadow:var(--shadow-sm);font-size:18px;cursor:pointer;transition:transform .12s var(--spring)}',
    '.pw-item .pw-copy:active{transform:scale(.88)}',
    '.pw-hint{color:var(--muted);font-size:13px;font-weight:700}'
  ].join('');

  /* charsets */
  var SETS = {
    upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lower: 'abcdefghijklmnopqrstuvwxyz',
    digit: '0123456789',
    symbol: '!@#$%^&*()-_=+[]{};:,.<>?/'
  };
  // ambiguous glyphs that are easy to confuse in a monospace font
  var AMBIG = 'Il1O0o5S2ZB8`\'";:.,|{}[]()';

  function getRandomBytes(n) {
    var arr = new Uint8Array(n);
    (window.crypto || window.msCrypto).getRandomValues(arr);
    return arr;
  }

  // Unbiased index in [0,n) via single-byte rejection sampling (n<=256).
  function randIndex(n) {
    if (n <= 0) return 0;
    if (n > 256) { // not used here, but stay correct
      var lim2 = Math.floor(65536 / n) * n;
      while (true) {
        var b = getRandomBytes(2);
        var v = (b[0] << 8) | b[1];
        if (v < lim2) return v % n;
      }
    }
    var threshold = 256 - (256 % n); // reject bytes >= threshold => no modulo bias
    while (true) {
      var byte = getRandomBytes(1)[0];
      if (byte < threshold) return byte % n;
    }
  }

  function pick(charset) { return charset.charAt(randIndex(charset.length)); }

  // Fisher–Yates using crypto rejection sampling (keeps the shuffle unbiased).
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = randIndex(i + 1);
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function buildPool(opts) {
    var active = [];
    var pool = '';
    Object.keys(SETS).forEach(function (k) {
      if (!opts[k]) return;
      var chars = SETS[k];
      if (opts.exclude) {
        chars = chars.split('').filter(function (c) { return AMBIG.indexOf(c) === -1; }).join('');
      }
      if (chars.length) { active.push(chars); pool += chars; }
    });
    return { active: active, pool: pool };
  }

  function generatePassword(length, opts) {
    var b = buildPool(opts);
    if (!b.pool) return '';
    var chars = [];
    // guarantee at least one char from each active set (if length allows)
    var mandatory = b.active.slice();
    if (mandatory.length > length) mandatory = mandatory.slice(0, length); // length>=4 always fits 4 sets
    mandatory.forEach(function (set) { chars.push(pick(set)); });
    while (chars.length < length) chars.push(pick(b.pool));
    return shuffle(chars).join('');
  }

  function entropyBits(length, poolSize) {
    if (poolSize <= 1 || length <= 0) return 0;
    return length * (Math.log(poolSize) / Math.LN2);
  }

  // returns { label, color, pct }
  function strength(bits) {
    var label, color;
    if (bits < 40) { label = '弱い'; color = 'var(--red)'; }
    else if (bits < 70) { label = '普通'; color = 'var(--orange)'; }
    else if (bits < 110) { label = '強い'; color = 'var(--lime)'; }
    else { label = '非常に強い'; color = 'var(--green)'; }
    var pct = Math.max(4, Math.min(100, Math.round(bits / 128 * 100)));
    return { label: label, color: color, pct: pct };
  }

  /* ---- UUID v4 ---- */
  var HEX = '0123456789abcdef';
  function uuidV4() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      try { return window.crypto.randomUUID(); } catch (e) {}
    }
    var b = getRandomBytes(16);
    b[6] = (b[6] & 0x0f) | 0x40; // version 4
    b[8] = (b[8] & 0x3f) | 0x80; // variant 10xx (RFC 4122)
    var hex = '';
    for (var i = 0; i < 16; i++) hex += HEX.charAt(b[i] >> 4) + HEX.charAt(b[i] & 0x0f);
    return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' +
           hex.slice(16, 20) + '-' + hex.slice(20, 32);
  }

  function fallbackCopy(text, ctx) {
    var ta = document.createElement('textarea');
    try {
      ta.value = text; ta.style.position = 'fixed'; ta.style.top = '-9999px'; ta.style.opacity = '0';
      ta.setAttribute('readonly', '');
      document.body.appendChild(ta); ta.focus(); ta.select();
      var ok = document.execCommand('copy');
      if (ok) { ctx.toast('コピーしたのだ'); ctx.sound.play('coin'); }
      else { ctx.toast('コピーできなかったのだ'); ctx.sound.play('error'); }
    } catch (e) {
      ctx.toast('コピーできなかったのだ'); ctx.sound.play('error');
    } finally {
      if (ta.parentNode) ta.parentNode.removeChild(ta); // never leak the temp node
    }
  }

  function copyText(text, ctx) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        navigator.clipboard.writeText(text).then(function () {
          ctx.toast('コピーしたのだ'); ctx.sound.play('coin');
        }, function () { fallbackCopy(text, ctx); }); // permission/insecure-context => fall back
      } catch (e) { fallbackCopy(text, ctx); }
    } else {
      fallbackCopy(text, ctx);
    }
  }

  function mount(root, ctx) {
    ctx.injectCSS('tool-password', CSS);

    var store = ctx.storage('password-opts');
    var defaults = { tab: 'pw', length: 16, upper: true, lower: true, digit: true, symbol: false, exclude: false, batch: 1, uuidCount: 1 };
    var saved = store.get({});
    var opts = {};
    Object.keys(defaults).forEach(function (k) { opts[k] = (saved && saved[k] != null) ? saved[k] : defaults[k]; });
    opts.length = Math.max(4, Math.min(64, opts.length | 0));

    function persist() { store.set(opts); }

    /* ===================== PASSWORD SECTION ===================== */
    var pwOut = ctx.el('div', { class: 'pw-out pw-empty mono' }, '「生成」を押すのだ');

    var lenVal = ctx.el('b', { class: 'pw-len' }, String(opts.length));
    var range = ctx.el('input', {
      class: 'pw-range', type: 'range', min: '4', max: '64', step: '1', value: String(opts.length),
      'aria-label': '文字数'
    });

    var meterLabel = ctx.el('span', { class: 'pw-meter-label' }, '—');
    var meterBits = ctx.el('span', { class: 'pw-bits' }, '0 bit');
    var meterFill = ctx.el('div', { class: 'pw-fill' });

    var TOGGLE_DEFS = [
      { key: 'upper', label: '大文字 A-Z' },
      { key: 'lower', label: '小文字 a-z' },
      { key: 'digit', label: '数字 0-9' },
      { key: 'symbol', label: '記号 !@#' },
      { key: 'exclude', label: '紛らわしい文字を除外' }
    ];
    var toggleEls = {};
    var togglesWrap = ctx.el('div', { class: 'pw-toggles' });

    // the four charset keys; "exclude" is a filter, not a set
    var SETKEYS = ['upper', 'lower', 'digit', 'symbol'];
    function enabledSetCount() {
      return SETKEYS.reduce(function (n, k) { return n + (opts[k] ? 1 : 0); }, 0);
    }

    function refreshToggleLocks() {
      // prevent disabling the last remaining charset (avoids empty pool)
      var only = enabledSetCount() === 1;
      SETKEYS.forEach(function (k) {
        var locked = only && opts[k];
        toggleEls[k].classList.toggle('pw-locked', locked);
        toggleEls[k].setAttribute('aria-disabled', locked ? 'true' : 'false');
      });
    }

    TOGGLE_DEFS.forEach(function (def) {
      var t = ctx.el('div', {
        class: 'pw-toggle' + (opts[def.key] ? ' on' : ''),
        role: 'switch', tabindex: '0', 'aria-checked': opts[def.key] ? 'true' : 'false',
        onClick: function () { flip(def.key); },
        onKeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(def.key); } }
      }, ctx.el('span', null, def.label), ctx.el('div', { class: 'pw-switch' }));
      toggleEls[def.key] = t;
      togglesWrap.appendChild(t);
    });

    function flip(key) {
      // block turning off the last enabled charset
      if (SETKEYS.indexOf(key) !== -1 && opts[key] && enabledSetCount() === 1) {
        ctx.toast('最低1種類は必要なのだ'); ctx.sound.play('error');
        return;
      }
      opts[key] = !opts[key];
      var t = toggleEls[key];
      t.classList.toggle('on', opts[key]);
      t.setAttribute('aria-checked', opts[key] ? 'true' : 'false');
      refreshToggleLocks();
      persist();
      ctx.sound.play('toggle'); ctx.haptic(8);
      updateMeter();
    }

    function poolSizeNow() { return buildPool(opts).pool.length; }

    function updateMeter() {
      var ps = poolSizeNow();
      var bits = entropyBits(opts.length, ps);
      var s = strength(bits);
      meterLabel.textContent = s.label;
      meterLabel.style.color = s.color;
      meterBits.textContent = Math.round(bits) + ' bit';
      meterFill.style.width = s.pct + '%';
      meterFill.style.background = s.color;
    }

    var pwList = ctx.el('div', { class: 'pw-list' });

    function doGenerate(silent) {
      var ps = poolSizeNow();
      if (ps === 0) {
        if (!silent) { ctx.toast('文字種を選ぶのだ'); ctx.sound.play('error'); }
        return;
      }
      var n = Math.max(1, Math.min(50, opts.batch | 0));
      pwList.innerHTML = '';
      if (n === 1) {
        var pw = generatePassword(opts.length, opts);
        pwOut.classList.remove('pw-empty');
        pwOut.textContent = pw; // textContent => safe even with < > & " ' symbols
      } else {
        // show the first one big (keeps the top コピー button meaningful), list the rest
        var first = null;
        for (var i = 0; i < n; i++) {
          (function () {
            var pw = generatePassword(opts.length, opts);
            if (first === null) first = pw;
            var code = ctx.el('code', { class: 'mono', text: pw });
            var btn = ctx.el('button', {
              class: 'pw-copy squish', 'aria-label': 'コピー',
              onClick: function () { copyText(pw, ctx); }
            }, '📋');
            pwList.appendChild(ctx.el('div', { class: 'pw-item' }, code, btn));
          })();
        }
        pwOut.classList.remove('pw-empty');
        pwOut.textContent = first; // textContent => safe
      }
      if (!silent) { ctx.sound.play('success'); ctx.haptic(12); }
    }

    var batchSelect = ctx.el('select', { class: 'field', 'aria-label': '生成数', style: { flex: '0 0 auto', minHeight: '44px', maxWidth: '140px' } });
    [1, 5, 10, 20].forEach(function (v) {
      batchSelect.appendChild(ctx.el('option', { value: String(v) }, v === 1 ? '1個' : v + '個まとめて'));
    });
    batchSelect.value = String([1, 5, 10, 20].indexOf(opts.batch) !== -1 ? opts.batch : 1);
    opts.batch = parseInt(batchSelect.value, 10);
    batchSelect.addEventListener('change', function () {
      opts.batch = parseInt(batchSelect.value, 10) || 1; persist(); ctx.sound.play('tick');
    });

    range.addEventListener('input', function () {
      opts.length = parseInt(range.value, 10) || 4;
      lenVal.textContent = String(opts.length);
      updateMeter();
      ctx.sound.play('tick');
    });
    range.addEventListener('change', persist);

    var copyBtn = ctx.el('button', {
      class: 'btn btn-green squish', onClick: function () {
        if (pwOut.classList.contains('pw-empty')) { ctx.toast('先に生成するのだ'); ctx.sound.play('error'); return; }
        copyText(pwOut.textContent, ctx);
      }
    }, 'コピー');

    var pwSection = ctx.el('div', { class: 'pw-section' + (opts.tab === 'pw' ? ' active' : '') },
      pwOut,
      ctx.el('div', { class: 'pw-card' },
        ctx.el('div', { class: 'pw-slider-row' },
          ctx.el('div', { class: 'pw-slider-head' }, ctx.el('span', null, '文字数'), lenVal),
          range
        ),
        togglesWrap,
        ctx.el('div', { class: 'pw-meter' },
          ctx.el('div', { class: 'pw-meter-head' }, meterLabel, meterBits),
          ctx.el('div', { class: 'pw-track' }, meterFill)
        )
      ),
      ctx.el('div', { class: 'row' },
        ctx.el('button', { class: 'btn btn-primary squish', style: { flex: '1 1 auto' }, onClick: function () { doGenerate(); } }, '生成'),
        batchSelect,
        copyBtn
      ),
      pwList
    );

    /* ===================== UUID SECTION ===================== */
    var uuidList = ctx.el('div', { class: 'pw-list' });
    var uuidCountWrap = ctx.el('div', { class: 'pw-count' });
    var uuidBtns = {};
    [1, 5, 10].forEach(function (v) {
      var b = ctx.el('button', {
        class: opts.uuidCount === v ? 'active' : '', onClick: function () { setUuidCount(v); }
      }, v + '個');
      uuidBtns[v] = b;
      uuidCountWrap.appendChild(b);
    });
    if (!uuidBtns[opts.uuidCount]) { opts.uuidCount = 1; uuidBtns[1].classList.add('active'); }

    function setUuidCount(v) {
      opts.uuidCount = v;
      [1, 5, 10].forEach(function (k) { uuidBtns[k].classList.toggle('active', k === v); });
      persist(); ctx.sound.play('toggle'); ctx.haptic(8);
      doUuid();
    }

    var lastUuids = [];
    function doUuid() {
      uuidList.innerHTML = '';
      lastUuids = [];
      var n = opts.uuidCount;
      for (var i = 0; i < n; i++) {
        (function () {
          var id = uuidV4();
          lastUuids.push(id);
          var code = ctx.el('code', { class: 'mono', text: id });
          var btn = ctx.el('button', {
            class: 'pw-copy squish', 'aria-label': 'コピー',
            onClick: function () { copyText(id, ctx); }
          }, '📋');
          uuidList.appendChild(ctx.el('div', { class: 'pw-item' }, code, btn));
        })();
      }
      ctx.sound.play('success'); ctx.haptic(12);
    }

    var uuidSection = ctx.el('div', { class: 'pw-section' + (opts.tab === 'uuid' ? ' active' : '') },
      ctx.el('div', { class: 'pw-card' },
        ctx.el('div', { class: 'pw-hint' }, '生成する個数を選ぶのだ（UUID v4）'),
        uuidCountWrap
      ),
      ctx.el('div', { class: 'row' },
        ctx.el('button', { class: 'btn btn-primary squish', style: { flex: '1 1 auto' }, onClick: doUuid }, '生成'),
        ctx.el('button', { class: 'btn btn-green squish', onClick: function () {
          if (!lastUuids.length) { ctx.toast('先に生成するのだ'); ctx.sound.play('error'); return; }
          copyText(lastUuids.join('\n'), ctx);
        } }, 'コピー全部')
      ),
      uuidList
    );

    /* ===================== SUB-TABS ===================== */
    var subBtns = {};
    function selectTab(tab) {
      if (opts.tab !== tab) { ctx.sound.play('tab'); ctx.haptic(8); }
      opts.tab = tab; persist();
      subBtns.pw.classList.toggle('active', tab === 'pw');
      subBtns.uuid.classList.toggle('active', tab === 'uuid');
      pwSection.classList.toggle('active', tab === 'pw');
      uuidSection.classList.toggle('active', tab === 'uuid');
    }
    subBtns.pw = ctx.el('button', { class: 'pw-subtab' + (opts.tab === 'pw' ? ' active' : ''), onClick: function () { selectTab('pw'); } }, '🔑 パスワード');
    subBtns.uuid = ctx.el('button', { class: 'pw-subtab' + (opts.tab === 'uuid' ? ' active' : ''), onClick: function () { selectTab('uuid'); } }, '🆔 UUID');
    var subtabs = ctx.el('div', { class: 'pw-subtabs', role: 'tablist' }, subBtns.pw, subBtns.uuid);

    root.appendChild(ctx.el('div', { class: 'pw-pane' }, subtabs, pwSection, uuidSection));

    /* initial paint */
    refreshToggleLocks();
    updateMeter();
    doGenerate(true);

    mount._cleanup = function () {
      // No RAF / interval / timeout / audio nodes / streams / observers / window listeners
      // were started by this module; all listeners are element-scoped and are released
      // when core.js clears .screen-content. Nothing persistent to stop.
    };
  }

  Arcade.register({
    id: 'password',
    category: 'tool',
    title: 'パスワード/UUID',
    subtitle: '安全に生成',
    icon: '🔑',
    color: '#2fcf72',
    order: 50,
    mount: mount,
    unmount: function () { if (mount._cleanup) mount._cleanup(); }
  });
})();
