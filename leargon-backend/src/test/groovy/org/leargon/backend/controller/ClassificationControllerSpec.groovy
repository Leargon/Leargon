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
import org.leargon.backend.model.ClassificationAssignableTo
import org.leargon.backend.model.ClassificationAssignmentRequest
import org.leargon.backend.model.ClassificationResponse
import org.leargon.backend.model.CreateBusinessDomainRequest
import org.leargon.backend.model.CreateBusinessEntityRequest
import org.leargon.backend.model.CreateClassificationRequest
import org.leargon.backend.model.CreateClassificationValueRequest
import org.leargon.backend.model.LocalizedText
import org.leargon.backend.model.LoginRequest
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.model.UpdateClassificationRequest
import org.leargon.backend.model.UpdateClassificationValueRequest
import org.leargon.backend.repository.BusinessDomainRepository
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.BusinessEntityVersionRepository
import org.leargon.backend.repository.ClassificationRepository
import org.leargon.backend.repository.ClassificationValueRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

@MicronautTest(transactional = false)
class ClassificationControllerSpec extends Specification {

    @Inject
    @Client("/")
    HttpClient client

    @Inject
    UserRepository userRepository

    @Inject
    ClassificationRepository classificationRepository

    @Inject
    ClassificationValueRepository classificationValueRepository

    @Inject
    BusinessEntityRepository businessEntityRepository

    @Inject
    BusinessEntityVersionRepository businessEntityVersionRepository

    @Inject
    BusinessDomainRepository businessDomainRepository

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

