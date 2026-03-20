# Léargon Roadmap
*Ordered by value/effort score (value 1–10 ÷ sessions). Done batches removed.*

| # | Batch | Sessions | Weekly | Value | Score |
|---|-------|---------|--------|-------|-------|
| 2 | Privacy notice generation | 1 | 10% | 8/10 | **8.0** |
| 3 | DSG/GDPR compliance guided setup | 2 | 20% | 9/10 | **4.5** |
| 4 | Personal dashboard | 2 | 20% | 8/10 | **4.0** |
| 5 | Data governance guided setup | 2 | 20% | 8/10 | **4.0** |
| 6 | DDD guided setup | 2 | 20% | 8/10 | **4.0** |
| 7 | Catalogue insights | 3 | 30% | 8/10 | **2.7** |
| 8 | Quality check rules | 3 | 30% | 7/10 | **2.3** |
| 9 | Impact analysis & domain coupling | 4 | 40% | 8/10 | **2.0** |
| 10 | DDD guided discovery | 4 | 40% | 7/10 | **1.8** |
| 11 | Import & integration | 4 | 40% | 7/10 | **1.8** |
| 12 | Watch & notifications | 4 | 40% | 6/10 | **1.5** |
| 13 | Review cycles | 4 | 40% | 6/10 | **1.5** |
| 14 | Stewards | 5 | 50% | 7/10 | **1.4** |
| 15 | Compliance metrics dashboard | 7 | 70% | 8/10 | **1.1** |

---

## Batch 2 · Privacy notice generation
*Single story. Depends on Batches 1–2 (done) producing complete processing register data. Template-based document generation only — no new data model. Concrete legal deliverable: Art. 19 revDSG duty to inform data subjects.*
*⏱ Sessions: 1 · Weekly effort: ~10% · Value: 8/10 · Score: 8.0*

**Data model notes (from Batch 3 processing register alignment):**
- **Data subject categories** = top-level Business Entities (root of the parent-child tree, i.e. `parent == null`) assigned as input/output on a process. Surfaced in the processing register table and CSV export as of Batch 3.
- **Personal data categories** = all directly assigned input/output entities on a process (may be leaf-level children). Also surfaced in processing register.
- **Retention duration per processing activity**: currently only modelled on `BusinessEntity` (entity-level retention). There is no per-`Process` retention field — this is a gap candidate for future work before privacy notice generation can be fully automated.

#### USER STORY 'Generate privacy notice draft'
**AS AN** admin\
**IF** processing activities are documented with controller identity, purposes, data categories, recipient categories, retention periods, and cross-border transfers\
**I WANT** to generate a draft privacy notice from the catalogue data covering all Art. 19 revDSG required elements\
**SO THAT** the duty to inform data subjects is grounded in the same authoritative catalogue and stays consistent with the processing register

---

## Batch 3 · DSG / GDPR compliance guided setup
*Checklist-based wizard for privacy officers and DPOs to build the processing register, classify personal data, document legal bases, and trigger DPIAs — all grounded in the existing catalogue. Depends on Batches 1, 2, 3 (processing register, data processors, DPIAs). No new tables beyond what those batches introduced.*
*⏱ Sessions: 2 · Weekly effort: ~20% · Value: 9/10 · Score: 4.5*

#### USER STORY 'Compliance setup wizard entry point'
**AS A** privacy officer or DPO\
**IF** I need to comply with GDPR Art. 30 or Swiss DSG Art. 12 (record of processing activities)\
**I WANT** to be offered a compliance setup wizard that walks me through building the processing register step by step\
**SO THAT** I can reach an audit-ready compliance posture without expert knowledge of the tool's data model

#### USER STORY 'Personal data classification step'
**AS A** privacy officer\
**IF** I am at the first step of the compliance wizard\
**I WANT** to be guided through creating a classification scheme for personal data categories (e.g. ordinary personal data, sensitive personal data, special categories under GDPR Art. 9 / DSG Art. 5)\
**SO THAT** business entities containing personal data are consistently labelled before I build the processing register

#### USER STORY 'Processing activity identification step'
**AS A** privacy officer\
**IF** business processes exist in the catalogue\
**I WANT** the wizard to walk me through reviewing each process and marking which ones involve personal data processing\
**SO THAT** I can quickly scope the processing register to the relevant subset of all documented processes

