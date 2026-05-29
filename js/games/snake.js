/* ============================================================
   GAME — ヘビ (Snake)  canvas grid game
   Mirrors js/tools/counter.js shape. See CONTRACT.md.
   ============================================================ */
(function () {
  'use strict';

  var CSS = [
    '.snake-pane{flex:1 1 auto;display:flex;flex-direction:column;min-height:0;gap:10px;padding:12px;width:100%;max-width:760px;margin:0 auto}',
    '.snake-hud{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap}',
    '.snake-chip{display:inline-flex;align-items:center;gap:7px;background:var(--surface);border-radius:var(--r-pill);padding:7px 14px;box-shadow:var(--shadow-sm);font-weight:800;font-size:15px;border-left:5px solid var(--accent,#2fcf72)}',
    '.snake-chip span{font-size:11px;color:var(--muted);font-weight:700;letter-spacing:.04em}',
    '.snake-chip b{font-size:18px;font-variant-numeric:tabular-nums;min-width:1.2em;text-align:right}',
    '.snake-field{flex:1 1 auto;display:flex;align-items:center;justify-content:center;min-height:0;position:relative}',
    '.snake-stage{position:absolute;inset:0;border-radius:var(--r-card);overflow:hidden;box-shadow:var(--shadow),inset 0 2px 0 rgba(255,255,255,.4);background:linear-gradient(160deg,#eafbf0,#e3f3ff)}',
    '.snake-canvas{display:block;width:100%;height:100%;touch-action:none;cursor:pointer}',
    '.snake-overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:18px;background:rgba(20,32,52,.46);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);opacity:0;visibility:hidden;transition:opacity .22s var(--spring)}',
    '.snake-overlay.show{opacity:1;visibility:visible}',
    '.snake-card{background:var(--surface);border-radius:var(--r-card);padding:20px 22px;box-shadow:var(--shadow-lg);max-width:300px;display:flex;flex-direction:column;align-items:center;gap:10px;animation:snake-pop .3s var(--spring)}',
    '@keyframes snake-pop{from{transform:scale(.82);opacity:0}to{transform:scale(1);opacity:1}}',
    '.snake-card h3{margin:0;font-size:26px;font-weight:900;letter-spacing:.02em}',
    '.snake-card p{margin:0;color:var(--muted);font-weight:700;font-size:14px;line-height:1.5}',
    '.snake-scores{display:flex;gap:18px;justify-content:center}',
    '.snake-scores div{display:flex;flex-direction:column;gap:2px}',
    '.snake-scores small{font-size:11px;color:var(--muted);font-weight:800;letter-spacing:.05em}',
    '.snake-scores b{font-size:28px;font-weight:900;font-variant-numeric:tabular-nums;line-height:1}',
    '.snake-pad{display:grid;grid-template-columns:repeat(3,minmax(54px,68px));grid-template-rows:repeat(3,minmax(54px,68px));gap:8px;justify-content:center;align-self:center;touch-action:manipulation}',
    '.snake-pad button{border:none;border-radius:var(--r-btn);background:var(--surface);box-shadow:var(--shadow-sm),inset 0 2px 0 rgba(255,255,255,.5);font-size:24px;font-weight:900;color:#2c3550;display:flex;align-items:center;justify-content:center;-webkit-user-select:none;user-select:none;touch-action:manipulation;transition:transform .1s var(--spring),filter .12s}',
    '.snake-pad button:active{transform:scale(.9);filter:brightness(.94)}',
    '.snake-pad .snake-up{grid-column:2;grid-row:1}',
    '.snake-pad .snake-left{grid-column:1;grid-row:2}',
    '.snake-pad .snake-right{grid-column:3;grid-row:2}',
    '.snake-pad .snake-down{grid-column:2;grid-row:3}',
    '.snake-pad .snake-mid{grid-column:2;grid-row:2;background:var(--surface-2);box-shadow:none;font-size:18px;color:var(--muted)}',
    '.snake-hint{text-align:center;color:var(--muted);font-size:12px;font-weight:700}',
    '@media (min-width:760px){.snake-hint-touch{display:none}}'
  ].join('');

  // direction vectors
  var DIRS = {
    up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
    left: { x: -1, y: 0 }, right: { x: 1, y: 0 }
  };

  function mount(root, ctx) {
    ctx.injectCSS('game-snake', CSS);

    var bestStore = ctx.storage('snake-best');
    var best = Number(bestStore.get(0)) || 0;

    /* ---------------- DOM ---------------- */
    var scoreB = ctx.el('b', null, '0');
    var bestB = ctx.el('b', null, String(best));
    var hud = ctx.el('div', { class: 'snake-hud' },
      ctx.el('div', { class: 'snake-chip', style: { '--accent': 'var(--green)' } }, ctx.el('span', null, 'スコア'), scoreB),
      ctx.el('div', { class: 'snake-chip', style: { '--accent': 'var(--orange)' } }, ctx.el('span', null, 'ベスト'), bestB)
    );

    var canvas = ctx.el('canvas', { class: 'snake-canvas' });
    var stage = ctx.el('div', { class: 'snake-stage' }, canvas);
    var overlay = ctx.el('div', { class: 'snake-overlay' });
    stage.appendChild(overlay);
    var field = ctx.el('div', { class: 'snake-field' }, stage);

    function padBtn(cls, glyph, dir) {
      return ctx.el('button', {
        class: cls, 'aria-label': dir, type: 'button',
        onPointerdown: function (e) {
          e.preventDefault();
          ctx.haptic(6);
          // D-pad sits outside the overlay, so a tap while paused starts a round.
          if (paused) { startRound(); return; }
          queueDir(dir);
        }
      }, glyph);
    }
    var pad = ctx.el('div', { class: 'snake-pad' },
      padBtn('snake-up', '▲', 'up'),
      padBtn('snake-left', '◀', 'left'),
      ctx.el('div', { class: 'snake-mid' }, '🐍'),
      padBtn('snake-right', '▶', 'right'),
      padBtn('snake-down', '▼', 'down')
    );

    var hint = ctx.el('div', { class: 'snake-hint snake-hint-touch' }, 'スワイプ / Dパッドで操作するのだ');

    root.appendChild(ctx.el('div', { class: 'snake-pane' }, hud, field, pad, hint));

    /* ---------------- state ---------------- */
    var cols = 20, rows = 20;        // recomputed on resize
    var cell = 16;                   // px size of a cell (CSS px)
    var snake = [];                  // array of {x,y}, head at index 0
    var dir = DIRS.right;            // current heading
    var queue = [];                  // queued direction changes
    var food = { x: 0, y: 0 };
    var score = 0;
    var alive = false;               // is a round in progress
    var paused = true;               // paused while an overlay is shown
    var baseTick = 150;              // ms per step at start
    var tick = baseTick;
    var minTick = 65;
    var acc = 0;                     // ms accumulator
    var lastTs = 0;
    var rafId = 0;
    var growFlash = 0;               // animation pulse on eat (0..1)
    var fit = null;

    var offX = 0, offY = 0;           // centering offset of the grid within the canvas
    /* ---------------- grid sizing ---------------- */
    function layoutGrid(fw, fh) {
      // Grid fills the canvas (which fills the stage/field). Pick a cell size
      // that yields ~20 cells on the shorter side; the longer side gets more.
      var avail = Math.max(80, Math.min(fw, fh));
      var target = 20;
      cell = Math.max(14, Math.floor(avail / target));
      cols = Math.max(12, Math.min(26, Math.floor(fw / cell)));
      rows = Math.max(12, Math.min(26, Math.floor(fh / cell)));
      // center the grid; any leftover px become an even margin
      offX = Math.floor((fw - cols * cell) / 2);
      offY = Math.floor((fh - rows * cell) / 2);
    }

    /* ---------------- helpers ---------------- */
    function occupied(x, y) {
      for (var i = 0; i < snake.length; i++) {
        if (snake[i].x === x && snake[i].y === y) return true;
      }
      return false;
    }
    function clampSnake() {
      // if a resize shrank the grid, nudge segments back in-bounds so the
      // snake never spawns a guaranteed wall-death on the next tick.
      for (var i = 0; i < snake.length; i++) {
        if (snake[i].x >= cols) snake[i].x = cols - 1;
        if (snake[i].y >= rows) snake[i].y = rows - 1;
        if (snake[i].x < 0) snake[i].x = 0;
        if (snake[i].y < 0) snake[i].y = 0;
      }
    }
    function placeFood() {
      var open = cols * rows - snake.length;
      if (open <= 0) return;
      var idx = Math.floor(Math.random() * open);
      var c = 0;
      for (var y = 0; y < rows; y++) {
        for (var x = 0; x < cols; x++) {
          if (occupied(x, y)) continue;
          if (c === idx) { food.x = x; food.y = y; return; }
          c++;
        }
      }
    }

    function reset() {
      var cx = Math.floor(cols / 2), cy = Math.floor(rows / 2);
      snake = [
        { x: cx, y: cy }, { x: cx - 1, y: cy }, { x: cx - 2, y: cy }
      ];
      dir = DIRS.right;
      queue = [];
      score = 0;
      tick = baseTick;
      acc = 0;
      growFlash = 0;
      scoreB.textContent = '0';
      placeFood();
    }

    function queueDir(name) {
      var nd = DIRS[name];
      if (!nd) return;
      // compare against the last *queued* (or current) heading to avoid reversal
      var ref = queue.length ? queue[queue.length - 1] : dir;
      if (nd.x === -ref.x && nd.y === -ref.y) return; // can't reverse
      if (nd.x === ref.x && nd.y === ref.y) return;   // no change
      if (queue.length < 2) {
        queue.push(nd);
        if (alive && !paused) ctx.sound.play('move');
      }
    }

    function step() {
      if (queue.length) dir = queue.shift();
      var head = snake[0];
      var nx = head.x + dir.x, ny = head.y + dir.y;

      // wall collision
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) { die(); return; }
      // self collision (tail tip will move away unless we are growing)
      var eating = (nx === food.x && ny === food.y);
      var checkLen = eating ? snake.length : snake.length - 1;
      for (var i = 0; i < checkLen; i++) {
        if (snake[i].x === nx && snake[i].y === ny) { die(); return; }
      }

      snake.unshift({ x: nx, y: ny });
      if (eating) {
        score++;
        scoreB.textContent = String(score);
        growFlash = 1;
        ctx.sound.play('coin');
        ctx.haptic(10);
        tick = Math.max(minTick, baseTick - score * 3);
        placeFood();
        if (score > best) { best = score; bestB.textContent = String(best); bestStore.set(best); }
      } else {
        snake.pop();
      }
    }

    function die() {
      alive = false;
      paused = true;
      ctx.sound.play('lose');
      ctx.haptic([14, 40, 14]);
      if (score > best) { best = score; bestB.textContent = String(best); bestStore.set(best); }
      showOver();
    }

    /* ---------------- overlays ---------------- */
    function clearOverlay() {
      overlay.classList.remove('show');
      while (overlay.firstChild) overlay.removeChild(overlay.firstChild);
    }
    function showStart() {
      paused = true;
      clearOverlay();
      overlay.appendChild(ctx.el('div', { class: 'snake-card' },
        ctx.el('h3', null, '🐍 ヘビ'),
        ctx.el('p', { html: 'リンゴを食べて伸ばすのだ。<br>壁と自分にぶつかると終わりなのだ。' }),
        ctx.el('button', {
          class: 'btn btn-green squish', type: 'button',
          onClick: function () { startRound(); }
        }, 'スタート')
      ));
      overlay.classList.add('show');
      draw(); // show idle board behind overlay
    }
    function showOver() {
      clearOverlay();
      overlay.appendChild(ctx.el('div', { class: 'snake-card' },
        ctx.el('h3', null, 'ゲームオーバー'),
        ctx.el('div', { class: 'snake-scores' },
          ctx.el('div', null, ctx.el('small', null, 'スコア'), ctx.el('b', null, String(score))),
          ctx.el('div', null, ctx.el('small', null, 'ベスト'), ctx.el('b', null, String(best)))
        ),
        ctx.el('button', {
          class: 'btn btn-primary squish', type: 'button',
          onClick: function () { startRound(); }
        }, 'もう一度')
      ));
      overlay.classList.add('show');
      draw();
    }
    function startRound() {
      reset();
      clearOverlay();
      alive = true;
      paused = false;
      lastTs = 0;
      acc = 0;
      ctx.sound.play('success');
      ctx.haptic(12);
    }

    /* ---------------- rendering ---------------- */
    function rounded(c, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      c.beginPath();
      c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r);
      c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r);
      c.arcTo(x, y, x + w, y, r);
      c.closePath();
    }

    function draw() {
      if (!fit) return;
      var c = canvas.getContext('2d');
      if (!c) return;
      c.clearRect(0, 0, fit.w, fit.h);
      c.save();
      c.translate(offX, offY); // center the grid within the canvas

      // subtle checker grid
      for (var gy = 0; gy < rows; gy++) {
        for (var gx = 0; gx < cols; gx++) {
          c.fillStyle = ((gx + gy) % 2 === 0) ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.28)';
          c.fillRect(gx * cell, gy * cell, cell, cell);
        }
      }

      // food: fruit-like circle with leaf + shine
      var fcx = food.x * cell + cell / 2, fcy = food.y * cell + cell / 2;
      var fr = cell * 0.36;
      c.save();
      c.shadowColor = 'rgba(220,40,60,.35)';
      c.shadowBlur = cell * 0.4;
      c.fillStyle = '#ff4d57';
      c.beginPath(); c.arc(fcx, fcy, fr, 0, Math.PI * 2); c.fill();
      c.restore();
      c.fillStyle = '#46c46a';
      c.beginPath();
      c.ellipse(fcx + fr * 0.5, fcy - fr * 0.85, fr * 0.4, fr * 0.22, -0.7, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,.7)';
      c.beginPath();
      c.arc(fcx - fr * 0.3, fcy - fr * 0.3, fr * 0.22, 0, Math.PI * 2);
      c.fill();

      // snake body: rounded gradient segments, drawn tail->head
      var n = snake.length;
      var inset = Math.max(1, cell * 0.08);
      for (var i = n - 1; i >= 0; i--) {
        var s = snake[i];
        var t = n > 1 ? i / (n - 1) : 0; // 0 head .. 1 tail
        var sz = cell - inset * 2;
        // body gradient: bright green head -> teal tail
        var head1 = [86, 222, 130], tail1 = [38, 178, 168];
        var rr = Math.round(head1[0] + (tail1[0] - head1[0]) * t);
        var gg = Math.round(head1[1] + (tail1[1] - head1[1]) * t);
        var bb = Math.round(head1[2] + (tail1[2] - head1[2]) * t);
        var px = s.x * cell + inset, py = s.y * cell + inset;
        var grad = c.createLinearGradient(px, py, px, py + sz);
        grad.addColorStop(0, 'rgb(' + Math.min(255, rr + 30) + ',' + Math.min(255, gg + 30) + ',' + Math.min(255, bb + 30) + ')');
        grad.addColorStop(1, 'rgb(' + rr + ',' + gg + ',' + bb + ')');
        c.fillStyle = grad;
        var radius = cell * 0.42;
        var grow = (i === 0 && growFlash > 0) ? (1 + growFlash * 0.06) : 1;
        var off = (sz * grow - sz) / 2;
        rounded(c, px - off, py - off, sz * grow, sz * grow, radius);
        c.fill();
        if (i !== 0) {
          // soft top highlight on body
          c.fillStyle = 'rgba(255,255,255,.18)';
          rounded(c, px, py, sz, sz * 0.42, radius * 0.8);
          c.fill();
        }
      }

      // head detail: eyes + tongue facing dir
      var hh = snake[0];
      var hx = hh.x * cell + cell / 2, hy = hh.y * cell + cell / 2;
      var dx = dir.x, dy = dir.y;
      var perpX = -dy, perpY = dx;
      var eyeOff = cell * 0.18, eyeFwd = cell * 0.12, eyeR = cell * 0.11;
      [1, -1].forEach(function (sgn) {
        var ex = hx + dx * eyeFwd + perpX * eyeOff * sgn;
        var ey = hy + dy * eyeFwd + perpY * eyeOff * sgn;
        c.fillStyle = '#fff';
        c.beginPath(); c.arc(ex, ey, eyeR, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#1b2540';
        c.beginPath(); c.arc(ex + dx * eyeR * 0.4, ey + dy * eyeR * 0.4, eyeR * 0.55, 0, Math.PI * 2); c.fill();
      });

      c.restore();
    }

    /* ---------------- loop ---------------- */
    function frame(ts) {
      rafId = requestAnimationFrame(frame);
      if (!lastTs) lastTs = ts;
      var dt = ts - lastTs;
      lastTs = ts;
      if (growFlash > 0) growFlash = Math.max(0, growFlash - dt / 180);

      if (!paused && alive) {
        acc += dt;
        // guard against huge dt (tab switch) so we don't fast-forward to death
        if (acc > tick * 4) acc = tick;
        while (acc >= tick) {
          acc -= tick;
          step();
          if (!alive) break;
        }
      }
      draw();
    }

    /* ---------------- input: keyboard ---------------- */
    var KEYMAP = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right'
    };
    function onKey(e) {
      var name = KEYMAP[e.code];
      if (name) {
        e.preventDefault();
        if (paused) { startRound(); return; } // first arrow/WASD also starts a round
        queueDir(name);
        return;
      }
      if ((e.code === 'Space' || e.code === 'Enter') && paused) {
        e.preventDefault();
        startRound();
      }
    }

    /* ---------------- input: swipe on canvas ---------------- */
    var swipe = { active: false, id: -1, x0: 0, y0: 0 };
    var SWIPE_MIN = 22;
    function onPointerDown(e) {
      if (e.button != null && e.button !== 0 && e.pointerType === 'mouse') return;
      swipe.active = true; swipe.id = e.pointerId;
      swipe.x0 = e.clientX; swipe.y0 = e.clientY;
      // keep receiving move/up even if the drag leaves the canvas bounds
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    }
    function onPointerMove(e) {
      if (!swipe.active || e.pointerId !== swipe.id) return;
      e.preventDefault();
      var dx = e.clientX - swipe.x0, dy = e.clientY - swipe.y0;
      if (Math.abs(dx) < SWIPE_MIN && Math.abs(dy) < SWIPE_MIN) return;
      if (Math.abs(dx) > Math.abs(dy)) queueDir(dx > 0 ? 'right' : 'left');
      else queueDir(dy > 0 ? 'down' : 'up');
      // reset origin so a continued drag can trigger another turn
      swipe.x0 = e.clientX; swipe.y0 = e.clientY;
    }
    function onPointerUp(e) {
      if (e.pointerId !== swipe.id) return;
      var dx = e.clientX - swipe.x0, dy = e.clientY - swipe.y0;
      var moved = Math.abs(dx) + Math.abs(dy);
      // a tap (no swipe) while paused starts the round
      if (moved < 8 && paused) startRound();
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
      swipe.active = false; swipe.id = -1;
    }

    /* ---------------- wiring ---------------- */
    fit = ctx.fitCanvas(canvas, function (f) {
      // Canvas fills the stage; size the grid from the canvas CSS px (f.w/f.h).
      // No DOM mutation here, so there is no ResizeObserver feedback loop.
      layoutGrid(f.w, f.h);
      // keep food/snake in bounds after a resize
      if (food.x >= cols || food.y >= rows) placeFood();
      clampSnake();
      draw();
    });

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('keydown', onKey);

    reset();
    showStart();
    rafId = requestAnimationFrame(frame);

    /* ---------------- cleanup ---------------- */
    mount._cleanup = function () {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      if (fit && fit.stop) fit.stop();
      fit = null;
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('keydown', onKey);
      alive = false;
      paused = true;
    };
  }

  Arcade.register({
    id: 'snake',
    category: 'game',
    title: 'ヘビ',
    subtitle: '伸ばして高得点',
    icon: '🐍',
    color: '#2fcf72',
    order: 20,
    mount: mount,
    unmount: function () { if (mount._cleanup) mount._cleanup(); }
  });
})();
