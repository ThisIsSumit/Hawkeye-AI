import { useLayoutEffect, type RefObject } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);

/**
 * GSAP ScrollTrigger motion for the HawkEye landing page.
 *
 * Rules the whole file follows:
 *  - Scroll animation is always `scrub: true` with `ease: 'none'` (or a symmetric
 *    ease for hand-overs), so an element is exactly where the scrollbar says it
 *    is. Nothing enters early, leaves late, or keeps moving after you stop.
 *  - Pinned acts are CSS-sticky tracks. Their timeline is `span` long, where one
 *    unit equals one viewport height of scrolling, so positions read as "scroll
 *    distance after the act pinned".
 *  - Hand-overs share the same position, duration and a symmetric ease
 *    (power2.inOut), so the outgoing and incoming opacities always sum to 1.
 *  - Scroll, pointer and intro tweens never touch the same property on the same
 *    element: scroll uses y / yPercent / scale / rotation, the pointer uses x / y
 *    on inner layers, tilt uses rotationX / rotationY.
 */

const LINE = 'rgba(189, 222, 208, 0.14)';
const SIGNAL = '#c8f36a';
const INK = '#edf1ed';
const DIM = '#2f3d3a';

const all = <T extends Element = HTMLElement>(scope: ParentNode | null, sel: string) =>
  scope ? Array.from(scope.querySelectorAll<T>(sel)) : [];
const one = <T extends Element = HTMLElement>(scope: ParentNode | null, sel: string) =>
  scope ? scope.querySelector<T>(sel) : null;

/** Scrubbed fade/slide up while an element crosses the viewport. */
function rise(el: Element | null, y = 28, start = 'top 94%', end = 'top 64%') {
  if (!el) return;
  gsap.fromTo(
    el,
    { y, opacity: 0 },
    { y: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: el, start, end, scrub: true } },
  );
}

/** Timeline for a pinned act. One time unit = one viewport height of scroll after the pin. */
function actTimeline(act: Element, span: number) {
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: act, start: 'top top', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true },
  });
  tl.set({}, {}, span); // fixes the timeline length to the act's span
  return tl;
}

/** Timeline for the approach to a pinned act, before it reaches the top. */
function approachTimeline(act: Element, from = 'top 85%') {
  return gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: act, start: from, end: 'top top', scrub: true },
  });
}

/* ------------------------------------------------------------------ */
/* Scroll acts                                                         */
/* ------------------------------------------------------------------ */

function nav(root: HTMLElement) {
  const bar = one(root, '.landing-nav');
  if (!bar) return;
  gsap.from(bar, { y: -24, opacity: 0, duration: 0.8, ease: 'power3.out' });
  // Hides on the way down, returns the instant you scroll back up.
  const hide = gsap.to(bar, { yPercent: -110, duration: 0.35, ease: 'power2.out', paused: true });
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      if (self.direction === 1 && self.scroll() > 160) hide.play();
      else if (self.direction === -1) hide.reverse();
    },
  });
}

/** Signature move: one thread, the length of the page, tracks where you are. */
function thread(root: HTMLElement) {
  const rail = one(root, '.thread');
  if (!rail) return;
  const trigger = { trigger: root, start: 'top top', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true };
  gsap.fromTo(one(rail, '.thread__fill'), { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: trigger });
  gsap.fromTo(one(rail, '.thread__dot'), { y: 0 }, { y: () => rail.offsetHeight, ease: 'none', scrollTrigger: trigger });
}

