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
import org.leargon.backend.model.LocalizedText
import org.leargon.backend.model.LoginRequest
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.repository.BoundedContextRepository
import org.leargon.backend.repository.BusinessDomainRepository
import org.leargon.backend.repository.BusinessDomainVersionRepository
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.BusinessEntityVersionRepository
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.repository.ProcessVersionRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

@MicronautTest(transactional = false)
class AnalyticsControllerSpec extends Specification {

    @Inject
    @Client("/")
    HttpClient client

    @Inject UserRepository userRepository
    @Inject ProcessRepository processRepository
    @Inject ProcessVersionRepository processVersionRepository
    @Inject BusinessEntityRepository businessEntityRepository
    @Inject BusinessEntityVersionRepository businessEntityVersionRepository
    @Inject OrganisationalUnitRepository organisationalUnitRepository
    @Inject BusinessDomainRepository businessDomainRepository
    @Inject BusinessDomainVersionRepository businessDomainVersionRepository
    @Inject BoundedContextRepository boundedContextRepository
    @Inject SupportedLocaleRepository localeRepository
    @Inject org.leargon.backend.repository.TeamInteractionRepository teamInteractionRepository

    def setup() {
        if (localeRepository.count() == 0) {
            localeRepository.save(new SupportedLocale(
                localeCode: "en", displayName: "English", isDefault: true, isActive: true, sortOrder: 1))
        }
    }

    def cleanup() {
        teamInteractionRepository.deleteAll()
        processVersionRepository.deleteAll()
        processRepository.deleteAll()
        organisationalUnitRepository.deleteAll()
        businessEntityVersionRepository.deleteAll()
        businessEntityRepository.deleteAll()
        boundedContextRepository.deleteAll()
        businessDomainVersionRepository.deleteAll()
        businessDomainRepository.deleteAll()
        userRepository.deleteAll()
    }

    // ─── helpers ───────────────────────────────────────────────────────────────

