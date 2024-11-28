import { Context } from 'br/Tricep:types:latest'
import { with_name } from 'br/Tricep:common/context:latest'
import { with_managed_identity } from 'br/Tricep:common/identity:latest'
import {
  container_app_environment
  container_app
  container
  with_public_access
  with_app_logs
  with_auto_scaling
  with_environment
} from 'br/Tricep:recommended/app/container-app:latest'

targetScope = 'resourceGroup'

param context Context
param version string
@secure()
param registryUrl string

var appName = 'app'

var environmentConfig = container_app_environment(with_name(context, appName), [])
var appConfig = container_app(
  context,
  [
    container({
      name: '${context.project}-${appName}'
      image: '${registryUrl}/${context.project}-${appName}:${version}'
    })
  ],
  [
    with_managed_identity()
    with_environment(environment.id)
    with_auto_scaling(0, 1, {
      ruleName: {
        concurrentRequests: '10'
      }
    })
    with_public_access({
      port: 3000
      cors: {
        allowedOrigins: [
          // 'https://localhost:3000'
          '*'
        ]
        allowCredentials: true
        allowedHeaders: ['*']
        allowedMethods: ['Get, POST']
        maxAge: 0
      }
    })
    {
      properties: {
        configuration: {
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
  tags: environmentConfig.tags
  properties: environmentConfig.properties
}

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: appConfig.name
  location: appConfig.location
  tags: appConfig.tags
  identity: appConfig.identity
  properties: appConfig.properties
}
