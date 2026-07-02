package org.leargon.backend.controller

import io.micronaut.http.HttpRequest
import io.micronaut.http.client.HttpClient
import io.micronaut.http.client.annotation.Client
import io.micronaut.http.client.exceptions.HttpClientResponseException
import io.micronaut.test.extensions.spock.annotation.MicronautTest
import jakarta.inject.Inject
import org.leargon.backend.domain.SupportedLocale
import org.leargon.backend.model.BusinessEntityResponse
import org.leargon.backend.model.CreateBusinessEntityRequest
import org.leargon.backend.model.LocalizedText
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.BusinessEntityVersionRepository
import org.leargon.backend.repository.FieldVerificationRepository
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

/**
 * Proves the backend-computed `editableFields` never drifts from actual enforcement: for each actor,
 * a field is present in `editableFields` (on GET) IFF the matching per-field PUT succeeds. This is the
 * rigorous "edit button exactly where edit is possible, and vice versa" contract (Workstream D).
 */
@MicronautTest(transactional = false)
class EditableFieldsConsistencySpec extends Specification {

    @Inject
    @Client("/")
    HttpClient client

    @Inject UserRepository userRepository
    @Inject BusinessEntityRepository businessEntityRepository
    @Inject BusinessEntityVersionRepository businessEntityVersionRepository
    @Inject OrganisationalUnitRepository organisationalUnitRepository
    @Inject FieldVerificationRepository fieldVerificationRepository
    @Inject SupportedLocaleRepository localeRepository

    def setup() {
        if (localeRepository.count() == 0) {
            localeRepository.save(new SupportedLocale(localeCode: "en", displayName: "English", isDefault: true, isActive: true, sortOrder: 1))
        }
    }

    def cleanup() {
        fieldVerificationRepository.deleteAll()
        businessEntityVersionRepository.deleteAll()
        businessEntityRepository.deleteAll()
        organisationalUnitRepository.deleteAll()
        userRepository.deleteAll()
    }

    private Map userWithToken(String email, String username, String roles) {
        def resp = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/signup",
                        new SignupRequest(email, username, "password123", "Test", "User")),
                Map
        )
        def user = userRepository.findByEmail(email).get()
        user.roles = roles
        userRepository.update(user)
        return [token: resp.body().accessToken]
    }

    private List<String> editableFields(String key, String token) {
        def resp = client.toBlocking().exchange(
                HttpRequest.GET("/business-entities/${key}").bearerAuth(token),
                BusinessEntityResponse
        )
        return resp.body().editableFields ?: []
    }

    private int putRetentionStatus(String key, String token) {
        try {
            def resp = client.toBlocking().exchange(
                    HttpRequest.PUT("/business-entities/${key}/retention-period",
                            [retentionPeriod: [[locale: "en", text: "5 years"]]]).bearerAuth(token),
                    BusinessEntityResponse
            )
            return resp.status().code
        } catch (HttpClientResponseException e) {
            return e.status.code
        }
    }

    private int putNamesStatus(String key, String token) {
        try {
            def resp = client.toBlocking().exchange(
                    HttpRequest.PUT("/business-entities/${key}/names",
                            [[locale: "en", text: "Renamed"]]).bearerAuth(token),
                    BusinessEntityResponse
            )
            return resp.status().code
        } catch (HttpClientResponseException e) {
            return e.status.code
        }
    }

    def "editableFields matches per-field PUT enforcement for owner, non-owner, and admin"() {
        given: "an owner (DATA_GOVERNANCE editor) who creates and thus owns an entity"
        def owner = userWithToken("df-owner@test.com", "dfowner", "ROLE_USER,ROLE_EDITOR_DATA_GOVERNANCE")
        def nonOwner = userWithToken("df-other@test.com", "dfother", "ROLE_USER")
        def admin = userWithToken("df-admin@test.com", "dfadmin", "ROLE_USER,ROLE_ADMIN")

        def created = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities",
                        new CreateBusinessEntityRequest([new LocalizedText("en", "Customer")])).bearerAuth(owner.token),
                BusinessEntityResponse
        )
        String key = created.body().key

        // Snapshot editableFields before any mutation (renaming would change the key/slug).
        def ownerFields = editableFields(key, owner.token)
        def nonOwnerFields = editableFields(key, nonOwner.token)
        def adminFields = editableFields(key, admin.token)

        expect: "membership reflects who can edit"
        ownerFields.contains("retentionPeriod")
        ownerFields.contains("names")
        ownerFields.contains("qualityRules")
        nonOwnerFields.isEmpty()
        adminFields.contains("retentionPeriod")
        adminFields.contains("names")

        and: "retentionPeriod parity (a PUT that does not change the key): ∈ editableFields ⟺ 200"
        putRetentionStatus(key, nonOwner.token) == 403
        putRetentionStatus(key, admin.token) == 200
        putRetentionStatus(key, owner.token) == 200

        and: "names parity: non-owner blocked (no rename), owner allowed (rename done last)"
        putNamesStatus(key, nonOwner.token) == 403
        putNamesStatus(key, owner.token) == 200
    }

    def "editableFields reflects methodology scope for a scoped editor (not owner)"() {
        given: "an owner creates an entity; a separate DDD-only editor (not owner) looks at it"
        def owner = userWithToken("sc-owner@test.com", "scowner", "ROLE_USER,ROLE_EDITOR_DATA_GOVERNANCE")
        def dddEditor = userWithToken("sc-ddd@test.com", "scddd", "ROLE_USER,ROLE_EDITOR_DDD")

        def created = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities",
                        new CreateBusinessEntityRequest([new LocalizedText("en", "Order")])).bearerAuth(owner.token),
                BusinessEntityResponse
        )
        String key = created.body().key

        when: "the DDD editor (not owner) reads the entity"
        def fields = editableFields(key, dddEditor.token)

        then: "they may edit DDD-section fields (boundedContext) but not CORE fields (names)"
        fields.contains("boundedContext")
        !fields.contains("names")

        and: "enforcement agrees: renaming is forbidden for the scoped editor"
        putNamesStatus(key, dddEditor.token) == 403
    }
}
