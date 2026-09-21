import { describe, expect, it } from "vitest";
import { selectBestMatch } from "../../src/adapters/railway/parser.js";
import type { BookingConfig, TrainResult } from "../../src/core/types/booking.js";

function config(over: Partial<BookingConfig> = {}): BookingConfig {
  return {
    origin: "Dhaka",
    destination: "Chittagong",
    journeyDate: "2026-09-25",
    passengerCount: 1,
    passengers: [{ name: "P" }],
    bookingTime: new Date().toISOString(),
    timezone: "Asia/Dhaka",
    enabled: true,
    ...over
  };
}

const results: TrainResult[] = [
  { trainName: "Turna Express", className: "Snigdha", availableSeats: 5, rowIndex: 0 },
  { trainName: "Turna Express", className: "S_Chair", availableSeats: 10, rowIndex: 1 },
  { trainName: "Mohanagar Express", className: "Snigdha", availableSeats: 3, rowIndex: 2 }
];

describe("result selection", () => {
  it("requires exact train+class", () => {
    const pick = selectBestMatch(results, config({ preferredTrain: "Turna Express", preferredClass: "Snigdha" }));
    expect(pick.rowIndex).toBe(0);
  });

  it("throws when nothing matches instead of substituting", () => {
    expect(() => selectBestMatch(results, config({ preferredTrain: "Nonexistent" }))).toThrow();
  });

  it("throws on ambiguous matches unless substitution allowed", () => {
    const dup: TrainResult[] = [
      { trainName: "A Express", className: "Snigdha", availableSeats: 2, rowIndex: 0 },
      { trainName: "B Express", className: "Snigdha", availableSeats: 2, rowIndex: 1 }
    ];
    expect(() => selectBestMatch(dup, config({}))).toThrow();
    const pick = selectBestMatch(dup, config({ allowSubstitution: true }));
    expect(pick.rowIndex).toBe(0);
  });
});
