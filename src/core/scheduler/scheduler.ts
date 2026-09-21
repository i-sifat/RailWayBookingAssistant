import { ALARM_NAMES, SCHEDULER } from "../../shared/constants.js";
import { logger } from "../logging/logger.js";

/**
 * Deterministic local scheduler built on chrome.alarms so it survives
 * service-worker suspension. No tight setTimeout chains, no request storms.
 */

export function computeDelayMs(bookingTimeIso: string, nowMs = Date.now()): number {
  const target = Date.parse(bookingTimeIso);
  if (Number.isNaN(target)) throw new Error("Invalid bookingTime");
  // Wake slightly early to warm the page; content script still waits for exact time.
  return target - SCHEDULER.leadTimeMs - nowMs;
}

export async function scheduleBooking(bookingTimeIso: string): Promise<void> {
  const delay = computeDelayMs(bookingTimeIso);
  await chrome.alarms.clear(ALARM_NAMES.bookingDue);
  if (delay <= 0) {
    logger.info("Booking time already reached; due immediately");
    // Fire in ~1s so the worker yields first.
    await chrome.alarms.create(ALARM_NAMES.bookingDue, { when: Date.now() + 1_000 });
    return;
  }
  // chrome.alarms minimum granularity is ~30s for delayInMinutes; use `when` for precision.
  const when = Date.parse(bookingTimeIso) - SCHEDULER.leadTimeMs;
  await chrome.alarms.create(ALARM_NAMES.bookingDue, { when });
  logger.info("Booking alarm scheduled");
}

export async function clearSchedule(): Promise<void> {
  await chrome.alarms.clear(ALARM_NAMES.bookingDue);
}

export async function ensureReconcileAlarm(): Promise<void> {
  const existing = await chrome.alarms.get(ALARM_NAMES.stateReconcile);
  if (!existing) {
    await chrome.alarms.create(ALARM_NAMES.stateReconcile, {
      periodInMinutes: SCHEDULER.reconcileAlarmMinutes
    });
  }
}

/** Remaining wall-clock ms until bookingTime (negative if past). */
export function remainingMs(bookingTimeIso: string, nowMs = Date.now()): number {
  return Date.parse(bookingTimeIso) - nowMs;
}
