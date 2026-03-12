# Priority 1 — GDPR / revDSG compliance

---

## ~~Batch 1 · Processing register foundation~~ ✅ DONE
*Minimal flush: one `legal_basis` enum field added to the Process entity, one dropdown in the process detail panel. No new tables. No dependencies — implement first.*

#### USER STORY 'Set legal basis on a business process'
**AS A** process owner or admin\
**IF** \
**I WANT** to set the legal basis for a business process, selecting from: consent (Art. 6 lit. a), contract (Art. 6 lit. b), legal obligation (Art. 6 lit. c), vital interest (Art. 6 lit. d), public task (Art. 6 lit. e), or legitimate interest (Art. 6 lit. f)\
**SO THAT** the lawfulness of each processing activity is documented as required by Art. 12 revDSG and Art. 30 GDPR

#### USER STORY 'View legal basis on process detail'
**AS A** logged in user\
**IF** a legal basis is set\
**I WANT** to see the legal basis on the detail page of a business process\
**SO THAT** anyone reviewing the process can immediately see under what authority the data is processed

---

## Batch 2 · Compliance exports
*One backend flush: export engine (PDF/CSV/Excel), three prebuilt compliance export templates, and a generic configurable template. Three prebuilt exports have fixed field sets defined by law and require no template configuration. Depends on Batch 1 for complete register data.*

#### USER STORY 'Export Datenbearbeitungsverzeichnis (Art. 12 revDSG)'
**AS AN** admin\
**IF** \
**I WANT** to export the Datenbearbeitungsverzeichnis as a prebuilt export that automatically includes all mandatory Art. 12 para. 2 revDSG fields (controller identity, purpose, data subject categories derived from process classification assignments, data categories derived from linked business entity classifications, recipients, retention periods from linked entities, security measures, cross-border transfers, and legal basis) across all documented processing activities\
**SO THAT** I can present a complete, audit-ready processing register to the FDPIC or an auditor on request without any manual template configuration

#### USER STORY 'Export sub-processor register (Auftragsverarbeiter)'
**AS AN** admin\
**IF** \
**I WANT** to export a prebuilt sub-processor register listing all documented data processors with their names, processing countries, processor agreement status, sub-processor approval status, and all linked processes and business entities\
**SO THAT** I have a complete, exportable overview of all third-party data processing relationships for contractual compliance and audit purposes

#### USER STORY 'Export DPIA register'
**AS AN** admin\
**IF** \
**I WANT** to export a prebuilt DPIA register listing all triggered DPIAs with the associated process or entity, current status, residual risk level, planned measures summary, and FDPIC consultation status\
**SO THAT** I have a consolidated record of all data protection impact assessments for audit, compliance reporting, and FDPIC submission

#### USER STORY 'Configure custom export template'
**AS AN** admin\
**IF** \
**I WANT** to configure a custom catalogue export template by selecting which entity types, fields, and filters to include and choosing the output format (PDF, CSV, or Excel)\
**SO THAT** the export can be saved and reused for catalogue views beyond the three prebuilt compliance exports

#### USER STORY 'Export custom catalogue view'
**AS AN** admin\
**IF** a saved custom export template exists\
**I WANT** to trigger an export using a saved template and download the result in the chosen format\
**SO THAT** I can produce consistent, reproducible catalogue exports for different audiences and purposes

---

## Batch 3 · DPIA workflow
*One backend flush: new `dpia` table with a state machine (not started → in progress → completed), DPIA section added to entity and process detail pages. Independent of Batches 1–2; can be developed in parallel.*

#### USER STORY 'Trigger DPIA'
**AS A** data owner or admin\
**IF** \
**I WANT** to trigger a Data Protection Impact Assessment (DPIA) for a business process or business entity\
**SO THAT** the high-risk processing activity is formally flagged and the assessment process begins

#### USER STORY 'Document DPIA risk description'
**AS A** data owner or admin\
**IF** a DPIA has been triggered\
**I WANT** to document the risk description for the DPIA, covering the nature, scope, context, and purpose of the processing and the identified risks\
**SO THAT** the risk basis of the assessment is formally recorded

