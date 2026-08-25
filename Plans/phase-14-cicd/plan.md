# Phase 14: GitHub Actions CI/CD

## Objective

Implement a comprehensive CI/CD pipeline using GitHub Actions to automate testing, building, security scanning, and deployment of the CrimeLens application.

## What We'll Implement

1. **CI pipeline** for automated testing on pull requests
2. **Security scanning** (CodeQL, dependency check, secrets)
3. **Docker image building** and pushing to registry
4. **Automated deployment** to production/staging
5. **Environment management** with GitHub environments
6. **Release automation** with version tagging

## Implementation Steps

### Step 1: Create GitHub Environments

**GitHub Actions → Settings → Environments**

Create two environments:

1. **staging** - For pre-production testing
2. **production** - For live deployment

**Production Environment Configuration:**
- Required reviewers: 1
- Deployment branch: `main`
- Environment secrets: (configured in Step 8)

### Step 2: Create Main CI Workflow

**File: `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [dev, main]
  pull_request:
    branches: [dev, main]
  workflow_dispatch:

jobs:
  lint-backend:
    name: Lint Backend
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./db-project-backend

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: ./db-project-backend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

  lint-frontend:
    name: Lint Frontend
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./db-project-frontend

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: ./db-project-frontend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

  typecheck-backend:
    name: Typecheck Backend
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./db-project-backend

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: ./db-project-backend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Run TypeScript check
        run: npx tsc --noEmit

  typecheck-frontend:
    name: Typecheck Frontend
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./db-project-frontend

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: ./db-project-frontend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Run TypeScript check
        run: npx tsc --noEmit

  test-backend:
    name: Test Backend
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./db-project-backend

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: crimelens_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    env:
      NODE_ENV: test
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/crimelens_test
      REDIS_URL: redis://localhost:6379
      JWT_SECRET: test_secret_for_ci_only
      SUPABASE_URL: https://test.supabase.co
      SUPABASE_ANON_KEY: test_anon_key
      SUPABASE_SERVICE_ROLE_KEY: test_service_key

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: ./db-project-backend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm run test:coverage

      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
        with:
          files: ./db-project-backend/coverage/lcov.info
          flags: backend
          name: backend-coverage

  test-frontend:
    name: Test Frontend
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./db-project-frontend

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: ./db-project-frontend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm run test:coverage

      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
        with:
          files: ./db-project-frontend/coverage/lcov.info
          flags: frontend
          name: frontend-coverage

  build-frontend:
    name: Build Frontend
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./db-project-frontend

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: ./db-project-frontend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Build production
        run: npm run build

      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: frontend-dist
          path: db-project-frontend/dist/
          retention-days: 7

  security-scan:
    name: Security Scan
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run CodeQL Analysis
        uses: github/codeql-action/init@v2
        with:
          languages: javascript, typescript

      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v2
        with:
          category: "/language:javascript-typescript"

  dependency-check:
    name: Dependency Check
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run npm audit (backend)
        working-directory: ./db-project-backend
        run: npm audit --production

      - name: Run npm audit (frontend)
        working-directory: ./db-project-frontend
        run: npm audit --production

      - name: Check for vulnerabilities
        uses: actions/github-script@v7
        with:
          script: |
            console.log('Dependency check completed')
```

### Step 3: Create Docker Build Workflow

**File: `.github/workflows/docker-build.yml`**

```yaml
name: Docker Build

on:
  push:
    branches: [main, dev]
    tags: ['v*']
  pull_request:
    branches: [main, dev]

jobs:
  build-backend:
    name: Build Backend Image
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}/crimelens-backend
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha,prefix={{branch}}-
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile.backend
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  build-frontend:
    name: Build Frontend Image
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}/crimelens-frontend
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha,prefix={{branch}}-
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile.frontend
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  scan-backend:
    name: Scan Backend Image
    runs-on: ubuntu-latest
    needs: build-backend
    permissions:
      contents: read
      security-events: write

    steps:
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build image for scanning
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile.backend
          tags: ghcr.io/${{ github.repository }}/crimelens-backend:scan
          load: true

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ghcr.io/${{ github.repository }}/crimelens-backend:scan
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'CRITICAL,HIGH'

      - name: Upload Trivy results to GitHub Security
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'
```

### Step 4: Create Deployment Workflow

**File: `.github/workflows/deploy.yml`**

