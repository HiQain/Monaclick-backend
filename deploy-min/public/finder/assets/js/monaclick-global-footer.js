(() => {
  const footer = document.querySelector('footer.footer');
  if (!footer) return;

  const currentPath = window.location.pathname.toLowerCase();
  const isAuthSplitPage = currentPath === '/signin' || currentPath === '/signup' || currentPath === '/password-recovery';

  const needsVerticalCenter = currentPath === '/signin' || currentPath === '/password-recovery';
  if (needsVerticalCenter) {
    const panel = document.querySelector('main.content-wrapper > .d-lg-flex > div.d-flex.flex-column.min-vh-100');
    if (panel) panel.classList.add('justify-content-center');

    const heading = panel?.querySelector('h1.h2.mt-auto');
    if (heading) heading.classList.remove('mt-auto');
  }
  if (isAuthSplitPage) {
    const main = document.querySelector('main.content-wrapper');
    const splitRow = main?.querySelector(':scope > .d-lg-flex');
    const header = main?.querySelector('header.navbar.navbar-sticky');

    if (main && splitRow && header && header.parentElement !== main) {
      main.insertBefore(header, splitRow);
      header.classList.add('mb-2');
    }

    if (main) {
      main.insertAdjacentElement('afterend', footer);
    }
  }
const moduleLinks = [
    { href: '/listings/contractors', label: 'Contractors' },
    { href: '/listings/real-estate', label: 'Real Estate' },
    { href: '/listings/cars', label: 'Cars' },
    { href: '/listings/events', label: 'Events' },
    { href: '/listings/restaurants', label: 'Restaurants' },
  ];

  const cities = ['New York', 'Chicago', 'Los Angeles', 'Dallas', 'Houston', 'Seattle'];
  const cityPills = cities
    .map((city) => `<li class="nav-item"><a class="nav-link" href="/listings/restaurants?q=${encodeURIComponent(city.toLowerCase())}">${city}</a></li>`)
    .join('');

  const moduleItemsCol1 = moduleLinks
    .slice(0, 3)
    .map((item) => `<li class="pt-1"><a class="nav-link hover-effect-underline d-inline text-body fw-normal p-0" href="${item.href}">${item.label}</a></li>`)
    .join('');

  const moduleItemsCol2 = moduleLinks
    .slice(3)
    .map((item) => `<li class="pt-1"><a class="nav-link hover-effect-underline d-inline text-body fw-normal p-0" href="${item.href}">${item.label}</a></li>`)
    .join('');

  footer.outerHTML = `
    <footer class="footer bg-body border-top" data-bs-theme="dark">
      <div class="container pb-md-2">
        <div class="d-md-flex align-items-center justify-content-between border-bottom pt-5 pb-4 pb-md-5">
          <div class="d-flex flex-column flex-sm-row align-items-center justify-content-center gap-3 gap-sm-4 mb-4 mb-md-0">
            <div class="d-flex align-items-center">
              <i class="fi-mail fs-4 lh-0 text-body d-none d-sm-block me-2"></i>
              <i class="fi-mail text-body d-sm-none me-2"></i>
              <h6 class="ps-sm-1 mb-0">
                <span class="h5 d-none d-sm-block mb-0">Subscribe to Monaclick updates</span>
                <span class="d-sm-none">Subscribe to Monaclick updates</span>
              </h6>
            </div>
            <button type="button" class="btn btn-primary">Subscribe</button>
          </div>
          <div class="h5 d-none d-sm-block text-center mb-0">
            <span class="text-body-secondary fw-normal me-3">Need help?</span>
            <a class="text-white text-decoration-none hover-effect-underline" href="/contact">Contact us</a>
          </div>
          <div class="h6 d-sm-none text-center mb-0">
            <span class="text-body-secondary fw-normal me-2">Need help?</span>
            <a class="text-white text-decoration-none hover-effect-underline" href="/contact">Contact us</a>
          </div>
        </div>

        <div class="accordion row pt-4 pt-sm-5 mt-3 mt-sm-0" id="footerLinks">
          <div class="col-md-4 col-lg-5 mb-4 mb-sm-5 mb-md-0">
            <a class="d-inline-flex align-items-center text-dark-emphasis text-decoration-none mb-3" href="/combined">
              <span class="flex-shrink-0 text-primary rtl-flip me-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="35" height="34"><path d="M34.5 16.894v10.731c0 3.506-2.869 6.375-6.375 6.375H17.5h-.85C7.725 33.575.5 26.138.5 17c0-9.35 7.65-17 17-17s17 7.544 17 16.894z" fill="currentColor"/><g fill-rule="evenodd"><path d="M17.5 13.258c-3.101 0-5.655 2.554-5.655 5.655s2.554 5.655 5.655 5.655 5.655-2.554 5.655-5.655-2.554-5.655-5.655-5.655zm-9.433 5.655c0-5.187 4.246-9.433 9.433-9.433s9.433 4.246 9.433 9.433a9.36 9.36 0 0 1-1.569 5.192l2.397 2.397a1.89 1.89 0 0 1 0 2.671 1.89 1.89 0 0 1-2.671 0l-2.397-2.397a9.36 9.36 0 0 1-5.192 1.569c-5.187 0-9.433-4.246-9.433-9.433z" fill="#000" fill-opacity=".05"/><g fill="#fff"><path d="M17.394 10.153c-3.723 0-6.741 3.018-6.741 6.741s3.018 6.741 6.741 6.741 6.741-3.018 6.741-6.741-3.018-6.741-6.741-6.741zM7.347 16.894A10.05 10.05 0 0 1 17.394 6.847 10.05 10.05 0 0 1 27.44 16.894 10.05 10.05 0 0 1 17.394 26.94 10.05 10.05 0 0 1 7.347 16.894z"/><path d="M23.025 22.525c.645-.645 1.692-.645 2.337 0l3.188 3.188c.645.645.645 1.692 0 2.337s-1.692.645-2.337 0l-3.187-3.187c-.645-.646-.645-1.692 0-2.337z"/></g></g><path d="M23.662 14.663c2.112 0 3.825-1.713 3.825-3.825s-1.713-3.825-3.825-3.825-3.825 1.713-3.825 3.825 1.713 3.825 3.825 3.825z" fill="#fff"/><path fill-rule="evenodd" d="M23.663 8.429a2.41 2.41 0 0 0-2.408 2.408 2.41 2.41 0 0 0 2.408 2.408 2.41 2.41 0 0 0 2.408-2.408 2.41 2.41 0 0 0-2.408-2.408zm-5.242 2.408c0-2.895 2.347-5.242 5.242-5.242s5.242 2.347 5.242 5.242-2.347 5.242-5.242 5.242-5.242-2.347-5.242-5.242z" fill="currentColor"/></svg>
              </span>
              <span class="fs-4 fw-semibold">Monaclick</span>
            </a>
            <p class="fs-sm text-body-secondary pt-md-1" style="max-width: 290px">One platform for contractors, real estate, cars, events, and restaurants across major cities.</p>
            <div class="d-flex gap-3 pt-2 pt-md-3">
              <a class="btn btn-icon btn-sm btn-secondary rounded-circle" href="/about" aria-label="Follow us on Instagram"><i class="fi-instagram fs-sm"></i></a>
              <a class="btn btn-icon btn-sm btn-secondary rounded-circle" href="/about" aria-label="Follow us on Facebook"><i class="fi-facebook fs-sm"></i></a>
              <a class="btn btn-icon btn-sm btn-secondary rounded-circle" href="/blog" aria-label="Follow us on X (Twitter)"><i class="fi-x fs-sm"></i></a>
            </div>
          </div>

          <div class="col-sm-8 col-md-5 col-lg-4">
            <div class="accordion-item border-0">
              <h6 class="accordion-header" id="categoryLinksHeading">
                <span class="h5 d-none d-sm-block">Explore modules</span>
                <button type="button" class="accordion-button collapsed py-3 d-sm-none" data-bs-toggle="collapse" data-bs-target="#categoryLinks" aria-expanded="false" aria-controls="categoryLinks">Explore modules</button>
              </h6>
              <div class="accordion-collapse collapse d-sm-block" id="categoryLinks" aria-labelledby="categoryLinksHeading" data-bs-parent="#footerLinks">
                <div class="row row-cols-2">
                  <div class="col">
                    <ul class="nav flex-column gap-2 pt-sm-1 pt-lg-2 pb-3 pb-sm-0 mt-n1 mb-1 mb-sm-0">${moduleItemsCol1}</ul>
                  </div>
                  <div class="col">
                    <ul class="nav flex-column gap-2 pt-sm-1 pt-lg-2 pb-3 pb-sm-0 mt-n1 mb-1 mb-sm-0">${moduleItemsCol2}
                      <li class="pt-1"><a class="nav-link hover-effect-underline d-inline text-body fw-normal p-0" href="/add-listing">Add listing</a></li>
                    </ul>
                  </div>
                </div>
              </div>
              <hr class="d-sm-none my-0">
            </div>
          </div>

          <div class="col-sm-4 col-md-3 col-lg-2 offset-lg-1">
            <div class="accordion-item border-0">
              <h6 class="accordion-header" id="companyLinksHeading">
                <span class="h5 d-none d-sm-block">Company</span>
                <button type="button" class="accordion-button collapsed py-3 d-sm-none" data-bs-toggle="collapse" data-bs-target="#companyLinks" aria-expanded="false" aria-controls="companyLinks">Company</button>
              </h6>
              <div class="accordion-collapse collapse d-sm-block" id="companyLinks" aria-labelledby="companyLinksHeading" data-bs-parent="#footerLinks">
                <ul class="nav flex-column gap-2 pt-sm-1 pt-lg-2 pb-3 pb-sm-0 mt-n1 mb-1 mb-sm-0">
                  <li class="pt-1"><a class="nav-link hover-effect-underline d-inline text-body fw-normal p-0" href="/about">About</a></li>
                  <li class="pt-1"><a class="nav-link hover-effect-underline d-inline text-body fw-normal p-0" href="/blog">Blog</a></li>
                  <li class="pt-1"><a class="nav-link hover-effect-underline d-inline text-body fw-normal p-0" href="/contact">Contact us</a></li>
                  <li class="pt-1"><a class="nav-link hover-effect-underline d-inline text-body fw-normal p-0" href="/terms-and-conditions">Terms of use</a></li>
                  <li class="pt-1"><a class="nav-link hover-effect-underline d-inline text-body fw-normal p-0" href="/terms-and-conditions">Privacy</a></li>
                </ul>
              </div>
              <hr class="d-sm-none my-0">
            </div>
          </div>
        </div>

        <div class="d-md-flex gap-4 pt-4 pt-sm-5">
          <h6 class="mt-1 mb-md-0">
            <span class="h5 text-nowrap d-none d-sm-block mb-0">Top cities</span>
            <span class="text-nowrap d-sm-none">Top cities</span>
          </h6>
          <ul class="nav nav-pills gap-2 gap-md-3">${cityPills}</ul>
        </div>

        <div class="d-md-flex align-items-center py-4 pt-sm-5 mt-3 mt-sm-0">
          <div class="d-flex gap-2 gap-sm-3 justify-content-center ms-md-auto mb-4 mb-md-0 order-md-2">
            <div><img src="/finder/assets/img/payment-methods/visa-dark-mode.svg" alt="Visa"></div>
            <div><img src="/finder/assets/img/payment-methods/mastercard.svg" alt="Mastercard"></div>
            <div><img src="/finder/assets/img/payment-methods/paypal-dark-mode.svg" alt="PayPal"></div>
            <div><img src="/finder/assets/img/payment-methods/google-pay-dark-mode.svg" alt="Google Pay"></div>
            <div><img src="/finder/assets/img/payment-methods/apple-pay-dark-mode.svg" alt="Apple Pay"></div>
          </div>
          <p class="text-body-secondary fs-sm text-center text-md-start mb-0 me-md-4 order-md-1">&copy; All rights reserved. Developed by <span class="text-body fw-medium">US Logo and Web</span></p>
        </div>
      </div>
    </footer>
  `;
})();

