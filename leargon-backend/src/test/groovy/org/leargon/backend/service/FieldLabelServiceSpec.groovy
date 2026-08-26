package org.leargon.backend.service

import io.micronaut.test.extensions.spock.annotation.MicronautTest
import jakarta.inject.Inject
import org.leargon.backend.domain.BusinessEntity
import org.leargon.backend.domain.BusinessEntityRelationship
import org.leargon.backend.domain.Capability
import org.leargon.backend.domain.Classification
import org.leargon.backend.domain.ItSystem
import org.leargon.backend.domain.LocalizedText
import org.leargon.backend.domain.OrganisationalUnit
import org.leargon.backend.domain.ServiceProvider
import org.leargon.backend.domain.SupportedLocale
import org.leargon.backend.domain.User
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.repository.BusinessEntityRelationshipRepository
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.BusinessEntityVersionRepository
import org.leargon.backend.repository.ClassificationRepository
import org.leargon.backend.repository.ClassificationValueRepository
import org.leargon.backend.repository.CapabilityRepository
import org.leargon.backend.repository.ItSystemRepository
import org.leargon.backend.repository.ServiceProviderRepository
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

/**
 * Field names are storage keys. These specs pin that the to-do list shows the record behind the key —
 * a classification's name, the two entities a relationship joins — in each active locale.
 */
@MicronautTest(transactional = false)
class FieldLabelServiceSpec extends Specification {

    @Inject FieldLabelService fieldLabelService
    @Inject ClassificationRepository classificationRepository
    @Inject ClassificationValueRepository classificationValueRepository
    @Inject BusinessEntityRepository entityRepository
    @Inject BusinessEntityVersionRepository entityVersionRepository
    @Inject BusinessEntityRelationshipRepository relationshipRepository
    @Inject OrganisationalUnitRepository unitRepository
    @Inject SupportedLocaleRepository localeRepository
    @Inject UserRepository userRepository
    @Inject UserService userService
    @Inject CapabilityRepository capabilityRepository
    @Inject ItSystemRepository itSystemRepository
    @Inject ServiceProviderRepository serviceProviderRepository
    @Inject FieldConfigurationService fieldConfigurationService

    private User creator

    def setup() {
        cleanupData()
        creator = userService.createUser(
            new SignupRequest("labels@example.com", "labeluser", "password123", "Label", "User"))
        if (localeRepository.count() == 0) {
            localeRepository.save(new SupportedLocale(
                localeCode: "en", displayName: "English", isDefault: true, isActive: true, sortOrder: 1))
            localeRepository.save(new SupportedLocale(
                localeCode: "de", displayName: "Deutsch", isDefault: false, isActive: true, sortOrder: 2))
        }
    }

    def cleanup() {
        cleanupData()
    }

    private void cleanupData() {
        relationshipRepository.deleteAll()
        capabilityRepository.deleteAll()
        itSystemRepository.deleteAll()
        serviceProviderRepository.deleteAll()
        // Values reference their classification, so they go first.
        classificationValueRepository.deleteAll()
        classificationRepository.deleteAll()
        entityVersionRepository.deleteAll()
        entityRepository.deleteAll()
        unitRepository.deleteAll()
        userRepository.deleteAll()
    }

    private String textOf(List labels, String locale) {
        labels.find { it.locale == locale }?.text
    }

    /**
     * `findByKey` inner-joins `createdBy` on both entities and org units, so a fixture without a creator
     * is invisible to the lookups this service performs.
     */
    private BusinessEntity saveEntity(String key, Map names) {
        entityRepository.save(new BusinessEntity(
            key: key,
            createdBy: creator,
            names: names.collect { locale, text -> new LocalizedText(locale as String, text as String) }))
    }

    // ─── inventory fields ──────────────────────────────────────────────────────

    def "a plain inventory field is translated per locale"() {
        when:
        def labels = fieldLabelService.labelsOf("BUSINESS_PROCESS", "legalBasis")

        then:
        textOf(labels, "en") == "Legal Basis"
        textOf(labels, "de") == "Rechtsgrundlage"
    }

    def "a per-locale field is translated but keeps the locale it belongs to"() {
        when:
        def labels = fieldLabelService.labelsOf("BUSINESS_ENTITY", "descriptions.de")

        then:
        textOf(labels, "en") == "Description (de)"
        textOf(labels, "de") == "Beschreibung (de)"
    }

    def "a label that ends in parentheses is translated as a whole, not split at the brackets"() {
        expect:
        textOf(fieldLabelService.labelsOf("BUSINESS_PROCESS", "cycleTimeMinutes"), "de") == "Durchlaufzeit (Min.)"
    }

    def "a locale with no translations falls back to English"() {
        given:
        localeRepository.save(new SupportedLocale(
            localeCode: "it", displayName: "Italiano", isDefault: false, isActive: true, sortOrder: 3))

        expect:
        textOf(fieldLabelService.labelsOf("BUSINESS_PROCESS", "legalBasis"), "it") == "Legal Basis"
    }

    def "an unknown field name yields no label so the caller can fall back to the key"() {
        expect:
        fieldLabelService.labelsOf("BUSINESS_ENTITY", "somethingInvented").isEmpty()
    }

    // ─── classifications ───────────────────────────────────────────────────────

