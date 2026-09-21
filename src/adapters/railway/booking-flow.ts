import type { BookingConfig, PassengerConfig, TrainResult } from "../../core/types/booking.js";
import { SELECTORS } from "./selectors.js";
import { formFiller } from "./form-filler.js";
import { parseVisibleResults, selectBestMatch } from "./parser.js";
import { queryAllMerged, queryFirst, waitFor } from "../../content/dom/dom-utils.js";
import { LOGIN_KEYWORDS, SECURITY_KEYWORDS } from "../../shared/constants.js";

/**
 * Site-specific adapter. Generic controller code talks to this interface;
 * all fragile DOM knowledge lives here.
 */
export interface BookingPageAdapter {
  isBookingPage(): boolean;
  isSearchFormReady(): boolean;
  fillOrigin(value: string): Promise<void>;
  fillDestination(value: string): Promise<void>;
  fillDate(value: string): Promise<void>;
  selectTrain(value: string): Promise<void>;
  selectClass(value: string): Promise<void>;
  fillPassenger(index: number, passenger: PassengerConfig): Promise<void>;
  submitSearch(): Promise<void>;
  readResults(): TrainResult[];
  chooseResult(match: TrainResult): Promise<void>;
  detectSecurityChallenge(): boolean;
  detectLoginRequired(): boolean;
  detectUnexpectedState(): boolean;
}

function bodyText(): string {
  return document.body?.innerText ?? "";
}

function hasVisible(selectors: readonly string[]): boolean {
  const el = queryFirst(selectors);
  if (!el || !(el instanceof HTMLElement)) return false;
  return el.offsetParent !== null || el.getClientRects().length > 0;
}

export class RailwayAdapter implements BookingPageAdapter {
  isBookingPage(): boolean {
    return (
      queryFirst(SELECTORS.origin) !== null ||
      queryFirst(SELECTORS.destination) !== null ||
      queryFirst(SELECTORS.searchButton) !== null
    );
  }

  isSearchFormReady(): boolean {
    return (
      queryFirst(SELECTORS.origin) !== null &&
      queryFirst(SELECTORS.destination) !== null &&
      queryFirst(SELECTORS.journeyDate) !== null &&
      queryFirst(SELECTORS.searchButton) !== null
    );
  }

  fillOrigin = (v: string): Promise<void> => formFiller.fillOrigin(v);
  fillDestination = (v: string): Promise<void> => formFiller.fillDestination(v);
  fillDate = (v: string): Promise<void> => formFiller.fillDate(v);
  selectTrain = (v: string): Promise<void> => formFiller.selectTrain(v);
  selectClass = (v: string): Promise<void> => formFiller.selectClass(v);
  fillPassenger = (i: number, p: PassengerConfig): Promise<void> => formFiller.fillPassenger(i, p);
  submitSearch = (): Promise<void> => formFiller.submitSearch();

  readResults(): TrainResult[] {
    return parseVisibleResults(document);
  }

  async chooseResult(match: TrainResult): Promise<void> {
    const rows = queryAllMerged(SELECTORS.resultRows);
    const row = rows[match.rowIndex];
    if (!row) throw new Error("Selected result row is no longer present.");
    const btn = queryFirst(SELECTORS.resultSelectButton, row) as HTMLElement | null;
    if (!btn) throw new Error("Select button not found on the chosen result. Stopping.");
    btn.click();
    // Confirm navigation / next step appeared (bounded).
    await waitFor(
      () => this.detectSecurityChallenge() || hasVisible(SELECTORS.passengerName) || hasVisible(SELECTORS.paymentStep),
      { timeoutMs: 15_000 }
    );
  }

  detectSecurityChallenge(): boolean {
    if (hasVisible(SELECTORS.captcha) || hasVisible(SELECTORS.paymentStep)) return true;
    const text = bodyText();
    return SECURITY_KEYWORDS.some((re) => re.test(text));
  }

  detectLoginRequired(): boolean {
    if (hasVisible(SELECTORS.loginForm)) {
      const text = bodyText();
      if (LOGIN_KEYWORDS.some((re) => re.test(text))) return true;
      // Password field on a booking page is itself a login signal.
      return true;
    }
    return false;
  }

  detectUnexpectedState(): boolean {
    // Heuristic: booking URL but neither search form nor results present.
    const hasForm = this.isSearchFormReady();
    const hasRows = queryAllMerged(SELECTORS.resultRows).length > 0;
    return !hasForm && !hasRows;
  }
}

export function pickTrain(config: BookingConfig, results: TrainResult[]): TrainResult {
  return selectBestMatch(results, config);
}
