package org.leargon.backend.service

import groovy.json.JsonOutput
import groovy.json.JsonSlurper
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
import org.leargon.backend.model.*
import org.leargon.backend.repository.BusinessDomainRepository
import org.leargon.backend.repository.BusinessEntityRelationshipRepository
import org.leargon.backend.util.SlugUtil
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.BusinessEntityVersionRepository
import org.leargon.backend.repository.UserRepository

/**
 * Service for managing  entities.
 * Handles CRUD operations, versioning, and authorization.
 */
@Singleton
class BusinessEntityService {

    private final BusinessEntityRepository businessEntityRepository
    private final BusinessEntityVersionRepository businessEntityVersionRepository
    private final BusinessEntityRelationshipRepository businessEntityRelationshipRepository
    private final UserRepository userRepository
    private final BusinessDomainRepository businessDomainRepository
    private final LocaleService localeService
    private final BusinessEntityMapper businessEntityMapper
    private final JsonSlurper jsonSlurper = new JsonSlurper()

    BusinessEntityService(
            BusinessEntityRepository businessEntityRepository,
            BusinessEntityVersionRepository businessEntityVersionRepository,
            BusinessEntityRelationshipRepository businessEntityRelationshipRepository,
            UserRepository userRepository,
            BusinessDomainRepository businessDomainRepository,
            LocaleService localeService,
            BusinessEntityMapper businessEntityMapper
    ) {
        this.businessEntityRepository = businessEntityRepository
        this.businessEntityVersionRepository = businessEntityVersionRepository
        this.businessEntityRelationshipRepository = businessEntityRelationshipRepository
        this.userRepository = userRepository
        this.businessDomainRepository = businessDomainRepository
        this.localeService = localeService
        this.businessEntityMapper = businessEntityMapper
    }

    /**
     * Get all  entities.
     *
     * @return List of all entities
     */
    List<BusinessEntity> getAllBusinessEntities() {
        return businessEntityRepository.findAll()
    }

    /**
     * Get all  entities as response DTOs.
     *
     * @return List of BusinessEntityResponse DTOs
     */
    @Transactional
    List<BusinessEntityResponse> getAllBusinessEntitiesAsResponses() {
        // Capture businessEntityMapper for closure access (needed for Micronaut AOP compatibility)
        def m = this.businessEntityMapper
        return getAllBusinessEntities().collect { m.toBusinessEntityResponse(it) }
    }

