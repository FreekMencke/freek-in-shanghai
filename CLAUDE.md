# Freek in Shanghai (static archive)

Eleventy 3 site; README.md has the structure and commands. Runs in WSL with Node 24 from nvm: non-interactive
shells need `source ~/.nvm/nvm.sh` first.

Archives (2026-10-18) in `C:\Users\freek\OneDrive\Development\`: `freekinshanghai-static-2026-10-18.zip` (built
site) and `freekinshanghai-backup-2026-10-18.zip` (the WordPress backup this site was exported from).

## Rules

- One stylesheet (`src/assets/css/site.css`) and one script (`src/assets/js/site.js`). Don't add per-page CSS/JS,
  inline styles in templates, or dependencies for the browser. The only inline scripts are the two in the head of
  `base.njk` that must run before the page shows: the `js` class and the language redirect.
- Global changes go to one place: colours/fonts/sizes → `:root` tokens in `site.css`; menu, links and every piece
  of interface text → `src/_data/site.js` (`text.nl`/`text.en` for templates, as `t`; `ui` for `site.js`); page
  chrome → one partial. Every new piece of interface text needs both languages.
- Write root-relative URLs (`/about/`, `/uploads/...`) in templates and posts. The build turns them into relative
  URLs with `index.html` so the site works from disk; only `404.html` keeps root-relative URLs.
- Post bodies are plain HTML and are never run through a template engine (`htmlTemplateEngine: false`).
- After any change: `npm run build && npm run check`. The check compares posts with `baseline/content.json`; for
  an intended content change, update the baseline or the `EXPECTED` list in `tools/check/check.mjs`. It also fails
  on unused files in `src/uploads/`, so delete photos no page uses, and when an English page's photos, slideshows,
  tags, date or comments differ from its Dutch original.
- `_site/` is build output: never edit it.
- Don't re-run `tools/extract/extract-wp.mjs` or `tools/baseline/capture.mjs` unless asked. The extract rewrites
  `src/posts/*.html`, `src/about.html`, `src/_data/tagList.json` (dropping the English tag names) and
  `src/uploads/`; the capture rewrites
  `baseline/content.json`. Both read the WordPress backup on `http://localhost:8080`, and the extract also queries
  its database container `freekinshanghai-db-1`. That backup isn't running; start it with `docker compose up -d` in
  `C:\Users\freek\Documents\freekinshanghai-clean` (see its README).
- Format code like `.prettierrc.json` (2 spaces, single quotes, 120 columns). Prettier itself isn't installed.

## Content model

- A post is `src/posts/<slug>.html`; the slug is the file name and the URL (`/<slug>/`). Front matter:
  `title`, `date` (UTC), `tags` (tag slugs), `excerpt` (card text), `image` (`card` 520 px and `small` 360 px for
  the cards, `large` 700 px only when the post shows its featured image), and `comments` (`id`, `author`, `date`,
  `html`, nested `replies`). Every post needs `excerpt` and `image.card`/`image.small` with `width` and `height`:
  the cards use them unchecked.
- English: `src/en/posts/<slug>.html` (URL `/en/<slug>/`) has the same file name as the Dutch post, front matter
  `title` and `excerpt` only, and the translated body with the same markup. Date, tags, images and comments come
  from the Dutch post (the `original` and `translation` filters). A change to a post's photos or links goes in both
  files. Comments are not translated.
- Language on arrival: the head of `base.njk` sends visitors to English, or to Dutch when the browser's first
  language is Dutch or its region Belgium (`nl*`, `*-BE`). A language picked with the menu link is stored
  (`localStorage` key `lang`, set in `site.js`) and wins. The 404 page has no redirect.
- Tag names come from `src/_data/tagList.json` (`name` Dutch, `en` English where it differs); a new tag slug needs
  an entry there, or it shows as the slug and gets no tag page. Each tag slug is also an Eleventy collection name,
  so never use `posts`, `postsEn` or a tag in English posts' front matter.

## Gotchas

- Slideshow photos are `<figure class="slide"><a href=original><img src=1024 variant ...></a>`; `site.js` shows
  one at a time and sets `loading="eager"` on the neighbours. Hidden lazy images never load, which is the point.
- Each slideshow photo gets a 160 px WebP thumbnail at build time (the `slide-thumbnails` transform in
  `eleventy.config.js`, into `_site/uploads/` next to the photo) as the smallest candidate in its `srcset`; the photo
  roll in `site.js` takes it from there. Never commit thumbnails to `src/uploads/`.
- The masonry in `site.js` positions cards absolutely to keep DOM order; images need `width`/`height` for it.
- Dates are stored in UTC and shown in UTC, as WordPress did.
