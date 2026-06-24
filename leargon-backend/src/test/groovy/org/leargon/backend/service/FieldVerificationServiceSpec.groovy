package org.leargon.backend.service

import io.micronaut.test.extensions.spock.annotation.MicronautTest
import jakarta.inject.Inject
import org.leargon.backend.domain.SupportedLocale
import org.leargon.backend.domain.User
import org.leargon.backend.repository.FieldVerificationRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

@MicronautTest(transactional = false)
class FieldVerificationServiceSpec extends Specification {

    @Inject
    FieldVerificationService fieldVerificationService

    @Inject
    FieldVerificationRepository fieldVerificationRepository

    @Inject
    UserRepository userRepository

    @Inject
    SupportedLocaleRepository localeRepository

    static final String TYPE = "BUSINESS_ENTITY"

    def setup() {
        if (localeRepository.count() == 0) {
            localeRepository.save(new SupportedLocale(localeCode: "en", displayName: "English", isDefault: true, isActive: true, sortOrder: 1))
        }
    }

    def cleanup() {
        fieldVerificationRepository.deleteAll()
        userRepository.deleteAll()
    }

    private User saveUser(String username) {
        def u = new User(email: "${username}@test.com", username: username, passwordHash: "x")
        return userRepository.save(u)
    }

    private status(long entityId, String fieldName) {
        fieldVerificationService.getStatuses(TYPE, entityId).find { it.fieldName == fieldName }
    }

    def "owner edit marks a changed field VERIFIED"() {
        given:
        def owner = saveUser("owner1")
        long entityId = 5001L

        when:
        fieldVerificationService.sync(TYPE, entityId, owner, true, { String fn -> fn == "retentionPeriod" ? "7 years" : null })

        then:
        def row = status(entityId, "retentionPeriod")
        row != null
        row.status == "VERIFIED"
        row.updatedByUsername == "owner1"
        row.lastValue == "7 years"
    }

    def "non-owner edit marks a changed field UNVERIFIED"() {
        given:
        def admin = saveUser("admin1")
        long entityId = 5002L

        when:
        fieldVerificationService.sync(TYPE, entityId, admin, false, { String fn -> fn == "retentionPeriod" ? "7 years" : null })

        then:
        status(entityId, "retentionPeriod").status == "UNVERIFIED"
        status(entityId, "retentionPeriod").updatedByUsername == "admin1"
    }

    def "unchanged value preserves the prior status"() {
        given:
        def owner = saveUser("owner2")
        def admin = saveUser("admin2")
        long entityId = 5003L

        and: "owner verifies the field"
        fieldVerificationService.sync(TYPE, entityId, owner, true, { String fn -> fn == "retentionPeriod" ? "7 years" : null })

        when: "a non-owner saves with the SAME value"
        fieldVerificationService.sync(TYPE, entityId, admin, false, { String fn -> fn == "retentionPeriod" ? "7 years" : null })

        then: "status stays VERIFIED and verifier is unchanged"
        status(entityId, "retentionPeriod").status == "VERIFIED"
        status(entityId, "retentionPeriod").updatedByUsername == "owner2"
    }

    def "changed value by a non-owner flips VERIFIED back to UNVERIFIED"() {
        given:
        def owner = saveUser("owner3")
        def admin = saveUser("admin3")
        long entityId = 5004L
        fieldVerificationService.sync(TYPE, entityId, owner, true, { String fn -> fn == "retentionPeriod" ? "7 years" : null })

        when:
        fieldVerificationService.sync(TYPE, entityId, admin, false, { String fn -> fn == "retentionPeriod" ? "10 years" : null })

        then:
        status(entityId, "retentionPeriod").status == "UNVERIFIED"
        status(entityId, "retentionPeriod").lastValue == "10 years"
        status(entityId, "retentionPeriod").updatedByUsername == "admin3"
    }

    def "clearing a tracked field is detected as a change"() {
        given:
        def owner = saveUser("owner4")
        long entityId = 5005L
        fieldVerificationService.sync(TYPE, entityId, owner, true, { String fn -> fn == "retentionPeriod" ? "7 years" : null })

        when: "the field is cleared by a non-owner"
        def admin = saveUser("admin4")
        fieldVerificationService.sync(TYPE, entityId, admin, false, { String fn -> null })

        then:
        status(entityId, "retentionPeriod").status == "UNVERIFIED"
        status(entityId, "retentionPeriod").lastValue == null
    }

    def "setStatus explicitly sets the status and verifier"() {
        given:
        def owner = saveUser("owner5")
        long entityId = 5006L

        when:
        fieldVerificationService.setStatus(TYPE, entityId, "retentionPeriod", "VERIFIED", owner, "7 years")

        then:
        status(entityId, "retentionPeriod").status == "VERIFIED"
        status(entityId, "retentionPeriod").updatedByUsername == "owner5"

        when: "reset to UNVERIFIED"
        fieldVerificationService.setStatus(TYPE, entityId, "retentionPeriod", "UNVERIFIED", owner, "7 years")

        then:
        status(entityId, "retentionPeriod").status == "UNVERIFIED"
    }

    def "deleteFor removes all rows for an entity"() {
        given:
        def owner = saveUser("owner6")
        long entityId = 5007L
        fieldVerificationService.sync(TYPE, entityId, owner, true, { String fn -> fn == "retentionPeriod" ? "7 years" : null })

        when:
        fieldVerificationService.deleteFor(TYPE, entityId)

        then:
        fieldVerificationService.getStatuses(TYPE, entityId).isEmpty()
    }
}
