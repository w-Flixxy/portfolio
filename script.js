/* Flixxy — Cyanotype Plates
   Card tilt, motes drifting behind the page, staggered reveals, an
   exposure meter, figure parallax, receding sections, and a lightbox.
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

    var cards = document.querySelectorAll('.project-card, .skill-card, .price-card, .contact-card, .plate');

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

  /* ── suspended matter ──────────────────────────────────
     Motes in the emulsion. Each sits on one of three depth bands and
     parallaxes at its own rate, so scrolling gives the ground distance.
     The tint is read from the live theme, since the theme is random. */

  (function motes() {
    if (reduced) return;

    var cv = document.createElement('canvas');
    cv.className = 'motes';
    cv.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(cv, document.body.firstChild);

    var ctx = cv.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var w = 0, h = 0, span = 0, dots = [];

    var tint = getComputedStyle(document.documentElement)
                 .getPropertyValue('--glow-pale').trim() || 'rgba(150,205,240,.42)';

    function build() {
      w = window.innerWidth; h = window.innerHeight;
      if (!w || !h) return;
      span = h * 1.8;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      cv.style.width = w + 'px'; cv.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // density follows area, so a phone does not carry a desktop count
      var n = Math.round(Math.min(150, Math.max(40, (w * h) / 15000)));
      dots = [];
      for (var i = 0; i < n; i++) {
        var depth = 0.25 + Math.random() * 0.75;        // 0 far, 1 near
        dots.push({
          x: Math.random() * w,
          y: Math.random() * span,
          r: 0.7 + depth * 3.1,
          depth: depth,
          drift: (Math.random() - 0.5) * 0.22,
          a: 0.14 + depth * 0.46
        });
      }
    }
    build();

    var rs;
    window.addEventListener('resize', function () {
      clearTimeout(rs); rs = setTimeout(build, 160);
    });

    var alive = true;
    document.addEventListener('visibilitychange', function () { alive = !document.hidden; });

    function frame() {
      requestAnimationFrame(frame);
      if (!alive) return;
      if (!w || !h || w !== window.innerWidth || h !== window.innerHeight) build();
      if (!w || !h) return;

      var sy = window.scrollY || window.pageYOffset || 0;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = tint;

      for (var i = 0; i < dots.length; i++) {
        var d = dots[i];
        d.x += d.drift;
        if (d.x < -6) d.x = w + 6; else if (d.x > w + 6) d.x = -6;

        // nearer motes travel further against the scroll
        var y = d.y - sy * d.depth * 0.62;
        y = ((y % span) + span) % span;                 // wrap, never blank
        if (y > h + 8) continue;

        ctx.globalAlpha = d.a;
        ctx.beginPath();
        ctx.arc(d.x, y, d.r, 0, 6.2832);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    requestAnimationFrame(frame);
  }());

  /* ── the plate drifts ──────────────────────────────────
     Slower than the page, which gives the header depth. It is written to
     a custom property so it composes with the tilt instead of fighting it. */
  (function drift() {
    if (reduced) return;
    var plate = document.querySelector('.plate');
    if (!plate) return;
    var pending = false;

    window.addEventListener('scroll', function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        var sy = window.scrollY || 0;
        var d = sy < 900 ? sy * 0.22 : 198;             // stops once it is gone
        plate.style.setProperty('--drift', d.toFixed(1) + 'px');
      });
    }, { passive: true });
  }());

  /* ── scroll-linked passes ──────────────────────────────
     One rAF-throttled reader for three effects, so the page measures
     itself once per frame rather than three times. */

  (function scrollFx() {
    if (reduced) return;

    var bar = document.createElement('div');
    bar.className = 'exposure';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);

    var figs = document.querySelectorAll('.image-wrapper img');
    var sections = document.querySelectorAll('section');
    Array.prototype.forEach.call(sections, function (sec) { sec.dataset.exit = ''; });

    var pending = false;

    function update() {
      pending = false;
      var vh = window.innerHeight;
      var sy = window.scrollY || window.pageYOffset || 0;
      var max = document.documentElement.scrollHeight - vh;

      bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, sy / max) : 0) + ')';

      // the specimen lags the mount that carries it
      for (var i = 0; i < figs.length; i++) {
        var img = figs[i];
        var r = img.parentNode.getBoundingClientRect();
        if (r.bottom < -120 || r.top > vh + 120) continue;      // off screen, skip
        var mid = (r.top + r.height / 2 - vh / 2) / vh;         // -1 .. 1
        img.style.setProperty('--py', (mid * -22).toFixed(1) + 'px');
      }

      // once a section has cleared the top it recedes instead of just leaving
      for (var j = 0; j < sections.length; j++) {
        var sec = sections[j];
        // never touch one that has not developed in yet, or the inline value
        // would override the reveal transition
        if (sec.classList.contains('hidden') && !sec.classList.contains('show')) continue;

        var b = sec.getBoundingClientRect();
        var zone = vh * 0.45;
        var t = b.bottom < zone ? Math.min(1, (zone - b.bottom) / zone) : 0;
        sec.style.setProperty('--exit-o', (1 - t * 0.62).toFixed(3));
        sec.style.setProperty('--exit-y', (t * -26).toFixed(1) + 'px');
      }
    }

    window.addEventListener('scroll', function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(update);
    }, { passive: true });

    window.addEventListener('resize', function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(update);
    }, { passive: true });

    update();
  }());

  /* ── lightbox ──────────────────────────────────────────
     Figures open full size. Focus returns to whichever figure opened it. */

  (function lightbox() {
    var shots = document.querySelectorAll('.image-wrapper img');
    if (!shots.length) return;

    var lb = document.createElement('div');
    lb.className = 'lb';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Enlarged figure');
    lb.dataset.open = 'false';
    lb.innerHTML =
      '<button class="lb__close" type="button" aria-label="Close">\u00d7</button>' +
      '<div class="lb__frame">' +
        '<p class="lb__cap"><b></b><span></span></p>' +
      '</div>';
    document.body.appendChild(lb);

    var frame = lb.querySelector('.lb__frame');

    // built here and only inserted once it has a real source: an <img>
    // parked in the DOM with no src is a broken-image box waiting to paint
    var img = document.createElement('img');
    img.className = 'lb__img';
    img.alt = '';
    var capName = lb.querySelector('.lb__cap b');
    var capFig = lb.querySelector('.lb__cap span');
    var closeBtn = lb.querySelector('.lb__close');
    var opener = null;

    function open(el) {
      opener = el;
      img.src = el.currentSrc || el.src;
      img.alt = el.alt || '';
      if (!img.parentNode) frame.insertBefore(img, frame.firstChild);
      capName.textContent = el.alt || '';
      var wrap = el.closest('.image-wrapper');
      capFig.textContent = wrap && wrap.dataset.fig ? 'Fig. ' + wrap.dataset.fig : '';
      lb.dataset.open = 'true';
      document.body.style.overflow = 'hidden';
      closeBtn.focus();
    }

    function close() {
      lb.dataset.open = 'false';
      document.body.style.overflow = '';
      if (opener) { opener.focus(); opener = null; }
    }

    Array.prototype.forEach.call(shots, function (el) {
      // the figure becomes a real control, so it is reachable by keyboard
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', 'Enlarge: ' + (el.alt || 'figure'));

      el.addEventListener('click', function () { open(el); });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(el); }
      });
    });

    closeBtn.addEventListener('click', close);
    lb.addEventListener('click', function (e) {
      if (e.target === lb || e.target.classList.contains('lb__frame')) close();
    });
    document.addEventListener('keydown', function (e) {
      if (lb.dataset.open !== 'true') return;
      if (e.key === 'Escape') close();
      // only one control inside, so keep focus on it
      if (e.key === 'Tab') { e.preventDefault(); closeBtn.focus(); }
    });
  }());

  /* ── developing ────────────────────────────────────────
     Each section resolves out of blur once, then is left alone. */
  // each card learns its position in the row, for the staggered arrival
  Array.prototype.forEach.call(
    document.querySelectorAll('.project-grid, .skills-grid, .services-grid'),
    function (grid) {
      Array.prototype.forEach.call(grid.children, function (kid, i) {
        kid.style.setProperty('--i', i);
      });
    });

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