#### USER STORY 'Legal basis assignment step'
**AS A** privacy officer\
**IF** I have identified processes that handle personal data\
**I WANT** the wizard to prompt me to record the legal basis for each processing activity (consent, contract, legal obligation, vital interests, public task, legitimate interest)\
**SO THAT** the processing register is complete with mandatory legal basis information

#### USER STORY 'Data processor inventory step'
**AS A** privacy officer\
**IF** third-party vendors process personal data on our behalf\
**I WANT** the wizard to walk me through inventorying external data processors and linking them to the relevant processes\
**SO THAT** processor agreements (GDPR Art. 28 / DSG Art. 9) are traceable in the system and not omitted

#### USER STORY 'Cross-border transfer step'
**AS A** privacy officer\
**IF** data processors or processes involve transferring personal data outside Switzerland or the EU/EEA\
**I WANT** the wizard to identify these transfers and prompt me to record the destination country and the transfer mechanism (SCCs, adequacy decision, BCRs, derogations)\
**SO THAT** cross-border transfers are documented as required by DSG Art. 16 and GDPR Art. 44

#### USER STORY 'DPIA triggering step'
**AS A** privacy officer\
**IF** I have identified processing activities that pose a high risk to data subjects (large-scale profiling, systematic monitoring, automated decision-making, special category data)\
**I WANT** the wizard to flag these high-risk processes and prompt me to initiate a Data Protection Impact Assessment for each one\
**SO THAT** no high-risk processing activity proceeds without a documented DPIA as required by GDPR Art. 35 and DSG Art. 22

#### USER STORY 'Compliance readiness score'
**AS A** privacy officer\
**IF** I am building the organisation's compliance posture into Léargon\
**I WANT** a readiness overview at the end of the wizard showing: how many processes lack a legal basis, how many entities lack a personal data category classification, how many data processors are linked, and how many DPIAs are outstanding\
**SO THAT** I can close remaining gaps before an audit or supervisory inquiry

---

## Batch 4 · Personal dashboard
*Pure read-only flush — no new tables. The home screen aggregates existing data: owned items, recent activity feed from version history, and (once Batch 12 is shipped) the watchlist. The first two stories are self-contained and can ship independently; the watchlist widget requires Batch 12; the reviews widget requires Batch 13.*
*⏱ Sessions: 2 · Weekly effort: ~20% · Value: 8/10 · Score: 4.0*

#### USER STORY 'View owned items on personal dashboard'
**AS A** data owner, process owner, or admin\
**I WANT** to see a personal dashboard as the home screen listing all business entities, processes, and domains I own, grouped by type, with quick-glance status indicators (completeness score, open DPIA, missing mandatory fields)\
**SO THAT** I have an immediate overview of my governance responsibilities every time I open Léargon without having to navigate through tree views

#### USER STORY 'View recent catalogue activity on dashboard'
**AS A** logged in user\
**I WANT** to see a chronological feed of recently created or modified items across the catalogue — showing item name, type, change type, who made the change, and when — limited to the last 20 entries\
**SO THAT** I can stay informed about what is happening in the data catalogue without subscribing to individual items

#### USER STORY 'View watchlist on dashboard'
**AS A** logged in user\
**IF** I have watched one or more items (Batch 12)\
**I WANT** to see a dedicated watchlist section on my dashboard showing all items I am following, with their last-modified date and a quick link to the detail page\
**SO THAT** I can monitor the items I care about from a single screen without navigating to each one individually

#### USER STORY 'View overdue and upcoming reviews on personal dashboard'
**AS A** data owner, process owner, or admin\
**IF** review cycles are configured (Batch 13) and one or more of my owned items has a review that is overdue or due within the next 30 days\
**I WANT** to see a review-attention section on my dashboard split into overdue items (highlighted as urgent) and upcoming items (due soon), each showing the item name, type, and due date\
**SO THAT** I can act on overdue reviews immediately and plan ahead for reviews that are coming up shortly

---

## Batch 5 · Data governance guided setup
*Checklist-based wizard that helps CDOs, data stewards, and admins establish the foundational governance artefacts in the recommended order: classifications → entity catalogue → data owner assignment → process ownership → org unit assignment. All derived from existing catalogue data; no new tables.*
*⏱ Sessions: 2 · Weekly effort: ~20% · Value: 8/10 · Score: 4.0*

