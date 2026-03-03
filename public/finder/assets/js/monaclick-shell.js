(() => {
  const headerMount = document.querySelector('#monaclick-shell-header');
  const footerMount = document.querySelector('#monaclick-shell-footer');

  if (!headerMount && !footerMount) return;

  fetch('/home-contractors.html', { credentials: 'same-origin' })
    .then((response) => response.text())
    .then((html) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const sourceHeader = doc.querySelector('header.navbar');
      const sourceFooter = doc.querySelector('footer.footer');

      if (headerMount && sourceHeader) {
        headerMount.replaceWith(sourceHeader);
      }

      if (footerMount && sourceFooter) {
        footerMount.replaceWith(sourceFooter);
      }

      const path = window.location.pathname;
      const navLinks = document.querySelectorAll('header.navbar a.nav-link');

      navLinks.forEach((link) => {
        const href = link.getAttribute('href') || '';
        if (href === '/' && path === '/') link.classList.add('active');
        if (href === '/contractors' && path.startsWith('/contractors')) link.classList.add('active');
        if (href === '/real-estate' && path.startsWith('/real-estate')) link.classList.add('active');
        if (href === '/cars' && path.startsWith('/cars')) link.classList.add('active');
        if (href === '/events' && path.startsWith('/events')) link.classList.add('active');
      });
    })
    .catch(() => {
      // keep local fallback header/footer if fetch fails
    });
})();
