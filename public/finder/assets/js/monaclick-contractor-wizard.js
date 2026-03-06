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

  const saveControls = () => {
    const controls = {};
    document.querySelectorAll('input, select, textarea').forEach((el) => {
      const k = el.id || el.name;
      if (!k) return;
      if (el.type === 'checkbox' || el.type === 'radio') controls[k] = !!el.checked;
      else controls[k] = el.value;
    });
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
    const wrap = Array.from(document.querySelectorAll('div.d-flex.flex-wrap.gap-2'))
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

    // Restore saved areas once.
    const saved = readState().areas;
    if (Array.isArray(saved) && saved.length) {
      wrap.innerHTML = '';
      saved.forEach((a) => wrap.appendChild(makeChip(a)));
    }
  };

  const bindProjectGallery = () => {
    const grid = document.querySelector('.row.row-cols-2.row-cols-sm-3.g-2.g-md-3') ||
      Array.from(document.querySelectorAll('.row')).find((row) =>
        (row.textContent || '').toLowerCase().includes('upload photos / videos')
      );
    if (!grid) return;

    const uploadCol = Array.from(grid.querySelectorAll('.col')).find((col) => {
      const t = (col.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      return t.includes('upload photos / videos');
    });
    if (!uploadCol) return;
    const uploadLabel = Array.from(uploadCol.querySelectorAll('*'))
      .find((el) => (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase() === 'upload photos / videos');

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.accept = 'image/*,video/*';
    fileInput.className = 'd-none';
    uploadCol.appendChild(fileInput);
    uploadCol.style.cursor = 'pointer';

    const openPicker = (event) => {
      if (event.target && event.target.closest('button[aria-label="Remove"]')) return;
      event.preventDefault();
      fileInput.click();
    };
    uploadCol.addEventListener('click', openPicker);
    if (uploadLabel) uploadLabel.addEventListener('click', openPicker);
    const uploadCenter = uploadLabel ? uploadLabel.closest('.text-center') : null;
    if (uploadCenter && uploadCenter !== uploadLabel) uploadCenter.addEventListener('click', openPicker);

    fileInput.addEventListener('change', () => {
      const files = Array.from(fileInput.files || []);
      files.forEach((file) => {
        const src = URL.createObjectURL(file);
        const col = document.createElement('div');
        col.className = 'col';
        col.innerHTML = `
          <div class="hover-effect-opacity position-relative overflow-hidden rounded">
            <div class="ratio" style="--fn-aspect-ratio: calc(180 / 268 * 100%)">
              ${file.type.startsWith('video/')
                ? `<video src="${src}" class="w-100 h-100 object-fit-cover" muted controls></video>`
                : `<img src="${src}" alt="Uploaded image" class="w-100 h-100 object-fit-cover">`}
            </div>
            <div class="hover-effect-target position-absolute top-0 start-0 d-flex align-items-center justify-content-center w-100 h-100 opacity-0">
              <button type="button" class="btn btn-icon btn-sm btn-light position-relative z-2" aria-label="Remove"><i class="fi-trash fs-base"></i></button>
              <span class="position-absolute top-0 start-0 w-100 h-100 bg-black bg-opacity-25 z-1"></span>
            </div>
          </div>
        `;
        grid.insertBefore(col, uploadCol);
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
      col.remove();
    }, true);
  };

  const bindProfilePhoto = () => {
    const btn = Array.from(document.querySelectorAll('button, a'))
      .find((el) => (el.textContent || '').trim().toLowerCase() === 'update photo');
    if (!btn) return;
    const img = btn.closest('.d-flex')?.querySelector('img') || document.querySelector('img');
    if (!img) return;
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.className = 'd-none';
    document.body.appendChild(fileInput);
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      fileInput.click();
    });
    fileInput.addEventListener('change', () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      img.src = URL.createObjectURL(f);
    });
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

  const normalizeTemplateLinks = () => {
    document.querySelectorAll('a[href]').forEach((a) => {
      const href = (a.getAttribute('href') || '').trim();
      const m = href.match(/^add-contractor-([a-z-]+)\.html$/i);
      if (!m) return;
      a.setAttribute('href', withEdit(`/add-contractor-${m[1].toLowerCase()}`));
    });
  };

  const submitListing = (isDraft) => {
      saveControls();
      const state = readState();
      const controls = state.controls || {};
      const areas = Array.isArray(state.areas) ? state.areas : [];

      const selectedCity =
        (document.querySelector('select[aria-label="City select"] option:checked')?.textContent || '').trim() ||
        String(controls['select:city-select'] || '');
      const address = String(controls.address || document.getElementById('address')?.value || '');
      const zip = String(controls.zip || document.getElementById('zip')?.value || '');
      const areaSearch = areas.length ? areas.join(', ') : String(controls['area-search'] || '');

      const payload = {
        'select:city-select': selectedCity,
        'address': address,
        'zip': zip,
        'area-search': areaSearch,
        'project-name': String(controls['project-name'] || ''),
        'project-description': String(controls['project-description'] || ''),
        'price': String(controls.price || '')
      };

      const form = document.createElement('form');
      form.method = 'get';
      form.action = '/submit/contractor';
      form.innerHTML = `
        <input type="hidden" name="payload" value="${btoa(unescape(encodeURIComponent(JSON.stringify(payload))))}">
        ${isDraft ? '<input type="hidden" name="draft" value="1">' : ''}
        ${editId ? `<input type="hidden" name="listing_id" value="${editId}">` : ''}
      `;
      document.body.appendChild(form);
      form.submit();
  };

  const bindSaveDraft = () => {
    Array.from(document.querySelectorAll('button.btn.btn-lg.btn-outline-secondary'))
      .filter((btn) => (btn.textContent || '').trim().toLowerCase() === 'save draft')
      .forEach((btn) => {
        btn.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopImmediatePropagation();
          submitListing(true);
        }, true);
      });
  };

  const bindPublish = () => {
    Array.from(document.querySelectorAll('a.btn.btn-lg, button.btn.btn-lg'))
      .filter((btn) => {
        const t = (btn.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        return t.includes('publish') || t.includes('save project and become a pro');
      })
      .forEach((btn) => {
        btn.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopImmediatePropagation();
          submitListing(false);
        }, true);
      });
  };

  const init = () => {
    const safe = (fn) => { try { fn(); } catch (_) {} };
    safe(normalizeTemplateLinks);
    safe(bindTopStepper);
    safe(bindSaveDraft);
    safe(bindPublish);
    safe(bindProfilePhoto);
    safe(bindProjectGallery);
    safe(bindAreaServices);
    safe(restoreControls);

    document.querySelectorAll('input, select, textarea').forEach((el) => {
      el.addEventListener('input', saveControls);
      el.addEventListener('change', saveControls);
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
