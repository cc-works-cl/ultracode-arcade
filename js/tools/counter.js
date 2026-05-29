/* ============================================================
   TOOL — 文字数/文字種カウンター  (CANONICAL TEMPLATE MODULE)
   Mirror this file's shape for every component. See CONTRACT.md.
   ============================================================ */
(function () {
  'use strict';

  var CSS = [
    '.counter-pane{padding:16px;gap:14px;display:flex;flex-direction:column;max-width:920px;margin:0 auto;width:100%}',
    '.counter-pane textarea{min-height:34vh;flex:0 0 auto}',
    '.counter-stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}',
    '.cstat{background:var(--surface);border-radius:14px;padding:12px 14px;box-shadow:var(--shadow-sm);border-left:5px solid var(--accent,#3d7bff)}',
    '.cstat b{display:block;font-size:24px;font-weight:800;line-height:1.15}',
    '.cstat span{font-size:12px;color:var(--muted);font-weight:700}',
    '.counter-bars{display:flex;flex-direction:column;gap:8px}',
    '.cbar{display:grid;grid-template-columns:84px 1fr 56px;align-items:center;gap:10px;font-size:13px;font-weight:700}',
    '.cbar .track{height:12px;border-radius:999px;background:var(--surface-2);overflow:hidden}',
    '.cbar .fill{height:100%;border-radius:999px;transition:width .25s var(--spring)}',
    '.cbar .num{text-align:right;color:var(--muted)}'
  ].join('');

  // unicode-aware splitter (handles emoji / surrogate pairs / ZWJ where supported)
  function chars(str) {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      var seg = new Intl.Segmenter('ja', { granularity: 'grapheme' });
      var out = []; var it = seg.segment(str)[Symbol.iterator]();
      for (var r = it.next(); !r.done; r = it.next()) out.push(r.value.segment);
      return out;
    }
    return Array.from(str);
  }

  function classify(text) {
    var c = { hiragana: 0, katakana: 0, kanji: 0, alnum: 0, space: 0, symbol: 0, emoji: 0, other: 0 };
    var graphemes = chars(text);
    graphemes.forEach(function (g) {
      var cp = g.codePointAt(0);
      if (g.length > 1 || cp > 0x2600) { // crude emoji/pictograph bucket
        if (/\p{Extended_Pictographic}/u.test(g)) { c.emoji++; return; }
      }
      if (/\s/.test(g)) c.space++;
      else if (/[぀-ゟー]/.test(g)) c.hiragana++;
      else if (/[゠-ヿｦ-ﾟ]/.test(g)) c.katakana++;
      else if (/[一-鿿㐀-䶿]/.test(g)) c.kanji++;
      else if (/[0-9A-Za-z０-９Ａ-Ｚａ-ｚ]/.test(g)) c.alnum++;
      else if (/[!-/:-@[-`{-~　-〿！-｠]/.test(g)) c.symbol++;
      else c.other++;
    });
    return { counts: c, total: graphemes.length };
  }

  function bytes(str) { return new (window.TextEncoder || function () { return { encode: function (s) { return unescape(encodeURIComponent(s)); } }; })().encode(str).length; }

  function mount(root, ctx) {
    ctx.injectCSS('tool-counter', CSS);
    var saved = ctx.storage('counter-text');

    var ta = ctx.el('textarea', {
      class: 'field mono', placeholder: 'ここに文章を入力すると、リアルタイムで集計するのだ。',
      spellcheck: 'false'
    });
    ta.value = saved.get('');

    var stats = ctx.el('div', { class: 'counter-stats' });
    var bars = ctx.el('div', { class: 'counter-bars' });
    var actions = ctx.el('div', { class: 'row' },
      ctx.el('button', { class: 'btn btn-ghost squish', onClick: function () { ta.value = ''; update(); ta.focus(); ctx.sound.play('back'); } }, 'クリア'),
      ctx.el('button', { class: 'btn btn-primary squish', onClick: function () {
        navigator.clipboard && navigator.clipboard.writeText(ta.value).then(function () { ctx.toast('コピーしたのだ'); ctx.sound.play('coin'); });
      } }, 'コピー')
    );

    root.appendChild(ctx.el('div', { class: 'counter-pane' }, ta, actions, stats, bars));

    var TYPES = [
      { key: 'kanji', label: '漢字', color: 'var(--red)' },
      { key: 'hiragana', label: 'ひらがな', color: 'var(--orange)' },
      { key: 'katakana', label: 'カタカナ', color: 'var(--green)' },
      { key: 'alnum', label: '英数字', color: 'var(--blue)' },
      { key: 'symbol', label: '記号', color: 'var(--purple)' },
      { key: 'emoji', label: '絵文字', color: 'var(--pink)' },
      { key: 'space', label: '空白', color: 'var(--teal)' }
    ];

    function stat(value, label, color) {
      return ctx.el('div', { class: 'cstat', style: { '--accent': color } }, ctx.el('b', null, String(value)), ctx.el('span', null, label));
    }

    var prevTotal = -1;
    function update() {
      var text = ta.value;
      saved.set(text);
      var noSpace = text.replace(/\s/g, '');
      var lines = text === '' ? 0 : text.split(/\r\n|\r|\n/).length;
      var words = (text.trim().match(/[^\s]+/g) || []).length;
      var r = classify(text);

      stats.innerHTML = '';
      stats.append(
        stat(r.total, '文字数（総数）', 'var(--blue)'),
        stat(chars(noSpace).length, '空白を除く', 'var(--indigo)'),
        stat(lines, '行数', 'var(--green)'),
        stat(words, '単語数', 'var(--orange)'),
        stat(bytes(text), 'バイト数(UTF-8)', 'var(--purple)'),
        stat(Math.ceil(r.total / 400), '原稿用紙(400字)', 'var(--red)'),
        stat(Math.max(0, Math.round(r.total / 500 * 10) / 10), '読了(分,500字/分)', 'var(--teal)')
      );

      bars.innerHTML = '';
      var max = Math.max(1, r.total);
      TYPES.forEach(function (t) {
        var n = r.counts[t.key];
        bars.appendChild(ctx.el('div', { class: 'cbar' },
          ctx.el('span', null, t.label),
          ctx.el('div', { class: 'track' }, ctx.el('div', { class: 'fill', style: { width: (n / max * 100) + '%', background: t.color } })),
          ctx.el('span', { class: 'num' }, String(n))
        ));
      });

      if (r.total !== prevTotal && prevTotal !== -1) ctx.sound.play('tick');
      prevTotal = r.total;
    }

    ta.addEventListener('input', update);
    update();
    setTimeout(function () { ta.focus(); }, 350);

    mount._cleanup = function () {}; // nothing persistent to stop here
  }

  Arcade.register({
    id: 'counter',
    category: 'tool',
    title: '文字数カウンター',
    subtitle: '文字種を集計',
    icon: '🔢',
    color: '#6c63ff',
    order: 20,
    mount: mount,
    unmount: function () { if (mount._cleanup) mount._cleanup(); }
  });
})();
