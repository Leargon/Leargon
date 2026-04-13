package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.FieldConfiguration
import org.leargon.backend.model.FieldConfigurationDefinition
import org.leargon.backend.model.FieldConfigurationDefinitionMaturityLevel
import org.leargon.backend.model.FieldConfigurationEntry
import org.leargon.backend.model.FieldConfigurationEntryMaturityLevel
import org.leargon.backend.model.FieldConfigurationEntryVisibility
import org.leargon.backend.repository.ClassificationRepository
import org.leargon.backend.repository.FieldConfigurationRepository
import org.leargon.backend.repository.SupportedLocaleRepository

@Singleton
open class FieldConfigurationService(
    private val fieldConfigurationRepository: FieldConfigurationRepository,
    private val supportedLocaleRepository: SupportedLocaleRepository,
    private val classificationRepository: ClassificationRepository
) {
    /**
     * Static field inventory per entity type.
     * Locale-specific entries use the placeholder "{locale}" and classification entries use "{classKey}".
     * These are expanded dynamically in getDefinitions().
     */
    private data class FieldDef(
        val entityType: String,
        val fieldName: String,
        val label: String,
        val section: String,
        val maturityLevel: String,
        val mandatoryCapable: Boolean
    )

    private val fieldInventory: List<FieldDef> =
        listOf(
            // ── BUSINESS_ENTITY ──────────────────────────────────────────────────
            FieldDef("BUSINESS_ENTITY", "names.{locale}", "Name", "CORE", "BASIC", true),
            FieldDef("BUSINESS_ENTITY", "descriptions.{locale}", "Description", "CORE", "BASIC", true),
            FieldDef("BUSINESS_ENTITY", "dataOwner", "Data Owner", "CORE", "BASIC", true),
            FieldDef("BUSINESS_ENTITY", "dataSteward", "Data Steward", "CORE", "BASIC", true),
            FieldDef("BUSINESS_ENTITY", "technicalCustodian", "Technical Custodian", "CORE", "ADVANCED", true),
            FieldDef("BUSINESS_ENTITY", "parent", "Parent Entity", "CORE", "BASIC", false),
            FieldDef("BUSINESS_ENTITY", "retentionPeriod", "Retention Period", "DATA_GOVERNANCE", "BASIC", true),
            FieldDef("BUSINESS_ENTITY", "storageLocations", "Storage Locations", "DATA_GOVERNANCE", "BASIC", true),
            FieldDef("BUSINESS_ENTITY", "classification.{classKey}", "Classification", "DATA_GOVERNANCE", "BASIC", true),
            FieldDef("BUSINESS_ENTITY", "qualityRules", "Data Quality Rules", "DATA_QUALITY", "ADVANCED", true),
            FieldDef("BUSINESS_ENTITY", "boundedContext", "Bounded Context", "DDD", "ADVANCED", true),
            FieldDef("BUSINESS_ENTITY", "interfaceEntities", "Interface Entities", "DDD", "ADVANCED", false),
            FieldDef("BUSINESS_ENTITY", "implementationEntities", "Implementation Entities", "DDD", "ADVANCED", false),
            FieldDef("BUSINESS_ENTITY", "relationships", "Relationships", "DDD", "ADVANCED", false),
            FieldDef("BUSINESS_ENTITY", "translationLinks", "Translation Links", "DDD", "ADVANCED", false),
            // ── BUSINESS_DOMAIN ──────────────────────────────────────────────────
            FieldDef("BUSINESS_DOMAIN", "names.{locale}", "Name", "CORE", "BASIC", true),
            FieldDef("BUSINESS_DOMAIN", "descriptions.{locale}", "Description", "CORE", "BASIC", true),
            FieldDef("BUSINESS_DOMAIN", "type", "Domain Type", "CORE", "BASIC", true),
            FieldDef("BUSINESS_DOMAIN", "parent", "Parent Domain", "CORE", "BASIC", false),
            FieldDef("BUSINESS_DOMAIN", "owningUnit", "Owning Unit", "CORE", "BASIC", true),
            FieldDef("BUSINESS_DOMAIN", "visionStatement", "Vision Statement", "STRATEGIC", "BASIC", true),
            FieldDef("BUSINESS_DOMAIN", "boundedContexts", "Bounded Contexts", "DDD", "ADVANCED", false),
            FieldDef("BUSINESS_DOMAIN", "contextRelationships", "Context Relationships", "DDD", "ADVANCED", false),
            FieldDef("BUSINESS_DOMAIN", "domainEvents", "Domain Events", "DDD", "ADVANCED", false),
            FieldDef("BUSINESS_DOMAIN", "classification.{classKey}", "Classification", "DATA_GOVERNANCE", "BASIC", true),
            // ── BUSINESS_PROCESS ─────────────────────────────────────────────────
            FieldDef("BUSINESS_PROCESS", "names.{locale}", "Name", "CORE", "BASIC", true),
            FieldDef("BUSINESS_PROCESS", "descriptions.{locale}", "Description", "CORE", "BASIC", true),
            FieldDef("BUSINESS_PROCESS", "processType", "Process Type", "CORE", "BASIC", true),
            FieldDef("BUSINESS_PROCESS", "code", "Process Code", "CORE", "BASIC", true),
            FieldDef("BUSINESS_PROCESS", "processOwner", "Process Owner", "CORE", "BASIC", true),
            FieldDef("BUSINESS_PROCESS", "processSteward", "Process Steward", "CORE", "BASIC", true),
            FieldDef("BUSINESS_PROCESS", "technicalCustodian", "Technical Custodian", "CORE", "ADVANCED", true),
            FieldDef("BUSINESS_PROCESS", "parent", "Parent Process", "CORE", "BASIC", false),
            FieldDef("BUSINESS_PROCESS", "inputEntities", "Input Data Entities", "DATA_FLOW", "BASIC", true),
            FieldDef("BUSINESS_PROCESS", "outputEntities", "Output Data Entities", "DATA_FLOW", "BASIC", true),
            FieldDef("BUSINESS_PROCESS", "executingUnits", "Executing Units", "DATA_FLOW", "BASIC", true),
            FieldDef("BUSINESS_PROCESS", "classification.{classKey}", "Classification", "DATA_GOVERNANCE", "BASIC", true),
            FieldDef("BUSINESS_PROCESS", "legalBasis", "Legal Basis", "GDPR", "BASIC", true),
            FieldDef("BUSINESS_PROCESS", "purpose.{locale}", "Purpose", "GDPR", "BASIC", true),
            FieldDef("BUSINESS_PROCESS", "securityMeasures.{locale}", "Security Measures", "GDPR", "ADVANCED", true),
            FieldDef("BUSINESS_PROCESS", "crossBorderTransfers", "Cross-Border Transfers", "GDPR", "ADVANCED", true),
            FieldDef("BUSINESS_PROCESS", "boundedContext", "Bounded Context", "DDD", "ADVANCED", true),
            FieldDef("BUSINESS_PROCESS", "capabilities", "Capabilities", "BCM", "ADVANCED", true),
            FieldDef("BUSINESS_PROCESS", "itSystems", "IT Systems", "TECHNICAL", "ADVANCED", true),
            FieldDef("BUSINESS_PROCESS", "serviceProviders", "Service Providers", "TECHNICAL", "EXPERT", true),
            FieldDef("BUSINESS_PROCESS", "processDiagram", "Process Diagram", "TECHNICAL", "ADVANCED", false),
            FieldDef("BUSINESS_PROCESS", "calledProcesses", "Called Sub-Processes", "BCM", "ADVANCED", false),
            // ── ORGANISATIONAL_UNIT ──────────────────────────────────────────────
            FieldDef("ORGANISATIONAL_UNIT", "names.{locale}", "Name", "CORE", "BASIC", true),
            FieldDef("ORGANISATIONAL_UNIT", "descriptions.{locale}", "Description", "CORE", "BASIC", true),
            FieldDef("ORGANISATIONAL_UNIT", "unitType", "Unit Type", "CORE", "BASIC", true),
            FieldDef("ORGANISATIONAL_UNIT", "businessOwner", "Business Owner", "CORE", "BASIC", true),
            FieldDef("ORGANISATIONAL_UNIT", "businessSteward", "Business Steward", "CORE", "BASIC", true),
            FieldDef("ORGANISATIONAL_UNIT", "technicalCustodian", "Technical Custodian", "CORE", "ADVANCED", true),
            FieldDef("ORGANISATIONAL_UNIT", "parents", "Parent Units", "CORE", "BASIC", false),
            FieldDef("ORGANISATIONAL_UNIT", "isExternal", "Is External", "EXTERNAL", "BASIC", false),
            FieldDef("ORGANISATIONAL_UNIT", "externalCompanyName", "External Company Name", "EXTERNAL", "BASIC", true),
            FieldDef("ORGANISATIONAL_UNIT", "countryOfExecution", "Country of Execution", "EXTERNAL", "BASIC", true),
            FieldDef("ORGANISATIONAL_UNIT", "executingProcesses", "Executing Processes", "DATA_ACCESS", "BASIC", false),
            FieldDef("ORGANISATIONAL_UNIT", "dataAccessEntities", "Data Access (Read)", "DATA_ACCESS", "ADVANCED", false),
            FieldDef("ORGANISATIONAL_UNIT", "dataManipulationEntities", "Data Manipulation (Write)", "DATA_ACCESS", "ADVANCED", false),
            FieldDef("ORGANISATIONAL_UNIT", "serviceProviders", "Service Providers", "DATA_ACCESS", "EXPERT", false),
            FieldDef("ORGANISATIONAL_UNIT", "boundedContexts", "Bounded Contexts", "DDD", "ADVANCED", false),
            FieldDef("ORGANISATIONAL_UNIT", "classification.{classKey}", "Classification", "DATA_GOVERNANCE", "BASIC", true)
        )

    /**
     * Base names of locale fields — used to identify locale group entries and expand them
     * in compute(). A locale group entry has fieldName = "names" (no locale suffix) and
     * controls SHOW/HIDE for all locales of that field at once.
     */
    private val localeGroupBases: Set<String> =
        fieldInventory
            .filter { it.fieldName.contains(".{locale}") }
            .map { it.fieldName.substringBefore(".{locale}") }
            .toSet()

    @Transactional
    open fun getAll(): List<FieldConfigurationEntry> = fieldConfigurationRepository.findAll().map { toEntry(it) }

    @Transactional
    open fun replace(entries: List<FieldConfigurationEntry>): List<FieldConfigurationEntry> {
        // Locale group entries: only persist when HIDDEN (SHOWN means "not hidden", so omit)
        // Per-locale entries: only persist when SHOWN (= mandatory); HIDDEN is not valid for locales
        // If a group is HIDDEN, drop any per-locale mandatory entries for that group
        val hiddenGroups =
            entries
                .filter { it.fieldName in localeGroupBases && it.visibility == FieldConfigurationEntryVisibility.HIDDEN }
                .map { it.fieldName }
                .toSet()

        val toSave =
            entries.filter { entry ->
                when {
                    entry.fieldName in localeGroupBases -> {
                        // Keep group entries only when explicitly HIDDEN
                        entry.visibility == FieldConfigurationEntryVisibility.HIDDEN
                    }

                    entry.fieldName.substringBefore(".") in localeGroupBases -> {
                        // Keep per-locale entries only when SHOWN (= mandatory) and group is not hidden
                        entry.fieldName.substringBefore(".") !in hiddenGroups &&
                            entry.visibility != FieldConfigurationEntryVisibility.HIDDEN
                    }

                    else -> {
                        true
                    }
                }
            }

        fieldConfigurationRepository.deleteAll()
        val saved =
            toSave.map { entry ->
                val config = FieldConfiguration()
                config.entityType = entry.entityType
                config.fieldName = entry.fieldName
                config.visibility = if (entry.visibility == FieldConfigurationEntryVisibility.HIDDEN) "HIDDEN" else "SHOWN"
                config.section = entry.section ?: "CORE"
                config.maturityLevel = entry.maturityLevel?.name ?: "BASIC"
                fieldConfigurationRepository.save(config)
            }
        return saved.map { toEntry(it) }
    }

    /**
     * Returns all configurable field definitions for all entity types, with locale-specific and
     * classification-specific placeholders expanded against the actual DB rows.
     *
     * For locale fields (e.g. "names.{locale}"), two kinds of definitions are emitted:
     *   1. A locale group entry ("names") with localeGroup=true and mandatoryCapable=false —
     *      controls show/hide for all locales at once.
     *   2. Per-locale entries ("names.en", "names.de", …) with localeGroup=false and
     *      mandatoryCapable=true — control whether each individual locale is mandatory.
     */
    @Transactional
    open fun getDefinitions(): List<FieldConfigurationDefinition> {
        val localeCodes =
            supportedLocaleRepository
                .findByIsActiveOrderBySortOrder(true)
                .map { it.localeCode }
        val classificationKeys =
            classificationRepository
                .findAll()
                .map { it.key }

        return fieldInventory.flatMap { def ->
            when {
                def.fieldName.contains("{locale}") -> {
                    val base = def.fieldName.substringBefore(".{locale}")
                    // Group entry: controls visibility for all locales together
                    val groupEntry = toDefinition(def, base, def.label, mandatoryCapable = false, localeGroup = true)
                    // Per-locale entries: control mandatory per locale
                    val localeEntries =
                        localeCodes.map { locale ->
                            toDefinition(
                                def,
                                def.fieldName.replace("{locale}", locale),
                                "${def.label} ($locale)",
                                mandatoryCapable = def.mandatoryCapable,
                                localeGroup = false
                            )
                        }
                    listOf(groupEntry) + localeEntries
                }

                def.fieldName.contains("{classKey}") -> {
                    classificationKeys.map { key ->
                        toDefinition(def, def.fieldName.replace("{classKey}", key), "${def.label}: $key")
                    }
                }

                else -> {
                    listOf(toDefinition(def, def.fieldName, def.label))
                }
            }
        }
    }

    data class FieldConfigResult(
        val mandatory: List<String>?,
        val missing: List<String>?,
        val hidden: List<String>?
    )

    fun compute(
        entityType: String,
        isPresent: (String) -> Boolean
    ): FieldConfigResult {
        val configs = fieldConfigurationRepository.findByEntityType(entityType)
        if (configs.isEmpty()) return FieldConfigResult(null, null, null)

        val localeCodes =
            supportedLocaleRepository
                .findByIsActiveOrderBySortOrder(true)
                .map { it.localeCode }

        // Expand hidden group entries (e.g. "names" HIDDEN → "names.en", "names.de", …)
        val rawHidden = configs.filter { it.visibility == "HIDDEN" }.map { it.fieldName }
        val hiddenNames =
            rawHidden.flatMap { fieldName ->
                if (fieldName in localeGroupBases) {
                    localeCodes.map { "$fieldName.$it" }
                } else {
                    listOf(fieldName)
                }
            }

        // Mandatory names: per-locale entries (SHOWN) and regular fields (SHOWN)
        // Locale group entries are never in mandatoryNames — they only control visibility
        val mandatoryNames =
            configs
                .filter { it.visibility != "HIDDEN" && it.fieldName !in localeGroupBases }
                .map { it.fieldName }

        val missing = mandatoryNames.filter { !isPresent(it) }
        return FieldConfigResult(
            mandatoryNames.ifEmpty { null },
            missing.ifEmpty { null },
            hiddenNames.ifEmpty { null }
        )
    }

    private fun toEntry(config: FieldConfiguration): FieldConfigurationEntry =
        FieldConfigurationEntry(config.entityType, config.fieldName).also {
            it.visibility = FieldConfigurationEntryVisibility.valueOf(config.visibility)
            it.section = config.section
            it.maturityLevel = FieldConfigurationEntryMaturityLevel.valueOf(config.maturityLevel)
        }

    private fun toDefinition(
        def: FieldDef,
        fieldName: String,
        label: String,
        mandatoryCapable: Boolean = def.mandatoryCapable,
        localeGroup: Boolean = false
    ): FieldConfigurationDefinition =
        FieldConfigurationDefinition(
            def.entityType,
            fieldName,
            label,
            def.section,
            FieldConfigurationDefinitionMaturityLevel.valueOf(def.maturityLevel),
            mandatoryCapable
        ).also {
            it.localeGroup = localeGroup
        }
}
