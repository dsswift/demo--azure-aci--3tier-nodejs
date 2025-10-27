# Azure Deployment

## Full Demo Quick Deploy (Automated)

This script will deploy the Azure infrastructure, build the container images, push the images to the
Azure Container Registry, and then deploy them to them to an Azure Container Instance.

```bash {"terminalRows":"29"}
cd infra/azure
./deploy-all.sh 'YourStrong@Passw0rd' centralus 3tierdemo
```

**Parameters:**

- `sql-password` (required) - SQL admin password
- `location` (optional) - Azure region (default: centralus)
- `prefix` (optional) - Resource name prefix (default: 3tierdemo)

This deploys infrastructure, builds images, pushes to ACR, and deploys containers.

**Output:** Application URL (Azure-managed DNS, no configuration needed)

Example: `http://3tierdemo-abc123def456.centralus.azurecontainer.io`

## Manual Deployment

### 1. Deploy Infrastructure

```bash
PREFIX=3tierdemo

az deployment sub create \
  --name $PREFIX \
  --location centralus \
  --template-file infra/azure/main.bicep \
  --parameters sqlPassword='YourStrong@Passw0rd' prefix=$PREFIX
```

### 2. Build and Push Images

```bash
PREFIX=3tierdemo

ACR_NAME=$(az deployment sub show --name $PREFIX --query properties.outputs.acrName.value -o tsv)
az acr login --name $ACR_NAME
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --query loginServer -o tsv)

docker build --platform linux/amd64 -t $ACR_LOGIN_SERVER/frontend:latest ./frontend
docker build --platform linux/amd64 -t $ACR_LOGIN_SERVER/api-1:latest ./api-1
docker build --platform linux/amd64 -t $ACR_LOGIN_SERVER/api-2:latest ./api-2
docker push $ACR_LOGIN_SERVER/frontend:latest
docker push $ACR_LOGIN_SERVER/api-1:latest
docker push $ACR_LOGIN_SERVER/api-2:latest
```

### 3. Deploy Containers

```bash
PREFIX=3tierdemo

RG_NAME=$(az deployment sub show --name $PREFIX --query properties.outputs.resourceGroupName.value -o tsv)
SQL_SERVER=$(az deployment sub show --name $PREFIX --query properties.outputs.sqlServerFqdn.value -o tsv)
STORAGE_CONN=$(az deployment sub show --name $PREFIX --query properties.outputs.storageConnectionString.value -o tsv)
CONTAINER_NAME=$(az deployment sub show --name $PREFIX --query properties.outputs.containerGroupName.value -o tsv)
az deployment group create \
  --resource-group $RG_NAME \
  --template-file infra/azure/aci.bicep \
  --parameters \
    name=$CONTAINER_NAME \
    acrName=$ACR_NAME \
    sqlServer=$SQL_SERVER \
    sqlPassword='YourStrong@Passw0rd' \
    storageConnectionString="$STORAGE_CONN"
```

### 4. Get Application URL

```bash
PREFIX=3tierdemo

RG_NAME=$(az deployment sub show --name $PREFIX --query properties.outputs.resourceGroupName.value -o tsv)
az deployment group show \
  --resource-group $RG_NAME \
  --name aci \
  --query properties.outputs.url.value -o tsv
```

## Backend Infrastructure Only (No Applications)

You can deploy the infrastructure (ACR, Sql, Storage) without the container applications using the deploy button:

[![Deploy to Azure](https://aka.ms/deploytoazurebutton)](https://portal.azure.com/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2Fdsswift%2Fdemo--azure-aci--3tier-nodejs%2Fmain%2Finfra%2Fazure%2Fmain.json)
