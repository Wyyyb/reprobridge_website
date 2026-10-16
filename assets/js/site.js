/* ReproBridge site shell: theme, nav + rail scrollspy, reveal-on-scroll, copy buttons, figure lightbox,
 * and a tiny event bus (window.RB) for cross-section links. Section scripts read RB_DATA and RBCharts. */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  var mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  /* ---------------------------------------------------------------- event bus */
  var handlers = {};
  var RB = window.RB = {
    reduced: function () { return !!mqReduce.matches; },
    theme: function () { return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; },
    on: function (evt, fn) { (handlers[evt] = handlers[evt] || []).push(fn); },
    emit: function (evt, detail) { (handlers[evt] || []).slice().forEach(function (fn) { try { fn(detail); } catch (e) { console.error(e); } }); },
    /* run fn once when el first comes near the viewport (lazy init for heavy modules) */
    whenNear: function (el, fn, margin) {
      if (!el) return;
      if (!('IntersectionObserver' in window)) { fn(); return; }
      var io = new IntersectionObserver(function (es) {
        if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); fn(); }
      }, { rootMargin: margin || '600px 0px' });
      io.observe(el);
    }
  };

  /* ---------------------------------------------------------------- theme */
  function setTheme(t, persist) {
    root.setAttribute('data-theme', t);
    var m = doc.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', t === 'dark' ? '#0D1418' : '#FFFFFF');
    if (persist) { try { localStorage.setItem('rb-theme', t); } catch (e) {} }
    doc.querySelectorAll('.theme-toggle').forEach(function (b) {
      b.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
      b.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
    });
    doc.dispatchEvent(new CustomEvent('rb:themechange', { detail: { theme: t } }));
    RB.emit('theme', t);
  }
  doc.querySelectorAll('.theme-toggle').forEach(function (b) {
    b.addEventListener('click', function () { setTheme(RB.theme() === 'dark' ? 'light' : 'dark', true); });
  });
  setTheme(RB.theme(), false);

  /* ---------------------------------------------------------------- nav state */
  var nav = doc.querySelector('nav.top');
  var rail = doc.querySelector('.rail');
  var hero = doc.getElementById('top');
  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    if (nav) nav.classList.toggle('scrolled', y > 8);
    if (rail && hero) rail.classList.toggle('show', y > hero.offsetHeight * 0.75);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* scrollspy: the section whose top has most recently passed the upper third of the viewport */
  var spyLinks = [].slice.call(doc.querySelectorAll('.nav-links a[href^="#"], .rail a[href^="#"]'));
  var spyIds = [];
  spyLinks.forEach(function (a) { var id = a.getAttribute('href').slice(1); if (id && spyIds.indexOf(id) < 0) spyIds.push(id); });
  var spySecs = spyIds.map(function (id) { return doc.getElementById(id); }).filter(Boolean);
  spySecs.sort(function (x, y) { return x.compareDocumentPosition(y) & 4 ? -1 : 1; });  /* document order */
  function spy() {
    var line = window.innerHeight * 0.33, cur = null;
    spySecs.forEach(function (s) { if (s.getBoundingClientRect().top <= line) cur = s.id; });
    spyLinks.forEach(function (a) {
      var on = a.getAttribute('href') === '#' + cur;
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
  }
  var spyRaf = 0;
  window.addEventListener('scroll', function () { if (!spyRaf) spyRaf = requestAnimationFrame(function () { spyRaf = 0; spy(); }); }, { passive: true });
  window.addEventListener('resize', spy);
  spy();

  /* ---------------------------------------------------------------- reveal on scroll */
  var reveals = [].slice.call(doc.querySelectorAll('[data-reveal]'));
  if (RB.reduced() || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('in'); });
  } else {
    var rio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); rio.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    reveals.forEach(function (el) { rio.observe(el); });
  }

  /* ---------------------------------------------------------------- copy buttons: <button class="copy-btn" data-copy="#target"> */
  doc.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('[data-copy]');
    if (!b) return;
    var t = doc.querySelector(b.getAttribute('data-copy'));
    if (!t) return;
    var text = t.innerText.replace(/\u00a0/g, ' ').trim();
    var label = b.querySelector('.copy-label');
    if (label && !label.hasAttribute('data-label')) label.setAttribute('data-label', label.textContent);
    function done(ok) {
      if (!label) return;
      label.textContent = ok ? 'Copied' : 'Press Ctrl+C';
      clearTimeout(b._rbCopyT);
      b._rbCopyT = setTimeout(function () { label.textContent = label.getAttribute('data-label'); }, 1600);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    else {
      var r = doc.createRange(); r.selectNodeContents(t); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      try { done(doc.execCommand('copy')); } catch (e) { done(false); }
    }
  });

  /* ---------------------------------------------------------------- lightbox: any [data-zoom="assets/img/fig/x-2400.webp"] (+ data-title) */
  var lb = doc.getElementById('rb-lightbox');
  if (lb && typeof lb.showModal === 'function') {
    var lbImg = lb.querySelector('img'), lbTitle = lb.querySelector('.lightbox-title'), lastFocus = null;
    doc.addEventListener('click', function (ev) {
      var z = ev.target.closest && ev.target.closest('[data-zoom]');
      if (!z) return;
      ev.preventDefault();
      lastFocus = z;
      lbImg.src = z.getAttribute('data-zoom');
      lbImg.alt = z.getAttribute('data-alt') || z.getAttribute('data-title') || '';
      lbTitle.textContent = z.getAttribute('data-title') || '';
      lb.showModal();
    });
    lb.addEventListener('click', function (ev) { if (ev.target === lb) lb.close(); });
    lb.addEventListener('close', function () { lbImg.removeAttribute('src'); if (lastFocus) lastFocus.focus(); });
  }

  /* ---------------------------------------------------------------- in-page links move focus for keyboard users */
  doc.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('a[href^="#"]');
    if (!a || a.getAttribute('href').length < 2) return;
    var t = doc.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
    if (!t) return;
    setTimeout(function () {
      if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
      t.focus({ preventScroll: true });
    }, RB.reduced() ? 0 : 450);
  });
})();
