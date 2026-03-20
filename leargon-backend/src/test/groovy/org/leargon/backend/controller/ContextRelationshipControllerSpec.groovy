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
import org.leargon.backend.repository.ContextRelationshipRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

@MicronautTest(transactional = false)
class ContextRelationshipControllerSpec extends Specification {

    @Inject
    @Client("/")
    HttpClient client

    @Inject UserRepository userRepository
    @Inject SupportedLocaleRepository localeRepository
    @Inject ContextRelationshipRepository contextRelationshipRepository
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
        contextRelationshipRepository.deleteAll()
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
        def email = "admin-ctx-${System.currentTimeMillis()}@test.com"
        def username = "adminCtx${System.currentTimeMillis()}"
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

    private String createBoundedContext(String adminToken, String domainKey, String name) {
        def body = [names: [[locale: "en", text: name]]]
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/business-domains/${domainKey}/bounded-contexts", body).bearerAuth(adminToken), Map)
        resp.body().key
    }

    // ─── GET /context-relationships ──────────────────────────────────────────

    def "GET /context-relationships returns empty list initially"() {
        given:
        def userData = createUserWithToken("ctx-user1@test.com", "ctxUser1")
        def token = userData.token

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.GET("/context-relationships").bearerAuth(token),
            Argument.listOf(Map)
        )

        then:
        response.status == HttpStatus.OK
        response.body().isEmpty()
    }

    // ─── POST /context-relationships ─────────────────────────────────────────

    def "POST /context-relationships creates relationship for admin"() {
        given:
        def adminToken = createAdminToken()
        def upDomainKey = createDomain(adminToken, "Upstream Domain")
        def downDomainKey = createDomain(adminToken, "Downstream Domain")
        def upKey = createBoundedContext(adminToken, upDomainKey, "Upstream Core")
        def downKey = createBoundedContext(adminToken, downDomainKey, "Downstream Core")

        def body = [
            upstreamBoundedContextKey  : upKey,
            downstreamBoundedContextKey: downKey,
            relationshipType           : "CUSTOMER_SUPPLIER",
            description                : "Test relationship"
        ]

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.POST("/context-relationships", body).bearerAuth(adminToken),
            Map
        )

        then:
        response.status == HttpStatus.CREATED
        def rel = response.body()
        rel.id != null
        rel.relationshipType == "CUSTOMER_SUPPLIER"
        rel.upstreamBoundedContext.key == upKey
        rel.downstreamBoundedContext.key == downKey
        rel.description == "Test relationship"
    }

    def "POST /context-relationships returns 403 for non-admin"() {
        given:
        def adminToken = createAdminToken()
        def upDomainKey = createDomain(adminToken, "Up Domain 403")
        def downDomainKey = createDomain(adminToken, "Down Domain 403")
        def upKey = createBoundedContext(adminToken, upDomainKey, "Up Core 403")
        def downKey = createBoundedContext(adminToken, downDomainKey, "Down Core 403")

        def userData = createUserWithToken("ctx-user2@test.com", "ctxUser2")
        def userToken = userData.token

        def body = [
            upstreamBoundedContextKey  : upKey,
            downstreamBoundedContextKey: downKey,
            relationshipType           : "PARTNERSHIP"
        ]

        when:
        client.toBlocking().exchange(
            HttpRequest.POST("/context-relationships", body).bearerAuth(userToken),
            Map
        )

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }

    // ─── PUT /context-relationships/{id} ─────────────────────────────────────

    def "PUT /context-relationships/{id} updates relationship type"() {
        given:
        def adminToken = createAdminToken()
        def upDomainKey = createDomain(adminToken, "Up Domain PUT")
        def downDomainKey = createDomain(adminToken, "Down Domain PUT")
        def upKey = createBoundedContext(adminToken, upDomainKey, "Up Core PUT")
        def downKey = createBoundedContext(adminToken, downDomainKey, "Down Core PUT")

        def createBody = [
            upstreamBoundedContextKey  : upKey,
            downstreamBoundedContextKey: downKey,
            relationshipType           : "PARTNERSHIP"
        ]
        def created = client.toBlocking().exchange(
            HttpRequest.POST("/context-relationships", createBody).bearerAuth(adminToken), Map)
        def relId = created.body().id

        def updateBody = [
            relationshipType: "CONFORMIST"
        ]

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.PUT("/context-relationships/${relId}", updateBody).bearerAuth(adminToken),
            Map
        )

        then:
        response.status == HttpStatus.OK
        response.body().relationshipType == "CONFORMIST"
    }

    // ─── DELETE /context-relationships/{id} ──────────────────────────────────

    def "DELETE /context-relationships/{id} removes relationship"() {
        given:
        def adminToken = createAdminToken()
        def upDomainKey = createDomain(adminToken, "Up Domain DEL")
        def downDomainKey = createDomain(adminToken, "Down Domain DEL")
        def upKey = createBoundedContext(adminToken, upDomainKey, "Up Core DEL")
        def downKey = createBoundedContext(adminToken, downDomainKey, "Down Core DEL")

        def createBody = [
            upstreamBoundedContextKey  : upKey,
            downstreamBoundedContextKey: downKey,
            relationshipType           : "SHARED_KERNEL"
        ]
        def created = client.toBlocking().exchange(
            HttpRequest.POST("/context-relationships", createBody).bearerAuth(adminToken), Map)
        def relId = created.body().id

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.DELETE("/context-relationships/${relId}").bearerAuth(adminToken),
            Void
        )

        then:
        response.status == HttpStatus.NO_CONTENT

        and:
        def listResp = client.toBlocking().exchange(
            HttpRequest.GET("/context-relationships").bearerAuth(adminToken),
            Argument.listOf(Map)
        )
        listResp.body().isEmpty()
    }

    def "DELETE /context-relationships/{id} returns 404 for unknown id"() {
        given:
        def adminToken = createAdminToken()

        when:
        client.toBlocking().exchange(
            HttpRequest.DELETE("/context-relationships/999999").bearerAuth(adminToken),
            Void
        )

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.NOT_FOUND
    }
}
