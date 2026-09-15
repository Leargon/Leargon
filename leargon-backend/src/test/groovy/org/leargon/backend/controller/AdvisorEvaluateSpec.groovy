package org.leargon.backend.controller

import io.micronaut.core.type.Argument
import io.micronaut.http.HttpRequest
import io.micronaut.http.client.HttpClient
import io.micronaut.http.client.annotation.Client
import io.micronaut.http.client.exceptions.HttpClientResponseException
import io.micronaut.test.extensions.spock.annotation.MicronautTest
import jakarta.inject.Inject
import org.leargon.backend.domain.SupportedLocale
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.repository.BoundedContextRepository
import org.leargon.backend.repository.BusinessDomainRepository
import org.leargon.backend.repository.BusinessDomainVersionRepository
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.BusinessEntityVersionRepository
import org.leargon.backend.repository.ItemCreationRecordRepository
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.repository.ProcessVersionRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

/**
 * The guided modelling advisor: stateless evaluation of a decision tree into a recommendation with
 * placement, permission, live consequences and duplicate candidates.
 */
@MicronautTest(transactional = false)
class AdvisorEvaluateSpec extends Specification {

    @Inject @Client("/") HttpClient client
    @Inject UserRepository userRepository
    @Inject SupportedLocaleRepository localeRepository
    @Inject ItemCreationRecordRepository itemCreationRecordRepository
    @Inject BusinessEntityRepository businessEntityRepository
    @Inject BusinessEntityVersionRepository businessEntityVersionRepository
    @Inject ProcessRepository processRepository
    @Inject ProcessVersionRepository processVersionRepository
    @Inject BoundedContextRepository boundedContextRepository
    @Inject BusinessDomainRepository businessDomainRepository
    @Inject BusinessDomainVersionRepository businessDomainVersionRepository
    @Inject OrganisationalUnitRepository organisationalUnitRepository

    def setup() {
        if (localeRepository.findByLocaleCode("en").isEmpty()) {
            localeRepository.save(new SupportedLocale(localeCode: "en", displayName: "English", isDefault: true, isActive: true, sortOrder: 1))
        }
    }

    def cleanup() {
        itemCreationRecordRepository.deleteAll()
        businessEntityVersionRepository.deleteAll()
        businessEntityRepository.deleteAll()
        processVersionRepository.deleteAll()
        processRepository.deleteAll()
        boundedContextRepository.deleteAll()
        businessDomainVersionRepository.deleteAll()
        businessDomainRepository.deleteAll()
        organisationalUnitRepository.deleteAll()
        userRepository.deleteAll()
    }

    private String token(String email, String username, String roles = "ROLE_USER") {
        def resp = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/signup", new SignupRequest(email, username, "password123", "Ada", username)), Map)
        def u = userRepository.findByEmail(email).get()
        u.roles = roles
        userRepository.update(u)
        return resp.body().accessToken
    }

    private Map post(String path, Object body, String token) {
        try {
            def resp = client.toBlocking().exchange(HttpRequest.POST(path, body).bearerAuth(token), Map)
            return [status: resp.status().code, body: resp.body()]
        } catch (HttpClientResponseException e) {
            return [status: e.status.code, body: e.response.getBody(Map).orElse(null)]
        }
    }

    private Map evaluate(String ruleSet, List<Map> answers, String token, String proposedName = null) {
        def body = [ruleSetCode: ruleSet, answers: answers]
        if (proposedName) body.proposedNames = [[locale: "en", text: proposedName]]
        post("/advisor/evaluate", body, token)
    }

    private static List names(String text) { [[locale: "en", text: text]] }

    /** Domain Sales ⊃ context Billing (owner bob) with entity "Order" and process "Order Fulfilment"; context Shipping. */
    private Map fixture() {
        def admin = token("adv-admin@test.com", "advadmin", "ROLE_USER,ROLE_ADMIN")
        def f = [admin: admin, bob: token("adv-bob@test.com", "advbob"), stranger: token("adv-stranger@test.com", "advstranger")]
        def domain = post("/business-domains", [names: names("Sales")], admin).body.key
        f.domain = domain
        f.billing = post("/business-domains/$domain/bounded-contexts", [names: names("Billing"), ownerUsername: "advbob"], admin).body.key
        f.shipping = post("/business-domains/$domain/bounded-contexts", [names: names("Shipping")], admin).body.key
        f.order = post("/business-entities", [names: names("Order"), boundedContextKey: f.billing, dataOwnerUsername: "advbob"], admin).body.key
        f.fulfilment = post("/processes", [names: names("Order Fulfilment"), boundedContextKey: f.billing], admin).body.key
        return f
    }

