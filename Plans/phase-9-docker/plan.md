# Phase 9: Docker Containerization

## Objective

Create production-ready Docker configuration for containerizing the CrimeLens application and its dependencies (backend, frontend, Redis, PostgreSQL) for consistent deployment and development environments.

## What We'll Implement

1. **Backend Dockerfile** (multi-stage build)
2. **Frontend Dockerfile** (nginx serving static build)
3. **Docker Compose** for orchestration
4. **Production-optimized images**
5. **Health check integration**

## Implementation Steps

### Step 1: Create Backend Dockerfile

**File: `Dockerfile.backend`**

```dockerfile
# Multi-stage build for backend
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY db-project-backend/package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY db-project-backend/ ./

# Build TypeScript if needed (not required for current setup but good practice)
RUN npm run build 2>/dev/null || true

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    curl \
    && addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001

# Copy node_modules and app from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app ./

# Create logs directory
RUN mkdir -p /app/logs && chown -R nodejs:nodejs /app/logs

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:5001/api/health || exit 1

# Start application
CMD ["node", "server.js"]
```

### Step 2: Create Frontend Dockerfile

**File: `Dockerfile.frontend`**

```dockerfile
# Multi-stage build for frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY db-project-frontend/package*.json ./

# Install dependencies
RUN npm ci && npm cache clean --force

# Copy application code
COPY db-project-frontend/ ./

# Build production bundle
RUN npm run build

# Production stage with nginx
FROM nginx:1.25-alpine AS production

# Copy custom nginx config
COPY docker/nginx.conf /etc/nginx/nginx.conf

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Add nginx user and permissions
RUN addgroup -g 1001 -S nginx && \
    adduser -S nginx -u 1001 && \
    chown -R nginx:nginx /usr/share/nginx/html

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

### Step 3: Create Nginx Configuration

**File: `docker/nginx.conf`**

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
    types_hash_max_size 2048;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/xml+rss;

    server {
        listen 80;
        server_name _;

        root /usr/share/nginx/html;
        index index.html;

        # Security headers
        add_header X-Frame-Options "DENY" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "no-referrer-when-downgrade" always;

        # SPA routing
        location / {
            try_files $uri $uri/ /index.html;
        }

        # Static assets caching
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # API proxy (remove in production with proper reverse proxy)
        location /api/ {
            proxy_pass http://backend:5001;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

### Step 4: Create Docker Compose

**File: `docker-compose.yml`**

```yaml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    container_name: crimelens-backend
    restart: unless-stopped
    ports:
      - "5001:5001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - CORS_ORIGINS=${CORS_ORIGINS}
      - CLOUDINARY_CLOUD_NAME=${CLOUDINARY_CLOUD_NAME}
      - CLOUDINARY_API_KEY=${CLOUDINARY_API_KEY}
      - CLOUDINARY_API_SECRET=${CLOUDINARY_API_SECRET}
    env_file:
      - .env
    volumes:
      - backend_logs:/app/logs
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - crimelens-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    container_name: crimelens-frontend
    restart: unless-stopped
    ports:
      - "8080:80"
    depends_on:
      - backend
    networks:
      - crimelens-network
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost/"]
      interval: 30s
      timeout: 3s
      retries: 3

  redis:
    image: redis:7-alpine
    container_name: crimelens-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - crimelens-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru

  prometheus:
    image: prom/prometheus:latest
    container_name: crimelens-prometheus
    restart: unless-stopped
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=200h'
      - '--web.enable-lifecycle'
    networks:
      - crimelens-network

  grafana:
    image: grafana/grafana:latest
    container_name: crimelens-grafana
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_USER=${GRAFANA_ADMIN_USER:-admin}
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD:-admin}
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana_data:/var/lib/grafana
      - ./db-project-backend/config/grafana/provisioning:/etc/grafana/provisioning
    depends_on:
      - prometheus
    networks:
      - crimelens-network

networks:
  crimelens-network:
    driver: bridge

volumes:
  backend_logs:
  redis_data:
  prometheus_data:
  grafana_data:
```

### Step 5: Create Docker Compose for Development

**File: `docker-compose.dev.yml`**

```yaml
version: '3.8'

services:
  backend-dev:
    build:
      context: .
      dockerfile: Dockerfile.backend
      target: builder
    container_name: crimelens-backend-dev
    volumes:
      - ./db-project-backend:/app
      - /app/node_modules
    ports:
      - "5001:5001"
    environment:
      - NODE_ENV=development
      - LOG_LEVEL=debug
    command: npm start
    networks:
      - crimelens-network

  frontend-dev:
    build:
      context: .
      dockerfile: Dockerfile.frontend
      target: builder
    container_name: crimelens-frontend-dev
    volumes:
      - ./db-project-frontend:/app
      - /app/node_modules
    ports:
      - "5173:5173"
    environment:
      - VITE_API_BASE_URL=http://localhost:5001/api
    command: npm run dev -- --host 0.0.0.0
    networks:
      - crimelens-network

  redis-dev:
    image: redis:7-alpine
    container_name: crimelens-redis-dev
    ports:
      - "6379:6379"
    networks:
      - crimelens-network