```yaml
name: Deploy

on:
  push:
    branches:
      - main
  workflow_dispatch:
    inputs:
      environment:
        description: 'Deployment environment'
        required: true
        default: 'staging'
        type: choice
        options:
          - staging
          - production

jobs:
  deploy-staging:
    name: Deploy to Staging
    if: github.ref == 'refs/heads/main' || github.event.inputs.environment == 'staging'
    runs-on: ubuntu-latest
    environment:
      name: staging
      url: https://staging.crimelens.example.com

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.STAGING_HOST }}
          username: ${{ secrets.STAGING_USER }}
          key: ${{ secrets.STAGING_SSH_KEY }}
          port: ${{ secrets.STAGING_PORT || 22 }}
          script: |
            cd /opt/crimelens
            docker-compose -f docker-compose.staging.yml pull
            docker-compose -f docker-compose.staging.yml up -d
            docker image prune -f

      - name: Run database migrations
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.STAGING_HOST }}
          username: ${{ secrets.STAGING_USER }}
          key: ${{ secrets.STAGING_SSH_KEY }}
          port: ${{ secrets.STAGING_PORT || 22 }}
          script: |
            cd /opt/crimelens
            docker-compose -f docker-compose.staging.yml exec -T backend npm run migrate

      - name: Health check
        run: |
          for i in {1..30}; do
            if curl -sf https://staging.crimelens.example.com/api/health > /dev/null; then
              echo "Health check passed"
              exit 0
            fi
            echo "Health check attempt $i failed, retrying..."
            sleep 10
          done
          echo "Health check failed after 30 attempts"
          exit 1

  deploy-production:
    name: Deploy to Production
    if: github.event.inputs.environment == 'production'
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://crimelens.example.com

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Create release tag
        id: tag
        run: |
          TAG="v$(date +%Y.%m.%d-%H%M%S)"
          echo "tag=$TAG" >> $GITHUB_OUTPUT
          git tag $TAG
          git push origin $TAG

      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.PRODUCTION_HOST }}
          username: ${{ secrets.PRODUCTION_USER }}
          key: ${{ secrets.PRODUCTION_SSH_KEY }}
          port: ${{ secrets.PRODUCTION_PORT || 22 }}
          script: |
            cd /opt/crimelens
            # Backup current deployment
            docker-compose -f docker-compose.yml backup
            # Pull new images
            docker-compose -f docker-compose.yml pull
            # Deploy with zero-downtime
            docker-compose -f docker-compose.yml up -d --no-deps --build backend frontend
            docker-compose -f docker-compose.yml up -d
            # Clean up
            docker image prune -f

      - name: Run database migrations
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.PRODUCTION_HOST }}
          username: ${{ secrets.PRODUCTION_USER }}
          key: ${{ secrets.PRODUCTION_SSH_KEY }}
          port: ${{ secrets.PRODUCTION_PORT || 22 }}
          script: |
            cd /opt/crimelens
            docker-compose -f docker-compose.yml exec -T backend npm run migrate

      - name: Health check
        run: |
          for i in {1..30}; do
            if curl -sf https://crimelens.example.com/api/health > /dev/null; then
              echo "Health check passed"
              exit 0
            fi
            echo "Health check attempt $i failed, retrying..."
            sleep 10
          done
          echo "Health check failed after 30 attempts"
          exit 1

      - name: Run smoke tests
        run: |
          npm install -g k6
          k6 run tests/k6/runs/smoke-test.js --env TARGET_URL=https://crimelens.example.com

      - name: Notify on failure
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            core.setFailed('Production deployment failed')

      - name: Rollback on failure
        if: failure()
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.PRODUCTION_HOST }}
          username: ${{ secrets.PRODUCTION_USER }}
          key: ${{ secrets.PRODUCTION_SSH_KEY }}
          port: ${{ secrets.PRODUCTION_PORT || 22 }}
          script: |
            cd /opt/crimelens
            docker-compose -f docker-compose.yml rollback
```

### Step 5: Create Release Workflow

**File: `.github/workflows/release.yml`**

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    name: Create Release
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Generate changelog
        id: changelog
        run: |
          echo "## What's Changed" > CHANGELOG.md
          git log --pretty=format:"- %s" $(git describe --tags --abbrev=0 HEAD^)..HEAD >> CHANGELOG.md

      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            CHANGELOG.md
          body_path: CHANGELOG.md
          draft: false
          prerelease: false
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Step 6: Create Staging Docker Compose

**File: `docker-compose.staging.yml`**

```yaml
version: '3.8'

services:
  backend:
    image: ghcr.io/${REPO_OWNER}/crimelens-backend:dev
    container_name: crimelens-backend-staging
    restart: unless-stopped
    environment:
      - NODE_ENV=staging
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - CORS_ORIGINS=https://staging.crimelens.example.com
    env_file:
      - .env.staging
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - crimelens-staging

  frontend:
    image: ghcr.io/${REPO_OWNER}/crimelens-frontend:dev
    container_name: crimelens-frontend-staging
    restart: unless-stopped
    depends_on:
      - backend
    networks:
      - crimelens-staging

  redis:
    image: redis:7-alpine
    container_name: crimelens-redis-staging
    restart: unless-stopped
    networks:
      - crimelens-staging
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

networks:
  crimelens-staging:
    driver: bridge
```

### Step 7: Add NPM Scripts for CI

**File: `db-project-backend/package.json`**

