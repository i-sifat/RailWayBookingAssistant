import { describe, expect, it } from "vitest";
import { BookingState } from "../../src/core/types/booking.js";
import { StateMachine, canTransition } from "../../src/core/state/machine.js";

describe("state machine", () => {
  it("allows the happy-path chain step by step", () => {
    const m = new StateMachine();
    const chain: BookingState[] = [
      BookingState.ARMED,
      BookingState.WAITING_FOR_TIME,
      BookingState.WAITING_FOR_PAGE,
      BookingState.PAGE_READY,
      BookingState.FILLING_FORM,
      BookingState.VERIFYING_FORM,
      BookingState.SEARCHING,
      BookingState.WAITING_FOR_RESULTS,
      BookingState.EVALUATING_RESULTS,
      BookingState.SELECTING_TICKET,
      BookingState.CHECKOUT_READY,
      BookingState.USER_ACTION_REQUIRED
    ];
    for (const next of chain) m.transitionTo(next);
    expect(m.state).toBe(BookingState.USER_ACTION_REQUIRED);
  });

  it("rejects illegal jumps", () => {
    expect(canTransition(BookingState.IDLE, BookingState.FILLING_FORM)).toBe(false);
    expect(canTransition(BookingState.IDLE, BookingState.IDLE)).toBe(false);
  });

  it("allows safety halt from any active state", () => {
    expect(canTransition(BookingState.FILLING_FORM, BookingState.USER_ACTION_REQUIRED)).toBe(true);
    expect(canTransition(BookingState.SEARCHING, BookingState.STOPPED)).toBe(true);
    expect(canTransition(BookingState.WAITING_FOR_RESULTS, BookingState.ERROR)).toBe(true);
  });
});
