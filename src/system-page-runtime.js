/*
 * Interaction for generated system pages: persisted section/table folds and carrier tabs, scroll spy, transform-only TOC/tab indicators, mobile contents dialog and synchronized reduced motion.
 * Markup is emitted by system-page-html.ts; this runtime never reparents content. Static rendering always reveals every section, table and panel regardless of storage.
 * TODO(design): Review the fold feel produced by compositor-only feedback and the mobile long-table scroll width.
 * Fold feedback uses FLIP translations of following sections and opacity, so the checker can retain its transform/opacity-only constraint instead of animating grid-template-rows.
 */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const staticMode = root.dataset.render === 'static';
  const key = `system-page:${$('.sp').dataset.system}`;
  const store = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
  const saved = store.get(key + ':sections');
  const collapsed = new Set(Array.isArray(saved) ? saved.filter((v) => typeof v === 'string') : []);
  const rail = $('.v2-rail');
  const bar = $('.v2-bar');
  const sheet = $('.v2-sheet');
  const overview = $('[data-overview-listing]');
  if (overview && /^https?:$/.test(location.protocol)) overview.href = '/_overview' + new URL(overview.dataset.overviewListing, location.href).pathname;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => media.matches || root.dataset.reduce === 'true';
  const duration = (name) => { const v = getComputedStyle(root).getPropertyValue(name).trim(); return parseFloat(v) * (v.endsWith('ms') ? 1 : 1000); };
  const animate = (el, frames, timing) => {
    if (staticMode || reduced()) return;
    el.getAnimations().forEach((a) => a.cancel());
    el.animate(frames, { duration: duration(timing), easing: getComputedStyle(root).getPropertyValue('--sp-ease').trim() }).finished.catch(() => {});
  };
  const items = $$('.sp-section').map((s) => {
    const btn = $('.v2-toggle', s);
    const body = $('#' + btn.getAttribute('aria-controls'));
    let revision = 0;
    const set = (open, remember = true, feedback = true) => {
      const current = ++revision;
      const main = $('.sp-main', body);
      const bounds = main.getBoundingClientRect();
      main.getAnimations().forEach((a) => a.cancel());
      main.removeAttribute('style');
      const after = $$('.sp-section').filter((el) => el.offsetTop > s.offsetTop);
      const before = after.map((el) => el.getBoundingClientRect().top);
      btn.setAttribute('aria-expanded', String(open || staticMode));
      body.toggleAttribute('data-collapsed', !open && !staticMode);
      body.inert = !open && !staticMode;
      if (feedback) {
        after.forEach((el, i) => animate(el, [{ transform: `translateY(${before[i] - el.getBoundingClientRect().top}px)` }, { transform: 'none' }], '--sp-fold'));
        if (open) animate(main, [{ opacity: 0 }, { opacity: 1 }], '--sp-middle');
        else if (!staticMode && !reduced()) {
          Object.assign(main.style, { position: 'absolute', width: bounds.width + 'px', height: bounds.height + 'px', paddingTop: getComputedStyle(root).getPropertyValue('--sp-body-gap').trim(), opacity: '1', pointerEvents: 'none' });
          const animation = main.animate([{ opacity: 1 }, { opacity: 0 }], { duration: duration('--sp-fold'), easing: getComputedStyle(root).getPropertyValue('--sp-ease').trim() });
          const clear = () => { if (current === revision) main.removeAttribute('style'); };
          animation.finished.then(clear, clear);
        }
      }
      if (remember) { open ? collapsed.delete(s.id) : collapsed.add(s.id); store.set(key + ':sections', [...collapsed]); }
      requestAnimationFrame(spy);
    };
    btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
    return { s, btn, set, no: $('.sp-no', btn).textContent, title: $('.sp-title', btn).textContent };
  });
  const pairs = $$('[role="tab"]').map((b) => ({ b, panel: document.getElementById(b.getAttribute('aria-controls')) }));
  const line = $('.v2-tabline');
  let selected = 0;
  const alignTab = () => {
    if (!line || !pairs.length) return;
    const b = pairs[selected].b;
    line.style.transform = `translateX(${b.offsetLeft}px) scaleX(${b.offsetWidth})`;
  };
  const pick = (i, focus = false, feedback = true) => {
    selected = i;
    pairs.forEach((p, j) => { p.b.setAttribute('aria-selected', String(i === j)); p.b.tabIndex = i === j ? 0 : -1; p.panel.hidden = i !== j && !staticMode; });
    alignTab();
    if (focus) pairs[i].b.focus();
    if (feedback) animate(pairs[i].panel, [{ opacity: 0 }, { opacity: 1 }], '--sp-middle');
    if (!staticMode) store.set(key + ':tab', pairs[i].panel.id);
  };
  pairs.forEach((p, i) => {
    p.b.addEventListener('click', () => pick(i));
    p.b.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (d || e.key === 'Home' || e.key === 'End') { e.preventDefault(); pick(d ? (i + d + pairs.length) % pairs.length : e.key === 'Home' ? 0 : pairs.length - 1, true); }
    });
  });
  if (pairs.length) {
    const i = pairs.findIndex((p) => p.panel.id === store.get(key + ':tab'));
    pick(Math.max(i, 0), false, false);
  }
  for (const table of $$('.v2-more')) {
    table.open = staticMode || store.get(key + ':' + table.dataset.foldKey) === true;
    table.addEventListener('toggle', () => { if (!staticMode) store.set(key + ':' + table.dataset.foldKey, table.open); });
  }
  let lastFocus;
  let closingTimer;
  const openSheet = (open) => {
    clearTimeout(closingTimer);
    sheet.toggleAttribute('data-closing', !open && !reduced());
    sheet.toggleAttribute('data-open', open);
    if (!open && !reduced()) closingTimer = setTimeout(() => sheet.removeAttribute('data-closing'), duration('--sp-middle'));
    sheet.inert = !open;
    $('[data-open-sheet]').setAttribute('aria-expanded', String(open));
    if (open) { lastFocus = document.activeElement; $('[data-close-sheet]', sheet).focus(); }
    else lastFocus?.focus();
  };
  $('[data-open-sheet]').addEventListener('click', () => openSheet(true));
  $('[data-close-sheet]').addEventListener('click', () => openSheet(false));
  sheet.addEventListener('click', (e) => { if (e.target.closest('a')) openSheet(false); });
  document.addEventListener('keydown', (e) => {
    if (!sheet.hasAttribute('data-open')) return;
    if (e.key === 'Escape') openSheet(false);
    if (e.key === 'Tab') {
      const focusable = $$('button,a', sheet);
      const i = focusable.indexOf(document.activeElement);
      if ((e.shiftKey && i <= 0) || (!e.shiftKey && i === focusable.length - 1)) { e.preventDefault(); focusable[e.shiftKey ? focusable.length - 1 : 0].focus(); }
    }
  });
  $$('[data-all]').forEach((b) => b.addEventListener('click', () => items.forEach((it) => it.set(b.dataset.all === 'open', true, false))));
  const originalReduce = $('[data-ds-reduce-toggle]');
  const syncReduce = () => {
    $('button[data-reduce]').setAttribute('aria-pressed', originalReduce.getAttribute('aria-pressed'));
    if (reduced()) for (const { s } of items) for (const animation of s.getAnimations({ subtree: true })) {
      try { animation.finish(); } catch { animation.cancel(); }
    }
  };
  $('button[data-reduce]').addEventListener('click', () => { originalReduce.click(); syncReduce(); });
  originalReduce.addEventListener('click', syncReduce);
  media.addEventListener('change', syncReduce);
  syncReduce();
  const reveal = (id) => {
    const target = document.getElementById(id);
    const item = items.find((it) => it.s === target?.closest('.sp-section'));
    item?.set(true, true, false);
    let parent = target;
    while (parent && parent !== item?.s) { if (parent.matches('details')) parent.open = true; parent = parent.parentElement; }
    return target;
  };
  document.addEventListener('click', (e) => { const a = e.target.closest('a[href^="#"]'); if (a) reveal(decodeURIComponent(a.hash.slice(1))); });
  addEventListener('hashchange', () => reveal(decodeURIComponent(location.hash.slice(1))));
  const thumb = $('.v2-thumb', rail);
  function spy() {
    let active = items[0];
    for (const it of items) if (it.s.getBoundingClientRect().top <= innerHeight * .28) active = it;
    const max = root.scrollHeight - innerHeight;
    $$('.v2-progress i').forEach((i) => i.style.setProperty('--p', max > 0 ? Math.min(1, scrollY / max) : 0));
    $$('.v2-toc a[data-for]').forEach((a) => a.setAttribute('aria-current', String(a.dataset.for === active.s.id)));
    $$('.v2-subs', rail).forEach((d) => d.toggleAttribute('data-open', d.dataset.subs === active.s.id));
    $('[data-now]', bar).textContent = `${active.no} ${active.title}`;
    const a = $(`a[data-for="${active.s.id}"]`, rail);
    thumb.style.transform = `translateY(${a.offsetTop}px) scaleY(${a.offsetHeight})`;
  }
  items.forEach((it) => { if (collapsed.has(it.s.id)) it.set(false, false, false); });
  if (location.hash) { const target = reveal(decodeURIComponent(location.hash.slice(1))); requestAnimationFrame(() => target?.scrollIntoView()); }
  addEventListener('scroll', spy, { passive: true });
  addEventListener('resize', () => { spy(); alignTab(); });
  document.fonts.ready.then(() => { spy(); alignTab(); });
  spy();
})();
