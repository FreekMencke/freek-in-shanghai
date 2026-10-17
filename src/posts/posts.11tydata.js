export default {
  layout: 'layouts/post.njk',
  bodyClass: 'single',
  permalink: data => `/${data.page.fileSlug}/`,
};
