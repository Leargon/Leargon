#### USER STORY 'Create bounded context'
**AS AN** admin\
**IF** \
**I WANT** to create a bounded context by providing a name in at least one supported locale and assigning it to a business domain\
**SO THAT** an explicit service boundary is defined within the domain and entities can be assigned to it

#### USER STORY 'List bounded contexts for a domain'
**AS A** logged in user\
**IF** \
**I WANT** to see all bounded contexts belonging to a specific business domain\
**SO THAT** I get an overview of the domain's service boundaries

#### USER STORY 'View bounded context details'
**AS A** logged in user\
**IF** \
**I WANT** to see all details of a bounded context including names, descriptions, owning organisational unit, and assigned business entities\
**SO THAT** I have complete information about that bounded context

#### USER STORY 'Update bounded context names'
**AS AN** admin\
**IF** \
**I WANT** to update the names of a bounded context across all supported locales\
**SO THAT** names are correct and up-to-date in every language

#### USER STORY 'Update bounded context descriptions'
**AS AN** admin\
**IF** \
**I WANT** to update the descriptions of a bounded context across all supported locales\
**SO THAT** descriptions are correct and up-to-date in every language

#### USER STORY 'Update bounded context owning unit'
**AS AN** admin\
**IF** the organisational unit exists\
**I WANT** to assign or change the owning organisational unit of a bounded context\
**SO THAT** the team responsible for this context boundary is documented and ownership of entities within it is resolved automatically

#### USER STORY 'Assign entity to bounded context'
**AS A** data owner or admin\
**IF** the entity exists\
**I WANT** to assign a business entity to a bounded context\
**SO THAT** the entity is explicitly placed within a service boundary and its owning unit is resolved from the bounded context

#### USER STORY 'Remove entity from bounded context'
**AS A** data owner or admin\
**IF** the entity is currently assigned to the bounded context\
**I WANT** to remove a business entity from a bounded context\
**SO THAT** the entity is no longer associated with that service boundary

#### USER STORY 'Delete bounded context'
**AS AN** admin\
**IF** no entities are assigned to the bounded context\
**I WANT** to permanently delete a bounded context\
**SO THAT** obsolete or incorrectly created boundaries are removed from the domain model
