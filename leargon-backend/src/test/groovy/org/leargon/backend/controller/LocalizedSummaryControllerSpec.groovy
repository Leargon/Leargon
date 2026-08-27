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
import org.leargon.backend.model.CreateProcessRequest
import org.leargon.backend.model.LocalizedText
import org.leargon.backend.model.LoginRequest
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.BusinessEntityVersionRepository
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.repository.ProcessVersionRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

/**
 * A neighbour reference — the owning unit of an entity, the parent of a process — is rendered from a
 * *SummaryResponse. Those used to carry a single name resolved against a hardcoded "en", so a
 * German-only catalogue read as English no matter which language the reader had selected.
 *
 * These specs pin both halves of the fix: the summary carries every locale in `names`, and the flat
 * `name` fallback follows the tenant's configured default locale rather than English.
 */
@MicronautTest(transactional = false)
class LocalizedSummaryControllerSpec extends Specification {

    @Inject
    @Client("/")
    HttpClient client

    @Inject UserRepository userRepository
    @Inject OrganisationalUnitRepository organisationalUnitRepository
    @Inject BusinessEntityRepository businessEntityRepository
    @Inject BusinessEntityVersionRepository businessEntityVersionRepository
    @Inject ProcessRepository processRepository
    @Inject ProcessVersionRepository processVersionRepository
    @Inject SupportedLocaleRepository localeRepository

    def setup() {
        seedLocales("en")
    }

