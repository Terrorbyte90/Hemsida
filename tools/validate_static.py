"""Small, dependency-free quality gate for the static portfolio."""
from pathlib import Path
from html.parser import HTMLParser
import re
import sys

ROOT = Path(__file__).resolve().parents[1]

class PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.ids = set()
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids.add(attrs["id"])
        if tag == "a" and attrs.get("href"):
            self.links.append(attrs["href"])

errors = []
html_files = sorted(ROOT.rglob("*.html"))
for page in html_files:
    parser = PageParser()
    parser.feed(page.read_text(encoding="utf-8"))
    for href in parser.links:
        if href.startswith(("http://", "https://", "mailto:", "tel:", "#")):
            continue
        target, _, fragment = href.partition("#")
        path = (page.parent / target).resolve()
        if not path.is_relative_to(ROOT.resolve()) or not path.exists():
            errors.append(f"{page.relative_to(ROOT)} -> {href} (saknas)")
        elif fragment and path.suffix == ".html":
            target_parser = PageParser()
            target_parser.feed(path.read_text(encoding="utf-8"))
            if fragment not in target_parser.ids:
                errors.append(f"{page.relative_to(ROOT)} -> {href} (ankare saknas)")

for css in ROOT.rglob("*.css"):
    if "url(" in css.read_text(encoding="utf-8"):
        pass

print(f"Kontrollerade {len(html_files)} HTML-sidor och interna länkar.")
if errors:
    print("\n".join(errors), file=sys.stderr)
    sys.exit(1)
print("Statisk länk- och HTML-kontroll: OK")
