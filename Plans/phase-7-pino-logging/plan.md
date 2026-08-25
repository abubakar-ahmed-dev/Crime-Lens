# Phase 7: Pino Structured Logging

## Objective

Replace console.log statements with structured logging using Pino for production-ready logging with request correlation, log levels, and easy log aggregation.

## What We'll Implement

1. **Pino logger configuration**
2. **Request ID middleware** for correlation
3. **Structured logging throughout the application**
4. **Log level configuration** by environment
5. **Sensitive data filtering**

## Implementation Steps

### Step 1: Install Pino Dependencies

```bash
npm install pino pino-pretty pino-http
```

### Step 2: Create Logger Configuration

**File: `db-project-backend/config/logger.js`**

```javascript
import pino from 'pino';
import pinoHttp from 'pino-http';

/**
 * Pino logger configuration
 * Structured logging for production
 */

const isDevelopment = process.env.NODE_ENV !== 'production';
const isProduction = process.env.NODE_ENV === 'production';

// Pino configuration
export const loggerConfig = {
  // In development, use pretty printing
  ...(isDevelopment ? {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    },
  } : {}),
  
  // Production settings
  ...(isProduction ? {
    formatters: {
      level: (label) => {
        return { level: label };
      },
    },
  } : {}),
  
  // Common settings
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  timestamp: pino.stdTimeFunctions.isoTime,
  
  // Redact sensitive fields
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.token',
      'req.body.apiKey',
      'res.headers.authorization',
    ],
    remove: true,
  },
  
  // Base serializers
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
};

// Create logger instance
export const logger = pino(loggerConfig);

/**
 * HTTP request logger middleware
 */
export const httpLogger = pinoHttp({
  logger: logger,
  // Custom request ID
  genReqId: (req) => {
    return req.headers['x-request-id'] || 
           `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },
  // Custom success response
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.path} ${res.statusCode}`;
  },
  // Custom error response
  customErrorMessage: (req, res, error) => {
    return `${req.method} ${req.path} ${res.statusCode} - ${error.message}`;
  },
  // Custom attributes
  customAttributeKeys: {
    reqId: 'request_id',
  },
});

/**
 * Child logger factory with context
 */
export const childLogger = (context, bindings = {}) => {
  return logger.child({ ...context, ...bindings });
};

/**
 * Log levels for reference
 */
export const LogLevels = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
};

export default { logger, httpLogger, childLogger, LogLevels };
```

### Step 3: Create Request ID Middleware

**File: `db-project-backend/middleware/requestId.js`**

```javascript
import { v4 as uuidv4 } from 'uuid';

/**
 * Request ID middleware for request correlation
 */
export const requestIdMiddleware = (req, res, next) => {
  // Generate or use existing request ID
  req.id = req.headers['x-request-id'] || 
           req.headers['x-correlation-id'] ||
           uuidv4();

  // Add to response headers
  res.setHeader('X-Request-ID', req.id);

  // Add to logger context
  req.log = req.log.child({ request_id: req.id });

  next();
};

export default { requestIdMiddleware };
```

### Step 4: Update Server with Logging

**File: `db-project-backend/server.js`**

```javascript
import { logger, httpLogger, childLogger } from './config/logger.js';
import { requestIdMiddleware } from './middleware/requestId.js';

// Replace console.log with logger
const app = express();

// Add HTTP logging (before route mounting)
app.use(httpLogger);

// Add request ID generation
app.use(requestIdMiddleware);

// Update startup logging
const startServer = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established', { 
      database: process.env.DATABASE_URL?.split('@')[1] 
    });

    app.listen(PORT, () => {
      logger.info('Server running', { 
        port: PORT,
        environment: process.env.NODE_ENV,
      });
    });
  } catch (error) {
    logger.error('Unable to start server', { error: error.message });
    process.exit(1);
  }
};

// Update error logging
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled promise rejection', { error: err.message, stack: err.stack });
  process.exit(1);
});
```

### Step 5: Replace Console.log in Controllers

**File: `db-project-backend/controllers/CrimeControllers.js`**

```javascript
import { childLogger } from '../config/logger.js';

// Add logger to each controller
const log = childLogger({ controller: 'CrimeControllers' });

export const getCrimesForMap = async (req, res) => {
  try {
    const { mode, crimeType, zoneId } = req.query;
    
    log.info('Fetching crimes for map', { 
      userId: req.user?.id, 
      mode, 
      crimeType, 
      zoneId 
    });

    // ... existing implementation

    log.debug('Crimes fetched successfully', { 
      count: formatted.length,
      page: req.query.page,
      limit: req.query.limit,
    });

    return res.json(buildPaginatedResponse(formatted, meta));

  } catch (err) {
    log.error('Map Crime Error', { 
      error: err.message, 
      stack: err.stack,
      userId: req.user?.id,
    });
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
```

### Step 6: Update Other Controllers

Replace console.log statements in:
- `controllers/statsController.js`
- `controllers/authControllers.js`
- `controllers/citizenAuthController.js`
- `controllers/mediaController.js`
- `controllers/adminControls/UploadControllers.js`

