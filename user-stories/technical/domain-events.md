#### USER STORY 'Create domain event'
**AS AN** admin or data owner\
**IF** \
**I WANT** to create a domain event by providing a name in at least one supported locale and assigning a publishing bounded context\
**SO THAT** an asynchronous communication point is captured in the domain model

#### USER STORY 'List domain events'
**AS A** logged in user\
**IF** \
**I WANT** to see a list of all domain events with their names, publishing context, and consumer contexts\
**SO THAT** I get an overview of all events in the domain landscape

#### USER STORY 'View domain event details'
**AS A** logged in user\
**IF** \
**I WANT** to see all details of a domain event including names, descriptions, publishing bounded context, consumer contexts, linked processes, and linked entities\
**SO THAT** I have complete information about that event

#### USER STORY 'Update domain event names'
**AS AN** admin or data owner\
**IF** \
**I WANT** to update the names of a domain event across all supported locales\
**SO THAT** names are correct and up-to-date in every language

#### USER STORY 'Update domain event descriptions'
**AS AN** admin or data owner\
**IF** \
**I WANT** to update the descriptions of a domain event across all supported locales\
**SO THAT** descriptions are correct and up-to-date in every language

#### USER STORY 'Add consumer context to domain event'
**AS AN** admin or data owner\
**IF** the bounded context exists and is not already a consumer\
**I WANT** to add a bounded context as a consumer of a domain event\
**SO THAT** the downstream dependency on this event is documented

#### USER STORY 'Remove consumer context from domain event'
**AS AN** admin or data owner\
**IF** the bounded context is currently listed as a consumer\
**I WANT** to remove a bounded context from the consumer list of a domain event\
**SO THAT** the consumer relationship is removed when no longer accurate

#### USER STORY 'Link domain event to process'
**AS AN** admin or process owner\
**IF** the process exists\
**I WANT** to link a domain event to a business process\
**SO THAT** it is documented which process produces or reacts to this event

#### USER STORY 'Unlink domain event from process'
**AS AN** admin or process owner\
**IF** the process is currently linked\
**I WANT** to remove the link between a domain event and a business process\
**SO THAT** the relationship is removed when no longer accurate

#### USER STORY 'Link domain event to entity'
**AS AN** admin or data owner\
**IF** the entity exists\
**I WANT** to link a domain event to a business entity\
**SO THAT** it is documented which data object is carried by or triggers this event

#### USER STORY 'Unlink domain event from entity'
**AS AN** admin or data owner\
**IF** the entity is currently linked\
**I WANT** to remove the link between a domain event and a business entity\
**SO THAT** the relationship is removed when no longer accurate

#### USER STORY 'Delete domain event'
**AS AN** admin\
**IF** \
**I WANT** to permanently delete a domain event\
**SO THAT** obsolete or incorrectly created events are removed from the model
