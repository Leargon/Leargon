package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.FieldConfiguration
import org.leargon.backend.exception.ForbiddenOperationException
import org.leargon.backend.model.MethodologyConfigEntry
import org.leargon.backend.model.MethodologyConfigEntryKey
import org.leargon.backend.repository.FieldConfigurationRepository

@Singleton
open class MethodologyConfigurationService(
    private val fieldConfigurationRepository: FieldConfigurationRepository
) {
    val allKeys = listOf("DATA_GOVERNANCE", "PROCESS_GOVERNANCE", "GDPR", "DDD", "BCM", "TEAM_TOPOLOGIES")

    companion object {
        /** entityType for the per-area "verification enabled" flags (stored like the METHODOLOGY rows). */
        const val VERIFICATION_ENTITY_TYPE = "METHODOLOGY_VERIFICATION"

        /** Governance entity type → the methodology card whose verification switch gates it. */
        val VERIFICATION_METHODOLOGY_BY_ENTITY_TYPE =
            mapOf(
                "BUSINESS_ENTITY" to "DATA_GOVERNANCE",
                "BUSINESS_PROCESS" to "PROCESS_GOVERNANCE",
                "BUSINESS_DOMAIN" to "DDD",
                "ORGANISATIONAL_UNIT" to "TEAM_TOPOLOGIES"
            )
    }

    /** Methodologies that own a verifiable governance entity type (the only ones with a verification switch). */
    private val verificationMethodologies: Set<String> = VERIFICATION_METHODOLOGY_BY_ENTITY_TYPE.values.toSet()

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
        val verificationEnabled = verificationEnabledMethodologies()
        return allKeys.map { key ->
            MethodologyConfigEntry(MethodologyConfigEntryKey.valueOf(key), saved[key]?.visibility != "HIDDEN")
                .also { it.verificationEnabled = key in verificationEnabled }
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

        // Persist per-area verification flags. Default is OFF: a row marks verification ENABLED for that
        // area; absence means disabled. Only the governance methodologies have a verification switch.
        fieldConfigurationRepository.deleteByEntityType(VERIFICATION_ENTITY_TYPE)
        entries
            .filter { it.key.value in verificationMethodologies && it.verificationEnabled == true }
            .forEach { entry ->
                val config = FieldConfiguration()
                config.entityType = VERIFICATION_ENTITY_TYPE
                config.fieldName = entry.key.value
                config.visibility = "SHOWN"
                config.section = "METHODOLOGY"
                config.maturityLevel = "BASIC"
                fieldConfigurationRepository.save(config)
            }
        return getAll()
    }

    /**
     * Scoped variant of [replace] for a methodology LEAD (admin uses [replace] directly). A LEAD may only
     * toggle the enabled/verification state of methodologies in [leadMethodologies]; other methodologies are
     * preserved at their current state. Attempting to change an out-of-scope methodology is rejected with 403.
     */
    @Transactional
    open fun replaceScoped(
        entries: List<MethodologyConfigEntry>,
        leadMethodologies: Set<String>,
        isAdmin: Boolean
    ): List<MethodologyConfigEntry> {
        if (isAdmin) return replace(entries)
        if (leadMethodologies.isEmpty()) {
            throw ForbiddenOperationException("Not permitted to change methodology configuration")
        }
        val current = getAll().associateBy { it.key.value }
        entries.forEach { entry ->
            val key = entry.key.value
            if (key !in leadMethodologies) {
                val cur = current[key]
                val changed =
                    cur == null ||
                        cur.enabled != entry.enabled ||
                        (cur.verificationEnabled ?: false) != (entry.verificationEnabled ?: false)
                if (changed) {
                    throw ForbiddenOperationException("Not permitted to change methodology $key (outside scope)")
                }
            }
        }
        val submitted = entries.associateBy { it.key.value }
        val effective = allKeys.map { key -> if (key in leadMethodologies) submitted[key] ?: current[key]!! else current[key]!! }
        return replace(effective)
    }

    private fun verificationEnabledMethodologies(): Set<String> =
        fieldConfigurationRepository
            .findByEntityType(VERIFICATION_ENTITY_TYPE)
            .map { it.fieldName }
            .toSet()

    /**
     * Whether per-field verification is enabled for [entityType]. Default is OFF: enabled only when the
     * governing methodology's verification switch has been turned on (a marker row exists). Types with no
     * governing methodology are unaffected by the switch.
     */
    @Transactional
    open fun isVerificationEnabled(entityType: String): Boolean {
        val methodology = VERIFICATION_METHODOLOGY_BY_ENTITY_TYPE[entityType] ?: return true
        return methodology in verificationEnabledMethodologies()
    }

    fun getDisabledMethodologies(): Set<String> =
        fieldConfigurationRepository
            .findByEntityType("METHODOLOGY")
            .filter { it.visibility == "HIDDEN" }
            .map { it.fieldName }
            .toSet()

    /**
     * All methodologies that claim the given field (by bare-name or section pattern). A field can belong
     * to several methodologies (e.g. `descriptions`, `owningUnit`, or anything in `section:DATA_GOVERNANCE`).
     * Used for role-based field-edit gating: a scoped EDITOR/LEAD may edit a field if their methodology is
     * in this set. Empty means no methodology owns the field (CORE-only — owner/steward/admin only).
     */
    fun methodologiesOf(
        entityType: String,
        fieldName: String,
        section: String?
    ): Set<String> {
        val result = mutableSetOf<String>()
        for ((methodology, byType) in methodologyFields) {
            val patterns = byType[entityType] ?: continue
            for (pattern in patterns) {
                val matches =
                    if (pattern.startsWith("section:")) {
                        section != null && section == pattern.removePrefix("section:")
                    } else {
                        fieldName == pattern || fieldName.startsWith("$pattern.")
                    }
                if (matches) {
                    result.add(methodology)
                    break
                }
            }
        }
        return result
    }

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