#### USER STORY 'Governance setup wizard entry point'
**AS A** CDO or data steward\
**IF** my organisation is starting a data governance programme\
**I WANT** to be guided through the recommended order of governance setup steps\
**SO THAT** I build a governable data landscape without skipping foundational prerequisites

#### USER STORY 'Classification taxonomy setup step'
**AS AN** admin\
**IF** I am at the first step of the governance wizard\
**I WANT** to be walked through creating a classification taxonomy (e.g. confidentiality: Public / Internal / Confidential / Secret; data quality tiers) with suggested starting templates\
**SO THAT** a consistent vocabulary is in place before other users start cataloguing entities

#### USER STORY 'Data owner assignment step'
**AS AN** admin or CDO\
**IF** business entities exist in the catalogue without a designated data owner\
**I WANT** the wizard to present a filtered list of unowned entities and allow me to assign owners in bulk from a single screen\
**SO THAT** every data object has a responsible person before moving on to classifications

#### USER STORY 'Entity classification coverage step'
**AS A** data steward\
**IF** business entities exist without mandatory classification assignments\
**I WANT** the wizard to highlight which entities lack mandatory classifications and allow me to fill gaps inline\
**SO THAT** the catalogue is complete and fit for governance reporting before the wizard is marked done

#### USER STORY 'Process ownership step'
**AS AN** admin\
**IF** business processes exist without an assigned owner or executing organisational unit\
**I WANT** the wizard to list unowned processes and allow me to assign owners or executing units in bulk\
**SO THAT** every process has clear accountability once the governance foundation is in place

#### USER STORY 'Governance maturity overview'
**AS A** CDO\
**IF** I want to track the organisation's governance progress over time\
**I WANT** a maturity overview showing: % of entities with owners, % with mandatory classifications assigned, % of processes with owners, and % of domains with at least one bounded context\
**SO THAT** I can report governance progress to leadership and identify regressions between reviews

---

## Batch 6 · DDD guided setup
*Checklist-based wizard that walks architects through the recommended Domain-Driven Design modelling steps from scratch. Depends on domains, bounded contexts, domain events, and context relationships being in place (Batches 1, 5, 7). No new tables — the wizard state is stateless; progress is derived from what already exists in the catalogue.*
*⏱ Sessions: 2 · Weekly effort: ~20% · Value: 8/10 · Score: 4.0*

#### USER STORY 'DDD setup wizard entry point'
**AS A** company that is new to Domain-Driven Design\
**IF** I open Léargon and no business domains exist yet\
**I WANT** to be offered a guided setup wizard that walks me through the first DDD modelling steps\
**SO THAT** I can establish a meaningful domain landscape without prior Léargon or DDD expertise

#### USER STORY 'Domain classification guidance'
**AS AN** architect\
**IF** I am in the DDD setup wizard and have created at least one domain\
**I WANT** the wizard to explain the four domain types (Core, Supporting, Generic, Undefined) with examples and prompt me to classify each domain I have created\
**SO THAT** my domain types reflect strategic importance from the start and are not left at the default

#### USER STORY 'Bounded context setup step'
**AS AN** architect\
**IF** I have defined at least one business domain\
**I WANT** the wizard to walk me through creating at least one bounded context per domain and explain what a bounded context represents\
**SO THAT** each domain has an explicit service boundary before I add events or relationships

#### USER STORY 'Context relationship step'
**AS AN** architect\
**IF** I have created two or more bounded contexts\
**I WANT** the wizard to prompt me to define how contexts relate to each other (Partnership, Customer/Supplier, Shared Kernel, etc.) and explain the implications of each relationship type\
**SO THAT** the integration topology and Conway's Law implications are explicitly modelled

#### USER STORY 'Domain event assignment step'
**AS AN** architect or domain expert\
**IF** I have defined bounded contexts\
**I WANT** the wizard to prompt me to identify at least one domain event per bounded context and assign it a publishing context\
**SO THAT** asynchronous communication patterns are explicitly captured in the model from the beginning

