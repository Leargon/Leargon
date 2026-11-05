# Methodology → Field & Navigation Mapping

Léargon has seven methodologies: `DATA_GOVERNANCE`, `PROCESS_GOVERNANCE`, `GDPR`, `DDD`, `BCM`,
`TEAM_TOPOLOGIES` and `LEAN`. Each methodology controls which fields are visible on detail panels and
wizards, which sections appear in Field Configuration, which to-do rules run, which sidebar navigation
items are shown, and which fields its `ROLE_EDITOR_<M>` / `ROLE_LEAD_<M>` holders may edit.
Disabling a methodology hides all listed items.

Fields marked with `(locale)` expand to one entry per active locale (e.g. `descriptions.en`, `descriptions.de`).
Fields marked with `(classKey)` expand to one entry per configured classification.

**Maturity levels:** Basic → Advanced → Expert (progressive disclosure; use presets on the Methodology settings page to apply a tier in one click).

**Required at creation:** a mandatory field can additionally be flagged *required at creation*; the create
endpoint then rejects requests without it (422). Only fields the create request carries qualify — for business
entities `names`, `descriptions`, `dataOwner`, `dataSteward`, `technicalCustodian`, `boundedContext`,
`retentionPeriod`, `classification`; for processes `names`, `descriptions`, `processType`, `code`,
`processOwner`, `processSteward`, `technicalCustodian`, `inputEntities`, `outputEntities`, `executingUnits`,
`legalBasis`, `purpose`, `boundedContext`, `classification`.

---

## DATA_GOVERNANCE

**Purpose:** Track data ownership, stewardship, descriptions, retention, storage, classifications, quality rules and data model structure on Business Entities.

### Business Entity
| Field                         | Section         | Maturity |
|-------------------------------|-----------------|----------|
| `descriptions.(locale)`       | CORE            | Basic    |
| `dataOwner`                   | CORE            | Basic    |
| `owningUnit`                  | CORE            | Basic    |
| `dataSteward`                 | CORE            | Advanced |
| `technicalCustodian`          | CORE            | Advanced |
| `retentionPeriod.(locale)`    | DATA_GOVERNANCE | Basic    |
| `storageLocations`            | DATA_GOVERNANCE | Basic    |
| `classification.(classKey)`   | DATA_GOVERNANCE | Basic    |
| `interfaceEntities`           | DATA_GOVERNANCE | Advanced |
| `implementationEntities`      | DATA_GOVERNANCE | Advanced |
| `relationships`               | DATA_GOVERNANCE | Advanced |
| `qualityRules`                | DATA_QUALITY    | Advanced |

### Navigation items hidden when disabled
| Path        | Label         |
|-------------|---------------|
| `/entities` | Data Ontology |

---

## PROCESS_GOVERNANCE

**Purpose:** Manage process descriptions, ownership, stewardship, data flow relationships, and process diagrams.

### Business Process
| Field                   | Section   | Maturity |
|-------------------------|-----------|----------|
| `descriptions.(locale)` | CORE      | Basic    |
| `processOwner`          | CORE      | Basic    |
| `owningUnit`            | CORE      | Basic    |
| `processType`           | CORE      | Basic    |
| `code`                  | CORE      | Basic    |
| `processSteward`        | CORE      | Advanced |
| `technicalCustodian`    | CORE      | Advanced |
| `inputEntities`         | DATA_FLOW | Basic    |
| `outputEntities`        | DATA_FLOW | Basic    |
| `executingUnits`        | DATA_FLOW | Basic    |
| `processDiagram`        | DATA_FLOW | Advanced |

### Navigation items hidden when disabled
| Path         | Label       |
|--------------|-------------|
| `/processes` | Process Map |

---

## GDPR

**Purpose:** Personal data, legal basis, purpose, security measures, cross-border transfers, IT systems, service providers, and DPIA registers.

### Business Entity
| Field                  | Section | Maturity |
|------------------------|---------|----------|
| `containsPersonalData` | GDPR    | Basic    |
| `entityRole`           | GDPR    | Basic    |

### Business Process
| Field                       | Section | Maturity |
|-----------------------------|---------|----------|
| `legalBasis`                | GDPR    | Basic    |
| `purpose.(locale)`          | GDPR    | Basic    |
| `securityMeasures.(locale)` | GDPR    | Advanced |
| `crossBorderTransfers`      | GDPR    | Advanced |
| `itSystems`                 | GDPR    | Advanced |
| `serviceProviders`          | GDPR    | Expert   |

### Navigation items hidden when disabled
| Path                 | Label               |
|----------------------|---------------------|
| `/compliance`        | Processing Register |
| `/dpia`              | DPIA Register       |
| `/it-systems`        | IT Systems          |
| `/service-providers` | Service Providers   |

---

## DDD

**Purpose:** Bounded contexts, ubiquitous language, context map, domain events, strategic vision.
Also controls Business Domain — domains are a DDD construct.

### Business Entity
| Field              | Section | Maturity |
|--------------------|---------|----------|
| `boundedContext`   | DDD     | Advanced |
| `translationLinks` | DDD     | Advanced |

