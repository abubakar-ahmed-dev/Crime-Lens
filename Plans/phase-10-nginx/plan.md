# Phase 10: Nginx Reverse Proxy & Load Balancing

## Objective

Implement Nginx as a reverse proxy and load balancer to distribute traffic across multiple API instances, handle SSL termination, and provide a single entry point for the application.

## What We'll Implement

1. **Nginx reverse proxy** configuration
2. **Load balancing** for multiple backend instances
3. **SSL/TLS** termination
4. **Static file serving** optimization
5. **Health check** integration

## Implementation Steps

### Step 1: Create Nginx Main Configuration

**File: `nginx/nginx.conf`**

```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 2048;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging format
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for" '
                    'rt=$request_time uct="$upstream_connect_time" '
                    'uht="$upstream_header_time" urt="$upstream_response_time"';

    access_log /var/log/nginx/access.log main;

    # Performance settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    server_tokens off;

    # Buffer sizes
    client_body_buffer_size 128k;
    client_max_body_size 10m;
    client_header_buffer_size 1k;
    large_client_header_buffers 4 16k;

    # Timeouts
    client_body_timeout 12;
    client_header_timeout 12;
    send_timeout 10;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/rss+xml application/atom+xml image/svg+xml;

    # Upstream backend servers
    upstream crimelens_backend {
        # Load balancing method
        least_conn;

        # Backend servers (will be scaled in Phase 11)
        server backend1:5001 max_fails=3 fail_timeout=30s;
        server backend2:5001 max_fails=3 fail_timeout=30s;
        server backend3:5001 max_fails=3 fail_timeout=30s;

        # Health check
        check interval=30s rise=2 fall=3;
    }

    # Upstream for development (single instance)
    upstream crimelens_backend_dev {
        server backend:5001;
    }

    # Rate limiting zones
    limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/m;
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=50r/m;
    limit_req_zone $binary_remote_addr zone=write_limit:10m rate=10r/m;

    # Connection limiting
    limit_conn_zone $binary_remote_addr zone=addr:10m;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Main server block
    server {
        listen 80;
        listen [::]:80;
        server_name crimelens.example.com;

        # Redirect HTTP to HTTPS
        return 301 https://$server_name$request_uri;
    }

    # HTTPS server block
    server {
        listen 443 ssl http2;
        listen [::]:443 ssl http2;
        server_name crimelens.example.com;

        # SSL certificates (use Let's Encrypt in production)
        ssl_certificate /etc/nginx/ssl/crimelens.crt;
        ssl_certificate_key /etc/nginx/ssl/crimelens.key;

        # Security headers
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
        add_header X-Frame-Options "DENY" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none';" always;

        # Client body size limit
        client_max_body_size 10m;

        # Root directory
        root /usr/share/nginx/html;
        index index.html;

        # Frontend (SPA routing)
        location / {
            try_files $uri $uri/ /index.html;

            # Cache static assets
            location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
                expires 1y;
                add_header Cache-Control "public, immutable";
                access_log off;
            }
        }

        # API proxy with rate limiting
        location /api/auth/login {
            limit_req zone=auth_limit burst=3 nodelay;
            proxy_pass http://crimelens_backend;
            include proxy_params;
        }

        location /api/citizens/login {
            limit_req zone=auth_limit burst=3 nodelay;
            proxy_pass http://crimelens_backend;
            include proxy_params;
        }

        location /api/crimes/report {
            limit_req zone=write_limit burst=5 nodelay;
            proxy_pass http://crimelens_backend;
            include proxy_params;
        }

        location /api/ {
            limit_req zone=api_limit burst=20;
            proxy_pass http://crimelens_backend;
            include proxy_params;
        }

        # Metrics endpoint (no rate limiting)
        location /metrics {
            proxy_pass http://crimelens_backend;
            include proxy_params;
            allow 127.0.0.1;
            allow 172.16.0.0/12;
            deny all;
        }

        # Health checks (no rate limiting)
        location /health {
            proxy_pass http://crimelens_backend;
            include proxy_params;
            access_log off;
        }

        location /ready {
            proxy_pass http://crimelens_backend;
            include proxy_params;
            access_log off;
        }

        # Connection limiting per IP
        limit_conn addr 10;
    }
}
```

### Step 2: Create Proxy Parameters File

**File: `nginx/proxy_params`**

```nginx
# Proxy parameters
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection 'upgrade';
proxy_set_header Host $host;
proxy_cache_bypass $http_upgrade;

# Forward real IP
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;

# Timeouts
proxy_connect_timeout 30s;
proxy_send_timeout 30s;
proxy_read_timeout 30s;

# Buffering
proxy_buffering on;
proxy_buffer_size 4k;
proxy_buffers 8 4k;
proxy_busy_buffers_size 8k;

# Redirect handling
proxy_redirect off;

# Request tracking
proxy_set_header X-Request-ID $request_id;
```

