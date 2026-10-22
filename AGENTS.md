# AGENTS.md

This file provides guidance to AI coding agents working with code in this repository.

## Project Overview

A complete containerized three-tier Node.js application demonstrating multi-environment deployment patterns. The application includes a web frontend, two backend APIs (one for SQL operations, one for storage operations), SQL Server, and Azure Storage emulator.

This is an MVP POC for infrastructure demonstration purposes.

## Architecture

### Directory Structure
- `frontend/` - Express server serving static web UI (port 3000)
- `api-1/` - Express API for SQL Server operations (port 3001)
- `api-2/` - Express API for Azure Storage operations (port 3002)
- `infra/kubernetes/` - Kubernetes manifests for minikube deployment
- `infra/azure/` - Azure Container Instance deployment scripts and config
- `docker compose.yml` - Local development orchestration
- `Makefile` - Common operations and shortcuts

### Service Communication
- Frontend calls API 1 at `http://api-1-service:3001` (K8s) or `http://api-1:3001` (Docker)
- Frontend calls API 2 at `http://api-2-service:3002` (K8s) or `http://api-2:3002` (Docker)
- API 1 connects to SQL Server at `sqlserver-service:1433` (K8s) or `sqlserver:1433` (Docker)
- API 2 connects to Azurite at `azurite-service:10000` (K8s) or `azurite:10000` (Docker)

### Key Dependencies
All services use:
- Node.js 18 (alpine base image)
- Express 4.x for web server
- dotenv for environment configuration
- cors for cross-origin requests

API-specific:
- `api-1/` uses `mssql` package for SQL Server connectivity
- `api-2/` uses `@azure/storage-blob` for Azure Storage and `multer` for file uploads

## Common Development Commands

### Quick Start
```bash
make up          # Start all services with Docker Compose
make down        # Stop all services
make logs        # View logs from all services
make help        # See all available commands
```

### Docker Compose (Local Development)
```bash
docker compose up -d                      # Start all services detached
docker compose up -d sqlserver azurite    # Start only dependencies
docker compose logs -f frontend           # Follow frontend logs
docker compose ps                         # List running services
docker compose down -v                    # Stop and remove volumes
docker compose restart api-1              # Restart specific service
```

Access services:
- Frontend: http://localhost:3000
- API 1: http://localhost:3001
- API 2: http://localhost:3002

### Kubernetes (Minikube)
```bash
# Initial setup
minikube start --memory=4096 --cpus=2
eval $(minikube docker-env)

# Build images
make k8s-build
# Or manually:
docker build -t frontend:latest ./frontend
docker build -t api-1:latest ./api-1
docker build -t api-2:latest ./api-2

# Deploy
make k8s-deploy
# Or manually:
kubectl apply -f infra/kubernetes/

# Access and monitor
minikube service frontend-service -n three-tier-demo    # Open frontend
kubectl get pods -n three-tier-demo -w                   # Watch pod status
kubectl logs -n three-tier-demo -l app=frontend          # View frontend logs
kubectl logs -n three-tier-demo -l app=api-1             # View API 1 logs

# Scaling
kubectl scale deployment frontend -n three-tier-demo --replicas=3

# Cleanup
kubectl delete namespace three-tier-demo
```

### Local Development (Without Docker)
```bash
# Install dependencies
cd frontend && npm install
cd api-1 && npm install
cd api-2 && npm install

# Run individual services (requires SQL and Azurite running)
npm run dev    # In each service directory
```

### Testing API Endpoints
```bash
# API 1 (SQL)
curl http://localhost:3001/health
curl http://localhost:3001/ready
curl -X POST http://localhost:3001/api/init
curl http://localhost:3001/api/items
curl -X POST http://localhost:3001/api/data -H "Content-Type: application/json" -d '{"name":"test"}'

# API 2 (Storage)
curl http://localhost:3002/health
curl http://localhost:3002/ready
curl http://localhost:3002/api/files
curl -X POST http://localhost:3002/api/content -H "Content-Type: application/json" -d '{"filename":"test.txt","content":"Hello"}'
```

## Architecture Notes

### Health Checks
All services implement:
- `GET /health` - Basic liveness check (returns 200 if service is running)
- `GET /ready` - Readiness check (verifies external dependencies are available)

These are used by:
- Docker health checks in Dockerfiles
- Kubernetes liveness and readiness probes
- Frontend status indicators

### Environment Configuration
Services read configuration from environment variables with sensible defaults:
- All `.env.example` files show required variables
- Docker Compose sets all required environment variables
- Kubernetes uses ConfigMaps and Secrets (see `infra/kubernetes/configmap.yaml`)
- Azure deployment requires external Azure SQL and Storage resources

### Database Schema
API 1 creates a `SampleData` table on initialization:
- Endpoint: `POST /api/init`
- Table: `SampleData(id, name, createdAt)`
- Auto-incrementing ID and automatic timestamp

### Storage Configuration
API 2 uses Azurite locally and Azure Storage in cloud:
- Container name: `demo-container` (created automatically if missing)
- Files stored with timestamp prefix to prevent collisions
- Supports both file upload and text content upload

## Deployment Strategies

### Local Testing Priority
1. Start with Docker Compose (fastest, simplest)
2. Move to Kubernetes for orchestration testing
3. Use Azure for cloud validation

### When Modifying Services
1. Update the relevant service code (frontend/, api-1/, or api-2/)
2. For Docker Compose: `docker compose up -d --build <service-name>`
3. For Kubernetes: Rebuild image, delete pods to force recreate
4. For Azure: Rebuild and push to ACR, redeploy container group

### Common Gotchas
- SQL Server takes 10-30 seconds to fully start - wait for health check
- Minikube requires `eval $(minikube docker-env)` to use local images
- Kubernetes manifests use `imagePullPolicy: Never` for local development
- Azure deployment requires separate Azure SQL and Storage Account (not containerized)
- Port 1433, 3000-3002, 10000 must be available for Docker Compose

## Files You'll Commonly Modify

- `frontend/public/app.js` - Frontend JavaScript logic
- `frontend/public/index.html` - UI structure
- `frontend/public/styles.css` - UI styling
- `api-1/index.js` - SQL Server API endpoints (line 11-76: configuration and connection)
- `api-2/index.js` - Storage API endpoints (line 13-27: storage initialization)
- `docker compose.yml` - Local service orchestration
- `infra/kubernetes/*.yaml` - Kubernetes configuration
- Environment variables in `.env` files (create from `.env.example`)

## Troubleshooting

### Docker Compose Issues
- Check service status: `docker compose ps`
- View logs: `docker compose logs <service>`
- Restart services: `docker compose restart <service>`
- SQL connection errors: Wait for sqlserver health check to pass

### Kubernetes Issues
- Check pod status: `kubectl get pods -n three-tier-demo`
- Describe pod: `kubectl describe pod <pod-name> -n three-tier-demo`
- View events: `kubectl get events -n three-tier-demo --sort-by='.lastTimestamp'`
- Port forward for debugging: `kubectl port-forward -n three-tier-demo svc/api-1-service 3001:3001`

### Build Issues
- Clear Docker cache: `docker system prune -f`
- Rebuild without cache: `docker compose build --no-cache`
- For Kubernetes, ensure using minikube Docker: `eval $(minikube docker-env)`
