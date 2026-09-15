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
import org.leargon.backend.model.LocalizedText
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.repository.BoundedContextRepository
import org.leargon.backend.repository.BusinessDomainRepository
import org.leargon.backend.repository.BusinessDomainVersionRepository
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.BusinessEntityVersionRepository
import org.leargon.backend.repository.CapabilityRepository
import org.leargon.backend.repository.ContextRelationshipRepository
import org.leargon.backend.repository.DomainEventRepository
import org.leargon.backend.repository.FieldConfigurationRepository
import org.leargon.backend.repository.ItSystemRepository
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.repository.ProcessVersionRepository
import org.leargon.backend.repository.ServiceProviderRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

/**
 * Creation policy (see CreationPolicyService):
 *  - admins and EDITOR/LEADs of the item type's governing methodology may create anywhere, including
 *    top-level / unplaced items;
 *  - otherwise creation is realm-based and nested: a domain owner creates subdomains, bounded contexts and
 *    anything in their contexts (transitively down the domain tree); a bounded-context owner creates
 *    entities, processes, domain events and context relationships in their context; the effective owner or
 *    steward of an item creates its children; an org-unit owner creates sub-units (non-transitive into
 *    content) and IT systems the unit owns;
 *  - moving an item needs creation rights at the destination.
 */
@MicronautTest(transactional = false)
class CreatePermissionSpec extends Specification {

    @Inject @Client("/") HttpClient client
    @Inject UserRepository userRepository
    @Inject BusinessEntityRepository businessEntityRepository
    @Inject BusinessEntityVersionRepository businessEntityVersionRepository
    @Inject ProcessRepository processRepository
    @Inject ProcessVersionRepository processVersionRepository
    @Inject ServiceProviderRepository serviceProviderRepository
    @Inject ItSystemRepository itSystemRepository
    @Inject CapabilityRepository capabilityRepository
    @Inject DomainEventRepository domainEventRepository
    @Inject ContextRelationshipRepository contextRelationshipRepository
    @Inject BoundedContextRepository boundedContextRepository
    @Inject BusinessDomainRepository businessDomainRepository
    @Inject BusinessDomainVersionRepository businessDomainVersionRepository
    @Inject OrganisationalUnitRepository organisationalUnitRepository
    @Inject FieldConfigurationRepository fieldConfigurationRepository
    @Inject SupportedLocaleRepository localeRepository

    def setup() {
        if (localeRepository.count() == 0) {
            localeRepository.save(new SupportedLocale(localeCode: "en", displayName: "English", isDefault: true, isActive: true, sortOrder: 1))
        }
    }

    def cleanup() {
        serviceProviderRepository.deleteAll()
        itSystemRepository.deleteAll()
        capabilityRepository.deleteAll()
        domainEventRepository.deleteAll()
        contextRelationshipRepository.deleteAll()
        businessEntityVersionRepository.deleteAll()
        businessEntityRepository.deleteAll()
        processVersionRepository.deleteAll()
        processRepository.deleteAll()
        boundedContextRepository.deleteAll()
        businessDomainVersionRepository.deleteAll()
        businessDomainRepository.deleteAll()
        organisationalUnitRepository.deleteAll()
        fieldConfigurationRepository.findByEntityType("METHODOLOGY").each { fieldConfigurationRepository.delete(it) }
        userRepository.deleteAll()
    }

    // ── helpers ──────────────────────────────────────────────────────────────────────────────────────

    private String token(String email, String username, String roles = "ROLE_USER") {
        def resp = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/signup", new SignupRequest(email, username, "password123", "Test", "User")), Map)
        def u = userRepository.findByEmail(email).get()
        u.roles = roles
        userRepository.update(u)
        return resp.body().accessToken
    }

    private HttpStatus postStatus(String path, Object body, String token) {
        try {
            return client.toBlocking().exchange(HttpRequest.POST(path, body).bearerAuth(token), Map).status()
        } catch (HttpClientResponseException e) {
            return e.status
        }
    }

