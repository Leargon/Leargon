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

    // ===========================
    // IS-SUB-PROCESS DETECTION
    // ===========================

    def "GET /processes/{key}/flow marks TASK node as isSubProcess when linked process has content beyond Start+End"() {
        given:
        def userData = createUserWithToken("owner@example.com", "owner")
        def parent = createProcess(userData.token, "Parent Process")
        def child  = createProcess(userData.token, "Child Process")

        // Give the child a non-trivial flow (Start + Task + End)
        def childFlow = [
            nodes: [
                [id: "cs", position: 0, nodeType: "START_EVENT"],
                [id: "ct", position: 1, nodeType: "TASK", label: "Do work"],
                [id: "ce", position: 2, nodeType: "END_EVENT"]
            ],
            tracks: []
        ]
        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${child.key}/flow", childFlow).bearerAuth(userData.token),
                Map
        )

        // Save parent flow that references the child as a TASK
        def parentFlow = [
            nodes: [
                [id: "ps", position: 0, nodeType: "START_EVENT"],
                [id: "pt", position: 1, nodeType: "TASK", label: "Child step", linkedProcessKey: child.key],
                [id: "pe", position: 2, nodeType: "END_EVENT"]
            ],
            tracks: []
        ]
        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${parent.key}/flow", parentFlow).bearerAuth(userData.token),
                Map
        )

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/processes/${parent.key}/flow").bearerAuth(userData.token),
                Map
        )

        then:
        response.status() == HttpStatus.OK
        def taskNode = response.body().nodes.find { it.nodeType == "TASK" }
        taskNode != null
        taskNode.isSubProcess == true
        taskNode.linkedProcessKey == child.key
    }

    def "GET /processes/{key}/flow marks TASK node as NOT isSubProcess when linked process has only Start+End"() {
        given:
        def userData = createUserWithToken("owner@example.com", "owner")
        def parent = createProcess(userData.token, "Parent Process")
        def child  = createProcess(userData.token, "Empty Child")

        // Child has only Start+End (minimal flow)
        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${child.key}/flow", minimalFlowRequest()).bearerAuth(userData.token),
                Map
        )

        def parentFlow = [
            nodes: [
                [id: "ps", position: 0, nodeType: "START_EVENT"],
                [id: "pt", position: 1, nodeType: "TASK", label: "Child step", linkedProcessKey: child.key],
                [id: "pe", position: 2, nodeType: "END_EVENT"]
            ],
            tracks: []
        ]
        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${parent.key}/flow", parentFlow).bearerAuth(userData.token),
                Map
        )

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/processes/${parent.key}/flow").bearerAuth(userData.token),
                Map
        )

        then:
        response.status() == HttpStatus.OK
        def taskNode = response.body().nodes.find { it.nodeType == "TASK" }
        taskNode.isSubProcess == false
    }

    // ===========================
    // INTERMEDIATE EVENT EXPORT
    // ===========================

    def "GET /processes/{key}/diagram emits correct event definition for TIMER intermediate event"() {
        given:
        def userData = createUserWithToken("owner@example.com", "owner")
        def process = createProcess(userData.token, "Timer Process")
        def flow = [
            nodes: [
                [id: "s1", position: 0, nodeType: "START_EVENT"],
                [id: "ev", position: 1, nodeType: "INTERMEDIATE_EVENT", eventDefinition: "TIMER", label: "Wait"],
                [id: "e1", position: 2, nodeType: "END_EVENT"]
            ],
            tracks: []
        ]
        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${process.key}/flow", flow).bearerAuth(userData.token),
                Map
        )

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/processes/${process.key}/diagram").bearerAuth(userData.token),
                Map
        )

        then:
        response.status() == HttpStatus.OK
        def xml = response.body().bpmnXml as String
        xml.contains("bpmn:intermediateCatchEvent")
        xml.contains("bpmn:timerEventDefinition")
    }

    // ===========================
    // GATEWAY SAVE / LOAD TESTS
    // ===========================

    def "PUT /processes/{key}/flow saves gateway split+join with tracks"() {
        given:
        def userData = createUserWithToken("owner@example.com", "owner")
        def process = createProcess(userData.token, "Gateway Process")
        def pairId = "gw-pair-1"
        def flow = [
            nodes: [
                [id: "s1",  position: 0, nodeType: "START_EVENT"],
                [id: "sp1", position: 1, nodeType: "GATEWAY_SPLIT", gatewayPairId: pairId, gatewayType: "EXCLUSIVE"],
                [id: "jn1", position: 2, nodeType: "GATEWAY_JOIN",  gatewayPairId: pairId, gatewayType: "EXCLUSIVE"],
                [id: "e1",  position: 3, nodeType: "END_EVENT"]
            ],
            tracks: [
                [id: "track-a", gatewayNodeId: "sp1", trackIndex: 0],
                [id: "track-b", gatewayNodeId: "sp1", trackIndex: 1]
            ]
        ]

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${process.key}/flow", flow).bearerAuth(userData.token),
                Map
        )

        then:
        response.status() == HttpStatus.OK
        response.body().nodes.size() == 4
        response.body().tracks.size() == 2
        response.body().tracks.any { it.gatewayNodeId == "sp1" && it.trackIndex == 0 }
        response.body().tracks.any { it.gatewayNodeId == "sp1" && it.trackIndex == 1 }
    }

    def "PUT /processes/{key}/flow saves track nodes under their track"() {
        given:
        def userData = createUserWithToken("owner@example.com", "owner")
        def process = createProcess(userData.token, "Gateway With Tasks")
        def pairId = "gw-pair-2"
        def flow = [
            nodes: [
                [id: "s1",  position: 0, nodeType: "START_EVENT"],
                [id: "sp1", position: 1, nodeType: "GATEWAY_SPLIT", gatewayPairId: pairId, gatewayType: "PARALLEL"],
                [id: "jn1", position: 2, nodeType: "GATEWAY_JOIN",  gatewayPairId: pairId, gatewayType: "PARALLEL"],
                [id: "e1",  position: 3, nodeType: "END_EVENT"],
                // Track nodes — have trackId set
                [id: "tn1", position: 0, nodeType: "TASK", label: "Track A task", trackId: "track-a"],
                [id: "tn2", position: 0, nodeType: "TASK", label: "Track B task", trackId: "track-b"]
            ],
            tracks: [
                [id: "track-a", gatewayNodeId: "sp1", trackIndex: 0],
                [id: "track-b", gatewayNodeId: "sp1", trackIndex: 1]
            ]
        ]

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${process.key}/flow", flow).bearerAuth(userData.token),
                Map
        )

        then:
        response.status() == HttpStatus.OK
        // Root nodes should only contain the 4 root-level nodes
        response.body().nodes.size() == 4
        response.body().nodes.every { it.trackId == null }
        // Track nodes should be under tracks
        def trackA = response.body().tracks.find { it.trackIndex == 0 }
        def trackB = response.body().tracks.find { it.trackIndex == 1 }
        trackA.nodes.any { it.label == "Track A task" }
        trackB.nodes.any { it.label == "Track B task" }
    }

    // ===========================
    // GATEWAY BPMN EXPORT TESTS
    // ===========================

    def "GET /processes/{key}/diagram exports exclusive gateway as bpmn:exclusiveGateway"() {
        given:
        def userData = createUserWithToken("owner@example.com", "owner")
        def process = createProcess(userData.token, "XOR Gateway Process")
        def pairId = "gw-xor"
        def flow = [
            nodes: [
                [id: "s1",  position: 0, nodeType: "START_EVENT"],
                [id: "sp1", position: 1, nodeType: "GATEWAY_SPLIT", gatewayPairId: pairId, gatewayType: "EXCLUSIVE"],
                [id: "jn1", position: 2, nodeType: "GATEWAY_JOIN",  gatewayPairId: pairId, gatewayType: "EXCLUSIVE"],
                [id: "e1",  position: 3, nodeType: "END_EVENT"]
            ],
            tracks: [
                [id: "track-a", gatewayNodeId: "sp1", trackIndex: 0],
                [id: "track-b", gatewayNodeId: "sp1", trackIndex: 1]
            ]
        ]
        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${process.key}/flow", flow).bearerAuth(userData.token),
                Map
        )

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/processes/${process.key}/diagram").bearerAuth(userData.token),
                Map
        )

        then:
        response.status() == HttpStatus.OK
        def xml = response.body().bpmnXml as String
        xml.contains("bpmn:exclusiveGateway")
        // Two exclusive gateways (split + join)
        xml.count("bpmn:exclusiveGateway") == 2
    }

    def "GET /processes/{key}/diagram exports parallel gateway as bpmn:parallelGateway"() {
        given:
        def userData = createUserWithToken("owner@example.com", "owner")
        def process = createProcess(userData.token, "AND Gateway Process")
        def pairId = "gw-and"
        def flow = [
            nodes: [
                [id: "s1",  position: 0, nodeType: "START_EVENT"],
                [id: "sp1", position: 1, nodeType: "GATEWAY_SPLIT", gatewayPairId: pairId, gatewayType: "PARALLEL"],
                [id: "jn1", position: 2, nodeType: "GATEWAY_JOIN",  gatewayPairId: pairId, gatewayType: "PARALLEL"],
                [id: "e1",  position: 3, nodeType: "END_EVENT"]
            ],
            tracks: [
                [id: "track-a", gatewayNodeId: "sp1", trackIndex: 0],
                [id: "track-b", gatewayNodeId: "sp1", trackIndex: 1]
            ]
        ]
        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${process.key}/flow", flow).bearerAuth(userData.token),
                Map
        )

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/processes/${process.key}/diagram").bearerAuth(userData.token),
                Map
        )

        then:
        response.status() == HttpStatus.OK
        def xml = response.body().bpmnXml as String
        xml.contains("bpmn:parallelGateway")
        xml.count("bpmn:parallelGateway") == 2
    }

    def "GET /processes/{key}/diagram exports inclusive gateway as bpmn:inclusiveGateway"() {
        given:
        def userData = createUserWithToken("owner@example.com", "owner")
        def process = createProcess(userData.token, "OR Gateway Process")
        def pairId = "gw-or"
        def flow = [
            nodes: [
                [id: "s1",  position: 0, nodeType: "START_EVENT"],
                [id: "sp1", position: 1, nodeType: "GATEWAY_SPLIT", gatewayPairId: pairId, gatewayType: "INCLUSIVE"],
                [id: "jn1", position: 2, nodeType: "GATEWAY_JOIN",  gatewayPairId: pairId, gatewayType: "INCLUSIVE"],
                [id: "e1",  position: 3, nodeType: "END_EVENT"]
            ],
            tracks: [
                [id: "track-a", gatewayNodeId: "sp1", trackIndex: 0],
                [id: "track-b", gatewayNodeId: "sp1", trackIndex: 1]
            ]
        ]
        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${process.key}/flow", flow).bearerAuth(userData.token),
                Map
        )

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/processes/${process.key}/diagram").bearerAuth(userData.token),
                Map
        )

        then:
        response.status() == HttpStatus.OK
        def xml = response.body().bpmnXml as String
        xml.contains("bpmn:inclusiveGateway")
        xml.count("bpmn:inclusiveGateway") == 2
    }

    def "GET /processes/{key}/diagram emits correct event definitions for all intermediate event types"() {
        given:
        def userData = createUserWithToken("owner@example.com", "owner")
        def process = createProcess(userData.token, "Events Process")
        def flow = [
            nodes: [
                [id: "s1",  position: 0, nodeType: "START_EVENT"],
                [id: "ev1", position: 1, nodeType: "INTERMEDIATE_EVENT", eventDefinition: "MESSAGE"],
                [id: "ev2", position: 2, nodeType: "INTERMEDIATE_EVENT", eventDefinition: "SIGNAL"],
                [id: "ev3", position: 3, nodeType: "INTERMEDIATE_EVENT", eventDefinition: "CONDITIONAL"],
                [id: "e1",  position: 4, nodeType: "END_EVENT"]
            ],
            tracks: []
        ]
        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${process.key}/flow", flow).bearerAuth(userData.token),
                Map
        )

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/processes/${process.key}/diagram").bearerAuth(userData.token),
                Map
        )

        then:
        response.status() == HttpStatus.OK
        def xml = response.body().bpmnXml as String
        xml.contains("bpmn:messageEventDefinition")
        xml.contains("bpmn:signalEventDefinition")
        xml.contains("bpmn:conditionalEventDefinition")
    }
}
