package org.leargon.backend.repository

import io.micronaut.data.annotation.Join
import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.DomainEventProcessLink

@Repository
interface DomainEventProcessLinkRepository : JpaRepository<DomainEventProcessLink, Long> {
    @Join(value = "process", type = Join.Type.LEFT_FETCH)
    @Join(value = "event", type = Join.Type.LEFT_FETCH)
    fun findByEventId(eventId: Long): List<DomainEventProcessLink>

    fun deleteByEventId(eventId: Long)
}
