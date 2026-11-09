# Zinsmaken

A phone-first Dutch sentence builder for Persian speakers, from absolute zero (A1) to B2. The name in the interface is **Zinsmaken** (Dutch for making sentences); the rest of the interface is Persian (RTL), Dutch stays LTR.

## How a lesson works

1. Read the Persian meaning and tap the Dutch tiles in the right order. Every tap plays that word slowly.
2. When the order is right the whole sentence plays and a short, simple Persian note opens at the bottom.
3. After the last sentence, a short Dutch reading text (with full Persian translation) uses the words of the lesson. Tap it to hear it slowly.

Progress is stored only in the browser (`localStorage`). No accounts, no analytics.

## Content

Lessons are written in `content/*.txt` (simple text format, described at the top of `tools/build.py`) and built into `data/course.json` and `data/lessons/NNN.json`:

```bash
python3 tools/build.py        # validate + build JSON + tools/tts_jobs.json
python3 tools/tts.py          # generate missing MP3s (edge-tts, nl-NL-FennaNeural, rate -15%)
```

Audio files: `audio/w-<slug>.mp3` (words, deduplicated), `audio/s-<slug>.mp3` (sentences), `audio/r-NNN.mp3` (reading text of lesson NNN). The browser `speechSynthesis` is only a fallback when an MP3 is missing.

## Run locally

```bash
python3 -m http.server 8741
```

## Fonts

Vazirmatn under the SIL Open Font License 1.1. See `fonts/NOTICE.md`.
