// Site-wide settings: names, menus, images and interface text. Change them here, not in the templates.
// The site is in Dutch (at /) and English (at /en/); `text` and `ui` hold the interface text per language.
export default {
  title: 'Freek in Shanghai',
  author: 'Freek Mencke',
  languages: ['nl', 'en'],

  hero: {
    title: 'Freek in Shanghai',
    image: { src: '/uploads/2017/03/cropped-shanghai-vignette.jpg', width: 1920, height: 1080 },
    // Shown below the desktop breakpoint instead of the wide image.
    imageMobile: { src: '/uploads/2017/03/shanghai.jpg', width: 1024, height: 576 },
  },

  favicons: {
    icon32: '/uploads/2017/02/cropped-shanghai-32x32.jpg',
    icon192: '/uploads/2017/02/cropped-shanghai-192x192.jpg',
    appleTouch: '/uploads/2017/02/cropped-shanghai-180x180.jpg',
  },

  // Dutch URLs; English pages get /en in front (the localUrl filter).
  menu: [
    { text: 'Home', url: '/' },
    { text: 'About', url: '/about/' },
  ],

  social: [
    { text: 'Twitter', url: 'https://twitter.com/FreekMencke' },
    { text: 'Instagram', url: 'https://www.instagram.com/freekmencke/' },
  ],

  text: {
    nl: {
      locale: 'nl-BE',
      languageName: 'Nederlands',
      tagline: 'Een blog over mijn tijd in Shanghai.',
      heroSubtitle: 'Een blog over mijn tijd in Shanghai',
      skipToContent: 'Naar de inhoud',
      menu: 'Menu',
      readMore: 'Lees meer',
      tags: 'Tags',
      tagTitle: 'Tag',
      previousPost: 'Vorig bericht',
      nextPost: 'Volgend bericht',
      postNavigation: 'Berichten',
      comments: count => (count === 1 ? '1 reactie op' : `${count} reacties op`),
      socialMenu: 'Sociale media',
      onSocial: name => `Freek Mencke op ${name}`,
      notFoundTitle: 'Oeps! Deze pagina bestaat niet.',
      notFoundText: 'Misschien vind je wat je zoekt via de berichten op de startpagina.',
      backHome: 'Naar de startpagina',
    },
    en: {
      locale: 'en-GB',
      languageName: 'English',
      tagline: 'A blog about my time in Shanghai.',
      heroSubtitle: 'A blog about my time in Shanghai',
      skipToContent: 'Skip to content',
      menu: 'Menu',
      readMore: 'Read more',
      tags: 'Tags',
      tagTitle: 'Tag',
      previousPost: 'Previous post',
      nextPost: 'Next post',
      postNavigation: 'Posts',
      comments: count => (count === 1 ? '1 comment on' : `${count} comments on`),
      socialMenu: 'Social media',
      onSocial: name => `Freek Mencke on ${name}`,
      notFoundTitle: "Oops! This page doesn't exist.",
      notFoundText: 'You may find what you are looking for among the posts on the home page.',
      backHome: 'Go to the home page',
    },
  },

  // Text used by site.js (passed to the page as JSON by the base layout, so strings only; site.js fills in {n}).
  ui: {
    nl: {
      slideshow: 'Fotoshow',
      previousPhoto: 'Vorige foto',
      nextPhoto: 'Volgende foto',
      openPhoto: 'Foto groot bekijken',
      photoViewer: 'Foto',
      photoRoll: "Alle foto's",
      photoNumber: 'Foto {n}',
      close: 'Sluiten',
    },
    en: {
      slideshow: 'Slideshow',
      previousPhoto: 'Previous photo',
      nextPhoto: 'Next photo',
      openPhoto: 'View photo full size',
      photoViewer: 'Photo',
      photoRoll: 'All photos',
      photoNumber: 'Photo {n}',
      close: 'Close',
    },
  },
};
