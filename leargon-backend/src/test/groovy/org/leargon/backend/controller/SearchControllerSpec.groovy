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
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.repository.ProcessVersionRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

@MicronautTest(transactional = false)
class SearchControllerSpec extends Specification {

    @Inject @Client("/") HttpClient client
    @Inject UserRepository userRepository
    @Inject BusinessEntityRepository businessEntityRepository
    @Inject BusinessEntityVersionRepository businessEntityVersionRepository
    @Inject ProcessRepository processRepository
    @Inject ProcessVersionRepository processVersionRepository
    @Inject BusinessDomainRepository businessDomainRepository
    @Inject BusinessDomainVersionRepository businessDomainVersionRepository
    @Inject OrganisationalUnitRepository organisationalUnitRepository
    @Inject SupportedLocaleRepository localeRepository

    def setup() {
        if (localeRepository.count() == 0) {
            localeRepository.save(new SupportedLocale(
                localeCode: "en", displayName: "English", isDefault: true, isActive: true, sortOrder: 1))
        }
    }

    def cleanup() {
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

    private String createAdminToken(String email = "admin@search.com", String username = "searchAdmin") {
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

    private String createEntity(String token, String name, String description = null) {
        def names = [new LocalizedText("en", name)]
        def req = new CreateBusinessEntityRequest(names)
        if (description) req.descriptions = [new LocalizedText("en", description)]
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/business-entities", req).bearerAuth(token), Map)
        resp.body().key
    }

    private String createDomain(String adminToken, String name) {
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/business-domains", [names: [[locale: "en", text: name]]])
                .bearerAuth(adminToken), Map)
        resp.body().key
    }

    private String createProcess(String token, String name) {
        def req = new CreateProcessRequest([new LocalizedText("en", name)])
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/processes", req).bearerAuth(token), Map)
        resp.body().key
    }

    private String createOrgUnit(String adminToken, String name) {
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/organisational-units", [names: [[locale: "en", text: name]]])
                .bearerAuth(adminToken), Map)
        resp.body().key
    }

    // ─── Auth guard ────────────────────────────────────────────────────────────

    def "GET /search returns 401 without authentication"() {
        when:
        client.toBlocking().exchange(
            HttpRequest.GET("/search?q=test"), Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.UNAUTHORIZED
    }

    // ─── Input validation ──────────────────────────────────────────────────────

    def "GET /search returns 400 when query is shorter than 2 characters"() {
        given:
        String token = createUserToken("short@search.com", "shortuser")

        when:
        client.toBlocking().exchange(
            HttpRequest.GET("/search?q=a").bearerAuth(token), Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.BAD_REQUEST
    }

    // ─── Entity search ─────────────────────────────────────────────────────────

    def "GET /search finds a business entity by name"() {
        given:
        String token = createUserToken("entitysearch@search.com", "entitysearchuser")
        createEntity(token, "UniqueSearchableEntityXYZ")

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.GET("/search?q=UniqueSearchableEntityXYZ").bearerAuth(token), Map)

        then:
        resp.status == HttpStatus.OK
        def body = resp.body()
        body.query == "UniqueSearchableEntityXYZ"
        body.totalCount >= 1
        def result = body.results.find { it.type == "BUSINESS_ENTITY" }
        result != null
        result.matchedIn == "NAME"
    }

    def "GET /search finds a business entity by description"() {
        given:
        String token = createUserToken("descSearch@search.com", "descSearchUser")
        createEntity(token, "UnrelatedEntityName", "DescriptionContainsSearchTermZZZ")

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.GET("/search?q=SearchTermZZZ").bearerAuth(token), Map)

        then:
        resp.status == HttpStatus.OK
        def result = resp.body().results.find { it.type == "BUSINESS_ENTITY" }
        result != null
        result.matchedIn == "DESCRIPTION"
    }

    // ─── Domain search ─────────────────────────────────────────────────────────

    def "GET /search finds a business domain by name"() {
        given:
        String adminToken = createAdminToken("domainSearchAdmin@search.com", "domainSearchAdmin")
        createDomain(adminToken, "UniqueSearchableDomainABC")

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.GET("/search?q=UniqueSearchableDomainABC").bearerAuth(adminToken), Map)

