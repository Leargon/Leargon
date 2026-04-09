# Léargon Roadmap
*Ordered by value/effort score (value 1–10 ÷ sessions).*

*Sessions = remaining work (partially-implemented features are re-estimated from their current state).*

| Feature                                       | Sessions | Weekly | Value | Score    |
|-----------------------------------------------|----------|--------|-------|----------|
| Service provider data flow transparency       | 1        | 10%    | 8/10  | **8.0**  |
| Team Topologies                               | 2.5      | 25%    | 8/10  | **3.2**  |
| Value Stream Mapping (VSM)                    | 2.5      | 25%    | 7/10  | **2.8**  |
| Catalogue insights                            | 3        | 30%    | 8/10  | **2.7**  |
| Catalogue quality rules                       | 3        | 30%    | 7/10  | **2.3**  |
| Performance & scalability                     | 3        | 30%    | 7/10  | **2.3**  |
| Impact analysis & domain coupling             | 4        | 40%    | 8/10  | **2.0**  |
| Compliance metrics dashboard                  | 4        | 40%    | 8/10  | **2.0**  |
| DDD guided discovery                          | 4        | 40%    | 7/10  | **1.8**  |
| Import & integration                          | 4        | 40%    | 7/10  | **1.8**  |
| Watch & notifications                         | 4        | 40%    | 6/10  | **1.5**  |
| Review cycles                                 | 4        | 40%    | 6/10  | **1.5**  |
| Stewards                                      | 5        | 50%    | 7/10  | **1.4**  |
| Extended BPMN event types (Story 2b)          | 3        | 30%    | 6/10  | **2.0**  |

---

---

## Process effective entity roll-up

*Adds computed `effectiveInputEntities` and `effectiveOutputEntities` fields to the process API response. These aggregate the direct entity assignments of a process with those of all its descendant sub-processes (recursively). The directly assigned entities remain editable; the effective view is read-only and displayed alongside them. Requires an openapi.yaml change and a backend recursive query.*
*⏱ Sessions: 1.5 · Weekly effort: ~15% · Value: 8/10 · Score: 5.3*

#### USER STORY 'View effective data flow across a process hierarchy'
**AS A** logged in user\
**IF** a business process has sub-processes that each assign input and output entities\
**I WANT** to see the union of all input and output entities across the process and its entire sub-process hierarchy on the process detail panel\
**SO THAT** I understand the full data footprint of a process group without having to open each sub-process individually

#### USER STORY 'Compliance register uses effective entity roll-up'
**AS A** privacy officer\
**IF** a parent process has no directly assigned entities but its sub-processes collectively handle personal data\
**I WANT** the processing register and compliance exports to reflect the aggregated entity scope from all sub-processes\
**SO THAT** the register is complete and no processing activity is omitted from the Art. 30 / DSG Art. 12 record because entities were assigned only at sub-process level

#### USER STORY 'Warn when process hierarchy has no entity coverage'
**AS A** process owner or admin\
**IF** a process has no input or output entities directly assigned AND none of its sub-processes or linked call-activity processes define any entities either\
**I WANT** to see a warning on the process detail panel indicating that the data flow for this process is completely undocumented\
**SO THAT** processes with no entity coverage are surfaced as gaps rather than silently passing compliance checks with an empty data footprint

---

## Extended BPMN Event Types (Story 2b)

*Extends the custom BPMN editor with boundary events, extended start/end event types, intermediate throw events, and non-interrupting variants. The boundary event attachment UI is the hard part — requires hit-testing the task node border and rendering the event circle anchored to it. All other variants are enum additions on top of the Story 2 (Intermediate Events) infrastructure.*

*⏱ Sessions: 3 · Breakdown: 1 backend (enum extensions, DB migration for boundary attachment, BpmnExportService) + 2 frontend (boundary event attachment points on task border, start/end type selectors, non-interrupting dashed ring) · Value: 6/10 · Score: 2.0*

