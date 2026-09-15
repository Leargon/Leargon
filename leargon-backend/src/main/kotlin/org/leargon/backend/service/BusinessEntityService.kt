package org.leargon.backend.service

import com.fasterxml.jackson.databind.ObjectMapper
import io.micronaut.retry.annotation.Retryable
import io.micronaut.transaction.annotation.ReadOnly
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
import org.leargon.backend.repository.BoundedContextRepository
import org.leargon.backend.repository.BusinessDomainRepository
import org.leargon.backend.repository.BusinessEntityRelationshipRepository
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.BusinessEntityVersionRepository
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.TranslationLinkRepository
import org.leargon.backend.repository.UserRepository
import org.leargon.backend.util.KeyAllocator
import org.leargon.backend.util.SlugUtil

@Singleton
open class BusinessEntityService(
    private val businessEntityRepository: BusinessEntityRepository,
    private val businessEntityVersionRepository: BusinessEntityVersionRepository,
    private val businessEntityRelationshipRepository: BusinessEntityRelationshipRepository,
    private val userRepository: UserRepository,
    private val businessDomainRepository: BusinessDomainRepository,
    private val boundedContextRepository: BoundedContextRepository,
    private val organisationalUnitRepository: OrganisationalUnitRepository,
    private val translationLinkRepository: TranslationLinkRepository,
    private val localeService: LocaleService,
    private val businessEntityMapper: BusinessEntityMapper,
    private val fieldVerificationService: FieldVerificationService,
    private val roleService: RoleService,
    private val businessEntityFieldValueExtractor: org.leargon.backend.service.fieldvalue.BusinessEntityFieldValueExtractor,
    private val defaultLocaleProvider: DefaultLocaleProvider,
    private val creationPolicyService: CreationPolicyService,
    private val classificationAssignmentValidator: ClassificationAssignmentValidator,
    private val creationRequirementService: CreationRequirementService,
    private val duplicateCandidateService: DuplicateCandidateService,
    private val creationRecordService: CreationRecordService
) {
    private val objectMapper = ObjectMapper()

    /**
     * Moving an entity (reparent, bounded-context change, or owning-unit change while unplaced) is placing
     * it somewhere new, so it needs creation rights at the destination — in addition to edit rights on the
     * entity. This keeps an item from being moved into, or out of, someone else's realm unilaterally.
     */
    private fun requirePlacement(
        currentUser: User,
        parentKey: String?,
        boundedContextKey: String?,
        owningUnitKey: String?
    ): CreationDecision =
        creationPolicyService.require(
            currentUser,
            CreationTarget(
                CreationPolicyService.BUSINESS_ENTITY,
                parentKey = parentKey,
                boundedContextKey = boundedContextKey,
                owningUnitKey = owningUnitKey
            )
        )

    /**
     * Per-field edit gate. Owner/steward/admin may edit anything; a methodology-scoped EDITOR/LEAD may
     * edit a field belonging to their methodology. Verification stays owner-only, so scoped edits land
     * UNVERIFIED automatically (sync uses the effective owner, not this check).
     */
    private fun requireFieldEdit(
        entity: BusinessEntity,
        currentUser: User,
        fieldName: String
    ) {
        val isOwner = entity.effectiveOwner()?.id == currentUser.id
        val isSteward = entity.effectiveSteward()?.id == currentUser.id
        val isAdmin = currentUser.roles.contains("ROLE_ADMIN")
        val rs = this.roleService
        if (isOwner || isSteward || isAdmin || rs.canEditFieldByRole(currentUser, "BUSINESS_ENTITY", fieldName)) return
        throw ForbiddenOperationException("You do not have permission to edit this field")
    }

    open fun getAllBusinessEntities(): List<BusinessEntity> = businessEntityRepository.findAll()

    fun canEdit(
        entity: BusinessEntity,
        currentUser: User,
    ): Boolean =
        entity.effectiveOwner()?.id == currentUser.id ||
            entity.effectiveSteward()?.id == currentUser.id ||
            currentUser.roles.contains("ROLE_ADMIN")

    @ReadOnly
    open fun getAllBusinessEntitiesAsResponses(): List<BusinessEntityResponse> =
        getAllBusinessEntities().map { businessEntityMapper.toBusinessEntityResponse(it) }

    open fun getBusinessEntityByKey(key: String): BusinessEntity =
        businessEntityRepository
            .findByKey(key)
            .orElseThrow { ResourceNotFoundException("BusinessEntity not found") }

    @ReadOnly
    open fun getBusinessEntityByKeyAsResponse(key: String): BusinessEntityResponse =
        businessEntityMapper.toBusinessEntityResponse(getBusinessEntityByKey(key))

    /** Detail response including the current user's per-record [editableFields]. */
    @ReadOnly
    open fun getBusinessEntityByKeyAsResponse(
        key: String,
        currentUser: User
    ): BusinessEntityResponse {
        val m = businessEntityMapper
        return m.toBusinessEntityResponse(getBusinessEntityByKey(key), currentUser)
    }

    /** The delete predicate enforced by `deleteBusinessEntity`, for the `canDelete` detail flag. */
    @ReadOnly
    open fun canDelete(
        key: String,
        currentUser: User
    ): Boolean {
        val entity = getBusinessEntityByKey(key)
        return roleService.canDelete(currentUser, "BUSINESS_ENTITY", entity.effectiveOwner()?.id, entity.effectiveSteward()?.id)
    }

    open fun getBusinessEntityTree(): List<BusinessEntity> = businessEntityRepository.findByParentIsNull()

    @ReadOnly
    open fun getBusinessEntityTreeAsResponses(): List<BusinessEntityTreeResponse> =
        getBusinessEntityTree().map { businessEntityMapper.toBusinessEntityTreeResponse(it) }

    @Transactional
    open fun createBusinessEntity(
        request: CreateBusinessEntityRequest,
        currentUser: User
    ): BusinessEntity {
        validateTranslations(request.names)

        val parent =
            request.parentKey?.let {
                businessEntityRepository
                    .findByKey(it)
                    .orElseThrow { ResourceNotFoundException("Parent BusinessEntity not found") }
            }
        val decision = requirePlacement(currentUser, request.parentKey, request.boundedContextKey, request.owningUnitKey)

        var entity = BusinessEntity()
        entity.createdBy = currentUser

        entity.dataOwner =
            if (request.dataOwnerUsername != null) {
                userRepository
                    .findByUsername(request.dataOwnerUsername)
                    .orElseThrow { ResourceNotFoundException("Data owner user not found") }
            } else {
                currentUser
            }

        if (parent != null) {
            entity.parent = parent
            // A child lives in its parent's bounded context unless placed elsewhere explicitly.
            entity.boundedContext = parent.boundedContext
        }
        if (request.boundedContextKey != null) {
            entity.boundedContext =
                boundedContextRepository
                    .findByKey(request.boundedContextKey!!)
                    .orElseThrow { ResourceNotFoundException("Bounded context not found: ${request.boundedContextKey}") }
        }

        entity.names = request.names.map { input -> LocalizedText(input.locale, input.text) }.toMutableList()
        if (request.descriptions != null) {
            entity.descriptions = request.descriptions!!.map { input -> LocalizedText(input.locale, input.text) }.toMutableList()
        }
        entity.retentionPeriod = request.retentionPeriod?.map { LocalizedText(it.locale, it.text) }?.toMutableList() ?: mutableListOf()
        entity.containsPersonalData = request.containsPersonalData
        entity.entityRole = request.entityRole?.value

        if (request.owningUnitKey != null) {
            entity.owningUnit =
                organisationalUnitRepository
                    .findByKey(request.owningUnitKey!!)
                    .orElseThrow { ResourceNotFoundException("Owning unit not found") }
        }

        // Everything the creation wizard collects is set atomically here: a realm owner may delegate the new
        // entity to another owner, after which follow-up edits by the creator would no longer be permitted.
        val users = userRepository
        entity.dataSteward =
            request.dataStewardUsername?.let {
                users.findByUsername(it).orElseThrow { ResourceNotFoundException("Data steward user not found: $it") }
            }
        entity.technicalCustodian =
            request.technicalCustodianUsername?.let {
                users.findByUsername(it).orElseThrow { ResourceNotFoundException("Technical custodian user not found: $it") }
            }
        val assignments = request.classificationAssignments.orEmpty()
        if (assignments.isNotEmpty()) {
            entity.classificationAssignments = classificationAssignmentValidator.toAssignments(assignments, "BUSINESS_ENTITY")
            // Art. 9 special categories imply personal data (same rule as the assignment endpoint).
            if (entity.classificationAssignments.any { it.classificationKey == ClassificationService.SPECIAL_CATEGORIES_KEY }) {
                entity.containsPersonalData = true
            }
        }

        val defaultLocale = localeService.getDefaultLocale()
        val defaultName = entity.names.find { it.locale == defaultLocale?.localeCode }?.text
        val slug = SlugUtil.slugify(defaultName)
        val repo = businessEntityRepository
        entity.key = KeyAllocator.allocate(SlugUtil.buildKey(entity.parent?.key, slug)) { repo.findByKey(it).isPresent }

        // Relationships requested with the entity (new entity = first side), resolved before anything is saved.
        val relationshipRequests = request.relationships.orEmpty()
        val relatedEntities =
            relationshipRequests.map { r ->
                requireValidCardinality(r.firstCardinalityMinimum, r.firstCardinalityMaximum)
                requireValidCardinality(r.secondCardinalityMinimum, r.secondCardinalityMaximum)
                repo.findByKey(r.secondEntityKey).orElseThrow { ResourceNotFoundException("Related entity not found: ${r.secondEntityKey}") }
            }
        // An implementation of a more general concept is linked to its interface(s) at creation.
        request.interfaces.orEmpty().distinct().forEach { interfaceKey ->
            entity.interfaceEntities.add(
                repo.findByKey(interfaceKey).orElseThrow { ResourceNotFoundException("Interface entity not found: $interfaceKey") }
            )
        }

        creationRequirementService.requireComplete("BUSINESS_ENTITY", businessEntityMapper.presenceOf(entity))
        duplicateCandidateService.requireNoUnjustifiedDuplicates(
            CreationTarget(
                CreationPolicyService.BUSINESS_ENTITY,
                parentKey = request.parentKey,
                boundedContextKey = entity.boundedContext?.key,
                owningUnitKey = request.owningUnitKey
            ),
            entity.names.map { it.text },
            request.duplicateJustification,
            request.acknowledgedDuplicateKeys
        )
        entity = businessEntityRepository.save(entity)
        // Created with the entity: the creator may have delegated ownership, after which a separate
        // relationship request by them would be refused.
        val relationshipRepo = businessEntityRelationshipRepository
        relationshipRequests.zip(relatedEntities).forEach { (r, related) ->
            val relationship = BusinessEntityRelationship()
            relationship.firstBusinessEntity = entity
            relationship.secondBusinessEntity = related
            relationship.firstCardinalityMinimum = r.firstCardinalityMinimum
            relationship.firstCardinalityMaximum = r.firstCardinalityMaximum
            relationship.secondCardinalityMinimum = r.secondCardinalityMinimum
            relationship.secondCardinalityMaximum = r.secondCardinalityMaximum
            relationship.descriptions = r.descriptions.orEmpty().map { LocalizedText(it.locale, it.text) }.toMutableList()
            entity.relationshipsFirst.add(relationshipRepo.save(relationship))
        }
        createBusinessEntityVersion(entity, currentUser, "CREATE", "Initial creation")
        creationRecordService.recordCreation(
            CreationPolicyService.BUSINESS_ENTITY,
            entity.key,
            currentUser,
            decision.basis,
            request.duplicateJustification,
            request.acknowledgedDuplicateKeys
        )
        return entity
    }

    @Transactional
    open fun createBusinessEntityAsResponse(
        request: CreateBusinessEntityRequest,
        currentUser: User
    ): BusinessEntityResponse {
        val entity = createBusinessEntity(request, currentUser)
        return businessEntityMapper.toBusinessEntityResponse(getBusinessEntityByKey(entity.key))
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    open fun updatePersonalData(
        entityKey: String,
        containsPersonalData: Boolean?,
        entityRole: org.leargon.backend.model.EntityRole?,
        currentUser: User
    ): BusinessEntityResponse {
        var entity = getBusinessEntityByKey(entityKey)
        requireFieldEdit(entity, currentUser, "containsPersonalData")
        entity.containsPersonalData = containsPersonalData
        entity.entityRole = entityRole?.value
        entity = businessEntityRepository.update(entity)
        createBusinessEntityVersion(entity, currentUser, "UPDATE", "Updated personal-data classification")
        return businessEntityMapper.toBusinessEntityResponse(getBusinessEntityByKey(entity.key))
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    open fun updateBusinessEntityParent(
        entityKey: String,
        parentKey: String?,
        currentUser: User
    ): BusinessEntity {
        var entity = getBusinessEntityByKey(entityKey)
        requireFieldEdit(entity, currentUser, "parent")
        requirePlacement(currentUser, parentKey, entity.boundedContext?.key, entity.owningUnit?.key)

        if (parentKey != null) {
            if (parentKey == entityKey) {
                throw IllegalArgumentException("A businessEntity cannot be its own parent")
            }
            val newParent =
                businessEntityRepository
                    .findByKey(parentKey)
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
        createBusinessEntityVersion(
            entity,
            currentUser,
            "PARENT_CHANGE",
            "Changed parent to ${parentKey ?: "none"}"
        )
        return entity
    }

    @Transactional
    open fun updateBusinessEntityParentAsResponse(
        entityKey: String,
        parentKey: String?,
        currentUser: User
    ): BusinessEntityResponse {
        val entity = updateBusinessEntityParent(entityKey, parentKey, currentUser)
        return businessEntityMapper.toBusinessEntityResponse(getBusinessEntityByKey(entity.key))
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    open fun updateBusinessEntityDataOwner(
        entityKey: String,
        dataOwnerUsername: String,
        currentUser: User
    ): BusinessEntity {
        var entity = getBusinessEntityByKey(entityKey)
        requireFieldEdit(entity, currentUser, "dataOwner")

        val newOwner =
            userRepository
                .findByUsername(dataOwnerUsername)
                .orElseThrow { ResourceNotFoundException("Data owner user not found") }
        entity.dataOwner = newOwner

        entity = businessEntityRepository.update(entity)
        createBusinessEntityVersion(entity, currentUser, "OWNER_CHANGE", "Changed data owner to ${newOwner.username}")
        return entity
    }

    @Transactional
    open fun updateBusinessEntityDataOwnerAsResponse(
        entityKey: String,
        dataOwnerUsername: String,
        currentUser: User
    ): BusinessEntityResponse {
        val entity = updateBusinessEntityDataOwner(entityKey, dataOwnerUsername, currentUser)
        return businessEntityMapper.toBusinessEntityResponse(getBusinessEntityByKey(entity.key))
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    open fun clearBusinessEntityDataOwner(
        entityKey: String,
        currentUser: User
    ): BusinessEntityResponse {
        var entity = getBusinessEntityByKey(entityKey)
        requireFieldEdit(entity, currentUser, "dataOwner")

        val effectiveOwningUnit =
            entity.owningUnit
                ?: entity.boundedContext?.owningUnit
                ?: entity.boundedContext?.domain?.owningUnit
        if (effectiveOwningUnit?.businessOwner == null) {
            throw IllegalArgumentException(
                "Cannot clear explicit data owner: no computed owner available from the owning unit or bounded context"
            )
        }
        entity.dataOwner = null
        entity = businessEntityRepository.update(entity)
        createBusinessEntityVersion(entity, currentUser, "OWNER_CHANGE", "Cleared explicit data owner (reverted to computed)")
        return businessEntityMapper.toBusinessEntityResponse(getBusinessEntityByKey(entity.key))
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    open fun updateBusinessEntityDataSteward(
        entityKey: String,
        stewardUsername: String?,
        currentUser: User
    ): BusinessEntityResponse {
        var entity = getBusinessEntityByKey(entityKey)
        requireFieldEdit(entity, currentUser, "dataSteward")

        entity.dataSteward =
            if (stewardUsername != null) {
                userRepository
                    .findByUsername(stewardUsername)
                    .orElseThrow { ResourceNotFoundException("Data steward user not found: $stewardUsername") }
            } else {
                null
            }

        entity = businessEntityRepository.update(entity)
        createBusinessEntityVersion(entity, currentUser, "UPDATE", "Updated data steward to ${stewardUsername ?: "none"}")
        return businessEntityMapper.toBusinessEntityResponse(getBusinessEntityByKey(entity.key))
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    open fun updateBusinessEntityTechnicalCustodian(
        entityKey: String,
        custodianUsername: String?,
        currentUser: User
    ): BusinessEntityResponse {
        var entity = getBusinessEntityByKey(entityKey)
        requireFieldEdit(entity, currentUser, "technicalCustodian")

        entity.technicalCustodian =
            if (custodianUsername != null) {
                userRepository
                    .findByUsername(custodianUsername)
                    .orElseThrow { ResourceNotFoundException("Technical custodian user not found: $custodianUsername") }
            } else {
                null
            }

        entity = businessEntityRepository.update(entity)
        createBusinessEntityVersion(entity, currentUser, "UPDATE", "Updated technical custodian to ${custodianUsername ?: "none"}")
        return businessEntityMapper.toBusinessEntityResponse(getBusinessEntityByKey(entity.key))
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    open fun updateBusinessEntityNames(
        entityKey: String,
        names: List<org.leargon.backend.model.LocalizedText>,
        currentUser: User
    ): BusinessEntity {
        var entity = getBusinessEntityByKey(entityKey)
        requireFieldEdit(entity, currentUser, "names")

        validateTranslations(names)

        entity.names = names.map { input -> LocalizedText(input.locale, input.text) }.toMutableList()

        val defaultLocale = localeService.getDefaultLocale()
        val defaultTranslation = entity.names.find { it.locale == defaultLocale?.localeCode }
        if (defaultTranslation?.text.isNullOrBlank()) {
            throw IllegalArgumentException(
                "Name for default locale '${defaultLocale?.localeCode}' (${defaultLocale?.displayName}) is required"
            )
        }

        recomputeKeysForSubtree(entity)
        entity = businessEntityRepository.update(entity)
        createBusinessEntityVersion(entity, currentUser, "UPDATE", "Updated names")
        return entity
    }

    @Transactional
    open fun updateBusinessEntityNamesAsResponse(
        entityKey: String,
        names: List<org.leargon.backend.model.LocalizedText>,
        currentUser: User
    ): BusinessEntityResponse {
        val entity = updateBusinessEntityNames(entityKey, names, currentUser)
        return businessEntityMapper.toBusinessEntityResponse(getBusinessEntityByKey(entity.key))
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    open fun updateBusinessEntityDescriptions(
        entityKey: String,
        descriptions: List<org.leargon.backend.model.LocalizedText>,
        currentUser: User
    ): BusinessEntity {
        var entity = getBusinessEntityByKey(entityKey)
        requireFieldEdit(entity, currentUser, "descriptions")

        validateTranslations(descriptions, false)

        entity.descriptions = descriptions.map { input -> LocalizedText(input.locale, input.text) }.toMutableList()
        entity = businessEntityRepository.update(entity)
        createBusinessEntityVersion(entity, currentUser, "UPDATE", "Updated descriptions")
        return entity
    }

    @Transactional
    open fun updateBusinessEntityDescriptionsAsResponse(
        entityKey: String,
        descriptions: List<org.leargon.backend.model.LocalizedText>,
        currentUser: User
    ): BusinessEntityResponse {
        val entity = updateBusinessEntityDescriptions(entityKey, descriptions, currentUser)
        return businessEntityMapper.toBusinessEntityResponse(getBusinessEntityByKey(entity.key))
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    open fun updateRetentionPeriod(
        entityKey: String,
        retentionPeriod: List<org.leargon.backend.model.LocalizedText>?,
        currentUser: User
    ): BusinessEntityResponse {
        var entity = getBusinessEntityByKey(entityKey)
        requireFieldEdit(entity, currentUser, "retentionPeriod")
        entity.retentionPeriod = retentionPeriod?.map { LocalizedText(it.locale, it.text) }?.toMutableList() ?: mutableListOf()
        entity = businessEntityRepository.update(entity)
        createBusinessEntityVersion(entity, currentUser, "UPDATE", "Updated retention period")
        return businessEntityMapper.toBusinessEntityResponse(getBusinessEntityByKey(entity.key))
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    open fun updateStorageLocations(
        entityKey: String,
        locations: List<String>,
        currentUser: User
    ): BusinessEntityResponse {
        var entity = getBusinessEntityByKey(entityKey)
        requireFieldEdit(entity, currentUser, "storageLocations")
        entity.storageLocations = locations.toMutableList()
        entity = businessEntityRepository.update(entity)
        createBusinessEntityVersion(entity, currentUser, "UPDATE", "Updated storage locations")
        return businessEntityMapper.toBusinessEntityResponse(getBusinessEntityByKey(entity.key))
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    open fun updateBusinessEntityInterfaces(
        entityKey: String,
        interfaceKeys: List<String>,
        currentUser: User
    ): BusinessEntityResponse {
        var entity = getBusinessEntityByKey(entityKey)
        requireFieldEdit(entity, currentUser, "interfaceEntities")

        val newInterfaces = mutableSetOf<BusinessEntity>()
        interfaceKeys.forEach { ifKey ->
            val interfaceEntity =
                businessEntityRepository
                    .findByKey(ifKey)
                    .orElseThrow { ResourceNotFoundException("Interface entity not found: $ifKey") }
            newInterfaces.add(interfaceEntity)
        }

        entity.interfaceEntities.clear()
        entity.interfaceEntities.addAll(newInterfaces)

        entity = businessEntityRepository.update(entity)
        createBusinessEntityVersion(
            entity,
            currentUser,
            "INTERFACE_CHANGE",
            "Updated interfaces to [${interfaceKeys.joinToString(", ")}]"
        )

        entity = getBusinessEntityByKey(entityKey)
        return businessEntityMapper.toBusinessEntityResponse(entity)
    }

    @Transactional
    open fun deleteBusinessEntity(
        entityKey: String,
        currentUser: User
    ) {
        val entity = getBusinessEntityByKey(entityKey)
        roleService.requireDelete(currentUser, "BUSINESS_ENTITY", entity.effectiveOwner()?.id, entity.effectiveSteward()?.id)

        val children = entity.children.toList()
        for (child in children) {
            child.parent = null
            recomputeKeysForSubtree(child)
            businessEntityRepository.update(child)
        }
        entity.children.clear()

        // Clear interface/implementation relationships from both sides to prevent FK violations
        entity.implementationEntities.toList().forEach { impl ->
            impl.interfaceEntities.remove(entity)
            businessEntityRepository.update(impl)
        }
        entity.interfaceEntities.clear()
        businessEntityRepository.update(entity)

        // Delete translation links referencing this entity
        translationLinkRepository.deleteByFirstEntityId(entity.id!!)
        translationLinkRepository.deleteBySecondEntityId(entity.id!!)

        fieldVerificationService.deleteFor("BUSINESS_ENTITY", entity.id!!)
        businessEntityRepository.delete(entity)
    }

    @ReadOnly
    open fun getLocalizedEntity(
        key: String,
        locale: String?,
        currentUser: User
    ): LocalizedBusinessEntityResponse {
        val entity = getBusinessEntityByKey(key)
        val resolvedLocale = resolveLocale(locale, currentUser)
        return businessEntityMapper.toLocalizedBusinessEntityResponse(entity, resolvedLocale)
    }

    private fun resolveLocale(
        locale: String?,
        currentUser: User
    ): String {
        if (!locale.isNullOrEmpty()) return locale
        if (!currentUser.preferredLanguage.isNullOrEmpty()) return currentUser.preferredLanguage!!
        return localeService.getDefaultLocale()!!.localeCode
    }

    // --- Relationship CRUD ---

    private fun requireValidCardinality(
        minimum: Int?,
        maximum: Int?
    ) {
        if (minimum == null || minimum < 0 || (maximum != null && (maximum < 1 || maximum < minimum))) {
            throw IllegalArgumentException("Invalid cardinality $minimum..${maximum ?: "*"}")
        }
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    open fun createRelationship(
        entityKey: String,
        request: CreateBusinessEntityRelationshipRequest,
        currentUser: User
    ): BusinessEntityResponse {
        var entity = getBusinessEntityByKey(entityKey)
        requireFieldEdit(entity, currentUser, "relationships")

        val secondEntity =
            businessEntityRepository
                .findByKey(request.secondEntityKey)
                .orElseThrow { ResourceNotFoundException("Second entity not found: ${request.secondEntityKey}") }

        val relationship = BusinessEntityRelationship()
        relationship.firstBusinessEntity = entity
        relationship.secondBusinessEntity = secondEntity
        relationship.firstCardinalityMinimum = request.firstCardinalityMinimum
        relationship.firstCardinalityMaximum = request.firstCardinalityMaximum
        relationship.secondCardinalityMinimum = request.secondCardinalityMinimum
        relationship.secondCardinalityMaximum = request.secondCardinalityMaximum
        if (request.descriptions != null) {
            relationship.descriptions =
                request.descriptions!!
                    .map { input ->
                        LocalizedText(input.locale, input.text)
                    }.toMutableList()
        }

        businessEntityRelationshipRepository.save(relationship)

        entity = getBusinessEntityByKey(entityKey)
        // Keep the in-memory inverse collection consistent so verification sync sees the new item
        // (the already-initialized lazy collection is not auto-refreshed within this transaction).
        if (entity.relationshipsFirst.none { it.id == relationship.id }) entity.relationshipsFirst.add(relationship)
        createBusinessEntityVersion(entity, currentUser, "UPDATE", "Added relationship with ${request.secondEntityKey}")

        return businessEntityMapper.toBusinessEntityResponse(entity)
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    open fun updateRelationship(
        entityKey: String,
        relationshipId: Long,
        request: UpdateBusinessEntityRelationshipRequest,
        currentUser: User
    ): BusinessEntityResponse {
        var entity = getBusinessEntityByKey(entityKey)
        requireFieldEdit(entity, currentUser, "relationships")

        val relationship =
            businessEntityRelationshipRepository
                .findById(relationshipId)
                .orElseThrow { ResourceNotFoundException("Relationship not found") }

        if (relationship.firstBusinessEntity!!.id != entity.id && relationship.secondBusinessEntity!!.id != entity.id) {
            throw ResourceNotFoundException("Relationship not found for this entity")
        }

        if (request.firstCardinalityMinimum != null) relationship.firstCardinalityMinimum = request.firstCardinalityMinimum
        if (request.firstCardinalityMaximum != null) relationship.firstCardinalityMaximum = request.firstCardinalityMaximum
        if (request.secondCardinalityMinimum != null) relationship.secondCardinalityMinimum = request.secondCardinalityMinimum
        if (request.secondCardinalityMaximum != null) relationship.secondCardinalityMaximum = request.secondCardinalityMaximum
        if (request.descriptions != null) {
            relationship.descriptions =
                request.descriptions!!
                    .map { input ->
                        LocalizedText(input.locale, input.text)
                    }.toMutableList()
        }

        businessEntityRelationshipRepository.update(relationship)

        entity = getBusinessEntityByKey(entityKey)
        createBusinessEntityVersion(entity, currentUser, "UPDATE", "Updated relationship #$relationshipId")

        return businessEntityMapper.toBusinessEntityResponse(entity)
    }

    @Transactional
    open fun deleteRelationship(
        entityKey: String,
        relationshipId: Long,
        currentUser: User
    ) {
        val entity = getBusinessEntityByKey(entityKey)
        requireFieldEdit(entity, currentUser, "relationships")

        val relationship =
            businessEntityRelationshipRepository
                .findById(relationshipId)
                .orElseThrow { ResourceNotFoundException("Relationship not found") }

        if (relationship.firstBusinessEntity!!.id != entity.id && relationship.secondBusinessEntity!!.id != entity.id) {
            throw ResourceNotFoundException("Relationship not found for this entity")
        }

        entity.relationshipsFirst.removeIf { it.id == relationshipId }
        entity.relationshipsSecond.removeIf { it.id == relationshipId }

        val otherEntity =
            if (relationship.firstBusinessEntity!!.id == entity.id) {
                relationship.secondBusinessEntity!!
            } else {
                relationship.firstBusinessEntity!!
            }
        otherEntity.relationshipsFirst.removeIf { it.id == relationshipId }
        otherEntity.relationshipsSecond.removeIf { it.id == relationshipId }

        businessEntityRelationshipRepository.delete(relationship)
        createBusinessEntityVersion(entity, currentUser, "UPDATE", "Deleted relationship #$relationshipId")
    }

    @ReadOnly
    open fun getVersionHistory(entityKey: String): List<BusinessEntityVersionResponse> {
        val entity = getBusinessEntityByKey(entityKey)
        return businessEntityVersionRepository
            .findByBusinessEntityIdOrderByVersionNumberDesc(entity.id!!)
            .map { businessEntityMapper.toBusinessEntityVersionResponse(it) }
    }

    @ReadOnly
    open fun getVersionDiff(
        entityKey: String,
        versionNumber: Int
    ): VersionDiffResponse {
        val entity = getBusinessEntityByKey(entityKey)

        val currentVersion =
            businessEntityVersionRepository
                .findByBusinessEntityIdAndVersionNumber(entity.id!!, versionNumber)
                .orElseThrow { ResourceNotFoundException("Version not found") }

        val previousVersion =
            if (versionNumber > 1) {
                businessEntityVersionRepository
                    .findByBusinessEntityIdAndVersionNumber(entity.id!!, versionNumber - 1)
                    .orElse(null)
            } else {
                null
            }

        val currentSnapshot = parseSnapshot(currentVersion.snapshotJson)
        val previousSnapshot = if (previousVersion != null) parseSnapshot(previousVersion.snapshotJson) else emptyMap()

        val changes = calculateDiff(previousSnapshot, currentSnapshot)

        return VersionDiffResponse(versionNumber, previousVersion?.versionNumber, changes)
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    open fun assignBoundedContext(
        entityKey: String,
        boundedContextKey: String?,
        currentUser: User
    ): BusinessEntityResponse {
        var entity = getBusinessEntityByKey(entityKey)
        requireFieldEdit(entity, currentUser, "boundedContext")
        // Assigning bounded contexts is DDD modelling: a DDD editor/lead may move entities between contexts;
        // anyone else (realm owners included) needs creation rights at the destination.
        if (!roleService.isEditorFor(currentUser, "DDD")) {
            requirePlacement(currentUser, entity.parent?.key, boundedContextKey, entity.owningUnit?.key)
        }

        val oldName = entity.boundedContext?.getName(defaultLocaleProvider.code()) ?: "none"

        entity.boundedContext =
            if (boundedContextKey != null) {
                boundedContextRepository
                    .findByKey(boundedContextKey)
                    .orElseThrow { ResourceNotFoundException("Bounded context not found") }
            } else {
                null
            }

        entity = businessEntityRepository.update(entity)

        val newName = entity.boundedContext?.getName(defaultLocaleProvider.code()) ?: "none"
        createBusinessEntityVersion(
            entity,
            currentUser,
            "UPDATE",
            "BoundedContext assignment changed from '$oldName' to '$newName'"
        )

        entity = getBusinessEntityByKey(entityKey)
        return businessEntityMapper.toBusinessEntityResponse(entity)
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    open fun assignOwningUnit(
        entityKey: String,
        owningUnitKey: String?,
        currentUser: User
    ): BusinessEntityResponse {
        var entity = getBusinessEntityByKey(entityKey)
        requireFieldEdit(entity, currentUser, "owningUnit")
        // The owning unit is the entity's placement only while it has no parent and no bounded context.
        if (entity.parent == null && entity.boundedContext == null) {
            requirePlacement(currentUser, null, null, owningUnitKey)
        }

        val oldName = entity.owningUnit?.getName(defaultLocaleProvider.code()) ?: "none"

        entity.owningUnit =
            if (owningUnitKey != null) {
                organisationalUnitRepository
                    .findByKey(owningUnitKey)
                    .orElseThrow { ResourceNotFoundException("Organisational unit not found") }
            } else {
                val fallbackOwner = entity.dataOwner ?: entity.boundedContext?.effectiveOwner()
                if (fallbackOwner == null) {
                    throw IllegalArgumentException(
                        "Cannot remove owning unit: no direct data owner or bounded context owner exists as fallback"
                    )
                }
                null
            }

        entity = businessEntityRepository.update(entity)

        val newName = entity.owningUnit?.getName(defaultLocaleProvider.code()) ?: "none"
        createBusinessEntityVersion(
            entity,
            currentUser,
            "UPDATE",
            "Owning unit assignment changed from '$oldName' to '$newName'"
        )

        entity = getBusinessEntityByKey(entityKey)
        return businessEntityMapper.toBusinessEntityResponse(entity)
    }

    @Transactional
    open fun recordVersion(
        entityKey: String,
        changedBy: User,
        changeType: String,
        changeSummary: String
    ) {
        val entity = getBusinessEntityByKey(entityKey)
        createBusinessEntityVersion(entity, changedBy, changeType, changeSummary)
    }

    private fun recomputeKeysForSubtree(entity: BusinessEntity) {
        val defaultLocale = localeService.getDefaultLocale()
        val defaultName = entity.getName(defaultLocale?.localeCode ?: "en")
        val slug = SlugUtil.slugify(defaultName)
        val repo = businessEntityRepository
        val selfId = entity.id
        entity.key =
            KeyAllocator.allocate(SlugUtil.buildKey(entity.parent?.key, slug)) { candidate ->
                repo.findByKey(candidate).map { it.id != selfId }.orElse(false)
            }
        entity.children.forEach { child ->
            recomputeKeysForSubtree(child)
            businessEntityRepository.update(child)
        }
    }

    private fun wouldCreateCycle(
        entityId: Long,
        newParentId: Long
    ): Boolean {
        var currentId: Long? = newParentId
        while (currentId != null) {
            if (currentId == entityId) return true
            currentId =
                businessEntityRepository
                    .findById(currentId)
                    .map { it.parent }
                    .orElse(null)
                    ?.id
        }
        return false
    }

    private fun validateTranslations(
        translations: List<org.leargon.backend.model.LocalizedText>?,
        requireDefault: Boolean = true
    ) {
        if (translations.isNullOrEmpty()) {
            if (requireDefault) throw IllegalArgumentException("At least one translation is required")
            return
        }

        val defaultLocale =
            localeService.getDefaultLocale()
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
                    "Translation for default locale '${defaultLocale.localeCode}' (${defaultLocale.displayName}) is required"
                )
            }
        }
    }

    private fun createBusinessEntityVersion(
        entity: BusinessEntity,
        changedBy: User,
        changeType: String,
        changeSummary: String
    ) {
        val nextVersion =
            businessEntityVersionRepository
                .findFirstByBusinessEntityIdOrderByVersionNumberDesc(entity.id!!)
                .map { it.versionNumber + 1 }
                .orElse(1)

        val snapshot =
            mapOf(
                "key" to entity.key,
                "dataOwnerUsername" to entity.dataOwner?.username,
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

        // Reconcile per-field verification status against the new values.
        val extractor = this.businessEntityFieldValueExtractor
        val fvs = this.fieldVerificationService
        val owner = entity.effectiveOwner()
        val actorIsOwner = owner != null && owner.id == changedBy.id
        fvs.sync(
            "BUSINESS_ENTITY",
            entity.id!!,
            changedBy,
            actorIsOwner,
            { fn -> extractor.value(entity, fn) },
            extractor.collectionItemValues(entity)
        )
    }

    @Transactional
    open fun setFieldVerification(
        entityKey: String,
        fieldName: String,
        status: String,
        currentUser: User
    ): BusinessEntityResponse {
        val entity = getBusinessEntityByKey(entityKey)
        val owner = entity.effectiveOwner()
        if (owner == null || owner.id != currentUser.id) {
            throw ForbiddenOperationException("Only the data owner can set field verification status")
        }
        val ext = this.businessEntityFieldValueExtractor
        val currentValue = ext.collectionItemValues(entity)[fieldName] ?: runCatching { ext.value(entity, fieldName) }.getOrNull()
        fieldVerificationService.setStatus("BUSINESS_ENTITY", entity.id!!, fieldName, status, currentUser, currentValue)
        return businessEntityMapper.toBusinessEntityResponse(getBusinessEntityByKey(entityKey))
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
        fun checkEditPermission(
            entity: BusinessEntity,
            currentUser: User
        ) {
            val isOwner = entity.effectiveOwner()?.id == currentUser.id
            val isSteward = entity.effectiveSteward()?.id == currentUser.id
            val isAdmin = currentUser.roles.contains("ROLE_ADMIN")
            if (!isOwner && !isSteward && !isAdmin) {
                throw ForbiddenOperationException("Only the data owner, steward, or an admin can edit this entity")
            }
        }

        @JvmStatic
        @Suppress("UNCHECKED_CAST")
        fun calculateDiff(
            previous: Map<String, Any?>,
            current: Map<String, Any?>
        ): List<FieldChange> {
            val changes = mutableListOf<FieldChange>()

            val prevOwner = previous["dataOwnerUsername"]
            val currOwner = current["dataOwnerUsername"]
            if (prevOwner != currOwner) {
                changes.add(FieldChange("dataOwner", prevOwner?.toString(), currOwner?.toString()))
            }

            val prevNames = (previous["names"] as? List<Map<*, *>>) ?: emptyList()
            val currNames = (current["names"] as? List<Map<*, *>>) ?: emptyList()
            val allNameLocales =
                (prevNames.map { it["locale"]?.toString() } + currNames.map { it["locale"]?.toString() })
                    .filterNotNull()
                    .toSet()
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
            val allDescLocales =
                (prevDescs.map { it["locale"]?.toString() } + currDescs.map { it["locale"]?.toString() })
                    .filterNotNull()
                    .toSet()
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
