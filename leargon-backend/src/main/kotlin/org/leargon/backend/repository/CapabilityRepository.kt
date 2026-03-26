package org.leargon.backend.repository

import io.micronaut.data.annotation.Join
import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.Capability
import java.util.Optional

@Repository
interface CapabilityRepository : JpaRepository<Capability, Long> {
    @Join(value = "parent", type = Join.Type.LEFT_FETCH)
    @Join(value = "children", type = Join.Type.LEFT_FETCH)
    @Join(value = "owningUnit", type = Join.Type.LEFT_FETCH)
    @Join(value = "linkedProcesses", type = Join.Type.LEFT_FETCH)
    override fun findAll(): List<Capability>

    @Join(value = "parent", type = Join.Type.LEFT_FETCH)
    @Join(value = "children", type = Join.Type.LEFT_FETCH)
    @Join(value = "owningUnit", type = Join.Type.LEFT_FETCH)
    @Join(value = "linkedProcesses", type = Join.Type.LEFT_FETCH)
    fun findByKey(key: String): Optional<Capability>

    fun existsByKey(key: String): Boolean

    fun findByLinkedProcessesKey(processKey: String): List<Capability>
}
