// One-time export of the WordPress blog into src/: posts, the About page, tags and the image files they use.
// Needs the WordPress backup running (docker compose up -d in freekinshanghai-clean). Safe to re-run: it rewrites
// src/posts/*.html, src/about.html, src/_data/tagList.json and src/uploads/ from scratch.
// Usage: node tools/extract/extract-wp.mjs
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import site from '../../src/_data/site.js';
import { frontMatter } from './yaml.mjs';

const ORIGIN = 'http://localhost:8080';
const API = `${ORIGIN}/wp-json/wp/v2`;
const DB_CONTAINER = 'freekinshanghai-db-1';
const UPLOADS_SOURCE = '/mnt/c/Users/freek/Documents/freekinshanghai-clean/wp-content/uploads';
const SRC = fileURLToPath(new URL('../../src/', import.meta.url));

// Content fixes (see README): tag clean-up, a dead link, a dead and a moved image.
const TAG_RENAMES = { uistap: 'uitstap' };
const TAG_DROPS = new Set(['test']);
const DEAD_LINKS = new Set(['/fotos/']);
const DEAD_IMAGE_HOSTS = ['digitalabstracts.com'];
const IMAGE_REPLACEMENTS = { '//i.imgur.com/kToikeU.gif': 295 };
const ABOUT_IMAGE = 168;

// Inside its border the slideshow frame is 1006 x 618 px on wide screens; photos are scaled to fit.
const SLIDE_FRAME = { width: 1006, height: 618 };
const slideSizes = media =>
  `(min-width: 1200px) ${Math.round(Math.min(SLIDE_FRAME.width, (SLIDE_FRAME.height * media.width) / media.height))}px, 100vw`;
const OLD_HOSTS = /^(?:https?:)?\/\/(?:www\.)?(?:freekinshanghai\.be|localhost:8080)(?=\/|$)/;

// --- WordPress access -------------------------------------------------------------------------------------------

