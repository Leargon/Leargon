package org.leargon.backend.repository

import io.micronaut.data.annotation.Join
import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.TeamInteraction
import java.util.Optional

@Repository
interface TeamInteractionRepository : JpaRepository<TeamInteraction, Long> {
    @Join(value = "sourceUnit", type = Join.Type.LEFT_FETCH)
    @Join(value = "targetUnit", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.LEFT_FETCH)
    override fun findAll(): List<TeamInteraction>

    @Join(value = "sourceUnit", type = Join.Type.LEFT_FETCH)
    @Join(value = "targetUnit", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.LEFT_FETCH)
    override fun findById(id: Long): Optional<TeamInteraction>

    @Join(value = "sourceUnit", type = Join.Type.LEFT_FETCH)
    @Join(value = "targetUnit", type = Join.Type.LEFT_FETCH)
    fun findBySourceUnitIdOrTargetUnitId(
        sourceUnitId: Long,
        targetUnitId: Long
    ): List<TeamInteraction>

    fun existsBySourceUnitIdAndTargetUnitId(
        sourceUnitId: Long,
        targetUnitId: Long
    ): Boolean

    fun deleteBySourceUnitIdOrTargetUnitId(
        sourceUnitId: Long,
        targetUnitId: Long
    )
}
