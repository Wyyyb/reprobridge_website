#!/usr/bin/env python3
"""Assemble index.html from src/head.html, src/partials/NN-<id>.html (in filename order) and src/tail.html.

CSS and JS tags are generated: assets/css/base.css then assets/css/<id>.css for every partial that has one;
assets/js/data.js, charts.js, site.js, then assets/js/<id>.js for every partial that has one. Each URL gets a
content hash (?v=...) so GitHub Pages caches never serve stale assets.

Usage:
  python3 build.py                      # writes index.html
  python3 build.py --only hero,results  # preview with nav + selected partials + footer
  python3 build.py --out .preview-x.html  # alternate output (gitignored .preview-*.html)
"""
import argparse
import hashlib
import os
import re
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ap = argparse.ArgumentParser()
ap.add_argument('--out', default='index.html')
ap.add_argument('--only', default='', help='comma-separated partial ids to include (nav and footer are always kept)')
args = ap.parse_args()

partials = sorted((ROOT / 'src/partials').glob('*.html'))
if not partials:
    sys.exit('no partials in src/partials')
ids = []
for p in partials:
    m = re.fullmatch(r'(\d\d)-([a-z0-9-]+)\.html', p.name)
    if not m:
        sys.exit(f'bad partial name {p.name} (expected NN-id.html)')
    ids.append(m.group(2))
if len(set(ids)) != len(ids):
    sys.exit('duplicate partial ids')
keep = None
if args.only:
    keep = set(x.strip() for x in args.only.split(',') if x.strip()) | {'nav', 'footer'}
    missing = keep - set(ids)
    if missing:
        sys.exit(f'unknown partial ids: {sorted(missing)}')


def ver(rel):
    return hashlib.sha1((ROOT / rel).read_bytes()).hexdigest()[:10]


used = [(i, p) for i, p in zip(ids, partials) if keep is None or i in keep]
css = ['assets/css/base.css'] + [f'assets/css/{i}.css' for i, _ in used if (ROOT / f'assets/css/{i}.css').exists()]
js = ['assets/js/data.js', 'assets/js/charts.js', 'assets/js/site.js'] + \
     [f'assets/js/{i}.js' for i, _ in used if (ROOT / f'assets/js/{i}.js').exists()]
for rel in css + js:
    if not (ROOT / rel).exists():
        sys.exit(f'missing asset {rel}')
css_tags = '\n'.join(f'<link rel="stylesheet" href="{rel}?v={ver(rel)}">' for rel in css)
js_tags = '\n'.join(f'<script src="{rel}?v={ver(rel)}"></script>' for rel in js)

head = (ROOT / 'src/head.html').read_text(encoding='utf-8')
tail = (ROOT / 'src/tail.html').read_text(encoding='utf-8')
if '<!--CSS-->' not in head or '<!--JS-->' not in tail:
    sys.exit('src/head.html needs <!--CSS--> and src/tail.html needs <!--JS-->')
body = '\n'.join(f'<!-- ===== {p.name} ===== -->\n' + p.read_text(encoding='utf-8').strip() + '\n' for _, p in used)
html = head.replace('<!--CSS-->', css_tags) + '\n' + body + tail.replace('<!--JS-->', js_tags)

out = ROOT / args.out
fd, tmp = tempfile.mkstemp(dir=str(ROOT), prefix='.build-', suffix='.tmp')
with os.fdopen(fd, 'w', encoding='utf-8') as f:
    f.write(html)
os.chmod(tmp, 0o644)
os.replace(tmp, out)
print(f'wrote {out.name}: {len(used)} partials, {len(css)} css, {len(js)} js, {len(html):,} bytes')
