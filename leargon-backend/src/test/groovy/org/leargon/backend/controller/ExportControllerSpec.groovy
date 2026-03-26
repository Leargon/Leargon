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
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.BusinessEntityVersionRepository
import org.leargon.backend.repository.ServiceProviderRepository
import org.leargon.backend.repository.DpiaRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.repository.ProcessVersionRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

@MicronautTest(transactional = false)
class ExportControllerSpec extends Specification {

    @Inject @Client("/") HttpClient client
    @Inject UserRepository userRepository
    @Inject DpiaRepository dpiaRepository
    @Inject ServiceProviderRepository serviceProviderRepository
    @Inject ProcessRepository processRepository
    @Inject ProcessVersionRepository processVersionRepository
    @Inject BusinessEntityRepository businessEntityRepository
    @Inject BusinessEntityVersionRepository businessEntityVersionRepository
    @Inject SupportedLocaleRepository localeRepository

    def setup() {
        if (localeRepository.count() == 0) {
            localeRepository.save(new SupportedLocale(
                localeCode: "en", displayName: "English", isDefault: true, isActive: true, sortOrder: 1))
        }
    }

    def cleanup() {
        dpiaRepository.deleteAll()
        serviceProviderRepository.deleteAll()
        processVersionRepository.deleteAll()
        processRepository.findAll().each { processRepository.delete(it) }
        businessEntityVersionRepository.deleteAll()
        businessEntityRepository.findAll().each { businessEntityRepository.delete(it) }
        userRepository.deleteAll()
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private Map createUserWithToken(String email, String username) {
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/authentication/signup",
                new SignupRequest(email, username, "password123", "Test", "User")), Map)
        [token: resp.body().accessToken]
    }

    private String createAdminToken(String email = "admin@export.com", String username = "exportAdmin") {
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

    private String createProcess(String token, String name = "Test Process") {
        def req = [names: [[locale: "en", text: name]]]
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/processes", req).bearerAuth(token), Map)
        resp.body().key
    }

    private String createServiceProvider(String adminToken, String name = "Test Provider") {
        def req = [
            names: [[locale: "en", text: name]],
            serviceProviderType: "DATA_PROCESSOR",
            processingCountries: ["DE"],
            processorAgreementInPlace: true,
            subProcessorsApproved: false
        ]
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/service-providers", req).bearerAuth(adminToken), Map)
        resp.body().key
    }

    // ─── GET /export/processing-register ─────────────────────────────────────

    def "GET /export/processing-register returns 403 for non-admin"() {
        given:
        def userData = createUserWithToken("user1@export.com", "user1export")
        String token = userData.token

        when:
        client.toBlocking().exchange(
            HttpRequest.GET("/export/processing-register").bearerAuth(token), String)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }

    def "GET /export/processing-register returns 200 with CSV content for admin"() {
        given:
        String adminToken = createAdminToken()
        String processKey = createProcess(adminToken, "Export Test Process")
        // Set a legal basis so the process is included in the personal data register
        client.toBlocking().exchange(
            HttpRequest.PUT("/processes/${processKey}/legal-basis",
                [legalBasis: "CONSENT"]).bearerAuth(adminToken), Map)

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.GET("/export/processing-register").bearerAuth(adminToken), String)

        then:
        response.status == HttpStatus.OK
        def body = response.body()
        body.contains("Process Name")
        body.contains("Legal Basis")
        body.contains("Security Measures")
        body.contains("Data Subject Categories")
        body.contains("Personal Data Categories")
        body.contains("Export Test Process")
    }

    def "GET /export/processing-register returns 401 without auth"() {
        when:
        client.toBlocking().exchange(HttpRequest.GET("/export/processing-register"), String)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.UNAUTHORIZED
    }

    // ─── GET /export/service-providers ───────────────────────────────────────

    def "GET /export/service-providers returns 403 for non-admin"() {
        given:
        def userData = createUserWithToken("user2@export.com", "user2export")
        String token = userData.token

        when:
        client.toBlocking().exchange(
            HttpRequest.GET("/export/service-providers").bearerAuth(token), String)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }

    def "GET /export/service-providers returns 200 with CSV content for admin"() {
        given:
        String adminToken = createAdminToken("admin2@export.com", "exportAdmin2")
        createServiceProvider(adminToken, "Acme Corp")

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.GET("/export/service-providers").bearerAuth(adminToken), String)

        then:
        response.status == HttpStatus.OK
        def body = response.body()
        body.contains("Service Provider Key")
        body.contains("Service Provider Name")
        body.contains("Acme Corp")
    }

    // ─── GET /export/dpia-register ────────────────────────────────────────────

    def "GET /export/dpia-register returns 403 for non-admin"() {
        given:
        def userData = createUserWithToken("user3@export.com", "user3export")
        String token = userData.token

        when:
        client.toBlocking().exchange(
            HttpRequest.GET("/export/dpia-register").bearerAuth(token), String)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }

    def "GET /export/dpia-register returns 200 with CSV content for admin"() {
        given:
        String adminToken = createAdminToken("admin3@export.com", "exportAdmin3")
        def userData = createUserWithToken("dpiauser@export.com", "dpiauserexport")
        String userToken = userData.token
        String processKey = createProcess(userToken, "DPIA Register Test Process")
        // Trigger a DPIA
        client.toBlocking().exchange(
            HttpRequest.POST("/processes/${processKey}/dpia", null).bearerAuth(userToken), Map)

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.GET("/export/dpia-register").bearerAuth(adminToken), String)

        then:
        response.status == HttpStatus.OK
        def body = response.body()
        body.contains("DPIA Key")
        body.contains("Status")
        body.contains("In Progress")
    }

    def "GET /export/dpia-register returns empty CSV (headers only) when no DPIAs exist"() {
        given:
        String adminToken = createAdminToken("admin4@export.com", "exportAdmin4")

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.GET("/export/dpia-register").bearerAuth(adminToken), String)

        then:
        response.status == HttpStatus.OK
        def body = response.body()
        body.contains("DPIA Key")
        !body.contains("IN_PROGRESS")
    }
}