function hero(root: HTMLElement, splits: SplitText[]) {
  const act = one(root, '.hero-act');
  const copy = one(act, '.hero-copy');
  const surface = one(act, '.hero-surface');
  if (!act || !copy || !surface) return;
  const SPAN = 2;

  // Load intro (the only time-based motion): headline characters rise in.
  const h1 = one(copy, 'h1');
  if (h1) {
    const s = SplitText.create(h1, { type: 'lines,chars', charsClass: 'ch', aria: 'auto' });
    splits.push(s);
    gsap.set(h1, { autoAlpha: 1 });
    gsap
      .timeline({ defaults: { ease: 'power3.out' } })
      .from(s.chars, { yPercent: 115, rotate: 8, opacity: 0, duration: 1, stagger: 0.03 }, 0.1)
      .from(all(copy, '.eyebrow, .hero-lede, .hero-actions, .hero-note'), { yPercent: 40, opacity: 0, duration: 0.8, stagger: 0.1 }, 0.25)
      .from(all(act, '.hero-grid, .hero-glow, .hero-orbit'), { opacity: 0, duration: 1.2, ease: 'none' }, 0);
  }

  const tl = actTimeline(act, SPAN);

  // Headline layers leave at different speeds (depth), then hand over to the product.
  tl.to(one(copy, '.eyebrow'), { y: -16, duration: 0.95 }, 0)
    .to(one(copy, 'h1'), { y: -70, duration: 0.95 }, 0)
    .to(one(copy, '.hero-lede'), { y: -44, duration: 0.95 }, 0)
    .to(one(copy, '.hero-actions'), { y: -26, duration: 0.95 }, 0)
    .to(one(copy, '.hero-note'), { y: -10, duration: 0.95 }, 0);

  // Hand-over: same position, duration and symmetric ease => opacities sum to 1.
  tl.to(copy, { y: -48, opacity: 0, ease: 'power2.inOut', duration: 0.4 }, 0.55);
  tl.fromTo(surface, { y: 80, opacity: 0, scale: 0.94 }, { y: 0, opacity: 1, scale: 1, ease: 'power2.inOut', duration: 0.4 }, 0.55);
  tl.fromTo(
    surface,
    { rotationY: -5, transformPerspective: 1200, transformOrigin: 'right center' },
    { rotationY: 0, duration: 1.45 },
    0.55,
  );

  // The product assembles piece by piece, each piece starting as the last one ends.
  tl.from(all(surface, '.surface-metrics > div'), { y: 16, opacity: 0, stagger: 0.06, duration: 0.2, ease: 'power2.out' }, 0.95)
    .from(one(surface, '.surface-chart'), { y: 16, opacity: 0, duration: 0.25, ease: 'power2.out' }, 1.2)
    .from(one(surface, '.surface-alerts'), { y: 16, opacity: 0, duration: 0.25, ease: 'power2.out' }, 1.25)
    .from(all(surface, '.event-row'), { x: 12, opacity: 0, stagger: 0.05, duration: 0.15, ease: 'power2.out' }, 1.35)
    .from(one(surface, '.trace-drawer'), { y: 12, opacity: 0, duration: 0.25, ease: 'power2.out' }, 1.45);

  // The chart draws itself with the scrollbar.
  const line = one(surface, '.chart-line');
  const threat = one(surface, '.chart-threat');
  gsap.set([line, threat], { strokeDasharray: 1 });
  tl.fromTo(one(surface, '.chart-fill'), { opacity: 0 }, { opacity: 1, duration: 0.5 }, 1.2)
    .fromTo(line, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.5 }, 1.2)
    .fromTo(threat, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.5 }, 1.3);

  // Background and foreground planes.
  tl.to(one(act, '.hero-grid'), { yPercent: -8, duration: SPAN }, 0)
    .fromTo(one(act, '.hero-glow'), { scale: 0.75 }, { scale: 1.35, duration: 1 }, 0)
    .to(one(act, '.hero-orbit--one'), { rotation: 8, duration: SPAN }, 0)
    .to(one(act, '.hero-orbit--two'), { rotation: -44, duration: SPAN }, 0);
  const sparkTravel = [-240, -150, -320, -200, -280, -120];
  all(act, '.spark').forEach((spark, i) => tl.to(spark, { y: sparkTravel[i % sparkTravel.length], duration: SPAN }, 0));
}

function surfaceIntro(root: HTMLElement, splits: SplitText[]) {
  const sec = one(root, '#surface');
  if (!sec) return;

  const rule = one(sec, '.section-rule');
  gsap.fromTo(
    rule,
    { scaleX: 0, transformOrigin: 'left center' },
    { scaleX: 1, ease: 'none', scrollTrigger: { trigger: rule, start: 'top 96%', end: 'top 72%', scrub: true } },
  );
  rise(one(sec, '.eyebrow'), 24, 'top 94%', 'top 70%');

  const h2 = one(sec, 'h2');
  if (h2) {
    const s = SplitText.create(h2, { type: 'lines,words', mask: 'lines', aria: 'auto' });
    splits.push(s);
    gsap.fromTo(
      s.words,
      { yPercent: 115 },
      { yPercent: 0, ease: 'none', stagger: 0.1, duration: 0.4, scrollTrigger: { trigger: h2, start: 'top 92%', end: 'top 48%', scrub: true } },
    );
  }

  const body = one(sec, '.body-copy');
  if (body) {
    const s = SplitText.create(body, { type: 'lines', mask: 'lines', aria: 'auto' });
    splits.push(s);
    gsap.fromTo(
      s.lines,
      { yPercent: 110, opacity: 0 },
      { yPercent: 0, opacity: 1, ease: 'none', stagger: 0.12, duration: 0.4, scrollTrigger: { trigger: body, start: 'top 94%', end: 'top 58%', scrub: true } },
    );
  }
  rise(one(sec, '.inline-link'), 20, 'top 94%', 'top 66%');
}

