package org.leargon.backend.repository

import io.micronaut.data.annotation.Join
import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.FieldVerification
import java.util.Optional

@Repository
interface FieldVerificationRepository : JpaRepository<FieldVerification, Long> {
    @Join(value = "updatedBy", type = Join.Type.LEFT_FETCH)
    fun findByEntityTypeAndEntityId(
        entityType: String,
        entityId: Long
    ): List<FieldVerification>

    fun findByEntityTypeAndEntityIdAndFieldName(
        entityType: String,
        entityId: Long,
        fieldName: String
    ): Optional<FieldVerification>

    fun deleteByEntityTypeAndEntityId(
        entityType: String,
        entityId: Long
    )
}
