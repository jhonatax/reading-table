"""Step 1: pull the most-read English books from Open Library into data/candidates.jsonl.

Ranking = Open Library "reading log" count (how many users shelved the book), a decent
proxy for "famous books everybody knows". Re-running overwrites the file.

    python3 pipeline/fetch_candidates.py --limit 3000
"""
import argparse, json, pathlib, re, time, urllib.parse, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "candidates.jsonl"
UA = "ReadingTable/1.0 (https://github.com/jhonatax/reading-table)"
FIELDS = "key,title,author_name,first_publish_year,number_of_pages_median,subject,readinglog_count,language"
# Books that must be on the shelf regardless of rank (the original hand-picked list).
# Optional 3rd item = Open Library work id, for books the title search gets wrong.
MUST_HAVE = [
    ("The Kite Runner", "Khaled Hosseini"), ("Pachinko", "Min Jin Lee"), ("Circe", "Madeline Miller"),
    ("Project Hail Mary", "Andy Weir"), ("The Seven Husbands of Evelyn Hugo", "Taylor Jenkins Reid"),
    ("Educated", "Tara Westover"), ("Sapiens", "Yuval Noah Harari"),
    ("One Hundred Years of Solitude", "Gabriel García Márquez"), ("Homegoing", "Yaa Gyasi"),
    ("The Housemaid", "Freida McFadden"), ("Where the Crawdads Sing", "Delia Owens"),
    ("The Midnight Library", "Matt Haig"), ("Klara and the Sun", "Kazuo Ishiguro"),
    ("The Silent Patient", "Alex Michaelides"), ("Convenience Store Woman", "Sayaka Murata"),
    ("The Overstory", "Richard Powers"), ("Beloved", "Toni Morrison"), ("The Alchemist", "Paulo Coelho"),
    ("Braiding Sweetgrass", "Robin Wall Kimmerer"), ("Gone Girl", "Gillian Flynn"),
    ("A Man Called Ove", "Fredrik Backman", "OL16793865W"), ("The Nickel Boys", "Colson Whitehead"),
    ("Crying in H Mart", "Michelle Zauner"), ("The Three-Body Problem", "Liu Cixin", "OL17267881W"),
    ("Tomorrow, and Tomorrow, and Tomorrow", "Gabrielle Zevin"), ("Lessons in Chemistry", "Bonnie Garmus"),
]

def get(params):
    url = "https://openlibrary.org/search.json?" + urllib.parse.urlencode(params)
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)["docs"]
        except Exception as e:
            print("  retry", attempt + 1, e); time.sleep(3 * (attempt + 1))
    raise RuntimeError("Open Library unreachable: " + url)

def norm(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())

def row(d, forced=False):
    return {
        "id": d["key"].split("/")[-1],
        "title": d.get("title"),
        "author": (d.get("author_name") or [None])[0],
        "year": d.get("first_publish_year"),
        "pages": d.get("number_of_pages_median"),
        "subjects": (d.get("subject") or [])[:25],
        "popularity": d.get("readinglog_count") or 0,
        "forced": forced,
    }

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--limit", type=int, default=3000)
    args = ap.parse_args()
    rows, seen = [], set()
    def add(r):
        k = norm(r["title"]) + "|" + norm(r["author"])
        if not r["author"] or not r["title"] or k in seen: return False
        seen.add(k); rows.append(r); return True
    for title, author, *work_id in MUST_HAVE:
        if work_id:
            docs = get({"q": f"key:/works/{work_id[0]}", "fields": FIELDS, "limit": 1})
        else:
            docs = get({"title": title, "author": author, "fields": FIELDS, "limit": 1, "sort": "readinglog"})
        if not docs:
            print("  MISSING must-have:", title); continue
        if not work_id and norm(title) not in norm(docs[0].get("title")):
            print(f"  CHECK must-have {title!r} matched {docs[0].get('title')!r} - pin its work id")
        add(row(docs[0], forced=True))
    page = 1
    while len(rows) < args.limit:
        docs = get({"q": "language:eng", "sort": "readinglog", "fields": FIELDS, "limit": 500, "page": page})
        if not docs: break
        for d in docs:
            add(row(d))
        print(f"page {page}: {len(rows)} candidates"); page += 1; time.sleep(1)
    rows = rows[: args.limit]
    with OUT.open("w") as f:
        for r in rows: f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"wrote {len(rows)} rows -> {OUT.relative_to(ROOT)}")

if __name__ == "__main__":
    main()
