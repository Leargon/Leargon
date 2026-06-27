package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.FieldConfiguration
import org.leargon.backend.exception.ForbiddenOperationException
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
            FieldDef("BUSINESS_ENTITY", "owningUnit", "Owning Unit", "CORE", "BASIC", false),
            FieldDef("BUSINESS_ENTITY", "dataSteward", "Data Steward", "CORE", "ADVANCED", true),
            FieldDef("BUSINESS_ENTITY", "technicalCustodian", "Technical Custodian", "CORE", "ADVANCED", true),
            FieldDef("BUSINESS_ENTITY", "parent", "Parent Entity", "CORE", "BASIC", false),
            FieldDef("BUSINESS_ENTITY", "retentionPeriod", "Retention Period", "DATA_GOVERNANCE", "BASIC", true),
            FieldDef("BUSINESS_ENTITY", "storageLocations", "Storage Locations", "DATA_GOVERNANCE", "BASIC", true),
            FieldDef("BUSINESS_ENTITY", "classification.{classKey}", "Classification", "DATA_GOVERNANCE", "BASIC", true),
            FieldDef("BUSINESS_ENTITY", "qualityRules", "Data Quality Rules", "DATA_QUALITY", "ADVANCED", true),
            FieldDef("BUSINESS_ENTITY", "boundedContext", "Bounded Context", "DDD", "ADVANCED", true),
            FieldDef("BUSINESS_ENTITY", "interfaceEntities", "Interface Entities", "DATA_GOVERNANCE", "ADVANCED", false),
            FieldDef("BUSINESS_ENTITY", "implementationEntities", "Implementation Entities", "DATA_GOVERNANCE", "ADVANCED", false),
            FieldDef("BUSINESS_ENTITY", "relationships", "Relationships", "DATA_GOVERNANCE", "ADVANCED", false),
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
            FieldDef("BUSINESS_PROCESS", "owningUnit", "Owning Unit", "CORE", "BASIC", false),
            FieldDef("BUSINESS_PROCESS", "processSteward", "Process Steward", "CORE", "ADVANCED", true),
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
            FieldDef("BUSINESS_PROCESS", "itSystems", "IT Systems", "GDPR", "ADVANCED", true),
            FieldDef("BUSINESS_PROCESS", "serviceProviders", "Service Providers", "GDPR", "EXPERT", true),
            FieldDef("BUSINESS_PROCESS", "processDiagram", "Process Diagram", "DATA_FLOW", "ADVANCED", false),
            FieldDef("BUSINESS_PROCESS", "calledProcesses", "Called Sub-Processes", "BCM", "ADVANCED", false),
            // ── ORGANISATIONAL_UNIT ──────────────────────────────────────────────
            FieldDef("ORGANISATIONAL_UNIT", "names.{locale}", "Name", "CORE", "BASIC", true),
            FieldDef("ORGANISATIONAL_UNIT", "descriptions.{locale}", "Description", "CORE", "BASIC", true),
            FieldDef("ORGANISATIONAL_UNIT", "unitType", "Unit Type", "CORE", "BASIC", true),
            FieldDef("ORGANISATIONAL_UNIT", "businessOwner", "Business Owner", "CORE", "BASIC", true),
            FieldDef("ORGANISATIONAL_UNIT", "businessSteward", "Business Steward", "CORE", "ADVANCED", true),
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

    // methodology key → entity type → field patterns (same as MethodologyConfigurationService)
    private val methodologyPatterns: Map<String, Map<String, List<String>>> =
        mapOf(
            "DATA_GOVERNANCE" to
                mapOf(
                    "BUSINESS_ENTITY" to
                        listOf(
                            "descriptions",
                            "dataOwner",
                            "owningUnit",
                            "dataSteward",
                            "technicalCustodian",
                            "section:DATA_GOVERNANCE",
                            "section:DATA_QUALITY"
                        ),
                ),
            "PROCESS_GOVERNANCE" to
                mapOf(
                    "BUSINESS_PROCESS" to
                        listOf(
                            "descriptions",
                            "processOwner",
                            "owningUnit",
                            "processType",
                            "code",
                            "processSteward",
                            "technicalCustodian",
                            "section:DATA_FLOW",
                        ),
                ),
            "GDPR" to mapOf("BUSINESS_PROCESS" to listOf("section:GDPR")),
            "DDD" to
                mapOf(
                    "BUSINESS_ENTITY" to listOf("section:DDD"),
                    "BUSINESS_DOMAIN" to
                        listOf(
                            "type",
                            "descriptions",
                            "owningUnit",
                            "section:DATA_GOVERNANCE",
                            "section:DDD",
                            "section:STRATEGIC",
                        ),
                    "BUSINESS_PROCESS" to listOf("section:DDD"),
                    "ORGANISATIONAL_UNIT" to listOf("section:DDD"),
                ),
            "BCM" to mapOf("BUSINESS_PROCESS" to listOf("section:BCM")),
            "TEAM_TOPOLOGIES" to
                mapOf(
                    "ORGANISATIONAL_UNIT" to
                        listOf(
                            "unitType",
                            "descriptions",
                            "businessOwner",
                            "businessSteward",
                            "technicalCustodian",
                            "section:DATA_GOVERNANCE"
                        ),
                ),
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

    /**
     * Resolves the methodology section of a concrete field name (e.g. "retentionPeriod" → DATA_GOVERNANCE,
     * "names.en" → CORE, "classification.gdpr" → DATA_GOVERNANCE). Returns null for unknown fields.
     * Used by role-based field-edit gating.
     */
    fun sectionOf(
        entityType: String,
        fieldName: String
    ): String? {
        fieldInventory.firstOrNull { it.entityType == entityType && it.fieldName == fieldName }?.let { return it.section }
        val base = fieldName.substringBefore(".")
        fieldInventory.firstOrNull { it.entityType == entityType && it.fieldName == "$base.{locale}" }?.let { return it.section }
        if (fieldName.startsWith("classification.")) {
            fieldInventory
                .firstOrNull {
                    it.entityType == entityType && it.fieldName == "classification.{classKey}"
                }?.let { return it.section }
        }
        return null
    }

    @Transactional
    open fun getAll(): List<FieldConfigurationEntry> = fieldConfigurationRepository.findAll().map { toEntry(it) }

    /**
     * Concrete (leaf) field names for an entity type — per-locale entries expanded, classification
     * placeholders resolved, locale group entries excluded. This is the set of fields that carry a
     * verification status. Inventory-driven, so new fields/locales/classifications are picked up
     * automatically.
     */
    @Transactional
    open fun concreteFieldNames(entityType: String): List<String> =
        getDefinitions().filter { it.entityType == entityType && it.localeGroup != true }.map { it.fieldName }

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
     * Scoped variant of [replace] for a methodology LEAD (admin uses [replace] directly). A LEAD may only
     * change field configurations whose methodology is in [leadMethodologies]; configurations for any other
     * methodology are preserved unchanged. Attempting to change an out-of-scope field is rejected with 403.
     */
    @Transactional
    open fun replaceScoped(
        entries: List<FieldConfigurationEntry>,
        leadMethodologies: Set<String>,
        isAdmin: Boolean
    ): List<FieldConfigurationEntry> {
        if (isAdmin) return replace(entries)
        if (leadMethodologies.isEmpty()) {
            throw ForbiddenOperationException("Not permitted to change field configuration")
        }

        fun inScope(
            entityType: String,
            fieldName: String,
            section: String?
        ): Boolean {
            val resolvedSection = section ?: sectionOf(entityType, fieldName) ?: "CORE"
            return methodologiesOfField(entityType, fieldName.substringBefore("."), resolvedSection)
                .any { it in leadMethodologies }
        }

        val current = getAll()
        // Reject any out-of-scope change instead of silently ignoring it.
        val currentByField = current.associateBy { it.entityType to it.fieldName }
        entries.forEach { entry ->
            if (!inScope(entry.entityType, entry.fieldName, entry.section)) {
                val cur = currentByField[entry.entityType to entry.fieldName]
                val changed = cur?.visibility != entry.visibility
                if (changed) {
                    throw ForbiddenOperationException(
                        "Not permitted to change field ${entry.entityType}.${entry.fieldName} (outside methodology scope)"
                    )
                }
            }
        }

        // Preserve out-of-scope configs; apply the lead's in-scope entries verbatim.
        val preserved = current.filter { !inScope(it.entityType, it.fieldName, it.section) }
        val applied = entries.filter { inScope(it.entityType, it.fieldName, it.section) }
        return replace(preserved + applied)
    }

    /** Methodologies that claim [fieldBase] on [entityType] (by bare-name or section pattern). */
    private fun methodologiesOfField(
        entityType: String,
        fieldBase: String,
        section: String
    ): Set<String> {
        val result = mutableSetOf<String>()
        for ((methodology, byType) in methodologyPatterns) {
            val patterns = byType[entityType] ?: continue
            for (pattern in patterns) {
                val matches =
                    if (pattern.startsWith("section:")) {
                        section == pattern.removePrefix("section:")
                    } else {
                        fieldBase == pattern || fieldBase.startsWith("$pattern.")
                    }
                if (matches) {
                    result.add(methodology)
                    break
                }
            }
        }
        return result
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
    open fun getDefinitions(disabledMethodologies: Set<String> = emptySet()): List<FieldConfigurationDefinition> {
        val localeCodes =
            supportedLocaleRepository
                .findByIsActiveOrderBySortOrder(true)
                .map { it.localeCode }
        val classifications = classificationRepository.findAll()

        return fieldInventory
            .filter { def -> !isFieldExcluded(def.entityType, def.fieldName.substringBefore(".{"), def.section, disabledMethodologies) }
            .flatMap { def ->
                when {
                    def.fieldName.contains("{locale}") -> {
                        val base = def.fieldName.substringBefore(".{locale}")
                        val groupEntry = toDefinition(def, base, def.label, mandatoryCapable = false, localeGroup = true)
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
                        classifications
                            .filter { it.assignableTo == def.entityType }
                            .map { c ->
                                toDefinition(def, def.fieldName.replace("{classKey}", c.key), "${def.label}: ${c.key}")
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
        disabledMethodologies: Set<String> = emptySet(),
        isPresent: (String) -> Boolean
    ): FieldConfigResult {
        val configs = fieldConfigurationRepository.findByEntityType(entityType)
        if (configs.isEmpty() && disabledMethodologies.isEmpty()) return FieldConfigResult(null, null, null)

        val localeCodes =
            supportedLocaleRepository
                .findByIsActiveOrderBySortOrder(true)
                .map { it.localeCode }

        // Build the set of fields excluded by disabled methodologies (expanded for locale groups)
        val methodologyExcluded: Set<String> =
            if (disabledMethodologies.isEmpty()) {
                emptySet()
            } else {
                fieldInventory
                    .filter { def ->
                        def.entityType == entityType &&
                            isFieldExcluded(entityType, def.fieldName.substringBefore(".{"), def.section, disabledMethodologies)
                    }.flatMap { def ->
                        if (def.fieldName.contains("{locale}")) {
                            val base = def.fieldName.substringBefore(".{locale}")
                            listOf(base) + localeCodes.map { "$base.$it" }
                        } else {
                            listOf(def.fieldName)
                        }
                    }.toSet()
            }

        // Expand hidden group entries (e.g. "names" HIDDEN → "names.en", "names.de", …)
        val rawHidden = configs.filter { it.visibility == "HIDDEN" && it.fieldName !in methodologyExcluded }.map { it.fieldName }
        val hiddenFromConfig =
            rawHidden
                .flatMap { fieldName ->
                    if (fieldName in localeGroupBases) {
                        localeCodes.map { "$fieldName.$it" }
                    } else {
                        listOf(fieldName)
                    }
                }.filter { it !in methodologyExcluded }

        // Methodology-disabled fields are always hidden, regardless of field-level config
        val hiddenNames = (hiddenFromConfig + methodologyExcluded).distinct()

        // Mandatory names: per-locale entries (SHOWN) and regular fields (SHOWN), excluding methodology-disabled fields
        val mandatoryNames =
            configs
                .filter { it.visibility != "HIDDEN" && it.fieldName !in localeGroupBases && it.fieldName !in methodologyExcluded }
                .map { it.fieldName }

        if (mandatoryNames.isEmpty() && hiddenNames.isEmpty()) return FieldConfigResult(null, null, null)

        val missing = mandatoryNames.filter { !isPresent(it) }
        return FieldConfigResult(
            mandatoryNames.ifEmpty { null },
            missing.ifEmpty { null },
            hiddenNames.ifEmpty { null }
        )
    }

    private fun isFieldExcluded(
        entityType: String,
        fieldBase: String,
        section: String,
        disabledMethodologies: Set<String>
    ): Boolean {
        for (methodology in disabledMethodologies) {
            val patterns = methodologyPatterns[methodology]?.get(entityType) ?: continue
            for (pattern in patterns) {
                if (pattern.startsWith("section:")) {
                    if (section == pattern.removePrefix("section:")) return true
                } else {
                    if (fieldBase == pattern || fieldBase.startsWith("$pattern.")) return true
                }
            }
        }
        return false
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
