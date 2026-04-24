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
import org.leargon.backend.repository.FieldConfigurationRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

@MicronautTest(transactional = false)
class MethodologyConfigurationControllerSpec extends Specification {

    @Inject
    @Client("/")
    HttpClient client

    @Inject
    UserRepository userRepository

    @Inject
    FieldConfigurationRepository fieldConfigurationRepository

    @Inject
    SupportedLocaleRepository localeRepository

    def setup() {
        if (localeRepository.count() == 0) {
            def enLocale = new SupportedLocale()
            enLocale.localeCode = "en"
            enLocale.displayName = "English"
            enLocale.isDefault = true
            enLocale.isActive = true
            enLocale.sortOrder = 1
            localeRepository.save(enLocale)
        }
    }

    def cleanup() {
        fieldConfigurationRepository.deleteByEntityType("METHODOLOGY")
        userRepository.deleteAll()
    }

    private String createAdminToken() {
        def signupRequest = new SignupRequest("admin@example.com", "admin", "password123", "Admin", "User")
        client.toBlocking().exchange(HttpRequest.POST("/authentication/signup", signupRequest))
        def user = userRepository.findByEmail("admin@example.com").get()
        user.roles = "ROLE_USER,ROLE_ADMIN"
        userRepository.update(user)
        def loginResponse = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/login", new LoginRequest("admin@example.com", "password123")),
                Map
        )
        return loginResponse.body().accessToken
    }

    private String createUserToken() {
        def signupRequest = new SignupRequest("user@example.com", "regularuser", "password123", "Regular", "User")
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/signup", signupRequest), Map)
        return response.body().accessToken
    }

    // =====================
    // GET TESTS
    // =====================

    def "GET /administration/methodology-configurations returns all 6 methodologies enabled by default"() {
        given:
        def token = createAdminToken()

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/administration/methodology-configurations").bearerAuth(token),
                Argument.listOf(Map)
        )

        then:
        response.status() == HttpStatus.OK
        def body = response.body()
        body.size() == 6
        body.every { it.enabled == true }
        body*.key.containsAll(["DATA_GOVERNANCE", "PROCESS_GOVERNANCE", "GDPR", "DDD", "BCM", "TEAM_TOPOLOGIES"])
    }

    def "GET /administration/methodology-configurations returns 200 for non-admin"() {
        given:
        def token = createUserToken()

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/administration/methodology-configurations").bearerAuth(token),
                Argument.listOf(Map)
        )

        then:
        response.status() == HttpStatus.OK
        response.body().size() == 6
    }

    def "GET /administration/methodology-configurations returns 401 without auth"() {
        when:
        client.toBlocking().exchange(
                HttpRequest.GET("/administration/methodology-configurations"),
                Argument.listOf(Map)
        )

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.UNAUTHORIZED
    }

    // =====================
    // PUT TESTS
    // =====================

    def "PUT /administration/methodology-configurations disables GDPR and reflects in GET"() {
        given:
        def token = createAdminToken()
        def entries = [
                [key: "DATA_GOVERNANCE", enabled: true],
                [key: "PROCESS_GOVERNANCE", enabled: true],
                [key: "GDPR", enabled: false],
                [key: "DDD", enabled: true],
                [key: "BCM", enabled: true],
                
                [key: "TEAM_TOPOLOGIES", enabled: true],
        ]

        when:
        def putResponse = client.toBlocking().exchange(
                HttpRequest.PUT("/administration/methodology-configurations", entries).bearerAuth(token),
                Argument.listOf(Map)
        )

        then:
        putResponse.status() == HttpStatus.OK
        def gdpr = putResponse.body().find { it.key == "GDPR" }
        gdpr.enabled == false
        putResponse.body().findAll { it.key != "GDPR" }.every { it.enabled == true }

        when: "GET reflects the saved state"
        def getResponse = client.toBlocking().exchange(
                HttpRequest.GET("/administration/methodology-configurations").bearerAuth(token),
                Argument.listOf(Map)
        )

        then:
        getResponse.body().find { it.key == "GDPR" }.enabled == false
        getResponse.body().findAll { it.key != "GDPR" }.every { it.enabled == true }
    }

    def "PUT /administration/methodology-configurations re-enables a disabled methodology"() {
        given:
        def token = createAdminToken()
        def disableEntries = [
                [key: "DATA_GOVERNANCE", enabled: true],
                [key: "PROCESS_GOVERNANCE", enabled: true],
                [key: "GDPR", enabled: false],
                [key: "DDD", enabled: true],
                [key: "BCM", enabled: true],
                
                [key: "TEAM_TOPOLOGIES", enabled: true],
        ]
        client.toBlocking().exchange(
                HttpRequest.PUT("/administration/methodology-configurations", disableEntries).bearerAuth(token),
                Argument.listOf(Map)
        )

        when: "re-enabling GDPR"
        def enableEntries = disableEntries.collect { it.key == "GDPR" ? [key: "GDPR", enabled: true] : it }
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/administration/methodology-configurations", enableEntries).bearerAuth(token),
                Argument.listOf(Map)
        )

        then:
        response.body().every { it.enabled == true }
    }

    def "PUT /administration/methodology-configurations returns 403 for non-admin"() {
        given:
        def token = createUserToken()

        when:
        client.toBlocking().exchange(
                HttpRequest.PUT("/administration/methodology-configurations",
                        [[key: "GDPR", enabled: false]]).bearerAuth(token),
                Argument.listOf(Map)
        )

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }

    // =====================
    // FIELD CONFIG DEFINITIONS FILTERED BY METHODOLOGY
    // =====================

    def "GET /administration/field-configurations/definitions excludes DDD fields when DDD is disabled"() {
        given:
        def token = createAdminToken()
        def entries = [
                [key: "DATA_GOVERNANCE", enabled: true],
                [key: "PROCESS_GOVERNANCE", enabled: true],
                [key: "GDPR", enabled: true],
                [key: "DDD", enabled: false],
                [key: "BCM", enabled: true],
                
                [key: "TEAM_TOPOLOGIES", enabled: true],
        ]
        client.toBlocking().exchange(
                HttpRequest.PUT("/administration/methodology-configurations", entries).bearerAuth(token),
                Argument.listOf(Map)
        )

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/administration/field-configurations/definitions").bearerAuth(token),
                Argument.listOf(Map)
        )

        then:
        def definitions = response.body()
        definitions.every { it.section != "DDD" }
        definitions.every { it.section != "STRATEGIC" }
        // Business Domain descriptions/owningUnit also hidden when DDD off
        definitions.findAll { it.entityType == "BUSINESS_DOMAIN" }.every { it.fieldName != "owningUnit" }
        definitions.any { it.section == "GDPR" }
        definitions.any { it.section == "BCM" }
    }

    def "GET /administration/field-configurations/definitions excludes GDPR fields when GDPR is disabled"() {
        given:
        def token = createAdminToken()
        def entries = [
                [key: "DATA_GOVERNANCE", enabled: true],
                [key: "PROCESS_GOVERNANCE", enabled: true],
                [key: "GDPR", enabled: false],
                [key: "DDD", enabled: true],
                [key: "BCM", enabled: true],
                
                [key: "TEAM_TOPOLOGIES", enabled: true],
        ]
        client.toBlocking().exchange(
                HttpRequest.PUT("/administration/methodology-configurations", entries).bearerAuth(token),
                Argument.listOf(Map)
        )

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/administration/field-configurations/definitions").bearerAuth(token),
                Argument.listOf(Map)
        )

        then:
        def definitions = response.body()
        definitions.findAll { it.entityType == "BUSINESS_PROCESS" }.every { it.section != "GDPR" }
        definitions.any { it.section == "DDD" }
    }
}
