/* Hero canvas: scattered steps -> the ReproBridge arch -> four component lanes (teaser panel (a), animated).
 * Dashes drift through a flow field on the left; some fade before reaching the bridge (decisions lost in
 * conversations and shell histories). Survivors snap onto the deck, cross under the arch (hangers pulse),
 * and leave along four lanes coloured like the paper's components. Schematic only: no data is encoded.
 * Stops when offscreen or the tab is hidden; reduced motion draws one settled frame. */
(function () {
  'use strict';
  var hero = document.getElementById('top');
  if (!hero) return;
  var canvas = hero.querySelector('.hero-canvas');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var lanesEl = hero.querySelector('.hero-lanes');
  var lede = hero.querySelector('.hero-lede');
  var css = function (n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); };
  var LANES = [
    { label: 'refined code', v: '--c-code' }, { label: 'environment', v: '--c-env' },
    { label: 'launchers', v: '--c-launch' }, { label: 'guide', v: '--c-guide' }
  ];
  var reduced = window.RB ? window.RB.reduced() : false;
  var W = 0, H = 0, dpr = 1, G = null, parts = [], C = null, running = false, raf = 0, last = 0, visible = true;
  var pulses = [], laneGlow = [0, 0, 0, 0], seed = 7;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

  function hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgba(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a.toFixed(3) + ')'; }

  function readColors() {
    C = {
      dust: mix(hexToRgb(css('--ink-4') || '#A3B1BC'), hexToRgb(css('--ink-3') || '#5E7183'), 0.45),
      gold: hexToRgb(css('--bridge-stroke') || '#D9B776'),
      goldInk: hexToRgb(css('--bridge-ink') || '#9A7426'),
      lanes: LANES.map(function (l) { return hexToRgb(css(l.v) || '#527AA0'); }),
      dark: document.documentElement.getAttribute('data-theme') === 'dark'
    };
    if (lanesEl) [].forEach.call(lanesEl.children, function (s, i) { s.style.setProperty('--lane', css(LANES[i].v)); });
  }

  function layout() {
    var r = hero.getBoundingClientRect();
    W = r.width; H = r.height;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var stacked = W < 1080;
    var labelW = stacked ? (W < 520 ? 92 : 112) : 128;
    var x0, x1, y0, y1;
    if (!stacked) {
      var lr = lede ? lede.getBoundingClientRect().right - r.left : W * 0.5;
      x1 = W - 28 - labelW;
      x0 = Math.max(W * 0.36, lr - 180);
      if (x1 - x0 > 980) x0 = x1 - 980;
      y0 = H * 0.18; y1 = H * 0.86;
    } else {
      var band = W < 760 ? 210 : 250;
      x0 = 0; x1 = W - 18 - labelW; y1 = H - 46; y0 = y1 - band;
    }
    var span = x1 - x0, deckY = y0 + (y1 - y0) * (stacked ? 0.62 : 0.56);
    var ax0 = x0 + span * (stacked ? 0.36 : 0.50), ax1 = x0 + span * (stacked ? 0.71 : 0.77);
    var archH = Math.min((y1 - y0) * 0.36, (ax1 - ax0) * 0.36);
    var gap = Math.max(16, Math.min(30, (y1 - y0) * 0.085));
    G = {
      x0: x0, x1: x1, y0: y0, y1: y1, deckY: deckY, ax0: ax0, ax1: ax1, archH: archH, stacked: stacked,
      textRight: stacked ? -1e9 : (lede ? lede.getBoundingClientRect().right - r.left : x0),
      lanes: [-1.5, -0.5, 0.5, 1.5].map(function (k) { return deckY + k * gap * 1.55; }),
      hangers: [], speed: Math.max(0.55, span / 620)
    };
    var nH = 9;
    for (var i = 1; i <= nH; i++) G.hangers.push(ax0 + (ax1 - ax0) * i / (nH + 1));
    pulses = G.hangers.map(function () { return 0; });
    if (lanesEl) {
      if (!lanesEl.children.length) LANES.forEach(function (l) { var s = document.createElement('span'); s.textContent = l.label; lanesEl.appendChild(s); });
      [].forEach.call(lanesEl.children, function (s, i) { s.style.left = (x1 + 12) + 'px'; s.style.top = G.lanes[i] + 'px'; });
    }
    var n = Math.round(Math.max(110, Math.min(360, span * (y1 - y0) / 820)));
    parts = [];
    for (var j = 0; j < n; j++) parts.push(spawn(true));
  }

  function archY(x) {
    var t = (x - G.ax0) / (G.ax1 - G.ax0);
    return G.deckY - G.archH * 4 * t * (1 - t);
  }

  function spawn(initial) {
    var p = {};
    p.x = initial ? G.x0 + (G.ax1 - G.x0) * rnd() * 1.1 - 40 : G.x0 - 30 - rnd() * 60;
    p.y = G.y0 + (G.y1 - G.y0) * (0.08 + 0.84 * rnd());
    p.len = 6 + rnd() * 16;
    p.v = (0.55 + rnd() * 0.55) * G.speed;
    p.a = 0; p.amax = 0.22 + rnd() * 0.34;
    p.lost = rnd() < 0.45;
    p.fadeAt = G.x0 + (G.ax0 - G.x0) * (0.25 + rnd() * 0.6);
    p.off = (rnd() - 0.5) * 6;
    p.lane = Math.floor(rnd() * 4);
    p.ph = rnd() * 6.283;
    p.ang = 0; p.state = 0; p.dead = false;
    if (initial && p.x > G.ax0) { p.state = p.x > G.ax1 ? 2 : 1; p.y = G.deckY + p.off; }
    return p;
  }

  function step(dt, t) {
    var approach = Math.max(50, (G.ax0 - G.x0) * 0.42);
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      var vx = p.v * dt, target;
      if (p.x < G.ax0 - approach) {                      // drifting dust
        var n = Math.sin(p.x * 0.011 + t * 0.00042 + p.ph) + 0.6 * Math.sin(p.y * 0.017 - t * 0.00031 + p.ph * 1.7);
        p.ang += ((n * 0.55) - p.ang) * 0.05;
        p.x += vx * Math.cos(p.ang) * 0.82;
        p.y += vx * Math.sin(p.ang) * 0.82;
        if (p.lost && p.x > p.fadeAt) { p.a -= 0.006 * dt; if (p.a <= 0) p.dead = true; }
        else p.a = Math.min(p.amax, p.a + 0.01 * dt);
        if (p.y < G.y0 - 30 || p.y > G.y1 + 30) p.dead = true;
      } else if (p.x < G.ax0) {                           // captured: pulled onto the deck
        var k = 1 - (G.ax0 - p.x) / approach;          // 0 at the funnel mouth, 1 at the abutment
        target = G.deckY + p.off;
        p.y += (target - p.y) * Math.min(1, (0.006 + k * k * k * 0.22) * dt);
        p.ang += (Math.atan2(target - p.y, 60) - p.ang) * 0.15;
        p.x += vx;
        p.a = Math.min(0.75, p.a + 0.015 * dt);
        if (p.lost) p.lost = false;
      } else if (p.x <= G.ax1) {                          // on the bridge
        p.y += (G.deckY - 3 + p.off * 0.6 - p.y) * 0.3;
        p.ang *= 0.8;
        var px = p.x;
        p.x += vx * 1.05;
        for (var hI = 0; hI < G.hangers.length; hI++) if (px < G.hangers[hI] && p.x >= G.hangers[hI]) pulses[hI] = Math.min(1, pulses[hI] + 0.35);
        p.a = Math.min(0.85, p.a + 0.02 * dt);
        p.state = 1;
      } else {                                            // leaving along a component lane
        var s = Math.min(1, (p.x - G.ax1) / (G.x1 - G.ax1));
        var e = s < 0.5 ? 2 * s * s : 1 - Math.pow(-2 * s + 2, 2) / 2;
        var ty = G.deckY + p.off * (1 - s) + (G.lanes[p.lane] - G.deckY) * e;
        p.ang = Math.atan2(ty - p.y, vx || 1) * 0.6;
        p.y = ty; p.x += vx;
        p.state = 2;
        if (p.x > G.x1) { laneGlow[p.lane] = Math.min(1, laneGlow[p.lane] + 0.22); p.dead = true; }
      }
      if (p.dead) parts[i] = spawn(false);
    }
    for (var q = 0; q < pulses.length; q++) pulses[q] *= Math.pow(0.94, dt);
    for (var l = 0; l < 4; l++) laneGlow[l] *= Math.pow(0.96, dt);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    var g = G, gold = C.gold, i;
    // lanes
    ctx.lineWidth = 1.2;
    for (i = 0; i < 4; i++) {
      ctx.strokeStyle = rgba(C.lanes[i], 0.22 + laneGlow[i] * 0.3);
      ctx.beginPath(); ctx.moveTo(g.ax1, g.deckY);
      var mx = g.ax1 + (g.x1 - g.ax1) * 0.5;
      ctx.bezierCurveTo(mx, g.deckY, mx, g.lanes[i], g.x1, g.lanes[i]);
      ctx.stroke();
      ctx.fillStyle = rgba(C.lanes[i], 0.55 + laneGlow[i] * 0.45);
      ctx.beginPath(); ctx.arc(g.x1 + 1, g.lanes[i], 2.6 + laneGlow[i] * 1.6, 0, 6.283); ctx.fill();
    }
    // bridge: hangers, arch, deck, abutments
    ctx.lineCap = 'round';
    for (i = 0; i < g.hangers.length; i++) {
      var hx = g.hangers[i];
      ctx.strokeStyle = rgba(gold, 0.32 + pulses[i] * 0.55);
      ctx.lineWidth = 1 + pulses[i] * 0.8;
      ctx.beginPath(); ctx.moveTo(hx, archY(hx)); ctx.lineTo(hx, g.deckY); ctx.stroke();
    }
    ctx.strokeStyle = rgba(gold, 0.95); ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(g.ax0, g.deckY);
    ctx.quadraticCurveTo((g.ax0 + g.ax1) / 2, g.deckY - 2 * g.archH, g.ax1, g.deckY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(g.ax0 - 16, g.deckY); ctx.lineTo(g.ax1 + 16, g.deckY); ctx.stroke();
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(g.ax0, g.deckY); ctx.lineTo(g.ax0 - 6, g.deckY + 14); ctx.moveTo(g.ax0, g.deckY); ctx.lineTo(g.ax0 + 6, g.deckY + 14);
    ctx.moveTo(g.ax1, g.deckY); ctx.lineTo(g.ax1 - 6, g.deckY + 14); ctx.moveTo(g.ax1, g.deckY); ctx.lineTo(g.ax1 + 6, g.deckY + 14); ctx.stroke();
    // particles
    for (i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p.a <= 0.01) continue;
      var col, a = p.a, len = p.len;
      if (p.x < g.ax0) {
        var k = Math.max(0, 1 - (g.ax0 - p.x) / Math.max(50, (g.ax0 - g.x0) * 0.42));
        col = mix(C.dust, C.goldInk, k * k); len = p.len * (1 - k * 0.35);
        if (p.x < g.textRight + 30) a *= Math.max(0.24, Math.min(1, (p.x - g.textRight + 170) / 200));
      } else if (p.x <= g.ax1) { col = C.goldInk; len = p.len * 0.6; }
      else {
        var s = Math.min(1, (p.x - g.ax1) / (g.x1 - g.ax1));
        col = mix(C.goldInk, C.lanes[p.lane], Math.min(1, s * 1.6)); len = p.len * 0.65;
      }
      if (a <= 0.01) continue;
      var cx = Math.cos(p.ang) * len / 2, cy = Math.sin(p.ang) * len / 2;
      ctx.strokeStyle = rgba(col, Math.min(1, a * (C.dark ? 1.15 : 1)));
      ctx.lineWidth = p.x < g.ax0 ? 1.6 : 2;
      ctx.beginPath(); ctx.moveTo(p.x - cx, p.y - cy); ctx.lineTo(p.x + cx, p.y + cy); ctx.stroke();
    }
  }

  function frame(ts) {
    raf = 0;
    if (!running) return;
    var dt = last ? Math.min(3, (ts - last) / 16.67) : 1;
    last = ts;
    step(dt, ts);
    draw();
    raf = requestAnimationFrame(frame);
  }
  function start() { if (running || reduced || !G) return; running = true; last = 0; raf = requestAnimationFrame(frame); }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
  function settle() { for (var i = 0; i < 900; i++) step(1, i * 16.67); draw(); }

  function init() {
    readColors();
    layout();
    if (lanesEl) lanesEl.classList.add('ready');
    if (reduced) settle(); else { for (var i = 0; i < 240; i++) step(1, i * 16.67); draw(); start(); }
  }

  var rt = 0;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { var was = running; stop(); layout(); if (reduced || !was) settle(); else start(); }, 120);
  });
  document.addEventListener('rb:themechange', function () { readColors(); if (!running) draw(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else if (visible) start(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      visible = es[0].isIntersecting;
      if (visible && !document.hidden) start(); else stop();
    }, { threshold: 0 }).observe(hero);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { init(); }); else init();
})();
