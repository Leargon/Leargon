package org.leargon.backend.repository

import io.micronaut.data.annotation.Join
import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.ItSystem

@Repository
interface ItSystemRepository : JpaRepository<ItSystem, Long> {
    @Join(value = "linkedProcesses", type = Join.Type.LEFT_FETCH)
    @Join(value = "owningUnit", type = Join.Type.LEFT_FETCH)
    override fun findAll(): List<ItSystem>

    @Join(value = "linkedProcesses", type = Join.Type.LEFT_FETCH)
    @Join(value = "owningUnit", type = Join.Type.LEFT_FETCH)
    fun findByKey(key: String): ItSystem?

    fun existsByKey(key: String): Boolean

    fun findByLinkedProcessesKey(processKey: String): List<ItSystem>
}
