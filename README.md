# The Reading Table

Find a book your whole reading group will actually enjoy. Each person fills out a short quiz, shares a code, and the app ranks books by how well they work for the *least* enthusiastic reader.

Static site: plain HTML/CSS/JS, no build step, no server, no database. All user data stays in the visitor's browser (`localStorage`).

## Project layout

| Path | What it is |
|---|---|
| `index.html` | Page shell |
| `css/styles.css` | All styling (light/dark themes) |
| `js/data.js` | **Content**: books, genre labels, quiz questions — edit this most often |
| `js/app.js` | App logic: scoring, share codes, views |
| `.github/workflows/deploy.yml` | Auto-deploys to GitHub Pages on every push to `main` |

## Run locally

```bash
cd ~/projects/reading-table
python3 -m http.server 8000
# open http://localhost:8000
```

## Make a change and publish

```bash
git add -A
git commit -m "Add 5 new books"
git push            # deploy runs automatically (~1 min); see the Actions tab
```

## Adding a book

Add an entry to `BOOKS` in `js/data.js`:

```js
{t:"Title", a:"Author", genres:["literary"], culture:"Europe", pace:3, tone:3, challenge:2,
 length:"medium", format:"fiction", content:[]},
```

- `pace`, `tone`, `challenge`: 1 (slow / light / easy) to 5 (fast / dark / hard)
- `genres`: `literary`, `mystery-thriller`, `scifi-fantasy`, `nonfiction`, `romance`, `history`
- `culture`: use `US/UK` for Anglo settings (scoring treats everything else as "different")
- `content`: any of `violence`, `graphic-content`, `dense-prose`, `slow-pacing`, `sentimental`, `emotionally-heavy`

Note: changing question ids or option values will make old share codes score oddly; adding books is always safe.
