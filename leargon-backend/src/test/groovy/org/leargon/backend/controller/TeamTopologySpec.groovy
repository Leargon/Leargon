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
import org.leargon.backend.model.CreateOrganisationalUnitRequest
import org.leargon.backend.model.LocalizedText
import org.leargon.backend.model.LoginRequest
import org.leargon.backend.model.OrganisationalUnitResponse
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.TeamInteractionRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

@MicronautTest(transactional = false)
class TeamTopologySpec extends Specification {

    @Inject @Client("/") HttpClient client
    @Inject UserRepository userRepository
    @Inject OrganisationalUnitRepository organisationalUnitRepository
    @Inject TeamInteractionRepository teamInteractionRepository
    @Inject SupportedLocaleRepository localeRepository

    def setup() {
        if (localeRepository.count() == 0) {
            localeRepository.save(new SupportedLocale(
                localeCode: "en", displayName: "English", isDefault: true, isActive: true, sortOrder: 1))
        }
    }

    def cleanup() {
        teamInteractionRepository.deleteAll()
        def units = organisationalUnitRepository.findAll()
        units.each { u -> if (u.parents && !u.parents.isEmpty()) { u.parents.clear(); organisationalUnitRepository.update(u) } }
        organisationalUnitRepository.deleteAll()
        userRepository.deleteAll()
    }

    private String createAdminToken() {
        client.toBlocking().exchange(HttpRequest.POST("/authentication/signup",
            new SignupRequest("admin@tt.com", "ttadmin", "password123", "Admin", "User")))
        def user = userRepository.findByEmail("admin@tt.com").get()
        user.roles = "ROLE_USER,ROLE_ADMIN"
        userRepository.update(user)
        client.toBlocking().exchange(HttpRequest.POST("/authentication/login",
            new LoginRequest("admin@tt.com", "password123")), Map).body().accessToken
    }

    private Map userWithToken(String email, String username, String roles = "ROLE_USER") {
        def resp = client.toBlocking().exchange(HttpRequest.POST("/authentication/signup",
            new SignupRequest(email, username, "password123", "Test", "User")), Map)
        def user = userRepository.findByEmail(email).get()
        user.roles = roles
        userRepository.update(user)
        [token: resp.body().accessToken, username: username]
    }

    private String createUnit(String adminToken, String name, String ownerUsername = null, String stewardUsername = null) {
        def req = new CreateOrganisationalUnitRequest([new LocalizedText("en", name)])
        if (ownerUsername != null) req.businessOwnerUsername = ownerUsername
        if (stewardUsername != null) req.businessStewardUsername = stewardUsername
        client.toBlocking().exchange(HttpRequest.POST("/organisational-units", req).bearerAuth(adminToken),
            OrganisationalUnitResponse).body().key
    }

    def "admin can set the team topology type on an org unit"() {
        given:
        def adminToken = createAdminToken()
        def key = createUnit(adminToken, "TT Stream Team")

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.PUT("/organisational-units/${key}/team-topology-type", [teamTopologyType: "STREAM_ALIGNED"])
                .bearerAuth(adminToken),
            OrganisationalUnitResponse)

        then:
        response.status == HttpStatus.OK
        response.body().teamTopologyType.value == "STREAM_ALIGNED"
    }

    def "admin can create a team interaction between two units"() {
        given:
        def adminToken = createAdminToken()
        def a = createUnit(adminToken, "TT Unit A")
        def b = createUnit(adminToken, "TT Unit B")

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.POST("/team-interactions",
                [sourceUnitKey: a, targetUnitKey: b, mode: "X_AS_A_SERVICE", duration: "ONGOING", healthScore: 4])
                .bearerAuth(adminToken), Map)

        then:
        response.status == HttpStatus.CREATED
        response.body().mode == "X_AS_A_SERVICE"
        response.body().healthScore == 4
        response.body().sourceUnit.key == a
    }

    def "the steward of one unit can create an interaction touching it"() {
        given:
        def adminToken = createAdminToken()
        def steward = userWithToken("steward@tt.com", "ttsteward")
        def a = createUnit(adminToken, "TT Stewarded", null, "ttsteward")
        def b = createUnit(adminToken, "TT Other")

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.POST("/team-interactions",
                [sourceUnitKey: a, targetUnitKey: b, mode: "COLLABORATION", duration: "TEMPORARY"])
                .bearerAuth(steward.token), Map)

        then:
        response.status == HttpStatus.CREATED
    }

    def "an unrelated user cannot create an interaction"() {
        given:
        def adminToken = createAdminToken()
        def outsider = userWithToken("outsider@tt.com", "ttoutsider")
        def a = createUnit(adminToken, "TT Prot A")
        def b = createUnit(adminToken, "TT Prot B")

        when:
        client.toBlocking().exchange(
            HttpRequest.POST("/team-interactions",
                [sourceUnitKey: a, targetUnitKey: b, mode: "COLLABORATION", duration: "ONGOING"])
                .bearerAuth(outsider.token), Map)

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.FORBIDDEN
    }

    def "an interaction between a unit and itself is rejected"() {
        given:
        def adminToken = createAdminToken()
        def a = createUnit(adminToken, "TT Self")

        when:
        client.toBlocking().exchange(
            HttpRequest.POST("/team-interactions",
                [sourceUnitKey: a, targetUnitKey: a, mode: "COLLABORATION", duration: "ONGOING"])
                .bearerAuth(adminToken), Map)

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.BAD_REQUEST
    }

    def "a duplicate interaction is rejected with 409"() {
        given:
        def adminToken = createAdminToken()
        def a = createUnit(adminToken, "TT Dup A")
        def b = createUnit(adminToken, "TT Dup B")
        client.toBlocking().exchange(
            HttpRequest.POST("/team-interactions",
                [sourceUnitKey: a, targetUnitKey: b, mode: "COLLABORATION", duration: "ONGOING"])
                .bearerAuth(adminToken), Map)

        when:
        client.toBlocking().exchange(
            HttpRequest.POST("/team-interactions",
                [sourceUnitKey: a, targetUnitKey: b, mode: "X_AS_A_SERVICE", duration: "ONGOING"])
                .bearerAuth(adminToken), Map)

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.CONFLICT
    }

    def "interactions touching a unit are listed and can be deleted"() {
        given:
        def adminToken = createAdminToken()
        def a = createUnit(adminToken, "TT List A")
        def b = createUnit(adminToken, "TT List B")
        def created = client.toBlocking().exchange(
            HttpRequest.POST("/team-interactions",
                [sourceUnitKey: a, targetUnitKey: b, mode: "FACILITATING", duration: "TEMPORARY"])
                .bearerAuth(adminToken), Map)
        def id = created.body().id

        when:
        def list = client.toBlocking().exchange(
            HttpRequest.GET("/organisational-units/${a}/team-interactions").bearerAuth(adminToken),
            Argument.listOf(Map))

        then:
        list.body().size() == 1

        when:
        def del = client.toBlocking().exchange(
            HttpRequest.DELETE("/team-interactions/${id}").bearerAuth(adminToken), Void)

        then:
        del.status == HttpStatus.NO_CONTENT
    }
}
