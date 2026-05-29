/* ============================================================
   STUDIO — スタジオ（多重録音ルーパー）
   Drum machine (16x4 step sequencer) + overdub looper.
   Shared AudioContext via ctx.audio(). See CONTRACT.md / counter.js.
   ============================================================ */
(function () {
  'use strict';

  var ID = 'studio';

  var LANES = [
    { key: 'kick',  label: 'キック',     color: 'var(--red)' },
    { key: 'snare', label: 'スネア',     color: 'var(--orange)' },
    { key: 'hat',   label: 'ハイハット', color: 'var(--sky)' },
    { key: 'clap',  label: 'クラップ',   color: 'var(--purple)' }
  ];
  var STEPS = 16;

  /* ---- pattern templates: 4 lanes x 16 steps (kick,snare,hat,clap) ---- */
  function row(s) { // '1001...' -> [bool x16]
    var a = []; for (var i = 0; i < STEPS; i++) a.push(s.charAt(i) === '1'); return a;
  }
  var TEMPLATES = {
    '8ビート': {
      kick:  row('1000100010001000'),
      snare: row('0000100000001000'),
      hat:   row('1010101010101010'),
      clap:  row('0000000000000000')
    },
    '4つ打ち': {
      kick:  row('1000100010001000'),
      snare: row('0000000000000000'),
      hat:   row('0010001000100010'),
      clap:  row('0000100000001000')
    },
    'ヒップホップ': {
      kick:  row('1000000010010000'),
      snare: row('0000100000001000'),
      hat:   row('1010101010101010'),
      clap:  row('0000100000001000')
    },
    'ファンク': {
      kick:  row('1001001000100100'),
      snare: row('0000100000001001'),
      hat:   row('1110111011101110'),
      clap:  row('0000000000000000')
    },
    'シャッフル': {
      kick:  row('1000001000001000'),
      snare: row('0001000000010000'),
      hat:   row('1001001001001001'),
      clap:  row('0000100000001000')
    }
  };

  var CSS = [
    '.studio-pane{display:flex;flex-direction:column;gap:14px;padding:14px;max-width:980px;margin:0 auto;width:100%}',
    '.studio-h{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
    '.studio-h h2{font-size:18px;font-weight:800;margin:0}',
    '.studio-h .studio-sub{font-size:12px;color:var(--muted);font-weight:700}',

    /* sticky transport */
    '.studio-bar{position:sticky;top:0;z-index:5;background:var(--surface);border-radius:var(--r-card);box-shadow:var(--shadow-sm);padding:10px 12px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}',
    '.studio-bar .studio-grp{display:flex;align-items:center;gap:8px}',
    '.studio-play{min-width:96px;min-height:44px;font-size:15px;font-weight:800}',
    '.studio-bpm{display:flex;align-items:center;gap:8px;flex:1 1 200px;min-width:180px}',
    '.studio-bpm input[type=range]{flex:1;min-width:90px;accent-color:var(--pink)}',
    '.studio-bpm b{font-variant-numeric:tabular-nums;min-width:62px;text-align:right;font-weight:800;font-size:15px}',
    '.studio-vol{display:flex;align-items:center;gap:8px;flex:1 1 160px;min-width:150px}',
    '.studio-vol input[type=range]{flex:1;min-width:80px;accent-color:var(--teal)}',
    '.studio-vol span{font-size:12px;color:var(--muted);font-weight:700;white-space:nowrap}',
    '.studio-vol-lbl{font-size:12px;color:var(--muted);font-weight:700;white-space:nowrap}',

    /* grid */
    '.studio-gridwrap{overflow-x:auto;-webkit-overflow-scrolling:touch;touch-action:pan-x pan-y;background:var(--surface);border-radius:var(--r-card);box-shadow:var(--shadow-sm);padding:10px}',
    '.studio-grid{display:grid;grid-template-columns:74px repeat(16,minmax(30px,1fr));gap:5px;min-width:600px}',
    '.studio-lanelabel{display:flex;align-items:center;font-size:12px;font-weight:800;color:var(--text);padding-right:4px;border-left:5px solid var(--lc,#ccc);padding-left:8px;border-radius:4px}',
    '.studio-cell{position:relative;height:38px;border:none;border-radius:10px;background:var(--surface-2);cursor:pointer;transition:transform .08s var(--spring),box-shadow .12s ease,background .12s ease;touch-action:manipulation;-webkit-tap-highlight-color:transparent}',
    '.studio-cell.studio-beat{background:#e9edf5}',
    '.studio-cell.studio-on{background:var(--cc,#ff4d8d);box-shadow:0 3px 0 rgba(0,0,0,.12),0 0 12px var(--cg,rgba(255,77,141,.5));transform:translateY(-1px)}',
    '.studio-cell.studio-on:active,.studio-cell:active{transform:scale(.9)}',
    '.studio-cell.studio-here::after{content:"";position:absolute;inset:-3px;border-radius:13px;box-shadow:0 0 0 3px var(--yellow);pointer-events:none}',
    '.studio-cell.studio-on.studio-here{filter:brightness(1.18)}',
    '.studio-stepnums{display:grid;grid-template-columns:74px repeat(16,minmax(30px,1fr));gap:5px;min-width:600px;margin-bottom:4px}',
    '.studio-stepnums span{text-align:center;font-size:10px;color:var(--muted);font-weight:700}',
    '.studio-stepnums span.studio-beat{color:var(--text)}',
    '.studio-stepnums i{display:block}',

    /* templates */
    '.studio-tpls{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
    '.studio-tpls .studio-tplbtn{min-height:40px;padding:8px 14px}',

    /* looper */
    '.studio-section{background:var(--surface);border-radius:var(--r-card);box-shadow:var(--shadow-sm);padding:12px;display:flex;flex-direction:column;gap:10px}',
    '.studio-section h3{margin:0;font-size:14px;font-weight:800;display:flex;align-items:center;gap:8px}',
    '.studio-recrow{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
    '.studio-recbtn{min-height:44px;min-width:120px;font-weight:800;display:flex;align-items:center;gap:8px}',
    '.studio-recbtn .studio-dot{width:12px;height:12px;border-radius:50%;background:currentColor;display:inline-block}',
    '.studio-recbtn.studio-armed{animation:studio-pulse .8s ease-in-out infinite}',
    '@keyframes studio-pulse{0%,100%{opacity:1}50%{opacity:.45}}',
    '.studio-note{font-size:12px;color:var(--muted);font-weight:700;line-height:1.5}',
    '.studio-tracks{display:flex;flex-direction:column;gap:8px}',
    '.studio-track{display:grid;grid-template-columns:1fr auto;gap:8px 10px;align-items:center;background:var(--surface-2);border-radius:14px;padding:10px 12px}',
    '.studio-track .studio-tname{font-weight:800;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.studio-track .studio-tctl{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end}',
    '.studio-track input[type=range]{width:96px;accent-color:var(--pink);min-height:30px}',
    '.studio-mini{min-height:36px;min-width:44px;padding:6px 10px;font-size:12px;font-weight:800}',
    '.studio-mini.studio-active{background:var(--pink);color:#fff;border-color:transparent}',
    '.studio-mini.studio-solo.studio-active{background:var(--yellow);color:#3a2a00}',
    '.studio-empty{font-size:12px;color:var(--muted);font-weight:700;text-align:center;padding:8px}',
    '.studio-disabled{opacity:.55;pointer-events:none}'
  ].join('');

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function mount(root, ctx) {
    ctx.injectCSS(ID, CSS);

    var ac = ctx.audio();
    var destroyed = false;
    var listeners = [];
    function on(target, ev, fn, opts) { target.addEventListener(ev, fn, opts); listeners.push([target, ev, fn, opts]); }

    /* ---------------- audio graph ---------------- */
    var master = null, drumBus = null;
    if (ac) {
      master = ac.createGain();
      drumBus = ac.createGain();
      var savedMaster = ctx.storage(ID + '-master').get(0.9);
      master.gain.value = clamp(Number(savedMaster) || 0.9, 0, 1);
      drumBus.gain.value = 1;
      drumBus.connect(master);
      master.connect(ac.destination);
    }

    /* ---------------- state ---------------- */
    var savedGrid = ctx.storage(ID + '-grid').get(null);
    var grid = {};
    LANES.forEach(function (l) {
      var src = savedGrid && Array.isArray(savedGrid[l.key]) && savedGrid[l.key].length === STEPS ? savedGrid[l.key] : null;
      grid[l.key] = src ? src.map(function (b) { return !!b; }) : new Array(STEPS).fill(false);
    });
    if (!savedGrid) { // first-run friendly default
      var def = TEMPLATES['8ビート'];
      LANES.forEach(function (l) { grid[l.key] = def[l.key].slice(); });
    }

    var bpm = clamp(Number(ctx.storage(ID + '-bpm').get(120)) || 120, 60, 200);
    var playing = false;

    // scheduler clocks
    var schedTimer = null;
    var rafId = null;
    var nextNoteTime = 0;
    var currentStep = 0;
    var stepQueue = [];   // {step,time} scheduled-ahead for the visual playhead
    var loopAnchor = 0;   // ac.currentTime at the start of the current/most-recent loop

    // looper tracks: {id,name,buffer,gain,source,muted,solo,vol,row}
    var tracks = [];
    var trackSeq = 0;

    // recorder
    var rec = null, micStream = null, recChunks = [], armed = false, recArmTimer = null, recStopTimer = null, discarding = false, pendingMic = false, micReq = 0;

    /* ---------------- DOM build ---------------- */
    var cellEls = {}; // key -> [16 buttons]

    var stepNums = ctx.el('div', { class: 'studio-stepnums' });
    stepNums.appendChild(ctx.el('span', null, '')); // label gutter
    for (var s = 0; s < STEPS; s++) {
      stepNums.appendChild(ctx.el('span', { class: (s % 4 === 0 ? 'studio-beat' : '') }, ctx.el('i', null, String((s % 4) + 1))));
    }

    var gridEl = ctx.el('div', { class: 'studio-grid' });
    LANES.forEach(function (lane) {
      gridEl.appendChild(ctx.el('div', { class: 'studio-lanelabel', style: { '--lc': lane.color } }, lane.label));
      cellEls[lane.key] = [];
      for (var i = 0; i < STEPS; i++) {
        (function (laneKey, idx, color) {
          var cell = ctx.el('button', {
            class: 'studio-cell' + (idx % 4 === 0 ? ' studio-beat' : ''),
            type: 'button',
            'aria-label': lane.label + ' ' + (idx + 1),
            style: { '--cc': color, '--cg': color } // fill color + matching glow tint
          });
          on(cell, 'pointerdown', function (e) {
            e.preventDefault();
            toggleCell(laneKey, idx);
          });
          cellEls[laneKey].push(cell);
          gridEl.appendChild(cell);
        })(lane.key, i, lane.color);
      }
    });

    var gridWrap = ctx.el('div', { class: 'studio-gridwrap' }, stepNums, gridEl);

    function paintCell(laneKey, idx) {
      var cell = cellEls[laneKey][idx];
      if (grid[laneKey][idx]) cell.classList.add('studio-on'); else cell.classList.remove('studio-on');
    }
    function paintAll() {
      LANES.forEach(function (l) { for (var i = 0; i < STEPS; i++) paintCell(l.key, i); });
    }
    function toggleCell(laneKey, idx) {
      grid[laneKey][idx] = !grid[laneKey][idx];
      paintCell(laneKey, idx);
      ctx.sound.play('toggle');
      ctx.haptic(8);
      persistGrid();
      // audition the hit when not playing
      if (!playing && grid[laneKey][idx] && ac) triggerDrum(laneKey, ac.currentTime + 0.001);
    }
    function persistGrid() { ctx.storage(ID + '-grid').set(grid); }

    /* ---------------- transport controls ---------------- */
    var playBtn = ctx.el('button', { class: 'btn btn-green squish studio-play', type: 'button' }, '▶ 再生');
    on(playBtn, 'click', function () { togglePlay(); });

    var bpmVal = ctx.el('b', null, bpm + ' BPM');
    var bpmSlider = ctx.el('input', { type: 'range', min: '60', max: '200', step: '1', value: String(bpm), 'aria-label': 'BPM' });
    on(bpmSlider, 'input', function () {
      bpm = clamp(parseInt(bpmSlider.value, 10) || 120, 60, 200);
      bpmVal.textContent = bpm + ' BPM';
      ctx.storage(ID + '-bpm').set(bpm);
    });
    on(bpmSlider, 'change', function () { ctx.sound.play('tick'); });
    var bpmBox = ctx.el('div', { class: 'studio-bpm' }, ctx.el('span', { class: 'studio-vol-lbl' }, 'テンポ'), bpmSlider, bpmVal);

    var masterSlider = ctx.el('input', { type: 'range', min: '0', max: '100', step: '1', value: String(Math.round((master ? master.gain.value : 0.9) * 100)), 'aria-label': 'マスター音量' });
    on(masterSlider, 'input', function () {
      var v = clamp(parseInt(masterSlider.value, 10) / 100, 0, 1);
      if (master && ac) master.gain.setTargetAtTime(v, ac.currentTime, 0.01);
      ctx.storage(ID + '-master').set(v);
    });
    var masterBox = ctx.el('div', { class: 'studio-vol' }, ctx.el('span', null, '🔊 全体'), masterSlider);

    var bar = ctx.el('div', { class: 'studio-bar' },
      ctx.el('div', { class: 'studio-grp' }, playBtn),
      bpmBox,
      masterBox
    );

    /* ---------------- template buttons ---------------- */
    var tplRow = ctx.el('div', { class: 'studio-tpls' }, ctx.el('span', { class: 'studio-note' }, 'パターン:'));
    Object.keys(TEMPLATES).forEach(function (name) {
      var b = ctx.el('button', { class: 'btn btn-ghost squish studio-tplbtn', type: 'button' }, name);
      on(b, 'click', function () { loadTemplate(name); });
      tplRow.appendChild(b);
    });
    var clearBtn = ctx.el('button', { class: 'btn btn-ghost squish studio-tplbtn', type: 'button' }, 'クリア');
    on(clearBtn, 'click', function () {
      LANES.forEach(function (l) { grid[l.key] = new Array(STEPS).fill(false); });
      paintAll(); persistGrid(); ctx.sound.play('back'); ctx.toast('グリッドを空にしたのだ');
    });
    tplRow.appendChild(clearBtn);

    function loadTemplate(name) {
      var t = TEMPLATES[name]; if (!t) return;
      LANES.forEach(function (l) { grid[l.key] = (t[l.key] || new Array(STEPS).fill(false)).slice(); });
      paintAll(); persistGrid(); ctx.sound.play('select'); ctx.haptic(12); ctx.toast(name + ' を読み込んだのだ');
    }

    /* ---------------- looper UI ---------------- */
    var recAvailable = !!(ac && navigator.mediaDevices && navigator.mediaDevices.getUserMedia &&
      typeof window.MediaRecorder !== 'undefined' && window.isSecureContext);

    var recBtn = ctx.el('button', { class: 'btn btn-primary squish studio-recbtn', type: 'button' },
      ctx.el('span', { class: 'studio-dot' }), '録音');
    var recNote = ctx.el('div', { class: 'studio-note' });
    var recRow = ctx.el('div', { class: 'studio-recrow' }, recBtn, recNote);

    if (!recAvailable) {
      recBtn.classList.add('studio-disabled');
      recBtn.disabled = true;
      recNote.textContent = '録音はGitHub Pages(https)かlocalhostで使えるのだ';
    } else {
      recNote.textContent = '再生しながら1ループぶんを重ね録りするのだ。';
      on(recBtn, 'click', function () { onRecordClick(); });
    }

    var trackList = ctx.el('div', { class: 'studio-tracks' });
    var emptyMsg = ctx.el('div', { class: 'studio-empty' }, 'まだトラックは無いのだ。録音すると重なるのだ。');
    trackList.appendChild(emptyMsg);

    var looperSection = ctx.el('div', { class: 'studio-section' },
      ctx.el('h3', null, '🎙 多重録音ルーパー'),
      recRow,
      trackList
    );

    /* ---------------- assemble ---------------- */
    root.appendChild(ctx.el('div', { class: 'studio-pane' },
      ctx.el('div', { class: 'studio-h' },
        ctx.el('h2', null, '🎹 スタジオ'),
        ctx.el('span', { class: 'studio-sub' }, 'ドラムマシン + 重ね録りルーパー')
      ),
      bar,
      tplRow,
      gridWrap,
      looperSection
    ));

    paintAll();

    /* ================= DRUM SYNTHESIS ================= */
    // build a short white-noise buffer once (reused; sources are one-shot)
    var noiseBuf = null;
    function getNoise() {
      if (noiseBuf || !ac) return noiseBuf;
      var len = Math.floor(ac.sampleRate * 0.5);
      noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return noiseBuf;
    }

    function kick(t) {
      var o = ac.createOscillator(); var g = ac.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(50, t + 0.12);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.9, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      o.connect(g); g.connect(drumBus);
      o.start(t); o.stop(t + 0.35);
    }
    function snare(t) {
      // noise body
      var n = ac.createBufferSource(); n.buffer = getNoise();
      var nf = ac.createBiquadFilter(); nf.type = 'highpass'; nf.frequency.value = 1200;
      var ng = ac.createGain();
      ng.gain.setValueAtTime(0.6, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      n.connect(nf); nf.connect(ng); ng.connect(drumBus);
      n.start(t); n.stop(t + 0.2);
      // body tone
      var o = ac.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(180, t);
      var og = ac.createGain();
      og.gain.setValueAtTime(0.5, t);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      o.connect(og); og.connect(drumBus);
      o.start(t); o.stop(t + 0.12);
    }
    function hat(t) {
      var n = ac.createBufferSource(); n.buffer = getNoise();
      var f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 8000;
      var g = ac.createGain();
      g.gain.setValueAtTime(0.34, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      n.connect(f); f.connect(g); g.connect(drumBus);
      n.start(t); n.stop(t + 0.06);
    }
    function clap(t) {
      var f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 0.8;
      var g = ac.createGain(); g.connect(drumBus);
      f.connect(g);
      var offs = [0, 0.01, 0.02, 0.035];
      g.gain.setValueAtTime(0.0001, t);
      offs.forEach(function (off) {
        g.gain.setValueAtTime(0.5, t + off);
        g.gain.exponentialRampToValueAtTime(0.18, t + off + 0.009);
      });
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      var n = ac.createBufferSource(); n.buffer = getNoise();
      n.connect(f);
      n.start(t); n.stop(t + 0.2);
    }
    var DRUMS = { kick: kick, snare: snare, hat: hat, clap: clap };
    function triggerDrum(laneKey, t) {
      if (!ac) return;
      try { DRUMS[laneKey](t); } catch (e) {}
    }

    /* ================= SCHEDULER (lookahead) ================= */
    var LOOKAHEAD = 0.1;       // seconds to schedule ahead
    var TICK_MS = 25;          // scheduler interval
    function secPerStep() { return 60 / bpm / 4; }
    function loopLen() { return secPerStep() * STEPS; }

    function scheduleStep(step, time) {
      LANES.forEach(function (l) { if (grid[l.key][step]) triggerDrum(l.key, time); });
    }

    function scheduler() {
      if (!ac || destroyed) return;
      while (nextNoteTime < ac.currentTime + LOOKAHEAD) {
        scheduleStep(currentStep, nextNoteTime);
        stepQueue.push({ step: currentStep, time: nextNoteTime });
        var step = secPerStep();
        nextNoteTime += step;
        currentStep = (currentStep + 1) % STEPS;
        if (currentStep === 0) loopAnchor = nextNoteTime; // next loop starts here
      }
    }

    var shownStep = -1;
    function visualLoop() {
      if (destroyed) return;
      if (ac) {
        var now = ac.currentTime;
        var draw = shownStep;
        while (stepQueue.length && stepQueue[0].time <= now) {
          draw = stepQueue.shift().step;
        }
        if (draw !== shownStep) {
          if (shownStep >= 0) markColumn(shownStep, false);
          markColumn(draw, true);
          shownStep = draw;
        }
      }
      rafId = requestAnimationFrame(visualLoop);
    }
    function markColumn(step, on) {
      LANES.forEach(function (l) {
        var c = cellEls[l.key][step];
        if (!c) return;
        if (on) c.classList.add('studio-here'); else c.classList.remove('studio-here');
      });
    }
    function clearPlayhead() {
      if (shownStep >= 0) markColumn(shownStep, false);
      shownStep = -1;
    }

    function startTransport() {
      if (!ac) { ctx.toast('このブラウザは音が出せないのだ'); return; }
      if (playing) return;
      playing = true;
      if (ac.state === 'suspended') { try { ac.resume(); } catch (e) {} }
      currentStep = 0;
      nextNoteTime = ac.currentTime + 0.06;
      loopAnchor = nextNoteTime;
      stepQueue = [];
      schedTimer = setInterval(scheduler, TICK_MS);
      scheduler();
      rafId = requestAnimationFrame(visualLoop);
      // (re)start all looper sources locked to the loop grid
      startAllTrackSources(loopAnchor);
      playBtn.textContent = '■ 停止';
      playBtn.classList.remove('btn-green'); playBtn.classList.add('btn-accent');
      ctx.sound.play('success');
    }
    function stopTransport() {
      if (!playing) return;
      playing = false;
      if (schedTimer) { clearInterval(schedTimer); schedTimer = null; }
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      stepQueue = [];
      clearPlayhead();
      stopAllTrackSources();
      playBtn.textContent = '▶ 再生';
      playBtn.classList.remove('btn-accent'); playBtn.classList.add('btn-green');
      ctx.sound.play('back');
      // abort any pending recording arm
      cancelArm();
    }
    function togglePlay() { if (playing) stopTransport(); else startTransport(); }

    /* ================= LOOPER TRACK PLAYBACK ================= */
    // Each track plays via an AudioBufferSourceNode with loop=true, started at a loop boundary.
    function startTrackSource(track, atTime) {
      if (!ac || !track.buffer) return;
      stopTrackSource(track);
      var src = ac.createBufferSource();
      src.buffer = track.buffer;
      src.loop = true;
      src.connect(track.gain);
      // align: start at the next loop boundary >= atTime
      var startAt = Math.max(atTime, ac.currentTime + 0.02);
      try { src.start(startAt); } catch (e) {}
      track.source = src;
    }
    function stopTrackSource(track) {
      if (track.source) {
        try { track.source.stop(0); } catch (e) {}
        try { track.source.disconnect(); } catch (e) {}
        track.source = null;
      }
    }
    function startAllTrackSources(atTime) {
      tracks.forEach(function (t) { startTrackSource(t, atTime); });
    }
    function stopAllTrackSources() {
      tracks.forEach(function (t) { stopTrackSource(t); });
    }

    function anySolo() { return tracks.some(function (t) { return t.solo; }); }
    function applyTrackGain(track) {
      if (!ac) return;
      var solo = anySolo();
      var audible = solo ? track.solo : !track.muted;
      var v = audible ? track.vol : 0;
      track.gain.gain.setTargetAtTime(v, ac.currentTime, 0.01);
    }
    function applyAllGains() { tracks.forEach(applyTrackGain); }

    function addTrack(buffer, name) {
      if (!ac) return;
      var g = ac.createGain();
      g.connect(master);
      var track = {
        id: ++trackSeq, name: name, buffer: buffer, gain: g,
        source: null, muted: false, solo: false, vol: 0.9, row: null
      };
      track.gain.gain.value = 0.9;
      tracks.push(track);
      buildTrackRow(track);
      applyAllGains();
      if (playing) startTrackSource(track, loopAnchor + Math.max(0, Math.ceil((ac.currentTime - loopAnchor) / loopLen())) * loopLen());
    }

    function removeTrack(track) {
      stopTrackSource(track);
      try { track.gain.disconnect(); } catch (e) {}
      var i = tracks.indexOf(track);
      if (i >= 0) tracks.splice(i, 1);
      if (track.row && track.row.parentNode) track.row.parentNode.removeChild(track.row);
      if (!tracks.length) trackList.appendChild(emptyMsg);
      applyAllGains();
      ctx.sound.play('back');
    }

    function buildTrackRow(track) {
      if (emptyMsg.parentNode) emptyMsg.parentNode.removeChild(emptyMsg);

      var nameEl = ctx.el('div', { class: 'studio-tname', text: track.name }); // textContent -> XSS-safe

      var muteBtn = ctx.el('button', { class: 'btn btn-ghost squish studio-mini', type: 'button' }, 'ミュート');
      on(muteBtn, 'click', function () {
        track.muted = !track.muted;
        muteBtn.classList.toggle('studio-active', track.muted);
        applyAllGains(); ctx.sound.play('toggle');
      });

      var soloBtn = ctx.el('button', { class: 'btn btn-ghost squish studio-mini studio-solo', type: 'button' }, 'ソロ');
      on(soloBtn, 'click', function () {
        track.solo = !track.solo;
        soloBtn.classList.toggle('studio-active', track.solo);
        // refresh all solo buttons' visuals already reflect each track.solo
        applyAllGains(); ctx.sound.play('toggle');
      });

      var volSlider = ctx.el('input', { type: 'range', min: '0', max: '100', step: '1', value: String(Math.round(track.vol * 100)), 'aria-label': track.name + ' 音量' });
      on(volSlider, 'input', function () {
        track.vol = clamp(parseInt(volSlider.value, 10) / 100, 0, 1);
        applyTrackGain(track);
      });

      var delBtn = ctx.el('button', { class: 'btn btn-ghost squish studio-mini', type: 'button', 'aria-label': '削除' }, '🗑');
      on(delBtn, 'click', function () { removeTrack(track); });

      var ctl = ctx.el('div', { class: 'studio-tctl' }, muteBtn, soloBtn, volSlider, delBtn);
      track.row = ctx.el('div', { class: 'studio-track' }, nameEl, ctl);
      trackList.appendChild(track.row);
    }

    /* ================= RECORDING ================= */
    // Fully abort the recorder: stop+discard any active recording, release the mic,
    // clear all pending timers. Reachable from the cancel button and from stopTransport().
    function cancelArm() {
      armed = false;
      // invalidate any in-flight getUserMedia request so its late resolution releases the mic
      pendingMic = false; micReq++;
      recBtn.classList.remove('studio-armed');
      if (recArmTimer) { clearTimeout(recArmTimer); recArmTimer = null; }
      if (recStopTimer) { clearTimeout(recStopTimer); recStopTimer = null; }
      if (rec) {
        // discard: onRecStopped sees discarding=true and skips track creation
        discarding = true;
        if (rec.state === 'recording') { try { rec.stop(); } catch (e) {} }
        else {
          // armed-but-not-started (still waiting on the loop boundary): finalize now
          rec = null;
          discarding = false;
          if (micStream) { micStream.getTracks().forEach(function (t) { t.stop(); }); micStream = null; }
        }
      } else if (micStream) {
        micStream.getTracks().forEach(function (t) { t.stop(); }); micStream = null;
      }
      setRecLabel(false);
    }
    function setRecLabel(recording) {
      recBtn.lastChild.textContent = recording ? '録音中…' : (armed ? '待機中…' : '録音');
    }

    function onRecordClick() {
      if (!recAvailable || !ac) return;
      if (rec && rec.state === 'recording') { try { rec.stop(); } catch (e) {} return; }
      if (armed || rec || pendingMic) { cancelArm(); return; }
      if (!playing) { ctx.toast('再生してから録音するのだ'); ctx.sound.play('error'); return; }

      pendingMic = true;
      var myReq = ++micReq;
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        if (myReq === micReq) pendingMic = false;
        // backed out (unmount) / cancelled (micReq bumped) / aborted while the prompt was open: release the mic
        if (destroyed || !playing || micStream || myReq !== micReq) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
        micStream = stream;
        beginArmedRecording(stream);
      }).catch(function (err) {
        if (myReq === micReq) pendingMic = false;
        if (destroyed || myReq !== micReq) return;
        ctx.toast('マイクが使えなかったのだ');
        ctx.sound.play('error');
      });
    }

    function beginArmedRecording(stream) {
      if (destroyed || !playing || !ac) {
        stream.getTracks().forEach(function (t) { t.stop(); });
        micStream = null;
        return;
      }
      var mr;
      try { mr = new MediaRecorder(stream); }
      catch (e) {
        stream.getTracks().forEach(function (t) { t.stop(); }); micStream = null;
        ctx.toast('録音に対応していないのだ'); return;
      }
      rec = mr; recChunks = [];
      armed = true;
      recBtn.classList.add('studio-armed');
      setRecLabel(false);

      mr.ondataavailable = function (e) { if (e.data && e.data.size) recChunks.push(e.data); };
      mr.onstop = function () { onRecStopped(); };

      // wait for the next loop boundary, then record exactly one loop length
      var len = loopLen();
      var now = ac.currentTime;
      var sinceAnchor = now - loopAnchor;
      var toBoundary = (len - (sinceAnchor % len)) % len;
      if (toBoundary < 0.04) toBoundary += len; // ensure a full beat of count-in feel
      var startDelayMs = toBoundary * 1000;

      recArmTimer = setTimeout(function () {
        recArmTimer = null;
        if (destroyed || !playing || !rec || rec !== mr) {
          // aborted while waiting for the loop boundary: cancelArm releases mic + flags
          cancelArm();
          return;
        }
        try { mr.start(); } catch (e) { cancelArm(); return; }
        armed = false;
        recBtn.classList.remove('studio-armed');
        setRecLabel(true);
        ctx.sound.play('coin');
        recStopTimer = setTimeout(function () {
          recStopTimer = null;
          if (mr.state === 'recording') { try { mr.stop(); } catch (e) {} }
        }, Math.max(120, len * 1000));
      }, Math.max(0, startDelayMs));
    }

    function blobToArrayBuffer(blob) {
      if (blob.arrayBuffer) return blob.arrayBuffer();
      return new Promise(function (resolve, reject) {
        var fr = new FileReader();
        fr.onload = function () { resolve(fr.result); };
        fr.onerror = function () { reject(fr.error || new Error('read failed')); };
        fr.readAsArrayBuffer(blob);
      });
    }
    function decode(ab) {
      // Safari (older) uses the callback form and returns undefined.
      return new Promise(function (resolve, reject) {
        var ret;
        try { ret = ac.decodeAudioData(ab, resolve, reject); } catch (e) { reject(e); return; }
        if (ret && typeof ret.then === 'function') ret.then(resolve, reject);
      });
    }

    function onRecStopped() {
      var localChunks = recChunks; recChunks = [];
      var stoppedRec = rec; rec = null;
      var wasDiscarding = discarding; discarding = false;
      setRecLabel(false);
      // release mic
      if (micStream) { micStream.getTracks().forEach(function (t) { t.stop(); }); micStream = null; }
      if (destroyed || !ac || wasDiscarding) return;
      if (!localChunks.length) { return; }
      var blob = new Blob(localChunks, { type: (stoppedRec && stoppedRec.mimeType) || 'audio/webm' });
      blobToArrayBuffer(blob).then(function (ab) {
        if (destroyed || !ac) return null;
        return decode(ab);
      }).then(function (buffer) {
        if (destroyed || !ac || !buffer) return;
        addTrack(buffer, 'トラック ' + (tracks.length + 1));
        ctx.sound.play('success');
        ctx.toast('トラックを追加したのだ');
      }).catch(function () {
        if (destroyed) return;
        ctx.toast('録音の取り込みに失敗したのだ');
        ctx.sound.play('error');
      });
    }

    /* ---------------- keyboard ---------------- */
    on(window, 'keydown', function (e) {
      if (destroyed || e.repeat) return;
      var tag = (e.target && e.target.tagName) || '';
      // ignore Space while typing in a field or when a button/slider has focus
      // (the focused control gets its own native Space activation)
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'SELECT') return;
      if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); togglePlay(); }
    });

    /* ---------------- cleanup ---------------- */
    mount._cleanup = function () {
      destroyed = true;
      // scheduler + raf
      if (schedTimer) { clearInterval(schedTimer); schedTimer = null; }
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      if (recArmTimer) { clearTimeout(recArmTimer); recArmTimer = null; }
      if (recStopTimer) { clearTimeout(recStopTimer); recStopTimer = null; }
      // recorder
      if (rec) { try { if (rec.state !== 'inactive') rec.stop(); } catch (e) {} rec = null; }
      if (micStream) { try { micStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} micStream = null; }
      // looper sources (loop=true -> would play forever)
      tracks.forEach(function (t) {
        stopTrackSource(t);
        try { t.gain.disconnect(); } catch (e) {}
      });
      tracks = [];
      // bus + master
      if (drumBus) { try { drumBus.disconnect(); } catch (e) {} drumBus = null; }
      if (master) { try { master.disconnect(); } catch (e) {} master = null; }
      // listeners
      listeners.forEach(function (l) { try { l[0].removeEventListener(l[1], l[2], l[3]); } catch (e) {} });
      listeners = [];
    };
  }

  Arcade.register({
    id: ID,
    category: 'studio',
    title: 'スタジオ',
    subtitle: '多重録音ルーパー',
    icon: '🎹',
    color: '#ff4d8d',
    order: 10,
    mount: mount,
    unmount: function () { if (mount._cleanup) mount._cleanup(); }
  });
})();
