package org.leargon.backend.mapper

import jakarta.inject.Singleton
import org.leargon.backend.domain.ContextRelationship
import org.leargon.backend.model.BusinessDomainSummaryResponse
import org.leargon.backend.model.ContextMapperRelationshipType
import org.leargon.backend.model.ContextRelationshipResponse
import java.time.ZoneOffset

@Singleton
open class ContextRelationshipMapper {

    fun toResponse(rel: ContextRelationship): ContextRelationshipResponse {
        val upstream = rel.upstreamDomain
        val downstream = rel.downstreamDomain
        val response = ContextRelationshipResponse(
            rel.id,
            ContextMapperRelationshipType.fromValue(rel.relationshipType),
            if (upstream != null) BusinessDomainSummaryResponse(upstream.key, upstream.getName("en")) else null,
            if (downstream != null) BusinessDomainSummaryResponse(downstream.key, downstream.getName("en")) else null,
        )
        response.upstreamRole = rel.upstreamRole
        response.downstreamRole = rel.downstreamRole
        response.description = rel.description
        response.createdBy = UserMapper.toUserSummary(rel.createdBy)
        response.createdAt = rel.createdAt?.atZone(ZoneOffset.UTC)
        response.updatedAt = rel.updatedAt?.atZone(ZoneOffset.UTC)
        return response
    }
}