#### USER STORY 'Document DPIA measures'
**AS A** data owner or admin\
**IF** a DPIA is in progress\
**I WANT** to document the planned measures to address each identified risk\
**SO THAT** the risk mitigation plan is captured as part of the DPIA record

#### USER STORY 'Document DPIA residual risk'
**AS A** data owner or admin\
**IF** measures have been documented in an open DPIA\
**I WANT** to record the residual risk level after measures are applied (low, medium, or high)\
**SO THAT** the final risk posture of the processing activity is formally assessed and documented

#### USER STORY 'Record FDPIC prior consultation'
**AS A** data owner or admin\
**IF** the residual risk is assessed as high\
**I WANT** to record whether prior consultation with the FDPIC was required and whether it was completed, including the consultation date and outcome\
**SO THAT** the consultation obligation under Art. 23 revDSG is tracked and the record is audit-ready

#### USER STORY 'View DPIA status on entity or process'
**AS A** logged in user\
**IF** a DPIA has been triggered\
**I WANT** to see the current DPIA status (not started, in progress, completed) and a summary on the detail page of the business entity or process\
**SO THAT** I can immediately tell whether a DPIA is pending, in progress, or finalised

#### USER STORY 'Auto-suggest DPIA for sensitive processing'
**AS** Léargon\
**IF** a business entity is classified as containing sensitive personal data processed on a large scale, or a business process involves systematic large-scale monitoring\
**I WANT** to automatically surface a suggestion on the entity or process detail page that a DPIA should be triggered\
**SO THAT** owners are proactively alerted to the DPIA obligation under Art. 22 revDSG

---

## Batch 4 · Privacy notice generation
*Single story. Depends on Batches 1–2 producing complete processing register data. Template-based document generation only — no new data model.*

#### USER STORY 'Generate privacy notice draft'
**AS AN** admin\
**IF** processing activities are documented with controller identity, purposes, data categories, recipient categories, retention periods, and cross-border transfers\
**I WANT** to generate a draft privacy notice from the catalogue data covering all Art. 19 revDSG required elements\
**SO THAT** the duty to inform data subjects is grounded in the same authoritative catalogue and stays consistent with the processing register

---

# Priority 2 — DDD strategic design

---

## Batch 5 · Context mapping
*One backend flush: new `context_relationships` table with an enum for relationship type, CRUD endpoints, context relationship section on domain detail, and a diagram page using xyflow. Self-contained — no dependencies.*

#### USER STORY 'Create context relationship between two domains'
**AS AN** admin\
**IF** both domains exist\
**I WANT** to create a directed context relationship from one domain to another, selecting the relationship type (upstream/downstream, customer/supplier, conformist, anti-corruption layer, shared kernel, open host service, published language) and adding an optional description\
**SO THAT** the integration pattern and power dynamic between the two bounded contexts is formally documented

#### USER STORY 'Update context relationship'
**AS AN** admin\
**IF** the context relationship exists\
**I WANT** to change the relationship type or description of a context relationship between two domains\
**SO THAT** the context map stays accurate as the integration evolves

#### USER STORY 'Delete context relationship'
**AS AN** admin\
**IF** the context relationship exists\
**I WANT** to remove a context relationship between two domains\
**SO THAT** obsolete or incorrect integrations are no longer shown on the context map

#### USER STORY 'View context relationships on domain detail'
**AS A** logged in user\
**IF** \
**I WANT** to see all incoming and outgoing context relationships for a domain on its detail page, including relationship type and the partner domain\
**SO THAT** I can understand which domains this domain depends on, which depend on it, and how data flows across the boundary

#### USER STORY 'View context map diagram'
**AS A** logged in user\
**IF** \
**I WANT** to view an interactive diagram of all domains and their context relationships, with relationship types shown as labelled directed edges and domain types (core, business, support, generic) visible as colours or shapes\
**SO THAT** I can see the full strategic architecture of the organisation at a glance and identify integration hotspots

---

