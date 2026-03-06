(() => {
  const normalizedPath = window.location.pathname.replace(/\/+$/, '') || '/';
  const moduleByPath = {
    '/': 'contractors',
    '/index.html': 'contractors',
    '/contractors': 'contractors',
    '/home-contractors.html': 'contractors',
    '/real-estate': 'real-estate',
    '/home-real-estate.html': 'real-estate',
    '/cars': 'cars',
    '/home-cars.html': 'cars',
    '/events': 'events',
    '/home-events.html': 'events',
    '/restaurants': 'restaurants',
    '/home-restaurants.html': 'restaurants',
  };

  const inferModuleFromPath = (path) => {
    const p = String(path || '').toLowerCase();
    if (moduleByPath[p]) return moduleByPath[p];
    if (p.includes('real-estate')) return 'real-estate';
    if (p.includes('contractors')) return 'contractors';
    if (p.includes('cars')) return 'cars';
    if (p.includes('events')) return 'events';
    if (p.includes('restaurants')) return 'restaurants';
    return '';
  };

  const selectedModule = inferModuleFromPath(normalizedPath);
  if (!selectedModule) return;

  const detailUrl = (item) => `/entry/${encodeURIComponent(item.module)}?slug=${encodeURIComponent(item.slug)}`;
  const moduleLabel = {
    contractors: 'Contractors',
    'real-estate': 'Real Estate',
    cars: 'Cars',
    events: 'Events',
    restaurants: 'Restaurants',
  }[selectedModule] || 'Listings';
  const persistedState = {
    q: new URLSearchParams(window.location.search).get('q') || '',
    city: new URLSearchParams(window.location.search).get('city') || '',
    category: new URLSearchParams(window.location.search).get('category') || '',
  };
  let availableFilters = { categories: [], cities: [] };

  const normalize = (value) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

  const resolveSlug = (list, rawValue) => {
    const raw = String(rawValue || '').trim();
    if (!raw || !Array.isArray(list)) return '';
    const normalizedRaw = normalize(raw);
    const found = list.find((item) => {
      const slug = normalize(item.slug || '');
      const name = normalize(item.name || '');
      return normalizedRaw === slug || normalizedRaw === name || raw.toLowerCase() === String(item.name || '').toLowerCase();
    });
    return found?.slug || '';
  };

  const isEmptyChoice = (value) => {
    const v = String(value || '').trim().toLowerCase();
    return !v || v === 'all' || v === 'any' || v === 'select' || v === 'none';
  };

  const parseHeroState = (heroForm) => {
    const state = { q: '', city: '', category: '' };

    const textInputs = Array.from(
      heroForm.querySelectorAll('input[type="search"], input[type="text"]')
    ).filter((input) => input.type !== 'email');

    const primaryText = textInputs.find((input) => {
      const placeholder = (input.getAttribute('placeholder') || '').toLowerCase();
      return !placeholder.includes('zip') && !placeholder.includes('postal');
    });
    if (primaryText?.value?.trim()) state.q = primaryText.value.trim();

    const selects = Array.from(heroForm.querySelectorAll('select'));
    selects.forEach((select) => {
      const selectedText = (select.options?.[select.selectedIndex]?.text || '').trim();
      const selectedValue = String(select.value || '').trim();
      const raw = selectedText || selectedValue;
      if (isEmptyChoice(raw)) return;

      const label = `${select.getAttribute('aria-label') || ''} ${select.className || ''}`.toLowerCase();
      const citySlug = resolveSlug(availableFilters.cities, raw);
      const categorySlug = resolveSlug(availableFilters.categories, raw);

      if (!state.city && citySlug && (label.includes('location') || label.includes('city') || citySlug)) {
        state.city = citySlug;
        return;
      }

      if (!state.category && categorySlug && (label.includes('category') || label.includes('type') || label.includes('service') || categorySlug)) {
        state.category = categorySlug;
        return;
      }
    });

    state.q = state.q.trim();
    return state;
  };

  const stateToQueryString = (state) => {
    const params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.city) params.set('city', state.city);
    if (state.category) params.set('category', state.category);
    return params.toString();
  };

  const moduleFromPath = (path) => {
    const clean = (path || '').split('?')[0];
    if (clean === '/' || clean === '/contractors' || clean === '/listings' || clean === '/listings/contractors') return 'contractors';
    if (clean === '/real-estate' || clean === '/listings/real-estate') return 'real-estate';
    if (clean === '/cars' || clean === '/listings/cars') return 'cars';
    if (clean === '/events' || clean === '/listings/events') return 'events';
    if (clean === '/restaurants' || clean === '/listings/restaurants') return 'restaurants';
    return '';
  };

  const syncStateLinks = (state) => {
    const fullQs = stateToQueryString(state);
    const targets = Array.from(
      document.querySelectorAll(
        'a[href="/"], a[href="/contractors"], a[href="/real-estate"], a[href="/cars"], a[href="/events"], a[href="/restaurants"], a[href="/listings"], a[href^="/listings/"]'
      )
    );

    targets.forEach((link) => {
      const href = link.getAttribute('href') || '';
      if (!href.startsWith('/')) return;
      const cleanHref = href.split('?')[0];
      const targetModule = moduleFromPath(cleanHref);
      const isSameModule = !targetModule || targetModule === selectedModule;
      const nextState = isSameModule
        ? state
        : { q: '', city: '', category: '' };
      const qs = stateToQueryString(nextState);

      if (!qs) {
        link.setAttribute('href', cleanHref);
        return;
      }
      link.setAttribute('href', `${cleanHref}?${qs}`);
    });
  };

  const moduleSectionRules = {
    contractors: [
      { contains: 'popular projects near you', strategy: 'popular', slots: 8 },
      { contains: 'popular home projects', strategy: 'popular', slots: 8 },
      { contains: 'top', strategy: 'popular', slots: 6 },
      { contains: 'recent', strategy: 'latest', slots: 6 },
    ],
    'real-estate': [
      { contains: 'added today', strategy: 'latest', slots: 10 },
      { contains: 'recently added', strategy: 'latest', slots: 10 },
      { contains: 'recent', strategy: 'latest', slots: 8 },
      { contains: 'top real estate agents', strategy: 'popular', slots: 8 },
      { contains: 'featured', strategy: 'popular', slots: 8 },
      { contains: 'popular', strategy: 'popular', slots: 8 },
    ],
    cars: [
      { contains: 'listings grid', strategy: 'popular', slots: 8 },
      { contains: 'popular car body types', strategy: 'popular', slots: 6 },
      { contains: 'popular categories', strategy: 'popular', slots: 6 },
      { contains: 'recent', strategy: 'latest', slots: 6 },
      { contains: 'latest', strategy: 'latest', slots: 6 },
    ],
    events: [
      { contains: 'upcoming online events', strategy: 'latest', slots: 8 },
      { contains: 'discover events near you', strategy: 'latest', slots: 5 },
      { contains: 'featured events', strategy: 'latest', slots: 5 },
      { contains: 'popular near you', strategy: 'popular', slots: 8 },
      { contains: 'featured news', strategy: 'latest', slots: 6 },
      { contains: 'top-rated app', strategy: 'popular', slots: 6 },
    ],
  };

  const findHeroForm = () => {
    const forms = Array.from(document.querySelectorAll('main form'));
    if (!forms.length) return null;

    const firstMainForm = forms.find((form) => !form.querySelector('input[type="email"]'));
    if (!firstMainForm) return null;

    const isHeroLike =
      firstMainForm.querySelector('input[type="search"], input[type="text"], select') &&
      firstMainForm.querySelector('button[type="submit"], .btn[type="submit"], button.btn');

    return isHeroLike ? firstMainForm : null;
  };

  const wireHeroSearch = () => {
    const heroForm = findHeroForm();
    if (!heroForm) return;

    heroForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const nextState = parseHeroState(heroForm);
      const qs = stateToQueryString(nextState);
      persistedState.q = nextState.q;
      persistedState.city = nextState.city;
      persistedState.category = nextState.category;
      syncStateLinks(persistedState);

      const nextPath = `/listings/${selectedModule}`;
      const nextUrl = `${nextPath}${qs ? `?${qs}` : ''}`;
      window.location.assign(nextUrl);
    });

    const applyCurrentInputsAsState = () => {
      const current = parseHeroState(heroForm);
      if (current.q || current.city || current.category) {
        persistedState.q = current.q;
        persistedState.city = current.city;
        persistedState.category = current.category;
      }
      syncStateLinks(persistedState);
    };

    heroForm.querySelectorAll('input[type="search"], input[type="text"], select').forEach((field) => {
      field.addEventListener('change', applyCurrentInputsAsState);
      field.addEventListener('input', applyCurrentInputsAsState);
    });
  };

  const wireViewAllLinks = () => {
    const listingUrl = `/listings/${selectedModule}`;
    const candidates = Array.from(document.querySelectorAll('main a[href="#!"], main a[href=""]'));
    candidates.forEach((link) => {
      const text = (link.textContent || '').trim().toLowerCase();
      if (!text.includes('view all') && !text.includes('browse all')) return;
      link.setAttribute('href', listingUrl);
    });
  };

  const safeSetText = (element, text) => {
    if (!element || !text) return;
    element.textContent = text;
  };

  const slugToName = (items, slug) => {
    const found = (items || []).find((item) => item.slug === slug);
    return found?.name || slug;
  };

  const upsertSelectOptions = (select, items, placeholder) => {
    if (!select || !Array.isArray(items) || !items.length) return;
    select.innerHTML = `<option value="">${placeholder}</option>${items
      .map((item) => `<option value="${item.slug}">${item.name}</option>`)
      .join('')}`;
  };

  const buildFilterHref = (basePath, extra = {}) => {
    const merged = {
      q: persistedState.q || '',
      city: persistedState.city || '',
      category: persistedState.category || '',
      ...extra,
    };
    const qs = stateToQueryString(merged);
    return `${basePath}${qs ? `?${qs}` : ''}`;
  };

  const routeForModule = (module) => ({
    contractors: '/contractors',
    'real-estate': '/real-estate',
    cars: '/cars',
    events: '/events',
    restaurants: '/restaurants',
  }[module] || '/');

  const listingsRouteForModule = (module) => ({
    contractors: '/listings/contractors',
    'real-estate': '/listings/real-estate',
    cars: '/listings/cars',
    events: '/listings/events',
    restaurants: '/listings/restaurants',
  }[module] || '/listings/contractors');

  const normalizeLegacyHref = (href) => {
    const clean = String(href || '').trim().toLowerCase();
    if (!clean) return '';

    const directMap = {
      'index.html': '/',
      '/finder/index.html': '/',
      'home-contractors.html': '/contractors',
      'home-real-estate.html': '/real-estate',
      'home-cars.html': '/cars',
      'home-events.html': '/events',
      'home-restaurants.html': '/restaurants',
      'listings-contractors.html': '/listings/contractors',
      'listings-real-estate.html': '/listings/real-estate',
      'listings-grid-cars.html': '/listings/cars',
      'listings-list-cars.html': '/listings/cars',
      'listings-events.html': '/listings/events',
      'listings-restaurants.html': '/listings/restaurants',
      'single-entry-contractors.html': '/entry/contractors',
      'single-entry-real-estate.html': '/entry/real-estate',
      'single-entry-cars.html': '/entry/cars',
      'single-entry-events.html': '/entry/events',
      'single-entry-restaurants.html': '/entry/restaurants',
    };

    if (directMap[clean]) return directMap[clean];
    return '';
  };

  const mapPlaceholderByText = (text) => {
    const t = String(text || '').trim().toLowerCase();
    if (!t) return '';

    if (t.includes('view all') || t.includes('browse all') || t.includes('see all')) {
      return buildFilterHref(listingsRouteForModule(selectedModule));
    }
    if (t === 'home' || t.includes('back to home')) return '/';
    if (t.includes('contractor')) return '/contractors';
    if (t.includes('real estate')) return '/real-estate';
    if (t === 'cars' || t.includes('car ')) return '/cars';
    if (t.includes('event')) return '/events';
    if (t.includes('restaurant')) return '/restaurants';
    if (t.includes('sign in') || t.includes('log in') || t === 'login') return '/login';
    if (t.includes('join') || t.includes('register') || t.includes('sign up')) return '/register';
    if (t.includes('my account') || t.includes('dashboard')) return '/dashboard';
    if (t.includes('my listings')) return listingsRouteForModule(selectedModule);
    if (t.includes('add listing') || t.includes('add property') || t.includes('sell car') || t.includes('add business')) {
      return '/dashboard';
    }
    return '';
  };

  const wireNonDeadLinks = () => {
    const links = Array.from(document.querySelectorAll('a[href]'));
    links.forEach((link) => {
      const href = link.getAttribute('href') || '';
      const text = link.textContent || '';

      const legacy = normalizeLegacyHref(href);
      if (legacy) {
        link.setAttribute('href', legacy);
        return;
      }

      if (href === '#!' || href === '#') {
        const mapped = mapPlaceholderByText(text);
        if (mapped) {
          link.setAttribute('href', mapped);
          return;
        }

        // Final fallback: avoid dead placeholder links in cards/navs.
        const isUiToggle = link.hasAttribute('data-bs-toggle') || link.getAttribute('role') === 'button';
        if (!isUiToggle) {
          link.setAttribute('href', buildFilterHref(listingsRouteForModule(selectedModule)));
        }
      }
    });
  };

  const normalizeListingsDropdown = () => {
    const moduleItems = [
      { href: '/listings/contractors', label: 'Contractors' },
      { href: '/listings/real-estate', label: 'Real Estate' },
      { href: '/listings/cars', label: 'Cars' },
      { href: '/listings/events', label: 'Events' },
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

  const fetchJsonWithTimeout = async (url, timeoutMs = 8000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  };

  const safeRun = (fn) => {
    try {
      fn();
    } catch (_) {
      // Preserve static Finder content on runtime errors.
    }
  };

  const renderPills = (ul, items, { includeAll = false, max = 6, onHref } = {}) => {
    if (!ul || !Array.isArray(items) || !items.length) return;
    const picked = items.slice(0, max);
    const html = [];

    if (includeAll) {
      html.push('<li class="nav-item me-1"><a class="nav-link active" aria-current="page" href="#!">All</a></li>');
    }

    picked.forEach((item, index) => {
      const href = onHref ? onHref(item) : '#!';
      const activeClass = includeAll ? '' : (index === 0 ? ' active' : '');
      const activeAttr = includeAll ? '' : (index === 0 ? ' aria-current="page"' : '');
      html.push(
        `<li class="nav-item me-1"><a class="nav-link${activeClass}"${activeAttr} href="${href}">${item.name}</a></li>`
      );
    });

    ul.innerHTML = html.join('');
  };

  const safeSetTrailingText = (holder, text) => {
    if (!holder || !text) return;
    const trailing = Array.from(holder.childNodes)
      .reverse()
      .find((node) => node.nodeType === Node.TEXT_NODE && node.textContent && node.textContent.trim().length > 0);
    if (trailing) {
      trailing.textContent = ` ${text}`;
      return;
    }
    holder.append(document.createTextNode(` ${text}`));
  };

  const syncCity = (card, item) => {
    const city = item.city?.name || '';
    if (!city) return;

    card.querySelectorAll('.fi-map-pin').forEach((icon) => {
      if (!icon.parentElement) return;
      safeSetTrailingText(icon.parentElement, city);
    });

    const pairLabel = Array.from(card.querySelectorAll('p, span, div, h6')).find((node) => {
      const text = (node.textContent || '').trim();
      return text.includes(' - ') && text.length < 64;
    });
    if (pairLabel) safeSetText(pairLabel, `${moduleLabel} - ${city}`);
  };

  const syncRating = (card, item) => {
    const rating = Number(item.rating || 0).toFixed(1);
    const reviews = Number(item.reviews_count || 0);

    card.querySelectorAll('.fi-star-filled').forEach((icon) => {
      if (!icon.parentElement) return;
      const holder = icon.parentElement;
      const spans = holder.querySelectorAll('span');
      if (spans[0]) spans[0].textContent = rating;
      if (spans[1]) spans[1].textContent = `(${reviews})`;
      if (!spans.length) safeSetTrailingText(holder, `${rating} (${reviews})`);
    });
  };

  const syncPrice = (card, item) => {
    if (!item.price) return;

    const priceRegex = /(\$|EUR|GBP|PKR|AED)|\/mo|\/month|\/day|k\b|m\b|\d{2,}/i;
    const likelyNode = Array.from(
      card.querySelectorAll('.h4, .h5, .h6, h4, h5, h6, .fw-semibold, .text-info, .text-warning')
    ).find((node) => {
      const text = (node.textContent || '').trim();
      return text.length > 0 && text.length < 40 && priceRegex.test(text);
    });

    if (likelyNode) safeSetText(likelyNode, item.price);
  };

  const formatEventDateParts = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;

    return {
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }),
    };
  };

  const syncEventDateTime = (card, item) => {
    const startsAt = item?.details?.event?.starts_at || null;
    const parts = formatEventDateParts(startsAt);
    if (!parts) return;

    const calendarIcon = card.querySelector('.fi-calendar');
    if (calendarIcon?.parentElement) {
      safeSetTrailingText(calendarIcon.parentElement, parts.date);

      const timeNode = calendarIcon.parentElement.nextElementSibling;
      if (timeNode && !timeNode.querySelector('i')) {
        safeSetText(timeNode, parts.time);
      }
    }
  };

  const syncCardMeta = (card, item) => {
    syncCity(card, item);
    syncRating(card, item);
    syncPrice(card, item);
    if (selectedModule === 'events') syncEventDateTime(card, item);
  };

  const sectionConfig = (heading) => {
    if (!heading) return { strategy: 'blend', slots: 6 };

    const scopedRules = moduleSectionRules[selectedModule] || [];
    const matchedRule = scopedRules.find((rule) => heading.includes(rule.contains));
    if (matchedRule) {
      return {
        strategy: matchedRule.strategy,
        slots: matchedRule.slots || 6,
      };
    }

    if (
      heading.includes('added today') ||
      heading.includes('recent') ||
      heading.includes('discover events near you') ||
      heading.includes('featured events')
    ) {
      return { strategy: 'latest', slots: 6 };
    }

    if (
      heading.includes('popular near you') ||
      heading.includes('popular') ||
      heading.includes('featured') ||
      heading.includes('top')
    ) {
      return { strategy: 'popular', slots: 8 };
    }

    return { strategy: 'blend', slots: 6 };
  };

  const hydrateDynamicFilters = () => {
    const categories = availableFilters.categories || [];
    const cities = availableFilters.cities || [];
    if (!categories.length && !cities.length) return;

    if (selectedModule === 'contractors') {
      const heroPills = document.querySelector('section h1 + form + div.d-flex.flex-wrap.justify-content-center');
      if (heroPills && categories.length) {
        heroPills.innerHTML = categories.slice(0, 5).map((item) =>
          `<a class="btn btn-outline-light rounded-pill mt-1 me-1" href="${buildFilterHref('/listings/contractors', { category: item.slug })}">${item.name}</a>`
        ).join('');
      }

      const topCitiesList = Array.from(document.querySelectorAll('h6')).find((h) =>
        (h.textContent || '').toLowerCase().includes('top cities')
      )?.parentElement?.querySelector('ul.nav.nav-pills');
      if (topCitiesList && cities.length) {
        topCitiesList.innerHTML = cities.slice(0, 10).map((item) =>
          `<li class="nav-item"><a class="nav-link" aria-current="page" href="${buildFilterHref('/listings/contractors', { city: item.slug })}">${item.name}</a></li>`
        ).join('');
      }
    }

    if (selectedModule === 'real-estate') {
      const propertyTypeSelect = document.querySelector('select[aria-label="Property type select"]');
      upsertSelectOptions(propertyTypeSelect, categories, 'Property type');

      const locationSelect = document.querySelector('select[aria-label="Location select"]');
      upsertSelectOptions(locationSelect, cities, 'Location');

      const addedTodayPills = Array.from(document.querySelectorAll('h2')).find((h) =>
        (h.textContent || '').toLowerCase().includes('added today')
      )?.parentElement?.querySelector('ul.nav.nav-pills');
      if (addedTodayPills) {
        renderPills(addedTodayPills, categories, {
          includeAll: true,
          max: 4,
          onHref: (item) => buildFilterHref('/listings/real-estate', { category: item.slug }),
        });
      }
    }

    if (selectedModule === 'cars') {
      const bodyTypeSelect = document.querySelector('select[aria-label="Car body type select"]');
      upsertSelectOptions(bodyTypeSelect, categories, 'Body type');

      const locationSelect = document.querySelector('select[aria-label="Car location select"]');
      upsertSelectOptions(locationSelect, cities, 'Location');

      const latestPills = Array.from(document.querySelectorAll('h2')).find((h) =>
        (h.textContent || '').toLowerCase().includes('latest cars')
      )?.parentElement?.querySelector('ul.nav.nav-pills');
      if (latestPills) {
        renderPills(latestPills, categories, {
          includeAll: true,
          max: 3,
          onHref: (item) => buildFilterHref('/listings/cars', { category: item.slug }),
        });
      }
    }

    if (selectedModule === 'events') {
      const locationSelect = document.querySelector('select[aria-label="Location select"]');
      upsertSelectOptions(locationSelect, cities, 'Location');

      const categorySelect = document.querySelector('select[aria-label="Category select"]');
      upsertSelectOptions(categorySelect, categories, 'Category');

      const circleCategoryAnchors = Array.from(
        document.querySelectorAll('a.nav-link.flex-column.justify-content-center.gap-2.flex-shrink-0.rounded-circle')
      );
      if (circleCategoryAnchors.length && categories.length) {
        circleCategoryAnchors.forEach((anchor, index) => {
          const item = categories[index % categories.length];
          const svg = anchor.querySelector('svg');
          anchor.innerHTML = '';
          if (svg) anchor.appendChild(svg);
          anchor.append(document.createTextNode(item.name));
          anchor.setAttribute('href', buildFilterHref('/listings/events', { category: item.slug }));
        });
      }

      const popularNearPills = Array.from(document.querySelectorAll('h2')).find((h) =>
        (h.textContent || '').toLowerCase().includes('popular near you')
      )?.parentElement?.querySelector('ul.nav.nav-pills');
      if (popularNearPills) {
        renderPills(popularNearPills, categories, {
          includeAll: true,
          max: 4,
          onHref: (item) => buildFilterHref('/listings/events', { category: item.slug }),
        });
      }
    }
  };

  const hydrateListingAnchors = (feed) => {
    const anchors = Array.from(
      document.querySelectorAll(
        `main a[href="/entry/${selectedModule}"], main a[href^="/entry/${selectedModule}?"], main a[href="/listings/${selectedModule}"], main a[href^="/listings/${selectedModule}?"]`
      )
    );
    if (!anchors.length) return;

    const popular = Array.isArray(feed?.popular) ? feed.popular : [];
    const latest = Array.isArray(feed?.latest) ? feed.latest : [];
    if (!popular.length && !latest.length) return;

    const cards = [];
    const seenCards = new Set();
    anchors.forEach((anchor) => {
      const card = anchor.closest('article, .card');
      if (!card || seenCards.has(card)) return;
      seenCards.add(card);
      cards.push(card);
    });
    if (!cards.length) return;

    const cursors = { popular: 0, latest: 0 };
    const usedSlugs = new Set();
    let blendToggle = 0;

    const nextUnique = (sourceName) => {
      const source = sourceName === 'popular' ? popular : latest;
      if (!source.length) return null;

      for (let attempt = 0; attempt < source.length; attempt += 1) {
        const candidate = source[cursors[sourceName] % source.length];
        cursors[sourceName] += 1;
        if (!candidate?.slug || !usedSlugs.has(candidate.slug)) {
          if (candidate?.slug) usedSlugs.add(candidate.slug);
          return candidate;
        }
      }

      const fallback = source[(cursors[sourceName] - 1 + source.length) % source.length];
      if (fallback?.slug) usedSlugs.add(fallback.slug);
      return fallback;
    };

    const nextByStrategy = (strategy) => {
      if (strategy === 'popular') return nextUnique('popular') || nextUnique('latest');
      if (strategy === 'latest') return nextUnique('latest') || nextUnique('popular');

      if (popular.length && latest.length) {
        const sourceName = blendToggle % 2 === 0 ? 'popular' : 'latest';
        blendToggle += 1;
        return nextUnique(sourceName) || nextUnique(sourceName === 'popular' ? 'latest' : 'popular');
      }

      return nextUnique(popular.length ? 'popular' : 'latest');
    };

    const sectionMeta = new WeakMap();
    const sectionOrder = [];
    const grouped = new Map();
    let sectionCounter = 0;

    cards.forEach((card) => {
      const section = card.closest('section') || card.closest('main');
      if (!sectionMeta.has(section)) {
        const heading = (section.querySelector('h1, h2, h3')?.textContent || '').trim().toLowerCase();
        const config = sectionConfig(heading);
        sectionMeta.set(section, {
          id: `section-${sectionCounter}`,
          heading,
          strategy: config.strategy,
          slots: config.slots,
        });
        sectionCounter += 1;
      }

      const meta = sectionMeta.get(section);
      if (!grouped.has(meta.id)) {
        grouped.set(meta.id, []);
        sectionOrder.push(meta.id);
      }
      grouped.get(meta.id).push(card);
    });

    sectionOrder.forEach((sectionId) => {
      const sectionCards = grouped.get(sectionId) || [];
      const meta = sectionCards.length
        ? sectionMeta.get(sectionCards[0].closest('section') || sectionCards[0].closest('main'))
        : { heading: '', strategy: 'blend', slots: 6 };
      const strategy = meta?.strategy || 'blend';
      const slotCount = Math.max(1, Number(meta?.slots || 6));
      const heading = String(meta?.heading || '');

      const sectionPool = [];
      // Keep newest car visible in "Latest cars" section even if used in other sections.
      if (selectedModule === 'cars' && heading.includes('latest cars') && latest.length) {
        const newest = latest[0];
        if (newest?.slug) usedSlugs.add(newest.slug);
        sectionPool.push(newest);
      }
      // Keep newest real-estate listing visible in recent sections.
      if (
        selectedModule === 'real-estate' &&
        (heading.includes('added today') || heading.includes('recently added') || heading.includes('recent')) &&
        latest.length
      ) {
        const newestProperty = latest[0];
        if (newestProperty?.slug) usedSlugs.add(newestProperty.slug);
        sectionPool.push(newestProperty);
      }
      // Keep newest event visible in "Upcoming Online Events" section.
      if (selectedModule === 'events' && heading.includes('upcoming online events') && latest.length) {
        const newestEvent = latest[0];
        if (newestEvent?.slug) usedSlugs.add(newestEvent.slug);
        sectionPool.push(newestEvent);
      }

      for (let i = 0; i < slotCount; i += 1) {
        const pooledItem = nextByStrategy(strategy);
        if (!pooledItem) break;
        sectionPool.push(pooledItem);
      }
      if (!sectionPool.length) return;

      sectionCards.forEach((card, index) => {
        const item = sectionPool[index % sectionPool.length];
        if (!item) return;

        const entryHref = detailUrl(item);
        card
          .querySelectorAll(
            `a[href="/entry/${selectedModule}"], a[href^="/entry/${selectedModule}?"], a[href="/listings/${selectedModule}"], a[href^="/listings/${selectedModule}?"], a[href="#!"], a[href="#"]`
          )
          .forEach((a) => {
            const isUiToggle = a.hasAttribute('data-bs-toggle') || a.getAttribute('role') === 'button';
            if (!isUiToggle) a.setAttribute('href', entryHref);
          });

        const image = card.querySelector('img');
        if (image && item.image_url) {
          image.setAttribute('src', item.image_url);
          image.setAttribute('alt', item.title || 'Listing image');
          image.setAttribute('onerror', "this.onerror=null;this.src='/finder/assets/img/placeholders/preview-square.svg';");
        }

        const titleNode = card.querySelector('h3 a, h4 a, h5 a, h6 a');
        if (titleNode) {
          titleNode.textContent = item.title;
          titleNode.setAttribute('href', entryHref);
        }

        card.style.cursor = 'pointer';
        if (!card.dataset.monaclickCardClickBound) {
          card.addEventListener('click', (event) => {
            if (event.target.closest('a, button, [role="button"]')) return;
            window.location.assign(entryHref);
          });
          card.dataset.monaclickCardClickBound = '1';
        }

        syncCardMeta(card, item);
      });
    });
  };

  const syncUpcomingDateRail = (latest) => {
    if (selectedModule !== 'events') return;
    if (!Array.isArray(latest) || !latest.length) return;

    const section = Array.from(document.querySelectorAll('section')).find((sec) =>
      (sec.querySelector('h1, h2, h3')?.textContent || '').trim().toLowerCase().includes('upcoming online events')
    );
    if (!section) return;

    const dateSlides = Array.from(
      section.querySelectorAll('.swiper[data-swiper*="controlSlider"] .swiper-slide')
    );
    if (!dateSlides.length) return;

    const uniqueDays = [];
    const seen = new Set();

    latest.forEach((item) => {
      const startsAt = item?.details?.event?.starts_at;
      if (!startsAt) return;

      const d = new Date(startsAt);
      if (Number.isNaN(d.getTime())) return;

      const dayKey = d.toISOString().slice(0, 10);
      if (seen.has(dayKey)) return;
      seen.add(dayKey);
      uniqueDays.push(d);
    });

    if (!uniqueDays.length) return;

    dateSlides.forEach((slide, index) => {
      const d = uniqueDays[index];
      if (!d) return;
      const dayNode = slide.querySelector('.display-3');
      const monthNode = slide.querySelector('.text-body-secondary');
      if (dayNode) dayNode.textContent = String(d.getDate());
      if (monthNode) {
        monthNode.textContent = d.toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        });
      }
    });
  };

  safeRun(wireHeroSearch);
  safeRun(wireViewAllLinks);
  safeRun(wireNonDeadLinks);
  safeRun(normalizeListingsDropdown);
  safeRun(() => syncStateLinks(persistedState));

  Promise.allSettled([
    fetchJsonWithTimeout(`/api/monaclick/listings?module=${encodeURIComponent(selectedModule)}&per_page=24&sort=rating`),
    fetchJsonWithTimeout(`/api/monaclick/listings?module=${encodeURIComponent(selectedModule)}&per_page=24`),
  ]).then(([popularResult, latestResult]) => {
    const popularPayload = popularResult.status === 'fulfilled' ? popularResult.value : null;
    const latestPayload = latestResult.status === 'fulfilled' ? latestResult.value : null;

    const popular = Array.isArray(popularPayload?.data) ? popularPayload.data : [];
    const latest = Array.isArray(latestPayload?.data) ? latestPayload.data : [];

    if (!popular.length && !latest.length) {
      // Keep static Finder content as fallback when both endpoints fail.
      return;
    }

    availableFilters = {
      categories: Array.isArray(popularPayload?.filters?.categories)
        ? popularPayload.filters.categories
        : (Array.isArray(latestPayload?.filters?.categories) ? latestPayload.filters.categories : []),
      cities: Array.isArray(popularPayload?.filters?.cities)
        ? popularPayload.filters.cities
        : (Array.isArray(latestPayload?.filters?.cities) ? latestPayload.filters.cities : []),
    };
    safeRun(hydrateDynamicFilters);
    safeRun(() => syncUpcomingDateRail(latest));
    safeRun(() => hydrateListingAnchors({ popular, latest }));
  });
})();
