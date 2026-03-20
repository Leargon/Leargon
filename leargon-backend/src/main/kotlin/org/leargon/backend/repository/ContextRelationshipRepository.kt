package org.leargon.backend.repository

import io.micronaut.data.annotation.Join
import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.ContextRelationship

@Repository
interface ContextRelationshipRepository : JpaRepository<ContextRelationship, Long> {

    @Join(value = "upstreamBoundedContext", type = Join.Type.LEFT_FETCH)
    @Join(value = "upstreamBoundedContext.domain", type = Join.Type.LEFT_FETCH)
    @Join(value = "downstreamBoundedContext", type = Join.Type.LEFT_FETCH)
    @Join(value = "downstreamBoundedContext.domain", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.LEFT_FETCH)
    override fun findAll(): List<ContextRelationship>

    @Join(value = "upstreamBoundedContext", type = Join.Type.LEFT_FETCH)
    @Join(value = "upstreamBoundedContext.domain", type = Join.Type.LEFT_FETCH)
    @Join(value = "downstreamBoundedContext", type = Join.Type.LEFT_FETCH)
    @Join(value = "downstreamBoundedContext.domain", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.LEFT_FETCH)
    fun findByUpstreamBoundedContextKey(key: String): List<ContextRelationship>

    @Join(value = "upstreamBoundedContext", type = Join.Type.LEFT_FETCH)
    @Join(value = "upstreamBoundedContext.domain", type = Join.Type.LEFT_FETCH)
    @Join(value = "downstreamBoundedContext", type = Join.Type.LEFT_FETCH)
    @Join(value = "downstreamBoundedContext.domain", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.LEFT_FETCH)
    fun findByDownstreamBoundedContextKey(key: String): List<ContextRelationship>
}
