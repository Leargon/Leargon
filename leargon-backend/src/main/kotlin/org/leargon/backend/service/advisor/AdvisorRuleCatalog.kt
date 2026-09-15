package org.leargon.backend.service.advisor

/**
 * The guided modelling advisor's decision trees — deterministic and explainable, not an LLM.
 *
 * Deliberately data, like the to-do rule catalogue: each rule set is a tree of typed questions whose
 * options (or picked items) lead to further questions or to an outcome. [AdvisorService] replays a user's
 * answers against a tree statelessly, so the same answers always give the same recommendation. Texts are
 * not stored here: the frontend renders every question, option, outcome, rationale and consequence from
 * i18n keyed by its code.
 */
object AdvisorRuleCatalog {
    enum class AnswerType { SINGLE_CHOICE, BOOLEAN, ITEM_PICKER }

    /** Where the recommended item goes: under a picked parent, into a picked container, or top level. */
    enum class Placement { CHILD, NEW_ROOT, TOP_LEVEL }

    /** How the new item is additionally connected to a picked item. */
    enum class Connection { NONE, RELATIONSHIP, INTERFACE, CALLED_PROCESS }

    const val YES = "yes"
    const val NO = "no"

    /**
     * Cardinalities of a relationship between the new entity (first side) and a picked one (second side):
     * how many entities of a side relate to one of the other side; a null maximum means many.
     */
    data class RelationshipShape(
        val firstMinimum: Int,
        val firstMaximum: Int?,
        val secondMinimum: Int,
        val secondMaximum: Int?
    )

    /**
     * An answer option. [rationale] is the reason this answer contributes to the recommendation (so the
     * explanation follows the path actually taken); [relationship] shapes a relationship outcome.
     */
    data class OptionDef(
        val code: String,
        val next: String? = null,
        val outcome: String? = null,
        val rationale: String? = null,
        val relationship: RelationshipShape? = null
    )

    /**
     * A question. Pickers name the item type to choose from; [forPlacement] is false for pickers that only
     * name an item to connect to (their items are not judged by whether the user may create there).
     */
    data class QuestionDef(
        val code: String,
        val answerType: AnswerType,
        val options: List<OptionDef> = emptyList(),
        val pickerItemType: String? = null,
        val next: String? = null,
        val outcome: String? = null,
        val forPlacement: Boolean = true
    )

    /**
     * A recommendation. [placementFrom] names the picker whose item is the parent (CHILD) or container
     * (NEW_ROOT); [containerOf] names a picker whose item's own container is used instead (e.g. "put it
     * next to X"); [relatedFrom] names the picker whose item the new one is connected to. [itemType]
     * overrides the rule set's item type (the domain advisor may recommend a bounded context).
     */
    data class OutcomeDef(
        val code: String,
        val placement: Placement,
        val rationaleCodes: List<String>,
        val consequenceCodes: List<String>,
        val placementFrom: String? = null,
        val containerOf: String? = null,
        val connection: Connection = Connection.NONE,
        val relatedFrom: String? = null,
        val itemType: String? = null
    )

    /** An option the server chooses when the tree is started from an item (`contextItemKey`). */
    data class ContextAnswer(
        val questionCode: String,
        val optionCode: String
    )

    data class RuleSetDef(
        val code: String,
        val itemType: String,
        val methodology: String,
        val rootQuestion: String,
        val questions: List<QuestionDef>,
        val outcomes: List<OutcomeDef>,
        /**
         * The item type the tree can be started from ("Add child" on it). Started so, every picker asking for
         * an item of this type is answered with that item, after the [contextAnswers] are applied.
         */
        val contextItemType: String? = null,
        val contextAnswers: List<ContextAnswer> = emptyList()
    ) {
        fun question(code: String): QuestionDef? = questions.firstOrNull { it.code == code }

        fun outcome(code: String): OutcomeDef? = outcomes.firstOrNull { it.code == code }
    }

    private fun yesNo(
        yes: OptionDef,
        no: OptionDef
    ) = listOf(yes, no)

