package org.leargon.backend.controller

import io.micronaut.core.type.Argument
import io.micronaut.http.HttpRequest
import io.micronaut.http.client.HttpClient
import io.micronaut.http.client.annotation.Client
import io.micronaut.test.extensions.spock.annotation.MicronautTest
import jakarta.inject.Inject
import org.leargon.backend.domain.SupportedLocale
import org.leargon.backend.model.ClassificationAssignableTo
import org.leargon.backend.model.CreateBusinessEntityRequest
import org.leargon.backend.model.CreateClassificationRequest
import org.leargon.backend.model.CreateClassificationValueRequest
import org.leargon.backend.model.LocalizedText
import org.leargon.backend.model.LoginRequest
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.model.UpdateBusinessEntityInterfacesRequest
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.BusinessEntityVersionRepository
import org.leargon.backend.repository.ClassificationRepository
import org.leargon.backend.repository.ClassificationValueRepository
import org.leargon.backend.repository.FieldConfigurationRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

@MicronautTest(transactional = false)
class BusinessEntityClassificationInheritanceSpec extends Specification {

    @Inject
    @Client("/")
    HttpClient client

    @Inject UserRepository userRepository
    @Inject BusinessEntityRepository businessEntityRepository
    @Inject BusinessEntityVersionRepository businessEntityVersionRepository
    @Inject ClassificationRepository classificationRepository
    @Inject ClassificationValueRepository classificationValueRepository
    @Inject FieldConfigurationRepository fieldConfigurationRepository
    @Inject SupportedLocaleRepository localeRepository

    def setup() {
        if (localeRepository.count() == 0) {
            def locale = new SupportedLocale()
            locale.localeCode = "en"
            locale.displayName = "English"
            locale.isDefault = true
            locale.isActive = true
            locale.sortOrder = 1
            localeRepository.save(locale)
        }
    }

    def cleanup() {
        fieldConfigurationRepository.deleteAll()
        businessEntityVersionRepository.deleteAll()
        // Clear interface join table entries first to avoid FK violations
        businessEntityRepository.findAll().each { entity ->
            entity.interfaceEntities.clear()
            businessEntityRepository.update(entity)
        }
        businessEntityRepository.deleteAll()
        classificationValueRepository.deleteAll()
        classificationRepository.deleteAll()
        userRepository.deleteAll()
    }

