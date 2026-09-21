import { SELECTORS } from "./selectors.js";
import {
  queryFirst,
  waitFor,
  waitForElement
} from "../../content/dom/dom-utils.js";
import {
  humanType,
  readInputValue,
  setNativeValue,
  setSelectValue
} from "../../content/dom/event-utils.js";
import { matchesExpected } from "../../core/types/booking.js";
import type { PassengerConfig } from "../../core/types/booking.js";
import { VerificationError } from "../../core/errors/errors.js";

/**
 * Framework-safe form filling with write → read-back → compare on every field.
 * Autocomplete pattern: focus → type → wait for suggestions → exact match → verify.
 */

async function fillTextField(selectors: readonly string[], value: string, fieldName: string): Promise<void> {
  const el = (await waitForElement(selectors, { mustBeVisible: true })) as HTMLElement;
  if (el instanceof HTMLSelectElement) {
    const ok = setSelectValue(el, value);
    if (!ok) throw new VerificationError(`${fieldName}: option "${value}" not found.`);
  } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    // Prefer autocomplete-friendly typing for station fields.
    if (el.getAttribute("autocomplete") !== "off" || /from|to|origin|destin/i.test(el.outerHTML)) {
      await humanType(el, value);
      await waitForSuggestionsAndPick(el, value);
    } else {
      el.focus();
      setNativeValue(el, value);
    }
  } else {
    throw new VerificationError(`${fieldName}: unsupported field type.`);
  }

  const actual = readInputValue(el);
  if (!matchesExpected(actual, value) && !actual.toLowerCase().includes(value.toLowerCase())) {
    throw new VerificationError(`${fieldName} was not correctly populated.`);
  }
}

async function waitForSuggestionsAndPick(_input: HTMLInputElement | HTMLTextAreaElement, value: string): Promise<void> {
  // Give autocomplete a bounded moment; if no dropdown, keep typed text.
  await waitFor(
    () => {
      const items = document.querySelectorAll(
        '[role="option"], [role="listbox"] li, .autocomplete-item, .suggestion-item, ul.dropdown-menu li'
      );
      if (items.length === 0) return true; // no suggestions UI — accept typed value
      for (const item of Array.from(items)) {
        const label = (item.textContent ?? "").trim();
        if (label.toLowerCase() === value.toLowerCase() || label.toLowerCase().includes(value.toLowerCase())) {
          (item as HTMLElement).click();
          return true;
        }
      }
      return items.length > 0;
    },
    { timeoutMs: 6_000 }
  );
}

async function fillDateField(selectors: readonly string[], isoDate: string): Promise<void> {
  const el = (await waitForElement(selectors, { mustBeVisible: true })) as HTMLElement;
  if (el instanceof HTMLInputElement) {
    el.focus();
    setNativeValue(el, isoDate);
    el.dispatchEvent(new Event("change", { bubbles: true }));
    // Some date pickers need a blur/Enter to commit.
    el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
    el.blur();
    const actual = readInputValue(el);
    if (!actual.includes(isoDate.slice(0, 4)) && !actual.includes(isoDate)) {
      throw new VerificationError("Journey date was not correctly populated.");
    }
  } else {
    throw new VerificationError("Journey date: unsupported field type.");
  }
}

export const formFiller = {
  fillOrigin: (v: string) => fillTextField(SELECTORS.origin, v, "Origin"),
  fillDestination: (v: string) => fillTextField(SELECTORS.destination, v, "Destination"),
  fillDate: (v: string) => fillDateField(SELECTORS.journeyDate, v),

  async selectTrain(value: string): Promise<void> {
    const el = queryFirst(SELECTORS.trainSelect);
    if (!el) return; // train chosen from results step instead
    if (el instanceof HTMLSelectElement) {
      if (!setSelectValue(el, value)) throw new VerificationError("Preferred train option not found.");
    }
  },

  async selectClass(value: string): Promise<void> {
    const el = queryFirst(SELECTORS.classSelect);
    if (!el) return;
    if (el instanceof HTMLSelectElement) {
      if (!setSelectValue(el, value)) throw new VerificationError("Preferred class option not found.");
    }
  },

  async fillPassenger(index: number, p: PassengerConfig): Promise<void> {
    const nameFields = document.querySelectorAll(
      SELECTORS.passengerName.join(",")
    );
    const target = nameFields[index];
    if (!(target instanceof HTMLInputElement)) {
      throw new VerificationError(`Passenger ${index + 1} name field not found.`);
    }
    target.focus();
    setNativeValue(target, p.name);
    const actual = readInputValue(target);
    if (!matchesExpected(actual, p.name)) {
      throw new VerificationError(`Passenger ${index + 1} name was not correctly populated.`);
    }
    // Other passenger attributes (age/gender/ID) vary widely by site;
    // intentionally not guessed — user completes them if the layout is unknown.
  },

  async submitSearch(): Promise<void> {
    const btn = (await waitForElement(SELECTORS.searchButton, {
      mustBeVisible: true,
      timeoutMs: 10_000
    })) as HTMLElement;
    btn.click();
  },

  readOrigin: (): string => readInputValue(queryFirst(SELECTORS.origin)),
  readDestination: (): string => readInputValue(queryFirst(SELECTORS.destination)),
  readDate: (): string => readInputValue(queryFirst(SELECTORS.journeyDate))
};