```json
{
  "scripts": {
    "test": "jest",
    "test:coverage": "jest --coverage",
    "lint": "eslint . --ext .js",
    "typecheck": "tsc --noEmit",
    "migrate": "node scripts/migrate.js"
  }
}
```

**File: `db-project-frontend/package.json`**

```json
{
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint . --ext .ts,.tsx",
    "typecheck": "tsc --noEmit",
    "build": "vite build"
  }
}
```

### Step 8: Configure GitHub Secrets

**GitHub Repository → Settings → Secrets and variables → Actions**

Add the following secrets:

**Environment: staging**
- `STAGING_HOST` - Staging server hostname
- `STAGING_USER` - SSH username
- `STAGING_SSH_KEY` - Private SSH key
- `STAGING_PORT` - SSH port (default: 22)

**Environment: production**
- `PRODUCTION_HOST` - Production server hostname
- `PRODUCTION_USER` - SSH username
- `PRODUCTION_SSH_KEY` - Private SSH key
- `PRODUCTION_PORT` - SSH port (default: 22)

**Repository Secrets (for Docker builds)**
- `DOCKER_REGISTRY` - ghcr.io
- `DOCKER_USERNAME` - ${{ github.actor }} (auto)
- `DOCKER_PASSWORD` - ${{ secrets.GITHUB_TOKEN }} (auto)

## Testing

### Test CI Pipeline

```bash
# Create a test branch
git checkout -b test/ci-pipeline

# Make a small change
echo "# Test" >> README.md

# Commit and push
git add README.md
git commit -m "test: trigger CI pipeline"
git push origin test/ci-pipeline

# Create pull request on GitHub
# Watch all CI jobs run
```

### Test Docker Build

```bash
# Tag a commit to trigger Docker build
git tag v0.1.0-test
git push origin v0.1.0-test

# Check Actions tab for build progress
```

### Test Deployment (Staging)

```bash
# Merge to main branch
git checkout main
git merge test/ci-pipeline
git push origin main

# Monitor deployment to staging
```

## Expected Results

- **CI Pipeline**: All tests pass on pull request
- **Docker Build**: Images built and pushed to registry
- **Security Scan**: Vulnerabilities detected and reported
- **Deployment**: Automated deployment to staging/production
- **Release**: Automated changelog and release creation

## Success Criteria

- [ ] CI pipeline runs on every pull request
- [ ] All checks (lint, typecheck, test) pass
- [ ] Docker images built successfully
- [ ] Security scans integrated
- [ ] Staging deployment automated
- [ ] Production deployment requires approval
- [ ] Health checks prevent failed deployments
- [ ] Rollback on deployment failure

## Files Created

```
.github/
├── workflows/
│   ├── ci.yml (new)
│   ├── docker-build.yml (new)
│   ├── deploy.yml (new)
│   └── release.yml (new)

docker-compose.staging.yml (new)
db-project-backend/package.json (modified - scripts)
db-project-frontend/package.json (modified - scripts)
```

## CI/CD Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      GitHub Repository                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────┐      ┌────────────────┐               │
│  │  Pull Request  │──────▶│     CI Job      │               │
│  │   (dev → main) │       │  - Lint         │               │
│  └────────────────┘       │  - Typecheck    │               │
│                           │  - Test         │               │
│                           │  - Security     │               │
│                           └───────┬────────┘               │
│                                   │                         │
│                                   ▼                         │
│  ┌──────────────────────────────────────────────┐         │
│  │           Docker Build Job                    │         │
│  │  - Build Backend Image                        │         │
│  │  - Build Frontend Image                       │         │
│  │  - Scan for Vulnerabilities                   │         │
│  │  - Push to Registry                           │         │
│  └────────────────────┬───────────────────────────┘         │
│                       │                                      │
│  ┌────────────────────▼───────────────────────────┐         │
│  │          Deploy Job (main → staging)           │         │
│  │  - SSH to Server                               │         │
│  │  - docker-compose pull                         │         │
│  │  - docker-compose up -d                        │         │
│  │  - Run migrations                              │         │
│  │  - Health check                                │         │
│  └────────────────────────────────────────────────┘         │
│                           │                                  │
│  ┌────────────────────────▼───────────────────────────┐    │
│  │     Deploy Job (manual → production)                │    │
│  │  - Require approval                                 │    │
│  │  - Zero-downtime deployment                         │    │
│  │  - Rollback on failure                              │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Dependencies

- All previous phases (complete application stack)
- Phase 9 Docker (container images)
- Phase 10 Nginx (production configuration)

## Rollback Procedure

If deployment fails:
1. Automatic rollback triggers on health check failure
2. Manual rollback via workflow dispatch
3. Revert to previous Git tag if needed

## Estimated Completion Time

- CI workflow setup: 2 hours
- Docker build workflow: 1 hour
- Deployment workflow: 1.5 hours
- Release workflow: 30 minutes
- Environment configuration: 30 minutes
- Testing: 1 hour
- **Total: 6.5 hours**
