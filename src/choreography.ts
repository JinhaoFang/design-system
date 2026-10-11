/*
 * Entrance choreography helper (入场编排): a declarative way for layouts (.liquid) and custom fragments to stage entrances using only the system's motion values.
 * Authoring API (plain data attributes in the layout or fragment HTML):
 *   data-ds-enter="fade|rise|fall|left|right"   mark an element to enter; rise/fall/left/right add a short displacement on top of the fade (empty value = fade).
 *   data-ds-order="<n>"                         position in the sequence of its group (default: document order); equal numbers enter together.
 *   data-ds-stagger="<name>"                    on a group container: the --ds-stagger-<name> step between members (default: the smallest stagger step, 0 if the system has none).
 *   data-ds-step="<name>"                       duration step --ds-duration-<name> (default: base, else the middle step).
 *   data-ds-ease="<name>"                       easing --ds-easing-<name> (default: settle, else the first one).
 *   data-ds-distance="<name>"                   displacement --ds-space-<name> (default: the middle space step).
 * A group is the nearest ancestor with data-ds-stagger, else the enclosing unit section. Durations, easings, stagger and distances all come from the resolved tokens, embedded into the script at build time;
 * unknown names are rejected by validateChoreography (a BuildError before rendering).
 * Runtime (buildChoreographyScript, a classic inline script placed after the page content): animates with element.animate from (opacity 0, offset) to the natural CSS state, fill "backwards" only, so the
 * element is in its normal state once the animation ends or is finished (stills). Web: elements in view on load enter together; the others enter in batches when scrolled into view (IntersectionObserver); elements scrolled past without being seen are left alone.
 * Under html[data-render="static"] it does nothing (content is shown immediately). Slides: registers window.dsSlides.onEnter and enters the marked elements of each slide when it is entered, returning
 * a promise for dsSlides.entered(). Under prefers-reduced-motion: reduce it drops the displacement and the stagger and keeps only a fade of the shortest duration step.
 */
import type { ResolvedTokens } from './tokens.ts';
import { BuildError } from './types.ts';

export interface ChoreographyConfig {
  durations: Record<string, number>;
  staggers: Record<string, number>;
  easings: Record<string, string>;
  spaces: Record<string, number>;
}

const EFFECTS = ['fade', 'rise', 'fall', 'left', 'right'];

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
  };
}

export function validateChoreography(unitsHtml: string[], tokens: ResolvedTokens): string[] {
  const config = choreographyConfig(tokens);
  const allowed: Record<string, string[]> = {
    enter: EFFECTS,
    step: Object.keys(config.durations),
    ease: Object.keys(config.easings),
    stagger: Object.keys(config.staggers),
    distance: Object.keys(config.spaces),
    order: [],
  };
  const issues: string[] = [];
  for (const html of unitsHtml) {
    for (const [, attribute, value] of html.matchAll(/\sdata-ds-(enter|step|ease|stagger|distance|order)="([^"]*)"/g)) {
      const names = allowed[attribute!]!;
      if (attribute === 'order') {
        if (!/^-?\d+$/.test(value!)) issues.push(`data-ds-order="${value}" 不是整数`);
      } else if (attribute === 'enter' && value === '') continue;
      else if (!names.includes(value!)) {
        issues.push(`data-ds-${attribute}="${value}" 不在体系里，可用：${names.join('、') || '（无）'}`);
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
  if (root.getAttribute('data-render') === 'static') return;
  if (typeof Element.prototype.animate !== 'function') return;
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

  const enter = (el: Element, delay: number): Animation => {
    const effect = el.getAttribute('data-ds-enter') || 'fade';
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
    const animation = el.animate([from, to], { duration, delay: reduced ? 0 : delay, easing, fill: 'backwards' });
    animation.finished.catch(() => undefined);
    return animation;
  };

  const play = (elements: Element[]): Animation[] => {
    const groups = new Map<Element, Element[]>();
    for (const el of elements) {
      const container = groupOf(el);
      groups.set(container, [...(groups.get(container) ?? []), el]);
    }
    const animations: Animation[] = [];
    for (const [container, members] of groups) {
      const keyed = members.map((el, position) => ({ el, order: orderOf(el, position) }));
      const ranks = [...new Set(keyed.map((item) => item.order))].sort((a, b) => a - b);
      const step = staggerOf(container);
      for (const item of keyed) animations.push(enter(item.el, ranks.indexOf(item.order) * step));
    }
    return animations;
  };

  const marked = (scope: ParentNode): Element[] => [...scope.querySelectorAll('[data-ds-enter]')];

  if (document.body.getAttribute('data-carrier') === 'slides') {
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
    const batch = entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target);
    [...passed.map((entry) => entry.target), ...batch].forEach((el) => observer.unobserve(el));
    if (batch.length) play(batch);
  });
  later.forEach((el) => observer.observe(el));
}

export function buildChoreographyScript(tokens: ResolvedTokens): string {
  return `(${choreograph.toString()})(${JSON.stringify(choreographyConfig(tokens))});`;
}
