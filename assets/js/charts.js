/* RBCharts: small shared helpers for the page's inline SVG charts (no dependencies).
 *   RBCharts.svg(tag, attrs, parent)     create an SVG element      RBCharts.h(tag, attrs, children) HTML element
 *   RBCharts.linear(d0, d1, r0, r1)      linear scale (+ .ticks(n), .invert(px))
 *   RBCharts.band(keys, r0, r1, pad)     band scale (+ .bw, .center(k))
 *   RBCharts.css('--rra')                read a CSS custom property (theme-aware)
 *   RBCharts.tip.show(html, x, y) / .showFor(el, html) / .hide()   the single floating tooltip
 *   RBCharts.seg(container, items, value, onChange, label)        segmented control (radiogroup, roving tabindex)
 *   RBCharts.onResize(el, fn) / RBCharts.onTheme(fn)              re-render hooks
 *   RBCharts.fmt.{num, pct, pp, usd, fix}                           number formatting
 * Charts re-render on 'rb:themechange' when they paint colours from CSS variables; most charts instead use
 * CSS classes (mk-raw, mk-rra, val, ...) so they follow the theme automatically. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';

  function attrs(el, a) {
    if (!a) return el;
    Object.keys(a).forEach(function (k) {
      var v = a[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'class') el.setAttribute('class', v);
      else if (k === 'style' && typeof v === 'object') Object.keys(v).forEach(function (s) { el.style.setProperty(s, v[s]); });
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    return el;
  }
  function svg(tag, a, parent) {
    var el = attrs(document.createElementNS(NS, tag), a);
    if (parent) parent.appendChild(el);
    return el;
  }
  function h(tag, a, children) {
    var el = attrs(document.createElement(tag), a);
    (children || []).forEach(function (c) { if (c === null || c === undefined) return; el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }

  function linear(d0, d1, r0, r1) {
    var f = function (v) { return r0 + (v - d0) / (d1 - d0) * (r1 - r0); };
    f.invert = function (p) { return d0 + (p - r0) / (r1 - r0) * (d1 - d0); };
    f.domain = [d0, d1]; f.range = [r0, r1];
    f.ticks = function (n) {
      var span = d1 - d0, step = Math.pow(10, Math.floor(Math.log10(span / (n || 5)))), err = (n || 5) / span * step;
      if (err <= 0.15) step *= 10; else if (err <= 0.35) step *= 5; else if (err <= 0.75) step *= 2;
      var out = [], v = Math.ceil(d0 / step) * step;
      for (; v <= d1 + step * 1e-9; v += step) out.push(Math.round(v / step) * step);
      return out;
    };
    return f;
  }
  function band(keys, r0, r1, pad) {
    pad = pad === undefined ? 0.2 : pad;
    var n = keys.length, step = (r1 - r0) / Math.max(1, n), bw = step * (1 - pad);
    var f = function (k) { return r0 + keys.indexOf(k) * step + (step - bw) / 2; };
    f.bw = bw; f.step = step;
    f.center = function (k) { return f(k) + bw / 2; };
    return f;
  }
  function css(name, el) { return getComputedStyle(el || document.documentElement).getPropertyValue(name).trim(); }

  /* ---------------------------------------------------------------- tooltip */
  var tipEl = null, tipAnchor = null, tipHtml = '';
  function tipNode() { return tipEl || (tipEl = document.getElementById('rb-tip')); }
  var tip = {
    show: function (html, x, y) {
      var t = tipNode(); if (!t) return;
      tipHtml = html;
      t.innerHTML = html; t.hidden = false;
      var w = t.offsetWidth, hgt = t.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
      var left = x + 14, top = y + 14;
      if (left + w > vw - 8) left = x - w - 14;
      if (left < 8) left = 8;
      if (top + hgt > vh - 8) top = y - hgt - 14;
      if (top < 8) top = 8;
      t.style.left = left + 'px'; t.style.top = top + 'px';
    },
    /* position next to an element (keyboard focus) */
    showFor: function (el, html) {
      var r = el.getBoundingClientRect();
      tip.show(html, r.right, r.top + r.height / 2 - 20);
      tipAnchor = el;
    },
    hide: function () { var t = tipNode(); if (t) t.hidden = true; tipAnchor = null; }
  };
  /* pointer tooltips hide on scroll; a keyboard-focus tooltip follows its element (focus often scrolls it into view) */
  var tipRaf = 0;
  window.addEventListener('scroll', function () {
    if (tipAnchor && document.activeElement === tipAnchor) {
      if (!tipRaf) tipRaf = requestAnimationFrame(function () {
        tipRaf = 0;
        if (tipAnchor && document.activeElement === tipAnchor) { var a = tipAnchor; tip.showFor(a, tipHtml); }
      });
      return;
    }
    tip.hide();
  }, { passive: true });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') tip.hide(); });

  /* bind hover + focus tooltips to an element; html may be a function */
  function bindTip(el, html) {
    var get = typeof html === 'function' ? html : function () { return html; };
    el.addEventListener('pointermove', function (e) { tipAnchor = null; tip.show(get(), e.clientX, e.clientY); });
    el.addEventListener('pointerleave', tip.hide);
    el.addEventListener('focus', function () { tip.showFor(el, get()); });
    el.addEventListener('blur', tip.hide);
  }

  /* ---------------------------------------------------------------- segmented control */
  function seg(container, items, value, onChange, label) {
    container.innerHTML = '';
    container.classList.add('seg');
    container.setAttribute('role', 'radiogroup');
    if (label) container.setAttribute('aria-label', label);
    var btns = items.map(function (it) {
      var b = h('button', { type: 'button', role: 'radio', 'data-value': it.value, text: it.label });
      if (it.title) b.title = it.title;
      container.appendChild(b);
      return b;
    });
    function select(v, focus, fire) {
      btns.forEach(function (b) {
        var on = b.getAttribute('data-value') === String(v);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
        if (on && focus) b.focus();
      });
      if (fire) onChange(v);
    }
    btns.forEach(function (b, i) {
      b.addEventListener('click', function () { select(b.getAttribute('data-value'), false, true); });
      b.addEventListener('keydown', function (e) {
        var d = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        var n = btns[(i + d + btns.length) % btns.length];
        select(n.getAttribute('data-value'), true, true);
      });
    });
    select(value, false, false);
    return { set: function (v) { select(v, false, true); } };
  }

  /* ---------------------------------------------------------------- resize + theme hooks */
  function onResize(el, fn) {
    var last = el.clientWidth, raf = 0;
    var run = function () {
      raf = 0;
      var w = el.clientWidth;
      if (Math.abs(w - last) < 2) return;
      last = w; fn(w);
    };
    if ('ResizeObserver' in window) new ResizeObserver(function () { if (!raf) raf = requestAnimationFrame(run); }).observe(el);
    else window.addEventListener('resize', function () { if (!raf) raf = requestAnimationFrame(run); });
  }
  function onTheme(fn) { document.addEventListener('rb:themechange', function (e) { fn(e.detail && e.detail.theme); }); }

  /* ---------------------------------------------------------------- formatting */
  var fmt = {
    num: function (v, d) { return Number(v).toLocaleString('en-US', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); },
    fix: function (v, d) { return Number(v).toFixed(d === undefined ? 1 : d); },
    pct: function (v, d) { return Number(v).toFixed(d === undefined ? 1 : d) + '%'; },
    pp: function (v, d) { var s = Number(v).toFixed(d === undefined ? 1 : d); return (v > 0 ? '+' : v < 0 ? '−' : '') + s.replace('-', '') + ' pp'; },
    usd: function (v, d) { return '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); },
    minus: function (s) { return String(s).replace(/-/g, '−'); }
  };

  function model(key) {
    var m = (window.RB_DATA && window.RB_DATA.models || []).filter(function (x) { return x.key === key; })[0];
    return m || { key: key, name: key, short: key };
  }

  window.RBCharts = { svg: svg, h: h, attrs: attrs, linear: linear, band: band, css: css, tip: tip, bindTip: bindTip, seg: seg,
                      onResize: onResize, onTheme: onTheme, fmt: fmt, model: model };
})();