| Variant | Types | Notes |
|---------|-------|-------|
| **Start events** | Message, Timer, Signal, Conditional, Error, Escalation | Replace default plain Start |
| **End events** | Message, Terminate, Signal, Error, Escalation, Compensation | Replace default plain End |
| **Boundary events** | Timer, Message, Error, Escalation, Signal, Conditional, Compensation | Attached to Task/Sub-Process border |
| **Intermediate throw events** | Message, Signal, Escalation, Compensation, Link | Filled symbol (throw vs catch) |
| **Non-interrupting** | Timer, Message, Conditional (boundary + start) | Dashed circle border |

Requires extending the `EventDefinition` enum and `FlowNodeType` enum in `openapi.yaml` + a DB migration to support boundary event attachment (parent node reference on boundary event nodes).

#### USER STORY 'Replace plain Start Event with a typed start event'
**AS A** process modeller\
**IF** I am editing a process flow in the BPMN editor\
**I WANT** to click a replace button on the Start Event node and choose from Message, Timer, Signal, Conditional, Error, or Escalation start event types\
**SO THAT** the diagram accurately reflects the actual trigger mechanism of the process

#### USER STORY 'Replace plain End Event with a typed end event'
**AS A** process modeller\
**IF** I am editing a process flow in the BPMN editor\
**I WANT** to click a replace button on the End Event node and choose from Message, Terminate, Signal, Error, Escalation, or Compensation end event types\
**SO THAT** the diagram accurately reflects how the process concludes

#### USER STORY 'Attach a boundary event to a task or sub-process'
**AS A** process modeller\
**IF** I am editing a process flow and a Task or Sub-Process node is present\
**I WANT** to attach a boundary event (Timer, Message, Error, Escalation, Signal, Conditional, or Compensation) to the border of that node\
**SO THAT** I can model exception and error-handling paths anchored to the activity where they occur

#### USER STORY 'Mark a boundary or start event as non-interrupting'
**AS A** process modeller\
**IF** I am attaching a Timer, Message, or Conditional boundary event (or choosing a corresponding start event type)\
**I WANT** to mark it as non-interrupting, which renders the event circle with a dashed border\
**SO THAT** the diagram correctly distinguishes between events that cancel the host activity and events that run in parallel with it

---

## BPMN Sub-process Inline Expansion

*Inline expand/collapse of linked call-activity sub-processes directly inside the process BPMN diagram — no navigation away, no popup. The expanded sub-process content is rendered as a nested read-only plane within the same canvas; the parent diagram remains visible and navigable. Screenshots to be provided by user before implementation.*

*Also covers automatic element-type switching: a task element that gains a linked or child process is promoted to a sub-process shape; a sub-process whose linked process has no children and no diagram content is demoted back to a plain task. This keeps the visual model honest without manual shape replacement.*

#### USER STORY 'Expand sub-process inline in BPMN diagram'
**AS A** process modeller\
**IF** I am viewing a BPMN diagram that contains a call-activity element linked to another process\
**I WANT** to click an expand control on that call-activity and see the referenced sub-process diagram rendered inline, nested within the same canvas view, without leaving the page or opening a popup\
**SO THAT** I can read the full process flow — parent and child — in one continuous view without context-switching

#### USER STORY 'Collapse inline sub-process expansion'
**AS A** process modeller\
**IF** a sub-process is currently expanded inline in the BPMN canvas\
**I WANT** to click a collapse control on that expanded sub-process and have it shrink back to a compact call-activity shape\
**SO THAT** I can reduce visual noise and return to the high-level parent view without reloading the diagram

#### USER STORY 'Expand and collapse multiple sub-processes independently'
**AS A** process modeller\
**IF** a BPMN diagram contains more than one call-activity linked to different processes\
**I WANT** to expand and collapse each sub-process independently of the others\
**SO THAT** I can compare selected parts of the hierarchy side by side without being forced into a single drill-down path

#### USER STORY 'Automatically promote task to sub-process shape'
**AS A** process modeller\
**IF** a task element in the BPMN diagram has a `calledElement` linking it to a process that has child processes or its own BPMN diagram content\
**I WANT** the element to automatically display as a sub-process shape (collapsed, with the expand "+" marker) rather than a plain task box\
**SO THAT** the visual shape always reflects whether the linked process has navigable depth, without requiring a manual shape change

