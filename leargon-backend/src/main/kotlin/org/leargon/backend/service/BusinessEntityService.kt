package org.leargon.backend.service

import com.fasterxml.jackson.databind.ObjectMapper
import io.micronaut.retry.annotation.Retryable

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.BusinessEntity
import org.leargon.backend.domain.BusinessEntityRelationship
import org.leargon.backend.domain.BusinessEntityVersion
import org.leargon.backend.domain.LocalizedText
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ForbiddenOperationException
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.mapper.BusinessEntityMapper
import org.leargon.backend.model.BusinessEntityResponse
import org.leargon.backend.model.BusinessEntityTreeResponse
import org.leargon.backend.model.BusinessEntityVersionResponse
import org.leargon.backend.model.CreateBusinessEntityRelationshipRequest
import org.leargon.backend.model.CreateBusinessEntityRequest
import org.leargon.backend.model.FieldChange
import org.leargon.backend.model.LocalizedBusinessEntityResponse
import org.leargon.backend.model.UpdateBusinessEntityRelationshipRequest
import org.leargon.backend.model.VersionDiffResponse
import org.leargon.backend.repository.BusinessDomainRepository
import org.leargon.backend.repository.BusinessEntityRelationshipRepository
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.BusinessEntityVersionRepository
import org.leargon.backend.repository.UserRepository
import org.leargon.backend.util.SlugUtil

