#!/bin/bash
set -e

echo "=== Azure Three-Tier Demo Application Deployment ==="
echo ""

# Check required parameters
if [ -z "$1" ]; then
  echo "Usage: ./deploy-all.sh <sql-password> [location] [prefix]"
  echo "Example: ./deploy-all.sh 'YourStrong@Passw0rd' centralus 3tierdemo"
  exit 1
fi

SQL_PASSWORD="$1"
LOCATION="${2:-centralus}"
PREFIX="${3:-3tierdemo}"
DEPLOYMENT_NAME="$PREFIX"

echo "Step 1: Deploying infrastructure (ACR, SQL, Storage)..."
az deployment sub create \
  --name "$DEPLOYMENT_NAME" \
  --location "$LOCATION" \
  --template-file main.bicep \
  --parameters sqlPassword="$SQL_PASSWORD" location="$LOCATION" prefix="$PREFIX"

echo ""
echo "Step 2: Getting deployment outputs..."
RG_NAME=$(az deployment sub show --name "$DEPLOYMENT_NAME" --query properties.outputs.resourceGroupName.value -o tsv)
ACR_NAME=$(az deployment sub show --name "$DEPLOYMENT_NAME" --query properties.outputs.acrName.value -o tsv)
ACR_LOGIN_SERVER=$(az deployment sub show --name "$DEPLOYMENT_NAME" --query properties.outputs.acrLoginServer.value -o tsv)
SQL_SERVER=$(az deployment sub show --name "$DEPLOYMENT_NAME" --query properties.outputs.sqlServerFqdn.value -o tsv)
STORAGE_CONN=$(az deployment sub show --name "$DEPLOYMENT_NAME" --query properties.outputs.storageConnectionString.value -o tsv)
CONTAINER_NAME=$(az deployment sub show --name "$DEPLOYMENT_NAME" --query properties.outputs.containerGroupName.value -o tsv)

echo "Resource Group: $RG_NAME"
echo "ACR: $ACR_NAME"
echo ""

echo "Step 3: Building and pushing container images..."
az acr login --name "$ACR_NAME"

cd ../../

docker build --platform linux/amd64 -t "$ACR_LOGIN_SERVER/frontend:latest" ./frontend
docker build --platform linux/amd64 -t "$ACR_LOGIN_SERVER/api-1:latest" ./api-1
docker build --platform linux/amd64 -t "$ACR_LOGIN_SERVER/api-2:latest" ./api-2

docker push "$ACR_LOGIN_SERVER/frontend:latest"
docker push "$ACR_LOGIN_SERVER/api-1:latest"
docker push "$ACR_LOGIN_SERVER/api-2:latest"

cd infra/azure

echo ""
echo "Step 4: Deploying containers to ACI..."
az deployment group create \
  --resource-group "$RG_NAME" \
  --template-file aci.bicep \
  --parameters \
    name="$CONTAINER_NAME" \
    acrName="$ACR_NAME" \
    sqlServer="$SQL_SERVER" \
    sqlPassword="$SQL_PASSWORD" \
    storageConnectionString="$STORAGE_CONN"

echo ""
echo "=== Deployment Complete ==="
FRONTEND_URL=$(az deployment group show \
  --resource-group "$RG_NAME" \
  --name aci \
  --query properties.outputs.url.value -o tsv)

echo ""
echo "Application URL: $FRONTEND_URL"
echo "Resource Group: $RG_NAME"
echo ""
echo "To delete: az group delete --name $RG_NAME --yes"
