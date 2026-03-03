package org.leargon.backend.repository

import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.ProcessFlow

@Repository
interface ProcessFlowRepository : JpaRepository<ProcessFlow, Long> {

    fun findByProcessId(processId: Long): List<ProcessFlow>

    fun deleteByProcessId(processId: Long)
}
