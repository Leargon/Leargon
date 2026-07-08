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
import org.leargon.backend.model.ProcessResponse
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.repository.ProcessVersionRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

@MicronautTest(transactional = false)
class ProcessValueStreamSpec extends Specification {

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
    OrganisationalUnitRepository organisationalUnitRepository

    @Inject
    SupportedLocaleRepository localeRepository

    def setup() {
        if (localeRepository.count() == 0) {
            def en = new SupportedLocale()
            en.localeCode = "en"; en.displayName = "English"; en.isDefault = true; en.isActive = true; en.sortOrder = 1
            localeRepository.save(en)
            def de = new SupportedLocale()
            de.localeCode = "de"; de.displayName = "Deutsch"; de.isDefault = false; de.isActive = true; de.sortOrder = 2
            localeRepository.save(de)
        }
    }

    def cleanup() {
        processVersionRepository.deleteAll()
        processRepository.deleteAll()
        organisationalUnitRepository.deleteAll()
        userRepository.deleteAll()
    }

    private Map createUserWithToken(String email, String username, String roles) {
        def signupResponse = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/signup", new SignupRequest(email, username, "password123", "Test", "User")),
                Map
        )
        def user = userRepository.findByEmail(email).get()
        user.roles = roles
        userRepository.update(user)
        return [token: signupResponse.body().accessToken, user: user]
    }

    private String createAdminToken() {
        client.toBlocking().exchange(HttpRequest.POST("/authentication/signup",
                new SignupRequest("admin@example.com", "admin", "password123", "Admin", "User")))
        def user = userRepository.findByEmail("admin@example.com").get()
        user.roles = "ROLE_USER,ROLE_ADMIN"
        userRepository.update(user)
        def login = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/login", new LoginRequest("admin@example.com", "password123")), Map)
        return login.body().accessToken
    }

    private String createProcess(String token, String name) {
        return client.toBlocking().exchange(
                HttpRequest.POST("/processes", new CreateProcessRequest([new LocalizedText("en", name)])).bearerAuth(token),
                ProcessResponse
        ).body().key
    }

    def "owner can update value-stream metadata"() {
        given:
        def owner = createUserWithToken("owner@example.com", "vsmowner", "ROLE_USER,ROLE_EDITOR_PROCESS_GOVERNANCE")
        def key = createProcess(owner.token, "VSM Owner Step")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${key}/value-stream", [
                        valueStreamType        : "OPERATIONAL",
                        cycleTimeMinutes       : 12.0,
                        waitTimeMinutes        : 3.0,
                        activityType           : "VALUE_ADDING",
                        activityJustification  : [[locale: "en", text: "Directly transforms the order"]],
                        firstPassYield         : 95.0,
                ]).bearerAuth(owner.token),
                ProcessResponse
        )

        then:
        response.status == HttpStatus.OK
        response.body().valueStreamType.value == "OPERATIONAL"
        response.body().cycleTimeMinutes == 12.0
        response.body().activityType.value == "VALUE_ADDING"
        response.body().activityJustification.any { it.locale == "en" }
        response.body().firstPassYield == 95.0
    }

    def "a LEAN editor can update value-stream metadata on a process they do not own"() {
        given:
        def adminToken = createAdminToken()
        def key = createProcess(adminToken, "VSM Lean Editor Step")
        def leanEditor = createUserWithToken("lean@example.com", "leaneditor", "ROLE_USER,ROLE_EDITOR_LEAN")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${key}/value-stream", [cycleTimeMinutes: 8.0, activityType: "WASTE"])
                        .bearerAuth(leanEditor.token),
                ProcessResponse
        )

        then:
        response.status == HttpStatus.OK
        response.body().activityType.value == "WASTE"
    }

    def "an unrelated user cannot update value-stream metadata"() {
        given:
        def adminToken = createAdminToken()
        def key = createProcess(adminToken, "VSM Protected Step")
        def outsider = createUserWithToken("outsider@example.com", "vsmoutsider", "ROLE_USER")

        when:
        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${key}/value-stream", [cycleTimeMinutes: 1.0]).bearerAuth(outsider.token),
                ProcessResponse
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.FORBIDDEN
    }

    def "rejects a negative cycle time"() {
        given:
        def owner = createUserWithToken("owner2@example.com", "vsmowner2", "ROLE_USER,ROLE_EDITOR_PROCESS_GOVERNANCE")
        def key = createProcess(owner.token, "VSM Negative CT Step")

        when:
        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${key}/value-stream", [cycleTimeMinutes: -5.0]).bearerAuth(owner.token),
                ProcessResponse
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.BAD_REQUEST
    }

    def "rejects a first-pass-yield above 100"() {
        given:
        def owner = createUserWithToken("owner3@example.com", "vsmowner3", "ROLE_USER,ROLE_EDITOR_PROCESS_GOVERNANCE")
        def key = createProcess(owner.token, "VSM Bad FPY Step")

        when:
        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${key}/value-stream", [firstPassYield: 150.0]).bearerAuth(owner.token),
                ProcessResponse
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.BAD_REQUEST
    }

    def "value-stream summary aggregates lead time, VA ratio and activity breakdown over a subtree"() {
        given:
        def owner = createUserWithToken("owner4@example.com", "vsmowner4", "ROLE_USER,ROLE_EDITOR_PROCESS_GOVERNANCE")
        def parentKey = createProcess(owner.token, "VSM Parent Stream")
        def childKey = createProcess(owner.token, "VSM Child Step")

        // attach child to parent
        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${childKey}/parent", [parentKey: parentKey]).bearerAuth(owner.token), ProcessResponse)

        // parent: value-adding, CT 10 / WT 5
        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${parentKey}/value-stream",
                        [cycleTimeMinutes: 10.0, waitTimeMinutes: 5.0, activityType: "VALUE_ADDING"]).bearerAuth(owner.token), ProcessResponse)
        // child: waste, CT 20 / WT 10
        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${childKey}/value-stream",
                        [cycleTimeMinutes: 20.0, waitTimeMinutes: 10.0, activityType: "WASTE"]).bearerAuth(owner.token), ProcessResponse)

        when:
        def summary = client.toBlocking().exchange(
                HttpRequest.GET("/processes/${parentKey}/value-stream-summary").bearerAuth(owner.token), Map).body()

        then:
        summary.derivedFromDiagram == false
        summary.stepCount == 2
        summary.totalLeadTimeMinutes == 45.0
        summary.totalValueAddingMinutes == 10.0
        Math.abs(summary.valueAddingRatio - (10.0 / 45.0)) < 0.0001
        summary.activityBreakdown.find { it.activityType == "VALUE_ADDING" }.totalMinutes == 10.0
        summary.activityBreakdown.find { it.activityType == "WASTE" }.stepCount == 1
        summary.steps.size() == 2
    }

    def "value-stream summary derives the step sequence from the BPMN flow when one exists"() {
        given:
        def owner = createUserWithToken("owner6@example.com", "vsmowner6", "ROLE_USER,ROLE_EDITOR_PROCESS_GOVERNANCE")
        def parentKey = createProcess(owner.token, "VSM Flow Parent")
        // A and B are standalone processes (NOT children of the parent) — linked only via the diagram.
        def aKey = createProcess(owner.token, "VSM Flow Step A")
        def bKey = createProcess(owner.token, "VSM Flow Step B")

        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${aKey}/value-stream",
                        [cycleTimeMinutes: 10.0, waitTimeMinutes: 5.0, activityType: "VALUE_ADDING"]).bearerAuth(owner.token), ProcessResponse)
        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${bKey}/value-stream",
                        [cycleTimeMinutes: 20.0, waitTimeMinutes: 10.0, activityType: "WASTE"]).bearerAuth(owner.token), ProcessResponse)

        // BPMN flow on the parent: start -> task(call A) -> task(call B) -> end
        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${parentKey}/flow", [
                        nodes: [
                                [id: "n-start", position: 0, nodeType: "START_EVENT"],
                                [id: "n-a",     position: 1, nodeType: "TASK", linkedProcessKey: aKey],
                                [id: "n-b",     position: 2, nodeType: "TASK", linkedProcessKey: bKey],
                                [id: "n-end",   position: 3, nodeType: "END_EVENT"],
                        ],
                        tracks: [],
                ]).bearerAuth(owner.token), Map)

        when:
        def summary = client.toBlocking().exchange(
                HttpRequest.GET("/processes/${parentKey}/value-stream-summary").bearerAuth(owner.token), Map).body()

        then: "the sequence comes from the diagram's call-activities, not the (empty) sub-process tree"
        summary.derivedFromDiagram == true
        summary.stepCount == 2
        summary.totalLeadTimeMinutes == 45.0
        summary.totalValueAddingMinutes == 10.0
        summary.steps*.key.toSet() == ([aKey, bKey] as Set)
    }

    def "value-stream summary handles a process with no VSM data"() {
        given:
        def owner = createUserWithToken("owner5@example.com", "vsmowner5", "ROLE_USER,ROLE_EDITOR_PROCESS_GOVERNANCE")
        def key = createProcess(owner.token, "VSM Empty Step")

        when:
        def summary = client.toBlocking().exchange(
                HttpRequest.GET("/processes/${key}/value-stream-summary").bearerAuth(owner.token), Map).body()

        then:
        summary.stepCount == 1
        summary.totalLeadTimeMinutes == 0.0
        summary.totalValueAddingMinutes == 0.0
        summary.valueAddingRatio == null
        summary.activityBreakdown.isEmpty()
    }
}
