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
import org.leargon.backend.model.CreateProcessRequest
import org.leargon.backend.model.DpiaResponse
import org.leargon.backend.model.LocalizedText
import org.leargon.backend.model.LoginRequest
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.BusinessEntityVersionRepository
import org.leargon.backend.repository.DpiaRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.repository.ProcessVersionRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

@MicronautTest(transactional = false)
class DpiaControllerSpec extends Specification {

    @Inject
    @Client("/")
    HttpClient client

    @Inject UserRepository userRepository
    @Inject DpiaRepository dpiaRepository
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
        processVersionRepository.deleteAll()
        processRepository.findAll().each { processRepository.delete(it) }
        businessEntityVersionRepository.deleteAll()
        businessEntityRepository.findAll().each { businessEntityRepository.delete(it) }
        userRepository.deleteAll()
    }

    // ─── helpers ─────────────────────────────────────────────────────────────

    private Map createUserWithToken(String email, String username) {
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/authentication/signup",
                new SignupRequest(email, username, "password123", "Test", "User")), Map)
        [token: resp.body().accessToken]
    }

    private String createAdminToken() {
        client.toBlocking().exchange(
            HttpRequest.POST("/authentication/signup",
                new SignupRequest("admin@dpia.com", "dpiaAdmin", "password123", "Admin", "User")))
        def user = userRepository.findByEmail("admin@dpia.com").get()
        user.roles = "ROLE_USER,ROLE_ADMIN"
        userRepository.update(user)
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/authentication/login",
                new LoginRequest("admin@dpia.com", "password123")), Map)
        resp.body().accessToken
    }

    private String createProcess(String token, String name = "Test Process") {
        def req = new CreateProcessRequest([new LocalizedText("en", name)])
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/processes", req).bearerAuth(token), Map)
        resp.body().key
    }

    private String createBusinessEntity(String token, String name = "Test Entity") {
        def req = new CreateBusinessEntityRequest([new LocalizedText("en", name)])
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/business-entities", req).bearerAuth(token), Map)
        resp.body().key
    }

    // ─── POST /processes/{key}/dpia ───────────────────────────────────────────

    def "POST /processes/{key}/dpia should trigger DPIA and return 201 with IN_PROGRESS status"() {
        given:
        def userData = createUserWithToken("user1@dpia.com", "user1dpia")
        String token = userData.token
        String processKey = createProcess(token)

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.POST("/processes/${processKey}/dpia", null).bearerAuth(token),
            DpiaResponse
        )

        then:
        response.status == HttpStatus.CREATED
        def dpia = response.body()
        dpia.key.startsWith("dpia-")
        dpia.status.value == "IN_PROGRESS"
        dpia.triggeredBy.username == "user1dpia"
        dpia.createdAt != null
    }

    def "POST /processes/{key}/dpia should return 409 when DPIA already exists"() {
        given:
        def userData = createUserWithToken("user2@dpia.com", "user2dpia")
        String token = userData.token
        String processKey = createProcess(token)
        // Trigger first DPIA
        client.toBlocking().exchange(
            HttpRequest.POST("/processes/${processKey}/dpia", null).bearerAuth(token), Map)

        when:
        client.toBlocking().exchange(
            HttpRequest.POST("/processes/${processKey}/dpia", null).bearerAuth(token), Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.CONFLICT
    }

    def "POST /processes/{key}/dpia should return 404 for unknown process"() {
        given:
        def userData = createUserWithToken("user3@dpia.com", "user3dpia")
        String token = userData.token

        when:
        client.toBlocking().exchange(
            HttpRequest.POST("/processes/non-existent-process/dpia", null).bearerAuth(token), Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.NOT_FOUND
    }

    // ─── GET /processes/{key}/dpia ────────────────────────────────────────────

    def "GET /processes/{key}/dpia should return 404 when no DPIA exists"() {
        given:
        def userData = createUserWithToken("user4@dpia.com", "user4dpia")
        String token = userData.token
        String processKey = createProcess(token)

        when:
        client.toBlocking().exchange(
            HttpRequest.GET("/processes/${processKey}/dpia").bearerAuth(token), Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.NOT_FOUND
    }

    def "GET /processes/{key}/dpia should return the DPIA when it exists"() {
        given:
        def userData = createUserWithToken("user5@dpia.com", "user5dpia")
        String token = userData.token
        String processKey = createProcess(token)
        client.toBlocking().exchange(
            HttpRequest.POST("/processes/${processKey}/dpia", null).bearerAuth(token), Map)

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.GET("/processes/${processKey}/dpia").bearerAuth(token),
            DpiaResponse
        )

        then:
        response.status == HttpStatus.OK
        def dpia = response.body()
        dpia.key.startsWith("dpia-")
        dpia.status.value == "IN_PROGRESS"
    }

    // ─── POST /business-entities/{key}/dpia ──────────────────────────────────

    def "POST /business-entities/{key}/dpia should trigger DPIA for entity and return 201"() {
        given:
        def userData = createUserWithToken("user6@dpia.com", "user6dpia")
        String token = userData.token
        String entityKey = createBusinessEntity(token)

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.POST("/business-entities/${entityKey}/dpia", null).bearerAuth(token),
            DpiaResponse
        )

        then:
        response.status == HttpStatus.CREATED
        def dpia = response.body()
        dpia.key.startsWith("dpia-")
        dpia.status.value == "IN_PROGRESS"
        dpia.triggeredBy.username == "user6dpia"
    }

    def "POST /business-entities/{key}/dpia should return 409 when DPIA already exists"() {
        given:
        def userData = createUserWithToken("user7@dpia.com", "user7dpia")
        String token = userData.token
        String entityKey = createBusinessEntity(token)
        client.toBlocking().exchange(
            HttpRequest.POST("/business-entities/${entityKey}/dpia", null).bearerAuth(token), Map)

        when:
        client.toBlocking().exchange(
            HttpRequest.POST("/business-entities/${entityKey}/dpia", null).bearerAuth(token), Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.CONFLICT
    }

    // ─── PUT /dpia/{key}/risk-description ────────────────────────────────────

    def "PUT /dpia/{key}/risk-description should update risk description"() {
        given:
        def userData = createUserWithToken("user8@dpia.com", "user8dpia")
        String token = userData.token
        String processKey = createProcess(token)
        def triggerResp = client.toBlocking().exchange(
            HttpRequest.POST("/processes/${processKey}/dpia", null).bearerAuth(token), Map)
        String dpiaKey = triggerResp.body().key

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.PUT("/dpia/${dpiaKey}/risk-description",
                [riskDescription: "High risk due to sensitive PII"]).bearerAuth(token),
            DpiaResponse
        )

        then:
        response.status == HttpStatus.OK
        response.body().riskDescription == "High risk due to sensitive PII"
    }

    // ─── PUT /dpia/{key}/measures ─────────────────────────────────────────────

    def "PUT /dpia/{key}/measures should update measures"() {
        given:
        def userData = createUserWithToken("user9@dpia.com", "user9dpia")
        String token = userData.token
        String processKey = createProcess(token)
        def triggerResp = client.toBlocking().exchange(
            HttpRequest.POST("/processes/${processKey}/dpia", null).bearerAuth(token), Map)
        String dpiaKey = triggerResp.body().key

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.PUT("/dpia/${dpiaKey}/measures",
                [measures: "Implement data minimization and encryption"]).bearerAuth(token),
            DpiaResponse
        )

        then:
        response.status == HttpStatus.OK
        response.body().measures == "Implement data minimization and encryption"
    }

    // ─── PUT /dpia/{key}/residual-risk ────────────────────────────────────────

    def "PUT /dpia/{key}/residual-risk should update residual risk"() {
        given:
        def userData = createUserWithToken("user10@dpia.com", "user10dpia")
        String token = userData.token
        String processKey = createProcess(token, "Residual Risk Process")
        def triggerResp = client.toBlocking().exchange(
            HttpRequest.POST("/processes/${processKey}/dpia", null).bearerAuth(token), Map)
        String dpiaKey = triggerResp.body().key

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.PUT("/dpia/${dpiaKey}/residual-risk",
                [residualRisk: "LOW", fdpicConsultationRequired: false]).bearerAuth(token),
            DpiaResponse
        )

        then:
        response.status == HttpStatus.OK
        response.body().residualRisk.value == "LOW"
        response.body().fdpicConsultationRequired == false
    }

    // ─── PUT /dpia/{key}/complete ─────────────────────────────────────────────

    def "PUT /dpia/{key}/complete should mark DPIA as COMPLETED"() {
        given:
        def userData = createUserWithToken("user11@dpia.com", "user11dpia")
        String token = userData.token
        String processKey = createProcess(token, "Complete Process")
        def triggerResp = client.toBlocking().exchange(
            HttpRequest.POST("/processes/${processKey}/dpia", null).bearerAuth(token), Map)
        String dpiaKey = triggerResp.body().key

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.PUT("/dpia/${dpiaKey}/complete", null).bearerAuth(token),
            DpiaResponse
        )

        then:
        response.status == HttpStatus.OK
        response.body().status.value == "COMPLETED"
    }

    // ─── Permission checks ────────────────────────────────────────────────────

    def "PUT /dpia/{key}/risk-description should return 403 for non-owner non-admin"() {
        given:
        def owner = createUserWithToken("owner@dpia.com", "ownerDpia")
        def other = createUserWithToken("other@dpia.com", "otherDpia")
        String ownerToken = owner.token
        String otherToken = other.token
        String processKey = createProcess(ownerToken, "Owner Process")
        def triggerResp = client.toBlocking().exchange(
            HttpRequest.POST("/processes/${processKey}/dpia", null).bearerAuth(ownerToken), Map)
        String dpiaKey = triggerResp.body().key

        when:
        client.toBlocking().exchange(
            HttpRequest.PUT("/dpia/${dpiaKey}/risk-description",
                [riskDescription: "Should be forbidden"]).bearerAuth(otherToken),
            Map
        )

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }

    def "PUT /dpia/{key}/complete should return 404 for unknown DPIA"() {
        given:
        def userData = createUserWithToken("user12@dpia.com", "user12dpia")
        String token = userData.token

        when:
        client.toBlocking().exchange(
            HttpRequest.PUT("/dpia/dpia-non-existent/complete", null).bearerAuth(token), Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.NOT_FOUND
    }

    def "GET /dpia should return 401 for unauthenticated request"() {
        when:
        client.toBlocking().exchange(
            HttpRequest.GET("/dpia"),
            Argument.listOf(Map))

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.UNAUTHORIZED
    }

    def "GET /dpia should return all DPIAs for any authenticated user"() {
        given:
        def userData = createUserWithToken("user13@dpia.com", "user13dpia")
        String token = userData.token
        String processKey = createProcess(token, "User List Process")
        client.toBlocking().exchange(
            HttpRequest.POST("/processes/${processKey}/dpia", null).bearerAuth(token), Map)

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.GET("/dpia").bearerAuth(token),
            Argument.listOf(Map)
        )

        then:
        response.status == HttpStatus.OK
        response.body().size() >= 1
    }

    def "GET /dpia should return all DPIAs for admin"() {
        given:
        String adminToken = createAdminToken()
        def userData = createUserWithToken("user14@dpia.com", "user14dpia")
        String token = userData.token
        String processKey = createProcess(token, "Admin List Process")
        client.toBlocking().exchange(
            HttpRequest.POST("/processes/${processKey}/dpia", null).bearerAuth(token), Map)

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.GET("/dpia").bearerAuth(adminToken),
            Argument.listOf(Map)
        )

        then:
        response.status == HttpStatus.OK
        response.body().size() >= 1
    }
}
