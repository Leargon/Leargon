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
import org.leargon.backend.model.LoginRequest
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.repository.BoundedContextRepository
import org.leargon.backend.repository.BusinessDomainRepository
import org.leargon.backend.repository.BusinessDomainVersionRepository
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.BusinessEntityVersionRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.TranslationLinkRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

@MicronautTest(transactional = false)
class TranslationLinkControllerSpec extends Specification {

    @Inject @Client("/") HttpClient client

    @Inject UserRepository userRepository
    @Inject SupportedLocaleRepository localeRepository
    @Inject TranslationLinkRepository translationLinkRepository
    @Inject BusinessEntityRepository businessEntityRepository
    @Inject BusinessEntityVersionRepository businessEntityVersionRepository
    @Inject BoundedContextRepository boundedContextRepository
    @Inject BusinessDomainRepository businessDomainRepository
    @Inject BusinessDomainVersionRepository businessDomainVersionRepository

    def setup() {
        if (localeRepository.count() == 0) {
            localeRepository.save(new SupportedLocale(
                localeCode: "en", displayName: "English", isDefault: true, isActive: true, sortOrder: 1))
        }
    }

    def cleanup() {
        translationLinkRepository.deleteAll()
        businessEntityVersionRepository.deleteAll()
        businessEntityRepository.deleteAll()
        boundedContextRepository.deleteAll()
        businessDomainVersionRepository.deleteAll()
        businessDomainRepository.findAll().each { businessDomainRepository.delete(it) }
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
        def email = "admin-tl-${System.currentTimeMillis()}@test.com"
        def username = "adminTl${System.currentTimeMillis()}"
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

    private String createDomain(String adminToken, String name) {
        def body = [names: [[locale: "en", text: name]]]
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/business-domains", body).bearerAuth(adminToken), Map)
        resp.body().key
    }

    private String createBoundedContext(String adminToken, String domainKey, String name) {
        def body = [names: [[locale: "en", text: name]]]
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/business-domains/${domainKey}/bounded-contexts", body).bearerAuth(adminToken), Map)
        resp.body().key
    }

    private String createEntity(String token, String name) {
        def body = [names: [[locale: "en", text: name]]]
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/business-entities", body).bearerAuth(token), Map)
        resp.body().key
    }

    private String assignBoundedContext(String token, String entityKey, String bcKey) {
        def body = [boundedContextKey: bcKey]
        client.toBlocking().exchange(
            HttpRequest.PUT("/business-entities/${entityKey}/bounded-context", body).bearerAuth(token), Map)
        bcKey
    }

    // ─── GET /business-entities/{key}/translation-links ──────────────────────

    def "GET /business-entities/{key}/translation-links returns empty list for new entity"() {
        given:
        def userData = createUserWithToken("tl-reader@test.com", "tlReader")
        def entityKey = createEntity(userData.token, "Entity With No Links")

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.GET("/business-entities/${entityKey}/translation-links").bearerAuth(userData.token),
            Argument.listOf(Map)
        )

        then:
        response.status == HttpStatus.OK
        response.body().isEmpty()
    }

    def "GET /business-entities/{key}/translation-links returns 404 for unknown entity"() {
        given:
        def userData = createUserWithToken("tl-user-404@test.com", "tlUser404")

        when:
        client.toBlocking().exchange(
            HttpRequest.GET("/business-entities/nonexistent-entity/translation-links").bearerAuth(userData.token),
            Argument.listOf(Map)
        )

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.NOT_FOUND
    }

    def "GET /business-entities/{key}/translation-links returns 401 without auth"() {
        given:
        def userData = createUserWithToken("tl-unauth@test.com", "tlUnauth")
        def entityKey = createEntity(userData.token, "Unauth Entity")

        when:
        client.toBlocking().exchange(
            HttpRequest.GET("/business-entities/${entityKey}/translation-links"),
            Argument.listOf(Map)
        )

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.UNAUTHORIZED
    }

    // ─── POST /translation-links ──────────────────────────────────────────────

    def "POST /translation-links creates link between entities in different bounded contexts"() {
        given:
        def adminToken = createAdminToken()
        def userData = createUserWithToken("tl-creator@test.com", "tlCreator")
        def domainKey1 = createDomain(adminToken, "Domain For TL 1")
        def domainKey2 = createDomain(adminToken, "Domain For TL 2")
        def bcKey1 = createBoundedContext(adminToken, domainKey1, "BC One TL")
        def bcKey2 = createBoundedContext(adminToken, domainKey2, "BC Two TL")
        def entityKey1 = createEntity(userData.token, "Customer Entity")
        def entityKey2 = createEntity(userData.token, "Kunde Entity")
        assignBoundedContext(userData.token, entityKey1, bcKey1)
        assignBoundedContext(userData.token, entityKey2, bcKey2)

        def body = [
            firstEntityKey        : entityKey1,
            secondEntityKey       : entityKey2,
            semanticDifferenceNote: "Customer in BC1 includes billing info, Kunde in BC2 is just identity"
        ]

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.POST("/translation-links", body).bearerAuth(userData.token),
            Map
        )