### Step 7: Add Sensitive Data Filter

**File: `db-project-backend/config/logger.js`**

```javascript
// Add to redact paths
export const sensitiveDataFilter = {
  // Sensitive fields to redact
  paths: [
    'req.body.password',
    'req.body.currentPassword',
    'req.body.newPassword',
    'req.body.token',
    'req.body.apiKey',
    'req.headers.authorization',
    'req.headers.cookie',
    'req.body.cnic',
    'req.body.contact',
    'config.JWT_SECRET',
    'config.SUPABASE_SERVICE_ROLE_KEY',
  ],
  
  // How to redact
  censor: '***',
};
```

### Step 8: Create Log Analysis Helper

**File: `db-project-backend/utils/logAnalyzer.js`**

```javascript
import fs from 'fs';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

/**
 * Log analysis utilities
 */
export class LogAnalyzer {
  /**
   * Count error occurrences in log file
   */
  static async countErrors(logFilePath) {
    const rl = createInterface({
      input: createReadStream(logFilePath),
      crlfDelay: Infinity,
    });

    let errorCount = 0;
    const errorTypes = {};

    for await (const line of rl) {
      try {
        const logEntry = JSON.parse(line);
        if (logEntry.level >= 50) { // Error or worse
          errorCount++;
          const errorType = logEntry.err?.type || logEntry.msg || 'unknown';
          errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
        }
      } catch (e) {
        // Skip invalid lines
      }
    }

    return { errorCount, errorTypes };
  }

  /**
   * Find slow requests (>1s)
   */
  static async findSlowRequests(logFilePath, threshold = 1000) {
    const rl = createInterface({
      input: createReadStream(logFilePath),
      crlfDelay: Infinity,
    });

    const slowRequests = [];

    for await (const line of rl) {
      try {
        const logEntry = JSON.parse(line);
        if (logEntry.responseTime && logEntry.responseTime > threshold) {
          slowRequests.push({
            path: logEntry.path,
            method: logEntry.method,
            responseTime: logEntry.responseTime,
            timestamp: logEntry.time,
          });
        }
      } catch (e) {
        // Skip invalid lines
      }
    }

    return slowRequests;
  }
}

export default LogAnalyzer;
```

### Step 9: Add Environment Variables

**File: `db-project-backend/.env-sample`**

```bash
# Logging Configuration
LOG_LEVEL=info
# Development: debug | Production: info | Testing: warn
```

## Testing

### Test Logging

```bash
# Make a request and check logs
curl http://localhost:5001/api/crimes/types

# Logs should show structured output with:
# - request_id
# - timestamp
# - level
# - method, path, status
# - response time
```

### Test Sensitive Data Redaction

```bash
# Login request should not show password in logs
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"test123"}'

# Check logs - password should be redacted
```

### Test Request ID Correlation

```bash
# Make request with custom request ID
curl -H "X-Request-ID: custom-123" http://localhost:5001/api/crimes/types

# Response should include X-Request-ID: custom-123
# Logs should show request_id: "custom-123"
```

## Expected Log Format

**Development (Pretty):**
```
[10:30:45] INFO (45678): GET /api/crimes/types 200
    request_id: "req-1234567890-abc"
    responseTime: 45ms
```

**Production (JSON):**
```json
{
  "level": "info",
  "time": "2025-08-25T10:30:45.123Z",
  "request_id": "req-1234567890-abc",
  "msg": "GET /api/crimes/types 200",
  "method": "GET",
  "path": "/api/crimes/types",
  "statusCode": 200,
  "responseTime": 45
}
```

## Success Criteria

- [ ] Pino logger configured
- [ ] Request IDs generated and tracked
- [ ] All console.log replaced with structured logging
- [ ] Sensitive data redacted from logs
- [ ] Log levels configurable by environment
- [ ] Request correlation working
- [ ] HTTP request logging operational

## Files Created/Modified

```
db-project-backend/
├── config/
│   └── logger.js (new)
├── middleware/
│   └── requestId.js (new)
├── utils/
│   └── logAnalyzer.js (new)
├── controllers/
│   ├── CrimeControllers.js (modified)
│   ├── statsController.js (modified)
│   ├── authControllers.js (modified)
│   └── [other controllers] (modified)
└── server.js (modified)
```

## Logging Best Practices Implemented

- **Structured logs**: All logs as JSON for easy parsing
- **Request correlation**: X-Request-ID for tracing
- **Log levels**: debug, info, warn, error
- **Sensitive data**: Redacted automatically
- **Context**: Controllers include their context
- **HTTP logging**: Automatic request/response logging

## Dependencies

- Phase 2 health checks (for monitoring log-driven alerts)
- Phase 8 Prometheus (for log metrics)

## Estimated Completion Time

- Logger setup: 1 hour
- Controller updates: 2 hours
- Request ID middleware: 30 minutes
- Testing: 30 minutes
- **Total: 4 hours**
