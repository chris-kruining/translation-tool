import { Context } from 'types.bicep'

targetScope = 'resourceGroup'

param context Context

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: 'acr${context.locationAbbreviation}${context.environment}${context.projectName}'
  location: context.location
  sku: {
    name: 'Basic'
  }
  properties: {}
}

output registry resource'Microsoft.ContainerRegistry/registries@2023-07-01' = registry
