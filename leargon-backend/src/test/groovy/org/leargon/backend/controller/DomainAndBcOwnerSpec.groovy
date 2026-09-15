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
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.repository.BoundedContextRepository
import org.leargon.backend.repository.BusinessDomainRepository
import org.leargon.backend.repository.BusinessDomainVersionRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

/**
 * Explicit owner person on business domains and bounded contexts, with the inherited fallback
 * (owning unit → parent domain / domain) exposed as `effectiveOwner`.
 */
@MicronautTest(transactional = false)
class DomainAndBcOwnerSpec extends Specification {

    @Inject @Client("/") HttpClient client
    @Inject UserRepository userRepository
    @Inject SupportedLocaleRepository localeRepository
    @Inject BoundedContextRepository boundedContextRepository
    @Inject BusinessDomainRepository businessDomainRepository
    @Inject BusinessDomainVersionRepository businessDomainVersionRepository

    def setup() {
        if (localeRepository.count() == 0) {
            localeRepository.save(new SupportedLocale(localeCode: "en", displayName: "English", isDefault: true, isActive: true, sortOrder: 1))
        }
    }

    def cleanup() {
        boundedContextRepository.deleteAll()
        businessDomainVersionRepository.deleteAll()
        businessDomainRepository.findAll().each {
            it.parent = null
            businessDomainRepository.update(it)
        }
        businessDomainRepository.deleteAll()
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

    private Map createDomain(String token, Map extra = [:]) {
        client.toBlocking().exchange(
                HttpRequest.POST("/business-domains", [names: [[locale: "en", text: extra.name ?: "Domain"]]] + extra.findAll { it.key != "name" })
                        .bearerAuth(token), Map).body()
    }

    private Map createBc(String token, String domainKey, Map extra = [:]) {
        client.toBlocking().exchange(
                HttpRequest.POST("/business-domains/$domainKey/bounded-contexts", [names: [[locale: "en", text: extra.name ?: "Context"]]] + extra.findAll { it.key != "name" })
                        .bearerAuth(token), Map).body()
    }

    private HttpStatus putStatus(String path, Map body, String token) {
        try {
            return client.toBlocking().exchange(HttpRequest.PUT(path, body).bearerAuth(token), Map).status()
        } catch (HttpClientResponseException e) {
            return e.status
        }
    }

    def "a domain can be created with an explicit owner which is also its effective owner"() {
        given:
        def admin = token("own-admin@test.com", "ownadmin", "ROLE_USER,ROLE_ADMIN")
        token("alice@test.com", "alice")

        when:
        def domain = createDomain(admin, [name: "Sales", ownerUsername: "alice"])

        then:
        domain.owner.username == "alice"
        domain.effectiveOwner.username == "alice"
    }

    def "a subdomain without an owner inherits the parent domain's owner as effective owner"() {
        given:
        def admin = token("own-admin@test.com", "ownadmin", "ROLE_USER,ROLE_ADMIN")
        token("alice@test.com", "alice")
        def parent = createDomain(admin, [name: "Sales", ownerUsername: "alice"])

        when:
        def sub = createDomain(admin, [name: "Pricing", parentKey: parent.key])

        then:
        sub.owner == null
        sub.effectiveOwner.username == "alice"
    }

    def "an admin can assign a domain owner and the change is versioned"() {
        given:
        def admin = token("own-admin@test.com", "ownadmin", "ROLE_USER,ROLE_ADMIN")
        token("alice@test.com", "alice")
        def domain = createDomain(admin, [name: "Sales"])

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/business-domains/${domain.key}/owner", [ownerUsername: "alice"]).bearerAuth(admin), Map)
        def versions = client.toBlocking().exchange(
                HttpRequest.GET("/business-domains/${domain.key}/versions").bearerAuth(admin), Argument.listOf(Map)).body()

        then:
        response.status == HttpStatus.OK
        response.body().owner.username == "alice"
        versions.any { it.changeSummary == "Updated owner to alice" }
    }

    def "a parent-domain owner may delegate the ownership of a subdomain"() {
        given:
        def admin = token("own-admin@test.com", "ownadmin", "ROLE_USER,ROLE_ADMIN")
        def alice = token("alice@test.com", "alice")
        token("carol@test.com", "carol")
        def parent = createDomain(admin, [name: "Sales", ownerUsername: "alice"])
        def sub = createDomain(admin, [name: "Pricing", parentKey: parent.key])

        expect:
        putStatus("/business-domains/${sub.key}/owner", [ownerUsername: "carol"], alice) == HttpStatus.OK
        client.toBlocking().exchange(HttpRequest.GET("/business-domains/${sub.key}").bearerAuth(admin), Map).body().owner.username == "carol"
    }

    def "a plain user cannot assign a domain owner (403)"() {
        given:
        def admin = token("own-admin@test.com", "ownadmin", "ROLE_USER,ROLE_ADMIN")
        def stranger = token("stranger@test.com", "stranger")
        def domain = createDomain(admin, [name: "Sales"])

        expect:
        putStatus("/business-domains/${domain.key}/owner", [ownerUsername: "stranger"], stranger) == HttpStatus.FORBIDDEN
    }

    def "a bounded context without an owner inherits the domain owner; its owner can be assigned"() {
        given:
        def admin = token("own-admin@test.com", "ownadmin", "ROLE_USER,ROLE_ADMIN")
        token("alice@test.com", "alice")
        token("bob@test.com", "bob")
        def domain = createDomain(admin, [name: "Sales", ownerUsername: "alice"])
        def bc = createBc(admin, domain.key, [name: "Billing"])

        expect: "the context inherits the domain owner"
        bc.owner == null
        bc.effectiveOwner.username == "alice"

        when: "the admin assigns an explicit owner"
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/bounded-contexts/${bc.key}/owner", [ownerUsername: "bob"]).bearerAuth(admin), Map)

        then:
        response.body().owner.username == "bob"
        response.body().effectiveOwner.username == "bob"
    }

    def "a domain owner may assign the owner of a bounded context in the domain; a stranger may not"() {
        given:
        def admin = token("own-admin@test.com", "ownadmin", "ROLE_USER,ROLE_ADMIN")
        def alice = token("alice@test.com", "alice")
        token("bob@test.com", "bob")
        def stranger = token("stranger@test.com", "stranger")
        def domain = createDomain(admin, [name: "Sales", ownerUsername: "alice"])
        def bc = createBc(admin, domain.key, [name: "Billing"])

        expect:
        putStatus("/bounded-contexts/${bc.key}/owner", [ownerUsername: "bob"], stranger) == HttpStatus.FORBIDDEN
        putStatus("/bounded-contexts/${bc.key}/owner", [ownerUsername: "bob"], alice) == HttpStatus.OK
    }

    def "a bounded context can be created with an explicit owner"() {
        given:
        def admin = token("own-admin@test.com", "ownadmin", "ROLE_USER,ROLE_ADMIN")
        token("bob@test.com", "bob")
        def domain = createDomain(admin, [name: "Sales"])

        when:
        def bc = createBc(admin, domain.key, [name: "Billing", ownerUsername: "bob"])

        then:
        bc.owner.username == "bob"
        bc.effectiveOwner.username == "bob"
    }

    def "a justified same-named bounded context in one domain receives a distinct key"() {
        given:
        def admin = token("own-admin@test.com", "ownadmin", "ROLE_USER,ROLE_ADMIN")
        def domain = createDomain(admin, [name: "Sales"])

        when:
        def first = createBc(admin, domain.key, [name: "Billing"])
        def second = createBc(admin, domain.key, [name                     : "Billing",
                                                  duplicateJustification   : [[locale: "en", text: "Separate billing context for B2B"]],
                                                  acknowledgedDuplicateKeys: [first.key]])

        then:
        first.key != second.key
        second.key == "${first.key}-2"
    }
}
