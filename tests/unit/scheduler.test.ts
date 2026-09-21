import { describe, expect, it } from "vitest";
import { computeDelayMs, remainingMs } from "../../src/core/scheduler/scheduler.js";

describe("scheduler math", () => {
  it("computes lead-time-adjusted delay", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const delay = computeDelayMs(future, Date.now());
    // 60s minus 5s lead => ~55s
    expect(delay).toBeGreaterThan(50_000);
    expect(delay).toBeLessThan(56_000);
  });

  it("rejects invalid booking time", () => {
    expect(() => computeDelayMs("bad")).toThrow();
  });

  it("remainingMs is negative in the past", () => {
    expect(remainingMs(new Date(Date.now() - 1_000).toISOString())).toBeLessThan(0);
  });
});