#### USER STORY 'Automatically demote sub-process to task shape'
**AS A** process modeller\
**IF** a call-activity sub-process shape links to a process that has no child processes and no BPMN diagram content\
**I WANT** the element to automatically display as a plain task shape instead of a sub-process shape\
**SO THAT** the diagram does not suggest navigable depth where none exists, keeping the model accurate

---

## BPMN Pools for IT Systems, Executing Units & Subcontractors

*Swim-lane pools in process BPMN diagrams to visualise which IT system, org unit, or external sub-processor is responsible for each task. Depends on IT Systems, Org Units, and Data Processors being linked to a process (already implemented). Requires design decision on pool assignment storage.*

#### USER STORY 'Show IT system lanes in BPMN diagram'
**AS A** process modeller\
**IF** one or more IT systems are linked to the process\
**I WANT** to see a BPMN swim-lane pool per IT system automatically added to the diagram canvas\
**SO THAT** I can assign tasks to the system that executes them and visualise the tool landscape inline with the process model

#### USER STORY 'Show executing unit lanes in BPMN diagram'
**AS A** process modeller\
**IF** one or more executing organisational units are assigned to the process\
**I WANT** to see a BPMN swim-lane pool per executing unit automatically added to the diagram canvas\
**SO THAT** the responsible team is visually associated with the tasks they own

#### USER STORY 'Show subcontractor lanes in BPMN diagram'
**AS A** process modeller\
**IF** one or more data processors (subcontractors) are linked to the process\
**I WANT** to see a BPMN swim-lane pool per data processor automatically added to the diagram canvas\
**SO THAT** tasks delegated to external processors are clearly separated from internally executed tasks

---

## Service provider data flow transparency
*Surfaces the data that flows to each external service provider — who the provider is, which processes use it, what entities are sent, and on what legal basis. Leverages the existing service provider model (type, linked processes, process entities). No new tables. Concrete compliance deliverable: DPA checklist, cross-border transfer register, and a machine-readable transparency summary per processor.*
*⏱ Sessions: 1 · Weekly effort: ~10% · Value: 8/10 · Score: 8.0*

**Data model note:** All building blocks already exist — `ServiceProvider` with type (`MANAGED_SERVICE`, `BODYLEASE`, `DATA_PROCESSOR`), `Process → ServiceProvider` links, `Process` input/output entities, `Process` legal basis and cross-border transfers.

#### USER STORY 'View data flow summary for a service provider'
**AS A** privacy officer or admin\
**IF** one or more processes are linked to a service provider\
**I WANT** to see, on the service provider detail page, a consolidated view of every process that uses this provider, which input and output entities are involved, and what the legal basis is for each process\
**SO THAT** I can immediately understand what data the company sends to this provider and why, without manually tracing each process individually

#### USER STORY 'View cross-border data flows via service providers'
**AS A** privacy officer\
**IF** a service provider is located in a country outside Switzerland or the EU/EEA\
**I WANT** to see a list of all data entities transferred to that provider via linked processes, grouped by transfer mechanism (SCCs, adequacy decision, derogation)\
**SO THAT** cross-border transfers are visible in one place for regulatory documentation and audit purposes (DSG Art. 16 / GDPR Art. 44)

#### USER STORY 'Data processor agreement checklist'
**AS AN** admin\
**IF** a service provider has type DATA_PROCESSOR\
**I WANT** to see a checklist on the provider's detail page verifying whether the key DPA elements are documented: contract reference, data categories covered, processing purpose, sub-processor list, and security measures\
**SO THAT** gaps in the processor agreement documentation surface immediately rather than during an audit

#### USER STORY 'Export service provider transparency summary'
**AS AN** admin\
**I WANT** to export a structured summary of all service providers with their linked processes, entity scope, legal basis, and transfer mechanism as a CSV or PDF\
**SO THAT** the full processor inventory can be handed to external auditors or included in the Art. 30 / DSG Art. 12 documentation package

---

## Personal dashboard
*Core implemented: home screen shows owned entities/processes (My Responsibilities), recent catalogue activity feed, needs-attention items, and governance maturity overview for admins. Remaining stories depend on Watch & notifications and Review cycles respectively.*

