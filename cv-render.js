/* ════════════════════════════════════════════════════════════════
   CV RENDER — builds index.html (web) and cv-print.html (print)
   from the single data file cv-data.js.
   You normally never need to edit this file: use editor.html.
   ════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  // ── Text helpers ───────────────────────────────────────────────
  // Text fields accept a tiny markup:  **bold**   *italic*   line break = new line
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function md(s) {
    if (!s) return '';
    var h = esc(s);
    h = h.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
    return h.replace(/\n/g, '<br>');
  }
  function plain(s) { return String(s || '').replace(/\*\*/g, '').replace(/\*/g, '').replace(/\n+/g, ' '); }
  // Authors: your name is highlighted automatically; "*" after a name = presenting author
  function authors(s) {
    return esc(s).replace(/(Labarta(?:\s+Labrador)?\s+M\.\*?)/g, '<span class="me">$1</span>');
  }
  function stripUrl(u) {
    return String(u || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
  }
  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  function abbrMonth(s) {
    return String(s || '').replace(new RegExp('\\b(' + MONTHS.join('|') + ')\\b', 'g'), function (m) { return m.slice(0, 3); });
  }
  // Dates: one style everywhere — months in 3 letters, ranges with an arrow
  // ("2019 → 2022", "Dec 2023 → Jun 2024", "2025 → Present"); day ranges keep a dash ("3–7 Mar 2025")
  function normDate(s) {
    s = String(s == null ? '' : s).replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
    if (!s) return s;
    s = abbrMonth(s).replace(/\bSept\b/g, 'Sep').replace(/\b(present|now|today|current|ongoing)\b/gi, 'Present');
    s = s.replace(/\b(\d{1,2})\s*[–—-]\s*(\d{1,2})(?=\s+[A-Za-z])/g, '$1\u0001$2');
    s = s.replace(/\s*(?:→|–|—|--?|>)\s*/g, ' → ');
    return s.replace(/\u0001/g, '–');
  }
  // date for narrow columns: if it has to wrap, it wraps after the arrow, never inside "Dec 2023"
  function dateHTML(s) {
    var parts = normDate(s).split(' → ');
    return parts.map(function (x, i) { return '<span style="white-space:nowrap">' + esc(x) + (i < parts.length - 1 ? ' →' : '') + '</span>'; }).join(' ');
  }
  // software grouped by type ("group" field), groups in order of first appearance
  function swGroups(items) {
    var g = [], by = {};
    items.forEach(function (e) { var k = String(e.group || '').trim() || 'Other'; if (!by[k]) g.push(by[k] = { group: k, items: [] }); by[k].items.push(e); });
    return g;
  }
  // Software levels (0–100) shown as words
  function levelWord(v) { v = +v || 0; return v >= 85 ? 'Expert' : v >= 65 ? 'Advanced' : v >= 40 ? 'Intermediate' : 'Basic'; }
  function firstPara(s) { return String(s || '').split(/\n\s*\n/)[0]; }

  // ── Print fields: if left empty in the editor, they are derived automatically ──
  var AUTO = {
    education: {
      sub: function (e) { return [e.institution, e.status].filter(Boolean).join(' · '); },
      note: function () { return ''; }
    },
    projects: { body: function (e) { return e.description || ''; } },
    publications: {
      ref: function (e) { return [String(e.reference || '').replace(/\*\*/g, '').replace(/\n/g, ' '), e.extra].filter(Boolean).join(' '); }
    },
    teaching: {
      title: function (e) { return [e.role, String(e.title || '').replace(/^(Course|Program|Programme)\s*—\s*/, '')].filter(Boolean).join(' — '); },
      sub: function (e) { return e.subtitle || ''; },
      body: function (e) {
        var d = (e.details || []).filter(function (kv) { return /^(content|tasks|talk|description)$/i.test(kv[0]); })[0];
        return d ? d[1] : '';
      }
    },
    theses: {
      title: function (e) { return e.title || ''; },
      body: function (e) { return e.summary || ''; }
    },
    workshops: {
      sub: function (e) { return [e.place, e.role].filter(Boolean).join(' · '); },
      body: function (e) { return firstPara(e.details); }
    },
    industry: {
      title: function (e) { return [e.role, e.company].filter(Boolean).join(' · '); },
      body: function (e) { return e.summary || ''; }
    },
    researchExperience: {
      title: function (e) { return e.role != null ? [e.role, e.org].filter(Boolean).join(' — ') : (e.title || ''); },
      sub: function (e) {
        if (e.role == null) return e.sub || '';
        return list(e.details).filter(function (kv) { return kv[1]; }).map(function (kv) {
          return /^(type|programme|program|duration)$/i.test(kv[0]) ? kv[1] : (kv[0] ? kv[0] + ': ' : '') + kv[1];
        }).join(' · ');
      },
      body: function (e) { return e.summary != null ? e.summary : (e.body || ''); }
    },
    roles: { body: function (e) { return e.description || ''; } }
  };
  function P(section, e, key) {
    var o = e.print && e.print[key];
    return (o != null && String(o).trim() !== '') ? o : AUTO[section][key](e);
  }

  var PUB_TYPES = {
    conf:    { label: 'Conference',      filter: 'Conference Papers', cls: 'bc', printCls: '' },
    journal: { label: 'Journal Article', filter: 'Journal Articles',  cls: 'bp', printCls: ' olive' },
    book:    { label: 'Book Chapter',    filter: 'Book Chapters',     cls: 'bb', printCls: ' mid' },
    thesis:  { label: 'Thesis',          filter: 'Thesis',            cls: '',   printCls: ' mid', style: 'background:color-mix(in srgb,var(--accent) 8%,transparent);color:var(--accent);' }
  };
  var PUB_ORDER = ['conf', 'journal', 'book', 'thesis'];

  var CHEV = '<svg viewBox="0 0 10 6"><polyline points="1,1 5,5 9,1"/></svg>';
  var EXT = '<svg viewBox="0 0 12 12"><path d="M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7M7 1h4m0 0v4m0-4L5 7"/></svg>';
  function extlink(url, label, style) {
    return '<a href="' + esc(url) + '"' + (url && url !== '#' ? ' target="_blank"' : '') +
      ' class="extlink" onclick="event.stopPropagation()"' + (style ? ' style="' + style + '"' : '') + '>' +
      EXT + esc(label) + '</a>';
  }
  function list(a) { return Array.isArray(a) ? a : []; }
  function $(id) { return document.getElementById(id); }
  function set(id, html) { var el = $(id); if (el) el.innerHTML = html; return el; }
  function showSection(id, show) {
    var sec = $(id); if (sec) sec.style.display = show ? '' : 'none';
    var nav = document.querySelector('.nav-links a[href="#' + id + '"]');
    if (nav && nav.parentElement) nav.parentElement.style.display = show ? '' : 'none';
  }

  /* ════════════════════════════  WEB  ════════════════════════════ */
  var WEB = {
    hero: function (d) {
      var p = d.profile || {};
      set('cv-hero-tag', esc(p.heroTag));
      set('cv-hero-sub', md(p.heroSub));
      set('cv-hero-contact',
        '<a href="mailto:' + esc(p.email) + '">' + esc(p.email) + '</a>' +
        '<span style="font-family:\'Sometype Mono\',monospace;font-size:0.7rem;color:var(--muted);">' + esc(p.basedWeb) + '</span>');
      set('cv-hero-links', list(p.heroLinks).map(function (l) {
        return '<a href="' + esc(l.url) + '" target="_blank" class="pill' + (l.style === 'outline' ? ' o' : '') + '" style="text-decoration:none;">' + esc(l.label) + '</a>';
      }).join(''));
      set('cv-hero-topics', list(p.heroTopics).map(function (t) { return '<span class="pill">' + esc(t) + '</span>'; }).join(''));
      set('cv-bio', md(p.bio));
      // Currently banner (auto-hides after endDate)
      var c = p.currently || {}, banner = $('currently-banner');
      if (banner) {
        var expired = !c.text || (c.endDate && new Date() > new Date(c.endDate + 'T23:59:59'));
        banner.style.display = expired ? 'none' : '';
        set('currently-text', esc(c.text));
        var ic = banner.querySelector('div'); if (ic) ic.textContent = c.emoji || '✈';
      }
    },

    education: function (d) {
      var items = list(d.education);
      set('cv-education', items.map(function (e) {
        var gWeb = e.grade && e.gradeWhere !== 'print';
        var grade = gWeb ? esc(e.grade).replace(/\s*\/\s*/, ' / ') : (e.status ? esc(e.status) : '');
        var inner = (e.thesis ? '<div class="edu-thesis">"' + esc(e.thesis) + '"</div>' : '') + md(e.details) +
          (e.link && e.link.url ? (e.details ? '<br><br>' : '') + extlink(e.link.url, e.link.label || 'View') : '');
        return '<div class="edu-card item-row" onclick="tog(this,\'edu\')">' +
          '<span class="chev edu-chev">' + CHEV + '</span>' +
          '<div class="edu-year">' + esc(normDate(e.dates)) + '</div>' +
          '<div class="edu-deg">' + esc(e.degree) + '</div>' +
          '<div class="edu-inst">' + esc(e.institution) + '</div>' +
          (grade ? '<span class="edu-grade">' + grade + '</span>' : '') +
          (inner ? '<div class="edu-body"><div class="edu-inner">' + inner + '</div></div>' : '') +
          '</div>';
      }).join(''));
      showSection('education', items.length > 0);
    },

    research: function (d) {
      var r = d.research || {};
      set('cv-research',
        '<div class="phd-title">' + esc(r.title) + '</div>' +
        '<div class="phd-meta">' +
          (r.institution ? '<span>Institution <strong>' + esc(r.institution) + '</strong></span>' : '') +
          (r.department ? '<span>Department <strong>' + esc(r.department) + '</strong></span>' : '') +
          (r.since ? '<span>Since <strong>' + esc(normDate(r.since)) + '</strong></span>' : '') +
          (r.expected ? '<span>Expected <strong>' + esc(normDate(r.expected)) + '</strong></span>' : '') +
        '</div>' +
        '<div class="ftags">' + list(r.tags).map(function (t) { return '<span class="ftag">' + esc(t) + '</span>'; }).join('') + '</div>' +
        (r.abstract ?
          '<div style="margin-top:2.5rem;max-width:780px;border-top:1px solid rgba(255,255,255,0.1);padding-top:2rem;">' +
          '<div style="font-family:\'Sometype Mono\',monospace;font-size:0.6rem;letter-spacing:0.18em;text-transform:uppercase;color:color-mix(in srgb,var(--bg) 50%,transparent);margin-bottom:1rem;">Abstract</div>' +
          '<p style="font-size:0.92rem;color:color-mix(in srgb,var(--bg) 82%,transparent);line-height:1.8;">' + md(r.abstract) + '</p></div>' : ''));
    },

    projects: function (d) {
      var items = list(d.projects);
      set('cv-projects', items.map(function (e, i) {
        var link = e.link && e.link.url ? extlink(e.link.url, e.link.label || 'View project', 'margin-top:0.8rem;display:inline-flex;') : '';
        return '<div style="display:flex;gap:2rem;flex-wrap:wrap;align-items:flex-start;padding:1.5rem;background:var(--card);border-left:3px solid var(--accent);' + (i < items.length - 1 ? 'margin-bottom:1rem;' : '') + '">' +
          (e.image ? '<img src="' + e.image + '" alt="' + esc(e.imageAlt || e.title) + '" style="width:220px;flex-shrink:0;border-radius:2px;box-shadow:0 4px 14px rgba(0,0,0,0.12);">' : '') +
          '<div style="flex:1;min-width:240px;">' +
            '<div style="font-family:\'Sometype Mono\',monospace;font-size:0.65rem;letter-spacing:0.1em;color:var(--accent);margin-bottom:0.4rem;text-transform:uppercase;">' + esc(e.status) + '</div>' +
            '<div style="font-weight:500;font-size:0.95rem;margin-bottom:0.5rem;">' + esc(e.title) + '</div>' +
            '<div style="font-size:0.82rem;color:var(--muted);line-height:1.65;">' + md(e.description) + '</div>' +
            link +
          '</div></div>';
      }).join(''));
      showSection('projects', items.length > 0);
    },

    publications: function (d) {
      var items = list(d.publications);
      var types = PUB_ORDER.filter(function (t) { return items.some(function (e) { return e.type === t; }); });
      var years = [];
      items.forEach(function (e) { if (e.year && years.indexOf(String(e.year)) < 0) years.push(String(e.year)); });
      years.sort(function (a, b) { return b.localeCompare(a); });
      set('cv-pubfilters',
        '<div class="fgrp" id="tF"><button class="fbtn act" data-t="all">All types</button>' +
        types.map(function (t) { return '<button class="fbtn" data-t="' + t + '">' + PUB_TYPES[t].filter + '</button>'; }).join('') + '</div>' +
        '<div class="fdiv"></div>' +
        '<div class="fgrp" id="yF"><button class="fbtn yr act" data-y="all">All years</button>' +
        years.map(function (y) { return '<button class="fbtn yr" data-y="' + esc(y) + '">' + esc(y) + '</button>'; }).join('') + '</div>');
      set('pubList', items.map(function (e) {
        var t = PUB_TYPES[e.type] || PUB_TYPES.conf;
        var links = list(e.links).filter(function (l) { return l.url && l.where !== 'print'; });
        return '<div class="pub-item item-row" data-t="' + esc(e.type) + '" data-y="' + esc(e.year) + '" onclick="togPub(this)">' +
          '<div class="pub-head">' +
            '<div class="pub-yr">' + esc(e.year) + '</div>' +
            '<div>' +
              '<div class="pub-title">' + esc(e.title) + '</div>' +
              '<div class="pub-authors">' + authors(e.authors) + '</div>' +
              (e.venue ? '<div class="pub-venue">' + esc(e.venue) + '</div>' : '') +
            '</div>' +
            '<div class="pub-right"><span class="pbadge ' + t.cls + '"' + (t.style ? ' style="' + t.style + '"' : '') + '>' + t.label + '</span><span class="chev">' + CHEV + '</span></div>' +
          '</div>' +
          '<div class="pub-body"><div class="pub-inner">' +
            (e.abstract ? '<p>' + md(e.abstract) + '</p>' : '') +
            (e.reference ? '<p>' + md(e.reference) + '</p>' : '') +
            (e.extra ? '<p>' + md(e.extra) + '</p>' : '') +
            (links.length ? '<div class="pub-links">' + links.map(function (l) { return extlink(l.url, l.label || stripUrl(l.url)); }).join('') + '</div>' : '') +
          '</div></div>' +
        '</div>';
      }).join(''));
      showSection('publications', items.length > 0);
    },

    teaching: function (d) {
      var items = list(d.teaching), L = d.labels || {};
      function tItem(e) {
          return '<div class="titem item-row" onclick="togT(this)">' +
            '<div class="titem-head"><div>' +
              '<div class="tp">' + esc(normDate(e.dates)) + '</div>' +
              '<div class="tt">' + esc(e.title) + (e.role ? ' <span class="wk-rbadge" style="vertical-align:middle;margin-left:0.4rem;">' + esc(e.role) + '</span>' : '') + '</div>' +
              '<div class="ts">' + esc(e.subtitle) + '</div>' +
            '</div><span class="chev">' + CHEV + '</span></div>' +
            '<div class="texpand"><div class="tgrid">' +
              list(e.details).filter(function (kv) { return kv[0] || kv[1]; }).map(function (kv) {
                return '<span class="tk">' + esc(kv[0]) + '</span><span class="tv">' + md(kv[1]) + '</span>';
              }).join('') +
            '</div></div></div>';
      }
      // same sub-sections as the printed CV
      var main = items.filter(function (e) { return e.category !== 'guest'; }), guest = items.filter(function (e) { return e.category === 'guest'; });
      set('cv-teaching',
        (main.length ? '<div class="tcol-title">' + esc(L.teachingMain || 'Lecturer & Teaching Assistant') + '</div>' + main.map(tItem).join('') : '') +
        (guest.length ? '<div class="tcol-title"' + (main.length ? ' style="margin-top:4.5rem;"' : '') + '>' + esc(L.teachingGuest || 'Guest Lectures & Reviews') + '</div>' + guest.map(tItem).join('') : ''));
      var th = list(d.theses);
      set('cv-theses', th.map(function (e) {
        var more = e.summary || e.url;
        if (!more) return '<div class="thcard"><div class="th-yr">' + esc(normDate(e.date)) + '</div><div class="th-title">' + esc(e.title) + '</div></div>';
        return '<div class="thcard item-row" onclick="togTh(this)">' +
          '<span class="chev th-chev">' + CHEV + '</span>' +
          '<div class="th-yr">' + esc(normDate(e.date)) + '</div>' +
          '<div class="th-title">' + esc(e.title) + '</div>' +
          '<div class="th-expand">' + md(e.summary) + (e.url ? (e.summary ? '<br>' : '') + extlink(e.url, 'View thesis', 'margin-top:0.6rem;') : '') + '</div>' +
        '</div>';
      }).join(''));
      var wrap = $('cv-theses-wrap'); if (wrap) wrap.style.display = th.length ? '' : 'none';
      showSection('teaching', items.length > 0 || th.length > 0 || list(d.workshops).length > 0);
    },

    workshops: function (d) {
      var items = list(d.workshops), L = d.labels || {};
      function wItem(e) {
        return '<div class="wkitem' + (e.highlight ? ' leader' : '') + ' item-row" onclick="togWk(this)">' +
          '<div class="wk-hrow"><span class="wk-date">' + esc(normDate(e.date)) + '</span>' +
          '<div class="wk-tw"><span class="wk-title">' + esc(e.title) + '</span>' +
          (e.role ? '<span class="wk-rbadge">' + esc(e.role) + '</span>' : '') +
          '<span class="chev">' + CHEV + '</span></div></div>' +
          '<div class="wk-place">' + esc(e.place) + '</div>' +
          '<div class="wk-expand">' + md(e.details) + '</div>' +
        '</div>';
      }
      // on the website all workshops share one sub-section (led ones highlighted); the print splits led / tutored
      set('cv-workshops', items.length ? '<div class="tcol-title">' + esc(L.workshops || 'Workshops') + '</div><div class="wktl reveal">' + items.map(wItem).join('') + '</div>' : '');
      showSection('workshops', items.length > 0);
    },

    researchExperience: function (d) {
      var items = list(d.researchExperience).filter(function (e) { return e.where !== 'print'; });
      set('cv-research-exp', items.map(function (e) {
        var more = list(e.details).filter(function (kv) { return kv[0] || kv[1]; })
          .map(function (kv) { return (kv[0] ? '<strong>' + esc(kv[0]) + ':</strong> ' : '') + md(kv[1]); }).join('<br>');
        var title = e.role != null ? e.role : e.title, org = e.org != null ? e.org : e.sub, sum = e.summary != null ? e.summary : e.body;
        return '<div class="exprow' + (more ? ' item-row" onclick="togExp(this)"' : '" style="cursor:default;"') + '>' +
          '<div class="exp-period">' + esc(normDate(e.dates)) + '</div>' +
          '<div>' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;"><div>' +
              '<div class="exp-role">' + md(title) + '</div>' +
              (org ? '<div class="exp-co">' + md(org) + '</div>' : '') +
              (sum ? '<div class="exp-desc">' + md(sum) + '</div>' : '') +
            '</div>' + (more ? '<span class="chev" style="flex-shrink:0;margin-top:0.2rem;">' + CHEV + '</span>' : '') + '</div>' +
            (more ? '<div class="exp-expand">' + more + '</div>' : '') +
          '</div></div>';
      }).join(''));
      var w = $('cv-research-exp-wrap'); if (w) w.style.display = items.length ? '' : 'none';
    },

    industry: function (d) {
      var items = list(d.industry);
      set('cv-industry', items.map(function (e) {
        var more = [e.duration ? '<strong>Duration:</strong> ' + esc(e.duration) : '', e.tasks ? '<strong>Full tasks:</strong> ' + md(e.tasks) : ''].filter(Boolean).join('<br>');
        return '<div class="exprow item-row" onclick="togExp(this)">' +
          '<div class="exp-period">' + esc(normDate(e.period)) + '</div>' +
          '<div>' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;"><div>' +
              '<div class="exp-role">' + esc(e.role) + '</div>' +
              '<div class="exp-co">' + esc(e.company) +
                (e.url ? ' · <a href="' + esc(e.url) + '" target="_blank" class="extlink" onclick="event.stopPropagation()" style="font-size:0.75rem;">' + EXT + esc(e.urlLabel || stripUrl(e.url)) + '</a>' : '') + '</div>' +
              '<div class="exp-desc">' + md(e.summary) + '</div>' +
            '</div><span class="chev" style="flex-shrink:0;margin-top:0.2rem;">' + CHEV + '</span></div>' +
            '<div class="exp-expand">' + more + '</div>' +
          '</div></div>';
      }).join(''));
      showSection('experience', items.length > 0);
    },

    skills: function (d) {
      set('cv-languages', list(d.languages).map(function (e) {
        var dots = ''; for (var i = 0; i < 5; i++) dots += '<div class="dot' + (i < (+e.dots || 0) ? ' f' : '') + '"></div>';
        return '<div class="lang-item"><span class="lang-name">' + esc(e.name) + '</span><span class="lang-lv">' + esc(e.level) + '</span><div class="dots">' + dots + '</div></div>';
      }).join(''));
      var sw = list(d.software).filter(function (e) { return e.where !== 'print'; });
      set('cv-software', swGroups(sw).map(function (g) {
        return '<div class="sgrp"><div class="sglbl">' + esc(g.group) + '</div><div class="sbars">' +
          g.items.map(function (e) { return '<span class="stag">' + esc(e.name) + '</span>'; }).join('') + '</div></div>';
      }).join(''));
      var ss = list(d.softSkills);
      set('cv-softskills', ss.map(function (e) {
        return '<div style="background:var(--bg);padding:1.25rem;">' +
          '<div style="font-family:\'Sometype Mono\',monospace;font-size:0.6rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);margin-bottom:0.5rem;">' + esc(e.title) + '</div>' +
          '<div style="font-size:0.82rem;line-height:1.6;color:var(--muted);">' + md(e.text) + '</div></div>';
      }).join(''));
      var show = function (id, on) { var el = $(id); if (el) el.style.display = on ? '' : 'none'; };
      show('cv-languages-wrap', list(d.languages).length > 0);
      show('cv-software-wrap', sw.length > 0);
      show('cv-softskills-wrap', ss.length > 0);
      var items = list(d.roles);
      var B = ['var(--accent)', 'var(--accent2)', 'var(--accent3)', 'var(--rule)'];
      var C = ['var(--accent)', 'var(--accent2)', 'var(--accent3)', 'var(--muted)'];
      set('cv-roles', items.map(function (e, i) {
        return '<div style="padding:1.25rem;background:var(--bg);border-left:3px solid ' + B[i % 4] + ';">' +
          '<div style="font-family:\'Sometype Mono\',monospace;font-size:0.65rem;letter-spacing:0.1em;color:' + C[i % 4] + ';margin-bottom:0.3rem;">' + esc(normDate(e.dates)) + '</div>' +
          '<div style="font-weight:500;font-size:0.88rem;margin-bottom:0.3rem;">' + esc(e.title) + '</div>' +
          '<div style="font-size:0.78rem;color:var(--muted);">' + md(e.description) + '</div></div>';
      }).join(''));
      show('cv-roles-wrap', items.length > 0);
      showSection('skills', list(d.languages).length + sw.length + ss.length + items.length > 0);
    }
  };


  /* ════════════ THEME: colours + fonts (theme in cv-data.js, set in editor.html) ════════════
     With no theme, or the original values, nothing is touched: the CSS defaults apply. */
  var THEME_DEFAULT = { bg: '#F0F0FA', ink: '#1E1830', accent: '#4A1FA6', accent2: '#E8622A', accent3: '#F0A876' };
  var FONTS = {
    original: { label: 'Original', sample: 'Fraunces + Nunito · print: EB Garamond + Jost' },
    literary: { label: 'Literary', sample: 'Libre Baskerville + Libre Franklin', head: "'Libre Baskerville', Georgia, serif", body: "'Libre Franklin', sans-serif",
      url: 'https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Libre+Franklin:wght@300;400;500;600&display=swap' },
    elegant: { label: 'Elegant', sample: 'Cormorant Garamond + Work Sans', head: "'Cormorant Garamond', Georgia, serif", body: "'Work Sans', sans-serif",
      url: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Work+Sans:wght@300;400;500;600&display=swap' },
    editorial: { label: 'Editorial', sample: 'Instrument Serif + Instrument Sans', head: "'Instrument Serif', Georgia, serif", body: "'Instrument Sans', sans-serif",
      url: 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Instrument+Sans:wght@400;500;600&display=swap' },
    scholarly: { label: 'Scholarly', sample: 'DM Serif Display + Inter', head: "'DM Serif Display', Georgia, serif", body: "'Inter', sans-serif",
      url: 'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Inter:wght@300;400;500;600&display=swap' },
    warm: { label: 'Warm', sample: 'Lora + Source Sans 3', head: "'Lora', Georgia, serif", body: "'Source Sans 3', sans-serif",
      url: 'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Source+Sans+3:wght@300;400;500;600&display=swap' },
    calm: { label: 'Calm', sample: 'Newsreader + Public Sans', head: "'Newsreader', Georgia, serif", body: "'Public Sans', sans-serif",
      url: 'https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,700;1,6..72,400&family=Public+Sans:wght@300;400;500;600&display=swap' },
    modern: { label: 'Modern', sample: 'Space Grotesk + Inter', head: "'Space Grotesk', sans-serif", body: "'Inter', sans-serif",
      url: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap' },
    minimal: { label: 'Minimal', sample: 'Inter Tight', head: "'Inter Tight', sans-serif", body: "'Inter Tight', sans-serif",
      url: 'https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap' },
    technical: { label: 'Technical', sample: 'IBM Plex Serif + IBM Plex Sans', head: "'IBM Plex Serif', Georgia, serif", body: "'IBM Plex Sans', sans-serif",
      url: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Serif:ital,wght@0,400;0,500;0,700;1,400&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap' },
    bold: { label: 'Bold', sample: 'Syne + Karla', head: "'Syne', sans-serif", body: "'Karla', sans-serif",
      url: 'https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Karla:wght@300;400;500;600&display=swap' },
    playful: { label: 'Playful', sample: 'Bricolage Grotesque + Figtree', head: "'Bricolage Grotesque', sans-serif", body: "'Figtree', sans-serif",
      url: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700&family=Figtree:wght@300;400;500;600&display=swap' }
  };
  function hex6(c) { c = String(c || '').trim(); if (/^#[0-9a-f]{3}$/i.test(c)) c = '#' + c.slice(1).split('').map(function (x) { return x + x; }).join(''); return /^#[0-9a-f]{6}$/i.test(c) ? c : null; }
  function rgbOf(c) { c = hex6(c) || '#000000'; return [1, 3, 5].map(function (i) { return parseInt(c.slice(i, i + 2), 16); }); }
  function mix(a, b, t) { var x = rgbOf(a), y = rgbOf(b); return '#' + [0, 1, 2].map(function (i) { var v = Math.round(x[i] * t + y[i] * (1 - t)); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
  function lum(c) { return rgbOf(c).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce(function (s, v, i) { return s + v * [0.2126, 0.7152, 0.0722][i]; }, 0); }
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function palette(d) {
    var p = (d && d.theme && d.theme.palette) || {}, o = {};
    Object.keys(THEME_DEFAULT).forEach(function (k) { o[k] = hex6(p[k]) || THEME_DEFAULT[k]; });
    return o;
  }
  function isDefault(pl) { return Object.keys(THEME_DEFAULT).every(function (k) { return pl[k].toLowerCase() === THEME_DEFAULT[k].toLowerCase(); }); }
  var THEME_VARS = ['--bg', '--ink', '--accent', '--accent2', '--accent3', '--muted', '--rule', '--card', '--on-accent', '--accent-dark', '--bp', '--bp-bg', '--about-text', '--paper', '--olive', '--f-head', '--f-body', '--fp-head', '--fp-body'];
  function applyTheme(d, kind) {
    var st = document.documentElement.style, pl = palette(d), th = (d && d.theme) || {}, v = {};
    THEME_VARS.forEach(function (k) { st.removeProperty(k); });
    if (!isDefault(pl)) {
      var dark = lum(pl.bg) < 0.2;
      if (kind === 'print') { v['--accent'] = pl.accent; v['--olive'] = pl.accent2; v['--accent-dark'] = mix(pl.accent, '#000000', 0.78); }
      else {
        v['--bg'] = pl.bg; v['--ink'] = pl.ink; v['--accent'] = pl.accent; v['--accent2'] = pl.accent2; v['--accent3'] = pl.accent3;
        v['--muted'] = mix(pl.ink, pl.bg, 0.63); v['--rule'] = mix(pl.accent, pl.bg, 0.16); v['--card'] = mix(pl.accent, pl.bg, 0.07);
        v['--on-accent'] = contrast(pl.accent, '#ffffff') >= 3 ? '#ffffff' : pl.ink;
        v['--accent-dark'] = mix(pl.accent, '#000000', 0.78); v['--bp'] = mix(pl.accent, pl.bg, 0.75); v['--bp-bg'] = mix(pl.accent, pl.bg, 0.12);
        v['--about-text'] = mix(pl.ink, pl.bg, 0.86); v['--paper'] = dark ? mix(pl.bg, '#ffffff', 0.9) : '#ffffff';
      }
    }
    var f = FONTS[th.fonts];
    if (f && f.url) {
      if (kind === 'print') { v['--fp-head'] = f.head; v['--fp-body'] = f.body; } else { v['--f-head'] = f.head; v['--f-body'] = f.body; }
      var link = document.getElementById('cv-theme-fonts');
      if (!link) { link = document.createElement('link'); link.id = 'cv-theme-fonts'; link.rel = 'stylesheet'; document.head.appendChild(link); }
      if (link.getAttribute('href') !== f.url) link.setAttribute('href', f.url);
    }
    Object.keys(v).forEach(function (k) { st.setProperty(k, v[k]); });
  }

  function mountWeb(d) {
    if (!d) return;
    applyTheme(d, 'web');
    Object.keys(WEB).forEach(function (k) {
      try { WEB[k](d); } catch (err) { console.error('CV render (web) failed in', k, err); }
    });
  }

  /* ════════════════════════════  PRINT  ════════════════════════════ */
  function secTitle(num, label, olive) {
    return '<div class="sec-title' + (olive ? ' olive' : '') + '"><span class="sec-num">' + num + '</span> ' + label + '</div>';
  }
  function entry(date, title, sub, bodies, cls) {
    return '<div class="entry' + (cls || '') + '">' +
      '<div class="e-date">' + date + '</div><div>' +
      '<div class="e-title">' + title + '</div>' +
      (sub ? '<div class="e-sub">' + sub + '</div>' : '') +
      (bodies || []).filter(function (b) { return b && b.html; }).map(function (b) {
        return '<div class="e-body' + (b.italic ? ' e-italic' : '') + '">' + b.html + '</div>';
      }).join('') +
      '</div></div>';
  }
  var GROUP_FIRST = 'font-size:7pt;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:var(--mid);margin-bottom:0.5rem;';
  var GROUP_NEXT = 'font-size:7pt;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:var(--mid);margin:0.75rem 0 0.5rem;';
  // Heading + first item stay together on the page, the rest can flow
  function keepWithFirst(head, items) {
    if (!items.length) return '';
    // the first item sits inside the wrapper, so CSS treats it as :last-child and drops its
    // separator line — put the line back when more items follow
    var first = items.length > 1
      ? items[0].replace(/^<div class="([^"]*)"/, '<div class="$1" style="border-bottom:0.5pt solid var(--rule);"')
      : items[0];
    return '<div class="avoid-break">' + head + first + '</div>' + items.slice(1).join('');
  }
  function plink(url) { return url ? ' <a href="' + esc(url) + '" class="pub-link-print">' + esc(stripUrl(url)) + '</a>' : ''; }

  function byYear(items) {
    // newest year first; publications of the same year keep the order of the list
    var sorted = items.map(function (e, i) { return { e: e, i: i }; }).sort(function (a, b) {
      return (parseInt(b.e.year, 10) || 0) - (parseInt(a.e.year, 10) || 0) || a.i - b.i;
    });
    var g = [];
    sorted.forEach(function (x) { var y = String(x.e.year || ''), l = g[g.length - 1]; if (!l || l.year !== y) g.push(l = { year: y, items: [] }); l.items.push(x.e); });
    return g;
  }

  // one-off items (a talk, a workshop, a thesis) grouped by year, like the publications:
  // the year labels the group, each entry keeps only its day/month
  function yearOf(s) { var m = normDate(s).match(/(\d{4})(?!.*\d{4})/); return m ? m[1] : ''; }
  function whenNoYear(s) { return normDate(s).replace(/\s*\b\d{4}\b\s*$/, '').trim(); }
  function timeline(items, dateOf, render, head, sub) {
    var groups = [];
    items.forEach(function (e) { var y = yearOf(dateOf(e)), l = groups[groups.length - 1]; if (!l || l.year !== y) groups.push(l = { year: y, items: [] }); l.items.push(e); });
    return groups.map(function (g, gi) {
      var rows = g.items.map(render);
      return '<div class="ygrp' + (gi === 0 ? ' yfirst' : '') + (gi % 2 ? ' yodd' : '') + '"><div class="avoid-break">' + (gi === 0 ? (head || '') + (sub ? '<div class="tsub">' + esc(sub) + '</div>' : '') : '') +
        '<div class="ybody"><div class="ylab">' + esc(g.year) + '</div>' + rows[0] + '</div></div>' +
        (rows.length > 1 ? '<div class="ybody ycont">' + rows.slice(1).join('') + '</div>' : '') + '</div>';
    }).join('');
  }
  function tlItem(when, title, sub, body) {
    return '<div class="pub-entry avoid-break">' + (when ? '<div class="tl-when">' + esc(when) + '</div>' : '') +
      '<div class="e-title">' + title + '</div>' + (sub ? '<div class="e-sub">' + sub + '</div>' : '') +
      (body ? '<div class="e-body">' + body + '</div>' : '') + '</div>';
  }

  function sub(label) { return '<div class="tsub">' + esc(label) + '</div>'; }

  var PRINT = {
    education: function (d) {
      var items = list(d.education);
      if (!items.length) return '';
      return '<div class="sec avoid-break">' + secTitle('01', 'Education') + items.map(function (e) {
        var title = esc(e.degree) + (e.grade && e.gradeWhere !== 'web' ? ' &nbsp;<span style="font-weight:300;color:var(--light);">' + esc(e.grade) + '</span>' : '');
        return entry(dateHTML(e.dates), title, md(P('education', e, 'sub')), [
          e.thesis ? { html: '"' + esc(e.thesis) + '"', italic: true } : null,
          { html: md(P('education', e, 'note')) }
        ]);
      }).join('') + '</div>';
    },
    research: function (d) {
      var r = d.research || {};
      if (!r.title) return '';
      var meta = r.printMeta || [r.institution, r.department ? 'Dept. of ' + r.department : '', r.since ? 'Since ' + normDate(r.since) : '', r.supervisors ? 'Supervisors: ' + r.supervisors : ''].filter(Boolean).join(' · ');
      var tags = list(r.tags).concat(list(r.printExtraTags));
      return '<div class="ssec avoid-break">' + sub('PhD Research') +
        '<div style="padding:0.5rem 0.6rem;border-left:1.5pt solid var(--olive);margin-bottom:0.75rem;">' +
          '<div style="font-family:var(--fp-head);font-size:11pt;font-weight:500;line-height:1.3;margin-bottom:0.4rem;">"' + esc(r.title) + '"</div>' +
          '<div style="font-size:8pt;color:var(--mid);">' + md(meta) + '</div>' +
        '</div>' +
        (r.abstract ? '<div style="font-size:7pt;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:var(--mid);margin-bottom:0.4rem;">Abstract</div>' +
          '<p style="font-size:8pt;color:var(--mid);line-height:1.65;margin-bottom:0.75rem;">' + md(r.abstract) + '</p>' : '') +
        '<div class="tags">' + tags.map(function (t) { return '<span class="tag-print">' + esc(t) + '</span>'; }).join('') + '</div>' +
        '</div>';
    },
    projects: function (d) {
      var items = list(d.projects);
      if (!items.length) return '';
      return '<div class="ssec avoid-break">' + sub('Projects') + items.map(function (e) {
        return entry(esc(e.status), esc(e.title), '', [{ html: md(P('projects', e, 'body')) + plink(e.link && e.link.url) }]);
      }).join('') + '</div>';
    },
    publications: function (d) {
      // grouped by type (sub-heading), then by year on a timeline; the line breaks between types
      var items = list(d.publications);
      if (!items.length) return '';
      function pub(e) {
        var links = list(e.links).filter(function (l) { return l.url && l.where !== 'web'; });
        var ref = P('publications', e, 'ref');
        return '<div class="pub-entry avoid-break">' +
          '<div class="pub-title-print">' + esc(e.title) + '</div>' +
          '<div class="pub-authors-print">' + authors(e.authors) + '</div>' +
          (ref ? '<div class="pub-ref">' + md(ref) + '</div>' : '') +
          (links.length ? '<div class="pub-links-print">' + links.map(function (l) {
            var label = l.printLabel || (/^DOI/i.test(l.label || '') ? l.label : stripUrl(l.url));
            return '<a href="' + esc(l.url) + '" class="pub-link-print">' + esc(label) + '</a>';
          }).join(' ') + '</div>' : '') +
        '</div>';
      }
      var head = secTitle('03', 'Publications') +
        '<div style="font-family:\'Sometype Mono\',monospace;font-size:6.5pt;color:var(--mid);letter-spacing:0.04em;margin-bottom:0.5rem;">* presenting author</div>';
      var typeOf = function (e) { return PUB_TYPES[e.type] ? e.type : 'conf'; };
      var types = PUB_ORDER.filter(function (t) { return items.some(function (e) { return typeOf(e) === t; }); });
      var out = '';
      types.forEach(function (tp, ti) {
        byYear(items.filter(function (e) { return typeOf(e) === tp; })).forEach(function (g, gi) {
          var rows = g.items.map(pub);
          // heading (+ type) + year + first publication never split across pages
          out += '<div class="ygrp' + (gi === 0 ? ' yfirst' : '') + (gi % 2 ? ' yodd' : '') + '"><div class="avoid-break">' +
            (ti === 0 && gi === 0 ? head : '') +
            (gi === 0 ? '<div class="tsub">' + esc(PUB_TYPES[tp].filter) + '</div>' : '') +
            '<div class="ybody"><div class="ylab">' + esc(g.year) + '</div>' + rows[0] + '</div></div>' +
            (rows.length > 1 ? '<div class="ybody ycont">' + rows.slice(1).join('') + '</div>' : '') +
          '</div>';
        });
      });
      return '<div class="sec">' + out + '</div>';
    },
    teaching: function (d) {
      var L = d.labels || {};
      var T = list(d.teaching), W = list(d.workshops);
      function tRow(e) { return entry(dateHTML(e.dates), md(P('teaching', e, 'title')), md(P('teaching', e, 'sub')), [{ html: md(P('teaching', e, 'body')) }], ' avoid-break'); }
      function wRow(e) { return entry(dateHTML(e.date), esc(e.title), md(P('workshops', e, 'sub')), [{ html: md(P('workshops', e, 'body')) }], ' avoid-break'); }
      function wGroup(e) { return e.printGroup || (e.highlight ? 'led' : 'tutored'); }
      var main = T.filter(function (e) { return e.category !== 'guest'; });
      var tlT = function (e) { return tlItem(whenNoYear(e.dates), md(P('teaching', e, 'title')), md(P('teaching', e, 'sub')), md(P('teaching', e, 'body'))); };
      var tlW = function (e) { return tlItem(whenNoYear(e.date), esc(e.title), md(P('workshops', e, 'sub')), md(P('workshops', e, 'body'))); };
      var out = '', first = true;
            if (main.length) out += keepWithFirst(sub(L.teachingMain || 'Lecturer & Teaching Assistant'), main.map(tRow));
      [[L.teachingGuest || 'Guest Lectures & Reviews', T.filter(function (e) { return e.category === 'guest'; }), function (e) { return e.dates; }, tlT],
       [L.workshopsLed || 'Workshops Designed & Led', W.filter(function (e) { return wGroup(e) === 'led'; }), function (e) { return e.date; }, tlW],
       [L.workshopsTutored || 'Workshops Tutored & Co-organised', W.filter(function (e) { return wGroup(e) !== 'led'; }), function (e) { return e.date; }, tlW]
      ].forEach(function (g) { if (g[1].length) out += timeline(g[1], g[2], g[3], '', g[0]); });
      return out;
    },
    theses: function (d) {
      var items = list(d.theses);
      if (!items.length) return '';
      return '<div class="ssec">' + timeline(items, function (e) { return e.date; }, function (e) {
        var body = (md(P('theses', e, 'body')) + plink(e.url)).replace(/^ /, '');
        return tlItem('', md(P('theses', e, 'title')), '', body);  // year only, no month
      }, '', 'Co-supervised Master\'s Theses') + '</div>';
    },
    researchExperience: function (d) {
      var items = list(d.researchExperience).filter(function (e) { return e.where !== 'web'; });
      if (!items.length) return '';
      return '<div class="ssec avoid-break">' + sub('Research Experience') + items.map(function (e) {
        return entry(dateHTML(e.dates), md(P('researchExperience', e, 'title')), md(P('researchExperience', e, 'sub')), [{ html: md(P('researchExperience', e, 'body')) }]);
      }).join('') + '</div>';
    },
    industry: function (d) {
      var items = list(d.industry);
      if (!items.length) return '';
      return '<div class="sec avoid-break">' + secTitle('05', 'Industry Experience') + items.map(function (e) {
        return entry(dateHTML(e.period), md(P('industry', e, 'title')), '', [{ html: md(P('industry', e, 'body')) }]);
      }).join('') + '</div>';
    }
  };

  function mountPrint(d) {
    if (!d) return;
    applyTheme(d, 'print');
    var p = d.profile || {};
    set('cv-p-role', esc(p.printRole));
    set('cv-p-contact', '<a href="mailto:' + esc(p.email) + '">' + esc(p.email) + '</a><br>' + esc(p.basedPrint));
    set('cv-p-bio', md(p.bio));
    var html = '';
    function run(k) { try { return PRINT[k](d); } catch (err) { console.error('CV render (print) failed in', k, err); return ''; } }
    function withId(h, id) { return h.replace(/^<div class="sec/, '<div id="' + id + '" class="sec'); }
    function group(id, num, label, parts) { var inner = parts.join(''); return inner ? '<div id="' + id + '" class="sec">' + secTitle(num, label) + inner + '</div>' : ''; }
    html += withId(run('education'), 'p-education');
    html += group('p-research', '02', 'Research', [run('research'), run('projects'), run('researchExperience')]);
    html += withId(run('publications'), 'p-publications');
    html += group('p-teaching', '04', 'Teaching', [run('teaching'), run('theses')]);
    html += withId(run('industry'), 'p-industry');
    set('cv-p-main', html);
    set('cv-p-languages', list(d.languages).map(function (e) {
      var dots = ''; for (var i = 0; i < 5; i++) dots += '<div class="ldot' + (i < (+e.dots || 0) ? ' f' : '') + '"></div>';
      return '<div class="lang-row"><span>' + esc(e.name) + '</span><span class="lang-lv">' + esc(e.level) + '</span><div class="lang-dots">' + dots + '</div></div>';
    }).join(''));
    var RC = ['role-card"', 'role-card olive"', 'role-card" style="border-color:var(--accent);opacity:0.7;"', 'role-card mid"'];
    set('cv-p-roles', list(d.roles).map(function (e, i) {
      return '<div class="' + RC[i % 4] + '>' +
        '<div class="rc-date">' + dateHTML(e.dates) + '</div>' +
        '<div class="rc-title">' + esc(e.title) + '</div>' +
        '<div class="rc-body">' + md(P('roles', e, 'body')) + '</div></div>';
    }).join(''));
    var psw = list(d.software).filter(function (e) { return e.where !== 'web'; });
    set('cv-p-software', swGroups(psw).map(function (g) {
      return '<div class="sw-grp">' + esc(g.group) + '</div><div class="tags">' + g.items.map(function (e) { return '<span class="tag-print">' + esc(e.name) + '</span>'; }).join('') + '</div>';
    }).join(''));
    set('cv-p-softskills', list(d.softSkills).map(function (e) {
      return '<div class="entry"><div class="e-date">' + esc(e.title) + '</div><div class="e-body" style="margin-top:0;">' + md(e.text) + '</div></div>';
    }).join(''));
    var nL = list(d.languages).length, nS = list(d.softSkills).length;
    [['p-languages', nL], ['p-software', psw.length], ['p-roles', list(d.roles).length]].forEach(function (x) {
      var el = $(x[0]); if (el) el.style.visibility = x[1] ? '' : 'hidden';
    });
    var el = $('p-softskills'); if (el) el.style.display = nS ? '' : 'none';
    el = $('p-skills'); if (el) el.style.display = (nL || psw.length || nS || list(d.roles).length) ? '' : 'none';
    el = $('p-languages'); if (el && el.parentElement) el.parentElement.style.display = (nL || psw.length) ? '' : 'none';
    // one-line index of sections, each a link (kept as PDF links when saved from Chrome)
    var TOC = [['01', 'Education', 'p-education'], ['02', 'Research', 'p-research'], ['03', 'Publications', 'p-publications'],
      ['04', 'Teaching', 'p-teaching'], ['05', 'Industry Experience', 'p-industry'], ['06', 'Competencies', 'p-skills']];
    set('cv-p-toc', TOC.filter(function (t) { var el = $(t[2]); return el && el.style.visibility !== 'hidden' && el.style.display !== 'none' && el.textContent.trim(); }).map(function (t) {
      return '<a href="#' + t[2] + '"><span>' + t[0] + '</span>' + t[1] + '</a>';
    }).join(' <span class="dot">·</span> '));
  }

  // ── Live preview (used by editor.html, pages opened with ?preview) ──
  function enablePreview(kind, afterRender) {
    if (!/[?&]preview/.test(location.search)) return;
    window.addEventListener('message', function (ev) {
      var m = ev.data || {};
      if (m.type === 'cv-data' && m.data) {
        (kind === 'print' ? mountPrint : mountWeb)(m.data);
        if (afterRender) afterRender();
      }
      if (m.type === 'cv-scroll' && m.target) {
        var el = document.getElementById(m.target);
        if (el && el.offsetParent !== null) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    if (window.parent !== window) window.parent.postMessage({ type: 'cv-ready', page: kind }, '*');
  }

  global.CVRender = {
    mountWeb: mountWeb, mountPrint: mountPrint, enablePreview: enablePreview,
    AUTO: AUTO, P: P, md: md, esc: esc, plain: plain, stripUrl: stripUrl, abbrMonth: abbrMonth, normDate: normDate, levelWord: levelWord,
    PUB_TYPES: PUB_TYPES, FONTS: FONTS, THEME_DEFAULT: THEME_DEFAULT, mix: mix, contrast: contrast, lum: lum
  };
})(window);
