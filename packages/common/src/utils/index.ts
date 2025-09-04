import * as crypto from 'crypto';
import { RETRY_CONFIG } from '../constants';

/**
 * Generate a secure random string
 */
export function generateSecureId(length = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash a string using SHA-256
 */
export function hashString(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Verify HMAC signature for webhooks
 */
export function verifyHmacSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

/**
 * Calculate retry delay with exponential backoff and jitter
 */
export function calculateRetryDelay(
  attempt: number,
  baseDelay = RETRY_CONFIG.INITIAL_DELAY_MS
): number {
  const exponentialDelay = baseDelay * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, attempt - 1);
  const cappedDelay = Math.min(exponentialDelay, RETRY_CONFIG.MAX_DELAY_MS);
  
  // Add jitter to prevent thundering herd
  const jitter = cappedDelay * RETRY_CONFIG.JITTER_FACTOR * Math.random();
  
  return Math.floor(cappedDelay + jitter);
}

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format amount in smallest currency unit (e.g., cents for USD)
 */
export function formatAmount(amount: number, currency: string): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  });
  
  // Convert from smallest unit to major unit
  const majorAmount = amount / 100;
  return formatter.format(majorAmount);
}

/**
 * Validate currency code
 */
export function isValidCurrency(currency: string): boolean {
  try {
    new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: currency.toUpperCase() 
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize metadata object
 */
export function sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(metadata)) {
    // Only allow primitive types and simple objects
    if (typeof value === 'string' || 
        typeof value === 'number' || 
        typeof value === 'boolean' ||
        value === null) {
      sanitized[key] = value;
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      // Recursively sanitize nested objects (one level deep)
      sanitized[key] = sanitizeMetadata(value);
    }
    // Skip arrays, functions, and other complex types
  }
  
  return sanitized;
}

/**
 * Create a debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

/**
 * Create a throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as unknown as T;
  }
  
  const cloned = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  
  return cloned;
}

/**
 * Check if a value is empty (null, undefined, empty string, empty array, empty object)
 */
export function isEmpty(value: any): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  
  if (typeof value === 'string') {
    return value.trim().length === 0;
  }
  
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  
  if (typeof value === 'object') {
    return Object.keys(value).length === 0;
  }
  
  return false;
}

/**
 * Generate a correlation ID for request tracing
 */
export function generateCorrelationId(): string {
  return `req_${Date.now()}_${generateSecureId(8)}`;
}

/**
 * Parse connection string and extract components
 */
export function parseConnectionString(connectionString: string): {
  protocol: string;
  host: string;
  port: number;
  database?: string;
  username?: string;
  password?: string;
} {
  const url = new URL(connectionString);
  
  return {
    protocol: url.protocol.slice(0, -1), // Remove trailing ':'
    host: url.hostname,
    port: parseInt(url.port) || (url.protocol === 'postgres:' ? 5432 : 6379),
    database: url.pathname.slice(1) || undefined,
    username: url.username || undefined,
    password: url.password || undefined,
  };
}
