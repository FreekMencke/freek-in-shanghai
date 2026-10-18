// Checks the built site in _site/ (run `npm run build` first):
//  1. content parity with baseline/content.json (what WordPress showed), apart from the documented content fixes;
//     each English page under /en/ has the same photos, slideshows, tags, date and comments as its Dutch original
//  2. every local link, image, script and stylesheet resolves to a file; no requests to hosts the archive dropped
//  3. no files in _site/uploads that no page uses
//  4. HTML validation (html-validate)
// Usage: npm run check
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import { HtmlValidate } from 'html-validate';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SITE = path.join(ROOT, '_site');
const baseline = JSON.parse(await readFile(path.join(ROOT, 'baseline/content.json'), 'utf8'));

// The content fixes the archive makes on purpose (see README).
const EXPECTED = {
  imageReplacements: { 'i.imgur.com/kToikeU.gif': '2017/03/9uRjHYy-Imgur.gif' },
  imageRemovals: ['digitalabstracts.com'],
  aboutImage: { '2017/03/IMG_20170308_145821-225x300.jpg': '2017/03/IMG_20170308_145821-360x480.jpg' },
  // One WordPress slideshow had random order; the archive uses the order of its [gallery] shortcode.
  randomOrderSlideshows: ['gallery-191-1-slideshow'],
  // The removed dead logo was wrapped in a link to the company site.
  linkRemovals: { '/residence-permit-en-stage/': ['http://www.g2studio.com'] },
};
const DROPPED_HOSTS = /fonts\.googleapis|fonts\.gstatic|gravatar|wp\.com|wordpress\.com|freekinshanghai\.be|localhost/;

const problems = [];
const fail = (where, message) => problems.push(`${where}: ${message}`);
const normalize = s => s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(e => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)])),
  );
  return files.flat();
}

async function exists(file) {
  return stat(file).then(
    s => s.isFile(),
    () => false,
  );
}

