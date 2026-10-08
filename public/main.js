/* Always Hungry Records — site behaviour. No dependencies.
 *
 *   1. Watcher  the pinned cat head flips to paper wherever a [data-head-dark] element is behind it.
 *   2. Menu     full-screen menu for phone / tablet.
 *   3. Reveals  quick, subtle fades (skipped for prefers-reduced-motion).
 */
(function () {
  'use strict';

  clearTimeout(window.__ahrBoot);          // main.js started: cancel boot.js's reveal failsafe
  var doc = document;
  var root = doc.documentElement;
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ------------------------------------------------------------------ 1. Watcher
   * The head is two stacked copies of the same drawing: ink, and paper clipped to nothing.
   * Each frame we work out which horizontal bands of the head overlap a dark element and clip the
   * paper copy to exactly those bands, so the colour changes along the section's edge, line for
   * line, with no fade.
   *
   * Re-measured on scroll, resize, orientation / visual-viewport changes, font loads, and whenever
   * the page, the head or a dark element changes size (ResizeObserver), so a late font swap or
   * reflow can't leave the clip stale. Elements that aren't rendered (the closed menu) are ignored,
   * and several dark elements may overlap the head at once. */
  (function watcher() {
    var head = doc.querySelector('.watcher');
    var paper = head && head.querySelector('.watcher__paper');
    if (!paper) return;

    var HIDDEN = 'inset(100% 0 0 0)';
    var last = '';
    var queued = false;

    function n(v) { return +v.toFixed(3); }

    function update() {
      queued = false;

      var dpr = window.devicePixelRatio || 1;
      var snap = function (v) { return Math.round(v * dpr) / dpr; };   // where the browser paints an edge

      var r = head.getBoundingClientRect();
      var H = r.height, W = r.width;

      var bands = [];
      var dark = doc.querySelectorAll('[data-head-dark]');
      for (var i = 0; i < dark.length; i++) {
        if (!dark[i].getClientRects().length) continue;                // display:none / [hidden]
        var d = dark[i].getBoundingClientRect();
        var top = Math.max(0, snap(d.top) - r.top);
        var bottom = Math.min(H, snap(d.bottom) - r.top);
        if (bottom > top) bands.push([top, bottom]);
      }

      bands.sort(function (a, b) { return a[0] - b[0]; });
      var merged = [];
      for (var j = 0; j < bands.length; j++) {
        var m = merged[merged.length - 1];
        if (m && bands[j][0] <= m[1]) m[1] = Math.max(m[1], bands[j][1]);
        else merged.push([bands[j][0], bands[j][1]]);
      }

      var clip;
      if (!merged.length) {
        clip = HIDDEN;
      } else if (merged.length === 1) {
        clip = 'inset(' + n(merged[0][0]) + 'px 0 ' + n(H - merged[0][1]) + 'px 0)';
      } else {
        clip = 'path("' + merged.map(function (b) {
          return 'M0 ' + n(b[0]) + 'H' + n(W) + 'V' + n(b[1]) + 'H0Z';
        }).join('') + '")';
      }

      if (clip !== last) {
        paper.style.clipPath = clip;
        last = clip;
      }
    }

    function schedule() {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(update);
    }

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    window.addEventListener('pageshow', schedule);          // back/forward cache restores
    window.addEventListener('load', schedule);
    window.addEventListener('ahr:layout', schedule);        // the menu opening/closing
    if (window.visualViewport) window.visualViewport.addEventListener('resize', schedule);

    if (doc.fonts) {
      if (doc.fonts.ready) doc.fonts.ready.then(schedule);
      if (doc.fonts.addEventListener) doc.fonts.addEventListener('loadingdone', schedule);
    }

    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(schedule);
      ro.observe(doc.body);
      ro.observe(head);
      var watched = doc.querySelectorAll('[data-head-dark]');
      for (var k = 0; k < watched.length; k++) ro.observe(watched[k]);
    }

    update();
  })();

  /* ------------------------------------------------------------------ 2. Menu */
  (function menu() {
    var btn = doc.querySelector('.menu-btn');
    var panel = doc.getElementById('menu');
    if (!btn || !panel) return;

    var closeBtn = panel.querySelector('.menu__close');
    var desktop = window.matchMedia('(min-width: 1024px)');
    var returnTo = btn;                    // always back to the Menu button (Safari doesn't focus buttons on click)

    function focusables() { return Array.prototype.slice.call(panel.querySelectorAll('a[href], button')); }
    function announce() { window.dispatchEvent(new Event('ahr:layout')); }

    function open() {
      if (!panel.hidden) return;
      panel.hidden = false;
      root.classList.add('menu-open');
      btn.setAttribute('aria-expanded', 'true');
      var first = panel.querySelector('.menu__nav a') || closeBtn;
      if (first) first.focus({ preventScroll: true });
      announce();
    }

    function close(restoreFocus) {
      if (panel.hidden) return;
      panel.hidden = true;
      root.classList.remove('menu-open');
      btn.setAttribute('aria-expanded', 'false');
      if (restoreFocus && returnTo && returnTo.focus) returnTo.focus({ preventScroll: true });
      announce();
    }

    btn.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', function () { close(true); });

    // Following a link closes the menu first, then the browser performs the (smooth) jump.
    panel.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (a) close(false);
    });

    doc.addEventListener('keydown', function (e) {
      if (panel.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
      if (e.key !== 'Tab') return;
      var f = focusables();
      if (!f.length) return;
      var first = f[0], lastEl = f[f.length - 1];
      if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && doc.activeElement === lastEl) { e.preventDefault(); first.focus(); }
    });

    var onBreakpoint = function (e) { if (e.matches) close(false); };
    if (desktop.addEventListener) desktop.addEventListener('change', onBreakpoint);
    else if (desktop.addListener) desktop.addListener(onBreakpoint);
  })();

  /* ------------------------------------------------------------------ 3. Reveals */
  (function reveals() {
    var items = doc.querySelectorAll('.reveal');
    if (!items.length) return;

    var show = function (el) { el.classList.add('is-in'); };

    if (reduceMotion || !('IntersectionObserver' in window)) {
      for (var i = 0; i < items.length; i++) show(items[i]);
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      for (var j = 0; j < entries.length; j++) {
        if (entries[j].isIntersecting) { show(entries[j].target); io.unobserve(entries[j].target); }
      }
    }, { rootMargin: '0px 0px -6% 0px' });

    for (var k = 0; k < items.length; k++) io.observe(items[k]);
  })();
})();
