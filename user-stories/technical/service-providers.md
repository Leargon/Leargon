#### USER STORY 'Create service provider'
**AS AN** admin\
**IF** \
**I WANT** to create a service provider by providing a name in at least one supported locale, its type, and optionally processing countries\
**SO THAT** the provider is registered and can be linked to processes as a data processor or subcontractor

#### USER STORY 'List service providers'
**AS A** logged in user\
**IF** \
**I WANT** to see a list of all service providers with their names, types, and DPA status\
**SO THAT** I get an overview of all external processors and service providers

#### USER STORY 'View service provider details'
**AS A** logged in user\
**IF** \
**I WANT** to see all details of a service provider including names, type, processing countries, DPA status, sub-processors approved status, and linked processes\
**SO THAT** I have complete information about that provider

#### USER STORY 'Update service provider names'
**AS AN** admin\
**IF** \
**I WANT** to update the names of a service provider across all supported locales\
**SO THAT** names are correct and up-to-date in every language

#### USER STORY 'Update service provider type'
**AS AN** admin\
**IF** \
**I WANT** to set the type of a service provider\
**SO THAT** the role of the provider is clearly specified

#### USER STORY 'Update service provider DPA status'
**AS AN** admin\
**IF** \
**I WANT** to update whether a Data Processing Agreement is in place with this service provider\
**SO THAT** the contractual compliance status under GDPR Art. 28 / DSG Art. 9 is documented

#### USER STORY 'Update service provider sub-processors approved status'
**AS AN** admin\
**IF** \
**I WANT** to update whether the use of sub-processors by this provider has been approved\
**SO THAT** the sub-processor chain approval status is documented

#### USER STORY 'Update service provider processing countries'
**AS AN** admin\
**IF** \
**I WANT** to update the list of countries where this provider processes data\
**SO THAT** cross-border transfer obligations can be assessed

#### USER STORY 'Link service provider to process'
**AS A** process owner or admin\
**IF** the service provider exists\
**I WANT** to link a service provider to a business process\
**SO THAT** it is documented which external provider processes data on behalf of this process

#### USER STORY 'Unlink service provider from process'
**AS A** process owner or admin\
**IF** the service provider is currently linked to the process\
**I WANT** to remove the link between a service provider and a business process\
**SO THAT** the relationship is removed when no longer accurate

#### USER STORY 'Delete service provider'
**AS AN** admin\
**IF** \
**I WANT** to permanently delete a service provider\
**SO THAT** dissolved or incorrectly created providers are removed from the inventory
