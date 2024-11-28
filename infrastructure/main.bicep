import { create_context } from 'br/Tricep:common/context:latest'
import { resource_group } from 'br/Tricep:recommended/resources/resource-group:latest'

targetScope = 'subscription'

param location string
param environment string
param projectName string
param version string
@secure()
param registryUrl string
param deployedAt string = utcNow('yyyyMMdd')

var context = create_context({
  project: projectName
  nameConventionTemplate: '$type-$environment-$location-$project'
  location: location
  environment: environment
  deployedAt: deployedAt
  tenant: tenant()
  tags: {}
})

var resourceGroupConfig = resource_group(context, [])

resource calqueResourceGroup 'Microsoft.Resources/resourceGroups@2024-07-01' = {
  name: resourceGroupConfig.name
  location: resourceGroupConfig.location
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
    version: version
    registryUrl: registryUrl
  }
}
