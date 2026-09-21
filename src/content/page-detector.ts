import { BOOKING_PAGE_URL_PATTERNS } from "../shared/constants.js";
import { RailwayAdapter } from "../adapters/railway/booking-flow.js";

const adapter = new RailwayAdapter();

export const pageDetector = {
  isExpectedBookingUrl(url = location.href): boolean {
    return BOOKING_PAGE_URL_PATTERNS.some((re) => re.test(url));
  },
  isBookingPage(): boolean {
    return adapter.isBookingPage();
  },
  isSearchFormReady(): boolean {
    return adapter.isSearchFormReady();
  },
  hasSecurityChallenge(): boolean {
    return adapter.detectSecurityChallenge();
  },
  needsLogin(): boolean {
    return adapter.detectLoginRequired();
  },
  isUnexpected(): boolean {
    return adapter.detectUnexpectedState();
  }
};
