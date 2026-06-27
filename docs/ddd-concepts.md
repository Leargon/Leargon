# DDD Concepts in Léargon

This document records validated design decisions and conceptual mappings between Domain-Driven Design theory and the Léargon data model. These are settled — do not reopen without a concrete technical reason.

---

## 1. Domain vs Subdomain — Mapping to `BusinessDomain`

**Evans' terminology:**

| Evans term | Meaning |
|---|---|
| **Domain** | The entire problem space the business operates in (e.g. "Insurance") |
| **Subdomain** | A coherent slice of that domain — `Core`, `Supporting`, or `Generic` |

**Léargon mapping:**

| `BusinessDomain.type` | Maps to |
|---|---|
| `BUSINESS` | Evans' **Domain** — the top-level business area |
| `CORE` | Evans' **Core Subdomain** — the competitive differentiator |
| `SUPPORT` | Evans' **Supporting Subdomain** — necessary but not differentiating |
| `GENERIC` | Evans' **Generic Subdomain** — commodity capability (buy/outsource) |

`BUSINESS` domains act as the root of a domain hierarchy. `CORE`/`SUPPORT`/`GENERIC` domains are subdomains nested beneath them.

---

## 2. Ubiquitous Language in Léargon

Ubiquitous Language is the shared vocabulary used by domain experts and engineers within a Bounded Context. In Léargon it is composed of two layers:

- **Nouns = Business Entities** — the domain objects (data categories, systems, artefacts). Their names, relationships, and classifications define the vocabulary of things.
- **Verbs = Business Processes** — what the business does with those entities. Process names, purposes, and legal bases define the vocabulary of actions.

**Invariants and quality rules:** The mandatory-field configuration and completeness checks on entities and processes are not just UI hints — they encode domain invariants. A `CORE` process without a legal basis or purpose is semantically incomplete; the system makes that visible. These quality statements are the machine-readable form of "what must always be true" for an entity or process in this context.

---

## 3. Domains vs Bounded Contexts

**Theoretical position:** In strict DDD, entity and process ownership belongs to **Bounded Contexts**, not Domains or Subdomains. A Bounded Context is a linguistic boundary — everything inside shares the same Ubiquitous Language; the same term may mean something different outside.

**Current Léargon state:** `BoundedContext` is a first-class entity (`domain/BoundedContext.kt`, table `bounded_contexts`). Each Bounded Context belongs to a `BusinessDomain` (`boundedContext.domain`) and carries a `contextType` (see §4). `BusinessEntity` and `Process` are assigned to a `BoundedContext` (`businessEntity.boundedContext`, `process.boundedContext`), which gives them their canonical meaning; effective ownership falls back through `boundedContext.owningUnit → boundedContext.domain.owningUnit`. Context relationships (`ContextRelationship`) connect bounded contexts directly via `upstreamBoundedContext` / `downstreamBoundedContext`.

**Why this layering:** Domains (and their `CORE`/`SUPPORT`/`GENERIC` subdomains) describe the *problem space*; Bounded Contexts describe the *linguistic/solution boundary* nested beneath a domain. This separation lets the processing register, Conway's-Law analysis, and the ContextMapper export reason about contexts precisely rather than conflating them with subdomains.

---

## 4. ContextMapper DSL — `BoundedContext` vs `Subdomain`

In the [ContextMapper DSL](https://contextmapper.org/docs/language-reference/), the top-level building blocks are:

| DSL keyword | Concept |
|---|---|
| `BoundedContext` | A named linguistic boundary; has a `type` (`TEAM`, `APPLICATION`, `SYSTEM`, `FEATURE`, `SHARED_KERNEL`) |
| `Subdomain` | A problem-space slice; has a `type` (`CORE_DOMAIN`, `SUPPORTING_DOMAIN`, `GENERIC_SUBDOMAIN`) |
| `ContextMap` | The relationships between `BoundedContext` instances |

The `TEAM`, `APPLICATION`, `SYSTEM`, `FEATURE`, `SHARED_KERNEL` types all qualify **`BoundedContext`** — not `Subdomain`. A `TEAM` context means the context corresponds to a team's ownership boundary. A `SUBDOMAIN` in the DSL is explicitly a separate construct for the problem space.

**In Léargon's `.cml` export** (`ExportService`, `/export/context-map`): the real `BoundedContext` entities are emitted as ContextMapper `BoundedContext` blocks (their `contextType` maps to the DSL `type`), grouped under their owning `BusinessDomain`, which is emitted as a `Subdomain`. Context relationships are rendered on the `ContextMap` from the typed `ContextRelationship` upstream/downstream pairs.

---

## Summary Table

| Léargon concept | DDD term | Notes |
|---|---|---|
| `BusinessDomain` (type=BUSINESS) | Domain | Top-level problem area |
| `BusinessDomain` (type=CORE/SUPPORT/GENERIC) | Subdomain | Slice of the domain |
| `BoundedContext` | Bounded Context | First-class entity nested under a `BusinessDomain`; entities & processes are assigned to it |
| `BusinessEntity` | Domain Object / Aggregate Root candidate | The nouns of Ubiquitous Language |
| `Process` | Domain Event / Use Case | The verbs of Ubiquitous Language |
| Mandatory field checks | Invariants | Machine-readable domain rules |
| `ContextRelationship` | Context Map relationship | Upstream/downstream, typed by Evans/Hohpe patterns |
