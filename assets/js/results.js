/* Results (#results): five chart modules, each initialised when it nears the viewport.
 *  1. Stress-test the gain: a keyed dumbbell (Raw ring -> RRA dot per model) under five scorings. Rows slide
 *     between views and split into two sub-rows for the variability strata; the main view adds the
 *     cross-model spread strips under the axis.
 *  2. Reproducer spending: the same dumbbell engine, API USD | Tokens (B).
 *  3. Handoff and component ablations: bars with hatched losses and component chips.
 *  4. CORE-Bench Hard: three metric panels and success by area (HTML bars).
 *  5. Reuse break-even: cumulative API USD (construction + Reproducer) per model, with a crosshair.
 * Every number comes from window.RB_DATA. Derived values (scenario totals) appear only in tooltips, labelled. */
(function () {
  'use strict';
  var root = document.getElementById('results');
  var D = window.RB_DATA, C = window.RBCharts, RB = window.RB;
  if (!root || !D || !C) return;
  var S = C.svg, H = C.h;
  var MINUS = '−';
  var R_RAW = 6.5, R_RRA = 7;

  /* ---------------------------------------------------------------- small helpers */
  function reduced() { return !!(RB && RB.reduced && RB.reduced()); }
  function byModel(a) { var o = {}; (a || []).forEach(function (r) { o[r.model] = r; }); return o; }
  function f1(v) { return Number(v).toFixed(1); }
  function f2(v) { return Number(v).toFixed(2); }
  function int(v) { return Math.round(Number(v)).toLocaleString('en-US'); }
  function usd(v) { return '$' + int(v); }
  function signedUsd(v) { return (v > 0 ? '+' : v < 0 ? MINUS : '') + '$' + int(Math.abs(v)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeIO(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function set(el, a) { for (var k in a) if (Object.prototype.hasOwnProperty.call(a, k)) el.setAttribute(k, a[k]); return el; }
  function show(el, on) { el.style.display = on ? '' : 'none'; }
  function name(key) { return C.model(key).name; }
  var NPAPERS = (D.selection && D.selection.retained) || 36;
  var NTASKS = (D.selection && D.selection.tasks_verified) || 1029;

  /* tooltip rows: a marker key mirrors the chart (hollow = Raw, filled = RRA); values lead */
  var KEY = {
    raw: '<i class="sw raw" style="margin-right:7px;vertical-align:-1px"></i>',
    rra: '<i class="sw rra" style="margin-right:7px;vertical-align:-1px"></i>',
    none: ''
  };
  function tipHTML(kicker, rows, sub) {
    var h = '<div class="tt">' + esc(kicker) + '</div>';
    rows.forEach(function (r) {
      if (r.head) { h += '<div class="sub" style="margin:6px 0 2px">' + esc(r.head) + '</div>'; return; }
      h += '<div class="row"><span>' + (KEY[r.k] || '') + esc(r.l) + '</span><b>' + esc(r.v) + '</b></div>';
    });
    if (sub) h += '<div class="sub">' + esc(sub) + '</div>';
    return h;
  }

  /* animation: eased 0..1 progress on rAF; instant under reduced motion; returns a cancel function */
  function tween(dur, frame, done) {
    if (reduced() || dur <= 0) { frame(1); if (done) done(); return function () {}; }
    var t0 = 0, raf = 0, stopped = false;
    function step(now) {
      if (stopped) return;
      if (!t0) t0 = now;
      var p = Math.min(1, (now - t0) / dur);
      frame(easeIO(p));
      if (p < 1) raf = requestAnimationFrame(step); else if (done) done();
    }
    raf = requestAnimationFrame(step);
    return function () { stopped = true; cancelAnimationFrame(raf); };
  }
  /* interpolate two state trees of numbers (non-numbers snap to the target) */
  function mix(a, b, t) {
    if (typeof b === 'number') return typeof a === 'number' ? lerp(a, b, t) : b;
    if (Array.isArray(b)) return b.map(function (v, i) { return mix(a ? a[i] : undefined, v, t); });
    if (b && typeof b === 'object') { var o = {}; for (var k in b) o[k] = mix(a ? a[k] : undefined, b[k], t); return o; }
    return b;
  }

  /* text measurement in the section's own type styles (cached; cleared when web fonts arrive) */
  var measurer = null, mcache = {}, relayouts = [];
  function textW(str, cls) {
    var key = cls + '|' + str;
    if (mcache[key] !== undefined) return mcache[key];
    if (!measurer) {
      measurer = S('svg', { 'aria-hidden': 'true', focusable: 'false', class: 'chart res-chart', width: 1, height: 1,
        style: { position: 'absolute', left: '-9999px', top: '0', overflow: 'hidden', 'pointer-events': 'none' } });
      root.appendChild(measurer);
    }
    var t = S('text', { class: cls, text: str }, measurer);
    var w = t.getComputedTextLength ? t.getComputedTextLength() : 0;
    if (!w) w = str.length * 7;
    measurer.removeChild(t);
    return (mcache[key] = w);
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { mcache = {}; relayouts.forEach(function (f) { f(); }); });
  }

  /* seg control with long + short labels (short ones show on phones) */
  function segment(el, items, value, onChange, label) {
    var api = C.seg(el, items, value, onChange, label);
    [].forEach.call(el.querySelectorAll('button'), function (b, i) {
      var it = items[i];
      if (!it || !it.short) return;
      b.textContent = '';
      b.appendChild(H('span', { class: 'l-long', text: it.label }));
      b.appendChild(H('span', { class: 'l-short', 'aria-hidden': 'true', text: it.short }));
      b.setAttribute('aria-label', it.label);
    });
    return api;
  }
  /* fade a caption out, swap its text, fade it back (the latest call wins) */
  function swapText(el, text) {
    if (!el) return;
    clearTimeout(el._resSwap);
    if (reduced()) { el.textContent = text; el.classList.remove('swap'); return; }
    el.classList.add('swap');
    el._resSwap = setTimeout(function () { el.textContent = text; el.classList.remove('swap'); }, 160);
  }

  /* table views: open without JS; collapsed with JS (CSS hides the table until opened, so nothing flashes) */
  [].forEach.call(root.querySelectorAll('details.res-tv'), function (d) {
    d.open = false;
    d.addEventListener('toggle', function () { d.classList.toggle('is-open', d.open); });
  });

  /* ================================================================ dumbbell engine (modules 1 and 2) */
  /* opts: { groups:[model], subs:1|2, pills:bool, strips:{...}|null, pitch, pitchN, pitchNSplit, padR } */
  function Dumbbell(host, opts) {
    var svg = S('svg', { class: 'res-db', focusable: 'false' }, host);
    svg.style.overflow = 'hidden';
    var gBands = S('g', null, svg), gGrid = S('g', { class: 'grid' }, svg),
        gNames = S('g', { 'aria-hidden': 'true' }, svg), gRows = S('g', null, svg), gAxis = S('g', { 'aria-hidden': 'true' }, svg),
        gStrips = S('g', null, svg);   /* after the rows, so keyboard focus reaches the models first */
    var groups = opts.groups, subs = opts.subs || 1, keys = [], R = {}, names = [];
    var W = 0, view = null, geo = null, cur = null, stop = null, gridLines = [], axisKey = '';
    var axisLine = S('line', { class: 'res-axis-line' }, gAxis);
    var gTicks = S('g', null, gAxis);
    var axisTitle = S('text', { class: 'res-axis-t', 'text-anchor': 'middle' }, gAxis);

    groups.forEach(function (gr, gi) {
      names.push(S('text', { class: 'res-name', dy: '0.35em' }, gNames));
      for (var sub = 0; sub < subs; sub++) { var k = gr.key + ':' + sub; keys.push(k); R[k] = makeRow(k, gi, sub); }
    });

    function makeRow(k, gi, sub) {
      var g = S('g', { class: 'res-row' }, gRows);
      var r = { key: k, gi: gi, sub: sub, g: g, dir: 1, data: null };
      var vis = S('g', { 'aria-hidden': 'true' }, g);
      r.band = S('rect', { class: 'res-band', rx: 10 }, gBands);
      r.sdR = S('rect', { class: 'res-sd raw', rx: 4, height: 8 }, vis);
      r.sdA = S('rect', { class: 'res-sd rra', rx: 4, height: 8 }, vis);
      r.conn = S('line', { class: 'conn' }, vis);
      r.mR = S('circle', { class: 'mk-raw', r: R_RAW }, vis);
      r.mA = S('circle', { class: 'mk-rra', r: R_RRA }, vis);
      r.tR = S('text', { class: 'res-val raw', dy: '0.35em' }, vis);
      r.tA = S('text', { class: 'res-val rra', dy: '0.35em' }, vis);
      r.tag = S('text', { class: 'res-tag', dy: '0.35em' }, vis);
      if (opts.pills) {
        r.pill = S('g', { class: 'res-pill' }, vis);
        r.pR = S('rect', { rx: 10, height: 20, y: -10 }, r.pill);
        r.pT = S('text', { 'text-anchor': 'middle', dy: '0.35em' }, r.pill);
      }
      r.hit = S('rect', { class: 'hit', tabindex: '0', role: 'img' }, g);
      r.ring = S('rect', { class: 'focus-ring', rx: 10 }, g);
      function hot(on) { r.band.classList.toggle('on', on); }
      r.hit.addEventListener('pointerenter', function () { hot(true); });
      r.hit.addEventListener('pointerleave', function () { hot(false); });
      r.hit.addEventListener('focus', function () { hot(true); });
      r.hit.addEventListener('blur', function () { hot(false); });
      C.bindTip(r.hit, function () { return r.data && r.data.tip ? r.data.tip() : ''; });
      return r;
    }

    /* ---- geometry for a view at the current width */
    function layout(v) {
      var narrow = W < 600, split = !!v.split, n = groups.length;
      var g = { narrow: narrow, split: split };
      var pitch;
      if (!narrow) {
        g.labelW = clamp(Math.round(W * 0.16), 124, 184);
        g.pillCol = (opts.pills || opts.strips) ? 92 : 0;
        g.x0 = g.labelW + 24;
        g.x1 = W - g.pillCol - (opts.padR || 52);
        g.minX = g.labelW + 6; g.maxX = W - g.pillCol - 4;
        pitch = opts.pitch || 58;
      } else {
        g.x0 = 10; g.x1 = W - (opts.padRn || 44);
        g.minX = 0; g.maxX = W;
        pitch = split ? (opts.pitchNSplit || 90) : (opts.pitchN || 68);
      }
      g.pitch = pitch;
      g.sx = C.linear(v.domain[0], v.domain[1], g.x0, g.x1);
      var top = narrow ? 2 : 6;
      var st = { rows: {}, names: [] };
      groups.forEach(function (gr, gi) {
        var gTop = top + gi * pitch, cy = gTop + pitch / 2;
        var nameY = narrow ? gTop + 11 : cy;
        st.names.push({ x: 0, y: nameY });
        var pills = [];
        for (var sub = 0; sub < subs; sub++) {
          var k = gr.key + ':' + sub, d = v.rows[k], r = R[k];
          var visible = sub === 0 || split;
          var y;
          if (!narrow) y = split ? cy + (sub ? 14 : -14) : cy;
          else y = split ? gTop + (sub ? 64 : 37) : gTop + 40;
          var s = {
            y: y, op: visible ? 1 : 0,
            xr: g.sx(d.raw), xa: g.sx(d.rra),
            sdr: d.rawSd ? Math.abs(g.sx(d.raw + d.rawSd) - g.sx(d.raw)) : 0,
            sda: d.rraSd ? Math.abs(g.sx(d.rra + d.rraSd) - g.sx(d.rra)) : 0,
            tx: narrow ? 0 : g.x0 - 14, top: split ? 1 : 0,
            px: 0, py: y, pw: 0, pop: 0
          };
          if (opts.pills) {
            var txt = (narrow && split && d.pillN) ? d.pillN : d.pill;
            s.pw = txt ? Math.ceil(textW(txt, 'res-pill-m') + 18) : 40;
            s.pop = (txt && visible) ? 1 : 0;
            pills.push(s);
          }
          st.rows[k] = s;
          r.geo = { y: y, top: gTop, narrow: narrow, split: split };
        }
        /* pill positions: a right-hand column on wide screens; on the name line on phones */
        if (opts.pills) {
          if (!narrow) pills.forEach(function (s) { s.px = W - s.pw; s.py = s.y; });
          else if (!split) pills.forEach(function (s) { s.pw = pills[0].pw; s.px = W - s.pw; s.py = nameY; });
          else {
            var xr = W;
            for (var i = pills.length - 1; i >= 0; i--) { pills[i].px = xr - pills[i].pw; pills[i].py = nameY; xr = pills[i].px - 6; }
          }
        }
      });
      var rowsBottom = top + n * pitch;
      st.axisY = rowsBottom + (narrow ? 2 : 6);
      var zone = 0;
      if (opts.strips) zone = narrow ? 78 : 66;
      st.stripOp = v.strips ? 1 : 0;
      st.stripTop = st.axisY + 56;
      st.H = st.axisY + 40 + (v.strips ? zone : 0);
      g.zone = zone;
      geo = g;
      return st;
    }

    /* ---- per-frame painting from a numeric state */
    function paint(st) {
      var Hh = Math.ceil(st.H);
      set(svg, { width: W, height: Hh, viewBox: '0 0 ' + W + ' ' + Hh });
      gridLines.forEach(function (l) { l.setAttribute('y2', st.axisY); });
      gAxis.setAttribute('transform', 'translate(0,' + st.axisY.toFixed(2) + ')');
      groups.forEach(function (gr, gi) { set(names[gi], { x: st.names[gi].x, y: st.names[gi].y.toFixed(2) }); });
      keys.forEach(function (k) { paintRow(R[k], st.rows[k]); });
      if (strips) paintStrips(st);
    }
    function paintRow(r, s) {
      var vis = s.op > 0.02;
      show(r.g, vis);
      if (!vis) return;
      r.g.style.opacity = s.op < 0.995 ? s.op.toFixed(3) : '';
      var y = s.y, dir = r.dir;
      show(r.sdR, s.sdr > 0.6); show(r.sdA, s.sda > 0.6);
      if (s.sdr > 0.6) set(r.sdR, { x: s.xr - s.sdr, y: y - 4, width: 2 * s.sdr });
      if (s.sda > 0.6) set(r.sdA, { x: s.xa - s.sda, y: y - 4, width: 2 * s.sda });
      /* the dashed connector runs between the SD bands (or the markers when there is no band) */
      var c1 = s.xr + dir * Math.max(R_RAW + 2, s.sdr + 1.5), c2 = s.xa - dir * Math.max(R_RRA + 2, s.sda + 1.5);
      var on = dir * (c2 - c1) > 4;
      show(r.conn, on);
      if (on) set(r.conn, { x1: c1, x2: c2, y1: y, y2: y });
      set(r.mR, { cx: s.xr, cy: y }); set(r.mA, { cx: s.xa, cy: y });
      /* values sit just outside the marker, or outside its SD band when one is drawn */
      placeLabel(r.tR, r.wR, s.xr, y, -dir, Math.max(R_RAW + 6, s.sdr + 5));
      placeLabel(r.tA, r.wA, s.xa, y, dir, Math.max(R_RRA + 6, s.sda + 5));
      set(r.tag, { x: s.tx, y: y, 'text-anchor': geo.narrow ? 'start' : 'end' });
      r.tag.style.opacity = s.top.toFixed(3);
      if (r.pill) {
        r.pill.setAttribute('transform', 'translate(' + s.px.toFixed(2) + ',' + s.py.toFixed(2) + ')');
        set(r.pR, { width: s.pw.toFixed(2) }); set(r.pT, { x: (s.pw / 2).toFixed(2) });
        r.pill.style.opacity = s.pop.toFixed(3);
      }
    }
    function placeLabel(t, w, x, y, side, off) {
      var lx = x + side * off;
      if ((side < 0 && lx - w < geo.minX) || (side > 0 && lx + w > geo.maxX)) {
        set(t, { x: clamp(x, geo.minX + w / 2, geo.maxX - w / 2), y: y - 15, 'text-anchor': 'middle' });
      } else set(t, { x: lx, y: y, 'text-anchor': side < 0 ? 'end' : 'start' });
    }

    /* ---- axis (rebuilt when the domain changes) */
    function buildAxis(v, fade) {
      gGrid.textContent = ''; gTicks.textContent = ''; gridLines = [];
      var cls = fade ? 'res-fade-in' : null;
      var gl = S('g', { class: cls }, gGrid), tl = S('g', { class: cls }, gTicks);
      v.ticks.forEach(function (t) {
        var x = geo.sx(t);
        gridLines.push(S('line', { x1: x, x2: x, y1: geo.narrow ? 0 : 2, y2: 10 }, gl));
        var tg = S('g', { class: 'tick' }, tl);
        S('text', { x: x, y: 20, 'text-anchor': 'middle', text: v.tick(t) }, tg);
      });
      set(axisLine, { x1: geo.x0, x2: geo.x1, y1: 0, y2: 0 });
      set(axisTitle, { x: (geo.x0 + geo.x1) / 2, y: 37 });
      axisTitle.textContent = geo.narrow && v.axisN ? v.axisN : v.axis;
    }

    /* ---- cross-model spread strips (main view of module 1) */
    var strips = null;
    if (opts.strips) {
      strips = { g: S('g', { class: 'res-strip-g' }, gStrips), items: [] };
      var sVis = S('g', { 'aria-hidden': 'true' }, strips.g);
      strips.sep = S('line', { class: 'res-strip-sep' }, sVis);
      opts.strips.forEach(function (sp) {
        var it = { sp: sp };
        it.lbl = S('text', { class: 'res-strip-lbl', dy: '0.35em', text: sp.label }, sVis);
        it.rect = S('rect', { class: 'res-strip ' + sp.kind, rx: 5, height: 10 }, sVis);
        it.val = S('text', { class: 'res-strip-val', 'text-anchor': 'end', dy: '0.35em', text: sp.value }, sVis);
        it.hit = S('rect', { class: 'hit', tabindex: '-1', role: 'img', 'aria-label': sp.aria }, strips.g);
        it.ring = S('rect', { class: 'focus-ring', rx: 9 }, strips.g);
        C.bindTip(it.hit, sp.tip);
        strips.items.push(it);
      });
    }
    function paintStrips(st) {
      var op = st.stripOp;
      show(strips.g, op > 0.02);
      if (op <= 0.02) return;
      strips.g.style.opacity = op < 0.995 ? op.toFixed(3) : '';
      var top = st.stripTop, sx = geo.sx;
      set(strips.sep, { x1: 0, x2: W, y1: top - 4, y2: top - 4 });
      strips.items.forEach(function (it, i) {
        var y, ly;
        if (!geo.narrow) { y = top + 14 + i * 24; ly = y; set(it.lbl, { x: 0, y: ly }); set(it.val, { x: W, y: ly }); }
        else { ly = top + 9 + i * 34; y = ly + 16; set(it.lbl, { x: 0, y: ly }); set(it.val, { x: W, y: ly }); }
        var a = sx(it.sp.from), b = sx(it.sp.to);
        set(it.rect, { x: a, y: y - 5, width: Math.max(2, b - a) });
        var hy = geo.narrow ? ly - 10 : y - 12, hh = geo.narrow ? 32 : 24;
        set(it.hit, { x: 0, y: hy, width: W, height: hh });
        set(it.ring, { x: 1, y: hy + 1, width: W - 2, height: hh - 2 });
        it.hit.setAttribute('tabindex', st.stripOp > 0.5 ? '0' : '-1');
      });
    }

    /* ---- static per-view bits: texts, aria, hit areas */
    function applyView(v, fade) {
      keys.forEach(function (k) {
        var r = R[k], d = v.rows[k];
        r.data = d;
        r.dir = d.rra >= d.raw ? 1 : -1;
        r.tR.textContent = d.rawText; r.tA.textContent = d.rraText;
        r.wR = textW(d.rawText, 'res-val raw'); r.wA = textW(d.rraText, 'res-val rra');
        r.tag.textContent = d.tag || '';
        if (r.pill) r.pT.textContent = (geo.narrow && geo.split && d.pillN) ? d.pillN : (d.pill || '');
        var visible = r.sub === 0 || !!v.split;
        r.hit.setAttribute('aria-label', d.aria || '');
        r.hit.setAttribute('tabindex', visible ? '0' : '-1');
        if (visible) r.hit.removeAttribute('aria-hidden'); else r.hit.setAttribute('aria-hidden', 'true');
      });
      groups.forEach(function (gr, gi) { names[gi].textContent = geo.narrow ? gr.short : gr.name; });
      var ak = v.domain.join(',') + '|' + v.ticks.join(',') + '|' + W;
      if (ak !== axisKey) { buildAxis(v, fade && axisKey !== ''); axisKey = ak; }
      else axisTitle.textContent = geo.narrow && v.axisN ? v.axisN : v.axis;
      placeHits(v);
    }
    function placeHits(v) {
      keys.forEach(function (k) {
        var r = R[k], gm = r.geo, x = 0, w = W, y, h;
        if (!gm.narrow) {
          h = gm.split ? 28 : geo.pitch - 6; y = gm.y - h / 2;
        } else if (!gm.split) {
          y = gm.top + 1; h = geo.pitch - 8;
        } else {
          if (r.sub === 0) { y = gm.top + 1; h = gm.y + 13 - y; } else { y = gm.y - 13; h = 26; }
        }
        set(r.hit, { x: x, y: y, width: w, height: h });
        set(r.ring, { x: x + 1, y: y + 1, width: w - 2, height: h - 2 });
        set(r.band, { x: x, y: y, width: w, height: h });
      });
    }

    function render(v, animate) {
      var target = layout(v);
      applyView(v, animate);
      if (stop) { stop(); stop = null; }
      if (!cur || !animate) { cur = target; paint(cur); return; }
      var from = cur;
      stop = tween(420, function (t) { cur = mix(from, target, t); paint(cur); }, function () { stop = null; cur = target; paint(cur); });
    }
    return {
      set: function (v, animate) { view = v; if (W) render(v, animate); },
      resize: function (w) { W = Math.round(w); if (view) { axisKey = ''; cur = null; render(view, false); } }
    };
  }

  /* ================================================================ 1 · stress-test the gain */
  function initGain(card) {
    var host = card.querySelector('[data-chart]'), segEl = card.querySelector('[data-seg]');
    if (!host || !segEl || !D.main) return;
    var MAIN = byModel(D.main), ROB = byModel(D.robustness), STR = {}, AUD = {};
    (D.strata || []).forEach(function (r) { STR[r.model + ':' + r.cat] = r; });
    (D.audit_sensitivity || []).forEach(function (r) { AUD[r.model + ':' + r.input] = r; });
    var N = D.strata_n || {};
    var models = D.models;

    function pct(v) { return f1(v) + '%'; }
    function row(raw, rra, extra) {
      var o = { raw: raw, rra: rra, rawText: f1(raw), rraText: f1(rra) };
      for (var k in extra) o[k] = extra[k];
      return o;
    }
    function rangeOf(list, f) {
      var lo = list[0], hi = list[0];
      list.forEach(function (x) { if (f(x) < f(lo)) lo = x; if (f(x) > f(hi)) hi = x; });
      return { lo: lo, hi: hi };
    }

    var VIEWS = {
      main: {
        label: 'Main', short: 'Main', basis: '3-eval mean', axis: 'Task success (%)', axisN: 'Task success (%)', strips: true,
        build: function (m) {
          var s = MAIN[m].success;
          return row(s.raw, s.rra, {
            rawSd: s.raw_sd, rraSd: s.rra_sd, pill: s.gain_str + ' pp',
            aria: name(m) + ', main result: Raw ' + pct(s.raw) + ' (SD ' + f1(s.raw_sd) + '), refined artifact ' + pct(s.rra) + ' (SD ' + f1(s.rra_sd) + '), gain ' + s.gain_str + ' percentage points.',
            tip: function () {
              return tipHTML(name(m) + ' · Main result', [
                { k: 'raw', l: 'Raw', v: pct(s.raw) + ' ± ' + f1(s.raw_sd) },
                { k: 'rra', l: 'RRA', v: pct(s.rra) + ' ± ' + f1(s.rra_sd) },
                { l: 'Gain', v: s.gain_str + ' pp' }
              ], 'Mean ± SD over three evaluations, ' + int(NTASKS) + ' tasks.');
            }
          });
        },
        cap: function () {
          var r = rangeOf(models, function (x) { return MAIN[x.key].success.gain; });
          return 'Mean over three evaluations (± SD). Success requires numerical compatibility and no confirmed audit violation. Gains range from ' +
            MAIN[r.lo.key].success.gain_str + ' pp (' + r.lo.name + ') to ' + MAIN[r.hi.key].success.gain_str + ' pp (' + r.hi.name + ').';
        }
      },
      macro: {
        label: 'Equal paper weights', short: 'Equal papers', basis: 'Eval 1 · Codex', axis: 'Paper-macro success (%)', axisN: 'Paper-macro success (%)',
        build: function (m) {
          var s = ROB[m].macro;
          return row(s.raw, s.rra, {
            pill: s.gain_str + ' pp',
            aria: name(m) + ', equal paper weights: Raw ' + pct(s.raw) + ', refined artifact ' + pct(s.rra) + ', gain ' + s.gain_str + ' percentage points; papers improved, tied, worse: ' + s.improved + ', ' + s.tied + ', ' + s.worse + '.',
            tip: function () {
              return tipHTML(name(m) + ' · Equal paper weights', [
                { k: 'raw', l: 'Raw', v: pct(s.raw) }, { k: 'rra', l: 'RRA', v: pct(s.rra) }, { l: 'Gain', v: s.gain_str + ' pp' },
                { l: 'Papers improved / tied / worse', v: s.improved + ' / ' + s.tied + ' / ' + s.worse }
              ], 'Paper-macro success over ' + NPAPERS + ' papers, first evaluation.');
            }
          });
        },
        cap: function () {
          var notWorse = function (x) { return ROB[x.key].macro.improved + ROB[x.key].macro.tied; };
          var r = rangeOf(models, function (x) { return ROB[x.key].macro.gain; }), it = rangeOf(models, notWorse);
          return 'Paper-macro success: each of the ' + NPAPERS + ' papers weighted equally, first evaluation. All four models improve, by ' +
            ROB[r.lo.key].macro.gain_str + ' to ' + ROB[r.hi.key].macro.gain_str + ' pp; success improves or ties on ' + notWorse(it.lo) + ' to ' + notWorse(it.hi) + ' papers per model.';
        }
      },
      strict: {
        label: 'Stricter interval', short: '80% interval', basis: 'Eval 1 · Codex', axis: 'Task success with the 80% interval (%)', axisN: 'Success, 80% interval (%)',
        build: function (m) {
          var s = ROB[m].strict80;
          return row(s.raw, s.rra, {
            pill: s.gain_str + ' pp',
            aria: name(m) + ', 80% interval: Raw ' + pct(s.raw) + ', refined artifact ' + pct(s.rra) + ', gain ' + s.gain_str + ' percentage points.',
            tip: function () {
              return tipHTML(name(m) + ' · 80% interval', [
                { k: 'raw', l: 'Raw', v: pct(s.raw) }, { k: 'rra', l: 'RRA', v: pct(s.rra) }, { l: 'Gain', v: s.gain_str + ' pp' }
              ], 'Task-level success, ' + int(NTASKS) + ' tasks, first evaluation, same audit judgments.');
            }
          });
        },
        cap: function () {
          var r = rangeOf(models, function (x) { return ROB[x.key].strict80.gain; });
          return 'Task-level success with the 80% interval instead of 95%, same ' + int(NTASKS) + ' tasks and audit judgments, first evaluation. Gains: ' +
            ROB[r.lo.key].strict80.gain_str + ' to ' + ROB[r.hi.key].strict80.gain_str + ' pp.';
        }
      },
      audit: {
        label: 'Claude as Auditor', short: 'Claude Auditor', basis: 'Eval 1 · Claude', axis: 'Task success with Claude as Auditor (%)', axisN: 'Success, Claude as Auditor (%)',
        build: function (m) {
          var a = AUD[m + ':Raw'], b = AUD[m + ':RRA'];
          return row(a.claude.success, b.claude.success, {
            pill: null,
            aria: name(m) + ', Claude as Auditor: Raw ' + pct(a.claude.success) + ', refined artifact ' + pct(b.claude.success) + '; with Codex: Raw ' + pct(a.codex.success) + ', refined artifact ' + pct(b.codex.success) + '.',
            tip: function () {
              return tipHTML(name(m) + ' · Claude as Auditor', [
                { k: 'raw', l: 'Raw', v: pct(a.claude.success) }, { k: 'rra', l: 'RRA', v: pct(b.claude.success) },
                { head: 'Codex, the primary Auditor' },
                { k: 'raw', l: 'Raw', v: pct(a.codex.success) }, { k: 'rra', l: 'RRA', v: pct(b.codex.success) }
              ], 'Claude invalidates ' + a.claude.invalid + ' of ' + int(a.claude.matched) + ' Raw and ' + b.claude.invalid + ' of ' + int(b.claude.matched) +
                ' RRA numerical matches (Codex: ' + a.codex.invalid + ' and ' + b.codex.invalid + '). Success = 100 × (matched − invalid) / ' + int(NTASKS) + '.');
            }
          });
        },
        cap: function () {
          return 'Claude inspects the same numerically matching outcomes as Codex (first evaluation). Refined artifacts improve success under either Auditor; differences in invalidations change absolute rates, not the direction.';
        }
      },
      strata: {
        label: 'By variability', short: 'Variability', basis: 'Eval 1 · Codex', axis: 'Task success within each variability group (%)', axisN: 'Success within each group (%)', split: true,
        build: function (m, sub) {
          var cat = sub + 1, s = STR[m + ':' + cat];
          var grp = cat === 1 ? 'stable' : 'higher variability';
          return row(s.raw, s.rra, {
            pill: s.gain_str + ' pp', pillN: 'Cat. ' + cat + ' ' + s.gain_str, tag: 'Cat. ' + cat,
            aria: name(m) + ', Cat. ' + cat + ' (' + grp + ', ' + N[String(cat)] + ' tasks): Raw ' + pct(s.raw) + ', refined artifact ' + pct(s.rra) + ', gain ' + s.gain_str + ' percentage points.',
            tip: function () {
              return tipHTML(name(m) + ' · Cat. ' + cat, [
                { k: 'raw', l: 'Raw', v: pct(s.raw) }, { k: 'rra', l: 'RRA', v: pct(s.rra) }, { l: 'Gain', v: s.gain_str + ' pp' }
              ], (cat === 1 ? 'Stable references' : 'Higher-variability references') + ' (n = ' + N[String(cat)] + ' tasks), first evaluation.');
            }
          });
        },
        cap: function () {
          function rg(cat) {
            var list = models.map(function (x) { return STR[x.key + ':' + cat]; });
            var lo = list[0], hi = list[0];
            list.forEach(function (s) { if (s.gain < lo.gain) lo = s; if (s.gain > hi.gain) hi = s; });
            return lo.gain_str + ' to ' + hi.gain_str + ' pp';
          }
          return 'First evaluation. Both groups improve for every model: ' + rg(1) + ' on stable tasks and ' + rg(2) +
            ' on higher-variability tasks. The groups differ in task composition and interval width, so the contrast is descriptive.';
        }
      }
    };
    var ORDER = ['main', 'macro', 'strict', 'audit', 'strata'];

    function viewSpec(key) {
      var V = VIEWS[key], rows = {};
      models.forEach(function (m) {
        var r0 = V.build(m.key, 0);
        rows[m.key + ':0'] = r0;
        rows[m.key + ':1'] = V.split ? V.build(m.key, 1) : r0;
      });
      return { domain: [40, 100], ticks: [40, 50, 60, 70, 80, 90, 100], tick: function (t) { return String(t); },
               axis: V.axis, axisN: V.axisN, rows: rows, split: !!V.split, strips: !!V.strips };
    }

    /* cross-model spread strips: min..max of the main-result Raw and RRA means */
    var H0 = D.headline || {};
    function spread(kind) {
      var vals = models.map(function (m) { return { m: m, v: MAIN[m.key].success[kind] }; });
      var lo = vals[0], hi = vals[0];
      vals.forEach(function (x) { if (x.v < lo.v) lo = x; if (x.v > hi.v) hi = x; });
      var width = kind === 'raw' ? H0.spread_raw : H0.spread_rra, lbl = kind === 'raw' ? 'Raw' : 'RRA';
      return {
        kind: kind, from: lo.v, to: hi.v, label: lbl + ' spread', value: f1(width) + ' pp',
        aria: lbl + ' spread across models: ' + f1(lo.v) + '% (' + lo.m.name + ') to ' + f1(hi.v) + '% (' + hi.m.name + '), ' + f1(width) + ' percentage points.',
        tip: function () {
          return tipHTML(lbl + ' spread across models', [
            { k: kind, l: 'Lowest · ' + lo.m.name, v: f1(lo.v) + '%' }, { k: kind, l: 'Highest · ' + hi.m.name, v: f1(hi.v) + '%' },
            { l: 'Spread', v: f1(width) + ' pp' }
          ], 'Main result, means over three evaluations.');
        }
      };
    }

    var chart = Dumbbell(host, { groups: models, subs: 2, pills: true, strips: [spread('raw'), spread('rra')], pitch: 58, pitchN: 68, pitchNSplit: 92 });
    var basis = card.querySelector('[data-basis]'), cap = card.querySelector('[data-modecap]');
    var legSd = card.querySelector('[data-leg="sd"]'), legend = card.querySelector('.res-legend');
    var legStrata = [1, 2].map(function (cat) {
      return H('span', { class: 'res-leg-cat', 'data-leg': 'strata', hidden: true }, [
        H('b', { text: 'Cat. ' + cat }), H('span', { text: (cat === 1 ? 'stable' : 'higher variability') + ' (n = ' + int(N[String(cat)]) + ')' })
      ]);
    });
    if (legend) legStrata.forEach(function (el) { legend.appendChild(el); });
    var current = 'main';

    function apply(key, animate) {
      current = key;
      var V = VIEWS[key];
      chart.set(viewSpec(key), animate);
      if (animate) { swapText(basis, V.basis); swapText(cap, V.cap()); }
      else { if (basis) basis.textContent = V.basis; if (cap) cap.textContent = V.cap(); }
      if (legSd) legSd.hidden = key !== 'main';
      legStrata.forEach(function (el) { el.hidden = key !== 'strata'; });
    }
    segment(segEl, ORDER.map(function (k) { return { value: k, label: VIEWS[k].label, short: VIEWS[k].short }; }), current,
      function (v) { apply(v, true); }, 'Scoring view for the gain chart');
    chart.resize(host.clientWidth);
    apply(current, false);
    C.onResize(host, function (w) { chart.resize(w); });
    relayouts.push(function () { chart.resize(host.clientWidth); });
  }

  /* ================================================================ 2 · Reproducer spending */
  function initSpend(card) {
    var host = card.querySelector('[data-chart]'), segEl = card.querySelector('[data-seg]');
    if (!host || !segEl || !D.main) return;
    var MAIN = byModel(D.main), models = D.models;
    var VIEWS = {
      usd: { label: 'API USD', key: 'api_usd', domain: [0, 3600], ticks: [0, 1000, 2000, 3000], what: 'API spending',
             tick: function (t) { return '$' + int(t); }, axis: 'Reproducer API spending (USD, summed over sessions)', axisN: 'API USD, summed over sessions',
             val: usd, sd: int, unit: '' },
      tok: { label: 'Tokens (B)', key: 'tokens_b', domain: [0, 9], ticks: [0, 3, 6, 9], what: 'Tokens',
             tick: function (t) { return t ? t + 'B' : '0'; }, axis: 'Reproducer tokens (billions, summed over sessions)', axisN: 'Tokens (billions), summed over sessions',
             val: f2, sd: f2, unit: ' B' }
    };
    function spec(key) {
      var V = VIEWS[key], rows = {};
      models.forEach(function (m) {
        var c = MAIN[m.key][V.key];
        rows[m.key + ':0'] = {
          raw: c.raw, rra: c.rra, rawText: V.val(c.raw), rraText: V.val(c.rra), pill: MINUS + f1(c.red) + '%',
          aria: m.name + ', ' + (V.what.indexOf('API') === 0 ? V.what : V.what.toLowerCase()) + ': Raw ' + V.val(c.raw) + V.unit + ', refined artifact ' + V.val(c.rra) + V.unit + ', ' + f1(c.red) + '% lower.',
          tip: function () {
            return tipHTML(m.name + ' · ' + V.what, [
              { k: 'raw', l: 'Raw', v: V.val(c.raw) + V.unit + ' ± ' + V.sd(c.raw_sd) },
              { k: 'rra', l: 'RRA', v: V.val(c.rra) + V.unit + ' ± ' + V.sd(c.rra_sd) },
              { l: 'Reduction', v: MINUS + f1(c.red) + '%' }
            ], 'Mean ± SD over three evaluations; the reduction is 100 × (Raw − RRA) / Raw from the means.');
          }
        };
      });
      return { domain: V.domain, ticks: V.ticks, tick: V.tick, axis: V.axis, axisN: V.axisN, rows: rows };
    }
    var chart = Dumbbell(host, { groups: models, subs: 1, pills: true, pitch: 52, pitchN: 66, padR: 64, padRn: 60 });
    var current = 'usd';
    C.seg(segEl, [{ value: 'usd', label: VIEWS.usd.label }, { value: 'tok', label: VIEWS.tok.label }], current,
      function (v) { current = v; chart.set(spec(v), true); }, 'Spending metric');
    chart.resize(host.clientWidth);
    chart.set(spec(current), false);
    C.onResize(host, function (w) { chart.resize(w); });
    relayouts.push(function () { chart.resize(host.clientWidth); });
  }

  /* ================================================================ 3 · handoff and component ablations */
  function initAblation(card) {
    var host = card.querySelector('[data-chart]'), A = D.ablation;
    if (!host || !A || !A.rows) return;
    var chips = [].slice.call(card.querySelectorAll('[data-comp]'));
    var descEl = card.querySelector('[data-desc-text]');
    var rows = A.rows, full = rows.filter(function (r) { return r.label === 'Full RRA'; })[0];
    var FULL = full ? full.success : 0;
    var hand = rows.filter(function (r) { return r.kind === 'handoff'; }), rem = rows.filter(function (r) { return r.kind === 'removed'; });
    /* the paper's component-removal protocol, verbatim */
    var ALSO = 'Descriptions of the removed component are also deleted from the remaining documentation and scripts.';
    var PROTO = {
      'Refined codebase': ['Refined-code removal restores the original source.', ALSO],
      'Environment setup': ['Environment removal deletes the setup route.', ALSO],
      'Experiment launchers': ['Launcher removal deletes the experiment entry points.', ALSO],
      'Reproduction guide': ['The guide ablation removes the guide itself.', 'The change record belongs to the documentation component.']
    };
    var CLS = { 'Raw code': 'raw', 'Ordinary outputs': 'ord', 'Full RRA': 'full' };
    var NOTE = {
      'Raw code': 'The released codebase.',
      'Ordinary outputs': 'Opus 5’s raw-code execution directory: code, scripts, and logs retained, result files removed; no standardized guide.',
      'Full RRA': 'The complete refined artifact: refined codebase, environment setup, experiment launchers, and reproduction guide.'
    };
    var sel = null, svg = null, rowEls = {}, W = 0;

    function barPath(xa, xb, y, h, r) {
      r = Math.max(0, Math.min(r, (xb - xa) / 2, h / 2));
      var t = y - h / 2, b = y + h / 2;
      return 'M' + xa + ',' + t + 'H' + (xb - r) + 'Q' + xb + ',' + t + ' ' + xb + ',' + (t + r) + 'V' + (b - r) +
        'Q' + xb + ',' + b + ' ' + (xb - r) + ',' + b + 'H' + xa + 'Z';
    }
    function tipFor(r) {
      if (r.kind === 'removed') {
        return tipHTML('Full RRA without · ' + r.label, [
          { k: 'rra', l: 'Success', v: f1(r.success) + '%' }, { l: 'Loss from full RRA', v: MINUS + f1(r.loss) + ' pp' }
        ], PROTO[r.label] ? PROTO[r.label].join(' ') : '');
      }
      return tipHTML('Handoff · ' + r.label, [{ k: r.label === 'Raw code' ? 'raw' : r.label === 'Full RRA' ? 'rra' : 'none', l: 'Success', v: f1(r.success) + '%' }], NOTE[r.label] || '');
    }

    function draw() {
      W = Math.round(host.clientWidth);
      if (!W) return;
      var narrow = W < 600;
      var labelW = narrow ? 0 : clamp(Math.round(W * 0.19), 150, 200);
      var x0 = narrow ? 0 : labelW + 12, x1 = narrow ? W - 2 : W - 168;
      var sx = C.linear(0, 100, x0, x1);
      var pitch = narrow ? 46 : 32, bh = narrow ? 12 : 16;
      host.textContent = '';
      svg = S('svg', { class: 'res-abl' + (sel ? ' has-sel' : ''), focusable: 'false' }, host);
      var defs = S('defs', null, svg);
      var pat = S('pattern', { id: 'res-hatch', patternUnits: 'userSpaceOnUse', width: 5, height: 5, patternTransform: 'rotate(45)' }, defs);
      S('line', { class: 'res-hatch-line', x1: 0, y1: 0, x2: 0, y2: 5 }, pat);
      var gGrid = S('g', { class: 'grid' }, svg), gBand = S('g', null, svg), gRows = S('g', null, svg), gAnno = S('g', { 'aria-hidden': 'true' }, svg);
      var y = 12, ys = {};
      var items = [];
      function header(text) {
        S('text', { class: 'res-grp', x: 0, y: y, dy: '0.35em', text: text }, gAnno);
        y += narrow ? 26 : 24;
      }
      function addRow(r) {
        var ry = narrow ? y + 18 : y;
        items.push({ r: r, y: ry, top: y - (narrow ? 12 : pitch / 2) });
        ys[r.label] = ry;
        y += pitch;
      }
      header('Handoffs');
      hand.forEach(addRow);
      y += narrow ? 12 : 14;
      var g2 = y;
      header('Full RRA without one component');
      var remTop = y - (narrow ? 10 : pitch / 2);
      rem.forEach(addRow);
      var axisY = y - (narrow ? 14 : pitch / 2) + 8;
      var Hh = axisY + 42;
      set(svg, { width: W, height: Hh, viewBox: '0 0 ' + W + ' ' + Hh });

      /* grid + axis */
      [0, 20, 40, 60, 80, 100].forEach(function (t) {
        S('line', { x1: sx(t), x2: sx(t), y1: 2, y2: axisY }, gGrid);
        var tg = S('g', { class: 'tick' }, gAnno);
        S('text', { x: sx(t), y: axisY + 18, 'text-anchor': 'middle', text: String(t) }, tg);
      });
      S('line', { class: 'res-axis-line', x1: x0, x2: x1, y1: axisY, y2: axisY }, gAnno);
      S('text', { class: 'res-axis-t', x: (x0 + x1) / 2, y: axisY + 36, 'text-anchor': 'middle', text: 'Success (%) · Sonnet 5, ' + A.tasks + ' tasks' }, gAnno);

      /* the full-artifact reference through the removal group */
      var fx = sx(FULL);
      if (!narrow) S('line', { class: 'res-ref', x1: fx, x2: fx, y1: remTop + 6, y2: axisY }, gAnno);
      else items.forEach(function (it) {   /* phones: short ticks through each removal bar, clear of the value text */
        if (it.r.kind === 'removed') S('line', { class: 'res-ref', x1: fx, x2: fx, y1: it.y - bh / 2 - 4, y2: it.y + bh / 2 + 4 }, gAnno);
      });
      if (!narrow) S('text', { class: 'res-ref-t', x: fx, y: g2 - 1, dy: '0.35em', 'text-anchor': 'middle', text: 'Full RRA ' + f1(FULL) }, gAnno);

      rowEls = {};
      items.forEach(function (it) {
        var r = it.r, row = S('g', { class: 'res-abl-row ' + (r.kind === 'removed' ? 'rem' : 'hand') + (sel === r.label ? ' is-sel' : '') }, gRows);
        var band = S('rect', { class: 'res-band', x: 0, y: it.y - (narrow ? 30 : pitch / 2), width: W, height: narrow ? 44 : pitch, rx: 9 }, row);
        var g = S('g', { 'aria-hidden': 'true' }, row);
        var vx = sx(r.success);
        if (r.kind === 'removed') {
          g.appendChild(S('path', { class: 'res-bar rem', d: barPath(x0, vx - 1, it.y, bh, 0) }));
          g.appendChild(S('path', { class: 'res-loss', d: barPath(vx + 1, fx, it.y, bh, 4) }));
        } else {
          g.appendChild(S('path', { class: 'res-bar ' + CLS[r.label], d: barPath(x0, vx, it.y, bh, 4) }));
        }
        /* labels */
        var vText = f1(r.success) + '%', lText = r.kind === 'removed' ? MINUS + f1(r.loss) + ' pp' : '';
        if (!narrow) {
          S('text', { class: 'res-blbl', x: 0, y: it.y, dy: '0.35em', text: r.label }, g);
          var vxText = r.kind === 'removed' ? fx + 10 : vx + 10;
          S('text', { class: 'res-bval' + (r.label === 'Full RRA' ? ' full' : ''), x: vxText, y: it.y, dy: '0.35em', text: vText }, g);
          if (lText) S('text', { class: 'res-bloss', x: vxText + textW(vText, 'res-bval') + 10, y: it.y, dy: '0.35em', text: lText }, g);
        } else {
          S('text', { class: 'res-blbl', x: 0, y: it.y - 17, dy: '0.35em', text: r.label }, g);
          var tv = S('text', { x: W, y: it.y - 17, dy: '0.35em', 'text-anchor': 'end' }, g);
          S('tspan', { class: 'res-bval' + (r.label === 'Full RRA' ? ' full' : ''), text: vText }, tv);
          if (lText) S('tspan', { class: 'res-bloss', dx: 8, text: lText }, tv);
        }
        var hit = S('rect', { class: 'hit', x: 0, y: band.getAttribute('y'), width: W, height: band.getAttribute('height'), tabindex: '0',
          role: r.kind === 'removed' ? 'button' : 'img',
          'aria-label': (r.kind === 'removed' ? 'Full RRA without ' + r.label + ': ' + vText + ', ' + f1(r.loss) + ' points below the full artifact. Press to show its removal protocol.' : r.label + ': ' + vText + ' success.') }, row);
        if (r.kind === 'removed') hit.setAttribute('aria-pressed', sel === r.label ? 'true' : 'false');
        S('rect', { class: 'focus-ring', x: 1, y: +band.getAttribute('y') + 1, width: W - 2, height: band.getAttribute('height') - 2, rx: 9 }, row);
        C.bindTip(hit, function () { return tipFor(r); });
        function hot(on) { band.classList.toggle('on', on); }
        hit.addEventListener('pointerenter', function () { hot(true); });
        hit.addEventListener('pointerleave', function () { hot(false); });
        hit.addEventListener('focus', function () { hot(true); });
        hit.addEventListener('blur', function () { hot(false); });
        if (r.kind === 'removed') {
          hit.addEventListener('click', function () { choose(sel === r.label ? null : r.label); });
          hit.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(sel === r.label ? null : r.label); } });
        }
        rowEls[r.label] = row;
      });

      /* ordinary outputs -> full RRA bracket (the paper's 11.8 pp) */
      if (!narrow && ys['Ordinary outputs'] !== undefined && ys['Full RRA'] !== undefined && A.full_vs_ordinary !== undefined) {
        var bx = fx + 10 + textW(f1(FULL) + '%', 'res-bval') + 22, ya = ys['Ordinary outputs'], yb = ys['Full RRA'];
        S('path', { class: 'res-brk', d: 'M' + (bx - 6) + ',' + ya + 'H' + bx + 'V' + yb + 'H' + (bx - 6) }, gAnno);
        S('text', { class: 'res-brk-t', x: bx + 8, y: (ya + yb) / 2, dy: '0.35em', text: '+' + f1(A.full_vs_ordinary) + ' pp' }, gAnno);
      }
    }

    function describe() {
      if (!descEl) return;
      if (!sel) { descEl.textContent = 'Select a component to see how it was removed.'; return; }
      var r = rem.filter(function (x) { return x.label === sel; })[0];
      descEl.textContent = '';
      descEl.appendChild(H('b', { text: sel + ' removed: ' + f1(r.success) + '% (' + MINUS + f1(r.loss) + ' pp). ' }));
      descEl.appendChild(document.createTextNode(PROTO[sel].join(' ')));
    }
    function choose(label) {
      sel = label;
      chips.forEach(function (c) { c.setAttribute('aria-pressed', c.getAttribute('data-comp') === sel ? 'true' : 'false'); });
      if (svg) svg.classList.toggle('has-sel', !!sel);
      Object.keys(rowEls).forEach(function (k) {
        rowEls[k].classList.toggle('is-sel', k === sel);
        var h = rowEls[k].querySelector('.hit[aria-pressed]');
        if (h) h.setAttribute('aria-pressed', k === sel ? 'true' : 'false');
      });
      describe();
    }
    chips.forEach(function (c) {
      c.addEventListener('click', function () { var v = c.getAttribute('data-comp'); choose(sel === v ? null : v); });
    });
    draw();
    describe();
    C.onResize(host, function () { draw(); });
    relayouts.push(draw);
  }

  /* ================================================================ 4 · CORE-Bench Hard */
  function initCore(card) {
    var host = card.querySelector('[data-chart]'), CB = D.corebench;
    if (!host || !CB || !CB.overall) return;
    var CLS = { Raw: 'raw', VERITAS: 'ver', RRA: 'rra' };
    var O = CB.overall;
    var METRICS = [
      { key: 'success', t: 'Capsule success', d: 'higher is better', max: 100, fmt: function (v) { return f1(v) + '%'; }, best: 'max' },
      { key: 'usd_per_success', t: 'USD per successful capsule', d: 'lower is better', max: 9, fmt: function (v) { return '$' + f2(v); }, best: 'min' },
      { key: 'minutes', t: 'Median session time', d: 'lower is better', max: 35, fmt: function (v) { return f1(v) + ' min'; }, best: 'min' }
    ];
    var animate = !reduced();
    var wrap = H('div', { class: 'res-core' + (animate ? ' pre' : '') });
    var grid = H('div', { class: 'res-core-grid' });
    METRICS.forEach(function (M) {
      var vals = O.map(function (o) { return o[M.key]; });
      var bestV = M.best === 'max' ? Math.max.apply(null, vals) : Math.min.apply(null, vals);
      var panel = H('div', { class: 'res-metric', role: 'group', 'aria-label': M.t + ', ' + M.d });
      panel.appendChild(H('div', { class: 'res-mh' }, [H('span', { class: 'res-mt', text: M.t }), H('span', { class: 'res-md', text: M.d })]));
      O.forEach(function (o) {
        var v = o[M.key], best = v === bestV;
        var bar = H('i', { class: CLS[o.handoff] });
        bar.style.setProperty('--w', (Math.min(100, v / M.max * 100)).toFixed(2) + '%');
        panel.appendChild(H('div', { class: 'res-mrow' }, [
          H('span', { class: 'res-mlab', text: o.handoff }),
          H('span', { class: 'res-mtrack', 'aria-hidden': 'true' }, [bar]),
          H('span', { class: 'res-mval' + (best ? ' best' : ''), text: M.fmt(v) })
        ]));
      });
      grid.appendChild(panel);
    });
    wrap.appendChild(grid);

    /* success by area: bar-in-cell table; best per area in bold (ties both bold) */
    var low = H('div', { class: 'res-core-low' });
    var areaBox = H('div', { class: 'res-area' });
    areaBox.appendChild(H('div', { class: 'res-area-h' }, [H('span', { class: 'res-mt', text: 'Success by area' }), H('span', { class: 'res-md', text: 'capsules in parentheses' })]));
    var tbl = H('table', { class: 'res-area-tbl' });
    tbl.appendChild(H('caption', { class: 'sr-only', text: 'Capsule success (%) by area for each handoff; parentheses give capsule counts.' }));
    var thead = H('thead'), hr = H('tr', null, [H('th', { scope: 'col', html: '<span class="sr-only">Handoff</span>' })]);
    CB.areas.forEach(function (a) { hr.appendChild(H('th', { scope: 'col', title: a.area, text: a.short + ' (' + a.n + ')' })); });
    thead.appendChild(hr); tbl.appendChild(thead);
    var tb = H('tbody');
    var bests = CB.areas.map(function (a) { return Math.max(a.Raw, a.VERITAS, a.RRA); });
    ['Raw', 'VERITAS', 'RRA'].forEach(function (hname) {
      var tr = H('tr', { class: CLS[hname] }, [H('th', { scope: 'row', text: hname })]);
      CB.areas.forEach(function (a, i) {
        var v = a[hname], best = v === bests[i];
        var bar = H('i', { class: CLS[hname] });
        bar.style.setProperty('--w', v.toFixed(2) + '%');
        tr.appendChild(H('td', null, [
          H('span', { class: 'res-cv' + (best ? ' best' : '') + (hname === 'RRA' ? ' rra' : ''), text: f1(v) }),
          H('span', { class: 'res-cbar', 'aria-hidden': 'true' }, [bar])
        ]));
      });
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
    areaBox.appendChild(tbl);
    low.appendChild(areaBox);
    var take = card.querySelector('.res-take');
    if (take) low.appendChild(take);
    wrap.appendChild(low);
    host.appendChild(wrap);
    if (animate) requestAnimationFrame(function () { requestAnimationFrame(function () { wrap.classList.remove('pre'); }); });
  }

  /* ================================================================ 5 · reuse break-even */
  function initReuse(card) {
    var host = card.querySelector('[data-chart]'), segEl = card.querySelector('[data-seg]'), ro = card.querySelector('[data-readout]');
    if (!host || !segEl || !D.cost || !D.cost.break_even) return;
    var MAIN = byModel(D.main), BUILD = D.cost.construction_usd, BE = {};
    D.cost.break_even.forEach(function (b) { BE[b.model] = b; });
    var order = D.cost.break_even.map(function (b) { return b.model; });
    var NMAX = 15;
    var yTop = 0;
    order.forEach(function (m) {
      var a = MAIN[m].api_usd;
      yTop = Math.max(yTop, NMAX * a.raw, BUILD + NMAX * a.rra);
    });
    yTop = Math.ceil(yTop / 5000) * 5000 + (yTop % 5000 === 0 ? 5000 : 0);
    var current = order[0], W = 0, geo = null, cur = null, stop = null, hoverN = null;
    var svg = S('svg', { class: 'res-reuse', focusable: 'false' }, host);
    var gGrid = S('g', { class: 'grid' }, svg), gReg = S('g', null, svg), gAxis = S('g', { 'aria-hidden': 'true' }, svg);
    var regPre = S('path', { class: 'res-reg pre' }, gReg), regPost = S('path', { class: 'res-reg post' }, gReg);
    var lineRaw = S('path', { class: 'res-line raw' }, svg), lineRra = S('path', { class: 'res-line rra' }, svg);
    var beLine = S('line', { class: 'res-be-line' }, svg);
    var cross = S('circle', { class: 'res-cross', r: 4.5 }, svg);
    var endRaw = S('circle', { class: 'mk-raw', r: R_RAW }, svg), endRra = S('circle', { class: 'mk-rra', r: R_RRA }, svg);
    var startRra = S('circle', { class: 'mk-rra', r: 4.5 }, svg);
    var xh = S('line', { class: 'res-xh' }, svg);
    var xhRaw = S('circle', { class: 'mk-raw res-xh-dot', r: 5 }, svg), xhRra = S('circle', { class: 'mk-rra res-xh-dot', r: 5.5 }, svg);
    var beTag = S('g', { class: 'res-be-tag', 'aria-hidden': 'true' }, svg), beRect = S('rect', { rx: 10, height: 20, y: -10 }, beTag),
        beText = S('text', { 'text-anchor': 'middle', dy: '0.35em' }, beTag);
    var hit = S('rect', { class: 'res-hit-plot', tabindex: '0', role: 'slider', 'aria-orientation': 'horizontal',
      'aria-valuemin': '0', 'aria-valuemax': String(NMAX), 'aria-label': 'Reuse rounds: read cumulative API spending (construction + Reproducer)' }, svg);
    if (ro) { ro.id = ro.id || 'results-reuse-readout'; hit.setAttribute('aria-describedby', ro.id); }
    var ring = S('rect', { class: 'res-plot-ring', rx: 8 }, svg);

    function stateFor(m) {
      var a = MAIN[m].api_usd, b = BE[m];
      return { cr: a.raw, ca: a.rra, ns: b.rounds, nc: b.continuous };
    }
    function layout() {
      var narrow = W < 600;
      var g = { narrow: narrow };
      g.l = narrow ? 46 : 62; g.r = narrow ? 10 : 18; g.t = narrow ? 48 : 32; g.b = narrow ? 46 : 48;
      g.H = narrow ? 304 : 342;
      g.sx = C.linear(0, NMAX, g.l, W - g.r);
      g.sy = C.linear(0, yTop, g.H - g.b, g.t);
      geo = g;
      gGrid.textContent = ''; gAxis.textContent = '';
      set(svg, { width: W, height: g.H, viewBox: '0 0 ' + W + ' ' + g.H });
      for (var v = 0; v <= yTop; v += 10000) {
        var y = g.sy(v);
        S('line', { x1: g.l, x2: W - g.r, y1: y, y2: y }, gGrid);
        var tg = S('g', { class: 'tick' }, gAxis);
        S('text', { x: g.l - 10, y: y, dy: '0.35em', 'text-anchor': 'end', text: v ? '$' + (v / 1000) + 'K' : '$0' }, tg);
      }
      var by = g.H - g.b;
      S('line', { class: 'res-axis-line', x1: g.l, x2: W - g.r, y1: by, y2: by }, gAxis);
      for (var n = 0; n <= NMAX; n++) {
        var x = g.sx(n), major = !narrow || n % 5 === 0;
        S('line', { class: 'res-axis-line', x1: x, x2: x, y1: by, y2: by + (major ? 5 : 3) }, gAxis);
        if (major) { var tt = S('g', { class: 'tick' }, gAxis); S('text', { x: x, y: by + 19, 'text-anchor': 'middle', text: String(n) }, tt); }
      }
      S('text', { class: 'res-axis-t', x: (g.l + W - g.r) / 2, y: g.H - 6, 'text-anchor': 'middle', text: 'Reuse rounds (each repeats all ' + NPAPERS + ' papers)' }, gAxis);
      S('text', { class: 'res-axis-t', x: g.l - 10, y: 12, 'text-anchor': 'start', text: 'Cumulative API USD' }, gAxis);
      /* the construction cost marks the refined line's start on the y axis */
      var yb = g.sy(BUILD);
      S('line', { class: 'res-anno-tick', x1: g.l - 5, x2: g.l, y1: yb, y2: yb }, gAxis);
      S('text', { class: 'res-anno', x: g.l - 10, y: yb, dy: '0.35em', 'text-anchor': 'end', style: { fill: 'var(--rra-ink)', 'font-weight': '650' }, text: usd(BUILD) }, gAxis);
      set(hit, { x: g.l, y: g.t, width: W - g.r - g.l, height: g.H - g.b - g.t });
      set(ring, { x: g.l - 4, y: g.t - 4, width: W - g.r - g.l + 8, height: g.H - g.b - g.t + 8 });
    }
    function P(n, v) { return geo.sx(n).toFixed(2) + ',' + geo.sy(v).toFixed(2); }
    function paint(s) {
      var rawEnd = NMAX * s.cr, rraEnd = BUILD + NMAX * s.ca, yc = s.nc * s.cr;
      lineRaw.setAttribute('d', 'M' + P(0, 0) + 'L' + P(NMAX, rawEnd));
      lineRra.setAttribute('d', 'M' + P(0, BUILD) + 'L' + P(NMAX, rraEnd));
      regPre.setAttribute('d', 'M' + P(0, 0) + 'L' + P(s.nc, yc) + 'L' + P(0, BUILD) + 'Z');
      regPost.setAttribute('d', 'M' + P(s.nc, yc) + 'L' + P(NMAX, rawEnd) + 'L' + P(NMAX, rraEnd) + 'Z');
      set(endRaw, { cx: geo.sx(NMAX), cy: geo.sy(rawEnd) }); set(endRra, { cx: geo.sx(NMAX), cy: geo.sy(rraEnd) });
      set(startRra, { cx: geo.sx(0), cy: geo.sy(BUILD) });
      set(cross, { cx: geo.sx(s.nc), cy: geo.sy(yc) });
      var bx = geo.sx(s.ns);
      set(beLine, { x1: bx, x2: bx, y1: geo.t + 2, y2: geo.H - geo.b });
      var tw = Math.ceil(textW(beText.textContent, 'res-be-m')) + 20;
      var tx = clamp(bx, geo.l + tw / 2, W - 2 - tw / 2);
      beTag.setAttribute('transform', 'translate(' + tx.toFixed(2) + ',' + (geo.t - 8) + ')');
      set(beRect, { x: -tw / 2, width: tw });
      if (hoverN !== null) placeCross(hoverN, s);
    }
    function placeCross(n, s) {
      s = s || cur;
      var x = geo.sx(n);
      set(xh, { x1: x, x2: x, y1: geo.t, y2: geo.H - geo.b });
      set(xhRaw, { cx: x, cy: geo.sy(n * s.cr) }); set(xhRra, { cx: x, cy: geo.sy(BUILD + n * s.ca) });
    }
    function tipAt(n) {
      var a = MAIN[current].api_usd, raw = n * a.raw, rra = BUILD + n * a.rra, b = BE[current];
      return tipHTML(name(current) + ' · after ' + n + (n === 1 ? ' round' : ' rounds'), [
        { k: 'raw', l: 'Raw code', v: usd(raw) }, { k: 'rra', l: 'Refined artifact', v: usd(rra) }, { l: 'Refined − Raw', v: signedUsd(rra - raw) }
      ], 'Scenario totals: n × the mean round cost, plus ' + usd(BUILD) + ' construction for the refined artifact. Break-even after ' + b.rounds + ' complete rounds (crossover ' + f2(b.continuous) + ').');
    }
    function setHover(n, viaKey) {
      hoverN = n;
      svg.classList.toggle('is-hot', n !== null);
      if (n === null) { C.tip.hide(); return; }
      placeCross(n);
      var a = MAIN[current].api_usd;
      hit.setAttribute('aria-valuenow', String(n));
      hit.setAttribute('aria-valuetext', 'After ' + n + (n === 1 ? ' round' : ' rounds') + ': raw code ' + usd(n * a.raw) + ', refined artifact ' + usd(BUILD + n * a.rra) + ' (scenario totals)');
      if (viaKey) {
        var r = svg.getBoundingClientRect();
        var sc = r.width / W;
        C.tip.show(tipAt(n), r.left + geo.sx(n) * sc, r.top + geo.sy(BUILD + n * MAIN[current].api_usd.rra) * sc - 30);
      }
    }
    hit.addEventListener('pointermove', function (e) {
      var r = svg.getBoundingClientRect(), sc = W / r.width;
      var n = clamp(Math.round(geo.sx.invert((e.clientX - r.left) * sc)), 0, NMAX);
      setHover(n, false);
      C.tip.show(tipAt(n), e.clientX, e.clientY);
    });
    hit.addEventListener('pointerleave', function () { setHover(null); });
    hit.addEventListener('focus', function () { setHover(hoverN === null ? BE[current].rounds : hoverN, true); });
    hit.addEventListener('blur', function () { setHover(null); });
    hit.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
      if (e.key === 'Home') { e.preventDefault(); setHover(0, true); return; }
      if (e.key === 'End') { e.preventDefault(); setHover(NMAX, true); return; }
      if (!d) return;
      e.preventDefault();
      setHover(clamp((hoverN === null ? BE[current].rounds : hoverN) + d, 0, NMAX), true);
    });

    function readout() {
      if (!ro) return;
      var a = MAIN[current].api_usd, b = BE[current];
      ro.textContent = '';
      [
        { k: 'Raw code / round', v: usd(a.raw), c: 'raw' },
        { k: 'Refined / round', v: usd(a.rra), c: 'rra' },
        { k: 'Saving / round', v: usd(b.saving_per_round) },
        { k: 'Break-even', v: b.rounds + ' rounds', s: 'crossover ' + f2(b.continuous) }
      ].forEach(function (it) {
        ro.appendChild(H('div', { class: 'res-ro' }, [
          H('span', { class: 'res-ro-k', text: it.k }),
          H('span', { class: 'res-ro-v' + (it.c ? ' ' + it.c : '') }, [it.v, it.s ? H('small', { text: it.s }) : null])
        ]));
      });
    }
    function aria() {
      var b = BE[current];
      if (hit.getAttribute('aria-valuenow') === null) hit.setAttribute('aria-valuenow', String(b.rounds));
      hit.setAttribute('aria-label', name(current) + ', reuse rounds: use the arrow keys to read cumulative API spending (construction + Reproducer) by round.');
    }
    function apply(m, animate) {
      current = m;
      var b = BE[m];
      beText.textContent = 'Break-even · ' + b.rounds + ' rounds';
      readout(); aria();
      var target = stateFor(m);
      if (stop) { stop(); stop = null; }
      if (!cur || !animate) { cur = target; paint(cur); return; }
      var from = cur;
      stop = tween(420, function (t) { cur = mix(from, target, t); paint(cur); }, function () { stop = null; cur = target; paint(cur); });
      if (hoverN !== null && document.activeElement === hit) setTimeout(function () { setHover(hoverN, true); }, reduced() ? 0 : 440);
    }
    function resize(w) { W = Math.round(w); if (!W) return; layout(); if (cur) paint(cur); }
    C.seg(segEl, order.map(function (m) { return { value: m, label: name(m) }; }), current, function (v) { apply(v, true); }, 'Reproducer model for the break-even scenario');
    resize(host.clientWidth);
    apply(current, false);
    C.onResize(host, resize);
    relayouts.push(function () { resize(host.clientWidth); });
  }

  /* ================================================================ lazy init */
  var MODS = { 'results-gain': initGain, 'results-spend': initSpend, 'results-ablation': initAblation, 'results-core': initCore, 'results-reuse': initReuse };
  Object.keys(MODS).forEach(function (id) {
    var card = document.getElementById(id);
    if (!card) return;
    var run = function () { try { MODS[id](card); } catch (e) { if (window.console) console.error('results:', id, e); } };
    if (RB && RB.whenNear) RB.whenNear(card, run, '400px 0px'); else run();
  });
})();
