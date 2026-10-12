/*
 * Entrance choreography helper (入场编排): a declarative way for layouts (.liquid) and custom fragments to stage entrances using only the system's motion values.
 * Authoring API (plain data attributes in the layout or fragment HTML):
 *   data-ds-enter="fade|rise|fall|left|right"   mark an element to enter; rise/fall/left/right add a short displacement on top of the fade (empty value = fade).
 *   data-ds-enter="draw-x|draw-y"              draw from left to right (scaleX, left origin) or top to bottom (scaleY, top origin); reduced motion shows the finished drawing without animation.
 *   data-ds-enter="stamp"                      fade in while scaling from motion.stampScale (DTCG number > 1, required only when stamp is used) to the natural CSS transform.
 *   data-ds-enter="peel-left|peel-right|peel-up|peel-down"  move a cover by 100% of its own size; retain the terminal transform and opacity 0 with fill both. Reduced motion only fades out.
 *   data-ds-order="<n>"                         position in the sequence of its group (default: document order); equal numbers share the stagger delay before any per-element wait.
 *   data-ds-stagger="<name>"                    on a group container: the --ds-stagger-<name> step between members (default: the smallest stagger step, 0 if the system has none).
 *   data-ds-step="<name>"                       duration step --ds-duration-<name> (default: base, else the middle step).
 *   data-ds-wait="<name>"                       extra wait --ds-duration-<name> added to this element's rank * stagger delay (default: 0); does not delay other group members.
 *   data-ds-ease="<name>"                       easing --ds-easing-<name> (default: settle, else the first one).
 *   data-ds-opacity-step="<name>" / data-ds-opacity-ease="<name>" override opacity timing for transform entrances (rise/fall/left/right, draw, stamp, peel).
 *   System defaults: token root $extensions["io.github.jinhaofang.design-system"].entrance.opacity = { step: "<duration name>", ease: "<easing name>" }.
 *   With a default or either override, transform and opacity use separate animations with the same delay; missing opacity fields fall back to the entrance's step/ease.
 *   Draw also fades in and peel also fades out when separate timing is selected. Without any declaration their original transform-only behavior is retained; fade and reduced motion ignore opacity timing.
 *   data-ds-distance="<name>"                   displacement --ds-space-<name> (default: the middle space step).
 * A group is the nearest ancestor with data-ds-stagger, else the enclosing unit section. Durations, easings, stagger and distances all come from the resolved tokens, embedded into the script at build time;
 * unknown names are rejected by validateChoreography (a BuildError before rendering); an unknown wait names the sequence item and element's opening tag.
 * Runtime (buildChoreographyScript, a classic inline script placed after the page content): non-cover entrances use fill backwards and return to natural CSS. Completed covers get data-ds-revealed,
 * which hides the entire cover subtree and removes it from the checker snapshot; replay cancels the previous animation and removes this mark. Origins are set outside keyframes, so only transform/opacity animate.
 * Web: elements in view on load enter together; others enter in batches when scrolled into view (IntersectionObserver); covers scrolled past without being seen are finalized.
 * Under html[data-render="static"] covers are finalized synchronously, including off-screen covers; other content is shown immediately. Print CSS finalizes all covers, including unvisited slides.
 * Slides: ds:slide-prepare resets covers before the target is shown, including revisits; window.dsSlides.onEnter plays after the page turn settles and returns all animations for dsSlides.entered(), including extra waits.
 * Reduced motion drops displacement, scaling, stagger and extra waits, and uses the shortest duration for stamp/fade/peel.
 */
import type { EntranceOpacity, ResolvedTokens } from './tokens.ts';
import { BuildError } from './types.ts';

export interface ChoreographyConfig {
  durations: Record<string, number>;
  staggers: Record<string, number>;
  easings: Record<string, string>;
  spaces: Record<string, number>;
  stampScale: number | undefined;
  opacity: EntranceOpacity | undefined;
}

const EFFECTS = ['fade', 'rise', 'fall', 'left', 'right', 'draw-x', 'draw-y', 'stamp', 'peel-left', 'peel-right', 'peel-up', 'peel-down'];

