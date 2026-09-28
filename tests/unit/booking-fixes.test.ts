import { describe, expect, it } from "vitest";
import { BookingState, matchesExpected, normalizeText } from "../../src/core/types/booking.js";
import type { BookingConfig, TrainResult } from "../../src/core/types/booking.js";
import { canTransition } from "../../src/core/state/machine.js";
import { selectBestMatch } from "../../src/adapters/railway/parser.js";
import { NoMatchError } from "../../src/core/errors/errors.js";

function config(over: Partial<BookingConfig> = {}): BookingConfig {
  return {
    origin: "Dhaka",
    destination: "Biman_Bandar",
    journeyDate: "2026-09-30",
    passengerCount: 1,
    passengers: [{ name: "P" }],
    bookingTime: new Date().toISOString(),
    timezone: "Asia/Dhaka",
    enabled: true,
    ...over
  };
}

describe("site-name matching", () => {
  it("treats underscores like spaces (Biman_Bandar)", () => {
    expect(normalizeText("Biman_Bandar")).toBe("biman bandar");
    expect(matchesExpected("Biman_bandar", "Biman_Bandar")).toBe(true);
    expect(matchesExpected("Biman Bandar", "Biman_Bandar")).toBe(true);
  });
});

describe("resume path after service-worker wake", () => {
  it("walks IDLE -> ARMED -> WAITING_FOR_TIME -> WAITING_FOR_PAGE legally", () => {
    expect(canTransition(BookingState.IDLE, BookingState.ARMED)).toBe(true);
    expect(canTransition(BookingState.ARMED, BookingState.WAITING_FOR_TIME)).toBe(true);
    expect(canTransition(BookingState.WAITING_FOR_TIME, BookingState.WAITING_FOR_PAGE)).toBe(true);
  });

  it("allows WAITING_FOR_PAGE -> EVALUATING_RESULTS for pre-searched pages", () => {
    expect(canTransition(BookingState.WAITING_FOR_PAGE, BookingState.EVALUATING_RESULTS)).toBe(true);
  });

  it("still forbids IDLE -> WAITING_FOR_PAGE directly", () => {
    expect(canTransition(BookingState.IDLE, BookingState.WAITING_FOR_PAGE)).toBe(false);
  });
});

describe("sold-out results", () => {
  const soldOut: TrainResult[] = [
    { trainName: "DHUMKETU EXPRESS", className: "AC_S", availableSeats: 0, rowIndex: 0 },
    { trainName: "DHUMKETU EXPRESS", className: "SNIGDHA", availableSeats: 0, rowIndex: 1 }
  ];

  it("stops instead of selecting a zero-seat row", () => {
    expect(() =>
      selectBestMatch(soldOut, config({ preferredTrain: "DHUMKETU EXPRESS" }))
    ).toThrow(NoMatchError);
    try {
      selectBestMatch(soldOut, config({ preferredTrain: "DHUMKETU EXPRESS" }));
    } catch (err) {
      expect(err instanceof Error && err.message).toMatch(/No seats available/);
    }
  });

  it("still picks when seat counts are unknown", () => {
    const unknown: TrainResult[] = [
      { trainName: "DHUMKETU EXPRESS", className: "AC_S", rowIndex: 0 }
    ];
    expect(
      selectBestMatch(unknown, config({ preferredTrain: "DHUMKETU EXPRESS", preferredClass: "AC_S" })).rowIndex
    ).toBe(0);
  });
});
