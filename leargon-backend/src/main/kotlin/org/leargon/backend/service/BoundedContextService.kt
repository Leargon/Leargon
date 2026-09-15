package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.BoundedContext
import org.leargon.backend.domain.BusinessDomain
import org.leargon.backend.domain.LocalizedText
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ForbiddenOperationException
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.mapper.BoundedContextMapper
import org.leargon.backend.model.BoundedContextResponse
import org.leargon.backend.model.CreateBoundedContextRequest
import org.leargon.backend.model.UpdateBoundedContextDescriptionsRequest
import org.leargon.backend.model.UpdateBoundedContextNamesRequest
import org.leargon.backend.model.UpdateBoundedContextOwningTeamRequest
import org.leargon.backend.repository.BoundedContextRepository
import org.leargon.backend.repository.BusinessDomainRepository
import org.leargon.backend.repository.DomainEventRepository
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.UserRepository
import org.leargon.backend.util.KeyAllocator
import org.leargon.backend.util.SlugUtil

@Singleton
open class BoundedContextService(
    private val boundedContextRepository: BoundedContextRepository,
    private val businessDomainRepository: BusinessDomainRepository,
    private val domainEventRepository: DomainEventRepository,
    private val organisationalUnitRepository: OrganisationalUnitRepository,
    private val userRepository: UserRepository,
    private val duplicateCandidateService: DuplicateCandidateService,
    private val localeService: LocaleService,
    private val boundedContextMapper: BoundedContextMapper
) {
    open fun getByKey(key: String): BoundedContext =
        boundedContextRepository
            .findByKey(key)
            .orElseThrow { ResourceNotFoundException("BoundedContext not found: $key") }

    @Transactional
    open fun getByKeyAsResponse(key: String): BoundedContextResponse = boundedContextMapper.toResponse(getByKey(key))

    @Transactional
    open fun getForDomain(domainKey: String): List<BoundedContextResponse> {
        if (!businessDomainRepository.findByKey(domainKey).isPresent) {
            throw ResourceNotFoundException("BusinessDomain not found: $domainKey")
        }
        val mapper = boundedContextMapper
        return boundedContextRepository.findByDomainKey(domainKey).map { mapper.toResponse(it) }
    }

    @Transactional
    open fun create(
        domainKey: String,
        request: CreateBoundedContextRequest,
        currentUser: User
    ): BoundedContext {
        val domain =
            businessDomainRepository
                .findByKey(domainKey)
                .orElseThrow { ResourceNotFoundException("BusinessDomain not found: $domainKey") }

        if (domain.type == "BUSINESS") {
            throw ForbiddenOperationException(
                "Bounded contexts can only be created for CORE, SUPPORTING, or GENERIC domains, not BUSINESS domains",
            )
        }

        val bc = BoundedContext()
        bc.domain = domain
        bc.createdBy = currentUser
        bc.names = request.names.map { LocalizedText(it.locale, it.text) }.toMutableList()
        if (request.descriptions != null) {
            bc.descriptions = request.descriptions!!.map { LocalizedText(it.locale, it.text) }.toMutableList()
        }
        if (request.contextType != null) {
            bc.contextType = request.contextType!!.value
        }

        val defaultLocale = localeService.getDefaultLocale()
        val defaultName = bc.names.find { it.locale == defaultLocale?.localeCode }?.text
        val slug = SlugUtil.slugify(defaultName)
        val repo = boundedContextRepository
        bc.key = KeyAllocator.allocate("$domainKey.$slug") { repo.findByKey(it).isPresent }

        if (request.owningTeamKey != null) {
            val unitKey = request.owningTeamKey!!
            val owningUnit =
                organisationalUnitRepository
                    .findByKey(unitKey)
                    .orElseThrow { ResourceNotFoundException("OrganisationalUnit not found: $unitKey") }
            bc.owningUnit = owningUnit
        }

        if (request.ownerUsername != null) {
            bc.owner = findUser(request.ownerUsername!!)
        }

        duplicateCandidateService.requireNoUnjustifiedDuplicates(
            CreationTarget(CreationPolicyService.BOUNDED_CONTEXT, domainKey = domainKey),
            bc.names.map { it.text },
            request.duplicateJustification,
            request.acknowledgedDuplicateKeys
        )
        return boundedContextRepository.save(bc)
    }

    /**
     * Whether [currentUser] may (re)assign the explicit owner of the bounded context: admin, its current
     * effective owner (hand-over), or a member of the domain realm (delegation).
     */
    @Transactional
    open fun canAssignOwner(
        key: String,
        currentUser: User
    ): Boolean {
        if (currentUser.roles.contains("ROLE_ADMIN")) return true
        val uid = currentUser.id ?: return false
        return getByKey(key).realmOwners().any { it.id == uid }
    }

    /** The bounded context's effective owner (or an admin) may edit it — it is their item. */
    @Transactional
    open fun canEdit(
        key: String,
        currentUser: User
    ): Boolean {
        if (currentUser.roles.contains("ROLE_ADMIN")) return true
        val uid = currentUser.id ?: return false
        return getByKey(key).effectiveOwner()?.id == uid
    }

    /** Fields of the bounded context [currentUser] may edit — mirrors the controller's enforcement. */
    @Transactional
    open fun editableFields(
        key: String,
        currentUser: User,
        isDddEditor: Boolean
    ): List<String> {
        val fields = mutableListOf<String>()
        if (isDddEditor || canEdit(key, currentUser)) fields += listOf("names", "descriptions", "owningTeam")
        if (isDddEditor || canAssignOwner(key, currentUser)) fields += "owner"
        return fields
    }

    @Transactional
    open fun updateOwner(
        key: String,
        ownerUsername: String?,
        currentUser: User
    ): BoundedContextResponse {
        val bc = getByKey(key)
        bc.owner = ownerUsername?.let { findUser(it) }
        val updated = boundedContextRepository.update(bc)
        val mapper = boundedContextMapper
        return mapper.toResponse(updated)
    }

    private fun findUser(username: String): User =
        userRepository
            .findByUsername(username)
            .orElseThrow { ResourceNotFoundException("User not found: $username") }

    @Transactional
    open fun createDefaultForDomain(
        domain: BusinessDomain,
        currentUser: User
    ): BoundedContext? {
        if (domain.type == "BUSINESS") return null
        val bc = BoundedContext()
        bc.domain = domain
        bc.createdBy = currentUser
        bc.names = mutableListOf()
        bc.key = "${domain.key}.default"
        return boundedContextRepository.save(bc)
    }

    @Transactional
    open fun updateNames(
        key: String,
        request: UpdateBoundedContextNamesRequest,
        currentUser: User
    ): BoundedContextResponse {
        val bc = getByKey(key)
        bc.names = request.names.map { LocalizedText(it.locale, it.text) }.toMutableList()
        val updated = boundedContextRepository.update(bc)
        val mapper = boundedContextMapper
        return mapper.toResponse(updated)
    }

    @Transactional
    open fun updateDescriptions(
        key: String,
        request: UpdateBoundedContextDescriptionsRequest,
        currentUser: User
    ): BoundedContextResponse {
        val bc = getByKey(key)
        bc.descriptions = (request.descriptions ?: emptyList()).map { LocalizedText(it.locale, it.text) }.toMutableList()
        val updated = boundedContextRepository.update(bc)
        val mapper = boundedContextMapper
        return mapper.toResponse(updated)
    }

    @Transactional
    open fun updateOwningTeam(
        key: String,
        request: UpdateBoundedContextOwningTeamRequest,
        currentUser: User
    ): BoundedContextResponse {
        val bc = getByKey(key)
        if (request.owningTeamKey != null) {
            val unitKey = request.owningTeamKey!!
            val owningUnit =
                organisationalUnitRepository
                    .findByKey(unitKey)
                    .orElseThrow { ResourceNotFoundException("OrganisationalUnit not found: $unitKey") }
            bc.owningUnit = owningUnit
        } else {
            bc.owningUnit = null
        }
        val updated = boundedContextRepository.update(bc)
        val mapper = boundedContextMapper
        return mapper.toResponse(updated)
    }

    @Transactional
    open fun delete(
        key: String,
        currentUser: User
    ) {
        val bc = getByKey(key)
        if (!currentUser.roles.contains("ROLE_ADMIN")) {
            throw ForbiddenOperationException("Only admins can delete bounded contexts")
        }
        domainEventRepository.deleteByPublishingBoundedContextId(bc.id!!)
        boundedContextRepository.delete(bc)
    }
}
