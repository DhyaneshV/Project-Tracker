import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// ─── JWT Access Tokens ──────────────────────────────────────────

/** Generate a short-lived access token (15 minutes) */
export const generateAccessToken = (payload: object, secret: string): string => {
  return jwt.sign(payload, secret, { expiresIn: '15m' });
};

/** Generate a long-lived access token (legacy - 1 day for backward compat) */
export const generateToken = (payload: object, secret: string, expiresIn: any = '1d'): string => {
  return jwt.sign(payload, secret, { expiresIn });
};

/** Verify and decode a JWT token */
export const verifyToken = (token: string, secret: string): any => {
  try {
    return jwt.verify(token, secret);
  } catch (err) {
    return null;
  }
};

// ─── Refresh Tokens ─────────────────────────────────────────────

/** 
 * Generate a cryptographically secure refresh token.
 * Refresh tokens are opaque strings (not JWTs) stored server-side.
 * They have a 7-day lifetime.
 */
export const generateRefreshToken = (): string => {
  return crypto.randomBytes(48).toString('base64url');
};

/** Refresh token expiry in seconds (7 days) */
export const REFRESH_TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60;

/** Access token expiry in seconds (15 minutes) */
export const ACCESS_TOKEN_EXPIRY_SECONDS = 15 * 60;

// ─── Cookie Configuration ───────────────────────────────────────

/**
 * Get cookie options for the refresh token.
 * httpOnly: true - not accessible via JavaScript (XSS protection)
 * secure: true in production - only sent over HTTPS
 * sameSite: 'strict' - CSRF protection
 * path: '/auth/refresh' - only sent to the refresh endpoint
 */
export const getRefreshCookieOptions = (isProduction: boolean) => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: 'strict' as const,
  path: '/auth/refresh',
  maxAge: REFRESH_TOKEN_EXPIRY_SECONDS * 1000, // milliseconds
});

// ─── OAuth Utilities ────────────────────────────────────────────

export const getGoogleAuthUrl = (clientId: string, redirectUri: string) => {
  const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  const options = {
    redirect_uri: redirectUri,
    client_id: clientId,
    access_type: 'offline',
    response_type: 'code',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' '),
  };
  return `${rootUrl}?${new URLSearchParams(options).toString()}`;
};

export const getGitHubAuthUrl = (clientId: string, redirectUri: string) => {
  const rootUrl = 'https://github.com/login/oauth/authorize';
  const options = {
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'user:email',
  };
  return `${rootUrl}?${new URLSearchParams(options).toString()}`;
};
