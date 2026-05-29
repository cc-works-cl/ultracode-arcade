/* ============================================================
   ULTRACODE ARCADE — core runtime
   Classic-script global registry (no build step, no modules).
   Every component file calls  Arcade.register({...})  — see CONTRACT.md.
   Load order: this file FIRST, then component files, all at end of <body>.
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- tiny DOM helper ---------------- */
  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        var v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'style' && typeof v === 'object') {
          // NOTE: Object.assign can't set CSS custom properties (--x); use setProperty for those.
          for (var sk in v) {
            if (!Object.prototype.hasOwnProperty.call(v, sk)) continue;
            if (sk.charCodeAt(0) === 45 && sk.charCodeAt(1) === 45) node.style.setProperty(sk, v[sk]);
            else node.style[sk] = v[sk];
          }
        }
        else if (k === 'dataset' && typeof v === 'object') Object.assign(node.dataset, v);
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
        else if (v === true) node.setAttribute(k, '');
        else node.setAttribute(k, v);
      }
    }
    for (var i = 2; i < arguments.length; i++) append(node, arguments[i]);
    return node;
  }
  function append(node, child) {
    if (child == null || child === false) return;
    if (Array.isArray(child)) { child.forEach(function (c) { append(node, c); }); return; }
    node.appendChild(child.nodeType ? child : document.createTextNode(String(child)));
  }

  /* ---------------- shared AudioContext ---------------- */
  var actx = null;
  function audio() {
    if (!actx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) actx = new AC();
    }
    if (actx && actx.state === 'suspended') { try { actx.resume(); } catch (e) {} }
    return actx;
  }

  /* ---------------- sound preferences ---------------- */
  var SoundPrefs = {
    get enabled() { var v = localStorage.getItem('arcade:sound'); return v === null ? true : v === '1'; },
    set enabled(b) { try { localStorage.setItem('arcade:sound', b ? '1' : '0'); } catch (e) {} }
  };

  /* ---------------- SFX synthesis ---------------- */
  function tone(freqs, opts) {
    var ac = audio(); if (!ac || !SoundPrefs.enabled) return;
    opts = opts || {};
    var t0 = ac.currentTime;
    var dur = opts.dur || 0.12;
    var gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(opts.vol || 0.16, t0 + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    gain.connect(ac.destination);
    (Array.isArray(freqs) ? freqs : [freqs]).forEach(function (f, i) {
      var o = ac.createOscillator();
      o.type = opts.type || 'triangle';
      var st = t0 + i * (opts.stagger || 0);
      o.frequency.setValueAtTime(f, st);
      if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(opts.slideTo, st + dur);
      o.connect(gain);
      o.start(st);
      o.stop(st + dur + 0.03);
    });
  }
  function noise(opts) {
    var ac = audio(); if (!ac || !SoundPrefs.enabled) return;
    opts = opts || {};
    var dur = opts.dur || 0.12;
    var len = Math.floor(ac.sampleRate * dur);
    var buf = ac.createBuffer(1, len, ac.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, opts.decay || 2);
    var src = ac.createBufferSource(); src.buffer = buf;
    var f = ac.createBiquadFilter(); f.type = opts.filter || 'highpass'; f.frequency.value = opts.cutoff || 1200;
    var g = ac.createGain(); g.gain.value = opts.vol || 0.12;
    src.connect(f); f.connect(g); g.connect(ac.destination);
    src.start();
  }

  var SOUNDS = {
    pop:     function () { tone([520, 780], { type: 'triangle', dur: 0.12, stagger: 0.045, vol: 0.2 }); },
    select:  function () { tone([620, 940], { type: 'triangle', dur: 0.13, stagger: 0.05, vol: 0.2 }); },
    tab:     function () { tone(480, { type: 'square', dur: 0.05, vol: 0.1 }); },
    back:    function () { tone([520, 340], { type: 'triangle', dur: 0.12, stagger: 0.05, vol: 0.15 }); },
    toggle:  function () { tone(680, { type: 'square', dur: 0.04, vol: 0.1 }); },
    move:    function () { tone(300, { type: 'sine', dur: 0.045, vol: 0.09 }); },
    tick:    function () { tone(900, { type: 'square', dur: 0.03, vol: 0.07 }); },
    coin:    function () { tone([920, 1380], { type: 'square', dur: 0.1, stagger: 0.06, vol: 0.13 }); },
    success: function () { tone([660, 880, 1320], { type: 'triangle', dur: 0.18, stagger: 0.07, vol: 0.18 }); },
    win:     function () { tone([523, 659, 784, 1047], { type: 'triangle', dur: 0.2, stagger: 0.09, vol: 0.2 }); },
    error:   function () { tone([220, 150], { type: 'sawtooth', dur: 0.16, stagger: 0.05, vol: 0.14 }); },
    lose:    function () { tone([300, 200, 120], { type: 'sawtooth', dur: 0.22, stagger: 0.09, vol: 0.16 }); },
    hit:     function () { noise({ dur: 0.06, cutoff: 1800, vol: 0.1 }); },
    whoosh:  function () { noise({ dur: 0.18, filter: 'bandpass', cutoff: 800, vol: 0.08, decay: 1.4 }); }
  };

  var soundButtons = [];
  var sound = {
    play: function (name) { try { (SOUNDS[name] || SOUNDS.pop)(); } catch (e) {} },
    get enabled() { return SoundPrefs.enabled; },
    toggle: function () {
      SoundPrefs.enabled = !SoundPrefs.enabled;
      soundButtons.forEach(function (p) { p(); });
      if (SoundPrefs.enabled) this.play('toggle');
      return SoundPrefs.enabled;
    }
  };

  /* ---------------- ctx helpers ---------------- */
  var injected = {};
  function injectCSS(id, css) {
    if (injected[id]) return;
    injected[id] = true;
    var s = document.createElement('style');
    s.id = 'css-' + id; s.textContent = css;
    document.head.appendChild(s);
  }
  function haptic(ms) { try { if (navigator.vibrate) navigator.vibrate(ms || 10); } catch (e) {} }
  function storage(ns) {
    var key = 'arcade:' + ns;
    return {
      get: function (def) { try { var v = localStorage.getItem(key); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
      set: function (val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }
    };
  }
  var toastTimer = null;
  function toast(msg, ms) {
    var t = document.getElementById('arcade-toast');
    if (!t) { t = el('div', { id: 'arcade-toast', class: 'arcade-toast' }); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, ms || 1600);
  }
  var isTouch = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;

  /* Auto-resizing, DPR-correct canvas. Call fit.stop() in unmount().
     onResize(fit) is invoked after every size change; draw using CSS pixels
     (the 2d context is pre-scaled by devicePixelRatio). */
  function fitCanvas(canvas, onResize) {
    var fit = { w: 0, h: 0, dpr: 1, stop: function () {} };
    function apply() {
      var parent = canvas.parentElement; if (!parent) return;
      var rect = parent.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      fit.w = Math.max(1, Math.floor(rect.width));
      fit.h = Math.max(1, Math.floor(rect.height));
      fit.dpr = dpr;
      canvas.width = Math.round(fit.w * dpr);
      canvas.height = Math.round(fit.h * dpr);
      canvas.style.width = fit.w + 'px';
      canvas.style.height = fit.h + 'px';
      var c2 = canvas.getContext('2d');
      if (c2) c2.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (onResize) onResize(fit);
    }
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(apply);
      // observe parent next frame so layout is settled
      requestAnimationFrame(function () { if (canvas.parentElement) { ro.observe(canvas.parentElement); apply(); } });
      fit.stop = function () { ro.disconnect(); };
    } else {
      window.addEventListener('resize', apply);
      requestAnimationFrame(apply);
      fit.stop = function () { window.removeEventListener('resize', apply); };
    }
    return fit;
  }

  function makeCtx() {
    return {
      sound: sound, audio: audio, el: el,
      injectCSS: injectCSS, haptic: haptic, storage: storage,
      toast: toast, isTouch: isTouch, fitCanvas: fitCanvas
    };
  }

  /* ---------------- registry ---------------- */
  var CATEGORIES = [
    { id: 'game',   label: 'ゲーム',   icon: '🎮' },
    { id: 'tool',   label: 'ツール',   icon: '🛠️' },
    { id: 'studio', label: 'スタジオ', icon: '🎹' }
  ];
  var registry = [];
  var booted = false, current = null, dom = {};

  function register(def) {
    if (!def || !def.id || !def.category || typeof def.mount !== 'function') {
      console.warn('Arcade.register: invalid definition', def); return;
    }
    if (registry.some(function (m) { return m.id === def.id; })) return;
    registry.push(def);
    if (booted) renderTiles();
  }

  function tilesFor(cat) {
    return registry.filter(function (m) { return m.category === cat; })
      .sort(function (a, b) { return (a.order || 100) - (b.order || 100) || a.title.localeCompare(b.title, 'ja'); });
  }

  function soundButton() {
    var b = el('button', { class: 'icon-btn squish', 'aria-label': '効果音オン・オフ' });
    function paint() { b.textContent = SoundPrefs.enabled ? '🔊' : '🔇'; }
    paint();
    b.addEventListener('click', function () { sound.toggle(); });
    soundButtons.push(paint);
    return b;
  }

  function buildShell() {
    var app = document.getElementById('app') || document.body;
    app.innerHTML = '';

    var home = el('div', { class: 'home', id: 'home' });
    var header = el('header', { class: 'app-header' },
      el('div', { class: 'brand' },
        el('span', { class: 'brand-mark' }, '◆'),
        el('span', { class: 'brand-name', html: 'ULTRA<b>ARCADE</b>' })
      ),
      soundButton()
    );
    var tabs = el('nav', { class: 'tabs', role: 'tablist' });
    CATEGORIES.forEach(function (cat, i) {
      tabs.appendChild(el('button', {
        class: 'tab' + (i === 0 ? ' active' : ''), role: 'tab', dataset: { cat: cat.id },
        onClick: function () { selectTab(cat.id); }
      }, el('span', { class: 'tab-ico' }, cat.icon), el('span', null, cat.label)));
    });
    var grids = el('div', { class: 'grids' });
    CATEGORIES.forEach(function (cat, i) {
      grids.appendChild(el('div', { class: 'grid' + (i === 0 ? ' active' : ''), dataset: { cat: cat.id } }));
    });
    home.append(header, tabs, grids);

    var screen = el('div', { class: 'screen', id: 'screen' });
    var sTitle = el('h2', { class: 'screen-title' }, '');
    var sContent = el('div', { class: 'screen-content', id: 'screen-content' });
    screen.append(
      el('header', { class: 'screen-header' },
        el('button', { class: 'icon-btn back-btn squish', 'aria-label': '戻る', onClick: function () { history.back(); } }, '←'),
        sTitle,
        soundButton()
      ),
      sContent
    );

    app.append(home, screen);
    dom = { app: app, tabs: tabs, grids: grids, screen: screen, sTitle: sTitle, sContent: sContent };
    renderTiles();
  }

  function renderTiles() {
    if (!dom.grids) return;
    CATEGORIES.forEach(function (cat) {
      var grid = dom.grids.querySelector('.grid[data-cat="' + cat.id + '"]');
      grid.innerHTML = '';
      var items = tilesFor(cat.id);
      if (!items.length) { grid.appendChild(el('div', { class: 'empty' }, 'まだ準備中なのだ…')); return; }
      items.forEach(function (m) {
        grid.appendChild(el('button', {
          class: 'tile squish', style: { '--accent': m.color || '#3d7bff' },
          onClick: function () { openModule(m); }
        },
          el('span', { class: 'tile-ico' }, m.icon || '🎲'),
          el('div', null,
            el('div', { class: 'tile-title' }, m.title),
            m.subtitle ? el('div', { class: 'tile-sub' }, m.subtitle) : null
          )
        ));
      });
    });
  }

  function selectTab(catId) {
    dom.tabs.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('active', t.dataset.cat === catId); });
    dom.grids.querySelectorAll('.grid').forEach(function (g) { g.classList.toggle('active', g.dataset.cat === catId); });
    sound.play('tab'); haptic(8);
  }

  function openModule(m, skipPush) {
    if (current) teardown();
    sound.play('select'); haptic(12);
    current = m;
    dom.sTitle.textContent = m.title;
    dom.sContent.innerHTML = '';
    document.body.classList.add('in-module');
    dom.screen.classList.add('open');
    try { m.mount(dom.sContent, makeCtx()); }
    catch (e) {
      console.error('[arcade] mount failed:', m.id, e);
      dom.sContent.appendChild(el('div', { class: 'error-pane' }, '起動に失敗したのだ: ' + (e && e.message)));
    }
    if (!skipPush) history.pushState({ arcadeModule: m.id }, '', '#' + m.id);
  }

  function teardown() {
    if (!current) return;
    try { if (current.unmount) current.unmount(); } catch (e) { console.error('[arcade] unmount:', e); }
    current = null;
    dom.screen.classList.remove('open');
    document.body.classList.remove('in-module');
    setTimeout(function () { if (!current) dom.sContent.innerHTML = ''; }, 340);
  }

  window.addEventListener('popstate', function () {
    if (current) { sound.play('back'); haptic(10); teardown(); }
    else {
      var h = location.hash.replace('#', '');
      var m = h && registry.filter(function (x) { return x.id === h; })[0];
      if (m) openModule(m, true);
    }
  });

  function boot() {
    if (booted) return;
    booted = true;
    buildShell();
    var h = location.hash.replace('#', '');
    if (h) { var m = registry.filter(function (x) { return x.id === h; })[0]; if (m) openModule(m, true); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* ---------------- public API ---------------- */
  window.Arcade = {
    version: '1.0.0',
    register: register,
    categories: CATEGORIES,
    sound: sound,
    audio: audio,
    _registry: registry
  };
})();
