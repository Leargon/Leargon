package org.leargon.backend.controller

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
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.TaskRuleConfigurationRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

/**
 * Awareness of creations in one's realm: when someone other than the owner of the container (domain,
 * bounded context, unit, parent item) creates an item there, the container's owner gets a
 * REVIEW_REALM_CREATION to-do, closed by acknowledging it. The acknowledgement survives later edits,
 * the review follows a change of ownership, and it cannot be dismissed.
 */
@MicronautTest(transactional = false)
class CreationReviewTaskSpec extends Specification {

    @Inject @Client("/") HttpClient client
    @Inject UserRepository userRepository
    @Inject SupportedLocaleRepository localeRepository
    @Inject ItemCreationRecordRepository itemCreationRecordRepository
    @Inject TaskRuleConfigurationRepository taskRuleConfigurationRepository
    @Inject BusinessEntityRepository businessEntityRepository
    @Inject BusinessEntityVersionRepository businessEntityVersionRepository
    @Inject BoundedContextRepository boundedContextRepository
    @Inject BusinessDomainRepository businessDomainRepository
    @Inject BusinessDomainVersionRepository businessDomainVersionRepository

    def setup() {
        if (localeRepository.findByLocaleCode("en").isEmpty()) {
            localeRepository.save(new SupportedLocale(localeCode: "en", displayName: "English", isDefault: true, isActive: true, sortOrder: 1))
        }
        if (localeRepository.findByLocaleCode("de").isEmpty()) {
            localeRepository.save(new SupportedLocale(localeCode: "de", displayName: "Deutsch", isDefault: false, isActive: true, sortOrder: 2))
        }
    }

    def cleanup() {
        itemCreationRecordRepository.deleteAll()
        taskRuleConfigurationRepository.deleteAll()
        businessEntityVersionRepository.deleteAll()
        businessEntityRepository.deleteAll()
        boundedContextRepository.deleteAll()
        businessDomainVersionRepository.deleteAll()
        businessDomainRepository.deleteAll()
        userRepository.deleteAll()
    }

    private String token(String email, String username, String roles = "ROLE_USER") {
        def resp = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/signup", new SignupRequest(email, username, "password123", "Test", "User")), Map)
        def u = userRepository.findByEmail(email).get()
        u.roles = roles
        userRepository.update(u)
        return resp.body().accessToken
    }

    private Map send(HttpRequest request) {
        try {
            def resp = client.toBlocking().exchange(request, Map)
            return [status: resp.status().code, body: resp.body()]
        } catch (HttpClientResponseException e) {
            return [status: e.status.code, body: e.response.getBody(Map).orElse(null)]
        }
    }

    private Map post(String path, Object body, String token) { send(HttpRequest.POST(path, body).bearerAuth(token)) }

    private Map review(String token, String resourceKey) {
        def tasks = client.toBlocking().exchange(HttpRequest.GET("/tasks").bearerAuth(token), Map).body().tasks as List<Map>
        tasks.find { it.resourceKey == resourceKey && it.ruleCode == "REVIEW_REALM_CREATION" } as Map
    }

    private static List names(String text) { [[locale: "en", text: text]] }

    /** Domain A (owner alice) ⊃ context Billing (owner bob). */
    private Map fixture() {
        def admin = token("crv-admin@test.com", "crvadmin", "ROLE_USER,ROLE_ADMIN")
        def f = [admin: admin, alice: token("crv-alice@test.com", "crvalice"), bob: token("crv-bob@test.com", "crvbob"),
                 carol: token("crv-carol@test.com", "crvcarol"), stranger: token("crv-stranger@test.com", "crvstranger")]
        def domain = post("/business-domains", [names: names("Domain A"), ownerUsername: "crvalice"], admin).body.key
        f.billing = post("/business-domains/$domain/bounded-contexts", [names: names("Billing"), ownerUsername: "crvbob"], admin).body.key
        return f
    }