#### USER STORY 'Team assignment step'
**AS AN** architect\
**IF** I have defined bounded contexts and organisational units\
**I WANT** the wizard to suggest assigning each bounded context to an owning organisational unit\
**SO THAT** team topologies and ownership are reflected in the domain model

#### USER STORY 'DDD setup progress indicator'
**AS AN** architect\
**IF** I am building my DDD model incrementally\
**I WANT** a progress overview in the wizard showing which steps are complete (domains created, all classified, bounded contexts created, context relationships defined, domain events assigned, team assignments done)\
**SO THAT** I know which gaps remain before the model is useful and coherent

---

## Batch 7 · Catalogue insights
*Pure read-only queries — no new tables. Results are computed on a configurable schedule and stored as snapshots (using quarkus as framework this time); the Insights page displays the last computed result with a timestamp, not a live query. One new "Insights" page in the frontend. No dependencies; data already exists.*
*⏱ Sessions: 3 · Weekly effort: ~30% · Value: 8/10 · Score: 2.7*

#### USER STORY 'Detect processes without a legal basis'
**AS AN** admin\
**I WANT** to see a list of all business processes that have no legal basis documented\
**SO THAT** I can identify gaps in the processing register before an audit or export

#### USER STORY 'View entity inheritance from linked processes'
**AS A** logged in user\
**IF** a business entity has child entities that are linked as inputs or outputs to processes\
**I WANT** to see the inherited input and output entities dynamically derived from the processes linked to the entity and its children\
**SO THAT** I can understand which data is consumed or produced by the broader entity hierarchy without manually tracing each process

#### USER STORY 'Detect entities without domain assignment'
**AS AN** admin\
**I WANT** to see a list of all business entities that are not assigned to any business domain\
**SO THAT** I can identify and resolve gaps in the domain model

#### USER STORY 'Detect processes without executing unit'
**AS AN** admin\
**I WANT** to see a list of all business processes that have no executing organisational unit assigned\
**SO THAT** I can identify unowned processes and assign clear accountability

#### USER STORY 'Detect domains with no entities'
**AS AN** admin\
**I WANT** to see a list of all business domains that have no business entities directly assigned to them\
**SO THAT** I can identify empty or underused domains that may be redundant or misconfigured

#### USER STORY 'Detect entities shared across multiple domains via processes'
**AS AN** admin\
**I WANT** to see which business entities are referenced as inputs or outputs in processes belonging to more than one domain\
**SO THAT** I can identify shared data objects that may indicate coupling between domains or candidates for extraction into a shared domain

#### USER STORY 'Detect processes executed by multiple organisational units'
**AS AN** admin\
**I WANT** to see which business processes are assigned to more than one executing organisational unit\
**SO THAT** I can identify potential coordination overhead, unclear ownership, or bottlenecks in cross-unit processes

---

## Batch 8 · Quality check rules
*One backend flush: new `quality_rules` and `quality_check_results` tables, a rule evaluation engine that runs on a configurable schedule and stores results — not computed on entity load. Rule management UI on entity detail, quality summary admin page. Self-contained.*
*⏱ Sessions: 3 · Weekly effort: ~30% · Value: 7/10 · Score: 2.3*

#### USER STORY 'Define quality check rule for a business entity'
**AS A** data owner or admin\
**I WANT** to define a quality check rule for a business entity, specifying a condition (e.g. a field must be filled, a classification must be assigned, or a relationship must exist)\
**SO THAT** the expected quality standard for that entity is formally documented and can be evaluated automatically

#### USER STORY 'View quality check results for a business entity'
**AS A** logged in user\
**IF** quality check rules are defined for a business entity\
**I WANT** to see the result of each quality check rule on the entity detail page, showing whether each rule is passing or failing\
**SO THAT** I can immediately identify where the entity does not meet its defined quality standards

#### USER STORY 'View quality check summary across all entities'
**AS AN** admin\
**IF** quality check rules are defined\
**I WANT** to see a summary showing the quality check pass rate across all business entities, ranked by the number of failing checks\
**SO THAT** I can identify which entities have the most outstanding quality issues and prioritise remediation

---

## Batch 9 · Impact analysis & domain coupling
*Analytics flush — graph traversal and aggregation queries on existing data. All scores and detections are computed on a configurable schedule and stored as snapshots. New "Domain Analysis" section in the frontend. Depends on Batch 5 (context relationships add coupling signal).*
*⏱ Sessions: 4 · Weekly effort: ~40% · Value: 8/10 · Score: 2.0*

