/* ============================================================
   QuickScale Admin — SPA (vanilla + supabase-js).

   Connects to Supabase when config.js provides supabaseUrl +
   supabaseAnonKey (real auth + RLS); otherwise falls back to
   window.QS_MOCK for an offline demo. The views are written once
   and read through the DB.* data layer, which branches on LIVE.

   Security habits:
   - Lead/user data is rendered as TEXT NODES (never innerHTML);
     'html' is used ONLY for trusted static icon markup.
   - No inline event handlers (addEventListener only) — strict-CSP safe.
   - Access is enforced server-side by Supabase Row-Level Security;
     the UI just calls queries. MFA (TOTP) is required to enter.
   ============================================================ */
(function () {
  'use strict';
  var INITIAL_HASH = location.hash || '';
  var CFG = window.QS_CONFIG || {};
  var M = window.QS_MOCK || {};
  var SB = null, LIVE = false;
  try {
    if (CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase && window.supabase.createClient) {
      SB = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'qs_admin_auth' }
      });
      LIVE = true;
    }
  } catch (e) { LIVE = false; }
  var INVITE_SETUP = /type=(invite|recovery|signup)/.test(INITIAL_HASH) || /access_token=/.test(INITIAL_HASH);

  /* ---------- tiny DOM helper ---------- */
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v == null) continue;
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;          // ONLY for trusted static markup (icons)
      else if (k === 'text') n.textContent = v;        // SAFE for any data
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
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 2800);
  }
  function errMsg(e) { return (e && (e.message || e.error_description || e.error)) || 'Something went wrong.'; }
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
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function copy(o) { return JSON.parse(JSON.stringify(o || {})); }
  function deepMerge(base, over) {
    var out = copy(base);
    Object.keys(over || {}).forEach(function (k) {
      if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && out[k] && typeof out[k] === 'object') out[k] = deepMerge(out[k], over[k]);
      else out[k] = over[k];
    });
    return out;
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

  /* ---------- demo banner (only when not connected) ---------- */
  function paintDemoBanner() {
    var b = document.getElementById('demo-banner'); if (!b) return;
    clear(b);
    if (LIVE) { b.className = ''; return; }
    b.className = 'proto-banner';
    b.appendChild(el('span', { html: '<strong>DEMO MODE</strong> — Supabase keys not set in <code>config.js</code>; showing mock data. Add supabaseUrl + supabaseAnonKey to connect.' }));
  }

  /* ============================================================
     DATA LAYER — branches on LIVE (Supabase) vs mock.
     ============================================================ */
  function contentDefaults() { return copy(M.content || {}); }
  var _profMap = null;
  var DB = {
    me: function () {
      if (!LIVE) return Promise.resolve({ name: M.currentUser.name, role: M.currentUser.role, email: M.currentUser.email });
      return SB.auth.getUser().then(function (r) {
        var user = r.data.user; if (!user) return null;
        return SB.from('profiles').select('full_name, role, email').eq('id', user.id).single().then(function (p) {
          var d = p.data || {};
          return { id: user.id, name: d.full_name || user.email, role: d.role || 'viewer', email: d.email || user.email };
        });
      });
    },
    profilesMap: function () {
      if (_profMap) return Promise.resolve(_profMap);
      _profMap = {};
      if (!LIVE) return Promise.resolve(_profMap);
      return SB.from('profiles').select('id, full_name').then(function (r) {
        (r.data || []).forEach(function (p) { _profMap[p.id] = p.full_name; });
        return _profMap;
      });
    },
    mediaSlots: function () {
      if (!LIVE) return Promise.resolve(M.mediaSlots.slice());
      return SB.from('media_slots').select('*').order('id').then(function (r) { if (r.error) throw r.error; return r.data || []; });
    },
    saveSlot: function (id, fields) {
      if (!LIVE) { var s = find(M.mediaSlots, id); if (s) Object.assign(s, fields); return Promise.resolve(); }
      return SB.from('media_slots').update(fields).eq('id', id).then(function (r) { if (r.error) throw r.error; });
    },
    upload: function (slot, file) {
      if (!LIVE) { slot.current = '(pending: ' + file.name + ')'; return Promise.resolve(slot.current); }
      var ext = (file.name.split('.').pop() || 'bin').toLowerCase();
      var path = slot.id + '/' + Date.now() + '.' + ext;
      return SB.storage.from('media').upload(path, file, { upsert: true, contentType: file.type || undefined }).then(function (up) {
        if (up.error) throw up.error;
        var url = SB.storage.from('media').getPublicUrl(path).data.publicUrl;
        return DB.saveSlot(slot.id, { current: url }).then(function () { return DB.writeAudit('Uploaded media for ' + slot.id).then(function () { return url; }); });
      });
    },
    profiles: function () {
      if (!LIVE) return Promise.resolve(M.users.slice());
      return SB.from('profiles').select('id, full_name, email, role').order('full_name').then(function (r) {
        if (r.error) throw r.error;
        return (r.data || []).map(function (p) { return { id: p.id, name: p.full_name || p.email || '—', email: p.email || '—', role: p.role }; });
      });
    },
    updateRole: function (id, role) {
      if (!LIVE) { var u = find(M.users, id) || M.users.filter(function (x) { return x.email === id; })[0]; if (u) u.role = cap(role); return Promise.resolve(); }
      return SB.from('profiles').update({ role: role }).eq('id', id).then(function (r) { if (r.error) throw r.error; return DB.writeAudit('Changed a teammate role → ' + role); });
    },
    invite: function (email, role) {
      if (!LIVE) { M.users.push({ name: '(pending)', email: email, role: cap(role), status: 'Invited', twoFA: false, lastActive: '—' }); return Promise.resolve(); }
      return SB.functions.invoke('admin-invite', { body: { email: email, role: role } }).then(function (r) {
        if (r.error) throw r.error;
        if (r.data && r.data.error) throw new Error(r.data.detail || r.data.error);
        return DB.writeAudit('Invited ' + email + ' (' + role + ')');
      });
    },
    content: function () {
      if (!LIVE) return Promise.resolve(deepMerge(contentDefaults(), M.content || {}));
      return SB.from('site_content').select('doc').eq('id', 'site').single().then(function (r) {
        return deepMerge(contentDefaults(), (r.data && r.data.doc) || {});
      });
    },
    saveContent: function (doc) {
      if (!LIVE) { M.content = doc; return Promise.resolve(); }
      return SB.auth.getUser().then(function (r) {
        return SB.from('site_content').upsert({ id: 'site', doc: doc, updated_at: new Date().toISOString(), updated_by: r.data.user.id });
      }).then(function (r) { if (r.error) throw r.error; return DB.writeAudit('Updated site content'); });
    },
    audit: function (limit) {
      if (!LIVE) return Promise.resolve(M.auditLog.slice(0, limit || 12));
      return SB.from('audit_log').select('*').order('created_at', { ascending: false }).limit(limit || 12).then(function (r) {
        if (r.error) return [];
        return DB.profilesMap().then(function (pm) {
          return (r.data || []).map(function (a) { return { at: a.created_at, who: pm[a.actor] || 'Staff', action: a.action }; });
        });
      });
    },
    writeAudit: function (action) {
      if (!LIVE) { M.auditLog.unshift({ at: new Date().toISOString(), actor: M.currentUser.name.split(' ')[0], action: action, ip: '—' }); return Promise.resolve(); }
      return SB.auth.getUser().then(function (r) { return SB.from('audit_log').insert({ actor: r.data.user.id, action: action }); }).then(function () {}).catch(function () {});
    }
  };
  function find(arr, id) { for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i]; return null; }

  var state = { me: null };

  /* ============================================================
     AUTH
     ============================================================ */
  var Auth = {
    isAuthed: function () {
      if (!LIVE) { try { return Promise.resolve(!!JSON.parse(sessionStorage.getItem('qs_admin_demo') || 'null')); } catch (e) { return Promise.resolve(false); } }
      return SB.auth.getSession().then(function (r) {
        if (!r.data.session) return false;
        // 2FA optional: authed unless a factor is enrolled but not yet verified this session.
        return SB.auth.mfa.getAuthenticatorAssuranceLevel().then(function (a) {
          var d = a.data; if (!d) return true;
          return !(d.nextLevel === 'aal2' && d.currentLevel !== 'aal2');
        }).catch(function () { return true; });
      });
    },
    signOut: function () {
      if (!LIVE) { sessionStorage.removeItem('qs_admin_demo'); render(); return; }
      SB.auth.signOut().then(function () { _profMap = null; render(); });
    }
  };

  /* ---------- login (async; renders the correct step) ---------- */
  var loginEmail = '';
  function authShell(kids) {
    var card = el('div', { class: 'auth__card' });
    card.appendChild(el('div', { class: 'auth__brand' }, [el('img', { class: 'auth__logo', src: '../assets/img/banner-dark.png', alt: 'QuickScale Media' })]));
    kids.forEach(function (k) { card.appendChild(k); });
    return el('div', { class: 'auth' }, [card]);
  }
  function otpField(onComplete) {
    var wrap = el('div', { class: 'otp' }), inputs = [];
    for (var i = 0; i < 6; i++) {
      var inp = el('input', { class: 'input', inputmode: 'numeric', maxlength: '1', 'aria-label': 'Digit ' + (i + 1) });
      (function (inp, idx) {
        inp.addEventListener('input', function () {
          inp.value = inp.value.replace(/\D/g, '').slice(0, 1);
          if (inp.value && idx < 5) inputs[idx + 1].focus();
          if (inputs.every(function (x) { return x.value; })) onComplete(inputs.map(function (x) { return x.value; }).join(''));
        });
        inp.addEventListener('keydown', function (e) { if (e.key === 'Backspace' && !inp.value && idx > 0) inputs[idx - 1].focus(); });
        inp.addEventListener('paste', function (e) {
          var t = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
          if (t.length === 6) { e.preventDefault(); inputs.forEach(function (x, n) { x.value = t[n]; }); onComplete(t); }
        });
      })(inp, i);
      inputs.push(inp); wrap.appendChild(inp);
    }
    setTimeout(function () { inputs[0].focus(); }, 30);
    return { node: wrap, code: function () { return inputs.map(function (x) { return x.value; }).join(''); }, reset: function () { inputs.forEach(function (x) { x.value = ''; }); inputs[0].focus(); } };
  }

  function renderLogin() {
    if (!LIVE) return Promise.resolve(loginMock());
    return SB.auth.getSession().then(function (r) {
      if (!r.data.session) return loginPassword();
      // signed in but not yet aal2
      if (INVITE_SETUP) return loginSetPassword();
      // 2FA is optional — only challenge users who have actually enrolled a factor.
      return SB.auth.mfa.listFactors().then(function (f) {
        var verified = ((f.data && f.data.totp) || []).filter(function (x) { return x.status === 'verified'; });
        if (verified.length) return loginChallenge(verified[0]);
        return authShell([el('h1', { text: 'Almost there' }), el('p', { class: 'sub', text: 'Finishing sign-in…' }), el('button', { class: 'abtn abtn--primary abtn--block', text: 'Continue', onclick: render })]);
      });
    });
  }

  function loginMock() {
    var em = el('input', { class: 'input', type: 'email', placeholder: 'you@quickscalem.com' });
    var pw = el('input', { class: 'input', type: 'password', placeholder: 'Password' });
    var err = el('div', { class: 'error' });
    var form = el('form', { onsubmit: function (e) { e.preventDefault(); if (!em.value.trim() || !pw.value) { err.textContent = 'Enter email and password.'; return; } sessionStorage.setItem('qs_admin_demo', '1'); if (!location.hash || location.hash === '#') location.hash = '#/dashboard'; render(); } }, [
      el('div', { class: 'field' }, [el('label', { text: 'Email' }), em]),
      el('div', { class: 'field' }, [el('label', { text: 'Password' }), pw, err]),
      el('button', { class: 'abtn abtn--primary abtn--block', type: 'submit', text: 'Sign in' })
    ]);
    return authShell([el('h1', { text: 'Sign in' }), el('p', { class: 'sub', text: 'Demo mode — any email + password works.' }), form]);
  }

  function loginPassword() {
    var em = el('input', { class: 'input', type: 'email', placeholder: 'you@quickscalem.com', autocomplete: 'username', value: loginEmail });
    var pw = el('input', { class: 'input', type: 'password', placeholder: 'Password', autocomplete: 'current-password' });
    var err = el('div', { class: 'error' });
    var btn = el('button', { class: 'abtn abtn--primary abtn--block', type: 'submit', text: 'Continue' });
    var form = el('form', { onsubmit: function (e) {
      e.preventDefault(); err.textContent = '';
      if (!em.value.trim() || !pw.value) { err.textContent = 'Enter your email and password.'; return; }
      loginEmail = em.value.trim(); btn.disabled = true; btn.textContent = 'Checking…';
      SB.auth.signInWithPassword({ email: loginEmail, password: pw.value }).then(function (r) {
        if (r.error) { err.textContent = r.error.message; btn.disabled = false; btn.textContent = 'Continue'; return; }
        render();
      });
    } }, [
      el('div', { class: 'field' }, [el('label', { text: 'Email' }), em]),
      el('div', { class: 'field' }, [el('label', { text: 'Password' }), pw, err]),
      btn
    ]);
    return authShell([el('h1', { text: 'Sign in' }), el('p', { class: 'sub', text: 'Manage media, content, and team access.' }), form]);
  }

  function loginSetPassword() {
    var pw = el('input', { class: 'input', type: 'password', placeholder: 'New password (min 8 chars)', autocomplete: 'new-password' });
    var err = el('div', { class: 'error' });
    var btn = el('button', { class: 'abtn abtn--primary abtn--block', type: 'submit', text: 'Set password' });
    var form = el('form', { onsubmit: function (e) {
      e.preventDefault(); err.textContent = '';
      if (pw.value.length < 8) { err.textContent = 'Use at least 8 characters.'; return; }
      btn.disabled = true; btn.textContent = 'Saving…';
      SB.auth.updateUser({ password: pw.value }).then(function (r) {
        if (r.error) { err.textContent = r.error.message; btn.disabled = false; btn.textContent = 'Set password'; return; }
        INVITE_SETUP = false; try { history.replaceState(null, '', location.pathname); } catch (e2) {}
        render();
      });
    } }, [el('div', { class: 'field' }, [el('label', { text: 'Create your password' }), pw, err]), btn]);
    return authShell([el('h1', { text: 'Welcome' }), el('p', { class: 'sub', text: 'Set a password to finish setting up your account.' }), form]);
  }

  // Reusable TOTP enrollment UI (rendered into a container) — 2FA is optional, set up from Settings.
  function buildEnrollUI(container, onDone) {
    var status = el('p', { class: 'sub', text: 'Generating code…' });
    container.appendChild(status);
    SB.auth.mfa.listFactors().then(function (f) {
      var unverified = ((f.data && f.data.totp) || []).filter(function (x) { return x.status !== 'verified'; });
      return Promise.all(unverified.map(function (x) { return SB.auth.mfa.unenroll({ factorId: x.id }); }));
    }).then(function () {
      return SB.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Admin TOTP ' + Date.now() });
    }).then(function (r) {
      clear(container);
      if (r.error) { container.appendChild(el('div', { class: 'error', text: r.error.message })); return; }
      var d = r.data;
      container.appendChild(el('p', { class: 'hint', text: 'Scan with an authenticator app (Google Authenticator, 1Password, Authy), then enter the 6-digit code.' }));
      container.appendChild(el('div', { style: 'display:flex;justify-content:center;margin:6px 0' }, [el('img', { src: d.totp.qr_code, alt: 'TOTP QR code', width: '170', height: '170', style: 'border-radius:10px;background:#fff;padding:8px;border:1px solid var(--border)' })]));
      container.appendChild(el('p', { class: 'hint', style: 'text-align:center;word-break:break-all', text: 'Manual key: ' + d.totp.secret }));
      var err = el('div', { class: 'error' });
      var otp = otpField(function (code) { submit(code); });
      function submit(code) { err.textContent = ''; SB.auth.mfa.challengeAndVerify({ factorId: d.id, code: code }).then(function (v) { if (v.error) { err.textContent = v.error.message; otp.reset(); return; } onDone(); }); }
      container.appendChild(el('form', { onsubmit: function (e) { e.preventDefault(); submit(otp.code()); } }, [el('div', { class: 'field' }, [el('label', { text: 'Authenticator code' }), otp.node, err]), el('button', { class: 'abtn abtn--primary abtn--sm', type: 'submit', text: 'Verify & turn on' })]));
    });
  }

  function loginChallenge(factor) {
    var err = el('div', { class: 'error' });
    var otp = otpField(function (code) { submit(code); });
    function submit(code) {
      err.textContent = '';
      SB.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code }).then(function (v) {
        if (v.error) { err.textContent = v.error.message; otp.reset(); return; }
        if (!location.hash || location.hash === '#') location.hash = '#/dashboard';
        render();
      });
    }
    var form = el('form', { onsubmit: function (e) { e.preventDefault(); submit(otp.code()); } }, [
      el('div', { class: 'field' }, [otp.node, err]),
      el('button', { class: 'abtn abtn--primary abtn--block', type: 'submit', text: 'Verify' })
    ]);
    return authShell([
      el('h1', { text: 'Two-factor code' }),
      el('p', { class: 'sub', text: 'Enter the 6-digit code from your authenticator app.' }),
      form,
      el('p', { class: 'auth__hint' }, [el('button', { class: 'auth__link', type: 'button', text: 'Sign out', onclick: Auth.signOut })])
    ]);
  }

  /* ============================================================
     SHELL
     ============================================================ */
  var NAV = [
    { id: 'dashboard', label: 'Dashboard', icon: ICONS.grid },
    { id: 'media', label: 'Media', icon: ICONS.image },
    { id: 'content', label: 'Content', icon: ICONS.edit },
    { id: 'users', label: 'Users', icon: ICONS.users },
    { id: 'settings', label: 'Settings', icon: ICONS.gear }
  ];
  var TITLES = { dashboard: ['Dashboard', 'Website management — leads live in GoHighLevel'], media: ['Media', 'Replace placeholders with real job-site media'], content: ['Content', 'Edit the public site copy'], users: ['Users', 'Team access & invitations'], settings: ['Settings', 'Notifications, integrations & security'] };
  function route() { return (location.hash || '').replace(/^#\/?/, '') || 'dashboard'; }
  var VIEWS = {};

  function renderShell(r) {
    var me = state.me || { name: '—', role: '' };
    var layout = el('div', { class: 'layout' });
    var side = el('aside', { class: 'sidebar' });
    side.appendChild(el('div', { class: 'sidebar__brand' }, [el('img', { class: 'sidebar__logo', src: '../assets/img/banner-light.png', alt: 'QuickScale Media' })]));
    var nav = el('nav', { 'aria-label': 'Admin' });
    NAV.forEach(function (item) {
      var kids = [el('span', { 'aria-hidden': 'true', class: 'navicon', html: item.icon }), el('span', { text: item.label })];
      var a = el('a', { class: 'navitem', href: '#/' + item.id }, kids);
      if (r === item.id) a.setAttribute('aria-current', 'page');
      nav.appendChild(a);
    });
    side.appendChild(nav);
    side.appendChild(el('div', { class: 'sidebar__spacer' }));
    side.appendChild(el('div', { class: 'sidebar__user' }, [
      el('b', { text: me.name }), el('span', { text: cap(me.role) }),
      el('div', { class: 'row', style: 'margin-top:10px' }, [el('button', { class: 'navitem', type: 'button', onclick: Auth.signOut }, [el('span', { 'aria-hidden': 'true', class: 'navicon', html: ICONS.logout }), el('span', { text: 'Sign out' })])])
    ]));
    layout.appendChild(side);

    var main = el('div', { class: 'main' });
    var t = TITLES[r] || [r, ''];
    main.appendChild(el('header', { class: 'topbar' }, [
      el('div', {}, [el('h1', { text: t[0] }), el('div', { class: 'topbar__sub', text: t[1] })]),
      el('a', { class: 'abtn abtn--ghost abtn--sm', href: '../index.html', target: '_blank', rel: 'noopener', text: 'View site ↗' })
    ]));
    var content = el('div', { class: 'content' });
    try { VIEWS[r](content); } catch (e) { content.appendChild(el('div', { class: 'panel__body error', text: errMsg(e) })); }
    main.appendChild(content);
    layout.appendChild(main);
    return layout;
  }
  function loadingPanel(msg) { return el('div', { class: 'panel' }, [el('div', { class: 'panel__body muted', text: msg || 'Loading…' })]); }
  function optEl(v, label) { return el('option', { value: v, text: label }); }
  function th(t) { return el('th', { text: t }); }
  function panel(title, bodyNode) { return el('div', { class: 'panel mb-16' }, [el('div', { class: 'panel__head' }, [el('h2', { text: title })]), el('div', { class: 'panel__body' }, [bodyNode])]); }

  /* ============================================================
     DASHBOARD
     ============================================================ */
  var GHL_URL = (CFG.ghlAppUrl || 'https://app.gohighlevel.com/');
  VIEWS.dashboard = function (c) {
    c.appendChild(el('div', { class: 'callout mb-16', text: 'Leads, the sales pipeline, conversations, SMS, and bookings now live in GoHighLevel. This panel manages the website itself — media, copy, and team access.' }));
    c.appendChild(el('div', { class: 'panel mb-16' }, [
      el('div', { class: 'panel__head' }, [el('h2', { text: 'GoHighLevel' })]),
      el('div', { class: 'panel__body' }, [
        el('p', { class: 'muted mb-16', text: 'Contacts & opportunities, calendar / bookings, conversations, and automations all live in GHL.' }),
        el('a', { class: 'abtn abtn--primary', href: GHL_URL, target: '_blank', rel: 'noopener', text: 'Open GoHighLevel ↗' })
      ])
    ]));
    var grid = el('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fit,minmax(210px,1fr));' });
    [['Media', 'Job-site photos & video', '#/media'], ['Content', 'Public site copy', '#/content'], ['Users', 'Team access', '#/users'], ['Settings', 'Integrations & security', '#/settings']].forEach(function (q) {
      grid.appendChild(el('a', { class: 'panel', href: q[2], style: 'text-decoration:none;display:block' }, [el('div', { class: 'panel__body' }, [el('div', { class: 'lead-name', text: q[0] }), el('div', { class: 'muted', text: q[1] })])]));
    });
    c.appendChild(grid);
  };

  /* ============================================================
     MEDIA
     ============================================================ */
  var mediaTab = 'Home', _slots = null;
  VIEWS.media = function (c) {
    c.appendChild(el('div', { class: 'callout mb-16', text: 'Replace placeholder slots with real job-site photos/video. Uploads go to Supabase Storage (public “media” bucket) and the registry is updated. Optimize to WebP/AVIF before uploading for best performance.' }));
    var info = el('div', { class: 'hint', text: 'Loading…' });
    var head = el('div', { class: 'row between mb-16' }, [info]);
    c.appendChild(head);
    var tabs = el('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Pages' });
    var gridHolder = el('div', { id: 'mediaPanel', role: 'tabpanel' });
    c.appendChild(tabs); c.appendChild(gridHolder);
    DB.mediaSlots().then(function (slots) {
      _slots = slots;
      info.textContent = slots.filter(function (s) { return s.current; }).length + ' of ' + slots.length + ' slots set';
      var pages = slots.map(function (s) { return s.page; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
      if (pages.indexOf(mediaTab) === -1) mediaTab = pages[0];
      clear(tabs);
      pages.forEach(function (pg) { var b = el('button', { class: 'tab', type: 'button', role: 'tab', 'aria-controls': 'mediaPanel', text: pg, onclick: function () { mediaTab = pg; paint(); } }); if (pg === mediaTab) b.setAttribute('aria-selected', 'true'); tabs.appendChild(b); });
      paint();
    }).catch(function (e) { info.textContent = ''; gridHolder.appendChild(el('div', { class: 'panel__body error', text: errMsg(e) })); });
    function paint() {
      Array.prototype.forEach.call(tabs.children, function (b) { b.setAttribute('aria-selected', b.textContent === mediaTab ? 'true' : 'false'); });
      clear(gridHolder);
      var grid = el('div', { class: 'mediagrid' });
      _slots.filter(function (s) { return s.page === mediaTab; }).forEach(function (slot) { grid.appendChild(mediaCard(slot)); });
      gridHolder.appendChild(grid);
    }
  };
  function publicMediaSrc(slot) {
    if (!slot.current) return null;
    if (/^https?:\/\//.test(slot.current)) return slot.current;        // uploaded URL
    return '../assets/img/' + slot.current.replace(/^assets\/img\//, ''); // seeded global asset
  }
  function mediaCard(slot) {
    var thumb = el('div', { class: 'mediacard__thumb' });
    function paintThumb() {
      clear(thumb);
      var isSet = !!slot.current, src = publicMediaSrc(slot);
      thumb.appendChild(el('span', { class: 'mediacard__badge' + (isSet ? ' mediacard__badge--set' : ''), text: isSet ? 'SET' : 'PLACEHOLDER' }));
      if (isSet && src && slot.type === 'image') thumb.appendChild(el('img', { src: src, alt: slot.alt || '' }));
      else thumb.appendChild(el('span', { text: slot.type === 'video' ? '▶ video' : (isSet ? 'uploaded' : 'no image') }));
    }
    paintThumb();
    var altField = el('input', { class: 'input', placeholder: 'Describe this image (alt text)…', value: slot.alt || '' });
    var saveAlt = el('button', { class: 'abtn abtn--ghost abtn--sm', type: 'button', text: 'Save alt', onclick: function () { DB.saveSlot(slot.id, { alt: altField.value }).then(function () { slot.alt = altField.value; toast('Alt text saved.'); }).catch(function (e) { toast(errMsg(e)); }); } });
    var drop = el('label', { class: 'dropzone', text: 'Drop ' + (slot.type === 'video' ? 'video' : 'image') + ' or click to choose' });
    var file = el('input', { type: 'file', accept: slot.type === 'video' ? 'video/*' : 'image/*', style: 'display:none' });
    drop.appendChild(file);
    file.addEventListener('change', function () {
      if (!file.files || !file.files[0]) return;
      var f = file.files[0]; drop.textContent = 'Uploading ' + f.name + '…';
      DB.upload(slot, f).then(function (url) { slot.current = url; paintThumb(); drop.textContent = 'Drop ' + (slot.type === 'video' ? 'video' : 'image') + ' or click to choose'; toast('Uploaded “' + f.name + '”.'); }).catch(function (e) { drop.textContent = 'Drop ' + (slot.type === 'video' ? 'video' : 'image') + ' or click to choose'; toast(errMsg(e)); });
    });
    ['dragover', 'dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.toggle('is-over', ev === 'dragover'); if (ev === 'drop' && e.dataTransfer.files[0]) { file.files = e.dataTransfer.files; file.dispatchEvent(new Event('change')); } }); });
    return el('div', { class: 'mediacard' }, [thumb, el('div', { class: 'mediacard__body' }, [
      el('div', { class: 'mediacard__label', text: slot.label }), el('div', { class: 'mediacard__meta', text: slot.type + ' · ' + slot.aspect }),
      slot.type === 'image' ? el('div', { class: 'field', style: 'margin-bottom:10px' }, [altField, el('div', { class: 'row', style: 'margin-top:6px' }, [saveAlt])]) : null,
      drop
    ])]);
  }

  /* ============================================================
     CONTENT
     ============================================================ */
  VIEWS.content = function (c) {
    c.appendChild(el('div', { class: 'callout mb-16', text: 'Edit the stored site copy. (Saved to the database; wiring the public pages to read it is the remaining step — see README.) Only publish real, verifiable testimonials.' }));
    var holder = el('div'); c.appendChild(holder); holder.appendChild(loadingPanel('Loading content…'));
    DB.content().then(function (ct) {
      clear(holder);
      var refs = {};
      function tf(label, path, ph) { var inp = el('input', { class: 'input', value: getPath(ct, path) || '', placeholder: ph || '' }); refs[path] = function () { return inp.value; }; return el('div', { class: 'field' }, [el('label', { text: label }), inp]); }
      function af(label, path) { var inp = el('textarea', { class: 'input', text: getPath(ct, path) || '' }); refs[path] = function () { return inp.value; }; return el('div', { class: 'field' }, [el('label', { text: label }), inp]); }
      function twoCol(a, b) { return el('div', { class: 'field__row' }, [a, b]); }
      function saveAll() {
        var doc = copy(ct);
        Object.keys(refs).forEach(function (p) { setPath(doc, p, refs[p]()); });
        DB.saveContent(doc).then(function () { toast('Content saved.'); }).catch(function (e) { toast(errMsg(e)); });
      }
      function pnl(title, fields) { return el('div', { class: 'panel mb-16' }, [el('div', { class: 'panel__head' }, [el('h2', { text: title }), el('button', { class: 'abtn abtn--primary abtn--sm', type: 'button', text: 'Save', onclick: saveAll })]), el('div', { class: 'panel__body' }, fields)]); }
      holder.appendChild(pnl('Business info (NAP)', [twoCol(tf('Business name', 'business.name'), tf('Phone', 'business.phone')), twoCol(tf('Email', 'business.email'), tf('City', 'business.city'))]));
      holder.appendChild(pnl('Social links', [twoCol(tf('Facebook URL', 'social.facebook', 'https://facebook.com/…'), tf('Instagram URL', 'social.instagram', 'https://instagram.com/…'))]));
      holder.appendChild(pnl('Homepage hero', [tf('Headline', 'hero.headline'), af('Subheadline', 'hero.sub')]));
      (ct.stats || []).forEach(function (s, i) { /* stats edited inline below */ });
      var statFields = (ct.stats || []).map(function (s, i) { return twoCol(tf('Value', 'stats.' + i + '.value'), tf('Label', 'stats.' + i + '.label')); });
      holder.appendChild(pnl('Stats counters', statFields));
      var tFields = (ct.testimonials || []).map(function (t, i) { return el('div', { class: 'mb-16' }, [af('Quote', 'testimonials.' + i + '.quote'), twoCol(tf('Name', 'testimonials.' + i + '.name'), tf('Role / company', 'testimonials.' + i + '.role'))]); });
      holder.appendChild(pnl('Testimonials', tFields.concat([el('div', { class: 'hint', text: 'Review/AggregateRating schema stays OFF until these are real and verifiable.' })])));
    }).catch(function (e) { clear(holder); holder.appendChild(el('div', { class: 'panel__body error', text: errMsg(e) })); });
  };
  function getPath(o, path) { return path.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
  function setPath(o, path, val) { var ks = path.split('.'); var cur = o; for (var i = 0; i < ks.length - 1; i++) { if (cur[ks[i]] == null) cur[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {}; cur = cur[ks[i]]; } cur[ks[ks.length - 1]] = val; }

  /* ============================================================
     USERS
     ============================================================ */
  VIEWS.users = function (c) {
    var isOwner = state.me && state.me.role === 'owner';
    c.appendChild(el('div', { class: 'callout mb-16', text: 'Team access is governed by Supabase roles (owner / editor / viewer) + Row-Level Security. Invites send a single-use email link; the new teammate sets a password and enrolls 2FA before they can enter.' }));
    var holder = el('div', { class: 'panel mb-16' }); c.appendChild(holder); holder.appendChild(el('div', { class: 'panel__body muted', text: 'Loading team…' }));
    function load() {
      DB.profiles().then(function (users) {
        clear(holder); holder.appendChild(el('div', { class: 'panel__head' }, [el('h2', { text: 'Team' })]));
        var wrap = el('div', { class: 'tablewrap' }); var table = el('table', { class: 'table' });
        table.appendChild(el('thead', {}, [el('tr', {}, [th('Name'), th('Email'), th('Role'), isOwner ? th('Change role') : null].filter(Boolean))]));
        var tb = el('tbody');
        users.forEach(function (u) {
          var cells = [el('td', { class: 'lead-name', text: u.name }), el('td', { text: u.email }), el('td', {}, [el('span', { class: 'badge badge--' + (u.role === 'owner' ? 'won' : u.role === 'editor' ? 'booked' : 'new'), text: cap(u.role) })])];
          if (isOwner) {
            var sel = el('select', { class: 'input', style: 'min-width:120px' }, ['owner', 'editor', 'viewer'].map(function (r) { return optEl(r, cap(r)); }));
            sel.value = u.role;
            sel.addEventListener('change', function () { DB.updateRole(u.id, sel.value).then(function () { toast('Role updated.'); }).catch(function (e) { sel.value = u.role; toast(errMsg(e)); }); });
            cells.push(el('td', {}, [sel]));
          }
          tb.appendChild(el('tr', { style: 'cursor:default' }, cells));
        });
        table.appendChild(tb); wrap.appendChild(table); holder.appendChild(wrap);
      }).catch(function (e) { clear(holder); holder.appendChild(el('div', { class: 'panel__body error', text: errMsg(e) })); });
    }
    load();

    var email = el('input', { class: 'input', type: 'email', placeholder: 'teammate@quickscalem.com' });
    var role = el('select', { class: 'input' }, [optEl('editor', 'Editor — manage leads & content'), optEl('viewer', 'Viewer — read-only leads'), optEl('owner', 'Owner — full access')]);
    var inviteBtn = el('button', { class: 'abtn abtn--primary abtn--sm', type: 'button', text: 'Send invite', onclick: function () {
      if (!email.value.trim()) { toast('Enter an email.'); return; }
      if (!isOwner) { toast('Only owners can invite teammates.'); return; }
      inviteBtn.disabled = true; inviteBtn.textContent = 'Sending…';
      DB.invite(email.value.trim(), role.value).then(function () { toast('Invite sent.'); email.value = ''; load(); }).catch(function (e) { toast(errMsg(e)); }).then(function () { inviteBtn.disabled = false; inviteBtn.textContent = 'Send invite'; });
    } });
    c.appendChild(el('div', { class: 'panel' }, [el('div', { class: 'panel__head' }, [el('h2', { text: 'Invite a teammate' })]), el('div', { class: 'panel__body' }, [
      el('div', { class: 'field__row' }, [el('div', { class: 'field', style: 'flex:2 1 220px' }, [el('label', { text: 'Email' }), email]), el('div', { class: 'field', style: 'flex:1 1 160px' }, [el('label', { text: 'Role' }), role])]),
      inviteBtn,
      isOwner ? null : el('div', { class: 'hint', text: 'You need the owner role to invite or change teammates.' })
    ])]));
  };

  /* ============================================================
     SETTINGS
     ============================================================ */
  VIEWS.settings = function (c) {
    // Notifications + content-stored settings
    var holder = el('div'); c.appendChild(holder); holder.appendChild(loadingPanel('Loading settings…'));
    DB.content().then(function (ct) {
      clear(holder);
      var s = ct.settings || M.settings || { notifyEmail: '', notifySlackWebhook: '' };
      var refs = {};
      function tf(label, path, ph) { var inp = el('input', { class: 'input', value: getPath({ settings: s }, path) || '', placeholder: ph || '' }); refs[path] = function () { return inp.value; }; return el('div', { class: 'field' }, [el('label', { text: label }), inp]); }
      function saveNotify() { var doc = copy(ct); Object.keys(refs).forEach(function (p) { setPath(doc, p, refs[p]()); }); DB.saveContent(doc).then(function () { toast('Saved.'); }).catch(function (e) { toast(errMsg(e)); }); }
      holder.appendChild(el('div', { class: 'panel mb-16' }, [el('div', { class: 'panel__head' }, [el('h2', { text: 'Notifications' }), el('button', { class: 'abtn abtn--primary abtn--sm', type: 'button', text: 'Save', onclick: saveNotify })]), el('div', { class: 'panel__body' }, [tf('New-lead email to', 'settings.notifyEmail'), tf('Slack webhook URL (optional)', 'settings.notifySlackWebhook', 'https://hooks.slack.com/…'), el('div', { class: 'hint', text: 'The new-lead email is sent server-side by the submit-lead function (set NOTIFY_EMAIL there too).' })]) ]));
    }).catch(function (e) { clear(holder); holder.appendChild(el('div', { class: 'panel__body error', text: errMsg(e) })); });

    // Integrations (read-only public config)
    c.appendChild(el('div', { class: 'panel mb-16' }, [el('div', { class: 'panel__head' }, [el('h2', { text: 'Integrations (public config.js)' })]), el('div', { class: 'panel__body' }, [
      el('div', { class: 'hint mb-16', text: 'These PUBLIC values live in assets/js/config.js. Secret keys (service_role, Meta CAPI, Resend) are stored server-side only.' }),
      kvRead('Supabase URL', CFG.supabaseUrl || '—'), kvRead('Meta Pixel ID', CFG.metaPixelId || '— (not set)'), kvRead('GA4 Measurement ID', CFG.ga4MeasurementId || '— (not set)'), kvRead('Turnstile site key', CFG.turnstileSiteKey || '— (not set)')
    ])]));

    // Security — optional two-factor (opt-in add-on) + session controls
    var sec = el('div', { class: 'panel mb-16' }, [el('div', { class: 'panel__head' }, [el('h2', { text: 'Security' })])]);
    var secBody = el('div', { class: 'panel__body' }); sec.appendChild(secBody); c.appendChild(sec);
    function paintMfa() {
      clear(secBody);
      var twofa = el('div', { class: 'mb-16' }); secBody.appendChild(twofa);
      secBody.appendChild(el('div', { class: 'row mb-16' }, [el('button', { class: 'abtn abtn--danger abtn--sm', type: 'button', text: 'Sign out all devices', onclick: function () { if (!LIVE) { toast('Live only.'); return; } SB.auth.signOut({ scope: 'global' }).then(function () { toast('Signed out everywhere.'); render(); }); } })]));
      secBody.appendChild(el('div', { class: 'hint', text: 'Two-factor authentication is an optional add-on (recommended). Auth, password hashing, and session revocation are handled by Supabase; access is enforced by Row-Level Security.' }));
      twofa.appendChild(el('div', { class: 'section-title', text: 'Two-factor authentication' }));
      if (!LIVE) { twofa.appendChild(el('div', { class: 'muted', text: 'Available when connected to Supabase.' })); return; }
      var slot = el('div', { class: 'muted', text: 'Checking…' }); twofa.appendChild(slot);
      SB.auth.mfa.listFactors().then(function (f) {
        var verified = ((f.data && f.data.totp) || []).filter(function (x) { return x.status === 'verified'; });
        clear(slot);
        if (verified.length) {
          slot.appendChild(el('div', { class: 'row', style: 'align-items:center;gap:10px;flex-wrap:wrap' }, [
            el('span', { class: 'badge badge--won', text: 'On' }), el('span', { text: 'Two-factor is enabled on this account.' }),
            el('button', { class: 'abtn abtn--ghost abtn--sm', type: 'button', text: 'Turn off', onclick: function () { Promise.all(verified.map(function (x) { return SB.auth.mfa.unenroll({ factorId: x.id }); })).then(function () { toast('Two-factor turned off.'); paintMfa(); }).catch(function (e) { toast(errMsg(e)); }); } })
          ]));
        } else {
          var enrollHolder = el('div', { style: 'margin-top:10px' });
          var enableBtn = el('button', { class: 'abtn abtn--primary abtn--sm', type: 'button', text: 'Enable two-factor', onclick: function () { enableBtn.disabled = true; buildEnrollUI(enrollHolder, function () { toast('Two-factor enabled.'); paintMfa(); }); } });
          slot.appendChild(el('div', { class: 'row', style: 'align-items:center;gap:10px;flex-wrap:wrap' }, [el('span', { class: 'badge badge--lost', text: 'Off' }), el('span', { text: 'Add an authenticator app for extra security.' }), enableBtn]));
          slot.appendChild(enrollHolder);
        }
      }).catch(function (e) { clear(slot); slot.appendChild(el('div', { class: 'error', text: errMsg(e) })); });
    }
    paintMfa();

    // Audit log
    var wrap = el('div', { class: 'tablewrap' }); var table = el('table', { class: 'table' });
    table.appendChild(el('thead', {}, [el('tr', {}, [th('When'), th('Who'), th('Action')])]));
    var tb = el('tbody'); table.appendChild(tb); wrap.appendChild(table);
    var auditPanel = el('div', { class: 'panel' }, [el('div', { class: 'panel__head' }, [el('h2', { text: 'Audit log' })]), wrap]);
    c.appendChild(auditPanel);
    DB.audit(15).then(function (rows) { if (!rows.length) { tb.appendChild(el('tr', {}, [el('td', { class: 'muted', colspan: '3', text: 'No entries yet (owner-only).' })])); return; } rows.forEach(function (a) { tb.appendChild(el('tr', { style: 'cursor:default' }, [el('td', { class: 'nowrap muted', text: fmtDate(a.at) }), el('td', { text: a.who }), el('td', { text: a.action })])); }); });
  };
  function kvRead(label, val) { return el('div', { class: 'field' }, [el('label', { text: label }), el('div', { class: 'input', style: 'background:#faf8f3;color:#6f6757;overflow:auto', text: val })]); }

  /* ============================================================
     RENDER + BOOT
     ============================================================ */
  function render() {
    paintDemoBanner();
    Auth.isAuthed().then(function (ok) {
      var root = app();
      if (!ok) { return renderLogin().then(function (node) { clear(root); root.appendChild(node); }); }
      return DB.me().then(function (me) {
        state.me = me;
        clear(root);
        var r = route(); if (!VIEWS[r]) r = 'dashboard';
        root.appendChild(renderShell(r));
      });
    }).catch(function (e) {
      var root = app(); clear(root);
      root.appendChild(el('div', { class: 'auth' }, [el('div', { class: 'auth__card' }, [el('h1', { text: 'Something went wrong' }), el('p', { class: 'sub', text: errMsg(e) }), el('button', { class: 'abtn abtn--ghost abtn--block', text: 'Reload', onclick: function () { location.reload(); } })])]));
    });
  }
  window.addEventListener('hashchange', function () { if (!location.hash) return; render(); });
  if (!location.hash && !INVITE_SETUP) location.hash = '#/dashboard';
  render();
})();
