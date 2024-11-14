import { Context } from 'types.bicep'

targetScope = 'resourceGroup'

param context Context

// resource monitoring 'Microsoft.___/___@___' = {
//   name: 'acr-${context.locationAbbreviation}-${context.environment}-${context.projectName}'
//   location: context.location
//   properties: {}
// }
