import type { BookingConfig, TrainResult } from "../../core/types/booking.js";
import { normalizeText } from "../../core/types/booking.js";
import { SELECTORS } from "./selectors.js";
import { queryAllMerged, queryFirst } from "../../content/dom/dom-utils.js";
import {
  AmbiguousSelectionError,
  NoMatchError
} from "../../core/errors/errors.js";

function textOf(row: Element, selectors: readonly string[]): string {
  const el = queryFirst(selectors, row);
  return el?.textContent?.trim() ?? "";
}

function seatsOf(row: Element): number | undefined {
  const raw = textOf(row, SELECTORS.resultSeats);
  const m = raw.match(/\d+/);
  return m?.[0] ? Number.parseInt(m[0], 10) : undefined;
}

/** Parse visible result rows into typed objects. Pure + unit-testable core. */
export function parseRows(rows: ArrayLike<Element> | Element[]): TrainResult[] {
  const list = Array.from(rows as ArrayLike<Element>);
  return list.map((row, rowIndex) => ({
    trainName: textOf(row, SELECTORS.resultTrainName) || row.textContent?.trim().slice(0, 80) || `Row ${rowIndex}`,
    className: textOf(row, SELECTORS.resultClass) || undefined,
    availableSeats: seatsOf(row),
    departure: undefined,
    arrival: undefined,
    trainNumber: undefined,
    rowIndex
  }));
}

export function parseVisibleResults(doc: ParentNode = document): TrainResult[] {
  const rows = queryAllMerged(SELECTORS.resultRows, doc);
  return parseRows(rows);
}

/**
 * Deterministic selection:
 * 1. exact/normalized preferred-train match (if configured)
 * 2. exact/normalized preferred-class match (if configured)
 * 3. never silently substitute unless allowSubstitution === true
 * 4. ambiguous multiples -> throw, no match -> throw
 */
export function selectBestMatch(results: TrainResult[], config: BookingConfig): TrainResult {
  let pool = results.slice();

  if (config.preferredTrain) {
    const want = normalizeText(config.preferredTrain);
    pool = pool.filter((r) => normalizeText(r.trainName).includes(want));
  }
  if (config.preferredClass) {
    const wantCls = normalizeText(config.preferredClass);
    pool = pool.filter((r) => (r.className ? normalizeText(r.className).includes(wantCls) : false));
  }

  if (pool.length === 0) {
    throw new NoMatchError("No matching train/class found. Stopping instead of substituting.");
  }

  const withSeats = pool.filter((r) => (r.availableSeats ?? 1) > 0);
  const candidates = withSeats.length > 0 ? withSeats : pool;

  if (candidates.length > 1 && config.allowSubstitution !== true) {
    // If the caller demanded an exact train+class and several rows tie, do not guess.
    const names = new Set(candidates.map((c) => normalizeText(`${c.trainName}|${c.className ?? ""}`)));
    if (names.size > 1) {
      throw new AmbiguousSelectionError(
        `${candidates.length} ambiguous matches found. Please choose manually.`
      );
    }
  }

  const first = candidates[0];
  if (!first) throw new NoMatchError("No selectable result.");
  return first;
}
