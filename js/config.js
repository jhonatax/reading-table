/* Supabase connection (accounts + saved data).
   Both values are PUBLIC by design (safe to commit): the database's Row Level Security
   rules are what protect user data. Leave empty to run the site without accounts.
   Find them in Supabase: Project Settings -> API Keys / Data API. */
window.RT_CONFIG = {
  supabaseUrl: "",
  supabaseKey: ""   // the "publishable" (or legacy "anon") key - NEVER the secret/service_role key
};
