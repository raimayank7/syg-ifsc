/* ifsc.shareyourgroup.com: code checker, bank search, page filters, tap-to-copy. Everything runs in the browser. */
(function () {
  'use strict';
  var d = document, N = window.SYG, esc = N.esc, $ = function (s, r) { return (r || d).querySelector(s); }, $$ = function (s, r) { return [].slice.call((r || d).querySelectorAll(s)); };
  var index = null;
  function getIndex() { return index || (index = N.json('/data/index.json')); }

  /* a sponsor picture that does not load leaves no broken-picture box */
  d.addEventListener('error', function (e) { var t = e.target; if (t && t.tagName === 'IMG' && t.closest && t.closest('.sponsor')) t.remove(); }, true);

  /* tap an IFSC code in a table to copy it */
  d.addEventListener('click', function (e) {
    var td = e.target.closest('[data-ifsc-table] td.mono');
    if (td) N.copy(td.textContent.trim(), td.textContent.trim() + ' copied');
  });
  $$('[data-ifsc-table] td.mono').slice(0, 400).forEach(function (td) { td.title = 'Tap to copy'; });
  var st = d.createElement('style'); st.textContent = '[data-ifsc-table] td.mono{cursor:pointer;color:var(--link)}'; d.head.appendChild(st);

  /* filter the branch rows of this page */
  var flt = $('[data-filter]');
  if (flt) {
    var rows = $$(flt.getAttribute('data-rows') || '[data-ifsc-table] tbody tr'), text = null, own = !flt.getAttribute('data-rows'), note = $('[data-filter-n]'), first = note ? note.textContent : '';
    flt.addEventListener('input', function () {
      if (!text) text = rows.map(function (r) { return r.textContent.toLowerCase(); });
      var words = flt.value.toLowerCase().split(/\s+/).filter(Boolean), n = 0;
      rows.forEach(function (r, i) { var ok = words.every(function (w) { return text[i].indexOf(w) > -1; }); r.hidden = !ok; if (ok) n++; });
      $$('[data-ifsc-groups] h2').forEach(function (h) {
        var box = h.nextElementSibling, any = box && $$('tbody tr', box).some(function (r) { return !r.hidden; });
        h.hidden = !any; if (box) box.hidden = !any;
      });
      if (note) note.textContent = words.length ? (n ? n + (n === 1 ? ' row matches.' : ' rows match.') + (own ? ' Tap a code to copy it.' : '') : 'Nothing on this page matches. Check the spelling, or try fewer letters.') : first;
    });
  }
  /* filter a list of links (banks, places) */
  $$('[data-list-filter]').forEach(function (inp) {
    var items = null;
    inp.addEventListener('input', function () {
      if (!items) items = $$(inp.getAttribute('data-list-filter')).reduce(function (a, ul) { return a.concat($$('li', ul)); }, []).map(function (li) { return [li, li.textContent.toLowerCase()]; });
      var words = inp.value.toLowerCase().split(/\s+/).filter(Boolean);
      items.forEach(function (x) { x[0].hidden = !words.every(function (w) { return x[1].indexOf(w) > -1; }); });
      $$('[data-banks]').forEach(function (ul) { var any = $$('li', ul).some(function (li) { return !li.hidden; }); ul.hidden = !any; if (ul.previousElementSibling) ul.previousElementSibling.hidden = !any; });
    });
  });

  /* bank search on the home page */
  var bq = $('[data-bank-search]'), bout = $('[data-bank-out]');
  if (bq) {
    var run = function () {
      var words = bq.value.toLowerCase().split(/\s+/).filter(Boolean);
      if (!words.length) { bout.hidden = true; return; }
      getIndex().then(function (ix) {
        var hits = ix.banks.filter(function (b) { var n = b[0].toLowerCase(); return words.every(function (w) { return n.indexOf(w) > -1; }); })
          .sort(function (a, b) { return b[2] - a[2]; }).slice(0, 12);
        bout.innerHTML = hits.length ? hits.map(function (b) { return '<li><a href="/bank/' + b[1] + '/">' + esc(b[0]) + ' <small>' + b[2].toLocaleString('en-IN') + (b[2] === 1 ? ' branch' : ' branches') + '</small></a></li>'; }).join('')
          : '<li>No bank with that name. Try fewer letters, or see <a href="/banks/">all banks</a>.</li>';
        bout.hidden = false;
      }).catch(function () { bout.innerHTML = '<li>The bank list did not load. Check your connection and try again.</li>'; bout.hidden = false; });
    };
    bq.addEventListener('input', run);
    bq.addEventListener('focus', function () { getIndex().catch(function () {}); }, { once: true });
  }

  /* IFSC checker */
  var form = $('[data-ifsc-form]'), out = $('[data-ifsc-out]');
  function say(html) { out.innerHTML = '<div class="result rise">' + html + '</div>'; }
  function check(raw, quiet) {
    var code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code) { if (!quiet) say('<h2>Type a code first</h2><p>An IFSC code has 11 characters, for example SBIN0000691.</p>'); return; }
    if (/^[A-Z]{4}IN[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(code)) { swiftCode(code); return; }   // a SWIFT code of an Indian bank: 5th and 6th characters IN
    if (code.length === 11 && code.charAt(4) === 'O') code = code.slice(0, 4) + '0' + code.slice(5);   // letter O typed for the zero
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(code)) {
      var why = code.length !== 11 ? 'It has ' + code.length + ' characters; an IFSC code has exactly 11.' : !/^[A-Z]{4}/.test(code) ? 'The first 4 characters must be letters (the bank).' : 'The 5th character must be the digit zero.';
      say('<h2>This is not a valid IFSC code</h2><p class="big">' + esc(code) + '</p><p>' + why + '</p>'); return;
    }
    out.innerHTML = '<div class="shim" style="height:150px;margin-top:14px"></div>';
    getIndex().then(function (ix) {
      var bank4 = code.slice(0, 4), part = ix.parts[bank4];
      var none = function () { say('<h2>No bank uses the code ' + esc(bank4) + '</h2><p class="big">' + esc(code) + '</p><p>The first four letters do not belong to any bank in our list (data as of ' + esc(ix.asof) + '), and the code is not in the older lists we keep either. Check the letters with the person who gave you the code.</p>'); };
      var missing = function () { say('<h2>Branch not found</h2><p class="big">' + esc(code) + '</p><p>The bank code ' + esc(bank4) + ' exists, but no branch has this exact code in our list (data as of ' + esc(ix.asof) + '), and it is not among the old codes we keep. It may be mistyped or very new. Check it on the cheque book or with the bank.</p>'); };
      if (part == null) return oldCode(ix, code, none);
      return N.json('/data/' + bank4 + (part ? '-' + (code.slice(4).split('').reduce(function (n, c) { return n + c.charCodeAt(0); }, 0) % part) : '') + '.json').then(function (j) {
        var r = j[code.slice(4)];
        if (!r) return oldCode(ix, code, missing);
        var b = ix.banks[r[0]], s = ix.states[r[3]] || ['', ''], f = r[8];
        if (r[2] && r[1].toLowerCase().indexOf(r[2].toLowerCase()) > -1) r[2] = '';   // the place is already in the branch name
        var tag = function (on, name) { return '<span class="tag ' + (on ? 'yes' : 'no') + '">' + name + '</span>'; };
        var line = b[0] + ', ' + r[1] + ' branch' + (r[2] ? ', ' + r[2] : '') + ': IFSC ' + code + (r[5] ? ', MICR ' + r[5] : '');
        var was = from && from.n === code ? '<p class="note">This is the code that replaced the old code <b class="mono">' + esc(from.o) + '</b>. ' + esc(from.w) + '</p>' : '';
        from = null;
        if (swiftNote && r[7] === swiftNote) was = '<p class="note">The SWIFT code <b class="mono">' + esc(swiftNote) + '</b> belongs to this branch. A sender abroad uses the SWIFT code; the IFSC code below is for transfers inside India.</p>' + was;
        swiftNote = null;
        say(was + '<h2>' + esc(b[0]) + '</h2><p class="big">' + code + '</p><p><b>' + esc(r[1]) + '</b>' + (r[2] ? ', ' + esc(r[2]) : '') + (s[0] ? ', ' + esc(s[0]) : '') + '</p>' +
          '<dl class="facts"><dt>Address</dt><dd>' + esc(r[4] || 'Not given') + '</dd><dt>MICR code</dt><dd>' + esc(r[5] || 'None for this branch') + '</dd>' +
          (r[6] ? '<dt>Phone</dt><dd>' + esc(r[6]) + '</dd>' : '') + (r[7] ? '<dt>SWIFT code</dt><dd>' + esc(r[7]) + '</dd>' : '') + '</dl>' +
          '<div class="tags">' + tag(f & 1, 'NEFT') + tag(f & 2, 'RTGS') + tag(f & 4, 'IMPS') + (f & 8 ? tag(1, 'UPI') : '') + '</div>' +
          '<div class="acts"><button class="btn" type="button" data-copy="' + code + '" data-done="' + code + ' copied">Copy code</button>' +
          '<button class="btn ghost" type="button" data-share="' + esc(line) + '" data-url="https://ifsc.shareyourgroup.com/?ifsc=' + code + '">Share</button>' +
          (f & 16 && s[1] ? '<a class="btn ghost" href="https://branches.shareyourgroup.com/' + s[1] + '/' + b[1] + '/' + code.toLowerCase() + '/">Branch page</a>' : '') +
          (s[1] ? '<a class="btn ghost" href="/bank/' + b[1] + '/' + s[1] + '/">More ' + esc(b[0]) + ' branches</a>' : '') + '</div>' +
          '<p class="hint">Data as of ' + esc(ix.asof) + '. Confirm the code and account number before a large payment.</p>');
        N.recent('syg-ifsc', { u: code, t: b[0] + ', ' + r[1] });
        recent();
        try { history.replaceState(null, '', location.pathname + '?ifsc=' + code + '#check'); } catch (e) {}
      });
    }).catch(function () { say('<h2>The data did not load</h2><p>Check your internet connection and press Check code again.</p>'); });
  }
  /* a SWIFT code: the branch it belongs to, where our list has it. A code that is not in the list is never called wrong. */
  var swiftNote = null;
  function swiftCode(code) {
    out.innerHTML = '<div class="shim" style="height:150px;margin-top:14px"></div>';
    N.json('/data/swift.json').then(function (j) {
      var b = j.b[code.slice(0, 4)], ifsc = j.c[code], more = '<p class="hint">SWIFT codes are issued by SWIFT, not by us. Confirm the code with the bank before someone sends you money. <a href="/receive-money-from-abroad/">How to receive money from abroad</a></p>';
      if (ifsc) { swiftNote = code; check(ifsc); return; }
      var head = '<p class="tags"><span class="tag yes">SWIFT code</span></p>';
      if (code.length === 8 && b && b[3] === code) {
        say(head + '<h2>' + esc(b[0]) + '</h2><p class="big">' + esc(code) + '</p><p>This is the SWIFT code of ' + esc(b[0]) + ' for the whole bank in our data. A sender abroad uses it together with your name, account number and branch. Ask the bank whether your branch needs anything more.</p>' +
          '<div class="acts"><button class="btn" type="button" data-copy="' + code + '" data-done="' + code + ' copied">Copy code</button><a class="btn ghost" href="/bank/' + b[1] + '/">' + esc(b[0]) + ' IFSC codes</a></div>' + more);
      } else if (code.length === 8 && b && b[2]) {
        say(head + '<h2>' + esc(b[0]) + '</h2><p class="big">' + esc(code) + '</p><p>These are the first eight characters of the SWIFT codes of ' + esc(b[0]) + '. Eight characters alone name the bank\'s main office. ' + b[2].toLocaleString('en-IN') + ' of its branches have a full 11-character code of their own in our list.</p>' +
          '<div class="acts"><a class="btn" href="/swift/' + b[1] + '/">See the branch codes</a></div>' + more);
      } else if (b) {
        say('<h2>This branch code is not in our list</h2><p class="big">' + esc(code) + '</p><p>The first four letters belong to ' + esc(b[0]) + ', but our list has no branch with this exact SWIFT code. That does not mean the code is wrong: our list holds only the codes in the open data we use. Check it with the bank.</p>' +
          '<div class="acts">' + (b[2] ? '<a class="btn" href="/swift/' + b[1] + '/">' + esc(b[0]) + ' SWIFT codes</a>' : '<a class="btn" href="/swift/">SWIFT codes</a>') + '</div>' + more);
      } else {
        say('<h2>This looks like a SWIFT code, but it is not in our list</h2><p class="big">' + esc(code) + '</p><p>A SWIFT code has 8 or 11 characters with IN (India) in the fifth and sixth places, and this one fits. Our list holds the SWIFT codes of only a few banks, so we cannot tell you whose it is. That does not mean the code is wrong: check it with the bank.</p>' +
          '<div class="acts"><a class="btn" href="/swift/">SWIFT codes in our list</a></div>' + more);
      }
    }).catch(function () { say('<h2>The data did not load</h2><p>Check your internet connection and press Check code again.</p>'); });
  }
  /* a code that is no longer in use: say what happened to it, and offer the code that replaced it */
  var from = null;
  var MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function oldCode(ix, code, otherwise) {
    var bank4 = code.slice(0, 4);
    if (!ix.old || !ix.old[bank4]) { otherwise(); return; }
    return N.json('/data/old/' + bank4 + '.json').then(function (j) {
      var r = j[code.slice(4)];
      if (!r) { otherwise(); return; }
      var ev = r[0] >= 0 ? ix.ev[r[0]] : null, s = ix.states[r[4]] || ['', ''], last = r[6] ? MON[+r[6].slice(5, 7) - 1] + ' ' + r[6].slice(0, 4) : '';
      var cur = null;
      if (!ev) ix.banks.some(function (b) { if (b[0] === r[1]) { cur = b; return true; } });
      var head, what, acts = '';
      if (ev && ev.k === 'merged') {
        head = 'This is an old code of ' + esc(ev.old) + ', which merged into ' + esc(ev.into);
        what = '<p><b>What happened:</b> ' + esc(ev.old) + ' merged into ' + esc(ev.into) + (/^the /.test(ev.on) ? ' in ' : ' on ') + esc(ev.on) + '. ' + (ev.stop ? 'Its old IFSC codes stopped working on ' + esc(ev.stop) + '. A payment sent to this code now fails and the money comes back. ' : 'This code is no longer in the list of the Reserve Bank, so a payment sent to it is likely to be refused and returned. ') +
          'The account itself is safe: it is now an account of ' + esc(ev.into) + '.</p>';
        if (r[7]) {
          if (r[9]) what += '<p>After the merger this branch first got the ' + esc(ev.into) + ' code <b class="mono">' + esc(r[9]) + '</b>, which has left the list of the Reserve Bank since. We found the current branch by its name and place.</p>';
          what += '<p class="ask"><b>Do you want to know the new IFSC code of this branch?</b></p>';
          acts = '<button class="btn" type="button" data-new="' + esc(r[7]) + '" data-old="' + code + '" data-why="' + esc(r[8] === 3 ? 'It comes from the list of old and new codes that ' + ev.into + ' published for these branches, and it is in the current list.' : r[8] === 1 && ev.grp === 'sbi' ? 'It follows the numbering in the lists State Bank of India published after the merger, and it is in the current list.' : r[8] === 1 ? 'It is worked out by the rule ' + ev.into + ' published for these branches, and it is in the current list.' : 'We matched it by branch name and place, so confirm it with ' + ev.into + ' before you pay.') + '">Yes, show the new code</button>' +
            '<a class="btn ghost" href="/merged-banks/' + ev.slug + '/">No, tell me about the merger</a>';
        } else {
          if (r[9]) what += '<p>After the merger this branch first got the ' + esc(ev.into) + ' code <b class="mono">' + esc(r[9]) + '</b>. That code has left the list of the Reserve Bank too, so it does not work for payments either.</p>';
          what += '<p>We could not match this old branch to one current branch of ' + esc(ev.into) + ' with confidence (some branches were closed or joined with a nearby branch after the merger). Ask the account holder for the new code, or look for the branch in the list of ' + esc(ev.into) + '.</p>';
          acts = (ev.intoSlug ? '<a class="btn" href="/bank/' + ev.intoSlug + '/' + (s[1] ? s[1] + '/' : '') + '">See ' + esc(ev.into) + ' branches' + (s[0] ? ' in ' + esc(s[0]) : '') + '</a>' : '') +
            '<a class="btn ghost" href="/merged-banks/' + ev.slug + '/">About the merger</a>';
        }
      } else if (ev && ev.k === 'closed') {
        head = 'This is an old code of ' + esc(ev.old) + ', which is no longer on the register of banks';
        what = '<p><b>What happened:</b> ' + esc(ev.how) + '</p><p>We have no record of a code that replaced this one. Do not send money to it. Ask the person you want to pay for their current account details.</p>';
        acts = '<a class="btn" href="/merged-banks/' + ev.slug + '/">Read more about this bank</a>';
      } else if (ev) {
        head = 'This is an old code of ' + esc(ev.old);
        what = '<p><b>What happened:</b> ' + esc(ev.how) + '</p>';
        acts = '<a class="btn" href="/merged-banks/' + ev.slug + '/">Read more</a>';
      } else if (cur) {
        head = 'This code of ' + esc(r[1]) + ' is no longer in use';
        what = '<p><b>What happened:</b> ' + esc(r[1]) + ' is still working, but this branch code is no longer in the list of the Reserve Bank. A bank takes a code out when it closes a branch, joins it with a nearby branch or gives the branch a new code. ' +
          'The accounts were not closed: they moved to another branch of ' + esc(r[1]) + ', and that branch has its own code.</p>' +
          (r[7] ? '<p class="ask"><b>We found a current branch with the same name in the same place. Do you want to see its code?</b></p>' : '<p>Ask the account holder for the code printed on a new cheque book or passbook, or look for the branch below.</p>');
        acts = (r[7] ? '<button class="btn" type="button" data-new="' + esc(r[7]) + '" data-old="' + code + '" data-why="We matched it by branch name and place, so confirm it with the bank before you pay.">Yes, show that code</button>' : '') +
          '<a class="btn' + (r[7] ? ' ghost' : '') + '" href="/bank/' + cur[1] + '/' + (s[1] ? s[1] + '/' : '') + '">See ' + esc(r[1]) + ' branches' + (s[0] ? ' in ' + esc(s[0]) : '') + '</a>';
      } else {
        head = 'This is an old code of ' + esc(r[1]);
        what = '<p><b>What happened:</b> ' + esc(r[1]) + ' is no longer in the list of the Reserve Bank under this name. A bank leaves the list when it merges with another bank, changes its name, or closes. We do not have a confirmed record of which it was for this bank, so we do not guess. Ask the account holder for the current bank name and code.</p>';
        acts = '<a class="btn" href="/merged-banks/">Merged and closed banks</a>';
      }
      say('<p class="tags"><span class="tag no">No longer in use</span></p><h2>' + head + '</h2><p class="big" style="text-decoration:line-through">' + code + '</p>' +
        '<p><b>' + esc(r[2]) + '</b>' + (r[3] && r[2].toLowerCase().indexOf(r[3].toLowerCase()) < 0 ? ', ' + esc(r[3]) : '') + (s[0] ? ', ' + esc(s[0]) : '') + '</p>' +
        '<dl class="facts"><dt>Bank then</dt><dd>' + esc(r[1]) + '</dd>' + (r[5] ? '<dt>Address then</dt><dd>' + esc(r[5]) + '</dd>' : '') + (last ? '<dt>Last listed</dt><dd>' + last + '</dd>' : '') + '</dl>' +
        what + '<div class="acts">' + acts + '</div><p class="hint">Old codes come from the lists published since ' + esc(ix.since || 'February 2016') + '. Current data as of ' + esc(ix.asof) + '.</p>');
      try { history.replaceState(null, '', location.pathname + '?ifsc=' + code + '#check'); } catch (e) {}
    }).catch(function () { say('<h2>The data did not load</h2><p>Check your internet connection and press Check code again.</p>'); });
  }
  d.addEventListener('click', function (e) {
    var b = e.target.closest('[data-new]');
    if (!b || !form) return;
    from = { n: b.getAttribute('data-new'), o: b.getAttribute('data-old'), w: b.getAttribute('data-why') };
    form.ifsc.value = from.n; check(from.n);
  });
  function recent() {
    var box = $('[data-recent]'), list = N.recent('syg-ifsc');
    if (!box || !list.length) return;
    box.innerHTML = '<p class="hint">Codes you checked lately (kept only in this browser): ' + list.map(function (x) { return '<a href="/?ifsc=' + esc(x.u) + '#check" title="' + esc(x.t) + '" class="mono">' + esc(x.u) + '</a>'; }).join(' · ') + '</p>';
  }
  if (form) {
    form.addEventListener('submit', function (e) { e.preventDefault(); check(form.ifsc.value); });
    var m = /[?&]ifsc=([A-Za-z0-9]{11})/.exec(location.search);
    if (m) { form.ifsc.value = m[1].toUpperCase(); check(m[1], true); }
    recent();
  }
})();