(() => {
  const path = window.location.pathname.toLowerCase();

  const toSlug = (value) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

  const isElementInMain = (element) => {
    const main = element.closest('main');
    if (!main) return false;
    if (element.closest('#customizer')) return false;
    return true;
  };

  const getFieldKey = (element) => {
    const id = (element.id || '').trim();
    if (id) return id;
    const aria = (element.getAttribute('aria-label') || '').trim();
    if (aria) return `${element.tagName.toLowerCase()}:${toSlug(aria)}`;
    return '';
  };

  const encodePayload = (payload) => {
    try {
      const json = JSON.stringify(payload || {});
      return btoa(unescape(encodeURIComponent(json)));
    } catch {
      return '';
    }
  };

  const setupRestaurantForm = () => {
    if (path !== '/add-restaurant' && path !== '/add-restaurant.html') return;

    const form = document.querySelector('main form.card');
    if (!form) return;

    form.setAttribute('action', '/submit/restaurant');
    form.setAttribute('method', 'get');

    const saveDraftBtn = Array.from(form.querySelectorAll('button'))
      .find((button) => (button.textContent || '').trim().toLowerCase() === 'save draft');
    if (saveDraftBtn) {
      saveDraftBtn.setAttribute('type', 'submit');
      saveDraftBtn.setAttribute('name', 'draft');
      saveDraftBtn.setAttribute('value', '1');
      saveDraftBtn.setAttribute('formnovalidate', 'formnovalidate');
    }

    const publishBtn = Array.from(form.querySelectorAll('button[type="submit"], button'))
      .find((button) => (button.textContent || '').toLowerCase().includes('submit restaurant listing'));
    if (publishBtn) {
      publishBtn.setAttribute('type', 'submit');
      publishBtn.setAttribute('name', 'publish');
      publishBtn.setAttribute('value', '1');
    }

    const serviceCheckboxes = Array.from(form.querySelectorAll('input[name="services"]'));
    serviceCheckboxes.forEach((checkbox) => {
      const label = form.querySelector(`label[for="${checkbox.id}"]`);
      const value = (label?.textContent || checkbox.id || 'service').trim().toLowerCase();
      checkbox.value = value;
    });

    form.addEventListener('submit', () => {
      form.querySelectorAll('input[type="file"]').forEach((input) => {
        input.disabled = true;
      });
    });
  };

  const setupWizardSubmission = () => {
    const isProperty = path.includes('add-property');
    const isContractor = path.includes('add-contractor');
    if (!isProperty && !isContractor) return;

    const storageKey = isProperty ? 'monaclick:add-property' : 'monaclick:add-contractor';
    const submitPath = isProperty ? '/submit/property' : '/submit/contractor';
    const finalPath = isProperty ? '/add-property-promotion.html' : '/add-contractor-project.html';
    const modulePathPrefix = isProperty ? '/add-property' : '/add-contractor';

    const readState = () => {
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch {
        return {};
      }
    };

    const writeState = (state) => {
      localStorage.setItem(storageKey, JSON.stringify(state));
    };

    const collectState = () => {
      const state = readState();
      const fields = Array.from(document.querySelectorAll('input, select, textarea'))
        .filter((field) => isElementInMain(field))
        .filter((field) => !field.disabled)
        .filter((field) => field.type !== 'file')
        .filter((field) => field.type !== 'range')
        .filter((field) => field.type !== 'color');

      fields.forEach((field) => {
        if (field.type === 'radio' && field.name) {
          const selected = document.querySelector(`input[type="radio"][name="${field.name}"]:checked`);
          if (selected && isElementInMain(selected)) {
            state[`radio:${field.name}`] = selected.id || selected.value || '';
          }
          return;
        }

        const key = getFieldKey(field);
        if (!key) return;

        if (field.type === 'checkbox') {
          state[key] = !!field.checked;
          return;
        }

        if (field.tagName === 'SELECT' && field.multiple) {
          state[key] = Array.from(field.selectedOptions).map((option) => option.value).filter(Boolean);
          return;
        }

        state[key] = field.value;
      });

      writeState(state);
      return state;
    };

    const restoreState = () => {
      const state = readState();
      if (!Object.keys(state).length) return;

      Array.from(document.querySelectorAll('input, select, textarea'))
        .filter((field) => isElementInMain(field))
        .forEach((field) => {
          if (field.type === 'radio' && field.name) {
            const selectedId = state[`radio:${field.name}`];
            if (selectedId && field.id === selectedId) {
              field.checked = true;
            }
            return;
          }

          const key = getFieldKey(field);
          if (!key || !(key in state)) return;

          if (field.type === 'checkbox') {
            field.checked = !!state[key];
            return;
          }

          if (field.tagName === 'SELECT' && field.multiple) {
            const values = Array.isArray(state[key]) ? state[key] : [];
            Array.from(field.options).forEach((option) => {
              option.selected = values.includes(option.value);
            });
            field.dispatchEvent(new Event('change', { bubbles: true }));
            return;
          }

          field.value = state[key] ?? '';
        });
    };

    const submitState = (status) => {
      const state = collectState();
      const payload = encodePayload(state);
      if (!payload) return;

      const form = document.createElement('form');
      form.method = 'get';
      form.action = submitPath;
      form.style.display = 'none';

      const payloadInput = document.createElement('input');
      payloadInput.type = 'hidden';
      payloadInput.name = 'payload';
      payloadInput.value = payload;
      form.appendChild(payloadInput);

      if (status === 'draft') {
        const draftInput = document.createElement('input');
        draftInput.type = 'hidden';
        draftInput.name = 'draft';
        draftInput.value = '1';
        form.appendChild(draftInput);
      } else {
        const publishInput = document.createElement('input');
        publishInput.type = 'hidden';
        publishInput.name = 'publish';
        publishInput.value = '1';
        form.appendChild(publishInput);
      }

      document.body.appendChild(form);
      if (status !== 'draft') {
        localStorage.removeItem(storageKey);
      }
      form.submit();
    };

    restoreState();

    const saveHandlers = ['input', 'change', 'blur'];
    saveHandlers.forEach((eventName) => {
      document.addEventListener(eventName, (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;
        if (!isElementInMain(target)) return;
        collectState();
      }, true);
    });

    document.querySelectorAll(`a[href^="${modulePathPrefix}"], a[href^="add-"]`).forEach((link) => {
      link.addEventListener('click', () => {
        collectState();
      });
    });

    const saveDraftButton = Array.from(document.querySelectorAll('button.btn.btn-lg.btn-outline-secondary'))
      .find((button) => (button.textContent || '').trim().toLowerCase() === 'save draft');

    if (saveDraftButton) {
      saveDraftButton.addEventListener('click', (event) => {
        event.preventDefault();
        submitState('draft');
      });
    }

    if (path.endsWith(finalPath)) {
      const publishButton = isProperty
        ? Array.from(document.querySelectorAll('a.btn.btn-lg.btn-primary'))
            .find((button) => (button.textContent || '').toLowerCase().includes('publish property listing'))
        : Array.from(document.querySelectorAll('button.btn.btn-lg.btn-primary'))
            .find((button) => (button.textContent || '').toLowerCase().includes('become a pro'));

      if (publishButton) {
        publishButton.addEventListener('click', (event) => {
          event.preventDefault();
          submitState('publish');
        });
      }
    }
  };

  setupRestaurantForm();
  setupWizardSubmission();
})();

