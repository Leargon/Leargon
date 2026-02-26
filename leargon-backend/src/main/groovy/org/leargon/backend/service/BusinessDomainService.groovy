package org.leargon.backend.service

import groovy.json.JsonOutput
import groovy.json.JsonSlurper
import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.BusinessDomain
import org.leargon.backend.domain.BusinessDomainVersion
import org.leargon.backend.domain.LocalizedText
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.mapper.BusinessDomainMapper
import org.leargon.backend.model.*
import org.leargon.backend.repository.BusinessDomainRepository
import org.leargon.backend.repository.BusinessDomainVersionRepository
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.util.SlugUtil

@Singleton
class BusinessDomainService {

    private final BusinessDomainRepository businessDomainRepository
    private final BusinessDomainVersionRepository businessDomainVersionRepository
    private final BusinessEntityRepository businessEntityRepository
    private final LocaleService localeService
    private final BusinessDomainMapper businessDomainMapper
    private final JsonSlurper jsonSlurper = new JsonSlurper()

    BusinessDomainService(
            BusinessDomainRepository businessDomainRepository,
            BusinessDomainVersionRepository businessDomainVersionRepository,
            BusinessEntityRepository businessEntityRepository,
            LocaleService localeService,
            BusinessDomainMapper businessDomainMapper
    ) {
        this.businessDomainRepository = businessDomainRepository
        this.businessDomainVersionRepository = businessDomainVersionRepository
        this.businessEntityRepository = businessEntityRepository
        this.localeService = localeService
        this.businessDomainMapper = businessDomainMapper
    }

    List<BusinessDomain> getAllBusinessDomains() {
        return businessDomainRepository.findAll()
    }

    @Transactional
    List<BusinessDomainResponse> getAllBusinessDomainsAsResponses() {
        def m = this.businessDomainMapper
        return getAllBusinessDomains().collect { m.toBusinessDomainResponse(it) }
    }

    List<BusinessDomain> getBusinessDomainTree() {
        return businessDomainRepository.findByParentIsNull()
    }

    @Transactional
    List<BusinessDomainTreeResponse> getBusinessDomainTreeAsResponses() {
        def m = this.businessDomainMapper
        return getBusinessDomainTree().collect { m.toBusinessDomainTreeResponse(it) }
    }

    BusinessDomain getBusinessDomainByKey(String key) {
        return businessDomainRepository.findByKey(key)
                .orElseThrow(() -> new ResourceNotFoundException("BusinessDomain not found"))
    }

    @Transactional
    BusinessDomainResponse getBusinessDomainByKeyAsResponse(String key) {
        return businessDomainMapper.toBusinessDomainResponse(getBusinessDomainByKey(key))
    }

    @Transactional
    LocalizedBusinessDomainResponse getLocalizedDomain(String key, String locale, User currentUser) {
        BusinessDomain domain = getBusinessDomainByKey(key)

        String resolvedLocale = resolveLocale(locale, currentUser)

        return businessDomainMapper.toLocalizedBusinessDomainResponse(domain, resolvedLocale)
    }

    private String resolveLocale(String locale, User currentUser) {
        if (locale != null && !locale.isEmpty()) {
            return locale
        }
        if (currentUser.preferredLanguage != null && !currentUser.preferredLanguage.isEmpty()) {
            return currentUser.preferredLanguage
        }
        def ls = this.localeService
        return ls.getDefaultLocale().localeCode
    }

    @Transactional
    BusinessDomain createBusinessDomain(CreateBusinessDomainRequest request, User currentUser) {
        validateTranslations(request.names)

        BusinessDomain domain = new BusinessDomain()
        domain.createdBy = currentUser
        domain.type = request.type?.value

        if (request.parentKey != null) {
            domain.parent = businessDomainRepository.findByKey(request.parentKey)
                    .orElseThrow(() -> new ResourceNotFoundException("Parent BusinessDomain not found"))
        }

        domain.names = request.names.collect { input ->
            new LocalizedText(input.locale, input.text)
        }
        if (request.descriptions != null) {
            domain.descriptions = request.descriptions.collect { input ->
                new LocalizedText(input.locale, input.text)
            }
        }

        def ls = this.localeService
        def defaultLocale = ls.getDefaultLocale()
        String defaultName = domain.names.find { it.locale == defaultLocale.localeCode }?.text
        String slug = SlugUtil.slugify(defaultName)
        domain.key = SlugUtil.buildKey(domain.parent?.key, slug)

        domain = businessDomainRepository.save(domain)
        createBusinessDomainVersion(domain, currentUser, "CREATE", "Initial creation")
        return domain
    }

