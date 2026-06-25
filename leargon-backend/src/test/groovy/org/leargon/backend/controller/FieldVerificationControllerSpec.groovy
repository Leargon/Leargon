package org.leargon.backend.controller

import io.micronaut.core.type.Argument
import io.micronaut.http.HttpRequest
import io.micronaut.http.HttpStatus
import io.micronaut.http.client.HttpClient
import io.micronaut.http.client.annotation.Client
import io.micronaut.http.client.exceptions.HttpClientResponseException
import io.micronaut.test.extensions.spock.annotation.MicronautTest
import jakarta.inject.Inject
import org.leargon.backend.domain.FieldConfiguration
import org.leargon.backend.domain.SupportedLocale
import org.leargon.backend.model.BusinessEntityResponse
import org.leargon.backend.model.CreateBusinessEntityRequest
import org.leargon.backend.model.FieldVerificationResponseStatus
import org.leargon.backend.model.LocalizedText
import org.leargon.backend.model.LoginRequest
import org.leargon.backend.model.SetFieldVerificationRequest
import org.leargon.backend.model.SetFieldVerificationRequestStatus
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.BusinessEntityVersionRepository
import org.leargon.backend.repository.FieldConfigurationRepository
import org.leargon.backend.repository.FieldVerificationRepository
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

@MicronautTest(transactional = false)
class FieldVerificationControllerSpec extends Specification {

    @Inject
    @Client("/")
    HttpClient client

    @Inject UserRepository userRepository
    @Inject BusinessEntityRepository businessEntityRepository
    @Inject BusinessEntityVersionRepository businessEntityVersionRepository
    @Inject FieldVerificationRepository fieldVerificationRepository
    @Inject OrganisationalUnitRepository organisationalUnitRepository
    @Inject FieldConfigurationRepository fieldConfigurationRepository
    @Inject SupportedLocaleRepository localeRepository

    def setup() {
        if (localeRepository.count() == 0) {
            localeRepository.save(new SupportedLocale(localeCode: "en", displayName: "English", isDefault: true, isActive: true, sortOrder: 1))
            localeRepository.save(new SupportedLocale(localeCode: "de", displayName: "Deutsch", isDefault: false, isActive: true, sortOrder: 2))
        }
        // Verification defaults to OFF — enable it for entities (Data Governance) so these tests exercise it.
        enableVerification("DATA_GOVERNANCE")
    }

    /** Seed the marker row that turns per-area verification ON (default is off). */
    private void enableVerification(String methodologyKey) {
        fieldConfigurationRepository.save(new FieldConfiguration(
                entityType: "METHODOLOGY_VERIFICATION", fieldName: methodologyKey,
                visibility: "SHOWN", section: "METHODOLOGY", maturityLevel: "BASIC"))
    }

    def cleanup() {
        fieldVerificationRepository.deleteAll()
        businessEntityVersionRepository.deleteAll()
        businessEntityRepository.deleteAll()
        organisationalUnitRepository.deleteAll()
        fieldConfigurationRepository.deleteByEntityType("METHODOLOGY")
        fieldConfigurationRepository.deleteByEntityType("METHODOLOGY_VERIFICATION")
        userRepository.deleteAll()
    }

    /** Toggle per-area verification via the admin methodology-config endpoint (default is off). */
    private void setVerification(String adminToken, String methodologyKey, boolean enabled) {
        def keys = ["DATA_GOVERNANCE", "PROCESS_GOVERNANCE", "GDPR", "DDD", "BCM", "TEAM_TOPOLOGIES"]
        def entries = keys.collect { [key: it, enabled: true, verificationEnabled: it == methodologyKey ? enabled : false] }
        client.toBlocking().exchange(
                HttpRequest.PUT("/administration/methodology-configurations", entries).bearerAuth(adminToken),
                Argument.listOf(Map))
    }