async function getJson(path) {
  const res = await fetch(API + path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return { body: await res.json(), pages: Number(res.headers.get('x-wp-totalpages') ?? 1) };
}

async function getAll(path) {
  const sep = path.includes('?') ? '&' : '?';
  const first = await getJson(`${path}${sep}per_page=100&page=1`);
  const rest = await Promise.all(
    Array.from({ length: first.pages - 1 }, (_, i) => getJson(`${path}${sep}per_page=100&page=${i + 2}`)),
  );
  return [first, ...rest].flatMap(r => r.body);
}

/** Raw post_content (for the gallery order in the shortcodes) and the hide-featured-image flag, from MySQL. */
function rawPosts() {
  const sql = `SELECT JSON_OBJECTAGG(p.ID, JSON_OBJECT('content', p.post_content, 'hideFeatured',
    (SELECT m.meta_value FROM wp_postmeta m WHERE m.post_id = p.ID AND m.meta_key = '_hide_featured' LIMIT 1)))
    FROM wp_posts p WHERE p.post_status = 'publish' AND p.post_type IN ('post', 'page');`;
  const out = execFileSync(
    'docker',
    [
      'exec',
      '-i',
      DB_CONTAINER,
      'sh',
      '-c',
      'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" --default-character-set=utf8mb4 -N -B --raw freekinshanghai 2>/dev/null',
    ],
    { input: sql, maxBuffer: 64 * 1024 * 1024 },
  );
  return JSON.parse(out.toString('utf8'));
}

// --- URLs and media ---------------------------------------------------------------------------------------------

/** "/uploads/2017/03/x.jpg" for any URL the old site used for an uploaded file, else null. */
function uploadUrl(url) {
  const m = /\/wp-content\/uploads\/([^?#\s]+)/.exec(url ?? '');
  return m ? `/uploads/${m[1]}` : null;
}

/** "/slug/" for a link to a page of the old site, else null. */
function oldSitePath(url) {
  return OLD_HOSTS.test(url ?? '') ? url.replace(OLD_HOSTS, '') || '/' : null;
}

function decode(html) {
  return cheerio.load(html ?? '', null, false).text();
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function mediaEntry(m) {
  const d = m.media_details;
  const dir = d.file.replace(/[^/]+$/, '');
  const stem = d.file.split('/').pop().replace(/\.[^.]+$/, '');
  const sizes = {};
  for (const [name, s] of Object.entries(d.sizes ?? {})) {
    // Edited images keep stale sizes of the unedited file in their metadata (attachment 861): skip those.
    if (name === 'full' || !s.file.startsWith(`${stem}-`)) continue;
    sizes[name] = { src: `/uploads/${dir}${s.file}`, width: s.width, height: s.height };
  }
  return { id: m.id, src: `/uploads/${d.file}`, width: d.width, height: d.height, stem, sizes };
}

function srcset(candidates) {
  const unique = new Map(candidates.filter(Boolean).map(c => [c.src, c]));
  return [...unique.values()]
    .sort((a, b) => a.width - b.width)
    .map(c => `${c.src} ${c.width}w`)
    .join(', ');
}

function slideshowHtml(slides) {
  const figures = slides.map(({ media, caption }) => {
    const shown = media.sizes.large ?? media;
    const set = srcset([media.sizes.medium_large, media.sizes.large, media]);
    const img = `<img src="${shown.src}" srcset="${set}" sizes="${slideSizes(media)}" width="${shown.width}" height="${shown.height}" alt="" loading="lazy" decoding="async">`;
    const figcaption = caption ? `\n    <figcaption>${escapeHtml(caption)}</figcaption>` : '';
    return `  <figure class="slide">\n    <a href="${media.src}">${img}</a>${figcaption}\n  </figure>`;
  });
  return `<div class="slideshow" data-slideshow>\n${figures.join('\n')}\n</div>`;
}

function image(media, sizeName) {
  const s = media.sizes[sizeName] ?? media;
  return { src: s.src, width: s.width, height: s.height };
}

// --- Content clean-up -------------------------------------------------------------------------------------------

function removeWithEmptyParents($, el) {
  let node = $(el);
  let parent = node.parent();
  node.remove();
  while (parent.length && !parent.is('body, html') && !parent.children().length && !parent.text().trim()) {
    node = parent;
    parent = node.parent();
    node.remove();
  }
}

function cleanBody(html, { media, galleryIds, postId }) {
  const $ = cheerio.load(html, null, false);

  $('p.jetpack-slideshow-noscript, script, style, .sharedaddy').remove();

  $('.jetpack-slideshow').each((n, el) => {
    const items = JSON.parse($(el).attr('data-gallery'));
    const order = galleryIds[n];
    const byId = new Map(items.map(i => [Number(i.id), i]));
    if (!order || order.length !== items.length || order.some(id => !byId.has(id))) {
      throw new Error(`post ${postId}: slideshow ${n + 1} does not match its [gallery] shortcode`);
    }
    const slides = order.map(id => ({ media: media.get(id), caption: decode(byId.get(id).caption).trim() }));
    $(el).replaceWith(slideshowHtml(slides));
  });

  $('img').each((_, el) => {
    const $img = $(el);
    const src = $img.attr('src') ?? '';
    if (DEAD_IMAGE_HOSTS.some(host => src.includes(host))) {
      removeWithEmptyParents($, el);
      return;
    }
    const replacementId = IMAGE_REPLACEMENTS[src];
    const media_ = replacementId
      ? media.get(replacementId)
      : media.get(Number(/wp-image-(\d+)/.exec($img.attr('class') ?? '')?.[1]));
    $img.attr('src', replacementId ? media_.src : (uploadUrl(src) ?? src));
    if (replacementId) $img.attr({ width: media_.width, height: media_.height });

    const set = $img.attr('srcset');
    if (set) {
      const candidates = set
        .split(',')
        .map(c => c.trim().split(/\s+/))
        .map(([url, w]) => [uploadUrl(url) ?? url, w])
        .filter(([url]) => !media_ || url.split('/').pop().startsWith(media_.stem));
      $img.attr('srcset', candidates.map(c => c.join(' ')).join(', '));
    }
    const sizes = $img.attr('sizes');
    if (sizes) $img.attr('sizes', sizes.replace(/^auto,\s*/, ''));

    for (const name of Object.keys(el.attribs)) {
      if (name.startsWith('data-') || name === 'fetchpriority' || name === 'title') $img.removeAttr(name);
    }
    $img.attr({ loading: 'lazy', decoding: 'async' });
  });

  $('a[href]').each((_, el) => {
    const $a = $(el);
    const href = $a.attr('href');
    const upload = uploadUrl(href);
    if (upload) {
      $a.attr('href', upload);
      return;
    }
    const path = oldSitePath(href);
    if (!path) return;
    if (DEAD_LINKS.has(path)) $a.replaceWith($a.contents());
    else $a.attr('href', path);
  });

  // Empty spacer paragraphs (<p>&nbsp;</p>) and empty headings.
  $('p, h1, h2, h3, h4, h5, h6')
    .filter((_, el) => !$(el).find('img').length && !$(el).text().replace(/ /g, ' ').trim())
    .remove();

  return $.html()
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function commentTree(comments) {
  const nodes = comments
    .sort((a, b) => a.date_gmt.localeCompare(b.date_gmt))
    .map(c => ({
      id: c.id,
      parent: c.parent,
      author: decode(c.author_name),
      date: `${c.date_gmt}Z`,
      html: c.content.rendered.trim(),
      replies: [],
    }));
  const byId = new Map(nodes.map(n => [n.id, n]));
  const roots = [];
  for (const n of nodes) (n.parent ? byId.get(n.parent).replies : roots).push(n);
  const strip = n => {
    const { parent, replies, ...rest } = n;
    return replies.length ? { ...rest, replies: replies.map(strip) } : rest;
  };
  return roots.map(strip);
}

// --- Export -----------------------------------------------------------------------------------------------------

console.log('Fetching from WordPress (each request takes a few seconds)...');
const [posts, [about], tags, mediaList, comments] = await Promise.all([
  getAll('/posts?_fields=id,slug,date_gmt,title,content,excerpt,tags,featured_media'),
  getAll('/pages?_fields=id,slug,title,content&include=5'),
  getAll('/tags?_fields=id,slug,name'),
  getAll('/media?_fields=id,media_details'),
  getAll('/comments?_fields=id,post,parent,author_name,date_gmt,content'),
]);
const raw = rawPosts();
const media = new Map(mediaList.map(m => [m.id, mediaEntry(m)]));
const tagsById = new Map(tags.map(t => [t.id, t]));

const usedTags = new Map();
const outputs = [];

for (const p of posts) {
  const galleryIds = [...raw[p.id].content.matchAll(/\[gallery\b[^\]]*\bids="([^"]+)"/g)].map(m =>
    m[1].split(',').map(Number),
  );
  const slugs = [
    ...new Set(
      p.tags
        .map(id => tagsById.get(id).slug)
        .map(slug => TAG_RENAMES[slug] ?? slug)
        .filter(slug => !TAG_DROPS.has(slug)),
    ),
  ];
  for (const slug of slugs) usedTags.set(slug, decode(tags.find(t => t.slug === slug).name));

  const featured = media.get(p.featured_media);
  // The hide-featured-image plugin hid the image on the post itself (it still showed on the cards).
  const showOnPost = raw[p.id].hideFeatured !== '1';
  const data = {
    title: decode(p.title.rendered),
    date: `${p.date_gmt}Z`,
    tags: slugs,
    excerpt: decode(p.excerpt.rendered).trim(),
    image: {
      card: image(featured, 'astrid-medium-thumb'),
      small: image(featured, 'astrid-small-thumb'),
      ...(showOnPost && { large: image(featured, 'astrid-large-thumb') }),
    },
    comments: commentTree(comments.filter(c => c.post === p.id)),
  };
  const body = cleanBody(p.content.rendered, { media, galleryIds, postId: p.id });
  outputs.push({ file: `posts/${p.slug}.html`, text: `${frontMatter(data)}\n${body}\n` });
}

{
  const body = cleanBody(about.content.rendered, { media, galleryIds: [], postId: about.id });
  const $ = cheerio.load(body, null, false);
  const photo = media.get(ABOUT_IMAGE);
  // The page showed the 225 px file stretched to 300 px; use the sharper variants at the same size.
  $(`img.wp-image-${ABOUT_IMAGE}`).attr({
    src: photo.sizes['astrid-small-thumb'].src,
    srcset: srcset([photo.sizes['astrid-small-thumb'], photo.sizes.medium_large]),
    sizes: '300px',
    width: 300,
    height: 400,
  });
  const data = { title: decode(about.title.rendered), permalink: '/about/' };
  outputs.push({ file: 'about.html', text: `${frontMatter(data)}\n${$.html().trim()}\n` });
}

const tagList = [...usedTags].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.slug.localeCompare(b.slug));
outputs.push({ file: '_data/tagList.json', text: JSON.stringify(tagList, null, 2) + '\n' });

for (const file of await readdir(`${SRC}posts`).catch(() => [])) {
  if (file.endsWith('.html')) await rm(`${SRC}posts/${file}`);
}
for (const { file, text } of outputs) {
  await mkdir(dirname(`${SRC}${file}`), { recursive: true });
  await writeFile(`${SRC}${file}`, text);
}

// --- Images: copy exactly the files the pages reference ---------------------------------------------------------

const referenced = new Set();
const collect = text => {
  for (const m of text.matchAll(/\/uploads\/[^\s"'<>?#,)]+/g)) referenced.add(decodeURIComponent(m[0]));
};
outputs.forEach(o => collect(o.text));
collect(JSON.stringify(site));

await rm(`${SRC}uploads`, { recursive: true, force: true });
let bytes = 0;
const missing = [];
for (const url of [...referenced].sort()) {
  const from = `${UPLOADS_SOURCE}${url.slice('/uploads'.length)}`;
  const to = `${SRC}${url.slice(1)}`;
  try {
    bytes += (await stat(from)).size;
    await mkdir(dirname(to), { recursive: true });
    await copyFile(from, to);
  } catch {
    missing.push(url);
  }
}

const slides = outputs.reduce((n, o) => n + (o.text.match(/<figure class="slide">/g)?.length ?? 0), 0);
console.log(
  `posts ${posts.length}, about 1, tags ${tagList.length}, comments ${comments.length}, slides ${slides}, ` +
    `images ${referenced.size - missing.length} (${(bytes / 1024 / 1024).toFixed(0)} MB)`,
);
if (missing.length) {
  console.error(`Missing ${missing.length} files:\n${missing.join('\n')}`);
  process.exitCode = 1;
}
