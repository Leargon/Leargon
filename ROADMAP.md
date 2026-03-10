# Tier 1 — Foundation
*These stories establish the governance model and the core compliance metadata that all other stories depend on.*

## Field configuration (optional, mandatory)
**AS AN** admin\
**I WANT** to define which fields (including locale-specific fields) are mandatory\
**SO THAT** I can configure catalogue quality requirements to the needs of the company

## Classification cardinality (single-value vs multi-value)
**AS AN** admin\
**I WANT** to configure each classification as either single-value (only one value may be assigned at a time) or multi-value (multiple values may be assigned simultaneously)\
**SO THAT** I can model classifications where exactly one answer applies (e.g. legal basis) separately from classifications where multiple categories may apply at once (e.g. sensitive data categories)

## Legal basis and consent mechanism (Art. 6 + Art. 12 lit. b + Art. 6 para. 6–7 revDSG)
**AS AN** admin\
**I WANT** to create classifications assignable to processes that capture legal basis (e.g. consent, contract, legal obligation, legitimate interest, public task) and, for consent-based processing, the consent type (implicit/explicit), collection method, and withdrawal method\
**SO THAT** process owners can tag each process with the required values using the existing classification system, satisfying Art. 6 para. 1, Art. 12 para. 2 lit. b, and Art. 6 para. 6–7 revDSG — enforcement of completeness relies on the field configuration story to make the legal basis classification mandatory

## Sensitive personal data classification (Art. 5 lit. c revDSG)
**AS AN** admin\
**I WANT** to create a multi-value classification assignable to business entities with the sensitive data categories defined in Art. 5 lit. c revDSG (health, genetic, biometric, racial/ethnic origin, political/religious/trade-union views, criminal proceedings, social assistance)\
**SO THAT** data owners can tag entities with one or more sensitive categories using the existing classification system — the stricter governance consequences (mandatory DPIA suggestion, explicit consent requirement) are enforced by the DPIA workflow story and the field configuration story respectively

## Retention rule and purpose limitation (Art. 6 para. 3–4 + Art. 7 revDSG)
**AS A** data owner or admin\
**I WANT** to define the purpose and retention period for each business entity and process, and to see a flag when data is retained beyond its declared purpose or retention period\
**SO THAT** everyone can check the retention requirement, and the principles of purpose limitation (Art. 6 para. 3 revDSG) and storage limitation — anonymise or delete when no longer needed (Art. 6 para. 4 revDSG) — are operationally enforced through the governance catalogue

---

# Tier 2 — Compliance readiness
*These stories produce the actual revDSG compliance outputs and require Tier 1 metadata to be meaningful.*

## Data Protection Officer (DPO) role (Art. 10 revDSG)
**AS AN** admin\
**I WANT** to designate a user as Data Protection Officer and make their contact details visible within the system\
**SO THAT** data subjects and the FDPIC can identify the DPO contact as required by Art. 10 para. 2 revDSG, and the DPO can review processing activities, DPIAs, and incident records within Léargon

## Data processor and third-party management (Art. 9 revDSG)
**AS AN** admin\
**I WANT** to define external data processors as catalogue entries and link them to the business entities and processes for which they process data on our behalf, recording for each processor whether a processor agreement is in place and whether sub-processors have been approved\
**SO THAT** the processor relationships required by Art. 9 revDSG are documented in the governance catalogue and traceable in the processing register — the management of the actual contracts happens outside Léargon, but their existence is recorded here

## Cross-border data transfer documentation (Art. 16–17 revDSG)
**AS A** data owner or admin\
**I WANT** to document for each business entity and process whether personal data is transferred to a country outside Switzerland, and if so, which country and which safeguard applies (Federal Council adequacy decision, standard contractual clauses, binding corporate rules, or an exception under Art. 17 revDSG)\
**SO THAT** the transfer is traceable in the processing register as required by Art. 12 para. 2 lit. g revDSG and compliant with Art. 16 revDSG

## Processing register export (Art. 12 revDSG)
**AS AN** admin\
**I WANT** to export the complete register of processing activities as a structured document (PDF, CSV or Excel)\
**SO THAT** I can present a compliant record of processing activities to the FDPIC or an auditor on request, containing all mandatory fields from Art. 12 para. 2 revDSG: controller identity, purpose, data subject categories, data categories, recipients, retention periods, security measures and cross-border transfers

## Data Protection Impact Assessment (DPIA) workflow (Art. 22–23 revDSG)
**AS A** data owner or admin\
**I WANT** to trigger a DPIA for a process or entity, document the risk description, the planned measures, and the residual risk assessment, and record whether prior consultation with the FDPIC was required\
**SO THAT** high-risk processing activities are identified and formally assessed before going live, as required by Art. 22 revDSG, and the consultation obligation under Art. 23 revDSG is tracked and fulfilled\
**AND** the system automatically suggests a DPIA when I mark an entity as containing sensitive personal data processed on a large scale or a process involving systematic large-scale monitoring

## Data subject access request (DSAR) management (Art. 25–32 revDSG)
**AS AN** admin\
**I WANT** to register incoming data subject requests (right of access, rectification, erasure, portability, objection to processing), link them to the relevant business entities and processes, and see at a glance which requests are approaching or past the 30-day statutory deadline\
**SO THAT** I know which data assets are in scope for each request and can demonstrate compliance with data subject rights under Art. 25–32 revDSG — the actual response to the data subject is handled outside Léargon, but its progress and deadline are tracked here

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

## Security incident register (Art. 24 revDSG)
**AS AN** admin\
**I WANT** to log a data security breach, link it to the affected business entities and processes, record the nature of the breach, its consequences, and the measures taken, and track whether the FDPIC was notified\
**SO THAT** I comply with the notification obligation in Art. 24 revDSG and have a complete audit trail of security incidents and their resolution

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
