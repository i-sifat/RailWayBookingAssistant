/**
 * Privacy-safe logger. Never log passenger objects, configs with PII,
 * ticket data with identifiers, or page HTML containing personal data.
 */

type Level = "debug" | "info" | "warn" | "error";

const REDACTED = "[REDACTED]";

function sanitize(value: unknown): unknown {
  if (typeof value === "string") {
    // Cheap PII guard: redact long digit runs (IDs, phones, cards).
    if (/\d{6,}/.test(value)) return REDACTED;
    return value;
  }
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/passenger|name|nid|passport|phone|email|card|otp|captcha|token/i.test(k)) {
        out[k] = REDACTED;
      } else {
        out[k] = sanitize(v);
      }
    }
    return out;
  }
  return value;
}

function emit(level: Level, message: string, data?: unknown): void {
  const prefix = `[RBA:${level}]`;
  if (data === undefined) {
    // eslint-disable-next-line no-console
    console.log(prefix, message);
  } else {
    // eslint-disable-next-line no-console
    console.log(prefix, message, sanitize(data));
  }
}

export const logger = {
  debug: (msg: string, data?: unknown) => emit("debug", msg, data),
  info: (msg: string, data?: unknown) => emit("info", msg, data),
  warn: (msg: string, data?: unknown) => emit("warn", msg, data),
  error: (msg: string, data?: unknown) => emit("error", msg, data)
};
