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

    def "PUT /administration/field-configurations should persist visibility, section, and maturityLevel"() {
        given: "an admin token"
        String token = createAdminToken()

        and: "a configuration with explicit new fields"
        def configs = [
                [entityType: "BUSINESS_ENTITY", fieldName: "retentionPeriod",
                 visibility: "SHOWN", section: "DATA_GOVERNANCE", maturityLevel: "BASIC"],
                [entityType: "BUSINESS_ENTITY", fieldName: "qualityRules",
                 visibility: "HIDDEN", section: "DATA_QUALITY", maturityLevel: "ADVANCED"]
        ]

        when: "replacing configurations"
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/administration/field-configurations", configs).bearerAuth(token),
                Argument.listOf(Map)
        )

        then: "new fields are persisted"
        response.status == HttpStatus.OK
        def retention = response.body().find { it.fieldName == "retentionPeriod" }
        retention.visibility == "SHOWN"
        retention.section == "DATA_GOVERNANCE"
        retention.maturityLevel == "BASIC"

        def quality = response.body().find { it.fieldName == "qualityRules" }
        quality.visibility == "HIDDEN"
        quality.section == "DATA_QUALITY"
        quality.maturityLevel == "ADVANCED"
    }

    def "PUT /administration/field-configurations: omitted optional fields default to SHOWN/CORE/BASIC"() {
        given: "an admin token"
        String token = createAdminToken()

        when: "replacing with a config that omits the new optional fields"
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/administration/field-configurations",
                        [[entityType: "BUSINESS_ENTITY", fieldName: "retentionPeriod"]]
                ).bearerAuth(token),
                Argument.listOf(Map)
        )

        then: "defaults are applied"
        def entry = response.body()[0]
        entry.visibility == "SHOWN"
        entry.section == "CORE"
        entry.maturityLevel == "BASIC"
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
    // FIELD CONFIGURATION DEFINITIONS
    // =====================

    def "GET /administration/field-configurations/definitions returns definitions for all entity types"() {
        given: "an admin token"
        String token = createAdminToken()

        when: "getting definitions"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/administration/field-configurations/definitions").bearerAuth(token),
                Argument.listOf(Map)
        )

        then: "response is OK with definitions for all four entity types"
        response.status == HttpStatus.OK
        def defs = response.body()
        defs.size() > 0
        defs.any { it.entityType == "BUSINESS_ENTITY" }
        defs.any { it.entityType == "BUSINESS_DOMAIN" }
        defs.any { it.entityType == "BUSINESS_PROCESS" }
        defs.any { it.entityType == "ORGANISATIONAL_UNIT" }
    }

    def "GET /administration/field-configurations/definitions: each definition has required fields"() {
        given: "an admin token"
        String token = createAdminToken()

        when: "getting definitions"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/administration/field-configurations/definitions").bearerAuth(token),
                Argument.listOf(Map)
        )

        then: "every definition has entityType, fieldName, label, section, maturityLevel, mandatoryCapable"
        response.body().every { d ->
            d.entityType && d.fieldName && d.label && d.section && d.maturityLevel && d.mandatoryCapable != null
        }
    }

    def "GET /administration/field-configurations/definitions: locale-specific fields are expanded"() {
        given: "an admin token (English locale seeded in setup)"
        String token = createAdminToken()

        when: "getting definitions"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/administration/field-configurations/definitions").bearerAuth(token),
                Argument.listOf(Map)
        )

        then: "names.en is present (expanded from names.{locale}) for BUSINESS_ENTITY"
        def defs = response.body()
        defs.any { it.entityType == "BUSINESS_ENTITY" && it.fieldName == "names.en" }

        and: "the template placeholder names.{locale} is NOT present"
        !defs.any { it.fieldName?.contains("{locale}") }
    }

    def "GET /administration/field-configurations/definitions: locale fields include a group entry with localeGroup=true"() {
        given: "an admin token"
        String token = createAdminToken()

        when: "getting definitions"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/administration/field-configurations/definitions").bearerAuth(token),
                Argument.listOf(Map)
        )

        then: "a group entry 'names' exists for BUSINESS_ENTITY with localeGroup=true and mandatoryCapable=false"
        def defs = response.body()
        def namesGroup = defs.find { it.entityType == "BUSINESS_ENTITY" && it.fieldName == "names" }
        namesGroup != null
        namesGroup.localeGroup == true
        namesGroup.mandatoryCapable == false

        and: "per-locale entry names.en has localeGroup=false and mandatoryCapable=true"
        def namesEn = defs.find { it.entityType == "BUSINESS_ENTITY" && it.fieldName == "names.en" }
        namesEn != null
        namesEn.localeGroup == false
        namesEn.mandatoryCapable == true
    }

    def "hiding locale group (names) hides all locale name fields in entity response"() {
        given: "admin sets 'names' locale group to HIDDEN"
        String token = createAdminToken()

        client.toBlocking().exchange(
                HttpRequest.PUT("/administration/field-configurations",
                        [[entityType: "BUSINESS_ENTITY", fieldName: "names",
                          visibility: "HIDDEN", section: "CORE", maturityLevel: "BASIC"]]
                ).bearerAuth(token),
                Argument.listOf(Map)
        )

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

        then: "hiddenFields contains names.en (expanded from the 'names' group entry)"
        def hidden = response.body().hiddenFields
        hidden != null
        hidden.contains("names.en")

        and: "'names' group entry itself is not in hiddenFields (expanded to per-locale)"
        !hidden.contains("names")

        and: "names group is NOT in mandatoryFields"
        !response.body().mandatoryFields?.contains("names")
    }

    def "locale group HIDDEN with per-locale mandatory in payload — backend drops the mandatory entry"() {
        given: "an admin token"
        String token = createAdminToken()

        when: "admin sends both 'names' group HIDDEN and 'names.en' mandatory"
        def putResponse = client.toBlocking().exchange(
                HttpRequest.PUT("/administration/field-configurations",
                        [
                                [entityType: "BUSINESS_ENTITY", fieldName: "names",
                                 visibility: "HIDDEN", section: "CORE", maturityLevel: "BASIC"],
                                [entityType: "BUSINESS_ENTITY", fieldName: "names.en",
                                 visibility: "SHOWN", section: "CORE", maturityLevel: "BASIC"]
                        ]
                ).bearerAuth(token),
                Argument.listOf(Map)
        )

        then: "only the group HIDDEN entry is persisted; per-locale entry is dropped"
        def saved = putResponse.body()
        saved.size() == 1
        saved[0].fieldName == "names"
        saved[0].visibility == "HIDDEN"
    }

    def "GET /administration/field-configurations/definitions: non-mandatory-capable fields have mandatoryCapable=false"() {
        given: "an admin token"
        String token = createAdminToken()

        when: "getting definitions"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/administration/field-configurations/definitions").bearerAuth(token),
                Argument.listOf(Map)
        )

        then: "parent field for BUSINESS_ENTITY has mandatoryCapable=false"
        def parentDef = response.body().find { it.entityType == "BUSINESS_ENTITY" && it.fieldName == "parent" }
        parentDef != null
        parentDef.mandatoryCapable == false

        and: "retentionPeriod has mandatoryCapable=true"
        def retentionDef = response.body().find { it.entityType == "BUSINESS_ENTITY" && it.fieldName == "retentionPeriod" }
        retentionDef != null
        retentionDef.mandatoryCapable == true
    }

    def "GET /administration/field-configurations/definitions returns 403 for non-admin"() {
        given: "a non-admin token"
        String token = createUserToken()

        when: "getting definitions"
        client.toBlocking().exchange(
                HttpRequest.GET("/administration/field-configurations/definitions").bearerAuth(token),
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

    // =====================
    // HIDDEN FIELDS
    // =====================

    def "BusinessEntity response should include hiddenFields when fields are configured as HIDDEN"() {
        given: "admin configures retentionPeriod as HIDDEN and qualityRules as HIDDEN"
        String token = createAdminToken()

        client.toBlocking().exchange(
                HttpRequest.PUT("/administration/field-configurations",
                        [
                                [entityType: "BUSINESS_ENTITY", fieldName: "retentionPeriod",
                                 visibility: "HIDDEN", section: "DATA_GOVERNANCE", maturityLevel: "BASIC"],
                                [entityType: "BUSINESS_ENTITY", fieldName: "qualityRules",
                                 visibility: "HIDDEN", section: "DATA_QUALITY", maturityLevel: "ADVANCED"]
                        ]
                ).bearerAuth(token),
                Argument.listOf(Map)
        )

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

        then: "hiddenFields contains both hidden field names"
        def hidden = response.body().hiddenFields
        hidden != null
        hidden.contains("retentionPeriod")
        hidden.contains("qualityRules")
    }

    def "BusinessEntity response should have null hiddenFields when no fields are configured as HIDDEN"() {
        given: "admin configures a SHOWN field only"
        String token = createAdminToken()

        client.toBlocking().exchange(
                HttpRequest.PUT("/administration/field-configurations",
                        [[entityType: "BUSINESS_ENTITY", fieldName: "retentionPeriod",
                          visibility: "SHOWN", section: "DATA_GOVERNANCE", maturityLevel: "BASIC"]]
                ).bearerAuth(token),
                Argument.listOf(Map)
        )

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

        then: "hiddenFields is null (no hidden fields configured)"
        response.body().hiddenFields == null
    }

    def "BusinessEntity response should have null hiddenFields when no configurations exist"() {
        given: "no field configurations"
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

        then: "hiddenFields is null"
        response.body().hiddenFields == null
    }

    def "HIDDEN field must NOT appear in mandatoryFields (visibility enforcement)"() {
        given: "admin configures qualityRules as HIDDEN and boundedContext as SHOWN (mandatory)"
        String token = createAdminToken()

        client.toBlocking().exchange(
                HttpRequest.PUT("/administration/field-configurations",
                        [
                                [entityType: "BUSINESS_ENTITY", fieldName: "qualityRules",
                                 visibility: "HIDDEN", section: "DATA_QUALITY", maturityLevel: "ADVANCED"],
                                [entityType: "BUSINESS_ENTITY", fieldName: "boundedContext",
                                 visibility: "SHOWN", section: "DDD", maturityLevel: "ADVANCED"]
                        ]
                ).bearerAuth(token),
                Argument.listOf(Map)
        )

        and: "a created entity (no boundedContext set)"
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

        then: "qualityRules is in hiddenFields"
        response.body().hiddenFields?.contains("qualityRules")

        and: "qualityRules is NOT in mandatoryFields (hidden fields are excluded)"
        !response.body().mandatoryFields?.contains("qualityRules")

        and: "qualityRules is NOT in missingMandatoryFields"
        !response.body().missingMandatoryFields?.contains("qualityRules")

        and: "boundedContext IS in mandatoryFields (SHOWN field is mandatory)"
        response.body().mandatoryFields?.contains("boundedContext")

        and: "boundedContext IS in missingMandatoryFields (no bounded context set)"
        response.body().missingMandatoryFields?.contains("boundedContext")
    }

    def "hiddenFields only contains fields for the matching entityType"() {
        given: "admin hides retentionPeriod for BUSINESS_ENTITY and type for BUSINESS_DOMAIN"
        String token = createAdminToken()

        client.toBlocking().exchange(
                HttpRequest.PUT("/administration/field-configurations",
                        [
                                [entityType: "BUSINESS_ENTITY", fieldName: "retentionPeriod",
                                 visibility: "HIDDEN", section: "DATA_GOVERNANCE", maturityLevel: "BASIC"],
                                [entityType: "BUSINESS_DOMAIN", fieldName: "type",
                                 visibility: "HIDDEN", section: "CORE", maturityLevel: "BASIC"]
                        ]
                ).bearerAuth(token),
                Argument.listOf(Map)
        )

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

        then: "hiddenFields contains only BUSINESS_ENTITY hidden fields"
        def hidden = response.body().hiddenFields
        hidden != null
        hidden.contains("retentionPeriod")
        !hidden.contains("type")
    }
}
