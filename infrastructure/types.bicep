@export()
type Context = {
  @minLength(2)
  locationAbbreviation: string
  @minLength(2)
  location: string
  @minLength(3)
  environment: string
  @minLength(2)
  projectName: string
  deployedAt: string
}
