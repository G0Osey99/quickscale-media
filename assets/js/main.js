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
  var CFG = window.QS_CONFIG || {};

  /* ---- Lead-source attribution (first-touch, persisted across pages) ---- */
  var ATTRIBUTION = (function () {
    try {
      var KEY = 'qs_attribution';
      var saved = JSON.parse(sessionStorage.getItem(KEY) || 'null');
      if (saved) return saved;
      var q = new URLSearchParams(location.search), g = function (k) { return q.get(k) || ''; };
      var attr = {
        utm_source: g('utm_source'), utm_medium: g('utm_medium'), utm_campaign: g('utm_campaign'),
        utm_term: g('utm_term'), utm_content: g('utm_content'),
        fbclid: g('fbclid'), gclid: g('gclid'), msclkid: g('msclkid'),
        referrer: document.referrer || '', landingPage: location.pathname + location.search
      };
      sessionStorage.setItem(KEY, JSON.stringify(attr));
      return attr;
    } catch (e) { return {}; }
  })();

  /* ---- Analytics: load ONLY if public IDs are configured (off in demo) ---- */
  (function initAnalytics() {
    if (CFG.metaPixelId) {
      !function (f, b, e, v, n, t, s) {
        if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
        if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
        t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
      }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      window.fbq('init', CFG.metaPixelId); window.fbq('track', 'PageView');
    }
    if (CFG.ga4MeasurementId) {
      var s = document.createElement('script'); s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(CFG.ga4MeasurementId);
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date()); window.gtag('config', CFG.ga4MeasurementId);
    }
  })();

  function fireLeadAnalytics(eventId) {
    try { if (window.fbq) window.fbq('track', 'Lead', {}, { eventID: eventId }); } catch (e) {}
    try { if (window.gtag) window.gtag('event', 'generate_lead'); } catch (e) {}
  }

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

  /* ---- Cloudflare Turnstile: renders only when a public site key is configured ---- */
  var TS_SITEKEY = CFG.turnstileSiteKey || '';
  var tsWidgets = {};
  function tsRenderAll() {
    if (!TS_SITEKEY || !window.turnstile) return;
    $$('[data-turnstile]').forEach(function (slot) {
      if (slot.getAttribute('data-rendered')) return;
      var f = slot.closest('form[data-leadform]');
      if (!f) return;
      slot.hidden = false;
      slot.style.margin = '4px 0 16px';
      tsWidgets[f.getAttribute('data-leadform')] = window.turnstile.render(slot, { sitekey: TS_SITEKEY });
      slot.setAttribute('data-rendered', '1');
    });
  }
  if (TS_SITEKEY) {
    window.qsTurnstileOnload = tsRenderAll;
    var tsScript = document.createElement('script');
    tsScript.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=qsTurnstileOnload';
    tsScript.async = true; tsScript.defer = true;
    document.head.appendChild(tsScript);
  }
  function tsToken(key) {
    if (!TS_SITEKEY || !window.turnstile) return null;     // not configured -> not enforced
    var id = tsWidgets[key];
    return id != null ? (window.turnstile.getResponse(id) || '') : '';
  }
  function tsReset(key) {
    if (TS_SITEKEY && window.turnstile && tsWidgets[key] != null) {
      try { window.turnstile.reset(tsWidgets[key]); } catch (e) {}
    }
  }

  /* ---- Lead form: validation, anti-spam, submit (live or demo) ---- */
  $$('form[data-leadform]').forEach(function (form) {
    var key = form.getAttribute('data-leadform');
    var success = $('[data-success="' + key + '"]');
    var submitBtn = form.querySelector('[type="submit"]');
    var startedAt = Date.now();

    function setError(name, msg) {
      var input = form.querySelector('[name="' + name + '"]');
      var err = form.querySelector('[data-error="' + name + '"]');
      if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (err) err.textContent = msg || '';
    }
    function formError(msg) { var box = $('[data-form-error]', form); if (box) box.textContent = msg || ''; }
    $$('.input', form).forEach(function (inp) {
      inp.addEventListener('input', function () { setError(inp.getAttribute('name'), ''); formError(''); });
    });

    function showSuccess() {
      if (!success) return;
      form.hidden = true; success.hidden = false;
      var y = success.getBoundingClientRect().top + window.pageYOffset - HEADER_OFFSET;
      window.scrollTo({ top: Math.max(0, y), behavior: reduce ? 'auto' : 'smooth' });
    }
    function setBusy(on) {
      if (!submitBtn) return;
      submitBtn.disabled = on;
      if (on) { submitBtn.dataset.label = submitBtn.dataset.label || submitBtn.textContent; submitBtn.textContent = 'Sending…'; }
      else if (submitBtn.dataset.label) { submitBtn.textContent = submitBtn.dataset.label; }
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      formError('');
      var v = function (n) { return form[n] ? String(form[n].value) : ''; };

      // Honeypot + timing trap: silently accept bots without sending.
      var hp = form.querySelector('[name="company_website"]');
      var tooFast = (Date.now() - startedAt) / 1000 < (CFG.minFormSeconds || 3);
      if ((hp && hp.value) || tooFast) { showSuccess(); return; }

      var ok = true;
      if (!v('fullName').trim()) { setError('fullName', 'Please enter your name'); ok = false; }
      if (!v('business').trim()) { setError('business', 'Tell us your business name'); ok = false; }
      if (((v('phone').match(/\d/g) || []).length) < 10) { setError('phone', 'Enter a valid phone number'); ok = false; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('email'))) { setError('email', 'Enter a valid email address'); ok = false; }
      if (!ok) { var first = form.querySelector('[aria-invalid="true"]'); if (first) first.focus(); return; }

      // Cloudflare Turnstile (enforced only when a site key is configured).
      var tToken = tsToken(key);
      if (tToken === '') { formError('Please complete the “I’m human” check, then submit again.'); return; }

      var consentEl = form.querySelector('[name="smsConsent"]');
      var consentTextEl = $('.consent__text', form);
      var consented = !!(consentEl && consentEl.checked);
      var payload = {
        fullName: v('fullName').trim(),
        business: v('business').trim(),
        phone: v('phone').trim(),
        email: v('email').trim().toLowerCase(),
        smsConsent: consented,
        consentText: consented && consentTextEl ? consentTextEl.textContent.trim() : '',
        sourcePage: key,
        pageUrl: location.href,
        attribution: ATTRIBUTION,
        submittedAt: new Date().toISOString(),
        turnstileToken: tToken || '',
        eventId: 'lead-' + Date.now() + '-' + Math.round(Math.random() * 1e6)
      };

      // DEMO mode (no backend configured): show success without sending.
      if (!CFG.live || !CFG.leadEndpoint) { fireLeadAnalytics(payload.eventId); showSuccess(); return; }

      // LIVE mode: POST to the Supabase Edge Function (see config.js / PROVISION.md).
      setBusy(true);
      fetch(CFG.leadEndpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      }).then(function (r) {
        if (!r.ok) throw new Error('status ' + r.status);
        return r.json().catch(function () { return {}; });
      }).then(function () {
        fireLeadAnalytics(payload.eventId); showSuccess();
      }).catch(function () {
        setBusy(false);
        tsReset(key);
        formError('Sorry — something went wrong sending your request. Please try again, or call us at the number below.');
      });
    });

    if (success) {
      var resetBtn = $('[data-reset]', success);
      if (resetBtn) {
        resetBtn.addEventListener('click', function () {
          form.reset();
          $$('.input', form).forEach(function (i) { i.setAttribute('aria-invalid', 'false'); });
          $$('[data-error]', form).forEach(function (er) { er.textContent = ''; });
          formError(''); setBusy(false); tsReset(key);
          success.hidden = true; form.hidden = false;
          startedAt = Date.now();
        });
      }
    }
  });

  /* ---- Footer year ---- */
  var yearEl = $('[data-year]');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
