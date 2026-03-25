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
import org.leargon.backend.model.BusinessEntityResponse
import org.leargon.backend.model.LoginRequest
import org.leargon.backend.model.ProcessResponse
import org.leargon.backend.model.ServiceProviderResponse
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.BusinessEntityVersionRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.repository.ProcessVersionRepository
import org.leargon.backend.repository.ServiceProviderRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

@MicronautTest(transactional = false)
class ServiceProviderControllerSpec extends Specification {

    @Inject @Client("/") HttpClient client
    @Inject UserRepository userRepository
    @Inject ServiceProviderRepository serviceProviderRepository
    @Inject BusinessEntityRepository businessEntityRepository
    @Inject BusinessEntityVersionRepository businessEntityVersionRepository
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

    private String createAdminToken() {
        client.toBlocking().exchange(
            HttpRequest.POST("/authentication/signup",
                new SignupRequest("admin@sp.com", "spAdmin", "password123", "Admin", "User")))
        def user = userRepository.findByEmail("admin@sp.com").get()
        user.roles = "ROLE_USER,ROLE_ADMIN"
        userRepository.update(user)
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/authentication/login",
                new LoginRequest("admin@sp.com", "password123")), Map)
        resp.body().accessToken
    }

    private ServiceProviderResponse createProvider(String adminToken, String nameText = "Acme Corp",
                                                    String providerType = "DATA_PROCESSOR") {
        def req = [
            names: [[locale: "en", text: nameText]],
            serviceProviderType: providerType,
            processingCountries: ["DE", "US"],
            processorAgreementInPlace: true,
            subProcessorsApproved: false
        ]
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/service-providers", req).bearerAuth(adminToken),
            ServiceProviderResponse)
        resp.body()
    }

    private BusinessEntityResponse createEntity(String token, String nameText = "Customer") {
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/business-entities",
                [names: [[locale: "en", text: nameText]]]).bearerAuth(token),
            BusinessEntityResponse)
        resp.body()
    }

    private ProcessResponse createProcess(String token, String nameText = "Onboarding") {
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/processes",
                [names: [[locale: "en", text: nameText]]]).bearerAuth(token),
            ProcessResponse)
        resp.body()
    }

    // ─── CREATE ───────────────────────────────────────────────────────────────

    def "POST /service-providers should create a service provider as admin"() {
        given:
        def adminToken = createAdminToken()
        def req = [
            names: [[locale: "en", text: "Stripe Inc"]],
            serviceProviderType: "DATA_PROCESSOR",
            processingCountries: ["US"],
            processorAgreementInPlace: true,
            subProcessorsApproved: true
        ]

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/service-providers", req).bearerAuth(adminToken),
            ServiceProviderResponse)

        then:
        resp.status == HttpStatus.CREATED
        def body = resp.body()
        body.key == "stripe-inc"
        body.names.any { it.locale == "en" && it.text == "Stripe Inc" }
        body.serviceProviderType.toString() == "DATA_PROCESSOR"
        body.processingCountries == ["US"]
        body.processorAgreementInPlace
        body.subProcessorsApproved
    }

    def "POST /service-providers should create a BODYLEASE type service provider"() {
        given:
        def adminToken = createAdminToken()
        def req = [
            names: [[locale: "en", text: "Staff Corp"]],
            serviceProviderType: "BODYLEASE",
            processingCountries: [],
            processorAgreementInPlace: false,
            subProcessorsApproved: false
        ]

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/service-providers", req).bearerAuth(adminToken),
            ServiceProviderResponse)

        then:
        resp.status == HttpStatus.CREATED
        resp.body().serviceProviderType.toString() == "BODYLEASE"
    }

    def "POST /service-providers should return 403 when called by non-admin"() {
        given:
        def userData = createUserWithToken("user@sp.com", "spUser")
        def req = [names: [[locale: "en", text: "Provider"]], processingCountries: [], processorAgreementInPlace: false, subProcessorsApproved: false]

        when:
        client.toBlocking().exchange(
            HttpRequest.POST("/service-providers", req).bearerAuth(userData.token),
            ServiceProviderResponse)

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.FORBIDDEN
    }

    def "POST /service-providers should return 401 when unauthenticated"() {
        when:
        client.toBlocking().exchange(
            HttpRequest.POST("/service-providers",
                [names: [[locale: "en", text: "Provider"]]]),
            ServiceProviderResponse)

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.UNAUTHORIZED
    }

    // ─── LIST ─────────────────────────────────────────────────────────────────

    def "GET /service-providers should return all providers for authenticated user"() {
        given:
        def adminToken = createAdminToken()
        createProvider(adminToken, "Vendor A")
        createProvider(adminToken, "Vendor B")
        def userData = createUserWithToken("reader@sp.com", "spReader")

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.GET("/service-providers").bearerAuth(userData.token),
            Argument.listOf(ServiceProviderResponse))

        then:
        resp.status == HttpStatus.OK
        resp.body().size() >= 2
    }

    def "GET /service-providers should return 401 when unauthenticated"() {
        when:
        client.toBlocking().exchange(
            HttpRequest.GET("/service-providers"),
            Argument.listOf(ServiceProviderResponse))

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.UNAUTHORIZED
    }

    // ─── GET BY KEY ───────────────────────────────────────────────────────────

    def "GET /service-providers/{key} should return provider by key"() {
        given:
        def adminToken = createAdminToken()
        def created = createProvider(adminToken, "PayPal")
        def userData = createUserWithToken("reader2@sp.com", "spReader2")

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.GET("/service-providers/${created.key}").bearerAuth(userData.token),
            ServiceProviderResponse)

        then:
        resp.status == HttpStatus.OK
        resp.body().key == created.key
        resp.body().names.any { it.locale == "en" && it.text == "PayPal" }
    }

    def "GET /service-providers/{key} should return 404 for unknown key"() {
        given:
        def userData = createUserWithToken("reader3@sp.com", "spReader3")

        when:
        client.toBlocking().exchange(
            HttpRequest.GET("/service-providers/non-existent").bearerAuth(userData.token),
            ServiceProviderResponse)

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.NOT_FOUND
    }

    // ─── UPDATE ───────────────────────────────────────────────────────────────

    def "PUT /service-providers/{key} should update provider as admin"() {
        given:
        def adminToken = createAdminToken()
        def created = createProvider(adminToken, "Old Name")
        def updateReq = [
            names: [[locale: "en", text: "New Name"]],
            serviceProviderType: "MANAGED_SERVICE",
            processingCountries: ["FR", "DE"],
            processorAgreementInPlace: false,
            subProcessorsApproved: true
        ]

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.PUT("/service-providers/${created.key}", updateReq).bearerAuth(adminToken),
            ServiceProviderResponse)

        then:
        resp.status == HttpStatus.OK
        resp.body().names.any { it.locale == "en" && it.text == "New Name" }
        resp.body().serviceProviderType.toString() == "MANAGED_SERVICE"
        resp.body().processingCountries.containsAll(["FR", "DE"])
        !resp.body().processorAgreementInPlace
        resp.body().subProcessorsApproved
    }

    def "PUT /service-providers/{key} should return 403 for non-admin"() {
        given:
        def adminToken = createAdminToken()
        def created = createProvider(adminToken, "Protected Provider")
        def userData = createUserWithToken("nonAdmin@sp.com", "spNonAdmin")
        def updateReq = [names: [[locale: "en", text: "Hacked"]], processingCountries: [], processorAgreementInPlace: false, subProcessorsApproved: false]

        when:
        client.toBlocking().exchange(
            HttpRequest.PUT("/service-providers/${created.key}", updateReq).bearerAuth(userData.token),
            ServiceProviderResponse)

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.FORBIDDEN
    }

    // ─── DELETE ───────────────────────────────────────────────────────────────

    def "DELETE /service-providers/{key} should delete provider as admin"() {
        given:
        def adminToken = createAdminToken()
        def created = createProvider(adminToken, "To Delete")

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.DELETE("/service-providers/${created.key}").bearerAuth(adminToken))

        then:
        resp.status == HttpStatus.NO_CONTENT

        and:
        !serviceProviderRepository.existsByKey(created.key)
    }

    def "DELETE /service-providers/{key} should return 403 for non-admin"() {
        given:
        def adminToken = createAdminToken()
        def created = createProvider(adminToken, "Safe Provider")
        def userData = createUserWithToken("user2@sp.com", "spUser2")

        when:
        client.toBlocking().exchange(
            HttpRequest.DELETE("/service-providers/${created.key}").bearerAuth(userData.token))

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.FORBIDDEN
    }

    // ─── LINK PROCESSES ───────────────────────────────────────────────────────

    def "PUT /service-providers/{key}/linked-processes should link processes"() {
        given:
        def adminToken = createAdminToken()
        def provider = createProvider(adminToken, "Process Provider")
        def process = createProcess(adminToken, "Data Migration")

        when:
        def linkResp = client.toBlocking().exchange(
            HttpRequest.PUT("/service-providers/${provider.key}/linked-processes",
                [processKeys: [process.key]]).bearerAuth(adminToken))

        then:
        linkResp.status == HttpStatus.NO_CONTENT

        when: "fetching the provider"
        def getResp = client.toBlocking().exchange(
            HttpRequest.GET("/service-providers/${provider.key}").bearerAuth(adminToken),
            ServiceProviderResponse)

        then: "linked process is present"
        getResp.body().linkedProcesses?.any { it.key == process.key }
    }

    // ─── STORAGE LOCATIONS ON ENTITY ─────────────────────────────────────────

    def "PUT /business-entities/{key}/storage-locations should update storage locations as owner"() {
        given:
        def ownerData = createUserWithToken("owner@sp.com", "spOwner")
        def entity = createEntity(ownerData.token, "Storage Entity")

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.PUT("/business-entities/${entity.key}/storage-locations",
                [locations: ["DE", "CH"]]).bearerAuth(ownerData.token),
            BusinessEntityResponse)

        then:
        resp.status == HttpStatus.OK
        resp.body().storageLocations?.containsAll(["DE", "CH"])
    }

    def "PUT /business-entities/{key}/storage-locations should return 403 for non-owner non-admin"() {
        given:
        def ownerData = createUserWithToken("owner2@sp.com", "spOwner2")
        def entity = createEntity(ownerData.token, "Protected Entity")
        def otherData = createUserWithToken("other@sp.com", "spOther")

        when:
        client.toBlocking().exchange(
            HttpRequest.PUT("/business-entities/${entity.key}/storage-locations",
                [locations: []]).bearerAuth(otherData.token),
            BusinessEntityResponse)

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.FORBIDDEN
    }

    // ─── CROSS-BORDER TRANSFERS ON PROCESS ───────────────────────────────────

    def "PUT /processes/{key}/cross-border-transfers should update transfers as process owner"() {
        given:
        def ownerData = createUserWithToken("procOwner@sp.com", "spProcOwner")
        def process = createProcess(ownerData.token, "Data Export Process")
        def transfers = [[destinationCountry: "US", safeguard: "BINDING_CORPORATE_RULES"]]

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.PUT("/processes/${process.key}/cross-border-transfers",
                [transfers: transfers]).bearerAuth(ownerData.token),
            ProcessResponse)

        then:
        resp.status == HttpStatus.OK
        resp.body().crossBorderTransfers?.size() == 1
        resp.body().crossBorderTransfers?.any {
            it.destinationCountry == "US" && it.safeguard.toString() == "BINDING_CORPORATE_RULES"
        }
    }
}
