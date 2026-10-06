// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { initAnnouncementBars, teardownAnnouncementBars } from '../announcement-bar';

const INTERVAL = 18000;

/**
 * jsdom has no `matchMedia`; the module reads it twice — reduced motion at
 * init and the hover check for the hover-hold listeners — so it is stubbed on
 * `window` before init, with per-test matchers.
 */
function stubMatchMedia(matcher: (query: string) => boolean): void {
  // jsdom has no matchMedia; the fake satisfies the one member the module
  // reads (`matches`) plus the MQL surface it never listens to, and the cast
  // names that MQL shape instead of fabricating it at the assignment.
  const stub = ((query: string) => ({
    matches: matcher(query),
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false;
    },
  })) as unknown as typeof window.matchMedia;
  window.matchMedia = stub;
}

function activeText(): string {
  return document.querySelector('[data-announcement-message].is-active')?.textContent?.trim() ?? '';
}

interface Fixture {
  bar: HTMLElement;
  live: HTMLElement;
  messages: HTMLElement[];
  prev: HTMLButtonElement;
  pause: HTMLButtonElement;
  next: HTMLButtonElement;
  dismiss: HTMLButtonElement;
}

/**
 * The markup the component renders, minus Astro/Icon decoration: only the
 * data attributes and the initial `is-active` the script depends on.
 */
function mountBar({ count = 4, reducedMotion = false, hover = false } = {}): Fixture {
  stubMatchMedia((query) => {
    if (query.includes('prefers-reduced-motion')) return reducedMotion;
    if (query === '(hover: hover)') return hover;
    return false;
  });

  const messages = Array.from(
    { length: count },
    (_, index) =>
      `<a href="#m${index}" data-announcement-message${
        index === 0 ? ' class="is-active"' : ''
      }>Message ${index}</a>`
  ).join('');

  document.body.innerHTML = `
    <aside data-announcement-bar data-interval="${INTERVAL}" data-storage-key="tq-announcement-test">
      <div data-announcement-live aria-live="off">${messages}</div>
      <div role="group">
        <button type="button" data-announcement-prev></button>
        <button type="button" data-announcement-pause aria-pressed="false" aria-label="Pause announcements">
          <span data-announcement-pause-icon></span>
          <span data-announcement-play-icon hidden></span>
        </button>
        <button type="button" data-announcement-next></button>
      </div>
      <button type="button" data-announcement-dismiss></button>
    </aside>`;

  const bar = document.querySelector<HTMLElement>('[data-announcement-bar]')!;
  return {
    bar,
    live: bar.querySelector<HTMLElement>('[data-announcement-live]')!,
    messages: [...bar.querySelectorAll<HTMLElement>('[data-announcement-message]')],
    prev: bar.querySelector<HTMLButtonElement>('[data-announcement-prev]')!,
    pause: bar.querySelector<HTMLButtonElement>('[data-announcement-pause]')!,
    next: bar.querySelector<HTMLButtonElement>('[data-announcement-next]')!,
    dismiss: bar.querySelector<HTMLButtonElement>('[data-announcement-dismiss]')!,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  document.documentElement.removeAttribute('data-announcement-dismissed');
  sessionStorage.clear();
});

afterEach(() => {
  teardownAnnouncementBars();
  vi.useRealTimers();
  // Drop the own property the stub shadowed so later files see jsdom's real
  // matchMedia again.
  Reflect.deleteProperty(window, 'matchMedia');
});

describe('announcement bar rotation', () => {
  test('advances one message per interval and wraps at the end', () => {
    const { messages } = mountBar();
    initAnnouncementBars();

    expect(messages[0].classList.contains('is-active')).toBe(true);
    vi.advanceTimersByTime(INTERVAL);
    expect(activeText()).toBe('Message 1');
    vi.advanceTimersByTime(INTERVAL);
    expect(activeText()).toBe('Message 2');
    vi.advanceTimersByTime(INTERVAL * 2);
    expect(activeText()).toBe('Message 0');
  });

  test('never arms a timer for a single message', () => {
    mountBar({ count: 1 });
    initAnnouncementBars();
    vi.advanceTimersByTime(INTERVAL * 3);
    expect(activeText()).toBe('Message 0');
  });

  test('does not rotate when reduced motion is preferred', () => {
    mountBar({ reducedMotion: true });
    initAnnouncementBars();
    vi.advanceTimersByTime(INTERVAL * 3);
    expect(activeText()).toBe('Message 0');
  });

  test('a second init does not arm a second timer', () => {
    const { messages } = mountBar();
    initAnnouncementBars();
    initAnnouncementBars();
    vi.advanceTimersByTime(INTERVAL);
    expect(messages.findIndex((m) => m.classList.contains('is-active'))).toBe(1);
  });
});

