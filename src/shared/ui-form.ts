import { BookingState } from "../core/types/booking.js";
import type { PassengerConfig } from "../core/types/booking.js";
import { MESSAGE_TYPES } from "./messages.js";

/** Spec §4 display states (Idle/Armed/Running/Success/Error). */
export type DisplayKey = "idle" | "armed" | "running" | "success" | "error";

export interface DisplayState {
  key: DisplayKey;
  title: string;
  description: string;
}

const FALLBACK: Record<DisplayKey, { title: string; description: string }> = {
  idle: { title: "Idle", description: "Set your trip, then arm the assistant." },
  armed: { title: "Armed", description: "Waiting for the booking window to open." },
  running: {
    title: "Booking now",
    description: "Filling the form on the railway site — don't close the tab."
  },
  success: {
    title: "Seat secured",
    description: "Ticket filled and ready to pay on the railway site."
  },
  error: {
    title: "Couldn't finish",
    description: "The exact class wasn't available and substitution is off."
  }
};

export function displayStateFor(state: BookingState, detail: string): DisplayState {
  const d = detail.trim();
  switch (state) {
    case BookingState.IDLE:
    case BookingState.STOPPED:
      return { key: "idle", ...FALLBACK.idle };
    case BookingState.ARMED:
    case BookingState.WAITING_FOR_TIME:
    case BookingState.WAITING_FOR_PAGE:
    case BookingState.PAGE_READY:
      return { key: "armed", ...FALLBACK.armed };
    case BookingState.FILLING_FORM:
    case BookingState.VERIFYING_FORM:
    case BookingState.SEARCHING:
    case BookingState.WAITING_FOR_RESULTS:
    case BookingState.EVALUATING_RESULTS:
    case BookingState.SELECTING_TICKET:
      return { key: "running", ...FALLBACK.running };
    case BookingState.CHECKOUT_READY:
    case BookingState.COMPLETED:
      return { key: "success", ...FALLBACK.success };
    case BookingState.USER_ACTION_REQUIRED:
      // No spec row covers a mid-flow handoff (CAPTCHA/OTP/queue): red
      // draws the eye, but the title stays truthful and the description
      // is always the live instruction, never a generic label.
      return { key: "error", title: "Needs you", description: d || "The railway site needs you — take over in the tab." };
    case BookingState.ERROR:
    default:
      return {
        key: "error",
        title: FALLBACK.error.title,
        description: d || FALLBACK.error.description
      };
  }
}

export type PrimaryAction =
  | { label: string; run: "arm" | "stop" | "retry" | "ticket" | "none"; disabled: boolean };

export function primaryFor(key: DisplayKey, detail: string): PrimaryAction {
  switch (key) {
    case "idle":
      return { label: "Arm the assistant", run: "arm", disabled: false };
    case "armed":
      return { label: "Stop watching", run: "stop", disabled: false };
    case "running":
      return { label: "Booking…", run: "none", disabled: true };
    case "success":
      return { label: "View ticket details", run: "ticket", disabled: false };
    case "error":
      return detail.trim().length > 0
        ? { label: "Try again", run: "retry", disabled: false }
        : { label: "Arm the assistant", run: "arm", disabled: false };
  }
}

/* ---------- tiny DOM + messaging helpers shared by popup/options ---------- */

export function el(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node;
}

export function inputEl(id: string): HTMLInputElement {
  const node = el(id);
  if (!(node instanceof HTMLInputElement)) throw new Error(`#${id} is not an input`);
  return node;
}

export function checkEl(id: string): HTMLInputElement {
  return inputEl(id);
}

/** "YYYY-MM-DDTHH:MM" (local) from an ISO instant; "" when unparseable. */
export function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "HH:MM" (local) from an ISO instant; "" when unparseable. */
export function toTimeValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Booking instant from a journey date + watch time, interpreted in the
 * user's local zone (same semantics the old datetime-local field had).
 * Throws on invalid input. Callers display the result, never silently use it.
 */
export function bookingTimeFrom(journeyDate: string, watchTime: string): string {
  const d = new Date(`${journeyDate}T${watchTime}:00`);
  if (Number.isNaN(d.getTime())) throw new Error("Journey date or watch time is invalid");
  return d.toISOString();
}

export function collectPassengerNames(containerId: string): PassengerConfig[] {
  const container = el(containerId);
  const names = Array.from(
    container.querySelectorAll<HTMLInputElement>("input[data-passenger-name]")
  );
  return names
    .map((node) => ({ name: node.value.trim() }))
    .filter((p) => p.name.length > 0);
}

export function renderPassengerInputs(
  containerId: string,
  addBtnId: string,
  passengers: PassengerConfig[]
): void {
  const container = el(containerId);
  const addBtn = el(addBtnId);
  container.innerHTML = "";
  const list = passengers.length > 0 ? passengers : [{ name: "" }];
  list.forEach((p, i) => {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const label = document.createElement("label");
    label.textContent = `Passenger ${i + 1}`;
    const inp = document.createElement("input");
    inp.type = "text";
    inp.maxLength = 100;
    inp.autocomplete = "off";
    inp.placeholder = "Full name as on ID";
    inp.setAttribute("data-passenger-name", String(i));
    inp.value = p.name;
    label.appendChild(inp);
    wrap.appendChild(label);
    container.appendChild(wrap);
  });
  const count = list.length;
  if (addBtn instanceof HTMLButtonElement) {
    addBtn.textContent = `+ Add passenger — ${count} of 6`;
    addBtn.style.display = count >= 6 ? "none" : "";
  }
}

export interface StatusPayload {
  state: BookingState;
  detail: string;
}

export async function fetchStatus(): Promise<StatusPayload | null> {
  try {
    const res = (await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.getStatus
    })) as { ok: boolean; payload?: { state: BookingState; detail: string } };
    return res?.ok && res.payload ? res.payload : null;
  } catch {
    return null;
  }
}

export async function paintStatus(barId: string, titleId: string, descId: string): Promise<DisplayState | null> {
  const payload = await fetchStatus();
  const bar = el(barId);
  if (!payload) {
    bar.setAttribute("data-state", "error");
    el(titleId).textContent = "Couldn't finish";
    el(descId).textContent = "Background unavailable. Reload the extension.";
    return null;
  }
  const shown = displayStateFor(payload.state, payload.detail);
  bar.setAttribute("data-state", shown.key);
  el(titleId).textContent = shown.title;
  el(descId).textContent = shown.description;
  return shown;
}

export async function paintPrimary(btnId: string, shown: DisplayState | null): Promise<void> {
  const btn = el(btnId);
  if (!(btn instanceof HTMLButtonElement)) return;
  if (!shown) {
    btn.textContent = "Arm the assistant";
    btn.disabled = true;
    btn.setAttribute("data-state", "error");
    return;
  }
  const action = primaryFor(shown.key, shown.description);
  btn.textContent = action.label;
  btn.disabled = action.disabled;
  btn.setAttribute("data-state", shown.key);
  btn.dataset.run = action.run;
}