    val ruleSets: List<RuleSetDef> =
        listOf(
            // ── Business entities — the core question: a child of an existing entity, or a new root entity
            //    connected to it by a relationship? A child only when it shares the other entity's lifecycle,
            //    has no identity of its own and needs no responsibility of its own; otherwise a root, created
            //    together with its relationship. Specialisations and standalone concepts are side branches. ──
            RuleSetDef(
                code = "ENTITY_PLACEMENT",
                itemType = "BUSINESS_ENTITY",
                methodology = "DATA_GOVERNANCE",
                rootQuestion = "entity.relation",
                // "Add child" on an entity: it is connected to that entity — go straight to lifecycle/identity/responsibility.
                contextItemType = "BUSINESS_ENTITY",
                contextAnswers = listOf(ContextAnswer("entity.relation", "connected")),
                questions =
                    listOf(
                        QuestionDef(
                            "entity.relation",
                            AnswerType.SINGLE_CHOICE,
                            options =
                                listOf(
                                    OptionDef("connected", next = "entity.relatedPick"),
                                    OptionDef("kindOf", next = "entity.generalPick"),
                                    OptionDef("standalone", next = "entity.contextPick"),
                                )
                        ),
                        // Only names the entity; whether the user may create under / next to it is judged at the outcome.
                        QuestionDef(
                            "entity.relatedPick",
                            AnswerType.ITEM_PICKER,
                            pickerItemType = "BUSINESS_ENTITY",
                            next = "entity.lifecycle",
                            forPlacement = false
                        ),
                        QuestionDef(
                            "entity.lifecycle",
                            AnswerType.BOOLEAN,
                            options =
                                yesNo(
                                    OptionDef(YES, next = "entity.identity", rationale = "lifecycleBound"),
                                    OptionDef(NO, next = "entity.cardinality", rationale = "independentLifecycle")
                                )
                        ),
                        QuestionDef(
                            "entity.identity",
                            AnswerType.BOOLEAN,
                            options =
                                yesNo(
                                    OptionDef(YES, next = "entity.cardinality", rationale = "ownIdentity"),
                                    OptionDef(NO, next = "entity.responsibility", rationale = "noOwnIdentity")
                                )
                        ),
                        QuestionDef(
                            "entity.responsibility",
                            AnswerType.BOOLEAN,
                            options =
                                yesNo(
                                    OptionDef(YES, next = "entity.cardinality", rationale = "ownResponsibility"),
                                    OptionDef(NO, outcome = "CHILD_AGGREGATE", rationale = "sharedResponsibility")
                                )
                        ),
                        QuestionDef(
                            "entity.cardinality",
                            AnswerType.SINGLE_CHOICE,
                            options =
                                listOf(
                                    OptionDef("one", outcome = "ROOT_WITH_RELATIONSHIP", relationship = RelationshipShape(0, 1, 1, 1)),
                                    OptionDef("many", outcome = "ROOT_WITH_RELATIONSHIP", relationship = RelationshipShape(0, null, 1, 1)),
                                    OptionDef(
                                        "manyToMany",
                                        outcome = "ROOT_WITH_RELATIONSHIP",
                                        relationship = RelationshipShape(0, null, 0, null)
                                    ),
                                )
                        ),
                        QuestionDef(
                            "entity.generalPick",
                            AnswerType.ITEM_PICKER,
                            pickerItemType = "BUSINESS_ENTITY",
                            next = "entity.specialContextPick",
                            forPlacement = false
                        ),
                        QuestionDef(
                            "entity.specialContextPick",
                            AnswerType.ITEM_PICKER,
                            pickerItemType = "BOUNDED_CONTEXT",
                            outcome = "INTERFACE_IMPLEMENTATION"
                        ),
                        QuestionDef(
                            "entity.contextPick",
                            AnswerType.ITEM_PICKER,
                            pickerItemType = "BOUNDED_CONTEXT",
                            outcome = "NEW_ROOT_IN_CONTEXT"
                        ),
                    ),
                outcomes =
                    listOf(
                        // Rationales of these two come from the answers given on the way.
                        OutcomeDef(
                            "CHILD_AGGREGATE", Placement.CHILD, emptyList(),
                            listOf("ENTITY_ROLLS_UP_TO_ROOT", "INHERITS_BOUNDED_CONTEXT", "RESULTING_EFFECTIVE_OWNER"),
                            placementFrom = "entity.relatedPick"
                        ),
                        OutcomeDef(
                            "ROOT_WITH_RELATIONSHIP", Placement.NEW_ROOT, emptyList(),
                            listOf("OWN_REGISTER_CATEGORY", "RELATIONSHIP_CREATED", "RESULTING_EFFECTIVE_OWNER"),
                            containerOf = "entity.relatedPick", connection = Connection.RELATIONSHIP, relatedFrom = "entity.relatedPick"
                        ),
                        OutcomeDef(
                            "INTERFACE_IMPLEMENTATION", Placement.NEW_ROOT, listOf("specialisation"),
                            listOf("CROSS_CONTEXT_LINK", "RESULTING_EFFECTIVE_OWNER"),
                            placementFrom = "entity.specialContextPick",
                            connection = Connection.INTERFACE,
                            relatedFrom = "entity.generalPick"
                        ),
                        OutcomeDef(
                            "NEW_ROOT_IN_CONTEXT", Placement.NEW_ROOT, listOf("standaloneConcept"),
                            listOf("OWN_REGISTER_CATEGORY", "RESULTING_EFFECTIVE_OWNER"),
                            placementFrom = "entity.contextPick"
                        ),
                    )
            ),
            // ── Business processes: sub-process vs separate processing activity vs reusable process ──
            RuleSetDef(
                code = "PROCESS_PLACEMENT",
                itemType = "BUSINESS_PROCESS",
                methodology = "PROCESS_GOVERNANCE",
                rootQuestion = "process.shape",
                // "Add sub-process" on a process: a step of that process — go straight to its own purpose.
                contextItemType = "BUSINESS_PROCESS",
                contextAnswers = listOf(ContextAnswer("process.shape", "stepOf")),
                questions =
                    listOf(
                        QuestionDef(
                            "process.shape",
                            AnswerType.SINGLE_CHOICE,
                            options =
                                listOf(
                                    OptionDef("stepOf", next = "process.parentPick"),
                                    OptionDef("reused", next = "process.reusedContextPick"),
                                    OptionDef("standalone", next = "process.contextPick"),
                                )
                        ),
                        QuestionDef(
                            "process.parentPick",
                            AnswerType.ITEM_PICKER,
                            pickerItemType = "BUSINESS_PROCESS",
                            next = "process.ownPurpose"
                        ),
                        QuestionDef(
                            "process.ownPurpose",
                            AnswerType.BOOLEAN,
                            options = yesNo(OptionDef(YES, outcome = "SEPARATE_ACTIVITY"), OptionDef(NO, outcome = "SUB_PROCESS"))
                        ),
                        QuestionDef(
                            "process.reusedContextPick",
                            AnswerType.ITEM_PICKER,
                            pickerItemType = "BOUNDED_CONTEXT",
                            outcome = "REUSABLE_PROCESS"
                        ),
                        QuestionDef(
                            "process.contextPick",
                            AnswerType.ITEM_PICKER,
                            pickerItemType = "BOUNDED_CONTEXT",
                            outcome = "NEW_ACTIVITY"
                        ),
                    ),
                outcomes =
                    listOf(
                        OutcomeDef(
                            "SUB_PROCESS", Placement.CHILD, listOf("decompositionStep"),
                            listOf("REGISTER_ROLLS_INTO_ROOT", "DATA_FLOW_ROLLS_UP", "RESULTING_EFFECTIVE_OWNER"),
                            placementFrom = "process.parentPick"
                        ),
                        OutcomeDef(
                            "SEPARATE_ACTIVITY", Placement.NEW_ROOT, listOf("ownPurpose"),
                            listOf("REGISTER_NEW_ACTIVITY", "RESULTING_EFFECTIVE_OWNER"),
                            containerOf = "process.parentPick", connection = Connection.CALLED_PROCESS, relatedFrom = "process.parentPick"
                        ),
                        OutcomeDef(
                            "REUSABLE_PROCESS", Placement.NEW_ROOT, listOf("reusedAcrossParents"),
                            listOf("REGISTER_NEW_ACTIVITY", "CALL_FROM_PARENTS", "RESULTING_EFFECTIVE_OWNER"),
                            placementFrom = "process.reusedContextPick"
                        ),
                        OutcomeDef(
                            "NEW_ACTIVITY", Placement.NEW_ROOT, listOf("independentActivity"),
                            listOf("REGISTER_NEW_ACTIVITY", "RESULTING_EFFECTIVE_OWNER"),
                            placementFrom = "process.contextPick"
                        ),
                    )
            ),
            // ── Domains: bounded context vs subdomain vs new business area ────────────────────────────
            RuleSetDef(
                code = "DOMAIN_PLACEMENT",
                itemType = "BUSINESS_DOMAIN",
                methodology = "DDD",
                rootQuestion = "domain.kind",
                // "Add subdomain" on a domain: still asked sub-area vs bounded context — both placed in that domain.
                contextItemType = "BUSINESS_DOMAIN",
                questions =
                    listOf(
                        QuestionDef(
                            "domain.kind",
                            AnswerType.SINGLE_CHOICE,
                            options =
                                listOf(
                                    OptionDef("modelBoundary", next = "domain.contextDomainPick"),
                                    OptionDef("subArea", next = "domain.parentPick"),
                                    OptionDef("newArea", outcome = "TOP_LEVEL_DOMAIN"),
                                )
                        ),
                        QuestionDef(
                            "domain.contextDomainPick",
                            AnswerType.ITEM_PICKER,
                            pickerItemType = "BUSINESS_DOMAIN",
                            outcome = "BOUNDED_CONTEXT"
                        ),
                        QuestionDef("domain.parentPick", AnswerType.ITEM_PICKER, pickerItemType = "BUSINESS_DOMAIN", outcome = "SUBDOMAIN"),
                    ),
                outcomes =
                    listOf(
                        OutcomeDef(
                            "BOUNDED_CONTEXT", Placement.NEW_ROOT, listOf("ownLanguage"), listOf("RESULTING_EFFECTIVE_OWNER"),
                            placementFrom = "domain.contextDomainPick", itemType = "BOUNDED_CONTEXT"
                        ),
                        OutcomeDef(
                            "SUBDOMAIN", Placement.CHILD, listOf("subArea"), listOf("INHERITS_OWNER"),
                            placementFrom = "domain.parentPick"
                        ),
                        OutcomeDef("TOP_LEVEL_DOMAIN", Placement.TOP_LEVEL, listOf("newBusinessArea"), listOf("STRATEGIC_ITEM")),
                    )
            ),
            // ── Organisational units: sub-unit vs top-level unit ──────────────────────────────────────
            RuleSetDef(
                code = "ORG_UNIT_PLACEMENT",
                itemType = "ORGANISATIONAL_UNIT",
                methodology = "TEAM_TOPOLOGIES",
                rootQuestion = "unit.reportsTo",
                contextItemType = "ORGANISATIONAL_UNIT",
                questions =
                    listOf(
                        QuestionDef(
                            "unit.reportsTo",
                            AnswerType.BOOLEAN,
                            options = yesNo(OptionDef(YES, next = "unit.parentPick"), OptionDef(NO, outcome = "TOP_LEVEL_UNIT"))
                        ),
                        QuestionDef(
                            "unit.parentPick",
                            AnswerType.ITEM_PICKER,
                            pickerItemType = "ORGANISATIONAL_UNIT",
                            outcome = "SUB_UNIT"
                        ),
                    ),
                outcomes =
                    listOf(
                        OutcomeDef(
                            "SUB_UNIT",
                            Placement.CHILD,
                            listOf("reportingLine"),
                            listOf("NOT_TRANSITIVE"),
                            placementFrom = "unit.parentPick"
                        ),
                        OutcomeDef("TOP_LEVEL_UNIT", Placement.TOP_LEVEL, listOf("independentUnit"), listOf("STRATEGIC_ITEM")),
                    )
            ),
            // ── Capabilities: refinement vs L1 capability ─────────────────────────────────────────────
            RuleSetDef(
                code = "CAPABILITY_PLACEMENT",
                itemType = "CAPABILITY",
                methodology = "BCM",
                rootQuestion = "capability.refines",
                contextItemType = "CAPABILITY",
                questions =
                    listOf(
                        QuestionDef(
                            "capability.refines",
                            AnswerType.BOOLEAN,
                            options = yesNo(OptionDef(YES, next = "capability.parentPick"), OptionDef(NO, outcome = "L1_CAPABILITY"))
                        ),
                        QuestionDef(
                            "capability.parentPick",
                            AnswerType.ITEM_PICKER,
                            pickerItemType = "CAPABILITY",
                            outcome = "SUB_CAPABILITY"
                        ),
                    ),
                outcomes =
                    listOf(
                        OutcomeDef(
                            "SUB_CAPABILITY",
                            Placement.CHILD,
                            listOf("refinement"),
                            listOf("CAPABILITY_LEVEL", "RESULTING_EFFECTIVE_OWNER"),
                            placementFrom = "capability.parentPick"
                        ),
                        OutcomeDef("L1_CAPABILITY", Placement.TOP_LEVEL, listOf("newCapabilityArea"), listOf("STRATEGIC_ITEM")),
                    )
            ),
        )

    fun byCode(code: String): RuleSetDef? = ruleSets.firstOrNull { it.code == code }
}
