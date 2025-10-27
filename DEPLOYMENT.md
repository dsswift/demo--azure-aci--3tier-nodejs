# Deployment Guide

## Docker Compose

```bash
docker compose up -d
docker compose logs -f
```

**Access**

- Frontend: http://localhost:3000
- API 1: http://localhost:3001
- API 2: http://localhost:3002
- SQL Server: localhost:1433
- Azurite: localhost:10000

**Cleanup**

```bash
docker compose down
docker compose down -v  # Remove volumes
```

## Kubernetes (Minikube)

### Prerequisites

- Docker
- Minikube
- kubectl

### Deploy

```bash
minikube start --memory=4096 --cpus=2
kubectl config use-context minikube
eval $(minikube docker-env)

make k8s-build
make k8s-apply
make k8s-forward
```

Access: http://localhost:3000

### Cleanup

```bash
make k8s-delete # or kubectl delete namespace three-tier-demo
```

## Azure Container Instances

### Automated deployment

This script will deploy the Azure infrastructure, build the container images, push the images to the Azure Container Registry, and then deploy them to them to an Azure Container Instance.

```bash
cd infra/azure
./deploy-all.sh 'YourStrong@Passw0rd' centralus 3tierdemo
```

**Parameters:**

- SQL password (required)
- Region (optional, default: centralus)
- Prefix (optional, default: 3tierdemo)

Outputs Azure-managed URL like: `http://3tierdemo-abc123.centralus.azurecontainer.io`

See [infra/azure/README.md](infra/azure/README.md) for details.

## Environment Variables

### Frontend

- `PORT` - Server port (default: 3000)
- `API1_URL` - API 1 endpoint
- `API2_URL` - API 2 endpoint

### API 1

- `PORT` - Server port (default: 3001)
- `SQL_USER` - Username
- `SQL_PASSWORD` - Password
- `SQL_SERVER` - Hostname
- `SQL_DATABASE` - Database name

### API 2

- `PORT` - Server port (default: 3002)
- `AZURE_STORAGE_CONNECTION_STRING` - Connection string
- `AZURE_CONTAINER_NAME` - Container name
