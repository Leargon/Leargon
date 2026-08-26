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
import org.leargon.backend.model.CreateOrganisationalUnitRequest
import org.leargon.backend.model.LocalizedText
import org.leargon.backend.model.LoginRequest
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.BusinessEntityVersionRepository
import org.leargon.backend.repository.FieldConfigurationRepository
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

/**
 * The "Group by" control on the overview pages.
 *
 * Two things are easy to get wrong and are pinned here. First, grouping must not silently flatten the
 * hierarchy: an entity whose parent belongs to somebody else still appears under its parent, but that
 * parent comes back as context (`matchesGroup = false`) rather than as a member of the group. Second,
 * which dimensions are offered is a server decision — turning off DDD or hiding a field has to
 * withdraw the corresponding option, because a client that filtered for itself would drift.
 */
@MicronautTest(transactional = false)
class OverviewGroupingControllerSpec extends Specification {

    @Inject
    @Client("/")
    HttpClient client

    @Inject UserRepository userRepository
    @Inject BusinessEntityRepository businessEntityRepository
    @Inject BusinessEntityVersionRepository businessEntityVersionRepository
    @Inject OrganisationalUnitRepository organisationalUnitRepository
    @Inject FieldConfigurationRepository fieldConfigurationRepository
    @Inject SupportedLocaleRepository localeRepository

    def setup() {
        seedLocales()
    }

    def cleanup() {
        fieldConfigurationRepository.deleteAll()
        businessEntityVersionRepository.deleteAll()
        businessEntityRepository.deleteAll()
        organisationalUnitRepository.findAll().each { unit ->
            if (unit.parents && !unit.parents.isEmpty()) {
                unit.parents.clear()
                organisationalUnitRepository.update(unit)
            }
        }
        organisationalUnitRepository.deleteAll()
        userRepository.deleteAll()
    }

    // ── availability ─────────────────────────────────────────────────────────

    def "an entity list offers owner, owning unit, bounded context and domain"() {
        given:
        String token = adminToken()

        when:
        def response = get(token, "/overviews/BUSINESS_ENTITY/groupings")

        then: "NONE leads, so the un-grouped tree is always reachable"
        response.status() == HttpStatus.OK
        response.body().options*.key.first() == "NONE"
        response.body().options*.key.containsAll(["OWNER", "OWNING_UNIT", "BOUNDED_CONTEXT", "DOMAIN"])
    }

    def "a service provider offers only the dimensions it actually carries"() {
        given: "a service provider has neither an owner nor an owning unit"
        String token = adminToken()

        when:
        def response = get(token, "/overviews/SERVICE_PROVIDER/groupings")

        then: "it is grouped by what it does have, and owner is not offered at all"
        response.status() == HttpStatus.OK
        response.body().options*.key.containsAll(["PROVIDER_TYPE", "PROCESSING_COUNTRY"])
        !response.body().options*.key.contains("OWNER")
        !response.body().options*.key.contains("OWNING_UNIT")
    }

    def "disabling DDD withdraws the bounded-context and domain groupings"() {
        given:
        String token = adminToken()
        disableMethodology(token, "DDD")

        when:
        def response = get(token, "/overviews/BUSINESS_ENTITY/groupings")

        then:
        !response.body().options*.key.contains("BOUNDED_CONTEXT")
        !response.body().options*.key.contains("DOMAIN")

        and: "owner is core and survives"
        response.body().options*.key.contains("OWNER")
    }

    def "hiding the owning-unit field withdraws the owning-unit grouping"() {
        given:
        String token = adminToken()
        hideField(token, "BUSINESS_ENTITY", "owningUnit")

        when:
        def response = get(token, "/overviews/BUSINESS_ENTITY/groupings")

        then:
        !response.body().options*.key.contains("OWNING_UNIT")
    }

    def "grouping labels come back in every active locale"() {
        given:
        String token = adminToken()

        when:
        def response = get(token, "/overviews/BUSINESS_ENTITY/groupings")

        then: "a German reader is not handed the English dimension name"
        def owner = response.body().options.find { it.key == "OWNER" }
        owner.labels.find { it.locale == "en" }.text == "Owner"
        owner.labels.find { it.locale == "de" }.text == "Eigentümer"
    }

    // ── grouping ─────────────────────────────────────────────────────────────

