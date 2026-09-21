import { MESSAGE_TYPES } from "../shared/messages.js";
import type { BookingConfig, PassengerConfig } from "../core/types/booking.js";
import { STORAGE_KEYS } from "../shared/constants.js";

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

function input(id: string): HTMLInputElement {
  const el = $(id);
  if (!(el instanceof HTMLInputElement)) throw new Error(`#${id} is not an input`);
  return el;
}

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(local: string): string {
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid booking time");
  return d.toISOString();
}

function passengerInputs(): PassengerConfig[] {
  const container = $("passengers");
  const names = Array.from(container.querySelectorAll<HTMLInputElement>('input[data-passenger-name]'));
  return names.map((el) => ({ name: el.value.trim() })).filter((p) => p.name.length > 0);
}

function renderPassengers(passengers: PassengerConfig[]): void {
  const container = $("passengers");
  container.innerHTML = "";
  const list = passengers.length > 0 ? passengers : [{ name: "" }];
  list.forEach((p, i) => {
    const div = document.createElement("div");
    div.className = "passenger";
    const label = document.createElement("label");
    label.textContent = `Passenger ${i + 1} name `;
    const inp = document.createElement("input");
    inp.type = "text";
    inp.maxLength = 100;
    inp.setAttribute("data-passenger-name", String(i));
    inp.value = p.name;
    inp.autocomplete = "off";
    label.appendChild(inp);
    div.appendChild(label);
    container.appendChild(div);
  });
}

async function refreshStatus(): Promise<void> {
  try {
    const res = (await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.getStatus })) as {
      ok: boolean;
      payload?: { state: string; detail: string };
    };
    if (res?.ok && res.payload) {
      $("state").textContent = res.payload.state;
      $("detail").textContent = res.payload.detail;
    }
  } catch {
    $("detail").textContent = "Background unavailable.";
  }
}

async function loadIntoForm(): Promise<void> {
  const raw = await chrome.storage.local.get(STORAGE_KEYS.config);
  const config = raw[STORAGE_KEYS.config] as BookingConfig | undefined;
  if (!config) {
    renderPassengers([{ name: "" }]);
    return;
  }
  input("origin").value = config.origin;
  input("destination").value = config.destination;
  input("journeyDate").value = config.journeyDate;
  input("preferredTrain").value = config.preferredTrain ?? "";
  input("preferredClass").value = config.preferredClass ?? "";
  try {
    input("bookingTime").value = toDatetimeLocalValue(config.bookingTime);
  } catch {
    input("bookingTime").value = "";
  }
  input("timezone").value = config.timezone || "Asia/Dhaka";
  input("allowSubstitution").checked = config.allowSubstitution === true;
  renderPassengers(config.passengers);
}

function collectConfig(): BookingConfig {
  const passengers = passengerInputs();
  return {
    origin: input("origin").value.trim(),
    destination: input("destination").value.trim(),
    journeyDate: input("journeyDate").value,
    preferredTrain: input("preferredTrain").value.trim() || undefined,
    preferredClass: input("preferredClass").value.trim() || undefined,
    passengerCount: Math.max(1, passengers.length),
    passengers,
    bookingTime: fromDatetimeLocalValue(input("bookingTime").value),
    timezone: input("timezone").value.trim() || "Asia/Dhaka",
    enabled: true,
    allowSubstitution: input("allowSubstitution").checked || undefined
  };
}

function showErrors(errors: string[]): void {
  $("formErrors").textContent = errors.join("\n");
}

document.getElementById("configForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  void (async () => {
    showErrors([]);
    try {
      const config = collectConfig();
      const res = (await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.saveConfig,
        payload: { config }
      })) as { ok: boolean; errors?: string[] };
      if (!res.ok) {
        showErrors(res.errors ?? ["Invalid configuration."]);
        return;
      }
      await refreshStatus();
    } catch (err) {
      showErrors([err instanceof Error ? err.message : "Save failed."]);
    }
  })();
});

$("addPassenger").addEventListener("click", () => {
  const current = passengerInputs();
  if (current.length >= 6) return;
  renderPassengers([...current, { name: "" }]);
});

$("armBtn").addEventListener("click", () => {
  void (async () => {
    showErrors([]);
    const res = (await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.arm })) as {
      ok: boolean;
      errors?: string[];
    };
    if (!res.ok) showErrors(res.errors ?? ["Could not arm."]);
    await refreshStatus();
  })();
});

$("stopBtn").addEventListener("click", () => {
  void (async () => {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.stop, payload: { reason: "Stopped from options." } });
    await refreshStatus();
  })();
});

$("clearPassengers").addEventListener("click", () => {
  void (async () => {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.clearPassengerData });
    await loadIntoForm();
    await refreshStatus();
  })();
});

$("clearAll").addEventListener("click", () => {
  void (async () => {
    if (!window.confirm("Delete all locally stored extension data?")) return;
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.clearAllData });
    await loadIntoForm();
    await refreshStatus();
  })();
});

void (async () => {
  await loadIntoForm();
  await refreshStatus();
  window.setInterval(() => void refreshStatus(), 2000);
})();