            def deLocale = new SupportedLocale()
            deLocale.localeCode = "de"
            deLocale.displayName = "Deutsch"
            deLocale.isDefault = false
            deLocale.isActive = true
            deLocale.sortOrder = 2
            localeRepository.save(deLocale)
        }
    }

    def cleanup() {
        businessEntityVersionRepository.deleteAll()
        businessEntityRepository.findAll().each { businessEntityRepository.delete(it) }
        businessDomainRepository.findAll().each { businessDomainRepository.delete(it) }
        classificationValueRepository.deleteAll()
        classificationRepository.deleteAll()
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
    // CLASSIFICATION CRUD
    // =====================

    def "POST /classifications should create classification (admin)"() {
        given: "an admin token"
        String token = createAdminToken()

        and: "a create request"
        def request = new CreateClassificationRequest(
                [new LocalizedText("en", "Sensitivity")],
                ClassificationAssignableTo.BUSINESS_ENTITY
        ).descriptions([new LocalizedText("en", "Data sensitivity level")])

        when: "creating a classification"
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/classifications", request).bearerAuth(token),
                ClassificationResponse
        )

        then: "response is 201"
        response.status == HttpStatus.CREATED

        and: "classification is created correctly"
        def body = response.body()
        body.key == "sensitivity"
        body.assignableTo == ClassificationAssignableTo.BUSINESS_ENTITY
        body.names.size() == 1
        body.names[0].text == "Sensitivity"
        body.descriptions.size() == 1
        body.descriptions[0].text == "Data sensitivity level"
    }

    def "POST /classifications should fail for non-admin"() {
        given: "a regular user token"
        String token = createUserToken()

        and: "a create request"
        def request = new CreateClassificationRequest(
                [new LocalizedText("en", "Sensitivity")],
                ClassificationAssignableTo.BUSINESS_ENTITY
        )

        when: "creating a classification"
        client.toBlocking().exchange(
                HttpRequest.POST("/classifications", request).bearerAuth(token),
                ClassificationResponse
        )

        then: "403 forbidden"
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }

    def "GET /classifications should return all classifications"() {
        given: "an admin creates two classifications"
        String token = createAdminToken()

        client.toBlocking().exchange(
                HttpRequest.POST("/classifications",
                        new CreateClassificationRequest(
                                [new LocalizedText("en", "Sensitivity")],
                                ClassificationAssignableTo.BUSINESS_ENTITY
                        )).bearerAuth(token),
                ClassificationResponse
        )

        client.toBlocking().exchange(
                HttpRequest.POST("/classifications",
                        new CreateClassificationRequest(
                                [new LocalizedText("en", "Criticality")],
                                ClassificationAssignableTo.BUSINESS_DOMAIN
                        )).bearerAuth(token),
                ClassificationResponse
        )

        when: "getting all classifications"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/classifications").bearerAuth(token),
                Argument.listOf(ClassificationResponse)
        )

        then: "both are returned"
        response.body().size() == 2
    }

    def "GET /classifications?assignable-to= should filter by assignableTo"() {
        given: "an admin creates two classifications"
        String token = createAdminToken()

        client.toBlocking().exchange(
                HttpRequest.POST("/classifications",
                        new CreateClassificationRequest(
                                [new LocalizedText("en", "Sensitivity")],
                                ClassificationAssignableTo.BUSINESS_ENTITY
                        )).bearerAuth(token),
                ClassificationResponse
        )

        client.toBlocking().exchange(
                HttpRequest.POST("/classifications",
                        new CreateClassificationRequest(
                                [new LocalizedText("en", "Criticality")],
                                ClassificationAssignableTo.BUSINESS_DOMAIN
                        )).bearerAuth(token),
                ClassificationResponse
        )

        when: "filtering by BUSINESS_ENTITY"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/classifications?assignable-to=BUSINESS_ENTITY").bearerAuth(token),
                Argument.listOf(ClassificationResponse)
        )

        then: "only entity classification returned"
        response.body().size() == 1
        response.body()[0].key == "sensitivity"
    }

    def "GET /classifications/{key} should return classification with values"() {
        given: "an admin creates a classification with values"
        String token = createAdminToken()

        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/classifications",
                        new CreateClassificationRequest(
                                [new LocalizedText("en", "Sensitivity")],
                                ClassificationAssignableTo.BUSINESS_ENTITY
                        )).bearerAuth(token),
                ClassificationResponse
        )
        String key = createResponse.body().key

        client.toBlocking().exchange(
                HttpRequest.POST("/classifications/${key}/values",
                        new CreateClassificationValueRequest("high", [new LocalizedText("en", "High")])
                ).bearerAuth(token),
                ClassificationResponse
        )

        when: "getting classification by key"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/classifications/${key}").bearerAuth(token),
                ClassificationResponse
        )

        then: "classification with values is returned"
        def body = response.body()
        body.key == key
        body.values.size() == 1
        body.values[0].key == "high"
    }

    def "PUT /classifications/{key} should update classification"() {
        given: "an admin creates a classification"
        String token = createAdminToken()

        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/classifications",
                        new CreateClassificationRequest(
                                [new LocalizedText("en", "Sensitivity")],
                                ClassificationAssignableTo.BUSINESS_ENTITY
                        )).bearerAuth(token),
                ClassificationResponse
        )
        String key = createResponse.body().key

        when: "updating the classification"
        def updateResponse = client.toBlocking().exchange(
                HttpRequest.PUT("/classifications/${key}",
                        new UpdateClassificationRequest()
                                .names([new LocalizedText("en", "Data Sensitivity")])
                ).bearerAuth(token),
                ClassificationResponse
        )

        then: "classification is updated"
        def body = updateResponse.body()
        body.key == "data-sensitivity"
        body.names[0].text == "Data Sensitivity"
    }

    def "DELETE /classifications/{key} should delete classification"() {
        given: "an admin creates a classification"
        String token = createAdminToken()

        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/classifications",
                        new CreateClassificationRequest(
                                [new LocalizedText("en", "Sensitivity")],
                                ClassificationAssignableTo.BUSINESS_ENTITY
                        )).bearerAuth(token),
                ClassificationResponse
        )
        String key = createResponse.body().key

        when: "deleting the classification"
        def response = client.toBlocking().exchange(
                HttpRequest.DELETE("/classifications/${key}").bearerAuth(token)
        )

        then: "204 no content"
        response.status == HttpStatus.NO_CONTENT

        and: "classification is gone"
        when:
        client.toBlocking().exchange(
                HttpRequest.GET("/classifications/${key}").bearerAuth(token),
                ClassificationResponse
        )

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.NOT_FOUND
    }

    // =====================
    // CLASSIFICATION VALUES
    // =====================

    def "POST /classifications/{key}/values should add value"() {
        given: "an admin creates a classification"
        String token = createAdminToken()

        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/classifications",
                        new CreateClassificationRequest(
                                [new LocalizedText("en", "Sensitivity")],
                                ClassificationAssignableTo.BUSINESS_ENTITY
                        )).bearerAuth(token),
                ClassificationResponse
        )
        String key = createResponse.body().key

        when: "adding a value"
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/classifications/${key}/values",
                        new CreateClassificationValueRequest("high", [new LocalizedText("en", "High")])
                                .descriptions([new LocalizedText("en", "High sensitivity")])
                ).bearerAuth(token),
                ClassificationResponse
        )

        then: "value is added"
        response.status == HttpStatus.CREATED
        def body = response.body()
        body.values.size() == 1
        body.values[0].key == "high"
        body.values[0].names[0].text == "High"
    }

    def "POST /classifications/{key}/values should reject duplicate value key"() {
        given: "an admin creates a classification with a value"
        String token = createAdminToken()

        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/classifications",
                        new CreateClassificationRequest(
                                [new LocalizedText("en", "Sensitivity")],
                                ClassificationAssignableTo.BUSINESS_ENTITY
                        )).bearerAuth(token),
                ClassificationResponse
        )
        String key = createResponse.body().key

        client.toBlocking().exchange(
                HttpRequest.POST("/classifications/${key}/values",
                        new CreateClassificationValueRequest("high", [new LocalizedText("en", "High")])
                ).bearerAuth(token),
                ClassificationResponse
        )

        when: "adding a duplicate value key"
        client.toBlocking().exchange(
                HttpRequest.POST("/classifications/${key}/values",
                        new CreateClassificationValueRequest("high", [new LocalizedText("en", "High Again")])
                ).bearerAuth(token),
                ClassificationResponse
        )

        then: "400 bad request"
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.BAD_REQUEST
    }

    def "PUT /classifications/{key}/values/{valueKey} should update value"() {
        given: "a classification with a value"
        String token = createAdminToken()

        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/classifications",
                        new CreateClassificationRequest(
                                [new LocalizedText("en", "Sensitivity")],
                                ClassificationAssignableTo.BUSINESS_ENTITY
                        )).bearerAuth(token),
                ClassificationResponse
        )
        String key = createResponse.body().key

        client.toBlocking().exchange(
                HttpRequest.POST("/classifications/${key}/values",
                        new CreateClassificationValueRequest("high", [new LocalizedText("en", "High")])
                ).bearerAuth(token),
                ClassificationResponse
        )

        when: "updating the value"
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/classifications/${key}/values/high",
                        new UpdateClassificationValueRequest()
                                .names([new LocalizedText("en", "Very High")])
                ).bearerAuth(token),
                ClassificationResponse
        )

        then: "value is updated"
        def body = response.body()
        body.values.find { it.key == "high" }.names[0].text == "Very High"
    }

    def "DELETE /classifications/{key}/values/{valueKey} should delete value"() {
        given: "a classification with a value"
        String token = createAdminToken()

        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/classifications",
                        new CreateClassificationRequest(
                                [new LocalizedText("en", "Sensitivity")],
                                ClassificationAssignableTo.BUSINESS_ENTITY
                        )).bearerAuth(token),
                ClassificationResponse
        )
        String key = createResponse.body().key

        client.toBlocking().exchange(
                HttpRequest.POST("/classifications/${key}/values",
                        new CreateClassificationValueRequest("high", [new LocalizedText("en", "High")])
                ).bearerAuth(token),
                ClassificationResponse
        )

        when: "deleting the value"
        def response = client.toBlocking().exchange(
                HttpRequest.DELETE("/classifications/${key}/values/high").bearerAuth(token)
        )

        then: "204 no content"
        response.status == HttpStatus.NO_CONTENT

        and: "classification has no values"
        def getResponse = client.toBlocking().exchange(
                HttpRequest.GET("/classifications/${key}").bearerAuth(token),
                ClassificationResponse
        )
        getResponse.body().values == null || getResponse.body().values.size() == 0
    }

    // =====================
    // ASSIGNMENTS
    // =====================

    def "PUT /business-entities/{key}/classifications should assign classifications"() {
        given: "an admin creates a classification with values"
        String token = createAdminToken()

        def classResponse = client.toBlocking().exchange(
                HttpRequest.POST("/classifications",
                        new CreateClassificationRequest(
                                [new LocalizedText("en", "Sensitivity")],
                                ClassificationAssignableTo.BUSINESS_ENTITY
                        )).bearerAuth(token),
                ClassificationResponse
        )
        String classKey = classResponse.body().key

        client.toBlocking().exchange(
                HttpRequest.POST("/classifications/${classKey}/values",
                        new CreateClassificationValueRequest("high", [new LocalizedText("en", "High")])
                ).bearerAuth(token),
                ClassificationResponse
        )

        and: "an entity exists"
        def entityResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities",
                        new CreateBusinessEntityRequest([new LocalizedText("en", "Customer")])
                ).bearerAuth(token),
                Map
        )
        String entityKey = entityResponse.body().key

        when: "assigning classifications"
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${entityKey}/classifications",
                        [new ClassificationAssignmentRequest(classKey, "high")]
                ).bearerAuth(token),
                Map
        )

        then: "assignment is successful"
        response.status == HttpStatus.OK
        def body = response.body()
        body.classificationAssignments != null
        body.classificationAssignments.size() == 1
        body.classificationAssignments[0].classificationKey == classKey
        body.classificationAssignments[0].valueKey == "high"
    }

    def "PUT /business-entities/{key}/classifications should reject wrong assignable type"() {
        given: "a classification assignable to BUSINESS_DOMAIN"
        String token = createAdminToken()

        def classResponse = client.toBlocking().exchange(
                HttpRequest.POST("/classifications",
                        new CreateClassificationRequest(
                                [new LocalizedText("en", "Domain Type")],
                                ClassificationAssignableTo.BUSINESS_DOMAIN
                        )).bearerAuth(token),
                ClassificationResponse
        )
        String classKey = classResponse.body().key

        client.toBlocking().exchange(
                HttpRequest.POST("/classifications/${classKey}/values",
                        new CreateClassificationValueRequest("core", [new LocalizedText("en", "Core")])
                ).bearerAuth(token),
                ClassificationResponse
        )

        and: "an entity exists"
        def entityResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities",
                        new CreateBusinessEntityRequest([new LocalizedText("en", "Customer")])
                ).bearerAuth(token),
                Map
        )
        String entityKey = entityResponse.body().key

        when: "assigning a domain-only classification to an entity"
        client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${entityKey}/classifications",
                        [new ClassificationAssignmentRequest(classKey, "core")]
                ).bearerAuth(token),
                Map
        )

        then: "400 bad request"
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.BAD_REQUEST
    }

    def "PUT /business-entities/{key}/classifications should reject duplicate classification keys"() {
        given: "a classification with two values"
        String token = createAdminToken()

        def classResponse = client.toBlocking().exchange(
                HttpRequest.POST("/classifications",
                        new CreateClassificationRequest(
                                [new LocalizedText("en", "Sensitivity")],
                                ClassificationAssignableTo.BUSINESS_ENTITY
                        )).bearerAuth(token),
                ClassificationResponse
        )
        String classKey = classResponse.body().key

        client.toBlocking().exchange(
                HttpRequest.POST("/classifications/${classKey}/values",
                        new CreateClassificationValueRequest("high", [new LocalizedText("en", "High")])
                ).bearerAuth(token),
                ClassificationResponse
        )
        client.toBlocking().exchange(
                HttpRequest.POST("/classifications/${classKey}/values",
                        new CreateClassificationValueRequest("low", [new LocalizedText("en", "Low")])
                ).bearerAuth(token),
                ClassificationResponse
        )

        and: "an entity exists"
        def entityResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities",
                        new CreateBusinessEntityRequest([new LocalizedText("en", "Customer")])
                ).bearerAuth(token),
                Map
        )
        String entityKey = entityResponse.body().key

        when: "assigning two values from the same classification"
        client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${entityKey}/classifications",
                        [
                                new ClassificationAssignmentRequest(classKey, "high"),
                                new ClassificationAssignmentRequest(classKey, "low")
                        ]
                ).bearerAuth(token),
                Map
        )

        then: "400 bad request - mutual exclusivity"
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.BAD_REQUEST
    }

    def "PUT /business-domains/{key}/classifications should assign classifications to domain"() {
        given: "a classification for domains"
        String token = createAdminToken()

        def classResponse = client.toBlocking().exchange(
                HttpRequest.POST("/classifications",
                        new CreateClassificationRequest(
                                [new LocalizedText("en", "Criticality")],
                                ClassificationAssignableTo.BUSINESS_DOMAIN
                        )).bearerAuth(token),
                ClassificationResponse
        )
        String classKey = classResponse.body().key

        client.toBlocking().exchange(
                HttpRequest.POST("/classifications/${classKey}/values",
                        new CreateClassificationValueRequest("high", [new LocalizedText("en", "High")])
                ).bearerAuth(token),
                ClassificationResponse
        )

        and: "a domain exists"
        def domainResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-domains",
                        new CreateBusinessDomainRequest([new LocalizedText("en", "Sales")])
                ).bearerAuth(token),
                Map
        )
        String domainKey = domainResponse.body().key

        when: "assigning classifications to domain"
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/business-domains/${domainKey}/classifications",
                        [new ClassificationAssignmentRequest(classKey, "high")]
                ).bearerAuth(token),
                Map
        )

        then: "assignment is successful"
        response.status == HttpStatus.OK
        def body = response.body()
        body.classificationAssignments != null
        body.classificationAssignments.size() == 1
    }

    def "DELETE /classifications/{key} should cascade-remove assignments from entities"() {
        given: "a classification assigned to an entity"
        String token = createAdminToken()

        def classResponse = client.toBlocking().exchange(
                HttpRequest.POST("/classifications",
                        new CreateClassificationRequest(
                                [new LocalizedText("en", "Sensitivity")],
                                ClassificationAssignableTo.BUSINESS_ENTITY
                        )).bearerAuth(token),
                ClassificationResponse
        )
        String classKey = classResponse.body().key

        client.toBlocking().exchange(
                HttpRequest.POST("/classifications/${classKey}/values",
                        new CreateClassificationValueRequest("high", [new LocalizedText("en", "High")])
                ).bearerAuth(token),
                ClassificationResponse
        )

        def entityResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities",
                        new CreateBusinessEntityRequest([new LocalizedText("en", "Customer")])
                ).bearerAuth(token),
                Map
        )
        String entityKey = entityResponse.body().key

        client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${entityKey}/classifications",
                        [new ClassificationAssignmentRequest(classKey, "high")]
                ).bearerAuth(token),
                Map
        )

        when: "deleting the classification"
        client.toBlocking().exchange(
                HttpRequest.DELETE("/classifications/${classKey}").bearerAuth(token)
        )

        then: "entity's assignments are cleaned up"
        def entityGetResponse = client.toBlocking().exchange(
                HttpRequest.GET("/business-entities/${entityKey}").bearerAuth(token),
                Map
        )
        def assignments = entityGetResponse.body().classificationAssignments
        assignments == null || assignments.size() == 0
    }
}
