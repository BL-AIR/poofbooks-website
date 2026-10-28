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
- **Published in the last** (every shelf): presets 2 years · 5 years · 20 years · Any time, plus the year slider (`data-range="published"`), from `data-date`.
- `data-during="1952|1958"`: **Set during** (fiction shelves except Supernova Adventures): the years the story is set, first|last (BC as negative, e.g. `-480|-430`). Era buttons appear for eras some book on the shelf falls in: Ancient world · Before 1800 · 1800s · 1900–1945 · Post-war (1945–69) · Stonewall to AIDS (1969–81) · The AIDS years (1981–96) · 1997 to now. The slider gives each era equal space. Markup: a fieldset with legend "Set during", an empty `<div class="presets">`, and a `<div class="range" data-range="during">` holding inputs `dfrom` and `dto` (copy it from Luminous Literature). The era list in `shelf.js` must match the database's `era` table.
- `data-eras="Far future|Near future"`: **Set during** on Supernova Adventures only, as chips: `<div class="chips" data-chips="eras" data-fixed="Far future|Near future|Present|Past">`. Its **Set in** box gets `data-fixed="Earth|Solar System|Galaxy|Universe|Multiverse"`, and its cards use those values in `data-places`.
- `data-kinds="Memoir|History"`: **Kind of book** on No Nonsense Non-Fiction: `<div class="chips" data-chips="kinds" data-order="Memoir|Biography|History|Essays|Politics &amp; law|Health &amp; wellbeing|Arts &amp; culture|Guides">`. Non-fiction keeps Subject matter and has no Set in or Set during.
- A chips box can carry `data-fixed` (always shown in that order, even at 0) or `data-order` (only the values on the shelf, in that order). A book value with no chip never hides the book.
- `data-formats="Hardback|Paperback|eBook"`: **Format**
- `data-pronouns="He"`: **Author's pronouns** (He, She, They, Mixed, Not stated, always shown in that order). For a collaboration, list each author's pronouns, e.g. `He|She`: if they differ the book counts as **Mixed** only; if they match (`He|He`) it counts as that one. Leave blank for **Not stated**. Take pronouns from the author's own published bio; corrections come in to BigDaddy@poofbooks.com via the ⓘ note.
