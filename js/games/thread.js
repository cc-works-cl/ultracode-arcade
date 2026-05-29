/* ============================================================
   GAME — 糸通し (thread the needle)  one-tap timing game
   Mirrors js/tools/counter.js shape. See CONTRACT.md.
   ============================================================ */
(function () {
  'use strict';

  var ID = 'thread';

  var CSS = [
    '.thread-wrap{flex:1 1 auto;display:flex;flex-direction:column;min-height:0;width:100%;max-width:760px;margin:0 auto;gap:10px;padding:12px 12px 16px}',
    '.thread-hud{display:flex;align-items:center;justify-content:space-between;gap:10px;flex:0 0 auto}',
    '.thread-hud .thread-score{font-weight:800;font-size:18px;letter-spacing:.02em}',
    '.thread-hud .thread-best{font-size:13px;font-weight:700;color:var(--muted)}',
    '.thread-lives{display:flex;gap:4px;font-size:18px;line-height:1}',
    '.thread-lives span{transition:transform .25s var(--spring),opacity .25s}',
    '.thread-lives span.thread-dead{opacity:.22;transform:scale(.8)}',
    '.thread-stage{flex:1 1 auto;min-height:0;position:relative;border-radius:var(--r-card);overflow:hidden;box-shadow:var(--shadow);background:linear-gradient(160deg,#fbfdff,#eef3fb)}',
    '.thread-stage.thread-shake{animation:thread-shake .34s cubic-bezier(.36,.07,.19,.97)}',
    '@keyframes thread-shake{10%{transform:translateX(-7px)}30%{transform:translateX(6px)}50%{transform:translateX(-5px)}70%{transform:translateX(4px)}90%{transform:translateX(-2px)}100%{transform:none}}',
    '.thread-canvas{display:block;width:100%;height:100%;touch-action:none;cursor:pointer;-webkit-tap-highlight-color:transparent}',
    '.thread-overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:22px;background:rgba(255,255,255,.78);backdrop-filter:blur(3px);transition:opacity .2s}',
    '.thread-overlay.thread-hidden{display:none}',
    '.thread-overlay h3{margin:0;font-size:clamp(22px,6vw,30px);font-weight:900;letter-spacing:.02em}',
    '.thread-overlay .thread-big{font-size:46px;line-height:1;filter:drop-shadow(0 4px 8px rgba(173,92,255,.35))}',
    '.thread-overlay p{margin:0;font-size:14px;font-weight:700;color:var(--muted)}',
    '.thread-overlay .thread-result{display:flex;gap:22px;flex-wrap:wrap;justify-content:center}',
    '.thread-overlay .thread-result b{display:block;font-size:30px;font-weight:900;color:var(--text)}',
    '.thread-overlay .thread-result span{font-size:12px;font-weight:700;color:var(--muted)}',
    '.thread-hint{flex:0 0 auto;text-align:center;font-size:12px;font-weight:700;color:var(--muted);min-height:16px}'
  ].join('');

  function mount(root, ctx) {
    ctx.injectCSS(ID, CSS);

    var best = ctx.storage(ID + '-best');
    var bestVal = best.get(0) || 0;

    /* ---------------- DOM ---------------- */
    var scoreEl = ctx.el('span', { class: 'thread-score' }, 'スコア: 0本');
    var bestEl = ctx.el('span', { class: 'thread-best' }, 'ベスト: ' + bestVal + '本');
    var livesEl = ctx.el('div', { class: 'thread-lives' });

    var hud = ctx.el('div', { class: 'thread-hud' },
      scoreEl,
      ctx.el('div', { class: 'col', style: { alignItems: 'flex-end', gap: '2px' } }, livesEl, bestEl)
    );

    var canvas = ctx.el('canvas', { class: 'thread-canvas' });

    var overTitle = ctx.el('h3', null, 'タップで糸を通すのだ');
    var overBig = ctx.el('div', { class: 'thread-big' }, '🪡');
    var overText = ctx.el('p', null, 'スワッと針穴へ。タイミングが命なのだ。');
    var overResult = ctx.el('div', { class: 'thread-result' });
    var overBtn = ctx.el('button', { class: 'btn btn-primary squish', type: 'button' }, 'スタート');
    var overlay = ctx.el('div', { class: 'thread-overlay' }, overBig, overTitle, overText, overResult, overBtn);

    var stage = ctx.el('div', { class: 'thread-stage' }, canvas, overlay);
    var hint = ctx.el('div', { class: 'thread-hint' }, ctx.isTouch ? 'タップで糸発射 / 針穴を狙うのだ' : 'クリック または スペースキーで糸を発射するのだ');

    root.appendChild(ctx.el('div', { class: 'thread-wrap' }, hud, stage, hint));

    var c2 = canvas.getContext('2d');

    /* ---------------- game state ---------------- */
    // phase: 'ready' | 'playing' | 'launch' | 'over'
    var state = {
      phase: 'ready',
      score: 0,
      lives: 3,
      W: 0, H: 0,
      t: 0,                 // animation time (seconds)
      // sway params (vertical position of the swaying thread tip, normalized 0..1)
      swaySpeed: 1.0,       // radians/sec multiplier
      swayPhase: 0,
      tipN: 0.5,            // current tip normalized y (0 top .. 1 bottom)
      // eye (needle hole) in normalized coords
      eyeCenter: 0.5,
      eyeHalf: 0.16,        // half-height of the eye gap (normalized)
      eyeMove: 0,           // moving-eye amplitude (normalized)
      eyePhase: 0,
      eyeSpeed: 0.7,
      // launch animation
      launchProgress: 0,    // 0..1 across the stage
      launchTipN: 0.5,      // captured tip y at launch
      launchResult: null,   // 'success' | 'miss'
      sparkles: [],
      // flash on success
      successFlash: 0
    };

    var SWAY_MARGIN = 0.12;  // keep tip within [margin, 1-margin]

    function layout() { return {
      // x positions as fraction of width
      anchorX: state.W * 0.10,        // thread anchor (left)
      needleX: state.W * 0.78,        // needle vertical center line
      topPad: state.H * 0.10,
      botPad: state.H * 0.10
    }; }

    function normToY(n) {
      var L = layout();
      return L.topPad + n * (state.H - L.topPad - L.botPad);
    }

    function eyeCenterNow() {
      if (state.eyeMove <= 0) return state.eyeCenter;
      var c = state.eyeCenter + Math.sin(state.eyePhase) * state.eyeMove;
      return Math.max(SWAY_MARGIN, Math.min(1 - SWAY_MARGIN, c));
    }

    /* ---------------- audio: none created directly; uses ctx.sound only ---------------- */

    /* ---------------- lives UI ---------------- */
    function renderLives() {
      livesEl.innerHTML = '';
      for (var i = 0; i < 3; i++) {
        livesEl.appendChild(ctx.el('span', { class: i < state.lives ? '' : 'thread-dead' }, '🧵'));
      }
    }

    function setScore(n) {
      state.score = n;
      scoreEl.textContent = 'スコア: ' + n + '本';
    }

    /* ---------------- game flow ---------------- */
    function resetDifficulty() {
      state.swaySpeed = 1.0;
      state.eyeHalf = 0.16;
      state.eyeMove = 0;
      state.eyeSpeed = 0.7;
    }

    function placeEye() {
      // place eye center somewhere comfortable
      var lo = SWAY_MARGIN + state.eyeHalf + state.eyeMove;
      var hi = 1 - SWAY_MARGIN - state.eyeHalf - state.eyeMove;
      if (hi < lo) { lo = hi = 0.5; }
      state.eyeCenter = lo + Math.random() * (hi - lo);
      state.eyePhase = Math.random() * Math.PI * 2;
    }

    function rampUp() {
      // gets harder each success
      state.swaySpeed = Math.min(3.4, state.swaySpeed + 0.16);
      state.eyeHalf = Math.max(0.06, state.eyeHalf - 0.008);
      if (state.score >= 5 && state.eyeMove === 0) state.eyeMove = 0.06;
      if (state.eyeMove > 0) {
        state.eyeMove = Math.min(0.18, state.eyeMove + 0.006);
        state.eyeSpeed = Math.min(1.8, state.eyeSpeed + 0.05);
      }
    }

    function startGame() {
      state.phase = 'playing';
      state.score = 0;
      state.lives = 3;
      state.swayPhase = Math.random() * Math.PI * 2;
      resetDifficulty();
      placeEye();
      setScore(0);
      renderLives();
      hideOverlay();
      ctx.sound.play('select');
      ctx.haptic(10);
    }

    function showStartOverlay() {
      state.phase = 'ready';
      overBig.textContent = '🪡';
      overTitle.textContent = 'タップで糸を通すのだ';
      overText.textContent = 'スワッと針穴へ。タイミングが命なのだ。';
      overResult.innerHTML = '';
      overBtn.textContent = 'スタート';
      showOverlay();
    }

    function showGameOver() {
      state.phase = 'over';
      var newBest = false;
      if (state.score > bestVal) { bestVal = state.score; best.set(bestVal); newBest = true; }
      bestEl.textContent = 'ベスト: ' + bestVal + '本';
      overBig.textContent = newBest ? '🏆' : '🧵';
      overTitle.textContent = newBest ? '自己ベストなのだ！' : 'ゲームオーバー';
      overText.textContent = newBest ? '新記録おめでとうなのだ！' : 'もう一度ねらってみるのだ。';
      overResult.innerHTML = '';
      overResult.append(
        ctx.el('div', null, ctx.el('b', null, state.score + '本'), ctx.el('span', null, 'スコア')),
        ctx.el('div', null, ctx.el('b', null, bestVal + '本'), ctx.el('span', null, 'ベスト'))
      );
      overBtn.textContent = 'もう一度';
      showOverlay();
      ctx.sound.play(newBest ? 'win' : 'lose');
      ctx.haptic(30);
    }

    function showOverlay() { overlay.classList.remove('thread-hidden'); }
    function hideOverlay() { overlay.classList.add('thread-hidden'); }

    function shakeStage() {
      stage.classList.remove('thread-shake');
      // force reflow to restart animation
      void stage.offsetWidth;
      stage.classList.add('thread-shake');
    }

    /* ---------------- launch + resolve ---------------- */
    function launch() {
      if (state.phase !== 'playing') return;
      state.phase = 'launch';
      state.launchProgress = 0;
      state.launchTipN = state.tipN;
      state.launchResult = null;
      ctx.sound.play('whoosh');
    }

    function resolveLaunch() {
      // Called once at the moment the thread head reaches the needle plane.
      // Gives immediate feedback; the phase transition / eye reposition is
      // deferred until the launch animation finishes (see frame()).
      var ec = eyeCenterNow();
      var hit = Math.abs(state.launchTipN - ec) <= state.eyeHalf;
      if (hit) {
        state.launchResult = 'success';
        setScore(state.score + 1);
        spawnSparkles(layout().needleX, normToY(ec));
        state.successFlash = 1;
        ctx.sound.play('success');
        ctx.haptic(12);
      } else {
        state.launchResult = 'miss';
        ctx.sound.play('lose');
        ctx.sound.play('hit');
        shakeStage();
        ctx.haptic(40);
        state.lives--;
        renderLives();
        if (state.lives <= 0) showGameOver(); // immediate game-over feedback
      }
    }

    function finishLaunch() {
      // Called when the launch animation completes (or game already ended).
      if (state.phase !== 'launch') return;
      if (state.launchResult === 'success') {
        rampUp();
        placeEye();
      } else if (state.launchResult === 'miss' && state.lives > 0) {
        placeEye();
      }
      // if game over was triggered, showGameOver() already set phase='over'
      state.phase = 'playing';
    }

    function spawnSparkles(x, y) {
      for (var i = 0; i < 14; i++) {
        var a = Math.random() * Math.PI * 2;
        var sp = 60 + Math.random() * 160;
        state.sparkles.push({
          x: x, y: y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 1, hue: 250 + Math.random() * 90
        });
      }
    }

    /* ---------------- input ---------------- */
    function onAction() {
      // route start/restart through requestStart() so the 350ms dedup guard
      // also covers Space (a focused button + Space would otherwise fire
      // both onKey and a synthesized click -> double startGame + double sound)
      if (state.phase === 'ready' || state.phase === 'over') { requestStart(); return; }
      if (state.phase === 'playing') { launch(); }
      // ignore during 'launch'
    }

    function onPointerDown(e) {
      e.preventDefault();
      onAction();
    }
    function onKey(e) {
      if (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        onAction();
      }
    }
    // Start can be triggered by tapping anywhere on the overlay (spec wording
    // "タップで…") or by activating the button (keyboard/click). Guard against a
    // tap firing both the overlay pointerdown and the synthesized button click.
    var startGuard = 0;
    function requestStart() {
      var now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      if (now - startGuard < 350) return;
      startGuard = now;
      startGame();
    }
    function onOverlayDown(e) {
      e.preventDefault();
      requestStart();
    }
    function onOverlayBtn(e) {
      e.stopPropagation();
      requestStart();
    }

    canvas.addEventListener('pointerdown', onPointerDown);
    // block touch scroll/zoom during active play on the stage
    function onTouchMove(e) { if (state.phase === 'playing' || state.phase === 'launch') e.preventDefault(); }
    stage.addEventListener('touchmove', onTouchMove, { passive: false });
    overlay.addEventListener('pointerdown', onOverlayDown);
    overBtn.addEventListener('click', onOverlayBtn);
    window.addEventListener('keydown', onKey);

    /* ---------------- rendering ---------------- */
    function roundedNeedle(L) {
      var nx = L.needleX;
      var topY = L.topPad * 0.35;
      var botY = state.H - L.botPad * 0.35;
      var w = Math.max(16, Math.min(34, state.W * 0.045));

      // needle body (shiny metallic vertical bar with a pointed top)
      var grad = c2.createLinearGradient(nx - w / 2, 0, nx + w / 2, 0);
      grad.addColorStop(0, '#b9c2d6');
      grad.addColorStop(0.25, '#eef2fa');
      grad.addColorStop(0.5, '#ffffff');
      grad.addColorStop(0.75, '#c7d0e2');
      grad.addColorStop(1, '#9aa6bf');

      c2.save();
      c2.beginPath();
      // pointed top
      c2.moveTo(nx, topY - w * 0.9);
      c2.lineTo(nx + w / 2, topY + w * 0.4);
      c2.lineTo(nx + w / 2, botY);
      c2.quadraticCurveTo(nx + w / 2, botY + w * 0.7, nx, botY + w * 0.7);
      c2.quadraticCurveTo(nx - w / 2, botY + w * 0.7, nx - w / 2, botY);
      c2.lineTo(nx - w / 2, topY + w * 0.4);
      c2.closePath();
      c2.fillStyle = grad;
      c2.shadowColor = 'rgba(60,72,110,.28)';
      c2.shadowBlur = 12; c2.shadowOffsetX = 3; c2.shadowOffsetY = 4;
      c2.fill();
      c2.restore();

      // highlight stripe
      c2.save();
      c2.globalAlpha = 0.6;
      c2.fillStyle = '#ffffff';
      c2.fillRect(nx - w * 0.18, topY + w * 0.4, w * 0.16, botY - topY - w * 0.4);
      c2.restore();

      return { nx: nx, w: w };
    }

    function drawEye(nd) {
      var ec = eyeCenterNow();
      var cy = normToY(ec);
      var halfPx = state.eyeHalf * (state.H - layout().topPad - layout().botPad);
      var ew = nd.w * 0.86;

      // carve the eye: draw gap as background-colored rounded rect with dark rim
      c2.save();
      // rim
      c2.beginPath();
      roundRect(nd.nx - ew / 2, cy - halfPx, ew, halfPx * 2, ew * 0.5);
      c2.fillStyle = '#7c8aa8';
      c2.fill();
      // inner hole shows playfield through
      c2.beginPath();
      var ix = nd.nx - ew * 0.34, iw = ew * 0.68;
      roundRect(ix, cy - halfPx + ew * 0.16, iw, halfPx * 2 - ew * 0.32, iw * 0.5);
      var holeGrad = c2.createLinearGradient(0, cy - halfPx, 0, cy + halfPx);
      holeGrad.addColorStop(0, '#e9f0fb');
      holeGrad.addColorStop(1, '#f7faff');
      c2.fillStyle = holeGrad;
      c2.fill();
      c2.restore();

      return { cy: cy, halfPx: halfPx };
    }

    function roundRect(x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      c2.moveTo(x + r, y);
      c2.arcTo(x + w, y, x + w, y + h, r);
      c2.arcTo(x + w, y + h, x, y + h, r);
      c2.arcTo(x, y + h, x, y, r);
      c2.arcTo(x, y, x + w, y, r);
      c2.closePath();
    }

    function threadGradient(x0, y0, x1, y1) {
      var g = c2.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, '#ad5cff');
      g.addColorStop(0.4, '#6c8bff');
      g.addColorStop(0.7, '#34d1c4');
      g.addColorStop(1, '#ffd24d');
      return g;
    }

    function drawSwayingThread(L) {
      // tip sways vertically; thread drawn as a gentle arc from anchor to tip
      var anchorY = state.H * 0.5;
      var ax = L.anchorX;
      var tipY = normToY(state.tipN);
      var tipX = L.needleX - Math.max(40, state.W * 0.10); // tip waits a bit left of the needle

      c2.save();
      c2.lineWidth = Math.max(3, state.W * 0.008);
      c2.lineCap = 'round';
      c2.strokeStyle = threadGradient(ax, anchorY, tipX, tipY);
      c2.beginPath();
      c2.moveTo(ax, anchorY);
      // control point creates an arc that follows the tip
      var cpx = (ax + tipX) / 2;
      var cpy = (anchorY + tipY) / 2 + Math.sin(state.swayPhase) * 18;
      c2.quadraticCurveTo(cpx, cpy, tipX, tipY);
      c2.stroke();
      c2.restore();

      // anchor spool
      c2.save();
      c2.beginPath();
      c2.arc(ax, anchorY, Math.max(9, state.W * 0.018), 0, Math.PI * 2);
      c2.fillStyle = '#ad5cff';
      c2.shadowColor = 'rgba(173,92,255,.4)'; c2.shadowBlur = 10;
      c2.fill();
      c2.restore();

      // glowing thread tip
      c2.save();
      var tr = Math.max(6, state.W * 0.013);
      var tg = c2.createRadialGradient(tipX, tipY, 1, tipX, tipY, tr * 2);
      tg.addColorStop(0, '#fff');
      tg.addColorStop(0.4, '#ffd24d');
      tg.addColorStop(1, 'rgba(255,210,77,0)');
      c2.fillStyle = tg;
      c2.beginPath();
      c2.arc(tipX, tipY, tr * 2, 0, Math.PI * 2);
      c2.fill();
      c2.fillStyle = '#ff7ad9';
      c2.beginPath();
      c2.arc(tipX, tipY, tr * 0.7, 0, Math.PI * 2);
      c2.fill();
      c2.restore();

      return { ax: ax, anchorY: anchorY, tipX: tipX, tipY: tipY };
    }

    function drawLaunchingThread(L, nd, eye) {
      var anchorY = state.H * 0.5;
      var ax = L.anchorX;
      var startX = L.needleX - Math.max(40, state.W * 0.10);
      var tipY = normToY(state.launchTipN);
      // thread head travels from startX across past the needle
      var endX = state.W + 30;
      var headX = startX + (endX - startX) * state.launchProgress;
      // on a miss the thread clunks into the needle body (never pierces it)
      if (state.launchResult === 'miss') headX = Math.min(headX, L.needleX - nd.w * 0.2);

      c2.save();
      c2.lineWidth = Math.max(3, state.W * 0.008);
      c2.lineCap = 'round';
      c2.strokeStyle = threadGradient(ax, anchorY, headX, tipY);
      c2.beginPath();
      c2.moveTo(ax, anchorY);
      var cpx = (ax + startX) / 2;
      var cpy = (anchorY + tipY) / 2;
      c2.quadraticCurveTo(cpx, cpy, startX, tipY);
      // straight shot across
      c2.lineTo(headX, tipY);
      c2.stroke();
      c2.restore();

      // anchor spool
      c2.save();
      c2.beginPath();
      c2.arc(ax, anchorY, Math.max(9, state.W * 0.018), 0, Math.PI * 2);
      c2.fillStyle = '#ad5cff';
      c2.fill();
      c2.restore();

      // bright head
      c2.save();
      var tr = Math.max(6, state.W * 0.013);
      var tg = c2.createRadialGradient(headX, tipY, 1, headX, tipY, tr * 2.2);
      tg.addColorStop(0, '#fff');
      tg.addColorStop(0.5, '#ffd24d');
      tg.addColorStop(1, 'rgba(255,210,77,0)');
      c2.fillStyle = tg;
      c2.beginPath();
      c2.arc(headX, tipY, tr * 2.2, 0, Math.PI * 2);
      c2.fill();
      c2.restore();
    }

    function drawSparkles() {
      for (var i = 0; i < state.sparkles.length; i++) {
        var s = state.sparkles[i];
        c2.save();
        c2.globalAlpha = Math.max(0, s.life);
        c2.fillStyle = 'hsl(' + s.hue + ',90%,65%)';
        c2.beginPath();
        c2.arc(s.x, s.y, 3 + s.life * 3, 0, Math.PI * 2);
        c2.fill();
        c2.restore();
      }
    }

    function clearAndBg() {
      c2.clearRect(0, 0, state.W, state.H);
      // soft dotted background
      c2.save();
      c2.globalAlpha = 0.5;
      var grad = c2.createLinearGradient(0, 0, 0, state.H);
      grad.addColorStop(0, '#fbfdff');
      grad.addColorStop(1, '#eef3fb');
      c2.fillStyle = grad;
      c2.fillRect(0, 0, state.W, state.H);
      c2.restore();

      if (state.successFlash > 0) {
        c2.save();
        c2.globalAlpha = state.successFlash * 0.35;
        c2.fillStyle = '#ad5cff';
        c2.fillRect(0, 0, state.W, state.H);
        c2.restore();
      }
    }

    function render() {
      if (state.W <= 0 || state.H <= 0) return;
      var L = layout();
      clearAndBg();
      var nd = roundedNeedle(L);
      var eye = drawEye(nd);

      if (state.phase === 'launch') {
        drawLaunchingThread(L, nd, eye);
      } else {
        drawSwayingThread(L);
      }
      drawSparkles();
    }

    /* ---------------- loop ---------------- */
    var raf = 0;
    var lastT = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      var dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0;
      lastT = now;
      state.t += dt;

      // sway updates only while there is something to position
      if (state.phase === 'playing' || state.phase === 'ready') {
        state.swayPhase += dt * (1.4 * state.swaySpeed);
        // tip oscillates within margins
        var amp = (0.5 - SWAY_MARGIN);
        state.tipN = 0.5 + Math.sin(state.swayPhase) * amp;
      }
      if (state.eyeMove > 0) state.eyePhase += dt * state.eyeSpeed * 2.2;

      if (state.phase === 'launch') {
        state.launchProgress += dt * 3.2; // travel speed
        // resolve when head reaches the needle plane
        var startX = layout().needleX - Math.max(40, state.W * 0.10);
        var endX = state.W + 30;
        var headX = startX + (endX - startX) * state.launchProgress;
        if (state.launchResult === null && headX >= layout().needleX) {
          resolveLaunch();
        }
        // a miss stops at the needle plane (no need to fly the whole way)
        if (state.launchResult === 'miss' && headX >= layout().needleX) {
          state.launchProgress = 1;
        }
        if (state.launchProgress >= 1) {
          state.launchProgress = 1;
          finishLaunch();
        }
      }

      // sparkle physics
      if (state.sparkles.length) {
        var alive = [];
        for (var i = 0; i < state.sparkles.length; i++) {
          var s = state.sparkles[i];
          s.x += s.vx * dt; s.y += s.vy * dt;
          s.vy += 220 * dt;
          s.life -= dt * 1.6;
          if (s.life > 0) alive.push(s);
        }
        state.sparkles = alive;
      }
      if (state.successFlash > 0) state.successFlash = Math.max(0, state.successFlash - dt * 3.5);

      render();
    }

    /* ---------------- fit ---------------- */
    var fit = ctx.fitCanvas(canvas, function (f) {
      state.W = f.w; state.H = f.h;
      render();
    });

    renderLives();
    showStartOverlay();
    raf = requestAnimationFrame(frame);

    /* ---------------- cleanup ---------------- */
    mount._cleanup = function () {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (fit && fit.stop) fit.stop();
      canvas.removeEventListener('pointerdown', onPointerDown);
      stage.removeEventListener('touchmove', onTouchMove);
      overlay.removeEventListener('pointerdown', onOverlayDown);
      overBtn.removeEventListener('click', onOverlayBtn);
      window.removeEventListener('keydown', onKey);
    };
  }

  Arcade.register({
    id: 'thread',
    category: 'game',
    title: '糸通し',
    subtitle: 'タイミングで針穴へ',
    icon: '🪡',
    color: '#ad5cff',
    order: 50,
    mount: mount,
    unmount: function () { if (mount._cleanup) mount._cleanup(); }
  });
})();
