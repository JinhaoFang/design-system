/*
 * The slide runtime (放映运行时) as a classic inline script, injected into every slides page by slides-page.ts. No framework; it also runs when the built HTML is opened straight from disk.
 * It fits the fixed 1920x1080 stage to the window (uniform scale, centered), shows one .ds-slide at a time, navigates with ArrowRight/PageDown/Space (next), ArrowLeft/PageUp (previous), Home/End,
 * toggles fullscreen with F, keeps the slide number in the URL hash (#3), and lets the letterbox take the active slide's background color.
 * Choreography contract (for motion work): window.dsSlides.onEnter(fn) registers fn(slideElement, index); it runs every time a slide is entered, the first slide included (after DOMContentLoaded, so
 * scripts that register hooks during load see it). fn may return an Animation or a Promise; dsSlides.entered() resolves after the page turn and all current-slide hooks finish (also follows superseding navigation).
 * The same entry also dispatches the bubbling CustomEvent "ds:slide-enter" on the slide ({detail:{index}}), and "ds:slide-leave" on the slide being left.
 * Optional slides.transition.json references (slides-transition.ts) are substituted for __DS_SLIDES_TRANSITION__ by the page builder. Normal turns animate the incoming wrapper by a full width,
 * the outgoing wrapper by the token retreat, and its shade opacity; the shadow is static. Reduced motion and data-render="static" switch instantly. Initial/hash entry never turns.
 * The synchronous bubbling ds:slide-prepare event ({detail:{index}}) runs before displaying a target; choreography restores peel covers so they stay covering content throughout turns and revisits.
 * Hooks and ds:slide-enter run only after the turn settles; ordinary marked entrance elements stay hidden until then. On rapid navigation the old turn and old-page entrances are canceled,
 * wrappers reset, and the latest requested page turns from the previous requested page. A revision guard prevents stale hooks/cleanup; only the final page starts its entrance.
 * Other API: dsSlides.count, dsSlides.index, dsSlides.go(i), next(), prev(). Print media (PDF) shows all slides stacked at full size; see slides-page.ts.
 */
export const SLIDES_RUNTIME = `(function () {
  var WIDTH = 1920;
  var HEIGHT = 1080;
  var stage = document.querySelector('.ds-stage');
  var slides = Array.prototype.slice.call(document.querySelectorAll('.ds-slide'));
  var hooks = [];
  var current = -1;
  var entered = Promise.resolve();
  var transition = __DS_SLIDES_TRANSITION__;
  var turning = null;
  var revision = 0;

  function cleanTurn(turn) {
    turn.animations.forEach(function (animation) { animation.cancel(); });
    [turn.previous, turn.slide].forEach(function (slide) {
      slide.removeAttribute('data-turning');
      slide.removeAttribute('data-leaving');
      slide.removeAttribute('data-reverse');
    });
    if (turning === turn) turning = null;
  }

  function enter(slide, index) {
    var results = [];
    hooks.forEach(function (hook) {
      try {
        results.push(hook(slide, index));
      } catch (error) {
        console.error(error);
      }
    });
    slide.dispatchEvent(new CustomEvent('ds:slide-enter', { bubbles: true, detail: { index: index } }));
    return Promise.allSettled(results.map(settled));
  }

  function turnPage(previous, slide, direction) {
    var style = getComputedStyle(document.documentElement);
    var duration = parseFloat(style.getPropertyValue(transition.duration));
    if (style.getPropertyValue(transition.duration).trim().endsWith('s') && !style.getPropertyValue(transition.duration).trim().endsWith('ms')) duration *= 1000;
    var easing = style.getPropertyValue(transition.easing).trim();
    var retreat = parseFloat(style.getPropertyValue(transition.retreat));
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return null;
    previous.setAttribute('data-leaving', '');
    slide.setAttribute('data-turning', '');
    if (direction < 0) slide.setAttribute('data-reverse', '');
    var options = { duration: duration, easing: easing, fill: 'both' };
    var animations = [
      slide.animate([{ transform: 'translateX(' + (direction * 100) + '%)' }, { transform: 'none' }], options),
      previous.animate([{ transform: 'none' }, { transform: 'translateX(' + (-direction * retreat) + 'px)' }], options),
      previous.querySelector('.ds-slide-shade').animate([{ opacity: 0 }, { opacity: 1 }], options)
    ];
    animations.forEach(function (animation) { animation.finished.catch(function () {}); });
    return { animations: animations, previous: previous, slide: slide };
  }

  function fit() {
    var scale = Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT);
    stage.style.transform = 'translate(-50%, -50%) scale(' + scale + ')';
  }

  function backdrop(slide) {
    var surface = slide.firstElementChild;
    var color = surface ? getComputedStyle(surface).backgroundColor : '';
    if (color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') document.documentElement.style.background = color;
  }

  function settled(value) {
    return value && value.finished ? value.finished : value;
  }

  function go(target) {
    if (!slides.length || !Number.isFinite(target)) return;
    var index = Math.max(0, Math.min(slides.length - 1, Math.trunc(target)));
    if (index === current) return;
    var ownRevision = ++revision;
    if (turning) cleanTurn(turning);
    var previousIndex = current;
    var previous = slides[current];
    var slide = slides[index];
    if (transition) {
      [previous, slide].forEach(function (item) {
        if (item) item.getAnimations({ subtree: true }).forEach(function (animation) { animation.cancel(); });
      });
    }
    if (previous) {
      previous.removeAttribute('data-active');
      previous.setAttribute('aria-hidden', 'true');
      previous.dispatchEvent(new CustomEvent('ds:slide-leave', { bubbles: true, detail: { index: current } }));
    }
    current = index;
    slide.dispatchEvent(new CustomEvent('ds:slide-prepare', { bubbles: true, detail: { index: index } }));
    slide.setAttribute('data-active', '');
    slide.removeAttribute('aria-hidden');
    backdrop(slide);
    try {
      history.replaceState(null, '', '#' + (index + 1));
    } catch (error) {}
    var turn = transition && previous && document.documentElement.getAttribute('data-render') !== 'static'
      ? turnPage(previous, slide, index > previousIndex ? 1 : -1) : null;
    if (turn) {
      turning = turn;
      entered = Promise.allSettled(turn.animations.map(settled)).then(function () {
        if (ownRevision !== revision) return;
        cleanTurn(turn);
        return enter(slide, index);
      });
    } else {
      entered = enter(slide, index);
    }
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
  }

  var KEYS = {
    ArrowRight: 1,
    PageDown: 1,
    ' ': 1,
    ArrowLeft: -1,
    PageUp: -1
  };

  document.addEventListener('keydown', function (event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key in KEYS) {
      go(current + KEYS[event.key]);
    } else if (event.key === 'Home') {
      go(0);
    } else if (event.key === 'End') {
      go(slides.length - 1);
    } else if (event.key === 'f' || event.key === 'F') {
      toggleFullscreen();
    } else {
      return;
    }
    event.preventDefault();
  });

  window.addEventListener('resize', fit);

  window.dsSlides = {
    count: slides.length,
    get index() {
      return current;
    },
    go: go,
    next: function () {
      go(current + 1);
    },
    prev: function () {
      go(current - 1);
    },
    onEnter: function (hook) {
      hooks.push(hook);
    },
    entered: async function () {
      var waiting;
      do {
        waiting = entered;
        await waiting;
      } while (waiting !== entered);
    }
  };

  function start() {
    fit();
    var wanted = parseInt(location.hash.slice(1), 10);
    go(isNaN(wanted) ? 0 : wanted - 1);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();`;
