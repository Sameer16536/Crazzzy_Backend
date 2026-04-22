import crypto from 'crypto';
import jwt from 'jsonwebtoken';

interface UserPayload {
  id: number;
  email: string;
  role: string;
}

// ── Access Token (short-lived) ────────────────────────────────────────────────

/**
 * Sign a short-lived JWT access token.
 * Embeds jti (JWT ID) so it can be tracked / revoked in the future.
 *
 * @param user
 * @returns signed JWT
 */
export function signAccessToken(user: UserPayload): string {
  return jwt.sign(
    {
      id   : user.id,
      email: user.email,
      role : user.role,
      jti  : crypto.randomUUID(),           // unique token ID
    },
    process.env.JWT_SECRET as string,
    { expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || '15m') as any }
  );
}

// ── Refresh Token ─────────────────────────────────────────────────────────────

/**
 * Generate a cryptographically random 64-byte hex refresh token.
 * The raw value is given to the client; only the hash is stored in the DB.
 *
 * @returns 128-character hex string
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

/**
 * SHA-256 hash of a refresh token for safe DB storage.
 * Never store the raw token — only the hash.
 *
 * @param token  raw refresh token
 * @returns      64-char hex SHA-256 digest
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Calculate refresh token expiry Date.
 * Default: 30 days, configurable via JWT_REFRESH_EXPIRES_IN env var.
 *
 * @returns Date
 */
export function refreshTokenExpiresAt(): Date {
  const raw = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
  const match = raw.match(/^(\d+)([dhm])$/);
  if (!match) return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const value = parseInt(match[1], 10);
  const unit  = match[2];
  const ms = unit === 'd' ? value * 24 * 60 * 60 * 1000
           : unit === 'h' ? value * 60 * 60 * 1000
           : unit === 'm' ? value * 60 * 1000
           : 30 * 24 * 60 * 60 * 1000;

  return new Date(Date.now() + ms);
}
