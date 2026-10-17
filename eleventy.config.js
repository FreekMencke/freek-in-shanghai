import path from 'node:path';
import tagList from './src/_data/tagList.json' with { type: 'json' };
import site from './src/_data/site.js';

const tagNames = new Map(tagList.map(t => [t.slug, t.name]));
const dateFormat = new Intl.DateTimeFormat(site.locale, { dateStyle: 'long', timeZone: 'UTC' });
const dateTimeFormat = new Intl.DateTimeFormat(site.locale, { dateStyle: 'long', timeStyle: 'short', timeZone: 'UTC' });

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

function countComments(comments = []) {
  return comments.reduce((n, c) => n + 1 + countComments(c.replies), 0);
}

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ 'src/assets': 'assets', 'src/uploads': 'uploads' });

  eleventyConfig.addCollection('posts', api => api.getFilteredByGlob('src/posts/*.html'));

  eleventyConfig.addFilter('date', value => dateFormat.format(new Date(value)));
  eleventyConfig.addFilter('dateTime', value => dateTimeFormat.format(new Date(value)));
  eleventyConfig.addFilter('isoDate', value => new Date(value).toISOString());
  eleventyConfig.addFilter('tagName', slug => tagNames.get(slug) ?? slug);
  eleventyConfig.addFilter('commentCount', countComments);

  // Photos in posts link to their full-size file; give those links a name (the image has no alt text).
  eleventyConfig.addTransform('photo-link-labels', function (content) {
    if (!this.page.outputPath?.endsWith('.html')) return content;
    return content.replace(
      /<a ([^>]*href="[^"]+\.(?:jpe?g|png|gif)"[^>]*)>(\s*<img)/gi,
      `<a $1 aria-label="${site.ui.openPhoto}">$2`,
    );
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
