#### USER STORY 'Create capability'
**AS AN** admin\
**IF** \
**I WANT** to create a business capability by providing a name in at least one supported locale\
**SO THAT** the capability is registered in the capability map and can be linked to processes and organisational units

#### USER STORY 'List capabilities'
**AS A** logged in user\
**IF** \
**I WANT** to see a flat list of all capabilities with their names in all supported locales\
**SO THAT** I get an overview of all documented capabilities

#### USER STORY 'View capability hierarchy'
**AS A** logged in user\
**IF** \
**I WANT** to see capabilities as a hierarchical tree showing parent capabilities and their sub-capabilities\
**SO THAT** I can understand how capabilities are structured and decomposed

#### USER STORY 'View capability details'
**AS A** logged in user\
**IF** \
**I WANT** to see all details of a capability including names, descriptions, owning organisational unit, parent capability, child capabilities, linked processes, and classification assignments\
**SO THAT** I have complete information about that capability

#### USER STORY 'Update capability names'
**AS AN** admin\
**IF** \
**I WANT** to update the names of a capability across all supported locales\
**SO THAT** names are correct and up-to-date in every language

#### USER STORY 'Update capability descriptions'
**AS AN** admin\
**IF** \
**I WANT** to update the descriptions of a capability across all supported locales\
**SO THAT** descriptions are correct and up-to-date in every language

#### USER STORY 'Update capability parent'
**AS AN** admin\
**IF** the chosen parent would not create a cycle in the hierarchy\
**I WANT** to move a capability under a different parent capability, or make it a root-level capability\
**SO THAT** the capability hierarchy accurately reflects the decomposition structure

#### USER STORY 'Update capability owning unit'
**AS AN** admin\
**IF** the organisational unit exists\
**I WANT** to assign or change the owning organisational unit of a capability\
**SO THAT** the team accountable for this capability is documented

#### USER STORY 'Link capability to process'
**AS AN** admin\
**IF** the process exists\
**I WANT** to link a capability to a business process\
**SO THAT** it is documented which processes realise this capability

#### USER STORY 'Unlink capability from process'
**AS AN** admin\
**IF** the process is currently linked to the capability\
**I WANT** to remove the link between a capability and a business process\
**SO THAT** the relationship is removed when no longer accurate

#### USER STORY 'Assign classifications to capability'
**AS AN** admin\
**IF** the classification is configured as assignable to BUSINESS_DOMAIN and only one value per classification is selected\
**I WANT** to assign classification values to a capability, replacing all existing assignments\
**SO THAT** the capability is labelled according to the configured classification taxonomies

#### USER STORY 'View capability map diagram'
**AS A** logged in user\
**IF** \
**I WANT** to view a visual capability map showing all capabilities arranged in a grid or tree, optionally coloured by classification value (e.g. strategic importance or maturity)\
**SO THAT** I can assess the capability landscape at a glance

#### USER STORY 'Delete capability'
**AS AN** admin\
**IF** \
**I WANT** to permanently delete a capability\
**SO THAT** obsolete or incorrectly created capabilities are removed from the map
