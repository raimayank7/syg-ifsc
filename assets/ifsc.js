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
        say(was + '<h2>' + esc(b[0]) + '</h2><p class="big">' + code + '</p><p><b>' + esc(r[1]) + '</b>' + (r[2] ? ', ' + esc(r[2]) : '') + (s[0] ? ', ' + esc(s[0]) : '') + '</p>' +
          '<dl class="facts"><dt>Address</dt><dd>' + esc(r[4] || 'Not given') + '</dd><dt>MICR code</dt><dd>' + esc(r[5] || 'None for this branch') + '</dd>' +
          (r[6] ? '<dt>Phone</dt><dd>' + esc(r[6]) + '</dd>' : '') + (r[7] ? '<dt>SWIFT code</dt><dd>' + esc(r[7]) + '</dd>' : '') + '</dl>' +
          '<div class="tags">' + tag(f & 1, 'NEFT') + tag(f & 2, 'RTGS') + tag(f & 4, 'IMPS') + (f & 8 ? tag(1, 'UPI') : '') + '</div>' +
          '<div class="acts"><button class="btn" type="button" data-copy="' + code + '" data-done="' + code + ' copied">Copy code</button>' +
          '<button class="btn ghost" type="button" data-share="' + esc(line) + '" data-url="https://ifsc.shareyourgroup.com/?ifsc=' + code + '">Share</button>' +
          (s[1] ? '<a class="btn ghost" href="/bank/' + b[1] + '/' + s[1] + '/">More ' + esc(b[0]) + ' branches</a>' : '') + '</div>' +
          '<p class="hint">Data as of ' + esc(ix.asof) + '. Confirm the code and account number before a large payment.</p>');
        N.recent('syg-ifsc', { u: code, t: b[0] + ', ' + r[1] });
        recent();
        try { history.replaceState(null, '', location.pathname + '?ifsc=' + code + '#check'); } catch (e) {}
      });
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
          what += '<p class="ask"><b>Do you want to know the new IFSC code of this branch?</b></p>';
          acts = '<button class="btn" type="button" data-new="' + esc(r[7]) + '" data-old="' + code + '" data-why="' + esc(r[8] === 1 ? 'It is worked out by the rule ' + ev.into + ' published for these branches, and it is in the current list.' : 'We matched it by branch name and place, so confirm it with ' + ev.into + ' before you pay.') + '">Yes, show the new code</button>' +
            '<a class="btn ghost" href="/merged-banks/' + ev.slug + '/">No, tell me about the merger</a>';
        } else {
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