    private HttpStatus putStatus(String path, Object body, String token) {
        try {
            return client.toBlocking().exchange(HttpRequest.PUT(path, body).bearerAuth(token), Map).status()
        } catch (HttpClientResponseException e) {
            return e.status
        }
    }

    private HttpStatus deleteStatus(String path, String token) {
        try {
            return client.toBlocking().exchange(HttpRequest.DELETE(path).bearerAuth(token)).status()
        } catch (HttpClientResponseException e) {
            return e.status
        }
    }

    private Map post(String path, Map body, String token) {
        client.toBlocking().exchange(HttpRequest.POST(path, body).bearerAuth(token), Map).body()
    }

    private static List names(String name) { [[locale: "en", text: name]] }

    private String createEntityAsAdmin(String name) {
        def admin = token("cp-admin@test.com", "cpadmin", "ROLE_USER,ROLE_ADMIN")
        return client.toBlocking().exchange(
                HttpRequest.POST("/business-entities", new CreateBusinessEntityRequest([new LocalizedText("en", name)])).bearerAuth(admin),
                Map).body().key
    }

    private String createServiceProvider(String adminToken, String name) {
        return client.toBlocking().exchange(
                HttpRequest.POST("/service-providers",
                        [names: [[locale: "en", text: name]], processingCountries: [], processorAgreementInPlace: false, subProcessorsApproved: false])
                        .bearerAuth(adminToken), Map).body().key
    }

    /**
     * Domain A (owner alice) ⊃ subdomain A1 (owner carol) ⊃ context "Billing" (owner bob);
     * domain B (owner eve) ⊃ context "Shipping". Plus a plain stranger with no ownership.
     */
    private Map realmFixture() {
        def admin = token("rp-admin@test.com", "rpadmin", "ROLE_USER,ROLE_ADMIN")
        def f = [
                admin   : admin,
                alice   : token("alice@test.com", "alice"),
                carol   : token("carol@test.com", "carol"),
                bob     : token("bob@test.com", "bob"),
                eve     : token("eve@test.com", "eve"),
                stranger: token("stranger@test.com", "stranger"),
        ]
        f.domA = post("/business-domains", [names: names("Domain A"), ownerUsername: "alice"], admin).key
        f.domA1 = post("/business-domains", [names: names("Domain A1"), ownerUsername: "carol", parentKey: f.domA], admin).key
        f.billing = post("/business-domains/${f.domA1}/bounded-contexts", [names: names("Billing"), ownerUsername: "bob"], admin).key
        f.domB = post("/business-domains", [names: names("Domain B"), ownerUsername: "eve"], admin).key
        f.shipping = post("/business-domains/${f.domB}/bounded-contexts", [names: names("Shipping")], admin).key
        return f
    }

    // ── global grants (methodology editors) ──────────────────────────────────────────────────────────

    def "a DATA_GOVERNANCE editor can create a root business entity"() {
        given:
        def t = token("dg@test.com", "dgeditor", "ROLE_USER,ROLE_EDITOR_DATA_GOVERNANCE")

        expect:
        postStatus("/business-entities", new CreateBusinessEntityRequest([new LocalizedText("en", "Customer")]), t) == HttpStatus.CREATED
    }

    def "a plain user cannot create an unplaced business entity (403)"() {
        given:
        def t = token("plain@test.com", "plain", "ROLE_USER")

        expect:
        postStatus("/business-entities", new CreateBusinessEntityRequest([new LocalizedText("en", "Customer")]), t) == HttpStatus.FORBIDDEN
    }

    def "a GDPR editor (wrong methodology) cannot create a business entity (403)"() {
        given:
        def t = token("gdpr@test.com", "gdpr", "ROLE_USER,ROLE_EDITOR_GDPR")

        expect:
        postStatus("/business-entities", new CreateBusinessEntityRequest([new LocalizedText("en", "Customer")]), t) == HttpStatus.FORBIDDEN
    }

    def "a PROCESS_GOVERNANCE editor can create a process but a plain user cannot"() {
        given:
        def editor = token("pg@test.com", "pgeditor", "ROLE_USER,ROLE_EDITOR_PROCESS_GOVERNANCE")
        def plain = token("plain@test.com", "plainuser", "ROLE_USER")
        def body = [names: [[locale: "en", text: "Order Fulfilment"]]]

        expect:
        postStatus("/processes", body, editor) == HttpStatus.CREATED
        postStatus("/processes", body, plain) == HttpStatus.FORBIDDEN
    }

