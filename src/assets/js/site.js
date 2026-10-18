// Freek in Shanghai: the one script for the whole site. No dependencies. Each module starts from markup it finds
// (data attributes), so a page without that markup simply skips it. Interface text comes from #ui-text, which
// the base layout fills from src/_data/site.js.

const ui = JSON.parse(document.getElementById('ui-text')?.textContent || '{}');

function onScroll(callback) {
  let queued = false;
  const run = () => {
    queued = false;
    callback(window.scrollY);
  };
  window.addEventListener(
    'scroll',
    () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(run);
      }
    },
    { passive: true },
  );
  run();
}

function icon(name) {
  return `<svg class="icon" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;
}

function button(className, iconName, label) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `control-button ${className}`;
  el.innerHTML = icon(iconName);
  el.setAttribute('aria-label', label);
  return el;
}

/** Calls onPrev/onNext for a horizontal touch swipe on el. Returns a check for "this click ended a swipe". */
function swipe(el, onPrev, onNext) {
  let start = null;
  let swiped = false;
  el.addEventListener('pointerdown', e => {
    start = e.pointerType === 'mouse' ? null : { x: e.clientX, y: e.clientY };
    swiped = false;
  });
  el.addEventListener('pointerup', e => {
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    start = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      swiped = true;
      (dx > 0 ? onPrev : onNext)();
    }
  });
  return () => swiped;
}

// --- Header: solid once the page scrolls (over the hero it starts transparent) ------------------------------------

function initHeader() {
  const header = document.querySelector('[data-header]');
  if (header) onScroll(y => header.classList.toggle('is-scrolled', y > 0));

  const heroText = document.querySelector('[data-hero-text]');
  if (heroText) onScroll(y => (heroText.style.opacity = String(Math.max(0, Math.min(1, 1 - (y - 100) / 300)))));
}

// --- Mobile menu -------------------------------------------------------------------------------------------------

function initMenu() {
  const toggle = document.querySelector('[data-menu-toggle]');
  const nav = toggle && document.getElementById(toggle.getAttribute('aria-controls'));
  if (!nav) return;

  const setOpen = open => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) {
      setOpen(false);
      toggle.focus();
    }
  });
  window.matchMedia('(min-width: 1025px)').addEventListener('change', e => e.matches && setOpen(false));
}

// --- Masonry: each card goes into the shortest column, in reading order -----------------------------------------

function initMasonry() {
  for (const grid of document.querySelectorAll('[data-masonry]')) {
    const cards = [...grid.children];
    const layout = () => {
      grid.classList.remove('is-masonry');
      grid.style.height = '';
      cards.forEach(card => (card.style.left = card.style.top = ''));

      const padding = 15;
      const cardWidth = cards[0].offsetWidth + 2 * padding;
      const columns = Math.floor(grid.clientWidth / cardWidth);
      if (columns < 2) return;

      const heights = new Array(columns).fill(padding);
      const offset = (grid.clientWidth - columns * cardWidth) / 2;
      grid.classList.add('is-masonry');
      for (const card of cards) {
        const column = heights.indexOf(Math.min(...heights));
        card.style.left = `${offset + column * cardWidth}px`;
        card.style.top = `${heights[column]}px`;
        heights[column] += card.offsetHeight + 2 * padding;
      }
      grid.style.height = `${Math.max(...heights) + padding}px`;
    };

    let timer;
    window.addEventListener('resize', () => {
      clearTimeout(timer);
      timer = setTimeout(layout, 100);
    });
    document.fonts?.ready.then(layout);
    layout();
  }
}

// --- Lightbox: one full-size photo at a time ---------------------------------------------------------------------

const lightbox = (() => {
  let dialog, image, caption, counter, items, index, opener;

  function build() {
    dialog = document.createElement('dialog');
    dialog.className = 'lightbox';
    dialog.setAttribute('aria-label', ui.photoViewer ?? '');
    dialog.innerHTML = `<figure class="lightbox-figure"><img class="lightbox-image" alt=""><figcaption class="lightbox-caption"></figcaption></figure>
      <p class="slideshow-counter" aria-live="polite"></p>`;
    image = dialog.querySelector('img');
    caption = dialog.querySelector('figcaption');
    counter = dialog.querySelector('.slideshow-counter');

    const close = button('lightbox-close', 'close', ui.close ?? '');
    const prev = button('lightbox-prev', 'prev', ui.previousPhoto ?? '');
    const next = button('lightbox-next', 'next', ui.nextPhoto ?? '');
    close.addEventListener('click', () => dialog.close());
    prev.addEventListener('click', () => show(index - 1));
    next.addEventListener('click', () => show(index + 1));
    dialog.append(close, prev, next);

    // A click on the dark area around the photo closes the viewer.
    dialog.addEventListener('click', e => {
      if (e.target === dialog || e.target.classList.contains('lightbox-figure')) dialog.close();
    });
    dialog.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') show(index - 1);
      if (e.key === 'ArrowRight') show(index + 1);
    });
    dialog.addEventListener('close', () => {
      image.removeAttribute('src');
      opener?.focus();
    });
    swipe(dialog, () => show(index - 1), () => show(index + 1));
    document.body.append(dialog);
  }

  function show(i) {
    index = (i + items.length) % items.length;
    const item = items[index];
    image.src = item.src;
    caption.textContent = item.caption;
    counter.textContent = `${index + 1} / ${items.length}`;
    const single = items.length === 1;
    dialog.querySelectorAll('.lightbox-prev, .lightbox-next, .slideshow-counter').forEach(el => (el.hidden = single));
    for (const n of [index - 1, index + 1]) {
      if (!single) new Image().src = items[(n + items.length) % items.length].src;
    }
  }

  return {
    open(list, i, from) {
      if (!dialog) build();
      items = list;
      opener = from;
      show(i);
      dialog.showModal();
    },
  };
})();

// --- Slideshows: one photo at a time, only the nearby photos load ------------------------------------------------

function initSlideshows() {
  for (const show of document.querySelectorAll('[data-slideshow]')) {
    const slides = [...show.querySelectorAll('.slide')];
    const items = slides.map(slide => ({
      src: slide.querySelector('a').href,
      caption: slide.querySelector('figcaption')?.textContent ?? '',
    }));
    let index = 0;

    show.setAttribute('role', 'region');
    show.setAttribute('aria-label', ui.slideshow ?? '');

    const controls = document.createElement('div');
    controls.className = 'slideshow-controls';
    const prev = button('slideshow-prev', 'prev', ui.previousPhoto ?? '');
    const next = button('slideshow-next', 'next', ui.nextPhoto ?? '');
    const open = button('slideshow-open', 'expand', ui.openPhoto ?? '');
    const counter = document.createElement('span');
    counter.className = 'slideshow-counter';
    counter.setAttribute('aria-live', 'polite');
    controls.append(prev, counter, next, open);
    show.append(controls);

    const go = i => {
      slides[index].classList.remove('is-active');
      index = (i + slides.length) % slides.length;
      slides[index].classList.add('is-active');
      counter.textContent = `${index + 1} / ${slides.length}`;
      // Fetch the neighbours now, so the next click shows a photo that is already loaded.
      for (const n of [index - 1, index + 1]) {
        slides[(n + slides.length) % slides.length].querySelector('img').loading = 'eager';
      }
    };

    prev.addEventListener('click', () => go(index - 1));
    next.addEventListener('click', () => go(index + 1));
    open.addEventListener('click', () => lightbox.open(items, index, open));
    show.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') go(index - 1);
      if (e.key === 'ArrowRight') go(index + 1);
    });
    const endedSwipe = swipe(show, () => go(index - 1), () => go(index + 1));
    slides.forEach((slide, i) =>
      slide.querySelector('a').addEventListener('click', e => {
        e.preventDefault();
        if (!endedSwipe()) lightbox.open(items, i, open);
      }),
    );

    // Start loading the neighbours only once the slideshow comes near the screen.
    slides[0].classList.add('is-active');
    counter.textContent = `1 / ${slides.length}`;
    new IntersectionObserver((entries, observer) => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer.disconnect();
        go(0);
      }
    }, { rootMargin: '200px' }).observe(show);
  }
}

// --- Single photos in posts that link to their full-size file ----------------------------------------------------

function initPhotoLinks() {
  const selector = '.entry-content a[href$=".jpg"], .entry-content a[href$=".png"], .entry-content a[href$=".gif"]';
  for (const link of document.querySelectorAll(selector)) {
    if (link.closest('[data-slideshow]') || !link.querySelector('img')) continue;
    const caption = link.closest('figure')?.querySelector('figcaption')?.textContent ?? '';
    link.addEventListener('click', e => {
      e.preventDefault();
      lightbox.open([{ src: link.href, caption }], 0, link);
    });
  }
}

initHeader();
initMenu();
initMasonry();
initSlideshows();
initPhotoLinks();
