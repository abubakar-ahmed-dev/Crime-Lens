# Phase 13: Cloudflare CDN & Security

## Objective

Implement Cloudflare as a CDN and security layer to improve global performance, reduce origin server load, and add DDoS protection, SSL/TLS optimization, and caching rules.

## What We'll Implement

1. **Cloudflare DNS** configuration
2. **CDN caching rules** for static assets
3. **SSL/TLS optimization** with Cloudflare certificates
4. **Page rules** for performance optimization
5. **Security features** (bot protection, hotlink protection)
6. **Analytics integration**

## Implementation Steps

### Step 1: Domain Configuration

**Action in Cloudflare Dashboard:**

1. Add domain to Cloudflare
2. Update nameservers at domain registrar
3. Wait for DNS propagation (typically 24-48 hours)

**DNS Records to Configure:**

```
Type    Name            Content              Proxy Status
A       crimelens      <your-IP>           Proxied (Orange Cloud)
A       api            <your-IP>           Proxied (Orange Cloud)
CNAME   www           crimelens.example.com  Proxied (Orange Cloud)
A       prometheus    <your-IP>           DNS Only (Gray Cloud)
A       grafana       <your-IP>           DNS Only (Gray Cloud)
```

### Step 2: SSL/TLS Configuration

**Cloudflare SSL/TLS Settings:**

```yaml
# SSL/TLS Tab
Encryption Mode: "Full (strict)"  # Validate origin server certificate
Always Use HTTPS: "On"
Automatic HTTPS Rewrites: "On"
TLS 1.3: "On"
Minimum TLS Version: "TLS 1.2"
Opportunistic Encryption: "On"

# Origin Certificates
- Generate Cloudflare Origin Certificate
- Install on Nginx server
- Configure automatic renewal
```

**Install Origin Certificate on Nginx:**

**File: `nginx/ssl/cloudflare-origin.pem`** (generated from Cloudflare dashboard)

**Update Nginx Configuration:**

**File: `nginx/nginx.conf`**

```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name crimelens.example.com;

    # Cloudflare Origin Certificate
    ssl_certificate /etc/nginx/ssl/cloudflare-origin.pem;
    ssl_certificate_key /etc/nginx/ssl/cloudflare-origin.key;

    # Cloudflare IPs only (restrict access)
    allow 103.21.244.0/22;
    allow 103.22.200.0/22;
    allow 103.31.4.0/22;
    allow 141.101.64.0/18;
    allow 108.162.192.0/18;
    allow 190.93.240.0/20;
    allow 188.114.96.0/20;
    allow 197.234.240.0/22;
    allow 198.41.128.0/17;
    allow 162.158.0.0/15;
    allow 104.16.0.0/13;
    allow 104.24.0.0/14;
    allow 172.64.0.0/13;
    allow 131.0.72.0/22;
    deny all;

    # ... rest of configuration
}
```

### Step 3: Caching Configuration

**Cloudflare Caching Rules:**

```yaml
# Cache Rules Tab (Create custom rules)

Rule 1: Static Assets (Cache Everything)
- Name: "Static Assets Cache"
- Field: URI Path
- Operator: matches
- Value: *\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webp)
- Cache TTL: 1 year
- Edge Cache TTL: 1 year

Rule 2: API Responses (Bypass Cache)
- Name: "API Bypass Cache"
- Field: URI Path
- Operator: starts with
- Value: /api/
- Cache: Bypass

Rule 3: HTML Pages (Standard Cache)
- Name: "HTML Pages"
- Field: URI Path
- Operator: matches
- Value: *.html
- Cache TTL: 2 hours
- Edge Cache TTL: 2 hours

Rule 4: Auth Endpoints (Bypass)
- Name: "Auth Bypass"
- Field: URI Path
- Operator: starts with
- Value: /api/auth
- Cache: Bypass
```

### Step 4: Page Rules

**Cloudflare Page Rules:**

```yaml
Priority 1 - Admin Dashboard (Bypass Cache)
URL: *crimelens.example.com/admin*
- Cache Level: Bypass
- Security Level: High

Priority 2 - Static Assets (Aggressive Caching)
URL: *crimelens.example.com/*.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)
- Cache Level: Cache Everything
- Edge Cache TTL: 1 year
- Browser Cache TTL: 1 year

Priority 3 - API Endpoints (Bypass)
URL: *crimelens.example.com/api/*
- Cache Level: Bypass
- Disable Performance

Priority 4 - HTTPS Redirect
URL: *crimelens.example.com/*
- Always Use HTTPS: On
- Automatic HTTPS Rewrites: On
```

### Step 5: Security Configuration

