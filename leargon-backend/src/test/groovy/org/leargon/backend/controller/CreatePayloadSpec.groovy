package org.leargon.backend.controller

import io.micronaut.http.HttpRequest
import io.micronaut.http.HttpStatus
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
import org.leargon.backend.repository.ClassificationRepository
import org.leargon.backend.repository.ClassificationValueRepository
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.repository.ProcessVersionRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

/**
 * Atomic create payloads: everything the creation wizard collects (placement, delegated owner, steward,
 * custodian, classifications, executing units, legal basis, purpose) is set in the create transaction.
 * Creation does not grant edit rights — a realm owner who delegates the new item cannot edit it afterwards.
 */
@MicronautTest(transactional = false)
class CreatePayloadSpec extends Specification {

    @Inject @Client("/") HttpClient client
    @Inject UserRepository userRepository
    @Inject SupportedLocaleRepository localeRepository
    @Inject BusinessEntityRepository businessEntityRepository
    @Inject BusinessEntityVersionRepository businessEntityVersionRepository
    @Inject ProcessRepository processRepository
    @Inject ProcessVersionRepository processVersionRepository
    @Inject BoundedContextRepository boundedContextRepository
    @Inject BusinessDomainRepository businessDomainRepository
    @Inject BusinessDomainVersionRepository businessDomainVersionRepository
    @Inject OrganisationalUnitRepository organisationalUnitRepository
    @Inject ClassificationRepository classificationRepository
    @Inject ClassificationValueRepository classificationValueRepository

    def setup() {
        if (localeRepository.findByLocaleCode("en").isEmpty()) {
            localeRepository.save(new SupportedLocale(localeCode: "en", displayName: "English", isDefault: true, isActive: true, sortOrder: 1))
        }
        if (localeRepository.findByLocaleCode("de").isEmpty()) {
            localeRepository.save(new SupportedLocale(localeCode: "de", displayName: "Deutsch", isDefault: false, isActive: true, sortOrder: 2))
        }
    }

    def cleanup() {
        businessEntityVersionRepository.deleteAll()
        businessEntityRepository.deleteAll()
        processVersionRepository.deleteAll()
        processRepository.deleteAll()
        boundedContextRepository.deleteAll()
        businessDomainVersionRepository.deleteAll()
        businessDomainRepository.deleteAll()
        organisationalUnitRepository.deleteAll()
        classificationValueRepository.deleteAll()
        classificationRepository.deleteAll()
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

    private Map post(String path, Map body, String token) {
        client.toBlocking().exchange(HttpRequest.POST(path, body).bearerAuth(token), Map).body()
    }

    private Map get(String path, String token) {
        client.toBlocking().exchange(HttpRequest.GET(path).bearerAuth(token), Map).body()
    }

    private int status(HttpRequest request) {
        try {
            return client.toBlocking().exchange(request, Map).status().code
        } catch (HttpClientResponseException e) {
            return e.status.code
        }
    }

    private static List names(String text) { [[locale: "en", text: text]] }

    /** Domain (admin) ⊃ bounded context "Billing" owned by bob; a sensitivity classification for entities. */
    private Map fixture() {
        def admin = token("cpl-admin@test.com", "cpladmin", "ROLE_USER,ROLE_ADMIN")
        def f = [admin: admin, bob: token("cpl-bob@test.com", "cplbob")]
        ["cplcarol", "cpldave", "cplerin"].each { token("${it}@test.com", it) }
        f.stranger = token("cpl-stranger@test.com", "cplstranger")
        def domain = post("/business-domains", [names: names("Finance")], admin).key
        f.billing = post("/business-domains/$domain/bounded-contexts", [names: names("Billing"), ownerUsername: "cplbob"], admin).key
        f.unit = post("/organisational-units", [names: names("Accounts Receivable")], admin).key
        f.classification = post("/classifications", [names: names("Sensitivity"), assignableTo: "BUSINESS_ENTITY"], admin).key
        post("/classifications/${f.classification}/values", [key: "internal", names: names("Internal")], admin)
        return f
    }

    def "a bounded-context owner creates a delegated entity with every wizard field in one request"() {
        given:
        def f = fixture()

        when:
        def created = post("/business-entities", [
                names                     : names("Invoice"),
                boundedContextKey         : f.billing,
                dataOwnerUsername         : "cplcarol",
                dataStewardUsername       : "cpldave",
                technicalCustodianUsername: "cplerin",
                classificationAssignments : [[classificationKey: f.classification, valueKey: "internal"]],
        ], f.bob)
        def entity = get("/business-entities/${created.key}", f.admin)

        then:
        entity.boundedContext.key == f.billing
        entity.dataOwner.username == "cplcarol"
        entity.dataSteward.username == "cpldave"
        entity.technicalCustodian.username == "cplerin"
        entity.classificationAssignments*.valueKey == ["internal"]
    }

    def "creation does not grant edit rights: the creator cannot edit an entity delegated to someone else (403)"() {
        given:
        def f = fixture()
        def key = post("/business-entities", [names: names("Credit Note"), boundedContextKey: f.billing, dataOwnerUsername: "cplcarol"], f.bob).key

        expect:
        status(HttpRequest.PUT("/business-entities/$key/retention-period", [retentionPeriod: [[locale: "en", text: "10 years"]]]).bearerAuth(f.bob)) == 403
    }

    def "an invalid classification value rejects the whole creation"() {
        given:
        def f = fixture()
        def before = businessEntityRepository.count()

        when:
        def code = status(HttpRequest.POST("/business-entities", [
                names                    : names("Broken"),
                boundedContextKey        : f.billing,
                classificationAssignments: [[classificationKey: f.classification, valueKey: "no-such-value"]],
        ]).bearerAuth(f.bob))

        then:
        code == HttpStatus.NOT_FOUND.code
        businessEntityRepository.count() == before
    }

    def "a bounded-context owner creates a process with steward, executing units, legal basis and a multilingual purpose"() {
        given:
        def f = fixture()

        when:
        def created = post("/processes", [
                names                 : names("Dunning"),
                boundedContextKey     : f.billing,
                processStewardUsername: "cpldave",
                executingUnitKeys     : [f.unit],
                legalBasis            : "CONTRACT",
                purpose               : [[locale: "en", text: "Collect overdue payments"], [locale: "de", text: "Überfällige Zahlungen einziehen"]],
        ], f.bob)
        def process = get("/processes/${created.key}", f.admin)

        then:
        process.boundedContext.key == f.billing
        process.processSteward.username == "cpldave"
        process.executingUnits*.key == [f.unit]
        process.legalBasis == "CONTRACT"
        process.purpose.collectEntries { [(it.locale): it.text] } == [en: "Collect overdue payments", de: "Überfällige Zahlungen einziehen"]

        when: "the purpose is replaced by the update endpoint"
        client.toBlocking().exchange(HttpRequest.PUT("/processes/${created.key}/purpose", [purpose: [[locale: "de", text: "Mahnwesen"]]]).bearerAuth(f.admin), Map)
        process = get("/processes/${created.key}", f.admin)

        then: "the set is replaced, not merged"
        process.purpose.collectEntries { [(it.locale): it.text] } == [de: "Mahnwesen"]
    }

    def "a stranger cannot create with a full payload either (403)"() {
        given:
        def f = fixture()

        expect:
        status(HttpRequest.POST("/business-entities", [names: names("Sneaky"), boundedContextKey: f.billing, dataOwnerUsername: "cplstranger"]).bearerAuth(f.stranger)) == 403
    }
}
