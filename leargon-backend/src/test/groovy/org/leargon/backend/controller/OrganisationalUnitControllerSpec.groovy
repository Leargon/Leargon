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
import org.leargon.backend.model.CreateClassificationRequest
import org.leargon.backend.model.CreateClassificationValueRequest
import org.leargon.backend.model.CreateOrganisationalUnitRequest
import org.leargon.backend.model.LocalizedText
import org.leargon.backend.model.LoginRequest
import org.leargon.backend.model.OrganisationalUnitResponse
import org.leargon.backend.model.OrganisationalUnitTreeResponse
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.model.UpdateOrgUnitLeadRequest
import org.leargon.backend.model.UpdateOrgUnitParentsRequest
import org.leargon.backend.model.UpdateOrgUnitTypeRequest
import org.leargon.backend.repository.ClassificationRepository
import org.leargon.backend.repository.ClassificationValueRepository
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

@MicronautTest(transactional = false)
class OrganisationalUnitControllerSpec extends Specification {

    @Inject
    @Client("/")
    HttpClient client

    @Inject
    UserRepository userRepository

    @Inject
    OrganisationalUnitRepository organisationalUnitRepository

    @Inject
    ClassificationRepository classificationRepository

    @Inject
    ClassificationValueRepository classificationValueRepository

    @Inject
    SupportedLocaleRepository localeRepository

    def setup() {
        ensureLocalesExist()
    }

    def cleanup() {
        // Clear join table first by clearing parents on all units
        def allUnits = organisationalUnitRepository.findAll()
        allUnits.each { unit ->
            if (unit.parents && !unit.parents.isEmpty()) {
                unit.parents.clear()
                organisationalUnitRepository.update(unit)
            }
        }
        organisationalUnitRepository.deleteAll()
        classificationValueRepository.deleteAll()
        classificationRepository.deleteAll()
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
            deLocale.displayName = "Deutsch"
            deLocale.isDefault = false
            deLocale.isActive = true
            deLocale.sortOrder = 2
            localeRepository.save(deLocale)
        }
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

