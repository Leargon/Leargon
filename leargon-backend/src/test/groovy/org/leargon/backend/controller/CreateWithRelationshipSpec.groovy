package org.leargon.backend.controller

import io.micronaut.http.HttpRequest
import io.micronaut.http.client.HttpClient
import io.micronaut.http.client.annotation.Client
import io.micronaut.http.client.exceptions.HttpClientResponseException
import io.micronaut.test.extensions.spock.annotation.MicronautTest
import jakarta.inject.Inject
import org.leargon.backend.domain.SupportedLocale
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.repository.BoundedContextRepository
import org.leargon.backend.repository.BusinessDomainRepository
import org.leargon.backend.repository.BusinessDomainVersionRepository
import org.leargon.backend.repository.BusinessEntityRelationshipRepository
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.BusinessEntityVersionRepository
import org.leargon.backend.repository.ItemCreationRecordRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

/**
 * "New root entity with a relationship": the advisor's alternative to a child entity. The entity and its
 * relationship to an existing entity are created in one request — atomic, and possible even when the
 * creator delegates ownership (a separate relationship request would then be refused).
 */
@MicronautTest(transactional = false)
class CreateWithRelationshipSpec extends Specification {

    @Inject @Client("/") HttpClient client
    @Inject UserRepository userRepository
    @Inject SupportedLocaleRepository localeRepository
    @Inject ItemCreationRecordRepository itemCreationRecordRepository
    @Inject BusinessEntityRelationshipRepository businessEntityRelationshipRepository
    @Inject BusinessEntityRepository businessEntityRepository
    @Inject BusinessEntityVersionRepository businessEntityVersionRepository
    @Inject BoundedContextRepository boundedContextRepository
    @Inject BusinessDomainRepository businessDomainRepository
    @Inject BusinessDomainVersionRepository businessDomainVersionRepository

    def setup() {
        if (localeRepository.findByLocaleCode("en").isEmpty()) {
            localeRepository.save(new SupportedLocale(localeCode: "en", displayName: "English", isDefault: true, isActive: true, sortOrder: 1))
        }
    }

    def cleanup() {
        itemCreationRecordRepository.deleteAll()
        businessEntityRelationshipRepository.deleteAll()
        businessEntityVersionRepository.deleteAll()
        businessEntityRepository.deleteAll()
        boundedContextRepository.deleteAll()
        businessDomainVersionRepository.deleteAll()
        businessDomainRepository.deleteAll()
        userRepository.deleteAll()
    }

    private String token(String email, String username, String roles = "ROLE_USER") {
        def resp = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/signup", new SignupRequest(email, username, "password123", "Test", username)), Map)
        def u = userRepository.findByEmail(email).get()
        u.roles = roles
        userRepository.update(u)
        return resp.body().accessToken
    }

    private Map send(HttpRequest request) {
        try {
            def resp = client.toBlocking().exchange(request, Map)
            return [status: resp.status().code, body: resp.body()]
        } catch (HttpClientResponseException e) {
            return [status: e.status.code, body: e.response.getBody(Map).orElse(null)]
        }
    }

    private Map post(String path, Map body, String token) { send(HttpRequest.POST(path, body).bearerAuth(token)) }

    private Map get(String path, String token) { send(HttpRequest.GET(path).bearerAuth(token)).body }

    private static List names(String text) { [[locale: "en", text: text]] }

    /** "Each Customer can have several of it; each belongs to exactly one Customer." */
    private static Map toCustomer(String customer) {
        [secondEntityKey: customer, firstCardinalityMinimum: 0, firstCardinalityMaximum: null,
         secondCardinalityMinimum: 1, secondCardinalityMaximum: 1]
    }

    /** Context "Sales" owned by bob, holding "Customer" (owned by bob). */
    private Map fixture() {
        def admin = token("cwr-admin@test.com", "cwradmin", "ROLE_USER,ROLE_ADMIN")
        def f = [admin: admin, bob: token("cwr-bob@test.com", "cwrbob")]
        token("cwr-carol@test.com", "cwrcarol")
        def domain = post("/business-domains", [names: names("Commerce")], admin).body.key
        f.sales = post("/business-domains/$domain/bounded-contexts", [names: names("Sales"), ownerUsername: "cwrbob"], admin).body.key
        f.customer = post("/business-entities", [names: names("Customer"), boundedContextKey: f.sales, dataOwnerUsername: "cwrbob"], admin).body.key
        return f
    }

