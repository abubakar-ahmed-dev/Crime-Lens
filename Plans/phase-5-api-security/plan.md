# Phase 5: API Security Hardening

## Objective

Implement comprehensive API security measures including input validation, output sanitization, request size limits, and security headers to protect against common web vulnerabilities.

## What We'll Implement

1. **Helmet.js** for security headers
2. **Input validation** using Zod
3. **Request size limits**
4. **CORS hardening**
5. **SQL injection protection verification**
6. **XSS protection**

## Implementation Steps

### Step 1: Install Security Dependencies

```bash
npm install helmet zod express-validator
```

### Step 2: Add Helmet.js Security Headers

**File: `db-project-backend/server.js`**

```javascript
import helmet from 'helmet';

// Add Helmet middleware (before route mounting)
app.use(helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      manifestSrc: ["'self'"],
    },
  },
  
  // Other security headers
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  
  // Disable X-Powered-By header
  hidePoweredBy: true,
}));

// Custom security headers
app.use((req, res, next) => {
  // Remove X-Powered-By
  res.removeHeader('X-Powered-By');
  
  // Add custom headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  next();
});
```

### Step 3: Create Input Validation Schemas

**File: `db-project-backend/validators/schemas.js`**

```javascript
import { z } from 'zod';

/**
 * Zod validation schemas for input validation
 */

// Crime report validation
export const crimeReportSchema = z.object({
  zone: z.number().int().positive().optional(),
  crimeTypeId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  address: z.string().max(500).optional(),
  description: z.string().max(5000).optional(),
  title: z.string().min(3).max(200),
  latitude: z.number().float().min(23).max(26),
  longitude: z.number().float().min(65).max(68),
  mediaData: z.array(z.object({
    publicId: z.string(),
    originalName: z.string(),
    mimeType: z.string(),
    fileSize: z.number().int().positive(),
    fileType: z.enum(['image', 'video']),
    url: z.string().url(),
    thumbnailUrl: z.string().url().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    duration: z.number().int().optional(),
    caption: z.string().max(500).optional(),
  })).optional(),
});

// Login validation
export const loginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100),
});

// Crime update validation
export const crimeUpdateSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(5000).optional(),
  address: z.string().max(500).optional(),
  zoneId: z.number().int().positive().optional(),
  latitude: z.number().float().min(23).max(26).optional(),
  longitude: z.number().float().min(65).max(68).optional(),
  crimeTypeId: z.number().int().positive().optional(),
  incidentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// Pagination validation
export const paginationSchema = z.object({
  page: z.number().int().positive().max(10000).default(1),
  limit: z.number().int().positive().max(200).default(50),
});

// Statistics query validation
export const statsQuerySchema = z.object({
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
  crimeTypeId: z.string().regex(/^\d+$/).optional(),
});

// Zone validation
export const zoneBoundarySchema = z.object({
  name: z.string().min(3).max(100),
  boundary: z.string(), // GeoJSON polygon
});

// Citizen profile validation
export const citizenProfileSchema = z.object({
  fullName: z.string().min(3).max(100),
  contact: z.string().regex(/^\d{10,15}$/).optional(),
  address: z.string().max(500).optional(),
});

// Branch validation
export const branchSchema = z.object({
  name: z.string().min(3).max(100),
  address: z.string().min(10).max(500),
  contactNumber: z.string().regex(/^\d{10,15}$/),
  zoneId: z.number().int().positive(),
});

export default {
  crimeReportSchema,
  loginSchema,
  crimeUpdateSchema,
  paginationSchema,
  statsQuerySchema,
  zoneBoundarySchema,
  citizenProfileSchema,
  branchSchema,
};
```

### Step 4: Create Validation Middleware

**File: `db-project-backend/middleware/validationMiddleware.js`**

```javascript
import { ZodError } from 'zod';
import { apiResponse } from '../utils/apiResponse.js';

/**
 * Validation middleware factory
 * @param {Object} schema - Zod validation schema
 * @param {string} target - 'body', 'query', or 'params'
 * @returns {Function} Express middleware
 */
export const validate = (schema, target = 'body') => {
  return (req, res, next) => {
    try {
      let dataToValidate;
      
      switch (target) {
        case 'body':
          dataToValidate = req.body;
          break;
        case 'query':
          dataToValidate = req.query;
          break;
        case 'params':
          dataToValidate = req.params;
          break;
        default:
          dataToValidate = req.body;
      }

      const validatedData = schema.parse(dataToValidate);
      
      // Replace request data with validated data
      switch (target) {
        case 'body':
          req.body = validatedData;
          break;
        case 'query':
          req.query = validatedData;
          break;
        case 'params':
          req.params = validatedData;
          break;
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors,
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  };
};

/**
 * Sanitize input to prevent XSS
 */
export const sanitizeInput = (req, res, next) => {
  const sanitizeObject = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        // Remove potentially dangerous HTML/JS
        sanitized[key] = value
          .replace(/<script[^>]*>.*?<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+="[^"]*"/gi, '');
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  next();
};

/**
 * Request size limiter
 */
export const limitRequestSize = (maxSize = '1mb') => {
  return (req, res, next) => {
    const contentLength = req.get('content-length');
    
    if (contentLength) {
      const maxBytes = parseBytes(maxSize);
      if (parseInt(contentLength) > maxBytes) {
        return res.status(413).json({
          success: false,
          message: `Request body too large. Maximum size is ${maxSize}`,
        });
      }
    }

    next();
  };
};

function parseBytes(size) {
  const units = { b: 1, kb: 1024, mb: 1048576, gb: 1073741824 };
  const match = size.toString().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([a-z]+)?$/);
  if (!match) return 0;
  return parseFloat(match[1]) * (units[match[2]] || 1);
}

export default { validate, sanitizeInput, limitRequestSize };
```

