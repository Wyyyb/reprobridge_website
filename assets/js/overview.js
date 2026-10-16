/* Overview pillars: draws the labelled flow lines between the three cards.
 *   Workflow  -> Artifact   "constructs"                   (the paper and official repository flow into the workflow)
 *   Artifact  -> Benchmark  "refined artifact"             (the raw codebase is the comparison arm)
 *   Benchmark -x Workflow   "reference scores withheld"    (human reference information never reaches construction)
 * Desktop: lines run in the bands above and below the card row. Narrow (stacked cards): through the gaps and down
 * the left edge. Hovering or focusing a card warms its own lines. Schematic only; no data is encoded. */
(function () {
  'use strict';
  var sec = document.getElementById('overview');
  if (!sec || !window.RBCharts) return;
  var wrap = sec.querySelector('.ov-pillars');
  if (!wrap) return;
  var C = window.RBCharts;
  var cards = {};
  [].forEach.call(wrap.querySelectorAll('.ov-card'), function (c) { cards[c.getAttribute('data-k')] = c; });
  if (!cards.artifact || !cards.workflow || !cards.bench) return;

  wrap.classList.add('flow-on');
  var svg = C.svg('svg', { class: 'ov-flow', 'aria-hidden': 'true', focusable: 'false' });
  wrap.insertBefore(svg, wrap.firstChild);

  var flows = [];
  var hot = null;
  function f1(v) { return Math.round(v * 10) / 10; }

  /* layout box relative to the pillars (offset* ignores the cards' entrance transform) */
  function box(el) {
    var x = 0, y = 0, n = el;
    while (n && n !== wrap) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    var w = el.offsetWidth, h = el.offsetHeight;
    return { x: x, y: y, w: w, h: h, r: x + w, b: y + h, cx: x + w / 2, cy: y + h / 2 };
  }

  /* orthogonal polyline with rounded corners */
  function ortho(pts, rad) {
    var d = 'M' + f1(pts[0][0]) + ' ' + f1(pts[0][1]);
    for (var i = 1; i < pts.length - 1; i++) {
      var a = pts[i - 1], p = pts[i], b = pts[i + 1];
      var d1 = Math.hypot(p[0] - a[0], p[1] - a[1]), d2 = Math.hypot(b[0] - p[0], b[1] - p[1]);
      if (!d1 || !d2) continue;
      var r = Math.min(rad, d1 / 2, d2 / 2);
      var ux = (p[0] - a[0]) / d1, uy = (p[1] - a[1]) / d1, vx = (b[0] - p[0]) / d2, vy = (b[1] - p[1]) / d2;
      d += ' L' + f1(p[0] - ux * r) + ' ' + f1(p[1] - uy * r) + ' Q' + f1(p[0]) + ' ' + f1(p[1]) + ' ' + f1(p[0] + vx * r) + ' ' + f1(p[1] + vy * r);
    }
    var l = pts[pts.length - 1];
    return d + ' L' + f1(l[0]) + ' ' + f1(l[1]);
  }
  /* chevron arrowhead at the end of the last segment */
  function tip(pts) {
    var p = pts[pts.length - 1], a = pts[pts.length - 2];
    var L = Math.hypot(p[0] - a[0], p[1] - a[1]) || 1, ux = (p[0] - a[0]) / L, uy = (p[1] - a[1]) / L;
    var bx = p[0] - ux * 5.5, by = p[1] - uy * 5.5, nx = -uy * 4.2, ny = ux * 4.2;
    return 'M' + f1(bx + nx) + ' ' + f1(by + ny) + 'L' + f1(p[0]) + ' ' + f1(p[1]) + 'L' + f1(bx - nx) + ' ' + f1(by - ny);
  }

  function group(cls, keys, delay) {
    var g = C.svg('g', { class: 'fl ' + cls, style: { '--fd': delay + 's' } }, svg);
    flows.push({ g: g, keys: keys });
    if (hot && keys.indexOf(hot) >= 0) g.classList.add('hot');
    return g;
  }
  function line(g, pts, opts) {
    opts = opts || {};
    var p = C.svg('path', { class: 'fl-path', d: ortho(pts, 9) }, g);
    if (!opts.dashed) p.setAttribute('pathLength', '1');
    if (opts.arrow) C.svg('path', { class: 'fl-tip', d: tip(pts) }, g);
    if (opts.port) C.svg('circle', { class: 'fl-port' + (opts.port === 'solid' ? ' solid' : ''), cx: f1(pts[0][0]), cy: f1(pts[0][1]), r: 3.4 }, g);
    return p;
  }
  /* label with a background plate; anchor 'middle' | 'start' | 'end'; text may be an array of lines */
  function label(g, text, x, y, anchor, extraCls) {
    var lines = typeof text === 'string' ? [text] : text;
    var plate = C.svg('rect', { class: 'fl-plate', rx: 4 }, g);
    var t = C.svg('text', { class: 'fl-label' + (extraCls ? ' ' + extraCls : ''), x: f1(x), y: f1(y - (lines.length - 1) * 7), 'text-anchor': anchor || 'middle' }, g);
    lines.forEach(function (ln, i) { C.svg('tspan', { x: f1(x), dy: i ? 14 : 0, text: ln }, t); });
    var bb;
    try { bb = t.getBBox(); } catch (e) { bb = { x: x, y: y - 7, width: lines[0].length * 6.6, height: 14 * lines.length }; }
    plate.setAttribute('x', f1(bb.x - 6)); plate.setAttribute('y', f1(bb.y - 2));
    plate.setAttribute('width', f1(bb.width + 12)); plate.setAttribute('height', f1(bb.height + 4));
    return { w: bb.width + 12, t: t, plate: plate };
  }
  /* "withheld" marker: a small circle with a slash, centred at x, y */
  function noSign(g, x, y) {
    var s = C.svg('g', { class: 'fl-no', transform: 'translate(' + f1(x) + ' ' + f1(y) + ')' }, g);
    C.svg('circle', { r: 6 }, s);
    C.svg('path', { d: 'M-4.2 4.2L4.2 -4.2' }, s);
  }
  function measure(text) {
    var t = C.svg('text', { class: 'fl-label', x: -999, y: -999, text: text }, svg);
    var w = text.length * 6.6;
    try { w = t.getBBox().width; } catch (e) {}
    svg.removeChild(t);
    return w;
  }

  function render() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    flows = [];
    var A = box(cards.artifact), W = box(cards.workflow), B = box(cards.bench);
    if (!A.w || !W.w) return;
    var row = Math.abs(A.y - W.y) < 4 && W.x > A.r;

    if (row) {
      var top = Math.min(A.y, W.y, B.y), bot = Math.max(A.b, W.b, B.b);
      /* inputs: paper + official repository -> workflow, and the raw codebase as the benchmark's comparison arm */
      var portY = top - 46;
      var g = group('raw', ['workflow'], 0.2);
      label(g, 'paper + official repository', W.cx, top - 68, 'middle', 'src');
      line(g, [[W.cx, portY + 3.4], [W.cx, top - 3]], { arrow: true, port: 'ring' });
      var rx = B.x + B.w * 0.34;
      g = group('raw', ['bench'], 0.45);
      line(g, [[W.cx + 3.4, portY], [rx, portY], [rx, top - 3]], { arrow: true });
      label(g, 'raw codebase', (W.r + B.x) / 2 + 6, portY, 'middle');
      /* workflow -> artifact */
      var y1 = top - 26, sx = W.x + W.w * 0.18, ex = A.x + A.w * 0.82;
      g = group('rra', ['workflow', 'artifact'], 0.3);
      line(g, [[sx, top], [sx, y1], [ex, y1], [ex, top - 3]], { arrow: true, port: 'solid' });
      label(g, 'constructs', (sx + ex) / 2, y1, 'middle');
      /* benchmark -x workflow: the attach points widen until the label fits */
      var noTxt = 'reference scores withheld', need = measure(noTxt) + 12 + 22 + 30, gap = B.x - W.r;
      var a = Math.min(0.42, Math.max(0.24, (need - gap) / (2 * B.w)));
      var y2 = bot + 30, bx = B.x + B.w * a, wx = W.r - W.w * a;
      g = group('cut', ['bench', 'workflow'], 0.6);
      line(g, [[bx, bot + 2], [bx, y2], [wx, y2], [wx, bot + 2]], { dashed: true });
      var mid = (bx + wx) / 2, lw = measure(noTxt) + 12, x0 = mid - (lw + 18) / 2;
      noSign(g, x0 + 6, y2);
      label(g, noTxt, x0 + 18 + 6, y2, 'start');
      /* artifact -> benchmark */
      var y3 = bot + 68;
      g = group('rra', ['artifact', 'bench'], 0.75);
      line(g, [[A.cx, bot], [A.cx, y3], [B.cx, y3], [B.cx, bot + 3]], { arrow: true, port: 'solid' });
      label(g, 'refined artifact', W.cx, y3, 'middle');
    } else {
      /* stacked: workflow (card 2) -> artifact (card 1) through the first gap */
      var g12 = group('rra', ['workflow', 'artifact'], 0.3);
      var cx = A.cx, gTop = A.b, gBot = W.y, gm = (gTop + gBot) / 2;
      line(g12, [[cx, gBot], [cx, gTop + 3]], { arrow: true, port: 'solid' });
      label(g12, 'constructs', cx + 14, gm, 'start');
      /* benchmark (card 3) -x workflow (card 2) through the second gap */
      var g23 = group('cut', ['bench', 'workflow'], 0.6);
      var hTop = W.b, hBot = B.y, hm = (hTop + hBot) / 2 - 12;
      line(g23, [[cx, hBot - 2], [cx, hTop + 2]], { dashed: true });
      noSign(g23, cx, hm);
      var room = wrap.clientWidth + (window.innerWidth - wrap.getBoundingClientRect().right) - 6 - (cx + 14);
      var noTxt = 'reference scores withheld';
      label(g23, measure(noTxt) + 12 <= room ? noTxt : ['reference scores', 'withheld'], cx + 14, hm, 'start');
      /* artifact -> benchmark down the left edge, in the page gutter when the cards fill the column */
      var pageLeft = wrap.getBoundingClientRect().left;
      var railX = A.x - Math.min(26, (A.x + pageLeft) / 2);
      var gr = group('rra', ['artifact', 'bench'], 0.75);
      var sy = A.b - 40, ey = B.y + 40;
      line(gr, [[A.x, sy], [railX, sy], [railX, ey], [B.x - 3, ey]], { arrow: true, port: 'solid' });
      label(gr, 'refined artifact', railX + 10, (hTop + hBot) / 2 + 16, 'start');
    }
  }

  function setHot(k) {
    hot = k;
    flows.forEach(function (f) { f.g.classList.toggle('hot', !!k && f.keys.indexOf(k) >= 0); });
  }
  Object.keys(cards).forEach(function (k) {
    var c = cards[k];
    c.addEventListener('mouseenter', function () { setHot(k); });
    c.addEventListener('mouseleave', function () { if (hot === k) setHot(null); });
    c.addEventListener('focusin', function () { setHot(k); });
    c.addEventListener('focusout', function () { if (hot === k) setHot(null); });
  });

  /* re-draw when the cards move: width changes, font loading, reflow of card heights */
  var raf = 0, lastW = -1, lastH = -1;
  function schedule() { if (!raf) raf = requestAnimationFrame(function () { raf = 0; render(); }); }
  if ('ResizeObserver' in window) {
    new ResizeObserver(function () {
      var w = wrap.clientWidth, h = wrap.clientHeight;
      if (Math.abs(w - lastW) < 1 && Math.abs(h - lastH) < 1) return;
      lastW = w; lastH = h; schedule();
    }).observe(wrap);
  } else {
    window.addEventListener('resize', schedule);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  render();

  /* once the entrance has played, colour changes on hover should feel immediate */
  function settle() { setTimeout(function () { wrap.classList.add('settled'); }, window.RB && window.RB.reduced() ? 0 : 2600); }
  if (wrap.classList.contains('in')) settle();
  else if ('MutationObserver' in window) {
    var mo = new MutationObserver(function () { if (wrap.classList.contains('in')) { mo.disconnect(); settle(); } });
    mo.observe(wrap, { attributes: true, attributeFilter: ['class'] });
  }
})();