    def "lists the five rule sets"() {
        given:
        def admin = token("adv-admin@test.com", "advadmin", "ROLE_USER,ROLE_ADMIN")

        when:
        def sets = client.toBlocking().exchange(HttpRequest.GET("/advisor/rule-sets").bearerAuth(admin), Argument.listOf(Map)).body()

        then:
        sets*.code as Set == ["ENTITY_PLACEMENT", "PROCESS_PLACEMENT", "DOMAIN_PLACEMENT", "ORG_UNIT_PLACEMENT", "CAPABILITY_PLACEMENT"] as Set
    }

    def "starts with the root question"() {
        given:
        def f = fixture()

        when:
        def res = evaluate("ENTITY_PLACEMENT", [], f.bob)

        then:
        res.status == 200
        res.body.status == "QUESTION"
        res.body.question.code == "entity.relation"
        res.body.question.options == ["connected", "kindOf", "standalone"]
    }

    /** Connected to Order: shares its lifecycle, has no identity and no responsibility of its own. */
    private static List childPath(String order) {
        [
                [questionCode: "entity.relation", optionCode: "connected"],
                [questionCode: "entity.relatedPick", itemKey: order],
                [questionCode: "entity.lifecycle", optionCode: "yes"],
                [questionCode: "entity.identity", optionCode: "no"],
                [questionCode: "entity.responsibility", optionCode: "no"],
        ]
    }

    def "flagship: an Order Line that lives and dies with its Order and has nothing of its own becomes its child"() {
        given:
        def f = fixture()

        when:
        def res = evaluate("ENTITY_PLACEMENT", childPath(f.order), f.bob, "Order Line")
        def rec = res.body.recommendation

        then:
        res.body.status == "RECOMMENDATION"
        rec.outcomeCode == "CHILD_AGGREGATE"
        rec.placementType == "CHILD"
        rec.prefill.parentKey == f.order
        rec.prefill.itemType == "BUSINESS_ENTITY"
        rec.prefill.relationship == null
        rec.allowed == true
        rec.rationaleCodes == ["lifecycleBound", "noOwnIdentity", "sharedResponsibility"]
        rec.consequences.find { it.code == "ENTITY_ROLLS_UP_TO_ROOT" }.params.root == "Order"
        rec.consequences.find { it.code == "INHERITS_BOUNDED_CONTEXT" }.params.context == "Billing"
        res.body.answeredPath == ["entity.relation", "entity.relatedPick", "entity.lifecycle", "entity.identity", "entity.responsibility"]
    }

    def "follow-up questions name the entity picked"() {
        given:
        def f = fixture()

        when:
        def question = evaluate("ENTITY_PLACEMENT", childPath(f.order).take(2), f.bob).body.question

        then:
        question.code == "entity.lifecycle"
        question.params.picked == "Order"
    }

