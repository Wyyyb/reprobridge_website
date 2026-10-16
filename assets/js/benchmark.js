/* 02 · Benchmark: the selection funnel, the reference-verification bar, the "Try the rule" compatibility-interval
 * explainer and the four audit-vs-human confusion matrices. Every number comes from window.RB_DATA (selection,
 * categories, interval, audit_validation, human_review, papers); the explainer's own values are illustrative and
 * labelled so. Interval rule (Eq. 1): r = max(t_{(1+q)/2,4} * s * sqrt(1 + 1/5), 0.01 |xbar|), s the sample SD
 * (n - 1), closed interval [xbar - r, xbar + r]; task eligibility always uses q = 0.95 (Eq. 2 then splits
 * Cat. 1 / Cat. 2 at V = 10). No-ops silently if the section or its data is missing. */
(function () {
  'use strict';
  var root = document.getElementById('benchmark');
  var C = window.RBCharts, RB = window.RB, D = window.RB_DATA;
  if (!root || !C || !D) return;
  var h = C.h, svgEl = C.svg;
  var num = function (v) { return C.fmt.num(v, 0); };
  var reduced = function () { return !!(RB && RB.reduced && RB.reduced()); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var lcFirst = function (s) { return s.charAt(0).toLowerCase() + s.slice(1); };

  /* run fn once when el is visibly on screen (entrance animations); immediately under reduced motion */
  function onSeen(el, fn) {
    if (reduced() || !('IntersectionObserver' in window)) { fn(); return; }
    var io = new IntersectionObserver(function (es) {
      if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); fn(); }
    }, { threshold: 0.3 });
    io.observe(el);
  }

  /* ================================================================== 1. selection funnel */
  function funnel() {
    var el = document.getElementById('bm-funnel'), S = D.selection;
    if (!el || !S || !S.excluded) return;
    var w = function (n) { return Math.sqrt(n / S.spotlights) * 100; };      /* % of the bar column, square-root scale */
    var stages = [
      { n: S.spotlights, l: 'ICML 2026 Spotlight papers' },
      { n: S.eligible, l: 'with code and non-purely-theoretical content' },
      { n: S.sampled, l: 'papers in the random sample' },
      { n: S.retained, l: 'retained test papers', final: true }
    ];
    var ops = ['Mechanically filtered', 'Randomly sampled', 'Excluded'];
    var tips = [
      'Primary exclusion category: artifact/code availability.',
      'More than half of the main experiments require over 100 H100 GPU-hours per experiment or more than one eight-H100 node. These are selection criteria, not measured universal execution budgets.',
      'Closed-model dependence: the API criterion concerns more than half of the main experiments.'
    ];
    el.innerHTML = '';
    /* connectors are drawn in one overlay from the measured bar boxes, so they meet the bars at any label height */
    var links = svgEl('svg', { class: 'bm-fn-links', 'aria-hidden': 'true', focusable: 'false' }, el);
    stages.forEach(function (st, i) {
      var bar = h('div', { class: 'bm-fn-bar', style: '--w:' + w(st.n).toFixed(3) + '%' });
      if (i === 2) {
        bar.appendChild(h('span', { class: 'bm-fn-seg is-keep', style: 'flex-grow:' + S.retained }));
        S.excluded.forEach(function (x, k) { bar.appendChild(h('span', { class: 'bm-fn-seg is-out', 'data-x': k, style: 'flex-grow:' + x.n })); });
      } else {
        bar.appendChild(h('span', { class: 'bm-fn-seg' + (st.final ? ' is-keep' : ''), style: 'flex-grow:1' }));
      }
      el.appendChild(h('div', { class: 'bm-fn-stage' + (st.final ? ' is-final' : ''), 'data-step': String(i), style: '--i:' + i }, [
        h('div', { class: 'bm-fn-meta' }, [h('span', { class: 'bm-fn-n', text: num(st.n) }), h('span', { class: 'bm-fn-l', text: st.l })]),
        h('div', { class: 'bm-fn-col' }, [bar])
      ]));
      if (i === stages.length - 1) return;
      var meta = h('div', { class: 'bm-fn-meta' }, [h('span', { class: 'bm-fn-op', text: ops[i] })]);
      if (i === 2) {
        var list = h('ul', { class: 'bm-fn-x' });
        S.excluded.forEach(function (x, k) {
          var li = h('li', { tabindex: '0', 'data-x': String(k) }, [h('b', { text: String(x.n) }), h('span', { text: lcFirst(x.reason) })]);
          C.bindTip(li, '<div class="tt">Excluded · ' + x.n + ' of ' + S.sampled + ' sampled</div><div class="row"><span>' + esc(x.reason) + '</span><b>' + x.n + '</b></div><div class="sub">' + esc(tips[k] || '') + '</div>');
          var seg = el.querySelector('.bm-fn-seg.is-out[data-x="' + k + '"]');
          var on = function () { li.classList.add('is-on'); if (seg) seg.classList.add('is-on'); };
          var off = function () { li.classList.remove('is-on'); if (seg) seg.classList.remove('is-on'); };
          li.addEventListener('pointerenter', on); li.addEventListener('pointerleave', off);
          li.addEventListener('focus', on); li.addEventListener('blur', off);
          list.appendChild(li);
        });
        meta.appendChild(list);
      }
      el.appendChild(h('div', { class: 'bm-fn-link' + (i === 2 ? ' is-out' : ''), style: '--i:' + i }, [meta, h('div', { class: 'bm-fn-col' })]));
    });
    function drawLinks() {
      var box = el.getBoundingClientRect();
      if (!box.width) return;
      links.setAttribute('width', box.width.toFixed(1));
      links.setAttribute('height', box.height.toFixed(1));
      links.setAttribute('viewBox', '0 0 ' + box.width.toFixed(1) + ' ' + box.height.toFixed(1));
      while (links.firstChild) links.removeChild(links.firstChild);
      var bars = el.querySelectorAll('.bm-fn-bar');
      for (var i = 0; i < bars.length - 1; i++) {
        /* from the third bar, only the retained segment continues */
        var up = (i === 2 ? bars[i].querySelector('.bm-fn-seg.is-keep') : bars[i]).getBoundingClientRect();
        var lo = bars[i + 1].getBoundingClientRect();
        var X = function (v) { return (v - box.left).toFixed(1); }, Y = function (v) { return (v - box.top).toFixed(1); };
        var g = svgEl('g', { class: i === 2 ? 'is-out' : null, style: '--i:' + i }, links);
        svgEl('polygon', { points: [X(up.left) + ',' + Y(up.bottom), X(up.right) + ',' + Y(up.bottom), X(lo.right) + ',' + Y(lo.top), X(lo.left) + ',' + Y(lo.top)].join(' ') }, g);
        svgEl('line', { x1: X(up.left), y1: Y(up.bottom), x2: X(lo.left), y2: Y(lo.top) }, g);
        svgEl('line', { x1: X(up.right), y1: Y(up.bottom), x2: X(lo.right), y2: Y(lo.top) }, g);
      }
    }
    drawLinks();
    C.onResize(el, drawLinks);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawLinks);
    window.addEventListener('load', drawLinks);
    /* the text (numbers, labels, operations) reads in order; bars and connectors are decorative */
    [].forEach.call(el.querySelectorAll('.bm-fn-col'), function (c) { c.setAttribute('aria-hidden', 'true'); });
    if (!reduced()) { el.classList.add('is-ready'); onSeen(el, function () { el.classList.add('is-in'); }); }
  }

  /* ================================================================== 2. reference-verification bar */
  function verification() {
    var el = document.getElementById('bm-vbar'), list = document.getElementById('bm-cats');
    var cats = D.categories, S = D.selection;
    if (!el || !cats || cats.length !== 5 || !S) return;
    var total = S.tasks_curated;
    el.innerHTML = '';
    el.style.gridTemplateColumns = cats.map(function (c) { return 'minmax(0, ' + c.tasks + 'fr)'; }).join(' ');
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', 'Verification outcomes of all ' + num(total) + ' curated tasks');
    el.appendChild(h('div', { class: 'bm-vb-brk is-top', style: 'grid-column: 1 / 3', 'aria-hidden': 'true' }, [
      h('span', { html: 'Evaluation set · <b>' + num(S.tasks_verified) + '</b> tasks · <b>' + S.verified_share.toFixed(1) + '%</b>' })]));
    var tipFor = function (c) {
      return '<div class="tt">Cat. ' + c.cat + ' · ' + (c.cat <= 2 ? 'evaluation set' : 'not evaluated') + '</div>' +
        '<div class="row"><span>' + esc(c.label) + '</span><b>' + num(c.tasks) + '</b></div>' +
        '<div class="row"><span>Share of ' + num(total) + ' curated</span><b>' + c.share.toFixed(1) + '%</b></div>' +
        '<div class="sub">' + esc(c.interpretation) + '</div>';
    };
    var rows = list ? [].slice.call(list.querySelectorAll('li[data-cat]')) : [];
    function setOn(cat) {
      el.classList.toggle('has-on', cat !== null);
      [].forEach.call(el.querySelectorAll('[data-cat]'), function (n) { n.classList.toggle('is-on', n.getAttribute('data-cat') === String(cat)); });
      rows.forEach(function (r) { r.classList.toggle('is-on', r.getAttribute('data-cat') === String(cat)); });
    }
    cats.forEach(function (c, i) {
      el.appendChild(h('span', { class: 'bm-vb-cnt', 'data-cat': String(c.cat), style: 'grid-column:' + (i + 1), 'aria-hidden': 'true', text: num(c.tasks) }));
    });
    cats.forEach(function (c, i) {
      var seg = h('span', {
        class: 'bm-vb-seg' + (i === 0 ? ' is-first' : '') + (i === cats.length - 1 ? ' is-last' : ''),
        'data-cat': String(c.cat), tabindex: '0', role: 'img', style: 'grid-column:' + (i + 1) + ';--i:' + i,
        'aria-label': 'Category ' + c.cat + ', ' + c.label + ': ' + num(c.tasks) + ' tasks, ' + c.share.toFixed(1) + '%. ' + c.interpretation + '.'
      }, [h('span', { 'aria-hidden': 'true', text: String(c.cat) })]);
      C.bindTip(seg, tipFor(c));
      seg.addEventListener('pointerenter', function () { setOn(c.cat); });
      seg.addEventListener('pointerleave', function () { setOn(null); });
      seg.addEventListener('focus', function () { setOn(c.cat); });
      seg.addEventListener('blur', function () { setOn(null); });
      el.appendChild(seg);
    });
    el.appendChild(h('div', { class: 'bm-vb-brk is-bot', style: 'grid-column: 3 / 6', 'aria-hidden': 'true' }, [
      h('span', { text: num(S.tasks_curated - S.tasks_verified) + ' remaining tasks' })]));
    /* keep the list (the no-JS view) in sync with RB_DATA, and link it to the bar */
    rows.forEach(function (r) {
      var c = cats.filter(function (x) { return String(x.cat) === r.getAttribute('data-cat'); })[0];
      if (!c) return;
      var set = function (sel, t) { var n = r.querySelector(sel); if (n) n.textContent = t; };
      set('.bm-cat-t b', c.label); set('.bm-cat-t span', c.interpretation);
      set('.bm-cat-n', num(c.tasks)); set('.bm-cat-p', c.share.toFixed(1) + '%');
      r.addEventListener('pointerenter', function () { setOn(c.cat); });
      r.addEventListener('pointerleave', function () { setOn(null); });
    });
    if (!reduced()) { el.classList.add('is-ready'); onSeen(el, function () { el.classList.add('is-in'); }); }
  }

  /* ================================================================== 3. "Try the rule": the compatibility interval */
  function explainer() {
    var card = document.getElementById('bm-try'), host = document.getElementById('bm-line'), I = D.interval;
    if (!card || !host || !I || !I.t || !I.t['0.95'] || !I.t['0.80']) return;
    var T = { '0.95': I.t['0.95'], '0.80': I.t['0.80'] };
    var K = I.inflation || Math.sqrt(1 + 1 / 5), FLOOR = I.floor, VTH = I.stable_threshold_V;
    var MIN = 66, MAX = 80, STEP = 0.1, BIG = 1;
    var DEF = { refs: [71.8, 72.4, 72.9, 73.5, 72.1], p: 72.9, y: 74.1, q: '0.95' };   /* illustrative defaults */
    var st = { refs: DEF.refs.slice(), p: DEF.p, y: DEF.y, q: DEF.q };
    var catsBy = {};
    (D.categories || []).forEach(function (c) { catsBy[c.cat] = c; });
    var termT = root.querySelector('.bm-term-t'), termF = root.querySelector('.bm-term-f');
    var verdict = card.querySelector('.bm-verdict'), vword = card.querySelector('.bm-vw'), vreason = card.querySelector('.bm-vreason');
    var calc = card.querySelector('.bm-calc'), live = document.getElementById('bm-live');
    var readQ = card.querySelector('.bm-read-q');
    var readRows = card.querySelectorAll('.bm-read-rows');
    var lastSay = '';

    var snap = function (v) { return Math.round(Math.min(MAX, Math.max(MIN, v)) / STEP) / Math.round(1 / STEP); };   /* exact tenths */
    var f1 = function (v) { return v.toFixed(1); }, f2 = function (v) { return v.toFixed(2); }, f3 = function (v) { return v.toFixed(3); };
    var qSup = function (q) { return '<i>I</i><sup>(' + q.slice(1) + ')</sup>'; };       /* I^(.95) as in the paper */

    function stats(q) {
      var x = st.refs, n = x.length, m = 0, ss = 0, i;
      for (i = 0; i < n; i++) m += x[i];
      m /= n;
      for (i = 0; i < n; i++) ss += (x[i] - m) * (x[i] - m);
      var s = Math.sqrt(ss / (n - 1));                                   /* sample SD: 4 degrees of freedom */
      var tterm = T[q] * s * K, floor = FLOOR * Math.abs(m), r = Math.max(tterm, floor);
      return { m: m, s: s, t: T[q], tterm: tterm, floor: floor, r: r, lo: m - r, hi: m + r, floorOn: floor >= tterm };
    }
    function verify(r95) {
      var lo = Math.min.apply(null, st.refs), hi = Math.max.apply(null, st.refs);
      var eligible = st.p >= r95.lo && st.p <= r95.hi;
      var V = st.p === 0 ? Infinity : 100 * (hi - lo) / Math.abs(st.p);
      return { min: lo, max: hi, eligible: eligible, V: V, cat: eligible ? (V <= VTH ? 1 : 2) : 3, bracketed: st.p >= lo && st.p <= hi };
    }

    /* ---------------------------------------------------------------- SVG */
    var svg = null, G = {}, L = null, x = null, marks = [];
    function layout() {
      var W = Math.max(280, host.clientWidth || 600), narrow = W < 540;
      var padL = narrow ? 14 : 118, padR = narrow ? 16 : 26;
      var bandTop = narrow ? 34 : 30, first = bandTop + (narrow ? 44 : 30), gap = narrow ? 56 : 46;
      var lanes = { refs: first, p: first + gap, y: first + 2 * gap };
      var axisY = lanes.y + (narrow ? 26 : 30);
      L = { W: W, H: axisY + 30, narrow: narrow, padL: padL, padR: padR, bandTop: bandTop, lanes: lanes, axisY: axisY };
      x = C.linear(MIN, MAX, padL, W - padR);
      build();
      update(false);
    }
    function build() {
      host.innerHTML = '';
      marks = [];
      svg = svgEl('svg', { viewBox: '0 0 ' + L.W + ' ' + L.H, width: L.W, height: L.H, role: 'group',
        'aria-label': 'Number line from ' + MIN + ' to ' + MAX + ' in illustrative score units, with the compatibility interval and seven draggable markers' }, host);
      var gGrid = svgEl('g', { class: 'bm-tick', 'aria-hidden': 'true' }, svg);
      var every = (x(MIN + 1) - x(MIN)) < 30 ? 2 : 1;
      for (var v = MIN; v <= MAX; v++) {
        var X = x(v), major = (v - MIN) % every === 0;
        svgEl('line', { x1: X, x2: X, y1: L.axisY, y2: L.axisY + (major ? 5 : 3) }, gGrid);
        if (major) svgEl('text', { x: X, y: L.axisY + 19, 'text-anchor': 'middle', text: String(v) }, gGrid);
      }
      G.band = svgEl('rect', { class: 'bm-band', y: L.bandTop, height: L.axisY - L.bandTop, rx: 3 }, svg);
      G.band95 = svgEl('rect', { class: 'bm-band95', y: L.bandTop - 4, height: L.axisY - L.bandTop + 4, rx: 4 }, svg);
      G.edgeL = svgEl('line', { class: 'bm-band-edge', y1: L.bandTop, y2: L.axisY }, svg);
      G.edgeR = svgEl('line', { class: 'bm-band-edge', y1: L.bandTop, y2: L.axisY }, svg);
      G.center = svgEl('line', { class: 'bm-center', y1: L.bandTop, y2: L.axisY }, svg);
      G.xbar = svgEl('text', { class: 'bm-xbar', y: L.bandTop - 8, 'text-anchor': 'middle', 'aria-hidden': 'true', text: 'x̄' }, svg);
      G.lo = svgEl('text', { class: 'bm-bound', y: L.bandTop - 8, 'aria-hidden': 'true' }, svg);
      G.hi = svgEl('text', { class: 'bm-bound', y: L.bandTop - 8, 'aria-hidden': 'true' }, svg);
      G.k95 = svgEl('text', { class: 'bm-k95', y: L.axisY - 6, 'aria-hidden': 'true', text: 'I(.95)' }, svg);
      G.clipL = svgEl('path', { class: 'bm-clip', 'aria-hidden': 'true' }, svg);
      G.clipR = svgEl('path', { class: 'bm-clip', 'aria-hidden': 'true' }, svg);
      svgEl('line', { class: 'bm-axis', x1: L.padL, x2: L.W - L.padR, y1: L.axisY, y2: L.axisY }, svg);
      var laneDefs = [['refs', 'Reference runs', 'x₁ … x₅'], ['p', 'Published score', 'p'], ['y', 'New result', 'Y']];
      laneDefs.forEach(function (d) {
        var y = L.lanes[d[0]];
        svgEl('line', { class: 'bm-lane', x1: L.padL, x2: L.W - L.padR, y1: y, y2: y, 'aria-hidden': 'true' }, svg);
        var t = L.narrow ? svgEl('text', { class: 'bm-lane-l', x: L.padL, y: y - 17, 'aria-hidden': 'true' }, svg)
                         : svgEl('text', { class: 'bm-lane-l', x: 0, y: y - 1, 'aria-hidden': 'true' }, svg);
        svgEl('tspan', { text: d[1] }, t);
        if (L.narrow) svgEl('tspan', { class: 'bm-lane-s', dx: 6, text: d[2] }, t);
        else svgEl('text', { class: 'bm-lane-s', x: 0, y: y + 13, 'aria-hidden': 'true', text: d[2] }, svg);
      });
      st.refs.forEach(function (v, i) { marks.push(marker('refs', i)); });
      marks.push(marker('p', 0));
      marks.push(marker('y', 0));
    }
    function label(key, i) {
      return key === 'refs' ? 'Reference observation ' + (i + 1) : key === 'p' ? 'Published score p' : 'New result Y';
    }
    function get(key, i) { return key === 'refs' ? st.refs[i] : st[key]; }
    function setVal(key, i, v) {
      v = snap(v);
      if (Math.abs(v - get(key, i)) < 1e-9) return;
      if (key === 'refs') st.refs[i] = v; else st[key] = v;
      update(true);
    }
    function marker(key, i) {
      var y = L.lanes[key];
      var g = svgEl('g', { class: 'bm-mk', tabindex: '0', role: 'slider', 'aria-label': label(key, i), 'aria-orientation': 'horizontal',
        'aria-valuemin': MIN, 'aria-valuemax': MAX, 'data-key': key }, svg);
      svgEl('circle', { class: 'bm-hit', r: 17, cx: 0, cy: 0 }, g);
      svgEl('circle', { class: 'bm-ring', r: key === 'p' ? 14 : 13, cx: 0, cy: 0 }, g);
      if (key === 'refs') svgEl('circle', { class: 'bm-ref', r: 7.5, cx: 0, cy: 0 }, g);
      else if (key === 'p') svgEl('path', { class: 'bm-pub', d: 'M0 -9.5L9.5 0L0 9.5L-9.5 0Z' }, g);
      else svgEl('circle', { class: 'bm-y', r: 8, cx: 0, cy: 0 }, g);
      /* value labels sit above the marker; on narrow lines they move beside it, clear of the lane labels */
      var val = svgEl('text', { class: 'bm-val' + (key === 'refs' ? ' bm-refval' : ''), y: L.narrow ? 4 : -15, x: L.narrow ? 14 : 0, 'text-anchor': L.narrow ? 'start' : 'middle' }, g);
      var m = { key: key, i: i, g: g, val: val, y: y };
      g.addEventListener('pointerdown', function (e) {
        if (e.button !== undefined && e.button !== 0) return;
        e.preventDefault();
        var px = function (ev) { var r = svg.getBoundingClientRect(); return (ev.clientX - r.left) * (L.W / r.width); };
        /* overlapping reference dots: grab the one nearest the pointer, not the topmost hit area */
        var t = m;
        if (key === 'refs') {
          var x0 = px(e), best = Infinity;
          marks.forEach(function (o) { if (o.key === 'refs') { var d = Math.abs(x(st.refs[o.i]) - x0); if (d < best - 1e-6) { best = d; t = o; } } });
        }
        try { t.g.focus({ preventScroll: true }); } catch (err) { t.g.focus(); }
        t.g.classList.add('is-drag');
        var offset = x(get(t.key, t.i)) - px(e);
        var move = function (ev) { setVal(t.key, t.i, x.invert(px(ev) + offset)); };
        var up = function () {
          t.g.classList.remove('is-drag');
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          window.removeEventListener('pointercancel', up);
          announce();
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', up);
      });
      g.addEventListener('keydown', function (e) {
        var v = get(key, i), d = 0;
        switch (e.key) {
          case 'ArrowRight': case 'ArrowUp': d = e.shiftKey ? BIG : STEP; break;
          case 'ArrowLeft': case 'ArrowDown': d = -(e.shiftKey ? BIG : STEP); break;
          case 'PageUp': d = BIG; break;
          case 'PageDown': d = -BIG; break;
          case 'Home': e.preventDefault(); setVal(key, i, MIN); announce(); return;
          case 'End': e.preventDefault(); setVal(key, i, MAX); announce(); return;
          default: return;
        }
        e.preventDefault();
        setVal(key, i, v + d);
        announce();
      });
      return m;
    }

    /* ---------------------------------------------------------------- state -> picture + readouts */
    var S = null, S95 = null, VR = null;
    function bandX(lo, hi) {
      var a = Math.max(MIN, lo), b = Math.min(MAX, hi);
      return { x0: x(a), x1: x(Math.max(a, b)), clipL: lo < MIN, clipR: hi > MAX };
    }
    function chevron(X, dir) {
      var y = L.bandTop + (L.axisY - L.bandTop) / 2, s = 5;
      return 'M' + (X + dir * 3) + ' ' + (y - s) + 'L' + (X - dir * 3) + ' ' + y + 'L' + (X + dir * 3) + ' ' + (y + s) + 'Z';
    }
    function update(userChange) {
      S = stats(st.q); S95 = st.q === '0.95' ? S : stats('0.95'); VR = verify(S95);
      if (svg) {
        var b = bandX(S.lo, S.hi);
        C.attrs(G.band, { x: b.x0, width: Math.max(0, b.x1 - b.x0) });
        C.attrs(G.edgeL, { x1: b.x0, x2: b.x0, opacity: b.clipL ? 0 : 1 });
        C.attrs(G.edgeR, { x1: b.x1, x2: b.x1, opacity: b.clipR ? 0 : 1 });
        G.clipL.setAttribute('d', b.clipL ? chevron(x(MIN) + 7, 1) : '');
        G.clipR.setAttribute('d', b.clipR ? chevron(x(MAX) - 7, -1) : '');
        var show95 = st.q !== '0.95', b95 = bandX(S95.lo, S95.hi);
        C.attrs(G.band95, { x: b95.x0, width: Math.max(0, b95.x1 - b95.x0) });
        G.band95.style.opacity = show95 ? '' : '0';
        G.k95.style.opacity = show95 ? '' : '0';
        C.attrs(G.k95, { x: b95.x0 + 5, 'text-anchor': 'start' });
        var cx = x(Math.min(MAX, Math.max(MIN, S.m)));
        C.attrs(G.center, { x1: cx, x2: cx });
        C.attrs(G.xbar, { x: cx });
        /* bounds sit outside the band edges; near an SVG edge (or when the band is clipped) they move inside it,
           and the x-bar label steps aside if a bound label would touch it */
        G.lo.textContent = f3(S.lo); G.hi.textContent = f3(S.hi);
        var tw = function (t) { try { return t.getComputedTextLength(); } catch (err) { return 44; } };
        var wLo = tw(G.lo), wHi = tw(G.hi), loExt, hiExt;
        if (b.clipL || b.x0 - 4 - wLo < 0) { var lx = b.clipL ? x(MIN) + 3 : b.x0 + 4; C.attrs(G.lo, { x: lx, 'text-anchor': 'start' }); loExt = [lx, lx + wLo]; }
        else { C.attrs(G.lo, { x: b.x0 - 4, 'text-anchor': 'end' }); loExt = [b.x0 - 4 - wLo, b.x0 - 4]; }
        if (b.clipR || b.x1 + 4 + wHi > L.W) { var hx = b.clipR ? x(MAX) - 3 : b.x1 - 4; C.attrs(G.hi, { x: hx, 'text-anchor': 'end' }); hiExt = [hx - wHi, hx]; }
        else { C.attrs(G.hi, { x: b.x1 + 4, 'text-anchor': 'start' }); hiExt = [b.x1 + 4, b.x1 + 4 + wHi]; }
        if (loExt[1] + 6 > hiExt[0]) {      /* the two bounds would touch: one combined label over the visible band */
          G.lo.textContent = f3(S.lo) + ' – ' + f3(S.hi);
          var wc = tw(G.lo), mid = Math.max(2 + wc / 2, Math.min(L.W - 2 - wc / 2, (b.x0 + b.x1) / 2));
          C.attrs(G.lo, { x: mid, 'text-anchor': 'middle' });
          loExt = [mid - wc / 2, mid + wc / 2]; hiExt = [-1e9, -1e9];
          G.hi.style.opacity = '0';
        } else G.hi.style.opacity = '';
        var xbExt = [cx - 7, cx + 7], hit = function (e) { return e[0] < xbExt[1] + 3 && e[1] > xbExt[0] - 3; };
        G.xbar.style.opacity = hit(loExt) || hit(hiExt) ? '0' : '';
        var yOk = st.y >= S.lo && st.y <= S.hi;
        marks.forEach(function (m) {
          var v = get(m.key, m.i);
          m.g.setAttribute('transform', 'translate(' + x(v).toFixed(2) + ',' + m.y + ')');
          m.g.setAttribute('aria-valuenow', f1(v));
          var vt = f1(v);
          if (m.key === 'y') vt += yOk ? ', compatible' : ', incompatible';
          if (m.key === 'p') vt += VR.eligible ? ', inside the 95% interval' : ', outside the 95% interval';
          m.g.setAttribute('aria-valuetext', vt);
          m.val.textContent = m.key === 'refs' ? f1(v) : (m.key === 'p' ? 'p ' : 'Y ') + f1(v);
          if (L.narrow) {
            var flip = x(v) > L.W - L.padR - 60;
            C.attrs(m.val, { x: flip ? -14 : 14, 'text-anchor': flip ? 'end' : 'start' });
          }
          if (m.key === 'y') {
            var ring = m.g.querySelector('.bm-y');
            ring.classList.toggle('is-ok', yOk); ring.classList.toggle('is-bad', !yOk);
          }
        });
      }
      readouts();
      if (termT && termF) { termT.classList.toggle('is-on', !S.floorOn); termF.classList.toggle('is-on', S.floorOn); }
      if (!userChange) lastSay = say();
    }
    function readouts() {
      var yOk = st.y >= S.lo && st.y <= S.hi, above = st.y > S.hi;
      verdict.setAttribute('data-state', yOk ? 'ok' : 'bad');
      vword.textContent = yOk ? 'Compatible' : 'Incompatible';
      var Y = '<i>Y</i> = <b>' + f1(st.y) + '</b>';
      if (yOk) vreason.innerHTML = Y + ' lies inside ' + qSup(st.q) + ' = <b>[' + f3(S.lo) + ', ' + f3(S.hi) + ']</b>.';
      else vreason.innerHTML = Y + ' lies <b>' + f3(above ? st.y - S.hi : S.lo - st.y) + '</b> ' + (above ? 'above the upper' : 'below the lower') +
        ' bound of ' + qSup(st.q) + '. Two-sided: it fails even if it improves on the published score.';
      var on = function (b) { return b ? ' is-on' : ' is-off'; };
      calc.innerHTML = '<span><span class="k">r = max{</span> <span class="t' + on(!S.floorOn) + '">' + S.t.toFixed(3) + ' × ' + f3(S.s) + ' × ' + K.toFixed(3) + '</span>' +
        '<span class="k">,</span> <span class="t' + on(S.floorOn) + '">0.01 × ' + f2(Math.abs(S.m)) + '</span> <span class="k">}</span></span>' +
        '<span><span class="k">= max{</span> <span class="t' + on(!S.floorOn) + '">' + f3(S.tterm) + '</span><span class="k">,</span> <span class="t' + on(S.floorOn) + '">' +
        f3(S.floor) + '</span> <span class="k">} =</span> <b>' + f3(S.r) + '</b>' + (S.floorOn ? '<span class="fl">floor active</span>' : '') + '</span>';
      if (readQ) readQ.textContent = 'q = ' + st.q;
      var row = function (k, v, cls) { return '<div class="bm-read-row"><span>' + k + '</span><span class="bm-read-v' + (cls ? ' ' + cls : '') + '">' + v + '</span></div>'; };
      readRows[0].innerHTML =
        row('Mean <span class="ov">x</span> · SD <i>s</i>', f2(S.m) + ' · ' + f3(S.s)) +
        row(qSup(st.q) + ' = <span class="ov">x</span> ± <i>r</i>', '[' + f3(S.lo) + ', ' + f3(S.hi) + ']') +
        row('New result <i>Y</i>', f1(st.y) + (yOk ? ' · inside' : above ? ' · above' : ' · below'), yOk ? 'is-ok' : 'is-bad');
      var c = catsBy[VR.cat] || { label: '' };
      var vTxt = isFinite(VR.V) ? f2(VR.V) : '+∞';
      readRows[1].innerHTML =
        row('Published <i>p</i>', f1(st.p) + (VR.eligible ? ' · inside' : ' · outside'), VR.eligible ? 'is-ok' : 'is-bad') +
        (st.q !== '0.95' ? row(qSup('0.95'), '[' + f3(S95.lo) + ', ' + f3(S95.hi) + ']') : '') +
        row('<i>V</i> = 100 · (' + f1(VR.max) + ' − ' + f1(VR.min) + ') / |' + f1(st.p) + '|', vTxt) +
        '<div class="bm-read-cat" data-cat="' + VR.cat + '"><span class="bm-cat-dot"></span><b>Cat. ' + VR.cat + ' · ' + esc(c.label) + '</b> ' +
        (VR.cat === 1 ? '(<i>V</i> ≤ ' + VTH + '): enters the evaluation set'
          : VR.cat === 2 ? '(<i>V</i> &gt; ' + VTH + '): enters the evaluation set'
          : ': <i>p</i> lies outside <i>I</i><sup>(.95)</sup>, so the task is not evaluated') + '</div>' +
        (VR.eligible && !VR.bracketed ? '<div class="bm-read-note"><i>p</i> lies outside the five observations yet inside the interval, which the rule allows.</div>' : '');
    }
    function say() {
      var yOk = st.y >= S.lo && st.y <= S.hi, c = catsBy[VR.cat] || { label: '' };
      return 'New result ' + (yOk ? 'compatible' : 'incompatible') + ' at q ' + st.q + (S.floorOn ? ', 1% floor active' : '') +
        '. Task category ' + VR.cat + ', ' + c.label + (VR.eligible ? '.' : ', not evaluated.');
    }
    function announce() {
      var s = say();
      if (s !== lastSay && live) live.textContent = s;
      lastSay = s;
    }

    /* ---------------------------------------------------------------- controls */
    var qHost = document.getElementById('bm-q'), seg = null;
    if (qHost) {
      seg = C.seg(qHost, [
        { value: '0.95', label: 'q = 0.95 · t ≈ ' + T['0.95'].toFixed(2), title: 'Default interval' },
        { value: '0.80', label: 'q = 0.80 · t ≈ ' + T['0.80'].toFixed(2), title: 'Stricter scoring check' }
      ], st.q, function (v) { st.q = v; update(true); announce(); }, 'Interval level q');
    }
    var reset = card.querySelector('.bm-reset');
    if (reset) reset.addEventListener('click', function () {
      st.refs = DEF.refs.slice(); st.p = DEF.p; st.y = DEF.y; st.q = DEF.q;
      if (seg) seg.set(DEF.q); else update(true);
      update(true); announce();
    });
    layout();
    C.onResize(host, layout);
  }

  /* ================================================================== 4. audit judgments vs human verification */
  function matrices() {
    var el = document.getElementById('bm-cms'), A = D.audit_validation, HR = D.human_review || {};
    if (!el || !A || !A.length) return;
    var per = HR.tasks || 409;
    var KIND = {
      tp: ['TP', 'Detected invalid outcomes', 'human invalid, Auditor flag'],
      fn: ['FN', 'Missed invalid outcomes', 'human invalid, Auditor pass'],
      fp: ['FP', 'Flagged valid outcomes', 'human valid, Auditor flag'],
      tn: ['TN', 'Accepted valid outcomes', 'human valid, Auditor pass']
    };
    var order = [['Raw', 'Codex'], ['Raw', 'Claude'], ['RRA', 'Codex'], ['RRA', 'Claude']];
    el.innerHTML = '';
    function setOn(k) {
      el.classList.toggle('has-on', !!k);
      [].forEach.call(el.querySelectorAll('.bm-cm-c'), function (c) { c.classList.toggle('is-on', !!k && c.classList.contains('k-' + k)); });
    }
    order.forEach(function (o) {
      var r = A.filter(function (a) { return a.scope === o[0] && a.auditor === o[1]; })[0];
      if (!r) return;
      var v = { tp: r.tp, fn: r.fn, fp: r.fp, tn: r.tn !== undefined ? r.tn : per - r.tp - r.fn - r.fp };
      var name = o[0] + ' · ' + o[1];
      var cell = function (k) {
        var td = h('td', { class: 'bm-cm-c k-' + k,
          'aria-label': KIND[k][0] + ', ' + KIND[k][1].toLowerCase() + ' (' + KIND[k][2] + '): ' + v[k] + ' of ' + per + ' ' + o[0] + ' outcomes' }, [
          h('small', { 'aria-hidden': 'true', text: KIND[k][0] }), h('span', { 'aria-hidden': 'true', text: num(v[k]) })]);
        C.bindTip(td, '<div class="tt">' + esc(name) + ' · ' + KIND[k][0] + '</div><div class="row"><span>' + KIND[k][1] + '</span><b>' + num(v[k]) + '</b></div>' +
          '<div class="sub">' + KIND[k][2] + ' · of ' + per + ' ' + esc(o[0]) + ' outcomes</div>');
        td.addEventListener('pointerenter', function () { setOn(k); });
        td.addEventListener('pointerleave', function () { setOn(null); });
        return td;
      };
      var hd = function (short, full) { return h('th', { scope: 'col', class: 'bm-cm-h' }, [h('span', { 'aria-hidden': 'true', text: short }), h('span', { class: 'sr-only', text: full })]); };
      var rh = function (short, full) { return h('th', { scope: 'row', class: 'bm-cm-r' }, [h('span', { 'aria-hidden': 'true', text: short }), h('span', { class: 'sr-only', text: full })]); };
      var table = h('table', { class: 'bm-cm-grid' }, [
        h('caption', { class: 'sr-only', text: name + ': audit judgments against the human label, ' + per + ' outcomes' }),
        h('thead', {}, [h('tr', {}, [h('td', { class: 'bm-cm-h' }), hd('flag', 'Auditor flag'), hd('pass', 'Auditor pass')])]),
        h('tbody', {}, [
          h('tr', {}, [rh('invalid', 'Human invalid'), cell('tp'), cell('fn')]),
          h('tr', {}, [rh('valid', 'Human valid'), cell('fp'), cell('tn')])
        ])
      ]);
      el.appendChild(h('div', { class: 'bm-cm' }, [
        h('span', { class: 'bm-cm-t', 'aria-hidden': 'true', html: esc(o[0]) + ' <span>·</span> ' + esc(o[1]) }),
        table,
        h('div', { class: 'bm-cm-pr', html: 'Precision <b>' + r.precision.toFixed(1) + '%</b> · Recall <b>' + r.recall.toFixed(1) + '%</b>' })
      ]));
    });
  }

  /* ================================================================== 5. reviewed papers -> the papers section */
  function paperLinks() {
    if (!RB || !RB.emit || !document.getElementById('papers')) return;
    var ids = ((D.papers && D.papers.list) || []).map(function (p) { return p.id; });
    [].forEach.call(root.querySelectorAll('.bm-hp-btn[data-paper]'), function (b) {
      var id = Number(b.getAttribute('data-paper'));
      if (ids.indexOf(id) < 0) return;
      b.disabled = false;
      b.title = 'Show this paper in the papers section';
      b.addEventListener('click', function () { RB.emit('paper:select', id); });
    });
  }

  [funnel, verification, explainer, matrices, paperLinks].forEach(function (fn) {
    try { fn(); } catch (e) { if (window.console && console.error) console.error('benchmark:', e); }
  });
})();
