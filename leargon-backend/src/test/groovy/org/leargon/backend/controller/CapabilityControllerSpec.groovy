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
import org.leargon.backend.model.CapabilityResponse
import org.leargon.backend.model.LoginRequest
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.repository.CapabilityRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.repository.ProcessVersionRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

@MicronautTest(transactional = false)
class CapabilityControllerSpec extends Specification {

    @Inject @Client("/") HttpClient client
    @Inject UserRepository userRepository
    @Inject CapabilityRepository capabilityRepository
    @Inject ProcessRepository processRepository
    @Inject ProcessVersionRepository processVersionRepository
    @Inject SupportedLocaleRepository localeRepository

    def setup() {
        if (localeRepository.count() == 0) {
            localeRepository.save(new SupportedLocale(
                localeCode: "en", displayName: "English", isDefault: true, isActive: true, sortOrder: 1))
        }
    }

    def cleanup() {
        capabilityRepository.deleteAll()
        processVersionRepository.deleteAll()
        processRepository.findAll().each { processRepository.delete(it) }
        userRepository.deleteAll()
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private String createAdminToken() {
        client.toBlocking().exchange(
            HttpRequest.POST("/authentication/signup",
                new SignupRequest("admin@cap.com", "capAdmin", "password123", "Admin", "User")))
        def user = userRepository.findByEmail("admin@cap.com").get()
        user.roles = "ROLE_USER,ROLE_ADMIN"
        userRepository.update(user)
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/authentication/login",
                new LoginRequest("admin@cap.com", "password123")), Map)
        resp.body().accessToken
    }

    private String createUserToken() {
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/authentication/signup",
                new SignupRequest("user@cap.com", "capUser", "password123", "User", "User")), Map)
        resp.body().accessToken
    }

    private CapabilityResponse createCapability(String adminToken, String name = "Customer Management", String parentKey = null) {
        def req = [names: [[locale: "en", text: name]]]
        if (parentKey) req.parentCapabilityKey = parentKey
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/capabilities", req).bearerAuth(adminToken),
            CapabilityResponse)
        resp.body()
    }

    // ─── CREATE ───────────────────────────────────────────────────────────────

    def "admin can create a capability"() {
        given:
        def adminToken = createAdminToken()

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/capabilities", [names: [[locale: "en", text: "Order Management"]]]).bearerAuth(adminToken),
            CapabilityResponse)

        then:
        resp.status() == HttpStatus.CREATED
        resp.body().key == "order-management"
        resp.body().names[0].text == "Order Management"
    }

    def "non-admin cannot create a capability"() {
        given:
        def userToken = createUserToken()

        when:
        client.toBlocking().exchange(
            HttpRequest.POST("/capabilities", [names: [[locale: "en", text: "Unauthorized Cap"]]]).bearerAuth(userToken),
            Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }

    def "unauthenticated request is rejected"() {
        when:
        client.toBlocking().exchange(HttpRequest.GET("/capabilities"), Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.UNAUTHORIZED
    }

    // ─── READ ─────────────────────────────────────────────────────────────────

    def "authenticated user can list all capabilities"() {
        given:
        def adminToken = createAdminToken()
        createCapability(adminToken, "Cap A")
        createCapability(adminToken, "Cap B")

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.GET("/capabilities").bearerAuth(adminToken),
            Argument.listOf(CapabilityResponse))

        then:
        resp.status() == HttpStatus.OK
        resp.body().size() >= 2
    }

    def "can get capability by key"() {
        given:
        def adminToken = createAdminToken()
        def created = createCapability(adminToken, "Billing Management")

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.GET("/capabilities/${created.key}").bearerAuth(adminToken),
            CapabilityResponse)

        then:
        resp.status() == HttpStatus.OK
        resp.body().key == created.key
        resp.body().names[0].text == "Billing Management"
    }

    def "returns 404 for non-existent capability"() {
        given:
        def adminToken = createAdminToken()

        when:
        client.toBlocking().exchange(
            HttpRequest.GET("/capabilities/non-existent").bearerAuth(adminToken), Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.NOT_FOUND
    }

    // ─── UPDATE ───────────────────────────────────────────────────────────────

    def "admin can update a capability"() {
        given:
        def adminToken = createAdminToken()
        def created = createCapability(adminToken, "Old Name")

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.PUT("/capabilities/${created.key}", [
                names: [[locale: "en", text: "New Name"]],
                descriptions: []
            ]).bearerAuth(adminToken),
            CapabilityResponse)

        then:
        resp.status() == HttpStatus.OK
        resp.body().names[0].text == "New Name"
    }

    def "non-admin cannot update a capability"() {
        given:
        def adminToken = createAdminToken()
        def userToken = createUserToken()
        def created = createCapability(adminToken, "Protected Cap")

        when:
        client.toBlocking().exchange(
            HttpRequest.PUT("/capabilities/${created.key}", [
                names: [[locale: "en", text: "Hacked"]],
                descriptions: []
            ]).bearerAuth(userToken), Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }

    // ─── DELETE ───────────────────────────────────────────────────────────────

    def "admin can delete a capability"() {
        given:
        def adminToken = createAdminToken()
        def created = createCapability(adminToken, "Deletable Cap")

        when:
        def del = client.toBlocking().exchange(
            HttpRequest.DELETE("/capabilities/${created.key}").bearerAuth(adminToken))

        then:
        del.status() == HttpStatus.NO_CONTENT

        when:
        client.toBlocking().exchange(HttpRequest.GET("/capabilities/${created.key}").bearerAuth(adminToken), Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.NOT_FOUND
    }

    def "non-admin cannot delete a capability"() {
        given:
        def adminToken = createAdminToken()
        def userToken = createUserToken()
        def created = createCapability(adminToken, "Safe Cap")

        when:
        client.toBlocking().exchange(
            HttpRequest.DELETE("/capabilities/${created.key}").bearerAuth(userToken), Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }

    // ─── HIERARCHY ────────────────────────────────────────────────────────────

    def "can create a child capability under a parent"() {
        given:
        def adminToken = createAdminToken()
        def parent = createCapability(adminToken, "CRM")

        when:
        def child = client.toBlocking().exchange(
            HttpRequest.POST("/capabilities", [
                names: [[locale: "en", text: "Customer Onboarding"]],
                parentCapabilityKey: parent.key
            ]).bearerAuth(adminToken),
            CapabilityResponse)

        then:
        child.status() == HttpStatus.CREATED
        child.body().parent?.key == parent.key
    }

    // ─── LINK PROCESSES ───────────────────────────────────────────────────────

    def "admin can link processes to a capability"() {
        given:
        def adminToken = createAdminToken()
        def capability = createCapability(adminToken, "Order Fulfillment Cap")
        // Create a process
        def processResp = client.toBlocking().exchange(
            HttpRequest.POST("/processes", [names: [[locale: "en", text: "Fulfill Order"]]]).bearerAuth(adminToken),
            Map)
        def processKey = processResp.body().key

        when:
        def linkResp = client.toBlocking().exchange(
            HttpRequest.PUT("/capabilities/${capability.key}/linked-processes",
                [processKeys: [processKey]]).bearerAuth(adminToken))

        then:
        linkResp.status() == HttpStatus.NO_CONTENT

        and:
        def get = client.toBlocking().exchange(
            HttpRequest.GET("/capabilities/${capability.key}").bearerAuth(adminToken), CapabilityResponse)
        get.body().linkedProcesses?.any { it.key == processKey }
    }

    def "non-admin cannot link processes to a capability"() {
        given:
        def adminToken = createAdminToken()
        def userToken = createUserToken()
        def capability = createCapability(adminToken, "Locked Cap")

        when:
        client.toBlocking().exchange(
            HttpRequest.PUT("/capabilities/${capability.key}/linked-processes",
                [processKeys: []]).bearerAuth(userToken), Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }
}
