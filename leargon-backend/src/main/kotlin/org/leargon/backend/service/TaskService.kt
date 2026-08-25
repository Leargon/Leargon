package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.BusinessDomain
import org.leargon.backend.domain.BusinessEntity
import org.leargon.backend.domain.LocalizedText
import org.leargon.backend.domain.OrganisationalUnit
import org.leargon.backend.domain.Process
import org.leargon.backend.domain.TaskDismissal
import org.leargon.backend.exception.ForbiddenOperationException
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.mapper.BusinessDomainMapper
import org.leargon.backend.mapper.BusinessEntityMapper
import org.leargon.backend.mapper.LocalizedTextMapper
import org.leargon.backend.mapper.OrganisationalUnitMapper
import org.leargon.backend.mapper.ProcessMapper
import org.leargon.backend.mapper.UserMapper
import org.leargon.backend.model.OwnerTaskLoadItem
import org.leargon.backend.model.OwnerTaskLoadResponse
import org.leargon.backend.model.TaskItem
import org.leargon.backend.model.TaskItemPriority
import org.leargon.backend.model.TaskItemResourceType
import org.leargon.backend.model.TaskItemResponsibility
import org.leargon.backend.model.TaskItemSeverity
import org.leargon.backend.model.TaskListResponse
import org.leargon.backend.model.TaskSummary
import org.leargon.backend.repository.BusinessDomainRepository
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.DpiaRepository
import org.leargon.backend.repository.FieldVerificationRepository
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.repository.TaskDismissalRepository
import org.leargon.backend.repository.UserRepository
import java.time.Instant

/**
 * Derives every owner's governance to-do list from live catalogue data.
 *
 * Nothing is stored: the rules in [TaskRuleCatalog] are re-evaluated on each read, so a to-do
 * disappears the moment the gap is closed. Which rules run is an organisation-wide decision
 * ([TaskRuleConfigurationService]); which mandatory-field gaps exist is the administrator's field
 * configuration ([FieldConfigurationService.compute], via the mappers' `presenceOf` predicates, so the
 * to-do list and the `missingMandatoryFields` shown on detail panels can never disagree).
 *
 * A task lands on the list of the item's effective owner and effective steward — including
 * responsibility inherited from the owning unit — because those are exactly the people allowed to fix
 * it. The only per-user state is a [TaskDismissal], which is ignored again as soon as the underlying
 * item changes.
 */
