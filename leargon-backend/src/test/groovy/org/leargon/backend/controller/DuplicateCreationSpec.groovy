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
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.repository.ProcessVersionRepository
import org.leargon.backend.repository.ServiceProviderRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

/**
 * Duplicate prevention: a likely duplicate in the same container is refused (409 DUPLICATE_CANDIDATES)
 * unless the request justifies it and acknowledges every blocking candidate. The same name in another
 * bounded context is allowed and a translation link is suggested instead.
 */
@MicronautTest(transactional = false)
class DuplicateCreationSpec extends Specification {

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
    @Inject ServiceProviderRepository serviceProviderRepository

    def setup() {
        if (localeRepository.findByLocaleCode("en").isEmpty()) {
            localeRepository.save(new SupportedLocale(localeCode: "en", displayName: "English", isDefault: true, isActive: true, sortOrder: 1))
        }
    }

    def cleanup() {
        serviceProviderRepository.deleteAll()
        businessEntityVersionRepository.deleteAll()
        businessEntityRepository.deleteAll()
        processVersionRepository.deleteAll()
        processRepository.deleteAll()
        boundedContextRepository.deleteAll()
        businessDomainVersionRepository.deleteAll()
        businessDomainRepository.deleteAll()
        userRepository.deleteAll()
    }

    private String adminToken() {
        def resp = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/signup", new SignupRequest("dup-admin@test.com", "dupadmin", "password123", "Test", "User")), Map)
        def u = userRepository.findByEmail("dup-admin@test.com").get()
        u.roles = "ROLE_USER,ROLE_ADMIN"
        userRepository.update(u)
        return resp.body().accessToken
    }

    private Map post(String path, Map body, String token) {
        try {
            def resp = client.toBlocking().exchange(HttpRequest.POST(path, body).bearerAuth(token), Map)
            return [status: resp.status().code, body: resp.body()]
        } catch (HttpClientResponseException e) {
            return [status: e.status.code, body: e.response.getBody(Map).orElse(null)]
        }
    }

    private static List names(String text) { [[locale: "en", text: text]] }

    private static final List JUSTIFICATION = [[locale: "en", text: "Different lifecycle and owner than the existing one"]]

    private Map fixture() {
        def admin = adminToken()
        def domain = post("/business-domains", [names: names("Sales")], admin).body.key
        [
                admin   : admin,
                billing : post("/business-domains/$domain/bounded-contexts", [names: names("Billing")], admin).body.key,
                shipping: post("/business-domains/$domain/bounded-contexts", [names: names("Shipping")], admin).body.key,
        ]
    }

    def "a same-named entity in the same bounded context is refused with the candidates"() {
        given:
        def f = fixture()
        def existing = post("/business-entities", [names: names("Customer"), boundedContextKey: f.billing], f.admin).body.key

        when:
        def res = post("/business-entities", [names: names("Customer"), boundedContextKey: f.billing], f.admin)

        then:
        res.status == 409
        res.body.errorCode == "DUPLICATE_CANDIDATES"
        res.body.duplicateCandidates.find { it.key == existing }.blocking == true
    }

    def "a similar spelling in the same bounded context is refused too"() {
        given:
        def f = fixture()
        post("/business-entities", [names: names("Müller-Daten"), boundedContextKey: f.billing], f.admin)

        expect:
        post("/business-entities", [names: names("Mueller Daten"), boundedContextKey: f.billing], f.admin).status == 409
    }

    def "a justified and acknowledged duplicate is created with a suffixed key"() {
        given:
        def f = fixture()
        def existing = post("/business-entities", [names: names("Customer"), boundedContextKey: f.billing], f.admin).body.key

        when:
        def res = post("/business-entities", [names                   : names("Customer"), boundedContextKey: f.billing,
                                              duplicateJustification  : JUSTIFICATION,
                                              acknowledgedDuplicateKeys: [existing]], f.admin)

        then:
        res.status == 201
        res.body.key == "${existing}-2"
    }

    def "justification or acknowledgement alone is not enough (409)"() {
        given:
        def f = fixture()
        def existing = post("/business-entities", [names: names("Customer"), boundedContextKey: f.billing], f.admin).body.key
        def base = [names: names("Customer"), boundedContextKey: f.billing]

        expect:
        post("/business-entities", base + [duplicateJustification: JUSTIFICATION], f.admin).status == 409
        post("/business-entities", base + [acknowledgedDuplicateKeys: [existing]], f.admin).status == 409
        post("/business-entities", base + [acknowledgedDuplicateKeys: [existing], duplicateJustification: [[locale: "en", text: "dupe"]]], f.admin).status == 409
    }

    def "a stale acknowledgement that misses a newer duplicate is refused (409)"() {
        given:
        def f = fixture()
        def first = post("/business-entities", [names: names("Customer"), boundedContextKey: f.billing], f.admin).body.key
        post("/business-entities", [names: names("Customer"), boundedContextKey: f.billing,
                                    duplicateJustification: JUSTIFICATION, acknowledgedDuplicateKeys: [first]], f.admin)

        expect: "acknowledging only the first of the two existing customers"
        post("/business-entities", [names: names("Customer"), boundedContextKey: f.billing,
                                    duplicateJustification: JUSTIFICATION, acknowledgedDuplicateKeys: [first]], f.admin).status == 409
    }

    def "the same name in another bounded context is allowed and a translation link is suggested"() {
        given:
        def f = fixture()
        def existing = post("/business-entities", [names: names("Customer"), boundedContextKey: f.billing], f.admin).body.key

        when:
        def preview = post("/creation/duplicate-candidates", [itemType: "BUSINESS_ENTITY", names: names("Customer"), boundedContextKey: f.shipping], f.admin)
        def created = post("/business-entities", [names: names("Customer"), boundedContextKey: f.shipping], f.admin)

        then:
        !preview.body.blocking
        with(preview.body.candidates.find { it.key == existing }) {
            blocking == false
            scope == "ELSEWHERE"
            suggestion == "TRANSLATION_LINK"
        }
        created.status == 201
    }

    def "same-named processes in two bounded contexts receive distinct keys"() {
        given:
        def f = fixture()

        when:
        def first = post("/processes", [names: names("Onboarding"), boundedContextKey: f.billing], f.admin)
        def second = post("/processes", [names: names("Onboarding"), boundedContextKey: f.shipping], f.admin)

        then:
        first.status == 201
        second.status == 201
        first.body.key != second.body.key
    }

    def "service providers are checked across the whole list"() {
        given:
        def f = fixture()
        def body = [names: names("Stripe"), processingCountries: [], processorAgreementInPlace: true, subProcessorsApproved: true]
        post("/service-providers", body, f.admin)

        expect:
        post("/service-providers", body, f.admin).status == 409
    }
}
