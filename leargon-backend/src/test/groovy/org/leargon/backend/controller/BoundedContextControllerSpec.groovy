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
import org.leargon.backend.model.LoginRequest
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.repository.BoundedContextRepository
import org.leargon.backend.repository.BusinessDomainRepository
import org.leargon.backend.repository.BusinessDomainVersionRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

@MicronautTest(transactional = false)
class BoundedContextControllerSpec extends Specification {

    @Inject @Client("/") HttpClient client

    @Inject UserRepository userRepository
    @Inject SupportedLocaleRepository localeRepository
    @Inject BoundedContextRepository boundedContextRepository
    @Inject BusinessDomainRepository businessDomainRepository
    @Inject BusinessDomainVersionRepository businessDomainVersionRepository

    def setup() {
        if (localeRepository.count() == 0) {
            localeRepository.save(new SupportedLocale(
                localeCode: "en", displayName: "English", isDefault: true, isActive: true, sortOrder: 1))
        }
    }

    def cleanup() {
        boundedContextRepository.deleteAll()
        businessDomainVersionRepository.deleteAll()
        businessDomainRepository.findAll().each { businessDomainRepository.delete(it) }
        userRepository.deleteAll()
    }

    // ─── helpers ─────────────────────────────────────────────────────────────

    private Map createUserWithToken(String email, String username) {
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/authentication/signup",
                new SignupRequest(email, username, "password123", "Test", "User")), Map)
        [token: resp.body().accessToken]
    }

    private String createAdminToken() {
        def email = "admin-bc-${System.currentTimeMillis()}@test.com"
        def username = "adminBc${System.currentTimeMillis()}"
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

    private String createDomain(String adminToken, String name) {
        def body = [names: [[locale: "en", text: name]]]
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/business-domains", body).bearerAuth(adminToken), Map)
        resp.body().key
    }

    private Map createBoundedContext(String adminToken, String domainKey, String name) {
        def body = [names: [[locale: "en", text: name]]]
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/business-domains/${domainKey}/bounded-contexts", body).bearerAuth(adminToken), Map)
        resp.body()
    }

    private String encodedKey(String key) {
        URLEncoder.encode(key as String, "UTF-8")
    }

    // ─── GET /business-domains/{key}/bounded-contexts ────────────────────────

    def "GET /business-domains/{key}/bounded-contexts returns empty list for new domain"() {
        given:
        def adminToken = createAdminToken()
        def domainKey = createDomain(adminToken, "Empty Domain")

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.GET("/business-domains/${domainKey}/bounded-contexts").bearerAuth(adminToken),
            Argument.listOf(Map)
        )

        then:
        response.status == HttpStatus.OK
        response.body().isEmpty()
    }

    def "GET /business-domains/{key}/bounded-contexts returns 404 for unknown domain"() {
        given:
        def userData = createUserWithToken("bc-user1@test.com", "bcUser1")

        when:
        client.toBlocking().exchange(
            HttpRequest.GET("/business-domains/nonexistent-domain/bounded-contexts").bearerAuth(userData.token),
            Argument.listOf(Map)
        )

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.NOT_FOUND
    }

    def "GET /business-domains/{key}/bounded-contexts returns 401 without auth"() {
        given:
        def adminToken = createAdminToken()
        def domainKey = createDomain(adminToken, "Auth Domain")

        when:
        client.toBlocking().exchange(
            HttpRequest.GET("/business-domains/${domainKey}/bounded-contexts"),
            Argument.listOf(Map)
        )

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.UNAUTHORIZED
    }

    // ─── GET /bounded-contexts/{key} ─────────────────────────────────────────

    def "GET /bounded-contexts/{key} returns bounded context for authenticated user"() {
        given:
        def adminToken = createAdminToken()
        def domainKey = createDomain(adminToken, "Domain For Get")
        def bc = createBoundedContext(adminToken, domainKey, "Core Context")
        def userData = createUserWithToken("bc-reader@test.com", "bcReader")
        def encodedKey = URLEncoder.encode(bc.key as String, "UTF-8")

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.GET("/bounded-contexts/${encodedKey}").bearerAuth(userData.token),
            Map
        )

        then:
        response.status == HttpStatus.OK
        response.body().key == bc.key
        response.body().names[0].text == "Core Context"
    }

    def "GET /bounded-contexts/{key} returns 404 for unknown key"() {
        given:
        def userData = createUserWithToken("bc-user-404@test.com", "bcUser404")

        when:
        client.toBlocking().exchange(
            HttpRequest.GET("/bounded-contexts/nonexistent-key").bearerAuth(userData.token),
            Map
        )

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.NOT_FOUND
    }

    // ─── POST /business-domains/{key}/bounded-contexts ───────────────────────

    def "POST creates bounded context for admin"() {
        given:
        def adminToken = createAdminToken()
        def domainKey = createDomain(adminToken, "Domain For Create")
        def body = [names: [[locale: "en", text: "Billing Context"]]]

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.POST("/business-domains/${domainKey}/bounded-contexts", body).bearerAuth(adminToken),
            Map
        )

        then:
        response.status == HttpStatus.CREATED
        def bc = response.body()
        bc.key != null
        bc.key.startsWith(domainKey as String)
        bc.names[0].text == "Billing Context"
        bc.domain.key == domainKey
    }

    def "POST creates bounded context with context type"() {
        given:
        def adminToken = createAdminToken()
        def domainKey = createDomain(adminToken, "Domain With Type")
        def body = [
            names      : [[locale: "en", text: "Core Domain Context"]],
            contextType: "FEATURE"
        ]

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.POST("/business-domains/${domainKey}/bounded-contexts", body).bearerAuth(adminToken),
            Map
        )
        def encodedKey = encodedKey(response.body().key as String)
        def getResp = client.toBlocking().exchange(
            HttpRequest.GET("/bounded-contexts/${encodedKey}").bearerAuth(adminToken), Map)

        then:
        response.status == HttpStatus.CREATED
        getResp.body().contextType == "FEATURE"
    }

    def "POST returns 403 for non-admin"() {
        given:
        def adminToken = createAdminToken()
        def domainKey = createDomain(adminToken, "Domain 403 BC")
        def userData = createUserWithToken("bc-nonadmin@test.com", "bcNonAdmin")
        def body = [names: [[locale: "en", text: "Forbidden Context"]]]

        when:
        client.toBlocking().exchange(
            HttpRequest.POST("/business-domains/${domainKey}/bounded-contexts", body).bearerAuth(userData.token),
            Map
        )

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }

    def "POST returns 404 for unknown domain"() {
        given:
        def adminToken = createAdminToken()
        def body = [names: [[locale: "en", text: "Context for missing domain"]]]

        when:
        client.toBlocking().exchange(
            HttpRequest.POST("/business-domains/nonexistent-domain/bounded-contexts", body).bearerAuth(adminToken),
            Map
        )

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.NOT_FOUND
    }

    def "POST returns 401 without auth"() {
        given:
        def adminToken = createAdminToken()
        def domainKey = createDomain(adminToken, "Domain Unauth")
        def body = [names: [[locale: "en", text: "Context"]]]

        when:
        client.toBlocking().exchange(
            HttpRequest.POST("/business-domains/${domainKey}/bounded-contexts", body),
            Map
        )

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.UNAUTHORIZED
    }

    // ─── PUT /bounded-contexts/{key}/names ───────────────────────────────────

    def "PUT /bounded-contexts/{key}/names updates names for admin"() {
        given:
        def adminToken = createAdminToken()
        def domainKey = createDomain(adminToken, "Domain Update Names")
        def bc = createBoundedContext(adminToken, domainKey, "Original Name")
        def encodedKey = encodedKey(bc.key as String)
        def body = [names: [[locale: "en", text: "Updated Name"]]]

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.PUT("/bounded-contexts/${encodedKey}/names", body).bearerAuth(adminToken),
            Map
        )

        then:
        response.status == HttpStatus.OK
        response.body().names[0].text == "Updated Name"
    }

    def "PUT /bounded-contexts/{key}/names returns 403 for non-admin"() {
        given:
        def adminToken = createAdminToken()
        def domainKey = createDomain(adminToken, "Domain Update Names 403")
        def bc = createBoundedContext(adminToken, domainKey, "Name Before 403")
        def encodedKey = encodedKey(bc.key as String)
        def userData = createUserWithToken("bc-updater@test.com", "bcUpdater")
        def body = [names: [[locale: "en", text: "Forbidden Update"]]]

        when:
        client.toBlocking().exchange(
            HttpRequest.PUT("/bounded-contexts/${encodedKey}/names", body).bearerAuth(userData.token),
            Map
        )

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }

    // ─── PUT /bounded-contexts/{key}/descriptions ─────────────────────────────

    def "PUT /bounded-contexts/{key}/descriptions updates descriptions for admin"() {
        given:
        def adminToken = createAdminToken()
        def domainKey = createDomain(adminToken, "Domain Update Desc")
        def bc = createBoundedContext(adminToken, domainKey, "Context With Desc")
        def encodedKey = encodedKey(bc.key as String)
        def body = [descriptions: [[locale: "en", text: "A description of the context"]]]

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.PUT("/bounded-contexts/${encodedKey}/descriptions", body).bearerAuth(adminToken),
            Map
        )

        then:
        response.status == HttpStatus.OK
        response.body().descriptions[0].text == "A description of the context"
    }

    // ─── DELETE /bounded-contexts/{key} ──────────────────────────────────────

    def "DELETE /bounded-contexts/{key} removes bounded context for admin"() {
        given:
        def adminToken = createAdminToken()
        def domainKey = createDomain(adminToken, "Domain For Delete")
        def bc = createBoundedContext(adminToken, domainKey, "Context To Delete")
        def encodedKey = encodedKey(bc.key as String)

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.DELETE("/bounded-contexts/${encodedKey}").bearerAuth(adminToken),
            Void
        )

        then:
        response.status == HttpStatus.NO_CONTENT

        and:
        def listResp = client.toBlocking().exchange(
            HttpRequest.GET("/business-domains/${domainKey}/bounded-contexts").bearerAuth(adminToken),
            Argument.listOf(Map)
        )
        listResp.body().isEmpty()
    }

    def "DELETE /bounded-contexts/{key} returns 403 for non-admin"() {
        given:
        def adminToken = createAdminToken()
        def domainKey = createDomain(adminToken, "Domain Delete 403")
        def bc = createBoundedContext(adminToken, domainKey, "Protected Context")
        def encodedKey = encodedKey(bc.key as String)
        def userData = createUserWithToken("bc-deleter@test.com", "bcDeleter")

        when:
        client.toBlocking().exchange(
            HttpRequest.DELETE("/bounded-contexts/${encodedKey}").bearerAuth(userData.token),
            Void
        )

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }

    def "DELETE /bounded-contexts/{key} returns 404 for unknown key"() {
        given:
        def adminToken = createAdminToken()

        when:
        client.toBlocking().exchange(
            HttpRequest.DELETE("/bounded-contexts/nonexistent-bc").bearerAuth(adminToken),
            Void
        )

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.NOT_FOUND
    }

    // ─── domain response includes bounded contexts ────────────────────────────

    def "GET /business-domains/{key} response includes bounded contexts"() {
        given:
        def adminToken = createAdminToken()
        def domainKey = createDomain(adminToken, "Domain With BCs")
        createBoundedContext(adminToken, domainKey, "BC One")
        createBoundedContext(adminToken, domainKey, "BC Two")

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.GET("/business-domains/${domainKey}").bearerAuth(adminToken),
            Map
        )

        then:
        response.status == HttpStatus.OK
        response.body().boundedContexts.size() == 2
    }
}
