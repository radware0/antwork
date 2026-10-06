(() => {
  const applyTheme = () => {
    let theme = 'black';
    try { if (localStorage.getItem('antwork-site-theme') === 'white') theme = 'white'; }
    catch { /* Use the site's default when browser storage is unavailable. */ }
    document.documentElement.dataset.theme = theme;
  };
  applyTheme();
  window.addEventListener('pageshow', applyTheme);
  window.addEventListener('storage', event => {
    if (event.key === 'antwork-site-theme' || event.key === null) applyTheme();
  });
})();
