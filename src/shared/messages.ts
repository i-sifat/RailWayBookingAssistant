import type { BookingConfig } from "../core/types/booking.js";
import type { BookingState } from "../core/types/booking.js";

/** All cross-context messages. No passwords / OTPs / payment data ever travel here. */

export const MESSAGE_TYPES = {
  getStatus: "RBA_GET_STATUS",
  statusUpdate: "RBA_STATUS_UPDATE",
  saveConfig: "RBA_SAVE_CONFIG",
  arm: "RBA_ARM",
  disarm: "RBA_DISARM",
  stop: "RBA_STOP",
  clearPassengerData: "RBA_CLEAR_PASSENGER_DATA",
  clearAllData: "RBA_CLEAR_ALL_DATA",
  bookingDue: "RBA_BOOKING_DUE",
  contentReady: "RBA_CONTENT_READY"
} as const;

export type MessageType = (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES];

export interface StatusPayload {
  state: BookingState;
  detail: string;
  bookingTime: string | null;
  lastError: string | null;
  stoppedReason: string | null;
}

export type ExtensionMessage =
  | { type: typeof MESSAGE_TYPES.getStatus }
  | { type: typeof MESSAGE_TYPES.statusUpdate; payload: StatusPayload }
  | { type: typeof MESSAGE_TYPES.saveConfig; payload: { config: BookingConfig } }
  | { type: typeof MESSAGE_TYPES.arm }
  | { type: typeof MESSAGE_TYPES.disarm }
  | { type: typeof MESSAGE_TYPES.stop; payload?: { reason?: string } }
  | { type: typeof MESSAGE_TYPES.clearPassengerData }
  | { type: typeof MESSAGE_TYPES.clearAllData }
  | { type: typeof MESSAGE_TYPES.bookingDue }
  | { type: typeof MESSAGE_TYPES.contentReady; payload?: { url?: string } };

export function isExtensionMessage(value: unknown): value is ExtensionMessage {
  if (typeof value !== "object" || value === null) return false;
  const t = (value as Record<string, unknown>)["type"];
  return (
    typeof t === "string" &&
    (Object.values(MESSAGE_TYPES) as string[]).includes(t)
  );
}
