package org.leargon.backend.repository

import io.micronaut.data.annotation.Join
import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.DomainEvent
import java.util.Optional

@Repository
interface DomainEventRepository : JpaRepository<DomainEvent, Long> {
    @Join(value = "publishingBoundedContext", type = Join.Type.LEFT_FETCH)
    @Join(value = "publishingBoundedContext.domain", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.LEFT_FETCH)
    override fun findAll(): List<DomainEvent>

    @Join(value = "publishingBoundedContext", type = Join.Type.LEFT_FETCH)
    @Join(value = "publishingBoundedContext.domain", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.LEFT_FETCH)
    fun findByKey(key: String): Optional<DomainEvent>

    @Join(value = "publishingBoundedContext", type = Join.Type.LEFT_FETCH)
    @Join(value = "publishingBoundedContext.domain", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.LEFT_FETCH)
    override fun findById(id: Long): Optional<DomainEvent>

    fun findByPublishingBoundedContextKey(key: String): List<DomainEvent>

    fun deleteByPublishingBoundedContextId(boundedContextId: Long)
}
