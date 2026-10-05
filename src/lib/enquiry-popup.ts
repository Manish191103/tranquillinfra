/**
 * Auto-open policy for the enquiry dialog.
 *
 * The dialog is a lead-capture interrupt, so it may only appear when the
 * visitor is demonstrably engaged and never twice against their wishes:
 *
 * - a minimum dwell time, so the popup is not part of the landing paint (Google
 *   treats an interstitial that covers content right after a search click as
 *   intrusive);
 * - engagement, either desktop exit intent (the pointer leaving through the top
 *   edge) or scroll depth — the only signal a touch device has;
 * - never while something else owns the viewport: an open dialog, the consent
 *   banner waiting for a decision, or focus in a field the visitor is typing in;
 * - a submitted enquiry suppresses it permanently, a dismissed one for
 *   `DISMISS_COOLDOWN_MS`.
 *
 * `shouldAutoOpen` is pure and takes its clock as a signal, so the decision
 * table is testable without a DOM; the storage helpers are the only part that
 * touches `localStorage`, and they degrade to a per-page-only memory when it is
 * unavailable (private mode, storage blocked).
 */

/** What an earlier popup did: submitted, or closed without submitting. */
export interface StoredPopupState {
  status: 'dismissed' | 'converted';
  /** ISO timestamp of that outcome. */
  at: string;
}

export interface AutoOpenSignals {
  /** The stored outcome, if the visitor has seen the popup before. */
  stored: StoredPopupState | null;
  /** Epoch milliseconds — injected so the decision is deterministic in tests. */
  now: number;
  /** Seconds since the page armed the popup. */
  dwellSeconds: number;
  /** Furthest scroll position as a fraction of the document height (0–1). */
  scrollFraction: number;
  /** The pointer left through the top edge of the window. */
  exitIntent: boolean;
  /** An open dialog, a visible consent banner, or focus in a field. */
  busy: boolean;
}

/** Tunables for the policy above. */
export const AUTO_OPEN_RULES = {
  /** Earliest the popup may appear after the page armed it. */
  minDwellSeconds: 8,
  /** Engagement floor for touch devices (and for a reader who scrolls, not leaves). */
  scrollFraction: 0.55,
  /** How long a dismissed popup stays away. */
  dismissCooldownMs: 30 * 24 * 60 * 60 * 1000,
} as const;

/** Decide whether the popup may open for the given signals. */
export function shouldAutoOpen(signals: AutoOpenSignals): boolean {
  if (signals.busy) return false;
  if (signals.stored?.status === 'converted') return false;

  if (signals.stored?.status === 'dismissed') {
    const dismissedAt = Date.parse(signals.stored.at);
    // An unreadable record is treated as an expired dismissal: nagging once
    // more is recoverable, never showing the form again is a silent lead loss.
    if (
      !Number.isNaN(dismissedAt) &&
      signals.now - dismissedAt < AUTO_OPEN_RULES.dismissCooldownMs
    ) {
      return false;
    }
  }

  if (signals.dwellSeconds < AUTO_OPEN_RULES.minDwellSeconds) return false;

  return signals.exitIntent || signals.scrollFraction >= AUTO_OPEN_RULES.scrollFraction;
}

const STORAGE_KEY = 'tranquill-enquiry-popup';

/** The outcome stored by an earlier visit, or `null` when there is none. */
export function readPopupState(): StoredPopupState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPopupState;
    if (parsed?.status !== 'dismissed' && parsed?.status !== 'converted') return null;
    return parsed;
  } catch {
    // Storage unavailable or holding something else: treat as a first visit.
    return null;
  }
}

function writePopupState(status: StoredPopupState['status']): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ status, at: new Date().toISOString() }));
  } catch {
    /* storage unavailable — the popup stays armed for this page only */
  }
}

/** The visitor closed the popup without submitting: keep it away for a while. */
export function markPopupDismissed(): void {
  writePopupState('dismissed');
}

/** The visitor submitted an enquiry: never interrupt them with the form again. */
export function markPopupConverted(): void {
  writePopupState('converted');
}
