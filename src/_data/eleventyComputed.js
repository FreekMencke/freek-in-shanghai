// Values every page gets, derived from its own front matter.
export default {
  // Interface text in the page's language (src/_data/site.js).
  t: data => data.site.text[data.lang],
  otherLang: data => (data.lang === 'nl' ? 'en' : 'nl'),
  // The same page in the other language. The 404 page has none: it is in both languages.
  alternateUrl: data => {
    const url = data.page.url;
    if (!url || url === '/404.html') return null;
    return data.lang === 'nl' ? `/en${url}` : url.replace(/^\/en/, '');
  },
  pageTitle: data =>
    data.title ? `${data.title} - ${data.site.title}` : `${data.site.title} - ${data.site.text[data.lang].tagline}`,
  description: data =>
    data.excerpt ? data.excerpt.replace(/\s*\[…\]$/, '…') : data.site.text[data.lang].tagline,
};
