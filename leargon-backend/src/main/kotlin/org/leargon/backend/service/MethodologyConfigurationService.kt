package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.FieldConfiguration
import org.leargon.backend.model.MethodologyConfigEntry
import org.leargon.backend.model.MethodologyConfigEntryKey
import org.leargon.backend.repository.FieldConfigurationRepository

@Singleton
open class MethodologyConfigurationService(
    private val fieldConfigurationRepository: FieldConfigurationRepository
) {
    val allKeys = listOf("DATA_GOVERNANCE", "PROCESS_GOVERNANCE", "GDPR", "DDD", "BCM", "TEAM_TOPOLOGIES")

    // methodology key → entity type → field patterns to exclude.
    // "section:X" excludes all fields whose section == X.
    // bare name excludes fields whose fieldName == name or starts with "$name."
    val methodologyFields: Map<String, Map<String, List<String>>> =
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
                            "section:DATA_FLOW"
                        ),
                ),
            "GDPR" to
                mapOf(
                    "BUSINESS_PROCESS" to listOf("section:GDPR"),
                ),
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
            "BCM" to
                mapOf(
                    "BUSINESS_PROCESS" to listOf("section:BCM"),
                ),
        )

    @Transactional
    open fun getAll(): List<MethodologyConfigEntry> {
        val saved =
            fieldConfigurationRepository
                .findByEntityType("METHODOLOGY")
                .associateBy { it.fieldName }
        return allKeys.map { key ->
            MethodologyConfigEntry(MethodologyConfigEntryKey.valueOf(key), saved[key]?.visibility != "HIDDEN")
        }
    }

    @Transactional
    open fun replace(entries: List<MethodologyConfigEntry>): List<MethodologyConfigEntry> {
        fieldConfigurationRepository.deleteByEntityType("METHODOLOGY")
        entries.filter { !it.enabled }.forEach { entry ->
            val config = FieldConfiguration()
            config.entityType = "METHODOLOGY"
            config.fieldName = entry.key.value
            config.visibility = "HIDDEN"
            config.section = "METHODOLOGY"
            config.maturityLevel = "BASIC"
            fieldConfigurationRepository.save(config)
        }
        return getAll()
    }

    fun getDisabledMethodologies(): Set<String> =
        fieldConfigurationRepository
            .findByEntityType("METHODOLOGY")
            .filter { it.visibility == "HIDDEN" }
            .map { it.fieldName }
            .toSet()

    fun isFieldExcluded(
        entityType: String,
        fieldName: String,
        section: String,
        disabledMethodologies: Set<String>
    ): Boolean {
        for (methodology in disabledMethodologies) {
            val patterns = methodologyFields[methodology]?.get(entityType) ?: continue
            for (pattern in patterns) {
                if (pattern.startsWith("section:")) {
                    if (section == pattern.removePrefix("section:")) return true
                } else {
                    if (fieldName == pattern || fieldName.startsWith("$pattern.")) return true
                }
            }
        }
        return false
    }
}