#### USER STORY 'View watchlist on dashboard'
**AS A** logged in user\
**IF** I have watched one or more items (Watch & notifications)\
**I WANT** to see a dedicated watchlist section on my dashboard showing all items I am following, with their last-modified date and a quick link to the detail page\
**SO THAT** I can monitor the items I care about from a single screen without navigating to each one individually

#### USER STORY 'View overdue and upcoming reviews on personal dashboard'
**AS A** data owner, process owner, or admin\
**IF** review cycles are configured and one or more of my owned items has a review that is overdue or due within the next 30 days\
**I WANT** to see a review-attention section on my dashboard split into overdue items (highlighted as urgent) and upcoming items (due soon), each showing the item name, type, and due date\
**SO THAT** I can act on overdue reviews immediately and plan ahead for reviews that are coming up shortly

---

---

## Catalogue insights
*Pure read-only queries — no new tables. Results are computed on a configurable schedule and stored as snapshots; the Insights page displays the last computed result with a timestamp, not a live query.*
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

#### USER STORY 'Detect processes with no entity coverage in hierarchy'
**AS AN** admin\
**I WANT** to see a list of business processes where neither the process itself nor any of its sub-processes has any input or output entities assigned\
**SO THAT** I can identify process trees with completely undocumented data flows and prioritise them for remediation

---

## Catalogue quality rules
*Rules about the completeness and correctness of metadata entered in Léargon — e.g. every entity must have a description, a data owner, and a classification assigned. Rules are evaluated live on the entity detail page; the admin summary uses pre-computed results from the scheduler. Self-contained.*
*⏱ Sessions: 3 · Weekly effort: ~30% · Value: 7/10 · Score: 2.3*

#### USER STORY 'Define catalogue quality rule for a business entity'
**AS A** data owner or admin\
**I WANT** to define a catalogue quality rule for a business entity, specifying a condition (a field must be filled, a classification must be assigned, or a relationship must exist)\
**SO THAT** the expected metadata completeness standard for that entity is formally documented and evaluated automatically

#### USER STORY 'View catalogue quality check results on entity detail'
**AS A** logged in user\
**IF** catalogue quality rules are defined for a business entity\
**I WANT** to see the pass/fail result of each rule on the entity detail page, evaluated live on load\
**SO THAT** I can immediately see which metadata gaps exist without waiting for a scheduled run

#### USER STORY 'View catalogue quality summary across all entities'
**AS AN** admin\
**I WANT** to see a summary of catalogue quality pass rates across all business entities, ranked by number of failing rules\
**SO THAT** I can identify which entities have the most outstanding metadata gaps and prioritise remediation

---

## Impact analysis & domain coupling
*Analytics flush — graph traversal and aggregation queries on existing data. All scores and detections are computed on a configurable schedule and stored as snapshots. Depends on context relationships for coupling signal.*
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

## Compliance metrics dashboard
*Scheduled computation of key governance and compliance metrics stored as timestamped snapshots. Results displayed on an admin metrics dashboard with trend history. Depends on Catalogue quality rules for full coverage.*
*⏱ Sessions: 4 · Weekly effort: ~40% · Value: 8/10 · Score: 2.0*

#### USER STORY 'Configure analytics computation schedule'
**AS AN** admin\
**I WANT** to configure a global schedule (e.g. nightly, every 6 hours) on which Léargon recomputes all catalogue quality scores and compliance metrics and stores the results as a new snapshot\
**SO THAT** all insight pages always reflect a recent state of the catalogue without requiring live queries on page load

#### USER STORY 'View last computed timestamp on insight pages'
**AS A** logged in user\
**IF** analytics are computed on a schedule\
**I WANT** to see when the displayed results were last computed on every insight and analytics page\
**SO THAT** I know how fresh the data is before making a decision

#### USER STORY 'Trigger manual analytics recomputation'
**AS AN** admin\
**I WANT** to trigger an immediate recomputation of all analytics outside the regular schedule\
**SO THAT** I can get up-to-date results before an audit or after a large batch of catalogue changes

#### USER STORY 'Define compliance metric'
**AS AN** admin\
**I WANT** to define a statistical compliance metric with a name and a calculation rule (e.g. percentage of entities with a retention period set, percentage of processes with a legal basis)\
**SO THAT** the metric is calculated automatically on a schedule and its trend can be tracked over time