    @Transactional
    BusinessDomain updateBusinessDomainParent(String domainKey, String parentKey, User currentUser) {
        BusinessDomain domain = getBusinessDomainByKey(domainKey)

        if (parentKey != null) {
            if (parentKey == domainKey) {
                throw new IllegalArgumentException("A businessDomain cannot be its own parent")
            }
            BusinessDomain newParent = businessDomainRepository.findByKey(parentKey)
                    .orElseThrow(() -> new ResourceNotFoundException("Parent businessDomain not found"))
            if (wouldCreateCycle(domain.id, newParent.id)) {
                throw new IllegalArgumentException("Cannot set parent: would create a cycle in the hierarchy")
            }
            domain.parent = newParent
        } else {
            domain.parent = null
        }

        recomputeKeysForSubtree(domain)
        domain = businessDomainRepository.update(domain)
        createBusinessDomainVersion(domain, currentUser, "PARENT_CHANGE",
                "Changed parent to ${parentKey ?: 'none'}")
        return domain
    }

    @Transactional
    BusinessDomain updateBusinessDomainType(String domainKey, String type, User currentUser) {
        BusinessDomain domain = getBusinessDomainByKey(domainKey)
        domain.type = type
        domain = businessDomainRepository.update(domain)
        createBusinessDomainVersion(domain, currentUser, "TYPE_CHANGE",
                "Changed type to ${type ?: 'none'}")
        return domain
    }

    @Transactional
    BusinessDomain updateBusinessDomainNames(String domainKey, List<org.leargon.backend.model.LocalizedText> names, User currentUser) {
        BusinessDomain domain = getBusinessDomainByKey(domainKey)

        validateTranslations(names)

        domain.names = names.collect { input ->
            new LocalizedText(input.locale, input.text)
        }
        def ls = this.localeService
        def defaultLocale = ls.getDefaultLocale()
        def defaultTranslation = domain.names.find { it.locale == defaultLocale.localeCode }
        if (defaultTranslation.text == null || defaultTranslation.text.trim().isEmpty()) {
            throw new IllegalArgumentException(
                    "Name for default locale '${defaultLocale.localeCode}' (${defaultLocale.displayName}) is required")
        }

        recomputeKeysForSubtree(domain)
        domain = businessDomainRepository.update(domain)
        createBusinessDomainVersion(domain, currentUser, "UPDATE", "Updated names")
        return domain
    }

    @Transactional
    BusinessDomain updateBusinessDomainDescriptions(String domainKey, List<org.leargon.backend.model.LocalizedText> descriptions, User currentUser) {
        BusinessDomain domain = getBusinessDomainByKey(domainKey)

        validateTranslations(descriptions, false)

        domain.descriptions = descriptions.collect { input ->
            new LocalizedText(input.locale, input.text)
        }

        domain = businessDomainRepository.update(domain)
        createBusinessDomainVersion(domain, currentUser, "UPDATE", "Updated descriptions")
        return domain
    }

    @Transactional
    void deleteBusinessDomain(String domainKey) {
        BusinessDomain domain = getBusinessDomainByKey(domainKey)

        // Detach children — set parent=null and recompute keys
        // Use toList() to avoid ConcurrentModificationException, and call recompute
        // outside closures to avoid Micronaut AOP proxy issues with private methods
        def domainRepo = this.businessDomainRepository
        List<BusinessDomain> children = domain.children ? new ArrayList<>(domain.children) : []
        for (BusinessDomain child : children) {
            child.parent = null
            recomputeKeysForSubtree(child)
            domainRepo.update(child)
        }
        domain.children.clear()

        // Unassign entities
        def entityRepo = this.businessEntityRepository
        List assignedEntities = domain.assignedEntities ? new ArrayList<>(domain.assignedEntities) : []
        for (def entity : assignedEntities) {
            entity.businessDomain = null
            entityRepo.update(entity)
        }
        domain.assignedEntities.clear()

        businessDomainRepository.delete(domain)
    }

    // --- Version history ---

    List<BusinessDomainVersionResponse> getVersionHistory(String domainKey) {
        def domain = getBusinessDomainByKey(domainKey)
        def m = this.businessDomainMapper
        return businessDomainVersionRepository.findByBusinessDomainIdOrderByVersionNumberDesc(domain.id)
                .collect { m.toBusinessDomainVersionResponse(it) }
    }

    VersionDiffResponse getVersionDiff(String domainKey, Integer versionNumber) {
        def domain = getBusinessDomainByKey(domainKey)

        BusinessDomainVersion currentVersion = businessDomainVersionRepository
                .findByBusinessDomainIdAndVersionNumber(domain.id, versionNumber)
                .orElseThrow(() -> new ResourceNotFoundException("Version not found"))

        BusinessDomainVersion previousVersion = null
        if (versionNumber > 1) {
            previousVersion = businessDomainVersionRepository
                    .findByBusinessDomainIdAndVersionNumber(domain.id, versionNumber - 1)
                    .orElse(null)
        }

        Map<String, Object> currentSnapshot = parseSnapshot(currentVersion.snapshotJson)
        Map<String, Object> previousSnapshot = previousVersion != null
                ? parseSnapshot(previousVersion.snapshotJson)
                : [:]

        List<FieldChange> changes = calculateDiff(previousSnapshot, currentSnapshot)

        return new VersionDiffResponse(
                versionNumber,
                previousVersion?.versionNumber,
                changes
        )
    }

