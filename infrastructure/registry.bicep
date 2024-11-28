import { Context } from 'br/Tricep:types:latest'
import { with_managed_identity } from 'br/Tricep:common/identity:latest'
import { container_registry } from 'br/Tricep:recommended/container-registry/container-registry:latest'

targetScope = 'resourceGroup'

param context Context

var registryConfig = container_registry(context, [
  with_managed_identity()
  {
    properties: {
      adminUserEnabled: true
      dataEndpointEnabled: false
      encryption: {
        status: 'disabled'
      }
    }
  }
])

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: registryConfig.name
  location: registryConfig.location
  sku: registryConfig.sku
  identity: registryConfig.identity
  properties: registryConfig.properties
}
