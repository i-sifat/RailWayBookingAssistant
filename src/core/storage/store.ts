import { STORAGE_KEYS } from "../../shared/constants.js";
import type { BookingConfig, RuntimeStatus } from "../types/booking.js";
import { defaultRuntimeStatus } from "../types/booking.js";
import { parseConfig } from "../validation/config.js";

/**
 * Typed wrapper over chrome.storage.local. Local-only, no sync, no telemetry.
 */

export async function loadConfig(): Promise<BookingConfig | null> {
  const raw = await chrome.storage.local.get(STORAGE_KEYS.config);
  const value = raw[STORAGE_KEYS.config] as unknown;
  if (value == null) return null;
  const parsed = parseConfig(value);
  return parsed.ok ? parsed.value : null;
}

export async function saveConfig(config: BookingConfig): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.config]: config });
}

export async function loadRuntime(): Promise<RuntimeStatus> {
  const raw = await chrome.storage.local.get(STORAGE_KEYS.runtime);
  const value = raw[STORAGE_KEYS.runtime] as RuntimeStatus | undefined;
  return value ?? defaultRuntimeStatus();
}

export async function saveRuntime(status: RuntimeStatus): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.runtime]: status });
}

/** Remove passenger array but keep non-sensitive trip preferences. */
export async function clearPassengerData(): Promise<void> {
  const config = await loadConfig();
  if (!config) return;
  const scrubbed: BookingConfig = {
    ...config,
    passengerCount: 0,
    passengers: [],
    enabled: false
  };
  await saveConfig(scrubbed);
}

export async function clearAllData(): Promise<void> {
  await chrome.storage.local.remove([
    STORAGE_KEYS.config,
    STORAGE_KEYS.runtime
  ]);
}
