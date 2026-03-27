#### USER STORY 'Create context relationship'
**AS AN** admin\
**IF** two bounded contexts exist and are not already related\
**I WANT** to create a directed relationship between two bounded contexts by specifying the relationship type (Partnership, Customer/Supplier, Shared Kernel, Open Host Service, Conformist, Anti-Corruption Layer, Published Language, Separate Ways)\
**SO THAT** the integration topology between bounded contexts is explicitly modelled on the context map

#### USER STORY 'List context relationships'
**AS A** logged in user\
**IF** \
**I WANT** to see a list of all context relationships with their upstream context, downstream context, and relationship type\
**SO THAT** I get an overview of the full integration topology

#### USER STORY 'View context relationship details'
**AS A** logged in user\
**IF** \
**I WANT** to see all details of a context relationship including upstream context, downstream context, relationship type, and description\
**SO THAT** I understand the nature and direction of the integration dependency

#### USER STORY 'Update context relationship type'
**AS AN** admin\
**IF** the relationship exists\
**I WANT** to change the type of an existing context relationship\
**SO THAT** the integration pattern is correctly classified as the architecture evolves

#### USER STORY 'Update context relationship description'
**AS AN** admin\
**IF** the relationship exists\
**I WANT** to update the description of a context relationship\
**SO THAT** the rationale and details of the integration are documented

#### USER STORY 'Delete context relationship'
**AS AN** admin\
**IF** the relationship exists\
**I WANT** to permanently delete a context relationship\
**SO THAT** obsolete or incorrectly modelled relationships are removed from the context map

#### USER STORY 'View context map diagram'
**AS A** logged in user\
**IF** \
**I WANT** to view a diagram showing all bounded contexts as nodes and all context relationships as directed edges, with relationship types labelled\
**SO THAT** I can visually understand the integration topology of the entire domain landscape