#### USER STORY 'View compliance metrics dashboard'
**AS AN** admin\
**IF** at least one compliance metric is defined\
**I WANT** to view a dashboard showing the current value of each metric alongside its historical trend as a chart\
**SO THAT** I can assess catalogue completeness and compliance health at a glance and over time

#### USER STORY 'View catalogue completeness score'
**AS AN** admin\
**I WANT** to see an overall catalogue completeness score showing the percentage of mandatory fields filled across all entities, processes, and domains\
**SO THAT** I have a single top-level indicator of data catalogue quality

---

## DDD guided discovery
*Read-heavy analytics flush — no new tables. Léargon already holds the data needed to surface most of these insights: entity hierarchies, process-entity assignments, version histories, domain type fields, and org unit relationships. Each story produces an actionable suggestion with supporting evidence. Depends on context relationships and benefits from coupling scores.*
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
**IF** domain events are defined\
**I WANT** to see an analysis of which domains publish events consumed by many others (event sources, likely strong natural boundaries) and which domains only consume events without publishing (event sinks, potential merge candidates)\
**SO THAT** the event-driven coupling structure of the system corroborates or challenges the domain boundaries drawn on the context map

---

## Import & integration
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

## Watch & notifications
*One backend flush: new `watches` table, an event-dispatch pipeline, SMTP and Teams webhook integrations, notification settings UI.*
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

## Review cycles
*One backend flush: new `review_cycles` and `review_confirmations` tables, a scheduled job that computes due dates, review section on all detail pages, and an overdue-reviews admin page.*
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

## Stewards
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

## Performance & scalability

*Materialise expensive computed values into the database so that read paths stay fast as the catalogue grows. Recompute only when the relevant source data changes, using an event-driven invalidation strategy. Covers effective ownership chains, entity roll-ups on process hierarchies, governance maturity metrics, and compliance scores. No visible behaviour change for users beyond faster response times — except where stale indicators are shown.*
*⏱ Sessions: 3 · Weekly effort: ~30% · Value: 7/10 · Score: 2.3*

#### USER STORY 'Persist materialised effective ownership fields'
**AS A** developer\
**I WANT** the effective owner, steward, and technical custodian fields on `BusinessEntity` and `Process` to be stored as denormalised columns in the database, computed at write time rather than resolved by join traversal at read time\
**SO THAT** list and detail endpoints do not need to traverse the bounded-context → org-unit chain on every request, keeping response times constant as the catalogue grows

#### USER STORY 'Invalidate effective ownership on source change'
**AS A** developer\
**I WANT** an event listener that recomputes and persists the effective owner/steward/custodian for all affected entities and processes whenever an org unit's governance roles change, a bounded context's owning unit changes, or an entity's explicit owner is updated\
**SO THAT** the materialised values are always consistent with the latest source data without requiring a full-catalogue recomputation on every change

#### USER STORY 'Persist materialised effective entity roll-up on processes'
**AS A** developer\
**I WANT** the effective input and output entity sets for each process to be stored as a JSON snapshot in the database, computed at write time by recursively aggregating all sub-process assignments\
**SO THAT** the process detail panel and compliance export do not trigger recursive tree traversals on every load

#### USER STORY 'Invalidate effective entity roll-up on assignment change'
**AS A** developer\
**I WANT** an event listener that recomputes the effective entity roll-up for a process and all its ancestors whenever input or output entity assignments change on any process in the hierarchy\
**SO THAT** the roll-up snapshot is always up to date and no stale data reaches the compliance register

#### USER STORY 'Persist materialised governance maturity scores'
**AS A** developer\
**I WANT** the governance maturity metrics (entity ownership coverage, process compliance coverage, classification coverage, domain structure coverage, DPIA coverage) to be stored as a timestamped snapshot in the database, recomputed on a configurable schedule or triggered manually\
**SO THAT** the maturity overview on the home screen loads instantly from a pre-computed row rather than scanning the full catalogue on every page load

