/* ============================================================
   QuickScale Media — interactions (vanilla, no dependencies)
   Progressive enhancement: every page is usable without JS;
   this script upgrades nav, carousel, stat count-up, FAQ,
   the process switcher, and the lead form.
   ============================================================ */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var HEADER_OFFSET = 84;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---- Mobile nav drawer ---- */
  var toggle = $('.navtoggle');
  var drawer = $('#drawer');
  if (toggle && drawer) {
    toggle.addEventListener('click', function () {
      var open = drawer.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    drawer.addEventListener('click', function (e) {
      if (e.target.closest('a, .btn')) {
        drawer.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---- Smooth scroll to the embedded form (#book) with header offset ---- */
  function scrollToBook() {
    var el = $('#book');
    if (!el) return false;
    var y = el.getBoundingClientRect().top + window.pageYOffset - HEADER_OFFSET;
    window.scrollTo({ top: Math.max(0, y), behavior: reduce ? 'auto' : 'smooth' });
    return true;
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href$="#book"]');
    if (a && $('#book')) {
      e.preventDefault();
      scrollToBook();
      if (history.replaceState) history.replaceState(null, '', '#book');
    }
  });
  if (location.hash === '#book') {
    window.addEventListener('load', function () { setTimeout(scrollToBook, 60); });
  }

  /* ---- Testimonials carousel ---- */
  var carousel = $('[data-carousel]');
  if (carousel) {
    var slides = $$('.tslide', carousel);
    var dots = $$('.tdot', carousel);
    var idx = 0, timer = null;
    function show(i) {
      idx = (i + slides.length) % slides.length;
      slides.forEach(function (s, n) { s.classList.toggle('is-active', n === idx); });
      dots.forEach(function (d, n) { d.setAttribute('aria-current', n === idx ? 'true' : 'false'); });
    }
    function start() { if (reduce) return; stop(); timer = setInterval(function () { show(idx + 1); }, 5500); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    var nextBtn = $('[data-next]', carousel), prevBtn = $('[data-prev]', carousel);
    if (nextBtn) nextBtn.addEventListener('click', function () { show(idx + 1); start(); });
    if (prevBtn) prevBtn.addEventListener('click', function () { show(idx - 1); start(); });
    dots.forEach(function (d, n) { d.addEventListener('click', function () { show(n); start(); }); });
    carousel.addEventListener('mouseenter', stop);
    carousel.addEventListener('mouseleave', start);
    show(0); start();
  }

  /* ---- Animated stat count-up (replays when scrolled into view) ---- */
  var statEls = $$('[data-count]');
  if (statEls.length) {
    function fmt(el, val) {
      var n = Math.round(val);
      var num = el.getAttribute('data-comma') === '1' ? n.toLocaleString('en-US') : String(n);
      return (el.getAttribute('data-prefix') || '') + num + (el.getAttribute('data-suffix') || '');
    }
    function animate(el) {
      var target = parseFloat(el.getAttribute('data-count'));
      if (reduce) { el.textContent = fmt(el, target); return; }
      var dur = 1100, t0 = null, ease = function (x) { return 1 - Math.pow(1 - x, 3); };
      (function tick(now) {
        if (t0 === null) t0 = now;
        var p = Math.min(1, (now - t0) / dur);
        el.textContent = fmt(el, target * ease(p));
        if (p < 1) requestAnimationFrame(tick);
      })(performance.now());
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) animate(en.target);
          else if (!reduce) en.target.textContent = fmt(en.target, 0);
        });
      }, { threshold: 0.35 });
      statEls.forEach(function (el) { io.observe(el); });
    } else {
      statEls.forEach(function (el) { animate(el); });
    }
  }

  /* ---- FAQ accordion (one open at a time) ---- */
  var faqQs = $$('.faq__q');
  if (faqQs.length) {
    faqQs.forEach(function (q) {
      q.addEventListener('click', function () {
        var expanded = q.getAttribute('aria-expanded') === 'true';
        faqQs.forEach(function (o) { o.setAttribute('aria-expanded', 'false'); });
        q.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      });
    });
  }

  /* ---- Process step switcher ---- */
  var steps = $$('.step'), panels = $$('.steppanel');
  if (steps.length && panels.length) {
    steps.forEach(function (step) {
      step.addEventListener('click', function () {
        var i = step.getAttribute('data-step');
        steps.forEach(function (s) { s.setAttribute('aria-current', s === step ? 'step' : 'false'); });
        panels.forEach(function (p) { p.classList.toggle('is-active', p.getAttribute('data-panel') === i); });
      });
    });
  }

  /* ---- Lead form: validation + success state ---- */
  $$('form[data-leadform]').forEach(function (form) {
    var key = form.getAttribute('data-leadform');
    var success = $('[data-success="' + key + '"]');
    var consent = $('.consent', form);
    if (consent) {
      consent.addEventListener('click', function () {
        consent.setAttribute('aria-pressed', consent.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      });
    }
    function setError(name, msg) {
      var input = form.querySelector('[name="' + name + '"]');
      var err = form.querySelector('[data-error="' + name + '"]');
      if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (err) err.textContent = msg || '';
    }
    $$('.input', form).forEach(function (inp) {
      inp.addEventListener('input', function () { setError(inp.getAttribute('name'), ''); });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = function (n) { return form[n] ? form[n].value : ''; };
      var ok = true;
      if (!v('fullName').trim()) { setError('fullName', 'Please enter your name'); ok = false; }
      if (!v('business').trim()) { setError('business', 'Tell us your business name'); ok = false; }
      if (((v('phone').match(/\d/g) || []).length) < 10) { setError('phone', 'Enter a valid phone number'); ok = false; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('email'))) { setError('email', 'Enter a valid email address'); ok = false; }
      if (!ok) { var first = form.querySelector('[aria-invalid="true"]'); if (first) first.focus(); return; }

      /* Static demo (GitHub Pages has no backend). To make this live, POST the
         fields to a handler — e.g. Formspree, your CRM webhook, or a serverless
         function — and also fire the Meta Pixel "Lead" event here. */
      if (success) {
        form.hidden = true;
        success.hidden = false;
        var y = success.getBoundingClientRect().top + window.pageYOffset - HEADER_OFFSET;
        window.scrollTo({ top: Math.max(0, y), behavior: reduce ? 'auto' : 'smooth' });
      }
    });
    if (success) {
      var resetBtn = $('[data-reset]', success);
      if (resetBtn) {
        resetBtn.addEventListener('click', function () {
          form.reset();
          if (consent) consent.setAttribute('aria-pressed', 'false');
          $$('.input', form).forEach(function (i) { i.setAttribute('aria-invalid', 'false'); });
          $$('[data-error]', form).forEach(function (er) { er.textContent = ''; });
          success.hidden = true;
          form.hidden = false;
        });
      }
    }
  });

  /* ---- Footer year ---- */
  var yearEl = $('[data-year]');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
