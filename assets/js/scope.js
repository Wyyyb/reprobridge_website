/* Scope (#scope): two small views of the separate paper–code alignment analysis, both from RB_DATA.alignment.
 *   #scope-split  the 293 recorded findings: 238 in scope for contradiction analysis, 44 absent-implementation
 *                 and 11 paper-silent records (a partition; appendix "Separate alignment analysis").
 *   #scope-cats   in-scope contradiction findings by recorded category (bars), with the papers and distinct tasks each
 *                 category touches as plain numbers. Papers and tasks overlap between rows, so nothing is summed.
 * Colours come from CSS classes (scope.css), so theme switches need no re-render. */
(function () {
  'use strict';
  var sec = document.getElementById('scope');
  var D = window.RB_DATA, C = window.RBCharts, RB = window.RB;
  if (!sec || !D || !D.alignment || !C) return;
  var A = D.alignment;
  var fmt = C.fmt;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function reduced() { return RB && RB.reduced ? RB.reduced() : false; }

  /* ---------------------------------------------------------------- findings split (HTML) */
  (function () {
    var el = document.getElementById('scope-split');
    if (!el || !(A.findings > 0)) return;
    var parts = [
      { cls: 's-in', n: A.in_scope, label: 'in scope', tip: 'In scope for contradiction analysis',
        def: 'An explicit paper statement and conflicting implemented behavior.' },
      { cls: 's-absent', n: A.absent_implementation, label: 'absent implementation', tip: 'Absent implementation',
        def: 'No implementation occupies the role. Recorded separately.' },
      { cls: 's-silent', n: A.paper_silent, label: 'paper silent', tip: 'Paper silent',
        def: 'The paper specifies no relevant choice. Recorded separately.' }
    ];
    var head = C.h('div', { class: 'sc-split-head' }, [
      C.h('span', { class: 'kicker', html: 'Recorded findings · <b>' + fmt.num(A.findings) + '</b>' })
    ]);
    var bar = C.h('div', {
      class: 'sc-split-bar', role: 'img',
      'aria-label': fmt.num(A.findings) + ' recorded findings: ' + parts.map(function (p) { return fmt.num(p.n) + ' ' + p.label; }).join(', ') + '.'
    });
    parts.forEach(function (p) {
      var s = C.h('span', { class: p.cls, style: { 'flex-grow': String(p.n) } });
      C.bindTip(s, '<div class="tt">' + esc(p.tip) + '</div><div class="row"><span>Records</span><b>' + fmt.num(p.n) +
        '</b></div><div class="sub">' + esc(p.def) + '</div>');
      bar.appendChild(s);
    });
    var legend = C.h('ul', { class: 'sc-split-legend', 'aria-hidden': 'true' }, parts.map(function (p) {
      return C.h('li', null, [C.h('span', { class: 'sw ' + p.cls }), C.h('b', { text: fmt.num(p.n) }), ' ' + p.label]);
    }));
    el.appendChild(head); el.appendChild(bar); el.appendChild(legend);
  })();

  /* ---------------------------------------------------------------- category bar table (SVG) */
  var host = document.getElementById('scope-cats');
  var cats = (A.categories || []).slice();          /* the paper's table order */
  if (!host || !cats.length) return;

  var maxF = Math.max.apply(null, cats.map(function (c) { return c.findings; }));
  var current = 0;        /* row holding the roving tabindex */
  var grown = reduced();  /* bars animate once, the first time the chart is seen */
  var svgEl = null;

  function tipHtml(c) {
    return '<div class="tt">' + esc(c.label) + '</div>' +
      '<div class="row"><span>Findings</span><b>' + fmt.num(c.findings) + '</b></div>' +
      '<div class="row"><span>Papers</span><b>' + fmt.num(c.papers) + '</b></div>' +
      '<div class="row"><span>Distinct tasks</span><b>' + fmt.num(c.tasks) + '</b></div>' +
      '<div class="sub">Papers and tasks overlap across categories; do not sum.</div>';
  }
  function ariaFor(c) {
    return c.label + ': ' + c.findings + ' findings, ' + c.papers + (c.papers === 1 ? ' paper, ' : ' papers, ') +
      c.tasks + ' distinct tasks';
  }
  /* bar with a 4px rounded data end, square at the baseline */
  function barPath(x, y, w, h) {
    var r = Math.min(4, h / 2, w);
    if (w <= 0) return 'M' + x + ',' + y + 'h0v' + h + 'h0z';
    return 'M' + x + ',' + y + 'h' + (w - r) + 'a' + r + ',' + r + ' 0 0 1 ' + r + ',' + r +
      'v' + (h - 2 * r) + 'a' + r + ',' + r + ' 0 0 1 ' + (-r) + ',' + r + 'h' + (-(w - r)) + 'z';
  }
  function measure(svg, cls, strings) {
    var t = C.svg('text', { class: cls, x: -9999, y: -9999 }, svg), m = 0;
    strings.forEach(function (s) { t.textContent = s; m = Math.max(m, t.getComputedTextLength()); });
    svg.removeChild(t);
    return Math.ceil(m);
  }

  function render() {
    var W = Math.floor(host.clientWidth);
    if (W < 120) return;
    var hadFocus = host.contains(document.activeElement);
    if (hadFocus) C.tip.hide();
    host.innerHTML = '';
    var svg = svgEl = C.svg('svg', {
      width: W, height: 10, viewBox: '0 0 ' + W + ' 10', role: 'group',
      'aria-label': 'In-scope paper–code contradiction findings by recorded category. Use the arrow keys to move between categories.'
    }, host);
    var labelW = measure(svg, 'sc-lbl', cats.map(function (c) { return c.label; }));
    var valW = measure(svg, 'sc-val', [String(maxF)]);
    var hdTasks = measure(svg, 'sc-colh', ['Distinct tasks']), hdPapers = measure(svg, 'sc-colh', ['Papers']);
    var gap = 22;
    /* the table layout needs the label column, a usable bar run (>= 200px), the value and two number columns */
    var wide = W >= labelW + 18 + 200 + valW + 12 + hdPapers + gap + hdTasks + gap + 2;
    var rows = [], H;

    if (wide) {
      var headH = 30, rowH = 34, barH = 14;
      var xTasks = W - 2, xPapers = xTasks - hdTasks - gap;
      var x0 = labelW + 18, barMax = Math.max(60, xPapers - hdPapers - gap - x0 - valW - 12);
      var xs = C.linear(0, maxF, 0, barMax);
      H = headH + rowH * cats.length + 2;
      var hd = C.svg('g', { 'aria-hidden': 'true' }, svg);
      C.svg('text', { class: 'sc-colh', x: x0, y: 14, text: 'Findings' }, hd);
      C.svg('text', { class: 'sc-colh', x: xPapers, y: 14, 'text-anchor': 'end', text: 'Papers' }, hd);
      C.svg('text', { class: 'sc-colh', x: xTasks, y: 14, 'text-anchor': 'end', text: 'Distinct tasks' }, hd);
      C.svg('line', { class: 'sc-rule', x1: 0, x2: W, y1: headH - 6.5, y2: headH - 6.5 }, hd);
      cats.forEach(function (c, i) {
        var y = headH + i * rowH, cy = y + rowH / 2;
        var g = C.svg('g', { class: 'sc-row' }, svg);
        var vis = C.svg('g', { 'aria-hidden': 'true' }, g);
        C.svg('rect', { class: 'sc-rowbg', x: -8, y: y + 1, width: W + 16, height: rowH - 2, rx: 8 }, vis);
        C.svg('text', { class: 'sc-lbl', x: labelW, y: cy + 4.5, 'text-anchor': 'end', text: c.label }, vis);
        var w = Math.max(2, xs(c.findings));
        C.svg('path', { class: 'sc-bar', d: barPath(x0, cy - barH / 2, w, barH) }, vis);
        C.svg('text', { class: 'sc-val', x: x0 + w + 8, y: cy + 4, text: fmt.num(c.findings) }, vis);
        C.svg('text', { class: 'sc-num', x: xPapers, y: cy + 4.5, 'text-anchor': 'end', text: fmt.num(c.papers) }, vis);
        C.svg('text', { class: 'sc-num', x: xTasks, y: cy + 4.5, 'text-anchor': 'end', text: fmt.num(c.tasks) }, vis);
        if (i < cats.length - 1) C.svg('line', { class: 'sc-rule', x1: 0, x2: W, y1: y + rowH + 0.5, y2: y + rowH + 0.5, opacity: 0.55 }, vis);
        rows.push({ g: g, c: c, box: [-8, y + 1, W + 16, rowH - 2] });
      });
    } else {
      /* narrow: label line (with the papers / tasks note right-aligned where it fits), then a full-width bar.
       * One scale for every row; a note that does not fit beside its label moves to the right end of its bar
       * line (only short bars have long labels here), or to a line of its own as a last resort; notes stay
       * right-aligned in every case. */
      var barH2 = 11, y = 2;
      var barMax2 = Math.max(60, W - valW - 12);
      var xs2 = C.linear(0, maxF, 0, barMax2);
      cats.forEach(function (c) {
        var sub = fmt.num(c.papers) + (c.papers === 1 ? ' paper · ' : ' papers · ') + fmt.num(c.tasks) + ' tasks';
        var lw = measure(svg, 'sc-lbl', [c.label]), sw = measure(svg, 'sc-sub', [sub]);
        var w2 = Math.max(2, xs2(c.findings));
        var place = lw + 16 + sw <= W ? 'label' : (w2 + valW + 22 + sw <= W ? 'bar' : 'own');
        var rowH2 = place === 'own' ? 72 : 54;
        var g = C.svg('g', { class: 'sc-row' }, svg);
        var vis = C.svg('g', { 'aria-hidden': 'true' }, g);
        C.svg('rect', { class: 'sc-rowbg', x: -6, y: y + 1, width: W + 12, height: rowH2 - 4, rx: 8 }, vis);
        C.svg('text', { class: 'sc-lbl', x: 0, y: y + 19, text: c.label }, vis);
        if (place === 'label') C.svg('text', { class: 'sc-sub', x: W, y: y + 18.5, 'text-anchor': 'end', text: sub }, vis);
        if (place === 'own') C.svg('text', { class: 'sc-sub', x: W, y: y + 37, 'text-anchor': 'end', text: sub }, vis);
        var by = y + (place === 'own' ? 47 : 29);
        C.svg('path', { class: 'sc-bar', d: barPath(0, by, w2, barH2) }, vis);
        C.svg('text', { class: 'sc-val', x: w2 + 7, y: by + barH2 - 1.5, text: fmt.num(c.findings) }, vis);
        if (place === 'bar') C.svg('text', { class: 'sc-sub', x: W, y: by + barH2 - 1.5, 'text-anchor': 'end', text: sub }, vis);
        rows.push({ g: g, c: c, box: [-6, y + 1, W + 12, rowH2 - 4] });
        y += rowH2;
      });
      H = y;
    }

    svg.setAttribute('height', H);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

    /* hit targets: one per row, roving tabindex, hover + focus tooltips */
    var hits;
    function setCurrent(n) {
      current = n;
      hits.forEach(function (h, j) { h.setAttribute('tabindex', j === n ? '0' : '-1'); });
    }
    hits = rows.map(function (r, i) {
      var hit = C.svg('rect', {
        class: 'sc-hit', x: r.box[0], y: r.box[1], width: r.box[2], height: r.box[3], rx: 8,
        tabindex: i === current ? 0 : -1, role: 'img', 'aria-label': ariaFor(r.c)
      }, r.g);
      C.svg('rect', { class: 'sc-ring', x: r.box[0] + 1, y: r.box[1] + 1, width: r.box[2] - 2, height: r.box[3] - 2, rx: 7 }, r.g);
      function on() { r.g.classList.add('on'); }
      function off() { r.g.classList.remove('on'); }
      hit.addEventListener('pointerenter', on);
      hit.addEventListener('pointerleave', off);
      hit.addEventListener('focus', function () { on(); if (current !== i) setCurrent(i); });
      hit.addEventListener('blur', off);
      C.bindTip(hit, function () { return tipHtml(r.c); });
      return hit;
    });
    hits.forEach(function (hit, i) {
      hit.addEventListener('keydown', function (e) {
        var k = e.key, n = null;
        if (k === 'ArrowDown' || k === 'ArrowRight') n = Math.min(hits.length - 1, i + 1);
        else if (k === 'ArrowUp' || k === 'ArrowLeft') n = Math.max(0, i - 1);
        else if (k === 'Home') n = 0;
        else if (k === 'End') n = hits.length - 1;
        if (n === null) return;
        e.preventDefault();
        setCurrent(n);
        hits[n].focus();
      });
    });
    if (hadFocus && hits[current]) hits[current].focus();

    if (!grown) svg.classList.add('pre');
  }

  render();
  C.onResize(host, render);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { render(); });

  /* grow the bars once, when the chart is actually on screen */
  if (!grown) {
    var start = function () {
      if (grown) return;
      grown = true;
      if (!svgEl) return;
      svgEl.classList.add('grow');
      /* next frame: drop the collapsed state so the transition runs */
      requestAnimationFrame(function () { requestAnimationFrame(function () { if (svgEl) svgEl.classList.remove('pre'); }); });
    };
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); start(); }
      }, { rootMargin: '0px 0px -12% 0px', threshold: 0.2 });
      io.observe(host);
    } else start();
  }
})();