#### USER STORY 'Invalidate maturity snapshot on significant catalogue change'
**AS A** developer\
**I WANT** the maturity snapshot to be flagged as stale and a background recomputation to be queued whenever a significant catalogue event occurs (entity created or deleted, legal basis set, classification assigned, domain bounded context added)\
**SO THAT** the home screen reflects recent changes without waiting for the next scheduled recomputation cycle

#### USER STORY 'Show staleness indicator on computed views'
**AS A** logged in user\
**IF** a computed view (maturity overview, compliance metrics, catalogue insights) is displaying a snapshot that is older than a configurable threshold\
**I WANT** to see a subtle indicator showing when the snapshot was last computed and a "Recompute now" button (admin only)\
**SO THAT** I know whether the numbers reflect the current state of the catalogue or a recent-but-not-live snapshot

#### USER STORY 'Add database indexes for catalogue list queries'
**AS A** developer\
**I WANT** database indexes added for the most frequently filtered and sorted columns across all entity types (name locale value, domain key, process owner, legal basis, created/modified timestamps)\
**SO THAT** list endpoints with filters and sort orders remain sub-100 ms as catalogue size grows into the thousands of records

#### USER STORY 'Paginate catalogue list endpoints'
**AS A** developer\
**I WANT** all list endpoints (`/entities`, `/processes`, `/domains`, `/organisational-units`) to support cursor-based or offset pagination with a configurable page size\
**SO THAT** the API and frontend remain responsive when a catalogue contains thousands of items, rather than loading the entire collection into memory on every request

## Team Topologies
*Extends the existing organisational unit model with Team Topologies types and interaction modes — the social equivalent of the DDD context map. Each process in Léargon is a step in a value stream, and each org unit is a team. Adding team type and interaction records makes the team topology explicitly modelled alongside the technical topology, enabling cognitive load analysis and hand-off bottleneck detection. Requires one new `team_interactions` table; team type can use the existing classification system or a new enum field on OrganisationalUnit.*\
*⏱ Sessions: 2.5 · Weekly effort: ~25% · Value: 8/10 · Score: 3.2*

#### USER STORY 'Assign team topology type to an organisational unit'
**AS AN** architect or engineering manager\
**I WANT** to assign a Team Topologies type — Stream-aligned, Platform, Enabling, or Complicated Subsystem — to each organisational unit\
**SO THAT** the team's mission and expected interaction patterns are explicit and aligned with the Team Topologies model, making Conway's Law analysis more actionable

#### USER STORY 'Define interaction mode between two teams'
**AS AN** architect\
**IF** two organisational units collaborate on shared processes or bounded contexts\
**I WANT** to define a typed interaction record between them specifying the mode (Collaboration, X-as-a-Service, or Facilitating) and whether the interaction is temporary or ongoing\
**SO THAT** the social topology of the organisation is modelled alongside the technical context map as a complementary, equally explicit view

#### USER STORY 'Track interaction health'
**AS AN** engineering manager\
**IF** team interactions are defined\
**I WANT** to record a health indicator on each interaction — such as average handoff wait time or a qualitative score — and see interactions flagged when health degrades\
**SO THAT** overloaded interfaces and slow coordination points are visible before they become delivery bottlenecks

#### USER STORY 'View team interaction topology diagram'
**AS AN** architect\
**I WANT** to see a diagram of all organisational units and their defined interaction modes, rendered similarly to the DDD context map\
**SO THAT** the team topology and the technical context map can be read side by side as two complementary views of the same organisation

#### USER STORY 'View cognitive load score per team'
**AS AN** architect or manager\
**I WANT** to see a computed cognitive load score for each organisational unit, calculated from the number of bounded contexts owned, capabilities owned, and active value streams handled — with a warning when the score exceeds a configurable threshold\
**SO THAT** teams at risk of cognitive overload are identified before their scope needs to be split or reduced

#### USER STORY 'Detect mismatched interaction modes'
**AS AN** architect\
**IF** two Stream-aligned teams interact via Collaboration rather than X-as-a-Service\
**I WANT** Léargon to surface this as a potential bottleneck, since sustained Collaboration between two Stream-aligned teams is a Team Topologies anti-pattern that reduces autonomy and increases cognitive load\
**SO THAT** interaction anti-patterns are identified and can be addressed — either by formalising an X-as-a-Service boundary or by consolidating the teams

