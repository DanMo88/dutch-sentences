#!/usr/bin/env python3
"""Generate missing MP3s from tools/tts_jobs.json with edge-tts (nl-NL-FennaNeural, -15%, same as 90 Dagen).
Usage: python3 tools/tts.py [--prefix audio/r-] [--workers 8]
Re-generates a file when its text changed (tools/tts_manifest.json)."""
import asyncio, json, os, sys
import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOICE, RATE = "nl-NL-FennaNeural", "-15%"


async def one(sem, fname, text, manifest, stats):
    path = os.path.join(ROOT, fname)
    async with sem:
        for attempt in range(5):
            try:
                tmp = path + ".part"
                await edge_tts.Communicate(text, VOICE, rate=RATE).save(tmp)
                if os.path.getsize(tmp) < 1000:
                    raise RuntimeError("tiny file")
                os.replace(tmp, path)
                manifest[fname] = text
                stats["ok"] += 1
                return
            except Exception as e:
                await asyncio.sleep(2 + attempt * 3)
        stats["fail"].append(fname)


async def main():
    args = sys.argv[1:]
    prefix = args[args.index("--prefix") + 1] if "--prefix" in args else ""
    workers = int(args[args.index("--workers") + 1]) if "--workers" in args else 8
    jobs = json.load(open(os.path.join(ROOT, "tools", "tts_jobs.json"), encoding="utf-8"))
    mpath = os.path.join(ROOT, "tools", "tts_manifest.json")
    manifest = json.load(open(mpath, encoding="utf-8")) if os.path.exists(mpath) else {}
    todo = []
    for fname, text in jobs.items():
        if not fname.startswith(prefix):
            continue
        path = os.path.join(ROOT, fname)
        if os.path.exists(path) and manifest.get(fname, text) == text:
            manifest.setdefault(fname, text)
            continue
        todo.append((fname, text))
    print(f"{len(todo)} to generate", flush=True)
    stats = {"ok": 0, "fail": []}
    sem = asyncio.Semaphore(workers)
    tasks = [one(sem, f, t, manifest, stats) for f, t in todo]
    for i in range(0, len(tasks), 200):
        await asyncio.gather(*tasks[i:i + 200])
        json.dump(manifest, open(mpath, "w", encoding="utf-8"), ensure_ascii=False, indent=0, sort_keys=True)
        print(f"progress {min(i + 200, len(tasks))}/{len(tasks)} ok={stats['ok']} fail={len(stats['fail'])}", flush=True)
    json.dump(manifest, open(mpath, "w", encoding="utf-8"), ensure_ascii=False, indent=0, sort_keys=True)
    if stats["fail"]:
        print("FAILED:", *stats["fail"], sep="\n")
        sys.exit(1)


asyncio.run(main())
