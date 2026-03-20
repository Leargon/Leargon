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
import org.leargon.backend.model.BusinessEntityResponse
import org.leargon.backend.model.CreateBusinessEntityRequest
import org.leargon.backend.model.FieldConfigurationEntry
import org.leargon.backend.model.LocalizedText
import org.leargon.backend.model.LoginRequest
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.BusinessEntityVersionRepository
import org.leargon.backend.repository.FieldConfigurationRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

@MicronautTest(transactional = false)
class FieldConfigurationControllerSpec extends Specification {

    @Inject
    @Client("/")
    HttpClient client

    @Inject
    UserRepository userRepository

    @Inject
    FieldConfigurationRepository fieldConfigurationRepository

    @Inject
    BusinessEntityRepository businessEntityRepository

    @Inject
    BusinessEntityVersionRepository businessEntityVersionRepository

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
        fieldConfigurationRepository.deleteAll()
        businessEntityVersionRepository.deleteAll()
        businessEntityRepository.findAll().each { businessEntityRepository.delete(it) }
        userRepository.deleteAll()
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

    private String createUserToken() {
        def signupRequest = new SignupRequest("user@example.com", "testuser", "password123", "Test", "User")
        def signupResponse = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/signup", signupRequest),
                Map
        )
        return signupResponse.body().accessToken
    }

    // =====================
    // FIELD CONFIGURATION CRUD TESTS
    // =====================

    def "GET /administration/field-configurations should return empty list initially"() {
        given: "an admin token"
        String token = createAdminToken()

        when: "getting field configurations"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/administration/field-configurations").bearerAuth(token),
                Argument.listOf(Map)
        )

        then: "empty list returned"
        response.status == HttpStatus.OK
        response.body().size() == 0
    }

    def "PUT /administration/field-configurations should replace all configurations"() {
        given: "an admin token"
        String token = createAdminToken()

        and: "initial configurations"
        def configs = [
                [entityType: "BUSINESS_ENTITY", fieldName: "retentionPeriod"],
                [entityType: "BUSINESS_ENTITY", fieldName: "boundedContext"],
                [entityType: "BUSINESS_DOMAIN", fieldName: "type"]
        ]

        when: "replacing configurations"
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/administration/field-configurations", configs).bearerAuth(token),
                Argument.listOf(Map)
        )

        then: "configurations are saved"
        response.status == HttpStatus.OK
        response.body().size() == 3

        and: "all entries are present"
        response.body().any { it.entityType == "BUSINESS_ENTITY" && it.fieldName == "retentionPeriod" }
        response.body().any { it.entityType == "BUSINESS_ENTITY" && it.fieldName == "boundedContext" }
        response.body().any { it.entityType == "BUSINESS_DOMAIN" && it.fieldName == "type" }
    }

    def "PUT /administration/field-configurations should replace (not append) existing configurations"() {
        given: "an admin token with initial configurations"
        String token = createAdminToken()

        client.toBlocking().exchange(
                HttpRequest.PUT("/administration/field-configurations",
                        [[entityType: "BUSINESS_ENTITY", fieldName: "retentionPeriod"]]
                ).bearerAuth(token),
                Argument.listOf(Map)
        )

        when: "replacing with a different set"
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/administration/field-configurations",
                        [[entityType: "BUSINESS_DOMAIN", fieldName: "type"]]
                ).bearerAuth(token),
                Argument.listOf(Map)
        )

        then: "only the new configuration exists"
        response.body().size() == 1
        response.body()[0].entityType == "BUSINESS_DOMAIN"
        response.body()[0].fieldName == "type"
    }

    def "PUT /administration/field-configurations should return 403 for non-admin"() {
        given: "a non-admin token"
        String token = createUserToken()

        when: "attempting to replace configurations"
        client.toBlocking().exchange(
                HttpRequest.PUT("/administration/field-configurations",
                        [[entityType: "BUSINESS_ENTITY", fieldName: "retentionPeriod"]]
                ).bearerAuth(token),
                Argument.listOf(Map)
        )

        then: "403 forbidden"
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }

    def "GET /administration/field-configurations should return 403 for non-admin"() {
        given: "a non-admin token"
        String token = createUserToken()

        when: "attempting to get configurations"
        client.toBlocking().exchange(
                HttpRequest.GET("/administration/field-configurations").bearerAuth(token),
                Argument.listOf(Map)
        )

        then: "403 forbidden"
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }

    // =====================
    // MISSING MANDATORY FIELDS INTEGRATION
    // =====================

    def "BusinessEntity response should include missingMandatoryFields when fields are configured"() {
        given: "admin configures retentionPeriod and boundedContext as mandatory for BUSINESS_ENTITY"
        String token = createAdminToken()

        client.toBlocking().exchange(
                HttpRequest.PUT("/administration/field-configurations",
                        [
                                [entityType: "BUSINESS_ENTITY", fieldName: "retentionPeriod"],
                                [entityType: "BUSINESS_ENTITY", fieldName: "boundedContext"]
                        ]
                ).bearerAuth(token),
                Argument.listOf(Map)
        )

        and: "an entity without retentionPeriod or boundedContext"
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities",
                        new CreateBusinessEntityRequest([new LocalizedText("en", "Customer")])
                ).bearerAuth(token),
                BusinessEntityResponse
        )
        def entityKey = createResponse.body().key

        when: "getting the entity"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/business-entities/${entityKey}").bearerAuth(token),
                BusinessEntityResponse
        )

        then: "missingMandatoryFields contains both missing fields"
        def missing = response.body().missingMandatoryFields
        missing != null
        missing.contains("retentionPeriod")
        missing.contains("boundedContext")
    }

    def "BusinessEntity response should have null missingMandatoryFields when no fields are configured"() {
        given: "no field configurations are set"
        String token = createAdminToken()

        and: "a created entity"
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities",
                        new CreateBusinessEntityRequest([new LocalizedText("en", "Customer")])
                ).bearerAuth(token),
                BusinessEntityResponse
        )
        def entityKey = createResponse.body().key

        when: "getting the entity"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/business-entities/${entityKey}").bearerAuth(token),
                BusinessEntityResponse
        )

        then: "missingMandatoryFields is null (no mandatory fields configured)"
        response.body().missingMandatoryFields == null
    }

    def "BusinessEntity response should have empty/null missingMandatoryFields when all mandatory fields are present"() {
        given: "retentionPeriod configured as mandatory"
        String token = createAdminToken()

        client.toBlocking().exchange(
                HttpRequest.PUT("/administration/field-configurations",
                        [[entityType: "BUSINESS_ENTITY", fieldName: "retentionPeriod"]]
                ).bearerAuth(token),
                Argument.listOf(Map)
        )

        and: "an entity with retentionPeriod set"
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities",
                        new CreateBusinessEntityRequest([new LocalizedText("en", "Customer")])
                                .retentionPeriod("7 years")
                ).bearerAuth(token),
                BusinessEntityResponse
        )
        def entityKey = createResponse.body().key

        when: "getting the entity"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/business-entities/${entityKey}").bearerAuth(token),
                BusinessEntityResponse
        )

        then: "missingMandatoryFields is null (all mandatory fields present)"
        response.body().missingMandatoryFields == null
    }

    // =====================
    // MANDATORY FIELDS PROPERTY
    // =====================

    def "BusinessEntity response should include mandatoryFields list when fields are configured"() {
        given: "admin configures two mandatory fields"
        String token = createAdminToken()

        client.toBlocking().exchange(
                HttpRequest.PUT("/administration/field-configurations",
                        [
                                [entityType: "BUSINESS_ENTITY", fieldName: "retentionPeriod"],
                                [entityType: "BUSINESS_ENTITY", fieldName: "boundedContext"]
                        ]
                ).bearerAuth(token),
                Argument.listOf(Map)
        )

        and: "an entity"
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities",
                        new CreateBusinessEntityRequest([new LocalizedText("en", "Customer")])
                ).bearerAuth(token),
                BusinessEntityResponse
        )
        def entityKey = createResponse.body().key

        when: "getting the entity"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/business-entities/${entityKey}").bearerAuth(token),
                BusinessEntityResponse
        )

        then: "mandatoryFields contains both configured field names"
        def mandatory = response.body().mandatoryFields
        mandatory != null
        mandatory.contains("retentionPeriod")
        mandatory.contains("boundedContext")
    }

    def "BusinessEntity response should have null mandatoryFields when no fields are configured"() {
        given: "no field configurations"
        String token = createAdminToken()

        and: "an entity"
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities",
                        new CreateBusinessEntityRequest([new LocalizedText("en", "Customer")])
                ).bearerAuth(token),
                BusinessEntityResponse
        )
        def entityKey = createResponse.body().key

        when: "getting the entity"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/business-entities/${entityKey}").bearerAuth(token),
                BusinessEntityResponse
        )

        then: "mandatoryFields is null (no configuration)"
        response.body().mandatoryFields == null
    }

    def "BusinessEntity correctly detects locale-specific name field as present"() {
        given: "names.en configured as mandatory"
        String token = createAdminToken()

        client.toBlocking().exchange(
                HttpRequest.PUT("/administration/field-configurations",
                        [[entityType: "BUSINESS_ENTITY", fieldName: "names.en"]]
                ).bearerAuth(token),
                Argument.listOf(Map)
        )

        and: "an entity with an English name"
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities",
                        new CreateBusinessEntityRequest([new LocalizedText("en", "Customer")])
                ).bearerAuth(token),
                BusinessEntityResponse
        )
        def entityKey = createResponse.body().key

        when: "getting the entity"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/business-entities/${entityKey}").bearerAuth(token),
                BusinessEntityResponse
        )

        then: "missingMandatoryFields is null (English name is present)"
        response.body().missingMandatoryFields == null

        and: "mandatoryFields contains names.en"
        response.body().mandatoryFields?.contains("names.en")
    }

    def "BusinessEntity correctly detects locale-specific name field as missing"() {
        given: "names.de configured as mandatory"
        String token = createAdminToken()

        client.toBlocking().exchange(
                HttpRequest.PUT("/administration/field-configurations",
                        [[entityType: "BUSINESS_ENTITY", fieldName: "names.de"]]
                ).bearerAuth(token),
                Argument.listOf(Map)
        )

        and: "an entity with only an English name (no German)"
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities",
                        new CreateBusinessEntityRequest([new LocalizedText("en", "Customer")])
                ).bearerAuth(token),
                BusinessEntityResponse
        )
        def entityKey = createResponse.body().key

        when: "getting the entity"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/business-entities/${entityKey}").bearerAuth(token),
                BusinessEntityResponse
        )

        then: "missingMandatoryFields contains names.de"
        def missing = response.body().missingMandatoryFields
        missing != null
        missing.contains("names.de")
    }
}
