/* 04 · Papers: (P1) the paper's coverage sunburst re-created from RB_DATA.papers, with a linked detail panel;
 * (P2) Raw-vs-RRA small multiples re-creating the paper-scatter figure; (P3) sortable headers for the static table.
 * All counts are successful-task counts from RB_DATA.papers.list (first evaluation, primary Codex auditing; model
 * order s46, s5, o5, g38). Per-paper gains and percentages are DERIVED from those counts:
 * gain = 100 × (RRA − Raw) / tasks; gain bins are (a, b] as in the paper's legend.
 * Listens for RB.emit('paper:select', id) (e.g. from the walkthrough) to select a paper and scroll to the chart. */
(function () {
  'use strict';
  var sec = document.getElementById('papers');
  var D = window.RB_DATA, C = window.RBCharts, RB = window.RB;
  if (!sec || !D || !D.papers || !C || !RB) return;
  var P = D.papers, MODELS = D.models || [];
  var DEG = Math.PI / 180, SLOT = 360 / Math.max(1, P.list.length);
  var S = C.svg;

  /* ---------------------------------------------------------------- data */
  var famBy = {}, subBy = {}, byId = {};
  P.families.forEach(function (f) { famBy[f.key] = f; });
  P.subdomains.forEach(function (s) { subBy[s.key] = s; });
  P.list.forEach(function (p) { byId[p.id] = p; });

  // clockwise from 12 o'clock: families (array order) > their subdomains > paper ids (the figure's order)
  var order = [];
  P.families.forEach(function (f) {
    f.subdomains.forEach(function (sk) {
      var s = subBy[sk];
      if (s) s.paper_ids.forEach(function (id) { var p = byId[id]; if (p && order.indexOf(p) < 0) order.push(p); });
    });
  });
  if (order.length !== P.list.length) order = P.list.slice();

  function binOf(d, n) { // integer comparisons, so (a, b] edges are exact
    if (d < 0) return 'dec';
    if (d === 0) return 'tie';
    var g = 100 * d;
    return g <= 10 * n ? 'b0' : g <= 25 * n ? 'b10' : g <= 50 * n ? 'b25' : 'b50';
  }
  order.forEach(function (p, k) {
    p.k = k; p.gain = []; p.bin = []; p.cls = [];
    for (var m = 0; m < 4; m++) {
      var d = p.rra[m] - p.raw[m];
      p.gain.push(100 * d / p.tasks);
      p.bin.push(binOf(d, p.tasks));
      p.cls.push(d > 0 ? 'imp' : d === 0 ? 'tie' : 'wor');
    }
  });
  // family / subdomain spans in clockwise slots
  var groups = [];
  P.families.forEach(function (f) {
    var ids = [];
    f.subdomains.forEach(function (sk) {
      var s = subBy[sk]; if (!s) return;
      var ps = s.paper_ids.map(function (id) { return byId[id]; }).filter(Boolean);
      if (!ps.length) return;
      s.k0 = Math.min.apply(null, ps.map(function (p) { return p.k; }));
      s.k1 = Math.max.apply(null, ps.map(function (p) { return p.k; })) + 1;
      s.ids = ps.map(function (p) { return p.id; });
      ids = ids.concat(s.ids);
    });
    var ps2 = ids.map(function (id) { return byId[id]; });
    f.k0 = Math.min.apply(null, ps2.map(function (p) { return p.k; }));
    f.k1 = Math.max.apply(null, ps2.map(function (p) { return p.k; })) + 1;
    f.ids = ids;
    groups.push(f);
  });

  /* ---------------------------------------------------------------- helpers */
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pp(v) { return C.fmt.pp(v, 1); }
  function pct(n, d) { return (100 * n / d).toFixed(1) + '%'; }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function f2(v) { return Math.round(v * 100) / 100; }
  var reduced = RB.reduced();

  var state = { sel: (D.helix && byId[D.helix.paper_id]) ? D.helix.paper_id : (byId[40] ? 40 : order[0].id), hover: null, group: null, bin: null, binPreview: null, focusK: null };

  /* ---------------------------------------------------------------- P1 · sunburst */
  var sunEl = document.getElementById('papers-sunburst');
  var detail = sec.querySelector('.pp-detail');
  var jump = document.getElementById('pp-jump');
  var live = document.getElementById('pp-live');
  var legendBtns = [].slice.call(sec.querySelectorAll('.pp-bin'));
  var sun = null;          // current render: {svg, marks[], hits[], wedges[], ...}
  var anim = reduced ? 'done' : 'idle', animT0 = 0, animIO = null;   // idle -> running -> done (bars grow once)
  var mctx = null, fontFam = '', fontKey = '';

  function measure(text, size, weight) {
    if (!mctx) mctx = document.createElement('canvas').getContext('2d');
    mctx.font = weight + ' ' + size + 'px ' + fontFam;
    return mctx.measureText(text).width;
  }
  // the figure hyphenates these long single words
  var HYPH = { Interpretability: ['Interpret-', 'ability'], Neuroscience: ['Neuro-', 'science'], Compression: ['Compres-', 'sion'] };
  function candidates(text, weight) {
    var out = [[text]], words = text.split(' ');
    if (words.length > 1) {
      var best = null, bestW = 1e9;
      for (var i = 1; i < words.length; i++) {
        var a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
        var w = Math.max(measure(a, 10, weight), measure(b, 10, weight)) + (/^[\/]/.test(b) ? 40 : 0);
        if (w < bestW) { bestW = w; best = [a, b]; }
      }
      if (best) out.push(best);
    }
    if (HYPH[text]) out.push(HYPH[text]);
    return out;
  }
  // a radial label: the text runs along the bisector of the wedge (as in the figure); null if it does not fit
  function fitLabel(text, r0, r1, a0, a1, weight, sizes, tight) {
    var half = Math.min((a1 - a0) / 2, 80) * DEG, cands = candidates(text, weight), padR = tight ? 3.5 : 5, padT = tight ? 1 : 2;
    for (var si = 0; si < sizes.length; si++) {
      var size = sizes[si], lh = size * 1.13;
      for (var ci = 0; ci < cands.length; ci++) {
        var lines = cands[ci], w = 0;
        lines.forEach(function (l) { w = Math.max(w, measure(l, size, weight) * 1.04); });
        if (w > r1 - r0 - 2 * padR) continue;
        var need = (lines.length - 1) * lh + size * (tight ? 0.8 : 0.86) + 2 * padT;
        var rc = Math.max((r0 + r1) / 2, need / (2 * Math.sin(half)) + w / 2);
        if (rc + w / 2 > r1 - padR + 0.5) continue;
        return { lines: lines, size: size, lh: lh, rc: rc };
      }
    }
    return null;
  }

  function renderSun() {
    if (!sunEl) return;
    var W = Math.floor(sunEl.clientWidth);
    if (W < 120) return;
    fontFam = getComputedStyle(sunEl).fontFamily || 'sans-serif';
    fontKey = metricsKey();
    if (state.group) { state.group = null; C.tip.hide(); }
    var compact = W < 470, pad = 6;
    var R = (W / 2 - pad) / (4 / 3);
    var cx = W / 2, cy = W / 2, L = R / 3;
    // ring radii as fractions of the zero ring's outer radius, measured from the paper's figure;
    // on small screens the family ring widens because subdomain labels are hidden
    var G = compact
      ? { hole: 0.10, f0: 0.104, f1: 0.78, s0: 0.788, s1: 0.966, z0: 0.970 }
      : { hole: 0.133, f0: 0.136, f1: 0.554, s0: 0.562, s1: 0.966, z0: 0.970 };
    var bw = compact ? 1.95 : 1.8, gap = 0.6, tickLen = Math.max(3.5, R * 0.021), minBar = 1.6;

    function pt(r, a) { return [cx + r * Math.sin(a * DEG), cy - r * Math.cos(a * DEG)]; }
    function wedge(r0, r1, a0, a1) {
      var large = (a1 - a0) > 180 ? 1 : 0, p0 = pt(r1, a0), p1 = pt(r1, a1), p2 = pt(r0, a1), p3 = pt(r0, a0);
      return 'M' + f2(p0[0]) + ',' + f2(p0[1]) + 'A' + f2(r1) + ',' + f2(r1) + ' 0 ' + large + ' 1 ' + f2(p1[0]) + ',' + f2(p1[1]) +
        'L' + f2(p2[0]) + ',' + f2(p2[1]) + 'A' + f2(r0) + ',' + f2(r0) + ' 0 ' + large + ' 0 ' + f2(p3[0]) + ',' + f2(p3[1]) + 'Z';
    }
    function markLen(p, m, t) {
      var g = p.gain[m];
      if (p.bin[m] === 'dec' || p.bin[m] === 'tie') return tickLen * t;
      return Math.max(minBar, L * g / 100) * t;
    }
    function markD(p, m, t) {
      var a0 = p.k * SLOT + m * SLOT / 4 + (SLOT / 4 - bw) / 2;
      return wedge(R + gap, R + gap + Math.max(0.01, markLen(p, m, t)), a0, a0 + bw);
    }

    sunEl.innerHTML = '';
    var svg = S('svg', { viewBox: '0 0 ' + W + ' ' + W, width: W, height: W, class: 'pp-svg', role: 'group',
      'aria-label': 'Coverage and gains: ' + order.length + ' papers in ' + groups.length + ' topic families and ' + P.subdomains.length +
        ' subdomains, each with four outer marks (' + MODELS.map(function (m) { return m.name; }).join(', ') + ')' }, sunEl);
    var deco = S('g', { 'aria-hidden': 'true' }, svg);
    // soft radial beam for the hover / selection spotlight (fades out toward the 100 pp circle)
    var gid = 'pp-beam-' + W, defs = S('defs', null, svg);
    [['', 1], ['-sel', 1.6]].forEach(function (g) {
      var rg = S('radialGradient', { id: gid + g[0], gradientUnits: 'userSpaceOnUse', cx: cx, cy: cy, r: f2(R + gap + L) }, defs);
      S('stop', { class: 'pp-beam', offset: f2(R * 0.97 / (R + gap + L)), 'stop-opacity': f2(0.1 * g[1]) }, rg);
      S('stop', { class: 'pp-beam', offset: 1, 'stop-opacity': f2(0.025 * g[1]) }, rg);
    });

    // hover / selection spotlight behind the marks (under the reference circles)
    var spotHov = S('path', { class: 'pp-spot', d: '', fill: 'url(#' + gid + ')' }, deco);
    var spotSel = S('path', { class: 'pp-spot sel', d: '', fill: 'url(#' + gid + '-sel)' }, deco);
    // dashed reference circles at 25, 50 and 100 pp
    [25, 50, 100].forEach(function (v) { S('circle', { class: 'pp-ref', cx: cx, cy: cy, r: f2(R + gap + L * v / 100) }, deco); });

    // rings: families and subdomains
    var wedges = [], labels = [];
    var gW = S('g', null, deco);
    groups.forEach(function (f) {
      var a0 = f.k0 * SLOT, a1 = f.k1 * SLOT;
      var wf = S('path', { class: 'pp-w pp-wf fam-' + f.key, d: wedge(R * G.f0, R * G.f1, a0, a1) }, gW);
      wedges.push({ el: wf, type: 'fam', key: f.key, ids: f.ids });
      f.subdomains.forEach(function (sk) {
        var s = subBy[sk]; if (!s || s.k0 === undefined) return;
        var ws = S('path', { class: 'pp-w pp-ws fam-' + f.key, d: wedge(R * G.s0, R * G.s1, s.k0 * SLOT, s.k1 * SLOT) }, gW);
        wedges.push({ el: ws, type: 'sub', key: s.key, ids: s.ids, fam: f.key });
      });
    });
    // the blue zero ring
    S('circle', { class: 'pp-zero', cx: cx, cy: cy, r: f2(R * (G.z0 + 1) / 2), 'stroke-width': f2(R * (1 - G.z0)) }, deco);

    var notch = S('path', { class: 'pp-notch', d: '', 'stroke-width': f2(R * (1 - G.z0) + 0.6) }, deco);

    // outer marks: four per paper, clockwise in model order
    var marks = [], gM = S('g', null, deco);
    order.forEach(function (p) {
      for (var m = 0; m < 4; m++) {
        var el = S('path', { class: 'pp-mk gb-' + p.bin[m], d: markD(p, m, anim === 'done' ? 1 : 0) }, gM);
        marks.push({ el: el, p: p, m: m });
      }
    });

    // labels (radial, flipped on the left half so they read left to right)
    var gL = S('g', null, deco);
    var famSizes = compact ? [10.5, 10, 9.5, 9] : [clamp(R * 0.057, 11.5, 13.5), 12, 11.5, 11, 10.5];
    var subSizes = [clamp(R * 0.051, 10.5, 12), 11, 10.5, 10, 9.5];
    function addLabel(text, r0, r1, a0, a1, cls, weight, sizes, key) {
      var fit = fitLabel(text, r0, r1, a0, a1, weight, sizes, compact);
      if (!fit) return;
      var th = (a0 + a1) / 2, phi = th <= 180 ? th - 90 : th - 270, p = pt(fit.rc, th);
      var t = S('text', { class: 'pp-lbl ' + cls, 'text-anchor': 'middle', 'font-size': fit.size,
        transform: 'translate(' + f2(p[0]) + ',' + f2(p[1]) + ') rotate(' + f2(phi) + ')' }, gL);
      var n = fit.lines.length;
      fit.lines.forEach(function (line, i) {
        S('tspan', { x: 0, y: f2((i - (n - 1) / 2) * fit.lh + fit.size * 0.34), text: line }, t);
      });
      labels.push({ el: t, key: key });
    }
    groups.forEach(function (f) {
      addLabel(f.figure_label, R * G.f0, R * G.f1, f.k0 * SLOT, f.k1 * SLOT, 'pp-lbl-f', 650, famSizes, 'fam:' + f.key);
      if (compact) return;
      f.subdomains.forEach(function (sk) {
        var s = subBy[sk]; if (!s || s.k0 === undefined) return;
        addLabel(s.figure_label, R * G.s0, R * G.s1, s.k0 * SLOT, s.k1 * SLOT, 'pp-lbl-s', 480, subSizes, 'sub:' + s.key + ' fam:' + f.key);
      });
    });

    // centre: number of papers in view (all, or the hovered family / subdomain)
    var cnum = null, ctxt = null;
    if (R * G.hole >= 22) {
      cnum = S('text', { class: 'pp-cnum', x: cx, y: cy + 2, 'text-anchor': 'middle', text: String(order.length) }, deco);
      ctxt = S('text', { class: 'pp-ctxt', x: cx, y: cy + 14, 'text-anchor': 'middle', text: 'papers' }, deco);
    }

    // scale bar for bar length (0 / 50 / 100 pp), in the top-right corner outside the 100 pp circle
    var fsz = compact ? 9.5 : 10.5, labW = measure('100', fsz, 400) + 6;
    var xs = W - labW - 8, dx = xs - cx, rr = R + gap + L + 6;
    var y0 = cy - Math.sqrt(Math.max(0, rr * rr - dx * dx)) - 4;
    if (y0 - L - 16 < 0) y0 = L + 16;
    var gS = S('g', { class: 'pp-scale' }, deco);
    S('line', { x1: xs, x2: xs, y1: f2(y0), y2: f2(y0 - L) }, gS);
    [0, 50, 100].forEach(function (v) {
      var yy = y0 - L * v / 100;
      S('line', { x1: xs - 4, x2: xs, y1: f2(yy), y2: f2(yy) }, gS);
      S('text', { x: xs + 4, y: f2(yy + fsz * 0.36), 'font-size': fsz, text: String(v) }, gS);
    });
    S('text', { x: xs, y: f2(y0 - L - 8), 'font-size': fsz, 'text-anchor': 'middle', text: 'pp' }, gS);

    // wedge hover targets (families and subdomains) sit on the rings themselves
    wedges.forEach(function (w) {
      w.el.classList.add('pp-wedge-hit');
      w.el.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') setGroup(w, e); });
      w.el.addEventListener('pointermove', function (e) { if (e.pointerType !== 'touch' && state.group === w) showGroupTip(w, e.clientX, e.clientY); });
      w.el.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch') setGroup(null); });
      // click (or a second tap) steps through the group's papers in clockwise order
      w.el.addEventListener('click', function (e) {
        var touch = e.pointerType === 'touch';
        if (touch && state.group !== w) { setGroup(w, e); return; }
        var i = w.ids.indexOf(state.sel);
        select(w.ids[(i + 1) % w.ids.length]);
        if (state.group === w) showGroupTip(w, e.clientX, e.clientY);
      });
    });

    // paper hit areas: one per paper slot, over the zero ring and the marks; focusable (roving tabindex)
    var gH = S('g', { class: 'pp-hits', role: 'listbox', 'aria-label': 'Papers, clockwise from 12 o’clock. Arrow keys move, Enter selects.' }, svg);
    var hits = order.map(function (p) {
      var a0 = p.k * SLOT, a1 = a0 + SLOT;
      var el = S('path', { class: 'pp-hit', d: wedge(R * G.z0 - 1, R + gap + L + 3, a0, a1), role: 'option', tabindex: '-1',
        'aria-selected': 'false', 'aria-label': ariaPaper(p) }, gH);
      el.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') setHover(p.id); });
      el.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch') setHover(null); });
      el.addEventListener('click', function () { select(p.id); });
      el.addEventListener('focus', function () { state.focusK = p.k; rove(p.k); setHover(p.id, true); });
      el.addEventListener('blur', function () { setHover(null); });
      return el;
    });
    gH.addEventListener('keydown', function (e) {
      var k = state.focusK === null ? kOf(state.sel) : state.focusK, n = order.length, nk = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nk = (k + 1) % n;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') nk = (k - 1 + n) % n;
      else if (e.key === 'Home') nk = 0;
      else if (e.key === 'End') nk = n - 1;
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(order[k].id); return; }
      if (nk === null) return;
      e.preventDefault();
      hits[nk].focus();
    });

    sun = { svg: svg, W: W, R: R, L: L, G: G, wedge: wedge, markD: markD, marks: marks, hits: hits, wedges: wedges, labels: labels,
            spotHov: spotHov, spotSel: spotSel, notch: notch, cnum: cnum, ctxt: ctxt, gap: gap };
    rove(state.focusK === null ? kOf(state.sel) : state.focusK);
    paintSun();
    if (anim === 'idle') watchAnim();
  }

  function kOf(id) { return byId[id] ? byId[id].k : 0; }
  function metricsKey() { return [measure('Interpretability', 12, 480), measure('Trustworthy', 12, 650)].map(function (v) { return v.toFixed(2); }).join('|'); }
  function rove(k) { if (!sun) return; sun.hits.forEach(function (h, i) { h.setAttribute('tabindex', i === k ? '0' : '-1'); }); }
  function ariaPaper(p) {
    var f = famBy[p.family], s = subBy[p.subdomain];
    return p.name + ', ' + f.label + ', ' + s.label + ', ' + plural(p.tasks, 'task') + '. Successful tasks, Raw to RRA: ' + MODELS.map(function (m, i) {
      return m.name + ' ' + p.raw[i] + ' to ' + p.rra[i] + ' (' + pp(p.gain[i]).replace('−', 'minus ') + ')';
    }).join('; ') + '.';
  }

  // spotlight, notch, dimming and the centre count follow the state; no re-render
  function paintSun() {
    if (!sun) return;
    var R = sun.R, G = sun.G, top = R + sun.gap + sun.L;
    function spotD(id) { var k = kOf(id); return sun.wedge(R * G.z0, top, k * SLOT, (k + 1) * SLOT); }
    var k = kOf(state.sel);
    sun.spotSel.setAttribute('d', spotD(state.sel));
    sun.notch.setAttribute('d', 'M' + arcPts(R * (G.z0 + 1) / 2, k * SLOT + 0.5, (k + 1) * SLOT - 0.5));
    sun.spotHov.setAttribute('d', state.hover !== null && state.hover !== state.sel ? spotD(state.hover) : '');
    sun.hits.forEach(function (h, i) { h.setAttribute('aria-selected', order[i].id === state.sel ? 'true' : 'false'); });
    var g = state.group, bin = state.binPreview || state.bin;
    var inG = g ? g.ids : null;
    sun.svg.classList.toggle('is-dim', !!g);
    sun.svg.classList.toggle('is-bin', !g && !!bin);
    sun.marks.forEach(function (mk) {
      var on = g ? inG.indexOf(mk.p.id) >= 0 : bin ? mk.p.bin[mk.m] === bin : false;
      mk.el.classList.toggle('on', on);
    });
    sun.wedges.forEach(function (w) {
      var on = g ? (w === g || (g.type === 'fam' && w.fam === g.key) || (g.type === 'sub' && w.type === 'fam' && w.key === g.fam)) : false;
      w.el.classList.toggle('on', on);
      w.el.classList.toggle('hov', w === g);
    });
    sun.labels.forEach(function (l) {
      var on = g ? (g.type === 'fam' ? l.key.indexOf('fam:' + g.key) >= 0 : (l.key.indexOf('sub:' + g.key + ' ') === 0 || l.key === 'fam:' + g.fam)) : false;
      l.el.classList.toggle('on', on);
    });
    if (sun.cnum) {
      var n = g ? g.ids.length : order.length;
      sun.cnum.textContent = String(n);
      sun.ctxt.textContent = n === 1 ? 'paper' : 'papers';
    }
  }
  function arcPts(r, a0, a1) {
    var W = sun.W, cx = W / 2, cy = W / 2;
    var p0 = [cx + r * Math.sin(a0 * DEG), cy - r * Math.cos(a0 * DEG)], p1 = [cx + r * Math.sin(a1 * DEG), cy - r * Math.cos(a1 * DEG)];
    return f2(p0[0]) + ',' + f2(p0[1]) + 'A' + f2(r) + ',' + f2(r) + ' 0 0 1 ' + f2(p1[0]) + ',' + f2(p1[1]);
  }

  // bars grow clockwise from the zero ring the first time the chart is seen (one loop; it always paints the
  // current render, so a re-render mid-animation simply continues)
  function watchAnim() {
    if (animIO) return;
    if (!('IntersectionObserver' in window)) { anim = 'done'; paintMarks(1); return; }
    animIO = new IntersectionObserver(function (es) {
      if (!es.some(function (e) { return e.isIntersecting; })) return;
      animIO.disconnect();
      anim = 'running';
      requestAnimationFrame(frame);
    }, { threshold: 0.25 });
    animIO.observe(sunEl);
  }
  var TOTAL = 760, EACH = 380;
  function frame(ts) {
    if (!animT0) animT0 = ts;
    var t = ts - animT0;
    if (t >= TOTAL) { anim = 'done'; paintMarks(1); return; }
    if (sun) {
      var n = sun.marks.length;
      sun.marks.forEach(function (mk, i) {
        var u = clamp((t - (i / n) * (TOTAL - EACH)) / EACH, 0, 1);
        mk.el.setAttribute('d', sun.markD(mk.p, mk.m, 1 - Math.pow(1 - u, 3)));
      });
    }
    requestAnimationFrame(frame);
  }
  function paintMarks(t) { if (sun) sun.marks.forEach(function (mk) { mk.el.setAttribute('d', sun.markD(mk.p, mk.m, t)); }); }

  /* ---------------------------------------------------------------- group (family / subdomain) highlight + tooltip */
  function setGroup(w, e) {
    state.group = w || null;
    paintSun();
    if (w && e) showGroupTip(w, e.clientX, e.clientY); else C.tip.hide();
  }
  function showGroupTip(w, x, y) {
    var label, kicker;
    if (w.type === 'fam') { label = famBy[w.key].label; kicker = 'Topic family'; }
    else { label = subBy[w.key].label; kicker = famBy[w.fam].label; }
    var names = w.ids.map(function (id) { return byId[id].name; });
    C.tip.show('<div class="tt">' + esc(kicker) + '</div><div class="row"><span>' + esc(label) + '</span><b>' + w.ids.length + '</b></div>' +
      '<div class="sub">' + esc(plural(w.ids.length, 'paper')) + ': ' + esc(names.join(', ')) + '</div>' +
      '<div class="sub">' + (w.ids.length > 1 ? 'Click to step through its papers.' : 'Click to select it.') + '</div>', x, y);
  }
  document.addEventListener('pointerdown', function (e) {
    if (state.group && e.pointerType === 'touch' && !(e.target.closest && e.target.closest('.pp-wedge-hit'))) setGroup(null);
  }, { passive: true });

  /* ---------------------------------------------------------------- legend: highlight one gain bin */
  legendBtns.forEach(function (b) {
    var key = b.getAttribute('data-bin');
    b.addEventListener('click', function () {
      state.bin = state.bin === key ? null : key;
      legendBtns.forEach(function (o) { o.setAttribute('aria-pressed', o.getAttribute('data-bin') === state.bin ? 'true' : 'false'); });
      paintSun();
    });
    b.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') { state.binPreview = key; paintSun(); } });
    b.addEventListener('pointerleave', function () { state.binPreview = null; paintSun(); });
    b.addEventListener('focus', function () { state.binPreview = key; paintSun(); });
    b.addEventListener('blur', function () { state.binPreview = null; paintSun(); });
  });

  /* ---------------------------------------------------------------- detail panel */
  var dq = function (s) { return detail ? detail.querySelector(s) : null; };
  var dEls = detail ? {
    state: dq('.pp-d-state span'), id: dq('.pp-d-id'), name: dq('.pp-d-name'), title: dq('.pp-d-title'), author: dq('.pp-d-author'),
    dot: dq('.pp-d-area .pp-fdot'), fam: dq('.pp-d-fam'), sub: dq('.pp-d-sub'), tasks: dq('.pp-d-tasks'),
    rows: [].slice.call(detail.querySelectorAll('.pp-d-row'))
  } : null;
  var shown = null;
  function renderDetail() {
    if (!dEls) return;
    var id = state.hover !== null ? state.hover : state.sel, p = byId[id];
    var preview = id !== state.sel;
    detail.classList.toggle('is-preview', preview);
    dEls.state.textContent = preview ? (state.hoverKey ? 'Preview · Enter to select' : 'Preview · click to select') : 'Selected paper';
    if (shown === id) return;
    shown = id;
    dEls.id.textContent = 'ID ' + p.id;
    dEls.name.textContent = p.name;
    dEls.title.textContent = p.title;
    dEls.author.textContent = p.first_author + ' et al.';
    dEls.dot.setAttribute('class', 'pp-fdot fam-' + p.family);
    dEls.fam.textContent = famBy[p.family].label;
    dEls.sub.textContent = subBy[p.subdomain].label;
    dEls.tasks.textContent = String(p.tasks);
    dEls.rows.forEach(function (li, m) {
      if (!MODELS[m]) return;
      li.querySelector('.pp-d-model').textContent = MODELS[m].name;
      li.querySelector('.pp-d-count').textContent = p.raw[m] + ' of ' + p.tasks + ' → ' + p.rra[m] + ' of ' + p.tasks;
      var g = li.querySelector('.pp-d-gain');
      g.lastChild.textContent = pp(p.gain[m]);
      g.querySelector('.gchip').setAttribute('class', 'gchip gb-' + p.bin[m]);
      var bars = li.querySelectorAll('.b');
      [p.raw[m], p.rra[m]].forEach(function (v, j) {
        bars[j].style.setProperty('--w', (100 * v / p.tasks).toFixed(1) + '%');
        bars[j].classList.toggle('zero', v === 0);
      });
    });
  }

  /* ---------------------------------------------------------------- state changes */
  function setHover(id, byKey) {
    state.hoverKey = !!byKey;
    if (state.hover === id) { renderDetail(); return; }
    state.hover = id;
    paintSun(); renderDetail(); paintScatter();
  }
  function select(id, quiet) {
    id = Number(id);
    if (!byId[id]) return;
    var changed = state.sel !== id;
    state.sel = id;
    if (state.hover === id) state.hover = null;
    if (jump && String(jump.value) !== String(id)) jump.value = String(id);
    // keep each chart's single tab stop on the selected paper unless focus is inside that chart
    var ae = document.activeElement;
    if (sun && !sun.svg.contains(ae)) { state.focusK = null; rove(kOf(id)); }
    sc.forEach(function (s, m) { if (s && !s.svg.contains(ae)) roveSc(m, id); });
    paintSun(); renderDetail(); paintScatter(); paintTable();
    if (changed && !quiet && live) live.textContent = 'Selected ' + byId[id].name + '.';
  }
  if (jump) jump.addEventListener('change', function () { select(jump.value); });

  /* ---------------------------------------------------------------- P2 · small multiples */
  var scCard = document.getElementById('papers-scatter');
  var scGrid = scCard ? scCard.querySelector('.pp-sc-grid') : null;
  var scPanels = scGrid ? [].slice.call(scGrid.querySelectorAll('.pp-sc-panel')) : [];
  var scTabs = scCard ? scCard.querySelector('.pp-sc-tabs') : null;
  var sc = [];             // per panel: {svg, pts:{id:{el,x,y,r}}, ring, lbl, ...}
  var scHover = null, scFocus = null;
  var maxTasks = Math.max.apply(null, P.list.map(function (p) { return p.tasks; }));
  var minTasks = Math.min.apply(null, P.list.map(function (p) { return p.tasks; }));

  function renderScatter() {
    scPanels.forEach(function (panel, m) {
      var host = panel.querySelector('.pp-sc-plot');
      var W = Math.floor(host.clientWidth);
      sc[m] = null;
      host.innerHTML = '';
      if (W < 100) return;      // hidden (phone tabs); rendered when shown
      var ml = 30, mr = 12, mt = 16, mb = 32, pw = W - ml - mr, ph = W - mt - mb;
      var x = C.linear(0, 100, ml, ml + pw), y = C.linear(0, 100, mt + ph, mt);
      var rMax = clamp(pw * 0.043, 6.5, 11.5);
      var rOf = function (n) { return Math.max(1.6, rMax * Math.sqrt(n / maxTasks)); };
      var model = MODELS[m];
      var svg = S('svg', { viewBox: '0 0 ' + W + ' ' + W, width: W, height: W, class: 'pp-sc-svg', role: 'group',
        'aria-label': model.name + ': Raw versus RRA success for each of the 36 papers' }, host);
      var deco = S('g', { 'aria-hidden': 'true' }, svg);
      var grid = S('g', { class: 'grid' }, deco);
      [50, 100].forEach(function (v) {
        S('line', { x1: x(v), x2: x(v), y1: y(0), y2: y(100) }, grid);
        S('line', { x1: x(0), x2: x(100), y1: y(v), y2: y(v) }, grid);
      });
      S('line', { class: 'axis-line', x1: x(0), x2: x(100), y1: y(0), y2: y(0) }, deco);
      S('line', { class: 'axis-line', x1: x(0), x2: x(0), y1: y(0), y2: y(100) }, deco);
      var tk = S('g', { class: 'tick' }, deco);
      [0, 50, 100].forEach(function (v) {
        S('text', { x: x(v), y: y(0) + 15, 'text-anchor': v === 0 ? 'start' : v === 100 ? 'end' : 'middle', text: String(v) }, tk);
        S('text', { x: x(0) - 6, y: y(v) + 4, 'text-anchor': 'end', text: String(v) }, tk);
      });
      S('text', { class: 'axis-title', x: x(50), y: W - 3, 'text-anchor': 'middle', text: 'Raw success (%)' }, deco);
      S('text', { class: 'axis-title', x: x(0) - 6, y: mt - 6, 'text-anchor': 'start', text: 'RRA (%)' }, deco);
      S('line', { class: 'ref-line', x1: x(0), y1: y(0), x2: x(100), y2: y(100) }, deco);

      var pts = {}, list = [];
      var gP = S('g', { role: 'listbox', 'aria-label': model.name + ' papers, ordered by Raw success. Arrow keys move, Enter selects.' }, svg);
      var sorted = P.list.slice().sort(function (a, b) { return b.tasks - a.tasks; });   // big first, small on top
      sorted.forEach(function (p) {
        var px = x(100 * p.raw[m] / p.tasks), py = y(100 * p.rra[m] / p.tasks), r = rOf(p.tasks);
        var el = S('circle', { class: 'pp-pt ' + p.cls[m], cx: f2(px), cy: f2(py), r: f2(r), role: 'option', tabindex: '-1',
          'aria-selected': 'false', 'aria-label': ariaPoint(p, m) }, gP);
        var o = { el: el, p: p, x: px, y: py, r: r };
        pts[p.id] = o; list.push(o);
        el.addEventListener('focus', function () { scFocus = { m: m, id: p.id }; roveSc(m, p.id); setScHover(p.id, m, true); });
        el.addEventListener('blur', function () { scFocus = null; setScHover(null); });
      });
      // keyboard order: left to right (Raw %), then bottom to top (RRA %)
      var kb = list.slice().sort(function (a, b) { return (a.x - b.x) || (b.y - a.y) || (a.p.tasks - b.p.tasks); });
      gP.addEventListener('keydown', function (e) {
        var cur = scFocus && scFocus.m === m ? scFocus.id : state.sel, i = 0;
        kb.forEach(function (o, j) { if (o.p.id === cur) i = j; });
        var ni = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') ni = Math.min(kb.length - 1, i + 1);
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') ni = Math.max(0, i - 1);
        else if (e.key === 'Home') ni = 0;
        else if (e.key === 'End') ni = kb.length - 1;
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(cur); return; }
        if (ni === null) return;
        e.preventDefault();
        kb[ni].el.focus();
      });
      var ringHov = S('circle', { class: 'pp-ring', r: 0, opacity: 0 }, svg);
      var ringSel = S('circle', { class: 'pp-ring', r: 0, opacity: 0 }, svg);
      var lbl = S('text', { class: 'pp-sc-lbl', x: 0, y: 0 }, svg);
      // pointer: nearest point within reach (overlapping observations keep their exact positions)
      var hit = S('rect', { class: 'pp-sc-hit', x: 0, y: 0, width: W, height: W }, svg);
      function nearest(e) {
        var bb = svg.getBoundingClientRect(), k = W / bb.width;
        var mx = (e.clientX - bb.left) * k, my = (e.clientY - bb.top) * k, best = null, bd = 1e9;
        list.forEach(function (o) {
          var d = Math.hypot(o.x - mx, o.y - my) - o.r * 0.5;
          if (d < bd || (Math.abs(d - bd) < 0.01 && best && o.r < best.r)) { bd = d; best = o; }
        });
        return best && bd <= Math.max(14, 22 * k) ? best : null;
      }
      hit.addEventListener('pointermove', function (e) {
        var o = nearest(e);
        hit.classList.toggle('on-pt', !!o);
        if (!o) { setScHover(null); C.tip.hide(); return; }
        setScHover(o.p.id, m, false);
        C.tip.show(tipPoint(o, m, list), e.clientX, e.clientY);
      });
      hit.addEventListener('pointerleave', function () { setScHover(null); C.tip.hide(); });
      hit.addEventListener('click', function (e) {
        var o = nearest(e);
        if (!o) return;
        select(o.p.id);
        if (e.pointerType === 'touch' || (e.pointerType === undefined && !window.matchMedia('(hover: hover)').matches)) C.tip.show(tipPoint(o, m, list), e.clientX, e.clientY);
      });
      sc[m] = { svg: svg, pts: pts, list: list, ringHov: ringHov, ringSel: ringSel, lbl: lbl, x: x, y: y, W: W, ml: ml, mr: mr, rMax: rMax };
      roveSc(m, scFocus && scFocus.m === m ? scFocus.id : state.sel);
    });
    var shownPanel = sc.filter(Boolean)[0];
    if (shownPanel) renderSizeKey(shownPanel.rMax);
    paintScatter();
  }
  function roveSc(m, id) { var s = sc[m]; if (!s) return; Object.keys(s.pts).forEach(function (k) { s.pts[k].el.setAttribute('tabindex', String(s.pts[k].p.id) === String(id) ? '0' : '-1'); }); }
  function ariaPoint(p, m) {
    return p.name + ': Raw ' + p.raw[m] + ' of ' + p.tasks + ' (' + pct(p.raw[m], p.tasks) + '), RRA ' + p.rra[m] + ' of ' + p.tasks +
      ' (' + pct(p.rra[m], p.tasks) + '), ' + (p.cls[m] === 'imp' ? 'improved' : p.cls[m] === 'tie' ? 'tied' : 'worse') + '.';
  }
  function tipPoint(o, m, list) {
    var p = o.p, model = MODELS[m];
    var same = list.filter(function (q) { return q !== o && Math.abs(q.x - o.x) < 0.5 && Math.abs(q.y - o.y) < 0.5; }).map(function (q) { return q.p.name; });
    var verdict = p.cls[m] === 'imp' ? 'Improved' : p.cls[m] === 'tie' ? 'Tied' : 'Worse';
    return '<div class="tt">' + esc(model.name) + ' · ' + verdict + '</div>' +
      '<div style="font-weight:600;margin:0 0 4px">' + esc(p.name) + ' <span style="color:var(--ink-3);font-weight:500">· ' + plural(p.tasks, 'task') + '</span></div>' +
      '<div class="row"><span>Raw</span><b>' + p.raw[m] + ' of ' + p.tasks + ' · ' + pct(p.raw[m], p.tasks) + '</b></div>' +
      '<div class="row"><span>RRA</span><b>' + p.rra[m] + ' of ' + p.tasks + ' · ' + pct(p.rra[m], p.tasks) + '</b></div>' +
      '<div class="sub">' + esc(pp(p.gain[m])) + ', derived from counts' + (same.length ? '. Same position: ' + esc(same.slice(0, 6).join(', ')) + (same.length > 6 ? ' and ' + (same.length - 6) + ' more' : '') : '') + '</div>';
  }
  function setScHover(id, m, fromFocus) {
    scHover = id === null ? null : { id: id, m: m, focus: !!fromFocus };
    paintScatter();
    if (fromFocus && id !== null && sc[m]) C.tip.showFor(sc[m].pts[id].el, tipPoint(sc[m].pts[id], m, sc[m].list));
  }
  function paintScatter() {
    var hovId = scHover ? scHover.id : (state.hover !== null ? state.hover : null);
    sc.forEach(function (s, m) {
      if (!s) return;
      s.svg.classList.toggle('has-hl', hovId !== null);
      Object.keys(s.pts).forEach(function (k) {
        var o = s.pts[k];
        o.el.classList.toggle('hl', o.p.id === hovId);
        o.el.setAttribute('aria-selected', o.p.id === state.sel ? 'true' : 'false');
      });
      placeRing(s.ringHov, hovId !== null && hovId !== state.sel ? s.pts[hovId] : null, scHover && scHover.focus && scHover.m === m);
      var so = s.pts[state.sel];
      placeRing(s.ringSel, so, scHover && scHover.focus && scHover.m === m && scHover.id === state.sel);
      if (so && hovId !== null && hovId !== state.sel) s.ringSel.setAttribute('opacity', '0.3');
      // direct label for the selected paper
      if (so) {
        var right = so.x > s.ml + (s.W - s.ml - s.mr) * 0.55;
        var lx = right ? so.x - so.r - 6 : so.x + so.r + 6, ly = so.y + 4;
        if (so.y < 24) ly = so.y + so.r + 14;
        s.lbl.setAttribute('x', f2(lx)); s.lbl.setAttribute('y', f2(ly));
        s.lbl.setAttribute('text-anchor', right ? 'end' : 'start');
        s.lbl.textContent = byId[state.sel].name;
        s.lbl.setAttribute('opacity', hovId !== null && hovId !== state.sel ? '0.35' : '1');
      }
    });
  }
  function placeRing(ring, o, focus) {
    if (!o) { ring.setAttribute('opacity', '0'); return; }
    ring.setAttribute('cx', f2(o.x)); ring.setAttribute('cy', f2(o.y)); ring.setAttribute('r', f2(o.r + 3.2));
    ring.setAttribute('opacity', '1');
    ring.classList.toggle('focus', !!focus);
  }
  // marker-area key: the smallest and largest papers at the current marker scale
  function renderSizeKey(rMax) {
    var key = scCard ? scCard.querySelector('.pp-size-key') : null;
    if (!key) return;
    var r1 = rMax, r0 = Math.max(1.6, rMax * Math.sqrt(minTasks / maxTasks)), w = 2 * r1 + 2;
    key.innerHTML = '';
    var s = S('svg', { width: f2(r0 * 2 + w + 8), height: f2(w), viewBox: '0 0 ' + f2(r0 * 2 + w + 8) + ' ' + f2(w) }, key);
    S('circle', { cx: f2(r0 + 1), cy: f2(w - r0 - 1), r: f2(r0) }, s);
    S('circle', { cx: f2(r0 * 2 + 8 + r1 + 1), cy: f2(w / 2), r: f2(r1) }, s);
    key.appendChild(document.createTextNode(minTasks + ' to ' + maxTasks + ' tasks'));
  }
  function initTabs() {
    if (!scTabs || !MODELS.length) return;
    var holder = C.h('div');
    scTabs.appendChild(holder);
    C.seg(holder, MODELS.map(function (m) { return { value: m.key, label: m.short }; }), MODELS[0].key, function (v) {
      scPanels.forEach(function (pn) { pn.classList.toggle('on', pn.getAttribute('data-model') === v); });
      renderScatter();
    }, 'Model shown');
  }

  /* ---------------------------------------------------------------- P3 · table */
  var table = sec.querySelector('.pp-table');
  var tSort = { col: 0, dir: 1 };
  function initTable() {
    if (!table || !table.tHead) return;
    var ths = [].slice.call(table.tHead.rows[0].cells);
    ths.forEach(function (th, i) {
      var b = C.h('button', { type: 'button', class: 'pp-sort' }, [th.textContent]);
      th.textContent = '';
      th.appendChild(b);
      th.setAttribute('aria-sort', i === 0 ? 'ascending' : 'none');
      b.addEventListener('click', function () {
        var num = th.getAttribute('data-type') === 'num';
        var dir = tSort.col === i ? -tSort.dir : (num && i > 0 ? -1 : 1);
        tSort = { col: i, dir: dir };
        var body = table.tBodies[0], rows = [].slice.call(body.rows);
        rows.sort(function (a, b2) {
          var va = a.cells[i].getAttribute('data-sort'), vb = b2.cells[i].getAttribute('data-sort');
          var c = num ? (parseFloat(va) - parseFloat(vb)) : (va < vb ? -1 : va > vb ? 1 : 0);
          if (c === 0) c = parseFloat(a.cells[0].getAttribute('data-sort')) - parseFloat(b2.cells[0].getAttribute('data-sort'));
          return c * dir;
        });
        rows.forEach(function (r) { body.appendChild(r); });
        ths.forEach(function (t, j) { t.setAttribute('aria-sort', j === i ? (dir > 0 ? 'ascending' : 'descending') : 'none'); });
      });
    });
    paintTable();
  }
  function paintTable() {
    if (!table) return;
    [].forEach.call(table.tBodies[0].rows, function (r) { r.classList.toggle('hl', r.getAttribute('data-id') === String(state.sel)); });
  }

  /* ---------------------------------------------------------------- init (lazy) + cross-section link */
  var inited = false;
  function init() {
    if (inited) return;
    inited = true;
    renderSun();
    renderDetail();
    initTabs();
    renderScatter();
    initTable();
    if (sunEl) C.onResize(sunEl, function () { renderSun(); });
    if (scGrid) C.onResize(scGrid, function () { renderScatter(); });
    // labels are fitted with measured text, so re-fit once web fonts arrive (only if metrics changed)
    var rerender = function () { if (sunEl && metricsKey() !== fontKey) renderSun(); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(rerender);
    if (document.fonts && document.fonts.addEventListener) {
      var ft = 0;
      document.fonts.addEventListener('loadingdone', function () { clearTimeout(ft); ft = setTimeout(rerender, 60); });
    }
  }
  RB.whenNear(sec, init, '900px 0px');

  RB.on('paper:select', function (id) {
    if (!byId[Number(id)]) return;
    init();
    select(id);
    var card = document.getElementById('papers-coverage') || sec;
    // defer so an in-page anchor jump (e.g. href="#papers") does not override this scroll
    setTimeout(function () { card.scrollIntoView({ behavior: RB.reduced() ? 'auto' : 'smooth', block: 'start' }); }, 30);
  });
})();
