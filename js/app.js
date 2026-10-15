(function(){

  var BOOKS = window.RT_DATA.BOOKS;
  var GENRE_LABELS = window.RT_DATA.GENRE_LABELS;
  var QUESTIONS = window.RT_DATA.QUESTIONS;

  /* ---------------------------------------------------------------
     STATE + STORAGE
  --------------------------------------------------------------- */
  var LS_KEY = "reading_table_v1";
  function loadState(){
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) return JSON.parse(raw);
    } catch(e){}
    return { name:"", answers:null, group:[], onboardStep:0, draft:{} };
  }
  function saveState(){
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch(e){}
  }

  var state = loadState();
  var route = state.answers ? "shelf" : "home";

  /* ---------------------------------------------------------------
     SCORING
  --------------------------------------------------------------- */
  function scoreBook(answers, book){
    var s = 60;
    var pace = Number(answers.pace || 3);
    var tone = Number(answers.tone || 3);
    var challenge = Number(answers.challenge || 3);

    s -= Math.abs(pace - book.pace) * 6;
    s -= Math.abs(tone - book.tone) * 6;
    s -= Math.abs(challenge - book.challenge) * 5;

    var lengths = answers.length || [];
    if (lengths.length === 0 || lengths.indexOf(book.length) !== -1) s += 10;
    else s -= 14;

    var genres = answers.genres || [];
    var matched = 0;
    genres.forEach(function(g){ if (book.genres.indexOf(g) !== -1) matched++; });
    if (genres.length){
      s += Math.min(matched, 2) * 11;
      if (matched === 0) s -= 8;
    }

    if (answers.format === "fiction" && book.format !== "fiction") s -= 22;
    if (answers.format === "nonfiction" && book.format !== "nonfiction") s -= 22;

    if (answers.culture === "different" && book.culture !== "US/UK") s += 9;
    if (answers.culture === "familiar" && book.culture === "US/UK") s += 5;

    if (answers.want === "fast") s += (book.pace - 3) * 3;
    if (answers.want === "think") s += (book.challenge - 3) * 3;
    if (answers.want === "feel") s += (book.tone - 3) * 2 + (book.content.indexOf("emotionally-heavy") !== -1 ? 5 : 0);
    if (answers.want === "teach") s += (book.format === "nonfiction" ? 10 : 0) + (book.genres.indexOf("history") !== -1 ? 6 : 0);

    var dbs = answers.dealbreakers || [];
    dbs.forEach(function(tag){
      if (book.content.indexOf(tag) !== -1) s -= 30;
    });

    return Math.max(2, Math.min(98, Math.round(s)));
  }

  function personalRecs(answers, n){
    var scored = BOOKS.map(function(b){ return { book:b, score: scoreBook(answers, b) }; });
    scored.sort(function(x,y){ return y.score - x.score; });
    return scored.slice(0, n || scored.length);
  }

  function groupRecs(members){
    // members: [{name, answers}]
    var rows = BOOKS.map(function(b){
      var scores = members.map(function(m){ return scoreBook(m.answers, b); });
      var min = Math.min.apply(null, scores);
      var avg = scores.reduce(function(a,c){return a+c;},0) / scores.length;
      var group = Math.round(min * 0.6 + avg * 0.4);
      return { book:b, scores:scores, min:min, avg:Math.round(avg), group:group };
    });
    rows.sort(function(x,y){
      if (y.group !== x.group) return y.group - x.group;
      return y.min - x.min;
    });
    return rows;
  }

  /* ---------------------------------------------------------------
     SHARE CODE (encode/decode a profile for pasting between friends)
  --------------------------------------------------------------- */
  function encodeProfile(name, answers){
    var payload = { n:name, a:answers, v:1 };
    try {
      return "RT1-" + btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    } catch(e){ return ""; }
  }
  function decodeProfile(code){
    code = (code || "").trim();
    if (code.indexOf("RT1-") !== 0) throw new Error("That doesn't look like a Reading Table code.");
    var json = decodeURIComponent(escape(atob(code.slice(4))));
    var payload = JSON.parse(json);
    if (!payload || !payload.a) throw new Error("Couldn't read that code.");
    return { name: payload.n || "A friend", answers: payload.a };
  }

  /* ---------------------------------------------------------------
     RENDER HELPERS
  --------------------------------------------------------------- */
  var app = document.getElementById("app");
  function el(html){ var d = document.createElement("div"); d.innerHTML = html; return d.firstElementChild; }
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
  }); }

  function header(active){
    return '' +
    '<header class="site">' +
      '<div class="wordmark">The Reading Table<small>A SHELF, READ BY EVERYONE</small></div>' +
      '<nav class="tabs">' +
        '<button data-nav="shelf" class="' + (active==='shelf'||active==='onboard'||active==='home'?'active':'') + '">My shelf</button>' +
        '<button data-nav="table" class="' + (active==='table'?'active':'') + '">The table</button>' +
      '</nav>' +
    '</header>';
  }

  function footer(){
    return '<footer class="site">Recommendations are generated from a small, fixed set of books and a simple scoring rule — a starting point for the group to argue about, not a verdict.</footer>';
  }

  /* ---------------------------------------------------------------
     VIEWS
  --------------------------------------------------------------- */
  function viewHome(){
    return '' + header('home') +
    '<div class="hero">' +
      '<h1>Five different bookshelves.<br>One book everyone actually reads.</h1>' +
      '<p class="lede">Answer a short card of questions about how you read. Once everyone in your group has done the same, The Reading Table finds books that hold up across all of you — not just the ones one person loves and the rest tolerate.</p>' +
      '<div class="btn-row">' +
        '<button class="btn" data-action="start-onboard">Fill out my card</button>' +
      '</div>' +
    '</div>' +
    footer();
  }

  function viewOnboard(){
    var step = state.onboardStep || 0;
    var q = QUESTIONS[step];
    var draft = state.draft || {};
    var current = draft[q.id];
    if (q.type === "multi" && !Array.isArray(current)) current = [];

    var stack = '<div class="stack">' + QUESTIONS.map(function(_, i){
      return '<i class="' + (i <= step ? 'done' : '') + '"></i>';
    }).join('') + '</div>';

    var optsHtml = q.options.map(function(opt){
      var val = opt[0], label = opt[1];
      var checked = q.type === "multi" ? current.indexOf(val) !== -1 : current === val;
      return '<label class="opt ' + (q.type==='single'?'circle':'') + ' ' + (checked?'checked':'') + '" data-opt="' + esc(val) + '">' +
        '<span class="opt-box">' + (checked ? '✓' : '') + '</span>' +
        '<span class="opt-text">' + esc(label) + '</span>' +
      '</label>';
    }).join('');

    var isLast = step === QUESTIONS.length - 1;
    var canNext = q.type === "multi" ? true : (current !== undefined && current !== null);

    return '' + header('onboard') +
    '<div class="card">' +
      stack +
      '<div class="card-label type-meta">CARD ' + (step+1) + ' OF ' + QUESTIONS.length + '</div>' +
      '<h2>' + esc(q.q) + '</h2>' +
      (q.sub ? '<p class="muted" style="margin-bottom:0;font-size:0.9rem;">' + esc(q.sub) + '</p>' : '') +
      '<div class="opt-list" id="opt-list">' + optsHtml + '</div>' +
      '<div class="btn-row" style="margin-top:18px;">' +
        (step > 0 ? '<button class="btn ghost" data-action="onboard-back">Back</button>' : '') +
        '<button class="btn" data-action="onboard-next" ' + (canNext ? '' : 'disabled') + '>' + (isLast ? 'See my recommendations' : 'Next') + '</button>' +
      '</div>' +
    '</div>' +
    footer();
  }

  function bookTagsHtml(b){
    var tags = b.genres.map(function(g){ return GENRE_LABELS[g] || g; });
    tags.push(b.culture);
    tags.push(b.length + ' · ' + b.format);
    return tags.map(function(t){ return '<span>' + esc(t) + '</span>'; }).join('');
  }

  function viewShelf(){
    if (!state.answers){
      return '' + header('shelf') +
      '<div class="empty"><p style="margin-bottom:14px;">You have not filled out your card yet.</p><button class="btn" data-action="start-onboard">Fill out my card</button></div>' +
      footer();
    }
    var recs = personalRecs(state.answers);
    var top = recs.slice(0, 12);
    var code = encodeProfile(state.name || "You", state.answers);

    var shelfHtml = top.map(function(r, i){
      return '<div class="book ' + (i===0?'top':'') + '">' +
        '<div class="book-title">' + esc(r.book.t) + '</div>' +
        '<div class="book-author">' + esc(r.book.a) + '</div>' +
        '<div class="book-tags">' + bookTagsHtml(r.book) + '</div>' +
        '<div class="book-foot"><span class="stamp-score">' + r.score + '% match</span></div>' +
      '</div>';
    }).join('');

    return '' + header('shelf') +
    '<h1 style="font-size:1.6rem;">Your shelf</h1>' +
    '<p class="lede">Based on your card. Redo it any time — nothing here is permanent.</p>' +
    '<div class="btn-row" style="margin-bottom:8px;">' +
      '<button class="btn ghost small" data-action="start-onboard">Redo my card</button>' +
    '</div>' +
    '<div class="shelf">' + shelfHtml + '</div>' +
    '<hr class="divider">' +
    '<h3>Your share code</h3>' +
    '<p class="muted" style="font-size:0.88rem;">Send this to your group chat. Anyone who pastes it into their own "The table" tab adds your taste to the group pick — no account or login needed.</p>' +
    '<div class="code-box">' + esc(code) + '</div>' +
    '<div class="btn-row"><button class="btn ghost small" data-action="copy-code">Copy code</button></div>' +
    footer();
  }

  function viewTable(){
    var group = state.group || [];
    var canRecommend = group.length >= 2;

    var membersHtml = group.length ? group.map(function(m, i){
      var chips = (m.answers.genres || []).slice(0,3).map(function(g){ return GENRE_LABELS[g]||g; }).join(', ') || 'no genres picked';
      return '<div class="member-row">' +
        '<div><div class="member-name">' + esc(m.name) + '</div><div class="member-meta">' + esc(chips) + '</div></div>' +
        '<button class="btn ghost small" data-action="remove-member" data-idx="' + i + '">Remove</button>' +
      '</div>';
    }).join('') : '<div class="empty">No one added yet. Paste a share code below to add the first reader.</div>';

    var recsHtml = '';
    if (canRecommend){
      var rows = groupRecs(group).slice(0, 10);
      recsHtml = '<hr class="divider"><h2>The table\'s picks</h2>' +
      '<p class="lede">Ranked by how well a book works for the person who likes it least, not just the average — so the top picks are the ones nobody in the group is likely to dread.</p>' +
      '<div class="shelf">' + rows.map(function(r, i){
        var ticks = r.scores.map(function(s){
          var cls = s >= 65 ? 'hi' : (s < 40 ? 'lo' : '');
          return '<i class="' + cls + '" title="' + s + '%"></i>';
        }).join('');
        return '<div class="book ' + (i===0?'top':'') + '">' +
          '<div class="book-title">' + esc(r.book.t) + '</div>' +
          '<div class="book-author">' + esc(r.book.a) + '</div>' +
          '<div class="book-tags">' + bookTagsHtml(r.book) + '</div>' +
          '<div class="book-foot">' +
            '<span class="stamp-score">' + r.group + '%</span>' +
            '<span class="ticks" title="one tick per reader">' + ticks + '</span>' +
          '</div>' +
        '</div>';
      }).join('') + '</div>';
    }

    return '' + header('table') +
    '<h1 style="font-size:1.6rem;">The table</h1>' +
    '<p class="lede">Build your group by pasting in everyone\'s share code. Everything happens on this device — add your own code too if you want yourself counted.</p>' +
    '<div class="card">' +
      '<h3>Members (' + group.length + ')</h3>' +
      membersHtml +
    '</div>' +
    '<div class="card">' +
      '<h3>Add a reader</h3>' +
      '<div class="field">' +
        '<label class="field-label">PASTE SHARE CODE</label>' +
        '<textarea id="code-input" placeholder="RT1-..."></textarea>' +
      '</div>' +
      '<div id="table-error"></div>' +
      '<div class="btn-row">' +
        '<button class="btn" data-action="add-member">Add to the table</button>' +
        (state.answers ? '<button class="btn ghost" data-action="add-self">Add myself</button>' : '') +
      '</div>' +
    '</div>' +
    recsHtml +
    footer();
  }

  /* ---------------------------------------------------------------
     ROUTER + EVENTS
  --------------------------------------------------------------- */
  function render(){
    var html;
    if (route === 'home') html = state.answers ? viewShelf() : viewHome();
    else if (route === 'onboard') html = viewOnboard();
    else if (route === 'shelf') html = viewShelf();
    else if (route === 'table') html = viewTable();
    else html = viewHome();
    app.innerHTML = html;
  }

  document.addEventListener('click', function(e){
    var nav = e.target.closest('[data-nav]');
    if (nav){ route = nav.getAttribute('data-nav'); render(); return; }

    var action = e.target.closest('[data-action]');
    if (action){
      var act = action.getAttribute('data-action');

      if (act === 'start-onboard'){
        state.onboardStep = 0;
        state.draft = state.answers ? JSON.parse(JSON.stringify(state.answers)) : {};
        route = 'onboard';
        render();
      }
      else if (act === 'onboard-next'){
        var step = state.onboardStep;
        var q = QUESTIONS[step];
        if (q.type === 'single' && (state.draft[q.id] === undefined)) return;
        if (step < QUESTIONS.length - 1){
          state.onboardStep++;
          render();
        } else {
          state.answers = state.draft;
          if (!state.name){
            var nm = prompt("What name should show up in the group? (You can change this later.)", "");
            state.name = (nm || "You").trim() || "You";
          }
          saveState();
          route = 'shelf';
          render();
        }
      }
      else if (act === 'onboard-back'){
        if (state.onboardStep > 0){ state.onboardStep--; render(); }
      }
      else if (act === 'copy-code'){
        var code = encodeProfile(state.name || "You", state.answers);
        navigator.clipboard && navigator.clipboard.writeText(code).catch(function(){});
        action.textContent = 'Copied';
        setTimeout(function(){ action.textContent = 'Copy code'; }, 1400);
      }
      else if (act === 'add-member'){
        var input = document.getElementById('code-input');
        var errBox = document.getElementById('table-error');
        errBox.innerHTML = '';
        try {
          var profile = decodeProfile(input.value);
          state.group = state.group || [];
          state.group.push(profile);
          saveState();
          input.value = '';
          render();
        } catch(err){
          errBox.innerHTML = '<div class="banner error">' + esc(err.message) + '</div>';
        }
      }
      else if (act === 'add-self'){
        state.group = state.group || [];
        state.group.push({ name: state.name || 'You', answers: state.answers });
        saveState();
        render();
      }
      else if (act === 'remove-member'){
        var idx = Number(action.getAttribute('data-idx'));
        state.group.splice(idx, 1);
        saveState();
        render();
      }
      return;
    }

    var opt = e.target.closest('[data-opt]');
    if (opt){
      var step2 = state.onboardStep;
      var q2 = QUESTIONS[step2];
      var val = opt.getAttribute('data-opt');
      if (q2.type === 'single'){
        state.draft[q2.id] = val;
      } else {
        var cur = state.draft[q2.id] || [];
        var pos = cur.indexOf(val);
        if (pos === -1) cur.push(val); else cur.splice(pos, 1);
        state.draft[q2.id] = cur;
      }
      render();
    }
  });

  render();
})();