        then:
        response.status == HttpStatus.CREATED
        def link = response.body()
        link.id != null
        link.linkedEntity.key == entityKey2
        link.semanticDifferenceNote == "Customer in BC1 includes billing info, Kunde in BC2 is just identity"
    }

    def "POST /translation-links creates link without semantic note"() {
        given:
        def userData = createUserWithToken("tl-no-note@test.com", "tlNoNote")
        def entityKey1 = createEntity(userData.token, "Entity Without Note A")
        def entityKey2 = createEntity(userData.token, "Entity Without Note B")
        def body = [
            firstEntityKey : entityKey1,
            secondEntityKey: entityKey2
        ]

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.POST("/translation-links", body).bearerAuth(userData.token),
            Map
        )

        then:
        response.status == HttpStatus.CREATED
        response.body().semanticDifferenceNote == null
    }

    def "POST /translation-links returns 404 for unknown first entity"() {
        given:
        def userData = createUserWithToken("tl-missing1@test.com", "tlMissing1")
        def entityKey2 = createEntity(userData.token, "Real Entity")
        def body = [firstEntityKey: "nonexistent-entity", secondEntityKey: entityKey2]

        when:
        client.toBlocking().exchange(
            HttpRequest.POST("/translation-links", body).bearerAuth(userData.token),
            Map
        )

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.NOT_FOUND
    }

    def "POST /translation-links returns 404 for unknown second entity"() {
        given:
        def userData = createUserWithToken("tl-missing2@test.com", "tlMissing2")
        def entityKey1 = createEntity(userData.token, "Real Entity 2")
        def body = [firstEntityKey: entityKey1, secondEntityKey: "nonexistent-entity"]

        when:
        client.toBlocking().exchange(
            HttpRequest.POST("/translation-links", body).bearerAuth(userData.token),
            Map
        )

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.NOT_FOUND
    }

    def "POST /translation-links returns 400 for duplicate link"() {
        given:
        def userData = createUserWithToken("tl-dup@test.com", "tlDup")
        def entityKey1 = createEntity(userData.token, "Dup Entity A")
        def entityKey2 = createEntity(userData.token, "Dup Entity B")
        def body = [firstEntityKey: entityKey1, secondEntityKey: entityKey2]
        client.toBlocking().exchange(
            HttpRequest.POST("/translation-links", body).bearerAuth(userData.token), Map)

        when:
        client.toBlocking().exchange(
            HttpRequest.POST("/translation-links", body).bearerAuth(userData.token),
            Map
        )

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.BAD_REQUEST
    }

    def "POST /translation-links returns 401 without auth"() {
        given:
        def userData = createUserWithToken("tl-unauth2@test.com", "tlUnauth2")
        def entityKey1 = createEntity(userData.token, "Unauth Entity A")
        def entityKey2 = createEntity(userData.token, "Unauth Entity B")
        def body = [firstEntityKey: entityKey1, secondEntityKey: entityKey2]

        when:
        client.toBlocking().exchange(HttpRequest.POST("/translation-links", body), Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.UNAUTHORIZED
    }

    // ─── PUT /translation-links/{id} ──────────────────────────────────────────

    def "PUT /translation-links/{id} updates semantic note"() {
        given:
        def userData = createUserWithToken("tl-updater@test.com", "tlUpdater")
        def entityKey1 = createEntity(userData.token, "Update Entity A")
        def entityKey2 = createEntity(userData.token, "Update Entity B")
        def createBody = [firstEntityKey: entityKey1, secondEntityKey: entityKey2, semanticDifferenceNote: "Old note"]
        def created = client.toBlocking().exchange(
            HttpRequest.POST("/translation-links", createBody).bearerAuth(userData.token), Map)
        def linkId = created.body().id

        def updateBody = [semanticDifferenceNote: "Updated note"]

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.PUT("/translation-links/${linkId}", updateBody).bearerAuth(userData.token),
            Map
        )

        then:
        response.status == HttpStatus.OK
        response.body().semanticDifferenceNote == "Updated note"
    }

    def "PUT /translation-links/{id} returns 403 when user is not creator or admin"() {
        given:
        def creatorData = createUserWithToken("tl-creator2@test.com", "tlCreator2")
        def otherData = createUserWithToken("tl-other@test.com", "tlOther")
        def entityKey1 = createEntity(creatorData.token, "Creator Entity A")
        def entityKey2 = createEntity(creatorData.token, "Creator Entity B")
        def createBody = [firstEntityKey: entityKey1, secondEntityKey: entityKey2]
        def created = client.toBlocking().exchange(
            HttpRequest.POST("/translation-links", createBody).bearerAuth(creatorData.token), Map)
        def linkId = created.body().id

        when:
        client.toBlocking().exchange(
            HttpRequest.PUT("/translation-links/${linkId}", [semanticDifferenceNote: "Hostile update"]).bearerAuth(otherData.token),
            Map
        )

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }

    def "PUT /translation-links/{id} admin can update any link"() {
        given:
        def adminToken = createAdminToken()
        def userData = createUserWithToken("tl-admin-update@test.com", "tlAdminUpdate")
        def entityKey1 = createEntity(userData.token, "Admin Update Entity A")
        def entityKey2 = createEntity(userData.token, "Admin Update Entity B")
        def createBody = [firstEntityKey: entityKey1, secondEntityKey: entityKey2, semanticDifferenceNote: "Original"]
        def created = client.toBlocking().exchange(
            HttpRequest.POST("/translation-links", createBody).bearerAuth(userData.token), Map)
        def linkId = created.body().id

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.PUT("/translation-links/${linkId}", [semanticDifferenceNote: "Admin updated"]).bearerAuth(adminToken),
            Map
        )

        then:
        response.status == HttpStatus.OK
        response.body().semanticDifferenceNote == "Admin updated"
    }

    def "PUT /translation-links/{id} returns 404 for unknown id"() {
        given:
        def userData = createUserWithToken("tl-put404@test.com", "tlPut404")

        when:
        client.toBlocking().exchange(
            HttpRequest.PUT("/translation-links/999999", [semanticDifferenceNote: "No such link"]).bearerAuth(userData.token),
            Map
        )

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.NOT_FOUND
    }

    // ─── DELETE /translation-links/{id} ───────────────────────────────────────

    def "DELETE /translation-links/{id} removes link for creator"() {
        given:
        def userData = createUserWithToken("tl-delete@test.com", "tlDelete")
        def entityKey1 = createEntity(userData.token, "Delete Entity A")
        def entityKey2 = createEntity(userData.token, "Delete Entity B")
        def createBody = [firstEntityKey: entityKey1, secondEntityKey: entityKey2]
        def created = client.toBlocking().exchange(
            HttpRequest.POST("/translation-links", createBody).bearerAuth(userData.token), Map)
        def linkId = created.body().id

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.DELETE("/translation-links/${linkId}").bearerAuth(userData.token),
            Void
        )

        then:
        response.status == HttpStatus.NO_CONTENT

        and:
        def listResp = client.toBlocking().exchange(
            HttpRequest.GET("/business-entities/${entityKey1}/translation-links").bearerAuth(userData.token),
            Argument.listOf(Map)
        )
        listResp.body().isEmpty()
    }

    def "DELETE /translation-links/{id} returns 403 for non-creator non-admin"() {
        given:
        def creatorData = createUserWithToken("tl-del-creator@test.com", "tlDelCreator")
        def otherData = createUserWithToken("tl-del-other@test.com", "tlDelOther")
        def entityKey1 = createEntity(creatorData.token, "Del Creator Entity A")
        def entityKey2 = createEntity(creatorData.token, "Del Creator Entity B")
        def createBody = [firstEntityKey: entityKey1, secondEntityKey: entityKey2]
        def created = client.toBlocking().exchange(
            HttpRequest.POST("/translation-links", createBody).bearerAuth(creatorData.token), Map)
        def linkId = created.body().id

        when:
        client.toBlocking().exchange(
            HttpRequest.DELETE("/translation-links/${linkId}").bearerAuth(otherData.token),
            Void
        )

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }

    def "DELETE /translation-links/{id} returns 404 for unknown id"() {
        given:
        def userData = createUserWithToken("tl-del404@test.com", "tlDel404")

        when:
        client.toBlocking().exchange(
            HttpRequest.DELETE("/translation-links/999999").bearerAuth(userData.token),
            Void
        )

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.NOT_FOUND
    }

    // ─── translation links visible from both entity perspectives ──────────────

    def "GET translation-links returns link from both entity perspectives"() {
        given:
        def userData = createUserWithToken("tl-bilateral@test.com", "tlBilateral")
        def entityKey1 = createEntity(userData.token, "Bilateral Entity A")
        def entityKey2 = createEntity(userData.token, "Bilateral Entity B")
        def body = [firstEntityKey: entityKey1, secondEntityKey: entityKey2, semanticDifferenceNote: "Bilateral note"]
        client.toBlocking().exchange(
            HttpRequest.POST("/translation-links", body).bearerAuth(userData.token), Map)

        when:
        def linksFromFirst = client.toBlocking().exchange(
            HttpRequest.GET("/business-entities/${entityKey1}/translation-links").bearerAuth(userData.token),
            Argument.listOf(Map)
        )
        def linksFromSecond = client.toBlocking().exchange(
            HttpRequest.GET("/business-entities/${entityKey2}/translation-links").bearerAuth(userData.token),
            Argument.listOf(Map)
        )

        then:
        linksFromFirst.body().size() == 1
        linksFromFirst.body()[0].linkedEntity.key == entityKey2

        and:
        linksFromSecond.body().size() == 1
        linksFromSecond.body()[0].linkedEntity.key == entityKey1
    }
}