#### USER STORY 'View downstream impact of a business entity'
**AS A** logged in user\
**IF** the business entity is used in one or more processes\
**I WANT** to see a list of all processes, domains, and organisational units that directly or indirectly depend on a specific business entity\
**SO THAT** I can assess the blast radius before changing, splitting, or removing that entity

#### USER STORY 'View downstream impact of a business domain restructuring'
**AS AN** admin\
**I WANT** to see which processes, entities, org units, and context relationships would be affected if a business domain were merged with another, split, or removed\
**SO THAT** I can make informed domain redesign decisions without unintended consequences

#### USER STORY 'View domain dependency graph'
**AS AN** admin\
**I WANT** to view a weighted directed graph of all business domains where edges represent cross-domain entity references, with edge weight proportional to the number of shared references\
**SO THAT** I can see at a glance which domains are tightly or loosely coupled

#### USER STORY 'View coupling score between two domains'
**AS AN** admin\
**I WANT** to see the coupling score between any two selected domains, showing the number of shared entity references, published/consumed domain events, and context relationships\
**SO THAT** I can quantify how interdependent two domains are and decide whether the boundary between them is correctly drawn

#### USER STORY 'Detect highly coupled domain pairs'
**AS AN** admin\
**I WANT** to see a ranked list of domain pairs ordered by coupling score, highlighting pairs that exceed a configurable threshold\
**SO THAT** I can identify domains that may need to be merged, or where an explicit shared kernel or anti-corruption layer should be modelled in the context map

#### USER STORY 'Detect cross-domain term conflicts'
**AS AN** admin\
**I WANT** to see a list of business entities that share the same name across two or more domains but have no translation link defined between them\
**SO THAT** I can identify places where the same word means different things in different bounded contexts and decide whether to align the concepts or create an explicit translation link

#### USER STORY 'Detect high fan-in entities'
**AS AN** admin\
**I WANT** to see a list of business entities that are used as inputs or outputs in an unusually high number of processes across multiple domains, ranked by process count\
**SO THAT** I can identify hidden shared kernels, potential single points of failure, and entities that may need to be extracted into a dedicated shared domain

---

## Batch 10 · DDD guided discovery
*Read-heavy analytics flush — no new tables beyond what Batch 5 and Batch 9 introduce. Léargon already holds the data needed to surface most of these insights: entity hierarchies, process-entity assignments, version histories, domain type fields, and org unit relationships. Each story produces an actionable suggestion with supporting evidence, not just a raw metric. Depends on Batch 5 (context relationships) and benefits from Batch 9 (coupling scores). Stories involving domain events depend on Batch 7.*
*⏱ Sessions: 4 · Weekly effort: ~40% · Value: 7/10 · Score: 1.8*

#### USER STORY 'Detect aggregate candidates within a domain'
**AS AN** admin or data owner\
**IF** a domain contains multiple business entities\
**I WANT** to see a suggested grouping of entities within a domain into aggregate candidates, based on which entities are consistently used together as inputs or outputs across the same processes\
**SO THAT** I can identify natural aggregate boundaries, decide which entity should be the aggregate root, and restructure the entity hierarchy accordingly

#### USER STORY 'Validate subdomain classification'
**AS AN** admin\
**IF** a domain has its type set (Core, Supporting, Generic)\
**I WANT** Léargon to evaluate each domain against heuristics — process count, entity count unique to the domain, team focus from the Conway matrix, and reuse across other domains' processes — and flag domains whose stated type does not match the evidence\
**SO THAT** I can review and correct misclassified subdomains before they mislead strategic investment decisions

#### USER STORY 'Detect undocumented context relationships'
**AS AN** admin\
**IF** processes in one domain consume entities owned by another domain\
**I WANT** to see a list of domain pairs that have significant cross-domain entity usage but no context relationship documented between them\
**SO THAT** I can consciously decide whether to formalise the dependency as a context relationship or refactor the entity assignment

