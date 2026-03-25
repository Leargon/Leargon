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
import org.leargon.backend.model.ItSystemResponse
import org.leargon.backend.model.LoginRequest
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.repository.ItSystemRepository
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

@MicronautTest(transactional = false)
class ItSystemControllerSpec extends Specification {

    @Inject @Client("/") HttpClient client
    @Inject UserRepository userRepository
    @Inject ItSystemRepository itSystemRepository
    @Inject OrganisationalUnitRepository organisationalUnitRepository
    @Inject SupportedLocaleRepository localeRepository

    def setup() {
        if (localeRepository.count() == 0) {
            localeRepository.save(new SupportedLocale(
                localeCode: "en", displayName: "English", isDefault: true, isActive: true, sortOrder: 1))
        }
    }

    def cleanup() {
        itSystemRepository.deleteAll()
        organisationalUnitRepository.deleteAll()
        userRepository.deleteAll()
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private String createAdminToken() {
        client.toBlocking().exchange(
            HttpRequest.POST("/authentication/signup",
                new SignupRequest("admin@it.com", "itAdmin", "password123", "Admin", "User")))
        def user = userRepository.findByEmail("admin@it.com").get()
        user.roles = "ROLE_USER,ROLE_ADMIN"
        userRepository.update(user)
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/authentication/login",
                new LoginRequest("admin@it.com", "password123")), Map)
        resp.body().accessToken
    }

    private String createUserToken() {
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/authentication/signup",
                new SignupRequest("user@it.com", "itUser", "password123", "User", "User")), Map)
        resp.body().accessToken
    }

    private ItSystemResponse createItSystem(String adminToken, String name = "ERP System") {
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/it-systems", [names: [[locale: "en", text: name]]]).bearerAuth(adminToken),
            ItSystemResponse)
        resp.body()
    }

    private Map createOrgUnit(String adminToken, String name = "IT Department") {
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/organisational-units", [names: [[locale: "en", text: name]]]).bearerAuth(adminToken),
            Map)
        resp.body()
    }

    // ─── CREATE ───────────────────────────────────────────────────────────────

    def "admin can create an IT system"() {
        given:
        def adminToken = createAdminToken()

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/it-systems", [names: [[locale: "en", text: "CRM System"]]]).bearerAuth(adminToken),
            ItSystemResponse)

        then:
        resp.status() == HttpStatus.CREATED
        resp.body().key == "crm-system"
        resp.body().names[0].text == "CRM System"
        resp.body().owningUnit == null
    }

    def "non-admin cannot create an IT system"() {
        given:
        def userToken = createUserToken()

        when:
        client.toBlocking().exchange(
            HttpRequest.POST("/it-systems", [names: [[locale: "en", text: "Hack System"]]]).bearerAuth(userToken),
            Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }

    def "unauthenticated request to list IT systems is rejected"() {
        when:
        client.toBlocking().exchange(HttpRequest.GET("/it-systems"), Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.UNAUTHORIZED
    }

    // ─── READ ─────────────────────────────────────────────────────────────────

    def "authenticated user can list all IT systems"() {
        given:
        def adminToken = createAdminToken()
        createItSystem(adminToken, "System A")
        createItSystem(adminToken, "System B")

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.GET("/it-systems").bearerAuth(adminToken),
            Argument.listOf(ItSystemResponse))

        then:
        resp.status() == HttpStatus.OK
        resp.body().size() >= 2
    }

    def "can get IT system by key"() {
        given:
        def adminToken = createAdminToken()
        def created = createItSystem(adminToken, "HR System")

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.GET("/it-systems/${created.key}").bearerAuth(adminToken),
            ItSystemResponse)

        then:
        resp.status() == HttpStatus.OK
        resp.body().key == created.key
        resp.body().names[0].text == "HR System"
    }

    def "returns 404 for non-existent IT system"() {
        given:
        def adminToken = createAdminToken()

        when:
        client.toBlocking().exchange(
            HttpRequest.GET("/it-systems/non-existent").bearerAuth(adminToken), Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.NOT_FOUND
    }

    // ─── UPDATE ───────────────────────────────────────────────────────────────

    def "admin can update an IT system"() {
        given:
        def adminToken = createAdminToken()
        def created = createItSystem(adminToken, "Old System")

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.PUT("/it-systems/${created.key}", [
                names: [[locale: "en", text: "New System"]],
                descriptions: [],
                vendor: "Acme Corp"
            ]).bearerAuth(adminToken),
            ItSystemResponse)

        then:
        resp.status() == HttpStatus.OK
        resp.body().names[0].text == "New System"
        resp.body().vendor == "Acme Corp"
    }

    def "non-admin cannot update an IT system"() {
        given:
        def adminToken = createAdminToken()
        def userToken = createUserToken()
        def created = createItSystem(adminToken, "Protected System")

        when:
        client.toBlocking().exchange(
            HttpRequest.PUT("/it-systems/${created.key}", [
                names: [[locale: "en", text: "Hacked"]],
                descriptions: []
            ]).bearerAuth(userToken), Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }

    // ─── DELETE ───────────────────────────────────────────────────────────────

    def "admin can delete an IT system"() {
        given:
        def adminToken = createAdminToken()
        def created = createItSystem(adminToken, "Deletable System")

        when:
        def del = client.toBlocking().exchange(
            HttpRequest.DELETE("/it-systems/${created.key}").bearerAuth(adminToken))

        then:
        del.status() == HttpStatus.NO_CONTENT

        when:
        client.toBlocking().exchange(
            HttpRequest.GET("/it-systems/${created.key}").bearerAuth(adminToken), Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.NOT_FOUND
    }

    def "non-admin cannot delete an IT system"() {
        given:
        def adminToken = createAdminToken()
        def userToken = createUserToken()
        def created = createItSystem(adminToken, "Safe System")

        when:
        client.toBlocking().exchange(
            HttpRequest.DELETE("/it-systems/${created.key}").bearerAuth(userToken), Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }

    // ─── OWNING UNIT ──────────────────────────────────────────────────────────

    def "admin can create an IT system with an owning unit"() {
        given:
        def adminToken = createAdminToken()
        def orgUnit = createOrgUnit(adminToken, "Finance Dept")

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/it-systems", [
                names: [[locale: "en", text: "Finance ERP"]],
                owningUnitKey: orgUnit.key
            ]).bearerAuth(adminToken),
            ItSystemResponse)

        then:
        resp.status() == HttpStatus.CREATED
        resp.body().owningUnit != null
        resp.body().owningUnit.key == orgUnit.key
    }

    def "admin can assign an owning unit to an existing IT system"() {
        given:
        def adminToken = createAdminToken()
        def system = createItSystem(adminToken, "Legacy System")
        def orgUnit = createOrgUnit(adminToken, "Ops Team")

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.PUT("/it-systems/${system.key}", [
                names: [[locale: "en", text: "Legacy System"]],
                descriptions: [],
                owningUnitKey: orgUnit.key
            ]).bearerAuth(adminToken),
            ItSystemResponse)

        then:
        resp.status() == HttpStatus.OK
        resp.body().owningUnit != null
        resp.body().owningUnit.key == orgUnit.key
    }

    def "admin can remove an owning unit from an IT system"() {
        given:
        def adminToken = createAdminToken()
        def orgUnit = createOrgUnit(adminToken, "Temp Team")
        def resp1 = client.toBlocking().exchange(
            HttpRequest.POST("/it-systems", [
                names: [[locale: "en", text: "Temp System"]],
                owningUnitKey: orgUnit.key
            ]).bearerAuth(adminToken),
            ItSystemResponse)
        def system = resp1.body()

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.PUT("/it-systems/${system.key}", [
                names: [[locale: "en", text: "Temp System"]],
                descriptions: []
            ]).bearerAuth(adminToken),
            ItSystemResponse)

        then:
        resp.status() == HttpStatus.OK
        resp.body().owningUnit == null
    }

    def "creating IT system with unknown owning unit key returns 404"() {
        given:
        def adminToken = createAdminToken()

        when:
        client.toBlocking().exchange(
            HttpRequest.POST("/it-systems", [
                names: [[locale: "en", text: "Bad System"]],
                owningUnitKey: "non-existent-unit"
            ]).bearerAuth(adminToken), Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.NOT_FOUND
    }
}
