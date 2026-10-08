/* Runs before first paint (blocking, ~150 bytes).
   Marks the page as scripted so the reveal fades can start hidden without a flash, and arms a
   failsafe: if main.js hasn't started within 4s, reveal everything instead of leaving it hidden. */
(function (d) {
  var h = d.documentElement;
  h.classList.add('js');
  window.__ahrBoot = setTimeout(function () { h.classList.add('reveal-fallback'); }, 4000);
})(document);
