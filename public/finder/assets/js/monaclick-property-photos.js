(() => {
  const withEdit = (url) => {
    const params = new URLSearchParams(window.location.search);
    const edit = (params.get('edit') || '').trim();
    return edit ? `${url}?edit=${encodeURIComponent(edit)}` : url;
  };

  const enablePropertySidebarNavigation = () => {
    const map = [
      ['property type', '/add-property'],
      ['location', '/add-property-location'],
      ['photos and videos', '/add-property-photos'],
      ['property details', '/add-property-details'],
      ['price', '/add-property-price'],
      ['contact info', '/add-property-contact-info'],
      ['ad promotion', '/add-property-promotion']
    ];

    const links = document.querySelectorAll('.col-lg-3 .nav.flex-lg-column .nav-link');
    links.forEach((link) => {
      const text = (link.textContent || '').trim().toLowerCase();
      const row = map.find(([key]) => text.includes(key));
      if (!row) return;
      link.classList.remove('disabled', 'pe-none');
      link.removeAttribute('aria-disabled');
      link.setAttribute('href', withEdit(row[1]));
    });
  };

  const normalizeNextButtonHref = () => {
    document.querySelectorAll('a.btn.btn-lg.btn-dark[href]').forEach((btn) => {
      const href = (btn.getAttribute('href') || '').trim();
      const match = href.match(/^add-property-([a-z-]+)\.html$/i);
      if (!match) return;
      btn.setAttribute('href', withEdit(`/add-property-${match[1].toLowerCase()}`));
    });
  };

  const initUploadDelete = () => {
    const uploadLabel = Array.from(document.querySelectorAll('.hover-effect-underline'))
      .find((el) => (el.textContent || '').trim().toLowerCase() === 'upload photos / videos');
    const uploadCol = uploadLabel ? uploadLabel.closest('.col') : null;
    const grid = uploadCol ? uploadCol.closest('.row') : null;
    if (!grid || !uploadCol) return;

    uploadCol.style.cursor = 'pointer';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*,video/*';
    fileInput.multiple = true;
    fileInput.className = 'd-none';
    uploadCol.appendChild(fileInput);

    uploadCol.addEventListener('click', (event) => {
      if (event.target && event.target.closest('button[aria-label="Remove"]')) return;
      fileInput.click();
    });

    const createItem = (url, isVideo) => {
      const col = document.createElement('div');
      col.className = 'col';
      col.innerHTML = `
        <div class="hover-effect-opacity position-relative overflow-hidden rounded">
          <div class="ratio" style="--fn-aspect-ratio: calc(180 / 268 * 100%)">
            ${isVideo
              ? `<video src="${url}" class="w-100 h-100 object-fit-cover" muted controls></video>`
              : `<img src="${url}" alt="Uploaded image" class="w-100 h-100 object-fit-cover">`}
          </div>
          <div class="hover-effect-target position-absolute top-0 start-0 d-flex align-items-center justify-content-center w-100 h-100 opacity-0">
            <button type="button" class="btn btn-icon btn-sm btn-light position-relative z-2" aria-label="Remove">
              <i class="fi-trash fs-base"></i>
            </button>
            <span class="position-absolute top-0 start-0 w-100 h-100 bg-black bg-opacity-25 z-1"></span>
          </div>
        </div>
      `;
      return col;
    };

    fileInput.addEventListener('change', () => {
      const files = Array.from(fileInput.files || []);
      files.forEach((file) => {
        const url = URL.createObjectURL(file);
        const item = createItem(url, file.type.startsWith('video/'));
        grid.insertBefore(item, uploadCol);
      });
      fileInput.value = '';
    });

    grid.addEventListener('click', (event) => {
      const btn = event.target && event.target.closest('button[aria-label="Remove"]');
      if (!btn) return;
      const col = btn.closest('.col');
      if (!col || col === uploadCol) return;
      col.remove();
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      enablePropertySidebarNavigation();
      normalizeNextButtonHref();
      initUploadDelete();
    });
  } else {
    enablePropertySidebarNavigation();
    normalizeNextButtonHref();
    initUploadDelete();
  }
})();

