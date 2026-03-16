(() => {
  if (!window.location.pathname.startsWith('/entry/')) return;

  const container = document.querySelector('main.content-wrapper > .container');
  if (!container) return;

  const escapeHtml = (value) =>
    String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');

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

  const findDetailsSection = () => {
    const headings = Array.from(container.querySelectorAll('h2'));
    const detailsHeading = headings.find((h) => (h.textContent || '').trim().toLowerCase() === 'details');
    return detailsHeading ? detailsHeading.closest('section') : null;
  };

  const injected = () => !!container.querySelector('[data-mc-features="1"]');

  const inject = (features) => {
    if (injected()) return true;

    const values = (Array.isArray(features) ? features : [])
      .map((f) => String(f ?? '').trim())
      .filter(Boolean);
    if (!values.length) return false;

    const detailsSection = findDetailsSection();
    if (!detailsSection) return false;

    const badges = values
      .map(humanizeFeature)
      .filter(Boolean)
      .map((label) => `<span class="badge bg-body-secondary text-body">${escapeHtml(label)}</span>`)
      .join('');
    if (!badges) return false;

    detailsSection.insertAdjacentHTML(
      'afterend',
      `<section class="pb-sm-2 pb-lg-3 mb-5" data-mc-features="1">
        <h2 class="h4 mb-3">Features</h2>
        <div class="d-flex flex-wrap gap-2">${badges}</div>
      </section>`
    );
    return true;
  };

  const pathParts = window.location.pathname.split('/');
  const module = pathParts[2] || 'contractors';
  const slug = new URLSearchParams(window.location.search).get('slug');
  if (!slug) return;

  let payload = null;
  let fetching = false;
  const fetchOnce = async () => {
    if (payload || fetching) return payload;
    fetching = true;
    try {
      const res = await fetch(`/api/monaclick/entry?module=${encodeURIComponent(module)}&slug=${encodeURIComponent(slug)}`);
      if (!res.ok) return null;
      payload = await res.json();
      return payload;
    } catch (e) {
      return null;
    } finally {
      fetching = false;
    }
  };

  const tryInject = async () => {
    const p = await fetchOnce();
    const item = p?.data || {};
    const features = item?.features || item?.details?.car?.features || [];
    inject(features);
  };

  // Initial attempt (may run before entry dynamic renders).
  tryInject();

  // Observe DOM changes until injected.
  const observer = new MutationObserver(() => {
    if (injected()) return observer.disconnect();
    if (!findDetailsSection()) return;
    tryInject();
  });

  observer.observe(container, { childList: true, subtree: true });

  try {
    window.__MC_ENTRY_FEATURES_PATCH__ = '2026-03-13-r5';
    console.log('[Monaclick] entry features patch', window.__MC_ENTRY_FEATURES_PATCH__);
  } catch (e) {}
})();

