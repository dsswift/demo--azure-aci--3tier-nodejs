targetScope = 'subscription'

@description('Azure region for resources')
param location string = 'centralus'

@description('SQL Server admin password')
@secure()
param sqlPassword string

@description('Deployment prefix for resource naming')
param prefix string = '3tierdemo'

var uniqueSuffix = uniqueString(subscription().subscriptionId, prefix)
var resourceGroupName = '${prefix}-${uniqueSuffix}'
var acrName = 'acr${uniqueSuffix}'
var sqlServerName = 'sql${uniqueSuffix}'
var storageName = 'stor${uniqueSuffix}'
var containerGroupName = '${prefix}-${uniqueSuffix}'

resource rg 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: resourceGroupName
  location: location
}

module acr 'modules/acr.bicep' = {
  scope: rg
  name: 'acr-deployment'
  params: {
    name: acrName
    location: location
  }
}

module sql 'modules/sql.bicep' = {
  scope: rg
  name: 'sql-deployment'
  params: {
    serverName: sqlServerName
    location: location
    adminPassword: sqlPassword
  }
}

module storage 'modules/storage.bicep' = {
  scope: rg
  name: 'storage-deployment'
  params: {
    name: storageName
    location: location
  }
}

output resourceGroupName string = rg.name
output acrName string = acrName
output acrLoginServer string = acr.outputs.loginServer
output sqlServerFqdn string = sql.outputs.fqdn
output sqlDatabase string = 'demoDb'
output storageAccountName string = storage.outputs.name
output storageConnectionString string = storage.outputs.connectionString
output containerGroupName string = containerGroupName
