(() => {
  const key = 'theme';
  let dark = false;
  try { dark = localStorage.getItem(key) === 'dark'; } catch { /* Private browsing can disable storage. */ }
  document.documentElement.classList.toggle('dark-theme', dark);

  document.addEventListener('DOMContentLoaded', () => {
    const domainDisplay = document.querySelector('[data-domain-display]');
    if (domainDisplay && /^(?:www\.)?printwithqr\.(?:in|com)$/.test(window.location.hostname)) {
      domainDisplay.textContent = window.location.hostname;
    }
    // The app uses React's toggle. Only the early theme initialization is shared.
    if (document.getElementById('root')) return;
    const toggle = document.querySelector('.theme-toggle');
    if (!toggle) return;

    const update = () => {
      document.documentElement.classList.toggle('dark-theme', dark);
      const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
      toggle.setAttribute('aria-checked', String(dark));
      toggle.setAttribute('aria-label', label);
      toggle.title = label;
    };

    update();
    toggle.addEventListener('click', () => {
      dark = !dark;
      try { localStorage.setItem(key, dark ? 'dark' : 'light'); } catch { /* Keep the current page usable. */ }
      update();
    });
    window.addEventListener('storage', event => {
      if (event.key === key) { dark = event.newValue === 'dark'; update(); }
    });
  });
})();
