# Phase 4: Redis-backed Rate Limiting

## Objective

Implement distributed rate limiting using Redis to protect sensitive endpoints from abuse while supporting horizontal scaling. Unlike local rate limiting, Redis-backed rate limiting shares state across all API instances.

## What We'll Implement

1. **Redis-backed rate limiting middleware**
2. **Endpoint-specific rate limit configurations**
3. **Sliding window rate limiting algorithm**
4. **Rate limit response headers**
5. **Whitelist/Blacklist support**

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   API #1    │     │   API #2    │     │   API #3    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                    ┌──────▼──────┐
                    │    Redis    │
                    │ Rate Limit  │
                    │    State    │
                    └─────────────┘
```

All API instances share the same rate limit state, preventing users from bypassing limits by hitting different instances.

## Implementation Steps

### Step 1: Install Rate Limiting Dependencies

```bash
npm install rate-limiter-flexible
```

### Step 2: Create Rate Limiter Configuration

**File: `db-project-backend/config/rateLimiter.js`**

```javascript
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import { redisClient } from './redis.js';

/**
 * Rate limiter configuration
 * Uses Redis for distributed rate limiting
 * Falls back to in-memory if Redis unavailable
 */

// Rate limit configurations for different endpoint types
export const RateLimitConfig = {
  // Strict limits for authentication endpoints
  AUTH: {
    points: 5,           // 5 requests
    duration: 60,         // per 60 seconds
    blockDuration: 300,   // block for 5 minutes
  },
  
  // Moderate limits for write operations
  WRITE: {
    points: 10,
    duration: 60,
    blockDuration: 180,   // block for 3 minutes
  },
  
  // Generous limits for read operations
  READ: {
    points: 100,
    duration: 60,
    blockDuration: 30,    // block for 30 seconds
  },
  
  // Very strict for sensitive operations
  SENSITIVE: {
    points: 3,
    duration: 3600,       // per hour
    blockDuration: 3600,  // block for 1 hour
  },
  
  // Public API limits
  PUBLIC: {
    points: 50,
    duration: 60,
    blockDuration: 60,
  },
};

/**
 * Create rate limiter instance
 * @param {Object} config - Rate limit configuration
 * @returns {RateLimiterRedis|RateLimiterMemory}
 */
export const createRateLimiter = (config) => {
  try {
    if (redisClient && redisClient.isOpen) {
      return new RateLimiterRedis({
        storeClient: redisClient,
        keyPrefix: 'crimelens_ratelimit',
        points: config.points,
        duration: config.duration,
        blockDuration: config.blockDuration,
      });
    } else {
      console.warn('Redis unavailable, using in-memory rate limiting');
      return new RateLimiterMemory({
        points: config.points,
        duration: config.duration,
        blockDuration: config.blockDuration,
      });
    }
  } (error) {
    console.error('Rate limiter creation error:', error);
    // Fallback to no rate limiting if creation fails
    return null;
  }
};

// Pre-configured limiters
export const limiters = {
  authLogin: createRateLimiter(RateLimitConfig.AUTH),
  citizenAuth: createRateLimiter(RateLimitConfig.AUTH),
  crimeReport: createRateLimiter(RateLimitConfig.WRITE),
  adminUpload: createRateLimiter(RateLimitConfig.SENSITIVE),
  publicAPI: createRateLimiter(RateLimitConfig.PUBLIC),
  protectedAPI: createRateLimiter(RateLimitConfig.READ),
  mediaUpload: createRateLimiter(RateLimitConfig.WRITE),
};

/**
 * Whitelist for IP addresses that bypass rate limiting
 */
export const whitelistedIPs = new Set([
  '127.0.0.1',
  '::1',
  // Add trusted IPs for monitoring/testing
]);

/**
 * Check if IP is whitelisted
 */
export const isWhitelisted = (ip) => {
  return whitelistedIPs.has(ip);
};

export default {
  RateLimitConfig,
  limiters,
  isWhitelisted,
};
```

### Step 3: Create Rate Limit Middleware

**File: `db-project-backend/middleware/rateLimiterMiddleware.js`**

```javascript
import { limiters, isWhitelisted } from '../config/rateLimiter.js';

/**
 * Rate limiting middleware factory
 * @param {string} limiterType - Type of rate limiter to use
 * @returns {Function} Express middleware
 */
