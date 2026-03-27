#### USER STORY 'Create translation link between entities'
**AS A** data owner or admin\
**IF** two business entities in different bounded contexts represent the same real-world concept under different names\
**I WANT** to create a translation link between them, specifying the relationship type (e.g. same concept, specialisation)\
**SO THAT** cross-domain semantic equivalences are documented and the ubiquitous language differences between bounded contexts are made explicit

#### USER STORY 'List translation links for a business entity'
**AS A** logged in user\
**IF** \
**I WANT** to see all translation links associated with a business entity, showing the linked entity and the relationship type\
**SO THAT** I know which concepts in other domains correspond to this entity

#### USER STORY 'Delete translation link'
**AS A** data owner or admin\
**IF** the translation link exists\
**I WANT** to delete a translation link between two entities\
**SO THAT** incorrectly mapped or obsolete semantic links are removed
