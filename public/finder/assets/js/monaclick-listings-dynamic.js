(() => {
  const path = window.location.pathname;
  if (!path.startsWith('/listings')) return;

  const moduleFromPath = path.split('/')[2] || 'contractors';
  const allowedModules = new Set(['contractors', 'real-estate', 'cars', 'restaurants']);
  const selectedModule = allowedModules.has(moduleFromPath) ? moduleFromPath : 'contractors';

  const normalizeListingsDropdown = () => {
    const moduleItems = [
      { href: '/listings/contractors', label: 'Contractors' },
      { href: '/listings/real-estate', label: 'Real Estate' },
      { href: '/listings/cars', label: 'Cars' },
      { href: '/listings/restaurants', label: 'Restaurants' },
    ];

    const listingToggles = Array.from(document.querySelectorAll('a.nav-link.dropdown-toggle'))
      .filter((link) => (link.textContent || '').trim().toLowerCase() === 'listings');

    listingToggles.forEach((toggle) => {
      const menu = toggle.nextElementSibling;
      if (!menu || !menu.classList.contains('dropdown-menu')) return;
      menu.innerHTML = moduleItems
        .map((item) => `<li><a class="dropdown-item" href="${item.href}">${item.label}</a></li>`)
        .join('');
    });
  };
  normalizeListingsDropdown();

  const cleanSearchTerm = (value) =>
    String(value || '').includes('#!')
      ? ''
      : String(value || '')
        .replace(/#/g, ' ')
        .trim();

  const escapeHtml = (value) =>
    String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');

  const slugify = (value) =>
    String(value ?? '')
      .trim()
      .toLowerCase()
      .replaceAll('&', ' and ')
      .replaceAll(/[^a-z0-9]+/g, '-')
      .replaceAll(/-+/g, '-')
      .replaceAll(/^-|-$/g, '');

  const normalizeListingType = (value) => {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return 'rent';
    if (raw.includes('sale')) return 'sale';
    if (raw.includes('rent')) return 'rent';
    if (raw === 'sell') return 'sale';
    return raw === 'sale' ? 'sale' : 'rent';
  };

  const moduleConfig = (() => {
    if (selectedModule === 'contractors' || selectedModule === 'restaurants') {
      return {
        listContainer: document.querySelector('.col-lg-9 .vstack.gap-4'),
        resultsText: document.querySelector('.col-lg-9 .fs-sm.text-nowrap'),
        paginationNav: document.querySelector('.col-lg-9 nav[aria-label="Listings pagination"]'),
        // Contractors sidebar "Project type > Search" is only for filtering category checkboxes.
        // It should not map to API q/title search.
        searchInput: null,
        citySelect: document.querySelector('select[aria-label="Car location select"]'),
        categoryList: document.querySelector('.project-list'),
        sortSelect: document.querySelector('.col-lg-9 .position-relative.ms-auto select'),
        clearAllLink: document.querySelector('.col-lg-9 a.nav-link.fs-xs.text-decoration-underline'),
        activePillsWrap: document.querySelector('.col-lg-9 .w-100.pb-3.overflow-x-auto .d-flex.gap-2'),
        gridMode: 'vstack',
      };
    }

    if (selectedModule === 'cars') {
      const resultsText = document.querySelector('.col-lg-9 .fs-sm.text-nowrap');
      return {
        listContainer: document.querySelector('.col-lg-9 .row.row-cols-1.row-cols-sm-2.row-cols-md-3.row-cols-lg-2.row-cols-xl-3.g-4.g-sm-3.g-lg-4'),
        resultsText,
        paginationNav: document.querySelector('.col-lg-9 nav[aria-label="Listings pagination"]'),
        searchInput: null,
        citySelect: document.querySelector('select[aria-label="Car location select"]'),
        categoryList: document.querySelector('aside .offcanvas-body [data-simplebar] .d-flex.flex-column.gap-2'),
        sortSelect: document.querySelector('.col-lg-9 .position-relative select'),
        clearAllLink: document.querySelector('a.nav-link.fs-xs.text-decoration-underline.text-nowrap.p-0'),
        activePillsWrap: document.querySelector('.w-100.pb-3.overflow-x-auto .d-flex.gap-2'),
        gridMode: 'cols',
      };
    }

    if (selectedModule === 'real-estate') {
      return {
        listContainer: document.querySelector('.listings-section .row.row-cols-1.row-cols-sm-2.g-4'),
        resultsText: document.querySelector('.listings-section .fs-sm.text-nowrap'),
        paginationNav: document.querySelector('.listings-section nav[aria-label="Listings pagination"]'),
        searchInput: document.querySelector('.listings-section input[type="search"]'),
        citySelect: null,
        categoryList: null,
        sortSelect: document.querySelector('.listings-section .position-relative.ms-auto select'),
        clearAllLink: null,
        activePillsWrap: null,
        gridMode: 'cols',
      };
    }

    return {
      listContainer: document.querySelector('section.container.pb-2.pb-sm-3.pb-md-4.pb-lg-5.mb-xxl-3 .row.row-cols-1.row-cols-sm-2.row-cols-lg-3.g-4'),
      resultsText: document.querySelector('.d-flex.align-items-center.gap-4.pb-3.me-n2 .fs-sm.text-nowrap'),
      paginationNav: document.querySelector('nav[aria-label="Listings pagination"]'),
      searchInput: null,
      citySelect: null,
      categoryList: null,
      sortSelect: document.querySelector('.d-flex.align-items-center.gap-4.pb-3.me-n2 .position-relative select'),
      eventsCategorySelect: document.querySelector('select[aria-label="Category select"]'),
      eventsCitySelect: document.querySelector('select[aria-label="Location select"]'),
      eventsPriceSelect: document.querySelector('select[aria-label="Price select"]'),
      eventsDateInput: document.querySelector('input[data-datepicker]'),
      eventsSubcategoryLinks: Array.from(document.querySelectorAll('section.container.mb-2 .nav.nav-pills a.nav-link')),
      clearAllLink: null,
      activePillsWrap: null,
      gridMode: 'cols',
    };
  })();

  const {
    listContainer,
    resultsText,
    paginationNav,
    searchInput,
    citySelect,
    categoryList,
    sortSelect,
    eventsCategorySelect,
    eventsCitySelect,
    eventsPriceSelect,
    eventsDateInput,
    eventsSubcategoryLinks,
    clearAllLink,
    activePillsWrap,
    gridMode,
  } = moduleConfig;

  if (!listContainer) return;

  // Prevent template placeholder cards from flashing before the API response replaces them.
  try {
    listContainer.style.opacity = '0';
    listContainer.style.transition = 'opacity 140ms ease';
    listContainer.innerHTML = '';
  } catch (_) {
    // ignore
  }

  const ratingChecks = Array.from(document.querySelectorAll('input[id^="star-"]'));
  const availabilityCheck = document.getElementById('now');
  const budgetButtons = Array.from(document.querySelectorAll('[data-budget-max]'));
  const budgetSliders = Array.from(document.querySelectorAll('input[type="range"][data-budget-slider]'));
  const priceWrap = document.querySelector('[data-price-wrap]');
  const priceMinSlider = priceWrap ? priceWrap.querySelector('input[type="range"][data-price-min-slider]') : null;
  const priceMaxSlider = priceWrap ? priceWrap.querySelector('input[type="range"][data-price-max-slider]') : null;
  const priceMinInput = priceWrap ? priceWrap.querySelector('input[type="number"][data-price-min-input]') : null;
  const priceMaxInput = priceWrap ? priceWrap.querySelector('input[type="number"][data-price-max-input]') : null;
  const priceLabel = priceWrap ? priceWrap.querySelector('[data-price-label]') : null;
  const listingTypeSelects = selectedModule === 'real-estate'
    ? Array.from(document.querySelectorAll('select[aria-label="Rent or sale select"]'))
    : [];
  const priceMinInputs = selectedModule === 'real-estate'
    ? Array.from(document.querySelectorAll('input[data-price-min]'))
    : [];
  const priceMaxInputs = selectedModule === 'real-estate'
    ? Array.from(document.querySelectorAll('input[data-price-max]'))
    : [];
  const rentOnlyBlocks = selectedModule === 'real-estate'
    ? Array.from(document.querySelectorAll('[data-rent-only]'))
    : [];
  const saleOnlyBlocks = selectedModule === 'real-estate'
    ? Array.from(document.querySelectorAll('[data-sale-only]'))
    : [];
  const newCarsBtn = selectedModule === 'cars'
    ? Array.from(document.querySelectorAll('button, a')).find((el) => (el.textContent || '').trim().toLowerCase() === 'new cars')
    : null;
  const usedCarsBtn = selectedModule === 'cars'
    ? Array.from(document.querySelectorAll('button, a')).find((el) => (el.textContent || '').trim().toLowerCase() === 'used cars')
    : null;

  const getStateFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const budgetMax = Number.parseInt(params.get('budget_max') || '', 10);
    const priceMin = Number.parseInt(params.get('price_min') || '', 10);
    const priceMax = Number.parseInt(params.get('price_max') || '', 10);
    const listingTypeRaw = selectedModule === 'real-estate'
      ? (params.get('listing_type') || (listingTypeSelects[0]?.value || listingTypeSelects[0]?.options?.[listingTypeSelects[0]?.selectedIndex || 0]?.textContent || ''))
      : '';
    return {
      q: cleanSearchTerm(params.get('q') || ''),
      city: params.get('city') || '',
      category: params.get('category') || '',
      sort: params.get('sort') || '',
      ratings: (params.get('ratings') || '')
        .split(',')
        .map((v) => Number.parseInt(v, 10))
        .filter((v) => Number.isInteger(v) && v >= 1 && v <= 5),
      budget_max: Number.isInteger(budgetMax) && budgetMax > 0 ? budgetMax : 0,
      listing_type: selectedModule === 'real-estate'
        ? normalizeListingType(listingTypeRaw || '')
        : '',
      price_min: Number.isInteger(priceMin) && priceMin > 0 ? priceMin : 0,
      price_max: Number.isInteger(priceMax) && priceMax > 0 ? priceMax : 0,
      availability: params.get('availability') === '1',
      stock: selectedModule === 'cars' ? (params.get('stock') || 'used') : '',
      page: Number.parseInt(params.get('page') || '1', 10) || 1,
    };
  };

  let state = getStateFromUrl();
  if (selectedModule === 'real-estate') {
    state.listing_type = state.listing_type || 'rent';
    state.budget_max = 0;
  }
  let lastFilters = { categories: [], cities: [] };

  const resolveSlugFromFilters = (items, rawValue) => {
    const raw = String(rawValue || '').trim();
    if (!raw || !Array.isArray(items)) return '';
    const normalized = slugify(raw);
    const found = items.find((item) => {
      const slug = slugify(item.slug || '');
      const name = slugify(item.name || '');
      return normalized === slug || normalized === name;
    });
    return found?.slug || '';
  };

  const budgetMaxFromEventsPriceValue = (value) => {
    const raw = String(value || '').toLowerCase();
    if (!raw) return 0;
    if (raw.includes('free') || raw.includes('up to $25')) return 500;
    if (raw.includes('$25 - $50') || raw.includes('$50 - $100')) return 1000;
    if (raw.includes('$100 - $200')) return 2000;
    if (raw.includes('over $200')) return 5000;
    return 0;
  };

  const syncEventsPriceSelectFromState = () => {
    if (!eventsPriceSelect) return;
    if (!state.budget_max) {
      eventsPriceSelect.value = '';
      return;
    }

    const desiredLabel = {
      500: 'Up to $25',
      1000: '$25 - $50',
      2000: '$100 - $200',
      5000: 'Over $200',
    }[state.budget_max] || '';

    if (!desiredLabel) return;

    const option = Array.from(eventsPriceSelect.options).find((opt) => String(opt.value || '').trim() === desiredLabel);
    eventsPriceSelect.value = option ? option.value : '';
  };

  const repopulateSelectFromFilters = (select, items, placeholder) => {
    if (!select || !Array.isArray(items)) return;
    const options = [`<option value="">${escapeHtml(placeholder)}</option>`];
    items.forEach((item) => {
      options.push(`<option value="${escapeHtml(item.slug)}">${escapeHtml(item.name)}</option>`);
    });
    select.innerHTML = options.join('');
  };

  const restaurantFallbackItems = () => [
    {
      title: 'Saffron Grill House',
      slug: 'saffron-grill-house',
      module: 'restaurants',
      is_demo: true,
      price: '$45 avg',
      rating: 4.8,
      reviews_count: 126,
      excerpt: 'Premium BBQ and fusion dining with rooftop seating.',
      image_url: '/finder/assets/img/home/city-guide/restaurants/01.png',
      city: { name: 'Chicago', slug: 'chicago' },
      category: { name: 'BBQ', slug: 'bbq' },
    },
    {
      title: 'Olive & Thyme Bistro',
      slug: 'olive-thyme-bistro',
      module: 'restaurants',
      is_demo: true,
      price: '$32 avg',
      rating: 4.6,
      reviews_count: 94,
      excerpt: 'Mediterranean menu, handcrafted drinks, family-friendly.',
      image_url: '/finder/assets/img/home/city-guide/restaurants/03-light.png',
      city: { name: 'Dallas', slug: 'dallas' },
      category: { name: 'Mediterranean', slug: 'mediterranean' },
    },
    {
      title: 'Tokyo Ember Sushi',
      slug: 'tokyo-ember-sushi',
      module: 'restaurants',
      is_demo: true,
      price: '$52 avg',
      rating: 4.9,
      reviews_count: 201,
      excerpt: 'Signature omakase and premium sushi platters.',
      image_url: '/finder/assets/img/home/city-guide/restaurants/06.png',
      city: { name: 'New York', slug: 'new-york' },
      category: { name: 'Sushi', slug: 'sushi' },
    },
    {
      title: 'Stone Oven Pizza Co.',
      slug: 'stone-oven-pizza-co',
      module: 'restaurants',
      is_demo: true,
      price: '$27 avg',
      rating: 4.5,
      reviews_count: 78,
      excerpt: 'Wood-fired pizzas and fast pickup for busy evenings.',
      image_url: '/finder/assets/img/home/city-guide/restaurants/08.png',
      city: { name: 'Boston', slug: 'boston' },
      category: { name: 'Pizza', slug: 'pizza' },
    },
  ];

  const applyStateToUrl = () => {
    const params = new URLSearchParams();
    state.q = cleanSearchTerm(state.q);
    if (state.q) params.set('q', state.q);
    if (state.city) params.set('city', state.city);
    if (state.category) params.set('category', state.category);
    if (state.sort) params.set('sort', state.sort);
    if (state.ratings.length) params.set('ratings', state.ratings.join(','));
    if (state.budget_max) params.set('budget_max', String(state.budget_max));
    if (state.price_min) params.set('price_min', String(state.price_min));
    if (state.price_max) params.set('price_max', String(state.price_max));
    if (selectedModule === 'real-estate') {
      params.set('listing_type', state.listing_type || 'rent');
    }
    if (state.availability) params.set('availability', '1');
    if (selectedModule === 'cars' && state.stock) params.set('stock', state.stock);
    if (state.page > 1) params.set('page', String(state.page));
    const qs = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
  };

  const buildPageUrl = (targetPage) => {
    const params = new URLSearchParams();
    const cleanQ = cleanSearchTerm(state.q);
    if (cleanQ) params.set('q', cleanQ);
    if (state.city) params.set('city', state.city);
    if (state.category) params.set('category', state.category);
    if (state.sort) params.set('sort', state.sort);
    if (state.ratings.length) params.set('ratings', state.ratings.join(','));
    if (state.budget_max) params.set('budget_max', String(state.budget_max));
    if (state.price_min) params.set('price_min', String(state.price_min));
    if (state.price_max) params.set('price_max', String(state.price_max));
    if (selectedModule === 'real-estate') {
      params.set('listing_type', state.listing_type || 'rent');
    }
    if (state.availability) params.set('availability', '1');
    if (selectedModule === 'cars' && state.stock) params.set('stock', state.stock);
    if (targetPage > 1) params.set('page', String(targetPage));
    const qs = params.toString();
    return `${window.location.pathname}${qs ? `?${qs}` : ''}`;
  };

  const detailUrl = (item) => {
    if (item?.is_demo) {
      return `/entry/${encodeURIComponent(item.module)}`;
    }
    return `/entry/${encodeURIComponent(item.module)}?slug=${encodeURIComponent(item.slug)}`;
  };

  const wireDeadPlaceholderLinks = () => {
    const target = `/listings/${selectedModule}`;
    document.querySelectorAll('a[href="#!"], a[href="#"]').forEach((link) => {
      const isUiToggle = link.hasAttribute('data-bs-toggle') || link.getAttribute('role') === 'button';
      if (isUiToggle) return;
      link.setAttribute('href', target);
    });
  };

  const restaurantCardImages = [
    '/finder/assets/img/monaclick/restaurants/user8.webp',
    '/finder/assets/img/monaclick/restaurants/user9.webp',
    '/finder/assets/img/monaclick/restaurants/user7.jpg',
    '/finder/assets/img/monaclick/restaurants/user4.jpg',
    '/finder/assets/img/monaclick/restaurants/user6.jpg',
    '/finder/assets/img/monaclick/restaurants/user3.jpg',
    '/finder/assets/img/monaclick/restaurants/user2.jpg',
    '/finder/assets/img/monaclick/restaurants/user1.jpg',
  ];

  const stableHash = (value) => {
    const input = String(value || '');
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
      hash = ((hash << 5) - hash) + input.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  };

  const listingImageForCard = (item) => {
    if (selectedModule !== 'restaurants') {
      return item.image_url || '/finder/assets/img/placeholders/preview-square.svg';
    }

    const key = item?.slug || item?.title || '';
    const index = stableHash(key) % restaurantCardImages.length;
    return restaurantCardImages[index];
  };

  const contractorCard = (item) => {
    const title = escapeHtml(item.title);
    const excerpt = escapeHtml(item.excerpt || '');
    const category = escapeHtml(item.category?.name || 'Category');
    const city = escapeHtml(item.city?.name || 'City');
    const price = escapeHtml(item.price || '');
    const image = escapeHtml(listingImageForCard(item));
    const rating = Number(item.rating || 0).toFixed(1);
    const reviews = Number(item.reviews_count || 0);
    const url = detailUrl(item);

    return `
      <article class="card hover-effect-opacity overflow-hidden">
        <div class="row g-0">
          <div class="col-sm-4 position-relative bg-body-tertiary" style="min-height: 220px">
            <a class="d-block w-100 h-100" href="${url}">
              <img src="${image}" class="position-absolute top-0 start-0 w-100 h-100 object-fit-cover" alt="${title}" onerror="this.onerror=null;this.src='/finder/assets/img/placeholders/preview-square.svg';">
            </a>
          </div>
          <div class="col-sm-8 d-flex p-3 p-sm-4" style="min-height: 255px">
            <div class="row flex-lg-nowrap g-0 position-relative pt-1 pt-sm-0 w-100">
              <div class="col-lg-8 pe-lg-4">
                <h3 class="h6 mb-2"><a class="hover-effect-underline stretched-link" href="${url}">${title}</a></h3>
                <div class="fs-sm mb-2 mb-lg-3"><span class="fw-medium text-dark-emphasis">${category}</span></div>
                <p class="fs-sm mb-0">${excerpt}</p>
              </div>
              <hr class="vr flex-shrink-0 d-none d-lg-block m-0">
              <div class="col-lg-4 d-flex flex-column pt-3 pt-lg-1 ps-lg-4">
                <ul class="list-unstyled pb-2 pb-lg-4 mb-3">
                  <li class="d-flex align-items-center gap-1"><i class="fi-star-filled text-warning"></i><span class="fs-sm text-secondary-emphasis">${rating}</span><span class="fs-xs text-body-secondary align-self-end">(${reviews})</span></li>
                  <li class="d-flex align-items-center gap-1 fs-sm"><i class="fi-map-pin"></i>${city}</li>
                </ul>
                <div class="fw-semibold mb-2">${price}</div>
                <a class="btn btn-outline-dark position-relative z-2 mt-auto" href="${url}">View</a>
              </div>
            </div>
          </div>
        </div>
      </article>
    `;
  };

  const carCard = (item) => {
    const title = escapeHtml(item.title);
    const city = escapeHtml(item.city?.name || 'City');
    const category = escapeHtml(item.category?.name || 'Category');
    const price = escapeHtml(item.price || '');
    const image = escapeHtml(item.image_url || '/finder/assets/img/placeholders/preview-square.svg');
    const url = detailUrl(item);
    const badges = [];
    const cond = String(item.details?.car?.condition || '').trim().toLowerCase();
    if (cond) {
      const label = cond.includes('new') ? 'New' : 'Used';
      badges.push(`<span class="badge text-bg-warning">${escapeHtml(label)}</span>`);
    }
    const hasVerified = Array.isArray(item.features)
      && item.features.some((f) => String(f || '').trim().toLowerCase().includes('verified'));
    if (hasVerified) {
      badges.unshift('<span class="badge text-bg-success">Verified</span>');
    }
    return `
      <div class="col">
        <article class="card h-100 hover-effect-scale bg-body-tertiary border-0">
          <div class="card-img-top position-relative overflow-hidden">
            ${badges.length ? `
              <div class="d-flex flex-column gap-2 align-items-start position-absolute top-0 start-0 z-1 pt-1 pt-sm-0 ps-1 ps-sm-0 mt-2 mt-sm-3 ms-2 ms-sm-3">
                ${badges.join('')}
              </div>
            ` : ''}
            <div class="ratio hover-effect-target bg-body-secondary" style="--fn-aspect-ratio: calc(204 / 306 * 100%)">
              <img src="${image}" alt="${title}" onerror="this.onerror=null;this.src='/finder/assets/img/placeholders/preview-square.svg';">
            </div>
          </div>
          <div class="card-body pb-3">
            <h3 class="h6 mb-2"><a class="hover-effect-underline stretched-link me-1" href="${url}">${title}</a></h3>
            <div class="h6 mb-0">${price}</div>
          </div>
          <div class="card-footer bg-transparent border-0 pt-0 pb-4">
            <div class="border-top pt-3">
              <div class="row row-cols-2 g-2 fs-sm">
                <div class="col d-flex align-items-center gap-2"><i class="fi-map-pin"></i>${city}</div>
                <div class="col d-flex align-items-center gap-2"><i class="fi-car"></i>${category}</div>
              </div>
            </div>
          </div>
        </article>
      </div>
    `;
  };

  const propertyCard = (item) => {
    const title = escapeHtml(item.title);
    const city = escapeHtml(item.city?.name || 'City');
    const price = escapeHtml(item.price || '');
    const image = escapeHtml(item.image_url || '/finder/assets/img/placeholders/preview-square.svg');
    const url = detailUrl(item);
    return `
      <div class="col">
        <article class="card hover-effect-opacity h-100">
          <div class="card-img-top position-relative bg-body-tertiary overflow-hidden">
            <a href="${url}" class="ratio d-block" style="--fn-aspect-ratio: calc(248 / 362 * 100%)">
              <img src="${image}" alt="${title}" onerror="this.onerror=null;this.src='/finder/assets/img/placeholders/preview-square.svg';">
            </a>
          </div>
          <div class="card-body p-3">
            <div class="h5 mb-2">${price}</div>
            <h3 class="fs-sm fw-normal text-body mb-2"><a class="stretched-link text-body" href="${url}">${title}</a></h3>
            <div class="h6 fs-sm mb-0">${city}</div>
          </div>
        </article>
      </div>
    `;
  };

  const eventCard = (item) => {
    const title = escapeHtml(item.title);
    const city = escapeHtml(item.city?.name || 'City');
    const price = escapeHtml(item.price || '');
    const image = escapeHtml(item.image_url || '/finder/assets/img/placeholders/preview-square.svg');
    const url = detailUrl(item);
    return `
      <div class="col">
        <article class="card h-100 hover-effect-scale hover-effect-opacity bg-body-tertiary border-0">
          <div class="bg-body-secondary rounded overflow-hidden">
            <a href="${url}" class="ratio hover-effect-target" style="--fn-aspect-ratio: calc(250 / 416 * 100%)">
              <img src="${image}" alt="${title}" onerror="this.onerror=null;this.src='/finder/assets/img/placeholders/preview-square.svg';">
            </a>
          </div>
          <div class="card-body">
            <h3 class="h5 pt-1 mb-2"><a class="hover-effect-underline stretched-link" href="${url}">${title}</a></h3>
            <div class="d-flex align-items-center fs-sm"><i class="fi-map-pin me-1"></i>${city}</div>
          </div>
          <div class="card-footer d-flex align-items-center justify-content-between gap-3 bg-transparent border-0 pt-0 pb-4">
            <div class="h5 text-info mb-0">${price}</div>
            <a class="btn btn-outline-dark position-relative z-2" href="${url}">View</a>
          </div>
        </article>
      </div>
    `;
  };

  const renderCards = (items) => {
    if (selectedModule === 'contractors' || selectedModule === 'restaurants') {
      listContainer.innerHTML = items.map(contractorCard).join('');
      listContainer.style.opacity = '1';
      return;
    }
    if (selectedModule === 'cars') {
      listContainer.innerHTML = items.map(carCard).join('');
      listContainer.style.opacity = '1';
      return;
    }
    if (selectedModule === 'real-estate') {
      listContainer.innerHTML = items.map(propertyCard).join('');
      listContainer.style.opacity = '1';
      return;
    }
    listContainer.innerHTML = items.map(eventCard).join('');
    listContainer.style.opacity = '1';
  };

  const ensureResultsNode = () => {
    if (resultsText) return resultsText;
    const sortBar = sortSelect?.closest('.d-flex');
    if (!sortBar) return null;
    const node = document.createElement('div');
    node.className = 'fs-sm text-nowrap';
    node.textContent = 'Showing 0 results';
    sortBar.prepend(node);
    return node;
  };

  const resultsNode = ensureResultsNode();

  const renderPagination = (currentPage, lastPage) => {
    if (!paginationNav) return;
    if (lastPage <= 1) {
      paginationNav.style.display = 'none';
      return;
    }

    const pages = [];
    for (let p = 1; p <= lastPage; p += 1) {
      pages.push(`
        <li class="page-item${p === currentPage ? ' active' : ''}"${p === currentPage ? ' aria-current="page"' : ''}>
          ${p === currentPage
            ? `<span class="page-link">${p}<span class="visually-hidden">(current)</span></span>`
            : `<a class="page-link" href="${buildPageUrl(p)}" data-page="${p}">${p}</a>`}
        </li>
      `);
    }
    const listClass = paginationNav.querySelector('.pagination')?.className || 'pagination pagination-lg';
    paginationNav.innerHTML = `<ul class="${listClass}">${pages.join('')}</ul>`;
    paginationNav.style.display = '';

    paginationNav.querySelectorAll('a[data-page]').forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        state.page = Number.parseInt(link.getAttribute('data-page') || '1', 10) || 1;
        applyStateToUrl();
        loadListings();
      });
    });
  };

  const renderActivePills = () => {
    if (!activePillsWrap) return;
    const pills = [];
    if (state.city) {
      const cityName = lastFilters.cities.find((city) => city.slug === state.city)?.name || state.city;
      pills.push(`<button type="button" class="btn btn-sm btn-secondary rounded-pill" data-pill="city"><i class="fi-close fs-sm me-1 ms-n1"></i>${escapeHtml(cityName)}</button>`);
    }
    if (state.category) {
      const categoryName = lastFilters.categories.find((cat) => cat.slug === state.category)?.name || state.category;
      pills.push(`<button type="button" class="btn btn-sm btn-secondary rounded-pill" data-pill="category"><i class="fi-close fs-sm me-1 ms-n1"></i>${escapeHtml(categoryName)}</button>`);
    }
    if (state.q) pills.push(`<button type="button" class="btn btn-sm btn-secondary rounded-pill" data-pill="q"><i class="fi-close fs-sm me-1 ms-n1"></i>${escapeHtml(state.q)}</button>`);
    if (state.budget_max) pills.push(`<button type="button" class="btn btn-sm btn-secondary rounded-pill" data-pill="budget_max"><i class="fi-close fs-sm me-1 ms-n1"></i>Budget ($${escapeHtml(state.budget_max)})</button>`);
    if (state.price_min || state.price_max) {
      const min = state.price_min || 0;
      const max = state.price_max || 0;
      const label = max ? `$${min} - $${max}` : `$${min}+`;
      pills.push(`<button type="button" class="btn btn-sm btn-secondary rounded-pill" data-pill="price"><i class="fi-close fs-sm me-1 ms-n1"></i>Price (${escapeHtml(label)})</button>`);
    }
    if (state.ratings.length) pills.push(`<button type="button" class="btn btn-sm btn-secondary rounded-pill" data-pill="ratings"><i class="fi-close fs-sm me-1 ms-n1"></i>Rating (${state.ratings.join('/')})</button>`);
    if (state.availability) pills.push('<button type="button" class="btn btn-sm btn-secondary rounded-pill" data-pill="availability"><i class="fi-close fs-sm me-1 ms-n1"></i>Available now</button>');

    activePillsWrap.innerHTML = pills.join('');
    activePillsWrap.querySelectorAll('button[data-pill]').forEach((button) => {
      button.addEventListener('click', () => {
        const type = button.getAttribute('data-pill');
        if (type === 'city') state.city = '';
        if (type === 'category') state.category = '';
        if (type === 'q') state.q = '';
        if (type === 'budget_max') state.budget_max = 0;
        if (type === 'price') { state.price_min = 0; state.price_max = 0; }
        if (type === 'ratings') state.ratings = [];
        if (type === 'availability') state.availability = false;
        state.page = 1;
        syncControlsFromState();
        applyStateToUrl();
        loadListings();
      });
    });
  };

  const renderCategoryFilter = (categories) => {
    if (!categoryList || !Array.isArray(categories) || !categories.length) return;
    categoryList.innerHTML = categories
      .map(
        (category) => `
          <div class="form-check mb-0">
            <input type="checkbox" class="form-check-input" id="cat-${escapeHtml(category.slug)}" value="${escapeHtml(category.slug)}"${state.category === category.slug ? ' checked' : ''}>
            <label for="cat-${escapeHtml(category.slug)}" class="form-check-label">${escapeHtml(category.name)}</label>
          </div>
        `
      )
      .join('');

    categoryList.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.addEventListener('change', () => {
        categoryList.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
          if (cb !== input) cb.checked = false;
        });
        state.category = input.checked ? input.value : '';
        state.page = 1;
        applyStateToUrl();
        loadListings();
      });
    });
  };

  const syncControlsFromState = () => {
    if (searchInput) searchInput.value = state.q || '';

    if (citySelect) {
      const selectedOption = Array.from(citySelect.options).find(
        (option) => slugify(option.value || option.textContent) === state.city
      );
      citySelect.value = selectedOption ? selectedOption.value : '';
    }

    if (categoryList) {
      categoryList.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
        cb.checked = cb.value === state.category;
      });
    }

    ratingChecks.forEach((input) => {
      const rating = Number.parseInt(input.id.replace('star-', ''), 10);
      input.checked = state.ratings.includes(rating);
    });
    budgetButtons.forEach((btn) => {
      const raw = (btn.getAttribute('data-budget-max') || '').trim();
      const value = raw === '' ? 0 : Number.parseInt(raw, 10);
      const active = (Number.isInteger(value) ? value : 0) === (state.budget_max || 0);
      btn.classList.toggle('active', active);
      btn.classList.toggle('btn-primary', active);
      btn.classList.toggle('btn-outline-secondary', !active);
    });
    budgetSliders.forEach((slider) => {
      const value = Number.isInteger(state.budget_max) ? state.budget_max : 0;
      slider.value = String(value || 0);
      const wrap = slider.closest('[data-budget-wrap]');
      const label = (wrap ? wrap.querySelector('[data-budget-label]') : null) || slider.parentElement?.querySelector?.('[data-budget-label]');
      if (label) label.textContent = value ? `$${value}` : 'Any';
    });

    if (priceWrap && priceMinSlider instanceof HTMLInputElement && priceMaxSlider instanceof HTMLInputElement) {
      const maxLimit = Number.parseInt(priceMaxSlider.max || '0', 10) || 0;
      const step = Number.parseInt(priceMaxSlider.step || priceMinSlider.step || '1', 10) || 1;
      const isAny = !state.price_min && !state.price_max;
      const desiredMin = isAny ? 0 : Math.max(0, Math.min(state.price_min || 0, maxLimit));
      const desiredMaxRaw = isAny ? maxLimit : (state.price_max || maxLimit);
      const desiredMax = Math.max(desiredMin, Math.min(desiredMaxRaw, maxLimit));

      priceMinSlider.value = String(desiredMin);
      priceMaxSlider.value = String(desiredMax);
      if (priceMinInput instanceof HTMLInputElement) {
        priceMinInput.step = String(step);
        priceMinInput.value = String(desiredMin);
      }
      if (priceMaxInput instanceof HTMLInputElement) {
        priceMaxInput.step = String(step);
        priceMaxInput.value = String(desiredMax);
      }
      if (priceLabel) {
        priceLabel.textContent = isAny ? 'Any' : `$${desiredMin} - $${desiredMax}`;
      }
    }
    if (availabilityCheck) {
      availabilityCheck.checked = !!state.availability;
    }
    if (selectedModule === 'cars') {
      if (newCarsBtn) newCarsBtn.classList.toggle('active', state.stock === 'new');
      if (usedCarsBtn) usedCarsBtn.classList.toggle('active', state.stock !== 'new');
    }

    if (selectedModule === 'real-estate') {
      const listingType = state.listing_type || 'rent';
      const desired = listingType === 'sale' ? 'For sale' : 'For rent';
      listingTypeSelects.forEach((select) => {
        const option = Array.from(select.options).find((opt) => String(opt.value || opt.textContent).trim() === desired);
        if (option) select.value = option.value;
      });
      const rentMode = listingType !== 'sale';
      rentOnlyBlocks.forEach((el) => el.classList.toggle('d-none', !rentMode));
      saleOnlyBlocks.forEach((el) => el.classList.toggle('d-none', rentMode));
      priceMinInputs.forEach((input) => { input.value = state.price_min ? String(state.price_min) : ''; });
      priceMaxInputs.forEach((input) => { input.value = state.price_max ? String(state.price_max) : ''; });
    }

    if (selectedModule === 'events') {
      if (eventsCategorySelect) {
        const categoryMatch = Array.from(eventsCategorySelect.options).find((option) => {
          const optionSlug = resolveSlugFromFilters(lastFilters.categories, option.value || option.textContent);
          return optionSlug === state.category;
        });
        eventsCategorySelect.value = categoryMatch ? categoryMatch.value : '';
      }

      if (eventsCitySelect) {
        const cityMatch = Array.from(eventsCitySelect.options).find((option) => {
          const optionSlug = resolveSlugFromFilters(lastFilters.cities, option.value || option.textContent);
          return optionSlug === state.city;
        });
        eventsCitySelect.value = cityMatch ? cityMatch.value : '';
      }

      syncEventsPriceSelectFromState();

      if (Array.isArray(eventsSubcategoryLinks) && eventsSubcategoryLinks.length) {
        eventsSubcategoryLinks.forEach((link) => {
          const label = (link.textContent || '').trim();
          const isAll = label.toLowerCase() === 'all';
          const linkCategorySlug = resolveSlugFromFilters(lastFilters.categories, label);
          const active = isAll ? !state.category : linkCategorySlug === state.category;
          link.classList.toggle('active', active);
          if (active) link.setAttribute('aria-current', 'page');
          else link.removeAttribute('aria-current');
        });
      }
    }
  };

  const loadListings = () => {
    state.q = cleanSearchTerm(state.q);

    const apiQuery = new URLSearchParams({
      module: selectedModule,
      page: String(state.page || 1),
      per_page: selectedModule === 'events' ? '12' : '8',
    });
    if (state.q) apiQuery.set('q', state.q);
    if (state.city) apiQuery.set('city', state.city);
    if (state.category) apiQuery.set('category', state.category);
    if (state.sort) apiQuery.set('sort', state.sort);
    if (state.ratings.length) apiQuery.set('ratings', state.ratings.join(','));
    if (selectedModule === 'real-estate') {
      apiQuery.set('listing_type', state.listing_type || 'rent');
    }
    if (state.price_min) apiQuery.set('price_min', String(state.price_min));
    if (state.price_max) apiQuery.set('price_max', String(state.price_max));
    if (!state.price_min && !state.price_max && state.budget_max) {
      apiQuery.set('budget_max', String(state.budget_max));
    }
    if (state.availability) apiQuery.set('availability', '1');
    if (selectedModule === 'cars' && state.stock) apiQuery.set('stock', state.stock);

    fetch(`/api/monaclick/listings?${apiQuery.toString()}`)
      .then((res) => res.json())
      .then((payload) => {
        let items = Array.isArray(payload?.data) ? payload.data : [];
        const meta = payload?.meta || { total: 0, current_page: 1, last_page: 1 };
        const filters = payload?.filters || {};
        lastFilters = {
          categories: Array.isArray(filters.categories) ? filters.categories : [],
          cities: Array.isArray(filters.cities) ? filters.cities : [],
        };

        if (selectedModule === 'events') {
          repopulateSelectFromFilters(eventsCategorySelect, lastFilters.categories, 'Category');
          repopulateSelectFromFilters(eventsCitySelect, lastFilters.cities, 'Location');
          syncControlsFromState();
        }

        if (selectedModule === 'restaurants' && !items.length) {
          items = restaurantFallbackItems();
        }

        if (resultsNode) {
          const total = selectedModule === 'restaurants' && meta.total === 0 ? items.length : meta.total;
          resultsNode.textContent = `Showing ${total} results`;
        }
        renderCategoryFilter(lastFilters.categories);
        renderActivePills();

        if (!items.length) {
          if (gridMode === 'vstack') {
            listContainer.innerHTML = '<div class="alert alert-info mb-0">No listings found for selected filters.</div>';
          } else {
            listContainer.innerHTML = '<div class="col-12"><div class="alert alert-info mb-0">No listings found for selected filters.</div></div>';
          }
          listContainer.style.opacity = '1';
          renderPagination(1, 1);
          return;
        }

        renderCards(items);
        renderPagination(meta.current_page, meta.last_page);
      })
      .catch(() => {
        if (gridMode === 'vstack') {
          listContainer.innerHTML = '<div class="alert alert-danger mb-0">Unable to load listings right now.</div>';
        } else {
          listContainer.innerHTML = '<div class="col-12"><div class="alert alert-danger mb-0">Unable to load listings right now.</div></div>';
        }
        listContainer.style.opacity = '1';
      });
  };

  if (searchInput) {
    searchInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      state.q = cleanSearchTerm(searchInput.value);
      state.page = 1;
      applyStateToUrl();
      loadListings();
    });
  }

  if (citySelect) {
    citySelect.addEventListener('change', () => {
      const option = citySelect.options[citySelect.selectedIndex];
      const raw = option ? option.value || option.textContent : '';
      state.city = slugify(raw);
      state.page = 1;
      applyStateToUrl();
      loadListings();
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      state.sort = sortSelect.value === 'Rating' || sortSelect.value === 'Best rated' ? 'rating' : '';
      state.page = 1;
      applyStateToUrl();
      loadListings();
    });
  }

  if (selectedModule === 'real-estate' && listingTypeSelects.length) {
    listingTypeSelects.forEach((select) => {
      const onChange = () => {
        const raw = select.value || select.options[select.selectedIndex]?.textContent || '';
        state.listing_type = normalizeListingType(raw);
        state.page = 1;
        state.budget_max = 0;
        state.price_min = 0;
        state.price_max = 0;
        syncControlsFromState();
        applyStateToUrl();
        loadListings();
      };
      select.addEventListener('change', onChange);
      select.addEventListener('input', onChange);
    });
  }

  if (selectedModule === 'real-estate' && (priceMinInputs.length || priceMaxInputs.length)) {
    const getInt = (value) => {
      const v = Number.parseInt(String(value || '').replace(/[^\d]/g, ''), 10);
      return Number.isInteger(v) && v > 0 ? v : 0;
    };
    const syncPriceRange = () => {
      if ((state.listing_type || 'rent') === 'sale') return;
      const min = getInt(priceMinInputs[0]?.value);
      const max = getInt(priceMaxInputs[0]?.value);
      state.price_min = min;
      state.price_max = max;
      state.budget_max = 0;
      state.page = 1;
      applyStateToUrl();
      loadListings();
    };
    [...priceMinInputs, ...priceMaxInputs].forEach((input) => {
      input.addEventListener('change', syncPriceRange);
      input.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') syncPriceRange();
      });
    });
  }

  if (selectedModule === 'events') {
    if (eventsCategorySelect) {
      eventsCategorySelect.addEventListener('change', () => {
        const option = eventsCategorySelect.options[eventsCategorySelect.selectedIndex];
        const raw = option ? option.value || option.textContent : '';
        state.category = raw ? resolveSlugFromFilters(lastFilters.categories, raw) : '';
        state.page = 1;
        applyStateToUrl();
        loadListings();
      });
    }

    if (eventsCitySelect) {
      eventsCitySelect.addEventListener('change', () => {
        const option = eventsCitySelect.options[eventsCitySelect.selectedIndex];
        const raw = option ? option.value || option.textContent : '';
        state.city = raw ? resolveSlugFromFilters(lastFilters.cities, raw) : '';
        state.page = 1;
        applyStateToUrl();
        loadListings();
      });
    }

    if (eventsPriceSelect) {
      eventsPriceSelect.addEventListener('change', () => {
        const option = eventsPriceSelect.options[eventsPriceSelect.selectedIndex];
        const raw = option ? option.value || option.textContent : '';
        state.budget_max = budgetMaxFromEventsPriceValue(raw);
        state.page = 1;
        applyStateToUrl();
        loadListings();
      });
    }

    if (eventsDateInput) {
      eventsDateInput.addEventListener('change', () => {
        state.page = 1;
        applyStateToUrl();
        loadListings();
      });
    }

    if (Array.isArray(eventsSubcategoryLinks)) {
      eventsSubcategoryLinks.forEach((link) => {
        link.addEventListener('click', (event) => {
          event.preventDefault();
          const label = (link.textContent || '').trim();
          if (label.toLowerCase() === 'all') {
            state.category = '';
          } else {
            state.category = resolveSlugFromFilters(lastFilters.categories, label);
          }
          state.page = 1;
          applyStateToUrl();
          loadListings();
        });
      });
    }
  }

  if (clearAllLink) {
    clearAllLink.addEventListener('click', (event) => {
      event.preventDefault();
      state = {
        q: '',
        city: '',
        category: '',
        sort: '',
        ratings: [],
        budget_max: 0,
        listing_type: selectedModule === 'real-estate' ? 'rent' : '',
        price_min: 0,
        price_max: 0,
        availability: false,
        stock: selectedModule === 'cars' ? 'used' : '',
        page: 1,
      };
      syncControlsFromState();
      applyStateToUrl();
      loadListings();
    });
  }

  if (selectedModule === 'cars') {
    if (newCarsBtn) {
      newCarsBtn.addEventListener('click', (event) => {
        event.preventDefault();
        state.stock = 'new';
        state.page = 1;
        applyStateToUrl();
        syncControlsFromState();
        loadListings();
      });
    }
    if (usedCarsBtn) {
      usedCarsBtn.addEventListener('click', (event) => {
        event.preventDefault();
        state.stock = 'used';
        state.page = 1;
        applyStateToUrl();
        syncControlsFromState();
        loadListings();
      });
    }
  }

  ratingChecks.forEach((input) => {
    input.addEventListener('change', () => {
      state.ratings = ratingChecks
        .filter((cb) => cb.checked)
        .map((cb) => Number.parseInt(cb.id.replace('star-', ''), 10))
        .filter((v) => Number.isInteger(v));
      state.page = 1;
      applyStateToUrl();
      loadListings();
    });
  });

  if (budgetButtons.length) {
    budgetButtons.forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        const raw = (btn.getAttribute('data-budget-max') || '').trim();
        const value = raw === '' ? 0 : Number.parseInt(raw, 10);
        state.budget_max = Number.isInteger(value) && value > 0 ? value : 0;
        if (selectedModule === 'real-estate') {
          state.listing_type = 'sale';
          state.price_min = 0;
          state.price_max = 0;
        }
        state.page = 1;
        syncControlsFromState();
        applyStateToUrl();
        loadListings();
      });
    });
  }

  if (budgetSliders.length) {
    const labelFor = (slider) => {
      const wrap = slider.closest('[data-budget-wrap]');
      return (wrap ? wrap.querySelector('[data-budget-label]') : null) || slider.parentElement?.querySelector?.('[data-budget-label]');
    };

    budgetSliders.forEach((slider) => {
      slider.addEventListener('input', () => {
        const raw = Number.parseInt(slider.value || '0', 10);
        const value = Number.isInteger(raw) && raw > 0 ? raw : 0;
        const label = labelFor(slider);
        if (label) label.textContent = value ? `$${value}` : 'Any';
      });
      slider.addEventListener('change', () => {
        const raw = Number.parseInt(slider.value || '0', 10);
        const value = Number.isInteger(raw) && raw > 0 ? raw : 0;
        state.budget_max = value;
        if (selectedModule === 'real-estate') {
          state.listing_type = 'sale';
          state.price_min = 0;
          state.price_max = 0;
        }
        state.page = 1;
        syncControlsFromState();
        applyStateToUrl();
        loadListings();
      });
    });
  }

  if (
    priceWrap
    && priceMinSlider instanceof HTMLInputElement
    && priceMaxSlider instanceof HTMLInputElement
  ) {
    const maxLimit = Number.parseInt(priceMaxSlider.max || '0', 10) || 0;
    const step = Number.parseInt(priceMaxSlider.step || priceMinSlider.step || '1', 10) || 1;

    const clamp = (v) => Math.max(0, Math.min(v, maxLimit));
    const setLabel = (min, max) => {
      if (!priceLabel) return;
      const isAny = min <= 0 && max >= maxLimit;
      priceLabel.textContent = isAny ? 'Any' : `$${min} - $${max}`;
    };

    const applyUi = (min, max) => {
      const m1 = clamp(min);
      const m2 = clamp(Math.max(max, m1));
      priceMinSlider.value = String(m1);
      priceMaxSlider.value = String(m2);
      if (priceMinInput instanceof HTMLInputElement) {
        priceMinInput.step = String(step);
        priceMinInput.value = String(m1);
      }
      if (priceMaxInput instanceof HTMLInputElement) {
        priceMaxInput.step = String(step);
        priceMaxInput.value = String(m2);
      }
      setLabel(m1, m2);
    };

    const commit = () => {
      const rawMin = Number.parseInt(priceMinSlider.value || '0', 10) || 0;
      const rawMax = Number.parseInt(priceMaxSlider.value || '0', 10) || 0;
      const min = clamp(Math.min(rawMin, rawMax));
      const max = clamp(Math.max(rawMin, rawMax));

      const isAny = min <= 0 && max >= maxLimit;
      state.price_min = isAny ? 0 : min;
      state.price_max = isAny ? 0 : max;
      state.budget_max = 0;
      state.page = 1;
      syncControlsFromState();
      applyStateToUrl();
      loadListings();
    };

    const onMinInput = () => {
      const v = Number.parseInt(priceMinSlider.value || '0', 10) || 0;
      const other = Number.parseInt(priceMaxSlider.value || String(maxLimit), 10) || maxLimit;
      applyUi(v, other);
    };
    const onMaxInput = () => {
      const v = Number.parseInt(priceMaxSlider.value || String(maxLimit), 10) || maxLimit;
      const other = Number.parseInt(priceMinSlider.value || '0', 10) || 0;
      applyUi(other, v);
    };

    priceMinSlider.addEventListener('input', onMinInput);
    priceMaxSlider.addEventListener('input', onMaxInput);
    priceMinSlider.addEventListener('change', commit);
    priceMaxSlider.addEventListener('change', commit);

    const onNumberChange = () => {
      const min = priceMinInput instanceof HTMLInputElement ? Number.parseInt(priceMinInput.value || '0', 10) || 0 : 0;
      const max = priceMaxInput instanceof HTMLInputElement ? Number.parseInt(priceMaxInput.value || String(maxLimit), 10) || maxLimit : maxLimit;
      applyUi(min, max);
      commit();
    };
    if (priceMinInput instanceof HTMLInputElement) {
      priceMinInput.addEventListener('change', onNumberChange);
      priceMinInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') onNumberChange(); });
    }
    if (priceMaxInput instanceof HTMLInputElement) {
      priceMaxInput.addEventListener('change', onNumberChange);
      priceMaxInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') onNumberChange(); });
    }

    // Ensure UI matches current state on first paint.
    const initAny = !state.price_min && !state.price_max;
    const initMin = initAny ? 0 : (state.price_min || 0);
    const initMax = initAny ? maxLimit : (state.price_max || maxLimit);
    applyUi(initMin, initMax);
  }

  if (availabilityCheck) {
    availabilityCheck.addEventListener('change', () => {
      state.availability = availabilityCheck.checked;
      state.page = 1;
      applyStateToUrl();
      loadListings();
    });
  }

  syncControlsFromState();
  wireDeadPlaceholderLinks();
  applyStateToUrl();
  loadListings();
})();