@Singleton
open class BusinessEntityService(
    private val businessEntityRepository: BusinessEntityRepository,
    private val businessEntityVersionRepository: BusinessEntityVersionRepository,
    private val businessEntityRelationshipRepository: BusinessEntityRelationshipRepository,
    private val userRepository: UserRepository,
    private val businessDomainRepository: BusinessDomainRepository,
    private val localeService: LocaleService,
    private val businessEntityMapper: BusinessEntityMapper
) {
    private val objectMapper = ObjectMapper()

    open fun getAllBusinessEntities(): List<BusinessEntity> =
        businessEntityRepository.findAll()

    @Transactional
    open fun getAllBusinessEntitiesAsResponses(): List<BusinessEntityResponse> =
        getAllBusinessEntities().map { businessEntityMapper.toBusinessEntityResponse(it) }

    open fun getBusinessEntityByKey(key: String): BusinessEntity =
        businessEntityRepository.findByKey(key)
            .orElseThrow { ResourceNotFoundException("BusinessEntity not found") }

    @Transactional
    open fun getBusinessEntityByKeyAsResponse(key: String): BusinessEntityResponse =
        businessEntityMapper.toBusinessEntityResponse(getBusinessEntityByKey(key))

    open fun getBusinessEntityTree(): List<BusinessEntity> =
        businessEntityRepository.findByParentIsNull()

    @Transactional
    open fun getBusinessEntityTreeAsResponses(): List<BusinessEntityTreeResponse> =
        getBusinessEntityTree().map { businessEntityMapper.toBusinessEntityTreeResponse(it) }

    @Transactional
    open fun createBusinessEntity(request: CreateBusinessEntityRequest, currentUser: User): BusinessEntity {
        validateTranslations(request.names)

        var entity = BusinessEntity()
        entity.createdBy = currentUser

        entity.dataOwner = if (request.dataOwnerUsername != null) {
            userRepository.findByUsername(request.dataOwnerUsername)
                .orElseThrow { ResourceNotFoundException("Data owner user not found") }
        } else {
            currentUser
        }

        if (request.parentKey != null) {
            entity.parent = businessEntityRepository.findByKey(request.parentKey)
                .orElseThrow { ResourceNotFoundException("Parent BusinessEntity not found") }
        }

        entity.names = request.names.map { input -> LocalizedText(input.locale, input.text) }.toMutableList()
        if (request.descriptions != null) {
            entity.descriptions = request.descriptions!!.map { input -> LocalizedText(input.locale, input.text) }.toMutableList()
        }
        entity.retentionPeriod = request.retentionPeriod

        val defaultLocale = localeService.getDefaultLocale()
        val defaultName = entity.names.find { it.locale == defaultLocale?.localeCode }?.text
        val slug = SlugUtil.slugify(defaultName)
        entity.key = SlugUtil.buildKey(entity.parent?.key, slug)

        entity = businessEntityRepository.save(entity)
        createBusinessEntityVersion(entity, currentUser, "CREATE", "Initial creation")
        return entity
    }

    @Transactional
    open fun createBusinessEntityAsResponse(request: CreateBusinessEntityRequest, currentUser: User): BusinessEntityResponse {
        val entity = createBusinessEntity(request, currentUser)
        return businessEntityMapper.toBusinessEntityResponse(getBusinessEntityByKey(entity.key))
    }

    @Transactional
    open fun updateBusinessEntityParent(entityKey: String, parentKey: String?, currentUser: User): BusinessEntity {
        var entity = getBusinessEntityByKey(entityKey)
        checkEditPermission(entity, currentUser)

        if (parentKey != null) {
            if (parentKey == entityKey) {
                throw IllegalArgumentException("A businessEntity cannot be its own parent")
            }
            val newParent = businessEntityRepository.findByKey(parentKey)
                .orElseThrow { ResourceNotFoundException("Parent businessEntity not found") }
            if (wouldCreateCycle(entity.id!!, newParent.id!!)) {
                throw IllegalArgumentException("Cannot set parent: would create a cycle in the hierarchy")
            }
            entity.parent = newParent
        } else {
            entity.parent = null
        }

        recomputeKeysForSubtree(entity)
        entity = businessEntityRepository.update(entity)
        createBusinessEntityVersion(entity, currentUser, "PARENT_CHANGE",
            "Changed parent to ${parentKey ?: "none"}")
        return entity
    }

    @Transactional
    open fun updateBusinessEntityParentAsResponse(entityKey: String, parentKey: String?, currentUser: User): BusinessEntityResponse {
        val entity = updateBusinessEntityParent(entityKey, parentKey, currentUser)
        return businessEntityMapper.toBusinessEntityResponse(getBusinessEntityByKey(entity.key))
    }

    @Transactional
    open fun updateBusinessEntityDataOwner(entityKey: String, dataOwnerUsername: String, currentUser: User): BusinessEntity {
        var entity = getBusinessEntityByKey(entityKey)
        checkEditPermission(entity, currentUser)

        val newOwner = userRepository.findByUsername(dataOwnerUsername)
            .orElseThrow { ResourceNotFoundException("Data owner user not found") }
        entity.dataOwner = newOwner

        entity = businessEntityRepository.update(entity)
        createBusinessEntityVersion(entity, currentUser, "OWNER_CHANGE",
            "Changed data owner to ${newOwner.username}")
        return entity
    }

    @Transactional
    open fun updateBusinessEntityDataOwnerAsResponse(entityKey: String, dataOwnerUsername: String, currentUser: User): BusinessEntityResponse {
        val entity = updateBusinessEntityDataOwner(entityKey, dataOwnerUsername, currentUser)
        return businessEntityMapper.toBusinessEntityResponse(getBusinessEntityByKey(entity.key))
    }

    @Transactional
    open fun updateBusinessEntityNames(entityKey: String, names: List<org.leargon.backend.model.LocalizedText>, currentUser: User): BusinessEntity {
        var entity = getBusinessEntityByKey(entityKey)
        checkEditPermission(entity, currentUser)

        validateTranslations(names)

        entity.names = names.map { input -> LocalizedText(input.locale, input.text) }.toMutableList()

        val defaultLocale = localeService.getDefaultLocale()
        val defaultTranslation = entity.names.find { it.locale == defaultLocale?.localeCode }
        if (defaultTranslation?.text.isNullOrBlank()) {
            throw IllegalArgumentException(
                "Name for default locale '${defaultLocale?.localeCode}' (${defaultLocale?.displayName}) is required")
        }

        recomputeKeysForSubtree(entity)
        entity = businessEntityRepository.update(entity)
        createBusinessEntityVersion(entity, currentUser, "UPDATE", "Updated names")
        return entity
    }

    @Transactional
    open fun updateBusinessEntityNamesAsResponse(entityKey: String, names: List<org.leargon.backend.model.LocalizedText>, currentUser: User): BusinessEntityResponse {
        val entity = updateBusinessEntityNames(entityKey, names, currentUser)
        return businessEntityMapper.toBusinessEntityResponse(getBusinessEntityByKey(entity.key))
    }

    @Transactional
    open fun updateBusinessEntityDescriptions(entityKey: String, descriptions: List<org.leargon.backend.model.LocalizedText>, currentUser: User): BusinessEntity {
        var entity = getBusinessEntityByKey(entityKey)
        checkEditPermission(entity, currentUser)

        validateTranslations(descriptions, false)

        entity.descriptions = descriptions.map { input -> LocalizedText(input.locale, input.text) }.toMutableList()
        entity = businessEntityRepository.update(entity)
        createBusinessEntityVersion(entity, currentUser, "UPDATE", "Updated descriptions")
        return entity
    }

    @Transactional
    open fun updateBusinessEntityDescriptionsAsResponse(entityKey: String, descriptions: List<org.leargon.backend.model.LocalizedText>, currentUser: User): BusinessEntityResponse {
        val entity = updateBusinessEntityDescriptions(entityKey, descriptions, currentUser)
        return businessEntityMapper.toBusinessEntityResponse(getBusinessEntityByKey(entity.key))
    }

    @Transactional
    open fun updateRetentionPeriod(entityKey: String, retentionPeriod: String?, currentUser: User): BusinessEntityResponse {
        var entity = getBusinessEntityByKey(entityKey)
        checkEditPermission(entity, currentUser)
        entity.retentionPeriod = retentionPeriod
        entity = businessEntityRepository.update(entity)
        createBusinessEntityVersion(entity, currentUser, "UPDATE", "Updated retention period")
        return businessEntityMapper.toBusinessEntityResponse(getBusinessEntityByKey(entity.key))
    }

    @Transactional
    open fun updateCrossBorderTransfers(
        entityKey: String,
        transfers: List<org.leargon.backend.model.CrossBorderTransferEntry>,
        currentUser: User
    ): BusinessEntityResponse {
        var entity = getBusinessEntityByKey(entityKey)
        checkEditPermission(entity, currentUser)
        entity.crossBorderTransfers = transfers
            .map { org.leargon.backend.mapper.DataProcessorMapper.fromCrossBorderTransferEntry(it) }
            .toMutableList()
        entity = businessEntityRepository.update(entity)
        createBusinessEntityVersion(entity, currentUser, "UPDATE", "Updated cross-border transfers")
        return businessEntityMapper.toBusinessEntityResponse(getBusinessEntityByKey(entity.key))
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    open fun updateBusinessEntityInterfaces(entityKey: String, interfaceKeys: List<String>, currentUser: User): BusinessEntityResponse {
        var entity = getBusinessEntityByKey(entityKey)
        checkEditPermission(entity, currentUser)

        val newInterfaces = mutableSetOf<BusinessEntity>()
        interfaceKeys.forEach { ifKey ->
            val interfaceEntity = businessEntityRepository.findByKey(ifKey)
                .orElseThrow { ResourceNotFoundException("Interface entity not found: $ifKey") }
            newInterfaces.add(interfaceEntity)
        }

        entity.interfaceEntities.clear()
        entity.interfaceEntities.addAll(newInterfaces)

        entity = businessEntityRepository.update(entity)
        createBusinessEntityVersion(entity, currentUser, "INTERFACE_CHANGE",
            "Updated interfaces to [${interfaceKeys.joinToString(", ")}]")

        entity = getBusinessEntityByKey(entityKey)
        return businessEntityMapper.toBusinessEntityResponse(entity)
    }

    @Transactional
    open fun deleteBusinessEntity(entityKey: String, currentUser: User) {
        val entity = getBusinessEntityByKey(entityKey)
        checkEditPermission(entity, currentUser)

        val children = entity.children.toList()
        for (child in children) {
            child.parent = null
            recomputeKeysForSubtree(child)
            businessEntityRepository.update(child)
        }
        entity.children.clear()

        businessEntityRepository.delete(entity)
    }

    @Transactional
    open fun getLocalizedEntity(key: String, locale: String?, currentUser: User): LocalizedBusinessEntityResponse {
        val entity = getBusinessEntityByKey(key)
        val resolvedLocale = resolveLocale(locale, currentUser)
        return businessEntityMapper.toLocalizedBusinessEntityResponse(entity, resolvedLocale)
    }

    private fun resolveLocale(locale: String?, currentUser: User): String {
        if (!locale.isNullOrEmpty()) return locale
        if (!currentUser.preferredLanguage.isNullOrEmpty()) return currentUser.preferredLanguage!!
        return localeService.getDefaultLocale()!!.localeCode
    }

    // --- Relationship CRUD ---

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    open fun createRelationship(entityKey: String, request: CreateBusinessEntityRelationshipRequest, currentUser: User): BusinessEntityResponse {
        var entity = getBusinessEntityByKey(entityKey)
        checkEditPermission(entity, currentUser)

        val secondEntity = businessEntityRepository.findByKey(request.secondEntityKey)
            .orElseThrow { ResourceNotFoundException("Second entity not found: ${request.secondEntityKey}") }

        val relationship = BusinessEntityRelationship()
        relationship.firstBusinessEntity = entity
        relationship.secondBusinessEntity = secondEntity
        relationship.firstCardinalityMinimum = request.firstCardinalityMinimum
        relationship.firstCardinalityMaximum = request.firstCardinalityMaximum
        relationship.secondCardinalityMinimum = request.secondCardinalityMinimum
        relationship.secondCardinalityMaximum = request.secondCardinalityMaximum
        if (request.descriptions != null) {
            relationship.descriptions = request.descriptions!!.map { input ->
                LocalizedText(input.locale, input.text)
            }.toMutableList()
        }

        businessEntityRelationshipRepository.save(relationship)

        entity = getBusinessEntityByKey(entityKey)
        createBusinessEntityVersion(entity, currentUser, "UPDATE", "Added relationship with ${request.secondEntityKey}")

        return businessEntityMapper.toBusinessEntityResponse(entity)
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    open fun updateRelationship(entityKey: String, relationshipId: Long, request: UpdateBusinessEntityRelationshipRequest, currentUser: User): BusinessEntityResponse {
        var entity = getBusinessEntityByKey(entityKey)
        checkEditPermission(entity, currentUser)

        val relationship = businessEntityRelationshipRepository.findById(relationshipId)
            .orElseThrow { ResourceNotFoundException("Relationship not found") }

        if (relationship.firstBusinessEntity!!.id != entity.id && relationship.secondBusinessEntity!!.id != entity.id) {
            throw ResourceNotFoundException("Relationship not found for this entity")
        }

        if (request.firstCardinalityMinimum != null) relationship.firstCardinalityMinimum = request.firstCardinalityMinimum
        if (request.firstCardinalityMaximum != null) relationship.firstCardinalityMaximum = request.firstCardinalityMaximum
        if (request.secondCardinalityMinimum != null) relationship.secondCardinalityMinimum = request.secondCardinalityMinimum
        if (request.secondCardinalityMaximum != null) relationship.secondCardinalityMaximum = request.secondCardinalityMaximum
        if (request.descriptions != null) {
            relationship.descriptions = request.descriptions!!.map { input ->
                LocalizedText(input.locale, input.text)
            }.toMutableList()
        }

        businessEntityRelationshipRepository.update(relationship)

        entity = getBusinessEntityByKey(entityKey)
        createBusinessEntityVersion(entity, currentUser, "UPDATE", "Updated relationship #$relationshipId")

        return businessEntityMapper.toBusinessEntityResponse(entity)
    }

    @Transactional
    open fun deleteRelationship(entityKey: String, relationshipId: Long, currentUser: User) {
        val entity = getBusinessEntityByKey(entityKey)
        checkEditPermission(entity, currentUser)

        val relationship = businessEntityRelationshipRepository.findById(relationshipId)
            .orElseThrow { ResourceNotFoundException("Relationship not found") }

        if (relationship.firstBusinessEntity!!.id != entity.id && relationship.secondBusinessEntity!!.id != entity.id) {
            throw ResourceNotFoundException("Relationship not found for this entity")
        }

        entity.relationshipsFirst.removeIf { it.id == relationshipId }
        entity.relationshipsSecond.removeIf { it.id == relationshipId }

        val otherEntity = if (relationship.firstBusinessEntity!!.id == entity.id)
            relationship.secondBusinessEntity!!
        else
            relationship.firstBusinessEntity!!
        otherEntity.relationshipsFirst.removeIf { it.id == relationshipId }
        otherEntity.relationshipsSecond.removeIf { it.id == relationshipId }

        businessEntityRelationshipRepository.delete(relationship)
        createBusinessEntityVersion(entity, currentUser, "UPDATE", "Deleted relationship #$relationshipId")
    }

    open fun getVersionHistory(entityKey: String): List<BusinessEntityVersionResponse> {
        val entity = getBusinessEntityByKey(entityKey)
        return businessEntityVersionRepository.findByBusinessEntityIdOrderByVersionNumberDesc(entity.id!!)
            .map { businessEntityMapper.toBusinessEntityVersionResponse(it) }
    }

    open fun getVersionDiff(entityKey: String, versionNumber: Int): VersionDiffResponse {
        val entity = getBusinessEntityByKey(entityKey)

        val currentVersion = businessEntityVersionRepository
            .findByBusinessEntityIdAndVersionNumber(entity.id!!, versionNumber)
            .orElseThrow { ResourceNotFoundException("Version not found") }

        val previousVersion = if (versionNumber > 1) {
            businessEntityVersionRepository
                .findByBusinessEntityIdAndVersionNumber(entity.id!!, versionNumber - 1)
                .orElse(null)
        } else null

        val currentSnapshot = parseSnapshot(currentVersion.snapshotJson)
        val previousSnapshot = if (previousVersion != null) parseSnapshot(previousVersion.snapshotJson) else emptyMap()

        val changes = calculateDiff(previousSnapshot, currentSnapshot)

        return VersionDiffResponse(versionNumber, previousVersion?.versionNumber, changes)
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    open fun assignBusinessDomain(entityKey: String, domainKey: String?, currentUser: User): BusinessEntityResponse {
        var entity = getBusinessEntityByKey(entityKey)
        checkEditPermission(entity, currentUser)

        val oldDomainName = entity.businessDomain?.getName("en") ?: "none"

        entity.businessDomain = if (domainKey != null) {
            businessDomainRepository.findByKey(domainKey)
                .orElseThrow { ResourceNotFoundException("Business businessDomain not found") }
        } else null

        entity = businessEntityRepository.update(entity)

        val newDomainName = entity.businessDomain?.getName("en") ?: "none"
        createBusinessEntityVersion(entity, currentUser, "UPDATE",
            "BusinessDomain assignment changed from '$oldDomainName' to '$newDomainName'")

        entity = getBusinessEntityByKey(entityKey)
        return businessEntityMapper.toBusinessEntityResponse(entity)
    }

    @Transactional
    open fun recordVersion(entityKey: String, changedBy: User, changeType: String, changeSummary: String) {
        val entity = getBusinessEntityByKey(entityKey)
        createBusinessEntityVersion(entity, changedBy, changeType, changeSummary)
    }

    private fun recomputeKeysForSubtree(entity: BusinessEntity) {
        val defaultLocale = localeService.getDefaultLocale()
        val defaultName = entity.getName(defaultLocale?.localeCode ?: "en")
        val slug = SlugUtil.slugify(defaultName)
        entity.key = SlugUtil.buildKey(entity.parent?.key, slug)
        entity.children.forEach { child ->
            recomputeKeysForSubtree(child)
            businessEntityRepository.update(child)
        }
    }

    private fun wouldCreateCycle(entityId: Long, newParentId: Long): Boolean {
        var currentId: Long? = newParentId
        while (currentId != null) {
            if (currentId == entityId) return true
            currentId = businessEntityRepository.findById(currentId)
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

    private fun createBusinessEntityVersion(entity: BusinessEntity, changedBy: User, changeType: String, changeSummary: String) {
        val nextVersion = businessEntityVersionRepository
            .findFirstByBusinessEntityIdOrderByVersionNumberDesc(entity.id!!)
            .map { it.versionNumber + 1 }
            .orElse(1)

        val snapshot = mapOf(
            "key" to entity.key,
            "dataOwnerUsername" to entity.dataOwner!!.username,
            "names" to entity.names.map { mapOf("locale" to it.locale, "text" to it.text) },
            "descriptions" to entity.descriptions.map { mapOf("locale" to it.locale, "text" to it.text) }
        )

        val version = BusinessEntityVersion()
        version.businessEntity = entity
        version.versionNumber = nextVersion
        version.changedBy = changedBy
        version.changeType = changeType
        version.snapshotJson = objectMapper.writeValueAsString(snapshot)
        version.changeSummary = changeSummary

        businessEntityVersionRepository.save(version)
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
        fun checkEditPermission(entity: BusinessEntity, currentUser: User) {
            val isOwner = entity.dataOwner!!.id == currentUser.id
            val isAdmin = currentUser.roles.contains("ROLE_ADMIN")
            if (!isOwner && !isAdmin) {
                throw ForbiddenOperationException("Only the data owner or an admin can edit this entity")
            }
        }

        @JvmStatic
        fun canEdit(entity: BusinessEntity, currentUser: User): Boolean {
            val isOwner = entity.dataOwner!!.id == currentUser.id
            val isAdmin = currentUser.roles.contains("ROLE_ADMIN")
            return isOwner || isAdmin
        }

        @JvmStatic
        @Suppress("UNCHECKED_CAST")
        fun calculateDiff(previous: Map<String, Any?>, current: Map<String, Any?>): List<FieldChange> {
            val changes = mutableListOf<FieldChange>()

            val prevOwner = previous["dataOwnerUsername"]
            val currOwner = current["dataOwnerUsername"]
            if (prevOwner != currOwner) {
                changes.add(FieldChange("dataOwner", prevOwner?.toString(), currOwner?.toString()))
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
