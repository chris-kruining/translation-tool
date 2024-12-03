import {
  container
  resources_xxs
} from 'br/Tricep:recommended/app/container-app:latest'

targetScope = 'resourceGroup'

var container1 = container({
  name: 'name'
  image: 'registry/project-app:latest'
  resources: resources_xxs
})
