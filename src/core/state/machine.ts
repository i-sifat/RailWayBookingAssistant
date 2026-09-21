import { BookingState } from "../types/booking.js";

/**
 * Explicit finite state machine. Every transition is validated against an
 * allow-list; illegal transitions throw instead of silently proceeding.
 * Terminal-adjacent safety states (USER_ACTION_REQUIRED / STOPPED / ERROR)
 * are reachable from any non-terminal state.
 */

const TERMINAL: ReadonlySet<BookingState> = new Set([
  BookingState.COMPLETED,
  BookingState.STOPPED,
  BookingState.ERROR,
  BookingState.USER_ACTION_REQUIRED
]);

const ALLOWED: ReadonlyMap<BookingState, ReadonlySet<BookingState>> = new Map<
  BookingState,
  ReadonlySet<BookingState>
>([
  [BookingState.IDLE, new Set([BookingState.ARMED, BookingState.STOPPED])],
  [BookingState.ARMED, new Set([BookingState.WAITING_FOR_TIME, BookingState.STOPPED, BookingState.IDLE])],
  [BookingState.WAITING_FOR_TIME, new Set([BookingState.WAITING_FOR_PAGE, BookingState.STOPPED, BookingState.IDLE])],
  [BookingState.WAITING_FOR_PAGE, new Set([BookingState.PAGE_READY, BookingState.STOPPED, BookingState.IDLE])],
  [BookingState.PAGE_READY, new Set([BookingState.FILLING_FORM, BookingState.STOPPED, BookingState.IDLE])],
  [BookingState.FILLING_FORM, new Set([BookingState.VERIFYING_FORM, BookingState.STOPPED, BookingState.IDLE])],
  [BookingState.VERIFYING_FORM, new Set([BookingState.SEARCHING, BookingState.FILLING_FORM, BookingState.STOPPED, BookingState.IDLE])],
  [BookingState.SEARCHING, new Set([BookingState.WAITING_FOR_RESULTS, BookingState.STOPPED, BookingState.IDLE])],
  [BookingState.WAITING_FOR_RESULTS, new Set([BookingState.EVALUATING_RESULTS, BookingState.STOPPED, BookingState.IDLE])],
  [BookingState.EVALUATING_RESULTS, new Set([BookingState.SELECTING_TICKET, BookingState.STOPPED, BookingState.IDLE])],
  [BookingState.SELECTING_TICKET, new Set([BookingState.CHECKOUT_READY, BookingState.STOPPED, BookingState.IDLE])],
  [BookingState.CHECKOUT_READY, new Set([BookingState.USER_ACTION_REQUIRED, BookingState.COMPLETED, BookingState.STOPPED, BookingState.IDLE])],
  [BookingState.USER_ACTION_REQUIRED, new Set([BookingState.IDLE, BookingState.STOPPED])],
  [BookingState.COMPLETED, new Set([BookingState.IDLE])],
  [BookingState.STOPPED, new Set([BookingState.IDLE, BookingState.ARMED])],
  [BookingState.ERROR, new Set([BookingState.IDLE])]
]);

export function canTransition(from: BookingState, to: BookingState): boolean {
  if (from === to) return false;
  // Safety escape hatch: any non-terminal state may hand control to the user.
  if (
    (to === BookingState.USER_ACTION_REQUIRED ||
      to === BookingState.STOPPED ||
      to === BookingState.ERROR) &&
    !TERMINAL.has(from)
  ) {
    return true;
  }
  return ALLOWED.get(from)?.has(to) ?? false;
}

export function assertTransition(from: BookingState, to: BookingState): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal state transition: ${from} -> ${to}`);
  }
}

export class StateMachine {
  private current: BookingState = BookingState.IDLE;

  get state(): BookingState {
    return this.current;
  }

  reset(): void {
    this.current = BookingState.IDLE;
  }

  transitionTo(next: BookingState): BookingState {
    assertTransition(this.current, next);
    const prev = this.current;
    this.current = next;
    return prev;
  }

  /** Force into a safety state without going through normal flow. */
  halt(reason: BookingState.STOPPED | BookingState.ERROR | BookingState.USER_ACTION_REQUIRED): void {
    if (TERMINAL.has(this.current) && this.current !== reason) {
      this.current = BookingState.IDLE;
    }
    if (this.current !== reason) this.transitionTo(reason);
  }
}