/* AdSense places of this site (the Auto ads script is already in the page frame; these are fixed, labelled places on top of it).
   Rules (owner): never on the legal pages (body data-ads="0"), never next to a button, a form or the checker's result; a place that
   gets no ad closes itself. Units of the owner's AdSense account: display, in-article, multiplex. */
(function () {
  'use strict';
  var d = document, main = d.getElementById('main');
  if (!main || d.body.getAttribute('data-ads') === '0' || !d.querySelector('script[src*="adsbygoogle.js"]')) return;
  var CLIENT = 'ca-pub-5935207738848708', UNITS = { display: '2358914532', article: '2020003182', multiplex: '4837738215' };
  var TOUCHY = 'button,.btn,form,input,select,.acts,[data-ifsc-out],.finder,.az,table,[data-recent]';
  function touchy(el) { return !!el && el.nodeType === 1 && (el.matches(TOUCHY) || !!el.querySelector(TOUCHY)); }
  /* what matters is the part of a block that touches the ad: its last piece (block above) or its first piece (block below) */
  function edge(el, last) { if (!el) return false; if (el.matches(TOUCHY)) return true; var c = last ? el.lastElementChild : el.firstElementChild; return touchy(c || el); }
  function unit(kind) {
    var box = d.createElement('aside');
    box.className = 'pk-place wrap'; box.setAttribute('aria-label', 'Advertisement');
    var attrs = kind === 'article' ? 'style="display:block;text-align:center" data-ad-layout="in-article" data-ad-format="fluid"'
      : kind === 'multiplex' ? 'style="display:block" data-ad-format="autorelaxed"' : 'style="display:block" data-ad-format="auto" data-full-width-responsive="true"';
    box.innerHTML = '<small>Advertisement</small><ins class="adsbygoogle" ' + attrs + ' data-ad-client="' + CLIENT + '" data-ad-slot="' + UNITS[kind] + '"></ins>';
    return box;
  }
  /* ask for the ad only when its place is about to be seen and has a real width (a place with no width makes the ad script fail) */
  /* a place that gets no ad (none available, ad blocker, no answer) shows a sponsor card instead (owner, 2026-11-11). Never the same
     sponsor twice on a page. The place at the very end only closes: the page's own sponsor card sits right under it. */
  var promos = null;
  function sponsors() {
    return promos || (promos = fetch('https://share.groupchaton.com/promos.json', { mode: 'cors' }).then(function (r) { return r.json(); }).then(function (j) {
      var india = /Calcutta|Kolkata/.test((Intl.DateTimeFormat().resolvedOptions() || {}).timeZone || '');
      return (j.promos || []).filter(function (p) { return p && p.href && !p.own && !(p.india && !india); });
    }).catch(function () { return []; }));
  }
  function card(box) {
    if (box._card) return;
    box._card = 1;
    if (box._end) { box.remove(); return; }
    /* let the page's own sponsor card (end of the page) choose first, so the two never show the same sponsor */
    var own = d.querySelector('[data-sponsor]'), wait = own && !own.firstChild && !box._waited ? 1500 : 0;
    if (wait) { box._waited = 1; box._card = 0; setTimeout(function () { card(box); }, wait); return; }
    sponsors().then(function (list) {
      var used = [].map.call(d.querySelectorAll('a.sponsor'), function (a) { return a.getAttribute('href'); });
      list = list.filter(function (p) { return used.indexOf(p.href) < 0; });
      if (!list.length) { box.remove(); return; }
      var p = list[Math.floor(Math.random() * list.length)], esc = window.SYG.esc;
      var img = p.imgs && p.imgs.length ? p.imgs[Math.floor(Math.random() * p.imgs.length)] : (p.img_icon || '');
      box.innerHTML = '<a class="sponsor" href="' + esc(p.href) + '" target="_blank" rel="' + (p.family ? 'noopener' : 'sponsored noopener') + '">' +
        (img ? '<img src="' + esc(img) + '" alt="" loading="lazy" width="72" height="72">' : '') +
        '<span><small>' + esc(p.family ? 'From GroupChatOn' : (p.tag || 'Sponsored')) + '</small><b>' + esc(p.title || '') + '</b>' + (p.line ? '<span>' + esc(p.line) + '</span>' : '') +
        (p.cta ? '<em>' + esc(p.cta) + ' →</em>' : '') + '</span></a>';
      box.setAttribute('aria-label', 'Sponsored');
      box.classList.add('has-card');
    });
  }
  function watch(box) {
    var ins = box.querySelector('ins');
    var state = function () { var st = ins.getAttribute('data-ad-status'); if (st === 'unfilled') card(box); return st; };
    if ('MutationObserver' in window) new MutationObserver(state).observe(ins, { attributes: true, attributeFilter: ['data-ad-status'] });
    setTimeout(function () { if (state() !== 'filled') card(box); }, 8000);   // no answer at all: blocked or offline
  }
  function fill(box) { if (box._done || !box.isConnected || box.offsetWidth < 120) return; box._done = 1; watch(box); try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { card(box); } }
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { fill(e.target); if (e.target._done) io.unobserve(e.target); } }); }, { rootMargin: '700px 0px' }) : null;
  var boxes = [], tick = 0;
  function near() { boxes.forEach(function (b) { if (!b._done && b.getBoundingClientRect().top < innerHeight + 700) fill(b); }); }
  function show(box) { boxes.push(box); if (io) io.observe(box); }
  /* a second way to notice a place coming near, for browsers where the observer stays silent */
  addEventListener('scroll', function () { if (!tick) tick = setTimeout(function () { tick = 0; near(); }, 250); }, { passive: true });
  setTimeout(near, 2500);
  /* put a unit between two blocks, only where neither neighbour has anything to tap */
  function between(before, kind) {
    var prev = before.previousElementSibling;
    if (touchy(prev) || edge(before, false) || (prev && prev.classList.contains('pk-place'))) return false;   // the block above must have nothing to tap at all
    var box = unit(kind);
    before.parentNode.insertBefore(box, before);
    show(box);
    return true;
  }
  var blocks = [].slice.call(main.children).filter(function (el) { return !el.hasAttribute('data-sponsor') && el.tagName !== 'SCRIPT' && el.tagName !== 'NOSCRIPT'; });
  /* 1. first place: after the tool part of the page (the last block with a form, a filter or a table), one block further down */
  var last = -1;
  blocks.forEach(function (el, i) { if (el.querySelector('.finder,form,table,.az')) last = i; });
  var placed = 0;
  for (var i = Math.max(last + 1, 1); i < blocks.length && !placed; i++) if (between(blocks[i], 'display')) placed++;
  /* 2. long reading pages: one in-article place before a heading near the middle */
  var heads = [].slice.call(main.querySelectorAll('.prose h2')).filter(function (h) { return !h.closest('details,.result,.pk-place'); });
  if (main.offsetHeight > 2600 && heads.length >= 4) {
    for (var k = Math.floor(heads.length / 2); k < heads.length; k++) {
      var h = heads[k], prev = h.previousElementSibling;
      if (!prev || touchy(prev) || touchy(h.nextElementSibling) || prev.classList.contains('pk-place')) continue;
      var box = unit('article'); box.classList.remove('wrap');
      h.parentNode.insertBefore(box, h); show(box); placed++; break;
    }
  }
  /* 3. end of the page: related-content (multiplex) place, above the sponsor card and the footer */
  var end = unit('multiplex'), sp = main.querySelector('[data-sponsor]');
  end._end = 1;
  if (!edge(blocks[blocks.length - 1], true)) { if (sp) main.insertBefore(end, sp); else main.appendChild(end); show(end); }
})();
