package org.leargon.backend.controller

import io.micronaut.core.type.Argument
import io.micronaut.http.HttpRequest
import io.micronaut.http.HttpStatus
import io.micronaut.http.client.HttpClient
import io.micronaut.http.client.annotation.Client
import io.micronaut.http.client.exceptions.HttpClientResponseException
import io.micronaut.test.extensions.spock.annotation.MicronautTest
import jakarta.inject.Inject
import org.leargon.backend.domain.SupportedLocale
import org.leargon.backend.model.CreateBusinessEntityRequest
import org.leargon.backend.model.LocalizedText
import org.leargon.backend.model.LoginRequest
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.repository.BusinessDataQualityRuleRepository
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.BusinessEntityVersionRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

@MicronautTest(transactional = false)
class BusinessDataQualityRuleControllerSpec extends Specification {

    @Inject
    @Client("/")
    HttpClient client

    @Inject UserRepository userRepository
    @Inject BusinessEntityRepository businessEntityRepository
    @Inject BusinessEntityVersionRepository businessEntityVersionRepository
    @Inject BusinessDataQualityRuleRepository ruleRepository
    @Inject SupportedLocaleRepository localeRepository

    def setup() {
        if (localeRepository.count() == 0) {
            localeRepository.save(new SupportedLocale(
                localeCode: "en", displayName: "English", isDefault: true, isActive: true, sortOrder: 1))
        }
    }

