# Book classification rubric

Used by the AI classifier (pipeline/classify_books.py, or AI agents) to turn Open Library
candidates into shelf entries. Output is ONE JSON object per line (JSONL), one per input book.

## Output fields
| field | type | rule |
|---|---|---|
| id | string | copy from input |
| include | bool | false if: textbook, reference, academic/technical manual, exam/study guide, summary/workbook of another book, picture book or early reader for young children, cookbook, colouring/activity book, sheet music, religious scripture text, a non-English edition or duplicate of a better-known English edition, an omnibus/box set, or too obscure for a general reading group. Middle-grade and YA books that adults widely know (Harry Potter, Percy Jackson, The Hunger Games) stay included. Exclude instalments of long-running kids' series and heavily illustrated kids' books (Diary of a Wimpy Kid, Dork Diaries, Big Nate, Goosebumps, Warriors, Wings of Fire, Keeper of the Lost Cities, Dog Man, Geronimo Stilton). Exclude graphic adaptations of novels and mid-series manga volumes. Books written in another language are KEPT under their common English title unless an English edition is also in the list. |
| exclude_reason | string | short reason when include=false, else "" |
| title | string | the common English title (e.g. "O Alquimista" -> "The Alchemist"; fix ALL-LOWERCASE titles) |
| author | string | the real author's common name (fix wrong author attributions you are confident about) |
| genres | list | 1-3 of: literary, mystery-thriller, scifi-fantasy, nonfiction, romance, history, classics, horror, self-help, biography-memoir, young-adult |
| culture | string | main setting/perspective, one of: US/UK, Europe, Asia, Africa, Latin America, Middle East/Central Asia, Oceania, Global |
| format | string | fiction or nonfiction |
| pace | int 1-5 | 1 = slow/meditative, 5 = page-turner |
| tone | int 1-5 | 1 = light/hopeful, 5 = dark/intense |
| challenge | int 1-5 | 1 = easy comfort read, 5 = demanding prose or ideas |
| pages | int | copy input pages if given and plausible for the main edition, otherwise your best estimate |
| content | list | any of: violence, graphic-content, dense-prose, slow-pacing, sentimental, emotionally-heavy, sexual-content (explicit sex scenes) |

Use "history" for historical fiction too. Use "classics" for widely canonical works published before ~1960.
Use "self-help" for self-help, business, productivity, psychology-for-lay-readers.