## Batch 6 · Cross-domain translation links
*Very small flush: extends the existing `BusinessEntityRelationship` with a TRANSLATION type, adds a conflict-detection query. Can be done in a day. No dependencies.*

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

## Batch 7 · Domain events
*One backend flush: new `domain_events` table, M2M consuming-domains join table, process-link join table, CRUD endpoints, event section on domain detail, and an event flow diagram page. Self-contained — no dependencies.*

#### USER STORY 'Define domain event'
**AS AN** admin or process owner\
**IF** \
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
**IF** \
**I WANT** to see all domain events published by a domain and all events it consumes on the domain detail page\
**SO THAT** I understand the event-driven integration surface of that domain

#### USER STORY 'View domain event flow diagram'
**AS A** logged in user\
**IF** domain events are defined\
**I WANT** to view a diagram of all domains and the events flowing between them as directed labelled arrows\
**SO THAT** I can see the full asynchronous integration landscape and trace event-driven dependencies across the organisation

---

# Priority 3 — Active governance

---

## Batch 8 · Review cycles
*One backend flush: new `review_cycles` and `review_confirmations` tables, a scheduled job that computes due dates, review section on all detail pages, and an overdue-reviews admin page. Self-contained.*

#### USER STORY 'Define review cycle for a business entity'
**AS A** data owner or admin\
**IF** \
**I WANT** to set a review cycle (e.g. every 6 months, annually) on a business entity\
**SO THAT** the system knows when to prompt the data owner to confirm the entity's content is still accurate

#### USER STORY 'Define review cycle for a business process'
**AS A** process owner or admin\
**IF** \
**I WANT** to set a review cycle on a business process\
**SO THAT** the system knows when to prompt the process owner to confirm the process is still accurate

#### USER STORY 'Define review cycle for a business domain'
**AS AN** admin\
**IF** \
**I WANT** to set a review cycle on a business domain\
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

## Batch 9 · Watch & notifications
*One backend flush: new `watches` table, an event-dispatch pipeline, SMTP and Teams webhook integrations, notification settings UI. Depends on Batch 8 — overdue review notifications only make sense once review cycles exist.*

#### USER STORY 'Watch a business entity'
**AS A** logged in user\
**IF** \
**I WANT** to subscribe to change notifications for a specific business entity\
**SO THAT** I am notified whenever that entity is updated

#### USER STORY 'Watch a business process'
**AS A** logged in user\
**IF** \
**I WANT** to subscribe to change notifications for a specific business process\
**SO THAT** I am notified whenever that process is updated

#### USER STORY 'Watch a business domain'
**AS A** logged in user\
**IF** \
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
**I WANT** to configure Léargon to send email notifications to owners when a review is upcoming or overdue, and to watchers when an item they follow changes\
**SO THAT** owners are informed without having to check the application manually

#### USER STORY 'Configure Teams webhook notifications'
**AS AN** admin\
**IF** a Microsoft Teams webhook URL is configured\
**I WANT** to configure Léargon to post notifications to a Teams channel for upcoming reviews, overdue reviews, and watched item changes\
**SO THAT** teams can receive governance reminders within their existing communication tools

---

## Batch 10 · Entity inheritance & basic catalogue insights
*Pure read-only queries — no new tables. Results are computed on a configurable schedule (shared with Batch 15 scheduler) and stored as snapshots; the Insights page displays the last computed result with a timestamp, not a live query. One new "Insights" page in the frontend. No dependencies; data already exists.*

#### USER STORY 'Detect processes without a legal basis'
**AS AN** admin\
**IF** \
**I WANT** to see a list of all business processes that have no legal basis documented\
**SO THAT** I can identify gaps in the processing register before an audit or export

#### USER STORY 'View entity inheritance from linked processes'
**AS A** logged in user\
**IF** a business entity has child entities that are linked as inputs or outputs to processes\
**I WANT** to see the inherited input and output entities dynamically derived from the processes linked to the entity and its children\
**SO THAT** I can understand which data is consumed or produced by the broader entity hierarchy without manually tracing each process

