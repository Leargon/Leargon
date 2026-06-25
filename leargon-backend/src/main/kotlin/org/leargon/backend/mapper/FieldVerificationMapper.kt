package org.leargon.backend.mapper

import org.leargon.backend.domain.FieldVerification
import org.leargon.backend.model.FieldVerificationResponse
import org.leargon.backend.model.FieldVerificationResponseStatus
import java.time.Instant
import java.time.ZoneOffset

object FieldVerificationMapper {
    @JvmStatic
    fun toResponse(fv: FieldVerification): FieldVerificationResponse =
        FieldVerificationResponse(
            fv.fieldName,
            FieldVerificationResponseStatus.fromValue(fv.status),
            fv.updatedByUsername,
            (fv.updatedAt ?: Instant.now()).atZone(ZoneOffset.UTC)
        ).updatedBy(UserMapper.toUserSummary(fv.updatedBy))

    /** Null (not empty) when there are no statuses yet, matching the nullable response field. */
    @JvmStatic
    fun toResponses(list: List<FieldVerification>): List<FieldVerificationResponse>? =
        if (list.isEmpty()) null else list.map { toResponse(it) }
}