    /**
     * Get an  entity by ID.
     *
     * @param id BusinessEntity ID
     * @return BusinessEntity
     * @throws ResourceNotFoundException if entity not found
     */
    BusinessEntity getBusinessEntityById(Long id) {
        return businessEntityRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("BusinessEntity not found"))
    }

    BusinessEntity getBusinessEntityByKey(String key) {
        return businessEntityRepository.findByKey(key)
                .orElseThrow(() -> new ResourceNotFoundException("BusinessEntity not found"))
    }

    @Transactional
    BusinessEntityResponse getBusinessEntityByKeyAsResponse(String key) {
        return businessEntityMapper.toBusinessEntityResponse(getBusinessEntityByKey(key))
    }

    /**
     * Get businessEntity tree (top-level domains with children).
     *
     * @return List of top-level domains with hierarchical children
     */
    List<BusinessEntity> getBusinessEntityTree() {
        return businessEntityRepository.findByParentIsNull()
    }

    /**
     * Get businessDomain tree as response DTOs.
     *
     * @return List of DomainTreeResponse DTOs
     */
    @Transactional
    List<BusinessEntityTreeResponse> getBusinessEntityTreeAsResponses() {
        def m = this.businessEntityMapper
        return getBusinessEntityTree().collect { m.toBusinessEntityTreeResponse(it) }
    }

    /**
     * Create a new  entity.
     * The creator becomes the Data Owner by default unless specified.
     *
     * @param request Create request with names
     * @param currentUser The user creating the entity
     * @return Created entity
     */
    @Transactional
    BusinessEntity createBusinessEntity(CreateBusinessEntityRequest request, User currentUser) {
        // Validate names
        validateTranslations(request.names)

        // Create entity
        BusinessEntity entity = new BusinessEntity()
        entity.createdBy = currentUser

        // Set data owner - default to creator if not specified
        if (request.dataOwnerUsername != null) {
            entity.dataOwner = userRepository.findByUsername(request.dataOwnerUsername)
                    .orElseThrow(() -> new ResourceNotFoundException("Data owner user not found"))
        } else {
            entity.dataOwner = currentUser
        }

        // Set parent if specified
        if (request.parentKey != null) {
            entity.parent = businessEntityRepository.findByKey(request.parentKey)
                    .orElseThrow(() -> new ResourceNotFoundException("Parent BusinessEntity not found"))
        }

        // Build names and descriptions
        entity.names = request.names.collect { input ->
            new LocalizedText(input.locale, input.text)
        }
        if (request.descriptions != null) {
            entity.descriptions = request.descriptions.collect { input ->
                new LocalizedText(input.locale, input.text)
            }
        }

        // Compute key from default locale name
        def ls = this.localeService
        def defaultLocale = ls.getDefaultLocale()
        String defaultName = entity.names.find { it.locale == defaultLocale.localeCode }?.text
        String slug = SlugUtil.slugify(defaultName)
        entity.key = SlugUtil.buildKey(entity.parent?.key, slug)

        // Save entity
        entity = businessEntityRepository.save(entity)

        // Create initial version
        createBusinessEntityVersion(entity, currentUser, "CREATE", "Initial creation")

        return entity
    }

    /**
     * Update the parent of a business entity.
     * Only the Data Owner or an Admin can edit an entity.
     */
    @Transactional
    BusinessEntity updateBusinessEntityParent(String entityKey, String parentKey, User currentUser) {
        BusinessEntity entity = getBusinessEntityByKey(entityKey)
        checkEditPermission(entity, currentUser)

        if (parentKey != null) {
            if (parentKey == entityKey) {
                throw new IllegalArgumentException("A businessEntity cannot be its own parent")
            }
            BusinessEntity newParent = businessEntityRepository.findByKey(parentKey)
                    .orElseThrow(() -> new ResourceNotFoundException("Parent businessEntity not found"))
            if (wouldCreateCycle(entity.id, newParent.id)) {
                throw new IllegalArgumentException("Cannot set parent: would create a cycle in the hierarchy")
            }
            entity.parent = newParent
        } else {
            entity.parent = null
        }

        recomputeKeysForSubtree(entity)
        entity = businessEntityRepository.update(entity)
        createBusinessEntityVersion(entity, currentUser, "PARENT_CHANGE",
                "Changed parent to ${parentKey ?: 'none'}")
        return entity
    }

    /**
     * Update the data owner of a business entity.
     * Only the Data Owner or an Admin can edit an entity.
     */
    @Transactional
    BusinessEntity updateBusinessEntityDataOwner(String entityKey, String dataOwnerUsername, User currentUser) {
        BusinessEntity entity = getBusinessEntityByKey(entityKey)
        checkEditPermission(entity, currentUser)

        User newOwner = userRepository.findByUsername(dataOwnerUsername)
                .orElseThrow(() -> new ResourceNotFoundException("Data owner user not found"))
        entity.dataOwner = newOwner

        entity = businessEntityRepository.update(entity)
        createBusinessEntityVersion(entity, currentUser, "OWNER_CHANGE",
                "Changed data owner to ${newOwner.username}")
        return entity
    }

    /**
     * Update the names of a business entity.
     * Only the Data Owner or an Admin can edit an entity.
     */
    @Transactional
    BusinessEntity updateBusinessEntityNames(String entityKey, List<org.leargon.backend.model.LocalizedText> names, User currentUser) {
        BusinessEntity entity = getBusinessEntityByKey(entityKey)
        checkEditPermission(entity, currentUser)

        validateTranslations(names)

        entity.names = names.collect { input ->
            new LocalizedText(input.locale, input.text)
        }

        def ls = this.localeService
        def defaultLocale = ls.getDefaultLocale()
        def defaultTranslation = entity.names.find { it.locale == defaultLocale.localeCode }
        if (defaultTranslation.text == null || defaultTranslation.text.trim().isEmpty()) {
            throw new IllegalArgumentException(
                    "Name for default locale '${defaultLocale.localeCode}' (${defaultLocale.displayName}) is required")
        }

        // Recompute key since name changed
        recomputeKeysForSubtree(entity)

        entity = businessEntityRepository.update(entity)
        createBusinessEntityVersion(entity, currentUser, "UPDATE", "Updated names")
        return entity
    }

    @Transactional
    BusinessEntity updateBusinessEntityDescriptions(String entityKey, List<org.leargon.backend.model.LocalizedText> descriptions, User currentUser) {
        BusinessEntity entity = getBusinessEntityByKey(entityKey)
        checkEditPermission(entity, currentUser)

        validateTranslations(descriptions, false)

        entity.descriptions = descriptions.collect { input ->
            new LocalizedText(input.locale, input.text)
        }

        entity = businessEntityRepository.update(entity)
        createBusinessEntityVersion(entity, currentUser, "UPDATE", "Updated descriptions")
        return entity
    }

    /**
     * Update the interface entities of a business entity.
     * Only the Data Owner or an Admin can edit an entity.
     */
    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    BusinessEntityResponse updateBusinessEntityInterfaces(String entityKey, List<String> interfaceKeys, User currentUser) {
        BusinessEntity entity = getBusinessEntityByKey(entityKey)
        checkEditPermission(entity, currentUser)

        // Resolve interface entities by key
        // Capture repository for closure access (needed for Micronaut AOP compatibility)
        def repo = this.businessEntityRepository
        Set<BusinessEntity> newInterfaces = new HashSet<>()
        interfaceKeys.each { ifKey ->
            BusinessEntity interfaceEntity = repo.findByKey(ifKey)
                    .orElseThrow(() -> new ResourceNotFoundException("Interface entity not found: ${ifKey}"))
            newInterfaces.add(interfaceEntity)
        }

        // Replace interfaces
        entity.interfaceEntities.clear()
        entity.interfaceEntities.addAll(newInterfaces)

        entity = businessEntityRepository.update(entity)
        createBusinessEntityVersion(entity, currentUser, "INTERFACE_CHANGE",
                "Updated interfaces to [${interfaceKeys.join(', ')}]")

        // Reload and map inside transaction to avoid lazy loading issues
        entity = getBusinessEntityByKey(entityKey)
        return businessEntityMapper.toBusinessEntityResponse(entity)
    }

    /**
     * Delete an  entity.
     * Only the Data Owner or an Admin can delete an entity.
     *
     * @param id BusinessEntity ID
     * @param currentUser The user making the deletion
     */
    @Transactional
    void deleteBusinessEntity(String entityKey, User currentUser) {
        BusinessEntity entity = getBusinessEntityByKey(entityKey)

        // Check permission
        checkEditPermission(entity, currentUser)

        // Detach children — set parent=null and recompute keys
        // Use for-loop instead of closure to avoid Micronaut AOP proxy issues with private methods
        def repo = this.businessEntityRepository
        List<BusinessEntity> children = entity.children ? new ArrayList<>(entity.children) : []
        for (BusinessEntity child : children) {
            child.parent = null
            recomputeKeysForSubtree(child)
            repo.update(child)
        }
        entity.children.clear()

        businessEntityRepository.delete(entity)
    }

    @Transactional
    LocalizedBusinessEntityResponse getLocalizedEntity(String key, String locale, User currentUser) {
        BusinessEntity entity = getBusinessEntityByKey(key)

        // Resolve locale: param → user pref → default
        String resolvedLocale = resolveLocale(locale, currentUser)

        return businessEntityMapper.toLocalizedBusinessEntityResponse(entity, resolvedLocale)
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

    // --- Relationship CRUD ---

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    BusinessEntityResponse createRelationship(String entityKey, CreateBusinessEntityRelationshipRequest request, User currentUser) {
        BusinessEntity entity = getBusinessEntityByKey(entityKey)
        checkEditPermission(entity, currentUser)

        BusinessEntity secondEntity = businessEntityRepository.findByKey(request.secondEntityKey)
                .orElseThrow(() -> new ResourceNotFoundException("Second entity not found: ${request.secondEntityKey}"))

        BusinessEntityRelationship relationship = new BusinessEntityRelationship()
        relationship.firstBusinessEntity = entity
        relationship.secondBusinessEntity = secondEntity
        relationship.firstCardinalityMinimum = request.firstCardinalityMinimum
        relationship.firstCardinalityMaximum = request.firstCardinalityMaximum
        relationship.secondCardinalityMinimum = request.secondCardinalityMinimum
        relationship.secondCardinalityMaximum = request.secondCardinalityMaximum
        if (request.descriptions != null) {
            relationship.descriptions = request.descriptions.collect { input ->
                new LocalizedText(input.locale, input.text)
            }
        }

        businessEntityRelationshipRepository.save(relationship)

        // Reload entity to get updated relationships
        entity = getBusinessEntityByKey(entityKey)
        createBusinessEntityVersion(entity, currentUser, "UPDATE", "Added relationship with ${request.secondEntityKey}")

        // Map inside transaction to avoid lazy loading issues
        return businessEntityMapper.toBusinessEntityResponse(entity)
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    BusinessEntityResponse updateRelationship(String entityKey, Long relationshipId, UpdateBusinessEntityRelationshipRequest request, User currentUser) {
        BusinessEntity entity = getBusinessEntityByKey(entityKey)
        checkEditPermission(entity, currentUser)

        BusinessEntityRelationship relationship = businessEntityRelationshipRepository.findById(relationshipId)
                .orElseThrow(() -> new ResourceNotFoundException("Relationship not found"))

        // Verify relationship belongs to this entity
        if (relationship.firstBusinessEntity.id != entity.id && relationship.secondBusinessEntity.id != entity.id) {
            throw new ResourceNotFoundException("Relationship not found for this entity")
        }

        if (request.firstCardinalityMinimum != null) {
            relationship.firstCardinalityMinimum = request.firstCardinalityMinimum
        }
        if (request.firstCardinalityMaximum != null) {
            relationship.firstCardinalityMaximum = request.firstCardinalityMaximum
        }
        if (request.secondCardinalityMinimum != null) {
            relationship.secondCardinalityMinimum = request.secondCardinalityMinimum
        }
        if (request.secondCardinalityMaximum != null) {
            relationship.secondCardinalityMaximum = request.secondCardinalityMaximum
        }
        if (request.descriptions != null) {
            relationship.descriptions = request.descriptions.collect { input ->
                new LocalizedText(input.locale, input.text)
            }
        }

        businessEntityRelationshipRepository.update(relationship)

        entity = getBusinessEntityByKey(entityKey)
        createBusinessEntityVersion(entity, currentUser, "UPDATE", "Updated relationship #${relationshipId}")

        // Map inside transaction to avoid lazy loading issues
        return businessEntityMapper.toBusinessEntityResponse(entity)
    }

    @Transactional
    void deleteRelationship(String entityKey, Long relationshipId, User currentUser) {
        BusinessEntity entity = getBusinessEntityByKey(entityKey)
        checkEditPermission(entity, currentUser)

        BusinessEntityRelationship relationship = businessEntityRelationshipRepository.findById(relationshipId)
                .orElseThrow(() -> new ResourceNotFoundException("Relationship not found"))

        if (relationship.firstBusinessEntity.id != entity.id && relationship.secondBusinessEntity.id != entity.id) {
            throw new ResourceNotFoundException("Relationship not found for this entity")
        }

        // Remove from entity collections before deleting to avoid cascade re-save
        entity.relationshipsFirst.removeIf { it.id == relationshipId }
        entity.relationshipsSecond.removeIf { it.id == relationshipId }

        // Also remove from the other entity's collections
        BusinessEntity otherEntity = (relationship.firstBusinessEntity.id == entity.id)
                ? relationship.secondBusinessEntity
                : relationship.firstBusinessEntity
        otherEntity.relationshipsFirst.removeIf { it.id == relationshipId }
        otherEntity.relationshipsSecond.removeIf { it.id == relationshipId }

        businessEntityRelationshipRepository.delete(relationship)
        createBusinessEntityVersion(entity, currentUser, "UPDATE", "Deleted relationship #${relationshipId}")
    }

    /**
     * Get version history for an entity.
     *
     * @param entityId BusinessEntity ID
     * @return List of versions ordered by version number descending
     */
    List<BusinessEntityVersionResponse> getVersionHistory(String entityKey) {
        // Verify entity exists and get internal ID
        def entity = getBusinessEntityByKey(entityKey)

        // Capture businessEntityMapper for closure access (needed for Micronaut AOP compatibility)
        def m = this.businessEntityMapper
        return businessEntityVersionRepository.findByBusinessEntityIdOrderByVersionNumberDesc(entity.id)
                .collect { m.toBusinessEntityVersionResponse(it) }
    }

    VersionDiffResponse getVersionDiff(String entityKey, Integer versionNumber) {
        def entity = getBusinessEntityByKey(entityKey)

        // Get the specified version
        BusinessEntityVersion currentVersion = businessEntityVersionRepository
                .findByBusinessEntityIdAndVersionNumber(entity.id, versionNumber)
                .orElseThrow(() -> new ResourceNotFoundException("Version not found"))

        // Get previous version
        BusinessEntityVersion previousVersion = null
        if (versionNumber > 1) {
            previousVersion = businessEntityVersionRepository
                    .findByBusinessEntityIdAndVersionNumber(entity.id, versionNumber - 1)
                    .orElse(null)
        }

        // Parse snapshots (handle H2 JSON type which may double-serialize)
        Map<String, Object> currentSnapshot = parseSnapshot(currentVersion.snapshotJson)
        Map<String, Object> previousSnapshot = previousVersion != null
                ? parseSnapshot(previousVersion.snapshotJson)
                : [:]

        // Calculate diff
        List<FieldChange> changes = calculateDiff(previousSnapshot, currentSnapshot)

        return new VersionDiffResponse(
                versionNumber,
                previousVersion?.versionNumber,
                changes
        )
    }

    /**
     * Assign a business businessDomain to an  entity.
     * Only the Data Owner or an Admin can assign domains.
     *
     * @param entityId BusinessEntity ID
     * @param domainId BusinessDomain ID (null to unassign)
     * @param currentUser The user making the assignment
     * @return Updated entity
     */
    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    BusinessEntityResponse assignBusinessDomain(String entityKey, String domainKey, User currentUser) {
        BusinessEntity entity = getBusinessEntityByKey(entityKey)

        // Check permission
        checkEditPermission(entity, currentUser)

        // Get old businessDomain names for version tracking
        String oldDomainName = entity.businessDomain?.getName('en') ?: 'none'

        // Set new businessDomain
        if (domainKey != null) {
            entity.businessDomain = businessDomainRepository.findByKey(domainKey)
                    .orElseThrow(() -> new ResourceNotFoundException("Business businessDomain not found"))
        } else {
            entity.businessDomain = null
        }

        // Update entity
        entity = businessEntityRepository.update(entity)

        // Get new businessDomain names for version tracking
        String newDomainName = entity.businessDomain?.getName('en') ?: 'none'

        // Create version
        createBusinessEntityVersion(entity, currentUser, "UPDATE", "BusinessDomain assignment changed from '${oldDomainName}' to '${newDomainName}'")

        // Reload and map inside transaction to avoid lazy loading issues
        entity = getBusinessEntityByKey(entityKey)
        return businessEntityMapper.toBusinessEntityResponse(entity)
    }

    /**
     * Check if setting a parent would create a cycle.
     *
     * @param entityId The businessEntity being updated
     * @param newParentId The proposed parent ID
     * @return true if this would create a cycle
     */
    private void recomputeKeysForSubtree(BusinessEntity entity) {
        def ls = this.localeService
        def defaultLocale = ls.getDefaultLocale()
        String defaultName = entity.getName(defaultLocale.localeCode)
        String slug = SlugUtil.slugify(defaultName)
        entity.key = SlugUtil.buildKey(entity.parent?.key, slug)
        // Recursively update children
        entity.children?.each { child ->
            recomputeKeysForSubtree(child)
            businessEntityRepository.update(child)
        }
    }

    private boolean wouldCreateCycle(Long entityId, Long newParentId) {
        Long currentId = newParentId
        while (currentId != null) {
            if (currentId == entityId) {
                return true
            }
            def parent = businessEntityRepository.findById(currentId)
                    .map { it.parent }
                    .orElse(null)
            currentId = parent?.id
        }
        return false
    }

    /**
     * Check if the current user has permission to edit the entity.
     *
     * @param entity BusinessEntity to check
     * @param currentUser Current user
     * @throws ForbiddenOperationException if user doesn't have permission
     */
    static void checkEditPermission(BusinessEntity entity, User currentUser) {
        boolean isOwner = entity.dataOwner.id == currentUser.id
        boolean isAdmin = currentUser.roles?.contains("ROLE_ADMIN")

        if (!isOwner && !isAdmin) {
            throw new ForbiddenOperationException(
                    "Only the data owner or an admin can edit this entity")
        }
    }

    /**
     * Check if a user can edit an entity (for UI display).
     *
     * @param entity BusinessEntity to check
     * @param currentUser Current user
     * @return true if user can edit
     */
    static boolean canEdit(BusinessEntity entity, User currentUser) {
        boolean isOwner = entity.dataOwner.id == currentUser.id
        boolean isAdmin = currentUser.roles?.contains("ROLE_ADMIN")
        return isOwner || isAdmin
    }

    /**
     * Validate translation inputs.
     * Ensures the fallback locale has a non-empty names.
     */
    private void validateTranslations(List<org.leargon.backend.model.LocalizedText> businessEntityTranslationInputs, boolean requireDefault = true) {
        if (businessEntityTranslationInputs == null || businessEntityTranslationInputs.isEmpty()) {
            if (requireDefault) {
                throw new IllegalArgumentException("At least one translation is required")
            }
            return
        }

        // Capture localeService for closure access (needed for Micronaut AOP compatibility)
        def ls = this.localeService

        // Get default locale
        def defaultLocale = ls.getDefaultLocale()
        if (defaultLocale == null) {
            throw new IllegalStateException("No default locale configured")
        }

        // Validate each translation
        businessEntityTranslationInputs.each { translation ->
            if (!ls.isLocaleActive(translation.locale)) {
                throw new IllegalArgumentException("Unsupported locale: ${translation.locale}")
            }
            if (translation.text == null || translation.text.trim().isEmpty()) {
                throw new IllegalArgumentException("Text is required for locale: ${translation.locale}")
            }
        }

        // Ensure default locale translation exists with non-empty names (only for required fields like names)
        if (requireDefault) {
            def defaultTranslation = businessEntityTranslationInputs.find { it.locale == defaultLocale.localeCode }
            if (defaultTranslation == null) {
                throw new IllegalArgumentException(
                    "Translation for default locale '${defaultLocale.localeCode}' (${defaultLocale.displayName}) is required")
            }
        }
    }

    @Transactional
    void recordVersion(String entityKey, User changedBy, String changeType, String changeSummary) {
        BusinessEntity entity = getBusinessEntityByKey(entityKey)
        createBusinessEntityVersion(entity, changedBy, changeType, changeSummary)
    }

    private void createBusinessEntityVersion(BusinessEntity entity, User changedBy, String changeType, String changeSummary) {
        // Get next version number
        Integer nextVersion = businessEntityVersionRepository
                .findFirstByBusinessEntityIdOrderByVersionNumberDesc(entity.id)
                .map { it.versionNumber + 1 }
                .orElse(1)

        // Create snapshot
        Map<String, Object> snapshot = [
                key              : entity.key,
                dataOwnerUsername: entity.dataOwner.username,
                names            : entity.names.collect {
                    [locale: it.locale, text: it.text]
                },
                descriptions     : entity.descriptions.collect {
                    [locale: it.locale, text: it.text]
                }
        ]

        // Create version record
        BusinessEntityVersion version = new BusinessEntityVersion()
        version.businessEntity = entity
        version.versionNumber = nextVersion
        version.changedBy = changedBy
        version.changeType = changeType
        version.snapshotJson = JsonOutput.toJson(snapshot)
        version.changeSummary = changeSummary

        businessEntityVersionRepository.save(version)
    }

    /**
     * Calculate diff between two snapshots.
     */
    private static List<FieldChange> calculateDiff(Map<String, Object> previous, Map<String, Object> current) {
        List<FieldChange> changes = []

        // Handle null or invalid inputs
        if (previous == null) previous = [:]
        if (current == null) current = [:]

        // Compare data owner using safe navigation
        def prevOwner = previous?.get('dataOwnerUsername')
        def currOwner = current?.get('dataOwnerUsername')
        if (prevOwner != currOwner) {
            changes << new FieldChange(
                    "dataOwner",
                    prevOwner?.toString(),
                    currOwner?.toString()
            )
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

    /**
     * Parse a snapshot JSON string into a Map.
     * Handles H2 JSON column type which may double-serialize values.
     */
    private Map<String, Object> parseSnapshot(String json) {
        def parsed = jsonSlurper.parseText(json)
        if (parsed instanceof String) {
            parsed = jsonSlurper.parseText(parsed)
        }
        return parsed as Map<String, Object>
    }
}
