package org.leargon.backend.service

/**
 * The static inventory of governance to-do rules.
 *
 * Deliberately data, not code branches: [TaskService] evaluates each rule and
 * [TaskRuleConfigurationService] exposes the same list to administrators, so a rule can be switched
 * off or downgraded without touching the derivation logic. A company early in its governance journey
 * runs only the BASIC tier; the ADVANCED and EXPERT tiers are opt-in.
 *
 * [TaskRuleDef.entityType] is either a concrete type or [ALL_TYPES] for rules that apply to every
 * catalogue item. [TaskRuleDef.fieldName] names the field a task should deep-link to (null when the
 * rule targets the item as a whole, or when the field is only known per task, as for
 * MISSING_MANDATORY_FIELD).
 */
object TaskRuleCatalog {
    const val ALL_TYPES = "ALL"

    const val REQUIRED = "REQUIRED"
    const val RECOMMENDED = "RECOMMENDED"

    const val BASIC = "BASIC"
    const val ADVANCED = "ADVANCED"
    const val EXPERT = "EXPERT"

    const val ERROR = "ERROR"
    const val WARNING = "WARNING"
    const val INFO = "INFO"

    /** Tier order used by the presets and by the enabled-by-default rule. */
    val MATURITY_ORDER = listOf(BASIC, ADVANCED, EXPERT)

    data class TaskRuleDef(
        val code: String,
        val entityType: String,
        val label: String,
        val description: String,
        val section: String,
        val methodology: String?,
        val maturityLevel: String,
        val defaultPriority: String,
        val severity: String,
        val fieldName: String? = null
    ) {
        /** With no saved configuration only the BASIC tier runs, so a new installation starts small. */
        val enabledByDefault: Boolean get() = maturityLevel == BASIC
    }

