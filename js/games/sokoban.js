/* ============================================================
   GAME — 倉庫番 (Sokoban)
   DOM CSS-grid puzzle. Push every crate onto a target.
   Arrow/WASD + swipe + on-screen D-pad. Undo / Reset / level-select.
   Mirrors js/tools/counter.js shape. See CONTRACT.md.
   ============================================================ */
(function () {
  'use strict';

  var ID = 'sokoban';

  /* ---------------- original, hand-designed levels ----------------
     All verified solvable via BFS during development.
     Symbols: # wall  (space) floor  @ player  + player-on-target
              $ box   * box-on-target  . target                      */
  var LEVELS = [
    // 1 — はじめの一歩 (push right)
    [
      '#######',
      '#     #',
      '# @$. #',
      '#     #',
      '#######'
    ],
    // 2 — 上へ
    [
      '#######',
      '#  .  #',
      '#  $  #',
      '#  @  #',
      '#     #',
      '#######'
    ],
    // 3 — 二つの箱
    [
      '########',
      '#.    .#',
      '#$    $#',
      '#  @   #',
      '########'
    ],
    // 4 — 壁を避けて
    [
      '########',
      '#      #',
      '# .$ . #',
      '# #$#  #',
      '# @ $. #',
      '#      #',
      '########'
    ],
    // 5 — ひしめく箱
    [
      '########',
      '#  .   #',
      '# .$.  #',
      '# $$$  #',
      '#  .@  #',
      '#      #',
      '########'
    ],
    // 6 — 四隅の倉庫
    [
      '#########',
      '#  .  . #',
      '# $ $   #',
      '#  @#   #',
      '# $ $   #',
      '#  .  . #',
      '#########'
    ],
    // 7 — 上下に分けて（最難関）
    [
      '#########',
      '#  ...  #',
      '#  $$$  #',
      '## # # ##',
      '#   @   #',
      '#  $ $  #',
      '#  . .  #',
      '#########'
    ]
  ];

  // tile codes
  var WALL = 1, FLOOR = 0; // base layer
  // dynamic: box positions set, target positions set, player position

  var CSS = [
    '.sokoban-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;padding:14px;width:100%;max-width:760px;margin:0 auto}',
    '.sokoban-top{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center;width:100%}',
    '.sokoban-stat{display:flex;gap:6px;align-items:baseline;background:var(--surface);border-radius:var(--r-pill);padding:6px 14px;box-shadow:var(--shadow-sm);font-weight:800;font-size:14px}',
    '.sokoban-stat b{font-size:18px;color:var(--blue);min-width:1.2em;text-align:right}',
    '.sokoban-stat.push b{color:var(--orange)}',
    '.sokoban-stat span{color:var(--muted);font-size:12px;font-weight:700}',
    '.sokoban-board{display:grid;gap:0;background:var(--surface-2);border-radius:var(--r-card);padding:8px;box-shadow:var(--shadow);touch-action:none;user-select:none;-webkit-user-select:none;max-width:100%}',
    '.sokoban-cell{position:relative;display:grid;place-items:center;font-size:22px;line-height:1}',
    '.sokoban-cell.wall{background:linear-gradient(160deg,#5b6478,#444c5e);border-radius:7px;box-shadow:inset 0 -3px 0 rgba(0,0,0,.18),inset 0 2px 0 rgba(255,255,255,.12)}',
    '.sokoban-cell.floor{background:transparent}',
    '.sokoban-cell .mark{position:absolute;width:34%;height:34%;border-radius:50%;background:radial-gradient(circle at 50% 40%,var(--teal),#13b3aa);box-shadow:0 0 0 4px rgba(31,211,201,.18);opacity:.9}',
    '.sokoban-obj{position:absolute;inset:8%;border-radius:9px;display:grid;place-items:center;font-size:inherit;transition:transform .12s var(--spring)}',
    '.sokoban-box{background:linear-gradient(155deg,#ffd27a,#ff9c3d);box-shadow:inset 0 -4px 0 rgba(150,70,0,.28),inset 0 3px 0 rgba(255,255,255,.45),var(--shadow-sm);border:2px solid rgba(150,70,0,.25)}',
    '.sokoban-box::before{content:"";position:absolute;inset:18%;border:2px dashed rgba(150,70,0,.35);border-radius:5px}',
    '.sokoban-box.on{background:linear-gradient(155deg,#bdff8e,#36d35a);border-color:rgba(20,120,40,.3);box-shadow:inset 0 -4px 0 rgba(20,110,40,.3),inset 0 3px 0 rgba(255,255,255,.5),0 0 14px 2px rgba(54,211,90,.6)}',
    '.sokoban-box.on::before{border-color:rgba(20,110,40,.4)}',
    '.sokoban-player{background:linear-gradient(155deg,#9ec2ff,#3d7bff);box-shadow:inset 0 -4px 0 rgba(20,50,140,.3),inset 0 3px 0 rgba(255,255,255,.5),var(--shadow-sm);font-size:80%;color:#fff}',
    '.sokoban-player.bump{transform:scale(.86)}',
    '.sokoban-player.on-target{box-shadow:inset 0 -4px 0 rgba(20,50,140,.3),inset 0 3px 0 rgba(255,255,255,.5),0 0 0 3px rgba(31,211,201,.85),0 0 12px 2px rgba(31,211,201,.55)}',
    '.sokoban-board.cleared .sokoban-box.on{animation:sokoban-pop .4s var(--spring)}',
    '@keyframes sokoban-pop{0%{transform:scale(1)}45%{transform:scale(1.22)}100%{transform:scale(1)}}',
    '.sokoban-ctrls{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:center;width:100%}',
    '.sokoban-dpad{display:grid;grid-template-columns:repeat(3,52px);grid-template-rows:repeat(3,52px);gap:6px}',
    '.sokoban-dpad button{border:none;border-radius:14px;background:var(--surface);box-shadow:var(--shadow-sm);font-size:22px;font-weight:800;color:var(--blue);display:grid;place-items:center;min-width:44px;min-height:44px}',
    '.sokoban-dpad .up{grid-area:1/2}.sokoban-dpad .left{grid-area:2/1}.sokoban-dpad .right{grid-area:2/3}.sokoban-dpad .down{grid-area:3/2}',
    '.sokoban-dpad .mid{grid-area:2/2;background:transparent;box-shadow:none;pointer-events:none}',
    '.sokoban-side{display:flex;flex-direction:column;gap:8px}',
    '.sokoban-side .btn{min-height:44px}',
    '.sokoban-levels{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;width:100%}',
    '.sokoban-lvl{min-width:44px;min-height:44px;border:none;border-radius:14px;background:var(--surface);box-shadow:var(--shadow-sm);font-weight:800;font-size:16px;color:var(--muted);display:grid;place-items:center;position:relative}',
    '.sokoban-lvl.active{background:var(--blue);color:#fff;box-shadow:0 6px 16px rgba(61,123,255,.45)}',
    '.sokoban-lvl.done::after{content:"\\2605";position:absolute;top:-6px;right:-6px;font-size:14px;color:var(--yellow);text-shadow:0 1px 2px rgba(0,0,0,.25)}',
    '.sokoban-lvl.locked{opacity:.4}',
    '.sokoban-hint{color:var(--muted);font-size:12px;font-weight:700;text-align:center}',
    '.sokoban-overlay{position:absolute;inset:0;display:grid;place-items:center;background:rgba(20,26,44,.42);backdrop-filter:blur(2px);border-radius:var(--r-card);opacity:0;pointer-events:none;transition:opacity .25s ease;z-index:5}',
    '.sokoban-overlay.show{opacity:1;pointer-events:auto}',
    '.sokoban-card{background:var(--surface);border-radius:var(--r-card);padding:22px 26px;box-shadow:var(--shadow-lg);text-align:center;display:flex;flex-direction:column;gap:12px;align-items:center;transform:scale(.85);transition:transform .3s var(--spring)}',
    '.sokoban-overlay.show .sokoban-card{transform:scale(1)}',
    '.sokoban-card h3{margin:0;font-size:24px}',
    '.sokoban-card .em{font-size:48px;line-height:1}',
    '.sokoban-card p{margin:0;color:var(--muted);font-weight:700;font-size:14px}',
    '.sokoban-stage{position:relative;width:100%;display:flex;justify-content:center}'
  ].join('');

  function mount(root, ctx) {
    ctx.injectCSS('game-' + ID, CSS);

    var progress = ctx.storage(ID + '-progress'); // max level index reached (0-based)
    var maxReached = Math.max(0, Math.min(LEVELS.length - 1, progress.get(0) | 0));
    var clearedStore = ctx.storage(ID + '-allcleared');
    var allCleared = clearedStore.get(false) === true;

    // ---- runtime state ----
    var grid = [];        // [r][c] WALL/FLOOR
    var targets = null;   // Set 'r,c'
    var boxes = null;     // Set 'r,c'
    var player = null;    // [r,c]
    var rows = 0, cols = 0;
    var history = [];     // stack of snapshots {boxes:[], player:[], moves, pushes}
    var moves = 0, pushes = 0;
    var levelIdx = 0;
    var cellNodes = [];   // [r][c] -> {cell, obj?}
    var solved = false;
    var advanceTimer = null;
    var bumpTimer = null;

    function k(r, c) { return r + ',' + c; }

    function parseLevel(def) {
      grid = []; targets = new Set(); boxes = new Set(); player = null;
      rows = def.length; cols = 0;
      def.forEach(function (line) { if (line.length > cols) cols = line.length; });
      for (var r = 0; r < rows; r++) {
        var line = def[r]; var gr = [];
        for (var c = 0; c < cols; c++) {
          var ch = c < line.length ? line[c] : ' ';
          gr.push(ch === '#' ? WALL : FLOOR);
          if (ch === '@' || ch === '+') player = [r, c];
          if (ch === '$' || ch === '*') boxes.add(k(r, c));
          if (ch === '.' || ch === '*' || ch === '+') targets.add(k(r, c));
        }
        grid.push(gr);
      }
    }

    function isWall(r, c) {
      return r < 0 || c < 0 || r >= rows || c >= cols || grid[r][c] === WALL;
    }

    // ---- DOM build ----
    var stage = ctx.el('div', { class: 'sokoban-stage' });
    var board = ctx.el('div', { class: 'sokoban-board' });
    var overlay = ctx.el('div', { class: 'sokoban-overlay' });
    var overlayCard = ctx.el('div', { class: 'sokoban-card' });
    overlay.appendChild(overlayCard);
    stage.append(board, overlay);

    var moveStat = ctx.el('b', null, '0');
    var pushStat = ctx.el('b', null, '0');
    var levelLabel = ctx.el('b', null, '1');
    var top = ctx.el('div', { class: 'sokoban-top' },
      ctx.el('div', { class: 'sokoban-stat' }, ctx.el('span', null, '面'), levelLabel),
      ctx.el('div', { class: 'sokoban-stat' }, ctx.el('span', null, '手数'), moveStat),
      ctx.el('div', { class: 'sokoban-stat push' }, ctx.el('span', null, '押し'), pushStat)
    );

    var hint = ctx.el('div', { class: 'sokoban-hint' },
      ctx.isTouch ? 'スワイプかDパッドで操作なのだ' : '矢印キー / WASD / スワイプ で操作なのだ');

    // D-pad
    function dirBtn(cls, label, dr, dc) {
      return ctx.el('button', {
        class: cls, 'aria-label': label, type: 'button',
        onPointerdown: function (e) { e.preventDefault(); move(dr, dc); }
      }, label);
    }
    var dpad = ctx.el('div', { class: 'sokoban-dpad' },
      dirBtn('up', '▲', -1, 0),
      dirBtn('left', '◀', 0, -1),
      ctx.el('div', { class: 'mid' }),
      dirBtn('right', '▶', 0, 1),
      dirBtn('down', '▼', 1, 0)
    );

    var undoBtn = ctx.el('button', { class: 'btn btn-ghost squish', type: 'button',
      onClick: function () { ctx.sound.play('back'); undo(); } }, '↶ もどす');
    var resetBtn = ctx.el('button', { class: 'btn btn-accent squish', type: 'button',
      onClick: function () { ctx.sound.play('whoosh'); loadLevel(levelIdx); } }, '⟳ やり直す');
    var side = ctx.el('div', { class: 'sokoban-side' }, undoBtn, resetBtn);

    var ctrls = ctx.el('div', { class: 'sokoban-ctrls' }, dpad, side);

    var levelBar = ctx.el('div', { class: 'sokoban-levels' });

    var wrap = ctx.el('div', { class: 'sokoban-wrap' }, top, stage, ctrls, levelBar, hint);
    root.appendChild(wrap);

    // ---- level select bar ----
    var lvlButtons = [];
    function buildLevelBar() {
      levelBar.innerHTML = ''; lvlButtons = [];
      for (var i = 0; i < LEVELS.length; i++) {
        (function (i) {
          var locked = i > maxReached;
          var b = ctx.el('button', {
            class: 'sokoban-lvl' + (i < maxReached ? ' done' : '') + (locked ? ' locked' : ''),
            type: 'button',
            onClick: function () {
              if (i > maxReached) { ctx.sound.play('error'); ctx.toast('まだ開いてないのだ'); return; }
              ctx.sound.play('select'); loadLevel(i);
            }
          }, String(i + 1));
          lvlButtons.push(b);
          levelBar.appendChild(b);
        })(i);
      }
    }
    function refreshLevelBar() {
      var last = LEVELS.length - 1;
      for (var i = 0; i < lvlButtons.length; i++) {
        var b = lvlButtons[i];
        b.classList.toggle('active', i === levelIdx);
        b.classList.toggle('done', i < maxReached || (i === last && allCleared));
        b.classList.toggle('locked', i > maxReached);
      }
    }

    // ---- render board structure for current level ----
    function buildBoard() {
      board.classList.remove('cleared');
      board.innerHTML = '';
      cellNodes = [];
      // square cell sizing: fit width AND height of available stage
      board.style.gridTemplateColumns = 'repeat(' + cols + ', var(--soko-cell))';
      board.style.gridTemplateRows = 'repeat(' + rows + ', var(--soko-cell))';
      for (var r = 0; r < rows; r++) {
        var row = [];
        for (var c = 0; c < cols; c++) {
          var wall = grid[r][c] === WALL;
          var cell = ctx.el('div', { class: 'sokoban-cell ' + (wall ? 'wall' : 'floor') });
          board.appendChild(cell);
          row.push({ cell: cell, obj: null });
        }
        cellNodes.push(row);
      }
      sizeBoard();
      paintAll();
    }

    // ---- compute cell size so board fits the stage box ----
    function sizeBoard() {
      // available area: wrap width minus padding, and a reasonable height budget
      var availW = (stage.clientWidth || wrap.clientWidth || 320) - 16; // board padding 8*2
      var maxW = Math.min(availW, 560);
      var byW = Math.floor(maxW / cols);
      // height budget: viewport height minus controls; keep cells reasonable
      var budgetH = Math.max(180, (window.innerHeight || 640) - 360);
      var byH = Math.floor(budgetH / rows);
      var size = Math.max(28, Math.min(64, Math.min(byW, byH)));
      board.style.setProperty('--soko-cell', size + 'px');
      board.style.fontSize = Math.round(size * 0.6) + 'px';
    }

    // ---- paint dynamic objects ----
    function clearObjs() {
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
        var n = cellNodes[r][c];
        if (n.obj) { n.obj.remove(); n.obj = null; }
        if (n._player) { n._player = null; }
        // mark for targets
        var existingMark = n.cell.querySelector('.mark');
        if (existingMark) existingMark.remove();
      }
    }
    function paintAll() {
      clearObjs();
      // targets first (as marks under objects)
      targets.forEach(function (key) {
        var p = key.split(','); var r = +p[0], c = +p[1];
        var n = cellNodes[r][c];
        if (!n) return;
        n.cell.appendChild(ctx.el('div', { class: 'mark' }));
      });
      // boxes
      boxes.forEach(function (key) {
        var p = key.split(','); var r = +p[0], c = +p[1];
        var n = cellNodes[r][c]; if (!n) return;
        var on = targets.has(key);
        var box = ctx.el('div', { class: 'sokoban-obj sokoban-box' + (on ? ' on' : '') }, '📦');
        n.cell.appendChild(box); n.obj = box;
      });
      // player
      var pr = player[0], pc = player[1];
      var pn = cellNodes[pr][pc];
      if (pn) {
        var onT = targets.has(k(pr, pc));
        var pl = ctx.el('div', { class: 'sokoban-player sokoban-obj' + (onT ? ' on-target' : '') }, '🐻');
        pn.cell.appendChild(pl); pn.obj = pl; pn._player = pl;
      }
      moveStat.textContent = String(moves);
      pushStat.textContent = String(pushes);
    }

    // ---- snapshot for undo ----
    function snapshot() {
      history.push({
        boxes: Array.from(boxes),
        player: [player[0], player[1]],
        moves: moves, pushes: pushes
      });
      // cap history to avoid unbounded growth
      if (history.length > 2000) history.shift();
      undoBtn.disabled = false;
    }
    function undo() {
      if (solved) return;
      if (!history.length) { ctx.toast('これ以上もどせないのだ'); return; }
      var s = history.pop();
      boxes = new Set(s.boxes);
      player = s.player.slice();
      moves = s.moves; pushes = s.pushes;
      paintAll();
      undoBtn.disabled = history.length === 0;
    }

    // ---- core movement ----
    function bumpPlayer() {
      var pn = cellNodes[player[0]] && cellNodes[player[0]][player[1]];
      var pl = pn && pn._player;
      if (pl) {
        pl.classList.add('bump');
        clearTimeout(bumpTimer);
        bumpTimer = setTimeout(function () { pl.classList.remove('bump'); }, 130);
      }
    }

    function move(dr, dc) {
      if (solved) return;
      var nr = player[0] + dr, nc = player[1] + dc;
      if (isWall(nr, nc)) { ctx.sound.play('error'); ctx.haptic(6); bumpPlayer(); return; }
      var nk = k(nr, nc);
      if (boxes.has(nk)) {
        // try to push box one further
        var br = nr + dr, bc = nc + dc;
        if (isWall(br, bc) || boxes.has(k(br, bc))) {
          ctx.sound.play('error'); ctx.haptic(6); bumpPlayer(); return;
        }
        // valid push
        snapshot();
        boxes.delete(nk);
        var bk2 = k(br, bc);
        boxes.add(bk2);
        player = [nr, nc];
        moves++; pushes++;
        ctx.sound.play(targets.has(bk2) ? 'coin' : 'move');
        ctx.haptic(10);
        paintAll();
        checkWin();
        return;
      }
      // plain move into floor
      snapshot();
      player = [nr, nc];
      moves++;
      ctx.sound.play('move');
      ctx.haptic(4);
      paintAll();
    }

    function isWin() {
      for (var key of targets) { if (!boxes.has(key)) return false; }
      // also ensure all boxes are on targets (counts equal so this is equivalent)
      return boxes.size === targets.size;
    }

    function checkWin() {
      if (!isWin()) return;
      solved = true;
      board.classList.add('cleared');
      ctx.sound.play('win');
      ctx.haptic(30);
      // unlock next level
      var isLast = levelIdx >= LEVELS.length - 1;
      if (!isLast && levelIdx + 1 > maxReached) {
        maxReached = levelIdx + 1;
        progress.set(maxReached);
      }
      if (isLast && levelIdx > maxReached) { maxReached = levelIdx; progress.set(maxReached); }
      if (isLast) { allCleared = true; clearedStore.set(true); }
      refreshLevelBar();
      showOverlay(isLast);
    }

    function showOverlay(isLast) {
      overlayCard.innerHTML = '';
      overlayCard.append(
        ctx.el('div', { class: 'em' }, isLast ? '🏆' : '🎉'),
        ctx.el('h3', null, isLast ? '全クリアなのだ！' : 'クリアなのだ！'),
        ctx.el('p', null, '手数 ' + moves + ' ・ 押し ' + pushes)
      );
      var btnRow = ctx.el('div', { class: 'sokoban-ctrls' });
      if (isLast) {
        btnRow.appendChild(ctx.el('button', { class: 'btn btn-primary squish', type: 'button',
          onClick: function () { ctx.sound.play('select'); hideOverlay(); loadLevel(0); } }, 'もう一度'));
      } else {
        btnRow.appendChild(ctx.el('button', { class: 'btn btn-ghost squish', type: 'button',
          onClick: function () { ctx.sound.play('select'); hideOverlay(); loadLevel(levelIdx); } }, 'リプレイ'));
        btnRow.appendChild(ctx.el('button', { class: 'btn btn-green squish', type: 'button',
          onClick: function () { ctx.sound.play('select'); clearTimeout(advanceTimer); hideOverlay(); loadLevel(levelIdx + 1); } }, '次の面 →'));
      }
      overlayCard.appendChild(btnRow);
      overlay.classList.add('show');
      if (!isLast) {
        clearTimeout(advanceTimer);
        advanceTimer = setTimeout(function () {
          ctx.sound.play('success');
          hideOverlay();
          loadLevel(levelIdx + 1);
        }, 1700);
      }
    }
    function hideOverlay() { overlay.classList.remove('show'); }

    // ---- load a level ----
    function loadLevel(idx) {
      clearTimeout(advanceTimer);
      idx = Math.max(0, Math.min(LEVELS.length - 1, idx));
      levelIdx = idx;
      solved = false;
      moves = 0; pushes = 0;
      history = [];
      undoBtn.disabled = true;
      parseLevel(LEVELS[idx]);
      buildBoard();
      levelLabel.textContent = String(idx + 1);
      hideOverlay();
      refreshLevelBar();
    }

    // ---- input: keyboard ----
    function onKey(e) {
      var dr = 0, dc = 0, hit = false;
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W': dr = -1; hit = true; break;
        case 'ArrowDown': case 's': case 'S': dr = 1; hit = true; break;
        case 'ArrowLeft': case 'a': case 'A': dc = -1; hit = true; break;
        case 'ArrowRight': case 'd': case 'D': dc = 1; hit = true; break;
        case 'z': case 'Z': e.preventDefault(); ctx.sound.play('back'); undo(); return;
        case 'r': case 'R': e.preventDefault(); ctx.sound.play('whoosh'); loadLevel(levelIdx); return;
      }
      if (hit) { e.preventDefault(); move(dr, dc); }
    }

    // ---- input: swipe via Pointer Events on the board ----
    var swipe = { active: false, x: 0, y: 0, id: -1 };
    function onPointerDown(e) {
      // ignore d-pad/button presses (they handle their own)
      swipe.active = true; swipe.x = e.clientX; swipe.y = e.clientY; swipe.id = e.pointerId;
      try { board.setPointerCapture(e.pointerId); } catch (err) {}
    }
    function onPointerMove(e) {
      if (!swipe.active || e.pointerId !== swipe.id) return;
      e.preventDefault(); // block page scroll during play
    }
    function onPointerUp(e) {
      if (!swipe.active || e.pointerId !== swipe.id) return;
      swipe.active = false;
      try { board.releasePointerCapture(e.pointerId); } catch (err) {}
      var dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
      var ax = Math.abs(dx), ay = Math.abs(dy);
      var TH = 22;
      if (ax < TH && ay < TH) return; // treat as tap, no move
      if (ax > ay) move(0, dx > 0 ? 1 : -1);
      else move(dy > 0 ? 1 : -1, 0);
    }
    function onPointerCancel(e) {
      if (e.pointerId === swipe.id) swipe.active = false;
    }

    // ---- resize ----
    var resizeRAF = null;
    function onResize() {
      if (resizeRAF) return;
      resizeRAF = requestAnimationFrame(function () {
        resizeRAF = null;
        if (cellNodes.length) sizeBoard();
      });
    }

    // ---- wire listeners ----
    window.addEventListener('keydown', onKey);
    board.addEventListener('pointerdown', onPointerDown);
    board.addEventListener('pointermove', onPointerMove, { passive: false });
    board.addEventListener('pointerup', onPointerUp);
    board.addEventListener('pointercancel', onPointerCancel);
    window.addEventListener('resize', onResize);

    var ro = null;
    var observeRAF = null;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(onResize);
      observeRAF = requestAnimationFrame(function () {
        observeRAF = null;
        try { if (ro) ro.observe(stage); } catch (e) {}
      });
    }

    // start at the highest unlocked level (latest progress)
    buildLevelBar();
    loadLevel(maxReached);

    // ---- cleanup ----
    mount._cleanup = function () {
      window.removeEventListener('keydown', onKey);
      board.removeEventListener('pointerdown', onPointerDown);
      board.removeEventListener('pointermove', onPointerMove);
      board.removeEventListener('pointerup', onPointerUp);
      board.removeEventListener('pointercancel', onPointerCancel);
      window.removeEventListener('resize', onResize);
      if (ro) { try { ro.disconnect(); } catch (e) {} ro = null; }
      if (observeRAF) { cancelAnimationFrame(observeRAF); observeRAF = null; }
      if (resizeRAF) { cancelAnimationFrame(resizeRAF); resizeRAF = null; }
      clearTimeout(advanceTimer); advanceTimer = null;
      clearTimeout(bumpTimer); bumpTimer = null;
    };
  }

  Arcade.register({
    id: ID,
    category: 'game',
    title: '倉庫番',
    subtitle: '箱を全部置き場へ',
    icon: '📦',
    color: '#3d7bff',
    order: 40,
    mount: mount,
    unmount: function () { if (mount._cleanup) mount._cleanup(); }
  });
})();
