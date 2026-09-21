/**
 * Centralized selectors, ordered by stability:
 * semantic attributes > accessible labels > names > ids > stable classes.
 * Structural selectors are a last resort. Edit only here when the site changes.
 */

export interface SelectorGroup {
  origin: readonly string[];
  destination: readonly string[];
  journeyDate: readonly string[];
  trainSelect: readonly string[];
  classSelect: readonly string[];
  searchButton: readonly string[];
  resultRows: readonly string[];
  resultTrainName: readonly string[];
  resultClass: readonly string[];
  resultSeats: readonly string[];
  resultSelectButton: readonly string[];
  passengerName: readonly string[];
  loginForm: readonly string[];
  captcha: readonly string[];
  paymentStep: readonly string[];
}

export const SELECTORS: SelectorGroup = {
  origin: [
    '[aria-label="From"]',
    '[aria-label="Origin"]',
    'label[for="from"] + input',
    'input[name="from_station"]',
    'input[name="origin"]',
    'input[name="from"]',
    "#from_station",
    "#origin",
    "#from"
  ],
  destination: [
    '[aria-label="To"]',
    '[aria-label="Destination"]',
    'input[name="to_station"]',
    'input[name="destination"]',
    'input[name="to"]',
    "#to_station",
    "#destination",
    "#to"
  ],
  journeyDate: [
    'input[type="date"][name*="jour"]',
    'input[aria-label*="Journey date" i]',
    'input[name="journey_date"]',
    'input[name="date"]',
    "#journey_date",
    "#journeyDate",
    'input[placeholder*="date" i]'
  ],
  trainSelect: [
    'select[name="train"]',
    'select[aria-label*="train" i]',
    "#train",
    "#trainSelect"
  ],
  classSelect: [
    'select[name="class"]',
    'select[name="seat_class"]',
    'select[aria-label*="class" i]',
    "#class",
    "#seatClass"
  ],
  searchButton: [
    'button[type="submit"]',
    'button[aria-label*="search" i]',
    "#searchBtn",
    'button:has-text("Search")'
  ],
  resultRows: [
    '[data-testid="train-row"]',
    ".train-list .train-row",
    ".search-result-item",
    "table.train-results tbody tr"
  ],
  resultTrainName: [
    '[data-testid="train-name"]',
    ".train-name",
    "td.train-name"
  ],
  resultClass: [
    '[data-testid="train-class"]',
    ".train-class",
    "td.train-class"
  ],
  resultSeats: [
    '[data-testid="train-seats"]',
    ".available-seats",
    "td.available-seats"
  ],
  resultSelectButton: [
    '[data-testid="train-select"]',
    'button[aria-label*="select" i]',
    ".train-row button",
    "button.select-train"
  ],
  passengerName: [
    'input[name*="passenger"][name*="name" i]',
    'input[aria-label*="passenger name" i]',
    ".passenger-row input"
  ],
  loginForm: [
    'input[type="password"]',
    'form[action*="login" i]',
    "#loginForm"
  ],
  captcha: [
    "iframe[src*=\"captcha\" i]",
    "iframe[src*=\"recaptcha\" i]",
    "img[alt*=\"captcha\" i]",
    "[data-testid=\"captcha\"]",
    ".g-recaptcha",
    "#captcha"
  ],
  paymentStep: [
    '[data-testid="payment"]',
    "#payment",
    'form[action*="pay" i]',
    "iframe[src*=\"payment\" i]"
  ]
};