#### USER STORY 'Detect entities without domain assignment'
**AS AN** admin\
**IF** \
**I WANT** to see a list of all business entities that are not assigned to any business domain\
**SO THAT** I can identify and resolve gaps in the domain model

#### USER STORY 'Detect processes without executing unit'
**AS AN** admin\
**IF** \
**I WANT** to see a list of all business processes that have no executing organisational unit assigned\
**SO THAT** I can identify unowned processes and assign clear accountability

#### USER STORY 'Detect domains with no entities'
**AS AN** admin\
**IF** \
**I WANT** to see a list of all business domains that have no business entities directly assigned to them\
**SO THAT** I can identify empty or underused domains that may be redundant or misconfigured

#### USER STORY 'Detect entities shared across multiple domains via processes'
**AS AN** admin\
**IF** \
**I WANT** to see which business entities are referenced as inputs or outputs in processes belonging to more than one domain\
**SO THAT** I can identify shared data objects that may indicate coupling between domains or candidates for extraction into a shared domain

#### USER STORY 'Detect processes executed by multiple organisational units'
**AS AN** admin\
**IF** \
**I WANT** to see which business processes are assigned to more than one executing organisational unit\
**SO THAT** I can identify potential coordination overhead, unclear ownership, or bottlenecks in cross-unit processes

---

# Priority 4 — Visualisation

---

## Batch 11 · All diagram views
*Frontend-heavy flush. All diagrams share the same technology stack (xyflow + dagre) and all read from existing data — no new tables. Ship as a single "Diagrams" section in the navigation.*

#### USER STORY 'View entity relationship diagram for a single entity'
**AS A** logged in user\
**IF** the business entity exists\
**I WANT** to view an ERD/class diagram starting from a single business entity, with configurable depth to show related entities and their relationship types and cardinalities\
**SO THAT** I can understand the connections and usage of a specific data object in context

#### USER STORY 'View entity relationship diagram for all entities'
**AS A** logged in user\
**IF** \
**I WANT** to view an ERD/class diagram showing all business entities and their relationships across the entire data landscape\
**SO THAT** I can get a holistic overview of all data objects and how they connect

#### USER STORY 'View entity diagram with domain layer'
**AS A** logged in user\
**IF** business entities are assigned to domains\
**I WANT** to toggle a domain layer in the entity diagram so that entities are grouped inside their assigned domain as a visual container\
**SO THAT** I can see both the data model and the domain structure simultaneously

#### USER STORY 'View process landscape diagram'
**AS A** logged in user\
**IF** \
**I WANT** to view a BPMN-style landscape showing all business processes, their hierarchy (parent/subprocess), and their input and output entities\
**SO THAT** I can see the complete process landscape of the organisation

#### USER STORY 'View process landscape with organisational unit layer'
**AS A** logged in user\
**IF** processes are assigned to executing organisational units\
**I WANT** to toggle an org unit layer in the process landscape so that processes are shown inside their executing organisational unit as a visual container\
**SO THAT** I can see which parts of the organisation are responsible for which processes

#### USER STORY 'View process landscape with domain layer'
**AS A** logged in user\
**IF** processes are assigned to business domains\
**I WANT** to toggle a domain layer in the process landscape so that processes are grouped inside their assigned domain as a visual container\
**SO THAT** I can see the process landscape segmented by domain

#### USER STORY 'Expand and collapse subprocesses in process landscape'
**AS A** logged in user\
**IF** a process has child processes\
**I WANT** to expand or collapse subprocesses within the process landscape diagram\
**SO THAT** I can focus on the level of detail that is relevant to my current analysis

#### USER STORY 'View org chart diagram'
**AS A** logged in user\
**IF** \
**I WANT** to view a hierarchical org chart diagram of all organisational units, showing the unit name, type, and lead user for each node\
**SO THAT** I can understand the reporting and containment structure of the organisation visually, not just as a flat list