@Singleton
open class TaskService(
    private val businessEntityRepository: BusinessEntityRepository,
    private val processRepository: ProcessRepository,
    private val businessDomainRepository: BusinessDomainRepository,
    private val organisationalUnitRepository: OrganisationalUnitRepository,
    private val dpiaRepository: DpiaRepository,
    private val fieldVerificationRepository: FieldVerificationRepository,
    private val taskDismissalRepository: TaskDismissalRepository,
    private val userRepository: UserRepository,
    private val fieldConfigurationService: FieldConfigurationService,
    private val methodologyConfigurationService: MethodologyConfigurationService,
    private val taskRuleConfigurationService: TaskRuleConfigurationService,
    private val businessEntityMapper: BusinessEntityMapper,
    private val processMapper: ProcessMapper,
    private val businessDomainMapper: BusinessDomainMapper,
    private val organisationalUnitMapper: OrganisationalUnitMapper
) {
    /** One derived to-do, before it is filtered per user and rendered. */
    data class DerivedTask(
        val entityType: String,
        val resourceType: TaskItemResourceType,
        val resourceKey: String,
        val names: List<LocalizedText>,
        val ruleCode: String,
        val priority: String,
        val severity: String,
        val fieldName: String?,
        val section: String?,
        val methodology: String?,
        val ownerId: Long?,
        val stewardId: Long?,
        val itemUpdatedAt: Instant?,
        /** True for rules only the owner can act on (verification is owner-only by design). */
        val ownerOnly: Boolean = false
    ) {
        val id: String get() = "$entityType:$resourceKey:$ruleCode:${fieldName ?: ""}"
    }

    /** Every check run against a single catalogue item, with the ones that failed. */
    private data class ItemResult(
        val ownerId: Long?,
        val stewardId: Long?,
        val checksEvaluated: Int,
        val tasks: List<DerivedTask>
    )

    @Transactional
    open fun getMyTasks(
        email: String,
        includeDismissed: Boolean
    ): TaskListResponse {
        val user =
            userRepository
                .findByEmail(email)
                .orElseThrow { ResourceNotFoundException("User not found") }
        val userId = user.id ?: return TaskListResponse(emptyList(), emptySummary())

        val results = deriveAll()
        val mine = results.filter { it.ownerId == userId || it.stewardId == userId }
        val dismissals = this.taskDismissalRepository.findByUserId(userId).associateBy { it.taskId }

        val rendered =
            mine
                .flatMap { it.tasks }
                .filter { task -> !(task.ownerOnly && task.ownerId != userId) }
                .map { task ->
                    val dismissal = dismissals[task.id]
                    val dismissed = isDismissalActive(dismissal, task.itemUpdatedAt)
                    toModel(task, userId, dismissed, if (dismissed) dismissal?.reason else null)
                }.filter { includeDismissed || it.dismissed != true }
                .sortedWith(taskOrder())

        val open = rendered.count { it.dismissed != true }
        val checksEvaluated = mine.sumOf { it.checksEvaluated }
        val checksPassed = checksEvaluated - mine.sumOf { it.tasks.size }
        val summary =
            TaskSummary(
                open,
                rendered.count { it.dismissed != true && it.priority == TaskItemPriority.REQUIRED },
                rendered.count { it.dismissed != true && it.priority == TaskItemPriority.RECOMMENDED },
                checksEvaluated,
                checksPassed
            ).completionPercentage(if (checksEvaluated == 0) null else checksPassed * 100 / checksEvaluated)
        return TaskListResponse(rendered, summary)
    }

    /**
     * Outstanding work grouped by the responsible owner. Items nobody owns are collected in a single
     * bucket with a null user, which is exactly the stewardship gap an administrator is looking for.
     */
    @Transactional
    open fun getTasksByOwner(): OwnerTaskLoadResponse {
        val userRepo = this.userRepository
        val dismissalsByUser = this.taskDismissalRepository.findAll().groupBy { it.user?.id }
        val usersById = userRepo.findAll().associateBy { it.id }

        val counts = LinkedHashMap<Long?, MutableList<DerivedTask>>()
        deriveAll().forEach { result ->
            result.tasks.forEach { task ->
                val dismissed =
                    dismissalsByUser[task.ownerId]
                        ?.find { it.taskId == task.id }
                        ?.let { isDismissalActive(it, task.itemUpdatedAt) } == true
                if (!dismissed) counts.getOrPut(task.ownerId) { mutableListOf() }.add(task)
            }
        }

        val owners =
            counts
                .map { (ownerId, tasks) ->
                    OwnerTaskLoadItem(
                        tasks.count { it.priority == TaskRuleCatalog.REQUIRED },
                        tasks.count { it.priority == TaskRuleCatalog.RECOMMENDED },
                        tasks.size
                    ).user(ownerId?.let { id -> usersById[id]?.let { UserMapper.toUserSummary(it) } })
                }.sortedWith(compareByDescending<OwnerTaskLoadItem> { it.required }.thenByDescending { it.total })
        return OwnerTaskLoadResponse(owners)
    }

    @Transactional
    open fun dismiss(
        email: String,
        taskId: String,
        reason: String
    ): TaskItem {
        val user =
            userRepository
                .findByEmail(email)
                .orElseThrow { ResourceNotFoundException("User not found") }
        val userId = user.id ?: throw ResourceNotFoundException("User not found")
        if (reason.isBlank()) throw IllegalArgumentException("A reason is required to dismiss a to-do")

        val task =
            deriveAll()
                .flatMap { it.tasks }
                .find { it.id == taskId }
                ?: throw ResourceNotFoundException("Task not found: $taskId")
        requireResponsible(task, userId)

        val repo = this.taskDismissalRepository
        // Clearing the stale row here (rather than during the read) keeps GET /tasks free of writes.
        repo.findByUserIdAndTaskId(userId, taskId).ifPresent { repo.delete(it) }
        repo.save(
            TaskDismissal().apply {
                this.taskId = taskId
                this.user = user
                this.reason = reason.trim().take(500)
                this.itemUpdatedAt = task.itemUpdatedAt
            }
        )
        return toModel(task, userId, dismissed = true, dismissedReason = reason.trim().take(500))
    }

    @Transactional
    open fun undismiss(
        email: String,
        taskId: String
    ) {
        val user =
            userRepository
                .findByEmail(email)
                .orElseThrow { ResourceNotFoundException("User not found") }
        val userId = user.id ?: throw ResourceNotFoundException("User not found")
        val repo = this.taskDismissalRepository
        val dismissal =
            repo
                .findByUserIdAndTaskId(userId, taskId)
                .orElseThrow { ResourceNotFoundException("Dismissal not found: $taskId") }
        repo.delete(dismissal)
    }

    // ── derivation ────────────────────────────────────────────────────────────────────────────────

    private fun deriveAll(): List<ItemResult> {
        val rules = taskRuleConfigurationService.effectiveRules().filterValues { it.enabled }
        if (rules.isEmpty()) return emptyList()
        val disabled = methodologyConfigurationService.getDisabledMethodologies()
        val dpiaRepo = this.dpiaRepository
        val dpias = dpiaRepo.findAll()
        val dpiaProcessKeys = dpias.mapNotNull { it.process?.key }.toSet()
        val openDpiaProcessKeys = dpias.filter { it.status == "IN_PROGRESS" }.mapNotNull { it.process?.key }.toSet()
        val openDpiaEntityKeys = dpias.filter { it.status == "IN_PROGRESS" }.mapNotNull { it.entity?.key }.toSet()

        val results = mutableListOf<ItemResult>()
        val entityMapper = this.businessEntityMapper
        val procMapper = this.processMapper
        val domainMapper = this.businessDomainMapper
        val unitMapper = this.organisationalUnitMapper

        this.businessEntityRepository.findAll().forEach { entity ->
            results +=
                evaluate(
                    entityType = "BUSINESS_ENTITY",
                    resourceType = TaskItemResourceType.ENTITY,
                    key = entity.key,
                    names = entity.names,
                    updatedAt = entity.updatedAt,
                    ownerId = entity.effectiveOwner()?.id,
                    stewardId = entity.effectiveSteward()?.id,
                    entityId = entity.id,
                    rules = rules,
                    disabled = disabled,
                    presence = entityMapper.presenceOf(entity),
                    extra = { rule -> entityRuleUnmet(rule, entity, openDpiaEntityKeys) }
                )
        }

        this.processRepository.findAll().forEach { process ->
            val handlesPersonalData = ProcessMapper.effectivelyHandlesPersonalData(process)
            results +=
                evaluate(
                    entityType = "BUSINESS_PROCESS",
                    resourceType = TaskItemResourceType.PROCESS,
                    key = process.key,
                    names = process.names,
                    updatedAt = process.updatedAt,
                    ownerId = process.effectiveOwner()?.id,
                    stewardId = process.effectiveSteward()?.id,
                    entityId = process.id,
                    rules = rules,
                    disabled = disabled,
                    presence = procMapper.presenceOf(process),
                    extra = { rule ->
                        processRuleUnmet(rule, process, handlesPersonalData, dpiaProcessKeys, openDpiaProcessKeys)
                    }
                )
        }

        this.businessDomainRepository.findAll().forEach { domain ->
            results +=
                evaluate(
                    entityType = "BUSINESS_DOMAIN",
                    resourceType = TaskItemResourceType.DOMAIN,
                    key = domain.key,
                    names = domain.names,
                    updatedAt = domain.updatedAt,
                    ownerId = domain.effectiveOwner()?.id,
                    stewardId = domain.effectiveSteward()?.id,
                    entityId = domain.id,
                    rules = rules,
                    disabled = disabled,
                    presence = domainMapper.presenceOf(domain),
                    extra = { rule -> domainRuleUnmet(rule, domain) }
                )
        }

        this.organisationalUnitRepository.findAll().forEach { unit ->
            results +=
                evaluate(
                    entityType = "ORGANISATIONAL_UNIT",
                    resourceType = TaskItemResourceType.ORG_UNIT,
                    key = unit.key,
                    names = unit.names,
                    updatedAt = unit.updatedAt,
                    ownerId = unit.effectiveOwner()?.id,
                    stewardId = unit.effectiveSteward()?.id,
                    entityId = unit.id,
                    rules = rules,
                    disabled = disabled,
                    presence = unitMapper.presenceOf(unit),
                    extra = { rule -> unitRuleUnmet(rule, unit) }
                )
        }

        return results
    }

    /**
     * Runs every enabled rule for one catalogue item. [extra] answers the type-specific rules and
     * returns null when the rule does not apply to this item, in which case it is not counted as a
     * check either — a process without personal data is not "passing" the legal-basis check, the check
     * simply never runs.
     */
    @Suppress("LongParameterList")
    private fun evaluate(
        entityType: String,
        resourceType: TaskItemResourceType,
        key: String,
        names: List<LocalizedText>,
        updatedAt: Instant?,
        ownerId: Long?,
        stewardId: Long?,
        entityId: Long?,
        rules: Map<String, TaskRuleConfigurationService.EffectiveRule>,
        disabled: Set<String>,
        presence: (String) -> Boolean,
        extra: (String) -> Boolean?
    ): ItemResult {
        val tasks = mutableListOf<DerivedTask>()
        var checks = 0

        fun add(
            ruleCode: String,
            fieldName: String?,
            section: String?
        ) {
            val rule = rules.getValue(ruleCode)
            tasks +=
                DerivedTask(
                    entityType = entityType,
                    resourceType = resourceType,
                    resourceKey = key,
                    names = names,
                    ruleCode = ruleCode,
                    priority = rule.priority,
                    severity = rule.definition.severity,
                    fieldName = fieldName,
                    section = section ?: rule.definition.section,
                    methodology = rule.definition.methodology,
                    ownerId = ownerId,
                    stewardId = stewardId,
                    itemUpdatedAt = updatedAt,
                    ownerOnly = ruleCode == "UNVERIFIED_FIELD"
                )
        }

        rules.values.forEach { effective ->
            val def = effective.definition
            if (def.entityType != TaskRuleCatalog.ALL_TYPES && def.entityType != entityType) return@forEach
            when (def.code) {
                "MISSING_MANDATORY_FIELD" -> {
                    val fc = fieldConfigurationService.compute(entityType, disabled, presence)
                    checks += fc.mandatory?.size ?: 0
                    fc.missing?.forEach { fieldName ->
                        add(def.code, fieldName, fieldConfigurationService.sectionOf(entityType, fieldName))
                    }
                }

                "MISSING_OWNER" -> {
                    checks++
                    if (ownerId == null) add(def.code, ownerFieldOf(entityType), null)
                }

                "MISSING_STEWARD" -> {
                    checks++
                    if (stewardId == null) add(def.code, stewardFieldOf(entityType), null)
                }

                "UNVERIFIED_FIELD" -> {
                    if (entityId != null && methodologyConfigurationService.isVerificationEnabled(entityType)) {
                        val statuses = this.fieldVerificationRepository.findByEntityTypeAndEntityId(entityType, entityId)
                        checks += statuses.size
                        statuses
                            .filter { it.status == FieldVerificationService.UNVERIFIED }
                            .forEach { row ->
                                add(def.code, row.fieldName, fieldConfigurationService.sectionOf(entityType, row.fieldName))
                            }
                    }
                }

                else -> {
                    val unmet = extra(def.code)
                    if (unmet != null) {
                        checks++
                        if (unmet) add(def.code, def.fieldName, null)
                    }
                }
            }
        }

        return ItemResult(ownerId, stewardId, checks, tasks)
    }

    private fun entityRuleUnmet(
        ruleCode: String,
        entity: BusinessEntity,
        openDpiaEntityKeys: Set<String>
    ): Boolean? =
        when (ruleCode) {
            "ENTITY_NO_BOUNDED_CONTEXT" -> entity.boundedContext == null
            "DPIA_IN_PROGRESS" -> if (entity.key in openDpiaEntityKeys) true else null
            else -> null
        }

    private fun processRuleUnmet(
        ruleCode: String,
        process: Process,
        handlesPersonalData: Boolean,
        dpiaProcessKeys: Set<String>,
        openDpiaProcessKeys: Set<String>
    ): Boolean? =
        when (ruleCode) {
            "NO_LEGAL_BASIS" -> {
                if (handlesPersonalData) process.legalBasis.isNullOrBlank() else null
            }
            "MISSING_PURPOSE" -> {
                if (handlesPersonalData) process.purpose.isNullOrEmpty() else null
            }
            "DPIA_IN_PROGRESS" -> {
                if (process.key in openDpiaProcessKeys) true else null
            }
            "DPIA_RECOMMENDED" -> {
                if (handlesPersonalData) process.key !in dpiaProcessKeys else null
            }
            "NO_EXECUTING_UNIT" -> {
                process.executingUnits.isEmpty()
            }
            "NO_ENTITY_COVERAGE" -> {
                ProcessMapper.collectEffectiveEntities(process) { it.inputEntities }.isEmpty() &&
                    ProcessMapper.collectEffectiveEntities(process) { it.outputEntities }.isEmpty()
            }

            else -> {
                null
            }
        }

    private fun domainRuleUnmet(
        ruleCode: String,
        domain: BusinessDomain
    ): Boolean? =
        when (ruleCode) {
            "DOMAIN_NO_BOUNDED_CONTEXT" -> domain.boundedContexts.isNullOrEmpty()
            else -> null
        }

    private fun unitRuleUnmet(
        ruleCode: String,
        unit: OrganisationalUnit
    ): Boolean? =
        when (ruleCode) {
            "MISSING_MISSION_STATEMENT" -> unit.missionStatement.isEmpty()
            "MISSING_TOPOLOGY_TYPE" -> unit.teamTopologyType.isNullOrBlank()
            else -> null
        }

    // ── helpers ───────────────────────────────────────────────────────────────────────────────────

    private fun ownerFieldOf(entityType: String) =
        when (entityType) {
            "BUSINESS_ENTITY" -> "dataOwner"
            "BUSINESS_PROCESS" -> "processOwner"
            "BUSINESS_DOMAIN" -> "owningUnit"
            else -> "businessOwner"
        }

    private fun stewardFieldOf(entityType: String) =
        when (entityType) {
            "BUSINESS_ENTITY" -> "dataSteward"
            "BUSINESS_PROCESS" -> "processSteward"
            "BUSINESS_DOMAIN" -> "owningUnit"
            else -> "businessSteward"
        }

    private fun requireResponsible(
        task: DerivedTask,
        userId: Long
    ) {
        if (task.ownerId != userId && task.stewardId != userId) {
            throw ForbiddenOperationException("Only the owner or steward of this item may dismiss its to-dos")
        }
    }

    /** A dismissal stops counting once the item has been touched again. */
    private fun isDismissalActive(
        dismissal: TaskDismissal?,
        itemUpdatedAt: Instant?
    ): Boolean {
        if (dismissal == null) return false
        val snapshot = dismissal.itemUpdatedAt ?: return true
        return itemUpdatedAt == null || !itemUpdatedAt.isAfter(snapshot)
    }

    private fun toModel(
        task: DerivedTask,
        userId: Long,
        dismissed: Boolean,
        dismissedReason: String?
    ): TaskItem =
        TaskItem(
            task.id,
            task.resourceType,
            task.resourceKey,
            LocalizedTextMapper.toModel(task.names),
            task.ruleCode,
            TaskItemPriority.valueOf(task.priority),
            TaskItemSeverity.valueOf(task.severity),
            if (task.ownerId == userId) TaskItemResponsibility.OWNER else TaskItemResponsibility.STEWARD,
            dismissed
        ).fieldName(task.fieldName)
            .section(task.section)
            .methodology(task.methodology)
            .dismissedReason(dismissedReason)

    private fun taskOrder(): Comparator<TaskItem> =
        compareBy<TaskItem> { if (it.priority == TaskItemPriority.REQUIRED) 0 else 1 }
            .thenBy { severityRank(it.severity) }
            .thenBy { it.resourceNames.firstOrNull()?.text ?: it.resourceKey }
            .thenBy { it.ruleCode }
            .thenBy { it.fieldName ?: "" }

    private fun severityRank(severity: TaskItemSeverity) =
        when (severity) {
            TaskItemSeverity.ERROR -> 0
            TaskItemSeverity.WARNING -> 1
            else -> 2
        }

    private fun emptySummary() = TaskSummary(0, 0, 0, 0, 0).completionPercentage(null)
}
