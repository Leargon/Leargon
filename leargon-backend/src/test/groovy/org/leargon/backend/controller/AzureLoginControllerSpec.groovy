package org.leargon.backend.controller

import io.micronaut.context.annotation.Property
import io.micronaut.http.HttpRequest
import io.micronaut.http.HttpStatus
import io.micronaut.http.client.HttpClient
import io.micronaut.http.client.annotation.Client
import io.micronaut.http.client.exceptions.HttpClientResponseException
import io.micronaut.test.annotation.MockBean
import io.micronaut.test.extensions.spock.annotation.MicronautTest
import jakarta.inject.Inject
import org.leargon.backend.domain.SupportedLocale
import org.leargon.backend.domain.User
import org.leargon.backend.exception.AuthenticationException
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import org.leargon.backend.security.AzureTokenValidator
import spock.lang.Specification

/**
 * Azure Entra ID login. The real AzureTokenValidator validates RS256 tokens against Microsoft's JWKS —
 * infeasible to exercise from a test — so we replace it with a controllable @MockBean subclass returning
 * canned claims. Providing the AzureTokenValidator bean also satisfies AzureAuthService's @Requires,
 * activating the full `/authentication/azure-login` endpoint (user find/create + JWT). Covers success +
 * provisioning and the rejection paths. (@Property satisfies the validator bean's own @Requires.)
 */
@Property(name = "azure.tenant-id", value = "test-tenant-id")
@Property(name = "azure.client-id", value = "test-client-id")
@MicronautTest(transactional = false)
class AzureLoginControllerSpec extends Specification {

    /**
     * Token → claims stub; Spock can't mock the concrete validator (no Objenesis), so subclass it.
     * Behaviour is a STATIC field because @MockBean hands back an AOP-proxied instance we can't cast to.
     */
    static class StubValidator extends AzureTokenValidator {
        static Closure<Map<String, String>> behavior = { String token -> [:] }

        StubValidator() { super("test-tenant-id", "test-client-id") }

        @Override
        Map<String, String> validate(String idToken) { return behavior.call(idToken) }
    }

    @Inject
    @Client("/")
    HttpClient client

    @Inject
    UserRepository userRepository

    @Inject
    SupportedLocaleRepository localeRepository

    @Inject
    AzureTokenValidator tokenValidator

    @MockBean(AzureTokenValidator)
    AzureTokenValidator mockTokenValidator() {
        return new StubValidator()
    }

    def setup() {
        if (localeRepository.count() == 0) {
            localeRepository.save(new SupportedLocale(localeCode: "en", displayName: "English", isDefault: true, isActive: true, sortOrder: 1))
        }
    }

    def cleanup() {
        StubValidator.behavior = { String t -> [:] }
        userRepository.deleteAll()
    }

    private azureLogin(String idToken) {
        client.toBlocking().exchange(
                HttpRequest.POST("/authentication/azure-login", [idToken: idToken]),
                Map
        )
    }

    def "valid token provisions a new Azure user and returns a JWT"() {
        given: "the validator resolves the token to Azure claims"
        StubValidator.behavior = { String t -> [oid: "oid-new-1", email: "azure-new@test.com", name: "Jane Doe"] }

        when:
        def resp = azureLogin("tok-new")

        then: "a JWT + user is returned"
        resp.status() == HttpStatus.OK
        resp.body().accessToken
        resp.body().user.email == "azure-new@test.com"

        and: "the user is persisted as an Azure account"
        def u = userRepository.findByEmail("azure-new@test.com").get()
        u.azureOid == "oid-new-1"
        u.authProvider == "AZURE"
        u.firstName == "Jane"
        u.lastName == "Doe"
    }

    def "an existing local user is linked to Azure by email"() {
        given: "a pre-existing local account (created directly — signup is disabled under Azure)"
        userRepository.save(new User(
                email: "azure-link@test.com", username: "azurelink", passwordHash: "x",
                firstName: "Local", lastName: "User", roles: "ROLE_USER", enabled: true,
                isFallbackAdministrator: false, setupCompleted: true, preferredLanguage: "en"))

        and: "the validator resolves a token carrying that email"
        StubValidator.behavior = { String t -> [oid: "oid-link-9", email: "azure-link@test.com", givenName: "Al", familyName: "Ice"] }

        when:
        def resp = azureLogin("tok-link")

        then:
        resp.status() == HttpStatus.OK

        and: "the local account is now linked to the Azure oid"
        def u = userRepository.findByEmail("azure-link@test.com").get()
        u.azureOid == "oid-link-9"
    }

    def "repeated login for the same oid does not create a duplicate user"() {
        given:
        StubValidator.behavior = { String t -> [oid: "oid-dup", email: "azure-dup@test.com", name: "Dup User"] }

        when:
        azureLogin("tok-a")
        azureLogin("tok-b")

        then:
        userRepository.findByAzureOid("oid-dup").isPresent()
        userRepository.findAll().findAll { it.email == "azure-dup@test.com" }.size() == 1
    }

    def "an invalid token is rejected with 401"() {
        given: "the validator rejects the token"
        StubValidator.behavior = { String t -> throw new AuthenticationException("Invalid Azure token") }

        when:
        azureLogin("tok-bad")

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.UNAUTHORIZED
    }

    def "a token missing the required oid claim is rejected with 401"() {
        given:
        StubValidator.behavior = { String t -> [email: "azure-nooid@test.com", name: "No Oid"] }

        when:
        azureLogin("tok-no-oid")

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.UNAUTHORIZED
    }
}