/** Path under uploads ("2017/03/x.jpg") for a URL in a built page, else the URL itself. */
function uploadFile(url) {
  const m = /uploads\/([^?#]+)/.exec(url ?? '');
  return m ? decodeURIComponent(m[1]) : url;
}

function sameDate(a, b) {
  return new Date(a).getTime() === new Date(b).getTime();
}

function compareList(where, what, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) fail(where, `${what} differ\n    expected ${e}\n    actual   ${a}`);
}

// --- 1. Content parity ------------------------------------------------------------------------------------------

async function loadPage(urlPath) {
  return cheerio.load(await readFile(path.join(SITE, urlPath, 'index.html'), 'utf8'));
}

function expectedInlineImages(images) {
  return images
    .filter(img => !EXPECTED.imageRemovals.some(host => img.file.includes(host)))
    .map(img => {
      const replaced = Object.entries(EXPECTED.imageReplacements).find(([from]) => img.file.includes(from));
      const about = EXPECTED.aboutImage[img.file];
      return { file: replaced ? replaced[1] : (about ?? img.file), caption: img.caption };
    });
}

function actualInlineImages($, content) {
  return content
    .find('img')
    .toArray()
    .filter(el => !$(el).closest('.slideshow').length)
    .map(el => {
      const figure = $(el).closest('figure');
      return {
        file: uploadFile($(el).attr('src')),
        caption: figure.length ? normalize(figure.find('figcaption').text()) : null,
      };
    });
}

function checkEntry(where, $, expected) {
  const content = $('.entry-content').first();

  const title = normalize($('h1.entry-title').text());
  if (title !== expected.title) fail(where, `title "${title}" ≠ "${expected.title}"`);

  const text = normalize(content.clone().find('.slideshow').remove().end().text());
  if (text !== expected.text) {
    const i = [...text].findIndex((c, n) => c !== expected.text[n]);
    fail(where, `text differs at ${i}: "…${text.slice(i - 30, i + 50)}" vs "…${expected.text.slice(i - 30, i + 50)}"`);
  }

  compareList(where, 'inline images', actualInlineImages($, content), expectedInlineImages(expected.images));
}

async function checkPosts() {
  const builtPosts = (await readdir(SITE, { withFileTypes: true })).filter(
    e => e.isDirectory() && !['about', 'tag', 'assets', 'uploads', 'en'].includes(e.name),
  );
  if (builtPosts.length !== baseline.posts.length) {
    fail('site', `${builtPosts.length} posts built, baseline has ${baseline.posts.length}`);
  }

  for (const post of baseline.posts) {
    const where = post.path;
    const $ = await loadPage(post.path);
    checkEntry(where, $, post);

    const date = $('.entry-meta time').attr('datetime');
    if (!sameDate(date, post.date)) fail(where, `date ${date} ≠ ${post.date}`);

    const tags = $('.tag-links a')
      .toArray()
      .map(el => normalize($(el).text()))
      .sort();
    compareList(where, 'tags', tags, [...post.tags].sort());

    const featured = $('.entry-image img').attr('src');
    if (Boolean(featured) !== Boolean(post.featured?.shown)) {
      fail(where, `featured image shown: ${Boolean(featured)}, WordPress: ${post.featured?.shown}`);
    } else if (featured && uploadFile(featured) !== post.featured.file) {
      fail(where, `featured image ${uploadFile(featured)} ≠ ${post.featured.file}`);
    }

    const shows = $('.entry-content .slideshow').toArray();
    if (shows.length !== post.slideshows.length) {
      fail(where, `${shows.length} slideshows, WordPress had ${post.slideshows.length}`);
    }
    post.slideshows.forEach((expected, n) => {
      const actual = $(shows[n])
        .find('.slide')
        .toArray()
        .map(el => ({
          file: uploadFile($(el).find('a').attr('href')),
          caption: normalize($(el).find('figcaption').text()),
        }));
      const byFile = list => [...list].sort((a, b) => a.file.localeCompare(b.file));
      const random = EXPECTED.randomOrderSlideshows.includes(expected.id);
      compareList(
        `${where} ${expected.id}`,
        'slides',
        random ? byFile(actual) : actual,
        random ? byFile(expected.images) : expected.images,
      );
    });

    const comments = $('.comment')
      .toArray()
      .map(el => {
        const body = $(el).children('.comment-body');
        return {
          id: Number($(el).attr('id').replace('comment-', '')),
          author: normalize(body.find('.comment-author').text()),
          date: new Date(body.find('time').attr('datetime')).toISOString(),
          text: normalize(body.find('.comment-content').text()),
        };
      });
    const expectedComments = post.comments.map(c => ({
      id: c.id,
      author: c.author,
      date: new Date(c.date).toISOString(),
      text: c.text,
    }));
    compareList(where, 'comments', comments, expectedComments);

    const externalLinks = list => list.filter(h => /^https?:/.test(h) && !DROPPED_HOSTS.test(h)).sort();
    const expectedLinks = externalLinks(post.links);
    for (const href of EXPECTED.linkRemovals[post.path] ?? []) expectedLinks.splice(expectedLinks.indexOf(href), 1);
    compareList(
      where,
      'external links',
      externalLinks($('.entry-content a[href]').toArray().map(el => $(el).attr('href'))),
      expectedLinks,
    );
  }

  const $ = await loadPage('/about/');
  checkEntry('/about/', $, baseline.about);

  for (const urlPath of ['/about/', ...baseline.posts.map(post => post.path)]) {
    await checkTranslation(urlPath);
  }
}

/** Everything on a post or page that is not translated: it must match between the Dutch page and its English one. */
function untranslated($) {
  const content = $('.entry-content').first();
  return {
    date: $('.entry-meta time').attr('datetime') ?? null,
    tags: $('.tag-links a')
      .toArray()
      .map(el => $(el).attr('href').replace(/^(\.\.\/)+(en\/)?/, '')),
    featured: $('.entry-image img').attr('src')?.replace(/^(\.\.\/)+/, '') ?? null,
    images: content
      .find('img')
      .toArray()
      .map(el => uploadFile($(el).attr('src'))),
    photoLinks: content
      .find('a[href*="uploads/"]')
      .toArray()
      .map(el => uploadFile($(el).attr('href'))),
    slideshows: content.find('.slideshow').toArray().map(el => $(el).find('.slide').length),
    externalLinks: content
      .find('a[href^="http"]')
      .toArray()
      .map(el => $(el).attr('href')),
    comments: $('.comment')
      .toArray()
      .map(el => ({
        id: $(el).attr('id'),
        text: normalize($(el).children('.comment-body').find('.comment-content').text()),
      })),
  };
}

async function checkTranslation(urlPath) {
  const where = `/en${urlPath}`;
  const english = await loadPage(where).catch(() => null);
  if (!english) return fail(where, 'missing English page');
  const dutch = await loadPage(urlPath);
  const a = untranslated(english);
  const e = untranslated(dutch);
  for (const key of Object.keys(e)) compareList(where, key, a[key], e[key]);
  if (english('html').attr('lang') !== 'en') fail(where, 'html lang is not "en"');
  const text = $ => normalize($('.entry-content').first().text());
  if (text(english) === text(dutch)) fail(where, 'text is the same as the Dutch page');
}

// --- 2 and 3. Links, assets and unused uploads -------------------------------------------------------------------

function urlsInHtml($) {
  const urls = [];
  $('[href], [src], [srcset]').each((_, el) => {
    const $el = $(el);
    if (el.tagName === 'use') return;
    for (const attr of ['href', 'src']) if ($el.attr(attr)) urls.push($el.attr(attr));
    const set = $el.attr('srcset');
    if (set) urls.push(...set.split(',').map(c => c.trim().split(/\s+/)[0]));
  });
  return urls;
}

async function checkLinksAndAssets(htmlFiles) {
  const used = new Set();
  const external = new Map();

  const checkLocal = async (from, url) => {
    if (/^(?:[a-z]+:|#|\/\/)/i.test(url)) return;
    const clean = decodeURIComponent(url.replace(/[?#].*$/, ''));
    const target = clean.startsWith('/') ? path.join(SITE, clean) : path.resolve(path.dirname(from), clean);
    const file = clean.endsWith('/') ? path.join(target, 'index.html') : target;
    used.add(file);
    if (!(await exists(file))) fail(path.relative(SITE, from), `broken local URL ${url}`);
  };

  for (const file of htmlFiles) {
    const $ = cheerio.load(await readFile(file, 'utf8'));
    for (const url of urlsInHtml($)) {
      if (/^(https?:)?\/\//.test(url)) {
        const host = new URL(url, 'https://x').host;
        if (DROPPED_HOSTS.test(host)) fail(path.relative(SITE, file), `URL on a dropped host: ${url}`);
        external.set(host, (external.get(host) ?? 0) + 1);
      } else {
        await checkLocal(file, url);
      }
    }
  }

  for (const css of (await walk(path.join(SITE, 'assets'))).filter(f => f.endsWith('.css'))) {
    for (const m of (await readFile(css, 'utf8')).matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
      await checkLocal(css, m[1]);
    }
  }

  const uploads = await walk(path.join(SITE, 'uploads'));
  const unused = uploads.filter(f => !used.has(f));
  for (const f of unused) fail('uploads', `not used by any page: ${path.relative(SITE, f)}`);

  return { external, uploads: uploads.length };
}

// --- 4. HTML validation ------------------------------------------------------------------------------------------

async function validate(htmlFiles) {
  const validator = new HtmlValidate({
    extends: ['html-validate:recommended'],
    rules: {
      // Post bodies are WordPress HTML: inline caption widths, <b>/<u> and similar are part of the content.
      'no-inline-style': 'off',
      'prefer-native-element': 'off',
      'no-redundant-role': 'off',
      'attribute-boolean-style': 'off',
      'attribute-empty-style': 'off',
      'long-title': 'off',
      'no-trailing-whitespace': 'off',
      'deprecated-rule': 'off',
    },
  });
  for (const file of htmlFiles) {
    const report = await validator.validateFile(file);
    for (const result of report.results) {
      for (const m of result.messages) {
        fail(path.relative(SITE, file), `html ${m.ruleId} line ${m.line}: ${m.message}`);
      }
    }
  }
}

// --- Run -----------------------------------------------------------------------------------------------------------

const htmlFiles = (await walk(SITE)).filter(f => f.endsWith('.html'));
await checkPosts();
const { external, uploads } = await checkLinksAndAssets(htmlFiles);
await validate(htmlFiles);

console.log(`Checked ${htmlFiles.length} pages and ${uploads} files in uploads.`);
console.log(
  `External hosts linked: ${[...external]
    .sort((a, b) => b[1] - a[1])
    .map(([h, n]) => `${h} (${n})`)
    .join(', ')}`,
);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('No problems found.');
}
