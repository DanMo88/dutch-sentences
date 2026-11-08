#!/usr/bin/env python3
"""Insert a note after a sentence line: addnote.py FILE 'Sentence.' 'note' ..."""
import sys
f, pairs = sys.argv[1], sys.argv[2:]
lines = open(f, encoding="utf-8").read().split("\n")
for i in range(0, len(pairs), 2):
    sent, note = pairs[i], pairs[i + 1]
    idx = [n for n, l in enumerate(lines) if l.startswith(sent + " |")]
    assert idx, sent
    lines.insert(idx[0] + 1, "- " + note)
open(f, "w", encoding="utf-8").write("\n".join(lines))