    def cleanup() {
        processVersionRepository.deleteAll()
        processRepository.deleteAll()
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

    def "an owning unit summary carries every locale its name is defined in"() {
        given: "a unit named in both English and German"
        String token = adminToken()
        createUnit(token, [new LocalizedText("en", "Logistics"), new LocalizedText("de", "Logistik")])

        and: "an entity owned by it"
        createEntity(token, [new LocalizedText("en", "Order Line Item"), new LocalizedText("de", "Bestellposition")])
        assignOwningUnit(token, "order-line-item", "logistics")

        when:
        def response = fetch(token, "/business-entities/order-line-item")

        then: "the owning unit summary offers both languages, not only English"
        response.status() == HttpStatus.OK
        def names = response.body().owningUnit.names
        names*.locale.toSet() == ["en", "de"] as Set
        names.find { it.locale == "de" }.text == "Logistik"
        names.find { it.locale == "en" }.text == "Logistics"
    }

    def "a parent entity reference carries every locale its name is defined in"() {
        given:
        String token = adminToken()
        String parentKey = createEntity(token, [new LocalizedText("en", "Order"), new LocalizedText("de", "Bestellung")])
        String childKey = createEntity(token, [new LocalizedText("en", "Order Line Item"), new LocalizedText("de", "Bestellposition")])

        when: "the child is re-parented, which also re-keys it underneath the parent"
        def updated = setEntityParent(token, childKey, parentKey)

        then:
        updated.body().parent.names.find { it.locale == "de" }.text == "Bestellung"
        updated.body().parent.names.find { it.locale == "en" }.text == "Order"
    }

    def "the flat summary name follows the tenant default locale rather than English"() {
        given: "a tenant whose default locale is German"
        seedLocales("de")
        String token = adminToken()
        String unitKey = createUnit(token, [new LocalizedText("en", "Logistics"), new LocalizedText("de", "Logistik")])
        String entityKey = createEntity(token, [new LocalizedText("en", "Order Line Item"), new LocalizedText("de", "Bestellposition")])
        assignOwningUnit(token, entityKey, unitKey)

        when:
        def response = fetch(token, "/business-entities/" + entityKey)

        then: "the compatibility field reads German, which is what this tenant calls its default"
        response.status() == HttpStatus.OK
        response.body().owningUnit.name == "Logistik"
    }

    def "a name missing in the default locale falls back silently rather than blanking"() {
        given: "a catalogue built while English was the default locale"
        String token = adminToken()
        String unitKey = createUnit(token, [new LocalizedText("en", "Logistics"), new LocalizedText("de", "Logistik")])
        String entityKey = createEntity(token, [new LocalizedText("en", "Order Line Item"), new LocalizedText("de", "Bestellposition")])
        assignOwningUnit(token, entityKey, unitKey)

        and: "an administrator later adds French and makes it the default, which nothing is translated into"
        addDefaultLocale("fr", "Francais")

        when:
        def response = fetch(token, "/business-entities/" + entityKey)

        then: "an existing translation is shown rather than an empty label, and nothing flags the gap"
        response.status() == HttpStatus.OK
        response.body().owningUnit.name in ["Logistics", "Logistik"]
        response.body().owningUnit.names.size() == 2
    }

    def "a parent process summary carries its localized names too"() {
        given:
        String token = adminToken()
        String parentKey = createProcess(token, [new LocalizedText("en", "Order Fulfillment"), new LocalizedText("de", "Auftragsabwicklung")])
        String childKey = createProcess(token, [new LocalizedText("en", "Picking"), new LocalizedText("de", "Kommissionierung")])

        when:
        def updated = setProcessParent(token, childKey, parentKey)

        then:
        updated.body().parentProcess.names.find { it.locale == "de" }.text == "Auftragsabwicklung"
    }

    def "an unauthenticated caller cannot read a localized summary"() {
        when: "the entity is requested with no bearer token"
        client.toBlocking().exchange(HttpRequest.GET("/business-entities/order-line-item"), Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.UNAUTHORIZED
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private void seedLocales(String defaultLocale) {
        localeRepository.deleteAll()
        int order = 1
        ["en": "English", "de": "Deutsch"].each { code, displayName ->
            def locale = new SupportedLocale()
            locale.localeCode = code
            locale.displayName = displayName
            locale.isDefault = code == defaultLocale
            locale.isActive = true
            locale.sortOrder = order++
            localeRepository.save(locale)
        }
    }

    private String adminToken() {
        if (!userRepository.findByEmail("admin@example.com").isPresent()) {
            client.toBlocking().exchange(HttpRequest.POST("/authentication/signup",
                    new SignupRequest("admin@example.com", "admin", "password123", "Admin", "User")))
            def user = userRepository.findByEmail("admin@example.com").get()
            user.roles = "ROLE_USER,ROLE_ADMIN"
            userRepository.update(user)
        }
        def login = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/login", new LoginRequest("admin@example.com", "password123")), Map)
        return login.body().accessToken
    }

    // The server derives a key from the default-locale name and re-derives it on re-parenting, so the
    // helpers hand back whatever key the server actually assigned rather than guessing at a slug.
    private String createUnit(String token, List<LocalizedText> names) {
        client.toBlocking().exchange(
                HttpRequest.POST("/organisational-units", new CreateOrganisationalUnitRequest(names)).bearerAuth(token), Map)
                .body().key
    }

    private String createEntity(String token, List<LocalizedText> names) {
        client.toBlocking().exchange(
                HttpRequest.POST("/business-entities", new CreateBusinessEntityRequest(names)).bearerAuth(token), Map)
                .body().key
    }

    private String createProcess(String token, List<LocalizedText> names) {
        client.toBlocking().exchange(
                HttpRequest.POST("/processes", new CreateProcessRequest(names)).bearerAuth(token), Map)
                .body().key
    }

    private void addDefaultLocale(String code, String displayName) {
        localeRepository.findAll().each { existing ->
            existing.isDefault = false
            localeRepository.update(existing)
        }
        def locale = new SupportedLocale()
        locale.localeCode = code
        locale.displayName = displayName
        locale.isDefault = true
        locale.isActive = true
        locale.sortOrder = 9
        localeRepository.save(locale)
    }

    private void assignOwningUnit(String token, String entityKey, String unitKey) {
        client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${entityKey}/owning-unit", [owningUnitKey: unitKey]).bearerAuth(token), Map)
    }

    private setEntityParent(String token, String childKey, String parentKey) {
        client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${childKey}/parent", [parentKey: parentKey]).bearerAuth(token), Map)
    }

    private setProcessParent(String token, String childKey, String parentKey) {
        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${childKey}/parent", [parentKey: parentKey]).bearerAuth(token), Map)
    }

    private fetch(String token, String path) {
        client.toBlocking().exchange(HttpRequest.GET(path).bearerAuth(token), Map)
    }
}
