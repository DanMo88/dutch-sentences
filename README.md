# Dutch Sentences

A phone-first sample of a Dutch sentence builder for Persian-speaking beginners. This repository is **Lesson 1 only** (absolute A1): eight short sentences for introducing yourself. It is not a full course.

The name in the interface is **Dutch Sentences**. The rest of the interface is Persian (Farsi), right to left. Dutch words and sentences stay left to right.

## What you do

1. Open the lesson.
2. Read the Persian meaning.
3. Tap Dutch tiles to build the sentence. Tap a tile already in the sentence to take it back.
4. Every tap speaks that one word slowly in Dutch (`nl-NL`, rate 0.7).
5. When the order is right, the whole sentence is spoken slowly and a short Persian grammar note opens at the bottom.
6. A wrong order gets a gentle hint. It does not play the full sentence and it does not open the note.

## Run it locally

From this folder:

```bash
python3 -m http.server 8741
```

Then open [http://127.0.0.1:8741](http://127.0.0.1:8741).

Any static file server works. For GitHub Pages, publish the repository root. There is no build step, no server, and no account.

## Speech

Audio uses the browser Web Speech API (`speechSynthesis`) with `lang="nl-NL"`. The page prefers a Dutch voice whose name contains Nederlands, Netherlands, Dutch, or Fenna, then any `nl` voice, then the browser default. Speech starts from a tap, so mobile browsers allow it.

On a phone, turn on a Dutch (Nederlands) voice in the system settings if the pronunciation falls back to another language. Nothing is recorded. There is no microphone.

## Fonts

Vazirmatn, Outfit, and Fraunces are included under the SIL Open Font License 1.1. See `fonts/NOTICE.md`.
