#### USER STORY 'Create business process'
**AS A** logged in user\
**IF** \
**I WANT** to create a new business process by providing a name in at least one supported locale\
**SO THAT** the process is registered in the data landscape, with me as the initial process owner

#### USER STORY 'List all business processes'
**AS A** logged in user\
**IF** \
**I WANT** to see a flat list of all business processes with their names in all supported locales\
**SO THAT** I get an overview of all processes in the organisation

#### USER STORY 'View business process hierarchy'
**AS A** logged in user\
**IF** \
**I WANT** to see business processes as a hierarchical tree showing parent processes and their subprocesses\
**SO THAT** I can understand how processes are structured and nested

#### USER STORY 'View business process details'
**AS A** logged in user\
**IF** \
**I WANT** to see all details of a business process including names, descriptions, code, type, process owner, parent, children, business domain, executing units, input entities, output entities, and classification assignments\
**SO THAT** I have complete information about that process

#### USER STORY 'Update business process names'
**AS A** process owner or admin\
**IF** \
**I WANT** to update the names of a business process across all supported locales\
**SO THAT** names are correct and up-to-date in every language

#### USER STORY 'Update business process descriptions'
**AS A** process owner or admin\
**IF** \
**I WANT** to update the descriptions of a business process across all supported locales\
**SO THAT** descriptions are correct and up-to-date in every language

#### USER STORY 'Update business process code'
**AS A** process owner or admin\
**IF** \
**I WANT** to update the short code of a business process, which recomputes its unique key\
**SO THAT** the process identifier reflects its name or classification

#### USER STORY 'Update business process type'
**AS A** process owner or admin\
**IF** \
**I WANT** to set the process type (e.g. management, core, support)\
**SO THAT** the nature and role of the process is clearly specified

#### USER STORY 'Update business process owner'
**AS A** process owner or admin\
**IF** the new owner is a registered and active user\
**I WANT** to transfer process ownership to another user\
**SO THAT** the correct person is responsible for maintaining the process

#### USER STORY 'Assign business domain to business process'
**AS A** process owner or admin\
**IF** \
**I WANT** to assign a business domain to a business process, or remove the current domain assignment\
**SO THAT** the process is correctly grouped within a domain

#### USER STORY 'Assign executing units to business process'
**AS A** process owner or admin\
**IF** the organisational units exist\
**I WANT** to assign one or more organisational units as executing units of the process, replacing the existing list\
**SO THAT** it is documented which part of the organisation carries out this process

#### USER STORY 'Add input entity to business process'
**AS A** process owner or admin\
**IF** \
**I WANT** to add a business entity as an input to this process, either by referencing an existing entity or creating a new one on-the-fly\
**SO THAT** the data consumed by the process is documented

#### USER STORY 'Remove input entity from business process'
**AS A** process owner or admin\
**IF** the entity is currently linked as an input\
**I WANT** to remove a business entity from the process inputs\
**SO THAT** the input list remains accurate

#### USER STORY 'Add output entity to business process'
**AS A** process owner or admin\
**IF** \
**I WANT** to add a business entity as an output to this process, either by referencing an existing entity or creating a new one on-the-fly\
**SO THAT** the data produced by the process is documented

#### USER STORY 'Remove output entity from business process'
**AS A** process owner or admin\
**IF** the entity is currently linked as an output\
**I WANT** to remove a business entity from the process outputs\
**SO THAT** the output list remains accurate

#### USER STORY 'Save process diagram'
**AS A** process owner or admin\
**IF** \
**I WANT** to save the full process diagram consisting of elements (tasks, subprocesses, gateways, events) and flows, replacing the existing diagram\
**SO THAT** the visual flow of the process is persisted and visible to all users

#### USER STORY 'View process diagram'
**AS A** logged in user\
**IF** \
**I WANT** to view the current diagram of a business process with all its elements and flows\
**SO THAT** I can understand how the process is modelled step by step