    def "a classification field shows the classification's name, not its key"() {
        given:
        classificationRepository.save(new Classification(
            key: "data-sensitivity",
            names: [new LocalizedText("en", "Data Sensitivity"), new LocalizedText("de", "Datensensitivität")],
            assignableTo: "BUSINESS_ENTITY"))

        when:
        def labels = fieldLabelService.labelsOf("BUSINESS_ENTITY", "classification.data-sensitivity")

        then:
        textOf(labels, "en") == "Classification: Data Sensitivity"
        textOf(labels, "de") == "Klassifizierung: Datensensitivität"
    }

    def "a classification that no longer exists falls back to its key"() {
        expect:
        textOf(fieldLabelService.labelsOf("BUSINESS_ENTITY", "classification.gone"), "en") == "Classification: gone"
    }

    // ─── translation coverage ──────────────────────────────────────────────────

    def "every inventory label has a translation entry"() {
        given: "the full inventory, with per-locale and classification placeholders expanded"
        def covered = FieldLabelTranslations.INSTANCE.coveredLabels()

        when: "each definition's label is reduced to the words that need translating"
        def missing = fieldConfigurationService.getDefinitions([] as Set).findAll { definition ->
            def label = definition.label
            def m = label =~ /^(.*) \(([a-zA-Z-]{2,10})\)$/
            // Covered either as a whole ("Cycle Time (min)") or by its base ("Description (en)").
            !covered.contains(label) && !(m.matches() && covered.contains(m[0][1]))
        }*.label.unique()

        then: "nothing is left showing English to a German or French reader"
        missing.isEmpty()
    }

    // ─── collection items ──────────────────────────────────────────────────────

    def "a relationship shows the two entities it joins"() {
        given:
        def customer = saveEntity("customer", [en: "Customer", de: "Kunde"])
        def order = saveEntity("order", [en: "Order", de: "Bestellung"])
        def relationship = relationshipRepository.save(new BusinessEntityRelationship(
            firstBusinessEntity: customer,
            secondBusinessEntity: order,
            firstCardinalityMinimum: 1,
            secondCardinalityMinimum: 0))

        when:
        def labels = fieldLabelService.labelsOf("BUSINESS_ENTITY", "relationship.${relationship.id}")

        then:
        textOf(labels, "en") == "Relationship: Customer ↔ Order"
        textOf(labels, "de") == "Beziehung: Kunde ↔ Bestellung"
    }

    def "a localized sub-field of a collection item names both the item and the sub-field"() {
        given:
        def customer = saveEntity("customer", [en: "Customer"])
        def order = saveEntity("order", [en: "Order"])
        def relationship = relationshipRepository.save(new BusinessEntityRelationship(
            firstBusinessEntity: customer,
            secondBusinessEntity: order,
            firstCardinalityMinimum: 1,
            secondCardinalityMinimum: 0))

        expect:
        textOf(fieldLabelService.labelsOf("BUSINESS_ENTITY", "relationship.${relationship.id}.descriptions.de"), "en") ==
            "Relationship: Customer ↔ Order — Description (de)"
    }

    def "an entity-keyed collection item shows the entity's name"() {
        given:
        saveEntity("customer", [en: "Customer", de: "Kunde"])

        when:
        def labels = fieldLabelService.labelsOf("BUSINESS_PROCESS", "inputEntity.customer")

        then:
        textOf(labels, "en") == "Input Data Entity: Customer"
        textOf(labels, "de") == "Eingehendes Datenobjekt: Kunde"
    }

    def "an org-unit-keyed collection item shows the unit's name"() {
        given:
        unitRepository.save(new OrganisationalUnit(
            key: "team-a", createdBy: creator, names: [new LocalizedText("en", "Team A")]))

        expect:
        textOf(fieldLabelService.labelsOf("BUSINESS_PROCESS", "executingUnit.team-a"), "en") == "Executing Unit: Team A"
    }

    def "an IT system, capability, service provider and bounded context are named too"() {
        given:
        capabilityRepository.save(new Capability(
            key: "billing", names: [new LocalizedText("en", "Billing")]))
        itSystemRepository.save(new ItSystem(
            key: "crm", names: [new LocalizedText("en", "Customer CRM")]))
        serviceProviderRepository.save(new ServiceProvider(
            key: "acme", names: [new LocalizedText("en", "Acme Hosting")]))

        expect:
        textOf(fieldLabelService.labelsOf("BUSINESS_PROCESS", "capability.billing"), "en") == "Capability: Billing"
        textOf(fieldLabelService.labelsOf("BUSINESS_PROCESS", "itSystem.crm"), "en") == "IT System: Customer CRM"
        textOf(fieldLabelService.labelsOf("BUSINESS_PROCESS", "serviceProvider.acme"), "en") ==
            "Service Provider: Acme Hosting"
    }

    def "a cross-border transfer names the country in the reader's language"() {
        when:
        def labels = fieldLabelService.labelsOf("BUSINESS_PROCESS", "crossBorderTransfer.CH")

        then:
        textOf(labels, "en") == "Cross-Border Transfer: Switzerland"
        textOf(labels, "de") == "Grenzüberschreitende Übermittlung: Schweiz"
    }

    def "a collection item whose record is gone keeps the key, still labelled"() {
        expect:
        textOf(fieldLabelService.labelsOf("BUSINESS_PROCESS", "itSystem.nosuchsystem"), "en") == "IT System: nosuchsystem"
        textOf(fieldLabelService.labelsOf("BUSINESS_ENTITY", "relationship.99999"), "en") == "Relationship: 99999"
    }
}