#### USER STORY 'Suggest shared kernel extraction'
**AS AN** admin\
**IF** the same business entities are referenced as inputs or outputs across processes in three or more distinct domains\
**I WANT** Léargon to identify these widely shared entities and suggest extracting them into a dedicated shared domain with SHARED_KERNEL relationships to each consumer domain\
**SO THAT** shared concepts are explicitly managed rather than silently duplicated or implicitly coupled across domain boundaries

#### USER STORY 'Detect volatile aggregate candidates'
**AS AN** admin\
**IF** version history is available\
**I WANT** to see a list of business entities that have a high rate of change (many versions in a rolling window) while also being used as inputs or outputs in a large number of processes\
**SO THAT** I can identify aggregates that are both unstable and widely depended on — the highest-risk combination — and consider extracting their volatile parts into a separate, more isolated entity

#### USER STORY 'Validate interface and implementation domain boundaries'
**AS AN** admin\
**IF** entity interface/implementation links exist across domain boundaries\
**I WANT** to see a report of cases where an entity interface lives in one domain and one or more of its implementations live in a different domain, without a corresponding OPEN_HOST_SERVICE, SHARED_KERNEL, or similar context relationship documented between those domains\
**SO THAT** implicit cross-domain structural dependencies are made visible and can be formalised or resolved

#### USER STORY 'Validate domain event boundaries'
**AS AN** admin\
**IF** domain events are defined (Batch 7)\
**I WANT** to see an analysis of which domains publish events consumed by many others (event sources, likely strong natural boundaries) and which domains only consume events without publishing (event sinks, potential merge candidates)\
**SO THAT** the event-driven coupling structure of the system corroborates or challenges the domain boundaries drawn on the context map

---

## Batch 11 · Import & integration
*Infrastructure-heavy flush: file upload handling, CSV parsing, column mapping UI, and a webhook receiver. Useful for initial catalogue seeding but not required for ongoing operation.*
*⏱ Sessions: 4 · Weekly effort: ~40% · Value: 7/10 · Score: 1.8*

#### USER STORY 'Import business entities from CSV'
**AS AN** admin\
**I WANT** to upload a CSV file and map its columns to business entity fields (name, description, domain, owner, classification values)\
**SO THAT** I can bulk-seed the entity catalogue from an existing data dictionary or spreadsheet without entering each entity manually

#### USER STORY 'Import organisational structure from CSV'
**AS AN** admin\
**I WANT** to upload a CSV file representing the org chart (unit name, type, parent unit, lead user) and have Léargon create or update the corresponding organisational units\
**SO THAT** the org structure can be seeded from an HR export rather than entered unit by unit

#### USER STORY 'Import business processes from CSV'
**AS AN** admin\
**I WANT** to upload a CSV file and map its columns to business process fields (name, description, domain, owner, type, executing unit)\
**SO THAT** I can bulk-seed the process catalogue from an existing process inventory

#### USER STORY 'Export full catalogue as machine-readable format'
**AS AN** admin\
**I WANT** to export the complete catalogue — entities, processes, domains, org units, and context relationships — as a structured JSON or CSV file\
**SO THAT** the catalogue can be consumed by other tools, backed up, or migrated to another instance

#### USER STORY 'Receive catalogue updates via webhook'
**AS AN** operator\
**IF** an external system (e.g. a data catalog, HR system, or schema registry) supports outbound webhooks\
**I WANT** to configure Léargon to receive catalogue updates from that system via a webhook endpoint, mapping the incoming payload to the corresponding entity or process fields\
**SO THAT** the Léargon catalogue stays in sync with authoritative external sources without manual re-entry

---

## Batch 12 · Watch & notifications
*One backend flush: new `watches` table, an event-dispatch pipeline, SMTP and Teams webhook integrations, notification settings UI. Core watch functionality is self-contained; review-cycle notifications are additive once Batch 13 is shipped.*
*⏱ Sessions: 4 · Weekly effort: ~40% · Value: 6/10 · Score: 1.5*

#### USER STORY 'Watch a business entity'
**AS A** logged in user\
**I WANT** to subscribe to change notifications for a specific business entity\
**SO THAT** I am notified whenever that entity is updated

#### USER STORY 'Watch a business process'
**AS A** logged in user\
**I WANT** to subscribe to change notifications for a specific business process\
**SO THAT** I am notified whenever that process is updated

