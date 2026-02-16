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
import org.leargon.backend.model.CreateSupportedLocaleRequest
import org.leargon.backend.model.LocalizedText
import org.leargon.backend.model.LoginRequest
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.model.SupportedLocaleResponse
import org.leargon.backend.model.UpdateSupportedLocaleRequest
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.BusinessEntityVersionRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

@MicronautTest(transactional = false)
class LocaleControllerSpec extends Specification {

    @Inject
    @Client("/")
    HttpClient client

    @Inject
    UserRepository userRepository

    @Inject
    SupportedLocaleRepository localeRepository

    @Inject
    BusinessEntityRepository entityRepository

    @Inject
    BusinessEntityVersionRepository entityVersionRepository

    def setup() {
        entityVersionRepository.deleteAll()
        entityRepository.findAll().each { entityRepository.delete(it) }
        userRepository.deleteAll()
        // Clean up non-default locales added by tests
        localeRepository.findAll().each {
            if (it.localeCode != "en" && it.localeCode != "de") {
                localeRepository.deleteById(it.id)
            }
        }
        // Ensure base locale data exists
        if (!localeRepository.existsByLocaleCode("en")) {
            def enLocale = new SupportedLocale()
            enLocale.localeCode = "en"
            enLocale.displayName = "English"
            enLocale.isDefault = true
            enLocale.isActive = true
            enLocale.sortOrder = 1
            localeRepository.save(enLocale)
        }
        if (!localeRepository.existsByLocaleCode("de")) {
            def deLocale = new SupportedLocale()
            deLocale.localeCode = "de"
            deLocale.displayName = "German"
            deLocale.isDefault = false
            deLocale.isActive = true
            deLocale.sortOrder = 2
            localeRepository.save(deLocale)
        } else {
            // Reset de locale state (may have been modified by prior tests)
            def deLocale = localeRepository.findByLocaleCode("de").get()
            deLocale.displayName = "German"
            deLocale.isActive = true
            deLocale.sortOrder = 2
            localeRepository.update(deLocale)
        }
    }

    def cleanup() {
        entityVersionRepository.deleteAll()
        entityRepository.findAll().each { entityRepository.delete(it) }
        userRepository.deleteAll()
    }

    private String createUserToken() {
        def signupRequest = new SignupRequest("user@example.com", "testuser", "password123",
                "Test", "User")
        def signupResponse = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/signup", signupRequest),
                Map
        )
        return signupResponse.body().accessToken
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

    // ===== GET /locales =====

    def "GET /locales should return supported locales with authentication"() {
        given: "an authenticated user"
        String token = createUserToken()

        when: "getting supported locales"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/locales")
                        .bearerAuth(token),
                Argument.listOf(SupportedLocaleResponse)
        )

        then: "response is successful"
        response.status == HttpStatus.OK

