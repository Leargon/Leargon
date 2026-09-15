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
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.BusinessEntityVersionRepository
import org.leargon.backend.repository.CapabilityRepository
import org.leargon.backend.repository.DomainEventRepository
import org.leargon.backend.repository.ItSystemRepository
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.repository.ProcessVersionRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

/**
 * Proves the backend-computed creation flags never drift from enforcement: for every actor and container,
 * `creatableChildTypes` on the container's detail response contains an item type IFF the matching create
 * request succeeds. Also checks `/creation/capabilities` and `/creation/targets` against the same realm.
 */
@MicronautTest(transactional = false)
class CreationFlagsConsistencySpec extends Specification {

    @Inject @Client("/") HttpClient client
    @Inject UserRepository userRepository
    @Inject SupportedLocaleRepository localeRepository
    @Inject BusinessEntityRepository businessEntityRepository
    @Inject BusinessEntityVersionRepository businessEntityVersionRepository
    @Inject ProcessRepository processRepository
    @Inject ProcessVersionRepository processVersionRepository
    @Inject DomainEventRepository domainEventRepository
    @Inject BoundedContextRepository boundedContextRepository
    @Inject BusinessDomainRepository businessDomainRepository
    @Inject BusinessDomainVersionRepository businessDomainVersionRepository
    @Inject OrganisationalUnitRepository organisationalUnitRepository
    @Inject CapabilityRepository capabilityRepository
    @Inject ItSystemRepository itSystemRepository

    private int counter = 0

    def setup() {
        if (localeRepository.count() == 0) {
            localeRepository.save(new SupportedLocale(localeCode: "en", displayName: "English", isDefault: true, isActive: true, sortOrder: 1))
        }
    }

    def cleanup() {
        itSystemRepository.deleteAll()
        capabilityRepository.deleteAll()
        domainEventRepository.deleteAll()
        businessEntityVersionRepository.deleteAll()
        businessEntityRepository.deleteAll()
        processVersionRepository.deleteAll()
        processRepository.deleteAll()
        boundedContextRepository.deleteAll()
        businessDomainVersionRepository.deleteAll()
        businessDomainRepository.deleteAll()
        organisationalUnitRepository.deleteAll()
        userRepository.deleteAll()
    }

    private String token(String email, String username, String roles = "ROLE_USER") {
        def resp = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/signup", new SignupRequest(email, username, "password123", "Test", "User")), Map)
        def u = userRepository.findByEmail(email).get()
        u.roles = roles
        userRepository.update(u)
        return resp.body().accessToken
    }

    private Map post(String path, Map body, String token) {
        client.toBlocking().exchange(HttpRequest.POST(path, body).bearerAuth(token), Map).body()
    }

    private boolean created(String path, Map body, String token) {
        try {
            return client.toBlocking().exchange(HttpRequest.POST(path, body).bearerAuth(token), Map).status().code == 201
        } catch (HttpClientResponseException e) {
            assert e.status.code == 403: "unexpected ${e.status} for POST $path: ${e.response.body()}"
            return false
        }
    }

    private List<String> childTypes(String path, String token) {
        client.toBlocking().exchange(HttpRequest.GET(path).bearerAuth(token), Map).body().creatableChildTypes ?: []
    }

    private List names() { [[locale: "en", text: "Item ${++counter}".toString()]] }

    private Map fixture() {
        def admin = token("cf-admin@test.com", "cfadmin", "ROLE_USER,ROLE_ADMIN")
        def f = [
                actors: [
                        admin   : admin,
                        alice   : token("cf-alice@test.com", "cfalice"),
                        bob     : token("cf-bob@test.com", "cfbob"),
                        dave    : token("cf-dave@test.com", "cfdave"),
                        stranger: token("cf-stranger@test.com", "cfstranger"),
                        dgEditor: token("cf-dg@test.com", "cfdg", "ROLE_USER,ROLE_EDITOR_DATA_GOVERNANCE"),
                ],
        ]
        f.domain = post("/business-domains", [names: [[locale: "en", text: "Domain A"]], ownerUsername: "cfalice"], admin).key
        f.billing = post("/business-domains/${f.domain}/bounded-contexts", [names: [[locale: "en", text: "Billing"]], ownerUsername: "cfbob"], admin).key
        f.entity = post("/business-entities", [names: [[locale: "en", text: "Invoice"]], boundedContextKey: f.billing], admin).key
        f.process = post("/processes", [names: [[locale: "en", text: "Dunning"]], boundedContextKey: f.billing], admin).key
        f.unit = post("/organisational-units", [names: [[locale: "en", text: "Dept"]], businessOwnerUsername: "cfdave"], admin).key
        f.capability = post("/capabilities", [names: [[locale: "en", text: "Order Management"]], owningUnitKey: f.unit], admin).key
        return f
    }