---

## Value Stream Mapping (VSM)
*Adds lean/VSM metadata to the existing process model. Each Léargon process represents one step in a value stream. Adding cycle time, wait time, activity classification, and frequency to processes enables end-to-end lead time calculation and waste identification without any new entity types — only new fields on Process and a VSM summary view. A process is classified at the stream level (Enabling / Operational / Business Support) and at the activity level (Value-Adding, Business Value-Added, or Waste), with a free-text justification that answers the transformation, customer, error, and necessity checks.*\
*⏱ Sessions: 2.5 · Weekly effort: ~25% · Value: 7/10 · Score: 2.8*

#### USER STORY 'Classify a process as a value stream type'
**AS A** lean practitioner or operations manager\
**I WANT** to classify each business process as one of three value stream types: Enabling (prerequisite — removes barriers for the main stream), Operational (revenue-generating, directly customer-facing), or Business Support (internal services)\
**SO THAT** the value stream portfolio is visible, each process's strategic role is explicit, and lean improvement efforts can be focused on the highest-leverage streams first

#### USER STORY 'Record time metadata on a process'
**AS A** process analyst\
**IF** I am documenting a process\
**I WANT** to record the average cycle time (CT — actual processing time), wait time (WT — average queue time before the step begins), and changeover time (CO — setup time between instances) on a process\
**SO THAT** end-to-end lead time, process efficiency ratio (VA time ÷ total lead time), and queue-to-work ratios can be computed across a value stream

#### USER STORY 'Record process frequency'
**AS A** process analyst\
**IF** I am documenting a process\
**I WANT** to record how many instances of the process run per day / week / month / year\
**SO THAT** throughput, takt time, and cumulative wait time at scale can be derived, and bottleneck steps with high volume and high wait time can be identified

#### USER STORY 'Classify process activity type and justify it'
**AS A** lean practitioner\
**IF** I am analysing process efficiency\
**I WANT** to classify each process step as Value-Adding (VA — directly transforms the product or information for the customer), Business Value-Added (BVA — necessary but not directly valuable to the customer, e.g. compliance checks, legal documentation), or Waste (Muda — can be eliminated, e.g. rework, redundant data entry, waiting without purpose) with a free-text justification\
**SO THAT** non-value-adding activities are explicit, improvement candidates are prioritised by waste category, and the classification decision is traceable

#### USER STORY 'Record quality metrics on a process'
**AS A** process analyst\
**I WANT** to record the First Pass Yield (FPY %) — the percentage of process instances completed correctly on the first attempt without rework — and a completion rate on a process\
**SO THAT** processes with quality defects are visible in the value stream summary and can be targeted for root cause analysis before they inflate downstream rework waste

#### USER STORY 'View value stream summary across processes'
**AS A** lean practitioner or operations manager\
**IF** processes are documented with time metadata, activity classifications, and frequency\
**I WANT** to see a value stream summary view showing: total lead time (sum of CT + WT across a process chain), value-adding ratio (VA time ÷ total lead time), and a breakdown of activity types across the stream\
**SO THAT** I can identify the biggest improvement opportunities — steps with high wait time, low FPY, or Waste classification — and measure improvement over time as metadata is refined

---

## Localise all remaining free-text fields

*All user-visible text fields that are currently plain `String` / `varchar` columns should become `LocalizedText[]` (JSON-stored lists), consistent with the pattern already used for `names`, `descriptions`, `purpose`, and `securityMeasures`. Existing values are migrated to the system default locale. The change touches openapi.yaml, domain entities, Liquibase migrations, mappers, services, and the frontend editor components.*

*⏱ Sessions: 3 · Weekly effort: ~30% · Value: 7/10 · Score: 2.3*

**Fields in scope** (plain `String` today → `LocalizedText[]` after):

