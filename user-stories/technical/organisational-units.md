#### USER STORY 'Create organisational unit'
**AS AN** admin\
**IF** \
**I WANT** to create a new organisational unit by providing a name in at least one supported locale\
**SO THAT** the unit is registered in the organisational structure and can be assigned a lead and linked to processes

#### USER STORY 'List all organisational units'
**AS A** logged in user\
**IF** \
**I WANT** to see a flat list of all organisational units with their names in all supported locales\
**SO THAT** I get an overview of all units in the organisation

#### USER STORY 'View organisational unit hierarchy'
**AS A** logged in user\
**IF** \
**I WANT** to see organisational units as a hierarchical tree showing parent units and their subunits\
**SO THAT** I can understand the reporting and containment structure

#### USER STORY 'View organisational unit details'
**AS A** logged in user\
**IF** \
**I WANT** to see all details of an organisational unit including names, descriptions, type, lead user, parent units, child units, and classification assignments\
**SO THAT** I have complete information about that unit

#### USER STORY 'Update organisational unit names'
**AS AN** organisational unit lead or admin\
**IF** \
**I WANT** to update the names of an organisational unit across all supported locales\
**SO THAT** names are correct and up-to-date in every language

#### USER STORY 'Update organisational unit descriptions'
**AS AN** organisational unit lead or admin\
**IF** \
**I WANT** to update the descriptions of an organisational unit across all supported locales\
**SO THAT** descriptions are correct and up-to-date in every language

#### USER STORY 'Update organisational unit type'
**AS AN** admin\
**IF** \
**I WANT** to set the type of an organisational unit (e.g. department, team, division)\
**SO THAT** the nature and level of the unit within the organisation is clearly specified

#### USER STORY 'Update organisational unit lead'
**AS AN** admin\
**IF** the new lead is a registered and active user\
**I WANT** to assign a different user as the lead of an organisational unit\
**SO THAT** the correct person is accountable for that unit

#### USER STORY 'Update organisational unit parents'
**AS AN** admin\
**IF** \
**I WANT** to assign one or more parent units to an organisational unit, replacing the existing parent list\
**SO THAT** cross-unit teams and matrix structures can be represented by allowing multiple parents

#### USER STORY 'Assign classifications to organisational unit'
**AS AN** organisational unit lead or admin\
**IF** the classification is configured as assignable to ORGANISATIONAL_UNIT and only one value per classification is selected\
**I WANT** to assign classification values to an organisational unit, replacing all existing assignments\
**SO THAT** the unit is labelled according to the configured classification taxonomies

#### USER STORY 'Delete organisational unit'
**AS AN** admin\
**IF** \
**I WANT** to permanently delete an organisational unit\
**SO THAT** dissolved or incorrectly created units are removed from the system
