// Site-wide settings: names, menus, images and interface text. Change them here, not in the templates.
export default {
  title: 'Freek in Shanghai',
  tagline: 'Een blog over mijn tijd in Shanghai.',
  lang: 'nl',
  locale: 'nl-BE',
  author: 'Freek Mencke',

  hero: {
    title: 'Freek in Shanghai',
    subtitle: 'Een blog over mijn tijd in Shanghai',
    image: { src: '/uploads/2017/03/cropped-shanghai-vignette.jpg', width: 1920, height: 1080 },
    // Shown below the desktop breakpoint instead of the wide image.
    imageMobile: { src: '/uploads/2017/03/shanghai.jpg', width: 1024, height: 576 },
  },

  favicons: {
    icon32: '/uploads/2017/02/cropped-shanghai-32x32.jpg',
    icon192: '/uploads/2017/02/cropped-shanghai-192x192.jpg',
    appleTouch: '/uploads/2017/02/cropped-shanghai-180x180.jpg',
  },

  menu: [
    { text: 'Home', url: '/' },
    { text: 'About', url: '/about/' },
  ],

  social: [
    { text: 'Twitter', url: 'https://twitter.com/FreekMencke', title: 'Freek Mencke op Twitter' },
    { text: 'Instagram', url: 'https://www.instagram.com/freekmencke/', title: 'Freek Mencke op Instagram' },
  ],

  text: {
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
    notFoundTitle: 'Oeps! Deze pagina bestaat niet.',
    notFoundText: 'Misschien vind je wat je zoekt via de berichten op de startpagina.',
    backHome: 'Naar de startpagina',
  },

  // Text used by site.js (passed to the page as JSON by the base layout).
  ui: {
    slideshow: 'Fotoshow',
    previousPhoto: 'Vorige foto',
    nextPhoto: 'Volgende foto',
    openPhoto: 'Foto groot bekijken',
    photoViewer: 'Foto',
    close: 'Sluiten',
  },
};
