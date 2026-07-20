/**
 * Rate Limiter - In-memory sliding window rate limiter for GraphQL operations.
 * 
 * Protects sensitive endpoints:
 * - login: 5 attempts per minute per IP
 * - verifyLoginOTP: 5 attempts per minute per IP
 * - requestSecurityOTP: 3 attempts per minute per IP
 * - signup: 10 attempts per hour per IP
 * - inviteUser: 20 attempts per hour per IP
 * 
 * For multi-instance deployments (Lambda), replace with DynamoDB-backed
 * rate limiting using atomic counters with TTL.
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  login: { maxAttempts: 5, windowMs: 60_000 },        // 5 per minute
  verifyLoginOTP: { maxAttempts: 5, windowMs: 60_000 }, // 5 per minute
  requestSecurityOTP: { maxAttempts: 3, windowMs: 60_000 }, // 3 per minute
  signup: { maxAttempts: 10, windowMs: 3_600_000 },    // 10 per hour
  inviteUser: { maxAttempts: 20, windowMs: 3_600_000 }, // 20 per hour
  dropUser: { maxAttempts: 5, windowMs: 3_600_000 },   // 5 per hour
  changePassword: { maxAttempts: 5, windowMs: 3_600_000 }, // 5 per hour
};

function getStore(operation: string): Map<string, RateLimitEntry> {
  if (!stores.has(operation)) {
    stores.set(operation, new Map());
  }
  return stores.get(operation)!;
}

/**
 * Check if a request should be rate-limited.
 * @returns null if allowed, or an error message string if blocked.
 */
export function checkRateLimit(operation: string, clientIp: string): string | null {
  const config = RATE_LIMITS[operation];
  if (!config) return null; // No rate limit configured for this operation

  const store = getStore(operation);
  const key = clientIp;
  const now = Date.now();

  const entry = store.get(key);

  if (!entry || now - entry.windowStart > config.windowMs) {
    // New window or expired window
    store.set(key, { count: 1, windowStart: now });
    return null;
  }

  if (entry.count >= config.maxAttempts) {
    const remainingMs = config.windowMs - (now - entry.windowStart);
    const remainingSec = Math.ceil(remainingMs / 1000);
    return `Rate limit exceeded for ${operation}. Try again in ${remainingSec} seconds.`;
  }

  entry.count++;
  return null;
}

/**
 * Get the client IP from the Express request, handling proxies.
 */
export function getClientIp(req: any): string {
  // Trust X-Forwarded-For from API Gateway/CloudFront
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

/**
 * Extract the GraphQL operation name from the request body.
 * Works for both named and unnamed operations.
 */
export function extractOperationName(body: any): string | null {
  if (!body) return null;
  
  // Use the explicit operationName field if provided
  if (body.operationName) return body.operationName;
  
  // Parse from query string
  const query = body.query;
  if (!query || typeof query !== 'string') return null;
  
  // Match: mutation Login or mutation { login
  const mutationMatch = query.match(/mutation\s+(\w+)/i);
  if (mutationMatch) return mutationMatch[1];
  
  // Match the actual resolver name from the query body
  // e.g., "mutation { login(email..." → "login"
  const resolverMatch = query.match(/mutation\s*(?:\w+\s*)?\{[\s\n]*(\w+)/i);
  if (resolverMatch) return resolverMatch[1];
  
  return null;
}

// Periodic cleanup of expired entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [opName, store] of stores) {
    const config = RATE_LIMITS[opName];
    if (!config) continue;
    for (const [key, entry] of store) {
      if (now - entry.windowStart > config.windowMs) {
        store.delete(key);
      }
    }
  }
}, 300_000);
