import { describe, expect, it } from "vitest";
import { parseConfig } from "../../src/core/validation/config.js";

const base = {
  origin: "Dhaka",
  destination: "Chittagong",
  journeyDate: "2026-09-25",
  passengerCount: 1,
  passengers: [{ name: "Test Passenger" }],
  bookingTime: new Date(Date.now() + 3_600_000).toISOString(),
  timezone: "Asia/Dhaka",
  enabled: true
};

describe("config validation", () => {
  it("accepts a valid config", () => {
    expect(parseConfig(base).ok).toBe(true);
  });

  it("rejects same origin/destination", () => {
    const res = parseConfig({ ...base, destination: "dhaka" });
    expect(res.ok).toBe(false);
  });

  it("rejects bad date and bad time", () => {
    expect(parseConfig({ ...base, journeyDate: "25-09-2026" }).ok).toBe(false);
    expect(parseConfig({ ...base, bookingTime: "not-a-date" }).ok).toBe(false);
  });

  it("rejects empty passengers", () => {
    expect(parseConfig({ ...base, passengers: [] }).ok).toBe(false);
  });
});