(() => {
  const path = window.location.pathname.toLowerCase();
  if (path !== '/signin' && path !== '/signup' && path !== '/password-recovery') return;

  const form = document.querySelector('main form.needs-validation');
  if (!form) return;

  const showNotice = (message, type = 'success') => {
    const old = form.parentElement?.querySelector('.monaclick-auth-notice');
    if (old) old.remove();

    const note = document.createElement('div');
    note.className = 'alert alert-' + type + ' monaclick-auth-notice';
    note.role = 'alert';
    note.textContent = message;
    form.parentElement?.insertBefore(note, form);
  };

  const params = new URLSearchParams(window.location.search);
  const email = params.get('email');
  if (email) {
    const emailInput = form.querySelector('input[type="email"]');
    if (emailInput && !emailInput.value) emailInput.value = email;
  }

  if (path === '/signin') {
    if (params.get('created') === '1') showNotice('Account created successfully. Please sign in.', 'success');
    if (params.get('error') === 'invalid') showNotice('Invalid email or password.', 'danger');
  }

  if (path === '/signup' && params.get('error') === 'exists') {
    showNotice('This email is already registered. Please sign in.', 'warning');
  }

  if (path === '/password-recovery') {
    if (params.get('status') === 'sent') showNotice('Password reset request received. Please check your email.', 'success');
    if (params.get('status') === 'missing') showNotice('No account found with this email.', 'warning');
  }
})();
