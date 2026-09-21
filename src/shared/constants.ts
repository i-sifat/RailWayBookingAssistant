/**
 * Central constants. Single source of truth for origins, alarms, storage keys,
 * timing bounds, and safety keywords.
 *
 * To retarget to a different railway site, change RAILWAY_ORIGINS,
 * BOOKING_PAGE_URL_PATTERNS, and manifest.json together.
 */

export const EXTENSION_NAME = "Railway Booking Assistant";

export const RAILWAY_ORIGINS: readonly string[] = [
  "https://eticket.railway.gov.bd"
] as const;

export const BOOKING_PAGE_URL_PATTERNS: readonly RegExp[] = [
  /eticket\.railway\.gov\.bd/i
];

export const ALARM_NAMES = {
  bookingDue: "rba-booking-due",
  stateReconcile: "rba-state-reconcile"
} as const;

export const STORAGE_KEYS = {
  config: "rba.config.v1",
  runtime: "rba.runtime.v1"
} as const;

/** Bounded retry / polling defaults — never tight-loop the DOM. */
export const POLL = {
  /** Max time to wait for a page/element to become ready. */
  defaultTimeoutMs: 30_000,
  /** Base interval between DOM checks. */
  baseIntervalMs: 350,
  /** Max interval under exponential backoff. */
  maxIntervalMs: 2_500,
  /** Backoff multiplier. */
  backoffFactor: 1.5
} as const;

/** Scheduler behaviour: wake slightly early so local fill is ready on time. */
export const SCHEDULER = {
  /** Fire the due alarm this far before bookingTime to allow page warm-up. */
  leadTimeMs: 5_000,
  /** Reconcile state on service-worker startup. */
  reconcileAlarmMinutes: 1
} as const;

/**
 * Keywords that indicate a security / payment / auth boundary.
 * Matching is heuristic and conservative: on any hit, automation stops.
 * Never added to bypass them — only to detect and hand control to the user.
 */
export const SECURITY_KEYWORDS: readonly RegExp[] = [
  /captcha/i,
  /recaptcha/i,
  /otp/i,
  /one[\s-]?time[\s-]?password/i,
  /verify\s*your\s*(mobile|phone|email)/i,
  /3d[\s-]?secure/i,
  /payment\s*(auth|verif|confirm)/i,
  /queue/i,
  /waiting\s*room/i,
  /access\s*denied/i,
  /rate[\s-]?limit/i,
  /too\s*many\s*requests/i,
  /session\s*expired/i
];

export const LOGIN_KEYWORDS: readonly RegExp[] = [
  /log\s*in/i,
  /sign\s*in/i,
  /login/i
];