    def "a GDPR editor can create a service provider but a plain user cannot"() {
        given:
        def editor = token("g@test.com", "gdpreditor", "ROLE_USER,ROLE_EDITOR_GDPR")
        def plain = token("plain@test.com", "plainuser", "ROLE_USER")
        def body = [names: [[locale: "en", text: "Stripe"]], processingCountries: [], processorAgreementInPlace: true, subProcessorsApproved: true]

        expect:
        postStatus("/service-providers", body, editor) == HttpStatus.CREATED
        postStatus("/service-providers", body, plain) == HttpStatus.FORBIDDEN
    }

    // ── item realm (children) ────────────────────────────────────────────────────────────────────────

    def "the owner of a parent entity can create a child entity without a methodology role"() {
        given: "a DATA_GOVERNANCE editor creates a parent and is its owner"
        def owner = token("owner@test.com", "owner", "ROLE_USER,ROLE_EDITOR_DATA_GOVERNANCE")
        def parent = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities", new CreateBusinessEntityRequest([new LocalizedText("en", "Parent")])).bearerAuth(owner), Map).body()

        and: "the owner is demoted to a plain user (keeps ownership of the parent)"
        def u = userRepository.findByEmail("owner@test.com").get()
        u.roles = "ROLE_USER"
        userRepository.update(u)

        when: "the now plain owner creates a child under their parent"
        def childReq = new CreateBusinessEntityRequest([new LocalizedText("en", "Child")])
        childReq.parentKey = parent.key
        def status = postStatus("/business-entities", childReq, owner)

        then: "child creation is permitted by virtue of parent ownership"
        status == HttpStatus.CREATED
    }

    def "a plain non-owner cannot create a child entity (403)"() {
        given: "an entity owned by someone else"
        def owner = token("owner@test.com", "owner", "ROLE_USER,ROLE_EDITOR_DATA_GOVERNANCE")
        def parent = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities", new CreateBusinessEntityRequest([new LocalizedText("en", "Parent")])).bearerAuth(owner), Map).body()
        def stranger = token("stranger@test.com", "stranger", "ROLE_USER")

        when:
        def childReq = new CreateBusinessEntityRequest([new LocalizedText("en", "Child")])
        childReq.parentKey = parent.key
        def status = postStatus("/business-entities", childReq, stranger)

        then:
        status == HttpStatus.FORBIDDEN
    }

    def "the effective (inherited) owner of a parent entity can create a child"() {
        given: "an entity owned only through its owning unit, whose business owner is frank"
        def admin = token("rp-admin@test.com", "rpadmin", "ROLE_USER,ROLE_ADMIN")
        def frank = token("frank@test.com", "frank")
        def unit = post("/organisational-units", [names: names("Frank's Unit"), businessOwnerUsername: "frank"], admin)
        def parentKey = post("/business-entities", [names: names("Unit Parent"), owningUnitKey: unit.key], admin).key
        def parent = businessEntityRepository.findByKey(parentKey).get()
        parent.dataOwner = null
        businessEntityRepository.update(parent)

        expect:
        postStatus("/business-entities", [names: names("Unit Child"), parentKey: parentKey], frank) == HttpStatus.CREATED
    }

    // ── domain realm ─────────────────────────────────────────────────────────────────────────────────

    def "a domain owner can create a subdomain and a bounded context in their domain"() {
        given:
        def f = realmFixture()

        expect:
        postStatus("/business-domains", [names: names("Domain A2"), parentKey: f.domA], f.alice) == HttpStatus.CREATED
        postStatus("/business-domains/${f.domA}/bounded-contexts", [names: names("Ordering")], f.alice) == HttpStatus.CREATED
    }

