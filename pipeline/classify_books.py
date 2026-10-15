"""Step 2: AI-classify every candidate that isn't in data/classifications.jsonl yet.

Incremental: only new/unclassified books are sent, results are appended, so re-running is cheap.
Needs an Anthropic API key in the environment (https://console.anthropic.com):

    export ANTHROPIC_API_KEY=...        # never commit this
    python3 pipeline/classify_books.py  # then: python3 pipeline/build_books.py

Rules for every field live in pipeline/CLASSIFY.md (the same rubric the first run used).
"""
import json, os, pathlib, sys, time, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
from check_chunk import problems  # noqa: E402

MODEL = os.environ.get("RT_MODEL", "claude-sonnet-4-5")
BATCH = 40
OUT = ROOT / "data" / "classifications.jsonl"


def call(prompt):
    body = json.dumps({"model": MODEL, "max_tokens": 16000,
                       "messages": [{"role": "user", "content": prompt}]}).encode()
    req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=body, headers={
        "x-api-key": os.environ["ANTHROPIC_API_KEY"], "anthropic-version": "2023-06-01",
        "content-type": "application/json"})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                return json.load(r)["content"][0]["text"]
        except Exception as e:
            print("  retry", attempt + 1, e); time.sleep(10 * (attempt + 1))
    raise RuntimeError("API failed repeatedly")


def main():
    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("Set ANTHROPIC_API_KEY first (see the top of this file).")
    rubric = (ROOT / "pipeline" / "CLASSIFY.md").read_text()
    done = {json.loads(l)["id"] for l in OUT.open() if l.strip()} if OUT.exists() else set()
    todo = [json.loads(l) for l in (ROOT / "data" / "candidates.jsonl").open() if l.strip()]
    todo = [c for c in todo if c["id"] not in done]
    print(f"{len(todo)} books to classify with {MODEL}")
    for i in range(0, len(todo), BATCH):
        batch = [{k: c[k] for k in ("id", "title", "author", "year", "pages")} | {"subjects": c["subjects"][:8]}
                 for c in todo[i:i + BATCH]]
        prompt = (rubric + "\n\n## Books to classify\n" + "\n".join(json.dumps(b, ensure_ascii=False) for b in batch)
                  + "\n\nReply with ONLY the JSONL output, one line per book, nothing else.")
        good = 0
        with OUT.open("a") as f:
            for line in call(prompt).splitlines():
                try:
                    o = json.loads(line)
                except ValueError:
                    continue
                if o.get("id") in {b["id"] for b in batch} and not problems(o):
                    f.write(json.dumps(o, ensure_ascii=False) + "\n"); good += 1
        print(f"  batch {i // BATCH + 1}: {good}/{len(batch)} valid (invalid ones retry on the next run)")


if __name__ == "__main__":
    main()
