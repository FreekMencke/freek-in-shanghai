# Freek in Shanghai (static archive)

Eleventy 3 site; README.md has the structure and commands. Runs in WSL with Node 24 from nvm: non-interactive
shells need `source ~/.nvm/nvm.sh` first.

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
- Don't re-run `tools/extract/extract-wp.mjs` unless asked: it overwrites `src/posts/*.html`, `src/about.html`,
  `src/_data/tagList.json` and `src/uploads/` from the WordPress backup (which has to be running for it).

## Gotchas

- Slideshow photos are `<figure class="slide"><a href=original><img src=1024 variant ...></a>`; `site.js` shows
  one at a time and sets `loading="eager"` on the neighbours. Hidden lazy images never load, which is the point.
- The masonry in `site.js` positions cards absolutely to keep DOM order; images need `width`/`height` for it.
- Dates are stored in UTC and shown in UTC, as WordPress did.
