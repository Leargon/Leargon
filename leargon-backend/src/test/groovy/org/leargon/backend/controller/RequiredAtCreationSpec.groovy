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
import org.leargon.backend.repository.FieldConfigurationRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

/**
 * "Required at creation": an admin (or the lead of the field's methodology) flags a mandatory,
 * creation-capable field; the create endpoint then rejects requests that do not supply it (422 with the
 * missing fields). Fields of a disabled methodology are never required.
 */
@MicronautTest(transactional = false)
class RequiredAtCreationSpec extends Specification {

    @Inject @Client("/") HttpClient client
    @Inject UserRepository userRepository
    @Inject SupportedLocaleRepository localeRepository
    @Inject FieldConfigurationRepository fieldConfigurationRepository
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
        fieldConfigurationRepository.deleteAll()
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

    private Map exchange(HttpRequest request) {
        try {
            def resp = client.toBlocking().exchange(request, Object)
            return [status: resp.status().code, body: resp.body()]
        } catch (HttpClientResponseException e) {
            return [status: e.status.code, body: e.response.getBody(Map).orElse(null)]
        }
    }

    private static Map entry(String fieldName, String section, String maturity, boolean requiredAtCreation, String visibility = "SHOWN") {
        [entityType: "BUSINESS_ENTITY", fieldName: fieldName, visibility: visibility, section: section, maturityLevel: maturity,
         requiredAtCreation: requiredAtCreation]
    }

    /** German name and bounded context are mandatory and required at creation for business entities. */
    private List<Map> requiredConfig() {
        [entry("names.de", "CORE", "BASIC", true), entry("boundedContext", "DDD", "ADVANCED", true)]
    }

    private Map fixture() {
        def admin = token("rac-admin@test.com", "racadmin", "ROLE_USER,ROLE_ADMIN")
        def editor = token("rac-editor@test.com", "raceditor", "ROLE_USER,ROLE_EDITOR_DATA_GOVERNANCE")
        def domain = client.toBlocking().exchange(
                HttpRequest.POST("/business-domains", [names: [[locale: "en", text: "Sales"]]]).bearerAuth(admin), Map).body().key
        def bc = client.toBlocking().exchange(
                HttpRequest.POST("/business-domains/$domain/bounded-contexts", [names: [[locale: "en", text: "Ordering"]]]).bearerAuth(admin), Map).body().key
        [admin: admin, editor: editor, bc: bc]
    }

    def "the required-at-creation flag round-trips through the field configuration"() {
        given:
        def f = fixture()

        when:
        def put = exchange(HttpRequest.PUT("/administration/field-configurations", requiredConfig()).bearerAuth(f.admin))
        def all = client.toBlocking().exchange(
                HttpRequest.GET("/administration/field-configurations").bearerAuth(f.admin), Argument.listOf(Map)).body()

        then:
        put.status == 200
        all.find { it.fieldName == "names.de" }.requiredAtCreation == true
        all.find { it.fieldName == "boundedContext" }.requiredAtCreation == true
    }

    def "creating without a required field is refused with 422 naming the missing fields"() {
        given:
        def f = fixture()
        exchange(HttpRequest.PUT("/administration/field-configurations", requiredConfig()).bearerAuth(f.admin))

        when:
        def res = exchange(HttpRequest.POST("/business-entities", [names: [[locale: "en", text: "Customer"]]]).bearerAuth(f.editor))

        then:
        res.status == 422
        res.body.errorCode == "REQUIRED_AT_CREATION_MISSING"
        (res.body.missingFields as List).containsAll(["names.de", "boundedContext"])
        businessEntityRepository.count() == 0
    }

    def "creating with every required field succeeds"() {
        given:
        def f = fixture()
        exchange(HttpRequest.PUT("/administration/field-configurations", requiredConfig()).bearerAuth(f.admin))

        when:
        def res = exchange(HttpRequest.POST("/business-entities", [
                names            : [[locale: "en", text: "Customer"], [locale: "de", text: "Kunde"]],
                boundedContextKey: f.bc,
        ]).bearerAuth(f.editor))

        then:
        res.status == 201
    }

    def "only mandatory, creation-capable fields can be required at creation (400)"() {
        given:
        def f = fixture()

        expect: "a hidden field cannot be required"
        exchange(HttpRequest.PUT("/administration/field-configurations",
                [entry("retentionPeriod.en", "DATA_GOVERNANCE", "BASIC", true, "HIDDEN")]).bearerAuth(f.admin)).status == 400

        and: "a field the create request does not carry cannot be required"
        exchange(HttpRequest.PUT("/administration/field-configurations",
                [entry("storageLocations", "DATA_GOVERNANCE", "BASIC", true)]).bearerAuth(f.admin)).status == 400
    }

    def "a methodology lead cannot change the flag on a field outside their methodology (403)"() {
        given:
        def f = fixture()
        exchange(HttpRequest.PUT("/administration/field-configurations",
                [entry("boundedContext", "DDD", "ADVANCED", false)]).bearerAuth(f.admin))
        def gdprLead = token("rac-lead@test.com", "raclead", "ROLE_USER,ROLE_LEAD_GDPR")

        expect: "boundedContext belongs to DDD — flipping only its required-at-creation flag is still out of scope"
        exchange(HttpRequest.PUT("/administration/field-configurations",
                [entry("boundedContext", "DDD", "ADVANCED", true)]).bearerAuth(gdprLead)).status == 403
    }

    def "fields of a disabled methodology are not required"() {
        given:
        def f = fixture()
        exchange(HttpRequest.PUT("/administration/field-configurations",
                [entry("boundedContext", "DDD", "ADVANCED", true)]).bearerAuth(f.admin))
        def entries = ["DATA_GOVERNANCE", "PROCESS_GOVERNANCE", "GDPR", "DDD", "BCM", "TEAM_TOPOLOGIES", "LEAN"].collect {
            [key: it, enabled: it != "DDD"]
        }
        exchange(HttpRequest.PUT("/administration/methodology-configurations", entries).bearerAuth(f.admin))

        expect:
        exchange(HttpRequest.POST("/business-entities", [names: [[locale: "en", text: "Invoice"]]]).bearerAuth(f.editor)).status == 201
    }

    def "creation targets report the required fields so the wizard can mark them"() {
        given:
        def f = fixture()
        exchange(HttpRequest.PUT("/administration/field-configurations", requiredConfig()).bearerAuth(f.admin))

        when:
        def targets = client.toBlocking().exchange(
                HttpRequest.GET("/creation/targets?itemType=BUSINESS_ENTITY").bearerAuth(f.editor), Map).body()

        then:
        (targets.requiredFields as List).containsAll(["names.de", "boundedContext"])
    }
}
