package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.LocalizedText
import org.leargon.backend.domain.OrganisationalUnit
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.mapper.OrganisationalUnitMapper
import org.leargon.backend.model.*
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.repository.UserRepository
import org.leargon.backend.util.SlugUtil

@Singleton
class OrganisationalUnitService {

    private final OrganisationalUnitRepository organisationalUnitRepository
    private final ProcessRepository processRepository
    private final UserRepository userRepository
    private final LocaleService localeService
    private final OrganisationalUnitMapper organisationalUnitMapper

    OrganisationalUnitService(
            OrganisationalUnitRepository organisationalUnitRepository,
            ProcessRepository processRepository,
            UserRepository userRepository,
            LocaleService localeService,
            OrganisationalUnitMapper organisationalUnitMapper
    ) {
        this.organisationalUnitRepository = organisationalUnitRepository
        this.processRepository = processRepository
        this.userRepository = userRepository
        this.localeService = localeService
        this.organisationalUnitMapper = organisationalUnitMapper
    }

    @Transactional
    List<OrganisationalUnitResponse> getAllAsResponses() {
        def m = this.organisationalUnitMapper
        return organisationalUnitRepository.findAll().collect { m.toResponse(it) }
    }

    @Transactional
    List<OrganisationalUnitTreeResponse> getTreeAsResponses() {
        def m = this.organisationalUnitMapper
        List<OrganisationalUnit> roots = organisationalUnitRepository.findRoots()
        return m.toTreeResponses(roots)
    }

    OrganisationalUnit getByKey(String key) {
        return organisationalUnitRepository.findByKey(key)
                .orElseThrow(() -> new ResourceNotFoundException("Organisational unit not found"))
    }

    @Transactional
    OrganisationalUnitResponse getByKeyAsResponse(String key) {
        def unit = getByKey(key)
        def m = this.organisationalUnitMapper
        def pr = this.processRepository
        def executingProcesses = pr.findByExecutingUnitsId(unit.id)
        return m.toResponse(unit, executingProcesses)
    }

    @Transactional
    OrganisationalUnit create(CreateOrganisationalUnitRequest request, User currentUser) {
        validateTranslations(request.names)

        OrganisationalUnit unit = new OrganisationalUnit()
        unit.createdBy = currentUser
        unit.unitType = request.unitType

        unit.names = request.names.collect { input ->
            new LocalizedText(input.locale, input.text)
        }
        if (request.descriptions != null) {
            unit.descriptions = request.descriptions.collect { input ->
                new LocalizedText(input.locale, input.text)
            }
        }

        // Set lead (default to current user if not specified)
        if (request.leadUsername != null) {
            unit.lead = userRepository.findByUsername(request.leadUsername)
                    .orElseThrow(() -> new ResourceNotFoundException("Lead user not found"))
        } else {
            unit.lead = currentUser
        }

        // Compute key
        def ls = this.localeService
        def defaultLocale = ls.getDefaultLocale()
        String defaultName = unit.names.find { it.locale == defaultLocale.localeCode }?.text
        unit.key = SlugUtil.slugify(defaultName)

        // Resolve parents
        if (request.parentKeys != null) {
            def repo = this.organisationalUnitRepository
            for (String parentKey : request.parentKeys) {
                OrganisationalUnit parent = repo.findByKey(parentKey)
                        .orElseThrow(() -> new ResourceNotFoundException("Parent unit not found: ${parentKey}"))
                unit.parents.add(parent)
            }
        }

        unit = organisationalUnitRepository.save(unit)
        return unit
    }

    @Transactional
    OrganisationalUnitResponse updateNames(String key, List<org.leargon.backend.model.LocalizedText> names) {
        OrganisationalUnit unit = getByKey(key)

        validateTranslations(names)

        unit.names = names.collect { input ->
            new LocalizedText(input.locale, input.text)
        }

        // Recompute key
        def ls = this.localeService
        def defaultLocale = ls.getDefaultLocale()
        String defaultName = unit.names.find { it.locale == defaultLocale.localeCode }?.text
        unit.key = SlugUtil.slugify(defaultName)

        unit = organisationalUnitRepository.update(unit)
        return organisationalUnitMapper.toResponse(getByKey(unit.key))
    }

    @Transactional
    OrganisationalUnitResponse updateDescriptions(String key, List<org.leargon.backend.model.LocalizedText> descriptions) {
        OrganisationalUnit unit = getByKey(key)

        validateTranslations(descriptions, false)

        unit.descriptions = descriptions.collect { input ->
            new LocalizedText(input.locale, input.text)
        }

        unit = organisationalUnitRepository.update(unit)
        return organisationalUnitMapper.toResponse(getByKey(unit.key))
    }

    @Transactional
    OrganisationalUnitResponse updateLead(String key, String leadUsername) {
        OrganisationalUnit unit = getByKey(key)

        if (leadUsername != null) {
            unit.lead = userRepository.findByUsername(leadUsername)
                    .orElseThrow(() -> new ResourceNotFoundException("Lead user not found"))
        } else {
            throw new IllegalArgumentException("Lead is required and cannot be removed")
        }

        unit = organisationalUnitRepository.update(unit)
        return organisationalUnitMapper.toResponse(getByKey(unit.key))
    }

    @Transactional
    OrganisationalUnitResponse updateType(String key, String unitType) {
        OrganisationalUnit unit = getByKey(key)
        unit.unitType = unitType
        unit = organisationalUnitRepository.update(unit)
        return organisationalUnitMapper.toResponse(getByKey(unit.key))
    }

    @Transactional
    OrganisationalUnitResponse updateParents(String key, List<String> parentKeys) {
        OrganisationalUnit unit = getByKey(key)

        unit.parents.clear()

        if (parentKeys != null) {
            def repo = this.organisationalUnitRepository
            for (String parentKey : parentKeys) {
                if (parentKey == key) {
                    throw new IllegalArgumentException("An organisational unit cannot be its own parent")
                }
                OrganisationalUnit parent = repo.findByKey(parentKey)
                        .orElseThrow(() -> new ResourceNotFoundException("Parent unit not found: ${parentKey}"))
                unit.parents.add(parent)
            }
        }

        unit = organisationalUnitRepository.update(unit)
        return organisationalUnitMapper.toResponse(getByKey(unit.key))
    }

    @Transactional
    void delete(String key) {
        OrganisationalUnit unit = getByKey(key)
        organisationalUnitRepository.delete(unit)
    }

    private void validateTranslations(List<org.leargon.backend.model.LocalizedText> translations, boolean requireDefault = true) {
        if (translations == null || translations.isEmpty()) {
            if (requireDefault) {
                throw new IllegalArgumentException("At least one translation is required")
            }
            return
        }

        def ls = this.localeService
        def defaultLocale = ls.getDefaultLocale()
        if (defaultLocale == null) {
            throw new IllegalStateException("No default locale configured")
        }

        translations.each { translation ->
            if (!ls.isLocaleActive(translation.locale)) {
                throw new IllegalArgumentException("Unsupported locale: ${translation.locale}")
            }
            if (translation.text == null || translation.text.trim().isEmpty()) {
                throw new IllegalArgumentException("Text is required for locale: ${translation.locale}")
            }
        }

        if (requireDefault) {
            def defaultTranslation = translations.find { it.locale == defaultLocale.localeCode }
            if (defaultTranslation == null) {
                throw new IllegalArgumentException(
                        "Translation for default locale '${defaultLocale.localeCode}' (${defaultLocale.displayName}) is required")
            }
        }
    }
}
