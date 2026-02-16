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
import org.leargon.backend.model.BusinessDomainResponse
import org.leargon.backend.model.BusinessDomainTreeResponse
import org.leargon.backend.model.BusinessDomainType
import org.leargon.backend.model.CreateBusinessDomainRequest
import org.leargon.backend.model.LocalizedText
import org.leargon.backend.model.LoginRequest
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.model.UpdateBusinessDomainParentRequest
import org.leargon.backend.model.UpdateBusinessDomainTypeRequest
import org.leargon.backend.repository.BusinessDomainRepository
import org.leargon.backend.repository.BusinessDomainVersionRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

@MicronautTest(transactional = false)
class BusinessDomainControllerSpec extends Specification {

    @Inject
    @Client("/")
    HttpClient client

    @Inject
    UserRepository userRepository

    @Inject
    BusinessDomainRepository businessDomainRepository

    @Inject
    BusinessDomainVersionRepository businessDomainVersionRepository

    @Inject
    SupportedLocaleRepository localeRepository

    def setup() {
        ensureLocalesExist()
    }

    def cleanup() {
        businessDomainVersionRepository.deleteAll()
        // Delete domains individually to trigger JPA cascades
        // First delete children (domains with parents), then parents (top-level)
        def allDomains = businessDomainRepository.findAll()
        def childDomains = allDomains.findAll { it.parent != null }
        def topDomains = allDomains.findAll { it.parent == null }

        childDomains.each { domain ->
            try { businessDomainRepository.delete(domain) } catch (ignored) {}
        }
        topDomains.each { domain ->
            try { businessDomainRepository.delete(domain) } catch (ignored) {}
        }

        userRepository.deleteAll()
    }

    private void ensureLocalesExist() {
        if (localeRepository.count() == 0) {
            def enLocale = new SupportedLocale()
            enLocale.localeCode = "en"
            enLocale.displayName = "English"
            enLocale.isDefault = true
            enLocale.isActive = true
            enLocale.sortOrder = 1
            localeRepository.save(enLocale)

            def deLocale = new SupportedLocale()
            deLocale.localeCode = "de"
            deLocale.displayName = "German"
            deLocale.isDefault = false
            deLocale.isActive = true
            deLocale.sortOrder = 2
            localeRepository.save(deLocale)
        }
    }

