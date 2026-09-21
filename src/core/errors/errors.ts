/** Typed errors. Messages must never include passenger PII or secrets. */

export class VerificationError extends Error {
  readonly code = "VERIFICATION_FAILED";
  constructor(message: string) {
    super(message);
    this.name = "VerificationError";
  }
}

export class SecurityChallengeError extends Error {
  readonly code = "SECURITY_CHALLENGE";
  constructor(message: string) {
    super(message);
    this.name = "SecurityChallengeError";
  }
}

export class LoginRequiredError extends Error {
  readonly code = "LOGIN_REQUIRED";
  constructor(message: string) {
    super(message);
    this.name = "LoginRequiredError";
  }
}

export class AmbiguousSelectionError extends Error {
  readonly code = "AMBIGUOUS_SELECTION";
  constructor(message: string) {
    super(message);
    this.name = "AmbiguousSelectionError";
  }
}

export class NoMatchError extends Error {
  readonly code = "NO_MATCH";
  constructor(message: string) {
    super(message);
    this.name = "NoMatchError";
  }
}

export class TimeoutError extends Error {
  readonly code = "TIMEOUT";
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

export class ConfigError extends Error {
  readonly code = "INVALID_CONFIG";
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export function toSafeMessage(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return "Unknown error";
}
