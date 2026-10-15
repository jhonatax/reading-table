"""Validate one classifier output file against its input chunk.

    python3 pipeline/check_chunk.py data/classify_tmp/chunk_00.jsonl data/classify_tmp/out_00.jsonl
Prints problems and exits 1 if any; prints OK + counts otherwise.
"""
import json, sys

GENRES = {"literary", "mystery-thriller", "scifi-fantasy", "nonfiction", "romance", "history",
          "classics", "horror", "self-help", "biography-memoir", "young-adult"}
CULTURES = {"US/UK", "Europe", "Asia", "Africa", "Latin America", "Middle East/Central Asia", "Oceania", "Global"}
CONTENT = {"violence", "graphic-content", "dense-prose", "slow-pacing", "sentimental", "emotionally-heavy", "sexual-content"}


def problems(o):
    p = []
    if not isinstance(o.get("include"), bool): p.append("include must be bool")
    if not o.get("include"):
        return p
    for k in ("title", "author"):
        if not isinstance(o.get(k), str) or not o[k].strip(): p.append(f"{k} missing")
    g = o.get("genres")
    if not isinstance(g, list) or not 1 <= len(g) <= 3 or not set(g) <= GENRES: p.append(f"bad genres {g}")
    if o.get("culture") not in CULTURES: p.append(f"bad culture {o.get('culture')}")
    if o.get("format") not in ("fiction", "nonfiction"): p.append(f"bad format {o.get('format')}")
    for k in ("pace", "tone", "challenge"):
        if not isinstance(o.get(k), int) or not 1 <= o[k] <= 5: p.append(f"bad {k} {o.get(k)}")
    if not isinstance(o.get("pages"), int) or not 20 <= o["pages"] <= 3000: p.append(f"bad pages {o.get('pages')}")
    c = o.get("content")
    if not isinstance(c, list) or not set(c) <= CONTENT: p.append(f"bad content {c}")
    return p


def main(chunk, out):
    want = [json.loads(l)["id"] for l in open(chunk) if l.strip()]
    got, errs = {}, []
    for n, line in enumerate(open(out), 1):
        if not line.strip(): continue
        try:
            o = json.loads(line)
        except Exception as e:
            errs.append(f"line {n}: invalid JSON ({e})"); continue
        for p in problems(o): errs.append(f"{o.get('id')}: {p}")
        got[o.get("id")] = o
    missing = [i for i in want if i not in got]
    extra = [i for i in got if i not in set(want)]
    if missing: errs.append(f"missing ids ({len(missing)}): {missing[:20]}")
    if extra: errs.append(f"unexpected ids: {extra[:20]}")
    for e in errs: print(e)
    inc = sum(1 for o in got.values() if o.get("include"))
    print(("FAIL" if errs else "OK"), f"{len(got)}/{len(want)} classified, {inc} included")
    sys.exit(1 if errs else 0)


if __name__ == "__main__":
    main(*sys.argv[1:3])
