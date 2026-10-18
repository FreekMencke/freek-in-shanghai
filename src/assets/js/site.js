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
    // The photo roll scrolls sideways itself.
    const own = e.pointerType !== 'mouse' && !e.target.closest('.photo-roll');
    start = own ? { x: e.clientX, y: e.clientY } : null;
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

// --- Language link: remember the pick, so the redirect in the page head follows it from now on ------------------

function initLanguageLink() {
  document.querySelector('.lang-switch a')?.addEventListener('click', e => {
    try {
      localStorage.setItem('lang', e.currentTarget.lang);
    } catch {
      // No storage (private window, blocked site data): the link still works, the pick just isn't kept.
    }
  });
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

// --- Photo roll: thumbnails under a slideshow and in the viewer -----------------------------------------------------

/** The smallest candidate in an image's srcset: for slideshow photos, the thumbnail the build adds there. */
function thumbnailOf(img) {
  const candidates = img.getAttribute('srcset').split(',').map(c => c.trim().split(/\s+/));
  return candidates.sort((a, b) => parseFloat(a[1]) - parseFloat(b[1]))[0][0];
}

/**
 * A scrolling row of thumbnails, one per photo; a click calls pick(i). mark(i) highlights photo i and scrolls it to
 * the middle of the row. One tab stop: the current thumbnail; the arrow keys of the slideshow or viewer move it.
 */
function photoRoll(items, pick) {
  const roll = document.createElement('div');
  roll.className = 'photo-roll';
  roll.setAttribute('role', 'group');
  roll.setAttribute('aria-label', ui.photoRoll ?? '');
  // Thumbnails load once the row comes near the screen, and then as they come near its visible part. Not
  // loading="lazy": in a sideways scroller, browsers load hundreds of thumbnails that are far out of view.
  const loader = new IntersectionObserver(
    entries => {
      for (const { isIntersecting, target } of entries) {
        if (!isIntersecting) continue;
        loader.unobserve(target);
        target.src = target.dataset.src;
      }
    },
    { root: roll, rootMargin: '0px 50%' },
  );
  const thumbs = items.map((item, i) => {
    const thumb = document.createElement('button');
    thumb.type = 'button';
    thumb.className = 'photo-roll-thumb';
    thumb.tabIndex = -1;
    thumb.setAttribute('aria-label', (ui.photoNumber ?? '{n}').replace('{n}', i + 1));
    const img = document.createElement('img');
    img.alt = '';
    img.decoding = 'async';
    img.dataset.src = item.thumb;
    thumb.append(img);
    thumb.addEventListener('click', () => pick(i));
    return thumb;
  });
  roll.append(...thumbs);
  new IntersectionObserver(
    (entries, observer) => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      for (const img of roll.querySelectorAll('img')) loader.observe(img);
    },
    { rootMargin: '200px' },
  ).observe(roll);
  roll.addEventListener('keydown', e => {
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      pick(e.key === 'Home' ? 0 : items.length - 1);
    }
  });

  let current = null;
  // Not scrollIntoView: that would scroll the page too.
  const center = jump => {
    const left = current.offsetLeft - (roll.clientWidth - current.offsetWidth) / 2;
    roll.scrollTo({ left, behavior: jump ? 'instant' : 'auto' });
  };
  const mark = (i, { jump = false } = {}) => {
    const hadFocus = roll.contains(document.activeElement);
    if (current) {
      current.removeAttribute('aria-current');
      current.tabIndex = -1;
    }
    current = thumbs[i];
    current.setAttribute('aria-current', 'true');
    current.tabIndex = 0;
    if (hadFocus) current.focus({ preventScroll: true });
    center(jump);
  };
  // A new width (a phone turned sideways, the viewer opening) moves the current photo off-centre.
  new ResizeObserver(() => current && center(true)).observe(roll);
  return { roll, mark };
}

// --- Lightbox: one full-size photo at a time ---------------------------------------------------------------------

const lightbox = (() => {
  let dialog, image, caption, counter, items, index, opener, onChange, roll;

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
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault(); // or the photo roll scrolls as well
        show(index + (e.key === 'ArrowLeft' ? -1 : 1));
      }
    });
    dialog.addEventListener('close', () => {
      image.removeAttribute('src');
      opener?.focus();
    });
    swipe(dialog, () => show(index - 1), () => show(index + 1));
    document.body.append(dialog);
  }

  function show(i, { jump = false } = {}) {
    index = (i + items.length) % items.length;
    roll?.mark(index, { jump });
    onChange?.(index);
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
    /** Shows photo i of list; onChange(i) hears which photo is shown, so a slideshow can follow along. */
    open(list, i, from, change) {
      if (!dialog) build();
      if (list !== items) {
        roll?.roll.remove();
        roll = list.length > 1 ? photoRoll(list, n => show(n)) : null;
        if (roll) dialog.append(roll.roll);
        dialog.classList.toggle('has-roll', Boolean(roll));
      }
      items = list;
      opener = from;
      onChange = change;
      dialog.showModal();
      show(i, { jump: true });
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
      thumb: thumbnailOf(slide.querySelector('img')),
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
    const { roll, mark } = photoRoll(items, i => go(i));
    show.append(controls, roll);

    const go = i => {
      slides[index].classList.remove('is-active');
      index = (i + slides.length) % slides.length;
      slides[index].classList.add('is-active');
      counter.textContent = `${index + 1} / ${slides.length}`;
      mark(index);
      // Fetch the neighbours now, so the next click shows a photo that is already loaded.
      for (const n of [index - 1, index + 1]) {
        slides[(n + slides.length) % slides.length].querySelector('img').loading = 'eager';
      }
    };

    prev.addEventListener('click', () => go(index - 1));
    next.addEventListener('click', () => go(index + 1));
    open.addEventListener('click', () => lightbox.open(items, index, open, go));
    show.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault(); // or the photo roll scrolls as well
        go(index + (e.key === 'ArrowLeft' ? -1 : 1));
      }
    });
    const endedSwipe = swipe(show, () => go(index - 1), () => go(index + 1));
    slides.forEach((slide, i) =>
      slide.querySelector('a').addEventListener('click', e => {
        e.preventDefault();
        if (!endedSwipe()) lightbox.open(items, i, open, go);
      }),
    );

    // Start loading the neighbours only once the slideshow comes near the screen.
    slides[0].classList.add('is-active');
    counter.textContent = `1 / ${slides.length}`;
    mark(0, { jump: true });
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
initLanguageLink();
initMasonry();
initSlideshows();
initPhotoLinks();