    def "#reason makes it a new root entity created together with its relationship"() {
        given:
        def f = fixture()
        def answers = [
                [questionCode: "entity.relation", optionCode: "connected"],
                [questionCode: "entity.relatedPick", itemKey: f.order],
        ] + path.collect { [questionCode: it[0], optionCode: it[1]] } + [[questionCode: "entity.cardinality", optionCode: "many"]]

        when:
        def rec = evaluate("ENTITY_PLACEMENT", answers, f.bob).body.recommendation

        then:
        rec.outcomeCode == "ROOT_WITH_RELATIONSHIP"
        rec.placementType == "NEW_ROOT"
        rec.rationaleCodes.last() == rationale
        rec.prefill.parentKey == null
        rec.prefill.boundedContextKey == f.billing
        rec.prefill.connectionType == "RELATIONSHIP"
        rec.prefill.relatedItemKey == f.order
        rec.prefill.relationship.relatedEntityKey == f.order
        rec.prefill.relationship.firstCardinalityMinimum == 0
        rec.prefill.relationship.firstCardinalityMaximum == null
        rec.prefill.relationship.secondCardinalityMinimum == 1
        rec.prefill.relationship.secondCardinalityMaximum == 1
        rec.consequences.find { it.code == "RELATIONSHIP_CREATED" }.params.related == "Order"

        where:
        reason                   | path                                                                                           | rationale
        "an own lifecycle"       | [["entity.lifecycle", "no"]]                                                                   | "independentLifecycle"
        "an own identity"        | [["entity.lifecycle", "yes"], ["entity.identity", "yes"]]                                      | "ownIdentity"
        "an own responsibility"  | [["entity.lifecycle", "yes"], ["entity.identity", "no"], ["entity.responsibility", "yes"]]     | "ownResponsibility"
    }

    def "the cardinality answer shapes the relationship"() {
        given:
        def f = fixture()

        when:
        def rel = evaluate("ENTITY_PLACEMENT", [
                [questionCode: "entity.relation", optionCode: "connected"],
                [questionCode: "entity.relatedPick", itemKey: f.order],
                [questionCode: "entity.lifecycle", optionCode: "no"],
                [questionCode: "entity.cardinality", optionCode: option],
        ], f.bob).body.recommendation.prefill.relationship

        then:
        [rel.firstCardinalityMinimum, rel.firstCardinalityMaximum, rel.secondCardinalityMinimum, rel.secondCardinalityMaximum] == expected

        where:
        option       | expected
        "one"        | [0, 1, 1, 1]
        "many"       | [0, null, 1, 1]
        "manyToMany" | [0, null, 0, null]
    }

    def "a user who may not create there is told who is responsible"() {
        given:
        def f = fixture()

        when:
        def rec = evaluate("ENTITY_PLACEMENT", childPath(f.order), f.stranger).body.recommendation

        then:
        rec.allowed == false
        rec.responsibleOwner.username == "advbob"
    }

    def "picker items are marked by whether the user may create there"() {
        given:
        def f = fixture()

        when:
        def question = evaluate("ENTITY_PLACEMENT", [[questionCode: "entity.relation", optionCode: "standalone"]], f.bob).body.question

        then:
        question.code == "entity.contextPick"
        question.pickerItemType == "BOUNDED_CONTEXT"
        question.pickerItems.find { it.key == f.billing }.creatable == true
        question.pickerItems.find { it.key == f.shipping }.creatable == false
    }

    def "a step of a larger process becomes a sub-process that rolls into its root's register row"() {
        given:
        def f = fixture()

        when:
        def rec = evaluate("PROCESS_PLACEMENT", [
                [questionCode: "process.shape", optionCode: "stepOf"],
                [questionCode: "process.parentPick", itemKey: f.fulfilment],
                [questionCode: "process.ownPurpose", optionCode: "no"],
        ], f.bob).body.recommendation

        then:
        rec.outcomeCode == "SUB_PROCESS"
        rec.prefill.parentKey == f.fulfilment
        rec.consequences.find { it.code == "REGISTER_ROLLS_INTO_ROOT" }.params.root == "Order Fulfilment"
    }

    def "the recommendation reports duplicates of the proposed name at the recommended place"() {
        given:
        def f = fixture()

        when:
        def res = evaluate("ENTITY_PLACEMENT", [
                [questionCode: "entity.relation", optionCode: "standalone"],
                [questionCode: "entity.contextPick", itemKey: f.billing],
        ], f.bob, "Order")

        then:
        res.body.recommendation.outcomeCode == "NEW_ROOT_IN_CONTEXT"
        res.body.duplicateCandidates.find { it.key == f.order }.blocking == true
    }

