import { z } from "zod";
import type { BookingConfig } from "../types/booking.js";

const passengerSchema = z.object({
  name: z.string().trim().min(1, "Passenger name required").max(100),
  identificationType: z.string().max(50).optional(),
  identificationNumber: z.string().max(50).optional(),
  gender: z.string().max(20).optional(),
  age: z.number().int().min(0).max(150).optional()
});

const configSchema = z
  .object({
    origin: z.string().trim().min(1, "Origin required").max(100),
    destination: z.string().trim().min(1, "Destination required").max(100),
    journeyDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "journeyDate must be YYYY-MM-DD"),
    preferredTrain: z.string().max(100).optional(),
    preferredClass: z.string().max(50).optional(),
    passengerCount: z.number().int().min(1).max(6),
    passengers: z.array(passengerSchema).min(1).max(6),
    bookingTime: z.string().refine(
      (s) => !Number.isNaN(Date.parse(s)),
      "bookingTime must be a valid ISO datetime"
    ),
    timezone: z.string().min(1).max(60),
    enabled: z.boolean(),
    allowSubstitution: z.boolean().optional()
  })
  .refine((c) => c.origin.trim().toLowerCase() !== c.destination.trim().toLowerCase(), {
    message: "Origin and destination must differ",
    path: ["destination"]
  })
  .refine((c) => c.passengers.length >= Math.min(c.passengerCount, c.passengers.length), {
    message: "Passengers list must not be empty"
  });

export type ValidationResult =
  | { ok: true; value: BookingConfig }
  | { ok: false; errors: string[] };

export function parseConfig(input: unknown): ValidationResult {
  const res = configSchema.safeParse(input);
  if (res.success) return { ok: true, value: res.data };
  return {
    ok: false,
    errors: res.error.issues.map((i) => `${i.path.join(".") || "config"}: ${i.message}`)
  };
}

export function validateConfigOrThrow(input: unknown): BookingConfig {
  const res = parseConfig(input);
  if (!res.ok) throw new Error(`Invalid config: ${res.errors.join("; ")}`);
  return res.value;
}