    def "a domain owner cannot create in another domain or at top level (403)"() {
        given:
        def f = realmFixture()

        expect:
        postStatus("/business-domains", [names: names("Sneaky"), parentKey: f.domB], f.alice) == HttpStatus.FORBIDDEN
        postStatus("/business-domains/${f.domB}/bounded-contexts", [names: names("Sneaky")], f.alice) == HttpStatus.FORBIDDEN
        postStatus("/business-domains", [names: names("Top Level")], f.alice) == HttpStatus.FORBIDDEN
        postStatus("/business-entities", [names: names("Parcel"), boundedContextKey: f.shipping], f.alice) == HttpStatus.FORBIDDEN
    }

    def "a parent-domain owner can create an entity in a context of a subdomain owned by someone else"() {
        given:
        def f = realmFixture()

        expect:
        postStatus("/business-entities", [names: names("Invoice"), boundedContextKey: f.billing], f.alice) == HttpStatus.CREATED
        postStatus("/business-entities", [names: names("Credit Note"), boundedContextKey: f.billing], f.carol) == HttpStatus.CREATED
    }

    // ── bounded-context realm ────────────────────────────────────────────────────────────────────────

    def "a bounded-context owner can create entities, processes, domain events and relationships in their context"() {
        given:
        def f = realmFixture()

        expect:
        postStatus("/business-entities", [names: names("Invoice"), boundedContextKey: f.billing], f.bob) == HttpStatus.CREATED
        postStatus("/processes", [names: names("Dunning"), boundedContextKey: f.billing], f.bob) == HttpStatus.CREATED
        postStatus("/domain-events", [names: names("Invoice Issued"), publishingBoundedContextKey: f.billing], f.bob) == HttpStatus.CREATED
        postStatus("/context-relationships", [upstreamBoundedContextKey  : f.billing,
                                              downstreamBoundedContextKey: f.shipping,
                                              relationshipType           : "CUSTOMER_SUPPLIER"], f.bob) == HttpStatus.CREATED
    }

    def "the created entity is placed in the requested bounded context"() {
        given:
        def f = realmFixture()

        when:
        def key = post("/business-entities", [names: names("Invoice"), boundedContextKey: f.billing], f.bob).key

        then:
        businessEntityRepository.findByKey(key).get().boundedContext.key == f.billing
    }

    def "a bounded-context owner cannot create in a foreign context, nor subdomains or contexts (403)"() {
        given:
        def f = realmFixture()

        expect:
        postStatus("/business-entities", [names: names("Parcel"), boundedContextKey: f.shipping], f.bob) == HttpStatus.FORBIDDEN
        postStatus("/processes", [names: names("Pick"), boundedContextKey: f.shipping], f.bob) == HttpStatus.FORBIDDEN
        postStatus("/domain-events", [names: names("Parcel Sent"), publishingBoundedContextKey: f.shipping], f.bob) == HttpStatus.FORBIDDEN
        postStatus("/business-domains/${f.domA1}/bounded-contexts", [names: names("Ledger")], f.bob) == HttpStatus.FORBIDDEN
        postStatus("/business-domains", [names: names("Sub"), parentKey: f.domA1], f.bob) == HttpStatus.FORBIDDEN
    }

    def "a stranger cannot create anything in someone else's realm (403)"() {
        given:
        def f = realmFixture()

        expect:
        postStatus("/business-entities", [names: names("Invoice"), boundedContextKey: f.billing], f.stranger) == HttpStatus.FORBIDDEN
        postStatus("/processes", [names: names("Dunning"), boundedContextKey: f.billing], f.stranger) == HttpStatus.FORBIDDEN
        postStatus("/domain-events", [names: names("Event"), publishingBoundedContextKey: f.billing], f.stranger) == HttpStatus.FORBIDDEN
        postStatus("/context-relationships", [upstreamBoundedContextKey  : f.billing,
                                              downstreamBoundedContextKey: f.shipping,
                                              relationshipType           : "CUSTOMER_SUPPLIER"], f.stranger) == HttpStatus.FORBIDDEN
        postStatus("/business-domains/${f.domA}/bounded-contexts", [names: names("X")], f.stranger) == HttpStatus.FORBIDDEN
    }