### Step 5: Apply Validation to Routes

**File: `db-project-backend/routes/crimeRoutes.js`**

```javascript
import { validate } from '../middleware/validationMiddleware.js';
import { crimeReportSchema, crimeUpdateSchema, paginationSchema } from '../validators/schemas.js';
import { limitRequestSize } from '../middleware/validationMiddleware.js';

// Apply validation to crime report
router.post('/report', 
  authorizeCitizen,
  limitRequestSize('2mb'),
  validate(crimeReportSchema, 'body'),
  reportCrime
);

// Apply validation to crime update
router.put('/update/:id',
  policeOnly,
  validate(crimeUpdateSchema, 'body'),
  updateCrime
);

// Apply pagination validation
router.get('/',
  optionalAuth,
  validate(paginationSchema, 'query'),
  getCrimesForMap
);

router.get('/all',
  policeOnly,
  validate(paginationSchema, 'query'),
  getAllCrimes
);
```

**File: `db-project-backend/routes/authRoutes.js`**

```javascript
import { validate } from '../middleware/validationMiddleware.js';
import { loginSchema } from '../validators/schemas.js';

router.post('/login',
  validate(loginSchema, 'body'),
  loginController
);
```

**File: `db-project-backend/routes/statsRoutes.js`**

```javascript
import { validate } from '../middleware/validationMiddleware.js';
import { statsQuerySchema, paginationSchema } from '../validators/schemas.js';

router.get('/summary', validate(statsQuerySchema, 'query'), getStatsSummary);
router.get('/crime-type-distribution', validate(statsQuerySchema, 'query'), getCrimesByType);
router.get('/zone-crime-count', validate(statsQuerySchema, 'query'), getCrimesByZone);
router.get('/crime-trend', validate(statsQuerySchema, 'query'), getCrimeTrend);
```

### Step 6: Add Global Security Middleware

**File: `db-project-backend/server.js`**

```javascript
import { sanitizeInput } from './middleware/validationMiddleware.js';
import { limitRequestSize } from './middleware/validationMiddleware.js';

// Apply security middleware globally (after CORS, before routes)
app.use(sanitizeInput);

// Global request size limit (except for file upload endpoints)
app.use('/api', limitRequestSize('1mb'));

// Larger limit for file upload endpoints
app.use('/api/media/upload', limitRequestSize('10mb'));
app.use('/api/admin/upload-crimes', limitRequestSize('50mb'));
```

### Step 7: Update CORS Configuration

**File: `db-project-backend/server.js`**

```javascript
const corsOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (corsOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  maxAge: 86400, // 24 hours
  exposedHeaders: ['X-Total-Count', 'X-Cache', 'X-RateLimit-Remaining', 'X-RateLimit-Limit', 'X-RateLimit-Reset'],
}));
```

### Step 8: Add SQL Injection Protection Verification

**File: `db-project-backend/utils/sqlSafety.js`**

```javascript
/**
 * SQL safety utilities
 * Verify that all queries use parameterized inputs
 */

export function validateQuerySafety(query, params) {
  // Check for suspicious patterns
  const dangerousPatterns = [
    /\$\$[^$]*\$\$/,      // Dollar-quoted strings (useless injection)
    /E'[^']*/,            // Escaped strings
    /;\s*DROP/i,          // DROP statements
    /;\s*DELETE/i,        // DELETE statements
    /;\s*UPDATE/i,        // UPDATE statements
    /;\s*INSERT/i,        // INSERT statements
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(query)) {
      throw new Error(`Potentially unsafe SQL pattern detected: ${pattern}`);
    }
  }

  // Verify all parameters are bound
  const paramMatches = query.match(/:\w+/g);
  if (paramMatches) {
    const paramNames = paramMatches.map(p => p.substring(1));
    for (const param of paramNames) {
      if (!(param in params)) {
        throw new Error(`Unbound parameter: ${param}`);
      }
    }
  }

  return true;
}

export default { validateQuerySafety };
```

### Step 9: Add Error Handling for Security Events

**File: `db-project-backend/middleware/securityMiddleware.js`**

