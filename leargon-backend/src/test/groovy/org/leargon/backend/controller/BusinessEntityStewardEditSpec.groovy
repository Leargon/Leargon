package org.leargon.backend.controller

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

/**
 * Layer 1 — steward edit rights. A steward edits like an owner but is never the effective owner,
 * so the verification mechanism (unchanged) treats steward edits as non-owner edits: changed
 * fields flip to UNVERIFIED, and the owner-only verify endpoint rejects the steward (403).
 */
@MicronautTest(transactional = false)
class BusinessEntityStewardEditSpec extends Specification {

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
        fieldConfigurationRepository.save(new FieldConfiguration(
                entityType: "METHODOLOGY_VERIFICATION", fieldName: "DATA_GOVERNANCE",
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

    private String signupToken(String email, String username, String roles = "ROLE_USER") {
        def resp = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/signup", new SignupRequest(email, username, "password123", "Test", "User")),
                Map)
        def u = userRepository.findByEmail(email).get()
        u.roles = roles
        userRepository.update(u)
        return resp.body().accessToken
    }

    private BusinessEntityResponse createEntity(String token) {
        client.toBlocking().exchange(
                HttpRequest.POST("/business-entities",
                        new CreateBusinessEntityRequest([new LocalizedText("en", "Customer"), new LocalizedText("de", "Kunde")]))
                        .bearerAuth(token),
                BusinessEntityResponse).body()
    }

    private void assignSteward(String key, String ownerToken, String stewardUsername) {
        client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${key}/data-steward", [dataStewardUsername: stewardUsername]).bearerAuth(ownerToken),
                BusinessEntityResponse)
    }

    private statusOf(BusinessEntityResponse entity, String fieldName) {
        entity.fieldStatuses?.find { it.fieldName == fieldName }
    }

    def "steward can edit a field but the change lands UNVERIFIED (steward is not the owner)"() {
        given: "an entity owned by 'owner' with 'steward' assigned as data steward"
        def ownerToken = signupToken("owner@test.com", "owner", "ROLE_USER,ROLE_EDITOR_DATA_GOVERNANCE")
        def stewardToken = signupToken("steward@test.com", "steward")
        def entity = createEntity(ownerToken)
        assignSteward(entity.key, ownerToken, "steward")

        when: "the steward changes the German name (keeps the key stable)"
        def updated = client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${entity.key}/names",
                        [new LocalizedText("en", "Customer"), new LocalizedText("de", "Klient")])
                        .bearerAuth(stewardToken),
                BusinessEntityResponse).body()

        then: "the edit is accepted and the changed field is UNVERIFIED, attributed to the steward"
        def nameDe = statusOf(updated, "names.de")
        nameDe.status == FieldVerificationResponseStatus.UNVERIFIED
        nameDe.updatedByUsername == "steward"

        and: "the untouched English name stays VERIFIED by the owner"
        statusOf(updated, "names.en").status == FieldVerificationResponseStatus.VERIFIED
        statusOf(updated, "names.en").updatedByUsername == "owner"
    }

    def "steward cannot set a field verification status (403)"() {
        given:
        def ownerToken = signupToken("owner@test.com", "owner", "ROLE_USER,ROLE_EDITOR_DATA_GOVERNANCE")
        def stewardToken = signupToken("steward@test.com", "steward")
        def entity = createEntity(ownerToken)
        assignSteward(entity.key, ownerToken, "steward")

        when: "the steward tries to verify a field"
        client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${entity.key}/field-verifications",
                        new SetFieldVerificationRequest("names.en", SetFieldVerificationRequestStatus.VERIFIED))
                        .bearerAuth(stewardToken),
                BusinessEntityResponse)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }

    def "a user who is neither owner, steward, nor admin cannot edit (403)"() {
        given:
        def ownerToken = signupToken("owner@test.com", "owner", "ROLE_USER,ROLE_EDITOR_DATA_GOVERNANCE")
        def otherToken = signupToken("other@test.com", "other")
        def entity = createEntity(ownerToken)

        when:
        client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${entity.key}/names",
                        [new LocalizedText("en", "Customer"), new LocalizedText("de", "Klient")])
                        .bearerAuth(otherToken),
                BusinessEntityResponse)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }
}