    def "an entity owner cannot move their entity into a foreign bounded context (403)"() {
        given:
        def f = realmFixture()
        def key = post("/business-entities", [names: names("Invoice"), boundedContextKey: f.billing, dataOwnerUsername: "stranger"], f.admin).key

        expect: "the stranger owns the entity but not the destination context"
        putStatus("/business-entities/$key/bounded-context", [boundedContextKey: f.shipping], f.stranger) == HttpStatus.FORBIDDEN
        businessEntityRepository.findByKey(key).get().boundedContext.key == f.billing
    }

    // ── org units: structure only, non-transitive ────────────────────────────────────────────────────

    def "a department head cannot create content in a team's bounded context (non-transitive)"() {
        given: "department Dept (owner dave) with a team (owner erin) that owns a bounded context"
        def admin = token("rp-admin@test.com", "rpadmin", "ROLE_USER,ROLE_ADMIN")
        def dave = token("dave@test.com", "dave")
        def erin = token("erin@test.com", "erin")
        def dept = post("/organisational-units", [names: names("Dept"), businessOwnerUsername: "dave"], admin)
        def team = post("/organisational-units", [names: names("Team"), businessOwnerUsername: "erin", parentKeys: [dept.key]], admin)
        def domain = post("/business-domains", [names: names("Team Domain")], admin).key
        def bc = post("/business-domains/$domain/bounded-contexts", [names: names("Team Context"), owningTeamKey: team.key], admin).key

        expect:
        postStatus("/business-entities", [names: names("Ticket"), boundedContextKey: bc], dave) == HttpStatus.FORBIDDEN
        postStatus("/business-entities", [names: names("Ticket"), boundedContextKey: bc], erin) == HttpStatus.CREATED
    }

    def "a unit owner can create sub-units only under units they own"() {
        given:
        def admin = token("rp-admin@test.com", "rpadmin", "ROLE_USER,ROLE_ADMIN")
        def dave = token("dave@test.com", "dave")
        def dept = post("/organisational-units", [names: names("Dept"), businessOwnerUsername: "dave"], admin)
        def foreign = post("/organisational-units", [names: names("Foreign")], admin)

        expect:
        postStatus("/organisational-units", [names: names("Sub Team"), parentKeys: [dept.key]], dave) == HttpStatus.CREATED
        postStatus("/organisational-units", [names: names("Two Parents"), parentKeys: [dept.key, foreign.key]], dave) == HttpStatus.FORBIDDEN
        postStatus("/organisational-units", [names: names("Under Foreign"), parentKeys: [foreign.key]], dave) == HttpStatus.FORBIDDEN
        postStatus("/organisational-units", [names: names("Top Level")], dave) == HttpStatus.FORBIDDEN
    }

    def "a unit owner cannot pull their unit under a foreign unit to widen their realm (403)"() {
        given:
        def admin = token("rp-admin@test.com", "rpadmin", "ROLE_USER,ROLE_ADMIN")
        def dave = token("dave@test.com", "dave")
        def dept = post("/organisational-units", [names: names("Dept"), businessOwnerUsername: "dave"], admin)
        def foreign = post("/organisational-units", [names: names("Foreign")], admin)

        expect:
        putStatus("/organisational-units/${dept.key}/parents", [keys: [foreign.key]], dave) == HttpStatus.FORBIDDEN
    }

    // ── capabilities and IT systems ──────────────────────────────────────────────────────────────────

    def "the owner of a capability's unit can create sub-capabilities but not top-level ones"() {
        given:
        def admin = token("rp-admin@test.com", "rpadmin", "ROLE_USER,ROLE_ADMIN")
        def dave = token("dave@test.com", "dave")
        def stranger = token("stranger@test.com", "stranger")
        def dept = post("/organisational-units", [names: names("Dept"), businessOwnerUsername: "dave"], admin)
        def l1 = post("/capabilities", [names: names("Order Management"), owningUnitKey: dept.key], admin)

        expect:
        postStatus("/capabilities", [names: names("Order Capture"), parentCapabilityKey: l1.key], dave) == HttpStatus.CREATED
        postStatus("/capabilities", [names: names("Order Returns"), parentCapabilityKey: l1.key], stranger) == HttpStatus.FORBIDDEN
        postStatus("/capabilities", [names: names("New L1")], dave) == HttpStatus.FORBIDDEN
    }

