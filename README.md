# The Reading Table

Find a book your whole reading group will actually enjoy. Each person fills out a short quiz, shares a code, and the app ranks ~2,180 well-known books by how well they work for the *least* enthusiastic reader.

Static site (plain HTML/CSS/JS, no build tools) hosted on GitHub Pages. Optional accounts use Supabase (hosted Postgres + email login).

## Project layout

| Path | What it is |
|---|---|
| `index.html`, `privacy.html` | Pages |
| `css/styles.css` | Styling (light/dark themes) |
| `js/data.js` | Quiz questions + genre labels |
| `js/books.js` | **Generated** book list — don't edit; see "Book data" |
| `js/app.js` | App logic: scoring, views, share codes, account sync |
| `js/cloud.js` | Supabase calls (login link, save/load) |
| `js/config.js` | Supabase URL + publishable key (public by design) |
| `js/vendor/` | Pinned copy of the Supabase JS library |
| `pipeline/` | Python scripts that build the book list |
| `data/` | Pipeline inputs/outputs (`books.csv` = the final shelf) |
| `supabase/migrations/` | Database schema (SQL) |
| `.github/workflows/deploy.yml` | On push to `main`: check JS + book data, then deploy |

## Run locally

```bash
cd ~/projects/reading-table
python3 -m http.server 8000      # open http://localhost:8000
```

## Publish a change

```bash
git add -A && git commit -m "Describe the change" && git push
```
The site updates ~1 minute later. If a check fails, the live site stays as it was; see the repo's **Actions** tab.

## Book data (the pipeline)

```
Open Library ──fetch──▶ data/candidates.jsonl ──AI classify──▶ data/classifications.jsonl
                                                   + data/overrides.csv (your fixes)
                                   ──build──▶ data/books.csv + js/books.js
```

1. `python3 pipeline/fetch_candidates.py --limit 3000` — the most-read English books on Open Library (popularity = reading-log count). Books in `MUST_HAVE` are always included.
2. `python3 pipeline/classify_books.py` — AI rates only books not classified yet (needs `ANTHROPIC_API_KEY`; roughly a few cents per 100 books). The rules are in `pipeline/CLASSIFY.md`. The AI also drops textbooks, picture books, study guides, foreign-language duplicates, etc.
3. `python3 pipeline/build_books.py` — validates, removes duplicates, writes `data/books.csv` and `js/books.js`.

**Fixing a rating or removing a book:** add a row to `data/overrides.csv` (create it if missing), then run step 3:

```csv
id,include,pace,tone,challenge,genres,content
OL82563W,,4,2,1,,
OL12345W,false,,,,,
OL99999W,,,,,literary|history,violence
```
Find a book's `id` in `data/books.csv`. Lists use `|`. Empty cells keep the AI's value. The file also has `title`, `author`, `culture`, `format`, `pages` and a free-text `note` column (for your own reference).

Field meanings: `pace` / `tone` / `challenge` are 1 (slow / light / easy) to 5 (fast / dark / hard); `length` comes from `pages` (<250 short, ≤400 medium, else long). Allowed values are listed in `pipeline/CLASSIFY.md`.

Note: renaming quiz option values in `js/data.js` breaks old share codes; adding options or books is always safe.

## Accounts (Supabase)

Login is by emailed link (no passwords). Logged-in users get their card, recommendations, group and read books saved; logged-out users keep everything in their browser only. If `js/config.js` is empty, the login tab is hidden and the site works device-only.

Tables (see `supabase/migrations/001_init.sql`): `profiles` (answers, latest recommendations), `group_members`, `read_books`. Row Level Security limits every row to its owner. To explore data: Supabase dashboard → **Table Editor** or **SQL Editor**, e.g.

```sql
select count(*) as users, count(answers) as with_card from profiles;
select book_id, count(*) from read_books group by 1 order by 2 desc limit 20;
```

**Schema changes:** add a new numbered file in `supabase/migrations/` and run it in the SQL Editor — never edit one that's already been run.

**Email limits:** Supabase's built-in email sender only allows a few login emails per hour. For real traffic, connect your own SMTP provider (e.g. Resend, free tier) under Authentication → Emails → SMTP Settings.
