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
import org.leargon.backend.model.CreateProcessRequest
import org.leargon.backend.model.LocalizedText
import org.leargon.backend.model.LoginRequest
import org.leargon.backend.model.SetFieldVerificationRequest
import org.leargon.backend.model.SetFieldVerificationRequestStatus
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.model.UpdateUserRequest
import org.leargon.backend.repository.FieldConfigurationRepository
import org.leargon.backend.repository.FieldVerificationRepository
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.repository.ProcessVersionRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

/**
 * Layer 2 — methodology-scoped EDITOR / LEAD roles.
 *  - EDITOR_M may edit content fields whose methodology is M, on any object regardless of ownership.
 *    Being a non-owner, the edit flips the field to UNVERIFIED and the verify endpoint rejects them (403).
 *  - LEAD_M additionally manages M's configuration (methodology enable/disable + field configuration),
 *    scoped to M only — touching another methodology's configuration is rejected (403).
 * Verification stays owner-only and is unchanged.
 */
@MicronautTest(transactional = false)
class RoleBasedEditSpec extends Specification {

    @Inject
    @Client("/")
    HttpClient client

    @Inject UserRepository userRepository
    @Inject ProcessRepository processRepository
    @Inject ProcessVersionRepository processVersionRepository
    @Inject FieldVerificationRepository fieldVerificationRepository
    @Inject OrganisationalUnitRepository organisationalUnitRepository
    @Inject FieldConfigurationRepository fieldConfigurationRepository
    @Inject SupportedLocaleRepository localeRepository

    def setup() {
        if (localeRepository.count() == 0) {
            localeRepository.save(new SupportedLocale(localeCode: "en", displayName: "English", isDefault: true, isActive: true, sortOrder: 1))
            localeRepository.save(new SupportedLocale(localeCode: "de", displayName: "Deutsch", isDefault: false, isActive: true, sortOrder: 2))
        }
        // Enable verification for processes (governed by PROCESS_GOVERNANCE) so edits exercise the UNVERIFIED flip.
        fieldConfigurationRepository.save(new FieldConfiguration(
                entityType: "METHODOLOGY_VERIFICATION", fieldName: "PROCESS_GOVERNANCE",
                visibility: "SHOWN", section: "METHODOLOGY", maturityLevel: "BASIC"))
    }

    def cleanup() {
        fieldVerificationRepository.deleteAll()
        processVersionRepository.deleteAll()
        processRepository.deleteAll()
        organisationalUnitRepository.deleteAll()
        fieldConfigurationRepository.deleteByEntityType("METHODOLOGY")
        fieldConfigurationRepository.deleteByEntityType("METHODOLOGY_VERIFICATION")
        userRepository.deleteAll()
    }

    private String signupToken(String email, String username) {
        client.toBlocking().exchange(
                HttpRequest.POST("/authentication/signup", new SignupRequest(email, username, "password123", "Test", "User")),
                Map).body().accessToken
    }

    private String tokenWithRoles(String email, String username, String roles) {
        def token = signupToken(email, username)
        def u = userRepository.findByEmail(email).get()
        u.roles = roles
        userRepository.update(u)
        return token
    }

    private String adminToken() {
        signupToken("admin@test.com", "admin")
        def u = userRepository.findByEmail("admin@test.com").get()
        u.roles = "ROLE_USER,ROLE_ADMIN"
        userRepository.update(u)
        client.toBlocking().exchange(
                HttpRequest.POST("/authentication/login", new LoginRequest("admin@test.com", "password123")),
                Map).body().accessToken
    }

    private Map createProcess(String token) {
        client.toBlocking().exchange(
                HttpRequest.POST("/processes", new CreateProcessRequest([new LocalizedText("en", "Order Fulfillment")])).bearerAuth(token),
                Map).body()
    }

    private statusOf(Map process, String fieldName) {
        process.fieldStatuses?.find { it.fieldName == fieldName }
    }

    /** Current methodology config as the frontend would re-submit it (full state, preserving verification flags). */
    private List<Map> currentMethodologyEntries(String token) {
        client.toBlocking().exchange(
                HttpRequest.GET("/administration/methodology-configurations").bearerAuth(token),
                Argument.listOf(Map)).body()
                .collect { [key: it.key, enabled: it.enabled, verificationEnabled: it.verificationEnabled] }
    }

    // ── EDITOR ────────────────────────────────────────────────────────────────

    def "EDITOR_GDPR can edit a GDPR field and the change lands UNVERIFIED"() {
        given:
        def ownerToken = tokenWithRoles("owner@test.com", "owner", "ROLE_USER,ROLE_EDITOR_PROCESS_GOVERNANCE")
        def editorToken = tokenWithRoles("editor@test.com", "editor", "ROLE_USER,ROLE_EDITOR_GDPR")
        def process = createProcess(ownerToken)

        when: "the GDPR editor sets the legal basis (a GDPR-section field)"
        def updated = client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${process.key}/legal-basis", [legalBasis: "CONSENT"]).bearerAuth(editorToken),
                Map).body()