    def "started from an entity (Add child), the tree begins with the questions about that entity"() {
        given:
        def f = fixture()

        when:
        def res = post("/advisor/evaluate", [ruleSetCode: "ENTITY_PLACEMENT", contextItemKey: f.order, answers: []], f.bob)

        then:
        res.status == 200
        res.body.question.code == "entity.lifecycle"
        res.body.question.params.picked == "Order"
        res.body.answeredPath == ["entity.relation", "entity.relatedPick"]

        when: "the remaining answers of the child path"
        def rec = post("/advisor/evaluate", [ruleSetCode: "ENTITY_PLACEMENT", contextItemKey: f.order,
                                             answers: childPath(f.order).drop(2)], f.bob).body.recommendation

        then:
        rec.outcomeCode == "CHILD_AGGREGATE"
        rec.prefill.parentKey == f.order

        when: "the answers say it is not a child after all"
        rec = post("/advisor/evaluate", [ruleSetCode: "ENTITY_PLACEMENT", contextItemKey: f.order,
                                         answers: [[questionCode: "entity.lifecycle", optionCode: "no"],
                                                   [questionCode: "entity.cardinality", optionCode: "many"]]], f.bob).body.recommendation

        then:
        rec.outcomeCode == "ROOT_WITH_RELATIONSHIP"
        rec.prefill.parentKey == null
        rec.prefill.relationship.relatedEntityKey == f.order
    }

    def "started from a process (Add sub-process), the tree begins with its own-purpose question"() {
        given:
        def f = fixture()

        expect:
        post("/advisor/evaluate", [ruleSetCode: "PROCESS_PLACEMENT", contextItemKey: f.fulfilment, answers: []], f.bob)
                .body.question.code == "process.ownPurpose"
    }

    def "started from a domain (Add subdomain), both branches are placed in that domain"() {
        given:
        def f = fixture()
        def evaluateFrom = { List answers ->
            post("/advisor/evaluate", [ruleSetCode: "DOMAIN_PLACEMENT", contextItemKey: f.domain, answers: answers], f.admin).body
        }

        expect: "the kind is still asked"
        evaluateFrom([]).question.code == "domain.kind"

        and: "a sub-area becomes a subdomain of it, a model boundary a bounded context in it"
        with(evaluateFrom([[questionCode: "domain.kind", optionCode: "subArea"]]).recommendation) {
            outcomeCode == "SUBDOMAIN"
            prefill.parentKey == f.domain
        }
        with(evaluateFrom([[questionCode: "domain.kind", optionCode: "modelBoundary"]]).recommendation) {
            outcomeCode == "BOUNDED_CONTEXT"
            prefill.domainKey == f.domain
        }
    }

    def "started from a unit (Add child), reporting into an existing unit means into that unit"() {
        given:
        def f = fixture()
        def unit = post("/organisational-units", [names: names("Operations")], f.admin).body.key

        when:
        def rec = post("/advisor/evaluate", [ruleSetCode: "ORG_UNIT_PLACEMENT", contextItemKey: unit,
                                             answers: [[questionCode: "unit.reportsTo", optionCode: "yes"]]], f.admin).body.recommendation

        then:
        rec.outcomeCode == "SUB_UNIT"
        rec.prefill.parentKey == unit
    }

    def "a start item that is not of the rule set's start type is refused (400)"() {
        given:
        def f = fixture()

        expect:
        post("/advisor/evaluate", [ruleSetCode: "DOMAIN_PLACEMENT", contextItemKey: f.order, answers: []], f.bob).status == 400
        post("/advisor/evaluate", [ruleSetCode: "ENTITY_PLACEMENT", contextItemKey: "no-such-entity", answers: []], f.bob).status == 400
    }

    def "answers that do not fit the tree are rejected (400) and unknown rule sets are 404"() {
        given:
        def f = fixture()

        expect: "an unknown option"
        evaluate("ENTITY_PLACEMENT", [[questionCode: "entity.relation", optionCode: "nonsense"]], f.bob).status == 400

        and: "an answer for the wrong question"
        evaluate("ENTITY_PLACEMENT", [[questionCode: "entity.lifecycle", optionCode: "yes"]], f.bob).status == 400

        and: "an unknown item"
        evaluate("ENTITY_PLACEMENT", [[questionCode: "entity.relation", optionCode: "standalone"],
                                      [questionCode: "entity.contextPick", itemKey: "no-such-context"]], f.bob).status == 400

        and: "an unknown rule set"
        evaluate("NO_SUCH_SET", [], f.bob).status == 404
    }
}