    // --- Private helpers ---

    private void createBusinessDomainVersion(BusinessDomain domain, User changedBy, String changeType, String changeSummary) {
        Integer nextVersion = businessDomainVersionRepository
                .findFirstByBusinessDomainIdOrderByVersionNumberDesc(domain.id)
                .map { it.versionNumber + 1 }
                .orElse(1)

        Map<String, Object> snapshot = [
                key         : domain.key,
                names       : domain.names.collect { [locale: it.locale, text: it.text] },
                descriptions: domain.descriptions.collect { [locale: it.locale, text: it.text] },
                type        : domain.type,
                parentKey   : domain.parent?.key
        ]

        BusinessDomainVersion version = new BusinessDomainVersion()
        version.businessDomain = domain
        version.versionNumber = nextVersion
        version.changedBy = changedBy
        version.changeType = changeType
        version.snapshotJson = JsonOutput.toJson(snapshot)
        version.changeSummary = changeSummary

        businessDomainVersionRepository.save(version)
    }

    private void recomputeKeysForSubtree(BusinessDomain domain) {
        def ls = this.localeService
        def defaultLocale = ls.getDefaultLocale()
        String defaultName = domain.getName(defaultLocale.localeCode)
        String slug = SlugUtil.slugify(defaultName)
        domain.key = SlugUtil.buildKey(domain.parent?.key, slug)
        domain.children?.each { child ->
            recomputeKeysForSubtree(child)
            businessDomainRepository.update(child)
        }
    }

    private boolean wouldCreateCycle(Long domainId, Long newParentId) {
        Long currentId = newParentId
        while (currentId != null) {
            if (currentId == domainId) {
                return true
            }
            def parent = businessDomainRepository.findById(currentId)
                    .map { it.parent }
                    .orElse(null)
            currentId = parent?.id
        }
        return false
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

    private static List<FieldChange> calculateDiff(Map<String, Object> previous, Map<String, Object> current) {
        List<FieldChange> changes = []
        if (previous == null) previous = [:]
        if (current == null) current = [:]

        // Compare type
        def prevType = previous?.get('type')
        def currType = current?.get('type')
        if (prevType != currType) {
            changes << new FieldChange("type", prevType?.toString(), currType?.toString())
        }

        // Compare parentKey
        def prevParent = previous?.get('parentKey')
        def currParent = current?.get('parentKey')
        if (prevParent != currParent) {
            changes << new FieldChange("parentKey", prevParent?.toString(), currParent?.toString())
        }

        // Compare names
        List<Map> prevNames = (previous?.get('names') ?: []) as List<Map>
        List<Map> currNames = (current?.get('names') ?: []) as List<Map>
        Set<String> allNameLocales = (prevNames*.locale + currNames*.locale).toSet() as Set<String>
        allNameLocales.each { locale ->
            Map prev = prevNames.find { it.locale == locale }
            Map curr = currNames.find { it.locale == locale }
            if (prev == null && curr != null) {
                changes << new FieldChange("name.${locale}", null, curr.text?.toString())
            } else if (prev != null && curr == null) {
                changes << new FieldChange("name.${locale}", prev.text?.toString(), null)
            } else if (prev != null && curr != null && prev.text != curr.text) {
                changes << new FieldChange("name.${locale}", prev.text?.toString(), curr.text?.toString())
            }
        }

        // Compare descriptions
        List<Map> prevDescs = (previous?.get('descriptions') ?: []) as List<Map>
        List<Map> currDescs = (current?.get('descriptions') ?: []) as List<Map>
        Set<String> allDescLocales = (prevDescs*.locale + currDescs*.locale).toSet() as Set<String>
        allDescLocales.each { locale ->
            Map prev = prevDescs.find { it.locale == locale }
            Map curr = currDescs.find { it.locale == locale }
            if (prev == null && curr != null) {
                changes << new FieldChange("description.${locale}", null, curr.text?.toString())
            } else if (prev != null && curr == null) {
                changes << new FieldChange("description.${locale}", prev.text?.toString(), null)
            } else if (prev != null && curr != null && prev.text != curr.text) {
                changes << new FieldChange("description.${locale}", prev.text?.toString(), curr.text?.toString())
            }
        }

        return changes
    }

    private Map<String, Object> parseSnapshot(String json) {
        def parsed = jsonSlurper.parseText(json)
        if (parsed instanceof String) {
            parsed = jsonSlurper.parseText(parsed)
        }
        return parsed as Map<String, Object>
    }
}