#### USER STORY 'View process ownership overlay on org chart'
**AS A** logged in user\
**IF** processes are assigned to executing organisational units\
**I WANT** to toggle a process count overlay on the org chart so that each org unit node shows how many processes it executes\
**SO THAT** I can immediately see the workload distribution and identify over- or under-loaded units

#### USER STORY 'View data lineage for a business entity'
**AS A** logged in user\
**IF** the business entity is linked as an input or output to one or more processes\
**I WANT** to view the end-to-end data lineage for a business entity as a directed graph, showing which processes produce it, which consume it, and which other entities those processes in turn produce or consume\
**SO THAT** I can trace how data flows through the organisation from source to destination

#### USER STORY 'View lineage starting from a process'
**AS A** logged in user\
**IF** the process has linked input or output entities\
**I WANT** to view the lineage graph starting from a specific business process, traversing upstream to source entities and downstream to derived entities and processes\
**SO THAT** I can understand the full data dependency chain of a process

#### USER STORY 'Navigate from diagram to detail'
**AS A** logged in user\
**IF** a diagram element represents a business entity, process, domain, or organisational unit\
**I WANT** to click on any diagram element and navigate directly to its detail page\
**SO THAT** I can drill into specific elements without having to search for them separately

---

## Batch 12 · Quality check rules
*One backend flush: new `quality_rules` and `quality_check_results` tables, a rule evaluation engine that runs on a configurable schedule (shared with Batch 15 scheduler) and stores results — not computed on entity load. Rule management UI on entity detail, quality summary admin page. Self-contained.*

#### USER STORY 'Define quality check rule for a business entity'
**AS A** data owner or admin\
**IF** \
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

# Priority 5 — Advanced analytics

---

## Batch 13 · Impact analysis & domain coupling
*Analytics flush — graph traversal and aggregation queries on existing data. All scores and detections are computed on a configurable schedule (shared with Batch 15 scheduler) and stored as snapshots; results are displayed from the last run with a timestamp. New "Domain Analysis" section in the frontend. No new tables beyond snapshot storage. Depends on Batch 5 (context relationships add coupling signal).*

#### USER STORY 'View downstream impact of a business entity'
**AS A** logged in user\
**IF** the business entity is used in one or more processes\
**I WANT** to see a list of all processes, domains, and organisational units that directly or indirectly depend on a specific business entity\
**SO THAT** I can assess the blast radius before changing, splitting, or removing that entity

#### USER STORY 'View downstream impact of a business domain restructuring'
**AS AN** admin\
**IF** \
**I WANT** to see which processes, entities, org units, and context relationships would be affected if a business domain were merged with another, split, or removed\
**SO THAT** I can make informed domain redesign decisions without unintended consequences

#### USER STORY 'View domain dependency graph'
**AS AN** admin\
**IF** \
**I WANT** to view a weighted directed graph of all business domains where edges represent cross-domain entity references, with edge weight proportional to the number of shared references\
**SO THAT** I can see at a glance which domains are tightly or loosely coupled

#### USER STORY 'View coupling score between two domains'
**AS AN** admin\
**IF** \
**I WANT** to see the coupling score between any two selected domains, showing the number of shared entity references, published/consumed domain events, and context relationships\
**SO THAT** I can quantify how interdependent two domains are and decide whether the boundary between them is correctly drawn

#### USER STORY 'Detect highly coupled domain pairs'
**AS AN** admin\
**IF** \
**I WANT** to see a ranked list of domain pairs ordered by coupling score, highlighting pairs that exceed a configurable threshold\
**SO THAT** I can identify domains that may need to be merged, or where an explicit shared kernel or anti-corruption layer should be modelled in the context map

#### USER STORY 'Detect cross-domain term conflicts'
**AS AN** admin\
**IF** \
**I WANT** to see a list of business entities that share the same name across two or more domains but have no translation link defined between them\
**SO THAT** I can identify places where the same word means different things in different bounded contexts and decide whether to align the concepts or create an explicit translation link

#### USER STORY 'Detect high fan-in entities'
**AS AN** admin\
**IF** \
**I WANT** to see a list of business entities that are used as inputs or outputs in an unusually high number of processes across multiple domains, ranked by process count\
**SO THAT** I can identify hidden shared kernels, potential single points of failure, and entities that may need to be extracted into a dedicated shared domain

