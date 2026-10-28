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
- `data-words="101441"`: **Reading time** (every shelf, second after Published): an "up to" slider in hours (`<div class="range" data-range="reading">` with input `hours`) and presets `<button data-hours="2|4|8|0">` (0 = Any length; copy from Luminous Literature). Hours use the reader's pace from the settings gear (Slow 200 / Average 240 / Fast 300 words a minute, in `view-settings.js` as `window.PoofPace`). On a book page, put `data-words` on the Reading time cell and the text follows the pace. Address bar: `?time=4`.
- **Sort**: the default (first, `selected`) is the curator's picks first, e.g. `<option value="pick" selected>Larry's picks first</option>`, then Newest, Oldest, Title, Author, Price. Picks first, then newest within each group. The address bar records the sort only when it isn't the default.
- **Published in the last** (every shelf): presets 2 years · 5 years · 20 years · Any time, plus the year slider (`data-range="published"`), from `data-date`.
- `data-during="1952|1958"`: **Set during** (fiction shelves except Supernova Adventures): the years the story is set, first|last (BC as negative, e.g. `-480|-430`). Era buttons appear for eras some book on the shelf falls in: Ancient world · Before 1800 · 1800s · 1900–1945 · Post-war (1945–69) · Stonewall to AIDS (1969–81) · The AIDS years (1981–96) · 1997 to now. The slider gives each era equal space. Markup: a fieldset with legend "Set during", an empty `<div class="presets">`, and a `<div class="range" data-range="during">` holding inputs `dfrom` and `dto` (copy it from Luminous Literature). The era list in `shelf.js` must match the database's `era` table.
- `data-eras="Far future|Near future"`: **Set during** on Supernova Adventures only, as chips: `<div class="chips" data-chips="eras" data-fixed="Far future|Near future|Present|Past">`. Its **Set in** box gets `data-fixed="Earth|Solar System|Galaxy|Universe|Multiverse"`, and its cards use those values in `data-places`.
- `data-kinds="Memoir|History"`: **Kind of book** on No Nonsense Non-Fiction: `<div class="chips" data-chips="kinds" data-order="Memoir|Biography|History|Essays|Politics &amp; law|Health &amp; wellbeing|Arts &amp; culture|Guides">`. Non-fiction keeps Subject matter and has no Set in or Set during.
- A chips box can carry `data-fixed` (always shown in that order, even at 0) or `data-order` (only the values on the shelf, in that order). A book value with no chip never hides the book.
- `data-formats="Hardback|Paperback|eBook"`: **Format**
- `data-pronouns="He"`: **Author's pronouns** (He, She, They, Mixed, Not stated, always shown in that order). For a collaboration, list each author's pronouns, e.g. `He|She`: if they differ the book counts as **Mixed** only; if they match (`He|He`) it counts as that one. Leave blank for **Not stated**. Take pronouns from the author's own published bio; corrections come in to BigDaddy@poofbooks.com via the ⓘ note.

## Checkout (draft)

`checkout/index.html` with `assets/css/checkout.css` and `assets/js/checkout.js`. Looked after by Lil Otter (staff, not a curator, not in the section menu) in the Mailroom (`assets/rooms/mailroom.webp`, `assets/curators/cutouts/LilOtter.webp`, greeting `assets/audio/lil-otter-checkout.mp3`).

- Square's Web Payments SDK draws the card fields (sandbox IDs in `checkout.js`; never an access token). The card box is kept under 480px wide so Square stacks the card number above expiry/CVV/postcode. Never build our own card fields.
- Lil Otter's lines live in `OTTER` in `checkout.js` (normal spelling; the voice adds the lisp; only exception "Yeth, both!"), with plain versions in `PLAIN` for Curators off. A line with `audio` gets the play button.
- Stock wording is general only (`STOCK`): never quantities.
- Preview moments: `?demo=cart`, `?demo=backorder`, `?demo=confirmed`, `?demo=problem`. The lilac test band comes off at go-live.
