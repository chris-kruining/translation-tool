import { Context } from 'types.bicep'

targetScope = 'subscription'

param locationAbbreviation string
param location string
param environment string
param projectName string
param deployedAt string = utcNow('yyyyMMdd')

var context = {
  locationAbbreviation: locationAbbreviation
  location: location
  environment: environment
  projectName: projectName
  deployedAt: deployedAt
}

resource calqueResourceGroup 'Microsoft.Resources/resourceGroups@2024-07-01' = {
  name: 'rg-${locationAbbreviation}-${environment}-${projectName}'
  location: location
}

module monitoring 'monitoring.bicep' = {
  name: 'monitoring'
  scope: calqueResourceGroup
  params: {
    context: context
  }
}

module registry 'registry.bicep' = {
  name: 'registry'
  scope: calqueResourceGroup
  params: {
    context: context
  }
}

module app 'app.bicep' = {
  name: 'app'
  scope: calqueResourceGroup
  params: {
    context: context
    registry: registry.outputs.registry
  }
}
