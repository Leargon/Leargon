package org.leargon.backend.service

import io.micronaut.test.extensions.spock.annotation.MicronautTest
import jakarta.inject.Inject
import org.leargon.backend.domain.FieldConfiguration
import org.leargon.backend.domain.SupportedLocale
import org.leargon.backend.domain.User
import org.leargon.backend.repository.FieldConfigurationRepository
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

    @Inject
    FieldConfigurationRepository fieldConfigurationRepository

    static final String TYPE = "BUSINESS_ENTITY"

    def setup() {
        if (localeRepository.count() == 0) {
            localeRepository.save(new SupportedLocale(localeCode: "en", displayName: "English", isDefault: true, isActive: true, sortOrder: 1))
        }
        // Verification defaults to OFF — enable it for entities so setStatus is not rejected.
        fieldConfigurationRepository.save(new FieldConfiguration(
                entityType: "METHODOLOGY_VERIFICATION", fieldName: "DATA_GOVERNANCE",
                visibility: "SHOWN", section: "METHODOLOGY", maturityLevel: "BASIC"))
    }

    def cleanup() {
        fieldVerificationRepository.deleteAll()
        fieldConfigurationRepository.deleteByEntityType("METHODOLOGY_VERIFICATION")
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
        fieldVerificationService.sync(TYPE, entityId, owner, true, { String fn -> fn == "retentionPeriod.en" ? "7 years" : null }, [:])

        then:
        def row = status(entityId, "retentionPeriod.en")
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
        fieldVerificationService.sync(TYPE, entityId, admin, false, { String fn -> fn == "retentionPeriod.en" ? "7 years" : null }, [:])

        then:
        status(entityId, "retentionPeriod.en").status == "UNVERIFIED"
        status(entityId, "retentionPeriod.en").updatedByUsername == "admin1"
    }

    def "unchanged value preserves the prior status"() {
        given:
        def owner = saveUser("owner2")
        def admin = saveUser("admin2")
        long entityId = 5003L

        and: "owner verifies the field"
        fieldVerificationService.sync(TYPE, entityId, owner, true, { String fn -> fn == "retentionPeriod.en" ? "7 years" : null }, [:])

        when: "a non-owner saves with the SAME value"
        fieldVerificationService.sync(TYPE, entityId, admin, false, { String fn -> fn == "retentionPeriod.en" ? "7 years" : null }, [:])

        then: "status stays VERIFIED and verifier is unchanged"
        status(entityId, "retentionPeriod.en").status == "VERIFIED"
        status(entityId, "retentionPeriod.en").updatedByUsername == "owner2"
    }

    def "changed value by a non-owner flips VERIFIED back to UNVERIFIED"() {
        given:
        def owner = saveUser("owner3")
        def admin = saveUser("admin3")
        long entityId = 5004L
        fieldVerificationService.sync(TYPE, entityId, owner, true, { String fn -> fn == "retentionPeriod.en" ? "7 years" : null }, [:])

        when:
        fieldVerificationService.sync(TYPE, entityId, admin, false, { String fn -> fn == "retentionPeriod.en" ? "10 years" : null }, [:])

        then:
        status(entityId, "retentionPeriod.en").status == "UNVERIFIED"
        status(entityId, "retentionPeriod.en").lastValue == "10 years"
        status(entityId, "retentionPeriod.en").updatedByUsername == "admin3"
    }

    def "clearing a tracked field deletes its row (no status on an empty field)"() {
        given:
        def owner = saveUser("owner4")
        long entityId = 5005L
        fieldVerificationService.sync(TYPE, entityId, owner, true, { String fn -> fn == "retentionPeriod.en" ? "7 years" : null }, [:])

        when: "the field is cleared by a non-owner"
        def admin = saveUser("admin4")
        fieldVerificationService.sync(TYPE, entityId, admin, false, { String fn -> null }, [:])

        then:
        status(entityId, "retentionPeriod.en") == null
    }

    def "collection items are tracked per item (add → UNVERIFIED, edit → UNVERIFIED, remove → deleted)"() {
        given:
        def owner = saveUser("owner7")
        def admin = saveUser("admin7")
        long entityId = 5008L

        when: "a non-owner adds two relationship items"
        fieldVerificationService.sync(TYPE, entityId, admin, false, { null },
            ["relationship.1": "sigA", "relationship.2": "sigB"])

        then: "each item gets its own UNVERIFIED row"
        status(entityId, "relationship.1").status == "UNVERIFIED"
        status(entityId, "relationship.2").status == "UNVERIFIED"

        when: "owner re-syncs with unchanged item values"
        fieldVerificationService.sync(TYPE, entityId, owner, true, { null },
            ["relationship.1": "sigA", "relationship.2": "sigB"])

        then: "unchanged values keep prior status (not auto-verified)"
        status(entityId, "relationship.1").status == "UNVERIFIED"

        when: "item 1 is edited (signature changes) by the owner, item 2 removed"
        fieldVerificationService.sync(TYPE, entityId, owner, true, { null },
            ["relationship.1": "sigA-edited"])

        then: "item 1 flips VERIFIED (owner edit), item 2 row is deleted"
        status(entityId, "relationship.1").status == "VERIFIED"
        status(entityId, "relationship.1").lastValue == "sigA-edited"
        status(entityId, "relationship.2") == null
    }

    def "a multilingual collection field is tracked per-locale: editing one locale flips only that locale"() {
        given: "an owner verifies a quality rule's en + de descriptions and its base (severity) row"
        def owner = saveUser("mlOwner")
        def admin = saveUser("mlAdmin")
        long entityId = 5201L
        def items = { Map m -> m as Map<String, String> }

        fieldVerificationService.sync(TYPE, entityId, owner, true, { null }, items([
            "qualityRule.1"             : "MUST",
            "qualityRule.1.descriptions.en": "Email must be valid",
            "qualityRule.1.descriptions.de": "E-Mail muss gültig sein",
        ]))

        expect: "all three rows are owner-VERIFIED"
        status(entityId, "qualityRule.1").status == "VERIFIED"
        status(entityId, "qualityRule.1.descriptions.en").status == "VERIFIED"
        status(entityId, "qualityRule.1.descriptions.de").status == "VERIFIED"

        when: "a non-owner edits ONLY the German description"
        fieldVerificationService.sync(TYPE, entityId, admin, false, { null }, items([
            "qualityRule.1"             : "MUST",
            "qualityRule.1.descriptions.en": "Email must be valid",
            "qualityRule.1.descriptions.de": "E-Mail muss RFC-konform sein",
        ]))

        then: "only the German row flips UNVERIFIED; English + base stay VERIFIED"
        status(entityId, "qualityRule.1.descriptions.de").status == "UNVERIFIED"
        status(entityId, "qualityRule.1.descriptions.de").updatedByUsername == "mlAdmin"
        status(entityId, "qualityRule.1.descriptions.en").status == "VERIFIED"
        status(entityId, "qualityRule.1").status == "VERIFIED"

        when: "the German description is cleared (locale removed from the map)"
        fieldVerificationService.sync(TYPE, entityId, admin, false, { null }, items([
            "qualityRule.1"             : "MUST",
            "qualityRule.1.descriptions.en": "Email must be valid",
        ]))

        then: "its per-locale row is deleted (delete-on-missing), English + base untouched"
        status(entityId, "qualityRule.1.descriptions.de") == null
        status(entityId, "qualityRule.1.descriptions.en").status == "VERIFIED"
        status(entityId, "qualityRule.1").status == "VERIFIED"
    }

    def "reverting to a historically-VERIFIED value does NOT resurrect the old status (status is not value-keyed)"() {
        given: "owner verified value A"
        def owner = saveUser("ownerRev")
        def admin = saveUser("adminRev")
        long entityId = 5101L
        fieldVerificationService.sync(TYPE, entityId, owner, true, { String fn -> fn == "retentionPeriod.en" ? "A" : null }, [:])
        assert status(entityId, "retentionPeriod.en").status == "VERIFIED"

        and: "a non-owner changed it to B (now UNVERIFIED)"
        fieldVerificationService.sync(TYPE, entityId, admin, false, { String fn -> fn == "retentionPeriod.en" ? "B" : null }, [:])
        assert status(entityId, "retentionPeriod.en").status == "UNVERIFIED"

        when: "a non-owner changes it BACK to A — the value that was once VERIFIED"
        fieldVerificationService.sync(TYPE, entityId, admin, false, { String fn -> fn == "retentionPeriod.en" ? "A" : null }, [:])

        then: "it stays UNVERIFIED — the historical A-status is NOT brought back"
        status(entityId, "retentionPeriod.en").status == "UNVERIFIED"
        status(entityId, "retentionPeriod.en").lastValue == "A"
        status(entityId, "retentionPeriod.en").updatedByUsername == "adminRev"
    }

    def "owner editing to a historically-UNVERIFIED value verifies it (actor wins, not the value's history)"() {
        given: "value A was left UNVERIFIED by a non-owner"
        def owner = saveUser("ownerActor")
        def admin = saveUser("adminActor")
        long entityId = 5102L
        fieldVerificationService.sync(TYPE, entityId, admin, false, { String fn -> fn == "retentionPeriod.en" ? "A" : null }, [:])
        fieldVerificationService.sync(TYPE, entityId, admin, false, { String fn -> fn == "retentionPeriod.en" ? "B" : null }, [:])
        assert status(entityId, "retentionPeriod.en").status == "UNVERIFIED"

        when: "the owner edits back to A (which historically was UNVERIFIED)"
        fieldVerificationService.sync(TYPE, entityId, owner, true, { String fn -> fn == "retentionPeriod.en" ? "A" : null }, [:])

        then: "the owner's edit verifies it — value history is irrelevant"
        status(entityId, "retentionPeriod.en").status == "VERIFIED"
        status(entityId, "retentionPeriod.en").updatedByUsername == "ownerActor"
    }

    def "setStatus explicitly sets the status and verifier"() {
        given:
        def owner = saveUser("owner5")
        long entityId = 5006L

        when:
        fieldVerificationService.setStatus(TYPE, entityId, "retentionPeriod.en", "VERIFIED", owner, "7 years")

        then:
        status(entityId, "retentionPeriod.en").status == "VERIFIED"
        status(entityId, "retentionPeriod.en").updatedByUsername == "owner5"

        when: "reset to UNVERIFIED"
        fieldVerificationService.setStatus(TYPE, entityId, "retentionPeriod.en", "UNVERIFIED", owner, "7 years")

        then:
        status(entityId, "retentionPeriod.en").status == "UNVERIFIED"
    }

    def "deleteFor removes all rows for an entity"() {
        given:
        def owner = saveUser("owner6")
        long entityId = 5007L
        fieldVerificationService.sync(TYPE, entityId, owner, true, { String fn -> fn == "retentionPeriod.en" ? "7 years" : null }, [:])

        when:
        fieldVerificationService.deleteFor(TYPE, entityId)

        then:
        fieldVerificationService.getStatuses(TYPE, entityId).isEmpty()
    }
}
