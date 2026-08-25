/* Flixxy — Cyanotype Plates
   Two jobs: the card tilt, and letting each section develop once.
   The theme is chosen inline in <head> so it lands before first paint. */

(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('has-js');

  /* ── tilt ──────────────────────────────────────────────
     The point under the cursor sits deeper in the screen, so the card
     leans away from the hand rather than toward it. rotateX is negated
     against the vertical axis because CSS +Y runs downward. */

  (function tilt() {
    if (reduced) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    var cards = document.querySelectorAll('.project-card, .skill-card, .price-card, .plate');

    Array.prototype.forEach.call(cards, function (card) {
      // per-card state: a shared frame id would let one card's pending
      // update swallow another's
      var frame = null, lastX = 0, lastY = 0, inside = false;
      // the plate is far larger, so the same angle would read as a lurch
      var MAX = card.classList.contains('plate') ? 2.6 : 5;

      function apply() {
        frame = null;
        // the pointer can leave between the move and this frame; without
        // this the reset below gets overwritten and the card stays tilted
        if (!inside) return;

        var b = card.getBoundingClientRect();
        if (!b.width || !b.height) return;
        var nx = (lastX - b.left) / b.width;    // 0 left -> 1 right
        var ny = (lastY - b.top) / b.height;    // 0 top  -> 1 bottom

        card.style.setProperty('--ry', ((nx - 0.5) * 2 * MAX).toFixed(2) + 'deg');
        card.style.setProperty('--rx', (-(ny - 0.5) * 2 * MAX).toFixed(2) + 'deg');
        card.style.setProperty('--mx', (nx * 100).toFixed(1) + '%');
        card.style.setProperty('--my', (ny * 100).toFixed(1) + '%');
      }

      function reset() {
        inside = false;
        if (frame) { cancelAnimationFrame(frame); frame = null; }
        card.classList.remove('is-tilting');    // settle on the slow ease
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
      }

      card.addEventListener('pointerenter', function () {
        inside = true;
        card.classList.add('is-tilting');
      });

      card.addEventListener('pointermove', function (e) {
        lastX = e.clientX; lastY = e.clientY;
        if (!frame) frame = requestAnimationFrame(apply);
      });

      card.addEventListener('pointerleave', reset);
      card.addEventListener('pointercancel', reset);
    });

    // a pointer that leaves the window entirely fires no pointerleave on
    // some paths, so flatten anything still tilted
    document.addEventListener('pointerleave', function () {
      Array.prototype.forEach.call(cards, function (c) {
        c.classList.remove('is-tilting');
        c.style.setProperty('--rx', '0deg');
        c.style.setProperty('--ry', '0deg');
      });
    });
  }());

  /* ── developing ────────────────────────────────────────
     Each section resolves out of blur once, then is left alone. */
  var blocks = document.querySelectorAll('.hidden');

  if (reduced || !('IntersectionObserver' in window)) {
    Array.prototype.forEach.call(blocks, function (el) { el.classList.add('show'); });
    return;
  }

  var obs = new IntersectionObserver(function (entries, self) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('show');
      self.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });

  Array.prototype.forEach.call(blocks, function (el) { obs.observe(el); });
}());
