/* ============================================================
   QuickScale Admin — prototype SPA (vanilla, no dependencies).

   THIS IS A FRONT-END MOCK. "Auth" here is theatrical: it gates
   the UI only and accepts any input. Real security lives in the
   backend (Supabase Auth + TOTP MFA + Row-Level Security). When
   live, swap the MOCK reads/writes below for supabase-js calls —
   the screens and routing stay the same. See PROVISION.md.

   Security habits modeled even in the mock:
   - Lead fields are rendered as TEXT NODES (never innerHTML) so a
     malicious submission can't inject script into the inbox.
   - No inline event handlers (addEventListener only) so the real
     admin can ship a strict Content-Security-Policy.
   ============================================================ */
(function () {
  'use strict';
  var M = window.QS_MOCK;
  var SKEY = 'qs_admin_session';

  /* ---------- tiny DOM helper ---------- */
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v == null) continue;
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;          // ONLY for trusted static markup (icons)
      else if (k === 'text') n.textContent = v;        // SAFE for any data, incl. lead fields
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    (kids || []).forEach(function (c) {
      if (c == null) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }
  var app = function () { return document.getElementById('app'); };
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 2400);
  }
  function audit(action) {
    M.auditLog.unshift({ at: new Date().toISOString(), actor: (M.currentUser.name.split(' ')[0]), action: action, ip: '—' });
  }
  function fmtDate(iso) {
    try { var d = new Date(iso); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }
    catch (e) { return iso; }
  }
  function ago(iso) {
    try {
      var s = (Date.now() - new Date(iso).getTime()) / 1000;
      if (s < 3600) return Math.max(1, Math.round(s / 60)) + 'm';
      if (s < 86400) return Math.round(s / 3600) + 'h';
      return Math.round(s / 86400) + 'd';
    } catch (e) { return ''; }
  }

  var ICONS = {
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>',
    inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5 5h14l3 7v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-6z"/></svg>',
    image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.8"/><path d="M21 15l-5-5L5 21"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>',
    phone: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 6L2 7"/></svg>'
  };

  /* ---------- session (demo only) ---------- */
  function session() { try { return JSON.parse(sessionStorage.getItem(SKEY) || 'null'); } catch (e) { return null; } }
  function setSession(s) { sessionStorage.setItem(SKEY, JSON.stringify(s)); }
  function clearSession() { sessionStorage.removeItem(SKEY); }
  function authed() { var s = session(); return !!(s && s.authed && s.mfa); }

  /* ---------- router ---------- */
  function route() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    return h || 'dashboard';
  }
  var VIEWS = {}; // filled below
  function render() {
    var root = app(); clear(root);
    if (!authed()) { root.appendChild(renderLogin()); return; }
    var r = route();
    if (!VIEWS[r]) r = 'dashboard';
    root.appendChild(renderShell(r));
  }
  window.addEventListener('hashchange', render);

  /* ============================================================
     LOGIN  (password -> TOTP -> backup code)  — demo accepts anything
     ============================================================ */
  var loginState = { step: 'password', email: '' };
  function renderLogin() {
    var wrap = el('div', { class: 'auth' });
    var card = el('div', { class: 'auth__card' });
    card.appendChild(el('div', { class: 'auth__brand' }, [
      el('span', { class: 'auth__mark', 'aria-hidden': 'true', text: 'Q' }),
      el('span', { class: 'auth__name', html: 'QuickScale<b>&nbsp;Admin</b>' })
    ]));

    if (loginState.step === 'password') {
      card.appendChild(el('h1', { text: 'Sign in' }));
      card.appendChild(el('p', { class: 'sub', text: 'Manage leads, media, and content.' }));
      var em = el('input', { class: 'input', type: 'email', placeholder: 'you@quickscalem.com', autocomplete: 'username', value: loginState.email });
      var pw = el('input', { class: 'input', type: 'password', placeholder: 'Password', autocomplete: 'current-password' });
      var err = el('div', { class: 'error' });
      var form = el('form', {
        onsubmit: function (e) {
          e.preventDefault();
          if (!em.value.trim() || !pw.value) { err.textContent = 'Enter your email and password.'; return; }
          loginState.email = em.value.trim(); loginState.step = 'totp';
          clear(app()); app().appendChild(renderLogin());
        }
      }, [
        el('div', { class: 'field' }, [el('label', { text: 'Email' }), em]),
        el('div', { class: 'field' }, [el('label', { text: 'Password' }), pw, err]),
        el('button', { class: 'abtn abtn--primary abtn--block', type: 'submit', text: 'Continue' })
      ]);
      card.appendChild(form);
      card.appendChild(el('p', { class: 'auth__hint', text: 'Demo: any email + password works. Real auth uses Supabase (Argon2id hashing + rate limiting).' }));

    } else if (loginState.step === 'totp') {
      card.appendChild(el('h1', { text: 'Two-factor code' }));
      card.appendChild(el('p', { class: 'sub', text: 'Enter the 6-digit code from your authenticator app.' }));
      var otpWrap = el('div', { class: 'otp' });
      var inputs = [];
      for (var i = 0; i < 6; i++) {
        var inp = el('input', { class: 'input', inputmode: 'numeric', maxlength: '1', 'aria-label': 'Digit ' + (i + 1) });
        (function (inp, idx) {
          inp.addEventListener('input', function () {
            inp.value = inp.value.replace(/\D/g, '').slice(0, 1);
            if (inp.value && idx < 5) inputs[idx + 1].focus();
          });
          inp.addEventListener('keydown', function (e) {
            if (e.key === 'Backspace' && !inp.value && idx > 0) inputs[idx - 1].focus();
          });
        })(inp, i);
        inputs.push(inp); otpWrap.appendChild(inp);
      }
      var terr = el('div', { class: 'error' });
      var verify = function () {
        var code = inputs.map(function (x) { return x.value; }).join('');
        if (code.length < 6) { terr.textContent = 'Enter all 6 digits.'; return; }
        finishLogin();
      };
      var tform = el('form', { onsubmit: function (e) { e.preventDefault(); verify(); } }, [
        el('div', { class: 'field' }, [otpWrap, terr]),
        el('button', { class: 'abtn abtn--primary abtn--block', type: 'submit', text: 'Verify' })
      ]);
      card.appendChild(tform);
      card.appendChild(el('p', { class: 'auth__hint' }, [
        el('button', { class: 'auth__link', type: 'button', text: 'Use a backup code instead', onclick: function () { loginState.step = 'backup'; clear(app()); app().appendChild(renderLogin()); } })
      ]));
      setTimeout(function () { inputs[0].focus(); }, 30);

    } else { // backup
      card.appendChild(el('h1', { text: 'Backup code' }));
      card.appendChild(el('p', { class: 'sub', text: 'Enter one of your one-time recovery codes.' }));
      var bc = el('input', { class: 'input', placeholder: 'xxxx-xxxx', autocomplete: 'one-time-code' });
      var berr = el('div', { class: 'error' });
      var bform = el('form', {
        onsubmit: function (e) { e.preventDefault(); if (!bc.value.trim()) { berr.textContent = 'Enter a backup code.'; return; } finishLogin(); }
      }, [
        el('div', { class: 'field' }, [el('label', { text: 'Recovery code' }), bc, berr]),
        el('button', { class: 'abtn abtn--primary abtn--block', type: 'submit', text: 'Verify' })
      ]);
      card.appendChild(bform);
      card.appendChild(el('p', { class: 'auth__hint' }, [
        el('button', { class: 'auth__link', type: 'button', text: 'Back to authenticator code', onclick: function () { loginState.step = 'totp'; clear(app()); app().appendChild(renderLogin()); } })
      ]));
    }

    wrap.appendChild(card);
    return wrap;
  }
  function finishLogin() {
    setSession({ authed: true, mfa: true, at: Date.now() });
    audit('Signed in (2FA passed)');
    loginState.step = 'password';
    if (location.hash.replace(/^#\/?/, '') === '' ) location.hash = '#/dashboard';
    render();
  }

  /* ============================================================
     SHELL (sidebar + topbar + content)
     ============================================================ */
  function unread() { return M.leads.filter(function (l) { return l.status === 'new' && !l.spam; }).length; }
  var NAV = [
    { id: 'dashboard', label: 'Dashboard', icon: ICONS.grid },
    { id: 'inbox', label: 'Inbox', icon: ICONS.inbox, badge: unread },
    { id: 'media', label: 'Media', icon: ICONS.image },
    { id: 'content', label: 'Content', icon: ICONS.edit },
    { id: 'users', label: 'Users', icon: ICONS.users },
    { id: 'settings', label: 'Settings', icon: ICONS.gear }
  ];
  var TITLES = { dashboard: ['Dashboard', 'Your funnel at a glance'], inbox: ['Inbox', 'Incoming strategy-call requests'], media: ['Media', 'Replace placeholders with real job-site media'], content: ['Content', 'Edit the public site copy'], users: ['Users', 'Team access & invitations'], settings: ['Settings', 'Notifications, integrations & security'] };

  function renderShell(r) {
    var layout = el('div', { class: 'layout' });

    // sidebar
    var side = el('aside', { class: 'sidebar' });
    side.appendChild(el('div', { class: 'sidebar__brand' }, [
      el('span', { class: 'sidebar__mark', 'aria-hidden': 'true', text: 'Q' }),
      el('span', { class: 'sidebar__name', text: 'QuickScale' })
    ]));
    var nav = el('nav', { 'aria-label': 'Admin' });
    NAV.forEach(function (item) {
      var kids = [el('span', { 'aria-hidden': 'true', class: 'navicon', html: item.icon }), el('span', { text: item.label })];
      if (item.badge) { var c = item.badge(); if (c) kids.push(el('span', { class: 'badge-dot', text: String(c) })); }
      var a = el('a', { class: 'navitem', href: '#/' + item.id }, kids);
      if (r === item.id) a.setAttribute('aria-current', 'page');
      nav.appendChild(a);
    });
    side.appendChild(nav);
    side.appendChild(el('div', { class: 'sidebar__spacer' }));
    side.appendChild(el('div', { class: 'sidebar__user' }, [
      el('b', { text: M.currentUser.name }),
      el('span', { text: M.currentUser.role }),
      el('div', { class: 'row', style: 'margin-top:10px' }, [
        el('button', { class: 'navitem', type: 'button', onclick: doLogout }, [el('span', { 'aria-hidden': 'true', class: 'navicon', html: ICONS.logout }), el('span', { text: 'Sign out' })])
      ])
    ]));
    layout.appendChild(side);

    // main
    var main = el('div', { class: 'main' });
    var t = TITLES[r] || [r, ''];
    main.appendChild(el('header', { class: 'topbar' }, [
      el('div', {}, [el('h1', { text: t[0] }), el('div', { class: 'topbar__sub', text: t[1] })]),
      el('a', { class: 'abtn abtn--ghost abtn--sm', href: '../index.html', target: '_blank', rel: 'noopener', text: 'View site ↗' })
    ]));
    var content = el('div', { class: 'content' });
    VIEWS[r](content);
    main.appendChild(content);
    layout.appendChild(main);
    return layout;
  }
  function doLogout() { clearSession(); audit('Signed out'); loginState.step = 'password'; render(); }

  function badge(status) { return el('span', { class: 'badge badge--' + status, text: status }); }

  /* ============================================================
     DASHBOARD
     ============================================================ */
  VIEWS.dashboard = function (c) {
    var k = M.kpis;
    var kp = el('div', { class: 'kpis' });
    [['leadsToday', 'leads today'], ['leads7d', 'leads · 7 days'], ['leads30d', 'leads · 30 days'], ['booked30d', 'booked · 30 days'], ['costPerLead', 'cost / lead'], ['won30d', 'won · 30 days']].forEach(function (p, i) {
      kp.appendChild(el('div', { class: 'kpi' + (i === 0 ? ' kpi--accent' : '') }, [
        el('div', { class: 'kpi__num', text: String(k[p[0]]) }),
        el('div', { class: 'kpi__label', text: p[1] })
      ]));
    });
    c.appendChild(kp);

    var cols = el('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fit,minmax(280px,1fr));' });
    // by source
    cols.appendChild(panel('Leads by source (30 days)', barList(k.bySource)));
    // funnel
    cols.appendChild(panel('Funnel (30 days)', barList(k.funnel)));
    c.appendChild(cols);

    // recent leads
    var recent = M.leads.slice(0, 6);
    var tbl = leadTable(recent);
    var p = panel('Recent leads', tbl);
    p.querySelector('.panel__head').appendChild(el('a', { class: 'abtn abtn--ghost abtn--sm', href: '#/inbox', text: 'Open inbox →' }));
    c.appendChild(p);
  };
  function barList(items) {
    var max = items.reduce(function (m, x) { return Math.max(m, x.value); }, 1);
    var box = el('div', { class: 'bars' });
    items.forEach(function (x) {
      box.appendChild(el('div', { class: 'bar' }, [
        el('span', { class: 'muted', text: x.label }),
        el('span', { class: 'bar__track' }, [el('span', { class: 'bar__fill', style: 'width:' + Math.round(x.value / max * 100) + '%' })]),
        el('span', { class: 'bar__val', text: String(x.value) })
      ]));
    });
    return box;
  }
  function panel(title, bodyNode) {
    return el('div', { class: 'panel mb-16' }, [
      el('div', { class: 'panel__head' }, [el('h2', { text: title })]),
      el('div', { class: 'panel__body' }, [bodyNode])
    ]);
  }

  /* ============================================================
     INBOX
     ============================================================ */
  var inboxFilter = { q: '', status: '', source: '', spam: false };
  VIEWS.inbox = function (c) {
    var bar = el('div', { class: 'toolbar' });
    var q = el('input', { type: 'search', placeholder: 'Search name, business, email…', value: inboxFilter.q });
    q.addEventListener('input', function () { inboxFilter.q = q.value; refresh(); });
    var st = el('select', {}, [optEl('', 'All statuses')].concat(M.statuses.map(function (s) { return optEl(s, s[0].toUpperCase() + s.slice(1)); })));
    st.value = inboxFilter.status; st.addEventListener('change', function () { inboxFilter.status = st.value; refresh(); });
    var sp = el('label', { class: 'row', style: 'font-size:13px;gap:6px;cursor:pointer' }, [
      (function () { var cb = el('input', { type: 'checkbox' }); cb.checked = inboxFilter.spam; cb.addEventListener('change', function () { inboxFilter.spam = cb.checked; refresh(); }); return cb; })(),
      el('span', { text: 'Show spam' })
    ]);
    bar.appendChild(q); bar.appendChild(st); bar.appendChild(sp);
    bar.appendChild(el('span', { class: 'spacer' }));
    bar.appendChild(el('button', { class: 'abtn abtn--ghost abtn--sm', type: 'button', text: 'Export CSV', onclick: function () { toast('Export queued (demo) — wires to a server export when live.'); } }));
    c.appendChild(bar);

    var holder = el('div', { class: 'panel' });
    c.appendChild(holder);
    function refresh() {
      clear(holder);
      var rows = M.leads.filter(function (l) {
        if (!inboxFilter.spam && l.spam) return false;
        if (inboxFilter.spam && !l.spam) return false;
        if (inboxFilter.status && l.status !== inboxFilter.status) return false;
        var q2 = inboxFilter.q.toLowerCase().trim();
        if (q2) {
          var hay = (l.name + ' ' + l.business + ' ' + l.email + ' ' + l.phone).toLowerCase();
          if (hay.indexOf(q2) === -1) return false;
        }
        return true;
      });
      if (!rows.length) { holder.appendChild(el('div', { class: 'panel__body muted', text: 'No leads match.' })); return; }
      holder.appendChild(leadTable(rows));
    }
    refresh();
  };
  function optEl(v, label) { return el('option', { value: v, text: label }); }

  function leadTable(rows) {
    var wrap = el('div', { class: 'tablewrap' });
    var table = el('table', { class: 'table' });
    table.appendChild(el('thead', {}, [el('tr', {}, [
      th('Lead'), th('Source / campaign'), th('SMS'), th('Status'), th('Age')
    ])]));
    var tb = el('tbody');
    rows.forEach(function (l) {
      var tr = el('tr', { onclick: function () { openLead(l); } }, [
        el('td', {}, [el('div', { class: 'lead-name', text: l.name }), el('div', { class: 'lead-sub', text: l.business })]),
        el('td', {}, [el('div', { text: l.campaign }), el('div', { class: 'lead-sub', text: l.sourcePage })]),
        el('td', {}, [l.smsConsent ? el('span', { class: 'badge badge--consent', text: 'Yes' }) : el('span', { class: 'badge badge--noconsent', text: 'No' })]),
        el('td', {}, [l.spam ? el('span', { class: 'badge badge--spam', text: 'spam' }) : badge(l.status)]),
        el('td', { class: 'nowrap muted', text: ago(l.createdAt) })
      ]);
      tb.appendChild(tr);
    });
    table.appendChild(tb); wrap.appendChild(table);
    return wrap;
  }
  function th(t) { return el('th', { text: t }); }

  /* lead detail drawer */
  function openLead(l) {
    audit('Viewed lead ' + l.id);
    var trigger = document.activeElement;
    var scrim = el('div', { class: 'drawer-scrim', onclick: function () { close(); } });
    var drawer = el('aside', { class: 'drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Lead detail' });
    function onKey(e) { if (e.key === 'Escape') close(); }
    function close() {
      document.removeEventListener('keydown', onKey);
      if (scrim.parentNode) document.body.removeChild(scrim);
      if (drawer.parentNode) document.body.removeChild(drawer);
      if (trigger && trigger.focus) trigger.focus();
    }
    document.addEventListener('keydown', onKey);

    drawer.appendChild(el('div', { class: 'drawer__head' }, [
      el('div', {}, [
        el('div', { class: 'drawer__title', text: l.name }),
        el('div', { class: 'muted', text: l.business })
      ]),
      el('button', { class: 'drawer__x', type: 'button', 'aria-label': 'Close', text: '×', onclick: close })
    ]));

    var body = el('div', { class: 'drawer__body' });
    // contact actions
    body.appendChild(el('div', { class: 'row mb-16' }, [
      el('a', { class: 'abtn abtn--primary abtn--sm', href: 'tel:' + l.phone.replace(/[^0-9+]/g, ''), html: ICONS.phone + '<span style="margin-left:6px">Call</span>' }),
      el('a', { class: 'abtn abtn--ghost abtn--sm', href: 'mailto:' + l.email, html: ICONS.mail + '<span style="margin-left:6px">Email</span>' })
    ]));
    // details (all text nodes — safe)
    var kv = el('dl', { class: 'kv' });
    [['Phone', l.phone], ['Email', l.email], ['Source', l.sourcePage], ['Campaign', l.campaign], ['SMS consent', l.smsConsent ? 'Yes — captured' : 'No'], ['Received', fmtDate(l.createdAt)], ['Lead ID', l.id]].forEach(function (p) {
      kv.appendChild(el('dt', { text: p[0] })); kv.appendChild(el('dd', { text: p[1] }));
    });
    body.appendChild(kv);

    // status
    body.appendChild(el('div', { class: 'field' }, [
      el('label', { text: 'Status' }),
      (function () {
        var sel = el('select', { class: 'input' }, M.statuses.map(function (s) { return optEl(s, s[0].toUpperCase() + s.slice(1)); }));
        sel.value = l.status;
        sel.addEventListener('change', function () { l.status = sel.value; audit('Changed ' + l.id + ' status → ' + sel.value); toast('Status updated (demo).'); });
        return sel;
      })()
    ]));

    // spam toggle
    body.appendChild(el('div', { class: 'row mb-16' }, [
      el('button', { class: 'abtn abtn--danger abtn--sm', type: 'button', text: l.spam ? 'Unmark spam' : 'Mark as spam', onclick: function () { l.spam = !l.spam; audit((l.spam ? 'Marked' : 'Unmarked') + ' ' + l.id + ' spam'); toast('Saved (demo).'); close(); } })
    ]));

    // notes
    body.appendChild(el('div', { class: 'section-title', text: 'Notes' }));
    var notes = el('div', { class: 'notelist' });
    function paintNotes() {
      clear(notes);
      if (!l.notes.length) notes.appendChild(el('div', { class: 'muted', text: 'No notes yet.' }));
      l.notes.forEach(function (n) {
        notes.appendChild(el('div', { class: 'note' }, [
          el('div', { class: 'note__meta', text: n.by + ' · ' + fmtDate(n.at) }),
          el('div', { text: n.text })
        ]));
      });
    }
    paintNotes();
    body.appendChild(notes);
    var ta = el('textarea', { class: 'input', placeholder: 'Add a note…' });
    body.appendChild(el('div', { class: 'field' }, [ta]));
    body.appendChild(el('button', {
      class: 'abtn abtn--ghost abtn--sm', type: 'button', text: 'Add note', onclick: function () {
        if (!ta.value.trim()) return;
        l.notes.push({ at: new Date().toISOString(), by: M.currentUser.name.split(' ')[0], text: ta.value.trim() });
        ta.value = ''; audit('Added note to ' + l.id); paintNotes(); toast('Note added (demo).');
      }
    }));

    drawer.appendChild(body);
    document.body.appendChild(scrim); document.body.appendChild(drawer);
    setTimeout(function () { (drawer.querySelector('select,textarea,button') || drawer).focus(); }, 0);
  }

  /* ============================================================
     MEDIA
     ============================================================ */
  var mediaTab = 'Home';
  VIEWS.media = function (c) {
    c.appendChild(el('div', { class: 'callout mb-16', text: 'Replace placeholder slots with real job-site photos/video. In the live version, uploads are validated (type by magic bytes, size/dimension caps, EXIF stripped, WebP/AVIF generated) and published to the site.' }));
    c.appendChild(el('div', { class: 'row between mb-16' }, [
      el('div', { class: 'hint', text: M.mediaSlots.filter(function (s) { return s.current; }).length + ' of ' + M.mediaSlots.length + ' slots set' }),
      el('button', { class: 'abtn abtn--primary abtn--sm', type: 'button', text: 'Publish changes', onclick: function () { toast('Publish queued (demo) — writes media/slots.json + assets when live.'); } })
    ]));
    var pages = M.mediaSlots.map(function (s) { return s.page; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
    var tabs = el('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Pages' });
    var gridHolder = el('div', { id: 'mediaPanel', role: 'tabpanel' });
    pages.forEach(function (pg) {
      var b = el('button', { class: 'tab', type: 'button', role: 'tab', 'aria-controls': 'mediaPanel', text: pg, onclick: function () { mediaTab = pg; paint(); } });
      if (pg === mediaTab) b.setAttribute('aria-selected', 'true');
      tabs.appendChild(b);
    });
    c.appendChild(tabs); c.appendChild(gridHolder);
    function paint() {
      Array.prototype.forEach.call(tabs.children, function (b) { b.setAttribute('aria-selected', b.textContent === mediaTab ? 'true' : 'false'); });
      clear(gridHolder);
      var grid = el('div', { class: 'mediagrid' });
      M.mediaSlots.filter(function (s) { return s.page === mediaTab; }).forEach(function (slot) { grid.appendChild(mediaCard(slot)); });
      gridHolder.appendChild(grid);
    }
    paint();
  };
  function mediaCard(slot) {
    var thumb = el('div', { class: 'mediacard__thumb' });
    var isSet = !!slot.current;
    thumb.appendChild(el('span', { class: 'mediacard__badge' + (isSet ? ' mediacard__badge--set' : ''), text: isSet ? 'SET' : 'PLACEHOLDER' }));
    if (isSet && slot.page === 'Global') {
      thumb.appendChild(el('img', { src: '../assets/img/' + slot.current, alt: slot.alt || '' }));
    } else {
      thumb.appendChild(el('span', { text: slot.type === 'video' ? '▶ video' : 'no image' }));
    }
    var altField = el('input', { class: 'input', placeholder: 'Describe this image (alt text)…', value: slot.alt || '' });
    altField.addEventListener('input', function () { slot.alt = altField.value; });

    var drop = el('label', { class: 'dropzone', text: 'Drop ' + (slot.type === 'video' ? 'video' : 'image') + ' or click to choose' });
    var file = el('input', { type: 'file', accept: slot.type === 'video' ? 'video/*' : 'image/*', style: 'display:none' });
    drop.appendChild(file);
    file.addEventListener('change', function () {
      if (!file.files || !file.files[0]) return;
      var f = file.files[0];
      slot.current = '(pending: ' + f.name + ')';
      audit('Queued media for ' + slot.id);
      toast('Queued "' + f.name + '" for ' + slot.label + ' (demo).');
      // live preview into the thumb
      if (slot.type !== 'video') { try { var url = URL.createObjectURL(f); clear(thumb); thumb.appendChild(el('span', { class: 'mediacard__badge mediacard__badge--set', text: 'QUEUED' })); thumb.appendChild(el('img', { src: url, alt: '' })); } catch (e) {} }
    });
    ['dragover', 'dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.toggle('is-over', ev === 'dragover'); if (ev === 'drop' && e.dataTransfer.files[0]) { file.files = e.dataTransfer.files; file.dispatchEvent(new Event('change')); } });
    });

    return el('div', { class: 'mediacard' }, [
      thumb,
      el('div', { class: 'mediacard__body' }, [
        el('div', { class: 'mediacard__label', text: slot.label }),
        el('div', { class: 'mediacard__meta', text: slot.type + ' · ' + slot.aspect }),
        slot.type === 'image' ? el('div', { class: 'field', style: 'margin-bottom:10px' }, [altField]) : null,
        drop
      ])
    ]);
  }

  /* ============================================================
     CONTENT (light CMS — demo)
     ============================================================ */
  VIEWS.content = function (c) {
    var ct = M.content;
    c.appendChild(el('div', { class: 'callout mb-16', text: 'Edit the public site copy. When live, saving updates one source of truth that feeds the pages, the footer, and the JSON-LD (so the phone number/social links can never drift).' }));

    // Business / NAP
    c.appendChild(formPanel('Business info (NAP)', [
      twoCol([textField('Business name', ct.business.name), textField('Phone', ct.business.phone)]),
      twoCol([textField('Email', ct.business.email), textField('City', ct.business.city)])
    ]));
    // Social
    c.appendChild(formPanel('Social links', [
      twoCol([textField('Facebook URL', ct.social.facebook, 'https://facebook.com/…'), textField('Instagram URL', ct.social.instagram, 'https://instagram.com/…')])
    ]));
    // Hero
    c.appendChild(formPanel('Homepage hero', [
      textField('Headline', ct.hero.headline),
      areaField('Subheadline', ct.hero.sub)
    ]));
    // Stats
    var statRows = ct.stats.map(function (s) { return twoCol([textField('Value', s.value), textField('Label', s.label)]); });
    c.appendChild(formPanel('Stats counters', statRows));
    // Testimonials
    var tRows = ct.testimonials.map(function (t) { return el('div', { class: 'mb-16' }, [areaField('Quote', t.quote), twoCol([textField('Name', t.name), textField('Role / company', t.role)])]); });
    c.appendChild(formPanel('Testimonials', tRows.concat([el('div', { class: 'hint', text: 'Only publish real, verifiable testimonials. Review/AggregateRating schema is intentionally NOT applied until these are confirmed.' })])));
  };
  function formPanel(title, fields) {
    var body = el('div', { class: 'panel__body' }, fields);
    var p = el('div', { class: 'panel mb-16' }, [
      el('div', { class: 'panel__head' }, [el('h2', { text: title }), el('button', { class: 'abtn abtn--primary abtn--sm', type: 'button', text: 'Save', onclick: function () { toast('Saved (demo).'); } })]),
      body
    ]);
    return p;
  }
  function textField(label, val, ph) { return el('div', { class: 'field' }, [el('label', { text: label }), el('input', { class: 'input', value: val || '', placeholder: ph || '' })]); }
  function areaField(label, val) { return el('div', { class: 'field' }, [el('label', { text: label }), el('textarea', { class: 'input', text: val || '' })]); }
  function twoCol(fields) { return el('div', { class: 'field__row' }, fields); }

  /* ============================================================
     USERS / INVITES
     ============================================================ */
  VIEWS.users = function (c) {
    c.appendChild(el('div', { class: 'callout mb-16', text: 'One temporary Owner account is active. New teammates are added by email invite: they receive a single-use link (24–72h), set a strong password, and must enroll 2FA before access.' }));
    var holder = el('div', { class: 'panel mb-16' });
    function paint() {
      clear(holder);
      holder.appendChild(el('div', { class: 'panel__head' }, [el('h2', { text: 'Team' })]));
      var wrap = el('div', { class: 'tablewrap' });
      var table = el('table', { class: 'table' });
      table.appendChild(el('thead', {}, [el('tr', {}, [th('Name'), th('Email'), th('Role'), th('2FA'), th('Status'), th('Last active')])]));
      var tb = el('tbody');
      M.users.forEach(function (u) {
        tb.appendChild(el('tr', { style: 'cursor:default' }, [
          el('td', { class: 'lead-name', text: u.name }),
          el('td', { text: u.email }),
          el('td', { text: u.role }),
          el('td', {}, [u.twoFA ? el('span', { class: 'badge badge--won', text: 'On' }) : el('span', { class: 'badge badge--lost', text: 'Off' })]),
          el('td', {}, [u.status === 'Active' ? el('span', { class: 'badge badge--booked', text: 'Active' }) : el('span', { class: 'badge badge--new', text: u.status })]),
          el('td', { class: 'muted', text: u.lastActive })
        ]));
      });
      table.appendChild(tb); wrap.appendChild(table);
      holder.appendChild(wrap);
    }
    paint();
    c.appendChild(holder);

    // invite form
    var email = el('input', { class: 'input', type: 'email', placeholder: 'teammate@quickscalem.com' });
    var role = el('select', { class: 'input' }, [optEl('Editor', 'Editor — manage leads & content'), optEl('Viewer', 'Viewer — read-only leads'), optEl('Owner', 'Owner — full access')]);
    var p = el('div', { class: 'panel' }, [
      el('div', { class: 'panel__head' }, [el('h2', { text: 'Invite a teammate' })]),
      el('div', { class: 'panel__body' }, [
        el('div', { class: 'field__row' }, [
          el('div', { class: 'field', style: 'flex:2 1 220px' }, [el('label', { text: 'Email' }), email]),
          el('div', { class: 'field', style: 'flex:1 1 160px' }, [el('label', { text: 'Role' }), role])
        ]),
        el('button', {
          class: 'abtn abtn--primary abtn--sm', type: 'button', text: 'Send invite', onclick: function () {
            if (!email.value.trim()) { toast('Enter an email.'); return; }
            M.users.push({ name: '(pending)', email: email.value.trim(), role: role.value, status: 'Invited', twoFA: false, lastActive: '—' });
            audit('Invited ' + email.value.trim() + ' (' + role.value + ')');
            toast('Invite sent (demo) — sends a single-use email link when live.');
            email.value = ''; paint();
          }
        })
      ])
    ]);
    c.appendChild(p);
  };

  /* ============================================================
     SETTINGS
     ============================================================ */
  VIEWS.settings = function (c) {
    var s = M.settings;
    c.appendChild(formPanel('Notifications', [
      textField('New-lead email to', s.notifyEmail),
      textField('Slack webhook URL (optional)', s.notifySlackWebhook, 'https://hooks.slack.com/…')
    ]));

    c.appendChild(el('div', { class: 'panel mb-16' }, [
      el('div', { class: 'panel__head' }, [el('h2', { text: 'Integrations (public keys)' }), el('button', { class: 'abtn abtn--primary abtn--sm', type: 'button', text: 'Save', onclick: function () { toast('Saved (demo).'); } })]),
      el('div', { class: 'panel__body' }, [
        el('div', { class: 'hint mb-16', text: 'Only PUBLIC keys live here. Secret keys (Supabase service_role, Meta CAPI, email API) are stored server-side and never in the browser.' }),
        twoCol([textField('Supabase project URL', s.integrations.supabaseUrl, 'https://xxxx.supabase.co'), textField('Meta Pixel ID', s.integrations.metaPixelId)]),
        twoCol([textField('GA4 Measurement ID', s.integrations.ga4MeasurementId, 'G-XXXXXXX'), textField('Turnstile site key', s.integrations.turnstileSiteKey)])
      ])
    ]));

    // Security / session
    c.appendChild(el('div', { class: 'panel mb-16' }, [
      el('div', { class: 'panel__head' }, [el('h2', { text: 'Security' })]),
      el('div', { class: 'panel__body' }, [
        el('div', { class: 'row mb-16' }, [
          el('button', { class: 'abtn abtn--ghost abtn--sm', type: 'button', text: 'Re-enroll 2FA', onclick: function () { toast('Opens authenticator enrollment when live.'); } }),
          el('button', { class: 'abtn abtn--ghost abtn--sm', type: 'button', text: 'Regenerate backup codes', onclick: function () { toast('Generates 10 new one-time codes when live.'); } }),
          el('button', { class: 'abtn abtn--danger abtn--sm', type: 'button', text: 'Sign out all devices', onclick: function () { toast('Revokes all sessions when live.'); } })
        ]),
        el('div', { class: 'hint', text: 'Sessions: HttpOnly + Secure cookies, 15–30 min idle timeout, instant server-side revocation.' })
      ])
    ]));

    // audit log
    var wrap = el('div', { class: 'tablewrap' });
    var table = el('table', { class: 'table' });
    table.appendChild(el('thead', {}, [el('tr', {}, [th('When'), th('Who'), th('Action')])]));
    var tb = el('tbody');
    M.auditLog.slice(0, 12).forEach(function (a) {
      tb.appendChild(el('tr', { style: 'cursor:default' }, [el('td', { class: 'nowrap muted', text: fmtDate(a.at) }), el('td', { text: a.actor }), el('td', { text: a.action })]));
    });
    table.appendChild(tb); wrap.appendChild(table);
    c.appendChild(el('div', { class: 'panel' }, [el('div', { class: 'panel__head' }, [el('h2', { text: 'Audit log' })]), wrap]));
  };

  /* ---------- boot ---------- */
  if (!location.hash) location.hash = '#/dashboard';
  render();
})();
