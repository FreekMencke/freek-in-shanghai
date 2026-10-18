# Freek in Shanghai

Static archive of the blog www.freekinshanghai.be (2017): 21 posts, the About page, 42 comments and 934 photos in
26 slideshows. Rebuilt in October 2026 from the WordPress backup as a plain static site: no server, database or
WordPress needed to view it. In Dutch, the language it was written in, and in English under `/en/`.

## View it

- **Online:** https://shanghai.freekmencke.com (GitHub Pages; see "Hosting" below).
- **From disk:** open `_site/index.html` in a browser. All links are relative, so it works without a server.
- **With a local server:** `npm run serve`, then open http://localhost:8081.

## Build

Needs Node 24 (see `.nvmrc`).

```
npm ci
npm run build     # writes _site/
npm run check     # verifies _site/ (see below)
```

## Hosting

GitHub Pages, published by `.github/workflows/pages.yml`: every push to `main` builds the site, runs `npm run check`
and deploys `_site/`; pull requests get the build and check without deploying. The custom domain
`shanghai.freekmencke.com` is set in the repo's Pages settings, and Route 53 (zone `freekmencke.com`) has a CNAME
`shanghai` → `freekmencke.github.io`, which overrides the zone's wildcard record. Pages on GitHub Free needs this
repo to be public.

## Structure

| Path | What it is |
| --- | --- |
| `src/_data/site.js` | Site title, menu, social links, hero and favicons, and all interface text per language |
| `src/assets/css/site.css` | The only stylesheet. Colours, fonts and sizes are tokens at the top (`:root`) |
| `src/assets/js/site.js` | The only script: header, mobile menu, masonry cards, slideshows, photo viewer |
| `src/assets/fonts/` | SOLIX, the one typeface (variable font, all weights) |
| `src/_includes/layouts/` | `base.njk` (every page), `post.njk`, `page.njk` |
| `src/_includes/partials/` | Header, hero, card, comments, post navigation, footer, SVG icons |
| `src/posts/*.html` | One file per post: front matter (title, date, tags, images, comments) and the post HTML |
| `src/en/posts/*.html`, `src/en/about.html` | The English translations: title, excerpt and the post HTML; the rest comes from the Dutch post |
| `src/about.html`, `src/index.njk`, `src/tags.njk`, `src/404.njk` | About page, home page, one page per tag, 404 page |
| `src/_data/tagList.json` | Tag slugs, Dutch names and English names (`en`) where they differ |
| `src/uploads/` | The photos, in the same `2017/MM/` folders as on the old site (only files a page uses) |
| `eleventy.config.js` | Eleventy setup: collections, dates per language, relative URLs, slideshow thumbnails |
| `tools/check/check.mjs` | The checks behind `npm run check` |
| `baseline/content.json` | What the WordPress site showed, used by the checks |
| `tools/extract/`, `tools/baseline/` | One-time scripts that exported the content from WordPress |

The site is built with [Eleventy](https://www.11ty.dev/) 3.

## Making changes

- **Look of the whole site:** the tokens at the top of `site.css`.
- **Menu, footer links, interface text:** `src/_data/site.js` (`text.nl` and `text.en`).
- **Page structure:** one partial in `src/_includes/partials/`.
- **A post:** its file in `src/posts/`, and its English version with the same file name in `src/en/posts/`. The
  body is plain HTML.

After a change, run `npm run build` and `npm run check`. The check fails if a post's text, photos or comments differ
from `baseline/content.json`, so an intended content change also needs that file updated.

## What the checks cover

1. Every post and the About page against the WordPress baseline: title, date, text, tags, featured image,
   slideshow photos and captions in order, inline photos, comments and outbound links.
2. Every local link, image, script, stylesheet and font resolves to a file; nothing loads from Google Fonts,
   Gravatar, wordpress.com or the old domain.
3. No file in `uploads/` is unused.
4. HTML validation with html-validate.

## Differences from the WordPress site

On purpose:

- A new design (October 2026) instead of the Astrid theme: the SOLIX typeface, posts on white panels on the
  night blue of the hero photo, a narrower reading column, slideshow controls under the photo.
- Interface in Dutch (it was English), dates as "6 juni 2017".
- An English version of every page under `/en/`, with a language link in the menu: posts, About, captions and
  tag names translated in October 2026. Comments stay in Dutch. Visitors get English, unless their browser is set
  to Dutch or to Belgium; the language they pick with the menu link is remembered.
- Slideshows start paused, with a "12 / 426" counter, arrow keys and swipe, and only load the photos around the
  current one (the two biggest posts used to load 330 MB and 148 MB of photos at once). Clicking a photo opens it
  full size. Under each slideshow, and in the full-size viewer, a photo roll of thumbnails jumps straight to a photo;
  the build makes the thumbnails (160 px WebP, with `@11ty/eleventy-img`).
- All posts on one home page instead of infinite scroll; each tag on one page.
- Comments are read-only, without the form or Gravatar avatars.
- Dropped: share buttons, cookie banner, preloader, smooth-scroll script, category/date/author archives, feeds.
- Content fixes:
  - "Eerste week op kantoor": the dead imgur GIF is replaced by the copy in the media library.
  - "Residence permit en stage": the dead external G2 logo (and its link) is removed.
  - "Bankrekening, massage en Mahjong": the link to a "Foto's" page that no longer existed is removed (text kept).
  - "Eten, karaoke en 96th floor afterparty": one slideshow had random order; it now uses its saved order.
  - Hero subtitle typo fixed; tag "uistap" merged into "uitstap"; tag "Test" removed.
  - About page: a sharper photo, and the photo sits above the text on phones.

## Licences

Posts, photos and the stylesheet: © Freek Mencke; a few photos are from Unsplash or Pixabay, under their licences.
The SOLIX font: © Freek Mencke, all rights reserved (see `src/assets/fonts/LICENSE-solix.txt`).
The build tools (Eleventy and `@11ty/eleventy-img`, MIT; sharp, Apache-2.0, with libvips, LGPL-3.0) only run at build
time; none of their code ends up in the site.
