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
        referrer: document.referrer || '', landingPage: location.pathname + location.search,
        landingAt: new Date().toISOString()
      };
      sessionStorage.setItem(KEY, JSON.stringify(attr));
      return attr;
    } catch (e) { return {}; }
  })();

  /* ---- Analytics: loaded only AFTER consent (see consentGate below) and only if
     public IDs are configured. Defined as a function so the consent gate controls it. ---- */
  var analyticsLoaded = false;
  function loadAnalytics() {
    if (analyticsLoaded) return; analyticsLoaded = true;
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
  }

  /* ---- Cookie/analytics consent: gate non-essential tags until the visitor chooses.
     Only appears when a Pixel/GA id is configured (nothing to consent to otherwise),
     and the choice is remembered in localStorage. ---- */
  (function consentGate() {
    if (!(CFG.metaPixelId || CFG.ga4MeasurementId)) return;   // no non-essential tags → nothing to gate
    var KEY = 'qs_consent', choice = null;
    try { choice = localStorage.getItem(KEY); } catch (e) {}
    if (choice === 'granted') { loadAnalytics(); return; }
    if (choice === 'denied') { return; }
    buildConsentBanner(function (granted) {
      try { localStorage.setItem(KEY, granted ? 'granted' : 'denied'); } catch (e) {}
      if (granted) loadAnalytics();
    });
  })();

  function buildConsentBanner(decide) {
    var bar = document.createElement('div');
    bar.className = 'qs-consent';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Cookie consent');
    var text = document.createElement('p');
    text.className = 'qs-consent__text';
    text.appendChild(document.createTextNode('We use cookies to measure site and ad performance. See our '));
    var link = document.createElement('a');
    // Relative path (matches every other internal link) so it works at a domain root OR a subpath.
    var fp = document.querySelector('.footer-legal a[href$="privacy/"]') || document.querySelector('a[href$="privacy/"]');
    link.setAttribute('href', fp ? fp.getAttribute('href') : 'privacy/');
    link.textContent = 'Privacy Policy';
    text.appendChild(link); text.appendChild(document.createTextNode('.'));
    var actions = document.createElement('div');
    actions.className = 'qs-consent__actions';
    var decline = document.createElement('button');
    decline.type = 'button'; decline.className = 'qs-consent__decline'; decline.textContent = 'Decline';
    var accept = document.createElement('button');
    accept.type = 'button'; accept.className = 'btn btn--primary'; accept.textContent = 'Accept';
    actions.appendChild(decline); actions.appendChild(accept);
    bar.appendChild(text); bar.appendChild(actions);
    function close(granted) { decide(granted); if (bar.parentNode) bar.parentNode.removeChild(bar); }
    accept.addEventListener('click', function () { close(true); });
    decline.addEventListener('click', function () { close(false); });
    document.body.appendChild(bar);
  }

  /* ---- Phone-tap conversion tracking (once per session per number, persisted in
     sessionStorage). Meta 'Contact' marks call intent (keeps 'Lead' for form submits);
     GA4 fires 'generate_lead'. ---- */
  function phoneAlreadyFired(num) {
    try {
      var k = 'qs_phone_fired';
      var set = JSON.parse(sessionStorage.getItem(k) || '[]');
      if (set.indexOf(num) !== -1) return true;
      set.push(num); sessionStorage.setItem(k, JSON.stringify(set));
      return false;
    } catch (e) { return false; }
  }
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href^="tel:"]') : null;
    if (!a) return;
    if (phoneAlreadyFired(a.getAttribute('href'))) return;
    try { if (window.fbq) window.fbq('track', 'Contact', { method: 'phone' }); } catch (e2) {}
    try { if (window.gtag) window.gtag('event', 'generate_lead', { method: 'phone' }); } catch (e2) {}
  });

  function fireLeadAnalytics(eventId) {
    try { if (window.fbq) window.fbq('track', 'Lead', {}, { eventID: eventId }); } catch (e) {}
    try { if (window.gtag) window.gtag('event', 'generate_lead'); } catch (e) {}
  }

  /* ---- Mobile nav drawer ---- */
  var toggle = $('.navtoggle');
  var drawer = $('#drawer');
  if (toggle && drawer) {
    function closeDrawer(focusToggle) {
      drawer.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      if (focusToggle) toggle.focus();
    }
    toggle.addEventListener('click', function () {
      var open = drawer.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) { var first = drawer.querySelector('a, .btn'); if (first) first.focus(); }
    });
    drawer.addEventListener('click', function (e) {
      if (e.target.closest('a, .btn')) closeDrawer(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) closeDrawer(true);
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
    carousel.addEventListener('focusin', stop);     // pause for keyboard users too
    carousel.addEventListener('focusout', start);
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
      if (!el.hasAttribute('data-count')) return;   // admin override removed it — leave the text as-is
      var target = parseFloat(el.getAttribute('data-count'));
      if (isNaN(target)) return;
      if (reduce) { el.textContent = fmt(el, target); return; }
      var dur = 1100, t0 = null, ease = function (x) { return 1 - Math.pow(1 - x, 3); };
      (function tick(now) {
        if (!el.hasAttribute('data-count')) return;   // admin override removed it mid-flight → stop
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
          else if (!reduce && en.target.hasAttribute('data-count')) en.target.textContent = fmt(en.target, 0);
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
        steps.forEach(function (s) { s.setAttribute('aria-selected', s === step ? 'true' : 'false'); });
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
      // Move focus into the confirmation so screen-reader users hear it (role="status" on the container).
      if (!success.hasAttribute('tabindex')) success.setAttribute('tabindex', '-1');
      try { success.focus({ preventScroll: true }); } catch (e) { success.focus(); }
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
        fbp: (document.cookie.match(/(?:^|;\s*)_fbp=([^;]+)/) || [])[1] || '',  // for Meta CAPI match quality
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

  /* ---- Site-data hydration: pull admin-managed media + content from Supabase ----
     Media fills [data-media-slot]; content overrides phone/email/social links. The static
     HTML stays the default (SEO-safe); this only enhances when the admin has published. ---- */
  (function hydrateSiteData() {
    if (!(CFG.supabaseUrl && CFG.supabaseAnonKey)) return;
    var base = String(CFG.supabaseUrl).replace(/\/+$/, '') + '/rest/v1/';
    var headers = { apikey: CFG.supabaseAnonKey, Authorization: 'Bearer ' + CFG.supabaseAnonKey };
    if ($('[data-media-slot]')) {
      fetch(base + 'media_slots?select=id,type,current,alt&current=not.is.null', { headers: headers })
        .then(function (r) { return r.ok ? r.json() : []; }).then(applyMedia).catch(function () {});
    }
    fetch(base + 'site_content?select=doc&id=eq.site', { headers: headers })
      .then(function (r) { return r.ok ? r.json() : []; }).then(function (rows) { if (rows[0] && rows[0].doc) applyContent(rows[0].doc); }).catch(function () {});
  })();
  function applyMedia(slots) {
    (slots || []).forEach(function (s) {
      if (!s.current) return;
      var host = $('[data-media-slot="' + s.id + '"]');
      if (!host) return;
      var badge = host.querySelector('.media__badge');
      while (host.firstChild) host.removeChild(host.firstChild);
      if (badge) host.appendChild(badge);
      var m;
      if (s.type === 'video') { m = document.createElement('video'); m.src = s.current; m.controls = true; m.preload = 'metadata'; m.setAttribute('playsinline', ''); }
      else { m = document.createElement('img'); m.src = s.current; m.alt = s.alt || ''; m.loading = 'lazy'; }
      m.style.cssText = 'width:100%;height:100%;object-fit:' + (s.aspect === 'free' ? 'contain' : 'cover') + ';display:block;border:0';
      host.classList.add('is-filled');
      host.appendChild(m);
    });
  }
  function cpath(o, p) { return p.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
  function applyContent(doc) {
    if (!doc) return;
    var b = doc.business || {}, soc = doc.social || {};
    if (b.phone) $$('a[href^="tel:"]').forEach(function (a) { a.setAttribute('href', 'tel:' + String(b.phone).replace(/[^0-9+]/g, '')); if (/\d/.test(a.textContent)) a.textContent = b.phone; });
    if (b.email) $$('a[href^="mailto:"]').forEach(function (a) { a.setAttribute('href', 'mailto:' + b.email); if (a.textContent.indexOf('@') >= 0) a.textContent = b.email; });
    if (soc.facebook) $$('a.social[aria-label*="Facebook"]').forEach(function (a) { a.setAttribute('href', soc.facebook); a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); });
    if (soc.instagram) $$('a.social[aria-label*="Instagram"]').forEach(function (a) { a.setAttribute('href', soc.instagram); a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); });

    // Hero + stats: plain-text override, ONLY when the stored value differs from the HTML default
    // (so the highlight span, the count-up, and the SEO copy survive until the admin actually edits).
    $$('[data-content]').forEach(function (node) {
      var val = cpath(doc, node.getAttribute('data-content'));
      if (val == null) return; val = String(val);
      if (!val.trim() || val.trim() === node.textContent.trim()) return;
      if (node.hasAttribute('data-count')) node.removeAttribute('data-count'); // stop the count-up from re-overwriting
      node.textContent = val;
    });

    // Testimonials: keep the carousel's nodes, just refresh the text (re-add quotes / bold company).
    var ts = doc.testimonials || [];
    $$('[data-tquote]').forEach(function (node) {
      var t = ts[+node.getAttribute('data-tquote')]; if (!t || !t.quote) return;
      var cur = node.textContent.replace(/^[\s"'“”]+|[\s"'“”]+$/g, '');
      if (cur === String(t.quote).trim()) return;
      node.textContent = '"' + t.quote + '"';
    });
    $$('[data-tmeta]').forEach(function (node) {
      var t = ts[+node.getAttribute('data-tmeta')]; if (!t || !t.name) return;
      var want = '— ' + t.name + (t.role ? ', ' + t.role : '');
      if (node.textContent.replace(/\s+/g, ' ').trim() === want.trim()) return;
      while (node.firstChild) node.removeChild(node.firstChild);
      node.appendChild(document.createTextNode('— ' + t.name + (t.role ? ', ' : '')));
      if (t.role) { var bold = document.createElement('b'); bold.textContent = t.role; node.appendChild(bold); }
    });
  }

  /* ---- Footer year ---- */
  var yearEl = $('[data-year]');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