    val rules: List<TaskRuleDef> =
        listOf(
            TaskRuleDef(
                code = "MISSING_MANDATORY_FIELD",
                entityType = ALL_TYPES,
                label = "Mandatory field not filled in",
                description =
                    "Raises one to-do per field an administrator configured as mandatory but which has no " +
                        "value. Which fields count is controlled on the Methodologies screen.",
                section = "CORE",
                methodology = null,
                maturityLevel = BASIC,
                defaultPriority = REQUIRED,
                severity = ERROR
            ),
            TaskRuleDef(
                code = "MISSING_OWNER",
                entityType = ALL_TYPES,
                label = "No owner assigned",
                description =
                    "The item has no owner, directly or through its owning unit. Shown to the steward, and to " +
                        "administrators in the by-owner view under the unassigned bucket.",
                section = "CORE",
                methodology = null,
                maturityLevel = BASIC,
                defaultPriority = REQUIRED,
                severity = ERROR
            ),
            TaskRuleDef(
                code = "MISSING_STEWARD",
                entityType = ALL_TYPES,
                label = "No steward assigned",
                description = "Nobody is named to look after the item day to day alongside its owner.",
                section = "CORE",
                methodology = null,
                maturityLevel = ADVANCED,
                defaultPriority = RECOMMENDED,
                severity = INFO
            ),
            TaskRuleDef(
                code = "NO_LEGAL_BASIS",
                entityType = "BUSINESS_PROCESS",
                label = "Personal data processed without a legal basis",
                description = "The process handles personal data but names no legal basis.",
                section = "GDPR",
                methodology = "GDPR",
                maturityLevel = BASIC,
                defaultPriority = REQUIRED,
                severity = ERROR,
                fieldName = "legalBasis"
            ),
            TaskRuleDef(
                code = "MISSING_PURPOSE",
                entityType = "BUSINESS_PROCESS",
                label = "Processing purpose not documented",
                description = "The process handles personal data but its purpose is not written down.",
                section = "GDPR",
                methodology = "GDPR",
                maturityLevel = BASIC,
                defaultPriority = REQUIRED,
                severity = ERROR,
                fieldName = "purpose"
            ),
            TaskRuleDef(
                code = "DPIA_IN_PROGRESS",
                entityType = "BUSINESS_PROCESS",
                label = "Data protection impact assessment still open",
                description = "A DPIA was started for this item and has not been completed.",
                section = "GDPR",
                methodology = "GDPR",
                maturityLevel = BASIC,
                defaultPriority = REQUIRED,
                severity = WARNING
            ),
            TaskRuleDef(
                code = "DPIA_RECOMMENDED",
                entityType = "BUSINESS_PROCESS",
                label = "Data protection impact assessment recommended",
                description = "The process handles personal data and has no DPIA yet.",
                section = "GDPR",
                methodology = "GDPR",
                maturityLevel = ADVANCED,
                defaultPriority = RECOMMENDED,
                severity = WARNING
            ),
            TaskRuleDef(
                code = "NO_EXECUTING_UNIT",
                entityType = "BUSINESS_PROCESS",
                label = "No executing team",
                description = "No organisational unit is recorded as executing this process.",
                section = "DATA_FLOW",
                methodology = "PROCESS_GOVERNANCE",
                maturityLevel = ADVANCED,
                defaultPriority = RECOMMENDED,
                severity = INFO,
                fieldName = "executingUnits"
            ),
            TaskRuleDef(
                code = "NO_ENTITY_COVERAGE",
                entityType = "BUSINESS_PROCESS",
                label = "No data entities in or out",
                description =
                    "Neither the process nor any of its sub-processes names an input or output data entity, " +
                        "so it contributes nothing to the data flow.",
                section = "DATA_FLOW",
                methodology = "PROCESS_GOVERNANCE",
                maturityLevel = ADVANCED,
                defaultPriority = RECOMMENDED,
                severity = INFO,
                fieldName = "inputEntities"
            ),
            TaskRuleDef(
                code = "ENTITY_NO_BOUNDED_CONTEXT",
                entityType = "BUSINESS_ENTITY",
                label = "Entity not placed in a bounded context",
                description = "The entity is not assigned to a bounded context, so it sits outside the domain model.",
                section = "DDD",
                methodology = "DDD",
                maturityLevel = ADVANCED,
                defaultPriority = RECOMMENDED,
                severity = INFO,
                fieldName = "boundedContext"
            ),
            TaskRuleDef(
                code = "DOMAIN_NO_BOUNDED_CONTEXT",
                entityType = "BUSINESS_DOMAIN",
                label = "Domain has no bounded context",
                description = "The domain contains no bounded context yet, so its model is undefined.",
                section = "DDD",
                methodology = "DDD",
                maturityLevel = ADVANCED,
                defaultPriority = RECOMMENDED,
                severity = INFO,
                fieldName = "boundedContexts"
            ),
            TaskRuleDef(
                code = "MISSING_MISSION_STATEMENT",
                entityType = "ORGANISATIONAL_UNIT",
                label = "Team has no mission statement",
                description = "The unit has no mission statement, so its purpose is not explicit.",
                section = "TEAM_TOPOLOGIES",
                methodology = "TEAM_TOPOLOGIES",
                maturityLevel = ADVANCED,
                defaultPriority = RECOMMENDED,
                severity = INFO,
                fieldName = "missionStatement"
            ),
            TaskRuleDef(
                code = "MISSING_TOPOLOGY_TYPE",
                entityType = "ORGANISATIONAL_UNIT",
                label = "Team topology type not set",
                description = "The unit is not classified as stream-aligned, enabling, platform or complicated-subsystem.",
                section = "TEAM_TOPOLOGIES",
                methodology = "TEAM_TOPOLOGIES",
                maturityLevel = ADVANCED,
                defaultPriority = RECOMMENDED,
                severity = INFO,
                fieldName = "teamTopologyType"
            ),
            TaskRuleDef(
                code = "UNVERIFIED_FIELD",
                entityType = ALL_TYPES,
                label = "Field waiting to be verified",
                description =
                    "Somebody other than the owner changed a field, so it is marked unverified until the owner " +
                        "confirms it. Only the owner sees these.",
                section = "CORE",
                methodology = null,
                maturityLevel = EXPERT,
                defaultPriority = RECOMMENDED,
                severity = INFO
            )
        )

    fun byCode(code: String): TaskRuleDef? = rules.find { it.code == code }

    /** Rules that apply to [entityType], including the [ALL_TYPES] ones. */
    fun forEntityType(entityType: String): List<TaskRuleDef> = rules.filter { it.entityType == ALL_TYPES || it.entityType == entityType }
}
