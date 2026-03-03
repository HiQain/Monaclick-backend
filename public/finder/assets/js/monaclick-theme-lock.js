(() => {
  const keys = [
    'theme-primary',
    'theme-primary-rgb',
    'theme-primary-text-emphasis',
    'theme-primary-bg-subtle',
    'theme-primary-border-subtle',
    'theme-primary-text-emphasis-dark',
    'theme-primary-bg-subtle-dark',
    'theme-primary-border-subtle-dark',
    'theme-primary-btn-hover-active-border-bg-color'
  ];
  keys.forEach((key) => localStorage.removeItem(key));

  const styleTag = document.getElementById('customizer-styles');
  if (styleTag) styleTag.remove();

  const root = document.documentElement;
  root.style.setProperty('--fn-primary', '#fd5631');
  root.style.setProperty('--fn-primary-rgb', '253, 86, 49');
  root.style.setProperty('--fn-link-color', '#fd5631');
  root.style.setProperty('--fn-link-color-rgb', '253, 86, 49');
  root.style.setProperty('--fn-link-hover-color', '#fd5631');
  root.style.setProperty('--fn-link-hover-color-rgb', '253, 86, 49');
})();