---

## Batch 14 · Team & org insights
*Analytics flush — aggregation and ratio queries on existing process-domain-orgunit relationships. All detections are computed on a configurable schedule (shared with Batch 15 scheduler) and stored as snapshots; results are displayed from the last run with a timestamp. New "Org Insights" section in the frontend. No new tables beyond snapshot storage. Depends on processes being assigned to both domains and org units.*

#### USER STORY 'View ownership workload per user'
**AS AN** admin\
**IF** \
**I WANT** to see a table of all users showing how many business entities, processes, and domains each user owns\
**SO THAT** I can identify over-burdened owners and redistribute ownership before items become neglected

#### USER STORY 'View ownership workload per organisational unit'
**AS AN** admin\
**IF** \
**I WANT** to see a table of all organisational units showing how many processes each unit executes\
**SO THAT** I can spot units that are executing a disproportionate number of processes and may be bottlenecks or overloaded

#### USER STORY 'Detect bottleneck teams'
**AS AN** admin\
**IF** \
**I WANT** to see a list of organisational units that execute processes spanning an unusually high number of distinct business domains, ranked by domain spread\
**SO THAT** I can identify teams that act as coordination bottlenecks by being involved in too many parts of the business landscape — a strong signal for team topology redesign

#### USER STORY 'Detect wrongly placed teams'
**AS AN** admin\
**IF** processes are assigned to both organisational units and business domains\
**I WANT** to see a list of organisational units where the majority of the processes they execute belong to a different domain than the domain most associated with that unit\
**SO THAT** I can identify teams whose work does not match their structural placement, suggesting a misalignment between the org chart and the domain model that should be resolved

#### USER STORY 'Detect split domains'
**AS AN** admin\
**IF** \
**I WANT** to see a list of business domains whose processes are distributed across an unusually high number of distinct organisational units, with no single unit owning a majority\
**SO THAT** I can identify domains that lack a clear team owner and are at risk of incoherent evolution due to distributed responsibility

#### USER STORY 'View Conway\'s Law alignment report'
**AS AN** admin\
**IF** processes are assigned to both organisational units and business domains\
**I WANT** to view a matrix comparing domain boundaries against organisational unit boundaries, highlighting where the two structures are aligned (one team, one domain) and where they diverge\
**SO THAT** I can apply Conway's Law reasoning to make conscious decisions about whether the org structure should follow the domain model or vice versa

---

## Batch 15 · Compliance metrics dashboard & company view
*Heavier flush: introduces the shared scheduler/job infrastructure that all previous analytics batches (10, 12, 13, 14) also depend on. Results for all analytics — quality checks, catalogue insights, coupling scores, team detections, and compliance metrics — are stored as timestamped snapshots and refreshed on this shared schedule. The company combined view is the largest diagram in the application. Ship together as a "Dashboard" release.*

#### USER STORY 'Configure analytics computation schedule'
**AS AN** admin\
**IF** \
**I WANT** to configure a global schedule (e.g. nightly, every 6 hours) on which Léargon recomputes all analytics — quality check results, catalogue insight detections, domain coupling scores, team alignment reports, and compliance metrics — and stores the results as a new snapshot\
**SO THAT** all insight pages and dashboards always reflect a recent state of the catalogue without requiring live queries on page load, and the computation load is predictable and controllable

#### USER STORY 'View last computed timestamp on insight pages'
**AS A** logged in user\
**IF** analytics are computed on a schedule\
**I WANT** to see when the displayed results were last computed on every insight, detection, and analytics page\
**SO THAT** I know how fresh the data is and can request a manual recomputation if needed before making an important decision

#### USER STORY 'Trigger manual analytics recomputation'
**AS AN** admin\
**IF** \
**I WANT** to trigger an immediate recomputation of all analytics outside the regular schedule\
**SO THAT** I can get up-to-date results before an audit, a presentation, or after a large batch of catalogue changes

