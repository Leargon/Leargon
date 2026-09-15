package org.leargon.backend.service.advisor

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.BusinessEntity
import org.leargon.backend.domain.LocalizedText
import org.leargon.backend.domain.Process
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.mapper.LocalizedTextMapper
import org.leargon.backend.mapper.UserMapper
import org.leargon.backend.model.AdvisorAnswer
import org.leargon.backend.model.AdvisorAnswerType
import org.leargon.backend.model.AdvisorConnectionType
import org.leargon.backend.model.AdvisorConsequence
import org.leargon.backend.model.AdvisorEvaluateRequest
import org.leargon.backend.model.AdvisorEvaluateResponse
import org.leargon.backend.model.AdvisorEvaluateResponseStatus
import org.leargon.backend.model.AdvisorOptionDef
import org.leargon.backend.model.AdvisorOutcomeDef
import org.leargon.backend.model.AdvisorPickerItem
import org.leargon.backend.model.AdvisorPlacementType
import org.leargon.backend.model.AdvisorPrefill
import org.leargon.backend.model.AdvisorQuestion
import org.leargon.backend.model.AdvisorQuestionDef
import org.leargon.backend.model.AdvisorRecommendation
import org.leargon.backend.model.AdvisorRelationshipPrefill
import org.leargon.backend.model.AdvisorRuleSet
import org.leargon.backend.model.CreatableItemType
import org.leargon.backend.repository.BoundedContextRepository
import org.leargon.backend.repository.BusinessDomainRepository
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.CapabilityRepository
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.service.CreationPolicyService
import org.leargon.backend.service.CreationTarget
import org.leargon.backend.service.DefaultLocaleProvider
import org.leargon.backend.service.DuplicateCandidateService
import org.leargon.backend.service.MethodologyConfigurationService
import org.leargon.backend.service.advisor.AdvisorRuleCatalog.AnswerType
import org.leargon.backend.service.advisor.AdvisorRuleCatalog.OutcomeDef
import org.leargon.backend.service.advisor.AdvisorRuleCatalog.Placement
import org.leargon.backend.service.advisor.AdvisorRuleCatalog.QuestionDef
import org.leargon.backend.service.advisor.AdvisorRuleCatalog.RuleSetDef
import org.leargon.backend.model.CreationBasis as CreationBasisDto

/**
 * Replays a user's answers against an [AdvisorRuleCatalog] tree and returns either the next question
 * (with the items to pick from, each marked whether the user may create there) or a recommendation.
 *
 * A recommendation carries the placement as a wizard prefill, whether the creation policy allows the user
 * to create there (and otherwise who is responsible for that place), live consequences of the choice
 * (register roll-ups, resulting owner, cross-context links), and duplicate candidates for the proposed
 * name at the recommended place. Stateless: the same answers always give the same result.
 */
