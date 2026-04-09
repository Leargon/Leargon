package org.leargon.backend.service

import io.micronaut.http.HttpStatus
import io.micronaut.http.exceptions.HttpStatusException
import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.SupportedLocale
import org.leargon.backend.model.CreateSupportedLocaleRequest
import org.leargon.backend.model.SupportedLocaleResponse
import org.leargon.backend.model.UpdateSupportedLocaleRequest
import org.leargon.backend.repository.BoundedContextRepository
import org.leargon.backend.repository.BusinessDomainRepository
import org.leargon.backend.repository.BusinessEntityRelationshipRepository
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.CapabilityRepository
import org.leargon.backend.repository.ClassificationRepository
import org.leargon.backend.repository.ClassificationValueRepository
import org.leargon.backend.repository.DomainEventRepository
import org.leargon.backend.repository.ItSystemRepository
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.repository.ServiceProviderRepository
import org.leargon.backend.repository.SupportedLocaleRepository

@Singleton
open class LocaleService(
    private val localeRepository: SupportedLocaleRepository,
    private val entityRepository: BusinessEntityRepository,
    private val domainRepository: BusinessDomainRepository,
    private val classificationRepository: ClassificationRepository,
    private val classificationValueRepository: ClassificationValueRepository,
    private val boundedContextRepository: BoundedContextRepository,
    private val domainEventRepository: DomainEventRepository,
    private val capabilityRepository: CapabilityRepository,
    private val processRepository: ProcessRepository,
    private val itSystemRepository: ItSystemRepository,
    private val serviceProviderRepository: ServiceProviderRepository,
    private val organisationalUnitRepository: OrganisationalUnitRepository,
    private val businessEntityRelationshipRepository: BusinessEntityRelationshipRepository,
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
        request: UpdateSupportedLocaleRequest,
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

    @Transactional
    open fun deleteLocale(id: Long) {
        val locale =
            localeRepository
                .findById(id)
                .orElseThrow { HttpStatusException(HttpStatus.NOT_FOUND, "Locale not found") }

        if (locale.isDefault) {
            throw HttpStatusException(HttpStatus.BAD_REQUEST, "Cannot delete the default locale")
        }

        cleanupLocaleTranslations(locale.localeCode)
        localeRepository.deleteById(id)
    }

    private fun cleanupLocaleTranslations(localeCode: String) {
        entityRepository.findAll().forEach { entity ->
            val namesBefore = entity.names.size
            val descBefore = entity.descriptions.size
            entity.names.removeIf { it.locale == localeCode }
            entity.descriptions.removeIf { it.locale == localeCode }
            if (entity.names.size != namesBefore || entity.descriptions.size != descBefore) {
                entityRepository.update(entity)
            }
        }

        domainRepository.findAll().forEach { domain ->
            val namesBefore = domain.names.size
            val descBefore = domain.descriptions.size
            domain.names.removeIf { it.locale == localeCode }
            domain.descriptions.removeIf { it.locale == localeCode }
            if (domain.names.size != namesBefore || domain.descriptions.size != descBefore) {
                domainRepository.update(domain)
            }
        }

        classificationRepository.findAll().forEach { classification ->
            val namesBefore = classification.names.size
            val descBefore = classification.descriptions.size
            classification.names.removeIf { it.locale == localeCode }
            classification.descriptions.removeIf { it.locale == localeCode }
            if (classification.names.size != namesBefore || classification.descriptions.size != descBefore) {
                classificationRepository.update(classification)
            }
        }

        classificationValueRepository.findAll().forEach { value ->
            val namesBefore = value.names.size
            val descBefore = value.descriptions.size
            value.names.removeIf { it.locale == localeCode }
            value.descriptions.removeIf { it.locale == localeCode }
            if (value.names.size != namesBefore || value.descriptions.size != descBefore) {
                classificationValueRepository.update(value)
            }
        }

        boundedContextRepository.findAll().forEach { bc ->
            val namesBefore = bc.names.size
            val descBefore = bc.descriptions.size
            bc.names.removeIf { it.locale == localeCode }
            bc.descriptions.removeIf { it.locale == localeCode }
            if (bc.names.size != namesBefore || bc.descriptions.size != descBefore) {
                boundedContextRepository.update(bc)
            }
        }

        domainEventRepository.findAll().forEach { event ->
            val namesBefore = event.names.size
            val descBefore = event.descriptions.size
            event.names.removeIf { it.locale == localeCode }
            event.descriptions.removeIf { it.locale == localeCode }
            if (event.names.size != namesBefore || event.descriptions.size != descBefore) {
                domainEventRepository.update(event)
            }
        }

        capabilityRepository.findAll().forEach { capability ->
            val namesBefore = capability.names.size
            val descBefore = capability.descriptions.size
            capability.names.removeIf { it.locale == localeCode }
            capability.descriptions.removeIf { it.locale == localeCode }
            if (capability.names.size != namesBefore || capability.descriptions.size != descBefore) {
                capabilityRepository.update(capability)
            }
        }

        processRepository.findAll().forEach { process ->
            val namesBefore = process.names.size
            val descBefore = process.descriptions.size
            process.names.removeIf { it.locale == localeCode }
            process.descriptions.removeIf { it.locale == localeCode }
            if (process.names.size != namesBefore || process.descriptions.size != descBefore) {
                processRepository.update(process)
            }
        }

        itSystemRepository.findAll().forEach { system ->
            val namesBefore = system.names.size
            val descBefore = system.descriptions.size
            system.names.removeIf { it.locale == localeCode }
            system.descriptions.removeIf { it.locale == localeCode }
            if (system.names.size != namesBefore || system.descriptions.size != descBefore) {
                itSystemRepository.update(system)
            }
        }

        serviceProviderRepository.findAll().forEach { sp ->
            val namesBefore = sp.names.size
            sp.names.removeIf { it.locale == localeCode }
            if (sp.names.size != namesBefore) {
                serviceProviderRepository.update(sp)
            }
        }

        organisationalUnitRepository.findAll().forEach { ou ->
            val namesBefore = ou.names.size
            val descBefore = ou.descriptions.size
            ou.names.removeIf { it.locale == localeCode }
            ou.descriptions.removeIf { it.locale == localeCode }
            if (ou.names.size != namesBefore || ou.descriptions.size != descBefore) {
                organisationalUnitRepository.update(ou)
            }
        }

        businessEntityRelationshipRepository.findAll().forEach { rel ->
            val descBefore = rel.descriptions.size
            rel.descriptions.removeIf { it.locale == localeCode }
            if (rel.descriptions.size != descBefore) {
                businessEntityRelationshipRepository.update(rel)
            }
        }
    }

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