#### USER STORY 'View catalogue completeness score'
**AS AN** admin\
**IF** mandatory fields are configured\
**I WANT** to see an overall catalogue completeness score showing the percentage of mandatory fields that are filled across all entities, processes, and domains\
**SO THAT** I have a single top-level indicator of data catalogue quality

#### USER STORY 'Define compliance metric'
**AS AN** admin\
**IF** \
**I WANT** to define a statistical compliance metric with a name, a calculation rule (e.g. percentage of entities with a retention period set), and a recalculation schedule (e.g. daily, weekly)\
**SO THAT** the metric is calculated automatically on a schedule and its trend can be tracked over time

#### USER STORY 'View compliance metrics dashboard'
**AS AN** admin\
**IF** at least one compliance metric is defined\
**I WANT** to view a dashboard showing the current value of each metric alongside its historical trend as a chart\
**SO THAT** I can assess catalogue completeness and compliance health at a glance and over time

#### USER STORY 'View company combined view'
**AS A** logged in user\
**IF** \
**I WANT** to see a combined view of entity–process, entity–domain, process–domain, and process–org unit relationships across the whole company\
**SO THAT** I can reflect on the relationships and dependencies of the entire data landscape

---

# Priority 6 — Nice to have

---

## Batch 16 · Stewards
*Adds a new permission layer across all four entity types — touches every service and detail page. Consistent but wide blast radius; ship as one complete feature.*

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

## Batch 17 · Full-text search
*Self-contained: add MySQL FULLTEXT indexes (or a search index), one search endpoint, one global search bar component. Can be done independently at any point.*

#### USER STORY 'Search across the catalogue'
**AS A** logged in user\
**IF** \
**I WANT** to type a keyword into a global search bar and see matching results across all business entities, processes, domains, and organisational units, with the matching text highlighted\
**SO THAT** I can quickly find any item in the catalogue without navigating through tree views or lists

#### USER STORY 'Filter search results'
**AS A** logged in user\
**IF** a search has returned results\
**I WANT** to filter the results by entity type, business domain, classification, or owner\
**SO THAT** I can narrow down large result sets to the subset that is relevant to my task

---

## Batch 18 · Import & integration
*Infrastructure-heavy flush: file upload handling, CSV parsing, column mapping UI, and a webhook receiver. Useful for initial catalogue seeding but not required for ongoing operation.*

#### USER STORY 'Import business entities from CSV'
**AS AN** admin\
**IF** \
**I WANT** to upload a CSV file and map its columns to business entity fields (name, description, domain, owner, classification values)\
**SO THAT** I can bulk-seed the entity catalogue from an existing data dictionary or spreadsheet without entering each entity manually

#### USER STORY 'Import organisational structure from CSV'
**AS AN** admin\
**IF** \
**I WANT** to upload a CSV file representing the org chart (unit name, type, parent unit, lead user) and have Léargon create or update the corresponding organisational units\
**SO THAT** the org structure can be seeded from an HR export rather than entered unit by unit

#### USER STORY 'Import business processes from CSV'
**AS AN** admin\
**IF** \
**I WANT** to upload a CSV file and map its columns to business process fields (name, description, domain, owner, type, executing unit)\
**SO THAT** I can bulk-seed the process catalogue from an existing process inventory

#### USER STORY 'Export full catalogue as machine-readable format'
**AS AN** admin\
**IF** \
**I WANT** to export the complete catalogue — entities, processes, domains, org units, and context relationships — as a structured JSON or CSV file\
**SO THAT** the catalogue can be consumed by other tools, backed up, or migrated to another instance

#### USER STORY 'Receive catalogue updates via webhook'
**AS AN** operator\
**IF** an external system (e.g. a data catalog, HR system, or schema registry) supports outbound webhooks\
**I WANT** to configure Léargon to receive catalogue updates from that system via a webhook endpoint, mapping the incoming payload to the corresponding entity or process fields\
**SO THAT** the Léargon catalogue stays in sync with authoritative external sources without manual re-entry