@Singleton
open class AdvisorService(
    private val creationPolicyService: CreationPolicyService,
    private val methodologyConfigurationService: MethodologyConfigurationService,
    private val duplicateCandidateService: DuplicateCandidateService,
    private val defaultLocaleProvider: DefaultLocaleProvider,
    private val businessEntityRepository: BusinessEntityRepository,
    private val processRepository: ProcessRepository,
    private val businessDomainRepository: BusinessDomainRepository,
    private val boundedContextRepository: BoundedContextRepository,
    private val organisationalUnitRepository: OrganisationalUnitRepository,
    private val capabilityRepository: CapabilityRepository
) {
    fun ruleSets(): List<AdvisorRuleSet> = AdvisorRuleCatalog.ruleSets.map { toModel(it) }

    @Transactional
    open fun evaluate(
        user: User,
        request: AdvisorEvaluateRequest
    ): AdvisorEvaluateResponse {
        val ruleSet =
            AdvisorRuleCatalog.byCode(request.ruleSetCode)
                ?: throw ResourceNotFoundException("Advisor rule set not found: ${request.ruleSetCode}")
        val dddDisabled = DDD in methodologyConfigurationService.getDisabledMethodologies()

        val answered = LinkedHashMap<String, String>()
        val rationales = mutableListOf<String>()
        var relationship: AdvisorRuleCatalog.RelationshipShape? = null
        var pickedName: String? = null
        var current: QuestionDef? = ruleSet.question(ruleSet.rootQuestion)
        var outcome: OutcomeDef? = null
        // Started from an item ("Add child" on it): the server applies the rule set's context answers and answers
        // every picker asking for an item of that type with it — the client sends only the remaining answers.
        val context = request.contextItemKey
        val contextType = ruleSet.contextItemType
        if (context != null && (contextType == null || items(contextType).none { it.key == context })) {
            throw IllegalArgumentException("${ruleSet.code} cannot be started from item '$context'")
        }
        val pending = ArrayDeque<AdvisorAnswer>()
        if (context != null) ruleSet.contextAnswers.forEach { pending.addLast(AdvisorAnswer(it.questionCode).optionCode(it.optionCode)) }
        request.answers.orEmpty().forEach { pending.addLast(it) }
        while (true) {
            val question = current ?: break
            val answer =
                if (context != null && question.answerType == AnswerType.ITEM_PICKER && pickerType(question, dddDisabled) == contextType) {
                    AdvisorAnswer(question.code).itemKey(context)
                } else {
                    pending.removeFirstOrNull() ?: break
                }
            if (answer.questionCode != question.code) {
                throw IllegalArgumentException("Expected an answer to ${question.code}, got ${answer.questionCode}")
            }
            val (next, outcomeCode) =
                when (question.answerType) {
                    AnswerType.SINGLE_CHOICE, AnswerType.BOOLEAN -> {
                        val option =
                            question.options.firstOrNull { it.code == answer.optionCode }
                                ?: throw IllegalArgumentException("Unknown option '${answer.optionCode}' for ${question.code}")
                        answered[question.code] = option.code
                        option.rationale?.let { rationales += it }
                        option.relationship?.let { relationship = it }
                        option.next to option.outcome
                    }
                    AnswerType.ITEM_PICKER -> {
                        val key = answer.itemKey ?: throw IllegalArgumentException("${question.code} expects an item key")
                        val item =
                            items(pickerType(question, dddDisabled)).firstOrNull { it.key == key }
                                ?: throw IllegalArgumentException("Unknown item '$key' for ${question.code}")
                        answered[question.code] = key
                        pickedName = name(item.names)
                        question.next to question.outcome
                    }
                }
            current = next?.let { ruleSet.question(it) }
            outcome = outcomeCode?.let { ruleSet.outcome(it) }
        }
        pending.firstOrNull()?.let {
            throw IllegalArgumentException("The advisor already reached a recommendation; no answer to ${it.questionCode} expected")
        }

        val proposedNames =
            request.proposedNames
                .orEmpty()
                .map { it.text }
                .filter { it.isNotBlank() }
        val response =
            AdvisorEvaluateResponse(
                if (outcome != null) AdvisorEvaluateResponseStatus.RECOMMENDATION else AdvisorEvaluateResponseStatus.QUESTION,
                answered.keys.toList(),
                emptyList()
            )
        if (outcome == null) {
            val question = current ?: throw IllegalStateException("Rule set ${ruleSet.code} has a dead end")
            return response
                .question(toQuestion(user, ruleSet, question, dddDisabled, pickedName))
                .duplicateCandidates(duplicateCandidateService.candidates(CreationTarget(ruleSet.itemType), proposedNames))
        }
        val (recommendation, target) = recommend(user, ruleSet, outcome, answered, dddDisabled, rationales, relationship)
        return response
            .recommendation(recommendation)
            .duplicateCandidates(duplicateCandidateService.candidates(target, proposedNames))
    }

    // ── questions ─────────────────────────────────────────────────────────────────────────────────

    /** While DDD is disabled, entities and processes are placed via their owning unit instead of a context. */
    private fun pickerType(
        question: QuestionDef,
        dddDisabled: Boolean
    ): String? =
        if (question.pickerItemType == CreationPolicyService.BOUNDED_CONTEXT && dddDisabled) {
            CreationPolicyService.ORGANISATIONAL_UNIT
        } else {
            question.pickerItemType
        }

    private fun toQuestion(
        user: User,
        ruleSet: RuleSetDef,
        question: QuestionDef,
        dddDisabled: Boolean,
        pickedName: String?
    ): AdvisorQuestion {
        val type = pickerType(question, dddDisabled)
        val items =
            if (question.answerType == AnswerType.ITEM_PICKER && type != null) {
                val outcomeType = question.outcome?.let { ruleSet.outcome(it) }?.itemType ?: ruleSet.itemType
                pickerItems(user, type, outcomeType, question.forPlacement)
            } else {
                emptyList()
            }
        return AdvisorQuestion(
            question.code, AdvisorAnswerType.fromValue(question.answerType.name),
            question.options.map {
                it.code
            },
            items
        ).pickerItemType(type?.let { CreatableItemType.fromValue(it) })
            // "Does it cease to exist when Order is deleted?" — questions refer to the item picked last.
            .params(pickedName?.let { mapOf("picked" to it) } ?: emptyMap())
    }

    private data class Item(
        val key: String,
        val names: List<LocalizedText>,
        val containerNames: List<LocalizedText>
    )

    private fun items(type: String?): List<Item> =
        when (type) {
            CreationPolicyService.BUSINESS_ENTITY -> {
                businessEntityRepository.findAll().map {
                    Item(
                        it.key, it.names,
                        it.boundedContext
                            ?.names
                            .orEmpty()
                    )
                }
            }
            CreationPolicyService.BUSINESS_PROCESS -> {
                processRepository.findAll().map {
                    Item(
                        it.key, it.names,
                        it.boundedContext
                            ?.names
                            .orEmpty()
                    )
                }
            }
            CreationPolicyService.BUSINESS_DOMAIN -> {
                businessDomainRepository.findAll().map {
                    Item(
                        it.key, it.names,
                        it.parent
                            ?.names
                            .orEmpty()
                    )
                }
            }
            CreationPolicyService.BOUNDED_CONTEXT -> {
                boundedContextRepository.findAll().map {
                    Item(
                        it.key, it.names,
                        it.domain
                            ?.names
                            .orEmpty()
                    )
                }
            }
            CreationPolicyService.ORGANISATIONAL_UNIT -> {
                organisationalUnitRepository.findAll().map { Item(it.key, it.names, emptyList()) }
            }
            CreationPolicyService.CAPABILITY -> {
                capabilityRepository.findAll().map { Item(it.key, it.names, it.parent?.names.orEmpty()) }
            }
            else -> {
                emptyList()
            }
        }

    /** All items of [type], each marked whether the user may create an [outcomeType] item there. */
    private fun pickerItems(
        user: User,
        type: String,
        outcomeType: String,
        forPlacement: Boolean
    ): List<AdvisorPickerItem> {
        val policy = creationPolicyService
        return items(type).map { item ->
            val creatable = !forPlacement || policy.decide(user, placementTarget(outcomeType, type, item.key)).allowed
            AdvisorPickerItem(item.key, LocalizedTextMapper.toModel(item.names), creatable)
                .containerNames(LocalizedTextMapper.toModel(item.containerNames))
        }
    }

    /** The creation target of an [itemType] item placed at [key] of [pickedType]. */
    private fun placementTarget(
        itemType: String,
        pickedType: String,
        key: String
    ): CreationTarget =
        when {
            pickedType == itemType && itemType == CreationPolicyService.ORGANISATIONAL_UNIT -> {
                CreationTarget(itemType, parentKeys = listOf(key))
            }
            pickedType == itemType -> {
                CreationTarget(itemType, parentKey = key)
            }
            pickedType == CreationPolicyService.BOUNDED_CONTEXT -> {
                CreationTarget(itemType, boundedContextKey = key)
            }
            pickedType == CreationPolicyService.BUSINESS_DOMAIN -> {
                CreationTarget(itemType, domainKey = key)
            }
            pickedType == CreationPolicyService.ORGANISATIONAL_UNIT -> {
                CreationTarget(itemType, owningUnitKey = key)
            }
            else -> {
                CreationTarget(itemType)
            }
        }

    // ── recommendation ────────────────────────────────────────────────────────────────────────────

    private fun recommend(
        user: User,
        ruleSet: RuleSetDef,
        outcome: OutcomeDef,
        answered: Map<String, String>,
        dddDisabled: Boolean,
        rationales: List<String>,
        relationship: AdvisorRuleCatalog.RelationshipShape?
    ): Pair<AdvisorRecommendation, CreationTarget> {
        val itemType = outcome.itemType ?: ruleSet.itemType
        val picked = { code: String? -> code?.let { answered[it] } }
        val pickedType = { code: String? -> code?.let { ruleSet.question(it) }?.let { pickerType(it, dddDisabled) } }

        val target =
            when (outcome.placement) {
                Placement.CHILD -> {
                    placementTarget(itemType, itemType, picked(outcome.placementFrom)!!)
                }
                Placement.NEW_ROOT -> {
                    val containerKey = picked(outcome.placementFrom)
                    if (containerKey != null) {
                        placementTarget(itemType, pickedType(outcome.placementFrom)!!, containerKey)
                    } else {
                        containerOf(itemType, picked(outcome.containerOf), dddDisabled)
                    }
                }
                Placement.TOP_LEVEL -> {
                    CreationTarget(itemType)
                }
            }
        val relatedKey = picked(outcome.relatedFrom)

        val decision = creationPolicyService.decide(user, target)
        val prefill =
            AdvisorPrefill(CreatableItemType.fromValue(itemType), AdvisorConnectionType.fromValue(outcome.connection.name))
                .parentKey(target.parentKey ?: target.parentKeys.firstOrNull())
                .boundedContextKey(target.boundedContextKey)
                .domainKey(target.domainKey)
                .owningUnitKey(target.owningUnitKey)
                .relatedItemKey(relatedKey)
        // A root entity recommended "with a relationship" is created together with it (one request).
        if (outcome.connection == AdvisorRuleCatalog.Connection.RELATIONSHIP && relatedKey != null && relationship != null) {
            prefill.relationship(
                AdvisorRelationshipPrefill(relatedKey, relationship.firstMinimum, relationship.secondMinimum)
                    .firstCardinalityMaximum(relationship.firstMaximum)
                    .secondCardinalityMaximum(relationship.secondMaximum)
            )
        }
        val recommendation =
            AdvisorRecommendation(
                outcome.code,
                AdvisorPlacementType.fromValue(outcome.placement.name),
                (rationales + outcome.rationaleCodes).distinct(),
                outcome.consequenceCodes.mapNotNull { consequence(it, user, itemType, target, relatedKey) },
                decision.allowed,
                prefill
            ).basis(decision.basis?.let { CreationBasisDto.fromValue(it.name) })
                .responsibleOwner(if (decision.allowed) null else responsibleOwner(target)?.let { UserMapper.toUserSummary(it) })
        return recommendation to target
    }

    /** "Put it next to X": the new item goes into the same container as the picked item. */
    private fun containerOf(
        itemType: String,
        key: String?,
        dddDisabled: Boolean
    ): CreationTarget {
        if (key == null) return CreationTarget(itemType)
        return when (itemType) {
            CreationPolicyService.BUSINESS_ENTITY -> {
                businessEntityRepository.findByKey(key).orElse(null).let { e ->
                    if (dddDisabled) {
                        CreationTarget(itemType, owningUnitKey = e?.effectiveOwningUnit()?.key)
                    } else {
                        CreationTarget(itemType, boundedContextKey = e?.boundedContext?.key)
                    }
                }
            }
            CreationPolicyService.BUSINESS_PROCESS -> {
                processRepository.findByKey(key).orElse(null).let { p ->
                    if (dddDisabled) {
                        CreationTarget(itemType, owningUnitKey = p?.effectiveOwningUnit()?.key)
                    } else {
                        CreationTarget(itemType, boundedContextKey = p?.boundedContext?.key)
                    }
                }
            }
            else -> {
                CreationTarget(itemType)
            }
        }
    }

    /** Who is responsible for the place a creation was refused at — the person to ask. */
    private fun responsibleOwner(target: CreationTarget): User? =
        when {
            target.parentKey != null -> {
                when (target.itemType) {
                    CreationPolicyService.BUSINESS_ENTITY -> {
                        businessEntityRepository
                            .findByKey(target.parentKey)
                            .orElse(null)
                            ?.effectiveOwner()
                    }
                    CreationPolicyService.BUSINESS_PROCESS -> {
                        processRepository.findByKey(target.parentKey).orElse(null)?.effectiveOwner()
                    }
                    CreationPolicyService.BUSINESS_DOMAIN -> {
                        businessDomainRepository
                            .findByKey(target.parentKey)
                            .orElse(null)
                            ?.effectiveOwner()
                    }
                    CreationPolicyService.CAPABILITY -> {
                        capabilityRepository.findByKey(target.parentKey).orElse(null)?.effectiveOwner()
                    }
                    else -> {
                        null
                    }
                }
            }
            target.parentKeys.isNotEmpty() -> {
                organisationalUnitRepository.findByKey(target.parentKeys.first()).orElse(null)?.effectiveOwner()
            }
            target.boundedContextKey != null -> {
                boundedContextRepository.findByKey(target.boundedContextKey).orElse(null)?.effectiveOwner()
            }
            target.domainKey != null -> {
                businessDomainRepository.findByKey(target.domainKey).orElse(null)?.effectiveOwner()
            }
            target.owningUnitKey != null -> {
                organisationalUnitRepository.findByKey(target.owningUnitKey).orElse(null)?.effectiveOwner()
            }
            else -> {
                null
            }
        }

    // ── consequences ──────────────────────────────────────────────────────────────────────────────

    private fun name(names: List<LocalizedText>): String {
        val locale = defaultLocaleProvider.code()
        return names.firstOrNull { it.locale == locale }?.text ?: names.firstOrNull()?.text ?: ""
    }

    private fun rootOf(entity: BusinessEntity): BusinessEntity {
        val visited = mutableSetOf<String>()
        var current = entity
        while (current.parent != null && visited.add(current.key)) current = current.parent!!
        return current
    }

    private fun rootOf(process: Process): Process {
        val visited = mutableSetOf<String>()
        var current = process
        while (current.parent != null && visited.add(current.key)) current = current.parent!!
        return current
    }

    private fun userName(user: User?): String? = user?.let { "${it.firstName} ${it.lastName}".trim().ifBlank { it.username } }

    /**
     * One consequence of the recommended placement, computed from live data, or null when it does not
     * apply to this particular placement (e.g. no cross-context link when both items share a context).
     */
    private fun consequence(
        code: String,
        user: User,
        itemType: String,
        target: CreationTarget,
        relatedKey: String?
    ): AdvisorConsequence? {
        val params: Map<String, String> =
            when (code) {
                "ENTITY_ROLLS_UP_TO_ROOT" -> {
                    val parent = target.parentKey?.let { businessEntityRepository.findByKey(it).orElse(null) } ?: return null
                    mapOf("root" to name(rootOf(parent).names))
                }
                "INHERITS_BOUNDED_CONTEXT" -> {
                    val parent = target.parentKey?.let { businessEntityRepository.findByKey(it).orElse(null) } ?: return null
                    val bc = parent.boundedContext ?: return null
                    mapOf("context" to name(bc.names))
                }
                "REGISTER_ROLLS_INTO_ROOT", "DATA_FLOW_ROLLS_UP" -> {
                    val parent = target.parentKey?.let { processRepository.findByKey(it).orElse(null) } ?: return null
                    mapOf("root" to name(rootOf(parent).names))
                }
                "CROSS_CONTEXT_LINK" -> {
                    val related = relatedKey?.let { businessEntityRepository.findByKey(it).orElse(null) } ?: return null
                    val relatedContext = related.boundedContext ?: return null
                    val context = target.boundedContextKey ?: return null
                    if (relatedContext.key == context) return null
                    val contextName = boundedContextRepository.findByKey(context).orElse(null)?.names ?: return null
                    mapOf("relatedContext" to name(relatedContext.names), "context" to name(contextName))
                }
                "RELATIONSHIP_CREATED" -> {
                    val related = relatedKey?.let { businessEntityRepository.findByKey(it).orElse(null) } ?: return null
                    mapOf("related" to name(related.names))
                }
                "RESULTING_EFFECTIVE_OWNER" -> {
                    val owner =
                        when (itemType) {
                            // New entities, processes and units default to their creator as owner.
                            CreationPolicyService.BUSINESS_ENTITY, CreationPolicyService.BUSINESS_PROCESS,
                            CreationPolicyService.ORGANISATIONAL_UNIT -> user
                            // Bounded contexts and capabilities inherit from where they are placed.
                            else -> responsibleOwner(target)
                        } ?: return null
                    mapOf("owner" to (userName(owner) ?: return null))
                }
                "INHERITS_OWNER" -> {
                    val owner = responsibleOwner(target) ?: return null
                    mapOf("owner" to (userName(owner) ?: return null))
                }
                "CAPABILITY_LEVEL" -> {
                    val parent = target.parentKey?.let { capabilityRepository.findByKey(it).orElse(null) } ?: return null
                    var depth = 1
                    var current = parent.parent
                    val visited = mutableSetOf(parent.key)
                    while (current != null && visited.add(current.key)) {
                        depth++
                        current = current.parent
                    }
                    mapOf("level" to (depth + 1).toString())
                }
                else -> {
                    emptyMap()
                }
            }
        return AdvisorConsequence(code, params)
    }

    // ── definitions ───────────────────────────────────────────────────────────────────────────────

    private fun toModel(ruleSet: RuleSetDef): AdvisorRuleSet =
        AdvisorRuleSet(
            ruleSet.code,
            CreatableItemType.fromValue(ruleSet.itemType),
            ruleSet.rootQuestion,
            ruleSet.questions.map { q ->
                AdvisorQuestionDef(q.code, AdvisorAnswerType.fromValue(q.answerType.name))
                    .options(q.options.map { AdvisorOptionDef(it.code).next(it.next).outcome(it.outcome).rationaleCode(it.rationale) })
                    .pickerItemType(q.pickerItemType?.let { CreatableItemType.fromValue(it) })
                    .next(q.next)
                    .outcome(q.outcome)
            },
            ruleSet.outcomes.map { o ->
                AdvisorOutcomeDef(o.code, AdvisorPlacementType.fromValue(o.placement.name), o.rationaleCodes, o.consequenceCodes)
                    .itemType(o.itemType?.let { CreatableItemType.fromValue(it) })
                    .connectionType(AdvisorConnectionType.fromValue(o.connection.name))
            }
        ).methodology(ruleSet.methodology)

    companion object {
        private const val DDD = "DDD"
    }
}
