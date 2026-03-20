package org.leargon.backend.service

import io.micronaut.http.HttpStatus
import io.micronaut.http.exceptions.HttpStatusException
import jakarta.inject.Singleton
import org.leargon.backend.domain.SupportedLocale
import org.leargon.backend.model.CreateSupportedLocaleRequest
import org.leargon.backend.model.SupportedLocaleResponse
import org.leargon.backend.model.UpdateSupportedLocaleRequest
import org.leargon.backend.repository.BusinessDomainRepository
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.ClassificationRepository
import org.leargon.backend.repository.ClassificationValueRepository
import org.leargon.backend.repository.SupportedLocaleRepository

@Singleton
open class LocaleService(
    private val localeRepository: SupportedLocaleRepository,
    private val entityRepository: BusinessEntityRepository,
    private val domainRepository: BusinessDomainRepository,
    private val classificationRepository: ClassificationRepository,
    private val classificationValueRepository: ClassificationValueRepository
) {
    open fun getActiveLocales(): List<SupportedLocale> = localeRepository.findByIsActiveOrderBySortOrder(true)

    open fun getActiveLocalesAsResponses(): List<SupportedLocaleResponse> = getActiveLocales().map { toResponse(it) }

    open fun getAllLocalesAsResponses(): List<SupportedLocaleResponse> = localeRepository.findAllOrderBySortOrder().map { toResponse(it) }

    open fun getDefaultLocale(): SupportedLocale? = localeRepository.findByIsDefault(true).orElse(null)

    open fun isLocaleActive(localeCode: String): Boolean {
        val locale = localeRepository.findByLocaleCode(localeCode)
        return locale.isPresent && locale.get().isActive
    }

    open fun createLocale(request: CreateSupportedLocaleRequest): SupportedLocaleResponse {
        if (localeRepository.existsByLocaleCode(request.localeCode)) {
            throw HttpStatusException(HttpStatus.BAD_REQUEST, "Locale code '${request.localeCode}' already exists")
        }

        val validLanguageCodes =
            java.util.Locale
                .getISOLanguages()
                .toSet()
        val requestedLanguage = request.localeCode?.split(Regex("[-_]"), 2)?.get(0)

        if (requestedLanguage.isNullOrEmpty() || !validLanguageCodes.contains(requestedLanguage)) {
            throw HttpStatusException(HttpStatus.BAD_REQUEST, "Locale code '${request.localeCode}' is not a valid ISO 639-1 language code")
        }

        var locale = SupportedLocale()
        locale.localeCode = request.localeCode
        locale.displayName = request.displayName
        locale.isDefault = false
        locale.isActive = request.isActive ?: true
        locale.sortOrder = request.sortOrder ?: 0

        locale = localeRepository.save(locale)
        return toResponse(locale)
    }

    open fun updateLocale(
        id: Long,
        request: UpdateSupportedLocaleRequest
    ): SupportedLocaleResponse {
        var locale =
            localeRepository
                .findById(id)
                .orElseThrow { HttpStatusException(HttpStatus.NOT_FOUND, "Locale not found") }

        if (request.displayName != null) locale.displayName = request.displayName
        if (request.isActive != null) {
            if (locale.isDefault && !request.isActive!!) {
                throw HttpStatusException(HttpStatus.BAD_REQUEST, "Cannot deactivate the default locale")
            }
            locale.isActive = request.isActive!!
        }
        if (request.sortOrder != null) locale.sortOrder = request.sortOrder!!
        if (request.isDefault != null) {
            if (request.isDefault!!) {
                if (!locale.isDefault) {
                    val currentDefault = localeRepository.findByIsDefault(true).orElse(null)
                    if (currentDefault != null) {
                        currentDefault.isDefault = false
                        localeRepository.update(currentDefault)
                    }
                    locale.isDefault = true
                    locale.isActive = true
                }
            } else {
                throw HttpStatusException(HttpStatus.BAD_REQUEST, "Cannot unset default — use another locale as default instead")
            }
        }

        locale = localeRepository.update(locale)
        return toResponse(locale)
    }

    open fun deleteLocale(id: Long) {
        val locale =
            localeRepository
                .findById(id)
                .orElseThrow { HttpStatusException(HttpStatus.NOT_FOUND, "Locale not found") }

        if (locale.isDefault) {
            throw HttpStatusException(HttpStatus.BAD_REQUEST, "Cannot delete the default locale")
        }
        if (isLocaleInUse(locale.localeCode)) {
            throw HttpStatusException(
                HttpStatus.BAD_REQUEST,
                "Cannot delete locale '${locale.localeCode}' because it is used by existing translations"
            )
        }
        localeRepository.deleteById(id)
    }

    private fun isLocaleInUse(localeCode: String): Boolean =
        entityRepository.countByLocaleInTranslations(localeCode) > 0 ||
            domainRepository.countByLocaleInTranslations(localeCode) > 0 ||
            classificationRepository.countByLocaleInTranslations(localeCode) > 0 ||
            classificationValueRepository.countByLocaleInTranslations(localeCode) > 0

    private fun toResponse(locale: SupportedLocale): SupportedLocaleResponse =
        SupportedLocaleResponse(
            locale.id,
            locale.localeCode,
            locale.displayName,
            locale.isDefault,
            locale.isActive,
            locale.sortOrder
        )
}