    def "a root entity and its relationship are created in one request, visible from both sides"() {
        given:
        def f = fixture()

        when:
        def res = post("/business-entities", [names: names("Address"), boundedContextKey: f.sales, relationships: [toCustomer(f.customer)]], f.bob)

        then:
        res.status == 201
        def address = get("/business-entities/${res.body.key}", f.bob)
        address.parent == null
        address.relationships.size() == 1
        def ends = address.relationships[0].cardinality
        ends.find { it.businessEntity.key == res.body.key }.minimum == 0
        ends.find { it.businessEntity.key == res.body.key }.maximum == null
        ends.find { it.businessEntity.key == f.customer }.minimum == 1
        ends.find { it.businessEntity.key == f.customer }.maximum == 1

        and: "the existing entity shows it too"
        get("/business-entities/${f.customer}", f.bob).relationships.size() == 1
    }

    def "the relationship is created even when ownership is delegated — a later relationship request would be refused"() {
        given:
        def f = fixture()

        when:
        def res = post("/business-entities", [names: names("Address"), boundedContextKey: f.sales, dataOwnerUsername: "cwrcarol",
                                              relationships: [toCustomer(f.customer)]], f.bob)

        then:
        res.status == 201
        get("/business-entities/${res.body.key}", f.bob).relationships.size() == 1

        and: "bob no longer edits the delegated entity"
        post("/business-entities/${res.body.key}/relationships", toCustomer(f.customer), f.bob).status == 403
    }

    def "an unknown related entity is refused (404) and nothing is created"() {
        given:
        def f = fixture()
        def before = businessEntityRepository.count()

        when:
        def res = post("/business-entities", [names: names("Address"), boundedContextKey: f.sales, relationships: [toCustomer("no-such-entity")]], f.bob)

        then:
        res.status == 404
        businessEntityRepository.count() == before
    }

    def "an impossible cardinality is refused (400)"() {
        given:
        def f = fixture()

        expect:
        post("/business-entities", [names: names("Address"), boundedContextKey: f.sales,
                                    relationships: [toCustomer(f.customer) + cardinality]], f.bob).status == 400

        where:
        cardinality << [[firstCardinalityMinimum: -1], [secondCardinalityMinimum: 2, secondCardinalityMaximum: 1], [firstCardinalityMaximum: 0]]
    }

    def "a blocked duplicate (409) creates neither the entity nor its relationship"() {
        given:
        def f = fixture()
        post("/business-entities", [names: names("Address"), boundedContextKey: f.sales], f.bob)
        def relationshipsBefore = businessEntityRelationshipRepository.count()

        when:
        def res = post("/business-entities", [names: names("Address"), boundedContextKey: f.sales, relationships: [toCustomer(f.customer)]], f.bob)

        then:
        res.status == 409
        businessEntityRelationshipRepository.count() == relationshipsBefore
    }

    def "an implementation is linked to its interface at creation; an unknown interface is 404"() {
        given:
        def f = fixture()

        when:
        def res = post("/business-entities", [names: names("Business Customer"), boundedContextKey: f.sales, interfaces: [f.customer]], f.bob)

        then:
        res.status == 201
        get("/business-entities/${res.body.key}", f.bob).interfacesEntities*.key == [f.customer]

        and:
        post("/business-entities", [names: names("Private Customer"), boundedContextKey: f.sales, interfaces: ["no-such-entity"]], f.bob).status == 404
    }

    def "a user outside the context cannot create it there, relationship or not (403)"() {
        given:
        def f = fixture()
        def stranger = token("cwr-stranger@test.com", "cwrstranger")

        expect:
        post("/business-entities", [names: names("Address"), boundedContextKey: f.sales, relationships: [toCustomer(f.customer)]], stranger).status == 403
        businessEntityRelationshipRepository.count() == 0
    }
}
