/*
 * Preview controls: persistent folds/theme, cover panorama height, scroll spy and warning-only filtering. Storage failures retain defaults.
 */

(() => {
  const store = { get(k){ try { return localStorage.getItem(k); } catch { return null; } }, set(k,v){ try { localStorage.setItem(k,v); } catch {} } };
  document.querySelectorAll('.fold-head').forEach((b) => {
    const body = document.getElementById(b.getAttribute('aria-controls'));
    const saved = store.get('nav-fold:' + body.id);
    const set = (open) => { b.setAttribute('aria-expanded', String(open)); body.toggleAttribute('data-open', open); body.inert = !open; };
    if (saved !== null) set(saved === '1'); else set(b.getAttribute('aria-expanded') === 'true');
    b.addEventListener('click', () => { const open = b.getAttribute('aria-expanded') !== 'true'; set(open); store.set('nav-fold:' + body.id, open ? '1' : '0'); });
  });
  document.querySelectorAll('.cover').forEach((c) => { const sync = () => c.style.setProperty('--h', c.clientHeight + 'px'); sync(); addEventListener('resize', sync); });
  const links = [...document.querySelectorAll('.jump a')]; const systems = links.map((a) => document.getElementById(a.hash.slice(1)));
  const spy = () => { let cur = 0; systems.forEach((s, i) => { if (s.getBoundingClientRect().top < innerHeight * 0.4) cur = i; }); links.forEach((a, i) => a.setAttribute('aria-current', String(i === cur))); };
  addEventListener('scroll', spy, { passive: true }); spy();
  document.querySelector('[data-warnings-only]')?.addEventListener('change', (e) => {
    document.querySelectorAll('[data-warnings]').forEach((card) => card.hidden = e.target.checked && Number(card.dataset.warnings) === 0);
  });
  const root = document.documentElement; const t = store.get('nav-theme'); if (['light', 'dark'].includes(t)) root.dataset.theme = t;
  document.querySelector('[data-theme-toggle]').addEventListener('click', () => { const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; root.dataset.theme = dark ? 'light' : 'dark'; store.set('nav-theme', root.dataset.theme); });
})();
