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

## 3. Domains vs Bounded Contexts — Architectural Gap

**Theoretical position:** In strict DDD, entity and process ownership belongs to **Bounded Contexts**, not Domains or Subdomains. A Bounded Context is a linguistic boundary — everything inside shares the same Ubiquitous Language; the same term may mean something different outside.

**Current Léargon state:** `BusinessDomain` conflates Subdomain and Bounded Context into a single concept. Entities and processes are assigned to `BusinessDomain`, which acts as both a subdomain classification and a context boundary.

**Why this is acceptable for now:** For a governance tool that models an organisation's data landscape (rather than implementing the bounded contexts as software), this simplification is pragmatic. The domain hierarchy gives enough structure for the processing register, Conway Law analysis, and ContextMapper visualisation.

**Future direction:** If Léargon needs to model the software architecture more precisely — for example, to highlight where a term means different things in two parts of the system — a separate `BoundedContext` entity could be introduced. Entities and processes would then belong to a `BoundedContext`, which in turn belongs to a `BusinessDomain`. The ContextMapper relationships (`ContextRelationship`) already point in this direction. This is a candidate for Batch 20.

---

## 4. ContextMapper DSL — `BoundedContext` vs `Subdomain`

In the [ContextMapper DSL](https://contextmapper.org/docs/language-reference/), the top-level building blocks are:

| DSL keyword | Concept |
|---|---|
| `BoundedContext` | A named linguistic boundary; has a `type` (`TEAM`, `APPLICATION`, `SYSTEM`, `FEATURE`, `SHARED_KERNEL`) |
| `Subdomain` | A problem-space slice; has a `type` (`CORE_DOMAIN`, `SUPPORTING_DOMAIN`, `GENERIC_SUBDOMAIN`) |
| `ContextMap` | The relationships between `BoundedContext` instances |

The `TEAM`, `APPLICATION`, `SYSTEM`, `FEATURE`, `SHARED_KERNEL` types all qualify **`BoundedContext`** — not `Subdomain`. A `TEAM` context means the context corresponds to a team's ownership boundary. A `SUBDOMAIN` in the DSL is explicitly a separate construct for the problem space.

**In Léargon's `.cml` export** (`/export/context-map`): `BusinessDomain` instances are emitted as `BoundedContext` with `type = FEATURE` (a reasonable default given the current conflation). If Léargon later introduces true `BoundedContext` entities, those would map to the `BoundedContext` keyword directly, and `BusinessDomain` would map to `Subdomain`.

---

## Summary Table

| Léargon concept | DDD term | Notes |
|---|---|---|
| `BusinessDomain` (type=BUSINESS) | Domain | Top-level problem area |
| `BusinessDomain` (type=CORE/SUPPORT/GENERIC) | Subdomain | Slice of the domain |
| `BusinessDomain` (any) | Bounded Context (approximate) | Current simplification |
| `BusinessEntity` | Domain Object / Aggregate Root candidate | The nouns of Ubiquitous Language |
| `Process` | Domain Event / Use Case | The verbs of Ubiquitous Language |
| Mandatory field checks | Invariants | Machine-readable domain rules |
| `ContextRelationship` | Context Map relationship | Upstream/downstream, typed by Evans/Hohpe patterns |
