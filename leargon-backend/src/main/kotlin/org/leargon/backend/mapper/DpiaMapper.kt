package org.leargon.backend.mapper

import jakarta.inject.Singleton
import org.leargon.backend.domain.Dpia
import org.leargon.backend.domain.LocalizedText
import org.leargon.backend.domain.textForLocale
import org.leargon.backend.model.DpiaListItemResponse
import org.leargon.backend.model.DpiaListItemResponseLinkedResourceType
import org.leargon.backend.model.DpiaResponse
import org.leargon.backend.model.DpiaStatus
import org.leargon.backend.model.ResidualRisk
import org.leargon.backend.service.DefaultLocaleProvider
import java.time.ZoneOffset

@Singleton
open class DpiaMapper(
    private val defaultLocaleProvider: DefaultLocaleProvider
) {
    fun toDpiaListItemResponse(dpia: Dpia): DpiaListItemResponse {
        val defaultLocale = defaultLocaleProvider.code()
        val triggeredBy =
            UserMapper.toUserSummary(dpia.triggeredBy)
                ?: throw IllegalStateException("DPIA ${dpia.key} has no triggeredBy user")
        val linked: Triple<DpiaListItemResponseLinkedResourceType?, String?, List<LocalizedText>> =
            when {
                dpia.process != null -> {
                    Triple(DpiaListItemResponseLinkedResourceType.PROCESS, dpia.process!!.key, dpia.process!!.names)
                }

                dpia.entity != null -> {
                    Triple(DpiaListItemResponseLinkedResourceType.BUSINESS_ENTITY, dpia.entity!!.key, dpia.entity!!.names)
                }

                else -> {
                    Triple(null, null, emptyList())
                }
            }
        val (resourceType, resourceKey, resourceNames) = linked
        val resourceName = resourceKey?.let { resourceNames.textForLocale(defaultLocale, it) }
        return DpiaListItemResponse(
            dpia.key,
            DpiaStatus.fromValue(dpia.status),
            triggeredBy,
            dpia.createdAt!!.atZone(ZoneOffset.UTC)
        ).residualRisk(dpia.residualRisk?.let { ResidualRisk.fromValue(it) })
            .linkedResourceType(resourceType)
            .linkedResourceKey(resourceKey)
            .linkedResourceName(resourceName)
            .linkedResourceNames(LocalizedTextMapper.toModel(resourceNames))
            .riskDescription(LocalizedTextMapper.toModel(dpia.riskDescription))
            .measures(LocalizedTextMapper.toModel(dpia.measures))
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
        ).riskDescription(LocalizedTextMapper.toModel(dpia.riskDescription))
            .measures(LocalizedTextMapper.toModel(dpia.measures))
            .initialRisk(dpia.initialRisk?.let { ResidualRisk.fromValue(it) })
            .residualRisk(dpia.residualRisk?.let { ResidualRisk.fromValue(it) })
            .fdpicConsultationRequired(dpia.fdpicConsultationRequired)
            .fdpicConsultationCompleted(dpia.fdpicConsultationCompleted)
            .fdpicConsultationDate(dpia.fdpicConsultationDate)
            .fdpicConsultationOutcome(LocalizedTextMapper.toModel(dpia.fdpicConsultationOutcome))
            .updatedAt(dpia.updatedAt?.atZone(ZoneOffset.UTC))
    }
}