    def "the context owner gets a review when the domain owner creates in their context"() {
        given:
        def f = fixture()

        when:
        def key = post("/business-entities", [names: names("Invoice"), boundedContextKey: f.billing], f.alice).body.key
        def task = review(f.bob, key)

        then:
        task.acknowledgeable == true
        task.creationReview.createdBy.username == "crvalice"
        task.creationReview.basis == "DOMAIN_OWNER"

        and: "the creator gets no review of their own creation"
        review(f.alice, key) == null
    }

    def "no review is raised when the owner creates in their own context"() {
        given:
        def f = fixture()

        when:
        def key = post("/business-entities", [names: names("Credit Note"), boundedContextKey: f.billing], f.bob).body.key

        then:
        review(f.bob, key) == null
    }

    def "only the owner may acknowledge, and the acknowledgement survives later edits"() {
        given:
        def f = fixture()
        def key = post("/business-entities", [names: names("Receipt"), boundedContextKey: f.billing], f.alice).body.key
        def recordId = review(f.bob, key).creationReview.recordId

        expect: "a stranger may not close it"
        post("/creation/reviews/$recordId/acknowledge", [:], f.stranger).status == 403

        when:
        def ack = post("/creation/reviews/$recordId/acknowledge", [:], f.bob)

        then:
        ack.status == 204
        review(f.bob, key) == null

        when: "the item is edited afterwards"
        send(HttpRequest.PUT("/business-entities/$key/descriptions", [[locale: "en", text: "Edited later"]]).bearerAuth(f.admin))

        then: "the review does not come back (unlike a dismissal)"
        review(f.bob, key) == null
    }

    def "a creation review cannot be dismissed (400)"() {
        given:
        def f = fixture()
        def key = post("/business-entities", [names: names("Voucher"), boundedContextKey: f.billing], f.alice).body.key
        def taskId = review(f.bob, key).id as String

        expect:
        post("/tasks/${URLEncoder.encode(taskId, 'UTF-8')}/dismissal", [reason: "not relevant"], f.bob).status == 400
    }

    def "reassigning the context owner moves the review"() {
        given:
        def f = fixture()
        def key = post("/business-entities", [names: names("Refund"), boundedContextKey: f.billing], f.alice).body.key

        when:
        send(HttpRequest.PUT("/bounded-contexts/${f.billing}/owner", [ownerUsername: "crvcarol"]).bearerAuth(f.admin))

        then:
        review(f.carol, key) != null
        review(f.bob, key) == null
    }

    def "a multilingual duplicate justification reaches the reviewer in every locale"() {
        given:
        def f = fixture()
        def first = post("/business-entities", [names: names("Customer"), boundedContextKey: f.billing], f.alice).body.key

        when:
        def key = post("/business-entities", [
                names                    : names("Customer"),
                boundedContextKey        : f.billing,
                acknowledgedDuplicateKeys: [first],
                duplicateJustification   : [[locale: "en", text: "A separate customer concept for invoicing"],
                                            [locale: "de", text: "Ein eigenes Kundenkonzept für Rechnungen"]],
        ], f.alice).body.key
        def justification = review(f.bob, key).creationReview.duplicateJustification as List<Map>

        then:
        justification.collectEntries { [(it.locale): it.text] } ==
                [en: "A separate customer concept for invoicing", de: "Ein eigenes Kundenkonzept für Rechnungen"]
        review(f.bob, key).creationReview.acknowledgedCandidateKeys == [first]
    }

    def "switching the rule off hides the review"() {
        given:
        def f = fixture()
        def key = post("/business-entities", [names: names("Statement"), boundedContextKey: f.billing], f.alice).body.key

        when:
        client.toBlocking().exchange(
                HttpRequest.PUT("/administration/task-rules", [[ruleCode: "REVIEW_REALM_CREATION", enabled: false]]).bearerAuth(f.admin))

        then:
        review(f.bob, key) == null
    }
}
