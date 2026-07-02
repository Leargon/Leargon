package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.ContextRelationship
import org.leargon.backend.domain.LocalizedText
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ForbiddenOperationException
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.mapper.ContextRelationshipMapper
import org.leargon.backend.model.ContextRelationshipResponse
import org.leargon.backend.model.CreateContextRelationshipRequest
import org.leargon.backend.model.UpdateContextRelationshipRequest
import org.leargon.backend.repository.ContextRelationshipRepository

@Singleton
open class ContextRelationshipService(
    private val contextRelationshipRepository: ContextRelationshipRepository,
    private val contextRelationshipMapper: ContextRelationshipMapper,
    private val boundedContextService: BoundedContextService,
    private val businessDomainService: BusinessDomainService,
    private val roleService: RoleService
) {
    /**
     * Managing a context relationship requires an admin, a DDD editor/lead, or the owner/steward of one of
     * the linked domains (a relationship can span two domains — either domain's owner may manage it).
     */
    private fun requireManage(
        domainKeys: List<String>,
        currentUser: User
    ) {
        if (roleService.isEditorFor(currentUser, "DDD")) return
        if (domainKeys.any { businessDomainService.canEditDomain(it, currentUser) }) return
        throw ForbiddenOperationException(
            "Managing a context relationship requires an admin, a DDD editor/lead, or the owner/steward of a linked domain"
        )
    }

    /**
     * Re-version the domains owning the two endpoint bounded contexts so their per-item verification
     * status (`contextRelationship.<id>`) is reconciled. A relationship may span two domains.
     */
    private fun domainKeysOf(rel: ContextRelationship): List<String> =
        listOfNotNull(
            rel.upstreamBoundedContext?.domain?.key,
            rel.downstreamBoundedContext?.domain?.key
        ).distinct()

    private fun reVersionDomains(
        domainKeys: List<String>,
        currentUser: User,
        summary: String
    ) {
        val svc = businessDomainService
        domainKeys.forEach { svc.recordVersion(it, currentUser, "UPDATE", summary) }
    }

    @Transactional
    open fun getAll(): List<ContextRelationshipResponse> {
        val mapper = contextRelationshipMapper
        return contextRelationshipRepository.findAll().map { mapper.toResponse(it) }
    }

    @Transactional
    open fun create(
        request: CreateContextRelationshipRequest,
        currentUser: User
    ): ContextRelationshipResponse {
        val upstream = boundedContextService.getByKey(request.upstreamBoundedContextKey)
        val downstream = boundedContextService.getByKey(request.downstreamBoundedContextKey)
        requireManage(listOfNotNull(upstream.domain?.key, downstream.domain?.key).distinct(), currentUser)
        val rel =
            ContextRelationship().apply {
                this.upstreamBoundedContext = upstream
                this.downstreamBoundedContext = downstream
                this.relationshipType = request.relationshipType.value
                this.upstreamRole = request.upstreamRole?.map { LocalizedText(it.locale, it.text) }?.toMutableList() ?: mutableListOf()
                this.downstreamRole = request.downstreamRole?.map { LocalizedText(it.locale, it.text) }?.toMutableList() ?: mutableListOf()
                this.description = request.description?.map { LocalizedText(it.locale, it.text) }?.toMutableList() ?: mutableListOf()
                this.createdBy = currentUser
            }
        val saved = contextRelationshipRepository.save(rel)
        reVersionDomains(domainKeysOf(saved), currentUser, "Added context relationship #${saved.id}")
        val mapper = contextRelationshipMapper
        return mapper.toResponse(saved)
    }

    @Transactional
    open fun update(
        id: Long,
        request: UpdateContextRelationshipRequest,
        currentUser: User
    ): ContextRelationshipResponse {
        val rel =
            contextRelationshipRepository
                .findById(id)
                .orElseThrow { ResourceNotFoundException("Context relationship not found: $id") }
        requireManage(domainKeysOf(rel), currentUser)
        rel.relationshipType = request.relationshipType.value
        rel.upstreamRole = request.upstreamRole?.map { LocalizedText(it.locale, it.text) }?.toMutableList() ?: mutableListOf()
        rel.downstreamRole = request.downstreamRole?.map { LocalizedText(it.locale, it.text) }?.toMutableList() ?: mutableListOf()
        rel.description = request.description?.map { LocalizedText(it.locale, it.text) }?.toMutableList() ?: mutableListOf()
        val updated = contextRelationshipRepository.update(rel)
        reVersionDomains(domainKeysOf(updated), currentUser, "Updated context relationship #$id")
        val mapper = contextRelationshipMapper
        return mapper.toResponse(updated)
    }

    @Transactional
    open fun delete(
        id: Long,
        currentUser: User
    ) {
        val rel =
            contextRelationshipRepository
                .findById(id)
                .orElseThrow { ResourceNotFoundException("Context relationship not found: $id") }
        // Capture the owning domains before the row is gone, delete, THEN reconcile so the now-missing
        // item's status row is removed (delete-on-missing only fires once the relationship is gone).
        val domainKeys = domainKeysOf(rel)
        requireManage(domainKeys, currentUser)
        contextRelationshipRepository.deleteById(id)
        reVersionDomains(domainKeys, currentUser, "Deleted context relationship #$id")
    }

    @Transactional
    open fun getForBoundedContext(boundedContextKey: String): List<ContextRelationshipResponse> {
        val mapper = contextRelationshipMapper
        val upstream = contextRelationshipRepository.findByUpstreamBoundedContextKey(boundedContextKey)
        val downstream = contextRelationshipRepository.findByDownstreamBoundedContextKey(boundedContextKey)
        return (upstream + downstream).map { mapper.toResponse(it) }
    }
}