    private String signupToken(String email, String username) {
        def resp = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/signup", new SignupRequest(email, username, "password123", "Test", "User")),
                Map)
        return resp.body().accessToken
    }

    private String adminToken() {
        client.toBlocking().exchange(HttpRequest.POST("/authentication/signup",
                new SignupRequest("admin@test.com", "admin", "password123", "Admin", "User")))
        def user = userRepository.findByEmail("admin@test.com").get()
        user.roles = "ROLE_USER,ROLE_ADMIN"
        userRepository.update(user)
        def login = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/login", new LoginRequest("admin@test.com", "password123")), Map)
        return login.body().accessToken
    }

    private BusinessEntityResponse createEntity(String token) {
        client.toBlocking().exchange(
                HttpRequest.POST("/business-entities",
                        new CreateBusinessEntityRequest([new LocalizedText("en", "Customer"), new LocalizedText("de", "Kunde")]))
                        .bearerAuth(token),
                BusinessEntityResponse).body()
    }

    private BusinessEntityResponse getEntity(String key, String token) {
        client.toBlocking().exchange(
                HttpRequest.GET("/business-entities/${key}").bearerAuth(token), BusinessEntityResponse).body()
    }

    private statusOf(BusinessEntityResponse entity, String fieldName) {
        entity.fieldStatuses?.find { it.fieldName == fieldName }
    }

    def "owner-created entity has its fields VERIFIED with who/when"() {
        given:
        def token = signupToken("owner@test.com", "owner")

        when:
        def entity = createEntity(token)

        then: "name fields are verified by the creating owner"
        def nameEn = statusOf(entity, "names.en")
        nameEn != null
        nameEn.status == FieldVerificationResponseStatus.VERIFIED
        nameEn.updatedByUsername == "owner"
        nameEn.updatedAt != null
    }

    def "admin edit (non-owner) flips the changed field to UNVERIFIED"() {
        given: "an entity owned by 'owner'"
        def ownerToken = signupToken("owner@test.com", "owner")
        def entity = createEntity(ownerToken)
        def admin = adminToken()

        when: "an admin changes the German name (keeps the key stable)"
        def updated = client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${entity.key}/names",
                        [new LocalizedText("en", "Customer"), new LocalizedText("de", "Klient")])
                        .bearerAuth(admin),
                BusinessEntityResponse).body()

        then: "the changed locale is now unverified and attributed to the admin"
        def nameDe = statusOf(updated, "names.de")
        nameDe.status == FieldVerificationResponseStatus.UNVERIFIED
        nameDe.updatedByUsername == "admin"

        and: "the unchanged English locale stays verified by the owner"
        def nameEn = statusOf(updated, "names.en")
        nameEn.status == FieldVerificationResponseStatus.VERIFIED
        nameEn.updatedByUsername == "owner"
    }

    def "owner can set a field status via the endpoint"() {
        given:
        def token = signupToken("owner@test.com", "owner")
        def entity = createEntity(token)

        when: "owner resets names.en to UNVERIFIED"
        def resp = client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${entity.key}/field-verifications",
                        new SetFieldVerificationRequest("names.en", SetFieldVerificationRequestStatus.UNVERIFIED))
                        .bearerAuth(token),
                BusinessEntityResponse)

        then:
        resp.status == HttpStatus.OK
        statusOf(resp.body(), "names.en").status == FieldVerificationResponseStatus.UNVERIFIED

        when: "owner verifies it again"
        def resp2 = client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${entity.key}/field-verifications",
                        new SetFieldVerificationRequest("names.en", SetFieldVerificationRequestStatus.VERIFIED))
                        .bearerAuth(token),
                BusinessEntityResponse)

        then:
        statusOf(resp2.body(), "names.en").status == FieldVerificationResponseStatus.VERIFIED
    }

    def "a non-owner cannot set a field status (403)"() {
        given:
        def ownerToken = signupToken("owner@test.com", "owner")
        def entity = createEntity(ownerToken)
        def otherToken = signupToken("other@test.com", "other")

        when:
        client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${entity.key}/field-verifications",
                        new SetFieldVerificationRequest("names.en", SetFieldVerificationRequestStatus.VERIFIED))
                        .bearerAuth(otherToken),
                BusinessEntityResponse)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }

    def "disabling verification for the area hides fieldStatuses; re-enabling restores them"() {
        given: "an owner-created entity whose name is VERIFIED"
        def ownerToken = signupToken("owner@test.com", "owner")
        def entity = createEntity(ownerToken)
        def admin = adminToken()
        assert statusOf(entity, "names.en")?.status == FieldVerificationResponseStatus.VERIFIED

        when: "verification is disabled for Data Governance (entities)"
        setVerification(admin, "DATA_GOVERNANCE", false)
        def whileOff = getEntity(entity.key, ownerToken)

        then: "no field statuses are surfaced"
        whileOff.fieldStatuses == null

        when: "verification is re-enabled"
        setVerification(admin, "DATA_GOVERNANCE", true)
        def restored = getEntity(entity.key, ownerToken)

        then: "the stored statuses reappear exactly as before"
        statusOf(restored, "names.en")?.status == FieldVerificationResponseStatus.VERIFIED
        statusOf(restored, "names.en")?.updatedByUsername == "owner"
    }

    def "setFieldVerification returns 403 when verification is disabled for the area"() {
        given:
        def ownerToken = signupToken("owner@test.com", "owner")
        def entity = createEntity(ownerToken)
        def admin = adminToken()
        setVerification(admin, "DATA_GOVERNANCE", false)

        when: "the owner tries to set a status"
        client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${entity.key}/field-verifications",
                        new SetFieldVerificationRequest("names.en", SetFieldVerificationRequestStatus.VERIFIED))
                        .bearerAuth(ownerToken),
                BusinessEntityResponse)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }

    def "edits made while verification is disabled surface as UNVERIFIED on re-enable (sync keeps running)"() {
        given: "an owner-created entity, then verification disabled for entities"
        def ownerToken = signupToken("owner@test.com", "owner")
        def entity = createEntity(ownerToken)
        def admin = adminToken()
        setVerification(admin, "DATA_GOVERNANCE", false)

        when: "an admin (non-owner) changes the German name while verification is off"
        client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${entity.key}/names",
                        [new LocalizedText("en", "Customer"), new LocalizedText("de", "Klient")])
                        .bearerAuth(admin),
                BusinessEntityResponse)
        setVerification(admin, "DATA_GOVERNANCE", true)
        def restored = getEntity(entity.key, ownerToken)

        then: "the field changed while off comes back UNVERIFIED (not frozen at its old status)"
        statusOf(restored, "names.de")?.status == FieldVerificationResponseStatus.UNVERIFIED
        statusOf(restored, "names.de")?.updatedByUsername == "admin"

        and: "the untouched English name remains VERIFIED by the owner"
        statusOf(restored, "names.en")?.status == FieldVerificationResponseStatus.VERIFIED
        statusOf(restored, "names.en")?.updatedByUsername == "owner"
    }

    def "unauthenticated request is rejected (401)"() {
        given:
        def ownerToken = signupToken("owner@test.com", "owner")
        def entity = createEntity(ownerToken)

        when:
        client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${entity.key}/field-verifications",
                        new SetFieldVerificationRequest("names.en", SetFieldVerificationRequestStatus.VERIFIED)),
                BusinessEntityResponse)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.UNAUTHORIZED
    }
}