export const applyRateLimit = (limiterType) => {
  return async (req, res, next) => {
    try {
      // Get client identifier
      const identifier = getClientIdentifier(req);
      
      // Check whitelist
      if (isWhitelisted(identifier)) {
        res.setHeader('X-RateLimit-Limit', '∞');
        res.setHeader('X-RateLimit-Remaining', '∞');
        res.setHeader('X-RateLimit-Reset', '∞');
        return next();
      }

      // Get appropriate limiter
      const limiter = limiters[limiterType];
      if (!limiter) {
        return next();
      }

      // Check rate limit
      const result = await limiter.consume(identifier);
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', limiter.points);
      res.setHeader('X-RateLimit-Remaining', result.remainingPoints);
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + msBeforeReset).toISOString());

      next();
    } catch (rejRes) {
      // Rate limit exceeded
      const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
      
      res.setHeader('X-RateLimit-Limit', rejRes.totalHits);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rejRes.msBeforeNext).toISOString());
      res.setHeader('Retry-After', secs);

      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
        retryAfter: secs,
      });
    }
  };
};

/**
 * Get client identifier for rate limiting
 * Priority: User ID > IP address
 */
function getClientIdentifier(req) {
  // If authenticated user, use user ID
  if (req.user?.id) {
    return `user:${req.user.id}`;
  }
  
  // Otherwise use IP address
  const ip = req.ip || 
             req.connection.remoteAddress || 
             req.socket.remoteAddress ||
             (req.connection.socket ? req.connection.socket.remoteAddress : null);
  
  return `ip:${ip}`;
}

/**
 * Multiple rate limiters for complex scenarios
 */
