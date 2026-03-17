(() => {
  window.__MC_ENTRY_DYNAMIC_VERSION__ = '2026-03-14-r1';
  try { console.log('[Monaclick] entry dynamic', window.__MC_ENTRY_DYNAMIC_VERSION__); } catch (e) {}

  const path = window.location.pathname;
  if (!path.startsWith('/entry/')) return;

  const moduleFromPath = path.split('/')[2] || 'contractors';
  const allowedModules = new Set(['contractors', 'real-estate', 'cars', 'restaurants']);
  const selectedModule = allowedModules.has(moduleFromPath) ? moduleFromPath : 'contractors';
  const params = new URLSearchParams(window.location.search);

  const setReady = () => {
    if (document.body?.classList.contains('monaclick-entry-shell')) {
      document.body.setAttribute('data-entry-ready', '1');
    }
  };

  const wireDeadPlaceholderLinks = () => {
    const target = `/listings/${selectedModule}`;
    document.querySelectorAll('a[href="#!"], a[href="#"]').forEach((link) => {
      const isUiToggle = link.hasAttribute('data-bs-toggle') || link.getAttribute('role') === 'button';
      if (isUiToggle) return;
      link.setAttribute('href', target);
    });
  };

  wireDeadPlaceholderLinks();

  const container = document.querySelector('main.content-wrapper > .container');
  if (!container) {
    setReady();
    return;
  }

  // Prevent the static template's default content from flashing before we render fetched data.
  try {
    container.style.opacity = '0';
    container.style.transition = 'opacity 140ms ease';
    container.innerHTML = '';
  } catch (e) {
    // ignore
  }

  const escapeHtml = (value) =>
    String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');

  const formatDate = (iso) => {
    if (!iso) return 'N/A';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'N/A';
    return d.toLocaleString();
  };

  const moduleLabel = (value) => ({
    contractors: 'Contractors',
    'real-estate': 'Real Estate',
    cars: 'Cars',
    restaurants: 'Restaurants',
  }[value] || 'Listings');

  const formatTime = (value) => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    if (/[ap]m/i.test(raw)) return raw.replace(/\s+/g, ' ').toUpperCase();
    const m = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return raw;
    let h = Number(m[1]);
    const min = m[2];
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${String(h).padStart(2, '0')}:${min}\u00A0${ampm}`;
  };

  const formatRange = (from, to) => {
    const f = formatTime(from);
    const t = formatTime(to);
    if (f && t) return `${f}\u00A0-\u00A0${t}`;
    return f || t || '';
  };

  const numberFormatter = (() => {
    try {
      return new Intl.NumberFormat('en-US');
    } catch (e) {
      return null;
    }
  })();

  const formatNumber = (value) => {
    if (value === null || typeof value === 'undefined') return '';
    const raw = String(value).trim();
    if (!raw) return '';
    const cleaned = raw.replace(/,/g, '');
    if (!/^\d+(\.\d+)?$/.test(cleaned)) return raw;
    const n = Number(cleaned);
    if (!Number.isFinite(n)) return raw;
    return numberFormatter ? numberFormatter.format(n) : raw;
  };

  const formatMoneyDisplay = (value) => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    const m = raw.match(/^\$\s*([\d,]+(?:\.\d+)?)$/);
    if (!m) return raw;
    const formatted = formatNumber(m[1]);
    return formatted ? `$${formatted}` : raw;
  };

  const formatHours = (hours) => {
    if (!hours) return '';

    if (typeof hours === 'string') {
      const raw = hours.trim();
      if (!raw) return '';
      return raw
        .replace(/\bMon\s*-\s*Fri\b/gi, 'Mon - Fri')
        .split(/\s*,\s*/g)
        .map((p) => p.trim())
        .filter(Boolean)
        .join('\n')
        .replace(/\sAM\b/g, '\u00A0AM')
        .replace(/\sPM\b/g, '\u00A0PM')
        .replace(/\s-\s/g, '\u00A0-\u00A0');
    }

    if (typeof hours !== 'object') return '';

    const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dayShort = {
      monday: 'Mon',
      tuesday: 'Tue',
      wednesday: 'Wed',
      thursday: 'Thu',
      friday: 'Fri',
      saturday: 'Sat',
      sunday: 'Sun',
    };

    const valueToRange = (value) => {
      if (!value) return '';
      if (typeof value === 'string') return formatHours(value);
      if (typeof value === 'boolean') return value ? 'Open' : '';
      if (typeof value === 'object') {
        if (value.enabled === false) return '';
        const from = value.from ?? value.start ?? value.opens ?? '';
        const to = value.to ?? value.end ?? value.closes ?? '';
        return formatRange(from, to);
      }
      return String(value).trim();
    };

    const keys = Object.keys(hours).map((k) => String(k).trim().toLowerCase());
    const hasDayKeys = keys.some((k) => dayOrder.includes(k));

    if (!hasDayKeys) {
      return Object.entries(hours)
        .map(([k, v]) => {
          const label = String(k ?? '').trim();
          const range = valueToRange(v);
          if (!label || !range) return '';
          return `${label}: ${range}`;
        })
        .filter(Boolean)
        .join('\n');
    }

    const dayRanges = dayOrder.map((day) => ({
      day,
      range: valueToRange(hours[day]),
    })).filter((x) => x.range);

    if (!dayRanges.length) return '';

    const groups = [];
    let start = null;
    let end = null;
    let currentRange = null;

    dayRanges.forEach((item) => {
      if (currentRange === null) {
        start = item.day;
        end = item.day;
        currentRange = item.range;
        return;
      }

      const prevIdx = dayOrder.indexOf(end);
      const nextIdx = dayOrder.indexOf(item.day);
      const contiguous = nextIdx === prevIdx + 1;

      if (contiguous && item.range === currentRange) {
        end = item.day;
        return;
      }

      groups.push({ start, end, range: currentRange });
      start = item.day;
      end = item.day;
      currentRange = item.range;
    });

    groups.push({ start, end, range: currentRange });

    return groups
      .map((g) => {
        const left = g.start === g.end
          ? `${dayShort[g.start]}`
          : `${dayShort[g.start]}\u00A0-\u00A0${dayShort[g.end]}`;
        return `${left}: ${g.range}`;
      })
      .join('\n');
  };

  const normalizeRestaurantExcerpt = (item) => {
    if (item.module !== 'restaurants') return item.excerpt || '';
    // Server now returns a clean excerpt for v1 restaurant payloads, but keep a fallback for older data.
    const raw = String(item.excerpt || '').trim();
    if (!raw.startsWith('{') || !raw.endsWith('}')) return raw;
    try {
      const meta = JSON.parse(raw);
      if (meta && meta._mc_restaurant_v1) return '';
    } catch (e) {
      // ignore
    }
    return raw;
  };

  const titleCaseToken = (token) => {
    const upper = String(token || '').toUpperCase();
    const keepUpper = new Set(['ABS', 'MPG', 'GPS', 'USB', 'A/C', 'AC', 'AWD', 'FWD', 'RWD', '4WD', '2WD', 'LED']);
    if (keepUpper.has(upper)) return upper === 'AC' ? 'A/C' : upper;
    return upper.slice(0, 1) + upper.slice(1).toLowerCase();
  };

  const humanizeFeature = (value) => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    const cleaned = raw.replace(/^service:\s*/i, '').trim();
    if (!cleaned) return '';
    if (/[A-Z]/.test(cleaned) && cleaned.includes(' ')) return cleaned;
    return cleaned
      .replaceAll('_', ' ')
      .replaceAll('-', ' ')
      .split(/\s+/g)
      .filter(Boolean)
      .map(titleCaseToken)
      .join(' ');
  };

  const normalizedFeatures = (item) => {
    const base = Array.isArray(item?.features) ? item.features : [];
    const carWizard =
      item?.module === 'cars' && Array.isArray(item?.details?.car?.features)
        ? item.details.car.features
        : [];

    const values = [...base, ...carWizard]
      .map((f) => String(f ?? '').trim())
      .filter((f) => !!f && !/^service:\s*/i.test(f));

    const seen = new Set();
    return values.filter((f) => {
      const key = f.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const renderFeatures = (item) => {
    const features = normalizedFeatures(item);
    if (!features.length) return '';

    const badges = features
      .map(humanizeFeature)
      .filter(Boolean)
      .map((label) => `<span class="badge bg-body-secondary text-body">${escapeHtml(label)}</span>`)
      .join('');

    if (!badges) return '';

    return `
      <section data-mc-features="1" class="pb-sm-2 pb-lg-3 mb-5">
        <h2 class="h4 mb-3">Features</h2>
        <div class="d-flex flex-wrap gap-2">${badges}</div>
      </section>
    `;
  };

  const getCarFeatureGroupMap = async () => {
    const cacheKey = 'mc:car-feature-group-map:v1';
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) {
      // ignore
    }

    try {
      const res = await fetch('/add-car', { credentials: 'same-origin' });
      if (!res.ok) return {};
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const acc = doc.getElementById('features');
      if (!acc) return {};

      const map = {};
      acc.querySelectorAll('.accordion-item').forEach((item) => {
        const heading = item.querySelector('.accordion-header button, .accordion-header');
        const groupRaw = (heading?.textContent || '').replace(/\s+/g, ' ').trim();
        const group = groupRaw || 'Other';
        item.querySelectorAll('label.form-check-label[for]').forEach((label) => {
          const txt = (label.textContent || '').replace(/\s+/g, ' ').trim();
          if (!txt) return;
          map[txt] = group;
        });
      });

      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(map));
      } catch (e) {
        // ignore
      }

      return map;
    } catch (e) {
      return {};
    }
  };

  const enhanceCarFeaturesSection = async (item) => {
    if (item.module !== 'cars') return;
    const section = container.querySelector('section[data-mc-features="1"]');
    if (!section) return;

    const features = normalizedFeatures(item).map(humanizeFeature).filter(Boolean);
    if (!features.length) return;

    const map = await getCarFeatureGroupMap();
    const groups = {};
    features.forEach((label) => {
      const key = String(label || '').trim();
      const group = String(map[key] || '').trim() || 'Other';
      if (!groups[group]) groups[group] = [];
      groups[group].push(key);
    });

    const order = ['Exterior', 'Interior', 'Safety', 'Other'];
    const groupNames = Array.from(new Set([...order, ...Object.keys(groups)]));

    const renderGroup = (name) => {
      const items = groups[name] || [];
      if (!items.length) return '';
      const badges = items
        .map((txt) => `<span class="badge bg-body-secondary text-body">${escapeHtml(txt)}</span>`)
        .join('');
      return `
        <div class="mb-3">
          <h3 class="h6 mb-2">${escapeHtml(name)}</h3>
          <div class="d-flex flex-wrap gap-2">${badges}</div>
        </div>
      `;
    };

    const body = groupNames.map(renderGroup).filter(Boolean).join('');
    if (!body) return;

    section.innerHTML = `
      <h2 class="h4 mb-3">Features</h2>
      ${body}
    `;
  };

  // Some deployed templates/JS variants don't include ${renderFeatures(item)} in the main HTML string.
  // Ensure the Features section appears right after the Details section whenever features exist.
  const ensureFeaturesAfterDetails = (item) => {
    const features = normalizedFeatures(item);
    if (!features.length) return;
    if (!container) return;
    if (container.querySelector('[data-mc-features="1"]')) return;

    const detailsHeading = Array.from(container.querySelectorAll('h2.h4'))
      .find((h) => (h.textContent || '').trim().toLowerCase() === 'details');
    const detailsSection = detailsHeading ? detailsHeading.closest('section') : null;
    if (!detailsSection) return;

    const html = renderFeatures(item);
    if (!html.trim()) return;

    detailsSection.insertAdjacentHTML('afterend', html);
  };

  const detailPairs = (item) => {
    const pairs = [];
    const add = (label, value, opts = {}) => {
      const v = String(value ?? '').trim();
      if (!v || v.toLowerCase() === 'n/a') return;
      pairs.push({ label, value: v, preLine: !!opts.preLine });
    };

    add('Category', item.category?.name || '');
    add('City', item.city?.name || '');
    add('Price', item.price || '');
    add('Rating', item.rating ? `${Number(item.rating).toFixed(1)} (${Number(item.reviews_count || 0)})` : '');

    if (item.module === 'contractors' && item.details?.contractor) {
      const d = item.details.contractor;
      const services = (Array.isArray(item.features) ? item.features : [])
        .map((f) => String(f ?? '').trim())
        .filter((f) => /^service:\s*/i.test(f))
        .map((f) => f.replace(/^service:\s*/i, '').trim())
        .filter(Boolean);

      if (services.length) add('Services', services.join(', '));
      add('Service Area', d.service_area || '');
      add('License', d.license_number || '');
      add('Verified', d.is_verified ? 'Yes' : 'No');
      const hours = formatHours(d.business_hours);
      if (hours) add('Hours', hours, { preLine: true });
    }

    if (item.module === 'real-estate' && item.details?.property) {
      const d = item.details.property;
      add('Contact Name', d.contact_name || '');
      add('Contact', [d.contact_phone, d.contact_email].filter(Boolean).join('\n'), { preLine: true });
      add('Type', d.property_type || '');
      add('Listing', d.listing_type || '');
      add('Bedrooms', d.bedrooms ?? '');
      add('Bathrooms', d.bathrooms ?? '');
      add('Area (sqft)', d.area_sqft !== null && typeof d.area_sqft !== 'undefined' ? formatNumber(d.area_sqft) : '');
      add('Total floors', d.floors_total ?? '');
      add('Floor', d.floor ?? '');
      add('Total area', d.total_area !== null && typeof d.total_area !== 'undefined' ? formatNumber(d.total_area) : '');
      add('Living area', d.living_area !== null && typeof d.living_area !== 'undefined' ? formatNumber(d.living_area) : '');
      add('Kitchen area', d.kitchen_area !== null && typeof d.kitchen_area !== 'undefined' ? formatNumber(d.kitchen_area) : '');
      add('Parking', d.parking ?? '');
      add('Address', d.address ?? '');
      add('ZIP', d.zip ?? '');
    }

    if (item.module === 'cars' && item.details?.car) {
      const d = item.details.car;
      add('Contact', [d.contact_phone, d.contact_email].filter(Boolean).join('\n'), { preLine: true });
      add('Car', [d.brand, d.model].filter(Boolean).join(' '));
      add('Condition', d.condition || '');
      add('Verified', d.is_verified ? 'Yes' : 'No');
      add('Year', d.year || '');
      add('Mileage', d.mileage ? formatNumber(d.mileage) : '');
      add('Body', d.body_type || '');
      add('Drive', d.drive_type || '');
      add('Engine', d.engine || '');
      add('Fuel', d.fuel_type || '');
      add('Transmission', d.transmission || '');
      if (d.city_mpg || d.highway_mpg) {
        add('MPG', [
          d.city_mpg ? `City ${formatNumber(d.city_mpg)}` : '',
          d.highway_mpg ? `Hwy ${formatNumber(d.highway_mpg)}` : '',
        ].filter(Boolean).join(' / '));
      }
      add('Lister', [d.contact_first_name, d.contact_last_name].filter(Boolean).join(' '));
      add('Seller', d.seller_type || '');
      const flags = [];
      if (d.negotiated) flags.push('Negotiable');
      if (d.installments) flags.push('Installments');
      if (d.exchange) flags.push('Exchange');
      if (d.uncleared) flags.push('Uncleared');
      if (d.dealer_ready) flags.push('Dealer ready');
      if (flags.length) add('Options', flags.join(', '));
      add('Color', [d.exterior_color, d.interior_color].filter(Boolean).join(' / '));
    }

    if (item.module === 'restaurants') {
      const d = item.details?.restaurant || {};
      add('Contact Name', d.contact_name || '');
      add('Contact', [d.phone, d.email].filter(Boolean).join('\n'), { preLine: true });
      add('Cuisine', item.category?.name || '');
      add('Address', d.address || '');
      add('ZIP', d.zip_code || '');
      add('Seats', d.seating_capacity ? formatNumber(d.seating_capacity) : '');
      add('Services', Array.isArray(d.services) ? d.services.filter(Boolean).join(', ') : '');
      const restHours = formatHours(d.opening_hours);
      if (restHours) add('Hours', restHours, { preLine: true });
    }

    return pairs;
  };

  const renderDetailsGrid = (item) => {
    const pairs = detailPairs(item);
    if (!pairs.length) {
      return '<div class="text-body-secondary fs-sm">Details not available.</div>';
    }

    const wideLabels = new Set(['Address', 'Hours', 'Contact', 'Services', 'Service Area']);
    const colClassFor = (label) => {
      const base = 'col-12 col-sm-6 col-lg-3';
      if (!label) return base;
      if (wideLabels.has(label)) return 'col-12 col-sm-6 col-lg-6';
      return base;
    };

    const valueStyleFor = (p) => {
      const style = ['overflow-wrap:anywhere', 'word-break:break-word'];
      if (p.preLine) style.push('white-space:pre-line');
      return style.join(';');
    };
    return `
      <div class="row g-3">
        ${pairs.map((p) => `
          <div class="${colClassFor(p.label)}">
            <div class="border rounded p-3 h-100">
              <div class="text-body-secondary small">${escapeHtml(p.label)}</div>
              <div class="fw-semibold" style="${valueStyleFor(p)}">${escapeHtml(p.value)}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  };

  const renderEntry = (item, related = []) => {
    document.title = `Monaclick | ${moduleLabel(item.module)} - ${item.title}`;

    const images = [item.image_url, ...(item.images || []).map((img) => img.image_url)].filter(Boolean).slice(0, 5);
    const primaryImage = images[0] || '/finder/assets/img/placeholders/preview-square.svg';
    const thumbs = images.slice(1, 5);

    const titleBadges = (() => {
      if (item.module !== 'cars') return '';
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
      if (!badges.length) return '';
      return `<div class="d-flex flex-wrap gap-2 mb-2">${badges.join('')}</div>`;
    })();

    const renderCarSections = (car) => {
      const d = car || {};
      const blocks = [];

      const section = (title, inner) => {
        const html = String(inner || '').trim();
        if (!html) return;
        blocks.push(`
          <section class="pb-sm-2 pb-lg-3 mb-5">
            <h2 class="h4 mb-3">${escapeHtml(title)}</h2>
            ${html}
          </section>
        `);
      };

      const rows = (items) => {
        const visible = items.filter((it) => it && String(it.value ?? '').trim() !== '');
        if (!visible.length) return '';
        return `
          <div class="row g-3">
            ${visible.map((it) => `
              <div class="${it.wide ? 'col-12' : 'col-12 col-sm-6'}">
                <div class="border rounded p-3 h-100">
                  <div class="text-body-secondary small">${escapeHtml(it.label)}</div>
                  <div class="fw-semibold"${it.preLine ? ' style="white-space:pre-line;overflow-wrap:anywhere;word-break:break-word"' : ' style="overflow-wrap:anywhere;word-break:break-word"'}>${escapeHtml(it.value)}</div>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      };

      const contactName = [d.contact_first_name, d.contact_last_name].filter(Boolean).join(' ').trim();

      section('Basic information', rows([
        { label: 'Condition of the car', value: d.condition || '' },
        { label: 'Car brand', value: d.brand || '' },
        { label: 'Car model', value: d.model || '' },
        { label: 'Manufacturing year', value: d.year || '' },
        { label: 'Mileage', value: d.mileage ? formatNumber(d.mileage) : '' },
        { label: 'Body type', value: d.body_type || '' },
        { label: 'Radius', value: d.radius ? formatNumber(d.radius) : '' },
        { label: 'City', value: item.city?.name || '' },
      ]));

      section('Specifications', rows([
        { label: 'Drive type', value: d.drive_type || '' },
        { label: 'Engine', value: d.engine || '' },
        { label: 'Fuel type', value: d.fuel_type || '' },
        { label: 'Transmission', value: d.transmission || '' },
        { label: 'City MPG', value: d.city_mpg ? formatNumber(d.city_mpg) : '' },
        { label: 'Highway MPG', value: d.highway_mpg ? formatNumber(d.highway_mpg) : '' },
        { label: 'Exterior color', value: d.exterior_color || '' },
        { label: 'Interior color', value: d.interior_color || '' },
        { label: 'Description', value: item.excerpt || '', wide: true },
      ]));

      // Features (with subheadings based on add-car form groups)
      const featureLabels = normalizedFeatures(item).map(humanizeFeature).filter(Boolean);
      if (featureLabels.length) {
        section('Features', `
          <div data-mc-car-features="1" class="text-body-secondary small">Loading feature groups…</div>
        `);
      }

      const priceOptions = [];
      if (d.negotiated) priceOptions.push('Negotiated price');
      if (d.installments) priceOptions.push('Payment in installments is possible');
      if (d.exchange) priceOptions.push('Exchange for a car is possible');
      if (d.uncleared) priceOptions.push('Uncleared car');
      if (d.dealer_ready) priceOptions.push('Ready to cooperate with dealers');

      section('Price', rows([
        { label: 'Price', value: formatMoneyDisplay(item.price || '') },
        { label: 'Selected options', value: priceOptions.join('\n'), preLine: true, wide: true },
      ]));

      section('Contacts', rows([
        { label: 'Seller type', value: d.seller_type || '' },
        { label: 'First name', value: d.contact_first_name || '' },
        { label: 'Last name', value: d.contact_last_name || '' },
        { label: 'Email', value: d.contact_email || '' },
        { label: 'Phone number', value: d.contact_phone || '' },
        { label: 'Contact', value: [d.contact_phone, d.contact_email].filter(Boolean).join('\n'), preLine: true, wide: true },
        { label: 'Lister', value: contactName || '' },
      ]));

      return blocks.join('');
    };

    container.innerHTML = `
      <nav class="pb-2 pb-md-3" aria-label="breadcrumb">
        <ol class="breadcrumb">
          <li class="breadcrumb-item"><a href="/${item.module}">Home</a></li>
          <li class="breadcrumb-item"><a href="/listings/${item.module}">${moduleLabel(item.module)}</a></li>
          <li class="breadcrumb-item active" aria-current="page">${escapeHtml(item.title)}</li>
        </ol>
      </nav>

      <div class="d-flex align-items-start align-items-sm-center justify-content-between pb-3 mb-3">
        <div>
          ${titleBadges}
          <h1 class="h4 mb-2">${escapeHtml(item.title)}</h1>
          <ul class="list-inline gap-2 fs-sm ms-n2 mb-0">
            <li class="d-flex align-items-center gap-1 ms-2">
              <i class="fi-star-filled text-warning"></i>
              <span class="fs-sm text-secondary-emphasis">${Number(item.rating || 0).toFixed(1)}</span>
              <span class="fs-xs text-body-secondary align-self-end">(${Number(item.reviews_count || 0)})</span>
            </li>
            <li class="d-flex align-items-center gap-1 ms-2">
              <i class="fi-map-pin"></i>
              ${escapeHtml(item.city?.name || 'City')}
            </li>
            <li class="d-flex align-items-center gap-1 ms-2">
              <i class="fi-credit-card"></i>
              ${escapeHtml(formatMoneyDisplay(item.price || '') || 'Price on request')}
            </li>
          </ul>
        </div>
      </div>

      <div class="row g-3 g-sm-4 g-md-3 g-xl-4 pb-sm-2 mb-5">
        <div class="col-md-8">
          <a class="hover-effect-scale hover-effect-opacity position-relative d-flex rounded overflow-hidden" href="${escapeHtml(primaryImage)}" data-glightbox data-gallery="image-gallery">
            <i class="fi-zoom-in hover-effect-target fs-3 text-white position-absolute top-50 start-50 translate-middle opacity-0 z-2"></i>
            <span class="hover-effect-target position-absolute top-0 start-0 w-100 h-100 bg-black bg-opacity-25 opacity-0 z-1"></span>
            <div class="ratio hover-effect-target bg-body-tertiary rounded" style="--fn-aspect-ratio: calc(432 / 856 * 100%)">
              <img src="${escapeHtml(primaryImage)}" alt="${escapeHtml(item.title)}" onerror="this.onerror=null;this.src='/finder/assets/img/placeholders/preview-square.svg';">
            </div>
          </a>
        </div>
        <div class="col-md-4">
          <div class="row row-cols-2 g-3 g-sm-4 g-md-3 g-xl-4">
            ${thumbs.map((img) => `
              <div class="col">
                <a class="hover-effect-scale hover-effect-opacity position-relative d-flex rounded overflow-hidden" href="${escapeHtml(img)}" data-glightbox data-gallery="image-gallery">
                  <i class="fi-zoom-in hover-effect-target fs-3 text-white position-absolute top-50 start-50 translate-middle opacity-0 z-2"></i>
                  <span class="hover-effect-target position-absolute top-0 start-0 w-100 h-100 bg-black bg-opacity-25 opacity-0 z-1"></span>
                  <div class="ratio hover-effect-target bg-body-tertiary rounded" style="--fn-aspect-ratio: calc(204 / 196 * 100%)">
                    <img src="${escapeHtml(img)}" alt="${escapeHtml(item.title)}" onerror="this.onerror=null;this.src='/finder/assets/img/placeholders/preview-square.svg';">
                  </div>
                </a>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="row pb-2 pb-sm-3 pb-md-4 pb-lg-5">
        <div class="col-lg-8 col-xl-7">
          <section class="pb-sm-2 pb-lg-3 mb-5">
            <h2 class="h4 mb-lg-4">About</h2>
            <p class="fs-sm mb-0">${escapeHtml(normalizeRestaurantExcerpt(item) || 'No description available yet.')}</p>
          </section>
          ${item.module === 'cars'
            ? renderCarSections(item.details?.car || {})
            : `
              <section class="pb-sm-2 pb-lg-3 mb-5">
                <h2 class="h4 mb-3">Details</h2>
                ${renderDetailsGrid(item)}
              </section>
              ${renderFeatures(item)}
            `}
          <section class="pb-sm-2 pb-lg-3 mb-0">
            <h2 class="h4 mb-4">Related listings</h2>
            <div class="row row-cols-1 row-cols-sm-2 g-4">
              ${related.map((r) => `
                <div class="col">
                  <article class="card h-100 border-0 shadow-sm hover-effect-opacity">
                    <img src="${escapeHtml(r.image_url || '/finder/assets/img/placeholders/preview-square.svg')}" class="card-img-top" alt="${escapeHtml(r.title)}" style="height: 180px; object-fit: cover;" onerror="this.onerror=null;this.src='/finder/assets/img/placeholders/preview-square.svg';">
                    <div class="card-body">
                      <h3 class="h6 mb-1">
                        <a class="hover-effect-underline" href="/entry/${encodeURIComponent(r.module)}?slug=${encodeURIComponent(r.slug)}">${escapeHtml(r.title)}</a>
                      </h3>
                      <p class="small text-body-secondary mb-2">${escapeHtml(r.city?.name || '')}</p>
                      <div class="small text-warning"><i class="fi-star-filled me-1"></i>${Number(r.rating || 0).toFixed(1)} (${Number(r.reviews_count || 0)})</div>
                    </div>
                  </article>
                </div>
              `).join('')}
            </div>
          </section>
        </div>
      </div>
    `;

    ensureFeaturesAfterDetails(item);

    if (window.GLightbox) {
      try {
        window.GLightbox({ selector: '[data-glightbox]' });
      } catch (e) {
        // no-op
      }
    }

    // Enhance car features into sub-headings (Exterior / Interior / Safety) once the car sections are present.
    if (item.module === 'cars') {
      const carFeaturesTarget = container.querySelector('[data-mc-car-features="1"]');
      if (carFeaturesTarget) {
        enhanceCarFeaturesSection(item).then(() => {
          // If legacy features section was rendered, keep it; otherwise swap the placeholder.
          const legacy = container.querySelector('section[data-mc-features="1"]');
          if (legacy) return;
          const features = normalizedFeatures(item).map(humanizeFeature).filter(Boolean);
          if (!features.length) return;
          getCarFeatureGroupMap().then((map) => {
            const groups = {};
            features.forEach((label) => {
              const group = String(map[label] || '').trim() || 'Other';
              if (!groups[group]) groups[group] = [];
              groups[group].push(label);
            });
            const order = ['Exterior', 'Interior', 'Safety', 'Other'];
            const groupNames = Array.from(new Set([...order, ...Object.keys(groups)]));
            const body = groupNames.map((name) => {
              const items = groups[name] || [];
              if (!items.length) return '';
              return `
                <div class="mb-3">
                  <h3 class="h6 mb-2">${escapeHtml(name)}</h3>
                  <div class="d-flex flex-wrap gap-2">
                    ${items.map((txt) => `<span class="badge bg-body-secondary text-body">${escapeHtml(txt)}</span>`).join('')}
                  </div>
                </div>
              `;
            }).filter(Boolean).join('');
            if (body) carFeaturesTarget.outerHTML = body;
          });
        });
      } else {
        enhanceCarFeaturesSection(item);
      }
    } else {
      enhanceCarFeaturesSection(item);
    }

    try { container.style.opacity = '1'; } catch (e) {}
    setReady();
  };

  const showNoPreview = () => {
    container.innerHTML = `
      <div class="alert alert-warning mb-0">
        Preview data is missing. Please open detailed preview from the listing form again.
      </div>
    `;
    try { container.style.opacity = '1'; } catch (e) {}
    setReady();
  };

  if (selectedModule === 'cars' && params.get('preview') === '1') {
    const truthyParam = (key) => {
      if (!params.has(key)) return false;
      const raw = String(params.get(key) ?? '').trim().toLowerCase();
      if (!raw) return true;
      if (['0', 'false', 'no', 'off'].includes(raw)) return false;
      return true;
    };

    const parseJsonArray = (raw) => {
      const text = String(raw ?? '').trim();
      if (!text) return [];
      try {
        const decoded = JSON.parse(text);
        return Array.isArray(decoded) ? decoded : [];
      } catch (e) {
        return [];
      }
    };

    const uniq = (values) => {
      const out = [];
      const seen = new Set();
      values.forEach((v) => {
        const s = String(v ?? '').trim();
        if (!s) return;
        const key = s.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        out.push(s);
      });
      return out;
    };

    const title = params.get('title') || 'Car listing';
    const city = params.get('city') || '';
    const price = params.get('price') || '$0';
    const image = params.get('image') || '/finder/assets/img/placeholders/preview-square.svg';
    const brand = params.get('brand') || '';
    const model = params.get('model') || '';
    const condition = params.get('condition') || '';
    const year = params.get('year') || '';
    const mileage = params.get('mileage') || '';
    const radius = params.get('radius') || '';
    const driveType = params.get('drive_type') || '';
    const engine = params.get('engine') || '';
    const fuelType = params.get('fuel_type') || '';
    const transmission = params.get('transmission') || '';
    const bodyType = params.get('body_type') || params.get('body') || '';
    const exteriorColor = params.get('exterior_color') || '';
    const interiorColor = params.get('interior_color') || '';
    const sellerType = params.get('seller_type') || params.get('seller') || '';
    const contactPhone = params.get('contact_phone') || params.get('phone') || '';
    const contactEmail = params.get('contact_email') || params.get('email') || '';
    const features = uniq([
      ...parseJsonArray(params.get('features_json')),
      ...params.getAll('car_features[]'),
    ]);

    renderEntry({
      module: 'cars',
      title,
      excerpt: '',
      price,
      features,
      rating: 0,
      reviews_count: 0,
      image_url: image,
      images: [],
      city: { name: city },
      details: {
        car: {
          brand,
          model,
          condition,
          year,
          mileage,
          radius,
          drive_type: driveType,
          engine,
          fuel_type: fuelType,
          transmission,
          body_type: bodyType,
          exterior_color: exteriorColor,
          interior_color: interiorColor,
          seller_type: sellerType,
          contact_phone: contactPhone,
          contact_email: contactEmail,
          negotiated: truthyParam('negotiated'),
          installments: truthyParam('installments'),
          exchange: truthyParam('exchange'),
          uncleared: truthyParam('uncleared'),
          dealer_ready: truthyParam('dealer_ready'),
          features,
        },
      },
    }, []);
    return;
  }

  if (!params.get('slug') && selectedModule !== 'restaurants') {
    showNoPreview();
    return;
  }

  if (selectedModule === 'restaurants' && !params.get('slug')) {
    setReady();
    return;
  }

  container.innerHTML = `
    <div class="py-5 text-center text-body-secondary">
      <div class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></div>
      Loading listing details...
    </div>
  `;

  const apiQuery = new URLSearchParams({ module: selectedModule });
  if (params.get('slug')) apiQuery.set('slug', params.get('slug'));

  fetch(`/api/monaclick/entry?${apiQuery.toString()}`)
    .then((res) => {
      if (!res.ok) throw new Error('Entry API failed');
      return res.json();
    })
    .then((payload) => {
      const item = payload?.data;
      const related = Array.isArray(payload?.related) ? payload.related : [];
      if (!item) throw new Error('No entry payload');
      renderEntry(item, related);
    })
    .catch(() => {
      container.innerHTML = `
        <div class="alert alert-danger mb-0">
          Unable to load listing details.
        </div>
      `;
      setReady();
    });
})();
