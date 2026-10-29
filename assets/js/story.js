/* Walkthrough (#story): one real reproduction, HELIX, in five steps ("Recovered once, reused after").
 * Desktop (viewport >= 1080 x 640, motion allowed): the section becomes a tall track whose sticky frame (under the nav)
 * holds the copy column and a stage card. The scroll position inside the track picks one of five discrete steps
 * (step = floor(progress * 5)); CSS transitions tween the scene between steps. Kickers become buttons that scroll to
 * their step. Otherwise (reduced motion, short or narrow viewports, print) each caption gets a still of its scene,
 * drawn by the same renderer. Without JS the captions read as a plain list.
 * Facts: RB_DATA.helix (the paper's HELIX worked example) and the HELIX row of the paper inventory
 * (RB_DATA.papers.list; first evaluation, Codex auditing). The repository timeline is schematic. Every colour comes
 * from a CSS class, so a theme switch needs no redraw. */
(function () {
  'use strict';
  var sec = document.getElementById('story');
  var C = window.RBCharts, RB = window.RB, D = window.RB_DATA;
  if (!sec || !C || !RB || !D || !D.helix) return;
  var track = sec.querySelector('.story-track'), ol = sec.querySelector('.story-steps');
  var host = sec.querySelector('.story-stage'), liveEl = sec.querySelector('.story-live');
  var steps = [].slice.call(sec.querySelectorAll('.story-step'));
  if (!track || !ol || !host || steps.length !== 5) return;

  /* ---------------------------------------------------------------- facts */
  var HX = D.helix, TK = (HX.tasks || []).slice(0, 2);
  if (TK.length !== 2 || !HX.raw_config || !HX.rra_config) return;
  var LIST = (D.papers && D.papers.list) || [], paper = null, mi = -1;
  LIST.forEach(function (p) { if (p.id === HX.paper_id) paper = p; });
  (D.models || []).forEach(function (m, i) { if (m.name === HX.model) mi = i; });
  /* inventory (first evaluation, Codex auditing): successful HELIX tasks for this model, Raw and RRA */
  var INV = paper && mi >= 0 ? { raw: paper.raw[mi], rra: paper.rra[mi], n: paper.tasks } : null;
  var F = {
    model: HX.model, rev: HX.revision, entry: HX.guide_entry, launcher: HX.launcher,
    bsRaw: HX.raw_config.batch_size, lrRaw: HX.raw_config.learning_rate,
    bsRra: HX.rra_config.batch_size, lrRra: HX.rra_config.learning_rate,
    nPapers: LIST.length, paperId: HX.paper_id
  };
  /* number-line domains (MAE) that hold each interval and both recorded values; axes carry no tick labels */
  var DOMAIN = { T004: [0.115, 0.160], T006: [0.360, 0.520] };
  function dom(t) {
    if (DOMAIN[t.id]) return DOMAIN[t.id];
    var lo = Math.min(t.interval[0], t.raw, t.rra), hi = Math.max(t.interval[1], t.raw, t.rra), pad = (hi - lo) * .2;
    return [lo - pad, hi + pad];
  }
  function f5(v) { return (+v).toFixed(5); }
  function inside(t, v) { return v >= t.interval[0] && v <= t.interval[1]; }
  function side(t, v) { return v > t.interval[1] ? 'above' : v < t.interval[0] ? 'below' : 'inside'; }
  function iv(t) { return '[' + f5(t.interval[0]) + ', ' + f5(t.interval[1]) + ']'; }
  var T0 = TK[0], T1 = TK[1];
  var LABEL = [
    'HELIX, metric MAE (lower is better). Compatibility intervals: ' + T0.id + ' ' + iv(T0) + ', ' + T1.id + ' ' + iv(T1) + '. A result counts only inside its interval and after an independent execution audit.',
    F.model + ' on the raw codebase restores the paper architecture but keeps the shipped batch size ' + F.bsRaw + ' and learning rate ' + F.lrRaw + '.',
    'Raw-code MAEs: ' + T0.id + ' ' + f5(T0.raw) + ', ' + side(T0, T0.raw) + ' ' + iv(T0) + '; ' + T1.id + ' ' + f5(T1.raw) + ', ' + side(T1, T1.raw) + ' ' + iv(T1) + '.',
    'Construction: guide entry ' + F.entry + ' identifies revision ' + F.rev + ', whose architecture matches the paper, as the source for batch size ' + F.bsRra + ' and learning rate ' + F.lrRra + '; the ' + F.launcher + ' launcher makes the choice executable. The repository timeline is schematic.',
    'A later session with the refined artifact: ' + T0.id + ' ' + f5(T0.rra) + ' and ' + T1.id + ' ' + f5(T1.rra) + ', ' + (inside(T0, T0.rra) && inside(T1, T1.rra) ? 'both inside their intervals.' : 'see intervals above.') +
      (INV ? ' On HELIX, ' + F.model + ' succeeds on ' + INV.raw + ' of ' + INV.n + ' tasks with raw code and ' + INV.rra + ' of ' + INV.n + ' with the refined artifact.' : '')
  ];
  var KICK = steps.map(function (li) { var k = li.querySelector('.story-step-k'); return k ? k.textContent.replace(/\s+/g, ' ').trim() : ''; });
  var PARA = steps.map(function (li) { var p = li.querySelector('p'); return p ? p.textContent.replace(/\s+/g, ' ').trim() : ''; });

  /* ---------------------------------------------------------------- svg helpers */
  var S = C.svg, H = C.h;
  function txt(g, x, y, s, cls, anchor) { return S('text', { x: x, y: y, class: cls, 'text-anchor': anchor || null, text: s }, g); }
  /* one <text> made of styled runs: parts = [[string, class, dx], ...] */
  function runs(g, x, y, parts, anchor) {
    var t = S('text', { x: x, y: y, 'text-anchor': anchor || null }, g);
    parts.forEach(function (p) { if (p) S('tspan', { class: p[1], dx: p[2] || null, text: p[0] }, t); });
    return t;
  }
  function tw(el, guess) { var w = 0; try { w = el.getComputedTextLength(); } catch (e) { w = 0; } return w > 0 ? w : guess; }
  function est(s, fs) { return String(s).length * fs * .58; }
  /* greedy word wrap into tspans; returns the number of lines */
  function wrap(g, x, y, s, cls, maxW, lh) {
    var t = S('text', { x: x, y: y, class: cls }, g), words = String(s).split(' '), line = [], n = 1;
    var ts = S('tspan', { x: x }, t);
    words.forEach(function (w) {
      line.push(w); ts.textContent = line.join(' ');
      if (line.length > 1 && tw(ts, est(ts.textContent, 11)) > maxW) {
        line.pop(); ts.textContent = line.join(' ');
        line = [w]; ts = S('tspan', { x: x, dy: lh, text: w }, t); n++;
      }
    });
    return n;
  }
  function icon(g, name, x, y) {
    var M = function (a, b) { return (x + a).toFixed(1) + ' ' + (y + b).toFixed(1); };
    switch (name) {
      case 'ring': return S('circle', { cx: x, cy: y, r: 3.8, class: 'i-ring' }, g);
      case 'dot': return S('circle', { cx: x, cy: y, r: 4.2, class: 'i-dot' }, g);
      case 'arc': return S('path', { d: 'M' + M(-6, 3.2) + 'Q' + M(0, -6.5) + ' ' + M(6, 3.2) + 'M' + M(-6.5, 3.4) + 'L' + M(6.5, 3.4), class: 'i-arc' }, g);
      case 'paper': return S('path', { d: 'M' + M(-3.6, -4.8) + 'h5l2.2 2.2v7.4h-7.2z M' + M(-1.8, -.6) + 'h3.6 M' + M(-1.8, 1.8) + 'h3.6', class: 'i-line' }, g);
      case 'tasks': return S('path', { d: 'M' + M(-4, -3) + 'h1.2 M' + M(-1, -3) + 'h5 M' + M(-4, 0) + 'h1.2 M' + M(-1, 0) + 'h5 M' + M(-4, 3) + 'h1.2 M' + M(-1, 3) + 'h5', class: 'i-line' }, g);
      case 'x': return S('path', { d: 'M' + M(-3, -3) + 'L' + M(3, 3) + 'M' + M(3, -3) + 'L' + M(-3, 3), class: 'i-x' }, g);
      case 'play': return S('path', { d: 'M' + M(-2.6, -4) + 'L' + M(3.8, 0) + 'L' + M(-2.6, 4) + 'Z', class: 'i-play' }, g);
      case 'shield': return S('path', { d: 'M' + M(0, -9) + 'L' + M(7.5, -6) + 'L' + M(7.5, 0) + 'C' + M(7.5, 5) + ' ' + M(4, 8) + ' ' + M(0, 9.5) + 'C' + M(-4, 8) + ' ' + M(-7.5, 5) + ' ' + M(-7.5, 0) + 'L' + M(-7.5, -6) + 'Z M' + M(-3.4, .2) + 'L' + M(-.8, 2.8) + 'L' + M(3.8, -2), class: 'i-shield' }, g);
    }
    return null;
  }

  /* ---------------------------------------------------------------- the scene
     One SVG laid out in user units (wide: 640 wide; narrow: 360 wide) and scaled by its viewBox. Every animated
     element is registered with a 5-letter state string, one letter per step:
       - hidden   o on   d dim   f faint   g ghost   h highlighted   r flagged (red hairline)
     plus optional per-step CSS transforms. set(step) swaps the classes; CSS tweens opacity, colour and transform. */
  var CODE = { '-': '', o: 'on', d: 'dim', f: 'faint', g: 'ghost', h: 'hl', r: 'red' };
  var ALLC = ['on', 'dim', 'faint', 'ghost', 'hl', 'red'];

  function Scene(mount, mode, zones) {
    var nar = mode === 'narrow', W = nar ? 360 : 640, P = nar ? 18 : 28;
    var canvas = H('div', { class: 'st-canvas' });
    var svg = S('svg', { class: 'st-svg' + (nar ? ' is-nar' : ''), role: 'img', focusable: 'false', viewBox: '0 0 ' + W + ' 100' });
    canvas.appendChild(svg);
    mount.appendChild(canvas);
    var reg = [], notes = [], adoptY = 0;

    function st(el, s, o) {
      o = o || {};
      el.classList.add('s-v');
      reg.push({ el: el, s: s, tf: o.tf || null, d: o.d || 0, c: null, t: null });
      return el;
    }
    /* a group that slides up a little as it appears */
    function rise(el, s, d) {
      return st(el, s, { d: d, tf: s.split('').map(function (c) { return c === '-' ? 'translate(0px, 7px)' : 'translate(0px, 0px)'; }) });
    }
    function note(text, x, y, s, anchor) {
      var el = H('span', { class: 'tag-note st-note' + (anchor === 'end' ? ' is-end' : ''), 'aria-hidden': 'true', text: text });   // the svg label says it too
      canvas.appendChild(el);
      notes.push({ el: el, x: x, y: y, s: s, anchor: anchor });
    }
    function card(g, x, y, w, h, cls) { return S('rect', { x: x, y: y, width: w, height: h, rx: nar ? 12 : 14, class: cls || 's-card' }, g); }
    function chip(g, x, y, parts, cls, anchor) {
      var cg = S('g', { class: 's-chip ' + cls }, g);
      var r = S('rect', { y: y, height: 22, rx: 11, class: 's-chip-bg' }, cg);
      var t = runs(cg, 0, y + 15, parts);
      var w = Math.round(tw(t, parts.reduce(function (a, p) { return a + est(p[0], 11); }, 0)) + 20);
      var left = anchor === 'end' ? x - w : x;
      r.setAttribute('x', left); r.setAttribute('width', w); t.setAttribute('x', left + 10);
      return cg;
    }

    /* ---------------------------------------------------- HUD: the paper, the tasks, the metric, and who is running */
    function zHud(y0) {
      var g = S('g', { class: 's-hud' }, svg);
      runs(g, P, y0 + (nar ? 28 : 36), [['HELIX', 's-title'], ['·', 's-sub', 8], ['time-series imputation', 's-sub', 6]]);
      var ids = TK.map(function (t) { return t.id; }).join(' · ');
      runs(g, P, y0 + (nar ? 48 : 58), [['TASKS', 's-k'], [ids, 's-kv', 7], ['MAE ↓', 's-kv', nar ? 12 : 18], ['· TWO-SIDED INTERVAL', 's-k', 5]]);
      var cy = nar ? y0 + 60 : y0 + 24, ch = 26;
      [['ooo--', 'raw', 'Raw codebase · ' + F.model, 'ring'],
       ['---o-', 'con', 'Construction', 'arc'],
       ['----o', 'rra', 'Refined artifact · fresh session', 'dot']].forEach(function (c) {
        var cg = S('g', { class: 's-sess ' + c[1] }, g);
        var r = S('rect', { y: cy, height: ch, rx: ch / 2, class: 's-sess-bg' }, cg);
        var t = txt(cg, 0, cy + 17.2, c[2], 's-sess-t');
        var w = Math.round(tw(t, est(c[2], 12)) + 42);
        var x = nar ? P : W - P - w;
        r.setAttribute('x', x); r.setAttribute('width', w); t.setAttribute('x', x + 30);
        icon(cg, c[3], x + 16, cy + ch / 2);
        st(cg, c[0], { d: .14 });
      });
      var ry = y0 + (nar ? 100 : 76);
      S('line', { x1: P, x2: W - P, y1: ry, y2: ry, class: 's-rule' }, g);
      return nar ? 100 : 76;
    }

    /* ---------------------------------------------------- results: two number lines with compatibility intervals */
    function zRes(y0) {
      var g = S('g', { class: 's-res' }, svg);
      txt(g, P, y0 + 30, 'COMPATIBILITY INTERVALS', 's-k');
      var x0 = P + (nar ? 44 : 60), x1 = W - P - (nar ? 2 : 4);
      var rows = nar ? [y0 + 84, y0 + 158] : [y0 + 86, y0 + 162];
      TK.forEach(function (t, k) { line(g, t, rows[k], x0, x1, k); });
      return nar ? 192 : 206;
    }
    function line(g, t, cy, x0, x1, k) {
      var d = dom(t), sx = C.linear(d[0], d[1], x0, x1);
      txt(g, P, cy + 4.5, t.id, 's-task');
      S('line', { x1: x0, x2: x1, y1: cy, y2: cy, class: 's-axis' }, g);
      sx.ticks(nar ? 5 : 9).forEach(function (v) {
        var x = sx(v);
        if (x > x0 + 1 && x < x1 - 1) S('line', { x1: x, x2: x, y1: cy + 5, y2: cy + 9, class: 's-tick' }, g);
      });
      [x0, x1].forEach(function (x) { S('line', { x1: x, x2: x, y1: cy - 5, y2: cy + 5, class: 's-cap' }, g); });
      var a = sx(t.interval[0]), b = sx(t.interval[1]);
      st(S('rect', { x: a, y: cy - 11, width: b - a, height: 22, rx: 5, class: 's-band' }, g), 'hoooo');
      txt(g, a, cy + 29, f5(t.interval[0]), 's-bnd', 'middle');
      txt(g, b, cy + 29, f5(t.interval[1]), 's-bnd', 'middle');
      var rx = sx(t.raw), qx = sx(t.rra), rawIn = inside(t, t.raw), rraIn = inside(t, t.rra);
      if (!rawIn) {   // the gap between the interval and the raw result (step 3)
        var hiSide = t.raw > t.interval[1], ga = hiSide ? b + 3 : rx + 9, gb = hiSide ? rx - 9 : a - 3;
        if (gb > ga) st(S('line', { x1: ga, x2: gb, y1: cy, y2: cy, class: 's-gap' }, g), '--od-', { d: .34 + k * .1 });
      }
      var c1 = Math.min(qx, rx) + 8, c2 = Math.max(qx, rx) - 8;   // dumbbell: grows from the raw ring as the dot glides in
      if (c2 > c1) st(S('line', { x1: c1, x2: c2, y1: cy, y2: cy, class: 's-conn s-grow' + (qx < rx ? ' from-r' : '') }, g), '----o',
        { d: .1 + k * .1, tf: ['scaleX(0)', 'scaleX(0)', 'scaleX(0)', 'scaleX(0)', 'scaleX(1)'] });
      st(S('circle', { cx: rx, cy: cy, r: 6.5, class: 's-ring s-pop' }, g), '--odg', { d: .12 + k * .1, tf: ['scale(.2)', 'scale(.2)', 'scale(1)', 'scale(1)', 'scale(1)'] });
      var off = 'translate(' + (rx - qx).toFixed(2) + 'px, 0px)';
      st(S('circle', { cx: qx, cy: cy, r: 6.5, class: 's-dot' }, g), '----o', { d: .1 + k * .1, tf: [off, off, off, off, 'translate(0px, 0px)'] });
      label(g, rx, cy - 21, f5(t.raw), 'raw', rawIn, x0, x1, ['--odg', '--od-'], .3 + k * .1);
      label(g, qx, cy - 21, f5(t.rra), 'rra', rraIn, x0, x1, ['----o', '----o'], .62 + k * .1);
    }
    /* value + inside/outside tag, centred over its marker and kept inside the drawing */
    function label(g, x, y, val, kind, isIn, x0, x1, states, d) {
      var v = txt(g, 0, y, val, 's-num ' + kind), wv = tw(v, est(val, 11));
      var tg = S('g', { class: 's-tag ' + (isIn ? 'in' : 'out') }, g);
      var r = S('rect', { y: y - 11, height: 15, rx: 7.5, class: 's-tag-bg' }, tg);
      var word = isIn ? 'INSIDE' : 'OUTSIDE', tt = txt(tg, 0, y - .6, word, 's-tag-t', 'middle');
      var wt = Math.round(tw(tt, est(word, 8.5) * 1.2) + 13), tot = wv + 6 + wt;
      var left = Math.max(x0 - 14, Math.min(x - tot / 2, x1 + 12 - tot));
      v.setAttribute('x', left.toFixed(1));
      r.setAttribute('x', (left + wv + 6).toFixed(1)); r.setAttribute('width', wt);
      tt.setAttribute('x', (left + wv + 6 + wt / 2).toFixed(1));
      st(v, states[0], { d: d }); st(tg, states[1], { d: d + .08 });
    }

    /* ---------------------------------------------------- configuration card */
    function config(g, x, y, w, col) {
      txt(g, x + 16, y + 26, 'RUN CONFIGURATION', 's-k');
      S('line', { x1: x + 16, x2: x + w - 16, y1: y + 38, y2: y + 38, class: 's-rule' }, g);
      var rows = [
        ['Architecture', [[[['paper', 's-cv'], [' ✓', 's-ok'], [' restored', 's-cp']], 'arch', '-oooo', .2]]],
        ['Batch size', [[[[F.bsRaw, 's-cv'], [' · shipped', 's-cp']], 'ship', '-or--', .26], [[[F.bsRra, 's-cv'], [' · rev ' + F.rev, 's-cp']], 'rec', '---oo', .5]]],
        ['Learning rate', [[[[F.lrRaw, 's-cv'], [' · shipped', 's-cp']], 'ship', '-or--', .32], [[[F.lrRra, 's-cv'], [' · rev ' + F.rev, 's-cp']], 'rec', '---oo', .56]]]
      ];
      var pitch = col ? 54 : 36;
      rows.forEach(function (r, i) {
        var ly = y + (col ? 64 : 62) + i * pitch;
        txt(g, x + 16, col ? ly : ly + 4.5, r[0], 's-lab');
        var cx = col ? x + 16 : x + w - 14, cy = col ? ly + 9 : ly - 11, an = col ? 'start' : 'end';
        st(chip(g, cx, cy, [['—', 's-cp']], 'pend', an), 'o----');
        r[1].forEach(function (c) { st(chip(g, cx, cy, c[0], c[1], an), c[2], { d: c[3] }); });
      });
      return col ? 64 + 2 * pitch + 9 + 22 + 18 : 62 + 2 * pitch + 26;
    }

    /* ---------------------------------------------------- right-hand panels (one per phase) */
    function crit(g, x, y, w) {
      txt(g, x + 16, y + 26, 'A RESULT COUNTS ONLY IF', 's-k');
      S('line', { x1: x + 16, x2: x + w - 16, y1: y + 38, y2: y + 38, class: 's-rule' }, g);
      var tx = x + 66, mw = w - 66 - 16, cy = y + 64;
      /* icon: an interval band with a result inside and one outside, fed by five reference observations */
      var ix = x + 18;
      S('rect', { x: ix, y: cy - 10, width: 26, height: 12, rx: 3, class: 'i-band' }, g);
      S('circle', { cx: ix + 13, cy: cy - 4, r: 3.4, class: 'i-dot' }, g);
      S('circle', { cx: ix + 36, cy: cy - 4, r: 3.2, class: 'i-ring' }, g);
      for (var j = 0; j < 5; j++) S('circle', { cx: ix + 3 + j * 5, cy: cy + 9, r: 1.5, class: 'i-ref' }, g);
      var n1 = wrap(g, tx, cy, 'It lands inside the compatibility interval', 's-pb', mw, 15);
      var n2 = wrap(g, tx, cy + n1 * 15 + 2, 'anchored by five human-verified reference observations', 's-p', mw, 14);
      var y2 = cy + n1 * 15 + n2 * 14 + 16;
      S('line', { x1: tx, x2: x + w - 16, y1: y2, y2: y2, class: 's-rule s-dash' }, g);
      var cy2 = y2 + 26;
      icon(g, 'shield', ix + 13, cy2 - 4);
      var n3 = wrap(g, tx, cy2, 'It passes an independent execution audit', 's-pb', mw, 15);
      var n4 = wrap(g, tx, cy2 + n3 * 15 + 2, 'a separate Auditor checks execution evidence', 's-p', mw, 14);
      return cy2 + n3 * 15 + n4 * 14 + 12 - y;
    }
    function flow(g, x, y, w, items, kind) {
      var cx = x, cy = y, h = 22, gap = 6;
      items.forEach(function (it) {
        var cg = S('g', { class: 's-in ' + kind + ' ' + it[1] }, g);
        var r = S('rect', { height: h, rx: h / 2, class: 's-in-bg' }, cg);
        var t = txt(cg, 0, 0, it[0], 's-in-t');
        var cw = Math.round(tw(t, est(it[0], 11.5)) + 34);
        if (cx > x && cx + cw > x + w) { cx = x; cy += h + gap; }
        r.setAttribute('x', cx); r.setAttribute('y', cy); r.setAttribute('width', cw);
        t.setAttribute('x', cx + 25); t.setAttribute('y', cy + 15);
        icon(cg, it[2], cx + 14, cy + h / 2);
        cx += cw + gap;
      });
      return cy + h - y;
    }
    function inputs(g, x, y, w, kind) {
      txt(g, x + 16, y + 26, 'FRESH REPRODUCER SESSION', 's-k');
      S('line', { x1: x + 16, x2: x + w - 16, y1: y + 38, y2: y + 38, class: 's-rule' }, g);
      txt(g, x + 16, y + 60, 'RECEIVES', 's-k2');
      var got = [['Paper', 'paper', 'paper'], ['Selected tasks', 'tasks', 'tasks'],
        kind === 'raw' ? ['Raw code', 'raw', 'ring'] : ['Refined artifact', 'rra', 'dot']];
      var cy = y + 68 + flow(g, x + 16, y + 68, w - 32, got, 'got');
      if (kind === 'rra') {   /* what the artifact carries for this choice */
        var inc = runs(g, x + 16, cy + 18, [['incl. guide entry ', 's-p'], [F.entry, 's-pm'], [' and the ', 's-p'], [F.launcher, 's-pm'], [' launcher', 's-p']]);
        if (tw(inc, 0) > w - 32) { g.removeChild(inc); runs(g, x + 16, cy + 18, [['incl. guide entry ', 's-p'], [F.entry, 's-pm'], [' and ', 's-p'], [F.launcher, 's-pm']]); }
        cy += 20;
      }
      txt(g, x + 16, cy + 26, 'WITHHELD', 's-k2');
      var out = [['Construction conversations', 'x', 'x'], ['Hidden reference observations', 'x', 'x'],
        [kind === 'raw' ? 'Refined artifact' : 'Raw code', 'x', 'x']];
      cy = cy + 34 + flow(g, x + 16, cy + 34, w - 32, out, 'out');
      return cy + 14 - y;
    }
    function cons(g, x, y, w) {
      txt(g, x + 16, y + 26, 'REPOSITORY HISTORY', 's-k');
      note('Schematic timeline', x + w - 14, y + 22, '---o-', 'end');
      S('line', { x1: x + 16, x2: x + w - 16, y1: y + 38, y2: y + 38, class: 's-rule' }, g);
      /* schematic history: unlabeled commits, except the revision the guide cites */
      var ty = y + 68, l0 = x + 26, l1 = x + w - 26, n = 9, key = 3, kx = l0 + key * (l1 - l0) / (n - 1);
      S('line', { x1: x + 12, x2: l0, y1: ty, y2: ty, class: 's-tl s-tl-fade' }, g);
      S('line', { x1: l0, x2: l1, y1: ty, y2: ty, class: 's-tl' }, g);
      S('line', { x1: l1, x2: x + w - 12, y1: ty, y2: ty, class: 's-tl s-tl-fade' }, g);
      for (var i = 0; i < n; i++) {
        if (i === key) continue;
        st(S('circle', { cx: l0 + i * (l1 - l0) / (n - 1), cy: ty, r: 3.6, class: 's-tl-dot' }, g), '---o-', { d: .18 + i * .035 });
      }
      st(S('circle', { cx: kx, cy: ty, r: 9, class: 's-pulse' }, g), '---o-', { d: .5 });
      st(S('circle', { cx: kx, cy: ty, r: 9, class: 's-halo' }, g), '---o-', { d: .34 });
      st(S('circle', { cx: kx, cy: ty, r: 4.6, class: 's-key' }, g), '---o-', { d: .3 });
      st(txt(g, kx, ty - 14, F.rev, 's-rev', 'middle'), '---o-', { d: .4 });
      /* the guide entry that cites it */
      var bx = x + 10, bw = w - 20, by = ty + 20;
      st(S('line', { x1: kx, x2: kx, y1: ty + 10, y2: by - 3, class: 's-cite' }, g), '---o-', { d: .48 });
      var box = S('g', {}, g);
      rise(box, '---o-', .52);
      var rect = S('rect', { x: bx, y: by, width: bw, height: 10, rx: 9, class: 's-entry' }, box);
      txt(box, bx + 12, by + 18, 'GUIDE · AMBIGUITY ENTRY ' + F.entry, 's-k s-k-guide');
      var lx = bx + 12, ry = by + 37, rowsA6 = [
        ['SOURCE', 'revision ' + F.rev + ', whose architecture matches the paper configuration'],
        ['ADOPTED', 'batch size ' + F.bsRra + ', learning rate ' + F.lrRra],
        ['WHY', 'repository history and architectural match']];
      var labs = rowsA6.map(function (r) { return txt(box, lx, 0, r[0], 's-k2'); });
      var vx = lx + Math.max.apply(null, labs.map(function (l) { return tw(l, est(l.textContent, 8.5) * 1.25); })) + 9, vw = bx + bw - 10 - vx;
      rowsA6.forEach(function (r, i) {
        labs[i].setAttribute('y', ry);
        if (i === 1) adoptY = ry - 3.5;   // the configuration arrow points from this row
        var nl = wrap(box, vx, ry, r[1], 's-p s-p-ink', vw, 14);
        ry += nl * 14 + 5;
      });
      rect.setAttribute('height', (ry - by + 4).toFixed(1));
      /* the launcher that makes the choice executable */
      var ly = ry + 14, lg = S('g', { class: 's-launch' }, g);
      rise(lg, '---o-', .66);
      var lr = S('rect', { x: bx, y: ly, height: 24, rx: 12, class: 's-launch-bg' }, lg);
      var lt = txt(lg, bx + 26, ly + 16.2, F.launcher, 's-launch-t');
      var lw = Math.round(tw(lt, est(F.launcher, 11)) + 36);
      lr.setAttribute('width', lw);
      icon(lg, 'play', bx + 14, ly + 12);
      var capX = bx + lw + 10, room = x + w - 8 - capX;
      var cap = txt(lg, capX, ly + 16, 'launcher · makes the choice executable', 's-p');
      if (tw(cap, est(cap.textContent, 11)) > room) {   // two short lines beside the chip instead
        lg.removeChild(cap);
        txt(lg, capX, ly + 9.5, 'LAUNCHER', 's-k2');
        cap = txt(lg, capX, ly + 21.5, 'makes the choice executable', 's-p');
        if (tw(cap, est(cap.textContent, 11)) > room) cap.textContent = 'makes it executable';
      }
      return ly + 24 + 14 - y;
    }

    /* ---------------------------------------------------- lower zone: configuration (left) + the phase panel (right) */
    function zLow(y0) {
      var g = S('g', { class: 's-low' }, svg);
      var top = y0 + 16, lw = 212, gap = 24, rx = P + lw + gap, rw = W - P - rx;
      var left = S('g', {}, g);
      st(left, 'foooo');
      var lc = card(left, P, top, lw, 10);
      var h = config(left, P, top, lw, true);
      var right = S('g', {}, g);
      var rc = card(right, rx, top, rw, 10);
      [['o----', function (pg) { return crit(pg, rx, top, rw); }],
       ['-oo--', function (pg) { return inputs(pg, rx, top, rw, 'raw'); }],
       ['---o-', function (pg) { return cons(pg, rx, top, rw); }],
       ['----o', function (pg) { return inputs(pg, rx, top, rw, 'rra'); }]].forEach(function (p) {
        var pg = S('g', {}, right);
        h = Math.max(h, p[1](pg));
        rise(pg, p[0], .24);
      });
      lc.setAttribute('height', h); rc.setAttribute('height', h);   // both cards share the tallest panel's height
      /* step 4: the entry's adopted values flow into the configuration */
      var ay = Math.round(adoptY || top + 150) + .5;
      st(S('path', { d: 'M' + (rx - 4) + ' ' + ay + 'H' + (P + lw + 6) + 'M' + (P + lw + 11) + ' ' + (ay - 4) + 'L' + (P + lw + 6) + ' ' + ay + 'L' + (P + lw + 11) + ' ' + (ay + 4), class: 's-feed' }, g), '---o-', { d: .7 });
      return 16 + h;
    }
    /* narrow stills: one full-width card per zone */
    function zCard(y0, fill) {
      var g = S('g', {}, svg), top = y0 + 12, w = W - 2 * P;
      var bg = card(g, P, top, w, 10);
      var h = fill(g, P, top, w);
      bg.setAttribute('height', h);
      return 12 + h;
    }

    var Z = {
      hud: zHud, res: zRes, low: zLow,
      cfg: function (y) { return zCard(y, function (g, x, t, w) { return config(g, x, t, w, false); }); },
      crit: function (y) { return zCard(y, crit); },
      inraw: function (y) { return zCard(y, function (g, x, t, w) { return inputs(g, x, t, w, 'raw'); }); },
      cons: function (y) { return zCard(y, cons); },
      inrra: function (y) { return zCard(y, function (g, x, t, w) { return inputs(g, x, t, w, 'rra'); }); }
    };
    var y = 0;
    zones.forEach(function (z) { y += Z[z](y); });
    var Ht = Math.ceil(y + (nar ? 16 : 18));
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + Ht);
    notes.forEach(function (n) {
      n.el.style.top = (n.y / Ht * 100).toFixed(3) + '%';
      if (n.anchor === 'end') n.el.style.right = ((W - n.x) / W * 100).toFixed(3) + '%';
      else n.el.style.left = (n.x / W * 100).toFixed(3) + '%';
    });

    function set(i, instant) {
      if (instant) svg.classList.add('no-anim');
      reg.forEach(function (r) {
        var c = CODE[r.s.charAt(i)] || '', t = r.tf ? r.tf[i] : null;
        if (r.c === c && r.t === t) return;
        r.el.style.transitionDelay = instant || !c ? '0s' : r.d + 's';
        if (r.c !== c) {
          ALLC.forEach(function (k) { r.el.classList.remove(k); });
          if (c) r.el.classList.add(c);
          r.c = c;
        }
        if (r.tf && r.t !== t) { r.el.style.transform = t; r.t = t; }
      });
      notes.forEach(function (n) { n.el.classList.toggle('on', n.s.charAt(i) !== '-'); });
      svg.setAttribute('aria-label', LABEL[i]);
      svg.setAttribute('data-step', i);
      if (instant) { void svg.getBoundingClientRect(); requestAnimationFrame(function () { svg.classList.remove('no-anim'); }); }
    }
    function fit() { var w = canvas.clientWidth; if (w) canvas.style.setProperty('--k', (w / W).toFixed(4)); }
    fit();
    return { set: set, fit: fit, W: W, H: Ht };
  }

  /* ---------------------------------------------------------------- stage footer (HTML: legend, then the result) */
  function foot(mount, only) {
    var f = H('div', { class: 'st-foot' });
    if (only === undefined || only < 4) {
      f.appendChild(H('div', { class: 'ft-leg legend' }, [
        H('span', {}, [H('i', { class: 'sw raw', 'aria-hidden': 'true' }), 'Raw codebase']),
        H('span', {}, [H('i', { class: 'sw rra', 'aria-hidden': 'true' }), 'Refined artifact']),
        H('span', {}, [H('i', { class: 'ft-band', 'aria-hidden': 'true' }), 'Compatibility interval'])
      ]));
    }
    if ((only === undefined || only === 4) && INV) {
      var more = H('a', { class: 'ft-more', href: '#coverage', html: 'See all ' + F.nPapers + ' papers <span aria-hidden="true">↑</span>' });
      more.addEventListener('click', function () { RB.emit('paper:select', { id: F.paperId, view: 'coverage' }); });
      f.appendChild(H('div', { class: 'ft-res' }, [
        H('span', { class: 'ft-k', text: 'HELIX · ' + F.model + ' · first evaluation · Codex auditing' }),
        H('span', { class: 'ft-n', html: '<b class="t-raw">' + INV.raw + ' of ' + INV.n + '</b><span class="ft-ar" aria-hidden="true">→</span><b class="t-rra">' + INV.rra + ' of ' + INV.n + '</b> tasks' }),
        more
      ]));
    }
    mount.appendChild(f);
    return f;
  }

  /* ---------------------------------------------------------------- walkthrough HUD: progress + skip, so readers who
   * only want to skim always see that the page continues (and can jump past the walkthrough) */
  function makeHud() {
    var segs = [], last = { show: false, ahead: null, step: -1 }, popped = false, hideT = 0;
    var el = H('div', { class: 'story-hud', role: 'region', 'aria-label': 'Walkthrough progress' });
    el.hidden = true;
    var badge = H('span', { class: 'sh-badge' }, [H('i', { 'aria-hidden': 'true' }), H('span', { class: 'sh-badge-t', text: 'Walkthrough' })]);
    var segWrap = H('span', { class: 'sh-segs', 'aria-hidden': 'true' });
    for (var k = 0; k < 5; k++) { var sg = H('i'); segs.push(sg); segWrap.appendChild(sg); }
    var stepT = H('span', { class: 'sh-step', 'aria-live': 'off' });
    var hint = H('span', { class: 'sh-hint', html: '<span class="sh-hint-t">Scroll</span><b class="sh-arrow" aria-hidden="true">↓</b>' });
    var skip = H('button', { type: 'button', class: 'sh-skip', html: '<span class="sh-skip-t">Skip walkthrough</span><span class="sh-skip-i" aria-hidden="true">⤓</span>' });
    skip.addEventListener('click', skipNow);
    el.appendChild(badge); el.appendChild(segWrap); el.appendChild(stepT); el.appendChild(hint); el.appendChild(skip);
    document.body.appendChild(el);
    function update(show, ahead, step) {
      if (show !== last.show) {
        clearTimeout(hideT);
        if (show) {
          el.hidden = false;
          void el.offsetWidth;
          el.classList.add('on');
          if (!popped && !RB.reduced()) { popped = true; el.classList.add('pop'); setTimeout(function () { el.classList.remove('pop'); }, 2600); }
        } else {
          el.classList.remove('on');
          hideT = setTimeout(function () { if (!last.show) el.hidden = true; }, 400);
        }
      }
      if (ahead !== last.ahead || step !== last.step) {
        el.classList.toggle('is-ahead', ahead);
        el.classList.toggle('is-last', !ahead && step === 4);
        segs.forEach(function (sg, j) { sg.classList.toggle('done', !ahead && j < step); sg.classList.toggle('cur', !ahead && j === step); });
        /* long labels on wide screens, short ones (.sh-s) on phones */
        stepT.innerHTML = ahead ? '<span class="sh-l">5 steps ahead</span><span class="sh-s">5 steps</span>'
          : '<span class="sh-l">Step </span>' + (step + 1) + '<span class="sh-l"> of </span><span class="sh-s">/</span>5';
        hint.querySelector('.sh-hint-t').textContent = ahead ? 'Scroll to step through' : (step === 4 ? 'Keep scrolling' : 'Scroll');
        skip.querySelector('.sh-skip-t').innerHTML = !ahead && step === 4 ? '<span class="sh-l">Next section</span><span class="sh-s">Next</span>'
          : '<span class="sh-l">Skip walkthrough</span><span class="sh-s">Skip</span>';
        if (!ahead && step !== last.step && last.step >= 0) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
      }
      last = { show: show, ahead: ahead, step: step };
    }
    function destroy() { clearTimeout(hideT); el.remove(); }
    return { update: update, destroy: destroy };
  }
  /* jump to whatever follows the walkthrough (the overview), then hand keyboard focus to it */
  function skipNow() {
    var t = sec.nextElementSibling;
    while (t && !/^(SECTION|HEADER|FOOTER)$/.test(t.tagName)) t = t.nextElementSibling;
    if (!t) return;
    var nh = parseFloat(C.css('--nav-h')) || 60;
    window.scrollTo({ top: Math.round(t.getBoundingClientRect().top + window.pageYOffset - nh + 1), behavior: RB.reduced() ? 'auto' : 'smooth' });
    setTimeout(function () { if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); }, RB.reduced() ? 0 : 900);
  }

  /* ---------------------------------------------------------------- live: pinned, one step at a time */
  function goLive() {
    var alive = true, active = -1, raf = 0, annT = 0, scene = null, nh = 60, hud = makeHud();
    function navH() { return nh; }
    function readNav() { nh = parseFloat(C.css('--nav-h')) || 60; }
    readNav();
    sec.classList.add('is-live');
    /* kickers become buttons that scroll to their step */
    var btns = steps.map(function (li, i) {
      var k = li.querySelector('.story-step-k');
      var b = H('button', { type: 'button', class: 'story-jump', text: KICK[i] });
      k.textContent = ''; k.appendChild(b);
      b.addEventListener('click', function () { go(i); });
      return b;
    });
    function build() {
      host.textContent = '';
      scene = Scene(host, 'wide', ['hud', 'res', 'low']);
      host.style.setProperty('--st-ar', (scene.W / scene.H).toFixed(4));
      foot(host);
      if (active >= 0) { scene.set(active, true); host.setAttribute('data-step', active); }
    }
    build();
    function span(r) { return r.height - (window.innerHeight - navH()); }
    function progress() { var r = track.getBoundingClientRect(), s = span(r); return s > 0 ? (navH() - r.top) / s : 0; }
    function go(i) {
      var r = track.getBoundingClientRect();
      window.scrollTo({ top: Math.round(window.pageYOffset + r.top - navH() + span(r) * (i + .5) / 5), behavior: 'smooth' });
    }
    function activate(i, first, within) {
      active = i;
      steps.forEach(function (li, k) { li.classList.toggle('is-active', k === i); li.classList.toggle('is-past', k < i); });
      btns.forEach(function (b, k) { if (k === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
      scene.set(i, first);
      host.setAttribute('data-step', i);
      if (!first && within && liveEl) {
        clearTimeout(annT);
        annT = setTimeout(function () { liveEl.textContent = 'Step ' + (i + 1) + ' of 5, ' + KICK[i].replace(/^\d+\s*·\s*/, '') + '. ' + PARA[i]; }, 650);
      }
    }
    function update() {
      raf = 0;
      if (!alive) return;
      var p = progress();
      ol.style.setProperty('--p', Math.max(0, Math.min(1, p * 1.25)).toFixed(4));
      var i = Math.max(0, Math.min(4, Math.floor(p * 5)));
      if (i !== active) activate(i, active < 0, p >= 0 && p <= 1);
      /* show the HUD from half a screen before the pin until the frame lets go */
      hud.update(p > -0.25 && p < 1, p < 0, i);
    }
    function onScroll() { if (!raf) raf = requestAnimationFrame(update); }
    function onResize() { readNav(); if (scene) scene.fit(); onScroll(); }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    var ro = 'ResizeObserver' in window ? new ResizeObserver(function () { if (scene) scene.fit(); }) : null;
    if (ro) ro.observe(host);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (alive) build(); });
    update();
    return function () {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(annT);
      hud.destroy();
      window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize);
      if (ro) ro.disconnect();
      steps.forEach(function (li, i) {
        li.classList.remove('is-active', 'is-past');
        var k = li.querySelector('.story-step-k'); if (k) k.textContent = KICK[i];
      });
      ol.style.removeProperty('--p');
      host.textContent = ''; host.removeAttribute('data-step'); host.style.removeProperty('--st-ar');
      sec.classList.remove('is-live');
    };
  }

  /* ---------------------------------------------------------------- stills: each caption with its own scene */
  /* narrow stills show only the parts of the scene that the step is about */
  var NARROW = [['hud', 'res', 'crit'], ['hud', 'cfg', 'inraw'], ['res', 'cfg'], ['hud', 'cfg', 'cons'], ['hud', 'res', 'inrra']];
  function goStill() {
    var alive = true;
    sec.classList.add('is-still');
    var shots = steps.map(function (li, i) {
      var box = H('div', { class: 'story-stage story-shot', 'data-step': String(i) });
      li.appendChild(box);
      return { box: box, i: i, mode: null };
    });
    function draw(s, force) {
      var w = s.box.clientWidth, mode = w && w < 560 ? 'narrow' : 'wide';
      if (!force && mode === s.mode) return;
      s.mode = mode;
      s.box.textContent = '';
      var sc = Scene(s.box, mode, mode === 'wide' ? ['hud', 'res', 'low'] : NARROW[s.i]);
      sc.set(s.i, true);
      s.fit = sc.fit;
      /* the legend only where number lines are drawn; the result under step 5 */
      if (s.i === 4 || mode === 'wide' || NARROW[s.i].indexOf('res') >= 0) foot(s.box, s.i);
    }
    function all(force) { if (alive) shots.forEach(function (s) { draw(s, force); if (s.fit) s.fit(); }); }
    all(true);
    var hud = makeHud(), hraf = 0;
    function hudTick() {
      hraf = 0;
      if (!alive) return;
      var vh = window.innerHeight, r = sec.getBoundingClientRect(), k = -1;
      steps.forEach(function (li, j) { if (li.getBoundingClientRect().top < vh * 0.5) k = j; });
      hud.update(r.top < vh * 0.62 && r.bottom > vh * 0.45, k < 0, Math.max(0, k));
    }
    function onHudScroll() { if (!hraf) hraf = requestAnimationFrame(hudTick); }
    window.addEventListener('scroll', onHudScroll, { passive: true });
    hudTick();
    var ro = 'ResizeObserver' in window ? new ResizeObserver(function () { all(false); }) : null;
    if (ro) shots.forEach(function (s) { ro.observe(s.box); });
    function onResize() { all(false); }
    window.addEventListener('resize', onResize, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { all(true); });
    return function () {
      alive = false;
      if (ro) ro.disconnect();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onHudScroll);
      if (hraf) cancelAnimationFrame(hraf);
      hud.destroy();
      shots.forEach(function (s) { s.box.remove(); });
      sec.classList.remove('is-still');
    };
  }

  /* ---------------------------------------------------------------- mode switch */
  var mqLive = window.matchMedia('(min-width: 1080px) and (min-height: 640px)');
  var mqRed = window.matchMedia('(prefers-reduced-motion: reduce)');
  var printing = false, stop = null;
  function start() {
    try { stop = mqLive.matches && !mqRed.matches && !printing ? goLive() : goStill(); }
    catch (err) {
      sec.classList.remove('is-live', 'is-still'); host.textContent = '';
      steps.forEach(function (li, i) { var k = li.querySelector('.story-step-k'); if (k) k.textContent = KICK[i]; var s = li.querySelector('.story-shot'); if (s) s.remove(); });
      stop = null;
      if (window.console) console.warn('story:', err);
    }
  }
  function restart() { if (stop) { try { stop(); } catch (e) { /* already torn down */ } } stop = null; start(); }
  function listen(mq, fn) { if (mq.addEventListener) mq.addEventListener('change', fn); else if (mq.addListener) mq.addListener(fn); }
  listen(mqLive, restart); listen(mqRed, restart);
  window.addEventListener('beforeprint', function () { printing = true; restart(); });
  window.addEventListener('afterprint', function () { printing = false; restart(); });
  start();
})();
