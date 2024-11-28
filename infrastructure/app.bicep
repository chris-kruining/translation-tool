import { Context } from 'br/Tricep:types:latest'
import { with_name } from 'br/Tricep:common/context:latest'
import { container_app_environment, container_app, container, with_app_logs, with_auto_scaling, with_environment } from 'br/Tricep:recommended/app/container-app:latest'

targetScope = 'resourceGroup'

param context Context
param version string
@secure()
param registryUrl string
param customerId string
param sharedKey string

var appName = 'app'

var environmentConfig = container_app_environment(with_name(context, 'app'), [
  with_app_logs(customerId, sharedKey)
  {
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
])
var appConfig = container_app(
  with_name(context, 'app'),
  [
    container('${context.project}-${appName}', '${registryUrl}/${context.project}-${appName}:${version}')
  ],
  [
    with_environment(environment.id)
    with_auto_scaling(0, 1, {
      ruleName: {
        concurrentRequests: '10'
      }
    })
    {
      properties: {
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
      }
    }
  ]
)

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: environmentConfig.name
  location: environmentConfig.location
  properties: environmentConfig.properties
}

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: appConfig.name
  location: appConfig.location
  identity: appConfig.identity
  properties: appConfig.properties
}
