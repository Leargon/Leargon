package org.leargon.backend.repository

import io.micronaut.data.annotation.Join
import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.ProcessVersion
import java.util.Optional

@Repository
interface ProcessVersionRepository : JpaRepository<ProcessVersion, Long> {
    @Join(value = "changedBy", type = Join.Type.FETCH)
    @Join(value = "process", type = Join.Type.FETCH)
    override fun findAll(): List<ProcessVersion>

    @Join(value = "changedBy", type = Join.Type.FETCH)
    fun findByProcessIdOrderByVersionNumberDesc(processId: Long): List<ProcessVersion>

    @Join(value = "changedBy", type = Join.Type.FETCH)
    fun findByProcessIdAndVersionNumber(
        processId: Long,
        versionNumber: Int
    ): Optional<ProcessVersion>

    fun findFirstByProcessIdOrderByVersionNumberDesc(processId: Long): Optional<ProcessVersion>
}
