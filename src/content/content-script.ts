import { BookingController } from "./booking-controller.js";
import { pageDetector } from "./page-detector.js";
import { MESSAGE_TYPES, isExtensionMessage } from "../shared/messages.js";
import type { BookingConfig } from "../core/types/booking.js";
import { BookingState } from "../core/types/booking.js";
import { STORAGE_KEYS } from "../shared/constants.js";
import { logger } from "../core/logging/logger.js";

/**
 * Content-script entry. Runs only on configured railway domains (manifest).
 * Listens for the booking-due signal and auto-starts only when:
 * enabled + time reached + expected page + no security challenge.
 */

let running = false;

async function readConfig(): Promise<BookingConfig | null> {
  const raw = await chrome.storage.local.get(STORAGE_KEYS.config);
  return (raw[STORAGE_KEYS.config] as BookingConfig | undefined) ?? null;
}

async function readRuntimeState(): Promise<BookingState> {
  const raw = await chrome.storage.local.get(STORAGE_KEYS.runtime);
  const rt = raw[STORAGE_KEYS.runtime] as { state?: BookingState } | undefined;
  return rt?.state ?? BookingState.IDLE;
}

async function report(state: BookingState, detail: string): Promise<void> {
  await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.statusUpdate,
    payload: {
      state,
      detail,
      bookingTime: null,
      lastError: state === BookingState.ERROR ? detail : null,
      stoppedReason:
        state === BookingState.USER_ACTION_REQUIRED || state === BookingState.STOPPED ? detail : null
    }
  });
}

async function maybeAutoStart(reason: string): Promise<void> {
  if (running) return;
  const [config, state] = await Promise.all([readConfig(), readRuntimeState()]);
  if (!config || config.enabled !== true) return;
  if (state !== BookingState.ARMED && state !== BookingState.WAITING_FOR_TIME && state !== BookingState.WAITING_FOR_PAGE) {
    return;
  }
  // Respect the configured wall-clock time (background wakes us early).
  if (Date.parse(config.bookingTime) > Date.now()) return;
  if (!pageDetector.isExpectedBookingUrl()) return;
  if (pageDetector.hasSecurityChallenge() || pageDetector.needsLogin()) {
    await report(
      BookingState.USER_ACTION_REQUIRED,
      "Security challenge or login required. Please resolve it manually."
    );
    return;
  }
  running = true;
  logger.info(`Auto-start triggered (${reason})`);
  const controller = new BookingController(config, report);
  try {
    await controller.run();
  } catch {
    // Status already reported by controller.
  } finally {
    running = false;
  }
}

chrome.runtime.onMessage.addListener((msg: unknown) => {
  if (!isExtensionMessage(msg)) return;
  if (msg.type === MESSAGE_TYPES.bookingDue) {
    void maybeAutoStart("booking-due signal");
  }
});

// On load: announce presence, then auto-start if everything is already due.
void (async () => {
  try {
    await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.contentReady,
      payload: { url: location.href }
    });
  } catch {
    // Background may be momentarily unavailable; poll path below still works.
  }
  // Small delay lets SPA render before first check.
  window.setTimeout(() => void maybeAutoStart("page-load"), 1_500);
})();
