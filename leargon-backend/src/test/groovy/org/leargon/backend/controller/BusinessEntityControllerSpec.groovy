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
import org.leargon.backend.model.LocalizedText
import org.leargon.backend.model.LoginRequest
import org.leargon.backend.model.BusinessEntityResponse
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.model.UpdateBusinessEntityDataOwnerRequest
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.BusinessEntityVersionRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

@MicronautTest(transactional = false)
class BusinessEntityControllerSpec extends Specification {

    @Inject
    @Client("/")
    HttpClient client

    @Inject
    UserRepository userRepository

    @Inject
    BusinessEntityRepository businessEntityRepository

    @Inject
    BusinessEntityVersionRepository businessEntityVersionRepository

    @Inject
    SupportedLocaleRepository localeRepository

    def setup() {
        // Ensure locale data exists
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
    // CREATE ENTITY TESTS
    // =====================

    def "POST /business-entities should create entity successfully"() {
        given: "an authenticated user"
        def userData = createUserWithToken("creator@example.com", "creator")
        String token = userData.token

        and: "a valid create request"
        def enTranslation = new LocalizedText("en", "Customer")
        def deTranslation = new LocalizedText("de", "Kunde")
        def request = new CreateBusinessEntityRequest([enTranslation, deTranslation])

        when: "creating an entity"
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities", request)
                        .bearerAuth(token),
                BusinessEntityResponse
        )

        then: "response is successful"
        response.status == HttpStatus.CREATED

        and: "entity is created with correct data"
        def entity = response.body()
        entity.key != null
        entity.key == "customer"
        entity.names.size() == 2
        entity.names.any { it.locale == "en" && it.text == "Customer" }
        entity.names.any { it.locale == "de" && it.text == "Kunde" }
        entity.dataOwner.username == "creator"
        entity.createdBy.username == "creator"
    }

    def "POST /business-entities should set data owner to creator by default"() {
        given: "an authenticated user"
        def userData = createUserWithToken("creator@example.com", "creator")
        String token = userData.token

        and: "a create request without explicit data owner"
        def request = new CreateBusinessEntityRequest([new LocalizedText("en", "BusinessEntity")])

        when: "creating an entity"
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities", request)
                        .bearerAuth(token),
                BusinessEntityResponse
        )

