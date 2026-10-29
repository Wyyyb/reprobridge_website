/* Engage (#engage): anonymous page views and likes via the free Abacus counting API (CORS, no cookies, no keys).
 *   views: one hit per browser session, sent on load so readers who never scroll this far still count
 *   likes: every tap is one hit; taps are queued and sent one by one (Abacus allows 30 requests / 10 s per IP),
 *          while the display and the burst respond instantly
 *   live:  while the band is on screen, a Server-Sent Events stream shows other readers' likes as they happen
 * Counting happens only on wyyyb.github.io; anywhere else (local previews) a separate dev counter is used.
 * Add ?nocount to the URL, or set localStorage rb-nocount=1, to read the counts without adding a view. */
(function () {
  'use strict';
  var sec = document.getElementById('engage');
  if (!sec || !window.fetch) return;
  var RB = window.RB || { reduced: function () { return false; }, whenNear: function (el, fn) { fn(); } };

  var API = 'https://abacus.jasoncameron.dev';
  var PROD = location.hostname === 'wyyyb.github.io';
  var NS = PROD ? 'wyyyb.github.io' : 'reprobridge-website-dev';
  var K_VIEWS = PROD ? 'reprobridge_website-views' : 'views';
  var K_LIKES = PROD ? 'reprobridge_website-likes' : 'likes';
  var store = {
    get: function (s, k) { try { return window[s].getItem(k); } catch (e) { return null; } },
    set: function (s, k, v) { try { window[s].setItem(k, v); } catch (e) { /* private mode */ } }
  };
  var noCount = /[?&]nocount\b/.test(location.search) || store.get('localStorage', 'rb-nocount') === '1';

  var viewsEl = document.getElementById('eg-views');
  var likesEl = document.getElementById('eg-likes');
  var btn = sec.querySelector('.eg-like');
  var comboEl = sec.querySelector('.eg-combo');
  var youEl = sec.querySelector('.eg-you');
  var liveEl = sec.querySelector('.eg-live');
  var fmt = function (n) { return Number(n).toLocaleString('en-US'); };

  function call(path) {
    var ctl = 'AbortController' in window ? new AbortController() : null;
    var t = ctl ? setTimeout(function () { ctl.abort(); }, 9000) : 0;
    return fetch(API + path, { cache: 'no-store', signal: ctl ? ctl.signal : undefined }).then(function (r) {
      clearTimeout(t);
      if (r.status === 404) return { value: 0 };
      if (r.status === 429) {
        var ra = Number(r.headers.get('Retry-After')) || 2000;
        var e = new Error('rate'); e.retry = ra < 100 ? ra * 1000 : ra; throw e;
      }
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    });
  }

  /* number display: a short count-up the first time a value appears, a bump when it changes later */
  function show(el, v, animate) {
    if (!el) return;
    var to = Number(v), had = el.getAttribute('data-v');
    el.setAttribute('data-v', String(to));
    if (had === null) {
      if (animate && !RB.reduced() && to > 0) countUp(el, to); else el.textContent = fmt(to);
      return;
    }
    if (Number(had) === to) return;
    el.textContent = fmt(to);
    if (!RB.reduced()) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  }
  function countUp(el, b) {
    var t0 = 0, dur = Math.min(1200, 500 + 120 * Math.log(b + 1));
    function f(ts) {
      if (!t0) t0 = ts;
      var k = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - k, 3), cur = Number(el.getAttribute('data-v'));
      if (cur !== b || k >= 1) { el.textContent = fmt(cur); return; }   // a newer value arrived, or done
      el.textContent = fmt(Math.round(b * e));
      requestAnimationFrame(f);
    }
    requestAnimationFrame(f);
  }

  /* ---------------------------------------------------------------- views */
  var views = null, bandSeen = false;
  function loadViews() {
    var counted = store.get('sessionStorage', 'rb-viewed') === '1';
    var p = !noCount && !counted ? call('/hit/' + NS + '/' + K_VIEWS) : call('/get/' + NS + '/' + K_VIEWS);
    p.then(function (d) {
      if (!noCount && !counted) store.set('sessionStorage', 'rb-viewed', '1');
      views = d.value;
      if (bandSeen) show(viewsEl, views, true);
    }).catch(function () { setTimeout(function () { if (views === null) loadViews(); }, 12000); });
  }
  var startViews = function () { setTimeout(loadViews, 1200); };
  if (document.readyState === 'complete') startViews(); else window.addEventListener('load', startViews);

  /* ---------------------------------------------------------------- likes */
  var known = null, pending = 0, inflight = 0, sending = false, fails = 0, myLikes = Number(store.get('localStorage', 'rb-my-likes')) || 0;
  var MAX_PENDING = 60, GAP = 400;
  function shown() { return (known || 0) + pending + inflight; }
  function paintLikes(animate) { if (known !== null) show(likesEl, shown(), animate); }
  function loadLikes() {
    call('/get/' + NS + '/' + K_LIKES).then(function (d) { known = Math.max(known || 0, d.value); paintLikes(true); })
      .catch(function () { setTimeout(function () { if (known === null) loadLikes(); }, 12000); });
  }
  function pump() {
    if (sending || pending <= 0) return;
    sending = true; pending--; inflight++;
    call('/hit/' + NS + '/' + K_LIKES).then(function (d) {
      inflight--; fails = 0; known = Math.max(known || 0, d.value); paintLikes(false);
      setTimeout(function () { sending = false; pump(); }, GAP);
    }).catch(function (e) {
      inflight--; pending++;          // keep the tap and retry
      var rate = e && e.retry;
      if (!rate) fails++;
      // a rate limit just waits; a failing service backs off and, after five failures, waits for the next tap
      if (fails >= 5) { sending = false; return; }
      setTimeout(function () { sending = false; pump(); }, rate ? e.retry + 200 : 3000 * fails);
    });
  }

  /* ---------------------------------------------------------------- live stream of everyone's likes */
  var es = null, esRetry = 0, visible = false;
  function openStream() {
    if (es || !('EventSource' in window) || document.hidden || !visible) return;
    try { es = new EventSource(API + '/stream/' + NS + '/' + K_LIKES); } catch (e) { es = null; return; }
    es.onopen = function () { if (liveEl) liveEl.hidden = false; };
    es.onmessage = function (ev) {
      var v; try { v = JSON.parse(ev.data).value; } catch (e) { return; }
      if (typeof v !== 'number') return;
      if (known !== null) {
        var others = v - known - inflight;          // increments that are not our own taps in flight
        if (others > 0) remoteBurst(Math.min(others, 6));
      }
      known = Math.max(known || 0, v); paintLikes(true);
    };
    es.onerror = function () { closeStream(); clearTimeout(esRetry); esRetry = setTimeout(openStream, 30000); };
  }
  function closeStream() { if (es) { es.close(); es = null; } if (liveEl) liveEl.hidden = true; }
  document.addEventListener('visibilitychange', function () { if (document.hidden) closeStream(); else openStream(); });

  /* ---------------------------------------------------------------- particles: a live-stream style gift burst */
  var fx = null;
  function layer() {
    if (!fx) { fx = document.createElement('div'); fx.className = 'eg-fx'; fx.setAttribute('aria-hidden', 'true'); document.body.appendChild(fx); }
    return fx;
  }
  var ICONS = {
    heart: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 20.7S3.5 15.6 3.5 9.3A4.8 4.8 0 0 1 12 6.4a4.8 4.8 0 0 1 8.5 2.9c0 6.3-8.5 11.4-8.5 11.4z"/></svg>',
    thumb: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M2.5 10.5h3.6v10H2.5zM8 20.5V10.4l4.1-6.9c.4-.7 1.3-.9 2-.5.6.4.9 1.1.7 1.8l-1 4.2h5.9c1.4 0 2.4 1.3 2.1 2.7l-1.5 6.9a2.4 2.4 0 0 1-2.3 1.9z"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z"/></svg>',
    sparkle: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2c.6 4.6 2.9 7.4 8 8-5.1.6-7.4 3.4-8 8-.6-4.6-2.9-7.4-8-8 5.1-.6 7.4-3.4 8-8z"/><circle cx="19" cy="4.5" r="1.6" fill="currentColor"/><circle cx="5" cy="19" r="1.2" fill="currentColor"/></svg>',
    bridge: '<svg viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="currentColor"/><path d="M6 21Q16 6 26 21" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M4.5 21.4h23" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M11 15.6v5.6M16 13.7v7.5M21 15.6v5.6" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".8"/></svg>'
  };
  var KINDS = [
    ['heart', '#E8486B', 5], ['heart', '#FF6F91', 3], ['heart', '#2F8F6B', 2], ['thumb', '#2F8F6B', 3], ['thumb', '#5C84C8', 2],
    ['star', '#F2B33D', 3], ['sparkle', '#9B7BE0', 2], ['sparkle', '#F2B33D', 1], ['bridge', '#2C7360', 1]
  ];
  var KW = KINDS.reduce(function (s, k) { return s + k[2]; }, 0);
  function pick() { var r = Math.random() * KW; for (var i = 0; i < KINDS.length; i++) { r -= KINDS[i][2]; if (r <= 0) return KINDS[i]; } return KINDS[0]; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function particle(x, y, o) {
    var L = layer();
    if (L.childElementCount > 110) L.removeChild(L.firstChild);
    var k = o.kind || pick();
    var el = document.createElement('div');
    el.className = 'eg-p' + (o.cls ? ' ' + o.cls : '');
    el.style.cssText = '--x:' + x + 'px;--y:' + y + 'px;--sz:' + (o.sz || Math.round(rnd(22, 40))) + 'px;--dx:' + (o.dx !== undefined ? o.dx : rnd(-95, 95)).toFixed(0) +
      'px;--dy:' + (o.dy !== undefined ? o.dy : -rnd(200, 400)).toFixed(0) + 'px;--r:' + rnd(-40, 40).toFixed(0) + 'deg;--s:' + (o.s || rnd(.75, 1.25)).toFixed(2) +
      ';--d:' + (o.d || rnd(1.35, 2.3)).toFixed(2) + 's;--w:' + rnd(4, 14).toFixed(0) + 'px;color:' + k[1];
    el.innerHTML = '<span>' + ICONS[k[0]] + '</span>';
    el.addEventListener('animationend', function (e) { if (e.target === el) el.remove(); });
    L.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.remove(); }, 4000);
  }
  function floatText(cls, text, x, y) {
    var el = document.createElement('div');
    el.className = cls; el.textContent = text; el.style.cssText = '--x:' + x + 'px;--y:' + y + 'px';
    el.addEventListener('animationend', function () { el.remove(); });
    layer().appendChild(el);
    setTimeout(function () { if (el.parentNode) el.remove(); }, 3000);
  }
  function center(el) { var r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  function burst(n) {
    var c = center(btn), red = RB.reduced();
    for (var i = 0; i < (red ? 1 : n); i++) particle(c.x + rnd(-14, 14), c.y - 10, {});
    if (likesEl) { var t = center(likesEl); floatText('eg-plus', '+1', t.x, t.y - 18); }
  }
  function bigGift(count) {
    var c = center(btn);
    particle(c.x, c.y - 20, { kind: ['heart', '#E8486B'], cls: 'big', sz: 64, s: 1.6, d: 1.9, dx: 0, dy: -200 });
    if (!RB.reduced()) {
      for (var i = 0; i < 12; i++) {
        var a = i / 12 * Math.PI * 2, dist = rnd(110, 170);
        particle(c.x, c.y, { cls: 'burst', dx: Math.cos(a) * dist, dy: Math.sin(a) * dist - 40, d: rnd(1, 1.5), sz: Math.round(rnd(18, 28)) });
      }
    }
    floatText('eg-banner', '×' + count + ' combo!', c.x, c.y - 150);
  }
  function remoteBurst(n) {
    if (!likesEl || RB.reduced()) return;
    var t = center(likesEl);
    for (var i = 0; i < n; i++) (function (j) { setTimeout(function () { particle(t.x + rnd(-10, 10), t.y, { cls: 'remote', sz: Math.round(rnd(16, 24)), dy: -rnd(120, 220), dx: rnd(-40, 40) }); }, j * 140); })(i);
  }

  /* ---------------------------------------------------------------- the like button */
  var combo = 0, comboT = 0, youT = 0;
  function tapFx() {
    btn.classList.add('used');
    btn.classList.remove('tap'); void btn.offsetWidth; btn.classList.add('tap');
  }
  if (btn) btn.addEventListener('click', function () {
    tapFx();
    combo++;
    clearTimeout(comboT);
    comboT = setTimeout(function () { combo = 0; if (comboEl) comboEl.classList.remove('on'); }, 1500);
    if (comboEl && combo > 1) { comboEl.textContent = '×' + combo; comboEl.classList.add('on'); comboEl.classList.remove('bump'); void comboEl.offsetWidth; comboEl.classList.add('bump'); }
    if (combo % 10 === 0) bigGift(combo); else burst(Math.round(rnd(3, 5)));
    myLikes++; store.set('localStorage', 'rb-my-likes', String(myLikes));
    if (pending + inflight < MAX_PENDING) pending++;
    if (fails >= 5) fails = 4;        // a new tap gives a failing service one more try
    if (known === null) known = Number(likesEl && likesEl.getAttribute('data-v')) || 0;
    paintLikes(false);
    pump();
    clearTimeout(youT);
    youT = setTimeout(function () { if (youEl) youEl.textContent = 'You have sent ' + fmt(myLikes) + (myLikes === 1 ? ' like' : ' likes') + '. Thank you!'; }, 350);
  });
  if (youEl && myLikes > 0) youEl.textContent = 'You have sent ' + fmt(myLikes) + (myLikes === 1 ? ' like' : ' likes') + '. Thank you!';

  /* ---------------------------------------------------------------- show counts when the band comes near */
  RB.whenNear(sec, function () {
    bandSeen = true;
    if (views !== null) show(viewsEl, views, true);
    loadLikes();
  }, '400px 0px');
  /* open the live stream only once the band has stayed on screen for a moment (not while scrolling past) */
  var openT = 0;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es2) {
      visible = es2[0].isIntersecting;
      clearTimeout(openT);
      if (visible) openT = setTimeout(openStream, 1200); else closeStream();
    }, { threshold: 0.25 }).observe(sec);
  }
})();
