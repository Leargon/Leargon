package org.leargon.backend.mapper

import jakarta.inject.Singleton
import org.leargon.backend.domain.Dpia
import org.leargon.backend.model.DpiaListItemResponse
import org.leargon.backend.model.DpiaListItemResponseLinkedResourceType
import org.leargon.backend.model.DpiaResponse
import org.leargon.backend.model.DpiaStatus
import org.leargon.backend.model.ResidualRisk
import java.time.ZoneOffset

@Singleton
open class DpiaMapper {
    fun toDpiaListItemResponse(dpia: Dpia): DpiaListItemResponse {
        val triggeredBy =
            UserMapper.toUserSummary(dpia.triggeredBy)
                ?: throw IllegalStateException("DPIA ${dpia.key} has no triggeredBy user")
        val (resourceType, resourceKey, resourceName) =
            when {
                dpia.process != null ->
                    Triple(
                        DpiaListItemResponseLinkedResourceType.PROCESS,
                        dpia.process!!.key,
                        dpia.process!!
                            .names
                            .find { it.locale == "en" }
                            ?.text
                            ?: dpia.process!!
                                .names
                                .firstOrNull()
                                ?.text
                            ?: dpia.process!!.key
                    )
                dpia.entity != null ->
                    Triple(
                        DpiaListItemResponseLinkedResourceType.BUSINESS_ENTITY,
                        dpia.entity!!.key,
                        dpia.entity!!
                            .names
                            .find { it.locale == "en" }
                            ?.text
                            ?: dpia.entity!!
                                .names
                                .firstOrNull()
                                ?.text
                            ?: dpia.entity!!.key
                    )
                else -> Triple(null, null, null)
            }
        return DpiaListItemResponse(
            dpia.key,
            DpiaStatus.fromValue(dpia.status),
            triggeredBy,
            dpia.createdAt!!.atZone(ZoneOffset.UTC)
        ).residualRisk(dpia.residualRisk?.let { ResidualRisk.fromValue(it) })
            .linkedResourceType(resourceType)
            .linkedResourceKey(resourceKey)
            .linkedResourceName(resourceName)
            .riskDescription(dpia.riskDescription)
            .measures(dpia.measures)
            .fdpicConsultationRequired(dpia.fdpicConsultationRequired)
            .updatedAt(dpia.updatedAt?.atZone(ZoneOffset.UTC))
    }

    fun toDpiaResponse(dpia: Dpia): DpiaResponse {
        val triggeredBy =
            UserMapper.toUserSummary(dpia.triggeredBy)
                ?: throw IllegalStateException("DPIA ${dpia.key} has no triggeredBy user")
        return DpiaResponse(
            dpia.key,
            DpiaStatus.fromValue(dpia.status),
            triggeredBy,
            dpia.createdAt!!.atZone(ZoneOffset.UTC)
        ).riskDescription(dpia.riskDescription)
            .measures(dpia.measures)
            .residualRisk(dpia.residualRisk?.let { ResidualRisk.fromValue(it) })
            .fdpicConsultationRequired(dpia.fdpicConsultationRequired)
            .fdpicConsultationCompleted(dpia.fdpicConsultationCompleted)
            .fdpicConsultationDate(dpia.fdpicConsultationDate)
            .fdpicConsultationOutcome(dpia.fdpicConsultationOutcome)
            .updatedAt(dpia.updatedAt?.atZone(ZoneOffset.UTC))
    }
}