function method(root: HTMLElement, splits: SplitText[]) {
  const act = one(root, '#method');
  if (!act) return;
  const SPAN = 1.6;

  // Approach: heading assembles as the act scrolls into place.
  const head = one(act, '.capability-heading');
  const h2 = one(head, 'h2');
  const approach = approachTimeline(act);
  approach.from(one(head, '.eyebrow'), { y: 20, opacity: 0, duration: 0.4 }, 0);
  if (h2) {
    const s = SplitText.create(h2, { type: 'lines', mask: 'lines', aria: 'auto' });
    splits.push(s);
    approach.fromTo(s.lines, { yPercent: 110 }, { yPercent: 0, stagger: 0.25, duration: 0.6 }, 0.1);
  }

  // Pinned: use distinct slots so a card is fully read before the next one
  // begins. The text reveal and the card transition share the same slot start.
  const tl = actTimeline(act, SPAN);
  const items = all(act, '.capability-item');
  const slot = 0.5;
  items.forEach((item, i) => {
    const a = 0.08 + i * slot;
    const cardTitle = one(item, 'h3');
    const cardCopy = one(item, 'p');
    const titleSplit = cardTitle
      ? SplitText.create(cardTitle, { type: 'chars', charsClass: 'typewriter-char', aria: 'auto' })
      : null;
    const copySplit = cardCopy
      ? SplitText.create(cardCopy, { type: 'chars', charsClass: 'typewriter-char', aria: 'auto' })
      : null;
    if (titleSplit) splits.push(titleSplit);
    if (copySplit) splits.push(copySplit);
    tl.fromTo(item, { x: 64, opacity: 0, scale: 0.96 }, { x: 0, opacity: 1, scale: 1, ease: 'power2.inOut', duration: 0.24 }, a)
      .fromTo(item, { borderTopColor: LINE }, { borderTopColor: SIGNAL, duration: 0.24 }, a)
      .fromTo(one(item, '.cap-icon'), { scale: 0.5, rotation: -50 }, { scale: 1, rotation: 0, ease: 'power2.out', duration: 0.24 }, a)
      .fromTo(one(item, '.capability-index'), { opacity: 0, x: -12 }, { opacity: 1, x: 0, duration: 0.25 }, a + 0.04)
      .fromTo(all(item, 'svg')[1] ?? null, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.25 }, a + 0.12)
      .fromTo(titleSplit?.chars ?? [], { opacity: 0, yPercent: 45 }, { opacity: 1, yPercent: 0, ease: 'none', stagger: 0.018, duration: 0.2 }, a + 0.06)
      .fromTo(copySplit?.chars ?? [], { opacity: 0, yPercent: 45 }, { opacity: 1, yPercent: 0, ease: 'none', stagger: 0.012, duration: 0.22 }, a + 0.12);
    if (i < items.length - 1) {
      const nextStart = a + slot;
      tl.to(item, { opacity: 0.4, scale: 0.98, ease: 'power2.inOut', duration: 0.14 }, nextStart + 0.24);
    }
  });
  tl.fromTo(one(act, '.capability-rail i'), { scaleY: 0 }, { scaleY: 1, duration: 1.25 }, 0.1);
}

