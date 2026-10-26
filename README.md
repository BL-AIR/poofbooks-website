# poofbooks-website

The website for **Poof Books**, an online bookshop of M2M books for gay men: https://poofbooks.com

Currently a single static coming-soon page. No build step: the files are served exactly as they are.

## Files

- `index.html`: the coming-soon page
- `assets/logo.svg`: the primary logo (for dark backgrounds)
- `assets/og-image.png`: the preview image shown when the link is shared
- `favicon.ico`, `assets/favicon-32.png`, `apple-touch-icon.png`: browser and home-screen icons
- `privacy/index.html`: privacy statement and cookie table
- `assets/js/consent.js`, `assets/css/consent.css`: cookie banner (shared with the other sites)
- `sitemap.xml`, `robots.txt`: for search engines. Add each new page to the sitemap.
- `CNAME`: tells GitHub Pages to serve the site on poofbooks.com (poofbooks.com.au forwards here; email stays on poofbooks.com.au)

Master logo files live in the `Logos` folder alongside this repo.

## Shelf grids (sort and filter)

`assets/js/shelf.js` filters the book cards in "On the shelf" using their `data-*` settings. Chips are built from what is on the shelf, so a filter with no data simply hides itself. Every chip starts **ticked** (the whole shelf shows) and the reader unticks what he does not want; each group has an All/None switch, and the address bar records what is unticked (e.g. `?not-pr=She,Mixed`). A book stays on show while any of its values is still ticked.

- `data-places="Morocco|Germany"`: the **Set in** filter (fiction shelves)
- `data-subjects="History|Memoir"`: the **Subject matter** filter. Pansy's No-Nonsense Non-Fiction shelf uses this *instead of* Set in: give its form `<fieldset class="f-group"><legend>Subject matter</legend><div class="chips" data-chips="subjects"></div></fieldset>` and leave out the Set in fieldset.
- `data-formats="Hardback|Paperback|eBook"`: **Format**
- `data-pronouns="He"`: **Author's pronouns** (He, She, They, Mixed, Not stated, always shown in that order). For a collaboration, list each author's pronouns, e.g. `He|She`: if they differ the book counts as **Mixed** only; if they match (`He|He`) it counts as that one. Leave blank for **Not stated**. Take pronouns from the author's own published bio; corrections come in to BigDaddy@poofbooks.com via the ⓘ note.
