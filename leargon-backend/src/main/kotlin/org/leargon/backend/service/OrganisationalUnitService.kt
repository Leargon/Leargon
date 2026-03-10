package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.LocalizedText
import org.leargon.backend.domain.OrganisationalUnit
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.mapper.OrganisationalUnitMapper
import org.leargon.backend.model.CreateOrganisationalUnitRequest
import org.leargon.backend.model.OrganisationalUnitResponse
import org.leargon.backend.model.OrganisationalUnitTreeResponse
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.repository.UserRepository
import org.leargon.backend.util.SlugUtil

@Singleton
open class OrganisationalUnitService(
    private val organisationalUnitRepository: OrganisationalUnitRepository,
    private val processRepository: ProcessRepository,
    private val userRepository: UserRepository,
    private val localeService: LocaleService,
    private val organisationalUnitMapper: OrganisationalUnitMapper
) {

    @Transactional
    open fun getAllAsResponses(): List<OrganisationalUnitResponse> =
        organisationalUnitRepository.findAll().map { organisationalUnitMapper.toResponse(it) }

    @Transactional
    open fun getTreeAsResponses(): List<OrganisationalUnitTreeResponse> {
        val roots = organisationalUnitRepository.findRoots()
        return organisationalUnitMapper.toTreeResponses(roots)
    }

    open fun getByKey(key: String): OrganisationalUnit =
        organisationalUnitRepository.findByKey(key)
            .orElseThrow { ResourceNotFoundException("Organisational unit not found") }

    @Transactional
    open fun getByKeyAsResponse(key: String): OrganisationalUnitResponse {
        val unit = getByKey(key)
        val executingProcesses = processRepository.findByExecutingUnitsId(unit.id!!)
        return organisationalUnitMapper.toResponse(unit, executingProcesses)
    }

    @Transactional
    open fun create(request: CreateOrganisationalUnitRequest, currentUser: User): OrganisationalUnit {
        validateTranslations(request.names)

        var unit = OrganisationalUnit()
        unit.createdBy = currentUser
        unit.unitType = request.unitType

        unit.names = request.names.map { input -> LocalizedText(input.locale, input.text) }.toMutableList()
        if (request.descriptions != null) {
            unit.descriptions = request.descriptions!!.map { input -> LocalizedText(input.locale, input.text) }.toMutableList()
        }

        unit.lead = if (request.leadUsername != null) {
            userRepository.findByUsername(request.leadUsername)
                .orElseThrow { ResourceNotFoundException("Lead user not found") }
        } else {
            currentUser
        }

        val defaultLocale = localeService.getDefaultLocale()
        val defaultName = unit.names.find { it.locale == defaultLocale?.localeCode }?.text
        unit.key = SlugUtil.slugify(defaultName)

        if (request.parentKeys != null) {
            for (parentKey in request.parentKeys!!) {
                val parent = organisationalUnitRepository.findByKey(parentKey)
                    .orElseThrow { ResourceNotFoundException("Parent unit not found: $parentKey") }
                unit.parents.add(parent)
            }
        }

        unit = organisationalUnitRepository.save(unit)
        return unit
    }

    @Transactional
    open fun updateNames(key: String, names: List<org.leargon.backend.model.LocalizedText>): OrganisationalUnitResponse {
        var unit = getByKey(key)

        validateTranslations(names)

        unit.names = names.map { input -> LocalizedText(input.locale, input.text) }.toMutableList()

        val defaultLocale = localeService.getDefaultLocale()
        val defaultName = unit.names.find { it.locale == defaultLocale?.localeCode }?.text
        unit.key = SlugUtil.slugify(defaultName)

        unit = organisationalUnitRepository.update(unit)
        return organisationalUnitMapper.toResponse(getByKey(unit.key))
    }

    @Transactional
    open fun updateDescriptions(key: String, descriptions: List<org.leargon.backend.model.LocalizedText>): OrganisationalUnitResponse {
        var unit = getByKey(key)

        validateTranslations(descriptions, false)

        unit.descriptions = descriptions.map { input -> LocalizedText(input.locale, input.text) }.toMutableList()
        unit = organisationalUnitRepository.update(unit)
        return organisationalUnitMapper.toResponse(getByKey(unit.key))
    }

    @Transactional
    open fun updateLead(key: String, leadUsername: String?): OrganisationalUnitResponse {
        var unit = getByKey(key)

        if (leadUsername != null) {
            unit.lead = userRepository.findByUsername(leadUsername)
                .orElseThrow { ResourceNotFoundException("Lead user not found") }
        } else {
            throw IllegalArgumentException("Lead is required and cannot be removed")
        }

        unit = organisationalUnitRepository.update(unit)
        return organisationalUnitMapper.toResponse(getByKey(unit.key))
    }

    @Transactional
    open fun updateType(key: String, unitType: String?): OrganisationalUnitResponse {
        var unit = getByKey(key)
        unit.unitType = unitType
        unit = organisationalUnitRepository.update(unit)
        return organisationalUnitMapper.toResponse(getByKey(unit.key))
    }

    @Transactional
    open fun updateParents(key: String, parentKeys: List<String>?): OrganisationalUnitResponse {
        var unit = getByKey(key)

        unit.parents.clear()

        if (parentKeys != null) {
            for (parentKey in parentKeys) {
                if (parentKey == key) {
                    throw IllegalArgumentException("An organisational unit cannot be its own parent")
                }
                val parent = organisationalUnitRepository.findByKey(parentKey)
                    .orElseThrow { ResourceNotFoundException("Parent unit not found: $parentKey") }
                unit.parents.add(parent)
            }
        }

        unit = organisationalUnitRepository.update(unit)
        return organisationalUnitMapper.toResponse(getByKey(unit.key))
    }

    @Transactional
    open fun delete(key: String) {
        val unit = getByKey(key)
        organisationalUnitRepository.delete(unit)
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
}