    def "creatableChildTypes matches create enforcement for every actor and container"() {
        given:
        def f = fixture()
        // container detail path → [child type → create request]
        def checks = [
                ("/business-domains/${f.domain}")        : [
                        BUSINESS_DOMAIN: ["/business-domains", { [names: names(), parentKey: f.domain] }],
                        BOUNDED_CONTEXT: ["/business-domains/${f.domain}/bounded-contexts", { [names: names()] }],
                ],
                ("/bounded-contexts/${f.billing}")      : [
                        BUSINESS_ENTITY : ["/business-entities", { [names: names(), boundedContextKey: f.billing] }],
                        BUSINESS_PROCESS: ["/processes", { [names: names(), boundedContextKey: f.billing] }],
                        DOMAIN_EVENT    : ["/domain-events", { [names: names(), publishingBoundedContextKey: f.billing] }],
                ],
                ("/business-entities/${f.entity}")      : [
                        BUSINESS_ENTITY: ["/business-entities", { [names: names(), parentKey: f.entity] }],
                ],
                ("/processes/${f.process}")             : [
                        BUSINESS_PROCESS: ["/processes", { [names: names(), parentProcessKey: f.process] }],
                ],
                ("/organisational-units/${f.unit}")     : [
                        ORGANISATIONAL_UNIT: ["/organisational-units", { [names: names(), parentKeys: [f.unit]] }],
                        IT_SYSTEM          : ["/it-systems", { [names: names(), owningUnitKey: f.unit] }],
                ],
                ("/capabilities/${f.capability}")       : [
                        CAPABILITY: ["/capabilities", { [names: names(), parentCapabilityKey: f.capability] }],
                ],
        ]

        when:
        def mismatches = []
        f.actors.each { actor, tok ->
            checks.each { detailPath, children ->
                def flagged = childTypes(detailPath as String, tok)
                children.each { type, req ->
                    def (path, body) = req
                    def allowed = created(path as String, (body as Closure).call() as Map, tok)
                    if (flagged.contains(type) != allowed) {
                        mismatches << "$actor on $detailPath: flag=${flagged.contains(type)} but create $type allowed=$allowed"
                    }
                }
            }
        }

        then:
        mismatches.isEmpty()
    }

    def "creation capabilities reflect realm ownership"() {
        given:
        def f = fixture()

        when:
        def caps = { String tok ->
            client.toBlocking().exchange(HttpRequest.GET("/creation/capabilities").bearerAuth(tok), Map).body().items
                    .collectEntries { [(it.itemType): it] }
        }
        def bob = caps(f.actors.bob)
        def stranger = caps(f.actors.stranger)
        def admin = caps(f.actors.admin)

        then: "the bounded-context owner may create entities in their context, but nothing unplaced"
        bob.BUSINESS_ENTITY.canCreate
        !bob.BUSINESS_ENTITY.canCreateUnplaced
        !bob.SERVICE_PROVIDER.canCreate

        and: "a stranger may create nothing"
        stranger.values().every { !it.canCreate && !it.canCreateUnplaced }

        and: "an admin may create everything, anywhere"
        admin.values().every { it.canCreate && it.canCreateUnplaced }
    }

    def "creation targets list exactly the realm containers of the user"() {
        given:
        def f = fixture()
        def otherDomain = post("/business-domains", [names: [[locale: "en", text: "Domain B"]]], f.actors.admin).key
        def shipping = post("/business-domains/$otherDomain/bounded-contexts", [names: [[locale: "en", text: "Shipping"]]], f.actors.admin).key

        when:
        def targets = { String type, String tok ->
            client.toBlocking().exchange(HttpRequest.GET("/creation/targets?itemType=$type").bearerAuth(tok), Map).body()
        }
        def bobEntity = targets("BUSINESS_ENTITY", f.actors.bob)
        def aliceBc = targets("BOUNDED_CONTEXT", f.actors.alice)
        def editorEntity = targets("BUSINESS_ENTITY", f.actors.dgEditor)

        then:
        !bobEntity.unrestricted
        bobEntity.boundedContexts*.key == [f.billing]
        bobEntity.boundedContexts[0].basis == "BC_OWNER"
        !(shipping in bobEntity.boundedContexts*.key)

        and: "the domain owner may create contexts in their domain only"
        aliceBc.domains*.key == [f.domain]

        and: "a methodology editor is unrestricted"
        editorEntity.unrestricted
        editorEntity.canCreateUnplaced
    }
}