    def "items bucket under their owner, and ownerless items land in the unassigned group"() {
        given:
        String token = adminToken()
        createUser("alice@test.com", "alice")
        String owned = createEntity(token, "Order")
        setDataOwner(token, owned, "alice")
        clearDataOwner(createEntity(token, "Stray"))

        when:
        def response = get(token, "/overviews/BUSINESS_ENTITY?groupBy=OWNER")

        then:
        response.status() == HttpStatus.OK
        def alice = response.body().groups.find { it.key == "alice" }
        alice.nodes*.key == [owned]
        alice.itemCount == 1

        and: "the unassigned bucket is keyed null and named by an i18n key, not English text"
        def unassigned = response.body().groups.find { it.key == null }
        unassigned.labelKey == "common.unassigned"
        unassigned.nodes*.key.contains("stray")

        and: "and it sorts last so it never leads the list"
        response.body().groups.last().key == null
    }

    def "a parent owned by somebody else is kept as context and flagged as not a member"() {
        given: "a child owned by alice under a parent owned by bob"
        String token = adminToken()
        createUser("alice@test.com", "alice")
        createUser("bob@test.com", "bob")
        String parent = createEntity(token, "Order")
        setDataOwner(token, parent, "bob")
        String child = createEntity(token, "Line Item")
        setDataOwner(token, child, "alice")
        String rekeyedChild = setParent(token, child, parent)

        when:
        def response = get(token, "/overviews/BUSINESS_ENTITY?groupBy=OWNER")

        then: "alice's group still shows the child in its place in the tree"
        def alice = response.body().groups.find { it.key == "alice" }
        alice.nodes.size() == 1
        alice.nodes[0].key == parent

        and: "but the parent is context only — it is bob's, not alice's"
        !alice.nodes[0].matchesGroup
        alice.nodes[0].children*.key == [rekeyedChild]
        alice.nodes[0].children[0].matchesGroup

        and: "and the group counts only the item that really belongs to it"
        alice.itemCount == 1
    }

    def "ownership inherited from the owning unit groups under the inherited owner"() {
        given: "an entity with no owner of its own, in a unit led by alice"
        String token = adminToken()
        createUser("alice@test.com", "alice")
        String unit = createUnit(token, "Logistics", "alice")
        String entity = createEntity(token, "Order")
        clearDataOwner(entity)
        assignOwningUnit(token, entity, unit)

        when:
        def response = get(token, "/overviews/BUSINESS_ENTITY?groupBy=OWNER")

        then: "it groups under alice, matching what the detail panel and the to-do list already show"
        response.body().groups.find { it.key == "alice" }.nodes*.key == [entity]
    }

    def "a unit with two parents appears under both ancestor paths"() {
        given: "the org hierarchy is a DAG, not a tree"
        String token = adminToken()
        createUser("alice@test.com", "alice")
        String left = createUnit(token, "Engineering", null)
        String right = createUnit(token, "Operations", null)
        String shared = createUnit(token, "Platform", "alice")
        setUnitParents(token, shared, [left, right])

        when:
        def response = get(token, "/overviews/ORGANISATIONAL_UNIT?groupBy=OWNER")

        then: "both routes to it are shown rather than one silently dropped"
        def alice = response.body().groups.find { it.key == "alice" }
        alice.nodes*.key.toSet() == [left, right] as Set
        alice.nodes.every { it.children*.key == [shared] }
        alice.nodes.every { !it.matchesGroup }

        and: "and it is still counted once"
        alice.itemCount == 1
    }

    def "group headings for user content carry the record's own translations"() {
        given: "a unit named in English and German"
        String token = adminToken()
        String unit = createUnitNamed(token, [new LocalizedText("en", "Logistics"), new LocalizedText("de", "Logistik")])
        String entity = createEntity(token, "Order")
        assignOwningUnit(token, entity, unit)

        when:
        def response = get(token, "/overviews/BUSINESS_ENTITY?groupBy=OWNING_UNIT")

        then: "the heading is the unit's own name, in both languages, with no i18n key"
        def group = response.body().groups.find { it.key == unit }
        group.labelKey == null
        group.labels.find { it.locale == "de" }.text == "Logistik"
        group.labels.find { it.locale == "en" }.text == "Logistics"
    }

    // ── negative cases ───────────────────────────────────────────────────────

