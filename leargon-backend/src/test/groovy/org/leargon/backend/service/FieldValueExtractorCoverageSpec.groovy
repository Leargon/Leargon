package org.leargon.backend.service

import io.micronaut.test.extensions.spock.annotation.MicronautTest
import jakarta.inject.Inject
import org.leargon.backend.domain.BusinessDomain
import org.leargon.backend.domain.BusinessEntity
import org.leargon.backend.domain.OrganisationalUnit
import org.leargon.backend.domain.Process
import org.leargon.backend.domain.SupportedLocale
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.service.fieldvalue.BusinessDomainFieldValueExtractor
import org.leargon.backend.service.fieldvalue.BusinessEntityFieldValueExtractor
import org.leargon.backend.service.fieldvalue.OrganisationalUnitFieldValueExtractor
import org.leargon.backend.service.fieldvalue.ProcessFieldValueExtractor
import spock.lang.Specification

/**
 * Guards verification coverage: every concrete inventory field for each entity type must be
 * handled by its extractor (no `else -> error(...)`). A new field added to the inventory but not
 * wired to an extractor fails this test instead of silently skipping verification.
 */
@MicronautTest(transactional = false)
class FieldValueExtractorCoverageSpec extends Specification {

    @Inject
    FieldConfigurationService fieldConfigurationService

    @Inject
    BusinessEntityFieldValueExtractor entityExtractor

    @Inject
    BusinessDomainFieldValueExtractor domainExtractor

    @Inject
    ProcessFieldValueExtractor processExtractor

    @Inject
    OrganisationalUnitFieldValueExtractor orgUnitExtractor

    @Inject
    SupportedLocaleRepository localeRepository

    def setup() {
        if (localeRepository.count() == 0) {
            localeRepository.save(new SupportedLocale(localeCode: "en", displayName: "English", isDefault: true, isActive: true, sortOrder: 1))
            localeRepository.save(new SupportedLocale(localeCode: "de", displayName: "Deutsch", isDefault: false, isActive: true, sortOrder: 2))
        }
    }

    def "every inventory field is handled by its extractor"() {
        expect: "no concrete field name throws (all handled, none hit else -> error)"
        [
            "BUSINESS_ENTITY"    : { String fn -> entityExtractor.value(new BusinessEntity(), fn) },
            "BUSINESS_DOMAIN"    : { String fn -> domainExtractor.value(new BusinessDomain(), fn) },
            "BUSINESS_PROCESS"   : { String fn -> processExtractor.value(new Process(), fn) },
            "ORGANISATIONAL_UNIT": { String fn -> orgUnitExtractor.value(new OrganisationalUnit(), fn) }
        ].each { entityType, probe ->
            def fields = fieldConfigurationService.concreteFieldNames(entityType)
            assert fields.size() > 0
            fields.each { fn -> probe.call(fn) }
        }
    }

    def "classification fields are handled generically"() {
        expect:
        entityExtractor.value(new BusinessEntity(), "classification.gdpr") == null
        domainExtractor.value(new BusinessDomain(), "classification.gdpr") == null
        processExtractor.value(new Process(), "classification.gdpr") == null
        orgUnitExtractor.value(new OrganisationalUnit(), "classification.gdpr") == null
    }
}