networks:
  crimelens-network:
    driver: bridge
```

### Step 6: Create .dockerignore Files

**File: `.dockerignore`**

```
# Git
.git
.gitignore

# Docker
Dockerfile*
docker-compose*
.dockerignore

# CI/CD
.github

# Documentation
docs
*.md
LICENSE

# Development files
*.log
.vscode
.idea
*.swp
*.swo

# Dependencies (will be installed in container)
node_modules
npm-debug.log

# Environment
.env.local
.env.*.local

# Test files
coverage
.nyc_output
*.test.js
tests/
```

**File: `db-project-backend/.dockerignore`**

```
node_modules
npm-debug.log
.env.local
.env.*.local
coverage
.vscode
.idea
*.log
```

**File: `db-project-frontend/.dockerignore`**

```
node_modules
npm-debug.log
.env.local
.env.*.local
dist
dist-ssr
coverage
.vscode
.idea
*.log
```

### Step 7: Add Docker-specific Environment Variables

**File: `.docker.env`**

```bash
# Docker-specific configuration
DOCKER_BACKEND_PORT=5001
DOCKER_FRONTEND_PORT=8080
DOCKER_REDIS_PORT=6379
DOCKER_PROMETHEUS_PORT=9090
DOCKER_GRAFANA_PORT=3000

# Production settings
NODE_ENV=production
LOG_LEVEL=info
```

## Docker Commands

### Build Images

```bash
# Build all images
docker-compose build

# Build specific service
docker-compose build backend

# Build without cache
docker-compose build --no-cache
```

### Run Containers

```bash
# Production
docker-compose up -d

# Development
docker-compose -f docker-compose.dev.yml up

# View logs
docker-compose logs -f backend
```

### Container Management

```bash
# Stop all
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Restart service
docker-compose restart backend

# Execute command in container
docker-compose exec backend sh
```

## Testing

### Test Container Health

```bash
# Check container status
docker-compose ps

# Check health logs
docker-compose logs backend | grep health

# Test health endpoint
curl http://localhost:8080/api/health
```

### Test Image Size

```bash
# Check image sizes
docker images crimelens-*

# Expected sizes:
# backend: ~200MB
# frontend: ~50MB (nginx base)
# redis: ~40MB
```

## Success Criteria

- [ ] Backend Dockerfile builds successfully
- [ ] Frontend Dockerfile builds successfully
- [ ] docker-compose up starts all services
- [ ] Health checks pass for all containers
- [ ] API accessible from frontend container
- [ ] Prometheus and Grafana operational
- [ ] Development docker-compose works
- [ ] Images optimized for size
- [ ] Non-root user security

## Files Created

```
/
├── Dockerfile.backend (new)
├── Dockerfile.frontend (new)
├── docker-compose.yml (new)
├── docker-compose.dev.yml (new)
├── .dockerignore (new)
├── docker/
│   └── nginx.conf (new)
├── db-project-backend/
│   └── .dockerignore (new)
├── db-project-frontend/
│   └── .dockerignore (new)
└── .docker.env (new)
```

## Container Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Docker Network                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │  Frontend   │  │   Backend   │  │   Redis     │       │
│  │   (nginx)   │  │  (Node.js)  │  │  (cache)    │       │
│  │   Port 80   │──│  Port 5001  │──│  Port 6379  │       │
│  └─────────────┘  └─────────────┘  └─────────────┘       │
│         │                  │              │                 │
│         └──────────────────┴──────────────┘               │
│                           │                                │
│                  ┌────────▼────────┐                     │
│                  │  Prometheus     │                     │
│                  │  Port 9090     │                     │
│                  └────────┬────────┘                     │
│                           │                             │
│                  ┌────────▼────────┐                     │
│                  │    Grafana     │                     │
│                  │   Port 3000    │                     │
│                  └────────────────┘                     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Dependencies

- All previous phases (0-8) integrated
- Health checks for Docker health checks
- Metrics for Prometheus monitoring

## Rollback Procedure

If Docker build fails:
1. Check Dockerfile syntax
2. Verify base images are available
3. Check network connectivity
4. Review build logs for specific errors

## Estimated Completion Time

- Dockerfile creation: 1.5 hours
- Docker Compose setup: 1 hour
- Nginx configuration: 30 minutes
- Testing: 1 hour
- **Total: 4 hours**
