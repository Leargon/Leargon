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
import org.leargon.backend.model.DataProcessorResponse
import org.leargon.backend.model.LoginRequest
import org.leargon.backend.model.ProcessResponse
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.BusinessEntityVersionRepository
import org.leargon.backend.repository.DataProcessorRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.repository.ProcessVersionRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

@MicronautTest(transactional = false)
class DataProcessorControllerSpec extends Specification {

    @Inject @Client("/") HttpClient client
    @Inject UserRepository userRepository
    @Inject DataProcessorRepository dataProcessorRepository
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
        // Join tables are deleted via cascade when processor rows are deleted
        dataProcessorRepository.deleteAll()
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
                new SignupRequest("admin@dp.com", "dpAdmin", "password123", "Admin", "User")))
        def user = userRepository.findByEmail("admin@dp.com").get()
        user.roles = "ROLE_USER,ROLE_ADMIN"
        userRepository.update(user)
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/authentication/login",
                new LoginRequest("admin@dp.com", "password123")), Map)
        resp.body().accessToken
    }

    private DataProcessorResponse createProcessor(String adminToken, String nameText = "Acme Corp") {
        def req = [
            names: [[locale: "en", text: nameText]],
            processingCountries: ["DE", "US"],
            processorAgreementInPlace: true,
            subProcessorsApproved: false
        ]
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/data-processors", req).bearerAuth(adminToken),
            DataProcessorResponse)
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

    def "POST /data-processors should create a data processor as admin"() {
        given:
        def adminToken = createAdminToken()
        def req = [
            names: [[locale: "en", text: "Stripe Inc"]],
            processingCountries: ["US"],
            processorAgreementInPlace: true,
            subProcessorsApproved: true
        ]

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/data-processors", req).bearerAuth(adminToken),
            DataProcessorResponse)

        then:
        resp.status == HttpStatus.CREATED
        def body = resp.body()
        body.key == "stripe-inc"
        body.names.any { it.locale == "en" && it.text == "Stripe Inc" }
        body.processingCountries == ["US"]
        body.processorAgreementInPlace
        body.subProcessorsApproved
    }

    def "POST /data-processors should return 403 when called by non-admin"() {
        given:
        def userData = createUserWithToken("user@dp.com", "dpUser")
        def req = [names: [[locale: "en", text: "Processor"]], processingCountries: [], processorAgreementInPlace: false, subProcessorsApproved: false]

        when:
        client.toBlocking().exchange(
            HttpRequest.POST("/data-processors", req).bearerAuth(userData.token),
            DataProcessorResponse)

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.FORBIDDEN
    }

    def "POST /data-processors should return 401 when unauthenticated"() {
        when:
        client.toBlocking().exchange(
            HttpRequest.POST("/data-processors",
                [names: [[locale: "en", text: "Processor"]]]),
            DataProcessorResponse)

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.UNAUTHORIZED
    }

    // ─── LIST ─────────────────────────────────────────────────────────────────

    def "GET /data-processors should return all processors for authenticated user"() {
        given:
        def adminToken = createAdminToken()
        createProcessor(adminToken, "Vendor A")
        createProcessor(adminToken, "Vendor B")
        def userData = createUserWithToken("reader@dp.com", "dpReader")

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.GET("/data-processors").bearerAuth(userData.token),
            Argument.listOf(DataProcessorResponse))

        then:
        resp.status == HttpStatus.OK
        resp.body().size() >= 2
    }

    def "GET /data-processors should return 401 when unauthenticated"() {
        when:
        client.toBlocking().exchange(
            HttpRequest.GET("/data-processors"),
            Argument.listOf(DataProcessorResponse))

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.UNAUTHORIZED
    }

    // ─── GET BY KEY ───────────────────────────────────────────────────────────

    def "GET /data-processors/{key} should return processor by key"() {
        given:
        def adminToken = createAdminToken()
        def created = createProcessor(adminToken, "PayPal")
        def userData = createUserWithToken("reader2@dp.com", "dpReader2")

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.GET("/data-processors/${created.key}").bearerAuth(userData.token),
            DataProcessorResponse)

        then:
        resp.status == HttpStatus.OK
        resp.body().key == created.key
        resp.body().names.any { it.locale == "en" && it.text == "PayPal" }
    }

    def "GET /data-processors/{key} should return 404 for unknown key"() {
        given:
        def userData = createUserWithToken("reader3@dp.com", "dpReader3")

        when:
        client.toBlocking().exchange(
            HttpRequest.GET("/data-processors/non-existent").bearerAuth(userData.token),
            DataProcessorResponse)

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.NOT_FOUND
    }

    // ─── UPDATE ───────────────────────────────────────────────────────────────

    def "PUT /data-processors/{key} should update processor as admin"() {
        given:
        def adminToken = createAdminToken()
        def created = createProcessor(adminToken, "Old Name")
        def updateReq = [
            names: [[locale: "en", text: "New Name"]],
            processingCountries: ["FR", "DE"],
            processorAgreementInPlace: false,
            subProcessorsApproved: true
        ]

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.PUT("/data-processors/${created.key}", updateReq).bearerAuth(adminToken),
            DataProcessorResponse)

        then:
        resp.status == HttpStatus.OK
        resp.body().names.any { it.locale == "en" && it.text == "New Name" }
        resp.body().processingCountries.containsAll(["FR", "DE"])
        !resp.body().processorAgreementInPlace
        resp.body().subProcessorsApproved
    }

    def "PUT /data-processors/{key} should return 403 for non-admin"() {
        given:
        def adminToken = createAdminToken()
        def created = createProcessor(adminToken, "Protected Processor")
        def userData = createUserWithToken("nonAdmin@dp.com", "dpNonAdmin")
        def updateReq = [names: [[locale: "en", text: "Hacked"]], processingCountries: [], processorAgreementInPlace: false, subProcessorsApproved: false]

        when:
        client.toBlocking().exchange(
            HttpRequest.PUT("/data-processors/${created.key}", updateReq).bearerAuth(userData.token),
            DataProcessorResponse)

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.FORBIDDEN
    }

    // ─── DELETE ───────────────────────────────────────────────────────────────

    def "DELETE /data-processors/{key} should delete processor as admin"() {
        given:
        def adminToken = createAdminToken()
        def created = createProcessor(adminToken, "To Delete")

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.DELETE("/data-processors/${created.key}").bearerAuth(adminToken))

        then:
        resp.status == HttpStatus.NO_CONTENT

        and:
        !dataProcessorRepository.existsByKey(created.key)
    }

    def "DELETE /data-processors/{key} should return 403 for non-admin"() {
        given:
        def adminToken = createAdminToken()
        def created = createProcessor(adminToken, "Safe Processor")
        def userData = createUserWithToken("user2@dp.com", "dpUser2")

        when:
        client.toBlocking().exchange(
            HttpRequest.DELETE("/data-processors/${created.key}").bearerAuth(userData.token))

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.FORBIDDEN
    }

    // ─── LINK ENTITIES ────────────────────────────────────────────────────────

    def "PUT /data-processors/{key}/linked-entities should link business entities"() {
        given:
        def adminToken = createAdminToken()
        def processor = createProcessor(adminToken, "Entity Processor")
        def entity = createEntity(adminToken, "Customer Data")

        when:
        def linkResp = client.toBlocking().exchange(
            HttpRequest.PUT("/data-processors/${processor.key}/linked-entities",
                [businessEntityKeys: [entity.key]]).bearerAuth(adminToken))

        then:
        linkResp.status == HttpStatus.NO_CONTENT

        when: "fetching the processor"
        def getResp = client.toBlocking().exchange(
            HttpRequest.GET("/data-processors/${processor.key}").bearerAuth(adminToken),
            DataProcessorResponse)

        then: "linked entity is present"
        getResp.body().linkedBusinessEntities?.any { it.key == entity.key }
    }

    def "PUT /data-processors/{key}/linked-entities should return 403 for non-admin"() {
        given:
        def adminToken = createAdminToken()
        def processor = createProcessor(adminToken, "Restricted Processor")
        def userData = createUserWithToken("user3@dp.com", "dpUser3")

        when:
        client.toBlocking().exchange(
            HttpRequest.PUT("/data-processors/${processor.key}/linked-entities",
                [businessEntityKeys: []]).bearerAuth(userData.token))

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.FORBIDDEN
    }

    // ─── LINK PROCESSES ───────────────────────────────────────────────────────

    def "PUT /data-processors/{key}/linked-processes should link processes"() {
        given:
        def adminToken = createAdminToken()
        def processor = createProcessor(adminToken, "Process Processor")
        def process = createProcess(adminToken, "Data Migration")

        when:
        def linkResp = client.toBlocking().exchange(
            HttpRequest.PUT("/data-processors/${processor.key}/linked-processes",
                [processKeys: [process.key]]).bearerAuth(adminToken))

        then:
        linkResp.status == HttpStatus.NO_CONTENT

        when: "fetching the processor"
        def getResp = client.toBlocking().exchange(
            HttpRequest.GET("/data-processors/${processor.key}").bearerAuth(adminToken),
            DataProcessorResponse)

        then: "linked process is present"
        getResp.body().linkedProcesses?.any { it.key == process.key }
    }

    // ─── LINKED PROCESSOR ON ENTITY RESPONSE ─────────────────────────────────

    def "linked data processor should appear on business entity response"() {
        given:
        def adminToken = createAdminToken()
        def processor = createProcessor(adminToken, "AWS")
        def entity = createEntity(adminToken, "Storage Data")

        when:
        client.toBlocking().exchange(
            HttpRequest.PUT("/data-processors/${processor.key}/linked-entities",
                [businessEntityKeys: [entity.key]]).bearerAuth(adminToken))

        then:
        def entityResp = client.toBlocking().exchange(
            HttpRequest.GET("/business-entities/${entity.key}").bearerAuth(adminToken),
            BusinessEntityResponse)
        entityResp.body().dataProcessors?.any { it.key == processor.key }
    }

    // ─── CROSS-BORDER TRANSFERS ON ENTITY ────────────────────────────────────

    def "PUT /business-entities/{key}/cross-border-transfers should update transfers as owner"() {
        given:
        def ownerData = createUserWithToken("owner@dp.com", "dpOwner")
        def entity = createEntity(ownerData.token, "Transfer Entity")
        def transfers = [
            [destinationCountry: "DE", safeguard: "ADEQUACY_DECISION"],
            [destinationCountry: "US", safeguard: "STANDARD_CONTRACTUAL_CLAUSES", notes: "Signed SCCs 2024"]
        ]

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.PUT("/business-entities/${entity.key}/cross-border-transfers",
                [transfers: transfers]).bearerAuth(ownerData.token),
            BusinessEntityResponse)

        then:
        resp.status == HttpStatus.OK
        def body = resp.body()
        body.crossBorderTransfers?.size() == 2
        body.crossBorderTransfers?.any { it.destinationCountry == "DE" && it.safeguard.toString() == "ADEQUACY_DECISION" }
        body.crossBorderTransfers?.any { it.destinationCountry == "US" && it.notes == "Signed SCCs 2024" }
    }

    def "PUT /business-entities/{key}/cross-border-transfers should return 403 for non-owner non-admin"() {
        given:
        def ownerData = createUserWithToken("owner2@dp.com", "dpOwner2")
        def entity = createEntity(ownerData.token, "Protected Entity")
        def otherData = createUserWithToken("other@dp.com", "dpOther")

        when:
        client.toBlocking().exchange(
            HttpRequest.PUT("/business-entities/${entity.key}/cross-border-transfers",
                [transfers: []]).bearerAuth(otherData.token),
            BusinessEntityResponse)

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.FORBIDDEN
    }

    def "PUT /business-entities/{key}/cross-border-transfers should succeed as admin even if not owner"() {
        given:
        def ownerData = createUserWithToken("owner3@dp.com", "dpOwner3")
        def entity = createEntity(ownerData.token, "Admin Transfer Entity")
        def adminToken = createAdminToken()

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.PUT("/business-entities/${entity.key}/cross-border-transfers",
                [transfers: [[destinationCountry: "CH", safeguard: "ADEQUACY_DECISION"]]]).bearerAuth(adminToken),
            BusinessEntityResponse)

        then:
        resp.status == HttpStatus.OK
        resp.body().crossBorderTransfers?.any { it.destinationCountry == "CH" }
    }

    // ─── CROSS-BORDER TRANSFERS ON PROCESS ───────────────────────────────────

    def "PUT /processes/{key}/cross-border-transfers should update transfers as process owner"() {
        given:
        def ownerData = createUserWithToken("procOwner@dp.com", "dpProcOwner")
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

    def "PUT /processes/{key}/cross-border-transfers should return 403 for non-owner non-admin"() {
        given:
        def ownerData = createUserWithToken("procOwner2@dp.com", "dpProcOwner2")
        def process = createProcess(ownerData.token, "Locked Process")
        def otherData = createUserWithToken("stranger@dp.com", "dpStranger")

        when:
        client.toBlocking().exchange(
            HttpRequest.PUT("/processes/${process.key}/cross-border-transfers",
                [transfers: []]).bearerAuth(otherData.token),
            ProcessResponse)

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.FORBIDDEN
    }
}
