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
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.BusinessEntityVersionRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.repository.ProcessVersionRepository
import org.leargon.backend.repository.ServiceProviderRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

/**
 * Create-permission rule:
 *  - Root catalogue items may be created by an admin or an EDITOR/LEAD of the item's methodology
 *    (Entity → DATA_GOVERNANCE, Process → PROCESS_GOVERNANCE, ServiceProvider → GDPR, …).
 *  - A child of a hierarchical item may additionally be created by the parent's owner or steward.
 *  - A plain ROLE_USER (no role, no ownership) cannot create root items.
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
    @Inject SupportedLocaleRepository localeRepository

    def setup() {
        if (localeRepository.count() == 0) {
            localeRepository.save(new SupportedLocale(localeCode: "en", displayName: "English", isDefault: true, isActive: true, sortOrder: 1))
        }
    }

    def cleanup() {
        serviceProviderRepository.deleteAll()
        businessEntityVersionRepository.deleteAll()
        businessEntityRepository.deleteAll()
        processVersionRepository.deleteAll()
        processRepository.deleteAll()
        userRepository.deleteAll()
    }

    private String token(String email, String username, String roles) {
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

    private HttpStatus deleteStatus(String path, String token) {
        try {
            return client.toBlocking().exchange(HttpRequest.DELETE(path).bearerAuth(token)).status()
        } catch (HttpClientResponseException e) {
            return e.status
        }
    }

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

    def "a DATA_GOVERNANCE editor can create a root business entity"() {
        given:
        def t = token("dg@test.com", "dgeditor", "ROLE_USER,ROLE_EDITOR_DATA_GOVERNANCE")

        expect:
        postStatus("/business-entities", new CreateBusinessEntityRequest([new LocalizedText("en", "Customer")]), t) == HttpStatus.CREATED
    }

    def "a plain user cannot create a business entity (403)"() {
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
