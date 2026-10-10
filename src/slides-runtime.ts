/*
 * The slide runtime (放映运行时) as a classic inline script, injected into every slides page by slides-page.ts. No framework; it also runs when the built HTML is opened straight from disk.
 * It fits the fixed 1920x1080 stage to the window (uniform scale, centered), shows one .ds-slide at a time, navigates with ArrowRight/PageDown/Space (next), ArrowLeft/PageUp (previous), Home/End,
 * toggles fullscreen with F, keeps the slide number in the URL hash (#3), and lets the letterbox take the active slide's background color.
 * Choreography contract (for motion work): window.dsSlides.onEnter(fn) registers fn(slideElement, index); it runs every time a slide is entered, the first slide included (after DOMContentLoaded, so
 * scripts that register hooks during load see it). fn may return an Animation or a Promise; dsSlides.entered() resolves when everything the hooks of the current slide returned has finished.
 * The same entry also dispatches the bubbling CustomEvent "ds:slide-enter" on the slide ({detail:{index}}), and "ds:slide-leave" on the slide being left.
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
    var index = Math.max(0, Math.min(slides.length - 1, target));
    if (index === current) return;
    var previous = slides[current];
    if (previous) {
      previous.removeAttribute('data-active');
      previous.setAttribute('aria-hidden', 'true');
      previous.dispatchEvent(new CustomEvent('ds:slide-leave', { bubbles: true, detail: { index: current } }));
    }
    var slide = slides[index];
    current = index;
    slide.setAttribute('data-active', '');
    slide.removeAttribute('aria-hidden');
    backdrop(slide);
    try {
      history.replaceState(null, '', '#' + (index + 1));
    } catch (error) {}
    var results = [];
    hooks.forEach(function (hook) {
      try {
        results.push(hook(slide, index));
      } catch (error) {
        console.error(error);
      }
    });
    slide.dispatchEvent(new CustomEvent('ds:slide-enter', { bubbles: true, detail: { index: index } }));
    entered = Promise.allSettled(results.map(settled));
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
    entered: function () {
      return entered;
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
