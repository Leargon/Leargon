#### USER STORY 'Create inside my realm without a central team'
**AS A** domain owner, bounded-context owner, unit owner or item owner\
**IF** something is missing in the part of the catalogue I am responsible for\
**I WANT** to create it myself — a domain owner creates subdomains, bounded contexts and anything inside
them; a bounded-context owner creates entities, processes, domain events and context relationships in
their context; a unit owner creates sub-units and IT systems their unit owns; an item owner adds children
to their item\
**SO THAT** the catalogue grows where the knowledge is, without waiting for a central modelling team

#### USER STORY 'Not create in someone else's realm'
**AS A** domain or bounded-context owner\
**IF** I try to create or move an item into a domain, bounded context or unit I do not own\
**I WANT** the request to be refused (403), including moves (re-parenting, changing the bounded context
or, for unplaced items, the owning unit) that would pull an item into or out of someone else's realm\
**SO THAT** nobody can silently add to, or take over, an area another owner is accountable for
**Exception:** a DDD editor/lead may change an entity's or process's bounded context without creation rights
at the destination — assigning bounded contexts is DDD modelling work (their field-edit right on
`boundedContext` and the enforcement stay consistent, see the permission-matrix test).

#### USER STORY 'Keep top-level structure with the methodology editors'
**AS AN** admin\
**IF** someone without a methodology role tries to create a top-level domain, a top-level org unit, an
L1 capability, a service provider, or an entity/process that is not placed in any bounded context\
**I WANT** the request to be refused unless they are an admin or an editor/lead of the governing
methodology (DDD, TEAM_TOPOLOGIES, BCM, GDPR, DATA_GOVERNANCE, PROCESS_GOVERNANCE)\
**SO THAT** the strategic skeleton of the catalogue stays curated while the detail is decentralised

#### USER STORY 'Realm ownership does not spread through the org chart'
**AS A** department head who owns a parent org unit\
**IF** a team below my unit owns a bounded context\
**I WANT** my ownership to let me create sub-units, but not content in the team's bounded context\
**SO THAT** team autonomy (Team Topologies) is respected and I cannot widen my realm by linking a foreign
unit under mine — adding a parent to a unit requires rights on that parent

#### USER STORY 'Place entities and processes when DDD is not used'
**AS A** unit owner\
**IF** the DDD methodology is disabled in my organisation\
**I WANT** to create entities and processes that my unit owns, without a bounded context\
**SO THAT** decentralised creation also works for organisations that do not model domains

#### USER STORY 'Assign an owner to a domain or bounded context'
**AS A** domain owner or admin\
**IF** a domain or bounded context needs an accountable person\
**I WANT** to set an explicit owner, and otherwise see the inherited owner (owning unit's business
owner, else the parent domain's / domain's owner) marked as inherited\
**SO THAT** accountability is visible and flows down the domain tree consistently with entities and
processes

#### USER STORY 'Only see creation actions I am allowed to use'
**AS A** logged in user\
**IF** I look at a list or a detail page\
**I WANT** the "New", "Add child", "Add bounded context" and "Delete" actions to appear exactly when the
backend would accept them (backend-computed `creatableChildTypes`, `canDelete`, `canEdit`,
`/creation/capabilities`), and the creation wizards to offer only the bounded contexts I may create in
(`/creation/targets`)\
**SO THAT** I never start a creation that will be refused, and the frontend holds no permission logic

#### USER STORY 'Create an item completely in one step'
**AS A** realm owner\
**IF** I create an entity or process and delegate it to another owner\
**I WANT** everything the wizard collects — placement, owner, steward, custodian, classifications,
executing units, legal basis, purpose — to be stored in one atomic request\
**SO THAT** the item is complete even though I may no longer edit it once it belongs to someone else;
creating grants no edit rights

#### USER STORY 'Keep keys unique when names repeat'
**AS A** modeller\
**IF** I create an item whose name-derived key is already taken (e.g. the same process name in two
bounded contexts)\
**I WANT** the new item to receive a suffixed key (`-2`, `-3`, …) instead of failing\
**SO THAT** legitimately distinct items with equal names can coexist

#### USER STORY 'Require fields at creation'
**AS AN** admin or methodology lead\
**IF** my organisation needs certain information before an item may exist (e.g. a German name, a bounded
context, a legal basis)\
**I WANT** to mark a mandatory field as "required at creation" on the Methodologies screen — only for
fields the create request carries, and only within my methodology if I am a lead\
**SO THAT** creation is refused (422, naming the missing fields) until they are supplied, the wizard tells
the user up front, and the remaining mandatory fields become to-dos for the owner

#### USER STORY 'Not create a duplicate unintentionally'
**AS A** realm owner\
**IF** I am about to create an item whose name matches an existing one in the same container (same bounded
context or parent, sibling domain/unit/capability, or any IT system / service provider) — compared across
all locales, with spelling variants, umlauts and reordered words recognised, and numbers significant\
**I WANT** the wizard to warn me while I type and the backend to refuse the creation (409 with the
candidates) unless I acknowledge every candidate and justify why mine is different\
**SO THAT** the catalogue does not fill up with accidental duplicates, while legitimately different concepts
remain possible

#### USER STORY 'Link instead of duplicating across contexts'
**AS A** modeller\
**IF** the same term already exists in another bounded context\
**I WANT** to be allowed to create mine and be told that a translation link (entities) or reuse
(processes) may be the better choice\
**SO THAT** bounded contexts can use the same word for different concepts without being blocked

#### USER STORY 'Know what was created in my realm'
**AS A** domain, bounded-context, unit or item owner\
**IF** someone else creates an item in a container I own\
**I WANT** a "Review a new item created in your area" to-do showing who created it, under which grant and —
for a justified duplicate — the justification in my language, closed by acknowledging it\
**SO THAT** I stay in control of my area without having to approve every creation beforehand; the
acknowledgement survives later edits, follows a change of ownership, and only I (or an admin) can give it