```javascript
/**
 * Security event logging
 */

export const logSecurityEvent = (eventType, details) => {
  const securityLog = {
    timestamp: new Date().toISOString(),
    eventType,
    ...details,
  };

  console.warn('🚨 Security Event:', JSON.stringify(securityLog));
  
  // In Phase 7 (Pino), this will use structured logging
  // In Phase 8 (Prometheus), this will increment security metrics
};

/**
 * Request rate monitoring for abuse detection
 */
export const monitorAbuse = (req, res, next) => {
  const suspiciousPatterns = [
    /(\$\{.*\})/,                    // Template injection attempts
    /(<script[^>]*>)/i,             // XSS attempts
    /(union\s+select)/i,             // SQL injection attempts
    /(\/\.\.+)/,                     // Path traversal attempts
  ];

  const checkString = JSON.stringify({
    body: req.body,
    query: req.query,
    params: req.params,
  });

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(checkString)) {
      logSecurityEvent('SUSPICIOUS_INPUT', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        pattern: pattern.toString(),
        input: checkString.substring(0, 200),
      });

      return res.status(400).json({
        success: false,
        message: 'Invalid input detected',
      });
    }
  }

  next();
};

export default { logSecurityEvent, monitorAbuse };
```

### Step 10: Add Security Tests

**File: `tests/security/validation.test.js`**

```javascript
/**
 * Security validation tests
 */

describe('Input Validation', () => {
  test('should reject XSS attempts in crime reports', async () => {
    const maliciousPayload = {
      title: '<script>alert("xss")</script>',
      description: 'Test',
      crimeTypeId: 1,
      date: '2024-01-01',
      latitude: 24.5,
      longitude: 67.0,
    };

    const response = await request(app)
      .post('/api/crimes/report')
      .send(maliciousPayload);

    expect(response.status).toBe(400);
    expect(response.body.errors).toBeDefined();
  });

  test('should reject SQL injection attempts', async () => {
    const maliciousPayload = {
      username: "admin'; DROP TABLE users; --",
      password: 'password',
    };

    const response = await request(app)
      .post('/api/auth/login')
      .send(maliciousPayload);

    expect(response.status).toBe(400);
  });

  test('should enforce request size limits', async () => {
    const largePayload = {
      data: 'x'.repeat(2 * 1024 * 1024), // 2MB
    };

    const response = await request(app)
      .post('/api/test')
      .send(largePayload);

    expect(response.status).toBe(413);
  });
});
```

## Testing

### Test Security Headers

```bash
# Verify security headers
curl -I http://localhost:5001/api/crimes/types

# Expected headers:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# X-XSS-Protection: 1; mode=block
# Strict-Transport-Security: max-age=31536000
```

### Test Input Validation

```bash
# Test XSS attempt
curl -X POST http://localhost:5001/api/crimes/report \
  -H "Content-Type: application/json" \
  -d '{"title":"<script>alert(1)</script>","crimeTypeId":1,"date":"2024-01-01"}'

# Expected: 400 with validation errors

# Test SQL injection
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin; DROP TABLE users;--","password":"test"}'

# Expected: 400 with validation errors
```

### Test Request Size Limits

```bash
# Test oversized request
curl -X POST http://localhost:5001/api/test \
  -H "Content-Type: application/json" \
  -d "{\"data\":\"$(printf 'a%.0s' {1..2000000)}\"}"

# Expected: 413 Payload Too Large
```

## Success Criteria

- [ ] Security headers present on all responses
- [ ] Input validation rejects XSS attempts
- [ ] Input validation rejects SQL injection attempts
- [ ] Request size limits enforced
- [ ] CORS properly configured
- [ ] Validation errors return structured responses
- [ ] Security events logged
- [ ] All endpoints protected by appropriate validation

## Files Created/Modified

```
db-project-backend/
├── validators/
│   └── schemas.js (new)
├── middleware/
│   ├── validationMiddleware.js (new)
│   └── securityMiddleware.js (new)
├── utils/
│   └── sqlSafety.js (new)
├── routes/
│   ├── authRoutes.js (modified)
│   ├── crimeRoutes.js (modified)
│   ├── statsRoutes.js (modified)
│   └── [other routes] (modified)
└── server.js (modified - Helmet, CORS)
```

## Security Improvements

- **Helmet.js**: 7 security headers added
- **Input Validation**: All endpoints protected with Zod schemas
- **XSS Protection**: Input sanitization and CSP
- **SQL Injection**: Parameterized queries verified
- **Request Limits**: Size limits prevent DoS
- **CORS**: Origin whitelist enforced

## Dependencies

- Phase 2 health checks (for monitoring security events)
- Phase 4 rate limiting (complementary protection)

## Rollback Procedure

If security measures break functionality:
1. Comment out Helmet middleware in server.js
2. Remove validation middleware from routes
3. Restart backend

## Estimated Completion Time

- Security setup (Helmet, CORS): 1 hour
- Validation schemas: 2 hours
- Validation middleware: 1 hour
- Route protection: 1 hour
- Testing: 1 hour
- **Total: 6 hours**
