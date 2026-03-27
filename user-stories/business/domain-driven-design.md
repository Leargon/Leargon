#### USER STORY 'Basic'
**AS A** company\
**IF** \
**I WANT** to define domains/subdomains\
**SO THAT** we can develop domain driven design and its specifics

#### USER STORY 'Actualisation'
**AS AN** admin\
**IF** \
**I WANT** to administer the domain's name, and description\
**SO THAT** I can model the business by using the domain driven design concept

#### USER STORY 'Specify'
**AS AN** admin\
**IF** \
**I WANT** set a domain type (business, core, support, generic) to a domain\
**SO THAT** I can specify the type of the domain

#### USER STORY 'Bounded contexts'
**AS AN** architect or admin\
**IF** \
**I WANT** to define bounded contexts within a domain and assign them an owning team\
**SO THAT** explicit service boundaries are established and entities and processes can be placed within the correct linguistic and ownership scope

#### USER STORY 'Context map'
**AS AN** architect\
**IF** two or more bounded contexts exist\
**I WANT** to define the relationships between bounded contexts (Partnership, Customer/Supplier, Shared Kernel, Open Host Service, Conformist, Anti-Corruption Layer)\
**SO THAT** the integration topology and team dependencies are explicitly modelled and visible on the context map diagram

#### USER STORY 'Domain events'
**AS AN** architect or domain expert\
**IF** \
**I WANT** to define domain events, assign them a publishing bounded context, and link them to the processes and entities involved\
**SO THAT** the asynchronous communication patterns between bounded contexts are explicitly captured in the domain model

#### USER STORY 'Ubiquitous language'
**AS AN** architect or domain expert\
**IF** the same real-world concept exists under different names in different bounded contexts\
**I WANT** to create translation links between entities in different bounded contexts and view the ubiquitous language glossary per domain\
**SO THAT** cross-domain semantic equivalences are documented and language boundaries between contexts are explicit