# Léargon Roadmap
*Ordered by value delivered. Done batches removed.*

---

## Batch 5 · Context mapping
*One backend flush: new `context_relationships` table, CRUD endpoints, context relationship section on domain detail, and a context map diagram page using xyflow. Self-contained — no dependencies.*

**Alignment with [ContextMapper](https://contextmapper.org/):** Léargon's relationship types and diagram notation must follow the ContextMapper standard, which implements the DDD strategic patterns from Eric Evans and Vaughn Vernon exactly. This enables interoperability (`.cml` export), ensures architects recognise the vocabulary immediately, and avoids reinventing terminology.

**Relationship types (as defined by ContextMapper):**
- `PARTNERSHIP` — two contexts collaborate with a mutual success dependency
- `SHARED_KERNEL` — two teams share a subset of the domain model; changes require joint agreement
- `CUSTOMER_SUPPLIER` — upstream supplies the downstream; downstream has influence on the upstream's planning
- `CONFORMIST` — upstream supplies, downstream conforms entirely with no negotiating power
- `ANTICORRUPTION_LAYER` — downstream isolates itself from an upstream model via a translation layer
- `OPEN_HOST_SERVICE` — upstream publishes a well-defined protocol for integration by multiple consumers
- `PUBLISHED_LANGUAGE` — OHS uses a shared, documented interchange language (often combined with OHS)
- `BIG_BALL_OF_MUD` — context with no clear boundaries; treated as a legacy integration point

**Upstream/downstream roles** must be captured on the relationship (not just relationship type), since e.g. a CUSTOMER\_SUPPLIER relationship has a directionality. The diagram should render upstream left, downstream right by convention.

**Export:** Léargon should be able to generate a `.cml` (ContextMapper DSL) file from the context map so architects can import it into the ContextMapper IDE plugin for further refactoring or diagram generation.

#### USER STORY 'Create context relationship between two domains'
**AS AN** admin\
**IF** both domains exist\
**I WANT** to create a directed context relationship from one bounded context (domain) to another, selecting the ContextMapper relationship type (Partnership, Shared Kernel, Customer-Supplier, Conformist, Anticorruption Layer, Open-Host Service, Published Language, Big Ball of Mud) and the upstream/downstream roles where applicable, with an optional description\
**SO THAT** the integration pattern and power dynamic between the two bounded contexts is formally documented using the standard DDD vocabulary

#### USER STORY 'Update context relationship'
**AS AN** admin\
**IF** the context relationship exists\
**I WANT** to change the relationship type, upstream/downstream assignment, or description of a context relationship between two domains\
**SO THAT** the context map stays accurate as the integration evolves

#### USER STORY 'Delete context relationship'
**AS AN** admin\
**IF** the context relationship exists\
**I WANT** to remove a context relationship between two domains\
**SO THAT** obsolete or incorrect integrations are no longer shown on the context map

#### USER STORY 'View context relationships on domain detail'
**AS A** logged in user\
**I WANT** to see all incoming and outgoing context relationships for a domain on its detail page, including relationship type, upstream/downstream role, and the partner domain\
**SO THAT** I can understand which domains this domain depends on, which depend on it, and how data flows across the boundary

#### USER STORY 'View context map diagram'
**AS A** logged in user\
**I WANT** to view an interactive context map diagram of all domains and their relationships, using ContextMapper visual conventions — directed edges with relationship type labels, upstream/downstream annotations (U/D), bounded context shapes, and domain type colouring (core, business, support, generic)\
**SO THAT** I can see the full strategic architecture of the organisation at a glance and identify integration hotspots

#### USER STORY 'Export context map as ContextMapper DSL (.cml)'
**AS AN** admin\
**I WANT** to export the context map as a `.cml` file in ContextMapper DSL format\
**SO THAT** I can import it into the ContextMapper IDE plugin (VS Code / IntelliJ) for further analysis, refactoring simulation, or architecture documentation

---

## Batch 17 · Full-text search
*Self-contained: add MySQL FULLTEXT indexes (or a search index), one search endpoint, one global search bar component. Can be done independently at any point. Disproportionate UX improvement for the effort — the pain of navigating large catalogues without search is felt from day one.*

#### USER STORY 'Search across the catalogue'
**AS A** logged in user\
**I WANT** to type a keyword into a global search bar and see matching results across all business entities, processes, domains, and organisational units, with the matching text highlighted\
**SO THAT** I can quickly find any item in the catalogue without navigating through tree views or lists

#### USER STORY 'Filter search results'
**AS A** logged in user\
**IF** a search has returned results\
**I WANT** to filter the results by entity type, business domain, classification, or owner\
**SO THAT** I can narrow down large result sets to the subset that is relevant to my task

---

## Batch 6 · Cross-domain translation links
*Very small flush: extends the existing `BusinessEntityRelationship` with a TRANSLATION type, adds a conflict-detection query. Can be done in a day. Makes the Ubiquitous Language view functional — the same concept called "Customer" in one domain and "Client" in another is made explicit.*

#### USER STORY 'Create cross-domain translation link between two business entities'
**AS AN** admin or data owner\
**IF** both entities exist and belong to different domains\
**I WANT** to create a translation link between two business entities in different domains, with an optional note describing the semantic difference\
**SO THAT** it is explicitly documented that these two entities represent the same real-world concept under different names in their respective bounded contexts

#### USER STORY 'Remove cross-domain translation link'
**AS AN** admin or data owner\
**IF** a translation link exists between two entities\
**I WANT** to remove the translation link\
**SO THAT** the equivalence mapping is no longer shown when it is no longer accurate

#### USER STORY 'View translation links on business entity'
**AS A** logged in user\
**IF** translation links exist for a business entity\
**I WANT** to see all entities in other domains that are linked as translations of this entity, including the semantic difference note\
**SO THAT** I know immediately which concept in a partner domain this entity corresponds to

---

## Batch 16 · Stewards
*Adds a new permission layer across all four entity types — touches every service and detail page. Wide blast radius; ship as one complete feature.*

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

## Batch 4 · Privacy notice generation
*Single story. Depends on Batches 1–2 (done) producing complete processing register data. Template-based document generation only — no new data model. Concrete legal deliverable: Art. 19 revDSG duty to inform data subjects.*

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

## Batch 7 · Domain events
*One backend flush: new `domain_events` table, M2M consuming-domains join table, process-link join table, CRUD endpoints, event section on domain detail, and an event flow diagram page. Self-contained — no dependencies. Completes the DDD picture alongside Batch 5 (context map) and Batch 6 (translation links).*

#### USER STORY 'Define domain event'
**AS AN** admin or process owner\
**I WANT** to define a domain event by providing a name, description, and the publishing domain\
**SO THAT** the significant state changes that one domain signals to others are formally documented

#### USER STORY 'Assign consuming domains to a domain event'
**AS AN** admin\
**IF** the domain event exists\
**I WANT** to assign one or more domains as consumers of a domain event\
**SO THAT** it is visible which domains react to or depend on this event

#### USER STORY 'Link domain event to a business process'
**AS AN** admin or process owner\
**IF** the domain event and process exist\
**I WANT** to link a domain event to a business process, marking whether the process triggers or handles the event\
**SO THAT** the relationship between process execution and domain event flow is documented

#### USER STORY 'View domain events on domain detail'
**AS A** logged in user\
**I WANT** to see all domain events published by a domain and all events it consumes on the domain detail page\
**SO THAT** I understand the event-driven integration surface of that domain

#### USER STORY 'View domain event flow diagram'
**AS A** logged in user\
**IF** domain events are defined\
**I WANT** to view a diagram of all domains and the events flowing between them as directed labelled arrows\
**SO THAT** I can see the full asynchronous integration landscape and trace event-driven dependencies across the organisation

---

## Batch 9 · Watch & notifications
*One backend flush: new `watches` table, an event-dispatch pipeline, SMTP and Teams webhook integrations, notification settings UI. Core watch functionality is self-contained; review-cycle notifications are additive once Batch 8 is shipped.*

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

## Batch 10 · Catalogue insights
*Pure read-only queries — no new tables. Results are computed on a configurable schedule and stored as snapshots (using quarkus as framework this time); the Insights page displays the last computed result with a timestamp, not a live query. One new "Insights" page in the frontend. No dependencies; data already exists.*

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

## Batch 12 · Quality check rules
*One backend flush: new `quality_rules` and `quality_check_results` tables, a rule evaluation engine that runs on a configurable schedule and stores results — not computed on entity load. Rule management UI on entity detail, quality summary admin page. Self-contained.*

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

## Batch 13 · Impact analysis & domain coupling
*Analytics flush — graph traversal and aggregation queries on existing data. All scores and detections are computed on a configurable schedule and stored as snapshots. New "Domain Analysis" section in the frontend. Depends on Batch 5 (context relationships add coupling signal).*

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

## Batch 19 · Personal dashboard
*Pure read-only flush — no new tables. The home screen aggregates existing data: owned items, recent activity feed from version history, and (once Batch 9 is shipped) the watchlist. The first two stories are self-contained and can ship independently; the watchlist widget requires Batch 9; the reviews widget requires Batch 8.*

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
**IF** I have watched one or more items (Batch 9)\
**I WANT** to see a dedicated watchlist section on my dashboard showing all items I am following, with their last-modified date and a quick link to the detail page\
**SO THAT** I can monitor the items I care about from a single screen without navigating to each one individually

#### USER STORY 'View overdue and upcoming reviews on personal dashboard'
**AS A** data owner, process owner, or admin\
**IF** review cycles are configured (Batch 8) and one or more of my owned items has a review that is overdue or due within the next 30 days\
**I WANT** to see a review-attention section on my dashboard split into overdue items (highlighted as urgent) and upcoming items (due soon), each showing the item name, type, and due date\
**SO THAT** I can act on overdue reviews immediately and plan ahead for reviews that are coming up shortly

---

## Batch 15 · Compliance metrics dashboard & company view
*Heavier flush: introduces the shared scheduler/job infrastructure that analytics batches (10, 12, 13, 14) also depend on. Results for all analytics are stored as timestamped snapshots and refreshed on this shared schedule.*

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

---

## Batch 18 · Import & integration
*Infrastructure-heavy flush: file upload handling, CSV parsing, column mapping UI, and a webhook receiver. Useful for initial catalogue seeding but not required for ongoing operation.*

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

## Batch 8 · Review cycles
*One backend flush: new `review_cycles` and `review_confirmations` tables, a scheduled job that computes due dates, review section on all detail pages, and an overdue-reviews admin page. Deprioritised — the core use case can be covered with external calendar reminders; the main value add over external tooling is the timestamped audit trail attached to each item, which matters primarily for formal compliance audits.*

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
