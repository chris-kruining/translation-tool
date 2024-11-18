import { Context } from 'types.bicep'

targetScope = 'resourceGroup'

param context Context

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: 'acr${context.locationAbbreviation}${context.environment}${context.projectName}'
  location: context.location
  sku: {
    name: 'Basic'
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    adminUserEnabled: true
    dataEndpointEnabled: false
    encryption: {
      status: 'disabled'
    }
  }
}

output registry resource'Microsoft.ContainerRegistry/registries@2023-07-01' = registry