### Business Domain
| Field                         | Section         | Maturity |
|-------------------------------|-----------------|----------|
| `type`                        | CORE            | Basic    |
| `descriptions.(locale)`       | CORE            | Basic    |
| `owningUnit`                  | CORE            | Basic    |
| `owner`                       | CORE            | Basic    |
| `classification.(classKey)`   | DATA_GOVERNANCE | Basic    |
| `visionStatement.(locale)`    | STRATEGIC       | Basic    |
| `boundedContexts`             | DDD             | Advanced |
| `contextRelationships`        | DDD             | Advanced |
| `domainEvents`                | DDD             | Advanced |

### Business Process
| Field            | Section | Maturity |
|------------------|---------|----------|
| `boundedContext` | DDD     | Advanced |

### Organisational Unit
| Field             | Section | Maturity |
|-------------------|---------|----------|
| `boundedContexts` | DDD     | Advanced |

### Navigation items hidden when disabled
| Path                    | Label               |
|-------------------------|---------------------|
| `/domains`              | Domain Model        |
| `/ubiquitous-language`  | Ubiquitous Language |
| `/diagrams/context-map` | Context Map         |
| `/diagrams/event-flow`  | Event Flow          |

While DDD is disabled, the owner of an org unit may create entities and processes owned by that unit
(there is no bounded-context realm to create them in).

---

## BCM

**Purpose:** Capabilities and the processes that realise them.

### Business Process
| Field             | Section | Maturity |
|-------------------|---------|----------|
| `capabilities`    | BCM     | Advanced |
| `calledProcesses` | BCM     | Advanced |

### Navigation items hidden when disabled
| Path            | Label        |
|-----------------|--------------|
| `/capabilities` | Capabilities |

---

## TEAM_TOPOLOGIES

**Purpose:** Team ownership, stewardship, mission, team type and descriptions on Organisational Units.
Separate from Data Governance — who owns a team is distinct from who owns data.

### Organisational Unit
| Field                         | Section         | Maturity |
|-------------------------------|-----------------|----------|
| `unitType`                    | CORE            | Basic    |
| `descriptions.(locale)`       | CORE            | Basic    |
| `businessOwner`               | CORE            | Basic    |
| `businessSteward`             | CORE            | Advanced |
| `technicalCustodian`          | CORE            | Advanced |
| `classification.(classKey)`   | DATA_GOVERNANCE | Basic    |
| `missionStatement.(locale)`   | TEAM_TOPOLOGIES | Basic    |
| `teamTopologyType`            | TEAM_TOPOLOGIES | Advanced |

### Navigation items hidden when disabled
| Path            | Label         |
|-----------------|---------------|
| `/organisation` | Team Topology |

---

## LEAN

**Purpose:** Value stream mapping — per-step cycle/wait time, activity classification, and value-stream summaries.

### Business Process
| Field                            | Section | Maturity |
|----------------------------------|---------|----------|
| `valueStreamType`                | LEAN    | Advanced |
| `cycleTimeMinutes`               | LEAN    | Advanced |
| `waitTimeMinutes`                | LEAN    | Advanced |
| `activityType`                   | LEAN    | Advanced |
| `activityJustification.(locale)` | LEAN    | Advanced |
| `changeoverTimeMinutes`          | LEAN    | Expert   |
| `frequencyCount`                 | LEAN    | Expert   |
| `firstPassYield`                 | LEAN    | Expert   |
| `completionRate`                 | LEAN    | Expert   |

### Navigation items hidden when disabled
| Path         | Label       |
|--------------|-------------|
| `/processes` | Process Map |

> Note: `LEAN` lists `/processes` in its `navPaths`, and a path is hidden as soon as *any* methodology
> listing it is disabled — so disabling Lean/VSM currently also hides the Process Map entry.

---

## Fields NOT controlled by any methodology (always available)

These fields are always shown and can be individually hidden or made mandatory via **Field Configuration**.

### Business Entity
| Field            | Section | Maturity |
|------------------|---------|----------|
| `names.(locale)` | CORE    | Basic    |
| `parent`         | CORE    | Basic    |

### Business Domain
| Field            | Section | Maturity |
|------------------|---------|----------|
| `names.(locale)` | CORE    | Basic    |
| `parent`         | CORE    | Basic    |

### Business Process
| Field                       | Section         | Maturity |
|-----------------------------|-----------------|----------|
| `names.(locale)`            | CORE            | Basic    |
| `parent`                    | CORE            | Basic    |
| `classification.(classKey)` | DATA_GOVERNANCE | Basic    |

### Organisational Unit — Core
| Field            | Section | Maturity |
|------------------|---------|----------|
| `names.(locale)` | CORE    | Basic    |
| `parents`        | CORE    | Basic    |

### Organisational Unit — External
| Field                 | Section  | Maturity |
|-----------------------|----------|----------|
| `isExternal`          | EXTERNAL | Basic    |
| `externalCompanyName` | EXTERNAL | Basic    |
| `countryOfExecution`  | EXTERNAL | Basic    |

