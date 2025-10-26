targetScope = 'resourceGroup'

@description('Container group name')
param name string

@description('Azure region')
param location string = resourceGroup().location

@description('ACR name')
param acrName string

@description('SQL Server FQDN')
param sqlServer string

@description('SQL admin password')
@secure()
param sqlPassword string

@description('Storage connection string')
@secure()
param storageConnectionString string

resource acrResource 'Microsoft.ContainerRegistry/registries@2023-01-01-preview' existing = {
  name: acrName
}

var acrLoginServer = acrResource.properties.loginServer

resource containerGroup 'Microsoft.ContainerInstance/containerGroups@2023-05-01' = {
  name: name
  location: location
  properties: {
    containers: [
      {
        name: 'frontend'
        properties: {
          image: '${acrLoginServer}/frontend:latest'
          ports: [
            {
              port: 80
              protocol: 'TCP'
            }
          ]
          environmentVariables: [
            {
              name: 'PORT'
              value: '80'
            }
            {
              name: 'API1_URL'
              value: 'http://localhost:3001'
            }
            {
              name: 'API2_URL'
              value: 'http://localhost:3002'
            }
          ]
          resources: {
            requests: {
              cpu: 1
              memoryInGB: 1
            }
          }
        }
      }
      {
        name: 'api-1'
        properties: {
          image: '${acrLoginServer}/api-1:latest'
          ports: [
            {
              port: 3001
              protocol: 'TCP'
            }
          ]
          environmentVariables: [
            {
              name: 'PORT'
              value: '3001'
            }
            {
              name: 'SQL_SERVER'
              value: sqlServer
            }
            {
              name: 'SQL_USER'
              value: 'sqladmin'
            }
            {
              name: 'SQL_PASSWORD'
              secureValue: sqlPassword
            }
            {
              name: 'SQL_DATABASE'
              value: 'demoDb'
            }
          ]
          resources: {
            requests: {
              cpu: 1
              memoryInGB: 1
            }
          }
        }
      }
      {
        name: 'api-2'
        properties: {
          image: '${acrLoginServer}/api-2:latest'
          ports: [
            {
              port: 3002
              protocol: 'TCP'
            }
          ]
          environmentVariables: [
            {
              name: 'PORT'
              value: '3002'
            }
            {
              name: 'AZURE_STORAGE_CONNECTION_STRING'
              secureValue: storageConnectionString
            }
            {
              name: 'AZURE_CONTAINER_NAME'
              value: 'demo-container'
            }
          ]
          resources: {
            requests: {
              cpu: 1
              memoryInGB: 1
            }
          }
        }
      }
    ]
    osType: 'Linux'
    restartPolicy: 'Always'
    ipAddress: {
      type: 'Public'
      ports: [
        {
          port: 80
          protocol: 'TCP'
        }
      ]
      dnsNameLabel: name
    }
    imageRegistryCredentials: [
      {
        server: acrLoginServer
        username: acrResource.listCredentials().username
        password: acrResource.listCredentials().passwords[0].value
      }
    ]
  }
}

output fqdn string = containerGroup.properties.ipAddress.fqdn
output ipAddress string = containerGroup.properties.ipAddress.ip
output url string = 'http://${containerGroup.properties.ipAddress.fqdn}'
