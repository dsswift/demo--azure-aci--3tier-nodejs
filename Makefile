.PHONY: help install build up down logs clean k8s-build k8s-apply k8s-delete k8s-logs k8s-status k8s-forward azure-deploy

help:
	@echo "Available commands:"
	@echo "  make install       - Install dependencies for all services"
	@echo "  make build         - Build Docker images"
	@echo "  make up            - Start all services with Docker Compose"
	@echo "  make down          - Stop all services"
	@echo "  make logs          - View logs from all services"
	@echo "  make clean         - Remove containers, volumes, and images"
	@echo ""
	@echo "Kubernetes commands:"
	@echo "  make k8s-build    - Build images for Kubernetes (requires minikube)"
	@echo "  make k8s-apply    - Deploy to Kubernetes"
	@echo "  make k8s-forward  - Forward frontend to localhost:3000 (run in separate terminal)"
	@echo "  make k8s-delete   - Delete Kubernetes deployment"
	@echo "  make k8s-logs     - View Kubernetes logs"
	@echo "  make k8s-status   - Check status and troubleshoot"
	@echo ""
	@echo "Azure commands:"
	@echo "  make azure-deploy  - Deploy to Azure Container Instances"

# Install dependencies
install:
	@echo "Installing dependencies..."
	cd frontend && npm install
	cd api-1 && npm install
	cd api-2 && npm install

# Build Docker images
build:
	docker compose build

# Start services
up:
	docker compose up -d --build
	@echo ""
	@echo "Services started!"
	@echo "Frontend: http://localhost:3000"
	@echo "API 1: http://localhost:3001"
	@echo "API 2: http://localhost:3002"

# Stop services
down:
	docker compose down

# View logs
logs:
	docker compose logs -f

# Clean up
clean:
	@echo "Cleaning up Docker Compose resources..."
	docker compose down -v
	docker system prune -f
	@echo ""
	@echo "Checking for Kubernetes resources..."
	@CURRENT_CONTEXT=$$(kubectl config current-context 2>/dev/null || echo "none"); \
	if [ "$$CURRENT_CONTEXT" = "minikube" ]; then \
		echo "Cleaning up Kubernetes resources..."; \
		kubectl delete namespace three-tier-demo --ignore-not-found=true; \
		echo "Kubernetes cleanup complete!"; \
	else \
		echo "Not in minikube context (current: $$CURRENT_CONTEXT), skipping Kubernetes cleanup"; \
	fi
	@echo ""
	@echo "Cleanup complete!"

# Kubernetes: Build images
k8s-build:
	@echo "Building images for Kubernetes..."
	eval $$(minikube docker-env) && \
	docker build -t frontend:latest ./frontend && \
	docker build -t api-1:latest ./api-1 && \
	docker build -t api-2:latest ./api-2
	@echo "Images built successfully!"

# Kubernetes: Apply manifests
k8s-apply:
	@echo "Ensuring namespace exists..."
	kubectl apply -f infra/kubernetes/namespace.yaml
	@echo "Deploying to Kubernetes..."
	kubectl apply -f infra/kubernetes/
	@echo ""
	@echo "Waiting for pods to be ready..."
	kubectl wait --for=condition=ready pod -l app=frontend -n three-tier-demo --timeout=300s || true
	@echo ""
	@echo "Deployment complete!"
	@echo ""
	@echo "==============================================="
	@echo "To access the application:"
	@echo "  1. Run 'make k8s-forward' in a separate terminal"
	@echo "  2. Visit http://localhost:3000 in your browser"
	@echo "==============================================="

# Kubernetes: Port forward to localhost
k8s-forward:
	@echo "Forwarding frontend-service to localhost:3000"
	@echo "Press Ctrl+C to stop port forwarding"
	@echo ""
	@echo "Access the app at: http://localhost:3000"
	@echo ""
	kubectl port-forward -n three-tier-demo svc/frontend-service 3000:3000

# Kubernetes: Delete
k8s-delete:
	kubectl delete -f infra/kubernetes/

# Kubernetes: View logs
k8s-logs:
	@echo "Select a service to view logs:"
	@echo "1) Frontend"
	@echo "2) API 1"
	@echo "3) API 2"
	@echo "4) SQL Server"
	@echo "5) Azurite"
	@echo "6) Ingress Controller"
	@read -p "Enter choice [1-6]: " choice; \
	case $$choice in \
		1) kubectl logs -n three-tier-demo -l app=frontend --tail=100 -f ;; \
		2) kubectl logs -n three-tier-demo -l app=api-1 --tail=100 -f ;; \
		3) kubectl logs -n three-tier-demo -l app=api-2 --tail=100 -f ;; \
		4) kubectl logs -n three-tier-demo -l app=sqlserver --tail=100 -f ;; \
		5) kubectl logs -n three-tier-demo -l app=azurite --tail=100 -f ;; \
		6) kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller --tail=100 -f ;; \
		*) echo "Invalid choice" ;; \
	esac

# Kubernetes: Status and troubleshooting
k8s-status:
	@echo "=== Pod Status ==="
	@kubectl get pods -n three-tier-demo
	@echo ""
	@echo "=== Services ==="
	@kubectl get svc -n three-tier-demo
	@echo ""
	@echo "=== Ingress ==="
	@kubectl get ingress -n three-tier-demo
	@echo ""
	@echo "=== Ingress Controller Status ==="
	@kubectl get pods -n ingress-nginx
	@echo ""
	@echo "=== Access Instructions ==="
	@echo "Run 'make k8s-forward' in another terminal, then access:"
	@echo "  http://localhost:3000"
	@echo ""
	@echo "=== Not Ready Pods ==="
	@kubectl get pods -n three-tier-demo --field-selector=status.phase!=Running,status.phase!=Succeeded 2>/dev/null || echo "All pods are running"

# Azure: Deploy
azure-deploy:
	cd infra/azure && ./deploy.sh
