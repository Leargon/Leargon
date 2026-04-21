# Methodology → Field & Navigation Mapping

Each methodology controls which fields are visible/mandatory on entity detail panels,
which sections appear in Field Configuration, and which sidebar navigation items are shown.
Disabling a methodology hides all listed items.

Fields marked with `(locale)` expand to one entry per active locale (e.g. `descriptions.en`, `descriptions.de`).
Fields marked with `(classKey)` expand to one entry per configured classification.

**Maturity levels:** Basic → Advanced → Expert (progressive disclosure; use presets on the Methodology settings page to apply a tier in one click).

---

## DATA_GOVERNANCE

**Purpose:** Track data ownership, stewardship, descriptions, quality rules, and data model structure on Business Entities.

### Business Entity
| Field                                    | Section         | Maturity |
|------------------------------------------|-----------------|----------|
| `descriptions` / `descriptions.(locale)` | CORE            | Basic    |
| `dataOwner`                              | CORE            | Basic    |
| `owningUnit`                             | CORE            | Basic    |
| `dataSteward`                              | CORE            | Advanced |
| `technicalCustodian`                     | CORE            | Advanced |
| `retentionPeriod`                        | DATA_GOVERNANCE | Basic    |
| `storageLocations`                       | DATA_GOVERNANCE | Basic    |
| `classification.(classKey)`              | DATA_GOVERNANCE | Basic    |
| `interfaceEntities`                      | DATA_GOVERNANCE | Advanced |
| `implementationEntities`                 | DATA_GOVERNANCE | Advanced |
| `relationships`                          | DATA_GOVERNANCE | Advanced |
| `qualityRules`                           | DATA_QUALITY    | Advanced |

### Navigation items hidden when disabled
_(none)_

---

## PROCESS_GOVERNANCE

**Purpose:** Manage process descriptions, ownership, stewardship, data flow relationships, and process diagrams.

### Business Process
| Field                                    | Section   | Maturity |
|------------------------------------------|-----------|----------|
| `descriptions` / `descriptions.(locale)` | CORE      | Basic    |
| `processOwner`                           | CORE      | Basic    |
| `owningUnit`                             | CORE      | Basic    |
| `processType`                            | CORE      | Basic    |
| `code`                                   | CORE      | Basic    |
| `processSteward`                           | CORE      | Advanced |
| `technicalCustodian`                     | CORE      | Advanced |
| `inputEntities`                          | DATA_FLOW | Basic    |
| `outputEntities`                         | DATA_FLOW | Basic    |
| `executingUnits`                         | DATA_FLOW | Basic    |
| `processDiagram`                         | DATA_FLOW | Advanced |

### Navigation items hidden when disabled
_(none)_

---

## GDPR

**Purpose:** Legal basis, purpose, security measures, cross-border transfers, IT systems, service providers, and DPIA registers.

### Business Process
| Field                                            | Section | Maturity |
|--------------------------------------------------|---------|----------|
| `legalBasis`                                     | GDPR    | Basic    |
| `purpose` / `purpose.(locale)`                   | GDPR    | Basic    |
| `securityMeasures` / `securityMeasures.(locale)` | GDPR    | Advanced |
| `crossBorderTransfers`                           | GDPR    | Advanced |
| `itSystems`                                      | GDPR    | Advanced |
| `serviceProviders`                               | GDPR    | Expert   |

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
| Field                                    | Section         | Maturity |
|------------------------------------------|-----------------|----------|
| `type`                                   | CORE            | Basic    |
| `descriptions` / `descriptions.(locale)` | CORE            | Basic    |
| `owningUnit`                             | CORE            | Basic    |
| `classification.(classKey)`              | DATA_GOVERNANCE | Basic    |
| `visionStatement`                        | STRATEGIC       | Basic    |
| `boundedContexts`                        | DDD             | Advanced |
| `contextRelationships`                   | DDD             | Advanced |
| `domainEvents`                           | DDD             | Advanced |

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
| `/ubiquitous-language`  | Ubiquitous Language |
| `/diagrams/context-map` | Context Map         |
| `/diagrams/event-flow`  | Event Flow          |

---

## BCM

**Purpose:** Capabilities, team insights, and business continuity planning.

### Business Process
| Field             | Section | Maturity |
|-------------------|---------|----------|
| `capabilities`    | BCM     | Advanced |
| `calledProcesses` | BCM     | Advanced |

### Navigation items hidden when disabled
| Path             | Label         |
|------------------|---------------|
| `/capabilities`  | Capabilities  |
| `/team-insights` | Team Insights |

---

## TEAM_TOPOLOGIES

**Purpose:** Define team ownership, stewardship roles, and descriptions on Organisational Units.
Separate from Data Governance — who owns a team is distinct from who owns data.

### Organisational Unit
| Field                                    | Section         | Maturity |
|------------------------------------------|-----------------|----------|
| `unitType`                               | CORE            | Basic    |
| `descriptions` / `descriptions.(locale)` | CORE            | Basic    |
| `businessOwner`                          | CORE            | Basic    |
| `businessSteward`                          | CORE            | Advanced |
| `technicalCustodian`                     | CORE            | Advanced |
| `classification.(classKey)`              | DATA_GOVERNANCE | Basic    |

