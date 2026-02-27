#### USER STORY 'Create business entity'
**AS A** logged in user\
**IF** \
**I WANT** to create a new business entity by providing a name in at least one supported locale\
**SO THAT** the entity is registered in the data landscape, with me as the initial data owner

#### USER STORY 'List all business entities'
**AS A** logged in user\
**IF** \
**I WANT** to see a flat list of all business entities with their names in all supported locales\
**SO THAT** I get an overview of all data objects in the organisation

#### USER STORY 'View business entity hierarchy'
**AS A** logged in user\
**IF** \
**I WANT** to see business entities as a hierarchical tree showing parent entities and their children\
**SO THAT** I can understand how data objects are structured and nested

#### USER STORY 'View business entity details'
**AS A** logged in user\
**IF** \
**I WANT** to see all details of a business entity including names, descriptions, data owner, parent, children, business domain, interface entities, relationships, and classification assignments\
**SO THAT** I have complete information about that data object

#### USER STORY 'View localized business entity'
**AS A** logged in user\
**IF** \
**I WANT** to view a business entity's name and description in a specific locale (defaulting to my preferred language)\
**SO THAT** I can read the content in my language

#### USER STORY 'Update business entity names'
**AS A** data owner or admin\
**IF** \
**I WANT** to update the names of a business entity across all supported locales\
**SO THAT** names are correct and up-to-date in every language

#### USER STORY 'Update business entity descriptions'
**AS A** data owner or admin\
**IF** \
**I WANT** to update the descriptions of a business entity across all supported locales\
**SO THAT** descriptions are correct and up-to-date in every language

#### USER STORY 'Update business entity data owner'
**AS A** data owner or admin\
**IF** the new owner is a registered and active user\
**I WANT** to transfer data ownership of a business entity to another user\
**SO THAT** the correct person is responsible for maintaining the entity

#### USER STORY 'Update business entity parent'
**AS A** data owner or admin\
**IF** the chosen parent would not create a cycle in the hierarchy\
**I WANT** to move a business entity under a different parent entity, or make it a root-level entity\
**SO THAT** the entity hierarchy accurately reflects how data objects relate structurally

#### USER STORY 'Assign business domain to business entity'
**AS A** data owner or admin\
**IF** \
**I WANT** to assign a business domain to a business entity, or remove the current domain assignment\
**SO THAT** the entity is correctly grouped within a domain

#### USER STORY 'Update business entity interfaces'
**AS A** data owner or admin\
**IF** \
**I WANT** to set which other business entities this entity implements as interfaces, replacing the existing list\
**SO THAT** the implementation relationship between entities is recorded

#### USER STORY 'Create entity relationship'
**AS A** data owner or admin\
**IF** the related entity exists\
**I WANT** to create a typed relationship from this business entity to another, specifying cardinalities and an optional description\
**SO THAT** the structural connections between data objects are documented

#### USER STORY 'Update entity relationship'
**AS A** data owner or admin\
**IF** the relationship exists\
**I WANT** to update the cardinalities and description of an existing relationship between two entities\
**SO THAT** the relationship accurately reflects the current model

#### USER STORY 'Delete entity relationship'
**AS A** data owner or admin\
**IF** the relationship exists\
**I WANT** to delete a relationship between two entities\
**SO THAT** obsolete or incorrect connections are removed

#### USER STORY 'Assign classifications to business entity'
**AS A** data owner or admin\
**IF** the classification is configured as assignable to BUSINESS_ENTITY and only one value per classification is selected\
**I WANT** to assign classification values to a business entity, replacing all existing assignments\
**SO THAT** the entity is labelled according to the configured classification taxonomies

#### USER STORY 'Delete business entity'
**AS A** data owner or admin\
**IF** \
**I WANT** to permanently delete a business entity\
**SO THAT** obsolete or incorrectly created data objects are removed from the system

#### USER STORY 'View business entity version history'
**AS A** logged in user\
**IF** \
**I WANT** to see a chronological list of all versions of a business entity, including timestamp and author of each change\
**SO THAT** I can track how the entity has evolved over time

#### USER STORY 'View diff between business entity versions'
**AS A** logged in user\
**IF** at least two versions of the business entity exist\
**I WANT** to see the diff between a specific version and its preceding version, highlighting which fields changed and how\
**SO THAT** I can understand exactly what was changed and by whom at any given point
