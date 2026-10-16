/* Artifact section behaviour.
 *  1. Component tiles -> tabs (role=tab, arrow keys); each panel draws the component-removal dot plot from
 *     RB_DATA.ablation (Sonnet 5, 287 tasks, 12 papers, one evaluation).
 *  2. SCIQL guide viewer: collapsed window + "Expand all twelve sections", outline links, scroll-spy.
 *  3. Construction stepper: role buttons show the role's construction-roles table row (read from the no-JS table
 *     #cs-roles, so both views share one transcription) plus a quoted rule from the appendix role specification.
 * Without JS: panels show as a grid, the guide is fully expanded, and the stepper is replaced by the paper figure
 * and the roles table. */
(function () {
  'use strict';
  var sec = document.getElementById('artifact');
  if (!sec) return;
  var C = window.RBCharts, RB = window.RB, D = window.RB_DATA;
  var reduced = function () { return !!(RB && RB.reduced && RB.reduced()); };

  /* ================================================================ 1. component tabs + ablation dot plot */
  var ABL_KEY = { code: 'Refined codebase', env: 'Environment setup', launch: 'Experiment launchers', guide: 'Reproduction guide' };
  var ABL_SHORT = { 'Refined codebase': 'without code', 'Environment setup': 'without environment', 'Reproduction guide': 'without guide', 'Experiment launchers': 'without launchers' };
  var ABL_NAME = { 'Refined codebase': 'refined codebase', 'Environment setup': 'environment setup', 'Reproduction guide': 'reproduction guide', 'Experiment launchers': 'experiment launchers' };

  function ablRows() {
    var A = D && D.ablation;
    if (!A || !A.rows) return null;
    var by = {};
    A.rows.forEach(function (r) { by[r.label] = r; });
    if (!by['Full RRA'] || !by['Raw code']) return null;
    var rows = [{ key: 'full', label: 'Full RRA', r: by['Full RRA'] }];
    A.rows.forEach(function (r) { if (r.kind === 'removed') rows.push({ key: r.label, label: ABL_SHORT[r.label] || r.label, r: r }); });
    rows.push({ key: 'raw', label: 'Raw code', r: by['Raw code'] });
    return { A: A, rows: rows, full: by['Full RRA'] };
  }

  function drawAbl(el, comp) {
    if (!C || !el) return;
    var M = ablRows();
    if (!M) return;
    var W = el.clientWidth;
    if (!W) return;
    el.innerHTML = '';
    var sel = ABL_KEY[comp];
    var cls = function (row) { return 'abl-row' + (row.key === sel ? ' on' : '') + (row.key === 'full' ? ' full' : '') + (row.key === 'raw' ? ' raw' : ''); };
    var s = C.svg('svg', { 'aria-hidden': 'true', focusable: 'false' }, el);
    /* label column = widest label as it will be drawn */
    var lw = 0;
    M.rows.forEach(function (row) {
      var g = C.svg('g', { class: cls(row) }, s);
      var t = C.svg('text', { class: 'abl-lbl', x: 0, y: -50, text: row.label }, g);
      try { lw = Math.max(lw, t.getComputedTextLength()); } catch (e) { lw = Math.max(lw, row.label.length * 7); }
      s.removeChild(g);
    });
    lw = Math.ceil(lw) + 8;
    var vw = 74, top = 4, axisH = 22;
    /* narrow: each label sits above its track */
    var stacked = W - lw - vw < 140;
    var rowH = stacked ? 38 : 23;
    var x0 = stacked ? 10 : lw + 14, x1 = W - vw - 6;
    var x = C.linear(70, 95, x0, x1);
    var H = top + M.rows.length * rowH + axisH;
    s.setAttribute('viewBox', '0 0 ' + W + ' ' + H); s.setAttribute('width', W); s.setAttribute('height', H);
    [70, 80, 90].forEach(function (t) {
      C.svg('line', { class: 'abl-grid', x1: x(t), x2: x(t), y1: top, y2: top + M.rows.length * rowH }, s);
      C.svg('text', { class: 'abl-tick', x: x(t), y: H - 5, 'text-anchor': 'middle', text: String(t) }, s);
    });
    C.svg('text', { class: 'abl-tick', x: x(95), y: H - 5, 'text-anchor': 'middle', text: '95%' }, s);
    var fx = x(M.full.success);
    C.svg('line', { class: 'abl-grid', x1: fx, x2: fx, y1: top, y2: top + M.rows.length * rowH, style: { stroke: 'var(--rra-2)' } }, s);
    M.rows.forEach(function (row, i) {
      var y0 = top + i * rowH, cy = stacked ? y0 + 27 : y0 + rowH / 2, ly = stacked ? y0 + 13 : cy + 4.2;
      var on = row.key === sel;
      var g = C.svg('g', { class: cls(row) }, s);
      C.svg('rect', { class: 'abl-hl', x: 0, y: y0 + 1, width: W, height: rowH - 2, rx: 6 }, g);
      C.svg('text', { class: 'abl-lbl', x: 8, y: ly, text: row.label }, g);
      C.svg('line', { class: 'abl-track', x1: x0, x2: x1, y1: cy, y2: cy }, g);
      var vx = x(row.r.success);
      if (on) C.svg('line', { class: 'abl-gap', x1: vx + 5, x2: fx - 2, y1: cy, y2: cy }, g);
      C.svg('circle', { class: 'abl-dot', cx: vx, cy: cy, r: on || row.key === 'full' || row.key === 'raw' ? 5.2 : 3.6 }, g);
      C.svg('text', { class: 'abl-val', x: x1 + 12, y: cy + 4, text: C.fmt.fix(row.r.success, 1) }, g);
      if (row.r.loss !== null && row.r.loss !== undefined) {
        C.svg('text', { class: 'abl-loss', x: W - 4, y: cy + 4, 'text-anchor': 'end', text: '−' + C.fmt.fix(row.r.loss, 1) }, g);
      }
    });
    var parts = M.rows.map(function (row) {
      var nm = row.key === 'full' ? 'full refined artifact' : row.key === 'raw' ? 'raw code' : 'without ' + ABL_NAME[row.key];
      return nm + ' ' + C.fmt.fix(row.r.success, 1) + '%' + (row.r.loss ? ' (−' + C.fmt.fix(row.r.loss, 1) + ' pp)' : '');
    });
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', 'Component removals, ' + M.A.model + ', ' + M.A.tasks + ' tasks, ' + M.A.papers + ' papers, one evaluation. Success: ' + parts.join('; ') + '. Highlighted: ' + (ABL_NAME[sel] || '') + '.');
    el.appendChild(C.h('p', { class: 'ap-basis' }, [C.h('span', { class: 'tag-note', text: M.A.model + ' · ' + M.A.tasks + ' tasks · 1 eval' })]));
  }

  function initTabs() {
    var list = sec.querySelector('.art-tiles');
    var wrap = sec.querySelector('.art-panels');
    if (!list || !wrap) return;
    var tiles = [].slice.call(list.querySelectorAll('.art-tile'));
    var panels = tiles.map(function (t) { return document.getElementById((t.getAttribute('href') || '').slice(1)); });
    if (!tiles.length || panels.some(function (p) { return !p; })) return;
    list.setAttribute('role', 'tablist');
    list.setAttribute('aria-orientation', 'horizontal');
    wrap.classList.add('tabs-on');
    var cur = -1;
    /* the panel's caret points at the selected tile */
    function caret() {
      if (cur < 0) return;
      var t = tiles[cur].getBoundingClientRect(), w = wrap.getBoundingClientRect();
      wrap.style.setProperty('--nx', Math.round(t.left + t.width / 2 - w.left) + 'px');
    }
    function select(i, focus) {
      if (i === cur) { if (focus) tiles[i].focus(); return; }
      cur = i;
      tiles.forEach(function (t, j) {
        var on = j === i;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        panels[j].hidden = !on;
      });
      if (focus) tiles[i].focus();
      caret();
      drawAbl(panels[i].querySelector('.ap-chart'), panels[i].getAttribute('data-c'));
    }
    tiles.forEach(function (t, i) {
      var pid = t.getAttribute('href').slice(1);
      t.removeAttribute('href');
      t.setAttribute('role', 'tab');
      t.setAttribute('aria-controls', pid);
      panels[i].setAttribute('role', 'tabpanel');
      panels[i].setAttribute('aria-labelledby', t.id);
      panels[i].tabIndex = 0;
      t.addEventListener('click', function (e) { e.preventDefault(); select(i, false); });
      t.addEventListener('keydown', function (e) {
        var n = tiles.length, k = e.key, j = -1;
        if (k === 'ArrowRight' || k === 'ArrowDown') j = (i + 1) % n;
        else if (k === 'ArrowLeft' || k === 'ArrowUp') j = (i - 1 + n) % n;
        else if (k === 'Home') j = 0;
        else if (k === 'End') j = n - 1;
        else if (k === 'Enter' || k === ' ') { e.preventDefault(); select(i, false); return; }
        if (j < 0) return;
        e.preventDefault();
        select(j, true);
      });
    });
    select(0, false);
    if (C) C.onResize(wrap, function () { caret(); if (cur >= 0) drawAbl(panels[cur].querySelector('.ap-chart'), panels[cur].getAttribute('data-c')); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(caret);
  }

  /* ================================================================ 2. SCIQL guide viewer */
  function initGuide() {
    var win = sec.querySelector('.gd-win');
    var doc = sec.querySelector('.gd-doc');
    var btn = sec.querySelector('.gd-toggle');
    if (!win || !doc || !btn) return;
    var label = btn.querySelector('.gd-toggle-label');
    var secs = [].slice.call(doc.querySelectorAll('.gd-sec'));
    var links = [].slice.call(sec.querySelectorAll('.gd-toc a'));
    var collapsed = function () { return win.classList.contains('is-collapsed'); };
    function atEnd() { win.classList.toggle('at-end', doc.scrollTop + doc.clientHeight >= doc.scrollHeight - 4); }
    /* index of the section at the top of the reading position */
    function current() {
      var cur = 0, i;
      if (collapsed()) {
        for (i = 0; i < secs.length; i++) if (secs[i].offsetTop <= doc.scrollTop + 28) cur = i;
        if (doc.scrollTop + doc.clientHeight >= doc.scrollHeight - 4) cur = secs.length - 1;
        return cur;
      }
      var vh = window.innerHeight, wr = win.getBoundingClientRect();
      if (wr.bottom <= 0 || wr.top >= vh) return -1;
      var line = Math.min(vh * 0.4, wr.bottom - 40);
      for (i = 0; i < secs.length; i++) if (secs[i].getBoundingClientRect().top <= line) cur = i;
      return cur;
    }
    var raf = 0, pin = -1, pinTop = 0, pinUntil = 0;
    function spy() {
      raf = 0;
      var vh = window.innerHeight, wr = win.getBoundingClientRect();
      /* an outline click keeps its section marked until the reader scrolls the file on */
      if (pin >= 0 && Date.now() > pinUntil && Math.abs((collapsed() ? doc.scrollTop : window.pageYOffset) - pinTop) > 60) pin = -1;
      var cur = pin >= 0 ? pin : (wr.bottom > 0 && wr.top < vh) ? current() : -1;
      links.forEach(function (a, i) { a.classList.toggle('on', i === cur); });
    }
    function queue() { if (!raf) raf = requestAnimationFrame(spy); }
    function setOpen(open, keep) {
      var at = keep ? current() : -1;
      win.classList.toggle('is-collapsed', !open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (label) label.textContent = open ? 'Collapse the guide' : 'Expand all twelve sections';
      if (open) { doc.removeAttribute('tabindex'); doc.scrollTop = 0; }
      else {
        doc.tabIndex = 0;
        doc.scrollTop = at > 0 ? secs[at].offsetTop - 4 : 0;
      }
      atEnd();
      spy();
    }
    setOpen(false);
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') !== 'true';
      setOpen(open, !open);
      if (!open) {
        var r = win.getBoundingClientRect();
        if (r.top < 0) win.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
      }
    });
    doc.addEventListener('scroll', function () { atEnd(); queue(); }, { passive: true });
    window.addEventListener('scroll', queue, { passive: true });
    links.forEach(function (a) {
      a.addEventListener('click', function (e) {
        var t = document.getElementById(a.getAttribute('href').slice(1));
        if (!t) return;
        e.preventDefault();
        var smooth = reduced() ? 'auto' : 'smooth';
        pin = secs.indexOf(t);
        pinUntil = Date.now() + 1400;
        if (collapsed()) {
          pinTop = Math.min(t.offsetTop - 4, doc.scrollHeight - doc.clientHeight);
          doc.scrollTo({ top: t.offsetTop - 4, behavior: smooth });
          var r = win.getBoundingClientRect();
          if (r.top < 0 || r.bottom > window.innerHeight) win.scrollIntoView({ behavior: smooth, block: 'nearest' });
        } else {
          pinTop = Math.min(window.pageYOffset + t.getBoundingClientRect().top - (parseFloat(getComputedStyle(t).scrollMarginTop) || 0),
                            document.documentElement.scrollHeight - window.innerHeight);
          t.scrollIntoView({ behavior: smooth, block: 'start' });
        }
        spy();
        t.classList.remove('flash'); void t.offsetWidth; t.classList.add('flash');
      });
    });
    window.addEventListener('resize', function () { atEnd(); queue(); });
  }

  /* ================================================================ 3. construction stepper */
  var ROLES = {
    intake: { s: '1', stage: '1 · Specify', name: 'Intake', sub: 'Map inputs and tasks',
      rule: 'Do not silently substitute an unavailable repository revision or redefine a task to fit the available code.',
      spec: 'Read the complete paper, including appendices, before planning. Preserve the selected task list and pinned raw commit. Map each task to its table entry, survey the implementation, check required artifacts, and record missing details. Do not silently substitute an unavailable repository revision or redefine a task to fit the available code.' },
    planner: { s: '1', stage: '1 · Specify', name: 'Planner', sub: 'Specify measurements',
      rule: 'When paper and code conflict, strictly follow the paper’s stated setup, flag the conflicting code and affected tasks, and record the required implementation corrections before the dependent run.',
      spec: 'For each task, specify the measurement, data, procedure, aggregation, and stated repetitions, with references to supporting paper passages or code locations. Group tasks that share an execution. Record the adopted resolution of each ambiguity before the dependent run; prepare an executable plan and launcher. The Planner does not execute experiments. When paper and code conflict, strictly follow the paper’s stated setup, flag the conflicting code and affected tasks, and record the required implementation corrections before the dependent run.' },
    builder: { s: '2', stage: '2 · Execute', name: 'Builder', sub: 'Prepare the environment',
      rule: 'The environment described by the deliverable should be the one used for construction measurements, not an untested reconstruction assembled afterward.',
      spec: 'Resolve and record dependencies, provide reproducible acquisition of required data and checkpoints, and test the resulting environment. The environment described by the deliverable should be the one used for construction measurements, not an untested reconstruction assembled afterward. Environment work must not silently change the experimental plan.' },
    reproducer: { s: '2', stage: '2 · Execute', name: 'Construction Reproducer', sub: 'Execute and record',
      rule: 'Do not silently edit a frozen plan or select favorable repetitions in place of the specified reporting statistic.',
      spec: 'Execute planned experiments in the prepared environment. Link values to actual output files and record commands, resources, and failures. Distinguish diagnostic runs from scored repetitions; justify changes and repetition extensions. Do not silently edit a frozen plan or select favorable repetitions in place of the specified reporting statistic. Every task needs a supported measurement or an explicit, evidenced reason why none was produced.',
      note: 'The construction Reproducer is not the fresh downstream session used to evaluate reuse.' },
    distiller: { s: '3', stage: '3 · Preserve', name: 'Distiller', sub: 'Document decisions',
      rule: 'Preserve uncertainty where the record does not resolve it.',
      spec: 'Write the guide and change record from stored task specifications, execution evidence, repairs, and choices. Explain the reporting statistic, observed variability, resource requirements, pitfalls, and uncovered scope. Preserve uncertainty where the record does not resolve it. Historical measurements belong in separate result records, not in instructions substituting for new measurements.' },
    packager: { s: '3', stage: '3 · Preserve', name: 'Packager', sub: 'Verify the handoff',
      rule: 'Do not invent replacement values or treat a successful smoke test as completion of a scientific experiment.',
      spec: 'Assemble the code, environment, launchers, and documentation actually used. Check portable paths and verify the handoff from a clean shell, including an inexpensive real repetition. Compare the output structure and extraction route with the record. Do not invent replacement values or treat a successful smoke test as completion of a scientific experiment.' },
    reviewer: { s: 'r', stage: 'Independent review · three checkpoints', name: 'Reviewer', sub: 'Inspect plans, runs, and the handoff; request revisions and recheck',
      rule: 'Inspect the underlying files and outputs directly instead of accepting another role’s summary.',
      spec: 'Check the plan before scored execution, inspect evidence and recorded changes during reproduction, and test the final handoff as an unfamiliar user. Inspect the underlying files and outputs directly instead of accepting another role’s summary. Produce localized findings with the responsible role; do not repair and approve the same work in one context.' }
  };

  function h(tag, cls, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function initStepper() {
    var cs = sec.querySelector('.cs');
    var table = document.getElementById('cs-roles');
    if (!cs || !table) return;
    var btns = [].slice.call(cs.querySelectorAll('.cs-role'));
    var panel = cs.querySelector('.cs-panel');
    var hint = cs.querySelector('.cs-hint');
    var status = document.getElementById('cs-status');
    if (!btns.length || !panel || !hint) return;
    var cells = {};
    [].forEach.call(table.querySelectorAll('tbody tr[data-role]'), function (tr) {
      var td = tr.querySelectorAll('td');
      cells[tr.getAttribute('data-role')] = [td[0] ? td[0].textContent.trim() : '', td[1] ? td[1].textContent.trim() : ''];
    });
    var mq = window.matchMedia ? window.matchMedia('(max-width: 760px)') : { matches: false };
    var cur = null;

    function place() {
      var b = btns.filter(function (x) { return x.getAttribute('data-role') === cur; })[0];
      var stage = b && b.closest('.cs-stage');
      if (mq.matches && stage) { if (panel.previousElementSibling !== stage) stage.parentNode.insertBefore(panel, stage.nextSibling); }
      else if (panel.previousElementSibling !== hint) hint.parentNode.insertBefore(panel, hint.nextSibling);
    }
    function render(key) {
      var R = ROLES[key], cell = cells[key] || ['', ''];
      panel.setAttribute('data-s', R.s);
      panel.innerHTML = '';
      var body = h('div', 'csp-body');
      var head = h('div', 'csp-head');
      head.appendChild(h('span', 'csp-stage', R.stage));
      head.appendChild(h('h4', 'csp-title', R.name));
      head.appendChild(h('span', 'csp-sub', R.sub));
      body.appendChild(head);
      var dl = h('dl', 'csp-cells');
      [['Input and responsibility', cell[0]], ['Output and check', cell[1]]].forEach(function (c) {
        var d = h('div', 'csp-cell');
        d.appendChild(h('dt', null, c[0]));
        d.appendChild(h('dd', null, c[1]));
        dl.appendChild(d);
      });
      body.appendChild(dl);
      var bq = h('blockquote', 'csp-rule');
      bq.appendChild(h('span', 'csp-rule-k', 'Key rule, from the role specification'));
      bq.appendChild(h('q', null, R.rule));
      body.appendChild(bq);
      if (R.note) body.appendChild(h('p', 'csp-note', R.note));
      var det = h('details', 'csp-spec');
      det.appendChild(h('summary', null, 'Full role specification'));
      det.appendChild(h('p', null, R.spec));
      body.appendChild(det);
      panel.appendChild(body);
    }
    function select(key, focus) {
      if (!ROLES[key]) return;
      var changed = key !== cur;
      cur = key;
      btns.forEach(function (b) {
        var on = b.getAttribute('data-role') === key;
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        if (on && focus) b.focus();
      });
      if (changed) {
        render(key);
        place();
        if (status) status.textContent = 'Showing the ' + ROLES[key].name + ' contract.';
      }
    }
    btns.forEach(function (b, i) {
      b.setAttribute('aria-controls', 'cs-panel');
      b.addEventListener('click', function () { select(b.getAttribute('data-role'), false); });
      b.addEventListener('keydown', function (e) {
        var n = btns.length, k = e.key, j = -1;
        if (k === 'ArrowRight' || k === 'ArrowDown') j = (i + 1) % n;
        else if (k === 'ArrowLeft' || k === 'ArrowUp') j = (i - 1 + n) % n;
        else if (k === 'Home') j = 0;
        else if (k === 'End') j = n - 1;
        if (j < 0) return;
        e.preventDefault();
        select(btns[j].getAttribute('data-role'), true);
      });
    });
    if (mq.addEventListener) mq.addEventListener('change', place); else if (mq.addListener) mq.addListener(place);
    select('planner', false);

    /* the full table on request (a copy of the no-JS table) */
    var all = cs.querySelector('.cs-all');
    var src = table.closest('.tbl-scroll');
    if (all && src) {
      var copy = src.cloneNode(true);
      var t = copy.querySelector('table');
      if (t) t.removeAttribute('id');
      all.appendChild(copy);
    }
  }

  initTabs();
  initGuide();
  initStepper();
})();