    def cleanup() {
        ruleRepository.deleteAll()
        businessEntityVersionRepository.deleteAll()
        businessEntityRepository.findAll().each { businessEntityRepository.delete(it) }
        userRepository.deleteAll()
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private Map createUserWithToken(String email, String username) {
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/authentication/signup",
                new SignupRequest(email, username, "password123", "Test", "User")), Map)
        [token: resp.body().accessToken, email: email]
    }

    private String createAdminToken(String email = "admin@qualityrule.com", String username = "qrAdmin") {
        client.toBlocking().exchange(
            HttpRequest.POST("/authentication/signup",
                new SignupRequest(email, username, "password123", "Admin", "User")))
        def user = userRepository.findByEmail(email).get()
        user.roles = "ROLE_USER,ROLE_ADMIN"
        userRepository.update(user)
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/authentication/login",
                new LoginRequest(email, "password123")), Map)
        resp.body().accessToken
    }

    private String createEntity(String token, String name = "Test Entity") {
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/business-entities",
                new CreateBusinessEntityRequest([new LocalizedText("en", name)])).bearerAuth(token), Map)
        resp.body().key
    }

    private Map createRule(String token, String entityKey, Map body) {
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/business-entities/${entityKey}/quality-rules", body).bearerAuth(token), Map)
        resp.body()
    }

    // ─── GET /business-entities/{key}/quality-rules ────────────────────────────

    def "GET quality rules returns empty list for entity with no rules"() {
        given:
        def user = createUserWithToken("user1@qr.com", "qrUser1")
        String entityKey = createEntity(user.token)

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.GET("/business-entities/${entityKey}/quality-rules").bearerAuth(user.token),
            Argument.listOf(Map))

        then:
        resp.status == HttpStatus.OK
        resp.body() == []
    }

    def "GET quality rules returns 401 for unauthenticated request"() {
        given:
        def user = createUserWithToken("user2@qr.com", "qrUser2")
        String entityKey = createEntity(user.token)

        when:
        client.toBlocking().exchange(
            HttpRequest.GET("/business-entities/${entityKey}/quality-rules"),
            Argument.listOf(Map))

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.UNAUTHORIZED
    }

    def "GET quality rules returns 404 for unknown entity"() {
        given:
        def user = createUserWithToken("user3@qr.com", "qrUser3")

        when:
        client.toBlocking().exchange(
            HttpRequest.GET("/business-entities/non-existent/quality-rules").bearerAuth(user.token),
            Argument.listOf(Map))

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.NOT_FOUND
    }

    // ─── POST /business-entities/{key}/quality-rules ───────────────────────────

    def "POST quality rule returns 201 with description for entity owner"() {
        given:
        def user = createUserWithToken("user4@qr.com", "qrUser4")
        String entityKey = createEntity(user.token)
        def body = [description: "Age must be set and non-negative"]

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/business-entities/${entityKey}/quality-rules", body).bearerAuth(user.token),
            Map)

        then:
        resp.status == HttpStatus.CREATED
        def rule = resp.body()
        rule.id != null
        rule.description == "Age must be set and non-negative"
        rule.severity == null
        rule.createdAt != null
    }

    def "POST quality rule with MUST severity is persisted correctly"() {
        given:
        def user = createUserWithToken("user5@qr.com", "qrUser5")
        String entityKey = createEntity(user.token)
        def body = [description: "Customer must be at least 18 years old", severity: "MUST"]

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/business-entities/${entityKey}/quality-rules", body).bearerAuth(user.token),
            Map)

        then:
        resp.status == HttpStatus.CREATED
        resp.body().description == "Customer must be at least 18 years old"
        resp.body().severity == "MUST"
    }

    def "POST quality rule with SHOULD severity is persisted correctly"() {
        given:
        def user = createUserWithToken("user5b@qr.com", "qrUser5b")
        String entityKey = createEntity(user.token)
        def body = [description: "Email should be in valid format", severity: "SHOULD"]

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/business-entities/${entityKey}/quality-rules", body).bearerAuth(user.token),
            Map)

        then:
        resp.status == HttpStatus.CREATED
        resp.body().severity == "SHOULD"
    }

    def "POST quality rule with MAY severity is persisted correctly"() {
        given:
        def user = createUserWithToken("user5c@qr.com", "qrUser5c")
        String entityKey = createEntity(user.token)
        def body = [description: "Phone number may be provided for notifications", severity: "MAY"]

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/business-entities/${entityKey}/quality-rules", body).bearerAuth(user.token),
            Map)

        then:
        resp.status == HttpStatus.CREATED
        resp.body().severity == "MAY"
    }

    def "POST quality rule returns 201 for admin on any entity"() {
        given:
        def owner = createUserWithToken("owner1@qr.com", "qrOwner1")
        String adminToken = createAdminToken("admin1@qr.com", "qrAdmin1")
        String entityKey = createEntity(owner.token)
        def body = [description: "Email must follow RFC 5322 standard", severity: "MUST"]

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/business-entities/${entityKey}/quality-rules", body).bearerAuth(adminToken),
            Map)

        then:
        resp.status == HttpStatus.CREATED
        resp.body().description == "Email must follow RFC 5322 standard"
    }

    def "POST quality rule returns 403 for non-owner non-admin"() {
        given:
        def owner = createUserWithToken("owner2@qr.com", "qrOwner2")
        def other = createUserWithToken("other1@qr.com", "qrOther1")
        String entityKey = createEntity(owner.token)
        def body = [description: "Name must not be blank"]

        when:
        client.toBlocking().exchange(
            HttpRequest.POST("/business-entities/${entityKey}/quality-rules", body).bearerAuth(other.token),
            Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }

    def "POST quality rule returns 404 for unknown entity"() {
        given:
        def user = createUserWithToken("user6@qr.com", "qrUser6")
        def body = [description: "Name must not be blank"]

        when:
        client.toBlocking().exchange(
            HttpRequest.POST("/business-entities/non-existent/quality-rules", body).bearerAuth(user.token),
            Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.NOT_FOUND
    }

    def "POST quality rule returns 401 for unauthenticated request"() {
        given:
        def user = createUserWithToken("user7@qr.com", "qrUser7")
        String entityKey = createEntity(user.token)
        def body = [description: "Name must not be blank"]

        when:
        client.toBlocking().exchange(
            HttpRequest.POST("/business-entities/${entityKey}/quality-rules", body), Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.UNAUTHORIZED
    }

    // ─── GET returns created rules ─────────────────────────────────────────────

    def "GET quality rules returns all created rules for entity"() {
        given:
        def user = createUserWithToken("user8@qr.com", "qrUser8")
        String entityKey = createEntity(user.token)
        createRule(user.token, entityKey, [description: "Age must be at least 18", severity: "MUST"])
        createRule(user.token, entityKey, [description: "Email should follow RFC 5322"])

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.GET("/business-entities/${entityKey}/quality-rules").bearerAuth(user.token),
            Argument.listOf(Map))

        then:
        resp.status == HttpStatus.OK
        resp.body().size() == 2
        resp.body().any { it.description == "Age must be at least 18" && it.severity == "MUST" }
        resp.body().any { it.description == "Email should follow RFC 5322" }
    }

    def "GET entity response includes qualityRules array"() {
        given:
        def user = createUserWithToken("user9@qr.com", "qrUser9")
        String entityKey = createEntity(user.token)
        createRule(user.token, entityKey, [description: "Status must be one of: ACTIVE, INACTIVE", severity: "MUST"])

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.GET("/business-entities/${entityKey}").bearerAuth(user.token), Map)

        then:
        resp.status == HttpStatus.OK
        def rules = resp.body().qualityRules
        rules != null
        rules.size() == 1
        rules[0].description == "Status must be one of: ACTIVE, INACTIVE"
        rules[0].severity == "MUST"
    }

    // ─── PUT /business-entities/{key}/quality-rules/{ruleId} ──────────────────

    def "PUT quality rule updates description and severity"() {
        given:
        def user = createUserWithToken("user10@qr.com", "qrUser10")
        String entityKey = createEntity(user.token)
        def created = createRule(user.token, entityKey, [description: "Age must be set"])
        long ruleId = created.id as long

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.PUT("/business-entities/${entityKey}/quality-rules/${ruleId}",
                [description: "Customer age must be at least 21", severity: "MUST"]).bearerAuth(user.token),
            Map)

        then:
        resp.status == HttpStatus.OK
        resp.body().description == "Customer age must be at least 21"
        resp.body().severity == "MUST"
        resp.body().updatedAt != null
    }

    def "PUT quality rule can clear severity by omitting it"() {
        given:
        def user = createUserWithToken("user10b@qr.com", "qrUser10b")
        String entityKey = createEntity(user.token)
        def created = createRule(user.token, entityKey, [description: "Age rule", severity: "MUST"])
        long ruleId = created.id as long

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.PUT("/business-entities/${entityKey}/quality-rules/${ruleId}",
                [description: "Updated age rule"]).bearerAuth(user.token),
            Map)

        then:
        resp.status == HttpStatus.OK
        resp.body().description == "Updated age rule"
        resp.body().severity == null
    }

    def "PUT quality rule returns 403 for non-owner non-admin"() {
        given:
        def owner = createUserWithToken("owner3@qr.com", "qrOwner3")
        def other = createUserWithToken("other2@qr.com", "qrOther2")
        String entityKey = createEntity(owner.token)
        def created = createRule(owner.token, entityKey, [description: "Age must be set"])
        long ruleId = created.id as long

        when:
        client.toBlocking().exchange(
            HttpRequest.PUT("/business-entities/${entityKey}/quality-rules/${ruleId}",
                [description: "Attempted update"]).bearerAuth(other.token),
            Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }

    def "PUT quality rule returns 404 for unknown rule id"() {
        given:
        def user = createUserWithToken("user11@qr.com", "qrUser11")
        String entityKey = createEntity(user.token)

        when:
        client.toBlocking().exchange(
            HttpRequest.PUT("/business-entities/${entityKey}/quality-rules/99999",
                [description: "Some rule"]).bearerAuth(user.token),
            Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.NOT_FOUND
    }

    // ─── DELETE /business-entities/{key}/quality-rules/{ruleId} ───────────────

    def "DELETE quality rule removes it and returns 204"() {
        given:
        def user = createUserWithToken("user12@qr.com", "qrUser12")
        String entityKey = createEntity(user.token)
        def created = createRule(user.token, entityKey, [description: "Age must be set"])
        long ruleId = created.id as long

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.DELETE("/business-entities/${entityKey}/quality-rules/${ruleId}").bearerAuth(user.token))

        then:
        resp.status == HttpStatus.NO_CONTENT

        and: "rule is no longer returned"
        def listResp = client.toBlocking().exchange(
            HttpRequest.GET("/business-entities/${entityKey}/quality-rules").bearerAuth(user.token),
            Argument.listOf(Map))
        listResp.body().isEmpty()
    }

    def "DELETE quality rule returns 403 for non-owner non-admin"() {
        given:
        def owner = createUserWithToken("owner4@qr.com", "qrOwner4")
        def other = createUserWithToken("other3@qr.com", "qrOther3")
        String entityKey = createEntity(owner.token)
        def created = createRule(owner.token, entityKey, [description: "Age must be set"])
        long ruleId = created.id as long

        when:
        client.toBlocking().exchange(
            HttpRequest.DELETE("/business-entities/${entityKey}/quality-rules/${ruleId}").bearerAuth(other.token))

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }

    def "DELETE quality rule returns 404 for unknown rule id"() {
        given:
        def user = createUserWithToken("user13@qr.com", "qrUser13")
        String entityKey = createEntity(user.token)

        when:
        client.toBlocking().exchange(
            HttpRequest.DELETE("/business-entities/${entityKey}/quality-rules/99999").bearerAuth(user.token))

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.NOT_FOUND
    }

    // ─── Export ────────────────────────────────────────────────────────────────

    def "GET /export/business-data-quality-rules returns CSV with description and severity for admin"() {
        given:
        String adminToken = createAdminToken("admin2@qr.com", "qrAdmin2")
        def owner = createUserWithToken("owner5@qr.com", "qrOwner5")
        String entityKey = createEntity(owner.token, "Export Entity")
        createRule(owner.token, entityKey, [description: "Customer must be at least 18 years old", severity: "MUST"])

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.GET("/export/business-data-quality-rules").bearerAuth(adminToken), String)

        then:
        resp.status == HttpStatus.OK
        resp.body().contains("Customer must be at least 18 years old")
        resp.body().contains("MUST")
    }

    def "GET /export/business-data-quality-rules CSV excludes old constraint type fields"() {
        given:
        String adminToken = createAdminToken("admin3@qr.com", "qrAdmin3")
        def owner = createUserWithToken("owner6@qr.com", "qrOwner6")
        String entityKey = createEntity(owner.token, "Export Entity 2")
        createRule(owner.token, entityKey, [description: "Email should follow standard format", severity: "SHOULD"])

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.GET("/export/business-data-quality-rules").bearerAuth(adminToken), String)

        then:
        resp.status == HttpStatus.OK
        !resp.body().contains("Constraint Type")
        !resp.body().contains("Field Name")
        resp.body().contains("Description")
        resp.body().contains("Severity")
    }

    def "GET /export/business-data-quality-rules returns 403 for non-admin"() {
        given:
        def user = createUserWithToken("user14@qr.com", "qrUser14")

        when:
        client.toBlocking().exchange(
            HttpRequest.GET("/export/business-data-quality-rules").bearerAuth(user.token), String)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }

    def "GET /export/business-data-quality-rules returns 401 without auth"() {
        when:
        client.toBlocking().exchange(
            HttpRequest.GET("/export/business-data-quality-rules"), String)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.UNAUTHORIZED
    }
}
