/* ============================================================
   GAME — Arrows GO  (矢印を引き抜くロジックパズル)
   Tap an arrow to pull it toward the board edge in its direction.
   If the straight path is blocked by another arrow -> MISS (lose a life).
   Clear every arrow to win. Order matters. Levels are reverse-built
   so they are guaranteed solvable, and a forward verifier double-checks
   every stage + powers the hint. See CONTRACT.md / counter.js for shape.
   ============================================================ */
(function () {
  'use strict';

  var ID = 'arrowsgo';

  var CSS = [
    '.arrowsgo-pane{display:flex;flex-direction:column;height:100%;width:100%;gap:10px;padding:12px;box-sizing:border-box;max-width:680px;margin:0 auto}',
    '.arrowsgo-hud{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
    '.arrowsgo-stage{font-weight:800;font-size:15px;color:var(--text);display:flex;flex-direction:column;line-height:1.15;flex:1 1 auto;min-width:0}',
    '.arrowsgo-stage small{font-size:11px;color:var(--muted);font-weight:700}',
    '.arrowsgo-stat{display:inline-flex;align-items:center;gap:5px;background:var(--surface-2);border-radius:var(--r-pill);padding:6px 12px;font-weight:800;font-size:14px;min-height:34px;white-space:nowrap}',
    '.arrowsgo-lives{display:inline-flex;gap:2px;font-size:17px;line-height:1}',
    '.arrowsgo-lives span{transition:transform .25s var(--spring),opacity .25s}',
    '.arrowsgo-lives span.gone{opacity:.22;transform:scale(.7)}',
    '.arrowsgo-board-wrap{flex:1 1 auto;position:relative;display:flex;align-items:safe center;justify-content:safe center;min-height:0;overflow:auto;border-radius:var(--r-card);background:linear-gradient(160deg,#eef2fa,#e3e9f5);box-shadow:inset 0 2px 10px rgba(60,80,140,.10)}',
    /* tiles packed flush (gap 0) so the filled cells form a continuous silhouette */
    '.arrowsgo-grid{display:grid;gap:0;padding:0;margin:auto;touch-action:manipulation;filter:drop-shadow(0 4px 10px rgba(40,54,92,.18))}',
    '.arrowsgo-cell{position:relative;border:none;padding:0;display:flex;align-items:center;justify-content:center;line-height:1;cursor:pointer;background:transparent;-webkit-tap-highlight-color:transparent;overflow:hidden;min-width:0;min-height:0}',
    '.arrowsgo-cell.empty{background:transparent;cursor:default}',                       /* holes: board shows through */
    '.arrowsgo-cell.arrow{background:var(--ag-cell,#3d7bff);box-shadow:inset 0 0 0 1px rgba(255,255,255,.18);transition:transform .1s var(--spring),filter .15s;color:var(--ag-fg,#fff)}',
    '.arrowsgo-cell.arrow:active{transform:scale(.88);z-index:2}',
    '@media(hover:hover){.arrowsgo-cell.arrow:hover{filter:brightness(1.08)}}',
    '.arrowsgo-cell.clawd-body{--ag-cell:#e8814e;--ag-fg:#5a2a08;box-shadow:inset 0 0 0 1px rgba(120,55,10,.20)}',
    '.arrowsgo-cell.clawd-eye{--ag-cell:#22262f;--ag-fg:#eef0f6;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}',
    '.arrowsgo-glyph{display:flex;align-items:center;justify-content:center;width:62%;height:62%;transition:opacity .3s;will-change:opacity}',
    '.arrowsgo-svg{width:100%;height:100%;display:block;overflow:visible}',
    '.arrowsgo-cell.pulling{pointer-events:none}',
    '.arrowsgo-cell.pulling .arrowsgo-glyph{opacity:0}',
    '.arrowsgo-cell.miss{animation:arrowsgo-shake .42s;z-index:3}',
    '.arrowsgo-cell.hintpulse{animation:arrowsgo-hint .9s var(--spring) 2;z-index:3}',
    '@keyframes arrowsgo-shake{0%,100%{transform:translateX(0)}15%{transform:translateX(-6px) rotate(-3deg)}30%{transform:translateX(6px) rotate(3deg)}45%{transform:translateX(-5px)}60%{transform:translateX(5px)}75%{transform:translateX(-3px)}}',
    '@keyframes arrowsgo-hint{0%,100%{box-shadow:inset 0 0 0 1px rgba(255,255,255,.18)}50%{box-shadow:0 0 0 3px var(--lime),0 6px 16px rgba(80,200,90,.55)}}',
    '.arrowsgo-controls{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}',
    '.arrowsgo-controls .btn{min-height:44px;padding:0 16px;font-size:14px}',
    '.arrowsgo-overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:20px;background:rgba(255,255,255,.86);backdrop-filter:blur(4px);border-radius:var(--r-card);z-index:5;animation:arrowsgo-pop .34s var(--spring)}',
    '@keyframes arrowsgo-pop{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:none}}',
    '.arrowsgo-overlay h3{margin:0;font-size:26px;font-weight:900;color:var(--text)}',
    '.arrowsgo-overlay .em{font-size:46px;line-height:1}',
    '.arrowsgo-overlay p{margin:0;color:var(--muted);font-weight:700;font-size:14px;max-width:260px}',
    '.arrowsgo-overlay .row{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}',
    '.arrowsgo-fly{position:absolute;pointer-events:none;z-index:4;display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(255,255,255,.18);will-change:transform,opacity}'
  ].join('');

  var DIRS = {
    U: { dc: 0, dr: -1, rot: 0,   tx: 0, ty: -1, color: 'var(--blue)' },
    D: { dc: 0, dr: 1,  rot: 180, tx: 0, ty: 1,  color: 'var(--purple)' },
    L: { dc: -1, dr: 0, rot: 270, tx: -1, ty: 0, color: 'var(--teal)' },
    R: { dc: 1, dr: 0,  rot: 90,  tx: 1, ty: 0,  color: 'var(--pink)' }
  };
  var DIR_KEYS = ['U', 'D', 'L', 'R'];

  // A "real" arrow — straight shaft + chevron arrowhead (NOT a play-button triangle).
  // Drawn as inline SVG so it stays crisp at any tile size and inherits currentColor;
  // the head is baked into the path and the whole glyph is rotated per direction.
  var ARROW_PATH = 'M12 20.5 L12 6.5 M6 11 L12 4.8 L18 11';
  function arrowSVG(dir) {
    return '<svg class="arrowsgo-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<g transform="rotate(' + DIRS[dir].rot + ' 12 12)"><path d="' + ARROW_PATH + '"/></g></svg>';
  }

  /* ---------------- pure board helpers ---------------- */
  // Return list of [c,r] cells in the ray from (c,r) toward the edge in dir
  // (cells strictly beyond the source cell).
  function rayCells(cols, rows, c, r, dir) {
    var d = DIRS[dir];
    var out = [];
    var cc = c + d.dc, rr = r + d.dr;
    while (cc >= 0 && cc < cols && rr >= 0 && rr < rows) {
      out.push([cc, rr]);
      cc += d.dc; rr += d.dr;
    }
    return out;
  }

  // Is the ray clear of any occupied cell? `occupied(c,r)` -> boolean.
  function rayClear(cols, rows, c, r, dir, occupied) {
    var ray = rayCells(cols, rows, c, r, dir);
    for (var i = 0; i < ray.length; i++) {
      if (occupied(ray[i][0], ray[i][1])) return false;
    }
    return true;
  }

  /* ---------------- guaranteed-solvable generator ----------------
     Reverse construction over a shape S (list of "c,r" keys).
     placed = cells already assigned a direction = cells that will be
     removed LATER, so they are still present when the current cell is
     removed. A cell is a candidate if it has some direction whose ray
     to the edge contains none of the currently-placed cells. Reverse
     placement order is a valid removal order. */
  function generate(cols, rows, cells, rng) {
    rng = rng || Math.random;
    var key = function (c, r) { return c + ',' + r; };
    for (var attempt = 0; attempt < 400; attempt++) {
      var placed = {};                 // key -> dir
      var placedCount = 0;
      var remaining = cells.slice();
      var ok = true;
      while (remaining.length) {
        // build candidate list: cell + its valid directions
        var cands = [];
        for (var i = 0; i < remaining.length; i++) {
          var cell = remaining[i];
          var dirsOk = [];
          for (var k = 0; k < DIR_KEYS.length; k++) {
            var dir = DIR_KEYS[k];
            var clear = rayClear(cols, rows, cell.c, cell.r, dir, function (rc, rr) {
              return !!placed[key(rc, rr)];
            });
            if (clear) dirsOk.push(dir);
          }
          if (dirsOk.length) cands.push({ idx: i, cell: cell, dirs: dirsOk });
        }
        if (!cands.length) { ok = false; break; }
        // Prefer the most-constrained candidates (fewest valid directions).
        // This removes the failure tail and makes dense shapes (the Clawd
        // robot) generate fast and reliably, so the fallback rarely triggers.
        var minDirs = Infinity;
        for (var ci = 0; ci < cands.length; ci++) if (cands[ci].dirs.length < minDirs) minDirs = cands[ci].dirs.length;
        var tight = cands.filter(function (x) { return x.dirs.length === minDirs; });
        var pick = tight[(rng() * tight.length) | 0];
        var chosenDir = pick.dirs[(rng() * pick.dirs.length) | 0];
        placed[key(pick.cell.c, pick.cell.r)] = chosenDir;
        placedCount++;
        // remove from remaining (by value, not idx, since idx shifts)
        remaining.splice(pick.idx, 1);
      }
      if (ok && placedCount === cells.length) {
        // materialize board
        var board = makeEmpty(cols, rows);
        cells.forEach(function (cell) {
          board[cell.r][cell.c] = { dir: placed[key(cell.c, cell.r)] };
        });
        return board;
      }
    }
    return null; // failed all attempts
  }

  function makeEmpty(cols, rows) {
    var b = [];
    for (var r = 0; r < rows; r++) {
      var row = [];
      for (var c = 0; c < cols; c++) row.push(null);
      b.push(row);
    }
    return b;
  }

  /* ---------------- forward verifier / hint ----------------
     Copy occupancy, repeatedly remove any arrow whose ray is clear of
     remaining arrows. Solvable iff board empties. Returns a removable
     cell {c,r} (for hint) if any exists at the *current* live state. */
  function verify(cols, rows, board) {
    var occ = [];
    var total = 0;
    for (var r = 0; r < rows; r++) {
      occ.push([]);
      for (var c = 0; c < cols; c++) {
        var has = !!(board[r][c]);
        occ[r].push(has ? board[r][c].dir : null);
        if (has) total++;
      }
    }
    var removed = 0;
    var guard = total + 5;
    while (guard-- > 0) {
      var any = false;
      for (var rr = 0; rr < rows; rr++) {
        for (var cc = 0; cc < cols; cc++) {
          var dir = occ[rr][cc];
          if (!dir) continue;
          var clear = rayClear(cols, rows, cc, rr, dir, function (qc, qr) {
            return occ[qr][qc] != null;
          });
          if (clear) { occ[rr][cc] = null; removed++; any = true; }
        }
      }
      if (!any) break;
    }
    return { solvable: removed === total, total: total };
  }

  // Find one currently-removable cell in the live board (for the hint).
  function findSafe(cols, rows, board) {
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var cell = board[r][c];
        if (!cell) continue;
        var clear = rayClear(cols, rows, c, r, cell.dir, function (qc, qr) {
          return !!board[qr][qc];
        });
        if (clear) return { c: c, r: r };
      }
    }
    return null;
  }

  /* ---------------- shape builders ---------------- */
  function fullRect(cols, rows) {
    var cells = [];
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) cells.push({ c: c, r: r });
    return cells;
  }
  function diamond(size) {
    // size = radius; grid (2*size+1)^2, |dx|+|dy| <= size
    var n = size * 2 + 1, cells = [];
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
      if (Math.abs(c - size) + Math.abs(r - size) <= size) cells.push({ c: c, r: r });
    }
    return cells;
  }
  function fromBitmap(rows) {
    var cells = [], cols = 0;
    rows.forEach(function (line, r) {
      cols = Math.max(cols, line.length);
      for (var c = 0; c < line.length; c++) {
        var ch = line.charAt(c);
        if (ch === '1') cells.push({ c: c, r: r });
        else if (ch === '2') cells.push({ c: c, r: r, eye: true });
      }
    });
    return { cells: cells, cols: cols, rows: rows.length };
  }

  // Clawd — Claude Code's retro 8-bit mascot, recreated as ORIGINAL arrow
  // dot-art (homage / fan-art; no official assets used). A squarish orange
  // pixel-robot: flat top (no ears), two black square eyes up high, a one-row
  // arm bump on each side, and four little legs (2 + 2) with a wide center gap.
  // '1' = orange body arrow cell, '2' = black "eye" arrow cell, '0' = empty.
  // Eyes are still real arrow tiles (just tinted dark) so they remain part of
  // the puzzle and must be pulled like any other arrow.
  var CLAWD = [
    '0111111110', // flat top of the head
    '0122112210', // eyes (black 2x2 each, gap in the middle)
    '0122112210',
    '0111111110',
    '1111111111', // arm bumps stick out one cell on each side
    '0111111110',
    '0101001010'  // four legs: 2 + wide center gap + 2
  ];

  /* ---------------- level definitions ---------------- */
  function buildLevels() {
    var levels = [];

    // Stage 1: filled 3x3 (teach the basic ray rule)
    levels.push({ title: 'はじまりの矢', cols: 3, rows: 3, shapeCells: fullRect(3, 3) });

    // Stage 2: diamond (radius 2 -> 5x5 grid, 13 cells)
    (function () {
      var d = diamond(2);
      levels.push({ title: 'ダイヤモンド', cols: 5, rows: 5, shapeCells: d });
    })();

    // Stage 3: filled 5x5 (a denser challenge)
    levels.push({ title: 'ぎっしり5×5', cols: 5, rows: 5, shapeCells: fullRect(5, 5) });

    // Highlight: Clawd — the orange pixel-robot mascot (arrow fan-art)
    (function () {
      var b = fromBitmap(CLAWD);
      levels.push({ title: 'Clawd を救い出せ！', cols: b.cols, rows: b.rows, shapeCells: b.cells, clawd: true });
    })();

    // Bonus shapes after the highlight
    (function () {
      // A hollow ring / box frame 5x5
      var cells = [];
      for (var r = 0; r < 5; r++) for (var c = 0; c < 5; c++) {
        if (r === 0 || r === 4 || c === 0 || c === 4) cells.push({ c: c, r: r });
      }
      levels.push({ title: 'フレーム', cols: 5, rows: 5, shapeCells: cells });
    })();
    (function () {
      // Plus sign on a 7x7 grid
      var cells = [];
      for (var r = 0; r < 7; r++) for (var c = 0; c < 7; c++) {
        if (c >= 2 && c <= 4) cells.push({ c: c, r: r });
        else if (r >= 2 && r <= 4) cells.push({ c: c, r: r });
      }
      levels.push({ title: 'おおきなプラス', cols: 7, rows: 7, shapeCells: cells });
    })();

    return levels;
  }

  /* ---------------- module ---------------- */
  function mount(root, ctx) {
    ctx.injectCSS(ID, CSS);

    var LEVELS = buildLevels();
    var prog = ctx.storage(ID + '-progress');
    var maxStage = Math.max(0, Math.min(LEVELS.length - 1, prog.get(0) | 0));

    var timers = [];
    var listeners = [];
    var destroyed = false;

    function later(fn, ms) { var t = setTimeout(function () { timers = timers.filter(function (x) { return x !== t; }); if (!destroyed) fn(); }, ms); timers.push(t); return t; }
    function on(target, ev, fn, opts) { target.addEventListener(ev, fn, opts); listeners.push([target, ev, fn, opts]); }

    var state = {
      stage: maxStage,
      board: null,
      cols: 0,
      rows: 0,
      lives: 3,
      remaining: 0,
      clawd: false,
      eyeSet: null,
      busy: false,
      over: false
    };

    /* ----- DOM scaffold ----- */
    var stageLabel = ctx.el('div', { class: 'arrowsgo-stage' });
    var livesEl = ctx.el('div', { class: 'arrowsgo-lives', 'aria-label': 'ライフ' });
    var livesStat = ctx.el('div', { class: 'arrowsgo-stat' }, livesEl);
    var remainEl = ctx.el('b', null, '0');
    var remainStat = ctx.el('div', { class: 'arrowsgo-stat', 'aria-label': '残りの矢印' }, '🧭', remainEl);

    var hud = ctx.el('div', { class: 'arrowsgo-hud' }, stageLabel, remainStat, livesStat);

    var grid = ctx.el('div', { class: 'arrowsgo-grid' });
    var boardWrap = ctx.el('div', { class: 'arrowsgo-board-wrap' }, grid);

    var hintBtn = ctx.el('button', {
      class: 'btn btn-green squish', onClick: function () { doHint(); }
    }, '💡 ヒント');
    var resetBtn = ctx.el('button', {
      class: 'btn btn-ghost squish', onClick: function () { ctx.sound.play('back'); ctx.haptic(8); loadStage(state.stage); }
    }, '↻ やり直し');
    var controls = ctx.el('div', { class: 'arrowsgo-controls' }, hintBtn, resetBtn);

    var pane = ctx.el('div', { class: 'arrowsgo-pane' }, hud, boardWrap, controls);
    root.appendChild(pane);

    /* ----- cell elements cache ----- */
    var cellEls = []; // [r][c] -> button | null

    function renderLives() {
      livesEl.innerHTML = '';
      for (var i = 0; i < 3; i++) {
        livesEl.appendChild(ctx.el('span', { class: i < state.lives ? '' : 'gone' }, '❤️'));
      }
    }

    function setRemaining(n) {
      state.remaining = n;
      remainEl.textContent = String(n);
    }

    function cellSizePx() {
      var maxW = boardWrap.clientWidth - 16;
      var maxH = boardWrap.clientHeight - 16;
      if (maxW <= 0) maxW = 300;
      if (maxH <= 0) maxH = 300;
      var gap = 0; // tiles packed flush
      var byW = (maxW - gap * (state.cols - 1)) / state.cols;
      var byH = (maxH - gap * (state.rows - 1)) / state.rows;
      var s = Math.floor(Math.min(byW, byH));
      // honor the 44px min tap target; the board scrolls if it overflows.
      return Math.max(44, Math.min(76, s));
    }

    function layoutGrid() {
      var s = cellSizePx();
      grid.style.gridTemplateColumns = 'repeat(' + state.cols + ',' + s + 'px)';
      grid.style.gridTemplateRows = 'repeat(' + state.rows + ',' + s + 'px)';
    }

    function buildGrid() {
      grid.innerHTML = '';
      cellEls = [];
      for (var r = 0; r < state.rows; r++) {
        cellEls.push([]);
        for (var c = 0; c < state.cols; c++) {
          var cell = state.board[r][c];
          var btn;
          if (cell) {
            var glyph = ctx.el('span', { class: 'arrowsgo-glyph', html: arrowSVG(cell.dir) });
            var isEye = state.clawd && state.eyeSet && state.eyeSet[c + ',' + r];
            var extraClass = state.clawd ? (isEye ? ' clawd-eye' : ' clawd-body') : '';
            // non-Clawd: fill the tile with its direction colour (white arrow) so the
            // packed tiles read as a solid coloured silhouette. Clawd: classes set the fill.
            var cellStyle = state.clawd ? null : { '--ag-cell': DIRS[cell.dir].color, '--ag-fg': '#ffffff' };
            btn = ctx.el('button', {
              class: 'arrowsgo-cell arrow' + extraClass,
              type: 'button',
              style: cellStyle,
              'aria-label': '矢印',
              dataset: { c: String(c), r: String(r) }
            }, glyph);
            bindPull(btn, c, r);
          } else {
            btn = ctx.el('div', { class: 'arrowsgo-cell empty' });
          }
          cellEls[r].push(btn);
          grid.appendChild(btn);
        }
      }
      layoutGrid();
    }

    function bindPull(btn, c, r) {
      var fired = false;
      var startX = 0, startY = 0, downId = null, moved = false;
      // Record where the press began so we can tell a tap from a drag. The
      // board is intentionally scrollable (big Clawd stage), so we must NOT
      // preventDefault — instead we cancel the pull if the pointer moved far
      // enough to count as a scroll gesture, which keeps scrolling intact
      // while killing accidental pulls on touch release.
      on(btn, 'pointerdown', function (e) {
        downId = e.pointerId;
        startX = e.clientX; startY = e.clientY; moved = false;
      });
      on(btn, 'pointermove', function (e) {
        if (e.pointerId !== downId) return;
        if (Math.hypot(e.clientX - startX, e.clientY - startY) > 10) moved = true;
      });
      on(btn, 'pointercancel', function (e) { if (e.pointerId === downId) { downId = null; moved = false; } });
      // pointerup acts as the tap; guard against drags, double-fire & non-primary clicks
      on(btn, 'pointerup', function (e) {
        var wasDown = e.pointerId === downId;
        downId = null;
        if (e.button != null && e.button !== 0 && e.pointerType === 'mouse') return;
        // only the cell where the press began, and only if it wasn't a drag,
        // counts as a tap (a release after scrolling onto this cell is ignored)
        var far = Math.hypot(e.clientX - startX, e.clientY - startY) > 10;
        if (!wasDown || moved || far) { moved = false; return; }
        if (fired) return;
        fired = true;
        // release the guard shortly after so the same cell can't double-fire
        later(function () { fired = false; }, 60);
        tryPull(c, r, btn);
      });
      // prevent the synthetic click / context behavior
      on(btn, 'contextmenu', function (e) { e.preventDefault(); });
    }

    /* ----- the core pull action ----- */
    function tryPull(c, r, btn) {
      if (state.busy || state.over || destroyed) return;
      var cell = state.board[r][c];
      if (!cell) return;

      var clear = rayClear(state.cols, state.rows, c, r, cell.dir, function (qc, qr) {
        return !!state.board[qr][qc];
      });

      if (!clear) {
        // MISS
        ctx.sound.play('error');
        ctx.haptic(30);
        btn.classList.remove('miss');
        // force reflow so the animation restarts
        void btn.offsetWidth;
        btn.classList.add('miss');
        loseLife();
        return;
      }

      // PULL — animate sliding off the board in dir
      state.busy = true;
      ctx.sound.play('whoosh');
      ctx.haptic(12);
      var dir = cell.dir;
      var d = DIRS[dir];
      var size = cellSizePx();
      var travel = (dir === 'U' || dir === 'D' ? state.rows : state.cols) * (size + 8) + size;

      // clear data model immediately so further ray checks ignore this cell
      state.board[r][c] = null;

      btn.classList.add('pulling');
      // spawn a flying tile clone (matching this cell's colours) that slides off-board
      var fIsEye = state.clawd && state.eyeSet && state.eyeSet[c + ',' + r];
      var fFill = state.clawd ? (fIsEye ? '#22262f' : '#e8814e') : DIRS[dir].color;
      var fFg = state.clawd ? (fIsEye ? '#eef0f6' : '#5a2a08') : '#ffffff';
      var flyer = makeFlyer(btn, dir, size, fFill, fFg);
      if (flyer) {
        var dist = travel;
        later(function () {
          flyer.style.transform = 'translate(' + (d.tx * dist) + 'px,' + (d.ty * dist) + 'px) scale(.6)';
          flyer.style.opacity = '0';
        }, 16);
        later(function () { if (flyer.parentNode) flyer.parentNode.removeChild(flyer); }, 380);
      }

      later(function () {
        // convert the pulled button into an empty cell in place
        var fresh = ctx.el('div', { class: 'arrowsgo-cell empty' });
        fresh.style.fontSize = btn.style.fontSize;
        if (btn.parentNode) btn.parentNode.replaceChild(fresh, btn);
        cellEls[r][c] = fresh;
        ctx.sound.play('success');
        setRemaining(state.remaining - 1);
        state.busy = false;
        if (state.remaining <= 0) winStage();
      }, 300);
    }

    function makeFlyer(btn, dir, size, fillCol, fgCol) {
      var rect = btn.getBoundingClientRect();
      var wrapRect = boardWrap.getBoundingClientRect();
      var flyer = ctx.el('div', { class: 'arrowsgo-fly', html: '<span class="arrowsgo-glyph">' + arrowSVG(dir) + '</span>' });
      flyer.style.left = (rect.left - wrapRect.left + boardWrap.scrollLeft) + 'px';
      flyer.style.top = (rect.top - wrapRect.top + boardWrap.scrollTop) + 'px';
      flyer.style.width = size + 'px';
      flyer.style.height = size + 'px';
      // mirror the tile it came from (background) + its arrow colour (currentColor for the SVG)
      flyer.style.background = fillCol;
      flyer.style.color = fgCol;
      flyer.style.transition = 'transform .34s var(--spring),opacity .3s ease-out';
      boardWrap.appendChild(flyer);
      return flyer;
    }

    function loseLife() {
      state.lives = Math.max(0, state.lives - 1);
      renderLives();
      if (state.lives <= 0) {
        state.over = true;
        later(function () { gameOver(); }, 420);
      }
    }

    /* ----- hint ----- */
    function doHint() {
      if (state.busy || state.over || destroyed) return;
      var safe = findSafe(state.cols, state.rows, state.board);
      if (!safe) { ctx.toast('引き抜ける矢印が無いのだ…'); ctx.sound.play('error'); return; }
      var elc = cellEls[safe.r] && cellEls[safe.r][safe.c];
      if (!elc) return;
      ctx.sound.play('select');
      ctx.haptic(8);
      elc.classList.remove('hintpulse');
      void elc.offsetWidth;
      elc.classList.add('hintpulse');
      later(function () { if (elc) elc.classList.remove('hintpulse'); }, 1900);
    }

    /* ----- overlays ----- */
    function clearOverlay() {
      var ov = boardWrap.querySelector('.arrowsgo-overlay');
      if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    }

    function showOverlay(emoji, title, msg, buttons) {
      clearOverlay();
      var row = ctx.el('div', { class: 'row' });
      buttons.forEach(function (b) { row.appendChild(b); });
      var ov = ctx.el('div', { class: 'arrowsgo-overlay' },
        ctx.el('div', { class: 'em' }, emoji),
        ctx.el('h3', null, title),
        msg ? ctx.el('p', null, msg) : null,
        row
      );
      boardWrap.appendChild(ov);
    }

    function winStage() {
      state.busy = true;
      var isLast = state.stage >= LEVELS.length - 1;
      ctx.sound.play('win');
      ctx.haptic(24);
      // record progress
      var next = Math.min(LEVELS.length - 1, state.stage + 1);
      if (next > maxStage) { maxStage = next; prog.set(maxStage); }

      var buttons = [];
      if (!isLast) {
        buttons.push(ctx.el('button', {
          class: 'btn btn-primary squish', onClick: function () { ctx.sound.play('select'); clearOverlay(); loadStage(state.stage + 1); }
        }, '次のステージへ →'));
      } else {
        buttons.push(ctx.el('button', {
          class: 'btn btn-primary squish', onClick: function () { ctx.sound.play('select'); clearOverlay(); loadStage(0); }
        }, '最初から'));
      }
      buttons.push(ctx.el('button', {
        class: 'btn btn-ghost squish', onClick: function () { ctx.sound.play('back'); clearOverlay(); loadStage(state.stage); }
      }, 'もう一度'));

      var title = isLast ? '全ステージ クリア！' : 'ステージ クリア！';
      var msg = isLast ? 'すべての矢印を引き抜いたのだ。お見事なのだ！' : (state.clawd ? 'Clawd を救い出したのだ！' : 'みごと全部引き抜いたのだ！');
      later(function () { showOverlay(isLast ? '🏆' : '✨', title, msg, buttons); }, 320);
    }

    function gameOver() {
      ctx.sound.play('lose');
      ctx.haptic([20, 40, 20]);
      var retry = ctx.el('button', {
        class: 'btn btn-accent squish', onClick: function () { ctx.sound.play('select'); clearOverlay(); loadStage(state.stage); }
      }, '↻ もう一度');
      showOverlay('💀', 'ゲームオーバー', 'ライフが尽きたのだ。もう一度挑戦するのだ！', [retry]);
    }

    /* ----- stage loading ----- */
    function loadStage(idx) {
      clearOverlay();
      state.stage = Math.max(0, Math.min(LEVELS.length - 1, idx));
      var lv = LEVELS[state.stage];
      state.cols = lv.cols;
      state.rows = lv.rows;
      state.clawd = !!lv.clawd;
      state.eyeSet = {};
      lv.shapeCells.forEach(function (cell) { if (cell.eye) state.eyeSet[cell.c + ',' + cell.r] = true; });
      state.lives = 3;
      state.busy = false;
      state.over = false;

      // generate a guaranteed-solvable board; verify; retry a few times
      var board = null;
      for (var t = 0; t < 8 && !board; t++) {
        var cand = generate(lv.cols, lv.rows, lv.shapeCells);
        if (cand && verify(lv.cols, lv.rows, cand).solvable) board = cand;
      }
      if (!board) {
        // Extremely unlikely with the most-constrained-first generator, but
        // build a provably-solvable board by simulated removal as a safety net.
        board = fallbackBoard(lv.cols, lv.rows, lv.shapeCells);
      }
      state.board = board;

      // Final safety net: assert the board we are about to ship (whether it
      // came from the generator or the fallback) is actually solvable, so an
      // unsolvable level can never reach the player unnoticed.
      var vr = verify(lv.cols, lv.rows, board);
      console.assert(vr.solvable, '[arrowsgo] stage ' + state.stage + ' "' + lv.title + '" failed verification', board);

      var totalArrows = 0;
      for (var r = 0; r < state.rows; r++) for (var c = 0; c < state.cols; c++) if (state.board[r][c]) totalArrows++;

      stageLabel.innerHTML = '';
      stageLabel.append(
        document.createTextNode(lv.title),
        ctx.el('small', null, 'ステージ ' + (state.stage + 1) + ' / ' + LEVELS.length)
      );
      setRemaining(totalArrows);
      renderLives();
      buildGrid();
    }

    // Provably-solvable fallback (used only if generate() somehow fails all
    // retries). Simulate removal: repeatedly pick any still-present cell whose
    // ray to its nearest edge is clear of still-present cells, assign it that
    // direction, and mark it removed. The topmost-leftmost remaining cell
    // pointing at its nearest edge always qualifies, so the loop always
    // empties — the removal order IS a valid solution by construction.
    function fallbackBoard(cols, rows, cells) {
      var board = makeEmpty(cols, rows);
      var present = {};
      var key = function (c, r) { return c + ',' + r; };
      cells.forEach(function (cell) { present[key(cell.c, cell.r)] = cell; });
      var pending = cells.slice();
      var guard = cells.length + 5;
      while (pending.length && guard-- > 0) {
        var progressed = false;
        for (var i = 0; i < pending.length; i++) {
          var cell = pending[i];
          // try each direction, nearest edge first
          var dirsByLen = DIR_KEYS.slice().sort(function (a, b) {
            return rayCells(cols, rows, cell.c, cell.r, a).length - rayCells(cols, rows, cell.c, cell.r, b).length;
          });
          var chosen = null;
          for (var k = 0; k < dirsByLen.length; k++) {
            var dir = dirsByLen[k];
            var clear = rayClear(cols, rows, cell.c, cell.r, dir, function (qc, qr) {
              return !!present[key(qc, qr)];
            });
            if (clear) { chosen = dir; break; }
          }
          if (chosen) {
            board[cell.r][cell.c] = { dir: chosen };
            delete present[key(cell.c, cell.r)];
            pending.splice(i, 1);
            progressed = true;
            break;
          }
        }
        if (!progressed) break;
      }
      // Any cell that never got assigned (shouldn't happen) gets nearest edge.
      pending.forEach(function (cell) {
        if (!board[cell.r][cell.c]) {
          var best = 'U', bestLen = Infinity;
          DIR_KEYS.forEach(function (dir) {
            var len = rayCells(cols, rows, cell.c, cell.r, dir).length;
            if (len < bestLen) { bestLen = len; best = dir; }
          });
          board[cell.r][cell.c] = { dir: best };
        }
      });
      return board;
    }

    /* ----- responsive ----- */
    var ro = null;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(function () { if (!destroyed && state.board) layoutGrid(); });
      ro.observe(boardWrap);
    } else {
      on(window, 'resize', function () { if (!destroyed && state.board) layoutGrid(); });
    }

    // keyboard: H = hint, R = reset
    on(window, 'keydown', function (e) {
      if (destroyed) return;
      var k = (e.key || '').toLowerCase();
      if (k === 'h') { e.preventDefault(); doHint(); }
      else if (k === 'r') { e.preventDefault(); ctx.sound.play('back'); loadStage(state.stage); }
    });

    // kick off
    loadStage(state.stage);
    if (maxStage > 0) ctx.toast('ステージ ' + (state.stage + 1) + ' から再開なのだ');

    /* ----- cleanup ----- */
    mount._cleanup = function () {
      destroyed = true;
      timers.forEach(function (t) { clearTimeout(t); });
      timers = [];
      listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
      listeners = [];
      if (ro) { ro.disconnect(); ro = null; }
    };
  }

  Arcade.register({
    id: ID,
    category: 'game',
    title: 'Arrows GO',
    subtitle: '矢印を引き抜け',
    icon: '🧭',
    color: '#ff8a3d',
    order: 30,
    mount: mount,
    unmount: function () { if (mount._cleanup) mount._cleanup(); }
  });
})();
