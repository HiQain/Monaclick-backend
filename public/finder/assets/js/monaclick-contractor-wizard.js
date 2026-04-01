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

  const normalizePath = (value) => String(value || '').replace(/\/+$/, '') || '/';
  const getReferrerPath = () => {
    try {
      if (!document.referrer) return '';
      const refUrl = new URL(document.referrer, window.location.origin);
      if (refUrl.origin !== window.location.origin) return '';
      return normalizePath(refUrl.pathname);
    } catch {
      return '';
    }
  };
  const referrerPath = getReferrerPath();
  const isWizardPath = (path) => !!path && Object.prototype.hasOwnProperty.call(stepMap, normalizePath(path));
  const isFreshNewListingEntry = !editId
    && !isWizardPath(referrerPath);
  if (isFreshNewListingEntry) {
    sessionStorage.removeItem(key);
  }

  const selectedGalleryFiles = [];
  let nextGalleryId = 1;
  let selectedProfilePhotoFile = null;
  let existingGalleryUrls = [];
  let loadedEditData = null;
  let submitInFlight = false;
  let suppressUnsavedPrompt = false;

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

  const readMeta = () => {
    const meta = readState().meta;
    return meta && typeof meta === 'object' ? meta : {};
  };

  const writeMeta = (next) => {
    const current = readMeta();
    writeState({ meta: { ...current, ...next } });
  };

  const hasMeaningfulDraftState = () => {
    const state = readState();
    const controls = state.controls && typeof state.controls === 'object' ? state.controls : {};
    const hasControlValue = Object.entries(controls).some(([, value]) => {
      if (typeof value === 'boolean') return value;
      return String(value ?? '').trim() !== '';
    });

    return hasControlValue
      || (Array.isArray(state.areas) && state.areas.length > 0)
      || (Array.isArray(state.services) && state.services.length > 0)
      || !!selectedProfilePhotoFile
      || selectedGalleryFiles.some((row) => !!row?.file);
  };

  const showUnsavedDraftModal = (exitUrl) => new Promise((resolve) => {
    let modalEl = document.getElementById('mcUnsavedDraftModal');
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.id = 'mcUnsavedDraftModal';
      modalEl.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(15,23,42,.42);backdrop-filter:blur(4px);z-index:99999;align-items:center;justify-content:center;padding:16px;';
      modalEl.innerHTML = `
        <div style="width:min(520px,95vw);background:#fff;border-radius:18px;box-shadow:0 18px 48px rgba(15,23,42,.18);padding:26px 24px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:12px;">
            <h5 style="margin:0;">Save draft?</h5>
            <button type="button" data-unsaved-close aria-label="Close" style="border:0;background:transparent;font-size:28px;line-height:1;cursor:pointer;color:#64748b;">×</button>
          </div>
          <p style="margin:0 0 20px 0;color:#5b6475;">You have an unfinished listing. Save it as a draft before leaving this page?</p>
          <div style="display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;">
            <button type="button" class="btn btn-outline-secondary" data-unsaved-cancel>Cancel</button>
            <button type="button" class="btn btn-primary" data-unsaved-save>Save draft</button>
          </div>
        </div>
      `;
      document.body.appendChild(modalEl);
    }

    const close = () => {
      modalEl.style.display = 'none';
      document.body.classList.remove('modal-open');
    };

    const open = () => {
      modalEl.style.display = 'flex';
      document.body.classList.add('modal-open');
    };

    const cleanup = () => {
      modalEl.querySelector('[data-unsaved-close]')?.removeEventListener('click', onCancel);
      modalEl.querySelector('[data-unsaved-cancel]')?.removeEventListener('click', onCancel);
      modalEl.querySelector('[data-unsaved-save]')?.removeEventListener('click', onSave);
      modalEl.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onEscape);
    };

    const onClose = () => {
      cleanup();
      close();
      resolve('stay');
    };

    const onCancel = () => {
      cleanup();
      close();
      resolve('discard');
    };

    const onSave = () => {
      cleanup();
      close();
      resolve('save');
    };

    const onBackdrop = (event) => {
      if (event.target !== modalEl) return;
      cleanup();
      close();
      resolve('stay');
    };

    const onEscape = (event) => {
      if (event.key !== 'Escape') return;
      cleanup();
      close();
      resolve('stay');
    };

    modalEl.querySelector('[data-unsaved-close]')?.addEventListener('click', onClose);
    modalEl.querySelector('[data-unsaved-cancel]')?.addEventListener('click', onCancel);
    modalEl.querySelector('[data-unsaved-save]')?.addEventListener('click', onSave);
    modalEl.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onEscape);

    modalEl.dataset.exitUrl = exitUrl || '';
    open();
  });

  if (isFreshNewListingEntry) {
    writeMeta({ step2Touched: false, step3Touched: false, step4Touched: false, step5Touched: false });
  }

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
      controls.city = value || String(controls.city || '').trim();
      controls['select:city-value'] = value || String(controls['select:city-value'] || '').trim();
      controls['select:city-select'] = label || value || String(controls['select:city-select'] || '');
    }
    writeState({ controls });
  };

  const findControl = (key) => {
    if (!key) return null;
    return document.getElementById(key) || document.querySelector(`[name="${CSS.escape(key)}"]`);
  };

  const applyControlValue = (el, value) => {
    if (!el) return;
    if (el.type === 'checkbox' || el.type === 'radio') el.checked = !!value;
    else el.value = String(value ?? '');
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const applyLocationControls = ({ retries = 0 } = {}) => {
    const controls = readState().controls || {};
    const stateSelect = document.querySelector('select[aria-label="State select"]');
    const citySelect = document.querySelector('select[aria-label="City select"]');
    const savedState = String(controls.state || '').trim().toUpperCase();
    const savedCityValue = String(controls['select:city-value'] || controls.city || '').trim();
    const savedCityLabel = String(controls['select:city-select'] || '').trim();

    if (stateSelect && savedState) {
      const stateMatch = Array.from(stateSelect.options).find((opt) => String(opt.value || '').trim().toUpperCase() === savedState);
      if (stateMatch && String(stateSelect.value || '').trim().toUpperCase() !== savedState) {
        stateSelect.value = stateMatch.value;
        stateSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    let cityApplied = !savedCityValue && !savedCityLabel;
    if (citySelect && !cityApplied) {
      const cityMatch = Array.from(citySelect.options).find((opt) => {
        const optionValue = String(opt.value || '').trim();
        const optionLabel = String(opt.textContent || '').trim();
        return (savedCityValue && optionValue.toLowerCase() === savedCityValue.toLowerCase())
          || (savedCityLabel && optionLabel.toLowerCase() === savedCityLabel.toLowerCase());
      });

      if (cityMatch) {
        if (citySelect.value !== cityMatch.value) {
          citySelect.value = cityMatch.value;
          citySelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
        cityApplied = true;
      }
    }

    if (!cityApplied && retries > 0) {
      window.setTimeout(() => applyLocationControls({ retries: retries - 1 }), 200);
    }
  };

  const restoreControls = () => {
    const state = readState();
    const controls = state.controls || {};
    Object.entries(controls).forEach(([k, v]) => {
      if (k === 'state' || k === 'city' || k === 'select:city-value' || k === 'select:city-select') return;
      const el = findControl(k);
      if (!el) return;
      applyControlValue(el, v);
    });

    applyLocationControls({ retries: 12 });
  };

  const makeChip = (label) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-sm btn-outline-secondary rounded-pill';
    btn.innerHTML = `<i class="fi-close fs-sm ms-n1 me-1"></i>${label}`;
    return btn;
  };

  const sanitizeServiceAreaValues = (values) => {
    const draftState = readState();
    const controls = draftState.controls && typeof draftState.controls === 'object' ? draftState.controls : {};
    const address = String(controls.address || document.getElementById('address')?.value || '').trim().toLowerCase();
    const zipDigits = String(controls.zip || document.getElementById('zip')?.value || '').replace(/[^\d]/g, '');

    return Array.from(new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || '').trim())
        .filter((value) => {
          if (!value) return false;
          if (address && value.toLowerCase() === address) return false;
          const digits = value.replace(/[^\d]/g, '');
          if (zipDigits && digits && digits === zipDigits) return false;
          return true;
        })
    ));
  };

  const bindAreaServices = () => {
    const input = document.getElementById('area-search');
    const wrap = document.getElementById('selected-service-areas') || Array.from(document.querySelectorAll('div.d-flex.flex-wrap.gap-2'))
      .find((el) => el.querySelector('button.btn.btn-sm.btn-outline-secondary'));
    if (!input || !wrap) return;
    input.type = 'text';

    const getAreas = () => sanitizeServiceAreaValues(Array.from(wrap.querySelectorAll('button.btn.btn-sm.btn-outline-secondary'))
      .map((btn) => (btn.textContent || '').replace(/\s+/g, ' ').trim().replace(/^x\s*/i, ''))
      .filter(Boolean));

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

    const saved = sanitizeServiceAreaValues(readState().areas);
    if (Array.isArray(saved) && saved.length) {
      wrap.innerHTML = '';
      saved.forEach((a) => wrap.appendChild(makeChip(a)));
      saveAreas();
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

    const save = (markTouched = false) => {
      const services = rows
        .filter((row) => row.cb.checked)
        .map((row) => row.text);
      writeState({ services });
      if (markTouched) writeMeta({ step2Touched: true });
    };

    if (container.dataset.mcServicesBound !== '1') {
      container.dataset.mcServicesBound = '1';
      container.addEventListener('change', (event) => {
        const target = event.target;
        if (!target || target.tagName !== 'INPUT') return;
        if (target.type !== 'checkbox') return;
        save(true);
      }, true);
      save(false);
    }

    const saved = readState().services;
    if (Array.isArray(saved) && saved.length) {
      const set = new Set(saved.map((s) => String(s).toLowerCase()));
      rows.forEach((row) => {
        row.cb.checked = set.has(row.text.toLowerCase());
      });
    }
  };

  const clearStaleStep2Draft = () => {
    if (editId) return;
    if (currentPath !== '/add-contractor-services') return;
    if (readMeta().step2Touched) return;

    const state = readState();
    const controls = { ...(state.controls || {}) };
    const step2Keys = new Set(['project-type']);
    document.querySelectorAll('input, select, textarea').forEach((el) => {
      const key = el.id || el.name;
      if (key) step2Keys.add(key);
    });
    step2Keys.forEach((key) => {
      delete controls[key];
    });

    writeState({ controls, services: [] });
  };

  const resetStep2Ui = () => {
    if (editId) return;
    if (currentPath !== '/add-contractor-services') return;
    if (readMeta().step2Touched) return;

    const categorySelect = findControl('project-type');
    if (categorySelect) {
      categorySelect.value = '';
      categorySelect.dispatchEvent(new Event('change', { bubbles: true }));
      categorySelect.dispatchEvent(new Event('input', { bubbles: true }));
    }

    document.querySelectorAll('input[type="checkbox"]').forEach((el) => {
      if (!el.checked) return;
      el.checked = false;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };

  const bindStep2CategoryTracking = () => {
    if (currentPath !== '/add-contractor-services') return;
    const categorySelect = findControl('project-type');
    if (!categorySelect || categorySelect.dataset.mcStep2CategoryBound === '1') return;
    categorySelect.dataset.mcStep2CategoryBound = '1';
    const markTouched = () => writeMeta({ step2Touched: true });
    categorySelect.addEventListener('change', markTouched);
    categorySelect.addEventListener('input', markTouched);
  };

  const clearStaleStep3Draft = () => {
    if (editId) return;
    if (currentPath !== '/add-contractor-profile') return;
    if (readMeta().step3Touched) return;

    const state = readState();
    const controls = { ...(state.controls || {}) };
    ['about', 'website'].forEach((key) => {
      delete controls[key];
    });

    writeState({ controls });
  };

  const resetStep3Ui = () => {
    if (editId) return;
    if (currentPath !== '/add-contractor-profile') return;
    if (readMeta().step3Touched) return;

    ['about', 'website'].forEach((key) => {
      const el = findControl(key);
      if (!el) return;
      el.value = '';
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };

  const bindStep3Tracking = () => {
    if (currentPath !== '/add-contractor-profile') return;
    ['about', 'website'].forEach((key) => {
      const el = findControl(key);
      if (!el || el.dataset.mcStep3Bound === '1') return;
      el.dataset.mcStep3Bound = '1';
      const markTouched = () => writeMeta({ step3Touched: true });
      el.addEventListener('change', markTouched);
      el.addEventListener('input', markTouched);
    });
  };

  const clearStaleStep4Draft = () => {
    if (editId) return;
    if (currentPath !== '/add-contractor-price-hours') return;
    if (readMeta().step4Touched) return;

    const state = readState();
    const controls = { ...(state.controls || {}) };
    const step4Keys = new Set(['price']);
    document.querySelectorAll('input, select, textarea').forEach((el) => {
      const key = el.id || el.name;
      if (key) step4Keys.add(key);
    });
    step4Keys.forEach((key) => {
      delete controls[key];
    });

    writeState({ controls });
  };

  const resetStep4Ui = () => {
    if (editId) return;
    if (currentPath !== '/add-contractor-price-hours') return;
    if (readMeta().step4Touched) return;

    const priceInput = findControl('price');
    if (priceInput) {
      priceInput.value = '';
      priceInput.dispatchEvent(new Event('change', { bubbles: true }));
      priceInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    const periodSelect = document.querySelector('select[aria-label="Select per period"]');
    if (periodSelect) {
      periodSelect.value = '';
      periodSelect.dispatchEvent(new Event('change', { bubbles: true }));
      periodSelect.dispatchEvent(new Event('input', { bubbles: true }));
    }

    document.querySelectorAll('.vstack.gap-3 > .d-flex.align-items-center.gap-3.gap-sm-5').forEach((row) => {
      const checkbox = row.querySelector('input.form-check-input[type="checkbox"]');
      if (checkbox) {
        checkbox.checked = false;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      }
      row.querySelectorAll('.collapse input.form-control, .collapse select.form-select').forEach((input) => {
        input.value = '';
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
  };

  const bindStep4Tracking = () => {
    if (currentPath !== '/add-contractor-price-hours') return;
    const markTouched = () => writeMeta({ step4Touched: true });

    const priceInput = findControl('price');
    if (priceInput && priceInput.dataset.mcStep4Bound !== '1') {
      priceInput.dataset.mcStep4Bound = '1';
      priceInput.addEventListener('change', markTouched);
      priceInput.addEventListener('input', markTouched);
    }

    const periodSelect = document.querySelector('select[aria-label="Select per period"]');
    if (periodSelect && periodSelect.dataset.mcStep4Bound !== '1') {
      periodSelect.dataset.mcStep4Bound = '1';
      periodSelect.addEventListener('change', markTouched);
      periodSelect.addEventListener('input', markTouched);
    }

    document.querySelectorAll('.vstack.gap-3 > .d-flex.align-items-center.gap-3.gap-sm-5').forEach((row) => {
      row.querySelectorAll('input, select').forEach((input) => {
        if (input.dataset.mcStep4Bound === '1') return;
        input.dataset.mcStep4Bound = '1';
        input.addEventListener('change', markTouched);
        input.addEventListener('input', markTouched);
      });
    });
  };

  const clearStaleStep5Draft = () => {
    if (editId) return;
    if (currentPath !== '/add-contractor-project') return;
    if (readMeta().step5Touched) return;

    const state = readState();
    const controls = { ...(state.controls || {}) };
    ['project-name', 'project-description', 'price', 'link'].forEach((key) => {
      delete controls[key];
    });

    writeState({ controls });
  };

  const resetStep5Ui = () => {
    if (editId) return;
    if (currentPath !== '/add-contractor-project') return;
    if (readMeta().step5Touched) return;

    ['project-name', 'project-description', 'price', 'link'].forEach((key) => {
      const el = findControl(key);
      if (!el) return;
      el.value = '';
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const periodSelect = document.querySelector('select[aria-label="Select per period"]');
    if (periodSelect) {
      periodSelect.value = '';
      periodSelect.dispatchEvent(new Event('change', { bubbles: true }));
      periodSelect.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };

  const bindStep5Tracking = () => {
    if (currentPath !== '/add-contractor-project') return;
    const markTouched = () => writeMeta({ step5Touched: true });

    ['project-name', 'project-description', 'price', 'link'].forEach((key) => {
      const el = findControl(key);
      if (!el || el.dataset.mcStep5Bound === '1') return;
      el.dataset.mcStep5Bound = '1';
      el.addEventListener('change', markTouched);
      el.addEventListener('input', markTouched);
    });

    const periodSelect = document.querySelector('select[aria-label="Select per period"]');
    if (periodSelect && periodSelect.dataset.mcStep5Bound !== '1') {
      periodSelect.dataset.mcStep5Bound = '1';
      periodSelect.addEventListener('change', markTouched);
      periodSelect.addEventListener('input', markTouched);
    }
  };

  const bindProfilePhoto = () => {
    const btn = Array.from(document.querySelectorAll('button, a'))
      .find((el) => (el.textContent || '').trim().toLowerCase() === 'update photo');
    if (!btn) return;

    const img = btn.closest('.d-flex')?.querySelector('img') || document.querySelector('img');
    if (!img) return;
    const placeholderSrc = '/finder/assets/img/placeholders/preview-square.svg';
    const removeBtn = btn.closest('.d-flex')?.querySelector('button[aria-label="Remove"]');

    if (btn.dataset.mcProfileBound === '1') return;
    btn.dataset.mcProfileBound = '1';

    let fileInput = document.querySelector('input[data-mc-avatar-picker="1"]');
    if (!(fileInput instanceof HTMLInputElement)) {
      fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.className = 'visually-hidden';
      fileInput.dataset.mcAvatarPicker = '1';
      document.body.appendChild(fileInput);
    }

    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      fileInput.click();
    }, true);

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

    const applyPreview = (file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '').trim();
        if (!result) return;
        img.removeAttribute('srcset');
        img.src = result;
      };
      reader.readAsDataURL(file);
    };

    if (fileInput.dataset.mcAvatarChangeBound !== '1') {
      fileInput.dataset.mcAvatarChangeBound = '1';
      fileInput.addEventListener('change', () => {
        const f = fileInput.files && fileInput.files[0];
        if (!f) return;
        selectedProfilePhotoFile = f;
        writeMeta({ step3Touched: true });
        applyPreview(f);
        fileInput.value = '';
        uploadProfilePhoto(f)
          .then((remoteUrl) => {
            if (!remoteUrl) return;
            img.removeAttribute('srcset');
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
    }

    btn.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      fileInput.click();
    });

    if (img.closest('.ratio') && img.closest('.ratio').dataset.mcAvatarTapBound !== '1') {
      img.closest('.ratio').dataset.mcAvatarTapBound = '1';
      img.closest('.ratio').addEventListener('click', () => {
        if (editId) return;
        fileInput.click();
      });
    }

    fileInput.addEventListener('cancel', () => {
      fileInput.value = '';
    });

    if (removeBtn && removeBtn.dataset.mcProfileRemoveBound !== '1') {
      removeBtn.dataset.mcProfileRemoveBound = '1';
      removeBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        selectedProfilePhotoFile = null;
        img.removeAttribute('srcset');
        img.src = placeholderSrc;
        fileInput.value = '';
        if (!editId && !readMeta().step3Touched) {
          writeMeta({ step3Touched: false });
        }
      }, true);
    }
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
      if (link.tagName === 'A') {
        link.setAttribute('href', withEdit(step[1]));
        link.dataset.mcIgnoreLeavePrompt = '1';
        if (link.dataset.mcWizardNavBound !== '1') {
          link.dataset.mcWizardNavBound = '1';
          link.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            suppressUnsavedPrompt = true;
            saveControls();
            window.location.href = withEdit(step[1]);
          }, true);
        }
      }
      else {
        link.style.cursor = 'pointer';
        if (link.dataset.mcWizardNavBound !== '1') {
          link.dataset.mcWizardNavBound = '1';
          link.addEventListener('click', () => {
            suppressUnsavedPrompt = true;
            saveControls();
            window.location.href = withEdit(step[1]);
          });
        }
      }
    });
  };

  const fixWorkingHoursLayout = () => {
    if (currentPath !== '/add-contractor-price-hours') return;

    if (!document.getElementById('mc-hours-layout-style')) {
      const style = document.createElement('style');
      style.id = 'mc-hours-layout-style';
      style.textContent = `
        .mc-hours-wrap { max-width: 100% !important; min-width: 320px; }
        .mc-hours-grid { display: grid !important; grid-template-columns: minmax(170px, 1fr) auto minmax(170px, 1fr); align-items: center; column-gap: .75rem; }
        .mc-hours-select { min-height: 48px; border-radius: 14px; padding-inline: 1rem 2.5rem; }
        .mc-hours-divider { font-size: .95rem; color: var(--fn-secondary-color); text-align: center; min-width: 1.5rem; }
        .mc-hours-row .mc-hours-closed { display: block; }
        .mc-hours-row.is-open .mc-hours-closed { display: none; }
        .mc-hours-row:not(.is-open) .collapse { display: none !important; }
        .mc-hours-row.is-open .collapse { display: block !important; }
        @media (max-width: 767.98px) {
          .mc-hours-wrap { max-width: 100% !important; min-width: 0; }
          .mc-hours-grid { grid-template-columns: 1fr; row-gap: .5rem; }
          .mc-hours-divider { justify-self: start; }
        }
      `;
      document.head.appendChild(style);
    }

    const buildTimeLabel = (value) => {
      const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
      if (!match) return value;
      let hour = Number(match[1]);
      const minute = match[2];
      const suffix = hour >= 12 ? 'PM' : 'AM';
      hour = hour % 12;
      if (hour === 0) hour = 12;
      return `${String(hour).padStart(2, '0')}:${minute} ${suffix}`;
    };

    const ensureTimeSelect = (input, id) => {
      if (!input || !id) return null;

      if (input.tagName === 'SELECT') {
        input.id = id;
        input.name = id;
        input.classList.add('mc-hours-select');
        return input;
      }

      const select = document.createElement('select');
      select.className = 'form-select mc-hours-select';
      select.id = id;
      select.name = id;
      select.setAttribute('aria-label', id);

      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Select time';
      select.appendChild(placeholder);

      for (let hour = 0; hour < 24; hour += 1) {
        for (let minute = 0; minute < 60; minute += 30) {
          const value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
          const option = document.createElement('option');
          option.value = value;
          option.textContent = buildTimeLabel(value);
          select.appendChild(option);
        }
      }

      const raw = String(input.value || '').trim();
      const normalized = raw.match(/^(\d{1,2}):(\d{2})$/)
        ? `${String(Number(raw.split(':')[0])).padStart(2, '0')}:${raw.split(':')[1]}`
        : '';
      select.value = normalized;
      input.replaceWith(select);
      return select;
    };

    document.querySelectorAll('.vstack.gap-3 > .d-flex.align-items-center.gap-3.gap-sm-5').forEach((row) => {
      row.classList.add('mc-hours-row');
      const toggleWrap = row.querySelector('.form-check.form-switch');
      const checkbox = row.querySelector('input.form-check-input[type="checkbox"]');
      const hoursWrap = row.querySelector('.position-relative.d-flex.align-items-center.w-100');
      const collapse = row.querySelector('.collapse');
      const closedText = Array.from(row.querySelectorAll('.fs-sm')).find((el) => (el.textContent || '').trim().toLowerCase() === 'closed');

      if (hoursWrap) {
        hoursWrap.classList.add('mc-hours-wrap');
      }

      const hoursGrid = row.querySelector('.collapse > .d-flex');
      if (hoursGrid) {
        hoursGrid.classList.add('mc-hours-grid');
        const rawInputs = Array.from(hoursGrid.querySelectorAll('input.form-control, select.form-select'));
        rawInputs.forEach((input, index) => {
          const dayKey = String(checkbox?.id || '').trim();
          if (!dayKey) return;
          ensureTimeSelect(input, index === 0 ? `${dayKey}From` : `${dayKey}To`);
        });
        const divider = Array.from(hoursGrid.children).find((el) => (el.textContent || '').trim().toLowerCase() === 'to');
        if (divider) divider.classList.add('mc-hours-divider');
      }

      if (toggleWrap) {
        toggleWrap.removeAttribute('data-bs-toggle');
        toggleWrap.removeAttribute('data-bs-target');
      }

      const timeInputs = Array.from(row.querySelectorAll('.collapse select.form-select, .collapse input.form-control'));

      const syncRow = () => {
        const isOpen = !!checkbox?.checked;
        row.classList.toggle('is-open', isOpen);
        if (collapse) {
          collapse.classList.toggle('show', isOpen);
          collapse.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
        }
        if (closedText) closedText.style.display = isOpen ? 'none' : '';
        timeInputs.forEach((input) => {
          input.disabled = !isOpen;
        });
      };

      if (checkbox && checkbox.dataset.mcHoursBound !== '1') {
        checkbox.dataset.mcHoursBound = '1';
        checkbox.addEventListener('change', syncRow);
      }

      syncRow();
    });
  };

  const normalizeTemplateLinks = () => {
    document.querySelectorAll('a[href]').forEach((a) => {
      const href = (a.getAttribute('href') || '').trim();
      const m = href.match(/^add-contractor-([a-z-]+)\.html$/i);
      if (!m) return;
      const targetUrl = withEdit(`/add-contractor-${m[1].toLowerCase()}`);
      a.setAttribute('href', targetUrl);
      a.dataset.mcIgnoreLeavePrompt = '1';
      if (a.dataset.mcWizardNavBound === '1') return;
      a.dataset.mcWizardNavBound = '1';
      a.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        suppressUnsavedPrompt = true;
        saveControls();
        window.location.href = targetUrl;
      }, true);
    });
  };

  const submitListing = async (isDraft, options = {}) => {
    if (submitInFlight) return;
    submitInFlight = true;
    const nextPath = String(options.nextPath || '').trim();
    const exitUrl = String(options.exitUrl || '').trim();
    suppressUnsavedPrompt = true;
    saveControls();
    const state = readState();
    const controls = state.controls || {};
    const areas = sanitizeServiceAreaValues(Array.isArray(state.areas) ? state.areas : []);
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
      'area-search': areas.length
        ? areas.join(', ')
        : sanitizeServiceAreaValues(String(controls['area-search'] || '').split(',')).join(', '),
      description: String(controls.about || controls.description || ''),
      services,
    };

    const csrf = getCsrfToken();
    const encodedPayload = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    const fd = new FormData();
    if (csrf) fd.append('_token', csrf);
    fd.append('payload', encodedPayload);
    if (isDraft) fd.append('draft', '1');
    if (nextPath) fd.append('next', nextPath);
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
        window.location.href = exitUrl || res.url;
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
        if (nextPath) qs.set('next', nextPath);
        if (editId) qs.set('listing_id', editId);
        window.location.href = `/submit/contractor?${qs.toString()}`;
        return;
      }

      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');
      const nextUrl = doc.querySelector('meta[http-equiv="refresh"]')?.getAttribute('content')?.split('url=')[1];
      if (nextUrl) {
        window.location.href = exitUrl || nextUrl;
        return;
      }

      // If the server responded with a non-redirect HTML (validation/CSRF page/etc),
      // prefer a GET redirect fallback when possible so the user isn't stuck reloading.
      const hasFiles = !!selectedProfilePhotoFile || selectedGalleryFiles.some((row) => !!row?.file);
      if (!hasFiles) {
        const qs = new URLSearchParams();
        qs.set('payload', encodedPayload);
        if (isDraft) qs.set('draft', '1');
        if (nextPath) qs.set('next', nextPath);
        if (editId) qs.set('listing_id', editId);
        window.location.href = `/submit/contractor?${qs.toString()}`;
        return;
      }

      window.location.href = exitUrl || window.location.href;
    } catch (_) {
      const hasFiles = !!selectedProfilePhotoFile || selectedGalleryFiles.some((row) => !!row?.file);
      if (!hasFiles) {
        const qs = new URLSearchParams();
        qs.set('payload', encodedPayload);
        if (isDraft) qs.set('draft', '1');
        if (nextPath) qs.set('next', nextPath);
        if (editId) qs.set('listing_id', editId);
        window.location.href = `/submit/contractor?${qs.toString()}`;
        return;
      }
      submitInFlight = false;
      suppressUnsavedPrompt = false;
    }
  };

  const bindUnsavedExitPrompt = () => {
    window.addEventListener('beforeunload', (event) => {
      if (suppressUnsavedPrompt || !hasMeaningfulDraftState()) return;
      event.preventDefault();
      event.returnValue = '';
    });

    document.addEventListener('click', (event) => {
      const link = event.target && event.target.closest('a[href]');
      if (!link) return;

      const href = String(link.getAttribute('href') || '').trim();
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

      let url;
      try {
        url = new URL(href, window.location.origin);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;
      const targetPath = normalizePath(url.pathname);
      if (!isWizardPath(targetPath)) return;

      suppressUnsavedPrompt = true;
      saveControls();
    }, true);

    document.addEventListener('click', async (event) => {
      const link = event.target && event.target.closest('a[href]');
      if (!link) return;
      if (link.dataset.mcIgnoreLeavePrompt === '1') return;
      if (event.defaultPrevented) return;

      const href = String(link.getAttribute('href') || '').trim();
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

      let url;
      try {
        url = new URL(href, window.location.origin);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;
      const targetPath = normalizePath(url.pathname);
      if (isWizardPath(targetPath)) return;
      if (suppressUnsavedPrompt || !hasMeaningfulDraftState()) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      if (typeof window.__MC_HIDE_PAGE_LOADER__ === 'function') {
        window.__MC_HIDE_PAGE_LOADER__();
      }

      const choice = await showUnsavedDraftModal(url.toString());
      if (choice === 'save') {
        submitListing(true, { exitUrl: url.toString() });
        return;
      }
      if (choice === 'discard') {
        suppressUnsavedPrompt = true;
        window.location.href = url.toString();
        return;
      }

      suppressUnsavedPrompt = false;
    }, true);
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
    const promotionUrl = new URL('/add-contractor-promotion', window.location.origin);

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
          const text = (btn.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
          if (text.includes('save project and become a pro')) {
            submitListing(true, { nextPath: `${promotionUrl.pathname}${promotionUrl.search}` });
            return;
          }
          submitListing(false);
        }, true);
      });
  };

  const loadHoursEditData = async () => {
    if (!editId) return;
    if (currentPath !== '/add-contractor-price-hours') return;
    try {
      const res = await fetch(`/account/contractors/${encodeURIComponent(editId)}/edit-data`, { credentials: 'same-origin' });
      if (!res.ok) return;
      const json = await res.json();
      const data = json?.data || null;
      if (!data || !data.id) return;

      const hours = data.business_hours && typeof data.business_hours === 'object' ? data.business_hours : {};
      Object.entries(hours).forEach(([day, row]) => {
        const key = String(day || '').trim().toLowerCase();
        if (!key) return;

        const checkbox = document.getElementById(key);
        const fromInput = document.getElementById(`${key}From`);
        const toInput = document.getElementById(`${key}To`);

        if (row && typeof row === 'object') {
          if (checkbox) checkbox.checked = !!row.enabled;
          if (fromInput) fromInput.value = String(row.from || '');
          if (toInput) toInput.value = String(row.to || '');
        } else if (checkbox) {
          checkbox.checked = !!row;
        }

        checkbox?.dispatchEvent(new Event('change', { bubbles: true }));
        fromInput?.dispatchEvent(new Event('input', { bubbles: true }));
        toInput?.dispatchEvent(new Event('input', { bubbles: true }));
      });

      saveControls();
    } catch (_) {
      // ignore
    }
  };

  const loadLocationEditData = async () => {
    if (!editId) return;
    if (currentPath !== '/add-contractor' && currentPath !== '/add-contractor-location') return;
    try {
      const res = await fetch(`/account/contractors/${encodeURIComponent(editId)}/edit-data`, { credentials: 'same-origin' });
      if (!res.ok) return;
      const json = await res.json();
      const data = json?.data || null;
      if (!data || !data.id) return;

      const state = readState();
      const controls = { ...(state.controls || {}) };

      if (data.state && !String(controls.state || '').trim()) {
        controls.state = String(data.state).trim();
      }
      if (data.city && !String(controls['select:city-select'] || '').trim()) {
        controls['select:city-select'] = String(data.city).trim();
      }
      if (data.address && !String(controls.address || '').trim()) {
        controls.address = String(data.address).trim();
      }
      if (data.zip && !String(controls.zip || '').trim()) {
        controls.zip = String(data.zip).trim();
      }

      writeState({
        controls,
        areas: sanitizeServiceAreaValues(
          String(data.service_area || '')
            .split(',')
            .map((value) => String(value || '').trim())
            .filter(Boolean)
        ),
      });

      restoreControls();
      bindAreaServices();
      saveControls();
    } catch (_) {
      // ignore
    }
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

  const loadServicesEditData = async () => {
    if (!editId) return;
    if (currentPath !== '/add-contractor-services') return;
    try {
      const res = await fetch(`/account/contractors/${encodeURIComponent(editId)}/edit-data`, { credentials: 'same-origin' });
      if (!res.ok) return;
      const json = await res.json();
      const data = json?.data || null;
      if (!data || !data.id) return;

      const state = readState();
      const controls = { ...(state.controls || {}) };
      if (data.category && !String(controls['project-type'] || '').trim()) {
        controls['project-type'] = String(data.category).trim();
      }
      if (Object.keys(controls).length) {
        writeState({ controls });
      }
      if (Array.isArray(data.services) && data.services.length) {
        writeState({ services: data.services.map((value) => String(value || '').trim()).filter(Boolean) });
      }

      restoreControls();
      bindProvidedServices();
    } catch (_) {
      // ignore
    }
  };

  const init = () => {
    const safe = (fn) => { try { fn(); } catch (_) {} };

    safe(clearStaleStep2Draft);
    safe(resetStep2Ui);
    safe(clearStaleStep3Draft);
    safe(resetStep3Ui);
    safe(clearStaleStep4Draft);
    safe(resetStep4Ui);
    safe(clearStaleStep5Draft);
    safe(resetStep5Ui);
    safe(normalizeTemplateLinks);
    safe(bindTopStepper);
    safe(bindSaveDraft);
    safe(bindPublish);
    safe(bindUnsavedExitPrompt);
    safe(bindAreaServices);
    safe(bindProvidedServices);
    safe(bindStep2CategoryTracking);
    safe(bindStep3Tracking);
    safe(bindStep4Tracking);
    safe(bindStep5Tracking);
    safe(restoreControls);
    safe(resetStep5Ui);
    safe(bindProfilePhoto);
    safe(bindProjectGallery);
    safe(fixWorkingHoursLayout);

    document.querySelectorAll('input, select, textarea').forEach((el) => {
      el.addEventListener('input', saveControls);
      el.addEventListener('change', saveControls);
    });

    loadProfileImage().then(() => {
      safe(resetStep3Ui);
      safe(bindProfilePhoto);
      safe(bindStep3Tracking);
    });

    loadEditData().then(() => {
      safe(resetStep5Ui);
      safe(bindProjectGallery);
      safe(bindStep5Tracking);
    });

    loadServicesEditData().then(() => {
      safe(restoreControls);
      safe(bindProvidedServices);
      safe(bindStep2CategoryTracking);
    });

    loadLocationEditData().then(() => {
      safe(restoreControls);
      safe(bindAreaServices);
    });

    loadHoursEditData().then(() => {
      safe(fixWorkingHoursLayout);
      safe(bindStep4Tracking);
    });

    window.addEventListener('pageshow', () => {
      safe(resetStep2Ui);
      safe(resetStep3Ui);
      safe(resetStep4Ui);
      safe(restoreControls);
      safe(resetStep5Ui);
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