    private Map createUserWithToken(String email, String username, String roles = "ROLE_USER,ROLE_EDITOR_DATA_GOVERNANCE,ROLE_EDITOR_PROCESS_GOVERNANCE,ROLE_EDITOR_GDPR,ROLE_EDITOR_DDD,ROLE_EDITOR_BCM,ROLE_EDITOR_TEAM_TOPOLOGIES") {
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/authentication/signup",
                new SignupRequest(email, username, "password123", "Test", "User")), Map)
        def user = userRepository.findByEmail(email).get()
        user.roles = roles
        userRepository.update(user)
        [token: resp.body().accessToken]
    }

    private String createAdminToken(String email = "admin@analytics.com", String username = "analyticsAdmin") {
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

    private String createOrgUnit(String adminToken, String name) {
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/organisational-units", [names: [[locale: "en", text: name]]])
                .bearerAuth(adminToken), Map)
        resp.body().key
    }

    private String createBusinessDomain(String adminToken, String name) {
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/business-domains", [names: [[locale: "en", text: name]]])
                .bearerAuth(adminToken), Map)
        resp.body().key
    }

    private String createBoundedContext(String adminToken, String domainKey, String name) {
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/business-domains/${domainKey}/bounded-contexts",
                [names: [[locale: "en", text: name]]])
                .bearerAuth(adminToken), Map)
        resp.body().key
    }

    private void assignOrgUnit(String token, String processKey, String... orgUnitKeys) {
        client.toBlocking().exchange(
            HttpRequest.PUT("/processes/${processKey}/executing-units", [keys: orgUnitKeys.toList()])
                .bearerAuth(token), Map)
    }

    private void assignBoundedContext(String token, String processKey, String boundedContextKey) {
        client.toBlocking().exchange(
            HttpRequest.PUT("/processes/${processKey}/bounded-context", [boundedContextKey: boundedContextKey])
                .bearerAuth(token), Map)
    }

    // ─── GET /analytics/team-insights — Auth ──────────────────────────────────

    def "GET /analytics/team-insights returns 401 without auth"() {
        when:
        client.toBlocking().exchange(HttpRequest.GET("/analytics/team-insights"), Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.UNAUTHORIZED
    }

    // ─── Empty data ────────────────────────────────────────────────────────────

    def "GET /analytics/team-insights returns 200 with empty arrays when no data"() {
        given:
        def userData = createUserWithToken("empty@analytics.com", "emptyuser")
        String token = userData.token

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.GET("/analytics/team-insights").bearerAuth(token), Map)

        then:
        response.status == HttpStatus.OK
        def body = response.body()
        // Micronaut Serde excludes empty collections from JSON by default; accept null or []
        (body.userOwnershipWorkload == null || body.userOwnershipWorkload == [])
        (body.orgUnitProcessLoad == null || body.orgUnitProcessLoad == [])
        (body.bottleneckTeams == null || body.bottleneckTeams == [])
        (body.wronglyPlacedTeams == null || body.wronglyPlacedTeams == [])
        (body.splitDomains == null || body.splitDomains == [])
        body.conwaysLawAlignment != null
        (body.conwaysLawAlignment.domainKeys == null || body.conwaysLawAlignment.domainKeys == [])
        (body.conwaysLawAlignment.orgUnitKeys == null || body.conwaysLawAlignment.orgUnitKeys == [])
        (body.conwaysLawAlignment.cells == null || body.conwaysLawAlignment.cells == [])
    }

    // ─── Ownership workload ────────────────────────────────────────────────────

    def "userOwnershipWorkload contains user with correct entity and process counts"() {
        given:
        def userData = createUserWithToken("owner@analytics.com", "owneruser")
        String token = userData.token

        and: "create 1 entity and 1 process owned by the same user"
        createBusinessEntity(token, "Entity A")
        createProcess(token, "Process A")

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.GET("/analytics/team-insights").bearerAuth(token), Map)

        then:
        response.status == HttpStatus.OK
        def workload = response.body().userOwnershipWorkload
        workload.size() == 1
        def item = workload[0]
        item.username == "owneruser"
        item.entityCount == 1
        item.processCount == 1
        item.totalCount == 2
    }

    // ─── Org unit process load ─────────────────────────────────────────────────

    def "orgUnitProcessLoad contains org unit with correct process count"() {
        given:
        def userData = createUserWithToken("unitload@analytics.com", "unitloaduser")
        String token = userData.token
        String adminToken = createAdminToken("adminunit@analytics.com", "adminunit")

        and: "create a process and assign it to an org unit"
        String processKey = createProcess(token, "Unit Load Process")
        String unitKey = createOrgUnit(adminToken, "Finance Team")
        assignOrgUnit(token, processKey, unitKey)

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.GET("/analytics/team-insights").bearerAuth(token), Map)

        then:
        response.status == HttpStatus.OK
        def load = response.body().orgUnitProcessLoad
        load.size() == 1
        def item = load[0]
        item.orgUnitKey == unitKey
        item.orgUnitName == "Finance Team"
        item.processCount == 1
    }

    // ─── Bottleneck teams ─────────────────────────────────────────────────────

    def "bottleneckTeams contains org unit executing processes in 3+ distinct domains"() {
        given:
        def userData = createUserWithToken("bottleneck@analytics.com", "bottleneckuser")
        String token = userData.token
        String adminToken = createAdminToken("adminbottleneck@analytics.com", "adminbottleneck")

        and: "create 3 domains with bounded contexts"
        String domain1Key = createBusinessDomain(adminToken, "Domain Alpha")
        String domain2Key = createBusinessDomain(adminToken, "Domain Beta")
        String domain3Key = createBusinessDomain(adminToken, "Domain Gamma")
        String bc1Key = createBoundedContext(adminToken, domain1Key, "Alpha Core")
        String bc2Key = createBoundedContext(adminToken, domain2Key, "Beta Core")
        String bc3Key = createBoundedContext(adminToken, domain3Key, "Gamma Core")

        and: "create 1 org unit and 3 processes each in a different bounded context"
        String unitKey = createOrgUnit(adminToken, "Cross Domain Team")
        String proc1Key = createProcess(token, "Process Alpha")
        String proc2Key = createProcess(token, "Process Beta")
        String proc3Key = createProcess(token, "Process Gamma")

        and: "assign bounded context and org unit to each process"
        assignBoundedContext(token, proc1Key, bc1Key)
        assignBoundedContext(token, proc2Key, bc2Key)
        assignBoundedContext(token, proc3Key, bc3Key)
        assignOrgUnit(token, proc1Key, unitKey)
        assignOrgUnit(token, proc2Key, unitKey)
        assignOrgUnit(token, proc3Key, unitKey)

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.GET("/analytics/team-insights").bearerAuth(token), Map)

        then:
        response.status == HttpStatus.OK
        def bottleneck = response.body().bottleneckTeams
        bottleneck.size() == 1
        def item = bottleneck[0]
        item.orgUnitKey == unitKey
        item.orgUnitName == "Cross Domain Team"
        item.processCount == 3
        item.distinctDomainCount == 3
        item.domainKeys.size() == 3
    }

    def "bottleneckTeams does NOT contain org unit with processes in only 1 domain"() {
        given:
        def userData = createUserWithToken("nobottleneck@analytics.com", "nobottleneckuser")
        String token = userData.token
        String adminToken = createAdminToken("adminnobottleneck@analytics.com", "adminnobottleneck")

        and: "create 1 domain with a bounded context"
        String domainKey = createBusinessDomain(adminToken, "Single Domain")
        String bcKey = createBoundedContext(adminToken, domainKey, "Single Core")

        and: "create 1 org unit and 2 processes both in the same bounded context"
        String unitKey = createOrgUnit(adminToken, "Single Domain Team")
        String proc1Key = createProcess(token, "Process Single 1")
        String proc2Key = createProcess(token, "Process Single 2")

        and:
        assignBoundedContext(token, proc1Key, bcKey)
        assignBoundedContext(token, proc2Key, bcKey)
        assignOrgUnit(token, proc1Key, unitKey)
        assignOrgUnit(token, proc2Key, unitKey)

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.GET("/analytics/team-insights").bearerAuth(token), Map)

        then:
        response.status == HttpStatus.OK
        def bottleneck = response.body().bottleneckTeams
        bottleneck.every { it.orgUnitKey != unitKey }
    }

    // ─── Team Topologies: cognitive load & anti-patterns ────────────────────────

    private void setTeamType(String adminToken, String unitKey, String type) {
        client.toBlocking().exchange(
            HttpRequest.PUT("/organisational-units/${unitKey}/team-topology-type", [teamTopologyType: type])
                .bearerAuth(adminToken), Map)
    }

    private void createInteraction(String adminToken, String source, String target, String mode, String duration) {
        client.toBlocking().exchange(
            HttpRequest.POST("/team-interactions",
                [sourceUnitKey: source, targetUnitKey: target, mode: mode, duration: duration])
                .bearerAuth(adminToken), Map)
    }

    def "cognitiveLoad flags a team whose value-stream count exceeds the threshold"() {
        given:
        def adminToken = createAdminToken()
        def userData = createUserWithToken("cog@analytics.com", "coguser")
        def token = userData.token
        def unitKey = createOrgUnit(adminToken, "Cognitive Overload Team")

        and: "8 distinct value streams (root processes) executed by the unit — over the threshold of 7"
        (1..8).each { i ->
            def procKey = createProcess(token, "Cog Process ${i}")
            assignOrgUnit(token, procKey, unitKey)
        }

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.GET("/analytics/team-insights").bearerAuth(token), Map)

        then:
        response.status == HttpStatus.OK
        def item = response.body().cognitiveLoad.find { it.orgUnitKey == unitKey }
        item != null
        item.valueStreamCount == 8
        item.score == 8.0
        item.warning == true
    }

    def "teamInteractionAntiPatterns flags two stream-aligned teams in ongoing collaboration but not x-as-a-service"() {
        given:
        def adminToken = createAdminToken()
        def token = createUserWithToken("ap@analytics.com", "apuser").token
        def a = createOrgUnit(adminToken, "AP Stream A")
        def b = createOrgUnit(adminToken, "AP Stream B")
        def c = createOrgUnit(adminToken, "AP Platform C")
        setTeamType(adminToken, a, "STREAM_ALIGNED")
        setTeamType(adminToken, b, "STREAM_ALIGNED")
        setTeamType(adminToken, c, "STREAM_ALIGNED")

        and: "an anti-pattern interaction (ongoing collaboration between two stream-aligned teams)"
        createInteraction(adminToken, a, b, "COLLABORATION", "ONGOING")
        and: "a healthy X-as-a-Service interaction"
        createInteraction(adminToken, a, c, "X_AS_A_SERVICE", "ONGOING")

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.GET("/analytics/team-insights").bearerAuth(token), Map)

        then:
        response.status == HttpStatus.OK
        def antiPatterns = response.body().teamInteractionAntiPatterns
        antiPatterns.size() == 1
        antiPatterns[0].sourceUnitKey == a
        antiPatterns[0].targetUnitKey == b

        and: "the topology graph includes the teams and edges"
        def graph = response.body().teamTopologyGraph
        graph != null
        graph.nodes.find { it.orgUnitKey == a } != null
        graph.edges.find { it.antiPattern == true } != null
    }

    def "team topology analytics are omitted when TEAM_TOPOLOGIES is disabled"() {
        given:
        def adminToken = createAdminToken()
        def a = createOrgUnit(adminToken, "Disabled A")
        def b = createOrgUnit(adminToken, "Disabled B")
        setTeamType(adminToken, a, "STREAM_ALIGNED")
        setTeamType(adminToken, b, "STREAM_ALIGNED")
        createInteraction(adminToken, a, b, "COLLABORATION", "ONGOING")

        and: "TEAM_TOPOLOGIES is disabled"
        client.toBlocking().exchange(
            HttpRequest.PUT("/administration/methodology-configurations", [
                [key: "DATA_GOVERNANCE", enabled: true],
                [key: "PROCESS_GOVERNANCE", enabled: true],
                [key: "GDPR", enabled: true],
                [key: "DDD", enabled: true],
                [key: "BCM", enabled: true],
                [key: "TEAM_TOPOLOGIES", enabled: false],
                [key: "LEAN", enabled: true],
            ]).bearerAuth(adminToken), Argument.listOf(Map))

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.GET("/analytics/team-insights").bearerAuth(adminToken), Map)

        then:
        response.status == HttpStatus.OK
        (response.body().cognitiveLoad == null || response.body().cognitiveLoad == [])
        (response.body().teamInteractionAntiPatterns == null || response.body().teamInteractionAntiPatterns == [])
        response.body().teamTopologyGraph == null
    }
}
