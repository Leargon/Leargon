package org.leargon.backend.mapper

import jakarta.inject.Singleton
import org.leargon.backend.domain.BusinessEntity
import org.leargon.backend.domain.TranslationLink
import org.leargon.backend.model.TranslationLinkResponse
import java.time.ZoneOffset

@Singleton
open class TranslationLinkMapper {

    fun toResponse(link: TranslationLink, perspectiveEntity: BusinessEntity): TranslationLinkResponse {
        val linkedEntity = if (link.firstEntity?.id == perspectiveEntity.id) link.secondEntity else link.firstEntity
        val response = TranslationLinkResponse(
            link.id,
            BusinessEntityMapper.toBusinessEntitySummaryResponse(linkedEntity),
            link.createdAt?.atZone(ZoneOffset.UTC),
            link.updatedAt?.atZone(ZoneOffset.UTC)
        )
        response.semanticDifferenceNote = link.semanticDifferenceNote
        response.createdBy = UserMapper.toUserSummary(link.createdBy)
        return response
    }
}