#### USER STORY 'Watch a business domain'
**AS A** logged in user\
**I WANT** to subscribe to change notifications for a specific business domain\
**SO THAT** I am notified whenever that domain is updated

#### USER STORY 'Unwatch an item'
**AS A** logged in user\
**IF** I am currently watching an item\
**I WANT** to unsubscribe from change notifications for that item\
**SO THAT** I stop receiving notifications for items I no longer need to monitor

#### USER STORY 'Configure email notifications'
**AS AN** admin\
**IF** an SMTP server is configured\
**I WANT** to configure Léargon to send email notifications to watchers when an item they follow changes\
**SO THAT** owners are informed without having to check the application manually

#### USER STORY 'Configure Teams webhook notifications'
**AS AN** admin\
**IF** a Microsoft Teams webhook URL is configured\
**I WANT** to configure Léargon to post notifications to a Teams channel for watched item changes\
**SO THAT** teams can receive governance reminders within their existing communication tools

---

## Batch 13 · Review cycles
*One backend flush: new `review_cycles` and `review_confirmations` tables, a scheduled job that computes due dates, review section on all detail pages, and an overdue-reviews admin page. Deprioritised — the core use case can be covered with external calendar reminders; the main value add over external tooling is the timestamped audit trail attached to each item, which matters primarily for formal compliance audits.*
*⏱ Sessions: 4 · Weekly effort: ~40% · Value: 6/10 · Score: 1.5*

#### USER STORY 'Define review cycle for a business entity'
**AS A** admin\
**I WANT** to set a review cycle (e.g. every 6 months, annually) on the system\
**SO THAT** the system knows when to prompt the data owner to confirm the entity's content is still accurate

#### USER STORY 'Define review cycle for a business process'
**AS A** admin\
**I WANT** to set a review cycle (e.g. every 6 months, annually) on the system\
**SO THAT** the system knows when to prompt the process owner to confirm the process is still accurate

#### USER STORY 'Define review cycle for a business domain'
**AS AN** admin\
**I WANT** to set a review cycle (e.g. every 6 months, annually) on the system\
**SO THAT** the system knows when to prompt for a domain review

#### USER STORY 'Confirm content at review checkpoint'
**AS A** data owner, process owner, or admin\
**IF** a review is due for an item I am responsible for\
**I WANT** to confirm that the content of a business entity, process, or domain is still accurate and up-to-date, or modify it before confirming\
**SO THAT** it is audited that the content has been actively reviewed and attested as correct at a specific point in time

#### USER STORY 'View review history'
**AS A** logged in user\
**IF** reviews have been confirmed in the past\
**I WANT** to see a chronological history of all review confirmations on a business entity, process, or domain, showing who confirmed and when\
**SO THAT** the audit trail of periodic reviews is visible and traceable

#### USER STORY 'View overdue reviews'
**AS AN** admin\
**IF** one or more review cycles are configured\
**I WANT** to see a centralised list of all business entities, processes, and domains whose review deadline has passed without a confirmation\
**SO THAT** I can follow up with the responsible owners to get overdue reviews completed

#### USER STORY 'View upcoming reviews'
**AS A** data owner, process owner, or admin\
**IF** review cycles are configured for items I am responsible for\
**I WANT** to see a list of my upcoming reviews with their due dates in my personal overview or notification panel\
**SO THAT** I can plan ahead and avoid overdue reviews

---

## Batch 14 · Stewards
*Adds a new permission layer across all four entity types — touches every service and detail page. Wide blast radius; ship as one complete feature.*
*⏱ Sessions: 5 · Weekly effort: ~50% · Value: 7/10 · Score: 1.4*

#### USER STORY 'Add steward to business entity'
**AS AN** admin or data owner\
**IF** the user is registered and active\
**I WANT** to assign one or more users as stewards of a business entity\
**SO THAT** the stewards can edit the entity alongside the data owner without having full admin rights

#### USER STORY 'Remove steward from business entity'
**AS AN** admin or data owner\
**IF** the user is currently a steward of the entity\
**I WANT** to remove a steward from a business entity\
**SO THAT** the user no longer has edit rights on that entity

#### USER STORY 'Add steward to business domain'
**AS AN** admin\
**IF** the user is registered and active\
**I WANT** to assign one or more users as stewards of a business domain\
**SO THAT** the stewards can edit the domain alongside admins

