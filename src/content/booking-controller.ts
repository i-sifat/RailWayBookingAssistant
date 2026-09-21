import { BookingState } from "../core/types/booking.js";
import type { BookingConfig } from "../core/types/booking.js";
import { StateMachine } from "../core/state/machine.js";
import { RailwayAdapter, pickTrain } from "../adapters/railway/booking-flow.js";
import { pageDetector } from "./page-detector.js";
import { waitFor } from "./dom/dom-utils.js";
import { formFiller } from "../adapters/railway/form-filler.js";
import { logger } from "../core/logging/logger.js";
import {
  LoginRequiredError,
  SecurityChallengeError,
  VerificationError,
  toSafeMessage
} from "../core/errors/errors.js";
import { matchesExpected } from "../core/types/booking.js";

export type StatusReporter = (state: BookingState, detail: string) => Promise<void> | void;

function guardSafety(): void {
  if (pageDetector.hasSecurityChallenge()) {
    throw new SecurityChallengeError(
      "CAPTCHA, OTP, payment authentication, queue, or security challenge detected. Please complete it manually."
    );
  }
  if (pageDetector.needsLogin()) {
    throw new LoginRequiredError("Login required. Please log in manually; the assistant never handles passwords.");
  }
}

/**
 * Explicit content-side workflow. Each step transitions the machine once
 * and verifies before continuing. Never clicks blindly.
 */
export class BookingController {
  private machine = new StateMachine();
  private adapter = new RailwayAdapter();

  constructor(
    private readonly config: BookingConfig,
    private readonly report: StatusReporter
  ) {}

  get state(): BookingState {
    return this.machine.state;
  }

  private async go(next: BookingState, detail: string): Promise<void> {
    this.machine.transitionTo(next);
    logger.info(`State -> ${next}`);
    await this.report(next, detail);
  }

  async run(): Promise<void> {
    try {
      // WAITING_FOR_PAGE -> PAGE_READY
      this.machine.transitionTo(BookingState.WAITING_FOR_PAGE);
      await this.report(BookingState.WAITING_FOR_PAGE, "Waiting for the booking page to be ready.");
      guardSafety();
      await waitFor(() => pageDetector.isSearchFormReady(), { timeoutMs: 30_000 });
      guardSafety();
      await this.go(BookingState.PAGE_READY, "Booking page is ready.");

      // PAGE_READY -> FILLING_FORM
      await this.go(BookingState.FILLING_FORM, "Filling booking form.");
      guardSafety();
      await this.adapter.fillOrigin(this.config.origin);
      guardSafety();
      await this.adapter.fillDestination(this.config.destination);
      guardSafety();
      await this.adapter.fillDate(this.config.journeyDate);
      if (this.config.preferredTrain) await this.adapter.selectTrain(this.config.preferredTrain);
      if (this.config.preferredClass) await this.adapter.selectClass(this.config.preferredClass);

      // FILLING_FORM -> VERIFYING_FORM (write -> read-back -> compare)
      await this.go(BookingState.VERIFYING_FORM, "Verifying filled fields.");
      const origin = formFiller.readOrigin();
      const dest = formFiller.readDestination();
      const date = formFiller.readDate();
      if (!matchesExpected(origin, this.config.origin) && !origin.toLowerCase().includes(this.config.origin.toLowerCase())) {
        throw new VerificationError("Origin field was not correctly populated.");
      }
      if (!matchesExpected(dest, this.config.destination) && !dest.toLowerCase().includes(this.config.destination.toLowerCase())) {
        throw new VerificationError("Destination field was not correctly populated.");
      }
      if (!date || (!date.includes(this.config.journeyDate) && !date.includes(this.config.journeyDate.slice(0, 4)))) {
        throw new VerificationError("Journey date was not correctly populated.");
      }
      guardSafety();

      // VERIFYING_FORM -> SEARCHING
      await this.go(BookingState.SEARCHING, "Submitting search.");
      await this.adapter.submitSearch();

      // SEARCHING -> WAITING_FOR_RESULTS
      await this.go(BookingState.WAITING_FOR_RESULTS, "Waiting for search results.");
      await waitFor(
        () => {
          guardSafety();
          return this.adapter.readResults().length > 0;
        },
        { timeoutMs: 30_000 }
      );

      // WAITING_FOR_RESULTS -> EVALUATING_RESULTS
      await this.go(BookingState.EVALUATING_RESULTS, "Evaluating results.");
      guardSafety();
      const results = this.adapter.readResults();
      const match = pickTrain(this.config, results);

      // EVALUATING_RESULTS -> SELECTING_TICKET
      await this.go(
        BookingState.SELECTING_TICKET,
        `Selecting ticket: ${match.trainName}${match.className ? ` (${match.className})` : ""}.`
      );
      guardSafety();
      await this.adapter.chooseResult(match);

      // SELECTING_TICKET -> CHECKOUT_READY -> USER_ACTION_REQUIRED
      guardSafety();
      await this.go(BookingState.CHECKOUT_READY, "Checkout is ready. Review details before payment.");
      // Payment boundary: never auto-pay. Hand control to the user.
      await this.go(
        BookingState.USER_ACTION_REQUIRED,
        "Review passengers, price, date, and train. Complete CAPTCHA/OTP/payment manually."
      );
    } catch (err) {
      const msg = toSafeMessage(err);
      logger.warn("Booking controller stopped", { message: msg });
      if (
        err instanceof SecurityChallengeError ||
        err instanceof LoginRequiredError
      ) {
        try {
          await this.report(BookingState.USER_ACTION_REQUIRED, msg);
        } catch {
          // ignore reporter failure
        }
        this.machine.halt(BookingState.USER_ACTION_REQUIRED);
      } else {
        try {
          await this.report(BookingState.ERROR, msg);
        } catch {
          // ignore
        }
        try {
          this.machine.halt(BookingState.ERROR);
        } catch {
          // already terminal
        }
      }
      throw err;
    }
  }
}
