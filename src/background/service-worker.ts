import { ALARM_NAMES, RAILWAY_ORIGINS } from "../shared/constants.js";
import { MESSAGE_TYPES, isExtensionMessage } from "../shared/messages.js";
import type { StatusPayload } from "../shared/messages.js";
import { BookingState, defaultRuntimeStatus } from "../core/types/booking.js";
import type { RuntimeStatus } from "../core/types/booking.js";
import { StateMachine } from "../core/state/machine.js";
import { loadConfig, loadRuntime, saveRuntime } from "../core/storage/store.js";
import { clearAllData, clearPassengerData } from "../core/storage/store.js";
import { saveConfig } from "../core/storage/store.js";
import { parseConfig } from "../core/validation/config.js";
import {
  clearSchedule,
  ensureReconcileAlarm,
  remainingMs,
  scheduleBooking
} from "../core/scheduler/scheduler.js";
import { logger } from "../core/logging/logger.js";

/**
 * Background event logic. Owns scheduling (chrome.alarms) and persisted
 * status; never touches passwords/OTPs/payments. Survives restarts by
 * reconciling stored config + runtime on startup/alarms.
 */

const machine = new StateMachine();

async function setStatus(partial: Partial<RuntimeStatus>): Promise<RuntimeStatus> {
  const current = await loadRuntime();
  const next: RuntimeStatus = {
    ...current,
    ...partial,
    updatedAt: new Date().toISOString()
  };
  await saveRuntime(next);
  return next;
}

function toPayload(s: RuntimeStatus): StatusPayload {
  return {
    state: s.state,
    detail: s.detail,
    bookingTime: s.bookingTime,
    lastError: s.lastError,
    stoppedReason: s.stoppedReason
  };
}

async function syncMachineTo(state: BookingState): Promise<void> {
  try {
    if (machine.state === BookingState.IDLE && state !== BookingState.IDLE) {
      // Rehydrate after restart: walk IDLE -> ARMED -> ... is overkill;
      // reset then step once where legal, else accept via halt path.
      if (state === BookingState.ARMED || state === BookingState.WAITING_FOR_TIME || state === BookingState.WAITING_FOR_PAGE) {
        machine.transitionTo(BookingState.ARMED);
        if (state !== BookingState.ARMED) machine.transitionTo(state);
      }
    } else if (machine.state !== state) {
      machine.transitionTo(state);
    }
  } catch {
    // If stored state diverged (e.g. after restart), reset and continue.
    machine.reset();
  }
}

async function broadcastToRailwayTabs(message: unknown): Promise<void> {
  const urlPatterns = RAILWAY_ORIGINS.map((o) => `${o}/*`);
  try {
    const tabs = await chrome.tabs.query({ url: urlPatterns });
    await Promise.all(
      tabs.map((t) =>
        t.id !== undefined
          ? chrome.tabs.sendMessage(t.id, message).catch(() => undefined)
          : Promise.resolve()
      )
    );
  } catch (err) {
    logger.warn("Tab broadcast failed");
  }
}