        then:
        resp.status == HttpStatus.OK
        def result = resp.body().results.find { it.type == "BUSINESS_DOMAIN" }
        result != null
        result.matchedIn == "NAME"
    }

    // ─── Process search ────────────────────────────────────────────────────────

    def "GET /search finds a business process by name"() {
        given:
        String token = createUserToken("processSearch@search.com", "processSearchUser")
        createProcess(token, "UniqueSearchableProcessQQQ")

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.GET("/search?q=UniqueSearchableProcessQQQ").bearerAuth(token), Map)

        then:
        resp.status == HttpStatus.OK
        def result = resp.body().results.find { it.type == "BUSINESS_PROCESS" }
        result != null
        result.matchedIn == "NAME"
    }

    // ─── Org unit search ───────────────────────────────────────────────────────

    def "GET /search finds an organisational unit by name"() {
        given:
        String adminToken = createAdminToken("orgSearch@search.com", "orgSearchAdmin")
        createOrgUnit(adminToken, "UniqueSearchableOrgUnitMMM")

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.GET("/search?q=UniqueSearchableOrgUnitMMM").bearerAuth(adminToken), Map)

        then:
        resp.status == HttpStatus.OK
        def result = resp.body().results.find { it.type == "ORGANISATIONAL_UNIT" }
        result != null
        result.matchedIn == "NAME"
    }

    // ─── Type filtering ────────────────────────────────────────────────────────

    def "GET /search with types filter returns only matching type"() {
        given:
        String token = createUserToken("typeFilter@search.com", "typeFilterUser")
        String adminToken = createAdminToken("typeFilterAdmin@search.com", "typeFilterAdmin")
        createEntity(token, "FilterTarget Entity")
        createDomain(adminToken, "FilterTarget Domain")

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.GET("/search?q=FilterTarget&types=BUSINESS_ENTITY").bearerAuth(token), Map)

        then:
        resp.status == HttpStatus.OK
        def results = resp.body().results
        results.every { it.type == "BUSINESS_ENTITY" }
        results.any { it.type == "BUSINESS_ENTITY" }
        results.every { it.type != "BUSINESS_DOMAIN" }
    }

    def "GET /search with multiple types filter returns only those types"() {
        given:
        String token = createUserToken("multiType@search.com", "multiTypeUser")
        String adminToken = createAdminToken("multiTypeAdmin@search.com", "multiTypeAdmin")
        createEntity(token, "MultiTypeTarget Entity")
        createProcess(token, "MultiTypeTarget Process")
        createDomain(adminToken, "MultiTypeTarget Domain")

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.GET("/search?q=MultiTypeTarget&types=BUSINESS_ENTITY&types=BUSINESS_PROCESS")
                .bearerAuth(token), Map)

        then:
        resp.status == HttpStatus.OK
        def results = resp.body().results
        results.every { it.type in ["BUSINESS_ENTITY", "BUSINESS_PROCESS"] }
        results.every { it.type != "BUSINESS_DOMAIN" }
    }

    // ─── Result ordering ───────────────────────────────────────────────────────

    def "GET /search returns name matches before description matches"() {
        given:
        String token = createUserToken("order@search.com", "orderUser")
        createEntity(token, "UnrelatedNameXYZ", "descriptionContainsOrderTerm")
        createEntity(token, "orderTermInNameXYZ")

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.GET("/search?q=orderTerm").bearerAuth(token), Map)

        then:
        resp.status == HttpStatus.OK
        def results = resp.body().results.findAll { it.type == "BUSINESS_ENTITY" }
        results.size() == 2
        results[0].matchedIn == "NAME"
        results[1].matchedIn == "DESCRIPTION"
    }

    // ─── Limit ─────────────────────────────────────────────────────────────────

    def "GET /search respects limit parameter"() {
        given:
        String token = createUserToken("limit@search.com", "limitUser")
        (1..5).each { i -> createEntity(token, "LimitableEntity${i}") }

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.GET("/search?q=LimitableEntity&limit=3").bearerAuth(token), Map)

        then:
        resp.status == HttpStatus.OK
        resp.body().results.size() == 3
        resp.body().totalCount >= 5
    }

    // ─── No match ──────────────────────────────────────────────────────────────

    def "GET /search returns empty results when nothing matches"() {
        given:
        String token = createUserToken("nomatch@search.com", "nomatchUser")

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.GET("/search?q=completelyNonExistentTerm9999").bearerAuth(token), Map)

        then:
        resp.status == HttpStatus.OK
        (resp.body().results == null || resp.body().results == [])
        resp.body().totalCount == 0
    }
}