#### USER STORY 'Assign classifications to business process'
**AS A** process owner or admin\
**IF** the classification is configured as assignable to BUSINESS_PROCESS and only one value per classification is selected\
**I WANT** to assign classification values to a business process, replacing all existing assignments\
**SO THAT** the process is labelled according to the configured classification taxonomies

#### USER STORY 'Delete business process'
**AS A** process owner or admin\
**IF** \
**I WANT** to permanently delete a business process\
**SO THAT** obsolete or incorrectly created processes are removed from the system

#### USER STORY 'View business process version history'
**AS A** logged in user\
**IF** \
**I WANT** to see a chronological list of all versions of a business process, including timestamp and author of each change\
**SO THAT** I can track how the process has evolved over time

#### USER STORY 'View diff between business process versions'
**AS A** logged in user\
**IF** at least two versions of the business process exist\
**I WANT** to see the diff between a specific version and its preceding version, highlighting which fields changed and how\
**SO THAT** I can understand exactly what was changed and by whom at any given point

#### USER STORY 'Update business process steward'
**AS A** process owner or admin\
**IF** the new steward is a registered and active user\
**I WANT** to assign or change the process steward of a business process\
**SO THAT** the person responsible for day-to-day process quality is documented

#### USER STORY 'Update business process technical custodian'
**AS A** process owner or admin\
**IF** the new custodian is a registered and active user\
**I WANT** to assign or change the technical custodian of a business process\
**SO THAT** the engineer responsible for the technical implementation of this process is documented

#### USER STORY 'Assign business process to bounded context'
**AS A** process owner or admin\
**IF** the bounded context exists\
**I WANT** to assign a business process to a bounded context\
**SO THAT** the process is placed within an explicit service boundary and its owning unit is resolved automatically

#### USER STORY 'Link IT system to business process'
**AS A** process owner or admin\
**IF** the IT system exists\
**I WANT** to link one or more IT systems to a business process\
**SO THAT** it is documented which systems support the execution of this process

#### USER STORY 'Unlink IT system from business process'
**AS A** process owner or admin\
**IF** the IT system is currently linked\
**I WANT** to remove the link between an IT system and a business process\
**SO THAT** the relationship is removed when no longer accurate

#### USER STORY 'Link service provider to business process'
**AS A** process owner or admin\
**IF** the service provider exists\
**I WANT** to link one or more service providers to a business process\
**SO THAT** it is documented which external processors handle data on behalf of this process

#### USER STORY 'Unlink service provider from business process'
**AS A** process owner or admin\
**IF** the service provider is currently linked\
**I WANT** to remove the link between a service provider and a business process\
**SO THAT** the relationship is removed when no longer accurate

#### USER STORY 'Update process legal basis'
**AS A** process owner or admin\
**IF** \
**I WANT** to set the legal basis for a business process (Consent, Contract, Legal Obligation, Vital Interests, Public Task, Legitimate Interest)\
**SO THAT** the GDPR Art. 30 / DSG Art. 12 requirement for documented legal basis is met

#### USER STORY 'Update process purpose'
**AS A** process owner or admin\
**IF** \
**I WANT** to document the purpose of a business process as a free-text statement\
**SO THAT** the specific, explicit, and legitimate purpose of the processing activity is recorded

#### USER STORY 'Update process security measures'
**AS A** process owner or admin\
**IF** \
**I WANT** to document the technical and organisational security measures applied to a business process\
**SO THAT** the security context of the processing activity is visible in the processing register

#### USER STORY 'Add cross-border transfer to business process'
**AS A** process owner or admin\
**IF** \
**I WANT** to add a cross-border transfer record specifying destination country and transfer safeguard mechanism\
**SO THAT** transfers outside Switzerland or the EU/EEA are documented as required by DSG Art. 16 and GDPR Art. 44

#### USER STORY 'Remove cross-border transfer from business process'
**AS A** process owner or admin\
**IF** the transfer record exists\
**I WANT** to remove a cross-border transfer record from a business process\
**SO THAT** the transfer documentation remains accurate