describe('announcement bar holds', () => {
  test('focus holds rotation and focusout resumes it', () => {
    const { bar, messages } = mountBar();
    initAnnouncementBars();

    messages[0].focus();
    expect(bar.querySelector('[data-announcement-live]')!.getAttribute('aria-live')).toBe('polite');
    vi.advanceTimersByTime(INTERVAL * 2);
    expect(activeText()).toBe('Message 0');

    messages[0].blur();
    vi.advanceTimersByTime(INTERVAL);
    expect(activeText()).toBe('Message 1');
  });

  test('a press released outside the bar resumes rotation', () => {
    const { bar } = mountBar();
    initAnnouncementBars();

    // Pointer goes down on the bar; the release lands over the page hero, so
    // only the window-level `pointerup` can end the hold.
    bar.dispatchEvent(new Event('pointerdown'));
    vi.advanceTimersByTime(INTERVAL * 2);
    expect(activeText()).toBe('Message 0');

    window.dispatchEvent(new Event('pointerup'));
    vi.advanceTimersByTime(INTERVAL);
    expect(activeText()).toBe('Message 1');
  });

  test('a press interrupted by a tab switch resumes after window blur', () => {
    const { bar } = mountBar();
    initAnnouncementBars();

    bar.dispatchEvent(new Event('pointerdown'));
    vi.advanceTimersByTime(INTERVAL * 2);
    expect(activeText()).toBe('Message 0');

    window.dispatchEvent(new Event('blur'));
    vi.advanceTimersByTime(INTERVAL);
    expect(activeText()).toBe('Message 1');
  });

  test('a stray release without a hold does not disturb rotation', () => {
    mountBar();
    initAnnouncementBars();

    window.dispatchEvent(new Event('pointerup'));
    window.dispatchEvent(new Event('blur'));
    vi.advanceTimersByTime(INTERVAL);
    expect(activeText()).toBe('Message 1');
  });

  test('hover holds and mouseleave releases, only where hover is real', () => {
    const { bar } = mountBar({ hover: true });
    initAnnouncementBars();

    bar.dispatchEvent(new Event('mouseenter'));
    vi.advanceTimersByTime(INTERVAL * 2);
    expect(activeText()).toBe('Message 0');

    bar.dispatchEvent(new Event('mouseleave'));
    vi.advanceTimersByTime(INTERVAL);
    expect(activeText()).toBe('Message 1');
  });

  test('hover never holds on a touch screen', () => {
    const { bar } = mountBar({ hover: false });
    initAnnouncementBars();

    bar.dispatchEvent(new Event('mouseenter'));
    vi.advanceTimersByTime(INTERVAL);
    expect(activeText()).toBe('Message 1');
  });
});

describe('announcement bar controls', () => {
  test('next and prev step and wrap, and arm the live region', () => {
    const { live, messages, prev, next } = mountBar();
    initAnnouncementBars();

    next.click();
    expect(activeText()).toBe('Message 1');
    expect(live.getAttribute('aria-live')).toBe('polite');

    next.click();
    next.click();
    expect(activeText()).toBe('Message 3');

    prev.click();
    expect(activeText()).toBe('Message 2');
    prev.click();
    prev.click();
    prev.click();
    expect(messages.findIndex((m) => m.classList.contains('is-active'))).toBe(3);
  });

  test('pause holds, resume advances, and the control flips its state', () => {
    const { pause } = mountBar();
    initAnnouncementBars();

    pause.click();
    expect(pause.getAttribute('aria-pressed')).toBe('true');
    expect(pause.getAttribute('aria-label')).toBe('Resume announcements');
    expect(pause.querySelector<HTMLElement>('[data-announcement-pause-icon]')!.hidden).toBe(true);
    expect(pause.querySelector<HTMLElement>('[data-announcement-play-icon]')!.hidden).toBe(false);
    vi.advanceTimersByTime(INTERVAL * 2);
    expect(activeText()).toBe('Message 0');

    pause.click();
    expect(pause.getAttribute('aria-pressed')).toBe('false');
    vi.advanceTimersByTime(INTERVAL);
    expect(activeText()).toBe('Message 1');
  });

  test('dismiss persists for the session and stops the timer', () => {
    const { dismiss, bar } = mountBar();
    initAnnouncementBars();

    dismiss.click();
    expect(sessionStorage.getItem('tq-announcement-test')).toBe('true');
    expect(document.documentElement.hasAttribute('data-announcement-dismissed')).toBe(true);
    expect(bar.dataset.announcementInit).toBe('true');

    vi.advanceTimersByTime(INTERVAL * 2);
    expect(activeText()).toBe('Message 0');
  });

  test('a bar dismissed earlier in the session never arms a timer', () => {
    mountBar();
    sessionStorage.setItem('tq-announcement-test', 'true');
    initAnnouncementBars();
    vi.advanceTimersByTime(INTERVAL * 3);
    expect(activeText()).toBe('Message 0');
  });

  test('teardown stops the timer', () => {
    mountBar();
    initAnnouncementBars();
    teardownAnnouncementBars();
    vi.advanceTimersByTime(INTERVAL * 3);
    expect(activeText()).toBe('Message 0');
  });
});
