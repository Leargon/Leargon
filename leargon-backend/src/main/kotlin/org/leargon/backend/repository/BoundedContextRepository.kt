package org.leargon.backend.repository

import io.micronaut.data.annotation.Join
import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.BoundedContext
import java.util.Optional

@Repository
interface BoundedContextRepository : JpaRepository<BoundedContext, Long> {
    @Join(value = "domain", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.LEFT_FETCH)
    @Join(value = "owningUnit", type = Join.Type.LEFT_FETCH)
    override fun findAll(): List<BoundedContext>

    @Join(value = "domain", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.LEFT_FETCH)
    @Join(value = "owningUnit", type = Join.Type.LEFT_FETCH)
    fun findByDomainKey(key: String): List<BoundedContext>

    @Join(value = "domain", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.LEFT_FETCH)
    @Join(value = "owningUnit", type = Join.Type.LEFT_FETCH)
    fun findByKey(key: String): Optional<BoundedContext>

    @Join(value = "domain", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.LEFT_FETCH)
    @Join(value = "owningUnit", type = Join.Type.LEFT_FETCH)
    override fun findById(id: Long): Optional<BoundedContext>

    @Join(value = "domain", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.LEFT_FETCH)
    @Join(value = "owningUnit", type = Join.Type.LEFT_FETCH)
    fun findByOwningUnitKey(key: String): List<BoundedContext>

    fun existsByKey(key: String): Boolean

    fun countByDomainId(domainId: Long): Long

    fun deleteByDomainId(domainId: Long)
}