export const applyMultipleRateLimits = (limiterTypes) => {
  const middlewares = limiterTypes.map(type => applyRateLimit(type));
  
  return async (req, res, next) => {
    for (const middleware of middlewares) {
      try {
        await new Promise((resolve, reject) => {
          middleware(req, res, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      } catch (error) {
        // If any rate limit is exceeded, return 429
        if (error.status === 429) {
          return res.status(429).json({
            success: false,
            message: 'Too many requests. Please try again later.',
          });
        }
      }
    }
    next();
  };
};

export default { applyRateLimit, applyMultipleRateLimits };
```

### Step 4: Apply Rate Limiting to Routes

**File: `db-project-backend/routes/authRoutes.js`**

```javascript
import { applyRateLimit } from '../middleware/rateLimiterMiddleware.js';

// Apply strict rate limiting to login endpoint
router.post('/login', applyRateLimit('authLogin'), loginController);
```

**File: `db-project-backend/routes/citizenAuthRoutes.js`**

```javascript
import { applyRateLimit } from '../middleware/rateLimiterMiddleware.js';

// Apply rate limiting to citizen auth endpoints
router.post('/register', applyRateLimit('citizenAuth'), register);
router.post('/login', applyRateLimit('citizenAuth'), login);
router.post('/google-auth', applyRateLimit('citizenAuth'), googleAuth);
```

**File: `db-project-backend/routes/crimeRoutes.js`**

```javascript
import { applyRateLimit } from '../middleware/rateLimiterMiddleware.js';

// Apply rate limiting to write operations
router.post('/report', applyRateLimit('crimeReport'), reportCrime);
router.put('/update/:id', applyRateLimit('write'), updateCrime);
router.delete('/delete/:id', applyRateLimit('write'), deleteCrime);

// Public API gets moderate rate limiting
router.get('/', optionalAuth, applyRateLimit('publicAPI'), getCrimesForMap);
```

**File: `db-project-backend/routes/adminRoutes.js`**

```javascript
import { applyRateLimit } from '../middleware/rateLimiterMiddleware.js';

// CSV upload gets very strict rate limiting
router.post('/upload-crimes', 
  ...adminOnly, 
  applyRateLimit('adminUpload'),
  upload.single('file'),
  uploadCrimesCSV
);
```

**File: `db-project-backend/routes/statsRoutes.js`**

```javascript
import { applyRateLimit } from '../middleware/rateLimiterMiddleware.js';

// Statistics endpoints get moderate rate limiting
router.get('/summary', applyRateLimit('publicAPI'), getStatsSummary);
router.get('/crime-type-distribution', applyRateLimit('publicAPI'), getCrimesByType);
router.get('/zone-crime-count', applyRateLimit('publicAPI'), getCrimesByZone);
router.get('/crime-trend', applyRateLimit('publicAPI'), getCrimeTrend);
```

**File: `db-project-backend/routes/mediaRoutes.js`**

```javascript
import { applyRateLimit } from '../middleware/rateLimiterMiddleware.js';

// Media upload gets write rate limiting
router.post('/upload', applyRateLimit('mediaUpload'), uploadMedia);
```

### Step 5: Add Rate Limit Monitoring to Health Check

**File: `db-project-backend/controllers/healthController.js`**

```javascript
import { limiters } from '../config/rateLimiter.js';

// Add rate limit status to detailed health
export const detailedHealth = async (req, res) => {
  // ... existing health checks

  // Add rate limiting status
  healthInfo.checks.rateLimiting = {
    status: limiters.authLogin ? 'active' : 'degraded',
    message: limiters.authLogin ? 'Rate limiting active' : 'Rate limiting fallback',
    type: limiters.authLogin?.constructor.name,
  };

  // ... rest of implementation
};
```

### Step 6: Create Rate Limit Testing Utility

**File: `tests/k6/scenarios/rate-limit-test.js`**

```javascript
import http from 'k6/http';
import { check } from 'k6';
import { ENDPOINTS, BASE_URL } from '../lib/endpoints.js';

export const options = {
  scenarios: {
    rate_limit_test: {
      executor: 'constant-vus',
      vus: 1,
      iterations: 10,
      executor: 'per-vu-iterations',
      gracefulRampDown: '30s',
    },
  },
};

export default function () {
  const loginData = {
    username: 'admin',
    password: 'admin123',
  };

  const response = http.post(
    `${BASE_URL}${ENDPOINTS.ADMIN_LOGIN}`,
    JSON.stringify(loginData),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  check(response, {
    'status is 429 after 5 requests': (r) => r.status === 429,
    'has retry-after header': (r) => r.headers['Retry-After'] !== undefined,
  });

  sleep(1);
}
```

### Step 7: Add Environment Variables

**File: `db-project-backend/.env-sample`**

```bash
# Rate Limiting Configuration
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WHITELIST_IPS=127.0.0.1,::1
```

## Testing

### Test Rate Limiting

```bash
# Test login rate limiting (should return 429 after 5 attempts)
for i in {1..10}; do
  curl -X POST http://localhost:5001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"wrong"}'
  echo "Request $i complete"
  sleep 1
done
```

### Test Rate Limit Headers

```bash
# First request should show remaining requests
curl -I http://localhost:5001/api/stats/summary

# Check headers:
# X-RateLimit-Limit: 50
# X-RateLimit-Remaining: 49
# X-RateLimit-Reset: <timestamp>
```

### Test Whitelist

```bash
# Requests from whitelisted IPs should bypass rate limiting
# Add test IP to whitelist and verify unlimited requests
```

## Expected Behavior

1. **First 5 login attempts**: 200 or 401 (depending on credentials)
2. **6th login attempt**: 429 with Retry-After header
3. **After block duration**: Requests allowed again

## Success Criteria

- [ ] Rate limiter middleware created
- [ ] Sensitive endpoints protected (login, report submission)
- [ ] 429 responses include Retry-After header
- [ ] Rate limit headers present on all responses
- [ ] Whitelist functionality works
- [ ] Rate limiting works with Redis
- [ ] Graceful fallback to memory if Redis unavailable
- [ ] Multiple API instances share same rate limit state

## Files Created/Modified

```
db-project-backend/
├── config/
│   └── rateLimiter.js (new)
├── middleware/
│   └── rateLimiterMiddleware.js (new)
├── routes/
│   ├── authRoutes.js (modified)
│   ├── citizenAuthRoutes.js (modified)
│   ├── crimeRoutes.js (modified)
│   ├── adminRoutes.js (modified)
│   ├── statsRoutes.js (modified)
│   └── mediaRoutes.js (modified)
└── controllers/
    └── healthController.js (modified)
```

## Security Impact

- **Brute force protection**: Login endpoints limited to 5 attempts per minute
- **DDoS protection**: Public APIs limited to 50 requests per minute
- **Resource protection**: File uploads limited to prevent abuse

## Dependencies

- Phase 3 Redis (required for distributed rate limiting)
- Phase 2 health checks (for monitoring rate limiter status)

## Rollback Procedure

If rate limiting causes issues:
1. Comment out rate limit middleware in routes
2. Set `RATE_LIMIT_ENABLED=false` in environment
3. Restart backend

## Estimated Completion Time

- Rate limiter setup: 1 hour
- Middleware implementation: 1 hour
- Route protection: 30 minutes
- Testing and verification: 1 hour
- **Total: 3.5 hours**
