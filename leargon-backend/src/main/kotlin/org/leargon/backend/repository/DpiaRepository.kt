package org.leargon.backend.repository

import io.micronaut.data.annotation.Join
import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.Dpia
import java.util.Optional

@Repository
interface DpiaRepository : JpaRepository<Dpia, Long> {

    @Join(value = "process", type = Join.Type.LEFT_FETCH)
    @Join(value = "entity", type = Join.Type.LEFT_FETCH)
    @Join(value = "triggeredBy", type = Join.Type.LEFT_FETCH)
    fun findByKey(key: String): Optional<Dpia>

    @Join(value = "process", type = Join.Type.LEFT_FETCH)
    @Join(value = "entity", type = Join.Type.LEFT_FETCH)
    @Join(value = "triggeredBy", type = Join.Type.LEFT_FETCH)
    fun findByProcessId(processId: Long): Optional<Dpia>

    @Join(value = "process", type = Join.Type.LEFT_FETCH)
    @Join(value = "entity", type = Join.Type.LEFT_FETCH)
    @Join(value = "triggeredBy", type = Join.Type.LEFT_FETCH)
    fun findByEntityId(entityId: Long): Optional<Dpia>

    @Join(value = "process", type = Join.Type.LEFT_FETCH)
    @Join(value = "entity", type = Join.Type.LEFT_FETCH)
    @Join(value = "triggeredBy", type = Join.Type.LEFT_FETCH)
    override fun findAll(): List<Dpia>
}