function quote(root: HTMLElement, splits: SplitText[]) {
  const sec = one(root, '.quote-section');
  if (!sec) return;

  const pulse = one(sec, '.quote-pulse');
  gsap.fromTo(
    all(pulse, 'span'),
    { scale: 0.3, opacity: 0 },
    { scale: 1, opacity: 1, ease: 'none', stagger: 0.15, duration: 0.4, scrollTrigger: { trigger: pulse, start: 'top 96%', end: 'top 72%', scrub: true } },
  );
  rise(one(sec, '.eyebrow'), 16, 'top 94%', 'top 72%');

  // Kinetic type: every word lights as it climbs the screen.
  const bq = one(sec, 'blockquote');
  if (bq) {
    const s = SplitText.create(bq, { type: 'words', aria: 'auto' });
    splits.push(s);
    gsap.fromTo(
      s.words,
      { color: DIM },
      { color: INK, ease: 'none', stagger: 0.1, duration: 0.3, scrollTrigger: { trigger: bq, start: 'top 88%', end: 'bottom 50%', scrub: true } },
    );
  }
  rise(one(sec, '.quote-caption'), 16, 'top 98%', 'top 78%');
}

function access(root: HTMLElement, splits: SplitText[]) {
  const act = one(root, '#access');
  if (!act) return;

  const h2 = one(act, 'h2');
  const approach = approachTimeline(act, 'top 80%');
  approach
    .fromTo(all(act, '.access-panel__signal span'), { scaleY: 0 }, { scaleY: 1, stagger: 0.1, duration: 0.6 }, 0)
    .from(one(act, '.eyebrow'), { y: 24, opacity: 0, duration: 0.4 }, 0.2);
  if (h2) {
    const s = SplitText.create(h2, { type: 'lines', mask: 'lines', aria: 'auto' });
    splits.push(s);
    approach.fromTo(s.lines, { yPercent: 110 }, { yPercent: 0, stagger: 0.2, duration: 0.5 }, 0.35);
  }

  gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: act, start: 'top 80%', end: 'bottom 55%', scrub: true },
  })
    .from(one(act, '.body-copy'), { y: 24, opacity: 0, duration: 0.4 }, 0)
    .from(one(act, '.magnet'), { y: 20, opacity: 0, duration: 0.4 }, 0.15)
    .from(one(act, '.access-note'), { y: 16, opacity: 0, duration: 0.4 }, 0.3);
}

function footer(root: HTMLElement) {
  const el = one(root, '.landing-footer');
  if (!el) return;
  // Ends at the bottom of the page, which is always reachable.
  gsap.from(Array.from(el.children), {
    y: 20,
    opacity: 0,
    ease: 'none',
    stagger: 0.1,
    scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom bottom', scrub: true },
  });
}

/* ------------------------------------------------------------------ */
/* Pointer                                                             */
/* ------------------------------------------------------------------ */

