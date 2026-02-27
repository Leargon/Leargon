#### USER STORY 'Create business domain'
**AS AN** admin\
**IF** \
**I WANT** to create a business domain by providing a name in at least one supported locale\
**SO THAT** business entities and processes can be grouped under it

#### USER STORY 'List all business domains'
**AS A** logged in user\
**IF** \
**I WANT** to see a flat list of all business domains with their names in all supported locales\
**SO THAT** I get an overview of all domains

#### USER STORY 'View business domain hierarchy'
**AS A** logged in user\
**IF** \
**I WANT** to see business domains as a hierarchical tree, with parent domains and their subdomains\
**SO THAT** I can understand the domain structure at a glance

#### USER STORY 'View business domain details'
**AS A** logged in user\
**IF** \
**I WANT** to see all details of a business domain including names, descriptions, type, subdomains, assigned entities, and classification assignments\
**SO THAT** I have full information about that domain

#### USER STORY 'View localized business domain'
**AS A** logged in user\
**IF** \
**I WANT** to view a business domain's name and description in a specific locale (defaulting to my preferred language)\
**SO THAT** I can read the content in my language

#### USER STORY 'Update business domain names'
**AS AN** admin\
**IF** \
**I WANT** to update the names of a business domain across all supported locales\
**SO THAT** names are correct and up-to-date in every language

#### USER STORY 'Update business domain descriptions'
**AS AN** admin\
**IF** \
**I WANT** to update the descriptions of a business domain across all supported locales\
**SO THAT** descriptions are correct and up-to-date in every language

#### USER STORY 'Update business domain type'
**AS AN** admin\
**IF** \
**I WANT** to set the domain type to one of: BUSINESS, CORE, SUPPORT, or GENERIC\
**SO THAT** the strategic role of the domain is clearly specified

#### USER STORY 'Update business domain parent'
**AS AN** admin\
**IF** the chosen parent would not create a cycle in the hierarchy\
**I WANT** to move a business domain under a different parent domain, or make it a top-level domain\
**SO THAT** the domain hierarchy reflects the current organisation of the business

#### USER STORY 'Assign classifications to business domain'
**AS AN** admin\
**IF** the classification is configured as assignable to BUSINESS_DOMAIN and only one value per classification is selected\
**I WANT** to assign classification values to a business domain, replacing all existing assignments\
**SO THAT** the domain is labelled according to the configured classification taxonomies

#### USER STORY 'Delete business domain'
**AS AN** admin\
**IF** \
**I WANT** to delete a business domain, whereby its child domains become top-level domains and its assigned entities are unassigned\
**SO THAT** unused or obsolete domains are removed from the system

#### USER STORY 'View business domain version history'
**AS A** logged in user\
**IF** \
**I WANT** to see a chronological list of all versions of a business domain, including timestamp and author of each change\
**SO THAT** I can track how the domain has evolved over time

#### USER STORY 'View diff between business domain versions'
**AS A** logged in user\
**IF** at least two versions of the business domain exist\
**I WANT** to see the diff between a specific version and its preceding version, highlighting which fields changed and how\
**SO THAT** I can understand exactly what was changed and by whom at any given point