#### USER STORY 'Remove steward from business domain'
**AS AN** admin\
**IF** the user is currently a steward of the domain\
**I WANT** to remove a steward from a business domain\
**SO THAT** the user no longer has edit rights on that domain

#### USER STORY 'Add steward to business process'
**AS AN** admin or process owner\
**IF** the user is registered and active\
**I WANT** to assign one or more users as stewards of a business process\
**SO THAT** the stewards can edit the process alongside the process owner

#### USER STORY 'Remove steward from business process'
**AS AN** admin or process owner\
**IF** the user is currently a steward of the process\
**I WANT** to remove a steward from a business process\
**SO THAT** the user no longer has edit rights on that process

#### USER STORY 'Add steward to organisational unit'
**AS AN** admin\
**IF** the user is registered and active\
**I WANT** to assign one or more users as stewards of an organisational unit\
**SO THAT** the stewards can edit the unit alongside the unit lead

#### USER STORY 'Remove steward from organisational unit'
**AS AN** admin\
**IF** the user is currently a steward of the organisational unit\
**I WANT** to remove a steward from an organisational unit\
**SO THAT** the user no longer has edit rights on that unit

#### USER STORY 'View stewards on an item'
**AS A** logged in user\
**IF** stewards are assigned\
**I WANT** to see the list of current stewards on the detail page of a business entity, domain, process, or organisational unit\
**SO THAT** I know who is responsible for maintaining that item alongside the primary owner or lead

---

## Batch 15 · Compliance metrics dashboard & company view
*Heavier flush: introduces the shared scheduler/job infrastructure that analytics batches (7, 8, 9, 10) also depend on. Results for all analytics are stored as timestamped snapshots and refreshed on this shared schedule.*
*⏱ Sessions: 7 · Weekly effort: ~70% · Value: 8/10 · Score: 1.1*

**Framework: Quarkus.** The scheduler and job infrastructure in this batch are implemented as a separate **Quarkus** service (not Micronaut). Quarkus is chosen for its superior scheduled-job support, native compilation, and low idle memory footprint — appropriate for a background worker that runs infrequently but must be reliable. The Quarkus service reads from the same MySQL database as the Micronaut backend and writes snapshot results into shared tables that the Micronaut API then exposes to the frontend.

#### USER STORY 'Configure analytics computation schedule'
**AS AN** admin\
**I WANT** to configure a global schedule (e.g. nightly, every 6 hours) on which Léargon recomputes all analytics and stores the results as a new snapshot\
**SO THAT** all insight pages always reflect a recent state of the catalogue without requiring live queries on page load

#### USER STORY 'View last computed timestamp on insight pages'
**AS A** logged in user\
**IF** analytics are computed on a schedule\
**I WANT** to see when the displayed results were last computed on every insight and analytics page\
**SO THAT** I know how fresh the data is before making an important decision

#### USER STORY 'Trigger manual analytics recomputation'
**AS AN** admin\
**I WANT** to trigger an immediate recomputation of all analytics outside the regular schedule\
**SO THAT** I can get up-to-date results before an audit or after a large batch of catalogue changes

#### USER STORY 'View catalogue completeness score'
**AS AN** admin\
**IF** mandatory fields are configured\
**I WANT** to see an overall catalogue completeness score showing the percentage of mandatory fields that are filled across all entities, processes, and domains\
**SO THAT** I have a single top-level indicator of data catalogue quality

#### USER STORY 'Define compliance metric'
**AS AN** admin\
**I WANT** to define a statistical compliance metric with a name and a calculation rule (e.g. percentage of entities with a retention period set)\
**SO THAT** the metric is calculated automatically on a schedule and its trend can be tracked over time

#### USER STORY 'View compliance metrics dashboard'
**AS AN** admin\
**IF** at least one compliance metric is defined\
**I WANT** to view a dashboard showing the current value of each metric alongside its historical trend as a chart\
**SO THAT** I can assess catalogue completeness and compliance health at a glance and over time

#### USER STORY 'View company combined view'
**AS A** logged in user\
**I WANT** to see a combined view of entity–process, entity–domain, process–domain, and process–org unit relationships across the whole company\
**SO THAT** I can reflect on the relationships and dependencies of the entire data landscape