    private Map createUserWithToken(String email, String username) {
        def signupRequest = new SignupRequest(email, username, "password123", "Test", "User")
        def signupResponse = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/signup", signupRequest),
                Map
        )
        def user = userRepository.findByEmail(email).get()
        return [token: signupResponse.body().accessToken, user: user]
    }

    // =====================
    // CREATE TESTS
    // =====================

    def "POST /organisational-units should create unit when admin"() {
        given: "an admin user"
        String adminToken = createAdminToken()

        and: "a valid create request"
        def request = new CreateOrganisationalUnitRequest([
                new LocalizedText("en", "Engineering"),
                new LocalizedText("de", "Technik")
        ])

        when: "creating an organisational unit"
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/organisational-units", request)
                        .bearerAuth(adminToken),
                OrganisationalUnitResponse
        )

        then: "response is successful"
        response.status == HttpStatus.CREATED

        and: "unit is created with correct data"
        def unit = response.body()
        unit.key == "engineering"
        unit.names.size() == 2
        unit.names.any { it.locale == "en" && it.text == "Engineering" }
        unit.names.any { it.locale == "de" && it.text == "Technik" }
    }

    def "POST /organisational-units should create unit with freetext type and descriptions"() {
        given: "an admin user"
        String adminToken = createAdminToken()

        and: "a create request with type and descriptions"
        def request = new CreateOrganisationalUnitRequest([new LocalizedText("en", "Marketing")])
        request.unitType = "Custom Department"
        request.descriptions = [new LocalizedText("en", "The marketing team")]

        when: "creating the unit"
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/organisational-units", request)
                        .bearerAuth(adminToken),
                OrganisationalUnitResponse
        )

        then: "unit has correct type and descriptions"
        response.body().unitType == "Custom Department"
        response.body().descriptions.size() == 1
        response.body().descriptions[0].text == "The marketing team"
    }

    def "POST /organisational-units should create unit with lead"() {
        given: "an admin user and another user"
        String adminToken = createAdminToken()
        createUserWithToken("lead@example.com", "leaduser")

        and: "a create request with lead"
        def request = new CreateOrganisationalUnitRequest([new LocalizedText("en", "Sales")])
        request.leadUsername = "leaduser"

        when: "creating the unit"
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/organisational-units", request)
                        .bearerAuth(adminToken),
                OrganisationalUnitResponse
        )

        then: "unit has correct lead"
        response.body().lead != null
        response.body().lead.username == "leaduser"
    }

    def "POST /organisational-units should return 400 without default locale"() {
        given: "an admin user"
        String adminToken = createAdminToken()

        and: "a request without English translation"
        def request = new CreateOrganisationalUnitRequest([new LocalizedText("de", "Nur Deutsch")])

        when: "creating unit without default locale"
        client.toBlocking().exchange(
                HttpRequest.POST("/organisational-units", request)
                        .bearerAuth(adminToken),
                OrganisationalUnitResponse
        )

        then: "bad request exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.BAD_REQUEST
    }

    def "POST /organisational-units should return 403 for non-admin"() {
        given: "a regular user"
        def userData = createUserWithToken("user@example.com", "user")

        and: "a create request"
        def request = new CreateOrganisationalUnitRequest([new LocalizedText("en", "Unit")])

        when: "non-admin tries to create unit"
        client.toBlocking().exchange(
                HttpRequest.POST("/organisational-units", request)
                        .bearerAuth(userData.token),
                OrganisationalUnitResponse
        )

        then: "forbidden exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.FORBIDDEN
    }

    // =====================
    // READ TESTS
    // =====================

    def "GET /organisational-units/{key} should return unit by key"() {
        given: "an admin user and a created unit"
        String adminToken = createAdminToken()
        def createRequest = new CreateOrganisationalUnitRequest([new LocalizedText("en", "Engineering")])
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/organisational-units", createRequest)
                        .bearerAuth(adminToken),
                OrganisationalUnitResponse
        )
        def unitKey = createResponse.body().key

        when: "getting unit by key"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/organisational-units/${unitKey}")
                        .bearerAuth(adminToken),
                OrganisationalUnitResponse
        )

        then: "response is successful"
        response.status == HttpStatus.OK
        response.body().key == unitKey
        response.body().names.find { it.locale == "en" }.text == "Engineering"
    }

    def "GET /organisational-units should return all units"() {
        given: "an admin user and multiple units"
        String adminToken = createAdminToken()
        client.toBlocking().exchange(
                HttpRequest.POST("/organisational-units", new CreateOrganisationalUnitRequest([new LocalizedText("en", "Unit A")]))
                        .bearerAuth(adminToken),
                OrganisationalUnitResponse
        )
        client.toBlocking().exchange(
                HttpRequest.POST("/organisational-units", new CreateOrganisationalUnitRequest([new LocalizedText("en", "Unit B")]))
                        .bearerAuth(adminToken),
                OrganisationalUnitResponse
        )

        when: "getting all units"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/organisational-units")
                        .bearerAuth(adminToken),
                Argument.listOf(OrganisationalUnitResponse)
        )

        then: "response is successful"
        response.status == HttpStatus.OK
        response.body().size() == 2
    }

    def "GET /organisational-units/tree should return hierarchical tree"() {
        given: "an admin user and a parent-child hierarchy"
        String adminToken = createAdminToken()
        def parentResponse = client.toBlocking().exchange(
                HttpRequest.POST("/organisational-units", new CreateOrganisationalUnitRequest([new LocalizedText("en", "Parent Unit")]))
                        .bearerAuth(adminToken),
                OrganisationalUnitResponse
        )
        def parentKey = parentResponse.body().key

        def childRequest = new CreateOrganisationalUnitRequest([new LocalizedText("en", "Child Unit")])
        childRequest.parentKeys = [parentKey]
        client.toBlocking().exchange(
                HttpRequest.POST("/organisational-units", childRequest)
                        .bearerAuth(adminToken),
                OrganisationalUnitResponse
        )

        when: "getting tree"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/organisational-units/tree")
                        .bearerAuth(adminToken),
                Argument.listOf(OrganisationalUnitTreeResponse)
        )

        then: "response shows hierarchy"
        response.status == HttpStatus.OK
        response.body().size() == 1
        response.body()[0].key == parentKey
        response.body()[0].children.size() == 1
    }

    // =====================
    // UPDATE TESTS
    // =====================

    def "PUT /organisational-units/{key}/names should update names and recompute key"() {
        given: "an admin user and a created unit"
        String adminToken = createAdminToken()
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/organisational-units", new CreateOrganisationalUnitRequest([new LocalizedText("en", "Original Name")]))
                        .bearerAuth(adminToken),
                OrganisationalUnitResponse
        )
        def unitKey = createResponse.body().key

        when: "updating names"
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/organisational-units/${unitKey}/names",
                        [new LocalizedText("en", "Updated Name")])
                        .bearerAuth(adminToken),
                OrganisationalUnitResponse
        )

        then: "response is successful with new key"
        response.status == HttpStatus.OK
        response.body().key == "updated-name"
        response.body().names.find { it.locale == "en" }.text == "Updated Name"
    }

    def "PUT /organisational-units/{key}/descriptions should update descriptions"() {
        given: "an admin user and a created unit"
        String adminToken = createAdminToken()
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/organisational-units", new CreateOrganisationalUnitRequest([new LocalizedText("en", "Desc Unit")]))
                        .bearerAuth(adminToken),
                OrganisationalUnitResponse
        )
        def unitKey = createResponse.body().key

        when: "updating descriptions"
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/organisational-units/${unitKey}/descriptions",
                        [new LocalizedText("en", "A great description")])
                        .bearerAuth(adminToken),
                OrganisationalUnitResponse
        )

        then: "descriptions are updated"
        response.status == HttpStatus.OK
        response.body().descriptions.size() == 1
        response.body().descriptions[0].text == "A great description"
    }

    def "PUT /organisational-units/{key}/type should update type with freetext"() {
        given: "an admin user and a created unit"
        String adminToken = createAdminToken()
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/organisational-units", new CreateOrganisationalUnitRequest([new LocalizedText("en", "Type Unit")]))
                        .bearerAuth(adminToken),
                OrganisationalUnitResponse
        )
        def unitKey = createResponse.body().key

        when: "updating type with freetext value"
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/organisational-units/${unitKey}/type",
                        new UpdateOrgUnitTypeRequest().unitType("Custom Squad"))
                        .bearerAuth(adminToken),
                OrganisationalUnitResponse
        )

        then: "type is updated"
        response.body().unitType == "Custom Squad"
    }

    def "PUT /organisational-units/{key}/lead should update lead"() {
        given: "an admin user and another user"
        String adminToken = createAdminToken()
        createUserWithToken("newlead@example.com", "newlead")

        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/organisational-units", new CreateOrganisationalUnitRequest([new LocalizedText("en", "Lead Unit")]))
                        .bearerAuth(adminToken),
                OrganisationalUnitResponse
        )
        def unitKey = createResponse.body().key

        when: "updating lead"
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/organisational-units/${unitKey}/lead",
                        new UpdateOrgUnitLeadRequest().leadUsername("newlead"))
                        .bearerAuth(adminToken),
                OrganisationalUnitResponse
        )

        then: "lead is updated"
        response.body().lead != null
        response.body().lead.username == "newlead"
    }

    def "PUT /organisational-units/{key}/parents should update parents"() {
        given: "an admin user and two units"
        String adminToken = createAdminToken()
        def parentResponse = client.toBlocking().exchange(
                HttpRequest.POST("/organisational-units", new CreateOrganisationalUnitRequest([new LocalizedText("en", "Parent Org")]))
                        .bearerAuth(adminToken),
                OrganisationalUnitResponse
        )
        def parentKey = parentResponse.body().key

        def childResponse = client.toBlocking().exchange(
                HttpRequest.POST("/organisational-units", new CreateOrganisationalUnitRequest([new LocalizedText("en", "Child Org")]))
                        .bearerAuth(adminToken),
                OrganisationalUnitResponse
        )
        def childKey = childResponse.body().key

        when: "setting parent"
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/organisational-units/${childKey}/parents",
                        new UpdateOrgUnitParentsRequest([parentKey]))
                        .bearerAuth(adminToken),
                OrganisationalUnitResponse
        )

        then: "parents are updated"
        response.body().parents.size() == 1
        response.body().parents[0].key == parentKey
    }

    def "PUT /organisational-units/{key}/parents should reject self-parent"() {
        given: "an admin user and a unit"
        String adminToken = createAdminToken()
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/organisational-units", new CreateOrganisationalUnitRequest([new LocalizedText("en", "Self Parent")]))
                        .bearerAuth(adminToken),
                OrganisationalUnitResponse
        )
        def unitKey = createResponse.body().key

        when: "trying to set self as parent"
        client.toBlocking().exchange(
                HttpRequest.PUT("/organisational-units/${unitKey}/parents",
                        new UpdateOrgUnitParentsRequest([unitKey]))
                        .bearerAuth(adminToken),
                OrganisationalUnitResponse
        )

        then: "bad request exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.BAD_REQUEST
    }

    def "PUT /organisational-units/{key}/names should return 403 for non-admin non-lead"() {
        given: "an admin creates a unit"
        String adminToken = createAdminToken()
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/organisational-units", new CreateOrganisationalUnitRequest([new LocalizedText("en", "Protected Unit")]))
                        .bearerAuth(adminToken),
                OrganisationalUnitResponse
        )
        def unitKey = createResponse.body().key

        and: "a regular user (not lead)"
        def userData = createUserWithToken("user@example.com", "user")

        when: "non-admin non-lead tries to update"
        client.toBlocking().exchange(
                HttpRequest.PUT("/organisational-units/${unitKey}/names",
                        [new LocalizedText("en", "Unauthorized")])
                        .bearerAuth(userData.token),
                OrganisationalUnitResponse
        )

        then: "forbidden exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.FORBIDDEN
    }

    // =====================
    // LEAD PERMISSION TESTS
    // =====================

    def "PUT /organisational-units/{key}/names should allow lead to update"() {
        given: "an admin creates a unit with a lead"
        String adminToken = createAdminToken()
        def leadData = createUserWithToken("lead@example.com", "leaduser")

        def createRequest = new CreateOrganisationalUnitRequest([new LocalizedText("en", "Lead Editable")])
        createRequest.leadUsername = "leaduser"
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/organisational-units", createRequest)
                        .bearerAuth(adminToken),
                OrganisationalUnitResponse
        )
        def unitKey = createResponse.body().key

        when: "lead updates names"
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/organisational-units/${unitKey}/names",
                        [new LocalizedText("en", "Lead Updated")])
                        .bearerAuth(leadData.token),
                OrganisationalUnitResponse
        )

        then: "response is successful"
        response.status == HttpStatus.OK
        response.body().names.find { it.locale == "en" }.text == "Lead Updated"
    }

    def "PUT /organisational-units/{key}/type should allow lead to update"() {
        given: "an admin creates a unit with a lead"
        String adminToken = createAdminToken()
        def leadData = createUserWithToken("lead@example.com", "leaduser")

        def createRequest = new CreateOrganisationalUnitRequest([new LocalizedText("en", "Lead Type Unit")])
        createRequest.leadUsername = "leaduser"
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/organisational-units", createRequest)
                        .bearerAuth(adminToken),
                OrganisationalUnitResponse
        )
        def unitKey = createResponse.body().key

        when: "lead updates type"
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/organisational-units/${unitKey}/type",
                        new UpdateOrgUnitTypeRequest().unitType("Lead Squad"))
                        .bearerAuth(leadData.token),
                OrganisationalUnitResponse
        )

        then: "type is updated"
        response.body().unitType == "Lead Squad"
    }

    def "DELETE /organisational-units/{key} should allow lead to delete"() {
        given: "an admin creates a unit with a lead"
        String adminToken = createAdminToken()
        def leadData = createUserWithToken("lead@example.com", "leaduser")

        def createRequest = new CreateOrganisationalUnitRequest([new LocalizedText("en", "Lead Deletable")])
        createRequest.leadUsername = "leaduser"
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/organisational-units", createRequest)
                        .bearerAuth(adminToken),
                OrganisationalUnitResponse
        )
        def unitKey = createResponse.body().key

        when: "lead deletes unit"
        def response = client.toBlocking().exchange(
                HttpRequest.DELETE("/organisational-units/${unitKey}")
                        .bearerAuth(leadData.token)
        )

        then: "response is successful"
        response.status == HttpStatus.NO_CONTENT
    }

    def "POST /organisational-units should allow lead to create child unit"() {
        given: "an admin creates a parent unit with a lead"
        String adminToken = createAdminToken()
        def leadData = createUserWithToken("lead@example.com", "leaduser")

        def parentRequest = new CreateOrganisationalUnitRequest([new LocalizedText("en", "Parent For Lead")])
        parentRequest.leadUsername = "leaduser"
        def parentResponse = client.toBlocking().exchange(
                HttpRequest.POST("/organisational-units", parentRequest)
                        .bearerAuth(adminToken),
                OrganisationalUnitResponse
        )
        def parentKey = parentResponse.body().key

        and: "a child create request with parentKeys"
        def childRequest = new CreateOrganisationalUnitRequest([new LocalizedText("en", "Lead Child")])
        childRequest.parentKeys = [parentKey]

        when: "lead creates child unit"
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/organisational-units", childRequest)
                        .bearerAuth(leadData.token),
                OrganisationalUnitResponse
        )

        then: "response is successful"
        response.status == HttpStatus.CREATED
        response.body().key == "lead-child"
        response.body().parents.size() == 1
        response.body().parents[0].key == parentKey
    }

    def "POST /organisational-units should return 403 for non-admin creating root unit"() {
        given: "a regular user (not admin)"
        def userData = createUserWithToken("user@example.com", "user")

        and: "a root create request (no parentKeys)"
        def request = new CreateOrganisationalUnitRequest([new LocalizedText("en", "Root Unit")])

        when: "non-admin tries to create root unit"
        client.toBlocking().exchange(
                HttpRequest.POST("/organisational-units", request)
                        .bearerAuth(userData.token),
                OrganisationalUnitResponse
        )

        then: "forbidden exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.FORBIDDEN
    }

    // =====================
    // DELETE TESTS
    // =====================

    def "DELETE /organisational-units/{key} should delete unit when admin"() {
        given: "an admin user and a created unit"
        String adminToken = createAdminToken()
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/organisational-units", new CreateOrganisationalUnitRequest([new LocalizedText("en", "ToDelete")]))
                        .bearerAuth(adminToken),
                OrganisationalUnitResponse
        )
        def unitKey = createResponse.body().key

        when: "deleting unit"
        def response = client.toBlocking().exchange(
                HttpRequest.DELETE("/organisational-units/${unitKey}")
                        .bearerAuth(adminToken)
        )

        then: "response is successful"
        response.status == HttpStatus.NO_CONTENT

        and: "unit is deleted"
        when:
        client.toBlocking().exchange(
                HttpRequest.GET("/organisational-units/${unitKey}")
                        .bearerAuth(adminToken),
                OrganisationalUnitResponse
        )
        then:
        thrown(HttpClientResponseException)
    }

    def "DELETE /organisational-units/{key} should return 404 for non-existent unit"() {
        given: "an admin user"
        String adminToken = createAdminToken()

        when: "deleting non-existent unit"
        client.toBlocking().exchange(
                HttpRequest.DELETE("/organisational-units/non-existent-key")
                        .bearerAuth(adminToken)
        )

        then: "not found exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.NOT_FOUND
    }

    def "DELETE /organisational-units/{key} should return 403 for non-admin non-lead"() {
        given: "an admin creates a unit"
        String adminToken = createAdminToken()
        def createResponse = client.toBlocking().exchange(
                HttpRequest.POST("/organisational-units", new CreateOrganisationalUnitRequest([new LocalizedText("en", "No Delete")]))
                        .bearerAuth(adminToken),
                OrganisationalUnitResponse
        )
        def unitKey = createResponse.body().key

        and: "a regular user (not lead)"
        def userData = createUserWithToken("user@example.com", "user")

        when: "non-admin non-lead tries to delete"
        client.toBlocking().exchange(
                HttpRequest.DELETE("/organisational-units/${unitKey}")
                        .bearerAuth(userData.token)
        )

        then: "forbidden exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.FORBIDDEN
    }

    // =====================
    // CLASSIFICATION TESTS
    // =====================

    def "PUT /organisational-units/{key}/classifications should assign classifications when admin"() {
        given: "an admin user, an org unit, and a classification"
        String adminToken = createAdminToken()

        def unitResponse = client.toBlocking().exchange(
                HttpRequest.POST("/organisational-units", new CreateOrganisationalUnitRequest([new LocalizedText("en", "Classifiable Unit")]))
                        .bearerAuth(adminToken),
                OrganisationalUnitResponse
        )
        String unitKey = unitResponse.body().key

        def classifResponse = client.toBlocking().exchange(
                HttpRequest.POST("/classifications",
                        new CreateClassificationRequest(
                                [new LocalizedText("en", "Risk Level")],
                                ClassificationAssignableTo.ORGANISATIONAL_UNIT
                        )).bearerAuth(adminToken),
                ClassificationResponse
        )
        String classifKey = classifResponse.body().key

        client.toBlocking().exchange(
                HttpRequest.POST("/classifications/${classifKey}/values",
                        new CreateClassificationValueRequest("low", [new LocalizedText("en", "Low")])
                ).bearerAuth(adminToken),
                ClassificationResponse
        )

        when: "assigning classification to org unit"
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/organisational-units/${unitKey}/classifications",
                        [new ClassificationAssignmentRequest(classifKey, "low")]
                ).bearerAuth(adminToken),
                OrganisationalUnitResponse
        )

        then: "assignment is successful"
        response.status == HttpStatus.OK
        def body = response.body()
        body.classificationAssignments != null
        body.classificationAssignments.size() == 1
        body.classificationAssignments[0].classificationKey == classifKey
        body.classificationAssignments[0].valueKey == "low"
    }

    def "PUT /organisational-units/{key}/classifications should allow lead to assign"() {
        given: "an admin creates a unit with a lead, and a classification"
        String adminToken = createAdminToken()
        def leadData = createUserWithToken("lead@example.com", "leaduser")

        def createRequest = new CreateOrganisationalUnitRequest([new LocalizedText("en", "Lead Classifiable")])
        createRequest.leadUsername = "leaduser"
        def unitResponse = client.toBlocking().exchange(
                HttpRequest.POST("/organisational-units", createRequest)
                        .bearerAuth(adminToken),
                OrganisationalUnitResponse
        )
        String unitKey = unitResponse.body().key

        def classifResponse = client.toBlocking().exchange(
                HttpRequest.POST("/classifications",
                        new CreateClassificationRequest(
                                [new LocalizedText("en", "Compliance")],
                                ClassificationAssignableTo.ORGANISATIONAL_UNIT
                        )).bearerAuth(adminToken),
                ClassificationResponse
        )
        String classifKey = classifResponse.body().key
        client.toBlocking().exchange(
                HttpRequest.POST("/classifications/${classifKey}/values",
                        new CreateClassificationValueRequest("yes", [new LocalizedText("en", "Yes")])
                ).bearerAuth(adminToken),
                ClassificationResponse
        )

        when: "lead assigns classification"
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/organisational-units/${unitKey}/classifications",
                        [new ClassificationAssignmentRequest(classifKey, "yes")]
                ).bearerAuth(leadData.token),
                OrganisationalUnitResponse
        )

        then: "assignment is successful"
        response.status == HttpStatus.OK
        response.body().classificationAssignments.size() == 1
    }

    def "PUT /organisational-units/{key}/classifications should return 403 for non-admin non-lead"() {
        given: "an admin creates a unit and a classification"
        String adminToken = createAdminToken()
        def userData = createUserWithToken("user@example.com", "user")

        def unitResponse = client.toBlocking().exchange(
                HttpRequest.POST("/organisational-units", new CreateOrganisationalUnitRequest([new LocalizedText("en", "Forbidden Unit")]))
                        .bearerAuth(adminToken),
                OrganisationalUnitResponse
        )
        String unitKey = unitResponse.body().key

        def classifResponse = client.toBlocking().exchange(
                HttpRequest.POST("/classifications",
                        new CreateClassificationRequest(
                                [new LocalizedText("en", "Forbidden Class")],
                                ClassificationAssignableTo.ORGANISATIONAL_UNIT
                        )).bearerAuth(adminToken),
                ClassificationResponse
        )
        String classifKey = classifResponse.body().key
        client.toBlocking().exchange(
                HttpRequest.POST("/classifications/${classifKey}/values",
                        new CreateClassificationValueRequest("v1", [new LocalizedText("en", "V1")])
                ).bearerAuth(adminToken),
                ClassificationResponse
        )

        when: "non-admin non-lead tries to assign"
        client.toBlocking().exchange(
                HttpRequest.PUT("/organisational-units/${unitKey}/classifications",
                        [new ClassificationAssignmentRequest(classifKey, "v1")]
                ).bearerAuth(userData.token),
                OrganisationalUnitResponse
        )

        then: "forbidden exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.FORBIDDEN
    }

    def "PUT /organisational-units/{key}/classifications should return 400 for wrong assignable type"() {
        given: "an admin creates a unit and a BUSINESS_ENTITY classification"
        String adminToken = createAdminToken()

        def unitResponse = client.toBlocking().exchange(
                HttpRequest.POST("/organisational-units", new CreateOrganisationalUnitRequest([new LocalizedText("en", "Type Check Unit")]))
                        .bearerAuth(adminToken),
                OrganisationalUnitResponse
        )
        String unitKey = unitResponse.body().key

        def classifResponse = client.toBlocking().exchange(
                HttpRequest.POST("/classifications",
                        new CreateClassificationRequest(
                                [new LocalizedText("en", "Entity Only Class")],
                                ClassificationAssignableTo.BUSINESS_ENTITY
                        )).bearerAuth(adminToken),
                ClassificationResponse
        )
        String classifKey = classifResponse.body().key
        client.toBlocking().exchange(
                HttpRequest.POST("/classifications/${classifKey}/values",
                        new CreateClassificationValueRequest("v1", [new LocalizedText("en", "V1")])
                ).bearerAuth(adminToken),
                ClassificationResponse
        )

        when: "trying to assign entity classification to org unit"
        client.toBlocking().exchange(
                HttpRequest.PUT("/organisational-units/${unitKey}/classifications",
                        [new ClassificationAssignmentRequest(classifKey, "v1")]
                ).bearerAuth(adminToken),
                OrganisationalUnitResponse
        )

        then: "bad request exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.BAD_REQUEST
    }

    def "PUT /organisational-units/{key}/classifications should clear assignments when empty list sent"() {
        given: "an admin creates a unit with an existing classification"
        String adminToken = createAdminToken()

        def unitResponse = client.toBlocking().exchange(
                HttpRequest.POST("/organisational-units", new CreateOrganisationalUnitRequest([new LocalizedText("en", "Clear Unit")]))
                        .bearerAuth(adminToken),
                OrganisationalUnitResponse
        )
        String unitKey = unitResponse.body().key

        def classifResponse = client.toBlocking().exchange(
                HttpRequest.POST("/classifications",
                        new CreateClassificationRequest(
                                [new LocalizedText("en", "Clearable Class")],
                                ClassificationAssignableTo.ORGANISATIONAL_UNIT
                        )).bearerAuth(adminToken),
                ClassificationResponse
        )
        String classifKey = classifResponse.body().key
        client.toBlocking().exchange(
                HttpRequest.POST("/classifications/${classifKey}/values",
                        new CreateClassificationValueRequest("v1", [new LocalizedText("en", "V1")])
                ).bearerAuth(adminToken),
                ClassificationResponse
        )

        client.toBlocking().exchange(
                HttpRequest.PUT("/organisational-units/${unitKey}/classifications",
                        [new ClassificationAssignmentRequest(classifKey, "v1")]
                ).bearerAuth(adminToken),
                OrganisationalUnitResponse
        )

        when: "sending empty classification list"
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/organisational-units/${unitKey}/classifications", [])
                        .bearerAuth(adminToken),
                OrganisationalUnitResponse
        )

        then: "assignments are cleared"
        response.status == HttpStatus.OK
        response.body().classificationAssignments == null || response.body().classificationAssignments.isEmpty()
    }
}