        and: "at least en and de locales are returned"
        def locales = response.body()
        locales.size() >= 2
        locales.any { it.localeCode == "en" }
        locales.any { it.localeCode == "de" }
    }

    def "GET /locales should return locale details"() {
        given: "an authenticated user"
        String token = createUserToken()

        when: "getting supported locales"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/locales")
                        .bearerAuth(token),
                Argument.listOf(SupportedLocaleResponse)
        )

        then: "locales have expected fields"
        def locales = response.body()
        def enLocale = locales.find { it.localeCode == "en" }
        enLocale != null
        enLocale.displayName == "English"
        enLocale.isDefault == true
        enLocale.isActive == true
    }

    def "GET /locales should return locales ordered by sortOrder"() {
        given: "an authenticated user"
        String token = createUserToken()

        when: "getting supported locales"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/locales")
                        .bearerAuth(token),
                Argument.listOf(SupportedLocaleResponse)
        )

        then: "locales are ordered by sortOrder"
        def locales = response.body()
        def sortOrders = locales.collect { it.sortOrder }
        sortOrders == sortOrders.sort()
    }

    def "GET /locales should return 401 without authentication"() {
        when: "getting locales without token"
        client.toBlocking().exchange(
                HttpRequest.GET("/locales"),
                List
        )

        then: "unauthorized exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.UNAUTHORIZED
    }

    // ===== POST /locales =====

    def "POST /locales should create a new locale"() {
        given: "an admin token"
        String adminToken = createAdminToken()

        and: "a create request"
        def request = new CreateSupportedLocaleRequest("fr", "French")
        request.isActive = true
        request.sortOrder = 3

        when: "creating locale"
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/locales", request)
                        .bearerAuth(adminToken),
                SupportedLocaleResponse
        )

        then: "response is 201 created"
        response.status == HttpStatus.CREATED

        and: "locale has correct fields"
        def locale = response.body()
        locale.localeCode == "fr"
        locale.displayName == "French"
        locale.isActive == true
        locale.sortOrder == 3
        locale.isDefault == false
        locale.id != null
    }

    def "POST /locales should reject duplicate locale code"() {
        given: "an admin token"
        String adminToken = createAdminToken()

        and: "a request with existing locale code"
        def request = new CreateSupportedLocaleRequest("en", "English Duplicate")

        when: "creating duplicate locale"
        client.toBlocking().exchange(
                HttpRequest.POST("/locales", request)
                        .bearerAuth(adminToken),
                SupportedLocaleResponse
        )

        then: "bad request exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.BAD_REQUEST
    }

    def "POST /locales should return 403 for non-admin"() {
        given: "a regular user token"
        String token = createUserToken()

        and: "a create request"
        def request = new CreateSupportedLocaleRequest("fr", "French")

        when: "creating locale as non-admin"
        client.toBlocking().exchange(
                HttpRequest.POST("/locales", request)
                        .bearerAuth(token),
                SupportedLocaleResponse
        )

        then: "forbidden exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.FORBIDDEN
    }

    // ===== PUT /locales/{id} =====

    def "PUT /locales/{id} should update locale display name"() {
        given: "an admin token"
        String adminToken = createAdminToken()

        and: "an existing locale"
        def deLocale = localeRepository.findByLocaleCode("de").get()

        and: "an update request"
        def request = new UpdateSupportedLocaleRequest()
        request.displayName = "Deutsch"

        when: "updating locale"
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/locales/${deLocale.id}", request)
                        .bearerAuth(adminToken),
                SupportedLocaleResponse
        )

        then: "response is successful"
        response.status == HttpStatus.OK

        and: "display name is updated"
        response.body().displayName == "Deutsch"
        response.body().localeCode == "de"
    }

    def "PUT /locales/{id} should update isActive and sortOrder"() {
        given: "an admin token"
        String adminToken = createAdminToken()

        and: "a non-default locale"
        def deLocale = localeRepository.findByLocaleCode("de").get()

        and: "an update request"
        def request = new UpdateSupportedLocaleRequest()
        request.isActive = false
        request.sortOrder = 99

        when: "updating locale"
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/locales/${deLocale.id}", request)
                        .bearerAuth(adminToken),
                SupportedLocaleResponse
        )

        then: "response is successful"
        response.status == HttpStatus.OK
        response.body().isActive == false
        response.body().sortOrder == 99
    }

    def "PUT /locales/{id} should not allow deactivating the default locale"() {
        given: "an admin token"
        String adminToken = createAdminToken()

        and: "the default locale"
        def enLocale = localeRepository.findByLocaleCode("en").get()

        and: "an update request to deactivate"
        def request = new UpdateSupportedLocaleRequest()
        request.isActive = false

        when: "deactivating default locale"
        client.toBlocking().exchange(
                HttpRequest.PUT("/locales/${enLocale.id}", request)
                        .bearerAuth(adminToken),
                SupportedLocaleResponse
        )

        then: "bad request exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.BAD_REQUEST
    }

    def "PUT /locales/{id} should return 404 for non-existent locale"() {
        given: "an admin token"
        String adminToken = createAdminToken()

        and: "an update request"
        def request = new UpdateSupportedLocaleRequest()
        request.displayName = "Updated"

        when: "updating non-existent locale"
        client.toBlocking().exchange(
                HttpRequest.PUT("/locales/999999", request)
                        .bearerAuth(adminToken),
                SupportedLocaleResponse
        )

        then: "not found exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.NOT_FOUND
    }

    // ===== DELETE /locales/{id} =====

    def "DELETE /locales/{id} should delete an unused locale"() {
        given: "an admin token"
        String adminToken = createAdminToken()

        and: "a new locale to delete"
        def createRequest = new CreateSupportedLocaleRequest("fr", "French")
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/locales", createRequest)
                        .bearerAuth(adminToken),
                SupportedLocaleResponse
        )
        def localeId = createResponse.body().id

        when: "deleting locale"
        def response = client.toBlocking().exchange(
                HttpRequest.DELETE("/locales/${localeId}")
                        .bearerAuth(adminToken)
        )

        then: "response is 204 no content"
        response.status == HttpStatus.NO_CONTENT

        and: "locale no longer exists"
        !localeRepository.findById(localeId).isPresent()
    }

    def "DELETE /locales/{id} should not allow deleting the default locale"() {
        given: "an admin token"
        String adminToken = createAdminToken()

        and: "the default locale"
        def enLocale = localeRepository.findByLocaleCode("en").get()

        when: "deleting default locale"
        client.toBlocking().exchange(
                HttpRequest.DELETE("/locales/${enLocale.id}")
                        .bearerAuth(adminToken)
        )

        then: "bad request exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.BAD_REQUEST
    }

    def "DELETE /locales/{id} should not allow deleting a locale in use by translations"() {
        given: "an admin token"
        String adminToken = createAdminToken()

        and: "an entity using the 'de' locale"
        def entityRequest = new CreateBusinessEntityRequest([
                new LocalizedText("en", "Customer"),
                new LocalizedText("de", "Kunde")
        ])
        client.toBlocking().exchange(
                HttpRequest.POST("/business-entities", entityRequest)
                        .bearerAuth(adminToken),
                Map
        )

        and: "the 'de' locale"
        def deLocale = localeRepository.findByLocaleCode("de").get()

        when: "deleting locale in use"
        client.toBlocking().exchange(
                HttpRequest.DELETE("/locales/${deLocale.id}")
                        .bearerAuth(adminToken)
        )

        then: "bad request exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.BAD_REQUEST
    }

    def "DELETE /locales/{id} should return 404 for non-existent locale"() {
        given: "an admin token"
        String adminToken = createAdminToken()

        when: "deleting non-existent locale"
        client.toBlocking().exchange(
                HttpRequest.DELETE("/locales/999999")
                        .bearerAuth(adminToken)
        )

        then: "not found exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.NOT_FOUND
    }

    def "DELETE /locales/{id} should return 403 for non-admin"() {
        given: "a regular user token"
        String token = createUserToken()

        and: "a locale"
        def deLocale = localeRepository.findByLocaleCode("de").get()

        when: "deleting as non-admin"
        client.toBlocking().exchange(
                HttpRequest.DELETE("/locales/${deLocale.id}")
                        .bearerAuth(token)
        )

        then: "forbidden exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.FORBIDDEN
    }
}
