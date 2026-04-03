package org.leargon.backend.controller

import io.micronaut.http.HttpRequest
import io.micronaut.http.HttpStatus
import io.micronaut.http.client.HttpClient
import io.micronaut.http.client.annotation.Client
import io.micronaut.http.client.exceptions.HttpClientResponseException
import io.micronaut.test.extensions.spock.annotation.MicronautTest
import jakarta.inject.Inject
import org.leargon.backend.domain.SupportedLocale
import org.leargon.backend.model.CreateProcessRequest
import org.leargon.backend.model.LocalizedText
import org.leargon.backend.model.LoginRequest
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.repository.ProcessFlowNodeRepository
import org.leargon.backend.repository.ProcessFlowTrackRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.repository.ProcessVersionRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

@MicronautTest(transactional = false)
class ProcessDiagramControllerSpec extends Specification {

    @Inject
    @Client("/")
    HttpClient client

    @Inject UserRepository userRepository
    @Inject ProcessRepository processRepository
    @Inject ProcessVersionRepository processVersionRepository
    @Inject ProcessFlowNodeRepository processFlowNodeRepository
    @Inject ProcessFlowTrackRepository processFlowTrackRepository
    @Inject SupportedLocaleRepository localeRepository

    def setup() {
        if (localeRepository.count() == 0) {
            def enLocale = new SupportedLocale()
            enLocale.localeCode = "en"
            enLocale.displayName = "English"
            enLocale.isDefault = true
            enLocale.isActive = true
            enLocale.sortOrder = 1
            localeRepository.save(enLocale)
        }
    }

    def cleanup() {
        processFlowNodeRepository.deleteAll()
        processFlowTrackRepository.deleteAll()
        processVersionRepository.deleteAll()
        processRepository.findAll().each {
            it.parent = null
            processRepository.update(it)
        }
        processRepository.deleteAll()
        userRepository.deleteAll()
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

    private Map createProcess(String token, String name) {
        def request = new CreateProcessRequest([new LocalizedText("en", name)])
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/processes", request).bearerAuth(token),
                Map
        )
        return response.body()
    }

    private Map minimalFlowRequest() {
        return [
            nodes: [
                [id: "start-1", position: 0, nodeType: "START_EVENT"],
                [id: "end-1", position: 1, nodeType: "END_EVENT"]
            ],
            tracks: []
        ]
    }

    // ===========================
    // GET FLOW TESTS
    // ===========================

    def "GET /processes/{key}/flow returns empty flow for new process"() {
        given:
        def userData = createUserWithToken("owner@example.com", "owner")
        def process = createProcess(userData.token, "Test Process")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/processes/${process.key}/flow").bearerAuth(userData.token),
                Map
        )

        then:
        response.status() == HttpStatus.OK
        response.body().processKey == process.key
        response.body().nodes == []
        response.body().tracks == []
    }

    // ===========================
    // SAVE AND GET FLOW TESTS
    // ===========================

    def "PUT /processes/{key}/flow saves nodes and returns flow"() {
        given:
        def userData = createUserWithToken("owner@example.com", "owner")
        def process = createProcess(userData.token, "Test Process")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${process.key}/flow", minimalFlowRequest()).bearerAuth(userData.token),
                Map
        )

        then:
        response.status() == HttpStatus.OK
        response.body().processKey == process.key
        response.body().nodes.size() == 2
        response.body().nodes.any { it.nodeType == "START_EVENT" }
        response.body().nodes.any { it.nodeType == "END_EVENT" }
        response.body().tracks == []
    }

    def "GET /processes/{key}/flow returns previously saved flow"() {
        given:
        def userData = createUserWithToken("owner@example.com", "owner")
        def process = createProcess(userData.token, "Test Process")
        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${process.key}/flow", minimalFlowRequest()).bearerAuth(userData.token),
                Map
        )

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/processes/${process.key}/flow").bearerAuth(userData.token),
                Map
        )

        then:
        response.status() == HttpStatus.OK
        response.body().nodes.size() == 2
    }

    def "PUT /processes/{key}/flow replaces existing nodes on second save"() {
        given:
        def userData = createUserWithToken("owner@example.com", "owner")
        def process = createProcess(userData.token, "Test Process")
        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${process.key}/flow", minimalFlowRequest()).bearerAuth(userData.token),
                Map
        )
        def updatedFlow = [
            nodes: [
                [id: "start-2", position: 0, nodeType: "START_EVENT"],
                [id: "task-1", position: 1, nodeType: "TASK", label: "Do something"],
                [id: "end-2", position: 2, nodeType: "END_EVENT"]
            ],
            tracks: []
        ]

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${process.key}/flow", updatedFlow).bearerAuth(userData.token),
                Map
        )

        then:
        response.status() == HttpStatus.OK
        response.body().nodes.size() == 3
        response.body().nodes.any { it.nodeType == "TASK" && it.label == "Do something" }
    }

    // ===========================
    // BPMN EXPORT TESTS
    // ===========================

    def "GET /processes/{key}/diagram returns null bpmnXml when no flow saved"() {
        given:
        def userData = createUserWithToken("owner@example.com", "owner")
        def process = createProcess(userData.token, "Test Process")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/processes/${process.key}/diagram").bearerAuth(userData.token),
                Map
        )

        then:
        response.status() == HttpStatus.OK
        response.body().bpmnXml == null
    }

    def "GET /processes/{key}/diagram returns BPMN XML after flow saved"() {
        given:
        def userData = createUserWithToken("owner@example.com", "owner")
        def process = createProcess(userData.token, "Test Process")
        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${process.key}/flow", minimalFlowRequest()).bearerAuth(userData.token),
                Map
        )

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/processes/${process.key}/diagram").bearerAuth(userData.token),
                Map
        )

        then:
        response.status() == HttpStatus.OK
        response.body().bpmnXml != null
        response.body().bpmnXml.contains("bpmn:definitions")
    }

    // ===========================
    // PERMISSION TESTS
    // ===========================

    def "PUT /processes/{key}/flow returns 403 for non-owner non-admin"() {
        given:
        def ownerData = createUserWithToken("owner@example.com", "owner")
        def otherData = createUserWithToken("other@example.com", "other")
        def process = createProcess(ownerData.token, "Test Process")

        when:
        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${process.key}/flow", minimalFlowRequest()).bearerAuth(otherData.token),
                Map
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.FORBIDDEN
    }

    def "PUT /processes/{key}/flow succeeds for admin even if not owner"() {
        given:
        def ownerData = createUserWithToken("owner@example.com", "owner")
        def process = createProcess(ownerData.token, "Test Process")
        def adminToken = createAdminToken()

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${process.key}/flow", minimalFlowRequest()).bearerAuth(adminToken),
                Map
        )

        then:
        response.status() == HttpStatus.OK
        response.body().nodes.size() == 2
    }

    def "GET /processes/{key}/flow returns 404 for non-existent process"() {
        given:
        def userData = createUserWithToken("owner@example.com", "owner")

        when:
        client.toBlocking().exchange(
                HttpRequest.GET("/processes/non-existent-key/flow").bearerAuth(userData.token),
                Map
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.NOT_FOUND
    }
}
