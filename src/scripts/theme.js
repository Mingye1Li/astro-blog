import { themeChange } from 'theme-change';

const selector = document.getElementById('themeSelect');
try {
  themeChange(false);
} catch {
  // Browsers with storage disabled still get an in-memory theme switch.
  selector?.addEventListener('change', () => {
    if (selector.value) document.documentElement.dataset.theme = selector.value;
    else document.documentElement.removeAttribute('data-theme');
  });
}
window.addEventListener('storage', (event) => {
  if (event.key !== 'liubai-theme') return;
  const theme = ['light', 'dark'].includes(event.newValue) ? event.newValue : '';
  if (theme) document.documentElement.dataset.theme = theme;
  else document.documentElement.removeAttribute('data-theme');
  if (selector) selector.value = theme;
});
