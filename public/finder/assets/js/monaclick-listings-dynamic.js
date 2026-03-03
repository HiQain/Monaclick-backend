(() => {
  const path = window.location.pathname;
  if (!path.startsWith('/listings')) return;

  const moduleFromPath = path.split('/')[2] || 'contractors';
  const allowedModules = new Set(['contractors', 'real-estate', 'cars', 'events']);
  const selectedModule = allowedModules.has(moduleFromPath) ? moduleFromPath : 'contractors';

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

  const moduleConfig = (() => {
    if (selectedModule === 'contractors') {
      return {
        listContainer: document.querySelector('.col-lg-9 .vstack.gap-4'),
        resultsText: document.querySelector('.col-lg-9 .fs-sm.text-nowrap'),
        paginationNav: document.querySelector('.col-lg-9 nav[aria-label="Listings pagination"]'),
        searchInput: document.querySelector('.project-search.form-control'),
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
        citySelect: null,
        categoryList: null,
        sortSelect: document.querySelector('.col-lg-9 .position-relative select'),
        clearAllLink: null,
        activePillsWrap: null,
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

  const ratingChecks = Array.from(document.querySelectorAll('input[id^="star-"]'));
  const availabilityCheck = document.getElementById('now');
  const budgetChecks = Array.from(document.querySelectorAll('input[id^="budget-"]'));
  const featureChecks = [
    'eco-friendly',
    'free-consultation',
    'online-consultation',
    'free-estimate',
    'verified-hires',
    'weekend-consultations',
  ]
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  const getStateFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    return {
      q: cleanSearchTerm(params.get('q') || ''),
      city: params.get('city') || '',
      category: params.get('category') || '',
      sort: params.get('sort') || '',
      ratings: (params.get('ratings') || '')
        .split(',')
        .map((v) => Number.parseInt(v, 10))
        .filter((v) => Number.isInteger(v) && v >= 1 && v <= 5),
      budgets: (params.get('budgets') || '')
        .split(',')
        .map((v) => Number.parseInt(v, 10))
        .filter((v) => Number.isInteger(v) && v >= 1 && v <= 4),
      features: (params.get('features') || '')
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v.length > 0),
      availability: params.get('availability') === '1',
      page: Number.parseInt(params.get('page') || '1', 10) || 1,
    };
  };

  let state = getStateFromUrl();
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

  const eventsBudgetFromPriceValue = (value) => {
    const raw = String(value || '').toLowerCase();
    if (!raw) return [];
    if (raw.includes('free') || raw.includes('up to $25')) return [1];
    if (raw.includes('$25 - $50') || raw.includes('$50 - $100')) return [2];
    if (raw.includes('$100 - $200')) return [3];
    if (raw.includes('over $200')) return [4];
    return [];
  };

  const syncEventsPriceSelectFromState = () => {
    if (!eventsPriceSelect) return;
    if (!state.budgets.length) {
      eventsPriceSelect.value = '';
      return;
    }

    const firstBudget = state.budgets[0];
    const desiredLabel = {
      1: 'Up to $25',
      2: '$25 - $50',
      3: '$100 - $200',
      4: 'Over $200',
    }[firstBudget] || '';

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

  const applyStateToUrl = () => {
    const params = new URLSearchParams();
    state.q = cleanSearchTerm(state.q);
    if (state.q) params.set('q', state.q);
    if (state.city) params.set('city', state.city);
    if (state.category) params.set('category', state.category);
    if (state.sort) params.set('sort', state.sort);
    if (state.ratings.length) params.set('ratings', state.ratings.join(','));
    if (state.budgets.length) params.set('budgets', state.budgets.join(','));
    if (state.features.length) params.set('features', state.features.join(','));
    if (state.availability) params.set('availability', '1');
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
    if (state.budgets.length) params.set('budgets', state.budgets.join(','));
    if (state.features.length) params.set('features', state.features.join(','));
    if (state.availability) params.set('availability', '1');
    if (targetPage > 1) params.set('page', String(targetPage));
    const qs = params.toString();
    return `${window.location.pathname}${qs ? `?${qs}` : ''}`;
  };

  const detailUrl = (item) => `/entry/${encodeURIComponent(item.module)}?slug=${encodeURIComponent(item.slug)}`;

  const wireDeadPlaceholderLinks = () => {
    const target = `/listings/${selectedModule}`;
    document.querySelectorAll('a[href="#!"], a[href="#"]').forEach((link) => {
      const isUiToggle = link.hasAttribute('data-bs-toggle') || link.getAttribute('role') === 'button';
      if (isUiToggle) return;
      link.setAttribute('href', target);
    });
  };

  const contractorCard = (item) => {
    const title = escapeHtml(item.title);
    const excerpt = escapeHtml(item.excerpt || '');
    const category = escapeHtml(item.category?.name || 'Category');
    const city = escapeHtml(item.city?.name || 'City');
    const price = escapeHtml(item.price || '');
    const image = escapeHtml(item.image_url || '/finder/assets/img/placeholders/preview-square.svg');
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
    return `
      <div class="col">
        <article class="card h-100 hover-effect-scale bg-body-tertiary border-0">
          <div class="card-img-top position-relative overflow-hidden">
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
    if (selectedModule === 'contractors') {
      listContainer.innerHTML = items.map(contractorCard).join('');
      return;
    }
    if (selectedModule === 'cars') {
      listContainer.innerHTML = items.map(carCard).join('');
      return;
    }
    if (selectedModule === 'real-estate') {
      listContainer.innerHTML = items.map(propertyCard).join('');
      return;
    }
    listContainer.innerHTML = items.map(eventCard).join('');
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
    if (state.budgets.length) pills.push(`<button type="button" class="btn btn-sm btn-secondary rounded-pill" data-pill="budgets"><i class="fi-close fs-sm me-1 ms-n1"></i>Budget (${state.budgets.length})</button>`);
    if (state.features.length) pills.push(`<button type="button" class="btn btn-sm btn-secondary rounded-pill" data-pill="features"><i class="fi-close fs-sm me-1 ms-n1"></i>Features (${state.features.length})</button>`);
    if (state.ratings.length) pills.push(`<button type="button" class="btn btn-sm btn-secondary rounded-pill" data-pill="ratings"><i class="fi-close fs-sm me-1 ms-n1"></i>Rating (${state.ratings.join('/')})</button>`);
    if (state.availability) pills.push('<button type="button" class="btn btn-sm btn-secondary rounded-pill" data-pill="availability"><i class="fi-close fs-sm me-1 ms-n1"></i>Available now</button>');

    activePillsWrap.innerHTML = pills.join('');
    activePillsWrap.querySelectorAll('button[data-pill]').forEach((button) => {
      button.addEventListener('click', () => {
        const type = button.getAttribute('data-pill');
        if (type === 'city') state.city = '';
        if (type === 'category') state.category = '';
        if (type === 'q') state.q = '';
        if (type === 'budgets') state.budgets = [];
        if (type === 'features') state.features = [];
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
    budgetChecks.forEach((input) => {
      const budget = Number.parseInt(input.id.replace('budget-', ''), 10);
      input.checked = state.budgets.includes(budget);
    });
    featureChecks.forEach((input) => {
      input.checked = state.features.includes(input.id);
    });
    if (availabilityCheck) {
      availabilityCheck.checked = !!state.availability;
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
    if (state.budgets.length) apiQuery.set('budgets', state.budgets.join(','));
    if (state.features.length) apiQuery.set('features', state.features.join(','));
    if (state.availability) apiQuery.set('availability', '1');

    fetch(`/api/monaclick/listings?${apiQuery.toString()}`)
      .then((res) => res.json())
      .then((payload) => {
        const items = Array.isArray(payload?.data) ? payload.data : [];
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

        if (resultsNode) {
          resultsNode.textContent = `Showing ${meta.total} results`;
        }
        renderCategoryFilter(lastFilters.categories);
        renderActivePills();

        if (!items.length) {
          if (gridMode === 'vstack') {
            listContainer.innerHTML = '<div class="alert alert-info mb-0">No listings found for selected filters.</div>';
          } else {
            listContainer.innerHTML = '<div class="col-12"><div class="alert alert-info mb-0">No listings found for selected filters.</div></div>';
          }
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
        state.budgets = eventsBudgetFromPriceValue(raw);
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
      state = { q: '', city: '', category: '', sort: '', ratings: [], budgets: [], features: [], availability: false, page: 1 };
      syncControlsFromState();
      applyStateToUrl();
      loadListings();
    });
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

  budgetChecks.forEach((input) => {
    input.addEventListener('change', () => {
      state.budgets = budgetChecks
        .filter((cb) => cb.checked)
        .map((cb) => Number.parseInt(cb.id.replace('budget-', ''), 10))
        .filter((v) => Number.isInteger(v));
      state.page = 1;
      applyStateToUrl();
      loadListings();
    });
  });

  featureChecks.forEach((input) => {
    input.addEventListener('change', () => {
      state.features = featureChecks.filter((cb) => cb.checked).map((cb) => cb.id);
      state.page = 1;
      applyStateToUrl();
      loadListings();
    });
  });

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
