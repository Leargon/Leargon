package org.leargon.backend.service

import io.micronaut.test.extensions.spock.annotation.MicronautTest
import jakarta.inject.Inject
import org.leargon.backend.domain.SupportedLocale
import org.leargon.backend.repository.SupportedLocaleRepository
import spock.lang.Specification

@MicronautTest(transactional = false)
class LocaleServiceSpec extends Specification {

    @Inject
    SupportedLocaleRepository localeRepository

    @Inject
    LocaleService localeService

    def setup() {
        // Ensure locale data exists
        if (localeRepository.count() == 0) {
            def enLocale = new SupportedLocale()
            enLocale.localeCode = "en"
            enLocale.displayName = "English"
            enLocale.isDefault = true
            enLocale.isActive = true
            enLocale.sortOrder = 1
            localeRepository.save(enLocale)

            def deLocale = new SupportedLocale()
            deLocale.localeCode = "de"
            deLocale.displayName = "Deutsch"
            deLocale.isDefault = false
            deLocale.isActive = true
            deLocale.sortOrder = 2
            localeRepository.save(deLocale)
        }
    }

    def "should return active locales ordered by sort order"() {
        when: "getting active locales"
        def locales = localeService.getActiveLocales()

        then: "active locales are returned"
        locales != null
        locales.size() >= 2

        and: "locales are ordered by sort order"
        locales[0].sortOrder <= locales[1].sortOrder
    }

    def "should return active locales as response DTOs"() {
        when: "getting active locales as responses"
        def responses = localeService.getActiveLocalesAsResponses()

        then: "responses are returned"
        responses != null
        responses.size() >= 2

        and: "responses contain expected fields"
        responses.every { it.localeCode != null }
        responses.every { it.displayName != null }
    }

    def "should return default locale"() {
        when: "getting default locale"
        def defaultLocale = localeService.getDefaultLocale()

        then: "default locale is returned"
        defaultLocale != null
        defaultLocale.isDefault == true
        defaultLocale.localeCode == "en"
    }

    def "should check if locale is active"() {
        expect: "en and de are active"
        localeService.isLocaleActive("en")
        localeService.isLocaleActive("de")

        and: "non-existent locale is not active"
        !localeService.isLocaleActive("fr")
        !localeService.isLocaleActive("xyz")
    }

}
