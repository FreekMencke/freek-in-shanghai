// One-time: records what the WordPress site shows (posts, About, comments, images) as baseline/content.json.
// The static site is checked against this file by tools/check/check.mjs.
// Usage: node tools/baseline/capture.mjs [http://localhost:8080]
import { writeFile, mkdir } from 'node:fs/promises';
import * as cheerio from 'cheerio';

const ORIGIN = process.argv[2] ?? 'http://localhost:8080';
const OUT = new URL('../../baseline/content.json', import.meta.url);

/** Reduces any URL the old site used for a local file to its path under uploads ("2017/03/x.jpg"). */
export function uploadPath(url) {
  const m = /\/wp-content\/uploads\/(.+?)(?:[?#].*)?$/.exec(url ?? '');
  return m ? decodeURIComponent(m[1]) : null;
}

export function normalizeText(s) {
  return s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

async function get(path) {
  const res = await fetch(ORIGIN + path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.text();
}

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

function sitemapPaths(xml) {
  return [...xml.matchAll(/<loc>(?:<!\[CDATA\[)?([^<\]]+)/g)].map(m => new URL(m[1]).pathname);
}

function parseComments($, list, parent = null) {
  return list
    .children('li')
    .toArray()
    .flatMap(li => {
      const $li = $(li);
      const id = Number($li.attr('id').replace('comment-', ''));
      const body = $li.children('article');
      const comment = {
        id,
        parent,
        author: normalizeText(body.find('.comment-author .fn').first().text()),
        date: body.find('.comment-metadata time').attr('datetime'),
        text: normalizeText(body.find('.comment-content').text()),
      };
      return [comment, ...parseComments($, $li.children('ol.children'), id)];
    });
}

function parsePage(path, html) {
  const $ = cheerio.load(html);
  const content = $('.entry-content').first().clone();
  content.find('.sharedaddy, .jetpack-slideshow-noscript, script, style').remove();

  const slideshows = content
    .find('.jetpack-slideshow')
    .toArray()
    .map(el => {
      const id = $(el).attr('id');
      const items = JSON.parse($(el).attr('data-gallery'));
      return {
        id,
        images: items.map(i => ({
          file: uploadPath(i.src),
          caption: normalizeText(cheerio.load(i.caption ?? '').text()),
        })),
      };
    });
  content.find('.jetpack-slideshow').remove();

  const images = content
    .find('img')
    .toArray()
    .map(el => {
      const src = $(el).attr('src');
      const figure = $(el).closest('figure');
      return {
        file: uploadPath(src) ?? src,
        caption: figure.length ? normalizeText(figure.find('figcaption').text()) : null,
      };
    });

  const links = content
    .find('a[href]')
    .toArray()
    .map(el => $(el).attr('href'));

  const hideStyle = $('style')
    .toArray()
    .some(el => /img\.wp-post-image[^{]*\{\s*display:\s*none/.test($(el).text()));
  const thumb = $('.single-thumb img').attr('src');

  return {
    path,
    title: normalizeText($('h1.entry-title').first().text()),
    date: $('.entry-meta time.published').attr('datetime') ?? null,
    tags: $('.tags-links a')
      .toArray()
      .map(el => normalizeText($(el).text())),
    featured: thumb ? { file: uploadPath(thumb), shown: !hideStyle } : null,
    text: normalizeText(content.text()),
    slideshows,
    images,
    links,
    comments: parseComments($, $('ol.comment-list').first()),
  };
}

function parseSite(html) {
  const $ = cheerio.load(html);
  return {
    title: normalizeText($('.site-title').first().text()),
    description: normalizeText($('.site-description').first().text()),
    heroTitle: normalizeText($('.header-text').first().text()),
    heroSubtitle: normalizeText($('.header-subtext').first().text()),
    menu: $('#mainnav a')
      .toArray()
      .map(el => normalizeText($(el).text())),
    footerLinks: $('#colophon a')
      .toArray()
      .map(el => ({ text: normalizeText($(el).text()), href: $(el).attr('href') })),
    footerName: normalizeText($('.naam-onder').text()),
    heroImages: $('.header-image img')
      .toArray()
      .map(el => uploadPath($(el).attr('src'))),
  };
}

const postPaths = sitemapPaths(await get('/post-sitemap.xml'));
const pagePaths = sitemapPaths(await get('/page-sitemap.xml'));
const [home, ...pages] = await pool(['/', ...postPaths, ...pagePaths], 8, async p => ({ p, html: await get(p) }));

const parsed = pages.map(({ p, html }) => parsePage(p, html));
const posts = parsed.filter(x => postPaths.includes(x.path)).sort((a, b) => a.date.localeCompare(b.date));
const about = parsed.find(x => pagePaths.includes(x.path));

const baseline = {
  capturedFrom: ORIGIN,
  site: parseSite(home.html),
  posts,
  about,
};

await mkdir(new URL('.', OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(baseline, null, 2) + '\n');

const count = (f) => posts.reduce((n, p) => n + f(p), 0);
console.log(
  `posts ${posts.length}, slideshows ${count(p => p.slideshows.length)}, slides ${count(p =>
    p.slideshows.reduce((n, s) => n + s.images.length, 0),
  )}, inline images ${count(p => p.images.length)}, comments ${count(p => p.comments.length)}, about ${!!about}`,
);
