/* Poof Books: Big Daddy's book finder ("Kinda know what you want?"), 31 Oct 2026.
   The reader describes his perfect book in his own words; as he types, every fiction book is scored against
   what he's written and the matches appear below, grouped by shelf, with the usual sort and filters (shelf.js).

   No server and no AI call: /assets/data/finder.json (written by the site build) holds each fiction book's card
   details plus a bag of words from its description, setting (places, periods), subtitle, series and genre.
   Scoring is classic search relevance: rarer words count for more (inverse document frequency), a word in the title
   or a named place counts for more than one in the description, the word still being typed matches as a prefix,
   and decades or years ("the 1980s", "eighties", "1956") match the years a book is set in.
   Everything typed stays in this browser; only the address bar keeps it (?want=), so a search can be shared. */
(function () {
  'use strict';
  var root = document.querySelector('[data-finder]');
  if (!root) return;
  var form = document.querySelector('.shelf-tools');
  var inputs = Array.prototype.slice.call(document.querySelectorAll('.want-input'));
  var CURATOR = { 'faghetti-westerns': 'Curtis', 'rollicking-romances': 'Rumi', 'conniving-crimes': 'Dick', 'exquisite-erotica': 'Eric',
    'fabulous-fables': 'Frank', 'luminous-literature': 'Larry', 'supernova-adventures': 'Sam' };
  var ADULT = 'exquisite-erotica';

  // Words that say nothing about which book (plus the ones every book here shares).
  var STOP = {};
  ('the and of to a in is his he with that for but when who it as on an their they them this these those from into onto upon ' +
   'her she him its was were are be been being have has had not no nor so than then there here what which while where why how ' +
   'all any some each every one two three more most other such only own same can will just should now also very much many ' +
   'after before over under again further once about against between through during above below off out our ours your yours ' +
   'you we us i me my mine whom whose would could might must shall may book books novel novels story stories read reading ' +
   'reader readers author new york times bestselling bestseller award winning edition first published want wants wanted ' +
   'like likes looking look find something someone somebody kind sort type perfect really maybe perhaps please preferably ' +
   'bit lot lots little good great nice set sets setting based where whats thing things gay queer man men guy guys ' +
   'feel feels make makes made get gets got lead character characters plus prefer ideally probably definitely ' +
   'fiction fictional genre eg etc yes yeah hmm ok okay well quite rather pretty enough else ever still even want im ive id dont doesnt').split(' ')
    .forEach(function (w) { if (w) STOP[w] = 1; });

  function fold(s) { return (s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  // Words whose stem would collide with another meaning ("ghosting" is not a ghost story).
  var NOSTEM = { ghosting: 'ghosting', ghosted: 'ghosting', ghoster: 'ghosting', ghosts: 'ghost' };
  function stem(w) {
    if (NOSTEM[w]) return NOSTEM[w];
    w = w.replace(/'s$/, '').replace(/'/g, '');
    if (w.length > 5 && /ies$/.test(w)) return w.slice(0, -3) + 'y';
    if (w.length > 5 && /(ches|shes|sses|xes|zes)$/.test(w)) return w.slice(0, -2);
    if (w.length > 3 && /[^su]s$/.test(w)) return w.slice(0, -1);
    if (w.length > 6 && /ing$/.test(w)) return w.slice(0, -3);
    if (w.length > 5 && /ed$/.test(w)) return w.slice(0, -2);
    return w;
  }
  function words(s) { return fold(s).match(/[a-z0-9]+(?:'[a-z]+)?/g) || []; }

  // Periods the reader might name, as years (BC negative). Matched against the years a book is set in.
  var DECADE_WORDS = { twenties: 1920, thirties: 1930, forties: 1940, fifties: 1950, sixties: 1960, seventies: 1970, eighties: 1980, nineties: 1990 };
  var PERIODS = { victorian: [1837, 1901], edwardian: [1901, 1914], regency: [1811, 1837], georgian: [1714, 1837], tudor: [1485, 1603],
    elizabethan: [1558, 1603], medieval: [500, 1499], renaissance: [1400, 1600], ancient: [-3000, 499], roman: [-500, 476], greek: [-800, -146],
    wwi: [1914, 1918], wwii: [1939, 1945], ww1: [1914, 1918], ww2: [1939, 1945], interwar: [1919, 1939], postwar: [1945, 1969],
    stonewall: [1969, 1975], aids: [1981, 1996], prohibition: [1920, 1933], depression: [1929, 1939], futuristic: [2030, 99999], future: [2030, 99999] };
  function periodsIn(text) {
    var out = [], t = fold(text), m, re = /\b(?:the\s+)?(1[0-9]|20)([0-9])0'?s\b/g;
    while ((m = re.exec(t))) { var y = +(m[1] + m[2] + '0'); out.push([y, y + 9]); }
    re = /\b'?([2-9])0s\b/g;   // "the 80s", "'50s"
    while ((m = re.exec(t))) { var y2 = 1900 + (+m[1]) * 10; out.push([y2, y2 + 9]); }
    re = /\b(1[0-9]{3}|20[0-9]{2})\b(?!'?s)/g;
    while ((m = re.exec(t))) out.push([+m[1], +m[1]]);
    words(t).forEach(function (w) {
      if (DECADE_WORDS[w]) out.push([DECADE_WORDS[w], DECADE_WORDS[w] + 9]);
      if (PERIODS[w]) out.push(PERIODS[w]);
    });
    if (/\bworld war (ii|two|2)\b|\bsecond world war\b/.test(t)) out.push([1939, 1945]);
    if (/\bworld war (i|one|1)\b|\bfirst world war\b|\bgreat war\b/.test(t)) out.push([1914, 1918]);
    return out;
  }


  // Words that mean the same thing to a reader (Blair, 31 Oct 2026: "Swiss" should find Switzerland, "sauna" a hammam).
  // Multi-word names are joined first ("bath house" -> bathhouse) so they act as one word on both sides.
  var JOIN = ['new york', 'new zealand', 'united states', 'united kingdom', 'great britain', 'south africa', 'hong kong', 'los angeles',
    'san francisco', 'new orleans', 'saudi arabia', 'sri lanka', 'puerto rico', 'costa rica', 'bath house', 'bath houses', 'steam room',
    'steam rooms', 'turkish bath', 'turkish baths', 'coming out', 'came out', 'happy ending', 'happily ever after', 'enemies to lovers',
    'friends to lovers', 'second chance', 'small town', 'age gap', 'drag queen', 'drag queens', 'world war', 'police officer', 'fake dating',
    'slow burn', 'found family', 'only one bed', 'one bed', 'share a bed', 'sharing a bed', 'fake relationship', 'fake boyfriend', 'fake fiance', 'fake profile',
    'forbidden love', 'older man', 'younger man', 'may december', 'break up', 'breaks up', 'broke up', 'broken heart', 'killed himself',
    'kill himself', 'took his own life', 'coming of age', 'coming-of-age', 'growing up', 'grew up', 'high school', 'first love', 'boy next door', 'ice hockey'];
  var GROUPS = [
    // places and the people from them
    'switzerland swiss', 'france french', 'italy italian', 'germany german', 'spain spanish', 'portugal portuguese',
    'britain british uk unitedkingdom greatbritain england english', 'scotland scottish scots', 'wales welsh', 'ireland irish',
    'unitedstates america american usa', 'canada canadian', 'australia australian aussie outback', 'newzealand kiwi',
    'mexico mexican', 'greece greek', 'russia russian soviet', 'china chinese', 'japan japanese', 'korea korean', 'india indian',
    'morocco moroccan', 'egypt egyptian', 'turkey turkish', 'netherlands dutch holland', 'belgium belgian', 'austria austrian',
    'sweden swedish', 'norway norwegian', 'denmark danish', 'finland finnish', 'iceland icelandic', 'poland polish', 'hungary hungarian',
    'czech czechia', 'brazil brazilian', 'argentina argentinian argentine', 'cuba cuban', 'jamaica jamaican', 'nigeria nigerian',
    'kenya kenyan', 'southafrica southafrican', 'israel israeli', 'palestine palestinian', 'lebanon lebanese', 'syria syrian',
    'iran iranian persia persian', 'iraq iraqi', 'thailand thai', 'vietnam vietnamese', 'philippines filipino', 'indonesia indonesian',
    'newyork nyc manhattan brooklyn', 'losangeles hollywood', 'sanfrancisco frisco',
    // things in the stories
    'bathhouse hammam sauna steamroom turkishbath baths', 'chef cook', 'doctor physician surgeon medic', 'cop police policeman policeofficer',
    'soldier army military marine troops', 'sailor navy', 'teacher professor tutor', 'priest vicar clergy', 'prince royal royalty',
    'hockey icehockey nhl', 'football soccer', 'aids hiv', 'comingout cameout closet closeted', 'trans transgender',
    'dragqueen drag', 'happyending happilyeverafter hea', 'enemiestolovers rivals rival', 'slowburn', 'fakedating fakerelationship fakeboyfriend fakefiance', 'forbiddenlove forbidden taboo', 'onlyonebed onebed shareabed sharingabed',
    'christmas xmas festive yuletide hanukkah holiday holidays', 'sport sports athlete athletes athletic jock jocks',
    'catfish catfished catfishing fakeprofile', 'ghosting', 'breakup heartbreak heartbroken heartbreaking brokenheart brokeup breaksup',
    'loneliness lonliness lonely lonesome isolation isolated solitude', 'suicide suicidal killedhimself killhimself tookhisownlife', 'foundfamily',
    'comingofage adolescence adolescent teen teens teenage teenager teenagers boyhood growingup grewup youth highschool', 'firstlove', 'smalltown', 'agegap olderman youngerman maydecember', 'beach seaside coast', 'war wartime', 'vampire vampires', 'werewolf werewolves shifter shifters',
    'wizard witch mage sorcerer', 'spaceship starship', 'alien aliens extraterrestrial'];
  var CONCEPT = {};
  function joinText(t) { t = ' ' + fold(t).replace(/[^a-z0-9']+/g, ' ') + ' '; JOIN.forEach(function (p) { t = t.split(' ' + p + ' ').join(' ' + p.replace(/ /g, '') + ' '); }); return t; }

  // A quiet support note when the reader asks about suicide (Blair, 31 Oct 2026). Not logged or sent anywhere.
  // The reader's own country first (guessed from the device's time zone, then its language); every country after.
  // Numbers checked 31 Oct 2026. Find A Helpline (ThroughLine) covers the rest of the world.
  var LINES = {
    AU: [['Lifeline', '13 11 14', 'tel:131114', 'any time'], ['QLife, LGBTIQ+ peer support', '1800 184 527', 'tel:1800184527', '3pm to midnight']],
    NZ: [['1737, Need to Talk?', 'call or text 1737', 'tel:1737', 'any time']],
    GB: [['Samaritans', '116 123', 'tel:116123', 'any time'], ['Switchboard LGBT+', '0800 0119 100', 'tel:08000119100', '10am to 10pm']],
    IE: [['Samaritans', '116 123', 'tel:116123', 'any time']],
    US: [['988 Suicide & Crisis Lifeline', 'call or text 988', 'tel:988', 'any time'], ['The Trevor Project, LGBTQ+ young people', '1-866-488-7386', 'tel:18664887386', 'any time']],
    CA: [['9-8-8 Suicide Crisis Helpline', 'call or text 988', 'tel:988', 'any time']]
  };
  var CNAME = { AU: 'Australia', NZ: 'New Zealand', GB: 'UK', IE: 'Ireland', US: 'USA', CA: 'Canada' };
  function country() {
    var tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    if (/^Australia\//.test(tz)) return 'AU';
    if (/^Pacific\/(Auckland|Chatham)$/.test(tz)) return 'NZ';
    if (tz === 'Europe/London' || tz === 'Europe/Belfast') return 'GB';
    if (tz === 'Europe/Dublin') return 'IE';
    if (/^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns|Regina|Montreal|Moncton|Whitehorse|Yellowknife|Iqaluit|Glace_Bay|Goose_Bay|Swift_Current|Dawson_Creek|Fort_Nelson)$/.test(tz)) return 'CA';
    if (/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Juneau|Adak|Indiana|Kentucky|North_Dakota|Menominee|Nome|Sitka|Yakutat|Metlakatla)/.test(tz) || tz === 'Pacific/Honolulu') return 'US';
    var langs = navigator.languages || [navigator.language || ''];
    for (var i = 0; i < langs.length; i++) { var m = /[-_]([A-Za-z]{2})\b/.exec(langs[i] || ''); if (m && LINES[m[1].toUpperCase() === 'UK' ? 'GB' : m[1].toUpperCase()]) return m[1].toUpperCase() === 'UK' ? 'GB' : m[1].toUpperCase(); }
    return '';
  }
  var CARE_RE = /\b(suicid\w*|kill(ing|ed)? (my|him|her|them)sel(f|ves)|end(ing)? (my|his) (own )?life|end(ing)? it all|took (his|my) own life|self[- ]?harm\w*|want(ed|ing)? to die)\b/;
  function lineHtml(l) { return '<li><b>' + esc(l[0]) + '</b> <a href="' + l[2] + '">' + esc(l[1]) + '</a> <span>(' + esc(l[3]) + ')</span></li>'; }
  function careHtml() {
    var c = country(), mine = LINES[c] || [], others = Object.keys(LINES).filter(function (k) { return k !== c; });
    return '<p class="care-lead">If you’re looking for yourself, you don’t have to carry it alone. Free, confidential support:</p>' +
      (mine.length ? '<ul class="care-lines">' + mine.map(lineHtml).join('') + '</ul>' : '') +
      '<details class="care-more"><summary>' + (mine.length ? 'Other countries' : 'Support lines by country') + '</summary>' +
      others.map(function (k) { return '<p class="care-c">' + CNAME[k] + '</p><ul class="care-lines">' + LINES[k].map(lineHtml).join('') + '</ul>'; }).join('') +
      '</details><p class="care-any">Anywhere in the world: <a href="https://findahelpline.com" target="_blank" rel="noopener">findahelpline.com</a>. In an emergency, call your local emergency number.</p>';
  }
  var careBuilt = false;
  function care(q) {
    var on = CARE_RE.test(fold(q));
    document.querySelectorAll('.want-care').forEach(function (el) {
      if (on && !careBuilt) el.innerHTML = careHtml();
      el.hidden = !on;
    });
    if (on) careBuilt = true;
  }
  var books = [], cards = [], df = {}, N = 1, groups = {};
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function adultOk() { try { return localStorage.getItem('poof-adult') === 'yes'; } catch (e) { return false; } }

  function cardHtml(b) {
    var src = b.cv || '', img = '';
    if (src) {
      var set = /\/front-240\.webp$/.test(src) ? ' srcset="' + esc(src) + ' 240w, ' + esc(src.replace('front-240', 'front-480')) + ' 480w" sizes="(max-width: 600px) 45vw, 200px"' : '';
      var veil = b.h === ADULT && !adultOk();
      img = '<img ' + (veil ? 'data-src' : 'src') + '="' + esc(src) + '"' + (veil ? set.replace(' srcset=', ' data-srcset=') : set) +
        ' width="800" height="1200" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">';
    }
    var year = b.f || (b.d || '').slice(0, 4);
    var a = '<a class="book" href="/books/' + esc(b.s) + '/" data-title="' + esc(b.t) + '" data-author="' + esc(b.a) + '" data-date="' + esc(b.d) + '"' +
      (b.f ? ' data-first="' + b.f + '"' : '') + (b.pb ? ' data-pub="' + b.pb + '"' : '') + (b.pl ? ' data-places="' + esc(b.pl.join('|')) + '"' : '') +
      (b.du ? ' data-during="' + b.du[0] + '|' + b.du[1] + '"' : '') + (b.fm ? ' data-formats="' + esc(b.fm) + '"' : '') +
      ' data-pronouns="' + esc(b.pr || '') + '"' + (b.cv ? '' : ' data-nocover="1"') + (b.pc ? ' data-price="' + b.pc + '"' : '') +
      (b.w ? ' data-words="' + b.w + '"' : '') + (b.pk ? ' data-pick="1"' : '') + '>' +
      '<span class="jacket">' + img + '</span><span class="t">' + esc(b.t) + '</span><span class="m">' + esc(b.a || 'Author unknown') +
      (year ? ' · ' + year : '') + (b.pc ? ' · <span class="money" data-aud="' + b.pc + '">A$' + b.pc + '</span>' : '') + '</span></a>';
    return a;
  }

  function index(b) {
    // Weighted word lists per field; stems, so "chefs" finds "chef".
    // Author's own keywords (up to 25, D1 032) count like a place the book is set: he knows what it's about.
    var f = { t: 5, a: 6, p: 4, ak: 4.5, k: 1.4, h: 2 }, ix = {};
    function put(k, w) { if (!ix[k] || ix[k] < w) ix[k] = w; }
    function add(text, w) { words(joinText(text)).forEach(function (x) { if (x.length < 2 || STOP[x]) return; var s = stem(x); put(s, w); if (CONCEPT[s]) put(CONCEPT[s], w); }); }
    add(b.t, f.t); add(b.a, f.a); add((b.pl || []).concat(b.ci || []).join(' '), f.p); add(b.k, f.k); add((b.ak || []).join(' '), f.ak);
    return ix;
  }
  // So "western", "romance", "crime", "sci-fi" etc. lean towards the right shelf.
  // Kinds of book only; particular things (vampires, ranches) are left to the descriptions.
  var SHELF_WORDS = { 'faghetti-westerns': 'western westerns cowboy cowboys',
    'rollicking-romances': 'romance romances romantic',
    'conniving-crimes': 'crime mystery mysteries detective thriller whodunit',
    'exquisite-erotica': 'erotica erotic explicit steamy',
    'fabulous-fables': 'fantasy paranormal',
    'luminous-literature': 'literary',
    'supernova-adventures': 'science scifi sci space opera' };

  var lastQ = null, active = false;
  window.PoofFinder = {
    query: function () { var v = inputs.filter(function (i) { return i.offsetParent; })[0] || inputs[0]; return v ? v.value.trim() : ''; },
    // Score every card; returns true when the reader has typed something worth matching.
    score: function (cs, q) {
      if (q === lastQ) return active;
      lastQ = q;
      // "Quoted words" must all be in the book; everything else just helps it rank.
      var must = [], qm, qre = /"([^"]+)"|“([^”]+)”/g;
      while ((qm = qre.exec(q))) must.push(words(joinText(qm[1] || qm[2])).filter(function (w) { return !STOP[w] && w.length > 1; }).map(function (w) { var s = stem(w); return CONCEPT[s] || s; }));
      var raw = words(joinText(q)).filter(function (w) { return !STOP[w] && w.length > 1; });
      var typing = /[a-z0-9]$/i.test(q) && raw.length ? stem(raw[raw.length - 1]) : null;   // last word, maybe half-typed
      var terms = [], seen = {};
      raw.forEach(function (w) { var s = stem(w); s = CONCEPT[s] || s; if (!seen[s] && !/^\d+$/.test(s)) { seen[s] = 1; terms.push(s); } });
      if (typing && CONCEPT[typing]) typing = null;   // a whole word we know: no prefix guessing
      var spans = periodsIn(q);
      active = terms.length > 0 || spans.length > 0;
      var phrase = fold(q).replace(/\s+/g, ' ');
      asked = {};   // shelves he named by kind ("science fiction", "a western"): those groups come first
      Object.keys(SHIX).forEach(function (h) { if (terms.some(function (t) { return SHIX[h][t]; })) asked[h] = 1; });
      cs.forEach(function (c) {
        var b = c._b, ix = b._ix, s = 0, hit = 0, shelfHit = 0;
        var sh = SHIX[b.h] || {};
        terms.forEach(function (t) {
          var w = ix[t] || 0;
          if (!w && sh[t]) { s += 2 * (IDF[t] || 1); shelfHit = 1; return; }   // "cowboys", "sci-fi": the shelf itself is what he asked for
          if (!w && t === typing && t.length >= 3) {   // still typing: "chef" while on the way to "chefs"; prefix match at a discount
            for (var k in ix) if (k.lastIndexOf(t, 0) === 0) { w = Math.max(w, ix[k] * 0.7); }
          }
          if (w) { s += w * (IDF[t] || IDF_PREFIX(t)); hit++; }
        });
        if (spans.length && b.du) spans.forEach(function (sp) { if (b.du[0] <= sp[1] && b.du[1] >= sp[0]) { s += 4 * 2.2; hit++; } });
        if (b._tl.length > 3 && phrase.indexOf(b._tl) > -1) s += 25;   // he typed the title
        // Books that match more of what he asked for rise above ones that match one word many times over.
        var cover = (terms.length + (spans.length ? 1 : 0)) || 1;
        // A long description must be matched on at least two things, not just "love".
        // The shelf's own kind ("cowboys") counts as a match for a short ask, half of one in a long description.
        var eff = hit + (shelfHit ? (terms.length <= 3 ? 1 : 0.5) : 0);
        c._score = eff >= (cover >= 5 ? 2 : 1) ? s * (0.5 + eff / cover) : 0;
        if (c._score && must.length && !must.every(function (m) { return m.every(function (t) { return ix[t]; }); })) c._score = 0;
      });
      var max = 0;
      cs.forEach(function (c) { if (c._score > max) max = c._score; });
      // Keep the strong matches: within reach of the best one (the cut gets kinder as he says more).
      var asks = terms.length + (spans.length ? 1 : 0);
      var cut = max * (asks > 6 ? 0.22 : asks > 1 ? 0.3 : 0);   // a single thing asked for: every book that has it
      cs.forEach(function (c) { c._hit = !active || (c._score > 0 && c._score >= cut); });
      return active;
    },
    after: function (cs, isActive) {
      var best = {}, n = {};
      cs.forEach(function (c) {
        var h = c._b.h;
        if (c.hidden) return;
        n[h] = (n[h] || 0) + 1;
        if (!best[h] || c._score > best[h]) best[h] = c._score || 0;
      });
      var order = Object.keys(groups);
      if (isActive) order.sort(function (a, b) { return ((asked[b] ? 1 : 0) - (asked[a] ? 1 : 0)) || (best[b] || -1) - (best[a] || -1) || ORDER.indexOf(a) - ORDER.indexOf(b); });
      order.forEach(function (h) {
        var g = groups[h];
        g.el.hidden = !n[h];
        g.n.textContent = n[h] ? n[h] + (n[h] === 1 ? ' book' : ' books') : '';
        g.el.parentNode.appendChild(g.el);
      });
      root.classList.toggle('want-on', !!isActive);
    }
  };
  var IDF = {}, SHIX = {}, asked = {};
  function IDF_PREFIX(t) {   // a half-typed word: as rare as the commonest word it could become
    var best = 0;
    for (var k in df) if (k.lastIndexOf(t, 0) === 0 && df[k] > best) best = df[k];
    return best ? Math.log(1 + N / best) : 0;
  }
  var ORDER = [];

  function build(data) {
    var SH = data.shelves || {};
    ORDER = Object.keys(SH).filter(function (h) { return CURATOR[h]; });
    GROUPS.forEach(function (g) { var id = '~' + g.split(' ')[0]; g.split(' ').forEach(function (w) { CONCEPT[stem(w)] = id; }); });
    books = data.books || [];
    N = books.length || 1;
    books.forEach(function (b) {
      b._ix = index(b);
      b._tl = fold(b.t || '').replace(/\s+/g, ' ').trim();
      for (var k in b._ix) df[k] = (df[k] || 0) + 1;
    });
    for (var k in df) IDF[k] = Math.log(1 + N / df[k]);
    Object.keys(SHELF_WORDS).forEach(function (h) { SHIX[h] = {}; words(SHELF_WORDS[h]).forEach(function (w) { SHIX[h][stem(w)] = 1; }); });
    // One group per shelf, in shelf order, each with its own grid (shelf.js pages each grid separately).
    var holder = root.querySelector('.f-groups');
    ORDER.forEach(function (h) {
      var list = books.filter(function (b) { return b.h === h; });
      if (!list.length) return;
      var el = document.createElement('section');
      el.className = 'f-shelf'; el.dataset.shelf = h;
      el.setAttribute('aria-labelledby', 'fs-' + h);
      el.innerHTML = '<h3 class="f-shelf-h" id="fs-' + h + '"><a href="/' + h + '/">' + esc(SH[h]) + '</a>' +
        '<span class="f-who c-on">with ' + esc(CURATOR[h]) + '</span><small class="f-n"></small></h3>' +
        (h === ADULT ? '<p class="f-adult"' + (adultOk() ? ' hidden' : '') + '>Explicit books, written for adults. Covers are hidden until you say so. ' +
          '<button type="button" class="linklike" data-adult>I’m an adult, show the covers</button></p>' : '') +
        '<div class="books">' + list.map(cardHtml).join('') + '</div>';
      holder.appendChild(el);
      groups[h] = { el: el, n: el.querySelector('.f-n') };
      var nodes = el.querySelectorAll('.book');
      list.forEach(function (b, i) { nodes[i]._b = b; });
    });
    var ab = root.querySelector('[data-adult]');
    if (ab) ab.addEventListener('click', function () {
      try { localStorage.setItem('poof-adult', 'yes'); } catch (e) {}
      if (window.dataLayer) window.dataLayer.push({ event: 'adult_gate_accepted', gate_location: 'finder' });
      groups[ADULT].el.querySelectorAll('img[data-src]').forEach(function (im) {
        if (im.dataset.srcset) im.srcset = im.dataset.srcset;
        im.src = im.dataset.src;
      });
      ab.closest('.f-adult').hidden = true;
    });

    // The "Published" slider spans every book here.
    var years = books.map(function (b) { return +(b.f || (b.d || '').slice(0, 4)); }).filter(Boolean);
    var lo = Math.min.apply(null, years), hi = Math.max.apply(null, years);
    form.dataset.min = lo; form.dataset.max = hi;
    ['from', 'to'].forEach(function (n) { var el = form.elements[n]; el.min = lo; el.max = hi; el.value = n === 'from' ? lo : hi; });

    // Restore a shared search (?want=...).
    var want = new URLSearchParams(location.search).get('want');
    if (want) { inputs.forEach(function (i) { i.value = want.slice(0, 600); }); care(want); }
    root.classList.remove('loading');
    document.dispatchEvent(new Event('poof:cards'));
  }

  // The empty-box prompt's link puts the cursor in whichever box is on show.
  root.addEventListener('click', function (ev) {
    if (!ev.target.closest('[data-focus-want]')) return;
    var v = inputs.filter(function (i) { return i.offsetParent; })[0] || inputs[0];
    if (v) { v.scrollIntoView({ block: 'center', behavior: 'smooth' }); v.focus({ preventScroll: true }); }
  });
  // Typing: keep both boxes (curators on / off) in step, and re-match after a short pause.
  var timer = null;
  inputs.forEach(function (inp) {
    inp.addEventListener('input', function () {
      inputs.forEach(function (o) { if (o !== inp) o.value = inp.value; });
      care(inp.value);
      clearTimeout(timer);
      timer = setTimeout(function () { document.dispatchEvent(new Event('poof:want')); }, 160);
    });
  });

  fetch(root.dataset.src, { cache: 'no-cache', credentials: 'same-origin' })   // same-origin: staging's sign-in must go with the request
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(build)
    .catch(function () {
      root.classList.remove('loading');
      var p = root.querySelector('.f-error'); if (p) p.hidden = false;
    });
})();
