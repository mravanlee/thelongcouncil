#!/usr/bin/env python3
"""
Related Debates — offline precompute job.

Embeds every debate (question + verdict + central tension) with a local
BGE model, scores all-pairs (mean-centered cosine + small structured
re-rank + guardrails), and writes the top related debates into
sessions.related (jsonb: [{slug, title, blurb}]). The live site only
reads that column, so this never touches the Vercel/Supabase serving path.

Run from thelongcouncil/ with the project's venv:
  ~/.cache/tlc-related/venv/bin/python scripts/refresh-related.py            # dry run (prints examples)
  ~/.cache/tlc-related/venv/bin/python scripts/refresh-related.py --write    # write related to DB

Env (from .env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
"""
import os, sys, re, json, math, urllib.request, urllib.parse, urllib.error

MODEL = "BAAI/bge-small-en-v1.5"
TOP_K = 6
# Tunable weights (semantic dominates; structured signals only re-rank).
W_COS, W_TAGS, W_MEMBERS = 0.78, 0.14, 0.08
NEAR_DUP_RAW_COS = 0.93   # exclude reworded twins
MIN_COS = 0.12            # semantic gate: structured boosts can re-rank but never rescue a near-zero-semantic item
FLOOR = float(os.environ.get("RELATED_FLOOR", "0.18"))  # min final score (calibrated below)
WRITE = "--write" in sys.argv

def load_env():
    env = {}
    p = os.path.join(os.path.dirname(__file__), "..", ".env.local")
    for line in open(p):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env

ENV = load_env()
SB = ENV["NEXT_PUBLIC_SUPABASE_URL"]; KEY = ENV["SUPABASE_SERVICE_ROLE_KEY"]
H = {"apikey": KEY, "Authorization": "Bearer " + KEY}

def strip_tier(n):
    return re.sub(r"\s*[—–-]\s*(Practitioner|Framer|Leader|Thinker|Wildcard).*$", "", n or "", flags=re.I).strip()

def verdict_of(c):
    v = (c or {}).get("verdict", "") or ""
    m = re.search(r"##\s*Verdict\s*\n+([\s\S]*?)(?=\n##|$)", v, re.I)
    return (m.group(1) if m else v).strip()

def assembly_field(c, label):
    a = (c or {}).get("assembly", "") or ""
    m = re.search(label + r":\s*([^\n]+)", a, re.I)
    return m.group(1).strip() if m else ""

def tags_of(c):
    raw = assembly_field(c, "TAXONOMY TAGS")
    return set(t.strip().lower() for t in re.split(r"[,/]", raw) if t.strip())

def blurb_of(verdict):
    s = re.split(r"(?<=[.;:])\s", verdict.strip())[0] if verdict else ""
    s = s.strip().rstrip(".;:,")
    if len(s) > 100:
        s = s[:100].rsplit(" ", 1)[0] + "…"
    return s

def fetch_sessions():
    url = f"{SB}/rest/v1/sessions?select=slug,original_issue,sharpened_issue,member_names,cards&limit=2000"
    req = urllib.request.Request(url, headers=H)
    return json.load(urllib.request.urlopen(req, timeout=120))

