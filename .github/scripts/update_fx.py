"""Daily exchange rates for Poof Books.

Fetches European Central Bank rates (via frankfurter.dev, AUD base), stores them in the D1 database's
fx_rate history, and rewrites assets/data/fx.json for the site's currency switcher.
Does nothing if the rates file already has the latest ECB date (weekends, holidays).
Needs env CLOUDFLARE_API_TOKEN (repository secret). Account and database ids are not secret.
"""
import datetime, json, os, sys, urllib.request

ACCOUNT = '15b33c0ca8bf09566f1e120f17aa05aa'
DATABASE = 'e576ce08-4e72-4bbe-bd5f-2259b8476c8e'
FX_FILE = 'assets/data/fx.json'
ORDER = [('AUD', 'A$', 'au'), ('NZD', 'NZ$', 'nz'), ('USD', 'US$', 'us'),
         ('GBP', '£', 'gb'), ('EUR', '€', 'eu'), ('CAD', 'C$', 'ca')]


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'poofbooks-fx/1.0'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def d1(sql, params=None):
    body = {'sql': sql}
    if params is not None:
        body['params'] = params
    req = urllib.request.Request(
        f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/d1/database/{DATABASE}/query',
        data=json.dumps(body).encode(), method='POST',
        headers={'Authorization': 'Bearer ' + os.environ['CLOUDFLARE_API_TOKEN'], 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as r:
        res = json.load(r)
    if not res.get('success'):
        raise SystemExit(f'D1 error: {res.get("errors")}')
    return res


quotes = ','.join(c for c, _, _ in ORDER if c != 'AUD')
data = get(f'https://api.frankfurter.dev/v1/latest?base=AUD&symbols={quotes}')
date, rates = data['date'], data['rates']
missing = [c for c, _, _ in ORDER if c != 'AUD' and c not in rates]
if missing:
    raise SystemExit(f'Rates missing for {missing}')

try:
    old = json.load(open(FX_FILE))
except (OSError, ValueError):
    old = {}
if old.get('date') == date:
    print(f'Rates already current ({date}); nothing to do.')
    sys.exit(0)

now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
for c, _, _ in ORDER:
    if c == 'AUD':
        continue
    d1("INSERT OR REPLACE INTO fx_rate (rate_date, base, quote, rate, source, fetched_at) "
       "VALUES (?1, 'AUD', ?2, ?3, 'ECB via frankfurter.dev', ?4)", [date, c, rates[c], now])

out = {'base': 'AUD', 'charge': 'AUD', 'date': date, 'source': 'European Central Bank',
       'currencies': [{'code': c, 'symbol': s, 'flag': f, 'rate': 1 if c == 'AUD' else rates[c]} for c, s, f in ORDER]}
with open(FX_FILE, 'w') as fh:
    json.dump(out, fh, ensure_ascii=False, indent=1)
    fh.write('\n')
print(f'Updated to ECB rates of {date}: ' + ', '.join(f'{c} {rates[c]}' for c in rates))
