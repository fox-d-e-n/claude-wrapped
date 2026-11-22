"""Open a rendered page in Chromium, Firefox and WebKit at phone size: slides render, a tap starts the
soundtrack pill, no page errors. Usage: python tests/browser_check.py page.html [page2.html ...]"""
import pathlib
import sys

from playwright.sync_api import sync_playwright

failed = 0
with sync_playwright() as p:
    for engine in ("chromium", "firefox", "webkit"):
        browser = getattr(p, engine).launch()
        for page_path in sys.argv[1:]:
            page = browser.new_page(viewport={"width": 390, "height": 844})
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)[:200]))
            page.goto(pathlib.Path(page_path).resolve().as_uri())
            page.wait_for_timeout(500)
            slides = page.eval_on_selector_all(".slide", "els => els.length")
            page.mouse.click(300, 400)
            page.wait_for_timeout(800)
            pill = page.inner_text("#sound-label")
            ok = slides >= 2 and not errors and pill.upper() != "TAP FOR SOUND"
            failed += not ok
            print(f"{'ok  ' if ok else 'FAIL'} {engine:8s} {pathlib.Path(page_path).name}: {slides} slides, pill {pill!r}, errors {errors}")
            page.close()
        browser.close()
sys.exit(1 if failed else 0)
