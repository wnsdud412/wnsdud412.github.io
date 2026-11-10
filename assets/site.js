const themeButton = document.querySelector('.theme-toggle');
let theme;
try { theme = localStorage.getItem('journal-theme'); } catch { /* Storage is optional. */ }
if (theme !== 'dark' && theme !== 'light') theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
function applyTheme() {
  document.documentElement.dataset.theme = theme;
  if (themeButton) themeButton.setAttribute('aria-label', theme === 'dark' ? '밝은 화면으로 바꾸기' : '어두운 화면으로 바꾸기');
}
applyTheme();
themeButton?.addEventListener('click', () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  applyTheme();
  try { localStorage.setItem('journal-theme', theme); } catch { /* Keep the in-memory theme. */ }
});
for (const item of document.querySelectorAll('[data-year]')) item.textContent = String(new Date().getFullYear());