## Calibration: existing hand-rated books (match this scale)
```
{t:"The Kite Runner", a:"Khaled Hosseini", genres:["literary"], culture:"Middle East/Central Asia", pace:3, tone:4, challenge:3, length:"long", format:"fiction", content:["violence","emotionally-heavy"]}
{t:"Pachinko", a:"Min Jin Lee", genres:["literary","history"], culture:"Asia", pace:2, tone:3, challenge:3, length:"long", format:"fiction", content:["emotionally-heavy"]}
{t:"Circe", a:"Madeline Miller", genres:["scifi-fantasy"], culture:"Europe", pace:3, tone:3, challenge:2, length:"medium", format:"fiction", content:[]}
{t:"Project Hail Mary", a:"Andy Weir", genres:["scifi-fantasy"], culture:"US/UK", pace:5, tone:2, challenge:2, length:"long", format:"fiction", content:[]}
{t:"The Seven Husbands of Evelyn Hugo", a:"Taylor Jenkins Reid", genres:["romance"], culture:"US/UK", pace:4, tone:3, challenge:1, length:"medium", format:"fiction", content:[]}
{t:"Educated", a:"Tara Westover", genres:["nonfiction","history"], culture:"US/UK", pace:3, tone:4, challenge:3, length:"medium", format:"nonfiction", content:["emotionally-heavy"]}
{t:"Sapiens", a:"Yuval Noah Harari", genres:["nonfiction","history"], culture:"Global", pace:2, tone:2, challenge:4, length:"long", format:"nonfiction", content:["dense-prose"]}
{t:"One Hundred Years of Solitude", a:"Gabriel García Márquez", genres:["literary"], culture:"Latin America", pace:1, tone:3, challenge:5, length:"long", format:"fiction", content:["dense-prose","slow-pacing"]}
{t:"Homegoing", a:"Yaa Gyasi", genres:["literary","history"], culture:"Africa", pace:2, tone:4, challenge:3, length:"medium", format:"fiction", content:["violence","emotionally-heavy"]}
{t:"The Housemaid", a:"Freida McFadden", genres:["mystery-thriller"], culture:"US/UK", pace:5, tone:4, challenge:1, length:"short", format:"fiction", content:["violence","graphic-content"]}
{t:"Where the Crawdads Sing", a:"Delia Owens", genres:["literary","mystery-thriller"], culture:"US/UK", pace:3, tone:3, challenge:2, length:"medium", format:"fiction", content:[]}
{t:"The Midnight Library", a:"Matt Haig", genres:["scifi-fantasy"], culture:"Europe", pace:3, tone:3, challenge:2, length:"short", format:"fiction", content:["sentimental"]}
{t:"Klara and the Sun", a:"Kazuo Ishiguro", genres:["literary","scifi-fantasy"], culture:"Asia", pace:2, tone:3, challenge:4, length:"medium", format:"fiction", content:[]}
{t:"The Silent Patient", a:"Alex Michaelides", genres:["mystery-thriller"], culture:"Europe", pace:5, tone:5, challenge:2, length:"medium", format:"fiction", content:["violence"]}
{t:"Convenience Store Woman", a:"Sayaka Murata", genres:["literary"], culture:"Asia", pace:3, tone:2, challenge:2, length:"short", format:"fiction", content:[]}
{t:"The Overstory", a:"Richard Powers", genres:["literary"], culture:"US/UK", pace:1, tone:3, challenge:5, length:"long", format:"fiction", content:["dense-prose","slow-pacing"]}
{t:"Beloved", a:"Toni Morrison", genres:["literary","history"], culture:"US/UK", pace:1, tone:5, challenge:5, length:"medium", format:"fiction", content:["violence","dense-prose","emotionally-heavy"]}
{t:"The Alchemist", a:"Paulo Coelho", genres:["literary"], culture:"Latin America", pace:3, tone:2, challenge:1, length:"short", format:"fiction", content:["sentimental"]}
{t:"Braiding Sweetgrass", a:"Robin Wall Kimmerer", genres:["nonfiction"], culture:"Global", pace:1, tone:2, challenge:3, length:"long", format:"nonfiction", content:["slow-pacing"]}
{t:"Gone Girl", a:"Gillian Flynn", genres:["mystery-thriller"], culture:"US/UK", pace:5, tone:5, challenge:2, length:"medium", format:"fiction", content:["violence","graphic-content"]}
{t:"A Man Called Ove", a:"Fredrik Backman", genres:["literary"], culture:"Europe", pace:2, tone:2, challenge:1, length:"medium", format:"fiction", content:["sentimental"]}
{t:"The Nickel Boys", a:"Colson Whitehead", genres:["literary","history"], culture:"US/UK", pace:2, tone:5, challenge:4, length:"short", format:"fiction", content:["violence","emotionally-heavy"]}
{t:"Crying in H Mart", a:"Michelle Zauner", genres:["nonfiction"], culture:"Asia", pace:3, tone:4, challenge:2, length:"medium", format:"nonfiction", content:["emotionally-heavy"]}
{t:"The Three-Body Problem", a:"Liu Cixin", genres:["scifi-fantasy"], culture:"Asia", pace:3, tone:3, challenge:4, length:"long", format:"fiction", content:[]}
{t:"Tomorrow, and Tomorrow, and Tomorrow", a:"Gabrielle Zevin", genres:["literary"], culture:"US/UK", pace:3, tone:3, challenge:2, length:"medium", format:"fiction", content:[]}
{t:"Lessons in Chemistry", a:"Bonnie Garmus", genres:["literary","history"], culture:"US/UK", pace:4, tone:3, challenge:1, length:"medium", format:"fiction", content:[]}
```
(length short <250 pages, medium 250-400, long 400+; computed from `pages` at build time.)

## Example output line
{"id":"OL82563W","include":true,"exclude_reason":"","title":"Harry Potter and the Philosopher's Stone","author":"J. K. Rowling","genres":["scifi-fantasy","young-adult"],"culture":"US/UK","format":"fiction","pace":4,"tone":2,"challenge":1,"pages":223,"content":[]}