| Entity | Field | DB column |
|--------|-------|-----------|
| `BusinessDomain` | `visionStatement` | `vision_statement` |
| `BusinessEntity` | `retentionPeriod` | `retention_period` |
| `ContextRelationship` | `description` | `description` |
| `TranslationLink` | `semanticDifferenceNote` | `semantic_difference_note` |
| `Dpia` | `riskDescription` | `risk_description` |
| `Dpia` | `measures` | `measures` |
| `Dpia` | `fdpicConsultationOutcome` | `fdpic_consultation_outcome` |
| `CrossBorderTransfer` | `notes` | `notes` |
| `Process` | `legalBasis` | `legal_basis` |
| `ProcessFlowNode` | `label` | `label` |
| `ProcessFlowTrack` | `label` | `label` |
| `BusinessDataQualityRule` | `description` | `description` |

**Migration strategy per field:**
1. Add a new `TEXT` column (e.g. `vision_statement_i18n`) storing JSON.
2. Migrate existing values: `UPDATE … SET vision_statement_i18n = JSON_ARRAY(JSON_OBJECT('locale', <defaultLocale>, 'text', vision_statement)) WHERE vision_statement IS NOT NULL`.
3. Drop the old column.
4. Rename the new column to the original name.

All migrations run via Liquibase and apply automatically on startup.

#### USER STORY 'Localise the domain vision statement'
**AS A** data governance manager\
**IF** I am editing a business domain in a multilingual organisation\
**I WANT** to enter the vision statement in each active language using the standard translation editor\
**SO THAT** domain vision is readable in the viewer's preferred language rather than always appearing in the language it was first written in

#### USER STORY 'Localise the entity retention period'
**AS A** privacy officer\
**IF** I am documenting the retention period of a business entity in a multilingual organisation\
**I WANT** to enter the retention period description in each active language using the standard translation editor\
**SO THAT** retention policies are understandable to staff in all supported languages without requiring manual translation outside the system

#### USER STORY 'Localise context relationship descriptions'
**AS A** domain architect\
**IF** I am documenting the relationship between two bounded contexts\
**I WANT** to enter the relationship description in each active language\
**SO THAT** the context map annotations are accessible to all stakeholders regardless of their preferred language

#### USER STORY 'Localise translation link semantic difference notes'
**AS A** domain architect\
**IF** I am documenting a translation link between two entities in different bounded contexts\
**I WANT** to enter the semantic difference note in each active language\
**SO THAT** the explanation of the conceptual difference between the two entities is understandable to all team members

#### USER STORY 'Localise DPIA narrative fields'
**AS A** privacy officer\
**IF** I am conducting a Data Protection Impact Assessment in a multilingual organisation\
**I WANT** to enter the risk description, proposed measures, and FDPIC consultation outcome in each active language\
**SO THAT** the DPIA documentation meets regulatory requirements in all relevant jurisdictions and is reviewable by local stakeholders

#### USER STORY 'Localise cross-border transfer notes'
**AS A** privacy officer\
**IF** I am documenting a cross-border data transfer with additional context\
**I WANT** to enter the transfer notes in each active language\
**SO THAT** the notes are meaningful to reviewers who read documentation in different languages

#### USER STORY 'Localise the process legal basis'
**AS A** privacy officer\
**IF** I am documenting the legal basis of a business process under GDPR or DSG\
**I WANT** to enter the legal basis text in each active language\
**SO THAT** the documented basis is understandable across jurisdictions and internal reviewers can read it in their preferred language

#### USER STORY 'Localise BPMN node and lane labels'
**AS A** process modeller\
**IF** I am labelling a task, gateway, event, or swimlane in the BPMN diagram editor\
**I WANT** to enter the label in each active language\
**SO THAT** the diagram is readable to all stakeholders regardless of their preferred language, consistent with all other catalogue text

#### USER STORY 'Localise data quality rule descriptions'
**AS A** data steward\
**IF** I am documenting a quality rule on a business entity\
**I WANT** to enter the rule description in each active language\
**SO THAT** quality rules are understandable to data consumers in all supported languages

#### USER STORY 'Migrate all existing free-text values to the default locale'
**AS AN** administrator upgrading Léargon to the localised free-text version\
**IF** the system already contains vision statements, retention periods, legal bases, and other plain-text values entered before this feature existed\
**I WANT** the upgrade migration to automatically preserve all existing text by associating it with the system default locale\
**SO THAT** no information is lost during the upgrade and the system continues to display all previously entered content without any manual re-entry
