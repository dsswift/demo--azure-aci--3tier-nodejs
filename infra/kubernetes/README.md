# Kubernetes Deployment

This directory contains Kubernetes manifests for deploying the three-tier application to **minikube only**.

**IMPORTANT**: This configuration is intended for local testing with minikube. The Makefile commands (`make k8s-build` and `make k8s-deploy`) include built-in safety checks to prevent accidental deployment to production clusters. For production deployments, IT Admins should create their own deployment scripts and configurations.

## Architecture

The deployment consists of:

- **Namespace**: `three-tier-demo` - Isolated namespace for all resources
- **ConfigMap & Secrets**: Configuration and sensitive data
- **Persistent Volume Claims**: Storage for SQL Server and Azurite
- **Deployments**:
   - Frontend (2 replicas)
   - API 1 (2 replicas)
   - API 2 (2 replicas)
   - SQL Server (1 replica)
   - Azurite Storage Emulator (1 replica)

- **Services**: ClusterIP services for internal communication, NodePort for frontend access

## Files

- `namespace.yaml` - Namespace definition
- `configmap.yaml` - Configuration and secrets
- `sqlserver.yaml` - SQL Server deployment, PVC, and service
- `azurite.yaml` - Azurite storage emulator deployment, PVC, and service
- `api-1.yaml` - API 1 deployment and service
- `api-2.yaml` - API 2 deployment and service
- `frontend.yaml` - Frontend deployment and NodePort service

## Quick Start

```bash
# Start minikube
minikube start

# Build images
eval $(minikube docker-env)
docker build -t frontend:latest ./frontend
docker build -t api-1:latest ./api-1
docker build -t api-2:latest ./api-2

# Deploy
kubectl apply -f infra/kubernetes/

# Access frontend
minikube service frontend-service -n three-tier-demo
```

## Resource Requirements

Ensure your Kubernetes cluster has sufficient resources:

```bash
# For minikube, start with adequate resources
minikube start --memory=4096 --cpus=2
```

## Deployment Order

While `kubectl apply -f infra/kubernetes/` handles dependencies, the logical order is:

1. Namespace
2. ConfigMap and Secrets
3. SQL Server (with PVC)
4. Azurite (with PVC)
5. API 1 (depends on SQL Server)
6. API 2 (depends on Azurite)
7. Frontend (depends on both APIs)

## Health Checks

All application containers have:

- **Liveness probes**: Restarts unhealthy containers
- **Readiness probes**: Controls traffic routing to healthy pods

SQL Server has custom exec probes that verify database connectivity.

## Scaling

Scale deployments as needed:

```bash
# Scale frontend
kubectl scale deployment frontend -n three-tier-demo --replicas=3

# Scale APIs
kubectl scale deployment api-1 -n three-tier-demo --replicas=3
kubectl scale deployment api-2 -n three-tier-demo --replicas=3
```

Note: SQL Server and Azurite should remain at 1 replica in this configuration.

## Networking

- **Internal communication**: Services use ClusterIP and communicate via service names
   - `sqlserver-service:1433`
   - `azurite-service:10000`
   - `api-1-service:3001`
   - `api-2-service:3002`

- **External access**: Frontend exposed via NodePort (30000)

## Storage

Persistent volumes are used for:

- SQL Server data (`/var/opt/mssql`)
- Azurite data (`/data`)

Data persists across pod restarts but is lost if PVCs are deleted.

## Monitoring

```bash
# Watch pods
kubectl get pods -n three-tier-demo -w

# Describe a pod
kubectl describe pod <pod-name> -n three-tier-demo

# View logs
kubectl logs -n three-tier-demo <pod-name>

# Follow logs
kubectl logs -n three-tier-demo <pod-name> -f

# Logs from all replicas of a deployment
kubectl logs -n three-tier-demo -l app=frontend --tail=100
```

## Debugging

```bash
# Get shell in a pod
kubectl exec -it <pod-name> -n three-tier-demo -- sh

# Port forward to a service
kubectl port-forward -n three-tier-demo svc/api-1-service 3001:3001

# Check service endpoints
kubectl get endpoints -n three-tier-demo

# View events
kubectl get events -n three-tier-demo --sort-by='.lastTimestamp'
```
