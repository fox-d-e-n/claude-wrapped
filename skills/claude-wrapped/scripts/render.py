"""Fill assets/template.html with stats JSON (wrapped_stats.py) + story JSON (written by Claude) -> one HTML page.

python -I render.py stats.json [story.json] -o wrapped.html
python -I render.py --selftest
"""
import argparse
import json
import pathlib
import re
import sys

ASSETS = pathlib.Path(__file__).resolve().parent.parent / "assets"
TEMPLATE = ASSETS / "template.html"
SLOT = "/*WRAPPED_DATA*/null"
SCRIPT = re.compile(r'<script src="([\w.-]+\.js)"></script>')


def render(stats: dict, story: dict | None = None) -> str:
    # slides.js / music.js / story.js are inlined so the page stays one self-contained file
    html = SCRIPT.sub(lambda m: "<script>\n" + (ASSETS / m.group(1)).read_text(encoding="utf-8") + "</script>",
                      TEMPLATE.read_text(encoding="utf-8"))
    if SLOT not in html:
        raise SystemExit(f"{TEMPLATE} has no {SLOT} slot")
    # < keeps a "</script>" inside a session title from closing the script tag
    data = json.dumps({**stats, "story": story or {}}, ensure_ascii=False).replace("<", "\\u003c")
    return html.replace(SLOT, data, 1)


def selftest() -> None:
    page = render({"range": {"start": "2026-01-02", "end": "2026-03-04"}, "prompts": 3,
                   "biggest_session": {"tokens": 9, "title": "</script><b>x"}}, {"name": "Test"})
    assert SLOT not in page and '"name": "Test"' in page
    assert "<script src=" not in page and "wrappedMusic" in page, "scripts not inlined"
    assert "</script><b>" not in page, "title broke out of the script tag"
    print("render selftest PASS")


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("stats", nargs="?")
    ap.add_argument("story", nargs="?")
    ap.add_argument("-o", "--out", default="wrapped.html")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args(argv)
    if a.selftest:
        selftest()
        return 0
    if not a.stats:
        ap.error("stats.json is required")
    stats = json.loads(pathlib.Path(a.stats).read_text(encoding="utf-8"))
    story = json.loads(pathlib.Path(a.story).read_text(encoding="utf-8")) if a.story else {}
    pathlib.Path(a.out).write_text(render(stats, story), encoding="utf-8")
    print(f"wrote {a.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