### Organisational Unit — Data Access
| Field                      | Section     | Maturity |
|----------------------------|-------------|----------|
| `executingProcesses`       | DATA_ACCESS | Basic    |
| `dataAccessEntities`       | DATA_ACCESS | Advanced |
| `dataManipulationEntities` | DATA_ACCESS | Advanced |
| `serviceProviders`         | DATA_ACCESS | Expert   |

**CORE fields and role-based editing.** Fields that belong to no methodology (e.g. `names`) are editable by
an editor/lead of the item type's *governing* methodology (entity → `DATA_GOVERNANCE`, process →
`PROCESS_GOVERNANCE`, domain → `DDD`, org unit → `TEAM_TOPOLOGIES`), besides owner, steward and admin.

---

## Maturity level reference (reverse mapping)

### Basic
| Methodology        | Entity Type         | Fields                                                                                                     |
|--------------------|---------------------|------------------------------------------------------------------------------------------------------------|
| DATA_GOVERNANCE    | Business Entity     | `descriptions`, `dataOwner`, `owningUnit`, `retentionPeriod`, `storageLocations`, `classification.(classKey)` |
| PROCESS_GOVERNANCE | Business Process    | `descriptions`, `processOwner`, `owningUnit`, `processType`, `code`, `inputEntities`, `outputEntities`, `executingUnits` |
| GDPR               | Business Entity     | `containsPersonalData`, `entityRole`                                                                       |
| GDPR               | Business Process    | `legalBasis`, `purpose`                                                                                    |
| DDD                | Business Domain     | `type`, `descriptions`, `owningUnit`, `owner`, `classification.(classKey)`, `visionStatement`              |
| TEAM_TOPOLOGIES    | Organisational Unit | `unitType`, `descriptions`, `businessOwner`, `classification.(classKey)`, `missionStatement`               |

### Advanced
| Methodology        | Entity Type         | Fields                                                                                                     |
|--------------------|---------------------|------------------------------------------------------------------------------------------------------------|
| DATA_GOVERNANCE    | Business Entity     | `dataSteward`, `technicalCustodian`, `interfaceEntities`, `implementationEntities`, `relationships`, `qualityRules` |
| PROCESS_GOVERNANCE | Business Process    | `processSteward`, `technicalCustodian`, `processDiagram`                                                   |
| GDPR               | Business Process    | `securityMeasures`, `crossBorderTransfers`, `itSystems`                                                    |
| DDD                | Business Entity     | `boundedContext`, `translationLinks`                                                                       |
| DDD                | Business Domain     | `boundedContexts`, `contextRelationships`, `domainEvents`                                                  |
| DDD                | Business Process    | `boundedContext`                                                                                           |
| DDD                | Organisational Unit | `boundedContexts`                                                                                          |
| BCM                | Business Process    | `capabilities`, `calledProcesses`                                                                          |
| TEAM_TOPOLOGIES    | Organisational Unit | `businessSteward`, `technicalCustodian`, `teamTopologyType`                                                |
| LEAN               | Business Process    | `valueStreamType`, `cycleTimeMinutes`, `waitTimeMinutes`, `activityType`, `activityJustification`          |

### Expert
| Methodology | Entity Type      | Fields                                                                          |
|-------------|------------------|---------------------------------------------------------------------------------|
| GDPR        | Business Process | `serviceProviders`                                                              |
| LEAN        | Business Process | `changeoverTimeMinutes`, `frequencyCount`, `firstPassYield`, `completionRate`   |

---

## Technical reference

The field inventory (`fieldInventory`: entity type, field, label, section, maturity, mandatory-capable) lives in
`FieldConfigurationService`. The field-to-methodology mapping is hardcoded in two places in the backend:

- `MethodologyConfigurationService.methodologyFields` — used by `getDisabledMethodologies()` and `isFieldExcluded()`; its `allKeys` also defines the valid `ROLE_EDITOR_<M>` / `ROLE_LEAD_<M>` tokens
- `FieldConfigurationService.methodologyPatterns` — used by `compute()` and `getDefinitions()` (identical copy, avoids circular dependency)

A pattern is either a bare field name (matches the field and its `.(locale)` / `.(classKey)` expansions) or
`section:X` (matches every field of section `X`). The `STRATEGIC` section is tied to `DDD`, so new non-DDD
fields must not use it.

Adding a new inventory field also needs a branch in the matching `service/fieldvalue/*FieldValueExtractor`
(versioning and verification read the value through it) and a label in `FieldLabelTranslations`.

The frontend methodology definitions live in:

- `src/context/MethodologyContext.tsx` — `METHODOLOGY_DEFINITIONS` (labels, descriptions, sections, nav paths) and `SECTION_TO_METHODOLOGY`
- `src/utils/missingFieldsGrouping.ts` — `SECTION_TO_METHODOLOGY`, `SECTION_LABELS`, `SECTION_ORDER` (banner grouping)
- `src/components/settings/MethodologiesTab.tsx` — `METHODOLOGY_FILTER` (mirrors backend patterns; used to show per-methodology field lists in the settings UI)
