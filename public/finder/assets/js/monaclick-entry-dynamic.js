(() => {
  const path = window.location.pathname;
  if (!path.startsWith('/entry/')) return;

  const moduleFromPath = path.split('/')[2] || 'contractors';
  const allowedModules = new Set(['contractors', 'real-estate', 'cars', 'events', 'restaurants']);
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
    events: 'Events',
    restaurants: 'Restaurants',
  }[value] || 'Listings');

  const detailList = (item) => {
    if (item.module === 'contractors' && item.details?.contractor) {
      const d = item.details.contractor;
      return `
        <li class="d-flex justify-content-between py-2 border-bottom"><span>Service Area</span><strong>${escapeHtml(d.service_area || 'N/A')}</strong></li>
        ${d.license_number ? `<li class="d-flex justify-content-between py-2 border-bottom"><span>License</span><strong>${escapeHtml(d.license_number)}</strong></li>` : ''}
        <li class="d-flex justify-content-between py-2"><span>Verified</span><strong>${d.is_verified ? 'Yes' : 'No'}</strong></li>
      `;
    }
    if (item.module === 'real-estate' && item.details?.property) {
      const d = item.details.property;
      return `
        <li class="d-flex justify-content-between py-2 border-bottom"><span>Type</span><strong>${escapeHtml(d.property_type || 'N/A')}</strong></li>
        <li class="d-flex justify-content-between py-2 border-bottom"><span>Listing</span><strong>${escapeHtml(d.listing_type || 'N/A')}</strong></li>
        <li class="d-flex justify-content-between py-2 border-bottom"><span>Beds / Baths</span><strong>${escapeHtml(d.bedrooms ?? 0)} / ${escapeHtml(d.bathrooms ?? 0)}</strong></li>
        <li class="d-flex justify-content-between py-2"><span>Area</span><strong>${escapeHtml(d.area_sqft ?? 0)} sqft</strong></li>
      `;
    }
    if (item.module === 'cars' && item.details?.car) {
      const d = item.details.car;
      return `
        <li class="d-flex justify-content-between py-2 border-bottom"><span>Year</span><strong>${escapeHtml(d.year || 'N/A')}</strong></li>
        <li class="d-flex justify-content-between py-2 border-bottom"><span>Mileage</span><strong>${escapeHtml(d.mileage || 'N/A')}</strong></li>
        <li class="d-flex justify-content-between py-2 border-bottom"><span>Fuel</span><strong>${escapeHtml(d.fuel_type || 'N/A')}</strong></li>
        <li class="d-flex justify-content-between py-2"><span>Transmission</span><strong>${escapeHtml(d.transmission || 'N/A')}</strong></li>
      `;
    }
    if (item.module === 'events' && item.details?.event) {
      const d = item.details.event;
      return `
        <li class="d-flex justify-content-between py-2 border-bottom"><span>Starts</span><strong>${escapeHtml(formatDate(d.starts_at))}</strong></li>
        <li class="d-flex justify-content-between py-2 border-bottom"><span>Ends</span><strong>${escapeHtml(formatDate(d.ends_at))}</strong></li>
        <li class="d-flex justify-content-between py-2 border-bottom"><span>Venue</span><strong>${escapeHtml(d.venue || 'N/A')}</strong></li>
        <li class="d-flex justify-content-between py-2"><span>Capacity</span><strong>${escapeHtml(d.capacity || 'N/A')}</strong></li>
      `;
    }
    if (item.module === 'restaurants') {
      return `
        <li class="d-flex justify-content-between py-2 border-bottom"><span>Cuisine</span><strong>${escapeHtml(item.category?.name || 'N/A')}</strong></li>
        <li class="d-flex justify-content-between py-2 border-bottom"><span>City</span><strong>${escapeHtml(item.city?.name || 'N/A')}</strong></li>
        <li class="d-flex justify-content-between py-2"><span>Budget</span><strong>${escapeHtml(item.price || 'N/A')}</strong></li>
      `;
    }
    return '<li class="py-2">Details not available.</li>';
  };

  const renderEntry = (item, related = []) => {
    document.title = `Monaclick | ${moduleLabel(item.module)} - ${item.title}`;

    const images = [item.image_url, ...(item.images || []).map((img) => img.image_url)].filter(Boolean).slice(0, 5);
    const primaryImage = images[0] || '/finder/assets/img/placeholders/preview-square.svg';
    const thumbs = images.slice(1, 5);

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
              ${escapeHtml(item.price || 'Price on request')}
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
            <p class="fs-sm mb-0">${escapeHtml(item.excerpt || 'No description available yet.')}</p>
          </section>
          <section class="pb-sm-2 pb-lg-3 mb-5">
            <h2 class="h4 mb-3">Details</h2>
            <ul class="list-unstyled fs-sm mb-0">${detailList(item)}</ul>
          </section>
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

    if (window.GLightbox) {
      try {
        window.GLightbox({ selector: '[data-glightbox]' });
      } catch (e) {
        // no-op
      }
    }

    setReady();
  };

  const showNoPreview = () => {
    container.innerHTML = `
      <div class="alert alert-warning mb-0">
        Preview data is missing. Please open detailed preview from the listing form again.
      </div>
    `;
    setReady();
  };

  if (selectedModule === 'cars' && params.get('preview') === '1') {
    const title = params.get('title') || 'Car listing';
    const city = params.get('city') || '';
    const price = params.get('price') || '$0';
    const image = params.get('image') || '/finder/assets/img/placeholders/preview-square.svg';
    const year = params.get('year') || '';
    const mileage = params.get('mileage') || '';
    const fuelType = params.get('fuel_type') || '';
    const transmission = params.get('transmission') || '';

    renderEntry({
      module: 'cars',
      title,
      excerpt: '',
      price,
      rating: 0,
      reviews_count: 0,
      image_url: image,
      images: [],
      city: { name: city },
      details: {
        car: {
          year,
          mileage,
          fuel_type: fuelType,
          transmission,
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

