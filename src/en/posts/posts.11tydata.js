// English translations of src/posts/: the file name matches the Dutch post, which supplies the date, tags, images
// and comments. Front matter holds only what is translated: title and excerpt.
export default {
  layout: 'layouts/post.njk',
  bodyClass: 'single',
  permalink: data => `/en/${data.page.fileSlug}/`,
};