**Cloudflare Security Settings:**

```yaml
# Security Tab

Security Level: Medium
  - Challenge for:
    * SQL injection
    * XSS attacks
    * CVE exploits

Bot Fight Mode: On
  - Challenge suspicious bots
  - Allow good bots (Google, Bing)

Hotlink Protection: On
  - Prevent embedding of images on other domains

Rate Limiting (Enterprise):
  - Match URL: */api/auth/login
  - Rate: 10 requests per minute
  - Action: Challenge

Browser Integrity Check: On
```

### Step 6: Performance Optimization

**Cloudflare Performance Settings:**

```yaml
# Speed Tab

Auto Minify: On
  - JavaScript: On
  - CSS: On
  - HTML: On

Brotli Compression: On
Rocket Loader: On (defer JavaScript loading)
HTTP/2: On
HTTP/3 (with QUIC): On
0-RTT Connection Resumption: On

Argo Smart Routing: Optional (paid)
  - Routes traffic through fastest Cloudflare path

# Network Tab
HTTP/2: On
HTTP/3: On
0-RTT: On
Pseudo IPv4: Off (unless needed)
```

### Step 7: Create Cloudflare Worker for Headers

**Cloudflare Worker:**

**File: `cloudflare-workers/header-worker.js`**

```javascript
// Cloudflare Worker for custom headers
export default {
  async fetch(request, env, ctx) {
    // Get response from origin
    const response = await fetch(request);

    // Clone response to modify headers
    const newResponse = new Response(response.body, response);

    // Add security headers
    newResponse.headers.set('X-Frame-Options', 'DENY');
    newResponse.headers.set('X-Content-Type-Options', 'nosniff');
    newResponse.headers.set('X-XSS-Protection', '1; mode=block');
    newResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    newResponse.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    // Remove server header
    newResponse.headers.delete('Server');

    return newResponse;
  }
};
```

### Step 8: Analytics Integration

**File: `db-project-backend/config/cloudflare.js`**

```javascript
/**
 * Cloudflare Analytics integration
 */

export const cloudflareConfig = {
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  apiToken: process.env.CLOUDFLARE_API_TOKEN,
  zoneId: process.env.CLOUDFLARE_ZONE_ID,
  domain: process.env.CLOUDFLARE_DOMAIN,
};

/**
 * Fetch analytics from Cloudflare API
 */
export const getCloudflareAnalytics = async (startDate, endDate) => {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${cloudflareConfig.zoneId}/analytics/dashboard`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cloudflareConfig.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          since: startDate,
          until: endDate,
          metrics: [
            'requests',
            'bandwidth',
            'cachedRequests',
            'cachedBandwidth',
            'threats',
          ],
        }),
      }
    );

    const data = await response.json();
    return data.result;
  } catch (error) {
    console.error('Cloudflare analytics error:', error);
    return null;
  }
};

/**
 * Purge cache
 */
export const purgeCloudflareCache = async (urls = []) => {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${cloudflareConfig.zoneId}/purge_cache`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cloudflareConfig.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: urls,
        }),
      }
    );

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Cloudflare purge error:', error);
    return false;
  }
};

/**
 * Purge entire cache
 */
export const purgeAllCache = async () => {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${cloudflareConfig.zoneId}/purge_cache`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cloudflareConfig.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          purge_everything: true,
        }),
      }
    );

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Cloudflare purge all error:', error);
    return false;
  }
};

export default {
  cloudflareConfig,
  getCloudflareAnalytics,
  purgeCloudflareCache,
  purgeAllCache,
};
```

### Step 9: Add Cache Purge Endpoint

**File: `db-project-backend/controllers/cloudflareController.js`**

```javascript
import { purgeAllCache, purgeCloudflareCache } from '../config/cloudflare.js';
import { authorizeRoles } from '../middleware/authMiddleware.js';

export const purgeCache = async (req, res) => {
  try {
    const { urls } = req.body;

    let result;
    if (urls && urls.length > 0) {
      result = await purgeCloudflareCache(urls);
    } else {
      result = await purgeAllCache();
    }

    if (result) {
      res.json({
        success: true,
        message: 'Cache purged successfully',
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to purge cache',
      });
    }
  } catch (error) {
    console.error('Cache purge error:', error);
    res.status(500).json({
      success: false,
      message: 'Error purging cache',
    });
  }
};

