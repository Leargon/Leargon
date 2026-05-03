package org.leargon.backend.controller

import io.micronaut.http.HttpRequest
import io.micronaut.http.HttpStatus
import io.micronaut.http.client.HttpClient
import io.micronaut.http.client.annotation.Client
import io.micronaut.http.client.exceptions.HttpClientResponseException
import io.micronaut.test.extensions.spock.annotation.MicronautTest
import jakarta.inject.Inject
import org.leargon.backend.domain.SupportedLocale
import org.leargon.backend.model.LoginRequest
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.repository.OrganisationSettingsRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

@MicronautTest(transactional = false)
class OrganisationSettingsControllerSpec extends Specification {

    @Inject @Client("/") HttpClient client
    @Inject UserRepository userRepository
    @Inject OrganisationSettingsRepository organisationSettingsRepository
    @Inject SupportedLocaleRepository localeRepository

    def setup() {
        if (localeRepository.count() == 0) {
            localeRepository.save(new SupportedLocale(
                localeCode: "en", displayName: "English", isDefault: true, isActive: true, sortOrder: 1))
        }
    }

    def cleanup() {
        organisationSettingsRepository.deleteAll()
        userRepository.deleteAll()
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private Map createUserWithToken(String email, String username) {
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/authentication/signup",
                new SignupRequest(email, username, "password123", "Test", "User")), Map)
        [token: resp.body().accessToken]
    }

    private String createAdminToken(String email = "admin@orgsettings.com", String username = "orgSettingsAdmin") {
        client.toBlocking().exchange(
            HttpRequest.POST("/authentication/signup",
                new SignupRequest(email, username, "password123", "Admin", "User")))
        def user = userRepository.findByEmail(email).get()
        user.roles = "ROLE_USER,ROLE_ADMIN"
        userRepository.update(user)
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/authentication/login",
                new LoginRequest(email, "password123")), Map)
        resp.body().accessToken
    }

    // ─── GET /administration/organisation-settings ────────────────────────────

    def "GET /administration/organisation-settings returns empty settings when none exist"() {
        given:
        String token = createAdminToken()

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.GET("/administration/organisation-settings").bearerAuth(token), Map)

        then:
        response.status == HttpStatus.OK
        response.body().euRepresentative == null
        response.body().dataProtectionOfficer == null
    }

    def "GET /administration/organisation-settings returns 401 without auth"() {
        when:
        client.toBlocking().exchange(HttpRequest.GET("/administration/organisation-settings"), Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.UNAUTHORIZED
    }

    // ─── PUT /administration/organisation-settings ────────────────────────────

    def "PUT /administration/organisation-settings updates settings as admin"() {
        given:
        String adminToken = createAdminToken()
        def body = [
            euRepresentative: "Max Muster, Musterstrasse 1",
            dataProtectionOfficer: "Dr. Jane Doe, datenschutz@example.com"
        ]

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.PUT("/administration/organisation-settings", body).bearerAuth(adminToken), Map)

        then:
        response.status == HttpStatus.OK
        response.body().euRepresentative == "Max Muster, Musterstrasse 1"
        response.body().dataProtectionOfficer == "Dr. Jane Doe, datenschutz@example.com"
    }

    def "PUT /administration/organisation-settings is idempotent (updates existing)"() {
        given:
        String adminToken = createAdminToken()
        client.toBlocking().exchange(
            HttpRequest.PUT("/administration/organisation-settings",
                [euRepresentative: "First Value"]).bearerAuth(adminToken), Map)

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.PUT("/administration/organisation-settings",
                [euRepresentative: "Updated Value", dataProtectionOfficer: "New DPO"]).bearerAuth(adminToken), Map)

        then:
        response.status == HttpStatus.OK
        response.body().euRepresentative == "Updated Value"
        response.body().dataProtectionOfficer == "New DPO"
        organisationSettingsRepository.count() == 1
    }

    def "PUT /administration/organisation-settings returns 403 for non-admin"() {
        given:
        def userData = createUserWithToken("user@orgsettings.com", "orguser")

        when:
        client.toBlocking().exchange(
            HttpRequest.PUT("/administration/organisation-settings",
                [euRepresentative: "Test"]).bearerAuth(userData.token), Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }

    def "GET /administration/organisation-settings reflects PUT changes"() {
        given:
        String adminToken = createAdminToken()
        client.toBlocking().exchange(
            HttpRequest.PUT("/administration/organisation-settings",
                [euRepresentative: "Test EU Rep", dataProtectionOfficer: "Test DPO"]).bearerAuth(adminToken), Map)

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.GET("/administration/organisation-settings").bearerAuth(adminToken), Map)

        then:
        response.status == HttpStatus.OK
        response.body().euRepresentative == "Test EU Rep"
        response.body().dataProtectionOfficer == "Test DPO"
    }
}
