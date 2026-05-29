/* ============================================================
   GAME — ブロック崩し (Breakout)  — canvas game module
   See CONTRACT.md. Mirrors js/tools/counter.js shape.
   All CSS classes prefixed "breakout-". Storage ns "breakout-".
   ============================================================ */
(function () {
  'use strict';

  var CSS = [
    '.breakout-stage{position:relative;width:100%;align-self:stretch;display:flex;flex-direction:column;' +
      'max-width:760px;margin:0 auto;padding:10px;gap:10px;box-sizing:border-box}',
    '.breakout-hud{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:10px;' +
      'background:var(--surface);border-radius:var(--r-pill);padding:8px 14px;box-shadow:var(--shadow-sm);' +
      'font-weight:800;user-select:none;-webkit-user-select:none}',
    '.breakout-hud .breakout-hcell{display:flex;align-items:center;gap:6px;font-size:15px;white-space:nowrap}',
    '.breakout-hud .breakout-hlabel{font-size:11px;color:var(--muted);font-weight:800;letter-spacing:.04em}',
    '.breakout-hearts{font-size:16px;letter-spacing:1px;line-height:1;min-width:62px;text-align:center}',
    '.breakout-score b{color:var(--blue);font-variant-numeric:tabular-nums}',
    '.breakout-level b{color:var(--purple)}',
    '.breakout-canvasWrap{flex:1 1 auto;position:relative;min-height:0;border-radius:20px;overflow:hidden;' +
      'background:linear-gradient(180deg,#f7faff,#eef3fb);box-shadow:var(--shadow),inset 0 2px 0 rgba(255,255,255,.6);' +
      'touch-action:none}',
    '.breakout-canvasWrap canvas{display:block;width:100%;height:100%;touch-action:none}',
    '.breakout-overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;gap:16px;text-align:center;padding:24px;box-sizing:border-box;' +
      'background:rgba(28,34,54,.42);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);' +
      'color:#fff;z-index:5;animation:breakoutOvIn .26s var(--spring)}',
    '.breakout-overlay.breakout-hidden{display:none}',
    '@keyframes breakoutOvIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}',
    '.breakout-ovTitle{font-size:30px;font-weight:900;text-shadow:0 3px 0 rgba(0,0,0,.18);line-height:1.1}',
    '.breakout-ovSub{font-size:15px;font-weight:700;opacity:.95;max-width:22em}',
    '.breakout-ovStats{display:flex;gap:18px;flex-wrap:wrap;justify-content:center;font-weight:800}',
    '.breakout-ovStats .breakout-chip{background:rgba(255,255,255,.16);border-radius:var(--r-pill);' +
      'padding:8px 16px;font-size:15px;min-width:90px}',
    '.breakout-ovStats .breakout-chip span{display:block;font-size:11px;opacity:.85;font-weight:800}',
    '.breakout-ovStats .breakout-chip b{font-size:22px;font-variant-numeric:tabular-nums}',
    '.breakout-btn{min-height:48px;min-width:160px;font-size:17px;padding:12px 26px}',
    '.breakout-hint{font-size:13px;font-weight:700;opacity:.85}',
    '.breakout-pulse{animation:breakoutPulse 1.4s ease-in-out infinite}',
    '@keyframes breakoutPulse{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}'
  ].join('');

  // Row palette (bright primaries). Cycled for deeper grids.
  var ROW_COLORS = ['#ff4d57', '#ff8a3d', '#ffce3a', '#2fcf72', '#36a9ff', '#6c63ff', '#ff6fae', '#1fd3c9'];

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function mount(root, ctx) {
    ctx.injectCSS('game-breakout', CSS);

    var hiStore = ctx.storage('breakout-hi');
    var best = (function () { var v = hiStore.get(0); return (typeof v === 'number' && isFinite(v)) ? v : 0; })();

    /* ---------------- DOM ---------------- */
    var scoreEl = ctx.el('b', null, '0');
    var heartsEl = ctx.el('div', { class: 'breakout-hearts' }, '');
    var levelEl = ctx.el('b', null, '1');
    var hud = ctx.el('div', { class: 'breakout-hud' },
      ctx.el('div', { class: 'breakout-hcell breakout-score' },
        ctx.el('span', { class: 'breakout-hlabel' }, 'スコア'), scoreEl),
      ctx.el('div', { class: 'breakout-hcell' },
        ctx.el('span', { class: 'breakout-hlabel' }, 'ライフ'), heartsEl),
      ctx.el('div', { class: 'breakout-hcell breakout-level' },
        ctx.el('span', { class: 'breakout-hlabel' }, 'レベル'), levelEl)
    );

    var canvas = ctx.el('canvas', { 'aria-label': 'ブロック崩しの盤面' });
    var canvasWrap = ctx.el('div', { class: 'breakout-canvasWrap' }, canvas);

    // Overlay (reused for start / level-clear / game-over)
    var ovTitle = ctx.el('div', { class: 'breakout-ovTitle' }, '');
    var ovSub = ctx.el('div', { class: 'breakout-ovSub' }, '');
    var ovStats = ctx.el('div', { class: 'breakout-ovStats' });
    var ovBtn = ctx.el('button', { class: 'btn btn-accent squish breakout-btn' }, 'はじめる');
    var ovHint = ctx.el('div', { class: 'breakout-hint' }, '');
    var overlay = ctx.el('div', { class: 'breakout-overlay' }, ovTitle, ovSub, ovStats, ovBtn, ovHint);
    canvasWrap.appendChild(overlay);

    var stage = ctx.el('div', { class: 'breakout-stage' }, hud, canvasWrap);
    root.appendChild(ctx.el('div', { class: 'playfield' }, stage));

    /* ---------------- state ---------------- */
    // phases: 'start' | 'ready' (ball on paddle) | 'play' | 'levelclear' | 'gameover'
    var phase = 'start';
    var W = 0, H = 0;            // CSS-pixel logical size
    var score = 0, lives = 3, level = 1;
    var paddle = { x: 0, w: 110, h: 16, y: 0 };
    var ball = { x: 0, y: 0, vx: 0, vy: 0, r: 8, speed: 360 };
    var bricks = [];
    var particles = [];
    var pointerTargetX = null;  // when set, paddle eases toward it
    var keyLeft = false, keyRight = false;
    var coinStreak = 0;
    var shake = 0;

    var raf = 0, lastT = 0, running = false;

    /* ---------------- layout helpers ---------------- */
    function brickLayout() {
      var rows = clamp(3 + level, 3, 9);
      var cols = clamp(6 + Math.floor(level / 2), 6, 11);
      // Cap rows so bricks never reach the paddle region on short screens.
      var maxRowsByHeight = Math.max(3, Math.floor((H * 0.5) / 30));
      rows = Math.min(rows, maxRowsByHeight);
      return { rows: rows, cols: cols };
    }

    function buildBricks() {
      bricks = [];
      var lay = brickLayout();
      var rows = lay.rows, cols = lay.cols;
      var padX = Math.max(8, W * 0.03);
      var topPad = Math.max(14, H * 0.07);
      var gap = Math.max(4, W * 0.012);
      var totalGap = gap * (cols - 1);
      var bw = (W - padX * 2 - totalGap) / cols;
      var bh = clamp(H * 0.045, 16, 30);
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          // Tougher bricks (2 hits) appear more often in upper rows / higher levels.
          var toughChance = 0.12 + r * 0.05 + (level - 1) * 0.04;
          var hp = (Math.random() < Math.min(0.6, toughChance)) ? 2 : 1;
          bricks.push({
            x: padX + c * (bw + gap),
            y: topPad + r * (bh + gap),
            w: bw, h: bh,
            hp: hp, maxHp: hp,
            color: ROW_COLORS[r % ROW_COLORS.length],
            alive: true,
            hitFlash: 0
          });
        }
      }
    }

    function liveBricks() {
      var n = 0;
      for (var i = 0; i < bricks.length; i++) if (bricks[i].alive) n++;
      return n;
    }

    function resetPaddle() {
      paddle.w = clamp(W * 0.2, 78, 150);
      paddle.h = clamp(H * 0.022, 12, 18);
      paddle.y = H - paddle.h - Math.max(14, H * 0.04);
      if (!paddle.x) paddle.x = W / 2;
      paddle.x = clamp(paddle.x, paddle.w / 2, W - paddle.w / 2);
    }

    function placeBallOnPaddle() {
      ball.r = clamp(Math.min(W, H) * 0.018, 6, 11);
      ball.x = paddle.x;
      ball.y = paddle.y - ball.r - 2;
      ball.vx = 0; ball.vy = 0;
    }

    function launchBall() {
      var sp = ball.speed;
      var ang = (-Math.PI / 2) + (Math.random() * 0.5 - 0.25); // mostly upward, slight spread
      ball.vx = Math.cos(ang) * sp;
      ball.vy = Math.sin(ang) * sp;
    }

    function levelSpeed() {
      // base scales with size so it feels consistent across screens; +per level.
      var base = Math.max(300, Math.min(W, H * 1.4) * 0.7);
      return base * (1 + (level - 1) * 0.1);
    }

    /* ---------------- HUD ---------------- */
    function renderHud() {
      scoreEl.textContent = String(score);
      levelEl.textContent = String(level);
      var s = '';
      for (var i = 0; i < lives; i++) s += '❤️';
      for (var j = lives; j < 3; j++) s += '🤍'; // white heart for spent slots (keep min 3 slots)
      heartsEl.textContent = s || '🤍';
    }

    /* ---------------- overlay ---------------- */
    function showOverlay(opts) {
      overlay.classList.remove('breakout-hidden');
      ovTitle.textContent = opts.title || '';
      ovSub.textContent = opts.sub || '';
      ovStats.innerHTML = '';
      if (opts.stats && opts.stats.length) {
        opts.stats.forEach(function (st) {
          ovStats.appendChild(ctx.el('div', { class: 'breakout-chip' },
            ctx.el('span', null, st.label), ctx.el('b', null, String(st.value))));
        });
        ovStats.style.display = '';
      } else { ovStats.style.display = 'none'; }
      if (opts.btn) {
        ovBtn.style.display = '';
        ovBtn.textContent = opts.btn;
        ovBtn.classList.toggle('breakout-pulse', !!opts.pulse);
      } else { ovBtn.style.display = 'none'; ovBtn.classList.remove('breakout-pulse'); }
      ovHint.textContent = opts.hint || '';
      ovHint.style.display = opts.hint ? '' : 'none';
    }
    function hideOverlay() { overlay.classList.add('breakout-hidden'); }

    /* ---------------- phase transitions ---------------- */
    function startGame() {
      score = 0; lives = 3; level = 1;
      coinStreak = 0;
      ball.speed = levelSpeed();
      resetPaddle();
      buildBricks();
      placeBallOnPaddle();
      renderHud();
      phase = 'ready';
      showReadyOverlay();
    }

    function showStartOverlay() {
      phase = 'start';
      showOverlay({
        title: '🧱 ブロック崩し',
        sub: 'パドルを動かしてボールをはね返し、ブロックを全部こわすのだ！',
        stats: best > 0 ? [{ label: 'ベスト', value: best }] : null,
        btn: 'タップ / クリックで開始',
        pulse: true,
        hint: ctx.isTouch ? 'ドラッグでパドル移動' : 'ドラッグ または ← → キー / Space で発射'
      });
    }

    function showReadyOverlay() {
      // brief "launch" prompt; stays until tap/space
      showOverlay({
        title: 'レベル ' + level,
        sub: '',
        stats: null,
        btn: null,
        hint: ctx.isTouch ? 'タップでボール発射' : 'タップ または Space で発射'
      });
    }

    function beginPlay() {
      if (phase !== 'ready') return;
      hideOverlay();
      launchBall();
      phase = 'play';
      ctx.sound.play('whoosh');
    }

    function loseLife() {
      lives--;
      coinStreak = 0;
      shake = 10;
      ctx.sound.play('lose');
      ctx.haptic(40);
      renderHud();
      if (lives <= 0) { gameOver(); return; }
      phase = 'ready';
      placeBallOnPaddle();
      showReadyOverlay();
    }

    function nextLevel() {
      level++;
      ctx.sound.play('win');
      ctx.haptic(30);
      ball.speed = levelSpeed();
      resetPaddle();
      buildBricks();
      placeBallOnPaddle();
      renderHud();
      phase = 'ready';
      showOverlay({
        title: 'レベル ' + level + ' へ！',
        sub: 'ブロックが増えてスピードアップなのだ',
        stats: [{ label: 'スコア', value: score }],
        btn: null,
        hint: ctx.isTouch ? 'タップで開始' : 'タップ または Space で開始'
      });
    }

    function gameOver() {
      phase = 'gameover';
      var isBest = score > best;
      if (isBest) { best = score; hiStore.set(best); ctx.sound.play('success'); }
      placeBallOnPaddle();
      showOverlay({
        title: 'ゲームオーバー',
        sub: isBest ? '新記録なのだ！すごいのだ！' : 'おしいのだ！もう一回いくのだ！',
        stats: [
          { label: 'スコア', value: score },
          { label: 'ベスト', value: best },
          { label: 'レベル', value: level }
        ],
        btn: 'もう一度',
        pulse: true,
        hint: ''
      });
    }

    /* ---------------- particles ---------------- */
    function burst(x, y, color, n) {
      n = n || 9;
      for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2;
        var sp = 60 + Math.random() * 160;
        particles.push({
          x: x, y: y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
          life: 0.5 + Math.random() * 0.35, age: 0,
          color: color, size: 2 + Math.random() * 3
        });
      }
      if (particles.length > 240) particles.splice(0, particles.length - 240);
    }

    /* ---------------- physics ---------------- */
    function reflectPaddle() {
      // map horizontal offset from paddle center -> outgoing angle
      var rel = (ball.x - paddle.x) / (paddle.w / 2); // -1..1
      rel = clamp(rel, -1, 1);
      var maxAng = Math.PI * 0.42; // up to ~75deg from vertical
      var ang = -Math.PI / 2 + rel * maxAng;
      var sp = Math.min(ball.speed * 1.04, levelSpeed() * 1.9); // tiny speed up, capped
      ball.speed = sp;
      ball.vx = Math.cos(ang) * sp;
      ball.vy = Math.sin(ang) * sp;
      if (ball.vy > -40) ball.vy = -Math.abs(ball.vy) - 40; // ensure it goes up
      ball.y = paddle.y - ball.r - 0.5;
      ctx.sound.play('pop');
      ctx.haptic(8);
    }

    function hitBrick(b) {
      b.hp--;
      b.hitFlash = 1;
      if (b.hp <= 0) {
        b.alive = false;
        score += 10 * level;
        burst(b.x + b.w / 2, b.y + b.h / 2, b.color, 11);
        coinStreak++;
        if (coinStreak % 4 === 0) { ctx.sound.play('coin'); }
        else { ctx.sound.play('hit'); }
        ctx.haptic(10);
        renderHud();
        if (liveBricks() === 0) { nextLevel(); }
      } else {
        score += 3 * level;
        burst(b.x + b.w / 2, b.y + b.h / 2, b.color, 4);
        ctx.sound.play('tick');
        renderHud();
      }
    }

    // Move ball one substep of duration dt; resolve collisions.
    function stepBall(dt) {
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      // walls
      if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); ctx.sound.play('tick'); }
      else if (ball.x + ball.r > W) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); ctx.sound.play('tick'); }
      if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); ctx.sound.play('tick'); }

      // paddle
      if (ball.vy > 0 &&
          ball.y + ball.r >= paddle.y &&
          ball.y - ball.r <= paddle.y + paddle.h &&
          ball.x >= paddle.x - paddle.w / 2 - ball.r &&
          ball.x <= paddle.x + paddle.w / 2 + ball.r) {
        reflectPaddle();
      }

      // bricks — find first overlapping alive brick, resolve along smaller penetration axis
      for (var i = 0; i < bricks.length; i++) {
        var b = bricks[i];
        if (!b.alive) continue;
        // closest point on rect to ball center
        var cx = clamp(ball.x, b.x, b.x + b.w);
        var cy = clamp(ball.y, b.y, b.y + b.h);
        var dx = ball.x - cx, dy = ball.y - cy;
        if (dx * dx + dy * dy <= ball.r * ball.r) {
          // determine bounce axis by penetration depth
          var overlapLeft = (ball.x + ball.r) - b.x;
          var overlapRight = (b.x + b.w) - (ball.x - ball.r);
          var overlapTop = (ball.y + ball.r) - b.y;
          var overlapBottom = (b.y + b.h) - (ball.y - ball.r);
          var minX = Math.min(overlapLeft, overlapRight);
          var minY = Math.min(overlapTop, overlapBottom);
          if (minX < minY) {
            ball.vx = -ball.vx;
            if (overlapLeft < overlapRight) ball.x = b.x - ball.r - 0.1;
            else ball.x = b.x + b.w + ball.r + 0.1;
          } else {
            ball.vy = -ball.vy;
            if (overlapTop < overlapBottom) ball.y = b.y - ball.r - 0.1;
            else ball.y = b.y + b.h + ball.r + 0.1;
          }
          hitBrick(b);
          break; // one brick per substep avoids weird multi-resolves
        }
      }

      // bottom — lost
      if (ball.y - ball.r > H) {
        loseLife();
        return false;
      }
      return true;
    }

    function updatePaddle(dt) {
      // keyboard
      var kdir = (keyRight ? 1 : 0) - (keyLeft ? 1 : 0);
      if (kdir !== 0) {
        paddle.x += kdir * W * 1.5 * dt;
        pointerTargetX = null;
      } else if (pointerTargetX != null) {
        // ease toward pointer (snappy)
        var diff = pointerTargetX - paddle.x;
        paddle.x += diff * Math.min(1, dt * 18);
      }
      paddle.x = clamp(paddle.x, paddle.w / 2, W - paddle.w / 2);
      if (phase === 'ready') { ball.x = paddle.x; }
    }

    function updateParticles(dt) {
      for (var i = particles.length - 1; i >= 0; i--) {
        var p = particles[i];
        p.age += dt;
        if (p.age >= p.life) { particles.splice(i, 1); continue; }
        p.vy += 520 * dt; // gravity
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }

    /* ---------------- update ---------------- */
    function update(dt) {
      if (shake > 0) shake = Math.max(0, shake - dt * 60);
      // decay brick flashes
      for (var i = 0; i < bricks.length; i++) {
        if (bricks[i].hitFlash > 0) bricks[i].hitFlash = Math.max(0, bricks[i].hitFlash - dt * 6);
      }
      updateParticles(dt);
      updatePaddle(dt);

      if (phase === 'play') {
        // sub-step to prevent tunneling: keep step distance < ball radius
        var dist = Math.hypot(ball.vx, ball.vy) * dt;
        var steps = Math.max(1, Math.ceil(dist / (ball.r * 0.8)));
        steps = Math.min(steps, 12);
        var sub = dt / steps;
        for (var s = 0; s < steps; s++) {
          if (phase !== 'play') break; // loseLife / nextLevel changed phase
          if (!stepBall(sub)) break;
        }
      }
    }

    /* ---------------- render ---------------- */
    function roundRect(g, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      g.beginPath();
      g.moveTo(x + r, y);
      g.arcTo(x + w, y, x + w, y + h, r);
      g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r);
      g.arcTo(x, y, x + w, y, r);
      g.closePath();
    }

    function draw(g) {
      g.clearRect(0, 0, W, H);

      var sx = 0, sy = 0;
      if (shake > 0) { sx = (Math.random() - 0.5) * shake; sy = (Math.random() - 0.5) * shake; }
      g.save();
      g.translate(sx, sy);

      // bricks
      for (var i = 0; i < bricks.length; i++) {
        var b = bricks[i];
        if (!b.alive) continue;
        g.save();
        roundRect(g, b.x, b.y, b.w, b.h, 6);
        g.fillStyle = b.color;
        g.shadowColor = 'rgba(40,54,92,.18)';
        g.shadowBlur = 6; g.shadowOffsetY = 2;
        g.fill();
        g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0;
        // glossy top highlight
        g.globalAlpha = 0.32;
        roundRect(g, b.x + 2, b.y + 2, b.w - 4, b.h * 0.42, 4);
        g.fillStyle = '#ffffff';
        g.fill();
        g.globalAlpha = 1;
        // hit flash
        if (b.hitFlash > 0) {
          g.globalAlpha = b.hitFlash * 0.7;
          roundRect(g, b.x, b.y, b.w, b.h, 6);
          g.fillStyle = '#ffffff'; g.fill();
          g.globalAlpha = 1;
        }
        // cracked state for 2-hit bricks with 1 hp left
        if (b.maxHp >= 2 && b.hp === 1) {
          g.strokeStyle = 'rgba(35,40,56,.55)';
          g.lineWidth = 1.4;
          g.beginPath();
          var mx = b.x + b.w / 2, my = b.y + b.h / 2;
          g.moveTo(b.x + b.w * 0.25, b.y + 2);
          g.lineTo(mx, my);
          g.lineTo(b.x + b.w * 0.72, b.y + b.h - 2);
          g.moveTo(mx, my);
          g.lineTo(b.x + b.w * 0.2, b.y + b.h - 3);
          g.stroke();
        }
        g.restore();
      }

      // particles
      for (var p = 0; p < particles.length; p++) {
        var pt = particles[p];
        g.globalAlpha = Math.max(0, 1 - pt.age / pt.life);
        g.fillStyle = pt.color;
        g.beginPath();
        g.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;

      // paddle (rounded, gradient)
      var px = paddle.x - paddle.w / 2;
      var grad = g.createLinearGradient(0, paddle.y, 0, paddle.y + paddle.h);
      grad.addColorStop(0, '#5b8cff');
      grad.addColorStop(1, '#3d56ff');
      roundRect(g, px, paddle.y, paddle.w, paddle.h, paddle.h / 2);
      g.fillStyle = grad;
      g.shadowColor = 'rgba(61,86,255,.45)';
      g.shadowBlur = 12; g.shadowOffsetY = 3;
      g.fill();
      g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0;
      g.globalAlpha = 0.35;
      roundRect(g, px + 3, paddle.y + 2, paddle.w - 6, paddle.h * 0.4, paddle.h * 0.3);
      g.fillStyle = '#fff'; g.fill();
      g.globalAlpha = 1;

      // ball (glowing)
      g.save();
      g.shadowColor = 'rgba(255,206,58,.9)';
      g.shadowBlur = 16;
      g.beginPath();
      g.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      var bg = g.createRadialGradient(ball.x - ball.r * 0.3, ball.y - ball.r * 0.3, ball.r * 0.2, ball.x, ball.y, ball.r);
      bg.addColorStop(0, '#fff7d6');
      bg.addColorStop(0.5, '#ffce3a');
      bg.addColorStop(1, '#ff8a3d');
      g.fillStyle = bg;
      g.fill();
      g.restore();

      g.restore();
    }

    /* ---------------- loop ---------------- */
    var c2 = null;
    function frame(t) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      if (!c2) c2 = canvas.getContext('2d');
      if (!c2 || W <= 0 || H <= 0) { lastT = t; return; }
      var dt = lastT ? (t - lastT) / 1000 : 0;
      lastT = t;
      if (dt > 0.05) dt = 0.05; // cap dt (tab switch / lag) to prevent tunneling
      if (dt > 0) update(dt);
      draw(c2);
    }
    function startLoop() {
      if (running) return;
      running = true; lastT = 0;
      raf = requestAnimationFrame(frame);
    }

    /* ---------------- resize ---------------- */
    var didInit = false;
    function onResize(fit) {
      var prevW = W, prevH = H;
      W = fit.w; H = fit.h;
      if (!didInit) {
        didInit = true;
        resetPaddle();
        ball.speed = levelSpeed();
        buildBricks();
        placeBallOnPaddle();
        renderHud();
        showStartOverlay();
        startLoop();
        return;
      }
      if (phase === 'play') {
        // Mid-rally resize: rescale the WHOLE game geometry proportionally so the
        // relative layout is preserved (no bricks teleporting under the ball) AND
        // no live brick can end up past the new wall — which would soft-lock the
        // level (unreachable brick -> can never clear). Rescaling everything keeps
        // bricks reachable. Resizes during active play are rare.
        var sx = prevW > 0 ? W / prevW : 1;
        var sy = prevH > 0 ? H / prevH : 1;
        for (var i = 0; i < bricks.length; i++) {
          var b = bricks[i];
          b.x *= sx; b.y *= sy; b.w *= sx; b.h *= sy;
        }
        ball.x *= sx; ball.y *= sy;
        ball.r = clamp(Math.min(W, H) * 0.018, 6, 11);
        if (pointerTargetX != null) pointerTargetX *= sx;
        var prevPaddleX = paddle.x * sx;
        resetPaddle();
        paddle.x = clamp(prevPaddleX, paddle.w / 2, W - paddle.w / 2);
        ball.speed = Math.hypot(ball.vx, ball.vy) || ball.speed;
      } else {
        // When not actively playing, rebuild the brick grid to the new size so an
        // orientation flip can't leave bricks past the wall (unreachable).
        resetPaddle();
        buildBricks();
        if (phase === 'ready' || phase === 'start') placeBallOnPaddle();
      }
      ball.x = clamp(ball.x, ball.r, Math.max(ball.r, W - ball.r));
      ball.y = clamp(ball.y, ball.r, Math.max(ball.r, H - ball.r));
    }
    var fit = ctx.fitCanvas(canvas, onResize);

    /* ---------------- input ---------------- */
    function localX(clientX) {
      var rect = canvasWrap.getBoundingClientRect();
      return clamp(clientX - rect.left, 0, rect.width);
    }

    function primaryAction() {
      // called on tap/click/space depending on phase
      if (phase === 'start') { startGame(); }
      else if (phase === 'ready') { beginPlay(); }
      else if (phase === 'gameover') { startGame(); }
      // 'levelclear' uses 'ready' phase too (handled there)
    }

    var pointerActive = false;
    var pointerDriveId = null;
    function onPointerDown(e) {
      // ignore taps that land on the overlay button (it has its own handler)
      if (e.target === ovBtn) return;
      // ignore secondary mouse buttons (right/middle click) so they can't start/launch
      if (e.pointerType === 'mouse' && e.button != null && e.button !== 0) return;
      // only the first active pointer drives the paddle (ignore extra fingers)
      if (pointerActive && pointerDriveId != null && e.pointerId !== pointerDriveId) {
        if (e.cancelable) e.preventDefault();
        return;
      }
      pointerActive = true;
      pointerDriveId = (e.pointerId != null) ? e.pointerId : null;
      if (canvasWrap.setPointerCapture && e.pointerId != null) {
        try { canvasWrap.setPointerCapture(e.pointerId); } catch (er) {}
      }
      if (e.cancelable) e.preventDefault();
      pointerTargetX = localX(e.clientX);
      // tap to start / launch
      if (phase === 'start' || phase === 'ready' || phase === 'gameover') primaryAction();
    }
    function onPointerMove(e) {
      if (!pointerActive) return;
      if (pointerDriveId != null && e.pointerId !== pointerDriveId) return;
      if (e.cancelable) e.preventDefault();
      pointerTargetX = localX(e.clientX);
    }
    function onPointerUp(e) {
      if (pointerDriveId != null && e.pointerId != null && e.pointerId !== pointerDriveId) return;
      pointerActive = false;
      pointerDriveId = null;
      if (canvasWrap.releasePointerCapture && e.pointerId != null) {
        try { canvasWrap.releasePointerCapture(e.pointerId); } catch (er) {}
      }
    }
    // Block touch scrolling/zoom during play (extra guard beyond touch-action).
    function onTouchMove(e) { if (e.cancelable) e.preventDefault(); }

    function onKeyDown(e) {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { keyLeft = true; pointerTargetX = null; e.preventDefault(); }
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { keyRight = true; pointerTargetX = null; e.preventDefault(); }
      else if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') {
        e.preventDefault();
        primaryAction();
      }
    }
    function onKeyUp(e) {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keyLeft = false;
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keyRight = false;
    }

    function onOvBtn() {
      ctx.sound.play('select');
      if (phase === 'start' || phase === 'gameover') startGame();
      else if (phase === 'ready') beginPlay();
    }

    function onVisibility() {
      // pause physics movement implicitly via dt cap; nothing else needed,
      // but ensure keys don't stick when tab loses focus
      keyLeft = keyRight = false;
    }

    canvasWrap.addEventListener('pointerdown', onPointerDown);
    canvasWrap.addEventListener('pointermove', onPointerMove);
    canvasWrap.addEventListener('pointerup', onPointerUp);
    canvasWrap.addEventListener('pointercancel', onPointerUp);
    canvasWrap.addEventListener('touchmove', onTouchMove, { passive: false });
    canvasWrap.addEventListener('touchstart', onTouchMove, { passive: false });
    ovBtn.addEventListener('click', onOvBtn);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onVisibility);
    document.addEventListener('visibilitychange', onVisibility);

    /* ---------------- cleanup ---------------- */
    mount._cleanup = function () {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      try { fit.stop(); } catch (e) {}
      canvasWrap.removeEventListener('pointerdown', onPointerDown);
      canvasWrap.removeEventListener('pointermove', onPointerMove);
      canvasWrap.removeEventListener('pointerup', onPointerUp);
      canvasWrap.removeEventListener('pointercancel', onPointerUp);
      canvasWrap.removeEventListener('touchmove', onTouchMove);
      canvasWrap.removeEventListener('touchstart', onTouchMove);
      ovBtn.removeEventListener('click', onOvBtn);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onVisibility);
      document.removeEventListener('visibilitychange', onVisibility);
      bricks = []; particles = []; c2 = null;
    };
  }

  Arcade.register({
    id: 'breakout',
    category: 'game',
    title: 'ブロック崩し',
    subtitle: 'パドルでブロックを崩せ',
    icon: '🧱',
    color: '#ff4d57',
    order: 10,
    mount: mount,
    unmount: function () { if (mount._cleanup) mount._cleanup(); }
  });
})();
