package org.leargon.backend.repository

import io.micronaut.data.annotation.Join
import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.Process
import java.util.Optional

@Repository
interface ProcessRepository : JpaRepository<Process, Long> {

    @Join(value = "processOwner", type = Join.Type.FETCH)
    @Join(value = "createdBy", type = Join.Type.FETCH)
    @Join(value = "boundedContext", type = Join.Type.LEFT_FETCH)
    @Join(value = "boundedContext.domain", type = Join.Type.LEFT_FETCH)
    @Join(value = "inputEntities", type = Join.Type.LEFT_FETCH)
    @Join(value = "outputEntities", type = Join.Type.LEFT_FETCH)
    @Join(value = "executingUnits", type = Join.Type.LEFT_FETCH)
    @Join(value = "parent", type = Join.Type.LEFT_FETCH)
    @Join(value = "children", type = Join.Type.LEFT_FETCH)
    @Join(value = "dataProcessors", type = Join.Type.LEFT_FETCH)
    override fun findAll(): List<Process>

    @Join(value = "processOwner", type = Join.Type.FETCH)
    @Join(value = "createdBy", type = Join.Type.FETCH)
    @Join(value = "boundedContext", type = Join.Type.LEFT_FETCH)
    @Join(value = "boundedContext.domain", type = Join.Type.LEFT_FETCH)
    @Join(value = "inputEntities", type = Join.Type.LEFT_FETCH)
    @Join(value = "outputEntities", type = Join.Type.LEFT_FETCH)
    @Join(value = "executingUnits", type = Join.Type.LEFT_FETCH)
    @Join(value = "parent", type = Join.Type.LEFT_FETCH)
    @Join(value = "children", type = Join.Type.LEFT_FETCH)
    @Join(value = "dataProcessors", type = Join.Type.LEFT_FETCH)
    fun findByKey(key: String): Optional<Process>

    @Join(value = "children", type = Join.Type.LEFT_FETCH)
    fun findByParentIsNull(): List<Process>

    fun findByProcessOwnerId(processOwnerId: Long): List<Process>

    fun findByExecutingUnitsId(organisationalUnitId: Long): List<Process>
}
