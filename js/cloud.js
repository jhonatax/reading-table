/* Thin wrapper around Supabase: login by emailed link + saving the user's data.
   If js/config.js is empty, RTCloud.enabled is false and the app runs device-only. */
window.RTCloud = (function(){
  var cfg = window.RT_CONFIG || {};
  var enabled = !!(cfg.supabaseUrl && cfg.supabaseKey && window.supabase);
  var sb = enabled ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey) : null;

  function check(res){ if (res.error) throw res.error; return res.data; }

  return {
    enabled: enabled,

    sendLoginLink: function(email){
      return sb.auth.signInWithOtp({
        email: email,
        options: { emailRedirectTo: location.origin + location.pathname }
      }).then(check);
    },
    signOut: function(){ return sb.auth.signOut(); },
    onUserChange: function(cb){
      sb.auth.onAuthStateChange(function(_event, session){
        // Defer: Supabase recommends not awaiting other calls inside this callback.
        setTimeout(function(){ cb(session ? session.user : null); }, 0);
      });
    },

    loadAll: function(){
      return Promise.all([
        sb.from('profiles').select('display_name, answers, recommendations').maybeSingle().then(check),
        sb.from('group_members').select('id, name, answers').order('added_at').then(check),
        sb.from('read_books').select('book_id').then(check)
      ]).then(function(r){
        return { profile: r[0], group: r[1] || [], read: (r[2] || []).map(function(x){ return x.book_id; }) };
      });
    },
    saveProfile: function(userId, name, answers, recommendations){
      return sb.from('profiles').upsert({
        user_id: userId, display_name: name, answers: answers,
        recommendations: recommendations, updated_at: new Date().toISOString()
      }).then(check);
    },
    addMember: function(m){
      return sb.from('group_members').insert({ name: m.name, answers: m.answers })
        .select('id').single().then(check).then(function(row){ return row.id; });
    },
    removeMember: function(id){ return sb.from('group_members').delete().eq('id', id).then(check); },
    markRead: function(bookIds){
      return sb.from('read_books').upsert(bookIds.map(function(id){ return { book_id: id }; }),
        { onConflict: 'user_id,book_id', ignoreDuplicates: true }).then(check);
    },
    unmarkRead: function(bookId){ return sb.from('read_books').delete().eq('book_id', bookId).then(check); },
    deleteMyData: function(userId){
      return Promise.all([
        sb.from('read_books').delete().eq('user_id', userId).then(check),
        sb.from('group_members').delete().eq('user_id', userId).then(check),
        sb.from('profiles').delete().eq('user_id', userId).then(check)
      ]);
    }
  };
})();