        then: "accepted, and the field is UNVERIFIED attributed to the editor (a non-owner)"
        updated.legalBasis == "CONSENT"
        statusOf(updated, "legalBasis").status == "UNVERIFIED"
        statusOf(updated, "legalBasis").updatedByUsername == "editor"
    }

    def "EDITOR_GDPR cannot edit a non-GDPR field (403)"() {
        given:
        def ownerToken = tokenWithRoles("owner@test.com", "owner", "ROLE_USER,ROLE_EDITOR_PROCESS_GOVERNANCE")
        def editorToken = tokenWithRoles("editor@test.com", "editor", "ROLE_USER,ROLE_EDITOR_GDPR")
        def process = createProcess(ownerToken)

        when: "the GDPR editor tries to change the process type (CORE, not GDPR)"
        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${process.key}/type", [processType: "MANAGEMENT"]).bearerAuth(editorToken),
                Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }

    def "EDITOR_GDPR cannot verify a field (403)"() {
        given:
        def ownerToken = tokenWithRoles("owner@test.com", "owner", "ROLE_USER,ROLE_EDITOR_PROCESS_GOVERNANCE")
        def editorToken = tokenWithRoles("editor@test.com", "editor", "ROLE_USER,ROLE_EDITOR_GDPR")
        def process = createProcess(ownerToken)

        when:
        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${process.key}/field-verifications",
                        new SetFieldVerificationRequest("legalBasis", SetFieldVerificationRequestStatus.VERIFIED)).bearerAuth(editorToken),
                Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }

    // ── LEAD ──────────────────────────────────────────────────────────────────

    def "LEAD_GDPR can edit a GDPR field (UNVERIFIED) but cannot verify (403)"() {
        given:
        def ownerToken = tokenWithRoles("owner@test.com", "owner", "ROLE_USER,ROLE_EDITOR_PROCESS_GOVERNANCE")
        def leadToken = tokenWithRoles("lead@test.com", "lead", "ROLE_USER,ROLE_LEAD_GDPR")
        def process = createProcess(ownerToken)

        when: "the GDPR lead edits the legal basis"
        def updated = client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${process.key}/legal-basis", [legalBasis: "CONTRACT"]).bearerAuth(leadToken),
                Map).body()

        then: "edit accepted and UNVERIFIED (lead is still a non-owner)"
        statusOf(updated, "legalBasis").status == "UNVERIFIED"

        when: "the lead tries to verify"
        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${process.key}/field-verifications",
                        new SetFieldVerificationRequest("legalBasis", SetFieldVerificationRequestStatus.VERIFIED)).bearerAuth(leadToken),
                Map)

        then: "rejected — verification is owner-only"
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }

    def "LEAD_GDPR can change GDPR methodology config but not DDD (403)"() {
        given:
        def leadToken = tokenWithRoles("lead@test.com", "lead", "ROLE_USER,ROLE_LEAD_GDPR")

        when: "the lead disables GDPR (their own methodology), leaving the rest unchanged"
        def entries = currentMethodologyEntries(leadToken).collect { it.key == "GDPR" ? (it + [enabled: false]) : it }
        def body = client.toBlocking().exchange(
                HttpRequest.PUT("/administration/methodology-configurations", entries).bearerAuth(leadToken),
                Argument.listOf(Map)).body()

        then: "accepted and GDPR is now disabled"
        body.find { it.key == "GDPR" }.enabled == false

        when: "the lead tries to disable DDD (outside their scope)"
        def dddEntries = currentMethodologyEntries(leadToken).collect { it.key == "DDD" ? (it + [enabled: false]) : it }
        client.toBlocking().exchange(
                HttpRequest.PUT("/administration/methodology-configurations", dddEntries).bearerAuth(leadToken),
                Argument.listOf(Map))

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }

    def "EDITOR_GDPR cannot change any methodology config (403)"() {
        given:
        def editorToken = tokenWithRoles("editor@test.com", "editor", "ROLE_USER,ROLE_EDITOR_GDPR")

        when: "an editor (no lead scope) tries to change methodology config"
        def entries = currentMethodologyEntries(editorToken).collect { it.key == "GDPR" ? (it + [enabled: false]) : it }
        client.toBlocking().exchange(
                HttpRequest.PUT("/administration/methodology-configurations", entries).bearerAuth(editorToken),
                Argument.listOf(Map))

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }

    // ── ROLE ASSIGNMENT (openapi + validation) ──────────────────────────────────

    def "admin can assign a scoped role and it persists"() {
        given:
        def token = adminToken()
        signupToken("target@test.com", "target")
        def targetId = userRepository.findByEmail("target@test.com").get().id

        when:
        def req = new UpdateUserRequest()
        req.roles = ["ROLE_USER", "ROLE_LEAD_GDPR"]
        def updated = client.toBlocking().exchange(
                HttpRequest.PUT("/administration/users/${targetId}", req).bearerAuth(token),
                Map).body()

        then:
        updated.roles.contains("ROLE_LEAD_GDPR")
        updated.roles.contains("ROLE_USER")
    }

    def "assigning an unknown role token is rejected (400)"() {
        given:
        def token = adminToken()
        signupToken("target@test.com", "target")
        def targetId = userRepository.findByEmail("target@test.com").get().id

        when:
        def req = new UpdateUserRequest()
        req.roles = ["ROLE_LEAD_NONSENSE"]
        client.toBlocking().exchange(
                HttpRequest.PUT("/administration/users/${targetId}", req).bearerAuth(token),
                Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.BAD_REQUEST
    }
}