    def "an unauthenticated caller cannot read a grouped list"() {
        when:
        client.toBlocking().exchange(HttpRequest.GET("/overviews/BUSINESS_ENTITY?groupBy=OWNER"), Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.UNAUTHORIZED
    }

    def "an unknown grouping is rejected rather than silently returning everything ungrouped"() {
        given:
        String token = adminToken()

        when:
        get(token, "/overviews/BUSINESS_ENTITY?groupBy=NOT_A_DIMENSION")

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.BAD_REQUEST
    }

    def "a grouping that does not apply to the resource type is rejected"() {
        given:
        String token = adminToken()

        when: "a service provider has no owner to group by"
        get(token, "/overviews/SERVICE_PROVIDER?groupBy=OWNER")

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.BAD_REQUEST
    }

    def "a grouping withdrawn by a disabled methodology is rejected, not just hidden from the menu"() {
        given:
        String token = adminToken()
        disableMethodology(token, "DDD")

        when:
        get(token, "/overviews/BUSINESS_ENTITY?groupBy=BOUNDED_CONTEXT")

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.BAD_REQUEST
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private void seedLocales() {
        if (localeRepository.count() == 0) {
            int order = 1
            ["en": "English", "de": "Deutsch"].each { code, displayName ->
                def locale = new SupportedLocale()
                locale.localeCode = code
                locale.displayName = displayName
                locale.isDefault = code == "en"
                locale.isActive = true
                locale.sortOrder = order++
                localeRepository.save(locale)
            }
        }
    }

    private String adminToken() {
        if (!userRepository.findByEmail("ovadmin@test.com").isPresent()) {
            client.toBlocking().exchange(HttpRequest.POST("/authentication/signup",
                    new SignupRequest("ovadmin@test.com", "ovadmin", "password123", "Ov", "Admin")))
            def user = userRepository.findByEmail("ovadmin@test.com").get()
            user.roles = "ROLE_USER,ROLE_ADMIN"
            userRepository.update(user)
        }
        def login = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/login", new LoginRequest("ovadmin@test.com", "password123")), Map)
        return login.body().accessToken
    }

    private void createUser(String email, String username) {
        client.toBlocking().exchange(HttpRequest.POST("/authentication/signup",
                new SignupRequest(email, username, "password123", "Test", "User")))
    }

    private String createEntity(String token, String name) {
        client.toBlocking().exchange(
                HttpRequest.POST("/business-entities",
                        new CreateBusinessEntityRequest([new LocalizedText("en", name)])).bearerAuth(token), Map)
                .body().key
    }

    private String createUnit(String token, String name, String ownerUsername) {
        def request = new CreateOrganisationalUnitRequest([new LocalizedText("en", name)])
        if (ownerUsername != null) {
            request.businessOwnerUsername = ownerUsername
        }
        client.toBlocking().exchange(HttpRequest.POST("/organisational-units", request).bearerAuth(token), Map).body().key
    }

    private String createUnitNamed(String token, List<LocalizedText> names) {
        client.toBlocking().exchange(
                HttpRequest.POST("/organisational-units", new CreateOrganisationalUnitRequest(names)).bearerAuth(token), Map)
                .body().key
    }

    private void setDataOwner(String token, String entityKey, String username) {
        client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${entityKey}/data-owner", [dataOwnerUsername: username]).bearerAuth(token), Map)
    }

    private String setParent(String token, String childKey, String parentKey) {
        client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${childKey}/parent", [parentKey: parentKey]).bearerAuth(token), Map)
                .body().key
    }

    /**
     * Creating an entity makes the creator its data owner, so there is no way through the API to end up
     * with an unowned one. The unassigned bucket and the ownership-inheritance path both need one, so
     * the owner is cleared directly.
     */
    private void clearDataOwner(String entityKey) {
        def entity = businessEntityRepository.findByKey(entityKey).get()
        entity.dataOwner = null
        businessEntityRepository.update(entity)
    }

    private void assignOwningUnit(String token, String entityKey, String unitKey) {
        client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${entityKey}/owning-unit", [owningUnitKey: unitKey]).bearerAuth(token), Map)
    }

    private void setUnitParents(String token, String unitKey, List<String> parentKeys) {
        client.toBlocking().exchange(
                HttpRequest.PUT("/organisational-units/${unitKey}/parents", [keys: parentKeys]).bearerAuth(token), Map)
    }

    // Both configuration endpoints answer with the full list, which serde will not decode into a raw
    // List. Nothing here needs the body, so it is left undecoded.
    private void disableMethodology(String token, String key) {
        client.toBlocking().exchange(
                HttpRequest.PUT("/administration/methodology-configurations", [[key: key, enabled: false]]).bearerAuth(token))
    }

    private void hideField(String token, String entityType, String fieldName) {
        client.toBlocking().exchange(
                HttpRequest.PUT("/administration/field-configurations",
                        [[entityType: entityType, fieldName: fieldName, visibility: "HIDDEN"]]).bearerAuth(token))
    }

    private get(String token, String path) {
        client.toBlocking().exchange(HttpRequest.GET(path).bearerAuth(token), Map)
    }
}
