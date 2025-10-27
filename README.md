# Three-Tier Containerized Demo

Containerized three-tier architecture demonstrating multi-environment deployment with Node.js, SQL Server, and Azure Storage.

This demo includes examples for running this project in the following deployment environments:
- npm run (local)
- docker compose (local)
- minikube Kubernetes (local)
- Azure Container Instances (Azure Public Cloud)

## Architecture

```ini
┌─────────────┐
│  Frontend   │ Node.js/Express (Port 3000)
└──────┬──────┘
       │
       ├─────────────┐
       │             │
┌──────▼──────┐ ┌───▼────────┐
│   API 1     │ │   API 2    │
│  (3001)     │ │  (3002)    │
└──────┬──────┘ └────┬───────┘
       │             │
┌──────▼──────┐ ┌───▼────────┐
│ SQL Server  │ │  Azurite   │
└─────────────┘ └────────────┘
```

**Components**

- Frontend: Web UI with API orchestration
- API 1: SQL Server operations (key-value CRUD)
- API 2: Blob storage operations (file upload/download)
- SQL Server: Data persistence
- Azurite: Azure Storage emulator

## Quick Start

### Docker Compose

```bash
make up              # Start all services
docker compose logs  # View logs
```

Access: http://localhost:3000

```bash
make down            # Stop services
```

### Kubernetes (Minikube)

```bash
make k8s-build       # Build images
make k8s-apply       # Deploy to cluster
make k8s-forward     # Port forward frontend
```

Access: http://localhost:3000

```bash
make k8s-delete      # Remove deployment
```

### Make Commands

```bash
make help            # List all commands
make build           # Rebuild containers
make clean           # Clean docker and kubernetes resources
```

## Project Structure

```ini
.
├── frontend/         # Web UI and proxy server
├── api-1/            # SQL Server API
├── api-2/            # Blob storage API
├── infra/
│   ├── kubernetes/   # K8s manifests
│   └── azure/        # ACI config
├── DEPLOYMENT.md
├── docker-compose.yml
├── Makefile
└── README.md
```

## API Endpoints

### API 1 (SQL)

- `GET /health` - Health check
- `GET /ready` - Readiness check
- `POST /api/init` - Initialize schema
- `POST /api/data` - Insert key-value pair
- `GET /api/items` - List all data
- `DELETE /api/data/:id` - Delete record

### API 2 (Storage)

- `GET /health` - Health check
- `GET /ready` - Readiness check
- `GET /api/files` - List files
- `POST /api/upload` - Upload file
- `POST /api/content` - Upload text
- `GET /api/files/:name` - Download file
- `DELETE /api/files/:name` - Delete file

## Environment Variables

### Frontend

- `PORT` - Server port (default: 3000)
- `API1_URL` - API 1 endpoint
- `API2_URL` - API 2 endpoint

### API 1

- `PORT` - Server port (default: 3001)
- `SQL_SERVER` - SQL Server hostname
- `SQL_USER` - Username
- `SQL_PASSWORD` - Password
- `SQL_DATABASE` - Database name

### API 2

- `PORT` - Server port (default: 3002)
- `AZURE_STORAGE_CONNECTION_STRING` - Connection string
- `AZURE_CONTAINER_NAME` - Container name

## Development

### Prerequisites

- Docker and Docker Compose
- Node.js 18+
- Minikube and kubectl (for K8s)
- Azure CLI (for cloud deployment)

### Local Development

```bash
docker compose up sqlserver azurite -d

cd api-1 && npm install && npm run dev
cd api-2 && npm install && npm run dev
cd frontend && npm install && npm run dev
```

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.
