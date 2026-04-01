(() => {
  window.__MC_LISTINGS_DYNAMIC_VERSION__ = '2026-03-26-r5';
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

  const numberFormatter = typeof Intl !== 'undefined'
    ? new Intl.NumberFormat('en-US')
    : null;

  const formatDisplayedPrice = (value) => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';

    return raw.replace(/\d[\d,]*(?:\.\d+)?/g, (match) => {
      const cleaned = match.replace(/,/g, '');
      if (!/^\d+(\.\d+)?$/.test(cleaned)) return match;
      const n = Number(cleaned);
      if (!Number.isFinite(n)) return match;
      return numberFormatter ? numberFormatter.format(n) : match;
    });
  };

  const compareStorageKey = 'mc_related_compare_v1';
  const compareItemsStorageKey = 'mc_related_compare_items_v1';
  const favoritesStorageKey = 'mc_related_favorites_v1';
  const favoriteItemsStorageKey = 'mc_related_favorite_items_v1';
  const alertsStorageKey = 'mc_related_alerts_v1';
  const supportsMultiCategory = selectedModule === 'real-estate' || selectedModule === 'contractors';
  const contractorPriceStep = selectedModule === 'contractors' ? 100 : null;
  const supportsDynamicLocationFilters = selectedModule === 'cars' || selectedModule === 'contractors' || selectedModule === 'real-estate' || selectedModule === 'restaurants';

  const slugify = (value) =>
    String(value ?? '')
      .trim()
      .toLowerCase()
      .replaceAll('&', ' and ')
      .replaceAll(/[^a-z0-9]+/g, '-')
      .replaceAll(/-+/g, '-')
      .replaceAll(/^-|-$/g, '');

  const titleizeSlug = (value) =>
    String(value || '')
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

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
        stateSelect: supportsDynamicLocationFilters
          ? document.querySelector('select[data-location-state], select[aria-label="Car state select"]')
          : null,
        citySelect: document.querySelector('select[data-location-city], select[aria-label="Car location select"]'),
        radiusSelect: supportsDynamicLocationFilters
          ? document.querySelector('select[aria-label="Location radius select"]')
          : null,
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
        listContainer:
          document.querySelector('.col-lg-9 .row.row-cols-1.row-cols-sm-2.row-cols-md-3.row-cols-lg-2.row-cols-xl-3.g-4.g-sm-3.g-lg-4')
          || document.querySelector('.col-lg-9 .vstack.gap-4'),
        resultsText,
        topResultsText: document.querySelector('.content-wrapper .container > .d-flex.align-items-center.gap-3.border-bottom .fs-sm.text-nowrap'),
        breadcrumbActive: document.querySelector('.content-wrapper .container > nav[aria-label="breadcrumb"] .breadcrumb-item.active'),
        paginationNav: document.querySelector('.col-lg-9 nav[aria-label="Listings pagination"]'),
        searchInput: null,
        stateSelect: document.querySelector('select[data-location-state], select[aria-label="Car state select"]'),
        citySelect: document.querySelector('select[data-location-city], select[aria-label="Car location select"]'),
        radiusSelect: document.querySelector('select[aria-label="Location radius select"]'),
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
        searchInput: null,
        stateSelect: document.querySelector('.listings-section select[data-location-state], .listings-section select[aria-label="Property state select"]'),
        citySelect: document.querySelector('.listings-section select[data-location-city], .listings-section select[aria-label="Property city select"]'),
        radiusSelect: document.querySelector('.listings-section select[aria-label="Location radius select"]'),
        categoryList: null,
        sortSelect: document.querySelector('.listings-section .position-relative.ms-auto select'),
        clearAllLink: document.querySelector('.listings-section a[data-real-estate-clear-all]'),
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
    topResultsText,
    breadcrumbActive,
    paginationNav,
    searchInput,
    stateSelect,
    citySelect,
    radiusSelect,
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

  const initialListMarkup = listContainer.innerHTML;
  const initialResultsMarkup = resultsText ? resultsText.textContent : '';
  let listingsAbortController = null;
  let listingsRequestToken = 0;
  let loadingUiTimer = null;
  const listingsResponseCache = new Map();
  const restoreInitialListIfEmpty = () => {
    try {
      if (!listContainer) return;
      listContainer.style.opacity = '1';
      if (!String(listContainer.innerHTML || '').trim() && String(initialListMarkup || '').trim()) {
        listContainer.innerHTML = initialListMarkup;
      }
      if (resultsNode && String(initialResultsMarkup || '').trim()) {
        resultsNode.textContent = initialResultsMarkup;
      }
    } catch (_) {
      // ignore
    }
  };

  // If any runtime error happens after we clear/hide the container, restore the initial server-rendered markup
  // so listings don't "flash then disappear" on production.
  window.addEventListener('error', restoreInitialListIfEmpty);
  window.addEventListener('unhandledrejection', restoreInitialListIfEmpty);

  // Prevent template placeholder cards from flashing before the API response replaces them.
  try {
    listContainer.style.opacity = '0';
    listContainer.style.transition = 'opacity 140ms ease';
    listContainer.innerHTML = '';
  } catch (_) {
    // ignore
  }

  const setListingsLoading = (isLoading) => {
    try {
      listContainer.style.transition = 'opacity 140ms ease';
      listContainer.style.opacity = isLoading ? '0.55' : '1';
      listContainer.style.pointerEvents = isLoading ? 'none' : '';
    } catch (_) {
      // ignore
    }
  };


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
  const compareLink = selectedModule === 'cars'
    ? Array.from(document.querySelectorAll('.nav a.nav-link')).find((el) => /compare\s*\(/i.test((el.textContent || '').trim()))
    : null;
  const gridViewLink = selectedModule === 'cars'
    ? document.querySelector('a[aria-label="Grid view"]')
    : null;
  const listViewLink = selectedModule === 'cars'
    ? document.querySelector('a[aria-label="List view"]')
    : null;
  const carYearSelects = selectedModule === 'cars'
    ? Array.from(document.querySelectorAll('select[aria-label="Car year from select"], select[aria-label="Car year to select"]'))
    : [];
  const carYearMinSelect = carYearSelects[0] || null;
  const carYearMaxSelect = carYearSelects[1] || null;
  const carMakeSelect = selectedModule === 'cars'
    ? document.querySelector('select[aria-label="Car make select"]')
    : null;
  const carModelSelect = selectedModule === 'cars'
    ? document.querySelector('select[aria-label="Car model select"]')
    : null;
  const carsBodyTypeChecks = selectedModule === 'cars'
    ? Array.from(document.querySelectorAll('#sedan, #suv, #wagon, #crossover, #coupe, #pickup, #sport, #compact'))
    : [];
  const carsDriveTypeChecks = selectedModule === 'cars'
    ? Array.from(document.querySelectorAll('#awd, #fwd, #rwd'))
    : [];
  const carsFuelTypeChecks = selectedModule === 'cars'
    ? Array.from(document.querySelectorAll('#gas, #diesel, #electric, #hybrid, #plugin, #hydrogen'))
    : [];
  const carsTransmissionChecks = selectedModule === 'cars'
    ? Array.from(document.querySelectorAll('#auto, #manual'))
    : [];
  const carsColorChecks = selectedModule === 'cars'
    ? Array.from(document.querySelectorAll('#amber, #azure, #beige, #black, #blue, #brown, #camouflage, #charcoal, #gray, #green, #gold, #purple, #red, #white, #yellow'))
    : [];
  const carsSellerChecks = selectedModule === 'cars'
    ? Array.from(document.querySelectorAll('#dealers, #private'))
    : [];
  const carsMileageInputs = selectedModule === 'cars'
    ? (Array.from(document.querySelectorAll('h4.h6'))
        .find((node) => (node.textContent || '').trim().toLowerCase() === 'mileage')
        ?.nextElementSibling?.querySelectorAll?.('input[type="number"]') || [])
    : [];
  const carsMileageMinInput = carsMileageInputs[0] || null;
  const carsMileageMaxInput = carsMileageInputs[1] || null;
  const realEstateLocationInputs = selectedModule === 'real-estate'
    ? Array.from(document.querySelectorAll('.listings-section input[type="search"], #filters input[type="search"]'))
    : [];
  const realEstateTypeCheckboxes = selectedModule === 'real-estate'
    ? Array.from(document.querySelectorAll('#typeCount, #typeCountOffcanvas'))
        .map((countNode) => countNode?.closest('.dropdown')?.querySelectorAll('input[type="checkbox"][data-count-id]'))
        .flatMap((nodes) => Array.from(nodes || []))
    : [];
  const realEstateBedrooms = selectedModule === 'real-estate'
    ? Array.from(document.querySelectorAll('input[name="bedrooms"]'))
    : [];
  const realEstateBathrooms = selectedModule === 'real-estate'
    ? Array.from(document.querySelectorAll('input[name="bathrooms"]'))
    : [];
  const realEstateAreaMinInput = selectedModule === 'real-estate'
    ? document.querySelector('#filters h6 + .d-flex input[type="number"]')
    : null;
  const realEstateAreaInputs = selectedModule === 'real-estate'
    ? Array.from(document.querySelectorAll('#filters h6'))
        .find((node) => (node.textContent || '').trim().toLowerCase() === 'square metres')
        ?.nextElementSibling?.querySelectorAll?.('input[type="number"]') || []
    : [];
  const realEstateAreaMin = realEstateAreaInputs[0] || null;
  const realEstateAreaMax = realEstateAreaInputs[1] || null;
  const realEstateYearMin = selectedModule === 'real-estate'
    ? document.querySelector('select[aria-label="Min year built select"]')
    : null;
  const realEstateYearMax = selectedModule === 'real-estate'
    ? document.querySelector('select[aria-label="Max year built select"]')
    : null;
  const realEstateFeatureCheckboxes = selectedModule === 'real-estate'
    ? Array.from(document.querySelectorAll('#filters .form-check-input[type="checkbox"]'))
        .filter((input) => !input.hasAttribute('data-count-id'))
    : [];
  const realEstateClearAllLink = selectedModule === 'real-estate'
    ? Array.from(document.querySelectorAll('#filters a.nav-link')).find((link) => (link.textContent || '').trim().toLowerCase() === 'clear all')
    : null;
  const realEstateApplyButton = selectedModule === 'real-estate'
    ? document.querySelector('#filters .btn.btn-primary[data-bs-dismiss="offcanvas"]')
    : null;
  const realEstateFilterBadge = selectedModule === 'real-estate'
    ? document.querySelector('button[data-bs-target="#filters"]')?.previousElementSibling
    : null;
  const realEstateHomeTypeIds = {
    apartments: 'apartments',
    houses: 'family-homes',
    house: 'family-homes',
    'family-homes': 'family-homes',
    familyhomes: 'family-homes',
    condos: 'condos',
    townhomes: 'townhouses',
    townhome: 'townhouses',
    townhouses: 'townhouses',
    townhouse: 'townhouses',
    'commercial-spaces': 'commercial-spaces',
    commercialspaces: 'commercial-spaces',
    'luxury-apartments': 'luxury-apartments',
    luxuryapartments: 'luxury-apartments',
  };
  const realEstateHomeTypeLabels = {
    apartments: 'Apartments',
    'family-homes': 'Houses',
    condos: 'Condos',
    townhouses: 'Townhomes',
    'commercial-spaces': 'Commercial Spaces',
    'luxury-apartments': 'Luxury Apartments',
  };
  const realEstateFeatureMap = {
    ac: 'air-conditioning',
    balcony: 'balcony',
    garage: 'garage',
    gym: 'gym',
    parking: 'parking',
    pool: 'pool',
    cctv: 'security-cameras',
    wifi: 'wifi',
    laundry: 'laundry',
    dishwasher: 'dishwasher',
    verified: 'verified',
    featured: 'featured',
  };

  const ensureRealEstateListingTypeOptions = () => {
    if (selectedModule !== 'real-estate') return;
    listingTypeSelects.forEach((select) => {
      const hasAllOption = Array.from(select.options).some((option) => String(option.value || '').trim() === '');
      if (hasAllOption) return;
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'All listings';
      select.insertBefore(option, select.firstChild);
    });
  };
  ensureRealEstateListingTypeOptions();

  const readStoredCompareSlugs = () => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(compareStorageKey) || '[]');
      return Array.isArray(parsed) ? parsed.map((value) => String(value || '').trim()).filter(Boolean) : [];
    } catch (e) {
      return [];
    }
  };

  const readStoredCompareItems = () => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(compareItemsStorageKey) || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (e) {
      return {};
    }
  };

  const writeStoredCompare = (slugs, items) => {
    try {
      window.localStorage.setItem(compareStorageKey, JSON.stringify(slugs));
      window.localStorage.setItem(compareItemsStorageKey, JSON.stringify(items));
    } catch (e) {
      // no-op
    }
  };

  const readStoredSlugs = (key) => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(key) || '[]');
      return Array.isArray(parsed) ? parsed.map((value) => String(value || '').trim()).filter(Boolean) : [];
    } catch (e) {
      return [];
    }
  };

  const readStoredMap = (key) => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(key) || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (e) {
      return {};
    }
  };

  const writeStoredMap = (key, value) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value || {}));
    } catch (e) {
      // no-op
    }
  };

  const writeStoredList = (key, value) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(Array.from(new Set((value || []).map((entry) => String(entry || '').trim()).filter(Boolean)))));
    } catch (e) {
      // no-op
    }
  };

  const removeLegacyCarsPriceFilter = () => {
    if (selectedModule !== 'cars') return;
    const legacyRange = document.querySelector('[data-range-slider]');
    const legacyBlock = legacyRange?.closest('.pb-4.mb-2.mb-xl-3');
    if (legacyBlock) {
      legacyBlock.remove();
    }
  };

  const showCarsToast = (message) => {
    const id = 'mc-cars-list-toast';
    let toast = document.getElementById(id);
    if (!toast) {
      toast = document.createElement('div');
      toast.id = id;
      toast.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:1085;max-width:320px;background:#1f2937;color:#fff;padding:12px 14px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.2);font-size:14px;line-height:1.45;opacity:0;transform:translateY(8px);transition:opacity .18s ease, transform .18s ease;';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    clearTimeout(showCarsToast._timer);
    showCarsToast._timer = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
    }, 1800);
  };

  const ensureDualPriceSliderStyles = () => {
    const styleId = 'mc-dual-price-slider-style';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      [data-price-wrap] input[type="range"][data-price-min-slider],
      [data-price-wrap] input[type="range"][data-price-max-slider]{
        background: transparent;
        pointer-events: none;
      }
      [data-price-wrap] input[type="range"][data-price-min-slider]::-webkit-slider-thumb,
      [data-price-wrap] input[type="range"][data-price-max-slider]::-webkit-slider-thumb{
        pointer-events: auto;
        position: relative;
      }
      [data-price-wrap] input[type="range"][data-price-min-slider]::-moz-range-thumb,
      [data-price-wrap] input[type="range"][data-price-max-slider]::-moz-range-thumb{
        pointer-events: auto;
      }
    `;
    document.head.appendChild(style);
  };

  const getStateFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const budgetMax = Number.parseInt(params.get('budget_max') || '', 10);
    const priceMin = Number.parseInt(params.get('price_min') || '', 10);
    const priceMax = Number.parseInt(params.get('price_max') || '', 10);
    const radius = Number.parseInt(String(params.get('radius') || '').replace(/[^\d]/g, ''), 10);
    const areaMin = Number.parseInt(params.get('area_min') || '', 10);
    const areaMax = Number.parseInt(params.get('area_max') || '', 10);
    const bedrooms = Number.parseInt(params.get('bedrooms') || '', 10);
    const bathrooms = Number.parseInt(params.get('bathrooms') || '', 10);
    const yearBuiltMin = Number.parseInt(params.get('year_built_min') || '', 10);
    const yearBuiltMax = Number.parseInt(params.get('year_built_max') || '', 10);
    const carYearMin = Number.parseInt(params.get('year_min') || '', 10);
    const carYearMax = Number.parseInt(params.get('year_max') || '', 10);
    const carMileageMin = Number.parseInt(params.get('mileage_min') || '', 10);
    const carMileageMax = Number.parseInt(params.get('mileage_max') || '', 10);
    const listingTypeRaw = selectedModule === 'real-estate'
      ? (params.get('listing_type') || '')
      : '';
    const categories = supportsMultiCategory
      ? (params.get('category') || '')
        .split(',')
        .map((v) => String(v || '').trim())
        .filter(Boolean)
      : [];
    const normalizedCategories = selectedModule === 'real-estate'
      ? Array.from(new Set(categories.map((value) => realEstateHomeTypeIds[slugify(value)] || slugify(value)).filter(Boolean)))
      : categories;
    const features = selectedModule === 'real-estate'
      ? (params.get('features') || '')
        .split(',')
        .map((v) => String(v || '').trim())
        .filter(Boolean)
      : [];
    const driveTypes = selectedModule === 'cars'
      ? (params.get('drive_type') || '')
        .split(',')
        .map((v) => String(v || '').trim().toLowerCase())
        .filter(Boolean)
      : [];
    const fuelTypes = selectedModule === 'cars'
      ? (params.get('fuel_type') || '')
        .split(',')
        .map((v) => String(v || '').trim().toLowerCase())
        .filter(Boolean)
      : [];
    const transmissions = selectedModule === 'cars'
      ? (params.get('transmission') || '')
        .split(',')
        .map((v) => String(v || '').trim().toLowerCase())
        .filter(Boolean)
      : [];
    const bodyTypes = selectedModule === 'cars'
      ? (params.get('body_type') || '')
        .split(',')
        .map((v) => String(v || '').trim().toLowerCase())
        .filter(Boolean)
      : [];
    return {
      q: cleanSearchTerm(params.get('q') || ''),
      state: supportsDynamicLocationFilters ? String(params.get('state') || '').trim().toUpperCase() : '',
      city: params.get('city') || '',
      category: supportsMultiCategory ? '' : (params.get('category') || ''),
      categories: normalizedCategories,
      features,
      body_types: bodyTypes,
      drive_types: driveTypes,
      fuel_types: fuelTypes,
      transmissions,
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
      area_min: Number.isInteger(areaMin) && areaMin > 0 ? areaMin : 0,
      area_max: Number.isInteger(areaMax) && areaMax > 0 ? areaMax : 0,
      bedrooms: Number.isInteger(bedrooms) && bedrooms > 0 ? bedrooms : 0,
      bathrooms: Number.isInteger(bathrooms) && bathrooms > 0 ? bathrooms : 0,
      year_built_min: Number.isInteger(yearBuiltMin) && yearBuiltMin > 0 ? yearBuiltMin : 0,
      year_built_max: Number.isInteger(yearBuiltMax) && yearBuiltMax > 0 ? yearBuiltMax : 0,
      year_min: selectedModule === 'cars' && Number.isInteger(carYearMin) && carYearMin > 0 ? carYearMin : 0,
      year_max: selectedModule === 'cars' && Number.isInteger(carYearMax) && carYearMax > 0 ? carYearMax : 0,
      mileage_min: selectedModule === 'cars' && Number.isInteger(carMileageMin) && carMileageMin > 0 ? carMileageMin : 0,
      mileage_max: selectedModule === 'cars' && Number.isInteger(carMileageMax) && carMileageMax > 0 ? carMileageMax : 0,
      make: selectedModule === 'cars' ? String(params.get('make') || '').trim() : '',
      model: selectedModule === 'cars' ? String(params.get('model') || '').trim() : '',
      availability: params.get('availability') === '1',
      stock: selectedModule === 'cars' ? (params.get('stock') || '') : '',
      radius: supportsDynamicLocationFilters && Number.isInteger(radius) && radius > 0 ? radius : 0,
      view: selectedModule === 'cars' ? ((params.get('view') || 'grid').toLowerCase() === 'list' ? 'list' : 'grid') : 'grid',
      page: Number.parseInt(params.get('page') || '1', 10) || 1,
    };
  };

  let state = getStateFromUrl();
  if (selectedModule === 'real-estate') {
    state.budget_max = 0;
    state.categories = Array.isArray(state.categories) ? state.categories : [];
    state.features = Array.isArray(state.features) ? state.features : [];
  }
  if (selectedModule === 'contractors') {
    state.categories = Array.isArray(state.categories) ? state.categories : [];
  }
  let lastFilters = {
    categories: [],
    cities: [],
    carYears: [],
    carMakes: [],
    carModels: [],
    carBodyTypes: [],
    carDriveTypes: [],
    carFuelTypes: [],
    carTransmissions: [],
  };
  let lastRenderedItems = [];
  let availableStates = [];
  let citiesRequestToken = 0;

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

  const refreshEnhancedSelect = (select) => {
    if (!select) return;
    const shouldUseNativeSelect = select.matches('select[aria-label="Car year from select"], select[aria-label="Car year to select"]');
    const parseChoicesConfig = () => {
      try {
        const raw = select.getAttribute('data-select');
        return raw ? JSON.parse(raw) : {};
      } catch (_) {
        return {};
      }
    };

    const wrapper = select.parentElement?.classList?.contains('choices') ? select.parentElement : null;
    const choices = select.__mcChoices;
    if (choices && typeof choices.destroy === 'function') {
      try {
        choices.destroy();
      } catch (_) {
        // ignore
      }
      select.__mcChoices = null;
    }

    if (wrapper && wrapper.parentNode) {
      wrapper.parentNode.insertBefore(select, wrapper);
      wrapper.remove();
    }
    select.style.display = '';
    select.hidden = false;

    if (shouldUseNativeSelect) {
      return;
    }

    if (typeof window.Choices === 'function') {
      try {
        select.__mcChoices = new window.Choices(select, parseChoicesConfig());
      } catch (_) {
        // ignore
      }
    }
  };

  const populateSelectOptions = (select, items, placeholder, selectedValue = '', disabled = false) => {
    if (!select) return;
    const normalizedSelectedValue = String(selectedValue || '').trim();
    select.innerHTML = [
      `<option value="">${escapeHtml(placeholder)}</option>`,
      ...items.map((item) => {
        const value = String(item?.value ?? '');
        const label = String(item?.label ?? value);
        const selected = normalizedSelectedValue !== '' && normalizedSelectedValue === value ? ' selected' : '';
        return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(label)}</option>`;
      }),
    ].join('');
    select.disabled = !!disabled;
    refreshEnhancedSelect(select);
  };

  const withSelectedOption = (items, selectedValue) => {
    const normalizedSelectedValue = String(selectedValue || '').trim();
    if (!normalizedSelectedValue) return Array.isArray(items) ? items : [];
    const list = Array.isArray(items) ? items.slice() : [];
    const exists = list.some((item) => String(item?.value ?? '').trim() === normalizedSelectedValue);
    if (!exists) {
      list.unshift({
        value: normalizedSelectedValue,
        label: normalizedSelectedValue,
      });
    }
    return list;
  };

  const syncCarSpecFilters = () => {
    if (selectedModule !== 'cars') return;

    if (carYearMinSelect) {
      populateSelectOptions(
        carYearMinSelect,
        withSelectedOption(lastFilters.carYears || [], state.year_min ? String(state.year_min) : ''),
        'From',
        state.year_min ? String(state.year_min) : '',
        false
      );
    }

    if (carYearMaxSelect) {
      populateSelectOptions(
        carYearMaxSelect,
        withSelectedOption(lastFilters.carYears || [], state.year_max ? String(state.year_max) : ''),
        'To',
        state.year_max ? String(state.year_max) : '',
        false
      );
    }

    if (carMakeSelect) {
      populateSelectOptions(
        carMakeSelect,
        withSelectedOption(lastFilters.carMakes || [], state.make || ''),
        'Any make',
        state.make || '',
        false
      );
    }

    if (carModelSelect) {
      const hasMake = !!String(state.make || '').trim();
      const models = withSelectedOption(lastFilters.carModels || [], state.model || '');
      populateSelectOptions(
        carModelSelect,
        models,
        hasMake ? 'Any model' : 'Any model',
        state.model || '',
        false
      );
    }
  };

  const syncCarsCheckboxFilter = (inputs, items, activeValues) => {
    const countMap = new Map(
      (Array.isArray(items) ? items : []).map((item) => [String(item?.value || '').trim(), Number.parseInt(item?.count, 10) || 0])
    );

    inputs.forEach((input) => {
      const value = String(input.id || '').trim().toLowerCase();
      const count = countMap.has(value) ? (countMap.get(value) || 0) : 0;
      const label = input.closest('.form-check')?.querySelector('label');
      input.checked = Array.isArray(activeValues) ? activeValues.includes(value) : false;
      input.disabled = count <= 0;

      if (label) {
        const baseLabel = String(label.getAttribute('data-base-label') || label.textContent || '').replace(/\s+\(\d+\)\s*$/, '').trim();
        label.setAttribute('data-base-label', baseLabel);
        label.textContent = `${baseLabel} (${count})`;
        label.classList.toggle('text-muted', count <= 0);
      }

      const row = input.closest('.form-check');
      if (row) {
        row.style.opacity = count <= 0 ? '0.45' : '';
        row.style.pointerEvents = count <= 0 ? 'none' : '';
      }
    });
  };

  const syncDynamicLocationAvailability = () => {
    if (!supportsDynamicLocationFilters || !citySelect) return;
    const hasState = !!String(state.state || '').trim();
    if (!hasState) {
      populateSelectOptions(citySelect, [], 'Select state first', '', true);
      return;
    }
    citySelect.disabled = false;
    refreshEnhancedSelect(citySelect);
  };

  const loadDynamicStates = async () => {
    if (!supportsDynamicLocationFilters || !stateSelect) return;
    try {
      const response = await fetch('/api/monaclick/locations/states');
      const payload = await response.json();
      const items = Array.isArray(payload?.data) ? payload.data : [];
      availableStates = items
        .map((item) => ({
          value: String(item?.code || '').trim().toUpperCase(),
          label: String(item?.name || '').trim(),
        }))
        .filter((item) => item.value && item.label);
      populateSelectOptions(stateSelect, availableStates, 'Any state', state.state || '', false);
    } catch (_) {
      availableStates = [];
      populateSelectOptions(stateSelect, [], 'Any state', '', false);
    }
  };

  const loadDynamicCities = async (stateCode, selectedCity = '') => {
    if (!supportsDynamicLocationFilters || !citySelect) return;
    const normalizedState = String(stateCode || '').trim().toUpperCase();
    if (!normalizedState) {
      syncDynamicLocationAvailability();
      return;
    }

    const requestToken = ++citiesRequestToken;
    populateSelectOptions(citySelect, [], 'Loading cities...', '', true);

    try {
      const response = await fetch(`/api/monaclick/locations/cities?state=${encodeURIComponent(normalizedState)}`);
      if (!response.ok) throw new Error('Unable to load cities');
      const payload = await response.json();
      if (requestToken !== citiesRequestToken) return;
      const items = Array.isArray(payload?.data) ? payload.data : [];
      populateSelectOptions(
        citySelect,
        items.map((item) => ({
          value: String(item?.slug || '').trim(),
          label: String(item?.name || '').trim(),
        })).filter((item) => item.value && item.label),
        'Any location',
        selectedCity,
        false
      );
    } catch (_) {
      if (requestToken !== citiesRequestToken) return;
      populateSelectOptions(citySelect, [], 'Any location', '', false);
    }
  };

  const normalizedSortValue = (value) => {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return '';
    if (raw.includes('price asc')) return 'price_asc';
    if (raw.includes('price desc')) return 'price_desc';
    if (raw.includes('popular') || raw.includes('best rated') || raw.includes('rating')) return 'rating';
    if (raw.includes('updated')) return 'updated';
    return '';
  };

  const realEstateDisplayLocation = () => {
    if (selectedModule !== 'real-estate') return '';
    if (state.city) {
      return lastFilters.cities.find((city) => city.slug === state.city)?.name || state.city;
    }
    if (state.state) {
      return availableStates.find((item) => item.value === state.state)?.label || state.state;
    }
    return state.q || '';
  };

  const syncRealEstateLocationInputs = () => {
    if (selectedModule !== 'real-estate') return;
    const value = realEstateDisplayLocation();
    realEstateLocationInputs.forEach((input) => {
      input.value = value;
    });
  };

  const updateRealEstateTypeCounts = () => {
    if (selectedModule !== 'real-estate') return;
    ['typeCount', 'typeCountOffcanvas'].forEach((countId) => {
      const countNode = document.getElementById(countId);
      if (!countNode) return;
      const checked = Array.from(document.querySelectorAll(`[data-count-id="${countId}"]:checked`)).length;
      countNode.textContent = checked > 0 ? `(${checked})` : '';
    });
  };

  const updateRealEstateFilterUi = (total = null) => {
    if (selectedModule !== 'real-estate') return;
    const activeCount =
      (state.city ? 1 : 0)
      + (state.state ? 1 : 0)
      + (state.q ? 1 : 0)
      + (state.radius ? 1 : 0)
      + ((state.categories || []).length ? 1 : 0)
      + (state.price_min || state.price_max ? 1 : 0)
      + (state.area_min || state.area_max ? 1 : 0)
      + (state.bedrooms ? 1 : 0)
      + (state.bathrooms ? 1 : 0)
      + (state.year_built_min || state.year_built_max ? 1 : 0)
      + (state.listing_type ? 1 : 0)
      + ((state.features || []).length ? 1 : 0);

    if (realEstateFilterBadge) {
      realEstateFilterBadge.textContent = String(activeCount);
      realEstateFilterBadge.classList.toggle('d-none', activeCount <= 0);
    }

    if (realEstateApplyButton && Number.isInteger(total)) {
      realEstateApplyButton.textContent = `See ${total} ${total === 1 ? 'property' : 'properties'}`;
    }

    updateRealEstateTypeCounts();
    syncRealEstateLocationInputs();
  };

  const syncRealEstateTypeCheckboxesFromState = () => {
    if (selectedModule !== 'real-estate') return;
    realEstateTypeCheckboxes.forEach((input) => {
      const baseId = String(input.id || '').replace('-offcanvas', '');
      const mapped = realEstateHomeTypeIds[baseId];
      input.checked = mapped ? (state.categories || []).includes(mapped) : false;
    });
    updateRealEstateTypeCounts();
  };

  const syncRealEstateTypeAvailability = () => {
    if (selectedModule !== 'real-estate') return;

    const countMap = new Map(
      (Array.isArray(lastFilters.categories) ? lastFilters.categories : [])
        .map((item) => [String(item?.slug || '').trim(), Number.parseInt(item?.count, 10) || 0])
    );

    let stateChanged = false;

    realEstateTypeCheckboxes.forEach((input) => {
      const baseId = String(input.id || '').replace('-offcanvas', '');
      const slug = realEstateHomeTypeIds[baseId];
      if (!slug) return;

      const count = countMap.has(slug) ? (countMap.get(slug) || 0) : 0;
      const label = document.querySelector(`label[for="${input.id}"]`);
      const displayName = realEstateHomeTypeLabels[slug] || (label?.textContent || '').replace(/\d+/g, '').trim() || titleizeSlug(slug);

      input.disabled = count <= 0;
      if (count <= 0 && input.checked) {
        input.checked = false;
        stateChanged = true;
      }

      if (label) {
        label.innerHTML = `${escapeHtml(displayName)} <span class="text-body-secondary ms-2">${count}</span>`;
        label.classList.toggle('text-muted', count <= 0);
      }

      const row = input.closest('.form-check');
      if (row) {
        row.style.opacity = count <= 0 ? '0.45' : '';
        row.style.pointerEvents = count <= 0 ? 'none' : '';
      }
    });

    if (stateChanged) {
      state.categories = Array.from(new Set(realEstateTypeCheckboxes
        .filter((checkbox) => checkbox.checked && !checkbox.disabled)
        .map((checkbox) => realEstateHomeTypeIds[String(checkbox.id || '').replace('-offcanvas', '')])
        .filter(Boolean)));
      updateRealEstateTypeCounts();
    }
  };

  const syncRealEstateTypeCheckboxGroup = (changedInput) => {
    if (selectedModule !== 'real-estate' || !changedInput) return;
    const baseId = String(changedInput.id || '').replace('-offcanvas', '');
    if (!baseId) return;
    const checked = !!changedInput.checked;
    realEstateTypeCheckboxes.forEach((input) => {
      if (String(input.id || '').replace('-offcanvas', '') === baseId) {
        input.checked = checked;
      }
    });
  };

  const applyRealEstateLocation = (rawValue) => {
    const raw = cleanSearchTerm(rawValue || '');
    if (!raw) {
      state.city = '';
      state.q = '';
      return;
    }

    const normalized = slugify(raw);
    const matchedCity = (lastFilters.cities || []).find((city) => {
      const cityName = slugify(city.name || '');
      const citySlug = slugify(city.slug || '');
      return normalized === cityName
        || normalized === citySlug
        || normalized.includes(cityName)
        || cityName.includes(normalized);
    });

    if (matchedCity) {
      state.city = matchedCity.slug || '';
      state.q = '';
      return;
    }

    state.city = '';
    state.q = raw;
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

  const filterRestaurantFallbackItems = (items) => {
    const selectedCategory = String(state.category || '').trim();
    const selectedCity = String(state.city || '').trim();
    const minRating = Array.isArray(state.ratings) && state.ratings.length
      ? Math.min(...state.ratings)
      : 0;
    const minPrice = Number.isInteger(state.price_min) ? state.price_min : 0;
    const maxPrice = Number.isInteger(state.price_max) ? state.price_max : 0;

    return (Array.isArray(items) ? items : []).filter((item) => {
      const itemCategory = slugify(item?.category?.slug || item?.category?.name || '');
      const itemCity = slugify(item?.city?.slug || item?.city?.name || '');
      const itemRating = Number(item?.rating || 0);
      const numericPrice = Number.parseInt(String(item?.price || '').replace(/[^\d]/g, ''), 10) || 0;

      if (selectedCategory && itemCategory !== selectedCategory) return false;
      if (selectedCity && itemCity !== selectedCity) return false;
      if (minRating && itemRating < minRating) return false;
      if (minPrice && numericPrice < minPrice) return false;
      if (maxPrice && numericPrice > maxPrice) return false;

      return true;
    });
  };

  const applyStateToUrl = () => {
    const params = new URLSearchParams();
    state.q = cleanSearchTerm(state.q);
    if (state.q) params.set('q', state.q);
    if (supportsDynamicLocationFilters && state.state) params.set('state', state.state);
    if (state.city) params.set('city', state.city);
    if (supportsDynamicLocationFilters && state.radius) params.set('radius', String(state.radius));
    if (selectedModule === 'cars' && state.year_min) params.set('year_min', String(state.year_min));
    if (selectedModule === 'cars' && state.year_max) params.set('year_max', String(state.year_max));
    if (selectedModule === 'cars' && state.mileage_min) params.set('mileage_min', String(state.mileage_min));
    if (selectedModule === 'cars' && state.mileage_max) params.set('mileage_max', String(state.mileage_max));
    if (selectedModule === 'cars' && (state.body_types || []).length) params.set('body_type', state.body_types.join(','));
    if (selectedModule === 'cars' && state.make) params.set('make', state.make);
    if (selectedModule === 'cars' && state.model) params.set('model', state.model);
    if (selectedModule === 'cars' && (state.drive_types || []).length) params.set('drive_type', state.drive_types.join(','));
    if (selectedModule === 'cars' && (state.fuel_types || []).length) params.set('fuel_type', state.fuel_types.join(','));
    if (selectedModule === 'cars' && (state.transmissions || []).length) params.set('transmission', state.transmissions.join(','));
    if (selectedModule === 'real-estate' || selectedModule === 'contractors') {
      if ((state.categories || []).length) params.set('category', state.categories.join(','));
      if (selectedModule === 'real-estate') {
        if ((state.features || []).length) params.set('features', state.features.join(','));
        if (state.area_min) params.set('area_min', String(state.area_min));
        if (state.area_max) params.set('area_max', String(state.area_max));
        if (state.bedrooms) params.set('bedrooms', String(state.bedrooms));
        if (state.bathrooms) params.set('bathrooms', String(state.bathrooms));
        if (state.year_built_min) params.set('year_built_min', String(state.year_built_min));
        if (state.year_built_max) params.set('year_built_max', String(state.year_built_max));
      }
    } else if (state.category) {
      params.set('category', state.category);
    }
    if (state.sort) params.set('sort', state.sort);
    if (state.ratings.length) params.set('ratings', state.ratings.join(','));
    if (state.budget_max) params.set('budget_max', String(state.budget_max));
    if (state.price_min) params.set('price_min', String(state.price_min));
    if (state.price_max) params.set('price_max', String(state.price_max));
    if (selectedModule === 'real-estate' && state.listing_type) {
      params.set('listing_type', state.listing_type);
    }
    if (state.availability) params.set('availability', '1');
    if (selectedModule === 'cars' && state.stock) params.set('stock', state.stock);
    if (selectedModule === 'cars' && state.view === 'list') params.set('view', 'list');
    if (state.page > 1) params.set('page', String(state.page));
    const qs = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
  };

  const buildPageUrl = (targetPage) => {
    const params = new URLSearchParams();
    const cleanQ = cleanSearchTerm(state.q);
    if (cleanQ) params.set('q', cleanQ);
    if (supportsDynamicLocationFilters && state.state) params.set('state', state.state);
    if (state.city) params.set('city', state.city);
    if (supportsDynamicLocationFilters && state.radius) params.set('radius', String(state.radius));
    if (selectedModule === 'cars' && state.year_min) params.set('year_min', String(state.year_min));
    if (selectedModule === 'cars' && state.year_max) params.set('year_max', String(state.year_max));
    if (selectedModule === 'cars' && state.mileage_min) params.set('mileage_min', String(state.mileage_min));
    if (selectedModule === 'cars' && state.mileage_max) params.set('mileage_max', String(state.mileage_max));
    if (selectedModule === 'cars' && (state.body_types || []).length) params.set('body_type', state.body_types.join(','));
    if (selectedModule === 'cars' && state.make) params.set('make', state.make);
    if (selectedModule === 'cars' && state.model) params.set('model', state.model);
    if (selectedModule === 'cars' && (state.drive_types || []).length) params.set('drive_type', state.drive_types.join(','));
    if (selectedModule === 'cars' && (state.fuel_types || []).length) params.set('fuel_type', state.fuel_types.join(','));
    if (selectedModule === 'cars' && (state.transmissions || []).length) params.set('transmission', state.transmissions.join(','));
    if (selectedModule === 'real-estate' || selectedModule === 'contractors') {
      if ((state.categories || []).length) params.set('category', state.categories.join(','));
      if (selectedModule === 'real-estate') {
        if ((state.features || []).length) params.set('features', state.features.join(','));
        if (state.area_min) params.set('area_min', String(state.area_min));
        if (state.area_max) params.set('area_max', String(state.area_max));
        if (state.bedrooms) params.set('bedrooms', String(state.bedrooms));
        if (state.bathrooms) params.set('bathrooms', String(state.bathrooms));
        if (state.year_built_min) params.set('year_built_min', String(state.year_built_min));
        if (state.year_built_max) params.set('year_built_max', String(state.year_built_max));
      }
    } else if (state.category) {
      params.set('category', state.category);
    }
    if (state.sort) params.set('sort', state.sort);
    if (state.ratings.length) params.set('ratings', state.ratings.join(','));
    if (state.budget_max) params.set('budget_max', String(state.budget_max));
    if (state.price_min) params.set('price_min', String(state.price_min));
    if (state.price_max) params.set('price_max', String(state.price_max));
    if (selectedModule === 'real-estate' && state.listing_type) {
      params.set('listing_type', state.listing_type);
    }
    if (state.availability) params.set('availability', '1');
    if (selectedModule === 'cars' && state.stock) params.set('stock', state.stock);
    if (selectedModule === 'cars' && state.view === 'list') params.set('view', 'list');
    if (targetPage > 1) params.set('page', String(targetPage));
    const qs = params.toString();
    return `${window.location.pathname}${qs ? `?${qs}` : ''}`;
  };

  const detailUrl = (item) => {
    if (item?.slug) {
      return `/entry/${encodeURIComponent(item.module)}?slug=${encodeURIComponent(item.slug)}`;
    }
    if (item?.is_demo) {
      return `/entry/${encodeURIComponent(item.module)}`;
    }
    return `/listings/${encodeURIComponent(item?.module || selectedModule)}`;
  };

  const wireDeadPlaceholderLinks = () => {
    const target = `/listings/${selectedModule}`;
    document.querySelectorAll('a[href="#!"], a[href="#"]').forEach((link) => {
      const isUiToggle = link.hasAttribute('data-bs-toggle') || link.getAttribute('role') === 'button';
      const isCompareAction = /compare\s*\(/i.test((link.textContent || '').trim());
      const isViewSwitch = link.getAttribute('aria-label') === 'Grid view' || link.getAttribute('aria-label') === 'List view';
      const linkText = (link.textContent || '').trim().toLowerCase();
      const isCarsStockToggle = selectedModule === 'cars' && (linkText === 'new cars' || linkText === 'used cars');
      if (isCompareAction || isViewSwitch) return;
      if (isUiToggle || isCarsStockToggle) return;
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
  const restaurantDemoImageSet = new Set([
    ...restaurantCardImages,
    '/finder/assets/img/home/city-guide/restaurants/01.png',
    '/finder/assets/img/home/city-guide/restaurants/03-light.png',
    '/finder/assets/img/home/city-guide/restaurants/06.png',
    '/finder/assets/img/home/city-guide/restaurants/08.png',
  ]);

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
    const image = String(item?.image_url || '').trim();
    if (!image) return '/finder/assets/img/placeholders/preview-square.svg';
    if (restaurantDemoImageSet.has(image)) {
      return '/finder/assets/img/placeholders/preview-square.svg';
    }
    return image;
  };

  const contractorCard = (item) => {
    const title = escapeHtml(item.title);
    const excerpt = escapeHtml(item.excerpt || '');
    const category = escapeHtml(item.category?.name || 'Category');
    const city = escapeHtml(item.city?.name || 'City');
    const price = escapeHtml(formatDisplayedPrice(item.price || ''));
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
    const price = escapeHtml(formatDisplayedPrice(item.price || ''));
    const image = escapeHtml(item.image_url || '/finder/assets/img/placeholders/preview-square.svg');
    const url = detailUrl(item);
    const year = escapeHtml(item.details?.car?.year || '');
    const mileage = escapeHtml(item.details?.car?.mileage ? `${item.details.car.mileage} mi` : 'N/A');
    const fuelType = escapeHtml(item.details?.car?.fuel_type || 'N/A');
    const transmission = escapeHtml(item.details?.car?.transmission || 'N/A');
    const badges = [];
    const cond = String(item.details?.car?.condition || '').trim().toLowerCase();
    if (cond) {
      const label = cond.includes('new') ? 'New' : 'Used';
      badges.push(`<span class="badge ${label === 'New' ? 'text-bg-primary' : 'text-bg-warning'}">${escapeHtml(label)}</span>`);
    }
    const hasVerified = Array.isArray(item.features)
      && item.features.some((f) => String(f || '').trim().toLowerCase().includes('verified'));
    if (hasVerified) {
      badges.unshift('<span class="badge text-bg-info d-inline-flex align-items-center">Verified<i class="fi-shield ms-1"></i></span>');
    }
    const payload = escapeHtml(JSON.stringify(comparePayloadFromItem(item)));
    return `
      <div class="col">
        <article class="card h-100 hover-effect-scale bg-body-tertiary border-0">
          <div class="card-img-top position-relative overflow-hidden">
            <div class="d-flex flex-column gap-2 align-items-start position-absolute top-0 start-0 z-1 pt-1 pt-sm-0 ps-1 ps-sm-0 mt-2 mt-sm-3 ms-2 ms-sm-3">
              ${badges.join('')}
            </div>
            <div class="ratio hover-effect-target bg-body-secondary" style="--fn-aspect-ratio: calc(204 / 306 * 100%)">
              <img src="${image}" alt="${title}" onerror="this.onerror=null;this.src='/finder/assets/img/placeholders/preview-square.svg';">
            </div>
          </div>
          <div class="card-body pb-3">
            <div class="d-flex align-items-center justify-content-between mb-2">
              <div class="fs-xs text-body-secondary me-3">Recently added</div>
              <div class="d-flex gap-2 position-relative z-2">
                <button type="button" class="btn btn-icon btn-sm btn-outline-secondary animate-pulse rounded-circle" data-mc-car-action="favorite" data-mc-slug="${escapeHtml(item.slug || '')}" data-mc-title="${title}" data-mc-item="${payload}" aria-label="Add to wishlist">
                  <i class="fi-heart animate-target fs-sm"></i>
                </button>
                <button type="button" class="btn btn-icon btn-sm btn-outline-secondary animate-shake rounded-circle" data-mc-car-action="notify" data-mc-slug="${escapeHtml(item.slug || '')}" data-mc-title="${title}" data-mc-item="${payload}" aria-label="Notify">
                  <i class="fi-bell animate-target fs-sm"></i>
                </button>
                <button type="button" class="btn btn-icon btn-sm btn-outline-secondary animate-rotate rounded-circle" data-mc-car-action="compare" data-mc-slug="${escapeHtml(item.slug || '')}" data-mc-title="${title}" data-mc-item="${payload}" aria-label="Compare">
                  <i class="fi-repeat animate-target fs-sm"></i>
                </button>
              </div>
            </div>
            <h3 class="h6 mb-2">
              <a class="hover-effect-underline stretched-link me-1" href="${url}">${title}</a>
              ${year ? `<span class="fs-xs fw-normal text-body-secondary">(${year})</span>` : ''}
            </h3>
            <div class="h6 mb-0">${price}</div>
          </div>
          <div class="card-footer bg-transparent border-0 pt-0 pb-4">
            <div class="border-top pt-3">
              <div class="row row-cols-2 g-2 fs-sm">
                <div class="col d-flex align-items-center gap-2"><i class="fi-map-pin"></i>${city}</div>
                <div class="col d-flex align-items-center gap-2"><i class="fi-tachometer"></i>${mileage}</div>
                <div class="col d-flex align-items-center gap-2"><i class="fi-gas-pump"></i>${fuelType}</div>
                <div class="col d-flex align-items-center gap-2"><i class="fi-gearbox"></i>${transmission}</div>
              </div>
            </div>
          </div>
        </article>
      </div>
    `;
  };

  const carListCard = (item) => {
    const title = escapeHtml(item.title);
    const city = escapeHtml(item.city?.name || 'City');
    const price = escapeHtml(formatDisplayedPrice(item.price || ''));
    const image = escapeHtml(item.image_url || '/finder/assets/img/placeholders/preview-square.svg');
    const url = detailUrl(item);
    const year = escapeHtml(item.details?.car?.year || '');
    const mileage = escapeHtml(item.details?.car?.mileage ? `${item.details.car.mileage} mi` : 'N/A');
    const fuelType = escapeHtml(item.details?.car?.fuel_type || 'N/A');
    const transmission = escapeHtml(item.details?.car?.transmission || 'N/A');
    const excerpt = escapeHtml(item.excerpt || '');
    const badges = [];
    const cond = String(item.details?.car?.condition || '').trim().toLowerCase();
    if (cond) {
      const label = cond.includes('new') ? 'New' : 'Used';
      badges.push(`<span class="badge text-bg-warning">${escapeHtml(label)}</span>`);
    }
    const hasVerified = Array.isArray(item.features)
      && item.features.some((f) => String(f || '').trim().toLowerCase().includes('verified'));
    if (hasVerified) {
      badges.unshift('<span class="badge text-bg-info d-inline-flex align-items-center">Verified<i class="fi-shield ms-1"></i></span>');
    }
    const payload = escapeHtml(JSON.stringify(comparePayloadFromItem(item)));
    return `
      <article class="card hover-effect-scale bg-body-tertiary border-0 overflow-hidden">
        <div class="row g-0">
          <div class="col-sm-5 position-relative bg-body-secondary overflow-hidden" style="min-height: 220px">
            ${badges.length ? `
              <div class="d-flex flex-column gap-2 align-items-start position-absolute top-0 start-0 z-1 pt-1 pt-sm-0 ps-1 ps-sm-0 mt-2 mt-sm-3 ms-2 ms-sm-3">
                ${badges.join('')}
              </div>
            ` : ''}
            <img src="${image}" class="hover-effect-target position-absolute top-0 start-0 w-100 h-100 object-fit-cover" alt="${title}" onerror="this.onerror=null;this.src='/finder/assets/img/placeholders/preview-square.svg';">
          </div>
          <div class="col-sm-7 py-md-2">
            <div class="card-body pb-3 pb-md-4">
              <div class="d-flex align-items-center justify-content-between mb-2">
                <div class="fs-xs text-body-secondary me-3">Recently added</div>
                <div class="d-flex gap-2 position-relative z-2">
                  <button type="button" class="btn btn-icon btn-sm btn-outline-secondary animate-pulse rounded-circle" data-mc-car-action="favorite" data-mc-slug="${escapeHtml(item.slug || '')}" data-mc-title="${title}" data-mc-item="${payload}" aria-label="Add to wishlist">
                    <i class="fi-heart animate-target fs-sm"></i>
                  </button>
                  <button type="button" class="btn btn-icon btn-sm btn-outline-secondary animate-shake rounded-circle" data-mc-car-action="notify" data-mc-slug="${escapeHtml(item.slug || '')}" data-mc-title="${title}" data-mc-item="${payload}" aria-label="Notify">
                    <i class="fi-bell animate-target fs-sm"></i>
                  </button>
                  <button type="button" class="btn btn-icon btn-sm btn-outline-secondary animate-rotate rounded-circle" data-mc-car-action="compare" data-mc-slug="${escapeHtml(item.slug || '')}" data-mc-title="${title}" data-mc-item="${payload}" aria-label="Compare">
                    <i class="fi-repeat animate-target fs-sm"></i>
                  </button>
                </div>
              </div>
              <h3 class="h5 mb-2">
                <a class="hover-effect-underline stretched-link me-1" href="${url}">${title}</a>
                ${year ? `<span class="fs-sm fw-normal text-body-secondary">(${year})</span>` : ''}
              </h3>
              <div class="h6 mb-0">${price}</div>
              ${excerpt ? `<p class="fs-sm pt-2 mt-1 mb-0">${excerpt}</p>` : ''}
            </div>
            <div class="card-footer bg-transparent border-0 pt-0 pb-4">
              <div class="d-flex flex-wrap justify-content-between gap-3 border-top fs-sm text-nowrap pt-3 pt-md-4">
                <div class="d-flex align-items-center gap-2"><i class="fi-map-pin"></i>${city}</div>
                <div class="d-flex align-items-center gap-2"><i class="fi-tachometer"></i>${mileage}</div>
                <div class="d-flex align-items-center gap-2"><i class="fi-gas-pump"></i>${fuelType}</div>
                <div class="d-flex align-items-center gap-2"><i class="fi-gearbox"></i>${transmission}</div>
              </div>
            </div>
          </div>
        </div>
      </article>
    `;
  };

  const syncCarsViewUi = () => {
    if (selectedModule !== 'cars' || !listContainer) return;
    if (state.view === 'list') {
      listContainer.className = 'vstack gap-4';
      if (gridViewLink) {
        gridViewLink.classList.remove('active', 'pe-none');
        gridViewLink.removeAttribute('aria-current');
      }
      if (listViewLink) {
        listViewLink.classList.add('active', 'pe-none');
        listViewLink.setAttribute('aria-current', 'page');
      }
      return;
    }

    listContainer.className = 'row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-2 row-cols-xl-3 g-4 g-sm-3 g-lg-4';
    if (gridViewLink) {
      gridViewLink.classList.add('active', 'pe-none');
      gridViewLink.setAttribute('aria-current', 'page');
    }
    if (listViewLink) {
      listViewLink.classList.remove('active', 'pe-none');
      listViewLink.removeAttribute('aria-current');
    }
  };

  const syncCompareLink = () => {
    if (!compareLink) return;
    const count = readStoredCompareSlugs().length;
    compareLink.innerHTML = `<i class="fi-repeat fs-base me-2"></i>Compare (${count})`;
  };

  const comparePayloadFromItem = (item) => ({
    slug: item?.slug || '',
    module: item?.module || selectedModule,
    title: item?.title || '',
    price: item?.price || '',
    image_url: item?.image_url || '/finder/assets/img/placeholders/preview-square.svg',
    city: item?.city?.name || '',
    year: item?.details?.car?.year || '',
    mileage: item?.details?.car?.mileage ? `${item.details.car.mileage} mi` : '',
    fuel_type: item?.details?.car?.fuel_type || '',
    transmission: item?.details?.car?.transmission || '',
    detail_url: detailUrl(item),
  });

  const syncCarsActionButtons = () => {
    const favorites = new Set(readStoredSlugs(favoritesStorageKey));
    const alerts = new Set(readStoredSlugs(alertsStorageKey));
    const compare = new Set(readStoredCompareSlugs());
    listContainer.querySelectorAll('[data-mc-car-action]').forEach((button) => {
      const slug = String(button.getAttribute('data-mc-slug') || '').trim();
      const action = String(button.getAttribute('data-mc-car-action') || '').trim();
      const active = action === 'favorite'
        ? favorites.has(slug)
        : action === 'notify'
          ? alerts.has(slug)
          : compare.has(slug);
      button.dataset.active = active ? '1' : '0';
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.classList.toggle('btn-primary', active);
      button.classList.toggle('btn-outline-secondary', !active);
      button.classList.toggle('text-white', active);
    });
  };

  const handleCarsCardAction = (button) => {
    const slug = String(button.getAttribute('data-mc-slug') || '').trim();
    const action = String(button.getAttribute('data-mc-car-action') || '').trim();
    const title = String(button.getAttribute('data-mc-title') || 'Listing').trim();
    const payloadRaw = button.getAttribute('data-mc-item') || '';
    if (!slug || !action) return;

    if (action === 'favorite') {
      const slugs = readStoredSlugs(favoritesStorageKey);
      const exists = slugs.includes(slug);
      const next = exists ? slugs.filter((value) => value !== slug) : [...slugs, slug];
      writeStoredList(favoritesStorageKey, next);
      const items = readStoredMap(favoriteItemsStorageKey);
      if (exists) {
        delete items[slug];
      } else if (payloadRaw) {
        try { items[slug] = JSON.parse(payloadRaw); } catch (e) {}
      }
      writeStoredMap(favoriteItemsStorageKey, items);
      syncCarsActionButtons();
      showCarsToast(exists ? `${title} removed from favorites.` : `${title} saved to favorites.`);
      return;
    }

    if (action === 'notify') {
      const slugs = readStoredSlugs(alertsStorageKey);
      const exists = slugs.includes(slug);
      const next = exists ? slugs.filter((value) => value !== slug) : [...slugs, slug];
      writeStoredList(alertsStorageKey, next);
      syncCarsActionButtons();
      showCarsToast(exists ? `Alerts turned off for ${title}.` : `Alerts turned on for ${title}.`);
      return;
    }

    const slugs = readStoredCompareSlugs();
    const exists = slugs.includes(slug);
    const next = exists ? slugs.filter((value) => value !== slug) : [...slugs.filter((value) => value !== slug), slug].slice(-4);
    const items = readStoredCompareItems();
    if (exists) {
      delete items[slug];
    } else if (payloadRaw) {
      try { items[slug] = JSON.parse(payloadRaw); } catch (e) {}
    }
    writeStoredCompare(next, items);
    syncCarsActionButtons();
    syncCompareLink();
    showCarsToast(exists ? `${title} removed from compare.` : `${title} added to compare.`);
  };

  const bindCarsCardActions = () => {
    if (!listContainer || listContainer.dataset.mcCarActionsBound === '1') return;
    listContainer.dataset.mcCarActionsBound = '1';
    listContainer.addEventListener('click', (event) => {
      const button = event.target.closest('[data-mc-car-action]');
      if (!button || !listContainer.contains(button)) return;
      event.preventDefault();
      event.stopPropagation();
      handleCarsCardAction(button);
    });
  };

  const reconcileCompareItems = (sourceItems = []) => {
    const slugs = readStoredCompareSlugs();
    if (!slugs.length || !Array.isArray(sourceItems) || !sourceItems.length) return;
    const itemsMap = readStoredCompareItems();
    let changed = false;
    slugs.forEach((slug) => {
      if (itemsMap[slug]) return;
      const match = sourceItems.find((item) => String(item?.slug || '').trim() === slug);
      if (!match) return;
      itemsMap[slug] = comparePayloadFromItem(match);
      changed = true;
    });
    if (changed) {
      writeStoredCompare(slugs, itemsMap);
    }
  };

  const ensureCompareModal = () => {
    let modal = document.getElementById('mcCompareModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'mcCompareModal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:99999;padding:20px;align-items:center;justify-content:center;';
    modal.innerHTML = `
      <div style="width:min(960px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:18px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.25);">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:18px;">
          <div>
            <h2 style="margin:0;font-size:28px;line-height:1.2;color:#0f172a;">Compare cars</h2>
            <p style="margin:6px 0 0;color:#64748b;font-size:14px;">Selected cars from your compare list.</p>
          </div>
          <button type="button" data-mc-compare-close style="border:0;background:transparent;font-size:30px;line-height:1;cursor:pointer;color:#334155;">&times;</button>
        </div>
        <div data-mc-compare-body></div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (event) => {
      if (event.target === modal || event.target.closest('[data-mc-compare-close]')) {
        modal.style.display = 'none';
        return;
      }
      const removeBtn = event.target.closest('[data-mc-remove-compare]');
      if (!removeBtn) return;
      const slug = String(removeBtn.getAttribute('data-mc-remove-compare') || '').trim();
      if (!slug) return;
      const slugs = readStoredCompareSlugs().filter((value) => value !== slug);
      const items = readStoredCompareItems();
      delete items[slug];
      writeStoredCompare(slugs, items);
      syncCompareLink();
      renderCompareModal();
    });
    return modal;
  };

  const renderCompareModal = () => {
    const modal = ensureCompareModal();
    const body = modal.querySelector('[data-mc-compare-body]');
    if (!body) return;
    const slugs = readStoredCompareSlugs();
    const itemsMap = readStoredCompareItems();
    const items = slugs.map((slug) => itemsMap[slug]).filter(Boolean);

    if (!items.length) {
      body.innerHTML = `
        <div class="card border-0 bg-body-tertiary">
          <div class="card-body py-5 text-center">
            <h3 class="h5 mb-2">No cars selected for compare</h3>
            <p class="text-body-secondary mb-0">Add compare from listing cards first.</p>
          </div>
        </div>
      `;
      return;
    }

    body.innerHTML = `
      <div class="row row-cols-1 row-cols-md-2 g-4">
        ${items.map((item) => `
          <div class="col">
            <article class="card h-100 border-0 bg-body-tertiary shadow-sm">
              <div class="position-relative">
                <img src="${escapeHtml(item.image_url || '/finder/assets/img/placeholders/preview-square.svg')}" alt="${escapeHtml(item.title || 'Compare item')}" class="card-img-top" style="height:220px;object-fit:cover;" onerror="this.onerror=null;this.src='/finder/assets/img/placeholders/preview-square.svg';">
                <button type="button" data-mc-remove-compare="${escapeHtml(item.slug || '')}" class="btn btn-sm btn-light position-absolute top-0 end-0 m-3 rounded-circle" aria-label="Remove compare">
                  <i class="fi-close"></i>
                </button>
              </div>
              <div class="card-body">
                <div class="d-flex align-items-center justify-content-between gap-3 mb-2">
                  <div class="fs-sm text-body-secondary">${escapeHtml(item.city || 'Location')}</div>
                  <div class="fs-xs text-body-secondary">${escapeHtml(item.year || '')}</div>
                </div>
                <h3 class="h5 mb-2"><a class="text-decoration-none text-dark-emphasis hover-effect-underline" href="${escapeHtml(item.detail_url || '/listings/cars')}">${escapeHtml(item.title || 'Listing')}</a></h3>
                <div class="h5 mb-3">${escapeHtml(formatDisplayedPrice(item.price || 'Price on request'))}</div>
                <div class="row row-cols-2 g-2 fs-sm text-body-secondary">
                  <div class="col d-flex align-items-center gap-2"><i class="fi-tachometer"></i>${escapeHtml(item.mileage || 'N/A')}</div>
                  <div class="col d-flex align-items-center gap-2"><i class="fi-gas-pump"></i>${escapeHtml(item.fuel_type || 'N/A')}</div>
                  <div class="col d-flex align-items-center gap-2"><i class="fi-gearbox"></i>${escapeHtml(item.transmission || 'N/A')}</div>
                  <div class="col d-flex align-items-center gap-2"><i class="fi-repeat"></i>Compared</div>
                </div>
              </div>
            </article>
          </div>
        `).join('')}
      </div>
    `;
  };

  const propertyCard = (item) => {
    const title = escapeHtml(item.title);
    const city = escapeHtml(item.city?.name || 'City');
    const price = escapeHtml(formatDisplayedPrice(item.price || ''));
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
    const price = escapeHtml(formatDisplayedPrice(item.price || ''));
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
      syncCarsViewUi();
      listContainer.innerHTML = items.map((item) => (state.view === 'list' ? carListCard(item) : carCard(item))).join('');
      bindCarsCardActions();
      syncCarsActionButtons();
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

  const syncCarsHeaderUi = (total = null) => {
    if (selectedModule !== 'cars') return;
    if (topResultsText && Number.isInteger(total)) {
      topResultsText.textContent = `Showing ${total} results`;
    }
    if (breadcrumbActive) {
      if (state.stock === 'new') breadcrumbActive.textContent = 'New cars';
      else if (state.stock === 'used') breadcrumbActive.textContent = 'Used cars';
      else breadcrumbActive.textContent = 'Cars';
    }
  };

  const renderListingsPayload = (payload) => {
    let items = Array.isArray(payload?.data) ? payload.data : [];
    const meta = payload?.meta || { total: 0, current_page: 1, last_page: 1 };
    const filters = payload?.filters || {};
    lastFilters = {
      categories: Array.isArray(filters.categories) ? filters.categories : [],
      cities: Array.isArray(filters.cities) ? filters.cities : [],
      carYears: Array.isArray(filters?.cars?.years) ? filters.cars.years : [],
      carMakes: Array.isArray(filters?.cars?.makes) ? filters.cars.makes : [],
      carModels: Array.isArray(filters?.cars?.models) ? filters.cars.models : [],
      carBodyTypes: Array.isArray(filters?.cars?.body_types) ? filters.cars.body_types : [],
      carDriveTypes: Array.isArray(filters?.cars?.drive_types) ? filters.cars.drive_types : [],
      carFuelTypes: Array.isArray(filters?.cars?.fuel_types) ? filters.cars.fuel_types : [],
      carTransmissions: Array.isArray(filters?.cars?.transmissions) ? filters.cars.transmissions : [],
    };

    if (selectedModule === 'events') {
      repopulateSelectFromFilters(eventsCategorySelect, lastFilters.categories, 'Category');
      repopulateSelectFromFilters(eventsCitySelect, lastFilters.cities, 'Location');
      syncControlsFromState();
    }

    if (selectedModule === 'cars') {
      syncCarSpecFilters();
      syncCarsCheckboxFilter(carsBodyTypeChecks, lastFilters.carBodyTypes, state.body_types);
      syncCarsCheckboxFilter(carsDriveTypeChecks, lastFilters.carDriveTypes, state.drive_types);
      syncCarsCheckboxFilter(carsFuelTypeChecks, lastFilters.carFuelTypes, state.fuel_types);
      syncCarsCheckboxFilter(carsTransmissionChecks, lastFilters.carTransmissions, state.transmissions);
      syncCarsCheckboxFilter(carsColorChecks, [], []);
      syncCarsCheckboxFilter(carsSellerChecks, [], []);
      syncControlsFromState();
    }

    if (selectedModule === 'restaurants' && !items.length) {
      items = filterRestaurantFallbackItems(restaurantFallbackItems());
    }

    if (resultsNode) {
      const total = selectedModule === 'restaurants' && meta.total === 0 ? items.length : meta.total;
      resultsNode.textContent = `Showing ${total} results`;
      syncCarsHeaderUi(total);
      if (selectedModule === 'real-estate') updateRealEstateFilterUi(total);
    }
    if (selectedModule === 'real-estate') {
      syncRealEstateTypeAvailability();
    }
    renderCategoryFilter(lastFilters.categories);
    renderActivePills();

    if (!items.length) {
      lastRenderedItems = [];
      if (selectedModule === 'real-estate') updateRealEstateFilterUi(0);
      if (selectedModule !== 'real-estate' && shouldUseInitialMarkupFallback()) {
        listContainer.innerHTML = initialListMarkup;
        listContainer.style.opacity = '1';
        if (resultsNode && String(initialResultsMarkup || '').trim()) {
          resultsNode.textContent = initialResultsMarkup;
        }
        syncCarsHeaderUi(null);
        renderPagination(1, 1);
        return;
      }
      if (gridMode === 'vstack') {
        listContainer.innerHTML = '<div class="alert alert-info mb-0">No listings found for selected filters.</div>';
      } else {
        listContainer.innerHTML = '<div class="col-12"><div class="alert alert-info mb-0">No listings found for selected filters.</div></div>';
      }
      listContainer.style.opacity = '1';
      renderPagination(1, 1);
      return;
    }

    lastRenderedItems = items.slice();
    reconcileCompareItems(lastRenderedItems);
    syncCompareLink();
    renderCards(items);
    renderPagination(meta.current_page, meta.last_page);
  };

  const prefetchCarsOppositeStock = (apiQueryString) => {
    if (selectedModule !== 'cars') return;
    const params = new URLSearchParams(apiQueryString);
    const stock = String(params.get('stock') || '').trim().toLowerCase();
    if (stock !== 'new' && stock !== 'used') return;
    params.set('stock', stock === 'new' ? 'used' : 'new');
    const prefetchKey = params.toString();
    if (listingsResponseCache.has(prefetchKey)) return;
    fetch(`/api/monaclick/listings?${prefetchKey}`)
      .then((res) => res.ok ? res.json() : null)
      .then((payload) => {
        if (payload) listingsResponseCache.set(prefetchKey, payload);
      })
      .catch(() => {
        // ignore prefetch failures
      });
  };

  const shouldUseInitialMarkupFallback = () => {
    const hasInitialMarkup = String(initialListMarkup || '').trim() !== '';
    const hasUserFilters =
      !!cleanSearchTerm(state.q)
      || !!state.state
      || !!state.city
      || !!state.make
      || !!state.model
      || (Array.isArray(state.body_types) && state.body_types.length > 0)
      || !!state.mileage_min
      || !!state.mileage_max
      || (Array.isArray(state.drive_types) && state.drive_types.length > 0)
      || (Array.isArray(state.fuel_types) && state.fuel_types.length > 0)
      || (Array.isArray(state.transmissions) && state.transmissions.length > 0)
      || (Array.isArray(state.categories) && state.categories.length > 0)
      || !!state.category
      || (Array.isArray(state.features) && state.features.length > 0)
      || !!state.sort
      || (Array.isArray(state.ratings) && state.ratings.length > 0)
      || !!state.budget_max
      || !!state.price_min
      || !!state.price_max
      || !!state.area_min
      || !!state.area_max
      || !!state.bedrooms
      || !!state.bathrooms
      || !!state.year_min
      || !!state.year_max
      || !!state.year_built_min
      || !!state.year_built_max
      || !!state.stock
      || !!state.radius
      || !!state.availability;

    return hasInitialMarkup && !hasUserFilters;
  };

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
      const selectedOption = citySelect
        ? Array.from(citySelect.options).find((option) => slugify(option.value || option.textContent) === state.city)
        : null;
      const cityName = lastFilters.cities.find((city) => city.slug === state.city)?.name
        || selectedOption?.textContent?.trim()
        || titleizeSlug(state.city);
      pills.push(`<button type="button" class="btn btn-sm btn-secondary rounded-pill" data-pill="city"><i class="fi-close fs-sm me-1 ms-n1"></i>${escapeHtml(cityName)}</button>`);
    }
    if (supportsDynamicLocationFilters && state.radius) {
      pills.push(`<button type="button" class="btn btn-sm btn-secondary rounded-pill" data-pill="radius"><i class="fi-close fs-sm me-1 ms-n1"></i>${escapeHtml(state.radius)} mi</button>`);
    }
    if (selectedModule === 'cars' && (state.year_min || state.year_max)) {
      const yearLabel = `${state.year_min || 'Any'} - ${state.year_max || 'Any'}`;
      pills.push(`<button type="button" class="btn btn-sm btn-secondary rounded-pill" data-pill="year"><i class="fi-close fs-sm me-1 ms-n1"></i>Year (${escapeHtml(yearLabel)})</button>`);
    }
    if (selectedModule === 'cars' && (state.body_types || []).length) {
      pills.push(`<button type="button" class="btn btn-sm btn-secondary rounded-pill" data-pill="body_type"><i class="fi-close fs-sm me-1 ms-n1"></i>Body type (${state.body_types.length})</button>`);
    }
    if (selectedModule === 'cars' && (state.mileage_min || state.mileage_max)) {
      const mileageLabel = `${state.mileage_min || 'Any'} - ${state.mileage_max || 'Any'} mi`;
      pills.push(`<button type="button" class="btn btn-sm btn-secondary rounded-pill" data-pill="mileage"><i class="fi-close fs-sm me-1 ms-n1"></i>Mileage (${escapeHtml(mileageLabel)})</button>`);
    }
    if (selectedModule === 'cars' && state.make) {
      pills.push(`<button type="button" class="btn btn-sm btn-secondary rounded-pill" data-pill="make"><i class="fi-close fs-sm me-1 ms-n1"></i>${escapeHtml(state.make)}</button>`);
    }
    if (selectedModule === 'cars' && state.model) {
      pills.push(`<button type="button" class="btn btn-sm btn-secondary rounded-pill" data-pill="model"><i class="fi-close fs-sm me-1 ms-n1"></i>${escapeHtml(state.model)}</button>`);
    }
    if (selectedModule === 'cars' && (state.drive_types || []).length) {
      pills.push(`<button type="button" class="btn btn-sm btn-secondary rounded-pill" data-pill="drive_type"><i class="fi-close fs-sm me-1 ms-n1"></i>Drivetrain (${state.drive_types.length})</button>`);
    }
    if (selectedModule === 'cars' && (state.fuel_types || []).length) {
      pills.push(`<button type="button" class="btn btn-sm btn-secondary rounded-pill" data-pill="fuel_type"><i class="fi-close fs-sm me-1 ms-n1"></i>Fuel (${state.fuel_types.length})</button>`);
    }
    if (selectedModule === 'cars' && (state.transmissions || []).length) {
      pills.push(`<button type="button" class="btn btn-sm btn-secondary rounded-pill" data-pill="transmission"><i class="fi-close fs-sm me-1 ms-n1"></i>Transmission (${state.transmissions.length})</button>`);
    }
    if (selectedModule === 'contractors' && (state.categories || []).length) {
      pills.push(`<button type="button" class="btn btn-sm btn-secondary rounded-pill" data-pill="category"><i class="fi-close fs-sm me-1 ms-n1"></i>Project type (${state.categories.length})</button>`);
    } else if (state.category) {
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
        if (type === 'category') {
          state.category = '';
          if (supportsMultiCategory) state.categories = [];
        }
        if (type === 'q') state.q = '';
        if (type === 'radius') state.radius = 0;
        if (type === 'year') { state.year_min = 0; state.year_max = 0; }
        if (type === 'body_type') state.body_types = [];
        if (type === 'mileage') { state.mileage_min = 0; state.mileage_max = 0; }
        if (type === 'make') { state.make = ''; state.model = ''; }
        if (type === 'model') state.model = '';
        if (type === 'drive_type') state.drive_types = [];
        if (type === 'fuel_type') state.fuel_types = [];
        if (type === 'transmission') state.transmissions = [];
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
            <input type="checkbox" class="form-check-input" id="cat-${escapeHtml(category.slug)}" value="${escapeHtml(category.slug)}"${supportsMultiCategory ? ((state.categories || []).includes(category.slug) ? ' checked' : '') : (state.category === category.slug ? ' checked' : '')}>
            <label for="cat-${escapeHtml(category.slug)}" class="form-check-label">${escapeHtml(category.name)}</label>
          </div>
        `
      )
      .join('');

    categoryList.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.addEventListener('change', () => {
        if (selectedModule === 'contractors') {
          state.categories = categoryList.querySelectorAll('input[type="checkbox"]:checked')
            ? Array.from(categoryList.querySelectorAll('input[type="checkbox"]:checked')).map((cb) => String(cb.value || '').trim()).filter(Boolean)
            : [];
          state.category = '';
        } else {
          categoryList.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
            if (cb !== input) cb.checked = false;
          });
          state.category = input.checked ? input.value : '';
        }
        state.page = 1;
        syncControlsFromState();
        applyStateToUrl();
        loadListings();
      });
    });
  };

  const syncControlsFromState = () => {
    if (searchInput && selectedModule !== 'real-estate') searchInput.value = state.q || '';

    if (stateSelect) {
      stateSelect.value = String(state.state || '').trim().toUpperCase();
      refreshEnhancedSelect(stateSelect);
    }

    if (citySelect) {
      const selectedOption = Array.from(citySelect.options).find(
        (option) => slugify(option.value || option.textContent) === state.city
      );
      citySelect.value = selectedOption ? selectedOption.value : '';
      refreshEnhancedSelect(citySelect);
    }

    if (radiusSelect) {
      const wantedRadius = state.radius ? `${state.radius} mi` : '';
      const selectedOption = Array.from(radiusSelect.options).find((option) => String(option.value || option.textContent).trim() === wantedRadius);
      radiusSelect.value = selectedOption ? selectedOption.value : '';
      refreshEnhancedSelect(radiusSelect);
    }

    if (selectedModule === 'cars') {
      if (carYearMinSelect) {
        carYearMinSelect.value = state.year_min ? String(state.year_min) : '';
        refreshEnhancedSelect(carYearMinSelect);
      }
      if (carYearMaxSelect) {
        carYearMaxSelect.value = state.year_max ? String(state.year_max) : '';
        refreshEnhancedSelect(carYearMaxSelect);
      }
      if (carMakeSelect) {
        carMakeSelect.value = state.make || '';
        refreshEnhancedSelect(carMakeSelect);
      }
      if (carModelSelect) {
        carModelSelect.value = state.model || '';
        refreshEnhancedSelect(carModelSelect);
      }
      if (carsMileageMinInput) {
        carsMileageMinInput.value = state.mileage_min ? String(state.mileage_min) : '';
      }
      if (carsMileageMaxInput) {
        carsMileageMaxInput.value = state.mileage_max ? String(state.mileage_max) : '';
      }
      carsBodyTypeChecks.forEach((input) => {
        input.checked = (state.body_types || []).includes(String(input.id || '').trim().toLowerCase());
      });
      carsDriveTypeChecks.forEach((input) => {
        input.checked = (state.drive_types || []).includes(String(input.id || '').trim().toLowerCase());
      });
      carsFuelTypeChecks.forEach((input) => {
        input.checked = (state.fuel_types || []).includes(String(input.id || '').trim().toLowerCase());
      });
      carsTransmissionChecks.forEach((input) => {
        input.checked = (state.transmissions || []).includes(String(input.id || '').trim().toLowerCase());
      });
    }

    if (sortSelect) {
      const sortMatch = Array.from(sortSelect.options).find((option) => normalizedSortValue(option.value || option.textContent) === state.sort);
      sortSelect.value = sortMatch ? sortMatch.value : sortSelect.options[0]?.value || '';
    }

    if (categoryList) {
      categoryList.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
        cb.checked = selectedModule === 'contractors'
          ? (state.categories || []).includes(cb.value)
          : cb.value === state.category;
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
      if (contractorPriceStep) slider.step = String(contractorPriceStep);
      const value = Number.isInteger(state.budget_max) ? state.budget_max : 0;
      slider.value = String(value || 0);
      const wrap = slider.closest('[data-budget-wrap]');
      const label = (wrap ? wrap.querySelector('[data-budget-label]') : null) || slider.parentElement?.querySelector?.('[data-budget-label]');
      if (label) label.textContent = value ? `$${value}` : 'Any';
    });

    if (priceWrap && priceMinSlider instanceof HTMLInputElement && priceMaxSlider instanceof HTMLInputElement) {
      const maxLimit = Number.parseInt(priceMaxSlider.max || '0', 10) || 0;
      const step = contractorPriceStep || (Number.parseInt(priceMaxSlider.step || priceMinSlider.step || '1', 10) || 1);
      const isAny = !state.price_min && !state.price_max;
      const desiredMin = isAny ? 0 : Math.max(0, Math.min(state.price_min || 0, maxLimit));
      const desiredMaxRaw = isAny ? maxLimit : (state.price_max || maxLimit);
      const desiredMax = Math.max(desiredMin, Math.min(desiredMaxRaw, maxLimit));

      priceMinSlider.step = String(step);
      priceMaxSlider.step = String(step);
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
      if (usedCarsBtn) usedCarsBtn.classList.toggle('active', state.stock === 'used');
      syncCarsHeaderUi(null);
    }

    if (selectedModule === 'real-estate') {
      const listingType = state.listing_type || '';
      const desired = listingType === 'sale' ? 'For sale' : (listingType === 'rent' ? 'For rent' : '');
      listingTypeSelects.forEach((select) => {
        const option = Array.from(select.options).find((opt) => String(opt.value || opt.textContent).trim() === desired);
        select.value = option ? option.value : '';
      });
      const rentMode = listingType !== 'sale';
      rentOnlyBlocks.forEach((el) => el.classList.toggle('d-none', !rentMode));
      saleOnlyBlocks.forEach((el) => el.classList.toggle('d-none', rentMode));
      priceMinInputs.forEach((input) => { input.value = state.price_min ? String(state.price_min) : ''; });
      priceMaxInputs.forEach((input) => { input.value = state.price_max ? String(state.price_max) : ''; });
      syncRealEstateLocationInputs();
      syncRealEstateTypeCheckboxesFromState();
      realEstateBedrooms.forEach((input) => {
        const raw = String(input.id || '').split('-').pop() || '';
        const value = raw === 'any' ? 0 : (raw === '4' ? 4 : (Number.parseInt(raw, 10) || 0));
        input.checked = value === (state.bedrooms || 0);
      });
      realEstateBathrooms.forEach((input) => {
        const raw = String(input.id || '').split('-').pop() || '';
        const value = raw === 'any' ? 0 : (raw === '4' ? 4 : (Number.parseInt(raw, 10) || 0));
        input.checked = value === (state.bathrooms || 0);
      });
      if (realEstateAreaMin) realEstateAreaMin.value = state.area_min ? String(state.area_min) : '';
      if (realEstateAreaMax) realEstateAreaMax.value = state.area_max ? String(state.area_max) : '';
      if (realEstateYearMin) realEstateYearMin.value = state.year_built_min ? String(state.year_built_min) : '';
      if (realEstateYearMax) realEstateYearMax.value = state.year_built_max ? String(state.year_built_max) : '';
      realEstateFeatureCheckboxes.forEach((input) => {
        const token = realEstateFeatureMap[input.id];
        input.checked = token ? (state.features || []).includes(token) : false;
      });
      updateRealEstateFilterUi();
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
    listingsRequestToken += 1;
    const requestToken = listingsRequestToken;
    if (listingsAbortController) {
      try {
        listingsAbortController.abort();
      } catch (_) {
        // ignore
      }
    }
    listingsAbortController = typeof AbortController === 'function' ? new AbortController() : null;
    if (loadingUiTimer) clearTimeout(loadingUiTimer);
    loadingUiTimer = setTimeout(() => {
      if (requestToken === listingsRequestToken) {
        setListingsLoading(true);
      }
    }, 120);

    state.q = cleanSearchTerm(state.q);

    const apiQuery = new URLSearchParams({
      module: selectedModule,
      page: String(state.page || 1),
      per_page: selectedModule === 'events' ? '12' : '8',
    });
    if (state.q) apiQuery.set('q', state.q);
    if (supportsDynamicLocationFilters && state.state) apiQuery.set('state', state.state);
    if (state.city) apiQuery.set('city', state.city);
    if (supportsDynamicLocationFilters && state.radius) apiQuery.set('radius', String(state.radius));
    if (selectedModule === 'cars' && state.year_min) apiQuery.set('year_min', String(state.year_min));
    if (selectedModule === 'cars' && state.year_max) apiQuery.set('year_max', String(state.year_max));
    if (selectedModule === 'cars' && state.mileage_min) apiQuery.set('mileage_min', String(state.mileage_min));
    if (selectedModule === 'cars' && state.mileage_max) apiQuery.set('mileage_max', String(state.mileage_max));
    if (selectedModule === 'cars' && (state.body_types || []).length) apiQuery.set('body_type', state.body_types.join(','));
    if (selectedModule === 'cars' && state.make) apiQuery.set('make', state.make);
    if (selectedModule === 'cars' && state.model) apiQuery.set('model', state.model);
    if (selectedModule === 'cars' && (state.drive_types || []).length) apiQuery.set('drive_type', state.drive_types.join(','));
    if (selectedModule === 'cars' && (state.fuel_types || []).length) apiQuery.set('fuel_type', state.fuel_types.join(','));
    if (selectedModule === 'cars' && (state.transmissions || []).length) apiQuery.set('transmission', state.transmissions.join(','));
    if (selectedModule === 'real-estate' || selectedModule === 'contractors') {
      if ((state.categories || []).length) apiQuery.set('category', state.categories.join(','));
      if (selectedModule === 'real-estate') {
        if ((state.features || []).length) apiQuery.set('features', state.features.join(','));
        if (state.area_min) apiQuery.set('area_min', String(state.area_min));
        if (state.area_max) apiQuery.set('area_max', String(state.area_max));
        if (state.bedrooms) apiQuery.set('bedrooms', String(state.bedrooms));
        if (state.bathrooms) apiQuery.set('bathrooms', String(state.bathrooms));
        if (state.year_built_min) apiQuery.set('year_built_min', String(state.year_built_min));
        if (state.year_built_max) apiQuery.set('year_built_max', String(state.year_built_max));
      }
    } else if (state.category) {
      apiQuery.set('category', state.category);
    }
    if (state.sort) apiQuery.set('sort', state.sort);
    if (state.ratings.length) apiQuery.set('ratings', state.ratings.join(','));
    if (selectedModule === 'real-estate' && state.listing_type) {
      apiQuery.set('listing_type', state.listing_type);
    }
    if (state.price_min) apiQuery.set('price_min', String(state.price_min));
    if (state.price_max) apiQuery.set('price_max', String(state.price_max));
    if (!state.price_min && !state.price_max && state.budget_max) {
      apiQuery.set('budget_max', String(state.budget_max));
    }
    if (state.availability) apiQuery.set('availability', '1');
    if (selectedModule === 'cars' && state.stock) apiQuery.set('stock', state.stock);
    const apiQueryString = apiQuery.toString();

    if (listingsResponseCache.has(apiQueryString)) {
      if (loadingUiTimer) clearTimeout(loadingUiTimer);
      setListingsLoading(false);
      renderListingsPayload(listingsResponseCache.get(apiQueryString));
      return;
    }

    fetch(`/api/monaclick/listings?${apiQueryString}`, listingsAbortController ? { signal: listingsAbortController.signal } : {})
      .then((res) => res.json())
      .then((payload) => {
        if (requestToken !== listingsRequestToken) return;
        if (loadingUiTimer) clearTimeout(loadingUiTimer);
        setListingsLoading(false);
        listingsResponseCache.set(apiQueryString, payload);
        renderListingsPayload(payload);
        prefetchCarsOppositeStock(apiQueryString);
      })
      .catch((error) => {
        if (error?.name === 'AbortError') return;
        if (requestToken !== listingsRequestToken) return;
        if (loadingUiTimer) clearTimeout(loadingUiTimer);
        setListingsLoading(false);
        lastRenderedItems = [];
        if (selectedModule === 'real-estate') updateRealEstateFilterUi(0);
        if (gridMode === 'vstack') {
          listContainer.innerHTML = '<div class="alert alert-danger mb-0">Unable to load listings right now.</div>';
        } else {
          listContainer.innerHTML = '<div class="col-12"><div class="alert alert-danger mb-0">Unable to load listings right now.</div></div>';
        }
        listContainer.style.opacity = '1';
      });
  };

  if (searchInput && selectedModule !== 'real-estate') {
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

  if (stateSelect) {
    stateSelect.addEventListener('change', async () => {
      const option = stateSelect.options[stateSelect.selectedIndex];
      const raw = String(option ? option.value || option.textContent : '').trim().toUpperCase();
      state.state = /^[A-Z]{2}$/.test(raw) ? raw : '';
      state.city = '';
      state.page = 1;
      await loadDynamicCities(state.state, '');
      syncControlsFromState();
      applyStateToUrl();
      loadListings();
    });
  }

  if (radiusSelect) {
    radiusSelect.addEventListener('change', () => {
      const option = radiusSelect.options[radiusSelect.selectedIndex];
      const raw = String(option ? option.value || option.textContent : '');
      const parsed = Number.parseInt(raw.replace(/[^\d]/g, ''), 10);
      state.radius = Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
      state.page = 1;
      applyStateToUrl();
      loadListings();
    });
  }

  if (selectedModule === 'cars' && (carYearMinSelect || carYearMaxSelect)) {
    const commitCarYearRange = () => {
      const minYear = Number.parseInt(carYearMinSelect?.value || '0', 10) || 0;
      const maxYear = Number.parseInt(carYearMaxSelect?.value || '0', 10) || 0;
      state.year_min = minYear;
      state.year_max = maxYear;
      if (state.year_min && state.year_max && state.year_min > state.year_max) {
        const swap = state.year_min;
        state.year_min = state.year_max;
        state.year_max = swap;
      }
      state.page = 1;
      syncControlsFromState();
      applyStateToUrl();
      loadListings();
    };

    [carYearMinSelect, carYearMaxSelect].filter(Boolean).forEach((select) => {
      select.addEventListener('change', commitCarYearRange);
    });
  }

  if (carMakeSelect) {
    carMakeSelect.addEventListener('change', () => {
      const option = carMakeSelect.options[carMakeSelect.selectedIndex];
      state.make = String(option ? option.value || option.textContent : '').trim();
      state.model = '';
      state.page = 1;
      syncControlsFromState();
      applyStateToUrl();
      loadListings();
    });
  }

  if (carModelSelect) {
    carModelSelect.addEventListener('change', () => {
      const option = carModelSelect.options[carModelSelect.selectedIndex];
      state.model = String(option ? option.value || option.textContent : '').trim();
      state.page = 1;
      syncControlsFromState();
      applyStateToUrl();
      loadListings();
    });
  }

  const bindCarsCheckboxGroup = (inputs, stateKey) => {
    if (!Array.isArray(inputs) || !inputs.length) return;
    inputs.forEach((input) => {
      input.addEventListener('change', () => {
        state[stateKey] = inputs
          .filter((checkbox) => checkbox.checked && !checkbox.disabled)
          .map((checkbox) => String(checkbox.id || '').trim().toLowerCase());
        state.page = 1;
        syncControlsFromState();
        applyStateToUrl();
        loadListings();
      });
    });
  };

  bindCarsCheckboxGroup(carsBodyTypeChecks, 'body_types');
  bindCarsCheckboxGroup(carsDriveTypeChecks, 'drive_types');
  bindCarsCheckboxGroup(carsFuelTypeChecks, 'fuel_types');
  bindCarsCheckboxGroup(carsTransmissionChecks, 'transmissions');

  if (selectedModule === 'cars' && (carsMileageMinInput || carsMileageMaxInput)) {
    const commitCarsMileage = () => {
      const parseMileage = (value) => {
        const raw = Number.parseInt(String(value || '').replace(/[^\d]/g, ''), 10);
        return Number.isInteger(raw) && raw > 0 ? raw : 0;
      };
      state.mileage_min = parseMileage(carsMileageMinInput?.value);
      state.mileage_max = parseMileage(carsMileageMaxInput?.value);
      if (state.mileage_min && state.mileage_max && state.mileage_min > state.mileage_max) {
        const swap = state.mileage_min;
        state.mileage_min = state.mileage_max;
        state.mileage_max = swap;
      }
      state.page = 1;
      syncControlsFromState();
      applyStateToUrl();
      loadListings();
    };

    [carsMileageMinInput, carsMileageMaxInput].filter(Boolean).forEach((input) => {
      input.addEventListener('change', commitCarsMileage);
      input.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') commitCarsMileage();
      });
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      state.sort = normalizedSortValue(sortSelect.value || sortSelect.options[sortSelect.selectedIndex]?.textContent || '');
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
        // Home-type availability differs a lot between rent and sale datasets.
        // Clear stale selections on mode switch so users don't get trapped in
        // an old category combination that has no matches for the new mode.
        state.categories = [];
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

  if (selectedModule === 'real-estate') {
    realEstateLocationInputs.forEach((input) => {
      const applyLocation = () => {
        applyRealEstateLocation(input.value);
        state.page = 1;
        syncControlsFromState();
        applyStateToUrl();
        loadListings();
      };
      input.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        applyLocation();
      });
      input.addEventListener('change', applyLocation);
    });

    realEstateTypeCheckboxes.forEach((input) => {
      input.addEventListener('change', () => {
        syncRealEstateTypeCheckboxGroup(input);
        const selected = Array.from(new Set(realEstateTypeCheckboxes
          .filter((checkbox) => checkbox.checked)
          .map((checkbox) => realEstateHomeTypeIds[String(checkbox.id || '').replace('-offcanvas', '')])
          .filter(Boolean)));
        state.categories = selected;
        state.page = 1;
        syncControlsFromState();
        applyStateToUrl();
        loadListings();
      });
    });

    realEstateBedrooms.forEach((input) => {
      input.addEventListener('change', () => {
        const raw = String(input.id || '').split('-').pop() || '';
        state.bedrooms = raw === 'any' ? 0 : (raw === '4' ? 4 : (Number.parseInt(raw, 10) || 0));
        state.page = 1;
        syncControlsFromState();
        applyStateToUrl();
        loadListings();
      });
    });

    realEstateBathrooms.forEach((input) => {
      input.addEventListener('change', () => {
        const raw = String(input.id || '').split('-').pop() || '';
        state.bathrooms = raw === 'any' ? 0 : (raw === '4' ? 4 : (Number.parseInt(raw, 10) || 0));
        state.page = 1;
        syncControlsFromState();
        applyStateToUrl();
        loadListings();
      });
    });

    const commitAreaRange = () => {
      const parse = (value) => {
        const raw = Number.parseInt(String(value || '').replace(/[^\d]/g, ''), 10);
        return Number.isInteger(raw) && raw > 0 ? raw : 0;
      };
      state.area_min = parse(realEstateAreaMin?.value);
      state.area_max = parse(realEstateAreaMax?.value);
      state.page = 1;
      syncControlsFromState();
      applyStateToUrl();
      loadListings();
    };
    [realEstateAreaMin, realEstateAreaMax].filter(Boolean).forEach((input) => {
      input.addEventListener('change', commitAreaRange);
      input.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') commitAreaRange();
      });
    });

    const commitYearRange = () => {
      state.year_built_min = Number.parseInt(realEstateYearMin?.value || '0', 10) || 0;
      state.year_built_max = Number.parseInt(realEstateYearMax?.value || '0', 10) || 0;
      state.page = 1;
      syncControlsFromState();
      applyStateToUrl();
      loadListings();
    };
    [realEstateYearMin, realEstateYearMax].filter(Boolean).forEach((select) => {
      select.addEventListener('change', commitYearRange);
    });

    realEstateFeatureCheckboxes.forEach((input) => {
      input.addEventListener('change', () => {
        state.features = Array.from(new Set(realEstateFeatureCheckboxes
          .filter((checkbox) => checkbox.checked)
          .map((checkbox) => realEstateFeatureMap[checkbox.id])
          .filter(Boolean)));
        state.page = 1;
        syncControlsFromState();
        applyStateToUrl();
        loadListings();
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

  const clearLinks = [clearAllLink, realEstateClearAllLink].filter(Boolean);
  clearLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      state = {
        q: '',
        state: selectedModule === 'cars' ? '' : '',
        city: '',
        category: '',
        categories: supportsMultiCategory ? [] : [],
        features: selectedModule === 'real-estate' ? [] : [],
        body_types: selectedModule === 'cars' ? [] : [],
        drive_types: selectedModule === 'cars' ? [] : [],
        fuel_types: selectedModule === 'cars' ? [] : [],
        transmissions: selectedModule === 'cars' ? [] : [],
        sort: '',
        ratings: [],
        budget_max: 0,
        listing_type: selectedModule === 'real-estate' ? '' : '',
        price_min: 0,
        price_max: 0,
        area_min: 0,
        area_max: 0,
        bedrooms: 0,
        bathrooms: 0,
        year_min: selectedModule === 'cars' ? 0 : 0,
        year_max: selectedModule === 'cars' ? 0 : 0,
        mileage_min: selectedModule === 'cars' ? 0 : 0,
        mileage_max: selectedModule === 'cars' ? 0 : 0,
        year_built_min: 0,
        year_built_max: 0,
        make: selectedModule === 'cars' ? '' : '',
        model: selectedModule === 'cars' ? '' : '',
        availability: false,
        stock: selectedModule === 'cars' ? '' : '',
        radius: selectedModule === 'cars' ? 0 : 0,
        view: selectedModule === 'cars' ? 'grid' : 'grid',
        page: 1,
      };
      syncControlsFromState();
      if (supportsDynamicLocationFilters) syncDynamicLocationAvailability();
      applyStateToUrl();
      loadListings();
    });
  });

  if (selectedModule === 'cars') {
    if (newCarsBtn) newCarsBtn.setAttribute('data-mc-no-loader', '1');
    if (usedCarsBtn) usedCarsBtn.setAttribute('data-mc-no-loader', '1');
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
    if (gridViewLink) {
      gridViewLink.addEventListener('click', (event) => {
        event.preventDefault();
        state.view = 'grid';
        state.page = 1;
        syncCarsViewUi();
        applyStateToUrl();
        if (lastRenderedItems.length) {
          renderCards(lastRenderedItems);
        } else {
          loadListings();
        }
      });
    }
    if (listViewLink) {
      listViewLink.addEventListener('click', (event) => {
        event.preventDefault();
        state.view = 'list';
        state.page = 1;
        syncCarsViewUi();
        applyStateToUrl();
        if (lastRenderedItems.length) {
          renderCards(lastRenderedItems);
        } else {
          loadListings();
        }
      });
    }
    if (compareLink) {
      compareLink.addEventListener('click', (event) => {
        event.preventDefault();
        syncCompareLink();
        renderCompareModal();
        ensureCompareModal().style.display = 'flex';
      });
      syncCompareLink();
      window.addEventListener('storage', syncCompareLink);
    }
  }

  removeLegacyCarsPriceFilter();
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
    ensureDualPriceSliderStyles();
    const setActiveSlider = (active) => {
      priceMinSlider.style.zIndex = active === 'min' ? '3' : '2';
      priceMaxSlider.style.zIndex = active === 'max' ? '3' : '2';
    };
    setActiveSlider('max');
    const maxLimit = Number.parseInt(priceMaxSlider.max || '0', 10) || 0;
    const step = contractorPriceStep || (Number.parseInt(priceMaxSlider.step || priceMinSlider.step || '1', 10) || 1);
    priceMinSlider.step = String(step);
    priceMaxSlider.step = String(step);

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
      setActiveSlider('min');
      const v = Number.parseInt(priceMinSlider.value || '0', 10) || 0;
      const other = Number.parseInt(priceMaxSlider.value || String(maxLimit), 10) || maxLimit;
      applyUi(v, other);
    };
    const onMaxInput = () => {
      setActiveSlider('max');
      const v = Number.parseInt(priceMaxSlider.value || String(maxLimit), 10) || maxLimit;
      const other = Number.parseInt(priceMinSlider.value || '0', 10) || 0;
      applyUi(other, v);
    };

    priceMinSlider.addEventListener('pointerdown', () => setActiveSlider('min'));
    priceMaxSlider.addEventListener('pointerdown', () => setActiveSlider('max'));
    priceMinSlider.addEventListener('mousedown', () => setActiveSlider('min'));
    priceMaxSlider.addEventListener('mousedown', () => setActiveSlider('max'));

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

  if (supportsDynamicLocationFilters) {
    syncDynamicLocationAvailability();
    loadDynamicStates()
      .then(() => loadDynamicCities(state.state, state.city))
      .then(() => syncControlsFromState());
  }

  syncControlsFromState();
  syncCarsViewUi();
  wireDeadPlaceholderLinks();
  applyStateToUrl();
  loadListings();
})();
