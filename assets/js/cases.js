/* Section 05 · Cases (#cases). The static partial carries every number; this script adds:
 *   1. the recoveries/reversals diverging bars (RB_DATA.transitions) with a table view,
 *   2. the two reconstruction dumbbells (RB_DATA.diagnostics),
 *   3. the case gallery: filter chips, card entrance, More/Less disclosure, paper-level context
 *      (RB_DATA.papers.list, first evaluation) and links into the story and papers sections,
 *   4. tooltips and arrow-key focus on the attribution rows, and jumps from the reversal list to the cards.
 * Reads window.RB_DATA / RBCharts / RB, defines no globals, and does nothing if #cases is missing. */
(function () {
  'use strict';
  var sec = document.getElementById('cases');
  if (!sec) return;
  var C = window.RBCharts, RB = window.RB, D = window.RB_DATA || {};
  if (!C || !RB) return;
  var svg = C.svg, h = C.h, fmt = C.fmt;
  var MODELS = (D.models || []).map(function (m) { return m.key; });
  if (!MODELS.length) MODELS = ['s46', 's5', 'o5', 'g38'];
  var EASE = 'cubic-bezier(.16,1,.3,1)';

  function byModel(arr) { var o = {}; (arr || []).forEach(function (r) { o[r.model] = r; }); return o; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  /* tooltip HTML: kicker, value rows (value leads), optional note */
  function tipHtml(kicker, rows, sub) {
    return '<div class="tt">' + esc(kicker) + '</div>' +
      rows.map(function (r) { return '<div class="row"><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>'; }).join('') +
      (sub ? '<div class="sub">' + esc(sub) + '</div>' : '');
  }
  /* one tab stop per chart: arrows / Home / End move focus; focus and hover show the same tooltip */
  function rove(items, html) {
    items.forEach(function (el, i) {
      el.setAttribute('tabindex', i === 0 ? '0' : '-1');
      el.addEventListener('keydown', function (e) {
        var k = e.key, j = -1;
        if (k === 'ArrowDown' || k === 'ArrowRight') j = Math.min(items.length - 1, i + 1);
        else if (k === 'ArrowUp' || k === 'ArrowLeft') j = Math.max(0, i - 1);
        else if (k === 'Home') j = 0;
        else if (k === 'End') j = items.length - 1;
        if (j < 0) return;
        e.preventDefault();
        items.forEach(function (n, m) { n.setAttribute('tabindex', m === j ? '0' : '-1'); });
        items[j].focus();
      });
      el.addEventListener('focus', function () { C.tip.showFor(el, html(i)); });
      el.addEventListener('blur', C.tip.hide);
      el.addEventListener('pointermove', function (e) { C.tip.show(html(i), e.clientX, e.clientY); });
      el.addEventListener('pointerleave', C.tip.hide);
    });
  }
  /* a horizontal bar with a 4px rounded data end and a square baseline end */
  function barPath(xa, xb, y, hh, r, roundLeft) {
    var w = Math.max(0, xb - xa); r = Math.min(r, w, hh / 2);
    if (roundLeft) return 'M' + xb + ',' + y + 'H' + (xa + r) + 'Q' + xa + ',' + y + ' ' + xa + ',' + (y + r) + 'V' + (y + hh - r) +
      'Q' + xa + ',' + (y + hh) + ' ' + (xa + r) + ',' + (y + hh) + 'H' + xb + 'Z';
    return 'M' + xa + ',' + y + 'H' + (xb - r) + 'Q' + xb + ',' + y + ' ' + xb + ',' + (y + r) + 'V' + (y + hh - r) +
      'Q' + xb + ',' + (y + hh) + ' ' + (xb - r) + ',' + (y + hh) + 'H' + xa + 'Z';
  }
  function table(caption, head, rows, numFrom) {
    var t = h('table', { class: 'tbl' }, [
      caption ? h('caption', { text: caption }) : null,
      h('thead', null, [h('tr', null, head.map(function (c, i) { return h('th', { class: i >= numFrom ? 'n' : null, text: c }); }))]),
      h('tbody', null, rows.map(function (r) {
        return h('tr', { class: r.hl ? 'hl' : null }, r.cells.map(function (c, i) { return h('td', { class: i >= numFrom ? 'n' : null, text: c }); }));
      }))
    ]);
    return h('details', { class: 'cs-tbl' }, [h('summary', { text: 'Table view' }), h('div', { class: 'tbl-scroll' }, [t])]);
  }

  /* ================================================================ 1. recoveries and reversals */
  function transitions() {
    var el = document.getElementById('cases-trans');
    if (!el) return;
    var T = byModel(D.transitions);
    var rows = MODELS.map(function (k) { return { m: C.model(k), t: T[k] }; }).filter(function (r) { return r.t; });
    if (!rows.length) return;
    var tot = T.total;
    function rowLabel(r) {
      return r.m.name + ': ' + r.t.recoveries + ' recoveries, ' + r.t.reversals + ' reversals, net +' + r.t.net +
        '; successful tasks ' + fmt.num(r.t.raw) + ' with Raw and ' + fmt.num(r.t.rra) + ' with RRA, of 1,029';
    }
    function tip(i) {
      var r = rows[i];
      return tipHtml(r.m.name + ' · Eval 1', [['Recoveries', fmt.num(r.t.recoveries)], ['Reversals', fmt.num(r.t.reversals)], ['Net', '+' + fmt.num(r.t.net)]],
        'Successful tasks ' + fmt.num(r.t.raw) + ' → ' + fmt.num(r.t.rra) + ' of 1,029');
    }
    function render() {
      var W = Math.max(280, Math.round(el.clientWidth)), narrow = W < 560;
      var labelW = narrow ? 74 : 124, netW = narrow ? 40 : 76;
      var headH = 26, rowH = narrow ? 42 : 46, barH = narrow ? 16 : 20, axisH = 30;
      var H = headH + rows.length * rowH + axisH;
      var maxRev = Math.max.apply(null, rows.map(function (r) { return r.t.reversals; }));
      var maxRec = Math.max.apply(null, rows.map(function (r) { return r.t.recoveries; }));
      var lo = -Math.ceil(maxRev / 10) * 10, hi = Math.ceil(maxRec / 20) * 20;
      var padL = narrow ? 30 : 40, padR = narrow ? 34 : 44;
      var x = C.linear(lo, hi, labelW + 10 + padL, W - netW - 10 - padR);
      var xz = x(0), yb = headH + rows.length * rowH;
      el.textContent = '';
      var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'group',
        'aria-label': 'Recoveries and reversals by Reproducer, first evaluation. ' + rows.map(rowLabel).join('. ') + '.' }, el);
      /* column heads double as the legend */
      svg('text', { class: 'cs-colh', x: xz - 8, y: 12, 'text-anchor': 'end', text: narrow ? '← Rev.' : '← Reversals' }, s);
      svg('text', { class: 'cs-colh', x: xz + 8, y: 12, text: 'Recoveries →' }, s);
      svg('text', { class: 'cs-colh', x: W - 4, y: 12, 'text-anchor': 'end', text: 'Net' }, s);
      var grid = svg('g', { class: 'grid', 'aria-hidden': 'true' }, s);
      x.ticks(narrow ? 3 : 4).forEach(function (t) {
        if (t <= 0 || t > hi) return;
        svg('line', { x1: x(t), x2: x(t), y1: headH, y2: yb }, grid);
      });
      var ticks = svg('g', { class: 'tick', 'aria-hidden': 'true' }, s);
      x.ticks(narrow ? 3 : 4).forEach(function (t) {
        if (t < 0 || t > hi) return;
        svg('text', { x: x(t), y: yb + 19, 'text-anchor': 'middle', text: fmt.num(Math.abs(t) < 1e-9 ? 0 : t) }, ticks);
      });
      var items = rows.map(function (r, i) {
        var y = headH + i * rowH, cy = y + rowH / 2, by = cy - barH / 2;
        var g = svg('g', { class: 'cs-row', role: 'img', 'aria-label': rowLabel(r) }, s);
        svg('rect', { class: 'cs-bg', x: 0, y: y + 3, width: W, height: rowH - 6, rx: 10 }, g);
        svg('rect', { class: 'cs-fr', x: 1, y: y + 3, width: W - 2, height: rowH - 6, rx: 10 }, g);
        svg('text', { class: 'lbl', x: labelW, y: cy, dy: '.35em', 'text-anchor': 'end', text: narrow ? r.m.short : r.m.name }, g);
        var xr = x(-r.t.reversals), xc = x(r.t.recoveries);
        svg('path', { class: 'cs-bar-rev', d: barPath(xr, xz - 1, by, barH, 4, true) }, g);
        svg('path', { class: 'cs-bar-rec', d: barPath(xz + 1, xc, by, barH, 4, false) }, g);
        svg('text', { class: 'cs-vrev', x: xr - 6, y: cy, dy: '.35em', 'text-anchor': 'end', text: '−' + r.t.reversals }, g);
        svg('text', { class: 'cs-vrec', x: xc + 7, y: cy, dy: '.35em', text: fmt.num(r.t.recoveries) }, g);
        svg('text', { class: 'cs-net', x: W - 4, y: cy, dy: '.35em', 'text-anchor': 'end', text: '+' + r.t.net }, g);
        return g;
      });
      svg('line', { class: 'cs-zero', x1: xz, x2: xz, y1: headH - 4, y2: yb + 4, 'aria-hidden': 'true' }, s);
      rove(items, tip);
    }
    /* totals and the table view do not depend on width: build them once, right away (no layout shift later) */
    if (tot) {
      el.insertAdjacentElement('afterend', h('p', { class: 'cs-total', 'data-js-only': '' }, [
        h('span', { class: 'k', text: 'All four' }),
        h('span', null, [h('b', { text: fmt.num(tot.recoveries) }), ' recoveries']),
        h('span', null, [h('b', { text: fmt.num(tot.reversals) }), ' reversals']),
        h('span', null, ['net ', h('b', { text: '+' + fmt.num(tot.net) })])
      ]));
    }
    var trows = rows.map(function (r) {
      return { cells: [r.m.name, fmt.num(r.t.raw), fmt.num(r.t.rra), fmt.num(r.t.recoveries), fmt.num(r.t.reversals), fmt.num(r.t.net)] };
    });
    if (tot) trows.push({ hl: true, cells: ['Total', fmt.num(tot.raw), fmt.num(tot.rra), fmt.num(tot.recoveries), fmt.num(tot.reversals), fmt.num(tot.net)] });
    var tv = table('First-evaluation success counts and transitions, 1,029 tasks per model.', ['Model', 'Raw', 'RRA', 'Recoveries', 'Reversals', 'Net'], trows, 1);
    tv.setAttribute('data-js-only', '');
    var after = sec.querySelector('.cs-trans .cs-total') || el;
    after.insertAdjacentElement('afterend', tv);
    RB.whenNear(el, function () { render(); C.onResize(el, render); });
  }

  /* ================================================================ 2. reconstruction dumbbells */
  function dumbbell(el, rows, o) {
    if (!el || !rows.length) return;
    function render() {
      var W = Math.max(260, Math.round(el.clientWidth)), narrow = W < 440;
      var labelW = narrow ? 76 : 112, rowH = 40, top = 4, axisH = 30;
      var H = top + rows.length * rowH + axisH, yb = top + rows.length * rowH;
      var x = C.linear(o.lo, o.hi, labelW + 16, W - (narrow ? 38 : 44));
      el.textContent = '';
      var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'group', 'aria-label': o.label(rows) }, el);
      var grid = svg('g', { class: 'grid', 'aria-hidden': 'true' }, s), ticks = svg('g', { class: 'tick', 'aria-hidden': 'true' }, s);
      o.ticks.forEach(function (t) {
        svg('line', { x1: x(t), x2: x(t), y1: top, y2: yb }, grid);
        svg('text', { x: x(t), y: yb + 19, 'text-anchor': 'middle', text: String(t) }, ticks);
      });
      svg('text', { class: 'cs-unit', x: labelW, y: yb + 19, 'text-anchor': 'end', text: o.unit, 'aria-hidden': 'true' }, s);
      var items = rows.map(function (r, i) {
        var y = top + i * rowH, cy = y + rowH / 2, xr = x(r.raw), xg = x(r.rra);
        var g = svg('g', { class: 'cs-row', role: 'img', 'aria-label': r.aria }, s);
        svg('rect', { class: 'cs-bg', x: 0, y: y + 3, width: W, height: rowH - 6, rx: 10 }, g);
        svg('rect', { class: 'cs-fr', x: 1, y: y + 3, width: W - 2, height: rowH - 6, rx: 10 }, g);
        svg('text', { class: 'lbl', x: labelW, y: cy, dy: '.35em', 'text-anchor': 'end', text: narrow ? r.short : r.name }, g);
        svg('line', { class: 'cs-link-l', x1: Math.min(xr, xg) + 6, x2: Math.max(xr, xg) - 6, y1: cy, y2: cy }, g);
        svg('circle', { class: 'cs-mk-raw', cx: xr, cy: cy, r: 5.5 }, g);
        svg('circle', { class: 'cs-mk-rra', cx: xg, cy: cy, r: 6 }, g);
        var rawRight = xr >= xg;
        svg('text', { class: 'cs-v raw', x: rawRight ? xr + 11 : xr - 11, y: cy, dy: '.35em', 'text-anchor': rawRight ? 'start' : 'end', text: r.rawS }, g);
        svg('text', { class: 'cs-v rra', x: rawRight ? xg - 11 : xg + 11, y: cy, dy: '.35em', 'text-anchor': rawRight ? 'end' : 'start', text: r.rraS }, g);
        return g;
      });
      rove(items, function (i) { return rows[i].tip; });
    }
    RB.whenNear(el, function () { render(); C.onResize(el, render); });
  }
  function diagnostics() {
    var G = byModel(D.diagnostics);
    var ms = MODELS.filter(function (k) { return G[k]; });
    if (!ms.length) return;
    var time = ms.map(function (k) {
      var g = G[k], m = C.model(k), a = fmt.fix(g.first_exec_min_raw, 1), b = fmt.fix(g.first_exec_min_rra, 1);
      return { name: m.name, short: m.short, raw: g.first_exec_min_raw, rra: g.first_exec_min_rra, rawS: a, rraS: b,
        aria: m.name + ': ' + a + ' minutes with Raw, ' + b + ' with RRA',
        tip: tipHtml(m.name + ' · median', [['Raw', a + ' min'], ['RRA', b + ' min']],
          'Paper table: ' + fmt.fix(g.first_exec_h_raw, 2) + ' h → ' + fmt.fix(g.first_exec_h_rra, 2) + ' h. Time to first scored execution, not end-to-end runtime.') };
    });
    var patch = ms.map(function (k) {
      var g = G[k], m = C.model(k);
      return { name: m.name, short: m.short, raw: g.patch_papers_raw, rra: g.patch_papers_rra, rawS: String(g.patch_papers_raw), rraS: String(g.patch_papers_rra),
        aria: m.name + ': ' + g.patch_papers_raw + ' of 36 papers with Raw, ' + g.patch_papers_rra + ' with RRA',
        tip: tipHtml(m.name, [['Raw', g.patch_papers_raw + ' of 36'], ['RRA', g.patch_papers_rra + ' of 36']],
          'Papers with a Reproducer code diff; not independent defects.') };
    });
    dumbbell(document.getElementById('cases-time'), time, {
      lo: 0, hi: 60, ticks: [0, 15, 30, 45, 60], unit: 'minutes',
      label: function (r) { return 'Median minutes to first scored execution, Raw then RRA. ' + r.map(function (x) { return x.aria; }).join('. ') + '.'; }
    });
    dumbbell(document.getElementById('cases-patch'), patch, {
      lo: 0, hi: 36, ticks: [0, 12, 24, 36], unit: 'papers',
      label: function (r) { return 'Papers with a Reproducer code diff, out of 36, Raw then RRA. ' + r.map(function (x) { return x.aria; }).join('. ') + '.'; }
    });
    var tEl = document.getElementById('cases-time'), pEl = document.getElementById('cases-patch');
    if (tEl) tEl.insertAdjacentElement('afterend', withJsOnly(table(null, ['Model', 'Raw (min)', 'RRA (min)'],
      time.map(function (r) { return { cells: [r.name, r.rawS, r.rraS] }; }), 1)));
    if (pEl) pEl.insertAdjacentElement('afterend', withJsOnly(table(null, ['Model', 'Raw', 'RRA'],
      patch.map(function (r) { return { cells: [r.name, r.rawS, r.rraS] }; }), 1)));
  }
  function withJsOnly(n) { n.setAttribute('data-js-only', ''); return n; }

  /* ================================================================ 3. the case gallery */
  var gallery = (function () {
    var gal = sec.querySelector('.cs-gallery');
    if (!gal) return null;
    var grid = gal.querySelector('.cs-grid'), chipsBox = gal.querySelector('.cs-chips'), status = document.getElementById('cases-status');
    if (!grid) return null;
    var cards = [].slice.call(grid.querySelectorAll('.cs-card'));
    var FILTERS = [
      { key: 'all', label: 'All' }, { key: 'measurement', label: 'Measurement' }, { key: 'config', label: 'Configuration' },
      { key: 'env', label: 'Environment' }, { key: 'code', label: 'Code' }, { key: 'flag', label: 'Flagged discrepancy' },
      { key: 'fail', label: 'When it fails' }
    ];
    var current = 'all', busy = 0;
    function match(card, key) { return key === 'all' || card.getAttribute('data-cat') === key; }
    cards.forEach(function (c, k) { c.style.setProperty('--i', k); });

    /* chips (counts come from the cards themselves) */
    if (chipsBox) {
      FILTERS.forEach(function (f) {
        var n = cards.filter(function (c) { return match(c, f.key); }).length;
        if (!n) return;
        f.btn = h('button', { class: 'chip', type: 'button', 'aria-pressed': String(f.key === 'all') },
          [f.label, h('span', { class: 'n', 'aria-hidden': 'true', text: String(n) })]);
        f.btn.setAttribute('aria-label', f.label + ', ' + n + (n === 1 ? ' case' : ' cases'));
        f.btn.addEventListener('click', function () { apply(f.key); });
        chipsBox.appendChild(f.btn);
      });
    }
    function say() {
      if (!status) return;
      var n = cards.filter(function (c) { return !c.hidden; }).length;
      var f = FILTERS.filter(function (x) { return x.key === current; })[0];
      status.textContent = current === 'all' ? 'Showing all ' + n + ' cases.' : 'Showing ' + n + ' of ' + cards.length + ' cases: ' + f.label + '.';
    }
    /* filtering: fade the leavers, then FLIP the stayers into their new cells and fade the newcomers in */
    function apply(key, instant) {
      if (key === current) return;
      current = key;
      FILTERS.forEach(function (f) { if (f.btn) f.btn.setAttribute('aria-pressed', String(f.key === key)); });
      [grid].concat(cards).forEach(function (n) { if (n.getAnimations) n.getAnimations().forEach(function (a) { a.cancel(); }); });
      var anim = !instant && !RB.reduced() && typeof grid.animate === 'function';
      var leaving = cards.filter(function (c) { return !c.hidden && !match(c, key); });
      clearTimeout(busy);
      function swap() {
        var first = cards.map(function (c) { return c.hidden ? null : c.getBoundingClientRect(); });
        var h0 = grid.offsetHeight;
        cards.forEach(function (c) { c.hidden = !match(c, key); });
        say();
        layoutRows();
        if (!anim) return;
        var h1 = grid.offsetHeight;
        if (h0 !== h1) grid.animate([{ height: h0 + 'px' }, { height: h1 + 'px' }], { duration: 520, easing: EASE });
        var n = 0;
        cards.forEach(function (c, k) {
          if (c.hidden) return;
          var r = c.getBoundingClientRect(), f = first[k];
          if (f) {
            var dx = f.left - r.left, dy = f.top - r.top;
            if (dx || dy) c.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }], { duration: 520, easing: EASE });
          } else {
            c.animate([{ opacity: 0, transform: 'translateY(10px) scale(.98)' }, { opacity: 1, transform: 'none' }],
              { duration: 480, delay: 50 + n++ * 45, easing: EASE, fill: 'backwards' });
          }
        });
      }
      if (anim && leaving.length) {
        leaving.forEach(function (c) { c.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.98)' }], { duration: 160, easing: 'ease-in', fill: 'forwards' }); });
        busy = setTimeout(function () { leaving.forEach(function (c) { if (c.getAnimations) c.getAnimations().forEach(function (a) { a.cancel(); }); }); swap(); }, 160);
      } else swap();
    }

    /* More / Less: the paper's full paragraph, the paper-level counts and onward links */
    function setOpen(card, on, instant) {
      var btn = card.querySelector('.cs-more'), full = card.querySelector('.cs-full');
      if (!btn || !full || !!card._open === on) return;
      card._open = on;
      btn.setAttribute('aria-expanded', String(on));
      var t = btn.querySelector('.cs-more-t');
      if (t) t.textContent = on ? 'Less' : 'More';
      if (full.getAnimations) full.getAnimations().forEach(function (a) { a.cancel(); });
      var anim = !instant && !RB.reduced() && typeof full.animate === 'function';
      if (on) {
        card.classList.add('open');
        layoutRows();
        if (anim) {
          var hh = full.scrollHeight;
          full.animate([{ height: '0px', opacity: 0 }, { height: hh + 'px', opacity: 1 }], { duration: 420, easing: EASE });
        }
      } else if (anim) {
        var h0 = full.scrollHeight;
        full.animate([{ height: h0 + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 260, easing: 'cubic-bezier(.4,0,.2,1)' })
          .onfinish = function () { if (!card._open) { card.classList.remove('open'); layoutRows(); } };
      } else { card.classList.remove('open'); layoutRows(); }
    }
    /* a row that holds an open card: its closed neighbours keep their own (equalized) height instead of
       stretching to the open card, so they never show an empty band in the middle */
    function layoutRows() {
      cards.forEach(function (c) { c.classList.remove('cs-short'); c.style.minHeight = ''; });
      if (!cards.some(function (c) { return c._open && !c.hidden; })) return;
      var rows = {};
      cards.forEach(function (c) { if (!c.hidden) (rows[c.offsetTop] = rows[c.offsetTop] || []).push(c); });
      Object.keys(rows).forEach(function (k) {
        var r = rows[k], closed = r.filter(function (c) { return !c._open; });
        if (r.length < 2 || closed.length === r.length || !closed.length) return;
        closed.forEach(function (c) { c.classList.add('cs-short'); });
        var mh = Math.max.apply(null, closed.map(function (c) { return c.offsetHeight; }));
        closed.forEach(function (c) { c.style.minHeight = mh + 'px'; });
      });
    }
    C.onResize(grid, layoutRows);
    cards.forEach(function (card) {
      var btn = card.querySelector('.cs-more');
      if (btn) btn.addEventListener('click', function () { setOpen(card, !card._open); });
    });

    /* paper-level context from the inventory (first evaluation, Codex scoring), shown inside the disclosure */
    var P = {};
    ((D.papers && D.papers.list) || []).forEach(function (p) { P[p.id] = p; });
    var hasPapers = !!document.getElementById('papers');
    cards.forEach(function (card) {
      var p = P[+card.getAttribute('data-paper')], box = card.querySelector('.cs-full-in');
      if (!p || !box || !p.raw || !p.rra) return;
      var focus = card.getAttribute('data-model');
      var kids = [
        h('span', { class: 'kicker', text: 'Whole paper · successful tasks of ' + p.tasks + ' · Eval 1 · Codex' }),
        h('p', { class: 'cs-ctx-t', text: p.title + (p.first_author ? ' · ' + p.first_author + ' et al.' : '') }),
        h('ul', { class: 'cs-ctx-m', 'aria-label': 'Successful tasks with Raw and RRA, by model' }, MODELS.map(function (k, i) {
          var m = C.model(k);
          var li = h('li', { class: k === focus ? 'on' : null }, [h('span', { text: m.short }),
            h('b', null, [String(p.raw[i]), h('i', { 'aria-hidden': 'true', text: '→' }), h('span', { class: 'sr-only', text: ' to ' }), String(p.rra[i])])]);
          if (k === focus) li.setAttribute('aria-current', 'true');
          return li;
        }))
      ];
      if (hasPapers) {
        var go = h('a', { class: 'cs-go', href: '#papers', text: 'See this paper in the paper-by-paper view ↑' });
        go.addEventListener('click', function () { RB.emit('paper:select', p.id); });
        kids.push(h('p', { class: 'cs-ctx-go' }, [go]));
      }
      box.appendChild(h('div', { class: 'cs-ctx' }, kids));
    });
    /* links into other sections only when those sections are on the page */
    gal.querySelectorAll('[data-needs]').forEach(function (a) {
      if (!document.getElementById(a.getAttribute('data-needs'))) a.remove();
    });

    /* entrance: the grid fades up once; each card plays its Raw → RRA strip when it is well inside the viewport */
    function seeAll() { cards.forEach(function (c) { c.classList.add('seen'); }); }
    if (RB.reduced() || !('IntersectionObserver' in window)) {
      grid.classList.add('is-in', 'settled'); seeAll();
    } else {
      var gio = new IntersectionObserver(function (es) {
        if (!es.some(function (e) { return e.isIntersecting; })) return;
        gio.disconnect();
        grid.classList.add('is-in');
        setTimeout(function () { grid.classList.add('settled'); }, 1600);
      }, { rootMargin: '0px 0px -10% 0px' });
      gio.observe(grid);
      var cio = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('seen'); cio.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -18% 0px', threshold: 0.25 });
      cards.forEach(function (c) { cio.observe(c); });
    }
    window.addEventListener('beforeprint', function () { grid.classList.add('is-in', 'settled'); seeAll(); });

    /* open a card from elsewhere (reversal list, #case-… links) */
    function show(id, focusIt) {
      var card = document.getElementById(id);
      if (!card || cards.indexOf(card) < 0) return;
      if (card.hidden) apply('all', true);
      grid.classList.add('is-in', 'settled');
      card.classList.add('seen');
      setOpen(card, true, true);
      card.scrollIntoView({ behavior: RB.reduced() ? 'auto' : 'smooth', block: 'start' });
      card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash');
      if (focusIt) {
        var b = card.querySelector('.cs-more');
        if (b) setTimeout(function () { b.focus({ preventScroll: true }); }, RB.reduced() ? 0 : 520);
      }
    }
    if (/^#case-[a-z0-9-]+$/.test(location.hash)) show(location.hash.slice(1), false);
    window.addEventListener('hashchange', function () { if (/^#case-[a-z0-9-]+$/.test(location.hash)) show(location.hash.slice(1), false); });
    return { show: show };
  })();

  /* ================================================================ 4. attribution rows + reversal jumps */
  function attribution() {
    var list = sec.querySelector('.cs-at');
    if (!list) return;
    var rowsEl = [].slice.call(list.querySelectorAll('.cs-at-r'));
    var A = {};
    (D.attribution || []).forEach(function (a) { A[a.label] = a; });
    var info = rowsEl.map(function (li) {
      var label = (li.querySelector('.cs-at-l') || {}).textContent || '';
      var def = (li.querySelector('.cs-at-d') || {}).textContent || '';
      var a = A[label] || {};
      li.setAttribute('aria-label', label + ': ' + fmt.fix(a.share, 1) + '% of the case review, about ' + a.est + ' of 813 recoveries. ' + def + '.');
      return { label: label, def: def, a: a };
    });
    rove(rowsEl, function (i) {
      var r = info[i];
      return tipHtml(r.label + ' · case review', [['Share', fmt.fix(r.a.share, 1) + '%'], ['Est. outcomes', r.a.est + ' of 813']],
        r.def.charAt(0).toUpperCase() + r.def.slice(1) + '.');
    });
    if (RB.reduced() || !('IntersectionObserver' in window)) list.classList.add('in');
    else {
      var io = new IntersectionObserver(function (es) {
        if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); list.classList.add('in'); }
      }, { rootMargin: '0px 0px -12% 0px' });
      io.observe(list);
    }
  }
  function jumps() {
    sec.querySelectorAll('.cs-jump[data-case]').forEach(function (b) {
      if (!gallery) { b.remove(); return; }
      b.addEventListener('click', function () { gallery.show(b.getAttribute('data-case'), true); });
    });
  }

  transitions();
  diagnostics();
  attribution();
  jumps();
})();