### Navigation items hidden when disabled
_(none)_

---

## Fields NOT controlled by any methodology (always visible)

These fields are always shown and can be individually hidden or made mandatory via **Field Configuration**.

### Business Entity
| Field             | Section | Maturity |
|-------------------|---------|----------|
| `names.(locale)`  | CORE    | Basic    |
| `parent`          | CORE    | Basic    |

### Business Domain
| Field             | Section | Maturity |
|-------------------|---------|----------|
| `names.(locale)`  | CORE    | Basic    |
| `parent`          | CORE    | Basic    |

### Business Process
| Field             | Section | Maturity |
|-------------------|---------|----------|
| `names.(locale)`  | CORE    | Basic    |
| `parent`          | CORE    | Basic    |

### Organisational Unit — Core
| Field             | Section | Maturity |
|-------------------|---------|----------|
| `names.(locale)`  | CORE    | Basic    |
| `parents`         | CORE    | Basic    |

### Organisational Unit — External
| Field                  | Section  | Maturity |
|------------------------|----------|----------|
| `isExternal`           | EXTERNAL | Basic    |
| `externalCompanyName`  | EXTERNAL | Basic    |
| `countryOfExecution`   | EXTERNAL | Basic    |

### Organisational Unit — Data Access
| Field                        | Section     | Maturity |
|------------------------------|-------------|----------|
| `executingProcesses`         | DATA_ACCESS | Basic    |
| `dataAccessEntities`         | DATA_ACCESS | Advanced |
| `dataManipulationEntities`   | DATA_ACCESS | Advanced |
| `serviceProviders`           | DATA_ACCESS | Expert   |

---

## Maturity level reference (reverse mapping)

### Basic — all fields
| Methodology        | Entity Type         | Field                                                                                                                        |
|--------------------|---------------------|------------------------------------------------------------------------------------------------------------------------------|
| DATA_GOVERNANCE    | Business Entity     | `descriptions`, `dataOwner`, `retentionPeriod`, `storageLocations`, `classification.(classKey)`        |
| PROCESS_GOVERNANCE | Business Process    | `descriptions`, `processOwner`, `processType`, `code`, `inputEntities`, `outputEntities`, `executingUnits` |
| GDPR               | Business Process    | `legalBasis`, `purpose`                                                                                |
| DDD                | Business Domain     | `type`, `descriptions`, `owningUnit`, `classification.(classKey)`, `visionStatement`                   |
| TEAM_TOPOLOGIES    | Organisational Unit | `unitType`, `descriptions`, `businessOwner`, `classification.(classKey)`                               |

### Advanced — all fields
| Methodology        | Entity Type         | Field                                                                                                |
|--------------------|---------------------|------------------------------------------------------------------------------------------------------|
| DATA_GOVERNANCE    | Business Entity     | `dataSteward`, `technicalCustodian`, `interfaceEntities`, `implementationEntities`, `relationships`, `qualityRules` |
| PROCESS_GOVERNANCE | Business Process    | `processSteward`, `technicalCustodian`, `processDiagram`                                                            |
| GDPR               | Business Process    | `securityMeasures`, `crossBorderTransfers`, `itSystems`                                              |
| DDD                | Business Entity     | `boundedContext`, `translationLinks`                                                                 |
| DDD                | Business Domain     | `boundedContexts`, `contextRelationships`, `domainEvents`                                            |
| DDD                | Business Process    | `boundedContext`                                                                                     |
| DDD                | Organisational Unit | `boundedContexts`                                                                                    |
| BCM                | Business Process    | `capabilities`, `calledProcesses`                                                                    |
| TEAM_TOPOLOGIES    | Organisational Unit | `businessSteward`, `technicalCustodian`                                                             |

### Expert — all fields
| Methodology | Entity Type      | Field              |
|-------------|------------------|--------------------|
| GDPR        | Business Process | `serviceProviders` |

---

## Technical reference

The field-to-methodology mapping is hardcoded in two places in the backend:

- `MethodologyConfigurationService.methodologyFields` — used by `getDisabledMethodologies()` and `isFieldExcluded()`
- `FieldConfigurationService.methodologyPatterns` — used by `compute()` and `getDefinitions()` (identical copy, avoids circular dependency)

The frontend methodology definitions live in:

- `src/context/MethodologyContext.tsx` — `METHODOLOGY_DEFINITIONS` (labels, descriptions, sections, nav paths)
- `src/context/MethodologyContext.tsx` — `SECTION_TO_METHODOLOGY` (section name → methodology, for frontend filtering)
- `src/utils/missingFieldsGrouping.ts` — `SECTION_TO_METHODOLOGY` (re-exported for banner grouping)
- `src/components/settings/MethodologiesTab.tsx` — `METHODOLOGY_FILTER` (mirrors backend patterns; used to show per-methodology field lists in the settings UI)
