import { MESSAGE_TYPES } from "../shared/messages.js";
import type { BookingConfig } from "../core/types/booking.js";
import { RAILWAY_ORIGINS, STORAGE_KEYS } from "../shared/constants.js";
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
 * Options: spec §3 two-pane layout (Trip / Passengers / Automation /
 * Privacy). One shared form model with the popup; panels only organize
 * the same fields. Watch-from edits the time part of the exact booking
 * instant; the computed result is shown, never silently used.
 */

function showErrors(errors: string[]): void {
  el("formErrors").textContent = errors.join("\n");
}

function refreshHint(): void {
  const date = inputEl("journeyDate").value;
  const time = inputEl("watchFrom").value;
  const hint = el("watchHint");
  const zone = inputEl("timezone").value.trim() || "Asia/Dhaka";
  if (!date || !time) {
    hint.textContent = `Booking window opens at the time above, in ${zone}.`;
    return;
  }
  try {
    const d = new Date(bookingTimeFrom(date, time));
    const pad = (n: number): string => String(n).padStart(2, "0");
    hint.textContent =
      `Booking window opens ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
      `${pad(d.getHours())}:${pad(d.getMinutes())}, ${zone}.`;
  } catch {
    hint.textContent = `Booking window opens at the time above, in ${zone}.`;
  }
}

function syncAutomationFromTrip(): void {
  try {
    const iso = bookingTimeFrom(inputEl("journeyDate").value, inputEl("watchFrom").value);
    const d = new Date(iso);
    const pad = (n: number): string => String(n).padStart(2, "0");
    inputEl("bookingTimeAuto").value =
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    // Leave the exact field untouched when the trip fields are incomplete.
  }
  refreshHint();
}

async function loadIntoForm(): Promise<void> {
  const raw = await chrome.storage.local.get(STORAGE_KEYS.config);
  const config = raw[STORAGE_KEYS.config] as BookingConfig | undefined;
  if (!config) {
    renderPassengerInputs("passengers", "addPassenger", [{ name: "" }]);
    refreshHint();
    return;
  }
  inputEl("origin").value = config.origin;
  inputEl("destination").value = config.destination;
  inputEl("journeyDate").value = config.journeyDate;
  inputEl("preferredTrain").value = config.preferredTrain ?? "";
  inputEl("preferredClass").value = config.preferredClass ?? "";
  inputEl("allowSubstitution").checked = config.allowSubstitution === true;
  inputEl("watchFrom").value = toTimeValue(config.bookingTime) || "08:00";
  inputEl("timezone").value = config.timezone || "Asia/Dhaka";
  try {
    const d = new Date(config.bookingTime);
    if (!Number.isNaN(d.getTime())) {
      const pad = (n: number): string => String(n).padStart(2, "0");
      inputEl("bookingTimeAuto").value =
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  } catch {
    inputEl("bookingTimeAuto").value = "";
  }
  renderPassengerInputs("passengers", "addPassenger", config.passengers);
  refreshHint();
}

function exactInstant(): string {
  const manual = inputEl("bookingTimeAuto").value.trim();
  if (manual) {
    const d = new Date(manual);
    if (Number.isNaN(d.getTime())) throw new Error("Exact booking instant is invalid");
    return d.toISOString();
  }
  return bookingTimeFrom(inputEl("journeyDate").value, inputEl("watchFrom").value);
}

function collectConfig(): BookingConfig {
  const passengers = collectPassengerNames("passengers");
  return {
    origin: inputEl("origin").value.trim(),
    destination: inputEl("destination").value.trim(),
    journeyDate: inputEl("journeyDate").value,
    preferredTrain: inputEl("preferredTrain").value.trim() || undefined,
    preferredClass: inputEl("preferredClass").value.trim() || undefined,
    passengerCount: Math.max(1, passengers.length),
    passengers,
    bookingTime: exactInstant(),
    timezone: inputEl("timezone").value.trim() || "Asia/Dhaka",
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
      payload: { reason: "Stopped from options." }
    });
    await refreshAll();
    return;
  }
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

function switchPanel(name: string): void {
  const nav = document.querySelectorAll<HTMLButtonElement>(".onav button");
  nav.forEach((b) => {
    if (b.dataset.panel === name) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  const panes = document.querySelectorAll<HTMLElement>("section[data-pane]");
  panes.forEach((p) => {
    p.hidden = p.dataset.pane !== name;
  });
}

document.querySelectorAll<HTMLButtonElement>(".onav button").forEach((b) => {
  b.addEventListener("click", () => switchPanel(b.dataset.panel ?? "trip"));
});

el("saveBtn").addEventListener("click", () => {
  void saveCurrent(false);
});

el("primaryBtn").addEventListener("click", () => {
  void runPrimary();
});

for (const id of ["journeyDate", "watchFrom", "timezone"]) {
  inputEl(id).addEventListener("input", syncAutomationFromTrip);
}

el("addPassenger").addEventListener("click", () => {
  const current = collectPassengerNames("passengers");
  if (current.length >= 6) return;
  renderPassengerInputs("passengers", "addPassenger", [...current, { name: "" }]);
});

el("clearPassengers").addEventListener("click", () => {
  void (async () => {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.clearPassengerData });
    await loadIntoForm();
    await refreshAll();
  })();
});

el("clearAll").addEventListener("click", () => {
  void (async () => {
    if (!window.confirm("Delete all locally stored extension data?")) return;
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.clearAllData });
    await loadIntoForm();
    await refreshAll();
  })();
});

void (async () => {
  await loadIntoForm();
  await refreshAll();
  window.setInterval(() => void refreshAll(), 2000);
})();
