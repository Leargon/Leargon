package org.leargon.backend.repository

import io.micronaut.data.annotation.Join
import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.DomainEventEntityLink

@Repository
interface DomainEventEntityLinkRepository : JpaRepository<DomainEventEntityLink, Long> {
    @Join(value = "entity", type = Join.Type.LEFT_FETCH)
    @Join(value = "event", type = Join.Type.LEFT_FETCH)
    fun findByEventId(eventId: Long): List<DomainEventEntityLink>

    fun deleteByEventId(eventId: Long)

    fun deleteByEntityId(entityId: Long)
}
