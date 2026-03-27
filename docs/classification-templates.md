# Predefined Classification Templates

Classification templates are starter configurations offered by the **Set Up Classification Taxonomy** wizard. Each template creates one ready-to-use classification with sensible default values. All templates are fully editable before creation — names and values can be renamed, added, or removed in the wizard review step.

Templates are organised into four domains: Data Governance, Data Security, Business Capability Modeling (BCM), and Process Governance.

---

## Data Governance

### Confidentiality
Labels data assets by their access sensitivity level. Used for access control policies and governance reviews.

| Value | Meaning |
|---|---|
| Public | Freely shareable with anyone |
| Internal | For internal use only |
| Confidential | Restricted to specific roles or teams |
| Secret | Highest restriction — need-to-know basis only |

- **Default assignable to**: Business Entity
- **Multi-value**: No

---

### Personal Data
Flags entities that contain personal data. Required for GDPR Art. 30 / DSG Art. 12 processing register compliance.

| Value | Meaning |
|---|---|
| Contains Personal Data | Entity holds PII or special-category data |
| No Personal Data | Entity holds no personal data |

- **Default assignable to**: Business Entity
- **Multi-value**: No

---

### Data Quality Tier
Rates the reliability and authority of a data entity. Helps prioritise data quality investments.

| Value | Meaning |
|---|---|
| Authoritative | Single source of truth for this data |
| Derived | Computed or aggregated from other sources |
| Raw | Unprocessed, unvalidated input data |

- **Default assignable to**: Business Entity
- **Multi-value**: No

---

### Retention Category
Tags data by how long it must be retained. Supports privacy compliance and storage optimisation.

| Value | Meaning |
|---|---|
| Short-term | Up to 1 year |
| Medium-term | 1–7 years |
| Long-term | 7+ years |
| Permanent | Retained indefinitely (e.g. legal records) |

- **Default assignable to**: Business Entity
- **Multi-value**: No

---

### Data Ownership
Describes how a data asset is owned and sourced within the organisation.

| Value | Meaning |
|---|---|
| Owned | Fully owned and mastered by this organisation |
| Shared | Co-owned or maintained jointly with another team |
| Sourced | Sourced from an external provider or upstream system |
| Deprecated | No longer actively maintained |

- **Default assignable to**: Business Entity
- **Multi-value**: No

---

### Master Data Type
Classifies the architectural role of a data entity.

| Value | Meaning |
|---|---|
| Master | Core business object (e.g. Customer, Product) |
| Reference | Lookup or code table (e.g. Country, Currency) |
| Transactional | Event or transaction record (e.g. Order, Invoice) |

- **Default assignable to**: Business Entity
- **Multi-value**: No

---

### Regulatory Scope
Tags the regulatory frameworks applicable to a data asset. Multiple frameworks can apply simultaneously.

| Value | Meaning |
|---|---|
| GDPR | EU General Data Protection Regulation |
| HIPAA | US Health Insurance Portability and Accountability Act |
| SOX | US Sarbanes-Oxley Act (financial controls) |
| None | No specific regulatory framework applies |

- **Default assignable to**: Business Entity
- **Multi-value**: Yes

---

### Lifecycle Stage
Indicates the current lifecycle stage of a data entity.

| Value | Meaning |
|---|---|
| Concept | Planned or under design, not yet in production |
| Active | In active use |
| Deprecated | Still accessible but being phased out |
| Archived | No longer in use, retained for historical purposes |

- **Default assignable to**: Business Entity
- **Multi-value**: No

---

## Data Security (CIA Triad)

### CIA — Confidentiality
Rates the confidentiality impact requirement for a data asset based on the CIA triad. Answers: "How serious would unauthorised disclosure be?"

| Value | Meaning |
|---|---|
| High | Disclosure would cause severe harm |
| Medium | Disclosure would cause moderate harm |
| Low | Disclosure would cause negligible harm |

- **Default assignable to**: Business Entity
- **Multi-value**: No

---

### CIA — Integrity
Rates the integrity impact requirement for a data asset based on the CIA triad. Answers: "How serious would unauthorised modification be?"

| Value | Meaning |
|---|---|
| High | Modification would cause severe harm |
| Medium | Modification would cause moderate harm |
| Low | Modification would cause negligible harm |

- **Default assignable to**: Business Entity
- **Multi-value**: No

---

### CIA — Availability
Rates the availability impact requirement for a data asset based on the CIA triad. Answers: "How serious would loss of access be?"

| Value | Meaning |
|---|---|
| High | Unavailability would cause severe harm |
| Medium | Unavailability would cause moderate harm |
| Low | Unavailability would cause negligible harm |

- **Default assignable to**: Business Entity
- **Multi-value**: No

---

### Sensitivity
Classifies the data sensitivity level for regulatory and handling purposes. Complements the CIA Confidentiality rating with a handling-oriented label.

| Value | Meaning |
|---|---|
| Highly Sensitive | Special-category, health, or financial data requiring maximum protection |
| Sensitive | Personal or commercially sensitive data requiring careful handling |
| Internal | Non-public data with standard internal controls |
| Public | Freely shareable with no handling restrictions |

- **Default assignable to**: Business Entity
- **Multi-value**: No

---

## Business Capability Modeling (BCM)

### Strategic Importance
Rates the strategic role of a domain or capability within the business capability map.

| Value | Meaning |
|---|---|
| Differentiating | Provides competitive advantage — invest and innovate |
| Essential | Critical but not differentiating — keep reliable |
| Commodity | Generic capability — consider outsourcing or standardising |

- **Default assignable to**: Business Domain
- **Multi-value**: No

---

### Capability Maturity
Assesses the maturity level of a business capability or domain. Based on the Capability Maturity Model (CMM) scale.

| Value | Meaning |
|---|---|
| Initial | Unpredictable, ad-hoc, poorly controlled |
| Developing | Partially repeatable but inconsistent |
| Defined | Documented, standardised, and followed |
| Managed | Measured, controlled, and predictable |
| Optimizing | Continuously improving through feedback |

- **Default assignable to**: Business Domain
- **Multi-value**: No

---

### Investment Priority
Indicates the intended investment direction for a domain or capability.

| Value | Meaning |
|---|---|
| Invest | Grow and improve — strategic priority |
| Maintain | Keep at current level — stable and sufficient |
| Retire | Wind down — plan for decommission |

- **Default assignable to**: Business Domain
- **Multi-value**: No

---

## Process Governance

### Process Risk Level
Rates the inherent risk level of a business process.

| Value | Meaning |
|---|---|
| High | Significant compliance, financial, or operational risk |
| Medium | Moderate risk requiring standard controls |
| Low | Low risk with minimal impact if something goes wrong |

- **Default assignable to**: Business Process
- **Multi-value**: No

---

### Process Maturity
Assesses the maturity and standardisation level of a business process.

| Value | Meaning |
|---|---|
| Ad-hoc | Unstructured, undocumented, person-dependent |
| Repeatable | Informally practiced and roughly consistent |
| Standardized | Formally documented and consistently followed |
| Optimized | Actively measured and continuously improved |

- **Default assignable to**: Business Process
- **Multi-value**: No

---

## Notes

- **Default assignable to** is a suggestion in the wizard — it can be changed per classification before creation.
- All template names and value labels can be renamed in the wizard review step.
- Values can be added or removed before creation; they cannot be reordered (sort order follows insertion order).
- After creation, classifications and values can be managed in **Settings → Classifications**.
- The **Custom** option in the wizard allows creating a classification from scratch without a template.
