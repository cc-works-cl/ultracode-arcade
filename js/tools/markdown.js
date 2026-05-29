/* ============================================================
   TOOL — Markdownライブプレビュー
   Self-contained markdown parser (NO CDN). XSS-safe by construction.
   Mirrors js/tools/counter.js. See CONTRACT.md.
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- styles (all classes prefixed "markdown-") ---------------- */
  var CSS = [
    '.markdown-pane{display:flex;flex-direction:column;gap:12px;padding:14px;width:100%;max-width:1100px;margin:0 auto;flex:1 1 auto;min-height:0}',
    '.markdown-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
    '.markdown-toolbar .btn{min-height:44px}',
    '.markdown-seg{display:none;background:var(--surface-2);border-radius:var(--r-pill);padding:4px;gap:4px}',
    '.markdown-seg button{flex:1 1 0;min-height:44px;border:none;background:transparent;color:var(--muted);font-weight:800;font-size:15px;border-radius:var(--r-pill);transition:transform .12s var(--spring),background .15s,color .15s,box-shadow .15s}',
    '.markdown-seg button:active{transform:scale(.95)}',
    '.markdown-seg button.active{background:var(--surface);color:var(--blue);box-shadow:var(--shadow-sm)}',
    '.markdown-split{display:flex;gap:12px;flex:1 1 auto;min-height:0}',
    '.markdown-col{display:flex;flex-direction:column;flex:1 1 0;min-width:0;min-height:0}',
    '.markdown-col>label{font-size:12px;font-weight:800;color:var(--muted);margin:0 0 6px 2px;letter-spacing:.03em}',
    '.markdown-editor{flex:1 1 auto;min-height:240px;resize:none;line-height:1.55;tab-size:2}',
    '.markdown-preview{flex:1 1 auto;min-height:240px;overflow:auto;-webkit-overflow-scrolling:touch;background:var(--surface);border:2px solid var(--line);border-radius:var(--r-btn);padding:16px 18px;word-wrap:break-word;overflow-wrap:anywhere}',
    /* rendered content */
    '.markdown-body{font-size:15px;line-height:1.7;color:var(--text)}',
    '.markdown-body>:first-child{margin-top:0}',
    '.markdown-body>:last-child{margin-bottom:0}',
    '.markdown-body h1,.markdown-body h2,.markdown-body h3,.markdown-body h4,.markdown-body h5,.markdown-body h6{font-weight:800;line-height:1.3;margin:1.2em 0 .5em}',
    '.markdown-body h1{font-size:1.7em;border-bottom:3px solid var(--line);padding-bottom:.25em}',
    '.markdown-body h2{font-size:1.4em;border-bottom:2px solid var(--line);padding-bottom:.2em}',
    '.markdown-body h3{font-size:1.2em}.markdown-body h4{font-size:1.05em}.markdown-body h5{font-size:.95em}.markdown-body h6{font-size:.88em;color:var(--muted)}',
    '.markdown-body p{margin:.6em 0}',
    '.markdown-body a{color:var(--blue);font-weight:700;text-decoration:underline;text-underline-offset:2px}',
    '.markdown-body strong{font-weight:800}',
    '.markdown-body em{font-style:italic}',
    '.markdown-body del{opacity:.7}',
    '.markdown-body code{font-family:ui-monospace,"SF Mono","Cascadia Code",Menlo,Consolas,monospace;font-size:.88em;background:var(--surface-2);padding:.15em .4em;border-radius:7px;border:1px solid var(--line)}',
    '.markdown-body pre{background:#232838;color:#eef1f7;border-radius:var(--r-card);padding:14px 16px;overflow:auto;-webkit-overflow-scrolling:touch;margin:.8em 0;box-shadow:var(--shadow-sm)}',
    '.markdown-body pre code{background:transparent;border:none;padding:0;color:inherit;font-size:13px;line-height:1.6}',
    '.markdown-body .markdown-codewrap{position:relative;margin:.8em 0}',
    '.markdown-body .markdown-codewrap pre{margin:0}',
    '.markdown-body .markdown-lang{position:absolute;top:8px;right:12px;font-size:11px;font-weight:800;letter-spacing:.05em;color:#79829a;text-transform:uppercase;font-family:ui-monospace,Menlo,monospace}',
    '.markdown-body blockquote{margin:.8em 0;padding:.4em 1em;border-left:5px solid var(--teal);background:var(--surface-2);border-radius:0 10px 10px 0;color:var(--text)}',
    '.markdown-body blockquote>:first-child{margin-top:0}.markdown-body blockquote>:last-child{margin-bottom:0}',
    '.markdown-body ul,.markdown-body ol{margin:.5em 0;padding-left:1.5em}',
    '.markdown-body li{margin:.2em 0}',
    '.markdown-body ul ul,.markdown-body ul ol,.markdown-body ol ul,.markdown-body ol ol{margin:.2em 0}',
    '.markdown-body hr{border:none;height:3px;background:var(--line);border-radius:999px;margin:1.2em 0}',
    '.markdown-body img{max-width:100%;height:auto;border-radius:12px;display:block;margin:.6em 0;box-shadow:var(--shadow-sm)}',
    '.markdown-body table{border-collapse:collapse;width:100%;margin:.8em 0;font-size:14px;box-shadow:var(--shadow-sm);border-radius:10px;overflow:hidden;display:block;overflow-x:auto}',
    '.markdown-body th,.markdown-body td{border:1px solid var(--line);padding:8px 12px;text-align:left}',
    '.markdown-body th{background:var(--surface-2);font-weight:800}',
    '.markdown-body tr:nth-child(even) td{background:var(--surface-2)}',
    '.markdown-empty{color:var(--muted);font-style:italic}',
    /* responsive: <=720px -> segmented toggle, single pane */
    '@media (max-width:720px){',
    '.markdown-seg{display:flex}',
    '.markdown-split{flex-direction:column}',
    '.markdown-pane[data-view="edit"] .markdown-col-preview{display:none}',
    '.markdown-pane[data-view="preview"] .markdown-col-editor{display:none}',
    '.markdown-col>label{display:none}',
    '}'
  ].join('');

  /* ---------------- HTML escaping ---------------- */
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ---------------- URL sanitization (allowlist) ---------------- */
  function safeUrl(url, isImage) {
    // strip control chars + whitespace that could hide a scheme (e.g. "java\tscript:")
    var u = String(url).replace(/[\s\x00-\x1f\x7f]/g, '').trim();
    if (u === '') return '#';
    var lower = u.toLowerCase();
    // explicit scheme?
    var m = /^([a-z][a-z0-9+.-]*):/i.exec(lower);
    if (m) {
      var scheme = m[1];
      if (scheme === 'http' || scheme === 'https' || scheme === 'mailto') return u;
      if (isImage && /^data:image\//i.test(lower)) return u;
      return '#'; // javascript:, vbscript:, data:text/html, file:, etc.
    }
    // no scheme => relative / anchor / protocol-relative-ish path; allow
    return u;
  }

  /* ---------------- inline rendering ----------------
     Input is RAW (un-escaped) markdown text for one inline run.
     We escape first, then apply emphasis/links on the escaped string.
     Code spans are extracted FIRST so their contents get no emphasis. */
  function renderInline(text) {
    // 1) split out inline code spans `...` (no nesting, no emphasis inside)
    var segments = []; // {code:bool, text:string}
    var i = 0, n = text.length;
    while (i < n) {
      var bt = text.indexOf('`', i);
      if (bt === -1) { segments.push({ code: false, text: text.slice(i) }); break; }
      // count run of backticks (fence length for the span)
      var run = 0; while (text.charCodeAt(bt + run) === 96) run++;
      var fence = text.substr(bt, run);
      var close = text.indexOf(fence, bt + run);
      // ensure the closing run is exactly `run` backticks (not part of a longer run)
      while (close !== -1) {
        var after = close + run;
        if (text.charCodeAt(after) === 96) { close = text.indexOf(fence, after + 1); continue; }
        // also ensure char before close isn't extending a longer opening — simple cases ok
        break;
      }
      if (close === -1) { // no closer: treat backticks as literal text
        segments.push({ code: false, text: text.slice(i) });
        break;
      }
      if (bt > i) segments.push({ code: false, text: text.slice(i, bt) });
      var inner = text.slice(bt + run, close);
      // a code span trims one leading/trailing space when both ends padded (CommonMark)
      if (inner.length >= 2 && inner.charAt(0) === ' ' && inner.charAt(inner.length - 1) === ' ' && /[^ ]/.test(inner)) {
        inner = inner.slice(1, -1);
      }
      segments.push({ code: true, text: inner });
      i = close + run;
    }

    return segments.map(function (seg) {
      if (seg.code) return '<code>' + esc(seg.text) + '</code>';
      return applyEmphasis(esc(seg.text));
    }).join('');
  }

  // operates on an ALREADY-ESCAPED string (no raw <,>,&," ,' present)
  function applyEmphasis(s) {
    // images first:  ![alt](url)
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^)]*&quot;)?\)/g, function (_, alt, url) {
      var safe = safeUrl(decodeEntities(url), true);
      return '<img src="' + esc(safe) + '" alt="' + alt + '">';
    });
    // links:  [text](url)
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^)]*&quot;)?\)/g, function (_, txt, url) {
      var safe = safeUrl(decodeEntities(url), false);
      var rel = /^(https?:)/i.test(safe) ? ' target="_blank" rel="noopener noreferrer"' : '';
      return '<a href="' + esc(safe) + '"' + rel + '>' + txt + '</a>';
    });
    // bold + italic combined  ***x***  or  ___x___
    s = s.replace(/(\*\*\*|___)(?=\S)([\s\S]+?)(?<=\S)\1/g, '<strong><em>$2</em></strong>');
    // bold  **x**  __x__   (before single * _ so it isn't eaten)
    s = s.replace(/\*\*(?=\S)([\s\S]+?)(?<=\S)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__(?=\S)([\s\S]+?)(?<=\S)__/g, '<strong>$1</strong>');
    // strikethrough  ~~x~~
    s = s.replace(/~~(?=\S)([\s\S]+?)(?<=\S)~~/g, '<del>$1</del>');
    // italic  *x*   (single star, not part of ** which is already consumed)
    s = s.replace(/\*(?=\S)([^*\n]+?)(?<=\S)\*/g, '<em>$1</em>');
    // italic  _x_   (require word boundary so snake_case isn't italicized)
    s = s.replace(/(^|[^\w])_(?=\S)([^_\n]+?)(?<=\S)_(?![\w])/g, '$1<em>$2</em>');
    // hard line break: two+ trailing spaces handled by caller; explicit backslash break
    return s;
  }

  // limited entity decode for URL parsing (we only need &amp; back to & for query strings)
  function decodeEntities(s) {
    return String(s)
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }

  /* ---------------- block parsing ---------------- */
  // Returns HTML string. Pure: no DOM access.
  function renderMarkdown(src) {
    var lines = String(src).replace(/\r\n?/g, '\n').split('\n');
    var out = [];
    var i = 0, len = lines.length;

    while (i < len) {
      var line = lines[i];

      // --- fenced code block ---
      var fence = /^(\s{0,3})(`{3,}|~{3,})\s*([^\s`~]*)/.exec(line);
      if (fence) {
        var marker = fence[2].charAt(0);
        var fenceLen = fence[2].length;
        var lang = fence[3] || '';
        var indent = fence[1].length;
        var buf = [];
        i++;
        while (i < len) {
          var cl = lines[i];
          var closeRe = new RegExp('^\\s{0,3}' + (marker === '`' ? '`' : '~') + '{' + fenceLen + ',}\\s*$');
          if (closeRe.test(cl)) { i++; break; }
          // strip the opening indentation from content lines
          buf.push(indent ? cl.replace(new RegExp('^\\s{0,' + indent + '}'), '') : cl);
          i++;
        }
        var langLabel = lang ? '<span class="markdown-lang">' + esc(lang) + '</span>' : '';
        out.push('<div class="markdown-codewrap">' + langLabel +
          '<pre><code>' + esc(buf.join('\n')) + '</code></pre></div>');
        continue;
      }

      // --- blank line ---
      if (/^\s*$/.test(line)) { i++; continue; }

      // --- horizontal rule ---
      if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
        out.push('<hr>'); i++; continue;
      }

      // --- ATX heading ---
      var h = /^(\s{0,3})(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
      if (h) {
        var lvl = h[2].length;
        out.push('<h' + lvl + '>' + renderInline(h[3]) + '</h' + lvl + '>');
        i++; continue;
      }

      // --- table (header row + separator row) ---
      if (line.indexOf('|') !== -1 && i + 1 < len &&
          /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)+\|?\s*$/.test(lines[i + 1])) {
        var tbl = parseTable(lines, i);
        if (tbl) { out.push(tbl.html); i = tbl.next; continue; }
      }

      // --- blockquote ---
      if (/^\s{0,3}>/.test(line)) {
        var qbuf = [];
        while (i < len && /^\s{0,3}>/.test(lines[i])) {
          qbuf.push(lines[i].replace(/^\s{0,3}>\s?/, ''));
          i++;
        }
        // lazy continuation: stop at blank handled above; recurse on inner content
        out.push('<blockquote>' + renderMarkdown(qbuf.join('\n')) + '</blockquote>');
        continue;
      }

      // --- list (ordered or unordered, with nesting via indentation) ---
      if (/^(\s*)([-*+]|\d{1,9}[.)])\s+/.test(line)) {
        var list = parseList(lines, i);
        out.push(list.html);
        i = list.next;
        continue;
      }

      // --- paragraph (gather consecutive non-blank, non-block lines) ---
      var pbuf = [];
      while (i < len) {
        var pl = lines[i];
        if (/^\s*$/.test(pl)) break;
        // stop if a new block element begins
        if (/^(\s{0,3})(`{3,}|~{3,})/.test(pl)) break;
        if (/^\s{0,3}#{1,6}\s+/.test(pl)) break;
        if (/^\s{0,3}>/.test(pl)) break;
        if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(pl)) break;
        if (/^(\s*)([-*+]|\d{1,9}[.)])\s+/.test(pl)) break;
        pbuf.push(pl);
        i++;
      }
      if (pbuf.length) {
        out.push('<p>' + renderParagraph(pbuf) + '</p>');
      }
    }

    return out.join('\n');
  }

  // join paragraph lines; trailing 2+ spaces OR trailing backslash => hard <br>
  function renderParagraph(pbuf) {
    var parts = pbuf.map(function (l, idx) {
      var hard = / {2,}$/.test(l) || /\\$/.test(l);
      var clean = l.replace(/\s+$/, '').replace(/\\$/, '');
      var html = renderInline(clean);
      if (hard && idx < pbuf.length - 1) html += '<br>';
      return html;
    });
    return parts.join('\n');
  }

  /* ---------------- table parser ---------------- */
  function splitRow(row) {
    var trimmed = row.trim().replace(/^\|/, '').replace(/\|$/, '');
    var cells = [];
    var cur = '';
    for (var k = 0; k < trimmed.length; k++) {
      var ch = trimmed.charAt(k);
      if (ch === '\\' && trimmed.charAt(k + 1) === '|') { cur += '|'; k++; continue; }
      if (ch === '|') { cells.push(cur); cur = ''; continue; }
      cur += ch;
    }
    cells.push(cur);
    return cells.map(function (c) { return c.trim(); });
  }

  function parseTable(lines, start) {
    var header = splitRow(lines[start]);
    var sep = splitRow(lines[start + 1]);
    if (!sep.length) return null;
    var aligns = sep.map(function (c) {
      var l = /^:/.test(c), r = /:$/.test(c);
      return l && r ? 'center' : r ? 'right' : l ? 'left' : '';
    });
    var html = ['<table><thead><tr>'];
    header.forEach(function (cell, idx) {
      var a = aligns[idx] ? ' style="text-align:' + aligns[idx] + '"' : '';
      html.push('<th' + a + '>' + renderInline(cell) + '</th>');
    });
    html.push('</tr></thead><tbody>');
    var i = start + 2;
    while (i < lines.length && lines[i].indexOf('|') !== -1 && !/^\s*$/.test(lines[i])) {
      var row = splitRow(lines[i]);
      html.push('<tr>');
      for (var c = 0; c < header.length; c++) {
        var a2 = aligns[c] ? ' style="text-align:' + aligns[c] + '"' : '';
        html.push('<td' + a2 + '>' + renderInline(row[c] != null ? row[c] : '') + '</td>');
      }
      html.push('</tr>');
      i++;
    }
    html.push('</tbody></table>');
    return { html: html.join(''), next: i };
  }

  /* ---------------- list parser (handles nesting via indent) ---------------- */
  function itemMatch(line) {
    var m = /^(\s*)([-*+]|\d{1,9})([.)]?)\s+(.*)$/.exec(line);
    if (!m) return null;
    var bullet = m[2], punct = m[3];
    var ordered = /\d/.test(bullet);
    if (ordered && punct === '') return null; // "1 foo" is not a list
    if (!ordered && punct !== '') return null; // "-. foo" not a marker
    return {
      indent: m[1].replace(/\t/g, '  ').length,
      ordered: ordered,
      start: ordered ? parseInt(bullet, 10) : null,
      text: m[4]
    };
  }

  function parseList(lines, start) {
    var first = itemMatch(lines[start]);
    var ordered = first.ordered;
    var baseIndent = first.indent;
    var html = ordered
      ? '<ol' + (first.start && first.start !== 1 ? ' start="' + first.start + '"' : '') + '>'
      : '<ul>';
    var i = start;
    var len = lines.length;

    while (i < len) {
      var line = lines[i];
      if (/^\s*$/.test(line)) {
        // peek: a blank then a deeper/continuing list line keeps the list; else end
        var j = i + 1;
        while (j < len && /^\s*$/.test(lines[j])) j++;
        if (j >= len) break;
        var nxt = itemMatch(lines[j]);
        if (!nxt || nxt.indent < baseIndent) break;
        i = j; continue;
      }
      var im = itemMatch(line);
      if (!im || im.indent < baseIndent) break;
      if (im.indent > baseIndent) break; // shouldn't happen; nested handled below

      // gather this item's lines: the marker line + indented continuation/children
      var itemLines = [im.text];
      i++;
      while (i < len) {
        var cont = lines[i];
        if (/^\s*$/.test(cont)) {
          // blank inside item only if followed by deeper-indented content
          var k = i + 1;
          if (k < len && !/^\s*$/.test(lines[k]) &&
              (lines[k].replace(/\t/g, '  ').match(/^(\s*)/)[1].length > baseIndent)) {
            itemLines.push('');
            i++;
            continue;
          }
          break;
        }
        var contIndent = cont.replace(/\t/g, '  ').match(/^(\s*)/)[1].length;
        var contItem = itemMatch(cont);
        if (contItem && contItem.indent <= baseIndent) break; // sibling/ancestor
        if (contIndent > baseIndent) {
          // child line (nested list or lazy continuation): de-indent by (baseIndent+? )
          itemLines.push(cont.slice(Math.min(contIndent, baseIndent + 1)));
          i++;
          continue;
        }
        // lazy paragraph continuation belongs to this item
        if (!contItem) { itemLines.push(cont.trim()); i++; continue; }
        break;
      }

      html += '<li>' + renderItemContent(itemLines) + '</li>';
    }

    html += ordered ? '</ol>' : '</ul>';
    return { html: html, next: i };
  }

  // Item content: may contain a nested list and/or plain inline text.
  function renderItemContent(itemLines) {
    // find where a nested list begins
    var nestedStart = -1;
    for (var k = 0; k < itemLines.length; k++) {
      if (itemMatch(itemLines[k]) && itemLines[k].search(/\S/) >= 0 &&
          /^(\s+)([-*+]|\d{1,9}[.)])\s+/.test(itemLines[k])) {
        nestedStart = k; break;
      }
    }
    if (nestedStart === -1) {
      // pure text item (possibly multi-line) -> inline, join with space
      var txt = itemLines.filter(function (l) { return l.trim() !== ''; })
        .map(function (l) { return l.trim(); }).join(' ');
      return renderInline(txt);
    }
    var lead = itemLines.slice(0, nestedStart).filter(function (l) { return l.trim() !== ''; })
      .map(function (l) { return l.trim(); }).join(' ');
    var rest = itemLines.slice(nestedStart);
    var nested = renderMarkdown(rest.join('\n'));
    return (lead ? renderInline(lead) : '') + nested;
  }

  /* ---------------- sample document ---------------- */
  var SAMPLE = [
    '# Markdownプレビュー へようこそ ✨',
    '',
    'これは **ライブ** でレンダリングされる _Markdown_ エディタなのだ。',
    'タイプすると右側（スマホは「プレビュー」タブ）に即反映するのだ。',
    '',
    '## 書式いろいろ',
    '',
    '- **太字** と *斜体* と ~~取り消し線~~',
    '- `インラインコード` も書けるのだ',
    '- リンク → [ULTRA ARCADE](https://example.com)',
    '  - ネストした項目',
    '  - もうひとつ',
    '',
    '1. 順序つきリスト',
    '2. その2',
    '3. その3',
    '',
    '> 引用ブロックはこんな感じ。',
    '> 複数行もOKなのだ。',
    '',
    '```js',
    'function hello(name) {',
    '  return `こんにちは、${name}！`;',
    '}',
    '```',
    '',
    '| 機能 | 対応 |',
    '|------|:----:|',
    '| 見出し | ✅ |',
    '| 表 | ✅ |',
    '| 安全なHTML | ✅ |',
    '',
    '---',
    '',
    '画像も貼れるのだ（URLは安全なものだけ許可）。'
  ].join('\n');

  /* ---------------- mount ---------------- */
  function mount(root, ctx) {
    ctx.injectCSS('tool-markdown', CSS);
    var store = ctx.storage('markdown-text');

    var pane = ctx.el('div', { class: 'markdown-pane', dataset: { view: 'edit' } });

    // segmented control (only visible <=720px via CSS)
    var segEdit = ctx.el('button', { class: 'active', type: 'button' }, '編集');
    var segPrev = ctx.el('button', { type: 'button' }, 'プレビュー');
    var seg = ctx.el('div', { class: 'markdown-seg', role: 'tablist' }, segEdit, segPrev);

    function setView(v) {
      pane.dataset.view = v;
      segEdit.classList.toggle('active', v === 'edit');
      segPrev.classList.toggle('active', v === 'preview');
      ctx.sound.play('tab');
      if (v === 'preview') render();
    }
    segEdit.addEventListener('click', function () { setView('edit'); });
    segPrev.addEventListener('click', function () { setView('preview'); });

    // editor
    var editor = ctx.el('textarea', {
      class: 'field mono markdown-editor',
      placeholder: 'ここに Markdown を書くのだ…',
      spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off',
      'aria-label': 'Markdown入力'
    });
    editor.value = store.get(SAMPLE);

    var preview = ctx.el('div', { class: 'markdown-preview' },
      ctx.el('div', { class: 'markdown-body' }));
    var body = preview.firstChild;

    var editorCol = ctx.el('div', { class: 'markdown-col markdown-col-editor' },
      ctx.el('label', null, '編集'), editor);
    var previewCol = ctx.el('div', { class: 'markdown-col markdown-col-preview' },
      ctx.el('label', null, 'プレビュー'), preview);
    var split = ctx.el('div', { class: 'markdown-split' }, editorCol, previewCol);

    // toolbar
    var btnCopyHtml = ctx.el('button', { class: 'btn btn-primary squish', type: 'button' }, 'コピー(HTML)');
    var btnCopyMd = ctx.el('button', { class: 'btn btn-accent squish', type: 'button' }, 'コピー(Markdown)');
    var btnSample = ctx.el('button', { class: 'btn btn-green squish', type: 'button' }, 'サンプル挿入');
    var btnClear = ctx.el('button', { class: 'btn btn-ghost squish', type: 'button' }, 'クリア');
    var toolbar = ctx.el('div', { class: 'markdown-toolbar' }, btnCopyHtml, btnCopyMd, btnSample, btnClear);

    function copyText(text, label) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          ctx.toast(label + 'をコピーしたのだ'); ctx.sound.play('coin');
        }, function () { ctx.toast('コピーできなかったのだ'); ctx.sound.play('error'); });
      } else {
        ctx.toast('コピーに非対応の環境なのだ'); ctx.sound.play('error');
      }
    }

    btnCopyHtml.addEventListener('click', function () {
      copyText(renderMarkdown(editor.value), 'HTML');
    });
    btnCopyMd.addEventListener('click', function () {
      copyText(editor.value, 'Markdown');
    });
    btnSample.addEventListener('click', function () {
      editor.value = SAMPLE; persist(); render(); ctx.sound.play('success');
      ctx.toast('サンプルを入れたのだ');
    });
    btnClear.addEventListener('click', function () {
      editor.value = ''; persist(); render(); editor.focus(); ctx.sound.play('back');
    });

    pane.append(toolbar, seg, split);
    root.appendChild(pane);

    // --- live render (debounced) + synchronous persist ---
    var debounceTimer = null;
    function persist() { store.set(editor.value); }
    function render() {
      var html = renderMarkdown(editor.value);
      if (html.replace(/\s/g, '') === '') {
        body.textContent = '';
        body.appendChild(ctx.el('div', { class: 'markdown-empty' }, 'プレビューはここに出るのだ…'));
      } else {
        body.innerHTML = html; // html is built entirely from escaped pieces — XSS-safe
      }
    }
    editor.addEventListener('input', function () {
      persist(); // synchronous: never lose text
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () { debounceTimer = null; render(); }, 140);
    });

    render();
    setTimeout(function () { editor.focus(); }, 350);

    mount._cleanup = function () {
      if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
    };
  }

  Arcade.register({
    id: 'markdown',
    category: 'tool',
    title: 'Markdownプレビュー',
    subtitle: 'ライブで描画',
    icon: '📝',
    color: '#1fd3c9',
    order: 40,
    mount: mount,
    unmount: function () { if (mount._cleanup) mount._cleanup(); }
  });
})();
