import { Context } from 'br/Tricep:types:latest'
import { with_managed_identity } from 'br/Tricep:common/identity:latest'
import { log_analytics } from 'br/Tricep:recommended/operational-insights/log-analytics:latest'

targetScope = 'resourceGroup'

param context Context

var logAnalyticsConfig = log_analytics(context, [
  with_managed_identity()
])

resource monitoring 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsConfig.name
  location: logAnalyticsConfig.location
  properties: logAnalyticsConfig.properties
}
