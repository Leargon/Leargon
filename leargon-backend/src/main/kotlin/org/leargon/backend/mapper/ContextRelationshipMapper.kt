package org.leargon.backend.mapper

import jakarta.inject.Singleton
import org.leargon.backend.domain.ContextRelationship
import org.leargon.backend.model.ContextMapperRelationshipType
import org.leargon.backend.model.ContextRelationshipResponse
import java.time.ZoneOffset

@Singleton
open class ContextRelationshipMapper {
    fun toResponse(rel: ContextRelationship): ContextRelationshipResponse {
        val response =
            ContextRelationshipResponse(
                rel.id,
                ContextMapperRelationshipType.fromValue(rel.relationshipType)
            )
        response.upstreamBoundedContext = BoundedContextMapper.toSummaryResponse(rel.upstreamBoundedContext)
        response.downstreamBoundedContext = BoundedContextMapper.toSummaryResponse(rel.downstreamBoundedContext)
        response.upstreamRole = rel.upstreamRole
        response.downstreamRole = rel.downstreamRole
        response.description = rel.description
        response.createdBy = UserMapper.toUserSummary(rel.createdBy)
        response.createdAt = rel.createdAt?.atZone(ZoneOffset.UTC)
        response.updatedAt = rel.updatedAt?.atZone(ZoneOffset.UTC)
        return response
    }
}
