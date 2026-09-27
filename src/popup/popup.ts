import { MESSAGE_TYPES } from "../shared/messages.js";
import type { BookingConfig } from "../core/types/booking.js";
import { BookingState } from "../core/types/booking.js";
import { RAILWAY_ORIGINS } from "../shared/constants.js";
import { STORAGE_KEYS } from "../shared/constants.js";
import {
  bookingTimeFrom,
  checkEl,
  collectPassengerNames,
  el,
  inputEl,
  paintPrimary,
  paintStatus,
  renderPassengerInputs,
  toTimeValue
} from "../shared/ui-form.js";

/**
 * Popup: spec §2. Trip form only — preferred train/class, timezone and the
 * exact booking instant live in Options; this page reuses the stored values
 * so the layout stays exactly as specified. Watch-from is a time of day on
 * the journey date; the computed instant is shown, never silently used.
 */

let storedTimezone = "Asia/Dhaka";
let storedTrain: string | undefined;
let storedClass: string | undefined;
let storedBookingTime: string | undefined;
let lastStored: BookingConfig | null = null;

function showErrors(errors: string[]): void {
  el("formErrors").textContent = errors.join("\n");
}

function refreshHint(): void {
  const date = inputEl("journeyDate").value;
  const time = inputEl("watchFrom").value;
  const hint = el("watchHint");
  if (!date || !time) {
    hint.textContent = `Booking window opens at the time above, in ${storedTimezone}.`;
    return;
  }
  try {
    const iso = bookingTimeFrom(date, time);
    const d = new Date(iso);
    const pad = (n: number): string => String(n).padStart(2, "0");
    hint.textContent =
      `Booking window opens ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
      `${pad(d.getHours())}:${pad(d.getMinutes())}, ${storedTimezone}.`;
  } catch {
    hint.textContent = `Booking window opens at the time above, in ${storedTimezone}.`;
  }
}

async function loadIntoForm(): Promise<void> {
  const raw = await chrome.storage.local.get(STORAGE_KEYS.config);
  const config = raw[STORAGE_KEYS.config] as BookingConfig | undefined;
  lastStored = config ?? null;
  if (!config) {
    renderPassengerInputs("passengers", "addPassenger", [{ name: "" }]);
    refreshHint();
    updateSaveVisibility();
    return;
  }
  inputEl("origin").value = config.origin;
  inputEl("destination").value = config.destination;
  inputEl("journeyDate").value = config.journeyDate;
  inputEl("allowSubstitution").checked = config.allowSubstitution === true;
  storedTimezone = config.timezone || "Asia/Dhaka";
  storedTrain = config.preferredTrain;
  storedClass = config.preferredClass;
  storedBookingTime = config.bookingTime;
  inputEl("watchFrom").value = toTimeValue(config.bookingTime) || "08:00";
  renderPassengerInputs("passengers", "addPassenger", config.passengers);
  refreshHint();
  updateSaveVisibility();
}

/** Visible form state; compared against storage for dirtiness. */
function formFingerprint(): string {
  return JSON.stringify([
    inputEl("origin").value.trim(),
    inputEl("destination").value.trim(),
    inputEl("journeyDate").value,
    inputEl("watchFrom").value,
    collectPassengerNames("passengers").map((p) => p.name).join("|"),
    checkEl("allowSubstitution").checked ? "1" : "0"
  ]);
}

function storedFingerprint(config: BookingConfig): string {
  return JSON.stringify([
    config.origin,
    config.destination,
    config.journeyDate,
    toTimeValue(config.bookingTime),
    config.passengers.map((p) => p.name.trim()).filter((n) => n.length > 0).join("|"),
    config.allowSubstitution === true ? "1" : "0"
  ]);
}

/** Save hides when the form matches storage; any edit brings it back. */
function updateSaveVisibility(): void {
  const btn = el("saveBtn");
  if (!(btn instanceof HTMLButtonElement)) return;
  btn.style.display =
    lastStored === null || formFingerprint() !== storedFingerprint(lastStored) ? "" : "none";
}

function collectConfig(): BookingConfig {
  const passengers = collectPassengerNames("passengers");
  return {
    origin: inputEl("origin").value.trim(),
    destination: inputEl("destination").value.trim(),
    journeyDate: inputEl("journeyDate").value,
    preferredTrain: storedTrain,
    preferredClass: storedClass,
    passengerCount: Math.max(1, passengers.length),
    passengers,
    bookingTime: bookingTimeFrom(inputEl("journeyDate").value, inputEl("watchFrom").value),
    timezone: storedTimezone,
    enabled: true,
    allowSubstitution: checkEl("allowSubstitution").checked || undefined
  };
}

async function saveCurrent(silent: boolean): Promise<boolean> {
  if (!silent) showErrors([]);
  try {
    const config = collectConfig();
    const res = (await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.saveConfig,
      payload: { config }
    })) as { ok: boolean; errors?: string[] };
    if (!res.ok) {
      showErrors(res.errors ?? ["Invalid configuration."]);
      return false;
    }
    storedBookingTime = config.bookingTime;
    lastStored = config;
    updateSaveVisibility();
    await refreshAll();
    return true;
  } catch (err) {
    showErrors([err instanceof Error ? err.message : "Save failed."]);
    return false;
  }
}

async function runPrimary(): Promise<void> {
  const btn = el("primaryBtn");
  if (!(btn instanceof HTMLButtonElement)) return;
  const run = btn.dataset.run ?? "arm";
  showErrors([]);
  if (run === "none") return;
  if (run === "ticket") {
    const url = RAILWAY_ORIGINS[0] ?? "https://eticket.railway.gov.bd/";
    if (typeof chrome.tabs?.create === "function") {
      await chrome.tabs.create({ url });
    } else {
      showErrors([`Open the railway site manually: ${url}`]);
    }
    return;
  }
  if (run === "stop") {
    await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.stop,
      payload: { reason: "Stopped from popup." }
    });
    await refreshAll();
    return;
  }
  // "arm" and "retry": persist the form first so retry uses fresh values.
  if (run === "retry") {
    const ok = await saveCurrent(true);
    if (!ok) return;
  }
  const res = (await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.arm })) as {
    ok: boolean;
    errors?: string[];
  };
  if (!res.ok) showErrors(res.errors ?? ["Could not arm. Save a valid config first."]);
  await refreshAll();
}

async function refreshAll(): Promise<void> {
  const shown = await paintStatus("statusbar", "statusTitle", "statusDesc");
  await paintPrimary("primaryBtn", shown);
}

document.getElementById("tripForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  void saveCurrent(false);
});

el("primaryBtn").addEventListener("click", () => {
  void runPrimary();
});

inputEl("journeyDate").addEventListener("input", refreshHint);
inputEl("watchFrom").addEventListener("input", refreshHint);

el("addPassenger").addEventListener("click", () => {
  const current = collectPassengerNames("passengers");
  if (current.length >= 6) return;
  renderPassengerInputs("passengers", "addPassenger", [...current, { name: "" }]);
  updateSaveVisibility();
});

el("tripForm").addEventListener("input", () => {
  updateSaveVisibility();
});

void (async () => {
  await loadIntoForm();
  await refreshAll();
  window.setInterval(() => void refreshAll(), 2000);
})();
