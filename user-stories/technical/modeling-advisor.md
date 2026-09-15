#### USER STORY 'Ask where a new concept belongs and get a recommendation'
**AS A** data owner or modeller\
**IF** I am about to add something and am unsure how to structure it\
**I WANT** to open a "Not sure where this belongs?" advisor, answer a few guided questions (a deterministic,
server-defined decision tree — not an LLM) and pick the related existing items\
**SO THAT** I receive a concrete recommendation — child entity, separate entity with a relationship,
interface/implementation, sub-process, new processing activity, subdomain, bounded context, sub-unit or
sub-capability — with a plain-language rationale

#### USER STORY 'Understand the downstream consequence of a modelling choice'
**AS A** data owner or modeller\
**IF** the advisor recommends a structure\
**I WANT** to see what that choice affects, computed from live data — e.g. that a child entity is rolled up
under its root entity as one data category in the Art. 30 register, that a sub-process rolls up into the
register row of its root process, that a new root process becomes its own processing activity, who will be
the resulting owner, or that linking across bounded contexts calls for a context relationship\
**SO THAT** I decide knowing the compliance and reporting impact instead of discovering it later

#### USER STORY 'Decide between a child entity and a new root entity with a relationship'
**AS A** modeller\
**IF** the new concept is connected to an existing business entity\
**I WANT** the advisor to ask, naming that entity, (1) whether the new concept ceases to exist when it is
deleted, (2) whether it is identified or looked up on its own and (3) whether it needs its own owner,
steward, classification or retention — and to recommend a **child entity** only when it shares all three,
otherwise a **new root entity with a relationship** (asking how many of it one entity can have), with the
rationale assembled from my answers\
**SO THAT** nesting reflects real aggregate parts instead of every loosely connected concept, and the
processing register rolls up only what truly belongs together

**Acceptance:** lifecycle yes + identity no + responsibility no → CHILD_AGGREGATE (placed under the entity,
rationale lifecycleBound / noOwnIdentity / sharedResponsibility); any other answer → cardinality question →
ROOT_WITH_RELATIONSHIP (same bounded context as the entity, prefill carries the relationship with cardinalities
one: new 0..1 / entity 1..1, many: new 0..* / entity 1..1, many-to-many: 0..* / 0..*). A kind of a more
general concept still leads to an interface/implementation link.

#### USER STORY 'Create the root entity and its relationship in one step'
**AS A** modeller or realm owner\
**IF** the advisor recommends a new root entity with a relationship\
**I WANT** the creation wizard to show that relationship with editable cardinalities, and the entity and the
relationship to be created in the same request (`relationships` on `POST /business-entities`)\
**SO THAT** the pair never exists half-done and it works even when I delegate ownership of the new entity
(a separate relationship request would then be refused)

**Negative:** an unknown related entity → 404 and nothing created; an impossible cardinality (minimum < 0,
maximum < minimum or 0) → 400; a blocked duplicate (409) or a refused placement (403) creates no relationship.

#### USER STORY 'Get placement guidance for processes'
**AS A** process modeller\
**IF** I am adding a business activity\
**I WANT** the advisor to ask whether it is a step of a larger process, whether it has its own trigger or
purpose (legal basis), and whether it is reused by several processes, and to recommend sub-process,
new root processing activity or a reusable process accordingly\
**SO THAT** the process hierarchy reflects real decomposition and each root process is one meaningful
processing activity in the register

#### USER STORY 'Get placement guidance for domains, bounded contexts, units and capabilities'
**AS A** domain owner, unit owner or capability owner\
**IF** I am adding a domain, a bounded context, an organisational unit or a capability\
**I WANT** the advisor to distinguish a new business area, a sub-area of an existing domain and a team's
model boundary (bounded context), a top-level unit and a sub-unit, an L1 capability and a refinement\
**SO THAT** the domain tree, the org chart and the capability map stay coherent

#### USER STORY 'Only be offered what I may do'
**AS A** logged in user\
**IF** the advisor recommends a place I am not allowed to create in\
**I WANT** the recommendation to say so and name the owner who is responsible for that place\
**SO THAT** I ask the right person instead of hitting a refusal

#### USER STORY 'Ask the advisor inside every creation wizard, only when unsure'
**AS A** user creating an entity, process, domain, organisational unit or capability — via "New" (root) or
"Add child / sub-process / subdomain" (sub)\
**IF** the creation wizard or dialog opens\
**I WANT** a collapsed "Not sure where this belongs?" panel at its top that I can expand to answer the advisor's
questions — started from "Add child" with the questions about that item (`contextItemKey`: the server applies
the rule set's context answers and answers every picker of the item's type with it) — and an allowed
recommendation to fill in the wizard's placement: parent, bounded context, the relationship (editable
cardinalities) or interface link for entities; a recommended bounded context from the domain wizard opens
"Add bounded context" on that domain\
**SO THAT** the decision is available at the moment of creation without making the wizard bigger
**Details:** collapsed, the panel header shows the recommendation it applied; a recommendation outside my
realm says whom to ask and changes nothing; the wizard title follows the decision (child ↔ root).
**Negative:** `contextItemKey` that is not an item of the rule set's start type → 400.

#### USER STORY 'Be warned about likely duplicates while being advised'
**AS A** modeller\
**IF** the name I intend to use already exists at the recommended place or elsewhere\
**I WANT** the advisor to show those candidates (and suggest a translation link when the same term lives in
another bounded context)\
**SO THAT** I reuse or link the existing concept instead of duplicating it

#### USER STORY 'Administer the advisor decision rules' — DEFERRED
**AS AN** admin\
**IF** my organisation's modelling conventions differ from the defaults\
**I WANT** to view and adjust the advisor's decision rules and explanation wording per methodology\
**SO THAT** the guidance matches our house rules\
*Deferred: v1 ships fixed, code-defined rule sets.*
