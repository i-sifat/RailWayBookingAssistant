/**
 * Strongly typed domain model. Passenger data is sensitive personal data:
 * stored only in chrome.storage.local, never transmitted, never logged verbatim.
 */

export enum BookingState {
  IDLE = "IDLE",
  ARMED = "ARMED",
  WAITING_FOR_TIME = "WAITING_FOR_TIME",
  WAITING_FOR_PAGE = "WAITING_FOR_PAGE",
  PAGE_READY = "PAGE_READY",
  FILLING_FORM = "FILLING_FORM",
  VERIFYING_FORM = "VERIFYING_FORM",
  SEARCHING = "SEARCHING",
  WAITING_FOR_RESULTS = "WAITING_FOR_RESULTS",
  EVALUATING_RESULTS = "EVALUATING_RESULTS",
  SELECTING_TICKET = "SELECTING_TICKET",
  CHECKOUT_READY = "CHECKOUT_READY",
  USER_ACTION_REQUIRED = "USER_ACTION_REQUIRED",
  COMPLETED = "COMPLETED",
  STOPPED = "STOPPED",
  ERROR = "ERROR"
}

export interface PassengerConfig {
  name: string;
  identificationType?: string;
  identificationNumber?: string;
  gender?: string;
  age?: number;
}

export interface BookingConfig {
  origin: string;
  destination: string;
  /** ISO date YYYY-MM-DD */
  journeyDate: string;
  preferredTrain?: string;
  preferredClass?: string;
  passengerCount: number;
  passengers: PassengerConfig[];
  /** ISO datetime with timezone offset, e.g. 2026-09-25T08:00:00+06:00 */
  bookingTime: string;
  timezone: string;
  enabled: boolean;
  /** If false (default), never substitute a different train/class silently. */
  allowSubstitution?: boolean;
}

export interface TrainResult {
  trainName: string;
  trainNumber?: string;
  departure?: string;
  arrival?: string;
  className?: string;
  availableSeats?: number;
  /** Opaque reference to the DOM row for selection; never persisted. */
  rowIndex: number;
}

export interface RuntimeStatus {
  state: BookingState;
  detail: string;
  bookingTime: string | null;
  lastError: string | null;
  stoppedReason: string | null;
  updatedAt: string;
}

export function defaultRuntimeStatus(): RuntimeStatus {
  return {
    state: BookingState.IDLE,
    detail: "Idle. Configure booking, then arm the assistant.",
    bookingTime: null,
    lastError: null,
    stoppedReason: null,
    updatedAt: new Date().toISOString()
  };
}

/** Normalize for deterministic comparison (case/whitespace-insensitive). */
export function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function matchesExpected(actual: string, expected: string): boolean {
  return normalizeText(actual) === normalizeText(expected);
}
