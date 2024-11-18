import { Context } from 'types.bicep'

targetScope = 'resourceGroup'

param context Context
param version string
@secure()
param registryUrl string

var appName = 'app'

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: 'cea-${context.locationAbbreviation}-${context.environment}-${context.projectName}'
  location: context.location
  properties: {
    appLogsConfiguration: {
      destination: 'azure-monitor'
    }
    peerAuthentication: {
      mtls: {
        enabled: false
      }
    }
    peerTrafficConfiguration: {
      encryption: {
        enabled: false
      }
    }
  }
}

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'ca-${context.locationAbbreviation}-${context.environment}-${context.projectName}-app'
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
        targetPort: 3000
        transport: 'auto'
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
          server: registryUrl
        }
      ]
    }

    template: {
      containers: [
        {
          image: '${registryUrl}/${context.projectName}-${appName}:${version}'
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
