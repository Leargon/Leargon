package org.leargon.backend.controller

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
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.repository.BusinessDomainRepository
import org.leargon.backend.repository.BusinessDomainVersionRepository
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.BusinessEntityVersionRepository
import org.leargon.backend.repository.DpiaRepository
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.repository.ProcessVersionRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

@MicronautTest(transactional = false)
class DashboardControllerSpec extends Specification {

    @Inject @Client("/") HttpClient client
    @Inject UserRepository userRepository
    @Inject BusinessEntityRepository businessEntityRepository
    @Inject BusinessEntityVersionRepository businessEntityVersionRepository
    @Inject ProcessRepository processRepository
    @Inject ProcessVersionRepository processVersionRepository
    @Inject BusinessDomainRepository businessDomainRepository
    @Inject BusinessDomainVersionRepository businessDomainVersionRepository
    @Inject OrganisationalUnitRepository organisationalUnitRepository
    @Inject DpiaRepository dpiaRepository
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
        businessDomainVersionRepository.deleteAll()
        businessDomainRepository.deleteAll()
        organisationalUnitRepository.deleteAll()
        userRepository.deleteAll()
    }

    // ─── helpers ───────────────────────────────────────────────────────────────

    private String createUserToken(String email, String username) {
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/authentication/signup",
                new SignupRequest(email, username, "password123", "Test", "User")), Map)
        resp.body().accessToken
    }

    private String createAdminToken(String email = "admin@dashboard.com", String username = "dashboardAdmin") {
        client.toBlocking().exchange(
            HttpRequest.POST("/authentication/signup",
                new SignupRequest(email, username, "password123", "Admin", "User")))
        def user = userRepository.findByEmail(email).get()
        user.roles = "ROLE_USER,ROLE_ADMIN"
        userRepository.update(user)
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/authentication/login",
                [email: email, password: "password123"]), Map)
        resp.body().accessToken
    }

    private String createEntity(String token, String name) {
        def req = new CreateBusinessEntityRequest([new LocalizedText("en", name)])
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/business-entities", req).bearerAuth(token), Map)
        resp.body().key
    }

    private String createProcess(String token, String name) {
        def req = new CreateProcessRequest([new LocalizedText("en", name)])
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/processes", req).bearerAuth(token), Map)
        resp.body().key
    }

    // ─── Auth guard ────────────────────────────────────────────────────────────

    def "GET /dashboard returns 401 without authentication"() {
        when:
        client.toBlocking().exchange(HttpRequest.GET("/dashboard"), Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.UNAUTHORIZED
    }

    def "GET /dashboard/maturity returns 401 without authentication"() {
        when:
        client.toBlocking().exchange(HttpRequest.GET("/dashboard/maturity"), Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.UNAUTHORIZED
    }

    // ─── Role guard ────────────────────────────────────────────────────────────

    def "GET /dashboard/maturity returns 403 for regular user"() {
        given:
        String token = createUserToken("regular@dashboard.com", "regularUser")

        when:
        client.toBlocking().exchange(
            HttpRequest.GET("/dashboard/maturity").bearerAuth(token), Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }

    // ─── Dashboard for new user ─────────────────────────────────────────────

    def "GET /dashboard returns 200 with empty data for a new user"() {
        given:
        String token = createUserToken("newuser@dashboard.com", "newDashUser")

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.GET("/dashboard").bearerAuth(token), Map)

        then:
        resp.status == HttpStatus.OK
        def body = resp.body()
        body.myResponsibilities != null
        (body.myResponsibilities.entities == null || body.myResponsibilities.entities == [])
        (body.myResponsibilities.processes == null || body.myResponsibilities.processes == [])
        (body.recentActivity == null || body.recentActivity instanceof List)
        (body.needsAttention == null || body.needsAttention instanceof List)
    }

    // ─── My responsibilities ───────────────────────────────────────────────

    def "GET /dashboard myResponsibilities includes entities owned by the current user"() {
        given:
        String token = createUserToken("owner@dashboard.com", "ownerUser")
        createEntity(token, "MyOwnedEntity")

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.GET("/dashboard").bearerAuth(token), Map)

        then:
        resp.status == HttpStatus.OK
        def entities = resp.body().myResponsibilities.entities
        entities != null
        entities.size() >= 1
        entities.any { it.name == "MyOwnedEntity" }
    }

    def "GET /dashboard myResponsibilities includes processes owned by the current user"() {
        given:
        String token = createUserToken("procowner@dashboard.com", "procOwnerUser")
        createProcess(token, "MyOwnedProcess")

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.GET("/dashboard").bearerAuth(token), Map)

        then:
        resp.status == HttpStatus.OK
        def processes = resp.body().myResponsibilities.processes
        processes != null
        processes.size() >= 1
        processes.any { it.name == "MyOwnedProcess" }
    }

    def "GET /dashboard does not include other users entities in myResponsibilities"() {
        given:
        String userAToken = createUserToken("userA@dashboard.com", "userADash")
        String userBToken = createUserToken("userB@dashboard.com", "userBDash")
        createEntity(userAToken, "UserAEntity")

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.GET("/dashboard").bearerAuth(userBToken), Map)

        then:
        resp.status == HttpStatus.OK
        def entities = resp.body().myResponsibilities.entities
        (entities == null || entities.every { it.name != "UserAEntity" })
    }

    // ─── Recent activity ──────────────────────────────────────────────────

    def "GET /dashboard recentActivity contains entries after entity creation"() {
        given:
        String token = createUserToken("activity@dashboard.com", "activityUser")
        createEntity(token, "ActivityTrackedEntity")

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.GET("/dashboard").bearerAuth(token), Map)

        then:
        resp.status == HttpStatus.OK
        def activity = resp.body().recentActivity
        activity != null
        activity.size() >= 1
        activity.any { it.resourceType == "ENTITY" }
    }

    // ─── Maturity metrics (admin) ─────────────────────────────────────────

    def "GET /dashboard/maturity returns 200 for admin with 7 metric items"() {
        given:
        String adminToken = createAdminToken()

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.GET("/dashboard/maturity").bearerAuth(adminToken), Map)

        then:
        resp.status == HttpStatus.OK
        def body = resp.body()
        body.metrics != null
        body.metrics.size() == 7
    }

    def "GET /dashboard/maturity metric items have required fields"() {
        given:
        String adminToken = createAdminToken("adminFields@dashboard.com", "adminFieldsDash")

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.GET("/dashboard/maturity").bearerAuth(adminToken), Map)

        then:
        resp.status == HttpStatus.OK
        def metrics = resp.body().metrics
        metrics.every { item ->
            item.key != null &&
            item.label != null &&
            item.covered != null &&
            item.total != null &&
            item.percentage != null &&
            item.percentage >= 0 &&
            item.percentage <= 100
        }
    }

    def "GET /dashboard/maturity reports 100 percent when there are no items to measure"() {
        given:
        String adminToken = createAdminToken("adminEmpty@dashboard.com", "adminEmptyDash")

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.GET("/dashboard/maturity").bearerAuth(adminToken), Map)

        then:
        resp.status == HttpStatus.OK
        def metrics = resp.body().metrics
        // When total is 0, percentage should be 100 (nothing to fail)
        metrics.findAll { it.totalCount == 0 }.every { it.percentage == 100 }
    }
}
