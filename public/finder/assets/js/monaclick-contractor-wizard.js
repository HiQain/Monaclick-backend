(() => {
  const stepMap = {
    '/add-contractor': '/add-contractor',
    '/add-contractor-location': '/add-contractor',
    '/add-contractor-services': '/add-contractor-services',
    '/add-contractor-profile': '/add-contractor-profile',
    '/add-contractor-price-hours': '/add-contractor-price-hours',
    '/add-contractor-project': '/add-contractor-project'
  };

  const search = new URLSearchParams(window.location.search);
  const editId = (search.get('edit') || '').trim();
  const key = `mc-contractor-draft:${editId || 'new'}`;
  const withEdit = (url) => (editId ? `${url}?edit=${encodeURIComponent(editId)}` : url);
  const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
  if (!Object.prototype.hasOwnProperty.call(stepMap, currentPath)) return;

  const selectedGalleryFiles = [];
  let nextGalleryId = 1;
  let selectedProfilePhotoFile = null;
  let existingGalleryUrls = [];
  let loadedEditData = null;
  let submitInFlight = false;

  const readState = () => {
    try {
      return JSON.parse(sessionStorage.getItem(key) || '{}') || {};
    } catch {
      return {};
    }
  };

  const writeState = (next) => {
    const merged = { ...readState(), ...next };
    sessionStorage.setItem(key, JSON.stringify(merged));
  };

  const readCookie = (name) => {
    const token = `${name}=`;
    const row = document.cookie.split('; ').find((part) => part.startsWith(token));
    return row ? decodeURIComponent(row.slice(token.length)) : '';
  };

  const getCsrfToken = () => {
    const fromWindow = String(window.__mcCsrf || '').trim();
    if (fromWindow) return fromWindow;
    const fromMeta = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
    if (fromMeta) return fromMeta;
    const fromCookie = readCookie('XSRF-TOKEN');
    return fromCookie || '';
  };

  const saveControls = () => {
    const prev = readState();
    const controls = { ...(prev.controls || {}) };
    document.querySelectorAll('input, select, textarea').forEach((el) => {
      const k = el.id || el.name;
      if (!k) return;
      if (el.type === 'checkbox' || el.type === 'radio') controls[k] = !!el.checked;
      else controls[k] = el.value;
    });

    // Some Finder templates don't provide id/name attributes for these selects; persist them explicitly.
    const stateSelect = document.querySelector('select[aria-label="State select"]');
    if (stateSelect) {
      controls.state = String(stateSelect.value || '').trim();
    }

    const citySelect = document.querySelector('select[aria-label="City select"]');
    if (citySelect) {
      const label = (citySelect.querySelector('option:checked')?.textContent || '').trim();
      const value = String(citySelect.value || '').trim();
      controls['select:city-select'] = label || value || String(controls['select:city-select'] || '');
    }
    writeState({ controls });
  };

  const restoreControls = () => {
    const state = readState();
    const controls = state.controls || {};
    Object.entries(controls).forEach(([k, v]) => {
      const el = document.getElementById(k) || document.querySelector(`[name="${CSS.escape(k)}"]`);
      if (!el) return;
      if (el.type === 'checkbox' || el.type === 'radio') el.checked = !!v;
      else el.value = String(v ?? '');
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const stateSelect = document.querySelector('select[aria-label="State select"]');
    const savedState = String(controls.state || '').trim();
    if (stateSelect && savedState) {
      stateSelect.value = savedState;
      stateSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const citySelect = document.querySelector('select[aria-label="City select"]');
    const savedCity = String(controls['select:city-select'] || '').trim();
    if (citySelect && savedCity) {
      const match = Array.from(citySelect.options).find((opt) => (opt.textContent || '').trim() === savedCity);
      if (match) citySelect.value = match.value;
      citySelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  const makeChip = (label) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-sm btn-outline-secondary rounded-pill';
    btn.innerHTML = `<i class="fi-close fs-sm ms-n1 me-1"></i>${label}`;
    return btn;
  };

  const bindAreaServices = () => {
    const input = document.getElementById('area-search');
    const wrap = document.getElementById('selected-service-areas') || Array.from(document.querySelectorAll('div.d-flex.flex-wrap.gap-2'))
      .find((el) => el.querySelector('button.btn.btn-sm.btn-outline-secondary'));
    if (!input || !wrap) return;
    input.type = 'text';

    const getAreas = () => Array.from(wrap.querySelectorAll('button.btn.btn-sm.btn-outline-secondary'))
      .map((btn) => (btn.textContent || '').replace(/\s+/g, ' ').trim().replace(/^x\s*/i, ''))
      .filter(Boolean);

    const saveAreas = () => writeState({ areas: getAreas() });
    const addArea = (raw) => {
      const val = String(raw || '').trim();
      if (!val) return;
      const list = getAreas().map((v) => v.toLowerCase());
      if (list.includes(val.toLowerCase())) return;
      wrap.appendChild(makeChip(val));
      saveAreas();
    };

    if (wrap.dataset.mcAreaBound !== '1') {
      wrap.dataset.mcAreaBound = '1';
      wrap.addEventListener('click', (event) => {
        const btn = event.target && event.target.closest('button.btn.btn-sm.btn-outline-secondary');
        if (!btn) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        btn.remove();
        saveAreas();
      }, true);

      const consume = () => {
        const raw = input.value || '';
        raw.split(',').map((v) => v.trim()).filter(Boolean).forEach(addArea);
        input.value = '';
      };
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ',') {
          event.preventDefault();
          consume();
        }
      });
      input.addEventListener('blur', consume);
    }

    const saved = readState().areas;
    if (Array.isArray(saved) && saved.length) {
      wrap.innerHTML = '';
      saved.forEach((a) => wrap.appendChild(makeChip(a)));
    }
  };

  const bindProvidedServices = () => {
    if (currentPath !== '/add-contractor-services') return;

    const heading = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
      .find((h) => (h.textContent || '').trim().toLowerCase() === 'i provide these services:');
    const container = heading ? heading.nextElementSibling : null;
    if (!container) return;

    const rows = Array.from(container.querySelectorAll('input[type="checkbox"]'))
      .map((cb) => {
        const id = cb.id;
        const label = id ? container.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
        const text = (label?.textContent || '').replace(/\s+/g, ' ').trim();
        return { cb, text };
      })
      .filter((row) => row.cb && row.text);

    if (!rows.length) return;

    const save = () => {
      const services = rows
        .filter((row) => row.cb.checked)
        .map((row) => row.text);
      writeState({ services });
    };

    if (container.dataset.mcServicesBound !== '1') {
      container.dataset.mcServicesBound = '1';
      container.addEventListener('change', (event) => {
        const target = event.target;
        if (!target || target.tagName !== 'INPUT') return;
        if (target.type !== 'checkbox') return;
        save();
      }, true);
      save();
    }

    const saved = readState().services;
    if (Array.isArray(saved) && saved.length) {
      const set = new Set(saved.map((s) => String(s).toLowerCase()));
      rows.forEach((row) => {
        row.cb.checked = set.has(row.text.toLowerCase());
      });
    }
  };

  const bindProfilePhoto = () => {
    const btn = Array.from(document.querySelectorAll('button, a'))
      .find((el) => (el.textContent || '').trim().toLowerCase() === 'update photo');
    if (!btn) return;

    const img = btn.closest('.d-flex')?.querySelector('img') || document.querySelector('img');
    if (!img) return;

    if (btn.dataset.mcProfileBound === '1') return;
    btn.dataset.mcProfileBound = '1';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.className = 'position-absolute top-0 start-0 w-100 h-100 opacity-0';
    fileInput.style.cursor = 'pointer';
    fileInput.style.zIndex = '2';
    fileInput.dataset.mcAvatarInput = '1';

    if (getComputedStyle(btn).position === 'static') btn.style.position = 'relative';
    btn.appendChild(fileInput);

    const uploadProfilePhoto = async (file) => {
      if (!file || !editId) return null;
      const csrf = getCsrfToken();
      if (!csrf) return null;
      const fd = new FormData();
      fd.append('_token', csrf);
      fd.append('profile_photo', file);
      const res = await fetch(`/account/contractors/${encodeURIComponent(editId)}/profile-photo`, {
        method: 'POST',
        body: fd,
        credentials: 'same-origin',
      });
      if (!res.ok) return null;
      const json = await res.json();
      const url = String(json?.image_url || '').trim();
      return url || null;
    };

    fileInput.addEventListener('change', () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      selectedProfilePhotoFile = f;
      const localPreview = URL.createObjectURL(f);
      img.src = localPreview;
      fileInput.value = '';
      uploadProfilePhoto(f)
        .then((remoteUrl) => {
          if (!remoteUrl) return;
          img.src = remoteUrl;
          if (loadedEditData && typeof loadedEditData === 'object') {
            loadedEditData.profile_image = remoteUrl;
            loadedEditData.image = remoteUrl;
          }
        })
        .catch(() => {
          // Keep local preview when upload fails.
        });
    });
  };

  const createGalleryCard = ({ src, isVideo = false, fileId = null, existingUrl = '' }) => {
    const col = document.createElement('div');
    col.className = 'col';
    if (fileId !== null) col.dataset.fileId = String(fileId);
    if (existingUrl) col.dataset.existingUrl = existingUrl;
    col.innerHTML = `
      <div class="hover-effect-opacity position-relative overflow-hidden rounded">
        <div class="ratio" style="--fn-aspect-ratio: calc(180 / 268 * 100%)">
          ${isVideo
            ? `<video src="${src}" class="w-100 h-100 object-fit-cover" muted controls></video>`
            : `<img src="${src}" alt="Uploaded image" class="w-100 h-100 object-fit-cover">`}
        </div>
        <div class="hover-effect-target position-absolute top-0 start-0 d-flex align-items-center justify-content-center w-100 h-100 opacity-0">
          <button type="button" class="btn btn-icon btn-sm btn-light position-relative z-2" aria-label="Remove"><i class="fi-trash fs-base"></i></button>
          <span class="position-absolute top-0 start-0 w-100 h-100 bg-black bg-opacity-25 z-1"></span>
        </div>
      </div>
    `;
    return col;
  };

  const bindProjectGallery = () => {
    const grid = document.querySelector('.border.rounded.p-3 .row.row-cols-2.row-cols-sm-3.g-2') ||
      document.querySelector('.row.row-cols-2.row-cols-sm-3.g-2.g-md-3');
    if (!grid) return;

    const uploadCol = Array.from(grid.children).find((col) => {
      const t = (col.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      return t.includes('upload photos / videos');
    });
    if (!uploadCol) return;

    Array.from(grid.children).forEach((col) => {
      if (col === uploadCol) return;
      if (col.dataset.fileId || col.dataset.existingUrl) return;
      col.remove();
    });

    Array.from(grid.querySelectorAll('.col[data-existing-url]')).forEach((col) => col.remove());
    existingGalleryUrls.forEach((url) => {
      grid.insertBefore(createGalleryCard({ src: url, existingUrl: url }), uploadCol);
    });

    if (uploadCol.dataset.mcUploadBound === '1') return;
    uploadCol.dataset.mcUploadBound = '1';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.accept = 'image/*,video/*';
    fileInput.className = 'position-absolute top-0 start-0 w-100 h-100 opacity-0';
    fileInput.style.zIndex = '5';
    fileInput.style.cursor = 'pointer';
    fileInput.dataset.mcUploadInput = '1';

    const uploadTile = uploadCol.querySelector('.d-flex.align-items-center.justify-content-center.position-relative.h-100.cursor-pointer') || uploadCol;
    if (!uploadTile.classList.contains('position-relative')) uploadTile.classList.add('position-relative');
    uploadTile.appendChild(fileInput);

    fileInput.addEventListener('change', () => {
      const files = Array.from(fileInput.files || []);
      files.forEach((file) => {
        const id = nextGalleryId++;
        selectedGalleryFiles.push({ id, file });
        const src = URL.createObjectURL(file);
        const card = createGalleryCard({ src, isVideo: file.type.startsWith('video/'), fileId: id });
        grid.insertBefore(card, uploadCol);
      });
      fileInput.value = '';
    });

    grid.addEventListener('click', (event) => {
      const btn = event.target && event.target.closest('button[aria-label="Remove"]');
      if (!btn) return;
      const col = btn.closest('.col');
      if (!col || col === uploadCol) return;
      event.preventDefault();
      event.stopImmediatePropagation();

      const fileId = Number(col.dataset.fileId || '0');
      if (fileId > 0) {
        const idx = selectedGalleryFiles.findIndex((row) => row.id === fileId);
        if (idx >= 0) selectedGalleryFiles.splice(idx, 1);
      }

      const existingUrl = String(col.dataset.existingUrl || '').trim();
      if (existingUrl) {
        existingGalleryUrls = existingGalleryUrls.filter((u) => u !== existingUrl);
      }

      col.remove();
    }, true);
  };

  const bindTopStepper = () => {
    const map = [
      ['business location', '/add-contractor'],
      ['choose services', '/add-contractor-services'],
      ['profile details', '/add-contractor-profile'],
      ['price and hours', '/add-contractor-price-hours'],
      ['create first project', '/add-contractor-project']
    ];

    Array.from(document.querySelectorAll('.hover-effect-underline.stretched-link, .fs-sm.fw-semibold')).forEach((el) => {
      const t = (el.textContent || '').trim().toLowerCase();
      const step = map.find((m) => t.includes(m[0]));
      if (!step) return;
      const link = el.closest('a') || el;
      if (link.tagName === 'A') link.setAttribute('href', withEdit(step[1]));
      else {
        link.style.cursor = 'pointer';
        link.addEventListener('click', () => { window.location.href = withEdit(step[1]); });
      }
    });
  };

  const fixWorkingHoursLayout = () => {
    if (currentPath !== '/add-contractor-price-hours') return;

    if (!document.getElementById('mc-hours-layout-style')) {
      const style = document.createElement('style');
      style.id = 'mc-hours-layout-style';
      style.textContent = `
        .mc-hours-wrap { max-width: 50% !important; min-width: 320px; }
        .mc-hours-grid { display: grid !important; grid-template-columns: 1fr auto 1fr; align-items: center; column-gap: .75rem; }
        @media (max-width: 767.98px) {
          .mc-hours-wrap { max-width: 100% !important; min-width: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    document.querySelectorAll('.vstack.gap-3 > .d-flex.align-items-center.gap-3.gap-sm-5').forEach((row) => {
      const hoursWrap = row.querySelector('.position-relative.d-flex.align-items-center.w-100');
      if (hoursWrap) {
        hoursWrap.classList.add('mc-hours-wrap');
      }

      const hoursGrid = row.querySelector('.collapse > .d-flex');
      if (hoursGrid) {
        hoursGrid.classList.add('mc-hours-grid');
        hoursGrid.querySelectorAll('input.form-control').forEach((input) => {
          const raw = String(input.value || '').trim();
          const normalized = raw.match(/^(\d{1,2}):(\d{2})$/) ? raw : '';
          input.type = 'time';
          if (normalized) input.value = normalized;
          input.step = '300';
        });
      }
    });
  };

  const normalizeTemplateLinks = () => {
    document.querySelectorAll('a[href]').forEach((a) => {
      const href = (a.getAttribute('href') || '').trim();
      const m = href.match(/^add-contractor-([a-z-]+)\.html$/i);
      if (!m) return;
      a.setAttribute('href', withEdit(`/add-contractor-${m[1].toLowerCase()}`));
    });
  };

  const submitListing = async (isDraft) => {
    if (submitInFlight) return;
    submitInFlight = true;
    saveControls();
    const state = readState();
    const controls = state.controls || {};
    const areas = Array.isArray(state.areas) ? state.areas : [];
    const services = Array.isArray(state.services) ? state.services : [];

    const selectedCity =
      (document.querySelector('select[aria-label="City select"] option:checked')?.textContent || '').trim() ||
      String(controls['select:city-select'] || '');

    const selectedState =
      (document.querySelector('select[aria-label="State select"] option:checked')?.value || '').trim() ||
      String(controls.state || '').trim();

    const payload = {
      ...controls,
      state: selectedState,
      'select:city-select': selectedCity,
      address: String(controls.address || document.getElementById('address')?.value || ''),
      zip: String(controls.zip || document.getElementById('zip')?.value || ''),
      'area-search': areas.length ? areas.join(', ') : String(controls['area-search'] || ''),
      description: String(controls.about || controls.description || ''),
      services,
    };

    const csrf = getCsrfToken();
    const encodedPayload = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    const fd = new FormData();
    if (csrf) fd.append('_token', csrf);
    fd.append('payload', encodedPayload);
    if (isDraft) fd.append('draft', '1');
    if (editId) fd.append('listing_id', editId);
    if (selectedProfilePhotoFile) fd.append('profile_photo', selectedProfilePhotoFile);
    selectedGalleryFiles.forEach((row) => {
      if (row?.file) fd.append('photos[]', row.file);
    });

    try {
      const res = await fetch('/submit/contractor', {
        method: 'POST',
        body: fd,
        credentials: 'same-origin',
      });
      if (res.redirected) {
        window.location.href = res.url;
        return;
      }

      // If the session/CSRF token is invalid, Laravel returns 419 HTML. On the final step we can safely
      // fall back to GET submission (no file uploads) to avoid getting stuck on the same page.
      if (res.status === 419 || res.status === 403) {
        const hasFiles = !!selectedProfilePhotoFile || selectedGalleryFiles.some((row) => !!row?.file);
        if (hasFiles) {
          alert('Session expired. Please refresh the page and try again.');
          submitInFlight = false;
          return;
        }
        const qs = new URLSearchParams();
        qs.set('payload', encodedPayload);
        if (isDraft) qs.set('draft', '1');
        if (editId) qs.set('listing_id', editId);
        window.location.href = `/submit/contractor?${qs.toString()}`;
        return;
      }

      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');
      const nextUrl = doc.querySelector('meta[http-equiv="refresh"]')?.getAttribute('content')?.split('url=')[1];
      if (nextUrl) {
        window.location.href = nextUrl;
        return;
      }

      // If the server responded with a non-redirect HTML (validation/CSRF page/etc),
      // prefer a GET redirect fallback when possible so the user isn't stuck reloading.
      const hasFiles = !!selectedProfilePhotoFile || selectedGalleryFiles.some((row) => !!row?.file);
      if (!hasFiles) {
        const qs = new URLSearchParams();
        qs.set('payload', encodedPayload);
        if (isDraft) qs.set('draft', '1');
        if (editId) qs.set('listing_id', editId);
        window.location.href = `/submit/contractor?${qs.toString()}`;
        return;
      }

      window.location.reload();
    } catch (_) {
      const hasFiles = !!selectedProfilePhotoFile || selectedGalleryFiles.some((row) => !!row?.file);
      if (!hasFiles) {
        const qs = new URLSearchParams();
        qs.set('payload', encodedPayload);
        if (isDraft) qs.set('draft', '1');
        if (editId) qs.set('listing_id', editId);
        window.location.href = `/submit/contractor?${qs.toString()}`;
        return;
      }
      submitInFlight = false;
    }
  };

  const bindSaveDraft = () => {
    Array.from(document.querySelectorAll('button.btn.btn-lg.btn-outline-secondary'))
      .filter((btn) => (btn.textContent || '').trim().toLowerCase() === 'save draft')
      .forEach((btn) => {
        if (btn.dataset.mcDraftBound === '1') return;
        btn.dataset.mcDraftBound = '1';
        btn.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopImmediatePropagation();
          submitListing(true);
        }, true);
      });
  };

  const bindPublish = () => {
    Array.from(document.querySelectorAll('a.btn.btn-lg, button.btn.btn-lg, a.nav-link'))
      .filter((btn) => {
        const t = (btn.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        return t.includes('publish listing') || t.includes('save project and become a pro') || t === 'publish';
      })
      .forEach((btn) => {
        if (btn.dataset.mcPublishBound === '1') return;
        btn.dataset.mcPublishBound = '1';
        btn.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopImmediatePropagation();
          const t = (btn.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
          const shouldDraft = t.includes('save project and become a pro');
          submitListing(shouldDraft);
        }, true);
      });
  };

  const loadEditData = async () => {
    if (!editId) return;
    if (currentPath !== '/add-contractor-project') return;
    try {
      const res = await fetch(`/account/contractors/${encodeURIComponent(editId)}/edit-data`, { credentials: 'same-origin' });
      if (!res.ok) return;
      const json = await res.json();
      const data = json?.data || null;
      if (!data || !data.id) return;
      loadedEditData = data;
      existingGalleryUrls = Array.isArray(data.gallery_images) ? data.gallery_images.filter(Boolean) : [];

      // Ensure required location fields persist for final submission (state is required by backend).
      const state = readState();
      const controls = { ...(state.controls || {}) };
      if (data.state && !controls.state) controls.state = String(data.state).trim();
      if (data.city && !controls['select:city-select']) controls['select:city-select'] = String(data.city).trim();
      if (Object.keys(controls).length) writeState({ controls });

      bindProfilePhoto();
      bindProjectGallery();
    } catch (_) {
      // ignore
    }
  };

  const loadProfileImage = async () => {
    if (!editId) return;
    if (currentPath !== '/add-contractor-profile') return;
    try {
      const res = await fetch(`/account/contractors/${encodeURIComponent(editId)}/edit-data`, { credentials: 'same-origin' });
      if (!res.ok) return;
      const json = await res.json();
      const data = json?.data || null;
      if (!data || !data.id) return;
      loadedEditData = data;
      const btn = Array.from(document.querySelectorAll('button, a'))
        .find((el) => (el.textContent || '').trim().toLowerCase() === 'update photo');
      const img = btn?.closest('.d-flex')?.querySelector('img') || document.querySelector('img');
      const savedUrl = String(data.profile_image || data.image || '').trim();
      if (img && savedUrl) img.src = savedUrl;
    } catch (_) {
      // ignore
    }
  };

  const init = () => {
    const safe = (fn) => { try { fn(); } catch (_) {} };

    safe(normalizeTemplateLinks);
    safe(bindTopStepper);
    safe(bindSaveDraft);
    safe(bindPublish);
    safe(bindAreaServices);
    safe(bindProvidedServices);
    safe(restoreControls);
    safe(bindProfilePhoto);
    safe(bindProjectGallery);
    safe(fixWorkingHoursLayout);

    document.querySelectorAll('input, select, textarea').forEach((el) => {
      el.addEventListener('input', saveControls);
      el.addEventListener('change', saveControls);
    });

    loadProfileImage().then(() => {
      safe(bindProfilePhoto);
    });

    loadEditData().then(() => {
      safe(bindProjectGallery);
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
