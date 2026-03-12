# Tier 2 — Compliance readiness
*These stories produce the actual revDSG compliance outputs and require Tier 1 metadata to be meaningful.*

## Catalogue export with templates (Art. 12 revDSG)
**AS AN** admin\
**I WANT** to export catalogue data using a configurable export dashboard — selecting entity types, fields, filters, and output format (PDF, CSV, or Excel) — with a preloaded template for the processing register that pre-selects all mandatory fields from Art. 12 para. 2 revDSG (controller identity, purpose, data subject categories, data categories, recipients, retention periods, security measures, and cross-border transfers)\
**SO THAT** I can present a compliant processing register to the FDPIC or an auditor on request, and reuse the same export framework for other catalogue views such as DPIA lists or incident registers

## Data Protection Impact Assessment (DPIA) workflow (Art. 22–23 revDSG)
**AS A** data owner or admin\
**I WANT** to trigger a DPIA for a process or entity, document the risk description, the planned measures, and the residual risk assessment, and record whether prior consultation with the FDPIC was required\
**SO THAT** high-risk processing activities are identified and formally assessed before going live, as required by Art. 22 revDSG, and the consultation obligation under Art. 23 revDSG is tracked and fulfilled\
**AND** the system automatically suggests a DPIA when I mark an entity as containing sensitive personal data processed on a large scale or a process involving systematic large-scale monitoring

---

# Tier 3 — Active governance
*These stories close the governance loop: review cycles, notifications, incident tracking, and a richer process model.*

## Governance processes
**AS AN** owner\
**I WANT** to confirm or modify the contents of my business entities, processes, and domains on a repeating basis\
**SO THAT** it is audited that the content is still correct

## Communication
**AS** Léargon\
**I WANT** to be able to send e-mails or Teams-webhook messages to notify owners or teams about upcoming governance checkpoints or changes in contents\
**SO THAT** owners are notified at governance checkpoints and users are notified on watched items

## Entity inheritance in processes
**AS A** parent entity\
**I WANT** to inherit the input and output entities from my linked processes\
**SO THAT** a user can see dynamically which entities are used in the process

---

# Tier 4 — Visualisation and data quality
*These stories require good-quality catalogue data to be useful; visualisations reveal insights, quality rules enforce them.*

## Visualising business entities
**AS A** user\
**I WANT** to see business entities as an ERD / class diagram, either starting from a single entity with configurable depth or as a holistic view of all entities\
**SO THAT** I can understand how an entity is used and see the full relationships and implementations across the data landscape\
**AND** optionally, I can enable the domain layer, where entities are shown inside their assigned domain (container)

## Visualising business processes
**AS A** user\
**I WANT** to see business processes as a BPMN diagram (including entity input and output), either for a single process or as a holistic view of all processes, with subprocesses that can be expanded or collapsed\
**SO THAT** I can see both individual process detail and the complete process landscape\
**AND** optionally, I can enable the organisational layer, where processes are shown inside their executing organisational unit\
**AND** optionally, I can enable the domain layer, where processes are shown inside their assigned domain

## Privacy notice content generation (Art. 19 revDSG)
**AS AN** admin\
**I WANT** to generate a draft privacy notice from the documented processing activities in Léargon, covering controller identity, purposes, data categories, recipient categories, retention periods, and cross-border transfers\
**SO THAT** the duty to inform data subjects under Art. 19 revDSG is grounded in the same authoritative data catalogue and remains consistent with the processing register

## Quality check rules
**AS A** data owner or admin\
**I WANT** to define quality check rules for a business entity\
**SO THAT** everyone can check this requirement

---

# Tier 5 — Advanced analytics and views
*These stories deliver the most value when the catalogue is mature and data quality is high.*

## Visualising company
**AS A** user\
**I WANT** to see a combined view of entity–process, entity–domain, process–domain, and process–org unit relationships across the whole company\
**SO THAT** I can reflect on the relationships and dependencies of the entire data landscape

## Statistics and compliance metrics
**AS AN** admin\
**I WANT** to define statistical metrics that are calculated repeatedly (e.g. via a scheduled job)\
**SO THAT** I can check for completeness or compliance across the catalogue over time

---

# Tier 6 - Nice to have
*These stories are not delivering a lot of value but rather have some implications on visualising or using*

## Stewards

**AS AN** admin or owner\
**I WANT** to set zero, one, or many stewards on a business entity, domain, process, or organisational unit\
**SO THAT** the stewards are also able to edit the item alongside the owner