function pointer(root: HTMLElement): () => void {
  const off: Array<() => void> = [];
  const listen = (target: EventTarget, type: string, fn: (e: PointerEvent) => void) => {
    target.addEventListener(type, fn as EventListener, { passive: true });
    off.push(() => target.removeEventListener(type, fn as EventListener));
  };

  // Cursor ring, grows over anything clickable.
  const ring = one(root, '.cursor');
  if (ring) {
    const xTo = gsap.quickTo(ring, 'x', { duration: 0.35, ease: 'power3' });
    const yTo = gsap.quickTo(ring, 'y', { duration: 0.35, ease: 'power3' });
    let shown = false;
    listen(window, 'pointermove', (e) => {
      xTo(e.clientX);
      yTo(e.clientY);
      if (!shown) {
        shown = true;
        gsap.to(ring, { opacity: 1, duration: 0.3 });
      }
    });
    listen(root, 'pointerover', (e) => {
      if ((e.target as Element).closest('a, button')) {
        gsap.to(ring, { scale: 1.9, backgroundColor: 'rgba(200, 243, 106, 0.12)', duration: 0.25, overwrite: 'auto' });
      }
    });
    listen(root, 'pointerout', (e) => {
      if ((e.target as Element).closest('a, button')) {
        gsap.to(ring, { scale: 1, backgroundColor: 'rgba(200, 243, 106, 0)', duration: 0.25, overwrite: 'auto' });
      }
    });
  }

  // Depth: every [data-depth] layer drifts with the cursor, far layers against it, near layers with it.
  const layers = all(root, '[data-depth]').map((el) => ({
    d: Number(el.dataset.depth) || 0,
    x: gsap.quickTo(el, 'x', { duration: 0.9, ease: 'power3' }),
    y: gsap.quickTo(el, 'y', { duration: 0.9, ease: 'power3' }),
  }));
  if (layers.length) {
    listen(window, 'pointermove', (e) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      layers.forEach((l) => {
        l.x(nx * l.d);
        l.y(ny * l.d);
      });
    });
  }

  // Tilt + spotlight: [data-tilt="amplitude"] leans toward the cursor and lights up under it.
  all(root, '[data-tilt]').forEach((el) => {
    const amp = Number(el.dataset.tilt) || 4;
    gsap.set(el, { transformPerspective: 900 });
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.5, ease: 'power3' });
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.5, ease: 'power3' });
    listen(el, 'pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
      ry(nx * amp);
      rx(-ny * amp);
      el.style.setProperty('--mx', `${(e.clientX - r.left).toFixed(0)}px`);
      el.style.setProperty('--my', `${(e.clientY - r.top).toFixed(0)}px`);
    });
    listen(el, 'pointerleave', () => {
      rx(0);
      ry(0);
    });
  });

  // Spotlight only (no tilt).
  all(root, '[data-spot]').forEach((el) => {
    listen(el, 'pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${(e.clientX - r.left).toFixed(0)}px`);
      el.style.setProperty('--my', `${(e.clientY - r.top).toFixed(0)}px`);
    });
  });

  // Magnet: the element leans toward the cursor when it is close.
  all(root, '[data-magnet]').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3' });
    listen(window, 'pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2 - (gsap.getProperty(el, 'x') as number);
      const cy = r.top + r.height / 2 - (gsap.getProperty(el, 'y') as number);
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const near = Math.hypot(dx, dy) < 120;
      xTo(near ? gsap.utils.clamp(-14, 14, dx * 0.3) : 0);
      yTo(near ? gsap.utils.clamp(-10, 10, dy * 0.3) : 0);
    });
  });

  // Text: headline characters are pushed away from the cursor and spring back.
  const h1 = one(root, '.hero-copy h1');
  const chars = all(root, '.hero-copy h1 .ch');
  if (h1 && chars.length) {
    listen(h1, 'pointermove', (e) => {
      chars.forEach((c) => {
        const r = c.getBoundingClientRect();
        const cx = r.left + r.width / 2 - (gsap.getProperty(c, 'x') as number);
        const cy = r.top + r.height / 2 - (gsap.getProperty(c, 'y') as number);
        const dx = cx - e.clientX;
        const dy = cy - e.clientY;
        const dist = Math.hypot(dx, dy) || 1;
        const f = Math.max(0, 1 - dist / 130);
        gsap.to(c, { x: (dx / dist) * f * 26, y: (dy / dist) * f * 26, rotation: (dx / dist) * f * 8, duration: 0.4, ease: 'power3.out', overwrite: 'auto' });
      });
    });
    listen(h1, 'pointerleave', () => {
      gsap.to(chars, { x: 0, y: 0, rotation: 0, duration: 0.8, ease: 'elastic.out(1, 0.4)', overwrite: 'auto' });
    });
  }

  return () => off.forEach((fn) => fn());
}

/* ------------------------------------------------------------------ */

export function useLandingMotion(rootRef: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const mm = gsap.matchMedia();
    mm.add(
      { motion: '(prefers-reduced-motion: no-preference)', fine: '(pointer: fine)' },
      (ctx) => {
        const { motion, fine } = ctx.conditions as { motion?: boolean; fine?: boolean };
        if (!motion) {
          // Reduced motion: no pinning, no scrub, everything simply visible.
          root.setAttribute('data-static', '');
          return () => root.removeAttribute('data-static');
        }
        root.removeAttribute('data-static');

        let dead = false;
        const splits: SplitText[] = [];
        let stopPointer: (() => void) | undefined;
        let stopMotion: (() => void) | undefined;

        // Split text only once the web fonts are in, or the lines would wrap wrongly.
        document.fonts.ready.then(() => {
          if (dead) return;
          const motionContext = gsap.context(() => {
            nav(root);
            thread(root);
            hero(root, splits);
            surfaceIntro(root, splits);
            method(root, splits);
            quote(root, splits);
            access(root, splits);
            footer(root);
            gsap.set(all(root, '[data-split]'), { autoAlpha: 1 });
            if (fine) stopPointer = pointer(root);
            ScrollTrigger.refresh();
          }, root);
          stopMotion = () => motionContext.revert();
        });

        return () => {
          dead = true;
          stopPointer?.();
          stopMotion?.();
          stopMotion = undefined;
          splits.length = 0;
        };
      },
    );
    return () => mm.revert();
  }, [rootRef]);
}