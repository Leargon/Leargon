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
import org.leargon.backend.model.CreateProcessRequest
import org.leargon.backend.model.LocalizedText
import org.leargon.backend.model.LoginRequest
import org.leargon.backend.model.ProcessResponse
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.BusinessEntityVersionRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.repository.ProcessVersionRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

@MicronautTest(transactional = false)
class ProcessControllerSpec extends Specification {

    @Inject
    @Client("/")
    HttpClient client

    @Inject
    UserRepository userRepository

    @Inject
    ProcessRepository processRepository

    @Inject
    ProcessVersionRepository processVersionRepository

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

            def deLocale = new SupportedLocale()
            deLocale.localeCode = "de"
            deLocale.displayName = "German"
            deLocale.isDefault = false
            deLocale.isActive = true
            deLocale.sortOrder = 2
            localeRepository.save(deLocale)
        }
    }

    def cleanup() {
        processVersionRepository.deleteAll()
        processRepository.findAll().each { processRepository.delete(it) }
        businessEntityVersionRepository.deleteAll()
        businessEntityRepository.findAll().each { businessEntityRepository.delete(it) }
        userRepository.deleteAll()
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
    // CREATE PROCESS TESTS
    // =====================

    def "POST /processes should create process with key from default locale name"() {
        given:
        def userData = createUserWithToken("creator@example.com", "creator")
        String token = userData.token

        and:
        def request = new CreateProcessRequest([new LocalizedText("en", "Order Fulfillment")])

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/processes", request).bearerAuth(token),
                ProcessResponse
        )

        then:
        response.status == HttpStatus.CREATED
        def process = response.body()
        process.key == "order-fulfillment"
        process.names.size() == 1
        process.names[0].text == "Order Fulfillment"
        process.processOwner.username == "creator"
        process.createdBy.username == "creator"
    }

    def "POST /processes should create process with key from code"() {
        given:
        def userData = createUserWithToken("creator@example.com", "creator")
        String token = userData.token

        and:
        def request = new CreateProcessRequest([new LocalizedText("en", "Order Fulfillment")])
        request.code = "ORD-FULFILL"

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/processes", request).bearerAuth(token),
                ProcessResponse
        )

        then:
        response.status == HttpStatus.CREATED
        response.body().key == "ord-fulfill"
        response.body().code == "ORD-FULFILL"
    }

    def "POST /processes should create process with type and descriptions"() {
        given:
        def userData = createUserWithToken("creator@example.com", "creator")
        String token = userData.token

        and:
        def request = new CreateProcessRequest([
                new LocalizedText("en", "Customer Onboarding"),
                new LocalizedText("de", "Kundeneinrichtung")
        ])
        request.descriptions = [new LocalizedText("en", "The customer onboarding process")]
        request.processType = org.leargon.backend.model.ProcessType.OPERATIONAL_CORE

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/processes", request).bearerAuth(token),
                ProcessResponse
        )

        then:
        response.status == HttpStatus.CREATED
        def process = response.body()
        process.names.size() == 2
        process.descriptions.size() == 1
        process.processType.toString() == "OPERATIONAL_CORE"
    }

    def "POST /processes should return 400 without default locale"() {
        given:
        def userData = createUserWithToken("creator@example.com", "creator")
        String token = userData.token

        and:
        def request = new CreateProcessRequest([new LocalizedText("de", "Nur Deutsch")])

        when:
        client.toBlocking().exchange(
                HttpRequest.POST("/processes", request).bearerAuth(token),
                ProcessResponse
        )

        then:
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.BAD_REQUEST
    }

    // =====================
    // GET PROCESS TESTS
    // =====================

    def "GET /processes should return all processes"() {
        given:
        def userData = createUserWithToken("creator@example.com", "creator")
        String token = userData.token

        and:
        client.toBlocking().exchange(
                HttpRequest.POST("/processes", new CreateProcessRequest([new LocalizedText("en", "Process A")]))
                        .bearerAuth(token), ProcessResponse)
        client.toBlocking().exchange(
                HttpRequest.POST("/processes", new CreateProcessRequest([new LocalizedText("en", "Process B")]))
                        .bearerAuth(token), ProcessResponse)

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/processes").bearerAuth(token),
                Argument.listOf(ProcessResponse)
        )

        then:
        response.status == HttpStatus.OK
        response.body().size() == 2
    }

    def "GET /processes/{key} should return process by key"() {
        given:
        def userData = createUserWithToken("creator@example.com", "creator")
        String token = userData.token

        and:
        def created = client.toBlocking().exchange(
                HttpRequest.POST("/processes", new CreateProcessRequest([new LocalizedText("en", "My Process")]))
                        .bearerAuth(token), ProcessResponse).body()

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/processes/${created.key}").bearerAuth(token),
                ProcessResponse
        )

        then:
        response.status == HttpStatus.OK
        response.body().key == created.key
    }

    // =====================
    // UPDATE TESTS
    // =====================

    def "PUT /processes/{key}/names should update names and recompute key when no code"() {
        given:
        def userData = createUserWithToken("creator@example.com", "creator")
        String token = userData.token

        and:
        def created = client.toBlocking().exchange(
                HttpRequest.POST("/processes", new CreateProcessRequest([new LocalizedText("en", "Old Name")]))
                        .bearerAuth(token), ProcessResponse).body()

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${created.key}/names", [
                        new LocalizedText("en", "New Name")
                ]).bearerAuth(token),
                ProcessResponse
        )

        then:
        response.status == HttpStatus.OK
        response.body().key == "new-name"
        response.body().names[0].text == "New Name"
    }

    def "PUT /processes/{key}/type should update process type"() {
        given:
        def userData = createUserWithToken("creator@example.com", "creator")
        String token = userData.token

        and:
        def created = client.toBlocking().exchange(
                HttpRequest.POST("/processes", new CreateProcessRequest([new LocalizedText("en", "Process")]))
                        .bearerAuth(token), ProcessResponse).body()

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${created.key}/type", [processType: "MANAGEMENT"])
                        .bearerAuth(token),
                ProcessResponse
        )

        then:
        response.status == HttpStatus.OK
        response.body().processType.toString() == "MANAGEMENT"
    }

    def "PUT /processes/{key}/owner should update process owner"() {
        given:
        def creatorData = createUserWithToken("creator@example.com", "creator")
        def ownerData = createUserWithToken("owner@example.com", "owner")
        String token = creatorData.token

        and:
        def created = client.toBlocking().exchange(
                HttpRequest.POST("/processes", new CreateProcessRequest([new LocalizedText("en", "Process")]))
                        .bearerAuth(token), ProcessResponse).body()

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${created.key}/owner", [processOwnerUsername: "owner"])
                        .bearerAuth(token),
                ProcessResponse
        )

        then:
        response.status == HttpStatus.OK
        response.body().processOwner.username == "owner"
    }

    def "PUT /processes/{key}/code should update code and recompute key"() {
        given:
        def userData = createUserWithToken("creator@example.com", "creator")
        String token = userData.token

        and:
        def created = client.toBlocking().exchange(
                HttpRequest.POST("/processes", new CreateProcessRequest([new LocalizedText("en", "Process")]))
                        .bearerAuth(token), ProcessResponse).body()

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${created.key}/code", [code: "NEW-CODE"])
                        .bearerAuth(token),
                ProcessResponse
        )

        then:
        response.status == HttpStatus.OK
        response.body().key == "new-code"
        response.body().code == "NEW-CODE"
    }

    def "PUT /processes/{key}/descriptions should update descriptions"() {
        given:
        def userData = createUserWithToken("creator@example.com", "creator")
        String token = userData.token

        and:
        def created = client.toBlocking().exchange(
                HttpRequest.POST("/processes", new CreateProcessRequest([new LocalizedText("en", "Process")]))
                        .bearerAuth(token), ProcessResponse).body()

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${created.key}/descriptions", [
                        new LocalizedText("en", "A great process")
                ]).bearerAuth(token),
                ProcessResponse
        )

        then:
        response.status == HttpStatus.OK
        response.body().descriptions.size() == 1
        response.body().descriptions[0].text == "A great process"
    }

    // =====================
    // INPUT/OUTPUT ENTITY TESTS
    // =====================

    def "POST /processes/{key}/inputs should add input entity"() {
        given:
        def userData = createUserWithToken("creator@example.com", "creator")
        String token = userData.token

        and: "create an entity"
        def entityRequest = new CreateBusinessEntityRequest([new LocalizedText("en", "Customer")])
        def entityResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities", entityRequest).bearerAuth(token),
                Map
        ).body()

        and: "create a process"
        def created = client.toBlocking().exchange(
                HttpRequest.POST("/processes", new CreateProcessRequest([new LocalizedText("en", "Process")]))
                        .bearerAuth(token), ProcessResponse).body()

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/processes/${created.key}/inputs", [entityKey: entityResponse.key])
                        .bearerAuth(token),
                ProcessResponse
        )

        then:
        response.status == HttpStatus.OK
        response.body().inputEntities.size() == 1
        response.body().inputEntities[0].key == entityResponse.key
    }

    def "DELETE /processes/{key}/inputs/{entityKey} should remove input entity"() {
        given:
        def userData = createUserWithToken("creator@example.com", "creator")
        String token = userData.token

        and: "create an entity"
        def entityRequest = new CreateBusinessEntityRequest([new LocalizedText("en", "Customer")])
        def entityResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities", entityRequest).bearerAuth(token), Map).body()

        and: "create a process and add the entity as input"
        def created = client.toBlocking().exchange(
                HttpRequest.POST("/processes", new CreateProcessRequest([new LocalizedText("en", "Process")]))
                        .bearerAuth(token), ProcessResponse).body()
        client.toBlocking().exchange(
                HttpRequest.POST("/processes/${created.key}/inputs", [entityKey: entityResponse.key])
                        .bearerAuth(token), ProcessResponse)

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.DELETE("/processes/${created.key}/inputs/${entityResponse.key}")
                        .bearerAuth(token),
                Map
        )

        then:
        response.status == HttpStatus.OK
        (response.body().inputEntities ?: []).size() == 0
    }

    def "POST /processes/{key}/outputs should add output entity"() {
        given:
        def userData = createUserWithToken("creator@example.com", "creator")
        String token = userData.token

        and:
        def entityRequest = new CreateBusinessEntityRequest([new LocalizedText("en", "Order")])
        def entityResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities", entityRequest).bearerAuth(token), Map).body()

        def created = client.toBlocking().exchange(
                HttpRequest.POST("/processes", new CreateProcessRequest([new LocalizedText("en", "Process")]))
                        .bearerAuth(token), ProcessResponse).body()

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/processes/${created.key}/outputs", [entityKey: entityResponse.key])
                        .bearerAuth(token),
                ProcessResponse
        )

        then:
        response.status == HttpStatus.OK
        response.body().outputEntities.size() == 1
        response.body().outputEntities[0].key == entityResponse.key
    }

    def "POST /processes/{key}/inputs with createEntity should create entity on-the-fly"() {
        given:
        def userData = createUserWithToken("creator@example.com", "creator")
        String token = userData.token

        and:
        def created = client.toBlocking().exchange(
                HttpRequest.POST("/processes", new CreateProcessRequest([new LocalizedText("en", "Process")]))
                        .bearerAuth(token), ProcessResponse).body()

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/processes/${created.key}/inputs", [
                        createEntity: [names: [[locale: "en", text: "New Entity"]]]
                ]).bearerAuth(token),
                ProcessResponse
        )

        then:
        response.status == HttpStatus.OK
        response.body().inputEntities.size() == 1
        response.body().inputEntities[0].name == "New Entity"
    }

    // =====================
    // VERSION TESTS
    // =====================

    def "GET /processes/{key}/versions should return version history"() {
        given:
        def userData = createUserWithToken("creator@example.com", "creator")
        String token = userData.token

        and:
        def created = client.toBlocking().exchange(
                HttpRequest.POST("/processes", new CreateProcessRequest([new LocalizedText("en", "Process")]))
                        .bearerAuth(token), ProcessResponse).body()

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/processes/${created.key}/versions").bearerAuth(token),
                Argument.listOf(Map)
        )

        then:
        response.status == HttpStatus.OK
        response.body().size() == 1
        response.body()[0].changeType == "CREATE"
    }

    // =====================
    // DELETE TESTS
    // =====================

    def "DELETE /processes/{key} should delete process"() {
        given:
        def userData = createUserWithToken("creator@example.com", "creator")
        String token = userData.token

        and:
        def created = client.toBlocking().exchange(
                HttpRequest.POST("/processes", new CreateProcessRequest([new LocalizedText("en", "Deletable")]))
                        .bearerAuth(token), ProcessResponse).body()

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.DELETE("/processes/${created.key}").bearerAuth(token)
        )

        then:
        response.status == HttpStatus.NO_CONTENT
    }

    def "DELETE /processes/{key} should return 403 for non-owner"() {
        given:
        def creatorData = createUserWithToken("creator@example.com", "creator")
        def otherData = createUserWithToken("other@example.com", "other")

        and:
        def created = client.toBlocking().exchange(
                HttpRequest.POST("/processes", new CreateProcessRequest([new LocalizedText("en", "Process")]))
                        .bearerAuth(creatorData.token), ProcessResponse).body()

        when:
        client.toBlocking().exchange(
                HttpRequest.DELETE("/processes/${created.key}").bearerAuth(otherData.token)
        )

        then:
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.FORBIDDEN
    }
}
