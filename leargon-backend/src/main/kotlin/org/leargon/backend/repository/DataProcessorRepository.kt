package org.leargon.backend.repository

import io.micronaut.data.annotation.Join
import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.DataProcessor
import java.util.Optional

@Repository
interface DataProcessorRepository : JpaRepository<DataProcessor, Long> {

    @Join(value = "linkedBusinessEntities", type = Join.Type.LEFT_FETCH)
    @Join(value = "linkedProcesses", type = Join.Type.LEFT_FETCH)
    fun findByKey(key: String): Optional<DataProcessor>

    @Join(value = "linkedBusinessEntities", type = Join.Type.LEFT_FETCH)
    @Join(value = "linkedProcesses", type = Join.Type.LEFT_FETCH)
    override fun findAll(): List<DataProcessor>

    fun existsByKey(key: String): Boolean

    fun findByLinkedBusinessEntitiesKey(entityKey: String): List<DataProcessor>

    fun findByLinkedProcessesKey(processKey: String): List<DataProcessor>
}