def main():
    rows = fetch_sessions()
    D = []
    for r in rows:
        c = r.get("cards") or {}
        title = (c.get("question_en") or r.get("sharpened_issue") or r.get("original_issue") or "").strip()
        verdict = verdict_of(c)
        if not title:
            continue
        tension = assembly_field(c, "CENTRAL TENSION")
        doc = "\n".join([title, verdict, tension]).strip()
        D.append(dict(slug=r["slug"], title=title, verdict=verdict, doc=doc,
                      tags=tags_of(c), members=set(strip_tier(m) for m in (r.get("member_names") or [])),
                      blurb=blurb_of(verdict)))
    print(f"[related] {len(D)} debatten geladen, embedden met {MODEL}…", file=sys.stderr)

    from fastembed import TextEmbedding
    model = TextEmbedding(model_name=MODEL)
    embs = list(model.embed([d["doc"] for d in D]))

    import numpy as np
    M = np.array(embs, dtype=np.float32)
    M = M / (np.linalg.norm(M, axis=1, keepdims=True) + 1e-9)          # L2 normalize
    raw = M @ M.T                                                       # raw cosine
    C = M - M.mean(axis=0, keepdims=True)                               # mean-center (de-cone BGE)
    C = C / (np.linalg.norm(C, axis=1, keepdims=True) + 1e-9)
    cos = C @ C.T                                                       # centered cosine

    # member IDF (sharing a rare thinker means more than sharing Thatcher)
    df = {}
    for d in D:
        for m in d["members"]:
            df[m] = df.get(m, 0) + 1
    N = len(D)
    midf = {m: math.log((N + 1) / (c + 1)) + 1 for m, c in df.items()}
    maxmidf = max(midf.values()) if midf else 1

    def jac(a, b):
        return len(a & b) / len(a | b) if (a or b) else 0.0

    def member_score(a, b):
        shared = list(a & b)
        if not shared:
            return 0.0
        s = sum(midf[m] for m in shared[:2]) / (2 * maxmidf)  # capped at 2, idf-weighted
        return min(s, 1.0)

    results = {}
    for i, di in enumerate(D):
        cand = []
        for j, dj in enumerate(D):
            if i == j or raw[i, j] > NEAR_DUP_RAW_COS:
                continue
            cc = float(cos[i, j])
            if cc < MIN_COS:   # semantic gate
                continue
            score = W_COS * cc + W_TAGS * jac(di["tags"], dj["tags"]) + W_MEMBERS * member_score(di["members"], dj["members"])
            cand.append((score, cc, float(raw[i, j]), j))
        cand.sort(reverse=True)
        kept = [c for c in cand if c[0] >= FLOOR][:TOP_K]
        results[di["slug"]] = kept

    seeds = ["eu-reduce-dependency-us-chinese-ai-4594",
             "eu-protect-economy-heavily-subsidized-chinese-aici",
             "een-vergrijzend-land-heeft-migranten-nodig-ph1r",
             "advertising-communication-strategies-designed-effectively-reduce-hwk0"]
    by_slug = {d["slug"]: d for d in D}
    for s in seeds:
        if s not in results:
            continue
        print("\n" + "=" * 70)
        print("SEED:", by_slug[s]["title"][:90])
        for score, cc, rw, j in results[s]:
            print(f"  score {score:.3f} | centered {cc:+.3f} | raw {rw:.2f} | {D[j]['title'][:64]}")
        if not results[s]:
            print("  (niets boven de floor — toont 0)")

    # score-distributie om de floor te kalibreren
    allscores = sorted((c[0] for v in results.values() for c in v), reverse=True)
    counts = [len(v) for v in results.values()]
    print("\n" + "-" * 70)
    print(f"[kalibratie] floor={FLOOR} | debatten met <3 related: {sum(1 for n in counts if n<3)} | "
          f"gem. aantal related: {sum(counts)/len(counts):.1f} | mediaan kept-score: "
          f"{allscores[len(allscores)//2]:.3f}" if allscores else "geen")

    if not WRITE:
        print("\n[dry-run] niets geschreven. Draai met --write om sessions.related te vullen.", file=sys.stderr)
        return

    # write related (denormalized) to DB
    n = 0
    for slug, kept in results.items():
        related = [{"slug": D[j]["slug"], "title": D[j]["title"], "blurb": D[j]["blurb"]} for (_, _, _, j) in kept]
        body = json.dumps({"related": related}).encode()
        url = f"{SB}/rest/v1/sessions?slug=eq.{urllib.parse.quote(slug)}"
        req = urllib.request.Request(url, data=body, method="PATCH",
                                     headers={**H, "Content-Type": "application/json", "Prefer": "return=minimal"})
        try:
            urllib.request.urlopen(req, timeout=30); n += 1
        except urllib.error.HTTPError as e:
            print("PATCH faalde", slug, e.code, e.read().decode()[:200], file=sys.stderr)
    print(f"[related] geschreven naar {n}/{len(results)} sessies.", file=sys.stderr)

if __name__ == "__main__":
    main()
