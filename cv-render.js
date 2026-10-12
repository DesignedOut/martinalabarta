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
  function printRange(s) { return String(s || '').replace(/\s*\n\s*/g, ' ').replace(/\s*–\s*/g, '–'); }
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
          return /^(type|programme|program)$/i.test(kv[0]) ? kv[1] : (kv[0] ? kv[0] + ': ' : '') + kv[1];
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
    thesis:  { label: 'Thesis',          filter: 'Thesis',            cls: '',   printCls: ' mid', style: 'background:rgba(74,31,166,0.08);color:var(--accent);' }
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
          '<div class="edu-year">' + esc(e.dates) + '</div>' +
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
        '<div class="phd-label">02 — PhD Research</div>' +
        '<div class="phd-title">' + esc(r.title) + '</div>' +
        '<div class="phd-meta">' +
          (r.institution ? '<span>Institution <strong>' + esc(r.institution) + '</strong></span>' : '') +
          (r.department ? '<span>Department <strong>' + esc(r.department) + '</strong></span>' : '') +
          (r.since ? '<span>Since <strong>' + esc(r.since) + '</strong></span>' : '') +
          (r.expected ? '<span>Expected <strong>' + esc(r.expected) + '</strong></span>' : '') +
        '</div>' +
        '<div class="ftags">' + list(r.tags).map(function (t) { return '<span class="ftag">' + esc(t) + '</span>'; }).join('') + '</div>' +
        (r.abstract ?
          '<div style="margin-top:2.5rem;max-width:780px;border-top:1px solid rgba(255,255,255,0.1);padding-top:2rem;">' +
          '<div style="font-family:\'Sometype Mono\',monospace;font-size:0.6rem;letter-spacing:0.18em;text-transform:uppercase;color:rgba(240,240,250,0.5);margin-bottom:1rem;">Abstract</div>' +
          '<p style="font-size:0.92rem;color:rgba(240,240,250,0.82);line-height:1.8;">' + md(r.abstract) + '</p></div>' : ''));
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
      set('cv-teaching', '<div class="tcol-title">' + esc(L.teachingMain || 'Lecturer & Teaching Assistant') + '</div>' +
        items.map(function (e) {
          return '<div class="titem item-row" onclick="togT(this)">' +
            '<div class="titem-head"><div>' +
              '<div class="tp">' + esc(e.dates) + '</div>' +
              '<div class="tt">' + esc(e.title) + (e.role ? ' <span class="wk-rbadge" style="vertical-align:middle;margin-left:0.4rem;">' + esc(e.role) + '</span>' : '') + '</div>' +
              '<div class="ts">' + esc(e.subtitle) + '</div>' +
            '</div><span class="chev">' + CHEV + '</span></div>' +
            '<div class="texpand"><div class="tgrid">' +
              list(e.details).filter(function (kv) { return kv[0] || kv[1]; }).map(function (kv) {
                return '<span class="tk">' + esc(kv[0]) + '</span><span class="tv">' + md(kv[1]) + '</span>';
              }).join('') +
            '</div></div></div>';
        }).join(''));
      var th = list(d.theses);
      set('cv-theses', th.map(function (e) {
        var more = e.summary || e.url;
        if (!more) return '<div class="thcard"><div class="th-yr">' + esc(e.date) + '</div><div class="th-title">' + esc(e.title) + '</div></div>';
        return '<div class="thcard item-row" onclick="togTh(this)">' +
          '<span class="chev th-chev">' + CHEV + '</span>' +
          '<div class="th-yr">' + esc(e.date) + '</div>' +
          '<div class="th-title">' + esc(e.title) + '</div>' +
          '<div class="th-expand">' + md(e.summary) + (e.url ? (e.summary ? '<br>' : '') + extlink(e.url, 'View thesis', 'margin-top:0.6rem;') : '') + '</div>' +
        '</div>';
      }).join(''));
      var wrap = $('cv-theses-wrap'); if (wrap) wrap.style.display = th.length ? '' : 'none';
      showSection('teaching', items.length > 0 || th.length > 0);
    },

    workshops: function (d) {
      var items = list(d.workshops);
      set('cv-workshops', items.map(function (e) {
        return '<div class="wkitem' + (e.highlight ? ' leader' : '') + ' item-row" onclick="togWk(this)">' +
          '<div class="wk-hrow"><span class="wk-date">' + esc(e.date) + '</span>' +
          '<div class="wk-tw"><span class="wk-title">' + esc(e.title) + '</span>' +
          (e.role ? '<span class="wk-rbadge">' + esc(e.role) + '</span>' : '') +
          '<span class="chev">' + CHEV + '</span></div></div>' +
          '<div class="wk-place">' + esc(e.place) + '</div>' +
          '<div class="wk-expand">' + md(e.details) + '</div>' +
        '</div>';
      }).join(''));
      showSection('workshops', items.length > 0);
    },

    researchExperience: function (d) {
      var items = list(d.researchExperience).filter(function (e) { return e.where !== 'print'; });
      set('cv-research-exp', items.map(function (e) {
        var more = list(e.details).filter(function (kv) { return kv[0] || kv[1]; })
          .map(function (kv) { return (kv[0] ? '<strong>' + esc(kv[0]) + ':</strong> ' : '') + md(kv[1]); }).join('<br>');
        var title = e.role != null ? e.role : e.title, org = e.org != null ? e.org : e.sub, sum = e.summary != null ? e.summary : e.body;
        return '<div class="exprow' + (more ? ' item-row" onclick="togExp(this)"' : '" style="cursor:default;"') + '>' +
          '<div class="exp-period">' + md(e.dates) + '</div>' +
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
          '<div class="exp-period">' + md(e.period) + '</div>' +
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
      var w = $('cv-industry-wrap'); if (w) w.style.display = items.length ? '' : 'none';
      var hasRes = list(d.researchExperience).some(function (e) { return e.where !== 'print'; });
      if (w) w.style.marginTop = hasRes ? '4rem' : '0';
      showSection('experience', items.length > 0 || hasRes);
    },

    skills: function (d) {
      set('cv-languages', list(d.languages).map(function (e) {
        var dots = ''; for (var i = 0; i < 5; i++) dots += '<div class="dot' + (i < (+e.dots || 0) ? ' f' : '') + '"></div>';
        return '<div class="lang-item"><span class="lang-name">' + esc(e.name) + '</span><span class="lang-lv">' + esc(e.level) + '</span><div class="dots">' + dots + '</div></div>';
      }).join(''));
      var B = ['var(--accent)', 'var(--accent2)', 'var(--accent3)', 'var(--rule)'];
      var C = ['var(--accent)', 'var(--accent2)', 'var(--accent3)', 'var(--muted)'];
      set('cv-roles', list(d.roles).map(function (e, i) {
        return '<div style="padding:1rem;background:var(--bg);border-left:3px solid ' + B[i % 4] + ';">' +
          '<div style="font-family:\'Sometype Mono\',monospace;font-size:0.65rem;letter-spacing:0.1em;color:' + C[i % 4] + ';margin-bottom:0.3rem;">' + esc(e.dates) + '</div>' +
          '<div style="font-weight:500;font-size:0.88rem;margin-bottom:0.3rem;">' + esc(e.title) + '</div>' +
          '<div style="font-size:0.78rem;color:var(--muted);">' + md(e.description) + '</div></div>';
      }).join(''));
      set('cv-software', list(d.software).filter(function (e) { return e.where !== 'print'; }).map(function (e) {
        return '<div class="srow"><span class="slbl">' + esc(e.name) + '</span><div class="sbar"><div class="sfill" data-w="' + ((+e.level || 0) / 100).toFixed(2) + '"></div></div></div>';
      }).join(''));
      set('cv-softskills', list(d.softSkills).map(function (e) {
        return '<div style="background:var(--bg);padding:1.25rem;">' +
          '<div style="font-family:\'Sometype Mono\',monospace;font-size:0.6rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);margin-bottom:0.5rem;">' + esc(e.title) + '</div>' +
          '<div style="font-size:0.82rem;line-height:1.6;color:var(--muted);">' + md(e.text) + '</div></div>';
      }).join(''));
    }
  };

  function mountWeb(d) {
    if (!d) return;
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

  var PRINT = {
    education: function (d) {
      var items = list(d.education);
      if (!items.length) return '';
      return '<div class="sec avoid-break">' + secTitle('01', 'Education') + items.map(function (e) {
        var title = esc(e.degree) + (e.grade && e.gradeWhere !== 'web' ? ' &nbsp;<span style="font-weight:300;color:var(--light);">' + esc(e.grade) + '</span>' : '');
        return entry(esc(e.dates), title, md(P('education', e, 'sub')), [
          e.thesis ? { html: '"' + esc(e.thesis) + '"', italic: true } : null,
          { html: md(P('education', e, 'note')) }
        ]);
      }).join('') + '</div>';
    },
    research: function (d) {
      var r = d.research || {};
      if (!r.title) return '';
      var meta = r.printMeta || [r.institution, r.department ? 'Dept. of ' + r.department : '', r.since ? 'Since ' + r.since : '', r.supervisors ? 'Supervisors: ' + r.supervisors : ''].filter(Boolean).join(' · ');
      var tags = list(r.tags).concat(list(r.printExtraTags));
      return '<div class="sec avoid-break">' + secTitle('02', 'PhD Research', true) +
        '<div style="padding:0.5rem 0.6rem;border-left:1.5pt solid var(--olive);margin-bottom:0.75rem;">' +
          '<div style="font-family:\'EB Garamond\',serif;font-size:11pt;font-weight:500;line-height:1.3;margin-bottom:0.4rem;">"' + esc(r.title) + '"</div>' +
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
      return '<div class="sec avoid-break">' + secTitle('02b', 'Projects', true) + items.map(function (e) {
        return entry(esc(e.status), esc(e.title), '', [{ html: md(P('projects', e, 'body')) + plink(e.link && e.link.url) }]);
      }).join('') + '</div>';
    },
    publications: function (d) {
      var items = list(d.publications);
      if (!items.length) return '';
      var rows = items.map(function (e) {
        var t = PUB_TYPES[e.type] || PUB_TYPES.conf;
        var links = list(e.links).filter(function (l) { return l.url && l.where !== 'web'; });
        var ref = P('publications', e, 'ref');
        return '<div class="pub-entry avoid-break">' +
          '<div class="pub-header-row"><span class="pub-yr-badge">' + esc(e.year) + '</span><span class="pub-title-print">' + esc(e.title) + '</span></div>' +
          '<div class="pub-badge-print' + t.printCls + '">' + t.label + '</div>' +
          '<div class="pub-authors-print">' + authors(e.authors) + '</div>' +
          (ref ? '<div class="pub-ref">' + md(ref) + '</div>' : '') +
          (links.length ? '<div class="pub-links-print">' + links.map(function (l) {
            var label = l.printLabel || (/^DOI/i.test(l.label || '') ? l.label : stripUrl(l.url));
            return '<a href="' + esc(l.url) + '" class="pub-link-print">' + esc(label) + '</a>';
          }).join(' ') + '</div>' : '') +
        '</div>';
      });
      var head = secTitle('03', 'Publications') +
        '<div style="font-family:\'Sometype Mono\',monospace;font-size:6.5pt;color:var(--mid);letter-spacing:0.04em;margin-bottom:0.5rem;">* presenting author</div>';
      return '<div class="sec">' + keepWithFirst(head, rows) + '</div>';
    },
    teaching: function (d) {
      var L = d.labels || {};
      var T = list(d.teaching), W = list(d.workshops);
      function tRow(e) { return entry(esc(e.dates), md(P('teaching', e, 'title')), md(P('teaching', e, 'sub')), [{ html: md(P('teaching', e, 'body')) }], ' avoid-break'); }
      function wRow(e) { return entry(esc(e.date), esc(e.title), md(P('workshops', e, 'sub')), [{ html: md(P('workshops', e, 'body')) }], ' avoid-break'); }
      function wGroup(e) { return e.printGroup || (e.highlight ? 'led' : 'tutored'); }
      var groups = [
        [L.teachingMain || 'Lecturer & Teaching Assistant', T.filter(function (e) { return e.category !== 'guest'; }).map(tRow)],
        [L.teachingGuest || 'Guest Lectures & Reviews', T.filter(function (e) { return e.category === 'guest'; }).map(tRow)],
        [L.workshopsLed || 'Workshops Designed & Led', W.filter(function (e) { return wGroup(e) === 'led'; }).map(wRow)],
        [L.workshopsTutored || 'Workshops Tutored', W.filter(function (e) { return wGroup(e) !== 'led'; }).map(wRow)]
      ].filter(function (g) { return g[1].length; });
      if (!groups.length) return '';
      return '<div class="sec">' + groups.map(function (g, i) {
        var head = (i === 0 ? secTitle('04', 'Teaching Experience') : '') +
          '<div style="' + (i === 0 ? GROUP_FIRST : GROUP_NEXT) + '">' + esc(g[0]) + '</div>';
        return keepWithFirst(head, g[1]);
      }).join('') + '</div>';
    },
    theses: function (d) {
      var items = list(d.theses);
      if (!items.length) return '';
      return '<div class="sec avoid-break">' + secTitle('04b', 'Co-supervised Master\'s Theses') + '<div class="two-col"><div>' +
        items.map(function (e) {
          var body = md(P('theses', e, 'body')) + plink(e.url);
          return '<div class="entry"><div class="e-date">' + esc(abbrMonth(e.date)) + '</div><div>' +
            '<div class="e-title">' + md(P('theses', e, 'title')) + '</div>' +
            (body ? '<div class="e-body">' + body.replace(/^ /, '') + '</div>' : '') + '</div></div>';
        }).join('') + '</div></div></div>';
    },
    researchExperience: function (d) {
      var items = list(d.researchExperience).filter(function (e) { return e.where !== 'web'; });
      if (!items.length) return '';
      return '<div class="sec avoid-break">' + secTitle('05', 'Research Experience') + items.map(function (e) {
        return entry(esc(e.dates), md(P('researchExperience', e, 'title')), md(P('researchExperience', e, 'sub')), [{ html: md(P('researchExperience', e, 'body')) }]);
      }).join('') + '</div>';
    },
    industry: function (d) {
      var items = list(d.industry);
      if (!items.length) return '';
      return '<div class="sec avoid-break">' + secTitle('06', 'Industry Experience') + items.map(function (e) {
        return entry(esc(printRange(e.period)), md(P('industry', e, 'title')), '', [{ html: md(P('industry', e, 'body')) }]);
      }).join('') + '</div>';
    }
  };

  function mountPrint(d) {
    if (!d) return;
    var p = d.profile || {};
    set('cv-p-role', esc(p.printRole));
    set('cv-p-contact', '<a href="mailto:' + esc(p.email) + '">' + esc(p.email) + '</a><br>' + esc(p.basedPrint));
    set('cv-p-bio', md(p.bio));
    var html = '';
    ['education', 'research', 'projects', 'publications', 'teaching', 'theses', 'researchExperience', 'industry'].forEach(function (k) {
      try { html += PRINT[k](d).replace(/^<div class="sec/, '<div id="p-' + k + '" class="sec'); }
      catch (err) { console.error('CV render (print) failed in', k, err); }
    });
    set('cv-p-main', html);
    set('cv-p-languages', list(d.languages).map(function (e) {
      var dots = ''; for (var i = 0; i < 5; i++) dots += '<div class="ldot' + (i < (+e.dots || 0) ? ' f' : '') + '"></div>';
      return '<div class="lang-row"><span>' + esc(e.name) + '</span><span class="lang-lv">' + esc(e.level) + '</span><div class="lang-dots">' + dots + '</div></div>';
    }).join(''));
    var RC = ['role-card"', 'role-card olive"', 'role-card" style="border-color:var(--accent);opacity:0.7;"', 'role-card mid"'];
    set('cv-p-roles', list(d.roles).map(function (e, i) {
      return '<div class="' + RC[i % 4] + '>' +
        '<div class="rc-date">' + esc(e.dates) + '</div>' +
        '<div class="rc-title">' + esc(e.title) + '</div>' +
        '<div class="rc-body">' + md(P('roles', e, 'body')) + '</div></div>';
    }).join(''));
    set('cv-p-software', list(d.software).filter(function (e) { return e.where !== 'web'; }).map(function (e) {
      return '<div class="skill-row"><span class="skill-lbl">' + esc(e.name) + '</span><div class="skill-track"><div class="skill-fill" style="width:' + (+e.level || 0) + '%"></div></div></div>';
    }).join(''));
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
    AUTO: AUTO, P: P, md: md, esc: esc, plain: plain, stripUrl: stripUrl, abbrMonth: abbrMonth,
    PUB_TYPES: PUB_TYPES
  };
})(window);
