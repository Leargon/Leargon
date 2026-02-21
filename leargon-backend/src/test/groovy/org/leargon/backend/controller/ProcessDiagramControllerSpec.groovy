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
import org.leargon.backend.model.ProcessElementInput
import org.leargon.backend.model.ProcessElementType
import org.leargon.backend.model.ProcessFlowInput
import org.leargon.backend.model.ProcessResponse
import org.leargon.backend.model.ProcessVersionResponse
import org.leargon.backend.model.SaveProcessDiagramRequest
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.repository.ProcessElementRepository
import org.leargon.backend.repository.ProcessFlowRepository
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

    @Inject
    UserRepository userRepository

    @Inject
    ProcessRepository processRepository

    @Inject
    ProcessVersionRepository processVersionRepository

    @Inject
    ProcessElementRepository processElementRepository

    @Inject
    ProcessFlowRepository processFlowRepository

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

            def deLocale = new SupportedLocale()
            deLocale.localeCode = "de"
            deLocale.displayName = "Deutsch"
            deLocale.isDefault = false
            deLocale.isActive = true
            deLocale.sortOrder = 2
            localeRepository.save(deLocale)
        }
    }

    def cleanup() {
        processFlowRepository.deleteAll()
        processElementRepository.deleteAll()
        processVersionRepository.deleteAll()
        // Null out parent references before deleting to avoid FK constraint violations
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
    // GET EMPTY DIAGRAM TESTS
    // ===========================

    def "GET /processes/{key}/diagram should return empty diagram for new process"() {
        given:
        def userData = createUserWithToken("owner@example.com", "owner")
        String token = userData.token
        def process = createProcess(token, "Test Process")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/processes/${process.key}/diagram").bearerAuth(token),
                ProcessDiagramResponse
        )

        then:
        response.status() == HttpStatus.OK
        (response.body().elements == null || response.body().elements.isEmpty())
        (response.body().flows == null || response.body().flows.isEmpty())
    }

    // ===========================
    // SAVE AND GET DIAGRAM TESTS
    // ===========================

    def "PUT /processes/{key}/diagram should save diagram with start, task, and end"() {
        given:
        def userData = createUserWithToken("owner@example.com", "owner")
        String token = userData.token
        def process = createProcess(token, "Main Process")
        def linkedProcess = createProcess(token, "Linked Process")

        and:
        def saveRequest = new SaveProcessDiagramRequest(
                [
                        new ProcessElementInput("start-1", ProcessElementType.NONE_START_EVENT, 0),
                        new ProcessElementInput("task-1", ProcessElementType.TASK, 1)
                                .linkedProcessKey(linkedProcess.key),
                        new ProcessElementInput("end-1", ProcessElementType.NONE_END_EVENT, 2)
                ],
                [
                        new ProcessFlowInput("flow-1", "start-1", "task-1"),
                        new ProcessFlowInput("flow-2", "task-1", "end-1")
                ]
        )

        when:
        def putResponse = client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${process.key}/diagram", saveRequest).bearerAuth(token),
                ProcessDiagramResponse
        )

        then:
        putResponse.status() == HttpStatus.OK
        putResponse.body().elements.size() == 3
        putResponse.body().flows.size() == 2

        when: "GET should return the saved diagram"
        def getResponse = client.toBlocking().exchange(
                HttpRequest.GET("/processes/${process.key}/diagram").bearerAuth(token),
                ProcessDiagramResponse
        )

        then:
        getResponse.body().elements.size() == 3
        getResponse.body().flows.size() == 2
        getResponse.body().elements.find { it.elementId == "task-1" }.linkedProcess.key == linkedProcess.key
    }

    def "PUT /processes/{key}/diagram with SUBPROCESS creating child process"() {
        given:
        def userData = createUserWithToken("owner@example.com", "owner")
        String token = userData.token
        def process = createProcess(token, "Parent Process")

        and:
        def saveRequest = new SaveProcessDiagramRequest(
                [
                        new ProcessElementInput("start-1", ProcessElementType.NONE_START_EVENT, 0),
                        new ProcessElementInput("sub-1", ProcessElementType.SUBPROCESS, 1)
                                .createLinkedProcess(new CreateProcessRequest([new LocalizedText("en", "Child Subprocess")])),
                        new ProcessElementInput("end-1", ProcessElementType.NONE_END_EVENT, 2)
                ],
                [
                        new ProcessFlowInput("flow-1", "start-1", "sub-1"),
                        new ProcessFlowInput("flow-2", "sub-1", "end-1")
                ]
        )

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${process.key}/diagram", saveRequest).bearerAuth(token),
                ProcessDiagramResponse
        )

        then:
        response.status() == HttpStatus.OK
        def subElement = response.body().elements.find { it.elementId == "sub-1" }
        subElement.linkedProcess != null
        subElement.linkedProcess.name == "Child Subprocess"

        when: "Verify child process has parent link"
        def childResponse = client.toBlocking().exchange(
                HttpRequest.GET("/processes/${subElement.linkedProcess.key}").bearerAuth(token),
                ProcessResponse
        )

        then:
        childResponse.body().parentProcess != null
        childResponse.body().parentProcess.key == process.key
    }

    def "PUT /processes/{key}/diagram with gateway and labels"() {
        given:
        def userData = createUserWithToken("owner@example.com", "owner")
        String token = userData.token
        def process = createProcess(token, "Gateway Process")
        def taskProcess1 = createProcess(token, "Task 1")
        def taskProcess2 = createProcess(token, "Task 2")

        and:
        def saveRequest = new SaveProcessDiagramRequest(
                [
                        new ProcessElementInput("start-1", ProcessElementType.NONE_START_EVENT, 0),
                        new ProcessElementInput("gw-1", ProcessElementType.EXCLUSIVE_GATEWAY, 1)
                                .labels([new LocalizedText("en", "Approved?")]),
                        new ProcessElementInput("task-1", ProcessElementType.TASK, 2)
                                .linkedProcessKey(taskProcess1.key),
                        new ProcessElementInput("task-2", ProcessElementType.TASK, 3)
                                .linkedProcessKey(taskProcess2.key),
                        new ProcessElementInput("end-1", ProcessElementType.NONE_END_EVENT, 4)
                ],
                [
                        new ProcessFlowInput("flow-1", "start-1", "gw-1"),
                        new ProcessFlowInput("flow-2", "gw-1", "task-1")
                                .labels([new LocalizedText("en", "Yes")]),
                        new ProcessFlowInput("flow-3", "gw-1", "task-2")
                                .labels([new LocalizedText("en", "No")]),
                        new ProcessFlowInput("flow-4", "task-1", "end-1"),
                        new ProcessFlowInput("flow-5", "task-2", "end-1")
                ]
        )

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${process.key}/diagram", saveRequest).bearerAuth(token),
                ProcessDiagramResponse
        )

        then:
        response.status() == HttpStatus.OK
        response.body().elements.size() == 5
        def gateway = response.body().elements.find { it.elementId == "gw-1" }
        gateway.labels.size() == 1
        gateway.labels[0].text == "Approved?"
        def yesFlow = response.body().flows.find { it.flowId == "flow-2" }
        yesFlow.labels[0].text == "Yes"
    }

    // ===========================
    // VALIDATION TESTS
    // ===========================

    def "PUT /processes/{key}/diagram should fail without START_EVENT"() {
        given:
        def userData = createUserWithToken("owner@example.com", "owner")
        String token = userData.token
        def process = createProcess(token, "Test Process")

        and:
        def saveRequest = new SaveProcessDiagramRequest(
                [new ProcessElementInput("end-1", ProcessElementType.NONE_END_EVENT, 0)],
                []
        )

        when:
        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${process.key}/diagram", saveRequest).bearerAuth(token),
                ProcessDiagramResponse
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.BAD_REQUEST
    }

    def "PUT /processes/{key}/diagram should fail with flow referencing unknown element"() {
        given:
        def userData = createUserWithToken("owner@example.com", "owner")
        String token = userData.token
        def process = createProcess(token, "Test Process")

        and:
        def saveRequest = new SaveProcessDiagramRequest(
                [
                        new ProcessElementInput("start-1", ProcessElementType.NONE_START_EVENT, 0),
                        new ProcessElementInput("end-1", ProcessElementType.NONE_END_EVENT, 1)
                ],
                [new ProcessFlowInput("flow-1", "start-1", "nonexistent")]
        )

        when:
        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${process.key}/diagram", saveRequest).bearerAuth(token),
                ProcessDiagramResponse
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.BAD_REQUEST
    }

    def "PUT /processes/{key}/diagram should fail when START_EVENT is flow target"() {
        given:
        def userData = createUserWithToken("owner@example.com", "owner")
        String token = userData.token
        def process = createProcess(token, "Test Process")
        def linkedProcess = createProcess(token, "Linked")

        and:
        def saveRequest = new SaveProcessDiagramRequest(
                [
                        new ProcessElementInput("start-1", ProcessElementType.NONE_START_EVENT, 0),
                        new ProcessElementInput("task-1", ProcessElementType.TASK, 1)
                                .linkedProcessKey(linkedProcess.key),
                        new ProcessElementInput("end-1", ProcessElementType.NONE_END_EVENT, 2)
                ],
                [new ProcessFlowInput("flow-1", "task-1", "start-1")]
        )

        when:
        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${process.key}/diagram", saveRequest).bearerAuth(token),
                ProcessDiagramResponse
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.BAD_REQUEST
    }

    def "PUT /processes/{key}/diagram should fail when TASK has no linked process"() {
        given:
        def userData = createUserWithToken("owner@example.com", "owner")
        String token = userData.token
        def process = createProcess(token, "Test Process")

        and:
        def saveRequest = new SaveProcessDiagramRequest(
                [
                        new ProcessElementInput("start-1", ProcessElementType.NONE_START_EVENT, 0),
                        new ProcessElementInput("task-1", ProcessElementType.TASK, 1),
                        new ProcessElementInput("end-1", ProcessElementType.NONE_END_EVENT, 2)
                ],
                [
                        new ProcessFlowInput("flow-1", "start-1", "task-1"),
                        new ProcessFlowInput("flow-2", "task-1", "end-1")
                ]
        )

        when:
        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${process.key}/diagram", saveRequest).bearerAuth(token),
                ProcessDiagramResponse
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.BAD_REQUEST
    }

    // ===========================
    // PERMISSION TESTS
    // ===========================

    def "PUT /processes/{key}/diagram should fail for non-owner non-admin"() {
        given:
        def ownerData = createUserWithToken("owner@example.com", "owner")
        def otherData = createUserWithToken("other@example.com", "other")
        def process = createProcess(ownerData.token, "Test Process")
        def linkedProcess = createProcess(ownerData.token, "Linked")

        and:
        def saveRequest = new SaveProcessDiagramRequest(
                [
                        new ProcessElementInput("start-1", ProcessElementType.NONE_START_EVENT, 0),
                        new ProcessElementInput("task-1", ProcessElementType.TASK, 1)
                                .linkedProcessKey(linkedProcess.key),
                        new ProcessElementInput("end-1", ProcessElementType.NONE_END_EVENT, 2)
                ],
                [
                        new ProcessFlowInput("flow-1", "start-1", "task-1"),
                        new ProcessFlowInput("flow-2", "task-1", "end-1")
                ]
        )

        when:
        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${process.key}/diagram", saveRequest).bearerAuth(otherData.token),
                ProcessDiagramResponse
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.FORBIDDEN
    }

    // ===========================
    // VERSION TESTS
    // ===========================

    def "PUT /processes/{key}/diagram should create DIAGRAM_UPDATE version entry"() {
        given:
        def userData = createUserWithToken("owner@example.com", "owner")
        String token = userData.token
        def process = createProcess(token, "Test Process")
        def linkedProcess = createProcess(token, "Linked")

        and:
        def saveRequest = new SaveProcessDiagramRequest(
                [
                        new ProcessElementInput("start-1", ProcessElementType.NONE_START_EVENT, 0),
                        new ProcessElementInput("task-1", ProcessElementType.TASK, 1)
                                .linkedProcessKey(linkedProcess.key),
                        new ProcessElementInput("end-1", ProcessElementType.NONE_END_EVENT, 2)
                ],
                [
                        new ProcessFlowInput("flow-1", "start-1", "task-1"),
                        new ProcessFlowInput("flow-2", "task-1", "end-1")
                ]
        )

        when:
        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${process.key}/diagram", saveRequest).bearerAuth(token),
                ProcessDiagramResponse
        )

        and:
        def versionsResponse = client.toBlocking().exchange(
                HttpRequest.GET("/processes/${process.key}/versions").bearerAuth(token),
                Argument.listOf(ProcessVersionResponse)
        )

        then:
        def versions = versionsResponse.body()
        versions.any { it.changeType.value == "DIAGRAM_UPDATE" }
    }

    // ===========================
    // PARENT-CHILD RESPONSE TESTS
    // ===========================

    def "ProcessResponse should include parentProcess and childProcesses"() {
        given:
        def userData = createUserWithToken("owner@example.com", "owner")
        String token = userData.token
        def parentProcess = createProcess(token, "Parent Process")

        and: "Save diagram with subprocess that creates child"
        def saveRequest = new SaveProcessDiagramRequest(
                [
                        new ProcessElementInput("start-1", ProcessElementType.NONE_START_EVENT, 0),
                        new ProcessElementInput("sub-1", ProcessElementType.SUBPROCESS, 1)
                                .createLinkedProcess(new CreateProcessRequest([new LocalizedText("en", "Child Process")])),
                        new ProcessElementInput("end-1", ProcessElementType.NONE_END_EVENT, 2)
                ],
                [
                        new ProcessFlowInput("flow-1", "start-1", "sub-1"),
                        new ProcessFlowInput("flow-2", "sub-1", "end-1")
                ]
        )
        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${parentProcess.key}/diagram", saveRequest).bearerAuth(token),
                ProcessDiagramResponse
        )

        when: "Get parent process"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/processes/${parentProcess.key}").bearerAuth(token),
                ProcessResponse
        )

        then:
        response.body().childProcesses != null
        response.body().childProcesses.size() == 1
        response.body().childProcesses[0].name == "Child Process"
    }
}