async function reconcile(): Promise<void> {
  const [config, runtime] = await Promise.all([loadConfig(), loadRuntime()]);
  await syncMachineTo(runtime.state);
  if (!config || config.enabled !== true) return;
  if (
    runtime.state === BookingState.ARMED ||
    runtime.state === BookingState.WAITING_FOR_TIME ||
    runtime.state === BookingState.WAITING_FOR_PAGE
  ) {
    const left = remainingMs(config.bookingTime);
    if (left <= 0) {
      await setStatus({
        state: BookingState.WAITING_FOR_PAGE,
        detail: "Booking time reached. Waiting for the booking page."
      });
      await broadcastToRailwayTabs({ type: MESSAGE_TYPES.bookingDue });
    } else {
      await scheduleBooking(config.bookingTime).catch(() => undefined);
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void (async () => {
    await ensureReconcileAlarm();
    const runtime = await loadRuntime().catch(() => defaultRuntimeStatus());
    await saveRuntime(runtime);
    logger.info("Extension installed");
  })();
});

chrome.runtime.onStartup.addListener(() => {
  void (async () => {
    await ensureReconcileAlarm();
    await reconcile();
  })();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  void (async () => {
    if (alarm.name === ALARM_NAMES.bookingDue) {
      logger.info("Booking alarm fired");
      const config = await loadConfig();
      if (!config || !config.enabled) return;
      await setStatus({
        state: BookingState.WAITING_FOR_PAGE,
        detail: "Booking time reached. Open the booking page if it is not open.",
        bookingTime: config.bookingTime
      });
      await broadcastToRailwayTabs({ type: MESSAGE_TYPES.bookingDue });
    } else if (alarm.name === ALARM_NAMES.stateReconcile) {
      await reconcile();
    }
  })();
});

chrome.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
  if (!isExtensionMessage(msg)) return false;

  void (async () => {
    switch (msg.type) {
      case MESSAGE_TYPES.getStatus: {
        const runtime = await loadRuntime();
        sendResponse({ ok: true, payload: toPayload(runtime) });
        break;
      }
      case MESSAGE_TYPES.saveConfig: {
        const parsed = parseConfig(msg.payload.config);
        if (!parsed.ok) {
          sendResponse({ ok: false, errors: parsed.errors });
          return;
        }
        await saveConfig(parsed.value);
        sendResponse({ ok: true });
        break;
      }
      case MESSAGE_TYPES.arm: {
        const config = await loadConfig();
        if (!config) {
          sendResponse({ ok: false, errors: ["No configuration saved."] });
          return;
        }
        const parsed = parseConfig({ ...config, enabled: true });
        if (!parsed.ok) {
          sendResponse({ ok: false, errors: parsed.errors });
          return;
        }
        await saveConfig(parsed.value);
        await scheduleBooking(parsed.value.bookingTime);
        machine.reset();
        machine.transitionTo(BookingState.ARMED);
        machine.transitionTo(BookingState.WAITING_FOR_TIME);
        await setStatus({
          state: BookingState.WAITING_FOR_TIME,
          detail: `Armed. Waiting for booking time.`,
          bookingTime: parsed.value.bookingTime,
          lastError: null,
          stoppedReason: null
        });
        sendResponse({ ok: true });
        break;
      }
      case MESSAGE_TYPES.disarm:
      case MESSAGE_TYPES.stop: {
        const reason =
          msg.type === MESSAGE_TYPES.stop
            ? (msg.payload?.reason ?? "Stopped by user.")
            : "Disarmed by user.";
        await clearSchedule();
        const runtime = await loadRuntime();
        await syncMachineTo(runtime.state);
        try {
          machine.transitionTo(BookingState.STOPPED);
        } catch {
          machine.reset();
        }
        const config = await loadConfig();
        if (config) await saveConfig({ ...config, enabled: false });
        await setStatus({ state: BookingState.STOPPED, detail: reason, stoppedReason: reason });
        sendResponse({ ok: true });
        break;
      }
      case MESSAGE_TYPES.statusUpdate: {
        const p = msg.payload;
        await setStatus({
          state: p.state,
          detail: p.detail,
          lastError: p.lastError,
          stoppedReason: p.stoppedReason
        });
        await syncMachineTo(p.state).catch(() => undefined);
        // If content reached a handoff point, clear the due alarm.
        if (
          p.state === BookingState.USER_ACTION_REQUIRED ||
          p.state === BookingState.COMPLETED ||
          p.state === BookingState.ERROR ||
          p.state === BookingState.STOPPED
        ) {
          await clearSchedule();
        }
        sendResponse({ ok: true });
        break;
      }
      case MESSAGE_TYPES.contentReady: {
        // Opportunistic reconcile: if time is already due, nudge this tab.
        const [config, runtime] = await Promise.all([loadConfig(), loadRuntime()]);
        if (
          config?.enabled === true &&
          (runtime.state === BookingState.WAITING_FOR_PAGE ||
            runtime.state === BookingState.WAITING_FOR_TIME ||
            runtime.state === BookingState.ARMED) &&
          remainingMs(config.bookingTime) <= 0
        ) {
          await broadcastToRailwayTabs({ type: MESSAGE_TYPES.bookingDue });
        }
        sendResponse({ ok: true });
        break;
      }
      case MESSAGE_TYPES.clearPassengerData: {
        await clearPassengerData();
        sendResponse({ ok: true });
        break;
      }
      case MESSAGE_TYPES.clearAllData: {
        await clearAllData();
        await clearSchedule();
        machine.reset();
        await saveRuntime(defaultRuntimeStatus());
        sendResponse({ ok: true });
        break;
      }
      case MESSAGE_TYPES.bookingDue:
      case MESSAGE_TYPES.contentReady: {
        sendResponse({ ok: true });
        break;
      }
    }
  })();

  return true; // async response
});