export const getAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const analytics = await getCloudflareAnalytics(
      startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      endDate || new Date().toISOString()
    );

    if (analytics) {
      res.json({
        success: true,
        data: analytics,
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch analytics',
      });
    }
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching analytics',
    });
  }
};
```

**File: `db-project-backend/routes/cloudflareRoutes.js`**

```javascript
import express from 'express';
import { purgeCache, getAnalytics } from '../controllers/cloudflareController.js';
import { verifyToken, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

const adminOnly = [verifyToken, authorizeRoles('admin')];

// Purge cache (admin only)
router.post('/purge', adminOnly, purgeCache);

// Get analytics (admin only)
router.get('/analytics', adminOnly, getAnalytics);

export default router;
```

**File: `db-project-backend/server.js`**

```javascript
import cloudflareRoutes from './routes/cloudflareRoutes.js';

app.use('/api/cloudflare', cloudflareRoutes);
```

## Testing

### Test DNS Propagation

```bash
# Check DNS propagation
dig crimelens.example.com

# Should show Cloudflare IPs
nslookup crimelens.example.com
```

### Test SSL/TLS

```bash
# Test SSL configuration
curl -I https://crimelens.example.com

# Check SSL rating
# https://www.ssllabs.com/ssltest/analyze.html?d=crimelens.example.com
```

### Test Caching

```bash
# Test cache headers for static assets
curl -I https://crimelens.example.com/assets/main.js

# Should see CF-Cache-Status: HIT
```

### Test Cache Purge

```bash
# Test cache purge endpoint
curl -X POST http://localhost:5001/api/cloudflare/purge \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"urls": ["https://crimelens.example.com/api/stats/summary"]}'
```

### Test Analytics

```bash
# Fetch analytics
curl http://localhost:5001/api/cloudflare/analytics \
  -H "Authorization: Bearer <token>"
```

## Expected Results

- **DNS**: All traffic routes through Cloudflare
- **SSL/TLS**: Full strict mode with origin certificates
- **Caching**: Static assets cached at edge, API bypasses cache
- **Security**: Bot protection, hotlink protection enabled
- **Performance**: Brotli compression, HTTP/2, HTTP/3 enabled
- **Analytics**: Can fetch usage metrics from Cloudflare API

## Success Criteria

- [ ] Domain successfully added to Cloudflare
- [ ] DNS propagated to Cloudflare nameservers
- [ ] SSL/TLS configured with origin certificates
- [ ] Caching rules configured for static assets
- [ ] API endpoints bypass cache correctly
- [ ] Security features enabled
- [ ] Cache purge endpoint functional
- [ ] Analytics endpoint returns data
- [ ] Origin server restricted to Cloudflare IPs

## Files Created/Modified

```
nginx/
├── nginx.conf (modified - Cloudflare IP restrictions)
└── ssl/
    ├── cloudflare-origin.pem (new - from Cloudflare)
    └── cloudflare-origin.key (new - from Cloudflare)

db-project-backend/
├── config/
│   └── cloudflare.js (new)
├── controllers/
│   └── cloudflareController.js (new)
├── routes/
│   └── cloudflareRoutes.js (new)
└── server.js (modified - add routes)

cloudflare-workers/
└── header-worker.js (new)

.env (modified - add Cloudflare credentials)
```

## Cloudflare Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Cloudflare Network                       │
│                         (CDN Edge)                           │
└────────────┬────────────────────────────────────────────────┘
             │
             │ HTTPS (TLS 1.3)
             │
    ┌────────▼────────┐
    │   Cloudflare    │
    │    Proxy        │
    │  (Smart Route)  │
    └────────┬────────┘
             │
             │ HTTPS (Full Strict)
             │
    ┌────────▼────────┐
    │     Nginx       │
    │  (Termination)  │
    └────────┬────────┘
             │
             │ HTTP (Internal)
             │
    ┌────────▼────────┐
    │   Backend API   │
    │   Node.js       │
    └─────────────────┘
```

## Environment Variables

**File: `.env`**

```bash
# Cloudflare Configuration
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_ZONE_ID=your_zone_id
CLOUDFLARE_DOMAIN=crimelens.example.com
```

## Dependencies

- Phase 9 Docker (origin server configuration)
- Phase 10 Nginx (SSL termination)
- All previous phases (complete application stack)

## Rollback Procedure

If Cloudflare causes issues:
1. Change DNS records to "DNS Only" (gray cloud)
2. Direct traffic bypasses Cloudflare
3. Investigate issues in Cloudflare dashboard
4. Re-enable proxy when resolved

## Estimated Completion Time

- DNS setup & propagation: 24-48 hours (waiting time)
- SSL/TLS configuration: 1 hour
- Caching rules: 30 minutes
- Security setup: 30 minutes
- Performance optimization: 30 minutes
- Analytics integration: 1 hour
- Testing: 1 hour
- **Total: ~4 hours (plus DNS propagation time)**
