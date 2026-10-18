// One tag page per tag and language, for the pagination in src/tags.njk.
import tagList from './tagList.json' with { type: 'json' };
import site from './site.js';

export default site.languages.flatMap(lang => tagList.map(tag => ({ tag, lang })));
