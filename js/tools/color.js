/* ============================================================
   TOOL — カラーピッカー＆パレット
   Picker + HEX/RGB/HSL sync, harmonies, favorites, contrast.
   Mirrors js/tools/counter.js. See CONTRACT.md.
   ============================================================ */
(function () {
  'use strict';

  var CSS = [
    '.color-pane{padding:16px;gap:16px;display:flex;flex-direction:column;max-width:920px;margin:0 auto;width:100%}',
    '.color-top{display:grid;grid-template-columns:minmax(0,1fr);gap:16px}',
    '@media(min-width:680px){.color-top{grid-template-columns:1.1fr 1fr}}',
    '.color-preview{position:relative;border-radius:20px;min-height:180px;box-shadow:var(--shadow);display:flex;flex-direction:column;justify-content:flex-end;padding:16px;overflow:hidden;border:1px solid rgba(0,0,0,.06)}',
    '.color-preview .color-phex{font-weight:800;font-size:26px;letter-spacing:.5px}',
    '.color-preview .color-psub{font-weight:700;font-size:13px;opacity:.9}',
    '.color-swatchbig{display:flex;flex-direction:column;align-items:center;gap:12px;justify-content:center;background:var(--surface);border-radius:20px;padding:16px;box-shadow:var(--shadow-sm)}',
    '.color-native{width:100%;max-width:240px;height:120px;min-height:88px;border:none;border-radius:18px;padding:0;background:none;cursor:pointer;box-shadow:var(--shadow-sm),inset 0 0 0 4px #fff}',
    '.color-native::-webkit-color-swatch-wrapper{padding:0}',
    '.color-native::-webkit-color-swatch{border:none;border-radius:18px}',
    '.color-native::-moz-color-swatch{border:none;border-radius:18px}',
    '.color-fields{display:grid;grid-template-columns:1fr;gap:10px}',
    '.color-frow{display:grid;grid-template-columns:54px 1fr auto;align-items:center;gap:10px}',
    '.color-frow>label{font-weight:800;font-size:13px;color:var(--muted)}',
    '.color-frow input.field{min-height:44px}',
    '.color-frow .color-copy{min-width:44px;min-height:44px}',
    '.color-actions{display:flex;flex-wrap:wrap;gap:10px}',
    '.color-actions .btn{min-height:44px}',
    '.color-section{background:var(--surface);border-radius:18px;padding:14px;box-shadow:var(--shadow-sm);display:flex;flex-direction:column;gap:12px}',
    '.color-section h3{margin:0;font-size:15px;font-weight:800}',
    '.color-harm{display:flex;flex-direction:column;gap:10px}',
    '.color-harmrow{display:flex;flex-direction:column;gap:5px}',
    '.color-harmrow>.color-hl{font-size:12px;font-weight:800;color:var(--muted)}',
    '.color-row{display:flex;gap:8px;flex-wrap:wrap}',
    '.color-chip{flex:1 1 56px;min-width:56px;min-height:54px;border:none;border-radius:14px;cursor:pointer;position:relative;box-shadow:var(--shadow-sm);transition:transform .12s var(--spring);display:flex;align-items:flex-end;justify-content:center;padding:5px;overflow:hidden}',
    '.color-chip:active{transform:scale(.92)}',
    '.color-chip .color-clbl{font-size:10px;font-weight:800;background:rgba(255,255,255,.82);color:#232838;border-radius:7px;padding:2px 5px;line-height:1.2;pointer-events:none}',
    '.color-faves{display:flex;gap:8px;flex-wrap:wrap}',
    /* wrapper is larger than the swatch so the 44px delete hit-box stays fully */
    /* inside the wrapper (no negative offsets that would bleed onto neighbours) */
    /* and overlaps only the extreme top-right corner of the swatch (~12px),   */
    /* leaving the rest of the swatch face usable for the load tap.            */
    '.color-favewrap{position:relative;width:84px;height:84px}',
    '.color-fave{position:absolute;left:0;bottom:0;display:block;width:52px;height:52px;border:none;border-radius:14px;cursor:pointer;box-shadow:var(--shadow-sm),inset 0 0 0 3px #fff;transition:transform .12s var(--spring)}',
    '.color-fave:active{transform:scale(.9)}',
    '.color-del{position:absolute;top:0;right:0;width:44px;height:44px;border-radius:999px;border:none;background:none;color:#fff;font-size:13px;font-weight:800;line-height:1;cursor:pointer;display:flex;align-items:flex-start;justify-content:flex-end;padding:3px}',
    '.color-del>span{width:22px;height:22px;border-radius:999px;background:var(--red);box-shadow:var(--shadow-sm);display:flex;align-items:center;justify-content:center}',
    '.color-empty{color:var(--muted);font-size:13px;font-weight:700;padding:6px 2px}',
    '.color-contrast{display:flex;flex-direction:column;gap:12px}',
    '.color-cprev{display:grid;grid-template-columns:1fr;gap:10px}',
    '@media(min-width:520px){.color-cprev{grid-template-columns:1fr 1fr}}',
    '.color-cbox{border-radius:14px;padding:14px;min-height:72px;display:flex;flex-direction:column;justify-content:center;gap:4px;box-shadow:var(--shadow-sm)}',
    '.color-cbox .color-csample{font-weight:800;font-size:17px}',
    '.color-cpick{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
    '.color-cpick input[type=color]{width:48px;height:44px;border:none;border-radius:12px;padding:0;background:none;cursor:pointer;box-shadow:var(--shadow-sm)}',
    '.color-ratio{font-size:22px;font-weight:800;text-align:center}',
    '.color-badges{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}',
    '.color-badge{font-size:12px;font-weight:800;padding:5px 12px;border-radius:999px}',
    '.color-badge.pass{background:rgba(47,207,114,.18);color:#1c8a4a}',
    '.color-badge.fail{background:rgba(255,77,87,.16);color:#c02b34}'
  ].join('');

  /* ---------------- color math (single source of truth = {r,g,b} 0-255) -------- */
  function clamp(n, lo, hi) { return n < lo ? lo : (n > hi ? hi : n); }
  function wrapHue(h) { return ((h % 360) + 360) % 360; }
  function toHex2(n) { var s = clamp(Math.round(n), 0, 255).toString(16); return s.length < 2 ? '0' + s : s; }

  function rgbToHex(rgb) { return '#' + toHex2(rgb.r) + toHex2(rgb.g) + toHex2(rgb.b); }

  // Parse a hex string (#fff / #ffffff, with or without #). Returns {r,g,b} or null.
  function parseHex(str) {
    if (str == null) return null;
    var s = String(str).trim().replace(/^#/, '');
    if (/^[0-9a-fA-F]{3}$/.test(s)) {
      return { r: parseInt(s[0] + s[0], 16), g: parseInt(s[1] + s[1], 16), b: parseInt(s[2] + s[2], 16) };
    }
    if (/^[0-9a-fA-F]{6}$/.test(s)) {
      return { r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16) };
    }
    return null;
  }

  // Parse "r,g,b" or "rgb(r,g,b)" → {r,g,b} or null.
  function parseRgb(str) {
    if (str == null) return null;
    var m = String(str).match(/-?\d+(?:\.\d+)?/g);
    if (!m || m.length < 3) return null;
    var r = +m[0], g = +m[1], b = +m[2];
    if (![r, g, b].every(function (n) { return isFinite(n) && n >= 0 && n <= 255; })) return null;
    return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
  }

  // Parse "h,s,l" or "hsl(h,s%,l%)" → {r,g,b} or null.
  function parseHsl(str) {
    if (str == null) return null;
    var m = String(str).match(/-?\d+(?:\.\d+)?/g);
    if (!m || m.length < 3) return null;
    var h = +m[0], s = +m[1], l = +m[2];
    if (![h, s, l].every(isFinite)) return null;
    if (s < 0 || s > 100 || l < 0 || l > 100) return null;
    return hslToRgb(wrapHue(h), s, l);
  }

  function rgbToHsl(rgb) {
    var r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h = 0, s = 0, l = (max + min) / 2;
    var d = max - min;
    if (d !== 0) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h: Math.round(wrapHue(h)), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  function hslToRgb(h, s, l) {
    h = wrapHue(h) / 360; s = clamp(s, 0, 100) / 100; l = clamp(l, 0, 100) / 100;
    function hue2(p, q, t) {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }
    var r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      var p = 2 * l - q;
      r = hue2(p, q, h + 1 / 3); g = hue2(p, q, h); b = hue2(p, q, h - 1 / 3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
  }

  function rgbStr(rgb) { return rgb.r + ', ' + rgb.g + ', ' + rgb.b; }
  function hslStr(rgb) { var h = rgbToHsl(rgb); return h.h + ', ' + h.s + '%, ' + h.l + '%'; }

  // Relative luminance (WCAG) from {r,g,b}.
  function luminance(rgb) {
    function lin(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
  }
  function contrastRatio(a, b) {
    var la = luminance(a), lb = luminance(b);
    var hi = Math.max(la, lb), lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  }
  // Good readable text color (black/white) for a given background.
  function textOn(rgb) { return luminance(rgb) > 0.45 ? '#232838' : '#ffffff'; }

  function randomRgb() {
    return { r: Math.floor(Math.random() * 256), g: Math.floor(Math.random() * 256), b: Math.floor(Math.random() * 256) };
  }

  function mount(root, ctx) {
    ctx.injectCSS('tool-color', CSS);
    var el = ctx.el;
    var faveStore = ctx.storage('color-faves');

    // ---- single source of truth ----
    var rgb = { r: 255, g: 111, b: 174 }; // start on the tile accent (#ff6fae)

    // ---------- preview + native swatch ----------
    var preview = el('div', { class: 'color-preview' });
    var pHex = el('div', { class: 'color-phex' });
    var pSub = el('div', { class: 'color-psub' });
    preview.append(pHex, pSub);

    var native = el('input', {
      type: 'color', class: 'color-native', value: rgbToHex(rgb), 'aria-label': '色を選ぶ',
      onInput: function () { var p = parseHex(native.value); if (p) setColor(p, native); }
    });

    var swatchBig = el('div', { class: 'color-swatchbig' },
      native,
      el('div', { class: 'muted', style: { fontSize: '12px', fontWeight: '700' } }, 'タップで色を選択')
    );

    // ---------- text fields ----------
    function makeField(labelTxt, copyFn) {
      var input = el('input', { class: 'field mono', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off' });
      var copy = el('button', { class: 'btn btn-ghost squish color-copy', 'aria-label': 'コピー', onClick: function () { copyText(copyFn(), labelTxt); } }, '⧉');
      var row = el('div', { class: 'color-frow' }, el('label', null, labelTxt), input, copy);
      return { row: row, input: input };
    }

    var fHex = makeField('HEX', function () { return rgbToHex(rgb); });
    var fRgb = makeField('RGB', function () { return 'rgb(' + rgbStr(rgb) + ')'; });
    var fHsl = makeField('HSL', function () { return 'hsl(' + hslStr(rgb) + ')'; });

    // commit-on-input but never rewrite the field the user is typing in
    fHex.input.addEventListener('input', function () { var p = parseHex(fHex.input.value); if (p) setColor(p, fHex.input); });
    fRgb.input.addEventListener('input', function () { var p = parseRgb(fRgb.input.value); if (p) setColor(p, fRgb.input); });
    fHsl.input.addEventListener('input', function () { var p = parseHsl(fHsl.input.value); if (p) setColor(p, fHsl.input); });

    var fields = el('div', { class: 'color-fields' }, fHex.row, fRgb.row, fHsl.row);

    // ---------- action buttons ----------
    var actions = el('div', { class: 'color-actions' });
    actions.appendChild(el('button', { class: 'btn btn-accent squish', onClick: function () { setColor(randomRgb()); ctx.sound.play('pop'); ctx.haptic(8); } }, '🎲 ランダム色'));
    actions.appendChild(el('button', { class: 'btn btn-green squish', onClick: function () { addFave(); } }, '⭐ お気に入りに追加'));
    if (window.EyeDropper) {
      actions.appendChild(el('button', {
        class: 'btn btn-primary squish', onClick: function () {
          try {
            var ed = new window.EyeDropper();
            ed.open().then(function (res) {
              var p = parseHex(res && res.sRGBHex);
              if (p) { setColor(p); ctx.sound.play('coin'); ctx.toast('色を吸い取ったのだ'); }
            }).catch(function () { /* user cancelled — not an error */ });
          } catch (e) { /* ignore */ }
        }
      }, '🔍 スポイト'));
    }

    var topGrid = el('div', { class: 'color-top' },
      el('div', { class: 'col' }, preview, fields, actions),
      swatchBig
    );

    // ---------- harmonies ----------
    var harmWrap = el('div', { class: 'color-harm' });
    var harmSection = el('div', { class: 'color-section' }, el('h3', null, '🎨 調和色 — タップでコピー'), harmWrap);

    function chip(targetRgb, label) {
      var hex = rgbToHex(targetRgb);
      var c = el('button', {
        class: 'color-chip', style: { background: hex },
        'aria-label': label + ' ' + hex,
        onClick: function () { setColor(parseHex(hex)); copyText(hex, '調和色'); }
      });
      if (label) c.appendChild(el('span', { class: 'color-clbl' }, label));
      return c;
    }

    function harmRow(label, list) {
      var row = el('div', { class: 'color-row' });
      list.forEach(function (item) { row.appendChild(chip(item.rgb, item.tag)); });
      return el('div', { class: 'color-harmrow' }, el('span', { class: 'color-hl' }, label), row);
    }

    function rotate(deg) { var h = rgbToHsl(rgb); return hslToRgb(h.h + deg, h.s, h.l); }

    function buildHarmonies() {
      harmWrap.innerHTML = '';
      var h = rgbToHsl(rgb);

      harmWrap.appendChild(harmRow('補色 (Complementary)', [
        { rgb: rgb, tag: 'base' }, { rgb: rotate(180), tag: '+180°' }
      ]));
      harmWrap.appendChild(harmRow('類似色 (Analogous ±30°)', [
        { rgb: rotate(-30), tag: '-30°' }, { rgb: rgb, tag: 'base' }, { rgb: rotate(30), tag: '+30°' }
      ]));
      harmWrap.appendChild(harmRow('トライアド (Triadic)', [
        { rgb: rgb, tag: 'base' }, { rgb: rotate(120), tag: '+120°' }, { rgb: rotate(240), tag: '+240°' }
      ]));
      harmWrap.appendChild(harmRow('色相5分割 (Pentadic)', [0, 72, 144, 216, 288].map(function (d) {
        return { rgb: hslToRgb(h.h + d, h.s, h.l), tag: d + '°' };
      })));
      // tint/shade scale: 5 steps lighter → darker around current lightness
      var ls = [Math.min(95, h.l + 30), Math.min(90, h.l + 15), h.l, Math.max(10, h.l - 15), Math.max(5, h.l - 30)];
      var toneTags = ['+30', '+15', 'base', '-15', '-30'];
      harmWrap.appendChild(harmRow('トーン (Tint → Shade)', ls.map(function (lv, i) {
        return { rgb: hslToRgb(h.h, h.s, lv), tag: toneTags[i] };
      })));
    }

    // ---------- favorites ----------
    var favesWrap = el('div', { class: 'color-faves' });
    var faveSection = el('div', { class: 'color-section' }, el('h3', null, '⭐ お気に入り'), favesWrap);

    function loadFaves() {
      var raw = faveStore.get([]);
      if (!Array.isArray(raw)) return [];
      // validate/normalize on load — storage may be hand-tampered (XSS / corruption guard)
      var out = [];
      raw.forEach(function (item) {
        var p = parseHex(item);
        if (p && out.indexOf(rgbToHex(p)) === -1) out.push(rgbToHex(p));
      });
      return out.slice(0, 60);
    }
    function saveFaves(list) { faveStore.set(list); }

    function addFave() {
      var hex = rgbToHex(rgb);
      var list = loadFaves();
      if (list.indexOf(hex) !== -1) { ctx.toast('もう登録済みなのだ'); ctx.sound.play('back'); return; }
      list.unshift(hex);
      saveFaves(list.slice(0, 60));
      renderFaves();
      ctx.sound.play('success'); ctx.haptic(12); ctx.toast(hex + ' を保存したのだ');
    }

    function renderFaves() {
      favesWrap.innerHTML = '';
      var list = loadFaves();
      if (!list.length) { favesWrap.appendChild(el('div', { class: 'color-empty' }, 'まだ無いのだ。「お気に入りに追加」で保存できるのだ。')); return; }
      list.forEach(function (hex) {
        var swatch = el('button', {
          class: 'color-fave', style: { background: hex }, 'aria-label': hex + ' を読み込む',
          onClick: function () { setColor(parseHex(hex)); ctx.sound.play('select'); ctx.toast(hex + ' を読み込んだのだ'); }
        });
        var del = el('button', {
          class: 'color-del', 'aria-label': hex + ' を削除', onClick: function (e) {
            e.stopPropagation();
            var l = loadFaves().filter(function (x) { return x !== hex; });
            saveFaves(l); renderFaves(); ctx.sound.play('back'); ctx.haptic(8);
          }
        }, el('span', null, '×'));
        favesWrap.appendChild(el('div', { class: 'color-favewrap' }, swatch, del));
      });
    }

    // ---------- contrast checker ----------
    var cBgRgb = { r: 255, g: 255, b: 255 };
    var cFgRgb = { r: 35, g: 40, b: 56 };
    var cBgInput = el('input', { type: 'color', value: rgbToHex(cBgRgb), 'aria-label': '背景色', onInput: function () { var p = parseHex(cBgInput.value); if (p) { cBgRgb = p; renderContrast(); } } });
    var cFgInput = el('input', { type: 'color', value: rgbToHex(cFgRgb), 'aria-label': '文字色', onInput: function () { var p = parseHex(cFgInput.value); if (p) { cFgRgb = p; renderContrast(); } } });
    var cUseBg = el('button', { class: 'btn btn-ghost squish', style: { minHeight: '44px' }, onClick: function () { cBgRgb = { r: rgb.r, g: rgb.g, b: rgb.b }; cBgInput.value = rgbToHex(cBgRgb); renderContrast(); ctx.sound.play('toggle'); } }, '現在色→背景');
    var cUseFg = el('button', { class: 'btn btn-ghost squish', style: { minHeight: '44px' }, onClick: function () { cFgRgb = { r: rgb.r, g: rgb.g, b: rgb.b }; cFgInput.value = rgbToHex(cFgRgb); renderContrast(); ctx.sound.play('toggle'); } }, '現在色→文字');

    var cBox = el('div', { class: 'color-cbox' }, el('div', { class: 'color-csample' }, 'あア Aa 漢字 123'), el('div', { style: { fontSize: '13px', fontWeight: '700' } }, 'プレビュー文字'));
    var cRatio = el('div', { class: 'color-ratio' });
    var cBadges = el('div', { class: 'color-badges' });

    function badge(label, pass) { return el('span', { class: 'color-badge ' + (pass ? 'pass' : 'fail') }, label + ' ' + (pass ? '✓' : '✗')); }

    function renderContrast() {
      var ratio = contrastRatio(cBgRgb, cFgRgb);
      cBox.style.background = rgbToHex(cBgRgb);
      cBox.style.color = rgbToHex(cFgRgb);
      cRatio.textContent = '比率 ' + (Math.round(ratio * 100) / 100) + ' : 1';
      cBadges.innerHTML = '';
      cBadges.append(
        badge('AA 通常 4.5', ratio >= 4.5),
        badge('AA 大 3.0', ratio >= 3),
        badge('AAA 通常 7.0', ratio >= 7),
        badge('AAA 大 4.5', ratio >= 4.5)
      );
    }

    var contrastSection = el('div', { class: 'color-section' },
      el('h3', null, '🔬 コントラスト判定 (WCAG)'),
      el('div', { class: 'color-contrast' },
        el('div', { class: 'color-cpick' }, el('span', { class: 'tag' }, '背景'), cBgInput, cUseBg, el('span', { class: 'spacer' }), el('span', { class: 'tag' }, '文字'), cFgInput, cUseFg),
        el('div', { class: 'color-cprev' }, cBox, el('div', { class: 'col', style: { justifyContent: 'center' } }, cRatio, cBadges))
      )
    );

    // ---------- mount layout ----------
    root.appendChild(el('div', { class: 'color-pane' }, topGrid, harmSection, faveSection, contrastSection));

    // ---------- helpers that touch the UI ----------
    function copyText(str, what) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(str).then(function () {
          ctx.toast((what ? what + ' ' : '') + str + ' をコピーしたのだ'); ctx.sound.play('coin'); ctx.haptic(8);
        }, function () { ctx.toast('コピーできなかったのだ'); ctx.sound.play('error'); });
      } else {
        ctx.toast('コピーに未対応なのだ'); ctx.sound.play('error');
      }
    }

    // The ONE render function. `origin` = the input the user is editing (left untouched).
    function setColor(next, origin) {
      if (!next) return;
      rgb = { r: clamp(Math.round(next.r), 0, 255), g: clamp(Math.round(next.g), 0, 255), b: clamp(Math.round(next.b), 0, 255) };
      var hex = rgbToHex(rgb); // always 6-digit lowercase — safe for <input type=color>

      // native swatch must receive exactly #rrggbb
      if (origin !== native && native.value !== hex) native.value = hex;

      // text fields — never rewrite the focused/origin field (avoids cursor jump)
      if (origin !== fHex.input) fHex.input.value = hex;
      if (origin !== fRgb.input) fRgb.input.value = rgbStr(rgb);
      if (origin !== fHsl.input) fHsl.input.value = hslStr(rgb);

      // preview
      var txt = textOn(rgb);
      preview.style.background = hex;
      preview.style.color = txt;
      pHex.textContent = hex.toUpperCase();
      pSub.textContent = 'rgb(' + rgbStr(rgb) + ')  /  hsl(' + hslStr(rgb) + ')';

      buildHarmonies();
    }

    // initial paint
    setColor(rgb);
    renderFaves();
    renderContrast();

    // Nothing persistent started here (no document/window listeners, no RAF/timers,
    // no audio nodes beyond ctx.sound). Listeners live on nodes inside `root`,
    // which core discards on teardown. Mirror counter.js.
    mount._cleanup = function () {};
  }

  Arcade.register({
    id: 'color',
    category: 'tool',
    title: 'カラーピッカー',
    subtitle: 'パレット & 調和色',
    icon: '🎨',
    color: '#ff6fae',
    order: 30,
    mount: mount,
    unmount: function () { if (mount._cleanup) mount._cleanup(); }
  });
})();
