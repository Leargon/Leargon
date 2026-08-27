package org.leargon.backend.mapper

import jakarta.inject.Singleton
import org.leargon.backend.domain.ContextRelationship
import org.leargon.backend.model.ContextMapperRelationshipType
import org.leargon.backend.model.ContextRelationshipResponse
import org.leargon.backend.service.DefaultLocaleProvider
import java.time.ZoneOffset

@Singleton
open class ContextRelationshipMapper(
    private val defaultLocaleProvider: DefaultLocaleProvider
) {
    fun toResponse(rel: ContextRelationship): ContextRelationshipResponse {
        val defaultLocale = defaultLocaleProvider.code()
        val response =
            ContextRelationshipResponse(
                rel.id,
                ContextMapperRelationshipType.fromValue(rel.relationshipType)
            )
        response.upstreamBoundedContext = BoundedContextMapper.toSummaryResponse(rel.upstreamBoundedContext, defaultLocale)
        response.downstreamBoundedContext = BoundedContextMapper.toSummaryResponse(rel.downstreamBoundedContext, defaultLocale)
        response.upstreamRole = LocalizedTextMapper.toModel(rel.upstreamRole)
        response.downstreamRole = LocalizedTextMapper.toModel(rel.downstreamRole)
        response.description = LocalizedTextMapper.toModel(rel.description)
        response.createdBy = UserMapper.toUserSummary(rel.createdBy)
        response.createdAt = rel.createdAt?.atZone(ZoneOffset.UTC)
        response.updatedAt = rel.updatedAt?.atZone(ZoneOffset.UTC)
        return response
    }
}
