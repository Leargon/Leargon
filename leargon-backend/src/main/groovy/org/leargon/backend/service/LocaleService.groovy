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
class LocaleService {

    private final SupportedLocaleRepository localeRepository
    private final BusinessEntityRepository entityRepository
    private final BusinessDomainRepository domainRepository
    private final ClassificationRepository classificationRepository
    private final ClassificationValueRepository classificationValueRepository

    LocaleService(SupportedLocaleRepository localeRepository,
                  BusinessEntityRepository entityRepository,
                  BusinessDomainRepository domainRepository,
                  ClassificationRepository classificationRepository,
                  ClassificationValueRepository classificationValueRepository) {
        this.localeRepository = localeRepository
        this.entityRepository = entityRepository
        this.domainRepository = domainRepository
        this.classificationRepository = classificationRepository
        this.classificationValueRepository = classificationValueRepository
    }

    List<SupportedLocale> getActiveLocales() {
        return localeRepository.findByIsActiveOrderBySortOrder(true)
    }

    List<SupportedLocaleResponse> getActiveLocalesAsResponses() {
        return getActiveLocales().collect { toResponse(it) }
    }

    List<SupportedLocaleResponse> getAllLocalesAsResponses() {
        return localeRepository.findAllOrderBySortOrder().collect { toResponse(it) }
    }

    SupportedLocale getDefaultLocale() {
        return localeRepository.findByIsDefault(true).orElse(null)
    }

    boolean isLocaleActive(String localeCode) {
        def locale = localeRepository.findByLocaleCode(localeCode)
        return locale.isPresent() && locale.get().isActive
    }

    SupportedLocaleResponse createLocale(CreateSupportedLocaleRequest request) {
        if (localeRepository.existsByLocaleCode(request.localeCode)) {
            throw new HttpStatusException(HttpStatus.BAD_REQUEST, "Locale code '${request.localeCode}' already exists")
        }

        def locale = new SupportedLocale()
        locale.localeCode = request.localeCode
        locale.displayName = request.displayName
        locale.isDefault = false
        locale.isActive = request.isActive != null ? request.isActive : true
        locale.sortOrder = request.sortOrder != null ? request.sortOrder : 0

        locale = localeRepository.save(locale)
        return toResponse(locale)
    }

    SupportedLocaleResponse updateLocale(Long id, UpdateSupportedLocaleRequest request) {
        def locale = localeRepository.findById(id)
                .orElseThrow { new HttpStatusException(HttpStatus.NOT_FOUND, "Locale not found") }

        if (request.displayName != null) {
            locale.displayName = request.displayName
        }
        if (request.isActive != null) {
            if (locale.isDefault && !request.isActive) {
                throw new HttpStatusException(HttpStatus.BAD_REQUEST, "Cannot deactivate the default locale")
            }
            locale.isActive = request.isActive
        }
        if (request.sortOrder != null) {
            locale.sortOrder = request.sortOrder
        }

        locale = localeRepository.update(locale)
        return toResponse(locale)
    }

    void deleteLocale(Long id) {
        def locale = localeRepository.findById(id)
                .orElseThrow { new HttpStatusException(HttpStatus.NOT_FOUND, "Locale not found") }

        if (locale.isDefault) {
            throw new HttpStatusException(HttpStatus.BAD_REQUEST, "Cannot delete the default locale")
        }

        if (isLocaleInUse(locale.localeCode)) {
            throw new HttpStatusException(HttpStatus.BAD_REQUEST, "Cannot delete locale '${locale.localeCode}' because it is used by existing translations")
        }

        localeRepository.deleteById(id)
    }

    private boolean isLocaleInUse(String localeCode) {
        // Check business entities
        for (def entity : entityRepository.findAll()) {
            if (entity.names?.any { it.locale == localeCode }) return true
            if (entity.descriptions?.any { it.locale == localeCode }) return true
        }

        // Check business domains
        for (def domain : domainRepository.findAll()) {
            if (domain.names?.any { it.locale == localeCode }) return true
            if (domain.descriptions?.any { it.locale == localeCode }) return true
        }

        // Check classifications
        for (def classification : classificationRepository.findAll()) {
            if (classification.names?.any { it.locale == localeCode }) return true
            if (classification.descriptions?.any { it.locale == localeCode }) return true
        }

        // Check classification values
        for (def value : classificationValueRepository.findAll()) {
            if (value.names?.any { it.locale == localeCode }) return true
            if (value.descriptions?.any { it.locale == localeCode }) return true
        }

        return false
    }

    SupportedLocaleResponse toResponse(SupportedLocale locale) {
        return new SupportedLocaleResponse(
            locale.id,
            locale.localeCode,
            locale.displayName,
            locale.isDefault,
            locale.isActive,
            locale.sortOrder
        )
    }
}