### Step 3: Update Docker Compose for Nginx

**File: `docker-compose.yml`** (add nginx service)

```yaml
services:
  nginx:
    image: nginx:1.25-alpine
    container_name: crimelens-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/proxy_params:/etc/nginx/proxy_params:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - nginx_logs:/var/log/nginx
    depends_on:
      - backend
    networks:
      - crimelens-network
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 3s
      retries: 3

  # ... other services remain the same
```

### Step 4: Create Development Nginx Config

**File: `nginx/nginx-dev.conf`**

```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    server_tokens off;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript;

    server {
        listen 80;
        server_name localhost;

        client_max_body_size 10m;

        # Frontend
        location / {
            proxy_pass http://frontend:80;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Backend API
        location /api/ {
            proxy_pass http://backend:5001;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
```

### Step 5: Add SSL Certificate Setup Script

**File: `nginx/setup-ssl.sh`**

```bash
#!/bin/bash

# Setup SSL certificates for local development (self-signed)
# For production, use Let's Encrypt

SSL_DIR="./nginx/ssl"

mkdir -p $SSL_DIR

# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout $SSL_DIR/crimelens.key \
  -out $SSL_DIR/crimelens.crt \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=crimelens.example.com"

# Set permissions
chmod 600 $SSL_DIR/crimelens.key
chmod 644 $SSL_DIR/crimelens.crt

echo "SSL certificates generated in $SSL_DIR"
echo "For production, use Let's Encrypt:"
echo "  certbot certonly --webroot -w /var/www/html -d crimelens.example.com"
```

### Step 6: Create Nginx Reload Script

**File: `scripts/nginx-reload.sh`**

```bash
#!/bin/bash

# Reload nginx configuration without downtime

echo "Testing nginx configuration..."
docker exec crimelens-nginx nginx -t

if [ $? -eq 0 ]; then
    echo "Configuration is valid. Reloading nginx..."
    docker exec crimelens-nginx nginx -s reload
    echo "Nginx reloaded successfully!"
else
    echo "Configuration test failed. Not reloading."
    exit 1
fi
```

## Testing

### Test Reverse Proxy

```bash
# Test through nginx
curl http://localhost/api/health

# Test SSL (if configured)
curl https://localhost/api/health --insecure

# Test load balancing
for i in {1..10}; do
  curl -s http://localhost/api/health | grep -o '"request_id":"[^"]*"'
done
# Should show different backend instances responding
```

### Test Health Checks

```bash
# Check nginx health
docker-compose ps nginx

# Check nginx logs
docker-compose logs nginx | tail -20
```

### Test SSL Configuration

```bash
# Test SSL configuration
curl -I https://crimelens.example.com/api/health

# Check SSL rating
# https://www.ssllabs.com/ssltest/analyze.html?d=crimelens.example.com
```

## Expected Results

- **Single entry point**: All traffic through nginx
- **Load distribution**: Traffic balanced across backends
- **SSL termination**: HTTPS at nginx, HTTP to backends
- **Static file caching**: Frontend assets cached at edge
- **Health checks**: Nginx checks backend health
- **Rate limiting**: IP-based limits enforced

## Success Criteria

- [ ] Nginx reverse proxy operational
- [ ] Load balancing working (Phase 11 will verify multiple instances)
- [ ] SSL/TLS configured
- [ ] Security headers present
- [ ] Health checks functional
- [ ] Static assets served efficiently
- [ ] Configuration reload works without downtime

## Files Created

```
nginx/
├── nginx.conf (new)
├── nginx-dev.conf (new)
├── proxy_params (new)
├── ssl/
│   └── (generated by setup script)
└── logs/ (created by nginx)

scripts/
└── nginx-reload.sh (new)

docker-compose.yml (modified - add nginx)
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Nginx                                │
│                   (Port 80 / 443)                          │
└────────────┬────────────────────────────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
┌───▼───┐        ┌───▼────┐
│Frontend│        │Backend │
│ :80   │        │ Upstream│
│       │        │         │
└───────┘        │┌───────┐│
                 ││Backend1││
                 ││ :5001 ││
                 │└───────┘│
                 │┌───────┐│
                 ││Backend2││ (Phase 11)
                 ││ :5001 ││
                 │└───────┘│
                 │┌───────┐│
                 ││Backend3││
                 ││ :5001 ││
                 │└───────┘│
                 └─────────┘
```

## Dependencies

- Phase 9 Docker (containers for nginx and backends)
- Phase 2 health checks (for backend health)
- Phase 4 rate limiting (complementary)

## Rollback Procedure

If nginx causes issues:
1. Remove nginx service from docker-compose.yml
2. Expose backend directly on port 5001
3. Restart docker-compose

## Estimated Completion Time

- Nginx configuration: 1.5 hours
- Docker integration: 30 minutes
- SSL setup: 30 minutes
- Testing: 30 minutes
- **Total: 3 hours**
