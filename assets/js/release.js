/* Release (#release): polish for the BibTeX copy button. site.js performs the copy for every [data-copy] button
 * and flips its .copy-label to "Copied" (or "Press Ctrl+C") for 1.6 s; this script mirrors that state as a
 * check icon and announces it to screen readers. It also restores the original label before each click, so a
 * second click inside the 1.6 s window cannot leave the label stuck on "Copied". */
(function () {
  'use strict';
  var sec = document.getElementById('release');
  if (!sec) return;
  var btn = sec.querySelector('.copy-btn[data-copy]');
  var label = btn && btn.querySelector('.copy-label');
  if (!btn || !label) return;
  var status = document.getElementById('rel-copy-status');
  var idle = label.textContent;

  /* runs before site.js's document-level click handler reads the label */
  btn.addEventListener('click', function () {
    if (label.textContent !== idle) label.textContent = idle;
  });

  var clearTimer = 0;
  function sync() {
    var t = label.textContent;
    var ok = t === 'Copied', err = t !== idle && !ok;
    btn.classList.toggle('is-ok', ok);
    btn.classList.toggle('is-err', err);
    if (status && (ok || err)) {
      status.textContent = ok ? 'BibTeX citation copied to the clipboard.' : 'Copy failed. Select the citation and press Ctrl+C.';
      clearTimeout(clearTimer);
      clearTimer = setTimeout(function () { status.textContent = ''; }, 2400);
    }
  }
  if ('MutationObserver' in window) {
    new MutationObserver(sync).observe(label, { childList: true, characterData: true, subtree: true });
  }
})();
