package org.leargon.backend.service

import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.BusinessDomain
import org.leargon.backend.domain.BusinessDomainVersion
import org.leargon.backend.domain.LocalizedText
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.mapper.BusinessDomainMapper
import org.leargon.backend.model.BusinessDomainResponse
import org.leargon.backend.model.BusinessDomainTreeResponse
import org.leargon.backend.model.BusinessDomainVersionResponse
import org.leargon.backend.model.CreateBusinessDomainRequest
import org.leargon.backend.model.FieldChange
import org.leargon.backend.model.LocalizedBusinessDomainResponse
import org.leargon.backend.model.VersionDiffResponse
import org.leargon.backend.repository.BoundedContextRepository
import org.leargon.backend.repository.BusinessDomainRepository
import org.leargon.backend.repository.BusinessDomainVersionRepository
import org.leargon.backend.repository.DomainEventRepository
import org.leargon.backend.util.SlugUtil

@Singleton
open class BusinessDomainService(
    private val businessDomainRepository: BusinessDomainRepository,
    private val businessDomainVersionRepository: BusinessDomainVersionRepository,
    private val boundedContextRepository: BoundedContextRepository,
    private val domainEventRepository: DomainEventRepository,
    private val localeService: LocaleService,
    private val businessDomainMapper: BusinessDomainMapper
) {
    private val objectMapper = ObjectMapper()

    open fun getAllBusinessDomains(): List<BusinessDomain> =
        businessDomainRepository.findAll()

    @Transactional
    open fun getAllBusinessDomainsAsResponses(): List<BusinessDomainResponse> =
        getAllBusinessDomains().map { businessDomainMapper.toBusinessDomainResponse(it) }

    open fun getBusinessDomainTree(): List<BusinessDomain> =
        businessDomainRepository.findByParentIsNull()

    @Transactional
    open fun getBusinessDomainTreeAsResponses(): List<BusinessDomainTreeResponse> =
        getBusinessDomainTree().map { businessDomainMapper.toBusinessDomainTreeResponse(it) }

    open fun getBusinessDomainByKey(key: String): BusinessDomain =
        businessDomainRepository.findByKey(key)
            .orElseThrow { ResourceNotFoundException("BusinessDomain not found") }

    @Transactional
    open fun getBusinessDomainByKeyAsResponse(key: String): BusinessDomainResponse =
        businessDomainMapper.toBusinessDomainResponse(getBusinessDomainByKey(key))

    @Transactional
    open fun getLocalizedDomain(key: String, locale: String?, currentUser: User): LocalizedBusinessDomainResponse {
        val domain = getBusinessDomainByKey(key)
        val resolvedLocale = resolveLocale(locale, currentUser)
        return businessDomainMapper.toLocalizedBusinessDomainResponse(domain, resolvedLocale)
    }

    private fun resolveLocale(locale: String?, currentUser: User): String {
        if (!locale.isNullOrEmpty()) return locale
        if (!currentUser.preferredLanguage.isNullOrEmpty()) return currentUser.preferredLanguage!!
        return localeService.getDefaultLocale()!!.localeCode
    }

    @Transactional
    open fun createBusinessDomain(request: CreateBusinessDomainRequest, currentUser: User): BusinessDomain {
        validateTranslations(request.names)

        var domain = BusinessDomain()
        domain.createdBy = currentUser
        domain.type = request.type?.value

        if (request.parentKey != null) {
            domain.parent = businessDomainRepository.findByKey(request.parentKey)
                .orElseThrow { ResourceNotFoundException("Parent BusinessDomain not found") }
        }

        domain.names = request.names.map { input -> LocalizedText(input.locale, input.text) }.toMutableList()
        if (request.descriptions != null) {
            domain.descriptions = request.descriptions!!.map { input -> LocalizedText(input.locale, input.text) }.toMutableList()
        }

        val defaultLocale = localeService.getDefaultLocale()
        val defaultName = domain.names.find { it.locale == defaultLocale?.localeCode }?.text
        val slug = SlugUtil.slugify(defaultName)
        domain.key = SlugUtil.buildKey(domain.parent?.key, slug)

        domain = businessDomainRepository.save(domain)
        createBusinessDomainVersion(domain, currentUser, "CREATE", "Initial creation")
        return domain
    }

    @Transactional
    open fun updateBusinessDomainParent(domainKey: String, parentKey: String?, currentUser: User): BusinessDomain {
        var domain = getBusinessDomainByKey(domainKey)

        if (parentKey != null) {
            if (parentKey == domainKey) {
                throw IllegalArgumentException("A businessDomain cannot be its own parent")
            }
            val newParent = businessDomainRepository.findByKey(parentKey)
                .orElseThrow { ResourceNotFoundException("Parent businessDomain not found") }
            if (wouldCreateCycle(domain.id!!, newParent.id!!)) {
                throw IllegalArgumentException("Cannot set parent: would create a cycle in the hierarchy")
            }
            domain.parent = newParent
        } else {
            domain.parent = null
        }

        recomputeKeysForSubtree(domain)
        domain = businessDomainRepository.update(domain)
        createBusinessDomainVersion(domain, currentUser, "PARENT_CHANGE",
            "Changed parent to ${parentKey ?: "none"}")
        return domain
    }

    @Transactional
    open fun updateBusinessDomainVisionStatement(domainKey: String, visionStatement: String?, currentUser: User): BusinessDomain {
        var domain = getBusinessDomainByKey(domainKey)
        domain.visionStatement = visionStatement
        domain = businessDomainRepository.update(domain)
        createBusinessDomainVersion(domain, currentUser, "UPDATE",
            "Updated vision statement")
        return domain
    }

    @Transactional
    open fun updateBusinessDomainType(domainKey: String, type: String?, currentUser: User): BusinessDomain {
        var domain = getBusinessDomainByKey(domainKey)
        domain.type = type
        domain = businessDomainRepository.update(domain)
        createBusinessDomainVersion(domain, currentUser, "TYPE_CHANGE",
            "Changed type to ${type ?: "none"}")
        return domain
    }

    @Transactional
    open fun updateBusinessDomainNames(domainKey: String, names: List<org.leargon.backend.model.LocalizedText>, currentUser: User): BusinessDomain {
        var domain = getBusinessDomainByKey(domainKey)

        validateTranslations(names)

        domain.names = names.map { input -> LocalizedText(input.locale, input.text) }.toMutableList()
        val defaultLocale = localeService.getDefaultLocale()
        val defaultTranslation = domain.names.find { it.locale == defaultLocale?.localeCode }
        if (defaultTranslation?.text.isNullOrBlank()) {
            throw IllegalArgumentException(
                "Name for default locale '${defaultLocale?.localeCode}' (${defaultLocale?.displayName}) is required")
        }

        recomputeKeysForSubtree(domain)
        domain = businessDomainRepository.update(domain)
        createBusinessDomainVersion(domain, currentUser, "UPDATE", "Updated names")
        return domain
    }

    @Transactional
    open fun updateBusinessDomainDescriptions(domainKey: String, descriptions: List<org.leargon.backend.model.LocalizedText>, currentUser: User): BusinessDomain {
        var domain = getBusinessDomainByKey(domainKey)

        validateTranslations(descriptions, false)

        domain.descriptions = descriptions.map { input -> LocalizedText(input.locale, input.text) }.toMutableList()
        domain = businessDomainRepository.update(domain)
        createBusinessDomainVersion(domain, currentUser, "UPDATE", "Updated descriptions")
        return domain
    }

    @Transactional
    open fun deleteBusinessDomain(domainKey: String) {
        val domain = getBusinessDomainByKey(domainKey)

        val children = domain.children.toList()
        for (child in children) {
            child.parent = null
            recomputeKeysForSubtree(child)
            businessDomainRepository.update(child)
        }
        domain.children.clear()

        val boundedContexts = boundedContextRepository.findByDomainKey(domainKey)
        boundedContexts.forEach { bc ->
            domainEventRepository.deleteByPublishingBoundedContextId(bc.id!!)
            boundedContextRepository.delete(bc)
        }

        businessDomainRepository.delete(domain)
    }

    // --- Version history ---

    open fun getVersionHistory(domainKey: String): List<BusinessDomainVersionResponse> {
        val domain = getBusinessDomainByKey(domainKey)
        return businessDomainVersionRepository.findByBusinessDomainIdOrderByVersionNumberDesc(domain.id!!)
            .map { businessDomainMapper.toBusinessDomainVersionResponse(it) }
    }

    open fun getVersionDiff(domainKey: String, versionNumber: Int): VersionDiffResponse {
        val domain = getBusinessDomainByKey(domainKey)

        val currentVersion = businessDomainVersionRepository
            .findByBusinessDomainIdAndVersionNumber(domain.id!!, versionNumber)
            .orElseThrow { ResourceNotFoundException("Version not found") }

        val previousVersion = if (versionNumber > 1) {
            businessDomainVersionRepository
                .findByBusinessDomainIdAndVersionNumber(domain.id!!, versionNumber - 1)
                .orElse(null)
        } else null

        val currentSnapshot = parseSnapshot(currentVersion.snapshotJson)
        val previousSnapshot = if (previousVersion != null) parseSnapshot(previousVersion.snapshotJson) else emptyMap()

        val changes = calculateDiff(previousSnapshot, currentSnapshot)

        return VersionDiffResponse(versionNumber, previousVersion?.versionNumber, changes)
    }

    // --- Private helpers ---

    private fun createBusinessDomainVersion(domain: BusinessDomain, changedBy: User, changeType: String, changeSummary: String) {
        val nextVersion = businessDomainVersionRepository
            .findFirstByBusinessDomainIdOrderByVersionNumberDesc(domain.id!!)
            .map { it.versionNumber + 1 }
            .orElse(1)

        val snapshot = mapOf(
            "key" to domain.key,
            "names" to domain.names.map { mapOf("locale" to it.locale, "text" to it.text) },
            "descriptions" to domain.descriptions.map { mapOf("locale" to it.locale, "text" to it.text) },
            "type" to domain.type,
            "parentKey" to domain.parent?.key
        )

        val version = BusinessDomainVersion()
        version.businessDomain = domain
        version.versionNumber = nextVersion
        version.changedBy = changedBy
        version.changeType = changeType
        version.snapshotJson = objectMapper.writeValueAsString(snapshot)
        version.changeSummary = changeSummary

        businessDomainVersionRepository.save(version)
    }

    private fun recomputeKeysForSubtree(domain: BusinessDomain) {
        val defaultLocale = localeService.getDefaultLocale()
        val defaultName = domain.getName(defaultLocale?.localeCode ?: "en")
        val slug = SlugUtil.slugify(defaultName)
        domain.key = SlugUtil.buildKey(domain.parent?.key, slug)
        domain.children.forEach { child ->
            recomputeKeysForSubtree(child)
            businessDomainRepository.update(child)
        }
    }

    private fun wouldCreateCycle(domainId: Long, newParentId: Long): Boolean {
        var currentId: Long? = newParentId
        while (currentId != null) {
            if (currentId == domainId) return true
            currentId = businessDomainRepository.findById(currentId)
                .map { it.parent }
                .orElse(null)?.id
        }
        return false
    }

    private fun validateTranslations(translations: List<org.leargon.backend.model.LocalizedText>?, requireDefault: Boolean = true) {
        if (translations.isNullOrEmpty()) {
            if (requireDefault) throw IllegalArgumentException("At least one translation is required")
            return
        }

        val defaultLocale = localeService.getDefaultLocale()
            ?: throw IllegalStateException("No default locale configured")

        translations.forEach { translation ->
            if (!localeService.isLocaleActive(translation.locale)) {
                throw IllegalArgumentException("Unsupported locale: ${translation.locale}")
            }
            if (translation.text.isNullOrBlank()) {
                throw IllegalArgumentException("Text is required for locale: ${translation.locale}")
            }
        }

        if (requireDefault) {
            val defaultTranslation = translations.find { it.locale == defaultLocale.localeCode }
            if (defaultTranslation == null) {
                throw IllegalArgumentException(
                    "Translation for default locale '${defaultLocale.localeCode}' (${defaultLocale.displayName}) is required")
            }
        }
    }

    @Suppress("UNCHECKED_CAST")
    private fun parseSnapshot(json: String): Map<String, Any?> {
        var parsed = objectMapper.readValue(json, Any::class.java)
        if (parsed is String) {
            parsed = objectMapper.readValue(parsed, Any::class.java)
        }
        return parsed as Map<String, Any?>
    }

    companion object {
        @JvmStatic
        @Suppress("UNCHECKED_CAST")
        fun calculateDiff(previous: Map<String, Any?>, current: Map<String, Any?>): List<FieldChange> {
            val changes = mutableListOf<FieldChange>()

            val prevType = previous["type"]
            val currType = current["type"]
            if (prevType != currType) {
                changes.add(FieldChange("type", prevType?.toString(), currType?.toString()))
            }

            val prevParent = previous["parentKey"]
            val currParent = current["parentKey"]
            if (prevParent != currParent) {
                changes.add(FieldChange("parentKey", prevParent?.toString(), currParent?.toString()))
            }

            val prevNames = (previous["names"] as? List<Map<*, *>>) ?: emptyList()
            val currNames = (current["names"] as? List<Map<*, *>>) ?: emptyList()
            val allNameLocales = (prevNames.map { it["locale"]?.toString() } + currNames.map { it["locale"]?.toString() }).filterNotNull().toSet()
            allNameLocales.forEach { locale ->
                val prev = prevNames.find { it["locale"] == locale }
                val curr = currNames.find { it["locale"] == locale }
                if (prev == null && curr != null) {
                    changes.add(FieldChange("name.$locale", null, curr["text"]?.toString()))
                } else if (prev != null && curr == null) {
                    changes.add(FieldChange("name.$locale", prev["text"]?.toString(), null))
                } else if (prev != null && curr != null && prev["text"] != curr["text"]) {
                    changes.add(FieldChange("name.$locale", prev["text"]?.toString(), curr["text"]?.toString()))
                }
            }

            val prevDescs = (previous["descriptions"] as? List<Map<*, *>>) ?: emptyList()
            val currDescs = (current["descriptions"] as? List<Map<*, *>>) ?: emptyList()
            val allDescLocales = (prevDescs.map { it["locale"]?.toString() } + currDescs.map { it["locale"]?.toString() }).filterNotNull().toSet()
            allDescLocales.forEach { locale ->
                val prev = prevDescs.find { it["locale"] == locale }
                val curr = currDescs.find { it["locale"] == locale }
                if (prev == null && curr != null) {
                    changes.add(FieldChange("description.$locale", null, curr["text"]?.toString()))
                } else if (prev != null && curr == null) {
                    changes.add(FieldChange("description.$locale", prev["text"]?.toString(), null))
                } else if (prev != null && curr != null && prev["text"] != curr["text"]) {
                    changes.add(FieldChange("description.$locale", prev["text"]?.toString(), curr["text"]?.toString()))
                }
            }

            return changes
        }
    }
}