    private Map createUserWithToken(String email, String username) {
        def signupRequest = new SignupRequest(email, username, "password123", "Test", "User")
        def signupResponse = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/signup", signupRequest),
                Map
        )
        def user = userRepository.findByEmail(email).get()
        return [token: signupResponse.body().accessToken, user: user]
    }

    private String createAdminToken() {
        def signupRequest = new SignupRequest("admin@example.com", "admin", "password123", "Admin", "User")
        client.toBlocking().exchange(HttpRequest.POST("/authentication/signup", signupRequest))

        def user = userRepository.findByEmail("admin@example.com").get()
        user.roles = "ROLE_USER,ROLE_ADMIN"
        userRepository.update(user)

        def loginRequest = new LoginRequest("admin@example.com", "password123")
        def loginResponse = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/login", loginRequest),
                Map
        )
        return loginResponse.body().accessToken
    }

    // =====================
    // CREATE DOMAIN TESTS
    // =====================

    def "POST /business-domains should create domain when admin"() {
        given: "an admin user"
        String adminToken = createAdminToken()

        and: "a valid create request"
        def enTranslation = new LocalizedText("en", "Sales")
        def deTranslation = new LocalizedText("de", "Vertrieb")
        def request = new CreateBusinessDomainRequest([enTranslation, deTranslation])

        when: "creating a businessDomain"
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/business-domains", request)
                        .bearerAuth(adminToken),
                BusinessDomainResponse
        )

        then: "response is successful"
        response.status == HttpStatus.CREATED

        and: "businessDomain is created with correct data"
        def domain = response.body()
        domain.key != null
        domain.key == "sales"
        domain.names.size() == 2
        domain.names.any { it.locale == "en" && it.text == "Sales" }
        domain.names.any { it.locale == "de" && it.text == "Vertrieb" }
    }

    def "POST /business-domains should create domain with domain type"() {
        given: "an admin user"
        String adminToken = createAdminToken()

        and: "a create request with businessDomain type"
        def request = new CreateBusinessDomainRequest([new LocalizedText("en", "Core Services")])
        request.type = BusinessDomainType.CORE

        when: "creating a businessDomain"
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/business-domains", request)
                        .bearerAuth(adminToken),
                BusinessDomainResponse
        )

        then: "businessDomain has correct type"
        response.body().type == BusinessDomainType.CORE
        response.body().effectiveType == BusinessDomainType.CORE
    }

    def "POST /business-domains should create subdomain with parent"() {
        given: "an admin user and a parent businessDomain"
        String adminToken = createAdminToken()
        def parentRequest = new CreateBusinessDomainRequest([new LocalizedText("en", "Sales")])
        def parentResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-domains", parentRequest)
                        .bearerAuth(adminToken),
                BusinessDomainResponse
        )
        def parentKey = parentResponse.body().key

        and: "a subdomain request"
        def childRequest = new CreateBusinessDomainRequest([new LocalizedText("en", "B2B Sales")])
        childRequest.parentKey = parentKey

        when: "creating a subdomain"
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/business-domains", childRequest)
                        .bearerAuth(adminToken),
                BusinessDomainResponse
        )

        then: "subdomain has correct parent and hierarchical key"
        response.body().parent.key == parentKey
        response.body().key == "sales.b2b-sales"
    }

    def "POST /business-domains should return 403 for non-admin"() {
        given: "a regular user"
        def userData = createUserWithToken("user@example.com", "user")

        and: "a create request"
        def request = new CreateBusinessDomainRequest([new LocalizedText("en", "BusinessDomain")])

        when: "non-admin tries to create businessDomain"
        client.toBlocking().exchange(
                HttpRequest.POST("/business-domains", request)
                        .bearerAuth(userData.token),
                BusinessDomainResponse
        )

        then: "forbidden exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.FORBIDDEN
    }

    def "POST /business-domains should return 401 without authentication"() {
        when: "creating businessDomain without token"
        def request = new CreateBusinessDomainRequest([new LocalizedText("en", "BusinessDomain")])
        client.toBlocking().exchange(
                HttpRequest.POST("/business-domains", request),
                BusinessDomainResponse
        )

        then: "unauthorized exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.UNAUTHORIZED
    }

    def "POST /business-domains should return 400 without default locale translation"() {
        given: "an admin user"
        String adminToken = createAdminToken()

        and: "a request without English translation"
        def request = new CreateBusinessDomainRequest([new LocalizedText("de", "Nur Deutsch")])

        when: "creating businessDomain without default locale"
        client.toBlocking().exchange(
                HttpRequest.POST("/business-domains", request)
                        .bearerAuth(adminToken),
                BusinessDomainResponse
        )

        then: "bad request exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.BAD_REQUEST
    }

    // =====================
    // GET DOMAIN TESTS
    // =====================

    def "GET /business-domains/{key} should return domain by key"() {
        given: "an admin user and a created businessDomain"
        String adminToken = createAdminToken()
        def createRequest = new CreateBusinessDomainRequest([new LocalizedText("en", "Test BusinessDomain")])
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-domains", createRequest)
                        .bearerAuth(adminToken),
                BusinessDomainResponse
        )
        def domainKey = createResponse.body().key

        when: "getting businessDomain by key"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/business-domains/${domainKey}")
                        .bearerAuth(adminToken),
                BusinessDomainResponse
        )

        then: "response is successful"
        response.status == HttpStatus.OK
        response.body().key == domainKey
        response.body().names.find { it.locale == "en" }.text == "Test BusinessDomain"
    }

    def "GET /business-domains/{key} should return 404 for non-existent domain"() {
        given: "a regular user"
        def userData = createUserWithToken("user@example.com", "user")

        when: "getting non-existent businessDomain"
        client.toBlocking().exchange(
                HttpRequest.GET("/business-domains/non-existent-key")
                        .bearerAuth(userData.token),
                BusinessDomainResponse
        )

        then: "not found exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.NOT_FOUND
    }

    def "GET /business-domains should return all domains"() {
        given: "an admin user and multiple domains"
        String adminToken = createAdminToken()
        client.toBlocking().exchange(
                HttpRequest.POST("/business-domains", new CreateBusinessDomainRequest([new LocalizedText("en", "BusinessDomain 1")]))
                        .bearerAuth(adminToken),
                BusinessDomainResponse
        )
        client.toBlocking().exchange(
                HttpRequest.POST("/business-domains", new CreateBusinessDomainRequest([new LocalizedText("en", "BusinessDomain 2")]))
                        .bearerAuth(adminToken),
                BusinessDomainResponse
        )

        when: "getting all domains"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/business-domains")
                        .bearerAuth(adminToken),
                Argument.listOf(BusinessDomainResponse)
        )

        then: "response is successful"
        response.status == HttpStatus.OK
        response.body().size() == 2
    }

    def "GET /business-domains/tree should return hierarchical tree"() {
        given: "an admin user and a businessDomain hierarchy"
        String adminToken = createAdminToken()
        def parentResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-domains", new CreateBusinessDomainRequest([new LocalizedText("en", "Parent")]))
                        .bearerAuth(adminToken),
                BusinessDomainResponse
        )
        def parentKey = parentResponse.body().key

        def childRequest = new CreateBusinessDomainRequest([new LocalizedText("en", "Child")])
        childRequest.parentKey = parentKey
        client.toBlocking().exchange(
                HttpRequest.POST("/business-domains", childRequest)
                        .bearerAuth(adminToken),
                BusinessDomainResponse
        )

        when: "getting businessDomain tree"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/business-domains/tree")
                        .bearerAuth(adminToken),
                Argument.listOf(BusinessDomainTreeResponse)
        )

        then: "response shows hierarchy"
        response.status == HttpStatus.OK
        response.body().size() == 1
        response.body()[0].children.size() == 1
    }

    // =====================
    // UPDATE DOMAIN TESTS (granular endpoints)
    // =====================

    def "PUT /business-domains/{key}/names should update domain names when admin"() {
        given: "an admin user and a created businessDomain"
        String adminToken = createAdminToken()
        def createRequest = new CreateBusinessDomainRequest([new LocalizedText("en", "Original")])
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-domains", createRequest)
                        .bearerAuth(adminToken),
                BusinessDomainResponse
        )
        def domainKey = createResponse.body().key

        when: "updating businessDomain names"
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/business-domains/${domainKey}/names",
                        [new LocalizedText("en", "Updated")])
                        .bearerAuth(adminToken),
                BusinessDomainResponse
        )

        then: "response is successful"
        response.status == HttpStatus.OK
        response.body().names.find { it.locale == "en" }.text == "Updated"
    }

    def "PUT /business-domains/{key}/type should update domain type"() {
        given: "an admin user and a created businessDomain"
        String adminToken = createAdminToken()
        def createRequest = new CreateBusinessDomainRequest([new LocalizedText("en", "BusinessDomain")])
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-domains", createRequest)
                        .bearerAuth(adminToken),
                BusinessDomainResponse
        )
        def domainKey = createResponse.body().key

        when: "updating businessDomain type"
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/business-domains/${domainKey}/type",
                        new UpdateBusinessDomainTypeRequest().type(BusinessDomainType.GENERIC))
                        .bearerAuth(adminToken),
                BusinessDomainResponse
        )

        then: "businessDomain type is updated"
        response.body().type == BusinessDomainType.GENERIC
        response.body().effectiveType == BusinessDomainType.GENERIC
    }

    def "PUT /business-domains/{key}/names should return 403 for non-admin"() {
        given: "an admin creates a businessDomain"
        String adminToken = createAdminToken()
        def createRequest = new CreateBusinessDomainRequest([new LocalizedText("en", "BusinessDomain")])
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-domains", createRequest)
                        .bearerAuth(adminToken),
                BusinessDomainResponse
        )
        def domainKey = createResponse.body().key

        and: "a regular user"
        def userData = createUserWithToken("user@example.com", "user")

        when: "non-admin tries to update"
        client.toBlocking().exchange(
                HttpRequest.PUT("/business-domains/${domainKey}/names",
                        [new LocalizedText("en", "Unauthorized")])
                        .bearerAuth(userData.token),
                BusinessDomainResponse
        )

        then: "forbidden exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.FORBIDDEN
    }

    def "PUT /business-domains/{key}/parent should return 400 when creating cycle"() {
        given: "an admin user and a businessDomain hierarchy"
        String adminToken = createAdminToken()
        def parentResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-domains", new CreateBusinessDomainRequest([new LocalizedText("en", "Parent")]))
                        .bearerAuth(adminToken),
                BusinessDomainResponse
        )
        def parentKey = parentResponse.body().key

        def childRequest = new CreateBusinessDomainRequest([new LocalizedText("en", "Child")])
        childRequest.parentKey = parentKey
        def childResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-domains", childRequest)
                        .bearerAuth(adminToken),
                BusinessDomainResponse
        )
        def childKey = childResponse.body().key

        when: "trying to create cycle"
        client.toBlocking().exchange(
                HttpRequest.PUT("/business-domains/${parentKey}/parent",
                        new UpdateBusinessDomainParentRequest().parentKey(childKey))
                        .bearerAuth(adminToken),
                BusinessDomainResponse
        )

        then: "bad request exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.BAD_REQUEST
    }

    // =====================
    // DELETE DOMAIN TESTS
    // =====================

    def "DELETE /business-domains/{key} should delete domain when admin"() {
        given: "an admin user and a created businessDomain"
        String adminToken = createAdminToken()
        def createRequest = new CreateBusinessDomainRequest([new LocalizedText("en", "ToDelete")])
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-domains", createRequest)
                        .bearerAuth(adminToken),
                BusinessDomainResponse
        )
        def domainKey = createResponse.body().key

        when: "deleting businessDomain"
        def response = client.toBlocking().exchange(
                HttpRequest.DELETE("/business-domains/${domainKey}")
                        .bearerAuth(adminToken)
        )

        then: "response is successful"
        response.status == HttpStatus.NO_CONTENT

        and: "businessDomain is deleted"
        when:
        client.toBlocking().exchange(
                HttpRequest.GET("/business-domains/${domainKey}")
                        .bearerAuth(adminToken),
                BusinessDomainResponse
        )
        then:
        thrown(HttpClientResponseException)
    }

    def "DELETE /business-domains/{key} should return 403 for non-admin"() {
        given: "an admin creates a businessDomain"
        String adminToken = createAdminToken()
        def createRequest = new CreateBusinessDomainRequest([new LocalizedText("en", "BusinessDomain")])
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-domains", createRequest)
                        .bearerAuth(adminToken),
                BusinessDomainResponse
        )
        def domainKey = createResponse.body().key

        and: "a regular user"
        def userData = createUserWithToken("user@example.com", "user")

        when: "non-admin tries to delete"
        client.toBlocking().exchange(
                HttpRequest.DELETE("/business-domains/${domainKey}")
                        .bearerAuth(userData.token)
        )

        then: "forbidden exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.FORBIDDEN
    }

    def "DELETE /business-domains/{key} should return 404 for non-existent domain"() {
        given: "an admin user"
        String adminToken = createAdminToken()

        when: "deleting non-existent businessDomain"
        client.toBlocking().exchange(
                HttpRequest.DELETE("/business-domains/non-existent-key")
                        .bearerAuth(adminToken)
        )

        then: "not found exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.NOT_FOUND
    }

    def "DELETE /business-domains/{key} should detach children not cascade delete"() {
        given: "an admin user and a businessDomain hierarchy"
        String adminToken = createAdminToken()
        def parentResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-domains", new CreateBusinessDomainRequest([new LocalizedText("en", "Parent")]))
                        .bearerAuth(adminToken),
                BusinessDomainResponse
        )
        def parentKey = parentResponse.body().key

        def childRequest = new CreateBusinessDomainRequest([new LocalizedText("en", "Child")])
        childRequest.parentKey = parentKey
        client.toBlocking().exchange(
                HttpRequest.POST("/business-domains", childRequest)
                        .bearerAuth(adminToken),
                BusinessDomainResponse
        )

        when: "deleting parent"
        client.toBlocking().exchange(
                HttpRequest.DELETE("/business-domains/${parentKey}")
                        .bearerAuth(adminToken)
        )

        then: "child still exists with no parent and recomputed key"
        def childResponse = client.toBlocking().exchange(
                HttpRequest.GET("/business-domains/child")
                        .bearerAuth(adminToken),
                BusinessDomainResponse
        )
        childResponse.status == HttpStatus.OK
        childResponse.body().parent == null
        childResponse.body().key == "child"
    }

    // =====================
    // VERSION HISTORY TESTS
    // =====================

    def "GET /business-domains/{key}/versions should return version history"() {
        given: "a domain with updates"
        String adminToken = createAdminToken()
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-domains", new CreateBusinessDomainRequest([new LocalizedText("en", "Original")]))
                        .bearerAuth(adminToken),
                BusinessDomainResponse
        )
        def domainKey = createResponse.body().key

        // Update name to create a second version
        def updateResponse = client.toBlocking().exchange(
                HttpRequest.PUT("/business-domains/${domainKey}/names",
                        [new LocalizedText("en", "Updated")])
                        .bearerAuth(adminToken),
                BusinessDomainResponse
        )
        def updatedKey = updateResponse.body().key

        when: "getting version history"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/business-domains/${updatedKey}/versions")
                        .bearerAuth(adminToken),
                Argument.listOf(Map)
        )

        then: "version history contains both versions"
        response.status == HttpStatus.OK
        def versions = response.body()
        versions.size() == 2
        versions.any { it.versionNumber == 1 && it.changeType == "CREATE" }
        versions.any { it.versionNumber == 2 && it.changeType == "UPDATE" }
    }

    def "GET /business-domains/{key}/versions/{v}/diff should return diff"() {
        given: "a domain with multiple versions"
        String adminToken = createAdminToken()
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-domains", new CreateBusinessDomainRequest([new LocalizedText("en", "Original")]))
                        .bearerAuth(adminToken),
                BusinessDomainResponse
        )
        def domainKey = createResponse.body().key

        def updateResponse = client.toBlocking().exchange(
                HttpRequest.PUT("/business-domains/${domainKey}/names",
                        [new LocalizedText("en", "Updated")])
                        .bearerAuth(adminToken),
                BusinessDomainResponse
        )
        def updatedKey = updateResponse.body().key

        when: "getting diff for version 2"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/business-domains/${updatedKey}/versions/2/diff")
                        .bearerAuth(adminToken),
                Map
        )

        then: "diff shows changes"
        response.status == HttpStatus.OK
        def diff = response.body()
        diff.versionNumber == 2
        diff.previousVersionNumber == 1
        diff.changes != null
        diff.changes.size() > 0
    }
}
