package org.leargon.backend.service

import io.micronaut.test.extensions.spock.annotation.MicronautTest
import jakarta.inject.Inject
import org.leargon.backend.domain.BusinessEntity
import org.leargon.backend.domain.FieldVerification
import org.leargon.backend.domain.LocalizedText
import org.leargon.backend.domain.SupportedLocale
import org.leargon.backend.domain.User
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.FieldVerificationRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

@MicronautTest(transactional = false)
class FieldVerificationBackfillServiceSpec extends Specification {

    @Inject FieldVerificationBackfillService backfillService
    @Inject FieldVerificationService fieldVerificationService
    @Inject FieldVerificationRepository fieldVerificationRepository
    @Inject BusinessEntityRepository businessEntityRepository
    @Inject UserRepository userRepository
    @Inject SupportedLocaleRepository localeRepository

    User creator

    def setup() {
        if (localeRepository.count() == 0) {
            localeRepository.save(new SupportedLocale(localeCode: "en", displayName: "English", isDefault: true, isActive: true, sortOrder: 1))
        }
        creator = userRepository.save(new User(email: "creator@test.com", username: "creator", passwordHash: "x"))
    }

    def cleanup() {
        fieldVerificationRepository.deleteAll()
        businessEntityRepository.deleteAll()
        userRepository.deleteAll()
    }

    /** An entity persisted directly (as if it predates the feature — no verification rows). createdBy is
     *  required because the list/detail repository joins it INNER (null-createdBy entities are invisible). */
    private BusinessEntity persistEntity(String key) {
        def e = new BusinessEntity()
        e.key = key
        e.names = [new LocalizedText("en", "Customer")]
        e.createdBy = creator
        e.dataOwner = creator
        return businessEntityRepository.save(e)
    }

    def "backfill seeds UNVERIFIED 'system' rows for entities that have none"() {
        given:
        def e = persistEntity("cust")

        when:
        backfillService.backfillBusinessEntities()

        then:
        def nameEn = fieldVerificationService.getStatuses("BUSINESS_ENTITY", e.id).find { it.fieldName == "names.en" }
        nameEn != null
        nameEn.status == "UNVERIFIED"
        nameEn.updatedByUsername == "system"
        nameEn.updatedBy == null
        nameEn.lastValue == "Customer"

        and: "a scalar field is seeded too"
        fieldVerificationService.getStatuses("BUSINESS_ENTITY", e.id).find { it.fieldName == "dataOwner" }?.status == "UNVERIFIED"
    }

    def "backfill is idempotent — a second run adds nothing"() {
        given:
        persistEntity("cust2")
        backfillService.backfillBusinessEntities()
        def afterFirst = fieldVerificationRepository.count()

        when:
        backfillService.backfillBusinessEntities()

        then:
        afterFirst > 0
        fieldVerificationRepository.count() == afterFirst
    }

    def "backfill does not disturb an entity that already has rows"() {
        given: "an entity with one verified row already"
        def e = persistEntity("cust3")
        fieldVerificationRepository.save(new FieldVerification(
            entityType: "BUSINESS_ENTITY", entityId: e.id, fieldName: "names.en",
            status: "VERIFIED", lastValue: "Customer", updatedByUsername: "alice"))

        when:
        backfillService.backfillBusinessEntities()

        then: "the existing VERIFIED row is preserved (entity already covered → skipped)"
        def nameEn = fieldVerificationService.getStatuses("BUSINESS_ENTITY", e.id).find { it.fieldName == "names.en" }
        nameEn.status == "VERIFIED"
        nameEn.updatedByUsername == "alice"
    }
}
