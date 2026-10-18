# Freek in Shanghai (static archive)

Eleventy 3 site; README.md has the structure and commands. Runs in WSL with Node 24 from nvm: non-interactive
shells need `source ~/.nvm/nvm.sh` first.

Archives (2026-10-18) in `C:\Users\freek\OneDrive\Development\`: `freekinshanghai-static-2026-10-18.zip` (built
site) and `freekinshanghai-backup-2026-10-18.zip` (the WordPress backup this site was exported from).

## Rules

- One stylesheet (`src/assets/css/site.css`) and one script (`src/assets/js/site.js`). Don't add per-page CSS/JS,
  inline styles in templates, or dependencies for the browser.
- Global changes go to one place: colours/fonts/sizes → `:root` tokens in `site.css`; menu, links and every piece
  of interface text → `src/_data/site.js` (`text` for templates, `ui` for `site.js`); page chrome → one partial.
- Write root-relative URLs (`/about/`, `/uploads/...`) in templates and posts. The build turns them into relative
  URLs with `index.html` so the site works from disk; only `404.html` keeps root-relative URLs.
- Post bodies are plain HTML and are never run through a template engine (`htmlTemplateEngine: false`).
- After any change: `npm run build && npm run check`. The check compares posts with `baseline/content.json`; for
  an intended content change, update the baseline or the `EXPECTED` list in `tools/check/check.mjs`. It also fails
  on unused files in `src/uploads/`, so delete photos no page uses.
- `_site/` is build output: never edit it.
- Don't re-run `tools/extract/extract-wp.mjs` or `tools/baseline/capture.mjs` unless asked: they overwrite
  `src/posts/*.html`, `src/about.html`, `src/_data/tagList.json`, `src/uploads/` and `baseline/content.json` from
  the WordPress backup. That backup isn't running; start it with `docker compose up -d` in
  `C:\Users\freek\Documents\freekinshanghai-clean` (see its README).
- Format code like `.prettierrc.json` (2 spaces, single quotes, 120 columns). Prettier itself isn't installed.

## Content model

- A post is `src/posts/<slug>.html`; the slug is the file name and the URL (`/<slug>/`). Front matter:
  `title`, `date` (UTC), `tags` (tag slugs), `excerpt` (card text), `image` (`card` 520 px and `small` 360 px for
  the cards, `large` 700 px only when the post shows its featured image), and `comments` (`id`, `author`, `date`,
  `html`, nested `replies`).
- Tag names come from `src/_data/tagList.json`; a new tag slug needs an entry there, or it shows as the slug and
  gets no tag page. Each tag slug is also an Eleventy collection name, so never use `posts` as a tag.
- `src/_data/site.js` holds everything that isn't a post: hero, favicons, menu, social links and all interface text.

## Gotchas

- Slideshow photos are `<figure class="slide"><a href=original><img src=1024 variant ...></a>`; `site.js` shows
  one at a time and sets `loading="eager"` on the neighbours. Hidden lazy images never load, which is the point.
- The masonry in `site.js` positions cards absolutely to keep DOM order; images need `width`/`height` for it.
- Dates are stored in UTC and shown in UTC, as WordPress did.