        then: "data owner is set to creator"
        response.body().dataOwner.username == "creator"
    }

    def "POST /business-entities should allow setting custom data owner"() {
        given: "two users"
        def creatorData = createUserWithToken("creator@example.com", "creator")
        def ownerData = createUserWithToken("owner@example.com", "owner")

        and: "a create request with custom data owner"
        def request = new CreateBusinessEntityRequest([new LocalizedText("en", "BusinessEntity")])
        request.dataOwnerUsername = "owner"

        when: "creating an entity"
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities", request)
                        .bearerAuth(creatorData.token),
                BusinessEntityResponse
        )

        then: "data owner is set to specified user"
        response.body().dataOwner.username == "owner"
        response.body().createdBy.username == "creator"
    }

    def "POST /business-entities should return 400 without default locale translation"() {
        given: "an authenticated user"
        def userData = createUserWithToken("creator@example.com", "creator")
        String token = userData.token

        and: "a create request without English translation"
        def request = new CreateBusinessEntityRequest([new LocalizedText("de", "Nur Deutsch")])

        when: "creating an entity"
        client.toBlocking().exchange(
                HttpRequest.POST("/business-entities", request)
                        .bearerAuth(token),
                BusinessEntityResponse
        )

        then: "bad request exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.BAD_REQUEST
    }

    def "POST /business-entities should return 401 without authentication"() {
        when: "creating entity without token"
        def request = new CreateBusinessEntityRequest([new LocalizedText("en", "BusinessEntity")])
        client.toBlocking().exchange(
                HttpRequest.POST("/business-entities", request),
                BusinessEntityResponse
        )

        then: "unauthorized exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.UNAUTHORIZED
    }

    // =====================
    // GET ENTITY TESTS
    // =====================

    def "GET /business-entities/{key} should return entity by key"() {
        given: "an authenticated user and created entity"
        def userData = createUserWithToken("creator@example.com", "creator")
        def createRequest = new CreateBusinessEntityRequest([new LocalizedText("en", "Test BusinessEntity")])
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities", createRequest)
                        .bearerAuth(userData.token),
                BusinessEntityResponse
        )
        def entityKey = createResponse.body().key

        when: "getting entity by key"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/business-entities/${entityKey}")
                        .bearerAuth(userData.token),
                BusinessEntityResponse
        )

        then: "response is successful"
        response.status == HttpStatus.OK
        response.body().key == entityKey
        response.body().names.find { it.locale == "en" }.text == "Test BusinessEntity"
    }

    def "GET /business-entities/{key} should return 404 for non-existent entity"() {
        given: "an authenticated user"
        def userData = createUserWithToken("user@example.com", "user")

        when: "getting non-existent entity"
        client.toBlocking().exchange(
                HttpRequest.GET("/business-entities/non-existent-key")
                        .bearerAuth(userData.token),
                BusinessEntityResponse
        )

        then: "not found exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.NOT_FOUND
    }

    // =====================
    // GET ALL ENTITIES TESTS
    // =====================

    def "GET /business-entities should return all entities"() {
        given: "an authenticated user and multiple entities"
        def userData = createUserWithToken("creator@example.com", "creator")

        client.toBlocking().exchange(
                HttpRequest.POST("/business-entities",
                        new CreateBusinessEntityRequest([new LocalizedText("en", "BusinessEntity 1")]))
                        .bearerAuth(userData.token),
                BusinessEntityResponse
        )
        client.toBlocking().exchange(
                HttpRequest.POST("/business-entities",
                        new CreateBusinessEntityRequest([new LocalizedText("en", "BusinessEntity 2")]))
                        .bearerAuth(userData.token),
                BusinessEntityResponse
        )

        when: "getting all entities"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/business-entities")
                        .bearerAuth(userData.token),
                Argument.listOf(Map)
        )

        then: "response is successful"
        response.status == HttpStatus.OK
        response.body().size() == 2
    }

    // =====================
    // UPDATE ENTITY TESTS (granular endpoints)
    // =====================

    def "PUT /business-entities/{key}/names should update entity names when owner"() {
        given: "an entity owned by a user"
        def ownerData = createUserWithToken("owner@example.com", "owner")
        def createRequest = new CreateBusinessEntityRequest([new LocalizedText("en", "Original")])
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities", createRequest)
                        .bearerAuth(ownerData.token),
                BusinessEntityResponse
        )
        def entityKey = createResponse.body().key

        when: "owner updates entity names"
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${entityKey}/names",
                        [new LocalizedText("en", "Updated")])
                        .bearerAuth(ownerData.token),
                BusinessEntityResponse
        )

        then: "response is successful"
        response.status == HttpStatus.OK
        response.body().names.find { it.locale == "en" }.text == "Updated"
    }

    def "PUT /business-entities/{key}/names should update entity names when admin"() {
        given: "an entity owned by a regular user"
        def ownerData = createUserWithToken("owner@example.com", "owner")
        def createRequest = new CreateBusinessEntityRequest([new LocalizedText("en", "Original")])
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities", createRequest)
                        .bearerAuth(ownerData.token),
                BusinessEntityResponse
        )
        def entityKey = createResponse.body().key

        and: "an admin user"
        String adminToken = createAdminToken()

        when: "admin updates entity names"
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${entityKey}/names",
                        [new LocalizedText("en", "Updated by Admin")])
                        .bearerAuth(adminToken),
                BusinessEntityResponse
        )

        then: "response is successful"
        response.status == HttpStatus.OK
        response.body().names.find { it.locale == "en" }.text == "Updated by Admin"
    }

    def "PUT /business-entities/{key}/names should return 403 when non-owner and non-admin"() {
        given: "an entity owned by one user"
        def ownerData = createUserWithToken("owner@example.com", "owner")
        def createRequest = new CreateBusinessEntityRequest([new LocalizedText("en", "Original")])
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities", createRequest)
                        .bearerAuth(ownerData.token),
                BusinessEntityResponse
        )
        def entityKey = createResponse.body().key

        and: "a different non-admin user"
        def otherData = createUserWithToken("other@example.com", "other")

        when: "non-owner attempts to update"
        client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${entityKey}/names",
                        [new LocalizedText("en", "Unauthorized Update")])
                        .bearerAuth(otherData.token),
                BusinessEntityResponse
        )

        then: "forbidden exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.FORBIDDEN
    }

    def "PUT /business-entities/{key}/data-owner should allow changing data owner"() {
        given: "an entity and a new owner"
        def ownerData = createUserWithToken("owner@example.com", "owner")
        def newOwnerData = createUserWithToken("newowner@example.com", "newowner")

        def createRequest = new CreateBusinessEntityRequest([new LocalizedText("en", "BusinessEntity")])
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities", createRequest)
                        .bearerAuth(ownerData.token),
                BusinessEntityResponse
        )
        def entityKey = createResponse.body().key

        when: "changing data owner"
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${entityKey}/data-owner",
                        new UpdateBusinessEntityDataOwnerRequest("newowner"))
                        .bearerAuth(ownerData.token),
                BusinessEntityResponse
        )

        then: "data owner is changed"
        response.status == HttpStatus.OK
        response.body().dataOwner.username == "newowner"
    }

    // =====================
    // DELETE ENTITY TESTS
    // =====================

    def "DELETE /business-entities/{key} should delete entity when owner"() {
        given: "an entity owned by a user"
        def ownerData = createUserWithToken("owner@example.com", "owner")
        def createRequest = new CreateBusinessEntityRequest([new LocalizedText("en", "ToDelete")])
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities", createRequest)
                        .bearerAuth(ownerData.token),
                BusinessEntityResponse
        )
        def entityKey = createResponse.body().key

        when: "owner deletes entity"
        def response = client.toBlocking().exchange(
                HttpRequest.DELETE("/business-entities/${entityKey}")
                        .bearerAuth(ownerData.token)
        )

        then: "response is successful"
        response.status == HttpStatus.NO_CONTENT

        and: "entity is deleted"
        when:
        client.toBlocking().exchange(
                HttpRequest.GET("/business-entities/${entityKey}")
                        .bearerAuth(ownerData.token),
                BusinessEntityResponse
        )
        then:
        thrown(HttpClientResponseException)
    }

    def "DELETE /business-entities/{key} should delete entity when admin"() {
        given: "an entity owned by a regular user"
        def ownerData = createUserWithToken("owner@example.com", "owner")
        def createRequest = new CreateBusinessEntityRequest([new LocalizedText("en", "ToDelete")])
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities", createRequest)
                        .bearerAuth(ownerData.token),
                BusinessEntityResponse
        )
        def entityKey = createResponse.body().key

        and: "an admin user"
        String adminToken = createAdminToken()

        when: "admin deletes entity"
        def response = client.toBlocking().exchange(
                HttpRequest.DELETE("/business-entities/${entityKey}")
                        .bearerAuth(adminToken)
        )

        then: "response is successful"
        response.status == HttpStatus.NO_CONTENT
    }

    def "DELETE /business-entities/{key} should return 403 when non-owner and non-admin"() {
        given: "an entity owned by one user"
        def ownerData = createUserWithToken("owner@example.com", "owner")
        def createRequest = new CreateBusinessEntityRequest([new LocalizedText("en", "BusinessEntity")])
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities", createRequest)
                        .bearerAuth(ownerData.token),
                BusinessEntityResponse
        )
        def entityKey = createResponse.body().key

        and: "a different non-admin user"
        def otherData = createUserWithToken("other@example.com", "other")

        when: "non-owner attempts to delete"
        client.toBlocking().exchange(
                HttpRequest.DELETE("/business-entities/${entityKey}")
                        .bearerAuth(otherData.token)
        )

        then: "forbidden exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.FORBIDDEN
    }

    // =====================
    // VERSION HISTORY TESTS
    // =====================

    def "GET /business-entities/{key}/versions should return version history"() {
        given: "an entity with updates"
        def userData = createUserWithToken("creator@example.com", "creator")
        def createRequest = new CreateBusinessEntityRequest([new LocalizedText("en", "Original")])
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities", createRequest)
                        .bearerAuth(userData.token),
                BusinessEntityResponse
        )
        def entityKey = createResponse.body().key

        // Make an update to create another version
        def updateResponse = client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${entityKey}/names",
                        [new LocalizedText("en", "Updated")])
                        .bearerAuth(userData.token),
                BusinessEntityResponse
        )
        def updatedKey = updateResponse.body().key

        when: "getting version history"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/business-entities/${updatedKey}/versions")
                        .bearerAuth(userData.token),
                Argument.listOf(Map)
        )

        then: "response is successful"
        response.status == HttpStatus.OK

        and: "version history contains both versions"
        def versions = response.body()
        versions.size() == 2
        versions.any { it.versionNumber == 1 && it.changeType == "CREATE" }
        versions.any { it.versionNumber == 2 && it.changeType == "UPDATE" }
    }

    def "GET /business-entities/{key}/versions should return initial version"() {
        given: "a newly created entity"
        def userData = createUserWithToken("creator@example.com", "creator")
        def createRequest = new CreateBusinessEntityRequest([new LocalizedText("en", "BusinessEntity")])
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities", createRequest)
                        .bearerAuth(userData.token),
                BusinessEntityResponse
        )
        def entityKey = createResponse.body().key

        when: "getting version history"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/business-entities/${entityKey}/versions")
                        .bearerAuth(userData.token),
                Argument.listOf(Map)
        )

        then: "initial version exists"
        def versions = response.body()
        versions.size() == 1
        versions[0].versionNumber == 1
        versions[0].changeType == "CREATE"
        versions[0].changeSummary == "Initial creation"
    }

    // =====================
    // VERSION DIFF TESTS
    // =====================

    def "GET /business-entities/{key}/versions/{v}/diff should return diff"() {
        given: "an entity with multiple versions"
        def userData = createUserWithToken("creator@example.com", "creator")
        def createRequest = new CreateBusinessEntityRequest([new LocalizedText("en", "Original")])
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities", createRequest)
                        .bearerAuth(userData.token),
                BusinessEntityResponse
        )
        def entityKey = createResponse.body().key

        // Make an update
        def updateResponse = client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${entityKey}/names",
                        [new LocalizedText("en", "Updated")])
                        .bearerAuth(userData.token),
                BusinessEntityResponse
        )
        def updatedKey = updateResponse.body().key

        when: "getting diff for version 2"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/business-entities/${updatedKey}/versions/2/diff")
                        .bearerAuth(userData.token),
                Map
        )

        then: "response is successful"
        response.status == HttpStatus.OK

        and: "diff shows changes"
        def diff = response.body()
        diff.versionNumber == 2
        diff.previousVersionNumber == 1
        diff.changes != null
        diff.changes.size() > 0
    }

    def "GET /business-entities/{key}/versions/1/diff should return initial diff"() {
        given: "a newly created entity"
        def userData = createUserWithToken("creator@example.com", "creator")
        def createRequest = new CreateBusinessEntityRequest([new LocalizedText("en", "BusinessEntity")])
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities", createRequest)
                        .bearerAuth(userData.token),
                BusinessEntityResponse
        )
        def entityKey = createResponse.body().key

        when: "getting diff for version 1"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/business-entities/${entityKey}/versions/1/diff")
                        .bearerAuth(userData.token),
                Map
        )

        then: "response is successful"
        response.status == HttpStatus.OK

        and: "diff shows initial creation"
        def diff = response.body()
        diff.versionNumber == 1
        diff.previousVersionNumber == null
    }

    def "GET /business-entities/{key}/versions/{v}/diff should return 404 for non-existent version"() {
        given: "a created entity"
        def userData = createUserWithToken("creator@example.com", "creator")
        def createRequest = new CreateBusinessEntityRequest([new LocalizedText("en", "BusinessEntity")])
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities", createRequest)
                        .bearerAuth(userData.token),
                BusinessEntityResponse
        )
        def entityKey = createResponse.body().key

        when: "getting diff for non-existent version"
        client.toBlocking().exchange(
                HttpRequest.GET("/business-entities/${entityKey}/versions/999/diff")
                        .bearerAuth(userData.token),
                Map
        )

        then: "not found exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.NOT_FOUND
    }
}
