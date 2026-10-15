(function(){

  var BOOKS = window.RT_DATA.BOOKS;
  var GENRE_LABELS = window.RT_DATA.GENRE_LABELS;
  var QUESTIONS = window.RT_DATA.QUESTIONS;
  var Cloud = window.RTCloud || { enabled: false };
  var BOOK_BY_ID = {};
  BOOKS.forEach(function(b){ BOOK_BY_ID[b.id] = b; });
  var PAGE = 12;

  /* ---------------------------------------------------------------
     STATE + STORAGE
     localStorage is always the working copy. When signed in, every change
     is also written to the user's account (Supabase).
  --------------------------------------------------------------- */
  var LS_KEY = "reading_table_v1";
  function freshState(){ return { name:"", answers:null, group:[], read:[], onboardStep:0, draft:{} }; }
  function loadState(){
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw){ var s = JSON.parse(raw); s.read = s.read || []; s.group = s.group || []; return s; }
    } catch(e){}
    return freshState();
  }
  function saveState(){
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch(e){}
  }

  var state = loadState();
  var route = state.answers ? "shelf" : "home";
  var user = null;             // signed-in Supabase user, or null
  var shelfLimit = PAGE, tableLimit = 10;
  var notice = null;           // {kind:'error'|'info', text}
  var loginSentTo = null;

  // Errors from an expired/invalid login link arrive in the URL hash.
  (function(){
    var h = new URLSearchParams(location.hash.slice(1));
    if (h.get('error_description')){
      notice = { kind:'error', text: 'Login link problem: ' + h.get('error_description') + '. Request a new link.' };
      history.replaceState(null, '', location.pathname);
      route = 'account';
    }
  })();

  function cloudCall(promise){
    if (!promise) return;
    promise.catch(function(err){
      console.error(err);
      notice = { kind:'error', text:"Couldn't save to your account (" + (err.message || err) + "). It's still saved on this device." };
      render();
    });
  }

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

  function unread(){
    var read = {};
    (state.read || []).forEach(function(id){ read[id] = true; });
    return BOOKS.filter(function(b){ return !read[b.id]; });
  }

  // Ties (common with thousands of books) are broken by popularity.
  function personalRecs(answers){
    var scored = unread().map(function(b){ return { book:b, score: scoreBook(answers, b) }; });
    scored.sort(function(x,y){ return (y.score - x.score) || ((y.book.pop||0) - (x.book.pop||0)); });
    return scored;
  }

  function groupRecs(members){
    var rows = unread().map(function(b){
      var scores = members.map(function(m){ return scoreBook(m.answers, b); });
      var min = Math.min.apply(null, scores);
      var avg = scores.reduce(function(a,c){return a+c;},0) / scores.length;
      var group = Math.round(min * 0.6 + avg * 0.4);
      return { book:b, scores:scores, min:min, avg:Math.round(avg), group:group };
    });
    rows.sort(function(x,y){
      return (y.group - x.group) || (y.min - x.min) || ((y.book.pop||0) - (x.book.pop||0));
    });
    return rows;
  }

  function recSnapshot(){
    return personalRecs(state.answers).slice(0, 24).map(function(r){ return { id:r.book.id, score:r.score }; });
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
     ACCOUNT SYNC
  --------------------------------------------------------------- */
  // On sign-in: the account is the source of truth; anything only on this
  // device (answers, group members, read books) is uploaded into it.
  function syncOnSignIn(){
    return Cloud.loadAll().then(function(cloud){
      var uploads = [];
      if (cloud.profile && cloud.profile.answers){
        state.answers = cloud.profile.answers;
        state.name = cloud.profile.display_name || state.name;
      } else if (state.answers){
        uploads.push(Cloud.saveProfile(user.id, state.name, state.answers, recSnapshot()));
      }
      var localOnly = (state.group || []).filter(function(m){ return !m.id; });
      var cloudGroup = cloud.group.map(function(m){ return { id:m.id, name:m.name, answers:m.answers }; });
      uploads.push(Promise.all(localOnly.map(function(m){
        return Cloud.addMember(m).then(function(id){ cloudGroup.push({ id:id, name:m.name, answers:m.answers }); });
      })));
      var cloudRead = {}; cloud.read.forEach(function(id){ cloudRead[id] = true; });
      var newRead = (state.read || []).filter(function(id){ return !cloudRead[id]; });
      if (newRead.length) uploads.push(Cloud.markRead(newRead));
      return Promise.all(uploads).then(function(){
        state.group = cloudGroup;
        state.read = cloud.read.concat(newRead);
        saveState();
      });
    });
  }

  /* ---------------------------------------------------------------
     RENDER HELPERS
  --------------------------------------------------------------- */
  var app = document.getElementById("app");
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
  }); }

  function header(active){
    var acct = Cloud.enabled
      ? '<button data-nav="account" class="' + (active==='account'?'active':'') + '">' + (user ? 'Account' : 'Log in') + '</button>'
      : '';
    return '' +
    '<header class="site">' +
      '<div class="wordmark">The Reading Table<small>A SHELF, READ BY EVERYONE</small></div>' +
      '<nav class="tabs">' +
        '<button data-nav="shelf" class="' + (active==='shelf'||active==='onboard'||active==='home'?'active':'') + '">My shelf</button>' +
        '<button data-nav="table" class="' + (active==='table'?'active':'') + '">The table</button>' +
        acct +
      '</nav>' +
    '</header>' +
    (notice ? '<div class="banner ' + (notice.kind==='error'?'error':'') + '">' + esc(notice.text) +
      ' <button class="btn ghost small" data-action="dismiss" style="margin-left:8px">OK</button></div>' : '');
  }

  function footer(){
    return '<footer class="site">Recommendations come from ' + BOOKS.length.toLocaleString('en-US') +
      ' widely read books, rated by AI on pace, tone and challenge, and a simple scoring rule — a starting point for the group to argue about, not a verdict.' +
      ' <a href="privacy.html">Privacy</a></footer>';
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
        (Cloud.enabled && !user ? '<button class="btn ghost" data-nav="account">Log in to load my saved card</button>' : '') +
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

  function bookCard(b, i, footHtml){
    return '<div class="book ' + (i===0?'top':'') + '">' +
      '<div class="book-title">' + esc(b.t) + '</div>' +
      '<div class="book-author">' + esc(b.a) + (b.y ? ' · ' + esc(b.y) : '') + '</div>' +
      '<div class="book-tags">' + bookTagsHtml(b) + '</div>' +
      '<div class="book-foot">' + footHtml + '</div>' +
      '<button class="btn ghost small read-btn" data-action="mark-read" data-id="' + esc(b.id) + '" title="Already read it? It won\'t be recommended again.">I\'ve read this</button>' +
    '</div>';
  }

  function viewShelf(){
    if (!state.answers){
      return '' + header('shelf') +
      '<div class="empty"><p style="margin-bottom:14px;">You have not filled out your card yet.</p><button class="btn" data-action="start-onboard">Fill out my card</button></div>' +
      footer();
    }
    var recs = personalRecs(state.answers);
    var top = recs.slice(0, shelfLimit);
    var code = encodeProfile(state.name || "You", state.answers);

    var shelfHtml = top.map(function(r, i){
      return bookCard(r.book, i, '<span class="stamp-score">' + r.score + '% match</span>');
    }).join('');

    var readHtml = '';
    if (state.read.length){
      readHtml = '<hr class="divider"><details><summary><h3 style="display:inline">Books you\'ve read (' + state.read.length + ')</h3></summary>' +
        '<p class="muted" style="font-size:0.88rem;margin-top:10px">These are left out of your recommendations and your group\'s picks.</p>' +
        state.read.map(function(id){
          var b = BOOK_BY_ID[id];
          return '<div class="member-row"><div><div class="member-name">' + esc(b ? b.t : id) + '</div>' +
            '<div class="member-meta">' + esc(b ? b.a : 'no longer on the shelf') + '</div></div>' +
            '<button class="btn ghost small" data-action="unmark-read" data-id="' + esc(id) + '">Undo</button></div>';
        }).join('') + '</details>';
    }

    var saveHint = Cloud.enabled && !user
      ? '<div class="banner">Your card is saved on this device only. <a href="#" data-nav="account">Log in</a> to keep it in your account and use it on any device.</div>'
      : '';

    return '' + header('shelf') +
    '<h1 style="font-size:1.6rem;">Your shelf</h1>' +
    '<p class="lede">Based on your card. Redo it any time — nothing here is permanent.</p>' +
    saveHint +
    '<div class="btn-row" style="margin-bottom:8px;">' +
      '<button class="btn ghost small" data-action="start-onboard">Redo my card</button>' +
    '</div>' +
    '<div class="shelf">' + shelfHtml + '</div>' +
    (recs.length > shelfLimit ? '<div class="btn-row" style="margin-top:18px"><button class="btn ghost" data-action="more-shelf">Show more</button></div>' : '') +
    readHtml +
    '<hr class="divider">' +
    '<h3>Your share code</h3>' +
    '<p class="muted" style="font-size:0.88rem;">Send this to your group chat. Anyone who pastes it into their own "The table" tab adds your taste to the group pick.</p>' +
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
      var all = groupRecs(group);
      var rows = all.slice(0, tableLimit);
      recsHtml = '<hr class="divider"><h2>The table\'s picks</h2>' +
      '<p class="lede">Ranked by how well a book works for the person who likes it least, not just the average — so the top picks are the ones nobody in the group is likely to dread.</p>' +
      '<div class="shelf">' + rows.map(function(r, i){
        var ticks = r.scores.map(function(s){
          var cls = s >= 65 ? 'hi' : (s < 40 ? 'lo' : '');
          return '<i class="' + cls + '" title="' + s + '%"></i>';
        }).join('');
        return bookCard(r.book, i, '<span class="stamp-score">' + r.group + '%</span>' +
          '<span class="ticks" title="one tick per reader">' + ticks + '</span>');
      }).join('') + '</div>' +
      (all.length > tableLimit ? '<div class="btn-row" style="margin-top:18px"><button class="btn ghost" data-action="more-table">Show more</button></div>' : '');
    }

    return '' + header('table') +
    '<h1 style="font-size:1.6rem;">The table</h1>' +
    '<p class="lede">Build your group by pasting in everyone\'s share code' + (user ? ' — your group is saved to your account.' : '. Add your own code too if you want yourself counted.') + '</p>' +
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

  function viewAccount(){
    if (user){
      return '' + header('account') +
      '<h1 style="font-size:1.6rem;">Your account</h1>' +
      '<div class="card">' +
        '<div class="card-label type-meta">SIGNED IN AS</div>' +
        '<h3>' + esc(user.email) + '</h3>' +
        '<p class="muted" style="font-size:0.9rem">Your card, recommendations, group and read books are saved to this account. Log in with the same email on any device to get them back.</p>' +
        '<div class="field"><label class="field-label">NAME SHOWN IN GROUPS</label>' +
          '<input type="text" id="name-input" value="' + esc(state.name) + '"></div>' +
        '<div class="btn-row">' +
          '<button class="btn" data-action="save-name">Save name</button>' +
          '<button class="btn ghost" data-action="logout">Log out</button>' +
        '</div>' +
      '</div>' +
      '<div class="card">' +
        '<h3>Delete my saved data</h3>' +
        '<p class="muted" style="font-size:0.9rem">Permanently removes your card, recommendations, group and read books from our database.</p>' +
        '<button class="btn ghost" data-action="delete-data">Delete my data</button>' +
      '</div>' +
      footer();
    }
    var form = loginSentTo
      ? '<p>We sent a login link to <strong>' + esc(loginSentTo) + '</strong>. Open it on this device to finish logging in. It can take a minute; check your spam folder too.</p>' +
        '<button class="btn ghost small" data-action="login-retry">Use a different email</button>'
      : '<div class="field"><label class="field-label">EMAIL</label>' +
          '<input type="text" id="email-input" inputmode="email" autocomplete="email" placeholder="you@example.com"></div>' +
        '<div id="login-error"></div>' +
        '<button class="btn" data-action="send-link">Email me a login link</button>';
    return '' + header('account') +
    '<h1 style="font-size:1.6rem;">Log in</h1>' +
    '<p class="lede">No password needed — we email you a link. Logging in saves your card, recommendations, group and the books you\'ve read, so you can come back to them on any device.</p>' +
    '<div class="card">' + form + '</div>' +
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
    else if (route === 'account' && Cloud.enabled) html = viewAccount();
    else html = viewHome();
    app.innerHTML = html;
  }

  function markRead(id){
    if (state.read.indexOf(id) !== -1) return;
    state.read.push(id);
    saveState();
    if (user) cloudCall(Cloud.markRead([id]));
  }

  document.addEventListener('click', function(e){
    var nav = e.target.closest('[data-nav]');
    if (nav){ e.preventDefault(); route = nav.getAttribute('data-nav'); shelfLimit = PAGE; tableLimit = 10; render(); window.scrollTo(0,0); return; }

    var action = e.target.closest('[data-action]');
    if (action){
      var act = action.getAttribute('data-action');

      if (act === 'dismiss'){ notice = null; render(); }
      else if (act === 'start-onboard'){
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
            var suggested = user ? user.email.split('@')[0] : "";
            var nm = prompt("What name should show up in the group? (You can change this later.)", suggested);
            state.name = (nm || "You").trim() || "You";
          }
          saveState();
          if (user) cloudCall(Cloud.saveProfile(user.id, state.name, state.answers, recSnapshot()));
          route = 'shelf'; shelfLimit = PAGE;
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
      else if (act === 'add-member' || act === 'add-self'){
        var errBox = document.getElementById('table-error');
        var profile;
        try {
          if (act === 'add-self') profile = { name: state.name || 'You', answers: state.answers };
          else profile = decodeProfile(document.getElementById('code-input').value);
        } catch(err){
          errBox.innerHTML = '<div class="banner error">' + esc(err.message) + '</div>';
          return;
        }
        state.group.push(profile);
        saveState();
        if (user) cloudCall(Cloud.addMember(profile).then(function(id){ profile.id = id; saveState(); }));
        render();
      }
      else if (act === 'remove-member'){
        var idx = Number(action.getAttribute('data-idx'));
        var removed = state.group.splice(idx, 1)[0];
        saveState();
        if (user && removed && removed.id) cloudCall(Cloud.removeMember(removed.id));
        render();
      }
      else if (act === 'mark-read'){ markRead(action.getAttribute('data-id')); render(); }
      else if (act === 'unmark-read'){
        var id = action.getAttribute('data-id');
        state.read = state.read.filter(function(x){ return x !== id; });
        saveState();
        if (user) cloudCall(Cloud.unmarkRead(id));
        render();
      }
      else if (act === 'more-shelf'){ shelfLimit += PAGE; render(); }
      else if (act === 'more-table'){ tableLimit += 10; render(); }
      else if (act === 'send-link'){
        var email = document.getElementById('email-input').value.trim();
        var box = document.getElementById('login-error');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
          box.innerHTML = '<div class="banner error">Please enter a valid email address.</div>'; return;
        }
        action.disabled = true; action.textContent = 'Sending…';
        Cloud.sendLoginLink(email).then(function(){ loginSentTo = email; render(); })
          .catch(function(err){
            action.disabled = false; action.textContent = 'Email me a login link';
            box.innerHTML = '<div class="banner error">Couldn\'t send the link: ' + esc(err.message || err) + '</div>';
          });
      }
      else if (act === 'login-retry'){ loginSentTo = null; render(); }
      else if (act === 'save-name'){
        state.name = document.getElementById('name-input').value.trim() || 'You';
        saveState();
        if (state.answers) cloudCall(Cloud.saveProfile(user.id, state.name, state.answers, recSnapshot()));
        notice = { kind:'info', text:'Name saved.' };
        render();
      }
      else if (act === 'logout'){
        Cloud.signOut();   // onUserChange(null) clears this device
      }
      else if (act === 'delete-data'){
        if (!confirm('Delete your saved card, recommendations, group and read books? This cannot be undone.')) return;
        Cloud.deleteMyData(user.id).then(function(){
          state = freshState(); saveState();
          notice = { kind:'info', text:'Your saved data was deleted.' };
          render();
        }).catch(function(err){ notice = { kind:'error', text:'Delete failed: ' + (err.message || err) }; render(); });
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

  if (Cloud.enabled){
    Cloud.onUserChange(function(u){
      var wasSignedIn = !!user;
      if (u && (!user || user.id !== u.id)){
        user = u; loginSentTo = null;
        syncOnSignIn().then(function(){
          if (route === 'account' || route === 'home') route = state.answers ? 'shelf' : 'home';
          render();
        }).catch(function(err){
          notice = { kind:'error', text:"Logged in, but couldn't load your saved data: " + (err.message || err) };
          render();
        });
        render();
      } else if (!u && wasSignedIn){
        // Logged out: clear personal data from this device (it stays in the account).
        user = null; state = freshState(); saveState(); route = 'home';
        notice = { kind:'info', text:'You are logged out. Your data is still saved in your account.' };
        render();
      }
    });
  }

  render();
})();
