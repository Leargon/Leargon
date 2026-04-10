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
            // ── BUSINESS_DOMAIN ──────────────────────────────────────────────────
            FieldDef("BUSINESS_DOMAIN", "names.{locale}", "Name", "CORE", "BASIC", true),
            FieldDef("BUSINESS_DOMAIN", "descriptions.{locale}", "Description", "CORE", "BASIC", true),
            FieldDef("BUSINESS_DOMAIN", "type", "Domain Type", "CORE", "BASIC", true),
            FieldDef("BUSINESS_DOMAIN", "parent", "Parent Domain", "CORE", "BASIC", false),
            FieldDef("BUSINESS_DOMAIN", "owningUnit", "Owning Unit", "CORE", "BASIC", true),
            FieldDef("BUSINESS_DOMAIN", "visionStatement", "Vision Statement", "STRATEGIC", "BASIC", true),
            FieldDef("BUSINESS_DOMAIN", "boundedContexts", "Bounded Contexts", "DDD", "ADVANCED", false),
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
            FieldDef("ORGANISATIONAL_UNIT", "dataAccessEntities", "Data Access (Read)", "DATA_ACCESS", "ADVANCED", false),
            FieldDef("ORGANISATIONAL_UNIT", "dataManipulationEntities", "Data Manipulation (Write)", "DATA_ACCESS", "ADVANCED", false),
            FieldDef("ORGANISATIONAL_UNIT", "serviceProviders", "Service Providers", "DATA_ACCESS", "EXPERT", false),
            FieldDef("ORGANISATIONAL_UNIT", "classification.{classKey}", "Classification", "DATA_GOVERNANCE", "BASIC", true)
        )

    @Transactional
    open fun getAll(): List<FieldConfigurationEntry> = fieldConfigurationRepository.findAll().map { toEntry(it) }

    @Transactional
    open fun replace(entries: List<FieldConfigurationEntry>): List<FieldConfigurationEntry> {
        fieldConfigurationRepository.deleteAll()
        val saved =
            entries.map { entry ->
                val config = FieldConfiguration()
                config.entityType = entry.entityType
                config.fieldName = entry.fieldName
                // Mandatory fields are always SHOWN — backend enforces the invariant
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
                    localeCodes.map { locale ->
                        toDefinition(
                            def,
                            def.fieldName.replace("{locale}", locale),
                            "${def.label} ($locale)"
                        )
                    }
                }

                def.fieldName.contains("{classKey}") -> {
                    classificationKeys.map { key ->
                        toDefinition(
                            def,
                            def.fieldName.replace("{classKey}", key),
                            "${def.label}: $key"
                        )
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
        val missing: List<String>?
    )

    fun compute(
        entityType: String,
        isPresent: (String) -> Boolean
    ): FieldConfigResult {
        val configs = fieldConfigurationRepository.findByEntityType(entityType)
        if (configs.isEmpty()) return FieldConfigResult(null, null)
        val names = configs.map { it.fieldName }
        val missing = names.filter { !isPresent(it) }
        return FieldConfigResult(names, missing.ifEmpty { null })
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
        label: String
    ): FieldConfigurationDefinition =
        FieldConfigurationDefinition(
            def.entityType,
            fieldName,
            label,
            def.section,
            FieldConfigurationDefinitionMaturityLevel.valueOf(def.maturityLevel),
            def.mandatoryCapable
        )
}
