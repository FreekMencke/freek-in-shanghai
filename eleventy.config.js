import path from 'node:path';
import Image from '@11ty/eleventy-img';
import tagList from './src/_data/tagList.json' with { type: 'json' };
import site from './src/_data/site.js';

const tags = new Map(tagList.map(t => [t.slug, t]));
const formats = Object.fromEntries(
  site.languages.map(lang => {
    const { locale } = site.text[lang];
    return [
      lang,
      {
        date: new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }),
        dateTime: new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short', timeZone: 'UTC' }),
      },
    ];
  }),
);

/**
 * Turns a root-relative URL into one relative to the page, with an explicit index.html, so the built site works
 * when opened straight from disk (file://) as well as on any static host.
 */
function relativeUrl(url, pageUrl) {
  if (!url.startsWith('/') || url.startsWith('//')) return url;
  const [, pathname, suffix] = /^([^?#]*)(.*)$/.exec(url);
  const target = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
  const from = pageUrl.endsWith('/') ? pageUrl : `${path.posix.dirname(pageUrl)}/`;
  return path.posix.relative(from, target) + suffix;
}

// The photo roll under the slideshows (site.js) shows thumbnails at 80 px wide (site.css, --thumb); 2× that.
const THUMB_WIDTH = 160;

/**
 * Makes a thumbnail of an uploaded photo ("2017/04/x-1024x768.jpg", a path under uploads) next to it in the output.
 * Returns the thumbnail's path under uploads and its width.
 */
async function thumbnail(file, outputDir) {
  const { webp } = await Image(`src/uploads/${file}`, {
    widths: [THUMB_WIDTH],
    formats: ['webp'],
    outputDir: path.join(outputDir, 'uploads', path.posix.dirname(file)),
    filenameFormat: (id, src, width, format) => `${path.parse(src).name}-thumb.${format}`,
  });
  return { file: `${path.posix.dirname(file)}/${path.basename(webp[0].outputPath)}`, width: webp[0].width };
}

function countComments(comments = []) {
  return comments.reduce((n, c) => n + 1 + countComments(c.replies), 0);
}

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ 'src/assets': 'assets', 'src/uploads': 'uploads' });

  eleventyConfig.addCollection('posts', api => api.getFilteredByGlob('src/posts/*.html'));
  eleventyConfig.addCollection('postsEn', api => api.getFilteredByGlob('src/en/posts/*.html'));

  eleventyConfig.addFilter('date', (value, lang) => formats[lang].date.format(new Date(value)));
  eleventyConfig.addFilter('dateTime', (value, lang) => formats[lang].dateTime.format(new Date(value)));
  eleventyConfig.addFilter('isoDate', value => new Date(value).toISOString());
  // tagList.json has the Dutch name, and an English one (`en`) where it differs.
  eleventyConfig.addFilter('tagName', (slug, lang) => {
    const tag = tags.get(slug);
    return (lang === 'en' && tag?.en) || tag?.name || slug;
  });
  eleventyConfig.addFilter('localUrl', (url, lang) => (lang === 'nl' ? url : `/${lang}${url}`));

  // Dutch posts are the originals; an English post is the file with the same name in src/en/posts/.
  // Eleventy's i18n plugin expects every language in its own folder or host redirects, and this site keeps Dutch
  // at / and has to work from disk, so these two filters do the matching.
  eleventyConfig.addFilter('original', (slug, posts) => posts.find(post => post.page.fileSlug === slug));
  eleventyConfig.addFilter('translation', (post, lang, translations) =>
    lang === 'nl' ? post : translations.find(t => t.page.fileSlug === post.page.fileSlug),
  );
  eleventyConfig.addFilter('commentCount', countComments);

  // Photos in posts link to their full-size file; give those links a name (the image has no alt text).
  eleventyConfig.addTransform('photo-link-labels', function (content) {
    if (!this.page.outputPath?.endsWith('.html')) return content;
    const ui = site.ui[this.page.url.startsWith('/en/') ? 'en' : 'nl'];
    return content.replace(
      /<a ([^>]*href="[^"]+\.(?:jpe?g|png|gif)"[^>]*)>(\s*<img)/gi,
      `<a $1 aria-label="${ui.openPhoto}">$2`,
    );
  });

  // Slideshow photos get a thumbnail as the smallest candidate in their srcset, where site.js finds it for the photo
  // roll. The slideshow itself never picks it: its sizes are far wider.
  eleventyConfig.addTransform('slide-thumbnails', async function (content) {
    if (!this.page.outputPath?.endsWith('.html')) return content;
    const slideImage = /(<figure class="slide">\s*<a [^>]*><img src="([^"]*?uploads\/)([^"]+)" srcset=")/g;
    const files = new Set([...content.matchAll(slideImage)].map(m => m[3]));
    if (!files.size) return content;
    const outputDir = eleventyConfig.directories.output;
    const thumbs = new Map(await Promise.all([...files].map(async file => [file, await thumbnail(file, outputDir)])));
    return content.replace(slideImage, (match, start, uploads, file) => {
      const thumb = thumbs.get(file);
      return `${start}${uploads}${thumb.file} ${thumb.width}w, `;
    });
  });

  // The 404 page is served at any depth by a host, so it keeps root-relative URLs.
  eleventyConfig.htmlTransformer.addUrlTransform(
    'html',
    function (url) {
      return relativeUrl(url, this.url);
    },
    { enabled: context => Boolean(context.url) && context.url !== '/404.html' },
  );

  return {
    dir: { input: 'src', includes: '_includes', data: '_data', output: '_site' },
    templateFormats: ['html', 'njk'],
    // Post bodies are plain HTML from WordPress: never run them through a template engine.
    htmlTemplateEngine: false,
  };
}
