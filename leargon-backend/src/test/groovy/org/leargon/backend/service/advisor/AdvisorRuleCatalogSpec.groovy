package org.leargon.backend.service.advisor

import spock.lang.Specification
import spock.lang.Unroll

/** Structural integrity of the advisor's decision trees: every path resolves and ends in an outcome. */
class AdvisorRuleCatalogSpec extends Specification {

    private static List<AdvisorRuleCatalog.RuleSetDef> ruleSets() { AdvisorRuleCatalog.INSTANCE.ruleSets }

    def "rule set codes are unique and cover every creatable item type the advisor is launched for"() {
        expect:
        ruleSets()*.code.unique().size() == ruleSets().size()
        ruleSets()*.itemType as Set == ["BUSINESS_ENTITY", "BUSINESS_PROCESS", "BUSINESS_DOMAIN", "ORGANISATIONAL_UNIT", "CAPABILITY"] as Set
    }

    @Unroll
    def "#ruleSet.code: every reference resolves, every node is reachable and there are no cycles"() {
        given:
        def questions = ruleSet.questions.collectEntries { [(it.code): it] }
        def outcomes = ruleSet.outcomes.collectEntries { [(it.code): it] }

        expect: "codes are unique"
        ruleSet.questions*.code.unique().size() == ruleSet.questions.size()
        ruleSet.outcomes*.code.unique().size() == ruleSet.outcomes.size()

        and: "the root exists"
        questions.containsKey(ruleSet.rootQuestion)

        and: "every question is well formed"
        ruleSet.questions.every { q ->
            q.answerType == AdvisorRuleCatalog.AnswerType.ITEM_PICKER ?
                    (q.pickerItemType != null && ((q.next != null) ^ (q.outcome != null))) :
                    (!q.options.isEmpty() && q.options.every { (it.next != null) ^ (it.outcome != null) })
        }

        and: "every next/outcome reference resolves"
        ruleSet.questions.every { q ->
            (q.options*.next + [q.next]).findAll().every { questions.containsKey(it) } &&
                    (q.options*.outcome + [q.outcome]).findAll().every { outcomes.containsKey(it) }
        }

        and: "outcome placement references name picker questions"
        ruleSet.outcomes.every { o ->
            [o.placementFrom, o.containerOf, o.relatedFrom].findAll().every {
                questions[it]?.answerType == AdvisorRuleCatalog.AnswerType.ITEM_PICKER
            } && (o.placement != AdvisorRuleCatalog.Placement.CHILD || o.placementFrom != null)
        }

        and: "every question and every outcome is reachable from the root, without cycles"
        def reached = reach(ruleSet, questions)
        reached.questions == questions.keySet()
        reached.outcomes == outcomes.keySet()

        where:
        ruleSet << ruleSets()
    }

    @Unroll
    def "#ruleSet.code can be started from an item: its context answers exist and a picker asks for that item type"() {
        given:
        def questions = ruleSet.questions.collectEntries { [(it.code): it] }

        expect:
        ruleSet.contextItemType != null
        ruleSet.contextAnswers.every { a -> questions[a.questionCode]?.options*.code?.contains(a.optionCode) }
        ruleSet.questions.any { it.answerType == AdvisorRuleCatalog.AnswerType.ITEM_PICKER && it.pickerItemType == ruleSet.contextItemType }

        where:
        ruleSet << ruleSets()
    }

    /** Depth-first walk; fails on a cycle (a question reachable from itself). */
    private static Map reach(AdvisorRuleCatalog.RuleSetDef ruleSet, Map questions) {
        def seenQuestions = [] as Set
        def seenOutcomes = [] as Set
        def walk
        walk = { String code, Set path ->
            assert !(code in path): "cycle through $code in ${ruleSet.code}"
            seenQuestions << code
            def q = questions[code]
            def nexts = (q.options*.next + [q.next]).findAll()
            seenOutcomes.addAll((q.options*.outcome + [q.outcome]).findAll())
            nexts.each { walk(it, path + code) }
        }
        walk(ruleSet.rootQuestion, [] as Set)
        [questions: seenQuestions, outcomes: seenOutcomes]
    }
}
