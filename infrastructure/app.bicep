import { Context } from 'types.bicep'

targetScope = 'resourceGroup'

param context Context
param registry resource'Microsoft.ContainerRegistry/registries@2023-07-01'

var appName = 'app'
var version = 'latest'

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: 'acr-${context.locationAbbreviation}-${context.environment}-${context.projectName}'
  location: context.location
  properties: {
    appLogsConfiguration: {
      destination: 'azure-monitor'
    }
  }
}

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'acr-${context.locationAbbreviation}-${context.environment}-${context.projectName}-app'
  location: context.location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    environmentId: environment.id

    configuration: {
      activeRevisionsMode: 'Single'

      ingress: {
        external: true
        targetPort: 8080
        transport: 'http2'
        allowInsecure: false
        traffic: [
          {
            weight: 100
            latestRevision: true
          }
        ]
        corsPolicy: {
          allowedOrigins: [
            // 'https://localhost:3000'
            '*'
          ]
          allowCredentials: true
          allowedHeaders: ['*']
          allowedMethods: ['Get, POST']
          maxAge: 0
        }
      }
      registries: [
        {
          identity: 'system'
          server: registry.properties.loginServer
        }
      ]
    }

    template: {
      containers: [
        {
          image: '${registry.properties.loginServer}/${context.projectName}-${appName}:${version}'
          name: '${context.projectName}-${appName}'
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 2
        rules: [
          {
            name: 'http-rule'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}
