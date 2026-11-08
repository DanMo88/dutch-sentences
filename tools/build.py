#!/usr/bin/env python3
"""Build data/*.json from content/*.txt.

Content format (one file per level, lessons in order):
  ## <id> | <LEVEL> | <Persian title>
  <Dutch sentence> | <Persian meaning>
  - <simple Persian note>        (1-3 per sentence; Latin words auto-marked)
  >> <Dutch reading line> | <Persian translation>
  !! <optional Persian recap for the end screen>
"""
import json, os, re, sys, unicodedata, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ZW = "\u200c"
LEVEL_FA = {"A1": "مبتدی", "A2": "پایه", "B1": "متوسط", "B2": "متوسط رو به بالا"}


def slug(text):
    t = unicodedata.normalize("NFD", str(text).strip())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn").lower()
    t = re.sub(r"[^a-z0-9]+", "-", t).strip("-")
    return t[:100].strip("-")


def word_core(tok):
    return re.sub(r"^[^\w]+|[^\w]+$", "", tok, flags=re.UNICODE)


LATIN = r"[A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F0-9'’\-]*"
RUN = re.compile(r"(?<![{\w])(" + LATIN + r"(?:[ ](?:" + LATIN + r"|[?!.,](?=\s|$)))*[?!]?)")


def mark(text):
    if "{" in text:
        return text
    return RUN.sub(lambda m: "{" + m.group(1) + "}", text)


def fa_fix(text):
    t = text.replace("~", ZW)
    t = re.sub(r"(^|[\s«(])(ن?می) (?=[\u0600-\u06FF])", lambda m: m.group(1) + m.group(2) + ZW, t)
    t = re.sub(r"(?<=[\u0600-\u06FF]) (ها|های|هایی|تر|ترین|ام|اید|ایم)(?=[\s.،؛:!؟»)]|$)", ZW + r"\1", t)
    t = t.replace("?", "؟") if not re.search(r"[A-Za-z]", t) else t
    return re.sub(r"[ \t]+", " ", t).strip()


def parse(path, errors):
    lessons = []
    cur = None
    for n, raw in enumerate(open(path, encoding="utf-8"), 1):
        line = raw.rstrip("\n").strip()
        if not line or line.startswith("#!"):
            continue
        where = f"{os.path.basename(path)}:{n}"
        if line.startswith("## "):
            parts = [p.strip() for p in line[3:].split("|")]
            cur = {"id": int(parts[0]), "level": parts[1], "titleFa": fa_fix(parts[2]),
                   "sentences": [], "reading": [], "recap": ""}
            lessons.append(cur)
        elif cur is None:
            errors.append(f"{where}: text before lesson header")
        elif line.startswith(">>"):
            nl, _, fa = line[2:].partition("|")
            if not fa.strip():
                errors.append(f"{where}: reading line without translation")
            cur["reading"].append({"nl": nl.strip(), "fa": fa_fix(fa)})
        elif line.startswith("!!"):
            cur["recap"] = mark(fa_fix(line[2:]))
        elif line.startswith("- "):
            if not cur["sentences"]:
                errors.append(f"{where}: note before sentence")
                continue
            cur["sentences"][-1]["notes"].append(mark(fa_fix(line[2:])))
        else:
            nl, _, fa = line.partition("|")
            nl = re.sub(r"\s+", " ", nl.strip())
            if not fa.strip():
                errors.append(f"{where}: sentence without meaning: {line}")
            if not re.search(r"[.?!]$", nl):
                errors.append(f"{where}: sentence must end with . ? or !: {nl}")
            cur["sentences"].append({"nl": nl, "fa": fa_fix(fa), "notes": []})
    return lessons


def main():
    errors, warns = [], []
    files = sorted(glob.glob(os.path.join(ROOT, "content", "*.txt")))
    lessons = []
    for f in files:
        lessons += parse(f, errors)
    lessons.sort(key=lambda l: l["id"])
    ids = [l["id"] for l in lessons]
    if ids != list(range(1, len(ids) + 1)):
        errors.append(f"lesson ids not sequential: {ids[:5]}...")
    jobs = {}
    seen_sent = {}
    def job(fname, text):
        if fname in jobs and jobs[fname] != text and fname.startswith("audio/s-"):
            errors.append(f"audio slug collision {fname}: {jobs[fname]!r} vs {text!r}")
        jobs.setdefault(fname, text)
    for l in lessons:
        where = f"lesson {l['id']}"
        if len(l["sentences"]) < 6:
            warns.append(f"{where}: only {len(l['sentences'])} sentences")
        if len(l["reading"]) < 3:
            errors.append(f"{where}: reading has {len(l['reading'])} lines")
        for s in l["sentences"]:
            if not s["notes"]:
                errors.append(f"{where}: no note for {s['nl']}")
            key = s["nl"].lower()
            if key in seen_sent:
                warns.append(f"{where}: repeats sentence from lesson {seen_sent[key]}: {s['nl']}")
            seen_sent.setdefault(key, l["id"])
            job("audio/s-" + slug(s["nl"]) + ".mp3", s["nl"])
            for tok in s["nl"].rstrip(".?!").split(" "):
                core = word_core(tok)
                if core:
                    job("audio/w-" + slug(core) + ".mp3", core)
        l["readingAudio"] = f"audio/r-{l['id']:03d}.mp3"
        job(l["readingAudio"], " ".join(r["nl"] for r in l["reading"]))
    if errors:
        print("\n".join("ERROR " + e for e in errors))
        sys.exit(1)
    for w in warns:
        print("WARN", w)
    if "--dry" in sys.argv:
        print(f"ok (dry): {len(lessons)} lessons")
        return
    os.makedirs(os.path.join(ROOT, "data", "lessons"), exist_ok=True)
    course = {"levels": []}
    for l in lessons:
        out = {k: l[k] for k in ("id", "level", "titleFa", "sentences", "reading", "readingAudio", "recap")}
        with open(os.path.join(ROOT, "data", "lessons", f"{l['id']:03d}.json"), "w", encoding="utf-8") as fh:
            json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
        if not course["levels"] or course["levels"][-1]["id"] != l["level"]:
            course["levels"].append({"id": l["level"], "titleFa": LEVEL_FA.get(l["level"], ""), "lessons": []})
        course["levels"][-1]["lessons"].append({"id": l["id"], "titleFa": l["titleFa"], "count": len(l["sentences"])})
    with open(os.path.join(ROOT, "data", "course.json"), "w", encoding="utf-8") as fh:
        json.dump(course, fh, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(ROOT, "tools", "tts_jobs.json"), "w", encoding="utf-8") as fh:
        json.dump(jobs, fh, ensure_ascii=False, indent=0, sort_keys=True)
    total = sum(len(l["sentences"]) for l in lessons)
    per = {}
    for l in lessons:
        per.setdefault(l["level"], [0, 0]); per[l["level"]][0] += 1; per[l["level"]][1] += len(l["sentences"])
    print(f"built {len(lessons)} lessons, {total} sentences, {len(jobs)} audio jobs; per level {per}")


if __name__ == "__main__":
    main()
