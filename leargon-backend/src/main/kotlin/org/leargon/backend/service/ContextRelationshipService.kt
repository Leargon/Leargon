package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.ContextRelationship
import org.leargon.backend.domain.User
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
    private val boundedContextService: BoundedContextService
) {

    @Transactional
    open fun getAll(): List<ContextRelationshipResponse> {
        val mapper = contextRelationshipMapper
        return contextRelationshipRepository.findAll().map { mapper.toResponse(it) }
    }

    @Transactional
    open fun create(request: CreateContextRelationshipRequest, currentUser: User): ContextRelationshipResponse {
        val upstream = boundedContextService.getByKey(request.upstreamBoundedContextKey)
        val downstream = boundedContextService.getByKey(request.downstreamBoundedContextKey)
        val rel = ContextRelationship().apply {
            this.upstreamBoundedContext = upstream
            this.downstreamBoundedContext = downstream
            this.relationshipType = request.relationshipType.value
            this.upstreamRole = request.upstreamRole
            this.downstreamRole = request.downstreamRole
            this.description = request.description
            this.createdBy = currentUser
        }
        val saved = contextRelationshipRepository.save(rel)
        val mapper = contextRelationshipMapper
        return mapper.toResponse(saved)
    }

    @Transactional
    open fun update(id: Long, request: UpdateContextRelationshipRequest): ContextRelationshipResponse {
        val rel = contextRelationshipRepository.findById(id)
            .orElseThrow { ResourceNotFoundException("Context relationship not found: $id") }
        rel.relationshipType = request.relationshipType.value
        rel.upstreamRole = request.upstreamRole
        rel.downstreamRole = request.downstreamRole
        rel.description = request.description
        val updated = contextRelationshipRepository.update(rel)
        val mapper = contextRelationshipMapper
        return mapper.toResponse(updated)
    }

    @Transactional
    open fun delete(id: Long) {
        if (!contextRelationshipRepository.existsById(id)) {
            throw ResourceNotFoundException("Context relationship not found: $id")
        }
        contextRelationshipRepository.deleteById(id)
    }

    @Transactional
    open fun getForBoundedContext(boundedContextKey: String): List<ContextRelationshipResponse> {
        val mapper = contextRelationshipMapper
        val upstream = contextRelationshipRepository.findByUpstreamBoundedContextKey(boundedContextKey)
        val downstream = contextRelationshipRepository.findByDownstreamBoundedContextKey(boundedContextKey)
        return (upstream + downstream).map { mapper.toResponse(it) }
    }
}
