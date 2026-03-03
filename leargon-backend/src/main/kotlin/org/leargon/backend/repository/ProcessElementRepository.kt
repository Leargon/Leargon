package org.leargon.backend.repository

import io.micronaut.data.annotation.Join
import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.ProcessElement

@Repository
interface ProcessElementRepository : JpaRepository<ProcessElement, Long> {

    @Join(value = "linkedProcess", type = Join.Type.LEFT_FETCH)
    @Join(value = "linkedEntity", type = Join.Type.LEFT_FETCH)
    fun findByProcessIdOrderBySortOrder(processId: Long): List<ProcessElement>

    fun deleteByProcessId(processId: Long)

    fun findByLinkedProcessId(linkedProcessId: Long): List<ProcessElement>
}
