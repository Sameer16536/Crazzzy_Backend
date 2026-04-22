import crypto from 'crypto';

/**
 * Generates a cryptographically secure 6-digit OTP.
 * Uses crypto.randomInt — CSPRNG, safe for security-sensitive codes.
 */
export function generateOTP(): string {
  // crypto.randomInt(min, max) returns integer in [min, max)
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Returns the expiry Date object N minutes from now.
 * @param minutes
 * @returns Date
 */
export function otpExpiresAt(minutes: number = 10): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}
