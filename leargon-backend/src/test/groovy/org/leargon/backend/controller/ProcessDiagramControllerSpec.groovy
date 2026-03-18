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
import org.leargon.backend.model.CreateProcessRequest
import org.leargon.backend.model.LocalizedText
import org.leargon.backend.model.LoginRequest
import org.leargon.backend.model.ProcessDiagramResponse
import org.leargon.backend.model.ProcessResponse
import org.leargon.backend.model.ProcessVersionResponse
import org.leargon.backend.model.SaveProcessDiagramRequest
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.repository.ProcessVersionRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

@MicronautTest(transactional = false)
class ProcessDiagramControllerSpec extends Specification {

    static final String MINIMAL_BPMN = '''<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" name="Start" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_1" bpmnElement="StartEvent_1">
        <dc:Bounds x="152" y="82" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>'''

    @Inject
    @Client("/")
    HttpClient client

    @Inject
    UserRepository userRepository

    @Inject
    ProcessRepository processRepository

    @Inject
    ProcessVersionRepository processVersionRepository

    @Inject
    SupportedLocaleRepository localeRepository

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

    private ProcessResponse createProcess(String token, String name) {
        def request = new CreateProcessRequest([new LocalizedText("en", name)])
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/processes", request).bearerAuth(token),
                ProcessResponse
        )
        return response.body()
    }

    // ===========================
    // GET DIAGRAM TESTS
    // ===========================

    def "GET /processes/{key}/diagram should return null bpmnXml for new process"() {
        given:
        def userData = createUserWithToken("owner@example.com", "owner")
        def process = createProcess(userData.token, "Test Process")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/processes/${process.key}/diagram").bearerAuth(userData.token),
                ProcessDiagramResponse
        )

        then:
        response.status() == HttpStatus.OK
        response.body().bpmnXml == null
    }

    // ===========================
    // SAVE AND GET DIAGRAM TESTS
    // ===========================

    def "PUT /processes/{key}/diagram should save BPMN XML and return it"() {
        given:
        def userData = createUserWithToken("owner@example.com", "owner")
        def process = createProcess(userData.token, "Test Process")
        def saveRequest = new SaveProcessDiagramRequest(MINIMAL_BPMN)

        when:
        def putResponse = client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${process.key}/diagram", saveRequest).bearerAuth(userData.token),
                ProcessDiagramResponse
        )

        then:
        putResponse.status() == HttpStatus.OK
        putResponse.body().bpmnXml == MINIMAL_BPMN
    }

    def "GET /processes/{key}/diagram should return previously saved BPMN XML"() {
        given:
        def userData = createUserWithToken("owner@example.com", "owner")
        def process = createProcess(userData.token, "Test Process")
        def saveRequest = new SaveProcessDiagramRequest(MINIMAL_BPMN)

        and: "Save the diagram"
        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${process.key}/diagram", saveRequest).bearerAuth(userData.token),
                ProcessDiagramResponse
        )

        when: "GET returns saved XML"
        def getResponse = client.toBlocking().exchange(
                HttpRequest.GET("/processes/${process.key}/diagram").bearerAuth(userData.token),
                ProcessDiagramResponse
        )

        then:
        getResponse.body().bpmnXml == MINIMAL_BPMN
    }

    def "PUT /processes/{key}/diagram should overwrite previously saved XML"() {
        given:
        def userData = createUserWithToken("owner@example.com", "owner")
        def process = createProcess(userData.token, "Test Process")
        def firstXml = MINIMAL_BPMN
        def secondXml = MINIMAL_BPMN.replace("StartEvent_1", "StartEvent_Updated")

        and: "Save initial diagram"
        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${process.key}/diagram", new SaveProcessDiagramRequest(firstXml)).bearerAuth(userData.token),
                ProcessDiagramResponse
        )

        when: "Overwrite with new XML"
        def putResponse = client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${process.key}/diagram", new SaveProcessDiagramRequest(secondXml)).bearerAuth(userData.token),
                ProcessDiagramResponse
        )

        then:
        putResponse.body().bpmnXml == secondXml

        when:
        def getResponse = client.toBlocking().exchange(
                HttpRequest.GET("/processes/${process.key}/diagram").bearerAuth(userData.token),
                ProcessDiagramResponse
        )

        then:
        getResponse.body().bpmnXml == secondXml
    }

    // ===========================
    // PERMISSION TESTS
    // ===========================

    def "PUT /processes/{key}/diagram should fail with 403 for non-owner non-admin"() {
        given:
        def ownerData = createUserWithToken("owner@example.com", "owner")
        def otherData = createUserWithToken("other@example.com", "other")
        def process = createProcess(ownerData.token, "Test Process")

        when:
        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${process.key}/diagram", new SaveProcessDiagramRequest(MINIMAL_BPMN)).bearerAuth(otherData.token),
                ProcessDiagramResponse
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.FORBIDDEN
    }

    def "PUT /processes/{key}/diagram should succeed for admin even if not owner"() {
        given:
        def ownerData = createUserWithToken("owner@example.com", "owner")
        def process = createProcess(ownerData.token, "Test Process")
        def adminToken = createAdminToken()

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${process.key}/diagram", new SaveProcessDiagramRequest(MINIMAL_BPMN)).bearerAuth(adminToken),
                ProcessDiagramResponse
        )

        then:
        response.status() == HttpStatus.OK
        response.body().bpmnXml == MINIMAL_BPMN
    }

    // ===========================
    // VERSION TESTS
    // ===========================

    def "PUT /processes/{key}/diagram should create DIAGRAM_UPDATE version entry"() {
        given:
        def userData = createUserWithToken("owner@example.com", "owner")
        def process = createProcess(userData.token, "Test Process")

        when:
        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${process.key}/diagram", new SaveProcessDiagramRequest(MINIMAL_BPMN)).bearerAuth(userData.token),
                ProcessDiagramResponse
        )

        and:
        def versionsResponse = client.toBlocking().exchange(
                HttpRequest.GET("/processes/${process.key}/versions").bearerAuth(userData.token),
                Argument.listOf(ProcessVersionResponse)
        )

        then:
        versionsResponse.body().any { it.changeType.value == "DIAGRAM_UPDATE" }
    }
}
