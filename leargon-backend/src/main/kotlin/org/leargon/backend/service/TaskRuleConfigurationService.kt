package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.TaskRuleConfiguration
import org.leargon.backend.exception.ForbiddenOperationException
import org.leargon.backend.model.TaskRuleConfigEntry
import org.leargon.backend.model.TaskRuleConfigEntryPriority
import org.leargon.backend.model.TaskRuleDefinition
import org.leargon.backend.model.TaskRuleDefinitionDefaultPriority
import org.leargon.backend.model.TaskRuleDefinitionMaturityLevel
import org.leargon.backend.repository.TaskRuleConfigurationRepository
import org.leargon.backend.service.TaskRuleCatalog.TaskRuleDef

/**
 * Organisation-wide on/off and priority configuration for the governance to-do rules in
 * [TaskRuleCatalog].
 *
 * A rule with no stored row falls back to [TaskRuleDef.enabledByDefault] (BASIC tier only), so a
 * company in its build phase gets a short, achievable list rather than every gap at once. Editing is
 * gated exactly like the field and methodology configuration: administrators outright, methodology
 * LEADs for the rules of their own methodology.
 */
@Singleton
open class TaskRuleConfigurationService(
    private val taskRuleConfigurationRepository: TaskRuleConfigurationRepository,
    private val methodologyConfigurationService: MethodologyConfigurationService
) {
    /** The effective state of one rule after applying the stored configuration. */
    data class EffectiveRule(
        val definition: TaskRuleDef,
        val enabled: Boolean,
        val priority: String
    )

    /**
     * Every rule that is currently in play, keyed by rule code: rules of a disabled methodology are
     * dropped entirely, and the rest carry their configured (or default) enabled state and priority.
     */
    @Transactional
    open fun effectiveRules(): Map<String, EffectiveRule> {
        val repo = this.taskRuleConfigurationRepository
        val disabled = methodologyConfigurationService.getDisabledMethodologies()
        val stored = repo.findAll().associateBy { it.ruleCode }
        return TaskRuleCatalog.rules
            .filter { it.methodology == null || it.methodology !in disabled }
            .associate { def ->
                val config = stored[def.code]
                def.code to
                    EffectiveRule(
                        definition = def,
                        enabled = config?.enabled ?: def.enabledByDefault,
                        priority = config?.priority ?: def.defaultPriority
                    )
            }
    }

    /** The rule inventory shown in the administration screen; rules of a disabled methodology are omitted. */
    @Transactional
    open fun getDefinitions(): List<TaskRuleDefinition> {
        val disabled = methodologyConfigurationService.getDisabledMethodologies()
        return TaskRuleCatalog.rules
            .filter { it.methodology == null || it.methodology !in disabled }
            .map { def ->
                TaskRuleDefinition(
                    def.code,
                    def.label,
                    def.description,
                    def.entityType,
                    def.section,
                    TaskRuleDefinitionMaturityLevel.valueOf(def.maturityLevel),
                    TaskRuleDefinitionDefaultPriority.valueOf(def.defaultPriority),
                    def.enabledByDefault
                ).methodology(def.methodology)
            }
    }

    @Transactional
    open fun getAll(): List<TaskRuleConfigEntry> =
        taskRuleConfigurationRepository
            .findAll()
            .sortedBy { it.ruleCode }
            .map { toEntry(it) }

    /**
     * Replaces the complete configuration. A non-admin LEAD may only submit entries that differ from the
     * current state for rules of a methodology they lead; anything else is rejected with 403 rather than
     * silently ignored, so the caller learns their change did not apply.
     */
    @Transactional
    open fun replaceScoped(
        entries: List<TaskRuleConfigEntry>,
        leadMethodologies: Set<String>,
        isAdmin: Boolean
    ): List<TaskRuleConfigEntry> {
        val known = TaskRuleCatalog.rules.associateBy { it.code }
        entries.forEach { entry ->
            known[entry.ruleCode] ?: throw ForbiddenOperationException("Unknown to-do rule ${entry.ruleCode}")
        }
        if (!isAdmin) {
            if (leadMethodologies.isEmpty()) {
                throw ForbiddenOperationException("Not permitted to change the to-do rule configuration")
            }
            val current = effectiveRules()
            entries.forEach { entry ->
                val def = known.getValue(entry.ruleCode)
                if (def.methodology == null || def.methodology !in leadMethodologies) {
                    val cur = current[entry.ruleCode]
                    val changed =
                        cur == null ||
                            cur.enabled != entry.enabled ||
                            cur.priority != (entry.priority?.value ?: def.defaultPriority)
                    if (changed) {
                        throw ForbiddenOperationException(
                            "Not permitted to change to-do rule ${entry.ruleCode} (outside scope)"
                        )
                    }
                }
            }
        }
        val repo = this.taskRuleConfigurationRepository
        repo.deleteAll()
        val saved =
            entries.map { entry ->
                repo.save(
                    TaskRuleConfiguration().apply {
                        this.ruleCode = entry.ruleCode
                        this.enabled = entry.enabled
                        this.priority = entry.priority?.value
                    }
                )
            }
        return saved.sortedBy { it.ruleCode }.map { toEntry(it) }
    }

    private fun toEntry(config: TaskRuleConfiguration) =
        TaskRuleConfigEntry(config.ruleCode, config.enabled)
            .priority(config.priority?.let { TaskRuleConfigEntryPriority.valueOf(it) })
}
