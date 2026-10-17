// Values every page gets, derived from its own front matter.
export default {
  pageTitle: data => (data.title ? `${data.title} - ${data.site.title}` : `${data.site.title} - ${data.site.tagline}`),
  description: data => (data.excerpt ? data.excerpt.replace(/\s*\[…\]$/, '…') : data.site.tagline),
};
