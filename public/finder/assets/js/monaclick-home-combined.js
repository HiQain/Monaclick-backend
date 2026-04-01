(() => {
  const CACHE_KEY = 'monaclick.combined.home.cache.v4';
  const CACHE_TTL_MS = 10 * 60 * 1000;
  const swipers = {};

  const escapeHtml = (value) =>
    String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');

  const fetchListings = async (module, params = {}) => {
    const query = new URLSearchParams({ module, per_page: '8', ...params });
    const response = await fetch(`/api/monaclick/listings?${query.toString()}`);
    if (!response.ok) throw new Error(`Failed ${module}`);
    const payload = await response.json();
    return Array.isArray(payload?.data) ? payload.data : [];
  };

  const entryUrl = (item) => `/entry/${encodeURIComponent(item.module)}?slug=${encodeURIComponent(item.slug)}`;
  const slugify = (value) =>
    String(value ?? '')
      .trim()
      .toLowerCase()
      .replaceAll('&', ' and ')
      .replaceAll(/[^a-z0-9]+/g, '-')
      .replaceAll(/-+/g, '-')
      .replaceAll(/^-|-$/g, '');

  const buildCombinedSearchParams = (module, serviceValue, cityValue) => {
    const params = { per_page: '3' };
    const serviceSlug = slugify(serviceValue);

    if (module === 'contractors') {
      if (serviceSlug) params.category = serviceSlug;
      if (cityValue) params.q = cityValue;
      return params;
    }

    const q = [serviceValue, cityValue].filter(Boolean).join(' ').trim();
    if (q) params.q = q;
    return params;
  };

  const readCache = () => {
    const parseCache = (raw) => {
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      if (parsed.ts && parsed.data) {
        if (Date.now() - Number(parsed.ts) > CACHE_TTL_MS) return null;
        return parsed.data;
      }
      return parsed; // Backward compatibility with old cache shape.
    };

    try {
      const sessionData = parseCache(window.sessionStorage.getItem(CACHE_KEY));
      if (sessionData) return sessionData;

      const localData = parseCache(window.localStorage.getItem(CACHE_KEY));
      if (localData) return localData;

      return null;
    } catch (_) {
      return null;
    }
  };

  const writeCache = (payload) => {
    try {
      const packet = JSON.stringify({ ts: Date.now(), data: payload });
      window.sessionStorage.setItem(CACHE_KEY, packet);
      window.localStorage.setItem(CACHE_KEY, packet);
    } catch (_) {
      // Ignore storage failures.
    }
  };

  const initOrUpdateSwiper = (key, selector, options) => {
    const el = document.querySelector(selector);
    if (!el || typeof Swiper === 'undefined') return;

    if (swipers[key]) {
      swipers[key].update();
      return;
    }

    swipers[key] = new Swiper(selector, options);
  };

  const initAllSwipers = () => {
    initOrUpdateSwiper('topOffers', '#topOffersSwiper', {
      slidesPerView: 1,
      spaceBetween: 24,
      speed: 550,
      navigation: { prevEl: '#topOffersPrev', nextEl: '#topOffersNext' },
      breakpoints: {
        576: { slidesPerView: 2 },
        1200: { slidesPerView: 4 },
      },
    });

    initOrUpdateSwiper('cars', '#carsSwiper', {
      slidesPerView: 1,
      spaceBetween: 24,
      speed: 550,
      navigation: { prevEl: '#carsPrev', nextEl: '#carsNext' },
      breakpoints: {
        576: { slidesPerView: 2 },
        1200: { slidesPerView: 4 },
      },
    });

    initOrUpdateSwiper('homeProjects', '#homeProjectsSwiper', {
      slidesPerView: 1,
      spaceBetween: 24,
      speed: 550,
      navigation: { prevEl: '#homeProjectsPrev', nextEl: '#homeProjectsNext' },
      breakpoints: {
        768: { slidesPerView: 2 },
        1200: { slidesPerView: 3 },
      },
    });
  };

  const renderRealEstate = (items) => {
    const wrap = document.getElementById('realEstateOffers');
    if (!wrap) return;
    wrap.innerHTML = items.slice(0, 6).map((item, index) => `
      <div class="swiper-slide h-auto">
        <article class="card h-100">
          <img class="card-img-top module-card-img" src="${escapeHtml(item.image_url || '/finder/assets/img/placeholders/preview-square.svg')}" alt="${escapeHtml(item.title)}" loading="${index === 0 ? 'eager' : 'lazy'}" fetchpriority="${index === 0 ? 'high' : 'auto'}" decoding="async" onerror="this.onerror=null;this.src='/finder/assets/img/placeholders/preview-square.svg';">
          <div class="card-body">
            <span class="badge text-bg-secondary mb-2">For ${item.price?.includes('/mo') ? 'rent' : 'sale'}</span>
            <h3 class="h5 mb-1">${escapeHtml(item.price || 'Price on request')}</h3>
            <a class="stretched-link text-body text-decoration-none" href="${entryUrl(item)}">${escapeHtml(item.title)}</a>
            <div class="fs-sm text-body-secondary mt-2">${escapeHtml(item.city?.name || 'City not set')}</div>
          </div>
        </article>
      </div>
    `).join('');
  };

  const renderContractorNear = (items) => {
    const wrap = document.getElementById('contractorNearList');
    if (!wrap) return;
    wrap.innerHTML = items.slice(0, 6).map((item) => `
      <div class="col-md-6">
        <article class="card border-0 bg-body-tertiary h-100">
          <div class="card-body d-flex gap-3 align-items-center">
            <img src="${escapeHtml(item.image_url || '/finder/assets/img/listings/contractors/04.jpg')}" alt="${escapeHtml(item.title)}" width="96" height="96" loading="lazy" decoding="async" class="rounded-3 object-fit-cover" onerror="this.onerror=null;this.src='/finder/assets/img/listings/contractors/04.jpg';">
            <div>
              <a class="stretched-link text-decoration-none" href="${entryUrl(item)}"><h3 class="h5 mb-1">${escapeHtml(item.title)}</h3></a>
              <div class="fs-sm text-warning mb-1"><i class="fi-star-filled"></i> ${Number(item.rating || 0).toFixed(1)} (${Number(item.reviews_count || 0)})</div>
              <div class="fw-medium">${escapeHtml(item.price || '')}</div>
            </div>
          </div>
        </article>
      </div>
    `).join('');
  };

  const renderCars = (items) => {
    const wrap = document.getElementById('latestCarsGrid');
    if (!wrap) return;
    wrap.innerHTML = items.slice(0, 6).map((item, index) => `
      <div class="swiper-slide h-auto">
        <article class="card h-100 hover-effect-scale bg-body-tertiary border-0">
          <div class="card-img-top position-relative overflow-hidden">
          <img class="card-img-top module-card-img" src="${escapeHtml(item.image_url || '/finder/assets/img/placeholders/preview-square.svg')}" alt="${escapeHtml(item.title)}" loading="${index === 0 ? 'eager' : 'lazy'}" fetchpriority="${index === 0 ? 'high' : 'auto'}" decoding="async" onerror="this.onerror=null;this.src='/finder/assets/img/placeholders/preview-square.svg';">
          ${(() => {
            const badges = [];
            const conditionRaw = String(item?.details?.car?.condition || '').toLowerCase();
            const stock = conditionRaw.includes('used') ? 'Used' : (conditionRaw.includes('new') ? 'New' : '');
            const features = Array.isArray(item?.features) ? item.features : [];
            const isVerified = features.some((f) => String(f || '').toLowerCase().includes('verified'));
            if (isVerified) badges.push('<span class="badge text-bg-info d-inline-flex align-items-center">Verified<i class="fi-shield ms-1"></i></span>');
            if (stock) badges.push(`<span class="badge ${stock === 'New' ? 'text-bg-primary' : 'text-bg-warning'}">${escapeHtml(stock)}</span>`);
            if (!badges.length) return '';
            return `<div class="d-flex flex-column gap-2 align-items-start position-absolute top-0 start-0 z-1 pt-1 pt-sm-0 ps-1 ps-sm-0 mt-2 mt-sm-3 ms-2 ms-sm-3" style="pointer-events:none">${badges.join('')}</div>`;
          })()}
          </div>
          <div class="card-body pb-3">
            <div class="d-flex align-items-center justify-content-between mb-2">
              <div class="fs-xs text-body-secondary me-3">Recently added</div>
              <div class="d-flex gap-2 position-relative z-2">
                <button type="button" class="btn btn-icon btn-sm btn-outline-secondary animate-pulse rounded-circle" aria-label="Add to wishlist">
                  <i class="fi-heart animate-target fs-sm"></i>
                </button>
                <button type="button" class="btn btn-icon btn-sm btn-outline-secondary animate-shake rounded-circle" aria-label="Notify">
                  <i class="fi-bell animate-target fs-sm"></i>
                </button>
                <button type="button" class="btn btn-icon btn-sm btn-outline-secondary animate-rotate rounded-circle" aria-label="Compare">
                  <i class="fi-repeat animate-target fs-sm"></i>
                </button>
              </div>
            </div>
            <h3 class="h6 mb-2">
              <a class="hover-effect-underline stretched-link me-1 text-decoration-none" href="${entryUrl(item)}">${escapeHtml(item.title)}</a>
              ${item?.details?.car?.year ? `<span class="fs-xs fw-normal text-body-secondary">(${escapeHtml(item.details.car.year)})</span>` : ''}
            </h3>
            <div class="h6 mb-0">${escapeHtml(item.price || '')}</div>
          </div>
          <div class="card-footer bg-transparent border-0 pt-0 pb-4">
            <div class="border-top pt-3">
              <div class="row row-cols-2 g-2 fs-sm">
                <div class="col d-flex align-items-center gap-2"><i class="fi-map-pin"></i>${escapeHtml(item.city?.name || 'Location')}</div>
                <div class="col d-flex align-items-center gap-2"><i class="fi-tachometer"></i>${escapeHtml(item?.details?.car?.mileage ? `${item.details.car.mileage} mi` : 'N/A')}</div>
                <div class="col d-flex align-items-center gap-2"><i class="fi-gas-pump"></i>${escapeHtml(item?.details?.car?.fuel_type || 'N/A')}</div>
                <div class="col d-flex align-items-center gap-2"><i class="fi-gearbox"></i>${escapeHtml(item?.details?.car?.transmission || 'N/A')}</div>
              </div>
            </div>
          </div>
        </article>
      </div>
    `).join('');
  };

  const renderAddedToday = (items) => {
    const primary = document.getElementById('addedTodayPrimary');
    const secondary = document.getElementById('addedTodaySecondary');
    if (!primary || !secondary) return;

    const [first, ...rest] = items.slice(0, 3);
    if (!first) return;

    primary.innerHTML = `
      <article class="card h-100 overflow-hidden border-0">
        <img class="w-100 h-100 object-fit-cover" src="${escapeHtml(first.image_url || '/finder/assets/img/placeholders/preview-square.svg')}" alt="${escapeHtml(first.title)}" loading="lazy" decoding="async" style="min-height: 520px" onerror="this.onerror=null;this.src='/finder/assets/img/placeholders/preview-square.svg';">
        <div class="card-img-overlay d-flex flex-column justify-content-end text-white">
          <div class="d-flex gap-2 mb-2">
            <span class="badge text-bg-info">Verified</span>
            <span class="badge text-bg-warning">Featured</span>
          </div>
          <h3 class="h2 text-white mb-1">${escapeHtml(first.title)}</h3>
          <p class="mb-2">${escapeHtml(first.city?.name || 'Location')}</p>
          <a class="btn btn-primary align-self-start" href="${entryUrl(first)}">${escapeHtml(first.price || 'View')}</a>
        </div>
      </article>
    `;

    secondary.innerHTML = rest.map((item) => `
      <div class="col-12">
        <article class="card border-0 overflow-hidden">
          <img class="w-100 object-fit-cover" src="${escapeHtml(item.image_url || '/finder/assets/img/placeholders/preview-square.svg')}" alt="${escapeHtml(item.title)}" loading="lazy" decoding="async" style="height: 250px" onerror="this.onerror=null;this.src='/finder/assets/img/placeholders/preview-square.svg';">
          <div class="card-img-overlay d-flex align-items-end justify-content-between">
            <div class="text-white">
              <span class="badge text-bg-warning mb-2">Featured</span>
              <h3 class="h3 text-white mb-1">${escapeHtml(item.title)}</h3>
              <p class="mb-0">${escapeHtml(item.city?.name || 'Location')}</p>
            </div>
            <a class="btn btn-primary" href="${entryUrl(item)}">${escapeHtml(item.price || 'View')}</a>
          </div>
        </article>
      </div>
    `).join('');
  };

  const renderContractorHome = (items) => {
    const wrap = document.getElementById('contractorHomeList');
    if (!wrap) return;
    wrap.innerHTML = items.slice(0, 6).map((item, index) => `
      <div class="swiper-slide h-auto">
        <article class="card h-100">
          <img class="card-img-top module-card-img" src="${escapeHtml(item.image_url || '/finder/assets/img/placeholders/preview-square.svg')}" alt="${escapeHtml(item.title)}" loading="${index === 0 ? 'eager' : 'lazy'}" fetchpriority="${index === 0 ? 'high' : 'auto'}" decoding="async" onerror="this.onerror=null;this.src='/finder/assets/img/placeholders/preview-square.svg';">
          <div class="card-body">
            <a class="stretched-link text-decoration-none" href="${entryUrl(item)}"><h3 class="h4 mb-2">${escapeHtml(item.title)}</h3></a>
            <div class="d-flex justify-content-between align-items-center">
              <div><i class="fi-star-filled text-warning"></i> ${Number(item.rating || 0).toFixed(1)} (${Number(item.reviews_count || 0)})</div>
              <div class="fw-medium">${escapeHtml(item.price || '')}</div>
            </div>
          </div>
        </article>
      </div>
    `).join('');
  };

  const buildMixedServices = (groups) => {
    const sources = [
      ...(groups.contractors || []),
      ...(groups.realEstate || []),
      ...(groups.cars || []),
    ];

    const unique = [];
    const seen = new Set();
    sources.forEach((item) => {
      if (!item?.slug) return;
      const key = `${item.module}:${item.slug}`;
      if (seen.has(key)) return;
      seen.add(key);
      unique.push(item);
    });
    return unique;
  };

  const renderMixedServices = (items) => {
    const wrap = document.getElementById('mixedServicesGrid');
    if (!wrap) return;

    const icons = ['fi-home', 'fi-car', 'fi-calendar', 'fi-map-pin', 'fi-star', 'fi-search', 'fi-user', 'fi-bookmark'];

    wrap.innerHTML = items.slice(0, 12).map((item, index) => `
      <div class="col-sm-6 col-xl-3">
        <div class="mixed-service-item d-flex align-items-center gap-3">
          <span class="icon-wrap text-body-secondary"><i class="${icons[index % icons.length]} fs-lg"></i></span>
          <a class="text-decoration-none text-body-emphasis hover-effect-underline" href="${entryUrl(item)}">
            ${escapeHtml(item.title)}
          </a>
        </div>
      </div>
    `).join('');
  };

  const renderLoadingSkeletons = () => {
    const make = (count) =>
      Array.from({ length: count })
        .map(() => `<div class="swiper-slide h-auto"><div class="placeholder-glow"><div class="placeholder col-12 rounded-4" style="height: 220px"></div></div></div>`)
        .join('');
    const makeGrid = (count, colClass) =>
      Array.from({ length: count })
        .map(() => `<div class="${colClass}"><div class="placeholder-glow"><div class="placeholder col-12 rounded-4" style="height: 110px"></div></div></div>`)
        .join('');

    const set = (id, html) => {
      const el = document.getElementById(id);
      if (el && !el.children.length) el.innerHTML = html;
    };

    set('mixedServicesGrid', makeGrid(8, 'col-sm-6 col-xl-3'));
    set('realEstateOffers', make(4));
    set('contractorNearList', makeGrid(4, 'col-md-6'));
    set('latestCarsGrid', make(4));
    set('contractorHomeList', make(3));
  };

  const renderSearchResults = (items) => {
    const wrap = document.getElementById('combinedSearchResults');
    const grid = document.getElementById('combinedSearchResultsGrid');
    const viewAll = document.getElementById('combinedSearchViewAll');
    const meta = document.getElementById('combinedSearchMeta');
    const summary = document.getElementById('combinedSearchSummary');
    if (!wrap || !grid) return;

    const serviceValue = (document.getElementById('serviceQuery')?.value || '').trim();
    const cityValue = (document.getElementById('cityZip')?.value || '').trim();

    if (meta) {
      meta.innerHTML = [
        serviceValue ? `<span class="combined-search-chip"><i class="fi-search"></i>${escapeHtml(serviceValue)}</span>` : '',
        cityValue ? `<span class="combined-search-chip"><i class="fi-map-pin"></i>${escapeHtml(cityValue)}</span>` : '',
      ].filter(Boolean).join('');
    }

    if (!items.length) {
      wrap.classList.remove('d-none');
      if (summary) summary.textContent = 'No listings matched this search yet. Try another service or city.';
      grid.innerHTML = '<div class="col-12"><div class="alert alert-warning mb-0">No listings found for this search.</div></div>';
      return;
    }

    if (viewAll) {
      const first = items[0];
      if (first?.module === 'contractors') {
        const params = new URLSearchParams();
        const serviceSlug = slugify(serviceValue);
        if (serviceSlug) params.set('category', serviceSlug);
        viewAll.setAttribute('href', `/listings/contractors${params.toString() ? `?${params.toString()}` : ''}`);
      } else {
        viewAll.setAttribute('href', `/listings/${encodeURIComponent(first.module)}?q=${encodeURIComponent(serviceValue)}`);
      }
    }

    wrap.classList.remove('d-none');
    if (summary) {
      summary.textContent = `Showing ${items.length} result${items.length === 1 ? '' : 's'} for your current search.`;
    }
    grid.innerHTML = items.map((item) => `
      <div class="col-sm-6 col-xl-3">
        <article class="card h-100">
          <img class="card-img-top module-card-img" src="${escapeHtml(item.image_url || '/finder/assets/img/placeholders/preview-square.svg')}" alt="${escapeHtml(item.title)}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='/finder/assets/img/placeholders/preview-square.svg';">
          <div class="card-body">
            <span class="badge text-bg-dark mb-2">${escapeHtml(item.module)}</span>
            <a class="stretched-link text-decoration-none" href="${entryUrl(item)}"><h3 class="h6 mb-1">${escapeHtml(item.title)}</h3></a>
            <div class="fs-sm text-body-secondary">${escapeHtml(item.city?.name || '')}</div>
          </div>
        </article>
      </div>
    `).join('');
  };

  const renderAll = (datasets) => {
    renderRealEstate(datasets.realEstate || []);
    renderAddedToday(datasets.realEstateLatest || []);
    renderContractorNear(datasets.contractorsPopular || []);
    renderCars(datasets.cars || []);
    renderContractorHome(datasets.contractorsLatest || []);
    renderMixedServices(
      buildMixedServices({
        contractors: datasets.contractorsPopular || [],
        realEstate: datasets.realEstate || [],
        cars: datasets.cars || [],
      })
    );
    initAllSwipers();
  };

  const bootstrapPage = async () => {
    const cached = readCache();
    if (cached) {
      renderAll(cached);
    } else {
      renderLoadingSkeletons();
      initAllSwipers();
    }

    try {
      const [realEstate, contractors, cars] = await Promise.all([
        fetchListings('real-estate', { per_page: '6' }),
        fetchListings('contractors', { per_page: '8' }),
        fetchListings('cars', { per_page: '6' }),
      ]);

      const byRatingDesc = (a, b) => Number(b?.rating || 0) - Number(a?.rating || 0);
      const datasets = {
        realEstate: [...realEstate].sort(byRatingDesc),
        realEstateLatest: realEstate,
        contractorsPopular: [...contractors].sort(byRatingDesc),
        contractorsLatest: contractors,
        cars,
      };
      renderAll(datasets);
      writeCache(datasets);
    } catch (_) {
      // Keep fallback rendered state.
    }
  };

  const searchForm = document.getElementById('combinedSearchForm');
  if (searchForm) {
    searchForm.setAttribute('data-mc-no-loader', '1');
    searchForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (typeof window.__MC_HIDE_PAGE_LOADER__ === 'function') {
        window.__MC_HIDE_PAGE_LOADER__();
      }
      const serviceValue = (document.getElementById('serviceQuery')?.value || '').trim();
      const cityValue = (document.getElementById('cityZip')?.value || '').trim();
      const q = [serviceValue, cityValue].filter(Boolean).join(' ').trim();

      if (!q) {
        renderSearchResults([]);
        return;
      }

      try {
        const modules = ['contractors', 'real-estate', 'cars', 'restaurants'];
        const results = await Promise.allSettled(
          modules.map((module) => fetchListings(module, buildCombinedSearchParams(module, serviceValue, cityValue)))
        );

        const merged = results
          .filter((result) => result.status === 'fulfilled')
          .flatMap((result) => result.value)
          .slice(0, 8);

        renderSearchResults(merged);
        document.getElementById('combinedSearchResults')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } finally {
        if (typeof window.__MC_HIDE_PAGE_LOADER__ === 'function') {
          window.__MC_HIDE_PAGE_LOADER__();
        }
      }
    });
  }

  bootstrapPage();
})();
