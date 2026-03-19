package org.leargon.backend.repository

import io.micronaut.data.annotation.Join
import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.ContextRelationship

@Repository
interface ContextRelationshipRepository : JpaRepository<ContextRelationship, Long> {

    @Join(value = "upstreamDomain", type = Join.Type.LEFT_FETCH)
    @Join(value = "downstreamDomain", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.LEFT_FETCH)
    override fun findAll(): List<ContextRelationship>

    @Join(value = "upstreamDomain", type = Join.Type.LEFT_FETCH)
    @Join(value = "downstreamDomain", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.LEFT_FETCH)
    fun findByUpstreamDomainKey(key: String): List<ContextRelationship>

    @Join(value = "upstreamDomain", type = Join.Type.LEFT_FETCH)
    @Join(value = "downstreamDomain", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.LEFT_FETCH)
    fun findByDownstreamDomainKey(key: String): List<ContextRelationship>
}
