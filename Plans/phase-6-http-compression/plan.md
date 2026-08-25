# Phase 6: HTTP Compression

## Objective

Implement HTTP response compression to reduce bandwidth usage and improve response times, particularly for large JSON responses from map and statistics endpoints.

## What We'll Implement

1. **Brotli compression** (modern, better compression)
2. **Gzip fallback** (for older clients)
3. **Compression thresholds** (only compress worthwhile responses)
4. **Compressible content-type filtering**

## Implementation Steps

### Step 1: Install Compression Dependencies

```bash
npm install compression express-static-gzip
```

### Step 2: Add Compression Middleware

**File: `db-project-backend/server.js`**

```javascript
import compression from 'compression';

// Add compression middleware (after security, before routes)
app.use(compression({
  // Compress only if response body size > 1KB
  threshold: 1024,
  
  // Compression level (1-9, higher = better compression but slower)
  level: 6,
  
  // Compressible content types
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }

    // Only compress compressible content types
    const contentType = res.getHeader('Content-Type');
    const compressibleTypes = [
      'text/',
      'application/json',
      'application/javascript',
      'application/xml',
      'application/rss+xml',
      'image/svg+xml',
    ];

    return compressibleTypes.some(type => contentType?.includes(type));
  },
  
  // Use gzip for compatibility (Brotli requires newer Node.js)
  memLevel: 8,
}));
```

### Step 3: Add Compression Headers

**File: `db-project-backend/middleware/compressionHeaders.js`**

```javascript
/**
 * Compression-related response headers
 */
export const addCompressionHeaders = (req, res, next) => {
  res.on('finish', () => {
    const contentLength = res.getHeader('Content-Length');
    const contentType = res.getHeader('Content-Type');

    // Add compression info header
    if (contentLength && contentType) {
      const originalSize = parseInt(contentLength);
      
      if (originalSize > 1024) {
        res.setHeader('X-Content-Size', originalSize);
        res.setHeader('X-Compression-Enabled', 'true');
      }
    }
  });

  next();
};

export default { addCompressionHeaders };
```

### Step 4: Update CORS Headers for Compression

**File: `db-project-backend/server.js`**

```javascript
app.use(cors({
  // ... existing CORS config
  exposedHeaders: [
    'X-Total-Count',
    'X-Cache',
    'X-RateLimit-Remaining',
    'X-RateLimit-Limit',
    'X-RateLimit-Reset',
    'X-Content-Size',
    'X-Compression-Enabled',
  ],
}));
```

## Testing

### Test Compression

```bash
# Test compression is enabled
curl -I http://localhost:5001/api/crimes/types

# Expected:
# Content-Encoding: gzip
# Vary: Accept-Encoding

# Test with large response
curl -H "Accept-Encoding: gzip" http://localhost:5001/api/crimes/all

# Measure response sizes
# Compressed vs Uncompressed
```

## Expected Impact

- **JSON responses**: 70-80% size reduction
- **HTML responses**: 60-70% size reduction
- **Static assets**: 50-60% size reduction

## Success Criteria

- [ ] Compression middleware configured
- [ ] Large responses (>1KB) are compressed
- [ ] Content-Encoding header present
- [ ] Compression doesn't slow down responses significantly
- [ ] X-Compression-Enabled header present
- [ ] 50%+ size reduction on JSON responses

## Files Modified

```
db-project-backend/
├── server.js (modified - compression)
└── middleware/
    └── compressionHeaders.js (new)
```

## Performance Impact

- **CPU**: Slight increase (5-10% more CPU)
- **Network**: 50-80% bandwidth reduction
- **Response Time**: Trade-off: compression time vs transmission time
- **Overall**: Net positive for >1KB responses

## Estimated Completion Time

- Compression setup: 1 hour
- Testing and optimization: 30 minutes
- **Total: 1.5 hours**