    private String createAdminToken() {
        client.toBlocking().exchange(
                HttpRequest.POST("/authentication/signup",
                        new SignupRequest("admin@example.com", "admin", "password123", "Admin", "User")))
        def user = userRepository.findByEmail("admin@example.com").get()
        user.roles = "ROLE_USER,ROLE_ADMIN"
        userRepository.update(user)
        def loginResponse = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/login", new LoginRequest("admin@example.com", "password123")),
                Map)
        return loginResponse.body().accessToken
    }

    private String createClassificationWithValue(String token, String displayName, String valueName) {
        def classResponse = client.toBlocking().exchange(
                HttpRequest.POST("/classifications",
                        new CreateClassificationRequest(
                                [new LocalizedText("en", displayName)],
                                ClassificationAssignableTo.BUSINESS_ENTITY
                        )
                ).bearerAuth(token),
                Map)
        String classKey = classResponse.body().key

        client.toBlocking().exchange(
                HttpRequest.POST("/classifications/${classKey}/values",
                        new CreateClassificationValueRequest(valueName, [new LocalizedText("en", valueName)])
                ).bearerAuth(token),
                Map)

        return classKey
    }

    private String createEntity(String token, String name) {
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities",
                        new CreateBusinessEntityRequest([new LocalizedText("en", name)])
                ).bearerAuth(token),
                Map)
        return response.body().key
    }

    private void assignClassification(String token, String entityKey, String classKey, String valueKey) {
        client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${entityKey}/classifications",
                        [[classificationKey: classKey, valueKey: valueKey]]
                ).bearerAuth(token),
                Map)
    }

    private void setInterfaces(String token, String entityKey, List<String> interfaceKeys) {
        client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${entityKey}/interfaces",
                        new UpdateBusinessEntityInterfacesRequest(interfaceKeys)
                ).bearerAuth(token),
                Map)
    }

    private Map getEntity(String token, String entityKey) {
        client.toBlocking().exchange(
                HttpRequest.GET("/business-entities/${entityKey}").bearerAuth(token),
                Map).body()
    }

    // ======================================================================
    // Scenario 1: own assignments have inherited == false when no interfaces
    // ======================================================================

    def "entity with no interfaces returns own assignments with inherited false"() {
        given:
        String token = createAdminToken()
        String classKey = createClassificationWithValue(token, "sensitivity", "high")
        String entityKey = createEntity(token, "Customer")
        assignClassification(token, entityKey, classKey, "high")

        when:
        def body = getEntity(token, entityKey)

        then:
        def assignments = body.classificationAssignments
        assignments.size() == 1
        assignments[0].classificationKey == classKey
        assignments[0].valueKey == "high"
        assignments[0].inherited == false
        assignments[0].inheritedFromEntityKey == null
    }

    // ======================================================================
    // Scenario 2: entity inherits classification from interface
    // ======================================================================

    def "entity without own assignment inherits classification from interface entity"() {
        given: "interface entity 'Person' has a classification"
        String token = createAdminToken()
        String classKey = createClassificationWithValue(token, "personal-data", "contains")
        String personKey = createEntity(token, "Person")
        assignClassification(token, personKey, classKey, "contains")

        and: "Customer implements Person but has no own assignment"
        String customerKey = createEntity(token, "Customer")
        setInterfaces(token, customerKey, [personKey])

        when:
        def body = getEntity(token, customerKey)

        then:
        def assignments = body.classificationAssignments
        assignments.size() == 1
        assignments[0].classificationKey == classKey
        assignments[0].valueKey == "contains"
        assignments[0].inherited == true
        assignments[0].inheritedFromEntityKey == personKey
    }

    // ======================================================================
    // Scenario 3: own value overrides the inherited value
    // ======================================================================

    def "entity own classification assignment overrides interface inheritance"() {
        given: "interface entity 'Person' has sensitivity=low"
        String token = createAdminToken()
        String classKey = createClassificationWithValue(token, "sensitivity", "low")
        client.toBlocking().exchange(
                HttpRequest.POST("/classifications/${classKey}/values",
                        new CreateClassificationValueRequest("high", [new LocalizedText("en", "High")])
                ).bearerAuth(token), Map)
        String personKey = createEntity(token, "Person")
        assignClassification(token, personKey, classKey, "low")

        and: "Customer has own sensitivity=high and implements Person"
        String customerKey = createEntity(token, "Customer")
        assignClassification(token, customerKey, classKey, "high")
        setInterfaces(token, customerKey, [personKey])

        when:
        def body = getEntity(token, customerKey)

        then:
        def assignments = body.classificationAssignments
        assignments.size() == 1
        assignments[0].classificationKey == classKey
        assignments[0].valueKey == "high"
        assignments[0].inherited == false
        assignments[0].inheritedFromEntityKey == null
    }

    // ======================================================================
    // Scenario 4: two interfaces conflict — first-wins
    // ======================================================================

    def "when two interfaces set the same classification key to different values inheritance is disabled for that key"() {
        given: "two interface entities with conflicting sensitivity values"
        String token = createAdminToken()
        String classKey = createClassificationWithValue(token, "sensitivity", "low")
        client.toBlocking().exchange(
                HttpRequest.POST("/classifications/${classKey}/values",
                        new CreateClassificationValueRequest("high", [new LocalizedText("en", "High")])
                ).bearerAuth(token), Map)

        String personKey = createEntity(token, "Person")
        assignClassification(token, personKey, classKey, "low")

        String contractPartyKey = createEntity(token, "ContractParty")
        assignClassification(token, contractPartyKey, classKey, "high")

        and: "Customer implements both"
        String customerKey = createEntity(token, "Customer")
        setInterfaces(token, customerKey, [personKey, contractPartyKey])

        when:
        def body = getEntity(token, customerKey)

        then: "no classification is inherited — conflict disables inheritance for this key"
        def assignments = body.classificationAssignments
        assignments == null || assignments.isEmpty()
    }

    def "when two interfaces set the same classification key to the same value it is still inherited"() {
        given: "two interface entities that agree on a sensitivity value"
        String token = createAdminToken()
        String classKey = createClassificationWithValue(token, "sensitivity", "low")

        String personKey = createEntity(token, "Person")
        assignClassification(token, personKey, classKey, "low")

        String contractPartyKey = createEntity(token, "ContractParty")
        assignClassification(token, contractPartyKey, classKey, "low")

        and: "Customer implements both"
        String customerKey = createEntity(token, "Customer")
        setInterfaces(token, customerKey, [personKey, contractPartyKey])

        when:
        def body = getEntity(token, customerKey)

        then: "the agreed classification is inherited exactly once"
        def assignments = body.classificationAssignments
        assignments.size() == 1
        assignments[0].classificationKey == classKey
        assignments[0].valueKey == "low"
        assignments[0].inherited == true
    }

    // ======================================================================
    // Scenario 5: mandatory classification fulfilled by inheritance — not missing
    // ======================================================================

    def "mandatory classification is not missing when fulfilled by inheritance"() {
        given: "admin configures classification as mandatory"
        String token = createAdminToken()
        String classKey = createClassificationWithValue(token, "sensitivity", "high")

        client.toBlocking().exchange(
                HttpRequest.PUT("/administration/field-configurations",
                        [[entityType: "BUSINESS_ENTITY", fieldName: "classification.${classKey}".toString()]]
                ).bearerAuth(token),
                Argument.listOf(Map))

        and: "interface entity has the classification; Customer implements it but has no own assignment"
        String personKey = createEntity(token, "Person")
        assignClassification(token, personKey, classKey, "high")
        String customerKey = createEntity(token, "Customer")
        setInterfaces(token, customerKey, [personKey])

        when:
        def body = getEntity(token, customerKey)

        then: "missingMandatoryFields does not contain the classification"
        def missing = body.missingMandatoryFields
        missing == null || !missing.contains("classification.${classKey}")
    }

    // ======================================================================
    // Scenario 6: mandatory classification missing (no own, no interface)
    // ======================================================================

    def "mandatory classification appears in missingMandatoryFields when not set anywhere"() {
        given: "admin configures classification as mandatory"
        String token = createAdminToken()
        String classKey = createClassificationWithValue(token, "sensitivity", "high")

        client.toBlocking().exchange(
                HttpRequest.PUT("/administration/field-configurations",
                        [[entityType: "BUSINESS_ENTITY", fieldName: "classification.${classKey}".toString()]]
                ).bearerAuth(token),
                Argument.listOf(Map))

        and: "entity with no interfaces and no own assignment"
        String entityKey = createEntity(token, "Customer")

        when:
        def body = getEntity(token, entityKey)

        then:
        def missing = body.missingMandatoryFields
        missing != null
        missing.contains("classification.${classKey}".toString())
    }

    // ======================================================================
    // Scenario 7: assigning an explicit value converts it from inherited to own
    // ======================================================================

    def "assigning own value for a previously inherited classification marks it as not inherited"() {
        given: "interface has classification; Customer inherits it"
        String token = createAdminToken()
        String classKey = createClassificationWithValue(token, "sensitivity", "low")
        client.toBlocking().exchange(
                HttpRequest.POST("/classifications/${classKey}/values",
                        new CreateClassificationValueRequest("high", [new LocalizedText("en", "High")])
                ).bearerAuth(token), Map)

        String personKey = createEntity(token, "Person")
        assignClassification(token, personKey, classKey, "low")
        String customerKey = createEntity(token, "Customer")
        setInterfaces(token, customerKey, [personKey])

        and: "Customer subsequently sets its own value"
        assignClassification(token, customerKey, classKey, "high")

        when:
        def body = getEntity(token, customerKey)

        then:
        def assignments = body.classificationAssignments
        assignments.size() == 1
        assignments[0].valueKey == "high"
        assignments[0].inherited == false
        assignments[0].inheritedFromEntityKey == null
    }
}