function group(tokens: ResolvedTokens, prefix: string, pick: (entry: ResolvedTokens['entries'][number]) => number | string | undefined): Record<string, any> {
  const result: Record<string, any> = {};
  for (const entry of tokens.entries) {
    if (!entry.cssVar.startsWith(prefix)) continue;
    const value = pick(entry);
    if (value !== undefined) result[entry.cssVar.slice(prefix.length)] = value;
  }
  return result;
}

export function choreographyConfig(tokens: ResolvedTokens): ChoreographyConfig {
  return {
    durations: group(tokens, '--ds-duration-', (entry) => entry.number),
    staggers: group(tokens, '--ds-stagger-', (entry) => entry.number),
    easings: group(tokens, '--ds-easing-', (entry) => entry.css),
    spaces: group(tokens, '--ds-space-', (entry) => entry.number),
    stampScale: tokens.entries.find((entry) => entry.cssVar === '--ds-motion-stampScale')?.number,
    opacity: tokens.entranceOpacity,
  };
}

export function validateChoreography(unitsHtml: string[], tokens: ResolvedTokens): string[] {
  const config = choreographyConfig(tokens);
  const allowed: Record<string, string[]> = {
    enter: EFFECTS,
    step: Object.keys(config.durations),
    wait: Object.keys(config.durations),
    ease: Object.keys(config.easings),
    'opacity-step': Object.keys(config.durations),
    'opacity-ease': Object.keys(config.easings),
    stagger: Object.keys(config.staggers),
    distance: Object.keys(config.spaces),
    order: [],
  };
  const issues: string[] = [];
  for (const [index, html] of unitsHtml.entries()) {
    for (const match of html.matchAll(/\sdata-ds-(enter|step|wait|ease|opacity-step|opacity-ease|stagger|distance|order)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
      const attribute = match[1]!.toLowerCase();
      const value = match[2] ?? match[3] ?? match[4]!;
      const names = allowed[attribute!]!;
      if (attribute === 'enter' && value === 'stamp' && config.stampScale === undefined) {
        issues.push('data-ds-enter="stamp" 缺少体系令牌 motion.stampScale（$type: number，$value: 大于 1 的起始放大倍数）');
      }
      if (attribute === 'order') {
        if (!/^-?\d+$/.test(value!)) issues.push(`data-ds-order="${value}" 不是整数`);
      } else if (attribute === 'enter' && value === '') continue;
      else if (!names.includes(value!)) {
        const element = attribute === 'wait' ? `；序列第 ${index + 1} 项，元素：${html.slice(html.lastIndexOf('<', match.index), html.indexOf('>', match.index) + 1)}` : '';
        issues.push(`data-ds-${attribute}="${value}" 不在体系里，可用：${names.join('、') || '（无）'}${element}`);
      }
    }
  }
  return [...new Set(issues)];
}

export function assertChoreography(unitsHtml: string[], tokens: ResolvedTokens): void {
  const issues = validateChoreography(unitsHtml, tokens);
  if (issues.length) throw new BuildError(issues);
}

function choreograph(config: ChoreographyConfig): void {
  const root = document.documentElement;
  const marked = (scope: ParentNode): HTMLElement[] => [...scope.querySelectorAll<HTMLElement>('[data-ds-enter]')];
  const peelMoves: Record<string, string> = {
    'peel-left': 'translateX(-100%)',
    'peel-right': 'translateX(100%)',
    'peel-up': 'translateY(-100%)',
    'peel-down': 'translateY(100%)',
  };
  const style = document.createElement('style');
  style.textContent = '[data-ds-revealed]{opacity:0!important}[data-ds-revealed],[data-ds-revealed] *{visibility:hidden!important;pointer-events:none!important}' +
    '@media print{' + Object.entries(peelMoves).map(([effect, move]) =>
      `[data-ds-enter="${effect}"]{transform:${move}!important;opacity:0!important}[data-ds-enter="${effect}"],[data-ds-enter="${effect}"] *{visibility:hidden!important}`,
    ).join('') + '}';
  document.head.append(style);
  const finalize = (el: HTMLElement): void => {
    const move = peelMoves[el.getAttribute('data-ds-enter') ?? ''];
    if (!move) return;
    el.style.transform = move;
    el.style.opacity = '0';
    el.setAttribute('data-ds-revealed', '');
  };
  if (root.getAttribute('data-render') === 'static' || typeof Element.prototype.animate !== 'function') {
    marked(document).forEach(finalize);
    return;
  }
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const middle = (names: string[], sortBy: (name: string) => number): string | undefined => names.slice().sort((a, b) => sortBy(a) - sortBy(b))[Math.floor((names.length - 1) / 2)];
  const durationNames = Object.keys(config.durations);
  const defaultStep = 'base' in config.durations ? 'base' : middle(durationNames, (name) => config.durations[name]!);
  const shortest = Math.min(...Object.values(config.durations));
  const defaultEase = 'settle' in config.easings ? 'settle' : Object.keys(config.easings)[0]!;
  const defaultDistance = middle(Object.keys(config.spaces), (name) => config.spaces[name]!);
  const staggerValues = Object.values(config.staggers);
  const defaultStagger = staggerValues.length ? Math.min(...staggerValues) : 0;

  const groupOf = (el: Element): Element => el.parentElement?.closest('[data-ds-stagger]') ?? el.closest('[data-ds-unit]') ?? document.body;
  const staggerOf = (container: Element): number => {
    const name = container.getAttribute('data-ds-stagger');
    return name !== null && name in config.staggers ? config.staggers[name]! : defaultStagger;
  };
  const orderOf = (el: Element, fallback: number): number => {
    const value = el.getAttribute('data-ds-order');
    return value !== null && /^-?\d+$/.test(value) ? Number(value) : fallback;
  };

  const offsets = (effect: string, distance: number): string => {
    const moves: Record<string, string> = {
      rise: `translate3d(0, ${distance}px, 0)`,
      fall: `translate3d(0, ${-distance}px, 0)`,
      left: `translate3d(${-distance}px, 0, 0)`,
      right: `translate3d(${distance}px, 0, 0)`,
    };
    return moves[effect] ?? '';
  };

  const active = new WeakMap<Element, Animation[]>();
  const reset = (el: HTMLElement): void => {
    active.get(el)?.forEach((animation) => animation.cancel());
    active.delete(el);
    el.removeAttribute('data-ds-revealed');
  };
  const enter = (el: HTMLElement, delay: number): Animation[] => {
    reset(el);
    const effect = el.getAttribute('data-ds-enter') || 'fade';
    const peel = peelMoves[effect];
    const draw = effect === 'draw-x' || effect === 'draw-y';
    if (draw && reduced) return [];
    const stepName = el.getAttribute('data-ds-step') ?? defaultStep!;
    const easeName = el.getAttribute('data-ds-ease') ?? defaultEase;
    const distanceName = el.getAttribute('data-ds-distance') ?? defaultDistance;
    const duration = reduced ? shortest : (config.durations[stepName] ?? config.durations[defaultStep!]!);
    const easing = config.easings[easeName] ?? config.easings[defaultEase]!;
    const distance = distanceName !== undefined && distanceName in config.spaces ? config.spaces[distanceName]! : 24;
    const move = reduced ? '' : offsets(effect, distance);
    const from: Keyframe = { opacity: 0 };
    const to: Keyframe = { opacity: 1 };
    if (move) {
      from['transform'] = move;
      to['transform'] = 'none';
    }
    const natural = getComputedStyle(el).transform;
    const transform = natural === 'none' ? '' : ` ${natural}`;
    if (draw) {
      el.style.transformOrigin = effect === 'draw-x' ? 'left center' : 'center top';
      delete from.opacity;
      delete to.opacity;
      from.transform = `${effect === 'draw-x' ? 'scaleX(0)' : 'scaleY(0)'}${transform}`;
      to.transform = natural;
    } else if (effect === 'stamp' && !reduced) {
      from.transform = `scale(${config.stampScale})${transform}`;
      to.transform = natural;
    } else if (peel) {
      from.opacity = 1;
      to.opacity = 0;
      if (!reduced) {
        delete from.opacity;
        delete to.opacity;
        from.transform = natural;
        to.transform = `${peel}${transform}`;
      }
    }
    const waitName = el.getAttribute('data-ds-wait');
    const wait = waitName === null ? 0 : (config.durations[waitName] ?? 0);
    const options: KeyframeAnimationOptions = { duration, delay: reduced ? 0 : delay + wait, easing, fill: peel ? 'both' : 'backwards' };
    const opacityStep = el.getAttribute('data-ds-opacity-step') ?? config.opacity?.step ?? stepName;
    const opacityEase = el.getAttribute('data-ds-opacity-ease') ?? config.opacity?.ease ?? easeName;
    const split = !reduced && from.transform !== undefined && (config.opacity !== undefined || el.hasAttribute('data-ds-opacity-step') || el.hasAttribute('data-ds-opacity-ease'));
    const animations: Animation[] = [];
    if (split) {
      delete from.opacity;
      delete to.opacity;
      animations.push(el.animate([from, to], options));
      animations.push(el.animate([{ opacity: peel ? 1 : 0 }, { opacity: peel ? 0 : 1 }], {
        ...options, duration: config.durations[opacityStep]!, easing: config.easings[opacityEase]!,
      }));
    } else animations.push(el.animate([from, to], options));
    active.set(el, animations);
    Promise.all(animations.map((animation) => animation.finished)).then(() => {
      if (peel && active.get(el) === animations) el.setAttribute('data-ds-revealed', '');
    }).catch(() => undefined);
    return animations;
  };

  const play = (elements: HTMLElement[]): Animation[] => {
    const groups = new Map<Element, HTMLElement[]>();
    for (const el of elements) {
      const container = groupOf(el);
      groups.set(container, [...(groups.get(container) ?? []), el]);
    }
    const animations: Animation[] = [];
    for (const [container, members] of groups) {
      const keyed = members.map((el, position) => ({ el, order: orderOf(el, position) }));
      const ranks = [...new Set(keyed.map((item) => item.order))].sort((a, b) => a - b);
      const step = staggerOf(container);
      for (const item of keyed) {
        animations.push(...enter(item.el, ranks.indexOf(item.order) * step));
      }
    }
    return animations;
  };

  if (document.body.getAttribute('data-carrier') === 'slides') {
    document.addEventListener('ds:slide-prepare', (event) => {
      marked(event.target as Element).filter((el) => el.getAttribute('data-ds-enter')?.startsWith('peel-')).forEach(reset);
    });
    const dsSlides = (window as any).dsSlides;
    if (dsSlides && typeof dsSlides.onEnter === 'function') {
      dsSlides.onEnter((slide: Element) => Promise.allSettled(play(marked(slide)).map((animation) => animation.finished)));
    }
    return;
  }

  const pending = marked(document);
  const visible = (el: Element): boolean => {
    const rect = el.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom > 0;
  };
  const inView = pending.filter(visible);
  const later = pending.filter((el) => !inView.includes(el));
  play(inView);
  if (!later.length || typeof IntersectionObserver !== 'function') return;
  const observer = new IntersectionObserver((entries) => {
    const passed = entries.filter((entry) => !entry.isIntersecting && entry.boundingClientRect.bottom <= 0);
    const batch = entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target as HTMLElement);
    passed.forEach((entry) => finalize(entry.target as HTMLElement));
    [...passed.map((entry) => entry.target), ...batch].forEach((el) => observer.unobserve(el));
    if (batch.length) play(batch);
  });
  later.forEach((el) => observer.observe(el));
}

export function buildChoreographyScript(tokens: ResolvedTokens): string {
  return `(${choreograph.toString()})(${JSON.stringify(choreographyConfig(tokens))});`;
}
