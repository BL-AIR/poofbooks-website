"""Build assets/data/search.json, the index behind the quick-search box, from the D1 database.

One record per work that has a page on the site (work.slug set):
  t  title, s subtitle, a  credited authors (for display),
  n  every name to match on (credited names, name variants, the writer behind a pen name, other pen names),
  i  every ISBN-13 of the work's editions, y first publication year,
  u  page address, c  cover thumbnail (or null), h shelf.
Needs env CLOUDFLARE_API_TOKEN.
"""
import json, os, urllib.request

ACCOUNT = '15b33c0ca8bf09566f1e120f17aa05aa'
DATABASE = 'e576ce08-4e72-4bbe-bd5f-2259b8476c8e'
OUT = 'assets/data/search.json'


def q(sql):
    req = urllib.request.Request(
        f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/d1/database/{DATABASE}/query',
        data=json.dumps({'sql': sql}).encode(), method='POST',
        headers={'Authorization': 'Bearer ' + os.environ['CLOUDFLARE_API_TOKEN'], 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        res = json.load(r)
    if not res.get('success'):
        raise SystemExit(f'D1 error: {res.get("errors")}')
    return res['result'][0]['results']


covers_base = q("SELECT value FROM app_setting WHERE key='covers_base_url'")[0]['value']
works = q("SELECT work_id, title, subtitle, first_pub_year, slug, shelf FROM work WHERE slug IS NOT NULL ORDER BY sort_title, title")
# Printed books only for now (Blair, 29 Oct 2026): ONIX product forms B* (or not yet known). No eBooks or audiobooks.
isbns = q("SELECT work_id, isbn13 FROM edition WHERE work_id IS NOT NULL AND (product_form IS NULL OR product_form GLOB 'B*') ORDER BY isbn13")
credits = q("""SELECT DISTINCT e.work_id, a.author_id, a.display_name, MIN(ec.sequence) AS seq
               FROM edition_contributor ec JOIN edition e ON e.isbn13 = ec.isbn13 JOIN author a ON a.author_id = ec.author_id
               WHERE ec.role GLOB 'A[0-9][0-9]' OR ec.role IN ('B01','B02')
               GROUP BY e.work_id, a.author_id ORDER BY e.work_id, seq""")
variants = q("SELECT author_id, name_as_seen FROM author_name")
related = q("""SELECT r.author_id AS a, x.display_name AS name FROM author_relation r JOIN author x ON x.author_id = r.related_author_id
               UNION SELECT r.related_author_id, x.display_name FROM author_relation r JOIN author x ON x.author_id = r.author_id""")
covers = q("""SELECT e.work_id, i.image_key FROM edition_image i JOIN edition e ON e.isbn13 = i.isbn13
              WHERE i.kind = 'front' ORDER BY e.work_id, e.product_form = 'BC' DESC, i.isbn13""")

names_for = {}
for v in variants:
    names_for.setdefault(v['author_id'], set()).add(v['name_as_seen'])
for r in related:
    names_for.setdefault(r['a'], set()).add(r['name'])

out = []
for w in works:
    wid = w['work_id']
    cred = [c for c in credits if c['work_id'] == wid]
    names = set()
    for c in cred:
        names.add(c['display_name'])
        names |= names_for.get(c['author_id'], set())
    cov = next((c['image_key'] for c in covers if c['work_id'] == wid), None)
    out.append({
        't': w['title'], 's': w['subtitle'] or None,
        'a': [c['display_name'] for c in cred],
        'n': sorted(names),
        'i': [x['isbn13'] for x in isbns if x['work_id'] == wid],
        'y': w['first_pub_year'],
        'u': f"/books/{w['slug']}/",
        'c': f"{covers_base}/{cov.replace('.webp', '-240.webp')}" if cov else None,
        'h': w['shelf'],
    })

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w') as fh:
    json.dump({'works': out}, fh, ensure_ascii=False, separators=(',', ':'))
    fh.write('\n')
print(f'search.json: {len(out)} works')
