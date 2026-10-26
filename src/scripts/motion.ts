/**
 * Site-wide entrance motion, added 2026-10-27 when the client asked for the
 * pages to feel less static.
 *
 * - `[data-stagger]`: the element's children rise in one after another the
 *   first time the group scrolls into view.
 * - `[data-count]`: every number in the element's text counts up from zero,
 *   keeping its decimals, grouping and any text around it ("₹48", "150–300").
 *
 * Nothing is hidden until this script has run (`html.motion-ready` gates the
 * hidden state), and reduced-motion visitors get the final state at once.
 */

const NUMBER = /\d[\d,]*(?:\.\d+)?/g;

function countUp(el: HTMLElement): void {
  const text = el.dataset.countText ?? el.textContent ?? '';
  el.dataset.countText = text;
  const parts = [...text.matchAll(NUMBER)].map((m) => {
    const raw = m[0];
    return {
      raw,
      value: Number(raw.replace(/,/g, '')),
      decimals: raw.includes('.') ? raw.split('.')[1]!.length : 0,
      grouped: raw.includes(','),
    };
  });
  if (parts.length === 0) return;
  // Hold the final width so the line does not jitter while the digits change.
  el.style.minWidth = `${el.getBoundingClientRect().width}px`;
  el.style.display = 'inline-block';
  const start = performance.now();
  const duration = 1400;
  const frame = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 4);
    let i = 0;
    el.textContent = text.replace(NUMBER, () => {
      const part = parts[i++]!;
      const current = part.value * eased;
      return current.toLocaleString('en-IN', {
        minimumFractionDigits: part.decimals,
        maximumFractionDigits: part.decimals,
        useGrouping: part.grouped,
      });
    });
    if (t < 1) requestAnimationFrame(frame);
    else el.textContent = text;
  };
  requestAnimationFrame(frame);
}

function mountMotion(): void {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) return;
  document.documentElement.classList.add('motion-ready');

  const groups = document.querySelectorAll<HTMLElement>('[data-stagger]:not([data-motion])');
  const counters = document.querySelectorAll<HTMLElement>('[data-count]:not([data-motion])');

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target as HTMLElement;
        io.unobserve(el);
        if (el.hasAttribute('data-count')) countUp(el);
        else {
          el.classList.add('is-shown');
          // Hand the children back their own transitions once they have landed.
          window.setTimeout(() => el.classList.add('is-settled'), el.children.length * 90 + 900);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
  );

  groups.forEach((group) => {
    group.dataset.motion = 'on';
    [...group.children].forEach((child, i) =>
      (child as HTMLElement).style.setProperty('--stagger-i', String(i))
    );
    io.observe(group);
  });
  counters.forEach((counter) => {
    counter.dataset.motion = 'on';
    io.observe(counter);
  });
}

mountMotion();
document.addEventListener('astro:page-load', mountMotion);
