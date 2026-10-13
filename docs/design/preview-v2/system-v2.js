/*
 * Prototype behaviour for the system page v2 (体系总览页): injected into a generated system page by make-system-proto.py, it rebuilds the DOM into a sticky table-of-contents rail with scroll spy,
 * collapsible sections, carrier tabs in the layouts section, folded long tables and a mobile top bar with a full-screen contents sheet. Reference only: the generator must emit this structure statically.
 */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const el = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (html) e.innerHTML = html; return e; };
  const sp = $('.sp'); const nav = $('.sp-nav'); const sections = $$('.sp-section');
  const sysId = location.pathname.split('/').filter(Boolean)[0] || 'system';
  const store = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
  const KEY = `v2-collapsed:${sysId}`;
  const collapsed = new Set(store.get(KEY) || []);

  const metaOf = (s) => {
    const n = (q) => $$(q, s).length;
    switch (s.id) {
      case 'intent': return `${n('.sp-prose-wide ol > li')} 条关键规则`;
      case 'works': return `${n('.sp-work')} 件样张 · ${n('.sp-ex')} 件范例`;
      case 'layouts': return `${n('.sp-unit')} 个叙事单元 · ${n('.sp-layout')} 种排法`;
      case 'color': return `${n('.sp-chipcol')} 色 · ${n('.sp-band')} 组`;
      case 'type': return `${n('.sp-family')} 款字体`;
      case 'scale': return `${n('.sp-step')} 档字阶 · ${n('.sp-space')} 档间距`;
      case 'motion': return `${n('[data-ds-replay]')} 个可重放演示`;
      default: return '';
    }
  };

  const frame = el('div', { class: 'v2-frame' });
  const rail = el('aside', { class: 'v2-rail', 'aria-label': '目录' });
  const main = el('div', { class: 'v2-main' });
  const bar = el('div', { class: 'v2-bar' });
  nav.after(frame); frame.append(rail, main); main.append(bar, ...sections); nav.remove();

  const items = sections.map((s) => {
    const head = $('.sp-head', s); const no = $('.sp-no', head).textContent.trim(); const titleEl = $('.sp-title', head);
    const title = titleEl.textContent.trim().replace('标准样张', '体系样张');
    titleEl.textContent = title;
    const body = el('div', { class: 'v2-body', id: `${s.id}-body` });
    const mainBlock = $('.sp-main', s); mainBlock.before(body); body.append(mainBlock);
    const note = el('div', { class: 'v2-collapsed-note' }, '已收起，点标题展开'); body.after(note);
    const btn = el('button', { class: 'v2-toggle', 'aria-expanded': 'true', 'aria-controls': body.id });
    const meta = metaOf(s);
    btn.append($('.sp-no', head), titleEl, el('span', { class: 'v2-meta' }, meta), el('span', { class: 'v2-chev', 'aria-hidden': 'true' }));
    head.replaceChildren(btn);
    const subs = s.id === 'layouts' ? [] : $$('h3.sp-sub', s).map((h, i) => { h.id ||= `${s.id}-s${i + 1}`; return { id: h.id, text: h.textContent.split('·')[0].trim() }; });
    const set = (open, remember = true) => {
      btn.setAttribute('aria-expanded', String(open)); body.toggleAttribute('data-collapsed', !open); body.inert = !open;
      if (remember) { open ? collapsed.delete(s.id) : collapsed.add(s.id); store.set(KEY, [...collapsed]); }
    };
    btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
    if (collapsed.has(s.id)) set(false, false);
    return { s, no, title, set, subs, meta };
  });

  const layouts = $('#layouts .sp-main');
  if (layouts) {
    const heads = $$(':scope > h3.sp-sub', layouts);
    if (heads.length > 1) {
      const tabs = el('div', { class: 'v2-tabs', role: 'tablist' }); const line = el('i', { class: 'v2-tabline' });
      const pairs = heads.map((h, i) => {
        const panel = el('div', { class: 'v2-panel', role: 'tabpanel', id: `layouts-p${i}` });
        const list = h.nextElementSibling; h.before(panel); panel.append(list); h.remove();
        const zh = h.textContent.split('·')[0].trim();
        const b = el('button', { role: 'tab', 'aria-controls': panel.id }, `${zh}<span>${$$('.sp-layout', panel).length}</span>`);
        tabs.append(b); return { b, panel };
      });
      tabs.append(line); layouts.prepend(tabs);
      const pick = (i, focus) => { pairs.forEach((p, j) => { p.b.setAttribute('aria-selected', String(i === j)); p.b.tabIndex = i === j ? 0 : -1; p.panel.hidden = i !== j; }); const r = pairs[i].b; line.style.left = `${r.offsetLeft}px`; line.style.width = `${r.offsetWidth}px`; if (focus) r.focus(); store.set(`v2-tab:${sysId}`, i); };
      pairs.forEach((p, i) => { p.b.addEventListener('click', () => pick(i)); p.b.addEventListener('keydown', (e) => { const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (d) pick((i + d + pairs.length) % pairs.length, true); }); });
      const rank = (t) => (t.includes('网页') ? 0 : t.includes('幻灯片') ? 1 : 2);
      const start = store.get(`v2-tab:${sysId}`) ?? pairs.map((p, i) => [rank(p.b.firstChild.textContent), i]).sort((a, b) => a[0] - b[0])[0][1];
      requestAnimationFrame(() => pick(Math.min(start, pairs.length - 1)));
    }
  }

  for (const t of $$('.sp-tablewrap')) {
    const rows = $$('tbody tr', t).length; if (rows < 6) continue;
    const prev = t.previousElementSibling; const label = prev && /^H[34]$/.test(prev.tagName) ? prev.textContent.trim() : '完整表格';
    const d = el('details', { class: 'v2-more' }); const sm = el('summary', {}, `<span>${label} · ${rows} 行</span>`);
    t.before(d); d.append(sm, t);
  }

  const tocHtml = () => items.map((it) => `<a href="#${it.s.id}" data-for="${it.s.id}"><span class="v2-n">${it.no}</span><span>${it.title}</span></a>${it.subs.length ? `<div class="v2-subs" data-subs="${it.s.id}"><div>${it.subs.map((x) => `<a href="#${x.id}"><span></span><span>${x.text}</span></a>`).join('')}</div></div>` : ''}`).join('');
  const name = ($('.tq-name, .sp-name, h1') || {}).textContent?.trim() || sysId;
  rail.innerHTML = `<div class="v2-rail-inner"><div style="display:grid;gap:var(--ds-space-4)"><div class="v2-rail-k">${name} · 目录</div><nav class="v2-toc">${tocHtml()}<i class="v2-thumb"></i></nav></div>
  <div class="v2-tools"><div class="v2-progress"><i></i></div><div class="v2-row"><button type="button" data-all="close">全部收起</button><button type="button" data-all="open">全部展开</button></div><div class="v2-row"><button type="button" data-reduce aria-pressed="false">减少动态效果</button></div><a href="/">← 预览导航</a><a href="/_overview/${sysId}/overview/">排法总览</a></div></div>`;
  bar.innerHTML = `<div class="v2-bar-now"><b>${name}</b><span data-now></span></div><button type="button" data-open-sheet aria-expanded="false">目录</button><div class="v2-progress"><i></i></div>`;
  const sheet = el('div', { class: 'v2-sheet', role: 'dialog', 'aria-label': '目录' }, `<div class="v2-sheet-head"><b>${name} · 目录</b><button type="button" data-close-sheet>关闭</button></div><nav class="v2-toc">${items.map((it) => `<a href="#${it.s.id}" data-for="${it.s.id}"><span class="v2-n">${it.no}</span><span>${it.title}${it.meta ? `<span class="v2-meta"> · ${it.meta}</span>` : ''}</span></a>`).join('')}</nav>`);
  document.body.append(sheet);
  const openSheet = (v) => { sheet.toggleAttribute('data-open', v); $('[data-open-sheet]', bar).setAttribute('aria-expanded', String(v)); };
  $('[data-open-sheet]', bar).addEventListener('click', () => openSheet(true));
  $('[data-close-sheet]', sheet).addEventListener('click', () => openSheet(false));
  sheet.addEventListener('click', (e) => { if (e.target.closest('a')) openSheet(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') openSheet(false); });

  $$('[data-all]', rail).forEach((b) => b.addEventListener('click', () => items.forEach((it) => it.set(b.dataset.all === 'open'))));
  const reduceOrig = $('[data-ds-reduce-toggle]'); const reduceMine = $('[data-reduce]', rail);
  const syncReduce = () => { const on = reduceOrig ? reduceOrig.getAttribute('aria-pressed') === 'true' : document.documentElement.hasAttribute('data-v2-reduce'); reduceMine.setAttribute('aria-pressed', String(on)); document.documentElement.toggleAttribute('data-v2-reduce', on); };
  reduceMine.addEventListener('click', () => { if (reduceOrig) reduceOrig.click(); else document.documentElement.toggleAttribute('data-v2-reduce'); syncReduce(); });
  reduceOrig?.addEventListener('click', () => setTimeout(syncReduce));
  setTimeout(syncReduce, 50);

  document.addEventListener('click', (e) => { const a = e.target.closest('a[href^="#"]'); if (!a) return; const id = a.getAttribute('href').slice(1); const target = document.getElementById(id); const sec = target?.closest('.sp-section'); const it = items.find((x) => x.s === sec); if (it && $('.v2-toggle', sec).getAttribute('aria-expanded') === 'false') it.set(true); });
  if (location.hash) { const sec = document.getElementById(location.hash.slice(1))?.closest('.sp-section'); items.find((x) => x.s === sec)?.set(true); }

  const thumb = $('.v2-thumb', rail); let current = null;
  const spy = () => {
    const y = innerHeight * 0.28; let active = items[0];
    for (const it of items) if (it.s.getBoundingClientRect().top <= y) active = it;
    const max = document.documentElement.scrollHeight - innerHeight; const p = max > 0 ? scrollY / max : 0;
    $$('.v2-progress i').forEach((i) => i.style.setProperty('--p', p.toFixed(4)));
    if (active === current) return; current = active;
    $$('.v2-toc a[data-for]').forEach((a) => a.setAttribute('aria-current', String(a.dataset.for === active.s.id)));
    $$('.v2-subs', rail).forEach((d) => d.toggleAttribute('data-open', d.dataset.subs === active.s.id));
    $('[data-now]', bar).textContent = `${active.no} ${active.title}`;
    requestAnimationFrame(() => setTimeout(() => { const a = $(`.v2-toc a[data-for="${active.s.id}"]`, rail); thumb.style.top = `${a.offsetTop}px`; thumb.style.height = `${a.offsetHeight}px`; }, 0));
  };
  addEventListener('scroll', spy, { passive: true }); addEventListener('resize', spy); spy();
})();
