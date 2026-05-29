#!/usr/bin/env python3
"""
Fix em-dash violations in Power Card steps across the golden shelf.
Idempotent: skips files already fixed. Atomic writes via tempfile + os.replace.

Usage (from repo root):
  python scripts/fix-power-card-em-dashes.py
"""
import os
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
STORY_DIR = REPO_ROOT / "story-bank" / "v5-fixed-v2"

FIXES = [
    (
        "bat_lily_bedtime",
        '    - "אני נושם/ת איתה — פנימה, החוצה"',
        '    - "אני נושם/ת איתה, פנימה והחוצה"',
    ),
    (
        "bee_ima_bedtime",
        '    - "אני זוכר/ת: כשמצטרפים — נהיה דבש"',
        '    - "אני זוכר/ת שכשמצטרפים נהיה דבש"',
    ),
    (
        "turtle_beiti_bedtime",
        '    - "אני נושם/ת לאט — לפי הקצב שלי"',
        '    - "אני נושם/ת לאט, לפי הקצב שלי"',
    ),
    (
        "dolphin_shahkan_adventure",
        '    - "אני זוכר/ת: כל השאר לא נעלם — הוא רק נותן רגע"',
        '    - "אני זוכר/ת שכל השאר לא נעלם, רק נותן רגע"',
    ),
    (
        "fawn_tzvi_fantasy",
        '    - "אני נושם/ת לאט — בשבילי"',
        '    - "אני נושם/ת לאט, בשבילי"',
    ),
    (
        "bear_mati_fantasy",
        '    - "אני שומר/ת אותו לידם — לא במקומם"',
        '    - "אני שומר/ת אותו לידם, לא במקומם"',
    ),
]


def apply_fix(file_path: Path, old: str, new: str) -> str:
    content = file_path.read_text(encoding="utf-8")
    if old not in content:
        if new in content:
            return "already fixed"
        raise RuntimeError(f"target line not found: {old!r}")
    if content.count(old) > 1:
        raise RuntimeError(f"target line ambiguous (found {content.count(old)}): {old!r}")
    new_content = content.replace(old, new, 1)
    if old in new_content or new not in new_content:
        raise RuntimeError("replacement verification failed")
    with tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        dir=str(file_path.parent),
        prefix=f".{file_path.name}.",
        suffix=".tmp",
        delete=False,
    ) as tmp:
        tmp.write(new_content)
        tmp.flush()
        os.fsync(tmp.fileno())
        tmp_path = Path(tmp.name)
    os.replace(str(tmp_path), str(file_path))
    return "replaced"


def main() -> int:
    failures = []
    for stem, old, new in FIXES:
        file_path = STORY_DIR / f"{stem}.md"
        if not file_path.exists():
            failures.append(f"{stem}: file not found")
            continue
        try:
            result = apply_fix(file_path, old, new)
            print(f"{stem}: {result}")
        except Exception as e:
            failures.append(f"{stem}: {e}")
    if failures:
        print("\nFAILURES:", file=sys.stderr)
        for f in failures:
            print(f, file=sys.stderr)
        return 1
    print(f"\n{len(FIXES)}/{len(FIXES)} OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