    def "a unit owner can create IT systems owned by their unit only"() {
        given:
        def admin = token("rp-admin@test.com", "rpadmin", "ROLE_USER,ROLE_ADMIN")
        def dave = token("dave@test.com", "dave")
        def dept = post("/organisational-units", [names: names("Dept"), businessOwnerUsername: "dave"], admin)
        def foreign = post("/organisational-units", [names: names("Foreign")], admin)

        expect:
        postStatus("/it-systems", [names: names("Dept CRM"), owningUnitKey: dept.key], dave) == HttpStatus.CREATED
        postStatus("/it-systems", [names: names("Foreign CRM"), owningUnitKey: foreign.key], dave) == HttpStatus.FORBIDDEN
        postStatus("/it-systems", [names: names("Unplaced CRM")], dave) == HttpStatus.FORBIDDEN
    }

    // ── DDD disabled: entities are placed via their owning unit ─────────────────────────────────────

    def "with DDD disabled a unit owner can create unplaced entities owned by their unit"() {
        given:
        def admin = token("rp-admin@test.com", "rpadmin", "ROLE_USER,ROLE_ADMIN")
        def frank = token("frank@test.com", "frank")
        def unit = post("/organisational-units", [names: names("Frank's Unit"), businessOwnerUsername: "frank"], admin)
        def body = [names: names("Unit Record"), owningUnitKey: unit.key]

        expect: "while DDD is enabled the owning unit is not a placement"
        postStatus("/business-entities", body, frank) == HttpStatus.FORBIDDEN

        when: "the admin disables the DDD methodology"
        def entries = ["DATA_GOVERNANCE", "PROCESS_GOVERNANCE", "GDPR", "DDD", "BCM", "TEAM_TOPOLOGIES", "LEAN"].collect {
            [key: it, enabled: it != "DDD"]
        }
        putStatus("/administration/methodology-configurations", entries, admin)

        then:
        postStatus("/business-entities", body, frank) == HttpStatus.CREATED
    }

    // ── delete (unchanged) ───────────────────────────────────────────────────────────────────────────

    def "a DATA_GOVERNANCE editor can delete an entity owned by someone else"() {
        given: "an admin-owned entity and a separate DATA_GOVERNANCE editor"
        def key = createEntityAsAdmin("Deletable Entity")
        def editor = token("del-editor@test.com", "deleditor", "ROLE_USER,ROLE_EDITOR_DATA_GOVERNANCE")

        expect: "the editor (non-owner) may delete it"
        deleteStatus("/business-entities/$key", editor) == HttpStatus.NO_CONTENT
    }

    def "a plain non-owner cannot delete an entity (403)"() {
        given:
        def key = createEntityAsAdmin("Protected Entity")
        def plain = token("del-plain@test.com", "delplain", "ROLE_USER")

        expect:
        deleteStatus("/business-entities/$key", plain) == HttpStatus.FORBIDDEN
    }

    def "a governing-methodology editor can delete a secondary item; a wrong-methodology editor cannot"() {
        given: "two admin-created service providers (governed by GDPR)"
        def admin = token("cp-spadmin@test.com", "cpspadmin", "ROLE_USER,ROLE_ADMIN")
        def gdprKey = createServiceProvider(admin, "SP GDPR")
        def wrongKey = createServiceProvider(admin, "SP Wrong")
        def gdprEditor = token("sp-gdpr@test.com", "spgdpred", "ROLE_USER,ROLE_EDITOR_GDPR")
        def dgEditor = token("sp-dg@test.com", "spdged", "ROLE_USER,ROLE_EDITOR_DATA_GOVERNANCE")

        expect: "the GDPR editor may delete; a DATA_GOVERNANCE editor (wrong methodology) may not"
        deleteStatus("/service-providers/$gdprKey", gdprEditor) == HttpStatus.NO_CONTENT
        deleteStatus("/service-providers/$wrongKey", dgEditor) == HttpStatus.FORBIDDEN
    }
}
